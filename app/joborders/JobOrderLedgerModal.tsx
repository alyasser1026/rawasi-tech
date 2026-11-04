"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import LoadingScreen from '@/components/LoadingScreen';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
export default function JobOrderLedgerModal({ isOpen, onClose, jobOrder }: any) {
    const [activeTab, setActiveTab] = useState('خامات مصروفة');
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

            // 1. جلب السجل الأساسي (خامات، عمالة)
            const { data: ledger } = await supabase
                .from('job_order_ledger_view')
                .select('*')
                .eq('job_order_id', targetId)
                .order('trans_date', { ascending: false });

            // 2. جلب المصروفات المباشرة (اللي مربوطة بـ job_order_id مباشرة)
            const { data: directExpenses } = await supabase
                .from('expenses')
                .select('exp_date, description, total_price')
                .eq('job_order_id', targetId)
                .eq('is_deleted', false);

            // 3. 🚀 جلب "التحميل المالي" (المصروفات العامة الموزعة) من الفيو الجديد
            const { data: allocatedOverheads } = await supabase
                .from('advanced_cost_allocation_view')
                .select('*')
                .eq('job_order_id', targetId);

            // دمج كل الداتا في مصفوفة واحدة
            const allLedger = [
                ...(ledger || []),
                ...(directExpenses || []).map(e => ({
                    trans_date: e.exp_date,
                    trans_desc: e.description,
                    amount: e.total_price,
                    trans_type: 'مصروفات نثرية',
                    qty: 1
                })),
                ...(allocatedOverheads || []).map(ao => ({
                    trans_date: ao["تاريخ المصروف الأصلي"],
                    trans_desc: `[تحميل مالي] ${ao["البيان / الوصف"]} (${ao["آلية التوزيع"]})`,
                    amount: ao["المبلغ المحمل (ر.س)"],
                    trans_type: 'مصروفات نثرية',
                    qty: '-'
                }))
            ];

            // 4. جلب الإسناد والمستخلصات
            const { data: assignments } = await supabase
                .from('contractor_assignments')
                .select(`
                    id, assigned_qty, unit_price, claim_id,
                    sub_claims ( id, claim_number, date, total_amount, net_amount, paid_amount, materials_deduction, other_deductions, advance_payment, retention_amount, status )
                `)
                .eq('job_order_id', targetId);

            // 5. جلب دفعات الصرف المباشرة لأمر الشغل (إن وجدت)
            try {
                const { data: directPVs, error: pvErr } = await supabase
                    .from('payment_vouchers')
                    .select('id, voucher_number, date, amount, description')
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
                    if (claimObj && !uniqueClaims.find(c => c.id === claimObj.id)) {
                        uniqueClaims.push(claimObj);
                    }
                });
                setClaimsData(uniqueClaims);
            }

            setLoading(false);
        };

        fetchData();
    }, [isOpen, jobOrder]);

    useEffect(() => {
        if (jobOrder?.executor_type === 'مقاول باطن') {
            setActiveTab('خامات مصروفة');
        } else {
            setActiveTab('يوميات عمالة');
        }
    }, [jobOrder?.executor_type]);

    if (!isOpen) return null;

    // 🚀 الحسابات المحاسبية الدقيقة (المعادلة الموزونة)
    const isSubcontractor = jobOrder?.executor_type === 'مقاول باطن';
    
    // 1. حساب إجمالي قيمة أعمال الفيلا الحالية
    let totalWorkValue = 0;
    let assignmentQty = 0;
    let assignmentPrice = 0;

    if (assignmentData.length > 0) {
        assignmentData.forEach(a => {
            assignmentQty += Number(a.assigned_qty || 0);
            assignmentPrice = Number(a.unit_price || 0); 
            totalWorkValue += Number(a.assigned_qty || 0) * Number(a.unit_price || 0);
        });
    } else {
        assignmentQty = Number(jobOrder?.assigned_qty || 0);
        assignmentPrice = Number(jobOrder?.unit_price || 0);
        totalWorkValue = assignmentQty * assignmentPrice;
    }
    
    // 2. تفصيل الخصومات (خامات + مصروفات + عمالة) الخاصة بهذه الفيلا
    const materialsTotal = ledgerData.filter(d => d.trans_type === 'خامات مصروفة').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expensesTotal = ledgerData.filter(d => d.trans_type === 'مصروفات نثرية').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const laborTotal = ledgerData.filter(d => d.trans_type === 'يوميات عمالة').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const directExpensesTotal = ledgerData.filter(d => d.trans_type === 'مصروفات نثرية' && !String(d.trans_desc).includes('[تحميل مالي]')).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const allocatedExpensesTotal = ledgerData.filter(d => d.trans_type === 'مصروفات نثرية' && String(d.trans_desc).includes('[تحميل مالي]')).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    
    // 3. الصافي التقديري للفيلا (أساس النسبة)
    const estimatedNet = totalWorkValue - materialsTotal - expensesTotal;
    
    // 4. 🚀 معالجة المستخلصات واستخراج نصيب الفيلا من (السداد + الضمان + السلفة)
    let paymentsTotal = 0;
    let advanceTotal = 0;
    let retentionTotal = 0;

    const processedClaims = claimsData.map(c => {
        // أساس المستخلص = الإجمالي الكلي - خامات الكلية - مصروفات الكلية
        const claimBase = Number(c.total_amount || 0) - Number(c.materials_deduction || 0) - Number(c.other_deductions || 0);
        
        // 🚀 النسبة والتناسب: صافي الفيلا / صافي المستخلص
        let ratio = 0;
        if (claimBase > 0 && estimatedNet > 0) {
            ratio = estimatedNet / claimBase;
        }
        
        // تأمين النسبة (لا تتعدى 100% ولا تقل عن صفر)
        if (ratio > 1) ratio = 1;
        if (ratio < 0) ratio = 0;

        const allocPaid = Number(c.paid_amount || 0) * ratio;
        const allocAdvance = Number(c.advance_payment || 0) * ratio;
        const allocRet = Number(c.retention_amount || 0) * ratio;

        paymentsTotal += allocPaid;
        advanceTotal += allocAdvance;
        retentionTotal += allocRet;

        return {
            ...c,
            ratio,
            allocPaid,
            allocAdvance,
            allocRet
        };
    });
    
    // 🚀 إضافة سندات الصرف المباشرة لأمر الشغل (بدون مستخلص) إلى إجمالي المدفوع
    const directPaymentsTotal = directPaymentsData.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    paymentsTotal += directPaymentsTotal;
    
    // 5. المتبقي الفعلي والصافي للاستحقاق الآن
    const remainingBalance = estimatedNet - paymentsTotal - advanceTotal - retentionTotal;

    // تجهيز الجدول حسب التاب
    let tableRows: any[] = [];
    if (activeTab === 'دفعات مقاولين') {
        processedClaims.forEach(c => {
            if (c.allocPaid > 0) {
                tableRows.push({ trans_date: c.date, trans_desc: `سداد مستخلص #${c.claim_number} | حصة الفيلا (${(c.ratio * 100).toFixed(1)}%)`, qty: '-', amount: c.allocPaid });
            }
            if (c.allocAdvance > 0) {
                 tableRows.push({ trans_date: c.date, trans_desc: `دفعة مقدمة مخصومة من مستخلص #${c.claim_number}`, qty: '-', amount: c.allocAdvance });
            }
            if (c.allocRet > 0) {
                 tableRows.push({ trans_date: c.date, trans_desc: `محتجز ضمان أعمال من مستخلص #${c.claim_number}`, qty: '-', amount: c.allocRet });
            }
        });

        // إدراج سندات الصرف المباشرة المسجلة على أمر الشغل
        directPaymentsData.forEach(p => {
            tableRows.push({
                trans_date: p.date,
                trans_desc: `سند صرف مباشر #${p.voucher_number} | ${p.description || 'دفعة نقدية مسجلة مباشرة'}`,
                qty: '-',
                amount: Number(p.amount || 0)
            });
        });
    } else {
        tableRows = ledgerData.filter(d => d.trans_type === activeTab);
    }
    
    const tabTotal = tableRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const tabs = [
        { id: 'مؤشرات الأداء', label: 'مؤشرات الأداء' },
        { id: 'خامات مصروفة', label: 'الخامات' },
        { id: 'مصروفات نثرية', label: 'مصروفات' },
        { id: 'دفعات مقاولين', label: 'المستخلصات (سداد وخصم)' },
        { id: 'يوميات عمالة', label: 'العمالة' },
    ];

    const modalContent = (
        <div className="modal-overlay" onClick={onClose}>
            <style>{`
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(15px); display: flex; align-items: center; justify-content: center; z-index: 999999; }
                .modal-content { width: 95vw; max-width: 1100px; max-height: 90vh; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.8); border-radius: 14px; display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; animation: slideUp 0.4s cubic-bezier(0.165, 0.84, 0.44, 1); box-shadow: 0 30px 60px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(255,255,255,0.5); direction: rtl; }
                @keyframes slideUp { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
                .tab-btn { min-width: 120px; white-space: nowrap; padding: 18px 25px; border: none; background: transparent; font-weight: 900; cursor: pointer; border-bottom: 3px solid transparent; color: #64748b; transition: all 0.3s ease; font-size: 15px; flex: 1; position: relative; }
                .tab-btn::after { content: ''; position: absolute; bottom: -1px; left: 50%; width: 0; height: 3px; background: #c2410c; transition: all 0.3s ease; transform: translateX(-50%); }
                .tab-btn.active { color: #1e293b; background: linear-gradient(0deg, rgba(194,65,12, 0.05) 0%, transparent 100%); }
                .tab-btn.active::after { width: 100%; }
                .tab-btn:hover:not(.active) { color: #1e293b; background: rgba(0,0,0,0.02); }
            `}</style>

            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98))', padding: '30px 20px', color: 'white', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #c2410c, #fcd34d, #c2410c)' }}></div>
                    <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(194,65,12, 0.15) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }}></div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px', position: 'relative', zIndex: 1 }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 'clamp(18px, 4vw, 26px)', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                                {isSubcontractor ? 'كشف حساب مقاول الباطن' : 'دفتر أستاذ التشغيل'}
                                <span style={{ fontSize: '14px', background: 'rgba(255,255,255,0.1)', padding: '6px 15px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(5px)', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                                    أمر رقم: <span style={{ color: '#c2410c' }}>{jobOrder?.order_number}</span>
                                </span>
                            </h2>
                            <p style={{ margin: '15px 0 0 0', color: '#cbd5e1', fontSize: '15px', fontWeight: 800 }}>
                                <span style={{ color: '#fff' }}>{jobOrder?.projects?.Property}</span> &nbsp;|&nbsp;<span style={{ color: '#fff' }}>{jobOrder?.boq_budget?.work_item || jobOrder?.job_order_name}</span>
                                {isSubcontractor && <span style={{ color: '#c2410c' }}> &nbsp;|&nbsp; المقاول: {jobOrder?.partners?.name || 'غير محدد'}</span>}
                            </p>
                        </div>
                        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '12px 25px', borderRadius: '14px', cursor: 'pointer', fontWeight: 900, transition: 'all 0.3s', fontSize: '15px', backdropFilter: 'blur(10px)' }} onMouseOver={e => { e.currentTarget.style.background='rgba(239, 68, 68, 0.9)'; e.currentTarget.style.borderColor='rgba(239, 68, 68, 1)'; e.currentTarget.style.boxShadow='0 5px 15px rgba(239, 68, 68, 0.4)'; }} onMouseOut={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.2)'; e.currentTarget.style.boxShadow='none'; }}>إغلاق ✖</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '35px', position: 'relative', zIndex: 1 }}>
                        {/* الصف الأول: التفاصيل والمصروفات */}
                        <div className="responsive-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.06)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>خامات منصرفة</div>
                                <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '8px', color: '#f8fafc' }}>{formatCurrency(materialsTotal)}</div>
                            </div>
                            
                            {isSubcontractor ? (
                                <div style={{ background: 'rgba(255,255,255,0.06)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>مستخلصات المقاول</div>
                                    <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '8px', color: '#f8fafc' }}>{formatCurrency(paymentsTotal + advanceTotal + retentionTotal)}</div>
                                </div>
                            ) : (
                                <div style={{ background: 'rgba(255,255,255,0.06)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>يوميات عمالة</div>
                                    <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '8px', color: '#f8fafc' }}>{formatCurrency(laborTotal)}</div>
                                </div>
                            )}

                            <div style={{ background: 'rgba(255,255,255,0.06)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>مصروفات مباشرة</div>
                                <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '8px', color: '#f8fafc' }}>{formatCurrency(directExpensesTotal)}</div>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.06)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>مصروفات محملة</div>
                                <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '8px', color: '#f8fafc' }}>{formatCurrency(allocatedExpensesTotal)}</div>
                            </div>
                        </div>

                        {/* الصف الثاني: المؤشرات الرئيسية */}
                        <div className="responsive-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>{isSubcontractor ? 'قيمة الإسناد المقدرة' : 'الميزانية المعتمدة'}</div>
                                <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '8px', color: '#c2410c' }}>{formatCurrency(isSubcontractor ? totalWorkValue : (jobOrder?.boq_total_budget || 0))}</div>
                            </div>

                            <div style={{ background: 'rgba(244, 63, 94, 0.1)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(244, 63, 94, 0.3)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(244, 63, 94, 0.1)' }}>
                                <div style={{ fontSize: '11px', color: '#fda4af', fontWeight: 800 }}>إجمالي التكلفة الحقيقية</div>
                                <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '8px', color: '#f43f5e' }}>
                                    {formatCurrency(materialsTotal + directExpensesTotal + allocatedExpensesTotal + (isSubcontractor ? (paymentsTotal + advanceTotal + retentionTotal) : laborTotal))}
                                </div>
                            </div>

                            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(16, 185, 129, 0.4)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(16, 185, 129, 0.1)' }}>
                                <div style={{ fontSize: '11px', color: '#a7f3d0', fontWeight: 800 }}>{isSubcontractor ? 'المتبقي للفيلا' : 'صافي الربح / (الخسارة)'}</div>
                                <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '8px', color: '#10b981' }}>{formatCurrency(isSubcontractor ? remainingBalance : (jobOrder?.total_profit_or_loss || 0))}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', background: 'rgba(248, 250, 252, 0.8)', padding: '0 20px', borderBottom: '1px solid #e2e8f0', overflowX: 'auto', backdropFilter: 'blur(10px)', flexShrink: 0 }}>
                    {tabs.map(tab => (
                        <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Table Data */}
                <div style={{ padding: '20px', flexShrink: 0 }}>
                    {activeTab === 'مؤشرات الأداء' ? (
                        <div style={{ height: '450px', width: '100%', padding: '30px', background: 'rgba(255, 255, 255, 0.7)', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.8)', boxShadow: '0 10px 30px rgba(0,0,0,0.03)', backdropFilter: 'blur(20px)' }}>
                            <h3 style={{ textAlign: 'center', marginBottom: '30px', color: '#1e293b', fontWeight: 900, fontSize: '20px' }}>تحليل ميزانية أمر التشغيل</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[
                                    { 
                                        name: 'التحليل المالي', 
                                        'الميزانية المعتمدة': isSubcontractor ? totalWorkValue : (jobOrder?.boq_total_budget || 0), 
                                        'التكلفة الفعلية': isSubcontractor ? (paymentsTotal + advanceTotal + retentionTotal) : (jobOrder?.effective_cost || 0),
                                        'صافي الربح / (الخسارة)': isSubcontractor ? estimatedNet : (jobOrder?.total_profit_or_loss || 0)
                                    }
                                ]} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: 800, fontSize: 14 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: 800 }} tickFormatter={(val) => val.toLocaleString()} />
                                    <Tooltip cursor={{ fill: 'rgba(194,65,12, 0.05)' }} contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', backdropFilter: 'blur(10px)', background: 'rgba(255,255,255,0.9)' }} itemStyle={{ fontWeight: 900, fontSize: '15px' }} />
                                    <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 900, fontSize: '14px' }} iconType="circle" />
                                    <Bar dataKey="الميزانية المعتمدة" fill="#c2410c" radius={[8, 8, 0, 0]} barSize={70} />
                                    <Bar dataKey="التكلفة الفعلية" fill="#f43f5e" radius={[8, 8, 0, 0]} barSize={70} />
                                    <Bar dataKey="صافي الربح / (الخسارة)" fill="#10b981" radius={[8, 8, 0, 0]} barSize={70} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : loading ? (
                        <LoadingScreen message="جاري استخراج السجل المالي بدقة..." fullScreen={false} />
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#f1f5f9', color: '#475569', fontSize: '12px', textAlign: 'right', position: 'sticky', top: '-20px', zIndex: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                                <tr>
                                    <th style={{ padding: '14px 20px', borderRadius: '0 12px 12px 0', background: '#f1f5f9' }}>التاريخ</th>
                                    <th style={{ padding: '14px 20px', background: '#f1f5f9' }}>البيان التحليلي</th>
                                    <th style={{ padding: '14px 20px', background: '#f1f5f9' }}>الكمية</th>
                                    <th style={{ padding: '14px 20px', borderRadius: '12px 0 0 0', background: '#f1f5f9' }}>القيمة (ر.س)</th>
                                </tr>
                            </thead>
                            <tbody style={{ background: 'rgba(255,255,255,0.5)' }}>
                                {tableRows.length > 0 ? tableRows.map((row: any, i: number) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: '14px', fontWeight: 800, color: '#1e293b', transition: 'all 0.3s' }} onMouseOver={e => { e.currentTarget.style.background='rgba(194,65,12, 0.05)'; e.currentTarget.style.transform='scale(1.005)'; }} onMouseOut={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.transform='scale(1)'; }}>
                                        <td style={{ padding: '18px 20px' }}>{new Date(row.trans_date).toLocaleDateString('ar-EG')}</td>
                                        <td style={{ padding: '18px 20px' }}>{row.trans_desc}</td>
                                        <td style={{ padding: '18px 20px' }}>{row.qty || '-'}</td>
                                        <td style={{ padding: '18px 20px', color: '#1e293b', fontWeight: 900 }}>{formatCurrency(row.amount)}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '80px', color: '#94a3b8', fontSize: '16px', fontWeight: 800 }}>لا توجد حركات مسجلة في هذا البند حتى الآن.</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* تمت إزالة السامري السفلي ليكون مدمجاً في الأعلى بناء على طلب العميل */}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}