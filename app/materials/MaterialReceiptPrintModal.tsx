"use client";
import { currencyCode, currencyName } from '@/lib/currency';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/helpers';
import ReportContactFooter from '@/components/ReportContactFooter';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import { DocNote, DocSignatures, DocTotals, PHI_DOC_CSS } from '@/components/PrintDocument';
import { printWithDocumentTitle } from '@/lib/printWithTitle';

export default function MaterialReceiptPrintModal({ isOpen, onClose, logic, receiptId }: any) {
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => { 
        setMounted(true); 
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen || !mounted || !receiptId) return null;

    // 🚀 تجميع أصناف الفاتورة الحالية من الداتا المحملة
    const receiptItems = logic.data.filter((item: any) => item.receipt_id === receiptId);
    if (receiptItems.length === 0) return null;

    // استخراج بيانات الرأس (الماستر) من أول صنف
    const masterData = receiptItems[0];
    const totalAmount = receiptItems.reduce((sum: number, item: any) => sum + (Number(item.total_price) || 0), 0);
    const mrnCode = `MRN-${String(receiptId).slice(-6).toUpperCase()}`;

    const handlePrintReceipt = () => {
        printWithDocumentTitle({
            docType: 'إذن_استلام_خامات',
            docNumber: mrnCode,
            subject: masterData.supplier?.name || masterData.project?.Property,
            prefix: 'MRN',
            issueDate: masterData.exp_date || undefined,
        });
    };

    return createPortal(
        <div className="print-modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'var(--modal-scrim, rgba(5, 7, 11, 0.82))', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'block', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', padding: '24px 15px 48px', direction: 'rtl' }}>
            
            {/* 🖨️ ستايلات الطباعة والتصميم العصري */}
            <style dangerouslySetInnerHTML={{__html: `
                .print-page {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                @media print {
                    html, body {
                        width: auto !important;
                        height: auto !important;
                        min-height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        overflow: visible !important;
                    }
                    body > *:not(.print-modal-overlay) { display: none !important; }
                    .no-print { display: none !important; }
                    .print-modal-overlay {
                        position: static !important;
                        width: auto !important;
                        height: auto !important;
                        min-height: 0 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        background: #ffffff !important;
                        overflow: visible !important;
                        display: block !important;
                    }
                    .print-page {
                        position: static !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        height: auto !important;
                        min-height: 0 !important;
                        box-shadow: none !important;
                        padding: 10mm !important;
                        margin: 0 !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        border-radius: 0 !important;
                        overflow: visible !important;
                    }
                }
                
            `}} />
            <style>{PHI_DOC_CSS}</style>

            {/* 🖨️ أزرار التحكم */}
            <div className="no-print" onClick={(e) => e.stopPropagation()} style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', gap: '12px', margin: '0 auto 20px', width: '100%', maxWidth: '800px' }}>
                <button onClick={handlePrintReceipt} style={{ flex: 1, padding: '14px 20px', background: 'var(--action-fill)', color: 'var(--action-ink)', border: 'none', borderRadius: '14px', fontWeight: 900, cursor: 'pointer', fontSize: 'var(--fs-md)', boxShadow: '0 8px 24px -6px var(--accent-glow)', transition: '0.2s' }}>
                    طباعة إذن التوريد
                </button>
                <button onClick={onClose} style={{ padding: '14px 28px', background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1px solid var(--control-edge, rgba(148, 163, 184, 0.2))', borderRadius: '14px', fontWeight: 900, cursor: 'pointer', boxShadow: 'var(--shadow-elevation)', transition: '0.2s' }}>
                    إلغاء وإغلاق
                </button>
            </div>

            {/* 📄 ورقة الطباعة (Auto-fit on screen, A4 on print) */}
            <div className="print-page phi-doc phi-doc-page" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: '95%', maxWidth: '800px', height: 'auto', minHeight: 'fit-content', margin: '0 auto', background: 'white', padding: '45px', borderRadius: '14px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', color: 'black', overflow: 'visible' }}>
                
                {/* 1️⃣ الترويسة الرسمية الموحدة + بيانات الإذن */}
                <ReportOfficialHeader
                    title="إذن استلام خامات (Material Receipt Note)"
                    badgeText="مستند مخزني معتمد • STORE NOTE"
                    reportRefCode={mrnCode}
                    refPrefix="MRN"
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