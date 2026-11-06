"use client";
import { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; 
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/lib/toast-context';
import { fetchPaginatedData } from '@/lib/supabase-pagination';

export function useReceiptVouchersLogic() {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    // 🎯 دالة سحرية لتحديث الكاش لحظياً (Optimistic UI)
    const updateRowsInCache = (targetIds: any[], updatedFields: any) => {
        queryClient.setQueryData(['receipt_vouchers'], (oldData: any[]) => {
            if (!oldData) return [];
            const stringIds = targetIds.map(String);
            return oldData.map(row => stringIds.includes(String(row.id)) ? { ...row, ...updatedFields } : row);
        });
    };

    const [globalSearch, setGlobalSearch] = useState('');
    const deferredSearch = useDeferredValue(globalSearch); // 🚀 تأخير ذكي لمنع التقطيع
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentRecord, setCurrentRecord] = useState<any>({});
    const [focusedIndex, setFocusedIndex] = useState(-1);

    // 🚀 State الخاصة بالتصحيح المجمع لحسابات السندات
    const [isBulkFixModalOpen, setIsBulkFixModalOpen] = useState(false);
    const [bulkFixAccounts, setBulkFixAccounts] = useState({ safe_bank_acc_name: '', safe_bank_acc_id: null, partner_acc_name: '', partner_acc_id: null });

    const [permissions] = useState({ canAdd: true, canEdit: true, canDelete: true, canPost: true, canUnpost: true });

    const canUserEdit = (record: any) => {
        if (!record || record.status === 'معتمد') return false; 
        return permissions.canEdit;
    };

    // =========================================================================
    // 📥 جلب البيانات (Data Fetching)
    // =========================================================================
    const { data: allData = [], isLoading } = useQuery({
        queryKey: ['receipt_vouchers'],
        queryFn: async () => {
            const buildQuery = () => supabase
                .from('receipt_vouchers')
                .select(`*, partners:partners!receipt_vouchers_partner_id_company_fkey(name), invoices:invoices!receipt_vouchers_invoice_id_company_fkey(invoice_number)`)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            const rec = await fetchPaginatedData(buildQuery, 'id');
            const { data: allProjects } = await supabase.from('projects').select('id, "Property"');

            return rec?.map(voucher => ({
                ...voucher,
                project_names: voucher.project_ids && allProjects
                    ? allProjects.filter(p => voucher.project_ids.includes(p.id)).map(p => p.Property).join(' ، ')
                    : '---'
            })) || [];
        }
    });

    // =========================================================================
    // ⚙️ المعالجة والفلاتر (Filtering)
    // =========================================================================
    const allFiltered = useMemo(() => {
        return allData.filter(rec => {
            const searchStr = (deferredSearch || '').toLowerCase();
            return (
                rec.receipt_number?.toLowerCase().includes(searchStr) || 
                rec.partners?.name?.toLowerCase().includes(searchStr) ||
                rec.project_names?.toLowerCase().includes(searchStr) ||
                rec.notes?.toLowerCase().includes(searchStr) ||
                rec.reference_number?.toLowerCase().includes(searchStr)
            );
        });
    }, [allData, deferredSearch]);

    useEffect(() => { setCurrentPage(1); }, [deferredSearch, rowsPerPage]);

    const receipts = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return allFiltered.slice(start, start + rowsPerPage);
    }, [allFiltered, currentPage, rowsPerPage]);

    const kpis = useMemo(() => {
        return {
            total: allFiltered.length,
            posted: allFiltered.filter(i => i.status === 'معتمد').length,
            pending: allFiltered.filter(i => i.status !== 'معتمد').length,
            totalAmount: allFiltered.reduce((sum, r) => sum + Number(r.amount || 0), 0)
        };
    }, [allFiltered]);

    // =========================================================================
    // 🚀 طابور العمليات (RPC Operations & Mutations)
    // =========================================================================

    const saveMutation = useMutation({
        mutationFn: async (record: any) => {
            const cleanId = (id: any) => (id && typeof id === 'string' && id.trim() !== '') ? id : null;
            const amount = Number(record.amount || 0);
            
            if (amount <= 0) throw new Error("يجب أن يكون المبلغ أكبر من صفر");
            if ((record.project_ids || []).length > 0 && !cleanId(record.job_order_id)) {
                throw new Error("يرجى اختيار أمر الشغل عشان التحصيل يتسجل عليه");
            }

            const voucherData = {
                receipt_number: record.receipt_number || `RV-${Date.now()}`, 
                date: record.date || new Date().toISOString().split('T')[0],
                payment_method: record.payment_method || 'نقدي (كاش)',
                amount: amount, 
                invoice_id: cleanId(record.invoice_id),
                partner_id: cleanId(record.partner_id),
                project_ids: record.project_ids || null,
                job_order_id: cleanId(record.job_order_id),
                safe_bank_acc_id: cleanId(record.safe_bank_acc_id),
                partner_acc_id: cleanId(record.partner_acc_id),
                reference_number: record.reference_number || null,
                attachment_url: record.attachment_url || null,
                notes: record.notes || null,
                status: record.status || 'مسودة'
            };

            if (record.id) {
                const { error } = await supabase.from('receipt_vouchers').update(voucherData).eq('id', record.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('receipt_vouchers').insert([voucherData]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            setIsEditModalOpen(false);
            showToast("تم حفظ السند بنجاح", "success");
            queryClient.invalidateQueries({ queryKey: ['receipt_vouchers'] });
        },
        onError: (err: any) => showToast(`خطأ أثناء الحفظ: ${err.message}`, "error")
    });

    const postMutation = useMutation({
        mutationFn: async () => {
            if (!selectedIds.length) return;
            const previousData = queryClient.getQueryData(['receipt_vouchers']);
            updateRowsInCache(selectedIds, { status: 'معتمد' });

            const { error } = await supabase.rpc('post_receipts_bulk', { p_ids: selectedIds });
            if (error) {
                queryClient.setQueryData(['receipt_vouchers'], previousData);
                throw error;
            }
        },
        onSuccess: () => {
            setSelectedIds([]);
            showToast("تم الاعتماد والترحيل بنجاح", "success");
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
        onError: (err: any) => showToast(`خطأ أثناء الترحيل: ${err.message}`, "error")
    });

    const unpostMutation = useMutation({
        mutationFn: async () => {
            if (!selectedIds.length) return;
            const previousData = queryClient.getQueryData(['receipt_vouchers']);
            updateRowsInCache(selectedIds, { status: 'مسودة' });

            const { error } = await supabase.rpc('unpost_receipts_bulk', { p_ids: selectedIds });
            if (error) {
                queryClient.setQueryData(['receipt_vouchers'], previousData);
                throw error;
            }
        },
        onSuccess: () => {
            setSelectedIds([]);
            showToast("تم فك الترحيل بنجاح", "warning");
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
        onError: (err: any) => showToast(`خطأ أثناء الإلغاء: ${err.message}`, "error")
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!selectedIds.length) return;
            const previousData = queryClient.getQueryData(['receipt_vouchers']);
            queryClient.setQueryData(['receipt_vouchers'], (old: any[]) => old?.filter(v => !selectedIds.includes(String(v.id))));

            const { error } = await supabase.rpc('delete_receipts_bulk', { p_ids: selectedIds });
            if (error) {
                queryClient.setQueryData(['receipt_vouchers'], previousData);
                throw error;
            }
        },
        onSuccess: () => {
            setSelectedIds([]);
            showToast("تم الحذف بنجاح", "success");
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
        onError: (err: any) => showToast(`خطأ في الحذف: ${err.message}`, "error")
    });

    // 💎 ميزة التصحيح المجمع للسندات (Bulk Fix)
    const bulkFixMutation = useMutation({
        mutationFn: async () => {
            if (selectedIds.length === 0 || (!bulkFixAccounts.safe_bank_acc_id && !bulkFixAccounts.partner_acc_id)) {
                throw new Error("يرجى تحديد حساب واحد على الأقل للتحديث");
            }
            
            const updatePayload: any = {};
            if (bulkFixAccounts.safe_bank_acc_id) updatePayload.safe_bank_acc_id = bulkFixAccounts.safe_bank_acc_id;
            if (bulkFixAccounts.partner_acc_id) updatePayload.partner_acc_id = bulkFixAccounts.partner_acc_id;

            const CHUNK_SIZE = 50; 
            for (let i = 0; i < selectedIds.length; i += CHUNK_SIZE) {
                const chunk = selectedIds.slice(i, i + CHUNK_SIZE);
                // التحديث يتم للسندات (المسودة) فقط للحفاظ على نزاهة القيود
                const { error } = await supabase.from('receipt_vouchers').update(updatePayload).in('id', chunk).eq('status', 'مسودة'); 
                if (error) throw new Error(error.message);
            }
        },
        onSuccess: () => {
            setIsBulkFixModalOpen(false); 
            setBulkFixAccounts({ safe_bank_acc_name: '', safe_bank_acc_id: null, partner_acc_name: '', partner_acc_id: null });
            setSelectedIds([]); 
            showToast(`تم تصحيح الحسابات وتوجيه السندات بنجاح!`, 'success');
            queryClient.invalidateQueries({ queryKey: ['receipt_vouchers'] });
        },
        onError: (err: any) => showToast(`خطأ أثناء التصحيح: ${err.message}`, 'error')
    });

    // التنقل الذكي بالكيبورد داخل الجدول
    const handleTableKeyDown = (e: React.KeyboardEvent) => {
        if (isEditModalOpen || isBulkFixModalOpen) return; 
        switch (e.key) {
            case 'ArrowDown': e.preventDefault(); setFocusedIndex(prev => (prev < receipts.length - 1 ? prev + 1 : prev)); break;
            case 'ArrowUp': e.preventDefault(); setFocusedIndex(prev => (prev > 0 ? prev - 1 : prev)); break;
            case ' ': e.preventDefault(); if (focusedIndex !== -1) { const id = receipts[focusedIndex].id; setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); } break;
            case 'Enter': e.preventDefault(); if (focusedIndex !== -1) { const record = receipts[focusedIndex]; if (canUserEdit(record)) { setCurrentRecord(record); setIsEditModalOpen(true); } } break;
        }
    };

    const isTotalSaving = saveMutation.isPending || postMutation.isPending || unpostMutation.isPending || deleteMutation.isPending || bulkFixMutation.isPending;

    return {
        receipts, allFiltered, isLoading, globalSearch, setGlobalSearch,
        selectedIds, setSelectedIds, currentPage, setCurrentPage,
        rowsPerPage, setRowsPerPage, kpis, isEditModalOpen, setIsEditModalOpen,
        currentRecord, setCurrentRecord, 
        
        // 🚀 أدوات ميزة التصحيح المجمع
        isBulkFixModalOpen, setIsBulkFixModalOpen,
        bulkFixAccounts, setBulkFixAccounts,
        handleBulkFixSave: () => bulkFixMutation.mutate(),
        
        handleAddNew: () => { 
            if (!permissions.canAdd) return showToast("ليست لديك صلاحية الإضافة", "error");
            setCurrentRecord({ date: new Date().toISOString().split('T')[0], payment_method: 'نقدي (كاش)', status: 'مسودة', amount: 0 }); 
            setIsEditModalOpen(true); 
        }, 
        handleEdit: (rec: any) => { 
            if (canUserEdit(rec)) { setCurrentRecord(rec); setIsEditModalOpen(true); }
            else showToast("لا يمكن تعديل سند معتمد", "warning");
        }, 
        
        handleSave: (record: any) => {
            if (record && (record.status === 'مرحل' || record.status === 'معتمد' || record.is_posted)) {
                return showToast("لا يمكن تعديل سجل مرحل. يرجى فك الترحيل أولاً.", "error");
            }
            saveMutation.mutate(record);
        }, 
        handlePostSelected: () => { 
            if(permissions.canPost) {
                postMutation.mutate(); 
            } else {
                import('@/lib/audit').then(({ logCustomAuditEvent }) => logCustomAuditEvent('receipt_vouchers', 'FAILED_POST', null, null, { error: "ليس لديك صلاحية الترحيل" }));
                showToast("ليس لديك صلاحية الترحيل", "error");
            }
        }, 
        handleUnpostSelected: () => { 
            if(permissions.canUnpost) {
                unpostMutation.mutate(); 
            } else {
                import('@/lib/audit').then(({ logCustomAuditEvent }) => logCustomAuditEvent('receipt_vouchers', 'FAILED_UNPOST', null, null, { error: "ليس لديك صلاحية فك الترحيل" }));
                showToast("ليس لديك صلاحية فك الترحيل", "error");
            }
        },
        handleDeleteSelected: () => { 
            const posted = receipts.filter((r:any) => selectedIds.includes(String(r.id)) && (r.status === 'مرحل' || r.status === 'معتمد' || r.is_posted));
            if (posted.length > 0) {
                return showToast("لا يمكن حذف سجلات مرحلة. يرجى فك الترحيل أولاً.", "error");
            }
            if(confirm("تأكيد الحذف النهائي؟")) deleteMutation.mutate(); 
        }, 
        
        focusedIndex, setFocusedIndex, handleTableKeyDown,
        permissions, canUserEdit, isSaving: isTotalSaving
    };
}
