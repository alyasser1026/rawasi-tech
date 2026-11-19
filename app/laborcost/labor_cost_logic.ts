"use client";
import { useState, useMemo, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { fetchPaginatedData } from '@/lib/supabase-pagination';

export function useLaborCostsLogic() {
    const [globalSearch, setGlobalSearch] = useState('');
    const deferredSearch = useDeferredValue(globalSearch);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedProject, setSelectedProject] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(20);

    // 📡 سحب البيانات من الفيو مباشرة 1000 صف ثم 1000 صف بدون تكرار
    const { data: laborData = [], isLoading } = useQuery({
        queryKey: ['vw_project_labor_costs'],
        queryFn: async () => {
            const buildQuery = () =>
                supabase
                    .from('vw_project_labor_costs')
                    .select('*')
                    .order('تاريخ اليومية', { ascending: false })
                    .order('id', { ascending: true });

            return await fetchPaginatedData(buildQuery, 'id');
        },
        staleTime: 1000 * 60 * 5,
    });

    // 🔍 استخراج قوائم الفلترة
    const uniqueMonths = useMemo(() => {
        const months = laborData.map((item: any) => item["الشهر المالي"]).filter(Boolean);
        return [...new Set(months)].sort().reverse();
    }, [laborData]);

    const uniqueProjects = useMemo(() => {
        const projects = laborData.map((item: any) => item["اسم المشروع"]).filter(Boolean);
        return [...new Set(projects)].sort();
    }, [laborData]);

    // 📊 التصفية المتعددة
    const filteredData = useMemo(() => {
        return laborData.filter((item: any) => {
            const searchLower = deferredSearch.toLowerCase();
            const matchSearch = deferredSearch ? (
                item["اسم المشروع"]?.toLowerCase().includes(searchLower) ||
                item["اسم البند المتأثر"]?.toLowerCase().includes(searchLower)
            ) : true;
            
            const matchMonth = selectedMonth ? item["الشهر المالي"] === selectedMonth : true;
            const matchProject = selectedProject ? item["اسم المشروع"] === selectedProject : true;

            return matchSearch && matchMonth && matchProject;
        });
    }, [laborData, deferredSearch, selectedMonth, selectedProject]);

    // 🏗️ التجميع الهرمي (Grouping by Project) وحساب الإجماليات
    const groupedProjects = useMemo(() => {
        const groups: Record<string, { projectName: string, totalCost: number, totalWorkers: number, items: any[] }> = {};
        
        filteredData.forEach((item: any) => {
            const pName = item["اسم المشروع"] || 'عام / غير مصنف';
            if (!groups[pName]) {
                groups[pName] = { projectName: pName, totalCost: 0, totalWorkers: 0, items: [] };
            }
            groups[pName].items.push(item);
            groups[pName].totalCost += Number(item["تكلفة العمالة الفعلية"] || 0);
            groups[pName].totalWorkers += Number(item["عدد العمال بالميدان"] || 0);
        });
        
        // ✨ معالجة الكسور العشرية العائمة لضمان دقة الأرقام 100%
        const cleanedGroups = Object.values(groups).map(group => ({
            ...group,
            totalCost: Math.round(group.totalCost * 100) / 100,
            totalWorkers: Math.round(group.totalWorkers * 100) / 100
        }));

        // ترتيب المشاريع من الأعلى تكلفة للأقل 
        return cleanedGroups.sort((a, b) => b.totalCost - a.totalCost);
    }, [filteredData]);

    const paginatedGroups = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return groupedProjects.slice(start, start + rowsPerPage);
    }, [groupedProjects, currentPage, rowsPerPage]);

    // 💰 إجمالي التكلفة الحية (محمي ضد الكسور العائمة)
    const grandTotalLaborCost = useMemo(() => {
        const total = groupedProjects.reduce((sum, group) => sum + group.totalCost, 0);
        return Math.round(total * 100) / 100;
    }, [groupedProjects]);

    // 👷 إجمالي عدد العمال الكلي (محمي ضد الكسور العائمة)
    const grandTotalWorkers = useMemo(() => {
        const total = groupedProjects.reduce((sum, group) => sum + group.totalWorkers, 0);
        return Math.round(total * 100) / 100;
    }, [groupedProjects]);

    return {
        filteredData, groupedProjects, paginatedGroups, uniqueMonths, uniqueProjects,
        isLoading, grandTotalLaborCost, grandTotalWorkers,
        globalSearch, setGlobalSearch: (v: string) => { setGlobalSearch(v); setCurrentPage(1); },
        selectedMonth, setSelectedMonth: (v: string) => { setSelectedMonth(v); setCurrentPage(1); },
        selectedProject, setSelectedProject: (v: string) => { setSelectedProject(v); setCurrentPage(1); },
        currentPage, setCurrentPage,
        rowsPerPage, setRowsPerPage: (v: number) => { setRowsPerPage(v); setCurrentPage(1); }
    };
}