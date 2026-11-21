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
}

const g = globalThis as typeof globalThis & {
  __phiStoreCatalogCache?: CatalogCacheState;
  __phiStoreCatalogInFlight?: Promise<CatalogCacheState>;
};

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
    description: typeof raw?.description === 'string' ? raw.description.trim() : '',
    specs: Array.isArray(raw?.specs)
      ? raw.specs.map((s: unknown) => String(s ?? '').trim()).filter(Boolean).slice(0, 8)
      : [],
    imageUrl: typeof raw?.imageUrl === 'string' ? raw.imageUrl.trim() : undefined,
    mediaId: typeof raw?.mediaId === 'string' && raw.mediaId.trim() ? raw.mediaId.trim() : undefined,
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
  if (!sbUrl) {
    return (
      existing || {
        loadedAt: 0,
        indexLoadedAt: 0,
        products: [],
        mediaMap: {},
        meta: {},
      }
    );
  }

  const runFetch = async (): Promise<CatalogCacheState> => {
    const refreshTs = Date.now();
    const [rawMeta, rawMediaMap] = await Promise.all([
      downloadJsonObject<StoreCatalogMeta>(sbUrl, serviceKey, 'catalog/meta.json'),
      downloadJsonObject<Record<string, StoreMediaEntry>>(sbUrl, serviceKey, 'catalog/media-map.json'),
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
      const rawIndex = await downloadJsonObject<any[]>(sbUrl, serviceKey, 'catalog/index.json');
      const parsed = Array.isArray(rawIndex)
        ? (rawIndex.map(sanitizeStoredProduct).filter(Boolean) as WebsiteProduct[])
        : [];
      if (parsed.length > 0) {
        nextProducts = parsed;
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

function resolveProductForPublic(
  p: WebsiteProduct,
  mediaMap: Record<string, StoreMediaEntry>
): WebsiteProduct & { _hasTelegramMedia: boolean; _searchBlob: string } {
  const mediaEntry = p.mediaId ? mediaMap[p.mediaId] : undefined;
  let resolvedImage = '';
  if (mediaEntry?.telegramFileId) {
    resolvedImage = `/api/store-media/${encodeURIComponent(p.mediaId!)}`;
  } else if (isSafeLocalAsset(p.imageUrl)) {
    resolvedImage = p.imageUrl!;
  } else {
    resolvedImage = getProductImageUrl({ id: p.id, category: p.category });
  }

  const validAttachments = Array.isArray(p.attachments)
    ? p.attachments.filter((att) => Boolean(mediaMap[att.id]?.telegramFileId))
    : undefined;

  const searchBlob = normalizeArabicSearch(
    [p.name, p.code, p.brand, p.subCategory || '', p.description, ...(p.specs || [])].join(' ')
  );

  return {
    ...p,
    imageUrl: resolvedImage,
    attachments: validAttachments && validAttachments.length > 0 ? validAttachments : undefined,
    _hasTelegramMedia: Boolean(mediaEntry?.telegramFileId),
    _searchBlob: searchBlob,
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
    const customCmsProducts = Array.isArray(cmsProducts)
      ? cmsProducts.filter((item) => item?.id && !LEGACY_DUMMY_PRODUCT_IDS.has(item.id) && Number(item.price) > 0)
      : [];
    for (const item of customCmsProducts) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      if (item.code) seenCodes.add(item.code.toLowerCase());
      combinedRaw.push(item);
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
    if (tokens.length > 0) {
      for (const tok of tokens) {
        if (!item._searchBlob.includes(tok)) return false;
      }
    }
    return true;
  });

  const sortMode = params.sort || 'featured';
  if (sortMode === 'featured') {
    matched.sort((a, b) => {
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
    const { _hasTelegramMedia: _m, _searchBlob: _s, _idx: _i, ...pub } = it;
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
