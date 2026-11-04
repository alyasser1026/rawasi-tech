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
import { ReceiptText } from 'lucide-react';

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
                return <span style={{fontSize: 'var(--fs-sm)', fontWeight: 800, color: '#2c221b'}}>{row.description}</span>;
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
                        <small style={{marginRight: '5px', fontSize: 'var(--fs-xs)', color: '#8a7a6b'}}>{row.balance >= 0 ? '(له)' : '(عليه)'}</small>
                    </div>
                );
            }
        }
    ], []);

    const tableData = useMemo(() => {
        if (!logic.partnerId || logic.isLoading) return [];
        const openingRow = { 
            id: 'opening', date: logic.dateFrom || '---', 
            description: 'رصيد افتتاحي للمبالغ السابقة (ما قبل الفترة المختارة)', v_type: 'رصيد سابق', 
            debit: logic.openingBalance < 0 ? Math.abs(logic.openingBalance) : 0, 
            credit: logic.openingBalance > 0 ? logic.openingBalance : 0, balance: logic.openingBalance 
        };
        return [openingRow, ...(logic.statementLines ?? [])];
    }, [logic.statementLines, logic.openingBalance, logic.isLoading, logic.partnerId, logic.dateFrom]);

    const sidebarActions = useMemo(() => (
        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            <button type="button" onClick={() => setIsPrintOpen(true)} className="btn-main-glass white" disabled={!logic.partnerId}>
                معاينة وطباعة الكشف
            </button>
            <SecureAction module="statements" action="export">
                <button type="button" onClick={() => logic.exportToExcel(selectedPartnerName)} className="btn-main-glass gold" disabled={!logic.partnerId}>
                    تصدير Excel للشريك
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
                    {logic.isExportingAll ? 'جاري المعالجة...' : 'تحميل جميع الكشوفات (ملف ZIP)'}
                </button>
            </SecureAction>
        </div>
    ), [logic.partnerId, selectedPartnerName, logic.exportToExcel, logic.downloadIndividualWorkerPDFs, logic.isExportingAll]); 

    if (!mounted) return null;

    return (
        <div className="clean-page">
            <MasterPage title="كشف حساب الشركاء" subtitle="تحليل مالي ملكي بنظام فاي تك الماسي">
                
                <RawasiSidebarManager actions={sidebarActions} watchDeps={[logic.partnerId, logic.isExportingAll]} />

                <div className="main-content-flow">
                    <div className="filter-dashboard-glass" style={{ position: 'relative', zIndex: 50 }}>
                        <div className="filter-header"><span className="filter-title">أدوات البحث والتصفية المتقدمة</span></div>
                        <div className="filters-grid">
                            <div className="filter-col" style={{ position: 'relative', zIndex: 100 }}>
                                <label>الشريك (عامل / مقاول / مورد)</label>
                                <SmartCombo 
                                    label="" table="partners" displayCol="name" initialDisplay={logic.partnerName || logic.partnerId} 
                                    onSelect={(v: any) => { logic.setPartnerId(v?.id || ''); setSelectedPartnerName(v?.name || ''); }} 
                                />
                            </div>
                            <div className="filter-col"><label>من تاريخ</label><input type="date" className="glass-input" value={logic.dateFrom} onChange={e => logic.setDateFrom(e.target.value)} /></div>
                            <div className="filter-col"><label>إلى تاريخ</label><input type="date" className="glass-input" value={logic.dateTo} onChange={e => logic.setDateTo(e.target.value)} /></div>
                            <div className="filter-col"><label>بحث في الكشف</label><input type="text" className="glass-input search-input" placeholder="ابحث في البيان..." value={logic.globalSearch || ''} onChange={e => logic.setGlobalSearch(e.target.value)} /></div>
                        </div>
                    </div>

                    {logic.partnerId && (
                        <div className="glass-panel summary-container">
                            <div className="balances-grid" style={{ gridTemplateColumns: '1fr 1fr 1.5fr' }}>
                                <div className="grid-box green"><small>كل الدائن (له) {summarySuffix}</small><span>{formatCurrency(logic.totalCredit)}</span></div>
                                <div className="grid-box red"><small>كل المدين (عليه) {summarySuffix}</small><span>{formatCurrency(logic.totalDebit)}</span></div>
                                <div className="grid-box blue final-balance">
                                    <small>{netTitle}</small>
                                    <span style={{ color: logic.periodNet >= 0 ? '#047857' : '#be123c' }}>
                                        {formatCurrency(Math.abs(logic.periodNet))}<small style={{fontSize: 'var(--fs-md)', marginLeft: '5px'}}>{logic.periodNet >= 0 ? '(له)' : '(عليه)'}</small>
                                    </span>
                                    {isPeriodSelected && (
                                        <div className="cumulative-balance">
                                            الرصيد التراكمي (النهائي): {formatCurrency(Math.abs(logic.currentBalance))} <span style={{fontSize: 'var(--fs-xs)'}}>{logic.currentBalance >= 0 ? '(له)' : '(عليه)'}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <hr className="glass-divider" />
                            <div className="dashboard-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                                <div className="stat-box cyan-outline"><small>عدد أيام الحضور</small><span style={{ fontSize: 'var(--fs-2xl)' }}>{logic.attendanceCount} <small style={{fontSize:'var(--fs-md)', opacity:0.8}}>يوم</small></span></div>
                                <div className="stat-box dark-red"><small>إجمالي الغرامات (عليه)</small><span style={{ fontSize: 'var(--fs-2xl)' }}>{formatCurrency(logic.totalViolations)}</span></div>
                            </div>
                        </div>
                    )}

                    {!logic.partnerId ? (
                        <div className="welcome-placeholder"><div className="icon"><ReceiptText size={26} aria-hidden="true" /></div><h3>يرجى اختيار شريك لعرض كشف الحساب</h3></div>
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
                .glass-panel.summary-container { padding: 22px; color: #202329; }
                .glass-divider { border: 0; height: 1px; background: #e6e8ec; margin: 20px 0; }
                .balances-grid { display: grid; gap: 14px; }
                .grid-box { padding: 18px; border-radius: 12px; text-align: center; background: #fff; border: 1px solid #e3e7ed; display: flex; flex-direction: column; justify-content: center; }
                .grid-box.green { border-bottom: 3px solid #047857; }
                .grid-box.green span { color: #047857; }
                .grid-box.red { border-bottom: 3px solid #be123c; }
                .grid-box.red span { color: #be123c; }
                .grid-box.blue { border-bottom: 3px solid #1d4ed8; }
                .grid-box.gold { border-bottom: 3px solid ${THEME.goldAccent}; background: #fff7ed; }
                .grid-box small { font-size: var(--fs-sm); color: #687180; font-weight: 800; margin-bottom: 8px; }
                .grid-box span { font-size: var(--fs-2xl); font-weight: 800; font-variant-numeric: tabular-nums; }
                .final-balance span { font-size: var(--fs-3xl); }
                .final-balance .cumulative-balance { margin-top: 8px; font-size: var(--fs-sm); color: #687180; font-weight: 700; border-top: 1px dashed #dce2ea; padding-top: 8px; }
                .dashboard-stats-grid { display: grid; gap: 14px; }
                .stat-box { padding: 15px; border-radius: 12px; text-align: center; background: #f8fafc; border: 1px solid #e3e7ed; display: flex; flex-direction: column; justify-content: center; }
                .stat-box.cyan-outline { border-bottom: 3px solid #0e7490; }
                .stat-box.dark-red { border-bottom: 3px solid #be123c; }
                .stat-box small { font-size: var(--fs-sm); color: #687180; display: block; margin-bottom: 8px; font-weight: 800; }
                .stat-box span { font-size: var(--fs-xl); font-weight: 800; color: #202329; font-variant-numeric: tabular-nums; }
                .stat-box.dark-red span { color: #be123c; }
                .filter-dashboard-glass { background: linear-gradient(180deg, #ffffff, #f8fafc); border: 1px solid #e0e5ed; box-shadow: var(--ent-card-elevation, 0 1px 3px #25344a0a); padding: 18px 20px; border-radius: var(--phi-radius-card, 14px); }
                .filter-header { margin-bottom: 14px; }
                .filter-title { font-size: var(--fs-md); font-weight: 800; color: #202329; }
                .filters-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr; gap: 16px; align-items: end; }
                .filter-col label { font-size: var(--fs-sm); font-weight: 700; color: #657080; margin-bottom: 7px; display: block; }
                .glass-input { width: 100%; min-height: 42px; padding: 10px 12px; border-radius: 8px; border: 1px solid #dce2ea; background: #fff; color: #303a48; color-scheme: light; outline: none; transition: border-color 150ms ease, box-shadow 150ms ease; font-size: var(--fs-sm); font-weight: 600; }
                .glass-input:focus { border-color: ${THEME.goldAccent}; box-shadow: 0 0 0 3px #c2410c14; }
                .badge-glass { padding: 4px 10px; border-radius: 8px; font-size: var(--fs-xs); font-weight: 800; display: inline-block; }
                .badge-glass.red { background: #fff1f2; color: #be123c; }
                .badge-glass.green { background: #ecfdf5; color: #047857; }
                .badge-glass.blue { background: #eff6ff; color: #1d4ed8; }
                .badge-glass.sand { background: #f8fafc; color: #4b5563; border: 1px solid #e3e7ed; }
                .btn-main-glass:disabled { opacity: 0.55; cursor: not-allowed; }
                .welcome-placeholder { text-align: center; padding: 72px 24px; color: #4b5563; background: #fff; border-radius: var(--phi-radius-card, 14px); border: 1px dashed #d6dce5; }
                .welcome-placeholder .icon { display: inline-grid; place-items: center; width: 56px; height: 56px; margin-bottom: 16px; border-radius: 14px; background: #fff7ed; color: ${THEME.goldAccent}; }
                .welcome-placeholder h3 { margin: 0; font-size: var(--fs-lg); font-weight: 700; }
                .table-wrapper-glass { background: #fff; border-radius: var(--phi-radius-card, 14px); overflow: hidden; padding: 10px; border: 1px solid #e0e5ed; box-shadow: var(--ent-card-elevation, 0 1px 3px #25344a0a); }
                @media (max-width: 900px) {
                    .filters-grid { grid-template-columns: 1fr 1fr; }
                    .balances-grid { grid-template-columns: 1fr !important; }
                }
                @media (max-width: 560px) { .filters-grid { grid-template-columns: 1fr; } }
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