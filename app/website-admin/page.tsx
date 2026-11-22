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
  DEFAULT_NEWS_TICKER,
  DEFAULT_CHAT_BOT_CONFIG,
  sanitizeContent,
  type ChatBotConfig,
  type NewsTickerConfig,
  type PromoBannerConfig,
} from '../site/site-content';
import type { ParsedNewsFeedItem } from '@/lib/rssNewsParser';
import {
  DEFAULT_MAINTENANCE_SERVICES,
  DEFAULT_PRODUCTS,
  DEFAULT_PROPERTIES,
  getProductImageUrl,
  PRODUCT_CATEGORIES,
  type ProductCategoryId,
  type PropertyOfferType,
  type PropertyStatus,
  type WebsiteMaintenanceService,
  type WebsiteProduct,
  type WebsiteProperty,
} from '../site/store-catalog';
import Product4DSpinViewer from '../site/Product4DSpinViewer';

const MAINTENANCE_CATEGORIES = PRODUCT_CATEGORIES.map((c) => ({
  id: c.id,
  icon: c.icon,
  title: c.title,
}));

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
  maintenanceServices: WebsiteMaintenanceService[];
  promoBanner: PromoBannerConfig;
  newsTicker: NewsTickerConfig;
  chatBotConfig: ChatBotConfig;
};

const TABS = [
  { id: 'products', label: '📦 المنتجات والعروض' },
  { id: 'properties', label: '🏢 عروض العقارات' },
  { id: 'maintenance', label: '🛠️ التنفيذ والصيانة' },
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
    maintenanceServices: DEFAULT_MAINTENANCE_SERVICES.map((m) => ({
      ...m,
      executionScope: [...m.executionScope],
      maintenanceScope: [...m.maintenanceScope],
    })),
    promoBanner: { ...DEFAULT_PROMO_BANNER },
    newsTicker: {
      ...DEFAULT_NEWS_TICKER,
      items: DEFAULT_NEWS_TICKER.items.map((item) => ({ ...item })),
    },
    chatBotConfig: {
      ...DEFAULT_CHAT_BOT_CONFIG,
      customRules: DEFAULT_CHAT_BOT_CONFIG.customRules.map((r) => ({
        ...r,
        quickReplies: r.quickReplies ? [...r.quickReplies] : undefined,
      })),
    },
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
    commitments: s.commitments ?? d.commitments,
    faqs: s.faqs ?? d.faqs,
    seo: { title: s.seo?.title || d.seo.title, description: s.seo?.description || '' },
    products: s.products ?? d.products,
    properties: s.properties ?? d.properties,
    maintenanceServices: s.maintenanceServices ?? d.maintenanceServices,
    promoBanner: {
      enabled: s.promoBanner?.enabled ?? d.promoBanner.enabled,
      text: s.promoBanner?.text ?? d.promoBanner.text,
    },
    newsTicker: {
      enabled: s.newsTicker?.enabled ?? d.newsTicker.enabled,
      autoFeedEnabled: s.newsTicker?.autoFeedEnabled ?? d.newsTicker.autoFeedEnabled,
      label: s.newsTicker?.label ?? d.newsTicker.label,
      speedSeconds: s.newsTicker?.speedSeconds ?? d.newsTicker.speedSeconds,
      items: s.newsTicker?.items ?? d.newsTicker.items,
    },
    chatBotConfig: {
      enabled: s.chatBotConfig?.enabled ?? d.chatBotConfig.enabled,
      botName: s.chatBotConfig?.botName || d.chatBotConfig.botName,
      welcomeText: s.chatBotConfig?.welcomeText || d.chatBotConfig.welcomeText,
      escalationText: s.chatBotConfig?.escalationText || d.chatBotConfig.escalationText,
      customRules: s.chatBotConfig?.customRules ?? d.chatBotConfig.customRules,
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

async function compressImageToBlob(file: File, maxWidth = 1000, quality = 0.82): Promise<Blob> {
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
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else resolve(file);
          },
          'image/webp',
          quality
        );
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
  const [catalogSearchQ, setCatalogSearchQ] = useState('');
  const [catalogSearchBusy, setCatalogSearchBusy] = useState(false);
  const [catalogSearchResults, setCatalogSearchResults] = useState<WebsiteProduct[]>([]);
  const [spinUploadStatus, setSpinUploadStatus] = useState<Record<string, string>>({});
  const [spinPreviewId, setSpinPreviewId] = useState<string | null>(null);

  // Orders & LiveChat states
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string>('');
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Live daily news feed importer states
  const [newsFeedTopic, setNewsFeedTopic] = useState<'all' | 'real_estate_eg' | 'real_estate_sa' | 'economy'>('all');
  const [newsFeedBusy, setNewsFeedBusy] = useState(false);
  const [newsFeedErr, setNewsFeedErr] = useState('');
  const [fetchedNews, setFetchedNews] = useState<ParsedNewsFeedItem[]>([]);
  const [newsUseSourceLink, setNewsUseSourceLink] = useState(false);

  const fetchDailyNews = useCallback(async () => {
    setNewsFeedBusy(true);
    setNewsFeedErr('');
    try {
      const res = await fetch(`/api/news-feed?topic=${encodeURIComponent(newsFeedTopic)}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'تعذر سحب الأخبار من المصادر الحالية');
      }
      setFetchedNews(Array.isArray(json.items) ? json.items : []);
      if (!json.items?.length) {
        setNewsFeedErr('لم يتم استرجاع عناوين حالياً، حاول مرة أخرى بعد لحظات.');
      }
    } catch (e: any) {
      setNewsFeedErr(e?.message || 'حدث خطأ أثناء الاتصال بخلاصة الأخبار');
    } finally {
      setNewsFeedBusy(false);
    }
  }, [newsFeedTopic]);

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

  const searchStoreCatalog = async () => {
    const q = catalogSearchQ.trim();
    if (!q) {
      setCatalogSearchResults([]);
      return;
    }
    setCatalogSearchBusy(true);
    try {
      const res = await fetch(`/api/store-catalog?q=${encodeURIComponent(q)}&pageSize=8`, {
        cache: 'no-store',
      });
      const json = await res.json().catch(() => null);
      setCatalogSearchResults(Array.isArray(json?.items) ? json.items : []);
    } catch {
      setCatalogSearchResults([]);
    } finally {
      setCatalogSearchBusy(false);
    }
  };

  const attachCatalogProductFor4D = (item: WebsiteProduct) => {
    upd((d) => {
      const existingIdx = d.products.findIndex(
        (x) => x.id === item.id || (x.code && item.code && x.code.toLowerCase() === item.code.toLowerCase())
      );
      if (existingIdx >= 0) {
        const [moved] = d.products.splice(existingIdx, 1);
        d.products.unshift(moved);
      } else {
        d.products.unshift({
          ...item,
          specs: Array.isArray(item.specs) ? [...item.specs] : [],
          spinImages: Array.isArray(item.spinImages) ? [...item.spinImages] : [],
        });
      }
    });
    setProdFilterCat('all');
    setSpinPreviewId(item.id);
    setMsg(`✓ تم تجهيز «${item.name}» بأعلى القائمة لرفع صور 4D / 360°.`);
  };

  const uploadSpinFilesToProduct = async (productId: string, files: FileList) => {
    const sorted = Array.from(files).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
    const currentProduct = c.products.find((item) => item.id === productId);
    const existingCount = Array.isArray(currentProduct?.spinImages) ? currentProduct.spinImages.length : 0;
    const remainingSlots = Math.max(0, 36 - existingCount);
    const queue = sorted.slice(0, remainingSlots);
    if (queue.length === 0) {
      alert('تم الوصول للحد الأقصى (36 زاوية 4D) لهذا المنتج.');
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    const uploadedUrls: string[] = [];
    for (let i = 0; i < queue.length; i++) {
      const file = queue[i];
      setSpinUploadStatus((prev) => ({
        ...prev,
        [productId]: `جاري رفع الزاوية ${i + 1} من ${queue.length} على تيليجرام...`,
      }));
      let resolvedUrl = '';
      if (token) {
        try {
          const blob = await compressImageToBlob(file, 1000, 0.82);
          const fd = new FormData();
          fd.append('file', new File([blob], file.name || `angle-${i + 1}.webp`, { type: blob.type || 'image/webp' }));
          fd.append('productId', productId);
          fd.append('caption', `4D Spin (${i + 1}/${queue.length}) · ${currentProduct?.code || productId}`);
          const res = await fetch('/api/store-media/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          const json = await res.json().catch(() => null);
          if (res.ok && json?.ok && typeof json.url === 'string') {
            resolvedUrl = json.url;
          }
        } catch {
          // Fall back to compressed local WebP below
        }
      }
      if (!resolvedUrl) {
        try {
          resolvedUrl = await compressImageToDataUrl(file, 640, 0.72);
        } catch {
          // Skip unreadable image
        }
      }
      if (resolvedUrl) {
        uploadedUrls.push(resolvedUrl);
      }
      if (i < queue.length - 1 && token) {
        await new Promise((r) => setTimeout(r, 180));
      }
    }

    if (uploadedUrls.length > 0) {
      upd((d) => {
        const targetIdx = d.products.findIndex((item) => item.id === productId);
        if (targetIdx < 0) return;
        const target = d.products[targetIdx];
        const nextSpin = [...(target.spinImages || []), ...uploadedUrls].slice(0, 36);
        target.spinImages = nextSpin;
        if (!target.imageUrl) {
          target.imageUrl = uploadedUrls[0];
        }
      });
      setSpinPreviewId(productId);
      setSpinUploadStatus((prev) => ({
        ...prev,
        [productId]: `✓ تم رفع وإضافة ${uploadedUrls.length} صورة زاوية 4D بنجاح. تذكّر الضغط على «نشر على الموقع».`,
      }));
    } else {
      setSpinUploadStatus((prev) => {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      });
    }
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
    if (error) {
      setBusy(false);
      setErr(error.message);
      return;
    }
    await fetch('/api/website-revalidate', { method: 'POST' }).catch(() => {});
    await load();
    setBusy(false);
    setMsg('✅ تم النشر وتحديث الموقع الخارجي (phi-tech.org) فوراً!');
  };

  const restore = async (id: string) => {
    if (!window.confirm('استرجاع هذه النسخة كنسخة منشورة؟')) return;
    setBusy(true);
    const { error } = await supabase.rpc('website_restore', { p_version_id: id });
    if (error) {
      setBusy(false);
      setErr(error.message);
      return;
    }
    await fetch('/api/website-revalidate', { method: 'POST' }).catch(() => {});
    await load();
    setBusy(false);
    setMsg('تم الاسترجاع وتحديث الموقع.');
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

  const patchChatSession = async (payload: Record<string, unknown>): Promise<boolean> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return false;
    const res = await fetch('/api/website-chat', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await loadChats();
      return true;
    }
    return false;
  };

  const sendAdminReplyText = async (text: string) => {
    const clean = text.trim();
    if (!activeChatSessionId || !clean || sendingReply) return;
    setSendingReply(true);
    try {
      const ok = await patchChatSession({
        sessionId: activeChatSessionId,
        replyText: clean,
        senderName: '👨‍💼 المهندس المختص — فاي تك',
      });
      if (ok && clean === replyText.trim()) {
        setReplyText('');
      }
    } finally {
      setSendingReply(false);
    }
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendAdminReplyText(replyText);
  };

  const handleToggleBotPaused = async (sessionId: string, nextPaused: boolean) => {
    await patchChatSession({
      sessionId,
      botPaused: nextPaused,
      clearEscalation: true,
    });
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

              <div className="wa-card wa-form">
                <div className="wa-wide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <h3 style={{ margin: 0 }}>
                    📰 شريط آخر الأخبار المتحرك في الشاشة الرئيسية
                  </h3>
                  <button
                    type="button"
                    className="wa-btn wa-primary"
                    onClick={() =>
                      upd((d) => {
                        d.newsTicker.items.unshift({
                          id: `news-${Date.now().toString(36)}`,
                          tag: 'جديد',
                          text: 'خبر أو عرض جديد من فاي تك — اضغط للتفاصيل',
                          href: '/store',
                          active: true,
                        });
                      })
                    }
                  >
                    + إضافة خبر جديد
                  </button>
                </div>

                <label className="wa-f" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={c.newsTicker.enabled}
                    onChange={(e) => upd((d) => { d.newsTicker.enabled = e.target.checked; })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <strong>تفعيل الشريط المتحرك في الصفحة الرئيسية</strong>
                </label>

                <label className="wa-f" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={c.newsTicker.autoFeedEnabled !== false}
                    onChange={(e) => upd((d) => { d.newsTicker.autoFeedEnabled = e.target.checked; })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <strong>مزامنة أخبار الاقتصاد والعقارات اليومية تلقائياً في الشريط</strong>
                </label>

                <F
                  label="عنوان الشارة (مثال: آخر الأخبار)"
                  v={c.newsTicker.label}
                  on={(v) => upd((d) => { d.newsTicker.label = v; })}
                />

                <label className="wa-f">
                  <span>سرعة الدورة بالثواني (16 سريع - 90 بطيء)</span>
                  <input
                    type="number"
                    min={16}
                    max={90}
                    value={c.newsTicker.speedSeconds}
                    onChange={(e) =>
                      upd((d) => {
                        const n = Number(e.target.value);
                        d.newsTicker.speedSeconds = Number.isFinite(n) ? Math.min(90, Math.max(16, n)) : 38;
                      })
                    }
                  />
                </label>

                <div
                  className="wa-wide"
                  style={{
                    border: '1px dashed var(--acc)',
                    borderRadius: '14px',
                    padding: '14px',
                    background: 'rgba(249,115,22,0.04)',
                    display: 'grid',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px' }}>
                        🌐 سحب آخر الأخبار الاقتصادية والعقارية اليوم تلقائياً (RSS)
                      </strong>
                      <small style={{ color: 'var(--mut)' }}>
                        يجلب أحدث العناوين من سكاي نيوز اقتصاد وCNN الاقتصادية وأخبار العقارات ومواد البناء في مصر والسعودية.
                      </small>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      <select
                        value={newsFeedTopic}
                        onChange={(e) => setNewsFeedTopic(e.target.value as any)}
                        style={{
                          background: 'var(--bg)',
                          color: 'var(--ink)',
                          border: '1px solid var(--line)',
                          borderRadius: '10px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          fontWeight: 700,
                        }}
                      >
                        <option value="all">الكل: عقارات واقتصاد (مصر + السعودية)</option>
                        <option value="real_estate_eg">عقارات ومواد بناء — مصر</option>
                        <option value="real_estate_sa">عقارات ومشاريع — السعودية</option>
                        <option value="economy">اقتصاد وأسواق عربية وعالمية</option>
                      </select>
                      <button
                        type="button"
                        className="wa-btn wa-primary"
                        disabled={newsFeedBusy}
                        onClick={() => void fetchDailyNews()}
                      >
                        {newsFeedBusy ? 'جاري السحب...' : '📥 سحب أخبار اليوم'}
                      </button>
                    </div>
                  </div>

                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', fontWeight: 700, color: 'var(--mut)' }}>
                    <input
                      type="checkbox"
                      checked={newsUseSourceLink}
                      onChange={(e) => setNewsUseSourceLink(e.target.checked)}
                    />
                    <span>عند الإضافة، اربط الخبر بموقعه الإخباري الأصلي (بدلاً من توجيهه لقسم فاي تك المناسب داخل موقعك)</span>
                  </label>

                  {newsFeedErr && <div className="wa-alert wa-err">{newsFeedErr}</div>}

                  {fetchedNews.length > 0 && (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '13px' }}>تم جلب {fetchedNews.length} خبر — اختر ما تريد نشره ثم اضغط «نشر»:</strong>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="wa-btn wa-primary"
                            onClick={() =>
                              upd((d) => {
                                d.newsTicker.items = fetchedNews.slice(0, 8).map((n) => ({
                                  id: `${n.id}-${Date.now().toString(36)}`,
                                  tag: n.tag,
                                  text: n.title,
                                  href: newsUseSourceLink && n.link ? n.link : n.suggestedHref,
                                  active: true,
                                }));
                              })
                            }
                          >
                            ⚡ استبدال الشريط بأهم 8 أخبار
                          </button>
                          <button
                            type="button"
                            className="wa-btn"
                            onClick={() =>
                              upd((d) => {
                                const mapped = fetchedNews.slice(0, 5).map((n) => ({
                                  id: `${n.id}-${Date.now().toString(36)}`,
                                  tag: n.tag,
                                  text: n.title,
                                  href: newsUseSourceLink && n.link ? n.link : n.suggestedHref,
                                  active: true,
                                }));
                                d.newsTicker.items = [...mapped, ...d.newsTicker.items].slice(0, 20);
                              })
                            }
                          >
                            ➕ إضافة أهم 5 أخبار أعلى الشريط
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                        {fetchedNews.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              borderRadius: '10px',
                              border: '1px solid var(--line)',
                              background: 'var(--card)',
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '2px' }}>
                                <span className="wa-pill p-متوسطة">{item.tag}</span>
                                <small style={{ color: 'var(--mut)', fontWeight: 700 }}>{item.source}</small>
                              </div>
                              <div style={{ fontSize: '13px', fontWeight: 800, lineHeight: 1.5 }}>{item.title}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                              {item.link && (
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="wa-btn"
                                  style={{ padding: '6px 10px', fontSize: '12px' }}
                                >
                                  المصدر ↗
                                </a>
                              )}
                              <button
                                type="button"
                                className="wa-btn wa-primary"
                                style={{ padding: '6px 10px', fontSize: '12px' }}
                                onClick={() =>
                                  upd((d) => {
                                    d.newsTicker.items.unshift({
                                      id: `${item.id}-${Date.now().toString(36)}`,
                                      tag: item.tag,
                                      text: item.title,
                                      href: newsUseSourceLink && item.link ? item.link : item.suggestedHref,
                                      active: true,
                                    });
                                    d.newsTicker.items = d.newsTicker.items.slice(0, 20);
                                  })
                                }
                              >
                                + إضافة
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="wa-wide" style={{ display: 'grid', gap: '10px' }}>
                  {c.newsTicker.items.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{
                        border: '1px solid var(--line)',
                        borderRadius: '12px',
                        padding: '12px',
                        background: 'var(--bg)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                        gap: '10px',
                        alignItems: 'end',
                      }}
                    >
                      <F
                        label="تصنيف قصير (Tag)"
                        v={item.tag || ''}
                        on={(v) => upd((d) => { d.newsTicker.items[idx].tag = v; })}
                      />
                      <F
                        label="نص الخبر أو العرض"
                        v={item.text}
                        on={(v) => upd((d) => { d.newsTicker.items[idx].text = v; })}
                        wide
                      />
                      <F
                        label="الرابط عند الضغط (مثال: /store أو /sections/smart-home)"
                        v={item.href || ''}
                        dir="ltr"
                        on={(v) => upd((d) => { d.newsTicker.items[idx].href = v; })}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700 }}>
                          <input
                            type="checkbox"
                            checked={item.active !== false}
                            onChange={(e) => upd((d) => { d.newsTicker.items[idx].active = e.target.checked; })}
                          />
                          <span>ظاهر</span>
                        </label>
                        <button
                          type="button"
                          className="wa-btn wa-danger"
                          onClick={() => upd((d) => { d.newsTicker.items.splice(idx, 1); })}
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="wa-card" style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong style={{ fontSize: '14px' }}>🔄 إضافة صور 4D / 360° لمنتج موجود بالمتجر (11,361+ منتج)</strong>
                    <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--mut)' }}>
                      ابحث باسم أو كود أي قطاع أو منتج لفتحه وإرفاق صور 4D التفاعلية الخاصة به على تيليجرام.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    className="wa-4d-search-input"
                    value={catalogSearchQ}
                    onChange={(e) => setCatalogSearchQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void searchStoreCatalog();
                      }
                    }}
                    placeholder="اكتب اسم المنتج أو الكود (مثال: سيكا، جوتن، كلكتا، قفل ذكي)..."
                  />
                  <button
                    type="button"
                    className="wa-btn wa-primary"
                    disabled={catalogSearchBusy}
                    onClick={() => void searchStoreCatalog()}
                  >
                    {catalogSearchBusy ? 'جاري البحث...' : 'بحث في الكتالوج (11,361+ منتج)'}
                  </button>
                </div>
                {catalogSearchResults.length > 0 && (
                  <div className="wa-4d-search-list">
                    {catalogSearchResults.map((item) => (
                      <div key={item.id} className="wa-4d-search-row">
                        <img
                          src={getProductImageUrl(item)}
                          alt={item.name}
                          width={48}
                          height={40}
                          style={{ objectFit: 'contain', borderRadius: '8px', background: '#fff', border: '1px solid var(--line)' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ display: 'block', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </strong>
                          <small style={{ color: 'var(--mut)', fontSize: '12px' }}>
                            {item.code} · {item.price > 0 ? `${item.price.toLocaleString('en-US')} ${item.currency}` : 'تسعير عند الطلب'}
                            {item.spinImages && item.spinImages.length >= 2 ? ` · ${item.spinImages.length} صورة 4D` : ''}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="wa-btn"
                          onClick={() => attachCatalogProductFor4D(item)}
                        >
                          + تعديل / رفع صور 4D
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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

                    <div className="wa-wide wa-4d-box">
                      <div className="wa-4d-head">
                        <div>
                          <strong>
                            🔄 صور العرض التفاعلي 4D / 360° (للفّ القطاع ورؤية كل زاوية — {p.spinImages?.length || 0} / 36 صورة)
                          </strong>
                          <small>
                            ارفع عدة صور للقطاع من جميع الزوايا (يُفضّل 8 إلى 24 صورة مرتّبة بالتسلسل). تُرفع تلقائياً على تيليجرام ويمكن للعميل لفّ القطاع والتكبير.
                          </small>
                        </div>
                        <div className="wa-4d-head-actions">
                          <label className="wa-btn wa-primary" style={{ cursor: 'pointer' }}>
                            📷 رفع صور 4D متعددة
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  void uploadSpinFilesToProduct(p.id, e.target.files);
                                }
                                e.target.value = '';
                              }}
                            />
                          </label>
                          {(p.spinImages?.length || 0) >= 2 && (
                            <button
                              type="button"
                              className="wa-btn"
                              onClick={() =>
                                setSpinPreviewId((prev) => (prev === p.id ? null : p.id))
                              }
                            >
                              {spinPreviewId === p.id ? 'إخفاء المعاينة' : 'معاينة 4D حية'}
                            </button>
                          )}
                          {(p.spinImages?.length || 0) > 0 && (
                            <button
                              type="button"
                              className="wa-btn wa-danger"
                              onClick={() =>
                                upd((d) => {
                                  d.products[idx].spinImages = [];
                                })
                              }
                            >
                              مسح صور 4D
                            </button>
                          )}
                        </div>
                      </div>

                      {spinUploadStatus[p.id] && (
                        <div className="wa-alert" style={{ margin: '6px 0' }}>
                          {spinUploadStatus[p.id]}
                        </div>
                      )}

                      {spinPreviewId === p.id && (p.spinImages?.length || 0) >= 2 && (
                        <div style={{ maxWidth: '420px', marginTop: '8px' }}>
                          <Product4DSpinViewer
                            compact
                            images={p.spinImages}
                            fallbackImage={getProductImageUrl(p)}
                            alt={p.name}
                            code={p.code}
                          />
                        </div>
                      )}

                      {p.spinImages && p.spinImages.length > 0 && (
                        <div className="wa-4d-grid">
                          {p.spinImages.map((imgSrc, frameIndex) => (
                            <div key={`${p.id}-spin-${frameIndex}`} className="wa-4d-thumb-card">
                              <img src={imgSrc} alt={`${p.name} - زاوية ${frameIndex + 1}`} loading="lazy" />
                              <span className="wa-4d-num">#{frameIndex + 1}</span>
                              <div className="wa-4d-thumb-bar">
                                <button
                                  type="button"
                                  disabled={frameIndex === 0}
                                  title="تقديم الزاوية"
                                  onClick={() =>
                                    upd((d) => {
                                      const arr = d.products[idx].spinImages || [];
                                      if (frameIndex <= 0 || frameIndex >= arr.length) return;
                                      const [moved] = arr.splice(frameIndex, 1);
                                      arr.splice(frameIndex - 1, 0, moved);
                                      d.products[idx].spinImages = arr;
                                    })
                                  }
                                >
                                  →
                                </button>
                                <button
                                  type="button"
                                  disabled={frameIndex >= (p.spinImages?.length || 0) - 1}
                                  title="تأخير الزاوية"
                                  onClick={() =>
                                    upd((d) => {
                                      const arr = d.products[idx].spinImages || [];
                                      if (frameIndex < 0 || frameIndex >= arr.length - 1) return;
                                      const [moved] = arr.splice(frameIndex, 1);
                                      arr.splice(frameIndex + 1, 0, moved);
                                      d.products[idx].spinImages = arr;
                                    })
                                  }
                                >
                                  ←
                                </button>
                                <button
                                  type="button"
                                  className="is-del"
                                  title="حذف الزاوية"
                                  onClick={() =>
                                    upd((d) => {
                                      const arr = d.products[idx].spinImages || [];
                                      arr.splice(frameIndex, 1);
                                      d.products[idx].spinImages = arr;
                                    })
                                  }
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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

          {/* 2.5. إدارة التنفيذ والصيانة والتوصيات الهندسية */}
          {tab === 'maintenance' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <h3 style={{ margin: 0 }}>🛠️ بنود التنفيذ والصيانة والتوصيات الهندسية ({c.maintenanceServices.length})</h3>
                  <p className="wa-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
                    ضع قيمة «رسوم المعاينة = 0» لعدم إظهار أي سعر مسبق وتظهر للعميل عبارة «المعاينة والتسعير حسب البند».
                  </p>
                </div>
                <button
                  type="button"
                  className="wa-btn wa-primary"
                  onClick={() =>
                    upd((d) => {
                      d.maintenanceServices.unshift({
                        id: `srv-${Date.now()}`,
                        code: `PHI-MNT-${String(d.maintenanceServices.length + 1).padStart(2, '0')}`,
                        title: 'خدمة تنفيذ وصيانة هندسية جديدة',
                        category: 'electrical',
                        icon: '🛠️',
                        badge: 'إشراف واستلام هندسي معتمد',
                        executionScope: ['توريد وتأسيس وفق المواصفة الهندسية المعتمدة'],
                        maintenanceScope: ['فحص دوري ومعالجة الأعطال الطارئة'],
                        recommendation: 'توصية فاي تك الهندسية: اكتب هنا النصيحة الفنية أو الاحتياطات الهندسية المهمة للعميل.',
                        warrantyLabel: 'ضمان هندسي معتمد على التنفيذ',
                        visitFee: 0,
                        currency: 'ج.م',
                        available: true,
                      });
                    })
                  }
                >
                  + إضافة بند تنفيذ وصيانة جديد
                </button>
              </div>

              {c.maintenanceServices.map((m, idx) => (
                <div key={m.id || idx} className="wa-card wa-form">
                  <F
                    label="اسم بند التنفيذ والصيانة"
                    v={m.title}
                    on={(v) => upd((d) => { d.maintenanceServices[idx].title = v; })}
                    wide
                  />
                  <label className="wa-f">
                    <span>التخصص الهندسي</span>
                    <select
                      value={m.category}
                      onChange={(e) =>
                        upd((d) => {
                          d.maintenanceServices[idx].category = e.target.value as WebsiteMaintenanceService['category'];
                        })
                      }
                      style={{ padding: '9px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}
                    >
                      {MAINTENANCE_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <F
                    label="الكود المرجعي"
                    v={m.code}
                    on={(v) => upd((d) => { d.maintenanceServices[idx].code = v; })}
                    dir="ltr"
                  />
                  <F
                    label="الأيقونة (إيموجي)"
                    v={m.icon}
                    on={(v) => upd((d) => { d.maintenanceServices[idx].icon = v || '🛠️'; })}
                  />
                  <F
                    label="شارة الميزة / الاستلام"
                    v={m.badge || ''}
                    on={(v) => upd((d) => { d.maintenanceServices[idx].badge = v; })}
                  />
                  <F
                    label="وصف الضمان الهندسي"
                    v={m.warrantyLabel}
                    on={(v) => upd((d) => { d.maintenanceServices[idx].warrantyLabel = v; })}
                  />
                  <F
                    label="رسوم المعاينة (0 = حسب البند بدون سعر مسبق)"
                    v={String(m.visitFee || 0)}
                    on={(v) => upd((d) => { d.maintenanceServices[idx].visitFee = Math.max(0, Number(v) || 0); })}
                    dir="ltr"
                  />

                  <label className="wa-f wa-wide">
                    <span>نطاق التنفيذ والتأسيس الجديد (سطر لكل نقطة)</span>
                    <textarea
                      rows={3}
                      value={m.executionScope.join('\n')}
                      onChange={(e) =>
                        upd((d) => {
                          d.maintenanceServices[idx].executionScope = e.target.value.split('\n');
                        })
                      }
                      onBlur={() =>
                        upd((d) => {
                          d.maintenanceServices[idx].executionScope = d.maintenanceServices[idx].executionScope
                            .map((s) => s.trim())
                            .filter(Boolean);
                        })
                      }
                      style={{ padding: '9px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}
                    />
                  </label>

                  <label className="wa-f wa-wide">
                    <span>نطاق الصيانة وإصلاح الأعطال (سطر لكل نقطة)</span>
                    <textarea
                      rows={3}
                      value={m.maintenanceScope.join('\n')}
                      onChange={(e) =>
                        upd((d) => {
                          d.maintenanceServices[idx].maintenanceScope = e.target.value.split('\n');
                        })
                      }
                      onBlur={() =>
                        upd((d) => {
                          d.maintenanceServices[idx].maintenanceScope = d.maintenanceServices[idx].maintenanceScope
                            .map((s) => s.trim())
                            .filter(Boolean);
                        })
                      }
                      style={{ padding: '9px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}
                    />
                  </label>

                  <F
                    label="💡 التوصية الهندسية الاحترافية للعميل"
                    v={m.recommendation}
                    on={(v) => upd((d) => { d.maintenanceServices[idx].recommendation = v; })}
                    wide
                    area
                  />

                  <div className="wa-wide" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                    <label className="wa-f" style={{ flex: 1, minWidth: '240px' }}>
                      <span>رابط صورة توضيحية للبند (أو ارفع صورة من جهازك)</span>
                      <input
                        value={m.imageUrl || ''}
                        dir="ltr"
                        placeholder="https://... أو ارفع صورة بالزر المجاور"
                        onChange={(e) => upd((d) => { d.maintenanceServices[idx].imageUrl = e.target.value || undefined; })}
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
                              d.maintenanceServices[idx].imageUrl = dataUrl;
                            });
                          } catch (err: any) {
                            alert(err?.message || 'تعذر رفع الصورة');
                          }
                        }}
                      />
                    </label>
                    {m.imageUrl && (
                      <button
                        type="button"
                        className="wa-btn"
                        style={{ alignSelf: 'end' }}
                        onClick={() => upd((d) => { d.maintenanceServices[idx].imageUrl = undefined; })}
                      >
                        🧹 إزالة الصورة
                      </button>
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'end', paddingBottom: '8px' }}>
                      <input
                        type="checkbox"
                        checked={m.available}
                        onChange={(e) => upd((d) => { d.maintenanceServices[idx].available = e.target.checked; })}
                      />
                      <span>متاح للحجز عبر الموقع</span>
                    </label>
                    <button
                      type="button"
                      className="wa-btn wa-danger"
                      onClick={() => upd((d) => { d.maintenanceServices.splice(idx, 1); })}
                    >
                      🗑️ حذف البند
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
                          style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontWeight: 700 }}
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

                    {ord.type === 'maintenance_request' && ord.maintenanceService ? (
                      <div style={{ fontSize: '14px', background: 'var(--bg)', padding: '10px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                        🛠️ <strong>طلب تنفيذ / صيانة هندسية:</strong> {ord.maintenanceService.title}
                        {ord.maintenanceService.code ? ` (${ord.maintenanceService.code})` : ''}
                        {ord.maintenanceService.mode ? ` — نوع الخدمة: ${ord.maintenanceService.mode}` : ''}
                        {ord.maintenanceService.serviceType ? ` — نوع الخدمة: ${ord.maintenanceService.serviceType}` : ''}
                        {Number(ord.maintenanceService.visitFee || 0) > 0
                          ? ` — رسوم المعاينة: ${Number(ord.maintenanceService.visitFee).toLocaleString('en-US')} ${ord.maintenanceService.currency || 'ج.م'}`
                          : ' — المعاينة والتسعير حسب البند'}
                      </div>
                    ) : ord.type === 'property_inquiry' && ord.property ? (
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
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 320px) 1fr', gap: '14px', minHeight: '460px' }}>
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
                        border: activeChatSessionId === s.sessionId
                          ? '2px solid var(--acc)'
                          : s.escalatedToHuman
                            ? '1.5px solid #dc2626'
                            : '1px solid var(--line)',
                        background: activeChatSessionId === s.sessionId ? 'var(--bg)' : 'var(--card)',
                        color: 'var(--ink)',
                        cursor: 'pointer',
                        display: 'grid',
                        gap: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '14px' }}>{s.visitorName}</strong>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {s.escalatedToHuman && (
                            <span style={{ background: '#dc2626', color: '#fff', borderRadius: '99px', padding: '1px 7px', fontSize: '11px', fontWeight: 800 }}>
                              🚨 يطلب تدخلك
                            </span>
                          )}
                          <span style={{ background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', borderRadius: '99px', padding: '1px 6px', fontSize: '11px', fontWeight: 700 }}>
                            {s.botPaused ? '👨‍💼 بشري' : '🤖 آلي'}
                          </span>
                          {s.unreadByAdmin > 0 && (
                            <span style={{ background: '#ef4444', color: '#fff', borderRadius: '99px', padding: '1px 7px', fontSize: '11px', fontWeight: 800 }}>
                              {s.unreadByAdmin} جديد
                            </span>
                          )}
                        </div>
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
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="wa-btn"
                            onClick={() => handleToggleBotPaused(activeChat.sessionId, !activeChat.botPaused)}
                            style={{ fontWeight: 800 }}
                          >
                            {activeChat.botPaused ? '🤖 الرد الآلي: متوقف (تحكم بشري)' : '🤖 الرد الآلي: مفعل'}
                          </button>
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
                      </div>

                      {activeChat.escalatedToHuman && (
                        <div
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1.5px solid #dc2626',
                            background: 'var(--bg)',
                            color: 'var(--ink)',
                            fontSize: '13.5px',
                            fontWeight: 700,
                          }}
                        >
                          ⚠️ سبب التحويل للمهندس: {activeChat.escalationReason || 'طلب التحدث مع مهندس مختص'}
                        </div>
                      )}

                      <div style={{ flex: 1, maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--line)' }}>
                        {(activeChat.messages || []).map((m: any) => {
                          const isVisitor = m.sender === 'visitor';
                          const isAuto = m.sender === 'admin' && m.isAutoReply !== false;
                          return (
                            <div
                              key={m.id}
                              style={{
                                alignSelf: isVisitor ? 'flex-start' : 'flex-end',
                                background: isVisitor ? 'var(--card)' : isAuto ? 'var(--card)' : 'var(--acc)',
                                color: isVisitor || isAuto ? 'var(--ink)' : '#fff',
                                border: isAuto ? '1px dashed var(--acc)' : '1px solid var(--line)',
                                borderRadius: '10px',
                                padding: '8px 12px',
                                maxWidth: '84%',
                              }}
                            >
                              <small style={{ display: 'block', opacity: 0.85, fontSize: '11px', marginBottom: '3px', fontWeight: 700 }}>
                                {!isVisitor ? (isAuto ? '🤖 ' : '👨‍💼 ') : ''}
                                {m.senderName}
                              </small>
                              <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{m.text}</div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {[
                          'أهلاً بحضرتك، معك المهندس المختص الآن، تحت أمرك',
                          'سنتواصل معك هاتفياً خلال دقائق لتحديد موعد المعاينة',
                          'تم استلام تفاصيل الوحدة وجارٍ تجهيز المقايسة التقديرية',
                          'تم إرسال التفاصيل عبر واتساب',
                        ].map((quickText) => (
                          <button
                            key={quickText}
                            type="button"
                            className="wa-btn"
                            disabled={sendingReply}
                            onClick={() => void sendAdminReplyText(quickText)}
                            style={{ fontSize: '12px', padding: '5px 9px' }}
                          >
                            ⚡ {quickText}
                          </button>
                        ))}
                      </div>

                      <form onSubmit={handleSendAdminReply} style={{ display: 'flex', gap: '8px' }}>
                        <input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`اكتب ردك الفوري للأستاذ ${activeChat.visitorName} (سيظهر أمامه على الموقع فوراً ويوقف الرد الآلي)...`}
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

              {/* إعدادات وسيناريوهات الرد الآلي التفاعلي */}
              <div className="wa-card wa-form" style={{ marginTop: '14px' }}>
                <div className="wa-wide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>🤖 إعدادات وسيناريوهات الرد الآلي التفاعلي</h3>
                    <p className="wa-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
                      يرد البوت تلقائياً على أسئلة التشطيب والمنتجات والسمارت هوم والحساسات والعقارات والصيانة، ويحوّل المحادثة لك عند الطلب أو عند عدم تطابق السؤال — اضغط «نشر التعديلات على الموقع» لتفعيل أي تعديل.
                    </p>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                    <input
                      type="checkbox"
                      checked={c.chatBotConfig.enabled}
                      onChange={(e) => upd((d) => { d.chatBotConfig.enabled = e.target.checked; })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span>تفعيل الرد الآلي التفاعلي</span>
                  </label>
                </div>

                <F
                  label="اسم المساعد الهندسي في الشات"
                  v={c.chatBotConfig.botName}
                  on={(v) => upd((d) => { d.chatBotConfig.botName = v; })}
                  wide
                />
                <F
                  label="رسالة الترحيب الافتراضية"
                  v={c.chatBotConfig.welcomeText}
                  on={(v) => upd((d) => { d.chatBotConfig.welcomeText = v; })}
                  wide
                  area
                />
                <F
                  label="رسالة التحويل المباشر للمهندس (تظهر عند التحويل أو عندما يتزنق البوت)"
                  v={c.chatBotConfig.escalationText}
                  on={(v) => upd((d) => { d.chatBotConfig.escalationText = v; })}
                  wide
                  area
                />

                <div className="wa-wide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <strong>قواعد وردود مخصصة إضافية ({c.chatBotConfig.customRules.length})</strong>
                  <button
                    type="button"
                    className="wa-btn wa-primary"
                    onClick={() =>
                      upd((d) => {
                        d.chatBotConfig.customRules.push({
                          id: `rule-${Date.now()}`,
                          title: 'سيناريو رد مخصص جديد',
                          keywords: 'كلمة مفتاحية 1, كلمة مفتاحية 2',
                          reply: 'اكتب هنا الرد الهندسي أو التجاري الذي سيظهر للعميل عند كتابة أي من الكلمات المفتاحية.',
                        });
                      })
                    }
                  >
                    + إضافة قاعدة رد آلي مخصصة
                  </button>
                </div>

                {c.chatBotConfig.customRules.map((rule, rIdx) => (
                  <div
                    key={rule.id || rIdx}
                    className="wa-wide wa-form"
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid var(--line)',
                      background: 'var(--bg)',
                    }}
                  >
                    <F
                      label="عنوان السيناريو"
                      v={rule.title}
                      on={(v) => upd((d) => { d.chatBotConfig.customRules[rIdx].title = v; })}
                    />
                    <F
                      label="الكلمات المفتاحية (افصل بينها بفاصلة ،)"
                      v={rule.keywords}
                      on={(v) => upd((d) => { d.chatBotConfig.customRules[rIdx].keywords = v; })}
                    />
                    <F
                      label="نص الرد التفاعلي"
                      v={rule.reply}
                      on={(v) => upd((d) => { d.chatBotConfig.customRules[rIdx].reply = v; })}
                      wide
                      area
                    />
                    <div className="wa-wide" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="wa-btn wa-danger"
                        onClick={() => upd((d) => { d.chatBotConfig.customRules.splice(rIdx, 1); })}
                      >
                        🗑️ حذف القاعدة
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
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
.wa{
  --bg: var(--surface-input, var(--surface-subcard, #f8fafc));
  --card: var(--surface-card, #ffffff);
  --ink: var(--text-primary, #16202e);
  --mut: var(--text-secondary, #5b6677);
  --line: var(--border-subtle, #e2e8f0);
  --acc: var(--accent-main, #c75517);
  --ok: #15803d;
  --bad: #dc2626;
  padding: 20px;
  max-width: 1140px;
  margin: 0 auto;
  color: var(--ink);
  font-family: inherit;
}
html[data-mode="dark"] .wa{
  --bg: var(--surface-input, rgba(15, 23, 42, 0.55));
  --card: var(--surface-card, #111827);
  --ink: var(--text-primary, #f1f5f9);
  --mut: var(--text-secondary, #94a3b8);
  --line: var(--border-subtle, rgba(255, 255, 255, 0.1));
  --acc: var(--accent-main, #f97316);
  --ok: #4cc38a;
  --bad: #f87171;
}
.wa-top{display:flex;gap:16px;justify-content:space-between;flex-wrap:wrap;align-items:flex-start;margin-bottom:14px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 20px;box-shadow:0 4px 20px -10px rgba(15,23,42,0.08)}
.wa h1{font-size:21px;font-weight:900;margin:0 0 4px;color:var(--ink)}.wa-top p{margin:0;color:var(--mut);font-size:13.5px;max-width:620px;line-height:1.6}
.wa-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.wa-btn{border:1px solid var(--line);background:var(--card);color:var(--ink);padding:9px 15px;border-radius:10px;cursor:pointer;font:inherit;text-decoration:none;font-size:13.5px;font-weight:800;transition:border-color .16s,transform .16s,box-shadow .16s}
.wa-btn:hover:not(:disabled){border-color:var(--acc);transform:translateY(-1px)}
.wa-btn:disabled{opacity:.5;cursor:not-allowed}.wa-primary{background:var(--acc);border-color:var(--acc);color:#fff;box-shadow:0 6px 16px -6px rgba(199,85,23,.45)}.wa-danger{color:var(--bad);border-color:rgba(220,38,38,.28);background:rgba(220,38,38,.05);align-self:end}
.wa-alert{padding:11px 15px;border-radius:12px;background:var(--card);border:1px solid var(--line);margin:10px 0;font-size:13.5px;font-weight:700}
.wa-err{border-color:var(--bad);color:var(--bad);background:rgba(220,38,38,.06)}.wa-ok{border-color:var(--ok);color:var(--ok);background:rgba(21,128,61,.06)}
.wa-tabs{display:flex;gap:6px;overflow-x:auto;border-bottom:1px solid var(--line);margin:14px 0 18px;padding-bottom:2px}
.wa-tabs button{background:none;border:0;border-bottom:2.5px solid transparent;padding:10px 14px;color:var(--mut);cursor:pointer;font:inherit;white-space:nowrap;font-size:13.5px;font-weight:700;border-radius:10px 10px 0 0;transition:color .15s,background .15s}
.wa-tabs button:hover{color:var(--ink);background:rgba(249,115,22,.06)}
.wa-tabs button.on{color:var(--acc);border-bottom-color:var(--acc);font-weight:900;background:rgba(249,115,22,.08)}
.wa-panel{display:grid;gap:14px}.wa-muted{color:var(--mut)}
.wa-score{display:flex;gap:18px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
.wa-score h2{margin:0 0 4px;font-size:18px}.wa-score p{margin:0}
.wa-ring{--p:0;width:84px;height:84px;border-radius:50%;background:conic-gradient(var(--acc) calc(var(--p)*1%),var(--line) 0);display:grid;place-items:center;flex:none}
.wa-ring span{background:var(--card);width:66px;height:66px;border-radius:50%;display:grid;place-items:center;font-weight:700}
.wa-recs{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.wa-recs li{display:flex;gap:12px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.wa-recs li.done{opacity:.65}.wa-recs p{margin:4px 0 0;color:var(--mut);font-size:13.5px;line-height:1.7}.wa-recs li>div{flex:1;min-width:0}
.wa-pill{font-size:12px;padding:3px 9px;border-radius:99px;border:1px solid var(--line);white-space:nowrap;margin-top:2px}
.p-عالية{color:var(--bad);border-color:var(--bad)}.p-متوسطة{color:var(--acc);border-color:var(--acc)}.p-ok,.done .wa-pill{color:var(--ok);border-color:var(--ok)}
.wa-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.wa-wide{grid-column:1/-1}
.wa-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:0 4px 18px -10px rgba(15,23,42,0.08)}
.wa-f{display:grid;gap:6px;font-size:13px;font-weight:700;color:var(--mut)}
.wa-f input,.wa-f textarea{background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;font-weight:600;width:100%;box-sizing:border-box;transition:border-color .16s,box-shadow .16s}
.wa-f input:focus,.wa-f textarea:focus{outline:none;border-color:var(--acc);box-shadow:0 0 0 3px rgba(249,115,22,.14)}
.wa h3{margin:10px 0 0;font-size:15px}
.wa-serp{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;display:grid;gap:3px}.wa-serp strong{color:#1a0dab;font-weight:500;font-size:18px}.wa-serp span{color:var(--mut);font-size:13px}
.wa-4d-search-input{flex:1;min-width:220px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit;font-size:13.5px;font-weight:600}
.wa-4d-search-list{display:grid;gap:8px;margin-top:4px}
.wa-4d-search-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 10px;border-radius:10px;background:var(--bg);border:1px solid var(--line)}
.wa-4d-box{padding:12px 14px;border-radius:12px;border:1.5px dashed rgba(199,85,23,.4);background:rgba(249,115,22,.04);display:grid;gap:10px}
.wa-4d-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}
.wa-4d-head strong{display:block;font-size:13.5px;color:var(--ink)}
.wa-4d-head small{display:block;font-size:12px;color:var(--mut);margin-top:2px}
.wa-4d-head-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.wa-4d-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}
.wa-4d-thumb-card{position:relative;border-radius:10px;overflow:hidden;border:1px solid var(--line);background:#fff;display:flex;flex-direction:column}
.wa-4d-thumb-card img{width:100%;aspect-ratio:4/3;object-fit:contain;padding:4px;display:block}
.wa-4d-num{position:absolute;top:4px;inset-inline-start:4px;padding:1px 6px;border-radius:99px;background:rgba(15,23,42,.8);color:#fff;font-size:11px;font-weight:800}
.wa-4d-thumb-bar{display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid #e2e8f0;background:#f8fafc}
.wa-4d-thumb-bar button{border:0;background:transparent;color:#1e293b;padding:4px 0;font-size:12px;font-weight:800;cursor:pointer}
.wa-4d-thumb-bar button:hover:not(:disabled){background:#e2e8f0}
.wa-4d-thumb-bar button:disabled{opacity:.35;cursor:not-allowed}
.wa-4d-thumb-bar button.is-del{color:#dc2626}
.pw-pd-code{position:absolute;bottom:10px;inset-inline-start:10px;padding:3px 8px;border-radius:6px;background:rgba(15,22,30,.78);color:#f8fafc;font-family:ui-monospace,Consolas,monospace;font-size:11px;font-weight:800}
.pw-4d-wrap{display:flex;flex-direction:column;gap:8px}
.pw-4d-stage{position:relative;aspect-ratio:4/3;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;background:#fff;user-select:none;-webkit-user-select:none;touch-action:pan-y}
.pw-4d-stage.is-4d{cursor:grab}.pw-4d-stage.is-4d.is-dragging{cursor:grabbing}.pw-4d-stage.is-zoomed{cursor:move;touch-action:none}
.pw-4d-img{width:100%;height:100%;object-fit:contain;padding:8px;display:block;pointer-events:none}
.pw-4d-top-badges{position:absolute;top:8px;inset-inline:8px;z-index:2;display:flex;justify-content:space-between;gap:6px;pointer-events:none}
.pw-4d-pill{padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.94);color:#14181b;font-size:11px;font-weight:800}
.pw-4d-pill.is-4d-tag{background:#059669;color:#fff}
.pw-4d-angle{padding:2px 8px;border-radius:99px;background:rgba(15,23,42,.8);color:#fff;font-size:11px;font-weight:800}
.pw-4d-hint{position:absolute;bottom:8px;inset-inline-end:8px;padding:3px 8px;border-radius:99px;background:rgba(15,23,42,.82);color:#fff;font-size:11px;font-weight:700}
.pw-4d-loading{position:absolute;top:36px;left:50%;transform:translateX(-50%);padding:2px 8px;border-radius:99px;background:#fff;color:#14181b;font-size:11px;font-weight:800;white-space:nowrap}
.pw-4d-controls{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.pw-4d-btn{min-height:32px;padding:4px 10px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-size:12px;font-weight:800;cursor:pointer}
.pw-4d-btn.is-active{background:var(--acc);border-color:var(--acc);color:#fff}
.pw-4d-slider{flex:1;min-width:80px;accent-color:var(--acc)}
@media(max-width:760px){.wa{padding:14px}}
`;
