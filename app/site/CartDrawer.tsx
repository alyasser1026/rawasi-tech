"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { rememberVisitorContact } from '@/lib/client-device-info';
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

export function useCustomerCart(onRequireLogin?: () => void) {
  const [user, setUser] = useState<CustomerSessionUser | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Persist cart to localStorage + Supabase Auth metadata
  const persistCart = (nextItems: CartItem[], currentUser: CustomerSessionUser | null) => {
    setItems(nextItems);
    if (!currentUser || typeof window === 'undefined') return;
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
        if (session?.user) {
          const u = session.user;
          const meta = u.user_metadata || {};
          const customer: CustomerSessionUser = {
            id: u.id,
            email: u.email || '',
            fullName: meta.full_name || meta.name || u.email?.split('@')[0] || 'عميل فاي تك',
            phone: meta.phone_number || meta.phone || '',
          };
          setUser(customer);

          // Load cart from localStorage or user_metadata
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
          setItems([]);
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
        setItems([]);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const addToCart = (product: WebsiteProduct, qty = 1, withInstall = false): boolean => {
    if (!user) {
      queuePendingCartProduct(product, qty, withInstall);
      onRequireLogin?.();
      return false;
    }

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
    if (!user) {
      if (productsList[0]?.product) {
        queuePendingCartProduct(productsList[0].product, productsList[0].qty, withInstall);
      }
      onRequireLogin?.();
      return false;
    }

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

  return {
    user,
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
    totalCount,
    totalAmount,
  };
}

export function CartDrawer({
  isOpen,
  onClose,
  user,
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

    if (!user) {
      onClose();
      onRequireLogin();
      return;
    }

    if (!customerName.trim() || customerPhone.replace(/\D/g, '').length < 8) {
      setErrorMsg('يرجى التأكد من كتابة الاسم ورقم الجوال الصحيح للتواصل وتأكيد التسليم');
      return;
    }

    setSubmitting(true);
    try {
      rememberVisitorContact({
        name: customerName.trim(),
        phone: customerPhone.trim(),
        email: user.email,
      });

      const res = await fetch('/api/website-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType: 'store_order',
          userId: user.id,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: user.email,
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
        background: 'rgba(9, 12, 18, 0.65)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        justifyContent: 'flex-start',
        direction: 'rtl',
        fontFamily: "'Cairo', sans-serif",
      }}
      onClick={onClose}
    >
      <aside
        style={{
          width: 'min(100vw, 460px)',
          height: '100%',
          background: '#ffffff',
          color: '#14181b',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 20px',
            background: '#0f141c',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.35rem' }}>🛍️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900 }}>
                سلة مشترياتك وطلبات التوريد
              </h3>
              <span style={{ fontSize: '0.76rem', color: '#fb923c', fontWeight: 700 }}>
                {user ? `حساب نشط: ${user.fullName}` : 'يرجى تسجيل الدخول لتفعيل السلة'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              borderRadius: '10px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.82rem',
            }}
          >
            ✕ إغلاق
          </button>
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
          ) : !user ? (
            <div
              style={{
                padding: '32px 18px',
                textAlign: 'center',
                background: '#fff3ea',
                borderRadius: '18px',
                border: '1px solid #fed7aa',
              }}
            >
              <div style={{ fontSize: '2.4rem', marginBottom: '10px' }}>🔐</div>
              <h4 style={{ margin: '0 0 8px', fontSize: '1.08rem', fontWeight: 900 }}>
                سلة المشتريات مخصصة للأعضاء المسجلين
              </h4>
              <p style={{ margin: '0 0 18px', fontSize: '0.88rem', color: '#47525c', lineHeight: 1.6 }}>
                أنشئ حساباً مجانياً في ثوانٍ أو سجّل دخولك لحفظ منتجاتك في السلة وطلب التوريد والتركيب المباشر.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequireLogin();
                }}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #f97316, #c75517)',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                }}
              >
                تسجيل الدخول / إنشاء حساب فوري
              </button>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '44px 16px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '2.8rem', marginBottom: '10px' }}>🛒</div>
              <strong style={{ display: 'block', fontSize: '1.05rem', color: '#14181b', marginBottom: '6px' }}>
                سلة مشترياتك فارغة حالياً
              </strong>
              <p style={{ fontSize: '0.86rem', margin: 0 }}>
                تصفح أقسام الكهرباء والسباكة والدهانات والسمارت هوم والحساسات وأضف ما تحتاجه لمشروعك.
              </p>
            </div>
          ) : (
            <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Cart Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {items.map((item) => {
                  const unitEffective = item.price + (item.withInstall ? item.installPrice : 0);
                  return (
                    <div
                      key={item.productId}
                      style={{
                        border: '1px solid #e3e6e9',
                        borderRadius: '14px',
                        padding: '12px 14px',
                        background: '#fafaf9',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#c75517', fontWeight: 800 }}>
                            {item.code}
                          </span>
                          <strong style={{ display: 'block', fontSize: '0.9rem', lineHeight: 1.4 }}>
                            {item.name}
                          </strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.productId)}
                          style={{
                            border: 'none',
                            background: '#fee2e2',
                            color: '#b91c1c',
                            borderRadius: '8px',
                            padding: '4px 8px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          حذف
                        </button>
                      </div>

                      {item.installPrice > 0 && (
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: item.withInstall ? '#065f46' : '#47525c',
                            background: item.withInstall ? '#ecfdf5' : '#ffffff',
                            border: item.withInstall ? '1px solid #6ee7b7' : '1px solid #e3e6e9',
                            padding: '6px 10px',
                            borderRadius: '9px',
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
                            شامل التركيب الهندسي (+{item.installPrice.toLocaleString('en-US')} {item.currency} / {item.unit})
                          </span>
                        </label>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #e3e6e9', borderRadius: '9px', padding: '3px 8px' }}>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.productId, -1)}
                            style={{ border: 'none', background: 'none', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', padding: '0 6px' }}
                          >
                            −
                          </button>
                          <strong style={{ fontSize: '0.88rem', minWidth: '22px', textAlign: 'center' }}>{item.qty}</strong>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.productId, 1)}
                            style={{ border: 'none', background: 'none', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', padding: '0 6px', color: '#c75517' }}
                          >
                            +
                          </button>
                          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{item.unit}</span>
                        </div>

                        <strong style={{ fontSize: '0.96rem', color: '#c75517', fontWeight: 900 }}>
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
                  borderTop: '1px dashed #cbd5e1',
                  paddingTop: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <strong style={{ fontSize: '0.9rem', color: '#14181b' }}>
                  📍 بيانات التواصل والتوريد:
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="الاسم الكامل *"
                    required
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid #e3e6e9',
                      fontSize: '16px',
                      fontWeight: 700,
                    }}
                  />
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="رقم الجوال *"
                    dir="ltr"
                    inputMode="tel"
                    required
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid #e3e6e9',
                      fontSize: '16px',
                      fontWeight: 700,
                      textAlign: 'right',
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '8px' }}>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="المدينة (القاهرة، المنصورة، الرياض...)"
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid #e3e6e9',
                      fontSize: '16px',
                    }}
                  />
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="عنوان الموقع / الشقة"
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid #e3e6e9',
                      fontSize: '16px',
                    }}
                  />
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات إضافية (مثال: موعد التوريد المفضل أو طلب معاينة موقع للتركيب)"
                  rows={2}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #e3e6e9',
                    fontSize: '16px',
                    resize: 'vertical',
                  }}
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
