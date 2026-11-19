"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { fetchPaginatedData } from '@/lib/supabase-pagination';

export function useCashFlowsLogic() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, inflow, outflow
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const { data: cashFlows = [], isLoading } = useQuery({
        queryKey: ['cash_flows_list'],
        queryFn: async () => {
            const buildQuery = () =>
                supabase
                    .from('cash_flows')
                    .select(`
                        *,
                        project:projects!cash_flows_project_id_company_fkey(Property),
                        partner:partners!cash_flows_partner_id_company_fkey(name),
                        account:accounts!cash_flows_account_id_company_fkey(name)
                    `)
                    .order('transaction_date', { ascending: false })
                    .order('id', { ascending: true });

            return await fetchPaginatedData(buildQuery, 'id');
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