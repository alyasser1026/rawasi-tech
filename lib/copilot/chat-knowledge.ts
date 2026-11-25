/**
 * chat-knowledge.ts — معرفة الشات الحي بكل أقسام الموقع العام (للسيرفر بس).
 *
 * بيدوّر في نفس المحتوى اللي الزائر شايفه: المتجر والباقات، العقارات، الصيانة، الخدمات وخطوات التعامل
 * والالتزامات والأسئلة الشائعة والأعمال، أقسام البوابة، دليل التنفيذ، وقائمة التفقد.
 * بيتستورد من app/api/website-chat/route.ts بس ويتحقن في chat-auto-responder.ts،
 * عشان ملفات الدليل وقائمة التفقد الكبيرة ما تدخلش في باندل صفحة الزائر.
 * محتوى عام فقط — مفيش أي بيانات من السيستم الداخلي.
 */

import { CHECKLIST } from '@/app/site/checklist-data';
import { EXECUTION_GUIDE_ITEMS, type ExecutionItemGuide } from '@/app/site/execution-guide-data';
import { PORTAL_SECTIONS } from '@/app/site/section-defs';
import { replaceInternalCategoryLabels } from './response-policy';
import {
  DEFAULT_MAINTENANCE_SERVICES,
  DEFAULT_PRODUCTS,
  DEFAULT_PROPERTIES,
  PRODUCT_CATEGORIES,
  SMART_BUNDLES,
  type WebsiteMaintenanceService,
  type WebsiteProduct,
  type WebsiteProperty,
} from '@/app/site/store-catalog';

export interface KnowledgeSiteContent {
  SITE?: { name?: string; legalName?: string; intro?: string; offices?: string[]; contact?: Record<string, string | undefined> };
  SERVICES?: Array<{ title: string; summary: string; items: string[] }>;
  STEPS?: Array<{ n: string; title: string; text: string }>;
  PROJECTS?: Array<{ name: string; kind: string; area: string; status: string; place?: string }>;
  COMMITMENTS?: Array<{ title: string; text: string }>;
  FAQS?: Array<{ q: string; a: string }>;
  PRODUCTS?: WebsiteProduct[];
  PROPERTIES?: WebsiteProperty[];
  MAINTENANCE_SERVICES?: WebsiteMaintenanceService[];
}

export interface KnowledgeAction { label: string; href: string; external?: boolean }

export interface KnowledgeAnswer {
  intent: 'site_knowledge' | 'site_browse';
  kind: string;
  replyText: string;
  quickReplies: string[];
  actions: KnowledgeAction[];
  /** strong = كل كلمات السؤال اتلقت في العنصر (يكفي للرد بدري قبل القواعد العامة). */
  strong: boolean;
  /** سؤال طريقة تنفيذ/استلام اتلقاله بند في الدليل أو قائمة التفقد. */
  howTo?: boolean;
}

/* ───────── تطبيع ومطابقة ───────── */

const norm = (s: unknown) =>
  String(s ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/بورسلين/g, 'بورسلان')
    .replace(/(\S{3,})وا(?=\s|$)/gu, '$1و') // «بتعملوا» = «بتعملو»، «عندكوا» = «عندكو»
    .replace(/سيراميكا/g, 'سيراميك')
    .replace(/\s+/g, ' ')
    .trim();

/** كلمات السؤال والعامية اللي مش بتحدد حاجة بعينها. */
const STOP = new Set(
  [
    'في', 'فيه', 'فى', 'عندكم', 'عندك', 'عندكو', 'هل', 'ايه', 'اية', 'اي', 'إيه', 'بكام', 'كام', 'سعر', 'اسعار', 'السعر', 'الاسعار',
    'عايز', 'عاوز', 'عايزه', 'عاوزه', 'محتاج', 'محتاجه', 'اريد', 'ابغي', 'ممكن', 'لو', 'سمحت', 'من', 'على', 'علي', 'عن', 'الى', 'الي',
    'مع', 'و', 'او', 'ولا', 'يا', 'انا', 'احنا', 'انتو', 'انتم', 'حضرتك', 'اعرف', 'اشوف', 'تفاصيل', 'معلومات', 'بخصوص', 'موجود',
    'موجوده', 'متاح', 'متاحه', 'فين', 'ازاي', 'كيف', 'امتي', 'ليه', 'بتاع', 'بتاعه', 'بتاعت', 'دي', 'ده', 'دا', 'دول', 'كده', 'كدا',
    'لسه', 'برضه', 'طب', 'طيب', 'بس', 'كمان', 'حاجه', 'حاجات', 'شويه', 'استفسار', 'سؤال', 'قولي', 'قولولي', 'وريني', 'ابعتلي',
    'الموقع', 'موقعكم', 'شركه', 'الشركه', 'فاي', 'تك', 'اللي', 'الي', 'دلوقتي', 'حاليا', 'النهارده', 'عندكوا',
  ].map(norm),
);

const BROWSE = [
  'بضاعه', 'بضاعة', 'بضايع', 'بضائع', 'منتجات', 'المنتجات', 'معروضات', 'بتبيعوا', 'بتبيع', 'تبيعوا', 'بيع', 'متجر', 'المتجر', 'كتالوج',
  'خامات', 'مواد', 'مواد بناء', 'عندكم ايه', 'ايه اللي عندكم',
].map(norm);
const OVERVIEW = ['اقسام', 'خدمات', 'خدماتكم', 'بتعملوا', 'بتشتغلوا', 'شغلكم', 'مجالكم', 'انتو مين', 'مين انتو', 'عن الشركه', 'اخبار', 'اخر الاخبار', 'جديد', 'الجديد', 'عروض', 'العروض', 'عرض'].map(norm);

/** كلمة من القايمة موجودة في السؤال كبداية كلمة (مع «ال» أو «و/ب» قبلها): «البضايع» ✓، «موجوده» ≠ «جوده». */
function hasWord(nq: string, list: string[]): boolean {
  return list.some((kw) => new RegExp(`(^|\\s)(و|ب|ف|ل)?(ال|لل)?${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$|ه|ات|ين)`).test(nq));
}

/** جموع تكسير شائعة → المفرد اللي مكتوب في عناوين الموقع. */
const SYN: Record<string, string> = Object.fromEntries(
  [
    ['شقق', 'شقه'], ['فلل', 'فيلا'], ['فيلات', 'فيلا'], ['ابراج', 'برج'], ['عماير', 'عماره'], ['محلات', 'محل'], ['معارض', 'معرض'],
    ['اقفال', 'قفل'], ['خلاطات', 'خلاط'], ['مواسير', 'ماسوره'], ['اسلاك', 'سلك'], ['كابلات', 'كابل'], ['لمبات', 'لمبه'], ['اجهزه', 'جهاز'],
    ['بلاط', 'بلاط'], ['حمامات', 'حمام'], ['مطابخ', 'مطبخ'], ['دهانات', 'دهان'], ['باقات', 'باقه'], ['الباقات', 'باقه'], ['مياه', 'ميه'], ['مية', 'ميه'],
  ].map(([a, b]) => [norm(a), norm(b)]),
);

/** كلمات «إزاي أنفّذ/أستلم» — بتتشال من البحث وبتخلّي دليل التنفيذ وقائمة التفقد أولوية. */
const HOWTO = new Set(['اركب', 'نركب', 'تركيب', 'خطوات', 'طريقه', 'ازاي', 'ازاى', 'كيف', 'تنفيذ', 'انفذ', 'ننفذ', 'استلام', 'استلم', 'نستلم', 'مراحل', 'فحص', 'افحص', 'اعتماد', 'مواصفات', 'شروط', 'الصح'].map(norm));

/** كلمات تصنيف عامة — لو السؤال كله منها، الرد العام بتاع القسم أحسن من منتج واحد. */
const GENERIC = new Set(['سمارت', 'هوم', 'smart', 'home', 'تكييف', 'تكيف', 'كهرباء', 'كهربا', 'سباكه', 'صيانه', 'تشطيب', 'تشطيبات', 'دهان', 'عقار', 'عقارات', 'امان', 'حمايه', 'تاسيس', 'تركيب', 'تنفيذ', 'اصلاح', 'قسم', 'معاينه'].map((w) => stem(norm(w))));

/** المفرد من جدول الجموع، بعد شيل أداة التعريف وحروف العطف/الجر («والأبراج» → «برج»). */
function synOf(w: string): string | undefined {
  if (SYN[w]) return SYN[w];
  for (const p of ['وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'و', 'ب']) {
    if (w.length - p.length >= 3 && w.startsWith(p) && SYN[w.slice(p.length)]) return SYN[w.slice(p.length)];
  }
  return undefined;
}

/** «الكاميرات» = «كاميرا»، «حساسات» = «حساس»… تقريب بسيط للجمع والتعريف. */
function stem(w: string): string {
  let s = w;
  for (const p of ['وال', 'بال', 'فال', 'كال', 'لل', 'ال']) {
    if (s.length - p.length >= 3 && s.startsWith(p)) { s = s.slice(p.length); break; }
  }
  for (const suf of ['ات', 'ين', 'ون', 'يه', 'ه', 'ا']) {
    if (s.length - suf.length >= 3 && s.endsWith(suf)) { s = s.slice(0, -suf.length); break; }
  }
  return s;
}

function tokens(text: string): { toks: string[]; howTo: boolean } {
  const words = norm(text).split(' ').filter((w) => w && !STOP.has(w) && (w.length > 1 || /\d/.test(w)));
  const howTo = words.some((w) => HOWTO.has(w));
  const toks = words.filter((w) => !HOWTO.has(w)).map((w) => synOf(w) || w).map(stem).slice(0, 8);
  return { toks, howTo };
}

type Indexed = { stems: Set<string>; raw: string };
const indexCache = new WeakMap<object, Indexed>();
function index(text: string): Indexed {
  const raw = norm(text);
  const stems = new Set<string>();
  for (const w of raw.split(' ')) {
    if (!w) continue;
    stems.add(stem(w));
    const syn = synOf(w);
    if (syn) stems.add(stem(syn)); // «الأبراج» في النص = «برج» في السؤال
  }
  return { stems, raw };
}
function indexOf(obj: object, text: () => string): Indexed {
  let v = indexCache.get(obj);
  if (!v) { v = index(text()); indexCache.set(obj, v); }
  return v;
}

function hit(tok: string, ix: Indexed): boolean {
  if (ix.stems.has(tok)) return true;
  if (tok.length >= 4) for (const s of ix.stems) if (s.length >= 4 && (s.startsWith(tok) || tok.startsWith(s))) return true;
  return /\d/.test(tok) && ix.raw.includes(tok);
}

type Scored<T> = { item: T; score: number; inTitle: number; matched: number; titleToks: Set<string> };

function rank<T extends object>(list: T[], toks: string[], title: (x: T) => string, body: (x: T) => string): Scored<T>[] {
  if (!toks.length) return [];
  const out: Scored<T>[] = [];
  for (const item of list) {
    const t = index(title(item));
    const b = indexOf(item, () => body(item));
    let inTitle = 0;
    let matched = 0;
    const titleToks = new Set<string>();
    for (const tok of toks) {
      if (hit(tok, t)) { inTitle++; matched++; titleToks.add(tok); } else if (hit(tok, b)) matched++;
    }
    // لازم أغلب الكلمات تتلاقي (كلمة من كلمتين مش كفاية لو التانية مش موجودة خالص في العنصر).
    const need = toks.length <= 2 ? toks.length : Math.ceil(toks.length * 0.6);
    if (matched >= need) out.push({ item, score: inTitle * 3 + matched, inTitle, matched, titleToks });
  }
  return out.sort((a, b) => b.score - a.score);
}

/* ───────── التنسيق ───────── */

const money = (v: unknown, cur?: string) => (Number(v) > 0 ? `${Number(v).toLocaleString('en-US')} ${cur || ''}`.trim() : '');
const clip = (s: unknown, n = 140) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const catMeta = (id: string) => PRODUCT_CATEGORIES.find((c) => c.id === id);
const STATUS: Record<string, string> = { available: 'متاحة ✅', reserved: 'محجوزة', sold: 'مباعة' };

function productText(p: WebsiteProduct): string {
  const price = money(p.price, p.currency);
  const old = Number(p.oldPrice) > Number(p.price) ? money(p.oldPrice, p.currency) : '';
  const inst = money(p.installPrice, p.currency);
  return (
    `• **${p.name}**${p.brand ? ` — ${p.brand}` : ''}\n` +
    `  ${price ? `السعر: ${price} / ${p.unit}${old ? ` (بدل ${old})` : ''}` : `السعر حسب الكمية والمواصفة (${p.unit})`}` +
    `${inst ? ` • التركيب: ${inst}` : ''} • ${p.inStock === false ? 'غير متوفر حاليًا' : 'متوفر'}`
  );
}

function propertyText(p: WebsiteProperty): string {
  const facts = [p.typeLabel, p.areaSqm && `${p.areaSqm} م²`, p.bedrooms && `${p.bedrooms} غرف`, p.bathrooms && `${p.bathrooms} حمام`, p.city].filter(Boolean).join(' • ');
  const pay = [money(p.price, p.currency) ? `السعر ${money(p.price, p.currency)}` : 'السعر عند الاستفسار', p.downPaymentPct && `مقدم ${p.downPaymentPct}%`, p.installmentYears && `تقسيط ${p.installmentYears} سنين`].filter(Boolean).join(' • ');
  return `• **${p.title}** — ${STATUS[p.status] || p.status}\n  ${facts}\n  ${[p.finishingLabel, p.deliveryLabel].filter(Boolean).join(' • ')}\n  ${pay}`;
}

function maintenanceText(m: WebsiteMaintenanceService): string {
  const fee = money(m.visitFee, m.currency);
  return (
    `• **${m.title}** ${m.icon || ''}\n` +
    `  التنفيذ: ${clip(m.executionScope.slice(0, 2).join('، '), 150)}\n` +
    `  الصيانة: ${clip(m.maintenanceScope.slice(0, 2).join('، '), 150)}\n` +
    `  ${m.warrantyLabel ? `الضمان: ${m.warrantyLabel} • ` : ''}${fee ? `رسوم الزيارة: ${fee}` : 'المعاينة والتسعير على الطبيعة'}`
  );
}

function guideText(g: ExecutionItemGuide): string {
  const steps = (g.executionSequence?.steps || []).slice(0, 5).map((s) => `${s.stepNumber}. ${s.title}`).join('\n  ');
  const pr = g.approximatePricing;
  return (
    `• **${g.itemTitle}** (${g.unit})\n` +
    (steps ? `  خطوات التنفيذ:\n  ${steps}\n` : '') +
    (g.inspectionAndHandover?.checkpoints?.length ? `  الاستلام: ${clip(g.inspectionAndHandover.checkpoints.slice(0, 2).join('، '), 170)}\n` : '') +
    (pr?.totalRate ? `  سعر استرشادي: ${pr.totalRate}${g.lastPriceUpdate ? ` (تحديث ${g.lastPriceUpdate})` : ''}` : '')
  ).trim();
}

const MORE: Record<string, string> = {
  product: 'المتجر', bundle: 'باقات السمارت هوم', property: 'العقارات', maintenance: 'الصيانة والتنفيذ', guide: 'دليل التنفيذ',
  checklist: 'قائمة التفقد', service: 'خدماتنا', faq: 'الأسئلة الشائعة', project: 'أعمالنا', portal: 'أقسام الموقع',
};

/* ───────── البحث ───────── */

function content(site?: KnowledgeSiteContent) {
  return {
    products: site?.PRODUCTS ?? DEFAULT_PRODUCTS,
    properties: site?.PROPERTIES ?? DEFAULT_PROPERTIES,
    maintenance: site?.MAINTENANCE_SERVICES ?? DEFAULT_MAINTENANCE_SERVICES,
    services: site?.SERVICES ?? [],
    steps: site?.STEPS ?? [],
    projects: site?.PROJECTS ?? [],
    commitments: site?.COMMITMENTS ?? [],
    faqs: site?.FAQS ?? [],
  };
}

function browseAnswer(site?: KnowledgeSiteContent): KnowledgeAnswer {
  const c = content(site);
  const cats = PRODUCT_CATEGORIES.map((cat) => {
    const n = c.products.filter((p) => p.category === cat.id).length;
    return n ? `${cat.icon} ${cat.shortTitle || cat.title} (${n})` : '';
  }).filter(Boolean);
  const featured = c.products.filter((p) => p.featured).slice(0, 3).map((p) => `• ${p.name}`).join('\n');
  return {
    intent: 'site_browse',
    kind: 'browse',
    strong: false,
    howTo: false,
    replyText:
      `أيوه عندنا 👍 متجر فاي تك فيه ${c.products.length} منتج أصلي (توريد بس أو توريد وتركيب):\n${cats.join(' • ')}` +
      (featured ? `\n\nالأكتر طلبًا:\n${featured}` : '') +
      `\n\nوكمان: ${c.maintenance.length} خدمة صيانة وتنفيذ، ${c.properties.length} وحدات عقارية، وباقات سمارت هوم جاهزة. قولي بتدور على إيه بالظبط؟`,
    quickReplies: ['⚡ كهرباء وإنارة', '🚰 سباكة وصحي', '🧱 بورسلان ورخام', '📱 سمارت هوم', '🏢 العقارات'],
    actions: [
      { label: '🛒 افتح المتجر', href: '/store' },
      { label: '🧱 قسم مواد البناء', href: '/sections/materials' },
    ],
  };
}

function overviewAnswer(site?: KnowledgeSiteContent): KnowledgeAnswer {
  const c = content(site);
  return {
    intent: 'site_browse',
    kind: 'overview',
    strong: false,
    howTo: false,
    replyText:
      `فاي تك شركة مقاولات وتشطيبات وسمارت هوم، والموقع فيه:\n${PORTAL_SECTIONS.map((p) => `${p.icon} **${p.title}** — ${p.guideHint}`).join('\n')}` +
      (c.services.length ? `\n\nخدماتنا الأساسية: ${c.services.map((s) => s.title).join('، ')}.` : '') +
      `\nقولي محتاج إيه وأنا أفصّلك.`,
    quickReplies: ['💰 تكلفة التشطيب', '🛒 المتجر', '🛠️ الصيانة', '🏢 العقارات'],
    actions: PORTAL_SECTIONS.slice(0, 2).map((p) => ({ label: `${p.icon} ${p.title}`, href: p.href })),
  };
}

/**
 * يرجّع رد جاهز من محتوى الموقع، أو null لو مفيش حاجة مطابقة.
 * الرد مبني من بيانات الموقع حرفيًا (مفيش أسعار مخترعة).
 */
export function searchSiteKnowledge(question: string, site?: KnowledgeSiteContent): KnowledgeAnswer | null {
  const { toks, howTo } = tokens(question);
  const nq = ` ${norm(question)} `;
  const isBrowse = hasWord(nq.trim(), BROWSE);
  const isOverview = hasWord(nq.trim(), OVERVIEW);
  const c = content(site);

  const groups: Array<{ kind: string; ranked: Scored<any>[] }> = [
    { kind: 'bundle', ranked: rank(SMART_BUNDLES, toks, (b) => b.title, (b) => `${b.subtitle} ${b.items.join(' ')} باقه باقات`) },
    { kind: 'product', ranked: rank(c.products, toks, (p) => `${p.name} ${p.code} ${p.brand}`, (p) => `${catMeta(p.category)?.title || ''} ${catMeta(p.category)?.shortTitle || ''} ${p.description} ${(p.specs || []).join(' ')} ${p.badge || ''}`) },
    { kind: 'property', ranked: rank(c.properties, toks, (p) => `${p.title} ${p.typeLabel} ${p.code}`, (p) => `${p.subtitle} ${p.city} ${p.location} ${p.finishingLabel} ${p.deliveryLabel} ${(p.features || []).join(' ')} عقار شقه وحده للبيع تقسيط`) },
    { kind: 'maintenance', ranked: rank(c.maintenance, toks, (m) => `${m.title} ${m.code}`, (m) => `${m.executionScope.join(' ')} ${m.maintenanceScope.join(' ')} ${m.recommendation} صيانه تنفيذ عطل`) },
    { kind: 'guide', ranked: rank(EXECUTION_GUIDE_ITEMS, toks, (g) => g.itemTitle, (g) => `${g.itemCategory} ${g.prerequisites?.description || ''} طريقه تنفيذ خطوات استلام`) },
    { kind: 'checklist', ranked: rank(CHECKLIST.flatMap((p) => p.sections.map((s) => ({ part: p, sec: s }))), toks, (x) => x.sec.title, (x) => `${x.part.title} ${x.sec.groups.flatMap((g) => g.items.map((i) => i.text)).join(' ')} فحص تفقد`) },
    { kind: 'service', ranked: rank(c.services, toks, (s) => s.title, (s) => `${s.summary} ${s.items.join(' ')}`) },
    { kind: 'faq', ranked: rank(c.faqs, toks, (f) => f.q, (f) => f.a) },
    { kind: 'project', ranked: rank(c.projects, toks, (p) => p.name, (p) => `${p.kind} ${p.place || ''} ${p.status} اعمال مشاريع سابقه`) },
    { kind: 'portal', ranked: rank(PORTAL_SECTIONS, toks, (p) => p.title, (p) => p.guideHint) },
  ].filter((g) => g.ranked.length);

  // تطابق في الوصف بس (مش العنوان) مقبول للأقسام النصية بس؛ في المنتجات والعقارات بيبقى صدفة.
  const TEXTUAL = new Set(['faq', 'checklist', 'maintenance', 'service', 'guide']);
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i].ranked[0].inTitle === 0 && !TEXTUAL.has(groups[i].kind)) groups.splice(i, 1);
  }
  const asksProperty = /(^| )(شقه|شقق|فيلا|فلل|دوبلكس|وحده|وحدات|عقار|عقارات|تمليك|للبيع)( |$)/.test(nq);
  if (asksProperty && c.properties.length && groups.every((g) => g.ranked[0].inTitle === 0)) {
    const avail = c.properties.filter((p) => p.status !== 'sold');
    return {
      intent: 'site_knowledge', kind: 'property', strong: false, howTo: false,
      replyText: `الوحدات المعروضة حاليًا:\n${avail.slice(0, 3).map(propertyText).join('\n')}\n\nولو بتسأل عن بناء أو تشطيب فيلا/شقة، ده في قسم المقاولات.`,
      quickReplies: ['💳 حاسبة المقدم والأقساط', '🏗️ تشطيب أو بناء', '👨‍💼 تحويل لمهندس العقارات'],
      actions: [{ label: '🏢 افتح قسم العقارات', href: '/real-estate' }, { label: '🏗️ قسم المقاولات', href: '/sections/contracting' }],
    };
  }
  if (!groups.length) return isBrowse ? browseAnswer(site) : isOverview ? overviewAnswer(site) : null;

  // سؤال «إزاي أنفذ/أستلم» → دليل التنفيذ وقائمة التفقد ليهم الأولوية.
  const boost = (kind: string) => (howTo && (kind === 'guide' || kind === 'checklist') ? 4 : 0);
  // الأولوية: أعلى درجة، ولو اتعادلوا الأقسام اللي فيها حاجة تتباع/تتنفذ الأول (الترتيب فوق).
  groups.sort((a, b) => b.ranked[0].score + boost(b.kind) - (a.ranked[0].score + boost(a.kind)));
  const top = groups[0];
  const best = top.ranked[0];
  const allGeneric = toks.length > 0 && toks.every((t) => GENERIC.has(t));
  // قوي = كل الكلمات اتلقت، وواحدة على الأقل في العنوان (أو كلها في العنوان للأقسام النصية).
  // في المنتجات والباقات: كل كلمة مميزة (مش تصنيف عام) لازم تكون في اسم المنتج نفسه
  // («ستائر سمارت» ما ينفعش يجيب شاشة تحكم مكتوب في وصفها ستائر).
  const specificInTitle = toks.filter((t) => !GENERIC.has(t)).every((t) => best.titleToks.has(t));
  const strong =
    !allGeneric &&
    best.matched === toks.length &&
    best.inTitle >= 1 &&
    (best.inTitle === toks.length ||
      ((top.kind === 'product' || top.kind === 'bundle') && specificInTitle) ||
      ['property', 'guide', 'maintenance', 'checklist'].includes(top.kind));
  // كلمة عامة زي «بضاعة» لوحدها مع تطابق ضعيف في الوصف بس → عرض المتجر أحسن.
  if (isBrowse && best.inTitle === 0) return browseAnswer(site);
  if (isOverview && best.inTitle === 0) return overviewAnswer(site);

  const items = top.ranked.filter((r) => r.score >= best.score - 2).slice(0, 3).map((r) => r.item);
  const others = groups.slice(1, 4).map((g) => MORE[g.kind]).filter(Boolean);
  let body = '';
  let actions: KnowledgeAction[] = [];
  let quickReplies: string[] = ['👨‍💼 تحويل لمهندس'];

  switch (top.kind) {
    case 'product': {
      const cat = catMeta(items[0].category);
      body = `لقيتلك في المتجر:\n${items.map(productText).join('\n')}`;
      actions = [{ label: cat ? `🛒 ${cat.shortTitle || cat.title}` : '🛒 افتح المتجر', href: cat ? `/store?cat=${cat.id}` : '/store' }];
      quickReplies = ['🛒 إزاي أطلب من السلة؟', '🛠️ عايزه بالتركيب', '👨‍💼 تحويل لمهندس'];
      break;
    }
    case 'bundle':
      body = items.map((b: any) => `**${b.title}**\n${b.subtitle}\n${b.items.slice(0, 5).map((i: string) => `• ${i}`).join('\n')}`).join('\n\n');
      actions = [{ label: '📱 قسم السمارت هوم', href: '/sections/smart-home' }];
      quickReplies = ['🛠️ حجز معاينة سمارت', '👨‍💼 تحويل لمهندس'];
      break;
    case 'property':
      body = `الوحدات المعروضة عندنا:\n${items.map(propertyText).join('\n')}`;
      actions = [{ label: '🏢 افتح قسم العقارات', href: '/real-estate' }];
      quickReplies = ['💳 حاسبة المقدم والأقساط', '👨‍💼 تحويل لمهندس العقارات'];
      break;
    case 'maintenance':
      body = items.slice(0, 2).map(maintenanceText).join('\n');
      actions = [{ label: '🛠️ قسم الصيانة والتنفيذ', href: '/sections/maintenance' }];
      quickReplies = ['🛠️ احجز معاينة للبند ده', '👨‍💼 تحويل لمهندس'];
      break;
    case 'guide':
      body = `من دليل التنفيذ الهندسي:\n${guideText(items[0])}`;
      actions = [{ label: '📚 دليل التنفيذ الكامل', href: '/sections/info' }];
      quickReplies = ['🛠️ عايز أنفذ البند ده', '👨‍💼 تحويل لمهندس'];
      break;
    case 'checklist': {
      const x = items[0];
      const lines = x.sec.groups.flatMap((g: any) => g.items).slice(0, 4).map((i: any) => `• ${clip(i.text, 150)}`).join('\n');
      body = `من قائمة التفقد الهندسية — **${x.sec.title}**:\n${lines}`;
      actions = [{ label: '📋 قائمة التفقد كاملة', href: '/sections/info' }];
      break;
    }
    case 'service':
      body = items.slice(0, 2).map((s: any) => `**${s.title}**\n${s.summary}\n${s.items.map((i: string) => `• ${i}`).join('\n')}`).join('\n\n');
      actions = [{ label: '🏗️ قسم المقاولات', href: '/sections/contracting' }];
      quickReplies = ['💰 تكلفة التشطيب', '👨‍💼 تحويل لمهندس'];
      break;
    case 'faq':
      body = items.slice(0, 2).map((f: any) => `**${f.q}**\n${f.a}`).join('\n\n');
      break;
    case 'project':
      body = `من أعمالنا:\n${items.map((p: any) => `• **${p.name}** — ${[p.kind, p.area, p.place, p.status].filter(Boolean).join(' • ')}`).join('\n')}`;
      break;
    case 'portal':
      body = items.map((p: any) => `${p.icon} **${p.title}**\n${p.guideHint}`).join('\n\n');
      actions = items.slice(0, 2).map((p: any) => ({ label: `${p.icon} ${p.title}`, href: p.href }));
      break;
    default:
      return null;
  }

  return {
    intent: 'site_knowledge',
    kind: top.kind,
    strong,
    howTo: howTo && (top.kind === 'guide' || top.kind === 'checklist'),
    replyText: `${body}${others.length ? `\n\nولقيت حاجات ليها علاقة في: ${others.join('، ')}.` : ''}`.slice(0, 1400),
    quickReplies,
    actions,
  };
}

/* ───────── ملخص الموقع للرد الذكي (Gemini) ───────── */

/** ملخص نصي لكل محتوى الموقع (~10 آلاف حرف) — مرجع الرد الذكي لما مفيش تطابق مباشر. */
export function buildSiteKnowledgeDigest(site?: KnowledgeSiteContent): string {
  const c = content(site);
  // A count-only cache kept old prices and policy answers after edits with the same item count.
  // Read the supplied published snapshot on every call rather than recycling unrelated content.
  const ct = site?.SITE?.contact || {};
  const L: string[] = [];
  L.push(`# الشركة\n${site?.SITE?.legalName || 'فاي تك'} — ${site?.SITE?.intro || ''}\nالمكاتب: ${(site?.SITE?.offices || []).join('، ')}\nالتليفون/واتساب: ${ct.phone || ''} • الإيميل: ${ct.email || ''} • المواعيد: ${ct.hours || ''}`);
  L.push(`# أقسام الموقع\n${PORTAL_SECTIONS.map((p) => `- ${p.title} (${p.href}): ${p.guideHint}`).join('\n')}\n- المتجر (/store)، العقارات (/real-estate)، دليل التنفيذ وقائمة التفقد والحاسبات الهندسية (/sections/info)`);
  if (c.services.length) L.push(`# الخدمات\n${c.services.map((s) => `- ${s.title}: ${s.summary} (${s.items.join('، ')})`).join('\n')}`);
  if (c.steps.length) L.push(`# خطوات التعامل\n${c.steps.map((s) => `${s.n}. ${s.title}: ${s.text}`).join('\n')}`);
  if (c.commitments.length) L.push(`# الالتزامات\n${c.commitments.map((s) => `- ${s.title}: ${s.text}`).join('\n')}`);
  if (c.faqs.length) L.push(`# أسئلة شائعة\n${c.faqs.map((f) => `- س: ${f.q}\n  ج: ${f.a}`).join('\n')}`);
  L.push(`# المتجر (${c.products.length} منتج)\n${c.products.map((p) => `- ${p.name} | ${catMeta(p.category)?.shortTitle || 'المنتجات'} | ${p.brand} | ${p.unit} | ${money(p.price, p.currency) || 'السعر حسب الكمية'}${money(p.installPrice, p.currency) ? ` | تركيب ${money(p.installPrice, p.currency)}` : ''} | ${p.inStock === false ? 'غير متوفر' : 'متوفر'} | ${clip(p.description, 110)}`).join('\n')}`);
  L.push(`# باقات السمارت هوم\n${SMART_BUNDLES.map((b) => `- ${b.title}: ${b.items.join('، ')}`).join('\n')}`);
  L.push(`# العقارات\n${c.properties.map((p) => `- ${p.title} | ${p.typeLabel} | ${p.city} | ${p.areaSqm} م² | ${p.bedrooms} غرف | ${p.finishingLabel} | ${p.deliveryLabel} | ${money(p.price, p.currency) || 'السعر عند الاستفسار'}${p.downPaymentPct ? ` | مقدم ${p.downPaymentPct}%` : ''}${p.installmentYears ? ` | تقسيط ${p.installmentYears} سنين` : ''} | ${STATUS[p.status] || p.status}`).join('\n')}`);
  L.push(`# الصيانة والتنفيذ\n${c.maintenance.map((m) => `- ${m.title} | الضمان: ${m.warrantyLabel} | ${money(m.visitFee, m.currency) ? `رسوم الزيارة ${money(m.visitFee, m.currency)}` : 'التسعير بعد المعاينة'} | ${clip(m.executionScope.join('، '), 160)}`).join('\n')}`);
  L.push(`# دليل التنفيذ\n${EXECUTION_GUIDE_ITEMS.map((g) => `- ${g.itemTitle} (${g.unit}): ${(g.executionSequence?.steps || []).map((s) => s.title).join(' ← ')}${g.approximatePricing?.totalRate ? ` | سعر استرشادي ${g.approximatePricing.totalRate}` : ''}`).join('\n')}`);
  L.push(`# قائمة التفقد\n${CHECKLIST.map((p) => `- ${p.title}: ${p.sections.map((s) => s.title).join('، ')}`).join('\n')}`);
  return replaceInternalCategoryLabels(L.join('\n\n'));
}
