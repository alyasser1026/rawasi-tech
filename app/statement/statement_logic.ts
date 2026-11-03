"use client";
import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/lib/toast-context'; 
import { fetchPaginatedData } from '@/lib/supabase-pagination';

// 🚀 المترجم المالي - تم تحديث المسمى لـ "قيد غرامة / استقطاع" ليطابق الهوية المحاسبية الجديدة
const translateVType = (type: string) => {
    if (!type) return 'قيد يومية';
    const lowerType = type.toLowerCase();
    switch (lowerType) {
        case 'payment_vouchers': 
        case 'سند صرف':
            return 'سند صرف';
        case 'receipt_vouchers': 
        case 'سند قبض':
            return 'سند قبض';
        case 'labor_daily_logs': 
        case 'يومية عمالة':
            return 'يومية عمالة';
        case 'violation': 
        case 'violations': 
        case 'قيد غرامة':
            return 'قيد غرامة / استقطاع';
        case 'invoices': return 'فاتورة';
        case 'مستخلص': return 'مستخلص أعمال';
        default: return type;
    }
};

export function useStatementLogic() {
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    const initialPartnerId = searchParams.get('partner_id') || '';

    const [partnerId, setPartnerId] = useState<string>(initialPartnerId);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [globalSearch, setGlobalSearch] = useState('');
    
    const [isExportingAll, setIsExportingAll] = useState(false);
    const [exportProgress, setExportProgress] = useState('');

    const { data: partnerInfo } = useQuery({
        queryKey: ['partner_info', partnerId],
        queryFn: async () => {
            if (!partnerId) return null;
            const { data, error } = await supabase.from('partners').select('name').eq('id', partnerId).single();
            if (error) return null; return data;
        },
        enabled: !!partnerId,
    });

    const { data: rawLines = [], isLoading } = useQuery({
        queryKey: ['partner_statement_raw', partnerId],
        queryFn: async () => {
            if (!partnerId) return [];
            const buildQuery = () => supabase.from('partner_statement_ledger') 
                .select('*').eq('partner_id', partnerId)
                .order('transaction_date', { ascending: true })
                .order('created_at', { ascending: true })
                .order('line_id', { ascending: true });
            
            return await fetchPaginatedData(buildQuery, 'line_id');
        },
        enabled: !!partnerId, staleTime: 1000 * 60 * 5, 
    });

    const processedData = useMemo(() => {
        if (!rawLines || rawLines.length === 0) return null;

        let cumulativeBalance = 0, openingBalance = 0, periodDebit = 0, periodCredit = 0;
        let attendanceCount = 0, totalLaborAmount = 0, totalViolations = 0, totalPayments = 0;
        const periodLines: any[] = []; const typeSummaries: Record<string, { debit: number, credit: number }> = {};

        rawLines.forEach((line: any, index: number) => {
            const credit = Number(line.credit || 0); const debit = Number(line.debit || 0);
            const lineDate = line.transaction_date;
            cumulativeBalance += (credit - debit);

            if (dateFrom && lineDate < dateFrom) openingBalance = cumulativeBalance;
            else if (!dateTo || lineDate <= dateTo) {
                periodDebit += debit; periodCredit += credit;
                const headerDesc = line.main_description || ''; const lineDesc = line.line_details || '';
                const fullDesc = `${headerDesc} ${lineDesc}`.toLowerCase();
                
                let inferredVType = '';
                // 🎯 قاعدة الفصل الصارمة: لو البيان جواه (استقطاع أو غرامة أو جزاء) يروح فوراً للغرامات ويتحظر من بند المسحوبات بالسامري
                if (fullDesc.includes('غرامة') || fullDesc.includes('استقطاع') || fullDesc.includes('جزاء') || fullDesc.includes('مخالفة')) {
                    inferredVType = 'violations';
                } else {
                    inferredVType = line.v_type || '';
                    if (!inferredVType) {
                        if (fullDesc.includes('صرف')) inferredVType = 'payment_vouchers';
                        else if (fullDesc.includes('قبض')) inferredVType = 'receipt_vouchers';
                        else if (fullDesc.includes('يومية')) inferredVType = 'labor_daily_logs';
                        else if (fullDesc.includes('فاتورة')) inferredVType = 'invoices';
                        else if (fullDesc.includes('مستخلص')) inferredVType = 'مستخلص';
                    }
                }

                const vType = translateVType(inferredVType);
                const finalDesc = lineDesc || headerDesc || 'بدون بيان';

                periodLines.push({ id: line.line_id || `line-${index}`, date: lineDate, description: finalDesc, v_type: vType, reference_id: line.reference_id || '', debit, credit, balance: cumulativeBalance });

                if (!typeSummaries[vType]) typeSummaries[vType] = { debit: 0, credit: 0 };
                typeSummaries[vType].debit += debit; typeSummaries[vType].credit += credit;

                if (vType === 'يومية عمالة' || finalDesc.includes('يومية عامل')) {
                    let qty = Number(line.attendance_value || line.quantity || 1);
                    attendanceCount += qty; totalLaborAmount += credit;
                } else if (vType === 'قيد غرامة') {
                    totalViolations += debit; // يضاف هنا فقط
                } else if (vType === 'سند صرف') {
                    totalPayments += debit; // المسحوبات النقدية الفعلية
                }
            }
        });

        const currentBalance = periodLines.length > 0 ? periodLines[periodLines.length - 1].balance : openingBalance;
        let finalLines = [...periodLines].reverse();
        if (globalSearch) { const s = globalSearch.toLowerCase(); finalLines = finalLines.filter(l => l.description.toLowerCase().includes(s) || l.v_type.toLowerCase().includes(s)); }

        return { lines: finalLines, openingBalance, currentBalance, totalDebit: periodDebit, totalCredit: periodCredit, periodNet: periodCredit - periodDebit, attendanceCount, totalLaborAmount, totalViolations, totalPayments, typeSummaries: Object.entries(typeSummaries).map(([name, totals]) => ({ name, ...totals })) };
    }, [rawLines, dateFrom, dateTo, globalSearch]);

    const exportToExcel = (partnerName: string) => {
        if (!processedData || processedData.lines.length === 0) return;
        const actualName = partnerName || partnerInfo?.name || 'شريك';
        const csvRows = [
            ["التاريخ", "النوع", "البيان", "مدين", "دائن", "الرصيد"], 
            [dateFrom || "---", "رصيد سابق", "رصيد افتتاحي", processedData.openingBalance < 0 ? Math.abs(processedData.openingBalance).toString() : "0", processedData.openingBalance > 0 ? processedData.openingBalance.toString() : "0", processedData.openingBalance.toString()],
            ...processedData.lines.map((l: any) => [l.date, l.v_type, `"${(l.description || '').replace(/"/g, '""')}"`, l.debit.toString(), l.credit.toString(), l.balance.toString()])
        ];
        const csvContent = "\uFEFF" + csvRows.map(e => e.join(",")).join("\n"); 
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `كشف_حساب_${actualName}.csv`; link.click();
    };

    // 🚀🚀 المحرك الشامل المحدث لتوليد التقارير بـ HTML نقي عبر السيرفر وضغطها في ZIP 🚀🚀
    const downloadIndividualWorkerPDFs = async () => {
        setIsExportingAll(true);
        setExportProgress("⏳ جاري سحب بيانات العمالة والمقاولين...");
        try {
            const JSZip = (await import('jszip')).default;
            const { saveAs } = (await import('file-saver'));
            const zip = new JSZip();

            const { data: workers, error: pError } = await supabase.from('partners').select('id, name')
                .in('partner_type', ['عامل', 'صنايعي', 'عامل يومية', 'مقاول باطن', 'موظف', 'مقاول']); 
                
            if (pError) throw pError;
            if (!workers || workers.length === 0) {
                showToast("لا يوجد عمالة أو مقاولين في النظام", "error");
                setIsExportingAll(false); return;
            }

            const workerIds = workers.map(w => w.id);
            const workerMap = new Map(workers.map(w => [w.id, w.name]));

            let allLines: any[] = []; let from = 0; const step = 1000; let hasMore = true;

            setExportProgress("⏳ جاري تجميع وتنسيق الحسابات...");

            while (hasMore) {
                const { data, error } = await supabase.from('partner_statement_ledger').select('*')
                    .in('partner_id', workerIds)
                    .order('transaction_date', { ascending: true })
                    .order('created_at', { ascending: true })
                    .order('line_id', { ascending: true })
                    .range(from, from + step - 1);
                if (error) throw error;
                if (data && data.length > 0) { allLines.push(...data); from += step; if (data.length < step) hasMore = false; } else hasMore = false;
            }

            const grouped = allLines.reduce((acc: any, line: any) => {
                if (!acc[line.partner_id]) acc[line.partner_id] = [];
                acc[line.partner_id].push(line);
                return acc;
            }, {});

            const totalWorkers = Object.keys(grouped).length;
            let currentIndex = 0;

            for (const [pId, lines] of Object.entries(grouped)) {
                currentIndex++;
                const pName = workerMap.get(pId) || 'غير معروف';
                setExportProgress(`📥 (${currentIndex} من ${totalWorkers}) جاري بناء ملف PDF للعامل: ${pName}`);

                let balance = 0, openingBalance = 0, periodDebit = 0, periodCredit = 0;
                let workerAttendance = 0, workerLaborAmount = 0, workerViolations = 0, workerPayments = 0;
                const rowsHtml: string[] = [];

                (lines as any[]).forEach((line: any) => {
                    const credit = Number(line.credit || 0); const debit = Number(line.debit || 0);
                    balance += (credit - debit);
                    const lineDate = line.transaction_date;

                    if (dateFrom && lineDate < dateFrom) { openingBalance = balance; } 
                    else if (!dateTo || lineDate <= dateTo) {
                        periodDebit += debit; periodCredit += credit;

                        const finalDesc = line.line_details || line.main_description || 'بدون بيان';
                        const finalDescLower = finalDesc.toLowerCase();
                        
                        let inferredVType = '';
                        // 🎯 أولوية تصفية الغرامات والاستقطاعات داخل حلقة بناء ملف العامل لضمان دقة مربع التقارير
                        if (finalDescLower.includes('غرامة') || finalDescLower.includes('استقطاع') || finalDescLower.includes('جزاء') || finalDescLower.includes('مخالفة')) {
                            inferredVType = 'violations';
                        } else {
                            inferredVType = line.v_type || '';
                            if (!inferredVType) {
                                if (finalDescLower.includes('صرف')) inferredVType = 'payment_vouchers'; 
                                else if (finalDescLower.includes('قبض')) inferredVType = 'receipt_vouchers';
                                else if (finalDescLower.includes('يومية')) inferredVType = 'labor_daily_logs';
                            }
                        }

                        const vTypeTrans = translateVType(inferredVType);
                        if (vTypeTrans === 'يومية عمالة') { workerAttendance += Number(line.attendance_value || line.quantity || 1); workerLaborAmount += credit; } 
                        else if (vTypeTrans === 'قيد غرامة / استقطاع') { workerViolations += debit; } 
                        else if (vTypeTrans === 'سند صرف') { workerPayments += debit; }

                        rowsHtml.unshift(`
                            <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                                <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${lineDate}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${vTypeTrans}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${finalDesc}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #ef4444; font-weight: bold;">${debit > 0 ? debit.toLocaleString() : '-'}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #16a34a; font-weight: bold;">${credit > 0 ? credit.toLocaleString() : '-'}</td>
                                <td dir="ltr" style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: ${balance >= 0 ? '#16a34a' : '#ef4444'}; font-weight: 900;">
                                    ${Math.abs(balance).toLocaleString()} <span style="font-size:10px; font-weight:normal; color:#8a7a6b;">${balance >= 0 ? '(له)' : '(عليه)'}</span>
                                </td>
                            </tr>
                        `);
                    }
                });

                if (rowsHtml.length > 0 || openingBalance !== 0) {
                    // قالب HTML ذو أبعاد ثابتة ومحكمة ومبني مية بالمية على معايير الـ RTL للسيرفر
                    const htmlContent = `
                        <html dir="rtl" lang="ar">
                        <head>
                            <meta charset="utf-8">
                            <style>
                                body { direction: rtl; font-family: 'Arial', 'Tahoma', sans-serif; padding: 40px; background: #ffffff; color: #2c221b; box-sizing: border-box; }
                                .summary-box { flex: 1; border: 2px solid #eaddcf; padding: 10px; border-radius: 8px; text-align: center; }
                                .summary-box small { display: block; color: #8a7a6b; font-weight: bold; font-size: 11px; margin-bottom: 5px; }
                                .summary-box b { font-size: 16px; font-weight: bold; }
                            </style>
                        </head>
                        <body>
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                                <div style="text-align: right;">
                                    <h1 style="margin: 0 0 5px 0; font-size: 22px; font-weight: bold; color: #2c221b;">شركة فاي تك للمقاولات</h1>
                                    <p style="margin: 0; color: #8a7a6b; font-size: 14px; font-weight: bold;">إدارة الحسابات العامة - تقرير أداء مالي</p>
                                </div>
                                <div style="text-align: left;">
                                    <h2 style="margin: 0 0 5px 0; font-size: 26px; color: #c2410c; font-weight: bold; border-bottom: 3px solid #c2410c; padding-bottom: 5px;">كشف حساب تفصيلي</h2>
                                    <span style="font-size: 12px; color: #8a7a6b; font-weight: bold;">تاريخ الإصدار: ${new Date().toLocaleDateString('ar-SA')}</span>
                                </div>
                            </div>
                            <div style="height: 4px; background: #c2410c; margin-bottom: 25px; border-radius: 4px;"></div>
                            <div style="background: #fdfaf6; border: 1px solid #eaddcf; padding: 15px; border-radius: 12px; margin-bottom: 15px; display: flex; justify-content: space-between;">
                                <div style="display: flex; flex-direction: column; gap: 5px;"><strong>الموظف / المقاول:</strong><span style="font-weight: bold; font-size: 16px;">${pName}</span></div>
                                <div style="display: flex; flex-direction: column; gap: 5px; text-align: left;"><strong>الفترة المحددة:</strong><span style="font-weight: bold; font-size: 15px;">${dateFrom ? `من ${dateFrom} ` : 'من بداية التعامل '} ${dateTo ? `إلى ${dateTo}` : 'حتى تاريخه'}</span></div>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 15px;">
                                <div class="summary-box" style="background: rgba(194,65,12, 0.05);"><small>أيام الحضور</small><b>${workerAttendance} يوم</b></div>
                                <div class="summary-box" style="background: rgba(194,65,12, 0.05);"><small>إجمالي يوميات العمالة</small><b>${workerLaborAmount.toLocaleString()}</b></div>
                                <div class="summary-box" style="background: rgba(239, 68, 68, 0.05); border-color: #fca5a5;"><small>استقطاعات / غرامات</small><b style="color: #ef4444;">${workerViolations.toLocaleString()}</b></div>
                                <div class="summary-box" style="background: rgba(194,65,12, 0.05);"><small>المسحوبات / المنصرف</small><b style="color: #c2410c;">${workerPayments.toLocaleString()}</b></div>
                            </div>

                            <div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 30px;">
                                <div class="summary-box"><small>رصيد افتتاحي</small><b>${Math.abs(openingBalance).toLocaleString()} ${openingBalance >= 0 ? '(له)' : '(عليه)'}</b></div>
                                <div class="summary-box"><small>إجمالي دائن (له)</small><b style="color: #16a34a;">${periodCredit.toLocaleString()}</b></div>
                                <div class="summary-box"><small>إجمالي مدين (عليه)</small><b style="color: #ef4444;">${periodDebit.toLocaleString()}</b></div>
                                <div class="summary-box" style="border-color: #c2410c; background: #fdfaf6;"><small>الرصيد الصافي (النهائي)</small><b>${Math.abs(balance).toLocaleString()} ${balance >= 0 ? '(له)' : '(عليه)'}</b></div>
                            </div>
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: center;">
                                <thead>
                                    <tr style="background: #fdfaf6; border-top: 1px solid #2c221b; border-bottom: 2px solid #c2410c;">
                                        <th>التاريخ</th><th>النوع</th><th style="text-align: right;">البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${openingBalance !== 0 ? `<tr><td style="padding: 10px; border-bottom: 1px dashed #ccc;">${dateFrom || '---'}</td><td style="padding: 10px; border-bottom: 1px dashed #ccc;">رصيد سابق</td><td style="padding: 10px; border-bottom: 1px dashed #ccc; text-align: right;"><strong>رصيد افتتاحي</strong></td><td style="padding: 10px; border-bottom: 1px dashed #ccc;">${openingBalance < 0 ? Math.abs(openingBalance).toLocaleString() : '-'}</td><td style="padding: 10px; border-bottom: 1px dashed #ccc;">${openingBalance > 0 ? openingBalance.toLocaleString() : '-'}</td><td dir="ltr" style="padding: 10px; border-bottom: 1px dashed #ccc;">${Math.abs(openingBalance).toLocaleString()} <span style="font-size:10px;">${openingBalance >= 0 ? '(له)' : '(عليه)'}</span></td></tr>` : ''}
                                    ${rowsHtml.join('')}
                                </tbody>
                            </table>
                        </body>
                        </html>
                    `;

                    // إرسال الكود النظيف إلى السيرفر المستقر
                    const response = await fetch('/api/print-statement', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ htmlContent })
                    });

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        throw new Error(errData.error || "فشل السيرفر في إصدار الـ PDF");
                    }

                    const pdfBlob = await response.blob();
                    const cleanName = pName.replace(/[/\\?%*:|"<>]/g, '-');
                    zip.file(`كشف_حساب_${cleanName}.pdf`, pdfBlob);
                }
            }

            setExportProgress("📦 جاري ضغط التقارير وتجهيز ملف الـ ZIP المجمع...");
            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `كشوفات_العمالة_فاي_تك_${new Date().toISOString().split('T')[0]}.zip`);

            showToast("✅ تم تنزيل الملف المضغوط المحمي بنجاح!", "success");

        } catch (e: any) {
            console.error(e);
            showToast("حدث خطأ أثناء التنزيل: " + e.message, "error");
        } finally {
            setIsExportingAll(false);
            setExportProgress('');
        }
    };

    return {
        partnerId, partnerName: partnerInfo?.name || '', isLoading, dateFrom, dateTo, globalSearch,
        setPartnerId, setDateFrom, setDateTo, setGlobalSearch, exportToExcel,
        
        downloadIndividualWorkerPDFs, // 🚀 ممررة للزر وتعمل بكفاءة ومربوطة بالـ ZIP والـ Backend
        isExportingAll,
        exportProgress,

        statementLines: processedData?.lines ?? [], openingBalance: processedData?.openingBalance ?? 0,
        currentBalance: processedData?.currentBalance ?? 0, totalDebit: processedData?.totalDebit ?? 0,
        totalCredit: processedData?.totalCredit ?? 0, periodNet: processedData?.periodNet ?? 0, 
        attendanceCount: processedData?.attendanceCount ?? 0, totalLaborAmount: processedData?.totalLaborAmount ?? 0,
        totalViolations: processedData?.totalViolations ?? 0, totalPayments: processedData?.totalPayments ?? 0,
        typeSummaries: processedData?.typeSummaries ?? [],
    };
}
