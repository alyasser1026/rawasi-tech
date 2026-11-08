"use client";
import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase'; 
import { useToast } from '@/lib/toast-context'; 
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; 
import { fetchAllSupabaseData } from '@/lib/helpers';

export function useJobOrdersLogic() {
    const { showToast } = useToast(); 
    const queryClient = useQueryClient();
    
    // ================= State Management =================
    const [globalSearch, setGlobalSearch] = useState('');
    const deferredSearch = useDeferredValue(globalSearch); 
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [executorFilter, setExecutorFilter] = useState('');
    const [workitemFilter, setWorkitemFilter] = useState('');
    const [projectFilter, setProjectFilter] = useState('');
    const [partnerFilter, setPartnerFilter] = useState('');
    const [financialFilter, setFinancialFilter] = useState('');
    
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentRecord, setCurrentRecord] = useState<any>({});
    
    // 🚀 حالات المودال الجديد (دفتر الأستاذ التحليلي)
    const [isLedgerOpen, setIsLedgerOpen] = useState(false);
    const [ledgerRecord, setLedgerRecord] = useState<any>(null);

    // ================= Fetching Data (React Query) =================
    
    // 1. جلب البيانات الأساسية مع الإسناد والمستخلصات
    const { data: baseJobOrders = [], isLoading: isJoLoading } = useQuery({
        queryKey: ['job_orders'],
        queryFn: async () => {
            try {
                const data = await fetchAllSupabaseData(supabase, 'job_orders', `
                    *, 
                    projects:project_id(project_name, Property), 
                    partners!job_orders_contractor_id_fkey(name), 
                    boq_budget:boq_budget_id(work_item, budget_code, Property),
                    contractor_assignments:contractor_assignments!contractor_assignments_job_order_id_fkey(
                        assigned_qty,
                        unit_price,
                        sub_claims:sub_claims!contractor_assignments_claim_id_fkey ( id, total_amount, net_amount, paid_amount, materials_deduction, other_deductions, advance_payment, retention_amount )
                    )
                `, 'created_at', false);
                return data || [];
            } catch (err: any) {
                console.warn('Fallback job_orders query due to relation ambiguity:', err?.message);
                const rawJobOrders = await fetchAllSupabaseData(supabase, 'job_orders', `
                    *, 
                    projects:project_id(project_name, Property), 
                    partners!job_orders_contractor_id_fkey(name), 
                    boq_budget:boq_budget_id(work_item, budget_code, Property)
                `, 'created_at', false) || [];

                try {
                    const rawAssignments = await fetchAllSupabaseData(supabase, 'contractor_assignments', `
                        job_order_id,
                        assigned_qty,
                        unit_price,
                        sub_claims:claim_id ( id, total_amount, net_amount, paid_amount, materials_deduction, other_deductions, advance_payment, retention_amount )
                    `, 'created_at', false) || [];

                    const asgMap = new Map<string, any[]>();
                    rawAssignments.forEach((asg: any) => {
                        if (!asg.job_order_id) return;
                        if (!asgMap.has(asg.job_order_id)) asgMap.set(asg.job_order_id, []);
                        asgMap.get(asg.job_order_id)!.push(asg);
                    });

                    return rawJobOrders.map((jo: any) => ({
                        ...jo,
                        contractor_assignments: asgMap.get(jo.id) || []
                    }));
                } catch {
                    return rawJobOrders;
                }
            }
        }
    });

    // 2. جلب الأداء المالي (بأمان لمنع الكراش)
    const { data: joPerformance = [], isLoading: isPerfLoading } = useQuery({
        queryKey: ['job_order_performance'],
        queryFn: async () => {
            return await fetchAllSupabaseData(supabase, 'job_order_performance', '*') || [];
        }
    });

    const { data: projects = [], isLoading: isProjLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => {
            return await fetchAllSupabaseData(supabase, 'projects', 'id, project_name, Property') || [];
        }
    });

    // 3. جلب مصروفات الشركة العامة الموزعة على أوامر الشغل
    const { data: generalAllocations = [], isLoading: isAllocLoading } = useQuery({
        queryKey: ['advanced_cost_allocation'],
        queryFn: async () => {
            return await fetchAllSupabaseData(supabase, 'advanced_cost_allocation_view', '*') || [];
        }
    });

    // ================= Data Merging & Filtering =================
    
    const mergedJobOrders = useMemo(() => {
        if (!baseJobOrders.length) return [];
        
        return baseJobOrders.map(jo => {
            const perf = joPerformance.find((p: any) => p.job_order_id === jo.id) || {};
            let effectiveCost = Number(perf.effective_cost || 0); // التكلفة المسحوبة من عرض الأداء

            // إضافة المصروفات العامة (العمالة والإعاشة اليومية/الشهرية) من view التوزيع
            const joAllocations = generalAllocations.filter((a: any) => a.job_order_id === jo.id);
            const totalAllocatedOverhead = joAllocations.reduce((sum: number, curr: any) => sum + Number(curr['المبلغ المحمل (ر.س)'] || 0), 0);
            
            effectiveCost += totalAllocatedOverhead;
            
            let subPaidTotal = 0;
            
            // 🚀 التطابق التام مع طريقة السجل (JobOrderLedgerModal)
            if (jo.executor_type === 'مقاول باطن') {
                
                // 1. حساب إجمالي الأعمال المقدرة من الإسنادات
                let joGross = 0;
                if (jo.contractor_assignments && jo.contractor_assignments.length > 0) {
                    jo.contractor_assignments.forEach((a: any) => {
                        joGross += Number(a.assigned_qty || 0) * Number(a.unit_price || 0);
                    });
                } else {
                    joGross = Number(jo.assigned_qty || 0) * Number(jo.unit_price || 0);
                }

                // 2. فلترة ومعالجة المستخلصات واستخراج نصيب الفيلا من السداد
                if (jo.contractor_assignments && jo.contractor_assignments.length > 0) {
                    const uniqueClaims = new Map();
                    jo.contractor_assignments.forEach((ca: any) => {
                        const claimsArray = Array.isArray(ca.sub_claims) ? ca.sub_claims : [ca.sub_claims];
                        claimsArray.forEach((claim: any) => {
                            if (claim && !uniqueClaims.has(claim.id)) {
                                uniqueClaims.set(claim.id, claim);
                            }
                        });
                    });

                    uniqueClaims.forEach((claim: any) => {
                        const claimTotalGross = Number(claim.total_amount || 0);
                        
                        let ratio = 0;
                        // المعادلة الدقيقة: قيمة أمر التشغيل / إجمالي المستخلص المجمع
                        if (claimTotalGross > 0 && joGross > 0) {
                            ratio = joGross / claimTotalGross; 
                        }
                        
                        // تأمين النسبة (لا تتعدى 100% ولا تقل عن صفر)
                        if (ratio > 1) ratio = 1;
                        if (ratio < 0) ratio = 0;

                        // تجميع المسدد للمقاول بناءً على نصيب الفيلا من السداد
                        subPaidTotal += Number(claim.paid_amount || 0) * ratio; 
                    });
                }
            }

            return { 
                ...jo, 
                ...perf,
                subcontractor_paid: subPaidTotal, // المبالغ النقدية للمقاول بعد التوزيع الدقيق للفيلا
                total_allocated_overhead: totalAllocatedOverhead, // المصروفات العامة المحملة على أمر الشغل
                final_effective_cost: effectiveCost + subPaidTotal // إجمالي المنصرف الحقيقي متضمناً العمالة والمقاول
            }; 
        });
    }, [baseJobOrders, joPerformance, generalAllocations]);

    const allFiltered = useMemo(() => {
        if (!mergedJobOrders) return [];
        return mergedJobOrders.filter((jo: any) => {
            const searchLower = String(deferredSearch || '').toLowerCase();
            
            const orderNum = String(jo.order_number || '').toLowerCase();
            const projName = String(jo.projects?.project_name || jo.projects?.Property || '').toLowerCase();
            const partnerName = String(jo.partners?.name || '').toLowerCase();
            const propName = String(jo.boq_budget?.Property || '').toLowerCase();
            const combName = String(jo.job_order_name || '').toLowerCase();

            const matchesSearch = 
                orderNum.includes(searchLower) || 
                projName.includes(searchLower) ||
                partnerName.includes(searchLower) ||
                propName.includes(searchLower) ||
                combName.includes(searchLower);
            
            let matchesDate = true;
            const joDate = jo.start_date || jo.created_at ? new Date(jo.start_date || jo.created_at) : null;
            if (joDate) {
                if (dateFrom) matchesDate = matchesDate && joDate >= new Date(dateFrom);
                if (dateTo) matchesDate = matchesDate && joDate <= new Date(dateTo);
            }
            
            let matchesStatus = true;
            if (statusFilter && jo.status !== statusFilter) matchesStatus = false;
            
            let matchesExecutor = true;
            if (executorFilter && jo.executor_type !== executorFilter) matchesExecutor = false;

            let matchesWorkitem = true;
            if (workitemFilter && jo.boq_budget?.work_item !== workitemFilter) matchesWorkitem = false;

            let matchesProject = true;
            if (projectFilter && jo.project_id !== projectFilter) matchesProject = false;

            let matchesPartner = true;
            if (partnerFilter && jo.contractor_id !== partnerFilter) matchesPartner = false;

            let matchesFinancial = true;
            if (financialFilter) {
                const targetBudget = Number(jo.boq_budget?.total_price || jo.boq_total_budget || 0); 
                const finalCost = Number(jo.final_effective_cost || 0);
                const calculatedProfit = targetBudget - finalCost;

                if (financialFilter === 'رابح' && (calculatedProfit <= 0 || targetBudget === 0)) matchesFinancial = false;
                if (financialFilter === 'خاسر' && calculatedProfit >= 0) matchesFinancial = false;
                if (financialFilter === 'تعادل' && (calculatedProfit !== 0 || finalCost === 0)) matchesFinancial = false;
                if (financialFilter === 'لم يبدأ' && (calculatedProfit !== 0 || finalCost > 0)) matchesFinancial = false;
            }

            return matchesSearch && matchesDate && matchesStatus && matchesExecutor && matchesWorkitem && matchesProject && matchesPartner && matchesFinancial;
        });
    }, [mergedJobOrders, deferredSearch, dateFrom, dateTo, statusFilter, executorFilter, workitemFilter, projectFilter, partnerFilter, financialFilter]);

    const paginatedJobOrders = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return allFiltered.slice(start, start + rowsPerPage);
    }, [allFiltered, currentPage, rowsPerPage]);

    const kpis = useMemo(() => ({
        total: allFiltered.length,
        completed: allFiltered.filter((i: any) => i.status === 'مكتمل').length,
        running: allFiltered.filter((i: any) => i.status === 'جاري التنفيذ').length,
        suspended: allFiltered.filter((i: any) => i.status === 'موقوف').length
    }), [allFiltered]);

    // ================= Handlers =================
    const handleAddNew = () => { 
        setCurrentRecord({ 
            executor_type: 'تنفيذ ذاتي',
            status: 'مسودة', 
            start_date: new Date().toISOString().split('T')[0],
            retention_percent: 10
        }); 
        setIsEditModalOpen(true); 
    };

    const handleEdit = (jo: any) => {
        setCurrentRecord({ ...jo, client_name: jo.partners?.name || '' });
        setIsEditModalOpen(true);
    };

    // ================= Mutations =================
    const saveMutation = useMutation({
        mutationFn: async (record: any) => {
            const qty = Number(record.assigned_qty) || 0;
            const price = Number(record.unit_price) || 0;

            if (qty <= 0) throw new Error("عفواً، الكمية المسندة يجب أن تكون أكبر من صفر");
            if (price < 0) throw new Error("عفواً، سعر الوحدة لا يمكن أن يكون قيمة سالبة");
            if (record.executor_type === 'مقاول باطن' && !record.contractor_id) {
                throw new Error("عفواً، يجب اختيار اسم مقاول الباطن لإتمام الأمر");
            }

            const retentionInput = String(record.retention_percent ?? '').trim();
            const retentionPercent = retentionInput === '' ? null : Number(retentionInput);
            if (retentionPercent === null && !record.id) {
                throw new Error('يرجى إدخال نسبة ضمان الأعمال، أو كتابة صفر إذا لم يوجد ضمان');
            }
            if (retentionPercent !== null && (!Number.isFinite(retentionPercent) || retentionPercent < 0 || retentionPercent > 100 || retentionPercent !== Number(retentionPercent.toFixed(2)))) {
                throw new Error('نسبة ضمان الأعمال يجب أن تكون من 0 إلى 100 وبحد أقصى منزلتين عشريتين');
            }

            const cleanId = (id: any) => (id && typeof id === 'string' && id.trim() !== '') ? id : null;
            // الرقم الجديد بيتحدد في قاعدة البيانات (JO-السنة-0001)؛ الأمر المحفوظ بيفضل برقمه
            const uniqueOrderNumber = record.order_number || null;

            const payload = {
                order_number: uniqueOrderNumber,
                project_id: cleanId(record.project_id),
                boq_budget_id: cleanId(record.boq_budget_id),
                executor_type: record.executor_type || 'تنفيذ ذاتي',
                contractor_id: record.executor_type === 'مقاول باطن' ? cleanId(record.contractor_id) : null,
                assigned_qty: qty,
                unit_price: price,
                retention_percent: retentionPercent,
                status: record.status || 'مسودة',
                start_date: record.start_date || new Date().toISOString().split('T')[0],
                end_date: record.end_date || null,
                notes: record.notes
            };

            const saveWithFallback = async (dataPayload: any) => {
                const isRetentionError = (err: any) => 
                    err && (String(err.message).includes('retention_percent') || err.code === 'PGRST204' || err.code === '42703' || String(err.details).includes('retention_percent'));

                if (record.id) {
                    let { error } = await supabase.from('job_orders').update(dataPayload).eq('id', record.id);
                    if (isRetentionError(error)) {
                        console.warn('retention_percent column missing in schema cache, retrying without it...');
                        const fallbackPayload = { ...dataPayload };
                        delete fallbackPayload.retention_percent;
                        const retry = await supabase.from('job_orders').update(fallbackPayload).eq('id', record.id);
                        error = retry.error;
                    }
                    if (error) throw error;
                } else {
                    let { error } = await supabase.from('job_orders').insert([dataPayload]);
                    if (isRetentionError(error)) {
                        console.warn('retention_percent column missing in schema cache, retrying without it...');
                        const fallbackPayload = { ...dataPayload };
                        delete fallbackPayload.retention_percent;
                        const retry = await supabase.from('job_orders').insert([fallbackPayload]);
                        error = retry.error;
                    }
                    if (error) throw error;
                }
            };

            await saveWithFallback(payload);
        },
        onSuccess: () => {
            setIsEditModalOpen(false);
            showToast("تم حفظ أمر التشغيل بنجاح", "success");
            queryClient.invalidateQueries({ queryKey: ['job_orders'] });
            queryClient.invalidateQueries({ queryKey: ['job_order_performance'] });
        },
        onError: (err: any) => showToast(`${err.message}`, "error")
    });

    const changeStatusMutation = useMutation({
        mutationFn: async (newStatus: string) => {
            if (!selectedIds.length) return;
            const { error } = await supabase.from('job_orders').update({ status: newStatus }).in('id', selectedIds);
            if (error) throw error;
        },
        onSuccess: (_, newStatus) => {
            showToast(`تم تغيير الحالة إلى ${newStatus} بنجاح`, "success");
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['job_orders'] });
        },
        onError: (err: any) => showToast(`خطأ في تحديث الحالة: ${err.message}`, "error")
    });
    const changeSingleStatusMutation = useMutation({
        mutationFn: async ({ id, newStatus }: { id: string, newStatus: string }) => {
            const { error } = await supabase.from('job_orders').update({ status: newStatus }).eq('id', id);
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            showToast(`تم تغيير الحالة إلى ${variables.newStatus} بنجاح`, "success");
            queryClient.invalidateQueries({ queryKey: ['job_orders'] });
        },
        onError: (err: any) => showToast(`خطأ في تحديث الحالة: ${err.message}`, "error")
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!selectedIds.length) return;
            const { error } = await supabase.from('job_orders').delete().in('id', selectedIds);
            if (error) throw error;
        },
        onSuccess: () => {
            showToast("تم حذف أوامر التشغيل المحددة نهائياً", "success");
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['job_orders'] });
        },
        onError: (err: any) => showToast(`خطأ في الحذف: ${err.message}`, "error")
    });

    const isSaving = saveMutation.isPending || changeStatusMutation.isPending || deleteMutation.isPending;
    const isLoading = isJoLoading || isProjLoading || isPerfLoading || isSaving;

    return {
        jobOrders: paginatedJobOrders,
        allFiltered,
        projects,
        isLoading,
        isSaving,
        globalSearch, setGlobalSearch: (v: string) => { setGlobalSearch(v); setCurrentPage(1); },
        dateFrom, setDateFrom: (v: string) => { setDateFrom(v); setCurrentPage(1); },
        dateTo, setDateTo: (v: string) => { setDateTo(v); setCurrentPage(1); },
        statusFilter, setStatusFilter: (v: string) => { setStatusFilter(v); setCurrentPage(1); },
        executorFilter, setExecutorFilter: (v: string) => { setExecutorFilter(v); setCurrentPage(1); },
        workitemFilter, setWorkitemFilter: (v: string) => { setWorkitemFilter(v); setCurrentPage(1); },
        projectFilter, setProjectFilter: (v: string) => { setProjectFilter(v); setCurrentPage(1); },
        partnerFilter, setPartnerFilter: (v: string) => { setPartnerFilter(v); setCurrentPage(1); },
        financialFilter, setFinancialFilter: (v: string) => { setFinancialFilter(v); setCurrentPage(1); },
        selectedIds, setSelectedIds,
        currentPage, setCurrentPage,
        rowsPerPage, setRowsPerPage: (v: number) => { setRowsPerPage(v); setCurrentPage(1); },
        kpis,
        isEditModalOpen, setIsEditModalOpen,
        currentRecord, setCurrentRecord,
        isLedgerOpen, setIsLedgerOpen,
        ledgerRecord, setLedgerRecord,
        handleAddNew, handleEdit, 
        handleSave: (record: any) => {
            if (record && record.status === 'مكتمل') {
                return showToast("لا يمكن تعديل أمر تشغيل مكتمل.", "error");
            }
            saveMutation.mutate(record);
        },
        handleUpdateSingleStatus: (id: string, newStatus: string) => changeSingleStatusMutation.mutate({ id, newStatus }),
        handleCompleteSelected: () => changeStatusMutation.mutate('مكتمل'), 
        handleSuspendSelected: () => changeStatusMutation.mutate('موقوف'), 
        handleDeleteSelected: () => {
            const completed = baseJobOrders.filter((o:any) => selectedIds.includes(String(o.id)) && o.status === 'مكتمل');
            if (completed.length > 0) {
                return showToast("لا يمكن حذف أوامر تشغيل مكتملة.", "error");
            }
            if (!selectedIds.length || !confirm("هل أنت متأكد من الحذف النهائي لأوامر التشغيل المحددة؟")) return;
            deleteMutation.mutate();
        }
    };
}
