"use client";
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/helpers';
import ReportContactFooter from '@/components/ReportContactFooter';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import { DocSignatures, DocStats, PHI_DOC_CSS } from '@/components/PrintDocument';
import { currencyCode, currencyName } from '@/lib/currency';
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
    if (!partner) return <div style={{ textAlign: 'center', padding: '100px', color: '#dc2626' }}>خطأ: لم يتم العثور على بيانات الحساب</div>;

    return (
        <div className="print-wrapper phi-doc phi-doc-page">
            <style>{PHI_DOC_CSS}</style>
            <style>{`
                body { background: white !important; margin: 0; padding: 0; direction: rtl; }
                .print-wrapper { max-width: 900px; margin: 0 auto; padding: 40px; color: #000; background: white; }

                .print-controls { position: fixed; bottom: 30px; left: 30px; display: flex; gap: 10px; }
                .btn { padding: 12px 25px; border-radius: 8px; font-weight: 900; cursor: pointer; border: none; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                .btn-p { background: #10b981; color: white; }
                .btn-c { background: #64748b; color: white; }

                @media print {
                    .print-controls { display: none !important; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>

            <div className="print-controls">
                <button className="btn btn-p" onClick={() => window.print()}>طباعة الآن</button>
                <button className="btn btn-c" onClick={() => window.close()}>إغلاق</button>
            </div>

            <ReportOfficialHeader
                title="كشف حساب تفصيلي (Detailed Account Statement)"
                badgeText="كشف حساب معتمد • ACCOUNT STATEMENT"
                reportRefCode={partner.code ? `STM-${partner.code}` : undefined}
                refLabel="رقم الكشف"
                currency={`${currencyName()} (${currencyCode()})`}
                compact
                details={[
                    { label: 'اسم الحساب (الشريك)', value: partner.name, wide: true },
                    { label: 'كود الحساب', value: partner.code ? `#${partner.code}` : undefined, ltr: true },
                    { label: 'تصنيف الجهة', value: partner.partner_type },
                    { label: 'حالة الحساب', value: partner.is_active !== false ? 'نشط' : 'موقوف' },
                    { label: 'عدد الحركات', value: String(ledger.length) },
                ]}
            />

            <DocStats items={[
                { label: 'إجمالي المستحقات (دائن • له)', value: formatCurrency(totalCredit), tone: 'positive' },
                { label: 'إجمالي المسحوبات (مدين • عليه)', value: formatCurrency(totalDebit), tone: 'discount' },
                { label: 'الرصيد النهائي الصافي', value: `${formatCurrency(Math.abs(finalBalance))} (${finalBalInfo.label})`, tone: finalBalance > 0.01 ? 'positive' : finalBalance < -0.01 ? 'discount' : 'warn', highlight: true },
            ]} />

            <table className="statement-table phi-doc-table">
                <thead>
                    <tr>
                        <th style={{ width: '5%' }}>م</th>
                        <th style={{ width: '13%' }}>التاريخ</th>
                        <th className="is-start">البيان وتفاصيل الحركة</th>
                        <th style={{ width: '14%' }}>دائن (له)</th>
                        <th style={{ width: '14%' }}>مدين (عليه)</th>
                        <th style={{ width: '20%' }}>الرصيد التراكمي</th>
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
                                        <td className="is-start is-strong">
                                            {item.main_description}
                                            {item.line_details && <small>{item.line_details}</small>}
                                        </td>
                                        <td style={{ color: c > 0 ? '#059669' : '#000' }}>{c > 0 ? formatCurrency(c) : '-'}</td>
                                        <td style={{ color: d > 0 ? '#dc2626' : '#000' }}>{d > 0 ? formatCurrency(d) : '-'}</td>
                                        <td className="is-nowrap" style={Math.abs(runningBal) < 0.01 ? { background: '#fef9c3' } : undefined}>
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

            <DocSignatures slots={[
                { title: 'المحاسب', en: 'Accountant' },
                { title: 'المدير المالي', en: 'Finance Manager' },
                { title: 'اعتماد الشريك', en: 'Partner Approval', name: partner.name || undefined },
            ]} />

            {/* 📱 فوتر جهات الاتصال الرسمية مع باركود vCard الذكي */}
            <ReportContactFooter layout="minimal" style={{ marginTop: 'auto', paddingTop: '10px' }} />
        </div>
    );
}
