"use client";
import { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/lib/toast-context';
import { fetchPaginatedData } from '@/lib/supabase-pagination';

/**
 * العقل المدبر لدفتر اليومية الشامل - فاي تك V12
 * 🟢 سحب على مراحل (1000 × 1000) مع حماية من التكرار
 * 🟢 فلترة شاملة حسب الفترة والحساب والشريك والمشروع ونوع القيد
 */
export function useJournalLogic() {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    // 1. إدارة الحالة (State Management)
    const [globalSearch, setGlobalSearch] = useState('');
    const deferredSearch = useDeferredValue(globalSearch);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterAccountId, setFilterAccountId] = useState<string | null>(null);
    const [filterPartnerId, setFilterPartnerId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState('الكل'); 
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // 📥 2. محرك جلب البيانات - سحب على مراحل (React Query)
    const { data: journalMaster = [], isLoading, isError } = useQuery({
        queryKey: ['journal_master_view', dateFrom, dateTo, filterAccountId, filterPartnerId, filterStatus], 
        queryFn: async () => {
            const buildQuery = () => {
                let query = supabase
                    .from('journal_master_view') 
                    .select('*')
                    .order('entry_date', { ascending: false })
                    .order('line_created_at', { ascending: false })
                    .order('line_id', { ascending: false });
                
                if (dateFrom) query = query.gte('entry_date', dateFrom);
                if (dateTo) query = query.lte('entry_date', dateTo);
                if (filterAccountId) query = query.eq('account_id', filterAccountId);
                if (filterPartnerId) query = query.eq('partner_id', filterPartnerId);
                
                if (filterStatus === 'معتمد') query = query.eq('header_status', 'معتمد');
                if (filterStatus === 'مسودة') query = query.eq('header_status', 'draft');

                return query;
            };

            return await fetchPaginatedData(buildQuery, 'line_id');
        },
        staleTime: 60 * 1000 
    });

    // 🔍 3. التصفية المتقدمة
    const displayedLines = useMemo(() => {
        if (!journalMaster || journalMaster.length === 0) return [];
        let result = journalMaster;

        if (filterStatus !== 'الكل') {
            const targetStatus = filterStatus === 'معتمد' ? 'معتمد' : 'draft';
            result = result.filter(r => r.header_status === targetStatus);
        }

        if (deferredSearch) {
            const lower = deferredSearch.toLowerCase();
            result = result.filter(r => 
                (r.line_notes && String(r.line_notes).toLowerCase().includes(lower)) ||
                (r.header_description && String(r.header_description).toLowerCase().includes(lower)) ||
                (r.reference_id && String(r.reference_id).toLowerCase().includes(lower)) ||
                (r.account_name && String(r.account_name).toLowerCase().includes(lower)) ||
                (r.partner_name && String(r.partner_name).toLowerCase().includes(lower)) ||
                (r.project_name && String(r.project_name).toLowerCase().includes(lower))
            );
        }
        return result;
    }, [journalMaster, deferredSearch, filterStatus]);

    // 🧮 4. محرك الحسابات المالية
    const totals = useMemo(() => {
        let totalDebit = 0;
        let totalCredit = 0;
        
        displayedLines.forEach(line => {
            const safeDebit = parseFloat(String(line.debit || 0).replace(/,/g, ''));
            const safeCredit = parseFloat(String(line.credit || 0).replace(/,/g, ''));
            
            totalDebit += isNaN(safeDebit) ? 0 : safeDebit;
            totalCredit += isNaN(safeCredit) ? 0 : safeCredit;
        });
        
        return { 
            totalDebit, 
            totalCredit, 
            balance: totalDebit - totalCredit, 
            count: displayedLines.length 
        };
    }, [displayedLines]);

    // 🚀 5. محرك الحذف المجمع
    const deleteHeadersMutation = useMutation({
        mutationFn: async () => {
            const selectedLines = journalMaster.filter(l => selectedIds.includes(String(l.line_id)));
            const headerIds = [...new Set(selectedLines.map(l => l.header_id))];
            
            // 🛡️ حماية القيود المعتمدة
            const { data: { session } } = await supabase.auth.getSession();
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', session?.user?.id).single();
            const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';
            
            const hasApproved = selectedLines.some((l:any) => l.header_status === 'معتمد' || l.header_status === 'مرحل');
            if (hasApproved) {
                throw new Error('عفواً، لا يمكن حذف القيود المعتمدة والمرحلة. يرجى فك الترحيل أولاً.');
            }

            if (headerIds.length === 0) throw new Error('لم يتم تحديد أي قيود صالحة.');

            const { error } = await supabase.from('journal_headers').delete().in('id', headerIds);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            showToast('تم حذف القيود وارتباطاتها بنجاح', 'success');
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['journal_master_view'] });
        },
        onError: (err: any) => showToast(`فشل الحذف: ${err.message}`, 'error')
    });

    const handleDeleteHeaders = useCallback(() => {
        if (confirm('تنبيه: سيتم حذف القيود المحددة بالكامل (مدين ودائن). هل أنت متأكد؟')) {
            deleteHeadersMutation.mutate();
        }
    }, [deleteHeadersMutation]);

    const isFiltered = !!(filterAccountId || filterPartnerId || dateFrom || dateTo || (filterStatus !== 'الكل'));

    // 💎 6. تجريد المخرجات
    return {
        data: displayedLines,
        isLoading,
        isError,
        totals,
        isFiltered,
        state: {
            globalSearch,
            dateFrom,
            dateTo,
            filterAccountId,
            filterPartnerId,
            filterStatus,
            selectedIds
        },
        actions: {
            setGlobalSearch,
            setDateFrom,
            setDateTo,
            setFilterAccountId,
            setFilterPartnerId,
            setFilterStatus,
            setSelectedIds,
            handleDeleteHeaders
        }
    };
}