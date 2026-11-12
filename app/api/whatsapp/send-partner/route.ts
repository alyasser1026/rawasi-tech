import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppTextMessage } from '@/lib/whatsapp';
import {
  PartnerCountryCode,
  buildWhatsAppWebUrl,
  normalizePartnerPhone,
  resolvePartnerFromList,
} from '@/lib/partnerWhatsApp';

export const runtime = 'nodejs';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { ok: false, error: 'إعدادات الخادم لقاعدة البيانات غير مكتملة' },
        { status: 500 },
      );
    }

    const token = extractBearerToken(req);
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'يلزم تسجيل الدخول لإرسال الإشعار' },
        { status: 401 },
      );
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json(
        { ok: false, error: 'انتهت جلسة الدخول؛ أعد تسجيل الدخول وحاول مرة أخرى' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const companyId = typeof body?.companyId === 'string' ? body.companyId.trim() : '';
    const partnerId = typeof body?.partnerId === 'string' ? body.partnerId.trim() : '';
    const partnerName = typeof body?.partnerName === 'string' ? body.partnerName.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const defaultCountry: PartnerCountryCode = body?.defaultCountry === 'SA' ? 'SA' : 'EG';

    if (!companyId) {
      return NextResponse.json({ ok: false, error: 'لم يتم تحديد الشركة الحالية' }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ ok: false, error: 'نص الرسالة فارغ' }, { status: 400 });
    }

    // Verify caller membership in the requested company
    const { data: membership } = await supabaseAdmin
      .from('user_companies')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!membership) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('company_id, is_active')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (!profile || profile.is_active === false || String(profile.company_id) !== companyId) {
        return NextResponse.json(
          { ok: false, error: 'ليست لديك صلاحية الوصول لهذه الشركة' },
          { status: 403 },
        );
      }
    }

    // Look up partner phone strictly from partners table inside the active company
    let resolvedPhone: string | null = null;
    let resolvedPartnerName = partnerName || 'الشريك';

    if (partnerId) {
      const { data: partnerRow } = await supabaseAdmin
        .from('partners')
        .select('id, name, phone')
        .eq('company_id', companyId)
        .eq('id', partnerId)
        .maybeSingle();
      if (partnerRow) {
        resolvedPartnerName = partnerRow.name || resolvedPartnerName;
        resolvedPhone = partnerRow.phone || null;
      }
    }

    if (!resolvedPhone && partnerName) {
      const { data: companyPartners } = await supabaseAdmin
        .from('partners')
        .select('id, name, phone')
        .eq('company_id', companyId)
        .limit(500);
      const matched = resolvePartnerFromList(companyPartners, { partnerId, partnerName });
      resolvedPhone = matched.phone;
      resolvedPartnerName = matched.partnerName;
    }

    const normalizedPhone = normalizePartnerPhone(resolvedPhone, defaultCountry);
    if (!normalizedPhone) {
      return NextResponse.json(
        {
          ok: false,
          code: 'NO_PHONE',
          partnerName: resolvedPartnerName,
          error: `لا يوجد رقم هاتف صالح مسجل في ملف (${resolvedPartnerName}) بصفحة الشركاء.`,
        },
        { status: 422 },
      );
    }

    const fallbackUrl = buildWhatsAppWebUrl(normalizedPhone, message, defaultCountry);
    const sendResult = await sendWhatsAppTextMessage(normalizedPhone, message);

    if (sendResult.ok) {
      return NextResponse.json({
        ok: true,
        mode: 'cloud_api',
        phone: normalizedPhone,
        partnerName: resolvedPartnerName,
        messageId: sendResult.data?.messages?.[0]?.id || null,
        fallbackUrl,
      });
    }

    return NextResponse.json({
      ok: false,
      mode: 'fallback_web',
      phone: normalizedPhone,
      partnerName: resolvedPartnerName,
      error: sendResult.error || 'تعذر الإرسال الآلي عبر WhatsApp API',
      fallbackUrl,
    });
  } catch (err: any) {
    console.error('send-partner WhatsApp route error:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'حدث خطأ غير متوقع أثناء الإرسال' },
      { status: 500 },
    );
  }
}
