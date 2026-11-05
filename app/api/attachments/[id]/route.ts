import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!botToken) {
      return NextResponse.json(
        { error: 'متغير البيئة TELEGRAM_BOT_TOKEN غير مضبوط على الخادم' },
        { status: 503 }
      );
    }

    const { id } = await context.params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'معرّف المرفق غير صالح' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization')?.trim() || '';
    const companyId = req.headers.get('x-company-id')?.trim() || '';

    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'يلزم تسجيل الدخول لعرض المرفق' }, { status: 401 });
    }
    if (!UUID_RE.test(companyId)) {
      return NextResponse.json({ error: 'معرّف الشركة النشطة مفقود أو غير صالح' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'إعدادات Supabase غير متوفرة' }, { status: 500 });
    }

    const sb = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: authHeader,
          'x-company-id': companyId,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await sb.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'انتهت صلاحية الجلسة' }, { status: 401 });
    }

    // RLS strictly enforces company_id = current_company_id() and module view permissions
    const { data: attachment, error: dbErr } = await sb
      .from('company_attachments')
      .select('id, company_id, file_name, mime_type, telegram_file_id')
      .eq('id', id)
      .maybeSingle();

    if (dbErr || !attachment) {
      return NextResponse.json(
        { error: 'المرفق غير موجود أو لا تملك صلاحية عرضه في الشركة الحالية' },
        { status: 404 }
      );
    }

    // Resolve fresh Telegram file_path from permanent telegram_file_id
    const infoResp = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(attachment.telegram_file_id)}`,
      { cache: 'no-store' }
    );
    const infoJson = await infoResp.json().catch(() => null);
    const filePath: string | undefined = infoJson?.result?.file_path;

    if (!infoResp.ok || !infoJson?.ok || !filePath) {
      return NextResponse.json(
        { error: 'تعذر جلب مسار الملف من تيليجرام' },
        { status: 502 }
      );
    }

    const fileResp = await fetch(
      `https://api.telegram.org/file/bot${botToken}/${filePath}`,
      { cache: 'no-store' }
    );

    if (!fileResp.ok || !fileResp.body) {
      return NextResponse.json(
        { error: 'تعذر تحميل محتوى المرفق من خوادم تيليجرام' },
        { status: 502 }
      );
    }

    const safeName = encodeURIComponent(attachment.file_name || 'attachment');
    return new Response(fileResp.body, {
      status: 200,
      headers: {
        'Content-Type': attachment.mime_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename*=UTF-8''${safeName}`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'حدث خطأ غير متوقع أثناء عرض المرفق' },
      { status: 500 }
    );
  }
}
