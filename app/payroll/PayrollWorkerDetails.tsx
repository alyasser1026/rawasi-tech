"use client";
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/helpers';

/*
 * تفصيل حركات العامل في المسير: اليوميات، السندات، الجزاءات، والعهد المفتوحة.
 * السند بيتصنّف من قيده المحاسبي بنفس قاعدة دالة pull_payroll_module_data:
 *   - مدين على حساب العُهد      → «عهدة» (مش دفعة من الراتب)
 *   - مدين على أي حساب تاني (رواتب/سلف) → «دفعة أجر» وبيتخصم في المسير
 *   - دفعة أجر ودائنها حساب العُهد      → «تسوية من العهدة»
 */

type Row = any;

const isCustodyAccount = (a?: { code?: string | null; name?: string | null } | null) =>
  !!a && (String(a.code || '').startsWith('125') || /عُهد|عهد/.test(String(a.name || '')));

const chunk = <T,>(arr: T[], n = 100) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

async function fetchIn(table: string, select: string, col: string, ids: string[], extra?: (q: any) => any) {
  const rows: Row[] = [];
  for (const part of chunk(ids)) {
    let q = supabase.from(table).select(select).in(col, part);
    if (extra) q = extra(q);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

interface Props {
  record: Row | null;
  month: number;
  year: number;
  cutoffDate: string;
  onClose: () => void;
}

const POSTED = ['posted', 'مرحل', 'معتمد'];

export default function PayrollWorkerDetails({ record, month, year, cutoffDate, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<Row[]>([]);
  const [vouchers, setVouchers] = useState<Row[]>([]);
  const [violations, setViolations] = useState<Row[]>([]);
  const [custodies, setCustodies] = useState<Row[]>([]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!record) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [record, onClose]);

  useEffect(() => {
    if (!record) return;
    let alive = true;
    const first = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = new Date(year, month, 0).getDate();
    const lastOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(monthEnd).padStart(2, '0')}`;
    const last = cutoffDate && cutoffDate < lastOfMonth ? cutoffDate : lastOfMonth;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const [logRes, pvRes, vioRes, custRes] = await Promise.all([
          supabase.from('labor_daily_logs')
            .select('id, work_date, site_ref, work_item, attendance_value, daily_wage, is_posted')
            .eq('worker_partner_id', record.emp_id).gte('work_date', first).lte('work_date', last)
            .order('work_date'),
          supabase.from('payment_vouchers')
            .select('id, voucher_number, date, amount, payment_method, description, is_posted, status')
            .eq('partner_id', record.emp_id).gte('date', first).lte('date', last)
            .order('date'),
          supabase.from('violations')
            .select('id, date, reason, violation_type, amount, is_posted')
            .eq('partner_id', record.emp_id).gte('date', first).lte('date', last)
            .order('date'),
          supabase.from('site_custodies')
            .select('id, custody_number, title, status, disbursed_amount, spent_amount, remaining_amount')
            .eq('partner_id', record.emp_id).neq('status', 'settled')
            .order('opened_date'),
        ]);
        for (const r of [logRes, pvRes, vioRes, custRes]) if (r.error) throw r.error;

        // تصنيف السندات من قيودها
        const pvs: Row[] = pvRes.data || [];
        let classified = pvs.map((v) => ({ ...v, wage_paid: 0, custody_given: 0, from_custody: 0, kind: 'unposted' }));
        if (pvs.length) {
          const headers = await fetchIn('journal_headers', 'id, reference_id, status', 'reference_id', pvs.map((v) => v.id));
          const postedHeaders = headers.filter((h) => POSTED.includes(String(h.status)));
          const lines = postedHeaders.length
            ? await fetchIn('journal_lines', 'header_id, account_id, partner_id, debit, credit', 'header_id', postedHeaders.map((h) => h.id))
            : [];
          const accIds = Array.from(new Set(lines.map((l) => l.account_id).filter(Boolean)));
          const accounts = accIds.length ? await fetchIn('accounts', 'id, code, name', 'id', accIds) : [];
          const accById = new Map(accounts.map((a) => [a.id, a]));
          const headerByRef = new Map<string, string[]>();
          for (const h of postedHeaders) headerByRef.set(h.reference_id, [...(headerByRef.get(h.reference_id) || []), h.id]);

          classified = classified.map((v) => {
            const hIds = headerByRef.get(v.id) || [];
            if (!v.is_posted || !hIds.length) return v;
            const mine = lines.filter((l) => hIds.includes(l.header_id) && l.partner_id === record.emp_id);
            let wage = 0, custody = 0, fromCustody = 0;
            for (const l of mine) {
              const custodyAcc = isCustodyAccount(accById.get(l.account_id));
              if (Number(l.debit) > 0) { if (custodyAcc) custody += Number(l.debit); else wage += Number(l.debit); }
              if (Number(l.credit) > 0 && custodyAcc) fromCustody += Number(l.credit);
            }
            const kind = custody > 0 && wage === 0 ? 'custody' : wage > 0 && fromCustody > 0 ? 'wage_from_custody' : wage > 0 ? 'wage' : 'other';
            return { ...v, wage_paid: wage, custody_given: custody, from_custody: fromCustody, kind };
          });
        }

        if (!alive) return;
        setLogs(logRes.data || []);
        setVouchers(classified);
        setViolations(vioRes.data || []);
        setCustodies(custRes.data || []);
      } catch (e: any) {
        if (alive) setError(e?.message || 'تعذر تحميل الحركات');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [record, month, year, cutoffDate]);

  if (!record || !mounted) return null;

  const isDaily = record.type !== 'موظف';
  const net = Number(record.net_salary || 0);
  const kindLabel: Record<string, { text: string; color: string; bg: string }> = {
    wage: { text: 'دفعة أجر', color: '#047857', bg: '#ecfdf5' },
    wage_from_custody: { text: 'تسوية من العهدة', color: '#1d4ed8', bg: '#eff6ff' },
    custody: { text: 'عهدة — مش من الراتب', color: '#92400e', bg: '#fffbeb' },
    other: { text: 'غير مصنّف', color: '#475569', bg: '#f1f5f9' },
    unposted: { text: 'غير مرحّل', color: '#64748b', bg: '#f1f5f9' },
  };

  const cell: React.CSSProperties = { padding: '0.5rem 0.625rem', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', textAlign: 'center', fontSize: 'var(--fs-sm)' };
  const head: React.CSSProperties = { ...cell, fontWeight: 900, background: 'var(--surface-sunken, #f8fafc)', color: 'var(--text-secondary, #475569)' };
  const section: React.CSSProperties = { marginTop: '1.25rem' };
  const h3: React.CSSProperties = { fontSize: 'var(--fs-md)', fontWeight: 900, margin: '0 0 0.5rem', color: 'var(--text-primary, #0f172a)' };
  const empty = (t: string) => <div style={{ padding: '0.75rem', color: 'var(--text-secondary, #64748b)', fontSize: 'var(--fs-sm)' }}>{t}</div>;

  const totalWageLogs = logs.filter((l) => l.is_posted).reduce((s, l) => s + Number(l.daily_wage || 0), 0);
  const totalWagePaid = vouchers.reduce((s, v) => s + Number(v.wage_paid || 0), 0);
  const totalCustody = vouchers.reduce((s, v) => s + Number(v.custody_given || 0), 0);

  const summary = [
    { label: isDaily ? 'اليوميات المستحقة' : 'الأساسي', value: record.base_rate, tone: 'pos' },
    ...(!isDaily ? [{ label: 'البدلات', value: record.allowances, tone: 'pos' }, { label: 'خصم الغياب', value: record.absence_deduction, tone: 'neg' }] : []),
    { label: 'الغرامات', value: record.deductions, tone: 'neg' },
    { label: 'المدفوع / المسحوبات', value: record.extended_advances, tone: 'neg' },
    { label: 'رصيد سابق', value: record.previous_balance, tone: 'mid' },
  ];

  return createPortal(
    <div className="phi-modal-backdrop phi-blur-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="phi-modal-panel phi-blur-modal" role="dialog" aria-modal="true" aria-label={`تفصيل حركات ${record.name}`}
        style={{ maxWidth: '58rem', padding: '1.25rem 1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 900 }}>{record.name}</h2>
            <div style={{ color: 'var(--text-secondary, #64748b)', fontSize: 'var(--fs-sm)', marginTop: '0.25rem' }}>
              {record.type}{record.job_role ? ` • ${record.job_role}` : ''} • حركات شهر {month}/{year} حتى {cutoffDate}
            </div>
          </div>
          <button type="button" onClick={onClose} className="ent-icon-button" aria-label="إغلاق" style={{ fontSize: '1.25rem', fontWeight: 900 }}>×</button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(8.5rem, 1fr))', gap: '0.625rem', marginTop: '1rem' }}>
          {summary.map((s) => (
            <div key={s.label} style={{ background: 'var(--surface-sunken, #f8fafc)', borderRadius: '12px', padding: '0.625rem 0.75rem' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary, #64748b)', fontWeight: 700 }}>{s.label}</div>
              <div style={{ fontWeight: 900, color: s.tone === 'neg' ? '#be123c' : s.tone === 'pos' ? '#047857' : 'var(--text-primary, #0f172a)' }}>{formatCurrency(s.value || 0)}</div>
            </div>
          ))}
          <div style={{ background: net < 0 ? '#fffbeb' : net > 0 ? '#fff1f2' : '#ecfdf5', borderRadius: '12px', padding: '0.625rem 0.75rem' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#475569' }}>الصافي</div>
            <div style={{ fontWeight: 900, color: net < 0 ? '#b45309' : net > 0 ? '#be123c' : '#047857' }}>
              {formatCurrency(Math.abs(net))} {net > 0 ? '(له)' : net < 0 ? '(عليه)' : '(خالص)'}
            </div>
          </div>
        </div>

        {loading && empty('جاري تحميل الحركات...')}
        {error && <div style={{ marginTop: '1rem', color: '#be123c', fontWeight: 700 }}>{error}</div>}

        {!loading && !error && (
          <>
            {isDaily && (
              <div style={section}>
                <h3 style={h3}>اليوميات ({logs.length}) — المرحّل منها {formatCurrency(totalWageLogs)}</h3>
                {logs.length === 0 ? empty('مفيش يوميات في الفترة دي.') : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={head}>التاريخ</th><th style={head}>الموقع</th><th style={head}>البند</th><th style={head}>الحضور</th><th style={head}>اليومية</th><th style={head}>الحالة</th></tr></thead>
                    <tbody>
                      {logs.map((l) => (
                        <tr key={l.id}>
                          <td style={cell}>{l.work_date}</td>
                          <td style={cell}>{l.site_ref || '—'}</td>
                          <td style={{ ...cell, textAlign: 'right' }}>{l.work_item || '—'}</td>
                          <td style={cell}>{Number(l.attendance_value ?? 1)}</td>
                          <td style={{ ...cell, fontWeight: 800 }}>{formatCurrency(l.daily_wage || 0)}</td>
                          <td style={{ ...cell, color: l.is_posted ? '#047857' : '#b45309', fontWeight: 700 }}>{l.is_posted ? 'مرحّلة' : 'مش مرحّلة (مش محسوبة)'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div style={section}>
              <h3 style={h3}>سندات الصرف ({vouchers.length}) — المحسوب من الراتب {formatCurrency(totalWagePaid)}{totalCustody > 0 ? ` • عهد ${formatCurrency(totalCustody)} (مش محسوبة)` : ''}</h3>
              {vouchers.length === 0 ? empty('مفيش سندات صرف باسمه في الفترة دي.') : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={head}>السند</th><th style={head}>التاريخ</th><th style={head}>المبلغ</th><th style={head}>النوع</th><th style={head}>محسوب من الراتب</th><th style={head}>البيان</th></tr></thead>
                  <tbody>
                    {vouchers.map((v) => {
                      const k = kindLabel[v.kind] || kindLabel.other;
                      return (
                        <tr key={v.id}>
                          <td style={{ ...cell, fontWeight: 800 }} dir="ltr">{v.voucher_number || '—'}</td>
                          <td style={cell}>{v.date}</td>
                          <td style={{ ...cell, fontWeight: 800 }}>{formatCurrency(v.amount || 0)}</td>
                          <td style={cell}><span style={{ background: k.bg, color: k.color, borderRadius: '999px', padding: '0.125rem 0.625rem', fontWeight: 800, fontSize: 'var(--fs-xs)', whiteSpace: 'nowrap' }}>{k.text}</span></td>
                          <td style={{ ...cell, fontWeight: 800, color: v.wage_paid > 0 ? '#be123c' : 'var(--text-secondary, #94a3b8)' }}>{formatCurrency(v.wage_paid || 0)}</td>
                          <td style={{ ...cell, textAlign: 'right' }}>{v.description || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div style={section}>
              <h3 style={h3}>الجزاءات ({violations.length})</h3>
              {violations.length === 0 ? empty('مفيش جزاءات في الفترة دي.') : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={head}>التاريخ</th><th style={head}>النوع</th><th style={head}>السبب</th><th style={head}>المبلغ</th><th style={head}>الحالة</th></tr></thead>
                  <tbody>
                    {violations.map((v) => (
                      <tr key={v.id}>
                        <td style={cell}>{v.date}</td>
                        <td style={cell}>{v.violation_type || '—'}</td>
                        <td style={{ ...cell, textAlign: 'right' }}>{v.reason || '—'}</td>
                        <td style={{ ...cell, fontWeight: 800, color: '#be123c' }}>{formatCurrency(v.amount || 0)}</td>
                        <td style={{ ...cell, color: v.is_posted ? '#047857' : '#b45309', fontWeight: 700 }}>{v.is_posted ? 'مرحّل' : 'مش مرحّل (مش محسوب)'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {custodies.length > 0 && (
              <div style={section}>
                <h3 style={h3}>عهد مفتوحة معاه ({custodies.length})</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={head}>العهدة</th><th style={head}>البيان</th><th style={head}>المنصرف له</th><th style={head}>المصروف منها</th><th style={head}>المتبقي</th></tr></thead>
                  <tbody>
                    {custodies.map((c) => (
                      <tr key={c.id}>
                        <td style={{ ...cell, fontWeight: 800 }} dir="ltr">{c.custody_number}</td>
                        <td style={{ ...cell, textAlign: 'right' }}>{c.title || '—'}</td>
                        <td style={cell}>{formatCurrency(c.disbursed_amount || 0)}</td>
                        <td style={cell}>{formatCurrency(c.spent_amount || 0)}</td>
                        <td style={{ ...cell, fontWeight: 900, color: Number(c.remaining_amount) < 0 ? '#be123c' : '#b45309' }}>{formatCurrency(c.remaining_amount || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary, #64748b)', marginTop: '0.375rem' }}>
                  العهد ليها حساب منفصل (عُهد الموظفين والمواقع) ومش بتدخل في صافي الراتب. اقفلها من شاشة العُهد لما تتصفّى.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
