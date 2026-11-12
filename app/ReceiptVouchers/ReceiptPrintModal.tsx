"use client";
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency, tafqeet } from '@/lib/helpers';
import { currencyCode, currencyName } from '@/lib/currency';
import { supabase } from '@/lib/supabase';
import ReportContactFooter from '@/components/ReportContactFooter';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import { DocAmount, DocNote, DocSignatures, DocWords, PHI_DOC_CSS } from '@/components/PrintDocument';

/*
 * طباعة سند القبض بنفس هوية نماذج الطباعة في السيستم (الترويسة الرسمية + المبلغ + التفقيط + التوقيعات).
 * أسماء الخزينة وحساب العميل ورقم أمر الشغل بتتجاب وقت فتح المعاينة لأن السند متخزن بالـ IDs بس.
 */

type Extra = { creator: string; treasury: string; partnerAccount: string; jobOrder: string };

const POSTED = ['معتمد', 'مرحل', 'مُرحّل', 'مرحّل', 'posted'];

export default function ReceiptPrintModal({ isOpen, onClose, record }: { isOpen: boolean; onClose: () => void; record: any }) {
    const [mounted, setMounted] = useState(false);
    const [extra, setExtra] = useState<Extra>({ creator: '', treasury: '', partnerAccount: '', jobOrder: '' });

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (!isOpen || !record) return;
        let alive = true;
        (async () => {
            const next: Extra = { creator: '', treasury: '', partnerAccount: '', jobOrder: '' };
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const uid = record.created_by || session?.user?.id;
                if (uid) {
                    const { data: profile } = await supabase.from('profiles').select('full_name, name, nickname').eq('id', uid).maybeSingle();
                    next.creator = profile?.full_name || profile?.name || profile?.nickname || '';
                }
                if (!next.creator && session?.user) next.creator = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';

                const accIds = [record.safe_bank_acc_id, record.partner_acc_id].filter(Boolean);
                if (accIds.length) {
                    const { data: accs } = await supabase.from('accounts').select('id, code, name').in('id', accIds);
                    const label = (id: string) => {
                        const a = (accs || []).find((x: any) => x.id === id);
                        return a ? `${a.code ? `${a.code} - ` : ''}${a.name}` : '';
                    };
                    next.treasury = label(record.safe_bank_acc_id);
                    next.partnerAccount = label(record.partner_acc_id);
                }
                if (record.job_order_id) {
                    const { data: jo } = await supabase.from('job_orders').select('order_number').eq('id', record.job_order_id).maybeSingle();
                    next.jobOrder = jo?.order_number ? String(jo.order_number) : '';
                }
            } catch (err) {
                console.error('ReceiptPrintModal', err);
            }
            if (alive) setExtra(next);
        })();
        return () => { alive = false; };
    }, [isOpen, record]);

    if (!isOpen || !mounted || !record) return null;

    const partnerName = record.partners?.name || record.partner_name || '';
    const isPosted = POSTED.includes(String(record.status || '').trim()) || Boolean(record.is_posted);
    const creator = extra.creator || 'المحاسب المعتمد';
    const issued = record.created_at ? new Date(record.created_at) : (record.date ? new Date(record.date) : new Date());
    const issueTime = issued.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const voucherDate = record.date ? new Date(record.date).toLocaleDateString('en-GB') : issued.toLocaleDateString('en-GB');
    const refCode = record.receipt_number || record.id?.slice(0, 8)?.toUpperCase() || undefined;
    const signatureData = `تم الاعتماد إلكترونياً\nسند قبض: ${refCode || ''}\nالتاريخ: ${voucherDate}\nبواسطة: ${creator}`;

    const handlePrint = () => {
        const prev = document.title;
        document.title = record.receipt_number ? `سند_قبض_${record.receipt_number}` : 'سند_قبض';
        window.print();
        setTimeout(() => { document.title = prev; }, 1000);
    };

    const modalContent = (
        <div className="print-modal-overlay">
            <style>{`
                @media screen {
                    body { overflow: hidden !important; }
                }
                .print-modal-overlay { position: fixed !important; inset: 0 !important; background: rgba(40, 24, 10, 0.85) !important; backdrop-filter: blur(10px) !important; z-index: 999999999 !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: flex-start !important; padding: 30px 20px !important; overflow-y: auto !important; }
                .print-actions-bar { display: flex !important; gap: 15px !important; margin-bottom: 25px !important; background: white !important; padding: 15px 30px !important; border-radius: 50px !important; box-shadow: 0 10px 30px rgba(0,0,0,0.3) !important; position: sticky !important; top: 20px !important; z-index: 1000000000 !important; }
                .action-btn { padding: 12px 25px; border-radius: 10px; border: none; font-weight: 900; font-size: 16px; cursor: pointer; transition: 0.2s; font-family: inherit; }
                .action-btn.print { background: #0f172a; color: white; }
                .action-btn.close { background: #fee2e2; color: #dc2626; }
                .action-btn:focus-visible { outline: 3px solid #ea580c; outline-offset: 2px; }
                .a4-preview-box { width: 210mm !important; min-height: 297mm !important; background: white !important; color: #000; padding: 15mm !important; margin: 0 auto 40px auto !important; box-shadow: 0 20px 50px rgba(0,0,0,0.4); direction: rtl; border-radius: 14px !important; overflow: hidden !important; display: flex !important; flex-direction: column !important; box-sizing: border-box !important; position: relative; }
                .rcpt-draft { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 5; }
                .rcpt-draft span { transform: rotate(-28deg); font-size: 120px; font-weight: 900; color: rgba(220, 38, 38, 0.09); letter-spacing: 10px; white-space: nowrap; }
                @media print {
                    html, body { width: auto !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; color: #000000 !important; overflow: visible !important; }
                    body > *:not(.print-modal-overlay) { display: none !important; }
                    .no-print { display: none !important; }
                    .print-modal-overlay { position: static !important; width: auto !important; height: auto !important; min-height: 0 !important; display: block !important; background: #ffffff !important; padding: 0 !important; margin: 0 !important; overflow: visible !important; }
                    .a4-preview-box { position: relative !important; width: auto !important; max-width: 100% !important; margin: 0 !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; background: #ffffff !important; color: #000000 !important; overflow: visible !important; }
                    .rcpt-draft { position: fixed !important; inset: 0 !important; }
                    .rcpt-draft span { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>
            <style>{PHI_DOC_CSS}</style>

            <div className="print-actions-bar no-print">
                <button type="button" onClick={handlePrint} className="action-btn print">طباعة السند</button>
                <button type="button" onClick={onClose} className="action-btn close">إغلاق المعاينة</button>
            </div>

            <div className="a4-preview-box phi-doc phi-doc-page">
                {!isPosted && <div className="rcpt-draft" aria-hidden="true"><span>مسودة</span></div>}

                <ReportOfficialHeader
                    title="سند قبض (Receipt Voucher)"
                    refLabel="رقم السند"
                    reportRefCode={refCode}
                    issueDate={voucherDate}
                    meta={[
                        { label: 'وقت الإصدار', value: issueTime, ltr: true },
                        { label: 'الحالة', value: <span style={{ color: isPosted ? '#15803d' : '#b45309' }}>{isPosted ? 'معتمد ومُرحّل' : (record.status || 'مسودة')}</span> },
                    ]}
                    currency={`${currencyName()} (${currencyCode()})`}
                    compact
                    details={[
                        { label: 'استلمنا من السيد / السادة', value: partnerName || '---', wide: true },
                        { label: 'طريقة التحصيل', value: record.payment_method },
                        { label: 'رقم المرجع / الحوالة / الشيك', value: record.reference_number, ltr: true },
                        { label: 'المشروع', value: record.project_names },
                        { label: 'أمر الشغل', value: extra.jobOrder, ltr: true },
                        { label: 'الفاتورة المرتبطة', value: record.invoices?.invoice_number || record.invoice_number, ltr: true },
                        { label: 'الخزينة / البنك (مدين)', value: extra.treasury || record.safe_bank_acc_name },
                        { label: 'حساب العميل (دائن)', value: extra.partnerAccount || record.partner_acc_name },
                    ]}
                />

                <DocAmount label="مبلغ وقدره" value={formatCurrency(record.amount)} tone="in" />
                <DocWords text={tafqeet(Number(record.amount || 0))} label="فقط لا غير • Amount in words" />

                <div style={{ marginTop: '12px' }}>
                    <DocNote title="وذلك عن / البيان">
                        {record.notes || record.description || (partnerName ? `دفعة مستلمة من ${partnerName}` : 'دفعة مستلمة')}
                    </DocNote>
                </div>

                <DocSignatures slots={[
                    { title: 'أعدّه', en: 'Prepared by', name: creator, qrValue: signatureData, date: voucherDate },
                    { title: 'أمين الخزينة / المستلم', en: 'Cashier' },
                    { title: 'المدير المالي', en: 'Finance Manager' },
                    { title: 'المُسلِّم', en: 'Paid by', name: partnerName || undefined },
                ]} />

                <ReportContactFooter layout="minimal" style={{ marginTop: 'auto', paddingTop: '10px' }} />
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
