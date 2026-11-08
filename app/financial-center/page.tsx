"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Droplets, Printer, RefreshCw, Scale, Landmark } from 'lucide-react';
import { supabase } from "@/lib/supabase";
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import LoadingScreen from '@/components/LoadingScreen';
import KpiStrip from '@/components/KpiStrip';
import { formatCurrency } from '@/lib/helpers';

type Movement = { created_at: string; kind: 'expense' | 'journal'; description?: string | null; amount: number; side: 'in' | 'out' };
type Totals = { totalIn: number; totalOut: number; netCash: number; liquidityIndex: number; syncedAt: Date };

const formatDateTime = (value: string | Date) => new Date(value).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function FinancialCenter() {
  const router = useRouter();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const refreshCore = useCallback(async () => {
    setRefreshing(true);
    try {
      const [expRes, journalRes] = await Promise.all([
        supabase.from('expenses').select('total_price, created_at, description'),
        supabase.from('journal_lines').select('debit, credit, created_at')
      ]);
      if (expRes.error || journalRes.error) throw expRes.error || journalRes.error;

      const totalOut = expRes.data?.reduce((sum, i) => sum + (Number(i.total_price) || 0), 0) || 0;
      const totalIn = journalRes.data?.reduce((sum, i) => sum + (Number(i.credit) || 0), 0) || 0;
      const liquidityIndex = totalIn > 0 ? Number(((totalIn - totalOut) / totalIn * 100).toFixed(1)) : 0;
      setTotals({ totalIn, totalOut, netCash: totalIn - totalOut, liquidityIndex, syncedAt: new Date() });

      const all: Movement[] = [
        ...(expRes.data || []).map(e => ({ created_at: e.created_at, kind: 'expense' as const, description: e.description, amount: Number(e.total_price) || 0, side: 'out' as const })),
        ...(journalRes.data || []).map(j => {
          const credit = Number(j.credit) || 0;
          return { created_at: j.created_at, kind: 'journal' as const, amount: credit || Number(j.debit) || 0, side: credit > 0 ? 'in' as const : 'out' as const };
        })
      ];
      setMovements(all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10));
      setFailed(false);
    } catch (err) {
      console.error('financial center refresh failed:', err);
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | undefined;
    const boot = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      await refreshCore();
      channel = supabase.channel('financial_center_live')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => refreshCore())
        .subscribe();
    };
    boot();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [refreshCore, router]);

  const summary = useMemo(() => totals && <KpiStrip items={[
    { label: 'صافي النقدية', amount: totals.netCash, tone: totals.netCash >= 0 ? 'success' : 'danger', icon: <Landmark />, hint: 'المقبوضات ناقص المصروفات' },
    { label: 'إجمالي المقبوضات', amount: totals.totalIn, tone: 'info', icon: <ArrowDownLeft />, hint: 'الجانب الدائن في قيود اليومية' },
    { label: 'إجمالي المصروفات', amount: totals.totalOut, tone: 'warning', icon: <ArrowUpRight />, hint: 'كل المصروفات المسجلة' },
    { label: 'مؤشر السيولة', value: `${totals.liquidityIndex.toLocaleString('en-US')}٪`, tone: totals.liquidityIndex >= 0 ? 'brand' : 'danger', icon: <Droplets />, hint: 'صافي النقدية ÷ المقبوضات' },
  ]} />, [totals]);

  const actions = useMemo(() => <>
    <button type="button" className="ent-button ent-primary" onClick={() => void refreshCore()} disabled={refreshing}><RefreshCw size={16} aria-hidden="true" />{refreshing ? 'جاري التحديث…' : 'تحديث البيانات'}</button>
    <button type="button" className="ent-button" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />طباعة</button>
  </>, [refreshCore, refreshing]);

  return (
    <MasterPage title="المركز المالي" subtitle="صافي النقدية والمقبوضات والمصروفات مع آخر الحركات المالية">
      <RawasiSidebarManager summary={summary} actions={actions} watchDeps={[totals, refreshing]} />
      {loading ? <LoadingScreen message="جاري تحميل المركز المالي..." fullScreen={false} /> : (
        <section className="ent-panel" aria-label="آخر الحركات المالية">
          <div className="ent-panel-heading">
            <div className="ent-panel-title"><h2>آخر الحركات المالية</h2><small>أحدث {movements.length.toLocaleString('en-US')} حركة</small></div>
            <div className="ent-panel-actions">
              {totals && <small className="ent-muted">آخر تحديث: {totals.syncedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</small>}
              <span className="phi-badge is-live">مباشر</span>
            </div>
          </div>
          {failed && <div className="ent-overpaid" role="alert" style={{ margin: '1rem' }}>تعذر تحميل بيانات المركز المالي. تحقق من الاتصال ثم اضغط «تحديث البيانات».</div>}
          {movements.length ? <div className="ent-table-scroll"><table className="ent-table">
            <thead><tr><th>التاريخ والوقت</th><th>النوع</th><th>البيان</th><th>الاتجاه</th><th style={{ textAlign: 'left' }}>المبلغ</th></tr></thead>
            <tbody>{movements.map((m, i) => <tr key={`${m.created_at}-${i}`}>
              <td><span className="ent-muted">{formatDateTime(m.created_at)}</span></td>
              <td>{m.kind === 'expense' ? 'مصروف' : 'قيد يومية'}</td>
              <td>{m.description || (m.kind === 'expense' ? 'مصروف بدون بيان' : 'حركة على قيد يومية')}</td>
              <td><span className={`phi-badge ${m.side === 'in' ? 'is-in' : 'is-out'}`}>{m.side === 'in' ? 'وارد (دائن)' : m.kind === 'expense' ? 'صادر' : 'مدين'}</span></td>
              <td style={{ textAlign: 'left', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(m.amount)}</td>
            </tr>)}</tbody>
          </table></div> : <div className="ent-empty"><Scale size={32} aria-hidden="true" /><h3>لا توجد حركات مالية بعد</h3><p>ستظهر هنا أحدث المصروفات وقيود اليومية فور تسجيلها.</p></div>}
        </section>
      )}
    </MasterPage>
  );
}
