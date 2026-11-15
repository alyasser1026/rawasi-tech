"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  SITE,
  PROJECTS,
  COMMITMENTS,
  FAQS,
  DEFAULT_PROMO_BANNER,
  sanitizeContent,
  type PromoBannerConfig,
} from '../site/site-content';
import {
  DEFAULT_PRODUCTS,
  DEFAULT_PROPERTIES,
  PRODUCT_CATEGORIES,
  type ProductCategoryId,
  type PropertyOfferType,
  type PropertyStatus,
  type WebsiteProduct,
  type WebsiteProperty,
} from '../site/store-catalog';

type Content = {
  site: {
    name: string;
    nameEn: string;
    legalName: string;
    tagline: string;
    headline: string;
    intro: string;
    offices: string[];
    contact: { phone: string; whatsapp: string; email: string; address: string; hours: string };
  };
  projects: { name: string; kind: string; area: string; status: string; place?: string }[];
  commitments: { title: string; text: string }[];
  faqs: { q: string; a: string }[];
  seo: { title: string; description: string };
  products: WebsiteProduct[];
  properties: WebsiteProperty[];
  promoBanner: PromoBannerConfig;
};

const TABS = [
  { id: 'products', label: '📦 المنتجات والعروض' },
  { id: 'properties', label: '🏢 عروض العقارات' },
  { id: 'orders', label: '🛍️ طلبات السلة والعقارات' },
  { id: 'livechat', label: '💬 الشات الحي مع الزوار' },
  { id: 'identity', label: '🎨 الهوية والتواصل' },
  { id: 'projects', label: '🏗️ الأعمال' },
  { id: 'texts', label: '📋 الالتزامات والأسئلة' },
  { id: 'seo', label: '🔍 محركات البحث' },
  { id: 'ready', label: '✅ الجاهزية' },
  { id: 'versions', label: '🕓 النسخ المنشورة' },
] as const;

function defaults(): Content {
  return {
    site: {
      name: SITE.name,
      nameEn: SITE.nameEn,
      legalName: SITE.legalName,
      tagline: SITE.tagline,
      headline: SITE.headline,
      intro: SITE.intro,
      offices: [...SITE.offices],
      contact: { ...SITE.contact },
    },
    projects: [...PROJECTS],
    commitments: COMMITMENTS.map((x) => ({ ...x })),
    faqs: FAQS.map((x) => ({ ...x })),
    seo: { title: 'فاي تك | مقاولات عامة وتشطيبات فاخرة ومتجر الأنظمة الذكية', description: '' },
    products: DEFAULT_PRODUCTS.map((p) => ({ ...p, specs: [...p.specs] })),
    properties: DEFAULT_PROPERTIES.map((p) => ({ ...p, features: [...p.features] })),
    promoBanner: { ...DEFAULT_PROMO_BANNER },
  };
}

function fromStored(raw: any): Content {
  const d = defaults();
  const s = sanitizeContent(raw);
  return {
    site: {
      ...d.site,
      ...(s.site || {}),
      contact: { ...d.site.contact, ...(s.site?.contact || {}) },
      offices: s.site?.offices?.length ? s.site.offices : d.site.offices,
    } as Content['site'],
    projects: (s.projects ?? d.projects) as Content['projects'],
    commitments: s.commitments?.length ? s.commitments : d.commitments,
    faqs: s.faqs?.length ? s.faqs : d.faqs,
    seo: { title: s.seo?.title || d.seo.title, description: s.seo?.description || '' },
    products: s.products?.length ? s.products : d.products,
    properties: s.properties?.length ? s.properties : d.properties,
    promoBanner: {
      enabled: s.promoBanner?.enabled ?? d.promoBanner.enabled,
      text: s.promoBanner?.text || d.promoBanner.text,
    },
  };
}

/** Compress uploaded image client-side so it fits comfortably inside website_versions JSONB */
async function compressImageToDataUrl(file: File, maxWidth = 720, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ملف الصورة غير صالح'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const RECOMMENDATIONS: {
  p: 'عالية' | 'متوسطة' | 'تحسين';
  title: string;
  why: string;
  done?: (c: Content, published: boolean) => boolean;
}[] = [
  {
    p: 'عالية',
    title: 'رقم واتساب وهاتف للتواصل',
    why: 'أغلب العملاء في المقاولات والمتجر يبدؤون بمحادثة سريعة.',
    done: (c) => !!(c.site.contact.whatsapp || c.site.contact.phone),
  },
  {
    p: 'عالية',
    title: 'كتالوج منتجات التشطيب والسمارت هوم',
    why: 'عرض المنتجات بالأسعار وخيار التركيب الهندسي يضاعف مبيعات التوريد والمقاولات.',
    done: (c) => c.products.length >= 9,
  },
  {
    p: 'عالية',
    title: 'عروض العقارات والوحدات السكنية والتجارية',
    why: 'عرض الوحدات المتاحة بالمساحات ونظام السداد يجذب المشترين والمستثمرين مباشرة.',
    done: (c) => c.properties.length > 0,
  },
  {
    p: 'متوسطة',
    title: 'وصف محركات البحث (SEO)',
    why: 'عنوان ووصف مكتوبان بعناية يحسنان الظهور ونسبة النقر من نتائج جوجل.',
    done: (c) => c.seo.description.length >= 80,
  },
];

export default function WebsiteAdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('products');
  const [c, setC] = useState<Content>(defaults());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [prodFilterCat, setProdFilterCat] = useState<'all' | ProductCategoryId>('all');

  // Orders & LiveChat states
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string>('');
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    const { data, error } = await supabase.rpc('website_admin_state');
    if (error) {
      setErr(
        /website_admin_state|schema cache|does not exist/i.test(error.message)
          ? 'لم يتم تفعيل قاعدة بيانات إدارة الموقع بعد (ملف work/website-admin.sql).'
          : /forbidden/i.test(error.message)
            ? 'هذه الصفحة للمديرين فقط.'
            : error.message
      );
    } else {
      setC(fromStored(data?.draft ?? data?.published));
      setPublished(data?.published ?? null);
      setHistory(data?.history ?? []);
      setDirty(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/website-store', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      }
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const loadChats = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/website-chat?mode=admin', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.sessions) ? data.sessions : [];
        setChatSessions(list);
        if (!activeChatSessionId && list[0]?.sessionId) {
          setActiveChatSessionId(list[0].sessionId);
        }
      }
    } catch {
      // ignore
    }
  }, [activeChatSessionId]);

  useEffect(() => {
    if (tab === 'orders') void loadOrders();
    if (tab === 'livechat') {
      void loadChats();
      const t = setInterval(loadChats, 5000);
      return () => clearInterval(t);
    }
  }, [tab, loadOrders, loadChats]);

  const upd = (fn: (d: Content) => void) => {
    setC((prev) => {
      const n = JSON.parse(JSON.stringify(prev)) as Content;
      fn(n);
      return n;
    });
    setDirty(true);
    setMsg('');
  };

  const saveDraft = async () => {
    setBusy(true);
    setErr('');
    const { error } = await supabase.rpc('website_save_draft', { p_content: c });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      setDirty(false);
      setMsg('تم حفظ المسودة بنجاح. اضغط «نشر على الموقع» لاعتماد التعديلات للزوار.');
    }
  };

  const publish = async () => {
    if (!window.confirm('نشر المحتوى والمنتجات والعقارات الحالية على الموقع العام؟')) return;
    setBusy(true);
    setErr('');
    const s = await supabase.rpc('website_save_draft', { p_content: c });
    if (s.error) {
      setBusy(false);
      setErr(s.error.message);
      return;
    }
    const { error } = await supabase.rpc('website_publish', { p_note: null });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      setMsg('✅ تم النشر بنجاح على الموقع الخارجي (phi-tech.org)!');
      void load();
    }
  };

  const restore = async (id: string) => {
    if (!window.confirm('استرجاع هذه النسخة كنسخة منشورة؟')) return;
    setBusy(true);
    const { error } = await supabase.rpc('website_restore', { p_version_id: id });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      setMsg('تم الاسترجاع.');
      void load();
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string, adminNote?: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch('/api/website-store', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ id: orderId, status, adminNote }),
    });
    void loadOrders();
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatSessionId || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/website-chat', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sessionId: activeChatSessionId,
          replyText: replyText.trim(),
          senderName: 'الإدارة الهندسية — فاي تك',
        }),
      });
      if (res.ok) {
        setReplyText('');
        void loadChats();
      }
    } finally {
      setSendingReply(false);
    }
  };

  const score = useMemo(() => {
    const checks = RECOMMENDATIONS.filter((r) => r.done);
    const ok = checks.filter((r) => r.done!(c, !!published)).length;
    return { ok, total: checks.length, pct: Math.round((ok / checks.length) * 100) };
  }, [c, published]);

  const ct = c.site.contact;
  const activeChat = chatSessions.find((s) => s.sessionId === activeChatSessionId) || null;
  const totalUnreadChats = chatSessions.reduce((acc, s) => acc + Number(s.unreadByAdmin || 0), 0);

  return (
    <div className="wa" dir="rtl">
      <style>{CSS}</style>
      <header className="wa-top">
        <div>
          <h1>لوحة التحكم الشاملة في الموقع الخارجي والمتجر والعقارات</h1>
          <p>
            تحكم كامل في المنتجات والـ 9 أقسام الهندسية، الأسعار، الصور، عروض العقارات، طلبات سلة العملاء، والرد الفوري على الشات الحي.
          </p>
        </div>
        <div className="wa-actions">
          <Link href="/" target="_blank" className="wa-btn">
            الرئيسية ↗
          </Link>
          <Link href="/store" target="_blank" className="wa-btn">
            المتجر ↗
          </Link>
          <Link href="/real-estate" target="_blank" className="wa-btn">
            العقارات ↗
          </Link>
          <button className="wa-btn" onClick={saveDraft} disabled={busy || !dirty}>
            حفظ المسودة
          </button>
          <button className="wa-btn wa-primary" onClick={publish} disabled={busy}>
            🚀 نشر التعديلات على الموقع
          </button>
        </div>
      </header>

      {err && <div className="wa-alert wa-err">{err}</div>}
      {msg && <div className="wa-alert wa-ok">{msg}</div>}
      {dirty && (
        <div className="wa-alert" style={{ borderColor: '#f97316', fontWeight: 700 }}>
          ⚠️ لديك تعديلات غير منشورة — اضغط «نشر التعديلات على الموقع» لتظهر للزوار فوراً.
        </div>
      )}

      <nav className="wa-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'on' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'livechat' && totalUnreadChats > 0 ? ` (${totalUnreadChats})` : ''}
          </button>
        ))}
      </nav>

      {loading ? (
        <p className="wa-muted">جاري تحميل بيانات الموقع والمتجر…</p>
      ) : (
        <main className="wa-panel">
          {/* 1. إدارة المنتجات والعروض */}
          {tab === 'products' && (
            <>
              <div className="wa-card wa-form">
                <h3 className="wa-wide" style={{ marginTop: 0 }}>
                  🔥 شريط العروض الترويجي في أعلى المتجر والعقارات
                </h3>
                <label className="wa-f" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={c.promoBanner.enabled}
                    onChange={(e) => upd((d) => { d.promoBanner.enabled = e.target.checked; })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <strong>تفعيل شريط العروض العلوي</strong>
                </label>
                <F
                  label="نص العرض الترويجي"
                  v={c.promoBanner.text}
                  on={(v) => upd((d) => { d.promoBanner.text = v; })}
                  wide
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', margin: '8px 0' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`wa-btn ${prodFilterCat === 'all' ? 'wa-primary' : ''}`}
                    onClick={() => setProdFilterCat('all')}
                  >
                    الكل ({c.products.length})
                  </button>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`wa-btn ${prodFilterCat === cat.id ? 'wa-primary' : ''}`}
                      onClick={() => setProdFilterCat(cat.id)}
                    >
                      {cat.icon} {cat.shortTitle} ({c.products.filter((p) => p.category === cat.id).length})
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="wa-btn wa-primary"
                  onClick={() =>
                    upd((d) => {
                      d.products.unshift({
                        id: `prod-${Date.now()}`,
                        code: `PHI-${d.products.length + 101}`,
                        name: 'منتج جديد',
                        category: prodFilterCat === 'all' ? 'electrical' : prodFilterCat,
                        brand: 'PhiTech',
                        unit: 'قطعة',
                        price: 1000,
                        oldPrice: 1250,
                        installPrice: 200,
                        currency: 'ج.م',
                        badge: 'عرض جديد',
                        description: 'وصف تفصيلي للمنتج والمواصفات الهندسية...',
                        specs: ['ضمان معتمد', 'مطابق للمواصفات القياسية'],
                        inStock: true,
                      });
                    })
                  }
                >
                  + إضافة منتج جديد
                </button>
              </div>

              {c.products.map((p, idx) => {
                if (prodFilterCat !== 'all' && p.category !== prodFilterCat) return null;
                return (
                  <div key={p.id || idx} className="wa-card wa-form">
                    <F
                      label="اسم المنتج"
                      v={p.name}
                      on={(v) => upd((d) => { d.products[idx].name = v; })}
                      wide
                    />
                    <label className="wa-f">
                      <span>القسم الهندسي</span>
                      <select
                        value={p.category}
                        onChange={(e) =>
                          upd((d) => {
                            d.products[idx].category = e.target.value as ProductCategoryId;
                          })
                        }
                        style={{ padding: '9px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}
                      >
                        {PRODUCT_CATEGORIES.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <F
                      label="كود المنتج"
                      v={p.code}
                      on={(v) => upd((d) => { d.products[idx].code = v; })}
                      dir="ltr"
                    />
                    <F
                      label="العلامة التجارية / الماركة"
                      v={p.brand}
                      on={(v) => upd((d) => { d.products[idx].brand = v; })}
                    />
                    <F
                      label="وحدة البيع (قطعة، م²، طقم، لفة...)"
                      v={p.unit}
                      on={(v) => upd((d) => { d.products[idx].unit = v; })}
                    />
                    <F
                      label="السعر الحالي"
                      v={String(p.price)}
                      on={(v) => upd((d) => { d.products[idx].price = Number(v) || 0; })}
                      dir="ltr"
                    />
                    <F
                      label="السعر قبل الخصم (اختياري)"
                      v={p.oldPrice ? String(p.oldPrice) : ''}
                      on={(v) => upd((d) => { d.products[idx].oldPrice = Number(v) || undefined; })}
                      dir="ltr"
                    />
                    <F
                      label="تكلفة التركيب الهندسي للوحدة (اختياري)"
                      v={p.installPrice ? String(p.installPrice) : ''}
                      on={(v) => upd((d) => { d.products[idx].installPrice = Number(v) || 0; })}
                      dir="ltr"
                    />
                    <F
                      label="شارة العرض (مثال: الأكثر مبيعاً / خصم خاص)"
                      v={p.badge || ''}
                      on={(v) => upd((d) => { d.products[idx].badge = v || undefined; })}
                    />
                    <F
                      label="وصف المنتج"
                      v={p.description}
                      on={(v) => upd((d) => { d.products[idx].description = v; })}
                      wide
                      area
                    />
                    <F
                      label="المواصفات الفنية (افصل بينها بفاصلة ،)"
                      v={p.specs.join('، ')}
                      on={(v) =>
                        upd((d) => {
                          d.products[idx].specs = v
                            .split(/[,،]/)
                            .map((s) => s.trim())
                            .filter(Boolean);
                        })
                      }
                      wide
                    />
                    <div className="wa-wide" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                      <label className="wa-f" style={{ flex: 1, minWidth: '240px' }}>
                        <span>رابط صورة المنتج (أو ارفع صورة من جهازك)</span>
                        <input
                          value={p.imageUrl || ''}
                          dir="ltr"
                          placeholder="https://... أو ارفع صورة بالزر المجاور"
                          onChange={(e) => upd((d) => { d.products[idx].imageUrl = e.target.value || undefined; })}
                        />
                      </label>
                      <label className="wa-btn" style={{ alignSelf: 'end', cursor: 'pointer' }}>
                        📷 رفع صورة من الجهاز
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const dataUrl = await compressImageToDataUrl(file);
                              upd((d) => {
                                d.products[idx].imageUrl = dataUrl;
                              });
                            } catch (err: any) {
                              alert(err?.message || 'تعذر رفع الصورة');
                            }
                          }}
                        />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'end', paddingBottom: '8px' }}>
                        <input
                          type="checkbox"
                          checked={p.inStock}
                          onChange={(e) => upd((d) => { d.products[idx].inStock = e.target.checked; })}
                        />
                        <span>متوفر بالمخزون</span>
                      </label>
                      <button
                        type="button"
                        className="wa-btn wa-danger"
                        onClick={() => upd((d) => { d.products.splice(idx, 1); })}
                      >
                        🗑️ حذف المنتج
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* 2. إدارة عروض العقارات */}
          {tab === 'properties' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>🏢 الوحدات والعروض العقارية ({c.properties.length})</h3>
                <button
                  type="button"
                  className="wa-btn wa-primary"
                  onClick={() =>
                    upd((d) => {
                      d.properties.unshift({
                        id: `prop-${Date.now()}`,
                        code: `PHI-UNIT-${d.properties.length + 101}`,
                        title: 'وحدة عقارية جديدة',
                        subtitle: 'تشطيب هندسي متكامل بمواصفات فاي تك',
                        type: 'apartment',
                        typeLabel: 'شقة سكنية',
                        city: 'القاهرة / المنصورة',
                        location: 'موقع متميز',
                        areaSqm: 175,
                        bedrooms: 3,
                        bathrooms: 2,
                        floorLabel: 'الدور الخامس',
                        finishingLabel: 'تشطيب سوبر لوكس + سمارت هوم',
                        deliveryLabel: 'استلام فوري',
                        price: 3500000,
                        downPaymentPct: 25,
                        installmentYears: 3,
                        currency: 'ج.م',
                        status: 'available',
                        badge: 'عرض جديد',
                        features: ['واجهة بحرية مفتوحة', 'تأسيس سباكة وكهرباء معتمد بضمان 10 سنوات'],
                      });
                    })
                  }
                >
                  + إضافة عرض عقاري جديد
                </button>
              </div>

              {c.properties.map((prop, idx) => (
                <div key={prop.id || idx} className="wa-card wa-form">
                  <F
                    label="عنوان الوحدة العقارية"
                    v={prop.title}
                    on={(v) => upd((d) => { d.properties[idx].title = v; })}
                    wide
                  />
                  <F
                    label="الوصف المختصر"
                    v={prop.subtitle}
                    on={(v) => upd((d) => { d.properties[idx].subtitle = v; })}
                    wide
                  />
                  <F
                    label="كود الوحدة"
                    v={prop.code}
                    on={(v) => upd((d) => { d.properties[idx].code = v; })}
                    dir="ltr"
                  />
                  <label className="wa-f">
                    <span>نوع العقار</span>
                    <select
                      value={prop.type}
                      onChange={(e) =>
                        upd((d) => {
                          d.properties[idx].type = e.target.value as PropertyOfferType;
                        })
                      }
                      style={{ padding: '9px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}
                    >
                      <option value="apartment">شقة سكنية</option>
                      <option value="duplex">دوبلكس / فيلا</option>
                      <option value="commercial">تجاري / إداري</option>
                    </select>
                  </label>
                  <label className="wa-f">
                    <span>حالة التوفر</span>
                    <select
                      value={prop.status}
                      onChange={(e) =>
                        upd((d) => {
                          d.properties[idx].status = e.target.value as PropertyStatus;
                        })
                      }
                      style={{ padding: '9px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}
                    >
                      <option value="available">متاحة للحجز</option>
                      <option value="reserved">محجوزة مبدئياً</option>
                      <option value="sold">تم البيع</option>
                    </select>
                  </label>
                  <F
                    label="المدينة"
                    v={prop.city}
                    on={(v) => upd((d) => { d.properties[idx].city = v; })}
                  />
                  <F
                    label="الموقع التفصيلي"
                    v={prop.location}
                    on={(v) => upd((d) => { d.properties[idx].location = v; })}
                  />
                  <F
                    label="المساحة (م²)"
                    v={String(prop.areaSqm)}
                    on={(v) => upd((d) => { d.properties[idx].areaSqm = Number(v) || 0; })}
                    dir="ltr"
                  />
                  <F
                    label="عدد الغرف"
                    v={String(prop.bedrooms)}
                    on={(v) => upd((d) => { d.properties[idx].bedrooms = Number(v) || 0; })}
                    dir="ltr"
                  />
                  <F
                    label="عدد الحمامات"
                    v={String(prop.bathrooms)}
                    on={(v) => upd((d) => { d.properties[idx].bathrooms = Number(v) || 0; })}
                    dir="ltr"
                  />
                  <F
                    label="السعر الإجمالي"
                    v={String(prop.price)}
                    on={(v) => upd((d) => { d.properties[idx].price = Number(v) || 0; })}
                    dir="ltr"
                  />
                  <F
                    label="نسبة المقدم (%)"
                    v={prop.downPaymentPct !== undefined ? String(prop.downPaymentPct) : ''}
                    on={(v) => upd((d) => { d.properties[idx].downPaymentPct = Number(v) || undefined; })}
                    dir="ltr"
                  />
                  <F
                    label="سنوات التقسيط"
                    v={prop.installmentYears !== undefined ? String(prop.installmentYears) : ''}
                    on={(v) => upd((d) => { d.properties[idx].installmentYears = Number(v) || undefined; })}
                    dir="ltr"
                  />
                  <F
                    label="مستوى التشطيب"
                    v={prop.finishingLabel}
                    on={(v) => upd((d) => { d.properties[idx].finishingLabel = v; })}
                  />
                  <F
                    label="الأدوار المتاحة"
                    v={prop.floorLabel}
                    on={(v) => upd((d) => { d.properties[idx].floorLabel = v; })}
                  />
                  <F
                    label="موعد الاستلام"
                    v={prop.deliveryLabel}
                    on={(v) => upd((d) => { d.properties[idx].deliveryLabel = v; })}
                  />
                  <F
                    label="شارة العرض (مثال: شامل سمارت هوم)"
                    v={prop.badge || ''}
                    on={(v) => upd((d) => { d.properties[idx].badge = v || undefined; })}
                  />
                  <F
                    label="مميزات الوحدة (افصل بينها بفاصلة ،)"
                    v={prop.features.join('، ')}
                    on={(v) =>
                      upd((d) => {
                        d.properties[idx].features = v
                          .split(/[,،]/)
                          .map((f) => f.trim())
                          .filter(Boolean);
                      })
                    }
                    wide
                  />
                  <div className="wa-wide" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                    <label className="wa-f" style={{ flex: 1, minWidth: '240px' }}>
                      <span>صورة العقار (رابط أو رفع من الجهاز)</span>
                      <input
                        value={prop.imageUrl || ''}
                        dir="ltr"
                        onChange={(e) => upd((d) => { d.properties[idx].imageUrl = e.target.value || undefined; })}
                      />
                    </label>
                    <label className="wa-btn" style={{ alignSelf: 'end', cursor: 'pointer' }}>
                      📷 رفع صورة العقار
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const dataUrl = await compressImageToDataUrl(file);
                            upd((d) => {
                              d.properties[idx].imageUrl = dataUrl;
                            });
                          } catch (err: any) {
                            alert(err?.message || 'تعذر رفع الصورة');
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="wa-btn wa-danger"
                      onClick={() => upd((d) => { d.properties.splice(idx, 1); })}
                    >
                      🗑️ حذف الوحدة
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* 3. طلبات السلة وحجوزات العقارات */}
          {tab === 'orders' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>🛍️ سجل طلبات سلة المشتريات وحجوزات العقارات ({orders.length})</h3>
                <button type="button" className="wa-btn" onClick={loadOrders} disabled={ordersLoading}>
                  🔄 تحديث القائمة
                </button>
              </div>
              {ordersLoading ? (
                <p className="wa-muted">جاري تحميل الطلبات...</p>
              ) : orders.length === 0 ? (
                <p className="wa-muted">لا توجد طلبات مسجلة حتى الآن.</p>
              ) : (
                orders.map((ord) => (
                  <div key={ord.id} className="wa-card" style={{ display: 'grid', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      <div>
                        <span className="wa-pill p-متوسطة" style={{ marginLeft: '8px' }}>
                          {ord.refCode}
                        </span>
                        <strong>{ord.customerName || ord.subject}</strong> —{' '}
                        <span dir="ltr" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                          {ord.customerPhone}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select
                          value={ord.status || 'جديد'}
                          onChange={(e) => handleUpdateOrderStatus(ord.id, e.target.value)}
                          style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--line)', fontWeight: 700 }}
                        >
                          <option value="جديد">🆕 جديد</option>
                          <option value="جاري التواصل والتجهيز">⏳ جاري التواصل والتجهيز</option>
                          <option value="تم التوريد">🚚 تم التوريد</option>
                          <option value="مكتمل">✅ مكتمل</option>
                          <option value="ملغي">❌ ملغي</option>
                        </select>
                        {ord.customerPhone && (
                          <a
                            href={`https://wa.me/${String(ord.customerPhone).replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="wa-btn wa-primary"
                            style={{ background: '#16a34a', borderColor: '#16a34a' }}
                          >
                            💬 واتساب العميل
                          </a>
                        )}
                      </div>
                    </div>

                    {ord.type === 'property_inquiry' && ord.property ? (
                      <div style={{ fontSize: '14px', background: 'var(--bg)', padding: '10px', borderRadius: '8px' }}>
                        🏢 <strong>طلب معاينة وحدة عقارية:</strong> {ord.property.title} ({ord.property.code}) — السعر:{' '}
                        {Number(ord.property.price || 0).toLocaleString('en-US')} {ord.property.currency || 'ج.م'}
                      </div>
                    ) : Array.isArray(ord.items) ? (
                      <div style={{ fontSize: '13.5px', background: 'var(--bg)', padding: '10px 12px', borderRadius: '8px' }}>
                        <strong>الأصناف المطلوبة ({ord.items.length}):</strong>
                        <ul style={{ margin: '6px 0 0', paddingInlineStart: '18px' }}>
                          {ord.items.map((it: any, i: number) => (
                            <li key={i}>
                              {it.name} — الكمية: <strong>{it.qty}</strong> ({it.unit}){' '}
                              {it.withInstall ? '✅ شامل التركيب الهندسي' : ''}
                            </li>
                          ))}
                        </ul>
                        <div style={{ marginTop: '8px', fontWeight: 800, color: 'var(--acc)' }}>
                          الإجمالي الكلي: {Number(ord.totalAmount || 0).toLocaleString('en-US')} {ord.currency || 'ج.م'}
                        </div>
                      </div>
                    ) : null}

                    {(ord.city || ord.address || ord.notes) && (
                      <div style={{ fontSize: '13px', color: 'var(--mut)' }}>
                        {ord.city || ord.address ? `📍 العنوان: ${[ord.city, ord.address].filter(Boolean).join(' — ')} | ` : ''}
                        {ord.notes ? `📝 ملاحظات: ${ord.notes}` : ''}
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {/* 4. الشات الحي مع الزوار */}
          {tab === 'livechat' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) 1fr', gap: '14px', minHeight: '440px' }}>
              <div className="wa-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>المحادثات ({chatSessions.length})</strong>
                  <button type="button" className="wa-btn" onClick={loadChats} style={{ padding: '4px 8px', fontSize: '12px' }}>
                    تحديث
                  </button>
                </div>
                {chatSessions.length === 0 && <p className="wa-muted" style={{ fontSize: '13px' }}>لا توجد محادثات حية بعد.</p>}
                {chatSessions.map((s) => (
                  <button
                    key={s.sessionId}
                    type="button"
                    onClick={() => setActiveChatSessionId(s.sessionId)}
                    style={{
                      textAlign: 'right',
                      padding: '10px',
                      borderRadius: '8px',
                      border: activeChatSessionId === s.sessionId ? '2px solid var(--acc)' : '1px solid var(--line)',
                      background: activeChatSessionId === s.sessionId ? 'var(--bg)' : 'var(--card)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '14px' }}>{s.visitorName}</strong>
                      {s.unreadByAdmin > 0 && (
                        <span style={{ background: '#ef4444', color: '#fff', borderRadius: '99px', padding: '1px 7px', fontSize: '11px', fontWeight: 800 }}>
                          {s.unreadByAdmin} جديد
                        </span>
                      )}
                    </div>
                    <div dir="ltr" style={{ fontSize: '12px', color: 'var(--mut)', fontFamily: 'monospace', textAlign: 'right' }}>
                      📱 {s.visitorPhone}
                    </div>
                  </button>
                ))}
              </div>

              <div className="wa-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                {!activeChat ? (
                  <p className="wa-muted">اختر محادثة من القائمة الجانبية لعرض الرسائل والرد المباشر على العميل.</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <strong style={{ fontSize: '16px' }}>👤 {activeChat.visitorName}</strong>
                        <span style={{ marginRight: '10px', fontFamily: 'monospace', fontSize: '14px' }} dir="ltr">
                          {activeChat.visitorPhone}
                        </span>
                      </div>
                      {activeChat.visitorPhone && (
                        <a
                          href={`https://wa.me/${String(activeChat.visitorPhone).replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wa-btn wa-primary"
                          style={{ background: '#16a34a', borderColor: '#16a34a' }}
                        >
                          💬 فتح واتساب مع العميل
                        </a>
                      )}
                    </div>

                    <div style={{ flex: 1, maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px', background: 'var(--bg)', borderRadius: '8px' }}>
                      {(activeChat.messages || []).map((m: any) => {
                        const isVisitor = m.sender === 'visitor';
                        return (
                          <div
                            key={m.id}
                            style={{
                              alignSelf: isVisitor ? 'flex-start' : 'flex-end',
                              background: isVisitor ? 'var(--card)' : 'var(--acc)',
                              color: isVisitor ? 'var(--ink)' : '#fff',
                              border: '1px solid var(--line)',
                              borderRadius: '10px',
                              padding: '8px 12px',
                              maxWidth: '82%',
                            }}
                          >
                            <small style={{ display: 'block', opacity: 0.75, fontSize: '11px', marginBottom: '2px' }}>
                              {m.senderName}
                            </small>
                            <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{m.text}</div>
                          </div>
                        );
                      })}
                    </div>

                    <form onSubmit={handleSendAdminReply} style={{ display: 'flex', gap: '8px' }}>
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`اكتب ردك الفوري للأستاذ ${activeChat.visitorName} (سيظهر أمامه على الموقع فوراً)...`}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--line)',
                          background: 'var(--bg)',
                          color: 'var(--ink)',
                        }}
                      />
                      <button type="submit" className="wa-btn wa-primary" disabled={sendingReply || !replyText.trim()}>
                        {sendingReply ? 'جاري الإرسال...' : 'إرسال الرد ↵'}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}

          {tab === 'ready' && (
            <>
              <div className="wa-score">
                <div className="wa-ring" style={{ ['--p' as any]: score.pct }}>
                  <span>{score.pct}%</span>
                </div>
                <div>
                  <h2>جاهزية الموقع والمتجر للعملاء</h2>
                  <p className="wa-muted">
                    {score.ok} من {score.total} بنود أساسية مكتملة.{' '}
                    {published ? 'الموقع منشور حاليًا.' : 'لم تُنشر نسخة مخصصة بعد، فالموقع يعرض الكتالوج الافتراضي.'}
                  </p>
                </div>
              </div>
              <ul className="wa-recs">
                {RECOMMENDATIONS.map((r) => {
                  const done = r.done ? r.done(c, !!published) : null;
                  return (
                    <li key={r.title} className={done ? 'done' : ''}>
                      <span className={`wa-pill p-${r.p}`}>{done ? 'مكتمل' : r.p}</span>
                      <div>
                        <strong>{r.title}</strong>
                        <p>{r.why}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {tab === 'identity' && (
            <div className="wa-form">
              <F label="اسم الشركة" v={c.site.name} on={(v) => upd((d) => { d.site.name = v; })} />
              <F label="الاسم بالإنجليزية" v={c.site.nameEn} on={(v) => upd((d) => { d.site.nameEn = v; })} dir="ltr" />
              <F label="الاسم القانوني" v={c.site.legalName} on={(v) => upd((d) => { d.site.legalName = v; })} wide />
              <F label="الشعار النصي" v={c.site.tagline} on={(v) => upd((d) => { d.site.tagline = v; })} wide />
              <F label="العنوان الرئيسي" v={c.site.headline} on={(v) => upd((d) => { d.site.headline = v; })} wide />
              <F label="النبذة" v={c.site.intro} on={(v) => upd((d) => { d.site.intro = v; })} wide area />
              <F
                label="المكاتب (مفصولة بفاصلة)"
                v={c.site.offices.join('، ')}
                on={(v) =>
                  upd((d) => {
                    d.site.offices = v
                      .split(/[,،]/)
                      .map((x) => x.trim())
                      .filter(Boolean);
                  })
                }
                wide
              />
              <h3 className="wa-wide">بيانات التواصل والواتساب</h3>
              <F label="الهاتف" v={ct.phone} on={(v) => upd((d) => { d.site.contact.phone = v; })} dir="ltr" />
              <F
                label="واتساب (أرقام فقط بكود الدولة)"
                v={ct.whatsapp}
                on={(v) => upd((d) => { d.site.contact.whatsapp = v; })}
                dir="ltr"
              />
              <F label="البريد الإلكتروني" v={ct.email} on={(v) => upd((d) => { d.site.contact.email = v; })} dir="ltr" />
              <F label="ساعات العمل" v={ct.hours} on={(v) => upd((d) => { d.site.contact.hours = v; })} />
              <F label="العنوان" v={ct.address} on={(v) => upd((d) => { d.site.contact.address = v; })} wide />
            </div>
          )}

          {tab === 'projects' && (
            <>
              <div className="wa-alert">
                أضف هنا فقط الأعمال التي وافق أصحابها على نشرها. لا تُسحب هذه القائمة من مشاريع النظام الداخلي.
              </div>
              {c.projects.length === 0 && (
                <p className="wa-muted">لا توجد أعمال منشورة، وقسم «أعمالنا» مخفي من الموقع.</p>
              )}
              {c.projects.map((p, i) => (
                <div key={i} className="wa-card wa-form">
                  <F label="اسم العمل" v={p.name} on={(v) => upd((d) => { d.projects[i].name = v; })} />
                  <F label="النوع" v={p.kind} on={(v) => upd((d) => { d.projects[i].kind = v; })} />
                  <F label="المساحة" v={p.area} on={(v) => upd((d) => { d.projects[i].area = v; })} />
                  <F label="الحالة" v={p.status} on={(v) => upd((d) => { d.projects[i].status = v; })} />
                  <F label="المدينة (اختياري)" v={p.place || ''} on={(v) => upd((d) => { d.projects[i].place = v; })} />
                  <button className="wa-btn wa-danger" onClick={() => upd((d) => { d.projects.splice(i, 1); })}>
                    حذف
                  </button>
                </div>
              ))}
              <button
                className="wa-btn"
                onClick={() =>
                  upd((d) => {
                    d.projects.push({ name: '', kind: '', area: '', status: 'قيد التنفيذ' });
                  })
                }
              >
                + إضافة عمل
              </button>
            </>
          )}

          {tab === 'texts' && (
            <>
              <h3>الالتزامات (طريقة العمل)</h3>
              {c.commitments.map((x, i) => (
                <div key={i} className="wa-card wa-form">
                  <F label="العنوان" v={x.title} on={(v) => upd((d) => { d.commitments[i].title = v; })} />
                  <F label="النص" v={x.text} on={(v) => upd((d) => { d.commitments[i].text = v; })} wide area />
                  <button className="wa-btn wa-danger" onClick={() => upd((d) => { d.commitments.splice(i, 1); })}>
                    حذف
                  </button>
                </div>
              ))}
              <button
                className="wa-btn"
                onClick={() =>
                  upd((d) => {
                    d.commitments.push({ title: '', text: '' });
                  })
                }
              >
                + إضافة التزام
              </button>
              <h3>الأسئلة الشائعة</h3>
              {c.faqs.map((x, i) => (
                <div key={i} className="wa-card wa-form">
                  <F label="السؤال" v={x.q} on={(v) => upd((d) => { d.faqs[i].q = v; })} wide />
                  <F label="الإجابة" v={x.a} on={(v) => upd((d) => { d.faqs[i].a = v; })} wide area />
                  <button className="wa-btn wa-danger" onClick={() => upd((d) => { d.faqs.splice(i, 1); })}>
                    حذف
                  </button>
                </div>
              ))}
              <button
                className="wa-btn"
                onClick={() =>
                  upd((d) => {
                    d.faqs.push({ q: '', a: '' });
                  })
                }
              >
                + إضافة سؤال
              </button>
            </>
          )}

          {tab === 'seo' && (
            <div className="wa-form">
              <F
                label={`عنوان الصفحة في جوجل (${c.seo.title.length}/60)`}
                v={c.seo.title}
                on={(v) => upd((d) => { d.seo.title = v; })}
                wide
              />
              <F
                label={`الوصف (${c.seo.description.length}/160)`}
                v={c.seo.description}
                on={(v) => upd((d) => { d.seo.description = v; })}
                wide
                area
              />
              <div className="wa-serp wa-wide">
                <small>phi-tech.org</small>
                <strong>{c.seo.title || '—'}</strong>
                <span>{c.seo.description || 'اكتب وصفًا من 80 إلى 160 حرفًا يذكر الخدمة والمدينة.'}</span>
              </div>
            </div>
          )}

          {tab === 'versions' &&
            (history.length === 0 ? (
              <p className="wa-muted">لم تُنشر أي نسخة بعد.</p>
            ) : (
              <ul className="wa-recs">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className={`wa-pill ${h.status === 'published' ? 'p-ok' : 'p-تحسين'}`}>
                      {h.status === 'published' ? 'المنشورة الآن' : 'مؤرشفة'}
                    </span>
                    <div>
                      <strong>{h.published_at ? new Date(h.published_at).toLocaleString('ar-EG') : ''}</strong>
                      {h.note && <p>{h.note}</p>}
                    </div>
                    {h.status !== 'published' && (
                      <button className="wa-btn" disabled={busy} onClick={() => restore(h.id)}>
                        استرجاع
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ))}
        </main>
      )}
    </div>
  );
}

function F({
  label,
  v,
  on,
  wide,
  area,
  dir,
}: {
  label: string;
  v: string;
  on: (v: string) => void;
  wide?: boolean;
  area?: boolean;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <label className={`wa-f ${wide ? 'wa-wide' : ''}`}>
      <span>{label}</span>
      {area ? (
        <textarea rows={2} value={v} dir={dir} onChange={(e) => on(e.target.value)} />
      ) : (
        <input value={v} dir={dir} onChange={(e) => on(e.target.value)} />
      )}
    </label>
  );
}

const CSS = `
.wa{--bg:#f6f7f9;--card:#fff;--ink:#16202e;--mut:#5b6677;--line:#dfe3ea;--acc:#c75517;--ok:#1d7a4a;--bad:#b3261e;padding:20px;max-width:1140px;margin:0 auto;color:var(--ink);font-family:inherit}
@media(prefers-color-scheme:dark){.wa{--bg:#0f141b;--card:#171e28;--ink:#e8edf4;--mut:#9aa6b8;--line:#2a3442;--acc:#f08a4b;--ok:#4cc38a;--bad:#ff8a80}}
.wa-top{display:flex;gap:16px;justify-content:space-between;flex-wrap:wrap;align-items:flex-start;margin-bottom:12px}
.wa h1{font-size:22px;margin:0 0 4px}.wa-top p{margin:0;color:var(--mut);font-size:14px;max-width:620px}
.wa-actions{display:flex;gap:8px;flex-wrap:wrap}
.wa-btn{border:1px solid var(--line);background:var(--card);color:var(--ink);padding:9px 14px;border-radius:8px;cursor:pointer;font:inherit;text-decoration:none;font-size:13.5px;font-weight:700}
.wa-btn:disabled{opacity:.5;cursor:not-allowed}.wa-primary{background:var(--acc);border-color:var(--acc);color:#fff}.wa-danger{color:var(--bad);align-self:end}
.wa-alert{padding:10px 14px;border-radius:8px;background:var(--card);border:1px solid var(--line);margin:8px 0;font-size:14px}
.wa-err{border-color:var(--bad);color:var(--bad)}.wa-ok{border-color:var(--ok);color:var(--ok)}
.wa-tabs{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid var(--line);margin:14px 0}
.wa-tabs button{background:none;border:0;border-bottom:2px solid transparent;padding:10px 14px;color:var(--mut);cursor:pointer;font:inherit;white-space:nowrap;font-size:13.5px}
.wa-tabs button.on{color:var(--ink);border-bottom-color:var(--acc);font-weight:800}
.wa-panel{display:grid;gap:12px}.wa-muted{color:var(--mut)}
.wa-score{display:flex;gap:18px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
.wa-score h2{margin:0 0 4px;font-size:18px}.wa-score p{margin:0}
.wa-ring{--p:0;width:84px;height:84px;border-radius:50%;background:conic-gradient(var(--acc) calc(var(--p)*1%),var(--line) 0);display:grid;place-items:center;flex:none}
.wa-ring span{background:var(--card);width:66px;height:66px;border-radius:50%;display:grid;place-items:center;font-weight:700}
.wa-recs{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.wa-recs li{display:flex;gap:12px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.wa-recs li.done{opacity:.65}.wa-recs p{margin:4px 0 0;color:var(--mut);font-size:13.5px;line-height:1.7}.wa-recs li>div{flex:1;min-width:0}
.wa-pill{font-size:12px;padding:3px 9px;border-radius:99px;border:1px solid var(--line);white-space:nowrap;margin-top:2px}
.p-عالية{color:var(--bad);border-color:var(--bad)}.p-متوسطة{color:var(--acc);border-color:var(--acc)}.p-ok,.done .wa-pill{color:var(--ok);border-color:var(--ok)}
.wa-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.wa-wide{grid-column:1/-1}
.wa-card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}
.wa-f{display:grid;gap:5px;font-size:13px;color:var(--mut)}
.wa-f input,.wa-f textarea{background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:9px 10px;font:inherit;font-size:14px;width:100%;box-sizing:border-box}
.wa h3{margin:10px 0 0;font-size:15px}
.wa-serp{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;display:grid;gap:3px}.wa-serp strong{color:#1a0dab;font-weight:500;font-size:18px}.wa-serp span{color:var(--mut);font-size:13px}
@media(max-width:760px){.wa{padding:14px}}
`;
