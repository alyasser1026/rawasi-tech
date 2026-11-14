/**
 * lib/telegram-notifier.ts
 * خدمة موحدة ومتقدمة لإرسال إشعارات التلغرام لعمليات تسجيل الدخول وزوار الموقع
 */

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

// In-memory cooldown cache to prevent spam (15 mins per IP for visitors)
const visitorCooldownMap = new Map<string, number>();
const VISITOR_COOLDOWN_MS = 15 * 60 * 1000;

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

export function parseDeviceAndBrowser(ua: string): { device: string; browser: string; os: string } {
  let os = 'غير محدد';
  let device = 'كمبيوتر (Desktop)';
  let browser = 'متصفح ويب';

  // 1. OS & Device parsing
  const iosMatch = ua.match(/iPhone OS (\d+[._]\d+)/i);
  if (iosMatch) {
    os = `iOS ${iosMatch[1].replace(/_/g, '.')}`;
    device = 'آيفون (iPhone) 📱';
  } else if (/iPad/i.test(ua)) {
    const ipadMatch = ua.match(/OS (\d+[._]\d+)/i);
    os = `iPadOS ${ipadMatch ? ipadMatch[1].replace(/_/g, '.') : ''}`;
    device = 'آيباد (iPad) 📱';
  } else if (/Android/i.test(ua)) {
    const androidMatch = ua.match(/Android\s+([\d.]+)/i);
    os = `Android ${androidMatch ? androidMatch[1] : ''}`;
    const modelMatch = ua.match(/Android[^;]+;\s*([^;)]+)\s*(?:Build|[;)])/i);
    const model = modelMatch ? modelMatch[1].trim() : '';
    device = model ? `هاتف (${model}) 📱` : 'هاتف أندرويد 📱';
  } else if (/Windows NT 10\.0/i.test(ua)) {
    os = 'Windows 10 / 11 💻';
    device = 'كمبيوتر مكتبي (PC)';
  } else if (/Windows/i.test(ua)) {
    os = 'Windows 💻';
    device = 'كمبيوتر مكتبي (PC)';
  } else if (/Macintosh.*Mac OS X (\d+[._]\d+)/i.test(ua)) {
    const macMatch = ua.match(/Mac OS X (\d+[._]\d+)/i);
    os = `macOS ${macMatch ? macMatch[1].replace(/_/g, '.') : ''} 💻`;
    device = 'كمبيوتر ماك (Mac)';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux 💻';
    device = 'نظام لينكس (PC)';
  }

  // 2. Browser & In-App Webview parsing with versions
  const tiktokMatch =
    ua.match(/(?:musical_ly|bytedance|tiktok)[_ /]([\d.]+)/i) ||
    (ua.match(/AppVersion\/([\d.]+)/i) && /musical_ly/i.test(ua) ? ua.match(/AppVersion\/([\d.]+)/i) : null);
  const fbMatch = ua.match(/FBAV\/([\d.]+)/i);
  const edgeMatch = ua.match(/edg\/([\d.]+)/i);
  const samsungMatch = ua.match(/samsungbrowser\/([\d.]+)/i);
  const chromeMatch = ua.match(/chrome\/([\d.]+)/i);
  const firefoxMatch = ua.match(/firefox\/([\d.]+)/i);
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

  if (r.includes('tiktok') || u.includes('tiktok') || u.includes('musical_ly')) return '🎵 تيك توك (TikTok / رابط البايو)';
  if (r.includes('instagram') || u.includes('instagram')) return '📸 إنستغرام (Instagram / رابط البايو)';
  if (r.includes('facebook') || r.includes('fb.me') || u.includes('fbav')) return '🔵 فيسبوك (Facebook)';
  if (r.includes('google')) return '🔍 محرك بحث جوجل (Google)';
  if (r.includes('t.co') || r.includes('twitter') || r.includes('x.com')) return '🐦 منصة إكس (Twitter/X)';
  if (r.includes('snapchat') || u.includes('snapchat')) return '👻 سناب شات (Snapchat)';
  if (r.includes('linkedin')) return '💼 لينكد إن (LinkedIn)';
  if (r.includes('whatsapp') || r.includes('wa.me')) return '💬 واتساب (WhatsApp)';
  if (r.includes('youtube')) return '▶️ يوتيوب (YouTube)';
  if (!ref || ref === '' || ref === 'direct') return '🔗 زيارة مباشرة (Direct / رابط الحساب)';

  try {
    const host = new URL(ref).hostname;
    return `🌐 موقع خارجي (${host})`;
  } catch {
    return ref.slice(0, 40);
  }
}

export function isBotOrCrawler(ua: string): boolean {
  if (!ua) return false;
  return /bot|crawler|spider|googlebot|bingbot|yandex|slurp|duckduckbot|baiduspider|petalbot|ahrefs|semrush|dotbot|rogerbot|facebookexternalhit|whatsapp|telegrambot|headlesschrome/i.test(ua);
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
  role?: string;
  destination?: string;
  ip?: string;
  country?: string;
  city?: string;
  userAgent?: string;
  status?: string;
}

/**
 * Send User Login or Registration Notification
 */
export async function sendLoginNotification(input: LoginAlertInput): Promise<boolean> {
  const timeStr = formatTimeArabic();
  const { device, browser, os } = parseDeviceAndBrowser(input.userAgent || '');
  const roleLabel = ROLE_LABELS[input.role || 'client'] || input.role || 'عميل (Client)';
  const countryName = input.country ? (COUNTRY_NAMES[input.country.toUpperCase()] || input.country) : null;
  const locationStr = countryName ? `${countryName}${input.city ? ` - ${input.city}` : ''}` : 'غير محدد';

  let msg = '';
  if (input.type === 'signup') {
    msg += `🆕 <b>إنشاء حساب جديد في النظام!</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `👤 <b>الاسم:</b> ${escapeTgHtml(input.fullName || 'غير محدد')}\n`;
    msg += `✉️ <b>البريد:</b> <code>${escapeTgHtml(input.email)}</code>\n`;
    msg += `🏷️ <b>الرتبة:</b> ${escapeTgHtml(roleLabel)}\n`;
    if (input.status) {
      msg += `📌 <b>الحالة:</b> ${escapeTgHtml(input.status)}\n`;
    }
  } else {
    msg += `🔐 <b>تسجيل دخول جديد إلى النظام</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `👤 <b>المستخدم:</b> ${escapeTgHtml(input.fullName || input.email.split('@')[0])}\n`;
    msg += `✉️ <b>البريد:</b> <code>${escapeTgHtml(input.email)}</code>\n`;
    msg += `🏷️ <b>الصلاحية:</b> ${escapeTgHtml(roleLabel)}\n`;
    if (input.destination) {
      msg += `🧭 <b>الوجهة:</b> <code>${escapeTgHtml(input.destination)}</code>\n`;
    }
  }

  msg += `📱 <b>الجهاز:</b> ${escapeTgHtml(device)} • ${escapeTgHtml(os)}\n`;
  msg += `🌐 <b>المتصفح:</b> ${escapeTgHtml(browser)}\n`;
  if (locationStr !== 'غير محدد') {
    msg += `🌍 <b>الموقع:</b> ${escapeTgHtml(locationStr)}\n`;
  }
  if (input.ip) {
    msg += `📡 <b>عنوان IP:</b> <code>${escapeTgHtml(input.ip)}</code>\n`;
  }
  msg += `🕒 <b>الوقت:</b> <code>${escapeTgHtml(timeStr)}</code>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🏢 <i>منظومة فاي تك لإدارة المشروعات</i>`;

  const buttons: TelegramInlineButton[][] = [];
  if (input.ip && input.ip !== '127.0.0.1' && input.ip !== '::1') {
    buttons.push([
      { text: '🗺️ فحص الـ IP والموقع على الخريطة', url: `https://whatismyipaddress.com/ip/${encodeURIComponent(input.ip)}` },
    ]);
  }

  return sendTelegramMessage(msg, buttons.length ? { inline_keyboard: buttons } : undefined);
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
}

/**
 * Send Website Visitor Notification (with rich details, rate limiting & bot filtering)
 */
export async function sendVisitorNotification(input: VisitorAlertInput): Promise<{ ok: boolean; reason?: string }> {
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
    // Clean old entries
    for (const [key, timestamp] of visitorCooldownMap.entries()) {
      if (now - timestamp > VISITOR_COOLDOWN_MS * 2) {
        visitorCooldownMap.delete(key);
      }
    }
    visitorCooldownMap.set(clientIp, now);
  }

  const timeStr = formatTimeArabic();
  const { device, browser, os } = parseDeviceAndBrowser(ua);
  const source = parseReferralSource(input.referrer, ua);
  const countryName = input.country ? (COUNTRY_NAMES[input.country.toUpperCase()] || input.country) : null;
  const locationStr = countryName ? `${countryName}${input.city ? ` (${input.city})` : ''}` : 'غير محدد';
  const pagePath = input.path || '/';

  let msg = `👁️ <b>زائر جديد يتصفح الموقع الآن!</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🌐 <b>الصفحة:</b> <code>${escapeTgHtml(pagePath)}</code>\n`;
  msg += `🔗 <b>المصدر:</b> ${escapeTgHtml(source)}\n`;

  if (input.utmCampaign || input.utmSource) {
    const utmDetails = [input.utmSource, input.utmMedium, input.utmCampaign].filter(Boolean).join(' / ');
    msg += `🎯 <b>الحملة الإعلانية:</b> <code>${escapeTgHtml(utmDetails)}</code>\n`;
  }

  msg += `📱 <b>الجهاز:</b> ${escapeTgHtml(device)} • ${escapeTgHtml(os)}\n`;
  msg += `🧭 <b>المتصفح الدقيق:</b> ${escapeTgHtml(browser)}\n`;

  if (input.screen) {
    msg += `📐 <b>أبعاد الشاشة:</b> <code>${escapeTgHtml(input.screen)}</code>\n`;
  }
  if (input.connection) {
    msg += `📶 <b>سرعة الشبكة:</b> <code>${escapeTgHtml(input.connection.toUpperCase())}</code>\n`;
  }
  if (locationStr !== 'غير محدد') {
    msg += `🌍 <b>البلد والمدينة:</b> ${escapeTgHtml(locationStr)}\n`;
  }
  if (input.language || input.timezone) {
    const localeStr = [input.language, input.timezone].filter(Boolean).join(' • ');
    msg += `🗣️ <b>اللغة والمنطقة:</b> <code>${escapeTgHtml(localeStr)}</code>\n`;
  }
  if (clientIp && clientIp !== 'unknown') {
    msg += `📡 <b>عنوان IP:</b> <code>${escapeTgHtml(clientIp)}</code>\n`;
  }
  msg += `🕒 <b>الوقت:</b> <code>${escapeTgHtml(timeStr)}</code>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🏢 <i>موقع فاي تك الرسمي | phi-tech.org</i>`;

  const buttons: TelegramInlineButton[][] = [];
  if (clientIp && clientIp !== 'unknown' && clientIp !== '127.0.0.1' && clientIp !== '::1') {
    buttons.push([
      { text: '🗺️ فحص الـ IP والمزوّد على الخريطة', url: `https://whatismyipaddress.com/ip/${encodeURIComponent(clientIp)}` },
    ]);
  }

  const ok = await sendTelegramMessage(msg, buttons.length ? { inline_keyboard: buttons } : undefined);
  return { ok };
}

/**
 * Send High-Priority Alert when visitor clicks "تواصل واتساب" or a conversion button
 */
export async function sendLeadActionNotification(input: {
  action: string;
  label?: string;
  ip?: string;
  country?: string;
  city?: string;
  userAgent?: string;
}): Promise<boolean> {
  const timeStr = formatTimeArabic();
  const { device, browser, os } = parseDeviceAndBrowser(input.userAgent || '');
  const countryName = input.country ? (COUNTRY_NAMES[input.country.toUpperCase()] || input.country) : null;
  const locationStr = countryName ? `${countryName}${input.city ? ` (${input.city})` : ''}` : 'غير محدد';

  let msg = `🔥 <b>تنبيه عميل محتمل (Lead) مهتم بالتعاقد!</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `⚡ <b>الإجراء:</b> قام بالضغط على [<b>${escapeTgHtml(input.label || input.action)}</b>]\n`;
  msg += `📱 <b>الجهاز:</b> ${escapeTgHtml(device)} • ${escapeTgHtml(os)}\n`;
  msg += `🧭 <b>المتصفح:</b> ${escapeTgHtml(browser)}\n`;
  if (locationStr !== 'غير محدد') {
    msg += `🌍 <b>الموقع:</b> ${escapeTgHtml(locationStr)}\n`;
  }
  if (input.ip && input.ip !== '127.0.0.1') {
    msg += `📡 <b>عنوان IP:</b> <code>${escapeTgHtml(input.ip)}</code>\n`;
  }
  msg += `🕒 <b>الوقت:</b> <code>${escapeTgHtml(timeStr)}</code>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💬 <i>العميل في طريقه لمحادثتك على الواتساب الآن!</i>`;

  return sendTelegramMessage(msg);
}
