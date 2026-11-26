"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface VisitorPageEvent {
  path: string;
  title?: string;
  enteredAt: string;
  durationSec?: number;
}

interface VisitorActionEvent {
  action: string;
  label: string;
  at: string;
  path?: string;
}

interface VisitorSessionRow {
  id: string;
  sessionId: string;
  ip: string;
  country?: string;
  city?: string;
  deviceType: string;
  os: string;
  browser: string;
  deviceModel?: string;
  screen?: string;
  referrer?: string;
  utmSource?: string;
  utmCampaign?: string;
  visitorName?: string;
  visitorPhone?: string;
  currentPath: string;
  pages: VisitorPageEvent[];
  pageViewsCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  leftAt?: string;
  status: 'online' | 'left';
  isOnline: boolean;
  effectiveStatus: 'online' | 'left';
  effectiveLeftAt?: string;
  totalDurationSec: number;
  actions?: VisitorActionEvent[];
}

interface VisitorStats {
  onlineNow: number;
  leftCount: number;
  todayTotal: number;
  totalSessions: number;
  totalPageViews: number;
}

interface TopPageStat {
  path: string;
  label: string;
  views: number;
}

const COUNTRY_AR: Record<string, string> = {
  EG: 'مصر 🇪🇬',
  SA: 'السعودية 🇸🇦',
  AE: 'الإمارات 🇦🇪',
  KW: 'الكويت 🇰🇼',
  QA: 'قطر 🇶🇦',
  OM: 'عُمان 🇴🇲',
  BH: 'البحرين 🇧🇭',
  JO: 'الأردن 🇯🇴',
  IQ: 'العراق 🇮🇶',
  LB: 'لبنان 🇱🇧',
  PS: 'فلسطين 🇵🇸',
  LY: 'ليبيا 🇱🇾',
  SD: 'السودان 🇸🇩',
  MA: 'المغرب 🇲🇦',
  DZ: 'الجزائر 🇩🇿',
  TN: 'تونس 🇹🇳',
  TR: 'تركيا 🇹🇷',
  US: 'أمريكا 🇺🇸',
  GB: 'بريطانيا 🇬🇧',
  DE: 'ألمانيا 🇩🇪',
  FR: 'فرنسا 🇫🇷',
};

function getPageFriendlyName(path: string): string {
  const [rawBase, rawQuery] = (path || '/').split('?');
  const base = rawBase.replace(/\/+$/, '') || '/';
  let label = base;
  if (base === '/') label = 'الرئيسية';
  else if (base === '/store') label = 'المتجر';
  else if (base === '/sections/contracting') label = 'التركيبات والصيانة والتنفيذ';
  else if (base === '/sections/materials') label = 'المبيعات ومواد البناء';
  else if (base === '/sections/smart-home') label = 'السمارت هوم';
  else if (base === '/sections/maintenance') label = 'التنفيذ والصيانة';
  else if (base === '/sections/info') label = 'معلومات وأدوات هندسية';
  else if (base === '/sections/real-estate' || base === '/real-estate') label = 'العقارات';
  else if (base === '/verify' || base === '/website/verify') label = 'التحقق من المستندات';
  else if (base === '/login') label = 'تسجيل الدخول';
  else if (base === '/website') label = 'الموقع التعريفي';

  if (rawQuery) {
    try {
      const sp = new URLSearchParams(rawQuery);
      const q = sp.get('q');
      const cat = sp.get('category') || sp.get('cat');
      const tab = sp.get('tab');
      if (q) return `${label} (بحث: ${q})`;
      if (cat) return `${label} (قسم: ${cat})`;
      if (tab) return `${label} (${tab})`;
    } catch {
      // ignore malformed query
    }
  }
  return label;
}

function formatDuration(sec?: number): string {
  if (typeof sec !== 'number' || !Number.isFinite(sec) || sec <= 0) return 'أقل من ثانية';
  if (sec < 60) return `${sec} ث`;
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  if (mins < 60) return rem > 0 ? `${mins} د ${rem} ث` : `${mins} د`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs} س ${remMins} د` : `${hrs} س`;
}

function formatTimeAr(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDateTimeAr(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      timeZone: 'Africa/Cairo',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatRelativeAgo(iso?: string): string {
  if (!iso) return '—';
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 15) return 'الآن';
  if (diffSec < 60) return `منذ ${diffSec} ثانية`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} يوم`;
}

function formatReferrerHost(ref?: string): string {
  if (!ref) return 'دخول مباشر';
  try {
    const u = new URL(ref);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return ref.slice(0, 40);
  }
}

export default function WebsiteVisitorsTab({
  onOnlineCountChange,
}: {
  onOnlineCountChange?: (count: number) => void;
} = {}) {
  const [visitors, setVisitors] = useState<VisitorSessionRow[]>([]);
  const [stats, setStats] = useState<VisitorStats>({
    onlineNow: 0,
    leftCount: 0,
    todayTotal: 0,
    totalSessions: 0,
    totalPageViews: 0,
  });
  const [topPages, setTopPages] = useState<TopPageStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'left'>('all');
  const [searchQ, setSearchQ] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');
  const [busyAction, setBusyAction] = useState(false);

  const loadVisitors = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setErr('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setErr('يرجى تسجيل الدخول بحساب المدير لعرض الزوار.');
        return;
      }
      const res = await fetch('/api/website-visitors', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setErr(json?.error || 'تعذر تحميل بيانات الزوار');
        return;
      }
      setVisitors(Array.isArray(json?.visitors) ? json.visitors : []);
      if (json?.stats) {
        setStats(json.stats);
        onOnlineCountChange?.(Number(json.stats.onlineNow || 0));
      }
      setTopPages(Array.isArray(json?.topPages) ? json.topPages : []);
      setLastUpdatedAt(new Date().toISOString());
    } catch (e: any) {
      setErr(e?.message || 'حدث خطأ أثناء الاتصال بالسيرفر');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onOnlineCountChange]);

  useEffect(() => {
    void loadVisitors(false);
  }, [loadVisitors]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadVisitors(true);
      }
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadVisitors]);

  const handleCleanup = async (scope: 'old' | 'all' | 'id', id?: string) => {
    const confirmMsg =
      scope === 'all'
        ? 'هل تريد مسح جميع سجلات الزوار؟'
        : scope === 'old'
          ? 'مسح سجلات الزوار الأقدم من 7 أيام؟'
          : 'حذف سجل هذا الزائر؟';
    if (!window.confirm(confirmMsg)) return;

    setBusyAction(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const qs = scope === 'id' && id ? `id=${encodeURIComponent(id)}` : `scope=${scope}`;
      const res = await fetch(`/api/website-visitors?${qs}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        await loadVisitors(true);
      }
    } finally {
      setBusyAction(false);
    }
  };

  const filteredVisitors = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return visitors.filter((v) => {
      if (statusFilter === 'online' && !v.isOnline) return false;
      if (statusFilter === 'left' && v.isOnline) return false;
      if (!q) return true;
      const haystack = [
        v.visitorName,
        v.visitorPhone,
        v.ip,
        v.city,
        v.country,
        v.country ? COUNTRY_AR[v.country] : '',
        v.deviceType,
        v.os,
        v.browser,
        v.deviceModel,
        v.currentPath,
        getPageFriendlyName(v.currentPath),
        v.referrer,
        v.utmSource,
        ...v.pages.map((p) => `${p.path} ${getPageFriendlyName(p.path)} ${p.title || ''}`),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [visitors, statusFilter, searchQ]);

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <style>{`
        @keyframes phiVisitorPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.65); }
          50% { box-shadow: 0 0 0 7px rgba(16, 185, 129, 0); }
        }
        .wv-dot-live {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #10b981;
          display: inline-block;
          flex-shrink: 0;
          animation: phiVisitorPulse 1.8s infinite;
        }
        .wv-dot-left {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #94a3b8;
          display: inline-block;
          flex-shrink: 0;
        }
      `}</style>

      {/* شريط الإحصائيات السريعة */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
          gap: '10px',
        }}
      >
        <div
          className="wa-card"
          style={{
            borderColor: stats.onlineNow > 0 ? 'rgba(16, 185, 129, 0.45)' : undefined,
            background: stats.onlineNow > 0 ? 'rgba(16, 185, 129, 0.06)' : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 800, color: '#059669' }}>
            <span className="wv-dot-live" />
            <span>موجودون الآن على الموقع</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '6px', color: '#059669' }}>
            {stats.onlineNow}
          </div>
        </div>

        <div className="wa-card">
          <div className="wa-muted" style={{ fontSize: '12.5px', fontWeight: 700 }}>
            👥 زوار اليوم (بتوقيت القاهرة)
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '6px' }}>
            {stats.todayTotal}
          </div>
        </div>

        <div className="wa-card">
          <div className="wa-muted" style={{ fontSize: '12.5px', fontWeight: 700 }}>
            📄 إجمالي الصفحات المفتوحة
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '6px' }}>
            {stats.totalPageViews}
          </div>
        </div>

        <div className="wa-card">
          <div className="wa-muted" style={{ fontSize: '12.5px', fontWeight: 700 }}>
            🚪 جلسات خرجت (من آخر {stats.totalSessions})
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '6px' }}>
            {stats.leftCount}
          </div>
        </div>
      </div>

      {/* أكثر الصفحات زيارة */}
      {topPages.length > 0 && (
        <div className="wa-card" style={{ display: 'grid', gap: '10px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: 800 }}>🔥 أكثر الصفحات التي فتحها الزوار</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {topPages.map((tp) => (
              <button
                key={tp.path}
                type="button"
                className="wa-btn"
                style={{
                  padding: '6px 12px',
                  fontSize: '12.5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => setSearchQ(tp.path)}
                title={`تصفية الزوار الذين فتحوا ${tp.path}`}
              >
                <span>{tp.label}</span>
                <span
                  style={{
                    background: 'rgba(199, 85, 23, 0.14)',
                    color: 'var(--acc)',
                    padding: '1px 7px',
                    borderRadius: '99px',
                    fontSize: '11.5px',
                    fontWeight: 900,
                  }}
                >
                  {tp.views}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* أدوات الفلترة والتحديث */}
      <div
        className="wa-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <button
            type="button"
            className={`wa-btn ${statusFilter === 'all' ? 'wa-primary' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            الكل ({visitors.length})
          </button>
          <button
            type="button"
            className={`wa-btn ${statusFilter === 'online' ? 'wa-primary' : ''}`}
            onClick={() => setStatusFilter('online')}
          >
            🟢 موجود الآن ({stats.onlineNow})
          </button>
          <button
            type="button"
            className={`wa-btn ${statusFilter === 'left' ? 'wa-primary' : ''}`}
            onClick={() => setStatusFilter('left')}
          >
            ⚫ خرجوا ({stats.leftCount})
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', flex: '1 1 260px', justifyContent: 'flex-end' }}>
          <input
            type="search"
            className="wa-4d-search-input"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="ابحث بالصفحة، المدينة، الجهاز، الاسم أو الهاتف..."
            style={{ maxWidth: '300px' }}
          />
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>تحديث حي (10ث)</span>
          </label>
          <button
            type="button"
            className="wa-btn"
            disabled={refreshing || loading}
            onClick={() => void loadVisitors(true)}
          >
            {refreshing ? 'جاري التحديث…' : '🔄 تحديث'}
          </button>
          {visitors.length > 0 && (
            <button
              type="button"
              className="wa-btn wa-danger"
              disabled={busyAction}
              onClick={() => void handleCleanup('old')}
              title="حذف سجلات الزوار الأقدم من 7 أيام"
            >
              🧹 مسح القديم (+7 أيام)
            </button>
          )}
        </div>
      </div>

      {lastUpdatedAt && (
        <div className="wa-muted" style={{ fontSize: '12px', textAlign: 'left' }}>
          آخر تحديث: {formatTimeAr(lastUpdatedAt)} — يُعتبر الزائر «موجود الآن» ما دام يتصفح الموقع أو تواصل خلال آخر 75 ثانية.
        </div>
      )}

      {err && <div className="wa-alert wa-err">{err}</div>}

      {/* قائمة الزوار */}
      {loading ? (
        <div className="wa-card">
          <p className="wa-muted" style={{ margin: 0 }}>جاري تحميل سجل الزوار المباشرين…</p>
        </div>
      ) : filteredVisitors.length === 0 ? (
        <div className="wa-card" style={{ textAlign: 'center', padding: '28px 16px' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: '15px' }}>
            {statusFilter === 'online'
              ? 'لا يوجد زوار متصلون الآن في هذه اللحظة'
              : 'لا توجد زيارات مطابقة للبحث حالياً'}
          </p>
          <p className="wa-muted" style={{ margin: 0, fontSize: '13px' }}>
            بمجرد دخول أي زائر للموقع أو المتجر سيظهر هنا فوراً مع كل الصفحات التي يفتحها وحالة وجوده أو خروجه.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {filteredVisitors.map((v) => {
            const countryLabel = v.country ? COUNTRY_AR[v.country] || v.country : '';
            const locationText = [v.city, countryLabel].filter(Boolean).join(' · ') || 'موقع غير محدد';
            const displayTitle =
              v.visitorName ||
              (v.visitorPhone ? `عميل (${v.visitorPhone})` : `زائر #${v.sessionId.slice(-5).toUpperCase()}`);
            const deviceIcon = v.deviceType === 'موبايل' ? '📱' : v.deviceType === 'تابلت' ? '📲' : '💻';
            const cleanWa = (v.visitorPhone || '').replace(/[^\d]/g, '');

            return (
              <article
                key={v.id}
                className="wa-card"
                style={{
                  display: 'grid',
                  gap: '12px',
                  borderRight: v.isOnline ? '4px solid #10b981' : '4px solid #94a3b8',
                }}
              >
                {/* رأس بطاقة الزائر */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                      {v.isOnline ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 10px',
                            borderRadius: '99px',
                            background: 'rgba(16, 185, 129, 0.14)',
                            color: '#047857',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            fontSize: '12px',
                            fontWeight: 900,
                          }}
                        >
                          <span className="wv-dot-live" />
                          <span>موجود الآن</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 10px',
                            borderRadius: '99px',
                            background: 'rgba(148, 163, 184, 0.16)',
                            color: 'var(--mut)',
                            border: '1px solid var(--line)',
                            fontSize: '12px',
                            fontWeight: 800,
                          }}
                        >
                          <span className="wv-dot-left" />
                          <span>خرج ({formatRelativeAgo(v.effectiveLeftAt || v.lastSeenAt)})</span>
                        </span>
                      )}

                      <strong style={{ fontSize: '15px' }}>{displayTitle}</strong>

                      {cleanWa && (
                        <a
                          href={`https://wa.me/${cleanWa}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wa-pill p-ok"
                          style={{ textDecoration: 'none', fontWeight: 800 }}
                        >
                          💬 واتساب: {v.visitorPhone}
                        </a>
                      )}
                    </div>

                    <div
                      className="wa-muted"
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '10px',
                        fontSize: '12.5px',
                        fontWeight: 600,
                      }}
                    >
                      <span>📍 {locationText}</span>
                      <span>
                        {deviceIcon} {v.deviceModel || `${v.deviceType} · ${v.os} / ${v.browser}`}
                        {v.screen ? ` (${v.screen})` : ''}
                      </span>
                      <span>🌐 المصدر: {v.utmSource ? `حملة: ${v.utmSource}` : formatReferrerHost(v.referrer)}</span>
                      {v.ip && v.ip !== 'unknown' && <span dir="ltr">IP: {v.ip}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <span className="wa-pill">
                      🕒 دخل: {formatDateTimeAr(v.firstSeenAt)}
                    </span>
                    <span className="wa-pill">
                      ⏱️ المدة: {formatDuration(v.totalDurationSec)}
                    </span>
                    <span className="wa-pill">
                      📄 {v.pageViewsCount} {v.pageViewsCount === 1 ? 'صفحة' : 'صفحات'}
                    </span>
                    <button
                      type="button"
                      className="wa-btn"
                      style={{ padding: '4px 9px', fontSize: '12px' }}
                      disabled={busyAction}
                      onClick={() => void handleCleanup('id', v.id)}
                      title="حذف هذا السجل"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* الصفحة الحالية (للزائر المتصل الآن) أو آخر صفحة قبل الخروج */}
                <div
                  style={{
                    padding: '9px 12px',
                    borderRadius: '10px',
                    background: v.isOnline ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg)',
                    border: '1px solid var(--line)',
                    fontSize: '13px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div>
                    <strong style={{ color: v.isOnline ? '#059669' : 'var(--ink)' }}>
                      {v.isOnline ? '👁️ يتصفح الآن:' : '🚪 آخر صفحة قبل الخروج:'}
                    </strong>{' '}
                    <span style={{ fontWeight: 800 }}>{getPageFriendlyName(v.currentPath)}</span>{' '}
                    <code
                      dir="ltr"
                      style={{
                        fontSize: '11.5px',
                        opacity: 0.75,
                        background: 'rgba(148,163,184,0.15)',
                        padding: '1px 6px',
                        borderRadius: '6px',
                      }}
                    >
                      {v.currentPath}
                    </code>
                  </div>
                  <span className="wa-muted" style={{ fontSize: '12px' }}>
                    آخر نشاط: {formatTimeAr(v.lastSeenAt)}
                  </span>
                </div>

                {/* مسار الصفحات التي فتحها الزائر بالترتيب */}
                {v.pages.length > 0 && (
                  <div style={{ display: 'grid', gap: '6px' }}>
                    <div className="wa-muted" style={{ fontSize: '12px', fontWeight: 800 }}>
                      🧭 الصفحات التي فتحها ({v.pages.length}):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      {v.pages.map((pg, idx) => {
                        const isCurrentLive = v.isOnline && idx === v.pages.length - 1;
                        return (
                          <React.Fragment key={`${pg.enteredAt}-${idx}`}>
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '5px 10px',
                                borderRadius: '10px',
                                fontSize: '12.5px',
                                fontWeight: 700,
                                background: isCurrentLive
                                  ? 'rgba(16, 185, 129, 0.14)'
                                  : 'var(--bg)',
                                border: isCurrentLive
                                  ? '1px solid rgba(16, 185, 129, 0.45)'
                                  : '1px solid var(--line)',
                              }}
                              title={`${pg.path}${pg.title ? ` — ${pg.title}` : ''}`}
                            >
                              <span
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  background: isCurrentLive ? '#10b981' : 'rgba(199,85,23,0.16)',
                                  color: isCurrentLive ? '#fff' : 'var(--acc)',
                                  display: 'inline-grid',
                                  placeItems: 'center',
                                  fontSize: '11px',
                                  fontWeight: 900,
                                }}
                              >
                                {idx + 1}
                              </span>
                              <span>{getPageFriendlyName(pg.path)}</span>
                              <span className="wa-muted" style={{ fontSize: '11px' }}>
                                {formatTimeAr(pg.enteredAt)}
                                {typeof pg.durationSec === 'number' ? ` · ${formatDuration(pg.durationSec)}` : ''}
                              </span>
                            </div>
                            {idx < v.pages.length - 1 && (
                              <span className="wa-muted" style={{ fontWeight: 900 }}>←</span>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* إجراءات الزائر (واتساب / اتصال / رقم جوال) إن وجدت */}
                {Array.isArray(v.actions) && v.actions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    <span className="wa-muted" style={{ fontSize: '12px', fontWeight: 800 }}>
                      ⚡ تفاعلات الزائر:
                    </span>
                    {v.actions.map((act, i) => (
                      <span
                        key={`${act.at}-${i}`}
                        className="wa-pill p-متوسطة"
                        style={{ fontWeight: 800 }}
                      >
                        {act.label} ({formatTimeAr(act.at)})
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
