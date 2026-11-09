/**
 * eng-math.ts — حسابات الأدوات الهندسية في الموقع العام (دوال صافية بدون واجهة).
 * كل المعاملات قياسية أو منشورة؛ النسب الاسترشادية (حديد/م³، خلطة الخرسانة، تغطية الدهان)
 * ظاهرة للمستخدم وقابلة للتعديل، والنتيجة تقديرية وليست مقايسة.
 */

export type UnitDef = { id: string; label: string; factor: number }; // factor = قيمة الوحدة بالنسبة للوحدة الأساسية
export type Category = { id: string; label: string; base: string; units: UnitDef[]; note?: string };

const FEDDAN_M2 = 4200.833; // الفدان المصري
const QIRAT_M2 = FEDDAN_M2 / 24;
const SAHM_M2 = QIRAT_M2 / 24;

export const CATEGORIES: Category[] = [
  {
    id: 'length', label: 'الطول', base: 'm',
    units: [
      { id: 'm', label: 'متر (m)', factor: 1 },
      { id: 'cm', label: 'سنتيمتر (cm)', factor: 0.01 },
      { id: 'mm', label: 'مليمتر (mm)', factor: 0.001 },
      { id: 'km', label: 'كيلومتر (km)', factor: 1000 },
      { id: 'ft', label: 'قدم (ft)', factor: 0.3048 },
      { id: 'in', label: 'بوصة (in)', factor: 0.0254 },
      { id: 'yd', label: 'ياردة (yd)', factor: 0.9144 },
    ],
  },
  {
    id: 'area', label: 'المساحة', base: 'm2',
    note: 'الفدان والقيراط والسهم بالنظام المصري (الفدان = 24 قيراط، القيراط = 24 سهم).',
    units: [
      { id: 'm2', label: 'متر مربع (م²)', factor: 1 },
      { id: 'ft2', label: 'قدم مربع (ft²)', factor: 0.09290304 },
      { id: 'yd2', label: 'ياردة مربعة (yd²)', factor: 0.83612736 },
      { id: 'ha', label: 'هكتار', factor: 10000 },
      { id: 'feddan', label: 'فدان (مصري)', factor: FEDDAN_M2 },
      { id: 'qirat', label: 'قيراط (مصري)', factor: QIRAT_M2 },
      { id: 'sahm', label: 'سهم (مصري)', factor: SAHM_M2 },
    ],
  },
  {
    id: 'volume', label: 'الحجم', base: 'm3',
    units: [
      { id: 'm3', label: 'متر مكعب (م³)', factor: 1 },
      { id: 'l', label: 'لتر', factor: 0.001 },
      { id: 'ft3', label: 'قدم مكعب (ft³)', factor: 0.028316846592 },
      { id: 'yd3', label: 'ياردة مكعبة (yd³)', factor: 0.764554857984 },
      { id: 'gal', label: 'جالون أمريكي', factor: 0.003785411784 },
    ],
  },
  {
    id: 'mass', label: 'الوزن', base: 'kg',
    units: [
      { id: 'kg', label: 'كيلوجرام (kg)', factor: 1 },
      { id: 'g', label: 'جرام (g)', factor: 0.001 },
      { id: 'ton', label: 'طن متري', factor: 1000 },
      { id: 'lb', label: 'رطل (lb)', factor: 0.45359237 },
    ],
  },
  {
    id: 'pressure', label: 'الإجهاد والضغط', base: 'mpa',
    note: 'للخرسانة: المقاومة بالأسطوانة تقارب 0.8 من مقاومة المكعب (تقريبي، ويعتمد على الكود المستخدم).',
    units: [
      { id: 'mpa', label: 'ميجاباسكال (MPa = N/mm²)', factor: 1 },
      { id: 'kgcm2', label: 'كجم/سم²', factor: 0.0980665 },
      { id: 'psi', label: 'رطل/بوصة² (psi)', factor: 0.006894757293 },
      { id: 'knm2', label: 'كيلونيوتن/م² (kPa)', factor: 0.001 },
      { id: 'bar', label: 'بار (bar)', factor: 0.1 },
    ],
  },
];

export function convert(categoryId: string, value: number, from: string, to: string): number {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  const a = cat?.units.find(u => u.id === from);
  const b = cat?.units.find(u => u.id === to);
  if (!cat || !a || !b || !Number.isFinite(value)) return NaN;
  return (value * a.factor) / b.factor;
}

/** وزن المتر الطولي لحديد التسليح (كجم/م) = قطر² ÷ 162 (القطر بالمم) — تقريب هندسي معروف. */
export function rebarKgPerMeter(diameterMm: number): number {
  return (diameterMm * diameterMm) / 162;
}
export const REBAR_DIAMETERS = [8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32];

export type ConcreteElement = 'footing' | 'slab' | 'beam' | 'column';
export const ELEMENT_DEFAULTS: Record<ConcreteElement, { label: string; steel: number }> = {
  footing: { label: 'قواعد / لبشة', steel: 80 },
  slab: { label: 'سقف / بلاطة', steel: 100 },
  beam: { label: 'كمرات', steel: 150 },
  column: { label: 'أعمدة', steel: 200 },
};

export type ConcreteInput = {
  length: number; width: number; thickness: number; // بالمتر
  count?: number;
  wastePct: number;
  steelKgPerM3: number;
  cementKgPerM3: number;
};
export type ConcreteResult = {
  netM3: number; orderM3: number; steelKg: number; steelTon: number;
  cementKg: number; cementBags50: number; sandM3: number; gravelM3: number;
};

/** رمل 0.4 م³ وزلط 0.8 م³ لكل م³ خرسانة — نسبة خلطة شائعة (تقديرية). */
export function concreteEstimate(i: ConcreteInput): ConcreteResult | null {
  const vals = [i.length, i.width, i.thickness];
  if (vals.some(v => !Number.isFinite(v) || v <= 0)) return null;
  const count = Number.isFinite(i.count) && (i.count as number) > 0 ? (i.count as number) : 1;
  const waste = Math.max(0, Number.isFinite(i.wastePct) ? i.wastePct : 0) / 100;
  const net = i.length * i.width * i.thickness * count;
  const order = net * (1 + waste);
  const steelKg = order * Math.max(0, i.steelKgPerM3 || 0);
  const cementKg = order * Math.max(0, i.cementKgPerM3 || 0);
  return {
    netM3: net, orderM3: order, steelKg, steelTon: steelKg / 1000,
    cementKg, cementBags50: cementKg / 50, sandM3: order * 0.4, gravelM3: order * 0.8,
  };
}

export type RoomInput = {
  length: number; width: number; height: number;
  openingsM2: number;
  tileLength: number; tileWidth: number; // بالسنتيمتر
  tileWastePct: number;
  paintCoats: number; paintCoverageM2PerL: number;
};
export type RoomResult = {
  floorM2: number; wallM2: number; tilesCount: number; tileBoxesNote: string; paintLitres: number; paintableM2: number;
};

export function roomEstimate(i: RoomInput): RoomResult | null {
  const need = [i.length, i.width, i.height, i.tileLength, i.tileWidth, i.paintCoverageM2PerL];
  if (need.some(v => !Number.isFinite(v) || v <= 0)) return null;
  const floor = i.length * i.width;
  const wall = Math.max(0, 2 * (i.length + i.width) * i.height - Math.max(0, i.openingsM2 || 0));
  const tileArea = (i.tileLength / 100) * (i.tileWidth / 100);
  const waste = Math.max(0, i.tileWastePct || 0) / 100;
  const tiles = Math.ceil((floor / tileArea) * (1 + waste));
  const paintable = wall + floor; // جدران + سقف بنفس مساحة الأرضية
  const coats = Math.max(1, Math.round(i.paintCoats || 1));
  return {
    floorM2: floor, wallM2: wall, tilesCount: tiles,
    tileBoxesNote: 'عدد الأرضيات بعد نسبة الهالك — اقسمه على عدد القطع في العلبة.',
    paintableM2: paintable, paintLitres: (paintable * coats) / i.paintCoverageM2PerL,
  };
}

export function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const d = abs >= 1000 ? 0 : abs >= 100 ? 1 : digits;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(n);
}
