/**
 * lib/store-order-telegram.ts
 * إشعارات تليجرام الموحدة لطلبات المتجر العام، الصيانة، حجز العقارات، وتحويل كوبايلوت المتجر للمهندس.
 */

import { normalizePhoneForWhatsApp } from '@/lib/telegram-notifier';
import type { DeliveryLocation } from '@/app/site/delivery-location';

export interface StoreTelegramOrderItem {
  code?: string;
  name: string;
  qty: number;
  unit?: string;
  price: number;
  installPrice?: number;
  withInstall?: boolean;
}

export interface StoreTelegramOrderPayload {
  refCode: string;
  orderType: 'store_order' | 'property_inquiry' | 'maintenance_request';
  source?: 'store_copilot_ai' | 'website_store';
  browserSessionId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  city?: string;
  address?: string;
  deliveryLocation?: DeliveryLocation | null;
  notes?: string;
  withInstallation?: boolean;
  items?: StoreTelegramOrderItem[];
  property?: {
    code?: string;
    title: string;
    areaSqm?: number;
    price?: number;
    currency?: string;
  } | null;
  maintenanceService?: {
    code?: string;
    title: string;
    mode?: string;
    preferredDate?: string;
  } | null;
  totalAmount?: number;
  currency?: string;
}

function escapeHtml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCairoTimestamp(): string {
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date());
}

async function postTelegramHtmlMessage(
  text: string,
  buttons: Array<Array<{ text: string; url: string }>> = []
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return false;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(buttons.length > 0 ? { reply_markup: { inline_keyboard: buttons } } : {}),
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Telegram notification error:', err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * يرسل إشعار Telegram منسق بالطلب الجديد (توريد/تركيب/صيانة/عقار) مع زر تواصل واتساب مباشر.
 */
export async function sendStoreTelegramNotification(
  order: StoreTelegramOrderPayload
): Promise<boolean> {
  const waPhone = normalizePhoneForWhatsApp(order.customerPhone);
  const nowStr = formatCairoTimestamp();
  const lines: string[] = [];

  if (order.orderType === 'maintenance_request') {
    lines.push('🛠️ <b>طلب تنفيذ / صيانة هندسية جديد — فاي تك</b>');
  } else if (order.orderType === 'property_inquiry') {
    lines.push('🏢 <b>طلب حجز / معاينة عقار جديد — فاي تك</b>');
  } else {
    lines.push('🛒 <b>طلب سلة مشتريات جديد — متجر فاي تك</b>');
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  if (order.source === 'store_copilot_ai') {
    lines.push('🤖 <b>المصدر:</b> كوبايلوت المتجر الذكي');
  }
  lines.push(`🔖 <b>رقم الطلب:</b> <code>${escapeHtml(order.refCode)}</code>`);
  lines.push(`👤 <b>العميل:</b> ${escapeHtml(order.customerName)}`);
  lines.push(`📱 <b>رقم الجوال:</b> <code>${escapeHtml(order.customerPhone)}</code>`);
  if (order.customerEmail) lines.push(`📧 <b>البريد:</b> <code>${escapeHtml(order.customerEmail)}</code>`);
  if (order.city || order.address) {
    lines.push(`📍 <b>الموقع / العنوان:</b> ${escapeHtml([order.city, order.address].filter(Boolean).join(' — '))}`);
  }
  if (order.deliveryLocation?.mapUrl) {
    const accNote =
      typeof order.deliveryLocation.accuracyMeters === 'number'
        ? ` (±${order.deliveryLocation.accuracyMeters}م)`
        : '';
    lines.push(
      `🗺️ <b>الموقع الدقيق:</b> <a href="${escapeHtml(order.deliveryLocation.mapUrl)}">فتح على Google Maps</a> (<code>${order.deliveryLocation.lat}, ${order.deliveryLocation.lng}</code>${escapeHtml(accNote)})`
    );
  }
  if (order.browserSessionId) {
    lines.push(`🆔 <b>معرّف الجلسة:</b> <code>${escapeHtml(order.browserSessionId)}</code>`);
  }

  if (order.orderType === 'maintenance_request') {
    if (order.maintenanceService) {
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push(`🔧 <b>البند المطلوب:</b> <b>${escapeHtml(order.maintenanceService.title)}</b>`);
      if (order.maintenanceService.code) {
        lines.push(`🔢 <b>كود الخدمة:</b> <code>${escapeHtml(order.maintenanceService.code)}</code>`);
      }
      if (order.maintenanceService.mode) {
        lines.push(`⚙️ <b>نوع الطلب:</b> <b>${escapeHtml(order.maintenanceService.mode)}</b>`);
      }
      if (order.maintenanceService.preferredDate) {
        lines.push(`🗓️ <b>الموعد المفضل:</b> ${escapeHtml(order.maintenanceService.preferredDate)}`);
      }
    }
    if (order.notes) {
      lines.push(`📝 <b>وصف المشكلة / المطلوب:</b>\n<i>${escapeHtml(order.notes)}</i>`);
    }
  } else if (order.orderType === 'property_inquiry') {
    if (order.property) {
      lines.push('━━━━━━━━━━━━━━━━━━━━');
      lines.push(`🏠 <b>الوحدة العقارية:</b> <b>${escapeHtml(order.property.title)}</b>`);
      if (order.property.code) lines.push(`🔢 <b>كود الوحدة:</b> <code>${escapeHtml(order.property.code)}</code>`);
      if (order.property.areaSqm) lines.push(`📐 <b>المساحة:</b> ${escapeHtml(order.property.areaSqm)} م²`);
      if (order.property.price) {
        lines.push(
          `💰 <b>السعر المعروض:</b> ${Number(order.property.price).toLocaleString('en-US')} ${escapeHtml(order.property.currency || 'ج.م')}`
        );
      }
    }
    if (order.notes) {
      lines.push(`📝 <b>ملاحظات العميل:</b>\n<i>${escapeHtml(order.notes)}</i>`);
    }
  } else {
    lines.push(
      `🛠️ <b>خدمة التركيب:</b> ${order.withInstallation ? '✅ مطلوب توريد + تركيب بإشراف فاي تك' : '📦 توريد فقط'}`
    );
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('📦 <b>الأصناف المطلوبة في السلة:</b>');
    for (const [idx, item] of (order.items || []).entries()) {
      const unitTotal =
        (Number(item.price) + (item.withInstall && item.installPrice ? Number(item.installPrice) : 0)) *
        Number(item.qty || 1);
      const priceLabel =
        Number(item.price) > 0
          ? `${unitTotal.toLocaleString('en-US')} ${escapeHtml(order.currency || 'ج.م')}`
          : 'تسعير عند الطلب';
      lines.push(
        `${idx + 1}. <b>${escapeHtml(item.name)}</b>\n   • الكمية: <code>${item.qty}</code> ${escapeHtml(item.unit || '')}${item.withInstall ? ' (+تركيب)' : ''} — الإجمالي: <b>${priceLabel}</b>`
      );
    }
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    const grandTotalLabel =
      Number(order.totalAmount || 0) > 0
        ? `${Number(order.totalAmount || 0).toLocaleString('en-US')} ${escapeHtml(order.currency || 'ج.م')}`
        : 'طلب عرض سعر وتوريد';
    lines.push(`💰 <b>الإجمالي الكلي للطلب:</b> <b>${grandTotalLabel}</b>`);
    if (order.notes) {
      lines.push(`📝 <b>ملاحظات التوريد/التركيب:</b>\n<i>${escapeHtml(order.notes)}</i>`);
    }
  }

  lines.push(`⏰ <b>التوقيت:</b> ${escapeHtml(nowStr)}`);

  const buttons: Array<Array<{ text: string; url: string }>> = [];
  if (waPhone) {
    const waText = encodeURIComponent(
      `مرحباً أستاذ ${order.customerName}، معك قسم المبيعات والهندسة من شركة فاي تك بخصوص طلبكم رقم ${order.refCode}`
    );
    buttons.push([{ text: `💬 تواصل واتساب (${order.customerPhone})`, url: `https://wa.me/${waPhone}?text=${waText}` }]);
  }
  if (order.deliveryLocation?.mapUrl) {
    buttons.push([
      {
        text: '📍 فتح موقع العميل على الخريطة',
        url: order.deliveryLocation.mapUrl,
      },
    ]);
  }

  return await postTelegramHtmlMessage(lines.join('\n'), buttons);
}

/**
 * يرسل تنبيه تحويل عاجل للمهندس المختص عند تصعيد المحادثة من كوبايلوت المتجر.
 */
export async function sendCopilotEscalationTelegram(params: {
  sessionId: string;
  customerName: string;
  customerPhone: string;
  reason: string;
  summary: string;
  pageUrl?: string;
}): Promise<boolean> {
  const waPhone = normalizePhoneForWhatsApp(params.customerPhone);
  const nowStr = formatCairoTimestamp();
  const lines = [
    '🚨 <b>طلب تدخل مهندس فوري — كوبايلوت المتجر</b>',
    '━━━━━━━━━━━━━━━━━━━━',
    `🔖 <b>الجلسة:</b> <code>${escapeHtml(params.sessionId)}</code>`,
    `👤 <b>العميل:</b> ${escapeHtml(params.customerName || 'عميل المتجر')}`,
    `📱 <b>الجوال:</b> <code>${escapeHtml(params.customerPhone || 'غير مسجل بعد')}</code>`,
    ...(params.pageUrl ? [`🔗 <b>الصفحة:</b> <code>${escapeHtml(params.pageUrl)}</code>`] : []),
    `⚠️ <b>سبب التحويل:</b> ${escapeHtml(params.reason)}`,
    `📝 <b>ملخص المطلوب:</b>\n<i>${escapeHtml(params.summary)}</i>`,
    `⏰ <b>التوقيت:</b> ${escapeHtml(nowStr)}`,
  ];

  const buttons: Array<Array<{ text: string; url: string }>> = [];
  if (waPhone) {
    const waText = encodeURIComponent(
      `مرحباً أستاذ ${params.customerName || ''}، معك المهندس المختص من شركة فاي تك بخصوص استفسارك عبر المتجر الذكي.`
    );
    buttons.push([
      { text: `💬 رد واتساب مباشر (${params.customerPhone})`, url: `https://wa.me/${waPhone}?text=${waText}` },
    ]);
  }

  return await postTelegramHtmlMessage(lines.join('\n'), buttons);
}

/**
 * يرسل تنبيه أمان فوري للإدارة عند حظر محاولة مريبة أو استلام مقترح عالي الخطورة من الإيجنت الخارجي.
 */
export async function sendTrainerSecurityAlertTelegram(params: {
  agentName: string;
  proposalType: string;
  title: string;
  blocked: boolean;
  riskLevel: 'safe' | 'warning' | 'critical';
  flags: Array<{ title: string; field: string; excerpt: string }>;
}): Promise<boolean> {
  const nowStr = formatCairoTimestamp();
  const header = params.blocked
    ? '🚨 <b>محاولة محظورة من الإيجنت الخارجي — تدريب الكوبايلوت</b>'
    : '⚠️ <b>مقترح عالي الخطورة بانتظار المراجعة — إيجنت التدريب</b>';

  const lines = [
    header,
    '━━━━━━━━━━━━━━━━━━━━',
    `🤖 <b>الإيجنت:</b> <code>${escapeHtml(params.agentName || 'external-trainer')}</code>`,
    `📂 <b>النوع:</b> <code>${escapeHtml(params.proposalType)}</code> | <b>الخطورة:</b> <code>${escapeHtml(params.riskLevel)}</code>`,
    `📌 <b>العنوان:</b> ${escapeHtml(params.title || 'بدون عنوان')}`,
    `⏰ <b>التوقيت:</b> ${escapeHtml(nowStr)}`,
  ];

  const topFlags = Array.isArray(params.flags) ? params.flags.slice(0, 5) : [];
  if (topFlags.length > 0) {
    lines.push('<b>🔍 تفاصيل الإنذارات المرصودة:</b>');
    for (const flag of topFlags) {
      lines.push(
        `• <b>${escapeHtml(flag.title)}</b> (${escapeHtml(flag.field)})\n  <code>${escapeHtml(String(flag.excerpt || '').slice(0, 100))}</code>`
      );
    }
  }

  lines.push('🛡️ <i>راجع تبويب «مقترحات الإيجنت والأمان» في /website-admin — لن يُنفَّذ أي شيء تلقائياً.</i>');
  return await postTelegramHtmlMessage(lines.join('\n'));
}
