"use client";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

type CostGroup = { name: string; total: number; items: Record<string, unknown>[] };
type ProjectGroup = { name: string; total: number; types: Map<string, CostGroup> };

export function useLedgerLogic() {
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🔍 فلاتر الصفحة
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('الكل');
  const [filterProject, setFilterProject] = useState('الكل');

  // 🚀 سحب البيانات مع رفع حساسية التعامل مع الـ Unique Keys
  useEffect(() => {
    const fetchLedger = async () => {
      setIsLoading(true);
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      try {
        while (hasMore) {
          const { data, error } = await supabase
            .from('vw_project_comprehensive_ledger')
            .select('*')
            .range(from, from + step - 1)
            .order('التاريخ', { ascending: false });

          if (error) {
            console.error("خطأ في سحب كشف الحساب:", error.message);
            break;
          }

          if (data && data.length > 0) {
            // 👈 رفع الحساسية: إضافة مفتاح فريد لكل صف فور وصوله
            const processedBatch = data.map((item, index) => ({
              ...item,
              _unique_key: `${item.id || 'row'}-${from + index}` 
            }));
            allData = [...allData, ...processedBatch];
            
            if (data.length < step) {
              hasMore = false;
            } else {
              from += step;
            }
          } else {
            hasMore = false;
          }
        }
        setLedgerData(allData);
      } catch (err) {
        console.error("حدث خطأ غير متوقع:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLedger();
  }, []);

  // قائمة المشاريع للفلتر
  const uniqueProjects = useMemo(() => {
    const projects = ledgerData.map(item => item['اسم المشروع']).filter(Boolean);
    return Array.from(new Set(projects));
  }, [ledgerData]);

  // تصفية البيانات
  const filteredLedger = useMemo(() => {
    return ledgerData.filter((row: any) => {
      const matchSearch = row['البيان / البند']?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterType === 'الكل' || row['نوع التكلفة'] === filterType;
      const matchProject = filterProject === 'الكل' || row['اسم المشروع'] === filterProject;
      return matchSearch && matchType && matchProject;
    });
  }, [ledgerData, searchQuery, filterType, filterProject]);

  // 🚀 بناء "الهرم المالي" الشامل لجميع أنواع التكاليف
  const pyramidData = useMemo(() => {
    let grandTotal = 0;
    let totalLabor = 0;
    let totalOverhead = 0;
    let totalMaterials = 0; // 👈 إجمالي الخامات
    let totalSubcontractors = 0; // 👈 إجمالي المقاولين
    const projectMap = new Map<string, ProjectGroup>();

    filteredLedger.forEach((row: any) => {
      const projName = row['اسم المشروع'] || 'مشروع عام / غير محدد';
      const costType = row['نوع التكلفة'];
      const amount = Number(row['التكلفة المحملة (جنيه)'] || 0);

      // 1. حساب الإجماليات لرأس الهرم ولوحة المؤشرات
      grandTotal += amount;
      if (costType === 'عمالة مباشرة') {
          totalLabor += amount;
      } else if (costType === 'خامات ومواد') { // 👈 فصل الخامات
          totalMaterials += amount;
      } else if (costType === 'مصروفات مقاولين') { // 👈 فصل المقاولين
          totalSubcontractors += amount;
      } else {
          totalOverhead += amount;
      }

      // 2. تجميع على مستوى المشروع
      let projNode = projectMap.get(projName);
      if (!projNode) {
        projNode = { name: projName, total: 0, types: new Map() };
        projectMap.set(projName, projNode);
      }
      projNode.total += amount;

      // 3. تجميع على مستوى نوع التكلفة
      let typeNode = projNode.types.get(costType);
      if (!typeNode) {
        typeNode = { name: costType, total: 0, items: [] };
        projNode.types.set(costType, typeNode);
      }
      typeNode.total += amount;
      
      // 4. التفاصيل
      typeNode.items.push(row);
    });

    const projectsArray = Array.from(projectMap.values()).map(p => ({
      ...p,
      types: Array.from(p.types.values()).sort((a, b) => b.total - a.total)
    })).sort((a, b) => b.total - a.total);

    return {
      grandTotal,
      totalLabor,
      totalOverhead,
      totalMaterials, // 👈 تصدير الخامات
      totalSubcontractors, // 👈 تصدير المقاولين
      projects: projectsArray
    };
  }, [filteredLedger]);

  return {
    isLoading,
    searchQuery, setSearchQuery,
    filterType, setFilterType,
    filterProject, setFilterProject,
    uniqueProjects,
    pyramidData
  };
}
