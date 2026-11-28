import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/lib/CompanyContext';
import { isLegacyDashboardFetchEnabled } from '@/lib/dashboard-flags';
import { formatCurrency } from '@/lib/helpers';
import { fetchPaginatedData, runWithConcurrency } from '@/lib/supabase-pagination';

// 🚀 دالة البلدوزر السريعة لسحب البيانات الضخمة (1000 صف ثم 1000 صف بدون تكرار)
const fetchAllForDashboard = async (
  tableName: string,
  columns: string,
  filters?: { col: string; val: any; op?: 'eq' | 'neq' }[]
) => {
  const colList = columns.split(',').map((c) => c.trim()).filter(Boolean);
  if (!colList.includes('*') && !colList.includes('id')) {
    colList.unshift('id');
  }
  const selectCols = colList.join(', ');

  return await fetchPaginatedData(() => {
    let query = supabase.from(tableName).select(selectCols).order('id', { ascending: true });
    if (filters) {
      filters.forEach((f) => {
        if (f.op === 'neq') query = query.neq(f.col, f.val);
        else query = query.eq(f.col, f.val);
      });
    }
    return query;
  }, 'id');
};

export const useDashboardLogic = () => {
  const { activeCompanyId } = useCompany();
  const legacyMode = isLegacyDashboardFetchEnabled();

  const query = useQuery({
    queryKey: ['dashboard_stats_comprehensive', activeCompanyId || 'default'],
    queryFn: async () => {
      // 1. 📡 سحب كافة البيانات بتزامن مضبوط (مع دعم مفتاح التراجع الفوري legacyMode)
      const [
        expenses, invoices, labor, payments, receipts, projects,
        journalLines, accounts, subClaims, materialReceipts, jobOrders, materialIssueLines
      ] = await runWithConcurrency([
        () => fetchAllForDashboard('expenses', 'total_price, is_posted, main_category, job_order_id'),
        () => fetchAllForDashboard('invoices', 'total_amount, status'),
        () => fetchAllForDashboard('labor_daily_logs', 'daily_wage, attendance_value, is_posted, job_order_id'),
        () => fetchAllForDashboard('payment_vouchers', 'amount, is_posted, status'),
        () => fetchAllForDashboard('receipt_vouchers', 'amount, status'),
        () => fetchAllForDashboard('projects', 'id, status'),
        () => fetchAllForDashboard('journal_lines', 'debit, credit, account_id'),
        () => fetchAllForDashboard('accounts', 'id, account_type'),
        () => fetchAllForDashboard('sub_claims', 'net_amount, is_posted, status'),
        () => fetchAllForDashboard('material_receipts', 'total_amount, is_posted, status'),
        () => fetchAllForDashboard('job_orders', 'id, order_number, assigned_qty, unit_price'),
        () => fetchAllForDashboard('material_issue_lines', 'total_price, job_order_id')
      ], legacyMode ? 4 : 6);

      // --- 🏗️ تحليل حالات المشاريع والفلل ---
      const projectStatusMap: Record<string, number> = {};
      let activeProjectsCount = 0;

      projects.forEach(p => {
        let st = p.status || 'قيد الدراسة';
        // توحيد بعض المسميات المتشابهة عشان الرسم البياني
        if (st === 'متوقف') st = 'متوقف مؤقتا';
        if (st === 'جاري تجهيز الموقع') st = 'تجهيز الموقع';
        
        projectStatusMap[st] = (projectStatusMap[st] || 0) + 1;
        
        // حساب المشاريع النشطة (اللي مش مكتملة ومش متوقفة)
        if (st !== 'مكتمل' && !st.includes('متوقف')) {
          activeProjectsCount++;
        }
      });

      // تحويل خريطة الحالات لمصفوفة للعرض في الواجهة
      const projectsStatusData = Object.entries(projectStatusMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      // --- 🏛️ حساب المركز المالي ---
      let totalAssets = 0;
      let totalLiabilities = 0;

      const accountTypesMap: Record<string, string> = {};
      accounts.forEach(acc => { accountTypesMap[acc.id] = acc.account_type; });

      journalLines.forEach(line => {
        const type = accountTypesMap[line.account_id] || '';
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);

        if (type.includes('أصول') || type.includes('Asset') || type.includes('مدين')) {
          totalAssets += (debit - credit);
        } 
        else if (type.includes('خصوم') || type.includes('التزام') || type.includes('Liability') || type.includes('دائن')) {
          totalLiabilities += (credit - debit);
        }
      });

      // --- 🧮 إحصائيات الترحيل الشاملة ---
      const getPostingStats = (data: any[], postedKey: string = 'is_posted', postedVal: any = true) => {
        const posted = data.filter(item => {
          if (Array.isArray(postedVal)) return postedVal.includes(item[postedKey]);
          return item[postedKey] === postedVal || item[postedKey] === true; 
        }).length;
        const pending = data.length - posted;
        return [ { name: 'معتمد', value: posted }, { name: 'معلق/مسودة', value: pending } ];
      };

      const validStatuses = ['معتمد', 'معتمد', 'posted', 'معتمد'];

      const postingCharts = {
        expenses: getPostingStats(expenses, 'is_posted', true),
        invoices: getPostingStats(invoices, 'status', validStatuses),
        labor: getPostingStats(labor, 'is_posted', true),
        payments: getPostingStats(payments, 'is_posted', true),
        receipts: getPostingStats(receipts, 'status', validStatuses),
        subClaims: getPostingStats(subClaims, 'is_posted', true),
        materialReceipts: getPostingStats(materialReceipts, 'is_posted', true) 
      };

      // --- 🚨 الرادار الأمني ---
      const alerts: any[] = [];
      
      const checkPending = (data: any[], label: string, route: string, postedKey: string = 'is_posted', postedVal: any = true) => {
        const count = data.filter(item => {
          if (Array.isArray(postedVal)) return !postedVal.includes(item[postedKey]);
          return item[postedKey] !== postedVal && item[postedKey] !== true;
        }).length;

        if (count > 0) {
          alerts.push({ 
            title: `يوجد (${count}) ${label} غير معتمد يحتاج مراجعة`, 
            type: count > 10 ? 'danger' : 'warning',
            route: route 
          });
        }
      };

      checkPending(expenses, 'مصروفات عامة', '/expenses', 'is_posted', true);
      checkPending(invoices, 'مستخلصات عملاء', '/invoices', 'status', validStatuses); 
      checkPending(subClaims, 'مستخلصات مقاولي باطن', '/sub_claims', 'is_posted', true); 
      checkPending(materialReceipts, 'فواتير توريد خامات', '/materials', 'is_posted', true); 
      checkPending(labor, 'يوميات عمالة', '/labor_logs', 'is_posted', true);
      checkPending(payments, 'سندات صرف', '/payment_vouchers', 'is_posted', true);
      checkPending(receipts, 'سندات قبض', '/receipt_vouchers', 'status', validStatuses); 

      // --- 💰 الحسابات التشغيلية الشاملة ---
      const totalExpensesOnly = expenses.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
      const totalSubContractors = subClaims.reduce((sum, item) => sum + Number(item.net_amount || 0), 0);
      const totalMaterials = materialReceipts.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
      const totalExpenses = totalExpensesOnly + totalSubContractors + totalMaterials; 
      const totalInvoices = invoices.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
      const totalWages = labor.reduce((sum, item) => sum + (Number(item.daily_wage || 0) * Number(item.attendance_value || 1)), 0);

      // --- 🍩 تجميع المصروفات للرسم البياني ---
      const categoryMap: Record<string, number> = {};
      
      expenses.forEach(exp => {
        const cat = exp.main_category || 'مصروفات متنوعة';
        categoryMap[cat] = (categoryMap[cat] || 0) + Number(exp.total_price || 0);
      });
      
      categoryMap['مقاولي الباطن'] = totalSubContractors;
      categoryMap['توريد خامات'] = totalMaterials;

      const expensesByCategory = Object.entries(categoryMap)
        .map(([name, value]) => ({ name, value }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // --- 📊 أداء أوامر الشغل (الميزانية مقابل الفعلي) ---
      const jobOrdersPerformance = jobOrders.map(jo => {
         const budget = (Number(jo.assigned_qty) || 0) * (Number(jo.unit_price) || 0);
         const joExpenses = expenses.filter(e => e.job_order_id === jo.id).reduce((sum, e) => sum + Number(e.total_price || 0), 0);
         const joLabor = labor.filter(l => l.job_order_id === jo.id).reduce((sum, l) => sum + (Number(l.daily_wage || 0) * Number(l.attendance_value || 1)), 0);
         const joSubClaims = subClaims.filter(s => s.job_order_id === jo.id || (Array.isArray(s.job_order_ids) && s.job_order_ids.includes(jo.id))).reduce((sum, s) => sum + Number(s.net_amount || 0), 0);
         const joMaterials = materialIssueLines.filter(m => m.job_order_id === jo.id).reduce((sum, m) => sum + Number(m.total_price || 0), 0);

         const actual = joExpenses + joLabor + joSubClaims + joMaterials;
         return {
            name: jo.order_number || 'بدون رقم',
            budget,
            actual,
            variance: budget - actual
         };
      }).filter(jo => jo.budget > 0 || jo.actual > 0).sort((a, b) => b.budget - a.budget).slice(0, 10); // Show top 10

      return {
        totals: {
          totalExpenses, 
          totalInvoices, 
          totalWages, 
          activeProjects: activeProjectsCount, // 👈 تم التحديث
          totalAssets, 
          totalLiabilities 
        },
        projectsStatusData, // 👈 تصدير حالات المشاريع
        postingCharts,
        expensesByCategory,
        jobOrdersPerformance, // 👈 تصدير أداء أوامر الشغل
        alerts,
        cashFlowData: [
            { name: 'إجمالي التراكمي', income: totalInvoices, expense: totalExpenses + totalWages } 
        ]
      };
    },
    staleTime: legacyMode ? 0 : 1000 * 60 * 5, // Cache for 5 minutes unless legacy fallback enabled
    refetchOnWindowFocus: false,
  });

  return {
    stats: query.data,
    isLoading: query.isLoading,
    error: query.error,
    formatCurrency
  };
};