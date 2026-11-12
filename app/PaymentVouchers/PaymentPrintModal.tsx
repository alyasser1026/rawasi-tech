"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; 
import { formatCurrency, tafqeet } from '@/lib/helpers'; 
import { currencyCode, currencyName } from '@/lib/currency';
import { supabase } from '@/lib/supabase';
import ReportContactFooter from '@/components/ReportContactFooter';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import { DocAmount, DocNote, DocSignatures, DocWords, PHI_DOC_CSS } from '@/components/PrintDocument';

export default function PaymentPrintModal({ isOpen, onClose, record }: any) {
    const [mounted, setMounted] = useState(false); 
    const [creatorInfo, setCreatorInfo] = useState<{username: string, fullName: string} | null>(null); 

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const fetchCreatorInfo = async () => {
            if (!isOpen) return;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const targetUserId = record?.created_by || session?.user?.id;
                let fetchedFullName = '';

                if (targetUserId) {
                    const { data: profile } = await supabase.from('profiles').select('*').eq('id', targetUserId).single();
                    if (profile) fetchedFullName = profile.full_name || profile.name || profile.nickname || '';
                }

                if (!fetchedFullName && session?.user) {
                    fetchedFullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';
                }

                setCreatorInfo({ 
                    username: '', // للأمان
                    fullName: fetchedFullName || 'المحاسب المعتمد' 
                });
            } catch (err) { console.error("Error", err); }
        };
        fetchCreatorInfo();
    }, [isOpen, record?.created_by]);

    if (!isOpen || !mounted || !record) return null;

    const handlePrint = () => {
        document.title = record?.voucher_number ? `سند_صرف_${record.voucher_number}` : 'سند_صرف';
        window.print();
    };

    const finalFullName = creatorInfo?.fullName || 'المحاسب المعتمد';
    const creationDateObj = record?.created_at ? new Date(record.created_at) : (record?.date ? new Date(record.date) : new Date());
    const creationTime = creationDateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const creationDate = creationDateObj.toLocaleDateString('en-GB');
    
    const signatureData = `تم الاعتماد إلكترونياً\nتاريخ الإصدار: ${creationDate}\nوقت الإصدار: ${creationTime}\nبواسطة: ${finalFullName}`;
    const amountInWords = tafqeet(Number(record.amount || 0));

    const modalContent = (
        <div className="print-modal-overlay">
            <style>{`
                body { overflow: hidden !important; }
                .print-modal-overlay { position: fixed !important; inset: 0 !important; background: rgba(40, 24, 10, 0.85) !important; backdrop-filter: blur(10px) !important; z-index: 999999999 !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: flex-start !important; padding: 30px 20px !important; overflow-y: auto !important; font-family: 'Arial', sans-serif; }
                .print-actions-bar { display: flex !important; gap: 15px !important; margin-bottom: 25px !important; background: white !important; padding: 15px 30px !important; border-radius: 50px !important; box-shadow: 0 10px 30px rgba(0,0,0,0.3) !important; position: sticky !important; top: 20px !important; z-index: 1000000000 !important; }
                .action-btn { padding: 12px 25px; border-radius: 10px; border: none; font-weight: 900; font-size: 16px; cursor: pointer; transition: 0.2s; }
                .action-btn.print { background: #0f172a; color: white; }
                .action-btn.close { background: #fee2e2; color: #dc2626; }
                .a4-preview-box { width: 210mm !important; min-height: 297mm !important; background: white !important; color: #000; padding: 15mm !important; margin: 0 auto 40px auto !important; box-shadow: 0 20px 50px rgba(0,0,0,0.4); direction: rtl; border-radius: 14px !important; overflow: hidden !important; display: flex !important; flex-direction: column !important; box-sizing: border-box !important; }
                @media print {
                    html, body { width: 210mm !important; height: 297mm !important; margin: 0 !important; padding: 0 !important; background: white !important; overflow: visible !important; }
                    body > *:not(.print-modal-overlay) { display: none !important; }
                    .no-print { display: none !important; }
                    .print-modal-overlay { position: absolute !important; left: 0 !important; top: 0 !important; right: 0 !important; bottom: 0 !important; width: 210mm !important; height: 297mm !important; display: block !important; background: white !important; padding: 0 !important; margin: 0 !important; }
                    .a4-preview-box { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; margin: 0 !important; box-shadow: none !important; border: none !important; padding: 15mm !important; box-sizing: border-box !important; direction: rtl !important; display: flex !important; flex-direction: column !important; border-radius: 0 !important; page-break-after: avoid !important; page-break-inside: avoid !important; }
                }
            `}</style>
            <style>{PHI_DOC_CSS}</style>

            <div className="print-actions-bar no-print">
                <button onClick={handlePrint} className="action-btn print">طباعة السند</button>
                <button onClick={onClose} className="action-btn close">إغلاق المعاينة</button>
            </div>

            <div className="a4-preview-box phi-doc phi-doc-page">
                <ReportOfficialHeader
                    title="سند صرف (Payment Voucher)"
                    badgeText="مستند مالي معتمد • FINANCIAL VOUCHER"
                    reportRefCode={record.voucher_number || record.id?.slice(0, 8)?.toUpperCase() || undefined}
                    refLabel="رقم السند"
                    issueDate={creationDate}
                    meta={[{ label: 'وقت الإصدار', value: creationTime, ltr: true }]}
                    currency={`${currencyName()} (${currencyCode()})`}
                    compact
                    details={[
                        { label: 'يُصرف إلى', value: record.payee_name || '---', wide: true },
                        { label: 'طريقة الدفع', value: record.payment_method },
                        { label: 'رقم المرجع / الحوالة', value: record.reference || record.reference_number || record.reference_no, ltr: true },
                        { label: 'المشروع / مركز التكلفة', value: record.site_ref },
                        { label: 'الحساب المدين', value: record.debit_account?.name || record.debit_account_name },
                        { label: 'الخزينة / البنك', value: record.credit_account?.name || record.credit_account_name },
                    ]}
                />

                <DocAmount label="مبلغ وقدره" value={formatCurrency(record.amount)} tone="out" />
                <DocWords text={amountInWords} label="فقط لا غير • Amount in words" />

                {record.description && (
                    <div style={{ marginTop: '12px' }}>
                        <DocNote title="وذلك بموجب / البيان">{record.description}</DocNote>
                    </div>
                )}

                <DocSignatures slots={[
                    { title: 'أعدّه', en: 'Prepared by', name: finalFullName, qrValue: signatureData, date: creationDate },
                    { title: 'المدير المالي', en: 'Finance Manager' },
                    { title: 'المستلم', en: 'Received by', name: record.payee_name || undefined },
                ]} />

                <ReportContactFooter layout="minimal" style={{ marginTop: 'auto', paddingTop: '10px' }} />
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}