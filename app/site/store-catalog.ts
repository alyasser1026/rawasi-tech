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
  | 'safety_sensors';

export interface ProductCategoryMeta {
  id: ProductCategoryId;
  title: string;
  shortTitle: string;
  icon: string;
  description: string;
  accent: string;
}

export interface WebsiteProduct {
  id: string;
  code: string;
  name: string;
  category: ProductCategoryId;
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
];

export const PRODUCT_STUDIO_IMAGES_BY_ID: Record<string, string> = {
  'el-01': '/products/crystal-switches.webp',
  'el-02': '/products/crystal-switches.webp',
  'el-03': '/products/crystal-switches.webp',
  'pl-01': '/products/concealed-plumbing.webp',
  'pl-02': '/products/concealed-plumbing.webp',
  'pl-03': '/products/concealed-plumbing.webp',
  'pt-01': '/products/paint-bucket.webp',
  'pt-02': '/products/paint-bucket.webp',
  'cr-01': '/products/calacatta-porcelain.webp',
  'cr-02': '/products/calacatta-porcelain.webp',
  'mr-01': '/products/quartz-marble-slab.webp',
  'mr-02': '/products/quartz-marble-slab.webp',
  'dc-01': '/products/quartz-marble-slab.webp',
  'dc-02': '/products/quartz-marble-slab.webp',
  'sm-01': '/products/smart-control-panel.webp',
  'sm-02': '/products/smart-door-lock.webp',
  'sm-03': '/products/crystal-switches.webp',
  'sm-04': '/products/smart-control-panel.webp',
  'lc-01': '/products/security-cameras-4k.webp',
  'lc-02': '/products/smart-control-panel.webp',
  'lc-03': '/products/smart-control-panel.webp',
  'sf-01': '/products/safety-shutoff-valve.webp',
  'sf-02': '/products/safety-shutoff-valve.webp',
  'sf-03': '/products/safety-shutoff-valve.webp',
};

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

const DEFAULT_PRODUCTS_RAW: WebsiteProduct[] = [
  // 1. كهرباء وإنارة
  {
    id: 'el-01',
    code: 'PHI-EL-101',
    name: 'طقم مفاتيح وأفياش زجاجي كريستال فاخر (10 قطع)',
    category: 'electrical',
    brand: 'PhiTech Luxe / Schneider Spec',
    unit: 'طقم (10 قطع)',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'الأكثر مبيعاً',
    description: 'إطار زجاجي مقسى مقاوم للخدش مع شاصيه معدن مجلفن ومخارج USB + Type-C سريعة الشحن.',
    specs: ['نحاس فوسفوري عالي التوصيل', 'مقاوم للحريق حتى 850 درجة', 'ضمان استبدال 10 سنوات'],
    inStock: true,
    featured: true,
  },
  {
    id: 'el-02',
    code: 'PHI-EL-102',
    name: 'تأسيس كابلات كهرباء سويدي أصلي معتمد (باقة شقة كاملة)',
    category: 'electrical',
    brand: 'El-Sewedy Original',
    unit: 'باقة (12 لفة متنوعة)',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'أصلي مضمون بالباركود',
    description: 'باقة أسلاك نحاس صافي معزول PVC تشمل مقاسات (1.5 مم، 2.5 مم، 4 مم، 6 مم) للإنارة والبرايز والتكييفات.',
    specs: ['شهادة مطابقة الكود المصري والسعودي', 'نحاس أحمر إلكتروليتي 99.9%', 'شامل الفحص بالباركود'],
    inStock: true,
  },
  {
    id: 'el-03',
    code: 'PHI-EL-103',
    name: 'بروفايل ليد ألومنيوم غاطس + شريط LED 240 لمبة/متر بالترانس',
    category: 'electrical',
    brand: 'PhiTech Lighting',
    unit: 'عود 3 متر كامل',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'إضاءة متصلة بدون نقط',
    description: 'قطاع ألومنيوم ثقيل لتبديد الحرارة مع غطاء ناشر للضوء وشريط ليد عالي الكثافة وترانس نحاس.',
    specs: ['إضاءة وورم 3000K أو طبيعي 4000K', 'عمر افتراضي 50,000 ساعة', 'شامل الترانس النحاس'],
    inStock: true,
  },

  // 2. سباكة وصحي
  {
    id: 'pl-01',
    code: 'PHI-PL-201',
    name: 'طقم صندوق طرد مدفون + مرحاض معلق بورسلان Rimless بغطاء هيدروليك',
    category: 'plumbing',
    brand: 'Grohe / Geberit Spec',
    unit: 'طقم متكامل',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'عرض خاص',
    description: 'شاصيه فولاذي يتحمل حتى 400 كجم مع خزان معزول ضد التكثف وضاغط كروم مطفي أو أسود.',
    specs: ['نظام شطف مزدوج موفر للمياه', 'تنظيف كامل بدون حواف Rimless', 'ضمان 10 سنوات على الخزان المدفون'],
    inStock: true,
    featured: true,
  },
  {
    id: 'pl-02',
    code: 'PHI-PL-202',
    name: 'خلاط دش مدفون 3 مخارج (طاسة مطرية + سماعة + شطاف) قلب نحاس',
    category: 'plumbing',
    brand: 'PhiTech Aqua',
    unit: 'طقم كامل',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'تشطيب فندقي',
    description: 'قلب دفن نحاس بالكامل مع بوكس حماية بلاستيكي ومسطرة تحكم ثيرموستاتية وطاسة مطرية 30×30 سم.',
    specs: ['طلاء PVD مقاوم للتقشير والأملاح', 'قلب سيراميك ألماني', 'متوفر: أسود مطفي / ذهبي مصقول / كروم'],
    inStock: true,
  },
  {
    id: 'pl-03',
    code: 'PHI-PL-203',
    name: 'باقة تأسيس مواسير تغذية PPR ألماني + صرف صامت لحمام ومطبخ',
    category: 'plumbing',
    brand: 'Banninger / Smart Home',
    unit: 'باقة تأسيس كاملة',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'شامل كبس الاختبار',
    description: 'مواسير وقطع تغذية مياه ساخن وبارد تتحمل ضغط 20 بار مع مواسير صرف معزولة صوتياً.',
    specs: ['شامل محابس الزاوية والدفن', 'اختبار ضغط 15 بار مع شهادة استلام', 'مقاوم للكلور والحرارة العالية'],
    inStock: true,
  },

  // 3. دهانات وعوازل
  {
    id: 'pt-01',
    code: 'PHI-PT-301',
    name: 'بستلة دهان جوتن فينوماستيك مذهل (Jotun Fenomastic Wonderwall) 18 لتر',
    category: 'paint',
    brand: 'Jotun Original',
    unit: 'بستلة 18 لتر',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'قابل للغسيل الفائق',
    description: 'دهان حوائط داخلي حريري فائق النعومة، قابل للغسيل المتكرر ومقاوم للبقع وعديم الرائحة.',
    specs: ['تغطية عالية (11 - 14 م²/لتر)', 'تلوين بالكمبيوتر لأي درجة في الكتالوج', 'صديق للبيئة ومضاد للبكتيريا'],
    inStock: true,
    featured: true,
  },
  {
    id: 'pt-02',
    code: 'PHI-PT-302',
    name: 'مجموعة عزل مائي أسمنتي مرن للحمامات والأسطح (شيكارتين A+B)',
    category: 'paint',
    brand: 'SikaTop Seal-107',
    unit: 'مجموعة 25 كجم',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'أساسي قبل السيراميك',
    description: 'عزل مائي أسمنتي بوليمري مركب من جزأين لحماية أرضيات الحمامات والمطابخ والأسطح والخزانات من التسرب.',
    specs: ['مرونة عالية لمقاومة التمدد', 'يلتصق بقوة بالخرسانة واللياسة', 'يكفي لعزل حمام قياسي وجهين متعامدين'],
    inStock: true,
  },

  // 4. سيراميك وبورسلان
  {
    id: 'cr-01',
    code: 'PHI-CR-401',
    name: 'بورسلان أرضيات قص ليزر 120×60 سم عروق كلكتا ذهبي (فرز أول)',
    category: 'ceramics',
    brand: 'Glaze Porcelain Slab',
    unit: 'متر مربع (م²)',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'بلاطات كبيرة فاخرة',
    description: 'بورسلان Full Body قص ليزر دقيق جداً يركب بصلاليب 1.5 مم بمظهر رخام كلكتا الإيطالي الفاخر.',
    specs: ['امتصاص مياه أقل من 0.05%', 'مقاوم للبري والأحماض والخدش', 'متوفر لامع (Polished) أو مطفي (Matt)'],
    inStock: true,
    featured: true,
  },
  {
    id: 'cr-02',
    code: 'PHI-CR-402',
    name: 'بورسلان باركيه خشبي 20×120 سم ملمس طبيعي مضاد للانزلاق',
    category: 'ceramics',
    brand: 'Royal / Cleopatra Elite',
    unit: 'متر مربع (م²)',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'دفء الخشب ومتانة البورسلان',
    description: 'شرائح بورسلان بملمس وعروق خشب البلوط الطبيعي، مثالية لغرف النوم والمعيشة والتراسات.',
    specs: ['قص ليزر حاد الحواف', 'لا يتأثر بالمياه أو الرطوبة', 'سهل التنظيف ولا يحتاج صيانة'],
    inStock: true,
  },

  // 5. رخام وجرانيت
  {
    id: 'mr-01',
    code: 'PHI-MR-501',
    name: 'توريد وتفصيل سطح مطبخ كوارتز / جرانيت جلاكسي أسود بفص ذهبي',
    category: 'marble',
    brand: 'PhiTech Stone Factory',
    unit: 'متر طولي (عرض 65 سم)',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'شامل التفتيح والحلية',
    description: 'جرانيت طبيعي هندي جلاكسي ستار أصلي سمك 2 سم مع تخانة دوبل 4 سم وتفتيح الحوض والبلت إن بالكمبيوتر.',
    specs: ['مقاوم للحرارة العالية والسكاكين', 'معالج بمواد عزل ضد البقع والزيوت', 'شامل الوزرة الخلفية وجلي الكريستال'],
    inStock: true,
    featured: true,
  },
  {
    id: 'mr-02',
    code: 'PHI-MR-502',
    name: 'درج سلم رخام إمبرادور / بريشيا (نائمة 4 سم + قائمة 2 سم + تلميع)',
    category: 'marble',
    brand: 'PhiTech Stone Factory',
    unit: 'متر طولي للدرجة',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'تفصيل بالليزر',
    description: 'درج رخام فاخر مع حلية ملفوفة (لف درفيل) وفرملة مانعة للانزلاق أو حفر ليد مخفي أسفل الدرجة.',
    specs: ['تجهيز مسبق لمجرى بروفايل الليد', 'معالجة بالإيبوكسي والـ UV', 'توريد وتركيب بميزان الليزر'],
    inStock: true,
  },

  // 6. ديكورات حديثة
  {
    id: 'dc-01',
    code: 'PHI-DC-601',
    name: 'لوح بديل الرخام الكوري UV عالي اللمعان (مقاس 122×280 سم سمك 3 مم)',
    category: 'decor',
    brand: 'PhiTech Decor PVC',
    unit: 'لوح (3.41 م²)',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'بديل عملي وسريع للرخام',
    description: 'ألواح PVC مدعمة بمسحوق الرخام وطبقة حماية UV لامعة، مثالية لخلفيات التلفزيون والمداخل والحمامات.',
    specs: ['مقاوم للماء والرطوبة والحشرات 100%', 'وزن خفيف وسهل التشكيل والتركيب بالسليكون', 'أكثر من 25 تصميم عروق رخامية'],
    inStock: true,
    featured: true,
  },
  {
    id: 'dc-02',
    code: 'PHI-DC-602',
    name: 'شريحة بديل الخشب المضلع WPC داخلي (ارتفاع 290 سم × عرض 17 سم)',
    category: 'decor',
    brand: 'PhiTech WPC',
    unit: 'شريحة (2.90 م طولي)',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'تصميم عصري',
    description: 'تكسيات بديل الخشب المضلع بتعشيق مخفي، تعطي فخامة التجاليد الخشبية الطبيعية مع مقاومة كاملة للرطوبة.',
    specs: ['ألوان: أوك طبيعي، جوزي داكن، رمادي، أسود', 'يركب مع بروفايل الليد وبديل الرخام', 'عمر افتراضي يتجاوز 15 عاماً'],
    inStock: true,
  },

  // 7. سمارت هوم وتحكم عن بعد
  {
    id: 'sm-01',
    code: 'PHI-SM-701',
    name: 'شاشة تحكم سمارت هوم مركزية 4 بوصة باللمس (Smart Control Panel + Alexa)',
    category: 'smart_home',
    brand: 'PhiTech Smart / Tuya Pro',
    unit: 'وحدة شاشة مركزية',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'تحكم كامل من مكان واحد',
    description: 'شاشة جدارية ذكية تحل محل مفتاح الإضاءة العادي (تركب على علبة ماجيك قياسية) وتتحكم في الإضاءة والتكييف والستائر والحساسات.',
    specs: ['بوابة Zigbee مدمجة لربط حتى 100 حساس ومفتاح', 'تطبيق جوال عربي وإنجليزي للتحكم من أي مكان بالعالم', 'دعم الأوامر الصوتية والسيناريوهات الذكية'],
    inStock: true,
    featured: true,
  },
  {
    id: 'sm-02',
    code: 'PHI-SM-702',
    name: 'قفل باب ذكي 6×1 (كاميرا + بصمة إصبع + وجه + كارت + رقم سري + تطبيق الجوال)',
    category: 'smart_home',
    brand: 'PhiTech Smart Lock Pro',
    unit: 'قفل ذكي شامل الكالون',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'يرسل صورة الزائر لجوالك',
    description: 'قفل مصفح أوتوماتيكي بكاميرا عين سحرية وشاشة داخلية، يرسل إشعاراً وصورة أي شخص يرن الجرس إلى جوالك مع إمكانية الفتح عن بُعد.',
    specs: ['بطارية ليثيوم قابلة للشحن تدوم 6 أشهر', 'إصدار باسورد مؤقت للضيوف أو العمال من الجوال', 'إنذار فوري عند محاولة العبث أو الإدخال الخاطئ'],
    inStock: true,
    featured: true,
  },
  {
    id: 'sm-03',
    code: 'PHI-SM-703',
    name: 'مفتاح إضاءة ذكي تاتش زجاجي (3 خطوط) Wi-Fi + تحكم بالجوال ومؤقت',
    category: 'smart_home',
    brand: 'PhiTech Smart Switch',
    unit: 'مفتاح ذكي 3 خط',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'يركب بدون تكسير',
    description: 'مفتاح لمس ذكي بإضاءة خلفية هادئة، يتيح تشغيل وإطفاء الإضاءة من الجوال أو ضبط جدول زمني تلقائي.',
    specs: ['يعمل بوجود أو بدون سلك نيوترال', 'يدعم Google Home و Alexa و Siri', 'زجاج مقسى ضد الصدمات والمياه'],
    inStock: true,
  },
  {
    id: 'sm-04',
    code: 'PHI-SM-704',
    name: 'وحدة تحكم ذكي بالتكييف والتلفزيون عن بُعد (Smart IR + Temperature Sensor)',
    category: 'smart_home',
    brand: 'PhiTech Smart',
    unit: 'جهاز تحكم ذكي',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'شغّل التكييف قبل وصولك للبيت',
    description: 'يحوّل أي تكييف عادي إلى تكييف ذكي مع حساس حرارة ورطوبة مدمج لضبط درجة حرارة الغرفة تلقائياً من جوالك.',
    specs: ['يدعم جميع ماركات التكييفات والشاشات', 'حساس حرارة ورطوبة مباشر على التطبيق', 'توفير استهلاك الكهرباء بالجدولة الذكية'],
    inStock: true,
  },

  // 8. تيار خفيف وشبكات وكاميرات
  {
    id: 'lc-01',
    code: 'PHI-LC-801',
    name: 'نظام 4 كاميرات مراقبة IP 4K رؤية ليلية ملونة + جهاز تسجيل NVR + هارد 2TB',
    category: 'low_current',
    brand: 'Hikvision / Dahua Pro Spec',
    unit: 'طقم متكامل (4 كاميرات + NVR)',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'متابعة حية من الجوال',
    description: 'منظومة مراقبة عالية الدقة بتقنية الذكاء الاصطناعي لتمييز الأشخاص والمركبات وإرسال تنبيه فوري للجوال.',
    specs: ['تصوير ليلي بالألوان الكاملة ColorVu', 'مقاومة للأمطار والأتربة IP67', 'شامل هارد ديسك مراقبة 2 تيرابايت وتغذية PoE'],
    inStock: true,
    featured: true,
  },
  {
    id: 'lc-02',
    code: 'PHI-LC-802',
    name: 'إنتركم مرئي ذكي IP شاشة تاتش 7 بوصة + لوحة باب بالكارت والتحكم من الجوال',
    category: 'low_current',
    brand: 'PhiTech Intercom IP',
    unit: 'طقم كامل',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'رد على الزائر وأنت خارج المنزل',
    description: 'إنتركم ديجيتال عالي الوضوح يحول مكالمة البوابة إلى جوالك بالصوت والصورة ويتيح فتح البوابة من التطبيق.',
    specs: ['كاميرا زاوية عريضة 160 درجة ورؤية ليلية', 'فتح البوابة بالكارت الممغنط أو الجوال أو الشاشة', 'تسجيل فيديو وصور الزوار تلقائياً'],
    inStock: true,
  },
  {
    id: 'lc-03',
    code: 'PHI-LC-803',
    name: 'نظام صوتي سقفي بلوتوث وواي فاي (أمبليفاير جداري تاتش + 4 سماعات سقفية)',
    category: 'low_current',
    brand: 'PhiTech Audio',
    unit: 'طقم (شاشة أمبليفاير + 4 سماعات)',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'صوت محيطي للريسبشن والفيلا',
    description: 'شاشة أمبليفاير أنيقة تركب في الحائط لتشغيل القرآن الكريم أو الموسيقى الهادئة عبر البلوتوث أو الفلاشة أو الواي فاي.',
    specs: ['4 سماعات سقفية Frameless غاطسة بالجبس بورد', 'صوت نقي بقدرة 4×25 واط RMS', 'ريموت كونترول + تحكم بالتطبيق'],
    inStock: true,
  },

  // 9. حساسات حريق وغاز ومياه وأمان
  {
    id: 'sf-01',
    code: 'PHI-SF-901',
    name: 'منظومة حساس تسرب غاز ذكي + محبس غلق غاز أوتوماتيكي (Auto Shut-off Valve)',
    category: 'safety_sensors',
    brand: 'PhiTech Safety Guard',
    unit: 'طقم (حساس غاز + محبس أوتوماتيكي)',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'حماية قصوى للمطبخ',
    description: 'بمجرد استشعار أي تسرب غاز طبيعي أو أنبوبة، يطلق الحساس صافرة إنذار قوية ويقفل محبس الغاز الرئيسي أوتوماتيكياً ويرسل تنبيهاً لجوالك.',
    specs: ['ذراع آلي يركب على محبس الغاز الحالي بدون تعديل المواسير', 'تنبيه فوري على تطبيق الجوال + سارينة 85 ديسيبل', 'زر اختبار ذاتي وتحكم بفتح/قفل الغاز عن بُعد'],
    inStock: true,
    featured: true,
  },
  {
    id: 'sf-02',
    code: 'PHI-SF-902',
    name: 'منظومة منع غرق الشقق والفلل (2 حساس تسرب مياه أرضي + محبس مياه رئيسي ذكي)',
    category: 'safety_sensors',
    brand: 'PhiTech AquaShield',
    unit: 'طقم (2 حساس مياه + محبس ذكي)',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'يمنع تلف التشطيبات والأثاث',
    description: 'يوضع الحساس تحت الحوض أو الغسالة أو السخان؛ وعند رصد أي قطرات مياه على الأرض يغلق محبس المياه الرئيسي فوراً وينبهك على الجوال.',
    specs: ['يقفل المياه في أقل من 5 ثوانٍ من بدء التسرب', 'حساسات لاسلكية مقاومة للماء IP67', 'يحمي الباركيه والجبس والدهانات من كوارث السباكة'],
    inStock: true,
    featured: true,
  },
  {
    id: 'sf-03',
    code: 'PHI-SF-903',
    name: 'حساس دخان وحريق ضوئي وحراري ذكي Wi-Fi (يرسل إنذاراً للجوال)',
    category: 'safety_sensors',
    brand: 'PhiTech FireAlert',
    unit: 'حساس دخان ذكي',
    price: 0,
    oldPrice: 0,
    installPrice: 0,
    currency: 'ج.م',
    badge: 'رصد مبكر 360°',
    description: 'كاشف دخان وحرارة كهروضوئي عالي الحساسية يركب بالسقف بدون تكسير أسلاك، ينبهك صوتياً وعلى جوالك فور رصد أي دخان.',
    specs: ['صافرة إنذار مدمجة 85dB + فلاش LED أحمر', 'بطارية تدوم حتى 3 سنوات مع تنبيه انخفاض البطارية', 'إمكانية ربطه بفصل الكهرباء تلقائياً عند الطوارئ'],
    inStock: true,
    featured: true,
  },
];

export const DEFAULT_PRODUCTS: WebsiteProduct[] = DEFAULT_PRODUCTS_RAW.map((p) => ({
  ...p,
  imageUrl: p.imageUrl || getProductImageUrl(p),
}));

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
    productIds: [
      { productId: 'sf-01', qty: 1 },
      { productId: 'sf-02', qty: 1 },
      { productId: 'sf-03', qty: 2 },
    ],
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
    productIds: [
      { productId: 'sm-01', qty: 1 },
      { productId: 'sm-02', qty: 1 },
      { productId: 'sm-03', qty: 4 },
      { productId: 'sm-04', qty: 2 },
    ],
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
