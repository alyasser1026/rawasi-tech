import React, { useMemo } from 'react';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import { KpiCard, ProgressBar } from './SharedUI';

export default function OverviewTab({ logic }: { logic: any }) {
  const { kpis, projectDetails } = logic;
  const boqList = projectDetails?.boq || [];

  const projectFinancials = useMemo(() => {
    let totalContract = 0;
    let totalBudget = 0;
    let totalActualCost = 0;
    let totalRetention = 0;
    let totalNetProfit = 0;
    let totalVariance = 0;
    let totalVillaRevenue = 0; 
    let totalAllocatedABC = 0; // 🎯 المتغير السحري لجمع مصروفات ABC

    boqList.forEach((item: any) => {
      const hasChildren = boqList.some((child: any) => child.parent_id === item.id);
      if (!hasChildren) {
        // سحب المصاريف الموزعة اللي جهزناها في اللوجيك
        const allocated = Number(item.allocated_expenses || 0);
        totalAllocatedABC += allocated;

        totalContract += Number(item.total_contract_amount || 0);
        totalBudget += (
          Number(item.estimated_labor_cost || 0) +
          Number(item.estimated_material_cost || 0) +
          Number(item.estimated_expenses_cost || 0) +
          Number(item.estimated_subcontractor_cost || 0)
        );
        
        // التكلفة الفعلية + التكاليف الموزعة
        totalActualCost += (Number(item.actual_labor_cost || 0) + Number(item.actual_material_cost || 0) + Number(item.actual_expenses_cost || 0)) + allocated;
        
        totalRetention += Number(item.actual_retention_amount || 0);
        
        // الأرباح مخصوم منها التكاليف الموزعة أوتوماتيك في اللوجيك، فهنا نجمع مباشرة
        totalNetProfit += Number(item.item_net_profit || 0);
        totalVariance += Number(item.total_budget_variance || 0);
        
        totalVillaRevenue += Number(item.actual_revenue || 0);
      }
    });

    const effectiveRevenue = totalVillaRevenue || Number(kpis?.totalRevenue || 0);
    const effectiveContract = totalContract || Number(kpis?.totalContract || 0);
    const financialProgress = effectiveContract > 0 ? (effectiveRevenue / effectiveContract) * 100 : 0;
    const profitMargin = effectiveContract > 0 ? ((totalNetProfit / effectiveContract) * 100).toFixed(1) : "0.0";

    return {
      totalContract: effectiveContract,
      totalBudget: totalBudget || Number(kpis?.totalEstimatedBudget || 0),
      totalActualCost: totalActualCost || Number(kpis?.actualCost || 0),
      totalAllocatedABC,
      totalVillaRevenue: effectiveRevenue,
      financialProgress,
      profitMargin,
      totalRetention,
      totalNetProfit,
      totalVariance,
      isLoss: totalNetProfit < 0,
      isOverrun: totalVariance < 0
    };
  }, [boqList, kpis]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13.75rem, 1fr))', gap: '1.25rem', marginBottom: '1.5625rem' }}>
        <KpiCard title="قيمة التعاقد الكلية" value={projectFinancials.totalContract} color={THEME.coffeeDark} />
        <KpiCard title="الميزانية المعتمدة" value={projectFinancials.totalBudget} color={THEME.coffeeMain} />
        
        <KpiCard 
          title="إجمالي الصرف الفعلي (مباشر وموزع)" 
          value={projectFinancials.totalActualCost} 
          color={projectFinancials.isOverrun ? THEME.danger : THEME.warning} 
          alert={projectFinancials.isOverrun ? 'تجاوز للميزانية التقديرية' : 'الإنفاق آمن وضمن الخطة'} 
        />
        <KpiCard title="المحصل (إيرادات مخصصة للفيلا)" value={projectFinancials.totalVillaRevenue} color={THEME.success} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13.75rem, 1fr))', gap: '1.25rem', marginBottom: '1.5625rem' }}>
        <KpiCard 
          title="صافي الأرباح الحقيقية" 
          value={projectFinancials.totalNetProfit} 
          color={projectFinancials.isLoss ? THEME.danger : THEME.success}
          alert={projectFinancials.isLoss ? 'المشروع يسجل خسارة حالياً' : `نسبة الربح الصافي ${projectFinancials.profitMargin}%`}
        />

        <KpiCard 
          title="انحراف الميزانية الكلي" 
          value={projectFinancials.totalVariance} 
          color={projectFinancials.isOverrun ? THEME.danger : '#047857'} 
          alert={projectFinancials.isOverrun ? `عجز بقيمة ${formatCurrency(Math.abs(projectFinancials.totalVariance))}` : `وفر مالي محقق`}
        />

        <KpiCard title="محجوز ضمان الأعمال" value={projectFinancials.totalRetention} color="#475569" />
        
        {/* 🚀 كارت المصروفات الموزعة الجديد اللي بيقرأ بدقة متناهية */}
        <KpiCard title="المصروفات الموزعة (ABC)" value={projectFinancials.totalAllocatedABC} color="#9333EA" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(17.5rem, 1fr))', gap: '1.5625rem', marginBottom: '1.5625rem' }}>
        <div className="glass-card">
          <h3 style={{ margin: '0 0 1.25rem 0', color: THEME.coffeeDark, fontWeight: 900 }}>تقرير العمالة الميدانية (الفنيين والمساعدين)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11.5rem, 1fr))', gap: '0.85rem' }}>
            <div className="labor-stat-item" style={{ borderRight: '4px solid #0284c7' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#0369a1', fontWeight: 900 }}>👷 عدد أيام يومية الفنيين</span>
              <strong style={{ fontSize: 'var(--fs-xl)', color: '#0284c7' }}>{projectDetails.laborStats?.techDays || 0} يوم</strong>
              <span style={{ fontSize: '11px', color: '#475569', fontWeight: 800, display: 'block', marginTop: '2px' }}>
                التكلفة: {formatCurrency(projectDetails.laborStats?.techCost || 0)}
              </span>
            </div>
            <div className="labor-stat-item" style={{ borderRight: '4px solid #0d9488' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#0f766e', fontWeight: 900 }}>🤝 عدد أيام يومية المساعدين</span>
              <strong style={{ fontSize: 'var(--fs-xl)', color: '#0d9488' }}>{projectDetails.laborStats?.helperDays || 0} يوم</strong>
              <span style={{ fontSize: '11px', color: '#475569', fontWeight: 800, display: 'block', marginTop: '2px' }}>
                التكلفة: {formatCurrency(projectDetails.laborStats?.helperCost || 0)}
              </span>
            </div>
            <div className="labor-stat-item">
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800 }}>إجمالي أيام العمالة المسجلة</span>
              <strong style={{ fontSize: 'var(--fs-xl)' }}>{projectDetails.laborStats?.totalWorkersToDate || 0} يوم</strong>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block', marginTop: '2px' }}>
                عمالة اليوم: {projectDetails.laborStats?.todayWorkers || 0} يوم ({formatCurrency(projectDetails.laborStats?.todayCost || 0)})
              </span>
            </div>
            <div className="labor-stat-item">
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800 }}>إجمالي أجور العمالة الفعلية</span>
              <strong style={{ fontSize: 'var(--fs-xl)', color: THEME.danger }}>{formatCurrency(projectDetails.laborStats?.totalLaborCost || 0)}</strong>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block', marginTop: '2px' }}>
                فنيين + مساعدين
              </span>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <h3 style={{ margin: '0 0 1.25rem 0', color: THEME.coffeeDark, fontWeight: 900 }}>مؤشر الإنجاز والزمن</h3>
          <ProgressBar label="الوقت المنقضي من مدة المشروع" percentage={kpis?.timeProgress} color={THEME.coffeeMain} />
          <div style={{height:'0.9375rem'}}/>
          <ProgressBar label="الإنجاز المالي والتحصيل الفعلي للفيلا" percentage={projectFinancials.financialProgress} color={THEME.goldAccent} />
          <div style={{ 
            marginTop: '1.25rem', padding: '0.75rem', 
            backgroundColor: kpis?.timeStatus?.includes('متأخر') ? '#FEE2E2' : '#DCFCE7', 
            borderRadius: '12px', fontWeight: 900, textAlign: 'center', 
            color: kpis?.timeStatus?.includes('متأخر') ? THEME.danger : THEME.success 
          }}>
            حالة الجدول الزمني: {kpis?.timeStatus || 'مستقر وضمن الجدول'}
          </div>
        </div>
      </div>
    </div>
  );
}