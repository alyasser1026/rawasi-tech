"use client";
import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/lib/toast-context';
import { fetchPaginatedData } from '@/lib/supabase-pagination';
import * as XLSX from 'xlsx';

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
    const [isAddContractorModalOpen, setIsAddContractorModalOpen] = useState(false);
    const [selectedPrintClaim, setSelectedPrintClaim] = useState<any | null>(null);
    const [printAssignments, setPrintAssignments] = useState<any[]>([]); 
    const [printDeductions, setPrintDeductions] = useState<any[]>([]);

    const [projectJobOrders, setProjectJobOrders] = useState<any[]>([]);
    
    // 🚀 1. سحب اسم البند (work_item)
    const fetchProjectJobOrders = async (projectId: string) => {
        if (!projectId) { setProjectJobOrders([]); return; }
        const { data } = await supabase.from('job_orders')
            .select('*, boq_budget:boq_budget_id(unit, work_item)') 
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
                .select('*, projects:project_id(Property)')
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
            showToast("يرجى تحديد أعمال (جاري التنفيذ) ولم تصدر لها مستخلصات بعد.", "error");
            return;
        }

        const projectIds = Array.from(new Set(selectedObjects.map((a: any) => a.project_id).filter(Boolean)));
        const jobOrderIds = selectedObjects.map((a: any) => a.job_order_id).filter(Boolean);
        
        const totalGross = selectedObjects.reduce((sum, a) => sum + Number(a.gross_total_amount || 0), 0);
        const totalMatDed = selectedObjects.reduce((sum, a) => sum + Number(a.materials_deduction || 0), 0);
        const totalExpDed = selectedObjects.reduce((sum, a) => sum + Number(a.expenses_deduction || 0), 0);

        setCurrentClaim({
            request_id: crypto.randomUUID(),
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
            if (claimData.id) throw new Error('هذه العملية لإنشاء مستخلص جديد؛ عالج المستخلص الحالي من سجل المستخلصات.');
            if (!selectedContractor) throw new Error("اختر مقاول الباطن أولاً!");
            if (!claimData.project_ids || claimData.project_ids.length === 0) {
                throw new Error("يرجى تحديد العقار / المشروع أولاً.");
            }

            const { data, error } = await supabase.rpc('create_and_post_sub_claim', {
                p_request_id: claimData.request_id,
                p_claim: {
                    contractor_id: selectedContractor.id, project_ids: claimData.project_ids,
                    project_names_text: claimData.project_names_text, date: claimData.date,
                    total_amount: claimData.total_amount, retention_amount: claimData.retention_amount,
                    advance_payment: claimData.advance_payment || 0, materials_deduction: claimData.materials_deduction || 0,
                    other_deductions: claimData.other_deductions || 0, net_amount: claimData.net_amount,
                    payment_period_days: claimData.payment_period_days || 14
                },
                p_assignment_ids: claimData.assignments_data?.map((a: any) => a.assignment_id || a.id) || [],
                p_material_ids: claimData.material_ids || [],
                p_expense_ids: claimData.expense_ids || []
            });
            if (error) throw new Error(error.message);
            return { id: data };
        },
        onSuccess: () => {
            showToast("تم اعتماد المستخلص وترحيله بنجاح", "success");
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

            if (!payload.job_order_id) throw new Error('يرجى اختيار أمر التشغيل.');
            if (!(payload.assigned_qty > 0) || !(payload.unit_price > 0)) throw new Error('الكمية والسعر يجب أن يكونا أكبر من الصفر.');

            // 🛡️ منع إسناد نفس أمر التشغيل مرتين (يسبب تكرار القيمة وتكرار خصومات الخامات)
            const { data: existing, error: existErr } = await supabase.from('contractor_assignments')
                .select('id').eq('job_order_id', payload.job_order_id);
            if (existErr) throw new Error(existErr.message);
            if ((existing || []).some((x: any) => x.id !== record.id)) {
                throw new Error('أمر التشغيل ده مُسند بالفعل. عدّل الإسناد الحالي بدل إضافة إسناد جديد.');
            }

            if (record.id) {
                const { error } = await supabase.from('contractor_assignments').update(payload).eq('id', record.id);
                if (error) throw new Error(error.message);
            } else {
                const { error } = await supabase.from('contractor_assignments').insert([payload]);
                if (error) throw new Error(error.message); 
            }

            // تحديث أمر التشغيل بعد نجاح الحفظ فقط
            const { error: joErr } = await supabase.from('job_orders')
                .update({ executor_type: 'مقاول باطن', contractor_id: selectedContractor?.id })
                .eq('id', record.job_order_id);
            if (joErr) throw new Error(joErr.message);
        },
        onError: (err: any) => {
            showToast(`تعذر الإسناد: ${err.message}`, "error");
        },
        onSuccess: () => {
            showToast("تم إسناد أمر التشغيل للمقاول بنجاح", "success");
            setIsAssignModalOpen(false);
            setAssignRecord({ assigned_qty: 1, unit_price: 0 });
            setProjectJobOrders([]);
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
            showToast("تم إلغاء التكليف وإرجاع أمر التشغيل بنجاح", "success");
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
        mutationFn: async ({ action, id }: { action: string, id: string }) => {
            if (action === 'delete') {
                const { data: existing } = await supabase.from('sub_claims').select('status, is_posted').eq('id', id).single();
                if (existing && (['posted', 'مرحل', 'معتمد'].includes(existing.status) || existing.is_posted)) {
                    throw new Error("لا يمكن حذف مستخلص معتمد. يرجى فك الترحيل أولاً.");
                }
            }
            let rpcName = '';
            if (action === 'post') rpcName = 'post_sub_claim';
            if (action === 'unpost') rpcName = 'rpc_unpost_claim';
            if (action === 'delete') rpcName = 'rpc_delete_claim';
            if (!rpcName) throw new Error('إجراء المستخلص غير معروف.');

            const { error } = await supabase.rpc(rpcName, { p_id: id });
            if (error) throw new Error(error.message);
        },
        onSuccess: (_, variables) => {
            let msg = "تم الترحيل بنجاح";
            if (variables.action === 'unpost') msg = "تم فك الترحيل مع الاحتفاظ بسندات الصرف والأعمال المرتبطة";
            if (variables.action === 'delete') msg = "تم حذف المستخلص وارجاع الأعمال بنجاح";
            showToast(msg, "success");
            
            queryClient.invalidateQueries({ queryKey: ['contractor_claims_history'] });
            queryClient.invalidateQueries({ queryKey: ['contractor_tasks', selectedContractor?.id] });
            
            if (variables.action === 'delete') {
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

        const { data: materials } = await supabase.from('material_issue_lines').select('*, material_issues:issue_id(issue_date)').eq('claim_id', claim.id);
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
        const { data: accountRows, error: accountsError } = await supabase.from('accounts').select('id,code,name').in('code', ['212', '1291']);
        if (accountsError) { setIsBalanceLoading(false); showToast(accountsError.message, 'error'); return; }
        const debitAccount = accountRows?.find(a => a.code === '212');
        const creditAccount = accountRows?.find(a => a.code === '1291');
        if (!debitAccount || !creditAccount) { setIsBalanceLoading(false); showToast('راجع حساب التزام المقاولين وحساب الصرف في الدليل.', 'error'); return; }

        setPaymentRecord({
            request_id: crypto.randomUUID(),
            date: new Date().toISOString().split('T')[0],
            amount: remainingAmount > 0 ? remainingAmount : 0,
            payee_id: selectedContractor?.id,
            payee_name: selectedContractor?.name,
            debit_account_id: debitAccount.id,
            debit_account_name: debitAccount.name,
            credit_account_id: creditAccount.id,
            credit_account_name: creditAccount.name,
            
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
            const { error } = await supabase.rpc('pay_sub_claim', {
                p_request_id: record.request_id,
                p_claim_id: record.linked_claim_id,
                p_payment: {
                    date: record.date, amount: record.amount, partner_id: record.payee_id,
                    payment_method: record.payment_method, site_ref: record.site_ref,
                    description: record.description, debit_account_id: record.debit_account_id,
                    credit_account_id: record.credit_account_id,
                    notes: record.notes || ''
                }
            });
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            showToast("تم إنشاء السند وترحيله بنجاح", "success");
            setIsPaymentModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['contractor_claims_history'] });
        },
        onError: (err: any) => {
            showToast(`حدث خطأ أثناء الصرف: ${err.message}`, "error");
        }
    });

    // ➕ إضافة مقاول جديد
    const addContractorMutation = useMutation({
        mutationFn: async (contractorData: any) => {
            if (!contractorData.name || !contractorData.name.trim()) {
                throw new Error('يرجى إدخال اسم المقاول.');
            }
            let code = contractorData.code?.trim();
            if (!code) {
                const timePart = Date.now().toString().slice(-4);
                code = `SUB-${timePart}`;
            }
            const payload = {
                name: contractorData.name.trim(),
                code,
                partner_type: 'مقاول',
                job_role: contractorData.job_role?.trim() || 'مقاول باطن',
                phone: contractorData.phone?.trim() || null,
                identity_number: contractorData.identity_number?.trim() || null,
                address: contractorData.address?.trim() || null,
                is_active: true
            };
            const { data, error } = await supabase.from('partners').insert([payload]).select().single();
            if (error) throw error;
            return data;
        },
        onSuccess: (newPartner) => {
            showToast('تمت إضافة المقاول بنجاح', 'success');
            setIsAddContractorModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['sub_contractors_list'] });
            queryClient.invalidateQueries({ queryKey: ['partners'] });
            if (newPartner) {
                setSelectedContractor(newPartner);
            }
        },
        onError: (err: any) => {
            showToast(`فشل إضافة المقاول: ${err.message}`, 'error');
        }
    });

    // 💸 فتح سند صرف مباشر للمقاول
    const handleOpenDirectPayment = async () => {
        if (!selectedContractor) {
            showToast('اختر المقاول أولاً لفتح سند الصرف', 'error');
            return;
        }
        setIsBalanceLoading(true);

        const remainingClaims = (claimsHistory || []).reduce((acc: number, c: any) => {
            const net = Number(c.net_amount || 0);
            const paid = Number(c.paid_amount || 0);
            return acc + Math.max(0, net - paid);
        }, 0);
        setPartnerBalance(remainingClaims);

        const { data: accountRows } = await supabase
            .from('accounts')
            .select('id,code,name')
            .in('code', ['212', '122', '121', '1291']);

        const debitAccount = accountRows?.find(a => a.code === '212');
        const creditAccount = accountRows?.find(a => a.code === '122') || accountRows?.find(a => a.code === '121') || accountRows?.find(a => a.code === '1291');

        setPaymentRecord({
            request_id: crypto.randomUUID(),
            date: new Date().toISOString().split('T')[0],
            amount: remainingClaims > 0 ? remainingClaims : '',
            payee_id: selectedContractor.id,
            payee_name: selectedContractor.name,
            debit_account_id: debitAccount?.id || null,
            debit_account_name: debitAccount?.name || 'التزام مقاولي الباطن',
            credit_account_id: creditAccount?.id || null,
            credit_account_name: creditAccount?.name || 'الخزينة الرئيسية',
            project_ids: [],
            site_ref: '',
            description: `سند صرف / سداد دفعة للمقاول: ${selectedContractor.name}`,
            payment_method: 'نقدي',
            status: 'مسودة',
            is_posted: false
        });

        setIsBalanceLoading(false);
        setIsPaymentModalOpen(true);
    };

    // 📊 تصدير Excel
    const exportContractorsExcel = () => {
        if (!contractors || contractors.length === 0) {
            showToast('لا توجد بيانات مقاولين للتصدير', 'error');
            return;
        }
        const wb = XLSX.utils.book_new();
        const rows = (contractors || []).map((c: any, idx: number) => ({
            'م': idx + 1,
            'كود المقاول': c.code || '—',
            'اسم المقاول': c.name,
            'التخصص / المهنة': c.job_role || 'مقاول باطن',
            'رقم الهاتف': c.phone || '—',
            'رقم الهوية / السجل': c.identity_number || '—',
            'العنوان': c.address || '—',
            'الحالة': c.is_active ? 'نشط' : 'معطل'
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 25 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, ws, 'المقاولين');
        XLSX.writeFile(wb, `Phi_Contractors_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('تم تصدير ملف المقاولين بنجاح', 'success');
    };

    const exportAssignmentsExcel = () => {
        if (!assignments || assignments.length === 0) {
            showToast('لا توجد أعمال جارية للتصدير', 'error');
            return;
        }
        const wb = XLSX.utils.book_new();
        const rows = (assignments || []).map((a: any, idx: number) => ({
            'م': idx + 1,
            'أمر التشغيل': a.order_number || '—',
            'المشروع / العقار': a.projects?.Property || '—',
            'بند الأعمال': a.boq_item_name || '—',
            'الكمية': a.executed_qty || a.assigned_qty || 0,
            'سعر الوحدة': a.unit_price || 0,
            'إجمالي الأعمال': a.gross_total_amount || 0,
            'خصم خامات': a.materials_deduction || 0,
            'خصم نثريات': a.expenses_deduction || 0,
            'الصافي المستحق': a.net_before_financial_deductions || 0,
            'الحالة': a.assignment_status || 'جاري التنفيذ'
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'الأعمال المسندة');
        XLSX.writeFile(wb, `Contractor_${selectedContractor?.name || 'Assignments'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('تم تصدير جدول الأعمال بنجاح', 'success');
    };

    const exportClaimsExcel = () => {
        if (!claimsHistory || claimsHistory.length === 0) {
            showToast('لا توجد مستخلصات للتصدير', 'error');
            return;
        }
        const wb = XLSX.utils.book_new();
        const rows = (claimsHistory || []).map((c: any, idx: number) => ({
            'م': idx + 1,
            'رقم المستخلص': c.claim_number || '—',
            'التاريخ': c.date || '—',
            'المشروع / العقارات': c.project_names_text || c.projects?.Property || 'مجمع مشاريع',
            'الإجمالي قبل الخصم': Number(c.total_amount || 0),
            'خصم خامات': Number(c.materials_deduction || 0),
            'خصومات أخرى': Number(c.other_deductions || 0),
            'الدفعة المقدمة': Number(c.advance_payment || 0),
            'ضمان الأعمال': Number(c.retention_amount || 0),
            'الصافي للصرف': Number(c.net_amount || 0),
            'المسدد': Number(c.paid_amount || 0),
            'المتبقي': Math.max(0, Number(c.net_amount || 0) - Number(c.paid_amount || 0)),
            'الحالة': c.is_posted ? 'معتمد' : 'مسودة'
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'سجل المستخلصات');
        XLSX.writeFile(wb, `Contractor_${selectedContractor?.name || 'Claims'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('تم تصدير سجل المستخلصات بنجاح', 'success');
    };

    // 🔄 تحديث شامل
    const refetchAll = () => {
        queryClient.invalidateQueries({ queryKey: ['sub_contractors_list'] });
        if (selectedContractor?.id) {
            queryClient.invalidateQueries({ queryKey: ['contractor_tasks', selectedContractor.id] });
            queryClient.invalidateQueries({ queryKey: ['contractor_claims_history', selectedContractor.id] });
        }
        showToast('تم تحديث البيانات لحظياً', 'info');
    };

    // 📈 إحصائيات سريعة للـ KPIs
    const stats = useMemo(() => {
        const totalContractors = contractors.length;
        const totalAssignmentsCount = assignments.length;
        const activeAssignmentsCount = assignments.filter((a: any) => a.assignment_status !== 'مفوتر').length;
        const completedAssignmentsCount = assignments.filter((a: any) => a.assignment_status === 'مفوتر').length;

        const totalGrossValue = assignments.reduce((s: number, a: any) => s + Number(a.gross_total_amount || 0), 0);
        const totalMatDed = assignments.reduce((s: number, a: any) => s + Number(a.materials_deduction || 0), 0);
        const totalExpDed = assignments.reduce((s: number, a: any) => s + Number(a.expenses_deduction || 0), 0);
        const totalNetAssignments = assignments.reduce((s: number, a: any) => s + Number(a.net_before_financial_deductions || 0), 0);

        const totalClaimsCount = claimsHistory.length;
        const totalClaimsNet = claimsHistory.reduce((s: number, c: any) => s + Number(c.net_amount || 0), 0);
        const totalClaimsPaid = claimsHistory.reduce((s: number, c: any) => s + Number(c.paid_amount || 0), 0);
        const totalClaimsRemaining = Math.max(0, totalClaimsNet - totalClaimsPaid);

        return {
            totalContractors,
            totalAssignmentsCount,
            activeAssignmentsCount,
            completedAssignmentsCount,
            totalGrossValue,
            totalMatDed,
            totalExpDed,
            totalNetAssignments,
            totalClaimsCount,
            totalClaimsNet,
            totalClaimsPaid,
            totalClaimsRemaining
        };
    }, [contractors, assignments, claimsHistory]);

    return {
        contractors: filteredContractors, searchTerm, setSearchTerm,
        isAddContractorModalOpen, setIsAddContractorModalOpen,
        handleSaveNewContractor: (data: any) => addContractorMutation.mutate(data),
        isAddingContractor: addContractorMutation.isPending,
        handleOpenDirectPayment,
        exportContractorsExcel, exportAssignmentsExcel, exportClaimsExcel,
        refetchAll,
        stats,       
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
