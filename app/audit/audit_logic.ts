"use client";
import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { useToast } from '@/lib/toast-context';
import { fetchAllSupabaseData } from '@/lib/helpers';

export function useAdvancedAuditLogic() {
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState('all');

    // 🚀 جلب كل الأخطاء من الـ View الشامل بطلب واحد سريع جداً
    const { data: errors = [], isLoading, refetch } = useQuery({
        queryKey: ['advanced_audit_errors'],
        queryFn: async () => {
            return await fetchAllSupabaseData(supabase, 'vw_advanced_audit') || [];
        }
    });

    // 🛡️ دالة الحذف (فردي - ذكية: تمسح القيود المضروبة وتعلق اليوميات)
    const deleteErrorMutation = useMutation({
        mutationFn: async ({ error_id, table_name }: { error_id: string, table_name: string }) => {
            const { error } = await supabase.rpc('smart_audit_delete', { 
                p_error_id: error_id, 
                p_table_name: table_name 
            });
            if (error) throw error;
        },
        onSuccess: () => {
            showToast("تم معالجة السجل بنجاح (تم التعليق/الحذف)", "success");
            queryClient.invalidateQueries({ queryKey: ['advanced_audit_errors'] });
            setSelectedIds([]);
        }
    });

    // 🛡️ دالة الحذف الجماعي (ذكية: تطهير آمن للبيانات)
    const bulkDeleteMutation = useMutation({
        mutationFn: async () => {
            const itemsToDelete = errors.filter(e => selectedIds.includes(e.error_id));
            
            // تمرير الأخطاء المحددة على الدالة الذكية لضمان تعليق اليوميات بدلاً من مسحها
            for (const item of itemsToDelete) {
                const { error } = await supabase.rpc('smart_audit_delete', { 
                    p_error_id: item.error_id, 
                    p_table_name: item.table_name 
                });
                if (error) {
                    console.error(`خطأ في معالجة السجل:`, error);
                    throw error;
                }
            }
        },
        onSuccess: () => {
            showToast(`تم معالجة ${selectedIds.length} خطأ من النظام بنجاح`, "success");
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['advanced_audit_errors'] });
        }
    });

    // ⚖️ محرك الموازنة الآلية (للقيود فقط) - تم تحديثه لمعالجة الأرقام والأخطاء
    const autoBalanceMutation = useMutation({
        mutationFn: async ({ header_id, diff_amount }: { header_id: string, diff_amount: number | string }) => {
            const numDiff = Number(diff_amount); // 🚀 تأكيد تحويل القيمة لرقم صحيح
            const isDebitMissing = numDiff < 0; 
            
            const fixLine = {
                header_id: header_id,
                account_id: 'd5e827b1-4f1a-4c2f-8a03-8d6e7f123456', // 👈 تم التعديل: ID حساب التسويات الجديد
                notes: 'تسوية آلية لفرق هللات - رادار التدقيق المتقدم', // 👈 تم التعديل: استخدام notes بدلاً من description
                debit: isDebitMissing ? Math.abs(numDiff) : 0,
                credit: isDebitMissing ? 0 : Math.abs(numDiff),
            };

            const { error } = await supabase.from('journal_lines').insert([fixLine]);
            if (error) throw error;
        },
        onSuccess: () => {
            showToast("تم موازنة القيد وإصلاح الخلل", "success");
            queryClient.invalidateQueries({ queryKey: ['advanced_audit_errors'] });
        },
        onError: (err: any) => {
            // 🚀 إظهار تنبيه واضح لو العملية اترفضت من الداتابيز
            showToast(`فشل الموازنة: ${err.message}`, "error");
        }
    });

    // 🧹 دالة تنظيف القيود الصفرية والعمياء (الجديدة)
    const cleanZeroLinesMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.rpc('clean_blind_journal_lines');
            if (error) throw error;
        },
        onSuccess: () => {
            showToast("تم تطهير النظام من القيود الصفرية والعمياء بنجاح", "success");
            queryClient.invalidateQueries({ queryKey: ['advanced_audit_errors'] });
            setSelectedIds([]); // تصفير التحديد
        },
        onError: (err: any) => {
            showToast(`فشل التنظيف: ${err.message}`, "error");
        }
    });

    // 📊 تصدير إكسيل 
    const exportToExcel = () => {
        if (errors.length === 0) return showToast("لا يوجد أخطاء للتصدير", 'info');
        const ws = XLSX.utils.json_to_sheet(errors.map(e => ({
            'مصدر الخطأ (الجدول)': e.table_name,
            'نوع الخطأ': e.error_type,
            'التاريخ': e.error_date,
            'التفاصيل': e.details,
            'الفرق المالي': Number(e.diff_amount) || 0,
            'معرف السجل': e.error_id
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "System_Audit_Report");
        XLSX.writeFile(wb, `System_Audit_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // 🔍 فلترة البيانات 
    const filteredErrors = useMemo(() => {
        let result = errors;
        if (activeTab !== 'all') {
            result = result.filter(e => e.error_type.includes(activeTab) || e.table_name.includes(activeTab));
        }
        if (searchQuery) {
            result = result.filter(e => 
                e.details?.includes(searchQuery) || 
                e.error_type?.includes(searchQuery) || 
                e.table_name?.includes(searchQuery)
            );
        }
        return result;
    }, [errors, activeTab, searchQuery]);

    // 📈 الإحصائيات
    const stats = useMemo(() => ({
        total: errors.length,
        unbalanced: errors.filter(e => e.error_type.includes('غير متزن')).length,
        ghosts: errors.filter(e => e.error_type.includes('شبح')).length,
        orphans: errors.filter(e => e.error_type.includes('يتيم')).length,
        brokenRef: errors.filter(e => e.error_type.includes('مفقود') || e.error_type.includes('بدون') || e.error_type.includes('نقص')).length,
    }), [errors]);

    const toggleSelection = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    const selectAll = () => setSelectedIds(selectedIds.length === filteredErrors.length ? [] : filteredErrors.map(e => e.error_id));

    return {
        isLoading, errors: filteredErrors, stats,
        searchQuery, setSearchQuery, activeTab, setActiveTab,
        selectedIds, toggleSelection, selectAll,
        deleteError: (id: string, table: string) => deleteErrorMutation.mutate({ error_id: id, table_name: table }),
        isDeleting: deleteErrorMutation.isPending,
        bulkDelete: () => bulkDeleteMutation.mutate(),
        isBulkDeleting: bulkDeleteMutation.isPending,
        autoBalance: (id: string, diff: number) => autoBalanceMutation.mutate({ header_id: id, diff_amount: diff }),
        
        // 🚀 إضافة المتغيرات الجديدة الخاصة بزرار التطهير هنا
        cleanZeroLines: () => cleanZeroLinesMutation.mutate(),
        isCleaningZeroLines: cleanZeroLinesMutation.isPending,
        
        exportToExcel, refetch
    };
}