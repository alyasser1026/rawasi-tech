export async function sendServerTelegramAlert(payload: {
  level?: 'fatal' | 'error' | 'warning' | 'info';
  category?: 'api_failure' | 'database_error' | 'business_exception';
  message: string;
  stack?: string;
  route?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!botToken || !chatId) return;

  try {
    const levelIcons: Record<string, string> = {
      fatal: '🔥 [حرج جداً - CRITICAL]',
      error: '🚨 [خطأ تقني في الخادم - SERVER ERROR]',
      warning: '⚠️ [تحذير تقني - WARNING]',
      info: 'ℹ️ [معلومات - INFO]',
    };

    const header = levelIcons[payload.level || 'error'] || '🚨 [خطأ تقني في الخادم - SERVER ERROR]';
    const dateStr = new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' });

    let text = `<b>${header}</b>\n`;
    text += `<b>نظام إدارة المشروعات والمحاسبة — فاي تك</b>\n\n`;
    if (payload.route) {
      text += `📍 <b>المسار (Route):</b> <code>${payload.route}</code>\n`;
    }
    text += `🕒 <b>التاريخ والوقت:</b> <code>${dateStr}</code>\n`;
    text += `❌ <b>رسالة الخطأ:</b>\n<pre>${payload.message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>\n`;

    if (payload.stack) {
      const cleanStack = payload.stack.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 1500);
      text += `\n💻 <b>Stack Trace:</b>\n<pre><code>${cleanStack}</code></pre>\n`;
    }

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
