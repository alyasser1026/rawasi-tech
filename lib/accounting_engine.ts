"use client"; // 🟢 تم التغيير لـ Client لأننا سنستخدم Hooks (React Query) والعمليات الثقيلة أصبحت في الداتابيز (RPC)

import { supabase } from './supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from './toast-context';

// ============================================================================
// 🚀 المحرك الموحد للترحيل وفك الترحيل (الباب العاشر - ميثاق رواسي V11)
// ============================================================================
export function useUniversalPosting(queryKey: string, tableName: string, postRpcName: string) {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    // 🟢 1. دالة الترحيل المخصصة (تستدعي دالة SQL الخاصة بكل موديول)
    const postMutation = useMutation({
        mutationFn: async (selectedIds: string[]) => {
            if (!selectedIds || selectedIds.length === 0) throw new Error("لم يتم تحديد أي سجلات للترحيل.");
            
            // الاعتماد حصراً على السيرفر (Edge Functions) لمنع التهنيج
            const { error } = await supabase.rpc(postRpcName, { p_ids: selectedIds });
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            showToast('تم الترحيل وإصدار القيود بنجاح', 'success');
            queryClient.invalidateQueries({ queryKey: [queryKey] });
        },
        onError: (err: any) => showToast(`فشل الترحيل: ${err.message}`, 'error')
    });

    // ⏪ 2. دالة فك الترحيل الموحدة (Universal Unpost)
    const unpostMutation = useMutation({
        mutationFn: async (selectedIds: string[]) => {
            if (!selectedIds || selectedIds.length === 0) throw new Error("لم يتم تحديد أي سجلات لفك الترحيل.");
            
            // استدعاء الدالة المركزية في الداتابيز بخطوة واحدة
            const { error } = tableName === 'payment_vouchers'
                ? await supabase.rpc('unpost_payment_vouchers_bulk', { p_ids: selectedIds })
                : await supabase.rpc('unpost_universal_bulk', { p_ids: selectedIds, p_table_name: tableName });
            if (error) throw new Error(error.message);

            // 🚀 تصحيح: الدالة المركزية قد لا تحدث حالة السند النصية إلى مسودة، مما يجعله "معلقاً" عند التعديل
            if (tableName !== 'payment_vouchers') {
                const { error: statusError } = await supabase.from(tableName).update({ status: 'مسودة' }).in('id', selectedIds);
                if (statusError) throw new Error(statusError.message);
            }
        },
        onSuccess: () => {
            showToast('تم فك الترحيل ومسح القيود بنجاح', 'success');
            queryClient.invalidateQueries({ queryKey: [queryKey] });
            if (tableName === 'payment_vouchers') {
                queryClient.invalidateQueries({ queryKey: ['contractor_claims_history'] });
            }
        },
        onError: (err: any) => showToast(`فشل فك الترحيل: ${err.message}`, 'error')
    });

    return {
        postRecords: (ids: string[]) => postMutation.mutate(ids),
        unpostRecords: (ids: string[]) => unpostMutation.mutate(ids),
        isProcessing: postMutation.isPending || unpostMutation.isPending
    };
}

// ============================================================================
// 📊 دالة سحب وتجميع البيانات الضخمة (تخطي حاجز الـ 1000 سطر - الباب الثالث)
// ============================================================================
export async function calculateMassiveTotals(tableName: string, amountColumn: string) {
    try {
        let total = 0;
        let keepFetching = true;
        let offset = 0;
        const limit = 1000;

        // التجزئة الذرية (Atomic Chunking) لجمع المبالغ
        while (keepFetching) {
            const { data, error } = await supabase
                .from(tableName)
                .select(amountColumn)
                .range(offset, offset + limit - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                total += (data as unknown as Record<string, unknown>[]).reduce((sum, row) => sum + Number(row[amountColumn] || 0), 0);
                offset += limit;
                if (data.length < limit) keepFetching = false;
            } else {
                keepFetching = false;
            }
        }
        
        return { success: true, total };
    } catch (error: any) {
        console.error("Calculation Error:", error);
        return { success: false, error: error.message };
    }
}
