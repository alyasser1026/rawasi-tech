"use client";
import React, { useState, useEffect, useMemo } from 'react';
import MasterPage from '@/components/MasterPage';
import { formatCurrency } from '@/lib/helpers';
import { THEME } from '@/lib/theme';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase'; 
import PrintStatement from './printstatement'; 
import LoadingScreen from '@/components/LoadingScreen';
import { ArrowDownLeft, ArrowUpRight, ChartColumn, CircleCheck, Scale } from 'lucide-react';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import KpiStrip from '@/components/KpiStrip';
import { notify } from '@/lib/notify';

export default function PartnerBalancesPage() {
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // الفلاتر
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [showInactive, setShowInactive] = useState(false);
    const [activeWorkersOnly, setActiveWorkersOnly] = useState(false);
    const [dateFrom, setDateFrom] = useState(''); 
    const [dateTo, setDateTo] = useState('');     
    
    // الصفحات
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);

    const [expandedPartners, setExpandedPartners] = useState<string[]>([]);
    const [ledgers, setLedgers] = useState<Record<string, any[]>>({});
    const [loadingLedgers, setLoadingLedgers] = useState<Record<string, boolean>>({});

    const [isPrintMode, setIsPrintMode] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('print') === 'true') {
                setIsPrintMode(true);
            }
        }
    }, []);

    // 🚀 دالة جلب كشف الحساب التفصيلي لشريك واحد (بترتيب حتمي لمنع السقوط والتكرار)
    const fetchSingleLedger = async (partnerId: string) => {
        setLoadingLedgers(prev => ({ ...prev, [partnerId]: true }));
        try {
            let allLedgerData: any[] = [];
            let fromRow = 0;
            const step = 999;
            let hasMore = true;

            while (hasMore) {
                let query = supabase.from('partner_statement_ledger')
                    .select('*')
                    .eq('partner_id', partnerId);
                
                if (dateFrom) query = query.gte('transaction_date', dateFrom);
                if (dateTo) query = query.lte('transaction_date', `${dateTo}T23:59:59.999Z`);

                // 🚀 ترتيب حتمي صارم يمنع تداخل الصفحات في الداتابيز
                query = query.order('transaction_date', { ascending: true })
                             .order('created_at', { ascending: true })
                             .order('line_id', { ascending: true })
                             .range(fromRow, fromRow + step);

                const { data: ledgerData, error } = await query;
                if (error) throw error;

                if (ledgerData && ledgerData.length > 0) {
                    allLedgerData.push(...ledgerData);
                    fromRow += ledgerData.length;
                    if (ledgerData.length <= step) hasMore = false;
                } else {
                    hasMore = false;
                }
            }

            setLedgers(prev => ({ ...prev, [partnerId]: allLedgerData }));
        } catch (err) {
            console.error("خطأ في جلب كشف الحساب:", err);
        } finally {
            setLoadingLedgers(prev => ({ ...prev, [partnerId]: false }));
        }
    };

    // 🚀 المحرك اللحظي لجلب الأرصدة الشاملة للمشروع وإعادة التجميع بدقة متناهية
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: accountsData, error } = await supabase
                .from('all_partners_account_summary')
                .select('*');

            if (error) throw error;
            let finalData = accountsData || [];

            if (dateFrom || dateTo) {
                let allLedgerData: any[] = [];
                let fromRow = 0;
                const step = 999;
                let hasMore = true;

                while (hasMore) {
                    // 🚀 نسحب التاريخ لنتمكن من فصل الرصيد السابق عن رصيد الفترة
                    let query = supabase.from('partner_statement_ledger').select('line_id, partner_id, debit, credit, transaction_date, created_at');
                    // إذا كان هناك تاريخ بداية، نسحب كل الحركات السابقة له أيضاً لحساب الرصيد السابق
                    if (dateTo) query = query.lte('transaction_date', `${dateTo}T23:59:59.999Z`);
                    
                    // 🚀 الترتيب الحتمي لضمان سحب الآلاف من السطور بدون ضياع أو تكرار أي سجل
                    query = query.order('transaction_date', { ascending: true })
                                 .order('created_at', { ascending: true })
                                 .order('line_id', { ascending: true })
                                 .range(fromRow, fromRow + step);
                    
                    const { data: ledgerData, error: ledgerError } = await query;
                    
                    if (ledgerError) throw ledgerError;
                    
                    if (ledgerData && ledgerData.length > 0) {
                        allLedgerData.push(...ledgerData);
                        fromRow += ledgerData.length;
                        if (ledgerData.length <= step) hasMore = false;
                    } else {
                        hasMore = false;
                    }
                }

                // 🎯 تجميع الأرصدة مع فصل الرصيد السابق عن حركات الفترة
                const sums: Record<string, { credit: number, debit: number, prevBalance: number }> = {};
                allLedgerData.forEach((row: any) => {
                    if (!sums[row.partner_id]) sums[row.partner_id] = { credit: 0, debit: 0, prevBalance: 0 };
                    
                    const c = Number(row.credit || 0);
                    const d = Number(row.debit || 0);
                    
                    if (dateFrom && row.transaction_date < dateFrom) {
                        sums[row.partner_id].prevBalance += (c - d);
                    } else {
                        sums[row.partner_id].credit += c;
                        sums[row.partner_id].debit += d;
                    }
                });

                // تحديث بيانات الجدول الرئيسي
                finalData = finalData.map(p => ({
                    ...p,
                    total_credit: sums[p.partner_id]?.credit || 0,
                    total_debit: sums[p.partner_id]?.debit || 0,
                    previous_balance: sums[p.partner_id]?.prevBalance || 0,
                })).filter(p => p.total_credit > 0 || p.total_debit > 0 || Math.abs(p.previous_balance) > 0);
            }

            setData(finalData);
        } catch (error) {
            console.error("خطأ في جلب الأرصدة:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { 
        const timer = setTimeout(() => {
            fetchData();
            expandedPartners.forEach(id => fetchSingleLedger(id));
        }, 400); 
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateFrom, dateTo]);

    const handleToggleActive = async (partnerId: string, currentStatus: boolean, e: React.MouseEvent) => {
        e.stopPropagation(); 
        const actionName = currentStatus ? 'إيقاف/أرشفة' : 'تفعيل';
        if (!window.confirm(`هل أنت متأكد من ${actionName} هذا الحساب؟`)) return;

        try {
            const { error } = await supabase
                .from('partners')
                .update({ is_active: !currentStatus })
                .eq('id', partnerId);

            if (error) throw error;
            setData(prev => prev.map(p => p.partner_id === partnerId ? { ...p, is_active: !currentStatus } : p));
        } catch (err) {
            notify("حدث خطأ أثناء تغيير حالة الحساب!");
            console.error(err);
        }
    };

    const toggleLedger = async (partnerId: string) => {
        if (expandedPartners.includes(partnerId)) {
            setExpandedPartners(prev => prev.filter(id => id !== partnerId));
            return;
        }
        setExpandedPartners(prev => [...prev, partnerId]);
        if (!ledgers[partnerId]) {
            fetchSingleLedger(partnerId);
        }
    };

    const uniqueTypes = useMemo(() => Array.from(new Set(data.map(d => d.partner_type).filter(Boolean))), [data]);

    const filteredData = useMemo(() => {
        let filtered = data.filter(item => {
            const searchStr = `${item.partner_name} ${item.partner_code}`.toLowerCase();
            const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
            const matchesType = selectedTypes.length === 0 || selectedTypes.includes(item.partner_type);
            const isActiveMatch = showInactive ? true : (item.is_active !== false); 
            
            if (activeWorkersOnly) {
                const isWorker = ['عامل', 'صنايعي', 'عامل يومية', 'مقاول باطن', 'مقاول'].includes(item.partner_type);
                const hasActivity = (Number(item.total_credit || 0) > 0) || (Number(item.total_debit || 0) > 0);
                if (!isWorker || !hasActivity) return false;
            }

            return matchesSearch && matchesType && isActiveMatch;
        });

        return filtered.sort((a, b) => {
            const netA = Math.abs(Number(a.total_credit || 0)) - Math.abs(Number(a.total_debit || 0));
            const netB = Math.abs(Number(b.total_credit || 0)) - Math.abs(Number(b.total_debit || 0));
            return netB - netA;
        });
    }, [data, searchTerm, selectedTypes, showInactive, activeWorkersOnly]);

    const stats = useMemo(() => {
        let totalCredit = 0, totalDebit = 0;
        filteredData.forEach(p => {
            totalCredit += Math.abs(Number(p.total_credit || 0));
            totalDebit += Math.abs(Number(p.total_debit || 0));
        });
        const net = totalCredit - totalDebit;
        return { totalCredit, totalDebit, net };
    }, [filteredData]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedTypes, showInactive, activeWorkersOnly]);
    
    const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, currentPage, rowsPerPage]);

    const getBalanceInfo = (netBal: number) => {
        if (netBal > 0.01) return { label: 'لــه', bg: '#ecfdf5', text: '#047857' }; 
        if (netBal < -0.01) return { label: 'عليــه', bg: '#fef2f2', text: '#dc2626' }; 
        return { label: 'مُتزن', bg: '#fef9c3', text: '#a16207' }; 
    };

    // 🚀 تصدير الإكسيل المطور (بدون حدود + ملون وناعم + كروت إحصائية)
    // 🚀 تصدير الإكسيل المطور (بخط Arial لمنع تقطيع الحروف + أرقام إنجليزية)
    const exportToExcelWithColors = () => {
        let htmlContent = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="ar">
            <head>
                <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
                <style>
                    /* استخدام Arial يمنع الإكسيل من تقطيع الحروف العربية */
                    body { font-family: Arial, sans-serif; background-color: #ffffff; direction: rtl; }
                    table { border-collapse: collapse; width: 100%; text-align: center; margin-top: 20px; direction: rtl; }
                    th { padding: 15px; font-size: 14px; border: 1px solid #cbd5e1; font-family: Arial, sans-serif; }
                    td { padding: 12px; font-size: 14px; font-weight: bold; border: 1px solid #cbd5e1; font-family: Arial, sans-serif; }
                    
                    /* كلاس سحري لإجبار الأرقام على الظهور بالانجليزية وتجنب انعكاسها */
                    .en-num { font-family: Arial, sans-serif; direction: ltr !important; display: inline-block; unicode-bidi: bidi-override; }
                </style>
            </head>
            <body>
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #1e293b; font-size: 24px; margin-bottom: 5px;">التقرير المالي: أرصدة الشركاء وكشف الحساب المجمع</h2>
                    <h4 style="color: #64748b; margin-top: 0;">${dateFrom || dateTo ? `(حركات الفترة من ${dateFrom || 'البداية'} إلى ${dateTo || 'النهاية'})` : '(أرصدة تراكمية حتى تاريخه)'}</h4>
                </div>
                
                <!-- كروت السامري العلوية -->
                <table style="width: 80%; margin: 0 auto 30px auto; border-collapse: separate; border-spacing: 15px;">
                    <tr>
                        <td style="background-color: #ecfdf5; border-radius: 12px; padding: 20px; text-align: center;">
                            <div style="color: #065f46; font-size: 14px; margin-bottom: 8px;">إجمالي دائن (لهم) في الفترة</div>
                            <div style="color: #059669; font-size: 22px; font-weight: bold;" class="en-num">${stats.totalCredit.toLocaleString('en-US')}</div>
                        </td>
                        <td style="background-color: #fef2f2; border-radius: 12px; padding: 20px; text-align: center;">
                            <div style="color: #991b1b; font-size: 14px; margin-bottom: 8px;">إجمالي مدين (عليهم) في الفترة</div>
                            <div style="color: #dc2626; font-size: 22px; font-weight: bold;" class="en-num">${stats.totalDebit.toLocaleString('en-US')}</div>
                        </td>
                        <td style="background-color: ${getBalanceInfo(stats.net).bg}; border-radius: 12px; padding: 20px; text-align: center;">
                            <div style="color: ${getBalanceInfo(stats.net).text}; font-size: 14px; margin-bottom: 8px;">الرصيد الصافي</div>
                            <div style="color: ${getBalanceInfo(stats.net).text}; font-size: 22px; font-weight: bold;">
                                <span class="en-num">${Math.abs(stats.net).toLocaleString('en-US')}</span> (${getBalanceInfo(stats.net).label})
                            </div>
                        </td>
                    </tr>
                </table>

                <!-- الجدول الرئيسي الناعم -->
                <table border="1">
                    <thead>
                        <tr>
                            <th style="background-color: #0f172a; color: white;">الكود</th>
                            <th style="background-color: #0f172a; color: white; text-align: right;">اسم الجهة / الشريك</th>
                            <th style="background-color: #0f172a; color: white;">التصنيف</th>
                            ${dateFrom ? '<th style="background-color: #0f172a; color: white;">الرصيد السابق</th>' : ''}
                            <th style="background-color: #0f172a; color: white;">إجمالي دائن (له)</th>
                            <th style="background-color: #0f172a; color: white;">إجمالي مدين (عليه)</th>
                            <th style="background-color: #0f172a; color: white;">الرصيد الصافي</th>
                            <th style="background-color: #0f172a; color: white;">الموقف</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        filteredData.forEach((p, index) => {
            const tCredit = Math.abs(Number(p.total_credit || 0));
            const tDebit = Math.abs(Number(p.total_debit || 0));
            const prevBal = Number(p.previous_balance || 0);
            const netBal = prevBal + tCredit - tDebit;
            const balInfo = getBalanceInfo(netBal);
            
            const rowBg = index % 2 === 0 ? '#f8fafc' : '#ffffff';
            const prevLabel = prevBal === 0 ? '' : prevBal < 0 ? 'عليه' : 'له';

            htmlContent += `
                <tr style="background-color: ${rowBg};">
                    <td style="color: #64748b; border: 1px solid #cbd5e1;" class="en-num">${p.partner_code || '---'}</td>
                    <td style="text-align: right; color: #1e293b; font-weight: bold; font-size: 15px; border: 1px solid #cbd5e1;">${p.partner_name}</td>
                    <td style="color: #475569; border: 1px solid #cbd5e1;">${p.partner_type}</td>
                    ${dateFrom ? `<td style="color: ${prevBal < 0 ? '#dc2626' : '#059669'}; font-weight: bold; border: 1px solid #cbd5e1;" class="en-num">${Math.abs(prevBal).toLocaleString('en-US')} ${prevLabel}</td>` : ''}
                    <td style="color: #059669; font-weight: bold; border: 1px solid #cbd5e1;" class="en-num">${tCredit > 0 ? tCredit.toLocaleString('en-US') : '-'}</td>
                    <td style="color: #dc2626; font-weight: bold; border: 1px solid #cbd5e1;" class="en-num">${tDebit > 0 ? tDebit.toLocaleString('en-US') : '-'}</td>
                    <td style="background-color: ${balInfo.bg}; color: ${balInfo.text}; font-weight: bold; border: 1px solid #cbd5e1;" class="en-num">${Math.abs(netBal).toLocaleString('en-US')}</td>
                    <td style="background-color: ${balInfo.bg}; color: ${balInfo.text}; font-weight: bold; border: 1px solid #cbd5e1;">${balInfo.label}</td>
                </tr>
            `;
        });

        const finalBalInfo = getBalanceInfo(stats.net);
        htmlContent += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="background-color: #e2e8f0; color: #0f172a; padding: 15px; font-size: 16px; font-weight: bold; text-align: center;">الإجماليات  </td>
                            <td style="background-color: #e2e8f0; color: #059669; padding: 15px; font-size: 16px; font-weight: bold;" class="en-num">${stats.totalCredit.toLocaleString('en-US')}</td>
                            <td style="background-color: #e2e8f0; color: #dc2626; padding: 15px; font-size: 16px; font-weight: bold;" class="en-num">${stats.totalDebit.toLocaleString('en-US')}</td>
                            <td style="background-color: #e2e8f0; color: ${finalBalInfo.text}; padding: 15px; font-size: 16px; font-weight: bold;" class="en-num">${Math.abs(stats.net).toLocaleString('en-US')}</td>
                            <td style="background-color: #e2e8f0; color: ${finalBalInfo.text}; padding: 15px; font-size: 16px; font-weight: bold;">${finalBalInfo.label}</td>
                        </tr>
                    </tfoot>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `التقرير_المالي_للشركاء_${new Date().toISOString().split('T')[0]}.xls`;
        link.click();
    };

    return (
        <div className="clean-page enterprise-page print-container">
            <MasterPage title="أرصدة الشركاء وكشف الحساب" subtitle="اضغط على أي حساب لعرض تفاصيل حركاته (Ledger)">
                
                <style>{`
                    .glass-panel {
                        background: var(--surface-card);
                        border-radius: var(--phi-radius-card, 18px);
                        padding: 1.25rem;
                        box-shadow: var(--shadow-ambient);
                        margin-bottom: 1.25rem;
                        border: none !important;
                        position: relative;
                        overflow: hidden;
                    }
                    .glass-panel::before {
                        content: '';
                        position: absolute;
                        top: 0; left: 8%; right: 8%;
                        height: 1.5px;
                        background: var(--specular-beam);
                        pointer-events: none;
                    }
                    .stat-card {
                        flex: 1;
                        padding: 1.25rem;
                        border-radius: 14px;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        position: relative;
                        overflow: hidden;
                        border: none !important;
                        box-shadow: var(--shadow-elevation);
                    }
                    .stat-card.credit {
                        background: radial-gradient(ellipse 90% 70% at 50% -20%, color-mix(in srgb, var(--status-positive) 14%, transparent), transparent 75%), var(--surface-subcard) !important;
                    }
                    .stat-card.debit {
                        background: radial-gradient(ellipse 90% 70% at 50% -20%, color-mix(in srgb, var(--status-warning) 14%, transparent), transparent 75%), var(--surface-subcard) !important;
                    }
                    .stat-card.net {
                        background: radial-gradient(ellipse 90% 70% at 50% -20%, color-mix(in srgb, var(--action-fill) 16%, transparent), transparent 75%), var(--surface-subcard) !important;
                    }
                    
                    .smart-table-wrapper {
                        background: var(--surface-card);
                        border-radius: var(--phi-radius-card, 18px);
                        overflow: hidden;
                        box-shadow: var(--shadow-ambient);
                        border: none !important;
                        position: relative;
                    }
                    .smart-table-wrapper::before {
                        content: '';
                        position: absolute;
                        top: 0; left: 8%; right: 8%;
                        height: 1.5px;
                        background: var(--specular-beam);
                        pointer-events: none;
                    }
                    .smart-table {
                        width: 100%;
                        border-collapse: separate;
                        border-spacing: 0;
                        text-align: right;
                        background: transparent;
                        color: var(--text-primary);
                    }
                    .smart-table th {
                        background: var(--table-head-bg);
                        padding: 0.9375rem;
                        font-size: var(--fs-sm);
                        font-weight: 900;
                        color: var(--text-primary);
                        border-bottom: 1px solid var(--table-zebra-bg);
                    }
                    .smart-table td {
                        padding: 0.9375rem;
                        font-size: var(--fs-sm);
                        font-weight: 800;
                        border-bottom: 1px solid var(--table-zebra-bg);
                        color: var(--text-primary);
                    }
                    .main-row { cursor: pointer; transition: 0.2s; }
                    .main-row:hover { background: var(--table-row-hover); }
                    .main-row.inactive { opacity: 0.6; }
                    
                    .ledger-container {
                        background: var(--surface-subcard);
                        padding: 1.25rem 1.875rem;
                        border-bottom: 1px solid var(--table-zebra-bg);
                        box-shadow: inset 0 2px 6px -2px rgba(0,0,0,0.06);
                    }
                    .ledger-table {
                        width: 100%;
                        border-collapse: separate;
                        border-spacing: 0;
                        background: var(--surface-card);
                        border-radius: 12px;
                        overflow: hidden;
                        border: none !important;
                        box-shadow: var(--shadow-elevation);
                    }
                    .ledger-table th {
                        background: var(--table-head-bg);
                        color: var(--text-primary);
                        padding: 0.75rem 0.9375rem;
                        font-size: var(--fs-xs);
                        font-weight: 900;
                        border-bottom: 1px solid var(--table-zebra-bg);
                    }
                    .ledger-table td {
                        padding: 0.75rem 0.9375rem;
                        font-size: var(--fs-xs);
                        font-weight: 800;
                        border-bottom: 1px solid var(--table-zebra-bg);
                        color: var(--text-primary);
                    }

                    .arrow-icon { display: inline-block; transition: transform 0.3s; margin-left: 0.625rem; color: var(--accent-ink); }
                    .arrow-expanded { transform: rotate(90deg); color: var(--action-fill); }
                    .glass-input {
                        width: 100%;
                        height: 2.75rem;
                        padding: 0 0.875rem;
                        border-radius: 12px;
                        border: none !important;
                        outline: none;
                        font-weight: 800;
                        transition: 0.2s;
                        background: var(--surface-sunken);
                        box-shadow: var(--shadow-sunken);
                        color: var(--text-primary);
                    }
                    .glass-input:focus-visible, .glass-input:focus {
                        outline: 2px solid var(--accent-main);
                        outline-offset: 1px;
                    }

                    .btn-toggle-status {
                        padding: 0.375rem 0.625rem;
                        border-radius: 8px;
                        font-size: var(--fs-xs);
                        font-weight: 900;
                        border: none;
                        cursor: pointer;
                        transition: 0.2s;
                        box-shadow: var(--shadow-elevation);
                    }
                    .btn-toggle-status.active {
                        background: rgba(244, 63, 94, 0.15);
                        color: var(--status-negative);
                    }
                    .btn-toggle-status.inactive {
                        background: var(--surface-subcard);
                        color: var(--text-secondary);
                    }
                    .btn-toggle-status:hover { transform: translateY(-1px); filter: brightness(1.05); }
                    
                    .btn-print-row {
                        padding: 0.375rem 0.625rem;
                        border-radius: 8px;
                        font-size: var(--fs-xs);
                        font-weight: 900;
                        background: var(--surface-subcard);
                        color: var(--text-primary);
                        border: none;
                        box-shadow: var(--shadow-elevation);
                        cursor: pointer;
                        transition: 0.2s;
                    }
                    .btn-print-row:hover {
                        background: var(--surface-card-hover);
                        transform: translateY(-1px);
                    }

                    .pill-btn {
                        padding: 0.375rem 0.875rem;
                        border-radius: 12px;
                        font-size: var(--fs-sm);
                        font-weight: 800;
                        cursor: pointer;
                        border: none;
                        box-shadow: var(--shadow-elevation);
                        transition: 0.2s;
                        background: var(--surface-subcard);
                        color: var(--text-primary);
                        white-space: nowrap;
                    }
                    .pill-btn.active {
                        background: var(--action-fill);
                        color: var(--action-ink);
                    }
                    .pill-btn:hover:not(.active) {
                        background: var(--surface-card-hover);
                    }
                `}</style>

                <RawasiSidebarManager
                    summary={
                        <KpiStrip compact items={[
                            { label: 'إجمالي دائن (لهم) في الفترة', amount: stats.totalCredit, tone: 'success', icon: <ArrowDownLeft /> },
                            { label: 'إجمالي مدين (عليهم) في الفترة', amount: stats.totalDebit, tone: 'warning', icon: <ArrowUpRight /> },
                            { label: 'صافي حركات الفترة', amount: Math.abs(stats.net), tone: stats.net === 0 ? 'neutral' : 'info', icon: <Scale />, hint: getBalanceInfo(stats.net).label },
                        ]} />
                    }
                    actions={<button type="button" className="ent-button ent-success" onClick={exportToExcelWithColors}><ChartColumn size={16} aria-hidden="true" />تحميل Excel</button>}
                    onSearch={setSearchTerm}
                    placeholder="ابحث باسم الشريك أو الكود…"
                    customFilters={
                        <div>
                            <div><label htmlFor="pb-from">حركات من تاريخ</label><input id="pb-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
                            <div><label htmlFor="pb-to">حركات إلى تاريخ</label><input id="pb-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
                            <div className="phi-filter-wide">
                                <label className="phi-check"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />عرض الحسابات الموقوفة</label>
                                <label className="phi-check"><input type="checkbox" checked={activeWorkersOnly} onChange={e => setActiveWorkersOnly(e.target.checked)} />عمال ومقاولون لهم حركات نشطة فقط</label>
                            </div>
                            {uniqueTypes.length > 0 && <div className="phi-filter-wide">
                                <div><span className="filter-label">التصنيف (يمكن اختيار أكثر من تصنيف)</span><div className="phi-segmented" role="group" aria-label="تصنيف الشريك">
                                    <button type="button" aria-pressed={selectedTypes.length === 0} onClick={() => setSelectedTypes([])}>الكل</button>
                                    {uniqueTypes.map(t => { const isSelected = selectedTypes.includes(t); return <button key={t} type="button" aria-pressed={isSelected} onClick={() => setSelectedTypes(prev => isSelected ? prev.filter(x => x !== t) : [...prev, t])}>{isSelected && <CircleCheck size={14} aria-hidden="true" />}{t}</button>; })}
                                </div></div>
                            </div>}
                        </div>
                    }
                    watchDeps={[stats, dateFrom, dateTo, showInactive, activeWorkersOnly, selectedTypes, uniqueTypes.length]}
                />

                {isLoading ? (
                    <LoadingScreen message="جاري تحميل وتجميع الحسابات بدقة..." fullScreen={false} />
                ) : (
                    <>
                        <div className="smart-table-wrapper"><table className="smart-table">
                            <thead>
                                <tr>
                                    <th style={{ width: dateFrom ? '22%' : '25%' }}>الجهة / الشريك</th>
                                    <th style={{ width: dateFrom ? '10%' : '15%' }}>التصنيف</th>
                                    {dateFrom && <th style={{ width: '12%' }}>الرصيد السابق</th>}
                                    <th style={{ width: dateFrom ? '14%' : '15%' }}>إجمالي له (دائن)</th>
                                    <th style={{ width: dateFrom ? '14%' : '15%' }}>إجمالي عليه (مدين)</th>
                                    <th style={{ width: dateFrom ? '14%' : '15%' }}>الرصيد الصافي</th>
                                    <th style={{ width: dateFrom ? '14%' : '15%', textAlign: 'center' }}>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map((row, idx) => {
                                    const tCredit = Math.abs(Number(row.total_credit || 0));
                                    const tDebit = Math.abs(Number(row.total_debit || 0));
                                    const prevBal = Number(row.previous_balance || 0);
                                    const netBal = prevBal + tCredit - tDebit;
                                    const balInfo = getBalanceInfo(netBal); 
                                    
                                    const isExpanded = expandedPartners.includes(row.partner_id);
                                    const isActive = row.is_active !== false; 
                                    const pLedger = ledgers[row.partner_id] || [];

                                    return (
                                        <React.Fragment key={row.partner_id || idx}>
                                            <tr className={`main-row ${!isActive ? 'inactive' : ''}`} onClick={() => toggleLedger(row.partner_id)}>
                                                <td>
                                                    <span className={`arrow-icon ${isExpanded ? 'arrow-expanded' : ''}`}>◀</span>
                                                    <div style={{ display: 'inline-block' }}>
                                                        <div style={{ color: !isActive ? 'var(--text-muted)' : 'var(--text-primary)', fontSize: 'var(--fs-lg)', fontWeight: 900 }}>
                                                            {row.partner_name} {!isActive && '(موقوف)'}
                                                        </div>
                                                        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>كود: #{row.partner_code || '---'}</div>
                                                    </div>
                                                </td>
                                                <td><span style={{ background: 'var(--surface-sunken)', padding: '0.25rem 0.625rem', borderRadius: '6px', fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--text-secondary)' }}>{row.partner_type}</span></td>
                                                
                                                {dateFrom && (
                                                    <td>
                                                        <span style={{ fontWeight: 900, color: (row.previous_balance || 0) < 0 ? '#dc2626' : '#059669', fontSize: 'var(--fs-md)' }}>
                                                            {formatCurrency(Math.abs(row.previous_balance || 0))} {(row.previous_balance || 0) === 0 ? '' : (row.previous_balance || 0) < 0 ? 'عليه' : 'له'}
                                                        </span>
                                                    </td>
                                                )}
                                                
                                                <td style={{ color: '#059669', fontWeight: 900 }}>{formatCurrency(tCredit)}</td>
                                                <td style={{ color: '#dc2626', fontWeight: 900 }}>{formatCurrency(tDebit)}</td>
                                                <td>
                                                    <span style={{ background: balInfo.bg, color: balInfo.text, padding: '0.375rem 0.75rem', borderRadius: '8px', WebkitPrintColorAdjust: 'exact' }}>
                                                        {formatCurrency(Math.abs(netBal))} {balInfo.label}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '0.3125rem', justifyContent: 'center' }}>
                                                        <button 
                                                            className="btn-print-row"
                                                            title="طباعة كشف الحساب"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                window.open(`/PartnerBalances?print=true&id=${row.partner_id}`, '_blank');
                                                            }}
                                                        >
                                                            طباعة
                                                        </button>

                                                        <button 
                                                            className={`btn-toggle-status ${isActive ? 'active' : 'inactive'}`}
                                                            title={isActive ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                                                            onClick={(e) => handleToggleActive(row.partner_id, isActive, e)}
                                                        >
                                                            {isActive ? 'إيقاف' : 'تفعيل'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={6} style={{ padding: 0 }}>
                                                        <div className="ledger-container">
                                                            <div style={{ marginBottom: '0.625rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                                                                <span>تفاصيل كشف الحساب {dateFrom || dateTo ? '(حسب الفترة المحددة)' : ''}</span>
                                                                <span style={{ color: '#94a3b8', fontSize: 'var(--fs-sm)' }}>{pLedger.length} حركة مسجلة</span>
                                                            </div>
                                                            
                                                            {loadingLedgers[row.partner_id] ? (
                                                                <LoadingScreen message="جاري تحميل الحركات..." fullScreen={false} />
                                                            ) : pLedger.length > 0 ? (
                                                                <table className="ledger-table">
                                                                    <thead>
                                                                        <tr>
                                                                            <th style={{ width: '15%' }}>التاريخ</th>
                                                                            <th style={{ width: '40%' }}>البيان / القيد</th>
                                                                            <th style={{ width: '15%' }}>دائن (له)</th>
                                                                            <th style={{ width: '15%' }}>مدين (عليه)</th>
                                                                            <th style={{ width: '15%' }}>الرصيد التراكمي للفترة</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {(() => {
                                                                            let runningBal = 0;
                                                                            return pLedger.map((lg: any, lIdx: number) => {
                                                                                const c = Math.abs(Number(lg.credit || 0));
                                                                                const d = Math.abs(Number(lg.debit || 0));
                                                                                runningBal += (c - d);
                                                                                const lgBalInfo = getBalanceInfo(runningBal);
                                                                                
                                                                                return (
                                                                                    <tr key={lIdx}>
                                                                                        <td style={{ fontWeight: 900, color: 'var(--text-secondary)' }}>{lg.transaction_date}</td>
                                                                                        <td>
                                                                                            <strong style={{ color: 'var(--text-primary)' }}>{lg.main_description}</strong>
                                                                                            {lg.line_details && <div style={{ fontSize: 'var(--fs-xs)', color: '#64748b', marginTop: '2px' }}>{lg.line_details}</div>}
                                                                                        </td>
                                                                                        <td style={{ color: '#059669', fontWeight: 800 }}>{c > 0 ? formatCurrency(c) : '-'}</td>
                                                                                        <td style={{ color: '#dc2626', fontWeight: 800 }}>{d > 0 ? formatCurrency(d) : '-'}</td>
                                                                                        <td style={{ fontWeight: 900, background: '#f8fafc' }}>
                                                                                            <span style={{ color: lgBalInfo.text, background: Math.abs(runningBal) < 0.01 ? lgBalInfo.bg : 'transparent', padding: Math.abs(runningBal) < 0.01 ? '2px 0.5rem' : '0', borderRadius: '4px' }}>
                                                                                                {formatCurrency(Math.abs(runningBal))} {lgBalInfo.label}
                                                                                            </span>
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            });
                                                                        })()}
                                                                    </tbody>
                                                                </table>
                                                            ) : (
                                                                <div style={{ textAlign: 'center', padding: '1.25rem', color: '#94a3b8', fontWeight: 800 }}>لا توجد حركات معتمدة لهذا الحساب في هذه الفترة.</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table></div>

                        {/* 🚀 زراير التقسيم (Pagination) */}
                        {filteredData.length > 0 && (
                            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', background: 'var(--surface-card)', padding: '1rem 1.25rem', borderRadius: 'var(--phi-radius-card, 18px)', border: 'none', boxShadow: 'var(--shadow-ambient)' }}>
                                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 900, color: 'var(--text-secondary)' }}>
                                    الحسابات المعروضة: <span style={{ color: THEME.primary || '#3b82f6' }}>{filteredData.length}</span> حساب
                                </div>
                                <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                                    <button 
                                        onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}
                                        style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', background: currentPage === 1 ? 'var(--surface-sunken)' : 'var(--action-fill)', color: currentPage === 1 ? 'var(--text-muted)' : 'var(--action-ink)', boxShadow: currentPage === 1 ? 'none' : 'var(--shadow-elevation)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 900, transition: '0.2s' }}
                                    >السابق</button>
                                    
                                    <span style={{ padding: '0.5rem 1.25rem', background: 'var(--surface-sunken)', borderRadius: '10px', fontWeight: 900, border: 'none', boxShadow: 'var(--shadow-sunken)', color: 'var(--text-primary)' }}>
                                        صفحة {currentPage} من {totalPages}
                                    </span>
                                    
                                    <button 
                                        onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}
                                        style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', background: currentPage === totalPages ? 'var(--surface-sunken)' : 'var(--action-fill)', color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--action-ink)', boxShadow: currentPage === totalPages ? 'none' : 'var(--shadow-elevation)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: 900, transition: '0.2s' }}
                                    >التالي</button>
                                </div>
                            </div>
                        )}
                        {filteredData.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontWeight: 900, background: 'var(--surface-card)', borderRadius: 'var(--phi-radius-card, 18px)', marginTop: '1.25rem', border: 'none', boxShadow: 'var(--shadow-ambient)' }}>
                                لا توجد حسابات أو حركات مطابقة للبحث في الفترة المحددة
                            </div>
                        )}
                    </>
                )}
            </MasterPage>
        </div>
    );
}
