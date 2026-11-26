"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { rememberVisitorContact } from '@/lib/client-device-info';
import { filterRelevantCatalogProducts, inferCatalogIntent, isProductOrderable, toCustomerDisplayText } from '@/lib/copilot/catalog-relevance';
import { getOrCreateBrowserSessionId, syncBrowserSessionId } from './browser-session';
import type { DeliveryLocation } from './delivery-location';

const DeliveryLocationPicker = dynamic(() => import('./DeliveryLocationPicker'), {
  ssr: false,
});
import {
  type ClientCopilotActionLink,
  type ClientCopilotCartActionItem,
  type ClientCopilotOrderEstimate,
  type ClientCopilotProductCard,
  type ClientCopilotResponse,
  type ClientCopilotSubmittedOrder,
  type CopilotOpenPayload,
  dispatchAddToCartEvent,
  dispatchOpenCartEvent,
} from './copilot-events';

export interface StoreCopilotPanelProps {
  whatsappNumber: string;
  defaultName: string;
  defaultPhone: string;
  contextLabel: string;
  initialProductContext?: CopilotOpenPayload | null;
  onConsumeProductContext?: () => void;
  onClose: () => void;
}

interface CopilotUiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  provider?: ClientCopilotResponse['provider'];
  products?: ClientCopilotProductCard[];
  estimate?: ClientCopilotOrderEstimate | null;
  addedToCartItems?: ClientCopilotCartActionItem[];
  submittedOrder?: ClientCopilotSubmittedOrder | null;
  escalated?: boolean;
  quickReplies?: string[];
  actions?: ClientCopilotActionLink[];
}

interface ActiveProductBanner {
  id?: string;
  code?: string;
  name?: string;
}

interface CheckoutDraftItem {
  productId: string;
  code?: string;
  qty: number;
  withInstall: boolean;
}

const SESSION_STORAGE_KEY = 'phi_store_copilot_session_v1';
const GUEST_CART_KEY = 'phi_guest_cart_v1';
const USER_CART_PREFIX = 'phi_customer_cart_v1_';

const STARTER_CHIPS = [
  '⚡ فيش ومفاتيح شنايدر',
  '🚰 خلاطات جروهي',
  '🛠️ خدمات الصيانة والتركيب',
  '📱 باقات السمارت هوم',
];

const WELCOME_MSG: CopilotUiMessage = {
  id: 'copilot-welcome',
  role: 'assistant',
  text:
    'أهلاً بيك في كوبايلوت متجر فاي تك الذكي 👷‍♂️✨\n' +
    'اسألني بالعامية عن أي منتج أو سعر أو مواصفة من الـ **11,361 منتجاً**، أو قولي الكمية وأنا أحسبلك تكلفة **التوريد والتركيب** وأجهزلك طلبك فوراً!',
  createdAt: '',
  quickReplies: STARTER_CHIPS,
};

function createSessionId(): string {
  return `COP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function readCurrentCartSnapshot(): Array<{
  productId: string;
  code?: string;
  name?: string;
  qty: number;
  withInstall?: boolean;
}> {
  if (typeof window === 'undefined') return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(USER_CART_PREFIX)) keys.push(k);
    }
    const raw =
      (keys.length > 0 ? window.localStorage.getItem(keys[0]) : null) ||
      window.localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && x.productId)
      .slice(0, 12)
      .map((x) => ({
        productId: String(x.productId),
        code: x.code ? String(x.code) : undefined,
        name: x.name ? String(x.name) : undefined,
        qty: Math.max(1, Number(x.qty || 1)),
        withInstall: Boolean(x.withInstall),
      }));
  } catch {
    return [];
  }
}

/**
 * يعرض التنسيق البسيط بدون علامات تقنية أو استخدام HTML خام.
 */
function renderFormattedText(text: string): React.ReactNode {
  const tokens = toCustomerDisplayText(text).split(/(\*\*[^*]+\*\*)/g);
  return tokens.map((tok, idx) => {
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
      return (
        <strong key={idx} style={{ fontWeight: 900 }}>
          {tok.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{tok.replace(/\*\*/g, '')}</React.Fragment>;
  });
}

function cardToCartItem(
  card: ClientCopilotProductCard,
  qty: number,
  withInstall: boolean
): ClientCopilotCartActionItem {
  const price = Number(card.price || 0);
  const installPrice = Number(card.installPrice || 0);
  const lineSupplyTotal = price * qty;
  const lineInstallTotal = withInstall ? installPrice * qty : 0;
  return {
    productId: card.id,
    code: card.code,
    name: card.name,
    unit: card.unit,
    price,
    installPrice,
    withInstall,
    currency: card.currency,
    qty,
    lineSupplyTotal,
    lineInstallTotal,
    lineTotal: lineSupplyTotal + lineInstallTotal,
    installNeedsQuote: withInstall && installPrice <= 0,
    category: card.category,
    imageUrl: card.imageUrl,
  };
}

function ProductCardItem({
  card,
  feedback,
  disabled,
  onAddSupply,
  onAddInstall,
  onQuickOrder,
  onAskDetails,
}: {
  card: ClientCopilotProductCard;
  feedback?: string;
  disabled: boolean;
  onAddSupply: (card: ClientCopilotProductCard) => void;
  onAddInstall: (card: ClientCopilotProductCard) => void;
  onQuickOrder: (card: ClientCopilotProductCard) => void;
  onAskDetails: (card: ClientCopilotProductCard) => void;
}) {
  const [imgSrc, setImgSrc] = useState(card.imageUrl || '/products/smart-control-panel.webp');
  const orderable = isProductOrderable(card);
  const purchaseDisabled = !orderable || disabled;

  useEffect(() => {
    setImgSrc(card.imageUrl || '/products/smart-control-panel.webp');
  }, [card.imageUrl]);

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '9px',
        display: 'flex',
        flexDirection: 'column',
        gap: '7px',
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.05)',
      }}
    >
      <div style={{ display: 'flex', gap: '9px', alignItems: 'flex-start' }}>
        <img
          src={imgSrc}
          alt={toCustomerDisplayText(card.name)}
          loading="lazy"
          onError={() => setImgSrc('/products/smart-control-panel.webp')}
          style={{
            width: '56px',
            height: '56px',
            objectFit: 'cover',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
            <span
              style={{
                fontSize: '0.64rem',
                fontWeight: 800,
                background: '#f1f5f9',
                color: '#334155',
                padding: '1px 6px',
                borderRadius: '999px',
              }}
            >
              {toCustomerDisplayText(card.brand)} • {card.code}
            </span>
            <span
              style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: '999px',
                background: orderable ? '#dcfce7' : '#fee2e2',
                color: orderable ? '#15803d' : '#b91c1c',
              }}
            >
              {orderable ? 'متوفر' : 'غير متوفر'}
            </span>
          </div>

          <div
            style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              color: '#0f172a',
              lineHeight: 1.35,
              wordBreak: 'break-word',
            }}
          >
            {toCustomerDisplayText(card.name)}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px', marginTop: '3px' }}>
            {card.price > 0 ? (
              <>
                <strong style={{ fontSize: '0.84rem', color: '#c75517' }}>
                  {card.price.toLocaleString('en-US')} {card.currency}
                </strong>
                <span style={{ fontSize: '0.67rem', color: '#64748b' }}>/ {card.unit}</span>
                {card.oldPrice && card.oldPrice > card.price && (
                  <span style={{ fontSize: '0.67rem', color: '#94a3b8', textDecoration: 'line-through' }}>
                    {card.oldPrice.toLocaleString('en-US')}
                  </span>
                )}
              </>
            ) : (
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#b45309' }}>
                تسعير عند الطلب • {card.unit}
              </span>
            )}
          </div>

          <div style={{ marginTop: '2px', fontSize: '0.66rem', fontWeight: 700, color: '#0369a1' }}>
            {!orderable ? 'غير متاح للطلب أو التركيب حاليًا' : card.installPrice && card.installPrice > 0
              ? `🛠️ تركيب +${card.installPrice.toLocaleString('en-US')} ${card.currency}`
              : '🛠️ متاح بالتركيب والمعاينة'}
          </div>
        </div>
      </div>

      {card.specs.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {card.specs.slice(0, 2).map((sp, i) => (
            <span
              key={`${sp}-${i}`}
              style={{
                fontSize: '0.63rem',
                background: '#f8fafc',
                color: '#475569',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '1px 6px',
              }}
            >
              {toCustomerDisplayText(sp)}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', paddingTop: '2px' }}>
        <button
          type="button"
          disabled={purchaseDisabled}
          onClick={() => { if (!purchaseDisabled) onAddSupply(card); }}
          style={{
            flex: '1 1 auto',
            fontSize: '0.69rem',
            fontWeight: 800,
            padding: '5px 8px',
            borderRadius: '8px',
            border: '1px solid #fed7aa',
            background: feedback === 'supply' ? '#dcfce7' : '#fff7ed',
            color: feedback === 'supply' ? '#15803d' : '#c2410c',
            cursor: purchaseDisabled ? 'not-allowed' : 'pointer',
            opacity: purchaseDisabled ? 0.55 : 1,
          }}
        >
          {feedback === 'supply' ? '✓ أُضيف للسلة' : '🛒 توريد'}
        </button>

        <button
          type="button"
          disabled={purchaseDisabled}
          onClick={() => { if (!purchaseDisabled) onAddInstall(card); }}
          style={{
            flex: '1 1 auto',
            fontSize: '0.69rem',
            fontWeight: 800,
            padding: '5px 8px',
            borderRadius: '8px',
            border: '1px solid #bae6fd',
            background: feedback === 'install' ? '#dcfce7' : '#f0f9ff',
            color: feedback === 'install' ? '#15803d' : '#0369a1',
            cursor: purchaseDisabled ? 'not-allowed' : 'pointer',
            opacity: purchaseDisabled ? 0.55 : 1,
          }}
        >
          {feedback === 'install' ? '✓ بالتركيب' : '🛠️ بالتركيب'}
        </button>

        <button
          type="button"
          disabled={purchaseDisabled}
          onClick={() => { if (!purchaseDisabled) onQuickOrder(card); }}
          style={{
            fontSize: '0.69rem',
            fontWeight: 900,
            padding: '5px 9px',
            borderRadius: '8px',
            border: 'none',
            background: orderable ? 'linear-gradient(135deg, #16a34a, #15803d)' : '#94a3b8',
            color: '#ffffff',
            cursor: purchaseDisabled ? 'not-allowed' : 'pointer',
            opacity: purchaseDisabled ? 0.55 : 1,
          }}
        >
          {orderable ? '✅ اطلب الآن' : 'غير متوفر للطلب'}
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onAskDetails(card)}
          style={{
            fontSize: '0.68rem',
            fontWeight: 800,
            padding: '5px 8px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#334155',
            cursor: disabled ? 'wait' : 'pointer',
          }}
        >
          📋 التفاصيل
        </button>
      </div>
    </div>
  );
}

export default function StoreCopilotPanel({
  whatsappNumber,
  defaultName,
  defaultPhone,
  contextLabel,
  initialProductContext,
  onConsumeProductContext,
  onClose,
}: StoreCopilotPanelProps) {
  const [sessionId, setSessionId] = useState<string>(() => createSessionId());
  const [messages, setMessages] = useState<CopilotUiMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [escalated, setEscalated] = useState(false);
  const [activeProduct, setActiveProduct] = useState<ActiveProductBanner | null>(null);
  const [cardFeedback, setCardFeedback] = useState<Record<string, string>>({});

  // بيانات العميل وحالة نموذج إتمام الطلب داخل الشات
  const [customerName, setCustomerName] = useState(defaultName || '');
  const [customerPhone, setCustomerPhone] = useState(defaultPhone || '');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocation | null>(null);
  const [orderNotes, setOrderNotes] = useState('');

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutEstimate, setCheckoutEstimate] = useState<ClientCopilotOrderEstimate | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const restoredRef = useRef(false);
  const sendingRef = useRef(false);
  const lastConsumedKeyRef = useRef('');

  // استعادة الجلسة من localStorage ومزامنتها مع Cookie الجلسة الموحّد
  useEffect(() => {
    if (typeof window === 'undefined' || restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.sessionId) {
          const restoredId = String(parsed.sessionId);
          setSessionId(restoredId);
          syncBrowserSessionId(restoredId);
        } else {
          const browserSid = getOrCreateBrowserSessionId();
          if (browserSid) setSessionId(browserSid);
        }
        if (Array.isArray(parsed?.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages.slice(-30));
        }
        if (parsed?.customerName) setCustomerName(String(parsed.customerName));
        if (parsed?.customerPhone) setCustomerPhone(String(parsed.customerPhone));
        if (parsed?.city) setCity(String(parsed.city));
        if (parsed?.address) setAddress(String(parsed.address));
        // Older versions persisted a model-generated flag before an actual handoff.
        if (parsed?.escalated && parsed?.handoffConfirmed === true) setEscalated(true);
      } else {
        const browserSid = getOrCreateBrowserSessionId();
        if (browserSid) setSessionId(browserSid);
      }
    } catch {
      const browserSid = getOrCreateBrowserSessionId();
      if (browserSid) setSessionId(browserSid);
    }
  }, []);

  // مزامنة الاسم والهاتف الافتراضي إذا سجل المستخدم لاحقاً
  useEffect(() => {
    if (defaultName && !customerName) setCustomerName(defaultName);
    if (defaultPhone && !customerPhone) setCustomerPhone(defaultPhone);
  }, [defaultName, defaultPhone, customerName, customerPhone]);

  const persistSession = useCallback(
    (nextMsgs: CopilotUiMessage[], overrides?: { escalated?: boolean }) => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            sessionId,
            messages: nextMsgs.slice(-30),
            customerName,
            customerPhone,
            city,
            address,
            escalated: overrides?.escalated ?? escalated,
            handoffConfirmed: overrides?.escalated ?? escalated,
          })
        );
      } catch {
        // ignore storage quota
      }
    },
    [sessionId, customerName, customerPhone, city, address, escalated]
  );

  // حفظ تغييرات بيانات العميل أو الرسائل
  useEffect(() => {
    if (!restoredRef.current) return;
    persistSession(messages);
  }, [messages, customerName, customerPhone, city, address, escalated, persistSession]);

  // تمرير لأسفل عند وصول رسائل جديدة أو فتح نموذج الطلب
  useEffect(() => {
    const timer = setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [messages.length, sending, checkoutOpen]);

  const sendMessage = useCallback(
    async (rawText: string, options?: { productId?: string }) => {
      const cleanText = rawText.trim();
      if (!cleanText || sendingRef.current) return;

      sendingRef.current = true;
      setSending(true);
      setErrorMsg('');
      setInputMsg('');

      const userMsg: CopilotUiMessage = {
        id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'user',
        text: cleanText,
        createdAt: new Date().toISOString(),
      };

      const historyPayload = messages.slice(-8).map((m) => ({
        role: m.role,
        text: m.text.slice(0, 500),
      }));

      const nextWithUser = [...messages, userMsg].slice(-30);
      setMessages(nextWithUser);

      try {
        const res = await fetch('/api/store-copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message: cleanText,
            pageUrl: typeof window !== 'undefined' ? window.location.pathname : contextLabel,
            activeProductId: options?.productId || activeProduct?.id || undefined,
            customerName: customerName.trim() || undefined,
            customerPhone: customerPhone.trim() || undefined,
            cartItems: readCurrentCartSnapshot(),
            history: historyPayload,
          }),
        });

        const data = (await res.json()) as ClientCopilotResponse;
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || 'تعذر الاتصال بكوبايلوت المتجر حالياً');
        }

        if (data.sessionId && data.sessionId !== sessionId) {
          setSessionId(data.sessionId);
        }

        let addedToCartItems: ClientCopilotCartActionItem[] | undefined;
        if (data.cartAction?.action === 'add' && Array.isArray(data.cartAction.items) && data.cartAction.items.length > 0) {
          addedToCartItems = data.cartAction.items;
          dispatchAddToCartEvent(data.cartAction.items, false);
        }

        if (data.escalated) {
          setEscalated(true);
        }

        if (data.submittedOrder) {
          rememberVisitorContact({
            name: data.submittedOrder.customerName,
            phone: data.submittedOrder.customerPhone,
          });
        }

        const botMsg: CopilotUiMessage = {
          id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          text: toCustomerDisplayText(data.reply),
          createdAt: new Date().toISOString(),
          provider: data.provider,
          products: filterRelevantCatalogProducts(Array.isArray(data.products) ? data.products : [], cleanText, {
            activeProductId: options?.productId || activeProduct?.id,
            includeUnavailable: Boolean(options?.productId || activeProduct?.id),
            contextQuery: [...messages].reverse().find(message => message.role === 'user' && inferCatalogIntent(message.text).kind === 'product')?.text,
          }),
          estimate: data.estimate || null,
          addedToCartItems,
          submittedOrder: data.submittedOrder || null,
          escalated: Boolean(data.escalated),
          quickReplies: Array.isArray(data.quickReplies) ? data.quickReplies : [],
          actions: Array.isArray(data.actions) ? data.actions : [],
        };

        setMessages((prev) => [...prev, botMsg].slice(-30));
      } catch (err: any) {
        setErrorMsg(err?.message || 'حدث خطأ أثناء الاتصال بالكوبايلوت');
      } finally {
        sendingRef.current = false;
        setSending(false);
        setTimeout(() => inputRef.current?.focus(), 60);
      }
    },
    [messages, sessionId, contextLabel, activeProduct?.id, customerName, customerPhone]
  );

  // استقبال سياق المنتج من صفحة التفاصيل وتشغيله تلقائياً
  useEffect(() => {
    if (!initialProductContext) {
      lastConsumedKeyRef.current = '';
      return;
    }
    const key = `${initialProductContext.productId || ''}:${initialProductContext.productCode || ''}:${initialProductContext.prompt || ''}`;
    if (!key || lastConsumedKeyRef.current === key) return;
    lastConsumedKeyRef.current = key;

    if (initialProductContext.productId || initialProductContext.productName) {
      setActiveProduct({
        id: initialProductContext.productId,
        code: initialProductContext.productCode,
        name: initialProductContext.productName,
      });
    }

    onConsumeProductContext?.();

    if (initialProductContext.autoSend !== false && initialProductContext.prompt) {
      void sendMessage(initialProductContext.prompt, {
        productId: initialProductContext.productId,
      });
    }
  }, [initialProductContext, onConsumeProductContext, sendMessage]);

  const flashCardFeedback = (productId: string, kind: 'supply' | 'install') => {
    setCardFeedback((prev) => ({ ...prev, [productId]: kind }));
    window.setTimeout(() => {
      setCardFeedback((prev) => {
        if (prev[productId] !== kind) return prev;
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    }, 1500);
  };

  const handleAddCardToCart = (card: ClientCopilotProductCard, withInstall: boolean) => {
    if (!isProductOrderable(card) || sendingRef.current || checkoutBusy) return;
    const item = cardToCartItem(card, 1, withInstall);
    dispatchAddToCartEvent([item], false);
    flashCardFeedback(card.id, withInstall ? 'install' : 'supply');
  };

  const fetchOfficialEstimate = async (draftItems: CheckoutDraftItem[]) => {
    setCheckoutBusy(true);
    setCheckoutError('');
    try {
      const res = await fetch('/api/store-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'estimate_order',
          sessionId,
          items: draftItems,
        }),
      });
      const data = (await res.json()) as ClientCopilotResponse;
      if (!res.ok || !data?.ok || !data.estimate) {
        throw new Error(data?.error || 'تعذر احتساب التسعير');
      }
      setCheckoutEstimate(data.estimate);
    } catch (err: any) {
      setCheckoutError(err?.message || 'حدث خطأ أثناء تحديث التسعير');
    } finally {
      setCheckoutBusy(false);
    }
  };

  const openCheckoutWithEstimate = (est: ClientCopilotOrderEstimate) => {
    setCheckoutEstimate(est);
    setCheckoutError('');
    setCheckoutOpen(true);
  };

  const openCheckoutForProduct = async (card: ClientCopilotProductCard) => {
    if (!isProductOrderable(card) || sendingRef.current || checkoutBusy) return;
    const localEst: ClientCopilotOrderEstimate = {
      items: [cardToCartItem(card, 1, false)],
      missingItems: [],
      supplySubtotal: Number(card.price || 0),
      installSubtotal: 0,
      grandTotal: Number(card.price || 0),
      totalSaved: card.oldPrice && card.oldPrice > card.price ? card.oldPrice - card.price : 0,
      currency: card.currency,
      hasUnpricedItems: Number(card.price || 0) <= 0,
      hasInstallation: false,
    };
    openCheckoutWithEstimate(localEst);
    await fetchOfficialEstimate([{ productId: card.id, code: card.code, qty: 1, withInstall: false }]);
  };

  const handleCheckoutQtyChange = (productId: string, delta: number) => {
    if (!checkoutEstimate || checkoutBusy) return;
    const nextItems: CheckoutDraftItem[] = checkoutEstimate.items
      .map((it) => ({
        productId: it.productId,
        code: it.code,
        qty: Math.max(0, it.qty + (it.productId === productId ? delta : 0)),
        withInstall: it.withInstall,
      }))
      .filter((it) => it.qty > 0);

    if (nextItems.length === 0) {
      setCheckoutOpen(false);
      setCheckoutEstimate(null);
      return;
    }
    void fetchOfficialEstimate(nextItems);
  };

  const handleCheckoutToggleInstall = (productId: string) => {
    if (!checkoutEstimate || checkoutBusy) return;
    const nextItems: CheckoutDraftItem[] = checkoutEstimate.items.map((it) => ({
      productId: it.productId,
      code: it.code,
      qty: it.qty,
      withInstall: it.productId === productId ? !it.withInstall : it.withInstall,
    }));
    void fetchOfficialEstimate(nextItems);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutEstimate || checkoutEstimate.items.length === 0 || checkoutBusy) return;

    const cleanName = customerName.trim();
    const cleanPhone = customerPhone.trim();
    if (!cleanName || cleanPhone.replace(/\D/g, '').length < 8) {
      setCheckoutError('يرجى إدخال الاسم الكامل ورقم جوال صحيح (8 أرقام على الأقل).');
      return;
    }

    setCheckoutBusy(true);
    setCheckoutError('');
    try {
      const res = await fetch('/api/store-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_order',
          orderType: 'store_order',
          sessionId,
          customerName: cleanName,
          customerPhone: cleanPhone,
          city: city.trim(),
          address: address.trim(),
          deliveryLocation,
          notes: orderNotes.trim(),
          withInstallation: checkoutEstimate.hasInstallation,
          items: checkoutEstimate.items.map((it) => ({
            productId: it.productId,
            code: it.code,
            qty: it.qty,
            withInstall: it.withInstall,
          })),
        }),
      });
      const data = (await res.json()) as ClientCopilotResponse;
      if (!res.ok || !data?.ok || !data.submittedOrder) {
        throw new Error(data?.error || 'تعذر تسجيل الطلب حالياً');
      }

      rememberVisitorContact({ name: cleanName, phone: cleanPhone });
      syncBrowserSessionId(sessionId);

      const ord = data.submittedOrder;
      const confirmMsg: CopilotUiMessage = {
        id: `ord-${Date.now()}`,
        role: 'assistant',
        text:
          `تم تسجيل طلبك رسمياً برقم **${ord.refCode}** 🎉\n` +
          `الإجمالي: **${ord.totalAmount.toLocaleString('en-US')} ${ord.currency}**` +
          `${ord.withInstallation ? ' (شامل طلب التركيب)' : ' (توريد)'}.\n` +
          `تم إرسال إشعار فوري لفريق المبيعات والهندسة وسيتواصلون معك على \`${ord.customerPhone}\`.`,
        createdAt: new Date().toISOString(),
        provider: 'direct_action',
        submittedOrder: ord,
        quickReplies: ['🛒 متابعة التسوق', '🛠️ حجز خدمة صيانة', '👨‍💼 تحويل لمهندس'],
      };

      setMessages((prev) => [...prev, confirmMsg].slice(-30));
      setCheckoutOpen(false);
      setCheckoutEstimate(null);
      setDeliveryLocation(null);
      setOrderNotes('');
    } catch (err: any) {
      setCheckoutError(err?.message || 'حدث خطأ أثناء تأكيد الطلب');
    } finally {
      setCheckoutBusy(false);
    }
  };

  const handleResetChat = () => {
    const freshId = createSessionId();
    setSessionId(freshId);
    setMessages([]);
    setEscalated(false);
    setActiveProduct(null);
    setCheckoutOpen(false);
    setCheckoutEstimate(null);
    setErrorMsg('');
    lastConsumedKeyRef.current = '';
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const handleQuickReplyClick = (qr: string) => {
    const lastBotWithEstimate = [...messages].reverse().find((m) => m.estimate && m.estimate.items.length > 0);
    if (qr.includes('تأكيد وإتمام الطلب') && lastBotWithEstimate?.estimate) {
      openCheckoutWithEstimate(lastBotWithEstimate.estimate);
      return;
    }
    const lastBotWithProducts = [...messages].reverse().find((m) => m.products && m.products.length > 0);
    if (qr.includes('أضف أول منتج للسلة') && lastBotWithProducts?.products?.[0]) {
      handleAddCardToCart(lastBotWithProducts.products[0], false);
      return;
    }
    void sendMessage(qr);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || sending) return;
    void sendMessage(inputMsg);
  };

  const displayedMessages = messages.length > 0 ? messages : [WELCOME_MSG];
  const lastMsg = messages[messages.length - 1];
  const activeQuickReplies = !sending
    ? messages.length === 0
      ? STARTER_CHIPS
      : Array.isArray(lastMsg?.quickReplies) && lastMsg.quickReplies.length > 0
        ? lastMsg.quickReplies.slice(0, 3)
        : []
    : [];
  const cleanWa = whatsappNumber.replace(/[^\d]/g, '');

  return (
    <div className="phi-chat-window" role="dialog" aria-label="كوبايلوت متجر فاي تك الذكي">
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #c75517 0%, #ea580c 100%)',
          color: '#ffffff',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#4ade80',
              boxShadow: '0 0 8px #4ade80',
              flexShrink: 0,
            }}
          />
          <div>
            <strong style={{ display: 'block', fontSize: '0.9rem', lineHeight: 1.2 }}>
              🤖 كوبايلوت متجر فاي تك
            </strong>
            <span style={{ fontSize: '0.7rem', color: '#ffedd5', fontWeight: 700 }}>
              {escalated
                ? '🔔 تم إرسال طلب التواصل للفريق المختص'
                : customerName
                  ? `مرحباً أستاذ ${customerName} • متصل بالكتالوج الحي`
                  : '11,361 منتج + تركيبات + إتمام طلب فوري'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <button
            type="button"
            onClick={() => dispatchOpenCartEvent()}
            title="فتح سلة المشتريات"
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              borderRadius: '8px',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '0.72rem',
              fontWeight: 800,
            }}
          >
            🛒 السلة
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleResetChat}
              title="بدء محادثة جديدة"
              style={{
                background: 'rgba(255,255,255,0.18)',
                border: 'none',
                color: '#fff',
                borderRadius: '8px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontWeight: 800,
              }}
            >
              🔄 جديد
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق الكوبايلوت"
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: 'none',
              color: '#fff',
              borderRadius: '8px',
              padding: '4px 9px',
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Status & Escalation Bar */}
      <div
        style={{
          padding: '6px 12px',
          background: escalated ? '#fffbeb' : '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          fontSize: '0.71rem',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 800, color: escalated ? '#b45309' : '#334155' }}>
          {escalated ? 'طلب التواصل مُرسل — يمكنك متابعة سؤال المساعد' : '⚡ بحث ذكي بدون تسجيل مسبق'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {cleanWa && (
            <a
              href={`https://wa.me/${cleanWa}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.69rem',
                fontWeight: 800,
                color: '#15803d',
                background: '#dcfce7',
                border: '1px solid #86efac',
                borderRadius: '8px',
                padding: '3px 7px',
                textDecoration: 'none',
              }}
            >
              واتساب ↗
            </a>
          )}
          <button
            type="button"
            disabled={sending}
            onClick={() => void sendMessage('أرغب في التحدث المباشر مع المهندس المختص بخصوص احتياجاتي')}
            style={{
              border: '1px solid #fed7aa',
              background: '#fff3ea',
              color: '#c75517',
              borderRadius: '8px',
              padding: '3px 8px',
              fontSize: '0.7rem',
              fontWeight: 900,
              cursor: sending ? 'wait' : 'pointer',
            }}
          >
            👨‍💼 تحويل لمهندس
          </button>
        </div>
      </div>

      {/* Active Product Context Banner */}
      {activeProduct && (
        <div
          style={{
            padding: '6px 12px',
            background: '#fffbeb',
            borderBottom: '1px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            fontSize: '0.73rem',
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 800, color: '#92400e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📦 المنتج الحالي: {activeProduct.name || activeProduct.code || activeProduct.id}
          </span>
          <button
            type="button"
            onClick={() => setActiveProduct(null)}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#b45309',
              fontWeight: 900,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title="إلغاء ربط المنتج"
          >
            ✕
          </button>
        </div>
      )}

      {/* Conversation List */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          minHeight: 0,
          padding: '12px',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {displayedMessages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              style={{
                alignSelf: isUser ? 'flex-start' : 'flex-end',
                maxWidth: '94%',
                background: isUser ? '#ea580c' : '#ffffff',
                color: isUser ? '#ffffff' : '#0f172a',
                border: isUser ? 'none' : '1px solid #e2e8f0',
                borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                padding: '10px 12px',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.05)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  marginBottom: '4px',
                }}
              >
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: isUser ? '#ffedd5' : '#c75517',
                  }}
                >
                  {isUser ? customerName || 'أنت' : '🤖 كوبايلوت فاي تك'}
                </span>
                {!isUser && m.provider && (
                  <span
                    style={{
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '999px',
                      background: m.provider === 'direct_action' ? '#dcfce7' : '#fff3ea',
                      color: m.provider === 'direct_action' ? '#15803d' : '#c75517',
                    }}
                  >
                    {m.provider === 'direct_action' ? 'تأكيد مباشر' : 'كتالوج حي'}
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: '0.85rem',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {renderFormattedText(m.text)}
              </div>

              {/* كروت المنتجات الحية داخل الرسالة */}
              {Array.isArray(m.products) && m.products.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '9px' }}>
                  {m.products.slice(0, 6).map((card) => (
                    <ProductCardItem
                      key={card.id}
                      card={card}
                      feedback={cardFeedback[card.id]}
                      disabled={sending || checkoutBusy}
                      onAddSupply={(c) => handleAddCardToCart(c, false)}
                      onAddInstall={(c) => handleAddCardToCart(c, true)}
                      onQuickOrder={(c) => void openCheckoutForProduct(c)}
                      onAskDetails={(c) =>
                        void sendMessage(`اعرض لي المواصفات الكاملة والبدائل للمنتج كود ${c.code}`, { productId: c.id })
                      }
                    />
                  ))}
                </div>
              )}

              {/* بطاقة ملخص التسعير (توريد + تركيب) */}
              {m.estimate && m.estimate.items.length > 0 && (
                <div
                  style={{
                    marginTop: '9px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '9px',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: '5px' }}>
                    📊 ملخص التسعير الرسمي ({m.estimate.items.length} صنف)
                  </div>
                  {m.estimate.items.map((it) => (
                    <div
                      key={it.productId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '6px',
                        color: '#334155',
                        padding: '2px 0',
                      }}
                    >
                      <span style={{ flex: 1 }}>
                        {it.qty}× {it.name} {it.withInstall ? '(+تركيب)' : ''}
                      </span>
                      <strong style={{ whiteSpace: 'nowrap' }}>
                        {it.lineTotal.toLocaleString('en-US')} {it.currency}
                      </strong>
                    </div>
                  ))}
                  <div
                    style={{
                      marginTop: '6px',
                      paddingTop: '6px',
                      borderTop: '1px dashed #cbd5e1',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.82rem', color: '#15803d' }}>
                        الإجمالي: {m.estimate.grandTotal.toLocaleString('en-US')} {m.estimate.currency}
                      </strong>
                      {m.estimate.items.some((i) => i.installNeedsQuote) && (
                        <div style={{ fontSize: '0.66rem', color: '#b45309', fontWeight: 700 }}>
                          * تكلفة التركيب تُحدّد بعد المعاينة
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button
                        type="button"
                        onClick={() => openCheckoutWithEstimate(m.estimate!)}
                        style={{
                          border: 'none',
                          borderRadius: '8px',
                          padding: '5px 10px',
                          background: 'linear-gradient(135deg, #16a34a, #15803d)',
                          color: '#ffffff',
                          fontWeight: 900,
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                        }}
                      >
                        ✅ تأكيد وإتمام الطلب
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          dispatchAddToCartEvent(m.estimate!.items, false);
                        }}
                        style={{
                          border: '1px solid #fed7aa',
                          borderRadius: '8px',
                          padding: '5px 9px',
                          background: '#fff7ed',
                          color: '#c2410c',
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                        }}
                      >
                        🛒 للسلة
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* إشعار الإضافة التلقائية للسلة بواسطة الذكاء الاصطناعي */}
              {Array.isArray(m.addedToCartItems) && m.addedToCartItems.length > 0 && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '7px 10px',
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    fontSize: '0.74rem',
                  }}
                >
                  <span style={{ fontWeight: 800, color: '#166534' }}>
                    ✓ تمّت إضافة {m.addedToCartItems.length} صنف إلى سلتك الحية
                  </span>
                  <button
                    type="button"
                    onClick={() => dispatchOpenCartEvent()}
                    style={{
                      border: 'none',
                      borderRadius: '8px',
                      padding: '4px 9px',
                      background: '#16a34a',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                    }}
                  >
                    🛒 فتح السلة
                  </button>
                </div>
              )}

              {/* بطاقة تأكيد الطلب المسجل */}
              {m.submittedOrder && (
                <div
                  style={{
                    marginTop: '9px',
                    padding: '10px',
                    background: '#f0fdf4',
                    border: '1.5px solid #4ade80',
                    borderRadius: '10px',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ fontWeight: 900, color: '#166534', marginBottom: '3px' }}>
                    🎉 تم تأكيد الطلب — كود المتابعة: {m.submittedOrder.refCode}
                  </div>
                  <div style={{ color: '#14532d' }}>
                    العميل: {m.submittedOrder.customerName} ({m.submittedOrder.customerPhone})
                  </div>
                  <div style={{ color: '#15803d', fontWeight: 800, marginTop: '2px' }}>
                    الإجمالي الرسمي: {m.submittedOrder.totalAmount.toLocaleString('en-US')}{' '}
                    {m.submittedOrder.currency}
                    {m.submittedOrder.withInstallation ? ' • شامل التركيب' : ' • توريد'}
                  </div>
                </div>
              )}

              {/* روابط الإجراءات */}
              {Array.isArray(m.actions) && m.actions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
                  {m.actions.map((act, idx) =>
                    act.external || /^https?:|^wa\.me|^tel:/i.test(act.href) ? (
                      <a
                        key={idx}
                        href={act.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '0.71rem',
                          fontWeight: 800,
                          padding: '4px 9px',
                          borderRadius: '8px',
                          background: '#16a34a',
                          color: '#ffffff',
                          textDecoration: 'none',
                        }}
                      >
                        {act.label} ↗
                      </a>
                    ) : (
                      <Link
                        key={idx}
                        href={act.href}
                        onClick={onClose}
                        style={{
                          fontSize: '0.71rem',
                          fontWeight: 800,
                          padding: '4px 9px',
                          borderRadius: '8px',
                          background: '#fff3ea',
                          border: '1px solid #fed7aa',
                          color: '#c75517',
                          textDecoration: 'none',
                        }}
                      >
                        {act.label} ←
                      </Link>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* بطاقة إتمام الطلب السريع داخل المحادثة */}
        {checkoutOpen && checkoutEstimate && (
          <form
            onSubmit={handleCheckoutSubmit}
            style={{
              background: '#ffffff',
              border: '2px solid #ea580c',
              borderRadius: '14px',
              padding: '12px',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: '0.84rem', color: '#c75517' }}>
                ✅ إتمام الطلب الفوري من المحادثة
              </strong>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                style={{
                  border: 'none',
                  background: '#f1f5f9',
                  color: '#475569',
                  borderRadius: '6px',
                  padding: '2px 7px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {checkoutEstimate.items.map((it) => (
              <div
                key={it.productId}
                style={{
                  padding: '7px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.74rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                }}
              >
                <div style={{ fontWeight: 800, color: '#0f172a' }}>{it.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <button
                      type="button"
                      disabled={checkoutBusy}
                      onClick={() => handleCheckoutQtyChange(it.productId, -1)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      -
                    </button>
                    <strong style={{ minWidth: '20px', textAlign: 'center' }}>{it.qty}</strong>
                    <button
                      type="button"
                      disabled={checkoutBusy}
                      onClick={() => handleCheckoutQtyChange(it.productId, 1)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      +
                    </button>
                  </div>

                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 800, color: '#0369a1' }}>
                    <input
                      type="checkbox"
                      checked={it.withInstall}
                      disabled={checkoutBusy}
                      onChange={() => handleCheckoutToggleInstall(it.productId)}
                    />
                    <span>مع التركيب</span>
                  </label>

                  <strong style={{ color: '#c75517' }}>
                    {it.lineTotal.toLocaleString('en-US')} {it.currency}
                  </strong>
                </div>
              </div>
            ))}

            <div
              style={{
                background: '#fff7ed',
                borderRadius: '8px',
                padding: '8px',
                fontSize: '0.74rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>إجمالي التوريد:</span>
                <strong>
                  {checkoutEstimate.supplySubtotal.toLocaleString('en-US')} {checkoutEstimate.currency}
                </strong>
              </div>
              {checkoutEstimate.hasInstallation && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0369a1' }}>
                  <span>إجمالي التركيب:</span>
                  <strong>
                    {checkoutEstimate.items.some((i) => i.installNeedsQuote)
                      ? checkoutEstimate.installSubtotal > 0
                        ? `${checkoutEstimate.installSubtotal.toLocaleString('en-US')} ${checkoutEstimate.currency} + معاينة`
                        : 'حسب المعاينة الفنية'
                      : `${checkoutEstimate.installSubtotal.toLocaleString('en-US')} ${checkoutEstimate.currency}`}
                  </strong>
                </div>
              )}
              {checkoutEstimate.totalSaved > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontWeight: 800 }}>
                  <span>الخصم المتوفر:</span>
                  <span>
                    -{checkoutEstimate.totalSaved.toLocaleString('en-US')} {checkoutEstimate.currency}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '4px',
                  borderTop: '1px solid #fed7aa',
                  fontSize: '0.82rem',
                  fontWeight: 900,
                  color: '#c2410c',
                }}
              >
                <span>الإجمالي النهائي:</span>
                <span>
                  {checkoutEstimate.grandTotal.toLocaleString('en-US')} {checkoutEstimate.currency}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <input
                type="text"
                required
                placeholder="الاسم الكامل *"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{
                  padding: '7px 9px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                }}
              />
              <input
                type="tel"
                required
                placeholder="رقم الموبايل / واتساب *"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={{
                  padding: '7px 9px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                }}
              />
              <input
                type="text"
                placeholder="المدينة / المحافظة"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{
                  padding: '7px 9px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                }}
              />
              <input
                type="text"
                placeholder="العنوان التفصيلي"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{
                  padding: '7px 9px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                }}
              />
            </div>
            <DeliveryLocationPicker
              value={deliveryLocation}
              onChange={setDeliveryLocation}
              compact
            />
            <input
              type="text"
              placeholder="ملاحظات إضافية أو موعد مفضل (اختياري)"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              style={{
                padding: '7px 9px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.76rem',
                fontWeight: 700,
              }}
            />

            {checkoutError && (
              <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 800 }}>
                ⚠️ {checkoutError}
              </div>
            )}

            <button
              type="submit"
              disabled={checkoutBusy}
              style={{
                padding: '9px',
                borderRadius: '10px',
                border: 'none',
                background: checkoutBusy ? '#94a3b8' : 'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '0.82rem',
                cursor: checkoutBusy ? 'wait' : 'pointer',
              }}
            >
              {checkoutBusy ? 'جارٍ تثبيت الطلب...' : '✅ تأكيد وإرسال الطلب الآن'}
            </button>
          </form>
        )}

        {sending && (
          <div
            style={{
              alignSelf: 'flex-end',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px 14px 14px 4px',
              padding: '8px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#64748b',
            }}
          >
            🤖 جاري البحث في الكتالوج وتجهيز الرد...
          </div>
        )}

        {/* ردود سريعة ديناميكية أو أمثلة البداية */}
        {activeQuickReplies.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', paddingTop: '2px' }}>
            {activeQuickReplies.map((qr) => (
              <button
                key={qr}
                type="button"
                onClick={() => handleQuickReplyClick(qr)}
                style={{
                  fontSize: '0.71rem',
                  fontWeight: 800,
                  padding: '5px 10px',
                  borderRadius: '999px',
                  border: '1px solid #fed7aa',
                  background: '#ffffff',
                  color: '#c75517',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(199,85,23,0.06)',
                }}
              >
                {qr}
              </button>
            ))}
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          style={{
            padding: '6px 12px',
            background: '#fef2f2',
            borderTop: '1px solid #fecaca',
            fontSize: '0.75rem',
            color: '#dc2626',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={handleSubmitForm}
        style={{
          padding: '10px 12px',
          borderTop: '1.5px solid #cbd5e1',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          className="phi-chat-input"
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          placeholder="اسأل عن منتج، سعر، تركيب، أو اطلب مباشرة..."
          style={{
            backgroundColor: '#f8fafc',
            color: '#0f172a',
            WebkitTextFillColor: '#0f172a',
            caretColor: '#ea580c',
          }}
        />
        <button
          type="submit"
          disabled={sending || !inputMsg.trim()}
          style={{
            padding: '11px 18px',
            borderRadius: '12px',
            border: 'none',
            background: sending || !inputMsg.trim() ? '#94a3b8' : 'linear-gradient(135deg, #f97316, #c75517)',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: '0.88rem',
            cursor: sending || !inputMsg.trim() ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          إرسال
        </button>
      </form>
    </div>
  );
}
