"use client";
import { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/lib/toast-context';
import { fetchPaginatedData } from '@/lib/supabase-pagination';
import { useUniversalPosting } from '@/lib/accounting_engine';
import { validateCustodyPaymentVoucherDraft } from '@/lib/custodyMirror';

export function usePaymentVouchersLogic() {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const updateRowsInCache = (targetIds: any[], updatedFields: any) => {
        queryClient.setQueryData(['payment_vouchers'], (oldData: any[]) => {
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
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentVoucher, setCurrentVoucher] = useState<any>({});

    const [isBulkFixModalOpen, setIsBulkFixModalOpen] = useState(false);
    const [bulkFixAccounts, setBulkFixAccounts] = useState({ credit_account_name: '', credit_account_id: null, debit_account_name: '', debit_account_id: null });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const q = new URLSearchParams(window.location.search).get('q');
            if (q) setGlobalSearch(q);
        }
        const handleDateChange = (e: any) => {
            setDateRange({ start: e.detail.start, end: e.detail.end });
            setCurrentPage(1); 
        };

        const handleSearchChange = (e: any) => {
            setGlobalSearch(e.detail || '');
            setCurrentPage(1);
        };
        
        window.addEventListener('globalDateFilter', handleDateChange as EventListener);
        window.addEventListener('globalSearch', handleSearchChange as EventListener);

        return () => {
            window.removeEventListener('globalDateFilter', handleDateChange as EventListener);
            window.removeEventListener('globalSearch', handleSearchChange as EventListener);
        };
    }, []);

    const { data: vouchers = [], isLoading: isFetching } = useQuery({
        queryKey: ['payment_vouchers'],
        queryFn: async () => {
            const buildQuery = () => supabase
                .from('payment_vouchers')
                .select(`
                    *,
                    payee:partners!partner_id(name),
                    credit_account:accounts!credit_account_id(name),
                    debit_account:accounts!debit_account_id(name, code)
                `)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            const allData = await fetchPaginatedData(buildQuery, 'id');

            // Enrich with linked site_custodies metadata so Payment Vouchers & Custodies mirror each other
            const custodyById = new Map<string, any>();
            const custodyByVoucherId = new Map<string, any>();
            try {
                const { data: custodyRows } = await supabase
                    .from('site_custodies')
                    .select('id, custody_number, status, title, spent_amount, remaining_amount, payment_voucher_id');
                for (const sc of custodyRows || []) {
                    custodyById.set(String(sc.id), sc);
                    if (sc.payment_voucher_id) {
                        custodyByVoucherId.set(String(sc.payment_voucher_id), sc);
                    }
                }
            } catch {
                /* non-blocking enrichment if user lacks custody view permission */
            }

            return allData.map(v => ({
                ...v,
                payee_id: v.partner_id,
                custody: (v.custody_id ? custodyById.get(String(v.custody_id)) : null) || custodyByVoucherId.get(String(v.id)) || null,
            }));
        }
    });

    const { data: partnerBalance = 0, isFetching: isBalanceLoading } = useQuery({
        queryKey: ['partner_balance', currentVoucher.payee_id],
        queryFn: async () => {
            if (!currentVoucher.payee_id) return 0;
            const { data, error } = await supabase.rpc('get_partner_balance', { p_id: currentVoucher.payee_id });
            if (error) return 0;
            return data || 0;
        },
        enabled: isEditModalOpen && !!currentVoucher.payee_id,
        staleTime: 0,
        refetchOnMount: 'always'
    });

    const { data: serverTotals } = useQuery({
        queryKey: ['vouchers_server_totals'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_dashboard_totals');
            if (error) return null;
            return data?.[0] || null;
        }
    });

    const displayedVouchers = useMemo(() => {
        let result = vouchers;

        if (dateRange.start) result = result.filter(v => new Date(v.date) >= new Date(dateRange.start));
        if (dateRange.end) result = result.filter(v => new Date(v.date) <= new Date(dateRange.end));

        if (filterStatus !== 'الكل') {
            const isPostedTarget = filterStatus === 'معتمد';
            result = result.filter(v => v.is_posted === isPostedTarget);
        }

        if (deferredSearch) {
            const lower = deferredSearch.toLowerCase().trim();
            result = result.filter(v => 
                (v.voucher_number?.toString().toLowerCase().includes(lower)) ||
                (v.description?.toString().toLowerCase().includes(lower)) ||
                (v.payee?.name?.toString().toLowerCase().includes(lower)) ||
                (v.credit_account?.name?.toString().toLowerCase().includes(lower)) ||
                (v.debit_account?.name?.toString().toLowerCase().includes(lower)) ||
                (v.custody?.custody_number?.toString().toLowerCase().includes(lower)) ||
                (v.amount?.toString().includes(lower))
            );
        }

        return result;
    }, [vouchers, deferredSearch, filterStatus, dateRange]);

    const totals = useMemo(() => {
        const totalAmount = displayedVouchers.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);
        
        return { 
            totalAmount: parseFloat(totalAmount.toFixed(2)), 
            count: displayedVouchers.length,
            serverTotalPosted: serverTotals?.total_posted_vouchers || 0,
            serverTotalPending: serverTotals?.total_pending_vouchers || 0
        };
    }, [displayedVouchers, serverTotals]);

    const { postRecords, unpostRecords, isProcessing } = useUniversalPosting(
        'payment_vouchers',
        'payment_vouchers',
        'post_payment_vouchers_bulk'
    );

    // 📝 8. عمليات الحفظ 
    const saveMutation = useMutation({
        mutationFn: async (voucherData: any) => {
            if (voucherData.id) {
                const { data: existing } = await supabase.from('payment_vouchers').select('is_posted, status').eq('id', voucherData.id).single();
                if (existing && (existing.is_posted || existing.status === 'مرحل' || existing.status === 'معتمد')) {
                    throw new Error("لا يمكن تعديل سند مرحل. يرجى فك الترحيل أولاً.");
                }
            }
            // 🎯 تم إلغاء شروط التحقق من الحسابات (المدين والدائن) لتكون اختيارية
            if (!voucherData.amount || Number(voucherData.amount) <= 0) {
                throw new Error("تنبيه: يرجى إدخال المبلغ المراد صرفه.");
            }
            if ((voucherData.project_ids || []).length > 0 && !voucherData.job_order_id) {
                throw new Error("يرجى اختيار أمر الشغل عشان الصرف يتحمّل عليه");
            }

            const custodyCheck = validateCustodyPaymentVoucherDraft({
                debitAccount: voucherData.debit_account,
                debitAccountCode: voucherData.debit_account_code,
                debitAccountName: voucherData.debit_account_name,
                partnerId: voucherData.payee_id ?? voucherData.partner_id,
            });
            if (!custodyCheck.valid && custodyCheck.error) {
                throw new Error(custodyCheck.error);
            }

            let payload = { ...voucherData };
            payload.partner_id = payload.payee_id;
            payload.amount = parseFloat(Number(payload.amount).toFixed(2));
            
            // تنظيف الحقول المؤقتة
            delete payload.payee_id; 
            delete payload.payee_name; 
            delete payload.debit_account_name;
            delete payload.credit_account_name; 
            delete payload.payee; 
            delete payload.credit_account; 
            delete payload.debit_account;
            delete payload.manual_debit; 
            delete payload.manual_credit;
            delete payload.job_order_number;
            delete payload.job_order;
            delete payload.project_id;
            delete payload.debit_account_code;
            delete payload.custody;
            delete payload.custody_id;

            // تحويل المعرف الفارغ إلى null لتفادي خطأ الـ UUID في قاعدة البيانات
            if (!payload.job_order_id) payload.job_order_id = null;
            if (!payload.partner_id || typeof payload.partner_id !== 'string' || !payload.partner_id.trim()) payload.partner_id = null;
            if (!payload.debit_account_id || typeof payload.debit_account_id !== 'string' || !payload.debit_account_id.trim()) payload.debit_account_id = null;
            if (!payload.credit_account_id || typeof payload.credit_account_id !== 'string' || !payload.credit_account_id.trim()) payload.credit_account_id = null;
            if (!payload.site_ref || typeof payload.site_ref !== 'string' || !payload.site_ref.trim()) payload.site_ref = null;

            // 🛡️ التحقق من تطابق الحساب الدائن مع الشركة الحالية لتفادي خطأ payment_vouchers_credit_account_id_company_fkey
            if (payload.credit_account_id) {
                const { data: validCredit } = await supabase
                    .from('accounts')
                    .select('id')
                    .eq('id', payload.credit_account_id)
                    .maybeSingle();

                if (!validCredit) {
                    const { data: currentTreasury } = await supabase
                        .from('accounts')
                        .select('id')
                        .or('code.eq.122,name.ilike.%الخزينة الرئيسية%,code.eq.121,name.ilike.%خزينة%')
                        .limit(1)
                        .maybeSingle();
                    payload.credit_account_id = currentTreasury?.id || null;
                }
            } else {
                const { data: currentTreasury } = await supabase
                    .from('accounts')
                    .select('id')
                    .or('code.eq.122,name.ilike.%الخزينة الرئيسية%,code.eq.121,name.ilike.%خزينة%')
                    .limit(1)
                    .maybeSingle();
                if (currentTreasury) {
                    payload.credit_account_id = currentTreasury.id;
                }
            }

            // 🛡️ التحقق من تطابق الحساب المدين مع الشركة الحالية
            if (payload.debit_account_id) {
                const { data: validDebit } = await supabase
                    .from('accounts')
                    .select('id')
                    .eq('id', payload.debit_account_id)
                    .maybeSingle();
                if (!validDebit) {
                    payload.debit_account_id = null;
                }
            }

            // 🛡️ التحقق من تطابق الشريك مع الشركة الحالية
            if (payload.partner_id) {
                const { data: validPartner } = await supabase
                    .from('partners')
                    .select('id')
                    .eq('id', payload.partner_id)
                    .maybeSingle();
                if (!validPartner) {
                    payload.partner_id = null;
                }
            }

            if (!payload.voucher_number) {
                const timePart = Date.now().toString().slice(-4);
                const randomPart = Math.floor(Math.random() * 100).toString().padStart(2, '0');
                payload.voucher_number = `PV-${timePart}${randomPart}`;
            }
            
            if (!payload.id) {
                payload.is_posted = false;
                payload.status = 'مسودة';
            }

            if (payload.id) {
                const { error } = await supabase.from('payment_vouchers').update(payload).eq('id', payload.id);
                if (error) throw error;
            } else {
                const { data: { session } } = await supabase.auth.getSession();
                payload.created_by = session?.user?.id;
                payload.is_posted = false;
                payload.status = 'مسودة';

                const { error } = await supabase.from('payment_vouchers').insert([payload]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            showToast('تم حفظ السند وهو الآن (معلق)', 'success');
            setIsEditModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['payment_vouchers'] });
            queryClient.invalidateQueries({ queryKey: ['vouchers_server_totals'] });
            queryClient.invalidateQueries({ queryKey: ['site_custodies_summary'] });
        },
        onError: (error: any) => showToast(error.message, 'error')
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const postedVouchers = vouchers.filter(v => selectedIds.includes(v.id) && (v.is_posted || ['posted', 'مرحل', 'معتمد'].includes(v.status)));
            if (postedVouchers.length > 0) throw new Error('لا يمكن حذف سندات معتمدة. قم بفك الترحيل أولاً.');

            const { error } = await supabase.rpc('delete_payment_vouchers_bulk', { p_ids: selectedIds });
            if (error) throw error;
        },
        onSuccess: () => {
            showToast('تم الحذف بنجاح', 'success');
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['payment_vouchers'] });
            queryClient.invalidateQueries({ queryKey: ['vouchers_server_totals'] });
            queryClient.invalidateQueries({ queryKey: ['site_custodies_summary'] });
        },
        onError: (err: any) => showToast(err.message, 'error')
    });

    const handleBulkFixSave = async () => {
        if (selectedIds.length === 0 || (!bulkFixAccounts.credit_account_id && !bulkFixAccounts.debit_account_id)) return;
        
        const updatePayload: any = {};
        if (bulkFixAccounts.credit_account_id) updatePayload.credit_account_id = bulkFixAccounts.credit_account_id;
        if (bulkFixAccounts.debit_account_id) updatePayload.debit_account_id = bulkFixAccounts.debit_account_id;

        const cacheUpdateFields: any = { ...updatePayload };
        if (bulkFixAccounts.credit_account_id) cacheUpdateFields.credit_account = { name: bulkFixAccounts.credit_account_name };
        if (bulkFixAccounts.debit_account_id) cacheUpdateFields.debit_account = { name: bulkFixAccounts.debit_account_name };

        showToast(`جاري تصحيح وتوجيه ${selectedIds.length} سند...`, 'warning');
        
        const previousData = queryClient.getQueryData(['payment_vouchers']);
        updateRowsInCache(selectedIds, cacheUpdateFields);

        try {
            const CHUNK_SIZE = 20;
            for (let i = 0; i < selectedIds.length; i += CHUNK_SIZE) {
                const chunk = selectedIds.slice(i, i + CHUNK_SIZE);
                const { error } = await supabase.from('payment_vouchers').update(updatePayload).in('id', chunk).eq('is_posted', false); 
                if (error) throw new Error(error.message);
            }
            setIsBulkFixModalOpen(false); 
            setBulkFixAccounts({ credit_account_name: '', credit_account_id: null, debit_account_name: '', debit_account_id: null });
            setSelectedIds([]); 
            queryClient.invalidateQueries({ queryKey: ['payment_vouchers'] });
            queryClient.invalidateQueries({ queryKey: ['vouchers_server_totals'] });
            queryClient.invalidateQueries({ queryKey: ['site_custodies_summary'] });
            showToast(`تم تصحيح الحسابات بنجاح!`, 'success');
        } catch (error: any) {
            queryClient.setQueryData(['payment_vouchers'], previousData); 
            showToast("خطأ أثناء التحديث: " + error.message, 'error');
        }
    };

    return {
        data: displayedVouchers,
        isLoading: isFetching || isProcessing || saveMutation.isPending, 
        totals,
        state: {
            globalSearch, filterStatus, dateRange, selectedIds, currentPage, rowsPerPage,
            isEditModalOpen, currentVoucher, partnerBalance, isBalanceLoading,
            isBulkFixModalOpen, bulkFixAccounts
        },
        actions: {
            setGlobalSearch, setFilterStatus, setDateRange, setSelectedIds, setCurrentPage, setRowsPerPage,
            setIsEditModalOpen, setCurrentVoucher, setIsBulkFixModalOpen, setBulkFixAccounts,
            handleAddNew: () => {
                setCurrentVoucher({ 
                    date: new Date().toISOString().split('T')[0], 
                    payment_method: 'نقدي', 
                    amount: '', // 🎯 اعتماد مبلغ واحد فقط
                    debit_account_id: null, debit_account_name: '', debit_account_code: '', credit_account_id: null, credit_account_name: '',
                    payee_id: '', payee_name: '', is_posted: false, status: 'مسودة',
                    job_order_id: null, job_order_number: ''
                });
                setIsEditModalOpen(true);
            },
            handleEditSelected: () => {
                if (selectedIds.length !== 1) return showToast("برجاء تحديد سند واحد فقط للتعديل", "error");
                
                const selected = vouchers.find(v => v.id === selectedIds[0]);
                if (selected) {
                    const voucherForEdit = {
                        ...selected,
                        payee_name: selected.payee?.name || '',
                        debit_account_name: selected.debit_account?.name || '',
                        debit_account_code: selected.debit_account?.code || '',
                        credit_account_name: selected.credit_account?.name || '',
                        job_order_id: selected.job_order_id || null,
                        job_order_number: selected.job_order?.order_number || ''
                    };
                    setCurrentVoucher(voucherForEdit);
                    setIsEditModalOpen(true);
                }
            },
            handleDeleteSelected: () => {
                deleteMutation.mutate();
            },
            handleSaveVoucher: async (dataFromOutside?: any) => {
                const dataToSave = (dataFromOutside && Object.keys(dataFromOutside).length > 0) ? dataFromOutside : currentVoucher;
                return await saveMutation.mutateAsync(dataToSave);
            },
            handlePostSelected: async () => {
                await postRecords(selectedIds);
                queryClient.invalidateQueries({ queryKey: ['vouchers_server_totals'] });
                queryClient.invalidateQueries({ queryKey: ['payment_vouchers'] });
                queryClient.invalidateQueries({ queryKey: ['site_custodies_summary'] });
            },
            handleUnpostSelected: async () => {
                await unpostRecords(selectedIds);
                queryClient.invalidateQueries({ queryKey: ['vouchers_server_totals'] });
                queryClient.invalidateQueries({ queryKey: ['payment_vouchers'] });
                queryClient.invalidateQueries({ queryKey: ['site_custodies_summary'] });
            },
            handleBulkFixSave,
            exportToExcel: () => {}
        }
    };
}
