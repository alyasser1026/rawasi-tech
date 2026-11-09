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

export type Service = { id: string; title: string; summary: string; items: string[] };
export type Project = { name: string; kind: string; area: string; status: string; place?: string };
export type Commitment = { title: string; text: string };
export type Faq = { q: string; a: string };

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
    phone: '', // مثال: '+966 5X XXX XXXX'
    whatsapp: '', // أرقام فقط بكود الدولة، مثال: '9665XXXXXXXX'
    email: '', // مثال: 'info@yourdomain.com'
    address: '', // العنوان الرئيسي
    hours: '', // مثال: 'السبت – الخميس، 9 ص – 6 م'
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

/** ما يُدار من صفحة «إدارة الموقع» (website-admin). أي حقل غير موجود يرجع للقيمة الافتراضية أعلاه. */
export type SiteContentOverride = {
  site?: Partial<Omit<typeof SITE, 'contact' | 'offices'>> & { contact?: Partial<typeof SITE.contact>; offices?: string[] };
  projects?: Project[];
  commitments?: Commitment[];
  faqs?: Faq[];
  seo?: { title?: string; description?: string };
};

const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const arr = <T,>(v: unknown, f: (x: any) => T | null, max = 30): T[] =>
  Array.isArray(v) ? (v.slice(0, max).map(f).filter(Boolean) as T[]) : [];

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
  return out;
}

export function mergeContent(o: SiteContentOverride = {}) {
  const site = { ...SITE, ...(o.site || {}), contact: { ...SITE.contact, ...(o.site?.contact || {}) }, offices: o.site?.offices?.length ? o.site.offices : SITE.offices };
  return {
    SITE: site,
    PROJECTS: o.projects ?? PROJECTS,
    COMMITMENTS: o.commitments?.length ? o.commitments : COMMITMENTS,
    FAQS: o.faqs?.length ? o.faqs : FAQS,
  };
}
