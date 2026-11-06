"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx-js-style';
import { fetchPaginatedData } from '@/lib/supabase-pagination';
import { decimalSum, decimalSubtract, savePayrollDrafts, postPayroll, unpostPayroll } from '@/lib/payroll-workflow';
import { notify } from '@/lib/notify';

export function usePayrollLogic() {
    const [employees, setEmployees] = useState<any[]>([]);
    const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // فلاتر الشهر والسنة وتاريخ القطع
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [cutoffDate, setCutoffDate] = useState<string>(new Date().toISOString().split('T')[0]); 
    
    const [globalSearch, setGlobalSearch] = useState('');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]); 
    const [filterActiveOnly, setFilterActiveOnly] = useState(false); 

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentRecord, setCurrentRecord] = useState<any>(null);

    const fetchVersionRef = useRef(0);
    const loadedSheetRef = useRef('');

    // 🚀 الكاميرا الحية: عشان نمنع الأزرار الجانبية من إرسال الأصفار القديمة (Stale Closures)
    const latestFilteredRef = useRef<any[]>([]);

    // 1. جلب البيانات (محصنة ضد تغير الرصيد السابق)
    const fetchPayrollData = async () => {
        const requestVersion = ++fetchVersionRef.current;
        setIsLoading(true);
        
        const targetMonthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        try {
            const empData = await fetchPaginatedData(() => supabase.from('partners').select('id, name, partner_type, job_role, identity_number').order('name').order('id'));
            // We need to filter empData in memory since fetchAllSupabaseData currently doesn't accept complex filters
            const filteredEmpData = empData.filter((p: any) => ['موظف', 'عامل', 'عامل يومية'].includes(p.partner_type));

            const { data: balData, error: balError } = await supabase.rpc('get_payroll_balances_with_cutoff', {
                p_month: selectedMonth, p_year: selectedYear, p_cutoff_date: cutoffDate
            });
            if (balError) throw balError;

            const { data: syncData, error: syncError } = await supabase.rpc('pull_payroll_module_data', {
                p_month: selectedMonth, p_year: selectedYear, p_cutoff_date: cutoffDate
            });
            if (syncError) throw syncError;

            const savedSlips = await fetchPaginatedData(() => supabase.from('payroll_slips').select('*').eq('month', targetMonthStr).order('id'));
            if (requestVersion !== fetchVersionRef.current) return;
            const targetMonthSlips = savedSlips.filter((s: any) => s.month === targetMonthStr);

            // جلب ملخص الحضور والغياب للموظفين لحساب خصم الغياب آلياً
            let attendanceEmployees: any[] = [];
            try {
                const { data: attData } = await supabase.rpc('get_company_monthly_attendance', {
                    p_month: targetMonthStr,
                    p_cutoff_date: cutoffDate
                });
                if (attData && Array.isArray((attData as any).employees)) {
                    attendanceEmployees = (attData as any).employees;
                }
            } catch (attErr) {
                console.warn('Attendance summary not loaded for payroll:', attErr);
            }

            setEmployees(filteredEmpData || []);

            const initialPayroll = (filteredEmpData || []).map(emp => {
                const balanceObj = (balData || []).find((b: any) => b.partner_id === emp.id);
                // الرصيد الحي من قاعدة البيانات
                const livePrevUnpaid = balanceObj?.previous_unpaid_balance || 0;

                const moduleData = (syncData || []).find((d: any) => d.partner_id === emp.id);
                const savedSlipObj = (targetMonthSlips || []).find((s: any) => s.emp_id === emp.id);
                const attEmp = attendanceEmployees.find((a: any) => a.id === emp.id);
                const attSummary = attEmp?.summary;
                
                let baseRate = 0;
                let daysWorked = moduleData ? Number(moduleData.days_worked || 0) : 0;
                let deductions = 0;
                let extendedAdvances = 0;
                let allowances = 0;
                let amountToPay = 0;
                let status = 'غير مدفوع';
                let prevUnpaid = 0;
                let absenceDays = 0;
                let absenceDeduction = 0;

                if (savedSlipObj && emp.partner_type === 'موظف') {
                    // 🛡️ لو المسير محفوظ قبل كده، نقرأ البيانات المحفوظة بالكامل عشان الرصيد ما يضربش
                    baseRate = savedSlipObj.basic_salary || 0;
                    allowances = savedSlipObj.allowances || 0;
                    amountToPay = savedSlipObj.amount_to_pay || 0;
                    status = savedSlipObj.status || 'غير مدفوع';
                    absenceDays = Number(savedSlipObj.absence_days || 0);
                    absenceDeduction = Number(savedSlipObj.absence_deduction || 0);
                    
                    // Opening balances come from the same posted partner ledger.
                    prevUnpaid = livePrevUnpaid;
                } else {
                    // 🔄 لو مسير جديد، نجلب البيانات الحية (Live)
                    if (emp.partner_type !== 'موظف') {
                        baseRate = moduleData?.total_earned_wage || 0;
                    } else {
                        baseRate = attSummary?.basic_salary ? Number(attSummary.basic_salary) : 0;
                        absenceDays = attSummary?.total_penalty_days ? Number(attSummary.total_penalty_days) : 0;
                        absenceDeduction = attSummary?.absence_deduction ? Number(attSummary.absence_deduction) : 0;
                    }
                    prevUnpaid = livePrevUnpaid; // الرصيد الحي
                }

                // Source modules own their postings; the sheet only displays them.
                if (emp.partner_type !== 'موظف') baseRate = moduleData?.total_earned_wage || 0;
                deductions = moduleData?.total_violations || 0;
                extendedAdvances = moduleData?.total_payments || 0;
                const currentNet = emp.partner_type === 'موظف'
                    ? decimalSubtract(decimalSum(baseRate, allowances), absenceDeduction, deductions, extendedAdvances)
                    : decimalSubtract(decimalSum(baseRate, allowances), deductions, extendedAdvances);
                const finalNet = decimalSum(currentNet, prevUnpaid);

                return {
                    id: emp.id, 
                    emp_id: emp.id,
                    name: emp.name,
                    type: emp.partner_type,
                    job_role: emp.job_role,
                    identity_number: emp.identity_number,
                    base_rate: baseRate,               
                    days_worked: daysWorked,            
                    allowances: allowances,    
                    absence_days: absenceDays,
                    absence_deduction: absenceDeduction,
                    deductions: deductions,            
                    advances: 0,        
                    previous_balance: prevUnpaid,      
                    extended_advances: extendedAdvances, 
                    current_month_net: currentNet,     
                    net_salary: finalNet, 
                    amount_to_pay: amountToPay, 
                    status: status,             
                    is_posted: emp.partner_type === 'موظف' && !!savedSlipObj?.is_posted,
                    notes: ''
                };
            });
            setPayrollRecords(initialPayroll);
            loadedSheetRef.current = `${targetMonthStr}|${cutoffDate}`;
        } catch (error: any) {
            if (requestVersion === fetchVersionRef.current) {
                setPayrollRecords([]);
                loadedSheetRef.current = '';
                notify('تعذر تحميل المسير: ' + error.message);
            }
        } finally {
            if (requestVersion === fetchVersionRef.current) {
                setIsLoading(false);
            }
        }
    };

    useEffect(() => {
        const period = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        if (!cutoffDate.startsWith(period + '-')) {
            const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
            setCutoffDate(`${period}-${lastDay}`);
            return;
        }
        fetchPayrollData();
    }, [selectedMonth, selectedYear, cutoffDate]);

    // 2. تحديث الخانات
    const updateRecord = (id: string, field: string, value: string | number) => {
        setPayrollRecords(prev => prev.map(rec => {
            if (rec.id === id) {
                if (rec.type !== 'موظف' || rec.is_posted || !['base_rate', 'allowances', 'amount_to_pay', 'status', 'absence_deduction'].includes(field)) return rec;
                const numericValue = field === 'status' ? String(value) : value;
                const updated = { ...rec, [field]: numericValue };
                
                if (field !== 'amount_to_pay') {
                    try {
                        updated.current_month_net = updated.type === 'موظف'
                            ? decimalSubtract(decimalSum(updated.base_rate, updated.allowances), updated.absence_deduction || 0, updated.deductions, updated.advances, updated.extended_advances)
                            : decimalSubtract(decimalSum(updated.base_rate, updated.allowances), updated.deductions, updated.advances, updated.extended_advances);
                        updated.net_salary = decimalSum(updated.current_month_net, updated.previous_balance);
                    } catch {
                        return rec;
                    }
                }
                return updated;
            }
            return rec;
        }));
    };

    const filteredRecords = useMemo(() => {
        let result = payrollRecords;
        if (globalSearch) {
            const s = globalSearch.toLowerCase();
            result = result.filter(r => r.name.toLowerCase().includes(s) || (r.job_role || '').toLowerCase().includes(s));
        }
        if (filterActiveOnly) {
            result = result.filter(r => r.days_worked > 0 || r.type === 'موظف');
        }
        if (selectedEmployeeIds.length > 0) {
            result = result.filter(r => selectedEmployeeIds.includes(r.id));
        }
        
        latestFilteredRef.current = result;
        return result;
    }, [payrollRecords, globalSearch, selectedEmployeeIds, filterActiveOnly]);

    const totals = useMemo(() => {
        const sum = (key: string) => Number(decimalSum(...filteredRecords.map(row => row[key] || 0)));
        return { allowances: sum('allowances'), deductions: sum('deductions'), advances: sum('advances'),
            absence_deductions: sum('absence_deduction'),
            extended_advances: sum('extended_advances'), previous_balances: sum('previous_balance'),
            current_net: sum('current_month_net'), net: sum('net_salary'), amount_to_pay: sum('amount_to_pay') };
    }, [filteredRecords]);

    const exportToExcel = () => {
        const liveData = latestFilteredRef.current;
        if (liveData.length === 0) return notify("لا يوجد بيانات لتصديرها!");
        
        // 1. مصفوفة أسماء الأشهر باللغة العربية ليعطى مظهر ملوكي للعنوان 📑
        const arabicMonths = [
            "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
            "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
        ];
        const monthNameArabic = arabicMonths[selectedMonth - 1] || `شهر ${selectedMonth}`;

        // 2. تجهيز سطور البيانات
        const dataToExport: Record<string, string | number>[] = liveData.map((r, i) => {
            return {
                "م": i + 1,
                "الاسم": r.name || "غير محدد",
                "التصنيف": r.type || "---",
                "المهنة": r.job_role || "---", 
                "الأساسي": Number(r.base_rate) || 0,
                "أيام العمل": Number(r.days_worked) || 0,
                "البدلات": Number(r.allowances) || 0,
                "خصم غياب": Number(r.absence_deduction) || 0,
                "الغرامات": Number(r.deductions) || 0,
                "المسحوبات": Number(r.extended_advances) || 0,
                "رصيد سابق": Number(r.previous_balance) || 0,
                "الصافي الإجمالي": 0, // معادلة حية
                "المبلغ للصرف": Number(r.amount_to_pay) || 0,
                "المتبقي": 0,        // معادلة حية
                "حالة الدفع": r.status || 'غير مدفوع'
            };
        });

        // 3. إضافة سطر الإجماليات
        dataToExport.push({
            "م": "---",
            "الاسم": "الإجمـــالي الكـــلي",
            "التصنيف": "---",
            "المهنة": "---",
            "الأساسي": 0, "أيام العمل": "---", "البدلات": 0, "الغرامات": 0, "المسحوبات": 0, "رصيد سابق": 0, "الصافي الإجمالي": 0, "المبلغ للصرف": 0, "المتبقي": 0, "حالة الدفع": "---"
        });

        // 4. تحويل البيانات لشيت (البيانات تبدأ من الصف الثالث A3)
        const ws = XLSX.utils.aoa_to_sheet([]);
        XLSX.utils.sheet_add_json(ws, dataToExport, { origin: 'A3' });

        // 5. دمج خلايا العنوان الرئيسي (من أول عمود لآخر عمود)
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 13 } });

        // 👑 6. السحر هنا: صياغة عنوان المسير الديناميكي الاحترافي
        const dynamicTitle = `كشف مسير رواتب وأجور الكوادر والموظفين - لشهـر: ${monthNameArabic} / لسنة ${selectedYear}`;
        XLSX.utils.sheet_add_aoa(ws, [[dynamicTitle]], { origin: 'A1' });

        // 7. تطبيق التنسيقات والألوان ومعادلات الـ SUBTOTAL
        const range = XLSX.utils.decode_range(ws['!ref'] || "A1:N1");
        
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = { c: C, r: R };
                const cellRef = XLSX.utils.encode_cell(cellAddress);
                
                if (!ws[cellRef]) {
                    ws[cellRef] = { t: 's', v: '' }; 
                }

                let cellValue = ws[cellRef].v;
                const excelRow = R + 1;

                let cellStyle: any = {
                    alignment: { vertical: "center", horizontal: "center" },
                    font: { name: "Arial", sz: 11, color: { rgb: "FF334155" }, bold: false },
                    fill: { fgColor: { rgb: "FFFFFFFF" } } 
                };

                // 🎛️ أ- تنسيق صف العنوان الملوكـي (الصف الأول)
                if (R === 0) {
                    cellStyle.font = { name: "Arial", sz: 15, bold: true, color: { rgb: "FFFFFFFF" } };
                    cellStyle.fill = { fgColor: { rgb: "FF0F172A" } }; // لون كحلي فخم
                } 
                // 🔹 ب- تنسيق هيدر الجدول (الصف الثالث)
                else if (R === 2) {
                    cellStyle.font = { name: "Arial", sz: 11, bold: true, color: { rgb: "FFFFFFFF" } };
                    cellStyle.fill = { fgColor: { rgb: "FF3B82F6" } }; // أزرق سماوي
                } 
                // 📊 ج- سطر الإجماليات الديناميكي (SUBTOTAL)
                else if (R === range.e.r) {
                    cellStyle.font = { name: "Arial", sz: 11, bold: true, color: { rgb: "FF0F172A" } };
                    cellStyle.fill = { fgColor: { rgb: "FFFEF08A" } }; // أصفر فخم

                    if ([4, 6, 7, 8, 9, 10, 11, 12].includes(C)) {
                        const excelEndRow = range.e.r; 
                        const colLetter = String.fromCharCode(65 + C);
                        
                        ws[cellRef].t = 'n';
                        ws[cellRef].f = `SUBTOTAL(9, ${colLetter}4:${colLetter}${excelEndRow})`; 
                        delete ws[cellRef].v;
                    }
                } 
                // 👷 د- صفوف العمال وحقن المعادلات الحية
                else if (R > 2 && R < range.e.r) {
                    if (R % 2 === 0) {
                        cellStyle.fill = { fgColor: { rgb: "FFF8FAFC" } }; 
                    }

                    if (C === 10) { 
                        ws[cellRef].t = 'n';
                        ws[cellRef].f = `E${excelRow}+G${excelRow}-H${excelRow}-I${excelRow}+J${excelRow}`;
                        delete ws[cellRef].v;
                    } 
                    else if (C === 12) { 
                        ws[cellRef].t = 'n';
                        ws[cellRef].f = `K${excelRow}-L${excelRow}`;
                        delete ws[cellRef].v;
                    }

                    // التلوين الشرطي للأعمدة
                    if ([4, 6, 10, 11].includes(C)) {
                        cellStyle.font = { name: "Arial", sz: 11, color: { rgb: "FF16A34A" }, bold: true }; 
                    } 
                    else if ([7, 8, 9].includes(C)) {
                        cellStyle.font = { name: "Arial", sz: 11, color: { rgb: "FFDC2626" }, bold: true }; 
                    }
                    else if (C === 12) {
                        cellStyle.font = { name: "Arial", sz: 11, color: { rgb: "FFEA580C" }, bold: true }; 
                    }

                    if (cellValue === 0 && [4, 6, 7, 8, 9, 11].includes(C)) {
                        cellStyle.font = { name: "Arial", sz: 11, color: { rgb: "FFCBD5E1" }, bold: false }; 
                    }
                }

                ws[cellRef].s = cellStyle;
            }
        }

        // 8. ضبط اتجاه الشيت عربي وتحديد ارتفاع صف العنوان
        ws['!dir'] = 'rtl';
        ws['!rows'] = [{ hpt: 35 }]; // إعطاء ارتفاع ممتاز ومريح لصف العنوان الرئيسي 📏

        // 9. ضبط عرض الأعمدة
        ws['!cols'] = [
            { wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, 
            { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, 
            { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }  
        ];
        
        // 10. إنشاء وتنزيل الملف باسم ديناميكي واضح
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `مسير_${monthNameArabic}`);
        XLSX.writeFile(wb, `مسير_رواتب_شهر_${monthNameArabic}_لسنة_${selectedYear}.xlsx`);
    };

    const importLaborLogs = async () => {
        await fetchPayrollData();
        notify("تم تحديث وإعادة تصفية بيانات المسير لحظياً من قاعدة البيانات!");
    };

    const savePayrollToDB = async () => {
        if (isLoading || isSaving) return;
        if (!sheetIsCurrent()) return;
        const liveRecords = latestFilteredRef.current;
        
        if (liveRecords.length === 0) return;
        const confirmSave = confirm(`هل أنت متأكد من حفظ رواتب ومبالغ صرف شهر ${selectedMonth}/${selectedYear}؟`);
        if (!confirmSave) return;

        setIsSaving(true);
        const targetMonthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        
        try {
            await savePayrollDrafts(supabase, targetMonthStr, cutoffDate, liveRecords);
            
            notify("تم إثبات وحفظ مبالغ الصرف والتعديلات بنجاح تام!");
            
            await fetchPayrollData();

        } catch (err: any) {
            notify(`خطأ في الحفظ: ${err.message}`);
            console.error("Full Error Details:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const postToJournal = async () => {
        if (isLoading || isSaving) return;
        if (!sheetIsCurrent()) return;
        const confirmPost = confirm('تأكيد حفظ وترحيل رواتب الموظفين الشهرية ضمن الاختيار؟ اليوميات والسلف والجزاءات تظل من شاشاتها.');
        if (!confirmPost) return;

        setIsSaving(true);
        try {
            const targetMonthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
            await postPayroll(supabase, targetMonthStr, cutoffDate, latestFilteredRef.current);

            notify("تم ترحيل القيد المحاسبي بنجاح!");
            await fetchPayrollData();
        } catch (err: any) {
            notify(`فشل الترحيل: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const unpostFromJournal = async () => {
        if (isLoading || isSaving || !sheetIsCurrent() || !confirm('تأكيد فك ترحيل الرواتب الشهرية ضمن الاختيار؟ ستبقى سندات الصرف واليوميات والجزاءات كما هي.')) return;
        setIsSaving(true);
        try {
            const period = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
            await unpostPayroll(supabase, period, latestFilteredRef.current);
            notify('تم فك ترحيل الرواتب الشهرية المختارة.');
            await fetchPayrollData();
        } catch (err: any) {
            notify('تعذر فك الترحيل: ' + err.message);
        } finally { setIsSaving(false); }
    };

    function sheetIsCurrent() {
        const period = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        if (loadedSheetRef.current === `${period}|${cutoffDate}`) return true;
        notify('انتظر اكتمال تحميل الشهر وتاريخ القطع قبل الحفظ أو الترحيل.');
        return false;
    }

    return {
        isLoading, filteredRecords, globalSearch, setGlobalSearch,
        selectedMonth, setSelectedMonth, selectedYear, setSelectedYear,
        cutoffDate, setCutoffDate, 
        employees, selectedEmployeeIds, setSelectedEmployeeIds,
        filterActiveOnly, setFilterActiveOnly,
        updateRecord, totals, exportToExcel,
        isEditModalOpen, setIsEditModalOpen, currentRecord, setCurrentRecord, 
        importLaborLogs, savePayrollToDB, postToJournal, unpostFromJournal, isSaving
    };
}
