/**
 * lib/telegram-notifier.ts
 * خدمة موحدة لإرسال إشعارات التلغرام لعمليات تسجيل الدخول وزوار الموقع
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

export function parseDeviceAndBrowser(ua: string): { device: string; browser: string } {
  let device = 'كمبيوتر (Desktop)';
  if (/iphone/i.test(ua)) device = 'آيفون (iPhone) 📱';
  else if (/ipad/i.test(ua)) device = 'آيباد (iPad) 📱';
  else if (/android.*mobile/i.test(ua)) device = 'هاتف أندرويد (Android) 📱';
  else if (/android/i.test(ua)) device = 'تابلت أندرويد (Tablet) 📱';
  else if (/mobile/i.test(ua)) device = 'هاتف ذكي (Mobile) 📱';
  else if (/windows/i.test(ua)) device = 'كمبيوتر (Windows) 💻';
  else if (/macintosh|mac os x/i.test(ua)) device = 'كمبيوتر ماك (Mac) 💻';
  else if (/linux/i.test(ua)) device = 'كمبيوتر (Linux) 💻';

  let browser = 'متصفح ويب';
  if (/tiktok|musical_ly|bytedance/i.test(ua)) browser = 'متصفح تيك توك الداخلي (TikTok In-App) 🎵';
  else if (/instagram/i.test(ua)) browser = 'متصفح إنستغرام (Instagram In-App) 📸';
  else if (/fbav|fban/i.test(ua)) browser = 'متصفح فيسبوك (Facebook In-App) 🔵';
  else if (/snapchat/i.test(ua)) browser = 'متصفح سناب شات (Snapchat) 👻';
  else if (/edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/samsungbrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/chrome|crios/i.test(ua)) browser = 'Google Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/safari/i.test(ua)) browser = 'Apple Safari';

  return { device, browser };
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

/**
 * Send raw HTML text to configured Telegram chat
 */
export async function sendTelegramMessage(htmlText: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    console.warn('[TelegramNotifier] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.');
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
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
  const { device, browser } = parseDeviceAndBrowser(input.userAgent || '');
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

  msg += `📱 <b>الجهاز:</b> ${escapeTgHtml(device)}\n`;
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

  return sendTelegramMessage(msg);
}

export interface VisitorAlertInput {
  path?: string;
  referrer?: string;
  screen?: string;
  userAgent?: string;
  ip?: string;
  country?: string;
  city?: string;
}

/**
 * Send Website Visitor Notification (with rate limiting & bot filtering)
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
  const { device, browser } = parseDeviceAndBrowser(ua);
  const source = parseReferralSource(input.referrer, ua);
  const countryName = input.country ? (COUNTRY_NAMES[input.country.toUpperCase()] || input.country) : null;
  const locationStr = countryName ? `${countryName}${input.city ? ` (${input.city})` : ''}` : 'غير محدد';
  const pagePath = input.path || '/';

  let msg = `👁️ <b>زائر جديد يتصفح الموقع الآن!</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🌐 <b>الصفحة:</b> <code>${escapeTgHtml(pagePath)}</code>\n`;
  msg += `🔗 <b>المصدر:</b> ${escapeTgHtml(source)}\n`;
  msg += `📱 <b>الجهاز:</b> ${escapeTgHtml(device)}\n`;
  msg += `🧭 <b>المتصفح:</b> ${escapeTgHtml(browser)}\n`;
  if (input.screen) {
    msg += `📐 <b>الشاشة:</b> <code>${escapeTgHtml(input.screen)}</code>\n`;
  }
  if (locationStr !== 'غير محدد') {
    msg += `🌍 <b>البلد:</b> ${escapeTgHtml(locationStr)}\n`;
  }
  if (clientIp && clientIp !== 'unknown') {
    msg += `📡 <b>عنوان IP:</b> <code>${escapeTgHtml(clientIp)}</code>\n`;
  }
  msg += `🕒 <b>الوقت:</b> <code>${escapeTgHtml(timeStr)}</code>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🏢 <i>موقع فاي تك الرسمي | phi-tech.org</i>`;

  const ok = await sendTelegramMessage(msg);
  return { ok };
}
