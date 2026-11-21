/**
 * store-catalog.ts — كتالوج منتجات التشطيبات والأنظمة الذكية وعروض العقارات لموقع فاي تك (PhiTech)
 * يدعم 9 قطاعات هندسية متكاملة + باقات ذكية + عروض عقارية + تحكم كامل من لوحة الإدارة (/website-admin)
 */

export type ProductCategoryId =
  | 'electrical'
  | 'plumbing'
  | 'paint'
  | 'ceramics'
  | 'marble'
  | 'decor'
  | 'smart_home'
  | 'low_current'
  | 'safety_sensors'
  | 'hvac'
  | 'building_materials'
  | 'doors_windows'
  | 'appliances'
  | 'tools_hardware';

export interface ProductCategoryMeta {
  id: ProductCategoryId;
  title: string;
  shortTitle: string;
  icon: string;
  description: string;
  accent: string;
}

export interface StoreProductAttachment {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  kind?: 'image' | 'datasheet' | 'document';
}

export interface StoreProductVariant {
  name?: string;
  price?: number;
  sku?: string;
  color?: string;
  size?: string;
}

export interface WebsiteProduct {
  id: string;
  code: string;
  name: string;
  category: ProductCategoryId;
  subCategory?: string;
  brand: string;
  unit: string; // قطعة، م²، طقم، لفة، جالون، إلخ
  price: number;
  oldPrice?: number;
  installPrice?: number; // تكلفة التركيب الاختيارية لكل وحدة
  currency: 'ج.م' | 'ر.س';
  badge?: string; // عرض خاص، الأكثر مبيعاً، ضمان 10 سنوات، إلخ
  description: string;
  specs: string[];
  imageUrl?: string;
  mediaId?: string;
  attachments?: StoreProductAttachment[];
  variants?: StoreProductVariant[];
  cheapestSourceCount?: number;
  inStock: boolean;
  featured?: boolean;
}

export interface SmartBundle {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  price: number;
  oldPrice?: number;
  currency: 'ج.م' | 'ر.س';
  items: string[];
  productIds: { productId: string; qty: number }[];
}

export type PropertyOfferType = 'apartment' | 'duplex' | 'villa' | 'commercial' | ' penthouse';
export type PropertyStatus = 'available' | 'reserved' | 'sold';

export interface WebsiteProperty {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  type: PropertyOfferType;
  typeLabel: string;
  city: string;
  location: string;
  areaSqm: number;
  bedrooms: number;
  bathrooms: number;
  floorLabel: string;
  finishingLabel: string; // تشطيب فندقي الترا لوكس + سمارت، نصف تشطيب، إلخ
  deliveryLabel: string; // استلام فوري، استلام 2027، إلخ
  price: number;
  oldPrice?: number;
  downPaymentPct?: number;
  installmentYears?: number;
  currency: 'ج.م' | 'ر.س';
  status: PropertyStatus;
  badge?: string;
  features: string[];
  imageUrl?: string;
  featured?: boolean;
}

export interface WebsiteMaintenanceService {
  id: string;
  code: string;
  title: string;
  category: ProductCategoryId | 'hvac';
  icon: string;
  badge: string;
  executionScope: string[];
  maintenanceScope: string[];
  recommendation: string;
  warrantyLabel: string;
  visitFee: number;
  currency: 'ج.م' | 'ر.س';
  imageUrl?: string;
  available: boolean;
}

export const PRODUCT_CATEGORIES: ProductCategoryMeta[] = [
  {
    id: 'electrical',
    title: 'أدوات وتأسيسات الكهرباء والإنارة',
    shortTitle: 'كهرباء وإنارة',
    icon: '⚡',
    description: 'أسلاك وكابلات معتمدة، لوحات قواطع، مفاتيح وأفياش فاخرة، وبروفايلات ليد وإنارة معمارية مخفية.',
    accent: '#f59e0b',
  },
  {
    id: 'plumbing',
    title: 'أدوات وتأسيسات السباكة والأطقم الصحية',
    shortTitle: 'سباكة وصحي',
    icon: '🚰',
    description: 'مواسير تغذية حرارية وصرف صامت، خلاطات وصناديق طرد مدفونة، أطقم صحية معلقة، ومضخات مياه.',
    accent: '#0284c7',
  },
  {
    id: 'paint',
    title: 'الدهانات المعمارية والعوازل',
    shortTitle: 'دهانات وعوازل',
    icon: '🎨',
    description: 'دهانات داخلية قابلة للغسيل عديمة الرائحة، دهانات واجهات مقاومة للعوامل الجوية، وعوازل مائية وحرارية.',
    accent: '#8b5cf6',
  },
  {
    id: 'ceramics',
    title: 'السيراميك والبورسلان',
    shortTitle: 'سيراميك وبورسلان',
    icon: '🟫',
    description: 'بورسلان قص ليزر إسباني وهندي ومحلي، ألواح كبيرة (Large Slabs)، وسيراميك حوائط وأرضيات.',
    accent: '#d97706',
  },
  {
    id: 'marble',
    title: 'الرخام والجرانيت والأحجار الطبيعية',
    shortTitle: 'رخام وجرانيت',
    icon: '🪨',
    description: 'توريد وتفصيل الرخام المستورد والمصري للأرضيات والمداخل والدرج وأسطح المطابخ والمغاسل.',
    accent: '#475569',
  },
  {
    id: 'decor',
    title: 'الديكورات والتكسيات الحديثة',
    shortTitle: 'ديكورات حديثة',
    icon: '✨',
    description: 'بديل الرخام UV، بديل الخشب WPC الداخلي والخارجي، تجاليد الشيبورد، بانوهات الفوم، وورق الحائط.',
    accent: '#ec4899',
  },
  {
    id: 'smart_home',
    title: 'أجهزة السمارت هوم والتحكم عن بُعد',
    shortTitle: 'سمارت هوم وتحكم',
    icon: '📱',
    description: 'مفاتيح لمس ذكية Wi-Fi/Zigbee، أقفال أبواب ذكية بالبصمة والوجه، وتحكم كامل بالإنارة والتكييف والستائر من الجوال.',
    accent: '#10b981',
  },
  {
    id: 'low_current',
    title: 'أنظمة التيار الخفيف والشبكات',
    shortTitle: 'تيار خفيف وكاميرات',
    icon: '📡',
    description: 'كاميرات مراقبة IP 4K، إنتركم مرئي ذكي يفتح من الجوال، نقاط شبكات Wi-Fi 6 سقفية، وأنظمة صوتية (Sound System).',
    accent: '#3b82f6',
  },
  {
    id: 'safety_sensors',
    title: 'حساسات الحريق والغاز والمياه والأمان',
    shortTitle: 'حساسات حريق وغاز ومياه',
    icon: '🚨',
    description: 'حساسات دخان وحريق ذكية، حساسات تسرب غاز بمحبس فصل أوتوماتيكي، وحساسات تسرب مياه بمحبس غلق رئيسي ذكي.',
    accent: '#ef4444',
  },
  {
    id: 'hvac',
    title: 'التكييف والتهوية',
    shortTitle: 'تكييف وتهوية',
    icon: '❄️',
    description: 'تكييفات سبليت وإنفرتر ومخفي (Concealed) ومستلزمات التهوية وخطوط النحاس والعزل.',
    accent: '#0ea5e9',
  },
  {
    id: 'building_materials',
    title: 'مواد البناء والإنشاء والكيماويات',
    shortTitle: 'مواد بناء وعظم',
    icon: '🧱',
    description: 'الأسمنت والحديد والطوب وألواح الجبس بورد وكيماويات البناء ولوازم التأسيس والموان.',
    accent: '#b45309',
  },
  {
    id: 'doors_windows',
    title: 'الأبواب المصفحة والنوافذ والكوالين',
    shortTitle: 'أبواب ونوافذ',
    icon: '🚪',
    description: 'أبواب مصفحة وخشبية ونوافذ وكوالين أمان ومقابض وإكسسوارات الأبواب.',
    accent: '#7c3aed',
  },
  {
    id: 'appliances',
    title: 'الأجهزة المنزلية وتجهيزات المطابخ',
    shortTitle: 'أجهزة منزلية',
    icon: '🏠',
    description: 'سخانات مياه، شفاطات، بوتاجازات وأجهزة بلت إن وتجهيزات المطابخ والمنازل.',
    accent: '#0f766e',
  },
  {
    id: 'tools_hardware',
    title: 'العدد والأدوات ومستلزمات التشغيل',
    shortTitle: 'عدد وأدوات',
    icon: '🧰',
    description: 'العدد اليدوية والكهربائية ولوازم التركيب والربط والشريط اللاصق ومعدات الورش.',
    accent: '#64748b',
  },
];

export const PRODUCT_STUDIO_IMAGES_BY_ID: Record<string, string> = {};

export const PRODUCT_STUDIO_IMAGES_BY_CATEGORY: Record<ProductCategoryId, string> = {
  electrical: '/products/crystal-switches.webp',
  plumbing: '/products/concealed-plumbing.webp',
  paint: '/products/paint-bucket.webp',
  ceramics: '/products/calacatta-porcelain.webp',
  marble: '/products/quartz-marble-slab.webp',
  decor: '/products/quartz-marble-slab.webp',
  smart_home: '/products/smart-control-panel.webp',
  low_current: '/products/security-cameras-4k.webp',
  safety_sensors: '/products/safety-shutoff-valve.webp',
  hvac: '/sections/maintenance.jpg',
  building_materials: '/sections/contracting.jpg',
  doors_windows: '/products/smart-door-lock.webp',
  appliances: '/sections/real-estate.jpg',
  tools_hardware: '/sections/materials.jpg',
};

export function getProductImageUrl(
  product: Pick<WebsiteProduct, 'id' | 'category' | 'imageUrl'>
): string {
  return (
    product.imageUrl ||
    PRODUCT_STUDIO_IMAGES_BY_ID[product.id] ||
    PRODUCT_STUDIO_IMAGES_BY_CATEGORY[product.category] ||
    '/products/smart-control-panel.webp'
  );
}

export const LEGACY_DUMMY_PRODUCT_IDS = new Set<string>([
  'el-01', 'el-02', 'el-03',
  'pl-01', 'pl-02', 'pl-03',
  'pt-01', 'pt-02',
  'cr-01', 'cr-02',
  'mr-01', 'mr-02',
  'dc-01', 'dc-02',
  'sm-01', 'sm-02', 'sm-03', 'sm-04',
  'lc-01', 'lc-02', 'lc-03',
  'sf-01', 'sf-02', 'sf-03',
]);

export const DEFAULT_PRODUCTS: WebsiteProduct[] = [];

export const SMART_BUNDLES: SmartBundle[] = [
  {
    id: 'bundle-safety-shield',
    title: '🛡️ باقة الدرع الذكي (حماية شاملة ضد الحريق والغاز وغرق المياه)',
    subtitle: 'المنظومة الأكثر طلباً لحماية التشطيبات والأسرة على مدار الساعة مع تحكم وتنبيه فوري على الجوال',
    badge: 'باقة متكاملة',
    price: 0,
    oldPrice: 0,
    currency: 'ج.م',
    items: [
      'حساس تسرب غاز ذكي + محبس فصل غاز أوتوماتيكي للمطبخ',
      '2 حساس تسرب مياه أرضي (للحمام والمطبخ) + محبس غلق مياه رئيسي ذكي',
      '2 حساس دخان وحريق ضوئي ذكي Wi-Fi (للريسبشن والمطبخ/الطرقة)',
      'برمجة كاملة وربط بتطبيق الجوال لكل أفراد الأسرة',
    ],
    productIds: [],
  },
  {
    id: 'bundle-smart-apartment',
    title: '📱 باقة الشقة السمارت المتكاملة (تحكم ذكي وأمان فندقي)',
    subtitle: 'حوّل شقتك أو فيلتك إلى منزل ذكي بالكامل يعمل باللمس والأوامر الصوتية والجوال بدون تكسير',
    badge: 'باقة متكاملة',
    price: 0,
    oldPrice: 0,
    currency: 'ج.م',
    items: [
      'شاشة تحكم سمارت هوم مركزية 4 بوصة باللمس',
      'قفل باب ذكي 6×1 بالكاميرا والبصمة والفتح من الجوال',
      '4 مفاتيح إضاءة ذكية زجاجية تاتش (12 خط إضاءة)',
      '2 وحدة تحكم ذكي بالتكييفات والشاشات عن بُعد',
    ],
    productIds: [],
  },
];

export const DEFAULT_PROPERTIES: WebsiteProperty[] = [
  {
    id: 'prop-apt-205',
    code: 'PHI-UNIT-205',
    title: 'شقة ناصية فاخرة 205 م² — إطلالة بانورامية على الشارع الرئيسي',
    subtitle: 'الجناح الشرقي (Apartment 03) — تشطيب هندسي فندقي شامل باقة السمارت هوم وحساسات الأمان',
    type: 'apartment',
    typeLabel: 'شقة سكنية فاخرة',
    city: 'المنصورة / القاهرة',
    location: 'واجهة بحرية صريحة — برج فاي تك السكني التجاري',
    areaSqm: 205,
    bedrooms: 3,
    bathrooms: 3,
    floorLabel: 'متاح بالأدوار (الرابع، السابع، التاسع)',
    finishingLabel: 'تشطيب الترا لوكس + سمارت هوم كامل',
    deliveryLabel: 'جاهزة للمعاينة الهندسية',
    price: 0,
    oldPrice: 0,
    downPaymentPct: 25,
    installmentYears: 3,
    currency: 'ج.م',
    status: 'available',
    badge: 'شامل باقة سمارت هوم مجاناً',
    features: [
      'ريسبشن 3 قطع بواجهة زجاجية مزدوجة عازلة للصوت والحرارة',
      'جناح نوم ماستر بحمام خاص وغرفة ملابس (Dressing Room)',
      'تأسيس سباكة مدفونة Grohe وكهرباء سويدي أصلي بضمان 10 سنوات',
      'شامل منظومة حساسات الغاز والمياه والحريق وقفل الباب الذكي',
    ],
    featured: true,
  },
  {
    id: 'prop-apt-185',
    code: 'PHI-UNIT-185',
    title: 'شقة عائلية 185 م² — تقسيم هندسي ذكي بدون أي إهدار مساحات',
    subtitle: 'الجناح الأوسط (Apartment 02) — فصل كامل بين جناح الضيوف وجناح المعيشة والنوم',
    type: 'apartment',
    typeLabel: 'شقة سكنية',
    city: 'المنصورة / القاهرة',
    location: 'إطلالة مفتوحة — برج فاي تك السكني التجاري',
    areaSqm: 185,
    bedrooms: 3,
    bathrooms: 2,
    floorLabel: 'متاح بالأدوار (الثالث، السادس، العاشر)',
    finishingLabel: 'نصف تشطيب أو تشطيب كامل حسب الاختيار',
    deliveryLabel: 'استلام خلال 6 أشهر',
    price: 0,
    oldPrice: 0,
    downPaymentPct: 20,
    installmentYears: 4,
    currency: 'ج.م',
    status: 'available',
    badge: 'تسهيلات سداد حتى 4 سنوات',
    features: [
      '3 غرف نوم كبيرة + معيشة مستقلة + 2 حمام + مطبخ واسع',
      'استلام على المحارة بالليزر وحلوق ألوميتال قطاع جامبو',
      'إمكانية التعاقد على باقة التشطيب المتكامل بسعر التكلفة للملّاك',
      '2 مصعد فندقي سريع + مدخل رخام طبيعي وأمن وكاميرات 24 ساعة',
    ],
    featured: true,
  },
  {
    id: 'prop-apt-140',
    code: 'PHI-UNIT-140',
    title: 'شقة استثمارية / عرسان 140 م² — استغلال مثالي للمساحات',
    subtitle: 'الجناح الغربي (Apartment 01) — أفضل عائد استثماري وإيجاري بمواصفات هندسية قياسية',
    type: 'apartment',
    typeLabel: 'شقة سكنية / استثمارية',
    city: 'المنصورة / القاهرة',
    location: 'برج فاي تك السكني التجاري',
    areaSqm: 140,
    bedrooms: 2,
    bathrooms: 2,
    floorLabel: 'متاح بالأدوار (الثاني، الخامس، الثامن)',
    finishingLabel: 'تشطيب سوبر لوكس جاهز للسكن',
    deliveryLabel: 'استلام فوري',
    price: 0,
    oldPrice: 0,
    downPaymentPct: 30,
    installmentYears: 3,
    currency: 'ج.م',
    status: 'available',
    badge: 'فرصة استثمارية',
    features: [
      'غرفتين نوم مريحتين + ريسبشن قطعتين + 2 حمام + تراس',
      'أرضيات بورسلان قص ليزر 120×60 سم وأسقف جبس بورد بإضاءة مخفية',
      'عدادات مرافق كاملة (كهرباء، مياه، غاز) وحصة في الأرض والجراج',
    ],
  },
  {
    id: 'prop-duplex-340',
    code: 'PHI-DUP-340',
    title: 'دوبلكس فاخر 340 م² بحديقة خاصة ومدخل مستقل',
    subtitle: 'تصميم فيلا داخلية على مستويين بسلم رخام داخلي وتأسيس تكييف مخفي (Concealed)',
    type: 'duplex',
    typeLabel: 'دوبلكس بحديقة',
    city: 'القاهرة الجديدة / المنصورة',
    location: 'موقع متميز هادئ قريب من الخدمات الرئيسية',
    areaSqm: 340,
    bedrooms: 4,
    bathrooms: 4,
    floorLabel: 'أرضي مرتفع + أول علوي',
    finishingLabel: 'تشطيب الترا مودرن + سمارت هوم كامل',
    deliveryLabel: 'جاهز للاستلام',
    price: 0,
    oldPrice: 0,
    downPaymentPct: 35,
    installmentYears: 3,
    currency: 'ج.م',
    status: 'available',
    badge: 'وحدة وحيدة متميزة',
    features: [
      'الدور السفلي: استقبال فسيح + سفرة + مطبخ أوبن + حمام ضيوف + تراس حديقة',
      'الدور العلوي: 4 أجنحة نوم + ليفينج عائلي + أوفيس',
      'مؤمن بالكامل بكاميرات مراقبة 4K وحساسات غاز ومياه وحريق وشتر كهربائي',
    ],
    featured: true,
  },
  {
    id: 'prop-comm-95',
    code: 'PHI-COM-095',
    title: 'وحدة تجارية / معرض 95 م² بواجهة زجاجية مزدوجة الإرتفاع (Double Height)',
    subtitle: 'موقع استراتيجي بالأركيد التجاري — مثالي للعلامات التجارية والعيادات والمقرات الإدارية',
    type: 'commercial',
    typeLabel: 'تجاري / إداري',
    city: 'المنصورة / الرياض',
    location: 'الأركيد التجاري الرئيسي على الشارع العام',
    areaSqm: 95,
    bedrooms: 0,
    bathrooms: 1,
    floorLabel: 'الدور الأرضي التجاري + ميزانين',
    finishingLabel: 'واجهة زجاج سيكوريت + تأسيس كهروميكانيكي كامل',
    deliveryLabel: 'جاهز للتشغيل',
    price: 0,
    downPaymentPct: 40,
    installmentYears: 2,
    currency: 'ج.م',
    status: 'available',
    badge: 'عائد إيجاري مرتفع',
    features: [
      'واجهة عريضة 6.5 متر بارتفاع 5.5 متر تسمح بعمل ميزانين إضافي',
      'مجهز بشبكة إطفاء حريق وتكييف مركزي وقدرة كهربائية ثلاثية الأوجه (3-Phase)',
      'ساحة انتظار سيارات أمامية مباشرة لعملاء المعرض',
    ],
  },
];

export const DEFAULT_MAINTENANCE_SERVICES: WebsiteMaintenanceService[] = [
  {
    id: 'srv-electrical',
    code: 'PHI-MNT-01',
    title: 'تنفيذ وصيانة أعمال الكهرباء ولوحات التوزيع والإنارة',
    category: 'electrical',
    icon: '⚡',
    badge: 'استلام بالأفوميتر والميجر',
    executionScope: [
      'تمديد الخراطيم والسلك المعتمد (السويدي/بنسون) وتوزيع الأحمال المتوازن لكل غرفة',
      'تأسيس لوحات القواطع الفرعية والرئيسية مع قواطع التسريب الأرضي (ELCB/RCCB)',
      'توزيع الإضاءة المعمارية المخفية (ليد بروفايل، سبوت لايت، وتأسيس مفاتيح الديمر)',
    ],
    maintenanceScope: [
      'فحص وكشف أعطال القفلات وسخونة القواطع والكابلات بكاميرا التصوير الحراري',
      'معالجة تذبذب الجهد وفصل القواطع المتكرر واستبدال المفاتيح والبرايز التالفة',
      'صيانة لوحات التوزيع الرئيسية وإعادة ترتيب وتسمية القواطع (Circuit Labeling)',
    ],
    recommendation:
      'توصية فاي تك الهندسية: خصص دائماً خطاً مستقلاً بقطاع سلك 4–6 مم لكل تكييف وسخان، واحرص على تركيب قاطع تسريب أرضي (RCCB 30mA) في اللوحة وتأسيس سلك نيوترال داخل كل علبة مفتاح حتى تكون الوحدة جاهزة للسمارت هوم مستقبلاً دون تكسير.',
    warrantyLabel: 'ضمان هندسي على التأسيسات والربط',
    visitFee: 0,
    currency: 'ج.م',
    available: true,
  },
  {
    id: 'srv-plumbing',
    code: 'PHI-MNT-02',
    title: 'تنفيذ وصيانة السباكة والتغذية والصرف وكشف التسريبات',
    category: 'plumbing',
    icon: '🚰',
    badge: 'اختبار ضغط هيدروليكي موثّق',
    executionScope: [
      'تأسيس شبكات التغذية الحرارية (PPR) وصناديق الطرد والخلاطات المدفونة بالليزر',
      'تمديد مواسير الصرف الصامت بميول هندسية قياسية مع جريليات أرضية وعزل الحمامات',
      'اختبار الشبكة بالكامل بضغط هيدروليكي 10 بار مع تسليم شهادة ضمان معتمدة',
    ],
    maintenanceScope: [
      'كشف تسريبات المياه بدون تكسير ومعالجة الرطوبة خلف الحوائط والسيراميك',
      'صيانة واستبدال قلب الخلاطات المدفونة، ماكينات الطرد، ومضخات وبلوف عدم الراجع',
      'تسليك خطوط الصرف الرئيسية وتنظيف مصائد الدهون وفحص وصلات السخانات والفلاتر',
    ],
    recommendation:
      'توصية فاي تك الهندسية: لا تقبل إغلاق أي جدار قبل إجراء اختبار الضغط الهيدروليكي (10 بار لمدة 24 ساعة) وتصوير مسارات المواسير بالفيديو قبل اللياسة، وضع محبس غلق رئيسي سهل الوصول لكل حمام ومطبخ مع حساس تسريب مياه أسفل الحوض.',
    warrantyLabel: 'ضمان معتمد على التأسيس والعزل',
    visitFee: 0,
    currency: 'ج.م',
    available: true,
  },
  {
    id: 'srv-paint',
    code: 'PHI-MNT-03',
    title: 'تنفيذ وصيانة الدهانات المعمارية والعزل المائي والحراري',
    category: 'paint',
    icon: '🎨',
    badge: 'مضاد للرطوبة وقابل للغسيل',
    executionScope: [
      'التأسيس بعزل رطوبة ومعجون مقاوم للقلوية وسنفرة بالصاروخ مع إضاءة كاشفة للاستواء',
      'دهان بلاستيك مط أو ربع لمعة قابل للغسيل، أو دهانات ديكورية وواجهات خارجية مقاومة للشمس',
      'عزل الأسطح والحمامات (بيتوميني/إيبوكسي/أكريليك) مع اختبار غمر بالماء قبل التبليط',
    ],
    maintenanceScope: [
      'معالجة شروخ اللياسة وتقشّر الدهانات وتمليح الحوائط الناتج عن الرطوبة بأملاح عازلة',
      'تجديد وإعادة طلاء الغرف والمكاتب والواجهات دون فوضى مع تغطية الأثاث والأرضيات',
      'ترميم وإعادة تأهيل عزل الأسطح والخزانات ودرء تسرب مياه الأمطار',
    ],
    recommendation:
      'توصية فاي تك الهندسية: عند معالجة الرطوبة لا تكتفِ بسكينة معجون ووجه دهان؛ يجب كحت المنطقة المتضررة حتى الطوب/المحارة، ومعالجتها بمادة عازلة مسامية مقاومة للأملاح ثم إعادة التأسيس بدهان قابل للتنفس في الأماكن الرطبة.',
    warrantyLabel: 'ضمان ثبات اللون ومقاومة التقشّر',
    visitFee: 0,
    currency: 'ج.م',
    available: true,
  },
  {
    id: 'srv-ceramics',
    code: 'PHI-MNT-04',
    title: 'تركيب وصيانة السيراميك والبورسلان (قص ليزر وألواح كبيرة)',
    category: 'ceramics',
    icon: '🟫',
    badge: 'تركيب بالكلبسات والمادة اللاصقة',
    executionScope: [
      'أخذ مناسيب الشرب والزوايا بالليزر لتقليل الغلايق وضمان استقامة اللحامات',
      'تركيب البورسلان بالمادة اللاصقة المعتمدة (C2TE) واستخدام نظام الكلبسات وموازين التسوية',
      'سقية الفواصل بالإيبوكسي أو الجراوت المضاد للبكتيريا وتفريغ فواصل التمدد',
    ],
    maintenanceScope: [
      'علاج تطبيل أو خلع البلاط وحقن الفراغات أو استبدال البلاط المكسور بدقة دون تكسير المجاور',
      'إعادة سقية وفواصل الحمامات والمطابخ بجراوت إيبوكسي مقاوم للماء لمنع تسرب المياه',
      'ضبط ميول بلاط الشاور والبلكونات لمنع تجمّع المياه',
    ],
    recommendation:
      'توصية فاي تك الهندسية: البورسلان لا يركب أبداً بالأسمنت والماء العادي لأن امتصاصه للماء شبه معدوم فينفصل لاحقاً؛ استخدم دائماً مادة لاصقة مرنة من الفئة C2TE مع دهان ظهر البلاطة الكبيرة (Back-buttering) وترك فاصل تمدد 2 مم على الأقل.',
    warrantyLabel: 'ضمان استواء وتماسك التركيب',
    visitFee: 0,
    currency: 'ج.م',
    available: true,
  },
  {
    id: 'srv-marble',
    code: 'PHI-MNT-05',
    title: 'توريد وتركيب وجلي وصيانة الرخام والجرانيت',
    category: 'marble',
    icon: '🪨',
    badge: 'جلي وتلميع بالكريستال الإيطالي',
    executionScope: [
      'تقطيع وتركيب أرضيات الرخام وحلوق المصاعد والدرج وأسطح المطابخ (كوارتز/جرانيت) بأعلى دقة',
      'معالجة مسام الرخام وعزله قبل التركيب لحمايته من البقع والرطوبة السفلية',
      'عمل الوزرات الغاطسة والفواصل المعدنية (نحاس/ستانلس) بإحكام تام',
    ],
    maintenanceScope: [
      'جلي وتنعيم وتلميع أرضيات الرخام القديمة بالماسات المتدرجة والكريستال لإزالة الخدوش والبهتان',
      'معالجة الشروخ والحفر وتعبئتها بالجولي الملون المطابق لعروق الرخام الأصلي',
      'إعادة عزل أسطح الرخام (Sealing) في المطابخ والمغاسل ضد الزيوت والأحماض',
    ],
    recommendation:
      'توصية فاي تك الهندسية: بعد جلي الرخام بالكريستال يجب عمل طبقة حماية مسامية (Impregnating Sealer) كل 12–18 شهراً، والامتناع تماماً عن استخدام الكلور أو الخل أو الفلاش لأنها تذيب كربونات الكالسيوم وتفقد الرخام لمعانه فوراً.',
    warrantyLabel: 'ضمان احترافية التركيب والجلي',
    visitFee: 0,
    currency: 'ج.م',
    available: true,
  },
  {
    id: 'srv-decor',
    code: 'PHI-MNT-06',
    title: 'تنفيذ وصيانة الديكورات والجبس بورد وبدائل الخشب والرخام',
    category: 'decor',
    icon: '✨',
    badge: 'شاشييه مجلفن وألواح مقاومة للرطوبة',
    executionScope: [
      'تركيب أسقف الجبس بورد بالصاج المجلفن 0.6 مم وفتحات الصيانة (Access Panels) المخفية',
      'تنفيذ تجاليد بديل الخشب WPC وبديل الرخام UV والبانوهات وبيوت الستائر المخفية',
      'تقفيل اللحامات بشريط الفايبر وزوايا الميتال مع معالجة التمدد لضمان عدم التشرخ',
    ],
    maintenanceScope: [
      'إصلاح واستبدال ألواح الجبس المتضررة من تسريبات المياه أو تعديل التكييف وإعادة الدهان',
      'صيانة وتثبيت ألواح بديل الخشب والرخام المفكوكة وإصلاح شرائط الليد وبروفايل الإضاءة بداخلها',
      'تجديد ديكورات الجدران وإضافة مكتبات التلفزيون العصرية بتمديدات مخفية للكابلات',
    ],
    recommendation:
      'توصية فاي تك الهندسية: احرص على استخدام ألواح الجبس الأخضر المقاوم للرطوبة في المطابخ والحمامات، وضع دائماً فتحات صيانة مخفية أسفل ماكينات التكييف المخفي والمحابس السقفية حتى تتم الصيانة الدورية مستقبلاً دون تكسير السقف.',
    warrantyLabel: 'ضمان على التثبيت والشاسيه المعدني',
    visitFee: 0,
    currency: 'ج.م',
    available: true,
  },
  {
    id: 'srv-smarthome',
    code: 'PHI-MNT-07',
    title: 'برمجة وتنفيذ وصيانة أنظمة السمارت هوم والأقفال الذكية',
    category: 'smart_home',
    icon: '📱',
    badge: 'تحكم من الجوال بدون تكسير',
    executionScope: [
      'تركيب وبرمجة لوحات التحكم المركزية والمفاتيح الذكية ومواتير الستائر وأجهزة التحكم بالتكييف',
      'تركيب ومعايرة الأقفال الذكية (بصمة/وجه/كاميرا) وضبط سيناريوهات الدخول والخروج وتوفير الطاقة',
      'ربط المنزل كاملاً بشبكة Zigbee / Matter مستقرة وتطبيق الجوال للأوامر الصوتية',
    ],
    maintenanceScope: [
      'إعادة ربط وبرمجة الأجهزة الذكية عند تغيير الراوتر أو مزود الإنترنت وتحديث البرامج (Firmware)',
      'صيانة الأقفال الذكية، معايرة الكالون، وتبديل المواتير أو الحساسات الداخلية وفتح الطوارئ الآمن',
      'ترقية المنازل التقليدية إلى سمارت هوم باستخدام مفاتيح بدون نيوترال أو وحدات Relay مخفية داخل العلب',
    ],
    recommendation:
      'توصية فاي تك الهندسية: يفضّل تشغيل منظومة السمارت هوم على بروتوكول Zigbee عبر Hub مركزي متصل بسلك LAN بدلاً من تحميل 40 مفتاحاً مباشرة على شبكة Wi-Fi المنزلية؛ ذلك يمنح استجابة أسرع، واستهلاك طاقة أقل، واستمرار عمل الأزرار حتى عند انقطاع الإنترنت.',
    warrantyLabel: 'ضمان دعم فني وبرمجة شاملة',
    visitFee: 0,
    currency: 'ج.م',
    available: true,
  },
  {
    id: 'srv-lowcurrent',
    code: 'PHI-MNT-08',
    title: 'تنفيذ وصيانة التيار الخفيف (كاميرات 4K، إنتركم IP، شبكات، صوت)',
    category: 'low_current',
    icon: '📡',
    badge: 'تمديدات CAT6 نقية وبعيدة عن الكهرباء',
    executionScope: [
      'تمديد وتأريج نقاط الشبكات CAT6 والألياف الضوئية وكاميرات المراقبة PoE والراكات المركزية',
      'تركيب وحدات Wi-Fi 6 السقفية (Access Points) لتغطية 100% من أدوار الفيلا أو المقر',
      'تركيب أنظمة الإنتركم المرئي IP والأنظمة الصوتية السقفية وتوصيلها بتطبيق الجوال',
    ],
    maintenanceScope: [
      'فحص الكابلات وإصلاح انقطاع الكاميرات، أعطال الهارد ديسك، وإعادة ضبط العرض المباشر على الجوال',
      'معالجة ضعف تغطية الواي فاي وإعادة توزيع قنوات الشبكة (Mesh / Roaming) ومنع تداخل الإشارة',
      'صيانة شاشات الإنتركم والأبواب الإلكترونية ومضخمات الصوت السقفية',
    ],
    recommendation:
      'توصية فاي تك الهندسية: يجب عزل مسارات كابلات التيار الخفيف والشبكات في خراطيم مستقلة بمسافة لا تقل عن 20 سم عن كابلات الكهرباء القوية (220/380 فولت)، مع وضع وحدة UPS صغيرة في راك الشبكات لتبقى الكاميرات والإنترنت والسمارت هوم في الخدمة أثناء انقطاع التيار.',
    warrantyLabel: 'ضمان استقرار الشبكة والتسجيل',
    visitFee: 0,
    currency: 'ج.م',
    available: true,
  },
  {
    id: 'srv-safety',
    code: 'PHI-MNT-09',
    title: 'تأسيس وصيانة حساسات الحريق والغاز والمياه ومحبس الفصل التلقائي',
    category: 'safety_sensors',
    icon: '🚨',
    badge: 'حماية ذكية 24/7 + غلق تلقائي',
    executionScope: [
      'توزيع وتركيب حساسات الغاز في المطابخ وربطها ميكانيكياً وكهربائياً بمحبس الغلق الأوتوماتيكي',
      'تركيب حساسات تسرب المياه الأرضية أسفل الأحواض والغسالات وربطها بمحبس المياه الرئيسي الذكي',
      'تركيب كواشف الدخان والحرارة وضبط سيناريو الإنذار الصوتي والتنبيه الفوري على الجوال',
    ],
    maintenanceScope: [
      'فحص ومعايرة حساسات الغاز والدخان دورياً والتأكد من سرعة استجابة محبس الغلق الميكانيكي',
      'استبدال البطاريات أو الحساسات منتهية العمر الافتراضي واختبار سيناريوهات الطوارئ شهرياً',
      'صيانة صمامات الفصل الأوتوماتيكي وتنظيف مرشحات خط الغاز والمياه لمنع الانسداد',
    ],
    recommendation:
      'توصية فاي تك الهندسية: يُركّب حساس الغاز الطبيعي (الميثان الأخف من الهواء) أعلى الجدار على بُعد 30 سم من السقف، بينما يُركّب حساس أنابيب البوتاجاز (LPG الأثقل من الهواء) أسفل الجدار على ارتفاع 30 سم من الأرض، ويجب دائماً ربطه بمحبس فصل أوتوماتيكي وليس مجرد صافرة تنبيه.',
    warrantyLabel: 'ضمان الأداء وسرعة الاستجابة',
    visitFee: 0,
    currency: 'ج.م',
    available: true,
  },
  {
    id: 'srv-hvac',
    code: 'PHI-MNT-10',
    title: 'تأسيس وصيانة التكييف المخفي (Concealed) والاسبليت والتهوية',
    category: 'hvac',
    icon: '❄️',
    badge: 'نحاس أمريكي وعزل دكتات قياسي',
    executionScope: [
      'حساب الأحمال الحرارية وتمديد مواسير النحاس المعزولة (أمريكي) وخطوط صرف التكثيف المستقلة بالليزر',
      'تفصيل وتركيب دكتات الهواء (P3 / الصاج المعزول) والبوكسات والفتحات المخفية (Linear Slot)',
      'عمل اختبار الضغط بالنيتروجين وتفريغ الدائرة (Vacuum) قبل الشحن والتشغيل التجريبي',
    ],
    maintenanceScope: [
      'الصيانة الدورية والغسيل الكيميائي للوحدات الداخلية والخارجية وتنظيف مجاري الصرف لمنع تنقيط المياه',
      'كشف تسرب الفريون بالنيتروجين، لحام التسريبات، وإعادة شحن الفريون الأصلي بالميزان',
      'إصلاح الكباستور والكارتة الإلكترونية والضواغط وفحص توازن تدفق الهواء في الدكتات',
    ],
    recommendation:
      'توصية فاي تك الهندسية: لا تركب صرف التكييف داخل صفاية الحمام مباشرة بدون جراب مائي (P-Trap) حتى لا ترتد الروائح الكريهة إلى الغرفة، واحرص على اختبار مواسير النحاس بضغط النيتروجين 400 PSI قبل إغلاق السقف الجبسي وتنفيذ الصيانة والغسيل كل 6 أشهر للحفاظ على عمر الكمبريسور وتقليل فاتورة الكهرباء بنسبة 25%.',
    warrantyLabel: 'ضمان التأسيس وعدم التسريب',
    visitFee: 0,
    currency: 'ج.م',
    available: true,
  },
];
