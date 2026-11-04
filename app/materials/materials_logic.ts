"use client";
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/lib/toast-context';
import { usePermissions } from '@/lib/PermissionsContext';
import { fetchPaginatedData } from '@/lib/supabase-pagination';

// 🚀 1. الحساسية القصوى لتنظيف الـ IDs
const cleanId = (val: any) => {
    if (!val) return null;
    if (typeof val === 'object') return val.id ? String(val.id).trim() : null;
    const str = String(val).trim();
    return str === '' || str === 'undefined' || str === 'null' ? null : str;
};

// 🚀 2. الحساسية القصوى للأرقام
const cleanNum = (val: any, fallback = 0) => {
    const num = Number(val);
    return isNaN(num) ? fallback : num;
};

export function useMaterialsLogic() {
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { can } = usePermissions();

    const [globalSearch, setGlobalSearch] = useState('');
    const [filterProject, setFilterProject] = useState('الكل');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState('newest');

    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [printReceiptId, setPrintReceiptId] = useState<string | null>(null);

    const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
    const [selectedInvoiceItem, setSelectedInvoiceItem] = useState<any>(null);

    const [selectedLineItems, setSelectedLineItems] = useState<any[]>([]);
    const [isBulkDispenseModalOpen, setIsBulkDispenseModalOpen] = useState(false);

    const handleToggleLineSelection = (lineItem: any) => {
        setSelectedLineItems(prev => {
            const exists = prev.find(p => p.id === lineItem.id);
            if (exists) return prev.filter(p => p.id !== lineItem.id);
            return [...prev, lineItem];
        });
    };

    const clearLineSelection = () => setSelectedLineItems([]);

    const bulkDispenseMutation = useMutation({
        mutationFn: async (payload: any) => {
            const safeProjectId = cleanId(payload.project_id);
            if (!safeProjectId) throw new Error("المشروع الإلزامي غير محدد للصرف.");

            const issuePayload = {
                issue_number: `ISS-${Date.now().toString().slice(-6)}`,
                project_id: safeProjectId,
                subcontractor_id: payload.issue_type === 'صرف لمقاول' ? cleanId(payload.subcontractor_id) : null,
                issue_date: payload.issue_date || new Date().toISOString().split('T')[0],
                issue_type: payload.issue_type || 'استهلاك مباشر',
                total_amount: payload.items.reduce((sum: number, i: any) => sum + (cleanNum(i.dispense_qty) * cleanNum(i.unit_price)), 0),
                notes: payload.issue_type === 'صرف لمقاول' ? `صرف مجمع محمل على المقاول مباشر من المشتريات` : `صرف مجمع واستهلاك مباشر للشركة`,
                is_posted: false 
            };

            const { data: issueRecord, error: issueError } = await supabase
                .from('material_issues')
                .insert([issuePayload])
                .select('id').single(); 

            if (issueError) throw new Error(`خطأ في رأس الصرف: ${issueError.message}`);

            const linesPayload = payload.items.map((item: any) => ({
                issue_id: issueRecord.id,
                item_id: cleanId(item.item_id), 
                item_name: String(item.work_item || item.item_name || 'صنف غير معروف').trim(),
                quantity: cleanNum(item.dispense_qty, 1),
                unit: String(item.unit || 'وحدة').trim(),
                unit_price: cleanNum(item.unit_price),
                total_price: cleanNum(item.dispense_qty, 1) * cleanNum(item.unit_price),
                boq_id: cleanId(item.boq_id), 
                boq_item_id: cleanId(item.boq_item_id) 
            }));

            const { error: lineError } = await supabase.from('material_issue_lines').insert(linesPayload);
            if (lineError) throw new Error(`خطأ في سطور الصرف: ${lineError.message}`);
        },
        onSuccess: () => {
            showToast("تم حفظ إذن الصرف المجمع كمسودة بنجاح", "success");
            setIsBulkDispenseModalOpen(false);
            setSelectedLineItems([]); 
            queryClient.invalidateQueries({ queryKey: ['materials_logs'] });
            fetchInventoryBalances(); 
        },
        onError: (err: any) => showToast(`خطأ في الحفظ المجمع: ${err.message}`, "error")
    });

    const initialInvoiceState = {
        id: null, 
        project_id: '', project_name: '',
        payee_id: '', payee_name: '',
        account_id: '', account_name: '',
        receipt_type: 'توريد شركة',
        exp_date: new Date().toISOString().split('T')[0],
        notes: '',
        items: [
            { item_id: null, item_name: '', work_item: '', quantity: 1, unit: 'وحدة', unit_price: 0, total_price: 0, boq_id: null, boq_item_id: null, boq_item: '' }
        ]
    };
    const [invoiceData, setInvoiceData] = useState<any>(initialInvoiceState);

    const [inventoryBalances, setInventoryBalances] = useState<any[]>([]);

    const fetchInventoryBalances = async () => {
        try {
            const { data, error } = await supabase.rpc('rpc_get_inventory_balances');
            if (error) throw error;
            setInventoryBalances(data || []);
        } catch (err: any) {
            console.error("خطأ في جلب الأرصدة عبر RPC:", err.message);
        }
    };

    useEffect(() => {
        fetchInventoryBalances();
    }, []);

    const { data: allMaterials = [], isLoading } = useQuery({
        queryKey: ['materials_logs'],
        queryFn: async () => {
            const { data: balData } = await supabase.rpc('rpc_get_inventory_balances');
            const balances = balData || [];

            const buildQuery = () => supabase
                .from('material_receipt_lines')
                .select(`
                    id, 
                    receipt_id,
                    project_id,
                    item_id, 
                    item_name, 
                    quantity, 
                    unit, 
                    unit_price, 
                    total_price,
                    boq_id,
                    boq_item_id, 
                    boq:boq_budget(work_item), 
                    receipt:material_receipts (
                        id,
                        receipt_number,
                        receipt_date, 
                        notes, 
                        status, 
                        receipt_type, 
                        is_posted, 
                        jv_id, 
                        created_at,
                        project:projects(Property), 
                        supplier:partners(id, name), 
                        account:accounts(id, name)
                    )
                `)
                .order('created_at', { ascending: false });

            const allRecords = await fetchPaginatedData(buildQuery, 'id');

            return allRecords.map((line: any) => {
                const currentBalance = balances.find((inv: any) => 
                    (inv.item_id && line.item_id && inv.item_id === line.item_id) || 
                    (inv.item_name && line.item_name && inv.item_name.trim() === line.item_name.trim())
                );
                
                const globalBalance = currentBalance ? cleanNum(currentBalance.available_quantity) : 0;
                const finalSafeQty = Math.max(0, Math.min(cleanNum(line.quantity), globalBalance));

                const rec = Array.isArray(line.receipt) ? line.receipt[0] : line.receipt;
                const isStrictlyPosted = rec?.is_posted === true || String(rec?.is_posted).toLowerCase() === 'true' || rec?.is_posted === 1;

                return {
                    id: line.id,
                    receipt_id: line.receipt_id, // 🎯 رجعنا نسحب הـ ID صراحة عشان التجميع
                    receipt_no: rec?.receipt_number, 
                    item_id: line.item_id,
                    work_item: line.item_name,
                    item_name: line.item_name,
                    quantity: line.quantity,
                    available_qty: finalSafeQty, 
                    unit: line.unit,
                    unit_price: line.unit_price,
                    total_price: line.total_price,
                    boq_id: line.boq_id,
                    boq_item_id: line.boq_item_id, 
                    boq_item: line.boq?.work_item,   
                    exp_date: rec?.receipt_date,
                    created_at: rec?.created_at,
                    project_id: line.project_id, // 🎯 رجعنا نسحب הـ Project صراحة
                    project: rec?.project,
                    supplier: rec?.supplier,
                    account: rec?.account,
                    status: rec?.status,
                    notes: rec?.notes,
                    receipt_type: rec?.receipt_type, 
                    is_posted: isStrictlyPosted, 
                    jv_id: rec?.jv_id 
                };
            });
        }
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['active_projects_materials'],
        queryFn: async () => {
            const buildQuery = () => supabase
                .from('projects')
                .select('id, Property, project_code')
                .neq('status', 'منتهي');
            const data = await fetchPaginatedData(buildQuery, 'id');
            return data || [];
        }
    });

    const filteredData = useMemo(() => {
        let result = allMaterials.filter(mat => {
            const matchSearch = !globalSearch || 
                mat.work_item?.toLowerCase().includes(globalSearch.toLowerCase()) || 
                mat.supplier?.name?.toLowerCase().includes(globalSearch.toLowerCase()) ||
                mat.receipt_no?.toLowerCase().includes(globalSearch.toLowerCase());
            const matchProject = filterProject === 'الكل' || mat.project_id === filterProject;
            const matchDate = (!dateFrom || mat.exp_date >= dateFrom) && (!dateTo || mat.exp_date <= dateTo);
            return matchSearch && matchProject && matchDate;
        });

        result.sort((a, b) => {
            if (sortBy === 'newest') return new Date(b.created_at || b.exp_date).getTime() - new Date(a.created_at || a.exp_date).getTime();
            if (sortBy === 'oldest') return new Date(a.created_at || a.exp_date).getTime() - new Date(b.created_at || b.exp_date).getTime();
            if (sortBy === 'highest_price') return cleanNum(b.total_price) - cleanNum(a.total_price);
            if (sortBy === 'lowest_price') return cleanNum(a.total_price) - cleanNum(b.total_price);
            return 0;
        });

        return result;
    }, [allMaterials, globalSearch, filterProject, dateFrom, dateTo, sortBy]);

    const kpis = useMemo(() => {
        return filteredData.reduce((acc, curr) => ({
            totalCost: acc.totalCost + cleanNum(curr.total_price),
            totalTransactions: acc.totalTransactions + 1 
        }), { totalCost: 0, totalTransactions: 0 });
    }, [filteredData]);

    const handleAddItem = () => {
        setInvoiceData({
            ...invoiceData,
            items: [...invoiceData.items, { item_id: null, item_name: '', work_item: '', quantity: 1, unit: 'وحدة', unit_price: 0, total_price: 0, boq_id: null, boq_item_id: null, boq_item: '' }]
        });
    };

    const handleRemoveItem = (index: number) => {
        const newItems = invoiceData.items.filter((_:any, i:number) => i !== index);
        setInvoiceData({ ...invoiceData, items: newItems });
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems = [...invoiceData.items];
        
        if (field === 'boq_selection') {
            newItems[index].boq_id = cleanId(value?.boq_id) || cleanId(value?.id);
            newItems[index].boq_item_id = cleanId(value?.boq_item_id);
            newItems[index].boq_item = String(value?.work_item || '').trim();
        } else {
            newItems[index][field] = value;
            if (field === 'quantity' || field === 'unit_price') {
                newItems[index].total_price = cleanNum(newItems[index].quantity) * cleanNum(newItems[index].unit_price);
            }
        }
        setInvoiceData({ ...invoiceData, items: newItems });
    };

    const grandTotal = useMemo(() => {
        return invoiceData.items.reduce((sum: number, item: any) => sum + cleanNum(item.total_price), 0);
    }, [invoiceData.items]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (invoiceData.id) {
                const { data: existing } = await supabase.from('material_receipts').select('status, is_posted').eq('id', invoiceData.id).single();
                if (existing && (existing.status === 'مرحل' || existing.status === 'معتمد' || existing.is_posted)) {
                    throw new Error("لا يمكن تعديل فاتورة استلام معتمدة. يرجى فك الترحيل أولاً.");
                }
            }
            const safeProjectId = cleanId(invoiceData.project_id);
            const safePayeeId = cleanId(invoiceData.payee_id);
            const safeAccountId = cleanId(invoiceData.account_id);

            if (!safeProjectId || !safePayeeId || !safeAccountId) {
                throw new Error("يرجى التأكد من اختيار المشروع، المورد، والحساب المالي بشكل صحيح.");
            }

            if (!invoiceData.items || invoiceData.items.length === 0) {
                throw new Error("لا يمكن حفظ فاتورة بدون أصناف.");
            }

            let receiptId = invoiceData.id;

            if (receiptId) {
                await supabase.rpc('rpc_unpost_material', { p_id: receiptId });

                const { error: masterError } = await supabase
                    .from('material_receipts')
                    .update({
                        project_id: safeProjectId,
                        supplier_id: safePayeeId,
                        account_id: safeAccountId,
                        receipt_date: invoiceData.exp_date || new Date().toISOString().split('T')[0],
                        receipt_type: String(invoiceData.receipt_type || 'توريد شركة').trim(),
                        total_amount: cleanNum(grandTotal),
                        notes: String(invoiceData.notes || 'توريد خامات').trim(),
                        status: 'معتمد',
                        is_posted: false 
                    })
                    .eq('id', receiptId);
                if (masterError) throw new Error(`خطأ في تحديث الفاتورة: ${masterError.message}`);

                await supabase.from('material_receipt_lines').delete().eq('receipt_id', receiptId);

            } else {
                const { data: masterData, error: masterError } = await supabase
                    .from('material_receipts')
                    .insert([{
                        receipt_number: `MAT-${Date.now().toString().slice(-6)}`,
                        project_id: safeProjectId,
                        supplier_id: safePayeeId,
                        account_id: safeAccountId,
                        receipt_date: invoiceData.exp_date || new Date().toISOString().split('T')[0],
                        receipt_type: String(invoiceData.receipt_type || 'توريد شركة').trim(),
                        total_amount: cleanNum(grandTotal),
                        notes: String(invoiceData.notes || 'توريد خامات').trim(),
                        status: 'معتمد',
                        is_posted: false 
                    }])
                    .select('id').single();

                if (masterError) throw new Error(`خطأ في إنشاء الفاتورة: ${masterError.message}`);
                receiptId = masterData.id;
            }

            const linesPayload = invoiceData.items.map((item: any) => ({
                receipt_id: receiptId,
                project_id: safeProjectId,
                item_id: cleanId(item.item_id), 
                item_name: String(item.work_item || item.item_name || 'صنف غير معروف').trim(),
                quantity: cleanNum(item.quantity, 1),
                unit: String(item.unit || 'وحدة').trim(),
                unit_price: cleanNum(item.unit_price),
                total_price: cleanNum(item.total_price),
                boq_id: cleanId(item.boq_id),  
                boq_item_id: cleanId(item.boq_item_id) 
            }));

            const { error: linesError } = await supabase.from('material_receipt_lines').insert(linesPayload);
            if (linesError) throw new Error(`خطأ في حفظ السطور: ${linesError.message}`);

            return receiptId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materials_logs'] });
            setIsModalOpen(false);
            setInvoiceData(initialInvoiceState);
            setSelectedIds([]); 
            showToast("تم حفظ الفاتورة بنجاح (معلقة في انتظار الترحيل)", "success");
            fetchInventoryBalances(); 
        },
        onError: (err: any) => showToast(err.message, "error") 
    });

    const actionMutation = useMutation({
        mutationFn: async ({ action, id }: { action: string, id: string }) => {
            if (action === 'delete') {
                const { data: existing } = await supabase.from('material_receipts').select('status, is_posted').eq('id', id).single();
                if (existing && (existing.status === 'مرحل' || existing.status === 'معتمد' || existing.is_posted)) {
                    throw new Error("لا يمكن حذف فاتورة استلام معتمدة. يرجى فك الترحيل أولاً.");
                }
            }
            let rpcName = '';
            if (action === 'post') rpcName = 'rpc_post_material';
            if (action === 'unpost') rpcName = 'rpc_unpost_material';
            if (action === 'delete') rpcName = 'rpc_delete_material_receipt';

            const { error } = await supabase.rpc(rpcName, { p_id: id });
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            const msg = variables.action === 'delete' ? "تم حذف الإذن والقيود المربوطة" : "تمت العملية بنجاح";
            showToast(msg, "success");
            queryClient.invalidateQueries({ queryKey: ['materials_logs'] });
            fetchInventoryBalances(); 
        },
        onError: (err: any) => showToast(`فشلت العملية: ${err.message}`, "error")
    });

    const dispenseMaterialMutation = useMutation({
        mutationFn: async (data: any) => {
            const safeProjectId = cleanId(data.project_id);
            if (!safeProjectId) throw new Error("المشروع الإلزامي غير محدد للصرف.");

            const issuePayload = {
                issue_number: `ISS-${Date.now().toString().slice(-6)}`,
                project_id: safeProjectId,
                subcontractor_id: data.issue_type === 'صرف لمقاول' ? cleanId(data.subcontractor_id) : null,
                issue_date: data.issue_date || new Date().toISOString().split('T')[0],
                issue_type: data.issue_type || 'استهلاك مباشر',
                total_amount: cleanNum(data.quantity) * cleanNum(data.item.unit_price),
                notes: data.issue_type === 'صرف لمقاول' ? `منصرف ومحمل على المقاول مباشر من المشتريات` : `استهلاك مباشر من المشتريات`,
                is_posted: false 
            };
    
            const { data: issueRecord, error: issueError } = await supabase
                .from('material_issues')
                .insert([issuePayload])
                .select('id').single(); 
    
            if (issueError) throw new Error(`خطأ في حفظ رأس الصرف: ${issueError.message}`);
    
            const linePayload = {
                issue_id: issueRecord.id,
                item_id: cleanId(data.item.item_id), 
                item_name: String(data.item.item_name || 'صنف غير معروف').trim(),
                quantity: cleanNum(data.quantity, 1),
                unit: String(data.item.unit || 'وحدة').trim(),
                unit_price: cleanNum(data.item.unit_price),
                total_price: cleanNum(data.quantity, 1) * cleanNum(data.item.unit_price),
                boq_id: cleanId(data.boq_id), 
                boq_item_id: cleanId(data.boq_item_id)
            };
    
            const { error: lineError } = await supabase.from('material_issue_lines').insert([linePayload]);
            if (lineError) throw new Error(`خطأ في حفظ سطر الصرف: ${lineError.message}`);
        },
        onSuccess: () => {
            showToast("تم حفظ إذن الصرف كمسودة بنجاح (في انتظار الترحيل)", "success");
            setIsDispenseModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['materials_logs'] });
            fetchInventoryBalances(); 
        },
        onError: (err: any) => showToast(err.message, "error")
    });

    const handleOpenDispense = (item: any) => {
        setSelectedInvoiceItem(item);
        setIsDispenseModalOpen(true);
    };

    const populateEditModal = (receipt_id: string) => {
        const lines = allMaterials.filter((d: any) => d.receipt_id === receipt_id);
        if (lines.length > 0) {
            const first = lines[0];
            setInvoiceData({
                id: receipt_id, 
                project_id: cleanId(first.project_id) || '',
                project_name: first.project?.Property || '', 
                payee_id: cleanId(first.supplier?.id) || '',
                payee_name: first.supplier?.name || '',      
                account_id: cleanId(first.account?.id) || '',
                account_name: first.account?.name || '',     
                receipt_type: first.receipt_type || 'توريد شركة',
                exp_date: first.exp_date || new Date().toISOString().split('T')[0],
                notes: first.notes || '',
                items: lines.map((l: any) => ({
                    item_id: cleanId(l.item_id),
                    item_name: l.item_name || '',
                    work_item: l.work_item || '',
                    quantity: cleanNum(l.quantity, 1),
                    unit: l.unit || 'وحدة',
                    unit_price: cleanNum(l.unit_price),
                    total_price: cleanNum(l.total_price),
                    boq_id: cleanId(l.boq_id),
                    boq_item_id: cleanId(l.boq_item_id), 
                    boq_item: l.boq_item || '' 
                }))
            });
            setIsModalOpen(true);
        }
    };

    return {
        data: filteredData, projects, kpis, isLoading,
        globalSearch, setGlobalSearch, filterProject, setFilterProject, dateFrom, setDateFrom, dateTo, setDateTo,
        isModalOpen, setIsModalOpen, openAddModal: () => { setInvoiceData(initialInvoiceState); setIsModalOpen(true); },
        isPrintModalOpen, setIsPrintModalOpen, printReceiptId, setPrintReceiptId,
        invoiceData, setInvoiceData, handleAddItem, handleRemoveItem, handleItemChange, grandTotal,
        handleSave: () => saveMutation.mutate(),
        
        sortBy, setSortBy, selectedIds, setSelectedIds,
        
        handleSelectAll: (e: any) => {
            if (e.target.checked) {
                const allReceiptIds = Array.from(new Set(filteredData.map((d: any) => d.receipt_id).filter(Boolean)));
                setSelectedIds(allReceiptIds as string[]);
            } else {
                setSelectedIds([]);
            }
        },

        handleSelectRow: (id: string) => {
            setSelectedIds(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
        },

        handleEdit: populateEditModal, 
        
        handleEditSelected: () => {
            if (selectedIds.length !== 1) {
                showToast("الرجاء تحديد فاتورة واحدة لتعديلها.", "warning");
                return;
            }
            populateEditModal(selectedIds[0]); 
        },

        handleBulkAction: async (action: 'post' | 'unpost' | 'delete') => {
            try {
                if (selectedIds.length === 0) return;
                
                if (action === 'delete') {
                    for (const rId of selectedIds) {
                        const { data: existing } = await supabase.from('material_receipts').select('status, is_posted').eq('id', rId).single();
                        if (existing && (existing.status === 'مرحل' || existing.status === 'معتمد' || existing.is_posted)) {
                            throw new Error("لا يمكن حذف سجلات معتمدة. يرجى فك الترحيل أولاً.");
                        }
                    }
                }

                const rpcMap: any = { 
                    post: 'rpc_post_material', 
                    unpost: 'rpc_unpost_material', 
                    delete: 'rpc_delete_material_receipt' 
                };

                for (const rId of selectedIds) {
                    const { error } = await supabase.rpc(rpcMap[action], { p_id: rId });
                    if (error) throw error;
                }

                showToast("تم تنفيذ العملية بنجاح على الفواتير المحددة", "success");
                setSelectedIds([]); 
                queryClient.invalidateQueries({ queryKey: ['materials_logs'] });
                fetchInventoryBalances(); 
            } catch (err: any) {
                showToast(`خطأ في التنفيذ الجماعي: ${err.message}`, "error");
            }
        },

        handleAction: (action: string, id: string) => actionMutation.mutate({ action, id }),
        isActionPending: actionMutation.isPending,
        canAdd: can('materials', 'add'),

        isDispenseModalOpen, setIsDispenseModalOpen,
        selectedInvoiceItem, setSelectedInvoiceItem,
        handleOpenDispense,
        dispenseMaterialMutation,

        selectedLineItems, 
        handleToggleLineSelection, 
        clearLineSelection,
        isBulkDispenseModalOpen, 
        setIsBulkDispenseModalOpen,
        bulkDispenseMutation
    };
}