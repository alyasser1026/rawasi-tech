"use client";

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CSS } from './client-styles';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import { MILESTONE_CONTRACTUAL_DISCLAIMER } from '@/lib/milestoneSchedule';

/* ===== أنواع البيانات القادمة من الدالة public.client_portal_data ===== */
type Item = { name: string; category: string; unit: string | null; qty: number | null; done_qty: number; pct: number; start_date: string | null; end_date: string | null };
type Milestone = { no: number; title: string; due_date: string | null; expected: number; received: number; receipt_date: string | null };
type Receipt = { number: string | null; date: string | null; amount: number; method: string | null };
type Invoice = { number: string | null; date: string | null; due_date: string | null; total: number; paid: number };
type Photo = { id: string; caption: string | null; date: string | null };
type Project = {
  id: string; name: string; status: string | null; stage: string | null; location: string | null; engineer: string | null;
  unit_type: string | null; area: number | null; start_date: string | null; end_date: string | null; handover_date: string | null;
  warranty_months: number | null; currency: string; contract_value: number; progress: number;
  items: Item[]; milestones: Milestone[]; receipts: Receipt[]; invoices: Invoice[]; gallery: Photo[];
};
type Payload = { client: { id: string; name: string } | null; projects: Project[] };

const CUR: Record<string, string> = { SAR: 'ر.س', EGP: 'ج.م', USD: '$', AED: 'د.إ' };
const money = (n: number, cur: string) =>
  `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n || 0))} ${CUR[cur] || cur}`;
const dateAr = (d: string | null) =>
  d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const num = (n: number | null | undefined, d = 1) =>
  n == null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(n);

type Tab = 'overview' | 'works' | 'finance' | 'visits';
type Filter = 'all' | 'done' | 'prog' | 'todo';
const statusOf = (pct: number): Exclude<Filter, 'all'> => (pct >= 100 ? 'done' : pct > 0 ? 'prog' : 'todo');
const STATUS_LABEL = { done: 'منتهي', prog: 'قيد التنفيذ', todo: 'لم يبدأ' } as const;

/** صورة معرض تُجلب بجلسة العميل من API محمية (لا روابط عامة). */
function GalleryImg({ id, alt, onClick }: { id: string; alt: string; onClick?: (src: string) => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true; let obj: string | null = null;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const r = await fetch(`/api/client-gallery/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error('x');
        const blob = await r.blob();
        if (!alive) return;
        obj = URL.createObjectURL(blob); setSrc(obj);
      } catch { if (alive) setFailed(true); }
    })();
    return () => { alive = false; if (obj) URL.revokeObjectURL(obj); };
  }, [id]);
  if (failed) return <div className="cl-photo-ph">تعذّر تحميل الصورة</div>;
  if (!src) return <div className="cl-photo-ph" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onClick={() => onClick?.(src)} style={{ cursor: onClick ? 'zoom-in' : undefined }} />;
}

function Ring({ value }: { value: number }) {
  const r = 70, c = 2 * Math.PI * r, off = c * (1 - Math.min(Math.max(value, 0), 100) / 100);
  return (
    <div className="cl-ring" role="img" aria-label={`نسبة الإنجاز ${num(value)}%`}>
      <svg width="170" height="170" viewBox="0 0 170 170" style={{ width: '100%', height: '100%' }}>
        <circle cx="85" cy="85" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="13" />
        <circle cx="85" cy="85" r={r} fill="none" stroke="#f97316" strokeWidth="13" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .6s' }} />
      </svg>
      <div className="cl-ring-n"><strong>{num(value)}%</strong><span>نسبة الإنجاز</span></div>
    </div>
  );
}

function Portal() {
  const router = useRouter();
  const params = useSearchParams();
  const previewPartner = params?.get('partner') || null; // معاينة من الإدارة فقط (تُرفض من الخادم لغير الأدمن)

  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<Tab>('overview');
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { router.replace('/login'); return; }
      const { data: res, error: err } = await supabase.rpc('client_portal_data', previewPartner ? { p_partner_id: previewPartner } : {});
      if (!alive) return;
      if (err) {
        setError(/does not exist|schema cache|PGRST202/i.test(err.message || '')
          ? 'بوابة العميل قيد التفعيل من الإدارة. يرجى المحاولة لاحقًا.'
          : 'تعذّر تحميل بيانات مشاريعك الآن. حاول مرة أخرى بعد قليل.');
        return;
      }
      setData(res as Payload);
    })();
    return () => { alive = false; };
  }, [router, previewPartner]);

  const logout = async () => { await supabase.auth.signOut(); router.replace('/login'); };
  const project = data?.projects?.[sel];

  const derived = useMemo(() => {
    if (!project) return null;
    const cur = project.currency;
    const counts = { done: 0, prog: 0, todo: 0 };
    project.items.forEach(i => { counts[statusOf(i.pct)]++; });
    const cats = new Map<string, Item[]>();
    project.items.forEach(i => { const a = cats.get(i.category) || []; a.push(i); cats.set(i.category, a); });
    const catList = Array.from(cats.entries()).map(([name, items]) => ({
      name, items, avg: items.reduce((s, i) => s + i.pct, 0) / items.length,
      done: items.filter(i => i.pct >= 100).length,
    }));
    const msReceived = project.milestones.reduce((s, m) => s + m.received, 0);
    const msExpected = project.milestones.reduce((s, m) => s + m.expected, 0);
    const rcReceived = project.receipts.reduce((s, r) => s + r.amount, 0);
    const received = rcReceived > 0 ? rcReceived : msReceived; // نختار مصدرًا واحدًا لتفادي العدّ المزدوج
    const contract = project.contract_value > 0 ? project.contract_value : msExpected;
    const remaining = Math.max(contract - received, 0);
    const paidPct = contract > 0 ? Math.min((received / contract) * 100, 100) : 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const ms = project.milestones.map(m => {
      const due = m.due_date ? new Date(m.due_date + 'T00:00:00') : null;
      const status: 'paid' | 'late' | 'due' | 'upcoming' =
        m.expected > 0 && m.received >= m.expected ? 'paid' : due && due < today ? 'late' : 'due';
      return { ...m, status };
    });
    const next = ms.find(m => m.status !== 'paid');
    return { cur, counts, catList, received, contract, remaining, paidPct, ms, next };
  }, [project]);

  if (error) return <div className="cl-state">{error}</div>;
  if (!data) return <div className="cl-state">جاري تحميل بيانات مشاريعك…</div>;

  const header = (
    <header className="cl-bar">
      <div className="cl-wrap cl-bar-row">
        <div className="cl-brand">
          <img src="/brand/phitech-mark-color.svg" alt="فاي تك" />
          <div>فاي تك<small>بوابة العملاء</small></div>
        </div>
        <span className="cl-spacer" />
        {data.client?.name && <span className="cl-user">{data.client.name}</span>}
        <button type="button" className="cl-btn" onClick={() => window.print()}>طباعة التقرير</button>
        <button type="button" className="cl-btn" onClick={logout}>تسجيل الخروج</button>
      </div>
    </header>
  );

  if (!project || !derived) {
    return (
      <>
        {header}
        <main className="cl-wrap cl-main">
          <div className="cl-card cl-empty">
            <h2>لا توجد مشاريع مرتبطة بحسابك حاليًا</h2>
            <p>إذا كنت متأكدًا من وجود مشروع باسمك، تواصل مع فريق فاي تك لربط الحساب بمشروعك.</p>
          </div>
        </main>
      </>
    );
  }

  const { cur, counts, catList, received, contract, remaining, paidPct, ms, next } = derived;
  const nq = q.trim().toLowerCase();
  const filteredCats = catList
    .map(c => ({ ...c, items: c.items.filter(i => (filter === 'all' || statusOf(i.pct) === filter) && (!nq || i.name?.toLowerCase().includes(nq) || c.name.toLowerCase().includes(nq))) }))
    .filter(c => c.items.length > 0);
  const show = (t: Tab) => ({ display: tab === t ? 'block' : 'none' } as React.CSSProperties);

  return (
    <>
      {header}
      <main className="cl-wrap cl-main">
        <div className="cl-print-head">
          <ReportOfficialHeader
            title="تقرير متابعة المشروع (Project Progress Report)"
            subtitle={project.stage ? `المرحلة الحالية: ${project.stage}` : undefined}
            badgeText="تقرير للعميل • CLIENT REPORT"
            refLabel="رقم التقرير"
            issuer={false}
            compact
            projectName={project.name}
            unitType={project.unit_type || undefined}
            clientName={data.client?.name}
            engineerName={project.engineer || undefined}
            locationAddress={project.location || undefined}
            currency={project.currency}
          />
        </div>
        {data.projects.length > 1 && (
          <div className="cl-pills" role="tablist" aria-label="مشاريعك">
            {data.projects.map((p, i) => (
              <button key={p.id} type="button" role="tab" aria-selected={i === sel} className={`cl-pill ${i === sel ? 'is-on' : ''}`}
                onClick={() => { setSel(i); setFilter('all'); setQ(''); }}>{p.name}</button>
            ))}
          </div>
        )}

        <section className="cl-hero" aria-label="ملخص المشروع">
          <div>
            {project.status && <span className="cl-badge">{project.status}</span>}
            <h1>{project.name}</h1>
            {project.stage && <p className="cl-hero-stage">المرحلة الحالية: {project.stage}</p>}
            <div className="cl-meta">
              {project.location && <div><span>الموقع</span><b>{project.location}</b></div>}
              {project.engineer && <div><span>المهندس المسؤول</span><b>{project.engineer}</b></div>}
              {project.area ? <div><span>المساحة</span><b>{num(project.area, 2)} م²</b></div> : null}
              <div><span>البداية</span><b>{dateAr(project.start_date)}</b></div>
              <div><span>التسليم المتوقع</span><b>{dateAr(project.end_date)}</b></div>
            </div>
          </div>
          <Ring value={project.progress} />
        </section>

        <section className="cl-kpis" aria-label="المؤشرات المالية">
          <div className="cl-kpi"><span>قيمة العقد</span><strong>{money(contract, cur)}</strong></div>
          <div className="cl-kpi is-ok"><span>المسدد حتى الآن</span><strong>{money(received, cur)}</strong><small>{num(paidPct)}% من قيمة العقد</small></div>
          <div className="cl-kpi"><span>المتبقي</span><strong>{money(remaining, cur)}</strong></div>
          <div className="cl-kpi is-accent"><span>الإنجاز الفعلي</span><strong>{num(project.progress)}%</strong><small>{counts.done} منتهي • {counts.prog} قيد التنفيذ • {counts.todo} متبقي</small></div>
        </section>

        <div className="cl-tabs" role="tablist" aria-label="أقسام المشروع">
          {([['overview', 'نظرة عامة'], ['works', 'الأعمال'], ['finance', 'المالية'], ['visits', 'صور الزيارات']] as [Tab, string][]).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={`cl-tab ${tab === k ? 'is-on' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {/* نظرة عامة */}
        <div className="cl-panel" style={show('overview')} role="tabpanel">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="cl-card">
              <h2>حالة بنود العمل</h2>
              <p className="cl-sub">إجمالي {project.items.length} بند في مقايسة المشروع</p>
              <div className="cl-stat3">
                <div className="cl-stat done"><strong>{counts.done}</strong><span>بنود منتهية</span></div>
                <div className="cl-stat prog"><strong>{counts.prog}</strong><span>قيد التنفيذ</span></div>
                <div className="cl-stat todo"><strong>{counts.todo}</strong><span>لم تبدأ بعد</span></div>
              </div>
            </div>
            <div className="cl-grid2">
              <div className="cl-card">
                <h2>التقدم حسب نوع العمل</h2>
                <p className="cl-sub">متوسط إنجاز كل مجموعة أعمال</p>
                {catList.length === 0 && <p className="cl-note">لم تُسجَّل بنود أعمال لهذا المشروع بعد.</p>}
                {catList.map(c => (
                  <div className="cl-cat" key={c.name}>
                    <div className="cl-cat-row"><span>{c.name}</span><em>{num(c.avg)}% • {c.done}/{c.items.length} منتهي</em></div>
                    <div className="cl-bar-line"><i style={{ width: c.avg + '%' }} /></div>
                  </div>
                ))}
              </div>
              <div className="cl-card">
                <h2>الدفعات</h2>
                <p className="cl-sub">السداد مقابل الإنجاز</p>
                <div className="cl-money">
                  <div><div className="cl-money-row"><span>الإنجاز الفعلي</span><em>{num(project.progress)}%</em></div><div className="cl-bar-line"><i style={{ width: project.progress + '%' }} /></div></div>
                  <div><div className="cl-money-row"><span>المسدد من العقد</span><em>{num(paidPct)}%</em></div><div className="cl-bar-line ok"><i style={{ width: paidPct + '%' }} /></div></div>
                </div>
                {next && (
                  <div className="cl-next" style={{ marginTop: 18 }}>
                    <div><b>{next.status === 'late' ? 'دفعة متأخرة' : 'الدفعة القادمة'}</b><small>{next.title}{next.due_date ? ` — ${dateAr(next.due_date)}` : ''}</small></div>
                    <strong>{money(Math.max(next.expected - next.received, 0), cur)}</strong>
                  </div>
                )}
                {!next && ms.length > 0 && <p className="cl-note">تم سداد جميع الدفعات المجدولة.</p>}
              </div>
            </div>
          </div>
        </div>

        {/* الأعمال */}
        <div className="cl-panel" style={show('works')} role="tabpanel">
          <div className="cl-card">
            <h2>بنود الأعمال</h2>
            <p className="cl-sub">ما تم تنفيذه وما تبقى في كل بند</p>
            <div className="cl-toolbar">
              <input className="cl-search" type="search" placeholder="ابحث عن بند…" value={q} onChange={e => setQ(e.target.value)} aria-label="بحث في البنود" />
              {([['all', `الكل (${project.items.length})`], ['done', `منتهي (${counts.done})`], ['prog', `قيد التنفيذ (${counts.prog})`], ['todo', `متبقي (${counts.todo})`]] as [Filter, string][]).map(([k, l]) => (
                <button key={k} type="button" className={`cl-chip ${filter === k ? 'is-on' : ''}`} onClick={() => setFilter(k)}>{l}</button>
              ))}
            </div>
            {filteredCats.length === 0 && <p className="cl-empty">لا توجد بنود مطابقة.</p>}
            {filteredCats.map(c => (
              <div className="cl-group" key={c.name}>
                <div className="cl-group-h"><h3>{c.name}</h3><em>{num(c.avg)}%</em></div>
                {c.items.map((i, k) => {
                  const st = statusOf(i.pct);
                  return (
                    <div className="cl-item" key={k}>
                      <div><b>{i.name}</b>{i.qty ? <small>{num(i.done_qty, 2)} من {num(i.qty, 2)} {i.unit || ''}</small> : null}</div>
                      <div className="bar"><div className="cl-bar-line"><i style={{ width: i.pct + '%' }} /></div></div>
                      <div className="pct">{num(i.pct, 0)}%</div>
                      <div className="st"><span className={`cl-tag ${st}`}>{STATUS_LABEL[st]}</span></div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* المالية */}
        <div className="cl-panel" style={show('finance')} role="tabpanel">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="cl-card">
              <h2>جدول الدفعات</h2>
              <p className="cl-sub">المستحق والمسدد لكل مرحلة</p>
              {ms.length === 0 ? <p className="cl-note">لم يُحدَّد جدول دفعات لهذا المشروع بعد.</p> : (
                <>
                  <div className="cl-scroll"><table className="cl-table">
                    <thead><tr><th>#</th><th>الدفعة</th><th>الاستحقاق</th><th>المطلوب</th><th>المسدد</th><th>الحالة</th></tr></thead>
                    <tbody>{ms.map(m => (
                      <tr key={m.no}>
                        <td className="n">{m.no}</td><td>{m.title}</td><td>{dateAr(m.due_date)}</td>
                        <td className="n">{money(m.expected, cur)}</td><td className="n">{money(m.received, cur)}</td>
                        <td><span className={`cl-tag ${m.status === 'paid' ? 'done' : m.status === 'late' ? 'late' : 'due'}`}>{m.status === 'paid' ? 'مسددة' : m.status === 'late' ? 'متأخرة' : 'مستحقة'}</span></td>
                      </tr>))}</tbody>
                  </table></div>
                  <div style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    background: 'var(--surface-sunken, #f8fafc)',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    borderRight: '4px solid var(--brand-primary, #f59e0b)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    lineHeight: '1.7',
                    color: 'var(--text-secondary, #334155)'
                  }}>
                    <strong style={{ display: 'block', color: 'var(--text-primary, #0f172a)', marginBottom: '3px' }}>
                      ⚖️ شروط وضوابط سريان جدول الدفعات والجدول الزمني:
                    </strong>
                    <span>{MILESTONE_CONTRACTUAL_DISCLAIMER}</span>
                  </div>
                </>
              )}
            </div>
            <div className="cl-grid2">
              <div className="cl-card">
                <h2>سندات القبض</h2>
                <p className="cl-sub">المبالغ التي سددتها</p>
                {project.receipts.length === 0 ? <p className="cl-note">لا توجد سندات قبض مسجلة.</p> : (
                  <div className="cl-scroll"><table className="cl-table">
                    <thead><tr><th>رقم السند</th><th>التاريخ</th><th>طريقة الدفع</th><th>المبلغ</th></tr></thead>
                    <tbody>{project.receipts.map((r, k) => (<tr key={k}><td className="n">{r.number || '—'}</td><td>{dateAr(r.date)}</td><td>{r.method || '—'}</td><td className="n">{money(r.amount, cur)}</td></tr>))}</tbody>
                  </table></div>
                )}
              </div>
              <div className="cl-card">
                <h2>الفواتير</h2>
                <p className="cl-sub">الفواتير الصادرة على مشروعك</p>
                {project.invoices.length === 0 ? <p className="cl-note">لا توجد فواتير صادرة بعد.</p> : (
                  <div className="cl-scroll"><table className="cl-table">
                    <thead><tr><th>الفاتورة</th><th>التاريخ</th><th>الإجمالي</th><th>المسدد</th></tr></thead>
                    <tbody>{project.invoices.map((v, k) => (<tr key={k}><td className="n">{v.number || '—'}</td><td>{dateAr(v.date)}</td><td className="n">{money(v.total, cur)}</td><td className="n">{money(v.paid, cur)}</td></tr>))}</tbody>
                  </table></div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* صور الزيارات (المعتمدة فقط) */}
        <div className="cl-panel" style={show('visits')} role="tabpanel">
          <div className="cl-card">
            <h2>صور الزيارات</h2>
            <p className="cl-sub">صور من زيارات الموقع، يضيفها فريق فاي تك بعد مراجعتها</p>
            {project.gallery.length === 0 ? <p className="cl-note">لا توجد صور منشورة بعد.</p> : (
              <div className="cl-visits">
                {project.gallery.map(g => (
                  <figure className="cl-visit" key={g.id}>
                    <div className="cl-photo"><GalleryImg id={g.id} alt={g.caption || 'صورة من زيارة الموقع'} onClick={setZoom} /></div>
                    <figcaption className="cl-visit-b"><b>{g.caption || 'زيارة ميدانية'}</b><small>{dateAr(g.date)}</small></figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </div>
        {zoom && (
          <div className="cl-lightbox cl-noprint" role="dialog" aria-modal="true" aria-label="عرض الصورة" onClick={() => setZoom(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom} alt="" />
            <button type="button" className="cl-btn" onClick={() => setZoom(null)}>إغلاق</button>
          </div>
        )}

        <p className="cl-note">
          البيانات محدّثة من نظام فاي تك وقت فتح الصفحة. لأي استفسار تواصل مع المهندس المسؤول عن مشروعك.
        </p>
      </main>
    </>
  );
}

export default function ClientPortalPage() {
  return (
    <div className="cl" dir="rtl">
      <style>{CSS}</style>
      <Suspense fallback={<div className="cl-state">جاري التحميل…</div>}>
        <Portal />
      </Suspense>
    </div>
  );
}
