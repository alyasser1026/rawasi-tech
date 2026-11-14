/**
 * lib/telegram-notifier.ts
 * خدمة موحدة ومتقدمة لإرسال إشعارات التلغرام لعمليات تسجيل الدخول وزوار الموقع وبيانات الأجهزة والـ IP
 */

import type { ClientDeviceDetails } from './client-device-info';

const COUNTRY_NAMES: Record<string, string> = {
  EG: 'مصر 🇪🇬',
  SA: 'المملكة العربية السعودية 🇸🇦',
  AE: 'الإمارات العربية المتحدة 🇦🇪',
  KW: 'الكويت 🇰🇼',
  QA: 'قطر 🇶🇦',
  OM: 'سلطنة عُمان 🇴🇲',
  BH: 'البحرين 🇧🇭',
  JO: 'الأردن 🇯🇴',
  IQ: 'العراق 🇮🇶',
  SY: 'سوريا 🇸🇾',
  LB: 'لبنان 🇱🇧',
  PS: 'فلسطين 🇵🇸',
  YE: 'اليمن 🇾🇪',
  LY: 'ليبيا 🇱🇾',
  SD: 'السودان 🇸🇩',
  MA: 'المغرب 🇲🇦',
  DZ: 'الجزائر 🇩🇿',
  TN: 'تونس 🇹🇳',
  TR: 'تركيا 🇹🇷',
  US: 'الولايات المتحدة 🇺🇸',
  GB: 'المملكة المتحدة 🇬🇧',
  DE: 'ألمانيا 🇩🇪',
  FR: 'فرنسا 🇫🇷',
  IT: 'إيطاليا 🇮🇹',
  CA: 'كندا 🇨🇦',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'مدير نظام (Admin) 👑',
  manager: 'مدير (Manager) 💼',
  staff: 'مهندس / كادر فني (Staff) 👷',
  partner: 'شريك استراتيجي (Partner) 🤝',
  client: 'عميل (Client) 👤',
};

const DEVICE_MODEL_PREFIX_MAP: Array<[RegExp, string]> = [
  [/^SM-S928/i, 'Samsung Galaxy S24 Ultra'],
  [/^SM-S926/i, 'Samsung Galaxy S24+'],
  [/^SM-S921/i, 'Samsung Galaxy S24'],
  [/^SM-S918/i, 'Samsung Galaxy S23 Ultra'],
  [/^SM-S916/i, 'Samsung Galaxy S23+'],
  [/^SM-S911/i, 'Samsung Galaxy S23'],
  [/^SM-S908/i, 'Samsung Galaxy S22 Ultra'],
  [/^SM-G998/i, 'Samsung Galaxy S21 Ultra'],
  [/^SM-F956/i, 'Samsung Galaxy Z Fold6'],
  [/^SM-F946/i, 'Samsung Galaxy Z Fold5'],
  [/^SM-F741/i, 'Samsung Galaxy Z Flip6'],
  [/^SM-F731/i, 'Samsung Galaxy Z Flip5'],
  [/^SM-A556/i, 'Samsung Galaxy A55'],
  [/^SM-A546/i, 'Samsung Galaxy A54'],
  [/^SM-A536/i, 'Samsung Galaxy A53'],
  [/^SM-A356/i, 'Samsung Galaxy A35'],
  [/^SM-A346/i, 'Samsung Galaxy A34'],
  [/^SM-A256/i, 'Samsung Galaxy A25'],
  [/^SM-A15[56]/i, 'Samsung Galaxy A15'],
  [/^SM-N986/i, 'Samsung Galaxy Note20 Ultra'],
  [/^2311DRK48|^23127PN0C/i, 'Xiaomi 14 / POCO'],
  [/^2201116SG/i, 'Xiaomi Redmi Note 11 Pro'],
  [/^CPH2581/i, 'OnePlus 12'],
];

export interface IpGeoIntelligence {
  ip: string;
  country?: string;
  countryCode?: string;
  regionName?: string;
  city?: string;
  district?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  mobile?: boolean;
  proxy?: boolean;
  hosting?: boolean;
}

// In-memory cooldown cache to prevent spam (15 mins per IP for visitors)
const visitorCooldownMap = new Map<string, number>();
const VISITOR_COOLDOWN_MS = 15 * 60 * 1000;

// In-memory IP geo intelligence cache (60 minutes)
const ipGeoCache = new Map<string, { timestamp: number; data: IpGeoIntelligence | null }>();
const IP_GEO_CACHE_MS = 60 * 60 * 1000;

export function extractClientIp(req: { headers: { get(name: string): string | null } }): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '';
}

// Escape HTML for Telegram
export function escapeTgHtml(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normalize Egyptian, Saudi, or international phone number to WhatsApp digits-only format.
 */
export function normalizePhoneForWhatsApp(phone?: string | null): string | null {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (/^01[0125]\d{8}$/.test(digits)) {
    return `20${digits.slice(1)}`;
  }
  if (/^05\d{8}$/.test(digits)) {
    return `966${digits.slice(1)}`;
  }
  return digits.length >= 10 ? digits : null;
}

function mapDeviceMarketingName(rawModel: string): string {
  const clean = rawModel.replace(/\s+Build\/.*$/i, '').trim();
  if (!clean || clean.toUpperCase() === 'K') return '';
  for (const [pattern, name] of DEVICE_MODEL_PREFIX_MAP) {
    if (pattern.test(clean)) {
      return `${name} (${clean})`;
    }
  }
  return clean;
}

export function parseDeviceAndBrowser(
  ua: string,
  modelHint?: string
): { device: string; browser: string; os: string } {
  let os = 'غير محدد';
  let device = 'كمبيوتر (Desktop)';
  let browser = 'متصفح ويب';

  // 1. OS & Device parsing
  const iosMatch = ua.match(/iPhone OS (\d+[._]\d+(?:[._]\d+)?)/i);
  if (iosMatch) {
    os = `iOS ${iosMatch[1].replace(/_/g, '.')}`;
    device = 'آيفون (iPhone) 📱';
  } else if (/iPad/i.test(ua)) {
    const ipadMatch = ua.match(/OS (\d+[._]\d+(?:[._]\d+)?)/i);
    os = `iPadOS ${ipadMatch ? ipadMatch[1].replace(/_/g, '.') : ''}`.trim();
    device = 'آيباد (iPad) 📱';
  } else if (/Android/i.test(ua)) {
    const androidMatch = ua.match(/Android\s+([\d.]+)/i);
    os = `Android ${androidMatch ? androidMatch[1] : ''}`.trim();
    const modelMatch = ua.match(/Android[^;]+;\s*([^;)]+)\s*(?:Build|[;)])/i);
    const uaModelRaw = modelMatch ? modelMatch[1].trim() : '';
    const resolvedModel =
      mapDeviceMarketingName(uaModelRaw) ||
      (modelHint ? mapDeviceMarketingName(modelHint) : '');
    device = resolvedModel ? `هاتف ${resolvedModel} 📱` : 'هاتف أندرويد 📱';
  } else if (/Windows NT 10\.0/i.test(ua)) {
    os = 'Windows 10 / 11 💻';
    device = modelHint ? `كمبيوتر (${modelHint})` : 'كمبيوتر مكتبي (PC)';
  } else if (/Windows/i.test(ua)) {
    os = 'Windows 💻';
    device = 'كمبيوتر مكتبي (PC)';
  } else if (/Macintosh.*Mac OS X (\d+[._]\d+)/i.test(ua)) {
    const macMatch = ua.match(/Mac OS X (\d+[._]\d+)/i);
    os = `macOS ${macMatch ? macMatch[1].replace(/_/g, '.') : ''} 💻`.trim();
    device = 'كمبيوتر ماك (Mac)';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux 💻';
    device = 'نظام لينكس (PC)';
  }

  // 2. Browser & In-App Webview parsing with versions
  const tiktokMatch =
    ua.match(/(?:musical_ly|bytedance|tiktok)[_ /]([\d.]+)/i) ||
    (ua.match(/AppVersion\/([\d.]+)/i) && /musical_ly/i.test(ua)
      ? ua.match(/AppVersion\/([\d.]+)/i)
      : null);
  const fbMatch = ua.match(/FBAV\/([\d.]+)/i);
  const edgeMatch = ua.match(/edg\/([\d.]+)/i);
  const samsungMatch = ua.match(/samsungbrowser\/([\d.]+)/i);
  const chromeMatch = ua.match(/(?:chrome|crios)\/([\d.]+)/i);
  const firefoxMatch = ua.match(/(?:firefox|fxios)\/([\d.]+)/i);
  const safariMatch = ua.match(/version\/([\d.]+).*safari/i);

  if (tiktokMatch || /tiktok|musical_ly/i.test(ua)) {
    browser = `تطبيق تيك توك 🎵 (TikTok ${tiktokMatch ? `v${tiktokMatch[1].split('.')[0]}` : 'In-App'})`;
  } else if (/instagram/i.test(ua)) {
    browser = 'تطبيق إنستغرام 📸 (Instagram In-App)';
  } else if (fbMatch || /fbav|fban|fb_iab/i.test(ua)) {
    browser = `تطبيق فيسبوك 🔵 (Facebook ${fbMatch ? `v${fbMatch[1].split('.')[0]}` : 'In-App'})`;
  } else if (/snapchat/i.test(ua)) {
    browser = 'تطبيق سناب شات 👻 (Snapchat)';
  } else if (edgeMatch) {
    browser = `Microsoft Edge ${edgeMatch[1].split('.')[0]}`;
  } else if (samsungMatch) {
    browser = `Samsung Internet ${samsungMatch[1].split('.')[0]}`;
  } else if (chromeMatch) {
    browser = `Google Chrome ${chromeMatch[1].split('.')[0]}`;
  } else if (firefoxMatch) {
    browser = `Mozilla Firefox ${firefoxMatch[1].split('.')[0]}`;
  } else if (safariMatch) {
    browser = `Apple Safari ${safariMatch[1]}`;
  }

  return { device, browser, os };
}

export function parseReferralSource(ref?: string, ua?: string): string {
  const r = (ref || '').toLowerCase();
  const u = (ua || '').toLowerCase();

  if (r.includes('tiktok') || u.includes('tiktok') || u.includes('musical_ly')) {
    return '🎵 تيك توك (TikTok / رابط البايو)';
  }
  if (r.includes('instagram') || u.includes('instagram')) {
    return '📸 إنستغرام (Instagram / رابط البايو)';
  }
  if (r.includes('facebook') || r.includes('fb.me') || u.includes('fbav')) {
    return '🔵 فيسبوك (Facebook)';
  }
  if (r.includes('google')) return '🔍 محرك بحث جوجل (Google)';
  if (r.includes('t.co') || r.includes('twitter') || r.includes('x.com')) {
    return '🐦 منصة إكس (Twitter/X)';
  }
  if (r.includes('snapchat') || u.includes('snapchat')) return '👻 سناب شات (Snapchat)';
  if (r.includes('linkedin')) return '💼 لينكد إن (LinkedIn)';
  if (r.includes('whatsapp') || r.includes('wa.me')) return '💬 واتساب (WhatsApp)';
  if (r.includes('youtube')) return '▶️ يوتيوب (YouTube)';
  if (!ref || ref === '' || ref === 'direct') {
    return '🔗 زيارة مباشرة (Direct / رابط الحساب)';
  }

  try {
    const host = new URL(ref).hostname;
    return `🌐 موقع خارجي (${host})`;
  } catch {
    return ref.slice(0, 40);
  }
}

export function isBotOrCrawler(ua: string): boolean {
  if (!ua) return false;
  return /bot|crawler|spider|googlebot|bingbot|yandex|slurp|duckduckbot|baiduspider|petalbot|ahrefs|semrush|dotbot|rogerbot|facebookexternalhit|whatsapp|telegrambot|headlesschrome/i.test(
    ua
  );
}

export function formatTimeArabic(date = new Date()): string {
  return date.toLocaleString('ar-EG', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function isLocalOrTestEnv(ip?: string): boolean {
  if (!ip) return true;
  const clean = ip.trim();
  if (
    clean === 'unknown' ||
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean.startsWith('192.168.') ||
    clean.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(clean)
  ) {
    return true;
  }
  if (
    process.env.TELEGRAM_BOT_TOKEN === 'mock_bot_token' ||
    process.env.NODE_ENV === 'test'
  ) {
    return true;
  }
  return false;
}

/**
 * Resolve deep IP Geolocation, Telecom Carrier (ISP), cellular/proxy status and lat/lon
 */
export async function lookupIpIntelligence(
  ip?: string
): Promise<IpGeoIntelligence | null> {
  if (!ip || isLocalOrTestEnv(ip)) return null;
  const cleanIp = ip.trim();

  const now = Date.now();
  const cached = ipGeoCache.get(cleanIp);
  if (cached && now - cached.timestamp < IP_GEO_CACHE_MS) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const url = `http://ip-api.com/json/${encodeURIComponent(cleanIp)}?fields=status,country,countryCode,regionName,city,district,zip,lat,lon,timezone,isp,org,as,mobile,proxy,hosting`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      ipGeoCache.set(cleanIp, { timestamp: now, data: null });
      return null;
    }

    const json = (await res.json()) as any;
    if (json?.status !== 'success') {
      ipGeoCache.set(cleanIp, { timestamp: now, data: null });
      return null;
    }

    const intel: IpGeoIntelligence = {
      ip: cleanIp,
      country: json.country,
      countryCode: json.countryCode,
      regionName: json.regionName,
      city: json.city,
      district: json.district,
      zip: json.zip,
      lat: typeof json.lat === 'number' ? json.lat : undefined,
      lon: typeof json.lon === 'number' ? json.lon : undefined,
      timezone: json.timezone,
      isp: json.isp,
      org: json.org,
      as: json.as,
      mobile: typeof json.mobile === 'boolean' ? json.mobile : undefined,
      proxy: typeof json.proxy === 'boolean' ? json.proxy : undefined,
      hosting: typeof json.hosting === 'boolean' ? json.hosting : undefined,
    };

    // Prune stale entries
    if (ipGeoCache.size > 500) {
      for (const [k, v] of ipGeoCache.entries()) {
        if (now - v.timestamp > IP_GEO_CACHE_MS) ipGeoCache.delete(k);
      }
    }

    ipGeoCache.set(cleanIp, { timestamp: now, data: intel });
    return intel;
  } catch {
    ipGeoCache.set(cleanIp, { timestamp: now, data: null });
    return null;
  }
}

function appendTelemetryAndLocation(
  lines: string[],
  opts: {
    device: string;
    os: string;
    browser: string;
    deviceDetails?: ClientDeviceDetails;
    geo: IpGeoIntelligence | null;
    headerCountry?: string;
    headerCity?: string;
    ip?: string;
  }
) {
  const { device, os, browser, deviceDetails, geo, headerCountry, headerCity, ip } = opts;

  lines.push(`📱 <b>الجهاز:</b> ${escapeTgHtml(device)} • ${escapeTgHtml(os)}`);
  lines.push(`🧭 <b>المتصفح الدقيق:</b> ${escapeTgHtml(browser)}`);

  // Hardware telemetry block
  const hwParts: string[] = [];
  if (deviceDetails?.cpuCores) hwParts.push(`${deviceDetails.cpuCores} أنوية CPU`);
  if (deviceDetails?.ramGb) hwParts.push(`${deviceDetails.ramGb} GB RAM`);
  if (typeof deviceDetails?.batteryLevel === 'number') {
    const batIcon = deviceDetails.batteryCharging ? '⚡' : '🔋';
    hwParts.push(`${batIcon} بطارية ${deviceDetails.batteryLevel}%`);
  }
  if (hwParts.length > 0) {
    lines.push(`⚙️ <b>عتاد الجهاز:</b> <code>${escapeTgHtml(hwParts.join(' • '))}</code>`);
  }

  if (deviceDetails?.gpu) {
    lines.push(`🎮 <b>معالج الرسوميات (GPU):</b> <code>${escapeTgHtml(deviceDetails.gpu)}</code>`);
  }

  if (deviceDetails?.screen) {
    const screenExtras: string[] = [deviceDetails.screen];
    if (deviceDetails.pixelRatio) screenExtras.push(`${deviceDetails.pixelRatio}x Retina`);
    if (deviceDetails.colorScheme) {
      screenExtras.push(deviceDetails.colorScheme === 'dark' ? '🌙 ليلي' : '☀️ نهاري');
    }
    lines.push(`📐 <b>الشاشة والوضع:</b> <code>${escapeTgHtml(screenExtras.join(' • '))}</code>`);
  }

  if (deviceDetails?.connection || deviceDetails?.downlinkMbps) {
    const netParts: string[] = [];
    if (deviceDetails.connection) netParts.push(deviceDetails.connection.toUpperCase());
    if (deviceDetails.downlinkMbps) netParts.push(`~${deviceDetails.downlinkMbps} Mbps`);
    lines.push(`📶 <b>سرعة الشبكة:</b> <code>${escapeTgHtml(netParts.join(' • '))}</code>`);
  }

  // ISP & Connection Type
  if (geo?.isp) {
    const connBadge = geo.mobile
      ? 'بيانات جوال (4G/5G) 📱'
      : 'إنترنت منزلي / واي فاي 🏠';
    const ispLine = `${geo.isp} • ${connBadge}${geo.proxy ? ' ⚠️ (VPN/Proxy)' : ''}`;
    lines.push(`🏢 <b>شركة الاتصالات (ISP):</b> ${escapeTgHtml(ispLine)}`);
  }

  // Location block (combining Geo + Header fallback)
  const cc = (geo?.countryCode || headerCountry || '').toUpperCase();
  const countryLabel = cc ? COUNTRY_NAMES[cc] || geo?.country || cc : geo?.country || '';
  const regionLabel = geo?.regionName || '';
  const cityLabel = geo?.city || headerCity || '';
  const districtLabel = geo?.district || '';
  const locParts = [countryLabel, regionLabel, cityLabel, districtLabel].filter(Boolean);
  if (locParts.length > 0) {
    lines.push(`🌍 <b>الموقع التفصيلي:</b> ${escapeTgHtml(locParts.join(' • '))}`);
  }

  if (deviceDetails?.language || deviceDetails?.timezone || geo?.timezone) {
    const tz = deviceDetails?.timezone || geo?.timezone;
    const localeStr = [deviceDetails?.language, tz].filter(Boolean).join(' • ');
    lines.push(`🗣️ <b>اللغة والمنطقة:</b> <code>${escapeTgHtml(localeStr)}</code>`);
  }

  if (ip && ip !== 'unknown') {
    lines.push(`📡 <b>عنوان IP:</b> <code>${escapeTgHtml(ip)}</code>`);
  }
}

function buildActionButtons(opts: {
  phone?: string | null;
  ip?: string;
  geo?: IpGeoIntelligence | null;
}): TelegramInlineButton[][] {
  const rows: TelegramInlineButton[][] = [];

  const waPhone = normalizePhoneForWhatsApp(opts.phone);
  if (waPhone) {
    rows.push([
      {
        text: '💬 مراسلة العميل على واتساب فوراً',
        url: `https://wa.me/${waPhone}`,
      },
    ]);
  }

  const mapRow: TelegramInlineButton[] = [];
  if (
    opts.geo &&
    typeof opts.geo.lat === 'number' &&
    typeof opts.geo.lon === 'number'
  ) {
    mapRow.push({
      text: '📍 الموقع على خرائط جوجل',
      url: `https://www.google.com/maps?q=${opts.geo.lat},${opts.geo.lon}`,
    });
  }
  if (
    opts.ip &&
    opts.ip !== 'unknown' &&
    opts.ip !== '127.0.0.1' &&
    opts.ip !== '::1'
  ) {
    mapRow.push({
      text: '🗺️ فحص الـ IP والمزوّد',
      url: `https://whatismyipaddress.com/ip/${encodeURIComponent(opts.ip)}`,
    });
  }

  if (mapRow.length > 0) rows.push(mapRow);
  return rows;
}

export interface TelegramInlineButton {
  text: string;
  url?: string;
  callback_data?: string;
}

/**
 * Send HTML text to Telegram with optional inline buttons
 */
export async function sendTelegramMessage(
  htmlText: string,
  replyMarkup?: { inline_keyboard: TelegramInlineButton[][] }
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    console.warn('[TelegramNotifier] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.');
    return false;
  }

  try {
    const payload: Record<string, any> = {
      chat_id: chatId,
      text: htmlText,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };

    if (replyMarkup?.inline_keyboard?.length) {
      payload.reply_markup = replyMarkup;
    }

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.text();
      console.error('[TelegramNotifier] Failed to send message:', res.status, errData);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[TelegramNotifier] Network error sending message:', err);
    return false;
  }
}

export interface LoginAlertInput {
  type: 'login' | 'signup';
  userId?: string;
  email: string;
  fullName?: string;
  phone?: string;
  role?: string;
  destination?: string;
  ip?: string;
  country?: string;
  city?: string;
  userAgent?: string;
  status?: string;
  deviceDetails?: ClientDeviceDetails;
}

/**
 * Send User Login or Registration Notification
 */
export async function sendLoginNotification(input: LoginAlertInput): Promise<boolean> {
  const timeStr = formatTimeArabic();
  const { device, browser, os } = parseDeviceAndBrowser(
    input.userAgent || '',
    input.deviceDetails?.deviceModel
  );
  const roleLabel = ROLE_LABELS[input.role || 'client'] || input.role || 'عميل (Client)';
  const geo = await lookupIpIntelligence(input.ip);

  const lines: string[] = [];
  if (input.type === 'signup') {
    lines.push(`🆕 <b>إنشاء حساب جديد في النظام!</b>`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`👤 <b>الاسم:</b> ${escapeTgHtml(input.fullName || 'غير محدد')}`);
    if (input.phone) {
      lines.push(`📞 <b>رقم الجوال:</b> <code>${escapeTgHtml(input.phone)}</code>`);
    }
    lines.push(`✉️ <b>البريد:</b> <code>${escapeTgHtml(input.email)}</code>`);
    lines.push(`🏷️ <b>الرتبة:</b> ${escapeTgHtml(roleLabel)}`);
    if (input.status) {
      lines.push(`📌 <b>الحالة:</b> ${escapeTgHtml(input.status)}`);
    }
  } else {
    lines.push(`🔐 <b>تسجيل دخول جديد إلى النظام</b>`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`👤 <b>المستخدم:</b> ${escapeTgHtml(input.fullName || input.email.split('@')[0])}`);
    if (input.phone) {
      lines.push(`📞 <b>رقم الجوال:</b> <code>${escapeTgHtml(input.phone)}</code>`);
    }
    lines.push(`✉️ <b>البريد:</b> <code>${escapeTgHtml(input.email)}</code>`);
    lines.push(`🏷️ <b>الصلاحية:</b> ${escapeTgHtml(roleLabel)}`);
    if (input.destination) {
      lines.push(`🧭 <b>الوجهة:</b> <code>${escapeTgHtml(input.destination)}</code>`);
    }
  }

  if (input.deviceDetails?.visitorId) {
    lines.push(`🪪 <b>معرّف الجهاز:</b> <code>#${escapeTgHtml(input.deviceDetails.visitorId)}</code>`);
  }

  appendTelemetryAndLocation(lines, {
    device,
    os,
    browser,
    deviceDetails: input.deviceDetails,
    geo,
    headerCountry: input.country,
    headerCity: input.city,
    ip: input.ip,
  });

  lines.push(`🕒 <b>الوقت:</b> <code>${escapeTgHtml(timeStr)}</code>`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🏢 <i>منظومة فاي تك لإدارة المشروعات</i>`);

  const buttons = buildActionButtons({
    phone: input.phone || input.deviceDetails?.knownPhone,
    ip: input.ip,
    geo,
  });

  return sendTelegramMessage(
    lines.join('\n'),
    buttons.length ? { inline_keyboard: buttons } : undefined
  );
}

export interface VisitorAlertInput {
  path?: string;
  referrer?: string;
  screen?: string;
  userAgent?: string;
  ip?: string;
  country?: string;
  city?: string;
  language?: string;
  timezone?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  connection?: string;
  deviceDetails?: ClientDeviceDetails;
}

/**
 * Send Website Visitor Notification (with deep hardware/ISP intelligence, rate limiting & bot filtering)
 */
export async function sendVisitorNotification(
  input: VisitorAlertInput
): Promise<{ ok: boolean; reason?: string }> {
  const ua = input.userAgent || '';
  if (isBotOrCrawler(ua)) {
    return { ok: false, reason: 'bot_ignored' };
  }

  // Rate-limiting by IP (15 minutes cooldown)
  const clientIp = (input.ip || 'unknown').trim();
  const now = Date.now();
  if (clientIp !== 'unknown' && clientIp !== '127.0.0.1' && clientIp !== '::1') {
    const lastSeen = visitorCooldownMap.get(clientIp);
    if (lastSeen && now - lastSeen < VISITOR_COOLDOWN_MS) {
      return { ok: true, reason: 'cooldown_active' };
    }
    for (const [key, timestamp] of visitorCooldownMap.entries()) {
      if (now - timestamp > VISITOR_COOLDOWN_MS * 2) {
        visitorCooldownMap.delete(key);
      }
    }
    visitorCooldownMap.set(clientIp, now);
  }

  const timeStr = formatTimeArabic();
  const mergedDetails: ClientDeviceDetails = {
    screen: input.screen,
    language: input.language,
    timezone: input.timezone,
    connection: input.connection,
    ...input.deviceDetails,
  };
  const { device, browser, os } = parseDeviceAndBrowser(
    ua,
    mergedDetails.deviceModel
  );
  const source = parseReferralSource(input.referrer, ua);
  const pagePath = input.path || '/';
  const geo = await lookupIpIntelligence(clientIp);

  const lines: string[] = [
    `👁️ <b>زائر جديد يتصفح الموقع الآن!</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
  ];

  // Known identity highlight (if visitor previously registered or submitted phone)
  if (mergedDetails.knownName || mergedDetails.knownPhone) {
    lines.push(
      `👤 <b>هوية الزائر المسجلة:</b> ${escapeTgHtml(mergedDetails.knownName || 'عميل سابق')}`
    );
  }
  if (mergedDetails.knownPhone) {
    lines.push(
      `📞 <b>رقم الجوال:</b> <code>${escapeTgHtml(mergedDetails.knownPhone)}</code>`
    );
  }

  if (mergedDetails.visitorId) {
    const visitTxt = mergedDetails.visitCount
      ? ` • الزيارة رقم ${mergedDetails.visitCount} لهذا الجهاز`
      : '';
    lines.push(
      `🪪 <b>معرّف الزائر:</b> <code>#${escapeTgHtml(mergedDetails.visitorId)}</code>${escapeTgHtml(visitTxt)}`
    );
  }

  lines.push(`🌐 <b>الصفحة:</b> <code>${escapeTgHtml(pagePath)}</code>`);
  lines.push(`🔗 <b>المصدر:</b> ${escapeTgHtml(source)}`);

  if (input.utmCampaign || input.utmSource) {
    const utmDetails = [input.utmSource, input.utmMedium, input.utmCampaign]
      .filter(Boolean)
      .join(' / ');
    lines.push(`🎯 <b>الحملة الإعلانية:</b> <code>${escapeTgHtml(utmDetails)}</code>`);
  }

  appendTelemetryAndLocation(lines, {
    device,
    os,
    browser,
    deviceDetails: mergedDetails,
    geo,
    headerCountry: input.country,
    headerCity: input.city,
    ip: clientIp,
  });

  lines.push(`🕒 <b>الوقت:</b> <code>${escapeTgHtml(timeStr)}</code>`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🏢 <i>موقع فاي تك الرسمي | phi-tech.org</i>`);

  const buttons = buildActionButtons({
    phone: mergedDetails.knownPhone,
    ip: clientIp,
    geo,
  });

  const ok = await sendTelegramMessage(
    lines.join('\n'),
    buttons.length ? { inline_keyboard: buttons } : undefined
  );
  return { ok };
}

export interface LeadActionInput {
  action: string;
  label?: string;
  phone?: string;
  name?: string;
  email?: string;
  projectKind?: string;
  projectLocation?: string;
  notes?: string;
  ip?: string;
  country?: string;
  city?: string;
  userAgent?: string;
  deviceDetails?: ClientDeviceDetails;
}

/**
 * Send High-Priority Alert when visitor submits a phone number, inquiry form, or clicks WhatsApp
 */
export async function sendLeadActionNotification(
  input: LeadActionInput
): Promise<boolean> {
  const timeStr = formatTimeArabic();
  const { device, browser, os } = parseDeviceAndBrowser(
    input.userAgent || '',
    input.deviceDetails?.deviceModel
  );
  const geo = await lookupIpIntelligence(input.ip);
  const resolvedPhone = input.phone || input.deviceDetails?.knownPhone;
  const resolvedName = input.name || input.deviceDetails?.knownName;

  const lines: string[] = [
    `🔥 <b>تنبيه عميل محتمل (Lead) مهتم بالتعاقد!</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `⚡ <b>الإجراء:</b> قام بالضغط على [<b>${escapeTgHtml(input.label || input.action)}</b>]`,
  ];

  if (resolvedName) {
    lines.push(`👤 <b>اسم العميل:</b> ${escapeTgHtml(resolvedName)}`);
  }
  if (resolvedPhone) {
    lines.push(`📞 <b>رقم الجوال:</b> <code>${escapeTgHtml(resolvedPhone)}</code>`);
  }
  if (input.email || input.deviceDetails?.knownEmail) {
    lines.push(
      `✉️ <b>البريد:</b> <code>${escapeTgHtml(input.email || input.deviceDetails?.knownEmail)}</code>`
    );
  }
  if (input.projectKind) {
    lines.push(`🏗️ <b>نوع المشروع:</b> ${escapeTgHtml(input.projectKind)}`);
  }
  if (input.projectLocation) {
    lines.push(`📍 <b>موقع المشروع:</b> ${escapeTgHtml(input.projectLocation)}`);
  }
  if (input.notes) {
    lines.push(`📝 <b>ملاحظات العميل:</b> <i>${escapeTgHtml(input.notes)}</i>`);
  }

  if (input.deviceDetails?.visitorId) {
    lines.push(`🪪 <b>معرّف الزائر:</b> <code>#${escapeTgHtml(input.deviceDetails.visitorId)}</code>`);
  }

  appendTelemetryAndLocation(lines, {
    device,
    os,
    browser,
    deviceDetails: input.deviceDetails,
    geo,
    headerCountry: input.country,
    headerCity: input.city,
    ip: input.ip,
  });

  lines.push(`🕒 <b>الوقت:</b> <code>${escapeTgHtml(timeStr)}</code>`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`💬 <i>${resolvedPhone ? 'يمكنك مراسلته مباشرة بالضغط على زر الواتساب أدناه!' : 'العميل في طريقه لمحادثتك الآن!'}</i>`);

  const buttons = buildActionButtons({
    phone: resolvedPhone,
    ip: input.ip,
    geo,
  });

  return sendTelegramMessage(
    lines.join('\n'),
    buttons.length ? { inline_keyboard: buttons } : undefined
  );
}
