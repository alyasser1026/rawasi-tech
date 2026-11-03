"use client";
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/helpers';
import LoadingScreen from '@/components/LoadingScreen';
import { fetchPaginatedData } from '@/lib/supabase-pagination';

export default function PrintStatement() {
    const searchParams = useSearchParams();
    const partnerId = searchParams.get('id'); 

    const [partner, setPartner] = useState<any>(null);
    const [ledger, setLedger] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!partnerId) return;
        fetchData();
    }, [partnerId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: pData, error: pError } = await supabase
                .from('partners')
                .select('*')
                .eq('id', partnerId)
                .single();
            if (pError) throw pError;
            setPartner(pData);

            const buildQuery = () => supabase
                .from('partner_statement_ledger')
                .select('*')
                .eq('partner_id', partnerId)
                .order('transaction_date', { ascending: true })
                .order('created_at', { ascending: true })
                .order('line_id', { ascending: true });
            setLedger(await fetchPaginatedData(buildQuery, 'line_id'));

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const getBalanceInfo = (netBal: number) => {
        const val = Number(netBal.toFixed(2));
        if (val > 0.01) return { label: 'لــه', color: '#047857', bg: '#ecfdf5' };
        if (val < -0.01) return { label: 'عليــه', color: '#dc2626', bg: '#fef2f2' };
        return { label: 'مُتزن', color: '#a16207', bg: '#fef9c3' };
    };

    let totalCredit = 0;
    let totalDebit = 0;
    ledger.forEach(item => {
        totalCredit += Math.abs(Number(item.credit || 0));
        totalDebit += Math.abs(Number(item.debit || 0));
    });
    const finalBalance = totalCredit - totalDebit;
    const finalBalInfo = getBalanceInfo(finalBalance);

    if (isLoading) return <LoadingScreen message="جاري تحضير كشف الحساب..." fullScreen={false} />;
    if (!partner) return <div style={{ textAlign: 'center', padding: '100px', color: '#dc2626' }}>❌ خطأ: لم يتم العثور على بيانات الحساب</div>;

    return (
        <div className="print-wrapper">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
                
                body { background: white !important; margin: 0; padding: 0; font-family: 'Tajawal', sans-serif; direction: rtl; }
                .print-wrapper { max-width: 900px; margin: 0 auto; padding: 40px; color: #000; background: white; }
                
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e293b; padding-bottom: 20px; margin-bottom: 30px; }
                .company-info h1 { margin: 0; font-size: 28px; font-weight: 900; color: #1e293b; }
                .company-info p { margin: 5px 0; color: #64748b; font-weight: 700; }
                .doc-badge { background: #1e293b; color: white; padding: 10px 25px; border-radius: 4px; font-size: 20px; font-weight: 900; }

                .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; }
                .meta-item { border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; }
                .label { font-size: 12px; color: #64748b; font-weight: 800; display: block; margin-bottom: 4px; }
                .value { font-size: 16px; color: #000; font-weight: 900; }

                .statement-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                .statement-table th { background: #f8fafc; border: 1.5px solid #000; padding: 12px; font-weight: 900; font-size: 13px; }
                .statement-table td { border: 1px solid #000; padding: 10px; font-size: 14px; font-weight: 700; text-align: center; }
                .text-right { text-align: right !important; padding-right: 15px !important; }

                .summary-section { display: flex; justify-content: flex-start; margin-bottom: 50px; }
                .summary-card { width: 320px; border: 2px solid #000; padding: 15px; border-radius: 8px; }
                .summary-line { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 800; }
                .summary-line.total { border-bottom: none; font-size: 18px; font-weight: 900; margin-top: 5px; padding-top: 15px; border-top: 2px solid #000; }

                .footer-sig { display: flex; justify-content: space-between; margin-top: 60px; }
                .sig-box { text-align: center; width: 220px; }
                .sig-name { font-weight: 900; margin-bottom: 40px; }
                .sig-line { border-bottom: 1px dashed #000; }

                .print-controls { position: fixed; bottom: 30px; left: 30px; display: flex; gap: 10px; }
                .btn { padding: 12px 25px; border-radius: 8px; font-weight: 900; cursor: pointer; border: none; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                .btn-p { background: #10b981; color: white; }
                .btn-c { background: #64748b; color: white; }

                @media print {
                    .print-controls { display: none !important; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    @page { margin: 15mm; size: A4; }
                }
            `}</style>

            <div className="print-controls">
                <button className="btn btn-p" onClick={() => window.print()}>🖨️ طباعة الآن</button>
                <button className="btn btn-c" onClick={() => window.close()}>❌ إغلاق</button>
            </div>

            <div className="header">
                <div className="company-info">
                    <h1>إدارة الحسابات العامة</h1>
                    <p>نظام إدارة العقود والمقاولات الذكي</p>
                    <p>تاريخ الكشف: {new Date().toLocaleDateString('ar-EG')}</p>
                </div>
                <div className="doc-badge">كشف حساب تفصيلي</div>
            </div>

            <div className="meta-grid">
                <div className="meta-item">
                    <span className="label">اسم الحساب (الشريك):</span>
                    <span className="value" style={{ color: '#2563eb' }}>{partner.name}</span>
                </div>
                <div className="meta-item">
                    <span className="label">كود الحساب:</span>
                    <span className="value">#{partner.code || '---'}</span>
                </div>
                <div className="meta-item">
                    <span className="label">تصنيف الجهة:</span>
                    <span className="value">{partner.partner_type}</span>
                </div>
                <div className="meta-item">
                    <span className="label">حالة الحساب:</span>
                    <span className="value">{partner.is_active !== false ? 'نشط' : 'موقوف'}</span>
                </div>
            </div>

            <table className="statement-table">
                <thead>
                    <tr>
                        <th style={{ width: '50px' }}>م</th>
                        <th style={{ width: '120px' }}>التاريخ</th>
                        <th>البيان وتفاصيل الحركة</th>
                        <th style={{ width: '130px' }}>دائن (له)</th>
                        <th style={{ width: '130px' }}>مدين (عليه)</th>
                        <th style={{ width: '150px' }}>الرصيد التراكمي</th>
                    </tr>
                </thead>
                <tbody>
                    {ledger.length === 0 ? (
                        <tr><td colSpan={6}>لا توجد حركات مسجلة</td></tr>
                    ) : (
                        (() => {
                            let runningBal = 0;
                            return ledger.map((item, idx) => {
                                const c = Math.abs(Number(item.credit || 0));
                                const d = Math.abs(Number(item.debit || 0));
                                runningBal += (c - d);
                                const rbInfo = getBalanceInfo(runningBal);

                                return (
                                    <tr key={idx}>
                                        <td>{idx + 1}</td>
                                        <td>{item.transaction_date}</td>
                                        <td className="text-right">
                                            <div style={{ fontWeight: 900 }}>{item.main_description}</div>
                                            {item.line_details && <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{item.line_details}</div>}
                                        </td>
                                        <td style={{ color: c > 0 ? '#059669' : '#000' }}>{c > 0 ? formatCurrency(c) : '-'}</td>
                                        <td style={{ color: d > 0 ? '#dc2626' : '#000' }}>{d > 0 ? formatCurrency(d) : '-'}</td>
                                        <td style={{ background: Math.abs(runningBal) < 0.01 ? '#fef9c3' : 'transparent', WebkitPrintColorAdjust: 'exact' }}>
                                            {formatCurrency(Math.abs(runningBal))} 
                                            <span style={{ fontSize: '10px', marginRight: '5px' }}>({rbInfo.label})</span>
                                        </td>
                                    </tr>
                                );
                            })
                        })()
                    )}
                </tbody>
            </table>

            <div className="summary-section">
                <div className="summary-card">
                    <div className="summary-line">
                        <span>إجمالي المستحقات (دائن):</span>
                        <span style={{ color: '#059669' }}>{formatCurrency(totalCredit)}</span>
                    </div>
                    <div className="summary-line">
                        <span>إجمالي المسحوبات (مدين):</span>
                        <span style={{ color: '#dc2626' }}>{formatCurrency(totalDebit)}</span>
                    </div>
                    <div className="summary-line total" style={{ color: finalBalInfo.color }}>
                        <span>الرصيد النهائي الصافي:</span>
                        <span>{formatCurrency(Math.abs(finalBalance))} ({finalBalInfo.label})</span>
                    </div>
                </div>
            </div>

            <div className="footer-sig">
                <div className="sig-box">
                    <div className="sig-name">توقيع المحاسب</div>
                    <div className="sig-line"></div>
                </div>
                <div className="sig-box">
                    <div className="sig-name">توقيع المدير المالي</div>
                    <div className="sig-line"></div>
                </div>
                <div className="sig-box">
                    <div className="sig-name">اعتماد الشريك</div>
                    <div className="sig-line"></div>
                </div>
            </div>
        </div>
    );
}
