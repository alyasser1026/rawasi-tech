"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; 
import { formatCurrency, tafqeet } from '@/lib/helpers'; 
import { currencyCode, currencyName } from '@/lib/currency';
import { supabase } from '@/lib/supabase';
import ReportContactFooter from '@/components/ReportContactFooter';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import { DocSignatures, DocTotals, DocWords, PHI_DOC_CSS } from '@/components/PrintDocument';

export default function ExpensePrintModal({ isOpen, onClose, record, projects }: any) {
    const [mounted, setMounted] = useState(false); 
    const [creatorInfo, setCreatorInfo] = useState<{username: string, fullName: string} | null>(null); 

    useEffect(() => {
        setMounted(true);
    }, []);

    // 🚀 جلب بيانات منشئ المصروف
    useEffect(() => {
        const fetchCreatorInfo = async () => {
            if (!isOpen) return;

            try {
                const { data: { session } } = await supabase.auth.getSession();
                const targetUserId = record?.created_by || session?.user?.id;

                let fetchedFullName = '';
                let fetchedUsername = '';

                if (targetUserId) {
                    const { data: profile, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', targetUserId)
                        .single();
                    
                    if (!error && profile) {
                        fetchedFullName = profile.full_name || profile.name || profile.nickname || '';
                        fetchedUsername = profile.username || profile.email || '';
                    }
                }

                if (!fetchedFullName && session?.user) {
                    fetchedFullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';
                }
                if (!fetchedUsername && session?.user) {
                    fetchedUsername = session.user.email ? session.user.email.split('@')[0] : '';
                }

                setCreatorInfo({ 
                    username: fetchedUsername || 'مستخدم النظام', 
                    fullName: fetchedFullName || record?.created_by_name || 'المحاسب المعتمد' 
                });

            } catch (err) {
                console.error("خطأ في جلب بيانات المحاسب للباركود:", err);
            }
        };
        fetchCreatorInfo();
    }, [isOpen, record?.created_by]);

    if (!isOpen || !mounted || !record) return null;

    const handlePrintOrPDF = () => {
        const originalTitle = document.title;
        document.title = record?.expense_number ? `مصروف_${record.expense_number}` : 'سند_صرف';
        window.print();
        setTimeout(() => { document.title = originalTitle; }, 1000);
    };

    // 🚀 التحديث السحري: دعم طباعة الأصناف المتعددة (Hybrid Model)
    const linesToPrint = (record?.lines_data && record.lines_data.length > 0) 
        ? record.lines_data 
        : [{
            description: record?.description || 'مصروف عام',
            quantity: Number(record?.quantity || 1),
            unit_price: Number(record?.unit_price || record?.amount || 0),
            total_price: Number(record?.quantity || 1) * Number(record?.unit_price || record?.amount || 0)
        }];

    // 🚀 حسابات المصروف الموزونة
    const subtotal = linesToPrint.reduce((sum: number, line: any) => sum + (Number(line.quantity || 1) * Number(line.unit_price || 0)), 0);
    const vat = Number(record.vat_amount || 0);
    const discount = Number(record.discount_amount || 0);
    const grandTotal = subtotal + vat - discount;

    const finalFullName = creatorInfo?.fullName || 'المحاسب المعتمد';
    
    // 🚀 توقيت الإنشاء
    const creationDateObj = record?.created_at ? new Date(record.created_at) : (record?.exp_date ? new Date(record.exp_date) : new Date());
    const creationTime = creationDateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const creationDate = creationDateObj.toLocaleDateString('en-GB');
    
    const signatureData = `تم الاعتماد إلكترونياً\nتاريخ الإصدار: ${creationDate}\nوقت الإصدار: ${creationTime}\nبواسطة: ${finalFullName}`;
    const amountInWords = tafqeet(grandTotal);

    // 📦 محتوى المعاينة 
    const modalContent = (
        <div className="print-modal-overlay">
            
            <style>{`
                /* تم استرجاع كلاس الخلفية عشان المودال يظهر فوق الشاشة وما يختفيش */
                .print-modal-overlay { 
                    position: fixed !important; inset: 0 !important; 
                    background: rgba(40, 24, 10, 0.85) !important; 
                    backdrop-filter: blur(10px) !important; 
                    z-index: 999999999 !important; 
                    display: flex !important; flex-direction: column !important; 
                    align-items: center !important; justify-content: flex-start !important; 
                    padding: 30px 20px !important; overflow-y: auto !important; 
                    font-family: 'Arial', sans-serif; 
                }

                .print-actions-bar {
                    display: flex !important; gap: 15px !important; margin-bottom: 25px !important;
                    background: white !important; padding: 15px 30px !important; border-radius: 50px !important;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3) !important; position: sticky !important; 
                    top: 20px !important; z-index: 1000000000 !important; 
                }
                .action-btn { padding: 12px 25px; border-radius: 10px; border: none; font-weight: 900; font-size: 16px; cursor: pointer; transition: 0.2s; }
                .action-btn.print { background: var(--accent-ink); color: white; box-shadow: var(--shadow-elevation); }
                .action-btn.close { background: #fee2e2; color: #dc2626; }

                .a4-preview-box {
                    width: 210mm !important; min-height: 297mm !important; background: white !important; color: #000;
                    padding: 15mm !important; margin: 0 auto 40px auto !important; box-shadow: 0 20px 50px rgba(0,0,0,0.4);
                    direction: rtl; border-radius: 14px !important; overflow: hidden !important;
                    display: flex !important; flex-direction: column !important; box-sizing: border-box !important; 
                }

                @media print {
                    html, body { width: auto !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; color: #000000 !important; overflow: visible !important; }
                    body > *:not(.print-modal-overlay) { display: none !important; }
                    .no-print, .print-actions-bar { display: none !important; }
                    .print-modal-overlay { position: static !important; width: auto !important; height: auto !important; min-height: 0 !important; display: block !important; background: #ffffff !important; padding: 0 !important; margin: 0 !important; overflow: visible !important; }
                    .a4-preview-box { position: static !important; width: auto !important; max-width: 100% !important; height: auto !important; min-height: 0 !important; margin: 0 !important; box-shadow: none !important; border: none !important; padding: 12mm !important; box-sizing: border-box !important; direction: rtl !important; display: block !important; border-radius: 0 !important; background: #ffffff !important; color: #000000 !important; overflow: visible !important; page-break-after: auto !important; page-break-inside: auto !important; break-inside: auto !important; }
                }
            `}</style>
            <style>{PHI_DOC_CSS}</style>

            <div className="print-actions-bar no-print">
                <button onClick={handlePrintOrPDF} className="action-btn print">طباعة السند</button>
                <button onClick={onClose} className="action-btn close">إغلاق المعاينة</button>
            </div>

            <div className="a4-preview-box phi-doc phi-doc-page">
                
                {/* 1️⃣ الترويسة الرسمية الموحدة + بيانات السند */}
                <ReportOfficialHeader
                    title="سند مصروف (Expense Voucher)"
                    badgeText="مستند مالي معتمد • FINANCIAL VOUCHER"
                    reportRefCode={record.expense_number || record.id?.slice(0, 8)?.toUpperCase() || undefined}
                    refLabel="رقم السند"
                    issueDate={creationDate}
                    meta={[{ label: 'وقت الإصدار', value: creationTime, ltr: true }]}
                    currency={`${currencyName()} (${currencyCode()})`}
                    compact
                    details={[
                        { label: 'المستفيد / المورد', value: record.sub_contractor || record.payee_name || undefined },
                        { label: 'المشروع', value: record.site_ref || 'عام' },
                        { label: 'حساب المصروف', value: record.creditor_account },
                        { label: 'حساب السداد', value: record.payment_account },
                    ]}
                />

                {/* 3️⃣ جدول البنود (🚀 يدعم الآن الأصناف المتعددة!) */}
                <table className="inv-table phi-doc-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40px' }}>#</th>
                            <th className="is-start">البيان التفصيلي / Description</th>
                            <th style={{ width: '80px' }}>الكمية</th>
                            <th style={{ width: '120px' }}>سعر الوحدة</th>
                            <th style={{ width: '150px' }}>الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {linesToPrint.map((line: any, idx: number) => {
                            const lineTotal = Number(line.quantity || 1) * Number(line.unit_price || 0);
                            return (
                                <tr key={idx}>
                                    <td>{idx + 1}</td>
                                    <td className="is-start is-strong">{line.description || 'مصروف'}{line.notes && <small>{line.notes}</small>}</td>
                                    <td>{line.quantity || 1}</td>
                                    <td>{formatCurrency(line.unit_price || 0)}</td>
                                    <td className="is-strong">{formatCurrency(lineTotal)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                {/* 4️⃣ التفقيط والإجماليات */}
                <div className="phi-doc-summary">
                    <div className="phi-doc-stack">
                        <DocWords text={amountInWords} />
                    </div>
                    <DocTotals
                        rows={[
                            { label: 'الإجمالي الفرعي', value: formatCurrency(subtotal) },
                            { label: 'ضريبة القيمة المضافة', value: formatCurrency(vat), tone: 'tax', hidden: !(vat > 0) },
                            { label: 'الخصومات', value: `- ${formatCurrency(discount)}`, tone: 'discount', hidden: !(discount > 0) },
                        ]}
                        grand={{ label: 'الصافي المدفوع', value: formatCurrency(grandTotal) }}
                    />
                </div>

                <DocSignatures slots={[
                    { title: 'أعدّه', en: 'Prepared by', name: finalFullName, qrValue: signatureData, date: creationDate },
                    { title: 'المراجعة', en: 'Reviewed by' },
                    { title: 'المدير المالي', en: 'Finance Manager' },
                    { title: 'المستلم', en: 'Received by', name: record.sub_contractor || record.payee_name || undefined },
                ]} />

                {/* 5️⃣ الفوتر الثابت */}
                <ReportContactFooter layout="minimal" style={{ marginTop: 'auto', paddingTop: '10px' }} />

            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}