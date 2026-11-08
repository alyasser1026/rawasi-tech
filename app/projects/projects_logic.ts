"use client";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query'; 
import { useToast } from '@/lib/toast-context';
import { fetchAllSupabaseData } from '@/lib/helpers';
import { notify } from '@/lib/notify';

// دالة تطهير النصوص لضمان تطابق البحث في المصروفات
const normalizeArabic = (str: string) => {
  if (!str) return '';
  return str.trim().toLowerCase()
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ');
};

export function useProjectsLogic() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]); 
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  
  const [projectDetails, setProjectDetails] = useState<any>({
    stages: [], boq: [], expenses: [], ledger: [], invoices: [], inspections: [], laborStats: null, materials: [], contractorAssignments: []
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); 

  // فلاتر السايد بار
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('الكل');
  const [filterClient, setFilterClient] = useState('الكل');
  const [filterStage, setFilterStage] = useState('الكل'); 
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const availableStages = useMemo(() => {
      const stages = projects.map(p => p.current_stage).filter(Boolean);
      return Array.from(new Set(stages));
  }, [projects]);

  const defaultProjectRecord = {
      project_code: '', Property: '', unit_type: '', unit_area: '', client_id: '', contract_value: '', 
      estimated_budget: '', down_payment: '', start_date: '', end_date: '', 
      location_address: '', project_manager: '', 
      engineer_in_charge: '', engineer_phone: '', 
      status: 'قيد الدراسة', current_stage: 'تجهيز الموقع', notes: ''
  };
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [currentProjectRecord, setCurrentProjectRecord] = useState<any>(defaultProjectRecord);

  const saveProjectMutation = useMutation({
      mutationFn: async (payload: any) => {
          if (payload.id) {
              const { error } = await supabase.from('projects').update(payload).eq('id', payload.id);
              if (error) throw error;
              return payload; 
          } else {
              // 🚀 تم إزالة الأقواس المربعة
              const { error } = await supabase.from('projects').insert(payload);
              if (error) throw error;
              return null;
          }
      },
      onSuccess: (updatedPayload) => {
          showToast("تم الحفظ بنجاح", "success");
          setIsAddProjectModalOpen(false);
          setCurrentProjectRecord(defaultProjectRecord);
          fetchData(); 
          
          if (updatedPayload && selectedProject?.id === updatedPayload.id) {
              setSelectedProject({ ...selectedProject, ...updatedPayload });
          }
      },
      onError: (err: any) => showToast(`خطأ في الحفظ: ${err.message}`, "error")
  });

  const deleteProjectMutation = useMutation({
      mutationFn: async (id: string) => {
          const { error } = await supabase.from('projects').delete().eq('id', id);
          if (error) throw error;
      },
      onSuccess: () => {
          showToast("تم حذف المشروع نهائياً", "success");
          setSelectedProject(null); 
          fetchData(); 
      },
      onError: (err: any) => showToast(`خطأ في الحذف: ${err.message}`, "error")
  });

  const handleSaveProject = () => {
      if (!currentProjectRecord.Property) return showToast("اسم العقار/المشروع مطلوب!", "error");
      
      const payload: any = {
          project_code: currentProjectRecord.project_code || null,
          Property: currentProjectRecord.Property,
          unit_type: currentProjectRecord.unit_type || null,
          unit_area: Number(currentProjectRecord.unit_area) || 0,
          client_id: currentProjectRecord.client_id || null, 
          contract_value: Number(currentProjectRecord.contract_value) || 0,
          estimated_budget: Number(currentProjectRecord.estimated_budget) || 0,
          down_payment: Number(currentProjectRecord.down_payment) || 0,
          start_date: currentProjectRecord.start_date || null, 
          end_date: currentProjectRecord.end_date || null,
          location_address: currentProjectRecord.location_address || null,
          project_manager: currentProjectRecord.project_manager || null,
          engineer_in_charge: currentProjectRecord.engineer_in_charge || null, 
          engineer_phone: currentProjectRecord.engineer_phone || null,        
          status: currentProjectRecord.status || 'قيد الدراسة',
          current_stage: currentProjectRecord.current_stage || 'تجهيز الموقع',
          notes: currentProjectRecord.notes || null
      };

      if (currentProjectRecord.id) {
          payload.id = currentProjectRecord.id;
      }

      saveProjectMutation.mutate(payload);
  };

  const [isBoqModalOpen, setIsBoqModalOpen] = useState(false);
  const [currentBoqRecord, setCurrentBoqRecord] = useState<any>({
      item_type: 'رئيسي', contract_quantity: 1, unit_contract_price: 0, 
      estimated_labor_cost: 0, estimated_material_cost: 0, estimated_expenses_cost: 0,
      start_date: '', end_date: '' 
  });

  const saveBoqMutation = useMutation({
    mutationFn: async (record: any) => {
        if (!record.work_item) throw new Error("يرجى إدخال اسم البند!");

        let parentId = record.parent_id || null;
        if (record.item_type === 'فرعي' && !parentId && record.main_category) {
            const existingPhase = projectDetails.boq?.find(
                (b: any) => b.item_type === 'رئيسي' && (b.work_item === record.main_category || b.main_category === record.main_category)
            );
            if (existingPhase) {
                parentId = existingPhase.id;
            } else {
                const { data: newPhase, error: phaseErr } = await supabase
                    .from('boq_budget')
                    .insert({
                        project_id: selectedProject.id,
                        item_type: 'رئيسي',
                        work_item: record.main_category,
                        main_category: record.main_category,
                        sub_category: 'عام',
                        start_date: null, 
                        end_date: null 
                    })
                    .select()
                    .single();
                if (!phaseErr && newPhase) {
                    parentId = newPhase.id;
                }
            }
        }

        const payload: any = {
            project_id: selectedProject.id,
            parent_id: record.item_type === 'فرعي' ? parentId : null,
            item_type: record.item_type || 'رئيسي',
            work_item: record.work_item,
            unit: record.unit || 'مقطوعية',
            contract_quantity: Number(record.contract_quantity) || 0,
            unit_contract_price: Number(record.unit_contract_price) || 0,
            retention_percentage: Number(record.retention_percentage) || 0,
            tech_count: Number(record.tech_count) || 0,
            tech_daily_wage: Number(record.tech_daily_wage) || 0,
            helper_count: Number(record.helper_count) || 0,
            helper_daily_wage: Number(record.helper_daily_wage) || 0,
            labor_days: Number(record.labor_days) || 0,
            estimated_labor_cost: Number(record.estimated_labor_cost) || 0,
            subcontractor_rebar_cost: Number(record.subcontractor_rebar_cost) || 0,
            subcontractor_concrete_cost: Number(record.subcontractor_concrete_cost) || 0,
            subcontractor_other_cost: Number(record.subcontractor_other_cost) || 0,
            estimated_subcontractor_cost: Number(record.estimated_subcontractor_cost) || 0,
            estimated_material_cost: Number(record.estimated_material_cost) || 0,
            estimated_expenses_cost: Number(record.estimated_expenses_cost) || 0,
            main_category: record.main_category || null, 
            sub_category: record.sub_category || null,
            start_date: record.start_date || null, 
            end_date: record.end_date || null
        };

        if (record.boq_item_id) {
            payload.boq_item_id = record.boq_item_id;
        }

        if (record.id) {
            const { error } = await supabase.from('boq_budget').update(payload).eq('id', record.id);
            if (error) throw new Error(error.message);
        } else {
            // 🚀 تم إزالة الأقواس المربعة
            const { error } = await supabase.from('boq_budget').insert(payload);
            if (error) throw new Error(error.message);
        }
    },
    onSuccess: () => {
        setIsBoqModalOpen(false);
        if (selectedProject) loadProjectDetails(selectedProject);
        showToast("تم حفظ البند بنجاح", "success");
    },
    onError: (err: any) => {
        showToast(`خطأ في الحفظ: ${err.message}`, "error");
    }
  });

  const deleteBoqMutation = useMutation({
      mutationFn: async (id: string) => {
          const { error } = await supabase.from('boq_budget').delete().eq('id', id);
          if (error) throw new Error(error.message);
      },
      onSuccess: () => {
          showToast("تم حذف البند من المقايسة بنجاح", "success");
          if (selectedProject) loadProjectDetails(selectedProject); 
      },
      onError: (err: any) => showToast(`خطأ في الحذف: ${err.message}`, "error")
  });

  const importFromLibrary = async (libraryItem: any) => {
      if (!selectedProject) return;
      setIsDetailsLoading(true);

      try {
          let parentId = null;
          const existingPhase = projectDetails.boq.find(
              (b: any) => b.item_type === 'رئيسي' && b.work_item === libraryItem.main_category
          );

          if (existingPhase) {
              parentId = existingPhase.id;
          } else {
              // 🚀 إزالة الأقواس المربعة من الـ Insert
              const { data: newPhase, error: phaseErr } = await supabase
                  .from('boq_budget')
                  .insert({
                      project_id: selectedProject.id,
                      item_type: 'رئيسي',
                      work_item: libraryItem.main_category || 'مرحلة عامة',
                      main_category: libraryItem.main_category || 'مرحلة عامة',
                      sub_category: 'عام',
                      start_date: null, 
                      end_date: null 
                  })
                  .select()
                  .single();

              if (phaseErr) throw phaseErr;
              parentId = newPhase.id;
          }

          // 🚀 إزالة الأقواس المربعة من الـ Insert
          const { error: itemErr } = await supabase
              .from('boq_budget')
              .insert({
                  project_id: selectedProject.id,
                  parent_id: parentId, 
                  item_type: 'فرعي',
                  boq_item_id: libraryItem.id,
                  work_item: libraryItem.item_name,
                  unit: libraryItem.unit_of_measure || 'مقطوعية',
                  contract_quantity: 0, 
                  unit_contract_price: Number(libraryItem.default_unit_price) || 0,
                  estimated_labor_cost: Number(libraryItem.default_labor_price) || 0,
                  estimated_material_cost: Number(libraryItem.default_material_price) || 0,
                  estimated_expenses_cost: 0,
                  main_category: libraryItem.main_category || 'بند عام',
                  sub_category: libraryItem.sub_category || 'بند عام',
                  start_date: null, 
                  end_date: null 
              });

          if (itemErr) throw itemErr;

          showToast(`تم سحب [${libraryItem.item_name}] وتسكينه بنجاح!`, "success");
          loadProjectDetails(selectedProject); 

      } catch (err: any) {
          showToast(`فشل السحب التلقائي: ${err.message}`, "error");
      } finally {
          setIsDetailsLoading(false);
      }
  };

  const runDiagnostics = async () => {
    if (!selectedProject) {
      notify("يرجى اختيار مشروع أولاً من القائمة الجانبية لتشغيل الفحص عليه.");
      return;
    }
    console.log(`🚀 بدء فحص قاعدة البيانات للمشروع: ${selectedProject.Property}`);
    try {
      const boqTest = await supabase.from('boq_budget').select('*').eq('project_id', selectedProject.id);
      if (boqTest.error) console.error("❌ إيرور في boq_budget:", boqTest.error.message);
      else console.log(`✅ المقايسات: تم سحب (${boqTest.data?.length}) سجل بنجاح.`);

      const expTest = await supabase.from('expenses').select('*').eq('project_id', selectedProject.id);
      if (expTest.error) console.error("❌ إيرور في expenses:", expTest.error.message);
      else console.log(`✅ المصروفات: تم سحب (${expTest.data?.length}) سجل بنجاح.`);
      
      notify("تم الفحص! راجع الـ Console (F12) لمعرفة التفاصيل.");
    } catch (err) {
      console.error("حدث خطأ غير متوقع أثناء الفحص:", err);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    
    const projData = await fetchAllSupabaseData(supabase, 'projects', `*, client:partners!client_id(name)`, 'created_at', false);
    
    const { data: dashboardData } = await supabase.rpc('get_project_dashboard');

    if (projData) {
      const enrichedProjects = projData.map(p => {
         const dStats = (dashboardData || []).find((d: any) => d.project_id === p.id) || {};
         return { ...p, ...dStats };
      });
      setProjects(enrichedProjects);
    }

    const clientData = await fetchAllSupabaseData(supabase, 'partners', 'id, name, partner_type', 'id', false);
    if (clientData) {
      setClients(clientData.filter((p: any) => p.partner_type === 'عميل'));
    }

    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchSearch = (p.Property || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.project_code || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = filterStatus === 'الكل' || p.status === filterStatus;
      const matchClient = filterClient === 'الكل' || p.client_id === filterClient;
      return matchSearch && matchStatus && matchClient;
    });
  }, [projects, searchQuery, filterStatus, filterClient, filterStage, dateFrom, dateTo]);

  const loadProjectDetails = async (project: any) => {
    setSelectedProject(project);
    setIsDetailsLoading(true);

    try {
      const { data: fullDetails, error } = await supabase.rpc('get_project_full_details', { p_project_id: project.id });
      if (error) throw error;

      const { data: abcAllocations } = await supabase.from('advanced_cost_allocation_view').select('*').eq('project_id', project.id);

      const abcMap: Record<string, number> = {};
      abcAllocations?.forEach((alloc: any) => {
          const bId = alloc.boq_budget_id || alloc.boq_item_id;
          if (bId) {
              abcMap[bId] = (abcMap[bId] || 0) + Number(alloc['المبلغ المحمل (ر.س)'] || alloc['loaded_amount'] || 0);
          }
      });

      const rawBoqData = fullDetails.boq || [];

      const boqDataWithAllocations = rawBoqData.map((item: any) => {
          if (item.item_type === 'فرعي' || !item.item_type) {
              const allocated = abcMap[item.id] || 0;
              return {
                  ...item,
                  allocated_expenses: allocated,
                  item_net_profit: Number(item.item_net_profit || 0) - allocated,
                  total_budget_variance: Number(item.total_budget_variance || 0) - allocated
              };
          }
          return item; 
      });

      const finalBoqData = boqDataWithAllocations.map((item: any) => {
          if (item.item_type === 'رئيسي') {
              const children = boqDataWithAllocations.filter((child: any) => child.parent_id === item.id);
              const totalAllocated = children.reduce((sum: number, child: any) => sum + (Number(child.allocated_expenses) || 0), 0);
              return {
                  ...item,
                  allocated_expenses: totalAllocated,
                  item_net_profit: Number(item.item_net_profit || 0) - totalAllocated,
                  total_budget_variance: Number(item.total_budget_variance || 0) - totalAllocated
              };
          }
          return item;
      });

      const expensesData = fullDetails.expenses || [];
      const materialsData = fullDetails.materials || [];
      const invoicesData = fullDetails.invoices || [];
      const subClaimsData = fullDetails.sub_claims || [];
      const contractorAssignmentsData = fullDetails.contractor_assignments || [];

      const processedInvoices = invoicesData.map((inv: any) => ({
          ...inv, display_number: inv.invoice_number, display_type: 'مستخلص عام / توريد', final_amount: Number(inv.total_amount || 0)
      }));

      const processedSubClaims = subClaimsData.map((clm: any) => ({
          ...clm, display_number: clm.claim_number, display_type: `مستخلص مقاول باطن`, final_amount: Number(clm.net_amount || 0)
      }));

      const laborLogs = expensesData.filter((e: any) => e.row_type === 'labor_direct');
      const todayStr = new Date().toISOString().split('T')[0];
      
      const laborStats = {
        todayWorkers: laborLogs.filter((l: any) => l.display_date === todayStr).length,
        totalWorkersToDate: laborLogs.length,
        todayCost: laborLogs.filter((l: any) => l.display_date === todayStr).reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0),
        totalLaborCost: laborLogs.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0),
      };

      setProjectDetails({
        stages: [], boq: finalBoqData, expenses: expensesData, ledger: [], materials: materialsData,
        invoices: [...processedInvoices, ...processedSubClaims], laborStats, contractorAssignments: contractorAssignmentsData, inspections: [] 
      });

    } catch (err: any) {
      showToast(`حدث خطأ أثناء تحميل تفاصيل المشروع: ${err.message}`, "error");
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const updateRecommendations = async (newText: string) => {
    if (!selectedProject) return;
    const { error } = await supabase.from('projects').update({ notes: newText }).eq('id', selectedProject.id);
    if (!error) setSelectedProject({ ...selectedProject, notes: newText });
  };

  const updateProjectStatus = async (newStatus: string) => {
    if (!selectedProject) return;
    const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', selectedProject.id);
    if (!error) {
      setSelectedProject({ ...selectedProject, status: newStatus });
      setProjects(prevProjects => prevProjects.map(p => p.id === selectedProject.id ? { ...p, status: newStatus } : p));
      showToast("تم تحديث حالة المشروع بنجاح", "success");
    }
  };

  const resetFilters = () => {
    setSearchQuery(''); setFilterStatus('الكل'); setFilterClient('الكل'); setFilterStage('الكل'); setDateFrom(''); setDateTo('');
  };

  const kpis = useMemo(() => {
    if (!selectedProject) return null;
    const totalContract = Number(selectedProject.contract_value) || 0;
    const totalEstimatedBudget = Number(selectedProject.estimated_budget) || 0;
    
    let totalActualLabor = 0, totalActualMaterial = 0, totalDirectExpenses = 0, totalABCAllocated = 0;

    const leafItems = projectDetails.boq.filter((b: any) => !projectDetails.boq.some((child: any) => child.parent_id === b.id));
    
    leafItems.forEach((item: any) => {
      totalActualLabor += Number(item.actual_labor_cost || 0);
      totalActualMaterial += Number(item.actual_material_cost || 0);
      totalABCAllocated += Number(item.allocated_expenses || 0);
      totalDirectExpenses += Number(item.actual_expenses_cost || 0);
    });

    const actualCost = totalActualLabor + totalActualMaterial + totalDirectExpenses + totalABCAllocated;
    const totalRevenue = projectDetails.invoices.reduce((sum: number, i:any) => sum + (i.final_amount || 0), 0);
    const financialProgress = totalContract > 0 ? ((totalRevenue / totalContract) * 100) : 0;
    const physicalProgress = Number(selectedProject.overall_completion_percentage || 0);
    
    const budgetRatio = totalEstimatedBudget > 0 ? (actualCost / totalEstimatedBudget) : 0;
    let budgetHealth = 'green';
    if (budgetRatio > 1.1) budgetHealth = 'red';
    else if (budgetRatio > 0.9) budgetHealth = 'yellow';

    let timeProgress = 0, timeStatus = 'منتظم';
    if (selectedProject.start_date && selectedProject.end_date) {
      const start = new Date(selectedProject.start_date).getTime();
      const end = new Date(selectedProject.end_date).getTime();
      const now = new Date().getTime();
      if (now > end) { timeProgress = 100; timeStatus = 'متأخر جداً'; }
      else if (now < start) { timeProgress = 0; timeStatus = 'لم يبدأ بعد'; }
      else { 
        timeProgress = ((now - start) / (end - start)) * 100; 
        if (timeProgress > physicalProgress + 15) timeStatus = 'تأخر زمني';
      }
    }

    const requiredCashflow = totalEstimatedBudget - actualCost;
    const alerts = [];
    if (budgetHealth === 'red') alerts.push("تجاوز الميزانية المعتمدة");
    if (timeStatus.includes('تأخر')) alerts.push("تأخر في الجدول الزمني مقارنة بنسبة الإنجاز");
    if (totalRevenue < actualCost) alerts.push("التدفق النقدي بالسالب");

    return { 
      totalContract, totalEstimatedBudget, actualCost, totalRevenue, 
      financialProgress: financialProgress.toFixed(1), physicalProgress: physicalProgress.toFixed(1), 
      budgetRatio: (budgetRatio * 100).toFixed(1), budgetHealth, timeProgress: timeProgress.toFixed(1), timeStatus, requiredCashflow, alerts
    };
  }, [selectedProject, projectDetails]);

  return {
    projects: filteredProjects, clients, selectedProject, setSelectedProject, projectDetails, kpis, 
    isLoading, isDetailsLoading, loadProjectDetails, activeTab, setActiveTab,
    isFilterOpen, setIsFilterOpen, searchQuery, setSearchQuery, filterStatus, setFilterStatus, filterClient, setFilterClient, filterStage, setFilterStage, availableStages, dateFrom, setDateFrom, dateTo, setDateTo, runDiagnostics, resetFilters, updateRecommendations, updateProjectStatus,
    isAddProjectModalOpen, setIsAddProjectModalOpen, currentProjectRecord, setCurrentProjectRecord, handleSaveProject, isSavingProject: saveProjectMutation.isPending, deleteProjectMutation,
    isBoqModalOpen, setIsBoqModalOpen, currentBoqRecord, setCurrentBoqRecord, handleSaveBoq: (data: any) => saveBoqMutation.mutate(data), deleteBoqMutation, isSavingBoq: saveBoqMutation.isPending, importFromLibrary 
  };
}