"use client";
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/lib/toast-context';
import * as XLSX from 'xlsx'; // 🚀 استدعاء مكتبة الإكسل
import { getAccountTypeByCode, generateNextAccountCode } from '@/lib/accountCodeGenerator';

export function useHierarchicalAccountsLogic() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // ⚡ حالات مودال الإضافة والتعديل التلقائي الذكي
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCodeAuto, setIsCodeAuto] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    parent_id: '',
    account_type: 'أصول',
    is_transactional: true
  });

  // 🧠 1. جلب البيانات "المطبوخة" من الباك إند (الأرصدة + القيود معاً)
  const { data: accountsReport = [], isLoading } = useQuery({
    queryKey: ['accounts_report_with_lines', startDate, endDate], 
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_accounts_report_with_lines', {
        p_date_from: startDate || '1900-01-01',
        p_date_to: endDate || '2099-12-31'
      });
      
      if (error) {
        console.error("❌ خطأ في جلب تقرير الحسابات والقيود:", error);
        throw error;
      }
      return data || [];
    }
  });

  // 🧠 2. بناء الشجرة (عملية خفيفة جداً للفرونت إند فقط لترتيب العرض وتطهير الأرقام)
  const treeData = useMemo(() => {
    if (!accountsReport.length) return [];

    const mapById: Record<string, any> = {};

    const sortedAccounts = [...accountsReport].sort((a: any, b: any) => {
         const codeA = a.code ? String(a.code) : '';
         const codeB = b.code ? String(b.code) : '';
         return codeA.localeCompare(codeB);
    });

    sortedAccounts.forEach(acc => {
      const safeId = String(acc.id).trim();
      
      // 🚀 تطهير الأرقام من فخ الكسور العائمة (Floating-Point Precision Fix)
      const cleanDebit = Math.round(Number(acc.total_debit || 0) * 100) / 100;
      const cleanCredit = Math.round(Number(acc.total_credit || 0) * 100) / 100;
      const cleanBalance = Math.round(Number(acc.balance || 0) * 100) / 100;

      mapById[safeId] = { 
        ...acc, 
        children: [], 
        transactions: acc.transactions || [], 
        totalDebit: cleanDebit,
        totalCredit: cleanCredit,
        balance: cleanBalance
      };
    });

    const roots: any[] = [];
    sortedAccounts.forEach(acc => {
      const safeId = String(acc.id).trim();
      const safeParentId = acc.parent_id ? String(acc.parent_id).trim() : null;
      
      if (safeParentId && mapById[safeParentId]) {
        mapById[safeParentId].children.push(mapById[safeId]);
      } else if (!safeParentId) {
        roots.push(mapById[safeId]);
      }
    });

    return roots;
  }, [accountsReport]);

  // 🧠 3. منطق البحث السريع
  const filteredTree = useMemo(() => {
    if (!searchTerm) return treeData;
    const searchLower = searchTerm.toLowerCase();
    const searchRecursive = (nodes: any[]): any[] => {
      return nodes.map(node => {
        const matchingChildren = searchRecursive(node.children);
        const isMatch = (node.name || '').toLowerCase().includes(searchLower) || (node.code && String(node.code).includes(searchLower));
        if (isMatch || matchingChildren.length > 0) return { ...node, children: matchingChildren };
        return null;
      }).filter(Boolean) as any[];
    };
    return searchRecursive(treeData);
  }, [treeData, searchTerm]);

  const paginatedTree = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTree.slice(start, start + itemsPerPage);
  }, [filteredTree, currentPage, itemsPerPage]);

  // 🚀 4. طابور العمليات (حذف الحسابات)
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
        const { error } = await supabase.from('accounts').delete().in('id', ids); 
        if (error) throw error;
    },
    onMutate: async (ids) => {
        await queryClient.cancelQueries({ queryKey: ['accounts_report_with_lines'] });
        const previous = queryClient.getQueryData(['accounts_report_with_lines']);
        queryClient.setQueryData(['accounts_report_with_lines'], (old: any[]) => old?.filter(acc => !ids.includes(acc.id)));
        return { previous };
    },
    onError: (err: any, vars, context) => {
        queryClient.setQueryData(['accounts_report_with_lines'], context?.previous);
        showToast(`حدث خطأ أثناء الحذف: ${err.message}`, 'error');
    },
    onSuccess: () => {
        setSelectedIds([]);
        showToast('تم حذف الحسابات بنجاح', 'success');
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['accounts_report_with_lines'] });
    }
  });

  // 📊 5. تصدير ميزان المراجعة إلى Excel بدقة متناهية
  const exportToExcel = () => {
    if (!accountsReport || accountsReport.length === 0) {
        showToast("لا توجد بيانات لتصديرها", "error");
        return;
    }

    // تجهيز البيانات المطهرة
    const excelData = (accountsReport as Record<string, unknown>[]).map(acc => {
        const bal = Math.round(Number(acc.balance || 0) * 100) / 100;
        return {
            "كود الحساب": acc.code || '',
            "اسم الحساب": acc.name || '',
            "إجمالي مدين": Math.round(Number(acc.total_debit || 0) * 100) / 100,
            "إجمالي دائن": Math.round(Number(acc.total_credit || 0) * 100) / 100,
            "رصيد مدين": bal > 0 ? bal : 0,
            "رصيد دائن": bal < 0 ? Math.abs(bal) : 0,
        };
    });

    // حساب الإجماليات السفلية مع التقريب لمنع الخلل العائم
    const totalDebit = Math.round(excelData.reduce((sum, row) => sum + row["إجمالي مدين"], 0) * 100) / 100;
    const totalCredit = Math.round(excelData.reduce((sum, row) => sum + row["إجمالي دائن"], 0) * 100) / 100;
    const totalBalDebit = Math.round(excelData.reduce((sum, row) => sum + row["رصيد مدين"], 0) * 100) / 100;
    const totalBalCredit = Math.round(excelData.reduce((sum, row) => sum + row["رصيد دائن"], 0) * 100) / 100;

    // إضافة سطر المجاميع
    excelData.push({
        "كود الحساب": "---",
        "اسم الحساب": "الإجماليات الكلية",
        "إجمالي مدين": totalDebit,
        "إجمالي دائن": totalCredit,
        "رصيد مدين": totalBalDebit,
        "رصيد دائن": totalBalCredit,
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // تظبيط عرض الأعمدة للإكسل
    worksheet['!cols'] = [
        { wch: 15 }, // الكود
        { wch: 45 }, // الاسم
        { wch: 20 }, // إجمالي مدين
        { wch: 20 }, // إجمالي دائن
        { wch: 20 }, // رصيد مدين
        { wch: 20 }  // رصيد دائن
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ميزان المراجعة");
    
    // التنزيل الفوري
    const fileName = `ميزان_المراجعة_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    showToast("تم تصدير ميزان المراجعة بنجاح", "success");
  };

  // ⚡ قائمة الحسابات المؤهلة كأب مرتبة حسب الكود
  const parentAccounts = useMemo(() => {
    return [...accountsReport].sort((a: any, b: any) => {
      const codeA = a.code ? String(a.code) : '';
      const codeB = b.code ? String(b.code) : '';
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    });
  }, [accountsReport]);

  // ⚡ فتح مودال الإضافة وتوليد الكود التلقائي
  const openAddModal = (presetParentId?: string) => {
    const targetParentId = presetParentId || (selectedIds.length === 1 ? selectedIds[0] : '');
    const parent = accountsReport.find((a: any) => a.id === targetParentId);
    const derivedType = parent ? getAccountTypeByCode(parent.code) : 'أصول';
    const existingCodes = accountsReport.map((a: any) => a.code);
    const nextCode = generateNextAccountCode({
      parentCode: parent?.code,
      accountType: derivedType,
      existingCodes
    });

    setFormData({
      name: '',
      code: nextCode,
      parent_id: targetParentId,
      account_type: derivedType,
      is_transactional: true
    });
    setEditingId(null);
    setIsCodeAuto(true);
    setIsModalOpen(true);
  };

  // ⚡ فتح مودال التعديل
  const openEditModal = (id?: string) => {
    const targetId = id || (selectedIds.length === 1 ? selectedIds[0] : null);
    if (!targetId) return;
    const account = accountsReport.find((a: any) => a.id === targetId);
    if (!account) return;

    setEditingId(targetId);
    setFormData({
      name: account.name || '',
      code: account.code || '',
      parent_id: account.parent_id || '',
      account_type: account.account_type || getAccountTypeByCode(account.code),
      is_transactional: account.is_transactional !== false
    });
    setIsCodeAuto(false); // الحساب الموجود يحتفظ بكوده تلقائياً
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setIsCodeAuto(true);
  };

  const handleParentChange = (parentId: string) => {
    const parent = accountsReport.find((a: any) => a.id === parentId);
    const derivedType = parent ? getAccountTypeByCode(parent.code) : formData.account_type;
    const existingCodes = accountsReport.filter((a: any) => editingId ? a.id !== editingId : true).map((a: any) => a.code);
    const nextCode = (isCodeAuto && !editingId) 
      ? generateNextAccountCode({ parentCode: parent?.code, accountType: derivedType, existingCodes })
      : formData.code;

    setFormData(prev => ({
      ...prev,
      parent_id: parentId,
      account_type: derivedType,
      code: nextCode
    }));
  };

  const handleAccountTypeChange = (type: string) => {
    const existingCodes = accountsReport.filter((a: any) => editingId ? a.id !== editingId : true).map((a: any) => a.code);
    const nextCode = (!formData.parent_id && isCodeAuto && !editingId)
      ? generateNextAccountCode({ parentCode: null, accountType: type, existingCodes })
      : formData.code;

    setFormData(prev => ({
      ...prev,
      account_type: type,
      code: nextCode
    }));
  };

  const regenerateCode = () => {
    const parent = accountsReport.find((a: any) => a.id === formData.parent_id);
    const existingCodes = accountsReport.filter((a: any) => editingId ? a.id !== editingId : true).map((a: any) => a.code);
    const nextCode = generateNextAccountCode({
      parentCode: parent?.code,
      accountType: formData.account_type,
      existingCodes
    });
    setFormData(prev => ({ ...prev, code: nextCode }));
  };

  const handleSaveAccount = async () => {
    const cleanName = formData.name.trim();
    const cleanCode = formData.code.trim();

    if (!cleanName) {
      showToast('الرجاء إدخال اسم الحساب', 'error');
      return;
    }
    if (!cleanCode) {
      showToast('الرجاء إدخال كود الحساب', 'error');
      return;
    }

    // التحقق من عدم تكرار الكود مع حساب آخر
    const duplicate = accountsReport.find((a: any) => 
      String(a.code || '').trim() === cleanCode && (editingId ? a.id !== editingId : true)
    );
    if (duplicate) {
      showToast(`الكود (${cleanCode}) مستخدم بالفعل للحساب: ${duplicate.name}`, 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        name: cleanName,
        code: cleanCode,
        parent_id: formData.parent_id || null,
        account_type: formData.account_type,
        is_transactional: formData.is_transactional
      };

      let error;
      if (editingId) {
        const res = await supabase.from('accounts').update(payload).eq('id', editingId);
        error = res.error;
      } else {
        const res = await supabase.from('accounts').insert([payload]);
        error = res.error;
      }

      if (error) throw error;

      showToast(editingId ? 'تم تحديث بيانات الحساب بنجاح!' : 'تم إضافة الحساب وتوليد الكود بنجاح!', 'success');
      closeModal();
      queryClient.invalidateQueries({ queryKey: ['accounts_report_with_lines'] });
    } catch (err: any) {
      showToast('خطأ أثناء الحفظ: ' + (err.message || err), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return { 
    paginatedTree, 
    totalPages: Math.ceil(filteredTree.length / itemsPerPage) || 1,
    currentPage, setCurrentPage, itemsPerPage, setItemsPerPage,
    isLoading, searchTerm, setSearchTerm, 
    startDate, setStartDate, endDate, setEndDate,
    expandedIds, 
    toggleExpand: (id: string) => setExpandedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]),
    expandAll: () => {
      const ids: string[] = [];
      const getIds = (nodes: any[]) => nodes.forEach(n => { ids.push(n.id); getIds(n.children); });
      getIds(treeData);
      setExpandedIds(ids);
    }, 
    collapseAll: () => setExpandedIds([]),
    selectedIds, setSelectedIds,
    toggleSelection: (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]),
    
    handleAdd: () => openAddModal(),
    handleEdit: (ids: string[]) => {
      if (ids.length === 1) openEditModal(ids[0]);
    },
    handleDelete: (ids: string[]) => { 
        if(confirm(`هل أنت متأكد من حذف ${ids.length} حساب/حسابات بجميع تفاصيلها؟`)) {
            deleteMutation.mutate(ids);
        }
    },
    isDeleting: deleteMutation.isPending,
    exportToExcel,
    // ⚡ مخرجات مودال وتوليد الأكواد
    isModalOpen, setIsModalOpen,
    openAddModal, openEditModal, closeModal,
    formData, setFormData,
    isCodeAuto, setIsCodeAuto,
    isSaving,
    parentAccounts,
    handleParentChange, handleAccountTypeChange, regenerateCode, handleSaveAccount,
    editingId
  };
}
