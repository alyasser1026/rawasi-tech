/**
 * lib/store-copilot-tools.ts
 * طبقة أدوات كوبايلوت المتجر على السيرفر:
 * تنفّذ الاستعلامات عبر دوال Supabase RPC المفهرسة، وتدمج المعرفة الهندسية،
 * وتجهّز تعريفات الأدوات الموحدة لكلٍ من Gemini 2.5 Flash و Groq Failover.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { searchSiteKnowledge } from '@/lib/copilot/chat-knowledge';
import {
  getCachedCopilotTraining,
  matchCopilotKnowledge,
} from '@/lib/copilot/training-store';
import {
  DEFAULT_MAINTENANCE_SERVICES,
  getProductImageUrl,
  PRODUCT_CATEGORIES,
  SMART_BUNDLES,
  type ProductCategoryId,
  type WebsiteProduct,
} from '@/app/site/store-catalog';
import { normalizeArabicSearch, queryStoreCatalog } from '@/lib/store-catalog-server';
import { filterRelevantCatalogProducts, inferCatalogIntent, scoreCatalogProduct } from '@/lib/copilot/catalog-relevance';
import type { ApprovedPolicyKnowledge } from '@/lib/copilot/response-policy';
import { getVerifiedActionContact } from '@/lib/copilot/handoff';
import { sanitizeDeliveryLocation } from '@/app/site/delivery-location';
import {
  sendCopilotEscalationTelegram,
  sendStoreTelegramNotification,
  type StoreTelegramOrderPayload,
} from '@/lib/store-order-telegram';

export interface CopilotProductCard {
  id: string;
  code: string;
  name: string;
  category: string;
  categoryTitle: string;
  subCategory: string;
  brand: string;
  unit: string;
  price: number;
  oldPrice: number | null;
  installPrice: number | null;
  currency: 'ج.م' | 'ر.س';
  badge: string | null;
  inStock: boolean;
  featured: boolean;
  imageUrl: string;
  specs: string[];
  shortDescription: string;
}

export interface CopilotOrderEstimateItem {
  productId: string;
  code: string;
  name: string;
  unit: string;
  qty: number;
  price: number;
  installPrice: number;
  withInstall: boolean;
  currency: 'ج.م' | 'ر.س';
  lineSupplyTotal: number;
  lineInstallTotal: number;
  lineTotal: number;
  installNeedsQuote: boolean;
}

export interface CopilotOrderEstimate {
  items: CopilotOrderEstimateItem[];
  missingItems: unknown[];
  supplySubtotal: number;
  installSubtotal: number;
  grandTotal: number;
  totalSaved: number;
  currency: 'ج.م' | 'ر.س';
  hasUnpricedItems: boolean;
  hasInstallation: boolean;
}

export interface CopilotCartActionItem extends CopilotOrderEstimateItem {
  category?: string;
  imageUrl?: string;
}

export interface CopilotCartAction {
  action: 'add';
  items: CopilotCartActionItem[];
}

export interface CopilotSubmittedOrder {
  id: string;
  refCode: string;
  orderType: 'store_order' | 'maintenance_request' | 'property_inquiry';
  customerName: string;
  customerPhone: string;
  city?: string;
  address?: string;
  withInstallation: boolean;
  supplySubtotal: number;
  installSubtotal: number;
  totalAmount: number;
  currency: 'ج.م' | 'ر.س';
  itemsCount: number;
  createdAt: string;
}

export interface CopilotActionLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface CopilotChatHistoryItem {
  role: 'user' | 'assistant';
  text: string;
}

export interface CopilotRequestBody {
  action?: 'chat' | 'estimate_order' | 'submit_order';
  message?: string;
  sessionId?: string;
  pageUrl?: string;
  activeProductId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  city?: string;
  address?: string;
  notes?: string;
  orderType?: 'store_order' | 'maintenance_request' | 'property_inquiry';
  withInstallation?: boolean;
  userId?: string | null;
  items?: Array<{
    productId?: string;
    product_id?: string;
    code?: string;
    qty?: number;
    withInstall?: boolean;
    with_install?: boolean;
  }>;
  maintenanceService?: {
    code?: string;
    title: string;
    mode?: string;
    preferredDate?: string;
  } | null;
  property?: {
    code?: string;
    title: string;
    areaSqm?: number;
    price?: number;
    currency?: string;
  } | null;
  cartItems?: Array<{
    productId: string;
    code?: string;
    name?: string;
    qty: number;
    withInstall?: boolean;
  }>;
  history?: CopilotChatHistoryItem[];
}

export interface CopilotResponsePayload {
  ok: boolean;
  sessionId: string;
  reply: string;
  provider: 'gemini' | 'groq' | 'rpc_fallback' | 'direct_action';
  products: CopilotProductCard[];
  estimate: CopilotOrderEstimate | null;
  cartAction: CopilotCartAction | null;
  submittedOrder: CopilotSubmittedOrder | null;
  escalated: boolean;
  quickReplies: string[];
  actions: CopilotActionLink[];
  toolsUsed: string[];
  latencyMs: number;
  error?: string;
}

export interface CatalogOverviewData {
  status: 'ok' | 'unavailable';
  total_products: number;
  in_stock_products: number;
  with_install_price_count: number;
  discounted_count: number;
  categories: Array<{
    category: string;
    product_count: number;
    in_stock_count: number;
    min_price: number | null;
    max_price: number | null;
  }>;
  top_brands: Array<{ brand: string; product_count: number }>;
}

export interface CopilotToolExecutionContext {
  verifiedPolicies?: ApprovedPolicyKnowledge[];
  sessionId: string;
  pageUrl?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  userId?: string | null;
  customerMessages?: string[];
  products: CopilotProductCard[];
  estimate: CopilotOrderEstimate | null;
  cartAction: CopilotCartAction | null;
  submittedOrder: CopilotSubmittedOrder | null;
  escalated: boolean;
  /** Derived by the server from an explicit customer request, never from model tool arguments. */
  handoffRequested?: boolean;
  submissionRequested?: boolean;
  actions: CopilotActionLink[];
  toolsUsed: string[];
}

const OVERVIEW_TTL_MS = 5 * 60_000;
const VALID_CAT_SET = new Set<string>(PRODUCT_CATEGORIES.map((c) => c.id));
const CAT_TITLE_MAP = new Map<string, string>(
  PRODUCT_CATEGORIES.map((c) => [c.id, c.shortTitle || c.title])
);

const g = globalThis as typeof globalThis & {
  __phiCopilotOverviewCache?: { loadedAt: number; data: CatalogOverviewData };
};

/**
 * ينشئ عميل Supabase بصلاحيات السيرفر (service_role) لتنفيذ دوال الـ RPC الآمنة.
 */
export function getServiceSupabase(): SupabaseClient | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function emptyOverview(status: 'ok' | 'unavailable' = 'unavailable'): CatalogOverviewData {
  return {
    status,
    total_products: 0,
    in_stock_products: 0,
    with_install_price_count: 0,
    discounted_count: 0,
    categories: [],
    top_brands: [],
  };
}

/**
 * يجلب خريطة الكتالوج الكلي (عدد المنتجات والأقسام وأهم الماركات) مع كاش 5 دقائق.
 */
export async function getCachedCatalogOverview(
  sb: SupabaseClient | null
): Promise<CatalogOverviewData> {
  const now = Date.now();
  const cached = g.__phiCopilotOverviewCache;
  if (cached && cached.data.total_products > 0 && now - cached.loadedAt < OVERVIEW_TTL_MS) {
    return cached.data;
  }

  if (sb) {
    try {
      const { data, error } = await sb.rpc('copilot_catalog_overview');
      if (!error && data && typeof data === 'object' && Number(data.total_products || 0) > 0) {
        const parsed: CatalogOverviewData = {
          status: 'ok',
          total_products: Number(data.total_products || 0),
          in_stock_products: Number(data.in_stock_products || 0),
          with_install_price_count: Number(data.with_install_price_count || 0),
          discounted_count: Number(data.discounted_count || 0),
          categories: Array.isArray(data.categories) ? data.categories : [],
          top_brands: Array.isArray(data.top_brands) ? data.top_brands : [],
        };
        g.__phiCopilotOverviewCache = { loadedAt: now, data: parsed };
        return parsed;
      }
    } catch {
      // Fall through to storage overview fallback
    }
  }

  try {
    const res = await queryStoreCatalog({ page: 1, pageSize: 12 });
    if (res.totalCatalog > 0) {
      const cats = Object.entries(res.categoryCounts)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([category, product_count]) => ({
          category,
          product_count,
          in_stock_count: product_count,
          min_price: null,
          max_price: null,
        }));
      const fallback: CatalogOverviewData = {
        status: 'ok',
        total_products: res.totalCatalog,
        in_stock_products: res.totalCatalog,
        with_install_price_count: 0,
        discounted_count: 0,
        categories: cats,
        top_brands: res.brandCounts.slice(0, 15).map((b) => ({
          brand: b.brand,
          product_count: b.count,
        })),
      };
      g.__phiCopilotOverviewCache = { loadedAt: now, data: fallback };
      return fallback;
    }
  } catch {
    // ignore storage fallback failure
  }

  return cached?.data.status === 'ok' ? cached.data : emptyOverview('unavailable');
}

/**
 * يحوّل ملخص الكتالوج إلى نص موجز يوجّه الذكاء الاصطناعي لأقسام المتجر والماركات الفعلية.
 */
export function formatCatalogOverviewForPrompt(overview: CatalogOverviewData): string {
  if (overview.status !== 'ok' || overview.total_products <= 0) {
    return 'حالة اتصال الكتالوج غير مؤكدة مؤقتاً — ممنوع ذكر أن عدد المنتجات يساوي صفر؛ اعتمد فقط على نتائج الأدوات المباشرة أو أخبر العميل عند تعذر القراءة.';
  }
  const catLines = overview.categories
    .slice(0, 14)
    .map((c) => `${c.category} (${CAT_TITLE_MAP.get(c.category) || c.category}: ${c.product_count})`)
    .join(' | ');
  const brandLines = overview.top_brands
    .slice(0, 15)
    .map((b) => `${b.brand} (${b.product_count})`)
    .join('، ');
  return [
    `إجمالي منتجات المتجر المفهرسة: ${overview.total_products.toLocaleString('en-US')} (المتوفر: ${overview.in_stock_products.toLocaleString('en-US')})`,
    catLines ? `الأقسام (المعرف: العدد): ${catLines}` : '',
    brandLines ? `أبرز الماركات: ${brandLines}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function normalizeSpecs(rawSpecs: unknown): string[] {
  if (!Array.isArray(rawSpecs)) return [];
  return rawSpecs
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function resolveCardImageUrl(id: string, category: string, rawUrl: unknown): string {
  const clean = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (clean) return clean;
  const safeCategory: ProductCategoryId = VALID_CAT_SET.has(category)
    ? (category as ProductCategoryId)
    : 'building_materials';
  return getProductImageUrl({ id, category: safeCategory, imageUrl: undefined });
}

function mapRpcRowToCard(row: any): CopilotProductCard {
  const category = String(row?.category || 'building_materials');
  const id = String(row?.id || '');
  const price = Number(row?.price || 0);
  const oldPriceRaw = row?.old_price !== undefined && row?.old_price !== null ? Number(row.old_price) : null;
  const installRaw =
    row?.install_price !== undefined && row?.install_price !== null ? Number(row.install_price) : null;

  return {
    id,
    code: String(row?.code || 'PHI-ITEM'),
    name: String(row?.name || ''),
    category,
    categoryTitle: CAT_TITLE_MAP.get(category) || category,
    subCategory: String(row?.sub_category || ''),
    brand: String(row?.brand || 'PhiTech'),
    unit: String(row?.unit || 'قطعة'),
    price: Number.isFinite(price) ? price : 0,
    oldPrice: oldPriceRaw !== null && Number.isFinite(oldPriceRaw) && oldPriceRaw > price ? oldPriceRaw : null,
    installPrice: installRaw !== null && Number.isFinite(installRaw) && installRaw >= 0 ? installRaw : null,
    currency: row?.currency === 'ر.س' ? 'ر.س' : 'ج.م',
    badge: typeof row?.badge === 'string' && row.badge.trim() ? row.badge.trim() : null,
    inStock: row?.in_stock !== false,
    featured: Boolean(row?.featured),
    imageUrl: resolveCardImageUrl(id, category, row?.image_url),
    specs: normalizeSpecs(row?.specs),
    shortDescription: String(row?.short_description || '').slice(0, 180),
  };
}

function mapWebsiteProductToCard(p: WebsiteProduct): CopilotProductCard {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category,
    categoryTitle: CAT_TITLE_MAP.get(p.category) || p.category,
    subCategory: p.subCategory || '',
    brand: p.brand,
    unit: p.unit,
    price: Number(p.price || 0),
    oldPrice: p.oldPrice && p.oldPrice > p.price ? Number(p.oldPrice) : null,
    installPrice: p.installPrice !== undefined ? Number(p.installPrice) : null,
    currency: p.currency === 'ر.س' ? 'ر.س' : 'ج.م',
    badge: p.badge || null,
    inStock: p.inStock !== false,
    featured: Boolean(p.featured),
    imageUrl: getProductImageUrl(p),
    specs: normalizeSpecs(p.specs),
    shortDescription: String(p.description || '').slice(0, 180),
  };
}

function pushUniqueProducts(ctx: CopilotToolExecutionContext, cards: CopilotProductCard[], maxKeep = 6): void {
  const seen = new Set(ctx.products.map((p) => p.id));
  for (const card of cards) {
    if (!card.id || seen.has(card.id)) continue;
    seen.add(card.id);
    ctx.products.push(card);
    if (ctx.products.length >= maxKeep) break;
  }
}

function recordProductWarranty(ctx: CopilotToolExecutionContext, product: CopilotProductCard): void {
  const facts = product.specs.filter(spec => /ضمان|warranty/i.test(spec));
  if (!facts.length) return;
  const id = `catalog-warranty:${product.id}`;
  ctx.verifiedPolicies = [
    ...(ctx.verifiedPolicies || []).filter(item => item.id !== id),
    { id, title: `ضمان المنتج ${product.name} (${product.code})`, category: 'warranty', keywords: ['ضمان', 'warranty'], answer: facts.join('؛ '), is_active: true },
  ];
}

function pushUniqueAction(ctx: CopilotToolExecutionContext, action: CopilotActionLink): void {
  if (!action.href || !action.label) return;
  if (ctx.actions.some((a) => a.href === action.href && a.label === action.label)) return;
  if (ctx.actions.length < 4) ctx.actions.push(action);
}

function normalizeForWordCheck(text: string): string {
  return normalizeArabicSearch(text)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesWholeWordToken(text: string, token: string): boolean {
  const normText = normalizeForWordCheck(text);
  const normTok = normalizeForWordCheck(token);
  if (!normText || !normTok) return false;
  const esc = normTok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)(?:و|ب|ل|ال|وال|بال)?${esc}(?:ه)?(?:\\s|$)`, 'i').test(normText);
}

function isSuspiciousPrice(c: CopilotProductCard): boolean {
  if (c.price <= 0) return true;
  if (c.oldPrice !== null && c.price > 0 && c.oldPrice / c.price > 3.0) return true;
  if (c.category === 'doors_windows' && /باب مصفح/.test(c.name) && c.price < 500) return true;
  return false;
}

function compactCardForLlm(c: CopilotProductCard) {
  const priceNeedsReview = isSuspiciousPrice(c);
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    brand: c.brand,
    category: c.categoryTitle,
    price: priceNeedsReview ? null : c.price,
    oldPrice: priceNeedsReview ? null : c.oldPrice,
    installPrice: c.installPrice,
    currency: c.currency,
    unit: c.unit,
    inStock: c.inStock,
    priceNeedsReview,
    ...(priceNeedsReview
      ? { priceNote: 'السعر غير مؤكد ويحتاج مراجعة وتأكيد من المبيعات قبل الاعتماد.' }
      : {}),
    specs: c.specs.slice(0, 4),
  };
}

function normalizeItemsInput(rawItems: unknown): Array<{
  product_id?: string;
  code?: string;
  qty: number;
  with_install: boolean;
}> {
  if (!Array.isArray(rawItems)) return [];
  const clean: Array<{ product_id?: string; code?: string; qty: number; with_install: boolean }> = [];
  for (const raw of rawItems.slice(0, 25)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const productId = String(item.product_id ?? item.productId ?? '').trim();
    const code = String(item.code ?? '').trim();
    if (!productId && !code) continue;
    const rawQty = Number(item.qty ?? 1);
    const qty = Number.isFinite(rawQty) ? Math.min(1000, Math.max(1, Math.round(rawQty))) : 1;
    const withInstall =
      item.with_install === true ||
      item.withInstall === true ||
      String(item.with_install ?? item.withInstall ?? '').toLowerCase() === 'true';
    clean.push({
      ...(productId ? { product_id: productId } : {}),
      ...(code ? { code } : {}),
      qty,
      with_install: withInstall,
    });
  }
  return clean;
}

function mapRpcEstimateToOrderEstimate(data: any): CopilotOrderEstimate {
  const items: CopilotOrderEstimateItem[] = Array.isArray(data?.items)
    ? data.items.map((it: any) => ({
        productId: String(it.productId || ''),
        code: String(it.code || ''),
        name: String(it.name || ''),
        unit: String(it.unit || 'قطعة'),
        qty: Number(it.qty || 1),
        price: Number(it.price || 0),
        installPrice: Number(it.installPrice || 0),
        withInstall: Boolean(it.withInstall),
        currency: it.currency === 'ر.س' ? 'ر.س' : 'ج.م',
        lineSupplyTotal: Number(it.lineSupplyTotal || 0),
        lineInstallTotal: Number(it.lineInstallTotal || 0),
        lineTotal: Number(it.lineTotal || 0),
        installNeedsQuote: Boolean(it.installNeedsQuote),
      }))
    : [];

  return {
    items,
    missingItems: Array.isArray(data?.missing_items) ? data.missing_items : [],
    supplySubtotal: Number(data?.supply_subtotal || 0),
    installSubtotal: Number(data?.install_subtotal || 0),
    grandTotal: Number(data?.grand_total || 0),
    totalSaved: Number(data?.total_saved || 0),
    currency: data?.currency === 'ر.س' ? 'ر.س' : 'ج.م',
    hasUnpricedItems: Boolean(data?.has_unpriced_items),
    hasInstallation: Boolean(data?.has_installation),
  };
}

const SELECT_PRODUCT_COLS =
  'id,code,name,category,sub_category,brand,unit,price,old_price,install_price,currency,badge,in_stock,featured,media_id,image_url,specs,description';

function mapTableRowToCard(r: any): CopilotProductCard {
  return mapRpcRowToCard({
    ...r,
    image_url:
      r.media_id && String(r.media_id).trim()
        ? `/api/store-media/${String(r.media_id).trim()}`
        : r.image_url,
    short_description: String(r.description || '').slice(0, 180),
  });
}

async function queryCatalogPrecisionRows(
  sb: SupabaseClient,
  orExpr: string,
  options: {
    inStockOnly?: boolean;
    brand?: string | null;
    minPrice?: number | null;
    maxPrice?: number | null;
    excludeRegex?: RegExp;
    limit?: number;
  }
): Promise<{ cards: CopilotProductCard[]; failed: boolean }> {
  try {
    let qb = sb
      .from('store_catalog_products')
      .select(SELECT_PRODUCT_COLS)
      .or(orExpr)
      .order('in_stock', { ascending: false })
      .order('featured', { ascending: false })
      .order('price', { ascending: true })
      .limit(Math.max(12, options.limit || 8));

    if (options.inStockOnly) qb = qb.eq('in_stock', true);
    if (options.brand) qb = qb.ilike('brand', `%${options.brand}%`);
    if (options.minPrice !== null && options.minPrice !== undefined) qb = qb.gte('price', options.minPrice);
    if (options.maxPrice !== null && options.maxPrice !== undefined) {
      qb = qb.gt('price', 0).lte('price', options.maxPrice);
    }

    const { data, error } = await qb;
    if (error || !Array.isArray(data)) return { cards: [], failed: true };
    const mapped = data
      .map(mapTableRowToCard)
      .filter((c) => !options.excludeRegex || !options.excludeRegex.test(`${c.name} ${c.brand} ${c.code}`));
    return { cards: mapped.slice(0, options.limit || 6), failed: false };
  } catch {
    return { cards: [], failed: true };
  }
}

/**
 * 1) البحث الدقيق في الـ 11,361 منتجاً عبر جميع الأقسام مع حماية الحدود اللفظية ومنع أخطاء التصنيف.
 */
export async function execSearchProducts(
  sb: SupabaseClient | null,
  args: Record<string, unknown>,
  ctx: CopilotToolExecutionContext
) {
  ctx.toolsUsed.push('search_products');
  const query = String(args.query ?? '').trim();
  const categoryRaw = typeof args.category === 'string' ? args.category.trim() : '';
  const category = categoryRaw && VALID_CAT_SET.has(categoryRaw) ? categoryRaw : null;
  const brand = typeof args.brand === 'string' && args.brand.trim() ? args.brand.trim() : null;
  const minPrice = Number.isFinite(Number(args.min_price)) ? Number(args.min_price) : null;
  const maxPrice = Number.isFinite(Number(args.max_price)) ? Number(args.max_price) : null;
  const inStockOnly = args.in_stock_only !== false;
  const sortRaw = String(args.sort || 'relevance');
  const sort = sortRaw === 'price_asc' || sortRaw === 'price_desc' ? sortRaw : 'relevance';
  const limit = Math.min(8, Math.max(1, Number(args.limit) || 6));

  const normQ = normalizeForWordCheck(query);
  const intent = inferCatalogIntent(query);
  const hasWord = (tok: string) => matchesWholeWordToken(normQ, tok);

  let cards: CopilotProductCard[] = [];
  let rpcFailed = false;
  let fallbackFailed = false;

  if (sb) {
    const commonOpts = { inStockOnly, brand, minPrice, maxPrice, limit };
    try {
      if (intent.family === 'gas_heater') {
        const res = await queryCatalogPrecisionRows(sb,
          'name.ilike.%سخان%غاز%,name.ilike.%غاز%سخان%,name.ilike.%gas%heater%',
          commonOpts);
        cards = res.cards;
        rpcFailed = res.failed;
      } else if (intent.family === 'smart_lock') {
        const res = await queryCatalogPrecisionRows(sb,
          'name.ilike.%كالون%سمارت%,name.ilike.%كالون%تاتش%,name.ilike.%قفل%ذكي%,name.ilike.%smart%lock%,code.ilike.KDL-%',
          commonOpts);
        cards = res.cards;
        rpcFailed = res.failed;
      } else if (/^(?:.* )?(?:دور لوك|دورلوك|door lock)(?: .*)?$/.test(normQ)) {
        const res = await queryCatalogPrecisionRows(
          sb,
          'code.ilike.KDL-%,name.ilike.%كالون تاتش%,name.ilike.%كالون سمارت%,name.ilike.%قفل ذكي%',
          { ...commonOpts, excludeRegex: /رف حمام|ركن|فوطه|فوماجالي|مشترك/i }
        );
        cards = res.cards;
        rpcFailed = res.failed;
      } else if (hasWord('اكسس') || hasWord('access')) {
        const res = await queryCatalogPrecisionRows(
          sb,
          'name.ilike.%اكسس كنترول%,name.ilike.%أكسس كنترول%,code.ilike.KLP-%,code.ilike.KDL-%',
          { ...commonOpts, excludeRegex: /رف حمام|ركن|بانوكس|2 دور|فوطه/i }
        );
        cards = res.cards;
        rpcFailed = res.failed;
      } else if ((hasWord('قفل') || hasWord('اقفال')) && (hasWord('باب') || hasWord('ابواب'))) {
        const res = await queryCatalogPrecisionRows(
          sb,
          'code.ilike.KDL-%,name.ilike.%كالون%,name.ilike.%قفل باب%,name.ilike.%قفل بمفتاح%',
          { ...commonOpts, excludeRegex: /باب داخلي صيني/i }
        );
        cards = res.cards;
        rpcFailed = res.failed;
      } else if (hasWord('بواط') || hasWord('بواطات')) {
        const [elecRes, rpcRes] = await Promise.all([
          queryCatalogPrecisionRows(
            sb,
            'code.ilike.MMJB-%,name.ilike.%بواط كهرباء%,name.ilike.%بواط صاج%,name.ilike.%بواط دفن%',
            commonOpts
          ),
          sb.rpc('copilot_search_products', {
            p_query: query,
            p_category: null,
            p_brand: brand,
            p_min_price: minPrice,
            p_max_price: maxPrice,
            p_in_stock_only: inStockOnly,
            p_sort: sort,
            p_limit: limit,
          }),
        ]);
        const seen = new Set<string>();
        const merged: CopilotProductCard[] = [];
        for (const c of elecRes.cards) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            merged.push(c);
          }
        }
        if (!rpcRes.error && Array.isArray(rpcRes.data)) {
          for (const r of rpcRes.data) {
            const c = mapRpcRowToCard(r);
            if (!seen.has(c.id) && matchesWholeWordToken(c.name, 'بواط')) {
              seen.add(c.id);
              merged.push(c);
            }
          }
        }
        cards = merged.slice(0, limit);
        rpcFailed = elecRes.failed && Boolean(rpcRes.error);
      } else if ((hasWord('فيش') || hasWord('فيشه')) && !hasWord('فيشر')) {
        const { data, error } = await sb.rpc('copilot_search_products', {
          p_query: normQ === 'فيش' ? 'فيشة' : query,
          p_category: null,
          p_brand: brand,
          p_min_price: minPrice,
          p_max_price: maxPrice,
          p_in_stock_only: inStockOnly,
          p_sort: sort,
          p_limit: 12,
        });
        if (!error && Array.isArray(data)) {
          cards = data
            .map(mapRpcRowToCard)
            .filter(
              (c) =>
                !/فيشر|fischer/i.test(`${c.name} ${c.brand} ${c.code}`) &&
                (matchesWholeWordToken(c.name, 'فيش') ||
                  matchesWholeWordToken(c.name, 'فيشه') ||
                  matchesWholeWordToken(c.name, 'بريزه') ||
                  matchesWholeWordToken(c.name, 'مقبس'))
            )
            .slice(0, limit);
        } else {
          rpcFailed = true;
        }
      } else {
        const { data, error } = await sb.rpc('copilot_search_products', {
          p_query: query,
          p_category: category,
          p_brand: brand,
          p_min_price: minPrice,
          p_max_price: maxPrice,
          p_in_stock_only: inStockOnly,
          p_sort: sort,
          p_limit: limit,
        });

        if (!error && Array.isArray(data)) {
          let mapped = data.map(mapRpcRowToCard);
          const toks = normQ.split(' ').filter(Boolean);
          if (toks.length === 1 && toks[0].length <= 4) {
            const wholeOnly = mapped.filter(
              (c) =>
                matchesWholeWordToken(`${c.name} ${c.code} ${c.brand}`, toks[0]) ||
                c.code.toLowerCase() === query.toLowerCase()
            );
            if (wholeOnly.length > 0) mapped = wholeOnly;
          }
          cards = mapped.slice(0, limit);

          // تسجيل الاستعلام الفارغ في الخلفية لتدريب المرادفات فقط عندما ينجح الاتصال وتكون النتيجة 0
          if (cards.length === 0 && query.length >= 2) {
            void sb
              .rpc('copilot_log_search_miss', {
                p_query: query,
                p_category: category,
                p_brand: brand,
                p_page_url: ctx.pageUrl || ctx.sessionId,
              })
              .then(undefined, () => undefined);
          }
        } else {
          rpcFailed = true;
        }
      }
    } catch {
      rpcFailed = true;
    }
  } else {
    rpcFailed = true;
  }

  if (rpcFailed) {
    try {
      const res = await queryStoreCatalog({
        q: query || undefined,
        category: category || undefined,
        brands: brand ? [brand] : undefined,
        onlyInStock: inStockOnly,
        minPrice,
        maxPrice,
        sort: sort === 'price_asc' || sort === 'price_desc' ? sort : 'featured',
        page: 1,
        pageSize: limit,
      });
      cards = res.items.slice(0, limit).map(mapWebsiteProductToCard);
    } catch {
      fallbackFailed = true;
      cards = [];
    }
  }

  if (rpcFailed && fallbackFailed) {
    return {
      ok: false,
      status: 'catalog_read_error',
      totalReturned: 0,
      products: [],
      error: 'تعذر قراءة الكتالوج حالياً — أخبر العميل أن الاتصال بقاعدة المنتجات متعثر مؤقتاً ولا تقل إن المتجر بدون منتجات.',
    };
  }

  cards = filterRelevantCatalogProducts(cards, query);
  if (sort === 'relevance') cards.sort((a, b) => scoreCatalogProduct(b, query) - scoreCatalogProduct(a, query));
  pushUniqueProducts(ctx, cards, 6);

  if (category) {
    pushUniqueAction(ctx, {
      label: `🛒 تصفح قسم ${CAT_TITLE_MAP.get(category) || category}`,
      href: `/store?cat=${category}`,
    });
  } else if (cards.length > 0) {
    pushUniqueAction(ctx, { label: '🛒 تصفح المتجر الكامل', href: '/store' });
  }

  return {
    ok: true,
    status: cards.length > 0 ? 'found' : 'no_match',
    totalReturned: cards.length,
    products: cards.map(compactCardForLlm),
    ...(cards.length === 0
      ? {
          hint: 'لم تظهر نتائج مطابقة تماماً. اسأل سؤال توضيح أو جرّب البحث بكلمة أعم أو بالكود.',
        }
      : {}),
  };
}

/**
 * 2) جلب مواصفات منتج كامل + 3 بدائل مقترحة via copilot_get_product_details.
 */
export async function execGetProductDetails(
  sb: SupabaseClient | null,
  args: Record<string, unknown>,
  ctx: CopilotToolExecutionContext
) {
  ctx.toolsUsed.push('get_product_details');
  const productId = String(args.product_id ?? args.productId ?? '').trim() || null;
  const code = String(args.code ?? '').trim() || null;
  if (!productId && !code) {
    return { found: false, error: 'يجب تمرير product_id أو code' };
  }

  if (sb) {
    try {
      const { data, error } = await sb.rpc('copilot_get_product_details', {
        p_product_id: productId,
        p_code: code,
      });
      if (!error && data && typeof data === 'object') {
        if (!data.found || !data.product) {
          return { found: false, message: 'المنتج غير موجود في الكتالوج' };
        }
        const mainCard = mapRpcRowToCard(data.product);
        recordProductWarranty(ctx, mainCard);
        const rawAlts: CopilotProductCard[] = Array.isArray(data.alternatives)
          ? data.alternatives.map((a: any) =>
              mapRpcRowToCard({ ...a, category: mainCard.category })
            )
          : [];
        const alts = filterRelevantCatalogProducts(rawAlts, mainCard.name);
        pushUniqueProducts(ctx, [mainCard, ...alts], 6);

        return {
          found: true,
          product: {
            ...compactCardForLlm(mainCard),
            description: String(data.product.description || '').slice(0, 500),
            variants: Array.isArray(data.product.variants) ? data.product.variants.slice(0, 6) : [],
            attachmentsCount: Array.isArray(data.product.attachments) ? data.product.attachments.length : 0,
            fullSpecs: normalizeSpecs(data.product.specs),
          },
          alternatives: alts.map(compactCardForLlm),
        };
      }
    } catch {
      // Fall through to storage fallback
    }
  }

  try {
    const res = await queryStoreCatalog({ q: code || productId || '', page: 1, pageSize: 12 });
    const found = res.items.find(
      (p) => (productId && p.id === productId) || (code && p.code.toLowerCase() === code.toLowerCase())
    );
    if (!found) return { found: false, message: 'المنتج غير موجود في الكتالوج' };
    const card = mapWebsiteProductToCard(found);
    recordProductWarranty(ctx, card);
    pushUniqueProducts(ctx, [card], 6);
    return { found: true, product: compactCardForLlm(card), alternatives: [] };
  } catch {
    return { found: false, message: 'تعذر قراءة تفاصيل المنتج حالياً' };
  }
}

/**
 * 3) تسعير وحساب تكلفة الطلب (توريد فقط vs توريد + تركيب) رسمياً من قاعدة البيانات.
 */
export async function execCalculateOrderWithInstall(
  sb: SupabaseClient | null,
  args: Record<string, unknown>,
  ctx: CopilotToolExecutionContext
) {
  ctx.toolsUsed.push('calculate_order_with_install');
  const normalizedItems = normalizeItemsInput(args.items);
  if (normalizedItems.length === 0) {
    return { ok: false, error: 'يجب تمرير قائمة منتجات صالحة (product_id أو code مع qty)' };
  }

  if (sb) {
    try {
      const { data, error } = await sb.rpc('copilot_estimate_order', {
        p_items: normalizedItems,
      });
      if (!error && data && typeof data === 'object') {
        const estimate = mapRpcEstimateToOrderEstimate(data);
        ctx.estimate = estimate;
        return { ok: true, estimate };
      }
    } catch {
      // Fall through to storage calculation fallback
    }
  }

  // Fallback computation from storage catalog
  const allRes = await queryStoreCatalog({ page: 1, pageSize: 60 });
  const lines: CopilotOrderEstimateItem[] = [];
  const missingItems: unknown[] = [];
  let supplySubtotal = 0;
  let installSubtotal = 0;
  let totalSaved = 0;

  for (const reqItem of normalizedItems) {
    let matched = allRes.items.find(
      (p) =>
        (reqItem.product_id && p.id === reqItem.product_id) ||
        (reqItem.code && p.code.toLowerCase() === reqItem.code.toLowerCase())
    );
    if (!matched && (reqItem.code || reqItem.product_id)) {
      const qRes = await queryStoreCatalog({ q: reqItem.code || reqItem.product_id, page: 1, pageSize: 10 });
      matched = qRes.items.find(
        (p) =>
          (reqItem.product_id && p.id === reqItem.product_id) ||
          (reqItem.code && p.code.toLowerCase() === reqItem.code.toLowerCase())
      );
    }
    if (!matched) {
      missingItems.push(reqItem);
      continue;
    }
    const price = Number(matched.price || 0);
    const installPrice = Number(matched.installPrice || 0);
    const lineSupplyTotal = Math.round(price * reqItem.qty * 100) / 100;
    const lineInstallTotal = reqItem.with_install ? Math.round(installPrice * reqItem.qty * 100) / 100 : 0;
    supplySubtotal += lineSupplyTotal;
    installSubtotal += lineInstallTotal;
    if (matched.oldPrice && matched.oldPrice > price) {
      totalSaved += (matched.oldPrice - price) * reqItem.qty;
    }
    lines.push({
      productId: matched.id,
      code: matched.code,
      name: matched.name,
      unit: matched.unit,
      qty: reqItem.qty,
      price,
      installPrice,
      withInstall: reqItem.with_install,
      currency: matched.currency === 'ر.س' ? 'ر.س' : 'ج.م',
      lineSupplyTotal,
      lineInstallTotal,
      lineTotal: lineSupplyTotal + lineInstallTotal,
      installNeedsQuote: reqItem.with_install && installPrice <= 0,
    });
  }

  const estimate: CopilotOrderEstimate = {
    items: lines,
    missingItems,
    supplySubtotal: Math.round(supplySubtotal * 100) / 100,
    installSubtotal: Math.round(installSubtotal * 100) / 100,
    grandTotal: Math.round((supplySubtotal + installSubtotal) * 100) / 100,
    totalSaved: Math.round(totalSaved * 100) / 100,
    currency: lines[0]?.currency || 'ج.م',
    hasUnpricedItems: lines.some((l) => l.price <= 0),
    hasInstallation: lines.some((l) => l.withInstall),
  };
  ctx.estimate = estimate;
  return { ok: true, estimate };
}

/**
 * 4) البحث في خدمات التنفيذ والتركيبات والصيانة والباقات الذكية ودليل التنفيذ الهندسي.
 */
export async function execSearchExecutionAndMaintenance(
  sb: SupabaseClient | null,
  args: Record<string, unknown>,
  ctx: CopilotToolExecutionContext
) {
  ctx.toolsUsed.push('search_execution_and_maintenance');
  const query = String(args.query ?? '').trim();
  const nq = normalizeArabicSearch(query);
  const toks = nq.split(' ').filter((w) => w.length >= 2);

  const [knowledgeHit, training] = [
    searchSiteKnowledge(query),
    await getCachedCopilotTraining(sb),
  ];
  const trainedMatches = matchCopilotKnowledge(query, training.knowledge, 3);
  if (knowledgeHit?.actions?.length) {
    for (const act of knowledgeHit.actions) pushUniqueAction(ctx, act);
  }

  const matchedServices = DEFAULT_MAINTENANCE_SERVICES.filter((srv) => {
    const blob = normalizeArabicSearch(
      [
        srv.title,
        srv.category,
        srv.badge,
        ...srv.executionScope,
        ...srv.maintenanceScope,
        srv.recommendation,
      ].join(' ')
    );
    return toks.length === 0 || toks.some((t) => blob.includes(t));
  })
    .slice(0, 3)
    .map((s) => ({
      code: s.code,
      title: s.title,
      category: s.category,
      badge: s.badge,
      warranty: s.warrantyLabel,
      visitFee: s.visitFee,
      currency: s.currency,
      executionScope: s.executionScope,
      maintenanceScope: s.maintenanceScope,
      recommendation: s.recommendation,
    }));

  const matchedBundles = SMART_BUNDLES.filter((b) => {
    const blob = normalizeArabicSearch([b.title, b.subtitle, ...b.items].join(' '));
    return toks.some((t) => blob.includes(t)) || /باقه|سمارت|امان|درع|شقه ذكيه/.test(nq);
  }).map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    items: b.items,
  }));

  if (matchedServices.length > 0) {
    pushUniqueAction(ctx, { label: '🛠️ قسم الصيانة والتنفيذ', href: '/sections/maintenance' });
  }
  if (matchedBundles.length > 0) {
    pushUniqueAction(ctx, { label: '📱 قسم السمارت هوم', href: '/sections/smart-home' });
  }

  return {
    trainedKnowledge: trainedMatches.map((k) => ({
      title: k.title,
      category: k.category,
      answer: k.answer,
    })),
    knowledgeSummary: knowledgeHit?.replyText || null,
    maintenanceServices: matchedServices,
    smartBundles: matchedBundles,
  };
}

/**
 * 5) تجهيز حمولة إضافة المنتجات إلى سلة العميل الحية في المتصفح (بأسعار رسمية من قاعدة البيانات).
 */
export async function execPrepareCartAction(
  sb: SupabaseClient | null,
  args: Record<string, unknown>,
  ctx: CopilotToolExecutionContext
) {
  ctx.toolsUsed.push('prepare_cart_action');
  const availability = await checkRequestedProductsAvailable(sb, args.items);
  if (!availability.ok) return { ok: false, error: availability.error || 'تعذّر تأكيد توفر الأصناف لإضافتها للسلة.' };
  const estResult = await execCalculateOrderWithInstall(sb, { items: args.items }, ctx);
  // لا نكرر اسم الأداة لأن execCalculateOrderWithInstall أضافها تلقائياً عند الحساب
  if (!estResult.ok || !ctx.estimate || ctx.estimate.items.length === 0) {
    return { ok: false, error: 'لم أجد منتجات صالحة لإضافتها للسلة.' };
  }

  const cartItems: CopilotCartActionItem[] = ctx.estimate.items.map((item) => {
    const knownCard = ctx.products.find((p) => p.id === item.productId || p.code === item.code);
    return {
      ...item,
      ...(knownCard ? { category: knownCard.category, imageUrl: knownCard.imageUrl } : {}),
    };
  });

  ctx.cartAction = { action: 'add', items: cartItems };
  pushUniqueAction(ctx, { label: '🛒 عرض المتجر والسلة', href: '/store' });

  return {
    ok: true,
    addedCount: cartItems.length,
    items: cartItems,
    estimate: ctx.estimate,
  };
}

/** Re-read authoritative availability before a cart/order mutation; cached cards are display-only. */
export async function checkRequestedProductsAvailable(sb: SupabaseClient | null, rawItems: unknown): Promise<{ ok: boolean; error?: string }> {
  const items = normalizeItemsInput(rawItems);
  if (!sb || items.length === 0) return { ok: false, error: 'تعذر التحقق من المنتجات المطلوبة قبل تنفيذ الطلب.' };
  const ids = [...new Set(items.flatMap(item => item.product_id ? [item.product_id] : []))];
  const codes = [...new Set(items.flatMap(item => !item.product_id && item.code ? [item.code] : []))];
  try {
    const queries = [];
    if (ids.length) queries.push(sb.from('store_catalog_products').select('id,code,in_stock').in('id', ids));
    if (codes.length) queries.push(sb.from('store_catalog_products').select('id,code,in_stock').in('code', codes));
    const results = await Promise.all(queries);
    if (results.some(result => result.error || !Array.isArray(result.data))) return { ok: false, error: 'تعذر التحقق من توفر المنتجات. لم يتم إرسال الطلب.' };
    const rows = results.flatMap(result => result.data || []) as Array<{ id: string; code: string; in_stock: boolean }>;
    const byId = new Map(rows.map(row => [String(row.id), row]));
    const byCode = new Map(rows.map(row => [String(row.code).toLowerCase(), row]));
    for (const item of items) {
      const row = item.product_id ? byId.get(item.product_id) : byCode.get(String(item.code).toLowerCase());
      if (!row || (item.code && String(row.code).toLowerCase() !== item.code.toLowerCase())) return { ok: false, error: 'أحد المنتجات المطلوبة غير موجود أو تغيّرت بياناته. راجع المنتجات قبل إرسال الطلب.' };
      if (row.in_stock !== true) return { ok: false, error: 'أحد المنتجات المطلوبة غير متوفر حاليًا؛ لا يمكن تأكيد توريده أو تركيبه.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'تعذر التحقق من توفر المنتجات. لم يتم إرسال الطلب.' };
  }
}

const submissionTasks = new WeakMap<CopilotToolExecutionContext, ReturnType<typeof execSubmitOrderOrServiceOnce>>();
const escalationTasks = new WeakMap<CopilotToolExecutionContext, ReturnType<typeof execEscalateToEngineerOnce>>();

/** A repeated/parallel model tool call shares the first server-side mutation result. */
export function execSubmitOrderOrService(sb: SupabaseClient | null, args: Record<string, unknown>, ctx: CopilotToolExecutionContext) {
  const pending = submissionTasks.get(ctx);
  if (pending) return pending;
  const task = execSubmitOrderOrServiceOnce(sb, args, ctx);
  submissionTasks.set(ctx, task);
  return task;
}

/**
 * 6) إتمام الطلب أو حجز خدمة تركيب/صيانة وتثبيتها رسمياً في user_requests مع إشعار تليجرام فوري.
 */
async function execSubmitOrderOrServiceOnce(
  sb: SupabaseClient | null,
  args: Record<string, unknown>,
  ctx: CopilotToolExecutionContext
) {
  ctx.toolsUsed.push('submit_order_or_service');
  if (ctx.submittedOrder) return { ok: true, refCode: ctx.submittedOrder.refCode, order: ctx.submittedOrder };
  if (ctx.submissionRequested !== true) {
    return { ok: false, error: 'لم يؤكد العميل إرسال طلب أو حجز. اعرض التفاصيل واطلب تأكيد الإجراء قبل تنفيذه.' };
  }
  const orderTypeRaw = String(args.orderType || args.order_type || 'store_order');
  const orderType: 'store_order' | 'maintenance_request' | 'property_inquiry' =
    orderTypeRaw === 'maintenance_request'
      ? 'maintenance_request'
      : orderTypeRaw === 'property_inquiry'
        ? 'property_inquiry'
        : 'store_order';

  const customerEmail = String(args.customerEmail ?? args.customer_email ?? ctx.customerEmail ?? '').trim();
  const city = String(args.city ?? '').trim();
  const address = String(args.address ?? '').trim();
  const deliveryLocation = sanitizeDeliveryLocation(args.deliveryLocation ?? args.location);
  const notes = String(args.notes ?? '').trim();
  const contact = getVerifiedActionContact(args, ctx);
  if (!contact.ready) {
    return {
      ok: false,
      error: contact.prompt,
      missingFields: contact.missingFields,
    };
  }
  const { name: customerName, phone: customerPhone } = contact;

  const normalizedItems = normalizeItemsInput(args.items);
  if (orderType === 'store_order' && normalizedItems.length === 0) {
    return {
      ok: false,
      error: 'لا توجد منتجات محددة لإتمام الطلب. يرجى اختيار منتج واحد على الأقل.',
    };
  }

  const withInstallation =
    args.withInstallation === true ||
    args.with_installation === true ||
    normalizedItems.some((i) => i.with_install);

  const maintenanceService =
    args.maintenanceService && typeof args.maintenanceService === 'object'
      ? (args.maintenanceService as StoreTelegramOrderPayload['maintenanceService'])
      : null;
  const property =
    args.property && typeof args.property === 'object'
      ? (args.property as StoreTelegramOrderPayload['property'])
      : null;

  if (!sb) {
    return { ok: false, error: 'اتصال قاعدة البيانات غير متاح حالياً' };
  }
  if (orderType === 'store_order') {
    const availability = await checkRequestedProductsAvailable(sb, normalizedItems);
    if (!availability.ok) return availability;
  }

  const rpcPayload = {
    orderType,
    customerName,
    customerPhone,
    customerEmail,
    city,
    address,
    ...(deliveryLocation ? { deliveryLocation } : {}),
    notes,
    withInstallation,
    sessionId: ctx.sessionId,
    userId: ctx.userId || null,
    items: normalizedItems,
    maintenanceService,
    property,
  };

  const { data, error } = await sb.rpc('copilot_submit_order_or_service', {
    p_payload: rpcPayload,
  });

  if (error || !data || data.ok !== true || !data.id || !data.refCode) {
    return {
      ok: false,
      error: data?.error || error?.message || 'تعذر حفظ الطلب في قاعدة البيانات',
    };
  }

  const orderData = data.order || {};
  if (deliveryLocation) {
    const mergedDetails = {
      ...(orderData && typeof orderData === 'object' ? orderData : rpcPayload),
      deliveryLocation,
      browserSessionId: ctx.sessionId,
    };
    await sb
      .from('user_requests')
      .update({ details: JSON.stringify(mergedDetails) })
      .eq('id', String(data.id));
  }

  const submitted: CopilotSubmittedOrder = {
    id: String(data.id || data.refCode),
    refCode: String(data.refCode),
    orderType,
    customerName,
    customerPhone,
    city: city || undefined,
    address: address || undefined,
    withInstallation: Boolean(orderData.withInstallation ?? withInstallation),
    supplySubtotal: Number(orderData.supplySubtotal || 0),
    installSubtotal: Number(orderData.installSubtotal || 0),
    totalAmount: Number(orderData.totalAmount || 0),
    currency: orderData.currency === 'ر.س' ? 'ر.س' : 'ج.م',
    itemsCount: Array.isArray(orderData.items) ? orderData.items.length : 0,
    createdAt: String(orderData.createdAt || new Date().toISOString()),
  };

  ctx.submittedOrder = submitted;

  // إشعار فوري على تليجرام لفريق المبيعات والهندسة (لا يُفشل تأكيد الطلب عند تعذر الشبكة)
  await sendStoreTelegramNotification({
    refCode: submitted.refCode,
    orderType,
    source: 'store_copilot_ai',
    browserSessionId: ctx.sessionId || undefined,
    customerName,
    customerPhone,
    customerEmail: customerEmail || undefined,
    city: city || undefined,
    address: address || undefined,
    deliveryLocation: deliveryLocation || undefined,
    notes: notes || undefined,
    withInstallation: submitted.withInstallation,
    items: Array.isArray(orderData.items) ? orderData.items : [],
    maintenanceService,
    property,
    totalAmount: submitted.totalAmount,
    currency: submitted.currency,
  }).catch(() => undefined);

  return {
    ok: true,
    refCode: submitted.refCode,
    order: submitted,
  };
}

/**
 * 7) تصعيد المحادثة للمهندس المختص مع التحقق الفعلي من الحفظ والإرسال قبل تأكيد التحويل.
 */
export function execEscalateToEngineer(sb: SupabaseClient | null, args: Record<string, unknown>, ctx: CopilotToolExecutionContext) {
  const pending = escalationTasks.get(ctx);
  if (pending) return pending;
  const task = execEscalateToEngineerOnce(sb, args, ctx);
  escalationTasks.set(ctx, task);
  return task;
}

async function execEscalateToEngineerOnce(
  sb: SupabaseClient | null,
  args: Record<string, unknown>,
  ctx: CopilotToolExecutionContext
) {
  ctx.toolsUsed.push('escalate_to_engineer');
  if (ctx.escalated) return { ok: true, escalated: true, message: 'تم بالفعل تسجيل طلب المتابعة في هذه المحاولة.' };
  const contact = getVerifiedActionContact(args, ctx);
  if (!contact.ready) {
    return { ok: false, escalated: false, missingFields: contact.missingFields, error: contact.prompt };
  }
  if (ctx.handoffRequested !== true) {
    return { ok: false, escalated: false, error: 'لم يطلب العميل التحويل بعد. اعرض عليه التواصل مع الفريق واطلب موافقته؛ لا تقل تم التحويل.' };
  }
  const { name: customerName, phone: customerPhone } = contact;
  const reason = String(args.reason ?? 'طلب استشارة هندسية / تسعير خاص').trim().slice(0, 180);
  const summary = String(args.summary ?? reason).trim().slice(0, 600);
  const nowIso = new Date().toISOString();

  let dbSaved = false;
  if (sb) {
    try {
      const chatSessionId = ctx.sessionId.startsWith('CHAT-') ? ctx.sessionId : `CHAT-${ctx.sessionId}`;
      const sessionPayload = {
        sessionId: chatSessionId,
        visitorName: customerName || 'عميل المتجر',
        visitorPhone: customerPhone,
        pageUrl: ctx.pageUrl || '/store',
        updatedAt: nowIso,
        unreadByAdmin: 1,
        escalatedToHuman: true,
        escalationReason: reason,
        escalatedAt: nowIso,
        botPaused: false,
        lastIntent: 'copilot_escalation',
        messages: [
          {
            id: `cop-esc-${Date.now()}`,
            sender: 'visitor',
            senderName: customerName || 'عميل المتجر',
            text: summary,
            createdAt: nowIso,
          },
        ],
      };

      const insRes = await sb.from('user_requests').insert({
        user_id: ctx.userId || null,
        type: 'live_chat',
        category: chatSessionId,
        subject: `${customerName || 'عميل المتجر'} — ${customerPhone || 'بانتظار الرقم'}`,
        details: JSON.stringify(sessionPayload),
        status: '🚨 يطلب تدخل المهندس',
        admin_note: `[تحويل كوبايلوت] ${reason}`.slice(0, 160),
      }).select('id').single();
      dbSaved = !insRes.error && Boolean(insRes.data?.id);
    } catch {
      dbSaved = false;
    }
  }

  const telegramSent = await sendCopilotEscalationTelegram({
    sessionId: ctx.sessionId,
    customerName,
    customerPhone,
    reason,
    summary,
    pageUrl: ctx.pageUrl,
  });

  if (!dbSaved && !telegramSent) {
    ctx.escalated = false;
    return {
      ok: false,
      escalated: false,
      dbSaved: false,
      telegramSent: false,
      error:
        'تعذر تنفيذ التحويل الآلي حالياً — اعرض على العميل التواصل عبر واتساب أو الهاتف ولا تقل تم التحويل.',
    };
  }

  ctx.escalated = true;
  return {
    ok: true,
    escalated: true,
    dbSaved,
    telegramSent,
    hasPhone: customerPhone.replace(/\D/g, '').length >= 8,
    message:
      'تم تسجيل طلب التواصل للمتابعة مع القسم المختص (لا تعد بزمن رد محدد بالدقائق).',
  };
}

/**
 * 8) التحقق من العروض الترويجية السارية المعتمدة فعلياً في محتوى الموقع (بدون اختراع خصومات).
 */
export async function execGetActiveOffers(
  sb: SupabaseClient | null,
  args: Record<string, unknown>,
  ctx: CopilotToolExecutionContext
) {
  ctx.toolsUsed.push('get_active_offers');
  const categoryRaw = typeof args.category === 'string' ? args.category.trim() : '';
  const category = categoryRaw && VALID_CAT_SET.has(categoryRaw) ? categoryRaw : null;

  if (sb) {
    try {
      const { data, error } = await sb.rpc('website_public_content');
      if (!error && data && typeof data === 'object') {
        const promoBanner = (data as any).promoBanner;
        const storeOfferBanners = (data as any).storeOfferBanners;

        const promoBannerText =
          promoBanner?.enabled === true && typeof promoBanner?.text === 'string' && promoBanner.text.trim()
            ? promoBanner.text.trim()
            : null;

        const rawBannerItems: any[] =
          storeOfferBanners?.enabled === true && Array.isArray(storeOfferBanners?.items)
            ? storeOfferBanners.items
            : [];

        const offerBanners = rawBannerItems
          .filter((b) => b && (b.title || b.caption || b.subtitle))
          .slice(0, 6)
          .map((b) => ({
            title: String(b.title || b.caption || '').trim(),
            subtitle: String(b.subtitle || '').trim(),
          }));

        if (promoBannerText || offerBanners.length > 0) {
          ctx.verifiedPolicies = [
            ...(ctx.verifiedPolicies || []).filter(item => item.id !== 'cms-active-offers'),
            { id: 'cms-active-offers', title: 'العروض السارية المنشورة', category: 'sales_policy', keywords: ['خصم', 'خصومات', 'عروض'], answer: [promoBannerText, ...offerBanners.map(banner => `${banner.title}${banner.subtitle ? `: ${banner.subtitle}` : ''}`)].filter(Boolean).join('\n'), is_active: true },
          ];
          pushUniqueAction(ctx, { label: '🔥 تصفح المتجر', href: '/store' });
          return {
            ok: true,
            hasVerifiedActiveOffers: true,
            source: 'cms_website_public_content',
            requestedCategory: category ? CAT_TITLE_MAP.get(category) || category : null,
            promoBannerText,
            offerBannersCount: offerBanners.length,
            offerBanners,
            hasExpiryDate: false,
            note: 'لا توجد تواريخ انتهاء محددة في المصدر — اذكر نص العرض الساري المعتمد فقط ولا تخترع تاريخ انتهاء أو نسبة خصم غير مذكورة في النص، ثم اسأل العميل عن القسم المطلوب.',
          };
        }
      }
    } catch {
      // fall through to unavailable / none response
    }
  }

  return {
    ok: true,
    hasVerifiedActiveOffers: false,
    promoBannerText: null,
    offerBannersCount: 0,
    note: 'لا يوجد مصدر عروض سارية مؤكد حالياً — أخبر العميل بوضوح: محتاج أتأكد من العروض السارية قبل ما أقولك خصم، واسأله عن القسم المطلوب.',
  };
}

/**
 * موجّه موحّد لتنفيذ أي أداة يطلبها Gemini أو Groq.
 */
export async function executeCopilotToolCall(
  name: string,
  args: Record<string, unknown>,
  sb: SupabaseClient | null,
  ctx: CopilotToolExecutionContext
): Promise<Record<string, unknown>> {
  switch (name) {
    case 'search_products':
      return execSearchProducts(sb, args, ctx);
    case 'get_product_details':
      return execGetProductDetails(sb, args, ctx);
    case 'calculate_order_with_install':
      return execCalculateOrderWithInstall(sb, args, ctx);
    case 'search_execution_and_maintenance':
      return execSearchExecutionAndMaintenance(sb, args, ctx);
    case 'prepare_cart_action':
      return execPrepareCartAction(sb, args, ctx);
    case 'submit_order_or_service':
      return execSubmitOrderOrService(sb, args, ctx);
    case 'escalate_to_engineer':
      return execEscalateToEngineer(sb, args, ctx);
    case 'get_active_offers':
      return execGetActiveOffers(sb, args, ctx);
    default:
      return { ok: false, error: `أداة غير معروفة: ${name}` };
  }
}

/* ───────── تعريفات الأدوات الموحدة (Gemini + OpenAI/Groq) ───────── */

interface SchemaProp {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  properties?: Record<string, SchemaProp>;
  required?: string[];
  items?: {
    type: 'object' | 'string';
    properties?: Record<string, SchemaProp>;
    required?: string[];
  };
}

interface ToolSpec {
  name: string;
  description: string;
  properties: Record<string, SchemaProp>;
  required?: string[];
}

const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'search_products',
    description:
      'البحث الذكي في الـ 11,361 منتجاً بالمتجر (يدعم العامية المصرية، الماركات، الأكواد، والأسعار). استخدمها دائماً قبل ذكر أي منتج أو سعر.',
    properties: {
      query: { type: 'string', description: 'عبارة البحث أو اسم المنتج أو الكود أو العامية المصرية (مثل: فيشة شنايدر، خلاط جروهي، بلاعة، قفل ذكي).' },
      category: {
        type: 'string',
        description: 'معرف القسم الاختياري لتضييق البحث عند التأكد من القسم فقط.',
        enum: PRODUCT_CATEGORIES.map((c) => c.id),
      },
      brand: { type: 'string', description: 'اسم الماركة إن حدده العميل (مثل Schneider، جروهي، ديورافيت، السويدي).' },
      min_price: { type: 'number', description: 'أقل سعر مطلوب بالجنيه.' },
      max_price: { type: 'number', description: 'أقصى سعر مطلوب بالجنيه.' },
      in_stock_only: { type: 'boolean', description: 'فلترة المنتجات المتوفرة بالمخزون فقط.' },
      sort: {
        type: 'string',
        description: 'ترتيب النتائج.',
        enum: ['relevance', 'price_asc', 'price_desc'],
      },
      limit: { type: 'integer', description: 'عدد النتائج المطلوب (1 إلى 8، الافتراضي 6).' },
    },
    required: ['query'],
  },
  {
    name: 'get_active_offers',
    description:
      'التحقق من العروض والخصومات السارية المعتمدة رسمياً في محتوى الموقع فقط. استخدمها عند سؤال العميل عن آخر العروض أو أحدث العروض أو الخصومات.',
    properties: {
      category: {
        type: 'string',
        description: 'معرف القسم المطلوب التحقق من عروضه إن حدده العميل.',
        enum: PRODUCT_CATEGORIES.map((c) => c.id),
      },
    },
  },
  {
    name: 'get_product_details',
    description: 'جلب المواصفات الفنية الكاملة والوصف والبدائل المقترحة لمنتج محدد باستخدام product_id أو code.',
    properties: {
      product_id: { type: 'string', description: 'معرف المنتج الداخلي مثل cat-7583.' },
      code: { type: 'string', description: 'كود الصنف SKU مثل LKSDR000067.' },
    },
  },
  {
    name: 'calculate_order_with_install',
    description:
      'حساب إجمالي الطلب رسمياً من قاعدة البيانات (سعر التوريد فقط vs توريد + تركيب) لأي مجموعة منتجات وكميات.',
    properties: {
      items: {
        type: 'array',
        description: 'قائمة الأصناف المطلوب تسعيرها.',
        items: {
          type: 'object',
          properties: {
            product_id: { type: 'string', description: 'معرف المنتج مثل cat-7583.' },
            code: { type: 'string', description: 'كود الصنف مثل LKSDR000067.' },
            qty: { type: 'integer', description: 'الكمية المطلوبة (1 على الأقل).' },
            with_install: { type: 'boolean', description: 'true لو طلب العميل التوريد مع التركيب، false للتوريد فقط.' },
          },
          required: ['qty'],
        },
      },
    },
    required: ['items'],
  },
  {
    name: 'search_execution_and_maintenance',
    description:
      'البحث في خدمات التنفيذ والتركيبات والصيانة الهندسية (10 بنود) وباقات السمارت هوم ودليل التنفيذ وقائمة تفقد الاستلام.',
    properties: {
      query: { type: 'string', description: 'وصف الخدمة أو المشكلة أو الباقة (مثل: تسريب مية، باقة سمارت، تركيب تكييف، جيبسون بورد).' },
    },
    required: ['query'],
  },
  {
    name: 'prepare_cart_action',
    description:
      'تجهيز وإضافة منتج أو أكثر مباشرة إلى سلة المشتريات الخاصة بالعميل على الموقع مع خيار التوريد أو التركيب.',
    properties: {
      items: {
        type: 'array',
        description: 'الأصناف المطلوب إضافتها للسلة.',
        items: {
          type: 'object',
          properties: {
            product_id: { type: 'string', description: 'معرف المنتج.' },
            code: { type: 'string', description: 'كود الصنف.' },
            qty: { type: 'integer', description: 'الكمية.' },
            with_install: { type: 'boolean', description: 'إضافة مع خيار التركيب (true) أم توريد فقط (false).' },
          },
          required: ['qty'],
        },
      },
    },
    required: ['items'],
  },
  {
    name: 'submit_order_or_service',
    description:
      'تثبيت وإرسال طلب شراء أو حجز تركيب/صيانة رسمياً بعد تأكيد العميل وتزويد الاسم ورقم الجوال (8 أرقام على الأقل). لا تنادها قبل الحصول على الاسم والرقم والتأكيد.',
    properties: {
      orderType: {
        type: 'string',
        description: 'نوع الطلب: store_order للمنتجات، أو maintenance_request للتركيب/الصيانة، أو property_inquiry للعقارات.',
        enum: ['store_order', 'maintenance_request', 'property_inquiry'],
      },
      customerName: { type: 'string', description: 'اسم العميل الكامل.' },
      customerPhone: { type: 'string', description: 'رقم هاتف / واتساب العميل.' },
      city: { type: 'string', description: 'المدينة أو المحافظة.' },
      address: { type: 'string', description: 'العنوان التفصيلي أو المنطقة.' },
      notes: { type: 'string', description: 'ملاحظات العميل أو موعد المعاينة/التركيب المفضل.' },
      withInstallation: { type: 'boolean', description: 'هل يشمل الطلب خدمة التركيب؟' },
      items: {
        type: 'array',
        description: 'قائمة الأصناف المطلوب تثبيت طلبها (مطلوبة لنوع store_order).',
        items: {
          type: 'object',
          properties: {
            product_id: { type: 'string', description: 'معرف المنتج.' },
            code: { type: 'string', description: 'كود المنتج.' },
            qty: { type: 'integer', description: 'الكمية.' },
            with_install: { type: 'boolean', description: 'مطلوب تركيبه أم لا.' },
          },
          required: ['qty'],
        },
      },
      maintenanceService: {
        type: 'object',
        description: 'بيانات خدمة الصيانة/التنفيذ عند اختيار maintenance_request.',
        properties: {
          code: { type: 'string', description: 'كود الخدمة مثل PHI-MNT-01.' },
          title: { type: 'string', description: 'اسم الخدمة أو بند التركيب.' },
          mode: { type: 'string', description: 'نوع الطلب (صيانة / تركيب / معاينة).' },
          preferredDate: { type: 'string', description: 'الموعد المفضل للعميل.' },
        },
        required: ['title'],
      },
    },
    required: ['orderType', 'customerName', 'customerPhone'],
  },
  {
    name: 'escalate_to_engineer',
    description: 'تحويل المحادثة إلى مهندس مختص لطلبات التسعير الخاص أو التفاوض أو المعاينات المعقدة أو الشكاوى.',
    properties: {
      customerName: { type: 'string', description: 'اسم العميل إن توفر.' },
      customerPhone: { type: 'string', description: 'رقم تليفون العميل إن توفر.' },
      reason: { type: 'string', description: 'سبب التحويل للمهندس.' },
      summary: { type: 'string', description: 'ملخص موجز لاحتياج العميل.' },
    },
    required: ['reason', 'summary'],
  },
];

function serializeSchemaProp(prop: SchemaProp, uppercase: boolean): Record<string, unknown> {
  const fmt = (t: string) => (uppercase ? t.toUpperCase() : t.toLowerCase());
  const out: Record<string, unknown> = {
    type: fmt(prop.type),
    description: prop.description,
  };
  if (prop.enum) out.enum = prop.enum;
  if (prop.properties) {
    out.properties = Object.fromEntries(
      Object.entries(prop.properties).map(([k, v]) => [k, serializeSchemaProp(v, uppercase)])
    );
  }
  if (prop.required) out.required = prop.required;
  if (prop.items) {
    out.items = {
      type: fmt(prop.items.type),
      ...(prop.items.properties
        ? {
            properties: Object.fromEntries(
              Object.entries(prop.items.properties).map(([k, v]) => [
                k,
                serializeSchemaProp(v, uppercase),
              ])
            ),
          }
        : {}),
      ...(prop.items.required ? { required: prop.items.required } : {}),
    };
  }
  return out;
}

function buildToolDefinitions(uppercase: boolean) {
  const objType = uppercase ? 'OBJECT' : 'object';
  return TOOL_SPECS.map((spec) => ({
    name: spec.name,
    description: spec.description,
    parameters: {
      type: objType,
      properties: Object.fromEntries(
        Object.entries(spec.properties).map(([k, v]) => [k, serializeSchemaProp(v, uppercase)])
      ),
      ...(spec.required ? { required: spec.required } : {}),
    },
  }));
}

/** تعريفات الأدوات بصيغة Gemini FunctionDeclarations */
export const GEMINI_FUNCTION_DECLARATIONS = buildToolDefinitions(true);

/** تعريفات الأدوات بصيغة OpenAI / Groq Tools */
export const GROQ_TOOLS = buildToolDefinitions(false).map((fn) => ({
  type: 'function' as const,
  function: fn,
}));
