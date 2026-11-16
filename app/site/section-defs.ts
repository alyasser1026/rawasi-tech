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
  },
  {
    slug: 'contracting',
    num: '02',
    icon: '🏗️',
    title: 'قسم المقاولات',
    guideHint: 'لبناء العظم والتشطيب المتكامل للفلل والأبراج + حاسبة المقايسة والمجسم 3D',
    accent: '#c75517',
    href: '/sections/contracting',
  },
  {
    slug: 'real-estate',
    num: '03',
    icon: '🏢',
    title: 'قسم العقارات',
    guideHint: 'شقق تمليك فاخرة ودوبلكس ومعارض تجارية جاهزة + حاسبة المقدم والأقساط',
    accent: '#d97706',
    href: '/sections/real-estate',
  },
  {
    slug: 'materials',
    num: '04',
    icon: '🧱',
    title: 'قسم بيع وشراء مواد البناء',
    guideHint: 'اطلب دهانات وبورسلان ورخام وكابلات للموقع، أو اعرض خاماتك للبيع لدينا',
    accent: '#ea580c',
    href: '/sections/materials',
  },
  {
    slug: 'smart-home',
    num: '05',
    icon: '📱',
    title: 'قسم التكنولوجيا والسمارت هوم',
    guideHint: 'أقفال ببصمة، مفاتيح ذكية، كاميرات 4K، وحساسات غاز ومياه بتفصل تلقائياً',
    accent: '#059669',
    href: '/sections/smart-home',
  },
  {
    slug: 'info',
    num: '06',
    icon: '📚',
    title: 'قسم معلومات عامة',
    guideHint: 'نصائح هندسية قبل التشطيب، دليل التنفيذ والفحص، وحاسبات المهندس المجانية',
    accent: '#4f46e5',
    href: '/sections/info',
  },
];

export const VALID_SECTION_SLUGS = new Set<string>(PORTAL_SECTIONS.map((s) => s.slug));
