/**
 * site-content.ts — كل نصوص وبيانات موقع فاي تك العام في مكان واحد.
 * عدّل هنا فقط؛ الموقع (PhiSite.tsx) بيقرأ من الملف ده.
 *
 * المصدر:
 *  - الاسم: هوية الشركة (نص ثابت).
 *  - الخدمات والمكاتب: نصوص صاحب الشركة من الموقع القديم (/website) بعد اختصارها.
 *  - الأعمال: تُضاف يدويًا من صفحة «إدارة الموقع» بعد موافقة العميل. لا تُنقل بيانات من السيستم الداخلي للموقع العام.
 *  - بيانات التواصل: مش موجودة في السيستم، فاتسابت فاضية. أي حقل فاضي بيتخفي من الموقع تلقائيًا.
 */

import {
  DEFAULT_PRODUCTS,
  DEFAULT_PROPERTIES,
  PRODUCT_CATEGORIES,
  type ProductCategoryId,
  type PropertyOfferType,
  type PropertyStatus,
  type WebsiteProduct,
  type WebsiteProperty,
} from './store-catalog';

export type Service = { id: string; title: string; summary: string; items: string[] };
export type Project = { name: string; kind: string; area: string; status: string; place?: string };
export type Commitment = { title: string; text: string };
export type Faq = { q: string; a: string };
export type PromoBannerConfig = { enabled: boolean; text: string };

export const SITE = {
  name: 'فاي تك',
  nameEn: 'PhiTech',
  legalName: 'فاي تك للمقاولات العامة والتشطيبات الفاخرة',
  tagline: 'مقاولات عامة وتشطيبات فاخرة',
  headline: 'نبني الهيكل، ونُتقن التشطيب، ونُنفّذ التأسيسات',
  intro:
    'منظومة مقاولات متكاملة بإشراف هندسي: من الأساسات والخرسانة إلى التشطيب المعماري والتكييف المخفي، ' +
    'تحت مسؤولية جهة تنفيذ واحدة ومتابعة واضحة في كل مرحلة.',
  offices: ['الرياض', 'القاهرة', 'المنصورة'],

  // املأ اللي عندك بس. اللي يفضل فاضي بيتخفي.
  contact: {
    phone: '+201558888744',
    whatsapp: '201558888744',
    email: 'phi.tech.eg@gmail.com',
    address: 'الرياض · القاهرة · المنصورة',
    hours: 'السبت – الخميس، 9 صباحاً – 9 مساءً',
  },
};

export const SERVICES: Service[] = [
  {
    id: 'structure',
    title: 'الإنشاءات والعظم',
    summary: 'هياكل خرسانية مسلحة للفلل والعمائر والأبراج، بدقة في المحاور وإشراف ميداني صارم.',
    items: [
      'الحفر والأساسات واللبشة المسلحة',
      'الأعمدة والكمرات والأسقف (فلات سلاب وهوردي)',
      'استلام المحاور بالليزر واختبارات الخرسانة',
      'المباني والعزل المائي والحراري',
    ],
  },
  {
    id: 'finishing',
    title: 'التشطيبات المعمارية الفاخرة',
    summary: 'نحوّل المساحات الخام إلى بيئة سكنية ومعمارية راقية، بتفاصيل دقيقة في الاستواء والخامات.',
    items: [
      'لياسة المساطر بالليزر وتربيع الغرف',
      'الأسقف المعلقة (جبس بورد وسمنت بورد) وإضاءة مخفية',
      'الرخام والبورسلان والتكسيات',
      'الدهانات والواجهات',
    ],
  },
  {
    id: 'mep',
    title: 'الكهروميكانيك والتكييف المخفي',
    summary: 'شبكات التكييف والسباكة والكهرباء تتأسس قبل التشطيب بمخططات تنفيذية دقيقة، فتبقى صامتة ومخفية.',
    items: [
      'التكييف المخفي ودكتات الهواء',
      'السباكة والتغذية والصرف',
      'الكهرباء والإنارة والتأسيس الذكي',
      'مخططات تنفيذية (Shop Drawings) قبل التنفيذ',
    ],
  },
];

export const STEPS = [
  { n: '01', title: 'المعاينة والمقايسة', text: 'نزور الموقع، نحدد نطاق العمل، ونقدّم مقايسة واضحة البنود.' },
  { n: '02', title: 'التخطيط والمخططات', text: 'مخططات تنفيذية تنسّق الإنشاء والتأسيسات والتشطيب قبل أول يوم عمل.' },
  { n: '03', title: 'التنفيذ بإشراف هندسي', text: 'مهندس مسؤول عن كل موقع، ومتابعة يومية للأعمال والعمالة والخامات.' },
  { n: '04', title: 'الفحص والتسليم', text: 'فحص نهائي للبنود مقابل المواصفة، ثم تسليم موثّق.' },
];

/** أعمال الموقع العام تُدار من صفحة «إدارة الموقع» داخل النظام، ولا تُسحب أبدًا من بيانات المشاريع الداخلية. */
export const PROJECTS: Project[] = [];

/** التزامات تشغيلية (وصف لطريقة العمل، مش أرقام إنجاز). راجعها وعدّلها لتطابق ما تلتزم به فعلًا. */
export const COMMITMENTS: Commitment[] = [
  { title: 'مخططات تنفيذية قبل التنفيذ', text: 'ننسّق الإنشاء والتأسيسات والتشطيب على الورق أولًا، فيقلّ التكسير وإعادة العمل في الموقع.' },
  { title: 'إشراف هندسي ميداني', text: 'مهندس مسؤول عن كل موقع، واستلام للمحاور والأعمال قبل الانتقال للمرحلة التالية.' },
  { title: 'فحص موثّق للبنود', text: 'قوائم فحص هندسية تُراجَع مقابل المواصفة المعتمدة للمشروع، وليس مقابل الانطباع.' },
  { title: 'متابعة رقمية شفافة', text: 'نتابع العمالة والمقايسات والمستخلصات على منظومة رقمية خاصة بنا، ولأصحاب المشاريع بوابة لمتابعة كشوف الحسابات.' },
];

/** مسودة أسئلة شائعة عن طريقة العمل. راجعها قبل النشر. */
export const FAQS: Faq[] = [
  { q: 'ماذا أحتاج لبدء المقايسة؟', a: 'موقع المشروع ومساحته ونوعه (فيلا، عمارة، تشطيب)، والمخططات إن وُجدت. وإن لم تتوفر المخططات نبدأ بالمعاينة وتحديد النطاق.' },
  { q: 'هل يمكن التعاقد على قطاع واحد فقط؟', a: 'يمكن مناقشة نطاق العمل حسب احتياج المشروع، سواء الهيكل أو التشطيب أو التأسيسات أو منظومة متكاملة.' },
  { q: 'كيف أتابع تنفيذ مشروعي؟', a: 'من خلال التقارير والمتابعة مع المهندس المسؤول، ولأصحاب المشاريع والشركاء بوابة دخول لمتابعة كشوف الحساب.' },
  { q: 'هل الأرقام في الأدوات الهندسية ملزمة؟', a: 'لا. هي تقديرات أولية للاسترشاد، والمقايسة النهائية تُعدّ بعد المعاينة والمخططات والمواصفات.' },
  { q: 'ما المقصود بنموذج BIM في الموقع؟', a: 'نموذج توضيحي مبسّط يشرح كيف تتداخل طبقات الهيكل والمباني والتأسيسات والتشطيبات، ويوضح أهمية التنسيق المبكر.' },
];

export const DEFAULT_PROMO_BANNER: PromoBannerConfig = {
  enabled: true,
  text: '✨ متجر فاي تك للتشطيبات والسمارت هوم وحساسات الأمان — اطلب التوريد والتركيب الهندسي المعتمد مباشرة لمشروعك',
};

/** ما يُدار من صفحة «إدارة الموقع» (website-admin). أي حقل غير موجود يرجع للقيمة الافتراضية أعلاه. */
export type SiteContentOverride = {
  site?: Partial<Omit<typeof SITE, 'contact' | 'offices'>> & { contact?: Partial<typeof SITE.contact>; offices?: string[] };
  projects?: Project[];
  commitments?: Commitment[];
  faqs?: Faq[];
  seo?: { title?: string; description?: string };
  products?: WebsiteProduct[];
  properties?: WebsiteProperty[];
  promoBanner?: Partial<PromoBannerConfig>;
};

const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : def;
};
const arr = <T,>(v: unknown, f: (x: any) => T | null, max = 30): T[] =>
  Array.isArray(v) ? (v.slice(0, max).map(f).filter(Boolean) as T[]) : [];

const VALID_CATS = new Set<string>(PRODUCT_CATEGORIES.map((c) => c.id));
const VALID_PROP_TYPES = new Set<string>(['apartment', 'duplex', 'villa', 'commercial', ' penthouse']);
const VALID_PROP_STATUS = new Set<string>(['available', 'reserved', 'sold']);

/** تنظيف المحتوى القادم من قاعدة البيانات: نصوص فقط بأطوال محدودة (يُعرض كنص عادي دائمًا). */
export function sanitizeContent(raw: any): SiteContentOverride {
  if (!raw || typeof raw !== 'object') return {};
  const out: SiteContentOverride = {};
  if (raw.site && typeof raw.site === 'object') {
    const s = raw.site, c = s.contact || {};
    out.site = {
      ...(str(s.name, 60) && { name: str(s.name, 60) }),
      ...(str(s.nameEn, 60) && { nameEn: str(s.nameEn, 60) }),
      ...(str(s.legalName, 160) && { legalName: str(s.legalName, 160) }),
      ...(str(s.tagline, 160) && { tagline: str(s.tagline, 160) }),
      ...(str(s.headline, 200) && { headline: str(s.headline, 200) }),
      ...(str(s.intro, 800) && { intro: str(s.intro, 800) }),
      ...(Array.isArray(s.offices) && { offices: arr(s.offices, (x) => str(x, 40) || null, 8) }),
      contact: { phone: str(c.phone, 40), whatsapp: str(c.whatsapp, 30), email: str(c.email, 120), address: str(c.address, 240), hours: str(c.hours, 120) },
    };
  }
  if (Array.isArray(raw.projects)) out.projects = arr(raw.projects, (p) => str(p?.name, 100) ? { name: str(p.name, 100), kind: str(p.kind, 120), area: str(p.area, 80), status: str(p.status, 60), place: str(p.place, 80) || undefined } : null);
  if (Array.isArray(raw.commitments)) out.commitments = arr(raw.commitments, (p) => str(p?.title, 100) ? { title: str(p.title, 100), text: str(p.text, 500) } : null, 12);
  if (Array.isArray(raw.faqs)) out.faqs = arr(raw.faqs, (p) => str(p?.q, 200) ? { q: str(p.q, 200), a: str(p.a, 1000) } : null, 20);
  if (raw.seo && typeof raw.seo === 'object') out.seo = { title: str(raw.seo.title, 120), description: str(raw.seo.description, 300) };

  if (Array.isArray(raw.products)) {
    out.products = arr<WebsiteProduct>(
      raw.products,
      (p) => {
        const name = str(p?.name, 160);
        if (!name) return null;
        const cat = VALID_CATS.has(String(p?.category)) ? (p.category as ProductCategoryId) : 'electrical';
        return {
          id: str(p?.id, 60) || `prod-${Math.random().toString(36).slice(2, 8)}`,
          code: str(p?.code, 40) || 'PHI-ITEM',
          name,
          category: cat,
          brand: str(p?.brand, 80) || 'PhiTech',
          unit: str(p?.unit, 40) || 'قطعة',
          price: num(p?.price, 0),
          oldPrice: p?.oldPrice ? num(p.oldPrice, 0) : undefined,
          installPrice: p?.installPrice !== undefined ? num(p.installPrice, 0) : undefined,
          currency: p?.currency === 'ر.س' ? 'ر.س' : 'ج.م',
          badge: str(p?.badge, 60) || undefined,
          description: str(p?.description, 600),
          specs: Array.isArray(p?.specs)
            ? p.specs.map((s: any) => str(s, 140)).filter(Boolean).slice(0, 8)
            : [],
          imageUrl: str(p?.imageUrl, 60000) || undefined,
          inStock: p?.inStock !== false,
          featured: Boolean(p?.featured),
        };
      },
      120
    );
  }

  if (Array.isArray(raw.properties)) {
    out.properties = arr<WebsiteProperty>(
      raw.properties,
      (p) => {
        const title = str(p?.title, 180);
        if (!title) return null;
        const type = VALID_PROP_TYPES.has(String(p?.type)) ? (p.type as PropertyOfferType) : 'apartment';
        const status = VALID_PROP_STATUS.has(String(p?.status)) ? (p.status as PropertyStatus) : 'available';
        return {
          id: str(p?.id, 60) || `prop-${Math.random().toString(36).slice(2, 8)}`,
          code: str(p?.code, 40) || 'PHI-UNIT',
          title,
          subtitle: str(p?.subtitle, 240),
          type,
          typeLabel: str(p?.typeLabel, 60) || 'وحدة عقارية',
          city: str(p?.city, 80) || 'القاهرة / المنصورة',
          location: str(p?.location, 160),
          areaSqm: num(p?.areaSqm, 150),
          bedrooms: num(p?.bedrooms, 3),
          bathrooms: num(p?.bathrooms, 2),
          floorLabel: str(p?.floorLabel, 80),
          finishingLabel: str(p?.finishingLabel, 120),
          deliveryLabel: str(p?.deliveryLabel, 80),
          price: num(p?.price, 0),
          oldPrice: p?.oldPrice ? num(p.oldPrice, 0) : undefined,
          downPaymentPct: p?.downPaymentPct !== undefined ? num(p.downPaymentPct, 0) : undefined,
          installmentYears: p?.installmentYears !== undefined ? num(p.installmentYears, 0) : undefined,
          currency: p?.currency === 'ر.س' ? 'ر.س' : 'ج.م',
          status,
          badge: str(p?.badge, 60) || undefined,
          features: Array.isArray(p?.features)
            ? p.features.map((f: any) => str(f, 180)).filter(Boolean).slice(0, 10)
            : [],
          imageUrl: str(p?.imageUrl, 60000) || undefined,
          featured: Boolean(p?.featured),
        };
      },
      60
    );
  }

  if (raw.promoBanner && typeof raw.promoBanner === 'object') {
    out.promoBanner = {
      enabled: raw.promoBanner.enabled !== false,
      text: str(raw.promoBanner.text, 300) || DEFAULT_PROMO_BANNER.text,
    };
  }

  return out;
}

export function mergeContent(o: SiteContentOverride = {}) {
  const rawContact = o.site?.contact || {};
  const mergedContact = {
    phone: rawContact.phone || SITE.contact.phone,
    whatsapp: rawContact.whatsapp || SITE.contact.whatsapp,
    email: rawContact.email || SITE.contact.email,
    address: rawContact.address || SITE.contact.address,
    hours: rawContact.hours || SITE.contact.hours,
  };
  const site = {
    ...SITE,
    ...(o.site || {}),
    contact: mergedContact,
    offices: o.site?.offices?.length ? o.site.offices : SITE.offices,
  };
  return {
    SITE: site,
    PROJECTS: o.projects ?? PROJECTS,
    COMMITMENTS: o.commitments ?? COMMITMENTS,
    FAQS: o.faqs ?? FAQS,
    PRODUCTS: o.products ?? DEFAULT_PRODUCTS,
    PROPERTIES: o.properties ?? DEFAULT_PROPERTIES,
    PROMO_BANNER: {
      enabled: o.promoBanner?.enabled ?? DEFAULT_PROMO_BANNER.enabled,
      text: o.promoBanner?.text ?? DEFAULT_PROMO_BANNER.text,
    },
  };
}
