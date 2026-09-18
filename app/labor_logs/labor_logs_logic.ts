"use client";
import { useState, useMemo, useEffect, useDeferredValue } from 'react'; 
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; 
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx-js-style';
import { fetchAllSupabaseData, formatCurrency, formatDate } from '@/lib/helpers'; 
import { useToast } from '@/lib/toast-context'; 

export function useLaborLogsLogic() {
    const queryClient = useQueryClient(); 
    const { showToast } = useToast();

    // 🎯 دالة سحرية مساعدة لتحديث الكاش
    const updateRowsInCache = (targetIds: any[], updatedFields: any) => {
        queryClient.setQueryData(['labor_logs'], (oldData: any[]) => {
            if (!oldData) return [];
            const stringIds = targetIds.map(String);
            return oldData.map(row => 
                stringIds.includes(String(row.id)) ? { ...row, ...updatedFields } : row 
            );
        });
    };

    const DEBIT_ACCOUNT_ID = '70d181ba-6385-4c1e-b0fc-d5b1f800dd2c'; 
    const CREDIT_ACCOUNT_ID = '39f878cd-dc58-4a2a-a199-50f6fca983d4'; 

    const [searchTerm, setSearchTerm] = useState(''); 
    const deferredSearch = useDeferredValue(searchTerm);
    const [filterStatus, setFilterStatus] = useState('الكل');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // 🚀 تحديث Default Log (تم إزالة boq_budget_id ليتطابق مع الإسكيمة الجديدة)
    const defaultLog = { 
        work_date: new Date().toISOString().split('T')[0], 
        worker_name: '', site_ref: '', work_item: '', 
        unit: '', skill_level: '', production_desc: '', 
        tareeha: '', productivity: '', completion_percentage: '', 
        daily_wage: '', attendance_value: 1, notes: '',
        worker_partner_id: '', project_id: '',
        work_item_id: null, 
        sub_contractor: '', sub_contractor_id: null,
        credit_account_id: CREDIT_ACCOUNT_ID, credit_account_name: 'رواتب وأجور مستحقة'
    };
    
    const [currentLog, setCurrentLog] = useState<any>(defaultLog);

    const { data: logs = [], isLoading: isLogsLoading } = useQuery({
        queryKey: ['labor_logs'],
        queryFn: () => fetchAllSupabaseData(supabase, 'labor_daily_logs'),
        staleTime: 1000 * 60 * 5, 
    });

    const { data: partners = [], isLoading: isPartnersLoading } = useQuery({
        queryKey: ['partners'],
        queryFn: () => fetchAllSupabaseData(supabase, 'partners'),
        staleTime: 1000 * 60 * 60, 
    });

    const workersList = useMemo(() => partners.filter((p: any) => p.partner_type === 'عامل يومية' || p.partner_type === 'موظف'), [partners]);
    const sitesList = useMemo(() => partners.filter((p: any) => p.partner_type === 'جهة داخلية' || p.partner_type === 'عميل' || p.partner_type === 'مقاول'), [partners]);

    useEffect(() => {
        const handleDateChange = (e: any) => { setDateFrom(e.detail?.start || ''); setDateTo(e.detail?.end || ''); setCurrentPage(1); };
        const handleSearchChange = (e: any) => { setSearchTerm(e.detail || ''); setCurrentPage(1); };
        window.addEventListener('globalDateFilter', handleDateChange as EventListener);
        window.addEventListener('globalSearch', handleSearchChange as EventListener);
        return () => {
            window.removeEventListener('globalDateFilter', handleDateChange as EventListener);
            window.removeEventListener('globalSearch', handleSearchChange as EventListener);
        };
    }, []);

    const allFiltered = useMemo(() => {
        if (!logs) return [];
        const uniqueLogsMap = new Map();
        logs.forEach((item: any) => { if (item && item.id) uniqueLogsMap.set(item.id, item); });
        const uniqueLogs = Array.from(uniqueLogsMap.values());

        const sortedLogs = [...uniqueLogs].sort((a: any, b: any) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime());
        
        return sortedLogs.filter((log: any) => {
            const search = (deferredSearch || '').toLowerCase().trim();
            const matchesGlobal = search === '' || 
                                  (log.worker_name || '').toLowerCase().includes(search) || 
                                  (log.site_ref || '').toLowerCase().includes(search) || 
                                  (log.work_item || '').toLowerCase().includes(search) ||
                                  (log.production_desc || '').toLowerCase().includes(search) ||
                                  (log.notes || '').toLowerCase().includes(search);
            
            const matchesStatus = filterStatus === 'الكل' || 
                                  (filterStatus === 'معتمد' && log.is_posted === true) || 
                                  (filterStatus === 'معلق' && (log.is_posted === false || log.is_posted === null));
            
            const logDate = new Date(log.work_date);
            const matchesFrom = dateFrom ? logDate >= new Date(dateFrom) : true;
            const matchesTo = dateTo ? logDate <= new Date(dateTo) : true;

            return matchesGlobal && matchesStatus && matchesFrom && matchesTo;
        });
    }, [logs, deferredSearch, filterStatus, dateFrom, dateTo]);

    const stats = useMemo(() => {
        if (!allFiltered || allFiltered.length === 0) return { sum: 0, attendance: 0, count: 0 };
        const sum = allFiltered.reduce((acc: number, row: any) => {
            const totalWage = Number(row.daily_wage || 0);
            return acc + Math.max(0, totalWage);
        }, 0);
        const attendance = allFiltered.reduce((acc: number, row: any) => acc + Number(row.attendance_value || 0), 0);
        return { sum, attendance, count: allFiltered.length };
    }, [allFiltered]);

    const totalPages = Math.max(1, Math.ceil(allFiltered.length / rowsPerPage));

    const saveMutation = useMutation({
        mutationFn: async (payload: any) => {
            if (editingId) {
                const { data: existing } = await supabase.from('labor_daily_logs').select('is_posted, status').eq('id', editingId).single();
                if (existing && (existing.is_posted || existing.status === 'مرحل' || existing.status === 'معتمد')) {
                    throw new Error("لا يمكن تعديل سجل عمالة مرحل. يرجى فك الترحيل أولاً.");
                }
                const { data, error } = await supabase.from('labor_daily_logs').update(payload).eq('id', editingId).select().single();
                if (error) throw error;
                return { type: 'update', data };
            } else {
                const { data, error } = await supabase.from('labor_daily_logs').insert([payload]).select().single();
                if (error) throw error;
                return { type: 'insert', data };
            }
        },
        onSuccess: (res) => {
            showToast('تم الحفظ بنجاح 🚀', 'success');
            setIsAddModalOpen(false);
            setEditingId(null);
            setCurrentLog(defaultLog);
            if (res && res.data) {
                queryClient.setQueryData(['labor_logs'], (oldData: any[]) => {
                    if (!oldData) return [res.data];
                    if (res.type === 'update') {
                        return oldData.map(log => String(log.id) === String(res.data.id) ? { ...log, ...res.data } : log);
                    } else {
                        return [res.data, ...oldData];
                    }
                });
            }
        },
        onError: (err: any) => showToast(`فشل الحفظ: ${err.message}`, 'error')
    });

    const handleSaveLog = () => {
        if (!currentLog.worker_name) return showToast('يجب إدخال اسم العامل!', 'error');
        if (!currentLog.job_order_id && currentLog.project_id) return showToast('يرجى تحديد أمر الشغل للموقع لربطه بالميزانية بشكل صحيح ⚠️', 'error');

        let finalPercentage = currentLog.completion_percentage;
        const t = parseFloat(currentLog.tareeha);
        const p = parseFloat(currentLog.productivity);
        
        if (!isNaN(t) && t > 0 && !isNaN(p)) {
            finalPercentage = Math.round((p / t) * 100);
        }

        // 🛡️ تأمين البيانات
        const payload = {
            work_date: currentLog.work_date, 
            worker_name: currentLog.worker_name, 
            site_ref: currentLog.site_ref || null,
            job_order_id: currentLog.job_order_id || null,
            work_item: currentLog.work_item || null, 
            unit: currentLog.unit || null,                                   
            skill_level: currentLog.skill_level || null,                     
            production_desc: currentLog.production_desc || null,             
            tareeha: currentLog.tareeha ? String(currentLog.tareeha) : null,
            productivity: currentLog.productivity ? String(currentLog.productivity) : null,
            completion_percentage: finalPercentage ? Number(finalPercentage) : null,
            daily_wage: Number(currentLog.daily_wage) || 0,
            attendance_value: Number(currentLog.attendance_value ?? 1), 
            notes: currentLog.notes || null,
            worker_partner_id: currentLog.worker_partner_id || null,
            project_id: currentLog.project_id || null,
            work_item_id: currentLog.work_item_id || null, // ✅ سحب ID البند المرجعي (يكفي الآن)
            sub_contractor: currentLog.sub_contractor || null,
            sub_contractor_id: currentLog.sub_contractor_id || null,
            credit_account_id: CREDIT_ACCOUNT_ID,
            debit_account_id: DEBIT_ACCOUNT_ID
        };
        
        saveMutation.mutate(payload);
    };

    const deleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            for (const logId of ids) {
                const { data: existing } = await supabase.from('labor_daily_logs').select('is_posted').eq('id', logId).single();
                if (existing && existing.is_posted) {
                    throw new Error("لا يمكن حذف سجلات مرحلة. يرجى فك الترحيل أولاً.");
                }
            }
            const previousData = queryClient.getQueryData(['labor_logs']);
            const stringDeletedIds = ids.map(String);
            queryClient.setQueryData(['labor_logs'], (oldData: any[]) => {
                if (!oldData) return [];
                return oldData.filter(log => !stringDeletedIds.includes(String(log.id)));
            });

            const { error } = await supabase.rpc('delete_labor_logs_bulk', { p_ids: ids });
            if (error) {
                queryClient.setQueryData(['labor_logs'], previousData);
                throw error;
            }
            return ids; 
        },
        onSuccess: () => {
            showToast('تم الحذف بنجاح 🗑️', 'success');
            setSelectedIds([]);
        },
        onError: (err: any) => showToast(`خطأ في الحذف: ${err.message}`, 'error')
    });

    const postMutation = useMutation({
        mutationFn: async (idsToPost: string[]) => {
            if (!idsToPost || idsToPost.length === 0) throw new Error('لا يوجد سجلات للترحيل');
            const previousData = queryClient.getQueryData(['labor_logs']);
            updateRowsInCache(idsToPost, { is_posted: true });

            const { error } = await supabase.rpc('post_labor_logs_bulk', { p_ids: idsToPost });
            if (error) {
                queryClient.setQueryData(['labor_logs'], previousData); 
                throw error;
            }
        },
        onSuccess: () => {
            showToast('تم الترحيل وسماع كشف الحساب بنجاح ✅', 'success');
            setSelectedIds([]);
        },
        onError: (err: any) => showToast(`فشل الترحيل: ${err.message}`, 'error')
    });

    const unpostMutation = useMutation({
        mutationFn: async (idsToSuspend: string[]) => {
            if (!idsToSuspend || idsToSuspend.length === 0) throw new Error('لا يوجد سجلات للتعليق');
            const previousData = queryClient.getQueryData(['labor_logs']);
            updateRowsInCache(idsToSuspend, { is_posted: false });

            const { error } = await supabase.rpc('unpost_labor_logs_bulk', { record_ids: idsToSuspend });
            if (error) {
                queryClient.setQueryData(['labor_logs'], previousData); 
                throw error;
            }
        },
        onSuccess: () => {
            showToast('تم إلغاء الترحيل وتطهير الحسابات بنجاح ⏸️', 'warning');
            setSelectedIds([]);
        },
        onError: (err: any) => showToast(`عذراً: ${err.message}`, 'error')
    });

    const exportToExcel = () => {
        const data = allFiltered.map(log => {
            const totalWage = Number(log.daily_wage || 0);
            return {
                'التاريخ': log.work_date,
                'اسم العامل': log.worker_name,
                'الموقع': log.site_ref || '-',
                'البند': log.work_item || '-',
                'الوحدة': log.unit || '-',
                'مستوى المهارة': log.skill_level || '-',
                'الطريحة': log.tareeha || '-',
                'الإنتاجية': log.productivity || '-',
                'الإنجاز': log.completion_percentage ? `${log.completion_percentage}%` : '-',
                'اليومية': totalWage,
                'الصافي الفعلي': Math.max(0, totalWage),
                'الحضور': log.attendance_value === 1 ? 'يوم كامل' : log.attendance_value === 0.5 ? 'نصف يوم' : 'غياب',
                'ملاحظات': log.notes || '-',
                'الحالة': log.is_posted ? 'معتمد' : 'معلق'
            }
        });

        // Add Totals Row
        const totalAmount = data.reduce((sum, row) => sum + (Number(row['الصافي الفعلي']) || 0), 0);
        data.push({
            'التاريخ': 'الإجمالي الكلي',
            'اسم العامل': '-',
            'الموقع': '-',
            'البند': '-',
            'الوحدة': '-',
            'مستوى المهارة': '-',
            'الطريحة': '-',
            'الإنتاجية': '-',
            'الإنجاز': '-',
            'اليومية': totalAmount,
            'الصافي الفعلي': totalAmount,
            'الحضور': '-',
            'ملاحظات': '-',
            'الحالة': '-'
        });

        const ws = XLSX.utils.json_to_sheet(data);

        // Styling
        const range = XLSX.utils.decode_range(ws['!ref'] || '');
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const address = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[address]) continue;
                
                const isHeader = R === 0;
                const isTotal = R === range.e.r;

                ws[address].s = {
                    font: { 
                        bold: isHeader || isTotal,
                        color: { rgb: isHeader ? "FFFFFF" : (isTotal ? "000000" : "333333") }
                    },
                    fill: { 
                        fgColor: { rgb: isHeader ? "1E293B" : (isTotal ? "E2E8F0" : "FFFFFF") } 
                    },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thin", color: { auto: 1 } },
                        bottom: { style: "thin", color: { auto: 1 } },
                        left: { style: "thin", color: { auto: 1 } },
                        right: { style: "thin", color: { auto: 1 } }
                    }
                };
            }
        }

        ws['!cols'] = [
            { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 15 },
            { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
            { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
            { wch: 25 }, { wch: 10 }
        ];

        ws['!dir'] = 'rtl';

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "يوميات_العمالة_كشف_حساب");
        XLSX.writeFile(wb, "يوميات_العمالة.xlsx");
        showToast('تم تصدير الإكسل بتنسيق جديد 📊', 'success');
    };

    const getAttendanceStyle = (status: string) => {
        if (!status) return { bg: '#f1f5f9', color: '#64748b' };
        if (status.includes('1') || status.includes('حاضر')) return { bg: '#dcfce7', color: '#166534' };
        if (status.includes('0') || status.includes('غائب')) return { bg: '#ffe4e6', color: '#be123c' };
        return { bg: '#fef3c7', color: '#b45309' }; 
    };

    const toggleSelectAll = (checked: boolean) => setSelectedIds(checked ? allFiltered.map((r:any) => r.id) : []);
    const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

    return {
        isLoading: isLogsLoading || isPartnersLoading, 
        searchTerm, setSearchTerm: (term: string) => { setSearchTerm(term); setCurrentPage(1); }, 
        filterStatus, setFilterStatus: (status: string) => { setFilterStatus(status); setCurrentPage(1); }, 
        dateFrom, setDateFrom, dateTo, setDateTo,
        filteredLogs: allFiltered, 
        stats, totalResults: allFiltered.length,
        selectedIds, setSelectedIds, currentPage, setCurrentPage, rowsPerPage, setRowsPerPage, totalPages, 
        isAddModalOpen, setIsAddModalOpen, currentLog, setCurrentLog, defaultLog,
        isSaving: saveMutation.isPending, 
        isPosting: postMutation.isPending, 
        isSuspending: unpostMutation.isPending, 
        editingId, setEditingId,
        workersList, sitesList,
        handleSaveLog, 
        handleEdit: (log: any) => { setEditingId(log.id); setCurrentLog({ ...log }); setIsAddModalOpen(true); }, 
        handleDelete: (id: string) => { if (confirm('تأكيد الحذف؟')) deleteMutation.mutate([id]); }, 
        handleDeleteSelected: () => { if (confirm(`حذف ${selectedIds.length} سجل نهائياً؟`)) deleteMutation.mutate(selectedIds); }, 
        handlePostSingle: (id: string) => postMutation.mutate([id]), 
        handlePostSelected: () => postMutation.mutate(selectedIds), 
        handleSuspendSingle: (id: string) => unpostMutation.mutate([id]), 
        handleSuspendSelected: () => unpostMutation.mutate(selectedIds), 
        exportToExcel, getAttendanceStyle, toggleSelectAll, toggleSelect, formatCurrency, formatDate
    };
}