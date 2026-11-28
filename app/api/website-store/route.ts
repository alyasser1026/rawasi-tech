import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sanitizeDeliveryLocation } from '@/app/site/delivery-location';
import { sendStoreTelegramNotification } from '@/lib/store-order-telegram';
import { checkIpRateLimit } from '@/lib/api-rate-limit';
import { resolveOptionalRequestUserId } from '@/lib/admin-authorization';

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

export async function POST(req: Request) {
  try {
    const rate = checkIpRateLimit(req, 'website-store-order', 15, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'تم استلام عدة طلبات متتالية؛ يرجى الانتظار دقيقة قبل إرسال طلب جديد.' },
        { status: 429 }
      );
    }

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
    const sb = getServiceSupabase();
    const userId = await resolveOptionalRequestUserId(sb, req, body.userId);

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

    const deliveryLocation = sanitizeDeliveryLocation(body.deliveryLocation);
    const browserSessionId =
      typeof body.browserSessionId === 'string' ? body.browserSessionId.trim().slice(0, 64) : '';

    const payloadDetails = {
      refCode,
      orderType,
      source: 'website_store' as const,
      ...(browserSessionId ? { browserSessionId } : {}),
      customerName,
      customerPhone,
      customerEmail,
      city: String(body.city || '').trim(),
      address: String(body.address || '').trim(),
      ...(deliveryLocation ? { deliveryLocation } : {}),
      notes: String(body.notes || '').trim(),
      withInstallation: Boolean(body.withInstallation),
      items: Array.isArray(body.items) ? body.items.slice(0, 100) : [],
      property: body.property || null,
      maintenanceService: body.maintenanceService || null,
      totalAmount: Number(body.totalAmount || 0),
      currency: body.currency === 'ر.س' ? 'ر.س' : 'ج.م',
      createdAt: new Date().toISOString(),
    };

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
