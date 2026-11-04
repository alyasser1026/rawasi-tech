"use client";
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import MasterPage from '@/components/MasterPage';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/helpers';
import { notify } from '@/lib/notify';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import LoadingScreen from '@/components/LoadingScreen';
import KpiStrip from '@/components/KpiStrip';
import { TrendingUp, TrendingDown, Scale, Printer, RefreshCw, Landmark, FileSpreadsheet } from 'lucide-react';

type Line = { id: string | number; name: string; balance: number };

function StatementSection({ title, lines, total }: { title: string; lines?: Line[]; total?: number }) {
  if (!lines || lines.length === 0) return null;
  return <div className="phi-statement-section">
    <h3><span>{title}</span><small>{lines.length.toLocaleString('ar-EG')} حساب</small></h3>
    <table className="phi-statement-table">
      <thead className="sr-only"><tr><th>اسم الحساب</th><th>الرصيد</th></tr></thead>
      <tbody>{lines.map(acc => <tr key={acc.id}><td>{acc.name}</td><td className="amount">{formatCurrency(acc.balance)}</td></tr>)}</tbody>
      <tfoot><tr><td>إجمالي {title}</td><td className="amount">{formatCurrency(total || 0)}</td></tr></tfoot>
    </table>
  </div>;
}

function EmptyStatement({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return <div className="ent-empty"><FileSpreadsheet size={30} aria-hidden="true" /><h3>لم تُجهَّز القائمة بعد</h3><p>اضغط «تحديث الأرقام» لتوليد القائمة من القيود المرحّلة.</p><button type="button" className="ent-button" onClick={onRefresh} disabled={refreshing}><RefreshCw size={15} aria-hidden="true" />تحديث الأرقام</button></div>;
}

export default function FinancialStatementsPage() {
  const [incomeStatement, setIncomeStatement] = useState<any>(null);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatements = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('sys_financial_reports').select('*');
      if (error) throw error;
      const income = data?.find((d: any) => d.report_name === 'IncomeStatement');
      const balance = data?.find((d: any) => d.report_name === 'BalanceSheet');
      const stamp = income?.updated_at || balance?.updated_at;
      setIncomeStatement(income?.report_data || null);
      setBalanceSheet(balance?.report_data || null);
      setLastUpdated(stamp ? new Date(stamp).toLocaleString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
    } catch (error) {
      console.error('Error fetching statements:', error);
      notify.error('تعذر تحميل القوائم المالية');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStatements(); }, [fetchStatements]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const { error } = await supabase.rpc('generate_financial_reports_json');
    if (error) { console.error('Error refreshing statements:', error); notify.error('تعذر إعادة حساب القوائم المالية، تم عرض آخر نسخة محفوظة'); }
    else notify.success('تم تحديث القوائم المالية');
    await fetchStatements();
  }, [fetchStatements]);

  const netIncome = Number(incomeStatement?.net_income || 0);
  const summary = useMemo(() => (incomeStatement || balanceSheet) ? <KpiStrip items={[
    { label: 'إجمالي الإيرادات', amount: incomeStatement?.total_revenue || 0, tone: 'info', icon: <TrendingUp /> },
    { label: 'إجمالي المصروفات', amount: incomeStatement?.total_expense || 0, tone: 'warning', icon: <TrendingDown /> },
    { label: netIncome >= 0 ? 'صافي الربح' : 'صافي الخسارة', amount: Math.abs(netIncome), tone: netIncome >= 0 ? 'success' : 'danger', icon: <Scale /> },
    { label: 'إجمالي الأصول', amount: balanceSheet?.total_assets || 0, tone: 'brand', icon: <Landmark /> },
  ]} /> : null, [incomeStatement, balanceSheet, netIncome]);

  const actions = useMemo(() => <>
    <button type="button" className="ent-button ent-primary" onClick={() => void handleRefresh()} disabled={refreshing}><RefreshCw size={16} aria-hidden="true" />{refreshing ? 'جاري التحديث…' : 'تحديث الأرقام'}</button>
    <button type="button" className="ent-button" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />طباعة القوائم</button>
    <p>{lastUpdated ? `آخر تحديث: ${lastUpdated}` : 'لم يتم التحديث بعد'}</p>
  </>, [handleRefresh, refreshing, lastUpdated]);

  return (
    <MasterPage title="القوائم المالية" subtitle="قائمة الدخل والمركز المالي من القيود المرحّلة">
      <RawasiSidebarManager summary={summary} actions={actions} watchDeps={[incomeStatement, balanceSheet, refreshing, lastUpdated]} />
      <style>{`
        .print-header { display: none; }
        @media print {
          .print-header { display: block; text-align: center; margin-bottom: 24px; border-bottom: 2px solid #000; padding-bottom: 12px; }
          .print-header h1 { margin: 0; font-size: 22px; }
          .print-header h2 { margin: 8px 0; font-size: 18px; }
          .print-header p { margin: 0; font-size: 12px; color: #555; }
          .phi-statement-grid { grid-template-columns: 1fr 1fr !important; }
          .phi-statement-grid .ent-panel { box-shadow: none !important; break-inside: avoid; }
          @page { size: A4 landscape; margin: 1.2cm; }
        }
      `}</style>
      <div className="print-header">
        <h1>شركة فاي تك للمقاولات</h1>
        <h2>القوائم المالية (قائمة الدخل والمركز المالي)</h2>
        <p>آخر تحديث للأرقام: {lastUpdated || '—'}</p>
      </div>

      {loading ? <LoadingScreen message="جاري تحميل القوائم المالية..." fullScreen={false} /> : (
        <div className="phi-statement-grid">
          <section className="ent-panel" aria-labelledby="income-title">
            <div className="ent-panel-heading"><div className="ent-panel-title"><h2 id="income-title">قائمة الدخل</h2><small>الإيرادات والمصروفات</small></div><TrendingUp size={18} aria-hidden="true" className="ent-muted" /></div>
            {incomeStatement ? <>
              <StatementSection title="الإيرادات" lines={incomeStatement.revenues} total={incomeStatement.total_revenue} />
              <StatementSection title="المصروفات" lines={incomeStatement.expenses} total={incomeStatement.total_expense} />
              <div className={`phi-statement-result ${netIncome >= 0 ? 'is-good' : 'is-bad'}`}><span>{netIncome >= 0 ? 'صافي الربح' : 'صافي الخسارة'}</span><strong>{formatCurrency(Math.abs(netIncome))}</strong></div>
            </> : <EmptyStatement onRefresh={() => void handleRefresh()} refreshing={refreshing} />}
          </section>

          <section className="ent-panel" aria-labelledby="balance-title">
            <div className="ent-panel-heading"><div className="ent-panel-title"><h2 id="balance-title">المركز المالي</h2><small>الأصول والالتزامات وحقوق الملكية</small></div><Scale size={18} aria-hidden="true" className="ent-muted" /></div>
            {balanceSheet ? <>
              <StatementSection title="الأصول" lines={balanceSheet.assets} total={balanceSheet.total_assets} />
              <StatementSection title="الالتزامات" lines={balanceSheet.liabilities} total={balanceSheet.total_liabilities} />
              <StatementSection title="حقوق الملكية" lines={balanceSheet.equity} total={balanceSheet.total_equity} />
              <div className="phi-statement-result is-info"><span>الالتزامات وحقوق الملكية + صافي الدخل</span><strong>{formatCurrency(balanceSheet.total_liabilities_and_equity || 0)}</strong></div>
            </> : <EmptyStatement onRefresh={() => void handleRefresh()} refreshing={refreshing} />}
          </section>
        </div>
      )}
    </MasterPage>
  );
}
