import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendServerTelegramAlert } from '@/lib/server-telegram-alerts';

export const runtime = 'nodejs';

const MAX_TELEGRAM_FILE_BYTES = 20 * 1024 * 1024; // 20 MB (Telegram Bot API getFile download limit)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_MODULES = new Set([
  'expenses',
  'custodies',
  'company_documents',
  'receipt_vouchers',
  'payment_vouchers',
  'invoices',
  'violations',
  'purchase_orders',
  'supplier_invoices',
  'project_drawings',
  'site_visits',
  'general',
]);

function createRequestSupabaseClient(authHeader: string, companyId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('إعدادات Supabase الأساسية غير متوفرة في بيئة الخادم');
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: authHeader,
        'x-company-id': companyId,
      },
    },
  });
}

export async function POST(req: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

    if (!botToken || !chatId) {
      return NextResponse.json(
        {
          error:
            'خدمة ربط المرفقات بـ Telegram Bot API غير مفعّلة بعد. يرجى إضافة TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID في ملف .env.local ثم إعادة تشغيل الخادم.',
        },
        { status: 503 }
      );
    }

    const authHeader = req.headers.get('authorization')?.trim() || '';
    const companyId = req.headers.get('x-company-id')?.trim() || '';

    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'يلزم تسجيل الدخول لرفع المرفقات' }, { status: 401 });
    }
    if (!UUID_RE.test(companyId)) {
      return NextResponse.json({ error: 'معرّف الشركة النشطة مفقود أو غير صالح' }, { status: 400 });
    }

    const sb = createRequestSupabaseClient(authHeader, companyId);
    const {
      data: { user },
      error: authError,
    } = await sb.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول' }, { status: 401 });
    }

    const formData = await req.formData();
    const fileEntry = formData.get('file');
    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: 'لم يتم إرفاق ملف صالح للرفع' }, { status: 400 });
    }

    if (fileEntry.size <= 0) {
      return NextResponse.json({ error: 'الملف المرفق فارغ' }, { status: 400 });
    }
    if (fileEntry.size > MAX_TELEGRAM_FILE_BYTES) {
      return NextResponse.json(
        { error: 'حجم الملف يتجاوز الحد الأقصى المسموح لـ Telegram Bot API (20 ميجابايت)' },
        { status: 413 }
      );
    }

    const rawModule = String(formData.get('module') || 'general').trim();
    const targetModule = ALLOWED_MODULES.has(rawModule) ? rawModule : 'general';
    const rawClientReqId = String(formData.get('client_request_id') || '').trim();
    const clientRequestId = UUID_RE.test(rawClientReqId) ? rawClientReqId : null;
    const captionNote = String(formData.get('caption') || '').trim();

    // 1. Idempotency pre-check: avoid uploading the same offline attachment twice to Telegram
    if (clientRequestId) {
      const { data: existing } = await sb
        .from('company_attachments')
        .select('id, file_name, mime_type, file_size')
        .eq('company_id', companyId)
        .eq('client_request_id', clientRequestId)
        .maybeSingle();

      if (existing?.id) {
        return NextResponse.json({
          success: true,
          id: existing.id,
          url: `/api/attachments/${existing.id}`,
          file_name: existing.file_name,
          mime_type: existing.mime_type,
          file_size: existing.file_size,
          replayed: true,
        });
      }
    }

    // 2. Upload file to Telegram Bot API via sendDocument (preserves full quality for images & PDFs)
    const tgForm = new FormData();
    tgForm.append('chat_id', chatId);
    tgForm.append('document', fileEntry, fileEntry.name || 'attachment');
    const fullCaption = [
      `📎 مرفق فاي تك`,
      `القسم: ${targetModule}`,
      `الملف: ${fileEntry.name || 'attachment'}`,
      captionNote ? `البيان: ${captionNote}` : '',
    ]
      .filter(Boolean)
      .join(' | ')
      .slice(0, 950);
    tgForm.append('caption', fullCaption);

    const tgResp = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: tgForm,
    });

    const tgJson = await tgResp.json().catch(() => null);
    if (!tgResp.ok || !tgJson?.ok || !tgJson?.result) {
      const tgDesc = tgJson?.description || `HTTP ${tgResp.status}`;
      return NextResponse.json(
        { error: `تعذر رفع المرفق إلى تيليجرام: ${tgDesc}` },
        { status: 502 }
      );
    }

    const msg = tgJson.result;
    const docObj =
      msg.document ||
      (Array.isArray(msg.photo) && msg.photo.length > 0 ? msg.photo[msg.photo.length - 1] : null) ||
      msg.video ||
      msg.audio;

    if (!docObj?.file_id) {
      return NextResponse.json(
        { error: 'لم يُرجع تيليجرام معرّف ملف صالح (file_id)' },
        { status: 502 }
      );
    }

    // 3. Register attachment metadata in company_attachments via idempotent SECURITY DEFINER RPC
    const { data: regResult, error: regError } = await sb.rpc('register_company_attachment', {
      p_data: {
        company_id: companyId,
        client_request_id: clientRequestId,
        module: targetModule,
        file_name: fileEntry.name || 'attachment',
        mime_type: fileEntry.type || docObj.mime_type || 'application/octet-stream',
        file_size: fileEntry.size,
        telegram_file_id: docObj.file_id,
        telegram_unique_id: docObj.file_unique_id || null,
        telegram_message_id: msg.message_id || null,
        telegram_chat_id: String(msg.chat?.id ?? chatId),
        caption: captionNote || null,
      },
    });

    if (regError || !regResult?.id) {
      return NextResponse.json(
        { error: regError?.message || 'فشل تسجيل بيانات المرفق في قاعدة البيانات' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      id: regResult.id,
      url: `/api/attachments/${regResult.id}`,
      file_name: fileEntry.name || 'attachment',
      mime_type: fileEntry.type || 'application/octet-stream',
      file_size: fileEntry.size,
      replayed: Boolean(regResult._sync_replayed),
    });
  } catch (err: any) {
    void sendServerTelegramAlert({
      level: 'error',
      category: 'api_failure',
      route: '/api/attachments [POST]',
      message: err?.message || 'Unexpected attachment error',
      stack: err?.stack,
    });
    return NextResponse.json(
      { error: err?.message || 'حدث خطأ غير متوقع أثناء رفع المرفق' },
      { status: 500 }
    );
  }
}
