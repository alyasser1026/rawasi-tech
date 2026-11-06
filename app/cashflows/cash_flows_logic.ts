"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export function useCashFlowsLogic() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, inflow, outflow
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const { data: cashFlows = [], isLoading } = useQuery({
        queryKey: ['cash_flows_list'],
        queryFn: async () => {
            let allData: any[] = [];
            let hasMore = true;
            let step = 0;
            const pageSize = 1000;

            // 🚀 محرك السحب العميق المُحصّن
            while (hasMore) {
                const { data, error } = await supabase
                    .from('cash_flows')
                    .select(`
                        *,
                        project:projects!cash_flows_project_id_company_fkey(Property),
                        partner:partners(name),
                        account:accounts(name)
                    `)
                    .order('transaction_date', { ascending: false })
                    .order('id', { ascending: true }) // ⚓ حسم الترتيب بالـ id الفريد لمنع انزلاق السطور
                    .range(step * pageSize, (step + 1) * pageSize - 1);
                
                if (error) {
                    console.error("Error fetching cash flows:", error);
                    throw error;
                }
                
                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    // لو الداتا اللي رجعت أقل من 1000، معناه إننا وصلنا لآخر الداتابيز
                    if (data.length < pageSize) {
                        hasMore = false;
                    } else {
                        step++; // كمل سحب الألف اللي بعدهم
                    }
                } else {
                    hasMore = false; // مفيش داتا تانية
                }
            }
            
            // 🛡️ درع الحماية المالي: فلترة ومنع تكرار الـ ID نهائياً لضمان سلامة الحسابات
            const uniqueDataMap = new Map();
            allData.forEach((item) => {
                if (item.id) {
                    uniqueDataMap.set(item.id, item); // الـ Map بيمسح النسخة القديمة لو الـ ID اتكرر
                }
            });
            
            return Array.from(uniqueDataMap.values());
        },
        // ⚡ تحسينات الأداء والـ Caching:
        staleTime: 1000 * 60 * 5, // الاحتفاظ بالبيانات لمدة 5 دقائق بدون إعادة سحب من السيرفر
        refetchOnWindowFocus: false, // منع سحب البيانات تلقائياً عند التنقل بين نوافذ المتصفح
    });

    return {
        cashFlows,
        isLoading,
        searchTerm, setSearchTerm,
        filterType, setFilterType,
        dateFrom, setDateFrom,
        dateTo, setDateTo
    };
}