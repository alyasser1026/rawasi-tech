import { NextResponse } from 'next/server';
import { getStoreMediaEntry } from '@/lib/store-catalog-server';

export const runtime = 'nodejs';

const MEDIA_ID_RE = /^[a-zA-Z0-9_-]{4,64}$/;
const FILE_PATH_TTL_MS = 40 * 60 * 1000; // Telegram getFile links stay valid >= 1 hour

const g = globalThis as typeof globalThis & {
  __phiStoreTgPathCache?: Map<string, { filePath: string; expiresAt: number }>;
};

function getPathCache() {
  if (!g.__phiStoreTgPathCache) {
    g.__phiStoreTgPathCache = new Map();
  }
  return g.__phiStoreTgPathCache;
}

async function resolveTelegramFilePath(botToken: string, telegramFileId: string): Promise<string | null> {
  const cache = getPathCache();
  const cached = cache.get(telegramFileId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.filePath;
  }

  const infoResp = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(telegramFileId)}`,
    { cache: 'no-store' }
  );
  const infoJson = await infoResp.json().catch(() => null);
  const filePath: string | undefined = infoJson?.result?.file_path;
  if (!infoResp.ok || !infoJson?.ok || !filePath) {
    return null;
  }

  if (cache.size > 4000) {
    cache.clear();
  }
  cache.set(telegramFileId, { filePath, expiresAt: Date.now() + FILE_PATH_TTL_MS });
  return filePath;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!botToken) {
      return NextResponse.json({ error: 'خدمة عرض صور المتجر غير مهيأة حالياً' }, { status: 503 });
    }

    const { id } = await context.params;
    if (!MEDIA_ID_RE.test(id)) {
      return NextResponse.json({ error: 'معرّف الوسائط غير صالح' }, { status: 400 });
    }

    const entry = await getStoreMediaEntry(id);
    if (!entry?.telegramFileId) {
      return NextResponse.json({ error: 'الصورة أو المرفق غير موجود' }, { status: 404 });
    }

    let filePath = await resolveTelegramFilePath(botToken, entry.telegramFileId);
    if (!filePath) {
      return NextResponse.json({ error: 'تعذر جلب مسار الملف من تيليجرام' }, { status: 502 });
    }

    let fileResp = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`, {
      cache: 'no-store',
    });

    // Retry once with a fresh getFile lookup if the cached Telegram file_path expired
    if (!fileResp.ok) {
      getPathCache().delete(entry.telegramFileId);
      filePath = await resolveTelegramFilePath(botToken, entry.telegramFileId);
      if (!filePath) {
        return NextResponse.json({ error: 'تعذر تحديث مسار الملف من تيليجرام' }, { status: 502 });
      }
      fileResp = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`, {
        cache: 'no-store',
      });
    }

    if (!fileResp.ok || !fileResp.body) {
      return NextResponse.json({ error: 'تعذر تحميل الملف من خوادم تيليجرام' }, { status: 502 });
    }

    const urlObj = new URL(req.url);
    const forceDownload = urlObj.searchParams.get('download') === '1';
    const safeName = encodeURIComponent(entry.fileName || `${id}.webp`);
    const dispType = forceDownload ? 'attachment' : 'inline';

    return new Response(fileResp.body, {
      status: 200,
      headers: {
        'Content-Type': entry.mimeType || 'image/webp',
        'Content-Disposition': `${dispType}; filename*=UTF-8''${safeName}`,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'حدث خطأ غير متوقع أثناء تحميل الملف' }, { status: 500 });
  }
}
