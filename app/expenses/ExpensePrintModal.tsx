"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; 
import { THEME } from '@/lib/theme';
import { formatCurrency, tafqeet } from '@/lib/helpers'; 
import { QRCodeSVG } from 'qrcode.react'; 
import { supabase } from '@/lib/supabase';

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
    const creationTime = creationDateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const creationDate = creationDateObj.toLocaleDateString('ar-EG');
    
    const signatureData = `تم الاعتماد إلكترونياً\nتاريخ الإصدار: ${creationDate}\nوقت الإصدار: ${creationTime}\nبواسطة: ${finalFullName}`;
    const amountInWords = tafqeet(grandTotal);

    // 📦 محتوى المعاينة 
    const modalContent = (
        <div className="print-modal-overlay">
            
            <style>{`
                /* 🚀 تم استرجاع كلاس الخلفية عشان المودال يظهر فوق الشاشة وما يختفيش */
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
                .action-btn.print { background: #0f172a; color: white; }
                .action-btn.close { background: #fee2e2; color: #dc2626; }

                .a4-preview-box {
                    width: 210mm !important; min-height: 297mm !important; background: white !important; color: #000;
                    padding: 15mm !important; margin: 0 auto 40px auto !important; box-shadow: 0 20px 50px rgba(0,0,0,0.4);
                    direction: rtl; border-radius: 24px !important; overflow: hidden !important;
                    display: flex !important; flex-direction: column !important; box-sizing: border-box !important; 
                }

                .inv-header { display: grid; grid-template-columns: 180px 1fr 180px; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 25px; width: 100%; gap: 15px; }
                .header-center { text-align: center; }
                .header-logo { display: flex; justify-content: flex-end; } 
                .header-logo img { max-height: 120px; width: auto; max-width: 100%; object-fit: contain; } 

                .inv-title-box { text-align: center; margin-bottom: 25px; }
                .inv-title { font-size: 22px; font-weight: 900; border: 2.5px solid #000; padding: 8px 35px; display: inline-block; background: #f8fafc; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; border-radius: 12px; }

                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                .info-box { border: 1.5px solid #cbd5e1; border-radius: 16px !important; padding: 18px 15px 12px 15px; display: flex; flex-direction: column; justify-content: center; position: relative; background: #fff; min-height: 90px; }
                .box-label { position: absolute; top: -10px; right: 20px; background: white; padding: 0 10px; font-size: 12px; font-weight: 900; color: #475569; border-radius: 20px; }
                .inner-table { width: 100%; border-collapse: collapse; }
                .inner-table td { padding: 4px 0; font-size: 13px; vertical-align: middle; }
                .label-cell { text-align: left; font-weight: 900; color: #64748b; width: 90px; padding-left: 10px !important; }
                .value-cell { text-align: right; font-weight: 900; color: #0f172a; }

                .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; border-radius: 12px; overflow: hidden; }
                .inv-table th { background: #f8fafc; padding: 12px; text-align: center; border-bottom: 2px solid #94a3b8; border-top: 2px solid #94a3b8; color: #0f172a; font-weight: 900; }
                .inv-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #1e293b; font-weight: 700; }

                .inv-footer-flex { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; flex-grow: 1; gap: 40px; }
                .inv-amount-words { flex: 1; display: flex; flex-direction: column; }
                .inv-amount-words .words-box { background: #f8fafc; border: 1px dashed #cbd5e1; padding: 15px; border-radius: 16px; font-weight: 900; font-size: 15px; color: #0f172a; line-height: 1.6; }
                
                .signature-area { margin-top: 30px; text-align: center; align-self: flex-start; }
                .signature-title { font-weight: 900; font-size: 13px; color: #64748b; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }

                .inv-totals-box { width: 350px; }
                .inv-total-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; font-weight: 700; color: #334155; }
                .inv-total-row.tax { color: #0284c7; }
                .inv-total-row.discount { color: #dc2626; }
                .inv-total-row.grand-total { border-top: 2px solid #0f172a; padding-top: 12px; margin-top: 12px; font-size: 20px; font-weight: 900; color: #0f172a; background: #f1f5f9; padding: 10px; border-radius: 12px; }

                .inv-footer-contact { margin-top: auto !important; border-top: 2px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 13px; color: #64748b; font-weight: 700; }

                @media print {
                    @page { size: A4 portrait; margin: 0 !important; }
                    html, body { width: 210mm !important; height: 297mm !important; margin: 0 !important; padding: 0 !important; background: white !important; overflow: visible !important; }
                    body > *:not(.print-modal-overlay) { display: none !important; }
                    .no-print, .print-actions-bar { display: none !important; }
                    .print-modal-overlay { position: absolute !important; left: 0 !important; top: 0 !important; right: 0 !important; bottom: 0 !important; width: 210mm !important; height: 297mm !important; display: block !important; background: white !important; padding: 0 !important; margin: 0 !important; }
                    .a4-preview-box { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; margin: 0 !important; box-shadow: none !important; border: none !important; padding: 15mm !important; box-sizing: border-box !important; direction: rtl !important; display: flex !important; flex-direction: column !important; border-radius: 0 !important; page-break-after: avoid !important; page-break-inside: avoid !important; }
                }
            `}</style>

            <div className="print-actions-bar no-print">
                <button onClick={handlePrintOrPDF} className="action-btn print">🖨️ طباعة السند</button>
                <button onClick={onClose} className="action-btn close">❌ إغلاق المعاينة</button>
            </div>

            <div className="a4-preview-box">
                
                {/* 1️⃣ رأس الفاتورة */}
                <div className="inv-header">
                    <div style={{width: '180px'}}></div> 
                    <div className="header-center">
                        <h1 style={{ fontSize: '18px', fontWeight: 900, color: THEME.primary, margin: '0 0 4px 0' }}>مؤسسة طفله عبد الله السبيعي للمقاولات</h1>
                        <h2 style={{ fontSize: '15px', fontWeight: 900, color: THEME.primary, margin: '0 0 8px 0', letterSpacing: '0.5px' }}>Tifla Abdullah Al-Subaie Est. for Contracting</h2>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>الرقم الضريبي: ٣١٢٤٨٧٤٧٧٨٠٠٠٠٣</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginTop: '2px' }}>الرقم الموحد: ٧٠٥١٠١٣٥١٩</div>
                    </div>
                    <div className="header-logo"><img src="/company-logo.svg" alt="شعار الشركة" /></div>
                </div>

                <div className="inv-title-box">
                    <div className="inv-title">سند مصروف | EXPENSE VOUCHER</div>
                </div>

                {/* 2️⃣ مربعات البيانات */}
                <div className="info-grid">
                    <div className="info-box">
                        <span className="box-label">بيانات الدفع | PAYMENT INFO</span>
                        <table className="inner-table">
                            <tbody>
                                <tr>
                                    <td className="value-cell value-highlight" style={{ paddingBottom: '8px' }}>{record.sub_contractor || record.payee_name || '---'}</td>
                                </tr>
                                <tr>
                                    <td className="value-cell" style={{ color: '#334155' }}>حساب المصروف: {record.creditor_account || '---'}</td>
                                </tr>
                                <tr>
                                    <td className="value-cell" style={{ color: '#334155' }}>حساب السداد: {record.payment_account || '---'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="info-box">
                        <span className="box-label">تفاصيل المستند | VOUCHER DETAILS</span>
                        <table className="inner-table">
                            <tbody>
                                <tr>
                                    <td className="value-cell" style={{textAlign: 'left'}}>{record.expense_number || record.id?.slice(0,8) || '---'}</td>
                                    <td className="label-cell">:رقم المرجع</td>
                                </tr>
                                <tr>
                                    <td className="value-cell" style={{textAlign: 'left'}}>{creationDate}</td>
                                    <td className="label-cell">:تاريخ السند</td>
                                </tr>
                                <tr>
                                    <td className="value-cell" style={{textAlign: 'left', color: THEME.primary, fontWeight: 900}}>{record.site_ref || 'عام'}</td>
                                    <td className="label-cell">:المشروع</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 3️⃣ جدول البنود (🚀 يدعم الآن الأصناف المتعددة!) */}
                <table className="inv-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40px' }}>#</th>
                            <th style={{ textAlign: 'right' }}>البيان التفصيلي / Description</th>
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
                                    <td className="desc" style={{lineHeight: '1.6', textAlign: 'right'}}>{line.description || 'مصروف'} {line.notes && <><br/><span style={{fontSize:'12px', color:'#64748b'}}>{line.notes}</span></>}</td>
                                    <td>{line.quantity || 1}</td>
                                    <td>{formatCurrency(line.unit_price || 0)}</td>
                                    <td style={{ fontWeight: 900, color: '#0f172a' }}>{formatCurrency(lineTotal)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                {/* 4️⃣ التفقيط والإجماليات */}
                <div className="inv-footer-flex">
                    <div className="inv-amount-words">
                        <div style={{ fontSize: '13px', fontWeight: 900, marginBottom: '6px', color: '#64748b' }}>المبلغ الإجمالي كتابة (Amount in Words):</div>
                        <div className="words-box">{amountInWords}</div>
                        
                        <div className="signature-area">
                            <div className="signature-title">معتمد إلكترونياً من / E-Signature</div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <QRCodeSVG value={signatureData} size={75} level="M" />
                                <div style={{ fontSize: '14px', fontWeight: 900, marginTop: '8px', color: THEME.primary }}>{finalFullName}</div>
                            </div>
                        </div>
                    </div>

                    <div className="inv-totals-box">
                        <div className="inv-total-row">
                            <span>الإجمالي الفرعي:</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        {vat > 0 && (
                            <div className="inv-total-row tax">
                                <span>ضريبة القيمة المضافة:</span>
                                <span>{formatCurrency(vat)}</span>
                            </div>
                        )}
                        {discount > 0 && (
                            <div className="inv-total-row discount">
                                <span>يخصم (الخصومات):</span>
                                <span>{formatCurrency(discount)} -</span>
                            </div>
                        )}
                        <div className="inv-total-row grand-total">
                            <span>الصافي المدفوع:</span>
                            <span>{formatCurrency(grandTotal)}</span>
                        </div>
                    </div>
                </div>

                {/* 5️⃣ الفوتر الثابت */}
                <div className="inv-footer-contact">
                    الدمام - حي الفيصليه - شارع السعيره &nbsp;|&nbsp; rawasi.alyusr@gmail.com &nbsp;|&nbsp; 0547606876 - 0578018944
                </div>

            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}