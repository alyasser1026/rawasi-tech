import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhoneForWhatsApp } from '@/lib/telegram-notifier';

export const runtime = 'nodejs';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function escapeHtml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function verifyAdminAuth(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;
  try {
    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await client.auth.getUser();
    if (!userRes?.user?.id) return false;
    const sb = getServiceSupabase();
    if (!sb) return false;
    const { data: prof } = await sb
      .from('profiles')
      .select('role, is_admin, is_active')
      .eq('id', userRes.user.id)
      .maybeSingle();
    if (!prof || prof.is_active === false) return false;
    return Boolean(prof.is_admin || prof.role === 'admin' || prof.role === 'super_admin');
  } catch {
    return false;
  }
}

async function sendStoreTelegramNotification(order: {
  refCode: string;
  orderType: 'store_order' | 'property_inquiry' | 'maintenance_request';
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  city?: string;
  address?: string;
  notes?: string;
  withInstallation?: boolean;
  items?: Array<{
    code?: string;
    name: string;
    qty: number;
    unit?: string;
    price: number;
    installPrice?: number;
    withInstall?: boolean;
  }>;
  property?: {
    code?: string;
    title: string;
    areaSqm?: number;
    price?: number;
    currency?: string;
  };
  maintenanceService?: {
    code?: string;
    title: string;
    mode?: string;
    preferredDate?: string;
  };
  totalAmount?: number;
  currency?: string;
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return;

  const waPhone = normalizePhoneForWhatsApp(order.customerPhone);
  const nowStr = new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date());

  const lines: string[] = [];
  if (order.orderType === 'maintenance_request') {
    lines.push('🛠️ <b>طلب تنفيذ / صيانة هندسية جديد — فاي تك</b>');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push(`🔖 <b>رقم الطلب:</b> <code>${escapeHtml(order.refCode)}</code>`);
    lines.push(`👤 <b>العميل:</b> ${escapeHtml(order.customerName)}`);
    lines.push(`📱 <b>رقم الجوال:</b> <code>${escapeHtml(order.customerPhone)}</code>`);
    if (order.customerEmail) lines.push(`📧 <b>البريد:</b> <code>${escapeHtml(order.customerEmail)}</code>`);
    if (order.city || order.address) {
      lines.push(`📍 <b>الموقع:</b> ${escapeHtml([order.city, order.address].filter(Boolean).join(' — '))}`);
    }
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
    lines.push('🏢 <b>طلب حجز / معاينة عقار جديد — فاي تك</b>');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push(`🔖 <b>رقم الطلب:</b> <code>${escapeHtml(order.refCode)}</code>`);
    lines.push(`👤 <b>العميل:</b> ${escapeHtml(order.customerName)}`);
    lines.push(`📱 <b>رقم الجوال:</b> <code>${escapeHtml(order.customerPhone)}</code>`);
    if (order.customerEmail) lines.push(`📧 <b>البريد:</b> <code>${escapeHtml(order.customerEmail)}</code>`);
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
    lines.push('🛒 <b>طلب سلة مشتريات جديد — متجر فاي تك</b>');
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push(`🔖 <b>رقم الطلب:</b> <code>${escapeHtml(order.refCode)}</code>`);
    lines.push(`👤 <b>العميل:</b> ${escapeHtml(order.customerName)}`);
    lines.push(`📱 <b>رقم الجوال:</b> <code>${escapeHtml(order.customerPhone)}</code>`);
    if (order.customerEmail) lines.push(`📧 <b>البريد:</b> <code>${escapeHtml(order.customerEmail)}</code>`);
    if (order.city || order.address) {
      lines.push(`📍 <b>العنوان / المدينة:</b> ${escapeHtml([order.city, order.address].filter(Boolean).join(' — '))}`);
    }
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
    lines.push(
      `💰 <b>الإجمالي الكلي للطلب:</b> <b>${grandTotalLabel}</b>`
    );
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

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(buttons.length > 0 ? { reply_markup: { inline_keyboard: buttons } } : {}),
      }),
    });
  } catch (err) {
    console.warn('Telegram store order notification error:', err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderType: 'store_order' | 'property_inquiry' | 'maintenance_request' =
      body.orderType === 'property_inquiry'
        ? 'property_inquiry'
        : body.orderType === 'maintenance_request'
          ? 'maintenance_request'
          : 'store_order';
    const customerName = String(body.customerName || '').trim();
    const customerPhone = String(body.customerPhone || '').trim();
    const customerEmail = String(body.customerEmail || '').trim();
    const userId = typeof body.userId === 'string' && body.userId.length > 10 ? body.userId : null;

    if (!customerName || customerPhone.replace(/\D/g, '').length < 8) {
      return NextResponse.json(
        { error: 'يرجى إدخال الاسم الكامل ورقم الجوال بشكل صحيح لإتمام الطلب' },
        { status: 400 }
      );
    }

    const prefix =
      orderType === 'property_inquiry'
        ? 'PRP'
        : orderType === 'maintenance_request'
          ? 'MNT'
          : 'ORD';
    const refCode = `${prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const payloadDetails = {
      refCode,
      orderType,
      customerName,
      customerPhone,
      customerEmail,
      city: String(body.city || '').trim(),
      address: String(body.address || '').trim(),
      notes: String(body.notes || '').trim(),
      withInstallation: Boolean(body.withInstallation),
      items: Array.isArray(body.items) ? body.items : [],
      property: body.property || null,
      maintenanceService: body.maintenanceService || null,
      totalAmount: Number(body.totalAmount || 0),
      currency: body.currency === 'ر.س' ? 'ر.س' : 'ج.م',
      createdAt: new Date().toISOString(),
    };

    const sb = getServiceSupabase();
    let savedId = refCode;
    if (sb) {
      const { data, error } = await sb
        .from('user_requests')
        .insert({
          user_id: userId,
          type: orderType,
          category: refCode,
          subject: `${customerName} — ${customerPhone}`,
          details: JSON.stringify(payloadDetails),
          status: 'جديد',
        })
        .select('id')
        .maybeSingle();
      if (!error && data?.id) {
        savedId = data.id;
      }
    }

    await sendStoreTelegramNotification(payloadDetails);

    return NextResponse.json({
      ok: true,
      id: savedId,
      refCode,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'حدث خطأ أثناء حفظ الطلب' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const isAdmin = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const sb = getServiceSupabase();
    if (!sb) {
      return NextResponse.json({ orders: [] });
    }

    const { data, error } = await sb
      .from('user_requests')
      .select('id, user_id, type, category, subject, details, status, admin_note, created_at')
      .in('type', ['store_order', 'property_inquiry', 'maintenance_request'])
      .order('created_at', { ascending: false })
      .limit(150);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const orders = (data || []).map((row) => {
      let parsed: any = {};
      try {
        parsed = row.details ? JSON.parse(row.details) : {};
      } catch {
        parsed = {};
      }
      return {
        id: row.id,
        userId: row.user_id,
        type: row.type,
        refCode: row.category || parsed.refCode || row.id.slice(0, 8),
        subject: row.subject,
        status: row.status || 'جديد',
        adminNote: row.admin_note || '',
        createdAt: row.created_at,
        ...parsed,
      };
    });

    return NextResponse.json({ orders });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'خطأ في جلب الطلبات' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const isAdmin = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const body = await req.json();
    const { id, status, adminNote } = body;
    if (!id) {
      return NextResponse.json({ error: 'معرّف الطلب مطلوب' }, { status: 400 });
    }

    const sb = getServiceSupabase();
    if (!sb) {
      return NextResponse.json({ error: 'قاعدة البيانات غير متاحة' }, { status: 500 });
    }

    const updatePayload: Record<string, any> = {};
    if (typeof status === 'string') updatePayload.status = status;
    if (typeof adminNote === 'string') updatePayload.admin_note = adminNote;

    const { error } = await sb.from('user_requests').update(updatePayload).eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'خطأ في تحديث الطلب' }, { status: 500 });
  }
}
