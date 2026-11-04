"use client";
import { useState, useMemo, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/lib/toast-context';
import { fetchPaginatedData } from '@/lib/supabase-pagination';

export function useViolationsLogic() {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const updateRowsInCache = (targetIds: any[], updatedFields: any) => {
        queryClient.setQueryData(['violations'], (oldData: any[]) => {
            if (!oldData) return [];
            const stringIds = targetIds.map(String);
            return oldData.map(row => 
                stringIds.includes(String(row.id)) ? { ...row, ...updatedFields } : row 
            );
        });
    };

    const [globalSearch, setGlobalSearch] = useState('');
    const deferredSearch = useDeferredValue(globalSearch); 
    const [filterStatus, setFilterStatus] = useState('الكل');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);

    const { data: violations = [], isLoading: isFetching } = useQuery({
        queryKey: ['violations'], 
        queryFn: async () => {
            const buildQuery = () => supabase
                .from('violations') 
                .select(`
                    *,
                    partner:partners!partner_id(partner_type, name),
                    project:projects!project_id(Property),
                    debit_acc:accounts!violations_debit_account_id_fkey(name),
                    credit_acc:accounts!violations_credit_account_id_fkey(name)
                `)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });
            return await fetchPaginatedData(buildQuery, 'id');
        }
    });

    const { displayedViolations, totalSum, totalCount } = useMemo(() => {
        let result = violations;
        if (filterStatus !== 'الكل') {
            result = result.filter(v => v.is_posted === (filterStatus === 'معتمد'));
        }
        if (deferredSearch) {
            const lower = deferredSearch.toLowerCase().trim();
            result = result.filter(v => 
                (v.emp_name?.toLowerCase().includes(lower)) ||
                (v.partner?.name?.toLowerCase().includes(lower)) ||
                (v.reason?.toLowerCase().includes(lower)) ||
                (v.violation_type?.toLowerCase().includes(lower))
            );
        }
        const sum = result.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        return { displayedViolations: result, totalSum: sum, totalCount: result.length };
    }, [violations, deferredSearch, filterStatus]);

    const postMutation = useMutation({
        mutationFn: async (idsToPost: string[]) => {
            if (!idsToPost || idsToPost.length === 0) throw new Error('لا يوجد سجلات للترحيل');
            const previousData = queryClient.getQueryData(['violations']);
            updateRowsInCache(idsToPost, { is_posted: true });

            const chunkSize = 30;
            for (let i = 0; i < idsToPost.length; i += chunkSize) {
                const chunk = idsToPost.slice(i, i + chunkSize);
                const { error } = await supabase.rpc('post_violations_bulk_journal', { violation_ids: chunk });
                if (error) {
                    queryClient.setQueryData(['violations'], previousData); 
                    throw error;
                }
            }
        },
        onSuccess: (data, ids) => {
            showToast(`تم الترحيل وخصم المبالغ من ذمم ${ids.length} شريك`, 'success');
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['violations'] });
        },
        onError: (err: any) => showToast(`فشل الترحيل: ${err.message}`, 'error')
    });

    const unpostMutation = useMutation({
        mutationFn: async (idsToSuspend: string[]) => {
            if (!idsToSuspend || idsToSuspend.length === 0) throw new Error('لا يوجد سجلات للتعليق');
            const previousData = queryClient.getQueryData(['violations']);
            updateRowsInCache(idsToSuspend, { is_posted: false });

            const chunkSize = 30;
            for (let i = 0; i < idsToSuspend.length; i += chunkSize) {
                const chunk = idsToSuspend.slice(i, i + chunkSize);
                const { error } = await supabase.rpc('unpost_violations_bulk_journal', { violation_ids: chunk });
                if (error) {
                    queryClient.setQueryData(['violations'], previousData); 
                    throw error;
                }
            }
        },
        onSuccess: () => {
            showToast('تم فك الترحيل وحذف القيود بنجاح', 'warning');
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['violations'] });
        },
        onError: (err: any) => showToast(`عذراً: ${err.message}`, 'error')
    });

    const deleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            for (const vId of ids) {
                const { data: existing } = await supabase.from('violations').select('is_posted, status').eq('id', vId).single();
                if (existing && (existing.is_posted || existing.status === 'مرحل' || existing.status === 'معتمد')) {
                    throw new Error("لا يمكن حذف مخالفة مرحلة. يرجى فك الترحيل أولاً.");
                }
            }
            
            const chunkSize = 50;
            for (let i = 0; i < ids.length; i += chunkSize) {
                const chunk = ids.slice(i, i + chunkSize);
                const { error } = await supabase.rpc('delete_violations_bulk', { p_ids: chunk });
                if (error) throw error;
            }
            return ids; 
        },
        onSuccess: () => {
            showToast('تم الحذف بنجاح', 'success');
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['violations'] });
        },
        onError: (err: any) => showToast(`خطأ في الحذف: ${err.message}`, 'error')
    });

    // 🧠 التوجيه المحاسبي الديناميكي الذكي
    const saveMutation = useMutation({
        mutationFn: async (payload: any) => {
            if (payload.id) {
                const { data: existing } = await supabase.from('violations').select('is_posted, status').eq('id', payload.id).single();
                if (existing && (existing.is_posted || existing.status === 'مرحل' || existing.status === 'معتمد')) {
                    throw new Error("لا يمكن تعديل مخالفة مرحلة. يرجى فك الترحيل أولاً.");
                }
            }
            const { partner, project, debit_acc, credit_acc, ...cleanPayload } = payload;
            
            // حساب المدين ثابت دايماً: (رواتب وأجور مستحقة)
            const FIXED_DEBIT_ID = '39f878cd-dc58-4a2a-a199-50f6fca983d4'; 
            
            // تحديد حساب الدائن حسب نوع الحركة
            let dynamicCreditId = '25998af5-dca4-4512-8f1a-3d0f9c6b8e98'; // الافتراضي: إيراد خصومات وجزاءات (46)
            
            if (cleanPayload.violation_type === 'استقطاع سكن') {
                dynamicCreditId = 'dd728251-aec7-4d2f-939a-4985d93f2966'; // إيرادات استرداد مصاريف السكن (45)
            } else if (cleanPayload.violation_type === 'سداد سلفة عمالة') {
                dynamicCreditId = 'bcf3c593-4058-400e-8ee9-f38255d405b9'; // سلف عمالة الموقع (127)
            } else if (cleanPayload.violation_type === 'سداد سلفة موظفين') {
                dynamicCreditId = '31c9923a-3629-4f3f-b661-b86df51c8e09'; // سلف موظفين الشركة (128)
            }

            const finalPayload = {
                ...cleanPayload,
                debit_account_id: FIXED_DEBIT_ID,
                credit_account_id: dynamicCreditId,
                is_posted: cleanPayload.id ? cleanPayload.is_posted : false
            };

            if (finalPayload.id) {
                const { error } = await supabase.from('violations').update(finalPayload).eq('id', finalPayload.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('violations').insert([finalPayload]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            showToast('تم الحفظ والتوجيه المحاسبي بنجاح', 'success');
            setIsEditModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['violations'] });
        },
        onError: (err: any) => showToast(`خطأ في الحفظ: ${err.message}`, 'error')
    });

    const isTotalLoading = isFetching || saveMutation.isPending || postMutation.isPending || unpostMutation.isPending || deleteMutation.isPending;

    return {
        data: displayedViolations,
        isLoading: isTotalLoading,
        totals: { totalSum, totalCount },
        actions: {
            setGlobalSearch,
            setFilterStatus,
            setSelectedIds,
            handleEdit: (record: any = null) => {
                if (record) setEditingRecord(record);
                else setEditingRecord({ 
                    date: new Date().toISOString().split('T')[0], 
                    emp_name: '', 
                    amount: 0, 
                    is_posted: false,
                    violation_type: 'غرامة' // القيمة الافتراضية
                });
                setIsEditModalOpen(true);
            },
            handleSave: () => saveMutation.mutate(editingRecord),
            handlePost: () => postMutation.mutate(selectedIds),
            handleUnpost: () => unpostMutation.mutate(selectedIds),
            handleDelete: async () => { if (confirm('تأكيد الحذف؟')) deleteMutation.mutate(selectedIds); },
            handleEmployeeSelect: (v: any) => setEditingRecord({ ...editingRecord, emp_name: v?.name || v, partner_id: v?.id || null, profession: v?.partner_type || '' })
        },
        state: { selectedIds, filterStatus, isEditModalOpen, editingRecord, setIsEditModalOpen, setEditingRecord }
    };
}