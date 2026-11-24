#!/usr/bin/env node
/**
 * sync-store-catalog-to-sql.mjs
 * يزامن كتالوج المتجر من Supabase Storage (store-catalog/catalog/index.json)
 * إلى جدول public.store_catalog_products على دفعات مع تفعيل البحث بالعامية تلقائياً.
 *
 * التشغيل:
 *   node scripts/sync-store-catalog-to-sql.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const BUCKET_NAME = 'store-catalog';
const INDEX_PATH = 'catalog/index.json';
const BATCH_SIZE = 350;

const VALID_CATEGORIES = new Set([
  'electrical',
  'plumbing',
  'paint',
  'ceramics',
  'marble',
  'decor',
  'smart_home',
  'low_current',
  'safety_sensors',
  'hvac',
  'building_materials',
  'doors_windows',
  'appliances',
  'tools_hardware',
]);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}

function cleanText(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  return String(val).replace(/\u0000/g, '').trim() || fallback;
}

function cleanNullableText(val) {
  const s = cleanText(val, '');
  return s ? s : null;
}

function cleanMoney(val, allowZero = true) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0 || n >= 1e11) return null;
  if (!allowZero && n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function mapProductToRow(raw, nowIso) {
  const id = cleanText(raw?.id);
  const name = cleanText(raw?.name);
  if (!id || !name) return null;

  const rawCat = cleanText(raw?.category);
  const category = VALID_CATEGORIES.has(rawCat) ? rawCat : 'building_materials';
  const price = cleanMoney(raw?.price, true) ?? 0;
  const oldPrice = cleanMoney(raw?.oldPrice, false);
  const installPrice = cleanMoney(raw?.installPrice, true);

  const specs = Array.isArray(raw?.specs)
    ? raw.specs
        .map((s) => cleanText(s))
        .filter(Boolean)
        .slice(0, 12)
    : [];

  const variants = Array.isArray(raw?.variants) ? raw.variants.slice(0, 12) : [];

  const attachments = Array.isArray(raw?.attachments)
    ? raw.attachments
        .filter((a) => a && cleanText(a.id))
        .slice(0, 12)
        .map((a) => ({
          id: cleanText(a.id),
          name: cleanText(a.name, 'مرفق فني'),
          mimeType: cleanText(a.mimeType, 'application/octet-stream'),
          ...(typeof a.size === 'number' ? { size: a.size } : {}),
          kind:
            a.kind === 'datasheet' || a.kind === 'document' ? a.kind : 'image',
        }))
    : [];

  const cheapestSourceCount =
    typeof raw?.cheapestSourceCount === 'number' &&
    Number.isFinite(raw.cheapestSourceCount) &&
    raw.cheapestSourceCount > 0
      ? Math.floor(raw.cheapestSourceCount)
      : 1;

  return {
    id,
    code: cleanText(raw?.code, 'PHI-ITEM'),
    name,
    category,
    sub_category: cleanText(raw?.subCategory, ''),
    brand: cleanText(raw?.brand, 'PhiTech'),
    unit: cleanText(raw?.unit, 'قطعة'),
    price,
    old_price: oldPrice && oldPrice > price ? oldPrice : null,
    install_price: installPrice,
    currency: raw?.currency === 'ر.س' ? 'ر.س' : 'ج.م',
    badge: cleanNullableText(raw?.badge),
    description: cleanText(raw?.description, ''),
    specs,
    variants,
    media_id: cleanNullableText(raw?.mediaId),
    image_url: cleanNullableText(raw?.imageUrl),
    attachments,
    cheapest_source_count: cheapestSourceCount,
    in_stock: raw?.inStock !== false,
    featured: Boolean(raw?.featured),
    updated_at: nowIso,
  };
}

async function downloadCatalogIndex(sbUrl, serviceKey) {
  const base = sbUrl.replace(/\/+$/, '');
  const authedUrl = `${base}/storage/v1/object/${BUCKET_NAME}/${INDEX_PATH}`;
  const publicUrl = `${base}/storage/v1/object/public/${BUCKET_NAME}/${INDEX_PATH}`;

  console.log(`⬇️  جارٍ تحميل ${BUCKET_NAME}/${INDEX_PATH} من Supabase Storage...`);
  let res = await fetch(authedUrl, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!res.ok) {
    res = await fetch(publicUrl);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`فشل تحميل index.json (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('ملف catalog/index.json ليس مصفوفة منتجات صالحة.');
  }
  return data;
}

async function upsertBatch(sbUrl, serviceKey, rows, batchNum, totalBatches) {
  const endpoint = `${sbUrl.replace(/\/+$/, '')}/rest/v1/store_catalog_products?on_conflict=id`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    });

    if (res.ok) return;

    const errText = await res.text().catch(() => '');
    if (attempt === 1) {
      console.warn(
        `⚠️  إعادة محاولة الدفعة ${batchNum}/${totalBatches} بعد خطأ مؤقت (${res.status})...`
      );
      await new Promise((r) => setTimeout(r, 800));
    } else {
      throw new Error(
        `فشل upsert في الدفعة ${batchNum}/${totalBatches} (${res.status}): ${errText.slice(0, 400)}`
      );
    }
  }
}

async function callRpc(sbUrl, serviceKey, fnName, payload = {}) {
  const t0 = performance.now();
  const res = await fetch(`${sbUrl.replace(/\/+$/, '')}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const ms = Math.round(performance.now() - t0);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`RPC ${fnName} فشل (${res.status}): ${errText.slice(0, 300)}`);
  }
  return { data: await res.json(), ms };
}

async function main() {
  loadEnvFile(path.join(ROOT_DIR, '.env.local'));
  loadEnvFile(path.join(ROOT_DIR, '.env'));

  const sbUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).trim();
  const serviceKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ''
  ).trim();

  if (!sbUrl || !serviceKey) {
    console.error(
      '❌ تأكد من وجود NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في ملف .env.local'
    );
    process.exit(1);
  }

  const startedAt = performance.now();
  const rawItems = await downloadCatalogIndex(sbUrl, serviceKey);
  console.log(`📦 تم تحميل ${rawItems.length.toLocaleString('en-US')} عنصر من Storage.`);

  // تنظيف وإزالة أي تكرار في id قبل الضخ لتفادي خطأ ON CONFLICT
  const nowIso = new Date().toISOString();
  const deduped = new Map();
  let skipped = 0;
  for (const item of rawItems) {
    const row = mapProductToRow(item, nowIso);
    if (!row) {
      skipped++;
      continue;
    }
    deduped.set(row.id, row);
  }

  const rows = Array.from(deduped.values());
  const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
  console.log(
    `🚀 بدء ضخ ${rows.length.toLocaleString('en-US')} منتجاً فريدًا على ${totalBatches} دفعة (تخطي ${skipped})...`
  );

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await upsertBatch(sbUrl, serviceKey, chunk, batchNum, totalBatches);
    const done = Math.min(i + chunk.length, rows.length);
    const pct = Math.round((done / rows.length) * 100);
    process.stdout.write(
      `\r✅ الدفعة ${batchNum}/${totalBatches} — تم ضخ ${done.toLocaleString('en-US')} / ${rows.length.toLocaleString('en-US')} (${pct}%)`
    );
  }

  const totalSec = ((performance.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n\n🎉 اكتملت المزامنة بنجاح خلال ${totalSec} ثانية!\n`);

  // 1) اختبار خريطة الكتالوج
  console.log('📊 فحص copilot_catalog_overview():');
  const overview = await callRpc(sbUrl, serviceKey, 'copilot_catalog_overview');
  console.log(
    `   ⏱️ ${overview.ms}ms | الإجمالي: ${overview.data.total_products} | متوفر: ${overview.data.in_stock_products} | بخصم: ${overview.data.discounted_count} | أقسام: ${overview.data.categories?.length ?? 0}`
  );

  // 2) اختبار البحث بالعامية المصرية
  console.log('\n🔎 اختبار سرعة ودقة البحث بالعامية المصرية (copilot_search_products):');
  const testQueries = [
    'فيشة شنايدر',
    'حنفية جروهي',
    'بلاعة',
    'جيبسون بورد',
    'تكيف',
    'قفل ذكي',
  ];

  for (const q of testQueries) {
    const res = await callRpc(sbUrl, serviceKey, 'copilot_search_products', {
      p_query: q,
      p_limit: 3,
    });
    const hits = Array.isArray(res.data) ? res.data : [];
    const top = hits[0];
    console.log(
      `   • "${q}" → ${hits.length} نتائج (${res.ms}ms)` +
        (top
          ? ` | أول نتيجة: ${top.name} [${top.brand}] — ${top.price} ${top.currency}`
          : ' | لا توجد نتائج')
    );
  }
}

main().catch((err) => {
  console.error('\n❌ خطأ أثناء المزامنة:', err.message || err);
  process.exit(1);
});
