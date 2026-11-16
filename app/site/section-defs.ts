export type SectionSlug =
  | 'maintenance'
  | 'contracting'
  | 'real-estate'
  | 'materials'
  | 'smart-home'
  | 'info';

export interface PortalSectionDef {
  slug: SectionSlug;
  num: string;
  icon: string;
  title: string;
  guideHint: string; // دلالة واضحة ومختصرة يفهمها العميل فوراً بدون تعقيد
  accent: string;
  href: `/sections/${SectionSlug}`;
  image: string;
  imageAlt: string;
  related: SectionSlug[];
  flowNote: string;
  highlights: [string, string, string];
}

export const PORTAL_SECTIONS: PortalSectionDef[] = [
  {
    slug: 'maintenance',
    num: '01',
    icon: '🛠️',
    title: 'قسم الصيانة والتنفيذ',
    guideHint: 'لو عندك عطل كهرباء أو سباكة أو تكييف، أو عاوز تنفذ بند محدد بضمان هندسي',
    accent: '#0284c7',
    href: '/sections/maintenance',
    image: '/sections/maintenance.jpg',
    imageAlt: 'فحص لوحات الكهرباء والتكييف المخفي وأنظمة الصيانة الهندسية الاحترافية',
    related: ['contracting', 'materials', 'smart-home'],
    flowNote: 'تشغيل وصيانة وضمان ما بعد التنفيذ',
    highlights: ['كهرباء وسباكة', 'تكييف مخفي', 'ضمان هندسي'],
  },
  {
    slug: 'contracting',
    num: '02',
    icon: '🏗️',
    title: 'قسم المقاولات',
    guideHint: 'لبناء العظم والتشطيب المتكامل للفلل والأبراج + حاسبة المقايسة والمجسم 3D',
    accent: '#c75517',
    href: '/sections/contracting',
    image: '/sections/contracting.jpg',
    imageAlt: 'مبنى معماري حديث من الخرسانة والزجاج يعبر عن مشاريع المقاولات والإنشاءات',
    related: ['maintenance', 'real-estate', 'materials', 'smart-home'],
    flowNote: 'العصب الإنشائي الرابط بين الخامات والتسليم',
    highlights: ['عظم وتشطيب', 'حاسبة المقايسة', 'مجسم 3D تفاعلي'],
  },
  {
    slug: 'real-estate',
    num: '03',
    icon: '🏢',
    title: 'قسم العقارات',
    guideHint: 'شقق تمليك فاخرة ودوبلكس ومعارض تجارية جاهزة + حاسبة المقدم والأقساط',
    accent: '#d97706',
    href: '/sections/real-estate',
    image: '/sections/real-estate.jpg',
    imageAlt: 'واجهة مشروع عقاري سكني فاخر بإضاءة مسائية ومسطحات خضراء',
    related: ['contracting', 'smart-home', 'info'],
    flowNote: 'ثمرات البناء الجاهزة للسكن والاستثمار',
    highlights: ['وحدات فاخرة', 'حاسبة الأقساط', 'معاينة فورية'],
  },
  {
    slug: 'materials',
    num: '04',
    icon: '🧱',
    title: 'قسم بيع وشراء مواد البناء',
    guideHint: 'اطلب دهانات وبورسلان ورخام وكابلات للموقع، أو اعرض خاماتك للبيع لدينا',
    accent: '#ea580c',
    href: '/sections/materials',
    image: '/sections/materials.jpg',
    imageAlt: 'معرض عينات مواد البناء والتشطيب من الرخام والبورسلان والأخشاب والإكسسوارات المعدنية',
    related: ['maintenance', 'contracting', 'smart-home'],
    flowNote: 'شريان الخامات المورّدة للمقاولات والصيانة',
    highlights: ['توريد للموقع', 'بيع وشراء خامات', 'تسعير مباشر'],
  },
  {
    slug: 'smart-home',
    num: '05',
    icon: '📱',
    title: 'قسم التكنولوجيا والسمارت هوم',
    guideHint: 'أقفال ببصمة، مفاتيح ذكية، كاميرات 4K، وحساسات غاز ومياه بتفصل تلقائياً',
    accent: '#059669',
    href: '/sections/smart-home',
    image: '/sections/smart-home.jpg',
    imageAlt: 'لوحة تحكم منزل ذكي زجاجية وقفل إلكتروني وإضاءة داخلية مؤتمتة',
    related: ['contracting', 'materials', 'real-estate', 'info'],
    flowNote: 'أتمتة وأمان ذكي يتكامل مع التأسيس والسكن',
    highlights: ['أقفال ومفاتيح ذكية', 'كاميرات 4K', 'حساسات أمان'],
  },
  {
    slug: 'info',
    num: '06',
    icon: '📚',
    title: 'قسم معلومات عامة',
    guideHint: 'نصائح هندسية قبل التشطيب، دليل التنفيذ والفحص، وحاسبات المهندس المجانية',
    accent: '#4f46e5',
    href: '/sections/info',
    image: '/sections/info.jpg',
    imageAlt: 'مكتب هندسي يضم مخططات معمارية وحاسوب لوحي لرسومات التصميم الهندسي',
    related: ['real-estate', 'smart-home', 'contracting'],
    flowNote: 'المرجع الهندسي قبل التعاقد والاستلام',
    highlights: ['نصائح تشطيب', 'دليل الفحص', 'حاسبات مجانية'],
  },
];

export const VALID_SECTION_SLUGS = new Set<string>(PORTAL_SECTIONS.map((s) => s.slug));
