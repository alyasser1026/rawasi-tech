"use client";
import React, { useEffect, useState, useMemo } from 'react';
import MasterPage from '@/components/MasterPage';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/helpers';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import { TrendingUp, Scale } from 'lucide-react';

export default function FinancialStatementsPage() {
  const [incomeStatement, setIncomeStatement] = useState<any>(null);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatements = async () => {
    try {
      const { data, error } = await supabase.from('sys_financial_reports').select('*');
      if (error) throw error;
      
      if (data) {
        const income = data.find((d: any) => d.report_name === 'IncomeStatement');
        const balance = data.find((d: any) => d.report_name === 'BalanceSheet');
        
        if (income) {
          setIncomeStatement(income.report_data);
          setLastUpdated(new Date(income.updated_at).toLocaleString('ar-EG'));
        }
        if (balance) {
          setBalanceSheet(balance.report_data);
          if (!income) setLastUpdated(new Date(balance.updated_at).toLocaleString('ar-EG'));
        }
      }
    } catch (error) {
      console.error('Error fetching statements:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatements();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await supabase.rpc('generate_financial_reports_json');
      await fetchStatements();
    } catch (error) {
      console.error('Error refreshing statements:', error);
      await fetchStatements();
    }
  };

  const renderSection = (title: string, dataArray: any[], total: number) => {
    if (!dataArray || dataArray.length === 0) return null;
    return (
      <div className="table-wrapper" style={{ marginBottom: '20px', animation: 'fadeInUp 0.5s ease' }}>
        <h3 style={{ padding: '15px 20px', margin: 0, background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '1.1rem', color: 'var(--text-primary)' }}>{title}</h3>
        <table className="modern-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'right', padding: '12px 20px', color: 'var(--text-secondary)' }}>اسم الحساب</th>
              <th style={{ textAlign: 'left', padding: '12px 20px', color: 'var(--text-secondary)' }}>الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {dataArray.map((acc: any) => (
              <tr key={acc.id} style={{ transition: 'all 0.2s ease', cursor: 'default' }} className="hover:bg-white/5">
                <td style={{ textAlign: 'right', padding: '12px 20px', fontWeight: '500' }}>{acc.name}</td>
                <td style={{ textAlign: 'left', padding: '12px 20px' }} className="amount-cell positive">{formatCurrency(acc.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              <td style={{ textAlign: 'right', padding: '15px 20px', fontWeight: 'bold', fontSize: '1.1em', color: 'var(--text-primary)' }}>الإجمالي</td>
              <td style={{ textAlign: 'left', padding: '15px 20px', fontWeight: 'bold', fontSize: '1.1em' }} className="amount-cell positive">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const sidebarContent = useMemo(() => ({
    summary: (
      <div className="air-status-card">
          <div className="status-ping"><div className="ping-ring"></div><div className="ping-core"></div></div>
          <h3 className="status-label">FINANCIAL_NODE_LIVE</h3>
          <p className="status-sub">بيانات فورية (Cached)</p>
          <p style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>آخر تحديث:<br/>{lastUpdated || 'جاري التحميل...'}</p>
      </div>
    ),
    actions: (
      <div className="sidebar-action-stack" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button className="btn-main-glass gold" style={{ padding: '12px', fontSize: '1.1rem', fontWeight: 'bold' }} onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'جاري المزامنة...' : 'تحديث الأرقام'}
          </button>
          <button className="btn-main-glass white" style={{ padding: '12px', fontSize: '1.1rem' }} onClick={() => window.print()}>طباعة القوائم</button>
      </div>
    )
  }), [handleRefresh, refreshing, lastUpdated]);

  if (loading) return (
    <div className="air-loader-gate">
        <div className="loader-core"></div>
        <p>INITIALIZING FINANCIAL GLASS...</p>
    </div>
  );

  return (
    <MasterPage title="القوائم المالية الجاهزة" subtitle="Sovereign Control Center - Financial Glass Architecture">
      
      <div className="air-glass-wrapper">
        <style>{`
          .print-header { display: none; }
          @media print {
            body { background: white !important; color: black !important; margin: 0; padding: 0; }
            nav, aside, header, .sidebar-action-stack, .air-status-card, .mesh-gradient-aura, .RawasiSidebarManager { display: none !important; }
            .theatre-layout { display: block !important; padding: 0 !important; margin: 0 !important; }
            .theatre-main-stage { display: block !important; width: 100% !important; padding: 0 !important; }
            .glass-panel { border: none !important; box-shadow: none !important; background: transparent !important; padding: 10px !important; margin-bottom: 20px !important; page-break-inside: avoid; }
            .print-header { display: block !important; text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
            .print-header h1 { margin: 0; font-size: 24px; font-weight: bold; }
            .print-header h2 { margin: 10px 0; font-size: 20px; }
            .print-header p { margin: 0; font-size: 14px; color: #555 !important; }
            * { color: black !important; text-shadow: none !important; box-shadow: none !important; }
            .modern-table { width: 100% !important; border-collapse: collapse !important; }
            .modern-table th { background: #eee !important; color: #000 !important; border: 1px solid #aaa !important; padding: 10px !important; font-weight: bold !important; }
            .modern-table td { border: 1px solid #aaa !important; padding: 8px !important; }
            .summary-card { border: 2px solid #000 !important; padding: 15px !important; margin-top: 15px !important; background: #f9f9f9 !important; page-break-inside: avoid; text-align: center; }
            .summary-title { font-size: 1.3rem !important; font-weight: bold !important; color: #000 !important; margin-bottom: 10px; }
            .summary-value { font-size: 1.8rem !important; font-weight: bold !important; color: #000 !important; }
            @page { size: A4 landscape; margin: 1.5cm; }
          }
        `}</style>

        <div className="print-header">
           <h1>شركة فاي تك للمقاولات</h1>
           <h2>القوائم المالية (قائمة الدخل والمركز المالي)</h2>
           <p>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')} - الوقت: {new Date().toLocaleTimeString('ar-EG')}</p>
        </div>

        {/* 🪐 Mesh Aura Background */}
        <div className="mesh-gradient-aura"></div>
        
        <div className="theatre-layout">
           <RawasiSidebarManager summary={sidebarContent.summary} actions={sidebarContent.actions} watchDeps={[incomeStatement, balanceSheet]} />

           <div className="theatre-main-stage">
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '30px', alignItems: 'start' }}>
                
                {/* قائمة الدخل */}
                <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ padding: '25px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '15px', background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, transparent 100%)' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}><TrendingUp size={17} aria-hidden="true" /></div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem' }}>قائمة الدخل (Income Statement)</h2>
                  </div>

                  <div style={{ padding: '25px' }}>
                    {incomeStatement && (
                      <>
                        {renderSection('الإيرادات (Revenues)', incomeStatement.revenues, incomeStatement.total_revenue)}
                        {renderSection('المصروفات (Expenses)', incomeStatement.expenses, incomeStatement.total_expense)}

                        <div className="summary-card" style={{ 
                          marginTop: '30px',
                          background: incomeStatement.net_income >= 0 ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))' : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))', 
                          border: incomeStatement.net_income >= 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                          boxShadow: incomeStatement.net_income >= 0 ? '0 10px 30px rgba(16, 185, 129, 0.1)' : '0 10px 30px rgba(239, 68, 68, 0.1)'
                        }}>
                          <div className="summary-title" style={{ fontSize: '1.1rem', color: incomeStatement.net_income >= 0 ? '#047857' : '#be123c' }}>
                            {incomeStatement.net_income >= 0 ? 'صافي الربح (Net Income)' : 'صافي الخسارة (Net Loss)'}
                          </div>
                          <div className="summary-value amount-cell positive" style={{ fontSize: '2rem', color: incomeStatement.net_income >= 0 ? '#047857' : '#be123c' }}>
                            {formatCurrency(Math.abs(incomeStatement.net_income))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* المركز المالي */}
                <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ padding: '25px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '15px', background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, transparent 100%)' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}><Scale size={17} aria-hidden="true" /></div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem' }}>المركز المالي (Balance Sheet)</h2>
                  </div>

                  <div style={{ padding: '25px' }}>
                    {balanceSheet && (
                      <>
                        {renderSection('الأصول (Assets)', balanceSheet.assets, balanceSheet.total_assets)}
                        {renderSection('الالتزامات (Liabilities)', balanceSheet.liabilities, balanceSheet.total_liabilities)}
                        {renderSection('حقوق الملكية (Equity)', balanceSheet.equity, balanceSheet.total_equity)}

                        <div className="summary-card" style={{ 
                          marginTop: '30px',
                          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))', 
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          boxShadow: '0 10px 30px rgba(59, 130, 246, 0.1)'
                        }}>
                          <div className="summary-title" style={{ fontSize: '1.1rem', color: '#1d4ed8' }}>إجمالي الالتزامات وحقوق الملكية + الدخل</div>
                          <div className="summary-value amount-cell positive" style={{ fontSize: '2rem', color: '#1d4ed8' }}>
                            {formatCurrency(balanceSheet.total_liabilities_and_equity)}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

              </div>
           </div>
        </div>
      </div>
    </MasterPage>
  );
}
