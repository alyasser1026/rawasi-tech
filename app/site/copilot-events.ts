"use client";

/**
 * copilot-events.ts
 * أنواع العميل الآمنة وناقل الأحداث الخفيف بين الكوبايلوت وسلة المشتريات وصفحة المنتجات.
 * (لا يستورد أي ملفات سيرفر لضمان عدم تسرب بيانات السيرفر لباندل المتصفح).
 */

export interface ClientCopilotProductCard {
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

export interface ClientCopilotOrderEstimateItem {
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

export interface ClientCopilotOrderEstimate {
  items: ClientCopilotOrderEstimateItem[];
  missingItems: unknown[];
  supplySubtotal: number;
  installSubtotal: number;
  grandTotal: number;
  totalSaved: number;
  currency: 'ج.م' | 'ر.س';
  hasUnpricedItems: boolean;
  hasInstallation: boolean;
}

export interface ClientCopilotCartActionItem extends ClientCopilotOrderEstimateItem {
  category?: string;
  imageUrl?: string;
}

export interface ClientCopilotSubmittedOrder {
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

export interface ClientCopilotActionLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface ClientCopilotResponse {
  ok: boolean;
  sessionId: string;
  reply: string;
  provider: 'gemini' | 'groq' | 'rpc_fallback' | 'direct_action';
  products: ClientCopilotProductCard[];
  estimate: ClientCopilotOrderEstimate | null;
  cartAction: { action: 'add'; items: ClientCopilotCartActionItem[] } | null;
  submittedOrder: ClientCopilotSubmittedOrder | null;
  escalated: boolean;
  quickReplies: string[];
  actions: ClientCopilotActionLink[];
  toolsUsed: string[];
  latencyMs: number;
  error?: string;
}

export interface CopilotOpenPayload {
  productId?: string;
  productCode?: string;
  productName?: string;
  prompt?: string;
  autoSend?: boolean;
}

export interface PhiCartAddEventDetail {
  items: ClientCopilotCartActionItem[];
  openCart?: boolean;
}

export const PHI_CART_ADD_EVENT = 'phi:cart:add';
export const PHI_CART_OPEN_EVENT = 'phi:cart:open';
export const PHI_COPILOT_OPEN_EVENT = 'phi:copilot:open';

/**
 * يضيف منتجاً أو مجموعة منتجات للسلة الحية في المتصفح عبر CustomEvent.
 */
export function dispatchAddToCartEvent(
  items: ClientCopilotCartActionItem[],
  openCart = false
): void {
  if (typeof window === 'undefined' || !Array.isArray(items) || items.length === 0) return;
  window.dispatchEvent(
    new CustomEvent<PhiCartAddEventDetail>(PHI_CART_ADD_EVENT, {
      detail: { items, openCart },
    })
  );
}

/**
 * يفتح درج سلة المشتريات الحي مباشرةً من أي مكون بالموقع.
 */
export function dispatchOpenCartEvent(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PHI_CART_OPEN_EVENT));
}

/**
 * يفتح نافذة الكوبايلوت الذكي مع تمرير سياق المنتج المختار وسؤال فوري اختياري.
 */
export function dispatchOpenCopilotEvent(detail: CopilotOpenPayload = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<CopilotOpenPayload>(PHI_COPILOT_OPEN_EVENT, { detail })
  );
}
