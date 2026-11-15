"use client";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation } from '@tanstack/react-query'; 
import { useToast } from '@/lib/toast-context'; 
import { fetchAllSupabaseData } from '@/lib/helpers';
import { generateNextMaterialCode } from '@/lib/materialCodeGenerator';

export function useMaterialItemsLogic() {
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('الكل');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<any>({
    item_code: '',
    item_name: '',
    main_category: '',
    default_unit: 'حبة',
    default_unit_price: 0,
    notes: '',
  });

  // جلب التصنيفات المتاحة ديناميكياً للفلاتر
  const categories = useMemo(() => {
    const cats = items.map((i) => i.main_category).filter(Boolean);
    return Array.from(new Set(cats));
  }, [items]);

  const fetchData = async () => {
    setIsLoading(true);
    const data = await fetchAllSupabaseData(supabase, 'material_items', '*', 'created_at', false);
    if (data) setItems(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // توليد الكود التلقائي التالي بناءً على قائمة الأصناف المسجلة
  const getNextMaterialCode = useCallback(
    (prefix = 'MAT') => {
      const existingCodes = items.map((i) => i.item_code);
      return generateNextMaterialCode(existingCodes, prefix);
    },
    [items]
  );

  // فتح نافذة الإضافة مع توليد كود الصنف تلقائياً فوراً
  const openNewItemModal = useCallback(
    (customCategory = '') => {
      const nextCode = getNextMaterialCode('MAT');
      setCurrentRecord({
        item_code: nextCode,
        item_name: '',
        main_category: customCategory || '',
        default_unit: 'حبة',
        default_unit_price: 0,
        notes: '',
      });
      setIsModalOpen(true);
    },
    [getNextMaterialCode]
  );

  // إعادة توليد كود تلقائي يدوي من داخل المودال عند الحاجة
  const regenerateCode = useCallback(
    () => {
      const nextCode = getNextMaterialCode('MAT');
      setCurrentRecord((prev: any) => ({ ...prev, item_code: nextCode }));
      showToast(`تم تعيين الكود التلقائي التالي: ${nextCode}`, 'info');
    },
    [getNextMaterialCode, showToast]
  );

  // فلاتر البحث والتصفية
  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      const matchSearch =
        (i.item_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.item_code || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = filterCategory === 'الكل' || i.main_category === filterCategory;
      return matchSearch && matchCat;
    });
  }, [items, searchQuery, filterCategory]);

  // Mutation الحفظ (إضافة أو تعديل) مع حماية ضد الأكواد المكررة أو الفارغة
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.id) {
        const { error } = await supabase.from('material_items').update(payload).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('material_items').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      showToast('تم حفظ الصنف وتكويده بنجاح', 'success');
      setIsModalOpen(false);
      fetchData();
    },
    onError: (err: any) => showToast(`خطأ أثناء الحفظ: ${err.message}`, 'error'),
  });

  // Mutation الحذف
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('material_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      showToast('تم حذف الصنف من الدليل', 'success');
      fetchData();
    },
    onError: (err: any) => showToast(`فشل الحذف: ${err.message}`, 'error'),
  });

  const handleSave = () => {
    const trimmedName = String(currentRecord.item_name || '').trim();
    if (!trimmedName) {
      return showToast('اسم الصنف مطلوب!', 'error');
    }

    let finalCode = String(currentRecord.item_code || '').trim();

    // 1. إذا كان الكود فارغاً، يتم توليد الكود التالي تلقائياً فوراً
    if (!finalCode) {
      finalCode = getNextMaterialCode('MAT');
    } else if (!currentRecord.id) {
      // 2. التحقق من عدم تكرار الكود مع صنف آخر لتجنب خطأ duplicate key constraint
      const isDuplicate = items.some(
        (i) => i.id !== currentRecord.id && String(i.item_code || '').trim().toLowerCase() === finalCode.toLowerCase()
      );
      if (isDuplicate) {
        const freshCode = getNextMaterialCode('MAT');
        showToast(
          `الكود (${finalCode}) مستخدم بالفعل مع صنف آخر، تم تعيين الكود التالي تلقائياً: ${freshCode}`,
          'info'
        );
        finalCode = freshCode;
      }
    }

    const payload = {
      ...currentRecord,
      item_code: finalCode,
      item_name: trimmedName,
      default_unit: currentRecord.default_unit || 'حبة',
      default_unit_price: Number(currentRecord.default_unit_price) || 0,
    };

    saveMutation.mutate(payload);
  };

  return {
    items: filteredItems,
    categories,
    isLoading,
    searchQuery,
    setSearchQuery,
    filterCategory,
    setFilterCategory,
    isModalOpen,
    setIsModalOpen,
    currentRecord,
    setCurrentRecord,
    openNewItemModal,
    regenerateCode,
    getNextMaterialCode,
    handleSave,
    deleteItem: (id: string) => deleteMutation.mutate(id),
    isSaving: saveMutation.isPending,
  };
}
