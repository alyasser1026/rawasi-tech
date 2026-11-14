"use client";
import { currencySymbol } from '@/lib/currency';
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; 
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSmartFilter } from '@/lib/useSmartFilter'; 
import { fetchPaginatedData } from '@/lib/supabase-pagination'; 
import { useUniversalPosting } from '@/lib/accounting_engine'; 
import { useToast } from '@/lib/toast-context'; 
import { checkAdminApprovalPrivilege } from '@/lib/helpers';
import { notify } from '@/lib/notify';
import { useCompany } from '@/lib/CompanyContext';
import { useAuth } from '@/components/authGuard';
import { executeDraftWithOfflineQueue } from '@/lib/offline/offlineExecutor';
import { useOfflineSync } from '@/lib/offline/useOfflineSync';

export function useExpensesLogic() {
    const queryClient = useQueryClient();
    const { showToast } = useToast(); 
    const { activeCompanyId, activeCompany, isLoading: companyLoading } = useCompany();
    const { user, loading: authLoading, can } = useAuth();
    const { items: offlineQueueItems } = useOfflineSync();
    const canLoadExpenses = !authLoading && !companyLoading && Boolean(user && activeCompanyId && can('expenses', 'view'));

    // 🎯 دالة مساعدة لتحديث سطر في الكاش بدقة شديدة
    const updateRowsInCache = (targetIds: any[], updatedFields: any) => {
        queryClient.setQueryData(['expenses'], (oldData: any[]) => {
            if (!oldData) return [];
            const stringIds = targetIds.map(String);
            return oldData.map(row => 
                stringIds.includes(String(row.id)) 
                    ? { ...row, ...updatedFields } 
                    : row 
            );
        });
    };

    // 1. إدارة الحالة الأساسية
    const [userRole, setUserRole] = useState<string>('viewer');
    const [userPermissions, setUserPermissions] = useState<any>({});
    
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    
    const [paymentFilter, setPaymentFilter] = useState<string>('الكل');

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isBulkFixModalOpen, setIsBulkFixModalOpen] = useState(false);
    const [bulkFixAccounts, setBulkFixAccounts] = useState<{ creditor_account: string; payment_account: string; creditor_account_id?: string | null; payment_account_id?: string | null }>({ creditor_account: '', payment_account: '' });

    const [disburseProgress, setDisburseProgress] = useState({ current: 0, total: 0, isActive: false });

    // 🚀 القيمة الافتراضية أصبحت "آجل" تماشياً مع التحديث المحاسبي، وتم إضافة حقول الربط الجديدة
    const defaultExp = { 
        exp_date: new Date().toISOString().split('T')[0], main_category: '', sub_contractor: '', site_ref: '',       
        creditor_account: '', description: '', payee_name: '', payment_method: 'آجل', payment_account: '', 
        employee_name: '', quantity: 1, unit_price: 0, vat_amount: 0, discount_amount: 0, discount_account: '', 
        notes: '', invoice_image: null, _stagedAttachment: null, is_auto_distributed: false,
        // 👇 الحقول الجديدة الخاصة بالربط مع أوامر التشغيل والمقاولين والعهد
        project_id: null, payee_id: null, job_order_id: null, custody_id: null, is_deducted_from_contractor: false 
    };
    const [currentExpense, setCurrentExpense] = useState<any>(defaultExp);

    // 📥 2. جلب البيانات الأساسية
    const expensesQuery = useQuery({
        queryKey: ['expenses'],
        enabled: canLoadExpenses,
        queryFn: async ({ signal }) => {
            const buildQuery = () => {
                signal.throwIfAborted();
                return supabase.from('expenses').select('*').order('exp_date', { ascending: false }).abortSignal(signal);
            };
            const allData = await fetchPaginatedData(buildQuery, 'id');

            return allData.map(exp => {
                let parsedLines = [];
                if (typeof exp.lines_data === 'string') {
                    try { parsedLines = JSON.parse(exp.lines_data); } catch (e) {}
                } else if (Array.isArray(exp.lines_data)) {
                    parsedLines = exp.lines_data;
                }
                return { ...exp, lines_data: parsedLines };
            });
        },
        staleTime: 1000 * 60 * 5,
        retry: 1
    });
    const serverExpenses = canLoadExpenses ? expensesQuery.data || [] : [];

    const queuedExpenses = useMemo(() => {
        if (!canLoadExpenses || !activeCompanyId) return [];
        const syncedReqIds = new Set(
            serverExpenses
                .map((e: any) => e?.client_request_id)
                .filter(Boolean)
                .map(String)
        );
        return offlineQueueItems
            .filter(
                (it) =>
                    it.company_id === activeCompanyId &&
                    (it.entity_type === 'expense_draft' || it.entity_type === 'custody_expense_draft') &&
                    !syncedReqIds.has(String(it.id))
            )
            .map((it) => {
                const p = it.payload || {};
                const qty = Number(p.quantity ?? 1);
                const price = Number(p.unit_price ?? 0);
                const vat = Number(p.vat_amount ?? 0);
                const disc = Number(p.discount_amount ?? 0);
                return {
                    ...p,
                    id: p.id || it.id,
                    client_request_id: it.id,
                    total_price: (qty * price) + vat - disc,
                    paid_amount: p.payment_method === 'تسوية داخلية' ? (qty * price) + vat - disc : 0,
                    is_posted: false,
                    _offline_queued: true,
                    _offline_status: it.status,
                    created_at: it.created_at,
                };
            });
    }, [canLoadExpenses, offlineQueueItems, activeCompanyId, serverExpenses]);

    const expenses = useMemo(() => {
        const map = new Map<string, any>();
        for (const q of queuedExpenses) {
            if (q?.id) map.set(String(q.id), q);
        }
        for (const e of serverExpenses) {
            if (e?.id && !map.has(String(e.id))) map.set(String(e.id), e);
        }
        return Array.from(map.values());
    }, [queuedExpenses, serverExpenses]);

    // 📥 جلب البيانات المساعدة
    const supportDataQuery = useQuery({
        queryKey: ['expenses_support_data'],
        enabled: canLoadExpenses,
        queryFn: async ({ signal }) => {
            const [proj, part, acc, boq] = await Promise.all([
                supabase.from('projects').select('*').abortSignal(signal),
                supabase.from('partners').select('name, partner_type').abortSignal(signal),
                supabase.from('accounts').select('id, code, name').abortSignal(signal),
                supabase.from('boq_items').select('item_code, item_name').limit(3000).abortSignal(signal)
            ]);
            const partnersData = part.data || [];
            return {
                projects: proj.data || [],
                contractors: partnersData.filter(p => p.partner_type === 'مقاول'),
                payees: partnersData,
                accounts_raw: acc.data || [], 
                accounts: (acc.data || []).map(a => ({ id: `${a.code} - ${a.name}`, name: `${a.code} - ${a.name}` })),
                boqItems: Array.from(new Set((boq.data || []).map((b: any) => `${b.item_code} - ${b.item_name}`)))
            };
        },
        staleTime: 1000 * 60 * 5,
        retry: 1
    });
    const supportData = canLoadExpenses ? supportDataQuery.data : undefined;

    useEffect(() => {
        const fetchPerms = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const uid = session?.user?.id;
                if (!uid) return;

                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    const cachedRaw = localStorage.getItem(`phi_cached_profile_${uid}`);
                    if (cachedRaw) {
                        const cached = JSON.parse(cachedRaw);
                        if (cached.role) setUserRole(cached.role);
                        if (cached.permissions) setUserPermissions(cached.permissions);
                    }
                    return;
                }

                const { data: profile } = await supabase.from('profiles').select('role, permissions').eq('id', uid).single();
                if (profile) {
                    setUserRole(profile.role);
                    setUserPermissions(profile.permissions || {});
                }
            } catch {
                /* offline safe */
            }
        };
        fetchPerms();
    }, []);

    // 🚀 3. الفلترة الذكية
    const { filteredData: allFiltered, setFilter, customFilters, globalSearch, setGlobalSearch } = useSmartFilter(
        expenses, 
        ['payee_name', 'sub_contractor', 'description', 'notes', 'site_ref', 'creditor_account', 'main_category'], 
        'exp_date' 
    );

    const finalFilteredExpenses = useMemo(() => {
        if (paymentFilter === 'الكل') return allFiltered;
        
        return allFiltered.filter((exp: any) => {
            let baseAmount = 0;
            if (exp.lines_data && Array.isArray(exp.lines_data) && exp.lines_data.length > 0) {
                baseAmount = exp.lines_data.reduce((sum: number, line: any) => sum + (Number(line.total_price) || (Number(line.quantity || 1) * Number(line.unit_price || 0))), 0);
            } else {
                baseAmount = Number(exp.total_price) || (Number(exp.quantity || 1) * Number(exp.unit_price || 0));
            }
            const total = baseAmount + Number(exp.vat_amount || 0) - Number(exp.discount_amount || 0);
            const paid = Number(exp.paid_amount || 0);
            
            if (paymentFilter === 'غير مسدد') return paid <= 0;
            if (paymentFilter === 'مسدد جزئي') return paid > 0 && paid < total;
            if (paymentFilter === 'مسدد') return paid >= total && total > 0;
            return true;
        });
    }, [allFiltered, paymentFilter]);

    const totalAmount = useMemo(() => finalFilteredExpenses.reduce((sum, exp) => sum + ((Number(exp.quantity) * Number(exp.unit_price)) + Number(exp.vat_amount || 0) - Number(exp.discount_amount || 0)), 0), [finalFilteredExpenses]);
    const totalPages = Math.ceil(finalFilteredExpenses.length / rowsPerPage) || 1;
    
    const historicalData = useMemo(() => {
        const sites = new Set<string>(), contractors = new Set<string>(), payees = new Set<string>(), descriptions = new Set<string>(), notes = new Set<string>();
        expenses.forEach(exp => {
            if (exp.site_ref) sites.add(exp.site_ref);
            if (exp.sub_contractor) contractors.add(exp.sub_contractor);
            if (exp.payee_name) payees.add(exp.payee_name);
            if (exp.description) descriptions.add(exp.description);
            if (exp.notes) notes.add(exp.notes);
        });
        return { sites: Array.from(sites), contractors: Array.from(contractors), payees: Array.from(payees), descriptions: Array.from(descriptions), notes: Array.from(notes) };
    }, [expenses]);

    const { isProcessing } = useUniversalPosting('expenses', 'expenses', 'post_expenses_bulk');

    // 💾 5. حفظ مسودة المصروف (يدعم الأوفلاين + مرفقات Telegram Bot + Idempotency)
    const saveMutation = useMutation({
        mutationFn: async (passedRecord: any) => {
            if (!passedRecord || !passedRecord.exp_date) throw new Error("حدث خطأ في استلام البيانات من النافذة، يرجى المحاولة مرة أخرى.");
            
            // 🛡️ فحص صلاحيات التعديل للقيود المعتمدة
            if (editingId) {
                const existingRecord = serverExpenses.find(e => String(e.id) === String(editingId));
                if (existingRecord && (typeof navigator === 'undefined' || navigator.onLine)) {
                    await checkAdminApprovalPrivilege([existingRecord], 'تعديل');
                }
            }

            let generatedDescription = passedRecord.description;
            if ((!generatedDescription || generatedDescription.trim() === '') && passedRecord.lines_data && Array.isArray(passedRecord.lines_data) && passedRecord.lines_data.length > 0) {
                generatedDescription = passedRecord.lines_data.map((line: any) => line.description || line.item_name || line.work_item).filter(Boolean).join(' + ');
            }
            const finalDescription = generatedDescription && generatedDescription.trim() !== '' ? generatedDescription : 'مصروف عام';
            
            const qty = Number(passedRecord.quantity) || 1;
            const unitPrice = Number(passedRecord.unit_price) || 0;
            const vatAmount = Number(passedRecord.vat_amount) || 0;
            const discountAmount = Number(passedRecord.discount_amount) || 0;
            const netAmount = (qty * unitPrice) + vatAmount - discountAmount;

            const draftPayload: Record<string, any> = {
                id: editingId || undefined,
                exp_date: passedRecord.exp_date,
                main_category: passedRecord.main_category || null,
                sub_contractor: passedRecord.sub_contractor || null,
                site_ref: passedRecord.site_ref || null,
                creditor_account: passedRecord.creditor_account || null,
                description: finalDescription,
                payee_name: passedRecord.payee_name || null,
                payment_method: passedRecord.payment_method || 'آجل',
                payment_account: passedRecord.payment_account || null,
                employee_name: passedRecord.employee_name || null,
                quantity: qty,
                unit_price: unitPrice,
                vat_amount: vatAmount,
                discount_amount: discountAmount,
                discount_account: passedRecord.discount_account || null,
                notes: passedRecord.notes || null,
                invoice_image: passedRecord.invoice_image || null,
                lines_data: passedRecord.lines_data || [],
                is_auto_distributed: Boolean(passedRecord.is_auto_distributed),
                project_id: passedRecord.project_id || null,
                payee_id: passedRecord.payee_id || null,
                job_order_id: passedRecord.job_order_id || null,
                custody_id: passedRecord.custody_id || null,
                is_deducted_from_contractor: Boolean(passedRecord.is_deducted_from_contractor),
                is_posted: false,
            };

            const isCustodyDraft = Boolean(passedRecord.custody_id);
            const execRes = await executeDraftWithOfflineQueue({
                entityType: isCustodyDraft ? 'custody_expense_draft' : 'expense_draft',
                rpcName: 'save_expense_draft',
                companyId: activeCompanyId,
                companyName: activeCompany?.name || 'الشركة الحالية',
                description: finalDescription,
                amount: netAmount,
                payload: draftPayload,
                stagedAttachment: passedRecord._stagedAttachment || null,
                attachmentModule: isCustodyDraft ? 'custodies' : 'expenses',
            });

            return {
                mode: execRes.mode,
                type: editingId ? 'update' : 'insert',
                data: execRes.record,
                isCustodyDraft,
            };
        },
        onSuccess: (res) => {
            if (res.mode === 'queued') {
                showToast('تم حفظ مسودة المصروف محلياً (أوفلاين)؛ ستُرفع مع المرفق تلقائياً فور عودة الإنترنت', 'info');
            } else {
                showToast('تم حفظ مسودة المصروف بنجاح', 'success');
            }
            setIsEditModalOpen(false);
            setEditingId(null);
            setCurrentExpense(defaultExp);
            
            if (res && res.mode === 'online' && res.data) {
                queryClient.setQueryData(['expenses'], (oldData: any[]) => {
                    if (!oldData) return [res.data];
                    let parsedData = { ...res.data };
                    if (typeof parsedData.lines_data === 'string') {
                        try { parsedData.lines_data = JSON.parse(parsedData.lines_data); } catch(e){}
                    }
                    if (res.type === 'update') {
                        return oldData.map(exp => String(exp.id) === String(parsedData.id) ? { ...exp, ...parsedData } : exp);
                    } else {
                        return [parsedData, ...oldData];
                    }
                });
                if (res.isCustodyDraft) {
                    void queryClient.invalidateQueries({ queryKey: ['site_custodies_summary'] });
                }
            }
        },
        onError: (err: any) => {
            console.error("Save Error Details:", err);
            showToast(`فشل الحفظ: ${err.message}`, 'error'); 
        }
    });

    // 🗑️ الحذف المتسلسل
    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error('حذف السجلات المحفوظة على الخادم يتطلب اتصالاً بالإنترنت؛ يمكنك حذف المسودات غير المتصلة من نافذة الطابور أعلى الشاشة.');
            }
            const targetExpenses = serverExpenses.filter(e => selectedIds.includes(String(e.id)));
            await checkAdminApprovalPrivilege(targetExpenses, 'حذف');

            const { error } = await supabase.rpc('delete_expenses_bulk', { record_ids: selectedIds });
            if (error) throw error;
            return selectedIds; 
        },
        onSuccess: (deletedIds) => {
            showToast('تم المسح التسلسلي بنجاح', 'success');
            const stringDeletedIds = deletedIds.map(String);
            queryClient.setQueryData(['expenses'], (oldData: any[]) => {
                if (!oldData) return [];
                return oldData.filter(exp => !stringDeletedIds.includes(String(exp.id)));
            });
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['payment_vouchers'] });
        },
        onError: (err: any) => showToast(`حدث خطأ أثناء الحذف: ${err.message}`, 'error')
    });

    // 💸 6. سداد السطر الواحد (يتطلب اتصالاً بالإنترنت)
    const paymentMutation = useMutation({
        mutationFn: async (paymentData: any) => {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error('إصدار سندات الصرف والسداد يتطلب اتصالاً بالإنترنت');
            }
            const targetId = paymentData.id || paymentData.related_expense_id || paymentData.expense_id;
            if (!targetId) throw new Error("لا يوجد ID للفاتورة مبعوث من المودال!");

            let resolvedDebitId = null, resolvedCreditId = null;
            if (supportData?.accounts_raw) {
                // 💡 المدين لسند الصرف هو حساب الالتزام (payment_account) لإقفال الالتزام وتفادي تكرار التكلفة
                const targetDebitName = paymentData.payment_account;
                const foundDebit = supportData.accounts_raw.find((a: any) => 
                    `${a.code} - ${a.name}` === targetDebitName || 
                    a.name === targetDebitName || 
                    String(a.code) === targetDebitName ||
                    (targetDebitName && targetDebitName.includes(' - ') && a.name === targetDebitName.split(' - ')[1]?.trim())
                );
                if (foundDebit) resolvedDebitId = foundDebit.id;
                
                // 💡 الدائن لسند الصرف هو وسيلة السداد (الخزينة للنقدي، أو البنك للشيك والتحويل البنكي)
                const isBankOrCheque = ['شيك', 'تحويل بنكي'].includes(paymentData.payment_method);
                const foundCredit = supportData.accounts_raw.find((a: any) => 
                    isBankOrCheque 
                        ? ((a.name || '').includes('بنك') || String(a.code).startsWith('121') || String(a.code).startsWith('129'))
                        : (String(a.code) === '122' || (a.name || '').includes('خزينة') || (a.name || '').includes('صندوق'))
                );
                if (foundCredit) resolvedCreditId = foundCredit.id;
            }

            const { data: realExpense, error: fetchErr } = await supabase
                .from('expenses')
                .select('paid_amount, description, site_ref')
                .eq('id', targetId)
                .single();
            if (fetchErr) throw fetchErr;

            const oldPaidAmount = Number(realExpense.paid_amount || 0);
            const addedAmount = Number(paymentData.amount || 0);
            const newPaidAmount = oldPaidAmount + addedAmount;

            const { data: { session } } = await supabase.auth.getSession();

            const voucherPayload = {
                related_expense_id: targetId, 
                voucher_number: `PV-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`, 
                date: paymentData.payment_date || new Date().toISOString().split('T')[0], 
                amount: addedAmount, 
                payment_method: paymentData.payment_method || 'آجل', 
                debit_account_id: resolvedDebitId, 
                credit_account_id: resolvedCreditId, 
                site_ref: paymentData.site_ref || realExpense.site_ref, 
                description: paymentData.payment_notes || `سداد مصروف لـ ${realExpense.description || 'أعمال مقاولات'}`, 
                reference_no: paymentData.reference_number || paymentData.reference_no || '', 
                is_posted: false, 
                created_by: session?.user?.id
            };
            
            const { error: voucherErr } = await supabase.from('payment_vouchers').insert([voucherPayload]);
            if (voucherErr) throw voucherErr;

            const { error: expErr } = await supabase.from('expenses').update({ paid_amount: newPaidAmount }).eq('id', targetId);
            if (expErr) throw expErr;

            return { targetId, newPaidAmount };
        },
        onSuccess: ({ targetId, newPaidAmount }) => {
            queryClient.setQueryData(['expenses'], (oldData: any[]) => {
                if (!oldData) return [];
                return oldData.map(exp => 
                    String(exp.id) === String(targetId) ? { ...exp, paid_amount: newPaidAmount } : exp
                );
            });
            showToast('تم الصرف بنجاح', 'success');
            queryClient.invalidateQueries({ queryKey: ['payment_vouchers'] });
        },
        onError: (err: any) => {
            showToast(`خطأ أثناء الصرف: ${err.message}`, 'error');
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        }
    });

    // 🔧 التصحيح المجمع
    const handleBulkFixSave = async () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            showToast('التصحيح المجمع يتطلب اتصالاً بالإنترنت', 'warning');
            return;
        }
        if (selectedIds.length === 0 || (!bulkFixAccounts.creditor_account && !bulkFixAccounts.payment_account)) return;
        const updatePayload: any = {};
        if (bulkFixAccounts.creditor_account) updatePayload.creditor_account = bulkFixAccounts.creditor_account;
        if (bulkFixAccounts.payment_account) updatePayload.payment_account = bulkFixAccounts.payment_account;
        
        await queryClient.cancelQueries({ queryKey: ['expenses'] });
        const previousData = queryClient.getQueryData(['expenses']);
        
        updateRowsInCache(selectedIds, updatePayload);

        try {
            const CHUNK_SIZE = 20; 
            for (let i = 0; i < selectedIds.length; i += CHUNK_SIZE) {
                const chunk = selectedIds.slice(i, i + CHUNK_SIZE);
                const { error } = await supabase.from('expenses').update(updatePayload).in('id', chunk).eq('is_posted', false); 
                if (error) throw new Error(error.message);
            }
            setIsBulkFixModalOpen(false); 
            setBulkFixAccounts({ creditor_account: '', payment_account: '' });
            setSelectedIds([]); 
            showToast(`تم التصحيح المجمع بنجاح!`, 'success');
        } catch (error: any) {
            queryClient.setQueryData(['expenses'], previousData); 
            showToast("خطأ أثناء التحديث: " + error.message, 'error');
        }
    };
    
    // الصرف الجماعي
    const bulkDisburseMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error('الصرف الجماعي يتطلب اتصالاً بالإنترنت');
            }
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) throw new Error("يجب تسجيل الدخول أولاً");

            const CHUNK_SIZE = 20; 
            let totalProcessedCount = 0;
            let totalDisbursedSum = 0;

            setDisburseProgress({ current: 0, total: ids.length, isActive: true });

            for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
                const chunk = ids.slice(i, i + CHUNK_SIZE);
                const { data, error } = await supabase.rpc('bulk_disburse_v2', { p_ids: chunk, p_user_id: session.user.id });

                if (error) {
                    const errorDetails = error.message || error.details || error.hint || JSON.stringify(error);
                    if (i === 0) throw new Error(`فشل الاتصال: ${errorDetails}`);
                    continue;
                }

                if (data && data[0]) {
                    totalProcessedCount += data[0].processed_count;
                    totalDisbursedSum += Number(data[0].total_amount);
                }

                const currentProgress = Math.min(i + CHUNK_SIZE, ids.length);
                setDisburseProgress(prev => ({ ...prev, current: currentProgress }));
            }

            return { processed_count: totalProcessedCount, total_amount: totalDisbursedSum };
        },
        onSuccess: (res) => {
            if (res.processed_count > 0) {
                showToast(`تم إنشاء ${res.processed_count} سند صرف بإجمالي ${Number(res.total_amount).toLocaleString()} ${currencySymbol()}`, 'success');
            } else {
                showToast("لم يتم إنشاء أي سندات، قد تكون السجلات مسددة بالفعل!", 'warning');
            }
            setSelectedIds([]); 
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            queryClient.invalidateQueries({ queryKey: ['payment_vouchers'] });
        },
        onError: (err: any) => {
            showToast(`فشلت العملية: ${err.message}`, 'error');
        },
        onSettled: () => {
            setTimeout(() => setDisburseProgress({ current: 0, total: 0, isActive: false }), 2000);
        }
    });

    const canAdd = (userRole === 'admin' || userRole === 'super_admin') || userPermissions?.expenses?.create;
    const canEdit = (userRole === 'admin' || userRole === 'super_admin') || userPermissions?.expenses?.edit;
    const canDelete = (userRole === 'admin' || userRole === 'super_admin') || userPermissions?.expenses?.delete;
    const canPost = (userRole === 'admin' || userRole === 'super_admin') || userPermissions?.expenses?.post;
    const canView = (userRole === 'admin' || userRole === 'super_admin') || userPermissions?.expenses?.view;
    const canExport = (userRole === 'admin' || userRole === 'super_admin') || userPermissions?.expenses?.print;

    return {
        isSaving: saveMutation.isPending, 
        isSavingPayment: paymentMutation.isPending,
        isLoading: authLoading || companyLoading || expensesQuery.isLoading || supportDataQuery.isLoading || isProcessing || deleteMutation.isPending,
        refreshData: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
        
        filteredExpenses: finalFilteredExpenses, totalAmount, totalPages, totalResults: finalFilteredExpenses.length, historicalData,
        paymentFilter, setPaymentFilter,
        disburseProgress,
        
        selectedIds, setSelectedIds, currentPage, setCurrentPage, rowsPerPage, setRowsPerPage, isEditModalOpen, setIsEditModalOpen, currentExpense, setCurrentExpense, editingId, projects: supportData?.projects || [], contractors: supportData?.contractors || [], payees: supportData?.payees || [], accounts: supportData?.accounts || [], boqItems: supportData?.boqItems || [], accounts_raw: supportData?.accounts_raw || [], isBulkFixModalOpen, setIsBulkFixModalOpen, bulkFixAccounts, setBulkFixAccounts, handleBulkFixSave, canAdd, canEdit, canDelete, canPost, canView, canExport, userRole,
        
        setFilterStatus: (val: string) => setFilter('is_posted', val === 'الكل' ? null : val === 'معتمد'),
        setFilterAccount: (val: string) => setFilter('creditor_account', val === 'الكل' ? null : val),
        filterAccount: customFilters['creditor_account'] || 'الكل',
        filterStatus: customFilters['is_posted'] === undefined ? 'الكل' : (customFilters['is_posted'] ? 'معتمد' : 'معلق'),
        
        handleSaveExpense: (data: any) => {
            if (!data) return showToast("لم يتم استلام البيانات!", "error");
            if (data.is_posted) return showToast("لا يمكن تعديل سجل مرحل. يرجى فك الترحيل أولاً.", "error");
            saveMutation.mutate(data);
        },
        handleSavePayment: (data: any) => paymentMutation.mutate(data),
        handleAddNew: () => { setCurrentExpense(defaultExp); setEditingId(null); setIsEditModalOpen(true); }, 
        handleEditSelected: () => {
            if (selectedIds.length !== 1) return notify("اختر سجلاً واحداً للتعديل");
            const exp = expenses.find(e => e.id === selectedIds[0]);
            if (exp?._offline_queued) {
                return showToast("هذه المسودة في طابور عدم الاتصال بانتظار المزامنة التلقائية", "info");
            }
            setCurrentExpense({...exp, _stagedAttachment: null}); setEditingId(exp.id); setIsEditModalOpen(true);
        }, 
        exportToExcel: () => {},
        handleDeleteSelected: () => {
            const posted = expenses.filter((e:any) => selectedIds.includes(e.id) && e.is_posted);
            if (posted.length > 0) return showToast("لا يمكن حذف سجلات مرحلة. يرجى فك الترحيل أولاً.", "error");
            deleteMutation.mutate();
        },
        
        handlePostSelected: async () => {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                return showToast('الترحيل والاعتماد المحاسبي يتطلبان اتصالاً بالإنترنت', 'warning');
            }
            if (selectedIds.length === 0) return;
            if (queuedExpenses.some((q: any) => selectedIds.includes(String(q.id)))) {
                return showToast('يرجى انتظار مزامنة المسودات المحفوظة في الطابور أولاً قبل ترحيلها', 'warning');
            }
            const idsToProcess = [...selectedIds];
            await queryClient.cancelQueries({ queryKey: ['expenses'] });
            const previousData = queryClient.getQueryData(['expenses']);
            updateRowsInCache(idsToProcess, { is_posted: true });
            setSelectedIds([]);

            try {
                const { error } = await supabase.rpc('post_expenses_bulk', { p_ids: idsToProcess });
                if (error) throw error;
                showToast('تم الترحيل بنجاح', 'success');
            } catch (error: any) {
                queryClient.setQueryData(['expenses'], previousData);
                import('@/lib/audit').then(({ logCustomAuditEvent }) => logCustomAuditEvent('expenses', 'FAILED_POST', idsToProcess[0], null, { error: error.message }));
                showToast(`خطأ: ${error.message}`, 'error');
            }
        },
        
        handleUnpostSelected: async () => {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                return showToast('فك الترحيل يتطلب اتصالاً بالإنترنت', 'warning');
            }
            if (selectedIds.length === 0) return;
            const idsToProcess = [...selectedIds];
            await queryClient.cancelQueries({ queryKey: ['expenses'] });
            const previousData = queryClient.getQueryData(['expenses']);
            updateRowsInCache(idsToProcess, { is_posted: false, paid_amount: 0 });
            setSelectedIds([]);

            try {
                const { error } = await supabase.rpc('unpost_expenses_bulk', { record_ids: idsToProcess });
                if (error) throw error;
                showToast('تم فك الترحيل وحذف سندات الصرف المرتبطة بنجاح', 'success');
                queryClient.invalidateQueries({ queryKey: ['expenses'] });
                queryClient.invalidateQueries({ queryKey: ['payment_vouchers'] });
                queryClient.invalidateQueries({ queryKey: ['journal_headers'] });
                queryClient.invalidateQueries({ queryKey: ['cash_flows'] });
                queryClient.invalidateQueries({ queryKey: ['site_custodies_summary'] });
            } catch (error: any) {
                queryClient.setQueryData(['expenses'], previousData);
                showToast(`خطأ: ${error.message}`, 'error');
            }
        },
        
        handlePostAllUnposted: async () => {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                return showToast('الترحيل والاعتماد المحاسبي يتطلبان اتصالاً بالإنترنت', 'warning');
            }
            const unposted = allFiltered.filter((e:any) => !e.is_posted && !e._offline_queued).map((e:any) => e.id);
            if (unposted.length === 0) return showToast("لا يوجد سجلات معلقة جاهزة للترحيل!", 'info');
            const idsToProcess = [...unposted];
            await queryClient.cancelQueries({ queryKey: ['expenses'] });
            const previousData = queryClient.getQueryData(['expenses']);
            updateRowsInCache(idsToProcess, { is_posted: true });
            
            try {
                const { error } = await supabase.rpc('post_expenses_bulk', { p_ids: idsToProcess });
                if (error) throw error;
                showToast('تم الترحيل بالكامل', 'success');
                setSelectedIds([]);
            } catch (error: any) {
                queryClient.setQueryData(['expenses'], previousData);
                showToast(`خطأ الترحيل: ${error.message}`, 'error');
            }
        },

        handleBulkDisburse: () => {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                return showToast('الصرف الجماعي يتطلب اتصالاً بالإنترنت', 'warning');
            }
            if (selectedIds.length === 0) return;
            if (confirm(`هل أنت متأكد من إنشاء سندات صرف لـ ${selectedIds.length} سجل؟`)) {
                bulkDisburseMutation.mutate(selectedIds);
            }
        },
        isDisbursing: bulkDisburseMutation.isPending
    };
}
