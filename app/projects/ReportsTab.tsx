"use client";
import React, { useState, useMemo } from 'react';
import { formatCurrency, formatDate } from '@/lib/helpers';
import { THEME } from '@/lib/theme';
import { 
  Calendar, DollarSign, CheckCircle2, Clock, AlertTriangle, 
  FileText, Plus, Trash2, Edit3, Printer, Sparkles, 
  Link2, ShieldAlert, TrendingUp, HardHat, Camera, 
  ChevronRight, ArrowUpRight, Check, X, Search, Layers
} from 'lucide-react';
import SecureAction from '@/components/SecureAction';

interface ReportsTabProps {
  logic: any;
}

export default function ReportsTab({ logic }: ReportsTabProps) {
  const [subTab, setSubTab] = useState<'milestones' | 'timeline' | 'visits' | 'evm' | 'subcontractors'>('milestones');
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<any>(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<any>(null);
  const [isPrintDossierOpen, setIsPrintDossierOpen] = useState(false);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);

  const project = logic.selectedProject || {};
  const details = logic.projectDetails || {};
  const milestones: any[] = details.milestones || [];
  const siteVisits: any[] = details.siteVisits || [];
  const receiptVouchers: any[] = details.receiptVouchers || [];
  const boqList: any[] = details.boq || [];

  // =========================================================================
  // 1️⃣ إحصائيات وحسابات جدول دفعات العميل
  // =========================================================================
  const paymentStats = useMemo(() => {
    const contractVal = Number(project.contract_value) || 0;
    const totalScheduled = milestones.reduce((sum, m) => sum + (Number(m.expected_amount) || 0), 0);
    const totalReceived = milestones.reduce((sum, m) => sum + (Number(m.received_amount) || 0), 0);
    const totalRemaining = Math.max(0, totalScheduled - totalReceived);
    const collectionRate = totalScheduled > 0 ? ((totalReceived / totalScheduled) * 100).toFixed(1) : '0.0';
    const contractCoverageRate = contractVal > 0 ? ((totalScheduled / contractVal) * 100).toFixed(1) : '0.0';
    
    const today = new Date().toISOString().split('T')[0];
    const overdueCount = milestones.filter(m => m.due_date && m.due_date < today && m.status !== 'محصلة بالكامل').length;
    const paidCount = milestones.filter(m => m.status === 'محصلة بالكامل').length;

    return {
      contractVal,
      totalScheduled,
      totalReceived,
      totalRemaining,
      collectionRate,
      contractCoverageRate,
      overdueCount,
      paidCount,
      count: milestones.length
    };
  }, [project, milestones]);

  // =========================================================================
  // 2️⃣ حسابات الجدول الزمني ومخطط جانت المسحوبة من المقايسة
  // =========================================================================
  const scheduleData = useMemo(() => {
    // تصفية البنود التي لها تواريخ بداية ونهاية
    const itemsWithDates = boqList
      .filter((b: any) => b.start_date && b.end_date)
      .map((b: any) => {
        const start = new Date(b.start_date).getTime();
        const end = new Date(b.end_date).getTime();
        const durationDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
        return {
          ...b,
          startTime: start,
          endTime: end,
          durationDays
        };
      })
      .sort((a, b) => a.startTime - b.startTime);

    if (itemsWithDates.length === 0) {
      return { items: [], minStart: null, maxEnd: null, totalDays: 0, elapsedDays: 0, timeProgress: 0 };
    }

    const minStart = Math.min(...itemsWithDates.map(i => i.startTime));
    const maxEnd = Math.max(...itemsWithDates.map(i => i.endTime));
    const totalDays = Math.max(1, Math.round((maxEnd - minStart) / (1000 * 60 * 60 * 24)) + 1);
    
    const now = new Date().getTime();
    let elapsedDays = 0;
    if (now > maxEnd) elapsedDays = totalDays;
    else if (now < minStart) elapsedDays = 0;
    else elapsedDays = Math.round((now - minStart) / (1000 * 60 * 60 * 24));

    const timeProgress = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

    // إثراء البنود بنسب العرض المئوية لمخطط جانت
    const enrichedItems = itemsWithDates.map(item => {
      const leftPct = Math.max(0, Math.min(100, ((item.startTime - minStart) / (maxEnd - minStart)) * 100));
      const widthPct = Math.max(2, Math.min(100 - leftPct, ((item.endTime - item.startTime) / (maxEnd - minStart)) * 100));
      
      let statusText = 'قادم';
      let statusColor = '#64748b';
      let barBg = 'linear-gradient(90deg, #6366f1, #818cf8)';

      if (now > item.endTime) {
        statusText = 'مكتمل زمنياً';
        statusColor = '#059669';
        barBg = 'linear-gradient(90deg, #10b981, #34d399)';
      } else if (now >= item.startTime && now <= item.endTime) {
        statusText = 'جاري التنفيذ';
        statusColor = '#d97706';
        barBg = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
      }

      return {
        ...item,
        leftPct,
        widthPct,
        statusText,
        statusColor,
        barBg
      };
    });

    const todayLeftPct = Math.max(0, Math.min(100, ((now - minStart) / (maxEnd - minStart)) * 100));

    return {
      items: enrichedItems,
      minStart: new Date(minStart).toISOString().split('T')[0],
      maxEnd: new Date(maxEnd).toISOString().split('T')[0],
      totalDays,
      elapsedDays,
      timeProgress,
      todayLeftPct
    };
  }, [boqList]);

  // =========================================================================
  // 3️⃣ إحصائيات تقرير الزيارات الميدانية والإشراف الهندسي
  // =========================================================================
  const visitStats = useMemo(() => {
    const total = siteVisits.length;
    const approved = siteVisits.filter(v => v.status === 'معتمدة' || v.status === 'مطابقة').length;
    const withNotes = siteVisits.filter(v => v.status === 'معتمدة بملاحظات' || v.status === 'مفتوحة').length;
    const rejected = siteVisits.filter(v => v.status === 'غير مطابقة' || v.status === 'مرفوضة').length;

    return { total, approved, withNotes, rejected };
  }, [siteVisits]);

  // =========================================================================
  // 4️⃣ تحليل القيمة المكتسبة والانحراف المالي EVM
  // =========================================================================
  const evmData = useMemo(() => {
    let plannedValue = 0;
    let actualCost = 0;
    let earnedValue = 0;

    const leafItems = boqList.filter((b: any) => b.item_type === 'فرعي' || !b.item_type);

    leafItems.forEach((b: any) => {
      const budgetCost = Number(b.estimated_labor_cost || 0) + Number(b.estimated_subcontractor_cost || 0) + Number(b.estimated_material_cost || 0) + Number(b.estimated_expenses_cost || 0);
      const directActual = Number(b.actual_labor_cost || 0) + Number(b.actual_material_cost || 0) + Number(b.actual_expenses_cost || 0);
      const allocatedABC = Number(b.allocated_expenses || 0);
      const totalItemActual = directActual + allocatedABC;
      const contractAmount = Number(b.total_contract_amount || (Number(b.contract_quantity || 0) * Number(b.unit_contract_price || 0)));

      plannedValue += budgetCost;
      actualCost += totalItemActual;
      // تقدير القيمة المكتسبة بناء على نسبة الإنجاز المقدرة
      const itemProgress = budgetCost > 0 ? Math.min(1, totalItemActual / budgetCost) : (totalItemActual > 0 ? 1 : 0);
      earnedValue += contractAmount * itemProgress;
    });

    const costVariance = earnedValue - actualCost;
    const cpi = actualCost > 0 ? (earnedValue / actualCost) : 1;
    const isCostOverrun = actualCost > plannedValue && actualCost > 0;

    return {
      plannedValue,
      actualCost,
      earnedValue,
      costVariance,
      cpi: cpi.toFixed(2),
      isCostOverrun,
      leafItems
    };
  }, [boqList]);

  // =========================================================================
  // 5️⃣ عقود مقاولي الباطن المعتمدة في الميزانية
  // =========================================================================
  const subContractorStats = useMemo(() => {
    let rebarTotal = 0;
    let concreteTotal = 0;
    let otherTotal = 0;

    boqList.forEach((b: any) => {
      if (b.item_type === 'فرعي' || !b.item_type) {
        rebarTotal += Number(b.subcontractor_rebar_cost || 0);
        concreteTotal += Number(b.subcontractor_concrete_cost || 0);
        otherTotal += Number(b.subcontractor_other_cost || 0);
      }
    });

    const totalBudget = rebarTotal + concreteTotal + otherTotal;
    
    // سحب مطالبات ومستخلصات مقاولي الباطن من الفواتير
    const subClaims = (details.invoices || []).filter((inv: any) => inv.display_type === 'مستخلص مقاول باطن');
    const totalPaid = subClaims.reduce((sum: number, c: any) => sum + Number(c.final_amount || 0), 0);
    const remaining = Math.max(0, totalBudget - totalPaid);

    return {
      rebarTotal,
      concreteTotal,
      otherTotal,
      totalBudget,
      totalPaid,
      remaining,
      claimsCount: subClaims.length
    };
  }, [boqList, details.invoices]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', direction: 'rtl' }}>
      
      {/* 🚀 شريط أزرار التابات الفرعية للتقارير مع زر الطباعة التنفيذية */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => setSubTab('milestones')}
            style={{
              padding: '0.625rem 1.125rem',
              borderRadius: '12px',
              border: 'none',
              fontWeight: 800,
              fontSize: 'var(--fs-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              backgroundColor: subTab === 'milestones' ? THEME.primary : '#f8fafc',
              color: subTab === 'milestones' ? 'white' : '#475569',
              boxShadow: subTab === 'milestones' ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none'
            }}
          >
            <DollarSign size={16} />
            جدول دفعات العميل وسندات القبض
            <span style={{
              backgroundColor: subTab === 'milestones' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
              padding: '2px 8px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 900
            }}>
              {milestones.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('timeline')}
            style={{
              padding: '0.625rem 1.125rem',
              borderRadius: '12px',
              border: 'none',
              fontWeight: 800,
              fontSize: 'var(--fs-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              backgroundColor: subTab === 'timeline' ? THEME.primary : '#f8fafc',
              color: subTab === 'timeline' ? 'white' : '#475569',
              boxShadow: subTab === 'timeline' ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none'
            }}
          >
            <Calendar size={16} />
            الجدول الزمني التنفيذي وجانت
            <span style={{
              backgroundColor: subTab === 'timeline' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
              padding: '2px 8px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 900
            }}>
              {scheduleData.items.length} بند
            </span>
          </button>

          <button
            onClick={() => setSubTab('visits')}
            style={{
              padding: '0.625rem 1.125rem',
              borderRadius: '12px',
              border: 'none',
              fontWeight: 800,
              fontSize: 'var(--fs-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              backgroundColor: subTab === 'visits' ? THEME.primary : '#f8fafc',
              color: subTab === 'visits' ? 'white' : '#475569',
              boxShadow: subTab === 'visits' ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none'
            }}
          >
            <HardHat size={16} />
            سجل الزيارات الميدانية والإشراف
            <span style={{
              backgroundColor: subTab === 'visits' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
              padding: '2px 8px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 900
            }}>
              {siteVisits.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('evm')}
            style={{
              padding: '0.625rem 1.125rem',
              borderRadius: '12px',
              border: 'none',
              fontWeight: 800,
              fontSize: 'var(--fs-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              backgroundColor: subTab === 'evm' ? THEME.primary : '#f8fafc',
              color: subTab === 'evm' ? 'white' : '#475569',
              boxShadow: subTab === 'evm' ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none'
            }}
          >
            <TrendingUp size={16} />
            تحليل الانحراف والقيمة المكتسبة EVM
          </button>

          <button
            onClick={() => setSubTab('subcontractors')}
            style={{
              padding: '0.625rem 1.125rem',
              borderRadius: '12px',
              border: 'none',
              fontWeight: 800,
              fontSize: 'var(--fs-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              backgroundColor: subTab === 'subcontractors' ? THEME.primary : '#f8fafc',
              color: subTab === 'subcontractors' ? 'white' : '#475569',
              boxShadow: subTab === 'subcontractors' ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none'
            }}
          >
            <Layers size={16} />
            عقود مقاولي الباطن
          </button>
        </div>

        {/* زر فتح مودال التقرير التنفيذي الشامل للطباعة */}
        <button
          onClick={() => setIsPrintDossierOpen(true)}
          style={{
            padding: '0.625rem 1.25rem',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 900,
            fontSize: 'var(--fs-sm)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            boxShadow: '0 4px 15px rgba(15, 23, 42, 0.25)'
          }}
        >
          <Printer size={16} />
          طباعة التقرير الهندسي والتنفيذي الشامل
        </button>
      </div>

      {/* =====================================================================
          القسم الأول: جدول دفعات العميل المتوقعة والمحصلة (Milestones)
          ===================================================================== */}
      {subTab === 'milestones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* كروت الـ KPIs الخاصة بالدفعات */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))',
            gap: '1rem'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1.25rem',
              boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
              border: '1px solid #f1f5f9'
            }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                قيمة عقد المشروع
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: THEME.primary }}>
                {formatCurrency(paymentStats.contractVal)}
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>
                تغطية الجدولة: {paymentStats.contractCoverageRate}%
              </span>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1.25rem',
              boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
              border: '1px solid #f1f5f9'
            }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                إجمالي الدفعات المجدولة
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#334155' }}>
                {formatCurrency(paymentStats.totalScheduled)}
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                عدد الدفعات: {paymentStats.count} دفعة
              </span>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1.25rem',
              boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
              border: '1px solid #dcfce7'
            }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#166534', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                إجمالي المحصل فعلياً (سندات قبض)
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#16a34a' }}>
                {formatCurrency(paymentStats.totalReceived)}
              </div>
              <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 700 }}>
                نسبة التحصيل: {paymentStats.collectionRate}% ({paymentStats.paidCount} محصلة)
              </span>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1.25rem',
              boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
              border: '1px solid #fee2e2'
            }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#991b1b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                المتبقي للتحصيل
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#dc2626' }}>
                {formatCurrency(paymentStats.totalRemaining)}
              </div>
              <span style={{ fontSize: '11px', color: paymentStats.overdueCount > 0 ? '#b91c1c' : '#64748b', fontWeight: 700 }}>
                {paymentStats.overdueCount > 0 ? `⚠️ يوجد ${paymentStats.overdueCount} دفعات متأخرة` : 'لا توجد دفعات متأخرة'}
              </span>
            </div>
          </div>

          {/* شريط الإجراءات والتحكم بالدفعات */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            padding: '1rem',
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #f1f5f9'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: 900, color: '#0f172a' }}>
                سجل مواعيد دفعات العميل وسندات القبض المرتبطة
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--fs-xs)', color: '#64748b' }}>
                جدول الدفعات التعاقدية موضحاً تاريخ الاستحقاق، المبلغ المتوقع، ورقم سند القبض المحرر في السيستم.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {milestones.length === 0 && (
                <button
                  onClick={logic.autoGenerateMilestones}
                  style={{
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '10px',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: 'var(--fs-xs)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
                  }}
                >
                  <Sparkles size={14} />
                  توليد مقترح دفعات ذكي تلقائي
                </button>
              )}

              <button
                onClick={() => {
                  setEditingMilestone({
                    milestone_number: milestones.length + 1,
                    title: '',
                    due_date: new Date().toISOString().split('T')[0],
                    expected_amount: '',
                    received_amount: 0,
                    receipt_voucher_id: '',
                    receipt_number: '',
                    receipt_date: '',
                    status: 'مستحقة',
                    notes: ''
                  });
                  setIsMilestoneModalOpen(true);
                }}
                style={{
                  backgroundColor: THEME.primary,
                  color: 'white',
                  padding: '0.5rem 1.125rem',
                  borderRadius: '10px',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: 'var(--fs-xs)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
                }}
              >
                <Plus size={15} />
                إضافة دفعة مجدولة
              </button>
            </div>
          </div>

          {/* جدول الدفعات */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid #f1f5f9',
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.03)'
          }}>
            {milestones.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                <DollarSign size={48} style={{ color: '#cbd5e1', margin: '0 auto 0.75rem auto' }} />
                <h4 style={{ margin: 0, color: '#475569', fontWeight: 800 }}>لا توجد دفعات مجدولة حتى الآن</h4>
                <p style={{ margin: '0.5rem 0 1.25rem 0', color: '#94a3b8', fontSize: 'var(--fs-sm)' }}>
                  يمكنك إضافة دفعة جديدة يدوياً أو النقر على "توليد مقترح دفعات ذكي تلقائي" لتوزيعها بنسب هندسية قياسية.
                </p>
                <button
                  onClick={logic.autoGenerateMilestones}
                  style={{
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    padding: '0.625rem 1.25rem',
                    borderRadius: '10px',
                    border: 'none',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  <Sparkles size={15} style={{ display: 'inline', marginLeft: '6px' }} />
                  توليد جدول الدفعات الآن
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: 'var(--fs-sm)' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 900 }}>
                      <th style={{ padding: '0.875rem 1rem' }}>#</th>
                      <th style={{ padding: '0.875rem 1rem' }}>بيان الدفعة ومرحلة الصرف</th>
                      <th style={{ padding: '0.875rem 1rem' }}>تاريخ الاستحقاق</th>
                      <th style={{ padding: '0.875rem 1rem' }}>القيمة المتوقعة</th>
                      <th style={{ padding: '0.875rem 1rem' }}>سند القبض المرتبط</th>
                      <th style={{ padding: '0.875rem 1rem' }}>تاريخ السند</th>
                      <th style={{ padding: '0.875rem 1rem' }}>المحصل فعلياً</th>
                      <th style={{ padding: '0.875rem 1rem' }}>المتبقي</th>
                      <th style={{ padding: '0.875rem 1rem' }}>حالة الدفعة</th>
                      <th style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {milestones.map((m: any, idx: number) => {
                      const expected = Number(m.expected_amount) || 0;
                      const received = Number(m.received_amount) || 0;
                      const remaining = Math.max(0, expected - received);
                      const isOverdue = m.due_date && m.due_date < new Date().toISOString().split('T')[0] && m.status !== 'محصلة بالكامل';

                      return (
                        <tr
                          key={m.id || idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '0.875rem 1rem', fontWeight: 900, color: '#64748b' }}>
                            {m.milestone_number || idx + 1}
                          </td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>{m.title}</div>
                            {m.notes && (
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{m.notes}</div>
                            )}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', direction: 'ltr', textAlign: 'right' }}>
                            <span style={{
                              fontWeight: 700,
                              color: isOverdue ? '#dc2626' : '#334155',
                              backgroundColor: isOverdue ? '#fee2e2' : 'transparent',
                              padding: isOverdue ? '2px 6px' : '0',
                              borderRadius: '4px'
                            }}>
                              {formatDate(m.due_date)}
                            </span>
                          </td>
                          <td style={{ padding: '0.875rem 1rem', fontWeight: 900, color: '#0f172a' }}>
                            {formatCurrency(expected)}
                          </td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            {m.receipt_number ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: '#ecfdf5',
                                color: '#047857',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: 800,
                                fontSize: '12px'
                              }}>
                                <Link2 size={12} />
                                {m.receipt_number}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '12px' }}>لم يربط سند</span>
                            )}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', direction: 'ltr', textAlign: 'right', color: '#64748b' }}>
                            {formatDate(m.receipt_date)}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', fontWeight: 900, color: '#16a34a' }}>
                            {formatCurrency(received)}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', fontWeight: 900, color: remaining > 0 ? '#dc2626' : '#64748b' }}>
                            {formatCurrency(remaining)}
                          </td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 9px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 800,
                              backgroundColor: 
                                m.status === 'محصلة بالكامل' ? '#dcfce7' :
                                m.status === 'محصلة جزئياً' ? '#fef3c7' :
                                isOverdue ? '#fee2e2' : '#f1f5f9',
                              color: 
                                m.status === 'محصلة بالكامل' ? '#15803d' :
                                m.status === 'محصلة جزئياً' ? '#b45309' :
                                isOverdue ? '#b91c1c' : '#475569'
                            }}>
                              {isOverdue && m.status !== 'محصلة بالكامل' ? 'متأخرة عن الموعد' : (m.status || 'مستحقة')}
                            </span>
                          </td>
                          <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => {
                                  setEditingMilestone({ ...m });
                                  setIsMilestoneModalOpen(true);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: THEME.primary,
                                  padding: '4px'
                                }}
                                title="تعديل أو ربط سند القبض"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`هل أنت متأكد من حذف الدفعة "${m.title}"؟`)) {
                                    logic.deleteMilestone(m.id);
                                  }
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#dc2626',
                                  padding: '4px'
                                }}
                                title="حذف الدفعة"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          القسم الثاني: الجدول الزمني التنفيذي ومخطط جانت (Timeline & Gantt)
          ===================================================================== */}
      {subTab === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* كروت KPIs الجدول الزمني */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))',
            gap: '1rem'
          }}>
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                تاريخ بداية التنفيذ المخطط
              </span>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: THEME.primary, direction: 'ltr', textAlign: 'right' }}>
                {formatDate(scheduleData.minStart || project.start_date || '')}
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>مسحوب من أول بند بالميزانية</span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                تاريخ الاستلام والتسليم المستهدف
              </span>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#334155', direction: 'ltr', textAlign: 'right' }}>
                {formatDate(scheduleData.maxEnd || project.end_date || '')}
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>مسحوب من آخر بند بالميزانية</span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                إجمالي مدة المشروع والأيام المنقضية
              </span>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#0f172a' }}>
                {scheduleData.elapsedDays} / {scheduleData.totalDays} يوم
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                متبقي {Math.max(0, scheduleData.totalDays - scheduleData.elapsedDays)} يوم عمل
              </span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                نسبة انقضاء الوقت الزمني
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: scheduleData.timeProgress > 90 ? '#dc2626' : '#2563eb' }}>
                {scheduleData.timeProgress}%
              </div>
              <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '999px', marginTop: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${scheduleData.timeProgress}%`, height: '100%', background: scheduleData.timeProgress > 90 ? '#dc2626' : '#2563eb', borderRadius: '999px' }} />
              </div>
            </div>
          </div>

          {/* مخطط جانت التفاعلي Gantt Chart */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid #f1f5f9',
            boxShadow: '0 4px 20px -2px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: 900, color: '#0f172a' }}>
                  مخطط جانت الزمني لمراحل التنفيذ (Visual Gantt Chart)
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--fs-xs)', color: '#64748b' }}>
                  مسحوب ديناميكياً من تاريخ البداية والنهاية المحدد لكل بند بمقايسة المشروع.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '11px', fontWeight: 800 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10b981' }} /> مكتمل
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f59e0b' }} /> جاري التنفيذ
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#6366f1' }} /> قادم
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ef4444' }} /> مؤشر اليوم
                </span>
              </div>
            </div>

            {scheduleData.items.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                <Calendar size={48} style={{ color: '#cbd5e1', margin: '0 auto 0.75rem auto' }} />
                <h4 style={{ margin: 0, color: '#475569', fontWeight: 800 }}>لم يتم تحديد تواريخ تنفيذ لبنود المقايسة</h4>
                <p style={{ margin: '0.5rem 0 0 0', color: '#94a3b8', fontSize: 'var(--fs-sm)' }}>
                  يرجى الدخول على تاب "المقايسات والجدول الزمني" وتعديل البنود لتحديد تاريخ البداية والنهاية لكل بند.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                
                {/* شريط المدى الزمني العلوي */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  borderBottom: '2px solid #e2e8f0',
                  fontSize: '11px',
                  fontWeight: 900,
                  color: '#64748b',
                  direction: 'ltr'
                }}>
                  <span>{formatDate(scheduleData.minStart || '')}</span>
                  <span>خط الزمان التنفيذي للمشروع ({scheduleData.totalDays} يوم)</span>
                  <span>{formatDate(scheduleData.maxEnd || '')}</span>
                </div>

                {/* صفوف جانت لكل بند */}
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  
                  {/* خط اليوم الرأسي */}
                  {typeof scheduleData.todayLeftPct === 'number' && scheduleData.todayLeftPct >= 0 && scheduleData.todayLeftPct <= 100 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${scheduleData.todayLeftPct}%`,
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        backgroundColor: '#ef4444',
                        zIndex: 10,
                        boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
                      }}
                      title="اليوم الحالي"
                    />
                  )}

                  {scheduleData.items.map((item: any, i: number) => (
                    <div key={item.id || i} style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>{item.work_item}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', direction: 'ltr', textAlign: 'right' }}>
                          {formatDate(item.start_date)} ➔ {formatDate(item.end_date)} ({item.durationDays} يوم)
                        </div>
                      </div>

                      {/* شريط جانت التفاعلي */}
                      <div style={{
                        position: 'relative',
                        height: '28px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid #f1f5f9'
                      }}>
                        <div
                          style={{
                            position: 'absolute',
                            left: `${item.leftPct}%`,
                            width: `${item.widthPct}%`,
                            top: '3px',
                            bottom: '3px',
                            background: item.barBg,
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: 800,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            whiteSpace: 'nowrap',
                            padding: '0 6px',
                            transition: 'all 0.3s ease'
                          }}
                          title={`${item.work_item} - من ${formatDate(item.start_date)} إلى ${formatDate(item.end_date)} (${item.durationDays} يوم)`}
                        >
                          {item.durationDays >= 5 ? `${item.durationDays} يوم` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* جدول تفاصيل الجدول الزمني */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid #f1f5f9'
          }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', fontWeight: 900, color: '#0f172a' }}>
              تفاصيل بنود الجدول الزمني والمدد المحددة
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: 'var(--fs-sm)' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 900 }}>
                    <th style={{ padding: '0.875rem 1rem' }}>#</th>
                    <th style={{ padding: '0.875rem 1rem' }}>البند الإنشائي / المرحلة</th>
                    <th style={{ padding: '0.875rem 1rem' }}>التصنيف</th>
                    <th style={{ padding: '0.875rem 1rem' }}>تاريخ البداية</th>
                    <th style={{ padding: '0.875rem 1rem' }}>تاريخ النهاية</th>
                    <th style={{ padding: '0.875rem 1rem' }}>المدة بالأيام</th>
                    <th style={{ padding: '0.875rem 1rem' }}>حالة التنفيذ</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.items.map((item: any, idx: number) => (
                    <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 900, color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 800, color: '#0f172a' }}>{item.work_item}</td>
                      <td style={{ padding: '0.875rem 1rem', color: '#64748b' }}>{item.main_category || 'عام'}</td>
                      <td style={{ padding: '0.875rem 1rem', direction: 'ltr', textAlign: 'right' }}>{formatDate(item.start_date)}</td>
                      <td style={{ padding: '0.875rem 1rem', direction: 'ltr', textAlign: 'right' }}>{formatDate(item.end_date)}</td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 900, color: '#0f172a' }}>{item.durationDays} يوم</td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 800,
                          backgroundColor: item.statusColor === '#059669' ? '#dcfce7' : item.statusColor === '#d97706' ? '#fef3c7' : '#e0e7ff',
                          color: item.statusColor
                        }}>
                          {item.statusText}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          القسم الثالث: سجل الزيارات الميدانية والإشراف الهندسي (Site Visits)
          ===================================================================== */}
      {subTab === 'visits' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* كروت KPIs للزيارات الميدانية */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))',
            gap: '1rem'
          }}>
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                إجمالي الزيارات الميدانية المسجلة
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: THEME.primary }}>
                {visitStats.total} زيارة
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>سجل ضبط الجودة والإشراف</span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #dcfce7' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#166534', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                زيارات معتمدة ومطابقة للكود
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#16a34a' }}>
                {visitStats.approved}
              </div>
              <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 700 }}>تم الاستلام بدون ملاحظات</span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #fef3c7' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#92400e', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                معتمدة بملاحظات جاري تلافيها
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#d97706' }}>
                {visitStats.withNotes}
              </div>
              <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 700 }}>مطلوب معالجة الملاحظات</span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #fee2e2' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#991b1b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                غير مطابقة / مرفوضة
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#dc2626' }}>
                {visitStats.rejected}
              </div>
              <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 700 }}>إعادة الفحص مطلوبة</span>
            </div>
          </div>

          {/* شريط الإجراءات */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            padding: '1rem',
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #f1f5f9'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: 900, color: '#0f172a' }}>
                سجل محاضر المعاينات والزيارات الميدانية للموقع
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--fs-xs)', color: '#64748b' }}>
                توثيق الزيارات الهندسية، استلام حدادة ونجارة العناصر الإنشائية، وملاحظات الاستشاري مع الصور التوثيقية.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingVisit({
                  title: '',
                  stage: '',
                  boq_item_name: '',
                  visit_date: new Date().toISOString().split('T')[0],
                  inspector_name: project.engineer_in_charge || 'م. الموقع المشرف',
                  status: 'معتمدة',
                  notes: '',
                  photo_before_url: '',
                  photo_after_url: ''
                });
                setIsVisitModalOpen(true);
              }}
              style={{
                backgroundColor: THEME.primary,
                color: 'white',
                padding: '0.5rem 1.125rem',
                borderRadius: '10px',
                border: 'none',
                fontWeight: 800,
                fontSize: 'var(--fs-xs)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
              }}
            >
              <Plus size={15} />
              تسجيل زيارة ومعاينة جديدة
            </button>
          </div>

          {/* كروت الزيارات الميدانية */}
          {siteVisits.length === 0 ? (
            <div style={{ background: 'white', borderRadius: '16px', padding: '3rem 1rem', textAlign: 'center', border: '1px solid #f1f5f9' }}>
              <HardHat size={48} style={{ color: '#cbd5e1', margin: '0 auto 0.75rem auto' }} />
              <h4 style={{ margin: 0, color: '#475569', fontWeight: 800 }}>لا توجد زيارات مسجلة لهذا المشروع بعد</h4>
              <p style={{ margin: '0.5rem 0 1.25rem 0', color: '#94a3b8', fontSize: 'var(--fs-sm)' }}>
                ابدأ بتسجيل زيارات المعاينة واستلام الأعمال الإنشائية لتوثيق الجودة وملاحظات المهندس المشرف.
              </p>
              <button
                onClick={() => {
                  setEditingVisit({
                    title: 'استلام حدادة وصب العناصر الإنشائية',
                    stage: 'الهيكل الخرساني',
                    boq_item_name: '',
                    visit_date: new Date().toISOString().split('T')[0],
                    inspector_name: project.engineer_in_charge || 'م. المشرف',
                    status: 'معتمدة',
                    notes: ''
                  });
                  setIsVisitModalOpen(true);
                }}
                style={{
                  backgroundColor: THEME.primary,
                  color: 'white',
                  padding: '0.625rem 1.25rem',
                  borderRadius: '10px',
                  border: 'none',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                تسجيل أول زيارة الآن
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(22rem, 1fr))', gap: '1rem' }}>
              {siteVisits.map((v: any, idx: number) => {
                const isSuccess = v.status === 'معتمدة' || v.status === 'مطابقة';
                const isWarning = v.status === 'معتمدة بملاحظات' || v.status === 'مفتوحة';

                return (
                  <div
                    key={v.id || idx}
                    style={{
                      background: 'white',
                      borderRadius: '16px',
                      padding: '1.25rem',
                      border: '1px solid #f1f5f9',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 'var(--fs-md)', color: '#0f172a' }}>{v.title}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                          <span>المرحلة: {v.stage || 'عام'}</span>
                          {v.boq_item_name && <span>• {v.boq_item_name}</span>}
                        </div>
                      </div>

                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 800,
                        backgroundColor: isSuccess ? '#dcfce7' : isWarning ? '#fef3c7' : '#fee2e2',
                        color: isSuccess ? '#15803d' : isWarning ? '#b45309' : '#b91c1c'
                      }}>
                        {v.status || 'معتمدة'}
                      </span>
                    </div>

                    <div style={{
                      backgroundColor: '#f8fafc',
                      padding: '0.75rem',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: '#334155',
                      lineHeight: 1.6
                    }}>
                      <strong>الملاحظات والتوجيهات: </strong>
                      {v.notes || 'تمت المعاينة والاستلام طبقاً للمواصفات والرسومات الهندسية المعتمدة.'}
                    </div>

                    {/* صور المعاينة إن وجدت */}
                    {(v.photo_before_url || v.photo_after_url) && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {v.photo_before_url && (
                          <div
                            onClick={() => setSelectedPhotoPreview(v.photo_before_url)}
                            style={{
                              cursor: 'pointer',
                              position: 'relative',
                              width: '80px',
                              height: '60px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              border: '1px solid #e2e8f0'
                            }}
                          >
                            <img src={v.photo_before_url} alt="قبل" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <span style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '9px', padding: '1px 3px', borderRadius: '3px' }}>قبل</span>
                          </div>
                        )}
                        {v.photo_after_url && (
                          <div
                            onClick={() => setSelectedPhotoPreview(v.photo_after_url)}
                            style={{
                              cursor: 'pointer',
                              position: 'relative',
                              width: '80px',
                              height: '60px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              border: '1px solid #e2e8f0'
                            }}
                          >
                            <img src={v.photo_after_url} alt="بعد" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <span style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '9px', padding: '1px 3px', borderRadius: '3px' }}>بعد</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: '0.75rem',
                      fontSize: '11px',
                      color: '#64748b'
                    }}>
                      <div>
                        المهندس: <strong style={{ color: '#0f172a' }}>{v.inspector_name || 'المهندس المشرف'}</strong>
                      </div>
                      <div style={{ direction: 'ltr', fontWeight: 700 }}>
                        {formatDate(v.visit_date)}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => {
                            setEditingVisit({ ...v });
                            setIsVisitModalOpen(true);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: THEME.primary }}
                          title="تعديل المحضر"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف محضر الزيارة "${v.title}"؟`)) {
                              logic.deleteSiteVisit(v.id);
                            }
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}
                          title="حذف المحضر"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          القسم الرابع: تحليل الانحراف والقيمة المكتسبة (EVM Report)
          ===================================================================== */}
      {subTab === 'evm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* كروت مؤشرات إدارة القيمة المكتسبة EVM */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))',
            gap: '1rem'
          }}>
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                الميزانية المخططة (Planned Value - PV)
              </span>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: THEME.primary }}>
                {formatCurrency(evmData.plannedValue)}
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>إجمالي تكاليف المقايسة المعتمدة</span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                التكلفة الفعلية الشاملة (Actual Cost - AC)
              </span>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: evmData.isCostOverrun ? '#dc2626' : '#059669' }}>
                {formatCurrency(evmData.actualCost)}
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>المصروفات المباشرة + توزيعات ABC</span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                القيمة المكتسبة (Earned Value - EV)
              </span>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#0f172a' }}>
                {formatCurrency(evmData.earnedValue)}
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>قيمة الإنجاز المحقق فعلياً</span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                مؤشر أداء التكلفة (CPI Index)
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: Number(evmData.cpi) >= 1 ? '#16a34a' : '#dc2626' }}>
                {evmData.cpi}
              </div>
              <span style={{ fontSize: '11px', color: Number(evmData.cpi) >= 1 ? '#15803d' : '#b91c1c', fontWeight: 700 }}>
                {Number(evmData.cpi) >= 1 ? '✅ كفاءة إنفاق ممتازة (تحت الميزانية)' : '⚠️ تجاوز تكاليف وانحراف سلبي'}
              </span>
            </div>
          </div>

          {/* جدول تحليل الانحراف لكل بند WBS */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid #f1f5f9'
          }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', fontWeight: 900, color: '#0f172a' }}>
              تحليل الانحراف المالي المباشر وتوزيعات ABC لكل بند
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: 'var(--fs-sm)' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 900 }}>
                    <th style={{ padding: '0.875rem 1rem' }}>البند الإنشائي</th>
                    <th style={{ padding: '0.875rem 1rem' }}>سعر التعاقد (البيع)</th>
                    <th style={{ padding: '0.875rem 1rem' }}>الميزانية التقديرية</th>
                    <th style={{ padding: '0.875rem 1rem' }}>الفعلي المباشر</th>
                    <th style={{ padding: '0.875rem 1rem' }}>الموزع (ABC)</th>
                    <th style={{ padding: '0.875rem 1rem' }}>إجمالي الفعلي</th>
                    <th style={{ padding: '0.875rem 1rem' }}>انحراف الميزانية</th>
                    <th style={{ padding: '0.875rem 1rem' }}>صافي ربح البند</th>
                  </tr>
                </thead>
                <tbody>
                  {evmData.leafItems.map((item: any, idx: number) => {
                    const budget = Number(item.estimated_labor_cost || 0) + Number(item.estimated_subcontractor_cost || 0) + Number(item.estimated_material_cost || 0) + Number(item.estimated_expenses_cost || 0);
                    const directActual = Number(item.actual_labor_cost || 0) + Number(item.actual_material_cost || 0) + Number(item.actual_expenses_cost || 0);
                    const abc = Number(item.allocated_expenses || 0);
                    const totalActual = directActual + abc;
                    const variance = budget - totalActual;
                    const netProfit = Number(item.item_net_profit || 0);

                    return (
                      <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.875rem 1rem', fontWeight: 800, color: '#0f172a' }}>{item.work_item}</td>
                        <td style={{ padding: '0.875rem 1rem', fontWeight: 900, color: '#334155' }}>{formatCurrency(item.total_contract_amount || 0)}</td>
                        <td style={{ padding: '0.875rem 1rem', color: '#64748b' }}>{formatCurrency(budget)}</td>
                        <td style={{ padding: '0.875rem 1rem', color: '#0369a1' }}>{formatCurrency(directActual)}</td>
                        <td style={{ padding: '0.875rem 1rem', color: '#9333ea', fontWeight: 700 }}>{formatCurrency(abc)}</td>
                        <td style={{ padding: '0.875rem 1rem', fontWeight: 900, color: '#0f172a' }}>{formatCurrency(totalActual)}</td>
                        <td style={{ padding: '0.875rem 1rem', fontWeight: 900, color: variance < 0 ? '#dc2626' : '#16a34a' }}>
                          {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', fontWeight: 900, color: netProfit < 0 ? '#dc2626' : '#16a34a' }}>
                          {netProfit > 0 ? '+' : ''}{formatCurrency(netProfit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          القسم الخامس: عقود مقاولي الباطن (Subcontractors Breakdown)
          ===================================================================== */}
      {subTab === 'subcontractors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))',
            gap: '1rem'
          }}>
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                مقاول حدادة (تسليح الهيكل)
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#0284c7' }}>
                {formatCurrency(subContractorStats.rebarTotal)}
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>الميزانية المعتمدة للحدادة</span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                مقاول صب خرسانة
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#d97706' }}>
                {formatCurrency(subContractorStats.concreteTotal)}
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>الميزانية المعتمدة للصب</span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                مقاول بنود ومصنعيات أخرى
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#8b5cf6' }}>
                {formatCurrency(subContractorStats.otherTotal)}
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>أعمال عزل ومباني ومساعدات</span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                إجمالي عقود مقاولي الباطن
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#0f172a' }}>
                {formatCurrency(subContractorStats.totalBudget)}
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                المصروف بمستخلصات: {formatCurrency(subContractorStats.totalPaid)}
              </span>
            </div>
          </div>

          {/* تفاصيل العقود في جدول المقايسة */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid #f1f5f9'
          }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', fontWeight: 900, color: '#0f172a' }}>
              تفصيل ميزانيات مقاولي الباطن الموزعة على بنود المشروع
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: 'var(--fs-sm)' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 900 }}>
                    <th style={{ padding: '0.875rem 1rem' }}>البند الإنشائي</th>
                    <th style={{ padding: '0.875rem 1rem' }}>مقاول حدادة</th>
                    <th style={{ padding: '0.875rem 1rem' }}>مقاول صب خرسانة</th>
                    <th style={{ padding: '0.875rem 1rem' }}>مقاول بنود أخرى</th>
                    <th style={{ padding: '0.875rem 1rem' }}>إجمالي مقاولي الباطن للبند</th>
                  </tr>
                </thead>
                <tbody>
                  {boqList.filter((b: any) => (Number(b.estimated_subcontractor_cost) > 0 || Number(b.subcontractor_rebar_cost) > 0 || Number(b.subcontractor_concrete_cost) > 0)).map((item: any, idx: number) => (
                    <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 800, color: '#0f172a' }}>{item.work_item}</td>
                      <td style={{ padding: '0.875rem 1rem', color: '#0284c7', fontWeight: 700 }}>{formatCurrency(item.subcontractor_rebar_cost || 0)}</td>
                      <td style={{ padding: '0.875rem 1rem', color: '#d97706', fontWeight: 700 }}>{formatCurrency(item.subcontractor_concrete_cost || 0)}</td>
                      <td style={{ padding: '0.875rem 1rem', color: '#8b5cf6', fontWeight: 700 }}>{formatCurrency(item.subcontractor_other_cost || 0)}</td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 900, color: '#0f172a' }}>{formatCurrency(item.estimated_subcontractor_cost || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          مودال إضافة / تعديل دفعة مجدولة للعميل (Milestone Modal)
          ===================================================================== */}
      {isMilestoneModalOpen && editingMilestone && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          direction: 'rtl'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            width: '90%',
            maxWidth: '35rem',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontWeight: 900, fontSize: 'var(--fs-lg)' }}>
                {editingMilestone.id ? 'تعديل دفعة مجدولة للعميل' : 'إضافة دفعة مجدولة جديدة'}
              </h3>
              <button
                onClick={() => setIsMilestoneModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              logic.saveMilestone(editingMilestone);
              setIsMilestoneModalOpen(false);
            }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>رقم الدفعة</label>
                  <input
                    type="number"
                    value={editingMilestone.milestone_number || 1}
                    onChange={(e) => setEditingMilestone({ ...editingMilestone, milestone_number: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 800, direction: 'ltr' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>بيان الدفعة ومرحلة الصرف</label>
                  <input
                    type="text"
                    value={editingMilestone.title || ''}
                    onChange={(e) => setEditingMilestone({ ...editingMilestone, title: e.target.value })}
                    placeholder="مثال: دفعة صب سقف الدور الأرضي"
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 800 }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>تاريخ الاستحقاق المتوقع</label>
                  <input
                    type="date"
                    value={editingMilestone.due_date || ''}
                    onChange={(e) => setEditingMilestone({ ...editingMilestone, due_date: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 800, direction: 'ltr' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>القيمة المتوقعة (ر.س)</label>
                  <input
                    type="number"
                    step="any"
                    value={editingMilestone.expected_amount || ''}
                    onChange={(e) => setEditingMilestone({ ...editingMilestone, expected_amount: e.target.value })}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 900, direction: 'ltr' }}
                    required
                  />
                </div>
              </div>

              {/* قسم ربط سند القبض */}
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: THEME.primary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Link2 size={14} />
                  ربط سند القبض المحرر بالسيستم
                </span>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                    اختيار سند قبض مسجل تلقائياً
                  </label>
                  <select
                    value={editingMilestone.receipt_voucher_id || ''}
                    onChange={(e) => {
                      const vId = e.target.value;
                      const found = receiptVouchers.find((r: any) => r.id === vId);
                      if (found) {
                        setEditingMilestone({
                          ...editingMilestone,
                          receipt_voucher_id: found.id,
                          receipt_number: found.receipt_number,
                          receipt_date: found.date,
                          received_amount: found.amount,
                          status: 'محصلة بالكامل'
                        });
                      } else {
                        setEditingMilestone({
                          ...editingMilestone,
                          receipt_voucher_id: '',
                          receipt_number: '',
                          receipt_date: '',
                          received_amount: 0,
                          status: 'مستحقة'
                        });
                      }
                    }}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 800, fontSize: 'var(--fs-xs)', background: 'white' }}
                  >
                    <option value="">-- اختيار من سندات القبض المتاحة --</option>
                    {receiptVouchers.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        سند #{r.receipt_number} - بتاريخ {formatDate(r.date)} - مبلغ {formatCurrency(r.amount)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>رقم السند</label>
                    <input
                      type="text"
                      value={editingMilestone.receipt_number || ''}
                      onChange={(e) => setEditingMilestone({ ...editingMilestone, receipt_number: e.target.value })}
                      placeholder="رقم السند"
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>تاريخ السند</label>
                    <input
                      type="date"
                      value={editingMilestone.receipt_date || ''}
                      onChange={(e) => setEditingMilestone({ ...editingMilestone, receipt_date: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', direction: 'ltr' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>المبلغ المحصل</label>
                    <input
                      type="number"
                      step="any"
                      value={editingMilestone.received_amount || ''}
                      onChange={(e) => setEditingMilestone({ ...editingMilestone, received_amount: e.target.value })}
                      placeholder="0.00"
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 800, direction: 'ltr' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>حالة الدفعة</label>
                  <select
                    value={editingMilestone.status || 'مستحقة'}
                    onChange={(e) => setEditingMilestone({ ...editingMilestone, status: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 800 }}
                  >
                    <option value="مستحقة">مستحقة (Pending)</option>
                    <option value="محصلة جزئياً">محصلة جزئياً (Partially Paid)</option>
                    <option value="محصلة بالكامل">محصلة بالكامل (Fully Paid)</option>
                    <option value="متأخرة">متأخرة عن موعدها (Overdue)</option>
                    <option value="ملغاة">ملغاة (Cancelled)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>ملاحظات إضافية</label>
                  <input
                    type="text"
                    value={editingMilestone.notes || ''}
                    onChange={(e) => setEditingMilestone({ ...editingMilestone, notes: e.target.value })}
                    placeholder="ملاحظات أو شروط الدفعة"
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="submit"
                  disabled={logic.isSavingMilestone}
                  style={{
                    flex: 1,
                    backgroundColor: THEME.primary,
                    color: 'white',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    border: 'none',
                    fontWeight: 900,
                    cursor: 'pointer'
                  }}
                >
                  {logic.isSavingMilestone ? 'جاري الحفظ...' : 'حفظ الدفعة'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsMilestoneModalOpen(false)}
                  style={{
                    flex: 1,
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    border: 'none',
                    fontWeight: 900,
                    cursor: 'pointer'
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          مودال تسجيل زيارة ومعاينة ميدانية (Site Visit Modal)
          ===================================================================== */}
      {isVisitModalOpen && editingVisit && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          direction: 'rtl'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            width: '90%',
            maxWidth: '35rem',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontWeight: 900, fontSize: 'var(--fs-lg)' }}>
                {editingVisit.id ? 'تعديل محضر الزيارة الميدانية' : 'تسجيل محضر معاينة وزيارة موقع'}
              </h3>
              <button
                onClick={() => setIsVisitModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              logic.saveSiteVisit(editingVisit);
              setIsVisitModalOpen(false);
            }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>عنوان المحضر أو موضوع المعاينة</label>
                <input
                  type="text"
                  value={editingVisit.title || ''}
                  onChange={(e) => setEditingVisit({ ...editingVisit, title: e.target.value })}
                  placeholder="مثال: استلام حدادة سقف البدروم قبل الصب"
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 800 }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>تاريخ الزيارة</label>
                  <input
                    type="date"
                    value={editingVisit.visit_date || ''}
                    onChange={(e) => setEditingVisit({ ...editingVisit, visit_date: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 800, direction: 'ltr' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>اسم المهندس المشرف / الاستشاري</label>
                  <input
                    type="text"
                    value={editingVisit.inspector_name || ''}
                    onChange={(e) => setEditingVisit({ ...editingVisit, inspector_name: e.target.value })}
                    placeholder="اسم المهندس"
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 800 }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>المرحلة الإنشائية</label>
                  <input
                    type="text"
                    value={editingVisit.stage || ''}
                    onChange={(e) => setEditingVisit({ ...editingVisit, stage: e.target.value })}
                    placeholder="مثال: الأعمال الإنشائية"
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>حالة الاعتماد الهندسية</label>
                  <select
                    value={editingVisit.status || 'معتمدة'}
                    onChange={(e) => setEditingVisit({ ...editingVisit, status: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 800 }}
                  >
                    <option value="معتمدة">معتمدة ومطابقة (Approved)</option>
                    <option value="معتمدة بملاحظات">معتمدة بملاحظات للتلافي (With Notes)</option>
                    <option value="غير مطابقة">غير مطابقة ومرفوضة (Rejected)</option>
                    <option value="قيد المراجعة">قيد المراجعة والتدقيق (Under Review)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                  ملاحظات الفحص والتقرير الفني
                </label>
                <textarea
                  rows={3}
                  value={editingVisit.notes || ''}
                  onChange={(e) => setEditingVisit({ ...editingVisit, notes: e.target.value })}
                  placeholder="سجل ملاحظات الاستلام، مطابقة أقطار الحديد، التباعد بين الكانات، نظافة الشدة الخشبية..."
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '10px', border: '1px solid #cbd5e1', lineHeight: 1.5 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--fs-xs)', color: '#64748b', marginBottom: '4px' }}>رابط صورة المعاينة (قبل)</label>
                  <input
                    type="url"
                    value={editingVisit.photo_before_url || ''}
                    onChange={(e) => setEditingVisit({ ...editingVisit, photo_before_url: e.target.value })}
                    placeholder="https://..."
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', direction: 'ltr' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--fs-xs)', color: '#64748b', marginBottom: '4px' }}>رابط صورة المعاينة (بعد)</label>
                  <input
                    type="url"
                    value={editingVisit.photo_after_url || ''}
                    onChange={(e) => setEditingVisit({ ...editingVisit, photo_after_url: e.target.value })}
                    placeholder="https://..."
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', direction: 'ltr' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="submit"
                  disabled={logic.isSavingSiteVisit}
                  style={{
                    flex: 1,
                    backgroundColor: THEME.primary,
                    color: 'white',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    border: 'none',
                    fontWeight: 900,
                    cursor: 'pointer'
                  }}
                >
                  {logic.isSavingSiteVisit ? 'جاري الحفظ...' : 'تسجيل الزيارة'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsVisitModalOpen(false)}
                  style={{
                    flex: 1,
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    border: 'none',
                    fontWeight: 900,
                    cursor: 'pointer'
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          مودال التقرير التنفيذي الشامل القابل للطباعة (Print Executive Dossier)
          ===================================================================== */}
      {isPrintDossierOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          direction: 'rtl'
        }}>
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              #printable-dossier, #printable-dossier * { visibility: visible !important; }
              #printable-dossier { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 15mm !important; background: white !important; }
              .dossier-no-print { display: none !important; }
              @page { size: A4 landscape; margin: 10mm; }
            }
          `}</style>

          <div style={{
            background: 'white',
            borderRadius: '20px',
            width: '95%',
            maxWidth: '75rem',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)'
          }}>
            {/* بار تحكم علوي يختفي بالطباعة */}
            <div className="dossier-no-print" style={{
              padding: '1rem 1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc'
            }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontWeight: 900 }}>معاينة التقرير الهندسي والتنفيذي الشامل</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>جاهز للطباعة على ورق A4 Landscape أو الحفظ كـ PDF رسمي</p>
              </div>

              <div style={{ display: 'flex', gap: '0.625rem' }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    backgroundColor: THEME.primary,
                    color: 'white',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Printer size={16} /> طباعة الآن
                </button>
                <button
                  onClick={() => setIsPrintDossierOpen(false)}
                  style={{
                    backgroundColor: '#e2e8f0',
                    color: '#475569',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  إغلاق
                </button>
              </div>
            </div>

            {/* محتوى الورقة الرسمية المطبوعة */}
            <div id="printable-dossier" style={{ padding: '2rem', overflowY: 'auto', color: '#1e293b' }}>
              
              {/* ترويسة التقرير Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `3px solid ${THEME.primary}`, paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h1 style={{ margin: 0, color: '#0f172a', fontWeight: 900, fontSize: '24px' }}>
                    التقرير التنفيذي الشامل للمشروع (Project Executive Dossier)
                  </h1>
                  <p style={{ margin: '4px 0 0 0', color: '#64748b', fontWeight: 800 }}>
                    تاريخ الإصدار: {new Date().toLocaleDateString('en-GB')}
                  </p>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <h2 style={{ margin: 0, color: THEME.primary, fontWeight: 900, fontSize: '18px' }}>إدارة المشروعات والرقابة المالية</h2>
                  <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '12px', fontWeight: 700 }}>نظام رواسي لإدارة المقاولات والمقايسات</p>
                </div>
              </div>

              {/* بيانات المشروع الأساسية */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                <div><strong style={{ color: '#64748b' }}>اسم المشروع:</strong> <span style={{ fontWeight: 900 }}>{project.Property}</span></div>
                <div><strong style={{ color: '#64748b' }}>العميل المالك:</strong> <span style={{ fontWeight: 900 }}>{project.client?.name || 'غير محدد'}</span></div>
                <div><strong style={{ color: '#64748b' }}>قيمة التعاقد:</strong> <span style={{ fontWeight: 900, color: THEME.primary }}>{formatCurrency(project.contract_value)}</span></div>
                <div><strong style={{ color: '#64748b' }}>المهندس المشرف:</strong> <span style={{ fontWeight: 900 }}>{project.engineer_in_charge || 'غير محدد'}</span></div>
              </div>

              {/* 1. ملخص جدول دفعات العميل وسندات القبض */}
              <h3 style={{ margin: '1rem 0 0.5rem 0', color: '#0f172a', fontWeight: 900, fontSize: '16px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px' }}>
                1. جدول دفعات العميل وسندات القبض المحررة
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '11px', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '6px' }}>#</th>
                    <th style={{ padding: '6px' }}>بيان الدفعة</th>
                    <th style={{ padding: '6px' }}>تاريخ الاستحقاق</th>
                    <th style={{ padding: '6px' }}>القيمة المتوقعة</th>
                    <th style={{ padding: '6px' }}>رقم سند القبض</th>
                    <th style={{ padding: '6px' }}>المحصل فعلياً</th>
                    <th style={{ padding: '6px' }}>المتبقي</th>
                    <th style={{ padding: '6px' }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((m: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px', fontWeight: 800 }}>{m.milestone_number || idx + 1}</td>
                      <td style={{ padding: '6px', fontWeight: 800 }}>{m.title}</td>
                      <td style={{ padding: '6px', direction: 'ltr', textAlign: 'right' }}>{formatDate(m.due_date)}</td>
                      <td style={{ padding: '6px', fontWeight: 800 }}>{formatCurrency(m.expected_amount)}</td>
                      <td style={{ padding: '6px' }}>{m.receipt_number || '---'}</td>
                      <td style={{ padding: '6px', fontWeight: 800, color: '#16a34a' }}>{formatCurrency(m.received_amount)}</td>
                      <td style={{ padding: '6px', fontWeight: 800 }}>{formatCurrency(Math.max(0, (Number(m.expected_amount) || 0) - (Number(m.received_amount) || 0)))}</td>
                      <td style={{ padding: '6px' }}>{m.status || 'مستحقة'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 2. ملخص الجدول الزمني ومراحل التنفيذ */}
              <h3 style={{ margin: '1rem 0 0.5rem 0', color: '#0f172a', fontWeight: 900, fontSize: '16px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px' }}>
                2. خطة الجدول الزمني التنفيذي ومراحل الإنجاز
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '11px', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '6px' }}>#</th>
                    <th style={{ padding: '6px' }}>البند والمرحلة</th>
                    <th style={{ padding: '6px' }}>تاريخ البداية</th>
                    <th style={{ padding: '6px' }}>تاريخ النهاية</th>
                    <th style={{ padding: '6px' }}>المدة بالأيام</th>
                    <th style={{ padding: '6px' }}>الحالة الزمنية</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.items.slice(0, 10).map((it: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px', fontWeight: 800 }}>{idx + 1}</td>
                      <td style={{ padding: '6px', fontWeight: 800 }}>{it.work_item}</td>
                      <td style={{ padding: '6px', direction: 'ltr', textAlign: 'right' }}>{formatDate(it.start_date)}</td>
                      <td style={{ padding: '6px', direction: 'ltr', textAlign: 'right' }}>{formatDate(it.end_date)}</td>
                      <td style={{ padding: '6px', fontWeight: 800 }}>{it.durationDays} يوم</td>
                      <td style={{ padding: '6px' }}>{it.statusText}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 3. ملخص الزيارات الميدانية وضبط الجودة */}
              <h3 style={{ margin: '1rem 0 0.5rem 0', color: '#0f172a', fontWeight: 900, fontSize: '16px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px' }}>
                3. ملخص محاضر الإشراف الهندسي والزيارات الميدانية
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem', fontSize: '11px', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '6px' }}>#</th>
                    <th style={{ padding: '6px' }}>عنوان المحضر</th>
                    <th style={{ padding: '6px' }}>المرحلة</th>
                    <th style={{ padding: '6px' }}>تاريخ المعاينة</th>
                    <th style={{ padding: '6px' }}>المهندس المشرف</th>
                    <th style={{ padding: '6px' }}>الحالة الهندسية</th>
                    <th style={{ padding: '6px' }}>الملاحظات والتوجيهات</th>
                  </tr>
                </thead>
                <tbody>
                  {siteVisits.map((v: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px', fontWeight: 800 }}>{idx + 1}</td>
                      <td style={{ padding: '6px', fontWeight: 800 }}>{v.title}</td>
                      <td style={{ padding: '6px' }}>{v.stage || 'عام'}</td>
                      <td style={{ padding: '6px', direction: 'ltr', textAlign: 'right' }}>{formatDate(v.visit_date)}</td>
                      <td style={{ padding: '6px' }}>{v.inspector_name}</td>
                      <td style={{ padding: '6px', fontWeight: 800 }}>{v.status}</td>
                      <td style={{ padding: '6px' }}>{v.notes || 'معتمد'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* صناديق التوقيع والاعتماد */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', textAlign: 'center', marginTop: '2.5rem' }}>
                <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.75rem' }}>
                  <div style={{ fontWeight: 900 }}>المهندس المشرف على الموقع</div>
                  <div style={{ marginTop: '2rem', color: '#94a3b8' }}>التوقيع: ..........................</div>
                </div>
                <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.75rem' }}>
                  <div style={{ fontWeight: 900 }}>مدير إدارة المشروعات</div>
                  <div style={{ marginTop: '2rem', color: '#94a3b8' }}>التوقيع: ..........................</div>
                </div>
                <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.75rem' }}>
                  <div style={{ fontWeight: 900 }}>المدير المالي والاعتماد</div>
                  <div style={{ marginTop: '2rem', color: '#94a3b8' }}>التوقيع: ..........................</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* مودال معاينة الصور الفردية Zoom */}
      {selectedPhotoPreview && (
        <div
          onClick={() => setSelectedPhotoPreview(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.85)',
            cursor: 'zoom-out'
          }}
        >
          <img
            src={selectedPhotoPreview}
            alt="معاينة مكبرة"
            style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
          />
        </div>
      )}

    </div>
  );
}
