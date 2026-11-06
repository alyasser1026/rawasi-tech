import { NextResponse } from 'next/server';
import { formatTelegramErrorDetails, telegramHtml } from '@/lib/telegram-error-guidance';

export const runtime = 'nodejs';

// In-memory rate limiting & deduplication cache (60 seconds per error signature)
const recentAlertsCache = new Map<string, number>();
const DEDUPLICATION_WINDOW_MS = 60 * 1000; // 1 minute

function cleanRecentCache() {
  const now = Date.now();
  for (const [key, timestamp] of recentAlertsCache.entries()) {
    if (now - timestamp > DEDUPLICATION_WINDOW_MS) {
      recentAlertsCache.delete(key);
    }
  }
}

export interface TechnicalAlertPayload {
  level?: 'fatal' | 'error' | 'warning' | 'info';
  category?: 'react_crash' | 'uncaught_exception' | 'unhandled_rejection' | 'api_failure' | 'database_error' | 'business_exception';
  message: string;
  code?: string;
  status?: number;
  stack?: string;
  componentStack?: string;
  url?: string;
  source?: string;
  userAgent?: string;
  companyId?: string;
  companyName?: string;
  userId?: string;
  userEmail?: string;
  metadata?: Record<string, any>;
}

export async function POST(req: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

    if (!botToken || !chatId) {
      return NextResponse.json(
        { ok: false, error: 'Telegram Bot credentials not configured in environment variables' },
        { status: 503 }
      );
    }

    let payload: TechnicalAlertPayload;
    try {
      const rawText = await req.text();
      if (!rawText || !rawText.trim()) {
        return NextResponse.json({ ok: false, error: 'Empty request body' }, { status: 400 });
      }
      payload = JSON.parse(rawText) as TechnicalAlertPayload;
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    if (typeof payload?.message !== 'string' || !payload.message.trim()) {
      return NextResponse.json({ ok: false, error: 'Missing error message' }, { status: 400 });
    }

    cleanRecentCache();

    // Deduplication key based on message, url and category
    const dedupeKey = `${payload.category || 'error'}|${payload.url || ''}|${payload.message.trim().slice(0, 150)}`;
    const now = Date.now();
    const lastSent = recentAlertsCache.get(dedupeKey);

    if (lastSent && now - lastSent < DEDUPLICATION_WINDOW_MS) {
      return NextResponse.json({
        ok: true,
        throttled: true,
        message: 'Alert throttled (identical error already dispatched within last 60s)',
      });
    }

    recentAlertsCache.set(dedupeKey, now);

    // Format Alert Header
    const levelIcons: Record<string, string> = {
      fatal: '🔥 [حرج جداً - CRITICAL]',
      error: '🚨 [خطأ تقني - ERROR]',
      warning: '⚠️ [تحذير تقني - WARNING]',
      info: 'ℹ️ [معلومات - INFO]',
    };

    const categoryLabels: Record<string, string> = {
      react_crash: '💥 كراش واجهة المستخدم (React Crash)',
      uncaught_exception: '⚡ خطأ غير معالج (Uncaught Exception)',
      unhandled_rejection: '🛑 وعد مرفوض غير معالج (Unhandled Promise Rejection)',
      api_failure: '🌐 فشل خادم الـ API (API Route Failure)',
      database_error: '🗄️ استثناء قاعدة بيانات (Database / RPC Error)',
      business_exception: '⚠️ تنبيه فشل عملية (Runtime Operation Error)',
    };

    const header = levelIcons[payload.level || 'error'] || '🚨 [خطأ تقني - ERROR]';
    const catLabel = categoryLabels[payload.category || 'business_exception'] || 'خطأ تقني عام';
    const dateStr = new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' });

    let text = `<b>${header}</b>\n`;
    text += `<b>نظام إدارة المشروعات والمحاسبة — فاي تك</b>\n\n`;
    text += `🏷️ <b>التصنيف:</b> ${telegramHtml(catLabel)}\n`;
    text += `🕒 <b>التاريخ والوقت:</b> <code>${telegramHtml(dateStr)}</code>\n`;

    if (payload.url) {
      text += `📍 <b>الصفحة / المسار:</b> <code>${telegramHtml(payload.url)}</code>\n`;
    }

    if (payload.companyName || payload.companyId) {
      text += `🏢 <b>الشركة النشطة:</b> ${telegramHtml(payload.companyName || 'غير محددة')} <code>(${telegramHtml(payload.companyId || '')})</code>\n`;
    }

    if (payload.userEmail || payload.userId) {
      text += `👤 <b>المستخدم:</b> ${telegramHtml(payload.userEmail || '')} <code>(${telegramHtml(payload.userId || '')})</code>\n`;
    }

    if (payload.source) {
      text += `📁 <b>مصدر الملف:</b> <code>${telegramHtml(payload.source)}</code>\n`;
    }

    text = formatTelegramErrorDetails(text, payload);

    // Send to Telegram Bot API
    const telegramEndpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const tgRes = await fetch(telegramEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const tgJson = await tgRes.json();

    if (!tgRes.ok || !tgJson.ok) {
      console.error('Failed to dispatch alert to Telegram:', tgJson);
      return NextResponse.json(
        { ok: false, error: tgJson?.description || 'Telegram API error' },
        { status: tgRes.status || 500 }
      );
    }

    return NextResponse.json({ ok: true, messageId: tgJson?.result?.message_id });
  } catch (err: any) {
    console.error('Fatal in telegram-alerts route:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Internal server error' }, { status: 500 });
  }
}

// Health check / Manual test
export async function GET() {
  const hasToken = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const hasChat = Boolean(process.env.TELEGRAM_CHAT_ID);

  return NextResponse.json({
    status: 'online',
    service: 'telegram_technical_alerts',
    configured: hasToken && hasChat,
  });
}
