"use client";
import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/lib/toast-context';
import { useCompany } from '@/lib/CompanyContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPaginatedData } from '@/lib/supabase-pagination';

type CompanyAccountRow = { id: string; code: string; name: string };
type AdjustmentBalanceRow = { invoice_id: string; paid_amount: number | string; net_adjustment: number | string; balance: number | string };

export function useInvoicesLogic() {
    const router = useRouter();
    const { showToast } = useToast();
    const { activeCompanyId } = useCompany();
    const queryClient = useQueryClient();

    const invoicesQueryKey = useMemo(() => ['invoices', activeCompanyId], [activeCompanyId]);

    const updateRowsInCache = (targetIds: any[], updatedFields: any) => {
        queryClient.setQueryData(invoicesQueryKey, (oldData: any[]) => {
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

    const { data: defaultAccounts = {} } = useQuery({
        queryKey: ['invoice-default-accounts', activeCompanyId],
        enabled: Boolean(activeCompanyId),
        queryFn: async () => {
            const { data, error } = await supabase
                .from('accounts')
                .select('id, code, name')
                .in('code', ['121', '122', '123', '124', '215', '217', '41', '411'])
                .eq('is_transactional', true);
            if (error) throw error;
            const byCode: Record<string, CompanyAccountRow> = {};
            for (const row of (data || []) as CompanyAccountRow[]) {
                byCode[row.code] = row;
            }
            return byCode;
        }
    });

    const { data: invoices = [], isLoading: isInvLoading } = useQuery({
        queryKey: invoicesQueryKey,
        enabled: Boolean(activeCompanyId),
        queryFn: async () => {
            const buildQuery = () => supabase
                .from('invoices')
                .select('*, partners:partners!invoices_partner_id_company_fkey(*), debit_acc:accounts!invoices_debit_acc_fkey(name), credit_acc:accounts!invoices_credit_acc_fkey(name)')
                .order('date', { ascending: false });
            const rows = await fetchPaginatedData(buildQuery, 'id');
            if (!rows || rows.length === 0) return [];

            const balanceMap = new Map<string, AdjustmentBalanceRow>();
            const allIds = rows.map((r: any) => r.id).filter(Boolean);
            const CHUNK = 500;
            for (let i = 0; i < allIds.length; i += CHUNK) {
                const slice = allIds.slice(i, i + CHUNK);
                const { data: adjRows, error: adjErr } = await supabase.rpc('get_invoice_adjustment_balances', { p_invoice_ids: slice });
                if (!adjErr && Array.isArray(adjRows)) {
                    for (const b of adjRows as AdjustmentBalanceRow[]) {
                        balanceMap.set(String(b.invoice_id), b);
                    }
                }
            }

            return rows.map((inv: any) => {
                const adj = balanceMap.get(String(inv.id));
                const rawTotal = Number(inv.total_amount || 0);
                const netAdjustment = adj ? Number(adj.net_adjustment || 0) : 0;
                const effectiveTotal = Number((rawTotal + netAdjustment).toFixed(2));
                const adjustedPaid = adj ? Number(adj.paid_amount || 0) : Number(inv.paid_amount || 0);
                const balance = adj ? Number(adj.balance || 0) : Number((effectiveTotal - adjustedPaid).toFixed(2));
                return {
                    ...inv,
                    net_adjustment: netAdjustment,
                    effective_total: effectiveTotal,
                    adjusted_paid_amount: adjustedPaid,
                    computed_balance: balance
                };
            });
        }
    });

    const { data: projects = [], isLoading: isProjLoading } = useQuery({
        queryKey: ['projects', activeCompanyId],
        enabled: Boolean(activeCompanyId),
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
                inv.client_name?.toLowerCase().includes(searchLower) ||
                inv.partners?.name?.toLowerCase().includes(searchLower);

            let matchesDate = true;
            const invDate = inv.date ? new Date(inv.date) : null;
            if (invDate) {
                if (dateFrom) matchesDate = matchesDate && invDate >= new Date(dateFrom);
                if (dateTo) matchesDate = matchesDate && invDate <= new Date(dateTo);
            }
            return matchesSearch && matchesDate;
        }).map((inv: any) => {
            const total = inv.effective_total != null ? Number(inv.effective_total) : Number(inv.total_amount || 0);
            const paid = inv.adjusted_paid_amount != null ? Number(inv.adjusted_paid_amount) : Number(inv.paid_amount || 0);
            const balance = inv.computed_balance != null ? Number(inv.computed_balance) : Number((total - paid).toFixed(2));

            let paymentStatus = 'unpaid';
            if (balance < 0) paymentStatus = 'overpaid';
            else if (balance === 0 && total > 0) paymentStatus = 'paid';
            else if (balance === 0 && Number(inv.net_adjustment || 0) < 0) paymentStatus = 'credited';
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
        const balance = inv.remaining_amount != null
            ? Number(inv.remaining_amount)
            : (Number(inv.total_amount || 0) - Number(inv.paid_amount || 0));

        let pIds: string[] = [];
        if (Array.isArray(inv.project_ids)) {
            pIds = inv.project_ids.map((id: any) => String(id));
        } else if (typeof inv.project_ids === 'string') {
            pIds = inv.project_ids.replace(/[{}[\]"']/g, '').split(',').map((id: string) => id.trim()).filter(Boolean);
        }

        const selectedProjects = projects.filter((p: any) => pIds.includes(String(p.id)));
        const pName = inv.client_name || inv.partners?.name || '';

        const invLines = Array.isArray(inv.lines_data) ? inv.lines_data : [];
        const invJobOrders = Array.from(new Set(invLines.map((l: any) => l?.job_order_id).filter(Boolean)));
        const singleLine = invJobOrders.length === 1 ? invLines.find((l: any) => l?.job_order_id === invJobOrders[0]) : null;

        const defaultCustomerAcc = defaultAccounts['123'];
        const defaultSafeAcc = defaultAccounts['122'] || defaultAccounts['121'];

        setSelectedInvoiceForPay({
            id: undefined,
            invoice_id: inv.id,
            invoice_number: inv.invoice_number,
            date: new Date().toISOString().split('T')[0],
            partner_id: inv.partner_id,
            partner_name: pName,
            selected_projects: selectedProjects,
            project_ids: pIds,
            jo_project_id: singleLine?.project_id || (selectedProjects.length === 1 ? selectedProjects[0].id : null),
            job_order_id: singleLine ? singleLine.job_order_id : null,
            amount: balance > 0 ? Number(balance.toFixed(2)) : 0,
            payment_method: 'نقدي (كاش)',
            partner_acc_id: inv.debit_account_id || defaultCustomerAcc?.id || null,
            partner_acc_name: inv.debit_acc?.name || defaultCustomerAcc?.name || 'العملاء (أصحاب المشاريع)',
            safe_bank_acc_id: defaultSafeAcc?.id || null,
            safe_bank_acc_name: defaultSafeAcc?.name || 'الخزينة الرئيسية',
        });
        setIsReceiptModalOpen(true);
    };

    const handlePayInvoice = (inv: any) => {
        const balance = inv.remaining_amount != null
            ? Number(inv.remaining_amount)
            : (Number(inv.total_amount || 0) - Number(inv.paid_amount || 0));
        const defaultAmount = balance > 0 ? Number(balance.toFixed(2)) : 0;

        const params = new URLSearchParams({
            invoice_id: inv.id,
            amount: defaultAmount.toString(),
            client_name: inv.client_name || '',
            ref: inv.invoice_number || ''
        });
        router.push(`/ReceiptVouchers?${params.toString()}`);
    };

    const handleAddNew = () => {
        const debitAcc = defaultAccounts['123'];
        const creditAcc = defaultAccounts['41'] || defaultAccounts['411'];
        const taxAcc = defaultAccounts['215'];
        const matAcc = defaultAccounts['217'];
        const guarAcc = defaultAccounts['124'];

        setCurrentRecord({
            lines: [],
            line_accounting: true,
            customer_materials: [],
            date: new Date().toISOString().split('T')[0],
            project_ids: [],
            selected_projects: [],
            debit_account_id: debitAcc?.id || null,
            debit_account_name: debitAcc?.name || '',
            credit_account_id: creditAcc?.id || null,
            credit_account_name: creditAcc?.name || '',
            tax_acc_id: taxAcc?.id || null,
            materials_acc_id: matAcc?.id || null,
            guarantee_acc_id: guarAcc?.id || null,
            defaults_applied: Boolean(debitAcc || creditAcc || taxAcc)
        });
        setIsEditModalOpen(true);
    };

    const handleEdit = (inv: any) => {
        if (inv.is_posted || ['posted', 'مرحل', 'معتمد', 'معتمدة'].includes(inv.status)) {
            showToast("لا يمكن تعديل فاتورة معتمدة! لتسجيل الدفعات استخدم زر السداد بالجدول، ولتعديل البنود يجب فك الترحيل أولاً.", "error");
            return;
        }

        let pIds: string[] = [];
        if (Array.isArray(inv.project_ids)) {
            pIds = inv.project_ids.map((id: any) => String(id));
        } else if (typeof inv.project_ids === 'string') {
            pIds = inv.project_ids.replace(/[{}[\]"']/g, '').split(',').map((id: string) => id.trim()).filter(Boolean);
        }

        const mappedProjects = projects.filter((p: any) => pIds.includes(String(p.id)));

        setCurrentRecord({
            ...inv,
            lines: Array.isArray(inv.lines_data) ? inv.lines_data : (inv.lines || []),
            debit_account_name: inv.debit_acc?.name || inv.debit_account_name || '',
            credit_account_name: inv.credit_acc?.name || inv.credit_account_name || '',
            client_name: inv.client_name || inv.partners?.name || '',
            selected_projects: mappedProjects,
            project_ids: pIds
        });
        setIsEditModalOpen(true);
    };

    const saveMutation = useMutation({
        mutationFn: async (record: any) => {
            const cleanId = (id: any) => (id && typeof id === 'string' && id.trim() !== '') ? id : null;

            if (record.id) {
                const { data: currentInv } = await supabase.from('invoices').select('status').eq('id', record.id).single();
                if (currentInv && ['posted', 'مرحل', 'معتمد', 'معتمدة'].includes(currentInv.status)) {
                    throw new Error("لا يمكن حفظ التعديلات! الفاتورة معتمدة بالفعل في النظام. يرجى فك الترحيل أولاً.");
                }
            }

            const isLineAccounting = record.line_accounting === true;
            const rawLines = record.lines || record.items || [];
            const skipZatca = Boolean(record.skip_zatca);

            let invoiceHeader: Record<string, any>;

            if (isLineAccounting) {
                const { data: calc, error: calcErr } = await supabase.rpc('preview_invoice_work_order_lines', {
                    p_lines: rawLines,
                    p_skip_tax: skipZatca
                });
                if (calcErr) throw calcErr;

                const customerMaterials = Array.isArray(record.customer_materials)
                    ? record.customer_materials
                        .filter((m: any) => Number(m?.amount) > 0 && m?.receipt_id)
                        .map((m: any) => ({ receipt_id: m.receipt_id, amount: Number(Number(m.amount).toFixed(2)) }))
                    : [];
                const materialsDiscount = Number(
                    customerMaterials.reduce((sum: number, m: any) => sum + Number(m.amount), 0).toFixed(2)
                );
                const receivableBeforeMaterials = Number(calc?.receivable_before_materials || 0);
                const totalAmount = Number((receivableBeforeMaterials - materialsDiscount).toFixed(2));
                if (totalAmount < 0) {
                    throw new Error("تسوية خامات العميل تتجاوز صافي الفاتورة المطلوب.");
                }

                invoiceHeader = {
                    invoice_number: record.invoice_number || null,
                    date: record.date ? String(record.date).split('T')[0] : new Date().toISOString().split('T')[0],
                    partner_id: cleanId(record.partner_id),
                    client_name: record.client_name,
                    project_ids: record.project_ids || null,
                    description: record.description || null,
                    line_accounting: true,
                    customer_materials: customerMaterials,
                    materials_discount: materialsDiscount,
                    taxable_amount: Number(calc?.taxable_amount || 0),
                    tax_amount: Number(calc?.tax_amount || 0),
                    guarantee_percent: 0,
                    guarantee_amount: Number(calc?.guarantee_amount || 0),
                    total_amount: totalAmount,
                    debit_account_id: cleanId(record.debit_account_id) || defaultAccounts['123']?.id || null,
                    credit_account_id: cleanId(record.credit_account_id) || defaultAccounts['41']?.id || defaultAccounts['411']?.id || null,
                    materials_acc_id: cleanId(record.materials_acc_id) || defaultAccounts['217']?.id || null,
                    guarantee_acc_id: cleanId(record.guarantee_acc_id) || defaultAccounts['124']?.id || null,
                    tax_acc_id: cleanId(record.tax_acc_id) || defaultAccounts['215']?.id || null,
                    status: record.status || 'معلق',
                    due_in_days: Number(record.due_in_days) || 0,
                    due_date: record.due_date,
                    paid_amount: Number(record.paid_amount) || 0,
                    skip_zatca: skipZatca,
                    lines_data: calc?.lines || []
                };
            } else {
                invoiceHeader = {
                    invoice_number: record.invoice_number,
                    date: record.date,
                    partner_id: cleanId(record.partner_id),
                    client_name: record.client_name,
                    project_ids: record.project_ids || null,
                    description: record.description,
                    line_accounting: false,
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
                    skip_zatca: skipZatca,
                    lines_data: rawLines
                };
            }

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
            showToast(`حدث خطأ أثناء الحفظ! ${err.message}`, "error");
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
            if ((receiptData.project_ids || []).length > 0 && !cleanId(receiptData.job_order_id)) {
                throw new Error("يرجى اختيار أمر الشغل عشان التحصيل يتسجل عليه");
            }

            const dataToSave = {
                receipt_number: receiptData.receipt_number || autoNumber,
                date: receiptData.date || new Date().toISOString().split('T')[0],
                amount: finalAmount,
                payment_method: receiptData.payment_method || 'نقدي (كاش)',
                notes: receiptData.notes || `سداد دفعة من فاتورة #${receiptData.invoice_number}`,
                partner_id: cleanId(receiptData.partner_id),
                invoice_id: cleanId(receiptData.invoice_id),
                job_order_id: cleanId(receiptData.job_order_id),
                safe_bank_acc_id: cleanId(receiptData.safe_bank_acc_id),
                partner_acc_id: cleanId(receiptData.partner_acc_id),
                project_ids: receiptData.project_ids && receiptData.project_ids.length > 0 ? receiptData.project_ids : null,
                status: 'مسودة' // 🚀 السند ينشأ كمسودة لترحيله يدوياً لاحقاً
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
        defaultAccounts,
        updateRowsInCache,
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
            const posted = invoices.filter((inv: any) =>
                selectedIds.includes(String(inv.id)) && ['posted', 'مرحل', 'معتمد', 'معتمدة'].includes(inv.status)
            );
            if (posted.length > 0) {
                return showToast("لا يمكن حذف فواتير معتمدة. يرجى فك الترحيل أولاً.", "error");
            }
            if (!selectedIds.length || !confirm("هل أنت متأكد من الحذف النهائي للفواتير والقيود التابعة لها؟")) return;
            deleteMutation.mutate();
        },
        handleSavePayment: (record: any) => payMutation.mutate(record),
    };
}
