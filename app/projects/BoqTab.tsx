import React, { useMemo, useState } from 'react';
import SecureAction from '@/components/SecureAction';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import RawasiSmartTable from '@/components/rawasismarttable';
import BoqFormModal from './BoqFormModal';
import ProjectReportModal from './ProjectReportModal'; 
import { Pencil, Trash2, Plus, Printer, ClipboardList } from 'lucide-react';

// دالة تطهير النصوص خارج المكون لمنع الـ Loop وتنظيف الكلمات
const normalizeArabic = (str: string) => {
  if (!str) return '';
  return str.trim().toLowerCase()
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ');
};

export default function BoqTab({ logic, setDeleteAlert }: { logic: any, setDeleteAlert: any }) {
  const [isReportOpen, setIsReportOpen] = useState(false);

  // استخراج الداتا بأمان
  const boqList = logic.projectDetails?.boq || [];
  const assignments = logic.projectDetails?.contractorAssignments || [];
  const expenses = logic.projectDetails?.expenses || [];

  // 1️⃣ ترتيب بنود المقايسة (رئيسي ثم فرعي) وتجميع قيم المراحل الرئيسية تلقائياً
  const flatBoqData = useMemo(() => {
      if (boqList.length === 0) return [];
      const result: any[] = [];
      const mains = boqList.filter((i: any) => i.item_type === 'رئيسي');
      
      mains.forEach((main: any) => {
          const subs = boqList.filter((sub: any) => sub.parent_id === main.id);
          if (subs.length > 0) {
            // تجميع القيم المالية للبنود الفرعية داخل المرحلة الرئيسية تلقائياً
            const rolledUpMain = {
              ...main,
              is_parent_phase: true,
              total_contract_amount: subs.reduce((sum: number, s: any) => sum + Number(s.total_contract_amount || 0), 0),
              estimated_labor_cost: subs.reduce((sum: number, s: any) => sum + Number(s.estimated_labor_cost || 0), 0),
              estimated_subcontractor_cost: subs.reduce((sum: number, s: any) => sum + Number(s.estimated_subcontractor_cost || 0), 0),
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
            };
            result.push(rolledUpMain);
          } else {
            result.push(main);
          }
          result.push(...subs);
      });
      const mappedIds = new Set(result.map(r => r.id));
      const orphans = boqList.filter((b: any) => !mappedIds.has(b.id));
      return [...result, ...orphans];
  }, [boqList]);

  // 2️⃣ حساب الإحصائيات الكلية للسامري بقراءة الأعمدة المحسوبة من الداتا بيز مباشرة
  const boqStats = useMemo(() => {
    let totalContractValue = 0, totalEstimatedCosts = 0, subItemsCount = 0;
    let totalActualLabor = 0, totalActualMaterial = 0, totalDirectExpenses = 0;
    let totalRetentionValue = 0, totalNetProfit = 0, totalBudgetVariance = 0;
    let totalAllocatedExpensesABC = 0;

    flatBoqData.forEach((item: any) => {
      // تجنب التكرار المالي: حساب البنود الفرعية والمنفصلة فقط وليس المراحل الرئيسية المجمعة
      const isParent = item.item_type === 'رئيسي' || item.is_parent_phase;
      if (!isParent) {
        subItemsCount++;
        totalContractValue += Number(item.total_contract_amount || 0);
        totalEstimatedCosts += (Number(item.estimated_labor_cost || 0) + Number(item.estimated_subcontractor_cost || 0) + Number(item.estimated_material_cost || 0) + Number(item.estimated_expenses_cost || 0));
        
        // التكاليف الفعلية المباشرة المسحوبة للبند
        totalActualLabor += Number(item.actual_labor_cost || 0);
        totalActualMaterial += Number(item.actual_material_cost || 0);
        totalDirectExpenses += Number(item.actual_expenses_cost || 0);

        // القيم المالية المحسوبة من السيرفر
        totalRetentionValue += Number(item.actual_retention_amount || 0);
        totalNetProfit += Number(item.item_net_profit || 0);
        totalBudgetVariance += Number(item.total_budget_variance || 0);
        
        // تجميع التكاليف الموزعة
        totalAllocatedExpensesABC += Number(item.allocated_expenses || 0);
      }
    });

    const totalActualCosts = totalActualLabor + totalActualMaterial + totalDirectExpenses;
    const remainingBudget = totalEstimatedCosts - totalActualCosts;
    const isActualStarted = totalActualCosts > 0;

    // سحب إجمالي المصاريف المحملة (الإدارية والتشغيلية العامة)
    const totalAllocatedOverhead = expenses
        .filter((e: any) => !['direct', 'material', 'labor_direct', 'labor_allocated'].includes(e.row_type))
        .reduce((sum: number, e: any) => sum + Number(e.amount || e.total_price || 0), 0);

    const totalAssignedContracts = assignments.reduce((sum: number, a: any) => sum + Number(a.total_contract_amount || 0), 0);
    
    // الهوامش والنسب المئوية
    const profitMargin = totalContractValue > 0 ? ((totalNetProfit / totalContractValue) * 100).toFixed(1) : "0.0";
    const isLoss = totalNetProfit < 0;

    return { 
      totalContractValue, totalEstimatedCosts, subItemsCount, totalAssignedContracts, 
      totalRetentionValue, totalNetProfit, profitMargin, isLoss, totalBudgetVariance,
      totalAllocatedOverhead, totalActualLabor, totalActualMaterial, totalDirectExpenses,
      totalActualCosts, remainingBudget, isActualStarted, totalAllocatedExpensesABC
    };
  }, [flatBoqData, assignments, expenses]);

  // 3️⃣ تجهيز أعمدة الجدول الذكي بمطابقتها للأعمدة والمعادلات المحاسبية السليمة
  const boqColumns = useMemo(() => [
    { 
        header: 'البند / المرحلة', 
        accessor: 'work_item',
        render: (row: any) => {
            const isMain = row.item_type === 'رئيسي' || row.is_parent_phase;
            if (isMain) {
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ 
                    backgroundColor: THEME.coffeeDark, 
                    color: '#ffffff', 
                    padding: '0.125rem 0.5rem', 
                    borderRadius: '6px', 
                    fontSize: 'var(--fs-xs)', 
                    fontWeight: 800 
                  }}>
                    مرحلة رئيسية
                  </span>
                  <span style={{ fontWeight: 900, color: THEME.coffeeDark, fontSize: 'var(--fs-md)' }}>
                    {row.work_item}
                  </span>
                  {row.subs_count && (
                    <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 700 }}>
                      ({row.subs_count} بنود)
                    </span>
                  )}
                </div>
              );
            }
            return (
              <span style={{ paddingRight: '1.25rem', color: '#334155', fontWeight: 800, fontSize: 'var(--fs-sm)', display: 'inline-block' }}>
                ↳ {row.work_item}
              </span>
            );
        }
    },
    { 
        header: 'إجمالى البند (البيع)', 
        render: (row: any) => {
            const isMain = row.item_type === 'رئيسي' || row.is_parent_phase;
            return (
              <span style={{ 
                fontWeight: 900, 
                color: THEME.coffeeDark, 
                fontSize: isMain ? 'var(--fs-md)' : 'var(--fs-sm)',
                backgroundColor: isMain ? 'rgba(78, 52, 46, 0.08)' : 'transparent',
                padding: isMain ? '0.2rem 0.5rem' : '0',
                borderRadius: '6px',
                display: 'inline-block'
              }}>
                {formatCurrency(row.total_contract_amount)}
              </span>
            );
        }
    },
    { 
        header: 'الميزانية المقدرة', 
        render: (row: any) => {
            const budget = Number(row.estimated_labor_cost || 0) + Number(row.estimated_subcontractor_cost || 0) + Number(row.estimated_material_cost || 0) + Number(row.estimated_expenses_cost || 0);
            const isMain = row.item_type === 'رئيسي' || row.is_parent_phase;
            const subCost = Number(row.estimated_subcontractor_cost || 0);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
                <span style={{ 
                  fontWeight: 900, 
                  color: isMain ? '#0f172a' : '#475569', 
                  backgroundColor: isMain ? '#e2e8f0' : '#f1f5f9', 
                  padding: '0.25rem 0.5rem', 
                  borderRadius: '6px',
                  fontSize: isMain ? 'var(--fs-md)' : 'var(--fs-sm)',
                  display: 'inline-block'
                }}>
                  {formatCurrency(budget)}
                </span>
                {subCost > 0 && (
                  <span style={{ fontSize: '10px', color: '#7e22ce', fontWeight: 700, backgroundColor: '#faf5ff', padding: '1px 4px', borderRadius: '4px' }}>
                    باطن: {formatCurrency(subCost)}
                  </span>
                )}
              </div>
            );
        }
    },
    { 
        header: 'مصروفات مباشرة', 
        render: (row: any) => <span style={{ fontWeight: 900, color: '#ea580c' }}>{formatCurrency(row.actual_expenses_cost)}</span>
    },
    // العمود لعرض التوزيعات الذكية
    { 
        header: 'مصروفات موزعة (ABC)', 
        render: (row: any) => (
            <span style={{ fontWeight: 900, color: '#9333EA', backgroundColor: '#F3E8FF', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: 'var(--fs-sm)' }}>
                {formatCurrency(row.allocated_expenses || 0)}
            </span>
        )
    },
    { 
        header: 'خامات فعلية', 
        render: (row: any) => <span style={{ fontWeight: 900, color: THEME.goldAccent }}>{formatCurrency(row.actual_material_cost)}</span>
    },
    { 
        header: 'عمالة ومعدات فعلية', 
        render: (row: any) => {
            const laborAndOps = Number(row.actual_labor_cost || 0);
            return <span style={{ fontWeight: 900, color: '#0369A1' }}>{formatCurrency(laborAndOps)}</span>;
        }
    },
    { 
        header: 'المتبقي من الميزانية', 
        render: (row: any) => {
            const budget = Number(row.estimated_labor_cost || 0) + Number(row.estimated_subcontractor_cost || 0) + Number(row.estimated_material_cost || 0) + Number(row.estimated_expenses_cost || 0);
            const actualTotal = Number(row.actual_labor_cost || 0) + Number(row.actual_material_cost || 0) + Number(row.actual_expenses_cost || 0);
            const remaining = budget - actualTotal;
            const isMain = row.item_type === 'رئيسي' || row.is_parent_phase;

            if (actualTotal === 0) {
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 900, color: '#475569', fontSize: isMain ? 'var(--fs-md)' : 'var(--fs-sm)' }}>
                    {formatCurrency(remaining)}
                  </span>
                  <span style={{ fontSize: '10px', color: '#64748b', backgroundColor: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                    لم يُصرف بعد
                  </span>
                </div>
              );
            }

            const isOverrun = remaining < 0;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 900, color: isOverrun ? THEME.danger : '#047857', fontSize: isMain ? 'var(--fs-md)' : 'var(--fs-sm)' }}>
                  {remaining > 0 ? '+' : ''}{formatCurrency(remaining)}
                </span>
                <span style={{ 
                  fontSize: '10px', 
                  color: isOverrun ? THEME.danger : '#047857', 
                  backgroundColor: isOverrun ? '#fee2e2' : '#d1fae5', 
                  padding: '1px 5px', 
                  borderRadius: '4px', 
                  fontWeight: 700 
                }}>
                  {isOverrun ? 'تجاوز وعجز' : 'وفر متبقي'}
                </span>
              </div>
            );
        }
    },
    { 
        header: 'صافي ربح البند', 
        render: (row: any) => {
            const netProfit = Number(row.item_net_profit || 0);
            const totalContract = Number(row.total_contract_amount || 0);
            const isLoss = netProfit < 0;
            const actualTotal = Number(row.actual_labor_cost || 0) + Number(row.actual_material_cost || 0) + Number(row.actual_expenses_cost || 0);
            const margin = totalContract > 0 ? ((netProfit / totalContract) * 100).toFixed(1) : '0.0';
            const isMain = row.item_type === 'رئيسي' || row.is_parent_phase;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
                <span style={{ 
                  fontWeight: 900, 
                  color: isLoss ? THEME.danger : THEME.success, 
                  backgroundColor: isLoss ? '#FEF2F2' : '#F0FDF4', 
                  padding: '0.2rem 0.5rem', 
                  borderRadius: '6px', 
                  fontSize: isMain ? 'var(--fs-md)' : 'var(--fs-sm)', 
                  display: 'inline-block',
                  border: isLoss ? '1px solid #fca5a5' : '1px solid #86efac'
                }}>
                  {netProfit > 0 ? '+' : ''}{formatCurrency(netProfit)}
                </span>
                {totalContract > 0 && (
                  <span style={{ 
                    fontSize: '10px', 
                    color: isLoss ? THEME.danger : '#15803d', 
                    fontWeight: 700 
                  }}>
                    {isLoss ? `خسارة ${Math.abs(Number(margin))}%` : `هامش ${margin}%`}
                    {actualTotal === 0 ? ' (تقديري)' : ' (فعلي)'}
                  </span>
                )}
              </div>
            );
        } 
    },
    { 
        header: 'ضمان الأعمال', 
        render: (row: any) => {
          const percent = Number(row.retention_percentage || 0);
          const amount = Number(row.actual_retention_amount || 0);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontWeight: 800, color: '#475569' }}>{formatCurrency(amount)}</span>
              {percent > 0 ? (
                <span style={{ fontSize: '10px', color: '#b45309', fontWeight: 700, backgroundColor: '#fef3c7', padding: '1px 5px', borderRadius: '4px' }}>
                  محتجز {percent}%
                </span>
              ) : (
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                  بدون احتجاز (0%)
                </span>
              )}
            </div>
          );
        }
    },
    {
        header: 'الإجراءات',
        render: (row: any) => (
            <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center' }}>
                <SecureAction module="boqbudget" action="edit"><button onClick={() => { logic.setCurrentBoqRecord(row); logic.setIsBoqModalOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-lg)' }} title="تعديل البند"><Pencil size={14} aria-hidden="true" /></button></SecureAction>
                <SecureAction module="boqbudget" action="delete"><button onClick={() => { setDeleteAlert({ isOpen: true, type: 'boq', id: row.id, title: 'حذف بند مقايسة', message: `هل أنت متأكد من حذف البند "${row.work_item}"؟` }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-lg)', opacity: 0.8 }} title="حذف البند"><Trash2 size={14} aria-hidden="true" /></button></SecureAction>
            </div>
        )
    }
  ], [logic, setDeleteAlert]);

  return (
    <div>
      {/* 📊 كروت السامري الكلية المطورة للرقابة المالية */}
      {flatBoqData.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13.5rem, 1fr))', gap: '0.9375rem', marginBottom: '1.5625rem' }}>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', padding: '0.9375rem 1.25rem', borderRadius: '14px', borderBottom: `4px solid ${THEME.coffeeDark}`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
            <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, marginBottom: '0.3125rem' }}>إجمالي قيمة المقايسة (البيع)</span>
            <strong style={{ fontSize: 'var(--fs-xl)', color: THEME.coffeeDark, fontWeight: 900 }}>{formatCurrency(boqStats.totalContractValue)}</strong>
          </div>

          <div style={{ backgroundColor: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', padding: '0.9375rem 1.25rem', borderRadius: '14px', borderBottom: `4px solid #475569`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
            <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, marginBottom: '0.3125rem' }}>إجمالي الميزانية التقديرية</span>
            <strong style={{ fontSize: 'var(--fs-xl)', color: '#1e293b', fontWeight: 900 }}>{formatCurrency(boqStats.totalEstimatedCosts)}</strong>
          </div>

          <div style={{ backgroundColor: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', padding: '0.9375rem 1.25rem', borderRadius: '14px', borderBottom: `4px solid #0284c7`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-xs)', color: '#0369a1', fontWeight: 800, marginBottom: '0.3125rem' }}>
              <span>المنصرف الفعلي حتى الآن</span>
              <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>
                {boqStats.totalEstimatedCosts > 0 ? ((boqStats.totalActualCosts / boqStats.totalEstimatedCosts) * 100).toFixed(1) : '0.0'}%
              </span>
            </span>
            <strong style={{ fontSize: 'var(--fs-xl)', color: '#0369a1', fontWeight: 900 }}>{formatCurrency(boqStats.totalActualCosts)}</strong>
          </div>

          <div style={{ 
            backgroundColor: boqStats.remainingBudget < 0 ? 'rgba(254,226,226,0.7)' : 'rgba(209,250,229,0.7)', 
            backdropFilter: 'blur(10px)', padding: '0.9375rem 1.25rem', borderRadius: '14px', 
            borderBottom: `4px solid ${boqStats.remainingBudget < 0 ? THEME.danger : '#057857'}`, 
            boxShadow: '0 4px 15px rgba(0,0,0,0.02)' 
          }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, marginBottom: '0.3125rem' }}>
              <span>الميزانية المتبقية المتاحة</span>
              <span style={{ 
                backgroundColor: boqStats.remainingBudget < 0 ? '#fee2e2' : '#d1fae5', 
                color: boqStats.remainingBudget < 0 ? THEME.danger : '#057857', 
                padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 
              }}>
                {!boqStats.isActualStarted ? 'متاح 100%' : (boqStats.remainingBudget < 0 ? 'عجز' : 'وفر')}
              </span>
            </span>
            <strong style={{ fontSize: 'var(--fs-xl)', color: boqStats.remainingBudget < 0 ? THEME.danger : '#057857', fontWeight: 900 }}>
              {formatCurrency(boqStats.remainingBudget)}
            </strong>
          </div>

          <div style={{ 
              backgroundColor: boqStats.isLoss ? 'rgba(254,226,226,0.8)' : 'rgba(220,252,231,0.7)', 
              backdropFilter: 'blur(10px)', padding: '0.9375rem 1.25rem', borderRadius: '14px', 
              borderBottom: `4px solid ${boqStats.isLoss ? THEME.danger : THEME.success}`, 
              boxShadow: '0 4px 15px rgba(0,0,0,0.02)' 
          }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-xs)', color: boqStats.isLoss ? THEME.danger : '#166534', fontWeight: 900, marginBottom: '0.3125rem' }}>
              <span>{boqStats.isLoss ? 'صافي خسارة' : (boqStats.isActualStarted ? 'صافي الأرباح الفعلية' : 'صافي الأرباح التعاقدية')}</span>
              <span style={{ background: boqStats.isLoss ? THEME.danger : '#166534', color: 'white', padding: '2px 0.375rem', borderRadius: '4px', fontSize: 'var(--fs-xs)', direction: 'ltr' }}>
                {boqStats.profitMargin}%
              </span>
            </span>
            <strong style={{ fontSize: 'var(--fs-xl)', color: boqStats.isLoss ? THEME.danger : THEME.success, fontWeight: 900, direction: 'ltr' }}>
              {boqStats.totalNetProfit > 0 ? '+' : ''}{formatCurrency(boqStats.totalNetProfit)}
            </strong>
          </div>
        </div>
      )}

      {/* 📋 جدول المقايسة الذكي ومتابعة التكاليف الفعلية */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', padding: '0 0.625rem', flexWrap: 'wrap', gap: '0.9375rem' }}>
           <h3 style={{ margin: 0, color: THEME.coffeeDark, fontWeight: 900 }}>مقارنة ومتابعة الميزانيات بالتكاليف الفعلية والانحرافات</h3>
           
           <div style={{ display: 'flex', gap: '0.625rem' }}>
             <SecureAction module="boqbudget" action="create">
               <button 
                 onClick={() => {
                   logic.setCurrentBoqRecord({ 
                     item_type: 'رئيسي', 
                     contract_quantity: 1, 
                     unit_contract_price: 0, 
                     retention_percentage: 0,
                     tech_count: 0,
                     tech_daily_wage: 0,
                     helper_count: 0,
                     helper_daily_wage: 0,
                     labor_days: 0,
                     estimated_labor_cost: 0, 
                     subcontractor_rebar_cost: 0,
                     subcontractor_concrete_cost: 0,
                     subcontractor_other_cost: 0,
                     estimated_subcontractor_cost: 0,
                     estimated_material_cost: 0, 
                     estimated_expenses_cost: 0, 
                     start_date: '', 
                     end_date: '' 
                   });
                   logic.setIsBoqModalOpen(true);
                 }}
                 style={{
                   backgroundColor: '#fb923c', color: 'white', padding: '0.625rem 1.25rem', borderRadius: '10px',
                   border: 'none', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                   boxShadow: '0 4px 10px rgba(0,0,0,0.1)', transition: 'all 0.3s'
                 }}
               >
                 <span><Plus size={16} aria-hidden="true" /></span> إضافة بند موازنة
               </button>
             </SecureAction>

             {flatBoqData.length > 0 && (
               <button 
                 onClick={() => setIsReportOpen(true)}
                 style={{
                   backgroundColor: THEME.primary, color: 'white', padding: '0.625rem 1.25rem', borderRadius: '10px',
                   border: 'none', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                   boxShadow: '0 4px 10px rgba(0,0,0,0.1)', transition: 'all 0.3s'
                 }}
               >
                 <span><Printer size={16} aria-hidden="true" /></span> عرض التقرير للطباعة
               </button>
             )}
           </div>
        </div>

        {flatBoqData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8', fontWeight: 900 }}>
                <div style={{ fontSize: 'var(--fs-display)', marginBottom: '0.625rem' }}><ClipboardList size={34} aria-hidden="true" /></div>
                لا توجد بنود مقايسة مضافة لهذا المشروع بعد.<br/>
            </div>
        ) : (
            <RawasiSmartTable data={flatBoqData} columns={boqColumns} />
        )}
        
        {logic.isBoqModalOpen && (
            <BoqFormModal 
                isOpen={logic.isBoqModalOpen} onClose={() => logic.setIsBoqModalOpen(false)}
                record={logic.currentBoqRecord} setRecord={logic.setCurrentBoqRecord}
                onSave={logic.handleSaveBoq} projectBoq={logic.projectDetails.boq}
                isSaving={logic.isSavingBoq}
            />
        )}

        <ProjectReportModal 
          isOpen={isReportOpen} 
          onClose={() => setIsReportOpen(false)} 
          logic={logic} 
          boqStats={boqStats} 
          flatBoqData={flatBoqData} 
        />
      </div>
    </div>
  );
}
