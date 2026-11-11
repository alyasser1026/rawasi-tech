"use client";
import { currencyCode } from '@/lib/currency';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/helpers';
import ReportContactFooter from '@/components/ReportContactFooter';

export default function PrintClaimModal({ isOpen, onClose, claim, contractorName, assignments = [], deductions = [] }: any) {
    const [mounted, setMounted] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => { setMounted(true); }, []);

    // 🚀 استخراج أسماء كل الفلل المشاركة بدون تكرار للترويسة
    const allVillas = useMemo(() => {
        if (!assignments || assignments.length === 0) return claim?.projects?.Property || 'مجمع عقارات';
        const names = assignments.map((a: any) => a.projects?.Property).filter(Boolean);
        return Array.from(new Set(names)).join(' + ');
    }, [assignments, claim]);

    // 🎯 تجميع بنود الأعمال المتشابهة
    const groupedAssignments = useMemo(() => {
        if (!assignments || assignments.length === 0) return [];
        const groups: Record<string, any> = {};
        assignments.forEach((a: any) => {
            const itemName = a.boq_budget?.work_item || a.boq_items?.item_name || a.description || 'بند أعمال غير محدد';
            const unitName = a.boq_budget?.unit || a.boq_items?.unit_of_measure || 'م';
            const price = Number(a.unit_price || 0);
            const qty = Number(a.assigned_qty || 0);
            const projectName = a.projects?.Property || 'مشروع عام';
            const key = `${itemName}_${price}`;

            if (!groups[key]) {
                groups[key] = { itemName, unitName, price, totalQty: 0, totalAmount: 0, villas: new Set<string>() };
            }
            groups[key].totalQty += qty;
            groups[key].totalAmount += (qty * price);
            groups[key].villas.add(projectName);
        });
        return Object.values(groups).map(g => ({ ...g, villasList: Array.from(g.villas).join(' + ') }));
    }, [assignments]);

    // 🖨️ دالة الطباعة (window.print)
    const handlePrint = () => {
        document.title = `مستخلص_${contractorName}_${claim?.claim_number}`;
        window.print();
    };

    if (!isOpen || !mounted || !claim) return null;

    const totalWorkAmount = claim.total_amount || 0;
    
    // استخراج القيم من الأعمدة الجديدة في الداتا بيز
    const materialsDeductionDB = Number(claim.materials_deduction || 0);
    const expensesDeductionDB = Number(claim.deductions_amount || 0); 
    const otherDeductionsDB = Number(claim.other_deductions || 0);
    const advancePaymentDB = Number(claim.advance_payment || 0);

    // 🧮 حسابات السداد والمتبقي
    const netAmount = Number(claim.net_amount || 0);
    const paidAmount = Number(claim.paid_amount || 0);
    const remainingAmount = netAmount - paidAmount;

    let paymentStatus = 'غير مسدد';
    let statusColor = '#ef4444'; // أحمر
    let statusBg = '#fef2f2';

    if (paidAmount >= netAmount && netAmount > 0) {
        paymentStatus = 'مسدد بالكامل';
        statusColor = '#16a34a'; // أخضر
        statusBg = '#dcfce7';
    } else if (paidAmount > 0 && paidAmount < netAmount) {
        paymentStatus = 'مسدد جزئي';
        statusColor = '#d97706'; // برتقالي
        statusBg = '#fef3c7';
    }

    return createPortal(
        <div className="print-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 999999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)', direction: 'rtl', padding: '20px' }}>
            <div className="print-modal-backdrop" style={{ position: 'fixed', inset: 0 }} onClick={onClose} />
            
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap');

                /* إعدادات الطباعة للزوم التلقائي والاحتواء الكامل */
                @media print {
                    @page { size: A4 landscape; margin: 10mm; } 
                    
                    body * { visibility: hidden; }
                    
                    .print-modal-overlay { 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 100% !important; 
                        height: auto !important; 
                        margin: 0 !important; 
                        padding: 0 !important; 
                        visibility: visible !important;
                    }
                    
                    .print-modal-overlay * { visibility: visible; }
                    
                    .printable-area { 
                        position: relative !important; 
                        width: 100% !important; 
                        max-width: 100% !important; 
                        height: auto !important; 
                        max-height: none !important; 
                        overflow: visible !important; 
                        box-shadow: none !important; 
                        border: none !important; 
                        padding: 0 !important; 
                        margin: 0 !important; 
                        /* زوم أوت كافي لاحتواء الخلاصة المالية والتوقيعات */
                        zoom: 0.70 !important; 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact;
                    }

                    .print-modal-backdrop, .no-print { display: none !important; }
                    
                    /* حماية الخلاصة والتوقيعات من القص */
                    .summary-container { page-break-inside: avoid !important; margin-top: 30px !important; }
                    .signatures-container { page-break-inside: avoid !important; margin-top: 50px !important; }
                    tr { page-break-inside: avoid; }

                    /* الألوان الإجبارية للطباعة */
                    .summary-row.deduction, .summary-row.deduction * { color: #b91c1c !important; }
                    .summary-row.net, .summary-row.net * { color: #ffffff !important; background-color: #14532d !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .summary-row.paid { color: #16a34a !important; }
                    .summary-row.remaining { background-color: #fef3c7 !important; color: #b45309 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .vip-table th { background-color: #f1f5f9 !important; color: #0f172a !important; border-bottom: 2px solid #cbd5e1 !important; }
                    .summary-section { width: 55% !important; float: left; }
                    .status-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
                
                /* ---------------------------------------------------
                    تصميم الشاشة العادية - VIP Theme
                   --------------------------------------------------- */
                .printable-area { 
                    background: white; 
                    border-radius: 14px; 
                    width: 100%; 
                    max-width: 1150px; 
                    max-height: 95vh; 
                    overflow-y: auto; 
                    padding: 50px; 
                    position: relative; 
                    z-index: 10; 
                    box-shadow: 0 40px 60px -15px rgba(0,0,0,0.3); 
                    font-family: 'Tajawal', sans-serif; 
                    color: #0f172a; 
                }
                
                .company-header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 20px; margin-bottom: 35px; border-bottom: 1px solid #e2e8f0; }
                .company-brand { display: flex; align-items: center; gap: 15px; text-align: left; }
                .company-logo-img { height: 72px; object-fit: contain; }
                .company-logo-text { font-size: 32px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -1px; }
                .company-subtext { font-size: 14px; color: #64748b; margin: 2px 0 0 0; font-weight: 700; }
                
                .document-title { text-align: right; }
                .document-title h2 { margin: 0; font-size: 24px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; letter-spacing: 1px; }
                .document-title p { margin: 5px 0 0 0; font-size: 13px; color: #64748b; font-weight: 700; text-transform: uppercase; }

                .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 35px; }
                .info-card { background: #f8fafc; border-radius: 12px; padding: 18px 20px; position: relative; overflow: hidden; }
                .info-card::before { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 4px; background: #1e3a8a; border-radius: 0 4px 4px 0; }
                .info-card:nth-child(2)::before { background: #f59e0b; }
                .info-card:nth-child(3)::before { background: #10b981; }
                
                .info-label { font-size: 12px; color: #64748b; font-weight: 800; margin-bottom: 6px; display: block; }
                .info-value { font-size: 16px; color: #0f172a; font-weight: 900; }
                .info-value.highlight { color: #0f172a; font-size: 14px; line-height: 1.5; }

                .vip-table { width: 100%; border-collapse: collapse; margin-bottom: 35px; font-size: 13px; text-align: center; }
                .vip-table th { padding: 14px 10px; font-weight: 900; color: #475569; border-bottom: 2px solid #e2e8f0; font-size: 12px; }
                .vip-table td { padding: 14px 10px; font-weight: 800; border-bottom: 1px dashed #f1f5f9; color: #0f172a; }
                .vip-table tbody tr:hover td { background-color: #f8fafc; }
                
                .text-right { text-align: right !important; }
                .item-title { font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 4px; }
                .villa-badge { display: inline-block; background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 900; margin-bottom: 4px; }
                
                .highlight-blue { color: #2563eb !important; font-weight: 900 !important; }
                .highlight-green { color: #166534 !important; font-weight: 900 !important; }

                .summary-container { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; }
                .disclaimer-box { width: 42%; font-size: 12px; color: #64748b; font-weight: 700; line-height: 1.8; padding: 20px; background: #f8fafc; border-radius: 16px; }
                .disclaimer-box strong { color: #0f172a; font-size: 14px; display: block; margin-bottom: 10px; }
                
                .summary-section { width: 52%; }
                .summary-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 800; color: #0f172a; }
                
                .summary-row.deduction, .summary-row.deduction span { color: #b91c1c !important; } 
                
                .summary-row.net { padding: 18px 20px; background: #f0fdf4; border-radius: 12px; margin-top: 15px; border: none; align-items: center; background-color: #14532d; -webkit-print-color-adjust: exact; print-color-adjust: exact;}
                .summary-row.net span { color: #ffffff !important; }
                .summary-row.net span:first-child { font-size: 16px; font-weight: 900; }
                .summary-row.net span:last-child { font-size: 22px; font-weight: 900; }

                /* تنسيق سطر المسدد والمتبقي */
                .summary-row.paid { color: #16a34a; border-bottom: none; padding-top: 15px; }
                .summary-row.remaining { background-color: #fef3c7; border-radius: 12px; padding: 15px 20px; margin-top: 5px; border: none; color: #b45309; }
                
                .signatures-container { display: grid; grid-template-columns: repeat(4, 1fr); gap: 30px; margin-top: 70px; padding-top: 40px; }
                .signature-box { text-align: center; }
                .sig-title { font-weight: 900; color: #0f172a; font-size: 15px; margin-bottom: 60px; }
                .sig-sub { display: block; font-size: 11px; color: #94a3b8; font-weight: 700; margin-top: 4px; }
                .sig-line { border-bottom: 2px solid #cbd5e1; width: 85%; margin: 0 auto; }
            `}</style>

            <div className="printable-area cinematic-scroll">
                
                {/* 🚀 أزرار التحكم (لا تظهر في الطباعة) */}
                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '35px', background: '#f8fafc', padding: '15px 25px', borderRadius: '16px', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, color: '#0f172a', fontWeight: 900, fontSize: '18px' }}>معاينة مستخلص (شكل فني عصري)</h2>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <button onClick={handlePrint} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '12px 28px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(15,23,42,0.2)' }}>طباعة المستخلص</button>
                        <button onClick={onClose} style={{ background: '#f1f5f9', color: '#ef4444', border: 'none', padding: '12px 28px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}>إغلاق</button>
                    </div>
                </div>

                <div ref={printRef}>
                    
                    {/* 🏢 ترويسة الشركة */}
                    <div className="company-header">
                        <div className="document-title">
                            <h2>مستخلص أعمال</h2>
                            <p>SUBCONTRACTOR PAYMENT CERTIFICATE</p>
                        </div>
                        <div className="company-brand">
                            <div style={{ textAlign: 'left' }}>
                                <p className="company-subtext">إدارة المشاريع الهندسية والمقاولات</p>
                            </div>
                            <img src="/company-logo.svg" alt="فاي تك" className="company-logo-img" />
                        </div>
                    </div>

                    {/* 📋 كروت البيانات */}
                    <div className="info-grid">
                        <div className="info-card">
                            <span className="info-label">المقاول المنفذ / Subcontractor</span>
                            <div className="info-value">{contractorName}</div>
                        </div>
                        <div className="info-card">
                            <span className="info-label">نطاق الأعمال / Project Scope</span>
                            <div className="info-value highlight">{allVillas}</div>
                        </div>
                        <div className="info-card">
                            <span className="info-label">بيانات الدفع / Claim Info</span>
                            <div className="info-value">رقم المستخلص: <span style={{ color: '#1e3a8a' }}>{claim.claim_number}</span></div>
                            <div className="info-value" style={{ marginTop: '6px', fontSize: '13px', color: '#64748b' }}>التاريخ: {claim.date}</div>
                            {/* 🚀 بادج حالة السداد */}
                            <div className="status-badge" style={{ marginTop: '10px', display: 'inline-block', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 900, background: statusBg, color: statusColor, border: `1px solid ${statusColor}40` }}>
                                حالة السداد: {paymentStatus}
                            </div>
                        </div>
                    </div>

                    {/* 📊 الجدول الأول: الأعمال المنجزة */}
                    <div style={{ marginBottom: '15px', fontWeight: 900, color: '#0f172a', fontSize: '16px' }}>أولاً: بيان الأعمال المنجزة (Work Performed)</div>
                    <table className="vip-table">
                        <thead>
                            <tr>
                                <th style={{ width: '4%' }}>م</th>
                                <th className="text-right" style={{ width: '30%' }}>تفاصيل البند / Description</th>
                                <th style={{ width: '6%' }}>الوحدة</th>
                                <th style={{ width: '15%' }}>الكمية المنجزة</th>
                                <th style={{ width: '15%' }}>سعر الوحدة</th>
                                <th style={{ width: '30%' }}>إجمالي القيمة ({currencyCode()})</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedAssignments && groupedAssignments.length > 0 ? (
                                groupedAssignments.map((item: any, i: number) => (
                                    <tr key={i}>
                                        <td style={{ color: '#64748b' }}>{i + 1}</td>
                                        <td className="text-right">
                                            <span className="villa-badge">{item.villasList}</span>
                                            <div className="item-title">{item.itemName}</div>
                                        </td>
                                        <td>{item.unitName}</td>
                                        <td className="highlight-blue">{item.totalQty.toFixed(2)}</td>
                                        <td>{item.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                        <td className="highlight-green">{item.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} style={{ padding: '40px', color: '#94a3b8', fontSize: '14px' }}>
                                        هذا المستخلص تم تسجيله بقيمة مقطوعة ولا يحتوي على تفاصيل بنود حصر فرعية.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* 💰 الملخص المالي والتفقيط */}
                    <div className="summary-container">
                        
                        <div className="disclaimer-box">
                            <strong>إقرار استلام ومخالصة:</strong>
                            أقر أنا الموقع أدناه بصفتي ممثلاً عن الجهة المنفذة للأعمال، بأنني قمت بمراجعة كافة الكميات والأسعار أعلاه، وبأنها تمثل حصر دقيق ونهائي للأعمال المنجزة. وأقر باستلامي للصافي الموضح، ولا يحق لي الرجوع على الشركة بأي مطالبات مستقبلاً تخص هذه البنود.
                        </div>

                        <div className="summary-section">
                            <div className="summary-row">
                                <span>إجمالي قيمة الأعمال (Total Work)</span>
                                <span>{Number(totalWorkAmount).toLocaleString(undefined, {minimumFractionDigits: 2})} {currencyCode()}</span>
                            </div>
                            
                            {Number(claim.retention_amount || 0) > 0 && (
                                <div className="summary-row deduction">
                                    <span>(-) ضمان أعمال {claim.retention_percent || 0}% (Retention)</span>
                                    <span>{Number(claim.retention_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            )}

                            {materialsDeductionDB > 0 && (
                                <div className="summary-row deduction">
                                    <span>(-) خامات ومواد منصرفة (Materials)</span>
                                    <span>{materialsDeductionDB.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            )}

                             {expensesDeductionDB > 0 && (
                                <div className="summary-row deduction">
                                    <span>(-) مصروفات سابقة (Expenses)</span>
                                    <span>{expensesDeductionDB.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            )}

                            {advancePaymentDB > 0 && (
                                <div className="summary-row deduction">
                                    <span>(-) دفعات نقدية سلفة (Advances)</span>
                                    <span>{advancePaymentDB.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            )}

                            {otherDeductionsDB > 0 && (
                                <div className="summary-row deduction">
                                    <span>(-) خصومات أخرى وتسويات (Others)</span>
                                    <span>{otherDeductionsDB.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            )}

                            {/* سطر الصافي */}
                            <div className="summary-row net">
                                <span>الصافي المُستحق (Net Payable)</span>
                                <span>{netAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} {currencyCode()}</span>
                            </div>

                            {/* 🚀 سطور السداد والمتبقي تظهر فقط إذا كان هناك سداد جزئي أو كلي */}
                            {paidAmount > 0 && (
                                <>
                                    <div className="summary-row paid">
                                        <span>(-) ما تم سداده (Paid Amount)</span>
                                        <span>{paidAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} {currencyCode()}</span>
                                    </div>
                                    <div className="summary-row remaining">
                                        <span>المتبقي للصرف (Remaining Balance)</span>
                                        <span>{remainingAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} {currencyCode()}</span>
                                    </div>
                                </>
                            )}
                        </div>

                    </div>

                    {/* ✒️ التوقيعات */}
                    <div className="signatures-container">
                        <div className="signature-box">
                            <div className="sig-title">المقاول المستلم<span className="sig-sub">Subcontractor</span></div>
                            <div className="sig-line"></div>
                        </div>
                        <div className="signature-box">
                            <div className="sig-title">مهندس الموقع<span className="sig-sub">Site Engineer</span></div>
                            <div className="sig-line"></div>
                        </div>
                        <div className="signature-box">
                            <div className="sig-title">مدير المشاريع<span className="sig-sub">Project Manager</span></div>
                            <div className="sig-line"></div>
                        </div>
                        <div className="signature-box">
                            <div className="sig-title">الاعتماد المالي<span className="sig-sub">Finance Dept.</span></div>
                            <div className="sig-line"></div>
                        </div>
                    </div>

                    {/* 📱 فوتر جهات الاتصال الرسمية مع باركود vCard الذكي */}
                    <ReportContactFooter qrSize={56} style={{ marginTop: '25px' }} />

                </div>
            </div>
        </div>,
        document.body
    );
}