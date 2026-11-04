import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useUniversalPosting, calculateMassiveTotals } from '@/lib/accounting_engine';
import { useToast } from '@/lib/toast-context';

export function useManualJournalsLogic() {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    // 🎛️ حالة الواجهة والفلترة
    const [globalSearch, setGlobalSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    const [filterDebitAccount, setFilterDebitAccount] = useState('الكل');
    const [filterCreditAccount, setFilterCreditAccount] = useState('الكل');
    const [filterStatus, setFilterStatus] = useState('الكل');

    // 🚀 1. جلب البيانات الأساسية
    const { data: rawJournals = [], isLoading } = useQuery({
        queryKey: ['manual_journals'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('manual_journals')
                .select(`
                    *,
                    debit_account:accounts!manual_journals_debit_account_id_fkey(name),
                    credit_account:accounts!manual_journals_credit_account_id_fkey(name),
                    partner:partners(name),
                    project:projects(Property)
                `)
                .order('entry_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        }
    });

    const { data: accounts = [] } = useQuery({
        queryKey: ['accounts_list'],
        queryFn: async () => {
            const { data } = await supabase.from('accounts').select('id, name, account_type').order('name');
            return data || [];
        }
    });

    const { data: partners = [] } = useQuery({
        queryKey: ['partners_list'],
        queryFn: async () => {
            const { data } = await supabase.from('partners').select('id, name').order('name');
            return data || [];
        }
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['projects_list'],
        queryFn: async () => {
            const { data } = await supabase.from('projects').select('id, name:Property').order('Property');
            return data || [];
        }
    });

    // 🚀 2. محرك الفلترة والبحث المدمج
    const displayedJournals = useMemo(() => {
        let filtered = rawJournals;

        if (globalSearch) {
            const term = globalSearch.toLowerCase();
            filtered = filtered.filter((j: any) => 
                j.voucher_number?.toLowerCase().includes(term) ||
                j.description?.toLowerCase().includes(term) ||
                j.debit_account?.name?.toLowerCase().includes(term) ||
                j.credit_account?.name?.toLowerCase().includes(term)
            );
        }

        if (dateFrom) filtered = filtered.filter((j: any) => j.entry_date >= dateFrom);
        if (dateTo) filtered = filtered.filter((j: any) => j.entry_date <= dateTo);
        if (filterStatus !== 'الكل') filtered = filtered.filter((j: any) => j.status === filterStatus);
        if (filterDebitAccount !== 'الكل') filtered = filtered.filter((j: any) => j.debit_account_id === filterDebitAccount);
        if (filterCreditAccount !== 'الكل') filtered = filtered.filter((j: any) => j.credit_account_id === filterCreditAccount);

        return filtered;
    }, [rawJournals, globalSearch, dateFrom, dateTo, filterStatus, filterDebitAccount, filterCreditAccount]);

    const paginatedJournals = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return displayedJournals.slice(start, start + rowsPerPage);
    }, [displayedJournals, currentPage, rowsPerPage]);

    const totalPages = Math.ceil(displayedJournals.length / rowsPerPage) || 1;

    // 💰 3. الإجماليات
    const { data: serverTotals } = useQuery({
        queryKey: ['manual_journals_totals'],
        queryFn: () => calculateMassiveTotals('manual_journals', 'amount')
    });

    const totals = useMemo(() => {
        const isFiltered = !!(globalSearch || dateFrom || dateTo || filterStatus !== 'الكل' || filterDebitAccount !== 'الكل' || filterCreditAccount !== 'الكل');
        if (isFiltered) {
            return {
                amount: displayedJournals.reduce((sum: number, j: any) => sum + (Number(j.amount) || 0), 0)
            };
        }
        return {
            amount: serverTotals?.total || 0
        };
    }, [displayedJournals, serverTotals, globalSearch, dateFrom, dateTo, filterStatus, filterDebitAccount, filterCreditAccount]);

    // 🚀 4. محرك الترحيل المركزي
    const { postRecords, unpostRecords, isProcessing } = useUniversalPosting(
        'manual_journals',
        'manual_journals',
        'post_manual_journals_bulk'
    );

    // 📝 5. عمليات الحفظ 
    const saveMutation = useMutation({
        mutationFn: async (journalData: any) => {
            if (journalData.id) {
                const { data: existing } = await supabase.from('manual_journals').select('is_posted, status').eq('id', journalData.id).single();
                if (existing && (existing.is_posted || existing.status === 'مرحل' || existing.status === 'معتمد')) {
                    throw new Error("لا يمكن تعديل قيد مرحل. يرجى فك الترحيل أولاً.");
                }
            }

            if (!journalData.amount || Number(journalData.amount) <= 0) {
                throw new Error("تنبيه: يرجى إدخال المبلغ المراد ترحيله.");
            }
            if (!journalData.debit_account_id || !journalData.credit_account_id) {
                throw new Error("تنبيه: يرجى اختيار الحساب المدين والدائن.");
            }
            if (journalData.debit_account_id === journalData.credit_account_id) {
                throw new Error("تنبيه: لا يمكن أن يكون الحساب المدين هو نفسه الحساب الدائن.");
            }

            let payload = { ...journalData };
            payload.amount = parseFloat(Number(payload.amount).toFixed(2));
            
            // تنظيف الحقول
            delete payload.debit_account; 
            delete payload.credit_account; 
            delete payload.partner; 
            delete payload.project;

            // تحويل النصوص الفارغة إلى null لتجنب خطأ UUID في قاعدة البيانات
            if (!payload.partner_id) payload.partner_id = null;
            if (!payload.project_id) payload.project_id = null;
            if (!payload.job_order_id) payload.job_order_id = null;

            if (payload.id) {
                const { error } = await supabase.from('manual_journals').update(payload).eq('id', payload.id);
                if (error) throw error;
            } else {
                delete payload.id; // تأكيد حذف الـ id في حالة الإنشاء
                payload.voucher_number = `MJ-${Date.now()}`;
                const { error } = await supabase.from('manual_journals').insert([payload]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            showToast('تم الحفظ بنجاح', 'success');
            queryClient.invalidateQueries({ queryKey: ['manual_journals'] });
        },
        onError: (err: any) => {
            showToast(err.message || 'حدث خطأ أثناء الحفظ', 'error');
        }
    });

    // 🗑️ 6. الحذف
    const deleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const { data: check } = await supabase.from('manual_journals').select('is_posted, status').in('id', ids);
            if (check?.some(r => r.is_posted || r.status === 'مرحل' || r.status === 'معتمد')) {
                throw new Error('لا يمكن حذف قيود مرحلة. يجب فك الترحيل أولاً.');
            }
            const { error } = await supabase.from('manual_journals').delete().in('id', ids);
            if (error) throw error;
        },
        onSuccess: () => {
            showToast('تم الحذف بنجاح', 'success');
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['manual_journals'] });
        },
        onError: (err: any) => showToast(`خطأ في الحذف: ${err.message}`, 'error')
    });

    return {
        state: {
            isLoading,
            globalSearch, setGlobalSearch,
            dateFrom, setDateFrom, dateTo, setDateTo,
            rowsPerPage, setRowsPerPage, currentPage, setCurrentPage,
            selectedIds, setSelectedIds,
            filterDebitAccount, setFilterDebitAccount,
            filterCreditAccount, setFilterCreditAccount,
            filterStatus, setFilterStatus,
            paginatedJournals, totalPages,
            totals, isProcessing,
            accounts, partners, projects
        },
        actions: {
            handlePostSelected: () => postRecords(selectedIds),
            handleUnpostSelected: () => unpostRecords(selectedIds),
            handleDeleteSelected: () => {
                if(confirm('هل أنت متأكد من مسح القيود المحددة؟')) {
                    deleteMutation.mutate(selectedIds);
                }
            },
            saveJournal: (data: any) => saveMutation.mutateAsync(data)
        }
    };
}
