"use client";
import { useState, useEffect } from 'react'; 
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/lib/toast-context';
import { fetchPaginatedData } from '@/lib/supabase-pagination';

export function useMaterialIssuesLogic() {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]); 
    const [editingIssueId, setEditingIssueId] = useState<string | null>(null); 

    // 📦 قائمة الخامات والأرصدة من الـ View (للاستعلام فقط)
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);

    const fetchInventoryItems = async () => {
        try {
            const { data, error } = await supabase.rpc('rpc_get_inventory_balances');

            if (error) throw error;
            
            const formattedData = data?.map((d: any) => ({
                ...d,
                id: d.item_id 
            })) || [];

            setInventoryItems(formattedData);
        } catch (err: any) {
            console.error("خطأ في جلب أرصدة المخازن عبر RPC:", err.message);
        }
    };
    
    useEffect(() => {
        fetchInventoryItems();
    }, []);

    const initialIssueState = {
        project_id: '',
        subcontractor_id: '',
        issue_type: 'صرف لمقاول',
        issue_date: new Date().toISOString().split('T')[0],
        notes: '',
        // 🚀 إضافة boq_item_id هنا
        items: [{ item_id: null, item_name: '', quantity: 1, available_qty: 0, old_qty: 0, unit: 'وحدة', unit_price: 0, total_price: 0, boq_id: null, boq_item_id: null }]
    };

    const [issueData, setIssueData] = useState<any>(initialIssueState);

    const { data: issues = [], isLoading } = useQuery({
        queryKey: ['material_issues_list'],
        queryFn: async () => {
            const buildQuery = () => supabase
                .from('material_issue_lines')
                .select(`
                    id, boq_item_id, item_name, quantity, unit, unit_price, total_price, boq_id,
                    boq:boq_budget!material_issue_lines_boq_id_fkey(work_item),
                    issue:material_issues!material_issue_lines_issue_id_fkey (
                        id, issue_number, issue_date, issue_type, is_posted, notes, project_id, subcontractor_id, contractor_text_name, created_at,
                        project:projects!material_issues_project_id_fkey(Property),
                        subcontractor:partners!material_issues_subcontractor_id_fkey(name)
                    )
                `).order('created_at', { foreignTable: 'material_issues', ascending: false });
            
            const data = await fetchPaginatedData(buildQuery, 'id');
            
            return data.map((line: any) => ({
                id: line.id, 
                issue_id: line.issue?.id, 
                issue_number: line.issue?.issue_number,
                item_id: line.item_id, 
                item_name: line.item_name,
                quantity: line.quantity,
                unit: line.unit,
                unit_price: line.unit_price,
                total_price: line.total_price,
                boq_item: line.boq?.work_item,
                boq_id: line.boq_id,
                boq_item_id: line.boq_item_id, // 🚀
                issue_date: line.issue?.issue_date,
                issue_type: line.issue?.issue_type,
                notes: line.issue?.notes,
                is_posted: line.issue?.is_posted,
                project_id: line.issue?.project_id,
                project_name: line.issue?.project?.Property,
                subcontractor_id: line.issue?.subcontractor_id,
                subcontractor_name: line.issue?.subcontractor?.name,
                contractor_text_name: line.issue?.contractor_text_name 
            })).sort((a: any, b: any) => new Date(b.issue_date || 0).getTime() - new Date(a.issue_date || 0).getTime());
        }
    });

    const handleOpenEdit = () => {
        if(selectedIds.length === 0) return;
        const idToEdit = issues.find((i:any) => i.id === selectedIds[0])?.issue_id;
        if(!idToEdit) return;

        const linesToEdit = issues.filter((i: any) => i.issue_id === idToEdit);
        if (linesToEdit.length > 0) {
            const master = linesToEdit[0];
            setIssueData({
                project_id: master.project_id,
                subcontractor_id: master.subcontractor_id,
                issue_type: master.issue_type,
                issue_date: master.issue_date,
                notes: master.notes || '',
                items: linesToEdit.map((l: any) => {
                    const inventoryItem = inventoryItems.find(inv => inv.item_id === l.item_id);
                    return {
                        item_id: l.item_id || null,
                        item_name: l.item_name,
                        quantity: l.quantity,
                        old_qty: l.quantity, 
                        available_qty: inventoryItem?.available_quantity || 0, 
                        unit: l.unit,
                        unit_price: l.unit_price,
                        total_price: l.total_price,
                        boq_id: l.boq_id,
                        boq_item_id: l.boq_item_id // 🚀
                    };
                })
            });
            setEditingIssueId(idToEdit);
            setIsModalOpen(true);
        }
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems = [...issueData.items];
        
        if (field === 'item_selection') {
            // 🚀 التعديل هنا: بما إننا بنقرأ من جدول الأصناف المباشر، هناخد الـ id وندور على رصيده في اللوجيك
            const selectedId = value?.id || value?.item_id || null;
            const inventoryData = inventoryItems.find(inv => inv.item_id === selectedId);

            newItems[index].item_id = selectedId;
            newItems[index].item_name = value?.item_name || '';
            newItems[index].unit = inventoryData?.unit || value?.default_unit || 'وحدة';
            newItems[index].unit_price = inventoryData?.last_price || value?.default_unit_price || 0; 
            newItems[index].available_qty = inventoryData?.available_quantity || 0; 
            newItems[index].total_price = (Number(newItems[index].quantity) || 0) * (Number(newItems[index].unit_price) || 0);
        } 
        // 🚀 الربط المزدوج للميزانية والمقايسة
        else if (field === 'boq_selection') {
            newItems[index].boq_id = value?.id || null;
            newItems[index].boq_item_id = value?.boq_item_id || null;
        } 
        else {
            newItems[index][field] = value;
            if (field === 'quantity' || field === 'unit_price') {
                newItems[index].total_price = (Number(newItems[index].quantity) || 0) * (Number(newItems[index].unit_price) || 0);
            }
        }
        setIssueData({ ...issueData, items: newItems });
    };

    const handleRemoveItem = (index: number) => {
        const newItems = issueData.items.filter((_: any, i: number) => i !== index);
        setIssueData({ ...issueData, items: newItems });
    };

    const saveIssueMutation = useMutation({
        mutationFn: async () => {
            if (editingIssueId) {
                const { data: existing } = await supabase.from('material_issues').select('is_posted').eq('id', editingIssueId).single();
                if (existing && existing.is_posted) {
                    throw new Error("لا يمكن تعديل إذن صرف مرحل. يرجى فك الترحيل أولاً.");
                }
            }
            if (!issueData.project_id) throw new Error("يرجى اختيار المشروع الصارف");
            if (issueData.issue_type === 'صرف لمقاول' && !issueData.subcontractor_id) throw new Error("يرجى اختيار المقاول المستلم");

            for (const item of issueData.items) {
                if (item.item_id) {
                    const totalAvailable = (Number(item.available_qty) || 0) + (Number(item.old_qty) || 0);
                    if (Number(item.quantity) > totalAvailable) {
                        throw new Error(`⚠️ نفاذ مخزون! الكمية المطلوبة لـ "${item.item_name}" (${item.quantity}) أكبر من المتاح (${totalAvailable}).`);
                    }
                }
            }

            const total = issueData.items.reduce((sum: number, i: any) => sum + i.total_price, 0);
            let currentIssueId = editingIssueId;

            if (currentIssueId) {
                await supabase.rpc('rpc_unpost_material_issue', { p_id: currentIssueId });
                await supabase.from('material_issue_lines').delete().eq('issue_id', currentIssueId);
                
                const { error: hErr } = await supabase.from('material_issues').update({
                    project_id: issueData.project_id,
                    subcontractor_id: issueData.issue_type === 'صرف لمقاول' ? issueData.subcontractor_id : null,
                    issue_date: issueData.issue_date,
                    issue_type: issueData.issue_type,
                    total_amount: total,
                    notes: issueData.notes,
                    is_posted: false
                }).eq('id', currentIssueId);
                if (hErr) throw hErr;
            } else {
                const { data: head, error: hErr } = await supabase.from('material_issues').insert([{
                    issue_number: `ISS-${Date.now().toString().slice(-6)}`,
                    project_id: issueData.project_id,
                    subcontractor_id: issueData.issue_type === 'صرف لمقاول' ? issueData.subcontractor_id : null,
                    issue_date: issueData.issue_date,
                    issue_type: issueData.issue_type,
                    total_amount: total,
                    notes: issueData.notes,
                    is_posted: false
                }]).select().single();

                if (hErr) throw hErr;
                currentIssueId = head.id;
            }

            const lines = issueData.items.map((i: any) => ({ 
                issue_id: currentIssueId,
                item_id: i.item_id || null, 
                item_name: i.item_name,
                quantity: Number(i.quantity) || 0,
                unit: i.unit || 'وحدة',
                unit_price: Number(i.unit_price) || 0,
                total_price: Number(i.total_price) || 0,
                boq_id: i.boq_id || null,
                boq_item_id: i.boq_item_id || null, // 🚀
                job_order_id: i.job_order_id || null
            }));
            const { error: lErr } = await supabase.from('material_issue_lines').insert(lines);
            if (lErr) throw lErr;

        },
        onSuccess: () => {
            showToast("تم حفظ إذن الصرف بنجاح (مسودة بانتظار الترحيل) ✨", "success");
            setIsModalOpen(false);
            setEditingIssueId(null);
            setIssueData(initialIssueState);
            setSelectedIds([]); 
            queryClient.invalidateQueries({ queryKey: ['material_issues_list'] });
        },
        onError: (err: any) => showToast(err.message, "error") 
    });

    const actionMutation = useMutation({
        mutationFn: async ({ action }: { action: 'post' | 'unpost' | 'delete' }) => {
             const uniqueIssueIds = Array.from(new Set(
                issues
                    .filter((d: any) => selectedIds.includes(d.id))
                    .map((d: any) => d.issue_id)
                    .filter(Boolean)
            ));

            if (uniqueIssueIds.length === 0) return;
            
            if (action === 'delete') {
                for (const uId of uniqueIssueIds) {
                    const { data: existing } = await supabase.from('material_issues').select('is_posted').eq('id', uId).single();
                    if (existing && existing.is_posted) {
                        throw new Error("لا يمكن حذف إذن صرف مرحل. يرجى فك الترحيل أولاً.");
                    }
                }
            }

            let rpcName = '';
            if (action === 'post') rpcName = 'rpc_post_material_issue';
            if (action === 'unpost') rpcName = 'rpc_unpost_material_issue';
            if (action === 'delete') rpcName = 'rpc_delete_material_issue';

            for (const rId of uniqueIssueIds) {
                const { error } = await supabase.rpc(rpcName, { p_id: rId });
                if (error) throw error;
            }
        },
        onSuccess: (_, variables) => {
            const msg = variables.action === 'delete' ? "تم الحذف النهائي للفواتير المحددة 🗑️" : "تمت العملية بنجاح ✅";
            showToast(msg, "success");
            setSelectedIds([]); 
            queryClient.invalidateQueries({ queryKey: ['material_issues_list'] });
        },
        onError: (err: any) => showToast(`فشلت العملية: ${err.message}`, "error")
    });

    return {
        issues, isLoading, 
        inventoryItems, 
        isModalOpen, setIsModalOpen, 
        issueData, setIssueData,
        selectedIds, setSelectedIds, 
        editingIssueId, setEditingIssueId,
        handleOpenEdit, 
        handleItemChange, handleRemoveItem,
        handleSave: () => saveIssueMutation.mutate(),
        
        handleSelectAll: (e: any) => {
            if (e.target.checked) {
                const allLineIds = issues.map((d: any) => d.id).filter(Boolean);
                setSelectedIds(allLineIds as string[]);
            } else {
                setSelectedIds([]);
            }
        },
        handleSelectRow: (id: string) => {
            setSelectedIds(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
        },

        handleBatchAction: (action: 'post' | 'unpost' | 'delete') => actionMutation.mutate({ action }), 
        isActionPending: actionMutation.isPending,
        
        addItem: () => setIssueData({...issueData, items: [...issueData.items, {item_id: null, item_name:'', quantity:1, available_qty:0, old_qty:0, unit:'وحدة', unit_price:0, total_price:0, boq_id: null, boq_item_id: null}]}),
        openAddModal: () => { setIssueData(initialIssueState); setEditingIssueId(null); setIsModalOpen(true); }
    };
}