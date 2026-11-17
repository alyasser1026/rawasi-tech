/**
 * copilot-website-knowledge.mjs — معرفة البوت بالموقع العام لفاي تك (كل الأقسام).
 *
 * المصدر هو نفس اللي الموقع بيعرضه بالظبط:
 *  - المحتوى المنشور من «إدارة الموقع» عبر RPC العام website_public_content (نفس استدعاء app/page.tsx)،
 *    متدمج مع القيم الافتراضية بنفس sanitizeContent/mergeContent بتوع app/site/site-content.ts.
 *  - المتجر والعقارات والصيانة: app/site/store-catalog.ts
 *  - أقسام البوابة: app/site/section-defs.ts
 *  - دليل التنفيذ والأسعار الاسترشادية: app/site/execution-guide-data.ts
 *  - قائمة التفقد الهندسية: app/site/checklist-data.ts
 * كله محتوى عام منشور للزوار، فمفيش بيانات شركة داخلية هنا ولا صلاحيات مطلوبة.
 */
import { registerHooks } from 'node:module';

export const WEBSITE_TOOL_NAME = 'get_public_website_info';

const CACHE_MS = 5 * 60_000;
const SHOW = 8;
const MAX_TEXT = 3600;

export const WEBSITE_SECTIONS = Object.freeze({
  overview: 'نبذة عن الشركة وأقسام الموقع',
  contact: 'التليفون والواتساب والإيميل والعناوين ومواعيد العمل',
  services: 'خدمات المقاولات والتشطيب والكهروميكانيك',
  steps: 'خطوات التعامل من المعاينة للتسليم',
  commitments: 'التزامات الشركة وطريقة الشغل',
  faq: 'الأسئلة الشائعة',
  portfolio: 'أعمال الشركة المنشورة على الموقع',
  store: 'منتجات المتجر وأسعارها وسعر التركيب والتوفر',
  bundles: 'باقات السمارت هوم والأمان',
  real_estate: 'الوحدات العقارية المعروضة: النوع والمساحة والسعر والمقدم والأقساط والحالة',
  maintenance: 'خدمات الصيانة ورسوم الزيارة والضمان',
  execution_guide: 'دليل تنفيذ البنود: الخطوات والاستلام والأسعار الاسترشادية',
  checklist: 'قائمة التفقد الهندسية للمواقع',
  all: 'بحث في كل أقسام الموقع',
});
export const WEBSITE_SECTION_KEYS = Object.freeze(Object.keys(WEBSITE_SECTIONS));
const NEEDS_SEARCH = new Set(['all']);

/* ───────────── تحميل ملفات الموقع ───────────── */

let hookInstalled = false;
/** site-content.ts بيستورد './store-catalog' من غير امتداد؛ Node محتاج يعرف إن ده ملف .ts. محصور في app/site بس. */
function installSiteResolveHook() {
  if (hookInstalled || typeof registerHooks !== 'function') return;
  hookInstalled = true;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const parent = context.parentURL || '';
      if (specifier.startsWith('./') && !/\.[a-z]+$/i.test(specifier) && /\/app\/site\/[^/]+\.ts$/.test(parent)) {
        try { return nextResolve(`${specifier}.ts`, context); } catch { /* يكمل عادي */ }
      }
      return nextResolve(specifier, context);
    },
  });
}

let modulesPromise = null;
export function loadSiteModules() {
  if (!modulesPromise) {
    modulesPromise = (async () => {
      const [store, guide, checklist, sections] = await Promise.all([
        import('../app/site/store-catalog.ts'),
        import('../app/site/execution-guide-data.ts'),
        import('../app/site/checklist-data.ts'),
        import('../app/site/section-defs.ts'),
      ]);
      let content = null;
      try { installSiteResolveHook(); content = await import('../app/site/site-content.ts'); } catch { content = null; }
      return { store, guide, checklist, sections, content };
    })().catch(err => { modulesPromise = null; throw err; });
  }
  return modulesPromise;
}

/* ───────────── المطابقة ───────────── */

export const norm = (s) => String(s ?? '')
  .replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

const stem = (w) => (w.length > 3 && w.startsWith('ال') ? w.slice(2) : w);
const STOP = new Set(['سعر', 'اسعار', 'بكام', 'كام', 'عندكم', 'عندك', 'فيه', 'في', 'هل', 'عن', 'على', 'من', 'ايه', 'اي', 'لو', 'ممكن', 'عاوز', 'عايز', 'محتاج']);

export function searchWords(term) {
  return norm(term).split(' ').filter(w => w && !STOP.has(w)).map(stem).slice(0, 6);
}

/** درجة التطابق: كل الكلمات لازم تبان في النص (بعد شيل «ال»)، والعنوان بياخد وزن أكبر. */
export function score(words, title, ...rest) {
  if (!words.length) return 1;
  const t = norm(title);
  const body = norm(rest.flat().filter(Boolean).join(' '));
  let s = 0;
  for (const w of words) {
    if (t.includes(w)) s += 3;
    else if (body.includes(w)) s += 1;
    else return 0;
  }
  return s;
}

function pick(list, words, fields, limit = SHOW) {
  return list
    .map(x => ({ x, s: score(words, ...fields(x)) }))
    .filter(r => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(r => r.x);
}

/* ───────────── المحتوى المنشور ───────────── */

const cache = { at: 0, value: null };

async function fetchPublished({ supabaseUrl, supabaseKey, fetchImpl }) {
  if (!supabaseUrl || !supabaseKey) return {};
  try {
    const base = String(supabaseUrl).replace(/\/+$/, '');
    const res = await fetchImpl(`${base}/rest/v1/rpc/website_public_content`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: '{}',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return {};
    const raw = await res.json();
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

/** المحتوى زي ما الزائر بيشوفه دلوقتي (منشور + افتراضي). كاش 5 دقايق. */
export async function loadSiteContent({ supabaseUrl, supabaseKey, fetchImpl = fetch, now = Date.now() } = {}) {
  if (cache.value && now - cache.at < CACHE_MS) return cache.value;
  const mods = await loadSiteModules();
  const raw = await fetchPublished({ supabaseUrl, supabaseKey, fetchImpl });
  let merged;
  if (mods.content?.mergeContent && mods.content?.sanitizeContent) {
    merged = mods.content.mergeContent(mods.content.sanitizeContent(raw));
    merged.SERVICES = mods.content.SERVICES;
    merged.STEPS = mods.content.STEPS;
  } else {
    // احتياطي لو site-content.ts ماتحمّلش: بيانات المتجر والدليل بس.
    merged = {
      SITE: null, SERVICES: [], STEPS: [], PROJECTS: [], COMMITMENTS: [], FAQS: [],
      PRODUCTS: mods.store.DEFAULT_PRODUCTS, PROPERTIES: mods.store.DEFAULT_PROPERTIES,
      MAINTENANCE_SERVICES: mods.store.DEFAULT_MAINTENANCE_SERVICES,
    };
  }
  const value = {
    ...merged,
    CATEGORIES: mods.store.PRODUCT_CATEGORIES || [],
    BUNDLES: mods.store.SMART_BUNDLES || [],
    PORTAL: mods.sections.PORTAL_SECTIONS || [],
    GUIDE: mods.guide.EXECUTION_GUIDE_ITEMS || [],
    CHECKLIST: mods.checklist.CHECKLIST || [],
    published: Object.keys(raw).length > 0,
  };
  cache.at = now;
  cache.value = value;
  return value;
}

export function clearWebsiteCache() { cache.at = 0; cache.value = null; }

/* ───────────── التنسيق ───────────── */

const money = (v, cur) => (Number(v) > 0 ? `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${cur || ''}`.trim() : null);
const catTitle = (c, id) => c.CATEGORIES.find(x => x.id === id)?.shortTitle || c.CATEGORIES.find(x => x.id === id)?.title || id;
const STATUS = { available: 'متاحة', reserved: 'محجوزة', sold: 'مباعة' };
const clip = (s, n = 160) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

function productLine(c, p) {
  const bits = [catTitle(c, p.category), p.brand, p.unit && `الوحدة: ${p.unit}`];
  const price = money(p.price, p.currency);
  const old = money(p.oldPrice, p.currency);
  const inst = money(p.installPrice, p.currency);
  return `• ${p.name}${p.code ? ` (${p.code})` : ''}\n   ${bits.filter(Boolean).join(' • ')}\n   💰 ${price || 'السعر عند الطلب'}${old && Number(p.oldPrice) > Number(p.price) ? ` بدل ${old}` : ''}${inst ? ` • التركيب ${inst}` : ''} • ${p.inStock === false ? '❌ غير متوفر حاليًا' : '✅ متوفر'}${p.badge ? ` • ${p.badge}` : ''}`;
}

function propertyLine(p) {
  const bits = [p.typeLabel, [p.city, p.location].filter(Boolean).join(' - '), p.areaSqm && `${p.areaSqm} م²`, p.bedrooms && `${p.bedrooms} غرف`, p.bathrooms && `${p.bathrooms} حمام`, p.floorLabel, p.finishingLabel, p.deliveryLabel];
  const pay = [money(p.price, p.currency) ? `السعر ${money(p.price, p.currency)}` : 'السعر عند الطلب', p.downPaymentPct && `مقدم ${p.downPaymentPct}%`, p.installmentYears && `تقسيط ${p.installmentYears} سنين`];
  return `• ${p.title}${p.code ? ` (${p.code})` : ''} — ${STATUS[p.status] || p.status || ''}\n   ${bits.filter(Boolean).join(' • ')}\n   💰 ${pay.filter(Boolean).join(' • ')}`;
}

function maintenanceLine(c, m) {
  return `• ${m.title}${m.code ? ` (${m.code})` : ''} — ${m.available === false ? 'غير متاحة حاليًا' : 'متاحة'}\n   ${[m.category === 'hvac' ? 'تكييف' : catTitle(c, m.category), m.warrantyLabel && `الضمان: ${m.warrantyLabel}`, money(m.visitFee, m.currency) && `رسوم الزيارة ${money(m.visitFee, m.currency)}`].filter(Boolean).join(' • ')}${m.executionScope?.length ? `\n   التنفيذ: ${clip(m.executionScope.slice(0, 3).join('، '), 140)}` : ''}${m.maintenanceScope?.length ? `\n   الصيانة: ${clip(m.maintenanceScope.slice(0, 3).join('، '), 140)}` : ''}`;
}

function bundlePrice(c, b) {
  if (Number(b.price) > 0) return { price: Number(b.price), cur: b.currency };
  let total = 0; let cur = b.currency;
  for (const { productId, qty } of b.productIds || []) {
    const p = c.PRODUCTS.find(x => x.id === productId);
    if (p && Number(p.price) > 0) { total += Number(p.price) * (Number(qty) || 1); cur = p.currency || cur; }
  }
  return { price: total, cur };
}

function guideDetail(g, full) {
  const out = [`📘 ${g.itemTitle} (${g.sectionCode}) — ${g.itemCategory}${g.unit ? ` • الوحدة: ${g.unit}` : ''}`];
  const pr = g.approximatePricing;
  if (pr) out.push(`💰 سعر استرشادي: ${pr.totalRate || '—'}${pr.materialCostRange ? `\n   الخامات: ${pr.materialCostRange}` : ''}${pr.laborCostRange ? `\n   المصنعية: ${pr.laborCostRange}` : ''}${g.lastPriceUpdate ? `\n   آخر تحديث: ${g.lastPriceUpdate}` : ''}`);
  if (!full) return out.join('\n');
  if (g.prerequisites?.items?.length) out.push(`🔹 قبل البند: ${clip(g.prerequisites.items.slice(0, 4).join('، '), 260)}`);
  const steps = g.executionSequence?.steps || [];
  if (steps.length) out.push(`🔹 خطوات التنفيذ:\n${steps.slice(0, 8).map(s => `   ${s.stepNumber}. ${s.title}`).join('\n')}`);
  if (g.calculationsAndQuantities?.standardWaste) out.push(`🔹 الهالك: ${clip(g.calculationsAndQuantities.standardWaste, 120)}`);
  if (g.inspectionAndHandover?.checkpoints?.length) out.push(`🔹 الاستلام: ${clip(g.inspectionAndHandover.checkpoints.slice(0, 4).join('، '), 300)}`);
  if (g.inspectionAndHandover?.tolerances?.length) out.push(`🔹 السماحيات: ${clip(g.inspectionAndHandover.tolerances.slice(0, 3).join('، '), 200)}`);
  if (pr?.pricingNotes) out.push(`ℹ️ ${clip(pr.pricingNotes, 200)}`);
  return out.join('\n');
}

function checklistMatches(c, words, limit = 5) {
  const hits = [];
  for (const part of c.CHECKLIST) {
    for (const sec of part.sections || []) {
      const items = (sec.groups || []).flatMap(g => g.items || []);
      const secScore = score(words, sec.title, part.title);
      const itemHits = items.filter(it => score(words, it.text, it.subs) > 0);
      if (secScore > 0 || itemHits.length) hits.push({ part, sec, items: secScore > 0 && !itemHits.length ? items : itemHits, s: secScore * 2 + itemHits.length });
    }
  }
  return hits.sort((a, b) => b.s - a.s).slice(0, limit);
}

const SECTION_ROUTES = { store: '/store', real_estate: '/real-estate', maintenance: '/sections/maintenance', execution_guide: '/sections/info', checklist: '/sections/info', bundles: '/sections/smart-home' };

/* ───────────── الرد ───────────── */

function renderSection(c, section, words, term) {
  const L = [];
  const S = c.SITE;
  switch (section) {
    case 'overview': {
      if (S) L.push(`🏢 ${S.legalName || S.name}${S.nameEn ? ` (${S.nameEn})` : ''}\n${S.headline || ''}\n${S.intro || ''}`.trim());
      if (S?.offices?.length) L.push(`📍 المكاتب: ${S.offices.join(' • ')}`);
      if (c.PORTAL.length) L.push(`\n🧭 أقسام الموقع:\n${c.PORTAL.map(p => `${p.icon} ${p.title} — ${p.guideHint} (${p.href})`).join('\n')}`);
      L.push('\nوكمان: المتجر /store • العقارات /real-estate • دليل التنفيذ وقائمة التفقد والحاسبات الهندسية في قسم المعلومات.');
      break;
    }
    case 'contact': {
      const ct = S?.contact || {};
      L.push('📞 التواصل مع فاي تك:');
      if (ct.phone) L.push(`• التليفون: ${ct.phone}`);
      if (ct.whatsapp) L.push(`• واتساب: https://wa.me/${String(ct.whatsapp).replace(/\D/g, '')}`);
      if (ct.email) L.push(`• الإيميل: ${ct.email}`);
      if (ct.address) L.push(`• العنوان: ${ct.address}`);
      if (ct.hours) L.push(`• المواعيد: ${ct.hours}`);
      if (S?.offices?.length) L.push(`• المكاتب: ${S.offices.join(' • ')}`);
      break;
    }
    case 'services': {
      const list = words.length ? pick(c.SERVICES, words, s => [s.title, s.summary, s.items]) : c.SERVICES;
      L.push('🏗️ خدمات فاي تك:');
      for (const s of list) L.push(`\n• ${s.title}\n   ${s.summary}\n${s.items.map(i => `   - ${i}`).join('\n')}`);
      if (!words.length && c.MAINTENANCE_SERVICES.length) L.push(`\n🛠️ وكمان ${c.MAINTENANCE_SERVICES.length} خدمة صيانة — اسألني عن «الصيانة».`);
      break;
    }
    case 'steps':
      L.push('🪜 خطوات التعامل:');
      for (const s of c.STEPS) L.push(`${s.n}. ${s.title} — ${s.text}`);
      break;
    case 'commitments':
      L.push('✅ التزاماتنا:');
      for (const s of c.COMMITMENTS) L.push(`• ${s.title}: ${s.text}`);
      break;
    case 'faq': {
      const list = words.length ? pick(c.FAQS, words, f => [f.q, f.a]) : c.FAQS;
      L.push('❓ الأسئلة الشائعة:');
      for (const f of list) L.push(`\n• ${f.q}\n   ${f.a}`);
      break;
    }
    case 'portfolio': {
      const list = words.length ? pick(c.PROJECTS, words, p => [p.name, p.kind, p.place, p.status]) : c.PROJECTS;
      L.push('🏘️ أعمالنا المنشورة على الموقع:');
      for (const p of list.slice(0, 15)) L.push(`• ${p.name} — ${[p.kind, p.area, p.place, p.status].filter(Boolean).join(' • ')}`);
      break;
    }
    case 'store': {
      const list = words.length
        ? pick(c.PRODUCTS, words, p => [p.name, p.code, p.brand, catTitle(c, p.category), p.description, p.specs], SHOW)
        : c.PRODUCTS.filter(p => p.featured).slice(0, SHOW);
      L.push(`🛒 المتجر${term ? ` — «${term}»` : ' — منتجات مميزة'} (${c.PRODUCTS.length} منتج):`);
      for (const p of list) L.push(productLine(c, p));
      if (!words.length) L.push(`\nالتصنيفات: ${c.CATEGORIES.map(x => `${x.icon} ${x.shortTitle || x.title}`).join(' • ')}`);
      break;
    }
    case 'bundles': {
      const list = words.length ? pick(c.BUNDLES, words, b => [b.title, b.subtitle, b.items]) : c.BUNDLES;
      L.push('📦 باقات السمارت هوم والأمان:');
      for (const b of list) {
        const { price, cur } = bundlePrice(c, b);
        L.push(`\n• ${b.title}\n   ${b.subtitle}${money(price, cur) ? `\n   💰 حوالي ${money(price, cur)}` : ''}\n${(b.items || []).slice(0, 5).map(i => `   - ${i}`).join('\n')}`);
      }
      break;
    }
    case 'real_estate': {
      const list = words.length
        ? pick(c.PROPERTIES, words, p => [p.title, p.code, p.typeLabel, p.subtitle, p.city, p.location, STATUS[p.status], p.finishingLabel, p.deliveryLabel, p.features])
        : c.PROPERTIES;
      const avail = c.PROPERTIES.filter(p => p.status === 'available').length;
      L.push(`🏢 العقارات المعروضة${term ? ` — «${term}»` : ''} (${c.PROPERTIES.length} وحدة، المتاح ${avail}):`);
      for (const p of list.slice(0, SHOW)) L.push(propertyLine(p));
      break;
    }
    case 'maintenance': {
      const list = words.length
        ? pick(c.MAINTENANCE_SERVICES, words, m => [m.title, m.code, m.category === 'hvac' ? 'تكييف' : catTitle(c, m.category), m.executionScope, m.maintenanceScope, m.recommendation])
        : c.MAINTENANCE_SERVICES;
      L.push(`🛠️ خدمات الصيانة والتنفيذ${term ? ` — «${term}»` : ''}:`);
      for (const m of list.slice(0, SHOW)) L.push(maintenanceLine(c, m));
      break;
    }
    case 'execution_guide': {
      if (!words.length) {
        const byCat = new Map();
        for (const g of c.GUIDE) byCat.set(g.itemCategory, [...(byCat.get(g.itemCategory) || []), g.itemTitle]);
        L.push(`📘 دليل التنفيذ (${c.GUIDE.length} بند):`);
        for (const [cat, titles] of byCat) L.push(`\n${cat}:\n${titles.map(t => `   • ${t}`).join('\n')}`);
        L.push('\nاسألني عن بند معين عشان أقولك خطواته وسعره الاسترشادي.');
        break;
      }
      const list = pick(c.GUIDE, words, g => [g.itemTitle, g.sectionCode, g.itemCategory, g.prerequisites?.description]);
      if (list.length) L.push(`📘 دليل التنفيذ — «${term}»:\n`);
      list.forEach((g, i) => L.push(`${i ? '\n' : ''}${guideDetail(g, i === 0)}`));
      break;
    }
    case 'checklist': {
      if (!words.length) {
        L.push('📋 قائمة التفقد الهندسية:');
        for (const part of c.CHECKLIST) L.push(`\n${part.title} — ${part.subtitle}\n${(part.sections || []).map(s => `   ${s.no}. ${s.title}`).join('\n')}`);
        break;
      }
      const hits = checklistMatches(c, words);
      if (hits.length) L.push(`📋 قائمة التفقد — «${term}»:\n`);
      hits.forEach((h, i) => {
        L.push(`${i ? '\n' : ''}📋 ${h.sec.title} (${h.part.title})${h.sec.critical ? `\n⚠️ ${clip(h.sec.critical, 200)}` : ''}`);
        for (const it of h.items.slice(0, i === 0 ? 8 : 3)) L.push(`   • ${clip(it.text, 220)}`);
      });
      break;
    }
    default:
      break;
  }
  return L;
}

function emptyFor(section, term) {
  return `مالقيتش «${term}» في ${WEBSITE_SECTIONS[section] || 'الموقع'}. جرّب كلمة تانية أو قولّي «بحث شامل في الموقع».`;
}

/** بحث في كل أقسام الموقع. */
function renderAll(c, words, term) {
  const blocks = [];
  const add = (title, lines) => { if (lines.length) blocks.push(`${title}\n${lines.join('\n')}`); };
  add('🛒 المتجر:', pick(c.PRODUCTS, words, p => [p.name, p.code, p.brand, catTitle(c, p.category), p.description], 3).map(p => productLine(c, p)));
  add('🏢 العقارات:', pick(c.PROPERTIES, words, p => [p.title, p.code, p.typeLabel, p.city, p.location, p.features], 3).map(propertyLine));
  add('🛠️ الصيانة:', pick(c.MAINTENANCE_SERVICES, words, m => [m.title, m.code, m.executionScope, m.maintenanceScope], 3).map(m => maintenanceLine(c, m)));
  add('📦 الباقات:', pick(c.BUNDLES, words, b => [b.title, b.subtitle, b.items], 2).map(b => `• ${b.title}`));
  add('🏗️ الخدمات:', pick(c.SERVICES, words, s => [s.title, s.summary, s.items], 3).map(s => `• ${s.title} — ${s.summary}`));
  add('📘 دليل التنفيذ:', pick(c.GUIDE, words, g => [g.itemTitle, g.itemCategory], 3).map(g => guideDetail(g, false)));
  add('📋 قائمة التفقد:', checklistMatches(c, words, 3).map(h => `• ${h.sec.title} (${h.part.title})`));
  add('❓ أسئلة شائعة:', pick(c.FAQS, words, f => [f.q, f.a], 3).map(f => `• ${f.q}\n   ${f.a}`));
  add('🏘️ أعمالنا:', pick(c.PROJECTS, words, p => [p.name, p.kind, p.place], 3).map(p => `• ${p.name} — ${[p.kind, p.place].filter(Boolean).join(' • ')}`));
  add('🧭 أقسام الموقع:', pick(c.PORTAL, words, p => [p.title, p.guideHint], 3).map(p => `${p.icon} ${p.title} (${p.href})`));
  if (!blocks.length) return [`مالقيتش «${term}» في أي قسم من أقسام الموقع العام.`];
  return [`🌐 نتايج «${term}» في الموقع العام:`, '', blocks.join('\n\n')];
}

export function validateWebsiteArgs(supplied) {
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) return null;
  if (Object.keys(supplied).some(k => !['section', 'search'].includes(k))) return null;
  const section = typeof supplied.section === 'string' ? supplied.section.trim() : '';
  if (!Object.hasOwn(WEBSITE_SECTIONS, section)) return null;
  const out = { section };
  if (supplied.search !== undefined && supplied.search !== null && supplied.search !== '') {
    if (typeof supplied.search !== 'string') return null;
    const t = supplied.search.normalize('NFKC').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!t) return null;
    out.search = t;
  }
  if (NEEDS_SEARCH.has(section) && !out.search) return null;
  return out;
}

/** الأداة نفسها: ترجع نص جاهز للتليجرام. */
export async function getPublicWebsiteInfo({ section, search } = {}, deps = {}) {
  let c;
  try { c = await loadSiteContent(deps); } catch { return { success: false, error: 'website_unavailable' }; }
  const words = search ? searchWords(search) : [];
  let lines = section === 'all' ? renderAll(c, words, search) : renderSection(c, section, words, search);
  const hasBody = lines.length > 1 || (section === 'contact' && lines.length);
  if (!hasBody && search) {
    // مالقيناش في القسم ده؟ نجرب البحث الشامل قبل ما نقول مفيش.
    const all = renderAll(c, words, search);
    lines = all.length > 1 ? [emptyFor(section, search), '', ...all] : [emptyFor(section, search)];
  } else if (!hasBody) {
    lines = [`القسم ده مفيهوش محتوى منشور على الموقع حاليًا.`];
  }
  if (SECTION_ROUTES[section]) lines.push(`\n🔗 على الموقع: ${SECTION_ROUTES[section]}`);
  let text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length > MAX_TEXT) text = `${text.slice(0, MAX_TEXT - 40).replace(/\n[^\n]*$/, '')}\n… (النتايج أطول، ضيّق البحث)`;
  return { success: true, section, search: search || null, text, published: c.published };
}

/** أسعار من الموقع للصنف: سعر استرشادي من دليل التنفيذ + سعر المتجر. بتستخدمها query_company_data(section=prices). */
export async function websitePricing(term, deps = {}) {
  const words = searchWords(term);
  if (!words.length) return { guide: [], products: [] };
  const c = await loadSiteContent(deps);
  const guide = pick(c.GUIDE.filter(g => g.approximatePricing), words, g => [g.itemTitle, g.itemCategory], 3)
    .map(g => ({ itemTitle: g.itemTitle, totalRate: g.approximatePricing.totalRate, materialCostRange: g.approximatePricing.materialCostRange, laborCostRange: g.approximatePricing.laborCostRange, lastPriceUpdate: g.lastPriceUpdate || null }));
  const products = pick(c.PRODUCTS, words, p => [p.name, p.code, p.brand, catTitle(c, p.category)], 3)
    .map(p => ({ name: p.name, code: p.code, price: Number(p.price) || 0, installPrice: Number(p.installPrice) || 0, currency: p.currency, unit: p.unit, inStock: p.inStock !== false }));
  return { guide, products };
}

export const WEBSITE_TOOL_DECLARATION = Object.freeze({
  name: WEBSITE_TOOL_NAME,
  description:
    'معلومات الموقع العام لفاي تك (اللي الزوار شايفينه): الشركة وأقسام الموقع، التواصل، الخدمات، خطوات التعامل، الالتزامات، الأسئلة الشائعة، الأعمال المنشورة، ' +
    'منتجات المتجر وأسعارها وسعر التركيب والتوفر، باقات السمارت هوم، الوحدات العقارية وأسعارها والمقدم والتقسيط، خدمات الصيانة ورسوم الزيارة والضمان، ' +
    'دليل تنفيذ البنود وأسعاره الاسترشادية، وقائمة التفقد الهندسية. استخدميها لأي سؤال عن الموقع أو المتجر أو العقارات أو الصيانة أو طريقة تنفيذ بند. ' +
    'الأقسام: ' + WEBSITE_SECTION_KEYS.map(k => `${k} = ${WEBSITE_SECTIONS[k]}`).join('؛ ') + '.',
  parameters: {
    type: 'OBJECT',
    properties: {
      section: { type: 'STRING', enum: [...WEBSITE_SECTION_KEYS], description: 'القسم. لو مش متأكدة استخدمي all مع search.' },
      search: { type: 'STRING', description: 'كلمة البحث (اسم منتج، نوع وحدة، مدينة، بند، عطل...). لازم مع all.' },
    },
    required: ['section'],
  },
});
