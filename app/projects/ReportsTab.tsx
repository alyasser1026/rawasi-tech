"use client";
import { currencySymbol } from '@/lib/currency';
import React, { useState, useMemo } from 'react';
import { formatCurrency, formatDate } from '@/lib/helpers';
import { THEME } from '@/lib/theme';
import { 
  Calendar, DollarSign, CheckCircle2, Clock, AlertTriangle, 
  FileText, Plus, Trash2, Edit3, Printer, Sparkles, 
  Link2, ShieldAlert, TrendingUp, HardHat, Camera, 
  ChevronRight, ArrowUpRight, Check, X, Search, Layers,
  Building2, Sliders
} from 'lucide-react';
import SecureAction from '@/components/SecureAction';
import ReportContactFooter from '@/components/ReportContactFooter';
import { buildMilestoneSchedule, localToday, MILESTONE_STATUS_META } from '@/lib/milestoneSchedule';
import { buildProjectDailyReport } from '@/lib/projectDailyReport';
import { buildEvmAnalysis, EVM_STATUS_META } from '@/lib/evmAnalysis';
import DailyProjectReportSection from './DailyProjectReportSection';

interface ReportsTabProps {
  logic: any;
}

export default function ReportsTab({ logic }: ReportsTabProps) {
  const [subTab, setSubTab] = useState<'milestones' | 'daily' | 'timeline' | 'visits' | 'evm' | 'subcontractors'>('milestones');
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(() => localToday());
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<any>(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<any>(null);
  const [isPrintDossierOpen, setIsPrintDossierOpen] = useState(false);
  const [isPrintOptionsModalOpen, setIsPrintOptionsModalOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState({
    projectInfo: true,
    dailyReport: true,
    clientMilestones: true,
    scheduleTimeline: true,
    ganttChart: false,
    siteVisits: true,
    sitePhotos: true,
    costVarianceEVM: false,
    subcontractors: false,
    signatures: true
  });
  const [customReportTitle, setCustomReportTitle] = useState('التقرير التنفيذي الشامل للمشروع (Project Executive Dossier)');
  const [customReportNotes, setCustomReportNotes] = useState('');
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);
  const [isAutoGenerateModalOpen, setIsAutoGenerateModalOpen] = useState(false);
  const [excludeZeroAmount, setExcludeZeroAmount] = useState(true);

  const project = logic.selectedProject || {};
  const details = logic.projectDetails || {};
  const milestones: any[] = details.milestones || [];
  const siteVisits: any[] = details.siteVisits || [];
  const receiptVouchers: any[] = details.receiptVouchers || [];
  const boqList: any[] = details.boq || [];

  // بنود المقايسة المؤهلة لتوليد الدفعات مرتبة بتواريخ البداية
  const dailyReport = useMemo(
    () => buildProjectDailyReport(project, details, selectedDailyDate, localToday()),
    [project, details, selectedDailyDate]
  );

  const boqEligibleItems = useMemo(() => {
    return boqList
      .filter((b: any) => b.start_date && (b.item_type === 'فرعي' || !b.item_type))
      .sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  }, [boqList]);

  // =========================================================================
  // 1️⃣ إحصائيات وحسابات جدول دفعات العميل
  // =========================================================================
  // سندات القبض الخاصة بالمشروع فقط (مربوطة بالمشروع أو بعميل المشروع)
  const projectReceiptOptions = useMemo(() => {
    return receiptVouchers.filter((r: any) => {
      const ids: any[] = Array.isArray(r.project_ids) ? r.project_ids : [];
      if (project.id && ids.includes(project.id)) return true;
      return ids.length === 0 && project.client_id && r.partner_id === project.client_id;
    });
  }, [receiptVouchers, project.id, project.client_id]);

  const paymentSchedule = useMemo(
    () => buildMilestoneSchedule(milestones, details.projectReceipts || [], localToday()),
    [milestones, details.projectReceipts]
  );

  const paymentStats = useMemo(() => {
    const contractVal = Number(project.contract_value) || 0;
    const s = paymentSchedule;
    const totalScheduled = s.totalScheduled;
    const contractCoverageRate = contractVal > 0 ? ((totalScheduled / contractVal) * 100).toFixed(1) : '0.0';
    const unscheduledContract = Math.max(0, contractVal - totalScheduled);
    const overdueCount = s.counts.overdue + s.counts.overdue_partial;
    const collectingCount = s.counts.collecting + s.counts.partial;

    return {
      contractVal,
      totalScheduled,
      totalReceived: s.totalReceived,
      totalPaidOnSchedule: s.totalPaidOnSchedule,
      unallocatedAdvance: s.unallocatedAdvance,
      totalRemaining: s.totalRemaining,
      overdueAmount: s.overdueAmount,
      collectingAmount: s.collectingAmount,
      collectionRate: s.collectionRate.toFixed(1),
      contractCoverageRate,
      unscheduledContract,
      overdueCount,
      collectingCount,
      scheduledCount: s.counts.scheduled,
      paidCount: s.counts.paid,
      cancelledCount: s.counts.cancelled,
      nextDue: s.nextDue,
      count: milestones.length
    };
  }, [project, milestones.length, paymentSchedule]);

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
  const evmData = useMemo(
    () =>
      buildEvmAnalysis(boqList, {
        asOfDate: localToday(),
        project,
        laborLogs: details.laborStats?.logs || [],
      }),
    [boqList, project, details.laborStats?.logs]
  );

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
    const subClaims = (details.invoices || []).filter((inv: any) => inv.row_kind === 'sub_claim' || String(inv.display_type || '').includes('مقاول باطن'));
    const totalPaid = subClaims.reduce((sum: number, c: any) => sum + Number(c.final_amount || 0), 0);
    const remaining = Math.max(0, totalBudget - totalPaid);

    return {
      rebarTotal,
      concreteTotal,
      otherTotal,
      totalBudget: totalBudget || totalPaid,
      totalPaid,
      remaining,
      claimsCount: subClaims.length,
      subClaims
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
            onClick={() => setSubTab('daily')}
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
              backgroundColor: subTab === 'daily' ? THEME.primary : '#f8fafc',
              color: subTab === 'daily' ? 'white' : '#475569',
              boxShadow: subTab === 'daily' ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none'
            }}
          >
            <FileText size={16} />
            التقرير اليومي للمشروع
            <span style={{
              backgroundColor: subTab === 'daily' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
              padding: '2px 8px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 900
            }}>
              {dailyReport.activeDates.length} يوم
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

        {/* زر فتح مودال خيارات طباعة التقرير المجمع */}
        <button
          onClick={() => setIsPrintOptionsModalOpen(true)}
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
          خيارات وطباعة التقرير المجمع 🖨️
        </button>
      </div>

      {/* =====================================================================
          التقرير اليومي الشامل للمشروع
          ===================================================================== */}
      {subTab === 'daily' && (
        <DailyProjectReportSection
          report={dailyReport}
          selectedDate={selectedDailyDate}
          onDateChange={setSelectedDailyDate}
          onPrintDaily={() => {
            setPrintOptions((prev) => ({ ...prev, projectInfo: true, dailyReport: true }));
            setCustomReportTitle(`تقرير المشروع اليومي الشامل ليوم ${selectedDailyDate}`);
            setIsPrintDossierOpen(true);
          }}
        />
      )}

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
                نسبة التحصيل: {paymentStats.collectionRate}% ({paymentStats.paidCount} محصلة بالكامل)
                {paymentStats.unallocatedAdvance > 0 && ` • مقدم غير مخصص: ${formatCurrency(paymentStats.unallocatedAdvance)}`}
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
                {paymentStats.overdueCount > 0 ? `⚠️ ${paymentStats.overdueCount} دفعات متأخرة بقيمة ${formatCurrency(paymentStats.overdueAmount)}` : 'لا توجد دفعات متأخرة'}
              </span>
            </div>
          </div>

          {/* شريط توزيع حالات الدفعات + الدفعة القادمة */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.875rem 1rem',
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #f1f5f9'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {(['overdue', 'overdue_partial', 'collecting', 'partial', 'scheduled', 'paid', 'cancelled'] as const)
                .filter(k => paymentSchedule.counts[k] > 0)
                .map(k => {
                  const meta = MILESTONE_STATUS_META[k];
                  return (
                    <span key={k} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 800,
                      background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`
                    }}>
                      {meta.label}
                      <span style={{ background: 'white', borderRadius: '999px', padding: '0 7px', fontWeight: 900 }}>
                        {paymentSchedule.counts[k]}
                      </span>
                    </span>
                  );
                })}
              {paymentStats.collectingAmount > 0 && (
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', alignSelf: 'center' }}>
                  قيد التحصيل: {formatCurrency(paymentStats.collectingAmount)}
                </span>
              )}
              {paymentStats.unscheduledContract > 0 && paymentStats.count > 0 && (
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', alignSelf: 'center' }}>
                  ⚠️ جزء من العقد غير مجدول: {formatCurrency(paymentStats.unscheduledContract)}
                </span>
              )}
            </div>
            {paymentStats.nextDue && (
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                ⏭️ الدفعة القادمة: <span style={{ color: THEME.primary }}>#{paymentStats.nextDue.number} {paymentStats.nextDue.title}</span>
                {' — '}{formatCurrency(paymentStats.nextDue.remaining)}
                {' — '}<span style={{ direction: 'ltr', display: 'inline-block' }}>{paymentStats.nextDue.dueDate || '---'}</span>
                {' '}<span style={{ color: paymentStats.nextDue.status.color }}>({paymentStats.nextDue.daysLabel})</span>
              </div>
            )}
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
              <button
                onClick={() => setIsAutoGenerateModalOpen(true)}
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
                توليد الدفعات من الميزانية (قبل كل بند بأسبوع) 🪄
              </button>

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
                  onClick={() => setIsAutoGenerateModalOpen(true)}
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
                  توليد الدفعات من الميزانية الآن (قبل كل بند بأسبوع)
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: 'var(--fs-sm)' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 900 }}>
                      <th style={{ padding: '0.875rem 0.75rem' }}>#</th>
                      <th style={{ padding: '0.875rem 0.75rem' }}>بيان الدفعة ومرحلة الصرف</th>
                      <th style={{ padding: '0.875rem 0.75rem' }}>موعد الاستحقاق</th>
                      <th style={{ padding: '0.875rem 0.75rem' }}>قيمة الدفعة</th>
                      <th style={{ padding: '0.875rem 0.75rem' }}>المسدد</th>
                      <th style={{ padding: '0.875rem 0.75rem' }}>المتبقي</th>
                      <th style={{ padding: '0.875rem 0.75rem' }}>سندات القبض</th>
                      <th style={{ padding: '0.875rem 0.75rem' }}>حالة الدفعة</th>
                      <th style={{ padding: '0.875rem 0.75rem' }}>التأخير / المتبقي للموعد</th>
                      <th style={{ padding: '0.875rem 0.75rem', textAlign: 'center' }}>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentSchedule.rows.map((row, idx) => {
                      const m = row.milestone;
                      const isLate = row.status.key === 'overdue' || row.status.key === 'overdue_partial';
                      return (
                        <tr
                          key={m.id || idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: isLate ? '#fff7f7' : (idx % 2 === 0 ? 'white' : '#fafafa'),
                            opacity: row.status.key === 'cancelled' ? 0.6 : 1
                          }}
                        >
                          <td style={{ padding: '0.75rem', fontWeight: 900, color: '#64748b' }}>{row.number}</td>
                          <td style={{ padding: '0.75rem', minWidth: '14rem' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>{row.title}</div>
                            {m.notes && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{m.notes}</div>}
                            <div style={{ marginTop: '6px', height: '5px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                              <div style={{ width: `${row.paidPct}%`, height: '100%', background: row.status.color }} />
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', direction: 'ltr', textAlign: 'right', fontWeight: 800, color: isLate ? '#dc2626' : '#334155', whiteSpace: 'nowrap' }}>
                            {row.dueDate || '---'}
                          </td>
                          <td style={{ padding: '0.75rem', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap' }}>{formatCurrency(row.expected)}</td>
                          <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 900, color: '#16a34a' }}>{formatCurrency(row.paid)}</div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>
                              {row.paidPct}%{row.autoPaid > 0 ? ' • مخصص تلقائياً من سندات المشروع' : ''}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', fontWeight: 900, color: row.remaining > 0 ? '#dc2626' : '#64748b', whiteSpace: 'nowrap' }}>
                            {formatCurrency(row.remaining)}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            {row.receiptRefs.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                {row.receiptRefs.map(ref => (
                                  <span key={ref} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '11px', width: 'fit-content' }}>
                                    <Link2 size={11} />{ref}
                                  </span>
                                ))}
                                {row.lastReceiptDate && <span style={{ fontSize: '10px', color: '#64748b', direction: 'ltr', textAlign: 'right' }}>{row.lastReceiptDate}</span>}
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '12px' }}>لا يوجد سند</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, backgroundColor: row.status.bg, color: row.status.color, border: `1px solid ${row.status.border}`, whiteSpace: 'nowrap' }}>
                              {row.status.label}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '12px', fontWeight: 800, color: isLate ? '#b91c1c' : row.status.key === 'collecting' ? '#1d4ed8' : '#64748b', whiteSpace: 'nowrap' }}>
                            {row.daysLabel}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => { setEditingMilestone({ ...m }); setIsMilestoneModalOpen(true); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: THEME.primary, padding: '4px' }}
                                title="تعديل أو ربط سند القبض"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                onClick={() => { if (confirm(`هل أنت متأكد من حذف الدفعة "${row.title}"؟`)) logic.deleteMilestone(m.id); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '4px' }}
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
                  <tfoot>
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: 900 }}>
                      <td colSpan={3} style={{ padding: '0.875rem 0.75rem', color: '#0f172a' }}>الإجمالي ({paymentStats.count} دفعة)</td>
                      <td style={{ padding: '0.875rem 0.75rem', color: '#0f172a', whiteSpace: 'nowrap' }}>{formatCurrency(paymentStats.totalScheduled)}</td>
                      <td style={{ padding: '0.875rem 0.75rem', color: '#16a34a', whiteSpace: 'nowrap' }}>{formatCurrency(paymentStats.totalPaidOnSchedule)}</td>
                      <td style={{ padding: '0.875rem 0.75rem', color: '#dc2626', whiteSpace: 'nowrap' }}>{formatCurrency(paymentStats.totalRemaining)}</td>
                      <td colSpan={4} style={{ padding: '0.875rem 0.75rem', color: '#64748b', fontSize: '12px' }}>
                        نسبة التحصيل {paymentStats.collectionRate}% • متأخر {formatCurrency(paymentStats.overdueAmount)}
                        {paymentStats.unallocatedAdvance > 0 ? ` • مقدم غير مخصص ${formatCurrency(paymentStats.unallocatedAdvance)}` : ''}
                      </td>
                    </tr>
                  </tfoot>
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
          
          {/* كروت مؤشرات إدارة القيمة المكتسبة EVM القياسية */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))',
            gap: '0.85rem'
          }}>
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.1rem', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                إجمالي الميزانية المعتمدة (BAC)
              </span>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#0f172a' }}>
                {formatCurrency(evmData.bac)}
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                مقابل التعاقد: {formatCurrency(evmData.totalContractAmount)}
              </span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.1rem', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                القيمة المخططة حتى اليوم (PV)
              </span>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: THEME.primary }}>
                {formatCurrency(evmData.plannedValue)}
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                المخطط زمنياً حتى {evmData.asOfDate} ({evmData.plannedProgressPct.toFixed(1)}%)
              </span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.1rem', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                القيمة المكتسبة (EV)
              </span>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#0369a1' }}>
                {formatCurrency(evmData.earnedValue)}
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                إنجاز مرجح: {evmData.progressPct.toFixed(1)}% من ميزانية التكلفة
              </span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.1rem', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                التكلفة الفعلية الشاملة (AC)
              </span>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: evmData.isCostOverrun ? '#dc2626' : '#059669' }}>
                {formatCurrency(evmData.actualCost)}
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                مباشر {formatCurrency(evmData.directActualCost)} + ABC {formatCurrency(evmData.allocatedAbcCost)}
              </span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.1rem', border: `1px solid ${evmData.actualCost === 0 ? '#e2e8f0' : (evmData.costVariance >= 0 ? '#bbf7d0' : '#fecaca')}` }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                انحراف التكلفة (CV) ومؤشر CPI
              </span>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: evmData.actualCost === 0 ? '#475569' : (evmData.costVariance >= 0 ? '#16a34a' : '#dc2626'), direction: 'ltr', textAlign: 'right' }}>
                {evmData.costVariance > 0 ? '+' : ''}{formatCurrency(evmData.costVariance)} <span style={{ fontSize: '0.8rem' }}>({evmData.cpiFormatted})</span>
              </div>
              <span style={{ fontSize: '11px', color: evmData.actualCost === 0 ? '#64748b' : (evmData.costVariance >= 0 ? '#15803d' : '#b91c1c'), fontWeight: 700 }}>
                {evmData.actualCost === 0
                  ? 'لم يبدأ الصرف الفعلي بعد'
                  : evmData.costVariance >= 0
                  ? '✅ كفاءة إنفاق ممتازة (EV ≥ AC)'
                  : '⚠️ تجاوز تكاليف عن القيمة المكتسبة (EV - AC)'}
              </span>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', padding: '1.1rem', border: `1px solid ${evmData.plannedValue === 0 && evmData.earnedValue === 0 ? '#e2e8f0' : (evmData.scheduleVariance >= 0 ? '#bbf7d0' : '#fde68a')}` }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: '0.25rem' }}>
                انحراف الجدول (SV) ومؤشر SPI
              </span>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: evmData.plannedValue === 0 && evmData.earnedValue === 0 ? '#475569' : (evmData.scheduleVariance >= 0 ? '#16a34a' : '#d97706'), direction: 'ltr', textAlign: 'right' }}>
                {evmData.scheduleVariance > 0 ? '+' : ''}{formatCurrency(evmData.scheduleVariance)} <span style={{ fontSize: '0.8rem' }}>({evmData.spiFormatted})</span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                {evmData.eac !== null
                  ? `التقدير عند الإتمام (EAC): ${formatCurrency(evmData.eac)}`
                  : `المتبقي بالميزانية: ${formatCurrency(evmData.remainingBudget)}`}
              </span>
            </div>
          </div>

          {(evmData.missingProgressCount > 0 || evmData.pricingDeficitCount > 0) && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '14px', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', color: '#92400e', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>
              {evmData.missingProgressCount > 0 && (
                <div>⚠️ يوجد {evmData.missingProgressCount} بند/بنود مسجل عليها صرف فعلي بدون كمية منفذة أو نسبة إنجاز في المقايسة، ما يجعل القيمة المكتسبة EV = 0 لحين تسجيل نسبة الإنجاز.</div>
              )}
              {evmData.pricingDeficitCount > 0 && (
                <div>🔎 يوجد {evmData.pricingDeficitCount} بند/بنود ميزانيتها التقديرية أعلى من سعر التعاقد (عجز تسعير قبل البدء).</div>
              )}
            </div>
          )}

          {/* ملخص يوميات العمالة الميدانية (الفنيين والمساعدين) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))',
            gap: '1rem'
          }}>
            <div style={{ background: '#f0f9ff', borderRadius: '16px', padding: '1rem 1.25rem', border: '1px solid #bae6fd' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#0369a1', fontWeight: 900, display: 'block', marginBottom: '0.2rem' }}>
                👷 عدد أيام يومية الفنيين (صنايعية)
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#0284c7' }}>
                {details.laborStats?.techDays || 0} يوم
              </div>
              <span style={{ fontSize: '11px', color: '#475569', fontWeight: 800 }}>
                إجمالي تكلفة الفنيين: {formatCurrency(details.laborStats?.techCost || 0)}
              </span>
            </div>

            <div style={{ background: '#f0fdfa', borderRadius: '16px', padding: '1rem 1.25rem', border: '1px solid #99f6e4' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#0f766e', fontWeight: 900, display: 'block', marginBottom: '0.2rem' }}>
                🤝 عدد أيام يومية المساعدين (عمال)
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#0d9488' }}>
                {details.laborStats?.helperDays || 0} يوم
              </div>
              <span style={{ fontSize: '11px', color: '#475569', fontWeight: 800 }}>
                إجمالي تكلفة المساعدين: {formatCurrency(details.laborStats?.helperCost || 0)}
              </span>
            </div>

            <div style={{ background: '#fff1f2', borderRadius: '16px', padding: '1rem 1.25rem', border: '1px solid #fecdd3' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: '#be123c', fontWeight: 900, display: 'block', marginBottom: '0.2rem' }}>
                إجمالي أيام وتكلفة العمالة الميدانية
              </span>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#e11d48' }}>
                {details.laborStats?.totalWorkersToDate || 0} يوم — {formatCurrency(details.laborStats?.totalLaborCost || 0)}
              </div>
              <span style={{ fontSize: '11px', color: '#881337', fontWeight: 700 }}>
                مسحوب لحظياً من سجل اليوميات الميدانية
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
            <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', fontWeight: 900, color: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span>تحليل الانحراف المالي المباشر والقيمة المكتسبة (EVM &amp; ABC) لكل بند</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                انحراف التكلفة CV = القيمة المكتسبة EV − إجمالي الفعلي AC (البنود التي لم تبدأ بعد = 0.00 محايد)
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: 'var(--fs-xs)' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 900 }}>
                    <th style={{ padding: '0.85rem 0.75rem' }}>البند الإنشائي</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>سعر التعاقد</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>الميزانية (BAC)</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>المخطط (PV)</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>المكتسبة (EV)</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>الفعلي المباشر</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>الموزع (ABC)</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>إجمالي الفعلي (AC)</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>انحراف التكلفة (CV)</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>المتبقي بالميزانية</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>صافي الربح</th>
                    <th style={{ padding: '0.85rem 0.75rem' }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {evmData.rows.map((row) => {
                    const meta = EVM_STATUS_META[row.status];
                    const cvColor = row.status === 'not_started'
                      ? '#64748b'
                      : (row.costVariance < 0 ? '#dc2626' : row.costVariance > 0 ? '#16a34a' : '#0369a1');
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 0.75rem', fontWeight: 800, color: '#0f172a' }}>
                          <div>{row.workItem}</div>
                          {row.startDate && (
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                              {row.startDate}{row.endDate ? ` ← ${row.endDate}` : ''}
                            </div>
                          )}
                          {row.isPricingDeficit && (
                            <span style={{ display: 'inline-block', marginTop: '2px', fontSize: '10px', background: '#fef2f2', color: '#b91c1c', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                              عجز تسعير: {formatCurrency(row.pricingMargin)}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', fontWeight: 900, color: '#334155' }}>{formatCurrency(row.contractAmount)}</td>
                        <td style={{ padding: '0.85rem 0.75rem', color: '#475569', fontWeight: 700 }}>{formatCurrency(row.budgetCost)}</td>
                        <td style={{ padding: '0.85rem 0.75rem', color: '#64748b', fontWeight: 700 }}>
                          {formatCurrency(row.plannedValueToDate)}
                          <div style={{ fontSize: '10px', color: '#94a3b8' }}>{row.scheduleProgressPct.toFixed(0)}%</div>
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', color: '#0369a1', fontWeight: 800 }}>
                          {formatCurrency(row.earnedValue)}
                          <div style={{ fontSize: '10px', color: '#0284c7' }}>{row.progressPct.toFixed(0)}% إنجاز</div>
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', color: '#0369a1' }}>{formatCurrency(row.directActual)}</td>
                        <td style={{ padding: '0.85rem 0.75rem', color: '#9333ea', fontWeight: 700 }}>{formatCurrency(row.allocatedAbc)}</td>
                        <td style={{ padding: '0.85rem 0.75rem', fontWeight: 900, color: '#0f172a' }}>{formatCurrency(row.totalActual)}</td>
                        <td style={{ padding: '0.85rem 0.75rem', fontWeight: 900, color: cvColor, direction: 'ltr', textAlign: 'right' }}>
                          {row.costVariance > 0 ? '+' : ''}{formatCurrency(row.costVariance)}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', fontWeight: 700, color: row.remainingBudget < 0 ? '#dc2626' : '#475569' }}>
                          {formatCurrency(row.remainingBudget)}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', fontWeight: 900, color: row.netProfit < 0 ? '#dc2626' : '#16a34a', direction: 'ltr', textAlign: 'right' }}>
                          {row.netProfit > 0 ? '+' : ''}{formatCurrency(row.netProfit)}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem' }}>
                          <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap' }}>
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 900, color: '#0f172a' }}>
                    <td style={{ padding: '0.85rem 0.75rem' }}>الإجمالي الكلي ({evmData.rows.length} بند)</td>
                    <td style={{ padding: '0.85rem 0.75rem' }}>{formatCurrency(evmData.totalContractAmount)}</td>
                    <td style={{ padding: '0.85rem 0.75rem' }}>{formatCurrency(evmData.bac)}</td>
                    <td style={{ padding: '0.85rem 0.75rem' }}>{formatCurrency(evmData.plannedValue)}</td>
                    <td style={{ padding: '0.85rem 0.75rem', color: '#0369a1' }}>{formatCurrency(evmData.earnedValue)}</td>
                    <td style={{ padding: '0.85rem 0.75rem', color: '#0369a1' }}>{formatCurrency(evmData.directActualCost)}</td>
                    <td style={{ padding: '0.85rem 0.75rem', color: '#9333ea' }}>{formatCurrency(evmData.allocatedAbcCost)}</td>
                    <td style={{ padding: '0.85rem 0.75rem' }}>{formatCurrency(evmData.actualCost)}</td>
                    <td style={{ padding: '0.85rem 0.75rem', color: evmData.actualCost === 0 ? '#475569' : (evmData.costVariance < 0 ? '#dc2626' : '#16a34a'), direction: 'ltr', textAlign: 'right' }}>
                      {evmData.costVariance > 0 ? '+' : ''}{formatCurrency(evmData.costVariance)}
                    </td>
                    <td style={{ padding: '0.85rem 0.75rem' }}>{formatCurrency(evmData.remainingBudget)}</td>
                    <td style={{ padding: '0.85rem 0.75rem', color: evmData.totalNetProfit < 0 ? '#dc2626' : '#16a34a', direction: 'ltr', textAlign: 'right' }}>
                      {evmData.totalNetProfit > 0 ? '+' : ''}{formatCurrency(evmData.totalNetProfit)}
                    </td>
                    <td style={{ padding: '0.85rem 0.75rem', fontSize: '10px', color: '#475569' }}>
                      CPI: {evmData.cpiFormatted}
                    </td>
                  </tr>
                </tfoot>
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
              
              {/* خيار اقتباس وتعبئة من بند بالمقايسة */}
              <div style={{ backgroundColor: '#eff6ff', padding: '0.75rem', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1e40af', marginBottom: '4px' }}>
                  🪄 اقتباس سريع من بند بالميزانية (يحسب التاريخ قبل البند بـ 7 أيام ويسحب مبلغ العميل):
                </label>
                <select
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const item = boqList.find((b: any) => b.id === selectedId);
                    if (item) {
                      let calcDate = '';
                      if (item.start_date) {
                        const d = new Date(item.start_date);
                        d.setDate(d.getDate() - 7);
                        calcDate = d.toISOString().split('T')[0];
                      }
                      const contractAmt = Number(item.total_contract_amount || (Number(item.contract_quantity || 1) * Number(item.unit_contract_price || 0)));
                      setEditingMilestone({
                        ...editingMilestone,
                        title: `دفعة بند: ${item.work_item}`,
                        due_date: calcDate || editingMilestone.due_date,
                        expected_amount: contractAmt || editingMilestone.expected_amount,
                        notes: item.start_date ? `مستحقة قبل أسبوع من بدء العمل (${item.start_date.split('T')[0]})` : ''
                      });
                    }
                  }}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #93c5fd', fontSize: '12px', background: 'white' }}
                >
                  <option value="">-- اضغط لاختيار بند من المقايسة لتعبئة التاريخ والمبلغ تلقائياً --</option>
                  {boqList.filter((b: any) => b.item_type === 'فرعي' || !b.item_type).map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.work_item} (بدء: {formatDate(b.start_date)} - مبلغ العميل: {formatCurrency(b.total_contract_amount || 0)})
                    </option>
                  ))}
                </select>
              </div>

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
                  <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>القيمة المتوقعة ({currencySymbol()})</label>
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
                          status: 'مستحقة'
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
                    <option value="">-- اختيار من سندات قبض المشروع --</option>
                    {projectReceiptOptions.map((r: any) => (
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
                    value={editingMilestone.status === 'ملغاة' ? 'ملغاة' : 'مستحقة'}
                    onChange={(e) => setEditingMilestone({ ...editingMilestone, status: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 800 }}
                  >
                    <option value="مستحقة">نشطة (الحالة تُحسب تلقائياً)</option>
                    <option value="ملغاة">ملغاة (Cancelled)</option>
                  </select>
                  <span style={{ display: 'block', fontSize: '10px', color: '#64748b', marginTop: '4px', fontWeight: 700 }}>
                    متأخرة / قيد التحصيل / محصلة جزئياً / محصلة بالكامل — تُحدد آلياً من الموعد والمسدد.
                  </span>
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
          مودال تخصيص واختيار محتويات التقرير المجمع للطباعة (Print Options Modal)
          ===================================================================== */}
      {isPrintOptionsModalOpen && (
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
          <div style={{
            background: 'white',
            borderRadius: '20px',
            width: '90%',
            maxWidth: '50rem',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
            maxHeight: '92vh',
            overflowY: 'auto'
          }}>
            {/* ترويسة المودال */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ padding: '8px', background: '#eff6ff', borderRadius: '10px', color: THEME.primary }}>
                  <Printer size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#0f172a', fontWeight: 900, fontSize: 'var(--fs-lg)' }}>
                    خيارات وتخصيص التقرير المجمع للطباعة
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    حدد التقارير والأقسام التي ترغب في طباعتها أو تصديرها كملف PDF رسمي
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPrintOptionsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* قوالب التحديد السريع */}
            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                ⚡ قوالب جاهزة سريعة للتحديد:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setPrintOptions({
                      projectInfo: true,
                      dailyReport: true,
                      clientMilestones: true,
                      scheduleTimeline: true,
                      ganttChart: false,
                      siteVisits: true,
                      sitePhotos: true,
                      costVarianceEVM: false,
                      subcontractors: false,
                      signatures: true
                    });
                    setCustomReportTitle('تقرير المتابعة التنفيذي لمالك المشروع');
                  }}
                  style={{
                    backgroundColor: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  🌟 تقرير المالك والعميل التنفيذي
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPrintOptions({
                      projectInfo: true,
                      dailyReport: true,
                      clientMilestones: false,
                      scheduleTimeline: true,
                      ganttChart: true,
                      siteVisits: true,
                      sitePhotos: true,
                      costVarianceEVM: false,
                      subcontractors: false,
                      signatures: true
                    });
                    setCustomReportTitle('تقرير الإشراف الهندسي والمتابعة الميدانية');
                  }}
                  style={{
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  🏗️ تقرير الموقع والإشراف الميداني
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPrintOptions({
                      projectInfo: true,
                      dailyReport: false,
                      clientMilestones: true,
                      scheduleTimeline: true,
                      ganttChart: false,
                      siteVisits: false,
                      sitePhotos: false,
                      costVarianceEVM: true,
                      subcontractors: true,
                      signatures: true
                    });
                    setCustomReportTitle('تقرير الرقابة المالية وإدارة التكاليف (EVM & ABC)');
                  }}
                  style={{
                    backgroundColor: '#faf5ff',
                    color: '#7e22ce',
                    border: '1px solid #e9d5ff',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  💰 تقرير الرقابة والتحليل المالي
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPrintOptions({
                      projectInfo: true,
                      dailyReport: true,
                      clientMilestones: true,
                      scheduleTimeline: true,
                      ganttChart: true,
                      siteVisits: true,
                      sitePhotos: true,
                      costVarianceEVM: true,
                      subcontractors: true,
                      signatures: true
                    });
                  }}
                  style={{
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  📑 تحديد جميع الأقسام
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPrintOptions({
                      projectInfo: false,
                      dailyReport: false,
                      clientMilestones: false,
                      scheduleTimeline: false,
                      ganttChart: false,
                      siteVisits: false,
                      sitePhotos: false,
                      costVarianceEVM: false,
                      subcontractors: false,
                      signatures: false
                    });
                  }}
                  style={{
                    backgroundColor: '#fff1f2',
                    color: '#be123c',
                    border: '1px solid #fecdd3',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  🔄 إلغاء التحديد
                </button>
              </div>
            </div>

            {/* شبكة خيارات الأقسام */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(21rem, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              
              {/* 0. التقرير اليومي للمشروع */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.875rem',
                borderRadius: '12px',
                border: `1px solid ${printOptions.dailyReport ? '#93c5fd' : '#e2e8f0'}`,
                background: printOptions.dailyReport ? '#eff6ff' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}>
                <input
                  type="checkbox"
                  checked={printOptions.dailyReport}
                  onChange={(e) => setPrintOptions({ ...printOptions, dailyReport: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={15} style={{ color: THEME.primary }} />
                    التقرير اليومي التفصيلي ليوم ({selectedDailyDate})
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    حركات اليوم: عمالة (فنيين ومساعدين)، مصروفات، سندات صرف وعُهد، خامات، وزيارات ميدانية.
                  </div>
                </div>
              </label>

              {/* 1. بيانات المشروع والـ KPIs */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.875rem',
                borderRadius: '12px',
                border: `1px solid ${printOptions.projectInfo ? '#93c5fd' : '#e2e8f0'}`,
                background: printOptions.projectInfo ? '#eff6ff' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}>
                <input
                  type="checkbox"
                  checked={printOptions.projectInfo}
                  onChange={(e) => setPrintOptions({ ...printOptions, projectInfo: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Building2 size={15} style={{ color: THEME.primary }} />
                    بيانات المشروع ومؤشرات الأداء العامة
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    اسم المشروع، العميل، المهندس، القيمة التعاقدية، وتلخيص الإنجاز والسيولة.
                  </div>
                </div>
              </label>

              {/* 2. جدول دفعات العميل وسندات القبض */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.875rem',
                borderRadius: '12px',
                border: `1px solid ${printOptions.clientMilestones ? '#86efac' : '#e2e8f0'}`,
                background: printOptions.clientMilestones ? '#f0fdf4' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}>
                <input
                  type="checkbox"
                  checked={printOptions.clientMilestones}
                  onChange={(e) => setPrintOptions({ ...printOptions, clientMilestones: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <DollarSign size={15} style={{ color: '#16a34a' }} />
                    جدول دفعات العميل وسندات القبض
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    مواعيد الاستحقاق، مبالغ الدفعات، وأرقام وتواريخ سندات القبض والمحصل والمتبقي.
                  </div>
                </div>
              </label>

              {/* 3. الجدول الزمني التنفيذي */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.875rem',
                borderRadius: '12px',
                border: `1px solid ${printOptions.scheduleTimeline ? '#93c5fd' : '#e2e8f0'}`,
                background: printOptions.scheduleTimeline ? '#eff6ff' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}>
                <input
                  type="checkbox"
                  checked={printOptions.scheduleTimeline}
                  onChange={(e) => setPrintOptions({ ...printOptions, scheduleTimeline: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={15} style={{ color: '#2563eb' }} />
                    الجدول الزمني التنفيذي ومراحل الإنجاز
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    تواريخ بداية ونهاية كل بند بالمقايسة والمدد الزمنية المحددة بالأيام.
                  </div>
                </div>
              </label>

              {/* 4. مخطط جانت الزمني البصري */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.875rem',
                borderRadius: '12px',
                border: `1px solid ${printOptions.ganttChart ? '#c4b5fd' : '#e2e8f0'}`,
                background: printOptions.ganttChart ? '#faf5ff' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}>
                <input
                  type="checkbox"
                  checked={printOptions.ganttChart}
                  onChange={(e) => setPrintOptions({ ...printOptions, ganttChart: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={15} style={{ color: '#7c3aed' }} />
                    مخطط جانت الزمني البصري (Gantt Chart)
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    رسم بياني زمني ملون لأشرطة البنود التنفيذية مع مؤشر تاريخ اليوم.
                  </div>
                </div>
              </label>

              {/* 5. سجل الزيارات الميدانية والإشراف */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.875rem',
                borderRadius: '12px',
                border: `1px solid ${printOptions.siteVisits ? '#fde68a' : '#e2e8f0'}`,
                background: printOptions.siteVisits ? '#fffbeb' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}>
                <input
                  type="checkbox"
                  checked={printOptions.siteVisits}
                  onChange={(e) => setPrintOptions({ ...printOptions, siteVisits: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <HardHat size={15} style={{ color: '#d97706' }} />
                    سجل محاضر الزيارات الميدانية والإشراف الهندسي
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    سجل توثيق الاستلامات الخرسانية، المهندس الفاحص، والملاحظات الفنية.
                  </div>
                </div>
              </label>

              {/* 6. صور الموقع والمعاينات */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.875rem',
                borderRadius: '12px',
                border: `1px solid ${printOptions.sitePhotos ? '#fbcfe8' : '#e2e8f0'}`,
                background: printOptions.sitePhotos ? '#fdf2f8' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}>
                <input
                  type="checkbox"
                  checked={printOptions.sitePhotos}
                  onChange={(e) => setPrintOptions({ ...printOptions, sitePhotos: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Camera size={15} style={{ color: '#db2777' }} />
                    معرض صور الموقع والمعاينات التوثيقية
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    صور المعاينة الميدانية (قبل وبعد) المرفقة بمحاضر الزيارات.
                  </div>
                </div>
              </label>

              {/* 7. تحليل الانحراف والقيمة المكتسبة EVM */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.875rem',
                borderRadius: '12px',
                border: `1px solid ${printOptions.costVarianceEVM ? '#93c5fd' : '#e2e8f0'}`,
                background: printOptions.costVarianceEVM ? '#eff6ff' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}>
                <input
                  type="checkbox"
                  checked={printOptions.costVarianceEVM}
                  onChange={(e) => setPrintOptions({ ...printOptions, costVarianceEVM: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={15} style={{ color: '#0284c7' }} />
                    تحليل الانحراف المالي والقيمة المكتسبة (EVM)
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    مقارنة الميزانية المعتمدة بالتكاليف الفعلية وتوزيعات ABC ومؤشر CPI.
                  </div>
                </div>
              </label>

              {/* 8. عقود مقاولي الباطن */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.875rem',
                borderRadius: '12px',
                border: `1px solid ${printOptions.subcontractors ? '#fed7aa' : '#e2e8f0'}`,
                background: printOptions.subcontractors ? '#fff7ed' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}>
                <input
                  type="checkbox"
                  checked={printOptions.subcontractors}
                  onChange={(e) => setPrintOptions({ ...printOptions, subcontractors: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Layers size={15} style={{ color: '#ea580c' }} />
                    عقود والتزامات مقاولي الباطن
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    تفصيل ميزانيات مقاولي الحدادة وصب الخرسانة وباقي المقاولين ومستخلصاتهم.
                  </div>
                </div>
              </label>

              {/* 9. صناديق التوقيع والاعتماد */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.875rem',
                borderRadius: '12px',
                border: `1px solid ${printOptions.signatures ? '#cbd5e1' : '#e2e8f0'}`,
                background: printOptions.signatures ? '#f8fafc' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}>
                <input
                  type="checkbox"
                  checked={printOptions.signatures}
                  onChange={(e) => setPrintOptions({ ...printOptions, signatures: e.target.checked })}
                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={15} style={{ color: '#475569' }} />
                    صناديق التوقيع والاعتماد الرسمي
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    خانات توقيع مهندس الموقع، مدير إدارة المشروعات، والمدير المالي.
                  </div>
                </div>
              </label>

            </div>

            {/* تخصيص العنوان والملاحظات */}
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                  عنوان التقرير المطبوع في الترويسة:
                </label>
                <input
                  type="text"
                  value={customReportTitle}
                  onChange={(e) => setCustomReportTitle(e.target.value)}
                  placeholder="مثال: التقرير التنفيذي الشامل للمشروع"
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 800, fontSize: '13px', background: 'white' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                  ملاحظات أو توجيهات إدارية ختامية (تظهر في تذييل التقرير - اختياري):
                </label>
                <textarea
                  rows={2}
                  value={customReportNotes}
                  onChange={(e) => setCustomReportNotes(e.target.value)}
                  placeholder="اكتب أي ملاحظات أو توصيات للمالك أو الإدارة الهندسية..."
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', background: 'white', lineHeight: 1.5 }}
                />
              </div>
            </div>

            {/* أزرار الإجراء */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  setIsPrintOptionsModalOpen(false);
                  setIsPrintDossierOpen(true);
                }}
                style={{
                  flex: 1,
                  backgroundColor: THEME.primary,
                  color: 'white',
                  padding: '0.875rem',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: 900,
                  fontSize: 'var(--fs-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)'
                }}
              >
                <Printer size={16} />
                معاينة وطباعة التقرير المخصص الآن 🚀
              </button>
              <button
                type="button"
                onClick={() => setIsPrintOptionsModalOpen(false)}
                style={{
                  flex: 1,
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  padding: '0.875rem',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: 900,
                  fontSize: 'var(--fs-sm)',
                  cursor: 'pointer'
                }}
              >
                إلغاء
              </button>
            </div>

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
                <h3 style={{ margin: 0, color: '#0f172a', fontWeight: 900 }}>معاينة التقرير المجمع للطباعة</h3>
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
                  onClick={() => {
                    setIsPrintDossierOpen(false);
                    setIsPrintOptionsModalOpen(true);
                  }}
                  style={{
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '8px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Sliders size={15} /> تعديل خيارات التقرير
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
                    {customReportTitle || 'التقرير التنفيذي الشامل للمشروع (Project Executive Dossier)'}
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

              {/* بيانات المشروع الأساسية والـ KPIs */}
              {printOptions.projectInfo && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', marginBottom: '0.75rem', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                    <div><strong style={{ color: '#64748b' }}>اسم المشروع:</strong> <span style={{ fontWeight: 900 }}>{project.Property}</span></div>
                    <div><strong style={{ color: '#64748b' }}>العميل المالك:</strong> <span style={{ fontWeight: 900 }}>{project.client?.name || 'غير محدد'}</span></div>
                    <div><strong style={{ color: '#64748b' }}>قيمة التعاقد:</strong> <span style={{ fontWeight: 900, color: THEME.primary }}>{formatCurrency(project.contract_value)}</span></div>
                    <div><strong style={{ color: '#64748b' }}>المهندس المشرف:</strong> <span style={{ fontWeight: 900 }}>{project.engineer_in_charge || 'غير محدد'}</span></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                    <div style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800 }}>المجدول من الدفعات</div>
                      <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>{formatCurrency(paymentStats.totalScheduled)}</div>
                    </div>
                    <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#166534', fontWeight: 800 }}>المحصل بسندات قبض</div>
                      <div style={{ fontSize: '14px', fontWeight: 900, color: '#15803d' }}>{formatCurrency(paymentStats.totalReceived)} ({paymentStats.collectionRate}%)</div>
                    </div>
                    <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#991b1b', fontWeight: 800 }}>المتبقي للتحصيل</div>
                      <div style={{ fontSize: '14px', fontWeight: 900, color: '#dc2626' }}>{formatCurrency(paymentStats.totalRemaining)}</div>
                    </div>
                    <div style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#1e40af', fontWeight: 800 }}>مدة المشروع والمنقضي</div>
                      <div style={{ fontSize: '14px', fontWeight: 900, color: '#2563eb' }}>{scheduleData.elapsedDays} / {scheduleData.totalDays} يوم ({scheduleData.timeProgress}%)</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '0.75rem' }}>
                    <div style={{ padding: '8px 12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#0369a1', fontWeight: 900 }}>👷 عدد أيام يومية الفنيين</div>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: '#0284c7' }}>
                        {details.laborStats?.techDays || 0} يوم — {formatCurrency(details.laborStats?.techCost || 0)}
                      </div>
                    </div>
                    <div style={{ padding: '8px 12px', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#0f766e', fontWeight: 900 }}>🤝 عدد أيام يومية المساعدين</div>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: '#0d9488' }}>
                        {details.laborStats?.helperDays || 0} يوم — {formatCurrency(details.laborStats?.helperCost || 0)}
                      </div>
                    </div>
                    <div style={{ padding: '8px 12px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#be123c', fontWeight: 900 }}>إجمالي أيام وأجور العمالة</div>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: '#e11d48' }}>
                        {details.laborStats?.totalWorkersToDate || 0} يوم — {formatCurrency(details.laborStats?.totalLaborCost || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 0. التقرير اليومي التفصيلي للمشروع */}
              {printOptions.dailyReport && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: '1rem 0 0.75rem 0', color: '#0f172a', fontWeight: 900, fontSize: '15px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={16} /> التقرير اليومي التفصيلي للمشروع ({selectedDailyDate})
                  </h3>
                  <DailyProjectReportSection
                    report={dailyReport}
                    selectedDate={selectedDailyDate}
                    onDateChange={setSelectedDailyDate}
                    printableOnly
                  />
                </div>
              )}

              {/* 1. جدول دفعات العميل وسندات القبض */}
              {printOptions.clientMilestones && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: '1rem 0 0.5rem 0', color: '#0f172a', fontWeight: 900, fontSize: '15px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <DollarSign size={16} /> جدول دفعات العميل وسندات القبض ومواعيد الاستحقاق
                  </h3>
                  {paymentSchedule.rows.length === 0 ? (
                    <div style={{ padding: '10px', fontSize: '11px', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '6px' }}>لا توجد دفعات مجدولة لهذا المشروع.</div>
                  ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '6px' }}>#</th>
                        <th style={{ padding: '6px' }}>بيان الدفعة</th>
                        <th style={{ padding: '6px' }}>موعد الاستحقاق</th>
                        <th style={{ padding: '6px' }}>قيمة الدفعة</th>
                        <th style={{ padding: '6px' }}>المسدد</th>
                        <th style={{ padding: '6px' }}>المتبقي</th>
                        <th style={{ padding: '6px' }}>سندات القبض</th>
                        <th style={{ padding: '6px' }}>الحالة</th>
                        <th style={{ padding: '6px' }}>التأخير / المهلة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentSchedule.rows.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px', fontWeight: 800 }}>{row.number}</td>
                          <td style={{ padding: '6px', fontWeight: 800 }}>{row.title}</td>
                          <td style={{ padding: '6px', direction: 'ltr', textAlign: 'right' }}>{row.dueDate || '---'}</td>
                          <td style={{ padding: '6px', fontWeight: 800 }}>{formatCurrency(row.expected)}</td>
                          <td style={{ padding: '6px', fontWeight: 800, color: '#16a34a' }}>{formatCurrency(row.paid)} ({row.paidPct}%)</td>
                          <td style={{ padding: '6px', fontWeight: 800, color: row.remaining > 0 ? '#dc2626' : '#64748b' }}>{formatCurrency(row.remaining)}</td>
                          <td style={{ padding: '6px' }}>{row.receiptRefs.join('، ') || '---'}</td>
                          <td style={{ padding: '6px' }}>
                            <span style={{ padding: '1px 6px', borderRadius: '999px', background: row.status.bg, color: row.status.color, fontWeight: 800, whiteSpace: 'nowrap' }}>{row.status.label}</span>
                          </td>
                          <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>{row.daysLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 900 }}>
                        <td colSpan={3} style={{ padding: '6px' }}>الإجمالي</td>
                        <td style={{ padding: '6px' }}>{formatCurrency(paymentStats.totalScheduled)}</td>
                        <td style={{ padding: '6px', color: '#16a34a' }}>{formatCurrency(paymentStats.totalPaidOnSchedule)}</td>
                        <td style={{ padding: '6px', color: '#dc2626' }}>{formatCurrency(paymentStats.totalRemaining)}</td>
                        <td colSpan={3} style={{ padding: '6px', color: '#475569' }}>
                          متأخر: {formatCurrency(paymentStats.overdueAmount)} • قيد التحصيل: {formatCurrency(paymentStats.collectingAmount)}
                          {paymentStats.unallocatedAdvance > 0 ? ` • مقدم غير مخصص: ${formatCurrency(paymentStats.unallocatedAdvance)}` : ''}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  )}
                </div>
              )}

              {/* 2. خطة الجدول الزمني التنفيذي */}
              {printOptions.scheduleTimeline && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: '1rem 0 0.5rem 0', color: '#0f172a', fontWeight: 900, fontSize: '15px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={16} /> خطة الجدول الزمني التنفيذي ومراحل الإنجاز
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '6px' }}>#</th>
                        <th style={{ padding: '6px' }}>البند الإنشائي / المرحلة</th>
                        <th style={{ padding: '6px' }}>التصنيف</th>
                        <th style={{ padding: '6px' }}>تاريخ البداية</th>
                        <th style={{ padding: '6px' }}>تاريخ النهاية</th>
                        <th style={{ padding: '6px' }}>المدة بالأيام</th>
                        <th style={{ padding: '6px' }}>الحالة الزمنية</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleData.items.map((it: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px', fontWeight: 800 }}>{idx + 1}</td>
                          <td style={{ padding: '6px', fontWeight: 800 }}>{it.work_item}</td>
                          <td style={{ padding: '6px', color: '#64748b' }}>{it.main_category || 'عام'}</td>
                          <td style={{ padding: '6px', direction: 'ltr', textAlign: 'right' }}>{formatDate(it.start_date)}</td>
                          <td style={{ padding: '6px', direction: 'ltr', textAlign: 'right' }}>{formatDate(it.end_date)}</td>
                          <td style={{ padding: '6px', fontWeight: 800 }}>{it.durationDays} يوم</td>
                          <td style={{ padding: '6px' }}>{it.statusText}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3. مخطط جانت الزمني البصري */}
              {printOptions.ganttChart && scheduleData.items.length > 0 && (
                <div style={{ marginBottom: '1.5rem', pageBreakInside: 'avoid' }}>
                  <h3 style={{ margin: '1rem 0 0.5rem 0', color: '#0f172a', fontWeight: 900, fontSize: '15px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TrendingUp size={16} /> مخطط جانت الزمني البصري لمراحل التنفيذ
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {scheduleData.items.map((it: any, idx: number) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '10px', alignItems: 'center', fontSize: '10px' }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 800 }}>{it.work_item}</div>
                        <div style={{ position: 'relative', height: '18px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', left: `${it.leftPct}%`, width: `${it.widthPct}%`, top: 0, bottom: 0, background: it.barBg, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '9px' }}>
                            {it.durationDays} يوم
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. سجل محاضر الإشراف الهندسي والزيارات */}
              {printOptions.siteVisits && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: '1rem 0 0.5rem 0', color: '#0f172a', fontWeight: 900, fontSize: '15px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HardHat size={16} /> سجل محاضر الإشراف الهندسي والزيارات الميدانية
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'right' }}>
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
                </div>
              )}

              {/* 5. معرض صور الموقع التوثيقية */}
              {printOptions.sitePhotos && siteVisits.some(v => v.photo_before_url || v.photo_after_url) && (
                <div style={{ marginBottom: '1.5rem', pageBreakInside: 'avoid' }}>
                  <h3 style={{ margin: '1rem 0 0.5rem 0', color: '#0f172a', fontWeight: 900, fontSize: '15px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Camera size={16} /> معرض صور الموقع والمعاينات التوثيقية
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                    {siteVisits.filter(v => v.photo_before_url || v.photo_after_url).map((v: any, idx: number) => (
                      <React.Fragment key={idx}>
                        {v.photo_before_url && (
                          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#f8fafc', padding: '6px' }}>
                            <img src={v.photo_before_url} alt="قبل" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                            <div style={{ fontSize: '10px', fontWeight: 800, marginTop: '4px', color: '#0f172a' }}>{v.title} (قبل)</div>
                            <div style={{ fontSize: '9px', color: '#64748b' }}>{formatDate(v.visit_date)}</div>
                          </div>
                        )}
                        {v.photo_after_url && (
                          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#f8fafc', padding: '6px' }}>
                            <img src={v.photo_after_url} alt="بعد" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                            <div style={{ fontSize: '10px', fontWeight: 800, marginTop: '4px', color: '#0f172a' }}>{v.title} (بعد)</div>
                            <div style={{ fontSize: '9px', color: '#64748b' }}>{formatDate(v.visit_date)}</div>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. تقرير تحليل الانحراف المالي والقيمة المكتسبة EVM */}
              {printOptions.costVarianceEVM && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: '1rem 0 0.5rem 0', color: '#0f172a', fontWeight: 900, fontSize: '15px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TrendingUp size={16} /> تحليل الانحراف المالي وإدارة القيمة المكتسبة (EVM Analysis)
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', marginBottom: '0.75rem', pageBreakInside: 'avoid' }}>
                    <div style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>الميزانية الكلية (BAC)</div>
                      <div style={{ fontSize: '12px', fontWeight: 900 }}>{formatCurrency(evmData.bac)}</div>
                    </div>
                    <div style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>المخطط حتى اليوم (PV)</div>
                      <div style={{ fontSize: '12px', fontWeight: 900, color: THEME.primary }}>{formatCurrency(evmData.plannedValue)}</div>
                    </div>
                    <div style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>القيمة المكتسبة (EV)</div>
                      <div style={{ fontSize: '12px', fontWeight: 900, color: '#0369a1' }}>{formatCurrency(evmData.earnedValue)}</div>
                    </div>
                    <div style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>التكلفة الفعلية (AC)</div>
                      <div style={{ fontSize: '12px', fontWeight: 900, color: evmData.isCostOverrun ? '#dc2626' : '#16a34a' }}>{formatCurrency(evmData.actualCost)}</div>
                    </div>
                    <div style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>انحراف التكلفة (CV)</div>
                      <div style={{ fontSize: '12px', fontWeight: 900, color: evmData.actualCost === 0 ? '#475569' : (evmData.costVariance >= 0 ? '#16a34a' : '#dc2626'), direction: 'ltr' }}>
                        {evmData.costVariance > 0 ? '+' : ''}{formatCurrency(evmData.costVariance)}
                      </div>
                    </div>
                    <div style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>مؤشر الأداء (CPI / SPI)</div>
                      <div style={{ fontSize: '12px', fontWeight: 900, color: evmData.cpi === null ? '#475569' : (evmData.cpi >= 1 ? '#16a34a' : '#dc2626') }}>
                        {evmData.cpiFormatted} / {evmData.spiFormatted}
                      </div>
                    </div>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '5px' }}>البند بالميزانية</th>
                        <th style={{ padding: '5px' }}>سعر البيع</th>
                        <th style={{ padding: '5px' }}>الميزانية (BAC)</th>
                        <th style={{ padding: '5px' }}>المخطط (PV)</th>
                        <th style={{ padding: '5px' }}>المكتسبة (EV)</th>
                        <th style={{ padding: '5px' }}>الفعلي (AC)</th>
                        <th style={{ padding: '5px' }}>انحراف التكلفة (CV)</th>
                        <th style={{ padding: '5px' }}>المتبقي بالميزانية</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evmData.rows.map((r) => {
                        const cvColor = r.status === 'not_started'
                          ? '#64748b'
                          : (r.costVariance < 0 ? '#dc2626' : r.costVariance > 0 ? '#16a34a' : '#0369a1');
                        const meta = EVM_STATUS_META[r.status];
                        return (
                          <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '5px', fontWeight: 800 }}>
                              <div>{r.workItem}</div>
                              <div style={{ fontSize: '8.5px', color: meta.color, fontWeight: 700 }}>
                                {meta.label}{r.isPricingDeficit ? ` | عجز تسعير ${formatCurrency(r.pricingMargin)}` : ''}
                              </div>
                            </td>
                            <td style={{ padding: '5px' }}>{formatCurrency(r.contractAmount)}</td>
                            <td style={{ padding: '5px' }}>{formatCurrency(r.budgetCost)}</td>
                            <td style={{ padding: '5px' }}>{formatCurrency(r.plannedValueToDate)}</td>
                            <td style={{ padding: '5px', color: '#0369a1', fontWeight: 700 }}>
                              {formatCurrency(r.earnedValue)} ({r.progressPct.toFixed(0)}%)
                            </td>
                            <td style={{ padding: '5px', fontWeight: 800 }}>
                              {formatCurrency(r.totalActual)}
                              {r.allocatedAbc > 0 && (
                                <div style={{ fontSize: '8px', color: '#7e22ce', fontWeight: 600 }}>
                                  مباشر {formatCurrency(r.directActual)} + ABC {formatCurrency(r.allocatedAbc)}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '5px', fontWeight: 800, color: cvColor, direction: 'ltr', textAlign: 'right' }}>
                              {r.costVariance > 0 ? '+' : ''}{formatCurrency(r.costVariance)}
                            </td>
                            <td style={{ padding: '5px', color: r.remainingBudget < 0 ? '#dc2626' : '#475569' }}>
                              {formatCurrency(r.remainingBudget)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 900 }}>
                        <td style={{ padding: '5px' }}>الإجمالي ({evmData.rows.length} بند)</td>
                        <td style={{ padding: '5px' }}>{formatCurrency(evmData.totalContractAmount)}</td>
                        <td style={{ padding: '5px' }}>{formatCurrency(evmData.bac)}</td>
                        <td style={{ padding: '5px' }}>{formatCurrency(evmData.plannedValue)}</td>
                        <td style={{ padding: '5px', color: '#0369a1' }}>{formatCurrency(evmData.earnedValue)}</td>
                        <td style={{ padding: '5px' }}>{formatCurrency(evmData.actualCost)}</td>
                        <td style={{ padding: '5px', color: evmData.actualCost === 0 ? '#475569' : (evmData.costVariance < 0 ? '#dc2626' : '#16a34a'), direction: 'ltr', textAlign: 'right' }}>
                          {evmData.costVariance > 0 ? '+' : ''}{formatCurrency(evmData.costVariance)}
                        </td>
                        <td style={{ padding: '5px' }}>{formatCurrency(evmData.remainingBudget)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* 7. عقود مقاولي الباطن */}
              {printOptions.subcontractors && (
                <div style={{ marginBottom: '1.5rem', pageBreakInside: 'avoid' }}>
                  <h3 style={{ margin: '1rem 0 0.5rem 0', color: '#0f172a', fontWeight: 900, fontSize: '15px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={16} /> عقود والتزامات مقاولي الباطن
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>مقاول حدادة</div>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: '#0284c7' }}>{formatCurrency(subContractorStats.rebarTotal)}</div>
                    </div>
                    <div style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>مقاول صب خرسانة</div>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: '#d97706' }}>{formatCurrency(subContractorStats.concreteTotal)}</div>
                    </div>
                    <div style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>مقاول بنود أخرى</div>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: '#8b5cf6' }}>{formatCurrency(subContractorStats.otherTotal)}</div>
                    </div>
                    <div style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>إجمالي مقاولي الباطن</div>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>{formatCurrency(subContractorStats.totalBudget)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ملاحظات وتوجيهات الإدارة */}
              {customReportNotes.trim() !== '' && (
                <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', pageBreakInside: 'avoid' }}>
                  <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px', fontSize: '12px' }}>ملاحظات وتوجيهات الإدارة الهندسية:</strong>
                  <p style={{ margin: 0, fontSize: '11px', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{customReportNotes}</p>
                </div>
              )}

              {/* صناديق التوقيع والاعتماد */}
              {printOptions.signatures && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', textAlign: 'center', marginTop: '2.5rem', pageBreakInside: 'avoid' }}>
                  <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.75rem' }}>
                    <div style={{ fontWeight: 900, fontSize: '13px' }}>المهندس المشرف على الموقع</div>
                    <div style={{ marginTop: '2rem', color: '#94a3b8', fontSize: '11px' }}>التوقيع: ..........................</div>
                  </div>
                  <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.75rem' }}>
                    <div style={{ fontWeight: 900, fontSize: '13px' }}>مدير إدارة المشروعات</div>
                    <div style={{ marginTop: '2rem', color: '#94a3b8', fontSize: '11px' }}>التوقيع: ..........................</div>
                  </div>
                  <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.75rem' }}>
                    <div style={{ fontWeight: 900, fontSize: '13px' }}>المدير المالي والاعتماد</div>
                    <div style={{ marginTop: '2rem', color: '#94a3b8', fontSize: '11px' }}>التوقيع: ..........................</div>
                  </div>
                </div>
              )}

              {/* 📱 فوتر جهات الاتصال الرسمية مع باركود vCard الذكي */}
              <ReportContactFooter style={{ marginTop: '2.5rem' }} />

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

      {/* =====================================================================
          مودال تأكيد وتوليد الدفعات من بنود الميزانية (قبل موعد كل بند بـ 7 أيام)
          ===================================================================== */}
      {isAutoGenerateModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(8px)',
          direction: 'rtl'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            width: '90%',
            maxWidth: '44rem',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ padding: '8px', background: '#fef3c7', borderRadius: '10px', color: '#d97706' }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#0f172a', fontWeight: 900, fontSize: 'var(--fs-lg)' }}>
                    توليد جدول دفعات العميل مسحوباً من الميزانية
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    تاريخ استحقاق الدفعة: قبل بداية العمل بالبند بـ 7 أيام | قيمة الدفعة: مبلغ العميل للبند
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAutoGenerateModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* تفاصيل الاحتساب الهندسي */}
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', fontSize: '13px', lineHeight: 1.6, color: '#334155' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                🏗️ آلية السحب والربط الزمني التلقائي:
              </div>
              <ul style={{ margin: 0, paddingRight: '1.25rem', color: '#475569' }}>
                <li>يتم فحص بنود الميزانية (`boq_budget`) والبحث عن تاريخ بداية العمل في كل بند (`start_date`).</li>
                <li>يتم جدولة تاريخ استحقاق الدفعة **قبل تاريخ بداية العمل في البند بـ 7 أيام** لتوفير السيولة اللازمة للتشوين والتجهيز.</li>
                <li>يتم تعيين قيمة الدفعة مساوية **لمبلغ العميل (إجمالي بيع البند)** (`total_contract_amount`).</li>
              </ul>
            </div>

            {/* ملخص البنود المكتشفة */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: '#eff6ff', padding: '0.875rem', borderRadius: '10px', textAlign: 'center', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 700 }}>بنود الميزانية المحددة</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#1d4ed8' }}>
                  {boqEligibleItems.filter(b => !excludeZeroAmount || Number(b.total_contract_amount || 0) > 0).length} بند
                </div>
              </div>
              <div style={{ background: '#f0fdf4', padding: '0.875rem', borderRadius: '10px', textAlign: 'center', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700 }}>إجمالي مبالغ الدفعات</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#15803d' }}>
                  {formatCurrency(
                    boqEligibleItems
                      .filter(b => !excludeZeroAmount || Number(b.total_contract_amount || 0) > 0)
                      .reduce((sum, b) => sum + Number(b.total_contract_amount || 0), 0)
                  )}
                </div>
              </div>
              <div style={{ background: '#faf5ff', padding: '0.875rem', borderRadius: '10px', textAlign: 'center', border: '1px solid #e9d5ff' }}>
                <div style={{ fontSize: '11px', color: '#6b21a8', fontWeight: 700 }}>أول دفعة مستحقة</div>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#7e22ce', direction: 'ltr', textAlign: 'center', marginTop: '4px' }}>
                  {boqEligibleItems.length > 0 ? (() => {
                    const d = new Date(boqEligibleItems[0].start_date);
                    d.setDate(d.getDate() - 7);
                    return formatDate(d.toISOString().split('T')[0]);
                  })() : '---'}
                </div>
              </div>
            </div>

            {/* خيار استبعاد البنود الصفرية */}
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
              <input
                type="checkbox"
                id="excludeZero"
                checked={excludeZeroAmount}
                onChange={(e) => setExcludeZeroAmount(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="excludeZero" style={{ fontSize: '12px', fontWeight: 800, color: '#334155', cursor: 'pointer' }}>
                استبعاد البنود التي قيمتها التعاقدية صفر (مثال: أعمال الحفر غير المسعرة)
              </label>
            </div>

            {/* جدول معاينة سريعة لأول دفعات */}
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '1.25rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'right' }}>
                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '6px 10px' }}>البند بالميزانية</th>
                    <th style={{ padding: '6px 10px' }}>تاريخ بدء العمل</th>
                    <th style={{ padding: '6px 10px' }}>موعد استحقاق الدفعة (قبلها بأسبوع)</th>
                    <th style={{ padding: '6px 10px' }}>مبلغ العميل</th>
                  </tr>
                </thead>
                <tbody>
                  {boqEligibleItems
                    .filter(b => !excludeZeroAmount || Number(b.total_contract_amount || 0) > 0)
                    .map((b: any, idx: number) => {
                      const startDate = new Date(b.start_date);
                      const dueDate = new Date(startDate);
                      dueDate.setDate(dueDate.getDate() - 7);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 800 }}>{b.work_item}</td>
                          <td style={{ padding: '6px 10px', direction: 'ltr', textAlign: 'right', color: '#64748b' }}>{formatDate(b.start_date)}</td>
                          <td style={{ padding: '6px 10px', direction: 'ltr', textAlign: 'right', fontWeight: 900, color: '#2563eb' }}>{formatDate(dueDate.toISOString().split('T')[0])}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 900, color: '#16a34a' }}>{formatCurrency(b.total_contract_amount || 0)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* تنبيه الاستبدال إن وجدت دفعات */}
            {milestones.length > 0 && (
              <div style={{ background: '#fef3c7', padding: '0.75rem', borderRadius: '10px', border: '1px solid #fde68a', color: '#92400e', fontSize: '12px', fontWeight: 800, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} />
                تنبيه: يوجد حالياً ({milestones.length}) دفعات مسجلة. تأكيد التوليد سيقوم بتحديث واستبدال الجدول بالدفعات الجديدة المسحوبة من الميزانية.
              </div>
            )}

            {/* أزرار الإجراء */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  logic.autoGenerateMilestones({ excludeZero: excludeZeroAmount });
                  setIsAutoGenerateModalOpen(false);
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: 900,
                  fontSize: 'var(--fs-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                }}
              >
                <Sparkles size={16} />
                تأكيد توليد الدفعات الآن
              </button>
              <button
                onClick={() => setIsAutoGenerateModalOpen(false)}
                style={{
                  flex: 1,
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: 900,
                  fontSize: 'var(--fs-sm)',
                  cursor: 'pointer'
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
