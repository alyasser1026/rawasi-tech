"use client";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query'; 
import { useToast } from '@/lib/toast-context'; 
import { fetchAllSupabaseData } from '@/lib/helpers';

export function useMaterialItemsLogic() {
  const { showToast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('الكل');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<any>({
    item_code: '', item_name: '', main_category: '', default_unit: 'حبة', default_unit_price: 0, notes: ''
  });

  // جلب التصنيفات المتاحة ديناميكياً للفلاتر
  const categories = useMemo(() => {
    const cats = items.map(i => i.main_category).filter(Boolean);
    return Array.from(new Set(cats));
  }, [items]);

  const fetchData = async () => {
    setIsLoading(true);
    const data = await fetchAllSupabaseData(supabase, 'material_items', '*', 'created_at', false);
    if (data) setItems(data);
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // فلاتر البحث والتصفية
  const filteredItems = useMemo(() => {
    return items.filter(i => {
      const matchSearch = (i.item_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (i.item_code || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = filterCategory === 'الكل' || i.main_category === filterCategory;
      return matchSearch && matchCat;
    });
  }, [items, searchQuery, filterCategory]);

  // Mutation الحفظ (إضافة أو تعديل)
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
      showToast("تم حفظ الصنف بنجاح", "success");
      setIsModalOpen(false);
      fetchData();
    },
    onError: (err: any) => showToast(`خطأ أثناء الحفظ: ${err.message}`, "error")
  });

  // Mutation الحذف
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('material_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      showToast("تم حذف الصنف من الدليل", "success");
      fetchData();
    },
    onError: (err: any) => showToast(`فشل الحذف: ${err.message}`, "error")
  });

  const handleSave = () => {
    if (!currentRecord.item_name) return showToast("اسم الصنف مطلوب!", "error");
    saveMutation.mutate(currentRecord);
  };

  return {
    items: filteredItems,
    categories,
    isLoading,
    searchQuery, setSearchQuery,
    filterCategory, setFilterCategory,
    isModalOpen, setIsModalOpen,
    currentRecord, setCurrentRecord,
    handleSave,
    deleteItem: (id: string) => deleteMutation.mutate(id),
    isSaving: saveMutation.isPending
  };
}
