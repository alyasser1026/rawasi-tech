"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useProjectsLogic } from '../projects/projects_logic';
import ReportsTab from '../projects/ReportsTab';
import ProjectReportModal from '../projects/ProjectReportModal';
import LoadingScreen from '@/components/LoadingScreen';
import { formatCurrency } from '@/lib/helpers';
import { Building2, FileText } from 'lucide-react';

interface ProjectReportsHubProps {
  selectedProjectId?: string;
  onSelectProjectId?: (id: string) => void;
}

export default function ProjectReportsHub({
  selectedProjectId = 'all',
  onSelectProjectId,
}: ProjectReportsHubProps) {
  const projectsLogic = useProjectsLogic();
  const [isBoqReportOpen, setIsBoqReportOpen] = useState(false);

  const projects: any[] = projectsLogic.projects || [];
  const selectedProject = projectsLogic.selectedProject;

  useEffect(() => {
    if (projectsLogic.isLoading || projects.length === 0) return;

    let target: any = null;
    if (selectedProjectId && selectedProjectId !== 'all') {
      target = projects.find((p) => String(p.id) === String(selectedProjectId)) || null;
    }
    if (!target && selectedProject) {
      target = projects.find((p) => String(p.id) === String(selectedProject.id)) || null;
    }
    if (!target) {
      target = projects[0];
    }

    if (target && String(selectedProject?.id || '') !== String(target.id)) {
      projectsLogic.loadProjectDetails(target);
    }
  }, [projectsLogic.isLoading, projects, selectedProjectId, selectedProject?.id]);

  const boqList = projectsLogic.projectDetails?.boq || [];
  const assignments = projectsLogic.projectDetails?.contractorAssignments || [];
  const expenses = projectsLogic.projectDetails?.expenses || [];

  const flatBoqData = useMemo(() => {
    if (boqList.length === 0) return [];
    const result: any[] = [];
    const mains = boqList.filter((i: any) => i.item_type === 'رئيسي');

    mains.forEach((main: any) => {
      const subs = boqList.filter((sub: any) => sub.parent_id === main.id);
      if (subs.length > 0) {
        result.push({
          ...main,
          is_parent_phase: true,
          total_contract_amount: subs.reduce((sum: number, s: any) => sum + Number(s.total_contract_amount || 0), 0),
          estimated_labor_cost: subs.reduce((sum: number, s: any) => sum + Number(s.estimated_labor_cost || 0), 0),
          estimated_subcontractor_cost: subs.reduce(
            (sum: number, s: any) => sum + Number(s.estimated_subcontractor_cost || 0),
            0
          ),
          estimated_material_cost: subs.reduce((sum: number, s: any) => sum + Number(s.estimated_material_cost || 0), 0),
          estimated_expenses_cost: subs.reduce((sum: number, s: any) => sum + Number(s.estimated_expenses_cost || 0), 0),
          actual_labor_cost: subs.reduce((sum: number, s: any) => sum + Number(s.actual_labor_cost || 0), 0),
          actual_material_cost: subs.reduce((sum: number, s: any) => sum + Number(s.actual_material_cost || 0), 0),
          actual_expenses_cost: subs.reduce((sum: number, s: any) => sum + Number(s.actual_expenses_cost || 0), 0),
          allocated_expenses: subs.reduce((sum: number, s: any) => sum + Number(s.allocated_expenses || 0), 0),
          total_budget_variance: subs.reduce((sum: number, s: any) => sum + Number(s.total_budget_variance || 0), 0),
          actual_retention_amount: subs.reduce((sum: number, s: any) => sum + Number(s.actual_retention_amount || 0), 0),
          item_net_profit: subs.reduce((sum: number, s: any) => sum + Number(s.item_net_profit || 0), 0),
          subs_count: subs.length,
        });
      } else {
        result.push(main);
      }
      result.push(...subs);
    });

    const mappedIds = new Set(result.map((r) => r.id));
    const orphans = boqList.filter((b: any) => !mappedIds.has(b.id));
    return [...result, ...orphans];
  }, [boqList]);

  const boqStats = useMemo(() => {
    let totalContractValue = 0;
    let totalEstimatedCosts = 0;
    let subItemsCount = 0;
    let totalActualLabor = 0;
    let totalActualMaterial = 0;
    let totalDirectExpenses = 0;
    let totalRetentionValue = 0;
    let totalNetProfit = 0;
    let totalBudgetVariance = 0;
    let totalAllocatedExpensesABC = 0;

    flatBoqData.forEach((item: any) => {
      const isParent = item.item_type === 'رئيسي' || item.is_parent_phase;
      if (!isParent) {
        subItemsCount++;
        totalContractValue += Number(item.total_contract_amount || 0);
        totalEstimatedCosts +=
          Number(item.estimated_labor_cost || 0) +
          Number(item.estimated_subcontractor_cost || 0) +
          Number(item.estimated_material_cost || 0) +
          Number(item.estimated_expenses_cost || 0);

        totalActualLabor += Number(item.actual_labor_cost || 0);
        totalActualMaterial += Number(item.actual_material_cost || 0);
        totalDirectExpenses += Number(item.actual_expenses_cost || 0);

        totalRetentionValue += Number(item.actual_retention_amount || 0);
        totalNetProfit += Number(item.item_net_profit || 0);
        totalBudgetVariance += Number(item.total_budget_variance || 0);
        totalAllocatedExpensesABC += Number(item.allocated_expenses || 0);
      }
    });

    const totalActualCosts = totalActualLabor + totalActualMaterial + totalDirectExpenses + totalAllocatedExpensesABC;
    const remainingBudget = totalEstimatedCosts - totalActualCosts;
    const isActualStarted = totalActualCosts > 0;

    const totalAllocatedOverhead = expenses
      .filter((e: any) => !['direct', 'material', 'labor_direct', 'labor_allocated'].includes(e.row_type))
      .reduce((sum: number, e: any) => sum + Number(e.amount || e.total_price || 0), 0);

    const totalAssignedContracts = assignments.reduce((sum: number, a: any) => sum + Number(a.total_contract_amount || 0), 0);
    const profitMargin = totalContractValue > 0 ? ((totalNetProfit / totalContractValue) * 100).toFixed(1) : '0.0';
    const isLoss = totalNetProfit < 0;

    return {
      totalContractValue,
      totalEstimatedCosts,
      subItemsCount,
      totalAssignedContracts,
      totalRetentionValue,
      totalNetProfit,
      profitMargin,
      isLoss,
      totalBudgetVariance,
      totalAllocatedOverhead,
      totalActualLabor,
      totalActualMaterial,
      totalDirectExpenses,
      totalActualCosts,
      remainingBudget,
      isActualStarted,
      totalAllocatedExpensesABC,
    };
  }, [flatBoqData, assignments, expenses]);

  const handleSelectProject = (p: any) => {
    projectsLogic.loadProjectDetails(p);
    if (onSelectProjectId) {
      onSelectProjectId(String(p.id));
    }
  };

  if (projectsLogic.isLoading) {
    return <LoadingScreen message="جاري تحميل قائمة المشاريع..." fullScreen={false} />;
  }

  if (projects.length === 0) {
    return (
      <div
        style={{
          background: 'var(--surface-card)',
          borderRadius: '20px',
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          boxShadow: 'var(--shadow-ambient)',
          color: 'var(--text-secondary)',
          fontWeight: 800,
        }}
      >
        لا توجد مشاريع مسجلة لهذه الشركة حالياً
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      {/* شريط اختيار المشروع السريع + تقرير المقايسة التحليلي */}
      <div
        className="no-print"
        style={{
          background: 'var(--surface-card)',
          borderRadius: '20px',
          padding: '1.1rem 1.25rem',
          boxShadow: 'var(--shadow-ambient)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.35rem',
                height: '2.35rem',
                borderRadius: '12px',
                background: 'var(--accent-soft-bg)',
                color: 'var(--accent-ink)',
              }}
            >
              <Building2 size={18} />
            </span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 'var(--fs-lg)', color: 'var(--text-primary)' }}>
                {selectedProject ? selectedProject.Property || selectedProject.project_name : 'اختر المشروع'}
              </div>
              {selectedProject && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 700 }}>
                  {selectedProject.unit_type || 'نموذج عام'}
                  {Number(selectedProject.unit_area) > 0 ? ` • ${selectedProject.unit_area} م²` : ''} • قيمة التعاقد:{' '}
                  <b style={{ color: 'var(--accent-ink)' }}>
                    {formatCurrency(Number(boqStats.totalContractValue || selectedProject.contract_value || 0))}
                  </b>{' '}
                  • الحالة: <b>{selectedProject.status || 'قيد التنفيذ'}</b>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsBoqReportOpen(true)}
            disabled={!selectedProject || projectsLogic.isDetailsLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.15rem',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--action-fill)',
              color: 'var(--action-ink)',
              fontWeight: 900,
              fontSize: 'var(--fs-sm)',
              cursor: !selectedProject || projectsLogic.isDetailsLoading ? 'not-allowed' : 'pointer',
              opacity: !selectedProject || projectsLogic.isDetailsLoading ? 0.6 : 1,
            }}
          >
            <FileText size={16} />
            <span>التقرير التحليلي للمقايسة (BOQ)</span>
          </button>
        </div>

        {/* أزرار التبديل السريع بين المشاريع */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {projects.map((p) => {
            const active = String(selectedProject?.id || '') === String(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectProject(p)}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: '10px',
                  border: active ? '1px solid rgba(249, 115, 22, 0.45)' : '1px solid var(--control-edge, rgba(148, 163, 184, 0.16))',
                  background: active ? 'var(--accent-soft-bg)' : 'var(--surface-sunken)',
                  color: active ? 'var(--accent-ink)' : 'var(--text-secondary)',
                  fontWeight: 900,
                  fontSize: 'var(--fs-xs)',
                  cursor: 'pointer',
                  transition: '0.18s',
                }}
              >
                {p.Property || p.project_name}
              </button>
            );
          })}
        </div>
      </div>

      {projectsLogic.isDetailsLoading || !selectedProject ? (
        <LoadingScreen message="جاري تحميل تقارير المشروع المختار..." fullScreen={false} />
      ) : (
        <>
          <ReportsTab
            logic={projectsLogic}
            hideAllProjectsTab
            initialSubTab="milestones"
            onOpenBoqReport={() => setIsBoqReportOpen(true)}
          />
          <ProjectReportModal
            isOpen={isBoqReportOpen}
            onClose={() => setIsBoqReportOpen(false)}
            logic={projectsLogic}
            boqStats={boqStats}
            flatBoqData={flatBoqData}
          />
        </>
      )}
    </div>
  );
}
