export type SectionSlug =
  | 'maintenance'
  | 'contracting'
  | 'real-estate'
  | 'materials'
  | 'smart-home'
  | 'info';

export type CanonicalSectionSlug = 'contracting' | 'materials' | 'info';

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
    slug: 'contracting',
    num: '01',
    icon: '🏗️',
    title: 'قسم المقاولات والتنفيذ والصيانة',
    guideHint: 'لبناء العظم والتشطيب المتكامل، وتنفيذ وصيانة الكهرباء والسباكة والتكييف بضمان هندسي + حاسبة المقايسة والمجسم 3D',
    accent: '#c75517',
    href: '/sections/contracting',
    image: '/sections/contracting.jpg',
    imageAlt: 'مبنى معماري حديث من الخرسانة والزجاج يعبر عن مشاريع المقاولات والإنشاءات والتنفيذ الهندسي',
    related: ['materials', 'info'],
    flowNote: 'المقاولات والإنشاءات · التنفيذ والصيانة الهندسية',
    highlights: ['عظم وتشطيب ومقايسة 3D', 'تنفيذ وصيانة بضمان', 'كهرباء وسباكة وتكييف'],
  },
  {
    slug: 'materials',
    num: '02',
    icon: '🛍️',
    title: 'قسم المبيعات والسمارت هوم والعقارات',
    guideHint: 'بيع وشراء مواد البناء والتشطيبات، أنظمة السمارت هوم والأمان الذكي، والوحدات العقارية الجاهزة بالتقسيط',
    accent: '#059669',
    href: '/sections/materials',
    image: '/sections/materials.jpg',
    imageAlt: 'منظومة متكاملة لمواد البناء والسمارت هوم والعقارات من فاي تك',
    related: ['contracting', 'info'],
    flowNote: 'المبيعات ومواد البناء · السمارت هوم · العقارات',
    highlights: ['بيع وشراء مواد البناء', 'سمارت هوم وأمان ذكي', 'عقارات وحاسبة أقساط'],
  },
  {
    slug: 'info',
    num: '03',
    icon: '📚',
    title: 'قسم معلومات عامة',
    guideHint: 'نصائح هندسية قبل التشطيب، دليل التنفيذ والفحص، وحاسبات المهندس المجانية',
    accent: '#4f46e5',
    href: '/sections/info',
    image: '/sections/info.jpg',
    imageAlt: 'مكتب هندسي يضم مخططات معمارية وحاسوب لوحي لرسومات التصميم الهندسي',
    related: ['contracting', 'materials'],
    flowNote: 'المرجع الهندسي قبل التعاقد والاستلام',
    highlights: ['نصائح تشطيب', 'دليل الفحص', 'حاسبات مجانية'],
  },
];

export const VALID_SECTION_SLUGS = new Set<string>([
  'maintenance',
  'contracting',
  'real-estate',
  'materials',
  'smart-home',
  'info',
]);

export function resolveCanonicalSectionSlug(slug: SectionSlug): CanonicalSectionSlug {
  if (slug === 'maintenance' || slug === 'contracting') return 'contracting';
  if (slug === 'materials' || slug === 'smart-home' || slug === 'real-estate') return 'materials';
  return 'info';
}

export function getPortalSectionMeta(slug: SectionSlug): PortalSectionDef {
  const canonical = resolveCanonicalSectionSlug(slug);
  return PORTAL_SECTIONS.find((s) => s.slug === canonical) || PORTAL_SECTIONS[0];
}
