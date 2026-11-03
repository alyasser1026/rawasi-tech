"use client";
import React, { useMemo, useEffect, useState } from 'react';
import { useStatementLogic } from './statement_logic';
import { THEME } from '@/lib/theme';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import RawasiSmartTable from '@/components/rawasismarttable';
import SmartCombo from '@/components/SmartCombo';
import SecureAction from '@/components/SecureAction';
import { formatCurrency, formatDate } from '@/lib/helpers';
import StatementPrintModal from './StatementPrintModal'; 
import ExportLoadingModal from '@/components/ExportLoadingModal'; 

import { Suspense } from 'react';

function PartnerStatementContent() {
    const logic = useStatementLogic();
    const [mounted, setMounted] = useState(false);
    
    // 🚀 حالة التحكم في المودال (الطباعة الفردية)
    const [isPrintOpen, setIsPrintOpen] = useState(false);
    const [selectedPartnerName, setSelectedPartnerName] = useState('');

    useEffect(() => { setMounted(true); }, []);

    // 🚀 حساب المسميات بشكل ديناميكي بناءً على حالة التواريخ
    const isPeriodSelected = Boolean(logic.dateFrom || logic.dateTo);
    const summarySuffix = isPeriodSelected ? 'للفترة المحددة' : '(تراكمي نهائي)';
    const netTitle = isPeriodSelected ? 'صافي حساب الفترة المحددة' : 'صافي الحساب (النهائي)';

    const columns = useMemo(() => [
        { 
            header: 'التاريخ', 
            accessor: 'date', 
            render: (row: any) => {
                if (!row) return null; 
                return <span style={{fontWeight: 700, color: '#8a7a6b'}}>{row.date === '---' ? '---' : formatDate(row.date)}</span>;
            }
        },
        { 
            header: 'النوع', 
            accessor: 'v_type', 
            render: (row: any) => {
                if (!row) return null; 
                
                let badgeColor = 'green'; 
                if (row.v_type === 'سند صرف' || row.v_type === 'قيد غرامة') badgeColor = 'red';
                else if (row.v_type === 'يومية عمالة') badgeColor = 'blue';
                else if (row.v_type === 'رصيد سابق') badgeColor = 'sand';

                return (
                    <span className={`badge-glass ${badgeColor}`}>
                        {row.v_type}
                    </span>
                );
            }
        },
        { 
            header: 'البيان / الوصف', 
            accessor: 'description', 
            render: (row: any) => {
                if (!row) return null; 
                return <span style={{fontSize: '13px', fontWeight: 800, color: '#2c221b'}}>{row.description}</span>;
            }
        },
        { 
            header: 'مدين (عليه)', 
            accessor: 'debit', 
            render: (row: any) => {
                if (!row) return null; 
                return row.debit > 0 ? <strong style={{color: THEME.danger}}>{formatCurrency(row.debit)}</strong> : '-';
            }
        },
        { 
            header: 'دائن (له)', 
            accessor: 'credit', 
            render: (row: any) => {
                if (!row) return null; 
                return row.credit > 0 ? <strong style={{color: THEME.success}}>{formatCurrency(row.credit)}</strong> : '-';
            }
        },
        { 
            header: 'الرصيد التراكمي', 
            accessor: 'balance', 
            render: (row: any) => {
                if (!row) return null; 
                return (
                    <div style={{
                        background: 'rgba(194,65,12, 0.1)', border: '1px solid rgba(194,65,12, 0.2)',
                        padding: '5px 10px', borderRadius: '8px', fontWeight: 900, textAlign: 'center',
                        color: row.balance >= 0 ? THEME.success : THEME.danger
                    }}>
                        {formatCurrency(Math.abs(row.balance))}
                        <small style={{marginRight: '5px', fontSize: '10px', color: '#8a7a6b'}}>{row.balance >= 0 ? '(له)' : '(عليه)'}</small>
                    </div>
                );
            }
        }
    ], []);

    const tableData = useMemo(() => {
        if (!logic.partnerId || logic.isLoading) return [];
        const openingRow = { 
            id: 'opening', date: logic.dateFrom || '---', 
            description: '🔹 رصيد افتتاحي للمبالغ السابقة (ما قبل الفترة المختارة)', v_type: 'رصيد سابق', 
            debit: logic.openingBalance < 0 ? Math.abs(logic.openingBalance) : 0, 
            credit: logic.openingBalance > 0 ? logic.openingBalance : 0, balance: logic.openingBalance 
        };
        return [openingRow, ...(logic.statementLines ?? [])];
    }, [logic.statementLines, logic.openingBalance, logic.isLoading, logic.partnerId, logic.dateFrom]);

    const sidebarActions = useMemo(() => (
        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            <button type="button" onClick={() => setIsPrintOpen(true)} className="btn-main-glass white" disabled={!logic.partnerId}>
                🖨️ معاينة وطباعة الكشف
            </button>
            <SecureAction module="statements" action="export">
                <button type="button" onClick={() => logic.exportToExcel(selectedPartnerName)} className="btn-main-glass gold" disabled={!logic.partnerId}>
                    📥 تصدير Excel للشريك
                </button>
            </SecureAction>

            <hr style={{ borderColor: 'rgba(194,65,12, 0.2)', margin: '5px 0' }} />

            {/* 🚀 تم التحديث للدالة الجديدة downloadIndividualWorkerPDFs اللي بتضغط في ملف ZIP */}
            <SecureAction module="statements" action="export">
                <button 
                    type="button" 
                    onClick={logic.downloadIndividualWorkerPDFs} 
                    className="btn-main-glass" 
                    style={{ background: '#0284C7', color: 'white', borderColor: '#0369A1' }}
                    disabled={logic.isExportingAll}
                >
                    {logic.isExportingAll ? '⏳ جاري المعالجة...' : '📦 تحميل جميع الكشوفات (ملف ZIP)'}
                </button>
            </SecureAction>
        </div>
    ), [logic.partnerId, selectedPartnerName, logic.exportToExcel, logic.downloadIndividualWorkerPDFs, logic.isExportingAll]); 

    if (!mounted) return null;

    return (
        <div className="clean-page">
            <MasterPage icon="📑" title="كشف حساب الشركاء" subtitle="تحليل مالي ملكي بنظام فاي تك الماسي">
                
                <RawasiSidebarManager actions={sidebarActions} watchDeps={[logic.partnerId, logic.isExportingAll]} />

                <div className="main-content-flow">
                    <div className="filter-dashboard-glass" style={{ position: 'relative', zIndex: 50 }}>
                        <div className="filter-header"><span className="filter-title">🔍 أدوات البحث والتصفية المتقدمة</span></div>
                        <div className="filters-grid">
                            <div className="filter-col" style={{ position: 'relative', zIndex: 100 }}>
                                <label>👤 الشريك (عامل / مقاول / مورد)</label>
                                <SmartCombo 
                                    label="" table="partners" displayCol="name" initialDisplay={logic.partnerName || logic.partnerId} 
                                    onSelect={(v: any) => { logic.setPartnerId(v?.id || ''); setSelectedPartnerName(v?.name || ''); }} 
                                />
                            </div>
                            <div className="filter-col"><label>📅 من تاريخ</label><input type="date" className="glass-input" value={logic.dateFrom} onChange={e => logic.setDateFrom(e.target.value)} /></div>
                            <div className="filter-col"><label>📅 إلى تاريخ</label><input type="date" className="glass-input" value={logic.dateTo} onChange={e => logic.setDateTo(e.target.value)} /></div>
                            <div className="filter-col"><label>🔎 بحث في الكشف</label><input type="text" className="glass-input search-input" placeholder="ابحث في البيان..." value={logic.globalSearch || ''} onChange={e => logic.setGlobalSearch(e.target.value)} /></div>
                        </div>
                    </div>

                    {logic.partnerId && (
                        <div className="glass-panel summary-container">
                            <div className="balances-grid" style={{ gridTemplateColumns: '1fr 1fr 1.5fr' }}>
                                <div className="grid-box green"><small>كل الدائن (له) {summarySuffix}</small><span>{formatCurrency(logic.totalCredit)}</span></div>
                                <div className="grid-box red"><small>كل المدين (عليه) {summarySuffix}</small><span>{formatCurrency(logic.totalDebit)}</span></div>
                                <div className="grid-box blue final-balance">
                                    <small>{netTitle}</small>
                                    <span style={{ color: logic.periodNet >= 0 ? '#4ade80' : '#f87171' }}>
                                        {formatCurrency(Math.abs(logic.periodNet))}<small style={{fontSize: '14px', marginLeft: '5px'}}>{logic.periodNet >= 0 ? '(له)' : '(عليه)'}</small>
                                    </span>
                                    {isPeriodSelected && (
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#d4c4a8', fontWeight: 800, borderTop: '1px dashed rgba(194,65,12, 0.2)', paddingTop: '8px' }}>
                                            الرصيد التراكمي (النهائي): {formatCurrency(Math.abs(logic.currentBalance))} <span style={{fontSize: '10px'}}>{logic.currentBalance >= 0 ? '(له)' : '(عليه)'}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <hr className="glass-divider" />
                            <div className="dashboard-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                                <div className="stat-box cyan-outline"><small>🗓️ عدد أيام الحضور</small><span style={{ fontSize: '24px' }}>{logic.attendanceCount} <small style={{fontSize:'14px', opacity:0.8}}>يوم</small></span></div>
                                <div className="stat-box dark-red"><small>⚠️ إجمالي الغرامات (عليه)</small><span style={{ fontSize: '24px', color: '#fca5a5' }}>{formatCurrency(logic.totalViolations)}</span></div>
                            </div>
                        </div>
                    )}

                    {!logic.partnerId ? (
                        <div className="welcome-placeholder"><div className="icon">🧾</div><h3>يرجى اختيار شريك لعرض كشف الحساب</h3></div>
                    ) : (
                        <div className="table-wrapper-glass"><RawasiSmartTable data={tableData} columns={columns} isLoading={logic.isLoading} enablePagination={false} /></div>
                    )}
                </div>
            </MasterPage>

            <StatementPrintModal 
                isOpen={isPrintOpen} onClose={() => setIsPrintOpen(false)} partnerName={logic.partnerName || selectedPartnerName}
                dateFrom={logic.dateFrom} dateTo={logic.dateTo} openingBalance={logic.openingBalance}
                currentBalance={logic.currentBalance} totalDebit={logic.totalDebit} totalCredit={logic.totalCredit}
                attendanceCount={logic.attendanceCount} totalLaborAmount={logic.totalLaborAmount}
                totalPayments={logic.totalPayments} totalViolations={logic.totalViolations} statementLines={logic.statementLines} 
            />

            <ExportLoadingModal 
                isOpen={logic.isExportingAll} 
                progressText={logic.exportProgress} 
            />

            <style>{`
                .main-content-flow { display: flex; flex-direction: column; gap: 20px; width: 100%; }
                .glass-panel { background: linear-gradient(135deg, rgba(74, 59, 50, 0.85) 0%, rgba(44, 34, 27, 0.95) 100%); backdrop-filter: blur(15px); border: 1px solid rgba(194,65,12, 0.15); border-top: 1px solid rgba(194,65,12, 0.3); border-radius: 20px; padding: 25px; color: #f3e5d8; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
                .glass-divider { border: 0; height: 1px; background: rgba(194,65,12, 0.1); margin: 20px 0; }
                .balances-grid { display: grid; gap: 15px; }
                .grid-box { padding: 20px; border-radius: 16px; text-align: center; background: rgba(212, 196, 168, 0.05); border: 1px solid rgba(212, 196, 168, 0.1); display: flex; flex-direction: column; justify-content: center; }
                .grid-box.green { border-bottom: 3px solid #22c55e; }
                .grid-box.red { border-bottom: 3px solid #ef4444; }
                .grid-box.blue { border-bottom: 3px solid #3b82f6; } 
                .grid-box.gold { border-bottom: 3px solid ${THEME.goldAccent}; background: rgba(194,65,12, 0.05); }
                .grid-box small { font-size: 12px; color: #d4c4a8; font-weight: 900; margin-bottom: 8px; }
                .grid-box span { font-size: 22px; font-weight: 900; }
                .final-balance span { font-size: 30px; }
                .dashboard-stats-grid { display: grid; gap: 15px; }
                .stat-box { padding: 15px; border-radius: 12px; text-align: center; background: rgba(20, 15, 12, 0.4); border: 1px dashed rgba(194,65,12, 0.2); display: flex; flex-direction: column; justify-content: center; }
                .stat-box.cyan-outline { border-bottom: 3px solid #06b6d4; background: rgba(6, 182, 212, 0.05); }
                .stat-box.dark-red { border-bottom: 3px solid #b91c1c; background: rgba(185, 28, 28, 0.1); }
                .stat-box small { font-size: 13px; color: #bba58f; display: block; margin-bottom: 8px; font-weight: 900; }
                .stat-box span { font-size: 18px; font-weight: 900; color: white; }
                .filter-dashboard-glass { background: linear-gradient(135deg, rgba(62, 49, 40, 0.85) 0%, rgba(44, 34, 27, 0.95) 100%); backdrop-filter: blur(15px); border: 1px solid rgba(194,65,12, 0.2); border-top: 1px solid rgba(194,65,12, 0.4); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4); padding: 20px 25px; border-radius: 20px; }
                .filter-title { font-size: 14px; font-weight: 900; color: ${THEME.goldAccent}; text-transform: uppercase; }
                .filters-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr; gap: 20px; align-items: end; }
                .filter-col label { font-size: 12px; font-weight: 900; color: #d4c4a8; margin-bottom: 8px; display: block; }
                .glass-input { width: 100%; padding: 12px 15px; border-radius: 12px; border: 1px solid rgba(194,65,12, 0.2); background: rgba(20, 15, 12, 0.5); color: #f3e5d8; outline: none; transition: 0.3s; font-size: 13px; font-weight: 800; }
                .glass-input:focus { border-color: ${THEME.goldAccent}; background: rgba(44, 34, 27, 0.8); }
                .badge-glass { padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 900; display: inline-block; }
                .badge-glass.red { background: #fef2f2; color: #ef4444; }
                .badge-glass.green { background: #f0fdf4; color: #16a34a; }
                .badge-glass.blue { background: #eff6ff; color: #3b82f6; }
                .badge-glass.sand { background: #fdfaf6; color: #8a7a6b; border: 1px solid #eaddcf; }
                .btn-main-glass { width: 100%; padding: 14px; border-radius: 16px; border: 1px solid rgba(194,65,12, 0.3); backdrop-filter: blur(15px); font-weight: 900; cursor: pointer; transition: 0.2s; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px; }
                .btn-main-glass.gold { background: linear-gradient(135deg, rgba(194,65,12, 0.9), rgba(194,65,12, 1)); color: white; }
                .btn-main-glass.white { background: rgba(243, 229, 216, 0.9); color: #2c221b; }
                .btn-main-glass:disabled { opacity: 0.5; cursor: not-allowed; }
                .welcome-placeholder { text-align: center; padding: 100px; color: #bba58f; background: rgba(44, 34, 27, 0.4); border-radius: 20px; border: 1px dashed rgba(194,65,12, 0.3); }
                .welcome-placeholder .icon { font-size: 64px; margin-bottom: 20px; color: ${THEME.goldAccent}; }
                .table-wrapper-glass { background: rgba(255, 255, 255, 0.95); border-radius: 20px; overflow: hidden; padding: 10px; border: 1px solid rgba(194,65,12, 0.2); box-shadow: 0 5px 20px rgba(0,0,0,0.05); }
            `}</style>
        </div>
    );
}

export default function PartnerStatementPage() {
    return (
        <Suspense fallback={<div style={{ padding: '50px', textAlign: 'center' }}>جاري التحميل...</div>}>
            <PartnerStatementContent />
        </Suspense>
    );
}