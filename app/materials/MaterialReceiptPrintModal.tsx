"use client";
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/helpers';
import ReportContactFooter from '@/components/ReportContactFooter';
import { THEME } from '@/lib/theme';

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
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto', padding: '40px 15px', direction: 'rtl' }}>
            
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
                    @page { size: A4 portrait; margin: 0; }
                    .modern-table th { background: #f1f5f9 !important; color: #0f172a !important; border-bottom: 2px solid #cbd5e1 !important; }
                }
                
                /* ستايل الجدول العصري */
                .modern-table th { background: linear-gradient(135deg, #1e293b, #0f172a); color: white; font-weight: 900; padding: 14px 10px; border: none; }
                .modern-table th:first-child { border-top-right-radius: 12px; }
                .modern-table th:last-child { border-top-left-radius: 12px; }
                .modern-table td { padding: 14px 10px; color: #334155; font-size: 14px; font-weight: 800; border-bottom: 1px solid #f1f5f9; }
                .modern-table tbody tr:nth-child(even) { background-color: #f8fafc; }
                .modern-table tbody tr:hover { background-color: #f1f5f9; }
            `}} />

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
            <div className="print-page" style={{ position: 'relative', width: '95%', maxWidth: '800px', minHeight: 'fit-content', background: 'white', padding: '45px', borderRadius: '14px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', color: 'black', overflow: 'hidden' }}>
                
                {/* 🌟 علامة مائية (Watermark) */}
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/company-logo.svg)', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundSize: '50%', opacity: 0.03, pointerEvents: 'none', zIndex: 0 }}></div>

                <div style={{ position: 'relative', zIndex: 1 }}>
                    {/* هيدر الشركة */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #f1f5f9', paddingBottom: '20px', marginBottom: '30px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <img src="/company-logo.svg" alt="شعار فاي تك" style={{ height: '70px', objectFit: 'contain' }} onError={(e: any) => e.target.style.display = 'none'} />
                            <div>
                                <h1 style={{ margin: 0, color: '#0f172a', fontSize: '28px', fontWeight: 900, letterSpacing: '-0.5px' }}>فاي <span style={{ color: THEME.goldAccent || '#d97706' }}>تك</span></h1>
                                <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '14px', fontWeight: 800 }}>إدارة المشتريات والمخازن</p>
                            </div>
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <h2 style={{ margin: 0, color: THEME.primary || '#2563eb', fontSize: '24px', fontWeight: 900, background: '#eff6ff', padding: '10px 20px', borderRadius: '12px', display: 'inline-block' }}>إذن استلام خامات (وارد)</h2>
                            <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                <span style={{ fontWeight: 900, fontSize: '13px', color: '#475569' }}>التاريخ: <b style={{ color: '#0f172a' }}>{masterData.exp_date}</b></span>
                                <span style={{ fontWeight: 900, fontSize: '13px', color: '#475569' }}>رقم الإذن: <b style={{ color: '#ef4444', background: '#fef2f2', padding: '2px 8px', borderRadius: '6px' }}>#{receiptId.slice(-6).toUpperCase()}</b></span>
                            </div>
                        </div>
                    </div>

                    {/* بيانات الفاتورة المتقدمة */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '35px' }}>
                        <div style={{ background: 'var(--surface-sunken)', padding: '20px', borderRadius: '16px', border: 'none', boxShadow: 'var(--shadow-sunken)' }}>
                            <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>المشروع الموجه له الخامات</p>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#1e293b' }}>{masterData.project?.Property || '---'}</h3>
                        </div>
                        <div style={{ background: 'var(--surface-sunken)', padding: '20px', borderRadius: '16px', border: 'none', boxShadow: 'var(--shadow-sunken)' }}>
                            <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>المورد / جهة التوريد</p>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#1e293b' }}>{masterData.supplier?.name || '---'}</h3>
                        </div>
                    </div>

                    {/* جدول الأصناف العصري */}
                    <div style={{ borderRadius: '16px', overflow: 'hidden', border: 'none', boxShadow: 'var(--shadow-elevation)', marginBottom: '35px' }}>
                        <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '5%' }}>م</th>
                                    <th style={{ width: '40%', textAlign: 'right' }}>اسم الخامة / البيان</th>
                                    <th style={{ width: '10%' }}>الكمية</th>
                                    <th style={{ width: '10%' }}>الوحدة</th>
                                    <th style={{ width: '15%' }}>سعر الوحدة</th>
                                    <th style={{ width: '20%' }}>الإجمالي (SAR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {receiptItems.map((item: any, idx: number) => (
                                    <tr key={idx}>
                                        <td style={{ color: '#94a3b8' }}>{idx + 1}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>{item.work_item}</td>
                                        <td style={{ fontWeight: 900, color: THEME.primary || '#2563eb' }}>{item.quantity}</td>
                                        <td>{item.unit}</td>
                                        <td>{formatCurrency(item.unit_price)}</td>
                                        <td style={{ fontWeight: 900, color: '#166534' }}>{formatCurrency(item.total_price)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* الإجمالي والإقرار */}
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', marginBottom: '50px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 300px', background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px dashed #cbd5e1', fontSize: '13px', color: '#475569', lineHeight: '1.8' }}>
                            <strong style={{ color: '#0f172a', display: 'block', marginBottom: '8px', fontSize: '15px' }}>إقرار استلام مخزني:</strong>
                            أقر أنا أمين المخزن / مهندس الموقع الموقع أدناه، باستلام كافة المواد والخامات المذكورة أعلاه بحالة جيدة ومطابقة للمواصفات، وقد تم إيداعها بعهدة المشروع المذكور وتوريدها للموقع الفعلي.
                        </div>
                        <div style={{ flex: '1 1 250px', background: `linear-gradient(135deg, ${THEME.goldAccent || '#c2410c'}15, transparent)`, padding: '20px', borderRadius: '16px', border: `2px solid ${THEME.goldAccent || '#c2410c'}`, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <span style={{ fontSize: '14px', fontWeight: 900, color: '#b45309' }}>إجمالي قيمة الإذن</span>
                            <div style={{ fontSize: '32px', fontWeight: 900, color: '#0f172a', margin: '5px 0' }}>{formatCurrency(totalAmount)}</div>
                        </div>
                    </div>

                    {/* التوقيعات (بتصميم هادي) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '30px', textAlign: 'center', marginTop: 'auto', paddingTop: '40px', borderTop: '2px dashed #e2e8f0' }}>
                        <div>
                            <p style={{ fontWeight: 900, color: '#64748b', marginBottom: '50px', fontSize: '14px' }}>أمين المخزن (المستلم)</p>
                            <div style={{ borderBottom: '2px solid #cbd5e1', width: '70%', margin: '0 auto' }}></div>
                        </div>
                        <div>
                            <p style={{ fontWeight: 900, color: '#64748b', marginBottom: '50px', fontSize: '14px' }}>مهندس الموقع (الاعتماد)</p>
                            <div style={{ borderBottom: '2px solid #cbd5e1', width: '70%', margin: '0 auto' }}></div>
                        </div>
                        <div>
                            <p style={{ fontWeight: 900, color: '#64748b', marginBottom: '50px', fontSize: '14px' }}>المدير المالي (التوجيه)</p>
                            <div style={{ borderBottom: '2px solid #cbd5e1', width: '70%', margin: '0 auto' }}></div>
                        </div>
                    </div>
                </div>

                {/* 📱 فوتر جهات الاتصال الرسمية مع باركود vCard الذكي */}
                <ReportContactFooter qrSize={56} style={{ marginTop: '24px' }} />
            </div>
        </div>,
        document.body
    );
}