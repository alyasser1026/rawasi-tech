"use client";
import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase'; 
import { useRouter } from 'next/navigation';
import { useToast } from '@/lib/toast-context'; 
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; 
import { fetchPaginatedData } from '@/lib/supabase-pagination';

export function useInvoicesLogic() {
    const router = useRouter();
    const { showToast } = useToast(); 
    const queryClient = useQueryClient();
    
    const updateRowsInCache = (targetIds: any[], updatedFields: any) => {
        queryClient.setQueryData(['invoices'], (oldData: any[]) => {
            if (!oldData) return [];
            const stringIds = targetIds.map(String);
            return oldData.map(row => 
                stringIds.includes(String(row.id)) ? { ...row, ...updatedFields } : row 
            );
        });
    };

    const [permissions, setPermissions] = useState<any>({ isAdmin: false });
    
    const [globalSearch, setGlobalSearch] = useState('');
    const deferredSearch = useDeferredValue(globalSearch); 
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentRecord, setCurrentRecord] = useState<any>({ lines: [] });

    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [selectedInvoiceForPay, setSelectedInvoiceForPay] = useState<any>(null);

    useEffect(() => {
        const fetchAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role, permissions, is_admin')
                    .eq('id', session.user.id)
                    .single();
                
                const userRole = String(profile?.role || '').toLowerCase();
                setPermissions({ 
                    isAdmin: (userRole === 'admin' || userRole === 'super_admin') || profile?.is_admin === true, 
                    ...profile?.permissions 
                });
            }
        };
        fetchAuth();
    }, []);

    const { data: invoices = [], isLoading: isInvLoading } = useQuery({
        queryKey: ['invoices'],
        queryFn: async () => {
            const buildQuery = () => supabase
                .from('invoices')
                .select('*, partners(*), debit_acc:accounts!invoices_debit_acc_fkey(name)')
                .order('date', { ascending: false });
            return await fetchPaginatedData(buildQuery, 'id');
        }
    });

    const { data: projects = [], isLoading: isProjLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => {
            const { data, error } = await supabase.from('projects').select('*');
            if (error) throw error;
            return data || [];
        }
    });

    const allFiltered = useMemo(() => {
        if (!invoices) return [];
        return invoices.filter((inv: any) => {
            const searchLower = (deferredSearch || '').toLowerCase();
            const matchesSearch = 
                inv.invoice_number?.toLowerCase().includes(searchLower) || 
                inv.client_name?.toLowerCase().includes(searchLower);
            
            let matchesDate = true;
            const invDate = inv.date ? new Date(inv.date) : null;
            if (invDate) {
                if (dateFrom) matchesDate = matchesDate && invDate >= new Date(dateFrom);
                if (dateTo) matchesDate = matchesDate && invDate <= new Date(dateTo);
            }
            return matchesSearch && matchesDate;
        }).map((inv: any) => {
            const total = Number(inv.total_amount || 0);
            const paid = Number(inv.paid_amount || 0);
            const balance = total - paid;
            
            let paymentStatus = 'unpaid'; 
            if (paid > total && total > 0) paymentStatus = 'overpaid'; 
            else if (paid === total && total > 0) paymentStatus = 'paid'; 
            else if (paid > 0) paymentStatus = 'partial'; 

            return {
                ...inv,
                remaining_amount: balance,
                payment_display_status: paymentStatus
            };
        });
    }, [invoices, deferredSearch, dateFrom, dateTo]);

    const paginatedInvoices = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return allFiltered.slice(start, start + rowsPerPage);
    }, [allFiltered, currentPage, rowsPerPage]);

    const kpis = useMemo(() => ({
        total: allFiltered.length,
        posted: allFiltered.filter((i: any) => i.status === 'معتمد').length,
        pending: allFiltered.filter((i: any) => i.status !== 'معتمد').length
    }), [allFiltered]);

    const handleOpenPaymentModal = async (inv: any) => {
        const balance = Number(inv.total_amount || 0) - Number(inv.paid_amount || 0);
        
        let pIds: string[] = [];
        if (Array.isArray(inv.project_ids)) {
            pIds = inv.project_ids.map((id: any) => String(id));
        } else if (typeof inv.project_ids === 'string') {
            pIds = inv.project_ids.replace(/[{}[\]"']/g, '').split(',').map((id: string) => id.trim());
        }
        
        const selectedProjects = projects.filter((p: any) => pIds.includes(String(p.id)));
        const pName = inv.client_name || inv.partners?.name || '';

        setSelectedInvoiceForPay({
            id: undefined, 
            invoice_id: inv.id, 
            invoice_number: inv.invoice_number,
            date: new Date().toISOString().split('T')[0], 
            partner_id: inv.partner_id, 
            partner_name: pName,
            selected_projects: selectedProjects, 
            project_ids: pIds, 
            amount: balance > 0 ? balance : 0, 
            payment_method: 'نقدي (كاش)',
            partner_acc_id: inv.debit_account_id || '4f828d0d-a1f4-4762-83e3-c17dafae802d',
            partner_acc_name: inv.debit_acc?.name || 'العملاء (أصحاب المشاريع)', 
            safe_bank_acc_id: '21b8a1db-bc9f-4cf8-b741-1efeded0963c',
            safe_bank_acc_name: 'الخزينة الرئيسية',
        });
        setIsReceiptModalOpen(true);
    };

    const handlePayInvoice = (inv: any) => {
        const balance = Number(inv.total_amount || 0) - Number(inv.paid_amount || 0);
        const defaultAmount = balance > 0 ? balance : 0;
        
        const params = new URLSearchParams({
            invoice_id: inv.id, 
            amount: defaultAmount.toString(), 
            client_name: inv.client_name || '', 
            ref: inv.invoice_number || ''
        });
        router.push(`/ReceiptVouchers?${params.toString()}`);
    };

    const handleAddNew = () => { 
        setCurrentRecord({ lines: [], date: new Date().toISOString().split('T')[0], project_ids: [], selected_projects: [] }); 
        setIsEditModalOpen(true); 
    };

    const handleEdit = (inv: any) => {
        if (inv.is_posted || inv.status === 'معتمد' || inv.status === 'معتمد') {
            showToast("لا يمكن تعديل فاتورة معتمدة! لتسجيل الدفعات استخدم زر () الموجود بالجدول. ولتعديل بيانات الأصناف يجب فك الترحيل أولاً.", "error");
            return;
        }

        let pIds: string[] = [];
        if (Array.isArray(inv.project_ids)) {
            pIds = inv.project_ids.map((id: any) => String(id));
        } else if (typeof inv.project_ids === 'string') {
            pIds = inv.project_ids.replace(/[{}[\]"']/g, '').split(',').map((id: string) => id.trim());
        }

        const mappedProjects = projects.filter((p: any) => pIds.includes(String(p.id)));
        
        setCurrentRecord({ ...inv, client_name: inv.client_name || inv.partners?.name || '', selected_projects: mappedProjects, project_ids: pIds });
        setIsEditModalOpen(true);
    };

    const saveMutation = useMutation({
        mutationFn: async (record: any) => {
            const cleanId = (id: any) => (id && typeof id === 'string' && id.trim() !== '') ? id : null;
            
            if (record.id) {
                const { data: currentInv } = await supabase.from('invoices').select('status').eq('id', record.id).single();
                if (currentInv && (currentInv.status === 'معتمد' || currentInv.status === 'معتمد')) {
                    throw new Error("لا يمكن حفظ التعديلات! الفاتورة معتمدة بالفعل في النظام. يرجى فك الترحيل أولاً.");
                }
            }

            const invoiceHeader = {
                invoice_number: record.invoice_number, 
                date: record.date, 
                partner_id: cleanId(record.partner_id),
                client_name: record.client_name, 
                project_ids: record.project_ids || null, 
                description: record.description, 
                materials_discount: Number(record.materials_discount) || 0, 
                taxable_amount: Number(record.taxable_amount) || 0,
                tax_amount: Number(record.tax_amount) || 0, 
                guarantee_percent: Number(record.guarantee_percent) || 0,
                guarantee_amount: Number(record.guarantee_amount) || 0, 
                total_amount: Number(record.total_amount) || 0,
                debit_account_id: cleanId(record.debit_account_id), 
                credit_account_id: cleanId(record.credit_account_id),
                materials_acc_id: cleanId(record.materials_acc_id), 
                guarantee_acc_id: cleanId(record.guarantee_acc_id),
                tax_acc_id: cleanId(record.tax_acc_id), 
                status: record.status || 'معلق', 
                due_in_days: Number(record.due_in_days) || 0,
                due_date: record.due_date, 
                paid_amount: Number(record.paid_amount) || 0, 
                skip_zatca: record.skip_zatca || false,
                lines_data: record.lines || record.items || [] 
            };

            if (record.id) {
                const { error: headErr } = await supabase.from('invoices').update(invoiceHeader).eq('id', record.id);
                if (headErr) throw headErr;
            } else {
                const { error: headErr } = await supabase.from('invoices').insert([invoiceHeader]);
                if (headErr) throw headErr;
            }
        },
        onSuccess: () => {
            setIsEditModalOpen(false);
            showToast("تم حفظ الفاتورة بنجاح", "success");
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
        onError: (err: any) => {
            showToast(`حدث خطأ أثناء الحفظ!${err.message}`, "error");
        }
    });

    const postMutation = useMutation({
        mutationFn: async () => {
            if (!selectedIds.length) return;
            const { error } = await supabase.rpc('post_invoices_bulk', { p_ids: selectedIds });
            if (error) throw error;
        },
        onSuccess: () => {
            showToast("تم الاعتماد والترحيل بنجاح", "success");
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
        onError: (err: any) => showToast(`خطأ في الترحيل: ${err.message}`, "error")
    });

    const unpostMutation = useMutation({
        mutationFn: async () => {
            if (!selectedIds.length) return;
            const { error } = await supabase.rpc('unpost_invoices_bulk', { p_ids: selectedIds });
            if (error) throw error;
        },
        onSuccess: () => {
            showToast("تم إلغاء الترحيل وتطهير القيود", "warning");
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
        onError: (err: any) => showToast(`${err.message}`, "error") 
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!selectedIds.length) return;
            const { error } = await supabase.rpc('delete_invoices_bulk', { p_ids: selectedIds });
            if (error) throw error;
        },
        onSuccess: () => {
            showToast("تم الحذف النهائي للفواتير المحددة", "success");
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
        onError: (err: any) => showToast(`خطأ في الحذف: ${err.message}`, "error")
    });

    const payMutation = useMutation({
        mutationFn: async (receiptData: any) => {
            const autoNumber = `RV-${Date.now()}`;
            const cleanId = (id: any) => (id && typeof id === 'string' && id.trim() !== '') ? id : null;
            const finalAmount = Number(receiptData.amount || 0);
            if (finalAmount <= 0) throw new Error("AMOUNT_ZERO");

            const dataToSave = {
                receipt_number: receiptData.receipt_number || autoNumber,
                date: receiptData.date || new Date().toISOString().split('T')[0],
                amount: finalAmount,
                payment_method: receiptData.payment_method || 'نقدي (كاش)',
                notes: receiptData.notes || `سداد دفعة من فاتورة #${receiptData.invoice_number}`,
                partner_id: cleanId(receiptData.partner_id),
                invoice_id: cleanId(receiptData.invoice_id),
                safe_bank_acc_id: cleanId(receiptData.safe_bank_acc_id),
                partner_acc_id: cleanId(receiptData.partner_acc_id),
                project_ids: receiptData.project_ids && receiptData.project_ids.length > 0 ? receiptData.project_ids : null,
                status: 'مسودة' // 🚀 تم التعديل: السند سينشأ كمسودة لترحيله يدوياً لاحقاً
            };

            const { error: receiptErr } = await supabase.from('receipt_vouchers').insert([dataToSave]);
            if (receiptErr) throw receiptErr;

        },
        onError: (err: any) => {
            if (err.message === "AMOUNT_ZERO") showToast("المبلغ المُسدد يجب أن يكون أكبر من صفر", "warning");
            else showToast(`حدث خطأ أثناء إصدار سند السداد: ${err.message}`, "error");
        },
        onSuccess: () => {
            setIsReceiptModalOpen(false);
            setSelectedInvoiceForPay(null);
            showToast("تم إنشاء سند القبض كمسودة بنجاح", "success");
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['receipt_vouchers'] });
        }
    });

    const isSaving = saveMutation.isPending || postMutation.isPending || unpostMutation.isPending || deleteMutation.isPending || payMutation.isPending;
    const isLoading = isInvLoading || isProjLoading || isSaving;

    return {
        invoices: paginatedInvoices,
        allFiltered,
        projects,
        isLoading,
        isSaving,
        permissions,
        handlePayInvoice,
        isReceiptModalOpen, setIsReceiptModalOpen,
        selectedInvoiceForPay, setSelectedInvoiceForPay, 
        handleOpenPaymentModal,
        globalSearch, setGlobalSearch: (v: string) => { setGlobalSearch(v); setCurrentPage(1); },
        dateFrom, setDateFrom: (v: string) => { setDateFrom(v); setCurrentPage(1); },
        dateTo, setDateTo: (v: string) => { setDateTo(v); setCurrentPage(1); },
        selectedIds, setSelectedIds,
        currentPage, setCurrentPage,
        rowsPerPage, setRowsPerPage: (v: number) => { setRowsPerPage(v); setCurrentPage(1); },
        kpis,
        isEditModalOpen, setIsEditModalOpen,
        currentRecord, setCurrentRecord,
        handleAddNew, handleEdit, 
        handleSave: (record: any) => saveMutation.mutate(record),
        handlePostSelected: () => postMutation.mutate(), 
        handleUnpostSelected: () => unpostMutation.mutate(), 
        handleDeleteSelected: () => {
            const posted = invoices.filter((inv:any) => selectedIds.includes(String(inv.id)) && inv.status === 'معتمدة');
            if (posted.length > 0) {
                return showToast("لا يمكن حذف فواتير معتمدة. يرجى فك الترحيل أولاً.", "error");
            }
            if (!selectedIds.length || !confirm("هل أنت متأكد من الحذف النهائي للفواتير والقيود التابعة لها؟")) return;
            deleteMutation.mutate();
        },
        handleSavePayment: (record: any) => payMutation.mutate(record), 
    };
}