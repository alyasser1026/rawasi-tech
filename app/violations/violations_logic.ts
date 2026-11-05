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
            
            if (cleanPayload.project_id && !cleanPayload.job_order_id) {
                throw new Error("يرجى اختيار أمر الشغل عشان الجزاء يتحمّل عليه");
            }

            // الحسابات بالكود جوه الشركة المفتوحة (مش أرقام ثابتة من شركة واحدة):
            // المدين دايماً 216 (رواتب وأجور مستحقة)، والدائن حسب نوع الحركة
            const creditCode = cleanPayload.violation_type === 'استقطاع سكن' ? '45'      // إيرادات استرداد مصاريف السكن
                : cleanPayload.violation_type === 'سداد سلفة عمالة' ? '127'             // سلف عمالة الموقع
                : cleanPayload.violation_type === 'سداد سلفة موظفين' ? '128'            // سلف موظفين الشركة
                : '46';                                                                 // إيراد خصومات وجزاءات
            const { data: accs, error: accErr } = await supabase.from('accounts').select('id, code').in('code', ['216', creditCode]);
            if (accErr) throw accErr;
            const FIXED_DEBIT_ID = accs?.find((a: any) => a.code === '216')?.id;
            const dynamicCreditId = accs?.find((a: any) => a.code === creditCode)?.id;
            if (!FIXED_DEBIT_ID || !dynamicCreditId) {
                throw new Error(`الحساب رقم ${!FIXED_DEBIT_ID ? '216' : creditCode} مش موجود في دليل حسابات الشركة المفتوحة`);
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