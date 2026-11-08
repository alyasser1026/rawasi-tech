"use client";
import { useState, useMemo, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase'; 
import { useToast } from '@/lib/toast-context'; 
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; 

// 🎨 قائمة ألوان هادية (Pastel/Glassy) لتمييز المشاريع بصرياً
const PROJECT_COLORS = [
    'rgba(219, 234, 254, 0.4)', // أزرق خفيف
    'rgba(220, 252, 231, 0.5)', // أخضر خفيف
    'rgba(254, 243, 199, 0.5)', // أصفر خفيف
    'rgba(243, 232, 255, 0.5)', // بنفسجي خفيف
    'rgba(255, 228, 230, 0.5)', // وردي خفيف
    'rgba(241, 245, 249, 0.6)', // رمادي خفيف
    'rgba(204, 251, 241, 0.5)'  // فيروزي خفيف
];

export function useBOQLogic() {
    const { showToast } = useToast(); 
    const queryClient = useQueryClient();
    
    const [globalSearch, setGlobalSearch] = useState('');
    const deferredSearch = useDeferredValue(globalSearch); 
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentRecord, setCurrentRecord] = useState<any>({});

    const { data: boqItems = [], isLoading: isBoqLoading } = useQuery({
        queryKey: ['boq_budget'],
        queryFn: async () => {
            try {
                const { data, error } = await supabase
                    .from('boq_budget')
                    .select(`*, projects:projects!boq_budget_project_id_fkey(Property, unit_type)`);
                if (error) throw error;
                return data || [];
            } catch (err: any) {
                console.warn('Fallback boq_budget query due to relation error:', err?.message);
                const { data: rawBoq, error: boqErr } = await supabase.from('boq_budget').select('*');
                if (boqErr) throw boqErr;
                const { data: rawProjects } = await supabase.from('projects').select('id, Property, unit_type');
                const pMap = new Map((rawProjects || []).map((p: any) => [p.id, p]));
                return (rawBoq || []).map((b: any) => ({
                    ...b,
                    projects: pMap.get(b.project_id) || null
                }));
            }
        }
    });

    const { data: projects = [], isLoading: isProjLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => {
            // 🚀 التحديث هنا برضه لو محتاجين نستخدمه في أي مكان في الشاشة
            const { data, error } = await supabase.from('projects').select('id, Property, unit_type');
            if (error) throw error;
            return data || [];
        }
    });

    const allFiltered = useMemo(() => {
        if (!boqItems) return [];
        let filtered = boqItems.filter((item: any) => {
            const searchLower = (deferredSearch || '').toLowerCase();
            return item.work_item?.toLowerCase().includes(searchLower) || 
                   item.projects?.Property?.toLowerCase().includes(searchLower);
        });

        // 🚀 1. الترتيب الأبجدي حسب اسم المشروع لتجميع البنود معاً
        filtered.sort((a: any, b: any) => {
            const projA = a.projects?.Property || 'عام';
            const projB = b.projects?.Property || 'عام';
            return projA.localeCompare(projB, 'ar');
        });

        // 🚀 2. توزيع الألوان وتحديد أول صف في كل مشروع
        let currentProject: string | null = null;
        let colorIndex = -1;

        return filtered.map((item: any) => {
            const projName = item.projects?.Property || 'عام';
            
            // لو المشروع اتغير، ننقل على اللون اللي بعده في القائمة
            if (projName !== currentProject) {
                currentProject = projName;
                colorIndex = (colorIndex + 1) % PROJECT_COLORS.length;
                item.is_first_in_group = true;
            } else {
                item.is_first_in_group = false;
            }
            
            // حقن اللون في البيانات عشان نستخدمه في الواجهة
            item.project_color = PROJECT_COLORS[colorIndex];
            
            return item;
        });
    }, [boqItems, deferredSearch]);

    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return allFiltered.slice(start, start + rowsPerPage);
    }, [allFiltered, currentPage, rowsPerPage]);

    const handleAddNew = () => { 
        setCurrentRecord({}); 
        setIsEditModalOpen(true); 
    };

    const handleEdit = (item: any) => {
        setCurrentRecord({ ...item, project_name: item.projects?.Property || '' });
        setIsEditModalOpen(true);
    };

    const saveMutation = useMutation({
        mutationFn: async (record: any) => {
            const numericFields = [
                'contract_quantity', 'unit_contract_price', 'retention_percentage',
                'estimated_material_cost', 'estimated_labor_cost', 'estimated_operational_cost', 'estimated_expenses_cost',
                'actual_quantity', 'actual_material_cost', 'actual_labor_cost', 'actual_operational_cost', 'actual_expenses_cost', 'actual_revenue'
            ];
            
            // 🚀 تم تضمين boq_item_id ليرسل المعرّف الفرعي للبند من أجل تشغيل تريجرات الحساب التلقائي
            let cleanPayload: any = { 
                project_id: record.project_id || null,
                boq_item_id: record.boq_item_id || null, 
                work_item: record.work_item,
                item_type: record.item_type || 'رئيسي',
                unit: record.unit || 'مقطوعية',
                main_category: record.main_category || null,
                // 👇 التحديث هنا: إضافة حقل حالة التنفيذ لارساله لقاعدة البيانات
                execution_status: record.execution_status || 'لم يتم البدئ' 
            };

            numericFields.forEach(field => {
                cleanPayload[field] = record[field] === '' || record[field] == null ? 0 : Number(record[field]);
            });

            if (record.id) {
                const { error } = await supabase.from('boq_budget').update(cleanPayload).eq('id', record.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('boq_budget').insert([cleanPayload]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            setIsEditModalOpen(false);
            showToast("تم حفظ البند وتحديث الانحرافات بنجاح", "success");
            queryClient.invalidateQueries({ queryKey: ['boq_budget'] });
        },
        onError: (err: any) => showToast(`حدث خطأ أثناء الحفظ!${err.message}`, "error")
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!selectedIds.length) return;
            const { error } = await supabase.from('boq_budget').delete().in('id', selectedIds);
            if (error) throw error;
        },
        onSuccess: () => {
            showToast("تم حذف البنود المحددة بنجاح", "success");
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['boq_budget'] });
        },
        onError: (err: any) => showToast(`خطأ في الحذف: ${err.message}`, "error")
    });

    const isSaving = saveMutation.isPending || deleteMutation.isPending;
    const isLoading = isBoqLoading || isProjLoading || isSaving;

    return {
        allFiltered, paginatedItems, projects,
        isLoading, isSaving,
        globalSearch, setGlobalSearch: (v: string) => { setGlobalSearch(v); setCurrentPage(1); },
        selectedIds, setSelectedIds,
        currentPage, setCurrentPage,
        rowsPerPage, setRowsPerPage: (v: number) => { setRowsPerPage(v); setCurrentPage(1); },
        isEditModalOpen, setIsEditModalOpen,
        currentRecord, setCurrentRecord,
        handleAddNew, handleEdit, 
        handleSave: (record: any) => saveMutation.mutate(record),
        handleDeleteSelected: () => {
            if (!selectedIds.length || !confirm("هل أنت متأكد من حذف البنود المحددة؟")) return;
            deleteMutation.mutate();
        }
    };
}