"use client";
import { currencyCode, currencyName } from '@/lib/currency';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/helpers';
import ReportContactFooter from '@/components/ReportContactFooter';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import { DocNote, DocSignatures, DocTotals, PHI_DOC_CSS } from '@/components/PrintDocument';

export default function MaterialReceiptPrintModal({ isOpen, onClose, logic, receiptId }: any) {
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => { 
        setMounted(true); 
    }, []);

    if (!isOpen || !mounted || !receiptId) return null;

    // 🚀 تجميع أصناف الفاتورة الحالية من الداتا المحملة
    const receiptItems = logic.data.filter((item: any) => item.receipt_id === receiptId);
    if (receiptItems.length === 0) return null;

    // استخراج بيانات الرأس (الماستر) من أول صنف
    const masterData = receiptItems[0];
    const totalAmount = receiptItems.reduce((sum: number, item: any) => sum + (Number(item.total_price) || 0), 0);

    return createPortal(
        <div className="print-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto', padding: '40px 15px', direction: 'rtl' }}>
            
            {/* 🖨️ ستايلات الطباعة والتصميم العصري */}
            <style dangerouslySetInnerHTML={{__html: `
                .print-page {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                @media print {
                    body * { visibility: hidden; }
                    .no-print { display: none !important; }
                    .print-page, .print-page * { visibility: visible; }
                    .print-page { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 100%; 
                        max-width: 100%;
                        height: auto;
                        box-shadow: none !important; 
                        padding: 10mm !important; 
                        margin: 0 !important; 
                        background: white !important;
                        border-radius: 0 !important;
                    }
                }
                
            `}} />
            <style>{PHI_DOC_CSS}</style>

            {/* 🖨️ أزرار التحكم */}
            <div className="no-print" style={{ display: 'flex', gap: '15px', marginBottom: '20px', width: '100%', maxWidth: '800px' }}>
                <button onClick={() => window.print()} style={{ flex: 1, padding: '15px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 900, cursor: 'pointer', fontSize: '16px', boxShadow: '0 10px 25px rgba(37, 99, 235, 0.3)', transition: '0.2s' }}>
                    طباعة إذن التوريد
                </button>
                <button onClick={onClose} style={{ padding: '15px 30px', background: 'white', color: '#ef4444', border: 'none', borderRadius: '16px', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', transition: '0.2s' }}>
                    إلغاء وإغلاق
                </button>
            </div>

            {/* 📄 ورقة الطباعة (Auto-fit on screen, A4 on print) */}
            <div className="print-page phi-doc phi-doc-page" style={{ position: 'relative', width: '95%', maxWidth: '800px', minHeight: 'fit-content', background: 'white', padding: '45px', borderRadius: '14px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', color: 'black', overflow: 'hidden' }}>
                
                {/* 1️⃣ الترويسة الرسمية الموحدة + بيانات الإذن */}
                <ReportOfficialHeader
                    title="إذن استلام خامات (Material Receipt Note)"
                    badgeText="مستند مخزني معتمد • STORE NOTE"
                    reportRefCode={`MRN-${String(receiptId).slice(-6).toUpperCase()}`}
                    refLabel="رقم الإذن"
                    issueDate={masterData.exp_date || undefined}
                    currency={`${currencyName()} (${currencyCode()})`}
                    compact
                    details={[
                        { label: 'المشروع الموجّه له الخامات', value: masterData.project?.Property || '---' },
                        { label: 'المورد / جهة التوريد', value: masterData.supplier?.name || '---' },
                        { label: 'عدد الأصناف', value: String(receiptItems.length) },
                        { label: 'إجمالي قيمة الإذن', value: formatCurrency(totalAmount), accent: true },
                    ]}
                />

                {/* 2️⃣ جدول الأصناف */}
                <table className="phi-doc-table">
                    <thead>
                        <tr>
                            <th style={{ width: '5%' }}>م</th>
                            <th className="is-start" style={{ width: '40%' }}>اسم الخامة / البيان</th>
                            <th style={{ width: '10%' }}>الكمية</th>
                            <th style={{ width: '10%' }}>الوحدة</th>
                            <th style={{ width: '15%' }}>سعر الوحدة</th>
                            <th style={{ width: '20%' }}>الإجمالي ({currencyCode()})</th>
                        </tr>
                    </thead>
                    <tbody>
                        {receiptItems.map((item: any, idx: number) => (
                            <tr key={idx}>
                                <td className="is-muted">{idx + 1}</td>
                                <td className="is-start is-strong">{item.work_item}</td>
                                <td className="is-strong">{item.quantity}</td>
                                <td>{item.unit}</td>
                                <td>{formatCurrency(item.unit_price)}</td>
                                <td className="is-strong">{formatCurrency(item.total_price)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* 3️⃣ الإقرار والإجمالي */}
                <div className="phi-doc-summary">
                    <div className="phi-doc-stack">
                        <DocNote title="إقرار استلام مخزني">
                            أقر أنا أمين المخزن / مهندس الموقع الموقع أدناه، باستلام كافة المواد والخامات المذكورة أعلاه بحالة جيدة ومطابقة للمواصفات، وقد تم إيداعها بعهدة المشروع المذكور وتوريدها للموقع الفعلي.
                        </DocNote>
                    </div>
                    <DocTotals rows={[{ label: 'عدد الأصناف', value: receiptItems.length }]} grand={{ label: 'إجمالي قيمة الإذن', value: formatCurrency(totalAmount) }} />
                </div>

                {/* 4️⃣ التوقيعات */}
                <DocSignatures slots={[
                    { title: 'أمين المخزن', en: 'Storekeeper (Receiver)' },
                    { title: 'مهندس الموقع', en: 'Site Engineer' },
                    { title: 'المدير المالي', en: 'Finance Manager' },
                ]} />

                {/* 📱 فوتر جهات الاتصال الرسمية مع باركود vCard الذكي */}
                <ReportContactFooter layout="minimal" style={{ marginTop: 'auto', paddingTop: '10px' }} />
            </div>
        </div>,
        document.body
    );
}