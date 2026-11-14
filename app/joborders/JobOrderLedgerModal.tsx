"use client";
import { currencySymbol } from '@/lib/currency';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import LoadingScreen from '@/components/LoadingScreen';
import { supabase } from '@/lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
    BookOpen, HardHat, Users, Package, Receipt, Wallet, AlertTriangle,
    FileSpreadsheet, TrendingUp, X, Layers, CheckCircle2, Printer
} from 'lucide-react';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import ReportContactFooter from '@/components/ReportContactFooter';
import { printReportElement } from '@/lib/printReportElement';

export default function JobOrderLedgerModal({ isOpen, onClose, jobOrder }: any) {
    const [activeTab, setActiveTab] = useState('الكل');
    const [loading, setLoading] = useState(true);

    const [ledgerData, setLedgerData] = useState<any[]>([]);
    const [assignmentData, setAssignmentData] = useState<any[]>([]);
    const [claimsData, setClaimsData] = useState<any[]>([]);
    const [directPaymentsData, setDirectPaymentsData] = useState<any[]>([]);

    useEffect(() => {
        if (!isOpen || !(jobOrder?.id || jobOrder?.job_order_id)) return;

        const fetchData = async () => {
            setLoading(true);
            const targetId = jobOrder.id || jobOrder.job_order_id;

            // 1. جلب السجل الموحد لأمر الشغل من الفيو
            const { data: ledger } = await supabase
                .from('job_order_ledger_view')
                .select('*')
                .eq('job_order_id', targetId)
                .order('trans_date', { ascending: false });

            // 2. جلب التحميل المالي (ABC) المرتبط بأمر الشغل
            const { data: allocatedOverheads } = await supabase
                .from('advanced_cost_allocation_view')
                .select('*')
                .eq('job_order_id', targetId);

            const allLedger = [
                ...(ledger || []),
                ...(allocatedOverheads || []).map(ao => ({
                    source_id: ao.id,
                    trans_date: ao["تاريخ المصروف الأصلي"],
                    trans_desc: `[تحميل مالي ABC] ${ao["البيان / الوصف"]} (${ao["آلية التوزيع"]})`,
                    amount: Number(ao["المبلغ المحمل (ر.س)"] || 0),
                    trans_type: 'مصروفات نثرية',
                    qty: 1,
                    is_abc: true
                }))
            ];

            // 3. جلب تكليفات المقاولين ومستخلصاتهم على أمر الشغل
            const { data: assignments } = await supabase
                .from('contractor_assignments')
                .select(`
                    id, contractor_id, assigned_qty, unit_price, status, claim_id,
                    partners:partners!contractor_id ( id, name, code ),
                    sub_claims:sub_claims!claim_id ( id, claim_number, date, total_amount, net_amount, paid_amount, materials_deduction, other_deductions, advance_payment, retention_amount, status, is_posted )
                `)
                .eq('job_order_id', targetId);

            // 4. جلب سندات الصرف المباشرة المرتبطة بأمر الشغل
            try {
                const { data: directPVs, error: pvErr } = await supabase
                    .from('payment_vouchers')
                    .select('id, voucher_number, date, amount, description, sub_claim_id')
                    .eq('job_order_id', targetId)
                    .is('sub_claim_id', null);
                if (!pvErr && directPVs) {
                    setDirectPaymentsData(directPVs);
                } else {
                    setDirectPaymentsData([]);
                }
            } catch (_) {
                setDirectPaymentsData([]);
            }

            setLedgerData(allLedger);

            if (assignments) {
                setAssignmentData(assignments);
                const uniqueClaims: any[] = [];
                assignments.forEach((a: any) => {
                    const claimObj = Array.isArray(a.sub_claims) ? a.sub_claims[0] : a.sub_claims;
                    const partnerObj = Array.isArray(a.partners) ? a.partners[0] : a.partners;
                    if (claimObj && !uniqueClaims.find(c => c.id === claimObj.id)) {
                        uniqueClaims.push({
                            ...claimObj,
                            contractor_name: partnerObj?.name || 'مقاول باطن'
                        });
                    }
                });
                setClaimsData(uniqueClaims);
            } else {
                setAssignmentData([]);
                setClaimsData([]);
            }

            setLoading(false);
        };

        fetchData();
    }, [isOpen, jobOrder]);

    // 👷 تحليل تفصيلي ليوميات الفنيين والمساعدين ولكافة بنود التكاليف والتحصيل
    const metrics = useMemo(() => {
        const laborRows = ledgerData.filter(d => d.trans_type === 'يوميات عمالة');
        let techDays = 0;
        let techCost = 0;
        let helperDays = 0;
        let helperCost = 0;

        laborRows.forEach(row => {
            const desc = String(row.trans_desc || '');
            const days = Number(row.qty || 1);
            const amt = Number(row.amount || 0);
            const isHelper = desc.includes('(مساعد') || desc.includes('عامل عادي') || desc.includes('مساعد)');
            if (isHelper) {
                helperDays += days;
                helperCost += amt;
            } else {
                techDays += days;
                techCost += amt;
            }
        });

        const laborTotal = techCost + helperCost;
        const materialsTotal = ledgerData
            .filter(d => d.trans_type === 'خامات مصروفة')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const directExpensesTotal = ledgerData
            .filter(d => d.trans_type === 'مصروفات نثرية' && !String(d.trans_desc).includes('[تحميل مالي'))
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const allocatedExpensesTotal = ledgerData
            .filter(d => d.trans_type === 'مصروفات نثرية' && String(d.trans_desc).includes('[تحميل مالي'))
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const subClaimsFromView = ledgerData
            .filter(d => d.trans_type === 'دفعات مقاولين')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const subClaimsFromAssignments = claimsData.reduce((sum, c) => sum + Number(c.net_amount || c.total_amount || 0), 0);
        const subClaimsTotal = Math.max(subClaimsFromView, subClaimsFromAssignments);

        const penaltiesTotal = ledgerData
            .filter(d => d.trans_type === 'جزاءات')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const contractValue =
            Number(jobOrder?.boq_budget?.total_contract_amount || 0) ||
            (Number(jobOrder?.assigned_qty || 1) * Number(jobOrder?.unit_price || 0));

        const invoicesTotal = ledgerData
            .filter(d => d.trans_type === 'فواتير')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const receiptsTotal = ledgerData
            .filter(d => d.trans_type === 'سندات قبض')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        // التحصيل الفعلي النقدي من العميل هو ما تم قبضه بسندات القبض فقط
        const totalCollectedRevenue = receiptsTotal;

        // إجمالي الفواتير الصادرة للعميل (أو قيمة العقد المستهدفة)
        const totalBilledRevenue = invoicesTotal;
        const targetBilledOrContract = invoicesTotal > 0 ? invoicesTotal : (contractValue || 0);

        // المتبقي غير المحصل طرف العميل (قيمة الفواتير/العقد ناقص المحصل بسندات القبض)
        const customerRemainingBalance = Math.max(0, targetBilledOrContract - receiptsTotal);

        const totalActualCost =
            laborTotal +
            materialsTotal +
            directExpensesTotal +
            allocatedExpensesTotal +
            subClaimsTotal -
            penaltiesTotal;

        const boqBudget =
            Number(jobOrder?.boq_total_budget || 0) ||
            (
                Number(jobOrder?.boq_budget?.estimated_labor_cost || 0) +
                Number(jobOrder?.boq_budget?.estimated_material_cost || 0) +
                Number(jobOrder?.boq_budget?.estimated_expenses_cost || 0) +
                Number(jobOrder?.boq_budget?.estimated_subcontractor_cost || 0)
            ) ||
            (Number(jobOrder?.assigned_qty || 1) * Number(jobOrder?.unit_price || 0));

        const budgetRemaining = boqBudget - totalActualCost;
        const netCashFlow = totalCollectedRevenue - totalActualCost;

        return {
            techDays,
            techCost,
            helperDays,
            helperCost,
            totalLaborDays: techDays + helperDays,
            laborTotal,
            materialsTotal,
            directExpensesTotal,
            allocatedExpensesTotal,
            subClaimsTotal,
            penaltiesTotal,
            invoicesTotal,
            receiptsTotal,
            totalBilledRevenue,
            totalCollectedRevenue,
            customerRemainingBalance,
            totalActualCost,
            boqBudget,
            contractValue,
            budgetRemaining,
            netCashFlow
        };
    }, [ledgerData, claimsData, jobOrder]);

    // قائمة المقاولين المسند إليهم أمر الشغل
    const contractorNamesList = useMemo(() => {
        const names = new Set<string>();
        if (Array.isArray(jobOrder?.assigned_contractors)) {
            jobOrder.assigned_contractors.forEach((c: any) => {
                if (c?.name) names.add(c.name);
            });
        }
        assignmentData.forEach((a: any) => {
            const p = Array.isArray(a.partners) ? a.partners[0] : a.partners;
            if (p?.name) names.add(p.name);
        });
        if (jobOrder?.partners?.name) {
            names.add(jobOrder.partners.name);
        }
        return Array.from(names);
    }, [jobOrder, assignmentData]);

    // تجهيز صفوف الجدول حسب التبويب النشط
    const tableRows = useMemo(() => {
        if (activeTab === 'الكل') {
            return ledgerData;
        }
        if (activeTab === 'دفعات مقاولين') {
            const viewRows = ledgerData.filter(d => d.trans_type === 'دفعات مقاولين');
            if (viewRows.length > 0) return viewRows;
            const fallbackRows: any[] = [];
            claimsData.forEach(c => {
                fallbackRows.push({
                    trans_date: c.date,
                    trans_type: 'دفعات مقاولين',
                    trans_desc: `مستخلص مقاول باطن #${c.claim_number} - ${c.contractor_name || 'مقاول باطن'} (${c.status || 'معتمد'})`,
                    qty: 1,
                    amount: Number(c.net_amount || c.total_amount || 0)
                });
            });
            directPaymentsData.forEach(p => {
                fallbackRows.push({
                    trans_date: p.date,
                    trans_type: 'دفعات مقاولين',
                    trans_desc: `سند صرف مباشر #${p.voucher_number} | ${p.description || 'دفعة نقدية'}`,
                    qty: 1,
                    amount: Number(p.amount || 0)
                });
            });
            return fallbackRows;
        }
        return ledgerData.filter(d => d.trans_type === activeTab);
    }, [activeTab, ledgerData, claimsData, directPaymentsData]);

    const tabTotal = useMemo(
        () => tableRows.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        [tableRows]
    );

    const collectionPercentage = useMemo(() => {
        if (metrics.totalBilledRevenue > 0) {
            return Math.min(100, Math.round((metrics.totalCollectedRevenue / metrics.totalBilledRevenue) * 100));
        }
        if (metrics.contractValue > 0) {
            return Math.min(100, Math.round((metrics.totalCollectedRevenue / metrics.contractValue) * 100));
        }
        return 0;
    }, [metrics]);

    const budgetConsumedPercentage = useMemo(() => {
        if (metrics.boqBudget > 0) {
            return Math.round((metrics.totalActualCost / metrics.boqBudget) * 100);
        }
        return 0;
    }, [metrics]);

    const handlePrint = useCallback(() => {
        const orderNum = jobOrder?.order_number || 'JO-0000';
        printReportElement('job-order-ledger-printable', `تقرير_أستاذ_أمر_شغل_${orderNum}`);
    }, [jobOrder]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                handlePrint();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handlePrint]);

    if (!isOpen) return null;

    const countByType = (type: string) => {
        if (type === 'الكل') return ledgerData.length;
        return ledgerData.filter(d => d.trans_type === type).length;
    };

    const tabs = [
        { id: 'الكل', label: 'الكل (دفتر الأستاذ)', icon: BookOpen, count: countByType('الكل') },
        { id: 'يوميات عمالة', label: 'يوميات العمالة', icon: Users, count: countByType('يوميات عمالة') },
        { id: 'دفعات مقاولين', label: 'مستخلصات المقاولين', icon: HardHat, count: countByType('دفعات مقاولين') },
        { id: 'مصروفات نثرية', label: 'المصروفات المباشرة', icon: Wallet, count: countByType('مصروفات نثرية') },
        { id: 'خامات مصروفة', label: 'الخامات المنصرفة', icon: Package, count: countByType('خامات مصروفة') },
        { id: 'فواتير', label: 'فواتير المبيعات', icon: FileSpreadsheet, count: countByType('فواتير') },
        { id: 'سندات قبض', label: 'تحصيلات العميل (سندات قبض)', icon: Receipt, count: countByType('سندات قبض') },
        { id: 'جزاءات', label: 'الجزاءات', icon: AlertTriangle, count: countByType('جزاءات') },
        { id: 'مؤشرات الأداء', label: 'الرسم البياني', icon: TrendingUp, count: null },
        { id: 'تقرير الطباعة', label: 'معاينة وطباعة التقرير الشامل', icon: Printer, count: null }
    ];

    const getTypeBadgeStyle = (type: string, desc: string = '') => {
        if (type === 'يوميات عمالة') {
            const isHelper = desc.includes('(مساعد') || desc.includes('مساعد)');
            return isHelper
                ? { bg: 'rgba(13, 148, 136, 0.12)', color: '#0f766e', border: 'rgba(13, 148, 136, 0.3)', label: '🤝 يومية مساعدين' }
                : { bg: 'rgba(2, 132, 199, 0.12)', color: '#0369a1', border: 'rgba(2, 132, 199, 0.3)', label: '👷 يومية فنيين' };
        }
        if (type === 'دفعات مقاولين') {
            return { bg: 'rgba(217, 119, 6, 0.14)', color: '#b45309', border: 'rgba(217, 119, 6, 0.35)', label: '🏗️ مستخلص مقاول' };
        }
        if (type === 'مصروفات نثرية') {
            return { bg: 'rgba(147, 51, 234, 0.12)', color: '#7e22ce', border: 'rgba(147, 51, 234, 0.3)', label: '💸 مصروف مباشر' };
        }
        if (type === 'خامات مصروفة') {
            return { bg: 'rgba(234, 88, 12, 0.12)', color: '#c2410c', border: 'rgba(234, 88, 12, 0.3)', label: '📦 خامات منصرفة' };
        }
        if (type === 'سندات قبض') {
            return { bg: 'rgba(22, 163, 74, 0.14)', color: '#15803d', border: 'rgba(22, 163, 74, 0.35)', label: '💰 تحصيل عميل' };
        }
        if (type === 'فواتير') {
            return { bg: 'rgba(37, 99, 235, 0.14)', color: '#1d4ed8', border: 'rgba(37, 99, 235, 0.35)', label: '📄 فاتورة مبيعات' };
        }
        return { bg: 'rgba(225, 29, 72, 0.12)', color: '#be123c', border: 'rgba(225, 29, 72, 0.3)', label: type || 'حركة مالية' };
    };

    const formatDateClean = (d: any) => {
        if (!d) return '---';
        const str = String(d);
        if (str.includes('T')) return str.split('T')[0];
        return str.slice(0, 10);
    };

    const renderPrintableDocument = () => (
        <div
            id="job-order-ledger-printable"
            style={{
                background: '#ffffff',
                color: '#0f172a',
                padding: '2rem',
                borderRadius: '16px',
                border: '1px solid #cbd5e1',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
                direction: 'rtl',
                fontFamily: "'Cairo', 'Tajawal', system-ui, -apple-system, sans-serif"
            }}
        >
            <style>{`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 10mm 12mm;
                    }
                    html, body {
                        --bg-canvas: #ffffff !important;
                        --bg-canvas-secondary: #ffffff !important;
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                        background-image: none !important;
                        color: #0f172a !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        min-height: 0 !important;
                        max-height: none !important;
                        overflow: visible !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    #job-order-ledger-printable {
                        position: static !important;
                        left: auto !important;
                        top: auto !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        box-shadow: none !important;
                        border: none !important;
                        display: block !important;
                        visibility: visible !important;
                    }
                    table {
                        page-break-inside: auto !important;
                        break-inside: auto !important;
                    }
                    tr {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    thead {
                        display: table-header-group !important;
                    }
                    tfoot {
                        display: table-footer-group !important;
                    }
                }
            `}</style>

            {/* 1️⃣ ترويسة التقرير الرسمية للشركة */}
            <ReportOfficialHeader
                title="تقرير أستاذ ومطابقة أمر الشغل التحليلي"
                subtitle="بيان التكاليف الفعلية ومطابقة فواتير وتحصيلات العميل والمركز المالي"
                projectName={jobOrder?.projects?.Property || 'المشروع'}
                projectCode={jobOrder?.projects?.code}
                reportRefCode={jobOrder?.order_number || 'JO-0000'}
                issueDate={new Date().toISOString().split('T')[0]}
                details={[
                    { label: 'رقم أمر الشغل', value: jobOrder?.order_number || 'JO-0000', ltr: true },
                    { label: 'بند الأعمال المكلف', value: jobOrder?.boq_budget?.work_item || jobOrder?.job_order_name || 'بند الأعمال' },
                    { label: 'حالة أمر الشغل', value: jobOrder?.status || 'جاري التنفيذ' },
                    { label: 'جهة التنفيذ', value: contractorNamesList.length > 0 ? contractorNamesList.join(' ، ') : 'تشغيل ذاتي (عمالة الشركة)' },
                    { label: 'فواتير المبيعات الصادرة', value: formatCurrency(metrics.totalBilledRevenue || metrics.contractValue), accent: true },
                    { label: 'المحصل الفعلي بسندات القبض', value: formatCurrency(metrics.totalCollectedRevenue), accent: true }
                ]}
                meta={[
                    { label: 'تاريخ الطباعة', value: new Date().toLocaleDateString('ar-EG') },
                    { label: 'حالة الاعتماد', value: 'معتمد ومطابق' }
                ]}
            />

            {/* 2️⃣ شبكة مؤشرات المركز المالي المطبوعة */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: '0.65rem',
                    marginTop: '1.25rem',
                    marginBottom: '1.25rem',
                    pageBreakInside: 'avoid'
                }}
            >
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 800 }}>🎯 الميزانية التقديرية</div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#334155', marginTop: '0.2rem' }} dir="ltr">
                        {formatCurrency(metrics.boqBudget)}
                    </div>
                </div>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '10.5px', color: '#991b1b', fontWeight: 800 }}>🛑 إجمالي التكلفة الفعلية</div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#dc2626', marginTop: '0.2rem' }} dir="ltr">
                        {formatCurrency(metrics.totalActualCost)}
                    </div>
                </div>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '10.5px', color: '#1e40af', fontWeight: 800 }}>📄 فواتير المبيعات الصادرة</div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#2563eb', marginTop: '0.2rem' }} dir="ltr">
                        {formatCurrency(metrics.totalBilledRevenue)}
                    </div>
                </div>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '10.5px', color: '#065f46', fontWeight: 800 }}>💰 المحصل الفعلي (قبض)</div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#059669', marginTop: '0.2rem' }} dir="ltr">
                        {formatCurrency(metrics.totalCollectedRevenue)}
                    </div>
                </div>
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '10.5px', color: '#92400e', fontWeight: 800 }}>⏳ المتبقي طرف العميل</div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#d97706', marginTop: '0.2rem' }} dir="ltr">
                        {formatCurrency(metrics.customerRemainingBalance)}
                    </div>
                </div>
                <div style={{ background: metrics.netCashFlow >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${metrics.netCashFlow >= 0 ? '#bbf7d0' : '#fecaca'}`, borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '10.5px', color: metrics.netCashFlow >= 0 ? '#166534' : '#991b1b', fontWeight: 800 }}>💎 صافي التدفق النقدي</div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: metrics.netCashFlow >= 0 ? '#16a34a' : '#dc2626', marginTop: '0.2rem' }} dir="ltr">
                        {formatCurrency(metrics.netCashFlow)}
                    </div>
                </div>
            </div>

            {/* 3️⃣ الرسم البياني التحليلي الشامل ومؤشرات المطابقة */}
            <div
                style={{
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    background: '#ffffff',
                    marginBottom: '1.25rem',
                    pageBreakInside: 'avoid'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 900, fontSize: '14px', color: '#0f172a' }}>
                        📊 الرسم البياني التحليلي لمقارنة الميزانية والتكاليف الفعلية والتحصيل
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800 }}>
                        كافة المبالغ بالريال السعودي ({currencySymbol()})
                    </div>
                </div>

                {/* رسم بياني بأبعاد بكسل ثابتة لضمان النسخ الفيكتوري الكامل عند الطباعة */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <BarChart
                        width={840}
                        height={250}
                        data={[
                            {
                                name: jobOrder?.order_number || 'أمر الشغل',
                                'الميزانية التقديرية': metrics.boqBudget,
                                'التكلفة الفعلية': metrics.totalActualCost,
                                'فواتير المبيعات': metrics.totalBilledRevenue,
                                'المحصل الفعلي': metrics.totalCollectedRevenue,
                                'المتبقي على العميل': metrics.customerRemainingBalance,
                                'صافي التدفق': metrics.netCashFlow
                            }
                        ]}
                        margin={{ top: 15, right: 20, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={{ stroke: '#94a3b8' }} tickLine={false} tick={{ fill: '#0f172a', fontWeight: 800, fontSize: 12 }} />
                        <YAxis axisLine={{ stroke: '#94a3b8' }} tickLine={false} tick={{ fill: '#475569', fontWeight: 800, fontSize: 11 }} tickFormatter={(val) => Number(val).toLocaleString('en-US')} />
                        <Legend wrapperStyle={{ paddingTop: '8px', fontWeight: 800, fontSize: '12px' }} iconType="circle" />
                        <Bar dataKey="الميزانية التقديرية" fill="#475569" radius={[5, 5, 0, 0]} barSize={28} />
                        <Bar dataKey="التكلفة الفعلية" fill="#dc2626" radius={[5, 5, 0, 0]} barSize={28} />
                        <Bar dataKey="فواتير المبيعات" fill="#2563eb" radius={[5, 5, 0, 0]} barSize={28} />
                        <Bar dataKey="المحصل الفعلي" fill="#059669" radius={[5, 5, 0, 0]} barSize={28} />
                        <Bar dataKey="المتبقي على العميل" fill="#d97706" radius={[5, 5, 0, 0]} barSize={28} />
                        <Bar dataKey="صافي التدفق" fill="#0891b2" radius={[5, 5, 0, 0]} barSize={28} />
                    </BarChart>
                </div>

                {/* أشرطة المطابقة والنسب المرئية */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1' }}>
                    {/* شريط مطابقة تحصيل العميل */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '12px', fontWeight: 900 }}>
                            <span style={{ color: '#0f172a' }}>موقف تحصيل فواتير العميل</span>
                            <span style={{ color: '#059669' }}>تم تحصيل {collectionPercentage}%</span>
                        </div>
                        <div style={{ height: '12px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', display: 'flex', border: '1px solid #cbd5e1' }}>
                            <div style={{ width: `${collectionPercentage}%`, background: '#059669', height: '100%' }} />
                            <div style={{ width: `${100 - collectionPercentage}%`, background: '#d97706', height: '100%' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '11px', fontWeight: 800 }}>
                            <span style={{ color: '#059669' }}>● المحصل: {formatCurrency(metrics.totalCollectedRevenue)}</span>
                            <span style={{ color: '#d97706' }}>● المتبقي: {formatCurrency(metrics.customerRemainingBalance)}</span>
                            <span style={{ color: '#2563eb' }}>● الفواتير: {formatCurrency(metrics.totalBilledRevenue || metrics.contractValue)}</span>
                        </div>
                    </div>

                    {/* شريط استهلاك الميزانية */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '12px', fontWeight: 900 }}>
                            <span style={{ color: '#0f172a' }}>موقف استهلاك الميزانية التقديرية</span>
                            <span style={{ color: budgetConsumedPercentage > 100 ? '#dc2626' : '#0284c7' }}>
                                {budgetConsumedPercentage}% مستهلك
                            </span>
                        </div>
                        <div style={{ height: '12px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                            <div style={{ width: `${Math.min(100, budgetConsumedPercentage)}%`, background: budgetConsumedPercentage > 100 ? '#dc2626' : '#0284c7', height: '100%' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '11px', fontWeight: 800 }}>
                            <span style={{ color: '#dc2626' }}>● التكلفة الفعلية: {formatCurrency(metrics.totalActualCost)}</span>
                            <span style={{ color: metrics.budgetRemaining >= 0 ? '#059669' : '#dc2626' }}>
                                ● {metrics.budgetRemaining >= 0 ? 'الوفر المتبقي:' : 'العجز:'} {formatCurrency(Math.abs(metrics.budgetRemaining))}
                            </span>
                            <span style={{ color: '#475569' }}>● الميزانية: {formatCurrency(metrics.boqBudget)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4️⃣ تحليل عناصر التكلفة المنصرفة */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '0.65rem',
                    marginBottom: '1.25rem',
                    pageBreakInside: 'avoid'
                }}
            >
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0.65rem 0.85rem', background: '#f8fafc' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#0369a1' }}>👷 عمالة فنية (صنايعية)</div>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a', marginTop: '0.2rem' }}>
                        {metrics.techDays} يوم — {formatCurrency(metrics.techCost)}
                    </div>
                </div>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0.65rem 0.85rem', background: '#f8fafc' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f766e' }}>🤝 عمالة مساعدة (عمال)</div>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a', marginTop: '0.2rem' }}>
                        {metrics.helperDays} يوم — {formatCurrency(metrics.helperCost)}
                    </div>
                </div>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0.65rem 0.85rem', background: '#f8fafc' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#b45309' }}>🏗️ مستخلصات مقاولين</div>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a', marginTop: '0.2rem' }}>
                        {formatCurrency(metrics.subClaimsTotal)}
                    </div>
                </div>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0.65rem 0.85rem', background: '#f8fafc' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#c2410c' }}>📦 خامات ومواد منصرفة</div>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a', marginTop: '0.2rem' }}>
                        {formatCurrency(metrics.materialsTotal)}
                    </div>
                </div>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0.65rem 0.85rem', background: '#f8fafc' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#7e22ce' }}>💸 مصروفات ونثريات وABC</div>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a', marginTop: '0.2rem' }}>
                        {formatCurrency(metrics.directExpensesTotal + metrics.allocatedExpensesTotal)}
                    </div>
                </div>
            </div>

            {/* 5️⃣ جدول كشف الحركات المالي التفصيلي */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 900, fontSize: '13px', color: '#0f172a', marginBottom: '0.65rem' }}>
                    📋 كشف الحركات التفصيلي لدفتر أستاذ أمر الشغل ({ledgerData.length} حركة مسجلة)
                </div>
                <table
                    style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        textAlign: 'right',
                        border: '1.5px solid #94a3b8',
                        fontSize: '11.5px'
                    }}
                >
                    <thead>
                        <tr style={{ background: '#f1f5f9', color: '#1e293b', fontWeight: 900, borderBottom: '2px solid #94a3b8' }}>
                            <th style={{ padding: '0.6rem 0.75rem', width: '35px', textAlign: 'center', border: '1px solid #cbd5e1' }}>م</th>
                            <th style={{ padding: '0.6rem 0.75rem', width: '95px', textAlign: 'center', border: '1px solid #cbd5e1' }}>التاريخ</th>
                            <th style={{ padding: '0.6rem 0.75rem', width: '130px', border: '1px solid #cbd5e1' }}>نوع الحركة</th>
                            <th style={{ padding: '0.6rem 0.75rem', border: '1px solid #cbd5e1' }}>البيان التحليلي والتفصيلي</th>
                            <th style={{ padding: '0.6rem 0.75rem', width: '85px', textAlign: 'center', border: '1px solid #cbd5e1' }}>العدد / الأيام</th>
                            <th style={{ padding: '0.6rem 0.75rem', width: '130px', textAlign: 'left', border: '1px solid #cbd5e1' }}>القيمة ({currencySymbol()})</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ledgerData.length > 0 ? (
                            ledgerData.map((row: any, idx: number) => {
                                const badge = getTypeBadgeStyle(row.trans_type, row.trans_desc);
                                const isReceipt = row.trans_type === 'سندات قبض';
                                const isInvoice = row.trans_type === 'فواتير';
                                return (
                                    <tr
                                        key={row.source_id || idx}
                                        style={{
                                            background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                                            borderBottom: '1px solid #e2e8f0',
                                            color: '#1e293b'
                                        }}
                                    >
                                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', fontWeight: 800, color: '#64748b', border: '1px solid #e2e8f0' }} dir="ltr">
                                            {idx + 1}
                                        </td>
                                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', fontWeight: 800, color: '#475569', border: '1px solid #e2e8f0' }} dir="ltr">
                                            {formatDateClean(row.trans_date)}
                                        </td>
                                        <td style={{ padding: '0.55rem 0.75rem', border: '1px solid #e2e8f0' }}>
                                            <span
                                                style={{
                                                    display: 'inline-block',
                                                    padding: '0.2rem 0.55rem',
                                                    borderRadius: '6px',
                                                    fontSize: '10.5px',
                                                    fontWeight: 900,
                                                    background: badge.bg,
                                                    color: badge.color,
                                                    border: `1px solid ${badge.border}`
                                                }}
                                            >
                                                {badge.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.55rem 0.75rem', fontWeight: 800, border: '1px solid #e2e8f0' }}>
                                            {row.trans_desc}
                                        </td>
                                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', fontWeight: 900, border: '1px solid #e2e8f0' }} dir="ltr">
                                            {row.qty ?? 1}
                                        </td>
                                        <td
                                            style={{
                                                padding: '0.55rem 0.75rem',
                                                textAlign: 'left',
                                                fontWeight: 900,
                                                border: '1px solid #e2e8f0',
                                                color: isReceipt ? '#15803d' : isInvoice ? '#1d4ed8' : badge.color
                                            }}
                                            dir="ltr"
                                        >
                                            {isReceipt ? '+' : ''}{formatCurrency(row.amount)}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                    لا توجد حركات مسجلة على أمر الشغل.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: '#f1f5f9', fontWeight: 900, borderTop: '2px solid #94a3b8' }}>
                            <td colSpan={4} style={{ padding: '0.75rem 1rem', border: '1px solid #cbd5e1' }}>
                                إجمالي حركات دفتر الأستاذ ({ledgerData.length} حركة)
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center', border: '1px solid #cbd5e1' }} dir="ltr">
                                {metrics.totalLaborDays > 0 ? `${metrics.totalLaborDays} يوم عمالة` : '-'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '13px', color: '#0f172a', border: '1px solid #cbd5e1' }} dir="ltr">
                                {formatCurrency(ledgerData.reduce((sum, item) => sum + Number(item.amount || 0), 0))}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* 6️⃣ خانات الاعتماد والتوقيعات الرسمية */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginTop: '1.75rem', marginBottom: '1.5rem', pageBreakInside: 'avoid' }}>
                <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '0.85rem', textAlign: 'center', background: '#f8fafc' }}>
                    <div style={{ fontWeight: 900, fontSize: '12px', color: '#475569' }}>إعداد / المحاسب المالي</div>
                    <div style={{ height: '40px' }}></div>
                    <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '0.35rem', fontSize: '11px', color: '#0f172a', fontWeight: 800 }}>التوقيع: ................................</div>
                </div>
                <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '0.85rem', textAlign: 'center', background: '#f8fafc' }}>
                    <div style={{ fontWeight: 900, fontSize: '12px', color: '#475569' }}>مراجعة / مهندس الموقع والمشروع</div>
                    <div style={{ height: '40px' }}></div>
                    <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '0.35rem', fontSize: '11px', color: '#0f172a', fontWeight: 800 }}>التوقيع: ................................</div>
                </div>
                <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '0.85rem', textAlign: 'center', background: '#f8fafc' }}>
                    <div style={{ fontWeight: 900, fontSize: '12px', color: '#475569' }}>اعتماد / المدير التنفيذي والإدارة العامة</div>
                    <div style={{ height: '40px' }}></div>
                    <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '0.35rem', fontSize: '11px', color: '#0f172a', fontWeight: 800 }}>الختم والاعتماد: ........................</div>
                </div>
            </div>

            {/* 7️⃣ تذييل بيانات الاتصال للشركة */}
            <ReportContactFooter layout="row" />
        </div>
    );

    const modalContent = (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(28, 18, 12, 0.72)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 999999,
                padding: '1rem',
                direction: 'rtl'
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="cinematic-scroll"
                style={{
                    width: '96vw',
                    maxWidth: '76rem',
                    maxHeight: '92vh',
                    background: 'var(--surface-card, #ffffff)',
                    color: 'var(--text-primary, #1e293b)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    boxShadow: '0 32px 70px rgba(0, 0, 0, 0.35)'
                }}
            >
                {/* 1️⃣ رأس دفتر أستاذ أمر الشغل — متناسق مع الثيم */}
                <div
                    style={{
                        background: `linear-gradient(135deg, ${THEME.coffeeDark} 0%, ${THEME.coffeeMain} 100%)`,
                        padding: '1.5rem 1.75rem',
                        color: '#ffffff',
                        position: 'relative',
                        borderBottom: `3px solid ${THEME.goldAccent}`,
                        flexShrink: 0
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <span
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        background: 'rgba(255, 255, 255, 0.14)',
                                        padding: '0.35rem 0.85rem',
                                        borderRadius: '999px',
                                        fontSize: 'var(--fs-xs)',
                                        fontWeight: 900,
                                        border: '1px solid rgba(255, 255, 255, 0.25)'
                                    }}
                                >
                                    <Layers size={14} /> دفتر أستاذ ومطابقة أمر الشغل
                                </span>
                                <span
                                    dir="ltr"
                                    style={{
                                        background: THEME.goldAccent,
                                        color: '#ffffff',
                                        padding: '0.3rem 0.85rem',
                                        borderRadius: '8px',
                                        fontSize: 'var(--fs-sm)',
                                        fontWeight: 900
                                    }}
                                >
                                    {jobOrder?.order_number || 'JO-0000'}
                                </span>
                                <span
                                    style={{
                                        background: 'rgba(16, 185, 129, 0.22)',
                                        color: '#a7f3d0',
                                        border: '1px solid rgba(16, 185, 129, 0.4)',
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '8px',
                                        fontSize: 'var(--fs-xs)',
                                        fontWeight: 800
                                    }}
                                >
                                    {jobOrder?.status || 'جاري التنفيذ'}
                                </span>
                            </div>

                            <h2 style={{ margin: '0.65rem 0 0.35rem 0', fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#ffffff' }}>
                                {jobOrder?.projects?.Property || 'المشروع'} — {jobOrder?.boq_budget?.work_item || jobOrder?.job_order_name || 'بند الأعمال'}
                            </h2>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                                <span style={{ fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.8)', fontWeight: 800 }}>
                                    جهة التنفيذ ({jobOrder?.executor_type || 'تنفيذ مشترك'}):
                                </span>
                                {contractorNamesList.length > 0 ? (
                                    contractorNamesList.map((name, idx) => (
                                        <span
                                            key={idx}
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.16)',
                                                color: '#fde68a',
                                                border: '1px solid rgba(253, 230, 138, 0.35)',
                                                padding: '0.2rem 0.65rem',
                                                borderRadius: '8px',
                                                fontSize: 'var(--fs-xs)',
                                                fontWeight: 900
                                            }}
                                        >
                                            👷 {name}
                                        </span>
                                    ))
                                ) : (
                                    <span style={{ fontSize: 'var(--fs-xs)', color: '#fde68a', fontWeight: 800 }}>
                                        تشغيل ذاتي (عمالة الشركة)
                                    </span>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={handlePrint}
                                style={{
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    border: '1px solid rgba(255, 255, 255, 0.35)',
                                    color: '#ffffff',
                                    padding: '0.55rem 1.15rem',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    fontWeight: 900,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    fontSize: 'var(--fs-sm)',
                                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                                    transition: 'all 0.2s ease'
                                }}
                                title="طباعة التقرير الشامل لأمر الشغل (Ctrl+P)"
                            >
                                <Printer size={16} /> طباعة التقرير الشامل
                            </button>
                            <button
                                onClick={onClose}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.14)',
                                    border: '1px solid rgba(255, 255, 255, 0.28)',
                                    color: '#ffffff',
                                    padding: '0.55rem 1.1rem',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    fontWeight: 900,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    fontSize: 'var(--fs-sm)'
                                }}
                            >
                                <X size={16} /> إغلاق
                            </button>
                        </div>
                    </div>

                    {/* 2️⃣ شبكة الكروت المالية والتشغيلية الموحدة */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))',
                            gap: '0.75rem',
                            marginTop: '1.25rem'
                        }}
                    >
                        <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.18)' }}>
                            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.78)', fontWeight: 800 }}>👷 يومية الفنيين (صنايعية)</div>
                            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, marginTop: '0.25rem', color: '#7dd3fc' }}>
                                {metrics.techDays} يوم — {formatCurrency(metrics.techCost)}
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.18)' }}>
                            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.78)', fontWeight: 800 }}>🤝 يومية المساعدين (عمال)</div>
                            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, marginTop: '0.25rem', color: '#5eead4' }}>
                                {metrics.helperDays} يوم — {formatCurrency(metrics.helperCost)}
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.18)' }}>
                            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.78)', fontWeight: 800 }}>🏗️ مستخلصات مقاولي الباطن</div>
                            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, marginTop: '0.25rem', color: '#fcd34d' }}>
                                {formatCurrency(metrics.subClaimsTotal)}
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.18)' }}>
                            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.78)', fontWeight: 800 }}>💸 مصروفات وخامات مباشرة</div>
                            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, marginTop: '0.25rem', color: '#ffffff' }}>
                                {formatCurrency(metrics.directExpensesTotal + metrics.materialsTotal + metrics.allocatedExpensesTotal)}
                            </div>
                        </div>

                        <div style={{ background: 'rgba(244, 63, 94, 0.22)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(251, 113, 133, 0.45)' }}>
                            <div style={{ fontSize: '11px', color: '#fecdd3', fontWeight: 800 }}>🛑 إجمالي التكلفة الفعلية للأمر</div>
                            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, marginTop: '0.25rem', color: '#fda4af' }}>
                                {formatCurrency(metrics.totalActualCost)}
                            </div>
                        </div>

                        <div style={{ background: 'rgba(56, 189, 248, 0.18)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.4)' }}>
                            <div style={{ fontSize: '11px', color: '#bae6fd', fontWeight: 800 }}>📄 إجمالي فواتير المبيعات</div>
                            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, marginTop: '0.25rem', color: '#7dd3fc' }}>
                                {formatCurrency(metrics.invoicesTotal)}
                            </div>
                        </div>

                        <div style={{ background: 'rgba(16, 185, 129, 0.22)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(52, 211, 153, 0.45)' }}>
                            <div style={{ fontSize: '11px', color: '#a7f3d0', fontWeight: 800 }}>💰 المحصل الفعلي (سندات قبض)</div>
                            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, marginTop: '0.25rem', color: '#6ee7b7' }}>
                                {formatCurrency(metrics.totalCollectedRevenue)}
                            </div>
                        </div>

                        <div style={{ background: 'rgba(245, 158, 11, 0.22)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(251, 191, 36, 0.45)' }}>
                            <div style={{ fontSize: '11px', color: '#fef08a', fontWeight: 800 }}>⏳ المتبقي طرف العميل</div>
                            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, marginTop: '0.25rem', color: '#fde047' }}>
                                {formatCurrency(metrics.customerRemainingBalance)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3️⃣ شريط التبويبات المتناسق مع الثيم */}
                <div
                    style={{
                        display: 'flex',
                        gap: '0.35rem',
                        background: 'var(--surface-sunken, #f8fafc)',
                        padding: '0.65rem 1.25rem',
                        borderBottom: '1px solid var(--border-color, #e2e8f0)',
                        overflowX: 'auto',
                        flexShrink: 0
                    }}
                >
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    whiteSpace: 'nowrap',
                                    padding: '0.55rem 0.95rem',
                                    borderRadius: '10px',
                                    border: isActive ? `1px solid ${THEME.primary}` : '1px solid transparent',
                                    background: isActive ? THEME.primary : 'transparent',
                                    color: isActive ? '#ffffff' : 'var(--text-secondary, #475569)',
                                    fontWeight: 900,
                                    fontSize: 'var(--fs-xs)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <Icon size={14} />
                                <span>{tab.label}</span>
                                {tab.count !== null && (
                                    <span
                                        style={{
                                            background: isActive ? 'rgba(255,255,255,0.22)' : 'var(--surface-raised, #e2e8f0)',
                                            color: isActive ? '#ffffff' : 'var(--text-primary, #1e293b)',
                                            padding: '1px 6px',
                                            borderRadius: '999px',
                                            fontSize: '10px',
                                            fontWeight: 900
                                        }}
                                    >
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* 4️⃣ شريط تفصيلي إضافي عند فتح تبويب يوميات العمالة */}
                {activeTab === 'يوميات عمالة' && (
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
                            gap: '0.75rem',
                            padding: '1rem 1.5rem 0 1.5rem'
                        }}
                    >
                        <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.25)' }}>
                            <div style={{ fontSize: 'var(--fs-xs)', color: '#0369a1', fontWeight: 900 }}>👷 إجمالي أيام وتكلفة يومية الفنيين</div>
                            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#0284c7', marginTop: '0.2rem' }}>
                                {metrics.techDays} يوم عمل — {formatCurrency(metrics.techCost)}
                            </div>
                        </div>
                        <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: 'rgba(13, 148, 136, 0.08)', border: '1px solid rgba(13, 148, 136, 0.25)' }}>
                            <div style={{ fontSize: 'var(--fs-xs)', color: '#0f766e', fontWeight: 900 }}>🤝 إجمالي أيام وتكلفة يومية المساعدين</div>
                            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#0d9488', marginTop: '0.2rem' }}>
                                {metrics.helperDays} يوم عمل — {formatCurrency(metrics.helperCost)}
                            </div>
                        </div>
                        <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: 'var(--surface-sunken, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)' }}>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary, #475569)', fontWeight: 900 }}>📊 إجمالي يوميات العمالة على أمر الشغل</div>
                            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: 'var(--text-primary, #0f172a)', marginTop: '0.2rem' }}>
                                {metrics.totalLaborDays} يوم عمل — {formatCurrency(metrics.laborTotal)}
                            </div>
                        </div>
                    </div>
                )}

                {/* 5️⃣ محتوى الجدول أو الرسم البياني أو تقرير الطباعة */}
                <div style={{ padding: '1.25rem 1.5rem', flex: 1 }}>
                    {activeTab === 'تقرير الطباعة' ? (
                        <div style={{ maxWidth: '980px', margin: '0 auto', width: '100%', padding: '0.25rem 0 1.5rem 0' }}>
                            <div
                                className="no-print"
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '1rem',
                                    marginBottom: '1.25rem',
                                    padding: '1rem 1.25rem',
                                    background: 'var(--surface-sunken, #f8fafc)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color, #e2e8f0)'
                                }}
                            >
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: 900, color: 'var(--text-primary, #0f172a)' }}>
                                        📄 معاينة التقرير المالي والتشغيلي الرسمي لأمر الشغل
                                    </h3>
                                    <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary, #64748b)', fontWeight: 700 }}>
                                        جاهز للإخراج بصيغة PDF والطباعة على ورق A4 متضمناً كافة الرسوم البيانية وجداول المطابقة
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    style={{
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: '#ffffff',
                                        padding: '0.6rem 1.4rem',
                                        borderRadius: '10px',
                                        fontWeight: 900,
                                        cursor: 'pointer',
                                        border: 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
                                    }}
                                >
                                    <Printer size={16} /> طباعة هذا التقرير الآن (A4)
                                </button>
                            </div>

                            {renderPrintableDocument()}
                        </div>
                    ) : (
                        <>
                            {activeTab === 'مؤشرات الأداء' ? (
                                <div
                                    style={{
                                        padding: '1.5rem',
                                        background: 'var(--surface-sunken, #f8fafc)',
                                        borderRadius: '16px',
                                        border: '1px solid var(--border-color, #e2e8f0)'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                        <h3 style={{ margin: 0, color: 'var(--text-primary, #1e293b)', fontWeight: 900, fontSize: 'var(--fs-lg)' }}>
                                            مقارنة الميزانية والتكاليف الفعلية والتحصيل لأمر الشغل
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={handlePrint}
                                            style={{
                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                color: '#ffffff',
                                                padding: '0.45rem 1rem',
                                                borderRadius: '8px',
                                                border: 'none',
                                                fontWeight: 800,
                                                fontSize: 'var(--fs-xs)',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                                            }}
                                        >
                                            <Printer size={14} /> طباعة الرسم البياني والتقرير
                                        </button>
                                    </div>
                                    <div style={{ height: '22rem', width: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={[
                                                    {
                                                        name: jobOrder?.order_number || 'أمر الشغل',
                                                        'الميزانية التقديرية': metrics.boqBudget,
                                                        'فواتير المبيعات': metrics.totalBilledRevenue,
                                                        'المحصل الفعلي': metrics.totalCollectedRevenue,
                                                        'المتبقي على العميل': metrics.customerRemainingBalance,
                                                        'التكلفة الفعلية': metrics.totalActualCost
                                                    }
                                                ]}
                                                margin={{ top: 10, right: 20, left: 20, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: 800, fontSize: 13 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: 800 }} tickFormatter={(val) => val.toLocaleString('en-US')} />
                                                <Tooltip
                                                    formatter={(value: any) => formatCurrency(Number(value || 0))}
                                                    contentStyle={{
                                                        borderRadius: '12px',
                                                        border: '1px solid var(--border-color, #e2e8f0)',
                                                        background: 'var(--surface-card, #ffffff)',
                                                        color: 'var(--text-primary, #1e293b)',
                                                        fontWeight: 800
                                                    }}
                                                />
                                                <Legend wrapperStyle={{ paddingTop: '12px', fontWeight: 900, fontSize: '13px' }} iconType="circle" />
                                                <Bar dataKey="الميزانية التقديرية" fill={THEME.primary} radius={[8, 8, 0, 0]} barSize={36} />
                                                <Bar dataKey="فواتير المبيعات" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={36} />
                                                <Bar dataKey="المحصل الفعلي" fill="#10b981" radius={[8, 8, 0, 0]} barSize={36} />
                                                <Bar dataKey="المتبقي على العميل" fill="#f59e0b" radius={[8, 8, 0, 0]} barSize={36} />
                                                <Bar dataKey="التكلفة الفعلية" fill="#e11d48" radius={[8, 8, 0, 0]} barSize={36} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            ) : loading ? (
                                <LoadingScreen message="جاري استخراج دفتر أستاذ أمر الشغل..." fullScreen={false} />
                            ) : (
                                <div
                                    style={{
                                        borderRadius: '14px',
                                        border: '1px solid var(--border-color, #e2e8f0)',
                                        overflow: 'hidden',
                                        background: 'var(--surface-card, #ffffff)'
                                    }}
                                >
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                                        <thead>
                                            <tr
                                                style={{
                                                    background: 'var(--surface-sunken, #f8fafc)',
                                                    color: 'var(--text-secondary, #475569)',
                                                    fontSize: 'var(--fs-xs)',
                                                    fontWeight: 900,
                                                    borderBottom: '2px solid var(--border-color, #e2e8f0)'
                                                }}
                                            >
                                                <th style={{ padding: '0.85rem 1rem' }}>التاريخ</th>
                                                <th style={{ padding: '0.85rem 1rem' }}>نوع الحركة</th>
                                                <th style={{ padding: '0.85rem 1rem' }}>البيان التحليلي</th>
                                                <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>العدد / الأيام</th>
                                                <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>القيمة ({currencySymbol()})</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableRows.length > 0 ? (
                                                tableRows.map((row: any, i: number) => {
                                                    const badge = getTypeBadgeStyle(row.trans_type, row.trans_desc);
                                                    const isReceipt = row.trans_type === 'سندات قبض';
                                                    const isInvoice = row.trans_type === 'فواتير';
                                                    return (
                                                        <tr
                                                            key={row.source_id || i}
                                                            style={{
                                                                borderBottom: '1px solid var(--border-color, #f1f5f9)',
                                                                fontSize: 'var(--fs-sm)',
                                                                fontWeight: 800,
                                                                color: 'var(--text-primary, #1e293b)'
                                                            }}
                                                        >
                                                            <td style={{ padding: '0.85rem 1rem', direction: 'ltr', textAlign: 'right', color: 'var(--text-secondary, #64748b)', fontWeight: 800 }}>
                                                                {formatDateClean(row.trans_date)}
                                                            </td>
                                                            <td style={{ padding: '0.85rem 1rem' }}>
                                                                <span
                                                                    style={{
                                                                        display: 'inline-block',
                                                                        padding: '0.25rem 0.65rem',
                                                                        borderRadius: '8px',
                                                                        fontSize: '11px',
                                                                        fontWeight: 900,
                                                                        background: badge.bg,
                                                                        color: badge.color,
                                                                        border: `1px solid ${badge.border}`
                                                                    }}
                                                                >
                                                                    {badge.label}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>
                                                                {row.trans_desc}
                                                            </td>
                                                            <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 900 }} dir="ltr">
                                                                {row.qty ?? 1}
                                                            </td>
                                                            <td
                                                                style={{
                                                                    padding: '0.85rem 1rem',
                                                                    textAlign: 'left',
                                                                    fontWeight: 900,
                                                                    color: isReceipt ? '#16a34a' : isInvoice ? '#2563eb' : badge.color
                                                                }}
                                                                dir="ltr"
                                                            >
                                                                {isReceipt ? '+' : ''}{formatCurrency(row.amount)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td
                                                        colSpan={5}
                                                        style={{
                                                            textAlign: 'center',
                                                            padding: '3.5rem 1rem',
                                                            color: 'var(--text-secondary, #94a3b8)',
                                                            fontSize: 'var(--fs-md)',
                                                            fontWeight: 800
                                                        }}
                                                    >
                                                        لا توجد حركات مسجلة في هذا التبويب حتى الآن.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        {tableRows.length > 0 && (
                                            <tfoot>
                                                <tr
                                                    style={{
                                                        background: 'var(--surface-sunken, #f8fafc)',
                                                        borderTop: '2px solid var(--border-color, #cbd5e1)',
                                                        fontWeight: 900
                                                    }}
                                                >
                                                    <td colSpan={3} style={{ padding: '0.9rem 1rem', color: 'var(--text-primary, #0f172a)', fontSize: 'var(--fs-sm)' }}>
                                                        إجمالي التبويب المعروض ({tableRows.length} حركة)
                                                    </td>
                                                    <td style={{ padding: '0.9rem 1rem', textAlign: 'center', color: 'var(--text-secondary, #475569)' }} dir="ltr">
                                                        {activeTab === 'يوميات عمالة' ? `${metrics.totalLaborDays} يوم` : '-'}
                                                    </td>
                                                    <td style={{ padding: '0.9rem 1rem', textAlign: 'left', fontSize: 'var(--fs-md)', color: THEME.primary }} dir="ltr">
                                                        {formatCurrency(tabTotal)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            )}

                            {/* الحاوية الجاهزة دوماً للطباعة الفورية خارج الشاشة */}
                            <div
                                style={{
                                    position: 'fixed',
                                    left: '-99999px',
                                    top: 0,
                                    width: '920px',
                                    background: '#ffffff',
                                    zIndex: -1,
                                    pointerEvents: 'none'
                                }}
                                aria-hidden="true"
                            >
                                {renderPrintableDocument()}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
