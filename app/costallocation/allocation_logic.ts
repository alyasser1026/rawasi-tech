"use client";
import { useState, useMemo, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase'; 
import { useQuery } from '@tanstack/react-query'; 
import { fetchDailyWorkerExpenseAllocations } from '@/lib/dailyWorkerExpenseAllocation';
import { useCompany } from '@/lib/CompanyContext';

export function useAllocationViewLogic() {
    const { activeCompanyId } = useCompany();
    const [globalSearch, setGlobalSearch] = useState('');
    const deferredSearch = useDeferredValue(globalSearch);
    const [selectedMonth, setSelectedMonth] = useState(''); 
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);

    // 📡 جلب البيانات وتوزيع المصروفات حسب اليوم وعدد العمالة على الفلل وأوامر الشغل
    const { data: allocationData = [], isLoading } = useQuery({
        queryKey: ['advanced_cost_allocation_view', activeCompanyId],
        queryFn: async () => {
            return await fetchDailyWorkerExpenseAllocations(supabase, {
                companyId: activeCompanyId || null,
            });
        }
    });

    // 🔍 استخراج قائمة الشهور المتاحة
    const uniqueMonths = useMemo(() => {
        const months = allocationData.map((item: any) => item["شهر التحميل المالي"]);
        return [...new Set(months)].sort().reverse();
    }, [allocationData]);

    // 📊 التصفية والبحث النصي
    const filteredData = useMemo(() => {
        let result = allocationData;

        if (selectedMonth) {
            result = result.filter((item: any) => item["شهر التحميل المالي"] === selectedMonth);
        }

        if (deferredSearch) {
            const searchLower = deferredSearch.toLowerCase();
            result = result.filter((item: any) => 
                item["اسم الفيلا المحمل عليها"]?.toLowerCase().includes(searchLower) ||
                item["رقم أمر التشغيل"]?.toLowerCase().includes(searchLower) ||
                item["البند المحمل عليه"]?.toLowerCase().includes(searchLower) ||
                item["التصنيف الرئيسي"]?.toLowerCase().includes(searchLower) ||
                item["البيان / الوصف"]?.toLowerCase().includes(searchLower) ||
                item["وصف المصروف التلقائي"]?.toLowerCase().includes(searchLower) ||
                item["آلية التوزيع"]?.toLowerCase().includes(searchLower)
            );
        }

        return result;
    }, [allocationData, selectedMonth, deferredSearch]);

    // 📄 تقسيم البيانات لصفحات
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, currentPage, rowsPerPage]);

    // 💰 حساب إجمالي المصروفات
    const totalAllocatedAmount = useMemo(() => {
        return filteredData.reduce(
            (sum: number, item: any) =>
                sum + Number(item["المبلغ المحمل (ر.س)"] ?? item["المبلغ المحمل (جنيه)"] ?? 0),
            0
        );
    }, [filteredData]);

    return {
        filteredData, paginatedItems, uniqueMonths,
        isLoading, totalAllocatedAmount, 
        globalSearch, setGlobalSearch: (v: string) => { setGlobalSearch(v); setCurrentPage(1); },
        selectedMonth, setSelectedMonth: (v: string) => { setSelectedMonth(v); setCurrentPage(1); },
        currentPage, setCurrentPage,
        rowsPerPage, setRowsPerPage: (v: number) => { setRowsPerPage(v); setCurrentPage(1); }
    };
}