"use client";
import React, { useState, useEffect, useMemo } from 'react';
import MasterPage from '@/components/MasterPage';
import { formatCurrency } from '@/lib/helpers';
import { THEME } from '@/lib/theme';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase'; 
import PrintStatement from './printstatement'; 
import LoadingScreen from '@/components/LoadingScreen';
import { ChartColumn, CircleCheck } from 'lucide-react';
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
        <div className="clean-page print-container">
            <MasterPage title="أرصدة الشركاء وكشف الحساب" subtitle="اضغط على أي حساب لعرض تفاصيل حركاته (Ledger)">
                
                <style>{`
                    .glass-panel { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.5); border-radius: 16px; padding: 20px; box-shadow: 0 4px 25px rgba(0,0,0,0.03); margin-bottom: 20px; }
                    .stat-card { flex: 1; padding: 20px; border-radius: 12px; display: flex; flex-direction: column; justify-content: center; position: relative; overflow: hidden; }
                    .stat-card.credit { background: linear-gradient(135deg, #10b98115, #05966915); border: 1px solid #10b98130; }
                    .stat-card.debit { background: linear-gradient(135deg, #f59e0b15, #d9770615); border: 1px solid #f59e0b30; }
                    .stat-card.net { background: linear-gradient(135deg, #3b82f615, #1d4ed815); border: 1px solid #3b82f630; }
                    
                    .smart-table { width: 100%; border-collapse: collapse; text-align: right; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
                    .smart-table th { background: #f8fafc; padding: 15px; font-size: 13px; font-weight: 900; color: #334155; border-bottom: 2px solid #e2e8f0; }
                    .smart-table td { padding: 15px; font-size: 14px; font-weight: 800; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
                    .main-row { cursor: pointer; transition: 0.2s; }
                    .main-row:hover { background: #f8fafc; }
                    .main-row.inactive { opacity: 0.6; background: #fafafa; }
                    
                    .ledger-container { background: #f8fafc; padding: 15px 30px; border-bottom: 2px solid #cbd5e1; box-shadow: inset 0 4px 6px -4px rgba(0,0,0,0.05); }
                    .ledger-table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
                    .ledger-table th { background: #475569; color: white; padding: 10px; font-size: 12px; }
                    .ledger-table td { padding: 10px; font-size: 12px; border-bottom: 1px solid #f1f5f9; }

                    .arrow-icon { display: inline-block; transition: transform 0.3s; margin-left: 10px; color: #94a3b8; }
                    .arrow-expanded { transform: rotate(90deg); color: #3b82f6; }
                    .glass-input { width: 100%; padding: 10px 15px; border-radius: 10px; border: 2px solid #e2e8f0; outline: none; font-weight: 700; transition: 0.3s; background: white; }
                    .glass-input:focus { border-color: ${THEME.primary || '#3b82f6'}; }

                    .btn-toggle-status { padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 900; border: none; cursor: pointer; transition: 0.2s; }
                    .btn-toggle-status.active { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
                    .btn-toggle-status.inactive { background: #e2e8f0; color: #475569; border: 1px solid #cbd5e1; }
                    .btn-toggle-status:hover { transform: translateY(-1px); filter: brightness(0.9); }
                    
                    .btn-print-row { padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 900; background: white; color: #0f172a; border: 1px solid #cbd5e1; cursor: pointer; transition: 0.2s; }
                    .btn-print-row:hover { background: #f1f5f9; transform: translateY(-1px); border-color: #94a3b8; }

                    .pill-btn { padding: 6px 14px; border-radius: 14px; font-size: 12px; font-weight: 800; cursor: pointer; border: 1px solid #cbd5e1; transition: 0.2s; background: white; color: #475569; white-space: nowrap; }
                    .pill-btn.active { background: ${THEME.primary || '#3b82f6'}; color: white; border-color: ${THEME.primary || '#3b82f6'}; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); }
                    .pill-btn:hover:not(.active) { background: #f1f5f9; }
                `}</style>

                <div className="glass-panel" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div className="stat-card credit">
                        <div style={{ fontSize: '13px', fontWeight: 900, color: '#475569' }}>إجمالي دائن (لهم) في الفترة</div>
                        <div style={{ fontSize: '24px', fontWeight: 900, color: '#059669' }}>{formatCurrency(stats.totalCredit)}</div>
                    </div>
                    <div className="stat-card debit">
                        <div style={{ fontSize: '13px', fontWeight: 900, color: '#475569' }}>إجمالي مدين (عليهم) في الفترة</div>
                        <div style={{ fontSize: '24px', fontWeight: 900, color: '#d97706' }}>{formatCurrency(stats.totalDebit)}</div>
                    </div>
                    <div className="stat-card net">
                        <div style={{ fontSize: '13px', fontWeight: 900, color: '#475569' }}>الرصيد الصافي لحركات الفترة</div>
                        <div style={{ fontSize: '24px', fontWeight: 900, color: getBalanceInfo(stats.net).text }}>
                            {formatCurrency(Math.abs(stats.net))} ({getBalanceInfo(stats.net).label})
                        </div>
                    </div>
                </div>

                <div className="glass-panel no-print" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: 2, minWidth: '250px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 900, color: '#64748b', marginBottom: '5px', display: 'block' }}>بحث عام</label>
                            <input type="text" className="glass-input" placeholder="ابحث بالاسم أو الكود..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        
                        <div style={{ flex: 1, minWidth: '150px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 900, color: '#64748b', marginBottom: '5px', display: 'block' }}>حركات من تاريخ</label>
                            <input type="date" className="glass-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                        </div>
                        <div style={{ flex: 1, minWidth: '150px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 900, color: '#64748b', marginBottom: '5px', display: 'block' }}>حركات إلى تاريخ</label>
                            <input type="date" className="glass-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '10px 15px', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer', height: '44px' }} onClick={() => setShowInactive(!showInactive)}>
                            <input type="checkbox" checked={showInactive} readOnly style={{ transform: 'scale(1.2)', marginLeft: '10px', cursor: 'pointer' }} />
                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#475569' }}>عرض الموقوفين</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '10px 15px', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer', height: '44px' }} onClick={() => setActiveWorkersOnly(!activeWorkersOnly)}>
                            <input type="checkbox" checked={activeWorkersOnly} readOnly style={{ transform: 'scale(1.2)', marginLeft: '10px', cursor: 'pointer' }} />
                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#475569' }}>عمال ومقاولين بحركات نشطة</span>
                        </div>

                        <button onClick={exportToExcelWithColors} style={{ padding: '0 20px', height: '44px', background: '#10b981', color: 'white', borderRadius: '10px', border: 'none', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span><ChartColumn size={16} aria-hidden="true" /></span> تحميل Excel
                        </button>
                    </div>

                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: '#64748b', marginBottom: '8px', display: 'block' }}>فلترة بالتصنيف (يمكنك اختيار أكثر من تصنيف):</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button 
                                className={`pill-btn ${selectedTypes.length === 0 ? 'active' : ''}`}
                                onClick={() => setSelectedTypes([])}
                            >
                                الكل
                            </button>
                            {uniqueTypes.map(t => {
                                const isSelected = selectedTypes.includes(t);
                                return (
                                    <button
                                        key={t}
                                        className={`pill-btn ${isSelected ? 'active' : ''}`}
                                        onClick={() => {
                                            if (isSelected) setSelectedTypes(prev => prev.filter(x => x !== t));
                                            else setSelectedTypes(prev => [...prev, t]);
                                        }}
                                    >
                                        {isSelected ? <CircleCheck size={16} aria-hidden="true" /> : ''}{t}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <LoadingScreen message="جاري تحميل وتجميع الحسابات بدقة..." fullScreen={false} />
                ) : (
                    <>
                        <table className="smart-table">
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
                                                        <div style={{ color: !isActive ? '#94a3b8' : (THEME.primary || '#2563eb'), fontSize: '15px', fontWeight: 900 }}>
                                                            {row.partner_name} {!isActive && '(موقوف)'}
                                                        </div>
                                                        <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 800 }}>كود: #{row.partner_code || '---'}</div>
                                                    </div>
                                                </td>
                                                <td><span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 900, color: '#475569' }}>{row.partner_type}</span></td>
                                                
                                                {dateFrom && (
                                                    <td>
                                                        <span style={{ fontWeight: 900, color: (row.previous_balance || 0) < 0 ? '#dc2626' : '#059669', fontSize: '14px' }}>
                                                            {formatCurrency(Math.abs(row.previous_balance || 0))} {(row.previous_balance || 0) === 0 ? '' : (row.previous_balance || 0) < 0 ? 'عليه' : 'له'}
                                                        </span>
                                                    </td>
                                                )}
                                                
                                                <td style={{ color: '#059669', fontWeight: 900 }}>{formatCurrency(tCredit)}</td>
                                                <td style={{ color: '#dc2626', fontWeight: 900 }}>{formatCurrency(tDebit)}</td>
                                                <td>
                                                    <span style={{ background: balInfo.bg, color: balInfo.text, padding: '6px 12px', borderRadius: '8px', WebkitPrintColorAdjust: 'exact' }}>
                                                        {formatCurrency(Math.abs(netBal))} {balInfo.label}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
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
                                                            <div style={{ marginBottom: '10px', fontWeight: 900, color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                                                                <span>تفاصيل كشف الحساب {dateFrom || dateTo ? '(حسب الفترة المحددة)' : ''}</span>
                                                                <span style={{ color: '#94a3b8', fontSize: '12px' }}>{pLedger.length} حركة مسجلة</span>
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
                                                                                        <td style={{ fontWeight: 900, color: '#475569' }}>{lg.transaction_date}</td>
                                                                                        <td>
                                                                                            <strong style={{ color: '#1e293b' }}>{lg.main_description}</strong>
                                                                                            {lg.line_details && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{lg.line_details}</div>}
                                                                                        </td>
                                                                                        <td style={{ color: '#059669', fontWeight: 800 }}>{c > 0 ? formatCurrency(c) : '-'}</td>
                                                                                        <td style={{ color: '#dc2626', fontWeight: 800 }}>{d > 0 ? formatCurrency(d) : '-'}</td>
                                                                                        <td style={{ fontWeight: 900, background: '#f8fafc' }}>
                                                                                            <span style={{ color: lgBalInfo.text, background: Math.abs(runningBal) < 0.01 ? lgBalInfo.bg : 'transparent', padding: Math.abs(runningBal) < 0.01 ? '2px 8px' : '0', borderRadius: '4px' }}>
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
                                                                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontWeight: 800 }}>لا توجد حركات معتمدة لهذا الحساب في هذه الفترة.</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* 🚀 زراير التقسيم (Pagination) */}
                        {filteredData.length > 0 && (
                            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '14px', fontWeight: 900, color: '#475569' }}>
                                    الحسابات المعروضة: <span style={{ color: THEME.primary || '#3b82f6' }}>{filteredData.length}</span> حساب
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <button 
                                        onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}
                                        style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: currentPage === 1 ? '#f1f5f9' : (THEME.primary || '#3b82f6'), color: currentPage === 1 ? '#94a3b8' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 900, transition: '0.2s' }}
                                    >السابق</button>
                                    
                                    <span style={{ padding: '8px 20px', background: '#f8fafc', borderRadius: '8px', fontWeight: 900, border: '1px solid #e2e8f0', color: '#1e293b' }}>
                                        صفحة {currentPage} من {totalPages}
                                    </span>
                                    
                                    <button 
                                        onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}
                                        style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: currentPage === totalPages ? '#f1f5f9' : (THEME.primary || '#3b82f6'), color: currentPage === totalPages ? '#94a3b8' : 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: 900, transition: '0.2s' }}
                                    >التالي</button>
                                </div>
                            </div>
                        )}
                        {filteredData.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontWeight: 900, background: 'white', borderRadius: '12px', marginTop: '20px' }}>
                                لا توجد حسابات أو حركات مطابقة للبحث في الفترة المحددة
                            </div>
                        )}
                    </>
                )}
            </MasterPage>
        </div>
    );
}
