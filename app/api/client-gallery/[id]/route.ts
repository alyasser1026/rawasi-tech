import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * صورة من معرض الزيارات المعتمد للعميل.
 * التحقق (أن الصورة معتمدة وتخص مشروعًا للعميل المسجّل) يتم داخل الدالة
 * public.client_gallery_photo_ref، وجلب الملف من تليجرام يتم هنا على الخادم فقط
 * فلا يصل توكن البوت للمتصفح.
 */
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!botToken) return NextResponse.json({ error: 'خدمة الصور غير مهيأة' }, { status: 503 });

    const { id } = await context.params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'معرّف غير صالح' }, { status: 400 });

    const authHeader = req.headers.get('authorization')?.trim() || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return NextResponse.json({ error: 'إعدادات الخادم غير مكتملة' }, { status: 500 });

    const sb = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: rows, error } = await sb.rpc('client_gallery_photo_ref', { p_photo_id: id });
    if (error) {
      const status = error.code === '28000' ? 401 : error.code === '42501' ? 403 : 500;
      return NextResponse.json({ error: 'تعذر التحقق من الصلاحية' }, { status });
    }
    const att = Array.isArray(rows) ? rows[0] : null;
    if (!att?.telegram_file_id) return NextResponse.json({ error: 'الصورة غير متاحة' }, { status: 404 });

    // لا نعرض إلا الصور (لا PDF ولا فيديو) في معرض العميل
    if (att.mime_type && !String(att.mime_type).toLowerCase().startsWith('image/')) {
      return NextResponse.json({ error: 'نوع الملف غير مدعوم في المعرض' }, { status: 415 });
    }

    const infoResp = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(att.telegram_file_id)}`,
      { cache: 'no-store' }
    );
    const info = await infoResp.json().catch(() => null);
    const filePath: string | undefined = info?.result?.file_path;
    if (!infoResp.ok || !info?.ok || !filePath) return NextResponse.json({ error: 'تعذر جلب الصورة' }, { status: 502 });

    const fileResp = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`, { cache: 'no-store' });
    if (!fileResp.ok || !fileResp.body) return NextResponse.json({ error: 'تعذر تحميل الصورة' }, { status: 502 });

    return new Response(fileResp.body, {
      status: 200,
      headers: {
        'Content-Type': att.mime_type || 'image/jpeg',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'حدث خطأ غير متوقع' }, { status: 500 });
  }
}
