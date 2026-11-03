"use client";
import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/lib/toast-context';
import { fetchAllSupabaseData } from '@/lib/helpers';

export function useBoqCatalogLogic() {
    const { showToast } = useToast();
    const queryClient = useQueryClient();

    const [globalSearch, setGlobalSearch] = useState('');
    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
    
    // حالات المودال للبنود
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentRecord, setCurrentRecord] = useState<any>({});

    // حالات المودال للأقسام (تعديل اسم قسم رئيسي/فرعي)
    const [categoryModal, setCategoryModal] = useState<{isOpen: boolean, oldName: string, newName: string, type: 'main'|'sub', parentMain?: string}>({ isOpen: false, oldName: '', newName: '', type: 'main' });

    // 📥 جلب الدليل بالكامل
    const { data: catalogItems = [], isLoading } = useQuery({
        queryKey: ['boq_items_catalog'],
        queryFn: async () => {
            const data = await fetchAllSupabaseData(supabase, 'boq_items', '*', 'main_category', true);
            // Sorting can be refined on client-side if needed since fetchAll orders by one column
            return data || [];
        }
    });

    // 🚀 السحر المعماري: تحويل البيانات المسطحة إلى هيكل شجري
    const treeData = useMemo(() => {
        const tree: Record<string, Record<string, any[]>> = {};
        
        catalogItems.forEach(item => {
            const search = globalSearch.toLowerCase();
            if (search && !item.item_name?.toLowerCase().includes(search) && 
                !item.main_category?.toLowerCase().includes(search) && 
                !item.sub_category?.toLowerCase().includes(search) &&
                !(item.item_code || '').toLowerCase().includes(search)) {
                return;
            }

            if (!tree[item.main_category]) tree[item.main_category] = {};
            if (!tree[item.main_category][item.sub_category]) tree[item.main_category][item.sub_category] = [];
            tree[item.main_category][item.sub_category].push(item);
        });
        
        return tree;
    }, [catalogItems, globalSearch]);

    const toggleNode = (nodeName: string) => {
        setExpandedNodes(prev => ({ ...prev, [nodeName]: !prev[nodeName] }));
    };

    // 🚀 [خوارزمية التكويد الذكية المحسنة (Smart AI Coding)]
    const generateItemCode = async (mainCat: string, subCat: string) => {
        let prefix = 'GEN'; // عام
        const mainStr = mainCat.toLowerCase();
        
        // تحليل الذكاء للكلمات المفتاحية
        if (mainStr.includes('انشاء') || mainStr.includes('إنشاء') || mainStr.includes('عظم') || mainStr.includes('خرسان') || mainStr.includes('حفر') || mainStr.includes('هيكل')) prefix = 'STR';
        else if (mainStr.includes('تشطيب') || mainStr.includes('معمار') || mainStr.includes('ديكور') || mainStr.includes('دهان') || mainStr.includes('بلاط')) prefix = 'FIN';
        else if (mainStr.includes('كهروميكانيك') || mainStr.includes('كهرباء') || mainStr.includes('سباك') || mainStr.includes('ميكانيك') || mainStr.includes('تكييف')) prefix = 'MEP';
        else if (mainStr.includes('ادار') || mainStr.includes('إدار') || mainStr.includes('اشراف') || mainStr.includes('إشراف') || mainStr.includes('تصميم') || mainStr.includes('هندس')) prefix = 'MGT';
        else if (mainStr.includes('موقع') || mainStr.includes('تجهيز') || mainStr.includes('تمهيد') || mainStr.includes('سور')) prefix = 'SIT';

        const items = await fetchAllSupabaseData(supabase, 'boq_items', 'item_code, main_category, sub_category', 'main_category', true);

        // تسلسل القسم الفرعي
        const itemsInMain = items.filter(i => i.main_category === mainCat);
        const uniqueSubsInMain = Array.from(new Set(itemsInMain.map(i => i.sub_category)));
        let subIndex = uniqueSubsInMain.indexOf(subCat);
        if (subIndex === -1) subIndex = uniqueSubsInMain.length; 
        const subCodeStr = (subIndex + 1).toString().padStart(2, '0');

        // تسلسل البند نفسه
        const itemsInSub = itemsInMain.filter(i => i.sub_category === subCat);
        let maxItemNum = 0;
        itemsInSub.forEach(item => {
            if (!item.item_code) return;
            const parts = item.item_code.split('-');
            const lastPart = parts[parts.length - 1]; // جلب آخر رقم في الكود
            const num = parseInt(lastPart, 10);
            if (!isNaN(num) && num > maxItemNum) maxItemNum = num;
        });
        const itemCodeStr = (maxItemNum + 1).toString().padStart(2, '0');

        return `${prefix}-${subCodeStr}-${itemCodeStr}`; // النتيجة: FIN-01-02
    };

    // 🚀 الحفظ للبند الفردي
    const saveItemMutation = useMutation({
        mutationFn: async (record: any) => {
            const mainCat = record.main_category || 'أعمال عامة';
            const subCat = record.sub_category || 'بنود عامة';

            let finalItemCode = record.item_code;
            if (!finalItemCode || finalItemCode.trim() === '') {
                finalItemCode = await generateItemCode(mainCat, subCat);
            }
            
            const payload = {
                item_code: finalItemCode,
                main_category: mainCat,
                sub_category: subCat,
                item_name: record.item_name,
                unit_of_measure: record.unit_of_measure || 'مقطوعية'
            };

            if (record.id) {
                const { error } = await supabase.from('boq_items').update(payload).eq('id', record.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('boq_items').insert([payload]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            showToast("تم الحفظ بنجاح 📚✅", "success");
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['boq_items_catalog'] });
        }
    });

    const deleteItemMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('boq_items').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            showToast("تم المسح بنجاح 🗑️", "success");
            queryClient.invalidateQueries({ queryKey: ['boq_items_catalog'] });
        }
    });

    // 🚀 [الجديد]: تعديل وحذف الأقسام بالكامل (Cascade Operations)
    const renameCategoryMutation = useMutation({
        mutationFn: async ({ oldName, newName, type, parentMain }: any) => {
            if (type === 'main') {
                const { error } = await supabase.from('boq_items').update({ main_category: newName }).eq('main_category', oldName);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('boq_items').update({ sub_category: newName }).eq('main_category', parentMain).eq('sub_category', oldName);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            showToast("تم تحديث اسم القسم بنجاح 🔄", "success");
            setCategoryModal({ ...categoryModal, isOpen: false });
            queryClient.invalidateQueries({ queryKey: ['boq_items_catalog'] });
        }
    });

    const deleteCategoryMutation = useMutation({
        mutationFn: async ({ name, type, parentMain }: any) => {
            if (type === 'main') {
                const { error } = await supabase.from('boq_items').delete().eq('main_category', name);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('boq_items').delete().eq('main_category', parentMain).eq('sub_category', name);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            showToast("تم حذف القسم بجميع بنوده 🗑️", "success");
            queryClient.invalidateQueries({ queryKey: ['boq_items_catalog'] });
        }
    });

    const uniqueMainCategories = Array.from(new Set(catalogItems.map(i => i.main_category)));
    const uniqueSubCategories = Array.from(new Set(catalogItems.map(i => i.sub_category)));

    return {
        treeData, catalogItems, isLoading, 
        globalSearch, setGlobalSearch,
        expandedNodes, setExpandedNodes, toggleNode,
        isModalOpen, setIsModalOpen, currentRecord, setCurrentRecord,
        handleSaveItem: (data: any) => saveItemMutation.mutate(data),
        handleDeleteItem: (id: string) => { if(confirm("تأكيد الحذف النهائي؟")) deleteItemMutation.mutate(id); },
        isSaving: saveItemMutation.isPending,
        uniqueMainCategories, uniqueSubCategories,
        categoryModal, setCategoryModal,
        handleRenameCategory: (data: any) => renameCategoryMutation.mutate(data),
        handleDeleteCategory: (data: any) => deleteCategoryMutation.mutate(data)
    };
}
