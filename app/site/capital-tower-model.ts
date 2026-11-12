export type TowerViewMode = 'exterior' | 'entrance' | 'typical' | 'apt01' | 'apt02' | 'apt03';
export type TowerLightingPreset = 'brochure' | 'daylight' | 'night';
export type UnitId = 'apt01' | 'apt02' | 'apt03';
export type ZoneOwner = UnitId | 'core';
export type BimLayerId = 'structure' | 'core' | 'masonry' | 'mep' | 'finish';

export interface ApartmentSpec {
  id: UnitId;
  code: string;
  title: string;
  enTitle: string;
  areaSqm: number;
  bedrooms: number;
  bathrooms: number;
  wingLabel: string;
  summary: string;
  features: string[];
  accent: string;
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
}

export interface RoomZoneSpec {
  id: string;
  owner: ZoneOwner;
  label: string;
  surface: 'parquet' | 'tile' | 'marble' | 'terrace' | 'lobby';
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface WallSegmentSpec {
  id: string;
  owner: ZoneOwner | 'exterior';
  x: number;
  z: number;
  w: number;
  d: number;
  kind: 'exterior' | 'partition' | 'glass' | 'balustrade';
}

export interface FurnitureItemSpec {
  owner: ZoneOwner;
  kind:
    | 'kingBed'
    | 'twinBed'
    | 'wardrobe'
    | 'nightstand'
    | 'sofa'
    | 'armchair'
    | 'coffeeTable'
    | 'diningSet'
    | 'tvConsole'
    | 'kitchenCounter'
    | 'tub'
    | 'toilet'
    | 'vanity'
    | 'bistroSet'
    | 'planter';
  x: number;
  z: number;
  rotY?: number;
  w?: number;
  d?: number;
}

export interface TowerSpecCard {
  id: string;
  title: string;
  ifc: string;
  layer: BimLayerId;
  code: string;
  category: string;
  material: string;
  executionNote: string;
  boqMetric: string;
  color: string;
}

export const TOWER_DIMS = {
  width: 19.2,
  depth: 27.6,
  podiumHeight: 4.3,
  floorHeight: 3.05,
  slabThickness: 0.24,
  wallHeight: 2.81,
  extWallThickness: 0.24,
  intWallThickness: 0.14,
  residentialFloors: 12,
  totalFloorsIncludingPodium: 13,
  gridX: [-9.35, -5.0, -0.4, 3.6, 9.35] as readonly number[],
  gridZ: [-13.55, -8.8, -3.4, 1.8, 7.2, 11.75] as readonly number[],
  wetStacks: [
    { id: 'stack-apt01', owner: 'apt01' as UnitId, x: -3.6, z: -5.4 },
    { id: 'stack-apt02', owner: 'apt02' as UnitId, x: -5.4, z: 2.0 },
    { id: 'stack-apt03', owner: 'apt03' as UnitId, x: 7.4, z: -3.8 },
  ],
} as const;

export const TOWER_TOTAL_HEIGHT =
  TOWER_DIMS.podiumHeight + TOWER_DIMS.residentialFloors * TOWER_DIMS.floorHeight;

export const CAPITAL_APARTMENTS: Record<UnitId, ApartmentSpec> = {
  apt01: {
    id: 'apt01',
    code: 'APT-01',
    title: 'شقة 01',
    enTitle: 'Apartment 01',
    areaSqm: 140,
    bedrooms: 3,
    bathrooms: 2,
    wingLabel: 'النموذج الخلفي الأوسط',
    summary: 'توزيع ذكي لثلاث غرف نوم وحمامين ومطبخ U مفتوح وصالة معيشة وسفرة لـ 6 أفراد بواجهة مضاءة.',
    features: [
      'غرفة ماستر رئيسية بدواليب مدمجة',
      'غرفتا نوم بسريرين وتوزيع عملي',
      'حمام رئيسي بالبانيو + حمام ضيوف مستقل',
      'مطبخ U-Shape متصل بممر الخدمة والريسيبشن',
      'صالة استقبال وسفرة 6 مقاعد بجوار قلب المصاعد',
    ],
    accent: '#f97316',
    cameraPos: [-3.2, 23.0, 2.5],
    cameraTarget: [-3.0, 0.5, -8.6],
  },
  apt02: {
    id: 'apt02',
    code: 'APT-02',
    title: 'شقة 02',
    enTitle: 'Apartment 02',
    areaSqm: 185,
    bedrooms: 3,
    bathrooms: 3,
    wingLabel: 'الجناح الأمامي الأيسر',
    summary: 'جناح أمامي رحب يضم 3 غرف نوم و3 حمامات وريسيبشن ممتد يتصل مباشرة بتراس بانورامي مزدوج.',
    features: [
      'ماستر أمامي بإطلالة مباشرة على الواجهة الرئيسية',
      'غرفتا نوم إضافيتان بإضاءة وتهوية طبيعية',
      '3 حمامات كاملة بأصاعد سباكة وعزل معتمدة',
      'ريسيبشن كبير (سفرة + صالون 6 مقاعد) مفتوح على التراس',
      'تراس أمامي بدرابزين زجاجي سيكوريت وأحواض زينة',
    ],
    accent: '#0ea5e9',
    cameraPos: [-5.2, 25.0, 19.5],
    cameraTarget: [-4.8, 0.5, 5.4],
  },
  apt03: {
    id: 'apt03',
    code: 'APT-03',
    title: 'شقة 03',
    enTitle: 'Apartment 03',
    areaSqm: 205,
    bedrooms: 3,
    bathrooms: 2,
    wingLabel: 'الجناح الأيمن البانورامي',
    summary: 'أكبر وحدات برج كابيتال بمساحة 205 م² مع جناح ماستر خلفي مستقل وريسيبشن L وتراس واجهة رئيسية.',
    features: [
      'جناح ماستر خلفي واسع مع ركن جلوس ودريسنج',
      'غرفتا نوم مستقلتان وممر توزيع معزول عن الضيوف',
      'مطبخ واسع وحمام رئيسي وحمام ضيوف بمناور خاصة',
      'ريسيبشن L فاخر بسفرة وصالون وتراس أمامي',
      'إطلالتان أمامية وخلفية مع أقصى استغلال للمساحة',
    ],
    accent: '#10b981',
    cameraPos: [7.8, 24.0, 18.0],
    cameraTarget: [4.8, 0.8, 1.5],
  },
};

export const TOTAL_NET_RESIDENTIAL_AREA =
  CAPITAL_APARTMENTS.apt01.areaSqm +
  CAPITAL_APARTMENTS.apt02.areaSqm +
  CAPITAL_APARTMENTS.apt03.areaSqm;

export const BIM_LAYERS: { id: BimLayerId; label: string; color: string }[] = [
  { id: 'structure', label: 'الهيكل الإنشائي واللبشة', color: '#8d949b' },
  { id: 'core', label: 'القلب الخرساني والمصاعد', color: '#d97706' },
  { id: 'masonry', label: 'المباني والتقطيع المعماري', color: '#d9c7a8' },
  { id: 'mep', label: 'التأسيسات والتكييف (MEP)', color: '#2f8fdc' },
  { id: 'finish', label: 'الواجهات والتشطيبات والفرش', color: '#c75517' },
];

export const TOWER_SPEC_CARDS: Record<string, TowerSpecCard> = {
  facade: {
    id: 'facade',
    title: 'واجهة برج كابيتال (تكسية حجر دافئ وإطارات برونز + سبوت معماري)',
    ifc: 'IfcCurtainWall / IfcCovering',
    layer: 'finish',
    code: 'FIN-EXT-CAP01',
    category: 'التشطيبات الخارجية والواجهات',
    material: 'تكسية ترافنتينو دافئ بالأدوار الوسطى + قطاعات ألومنيوم برونز داكن بالأدوار السفلى والتاج العلوي + إضاءة Up/Down LED',
    executionNote: 'تركيب شاسيهات التثبيت الميكانيكية (Dry-Fix) مع ضبط خيط الشاقول وإخفاء مخارج كابلات الإضاءة 24V خلف البروزات.',
    boqMetric: '≈ 2,840 م² مسطح واجهات',
    color: '#f97316',
  },
  podium: {
    id: 'podium',
    title: 'الأركيد التجاري الأرضي (THE ARCADE · MAISON D’OR · CAFÉ LUMIÈRE)',
    ifc: 'IfcWall / IfcWindow',
    layer: 'masonry',
    code: 'ARC-POD-02',
    category: 'البوديوم التجاري والواجهات السفلية',
    material: 'واجهات زجاج سيكوريت دبل بارتفاع 4.30 م في قطاعات برونز مطفي مع لافتات برونز مضيئة وممرات رخامية.',
    executionNote: 'فصل مداخل المحلات التجارية عن مسار دخول السكان مع تأمين تغذية التكييف المركزي وكابلات اللافتات.',
    boqMetric: 'ارتفاع حر 4.30 م · 3 واجهات تجارية',
    color: '#fb923c',
  },
  entrance: {
    id: 'entrance',
    title: 'المدخل الفندقي المودرن (Unique Modern Entrance)',
    ifc: 'IfcStairFlight / IfcCovering',
    layer: 'finish',
    code: 'FIN-LOB-03',
    category: 'المداخل والبهو الفندقي',
    material: 'درج رخام كلكتا بإضاءة مخفية أسفل الأنف (LED Treads) + أعمدة رخامية بأباليك خطية + إطارات مصاعد ستانلس برونزي.',
    executionNote: 'ضبط مناسيب الدرج مع مدخل الرامب وتأسيس علب استدعاء المصاعد والكاميرات قبل التكسية الرخامية.',
    boqMetric: '5 درجات رخامية + 2 مصعد مزدوج',
    color: '#eab308',
  },
  core: {
    id: 'core',
    title: 'القلب الإنشائي ومجموعة المصاعد المزدوجة والسلم',
    ifc: 'IfcTransportElement / IfcWall',
    layer: 'core',
    code: 'STR-CORE-04',
    category: 'القلب الخرساني والنقل الرأسي',
    material: 'حوائط قص خرسانية (Shear Core) بسماكة 30 سم تحيط ببئري مصاعد 1.85×2.0 م وسلالم هروب بقلب مزدوج.',
    executionNote: 'استلام رأسيّة بئر المصاعد بميزان الليزر (±1.5 سم كامل الارتفاع) وتركيب دلائل الحركة ومخمدات الحفرة.',
    boqMetric: '2 مصعد ركاب · 13 وقفة رأسية',
    color: '#f59e0b',
  },
  foundation: {
    id: 'foundation',
    title: 'اللبشة المسلحة والخوازيق الحاملة للبرج',
    ifc: 'IfcFooting / IfcPile',
    layer: 'structure',
    code: 'STR-FND-05',
    category: 'الأعمال التحتية والأساسات العميقة',
    material: 'لبشة خرسانية مسلحة بسماكة 90 سم بإجهاد 400 كجم/سم² ترتكز على خوازيق استراوس/CFA تحت الأعمدة والقلب.',
    executionNote: 'اختبار تكامل الخوازيق (PIT Test) وتجهيز فرشة النظافة والعزل المائي البيتوميني وحماية السطح قبل الصب.',
    boqMetric: '≈ 580 م³ خرسانة مسلحة',
    color: '#64748b',
  },
  column: {
    id: 'column',
    title: 'شبكة الأعمدة الخرسانية الحاملة (Grid A–E × 1–6)',
    ifc: 'IfcColumn',
    layer: 'structure',
    code: 'STR-COL-06',
    category: 'الهيكل الإنشائي العظم',
    material: 'أعمدة مستطيلة مزروعة في الحوائط الفاصلة (25×80 إلى 30×100 سم) لتجنب أي بروز داخل الغرف والصالات.',
    executionNote: 'ضبط الأشاير باستخدام كانة عيون والحفاظ على استقامة المحاور بين جميع الأدوار الـ12.',
    boqMetric: '30 عمود / دور × 13 مستوى',
    color: '#8d949b',
  },
  slab: {
    id: 'slab',
    title: 'البلاطات اللاكمرية (Flat Slab) وكوابيل التراسات',
    ifc: 'IfcSlab / IfcBeam',
    layer: 'structure',
    code: 'STR-SLB-07',
    category: 'الأسقف الخرسانية',
    material: 'سقف فلات سلاب بسماكة 24 سم مع كمر محيطي مقلوب عند التراسات لتقليل التعارض مع دكتات التكييف.',
    executionNote: 'تسليح شوكات الكوابيل عند البلكونات الأمامية (185 م² و 205 م²) وفحص الشدة المعدنية قبل كل صبة.',
    boqMetric: '≈ 530 م² مسطح الدور المتكرر',
    color: '#9ca3af',
  },
  wall: {
    id: 'wall',
    title: 'تقطيع المباني الداخلي والخارجي للوحدات الثلاث (140/185/205 م²)',
    ifc: 'IfcWall / IfcDoor',
    layer: 'masonry',
    code: 'ARC-WAL-08',
    category: 'أعمال المباني والقواطيع',
    material: 'طوب طفلي أو بلوك أسمنتي معزول صوتياً بين الشقق (25 سم) وقواطيع داخلية (12 سم) بأعتاب خرسانية.',
    executionNote: 'تشريك المباني مع الأعمدة بكانات مجلفنة وتطبيق شريط فايبر عند الالتقاءات قبل الطرطشة واللياسة.',
    boqMetric: '3 شقق متكاملة بكل دور متكرر',
    color: '#d9c7a8',
  },
  duct: {
    id: 'duct',
    title: 'شبكة دكتات التكييف المخفي ومخارج الهواء الخطية',
    ifc: 'IfcDuctSegment / IfcAirTerminal',
    layer: 'mep',
    code: 'MEP-HVC-09',
    category: 'أعمال التكييف والتهوية (HVAC)',
    material: 'صاج مجلفن معزول بالألياف الزجاجية أعلى ممرات الشقق الثلاث ومربوط على جريلات Linear Slot بالصالات والماستر.',
    executionNote: 'تنسيق منسوب قاع الدكت (2.60 م) أسفل البلاطة اللاكمرية وتأمين مسارات الصرف المعزولة (UPVC).',
    boqMetric: 'توزيع مركزي/كونسيلد للوحدات',
    color: '#0ea5e9',
  },
  pipe: {
    id: 'pipe',
    title: 'المناور الرأسية لصواعد المياه والصرف والحريق',
    ifc: 'IfcPipeSegment',
    layer: 'mep',
    code: 'MEP-PLM-10',
    category: 'الأعمال الصحية والسباكة (Plumbing)',
    material: 'مواسير تغذية PPR بضغط عالي ومواير صرف كاتم صوت ممتدة رأسياً في 3 مناور مخصصة لمطابخ وحمامات الشقق.',
    executionNote: 'اختبار الضغط الهيدروليكي حتى 10 بار مع عزل حمامات الأدوار بلفائف البيتومين قبل تأسيس البلاط.',
    boqMetric: '3 مناور خدمة رئيسية مستمرة',
    color: '#2563eb',
  },
  conduit: {
    id: 'conduit',
    title: 'صواعد الكهرباء والتيار الخفيف ولوحات الدور',
    ifc: 'IfcCableCarrierSegment / IfcElectricDistributionBoard',
    layer: 'mep',
    code: 'MEP-ELC-11',
    category: 'الأعمال الكهربائية والتحكم الذكي',
    material: 'كابلات مسلحة صاعدة داخل منور الكهرباء بجوار المصاعد تغذي 3 لوحات فرعية (شقة 01 / 02 / 03) بكل دور.',
    executionNote: 'فصل مسارات القوى عن كابلات الداتا والإنتركم والكاميرات مع اختبار مقاومة التأريض (< 2 أوم).',
    boqMetric: 'تغذية مستقلة 3 فاز للعدادات',
    color: '#facc15',
  },
  interiorFinish: {
    id: 'interiorFinish',
    title: 'تشطيبات الشقق (باركيه دافئ، رخام حمامات، درابزين سيكوريت)',
    ifc: 'IfcCovering / IfcRailing',
    layer: 'finish',
    code: 'FIN-INT-12',
    category: 'التشطيبات الداخلية الفاخرة',
    material: 'باركيه أوروبي دافئ بغرف النوم، بورسلين مصري/إسباني 60×120 بالريسيبشن، وأرضيات مانعة للانزلاق بالحمامات.',
    executionNote: 'تركيب الدرابزينات الزجاجية 12 مم للتراسات وتنفيذ ميزان الليزر لكافة الوزرات وأبواب الشقق المصفحة.',
    boqMetric: 'تشطيب سوبر لوكس / فندقي',
    color: '#fb7185',
  },
};

/** Room zones across one typical floor plate of برج كابيتال. */
export const TYPICAL_FLOOR_ZONES: readonly RoomZoneSpec[] = [
  // Apartment 01 — 140 m² (Back-Left / Center: X [-9.6..3.6], Z [-13.8..-3.4])
  { id: 'a1-master', owner: 'apt01', label: 'ماستر شقة 01', surface: 'parquet', x: -7.55, z: -11.3, w: 4.1, d: 5.0 },
  { id: 'a1-twin1', owner: 'apt01', label: 'غرفة أطفال 1', surface: 'parquet', x: -7.55, z: -6.1, w: 4.1, d: 5.4 },
  { id: 'a1-twin2', owner: 'apt01', label: 'غرفة نوم 2', surface: 'parquet', x: -3.85, z: -11.2, w: 3.3, d: 5.2 },
  { id: 'a1-baths', owner: 'apt01', label: 'حمامان', surface: 'tile', x: -3.85, z: -6.0, w: 3.3, d: 5.2 },
  { id: 'a1-kitchen', owner: 'apt01', label: 'مطبخ', surface: 'tile', x: -0.9, z: -11.2, w: 2.6, d: 5.2 },
  { id: 'a1-hall', owner: 'apt01', label: 'ممر شقة 01', surface: 'parquet', x: -0.9, z: -6.0, w: 2.6, d: 5.2 },
  { id: 'a1-living', owner: 'apt01', label: 'صالة وسفرة شقة 01', surface: 'parquet', x: 2.0, z: -8.6, w: 3.2, d: 10.4 },

  // Central Vertical Core: X [-0.8..3.6], Z [-3.4..1.8]
  { id: 'core-lobby', owner: 'core', label: 'بهو المصاعد والسلم', surface: 'lobby', x: 1.4, z: -0.8, w: 4.4, d: 5.2 },

  // Apartment 02 — 185 m² (Front-Left Wing)
  { id: 'a2-twin1', owner: 'apt02', label: 'غرفة نوم 1', surface: 'parquet', x: -7.3, z: -1.3, w: 4.6, d: 4.2 },
  { id: 'a2-bath1', owner: 'apt02', label: 'حمام رئيسي', surface: 'tile', x: -7.3, z: 2.3, w: 4.6, d: 3.0 },
  { id: 'a2-twin2', owner: 'apt02', label: 'غرفة نوم 2', surface: 'parquet', x: -7.3, z: 5.7, w: 4.6, d: 3.8 },
  { id: 'a2-bath2', owner: 'apt02', label: 'حمام 2', surface: 'tile', x: -7.3, z: 8.5, w: 4.6, d: 1.8 },
  { id: 'a2-master', owner: 'apt02', label: 'ماستر شقة 02', surface: 'parquet', x: -7.3, z: 11.6, w: 4.6, d: 4.4 },
  { id: 'a2-kitchen', owner: 'apt02', label: 'مطبخ وحمام ضيوف', surface: 'tile', x: -2.9, z: -1.5, w: 4.2, d: 3.8 },
  { id: 'a2-corridor', owner: 'apt02', label: 'موزع الغرف', surface: 'parquet', x: -2.9, z: 1.1, w: 4.2, d: 1.4 },
  { id: 'a2-reception', owner: 'apt02', label: 'ريسيبشن وسفرة 02', surface: 'parquet', x: -2.6, z: 6.8, w: 4.8, d: 10.0 },
  { id: 'a2-terrace', owner: 'apt02', label: 'تراس شقة 02', surface: 'terrace', x: -2.6, z: 12.8, w: 4.8, d: 2.0 },

  // Apartment 03 — 205 m² (Right Wing & Right-Center Front Bay)
  { id: 'a3-master', owner: 'apt03', label: 'جناح ماستر شقة 03', surface: 'parquet', x: 6.6, z: -11.3, w: 6.0, d: 5.0 },
  { id: 'a3-corridor', owner: 'apt03', label: 'ممر الغرف الخاص', surface: 'parquet', x: 4.25, z: -3.5, w: 1.3, d: 10.6 },
  { id: 'a3-twin1', owner: 'apt03', label: 'غرفة نوم 1', surface: 'parquet', x: 7.25, z: -6.9, w: 4.7, d: 3.8 },
  { id: 'a3-bath1', owner: 'apt03', label: 'حمام رئيسي', surface: 'tile', x: 7.25, z: -3.6, w: 4.7, d: 2.8 },
  { id: 'a3-twin2', owner: 'apt03', label: 'غرفة نوم 2', surface: 'parquet', x: 7.25, z: -0.2, w: 4.7, d: 4.0 },
  { id: 'a3-kitchen', owner: 'apt03', label: 'مطبخ وحمام ضيوف', surface: 'tile', x: 6.6, z: 3.8, w: 6.0, d: 4.0 },
  { id: 'a3-dining', owner: 'apt03', label: 'سفرة وصالون أيمن', surface: 'parquet', x: 7.2, z: 9.8, w: 4.8, d: 8.0 },
  { id: 'a3-reception', owner: 'apt03', label: 'ريسيبشن شقة 03', surface: 'parquet', x: 2.3, z: 6.8, w: 5.0, d: 10.0 },
  { id: 'a3-terrace', owner: 'apt03', label: 'تراس شقة 03', surface: 'terrace', x: 2.3, z: 12.8, w: 5.0, d: 2.0 },
];

const WT = TOWER_DIMS.extWallThickness;
const IT = TOWER_DIMS.intWallThickness;

/** Clean architectural wall segmentation aligning exterior bays and brochure rooms. */
export const TYPICAL_WALL_SEGMENTS: readonly WallSegmentSpec[] = [
  // Exterior Perimeter (Back Z = -13.8, Left X = -9.6, Right X = +9.6, Front Z = +13.8)
  // Back wall (-13.8)
  { id: 'ext-n1', owner: 'exterior', x: -7.5, z: -13.8, w: 4.2, d: WT, kind: 'exterior' },
  { id: 'ext-n2', owner: 'exterior', x: -2.2, z: -13.8, w: 2.2, d: WT, kind: 'exterior' },
  { id: 'ext-n3', owner: 'exterior', x: 2.0, z: -13.8, w: 3.2, d: WT, kind: 'exterior' },
  { id: 'ext-n4', owner: 'exterior', x: 7.2, z: -13.8, w: 4.8, d: WT, kind: 'exterior' },
  // Left wall (-9.6)
  { id: 'ext-w1', owner: 'exterior', x: -9.6, z: -11.3, w: WT, d: 5.0, kind: 'exterior' },
  { id: 'ext-w2', owner: 'exterior', x: -9.6, z: -5.8, w: WT, d: 4.6, kind: 'exterior' },
  { id: 'ext-w3', owner: 'exterior', x: -9.6, z: 0.4, w: WT, d: 6.0, kind: 'exterior' },
  { id: 'ext-w4', owner: 'exterior', x: -9.6, z: 6.8, w: WT, d: 5.0, kind: 'exterior' },
  { id: 'ext-w5', owner: 'exterior', x: -9.6, z: 11.8, w: WT, d: 4.0, kind: 'exterior' },
  // Right wall (+9.6)
  { id: 'ext-e1', owner: 'exterior', x: 9.6, z: -11.3, w: WT, d: 5.0, kind: 'exterior' },
  { id: 'ext-e2', owner: 'exterior', x: 9.6, z: -5.2, w: WT, d: 5.4, kind: 'exterior' },
  { id: 'ext-e3', owner: 'exterior', x: 9.6, z: 1.8, w: WT, d: 6.6, kind: 'exterior' },
  { id: 'ext-e4', owner: 'exterior', x: 9.6, z: 9.8, w: WT, d: 8.0, kind: 'exterior' },

  // Front Street Facade (+Z): outer masonry piers + twin glass terrace sliders (z=11.8) + balustrades (z=13.8)
  { id: 'ext-s-pierL', owner: 'exterior', x: -9.35, z: 13.8, w: 0.7, d: WT, kind: 'exterior' },
  { id: 'ext-s-winL', owner: 'exterior', x: -7.3, z: 13.8, w: 3.4, d: 0.08, kind: 'glass' },
  { id: 'ext-s-pierML', owner: 'exterior', x: -5.0, z: 12.8, w: WT, d: 2.2, kind: 'exterior' },
  { id: 'ext-s-balL', owner: 'apt02', x: -2.6, z: 13.8, w: 4.6, d: 0.08, kind: 'balustrade' },
  { id: 'ext-s-slideL', owner: 'apt02', x: -2.6, z: 11.8, w: 4.5, d: 0.08, kind: 'glass' },
  { id: 'ext-s-pierC', owner: 'exterior', x: -0.2, z: 12.8, w: 0.28, d: 2.2, kind: 'exterior' },
  { id: 'ext-s-balR', owner: 'apt03', x: 2.3, z: 13.8, w: 4.8, d: 0.08, kind: 'balustrade' },
  { id: 'ext-s-slideR', owner: 'apt03', x: 2.3, z: 11.8, w: 4.7, d: 0.08, kind: 'glass' },
  { id: 'ext-s-pierMR', owner: 'exterior', x: 4.8, z: 12.8, w: WT, d: 2.2, kind: 'exterior' },
  { id: 'ext-s-winR', owner: 'exterior', x: 7.2, z: 13.8, w: 3.6, d: 0.08, kind: 'glass' },
  { id: 'ext-s-pierR', owner: 'exterior', x: 9.35, z: 13.8, w: 0.7, d: WT, kind: 'exterior' },

  // Unit Boundary Separation Walls (party walls between Apt 01, Core, Apt 02, Apt 03)
  { id: 'party-a1-a2', owner: 'apt01', x: -5.2, z: -3.4, w: 8.8, d: IT + 0.06, kind: 'partition' },
  { id: 'party-a1-a3', owner: 'apt01', x: 3.6, z: -8.6, w: IT + 0.06, d: 10.4, kind: 'partition' },
  { id: 'party-a2-a3', owner: 'apt02', x: -0.2, z: 6.8, w: IT + 0.06, d: 10.0, kind: 'partition' },
  { id: 'core-w-n', owner: 'core', x: 0.5, z: -3.4, w: 2.6, d: IT + 0.06, kind: 'partition' },
  { id: 'core-w-l', owner: 'core', x: -0.8, z: -0.8, w: IT + 0.06, d: 5.2, kind: 'partition' },
  { id: 'core-w-s', owner: 'core', x: 1.4, z: 1.8, w: 4.4, d: IT + 0.06, kind: 'partition' },
  { id: 'core-w-r', owner: 'core', x: 3.6, z: -1.4, w: IT + 0.06, d: 4.0, kind: 'partition' },

  // Apartment 01 Interior Partitions
  { id: 'p-a1-1', owner: 'apt01', x: -5.5, z: -11.3, w: IT, d: 5.0, kind: 'partition' },
  { id: 'p-a1-2', owner: 'apt01', x: -7.55, z: -8.8, w: 3.2, d: IT, kind: 'partition' },
  { id: 'p-a1-3', owner: 'apt01', x: -2.2, z: -10.8, w: IT, d: 5.6, kind: 'partition' },
  { id: 'p-a1-4', owner: 'apt01', x: -3.85, z: -8.6, w: 2.5, d: IT, kind: 'partition' },
  { id: 'p-a1-5', owner: 'apt01', x: 0.4, z: -11.4, w: IT, d: 4.6, kind: 'partition' },
  { id: 'p-a1-6', owner: 'apt01', x: 0.4, z: -5.4, w: IT, d: 3.6, kind: 'partition' },

  // Apartment 02 Interior Partitions
  { id: 'p-a2-1', owner: 'apt02', x: -5.0, z: 7.4, w: IT, d: 9.0, kind: 'partition' },
  { id: 'p-a2-2', owner: 'apt02', x: -7.3, z: 0.8, w: 3.8, d: IT, kind: 'partition' },
  { id: 'p-a2-3', owner: 'apt02', x: -7.3, z: 3.8, w: 3.8, d: IT, kind: 'partition' },
  { id: 'p-a2-4', owner: 'apt02', x: -7.3, z: 7.6, w: 3.8, d: IT, kind: 'partition' },
  { id: 'p-a2-5', owner: 'apt02', x: -7.3, z: 9.4, w: 3.8, d: IT, kind: 'partition' },
  { id: 'p-a2-6', owner: 'apt02', x: -2.9, z: 0.4, w: 3.6, d: IT, kind: 'partition' },
  { id: 'p-a2-7', owner: 'apt02', x: -5.0, z: -1.5, w: IT, d: 3.2, kind: 'partition' },

  // Apartment 03 Interior Partitions
  { id: 'p-a3-1', owner: 'apt03', x: 6.6, z: -8.8, w: 5.0, d: IT, kind: 'partition' },
  { id: 'p-a3-2', owner: 'apt03', x: 4.9, z: -4.2, w: IT, d: 8.6, kind: 'partition' },
  { id: 'p-a3-3', owner: 'apt03', x: 7.25, z: -5.0, w: 4.2, d: IT, kind: 'partition' },
  { id: 'p-a3-4', owner: 'apt03', x: 7.25, z: -2.2, w: 4.2, d: IT, kind: 'partition' },
  { id: 'p-a3-5', owner: 'apt03', x: 6.6, z: 1.8, w: 5.6, d: IT, kind: 'partition' },
  { id: 'p-a3-6', owner: 'apt03', x: 6.8, z: 5.8, w: 4.6, d: IT, kind: 'partition' },
  { id: 'p-a3-7', owner: 'apt03', x: 4.8, z: 9.2, w: IT, d: 6.2, kind: 'partition' },
];

/** Detailed brochure-matched 3D furniture pieces per apartment. */
export const TYPICAL_FURNITURE: readonly FurnitureItemSpec[] = [
  // Apartment 01 (140 m²)
  { owner: 'apt01', kind: 'kingBed', x: -8.1, z: -11.4, rotY: Math.PI / 2 },
  { owner: 'apt01', kind: 'nightstand', x: -9.1, z: -10.1 },
  { owner: 'apt01', kind: 'nightstand', x: -9.1, z: -12.7 },
  { owner: 'apt01', kind: 'wardrobe', x: -6.2, z: -13.3, w: 1.8, d: 0.6 },
  { owner: 'apt01', kind: 'twinBed', x: -8.4, z: -5.8, rotY: 0 },
  { owner: 'apt01', kind: 'twinBed', x: -6.6, z: -5.8, rotY: 0 },
  { owner: 'apt01', kind: 'wardrobe', x: -7.5, z: -3.8, w: 2.0, d: 0.55 },
  { owner: 'apt01', kind: 'planter', x: -9.0, z: -4.0 },
  { owner: 'apt01', kind: 'twinBed', x: -3.9, z: -12.5, rotY: -Math.PI / 2 },
  { owner: 'apt01', kind: 'twinBed', x: -3.9, z: -10.5, rotY: -Math.PI / 2 },
  { owner: 'apt01', kind: 'wardrobe', x: -3.8, z: -9.1, w: 2.1, d: 0.55 },
  { owner: 'apt01', kind: 'tub', x: -4.4, z: -4.1, rotY: Math.PI / 2 },
  { owner: 'apt01', kind: 'toilet', x: -4.5, z: -5.7, rotY: Math.PI / 2 },
  { owner: 'apt01', kind: 'vanity', x: -4.5, z: -7.2, rotY: Math.PI / 2 },
  { owner: 'apt01', kind: 'toilet', x: -2.8, z: -5.0, rotY: -Math.PI / 2 },
  { owner: 'apt01', kind: 'kitchenCounter', x: -0.9, z: -11.8, w: 2.1, d: 2.8 },
  { owner: 'apt01', kind: 'sofa', x: 2.0, z: -12.1, rotY: 0 },
  { owner: 'apt01', kind: 'coffeeTable', x: 2.0, z: -10.7 },
  { owner: 'apt01', kind: 'armchair', x: 1.3, z: -9.6, rotY: Math.PI },
  { owner: 'apt01', kind: 'armchair', x: 2.7, z: -9.6, rotY: Math.PI },
  { owner: 'apt01', kind: 'diningSet', x: 2.0, z: -6.2, rotY: 0 },

  // Apartment 02 (185 m²)
  { owner: 'apt02', kind: 'twinBed', x: -8.3, z: -2.0, rotY: 0 },
  { owner: 'apt02', kind: 'twinBed', x: -6.3, z: -2.0, rotY: 0 },
  { owner: 'apt02', kind: 'wardrobe', x: -7.3, z: 0.2, w: 2.2, d: 0.55 },
  { owner: 'apt02', kind: 'tub', x: -8.6, z: 2.3, rotY: 0 },
  { owner: 'apt02', kind: 'toilet', x: -6.8, z: 2.9, rotY: Math.PI },
  { owner: 'apt02', kind: 'vanity', x: -5.6, z: 2.2, rotY: -Math.PI / 2 },
  { owner: 'apt02', kind: 'twinBed', x: -8.2, z: 5.5, rotY: 0 },
  { owner: 'apt02', kind: 'twinBed', x: -6.3, z: 5.5, rotY: 0 },
  { owner: 'apt02', kind: 'toilet', x: -8.4, z: 8.5, rotY: Math.PI / 2 },
  { owner: 'apt02', kind: 'vanity', x: -6.5, z: 8.5, rotY: Math.PI },
  { owner: 'apt02', kind: 'kingBed', x: -8.1, z: 11.4, rotY: Math.PI / 2 },
  { owner: 'apt02', kind: 'nightstand', x: -9.1, z: 10.1 },
  { owner: 'apt02', kind: 'nightstand', x: -9.1, z: 12.7 },
  { owner: 'apt02', kind: 'kitchenCounter', x: -3.2, z: -1.6, w: 2.6, d: 2.6 },
  { owner: 'apt02', kind: 'toilet', x: -1.3, z: -2.2, rotY: -Math.PI / 2 },
  { owner: 'apt02', kind: 'diningSet', x: -2.6, z: 3.9, rotY: Math.PI / 2 },
  { owner: 'apt02', kind: 'sofa', x: -3.8, z: 8.6, rotY: Math.PI / 2 },
  { owner: 'apt02', kind: 'coffeeTable', x: -2.6, z: 8.6 },
  { owner: 'apt02', kind: 'armchair', x: -2.6, z: 6.9, rotY: 0 },
  { owner: 'apt02', kind: 'armchair', x: -2.6, z: 10.3, rotY: Math.PI },
  { owner: 'apt02', kind: 'tvConsole', x: -0.6, z: 8.6, rotY: -Math.PI / 2 },
  { owner: 'apt02', kind: 'bistroSet', x: -3.8, z: 12.8 },
  { owner: 'apt02', kind: 'bistroSet', x: -1.4, z: 12.8 },

  // Apartment 03 (205 m²)
  { owner: 'apt03', kind: 'kingBed', x: 6.5, z: -10.8, rotY: Math.PI },
  { owner: 'apt03', kind: 'wardrobe', x: 4.1, z: -11.4, w: 0.6, d: 3.2 },
  { owner: 'apt03', kind: 'armchair', x: 8.5, z: -12.7, rotY: -Math.PI / 4 },
  { owner: 'apt03', kind: 'twinBed', x: 7.4, z: -7.7, rotY: -Math.PI / 2 },
  { owner: 'apt03', kind: 'twinBed', x: 7.4, z: -6.0, rotY: -Math.PI / 2 },
  { owner: 'apt03', kind: 'tub', x: 8.2, z: -4.2, rotY: 0 },
  { owner: 'apt03', kind: 'toilet', x: 6.2, z: -3.6, rotY: 0 },
  { owner: 'apt03', kind: 'vanity', x: 5.5, z: -4.2, rotY: Math.PI / 2 },
  { owner: 'apt03', kind: 'twinBed', x: 7.4, z: -1.0, rotY: -Math.PI / 2 },
  { owner: 'apt03', kind: 'twinBed', x: 7.4, z: 0.7, rotY: -Math.PI / 2 },
  { owner: 'apt03', kind: 'kitchenCounter', x: 7.3, z: 3.8, w: 3.0, d: 2.8 },
  { owner: 'apt03', kind: 'toilet', x: 4.3, z: 2.8, rotY: 0 },
  { owner: 'apt03', kind: 'diningSet', x: 7.2, z: 10.6, rotY: Math.PI / 2 },
  { owner: 'apt03', kind: 'sofa', x: 1.4, z: 8.6, rotY: Math.PI / 2 },
  { owner: 'apt03', kind: 'coffeeTable', x: 2.6, z: 8.6 },
  { owner: 'apt03', kind: 'armchair', x: 2.6, z: 6.9, rotY: 0 },
  { owner: 'apt03', kind: 'armchair', x: 2.6, z: 10.3, rotY: Math.PI },
  { owner: 'apt03', kind: 'tvConsole', x: 4.3, z: 8.6, rotY: -Math.PI / 2 },
  { owner: 'apt03', kind: 'bistroSet', x: 1.2, z: 12.8 },
  { owner: 'apt03', kind: 'bistroSet', x: 3.4, z: 12.8 },
];

export const EXTERIOR_CAMERA_PRESETS: Record<
  'full' | 'arcade' | 'terraces' | 'crown',
  { label: string; pos: [number, number, number]; target: [number, number, number] }
> = {
  full: { label: 'الواجهة الكاملة للبرج', pos: [38, 22, 68], target: [0, 20.5, 0] },
  arcade: { label: 'الأركيد التجاري والمدخل', pos: [14, 5.8, 28], target: [0, 2.8, 13] },
  terraces: { label: 'البلكونات والأدوار المتكررة', pos: [-26, 22, 32], target: [0, 20, 12] },
  crown: { label: 'التاج العلوي والكورنيش', pos: [24, 46, 30], target: [0, 38, 0] },
};
