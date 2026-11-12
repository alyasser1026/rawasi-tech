"use client";

import React, { useMemo } from 'react';
import { formatCurrency } from '@/lib/helpers';
import { currencyCode, currencyName } from '@/lib/currency';
import { printReportElement } from '@/lib/printReportElement';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import { DocSignatures, DocTotals, PHI_DOC_CSS } from '@/components/PrintDocument';

/*
 * ملخص المصروفات حسب التصنيف.
 * - من غير تصنيف مختار: كروت لكل تصنيف (الإجمالي وعدد القيود ونسبته)، والضغط على أي كارت يختاره.
 * - بعد اختيار تصنيف (زي «عمولات وبقشيش»): بيجمّع كل البنود حسب البيان، ويطلع لكل بيان عدد القيود
 *   وإجماليه ونسبته، وتحت الإجمالي الكلي للتصنيف، ومعاه التوزيع على المشاريع.
 * كله بيحترم فلاتر الصفحة (التاريخ والبحث والحالة والسداد).
 */

type Expense = Record<string, any>;

const PRINT_ID = 'expense-category-summary-print';

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** نفس معادلة إجمالي الصفحة، عشان الملخص يطابق رقم «إجمالي مصروفات الفترة». */
export const expenseTotal = (row: Expense) =>
  num(row.total_price) || (num(row.quantity || 1) * num(row.unit_price) + num(row.vat_amount) - num(row.discount_amount));

/** مفتاح تجميع للبيان: بيتجاهل المسافات الزيادة واختلاف الهمزات والتاء المربوطة والألف المقصورة. */
const groupKey = (text: string) =>
  text
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

type Line = { label: string; amount: number; date: string; project: string };

/** بنود المصروف: كل سطر ببيانه ومبلغه. لو فيه ضريبة أو خصم، بيتوزعوا على السطور بالنسبة عشان المجموع يطابق إجمالي القيد. */
function expenseLines(row: Expense): Line[] {
  const total = expenseTotal(row);
  const date = String(row.exp_date || '');
  const project = String(row.site_ref || '').trim() || 'بدون مشروع';
  const lines = Array.isArray(row.lines_data) ? row.lines_data.filter(Boolean) : [];
  const headLabel = String(row.description || '').trim();

  if (lines.length <= 1) {
    const only = lines[0];
    const label = headLabel || String(only?.description || only?.item_name || '').trim() || 'بدون بيان';
    return [{ label, amount: total, date, project }];
  }

  const bases = lines.map((l: any) => num(l.total_price) || num(l.quantity || 1) * num(l.unit_price));
  const baseSum = bases.reduce((a: number, b: number) => a + b, 0);
  return lines.map((l: any, i: number) => ({
    label: String(l.description || l.item_name || l.work_item || '').trim() || headLabel || 'بدون بيان',
    amount: baseSum > 0 ? (bases[i] / baseSum) * total : total / lines.length,
    date,
    project,
  }));
}

type Group = { key: string; label: string; count: number; total: number; lastDate: string; labels: Map<string, number> };

function groupBy(lines: Line[], pick: (l: Line) => string) {
  const map = new Map<string, Group>();
  for (const l of lines) {
    const raw = pick(l);
    const key = groupKey(raw) || '—';
    const g = map.get(key) || { key, label: raw, count: 0, total: 0, lastDate: '', labels: new Map() };
    g.count += 1;
    g.total += l.amount;
    if (l.date > g.lastDate) g.lastDate = l.date;
    g.labels.set(raw, (g.labels.get(raw) || 0) + 1);
    map.set(key, g);
  }
  // الاسم المعروض = أكتر كتابة اتكررت للبيان ده
  for (const g of map.values()) g.label = [...g.labels.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return [...map.values()].sort((a, b) => b.total - a.total);
}

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const fmtPct = (v: number) => `${v >= 10 || v === 0 ? v.toFixed(0) : v.toFixed(1)}%`;

type Props = {
  /** المصروفات بعد فلاتر الصفحة وقبل فلتر التصنيف */
  expenses: Expense[];
  category: string | null;
  onSelectCategory: (category: string | null) => void;
};

export default function ExpenseCategorySummary({ expenses, category, onSelectCategory }: Props) {
  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>();
    for (const row of expenses) {
      const name = String(row.main_category || '').trim() || 'غير مصنف';
      const c = map.get(name) || { name, count: 0, total: 0 };
      c.count += 1;
      c.total += expenseTotal(row);
      map.set(name, c);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [expenses]);

  const grandTotal = useMemo(() => byCategory.reduce((s, c) => s + c.total, 0), [byCategory]);

  const detail = useMemo(() => {
    if (!category) return null;
    const rows = expenses.filter(r => (String(r.main_category || '').trim() || 'غير مصنف') === category);
    const lines = rows.flatMap(expenseLines);
    const total = rows.reduce((s, r) => s + expenseTotal(r), 0);
    const dates = rows.map(r => String(r.exp_date || '')).filter(Boolean).sort();
    return {
      count: rows.length,
      total,
      avg: rows.length ? total / rows.length : 0,
      from: dates[0] || '',
      to: dates[dates.length - 1] || '',
      byLabel: groupBy(lines, l => l.label),
      byProject: groupBy(lines, l => l.project),
    };
  }, [expenses, category]);

  if (!expenses.length) return null;

  const cur = currencyCode();

  return (
    <section className="ecs" aria-label="ملخص المصروفات حسب التصنيف">
      <style>{ECS_CSS}</style>

      {!category || !detail ? (
        <>
          <div className="ecs-head">
            <div>
              <h2>ملخص التصنيفات</h2>
              <p>اضغط على أي تصنيف عشان تشوف ملخص بنوده مجمّعة بالبيان. الأرقام حسب فلاتر الصفحة الحالية.</p>
            </div>
            <div className="ecs-total"><span>إجمالي الفترة</span><b>{formatCurrency(grandTotal)}</b></div>
          </div>
          <div className="ecs-cards">
            {byCategory.map(c => (
              <button key={c.name} type="button" className="ecs-card" onClick={() => onSelectCategory(c.name)}>
                <span className="ecs-card-name">{c.name}</span>
                <b className="ecs-card-total">{formatCurrency(c.total)}</b>
                <span className="ecs-card-meta">{c.count} قيد • <bdi dir="ltr">{fmtPct(pct(c.total, grandTotal))}</bdi></span>
                <span className="ecs-bar" aria-hidden="true"><i style={{ width: `${Math.max(2, pct(c.total, grandTotal))}%` }} /></span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="ecs-head">
            <div>
              <h2>ملخص تصنيف: {category}</h2>
              <p>
                {detail.count} قيد
                {detail.from && <> • من <bdi>{detail.from}</bdi> إلى <bdi>{detail.to}</bdi></>}
                {' '}• {detail.byLabel.length} بيان مختلف
              </p>
            </div>
            <div className="ecs-actions">
              <button type="button" className="ecs-btn" onClick={() => printReportElement(PRINT_ID, `ملخص_${category}`)}>طباعة الملخص</button>
              <button type="button" className="ecs-btn ecs-btn-ghost" onClick={() => onSelectCategory(null)}>كل التصنيفات</button>
            </div>
          </div>

          <div className="ecs-kpis">
            <div className="is-main"><span>إجمالي التصنيف</span><b>{formatCurrency(detail.total)}</b></div>
            <div><span>عدد القيود</span><b>{detail.count}</b></div>
            <div><span>متوسط القيد</span><b>{formatCurrency(detail.avg)}</b></div>
            <div><span>من إجمالي الفترة</span><b dir="ltr">{fmtPct(pct(detail.total, grandTotal))}</b></div>
          </div>

          <div className="ecs-grid">
            <div className="ecs-panel">
              <h3>التجميع حسب البيان</h3>
              <div className="ecs-table-wrap">
                <table className="ecs-table">
                  <thead>
                    <tr><th className="is-start">البيان</th><th>عدد القيود</th><th>الإجمالي</th><th>النسبة</th><th>آخر تاريخ</th></tr>
                  </thead>
                  <tbody>
                    {detail.byLabel.map(g => (
                      <tr key={g.key}>
                        <td className="is-start">{g.label}</td>
                        <td>{g.count}</td>
                        <td className="is-strong">{formatCurrency(g.total)}</td>
                        <td>
                          <span className="ecs-pct"><span className="ecs-bar" aria-hidden="true"><i style={{ width: `${Math.max(2, pct(g.total, detail.total))}%` }} /></span>{fmtPct(pct(g.total, detail.total))}</span>
                        </td>
                        <td><bdi>{g.lastDate || '—'}</bdi></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td className="is-start">الإجمالي الكلي</td><td>{detail.count}</td><td>{formatCurrency(detail.total)}</td><td>100%</td><td /></tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="ecs-panel">
              <h3>التوزيع على المشاريع</h3>
              <ul className="ecs-list">
                {detail.byProject.map(g => (
                  <li key={g.key}>
                    <div><span>{g.label}</span><b>{formatCurrency(g.total)}</b></div>
                    <span className="ecs-bar" aria-hidden="true"><i style={{ width: `${Math.max(2, pct(g.total, detail.total))}%` }} /></span>
                    <small>{g.count} قيد • <bdi dir="ltr">{fmtPct(pct(g.total, detail.total))}</bdi></small>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* نسخة الطباعة: بتتطبع لوحدها في صفحة A4 بالترويسة الرسمية */}
          <div id={PRINT_ID} className="ecs-print-src" aria-hidden="true">
            <style>{PHI_DOC_CSS + ECS_PRINT_CSS}</style>
            <div className="phi-doc">
              <ReportOfficialHeader
                title={`ملخص مصروفات: ${category}`}
                subtitle={detail.from ? `الفترة من ${detail.from} إلى ${detail.to}` : undefined}
                refLabel="رقم التقرير"
                currency={`${currencyName()} (${cur})`}
                compact
                details={[
                  { label: 'التصنيف', value: category },
                  { label: 'عدد القيود', value: String(detail.count) },
                  { label: 'عدد البنود المختلفة', value: String(detail.byLabel.length) },
                  { label: 'إجمالي التصنيف', value: formatCurrency(detail.total), accent: true },
                ]}
              />
              <table className="phi-doc-table">
                <thead><tr><th style={{ width: '6%' }}>م</th><th className="is-start">البيان</th><th style={{ width: '14%' }}>عدد القيود</th><th style={{ width: '20%' }}>الإجمالي</th><th style={{ width: '12%' }}>النسبة</th><th style={{ width: '15%' }}>آخر تاريخ</th></tr></thead>
                <tbody>
                  {detail.byLabel.map((g, i) => (
                    <tr key={g.key}>
                      <td className="is-muted">{i + 1}</td>
                      <td className="is-start is-strong">{g.label}</td>
                      <td>{g.count}</td>
                      <td className="is-strong">{formatCurrency(g.total)}</td>
                      <td>{fmtPct(pct(g.total, detail.total))}</td>
                      <td>{g.lastDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="phi-doc-summary">
                <div className="phi-doc-stack">
                  <table className="phi-doc-table">
                    <thead><tr><th className="is-start">المشروع</th><th>القيود</th><th>الإجمالي</th></tr></thead>
                    <tbody>
                      {detail.byProject.map(g => (
                        <tr key={g.key}><td className="is-start">{g.label}</td><td>{g.count}</td><td className="is-strong">{formatCurrency(g.total)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <DocTotals
                  rows={[
                    { label: 'عدد القيود', value: detail.count },
                    { label: 'متوسط القيد', value: formatCurrency(detail.avg) },
                    { label: 'من إجمالي الفترة', value: fmtPct(pct(detail.total, grandTotal)), tone: 'muted' },
                  ]}
                  grand={{ label: 'إجمالي التصنيف', value: formatCurrency(detail.total) }}
                />
              </div>
              <DocSignatures slots={[
                { title: 'أعدّه', en: 'Prepared by' },
                { title: 'المراجعة', en: 'Reviewed by' },
                { title: 'المدير المالي', en: 'Finance Manager' },
              ]} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

const ECS_CSS = `
.ecs { background:var(--surface-card); border-radius:var(--phi-radius-card, 18px); box-shadow:var(--shadow-ambient); padding:1rem 1.125rem; margin-bottom:1rem; display:grid; gap:0.875rem; }
.ecs h2 { margin:0; font-size:var(--fs-lg); font-weight:900; color:var(--text-primary); }
.ecs h3 { margin:0 0 0.625rem; font-size:var(--fs-sm); font-weight:900; color:var(--text-secondary); }
.ecs p { margin:0.25rem 0 0; font-size:var(--fs-xs); font-weight:700; color:var(--text-muted); }
.ecs-head { display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; flex-wrap:wrap; }
.ecs-total { display:flex; flex-direction:column; align-items:flex-end; gap:0.125rem; }
.ecs-total span { font-size:var(--fs-xs); font-weight:800; color:var(--text-secondary); }
.ecs-total b { font-size:var(--fs-xl); font-weight:900; color:var(--accent-ink); font-variant-numeric:tabular-nums; }
.ecs-actions { display:flex; gap:0.5rem; flex-wrap:wrap; }
.ecs-btn { min-height:2.5rem; padding:0 1rem; border-radius:10px; border:none; background:var(--action-fill); color:var(--action-ink); font:inherit; font-size:var(--fs-sm); font-weight:800; cursor:pointer; }
.ecs-btn-ghost { background:var(--surface-sunken); color:var(--text-primary); box-shadow:var(--shadow-sunken); }
.ecs-btn:focus-visible, .ecs-card:focus-visible { outline:2px solid var(--accent-main); outline-offset:2px; }

.ecs-cards { display:grid; grid-template-columns:repeat(auto-fill, minmax(12.5rem, 1fr)); gap:0.625rem; }
.ecs-card { text-align:start; display:flex; flex-direction:column; gap:0.25rem; padding:0.75rem 0.875rem; border:none; border-radius:14px; background:var(--surface-sunken); box-shadow:var(--shadow-sunken); color:var(--text-primary); font:inherit; cursor:pointer; transition:transform .15s ease, background .15s ease; }
.ecs-card:hover { transform:translateY(-1px); background:var(--surface-card-hover, var(--surface-sunken)); }
.ecs-card-name { font-size:var(--fs-sm); font-weight:900; }
.ecs-card-total { font-size:var(--fs-lg); font-weight:900; color:var(--accent-ink); font-variant-numeric:tabular-nums; }
.ecs-card-meta { font-size:var(--fs-xs); font-weight:700; color:var(--text-muted); }

.ecs-bar { display:block; height:6px; border-radius:999px; background:color-mix(in srgb, var(--text-muted) 18%, transparent); overflow:hidden; }
.ecs-bar i { display:block; height:100%; border-radius:inherit; background:var(--accent-main, #ea580c); }

.ecs-kpis { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:0.625rem; }
.ecs-kpis > div { padding:0.75rem 0.875rem; border-radius:14px; background:var(--surface-sunken); box-shadow:var(--shadow-sunken); display:flex; flex-direction:column; gap:0.125rem; min-width:0; }
.ecs-kpis span { font-size:var(--fs-xs); font-weight:800; color:var(--text-secondary); }
.ecs-kpis b { text-align:start; font-size:var(--fs-lg); font-weight:900; color:var(--text-primary); font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
.ecs-kpis .is-main b { color:var(--accent-ink); font-size:var(--fs-xl); }

.ecs-grid { display:grid; grid-template-columns:minmax(0, 1.7fr) minmax(0, 1fr); gap:0.875rem; align-items:start; }
.ecs-panel { min-width:0; }
.ecs-table-wrap { overflow-x:auto; border-radius:12px; }
.ecs-table { width:100%; border-collapse:collapse; font-size:var(--fs-sm); }
.ecs-table th { text-align:center; font-size:var(--fs-xs); font-weight:800; color:var(--text-secondary); padding:0.5rem; border-bottom:1px solid var(--border-subtle, rgba(127,127,127,.25)); white-space:nowrap; }
.ecs-table td { text-align:center; padding:0.5rem; border-bottom:1px solid var(--border-subtle, rgba(127,127,127,.15)); color:var(--text-primary); font-weight:700; font-variant-numeric:tabular-nums; }
.ecs-table .is-start { text-align:start; }
.ecs-table .is-strong { font-weight:900; }
.ecs-table tfoot td { font-weight:900; border-bottom:0; border-top:2px solid var(--text-primary); color:var(--accent-ink); }
.ecs-pct { display:inline-flex; align-items:center; gap:0.375rem; min-width:6rem; }
.ecs-pct .ecs-bar { flex:1; min-width:3rem; }

.ecs-list { list-style:none; margin:0; padding:0; display:grid; gap:0.625rem; }
.ecs-list li { display:grid; gap:0.25rem; }
.ecs-list li > div { display:flex; justify-content:space-between; gap:0.5rem; font-size:var(--fs-sm); font-weight:800; color:var(--text-primary); }
.ecs-list li > div b { font-weight:900; font-variant-numeric:tabular-nums; white-space:nowrap; }
.ecs-list small { font-size:var(--fs-xs); color:var(--text-muted); font-weight:700; }

.ecs-print-src { display:none; }

@media (max-width: 900px) {
  .ecs-grid { grid-template-columns:1fr; }
  .ecs-kpis { grid-template-columns:repeat(2, minmax(0, 1fr)); }
}
@media print { .ecs { display:none !important; } }
`;

/* بيشتغل جوه نافذة الطباعة بس (printReportElement بينسخ العنصر لوحده في صفحة بيضا). */
const ECS_PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 10mm 12mm; }
  .ecs-print-src { display:block !important; }
}
`;
