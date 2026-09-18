"use client";
import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/lib/toast-context';
import { fetchPaginatedData } from '@/lib/supabase-pagination';

export function useSubClaimsLogic() {
    const { showToast } = useToast();
    const queryClient = useQueryClient();

    const [selectedContractor, setSelectedContractor] = useState<any | null>(null);
    const [selectedAssignments, setSelectedAssignments] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [activeTab, setActiveTab] = useState<'assignments' | 'history'>('assignments');

    const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
    const [currentClaim, setCurrentClaim] = useState<any>({
        date: new Date().toISOString().split('T')[0],
        retention_percent: 5,
        tax_percent: 15,
        payment_period_days: 14,
        deductions: []
    });

    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignRecord, setAssignRecord] = useState<any>({ assigned_qty: 1, unit_price: 0 });

    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [selectedPrintClaim, setSelectedPrintClaim] = useState<any | null>(null);
    const [printAssignments, setPrintAssignments] = useState<any[]>([]); 
    const [printDeductions, setPrintDeductions] = useState<any[]>([]);

    const [projectJobOrders, setProjectJobOrders] = useState<any[]>([]);
    
    // 🚀 1. سحب اسم البند (work_item)
    const fetchProjectJobOrders = async (projectId: string) => {
        if (!projectId) { setProjectJobOrders([]); return; }
        const { data } = await supabase.from('job_orders')
            .select('*, boq_budget(unit, work_item)') 
            .eq('project_id', projectId)
            .is('contractor_id', null); 
        setProjectJobOrders(data || []);
    };

    const { data: contractors = [], isLoading } = useQuery({
        queryKey: ['sub_contractors_list'],
        queryFn: async () => {
            const buildQuery = () => supabase.from('partners').select('*').eq('partner_type', 'مقاول');
            const data = await fetchPaginatedData(buildQuery, 'id');
            return data || [];
        }
    });

    const filteredContractors = useMemo(() => {
        if (!searchTerm) return contractors || [];
        return (contractors || []).filter((c: any) => 
            c.name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [contractors, searchTerm]);

    const { data: assignments = [], isLoading: isAssignLoading } = useQuery({
        queryKey: ['contractor_tasks', selectedContractor?.id],
        enabled: !!selectedContractor,
        queryFn: async () => {
            const buildQuery = () => supabase.from('subcontractor_claim_engine_view')
                .select('*, projects:project_id(Property)')
                .eq('contractor_id', selectedContractor.id);
                
            const data = await fetchPaginatedData(buildQuery, 'assignment_id');
            
            return (data || []).map((item: any) => ({
                ...item,
                // 🚀 تحديد الحالة بذكاء بناءً على وجود رقم مستخلص من عدمه
                assignment_status: item.claim_id ? 'مفوتر' : 'جاري التنفيذ', 
                total_materials: Number(item.materials_deduction || 0),
                total_expenses: Number(item.expenses_deduction || 0),
                executed_qty: Number(item.executed_qty || 0),
                assigned_qty: Number(item.assigned_qty || 0),
                unit_price: Number(item.contract_unit_price || 0),
                gross_total_amount: Number(item.gross_total_amount || 0),
                materials_deduction: Number(item.materials_deduction || 0),
                expenses_deduction: Number(item.expenses_deduction || 0),
                net_before_financial_deductions: Number(item.net_before_financial_deductions || 0)
            }));
        }
    });

    const { data: claimsHistory = [], isLoading: isHistoryLoading } = useQuery({
        queryKey: ['contractor_claims_history', selectedContractor?.id],
        enabled: !!selectedContractor,
        queryFn: async () => {
            const buildQuery = () => supabase.from('sub_claims')
                .select('*, projects(Property)')
                .eq('contractor_id', selectedContractor.id)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });
            
            const data = await fetchPaginatedData(buildQuery, 'id');

            return (data || []).map((claim: any) => {
                const net = Number(claim.net_amount || 0);
                const paid = Number(claim.paid_amount || 0);
                
                let pStatus = { label: 'غير مسدد', color: '#ef4444', bg: '#fef2f2' };
                if (paid > 0 && paid < net) {
                    pStatus = { label: 'مسدد جزئي', color: '#f59e0b', bg: '#fffbeb' };
                } else if (paid >= net && net > 0) {
                    pStatus = { label: 'مسدد بالكامل', color: '#16a34a', bg: '#f0fdf4' };
                }

                return { ...claim, pStatus };
            });
        }
    });

    const handleOpenClaimModal = () => {
        // 🚀 تصفية ذكية: منع عمل مستخلص لمهام مفوترة بالفعل
        const selectedObjects = (assignments || []).filter((a: any) => 
            (selectedAssignments.includes(a.assignment_id) || selectedAssignments.includes(a.id)) && !a.claim_id
        );

        if (selectedObjects.length === 0) {
            showToast("⚠️ يرجى تحديد أعمال (جاري التنفيذ) ولم تصدر لها مستخلصات بعد.", "error");
            return;
        }

        const projectIds = Array.from(new Set(selectedObjects.map((a: any) => a.project_id).filter(Boolean)));
        const jobOrderIds = selectedObjects.map((a: any) => a.job_order_id).filter(Boolean);
        
        const totalGross = selectedObjects.reduce((sum, a) => sum + Number(a.gross_total_amount || 0), 0);
        const totalMatDed = selectedObjects.reduce((sum, a) => sum + Number(a.materials_deduction || 0), 0);
        const totalExpDed = selectedObjects.reduce((sum, a) => sum + Number(a.expenses_deduction || 0), 0);

        setCurrentClaim({
            date: new Date().toISOString().split('T')[0],
            retention_percent: 5,
            tax_percent: 15,
            payment_period_days: 14,
            project_ids: projectIds, 
            job_order_ids: jobOrderIds, 
            
            total_amount: totalGross,
            materials_deduction: totalMatDed,
            other_deductions: totalExpDed,
            advance_payment: 0,
            
            assignments_data: selectedObjects 
        });

        setIsClaimModalOpen(true);
    };

    const saveClaimMutation = useMutation({
        mutationFn: async (claimData: any) => {
            if (claimData.id) {
                const { data: existing } = await supabase.from('sub_claims').select('status, is_posted').eq('id', claimData.id).single();
                if (existing && (existing.status === 'مرحل' || existing.status === 'معتمد' || existing.is_posted)) {
                    throw new Error("لا يمكن تعديل مستخلص معتمد. يرجى فك الترحيل أولاً.");
                }
            }
            if (!selectedContractor) throw new Error("اختر مقاول الباطن أولاً!");
            if (!claimData.project_ids || claimData.project_ids.length === 0) {
                throw new Error("يرجى تحديد العقار / المشروع أولاً.");
            }

            const { data: claim, error } = await supabase.from('sub_claims').insert([{
                claim_number: `CLM-${Date.now().toString().slice(-6)}`,
                contractor_id: selectedContractor.id,
                project_id: claimData.project_ids[0],             
                project_ids: claimData.project_ids,               
                project_names_text: claimData.project_names_text, 
                date: claimData.date,
                payment_period_days: claimData.payment_period_days || 14,
                total_amount: claimData.total_amount, 
                retention_amount: claimData.retention_amount,
                advance_payment: claimData.advance_payment || 0,
                materials_deduction: claimData.materials_deduction || 0,
                other_deductions: claimData.other_deductions || 0,
                net_amount: claimData.net_amount,
                is_posted: false,
                status: 'مسودة',
                paid_amount: 0 
            }]).select().single();

            if (error) throw new Error(error.message);

            const assignmentIds = claimData.assignments_data?.map((a:any) => a.assignment_id || a.id) || [];
            if (assignmentIds.length > 0) {
                await supabase.from('contractor_assignments')
                    .update({ status: 'مفوتر', claim_id: claim.id })
                    .in('id', assignmentIds);
            }

            if (claimData.material_ids && claimData.material_ids.length > 0) {
                await supabase.from('material_issue_lines')
                    .update({ claim_id: claim.id })
                    .in('id', claimData.material_ids);
            }

            if (claimData.expense_ids && claimData.expense_ids.length > 0) {
                await supabase.from('expenses')
                    .update({ claim_id: claim.id, is_deducted_in_claim: true })
                    .in('id', claimData.expense_ids);
            }

            const { error: rpcError } = await supabase.rpc('post_sub_claim', { p_id: claim.id });
            if (rpcError) throw new Error(rpcError.message);

            return claim;
        },
        onSuccess: () => {
            showToast("تم اعتماد المستخلص وترحيله بنجاح 🚀", "success");
            setIsClaimModalOpen(false);
            setSelectedAssignments([]);
            queryClient.invalidateQueries({ queryKey: ['contractor_tasks'] });
            queryClient.invalidateQueries({ queryKey: ['contractor_claims_history'] }); 
            setActiveTab('history'); 
        },
        onError: (err: any) => {
            showToast(`خطأ في الحفظ: ${err.message}`, "error");
        }
    });

    const assignWorkMutation = useMutation({
        mutationFn: async (record: any) => {
            const payload = {
                contractor_id: selectedContractor?.id,
                project_id: record.project_id,
                job_order_id: record.job_order_id, 
                boq_budget_id: record.boq_budget_id, 
                assigned_qty: Number(record.assigned_qty),
                unit_price: Number(record.unit_price),
                status: 'جاري التنفيذ'
            };

            await supabase.from('job_orders')
                .update({ executor_type: 'مقاول باطن', contractor_id: selectedContractor?.id })
                .eq('id', record.job_order_id);

            if (record.id) {
                const { error } = await supabase.from('contractor_assignments').update(payload).eq('id', record.id);
                if (error) throw new Error(error.message);
            } else {
                const { error } = await supabase.from('contractor_assignments').insert([payload]);
                if (error) throw new Error(error.message); 
            }
        },
        onSuccess: () => {
            showToast("تم إسناد أمر التشغيل للمقاول بنجاح 👷✅", "success");
            setIsAssignModalOpen(false);
            setAssignRecord({ assigned_qty: 1, unit_price: 0 });
            queryClient.invalidateQueries({ queryKey: ['contractor_tasks', selectedContractor?.id] });
        }
    });

    const deleteAssignmentMutation = useMutation({
        mutationFn: async (id: string) => {
            const { data: assignment } = await supabase.from('contractor_assignments').select('job_order_id').eq('id', id).single();
            
            const { error } = await supabase.from('contractor_assignments').delete().eq('id', id);
            if (error) throw new Error(error.message);

            if(assignment?.job_order_id) {
                 await supabase.from('job_orders')
                    .update({ executor_type: 'تنفيذ ذاتي', contractor_id: null })
                    .eq('id', assignment.job_order_id);
            }
        },
        onSuccess: () => {
            showToast("تم إلغاء التكليف وإرجاع أمر التشغيل بنجاح 🗑️", "success");
            queryClient.invalidateQueries({ queryKey: ['contractor_tasks', selectedContractor?.id] });
        }
    });

    const handleEditAssignment = (assignmentRow: any) => {
        setAssignRecord({
            id: assignmentRow.assignment_id || assignmentRow.id,
            project_id: assignmentRow.project_id,
            job_order_id: assignmentRow.job_order_id,
            boq_budget_id: assignmentRow.boq_budget_id,
            assigned_qty: assignmentRow.executed_qty || assignmentRow.assigned_qty,
            unit_price: assignmentRow.contract_unit_price || assignmentRow.unit_price
        });
        setIsAssignModalOpen(true);
    };

    const actionMutation = useMutation({
        mutationFn: async ({ action, id, claimNumber }: { action: string, id: string, claimNumber?: string }) => {
            if (action === 'delete') {
                const { data: existing } = await supabase.from('sub_claims').select('status, is_posted').eq('id', id).single();
                if (existing && (existing.status === 'مرحل' || existing.status === 'معتمد' || existing.is_posted)) {
                    throw new Error("لا يمكن حذف مستخلص معتمد. يرجى فك الترحيل أولاً.");
                }
            }
            let rpcName = '';
            if (action === 'post') rpcName = 'post_sub_claim';
            if (action === 'unpost') rpcName = 'rpc_unpost_claim';
            if (action === 'delete') rpcName = 'rpc_delete_claim';

            if (action === 'unpost' || action === 'delete') {
                if (action === 'unpost') {
                    const { error: updateError } = await supabase.from('sub_claims')
                        .update({ paid_amount: 0, status: 'مسودة', is_posted: false })
                        .eq('id', id);
                    if (updateError) throw new Error(updateError.message);
                }

                if (claimNumber) {
                    const { data: vouchers } = await supabase.from('payment_vouchers')
                        .select('id')
                        .ilike('description', `%${claimNumber}%`);
                        
                    if (vouchers && vouchers.length > 0) {
                        const vIds = vouchers.map(v => v.id);
                        await supabase.rpc('unpost_payment_vouchers_bulk', { p_ids: vIds });
                        await supabase.from('payment_vouchers').delete().in('id', vIds);
                    }
                }

                await supabase.from('contractor_assignments')
                    .update({ status: 'جاري التنفيذ', claim_id: null })
                    .eq('claim_id', id);

                await supabase.from('material_issue_lines')
                    .update({ claim_id: null })
                    .eq('claim_id', id);

                await supabase.from('expenses')
                    .update({ claim_id: null, is_deducted_in_claim: false })
                    .eq('claim_id', id);
            }

            const { error } = await supabase.rpc(rpcName, { p_id: id });
            if (error) throw new Error(error.message);
        },
        onSuccess: (_, variables) => {
            let msg = "تم الترحيل بنجاح 🚀";
            if (variables.action === 'unpost') msg = "تم فك الترحيل ومسح سندات الصرف بنجاح 🔓";
            if (variables.action === 'delete') msg = "تم حذف المستخلص وارجاع الأعمال بنجاح 🗑️";
            showToast(msg, "success");
            
            queryClient.invalidateQueries({ queryKey: ['contractor_claims_history'] });
            queryClient.invalidateQueries({ queryKey: ['contractor_tasks', selectedContractor?.id] });
            
            if (variables.action === 'delete' || variables.action === 'unpost') {
                setActiveTab('assignments'); 
            }
        },
        onError: (err: any) => {
            showToast(`فشلت العملية: ${err.message}`, "error");
        }
    });

    const handlePreparePrint = async (claim: any) => {
        setSelectedPrintClaim(claim);
        
        const { data: assignmentsData } = await supabase
            .from('contractor_assignments')
            .select(`*, projects!contractor_assignments_project_id_fkey (Property), boq_budget:boq_budget_id (work_item, unit)`)
            .eq('claim_id', claim.id);
        
        if (assignmentsData) setPrintAssignments(assignmentsData);

        const { data: expenses } = await supabase.from('expenses').select('*').eq('claim_id', claim.id);
        const validExpenses = (expenses || []).map(e => ({
            type: 'expense', date: e.expense_date || e.created_at, statement: e.notes || 'مصروف محمل', amount: e.amount || e.total_price || 0
        }));

        const { data: materials } = await supabase.from('material_issue_lines').select('*, material_issues(issue_date)').eq('claim_id', claim.id);
        const validMaterials = (materials || []).map(m => ({
            type: 'material', date: m.material_issues?.issue_date, statement: `خامة: ${m.item_name} (${m.quantity} ${m.unit})`, amount: m.total_price || 0
        }));

        setPrintDeductions([...validExpenses, ...validMaterials]);
        setIsPrintModalOpen(true);
    };

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentRecord, setPaymentRecord] = useState<any>(null);
    const [partnerBalance, setPartnerBalance] = useState(0);
    const [isBalanceLoading, setIsBalanceLoading] = useState(false);

    const handleOpenPayment = async (claimRow: any) => {
        setIsBalanceLoading(true);
        const remainingAmount = Number(claimRow.net_amount || 0) - Number(claimRow.paid_amount || 0);
        setPartnerBalance(remainingAmount > 0 ? remainingAmount : 0); 
        
        const allProjectIds = claimRow.project_ids || (claimRow.project_id ? [claimRow.project_id] : []);

        setPaymentRecord({
            date: new Date().toISOString().split('T')[0],
            amount: remainingAmount > 0 ? remainingAmount : 0,
            payee_id: selectedContractor?.id,
            payee_name: selectedContractor?.name,
            debit_account_id: '27f37adf-c0ec-4b40-80d0-2b36b853fd4b', 
            debit_account_name: 'التزام مقاولي الباطن',
            credit_account_id: '21b8a1db-bc9f-4cf8-b741-1efeded0963c', 
            credit_account_name: 'الخزينة الرئيسية',
            
            project_ids: allProjectIds,
            
            site_ref: claimRow.project_names_text || claimRow.projects?.Property || 'مجمع مشاريع',
            description: `سداد قيمة مستخلص مقاول باطن رقم ${claimRow.claim_number} - ${selectedContractor?.name}`,
            payment_method: 'نقدي',
            linked_claim_id: claimRow.id 
        });
        
        setIsBalanceLoading(false);
        setIsPaymentModalOpen(true);
    };

    const paymentMutation = useMutation({
        mutationFn: async (record: any) => {
            const voucherPayload = {
                voucher_number: `PV-${Date.now().toString().slice(-6)}`, 
                date: record.date,
                amount: record.amount,
                partner_id: record.payee_id, 
                payment_method: record.payment_method,
                project_ids: record.project_ids,
                site_ref: record.site_ref,
                description: record.description,
                status: 'مسودة',
                debit_account_id: record.debit_account_id,
                credit_account_id: record.credit_account_id,
                notes: `حساب المدين: ${record.debit_account_name} | حساب الدائن: ${record.credit_account_name}`,
                sub_claim_id: record.linked_claim_id 
            };

            const { data: voucher, error: voucherError } = await supabase
                .from('payment_vouchers')
                .insert([voucherPayload])
                .select('id')
                .single();

            if (voucherError) throw new Error(voucherError.message);

            const { error: postError } = await supabase.rpc('post_payment_vouchers_bulk', { p_ids: [voucher.id] });
            if (postError) throw new Error(`تم الحفظ ولكن فشل الترحيل المحاسبي: ${postError.message}`);

            if (record.linked_claim_id) {
                const { data: currentClaim, error: fetchError } = await supabase
                    .from('sub_claims')
                    .select('paid_amount, net_amount')
                    .eq('id', record.linked_claim_id)
                    .single();

                if (fetchError) throw new Error(fetchError.message);

                const newPaidTotal = Number(currentClaim?.paid_amount || 0) + Number(record.amount);
                const isFullyPaid = newPaidTotal >= Number(currentClaim?.net_amount || 0);

                const { error: claimError } = await supabase.from('sub_claims')
                    .update({ 
                        paid_amount: newPaidTotal,
                        status: isFullyPaid ? 'مدفوع' : 'مسدد جزئي' 
                    })
                    .eq('id', record.linked_claim_id);

                if (claimError) throw new Error(claimError.message);
            }
        },
        onSuccess: () => {
            showToast("تم إنشاء السند وترحيله بنجاح ✅", "success");
            setIsPaymentModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['contractor_claims_history'] });
        },
        onError: (err: any) => {
            showToast(`حدث خطأ أثناء الصرف: ${err.message}`, "error");
        }
    });

    return {
        contractors: filteredContractors, searchTerm, setSearchTerm,       
        isLoading, selectedContractor, setSelectedContractor,
        activeTab, setActiveTab, 
        assignments, isAssignLoading, selectedAssignments, setSelectedAssignments,
        claimsHistory, isHistoryLoading, actionMutation,
        isClaimModalOpen, setIsClaimModalOpen, currentClaim, setCurrentClaim,
        isPrintModalOpen, setIsPrintModalOpen, 
        selectedPrintClaim, setSelectedPrintClaim,
        printAssignments, 
        printDeductions, 
        handlePreparePrint, 
        
        handleOpenClaimModal, 

        handleSaveClaim: (data: any) => saveClaimMutation.mutate(data),
        isClaimSaving: saveClaimMutation.isPending, 
        isAssignModalOpen, setIsAssignModalOpen,
        assignRecord, setAssignRecord,
        handleAssignWork: (data: any) => assignWorkMutation.mutate(data),
        isAssigning: assignWorkMutation.isPending,
        handleEditAssignment, 
        deleteAssignment: (id: string) => deleteAssignmentMutation.mutate(id),
        
        projectJobOrders, fetchProjectJobOrders,

        isPaymentModalOpen, setIsPaymentModalOpen,
        paymentRecord, setPaymentRecord,
        partnerBalance, isBalanceLoading,
        handleOpenPayment,
        handleSavePayment: (data: any) => paymentMutation.mutate(data),
        isSavingPayment: paymentMutation.isPending
    };
}