"use client";
import React, { useMemo, useEffect, useState } from 'react';
import { useStatementLogic } from './statement_logic';
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
                return <span style={{fontWeight: 800, color: 'var(--text-secondary)'}}>{row.date === '---' ? '---' : formatDate(row.date)}</span>;
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
                return <span style={{fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-primary)'}}>{row.description}</span>;
            }
        },
        { 
            header: 'مدين (عليه)', 
            accessor: 'debit', 
            render: (row: any) => {
                if (!row) return null; 
                return row.debit > 0 ? <strong style={{color: 'var(--status-negative)', fontVariantNumeric: 'tabular-nums'}}>{formatCurrency(row.debit)}</strong> : '-';
            }
        },
        { 
            header: 'دائن (له)', 
            accessor: 'credit', 
            render: (row: any) => {
                if (!row) return null; 
                return row.credit > 0 ? <strong style={{color: 'var(--status-positive)', fontVariantNumeric: 'tabular-nums'}}>{formatCurrency(row.credit)}</strong> : '-';
            }
        },
        { 
            header: 'الرصيد التراكمي', 
            accessor: 'balance', 
            render: (row: any) => {
                if (!row) return null; 
                return (
                    <div style={{
                        background: 'var(--surface-sunken)',
                        boxShadow: 'var(--shadow-sunken)',
                        border: 'none',
                        padding: '0.375rem 0.625rem',
                        borderRadius: '10px',
                        fontWeight: 900,
                        textAlign: 'center',
                        color: row.balance >= 0 ? 'var(--status-positive)' : 'var(--status-negative)',
                        fontVariantNumeric: 'tabular-nums'
                    }}>
                        {formatCurrency(Math.abs(row.balance))}
                        <small style={{marginRight: '0.375rem', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)'}}>{row.balance >= 0 ? '(له)' : '(عليه)'}</small>
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
        <div style={{display: 'flex', flexDirection: 'column', gap: '0.625rem'}}>
            <button 
                type="button" 
                onClick={() => setIsPrintOpen(true)} 
                className="ent-button" 
                style={{ background: 'var(--surface-subcard)', color: 'var(--text-primary)', border: 'none', boxShadow: 'var(--shadow-elevation)', borderRadius: '12px', fontWeight: 800 }}
                disabled={!logic.partnerId}
            >
                معاينة وطباعة الكشف
            </button>
            <SecureAction module="statements" action="export">
                <button 
                    type="button" 
                    onClick={() => logic.exportToExcel(selectedPartnerName)} 
                    className="ent-button ent-primary" 
                    style={{ border: 'none', borderRadius: '12px', fontWeight: 900 }}
                    disabled={!logic.partnerId}
                >
                    تصدير Excel للشريك
                </button>
            </SecureAction>

            <hr style={{ borderColor: 'var(--table-zebra-bg)', margin: '0.3125rem 0' }} />

            <SecureAction module="statements" action="export">
                <button 
                    type="button" 
                    onClick={logic.downloadIndividualWorkerPDFs} 
                    className="ent-button" 
                    style={{ background: 'var(--accent-soft-bg)', color: 'var(--accent-ink)', border: 'none', boxShadow: 'var(--shadow-elevation)', borderRadius: '12px', fontWeight: 800 }}
                    disabled={logic.isExportingAll}
                >
                    {logic.isExportingAll ? 'جاري المعالجة...' : 'تحميل جميع الكشوفات (ملف ZIP)'}
                </button>
            </SecureAction>
        </div>
    ), [logic.partnerId, selectedPartnerName, logic.exportToExcel, logic.downloadIndividualWorkerPDFs, logic.isExportingAll]); 

    if (!mounted) return null;

    return (
        <div className="clean-page enterprise-page">
            <MasterPage title="كشف حساب الشركاء" subtitle="تحليل مالي متكامل بنظام فاي تك المحاسبي">
                
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
                                    <span style={{ color: logic.periodNet >= 0 ? 'var(--status-positive)' : 'var(--status-negative)' }}>
                                        {formatCurrency(Math.abs(logic.periodNet))}<small style={{fontSize: 'var(--fs-md)', marginLeft: '0.3125rem'}}>{logic.periodNet >= 0 ? '(له)' : '(عليه)'}</small>
                                    </span>
                                    {isPeriodSelected && (
                                        <div className="cumulative-balance">
                                            الرصيد التراكمي (النهائي): {formatCurrency(Math.abs(logic.currentBalance))} <span style={{fontSize: 'var(--fs-xs)'}}>{logic.currentBalance >= 0 ? '(له)' : '(عليه)'}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <hr className="glass-divider" />
                            <div className="dashboard-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))' }}>
                                <div className="stat-box cyan-outline"><small>عدد أيام الحضور</small><span style={{ fontSize: 'var(--fs-2xl)' }}>{logic.attendanceCount} <small style={{fontSize:'var(--fs-md)', opacity:0.8}}>يوم</small></span></div>
                                <div className="stat-box dark-red"><small>إجمالي الغرامات (عليه)</small><span style={{ fontSize: 'var(--fs-2xl)' }}>{formatCurrency(logic.totalViolations)}</span></div>
                            </div>
                        </div>
                    )}

                    {!logic.partnerId ? (
                        <div className="welcome-placeholder">
                            <div className="icon"><ReceiptText size={26} aria-hidden="true" /></div>
                            <h3>يرجى اختيار شريك لعرض كشف الحساب</h3>
                        </div>
                    ) : (
                        <div className="table-wrapper-glass">
                            <RawasiSmartTable data={tableData} columns={columns} isLoading={logic.isLoading} enablePagination={false} />
                        </div>
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
                .main-content-flow { display: flex; flex-direction: column; gap: 1.25rem; width: 100%; }
                
                /* صندوق الفلاتر الراقي بنظام Obsidian Ceramic */
                .filter-dashboard-glass {
                    background: var(--surface-card) !important;
                    border: none !important;
                    box-shadow: var(--shadow-ambient) !important;
                    padding: 1.25rem 1.5rem !important;
                    border-radius: var(--phi-radius-card, 18px) !important;
                    position: relative !important;
                    overflow: hidden !important;
                }
                .filter-dashboard-glass::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 8%; right: 8%;
                    height: 1.5px;
                    background: var(--specular-beam);
                    pointer-events: none;
                    z-index: 5;
                }
                .filter-header { margin-bottom: 0.875rem; }
                .filter-title { font-size: var(--fs-md); font-weight: 800; color: var(--text-primary); }
                .filters-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr; gap: 1rem; align-items: end; }
                .filter-col label { font-size: var(--fs-xs); font-weight: 800; color: var(--text-secondary); margin-bottom: 0.375rem; display: block; }
                
                .glass-input {
                    width: 100%;
                    height: 2.75rem;
                    min-height: 2.75rem;
                    padding: 0 0.875rem;
                    border-radius: 12px;
                    border: none !important;
                    background: var(--surface-sunken) !important;
                    box-shadow: var(--shadow-sunken) !important;
                    color: var(--text-primary) !important;
                    outline: none !important;
                    font-size: var(--fs-sm);
                    font-weight: 800;
                    transition: box-shadow 150ms ease;
                }
                .glass-input:focus-visible, .glass-input:focus {
                    outline: 2px solid var(--accent-main);
                    outline-offset: 1px;
                }

                /* بطاقات ملخص الحساب */
                .glass-panel.summary-container {
                    background: var(--surface-card) !important;
                    border: none !important;
                    box-shadow: var(--shadow-ambient) !important;
                    border-radius: var(--phi-radius-card, 18px) !important;
                    position: relative !important;
                    overflow: hidden !important;
                    padding: 1.375rem !important;
                    color: var(--text-primary) !important;
                }
                .glass-panel.summary-container::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 8%; right: 8%;
                    height: 1.5px;
                    background: var(--specular-beam);
                    pointer-events: none;
                    z-index: 5;
                }
                .glass-divider { border: 0; height: 1px; background: var(--table-zebra-bg); margin: 1.25rem 0; }
                .balances-grid { display: grid; gap: 0.875rem; }
                .grid-box {
                    padding: 1.125rem;
                    border-radius: 14px;
                    text-align: center;
                    background: var(--surface-subcard) !important;
                    border: none !important;
                    box-shadow: var(--shadow-elevation) !important;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                }
                .grid-box.green {
                    background: radial-gradient(ellipse 90% 70% at 50% -20%, color-mix(in srgb, var(--status-positive) 14%, transparent), transparent 75%), var(--surface-subcard) !important;
                }
                .grid-box.green span { color: var(--status-positive) !important; }
                .grid-box.red {
                    background: radial-gradient(ellipse 90% 70% at 50% -20%, color-mix(in srgb, var(--status-negative) 14%, transparent), transparent 75%), var(--surface-subcard) !important;
                }
                .grid-box.red span { color: var(--status-negative) !important; }
                .grid-box.blue {
                    background: radial-gradient(ellipse 90% 70% at 50% -20%, color-mix(in srgb, var(--action-fill) 16%, transparent), transparent 75%), var(--surface-subcard) !important;
                }
                .grid-box small { font-size: var(--fs-xs); color: var(--text-secondary); font-weight: 800; margin-bottom: 0.5rem; }
                .grid-box span { font-size: var(--fs-2xl); font-weight: 900; font-variant-numeric: tabular-nums; }
                .final-balance span { font-size: var(--fs-3xl); }
                .final-balance .cumulative-balance { margin-top: 0.5rem; font-size: var(--fs-xs); color: var(--text-secondary); font-weight: 800; border-top: 1px dashed var(--table-zebra-bg); padding-top: 0.5rem; }
                
                .dashboard-stats-grid { display: grid; gap: 0.875rem; }
                .stat-box {
                    padding: 0.9375rem;
                    border-radius: 12px;
                    text-align: center;
                    background: var(--surface-subcard) !important;
                    border: none !important;
                    box-shadow: var(--shadow-elevation) !important;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                .stat-box small { font-size: var(--fs-xs); color: var(--text-secondary); display: block; margin-bottom: 0.375rem; font-weight: 800; }
                .stat-box span { font-size: var(--fs-xl); font-weight: 900; color: var(--text-primary); font-variant-numeric: tabular-nums; }
                .stat-box.dark-red span { color: var(--status-negative) !important; }

                /* حالة عدم اختيار شريك (Empty State) */
                .welcome-placeholder {
                    text-align: center;
                    padding: 4.5rem 1.5rem;
                    color: var(--text-secondary);
                    background: var(--surface-card) !important;
                    border-radius: var(--phi-radius-card, 18px) !important;
                    border: none !important;
                    box-shadow: var(--shadow-ambient) !important;
                    position: relative !important;
                    overflow: hidden !important;
                }
                .welcome-placeholder::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 8%; right: 8%;
                    height: 1.5px;
                    background: var(--specular-beam);
                    pointer-events: none;
                }
                .welcome-placeholder .icon {
                    display: inline-grid;
                    place-items: center;
                    width: 3.5rem;
                    height: 3.5rem;
                    margin-bottom: 1rem;
                    border-radius: 16px;
                    background: var(--accent-soft-bg);
                    color: var(--accent-ink);
                    box-shadow: var(--shadow-elevation);
                }
                .welcome-placeholder h3 { margin: 0; font-size: var(--fs-lg); font-weight: 800; color: var(--text-primary); }

                /* حاوية الجدول */
                .table-wrapper-glass {
                    background: var(--surface-card) !important;
                    border-radius: var(--phi-radius-card, 18px) !important;
                    overflow: hidden;
                    padding: 0.75rem;
                    border: none !important;
                    box-shadow: var(--shadow-ambient) !important;
                    position: relative !important;
                }
                .table-wrapper-glass::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 8%; right: 8%;
                    height: 1.5px;
                    background: var(--specular-beam);
                    pointer-events: none;
                }

                .badge-glass { padding: 0.25rem 0.625rem; border-radius: 8px; font-size: var(--fs-xs); font-weight: 800; display: inline-block; }
                .badge-glass.red { background: rgba(244, 63, 94, 0.12); color: var(--status-negative); }
                .badge-glass.green { background: rgba(16, 185, 129, 0.12); color: var(--status-positive); }
                .badge-glass.blue { background: var(--accent-soft-bg); color: var(--accent-ink); }
                .badge-glass.sand { background: var(--surface-sunken); color: var(--text-secondary); border: none !important; }
                .btn-main-glass:disabled { opacity: 0.55; cursor: not-allowed; }

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
        <Suspense fallback={<div style={{ padding: '3.125rem', textAlign: 'center' }}>جاري التحميل...</div>}>
            <PartnerStatementContent />
        </Suspense>
    );
}
