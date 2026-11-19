"use client";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchPaginatedData } from '@/lib/supabase-pagination';

type ClaimCostGroup = { name: string; gross: number; deduction: number; net: number; claims: Record<string, unknown>[] };
type ProjectCostGroup = { name: string; gross: number; deduction: number; net: number; itemsMap: Map<string, ClaimCostGroup> };

export function useSubcontractorCostsLogic() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🔍 فلاتر الصفحة
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState('الكل');
  const [filterItem, setFilterItem] = useState('الكل');

  // 🚀 سحب البيانات على دفعات 1000 بـ 1000 بدون تكرار
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const allRows = await fetchPaginatedData(
          () =>
            supabase
              .from('vw_subcontractor_itemized_costs')
              .select('*')
              .order('claim_date', { ascending: false })
              .order('id', { ascending: true }),
          'id'
        );
        setData(
          allRows.map((item: any, index: number) => ({
            ...item,
            _unique_key: String(item.id || index),
          }))
        );
      } catch (err) {
        console.error("خطأ في سحب تكاليف المقاولين:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // 🚀 استخراج القوائم الديناميكية للفلاتر (منع التكرار)
  const uniqueProjects = useMemo(() => {
    return Array.from(new Set(data.map(d => d.full_project_name).filter(Boolean)));
  }, [data]);

  const uniqueItems = useMemo(() => {
    return Array.from(new Set(data.map(d => d.item_name).filter(Boolean)));
  }, [data]);

  // 🚀 تصفية البيانات بناءً على اختيارات المستخدم
  const filteredData = useMemo(() => {
    return data.filter(row => {
      const matchSearch = row.contractor_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          row.claim_number?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchProject = filterProject === 'الكل' || row.full_project_name === filterProject;
      const matchItem = filterItem === 'الكل' || row.item_name === filterItem;
      return matchSearch && matchProject && matchItem;
    });
  }, [data, searchQuery, filterProject, filterItem]);

  // 🚀 الهيكل الهرمي لحساب (الإجمالي - الخصومات = الصافي)
  const hierarchy = useMemo(() => {
    const projectMap = new Map<string, ProjectCostGroup>();
    
    // إجماليات لوحة المؤشرات العلوية
    let grandGross = 0;
    let grandDeductions = 0;
    let grandNet = 0;

    filteredData.forEach(row => {
      const projName = row.full_project_name || 'فيلا / مشروع عام';
      const itemName = row.item_name || 'بند غير محدد';
      
      const gross = Number(row.gross_total || 0);
      const deduction = Number(row.material_deduction || 0);
      const net = Number(row.net_total || 0);

      // تجميع الإجماليات العامة
      grandGross += gross;
      grandDeductions += deduction;
      grandNet += net;

      // 1. تجميع على مستوى الفيلا/المشروع (الطبقة الأولى)
      if (!projectMap.has(projName)) {
        projectMap.set(projName, { 
            name: projName, 
            gross: 0, 
            deduction: 0, 
            net: 0, 
            itemsMap: new Map() 
        });
      }
      const projNode = projectMap.get(projName)!;
      projNode.gross += gross;
      projNode.deduction += deduction;
      projNode.net += net;

      // 2. تجميع على مستوى البند داخل الفيلا (الطبقة الثانية)
      if (!projNode.itemsMap.has(itemName)) {
        projNode.itemsMap.set(itemName, { 
            name: itemName, 
            gross: 0, 
            deduction: 0, 
            net: 0, 
            claims: [] 
        });
      }
      const itemNode = projNode.itemsMap.get(itemName)!;
      itemNode.gross += gross;
      itemNode.deduction += deduction;
      itemNode.net += net;
      
      // 3. المستخلصات والتفاصيل (قاعدة الهرم - الجدول)
      itemNode.claims.push(row);
    });

    // تحويل الـ Maps لمصفوفات وتمريرها مفلترة ومرتبة تنازلياً حسب الإجمالي
    const projectsArray = Array.from(projectMap.values()).map(p => ({
      ...p,
      items: Array.from(p.itemsMap.values()).sort((a, b) => b.gross - a.gross)
    })).sort((a, b) => b.gross - a.gross);

    return { 
        grandGross, 
        grandDeductions, 
        grandNet, 
        projects: projectsArray 
    };
  }, [filteredData]);

  return { 
      isLoading, 
      searchQuery, setSearchQuery, 
      filterProject, setFilterProject, 
      filterItem, setFilterItem, 
      uniqueProjects, 
      uniqueItems, 
      hierarchy 
  };
}
