import {
  getProductImageUrl,
  LEGACY_DUMMY_PRODUCT_IDS,
  PRODUCT_CATEGORIES,
  type ProductCategoryId,
  type WebsiteProduct,
} from '@/app/site/store-catalog';

const BUCKET_NAME = 'store-catalog';
const META_TTL_MS = 60_000;
const INDEX_TTL_MS = 10 * 60_000;
const VALID_CATS = new Set<string>(PRODUCT_CATEGORIES.map((c) => c.id));

export interface StoreMediaEntry {
  id: string;
  productId?: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  kind?: 'image' | 'datasheet' | 'document';
  telegramFileId: string;
  telegramMessageId?: string;
  telegramChatId?: string;
}

export interface StoreCatalogMeta {
  generatedAt?: string;
  totalProducts?: number;
  cheapestMatchedGroups?: number;
  telegramUploadedImages?: number;
  pendingTelegramImages?: number;
}

export interface StoreCatalogQueryParams {
  category?: string;
  q?: string;
  brands?: string[];
  onlyFeatured?: boolean;
  onlyInStock?: boolean;
  onlyDiscounted?: boolean;
  minPrice?: number | null;
  maxPrice?: number | null;
  sort?: 'featured' | 'default' | 'name_asc' | 'price_asc' | 'price_desc';
  page?: number;
  pageSize?: number;
}

export interface StoreCatalogQueryResult {
  items: WebsiteProduct[];
  totalMatched: number;
  totalCatalog: number;
  page: number;
  pageSize: number;
  totalPages: number;
  categoryCounts: Record<string, number>;
  brandCounts: Array<{ brand: string; count: number }>;
  hasPricedProducts: boolean;
  hasDiscountedProducts: boolean;
  priceBounds: { min: number; max: number };
  meta: StoreCatalogMeta;
}

interface CatalogCacheState {
  loadedAt: number;
  indexLoadedAt: number;
  products: WebsiteProduct[];
  mediaMap: Record<string, StoreMediaEntry>;
  meta: StoreCatalogMeta;
  synonymsMap: Map<string, string[]>;
}

const g = globalThis as typeof globalThis & {
  __phiStoreCatalogCache?: CatalogCacheState;
  __phiStoreCatalogInFlight?: Promise<CatalogCacheState>;
  __phiStoreSynonymsCache?: { loadedAt: number; map: Map<string, string[]> };
};

export function isLegacyCatalogStorageOnly(): boolean {
  return process.env.NEXT_PUBLIC_USE_LEGACY_CATALOG_STORAGE === 'true';
}

export function normalizeArabicSearch(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

const STORE_SEARCH_SYNONYM_GROUPS_RAW: readonly (readonly string[])[] = [
  ['قفل', 'أقفال', 'كالون', 'كوالين', 'هاف سلندر', 'سلندر', 'ترباس', 'lock'],
  ['ذكي', 'ذكية', 'سمارت', 'تاتش', 'بصمة', 'ديجيتال', 'واي فاي', 'smart'],
  ['خلاط', 'خلاطات', 'حنفية', 'محبس', 'صنبور'],
  ['فيشة', 'فيش', 'بريزة', 'برايز', 'مقبس', 'سوكيت'],
  ['مفتاح', 'مفاتيح', 'لقمة', 'سويتش'],
  ['كشاف', 'سبوت', 'داون لايت', 'لمبة', 'إضاءة', 'إنارة'],
  ['بلاعة', 'بالوعة', 'بيبة', 'صرف', 'جرجوري'],
  ['سيراميك', 'بورسلان', 'بورسلين', 'بلاط', 'زليج', 'موزاييك'],
  ['انتركم', 'إنتركم', 'انتركوم', 'جرس'],
  ['تكييف', 'مكيف', 'سبليت'],
  ['بتشينو', 'بيتشينو', 'bticino'],
];

const STORE_SEARCH_SYNONYM_MAP: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const rawGroup of STORE_SEARCH_SYNONYM_GROUPS_RAW) {
    const normalizedGroup = Array.from(
      new Set(rawGroup.map((term) => normalizeArabicSearch(term)).filter(Boolean))
    );
    for (const term of normalizedGroup) {
      const existing = map.get(term) || [];
      const merged = Array.from(new Set([...existing, ...normalizedGroup]));
      map.set(term, merged);
    }
  }
  return map;
})();

function resolveSynonymsForNormalizedToken(
  cleanTok: string,
  dynamicMap?: Map<string, string[]>
): string[] | undefined {
  const core = STORE_SEARCH_SYNONYM_MAP.get(cleanTok);
  if (core && core.length > 0) return core;
  const dyn = dynamicMap?.get(cleanTok);
  if (dyn && dyn.length > 0) return dyn;
  return undefined;
}

function expandQueryToken(tok: string, dynamicMap?: Map<string, string[]>): string[] {
  const direct = resolveSynonymsForNormalizedToken(tok, dynamicMap);
  if (direct) return [tok, ...direct.filter((s) => s !== tok)];

  // Arabic definite article prefix (الـ): promote bare root word alongside prefixed form so "الخلاط" ranks like "خلاط"
  if (tok.startsWith('ال') && tok.length >= 4) {
    const bare = tok.slice(2);
    const bareSyns = resolveSynonymsForNormalizedToken(bare, dynamicMap);
    if (bareSyns) {
      return [bare, tok, ...bareSyns.filter((s) => s !== bare && s !== tok)];
    }
    return [bare, tok];
  }

  return [tok];
}

type IndexedPublicProduct = WebsiteProduct & {
  _hasTelegramMedia: boolean;
  _searchBlob: string;
  _nameNorm: string;
  _codeNorm: string;
  _brandNorm: string;
  _subCatNorm: string;
};

function scoreCatalogItemMatch(
  item: IndexedPublicProduct,
  rawQueryNorm: string,
  tokenGroups: string[][]
): number | null {
  for (const group of tokenGroups) {
    if (!group.some((alt) => item._searchBlob.includes(alt))) {
      return null;
    }
  }

  let score = 0;
  if (item._codeNorm && item._codeNorm === rawQueryNorm) {
    score += 250;
  } else if (item._codeNorm && item._codeNorm.includes(rawQueryNorm)) {
    score += 110;
  }
  if (item._nameNorm && item._nameNorm.includes(rawQueryNorm)) {
    score += 120;
  }

  const nameWords = item._nameNorm ? item._nameNorm.split(' ').filter(Boolean) : [];
  let nameMatchedGroups = 0;
  let metaMatchedGroups = 0;

  for (const group of tokenGroups) {
    const primary = group[0];
    if (nameWords[0] && nameWords[0] === primary) {
      score += 70;
      nameMatchedGroups++;
    } else if (nameWords.some((w) => w === primary || w.startsWith(primary))) {
      score += 55;
      nameMatchedGroups++;
    } else if (item._nameNorm.includes(primary)) {
      score += 40;
      nameMatchedGroups++;
    } else if (
      group
        .slice(1)
        .some(
          (alt) =>
            nameWords.some((w) => w === alt || w.startsWith(alt)) ||
            item._nameNorm.includes(alt)
        )
    ) {
      score += 35;
      nameMatchedGroups++;
    } else if (
      group.some(
        (alt) =>
          item._codeNorm.includes(alt) ||
          item._brandNorm.includes(alt) ||
          item._subCatNorm.includes(alt)
      )
    ) {
      score += 18;
      metaMatchedGroups++;
    } else {
      score += 2;
    }
  }

  if (tokenGroups.length > 0 && nameMatchedGroups === tokenGroups.length) {
    score += 80;
  } else if (nameMatchedGroups === 0 && metaMatchedGroups === 0) {
    // Description/specs-only matches rank behind direct title/brand/code matches.
    score -= 35;
  }

  return score;
}

async function downloadJsonObject<T>(
  sbUrl: string,
  serviceKey: string | undefined,
  objectPath: string
): Promise<T | null> {
  const base = sbUrl.replace(/\/+$/, '');
  const cleanPath = objectPath.replace(/^\/+/, '');
  const publicUrl = `${base}/storage/v1/object/public/${BUCKET_NAME}/${cleanPath}`;
  const authedUrl = `${base}/storage/v1/object/${BUCKET_NAME}/${cleanPath}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const pubRes = await fetch(publicUrl, { cache: 'no-store' });
      if (pubRes.ok) {
        return (await pubRes.json()) as T;
      }
    } catch {
      // Fall through to service-role endpoint or retry
    }

    if (serviceKey) {
      try {
        const authRes = await fetch(authedUrl, {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
          cache: 'no-store',
        });
        if (authRes.ok) {
          return (await authRes.json()) as T;
        }
      } catch {
        // Retry once after brief backoff
      }
    }

    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return null;
}

function sanitizeStoredProduct(raw: any): WebsiteProduct | null {
  const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;
  const category = VALID_CATS.has(String(raw?.category))
    ? (String(raw.category) as ProductCategoryId)
    : 'building_materials';
  const price = Number(raw?.price);
  const oldPrice = raw?.oldPrice !== undefined && raw?.oldPrice !== null ? Number(raw.oldPrice) : undefined;
  const installPrice =
    raw?.installPrice !== undefined && raw?.installPrice !== null ? Number(raw.installPrice) : undefined;

  return {
    id: String(raw?.id || '').trim() || `cat-${Math.random().toString(36).slice(2, 9)}`,
    code: String(raw?.code || 'PHI-ITEM').trim(),
    name,
    category,
    subCategory: typeof raw?.subCategory === 'string' ? raw.subCategory.trim() : undefined,
    brand: String(raw?.brand || 'PhiTech').trim() || 'PhiTech',
    unit: String(raw?.unit || 'قطعة').trim() || 'قطعة',
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    oldPrice: oldPrice && Number.isFinite(oldPrice) && oldPrice > 0 ? oldPrice : undefined,
    installPrice: installPrice !== undefined && Number.isFinite(installPrice) && installPrice >= 0 ? installPrice : undefined,
    currency: raw?.currency === 'ر.س' ? 'ر.س' : 'ج.م',
    badge: typeof raw?.badge === 'string' && raw.badge.trim() ? raw.badge.trim() : undefined,
    description:
      typeof raw?.description === 'string'
        ? raw.description.trim().replace(/الماركة\s+بيتشينو/g, 'الماركة بتشينو')
        : '',
    specs: Array.isArray(raw?.specs)
      ? raw.specs
          .map((s: unknown) =>
            String(s ?? '')
              .trim()
              .replace(/الماركة\s+بيتشينو/g, 'الماركة بتشينو')
          )
          .filter(Boolean)
          .slice(0, 8)
      : [],
    imageUrl: typeof raw?.imageUrl === 'string' ? raw.imageUrl.trim() : undefined,
    mediaId: typeof raw?.mediaId === 'string' && raw.mediaId.trim() ? raw.mediaId.trim() : undefined,
    spinImages: Array.isArray(raw?.spinImages)
      ? raw.spinImages
          .map((u: unknown) => (typeof u === 'string' ? u.trim() : ''))
          .filter(Boolean)
          .slice(0, 36)
      : undefined,
    attachments: Array.isArray(raw?.attachments)
      ? raw.attachments
          .filter((a: any) => a && typeof a.id === 'string' && a.id.trim())
          .map((a: any) => ({
            id: String(a.id).trim(),
            name: String(a.name || 'مرفق فني').trim(),
            mimeType: String(a.mimeType || 'application/octet-stream').trim(),
            size: typeof a.size === 'number' ? a.size : undefined,
            kind: a.kind === 'datasheet' || a.kind === 'document' ? a.kind : 'image',
          }))
      : undefined,
    variants: Array.isArray(raw?.variants) ? raw.variants.slice(0, 8) : undefined,
    cheapestSourceCount:
      typeof raw?.cheapestSourceCount === 'number' && raw.cheapestSourceCount > 0
        ? raw.cheapestSourceCount
        : undefined,
    inStock: raw?.inStock !== false,
    featured: Boolean(raw?.featured),
  };
}

async function loadDbSynonymsMap(
  sbUrl: string,
  apiKey: string | undefined
): Promise<Map<string, string[]>> {
  const now = Date.now();
  const cached = g.__phiStoreSynonymsCache;
  if (cached && now - cached.loadedAt < 5 * 60_000) {
    return cached.map;
  }
  const map = new Map<string, string[]>();
  if (!apiKey || isLegacyCatalogStorageOnly()) {
    return cached?.map || map;
  }
  try {
    const base = sbUrl.replace(/\/+$/, '');
    const res = await fetch(
      `${base}/rest/v1/store_search_synonyms?select=term,term_normalized,expand_terms,is_active&is_active=eq.true&limit=1000`,
      {
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        cache: 'no-store',
      }
    );
    if (!res.ok) return cached?.map || map;
    const rows = (await res.json()) as any[];
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const keyNorm = normalizeArabicSearch(row?.term_normalized || row?.term || '');
        if (!keyNorm || STORE_SEARCH_SYNONYM_MAP.has(keyNorm)) continue;
        const terms = Array.isArray(row?.expand_terms)
          ? row.expand_terms.map((t: unknown) => normalizeArabicSearch(String(t || ''))).filter(Boolean)
          : [];
        const unique = Array.from(new Set([keyNorm, ...terms]));
        if (unique.length > 0) map.set(keyNorm, unique);
      }
    }
    g.__phiStoreSynonymsCache = { loadedAt: now, map };
    return map;
  } catch {
    return cached?.map || map;
  }
}

function mapDbRowToProductInput(row: any): any {
  const rawCheapest = Number(row?.cheapest_source_count);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    subCategory: row.sub_category || undefined,
    brand: row.brand,
    unit: row.unit,
    price: row.price,
    oldPrice: row.old_price,
    installPrice: row.install_price,
    currency: row.currency,
    badge: row.badge,
    description: row.description,
    specs: row.specs,
    variants: Array.isArray(row.variants) && row.variants.length > 0 ? row.variants : undefined,
    imageUrl: row.image_url,
    mediaId: row.media_id,
    attachments: Array.isArray(row.attachments) && row.attachments.length > 0 ? row.attachments : undefined,
    cheapestSourceCount: Number.isFinite(rawCheapest) && rawCheapest > 1 ? rawCheapest : undefined,
    inStock: row.in_stock,
    featured: row.featured,
  };
}

async function loadDbCatalogProductsOverlay(
  sbUrl: string,
  apiKey: string | undefined
): Promise<Map<string, WebsiteProduct> | null> {
  if (!apiKey || isLegacyCatalogStorageOnly()) return null;
  const base = sbUrl.replace(/\/+$/, '');
  const cols =
    'id,code,name,category,sub_category,brand,unit,price,old_price,install_price,currency,badge,description,specs,variants,media_id,image_url,attachments,cheapest_source_count,in_stock,featured';

  try {
    const pageSize = 1000;
    const allRows: any[] = [];
    // Fetch first page with count header so remaining pages can be fetched concurrently
    const firstRes = await fetch(
      `${base}/rest/v1/store_catalog_products?select=${cols}&order=id.asc&limit=${pageSize}&offset=0`,
      {
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          Prefer: 'count=exact',
        },
        cache: 'no-store',
      }
    );
    if (!firstRes.ok) return null;
    const firstData = (await firstRes.json()) as any[];
    if (!Array.isArray(firstData) || firstData.length === 0) return null;
    allRows.push(...firstData);

    const contentRange = firstRes.headers.get('content-range') || '';
    const totalMatch = contentRange.match(/\/(\d+)$/);
    const total = totalMatch ? Number(totalMatch[1]) : firstData.length;

    const offsets: number[] = [];
    for (let off = pageSize; off < total; off += pageSize) {
      offsets.push(off);
    }

    for (let i = 0; i < offsets.length; i += 4) {
      const batch = offsets.slice(i, i + 4);
      const batchResults = await Promise.all(
        batch.map(async (off) => {
          const r = await fetch(
            `${base}/rest/v1/store_catalog_products?select=${cols}&order=id.asc&limit=${pageSize}&offset=${off}`,
            {
              headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
              cache: 'no-store',
            }
          );
          if (!r.ok) return [];
          const d = await r.json();
          return Array.isArray(d) ? d : [];
        })
      );
      batchResults.forEach((rows) => allRows.push(...rows));
    }

    const byId = new Map<string, WebsiteProduct>();
    for (const r of allRows) {
      const sanitized = sanitizeStoredProduct(mapDbRowToProductInput(r));
      if (sanitized) byId.set(sanitized.id, sanitized);
    }
    return byId.size > 0 ? byId : null;
  } catch {
    return null;
  }
}

async function loadCatalogState(forceRefresh = false): Promise<CatalogCacheState> {
  const now = Date.now();
  const existing = g.__phiStoreCatalogCache;
  if (!forceRefresh && existing && existing.products.length > 0 && now - existing.loadedAt < META_TTL_MS) {
    return existing;
  }

  if (!forceRefresh && g.__phiStoreCatalogInFlight) {
    return g.__phiStoreCatalogInFlight;
  }

  const sbUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const serviceKey =
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim() || undefined;
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim() || undefined;
  const apiKey = serviceKey || anonKey;
  if (!sbUrl) {
    return (
      existing || {
        loadedAt: 0,
        indexLoadedAt: 0,
        products: [],
        mediaMap: {},
        meta: {},
        synonymsMap: new Map<string, string[]>(),
      }
    );
  }

  const runFetch = async (): Promise<CatalogCacheState> => {
    const refreshTs = Date.now();
    const [rawMeta, rawMediaMap, synonymsMap] = await Promise.all([
      downloadJsonObject<StoreCatalogMeta>(sbUrl, serviceKey, 'catalog/meta.json'),
      downloadJsonObject<Record<string, StoreMediaEntry>>(sbUrl, serviceKey, 'catalog/media-map.json'),
      loadDbSynonymsMap(sbUrl, apiKey),
    ]);

    const needIndexReload =
      forceRefresh ||
      !existing ||
      existing.products.length === 0 ||
      Boolean(rawMeta?.generatedAt && rawMeta.generatedAt !== existing.meta?.generatedAt) ||
      refreshTs - existing.indexLoadedAt >= INDEX_TTL_MS;

    let nextProducts = existing?.products ?? [];
    let nextIndexLoadedAt = existing?.indexLoadedAt ?? 0;

    if (needIndexReload) {
      const [rawIndex, dbById] = await Promise.all([
        downloadJsonObject<any[]>(sbUrl, serviceKey, 'catalog/index.json'),
        loadDbCatalogProductsOverlay(sbUrl, apiKey),
      ]);
      const storageParsed = Array.isArray(rawIndex)
        ? (rawIndex.map(sanitizeStoredProduct).filter(Boolean) as WebsiteProduct[])
        : [];

      if (storageParsed.length > 0) {
        if (dbById && dbById.size > 0) {
          // Overlay authoritative SQL DB rows onto canonical Storage ordering, keeping _idx order 100% preserved
          const seenDbIds = new Set<string>();
          const merged = storageParsed.map((baseItem) => {
            const dbItem = dbById.get(baseItem.id);
            if (!dbItem) return baseItem;
            seenDbIds.add(baseItem.id);
            return {
              ...baseItem,
              ...dbItem,
              spinImages: dbItem.spinImages || baseItem.spinImages,
              subCategory: dbItem.subCategory || baseItem.subCategory,
              cheapestSourceCount: dbItem.cheapestSourceCount ?? baseItem.cheapestSourceCount,
            };
          });
          for (const [id, dbItem] of dbById.entries()) {
            if (!seenDbIds.has(id)) {
              merged.push(dbItem);
            }
          }
          nextProducts = merged;
        } else {
          nextProducts = storageParsed;
        }
        nextIndexLoadedAt = refreshTs;
      } else if (dbById && dbById.size > 0) {
        nextProducts = Array.from(dbById.values());
        nextIndexLoadedAt = refreshTs;
      } else if (!existing || existing.products.length === 0) {
        nextProducts = [];
        nextIndexLoadedAt = 0;
      }
    }

    const nextState: CatalogCacheState = {
      loadedAt: nextProducts.length > 0 ? refreshTs : 0,
      indexLoadedAt: nextProducts.length > 0 ? nextIndexLoadedAt : 0,
      products: nextProducts,
      mediaMap: rawMediaMap && typeof rawMediaMap === 'object' ? rawMediaMap : existing?.mediaMap || {},
      meta: rawMeta && typeof rawMeta === 'object' ? rawMeta : existing?.meta || {},
      synonymsMap,
    };
    g.__phiStoreCatalogCache = nextState;
    return nextState;
  };

  if (forceRefresh) {
    return runFetch();
  }

  const inFlight = runFetch().finally(() => {
    if (g.__phiStoreCatalogInFlight === inFlight) {
      g.__phiStoreCatalogInFlight = undefined;
    }
  });
  g.__phiStoreCatalogInFlight = inFlight;
  return inFlight;
}

export async function getStoreMediaEntry(mediaId: string): Promise<StoreMediaEntry | null> {
  const cleanId = mediaId.trim();
  if (!cleanId) return null;
  let state = await loadCatalogState(false);
  if (state.mediaMap[cleanId]) {
    return state.mediaMap[cleanId];
  }
  // If mediaId wasn't in the cached map and cache is older than 5s, refresh once so newly uploaded files resolve right away.
  if (Date.now() - state.loadedAt > 5_000) {
    state = await loadCatalogState(true);
    if (state.mediaMap[cleanId]) {
      return state.mediaMap[cleanId];
    }
  }
  return null;
}

function isSafeLocalAsset(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.startsWith('/products/') ||
    url.startsWith('/sections/') ||
    url.startsWith('/api/store-media/') ||
    url.startsWith('data:image/')
  );
}

function isSafeProductImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  return isSafeLocalAsset(url) || /^https?:\/\//i.test(url);
}

function resolveProductForPublic(
  p: WebsiteProduct,
  mediaMap: Record<string, StoreMediaEntry>
): IndexedPublicProduct {
  const mediaEntry = p.mediaId ? mediaMap[p.mediaId] : undefined;
  let resolvedImage = '';
  if (mediaEntry?.telegramFileId) {
    resolvedImage = `/api/store-media/${encodeURIComponent(p.mediaId!)}`;
  } else if (isSafeLocalAsset(p.imageUrl)) {
    resolvedImage = p.imageUrl!;
  } else {
    resolvedImage = getProductImageUrl({ id: p.id, category: p.category });
  }

  const resolvedSpinImages = Array.isArray(p.spinImages)
    ? p.spinImages.map((u) => String(u || '').trim()).filter(isSafeProductImageUrl).slice(0, 36)
    : undefined;

  const validAttachments = Array.isArray(p.attachments)
    ? p.attachments.filter((att) => Boolean(mediaMap[att.id]?.telegramFileId))
    : undefined;

  const cleanDescription =
    typeof p.description === 'string'
      ? p.description.replace(/الماركة\s+بيتشينو/g, 'الماركة بتشينو')
      : '';

  const searchBlob = normalizeArabicSearch(
    [p.name, p.code, p.brand, p.subCategory || '', cleanDescription, ...(p.specs || [])].join(' ')
  );

  return {
    ...p,
    description: cleanDescription,
    imageUrl: resolvedImage,
    spinImages: resolvedSpinImages && resolvedSpinImages.length > 0 ? resolvedSpinImages : undefined,
    attachments: validAttachments && validAttachments.length > 0 ? validAttachments : undefined,
    _hasTelegramMedia: Boolean(
      mediaEntry?.telegramFileId || (resolvedSpinImages && resolvedSpinImages.length >= 2)
    ),
    _searchBlob: searchBlob,
    _nameNorm: normalizeArabicSearch(p.name),
    _codeNorm: normalizeArabicSearch(p.code),
    _brandNorm: normalizeArabicSearch(p.brand),
    _subCatNorm: normalizeArabicSearch(p.subCategory || ''),
  };
}

export async function queryStoreCatalog(
  params: StoreCatalogQueryParams = {},
  cmsProducts?: WebsiteProduct[]
): Promise<StoreCatalogQueryResult> {
  const state = await loadCatalogState(false);
  const mediaMap = state.mediaMap;

  const seenIds = new Set<string>();
  const seenCodes = new Set<string>();
  const combinedRaw: WebsiteProduct[] = [];

  if (state.products.length > 0) {
    const baseById = new Map<string, WebsiteProduct>();
    const baseByCode = new Map<string, WebsiteProduct>();
    for (const item of state.products) {
      if (item.id) baseById.set(item.id, item);
      if (item.code) baseByCode.set(item.code.toLowerCase(), item);
    }

    const customCmsProducts = Array.isArray(cmsProducts)
      ? cmsProducts.filter(
          (item) =>
            item?.id &&
            !LEGACY_DUMMY_PRODUCT_IDS.has(item.id) &&
            (Number(item.price) > 0 || (Array.isArray(item.spinImages) && item.spinImages.length > 0))
        )
      : [];
    for (const item of customCmsProducts) {
      if (seenIds.has(item.id)) continue;
      const baseMatch =
        baseById.get(item.id) || (item.code ? baseByCode.get(item.code.toLowerCase()) : undefined);
      const mergedItem: WebsiteProduct = baseMatch
        ? {
            ...baseMatch,
            ...item,
            mediaId: item.mediaId || baseMatch.mediaId,
            attachments: item.attachments || baseMatch.attachments,
            subCategory: item.subCategory || baseMatch.subCategory,
            cheapestSourceCount: item.cheapestSourceCount ?? baseMatch.cheapestSourceCount,
          }
        : item;
      seenIds.add(mergedItem.id);
      if (mergedItem.code) seenCodes.add(mergedItem.code.toLowerCase());
      combinedRaw.push(mergedItem);
    }
    for (const item of state.products) {
      if (seenIds.has(item.id)) continue;
      if (item.code && seenCodes.has(item.code.toLowerCase())) continue;
      seenIds.add(item.id);
      combinedRaw.push(item);
    }
  } else {
    const fallbackList = (Array.isArray(cmsProducts) ? cmsProducts : []).filter(
      (item) => item?.id && !LEGACY_DUMMY_PRODUCT_IDS.has(item.id)
    );
    for (const item of fallbackList) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      if (item.code) seenCodes.add(item.code.toLowerCase());
      combinedRaw.push(item);
    }
  }

  const allItems = combinedRaw.map((p, index) => ({
    ...resolveProductForPublic(p, mediaMap),
    _idx: index,
  }));

  const categoryCounts: Record<string, number> = { all: allItems.length };
  for (const c of PRODUCT_CATEGORIES) categoryCounts[c.id] = 0;

  let hasPricedProducts = false;
  let hasDiscountedProducts = false;
  let minPBound = Infinity;
  let maxPBound = 0;

  for (const item of allItems) {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    if (item.price > 0) {
      hasPricedProducts = true;
      if (item.price < minPBound) minPBound = item.price;
      if (item.price > maxPBound) maxPBound = item.price;
    }
    if (item.oldPrice && item.oldPrice > item.price) {
      hasDiscountedProducts = true;
    }
  }

  const activeCategory =
    params.category && VALID_CATS.has(params.category) ? (params.category as ProductCategoryId) : 'all';

  const brandMap = new Map<string, number>();
  for (const item of allItems) {
    if (activeCategory !== 'all' && item.category !== activeCategory) continue;
    const b = item.brand.trim();
    if (!b) continue;
    brandMap.set(b, (brandMap.get(b) || 0) + 1);
  }
  const brandCounts = Array.from(brandMap.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar'))
    .map(([brand, count]) => ({ brand, count }));

  const qNorm = normalizeArabicSearch(params.q || '');
  const tokens = qNorm ? qNorm.split(' ').filter(Boolean) : [];
  const tokenGroups = tokens.map((tok) => expandQueryToken(tok, state.synonymsMap));
  const scoreById = new Map<string, number>();
  const brandSet = new Set((params.brands || []).map((b) => b.trim()).filter(Boolean));
  const minPrice =
    params.minPrice !== undefined && params.minPrice !== null && Number.isFinite(params.minPrice)
      ? params.minPrice
      : null;
  const maxPrice =
    params.maxPrice !== undefined && params.maxPrice !== null && Number.isFinite(params.maxPrice)
      ? params.maxPrice
      : null;

  const matched = allItems.filter((item) => {
    if (activeCategory !== 'all' && item.category !== activeCategory) return false;
    if (params.onlyFeatured && !item.featured) return false;
    if (params.onlyInStock && !item.inStock) return false;
    if (params.onlyDiscounted && !(item.oldPrice && item.oldPrice > item.price)) return false;
    if (brandSet.size > 0 && !brandSet.has(item.brand.trim())) return false;
    if (hasPricedProducts) {
      if (minPrice !== null && item.price < minPrice) return false;
      if (maxPrice !== null && item.price > maxPrice) return false;
    }
    if (tokenGroups.length > 0) {
      const matchScore = scoreCatalogItemMatch(item, qNorm, tokenGroups);
      if (matchScore === null) return false;
      scoreById.set(item.id, matchScore);
    }
    return true;
  });

  const sortMode = params.sort || 'featured';
  if (sortMode === 'featured' || sortMode === 'default') {
    matched.sort((a, b) => {
      if (tokenGroups.length > 0) {
        const diff = (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0);
        if (diff !== 0) return diff;
      }
      if (sortMode === 'featured') {
        if (a._hasTelegramMedia !== b._hasTelegramMedia) return a._hasTelegramMedia ? -1 : 1;
        if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
        const aMulti = (a.cheapestSourceCount || 1) > 1;
        const bMulti = (b.cheapestSourceCount || 1) > 1;
        if (aMulti !== bMulti) return aMulti ? -1 : 1;
        const aDisc = Boolean(a.oldPrice && a.oldPrice > a.price);
        const bDisc = Boolean(b.oldPrice && b.oldPrice > b.price);
        if (aDisc !== bDisc) return aDisc ? -1 : 1;
        const aHasPrice = a.price > 0;
        const bHasPrice = b.price > 0;
        if (aHasPrice !== bHasPrice) return aHasPrice ? -1 : 1;
      }
      return a._idx - b._idx;
    });
  } else if (sortMode === 'name_asc') {
    matched.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  } else if (sortMode === 'price_asc') {
    matched.sort((a, b) => {
      const ap = a.price > 0 ? a.price : Number.MAX_SAFE_INTEGER;
      const bp = b.price > 0 ? b.price : Number.MAX_SAFE_INTEGER;
      return ap - bp || a._idx - b._idx;
    });
  } else if (sortMode === 'price_desc') {
    matched.sort((a, b) => b.price - a.price || a._idx - b._idx);
  }

  const pageSize = Math.min(60, Math.max(12, Number(params.pageSize) || 24));
  const totalMatched = matched.length;
  const totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number(params.page) || 1));
  const start = (page - 1) * pageSize;

  const items: WebsiteProduct[] = matched.slice(start, start + pageSize).map((it) => {
    const {
      _hasTelegramMedia: _m,
      _searchBlob: _s,
      _nameNorm: _n,
      _codeNorm: _c,
      _brandNorm: _b,
      _subCatNorm: _sc,
      _idx: _i,
      ...pub
    } = it;
    return pub;
  });

  return {
    items,
    totalMatched,
    totalCatalog: allItems.length,
    page,
    pageSize,
    totalPages,
    categoryCounts,
    brandCounts,
    hasPricedProducts,
    hasDiscountedProducts,
    priceBounds: {
      min: Number.isFinite(minPBound) ? Math.floor(minPBound) : 0,
      max: maxPBound > 0 ? Math.ceil(maxPBound) : 0,
    },
    meta: state.meta,
  };
}

export async function getStoreCatalogShowcase(
  limit = 28,
  cmsProducts?: WebsiteProduct[]
): Promise<{ items: WebsiteProduct[]; smartItems: WebsiteProduct[]; totalCatalog: number }> {
  const safeLimit = Math.min(60, Math.max(12, limit));
  const [mainRes, smartRes, lowCurrentRes, safetyRes] = await Promise.all([
    queryStoreCatalog({ page: 1, pageSize: safeLimit, sort: 'featured' }, cmsProducts),
    queryStoreCatalog({ category: 'smart_home', page: 1, pageSize: 6, sort: 'featured' }, cmsProducts),
    queryStoreCatalog({ category: 'low_current', page: 1, pageSize: 6, sort: 'featured' }, cmsProducts),
    queryStoreCatalog({ category: 'safety_sensors', page: 1, pageSize: 6, sort: 'featured' }, cmsProducts),
  ]);

  const seenSmart = new Set<string>();
  const smartItems: WebsiteProduct[] = [];
  for (const group of [smartRes.items.slice(0, 6), lowCurrentRes.items.slice(0, 4), safetyRes.items.slice(0, 4)]) {
    for (const item of group) {
      if (seenSmart.has(item.id)) continue;
      seenSmart.add(item.id);
      smartItems.push(item);
      if (smartItems.length >= 12) break;
    }
    if (smartItems.length >= 12) break;
  }

  return {
    items: mainRes.items,
    smartItems,
    totalCatalog: mainRes.totalCatalog,
  };
}

export async function registerStoreMediaEntry(
  entry: StoreMediaEntry
): Promise<{ ok: boolean; error?: string }> {
  const sbUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const serviceKey =
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim() || undefined;

  if (!sbUrl || !serviceKey) {
    return { ok: false, error: 'missing_service_key' };
  }

  const base = sbUrl.replace(/\/+$/, '');
  const currentMap =
    (await downloadJsonObject<Record<string, StoreMediaEntry>>(sbUrl, serviceKey, 'catalog/media-map.json')) || {};

  // Strip sensitive Telegram routing metadata before writing to public bucket
  const sanitizedMap: Record<string, StoreMediaEntry> = {};
  for (const [k, v] of Object.entries(currentMap)) {
    if (!v || !v.telegramFileId) continue;
    sanitizedMap[k] = {
      id: v.id || k,
      productId: v.productId,
      fileName: v.fileName,
      mimeType: v.mimeType,
      fileSize: v.fileSize,
      sha256: v.sha256,
      kind: v.kind,
      telegramFileId: v.telegramFileId,
    };
  }

  const sanitizedEntry: StoreMediaEntry = {
    id: entry.id,
    productId: entry.productId,
    fileName: entry.fileName,
    mimeType: entry.mimeType,
    fileSize: entry.fileSize,
    sha256: entry.sha256,
    kind: entry.kind || 'image',
    telegramFileId: entry.telegramFileId,
  };
  sanitizedMap[entry.id] = sanitizedEntry;

  const uploadRes = await fetch(`${base}/storage/v1/object/${BUCKET_NAME}/catalog/media-map.json`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    },
    body: JSON.stringify(sanitizedMap),
  });

  if (!uploadRes.ok) {
    return { ok: false, error: `storage_${uploadRes.status}` };
  }

  if (g.__phiStoreCatalogCache) {
    g.__phiStoreCatalogCache.mediaMap[entry.id] = sanitizedEntry;
    g.__phiStoreCatalogCache.loadedAt = Date.now();
  }
  return { ok: true };
}
