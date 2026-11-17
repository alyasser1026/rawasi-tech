"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { rememberVisitorContact } from '@/lib/client-device-info';
import { getDestinationForUser } from '@/lib/roleRouter';
import type { WebsiteProduct } from './store-catalog';

export interface CartItem {
  productId: string;
  code: string;
  name: string;
  unit: string;
  price: number;
  installPrice: number;
  currency: 'ج.م' | 'ر.س';
  qty: number;
  withInstall: boolean;
}

export interface CustomerSessionUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
}

const LOCAL_CART_PREFIX = 'phi_customer_cart_v1_';
const GUEST_CART_KEY = 'phi_guest_cart_v1';
const PENDING_CART_KEY = 'phi_pending_cart_add_v1';

export function queuePendingCartProduct(product: WebsiteProduct, qty = 1, withInstall = false) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      PENDING_CART_KEY,
      JSON.stringify({ product, qty, withInstall, ts: Date.now() })
    );
  } catch {
    // ignore
  }
}

export function consumePendingCartProduct(): {
  product: WebsiteProduct;
  qty: number;
  withInstall: boolean;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_CART_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(PENDING_CART_KEY);
    const parsed = JSON.parse(raw);
    if (parsed?.product?.id) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function useCustomerCart(_onRequireLogin?: () => void) {
  const [user, setUser] = useState<CustomerSessionUser | null>(null);
  const [portalHref, setPortalHref] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Persist cart to localStorage (guest or user) + Supabase Auth metadata when signed in
  const persistCart = (nextItems: CartItem[], currentUser: CustomerSessionUser | null) => {
    setItems(nextItems);
    if (typeof window === 'undefined') return;
    if (!currentUser) {
      try {
        window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(nextItems));
      } catch {
        // ignore storage quota
      }
      return;
    }
    try {
      window.localStorage.setItem(`${LOCAL_CART_PREFIX}${currentUser.id}`, JSON.stringify(nextItems));
    } catch {
      // ignore storage quota
    }
    void supabase.auth
      .updateUser({
        data: { phi_cart: nextItems },
      })
      .catch(() => {});
  };

  useEffect(() => {
    let mounted = true;

    const loadUserAndCart = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!mounted) return;

        let guestItems: CartItem[] = [];
        if (typeof window !== 'undefined') {
          const rawGuest = window.localStorage.getItem(GUEST_CART_KEY);
          if (rawGuest) {
            try {
              const parsed = JSON.parse(rawGuest);
              if (Array.isArray(parsed)) guestItems = parsed;
            } catch {
              guestItems = [];
            }
          }
        }

        if (session?.user) {
          const u = session.user;
          const meta = u.user_metadata || {};

          let prof: any = null;
          try {
            const { data: profData, error: profErr } = await supabase
              .from('profiles')
              .select('id, full_name, role, is_admin, linked_partner_id, permissions')
              .eq('id', u.id)
              .maybeSingle();
            if (!profErr && profData) {
              prof = profData;
            }
          } catch {
            prof = null;
          }
          if (!prof && typeof window !== 'undefined') {
            try {
              const cached = window.localStorage.getItem(`phi_cached_profile_${u.id}`);
              if (cached) prof = JSON.parse(cached);
            } catch {
              prof = null;
            }
          }
          if (!mounted) return;

          const resolvedPortal = prof
            ? getDestinationForUser(prof)
            : meta.role === 'admin'
              ? '/Dashboard'
              : null;
          const isEmployeeOrPartner = Boolean(
            (prof &&
              (prof.is_admin ||
                (prof.role && prof.role !== 'client') ||
                prof.linked_partner_id ||
                (resolvedPortal && resolvedPortal !== '/profile'))) ||
              (meta.role && meta.role !== 'client')
          );
          setPortalHref(isEmployeeOrPartner ? resolvedPortal || '/Dashboard' : null);

          const customer: CustomerSessionUser = {
            id: u.id,
            email: u.email || '',
            fullName:
              prof?.full_name || meta.full_name || meta.name || u.email?.split('@')[0] || 'مستخدم فاي تك',
            phone: meta.phone_number || meta.phone || '',
          };
          setUser(customer);

          // Load cart from localStorage or user_metadata and merge any guest cart items
          let loadedCart: CartItem[] = [];
          if (typeof window !== 'undefined') {
            const rawLocal = window.localStorage.getItem(`${LOCAL_CART_PREFIX}${u.id}`);
            if (rawLocal) {
              try {
                loadedCart = JSON.parse(rawLocal);
              } catch {
                loadedCart = [];
              }
            }
          }
          if (!loadedCart.length && Array.isArray(meta.phi_cart)) {
            loadedCart = meta.phi_cart;
          }
          if (guestItems.length > 0) {
            for (const gItem of guestItems) {
              const existingIdx = loadedCart.findIndex((x) => x.productId === gItem.productId);
              if (existingIdx >= 0) {
                loadedCart[existingIdx] = {
                  ...loadedCart[existingIdx],
                  qty: loadedCart[existingIdx].qty + gItem.qty,
                  withInstall: loadedCart[existingIdx].withInstall || gItem.withInstall,
                };
              } else {
                loadedCart.push(gItem);
              }
            }
            if (typeof window !== 'undefined') {
              try {
                window.localStorage.removeItem(GUEST_CART_KEY);
              } catch {
                // ignore
              }
            }
          }

          // Check if there was a pending item queued before login
          const pending = consumePendingCartProduct();
          if (pending?.product) {
            const p = pending.product;
            const existingIdx = loadedCart.findIndex((x) => x.productId === p.id);
            if (existingIdx >= 0) {
              loadedCart[existingIdx].qty += pending.qty || 1;
            } else {
              loadedCart.push({
                productId: p.id,
                code: p.code,
                name: p.name,
                unit: p.unit,
                price: p.price,
                installPrice: p.installPrice || 0,
                currency: p.currency || 'ج.م',
                qty: pending.qty || 1,
                withInstall: pending.withInstall,
              });
            }
            setCartOpen(true);
          }

          setItems(loadedCart);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(`${LOCAL_CART_PREFIX}${u.id}`, JSON.stringify(loadedCart));
          }
        } else {
          setUser(null);
          setPortalHref(null);
          setItems(guestItems);
        }
      } finally {
        if (mounted) setAuthChecked(true);
      }
    };

    void loadUserAndCart();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void loadUserAndCart();
      } else {
        setUser(null);
        setPortalHref(null);
        if (typeof window !== 'undefined') {
          try {
            const rawGuest = window.localStorage.getItem(GUEST_CART_KEY);
            setItems(rawGuest ? JSON.parse(rawGuest) : []);
          } catch {
            setItems([]);
          }
        } else {
          setItems([]);
        }
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const addToCart = (product: WebsiteProduct, qty = 1, withInstall = false): boolean => {
    const next = [...items];
    const idx = next.findIndex((x) => x.productId === product.id);
    if (idx >= 0) {
      next[idx] = {
        ...next[idx],
        qty: next[idx].qty + qty,
        withInstall: withInstall || next[idx].withInstall,
      };
    } else {
      next.push({
        productId: product.id,
        code: product.code,
        name: product.name,
        unit: product.unit,
        price: product.price,
        installPrice: product.installPrice || 0,
        currency: product.currency || 'ج.م',
        qty,
        withInstall,
      });
    }
    persistCart(next, user);
    setCartOpen(true);
    return true;
  };

  const addBundleToCart = (
    productsList: Array<{ product: WebsiteProduct; qty: number }>,
    withInstall = true
  ): boolean => {
    const next = [...items];
    for (const entry of productsList) {
      const p = entry.product;
      const idx = next.findIndex((x) => x.productId === p.id);
      if (idx >= 0) {
        next[idx] = {
          ...next[idx],
          qty: next[idx].qty + entry.qty,
          withInstall: withInstall || next[idx].withInstall,
        };
      } else {
        next.push({
          productId: p.id,
          code: p.code,
          name: p.name,
          unit: p.unit,
          price: p.price,
          installPrice: p.installPrice || 0,
          currency: p.currency || 'ج.م',
          qty: entry.qty,
          withInstall,
        });
      }
    }
    persistCart(next, user);
    setCartOpen(true);
    return true;
  };

  const updateQty = (productId: string, delta: number) => {
    const next = items
      .map((item) => (item.productId === productId ? { ...item, qty: item.qty + delta } : item))
      .filter((item) => item.qty > 0);
    persistCart(next, user);
  };

  const toggleItemInstall = (productId: string) => {
    const next = items.map((item) =>
      item.productId === productId ? { ...item, withInstall: !item.withInstall } : item
    );
    persistCart(next, user);
  };

  const removeItem = (productId: string) => {
    const next = items.filter((item) => item.productId !== productId);
    persistCart(next, user);
  };

  const clearCart = () => {
    persistCart([], user);
  };

  const totalCount = items.reduce((sum, i) => sum + i.qty, 0);
  const totalAmount = items.reduce(
    (sum, i) => sum + (i.price + (i.withInstall ? i.installPrice : 0)) * i.qty,
    0
  );

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  };

  return {
    user,
    portalHref,
    authChecked,
    items,
    cartOpen,
    setCartOpen,
    addToCart,
    addBundleToCart,
    updateQty,
    toggleItemInstall,
    removeItem,
    clearCart,
    signOut,
    totalCount,
    totalAmount,
  };
}

export function CartButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  const hasItems = count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`سلة المشتريات (${count})`}
      className="phi-cart-btn"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        height: '40px',
        padding: '0 13px',
        borderRadius: '11px',
        border: hasItems
          ? '1px solid rgba(249, 115, 22, 0.85)'
          : '1px solid rgba(255, 255, 255, 0.22)',
        background: hasItems
          ? 'linear-gradient(135deg, rgba(249, 115, 22, 0.95) 0%, rgba(199, 85, 23, 0.95) 100%)'
          : 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        color: '#ffffff',
        fontWeight: 800,
        fontSize: '0.84rem',
        cursor: 'pointer',
        boxShadow: hasItems
          ? '0 8px 20px -6px rgba(249, 115, 22, 0.65)'
          : '0 4px 12px rgba(0, 0, 0, 0.18)',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
        whiteSpace: 'nowrap',
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      <span>السلة</span>
      <span
        style={{
          minWidth: '22px',
          height: '22px',
          padding: '0 6px',
          borderRadius: '999px',
          background: hasItems ? '#ffffff' : 'rgba(249, 115, 22, 0.28)',
          color: hasItems ? '#c75517' : '#fde68a',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        {count}
      </span>
    </button>
  );
}

export function CartDrawer({
  isOpen,
  onClose,
  user,
  portalHref,
  onSignOut,
  items,
  totalAmount,
  onUpdateQty,
  onToggleInstall,
  onRemoveItem,
  onClearCart,
  onRequireLogin,
  whatsappNumber,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: CustomerSessionUser | null;
  portalHref?: string | null;
  onSignOut?: () => void;
  items: CartItem[];
  totalAmount: number;
  onUpdateQty: (productId: string, delta: number) => void;
  onToggleInstall: (productId: string) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onRequireLogin: () => void;
  whatsappNumber?: string;
}) {
  const [customerName, setCustomerName] = useState(user?.fullName || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccessRef, setOrderSuccessRef] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (user) {
      if (user.fullName && !customerName) setCustomerName(user.fullName);
      if (user.phone && !customerPhone) setCustomerPhone(user.phone);
    }
  }, [user, customerName, customerPhone]);

  if (!isOpen) return null;

  const currency = items[0]?.currency || 'ج.م';
  const hasAnyInstall = items.some((i) => i.withInstall);
  const hasUnpricedItems = items.some((i) => i.price <= 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!customerName.trim() || customerPhone.replace(/\D/g, '').length < 8) {
      setErrorMsg('يرجى التأكد من كتابة الاسم ورقم الجوال الصحيح للتواصل وتأكيد التسليم');
      return;
    }

    setSubmitting(true);
    try {
      rememberVisitorContact({
        name: customerName.trim(),
        phone: customerPhone.trim(),
        email: user?.email || '',
      });

      const res = await fetch('/api/website-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType: 'store_order',
          userId: user?.id || null,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: user?.email || '',
          city: city.trim(),
          address: address.trim(),
          notes: notes.trim(),
          withInstallation: hasAnyInstall,
          items,
          totalAmount,
          currency,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'تعذر إرسال الطلب حالياً');
      }

      setOrderSuccessRef(data.refCode || 'ORD-2026');
      onClearCart();
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99980,
        background: 'rgba(9, 12, 18, 0.62)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        justifyContent: 'flex-start',
        direction: 'rtl',
        fontFamily: "'Cairo', sans-serif",
        animation: 'phiCartFade 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes phiCartFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes phiCartSlide { from { transform: translateX(-28px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .phi-cart-panel { animation: phiCartSlide 0.24s cubic-bezier(0.16, 1, 0.3, 1); }
        .phi-cart-input {
          width: 100%;
          padding: 10px 12px;
          border-radius: 11px;
          border: 1.5px solid #e2e8f0;
          background: #ffffff;
          font-size: 15px;
          font-weight: 700;
          color: #14181b;
          transition: border-color 0.16s ease, box-shadow 0.16s ease;
        }
        .phi-cart-input:focus {
          outline: none;
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.16);
        }
      `}</style>
      <aside
        className="phi-cart-panel"
        style={{
          width: 'min(100vw, 470px)',
          height: '100%',
          background: '#f8fafc',
          color: '#14181b',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '16px 0 48px rgba(0,0,0,0.34)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 20px 14px',
            background: 'linear-gradient(135deg, #0b1018 0%, #172030 100%)',
            color: '#ffffff',
            borderBottom: '2px solid #ea580c',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'rgba(249, 115, 22, 0.18)',
                  border: '1px solid rgba(249, 115, 22, 0.45)',
                  color: '#fb923c',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                  <path d="M3 6h18" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, lineHeight: 1.3 }}>
                  سلة المشتريات والتوريد
                </h3>
                <span style={{ fontSize: '0.76rem', color: '#cbd5e1', fontWeight: 700, display: 'block' }}>
                  {user ? `👤 ${user.fullName} · ${items.length} صنف` : `التسوق السريع بدون تسجيل إلزامي · ${items.length} صنف`}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق السلة"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#fff',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 900,
                fontSize: '1rem',
              }}
            >
              ✕
            </button>
          </div>
          {user && (portalHref || onSignOut) && (
            <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
              {portalHref && (
                <Link
                  href={portalHref}
                  onClick={onClose}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '10px',
                    background: 'rgba(249, 115, 22, 0.2)',
                    border: '1px solid rgba(249, 115, 22, 0.5)',
                    color: '#fed7aa',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    textDecoration: 'none',
                  }}
                >
                  🏢 بوابة الموظفين
                </Link>
              )}
              {onSignOut && (
                <button
                  type="button"
                  onClick={() => {
                    onSignOut();
                    onClose();
                  }}
                  style={{
                    marginInlineStart: 'auto',
                    padding: '6px 11px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    color: '#cbd5e1',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  تسجيل الخروج
                </button>
              )}
            </div>
          )}
          {items.length > 0 && !orderSuccessRef && (
            <div
              style={{
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.72rem',
                color: '#cbd5e1',
                fontWeight: 700,
              }}
            >
              <span style={{ color: '#fb923c' }}>1. مراجعة الأصناف</span>
              <span>←</span>
              <span>2. بيانات الموقع</span>
              <span>←</span>
              <span>3. إرسال للمبيعات</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px' }}>
          {orderSuccessRef ? (
            <div
              style={{
                background: '#ecfdf5',
                border: '1.5px solid #6ee7b7',
                borderRadius: '18px',
                padding: '24px 18px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ fontSize: '2.6rem' }}>✅</div>
              <h4 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 900, color: '#065f46' }}>
                تم استلام طلبك بنجاح!
              </h4>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#047857', lineHeight: 1.6 }}>
                رقم مرجع الطلب: <strong style={{ fontFamily: 'monospace', fontSize: '1rem' }}>{orderSuccessRef}</strong>
                <br />
                تم إرسال تفاصيل سلتك فوراً إلى الإدارة الهندسية والمبيعات في فاي تك، وسنتواصل معك على الرقم{' '}
                <strong dir="ltr">{customerPhone}</strong> لتأكيد التوريد والتركيب.
              </p>
              {whatsappNumber && (
                <a
                  href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `مرحباً فاي تك، قمت بإرسال طلب سلة مشتريات رقم ${orderSuccessRef} باسم ${customerName}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 18px',
                    borderRadius: '12px',
                    background: '#16a34a',
                    color: '#fff',
                    fontWeight: 800,
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                  }}
                >
                  💬 تأكيد سريع عبر واتساب
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setOrderSuccessRef(null);
                  onClose();
                }}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid #a7f3d0',
                  background: '#ffffff',
                  color: '#065f46',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                متابعة التصفح
              </button>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <div style={{ fontSize: '2.8rem' }}>🛒</div>
              <strong style={{ display: 'block', fontSize: '1.05rem', color: '#14181b' }}>
                سلة مشترياتك فارغة حالياً
              </strong>
              <p style={{ fontSize: '0.86rem', margin: 0, maxWidth: '30ch', lineHeight: 1.6 }}>
                تصفح أقسام الكهرباء والسباكة والدهانات والسمارت هوم والحساسات وأضف ما تحتاجه لمشروعك بحرية وبدون تسجيل دخول إلزامي.
              </p>
              {!user && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequireLogin();
                  }}
                  style={{
                    marginTop: '6px',
                    padding: '10px 18px',
                    borderRadius: '11px',
                    border: '1px solid #fed7aa',
                    background: '#fff3ea',
                    color: '#c75517',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                  }}
                >
                  🔐 تسجيل الدخول (اختياري)
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {!user && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '12px',
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    fontSize: '0.8rem',
                    color: '#7c2d12',
                    fontWeight: 700,
                  }}
                >
                  <span>💡 يمكنك إتمام الطلب مباشرة أو حفظ بياناتك.</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRequireLogin();
                    }}
                    style={{
                      flexShrink: 0,
                      padding: '5px 10px',
                      borderRadius: '8px',
                      border: '1px solid #fdba74',
                      background: '#fff',
                      color: '#c75517',
                      fontWeight: 800,
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                    }}
                  >
                    تسجيل دخول
                  </button>
                </div>
              )}
              {/* Cart Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.84rem', color: '#47525c' }}>
                    الأصناف المضافة ({items.length})
                  </strong>
                  <button
                    type="button"
                    onClick={onClearCart}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#dc2626',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    إفراغ السلة
                  </button>
                </div>
                {items.map((item) => {
                  const unitEffective = item.price + (item.withInstall ? item.installPrice : 0);
                  return (
                    <div
                      key={item.productId}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '16px',
                        padding: '14px',
                        background: '#ffffff',
                        boxShadow: '0 4px 14px -8px rgba(15, 23, 42, 0.12)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                        <div>
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: '0.68rem',
                              fontFamily: 'monospace',
                              color: '#c75517',
                              background: '#fff3ea',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              fontWeight: 800,
                              marginBottom: '4px',
                            }}
                          >
                            {item.code}
                          </span>
                          <strong style={{ display: 'block', fontSize: '0.9rem', lineHeight: 1.45, color: '#0f172a' }}>
                            {item.name}
                          </strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.productId)}
                          aria-label={`حذف ${item.name}`}
                          title="حذف الصنف"
                          style={{
                            width: '30px',
                            height: '30px',
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#dc2626',
                            borderRadius: '9px',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      </div>

                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.77rem',
                          fontWeight: 800,
                          color: item.withInstall ? '#065f46' : '#47525c',
                          background: item.withInstall ? '#ecfdf5' : '#f8fafc',
                          border: item.withInstall ? '1px solid #6ee7b7' : '1px solid #e2e8f0',
                          padding: '7px 10px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={item.withInstall}
                          onChange={() => onToggleInstall(item.productId)}
                          style={{ accentColor: '#10b981' }}
                        />
                        <span>
                          {item.installPrice > 0
                            ? `شامل التركيب الهندسي (+${item.installPrice.toLocaleString('en-US')} ${item.currency} / ${item.unit})`
                            : 'مطلوب مع التركيب الهندسي المعتمد'}
                        </span>
                      </label>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '999px', padding: '3px 6px' }}>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.productId, -1)}
                            aria-label="تقليل الكمية"
                            style={{ width: '26px', height: '26px', borderRadius: '50%', border: 'none', background: '#ffffff', color: '#0f172a', fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                          >
                            −
                          </button>
                          <strong style={{ fontSize: '0.88rem', minWidth: '24px', textAlign: 'center' }}>{item.qty}</strong>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.productId, 1)}
                            aria-label="زيادة الكمية"
                            style={{ width: '26px', height: '26px', borderRadius: '50%', border: 'none', background: '#ea580c', color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer' }}
                          >
                            +
                          </button>
                          <span style={{ fontSize: '0.73rem', color: '#64748b', paddingInline: '6px', fontWeight: 700 }}>{item.unit}</span>
                        </div>

                        <strong style={{ fontSize: '0.94rem', color: '#c75517', fontWeight: 900 }}>
                          {item.price > 0
                            ? `${(unitEffective * item.qty).toLocaleString('en-US')} ${item.currency}`
                            : 'تسعير عند الطلب'}
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Delivery & Contact Form */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>
                  📍 بيانات التواصل وموقع التوريد
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    className="phi-cart-input"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="الاسم الكامل *"
                    required
                  />
                  <input
                    className="phi-cart-input"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="رقم الجوال *"
                    dir="ltr"
                    inputMode="tel"
                    required
                    style={{ textAlign: 'right' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '8px' }}>
                  <input
                    className="phi-cart-input"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="المدينة (القاهرة، المنصورة...)"
                  />
                  <input
                    className="phi-cart-input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="عنوان الموقع / الشقة"
                  />
                </div>
                <textarea
                  className="phi-cart-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات إضافية (موعد التوريد المفضل أو طلب معاينة)"
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {errorMsg && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: '#fef2f2',
                    color: '#b91c1c',
                    border: '1px solid #fecaca',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                  }}
                >
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* Total & Submit */}
              <div
                style={{
                  background: '#fff3ea',
                  border: '1px solid #fed7aa',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#47525c' }}>
                    {hasUnpricedItems && totalAmount <= 0 ? 'نوع الطلب:' : 'الإجمالي التقديري للسلة:'}
                  </span>
                  <strong style={{ fontSize: totalAmount > 0 ? '1.35rem' : '1.05rem', fontWeight: 900, color: '#c75517' }}>
                    {totalAmount > 0
                      ? `${totalAmount.toLocaleString('en-US')} ${currency}${hasUnpricedItems ? ' (+ أصناف للتسعير)' : ''}`
                      : 'طلب عرض سعر وتوريد'}
                  </strong>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '13px 18px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #f97316, #c75517)',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: '0.96rem',
                    cursor: submitting ? 'wait' : 'pointer',
                    boxShadow: '0 8px 20px -6px rgba(249, 115, 22, 0.55)',
                  }}
                >
                  {submitting ? 'جاري تسجيل الطلب وإشعار المبيعات...' : '✅ اعتماد الطلب وإرسال للتنفيذ والمبيعات'}
                </button>
              </div>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}
