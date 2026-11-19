import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import puppeteer, { type Browser } from 'puppeteer';
import { buildContentDispositionAttachment, buildDocumentFileName } from '@/lib/documentFileName';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 2_000_000;
const MAX_CONCURRENT_RENDERS = 2;
const RENDER_TIMEOUT_MS = 15_000;
const PDF_CSP = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'\">";
let activeRenders = 0;

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function authorizeStatementExport(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return errorResponse('يلزم تسجيل الدخول لتصدير كشوف الحساب.', 401);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey) return errorResponse('خدمة التصدير غير متاحة الآن.', 503);

  const client = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer ' + token } },
  });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return errorResponse('جلسة الدخول غير صالحة.', 401);

  const { data: profile } = await client.from('profiles')
    .select('role,is_admin,is_active,permissions')
    .eq('id', user.id)
    .maybeSingle();
  const permissions = profile?.permissions?.statements;
  const canExport = Array.isArray(permissions)
    ? permissions.includes('export')
    : permissions?.export === true;

  if (!profile || profile.is_active === false ||
      !(profile.is_admin || profile.role === 'admin' || profile.role === 'super_admin' || canExport)) {
    return errorResponse('هذه العملية تتطلب صلاحية تصدير كشوف الحساب.', 403);
  }
  return null;
}

async function readPdfInput(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return errorResponse('محتوى التقرير مطلوب.', 400);
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return errorResponse('حجم التقرير يتجاوز الحد المسموح.', 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    const body = JSON.parse(text + decoder.decode());
    if (typeof body?.htmlContent !== 'string' || !body.htmlContent.trim()) {
      return errorResponse('محتوى التقرير مطلوب.', 400);
    }
    return {
      htmlContent: body.htmlContent as string,
      fileName: typeof body.fileName === 'string' ? body.fileName.trim() : '',
    };
  } catch {
    return errorResponse('طلب تصدير غير صالح.', 400);
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  let browser: Browser | undefined;
  let renderSlot = false;
  try {
    const authError = await authorizeStatementExport(request);
    if (authError) return authError;

    if (activeRenders >= MAX_CONCURRENT_RENDERS) return errorResponse('خدمة التصدير مشغولة. حاول بعد قليل.', 429);
    activeRenders += 1;
    renderSlot = true;
    const input = await readPdfInput(request);
    if (input instanceof Response) return input;

    const args = ['--disable-background-networking', '--dns-prefetch-disable'];
    // Some container deployments run Chromium as root and opt out explicitly.
    if (process.env.PDF_CHROME_NO_SANDBOX === 'true') args.push('--no-sandbox', '--disable-setuid-sandbox');
    browser = await puppeteer.launch({ headless: true, args, timeout: RENDER_TIMEOUT_MS });
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setOfflineMode(true);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const decision = req.url() === 'about:blank' ? req.continue() : req.abort('blockedbyclient');
      void decision.catch(() => {});
    });

    // This export template uses only local fonts and inline styling. Install the
    // restrictions before loading any client-supplied markup.
    const html = input.htmlContent.replace(/^\s*(?:<!doctype[^>]*>\s*)?/i, '');
    await page.setContent('<!DOCTYPE html>' + PDF_CSP + html, {
      waitUntil: 'load',
      timeout: RENDER_TIMEOUT_MS,
    });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      timeout: RENDER_TIMEOUT_MS,
    });

    const fileName = input.fileName || buildDocumentFileName({
      docType: 'كشف_حساب_تفصيلي',
      prefix: 'STM',
      ext: 'pdf',
    }).fileName;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': buildContentDispositionAttachment(fileName),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return errorResponse('تعذر إنشاء ملف PDF. يرجى المحاولة مرة أخرى.', 500);
  } finally {
    await browser?.close().catch(() => {});
    if (renderSlot) activeRenders -= 1;
  }
}

