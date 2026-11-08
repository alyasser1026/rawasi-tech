import { formatTelegramErrorDetails, telegramHtml } from './telegram-error-guidance';

const serverDedupeCache = new Map<string, { timestamp: number; count: number }>();
const SERVER_DEDUPE_WINDOW_MS = 60 * 1000;

export async function sendServerTelegramAlert(payload: {
  level?: 'fatal' | 'error' | 'warning' | 'info';
  category?: 'api_failure' | 'database_error' | 'business_exception';
  message: string;
  code?: string;
  status?: number;
  stack?: string;
  route?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!botToken || !chatId) return;

  try {
    const now = Date.now();
    for (const [key, entry] of serverDedupeCache.entries()) {
      if (now - entry.timestamp > SERVER_DEDUPE_WINDOW_MS * 2) {
        serverDedupeCache.delete(key);
      }
    }
    const dedupeKey = `${payload.route || ''}|${payload.code || ''}|${(payload.message || '').trim().slice(0, 150)}`;
    const existing = serverDedupeCache.get(dedupeKey);
    if (existing && now - existing.timestamp < SERVER_DEDUPE_WINDOW_MS) {
      existing.count += 1;
      return;
    }
    const previousOccurrences = existing && existing.count > 1 ? existing.count : 1;
    serverDedupeCache.set(dedupeKey, { timestamp: now, count: 1 });

    const levelIcons: Record<string, string> = {
      fatal: '🔥 [حرج جداً - CRITICAL]',
      error: '🚨 [خطأ تقني في الخادم - SERVER ERROR]',
      warning: '⚠️ [تحذير تقني - WARNING]',
      info: 'ℹ️ [معلومات - INFO]',
    };

    const header = levelIcons[payload.level || 'error'] || '🚨 [خطأ تقني في الخادم - SERVER ERROR]';
    const dateStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Riyadh' });

    let text = `<b>${header}</b>\n`;
    text += `<b>نظام إدارة المشروعات والمحاسبة — فاي تك</b>\n\n`;
    if (payload.route) {
      text += `📍 <b>المسار (Route):</b> <code>${telegramHtml(payload.route)}</code>\n`;
    }
    if (previousOccurrences > 1) {
      text += `🔁 <b>عدد التكرارات المجمّعة (خلال دقيقة):</b> <code>${previousOccurrences}</code>\n`;
    }
    text += `🕒 <b>التاريخ والوقت:</b> <code>${dateStr}</code>\n`;
    text = formatTelegramErrorDetails(text, { ...payload, source: payload.route });

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error('Failed to send server telegram alert:', err);
  }
}
