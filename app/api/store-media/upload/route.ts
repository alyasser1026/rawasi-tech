import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { registerStoreMediaEntry } from '@/lib/store-catalog-server';

export const runtime = 'nodejs';

const MAX_SPIN_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
    const sbUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    const sbAnon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

    if (!botToken || !chatId || !sbUrl || !sbAnon) {
      return NextResponse.json(
        { error: 'خدمة رفع صور المتجر على تيليجرام غير مهيأة حالياً' },
        { status: 503 }
      );
    }

    const authHeader = req.headers.get('authorization')?.trim() || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'يلزم تسجيل الدخول كمدير لرفع الصور' }, { status: 401 });
    }

    const sb = createClient(sbUrl, sbAnon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'انتهت صلاحية الجلسة، يرجى إعادة الدخول' }, { status: 401 });
    }

    const { error: adminErr } = await sb.rpc('website_admin_state');
    if (adminErr) {
      return NextResponse.json({ error: 'هذا الإجراء متاح لمديري الموقع فقط' }, { status: 403 });
    }

    const formData = await req.formData();
    const fileEntry = formData.get('file');
    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: 'يرجى إرفاق ملف صورة صالح' }, { status: 400 });
    }
    if (fileEntry.size <= 0 || fileEntry.size > MAX_SPIN_IMAGE_BYTES) {
      return NextResponse.json({ error: 'حجم الصورة يجب أن يكون بين 1 بايت و 10 ميجابايت' }, { status: 413 });
    }
    if (fileEntry.type && !fileEntry.type.startsWith('image/')) {
      return NextResponse.json({ error: 'يُسمح برفع ملفات الصور فقط' }, { status: 400 });
    }

    const productId = String(formData.get('productId') || '').trim().slice(0, 64);
    const captionNote = String(formData.get('caption') || '').trim().slice(0, 140);
    const buf = Buffer.from(await fileEntry.arrayBuffer());
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const mediaId = `spin_${sha256.slice(0, 16)}`;

    const safeFileName = (fileEntry.name || `${mediaId}.webp`)
      .replace(/[^\w.\-\u0600-\u06FF]/g, '_')
      .slice(0, 80);

    const tgForm = new FormData();
    tgForm.append('chat_id', chatId);
    tgForm.append('caption', captionNote || `4D Spin · ${productId || 'product'}`);
    tgForm.append(
      'document',
      new Blob([buf], { type: fileEntry.type || 'image/webp' }),
      safeFileName
    );

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: tgForm,
    });
    const tgJson = await tgRes.json().catch(() => null);
    const telegramFileId: string | undefined = tgJson?.result?.document?.file_id;
    if (!tgRes.ok || !tgJson?.ok || !telegramFileId) {
      return NextResponse.json(
        { error: tgJson?.description || 'تعذر رفع الصورة إلى خادم تيليجرام' },
        { status: 502 }
      );
    }

    const reg = await registerStoreMediaEntry({
      id: mediaId,
      productId: productId || undefined,
      fileName: safeFileName,
      mimeType: fileEntry.type || 'image/webp',
      fileSize: buf.length,
      sha256,
      kind: 'image',
      telegramFileId,
    });
    if (!reg.ok) {
      return NextResponse.json(
        { error: 'تعذر تسجيل الصورة في فهرس المتجر السحابي' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: mediaId,
      url: `/api/store-media/${mediaId}`,
    });
  } catch {
    return NextResponse.json({ error: 'حدث خطأ غير متوقع أثناء رفع الصورة' }, { status: 500 });
  }
}
