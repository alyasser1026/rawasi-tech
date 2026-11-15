"use client";
import { useState, useMemo, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { fetchDailyWorkerExpenseAllocations } from '@/lib/dailyWorkerExpenseAllocation';
import { useCompany } from '@/lib/CompanyContext';

export function useOverheadAllocationsLogic() {
    const { activeCompanyId } = useCompany();
    const [globalSearch, setGlobalSearch] = useState('');
    const deferredSearch = useDeferredValue(globalSearch);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedProject, setSelectedProject] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(20);

    // 📡 جلب البيانات الموزعة حسب اليوم وعدد العمالة على الفلل وأوامر الشغل
    const { data: allocationsData = [], isLoading } = useQuery({
        queryKey: ['advanced_cost_allocation_view', activeCompanyId],
        queryFn: async () => {
            return await fetchDailyWorkerExpenseAllocations(supabase, {
                companyId: activeCompanyId || null,
            });
        }
    });

    // 🔍 استخراج قوائم الفلترة
    const uniqueMonths = useMemo(() => {
        const months = allocationsData.map((item: any) => item["شهر التحميل المالي"]).filter(Boolean);
        return [...new Set(months)].sort().reverse();
    }, [allocationsData]);

    const uniqueProjects = useMemo(() => {
        const projects = allocationsData.map((item: any) => item["اسم الفيلا المحمل عليها"]).filter(Boolean);
        return [...new Set(projects)].sort();
    }, [allocationsData]);

    // 📊 التصفية المتعددة
    const filteredData = useMemo(() => {
        return allocationsData.filter((item: any) => {
            const searchLower = deferredSearch.toLowerCase();
            const matchSearch = deferredSearch ? (
                item["اسم الفيلا المحمل عليها"]?.toLowerCase().includes(searchLower) ||
                item["البيان / الوصف"]?.toLowerCase().includes(searchLower) ||
                item["التصنيف الرئيسي"]?.toLowerCase().includes(searchLower)
            ) : true;
            
            const matchMonth = selectedMonth ? item["شهر التحميل المالي"] === selectedMonth : true;
            const matchProject = selectedProject ? item["اسم الفيلا المحمل عليها"] === selectedProject : true;

            return matchSearch && matchMonth && matchProject;
        });
    }, [allocationsData, deferredSearch, selectedMonth, selectedProject]);

    // 🏗️ التجميع الهرمي (Grouping by Project)
    const groupedProjects = useMemo(() => {
        const groups: Record<string, { projectName: string, totalAmount: number, items: any[] }> = {};
        
        filteredData.forEach((item: any) => {
            const pName = item["اسم الفيلا المحمل عليها"] || 'عام / غير موزع';
            if (!groups[pName]) {
                groups[pName] = { projectName: pName, totalAmount: 0, items: [] };
            }
            groups[pName].items.push(item);
            groups[pName].totalAmount += Number(item["المبلغ المحمل (ر.س)"] || 0);
        });
        
        // ترتيب المشاريع من الأعلى تحميلاً للأقل
        return Object.values(groups).sort((a, b) => b.totalAmount - a.totalAmount);
    }, [filteredData]);

    // 📄 تقسيم المشاريع لصفحات
    const paginatedGroups = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return groupedProjects.slice(start, start + rowsPerPage);
    }, [groupedProjects, currentPage, rowsPerPage]);

    // 💰 حساب الإجمالي العام
    const totalAllocatedOverhead = useMemo(() => {
        return groupedProjects.reduce((sum, group) => sum + group.totalAmount, 0);
    }, [groupedProjects]);

    return {
        filteredData, groupedProjects, paginatedGroups, uniqueMonths, uniqueProjects,
        isLoading, totalAllocatedOverhead,
        globalSearch, setGlobalSearch: (v: string) => { setGlobalSearch(v); setCurrentPage(1); },
        selectedMonth, setSelectedMonth: (v: string) => { setSelectedMonth(v); setCurrentPage(1); },
        selectedProject, setSelectedProject: (v: string) => { setSelectedProject(v); setCurrentPage(1); },
        currentPage, setCurrentPage,
        rowsPerPage, setRowsPerPage: (v: number) => { setRowsPerPage(v); setCurrentPage(1); }
    };
}