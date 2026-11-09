"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { CHECKLIST } from './checklist-data';
import ExecutionGuideDossier from './ExecutionGuideDossier';

const KEY = 'phi-checklist-v1';

const norm = (s: string) =>
  s.toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\*\*/g, '');

/** يفصل العنوان العربي عن المصطلح الإنجليزي بين الأقواس. */
function splitTitle(t: string) {
  const m = t.match(/^(.*?)\s*\(([A-Za-z][^)]*)\)\s*$/);
  return m ? { ar: m[1], en: m[2] } : { ar: t, en: '' };
}

function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => (p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>))}
    </>
  );
}

type Row = { id: string; item: { text: string; subs: string[] } };

export default function ChecklistExplorer() {
  const [viewMode, setViewMode] = useState<'dossier' | 'checklist'>('dossier');
  const [done, setDone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set(['s1']));
  const [part, setPart] = useState<string>('all');
  const [q, setQ] = useState('');
  const [site, setSite] = useState('');
  const [printing, setPrinting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (Array.isArray(v.done)) setDone(new Set(v.done));
        if (typeof v.site === 'string') setSite(v.site);
      }
    } catch { /* التخزين اختياري */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify({ done: Array.from(done), site })); } catch { /* ignore */ }
  }, [done, site, ready]);

  useEffect(() => {
    const after = () => setPrinting(false);
    window.addEventListener('afterprint', after);
    return () => window.removeEventListener('afterprint', after);
  }, []);

  const model = useMemo(() => {
    return CHECKLIST.map(p => ({
      ...p,
      sections: p.sections.map(s => {
        const groups = s.groups.map((g, gi) => ({
          title: g.title,
          rows: g.items.map((item, ii) => ({ id: `${s.id}.${gi}.${ii}`, item })) as Row[],
        }));
        const ids = groups.flatMap(g => g.rows.map(r => r.id));
        return { ...s, groups, ids };
      }),
    }));
  }, []);

  const allIds = useMemo(() => model.flatMap(p => p.sections.flatMap(s => s.ids)), [model]);
  const total = allIds.length;
  const doneCount = allIds.reduce((n, id) => n + (done.has(id) ? 1 : 0), 0);
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const nq = norm(q.trim());
  const searching = nq.length > 0;
  const matchRow = (r: Row) => norm(r.item.text + ' ' + r.item.subs.join(' ')).includes(nq);

  const visible = model
    .filter(p => part === 'all' || p.id === part)
    .map(p => ({
      ...p,
      sections: p.sections
        .map(s => {
          if (!searching) return s;
          const titleHit = norm(s.title).includes(nq);
          const groups = s.groups
            .map(g => ({ ...g, rows: titleHit ? g.rows : g.rows.filter(matchRow) }))
            .filter(g => g.rows.length > 0);
          return { ...s, groups };
        })
        .filter(s => s.groups.length > 0),
    }))
    .filter(p => p.sections.length > 0);

  const visibleSections = visible.flatMap(p => p.sections);
  const resultCount = searching ? visibleSections.reduce((n, s) => n + s.groups.reduce((m, g) => m + g.rows.length, 0), 0) : 0;

  const toggleItem = (id: string) =>
    setDone(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSection = (id: string) =>
    setOpen(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const expandAll = () => setOpen(new Set(visibleSections.map(s => s.id)));
  const collapseAll = () => setOpen(new Set());
  const resetAll = () => { if (window.confirm('تصفير كل علامات الإنجاز على هذا الجهاز؟')) setDone(new Set()); };
  const printNow = () => { setPrinting(true); setTimeout(() => window.print(), 150); };
  const checkSection = (ids: string[]) => {
    const all = ids.every(id => done.has(id));
    setDone(prev => { const n = new Set(prev); ids.forEach(id => (all ? n.delete(id) : n.add(id))); return n; });
  };
  const jump = (id: string) => {
    setOpen(prev => new Set(prev).add(id));
    setTimeout(() => document.getElementById('ck-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  return (
    <div className={`pw-ck-container ${printing ? 'is-printing' : ''}`}>
      {/* View Switcher Tabs */}
      <div className="pw-view-tabs" role="tablist" aria-label="أنماط العرض الهندسية">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'dossier'}
          className={`pw-view-tab ${viewMode === 'dossier' ? 'is-active' : ''}`}
          onClick={() => setViewMode('dossier')}
        >
          <span>🏗️</span>
          <span>دليل وبطاقات التنفيذ الهندسي (10 محاور)</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'checklist'}
          className={`pw-view-tab ${viewMode === 'checklist' ? 'is-active' : ''}`}
          onClick={() => setViewMode('checklist')}
        >
          <span>📋</span>
          <span>قائمة التفقد الميداني (207 بند)</span>
        </button>
      </div>

      {viewMode === 'dossier' ? (
        <ExecutionGuideDossier
          onNavigateToChecklistSection={() => {
            setViewMode('checklist');
          }}
        />
      ) : (
        <div className={`pw-ck ${printing ? 'is-printing' : ''}`}>
          <div className="pw-ck-print-head">
            <strong>قائمة التفقد الهندسية — فاي تك</strong>
            {site && <span>المشروع: {site}</span>}
            <span>التاريخ: {new Date().toLocaleDateString('ar-EG-u-nu-latn')}</span>
          </div>

          <div className="pw-ck-top">
            <div className="pw-ck-progress" role="group" aria-label="التقدم الكلي">
              <div className="pw-ck-progress-row">
                <strong>{pct}%</strong>
                <span>تم فحص {doneCount} من {total} بند</span>
              </div>
              <div className="pw-ck-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: pct + '%' }} /></div>
              <p className="pw-ck-hint">علامات الإنجاز تُحفظ على جهازك فقط، ولا تُرسل لأي مكان.</p>
            </div>
            <label className="pw-ck-field">
              <span>اسم المشروع / الموقع (يظهر في الطباعة)</span>
              <input value={site} onChange={e => setSite(e.target.value)} placeholder="مثال: فيلا 657 – الرياض" maxLength={80} />
            </label>
          </div>

          <div className="pw-ck-tools">
            <input className="pw-ck-search" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث في البنود… (مثال: عزل، هزاز، بورسلين)" aria-label="بحث في قائمة التفقد" />
            <div className="pw-ck-actions">
              <button type="button" className="pw-ck-btn" onClick={expandAll}>فتح الكل</button>
              <button type="button" className="pw-ck-btn" onClick={collapseAll}>طي الكل</button>
              <button type="button" className="pw-ck-btn is-primary" onClick={printNow}>طباعة / PDF</button>
              <button type="button" className="pw-ck-btn" onClick={resetAll}>تصفير</button>
            </div>
          </div>

          <div className="pw-ck-chips" role="tablist" aria-label="أقسام القائمة">
            <button type="button" role="tab" aria-selected={part === 'all'} className={`pw-chip ${part === 'all' ? 'is-on' : ''}`} onClick={() => setPart('all')}>الكل</button>
            {model.map(p => (
              <button key={p.id} type="button" role="tab" aria-selected={part === p.id} className={`pw-chip ${part === p.id ? 'is-on' : ''}`} onClick={() => setPart(p.id)}>{p.title}</button>
            ))}
          </div>

          {searching && <p className="pw-ck-count" aria-live="polite">{resultCount ? `${resultCount} بند مطابق` : 'لا توجد نتائج مطابقة'}</p>}

          <div className="pw-ck-layout">
            <nav className="pw-ck-side" aria-label="فهرس الأقسام">
              {visible.map(p => (
                <div key={p.id} className="pw-ck-side-part">
                  <p>{p.title}</p>
                  {p.sections.map(s => {
                    const d = s.ids.filter(id => done.has(id)).length;
                    const full = d === s.ids.length;
                    return (
                      <button key={s.id} type="button" onClick={() => jump(s.id)} className={full ? 'is-full' : ''}>
                        <span>{splitTitle(s.title).ar}</span>
                        <em>{d}/{s.ids.length}</em>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="pw-ck-main">
              {visible.map(p => (
                <div key={p.id} className="pw-ck-part">
                  <h3 className="pw-ck-part-h">{p.title}<span>{p.subtitle}</span></h3>
                  {p.sections.map(s => {
                    const isOpen = printing || searching || open.has(s.id);
                    const d = s.ids.filter(id => done.has(id)).length;
                    const t = splitTitle(s.title);
                    return (
                      <section key={s.id} id={'ck-' + s.id} className={`pw-ck-sec ${isOpen ? 'is-open' : ''} ${d === s.ids.length ? 'is-done' : ''}`}>
                        <button type="button" className="pw-ck-sec-h" aria-expanded={isOpen} aria-controls={'ckb-' + s.id} onClick={() => toggleSection(s.id)}>
                          <span className="pw-ck-no">{s.no}</span>
                          <span className="pw-ck-title">{t.ar}{t.en && <small dir="ltr">{t.en}</small>}</span>
                          <span className="pw-ck-meter" aria-label={`${d} من ${s.ids.length}`}>{d}/{s.ids.length}</span>
                          <svg className="pw-ck-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
                        </button>
                        {isOpen && (
                          <div className="pw-ck-sec-b" id={'ckb-' + s.id}>
                            {s.critical && (
                              <div className="pw-ck-critical" role="note">
                                <b>قاعدة حاسمة</b>
                                <p>{s.critical}</p>
                              </div>
                            )}
                            {s.groups.map((g, gi) => (
                              <div key={gi} className="pw-ck-group">
                                {g.title && <h4>{g.title}</h4>}
                                <ul>
                                  {g.rows.map(r => (
                                    <li key={r.id}>
                                      <label className={done.has(r.id) ? 'is-checked' : ''}>
                                        <input type="checkbox" checked={done.has(r.id)} onChange={() => toggleItem(r.id)} />
                                        <span className="pw-ck-box" aria-hidden><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                                        <span className="pw-ck-text"><Rich text={r.item.text} /></span>
                                      </label>
                                      {r.item.subs.length > 0 && (
                                        <ul className="pw-ck-subs">{r.item.subs.map((x, k) => <li key={k}><Rich text={x} /></li>)}</ul>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <button type="button" className="pw-ck-all" onClick={() => checkSection(s.ids)}>
                                {d === s.ids.length ? 'إلغاء تحديد القسم' : 'تحديد القسم كله كمنجز'}
                              </button>
                              <button
                                type="button"
                                className="pw-ck-card-btn"
                                onClick={() => setViewMode('dossier')}
                              >
                                🏗️ استعراض بطاقة التنفيذ التفصيلية
                              </button>
                            </div>
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
