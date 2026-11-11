import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchAllSupabaseData } from '@/lib/helpers';
import { notify } from '@/lib/notify';
import { generateNextPartnerCode } from '@/lib/partnerCodeGenerator';

export function usePartnersLogic() {
  const queryClient = useQueryClient();
  // 1️⃣ الحالات (States) الأساسية
  const [partners, setPartners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 2️⃣ البحث والفلترة
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('الكل');
  
  // 3️⃣ الحالات الخاصة بالاختيار (Checkboxes)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 4️⃣ نافذة الإضافة والتعديل
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); 
  const [isCodeAuto, setIsCodeAuto] = useState(true);
  
  // 🔢 حالات التحكم في الصفحات (Pagination States) - 🆕 جديد
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50); 

  const [newPartner, setNewPartner] = useState({ 
    type: 'عامل يومية', 
    name: '', 
    role: '', 
    idNumber: '',    // خاص بعمود الهوية الوطنية / الإقامة
    code: '',
    phone: '',
    address: '',
    vat_number: '',   // خاص بعمود الرقم الضريبي
    identity_expiry_date: '', // 🆕 تاريخ انتهاء الإقامة
    account_id: '' // 🚀 إضافة الحساب المالي
  });
  const [isSaving, setIsSaving] = useState(false);

  // 🔄 دالة جلب البيانات
  const fetchPartners = async () => {
    setIsLoading(true);
    // 🚀 تحديث الاستعلام لسحب اسم الحساب من جدول accounts
    try {
      const data = await fetchAllSupabaseData(supabase, 'partners', '*, account:accounts!partners_account_id_company_fkey(name)', 'code', true);
      
      const formattedData = data.map((p: any) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        type: p.partner_type,
        role: p.job_role || '---',
        idNumber: p.identity_number || '---',
        phone: p.phone || '---',
        address: p.address || '---',
        vat_number: p.vat_number || '---',
        identity_expiry_date: p.identity_expiry_date || '',
        account_id: p.account_id, // 🚀
        account_name: p.account?.name || 'غير مربوط' // 🚀
      }));
      setPartners(formattedData);
    } catch (error) {
      console.error('Error fetching partners:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  // 💾 دالة الحفظ
  const handleSavePartner = async () => {
    if (!newPartner.name || !newPartner.code) {
      return notify('الرجاء إدخال الاسم والكود!');
    }
    
    setIsSaving(true);
    const partnerData = {
      code: newPartner.code,
      name: newPartner.name,
      partner_type: newPartner.type,
      job_role: newPartner.role,
      identity_number: newPartner.idNumber,
      phone: newPartner.phone,
      address: newPartner.address,
      vat_number: newPartner.vat_number,
      identity_expiry_date: newPartner.identity_expiry_date || null,
      account_id: newPartner.account_id || null // 🚀 حفظ الحساب في قاعدة البيانات
    };

    let error;
    if (editingId) {
      const { error: updateError } = await supabase
        .from('partners')
        .update(partnerData)
        .eq('id', editingId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('partners')
        .insert([partnerData]);
      error = insertError;
    }

    if (error) {
      notify('خطأ في العملية: ' + error.message);
    } else {
      notify(editingId ? 'تم تحديث البيانات بنجاح!' : 'تم إضافة الشريك بنجاح!');
      closeModal();
      fetchPartners();
      queryClient.invalidateQueries({ queryKey: ['sub_contractors_list'] });
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      queryClient.invalidateQueries({ queryKey: ['job_orders'] });
    }
    setIsSaving(false);
  };

  // 🗑️ دالة الحذف
  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الكيان نهائياً من سجلات فاي تك؟')) {
      const { error } = await supabase.from('partners').delete().eq('id', id);
      if (error) notify('خطأ في الحذف: ' + error.message);
      else {
        fetchPartners();
        queryClient.invalidateQueries({ queryKey: ['sub_contractors_list'] });
        queryClient.invalidateQueries({ queryKey: ['partners'] });
      }
    }
  };

  // ⚡ التوليد التلقائي والتحكم في كود الشريك
  const openAddModal = () => {
    setIsCodeAuto(true);
    const existingCodes = partners.map(p => p.code);
    const nextCode = generateNextPartnerCode('عامل يومية', '', existingCodes);
    setNewPartner({
      type: 'عامل يومية',
      name: '',
      role: '',
      idNumber: '',
      code: nextCode,
      phone: '',
      address: '',
      vat_number: '',
      identity_expiry_date: '',
      account_id: ''
    });
    setEditingId(null);
    setIsAddModalOpen(true);
  };

  const handlePartnerTypeChange = (type: string) => {
    const existingCodes = partners.map(p => p.code);
    setNewPartner(prev => ({
      ...prev,
      type,
      code: (!editingId && isCodeAuto) ? generateNextPartnerCode(type, prev.role, existingCodes) : prev.code
    }));
  };

  const handlePartnerRoleChange = (role: string) => {
    const existingCodes = partners.map(p => p.code);
    setNewPartner(prev => ({
      ...prev,
      role,
      code: (!editingId && isCodeAuto) ? generateNextPartnerCode(prev.type, role, existingCodes) : prev.code
    }));
  };

  const regenerateCode = () => {
    const existingCodes = partners.filter(p => editingId ? p.id !== editingId : true).map(p => p.code);
    const nextCode = generateNextPartnerCode(newPartner.type, newPartner.role, existingCodes);
    setNewPartner(prev => ({ ...prev, code: nextCode }));
  };

  // ✏️ التعديل
  const handleEdit = (partner: any) => {
    setEditingId(partner.id);
    setIsCodeAuto(false); // شريك موجود يحتفظ بكوده تلقائياً ما لم يتم تغييره يدوياً
    setNewPartner({
      type: partner.type,
      name: partner.name,
      role: partner.role === '---' ? '' : partner.role,
      idNumber: partner.idNumber === '---' ? '' : partner.idNumber,
      code: partner.code,
      phone: partner.phone === '---' ? '' : partner.phone,
      address: partner.address === '---' ? '' : partner.address,
      vat_number: partner.vat_number === '---' ? '' : partner.vat_number,
      identity_expiry_date: partner.identity_expiry_date || '',
      account_id: partner.account_id || '' // 🚀 تمرير الحساب للتعديل
    });
    setIsAddModalOpen(true);
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingId(null);
    setIsCodeAuto(true);
    setNewPartner({ type: 'عامل يومية', name: '', role: '', idNumber: '', code: '', phone: '', address: '', vat_number: '', identity_expiry_date: '', account_id: '' }); // 🚀 تفريغ الحساب
    setSelectedIds([]);
  };

  // 🔍 الفلترة الأساسية (قبل التقسيم لصفحات)
  const allFilteredData = useMemo(() => {
    return partners.filter(p => {
      const s = searchTerm.toLowerCase();
      const matchesSearch = 
        p.name.toLowerCase().includes(s) || 
        p.code.toLowerCase().includes(s) || 
        p.phone.includes(s) ||
        p.idNumber.includes(s) ||
        p.vat_number.includes(s);
      const matchesType = filterType === 'الكل' || p.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [searchTerm, filterType, partners]);

  // 📑 حسابات الصفحات - 🆕 جديد
  const totalResults = allFilteredData.length;
  const totalPages = Math.ceil(totalResults / rowsPerPage);

  // ✂️ استقطاع البيانات للصفحة الحالية فقط
  const filteredPartners = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return allFilteredData.slice(startIndex, startIndex + rowsPerPage);
  }, [allFilteredData, currentPage, rowsPerPage]);

  // ريست لصفحة 1 عند البحث أو تغيير الفلتر
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, rowsPerPage]);

  // 📊 الإحصائيات
  const stats = {
    total: partners.length,
    employees: partners.filter(p => p.type === 'موظف' || p.type === 'جهة داخلية').length,
    labor: partners.filter(p => p.type === 'عامل يومية').length,
    contractors: partners.filter(p => p.type === 'مقاول').length
  };

  // 📤 تصدير إكسل
  const exportToExcel = () => {
    // 🚀 إضافة الحساب المالي في التصدير
    const dbHeaders = ["code", "name", "partner_type", "job_role", "identity_number", "identity_expiry_date", "phone", "address", "vat_number", "account_name"];
    const rows = allFilteredData.map(p => [
      p.code, p.name, p.type, p.role !== '---' ? p.role : '', p.idNumber !== '---' ? p.idNumber : '', 
      p.identity_expiry_date, p.phone !== '---' ? p.phone : '', p.address !== '---' ? p.address : '', p.vat_number !== '---' ? p.vat_number : '', p.account_name
    ]);
    const csvContent = "\ufeff" + [dbHeaders, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `RYC_Data_${new Date().getTime()}.csv`);
    link.click();
  };

  // 🖨️ الطباعة
  const handlePrint = () => { window.print(); };

  const getTypeStyle = (type: string) => {
    switch(type) {
      case 'موظف': return { bg: '#E0F2FE', color: '#0369A1', icon: '👔' };
      case 'عامل يومية': return { bg: '#DCFCE7', color: '#166534', icon: '👷' };
      case 'مقاول': return { bg: '#FEF3C7', color: '#B45309', icon: '🏗️' };
      case 'عميل': return { bg: '#F3E8FF', color: '#6B21A8', icon: '🏢' };
      case 'جهة داخلية': return { bg: '#F3F4F6', color: '#374151', icon: '🏛️' };
      default: return { bg: '#FEE2E2', color: '#991B1B', icon: '👤' };
    }
  };

  return {
    isLoading, searchTerm, setSearchTerm, filterType, setFilterType,
    isAddModalOpen, setIsAddModalOpen: (open: boolean) => open ? openAddModal() : closeModal(), handleEdit, openAddModal,
    newPartner, setNewPartner, isSaving, handleSavePartner,
    filteredPartners, stats, getTypeStyle, handleDelete, exportToExcel, handlePrint,
    selectedIds, setSelectedIds, editingId,
    // مخرجات الصفحات الجديدة 🆕
    currentPage, setCurrentPage,
    rowsPerPage, setRowsPerPage,
    totalPages, totalResults,
    // توليد الأكواد التلقائي الذكي ⚡
    isCodeAuto, setIsCodeAuto,
    handlePartnerTypeChange, handlePartnerRoleChange, regenerateCode
  };
}
