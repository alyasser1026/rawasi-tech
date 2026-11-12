"use client";
import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency, formatDate } from '@/lib/helpers';
import ReportContactFooter from '@/components/ReportContactFooter';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import { DocSection, DocSignatures, DocStats, PHI_DOC_CSS } from '@/components/PrintDocument';
import { currencyCode, currencyName } from '@/lib/currency';
import { THEME } from '@/lib/theme';

interface StatementPrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    partnerName: string;
    dateFrom: string;
    dateTo: string;
    openingBalance: number;
    currentBalance: number;
    totalDebit: number;
    totalCredit: number;
    attendanceCount?: number;
    totalLaborAmount?: number;
    totalViolations?: number;
    totalPayments?: number;
    statementLines: any[];
}

export default function StatementPrintModal({
    isOpen, onClose, partnerName, dateFrom, dateTo,
    openingBalance, currentBalance, totalDebit, totalCredit, 
    attendanceCount = 0, totalLaborAmount = 0, totalViolations = 0, totalPayments = 0,
    statementLines = []
}: StatementPrintModalProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    // 🛡️ تفعيل المودال بشكل آمن لمنع أخطاء الـ SSR في Next.js
    useEffect(() => {
        setMounted(true);
    }, []);

    // 🛡️ منع تمرير الصفحة الخلفية عند فتح المودال
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'auto';
        return () => { document.body.style.overflow = 'auto'; };
    }, [isOpen]);

    if (!isOpen || !mounted) return null;

    const handlePrint = () => {
        window.print();
    };

    const safeLines = Array.isArray(statementLines) ? [...statementLines] : [];
    const printLines = safeLines.reverse();
    const balanceText = (v: number) => `${formatCurrency(Math.abs(v))} ${v >= 0 ? '(له)' : '(عليه)'}`;

    // 🚀 تصميم المودال بالكامل
    const modalContent = (
        <div className="print-modal-overlay">
            <div className="print-modal-content">
                
                <div className="no-print controls-bar">
                    <button type="button" onClick={handlePrint} className="btn-print">بدء الطباعة</button>
                    <button type="button" onClick={onClose} className="btn-close">إغلاق ✕</button>
                </div>

                <div className="a4-paper phi-doc phi-doc-page" ref={printRef} id="printable-area">
                    
                    <ReportOfficialHeader
                        title="كشف حساب تفصيلي (Detailed Account Statement)"
                        badgeText="كشف حساب معتمد • ACCOUNT STATEMENT"
                        refLabel="رقم الكشف"
                        currency={`${currencyName()} (${currencyCode()})`}
                        compact
                        details={[
                            { label: 'الموظف / الجهة', value: partnerName || '---', wide: true },
                            { label: 'الفترة المحددة', value: `${dateFrom ? `من ${formatDate(dateFrom)}` : 'من بداية التعامل'} ${dateTo ? `إلى ${formatDate(dateTo)}` : 'حتى تاريخه'}`, wide: true },
                        ]}
                    />

                    {/* 🚀 1. ملخص الحركات (التشغيلي) */}
                    <DocSection title="ملخص الحركات" en="Activity Summary" />
                    <DocStats items={[
                        { label: 'أيام الحضور', value: `${attendanceCount} يوم` },
                        { label: 'إجمالي يوميات العمالة', value: formatCurrency(totalLaborAmount) },
                        { label: 'إجمالي الغرامات (عليه)', value: formatCurrency(totalViolations), tone: 'discount' },
                        { label: 'الدفعات المنصرفة', value: formatCurrency(totalPayments), tone: 'tax' },
                    ]} />

                    {/* 🚀 2. ملخص الأرصدة (المالي الشامل) */}
                    <DocStats items={[
                        { label: 'رصيد افتتاحي', value: balanceText(openingBalance), tone: openingBalance >= 0 ? 'positive' : 'discount' },
                        { label: 'إجمالي الدائن (له)', value: formatCurrency(totalCredit), tone: 'positive' },
                        { label: 'إجمالي المدين (عليه)', value: formatCurrency(totalDebit), tone: 'discount' },
                        { label: 'الرصيد الصافي (النهائي)', value: balanceText(currentBalance), tone: currentBalance >= 0 ? 'positive' : 'discount', highlight: true },
                    ]} />

                    <DocSection title="تفاصيل الحركات" en="Transactions" />
                    <table className="print-table phi-doc-table">
                        <thead>
                            <tr>
                                <th style={{ width: '12%' }}>التاريخ</th>
                                <th style={{ width: '11%' }}>نوع الحركة</th>
                                <th className="is-start" style={{ width: '31%' }}>البيان / الوصف</th>
                                <th style={{ width: '13%' }}>مدين (عليه)</th>
                                <th style={{ width: '13%' }}>دائن (له)</th>
                                <th style={{ width: '20%' }}>الرصيد التراكمي</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="opening-row">
                                <td>{dateFrom ? formatDate(dateFrom) : '---'}</td>
                                <td>رصيد سابق</td>
                                <td className="is-start is-strong">رصيد افتتاحي للمبالغ السابقة</td>
                                <td>{openingBalance < 0 ? formatCurrency(Math.abs(openingBalance)) : '-'}</td>
                                <td>{openingBalance > 0 ? formatCurrency(openingBalance) : '-'}</td>
                                <td dir="ltr" className="balance-cell" style={{ color: openingBalance >= 0 ? THEME.success : THEME.danger }}>
                                    {formatCurrency(Math.abs(openingBalance))}
                                    <span className="balance-dir">{openingBalance >= 0 ? '(له)' : '(عليه)'}</span>
                                </td>
                            </tr>

                            {printLines.map((line: any, idx: number) => (
                                <tr key={line.id || idx}>
                                    <td>{formatDate(line.date)}</td>
                                    <td>{line.v_type}</td>
                                    <td className="is-start">{line.description}</td>
                                    <td style={{ color: line.debit > 0 ? THEME.danger : '#000' }}>
                                        {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                                    </td>
                                    <td style={{ color: line.credit > 0 ? THEME.success : '#000' }}>
                                        {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                                    </td>
                                    <td dir="ltr" className="balance-cell" style={{ color: line.balance >= 0 ? THEME.success : THEME.danger }}>
                                        {formatCurrency(Math.abs(line.balance))}
                                        <span className="balance-dir">{line.balance >= 0 ? '(له)' : '(عليه)'}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* التواقيع */}
                    <DocSignatures slots={[
                        { title: 'المحاسب', en: 'Accountant' },
                        { title: 'المراجعة', en: 'Reviewed by' },
                        { title: 'المدير المالي', en: 'Finance Manager' },
                        { title: 'المقاول / الشريك', en: 'Counterparty', name: partnerName || undefined },
                    ]} />

                    {/* 📱 فوتر جهات الاتصال الرسمية مع باركود vCard الذكي */}
                    <ReportContactFooter layout="minimal" style={{ marginTop: 'auto', paddingTop: '10px' }} />
                </div>
            </div>

            <style>{PHI_DOC_CSS}</style>
            <style>{`
                .print-modal-overlay { position: fixed; inset: 0; background: rgba(44, 34, 27, 0.85); backdrop-filter: blur(8px); z-index: 9999999; display: flex; justify-content: center; align-items: flex-start; overflow-y: auto; padding: 40px 20px; direction: rtl; }
                .print-modal-content { width: 100%; max-width: 900px; animation: fadeIn 0.3s ease-out; }
                
                @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

                .controls-bar { display: flex; justify-content: space-between; margin-bottom: 20px; background: white; border: 1px solid rgba(194,65,12, 0.3); padding: 15px 25px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); position: sticky; top: 10px; z-index: 10; }
                .btn-print { background: linear-gradient(135deg, #c2410c 0%, #a48141 100%); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 900; font-size: 16px; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 15px rgba(194,65,12, 0.3); }
                .btn-print:hover { transform: translateY(-2px); filter: brightness(1.1); }
                .btn-close { background: #fdfaf6; color: #4a3b32; border: 1px solid #c2410c; padding: 12px 24px; border-radius: 12px; font-weight: 900; font-size: 16px; cursor: pointer; transition: 0.2s; }
                .btn-close:hover { background: #eaddcf; }

                /* جعل الورقة تتمدد كـ Flex Column لدفع التواقيع للأسفل */
                .a4-paper { 
                    background: white; padding: 40px 50px; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); 
                    min-height: 297mm; color: #2c221b; margin-bottom: 40px; 
                    display: flex; flex-direction: column; 
                }

                .balance-cell { font-weight: 900 !important; }


                @media print {
                    html, body { 
                        visibility: hidden !important; 
                        overflow: visible !important; 
                        height: auto !important; 
                        background: white !important;
                    }
                    .print-modal-overlay { 
                        visibility: visible !important;
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 100% !important; 
                        height: auto !important;
                        overflow: visible !important; 
                        background: transparent !important; 
                        padding: 0 !important; 
                    }
                    .print-modal-content {
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        animation: none !important;
                    }
                    #printable-area, #printable-area * { 
                        visibility: visible !important; 
                    }
                    #printable-area { 
                        position: relative !important; 
                        width: 100% !important; 
                        margin: 0 !important; 
                        padding: 0 14mm !important; 
                        box-shadow: none !important;
                        display: flex !important;
                        flex-direction: column !important;
                        min-height: 276mm !important;
                    }
                    .no-print { display: none !important; }

                        background-color: #f7f3ed !important; 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                    }

                    tr { page-break-inside: avoid; }
                }
            `}</style>
        </div>
    );

    return createPortal(modalContent, document.body);
}