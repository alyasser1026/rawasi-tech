import { supabase } from '@/lib/supabase';

export interface ProfitabilityParams {
  startDate: string;
  endDate: string;
  projectId?: string | null;
}

export async function fetchProjectsProfitabilityFallback(params: ProfitabilityParams) {
  const { startDate, endDate, projectId } = params;

  // 1. Fetch Projects
  let projectsQuery = supabase
    .from('projects')
    .select('id, project_name, "Property", project_code, client_name, status, contract_value, estimated_budget');

  if (projectId && projectId !== 'all') {
    projectsQuery = projectsQuery.eq('id', projectId);
  }

  const { data: projectsData, error: projErr } = await projectsQuery;
  if (projErr) throw projErr;

  const projects = projectsData || [];

  // 2. Fetch Accounts (Revenue 4% and Direct Costs 51%)
  const { data: accountsData, error: accErr } = await supabase
    .from('accounts')
    .select('id, code')
    .or('code.like.4%,code.like.51%');

  if (accErr) throw accErr;

  const accountMap = new Map<string, string>();
  (accountsData || []).forEach(acc => {
    accountMap.set(acc.id, acc.code);
  });

  // 3. Fetch BOQ Budget data for projects
  const { data: boqData } = await supabase
    .from('boq_budget')
    .select('project_id, contract_quantity, unit_contract_price, estimated_labor_cost, estimated_material_cost, estimated_expenses_cost');

  const boqMap = new Map<string, { contract_value: number; estimated_cost: number }>();
  (boqData || []).forEach(item => {
    if (!item.project_id) return;
    const current = boqMap.get(item.project_id) || { contract_value: 0, estimated_cost: 0 };
    const cv = (Number(item.contract_quantity) || 0) * (Number(item.unit_contract_price) || 0);
    const ec = (Number(item.estimated_labor_cost) || 0) + (Number(item.estimated_material_cost) || 0) + (Number(item.estimated_expenses_cost) || 0);
    boqMap.set(item.project_id, {
      contract_value: current.contract_value + cv,
      estimated_cost: current.estimated_cost + ec
    });
  });

  // 4. Fetch Journal Headers in range
  const { data: headersData, error: headErr } = await supabase
    .from('journal_headers')
    .select('id, entry_date, status')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .in('status', ['posted', 'مرحل', 'معتمد']);

  if (headErr) throw headErr;

  const headerIds = (headersData || []).map(h => h.id);

  // 5. Fetch Journal Lines for these headers
  let lines: any[] = [];
  if (headerIds.length > 0) {
    // Chunk headerIds by 500 to prevent URL length limits
    const chunkSize = 500;
    for (let i = 0; i < headerIds.length; i += chunkSize) {
      const chunk = headerIds.slice(i, i + chunkSize);
      const { data: linesChunk, error: lineErr } = await supabase
        .from('journal_lines')
        .select('id, header_id, account_id, debit, credit, project_id')
        .in('header_id', chunk);

      if (lineErr) throw lineErr;
      if (linesChunk) lines = lines.concat(linesChunk);
    }
  }

  // Structure per project
  interface ProjectCostAgg {
    materials: number;
    labor: number;
    subcontractors: number;
    equipment: number;
    site_expenses: number;
    depreciation: number;
    other_direct: number;
    total: number;
  }

  interface ProjectResult {
    project_id: string;
    project_name: string;
    project_code: string | null;
    client_name: string | null;
    project_status: string;
    revenue: number;
    costs: ProjectCostAgg;
    net_profit: number;
    margin_pct: number;
    boq_comparison: {
      contract_value: number;
      estimated_cost: number;
      actual_cost: number;
      cost_burn_pct: number;
      variance: number;
    };
  }

  const projectMap = new Map<string, {
    project: any;
    revenue: number;
    costs: ProjectCostAgg;
  }>();

  projects.forEach(p => {
    projectMap.set(p.id, {
      project: p,
      revenue: 0,
      costs: {
        materials: 0,
        labor: 0,
        subcontractors: 0,
        equipment: 0,
        site_expenses: 0,
        depreciation: 0,
        other_direct: 0,
        total: 0
      }
    });
  });

  let unallocated_revenue = 0;
  let unallocated_costs = 0;
  let gl_total_revenue = 0;
  let gl_total_project_costs = 0;

  lines.forEach(line => {
    const code = accountMap.get(line.account_id);
    if (!code) return; // not 4% or 51%

    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    const isRev = code.startsWith('4');
    const isCost = code.startsWith('51');

    if (isRev) {
      const netRev = credit - debit;
      gl_total_revenue += netRev;
      if (line.project_id && projectMap.has(line.project_id)) {
        projectMap.get(line.project_id)!.revenue += netRev;
      } else {
        unallocated_revenue += netRev;
      }
    } else if (isCost) {
      const netCost = debit - credit;
      gl_total_project_costs += netCost;
      if (line.project_id && projectMap.has(line.project_id)) {
        const c = projectMap.get(line.project_id)!.costs;
        if (code.startsWith('511')) c.materials += netCost;
        else if (code.startsWith('512')) c.labor += netCost;
        else if (code.startsWith('513')) c.subcontractors += netCost;
        else if (code.startsWith('514')) c.equipment += netCost;
        else if (code.startsWith('515')) c.site_expenses += netCost;
        else if (code.startsWith('516')) c.depreciation += netCost;
        else c.other_direct += netCost;
        c.total += netCost;
      } else {
        unallocated_costs += netCost;
      }
    }
  });

  const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

  const resultProjects: ProjectResult[] = [];
  let sum_proj_revenue = 0;
  let sum_proj_costs = 0;

  projectMap.forEach(({ project, revenue, costs }, pId) => {
    const rev = round2(revenue);
    costs.materials = round2(costs.materials);
    costs.labor = round2(costs.labor);
    costs.subcontractors = round2(costs.subcontractors);
    costs.equipment = round2(costs.equipment);
    costs.site_expenses = round2(costs.site_expenses);
    costs.depreciation = round2(costs.depreciation);
    costs.other_direct = round2(costs.other_direct);
    costs.total = round2(costs.materials + costs.labor + costs.subcontractors + costs.equipment + costs.site_expenses + costs.depreciation + costs.other_direct);

    // Filter projects that have movement or if specific project was selected
    if (rev !== 0 || costs.total !== 0 || (projectId && projectId !== 'all')) {
      const net_profit = round2(rev - costs.total);
      const margin_pct = rev > 0 ? round2((net_profit / rev) * 100) : 0;

      const boqInfo = boqMap.get(pId);
      const contract_value = round2(boqInfo?.contract_value || Number(project.contract_value) || 0);
      const estimated_cost = round2(boqInfo?.estimated_cost || Number(project.estimated_budget) || 0);
      const actual_cost = costs.total;
      const cost_burn_pct = estimated_cost > 0 ? round2((actual_cost / estimated_cost) * 100) : 0;
      const variance = round2(actual_cost - estimated_cost);

      resultProjects.push({
        project_id: pId,
        project_name: project.project_name || project.Property || 'مشروع',
        project_code: project.project_code || null,
        client_name: project.client_name || null,
        project_status: project.status || 'نشط',
        revenue: rev,
        costs,
        net_profit,
        margin_pct,
        boq_comparison: {
          contract_value,
          estimated_cost,
          actual_cost,
          cost_burn_pct,
          variance
        }
      });

      sum_proj_revenue += rev;
      sum_proj_costs += costs.total;
    }
  });

  // Sort by revenue descending
  resultProjects.sort((a, b) => b.revenue - a.revenue);

  sum_proj_revenue = round2(sum_proj_revenue);
  sum_proj_costs = round2(sum_proj_costs);
  const sum_proj_profit = round2(sum_proj_revenue - sum_proj_costs);

  unallocated_revenue = round2(unallocated_revenue);
  unallocated_costs = round2(unallocated_costs);
  const unallocated_profit = round2(unallocated_revenue - unallocated_costs);

  gl_total_revenue = round2(gl_total_revenue);
  gl_total_project_costs = round2(gl_total_project_costs);

  const total_combined_revenue = round2(sum_proj_revenue + unallocated_revenue);
  const total_combined_costs = round2(sum_proj_costs + unallocated_costs);
  const total_combined_profit = round2(total_combined_revenue - total_combined_costs);
  const overall_margin_pct = total_combined_revenue > 0 ? round2((total_combined_profit / total_combined_revenue) * 100) : 0;

  const gl_variance = round2(total_combined_costs - gl_total_project_costs);
  const is_reconciled = Math.abs(gl_variance) < 0.01 && Math.abs(total_combined_revenue - gl_total_revenue) < 0.01;

  return {
    period: {
      start_date: startDate,
      end_date: endDate
    },
    projects_count: resultProjects.length,
    projects: resultProjects,
    unallocated: {
      title_ar: 'غير محدد (إيرادات وتكاليف عمليات عامة غير محملة على مشاريع)',
      revenue: unallocated_revenue,
      costs: unallocated_costs,
      net_profit: unallocated_profit
    },
    summary: {
      projects_revenue: sum_proj_revenue,
      projects_costs: sum_proj_costs,
      projects_profit: sum_proj_profit,
      unallocated_revenue,
      unallocated_costs,
      total_combined_revenue,
      total_combined_costs,
      total_combined_profit,
      overall_margin_pct
    },
    reconciliation: {
      gl_total_revenue,
      gl_total_project_costs,
      is_reconciled,
      variance: gl_variance
    }
  };
}
