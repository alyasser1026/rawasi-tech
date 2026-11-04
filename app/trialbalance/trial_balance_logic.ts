"use client";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { notify } from '@/lib/notify';

export function useTrialBalanceLogic() {
    const [records, setRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // افتراضياً: من أول الشهر لآخره
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]);

    const fetchTrialBalance = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_trial_balance', {
                p_start_date: startDate,
                p_end_date: endDate
            });

            if (error) throw error;
            setRecords(data || []);
            
        } catch (err: any) {
            console.error("Error fetching Trial Balance:", err.message);
            notify("حدث خطأ أثناء جلب ميزان المراجعة");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTrialBalance();
    }, [startDate, endDate]);

    // حساب إجماليات الميزان (يجب أن يتطابق المدين مع الدائن دائماً)
    const totals = useMemo(() => {
        return records.reduce((acc, r) => {
            acc.op_debit += Number(r.opening_debit) || 0;
            acc.op_credit += Number(r.opening_credit) || 0;
            acc.per_debit += Number(r.period_debit) || 0;
            acc.per_credit += Number(r.period_credit) || 0;
            acc.end_debit += Number(r.ending_debit) || 0;
            acc.end_credit += Number(r.ending_credit) || 0;
            return acc;
        }, { op_debit: 0, op_credit: 0, per_debit: 0, per_credit: 0, end_debit: 0, end_credit: 0 });
    }, [records]);

    // تصدير احترافي للإكسيل
    const exportToExcel = () => {
        const dataToExport = records.map(r => ({
            "رقم الحساب": r.account_code,
            "اسم الحساب": r.account_name,
            "رصيد افتتاحي (مدين)": Number(r.opening_debit) || 0,
            "رصيد افتتاحي (دائن)": Number(r.opening_credit) || 0,
            "حركة الفترة (مدين)": Number(r.period_debit) || 0,
            "حركة الفترة (دائن)": Number(r.period_credit) || 0,
            "الرصيد الختامي (مدين)": Number(r.ending_debit) || 0,
            "الرصيد الختامي (دائن)": Number(r.ending_credit) || 0,
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        ws['!cols'] = [{wch: 15}, {wch: 35}, {wch: 18}, {wch: 18}, {wch: 18}, {wch: 18}, {wch: 18}, {wch: 18}];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "ميزان المراجعة");
        XLSX.writeFile(wb, `ميزان_المراجعة_${startDate}_إلى_${endDate}.xlsx`);
    };

    return {
        records,
        isLoading,
        startDate, setStartDate,
        endDate, setEndDate,
        fetchTrialBalance,
        totals,
        exportToExcel
    };
}