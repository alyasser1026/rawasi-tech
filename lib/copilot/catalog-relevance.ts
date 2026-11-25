/** Pure catalog presentation rules shared by the server and chat UI. */
export interface CatalogProductLike {
  id?: string;
  code?: string;
  name?: string;
  category?: string;
  categoryTitle?: string;
  subCategory?: string;
  brand?: string;
  inStock?: boolean;
}

export interface CatalogIntent {
  kind: 'product' | 'policy' | 'contextual' | 'browse' | 'none';
  family: string | null;
  category: string | null;
}

export interface CatalogRelevanceOptions {
  /** A specific requested item's detail may be shown as unavailable, with its order actions disabled. */
  includeUnavailable?: boolean;
  activeProductId?: string;
  contextQuery?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  electrical: 'الكهرباء والإنارة',
  plumbing: 'السباكة',
  paint: 'الدهانات',
  ceramics: 'السيراميك',
  marble: 'الرخام',
  decor: 'الديكورات',
  smart_home: 'المنزل الذكي',
  low_current: 'أنظمة التيار الخفيف',
  safety_sensors: 'الحساسات وأنظمة الأمان',
  hvac: 'التكييف والتهوية',
  building_materials: 'مواد البناء',
  doors_windows: 'الأبواب والشبابيك',
  appliances: 'الأجهزة المنزلية',
  tools_hardware: 'العدد والأدوات',
};

const normalize = (value: unknown) => String(value ?? '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[٠-٩]/g, value => String('٠١٢٣٤٥٦٧٨٩'.indexOf(value)))
  .replace(/[ً-ٰٟـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ى/g, 'ي')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const LOCK = /(?:كالون|كالونات|قفل|اقفال|\block\b|\blocks\b|doorlock)/;
const SMART = /(?:ذكي|ذكيه|سمارت|تاتش|بصمه|بصمات|\bsmart\b|fingerprint|touch|biometric)/;
const HEATER = /(?:سخان|سخانات|\bheater\b|\bheaters\b)/;
const GAS = /(?:غاز|\bgas\b)/;
const CAMERA = /(?:كاميرا|كاميرات|مراقبه|\bcamera\b|\bcameras\b|cctv)/;
const SENSOR = /(?:حساس|حساسات|\bsensor\b|\bsensors\b|كاشف دخان)/;
const CABLE = /(?:كابل|كابلات|اسلاك|(?:^|\s)سلك(?:\s|$)|\bcable\b|\bcables\b|\bwire\b|\bwires\b)/;
const PAINT = /(?:دهان|دهانات|بويه|طلاء|سيلر|\bpaint\b|\bsealer\b)/;
const HVAC = /(?:تكييف|تكييفات|مكيف|تكيف|air condition|\bac\b)/;
const LAMP = /(?:لمبه|لمبات|اناره|اضاءه|كشاف|نجف|\blamp\b|\bbulb\b|\blighting\b)/;
const SOCKET = /(?:(?:^|\s)فيش(?:\s|$)|فيشه|بريزه|مقبس|مفاتيح|(?:^|\s)مفتاح(?:\s|$)|\bsocket\b|\bswitch\b)/;
const POLICY = /(?:توصيل|بتوصل|بتشحن|(?:^|\s)(?:شحن|الشحن|دفع|الدفع|كاش|فرع|فروع)(?:\s|$)|محافظات|استلام|ضمان|مرتجع|ارجاع|استبدال|خصم|تفاوض|سعر جمله|\bdelivery\b|\bshipping\b|\bpayment\b|\bcash\b|\bpickup\b|\bbranch\b|\bwarranty\b|\brefund\b|\breturn\b|\bdiscount\b|\bwholesale\b)/;

const STOP = new Set(normalize('عايز عاوز اريد ابغي ممكن لو سمحت عندكم عندك ايه هل في فيه من علي عن مع ولا او ده دا دي انا قولي وريني افضل احسن ارخص اغلي سعر اسعار بكام كام شراء اشتري منتج منتجات تفاصيل مواصفات جنيه جنيها ج ج م ريال لتر لترات قطعه عبوه متر سم ملي حصان حجم سعه عدد كميه of the for a an please show me want need price cheapest expensive best more how much').split(' '));

function meaningfulTokens(query: string): string[] {
  return normalize(query).split(' ').filter(token => token.length >= 2 && !STOP.has(token) && !/^\d+(?:[a-z]+)?$/i.test(token));
}

export function inferCatalogIntent(query: string): CatalogIntent {
  // Common missing-alef typo from the audited conversations, only in a heater-like position.
  const text = normalize(query).replace(/(^|\s)سخن(?=$|\s+(?:غاز|كهربي|كهربائي|كهربا|شمسي|\d))/g, '$1سخان');
  const result = (kind: CatalogIntent['kind'], family: string | null = null, category: string | null = null): CatalogIntent => ({ kind, family, category });
  // Policy questions are answered from approved policy, not by attaching arbitrary stock cards.
  if (POLICY.test(text)) return result('policy');
  if (HEATER.test(text)) return result('product', GAS.test(text) ? 'gas_heater' : 'water_heater', 'appliances');
  if (LOCK.test(text)) return result('product', SMART.test(text) ? 'smart_lock' : 'lock', SMART.test(text) ? 'smart_home' : 'doors_windows');
  if (CABLE.test(text)) return result('product', 'cable', 'electrical');
  if (PAINT.test(text)) return result('product', 'paint', 'paint');
  if (HVAC.test(text)) return result('product', 'air_conditioner', 'hvac');
  if (CAMERA.test(text)) return result('product', 'camera', 'low_current');
  if (SENSOR.test(text)) return result('product', 'sensor', 'safety_sensors');
  if (/(?:يو بي اس|\bups\b|uninterruptible)/.test(text)) return result('product', 'ups', 'low_current');
  if (/كهرباء/.test(text) && /اناره|اضاءه/.test(text)) return result('product', null, 'electrical');
  if (LAMP.test(text)) return result('product', 'lighting', 'electrical');
  if (SOCKET.test(text)) return result('product', 'socket', 'electrical');
  if (/(?:تامين|تامنلي|تامن لي|امنلي|امن لي|احمي).*(?:شقه|بيت|منزل)|home security/.test(text)) return result('product', 'home_security');

  const categoryTerms: Array<[string, RegExp]> = [
    ['smart_home', /سمارت هوم|البيت الذكي|منزل ذكي|smart home/],
    ['low_current', /تيار خفيف|low current/],
    ['safety_sensors', /انظمه امان|انظمه الامان/],
    ['plumbing', /سباكه|\bplumbing\b/],
    ['electrical', /كهرباء|\belectrical\b/],
    ['ceramics', /سيراميك|بورسلان|بورسلين/],
    ['marble', /رخام|جرانيت|\bmarble\b/],
    ['decor', /ديكور|ديكورات|\bdecor\b/],
    ['building_materials', /مواد بناء|اسمنت|حديد تسليح/],
    ['doors_windows', /ابواب|شبابيك|doors windows/],
    ['tools_hardware', /عدد وادوات|ادوات يدويه|\btools\b/],
  ];
  for (const [category, pattern] of categoryTerms) if (pattern.test(text)) return result('product', null, category);
  if (/^(?:ال)?(?:كتالوج|متجر|منتجات|بضايع|بضائع|catalog|products|browse)(?:\s|$)|عندكم ايه/.test(text)) return result('browse');
  if (!text || meaningfulTokens(text).length === 0 || /^(?:والتاني|والاول|التاني|الاول|دول|ده|دي|طب|طيب|كمان|نفسه|نفس|احسب|زود|خلي|قارن|what about|and the)/.test(text)) return result('contextual');
  return result('none');
}

function matchesFamily(product: CatalogProductLike, family: string): boolean {
  // Product descriptions can mention other recommended items: they are not product identity.
  const identity = normalize(`${product.name || ''} ${product.subCategory || ''}`);
  switch (family) {
    case 'gas_heater': return HEATER.test(identity) && GAS.test(identity);
    case 'water_heater': return HEATER.test(identity);
    case 'smart_lock': return LOCK.test(identity) && SMART.test(identity);
    case 'lock': return LOCK.test(identity);
    case 'cable': return CABLE.test(identity);
    case 'paint': return PAINT.test(identity);
    case 'air_conditioner': return HVAC.test(identity);
    case 'camera': return CAMERA.test(identity);
    case 'sensor': return SENSOR.test(identity);
    case 'lighting': return LAMP.test(identity);
    case 'socket': return SOCKET.test(identity);
    case 'ups': return /يو بي اس|\bups\b|uninterruptible/.test(identity);
    case 'home_security': return CAMERA.test(identity) || SENSOR.test(identity) || (LOCK.test(identity) && SMART.test(identity));
    default: return false;
  }
}

export function isProductOrderable(product: Pick<CatalogProductLike, 'inStock'>): boolean {
  return product.inStock === true;
}

export function isRelevantCatalogProduct(product: CatalogProductLike, query: string): boolean {
  const intent = inferCatalogIntent(query);
  if (intent.kind === 'policy' || intent.kind === 'contextual') return false;
  if (intent.kind === 'browse') return true;
  if (intent.family) return matchesFamily(product, intent.family);
  if (intent.category) return product.category === intent.category;
  const code = normalize(product.code);
  const normalizedQuery = normalize(query);
  if (code && (code === normalizedQuery || normalizedQuery.split(' ').filter(Boolean).join('').includes(code.replace(/\s/g, '')))) return true;
  const tokens = meaningfulTokens(query);
  if (tokens.length === 0) return false;
  const identity = normalize(`${product.name || ''} ${product.code || ''} ${product.brand || ''}`);
  const words = identity.split(' ');
  return tokens.some(token => words.includes(token) || words.includes(token.replace(/^ال/, '')));
}

export function scoreCatalogProduct(product: CatalogProductLike, query: string): number {
  if (!isRelevantCatalogProduct(product, query)) return 0;
  const identity = normalize(`${product.name || ''} ${product.code || ''} ${product.brand || ''}`);
  const words = new Set(identity.split(' '));
  const matched = meaningfulTokens(query).filter(token => words.has(token) || words.has(token.replace(/^ال/, ''))).length;
  return 10 + matched * 3 + (normalize(product.code) === normalize(query) ? 100 : 0);
}

export function filterRelevantCatalogProducts<T extends CatalogProductLike>(
  products: readonly T[],
  query: string,
  options: CatalogRelevanceOptions = {}
): T[] {
  const intent = inferCatalogIntent(query);
  if (intent.kind === 'policy') return [];
  const effectiveQuery = intent.kind === 'contextual' && options.contextQuery ? options.contextQuery : query;
  const seen = new Set<string>();
  return products.filter(product => {
    if (!options.includeUnavailable && !isProductOrderable(product)) return false;
    if (product.id && seen.has(product.id)) return false;
    const relevant = intent.kind === 'contextual' && Boolean(options.activeProductId) && product.id === options.activeProductId
      ? true
      : isRelevantCatalogProduct(product, effectiveQuery);
    if (relevant && product.id) seen.add(product.id);
    return relevant;
  });
}

/** Translate known internal category keys only; model and SKU identifiers remain verbatim. */
export function toCustomerDisplayText(value: unknown): string {
  let text = String(value ?? '').normalize('NFKC');
  for (const [slug, label] of Object.entries(CATEGORY_LABELS)) {
    const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`(?<![A-Za-z0-9_-])${escaped}(?![A-Za-z0-9_-])`, 'gi'), label);
  }
  return text
    .replace(/```(?:[a-z]+)?\s*([\s\S]*?)```/gi, '$1')
    .replace(/`+/g, '')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim();
}
