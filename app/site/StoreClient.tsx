"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CSS } from './site-styles';
import { mergeContent, type SiteContentOverride } from './site-content';
import {
  getProductImageUrl,
  PRODUCT_CATEGORIES,
  SMART_BUNDLES,
  type ProductCategoryId,
  type WebsiteMaintenanceService,
  type WebsiteProduct,
} from './store-catalog';
import { CartDrawer, useCustomerCart } from './CartDrawer';
import PublicHeader, { PUBLIC_NAV_ITEMS } from './PublicHeader';
import LoginModal from './LoginModal';
import FloatingContactChat from './FloatingContactChat';
import ContactModal from './ContactModal';
import { supabase } from '@/lib/supabase';
import { rememberVisitorContact } from '@/lib/client-device-info';

function StoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export default function StoreClient({ content }: { content?: SiteContentOverride }) {
  const { SITE, PRODUCTS, MAINTENANCE_SERVICES, PROMO_BANNER } = mergeContent(content);
  const [loginOpen, setLoginOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [activeStoreTab, setActiveStoreTab] = useState<'products' | 'maintenance'>('products');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategoryId>('all');
  const [mntFilterCategory, setMntFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [installSelections, setInstallSelections] = useState<Record<string, boolean>>({});
  const [addedId, setAddedId] = useState<string | null>(null);
  const addedTimerRef = useRef<number | null>(null);

  // Maintenance Request Modal state
  const [selectedMaintenance, setSelectedMaintenance] = useState<WebsiteMaintenanceService | null>(null);
  const [mntMode, setMntMode] = useState('تنفيذ وتأسيس جديد');
  const [mntName, setMntName] = useState('');
  const [mntPhone, setMntPhone] = useState('');
  const [mntCity, setMntCity] = useState('');
  const [mntAddress, setMntAddress] = useState('');
  const [mntDate, setMntDate] = useState('');
  const [mntNotes, setMntNotes] = useState('');
  const [mntBusy, setMntBusy] = useState(false);
  const [mntRef, setMntRef] = useState<string | null>(null);
  const [mntErr, setMntErr] = useState('');

  const cart = useCustomerCart(() => setLoginOpen(true));
  const cleanWa = (SITE.contact.whatsapp || '').replace(/[^\d]/g, '');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'maintenance') {
        setActiveStoreTab('maintenance');
      }
      const cat = params.get('category');
      if (cat && PRODUCT_CATEGORIES.some((c) => c.id === cat)) {
        setSelectedCategory(cat as ProductCategoryId);
        setActiveStoreTab('products');
      }
    }
  }, []);

  useEffect(() => {
    if (cart.user) {
      if (cart.user.fullName && !mntName) setMntName(cart.user.fullName);
      if (cart.user.phone && !mntPhone) setMntPhone(cart.user.phone);
    }
  }, [cart.user, mntName, mntPhone]);

  useEffect(() => {
    return () => {
      if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
    };
  }, []);

  const flashAdded = (id: string) => {
    setAddedId(id);
    if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
    addedTimerRef.current = window.setTimeout(() => {
      setAddedId((prev) => (prev === id ? null : prev));
    }, 1800);
  };

  const availableMaintenance = useMemo(
    () => MAINTENANCE_SERVICES.filter((s) => s.available),
    [MAINTENANCE_SERVICES]
  );

  const filteredMaintenance = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return availableMaintenance.filter((srv) => {
      if (mntFilterCategory !== 'all' && srv.category !== mntFilterCategory) return false;
      if (!q) return true;
      return (
        srv.title.toLowerCase().includes(q) ||
        srv.code.toLowerCase().includes(q) ||
        srv.recommendation.toLowerCase().includes(q) ||
        srv.executionScope.some((x) => x.toLowerCase().includes(q)) ||
        srv.maintenanceScope.some((x) => x.toLowerCase().includes(q))
      );
    });
  }, [availableMaintenance, mntFilterCategory, searchQuery]);

  const handleOpenMaintenanceModal = (srv: WebsiteMaintenanceService) => {
    setSelectedMaintenance(srv);
    setMntRef(null);
    setMntErr('');
  };

  const handleAddMaintenanceToCart = (srv: WebsiteMaintenanceService) => {
    const asProduct: WebsiteProduct = {
      id: srv.id,
      code: srv.code,
      name: `[تنفيذ وصيانة] ${srv.title}`,
      category: srv.category === 'hvac' ? 'electrical' : srv.category,
      brand: 'PhiTech Engineering',
      unit: 'معاينة / خدمة',
      price: srv.visitFee || 0,
      installPrice: 0,
      currency: srv.currency || 'ج.م',
      description: srv.recommendation,
      specs: [...srv.executionScope.slice(0, 2), ...srv.maintenanceScope.slice(0, 2)],
      imageUrl: srv.imageUrl,
      inStock: srv.available,
    };
    cart.addToCart(asProduct, 1, true);
    flashAdded(srv.id);
  };

  const handleSubmitMaintenanceRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaintenance) return;
    setMntErr('');
    if (!mntName.trim() || mntPhone.replace(/\D/g, '').length < 8) {
      setMntErr('يرجى إدخال الاسم ورقم الجوال الصحيح للتواصل وتحديد موعد المعاينة');
      return;
    }
    setMntBusy(true);
    try {
      rememberVisitorContact({
        name: mntName.trim(),
        phone: mntPhone.trim(),
        email: cart.user?.email,
      });
      const res = await fetch('/api/website-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType: 'maintenance_request',
          userId: cart.user?.id || null,
          customerName: mntName.trim(),
          customerPhone: mntPhone.trim(),
          customerEmail: cart.user?.email || '',
          city: mntCity.trim(),
          address: mntAddress.trim(),
          notes: mntNotes.trim(),
          maintenanceService: {
            code: selectedMaintenance.code,
            title: selectedMaintenance.title,
            mode: mntMode,
            preferredDate: mntDate.trim(),
          },
          totalAmount: selectedMaintenance.visitFee || 0,
          currency: selectedMaintenance.currency || 'ج.م',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'تعذر تسجيل الطلب حالياً');
      }
      setMntRef(data.refCode || 'MNT-2026');
    } catch (err: any) {
      setMntErr(err?.message || 'حدث خطأ أثناء إرسال الطلب');
    } finally {
      setMntBusy(false);
    }
  };

  const categoryMap = useMemo(() => {
    const map: Record<string, (typeof PRODUCT_CATEGORIES)[number]> = {};
    for (const c of PRODUCT_CATEGORIES) map[c.id] = c;
    return map;
  }, []);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.specs.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [PRODUCTS, selectedCategory, searchQuery]);

  const handleToggleCardInstall = (id: string) => {
    setInstallSelections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleProductAdd = (p: WebsiteProduct, withInstall: boolean) => {
    cart.addToCart(p, 1, withInstall);
    flashAdded(p.id);
  };

  const handleBundleAdd = (bundleId: string) => {
    const bundle = SMART_BUNDLES.find((b) => b.id === bundleId);
    if (!bundle) return;
    const list: Array<{ product: WebsiteProduct; qty: number }> = [];
    for (const item of bundle.productIds) {
      const found = PRODUCTS.find((p) => p.id === item.productId);
      if (found) list.push({ product: found, qty: item.qty });
    }
    if (list.length > 0) {
      cart.addBundleToCart(list, true);
      flashAdded(bundleId);
    }
  };

  return (
    <div className={`pw st-page ${loginOpen || contactOpen || selectedMaintenance ? 'has-modal-blur' : ''}`} dir="rtl">
      <style>{CSS}</style>
      <style>{`
        .pw.st-page {
          background: #fbfaf7;
        }
        .pw.st-page .pw-unified-hero {
          background: linear-gradient(180deg, #fffaf4 0%, #fbfaf7 100%);
          padding: 104px 0 40px;
          border-bottom: 1px solid #e7e1d7;
        }
        .pw.st-page .pw-unified-hero .pw-head {
          margin-bottom: 24px;
        }
        .pw.st-page .pw-unified-hero .pw-head h1 {
          font-size: clamp(1.55rem, 2.8vw, 2.25rem);
          font-weight: 800;
          line-height: 1.38;
          color: #14181b;
          margin-bottom: 12px;
        }
        .pw.st-page .pw-unified-hero .pw-head h1 em {
          font-style: normal;
          color: var(--o);
        }
        .st-mode-switch {
          max-width: 560px;
          margin: 24px auto 0;
          background: #f4efe6;
          border: 1px solid #e7e1d7;
          border-radius: var(--r-card-sm);
          padding: 4px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
        }
        .st-mode-btn {
          min-height: 44px;
          padding: 8px 16px;
          border: none;
          border-radius: var(--r-btn-sm);
          background: transparent;
          color: #525e6a;
          font-weight: 800;
          font-size: 0.9rem;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
        }
        .st-mode-btn:hover {
          color: #14181b;
        }
        .st-mode-btn.is-active {
          background: #ffffff;
          color: #14181b;
          box-shadow: 0 6px 16px -10px rgba(20, 24, 27, 0.24);
        }
        .st-mode-btn.is-active.is-products {
          color: #c75517;
        }
        .st-mode-btn.is-active.is-mnt {
          color: #1e3a5f;
        }
        .st-mode-count {
          padding: 2px 8px;
          border-radius: var(--r-pill);
          background: #f4efe6;
          color: #525e6a;
          font-size: 0.76rem;
          font-weight: 800;
        }
        .st-mode-btn.is-active .st-mode-count {
          background: #fff3ea;
          color: #c75517;
        }
        .st-mode-btn.is-active.is-mnt .st-mode-count {
          background: #eef2f6;
          color: #1e3a5f;
        }
        .st-trust-strip {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px 24px;
          margin-top: 20px;
          color: #525e6a;
          font-size: 0.84rem;
          font-weight: 700;
        }
        .st-trust-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .st-trust-item svg {
          color: var(--o);
          flex-shrink: 0;
        }

        .st-main {
          padding-top: 32px;
          padding-bottom: 72px;
        }
        .st-toolbar {
          background: #ffffff;
          border: 1px solid #e7e1d7;
          border-radius: var(--r-card);
          padding: 20px 24px;
          margin-bottom: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 12px 30px -24px rgba(20, 24, 27, 0.14);
        }
        .st-toolbar-top {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
        }
        .st-search-box {
          flex: 1 1 300px;
          position: relative;
          display: flex;
          align-items: center;
          background: #fbfaf7;
          border: 1.5px solid #dfd7cc;
          border-radius: var(--r-btn);
          min-height: 44px;
          padding: 0 12px;
          gap: 10px;
          transition: border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
        }
        .st-search-box:focus-within {
          background: #ffffff;
          border-color: var(--o);
          box-shadow: 0 0 0 3px rgba(199, 85, 23, 0.12);
        }
        .st-search-box svg {
          color: #64748b;
          flex-shrink: 0;
        }
        .st-search-input {
          flex: 1;
          min-width: 0;
          border: none;
          outline: none;
          background: transparent;
          font-size: 0.95rem;
          font-weight: 600;
          color: #14181b;
          min-height: 40px;
        }
        .st-search-clear {
          width: 32px;
          height: 32px;
          border-radius: var(--r-btn-sm);
          border: none;
          background: #f4efe6;
          color: #47525c;
          display: grid;
          place-items: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .st-search-clear:hover {
          background: #e7dfd2;
          color: #14181b;
        }
        .st-toolbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .st-count-pill {
          min-height: 36px;
          padding: 6px 12px;
          border-radius: var(--r-pill);
          background: #f4efe6;
          color: #47525c;
          font-size: 0.82rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .st-count-pill strong {
          color: var(--o-dark);
          font-weight: 900;
        }
        .st-cats-bar {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 0;
        }
        .st-cat-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 36px;
          padding: 6px 14px;
          border-radius: var(--r-pill);
          border: 1px solid #e2dbd0;
          background: #fbfaf7;
          color: #47525c;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.16s ease;
          white-space: nowrap;
        }
        .st-cat-btn:hover {
          border-color: var(--o);
          color: #14181b;
          background: #ffffff;
        }
        .st-cat-btn.is-active {
          background: #14181b;
          color: #ffffff;
          border-color: #14181b;
          box-shadow: 0 8px 18px -10px rgba(20, 24, 27, 0.35);
        }
        .st-cat-count {
          opacity: 0.72;
          font-size: 0.78rem;
          font-weight: 800;
        }

        /* Product Cards Grid */
        .st-products-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 24px;
        }
        .st-prod-card {
          background: #ffffff;
          border: 1px solid #e7e1d7;
          border-radius: var(--r-card);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 14px 32px -24px rgba(20, 24, 27, 0.15);
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .st-prod-card:hover {
          transform: translateY(-3px);
          border-color: rgba(199, 85, 23, 0.45);
          box-shadow: 0 22px 44px -24px rgba(20, 24, 27, 0.22);
        }
        .st-prod-media {
          position: relative;
          aspect-ratio: 4 / 3;
          background: #0f161e;
          overflow: hidden;
        }
        .st-prod-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.35s ease;
        }
        .st-prod-card:hover .st-prod-media img {
          transform: scale(1.03);
        }
        .st-prod-badge {
          position: absolute;
          top: 12px;
          inset-inline-start: 12px;
          padding: 4px 12px;
          border-radius: var(--r-pill);
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid #e7e1d7;
          color: #14181b;
          font-size: 0.75rem;
          font-weight: 800;
          box-shadow: 0 4px 12px rgba(20, 24, 27, 0.14);
        }
        .st-prod-discount {
          position: absolute;
          top: 12px;
          inset-inline-end: 12px;
          padding: 4px 10px;
          border-radius: var(--r-pill);
          background: #059669;
          color: #ffffff;
          font-size: 0.74rem;
          font-weight: 800;
        }
        .st-prod-code-tag {
          position: absolute;
          bottom: 12px;
          inset-inline-start: 12px;
          padding: 3px 8px;
          border-radius: 6px;
          background: rgba(15, 22, 30, 0.78);
          backdrop-filter: blur(6px);
          color: #f8fafc;
          font-family: ui-monospace, Consolas, monospace;
          font-size: 0.72rem;
          font-weight: 800;
        }
        .st-prod-body {
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }
        .st-prod-cat {
          font-size: 0.78rem;
          font-weight: 800;
          color: var(--o);
        }
        .st-prod-body h3 {
          font-size: 1.04rem;
          font-weight: 800;
          line-height: 1.45;
          color: #14181b;
          margin: 0;
        }
        .st-prod-desc {
          font-size: 0.85rem;
          color: #525e6a;
          line-height: 1.6;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .st-prod-specs {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 4px;
          font-size: 0.8rem;
          color: #334155;
          font-weight: 600;
        }
        .st-prod-specs li {
          display: flex;
          align-items: flex-start;
          gap: 6px;
        }
        .st-prod-specs li::before {
          content: '';
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--o);
          margin-top: 8px;
          flex-shrink: 0;
        }
        .st-prod-foot {
          padding: 16px 24px 20px;
          border-top: 1px solid #efe9df;
          background: #fbfaf7;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .st-install-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 40px;
          padding: 8px 12px;
          border-radius: var(--r-btn);
          background: #ffffff;
          border: 1px solid #dfd7cc;
          color: #47525c;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
        }
        .st-install-toggle.is-checked {
          background: #ecfdf5;
          border-color: #10b981;
          color: #065f46;
        }
        .st-install-toggle input {
          accent-color: #059669;
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }
        .st-price-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 12px;
        }
        .st-price-old {
          font-size: 0.78rem;
          color: #94a3b8;
          text-decoration: line-through;
          display: block;
        }
        .st-price-main {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .st-price-main strong {
          font-size: 1.24rem;
          font-weight: 900;
          color: #14181b;
        }
        .st-price-main span {
          font-size: 0.8rem;
          font-weight: 700;
          color: #525e6a;
        }
        .st-price-quote strong {
          font-size: 0.96rem;
          font-weight: 800;
          color: var(--o-dark);
          display: block;
        }
        .st-price-quote span {
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
        }
        .st-prod-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .st-prod-actions .pw-btn {
          flex: 1;
        }
        .st-prod-actions .pw-btn.is-added {
          background: #059669;
          box-shadow: 0 10px 20px -12px rgba(5, 150, 105, 0.7);
        }
        .st-wa-link {
          min-height: 44px;
          padding: 10px 14px;
          border-radius: var(--r-btn);
          border: 1px solid #dfd7cc;
          background: #ffffff;
          color: #14181b;
          font-size: 0.85rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
          transition: border-color 0.16s ease, color 0.16s ease, background 0.16s ease;
        }
        .st-wa-link:hover {
          border-color: var(--o);
          color: var(--o-dark);
          background: #fff8f3;
        }

        /* Smart Bundles Section */
        .st-bundles-section {
          margin-top: 56px;
          padding-top: 48px;
          border-top: 1px solid #e7e1d7;
        }
        .st-section-head {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 24px;
        }
        .st-section-head .pw-eyebrow {
          margin-bottom: 6px;
        }
        .st-section-head h2 {
          font-size: clamp(1.3rem, 2.2vw, 1.75rem);
          font-weight: 800;
          color: #14181b;
          margin: 0 0 6px;
        }
        .st-section-head p {
          font-size: 0.92rem;
          color: #525e6a;
          margin: 0;
        }
        .st-bundles-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
        }
        .st-bundle-card {
          background: linear-gradient(155deg, #ffffff 0%, #fcf7f1 100%);
          border: 1px solid #ebd7c4;
          border-top: 3px solid var(--o);
          border-radius: var(--r-card);
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 16px;
          box-shadow: 0 14px 32px -24px rgba(199, 85, 23, 0.25);
        }
        .st-bundle-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .st-bundle-badge {
          background: var(--o);
          color: #ffffff;
          padding: 4px 12px;
          border-radius: var(--r-pill);
          font-size: 0.76rem;
          font-weight: 800;
        }
        .st-bundle-note {
          font-size: 0.78rem;
          color: #64748b;
          font-weight: 700;
        }
        .st-bundle-card h3 {
          font-size: 1.14rem;
          font-weight: 800;
          color: #14181b;
          margin-bottom: 6px;
        }
        .st-bundle-sub {
          font-size: 0.86rem;
          color: #525e6a;
          line-height: 1.6;
          margin-bottom: 12px;
        }
        .st-bundle-items {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.84rem;
          color: #334155;
          font-weight: 700;
        }
        .st-bundle-items li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .st-bundle-items svg {
          color: #059669;
          flex-shrink: 0;
          margin-top: 3px;
        }
        .st-bundle-foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid #f0dfd0;
        }
        .st-bundle-price {
          font-size: 1.32rem;
          font-weight: 900;
          color: var(--o-dark);
        }

        /* Maintenance & Engineering Execution Tab */
        .st-mnt-banner {
          background: #ffffff;
          border: 1px solid #e7e1d7;
          border-inline-start: 4px solid var(--o);
          border-radius: var(--r-card);
          padding: 24px;
          margin-bottom: 24px;
          display: grid;
          gap: 16px;
          box-shadow: 0 12px 28px -24px rgba(20, 24, 27, 0.14);
        }
        .st-mnt-banner-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .st-mnt-banner-top h2 {
          font-size: 1.24rem;
          font-weight: 800;
          color: #14181b;
          margin: 4px 0 0;
        }
        .st-mnt-kicker {
          font-size: 0.78rem;
          font-weight: 800;
          color: var(--o);
        }
        .st-mnt-warranty-pill {
          background: #fff3ea;
          border: 1px solid #fed7aa;
          color: var(--o-dark);
          padding: 6px 14px;
          border-radius: var(--r-pill);
          font-size: 0.8rem;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .st-mnt-rules {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .st-mnt-rule {
          background: #fbfaf7;
          border: 1px solid #e7e1d7;
          border-radius: var(--r-card-sm);
          padding: 16px;
          font-size: 0.83rem;
          color: #47525c;
          line-height: 1.6;
        }
        .st-mnt-rule strong {
          display: block;
          color: #14181b;
          font-weight: 800;
          margin-bottom: 4px;
        }
        .st-mnt-rule-num {
          color: var(--o);
          font-family: ui-monospace, Consolas, monospace;
          margin-inline-end: 6px;
        }
        .st-mnt-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
        }
        .st-mnt-card {
          background: #ffffff;
          border: 1px solid #e7e1d7;
          border-radius: var(--r-card);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 14px 32px -24px rgba(20, 24, 27, 0.14);
        }
        .st-mnt-card-head {
          padding: 20px 24px;
          background: linear-gradient(155deg, #fbfaf7 0%, #ffffff 100%);
          border-bottom: 1px solid #efe9df;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .st-mnt-code {
          display: block;
          font-family: ui-monospace, Consolas, monospace;
          font-size: 0.74rem;
          font-weight: 800;
          color: var(--o);
          margin-bottom: 4px;
        }
        .st-mnt-card-head h3 {
          margin: 0;
          font-size: 1.06rem;
          font-weight: 800;
          color: #14181b;
          line-height: 1.45;
        }
        .st-mnt-card-body {
          padding: 20px 24px;
          display: grid;
          gap: 12px;
        }
        .st-mnt-scopes {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .st-mnt-scope-box {
          background: #fbfaf7;
          border: 1px solid #e7e1d7;
          border-radius: var(--r-card-sm);
          padding: 12px;
        }
        .st-mnt-scope-box.is-exec {
          border-top: 2px solid var(--o);
        }
        .st-mnt-scope-box.is-fix {
          border-top: 2px solid #1e3a5f;
        }
        .st-mnt-scope-box strong {
          display: block;
          font-size: 0.83rem;
          font-weight: 800;
          color: #14181b;
          margin-bottom: 8px;
        }
        .st-mnt-scope-box ul {
          display: grid;
          gap: 6px;
          font-size: 0.8rem;
          color: #47525c;
          font-weight: 600;
        }
        .st-mnt-scope-box li {
          display: flex;
          align-items: flex-start;
          gap: 6px;
        }
        .st-mnt-rec {
          background: #fff8f1;
          border: 1px solid #f5dcc6;
          border-inline-start: 3px solid var(--o);
          border-radius: var(--r-card-sm);
          padding: 12px 16px;
          font-size: 0.81rem;
          line-height: 1.65;
          color: #5c3a21;
          font-weight: 600;
        }
        .st-mnt-foot {
          padding: 16px 24px;
          border-top: 1px solid #efe9df;
          background: #fbfaf7;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .st-mnt-fee-label {
          font-size: 0.76rem;
          color: #64748b;
          display: block;
          font-weight: 700;
        }
        .st-mnt-fee-val {
          font-size: 1.12rem;
          font-weight: 900;
          color: #14181b;
        }
        .st-mnt-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        /* Empty Search State */
        .st-empty {
          background: #ffffff;
          border: 1px dashed #dfd7cc;
          border-radius: var(--r-card);
          padding: 48px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #525e6a;
        }
        .st-empty h3 {
          color: #14181b;
          font-size: 1.12rem;
          font-weight: 800;
        }

        /* Maintenance Booking Modal (8pt Grid: 560px medium modal, 16px radius, 24px padding) */
        .st-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 99985;
          background: rgba(14, 18, 22, 0.56);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          direction: rtl;
        }
        .st-modal-card {
          width: 100%;
          max-width: 560px;
          background: #ffffff;
          color: #14181b;
          border: 1px solid #e7e1d7;
          border-radius: var(--r-card);
          padding: 24px;
          box-shadow: 0 28px 64px -20px rgba(10, 15, 20, 0.42);
          max-height: calc(100dvh - 32px);
          overflow-y: auto;
        }
        .st-modal-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .st-modal-head h3 {
          font-size: 1.12rem;
          font-weight: 800;
          color: #14181b;
          margin: 0;
        }
        .st-modal-close {
          width: 40px;
          height: 40px;
          border-radius: var(--r-btn);
          border: 1px solid #e7e1d7;
          background: #fbfaf7;
          color: #47525c;
          display: grid;
          place-items: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .st-modal-close:hover {
          background: #fee2e2;
          border-color: #fecaca;
          color: #b91c1c;
        }
        .st-modal-service-box {
          background: #fbfaf7;
          border: 1px solid #e7e1d7;
          border-inline-start: 3px solid var(--o);
          border-radius: var(--r-card-sm);
          padding: 12px 16px;
          font-size: 0.84rem;
          margin-bottom: 12px;
        }
        .st-modal-service-box strong {
          display: block;
          color: #14181b;
          margin-bottom: 2px;
        }
        .st-modal-service-box span {
          color: #525e6a;
        }
        .st-modal-grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .st-modal-input {
          width: 100%;
          min-height: 44px;
          padding: 10px 16px;
          border-radius: var(--r-btn);
          border: 1.5px solid #dfd7cc;
          background: #fbfaf7;
          color: #14181b;
          font-weight: 600;
          font-size: 0.94rem;
          outline: none;
        }
        .st-modal-input:focus {
          background: #ffffff;
          border-color: var(--o);
        }
        .st-modal-err {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          padding: 10px 12px;
          border-radius: var(--r-btn-sm);
          font-size: 0.82rem;
          font-weight: 700;
        }

        /* Unified Frosted Light Footer matching Homepage */
        .pw.st-page .pw-footer {
          background: rgba(251, 250, 247, 0.94);
          border-top: 1px solid rgba(20, 24, 27, 0.09);
          color: #14181b;
        }
        .pw.st-page .pw-footer-brand strong {
          color: #14181b;
        }
        .pw.st-page .pw-footer-brand small {
          color: #525e6a;
        }
        .pw.st-page .pw-footer-nav {
          color: #47525c;
        }
        .pw.st-page .pw-footer-nav a:hover {
          color: #c75517;
        }
        .pw.st-page .pw-footer-link {
          color: #14181b;
          background: #ffffff;
          border-color: rgba(20, 24, 27, 0.14);
        }
        .pw.st-page .pw-footer-link:hover {
          background: var(--o);
          border-color: var(--o);
          color: #ffffff;
        }
        .pw.st-page .pw-footer-link.is-accent {
          color: #a64310;
          background: #fff3ea;
          border-color: #fed7aa;
        }
        .pw.st-page .pw-footer-bottom {
          border-top-color: rgba(20, 24, 27, 0.09);
          color: #64748b;
        }

        @media (max-width: 1023px) {
          .st-products-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 20px;
          }
          .st-bundles-grid,
          .st-mnt-grid,
          .st-mnt-rules {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }
        @media (max-width: 639px) {
          .pw.st-page .pw-unified-hero {
            padding: 80px 0 32px;
          }
          .st-mode-switch {
            grid-template-columns: 1fr;
          }
          .st-toolbar {
            padding: 16px;
          }
          .st-cats-bar {
            flex-wrap: nowrap;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            padding-bottom: 4px;
          }
          .st-cats-bar::-webkit-scrollbar {
            display: none;
          }
          .st-cat-btn {
            flex: 0 0 auto;
            min-height: 44px;
            padding: 8px 16px;
            font-size: 0.8125rem;
          }
          .st-products-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .st-prod-body,
          .st-prod-foot,
          .st-bundle-card,
          .st-mnt-banner,
          .st-mnt-card-head,
          .st-mnt-card-body,
          .st-mnt-foot,
          .st-modal-card {
            padding: 16px;
          }
          .st-mnt-scopes,
          .st-modal-grid2 {
            grid-template-columns: 1fr;
          }
          .st-bundles-grid,
          .st-mnt-grid {
            gap: 16px;
          }
        }
      `}</style>

      {/* Unified Light Header */}
      <PublicHeader
        siteName={SITE.name}
        siteNameEn={SITE.nameEn}
        activeKey="store"
        cartCount={cart.totalCount}
        onOpenCart={() => cart.setCartOpen(true)}
        userName={cart.user?.fullName}
        userEmail={cart.user?.email}
        portalHref={cart.portalHref}
        onOpenLogin={() => (cart.user ? cart.setCartOpen(true) : setLoginOpen(true))}
        onSignOut={cart.signOut}
        onOpenContact={() => setContactOpen(true)}
      />

      {/* Sunlit Unified Store Hero */}
      <section className="pw-unified-hero">
        <div className="pw-wrap">
          {PROMO_BANNER.enabled && <div className="pw-unified-promo">{PROMO_BANNER.text}</div>}

          <nav className="pw-unified-crumb" aria-label="مسار التنقل">
            <Link href="/">الرئيسية</Link>
            <span className="sep">/</span>
            <span>متجر المبيعات والسمارت هوم</span>
          </nav>

          <div className="pw-head">
            <p className="pw-eyebrow">متجر فاي تك الهندسي · توريد وتركيب معتمد</p>
            <h1>
              تجهيزات متكاملة من <em>خامات التشطيب</em> إلى أنظمة <em>السمارت هوم والأمان</em>
            </h1>
            <p>
              تصفّح المنتجات بالصور الحقيقية، أضف خيار التركيب الهندسي عند الحاجة، وأرسل طلبك للسلة مباشرة بدون تسجيل إلزامي.
            </p>
          </div>

          <div className="st-mode-switch" role="tablist" aria-label="أقسام المتجر">
            <button
              type="button"
              role="tab"
              aria-selected={activeStoreTab === 'products'}
              onClick={() => setActiveStoreTab('products')}
              className={`st-mode-btn is-products ${activeStoreTab === 'products' ? 'is-active' : ''}`}
            >
              <StoreIcon />
              <span>كتالوج المنتجات</span>
              <span className="st-mode-count">{PRODUCTS.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeStoreTab === 'maintenance'}
              onClick={() => setActiveStoreTab('maintenance')}
              className={`st-mode-btn is-mnt ${activeStoreTab === 'maintenance' ? 'is-active' : ''}`}
            >
              <WrenchIcon />
              <span>التنفيذ والصيانة</span>
              <span className="st-mode-count">{availableMaintenance.length}</span>
            </button>
          </div>

          <div className="st-trust-strip" aria-label="مزايا الطلب من متجر فاي تك">
            <span className="st-trust-item">
              <TruckIcon />
              <span>توريد مباشر أو توريد مع تركيب هندسي</span>
            </span>
            <span className="st-trust-item">
              <ShieldIcon />
              <span>ضمان مكتوب على الأصناف والبرمجة</span>
            </span>
            <span className="st-trust-item">
              <BoltIcon />
              <span>اعتماد فوري من السلة دون تسجيل إلزامي</span>
            </span>
          </div>
        </div>
      </section>

      <main className="pw-wrap st-main">
        {activeStoreTab === 'maintenance' ? (
          <section aria-label="قسم التنفيذ والصيانة الشاملة">
            {/* Engineering Methodology Banner */}
            <div className="st-mnt-banner">
              <div className="st-mnt-banner-top">
                <div>
                  <span className="st-mnt-kicker">منهجية فاي تك في التنفيذ والصيانة الموثّقة</span>
                  <h2>تنفيذ متكامل لجميع البنود وتشخيص أعطال بأحدث الأجهزة</h2>
                </div>
                <span className="st-mnt-warranty-pill">
                  <ShieldIcon />
                  <span>إشراف مهندس مختص · ضمان موثّق</span>
                </span>
              </div>

              <div className="st-mnt-rules">
                <div className="st-mnt-rule">
                  <strong>
                    <span className="st-mnt-rule-num">01</span>قاعدة الكشف المبكر قبل التشطيب
                  </strong>
                  <span>اختبار ضغط السباكة 10 بار، والميجر للكهرباء، والنيتروجين للتكييف قبل الإغلاق.</span>
                </div>
                <div className="st-mnt-rule">
                  <strong>
                    <span className="st-mnt-rule-num">02</span>قاعدة الصيانة بدون تكسير
                  </strong>
                  <span>استخدام كواشف تسرب المياه والكاميرا الحرارية وإصلاح الدوائر بأقل تدخل ممكن.</span>
                </div>
                <div className="st-mnt-rule">
                  <strong>
                    <span className="st-mnt-rule-num">03</span>باقة الصيانة الوقائية الدورية
                  </strong>
                  <span>فحص نصف سنوي للكهرباء والحساسات والتكييف والعزل يقلل الأعطال المفاجئة.</span>
                </div>
              </div>
            </div>

            {/* Maintenance Search & Trade Filter */}
            <div className="st-toolbar">
              <div className="st-toolbar-top">
                <div className="st-search-box">
                  <SearchIcon />
                  <input
                    type="search"
                    className="st-search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث في خدمات التنفيذ والصيانة (كهرباء، تسريب مياه، تكييف مخفي، سمارت هوم...)"
                    aria-label="ابحث في خدمات التنفيذ والصيانة"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="st-search-clear"
                      onClick={() => setSearchQuery('')}
                      aria-label="مسح البحث"
                    >
                      <CloseIcon />
                    </button>
                  )}
                </div>

                <div className="st-toolbar-actions">
                  <span className="st-count-pill">
                    الخدمات المتاحة: <strong>{filteredMaintenance.length}</strong>
                  </span>
                  <button type="button" onClick={() => cart.setCartOpen(true)} className="pw-btn pw-btn-ghost pw-btn-sm">
                    <BagIcon />
                    <span>السلة ({cart.totalCount})</span>
                  </button>
                </div>
              </div>

              <div className="st-cats-bar" role="tablist" aria-label="أقسام التنفيذ والصيانة">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mntFilterCategory === 'all'}
                  onClick={() => setMntFilterCategory('all')}
                  className={`st-cat-btn ${mntFilterCategory === 'all' ? 'is-active' : ''}`}
                >
                  <span>كل البنود الهندسية</span>
                  <span className="st-cat-count">({availableMaintenance.length})</span>
                </button>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={mntFilterCategory === cat.id}
                    onClick={() => setMntFilterCategory(cat.id)}
                    className={`st-cat-btn ${mntFilterCategory === cat.id ? 'is-active' : ''}`}
                  >
                    <span>{cat.shortTitle}</span>
                  </button>
                ))}
                <button
                  type="button"
                  role="tab"
                  aria-selected={mntFilterCategory === 'hvac'}
                  onClick={() => setMntFilterCategory('hvac')}
                  className={`st-cat-btn ${mntFilterCategory === 'hvac' ? 'is-active' : ''}`}
                >
                  <span>تكييف وتهوية</span>
                </button>
              </div>
            </div>

            {filteredMaintenance.length === 0 ? (
              <div className="st-empty">
                <h3>لا توجد خدمة مطابقة للبحث الحالي</h3>
                <p>جرّب مسح نص البحث أو اختيار كل البنود الهندسية لعرض جميع القطاعات.</p>
                <button
                  type="button"
                  className="pw-btn pw-btn-primary pw-btn-sm"
                  onClick={() => {
                    setSearchQuery('');
                    setMntFilterCategory('all');
                  }}
                >
                  إظهار كل خدمات التنفيذ والصيانة
                </button>
              </div>
            ) : (
              <div className="st-mnt-grid">
                {filteredMaintenance.map((srv) => {
                  const isAdded = addedId === srv.id;
                  return (
                    <article key={srv.id} className="st-mnt-card">
                      <div>
                        <div className="st-mnt-card-head">
                          <div>
                            <span className="st-mnt-code">
                              {srv.code} · {srv.warrantyLabel}
                            </span>
                            <h3>{srv.title}</h3>
                          </div>
                          {srv.badge && <span className="st-bundle-badge">{srv.badge}</span>}
                        </div>

                        <div className="st-mnt-card-body">
                          <div className="st-mnt-scopes">
                            <div className="st-mnt-scope-box is-exec">
                              <strong>بنود التنفيذ والتأسيس</strong>
                              <ul>
                                {srv.executionScope.map((item) => (
                                  <li key={item}>
                                    <CheckIcon size={14} />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="st-mnt-scope-box is-fix">
                              <strong>بنود الصيانة والإصلاح</strong>
                              <ul>
                                {srv.maintenanceScope.map((item) => (
                                  <li key={item}>
                                    <CheckIcon size={14} />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {srv.recommendation && <div className="st-mnt-rec">{srv.recommendation}</div>}
                        </div>
                      </div>

                      <div className="st-mnt-foot">
                        <div>
                          {srv.visitFee > 0 ? (
                            <>
                              <span className="st-mnt-fee-label">رسوم المعاينة / الفحص</span>
                              <strong className="st-mnt-fee-val">
                                {srv.visitFee.toLocaleString('en-US')} {srv.currency}
                              </strong>
                            </>
                          ) : (
                            <>
                              <strong className="st-mnt-fee-val" style={{ fontSize: '0.96rem' }}>
                                المعاينة والتسعير حسب البند
                              </strong>
                              <span className="st-mnt-fee-label">{srv.warrantyLabel}</span>
                            </>
                          )}
                        </div>

                        <div className="st-mnt-actions">
                          <button
                            type="button"
                            onClick={() => handleOpenMaintenanceModal(srv)}
                            className="pw-btn pw-btn-primary pw-btn-sm"
                          >
                            طلب تنفيذ / صيانة
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddMaintenanceToCart(srv)}
                            className="pw-btn pw-btn-ghost pw-btn-sm"
                          >
                            <BagIcon />
                            <span>{isAdded ? 'تمت الإضافة ✓' : 'أضف للسلة'}</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <>
            {/* Search & Category Filter Toolbar */}
            <div className="st-toolbar">
              <div className="st-toolbar-top">
                <div className="st-search-box">
                  <SearchIcon />
                  <input
                    type="search"
                    className="st-search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن منتج (قفل ذكي، بورسلان كلكتا، خلاط مدفون، جوتن، كاميرات...)"
                    aria-label="ابحث عن منتج في المتجر"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="st-search-clear"
                      onClick={() => setSearchQuery('')}
                      aria-label="مسح البحث"
                    >
                      <CloseIcon />
                    </button>
                  )}
                </div>

                <div className="st-toolbar-actions">
                  <span className="st-count-pill">
                    المعروض: <strong>{filteredProducts.length}</strong> منتج
                  </span>
                  <a href="#store-bundles" className="pw-btn pw-btn-ghost pw-btn-sm">
                    باقات التوفير ↓
                  </a>
                  <button type="button" onClick={() => cart.setCartOpen(true)} className="pw-btn pw-btn-ghost pw-btn-sm">
                    <BagIcon />
                    <span>السلة ({cart.totalCount})</span>
                  </button>
                </div>
              </div>

              <div className="st-cats-bar" role="tablist" aria-label="أقسام المتجر">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === 'all'}
                  onClick={() => setSelectedCategory('all')}
                  className={`st-cat-btn ${selectedCategory === 'all' ? 'is-active' : ''}`}
                >
                  <span>جميع الأقسام</span>
                  <span className="st-cat-count">({PRODUCTS.length})</span>
                </button>
                {PRODUCT_CATEGORIES.map((cat) => {
                  const count = PRODUCTS.filter((p) => p.category === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      role="tab"
                      aria-selected={selectedCategory === cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`st-cat-btn ${selectedCategory === cat.id ? 'is-active' : ''}`}
                    >
                      <span>{cat.shortTitle}</span>
                      <span className="st-cat-count">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="st-empty">
                <h3>لا توجد منتجات مطابقة لبحثك</h3>
                <p>جرّب كلمة بحث أخرى أو استعرض جميع أقسام المتجر.</p>
                <button
                  type="button"
                  className="pw-btn pw-btn-primary pw-btn-sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                >
                  عرض كل المنتجات ({PRODUCTS.length})
                </button>
              </div>
            ) : (
              <div className="st-products-grid">
                {filteredProducts.map((p) => {
                  const cat = categoryMap[p.category] || PRODUCT_CATEGORIES[0];
                  const imageUrl = getProductImageUrl(p);
                  const withInstall = Boolean(installSelections[p.id]);
                  const isAdded = addedId === p.id;
                  const discountPct =
                    p.oldPrice && p.oldPrice > p.price
                      ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100)
                      : 0;
                  const unitTotal = p.price + (withInstall && p.installPrice ? p.installPrice : 0);
                  const waMsg = `مرحباً فاي تك، أريد تسعيرة وطلب: ${p.name} (${p.code}) — الوحدة: ${p.unit}${withInstall ? ' (توريد + تركيب)' : ' (توريد فقط)'}`;

                  return (
                    <article key={p.id} className="st-prod-card">
                      <div>
                        <div className="st-prod-media">
                          <img src={imageUrl} alt={p.name} loading="lazy" decoding="async" />
                          {p.badge && <span className="st-prod-badge">{p.badge}</span>}
                          {discountPct > 0 && <span className="st-prod-discount">خصم {discountPct}%</span>}
                          <span className="st-prod-code-tag" dir="ltr">
                            {p.code}
                          </span>
                        </div>

                        <div className="st-prod-body">
                          <span className="st-prod-cat">
                            {cat.shortTitle} · {p.brand}
                          </span>
                          <h3>{p.name}</h3>
                          <p className="st-prod-desc">{p.description}</p>
                          {p.specs.length > 0 && (
                            <ul className="st-prod-specs">
                              {p.specs.slice(0, 2).map((s) => (
                                <li key={s}>
                                  <span>{s}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      <div className="st-prod-foot">
                        <label className={`st-install-toggle ${withInstall ? 'is-checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={withInstall}
                            onChange={() => handleToggleCardInstall(p.id)}
                          />
                          <span>
                            {p.installPrice && p.installPrice > 0
                              ? `إضافة التركيب الهندسي (+${p.installPrice.toLocaleString('en-US')} ${p.currency})`
                              : 'شامل التركيب والبرمجة الهندسية'}
                          </span>
                        </label>

                        <div className="st-price-row">
                          <div>
                            {p.price > 0 ? (
                              <>
                                {p.oldPrice && p.oldPrice > p.price && (
                                  <span className="st-price-old">
                                    {p.oldPrice.toLocaleString('en-US')} {p.currency}
                                  </span>
                                )}
                                <div className="st-price-main">
                                  <strong>{unitTotal.toLocaleString('en-US')}</strong>
                                  <span>
                                    {p.currency} / {p.unit}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="st-price-quote">
                                <strong>تسعير فوري عند الطلب</strong>
                                <span>الوحدة: {p.unit}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="st-prod-actions">
                          <button
                            type="button"
                            disabled={!p.inStock}
                            onClick={() => handleProductAdd(p, withInstall)}
                            className={`pw-btn pw-btn-primary ${isAdded ? 'is-added' : ''}`}
                          >
                            {!p.inStock ? 'نفد حالياً' : isAdded ? 'تمت الإضافة ✓' : 'أضف للسلة'}
                          </button>

                          {cleanWa ? (
                            <a
                              href={`https://wa.me/${cleanWa}?text=${encodeURIComponent(waMsg)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="st-wa-link"
                              title="استفسار وسرعة تسعير عبر واتساب"
                            >
                              واتساب
                            </a>
                          ) : (
                            <button type="button" className="st-wa-link" onClick={() => setContactOpen(true)}>
                              استفسار
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Smart Bundles Section */}
            <section id="store-bundles" className="st-bundles-section" aria-labelledby="bundles-heading">
              <div className="st-section-head">
                <div>
                  <p className="pw-eyebrow">باقات التجهيز الكاملة</p>
                  <h2 id="bundles-heading">باقات السمارت هوم وحساسات الأمان الجاهزة</h2>
                  <p>تشكيلات متكاملة بالتركيب والبرمجة لحماية الشقق والفلل وتوفير التكلفة مقارنة بالطلب الفردي.</p>
                </div>
              </div>

              <div className="st-bundles-grid">
                {SMART_BUNDLES.map((b) => {
                  const isAdded = addedId === b.id;
                  return (
                    <div key={b.id} className="st-bundle-card">
                      <div>
                        <div className="st-bundle-top">
                          <span className="st-bundle-badge">{b.badge}</span>
                          <span className="st-bundle-note">شامل البرمجة والتطبيق</span>
                        </div>
                        <h3>{b.title}</h3>
                        <p className="st-bundle-sub">{b.subtitle}</p>
                        <ul className="st-bundle-items">
                          {b.items.map((it) => (
                            <li key={it}>
                              <CheckIcon size={15} />
                              <span>{it}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="st-bundle-foot">
                        <div>
                          {b.price > 0 ? (
                            <>
                              {b.oldPrice && b.oldPrice > b.price ? (
                                <span className="st-price-old">
                                  {b.oldPrice.toLocaleString('en-US')} {b.currency}
                                </span>
                              ) : null}
                              <strong className="st-bundle-price">
                                {b.price.toLocaleString('en-US')} {b.currency}
                              </strong>
                            </>
                          ) : (
                            <strong className="st-bundle-price" style={{ fontSize: '1.05rem' }}>
                              عرض سعر فوري
                            </strong>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleBundleAdd(b.id)}
                          className={`pw-btn pw-btn-primary ${isAdded ? 'is-added' : ''}`}
                        >
                          <BagIcon />
                          <span>{isAdded ? 'تمت إضافة الباقة ✓' : 'أضف الباقة للسلة'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Maintenance Booking Modal */}
      {selectedMaintenance && (
        <div className="st-modal-overlay" onClick={() => setSelectedMaintenance(null)}>
          <div className="st-modal-card" onClick={(e) => e.stopPropagation()}>
            {mntRef ? (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '9999px',
                    background: '#dcfce7',
                    color: '#059669',
                    display: 'grid',
                    placeItems: 'center',
                    marginInline: 'auto',
                  }}
                >
                  <CheckIcon size={22} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.16rem', fontWeight: 800, color: '#14181b' }}>
                  تم تسجيل طلب التنفيذ والصيانة بنجاح
                </h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#525e6a', lineHeight: 1.7 }}>
                  رقم المرجع: <strong style={{ fontFamily: 'ui-monospace, Consolas, monospace', color: '#14181b' }}>{mntRef}</strong>
                  <br />
                  سيتواصل معك المهندس المختص على الرقم <strong dir="ltr">{mntPhone}</strong> لتحديد موعد المعاينة.
                </p>
                <button type="button" onClick={() => setSelectedMaintenance(null)} className="pw-btn pw-btn-primary pw-btn-lg">
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitMaintenanceRequest} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="st-modal-head">
                  <h3>حجز خدمة تنفيذ أو صيانة هندسية</h3>
                  <button type="button" className="st-modal-close" onClick={() => setSelectedMaintenance(null)} aria-label="إغلاق">
                    <CloseIcon />
                  </button>
                </div>

                <div className="st-modal-service-box">
                  <strong>{selectedMaintenance.title}</strong>
                  <span>
                    الكود: {selectedMaintenance.code} · {selectedMaintenance.warrantyLabel}
                  </span>
                </div>

                <select className="st-modal-input" value={mntMode} onChange={(e) => setMntMode(e.target.value)}>
                  <option value="تنفيذ وتأسيس جديد">تنفيذ وتأسيس جديد</option>
                  <option value="صيانة وإصلاح عطل">صيانة وإصلاح عطل</option>
                  <option value="صيانة دورية / فحص وقائي">صيانة دورية / فحص وقائي</option>
                  <option value="طوارئ سريعة">طوارئ سريعة</option>
                </select>

                <div className="st-modal-grid2">
                  <input
                    className="st-modal-input"
                    value={mntName}
                    onChange={(e) => setMntName(e.target.value)}
                    placeholder="الاسم الكامل *"
                    required
                  />
                  <input
                    className="st-modal-input"
                    value={mntPhone}
                    onChange={(e) => setMntPhone(e.target.value)}
                    placeholder="رقم الجوال *"
                    dir="ltr"
                    inputMode="tel"
                    required
                    style={{ textAlign: 'right' }}
                  />
                </div>

                <div className="st-modal-grid2">
                  <input
                    className="st-modal-input"
                    value={mntCity}
                    onChange={(e) => setMntCity(e.target.value)}
                    placeholder="المدينة والمنطقة"
                  />
                  <input
                    className="st-modal-input"
                    value={mntDate}
                    onChange={(e) => setMntDate(e.target.value)}
                    placeholder="الموعد المفضل (مثال: غداً 4 عصراً)"
                  />
                </div>

                <input
                  className="st-modal-input"
                  value={mntAddress}
                  onChange={(e) => setMntAddress(e.target.value)}
                  placeholder="العنوان التفصيلي للموقع"
                />

                <textarea
                  className="st-modal-input"
                  value={mntNotes}
                  onChange={(e) => setMntNotes(e.target.value)}
                  placeholder="وصف العطل أو الأعمال المطلوب تنفيذها (مساحة تقريبية / تفاصيل)"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />

                {mntErr && <div className="st-modal-err">{mntErr}</div>}

                <button type="submit" disabled={mntBusy} className="pw-btn pw-btn-primary pw-btn-lg">
                  {mntBusy ? 'جاري إرسال الطلب...' : 'اعتماد وإرسال طلب التنفيذ والصيانة'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Unified Light Footer */}
      <footer className="pw-footer">
        <div className="pw-wrap">
          <div className="pw-footer-row">
            <div className="pw-footer-brand">
              <img src="/brand/phitech-mark-color.svg" alt="" />
              <div>
                <strong>{SITE.name}</strong>
                <small>{SITE.tagline}</small>
              </div>
            </div>
            <nav className="pw-footer-nav" aria-label="روابط التذييل">
              {PUBLIC_NAV_ITEMS.map((n) =>
                n.key === 'contact' ? (
                  <a
                    key={n.href}
                    href="#contact"
                    onClick={(e) => {
                      e.preventDefault();
                      setContactOpen(true);
                    }}
                  >
                    {n.label}
                  </a>
                ) : (
                  <Link key={n.href} href={n.href}>
                    {n.label}
                  </Link>
                )
              )}
            </nav>
            <div className="pw-footer-actions">
              <Link href="/verify" className="pw-footer-link is-accent">
                التحقق من صحة المستندات
              </Link>
              {(cart.portalHref || !cart.user) && (
                <Link href={cart.portalHref || '/login?portal=employee'} className="pw-footer-link">
                  بوابة الموظفين
                </Link>
              )}
            </div>
          </div>
          <p className="pw-footer-bottom">© {new Date().getFullYear()} {SITE.name} — جميع الحقوق محفوظة</p>
        </div>
      </footer>

      <div className="pw-dock-pad" aria-hidden="true" />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={cart.cartOpen}
        onClose={() => cart.setCartOpen(false)}
        user={cart.user}
        portalHref={cart.portalHref}
        onSignOut={cart.signOut}
        items={cart.items}
        totalAmount={cart.totalAmount}
        onUpdateQty={cart.updateQty}
        onToggleInstall={cart.toggleItemInstall}
        onRemoveItem={cart.removeItem}
        onClearCart={cart.clearCart}
        onRequireLogin={() => setLoginOpen(true)}
        whatsappNumber={SITE.contact.whatsapp}
      />

      {/* Floating Live Chat */}
      <FloatingContactChat
        whatsappNumber={SITE.contact.whatsapp}
        defaultName={cart.user?.fullName || ''}
        defaultPhone={cart.user?.phone || ''}
        contextLabel="متجر المنتجات والأنظمة الذكية"
      />

      {/* Login Modal */}
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} site={SITE} />
    </div>
  );
}
