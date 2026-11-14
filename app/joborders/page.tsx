'use client';
import { currencySymbol } from '@/lib/currency';

import React, { useState, useMemo, useEffect } from 'react';
import { useJobOrdersLogic } from './joborders_logic';
import { THEME } from '@/lib/theme';
import SecureAction from '@/components/SecureAction';      
import MasterPage from '@/components/MasterPage';

// 🧱 المكونات
import RawasiSmartTable from '@/components/rawasismarttable';
import RawasiSidebarManager from '@/components/RawasiSidebarManager'; 
import SmartCombo from '@/components/SmartCombo'; 

// 🎬 المودالات
import JobOrderModal from './JobOrderModal';
import JobOrderLedgerModal from './JobOrderLedgerModal'; 
import LoadingScreen from '@/components/LoadingScreen';
import { HardHat, Handshake, Activity, CircleCheck, CirclePause, ClipboardList, Building2, BookOpen, Edit3 } from 'lucide-react';
import KpiStrip from '@/components/KpiStrip';
import PhiIcon from '@/components/PhiIcon';

export default function JobOrdersPage() {
  const logic = useJobOrdersLogic(); 
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 🚀 استخراج العناصر الحالية لتحديد الكل بأمان
  const currentVisibleIds = useMemo(() => {
    return logic.allFiltered
      .slice((logic.currentPage - 1) * logic.rowsPerPage, logic.currentPage * logic.rowsPerPage)
      .map((v: any) => String(v.id));
  }, [logic.allFiltered, logic.currentPage, logic.rowsPerPage]);

  const isAllVisibleSelected = currentVisibleIds.length > 0 && currentVisibleIds.every((id: string) => logic.selectedIds.includes(id));

  // =========================================================================
  // 💎 أعمدة الجدول (متوافقة مع RawasiSmartTable)
  // =========================================================================
// jobOrderColumns removed

  // =========================================================================
  // 🎛️ أزرار السايد بار
  // =========================================================================
  const sidebarActions = useMemo(() => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
      <SecureAction module="job_orders" action="create">
        <button className="btn-main-glass gold" onClick={logic.handleAddNew}>
          إصدار أمر تشغيل جديد
        </button>
      </SecureAction>

      {logic.selectedIds.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.3125rem', paddingTop: '0.9375rem', borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
          <p style={{fontSize:'var(--fs-xs)', textAlign:'center', color:'#94a3b8', fontWeight:900, marginBottom:'-0.3125rem'}}>الإجراءات المجمعة ({logic.selectedIds.length})</p>
          
          <SecureAction module="job_orders" action="edit">
            <button className="btn-main-glass green" onClick={logic.handleCompleteSelected} disabled={logic.isSaving}>
              {logic.isSaving ? 'جاري...' : 'تعيين كمكتمل'}
            </button>
          </SecureAction>

          <SecureAction module="job_orders" action="edit">
            <button className="btn-main-glass yellow" onClick={logic.handleSuspendSelected} disabled={logic.isSaving}>
              إيقاف مؤقت
            </button>
          </SecureAction>

          <SecureAction module="job_orders" action="delete">
            <button className="btn-main-glass red" onClick={logic.handleDeleteSelected} disabled={logic.isSaving}>
              حذف نهائي
            </button>
          </SecureAction>
        </div>
      )}
    </div>
  ), [logic.selectedIds, logic]);

  return (
    <MasterPage 
      title="أوامر التشغيل (Job Orders)" 
      subtitle="إدارة ومتابعة التكاليف وإسناد الأعمال للمقاولين والعمالة"
    >
      
      <RawasiSidebarManager 
        summary={
          <KpiStrip compact items={[
            { label: 'إجمالي الأوامر', value: logic.kpis.total.toLocaleString('en-US'), tone: 'brand', icon: <ClipboardList /> },
            { label: 'جاري التنفيذ', value: logic.kpis.running.toLocaleString('en-US'), tone: 'info', icon: <Activity /> },
            { label: 'موقوف', value: logic.kpis.suspended.toLocaleString('en-US'), tone: 'danger', icon: <CirclePause /> },
            { label: 'مكتمل', value: logic.kpis.completed.toLocaleString('en-US'), tone: 'success', icon: <CircleCheck /> },
          ]} />
        }
        actions={sidebarActions}
        customFilters={
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.3125rem' }}>
                <SmartCombo 
                    label="تصفية بالمشروع (العقار)"
                    icon="🏢"
                    table="projects"
                    displayCol="Property"
                    searchCols="Property,project_name,project_code"
                    placeholder="ابحث عن عقار..."
                    enableClear={true}
                    onSelect={(item:any) => logic.setProjectFilter(item?.id || '')}
                />

                <SmartCombo 
                    label="تصفية بالمقاول / الجهة"
                    icon="🤝"
                    table="partners"
                    displayCol="name"
                    placeholder="ابحث عن مقاول..."
                    enableClear={true}
                    onSelect={(item:any) => logic.setPartnerFilter(item?.id || '')}
                />

                <SmartCombo 
                    label="تصفية بالبند (العمل)"
                    icon="🛠️"
                    table="boq_budget_distinct"
                    displayCol="work_item"
                    placeholder="ابحث عن بند..."
                    enableClear={true}
                    onSelect={(item:any) => logic.setWorkitemFilter(item?.work_item || '')}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: '#27272a', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        حالة الأمر
                    </label>
                    <select 
                        value={logic.statusFilter}
                        onChange={(e) => logic.setStatusFilter(e.target.value)}
                        style={{ width: '100%', padding: '0.625rem', borderRadius: '12px', border: '1px solid rgba(194,65,12, 0.3)', background: 'rgba(255, 255, 255, 0.8)', color: '#1e293b', outline: 'none', fontWeight: 800, cursor: 'pointer', backdropFilter: 'blur(8px)' }}
                    >
                        <option value="">جميع الحالات</option>
                        <option value="مسودة">مسودة</option>
                        <option value="جاري التنفيذ">جاري التنفيذ</option>
                        <option value="مكتمل">مكتمل</option>
                        <option value="موقوف">موقوف</option>
                        <option value="جاري التسليم">جاري التسليم</option>
                        <option value="مفوتر">مفوتر</option>
                        <option value="تم التحصيل">تم التحصيل</option>
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: '#27272a', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        جهة التنفيذ
                    </label>
                    <select 
                        value={logic.executorFilter}
                        onChange={(e) => logic.setExecutorFilter(e.target.value)}
                        style={{ width: '100%', padding: '0.625rem', borderRadius: '12px', border: '1px solid rgba(194,65,12, 0.3)', background: 'rgba(255, 255, 255, 0.8)', color: '#1e293b', outline: 'none', fontWeight: 800, cursor: 'pointer', backdropFilter: 'blur(8px)' }}
                    >
                        <option value="">جميع الجهات</option>
                        <option value="مقاول باطن">مقاول باطن</option>
                        <option value="تنفيذ ذاتي">تنفيذ ذاتي (عمالة الشركة)</option>
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: '#27272a', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        الحالة المالية
                    </label>
                    <select 
                        value={logic.financialFilter}
                        onChange={(e) => logic.setFinancialFilter(e.target.value)}
                        style={{ width: '100%', padding: '0.625rem', borderRadius: '12px', border: '1px solid rgba(194,65,12, 0.3)', background: 'rgba(255, 255, 255, 0.8)', color: '#1e293b', outline: 'none', fontWeight: 800, cursor: 'pointer', backdropFilter: 'blur(8px)' }}
                    >
                        <option value="">جميع الحالات</option>
                        <option value="رابح">رابح</option>
                        <option value="خاسر">خاسر</option>
                        <option value="تعادل">تعادل</option>
                        <option value="لم يبدأ">لم يبدأ</option>
                    </select>
                </div>
            </div>
        }
        onSearch={logic.setGlobalSearch}
        onDateFilter={(start, end) => { logic.setDateFrom(start); logic.setDateTo(end); }}
        watchDeps={[logic.selectedIds, logic.allFiltered.length, logic.kpis, logic.statusFilter, logic.executorFilter, logic.workitemFilter, logic.projectFilter, logic.partnerFilter, logic.financialFilter]}
      />

      <style>{`
        .custom-checkbox { width: 1.25rem; height: 1.25rem; accent-color: ${THEME.goldAccent || '#d97706'}; cursor: pointer; transition: 0.1s; border-radius: 4px; }
        .btn-main-glass { width: 100%; padding: 0.875rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(15px); font-weight: 900; cursor: pointer; transition: 0.2s; font-size: var(--fs-sm); display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .btn-main-glass.gold { background: linear-gradient(135deg, rgba(194,65,12, 0.9), rgba(194,65,12, 1)); color: white; }
        .btn-main-glass.green { background: linear-gradient(135deg, rgba(16, 185, 129, 0.8), rgba(5, 150, 105, 0.9)); color: white; }
        .btn-main-glass.yellow { background: linear-gradient(135deg, rgba(245, 158, 11, 0.8), rgba(217, 119, 6, 0.9)); color: white; }
        .btn-main-glass.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
        .btn-main-glass:hover:not(:disabled) { transform: translateY(-3px); filter: brightness(1.1); }
        .btn-main-glass:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

            {(logic.isLoading && logic.allFiltered.length === 0) ? (
        <LoadingScreen message="جاري تحميل أوامر التشغيل..." fullScreen={false} />
      ) : (
        <div style={{ padding: '0.625rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(18.5rem, 1fr))', gap: '1.25rem' }}>
            {logic.allFiltered.slice((logic.currentPage - 1) * logic.rowsPerPage, logic.currentPage * logic.rowsPerPage).map((row: any) => {
              const isSelected = logic.selectedIds.includes(String(row.id));
              const contractorNames = (row.assigned_contractors || []).map((c: any) => c.name).filter(Boolean);
              const isSelf = row.executor_type === 'تنفيذ ذاتي' && contractorNames.length === 0;
              const executorName = isSelf
                ? 'تنفيذ ذاتي (عمالة الشركة)'
                : (contractorNames.length > 1
                    ? `${contractorNames.join(' + ')} (${contractorNames.length} مقاولين)`
                    : (contractorNames[0] || row.partners?.name || 'غير محدد'));
              
              const targetBudget = Number(row.boq_budget?.total_price || row.boq_total_budget || 0); 
              const materialsAndExpenses = Number(row.effective_cost || 0); 
              const subcontractorPaid = Number(row.subcontractor_paid || 0); 
              const finalCost = row.executor_type === 'مقاول باطن' ? materialsAndExpenses + subcontractorPaid : materialsAndExpenses;
              const calculatedProfit = targetBudget - finalCost;
              
              let usagePercent = targetBudget > 0 ? (finalCost / targetBudget) * 100 : 0;
              let progressColor = usagePercent > 95 ? '#ef4444' : (usagePercent > 80 ? '#f59e0b' : '#10b981');

              let profitColor = '#10b981'; 
              let profitBg = 'rgba(16, 185, 129, 0.1)';
              let profitLabel = 'الربح الصافي:';
              
              if (calculatedProfit < 0) {
                  profitColor = '#ef4444'; 
                  profitBg = 'rgba(239, 68, 68, 0.1)';
                  profitLabel = 'الخسارة:';
              } else if (calculatedProfit === 0 && finalCost === 0) {
                  profitColor = '#94a3b8'; 
                  profitBg = '#f1f5f9';
                  profitLabel = 'لم يبدأ:';
              } else if (calculatedProfit === 0 && finalCost > 0) {
                  profitColor = '#f59e0b'; 
                  profitBg = 'rgba(245, 158, 11, 0.1)';
                  profitLabel = 'تعادل:';
              }

              let badgeStyle = { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8', icon: '📄' };
              if (row.status === 'جاري التنفيذ') badgeStyle = { bg: '#dbeafe', color: '#2563eb', dot: '#3b82f6', icon: '⏳' };
              if (row.status === 'مكتمل') badgeStyle = { bg: '#dcfce3', color: '#10b981', dot: '#22c55e', icon: '✅' };
              if (row.status === 'موقوف') badgeStyle = { bg: '#fee2e2', color: '#dc2626', dot: '#ef4444', icon: '⏸️' };
              if (row.status === 'جاري التسليم') badgeStyle = { bg: '#fef08a', color: '#a16207', dot: '#fb923c', icon: '🚚' };
              if (row.status === 'مفوتر') badgeStyle = { bg: '#e0e7ff', color: '#4338ca', dot: '#6366f1', icon: '🧾' };
              if (row.status === 'تم التحصيل') badgeStyle = { bg: '#d1fae5', color: '#047857', dot: '#10b981', icon: '💰' };

              return (
                <div 
                  key={row.id}
                  onClick={() => { logic.setLedgerRecord(row); logic.setIsLedgerOpen(true); }}
                  style={{ 
                    background: 'var(--surface-card, #ffffff)', 
                    border: isSelected ? '2px solid #f97316' : '1px solid var(--border-color, #e2e8f0)', 
                    borderRadius: '16px', 
                    padding: '1.25rem', 
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 12px 30px rgba(249, 115, 22, 0.15)' : '0 4px 18px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.25s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 36px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isSelected ? '0 12px 30px rgba(249, 115, 22, 0.15)' : '0 4px 18px rgba(0, 0, 0, 0.04)'; }}
                >
                  {/* 1️⃣ ترويسة الكارت: رقم الأمر + التاريخ + شارة الحالة المعتمدة */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div className="jo-checkbox-wrap" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="custom-checkbox" 
                          checked={isSelected} 
                          onChange={(e) => {
                              e.stopPropagation();
                              if (isSelected) logic.setSelectedIds(logic.selectedIds.filter((i:any) => i !== String(row.id))); 
                              else logic.setSelectedIds([...logic.selectedIds, String(row.id)]); 
                          }} 
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span
                            dir="ltr"
                            style={{
                              color: 'var(--text-primary, #0f172a)',
                              fontSize: 'var(--fs-md, 15px)',
                              fontWeight: 900,
                              letterSpacing: '0.3px'
                            }}
                          >
                            #{row.order_number}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary, #64748b)', fontWeight: 700, marginTop: '1px' }}>
                          {row.start_date ? new Date(row.start_date).toLocaleDateString('en-GB') : '---'}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.3rem 0.7rem',
                      borderRadius: '999px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      backgroundColor: badgeStyle.bg,
                      color: badgeStyle.color,
                      border: `1px solid ${badgeStyle.dot}35`
                    }}>
                      <PhiIcon value={badgeStyle.icon} size={13} />
                      <span>{row.status}</span>
                    </div>
                  </div>

                  {/* 2️⃣ كتلة هوية المشروع وبند الأعمال المنسقة */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: 'rgba(249, 115, 22, 0.1)',
                          color: '#ea580c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <Building2 size={17} />
                      </div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 'var(--fs-md, 16px)',
                          fontWeight: 900,
                          color: 'var(--text-primary, #0f172a)',
                          lineHeight: 1.3
                        }}
                      >
                        {row.projects?.Property || row.projects?.project_name || 'مشروع غير محدد'}
                      </h3>
                    </div>

                    {row.boq_budget?.work_item && (
                      <div
                        style={{
                          fontSize: 'var(--fs-xs, 12px)',
                          color: 'var(--text-secondary, #475569)',
                          fontWeight: 700,
                          background: 'var(--surface-sunken, #f8fafc)',
                          padding: '0.4rem 0.65rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color, #e2e8f0)',
                          lineHeight: 1.4
                        }}
                      >
                        {row.boq_budget.work_item}
                      </div>
                    )}

                    <div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          background: isSelf ? 'rgba(99, 102, 241, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                          color: isSelf ? '#4338ca' : '#b45309',
                          border: `1px solid ${isSelf ? 'rgba(99, 102, 241, 0.2)' : 'rgba(245, 158, 11, 0.25)'}`
                        }}
                      >
                        {isSelf ? <HardHat size={13} /> : <Handshake size={13} />}
                        <span>{executorName}</span>
                      </span>
                    </div>
                  </div>

                  {/* 3️⃣ الكتلة المالية المنظمة والمتناسقة */}
                  <div
                    style={{
                      background: 'var(--surface-sunken, #f8fafc)',
                      border: '1px solid var(--border-color, #e2e8f0)',
                      borderRadius: '12px',
                      padding: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      fontSize: 'var(--fs-xs, 12px)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary, #64748b)', fontWeight: 800 }}>أصل الموازنة التقديرية</span>
                      <span style={{ color: '#0284c7', fontWeight: 900, fontSize: '13px' }} dir="ltr">
                        {targetBudget.toLocaleString()} {currencySymbol()}
                      </span>
                    </div>

                    {row.executor_type === 'مقاول باطن' ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
                          <span style={{ fontWeight: 700 }}>مواد ومصروفات مباشرة</span>
                          <span style={{ color: '#d97706', fontWeight: 800 }} dir="ltr">
                            - {materialsAndExpenses.toLocaleString()} {currencySymbol()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
                          <span style={{ fontWeight: 700 }}>مسدد لمقاولي الباطن</span>
                          <span style={{ color: '#7c3aed', fontWeight: 800 }} dir="ltr">
                            - {subcontractorPaid.toLocaleString()} {currencySymbol()}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
                        <span style={{ fontWeight: 700 }}>منصرف عمالة وخامات</span>
                        <span style={{ color: '#dc2626', fontWeight: 800 }} dir="ltr">
                          - {materialsAndExpenses.toLocaleString()} {currencySymbol()}
                        </span>
                      </div>
                    )}

                    <div
                      style={{
                        borderTop: '1px dashed var(--border-color, #cbd5e1)',
                        paddingTop: '0.4rem',
                        marginTop: '0.1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ color: 'var(--text-primary, #0f172a)', fontWeight: 900 }}>إجمالي التكلفة المنصرفة</span>
                      <span style={{ color: '#dc2626', fontWeight: 900, fontSize: '13px' }} dir="ltr">
                        {finalCost.toLocaleString()} {currencySymbol()}
                      </span>
                    </div>

                    <div
                      style={{
                        background: profitBg,
                        border: `1px solid ${profitColor}35`,
                        borderRadius: '8px',
                        padding: '0.45rem 0.75rem',
                        marginTop: '0.2rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ color: profitColor, fontWeight: 900 }}>{profitLabel}</span>
                      <span style={{ color: profitColor, fontWeight: 900, fontSize: '13.5px' }} dir="ltr">
                        {calculatedProfit > 0 ? '+ ' : ''}{Math.abs(calculatedProfit).toLocaleString()} {currencySymbol()}
                      </span>
                    </div>

                    {/* شريط استهلاك الميزانية المتناسق */}
                    <div style={{ marginTop: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '0.3rem', fontWeight: 800 }}>
                        <span>استهلاك الميزانية</span>
                        <span style={{ color: progressColor, fontWeight: 900 }}>{usagePercent.toFixed(1)}%</span>
                      </div>
                      <div style={{ width: '100%', height: '7px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(usagePercent, 100)}%`,
                            height: '100%',
                            background: progressColor,
                            borderRadius: '999px',
                            transition: 'width 0.4s ease'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4️⃣ شريط الإجراءات الموحد والمتناسق */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.4rem' }}>
                    {/* سطر الحالة السريعة بعرض كافي ومريح بدون أي قص للنص */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-secondary, #64748b)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                        الحالة:
                      </span>
                      <select 
                        value={row.status}
                        onChange={(e) => { e.stopPropagation(); logic.handleUpdateSingleStatus(row.id, e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          flex: 1,
                          height: '35px',
                          padding: '0 0.75rem',
                          background: 'var(--surface-sunken, #f8fafc)',
                          color: 'var(--text-primary, #0f172a)',
                          border: '1px solid var(--border-color, #e2e8f0)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          outline: 'none',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <option value="مسودة">مسودة</option>
                        <option value="جاري التنفيذ">جاري التنفيذ</option>
                        <option value="مكتمل">مكتمل</option>
                        <option value="موقوف">موقوف</option>
                        <option value="جاري التسليم">جاري التسليم</option>
                        <option value="مفوتر">مفوتر</option>
                        <option value="تم التحصيل">تم التحصيل</option>
                      </select>
                    </div>

                    {/* أزرار الإجراءات المتناسقة */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); logic.setLedgerRecord(row); logic.setIsLedgerOpen(true); }}
                        style={{
                          flex: 1,
                          height: '38px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: '#059669',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: '10px',
                          fontWeight: 900,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.12)'; }}
                        title="فتح دفتر أستاذ ومطابقة أمر الشغل والتقرير الشامل"
                      >
                        <BookOpen size={15} /> الليدجر
                      </button>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); logic.handleEdit(row); }}
                        style={{
                          height: '38px',
                          padding: '0 1.15rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          background: 'var(--surface-sunken, #f8fafc)',
                          color: 'var(--text-primary, #334155)',
                          border: '1px solid var(--border-color, #cbd5e1)',
                          borderRadius: '10px',
                          fontWeight: 800,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-raised, #e2e8f0)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-sunken, #f8fafc)'; }}
                        title="تعديل بيانات أمر الشغل"
                      >
                        <Edit3 size={15} /> تعديل
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.9375rem', marginTop: '1.875rem', padding: '0.9375rem', background: 'var(--surface-card)', borderRadius: 'var(--phi-radius-card, 18px)', border: 'none', boxShadow: 'var(--shadow-ambient)' }}>
              <button 
                  onClick={() => logic.setCurrentPage((p:number) => Math.max(1, p - 1))} 
                  disabled={logic.currentPage === 1}
                  style={{ padding: '0.5rem 0.9375rem', borderRadius: '10px', border: 'none', background: logic.currentPage === 1 ? 'var(--surface-sunken)' : 'var(--surface-subcard)', color: logic.currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)', boxShadow: logic.currentPage === 1 ? 'none' : 'var(--shadow-elevation)', cursor: logic.currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 800 }}
              >
                  السابق
              </button>
              <div style={{ fontWeight: 900, color: '#2d1a11' }}>
                  صفحة {logic.currentPage} من {Math.ceil(logic.allFiltered.length / logic.rowsPerPage) || 1}
              </div>
              <button 
                  onClick={() => logic.setCurrentPage((p:number) => Math.min(Math.ceil(logic.allFiltered.length / logic.rowsPerPage), p + 1))} 
                  disabled={logic.currentPage >= Math.ceil(logic.allFiltered.length / logic.rowsPerPage)}
                  style={{ padding: '0.5rem 0.9375rem', borderRadius: '10px', border: 'none', background: logic.currentPage >= Math.ceil(logic.allFiltered.length / logic.rowsPerPage) ? 'var(--surface-sunken)' : 'var(--surface-subcard)', color: logic.currentPage >= Math.ceil(logic.allFiltered.length / logic.rowsPerPage) ? 'var(--text-muted)' : 'var(--text-primary)', boxShadow: logic.currentPage >= Math.ceil(logic.allFiltered.length / logic.rowsPerPage) ? 'none' : 'var(--shadow-elevation)', cursor: 'pointer', fontWeight: 800 }}
              >
                  التالي
              </button>
          </div>
        </div>
      )}

      {/* المودال الخاص بإضافة/تعديل أمر التشغيل */}
      {mounted && logic.isEditModalOpen && (
        <JobOrderModal 
          isOpen={logic.isEditModalOpen} 
          onClose={() => logic.setIsEditModalOpen(false)} 
          record={logic.currentRecord} 
          setRecord={logic.setCurrentRecord} 
          onSave={logic.handleSave} 
          isSaving={logic.isSaving}
        />
      )}

      {/* 🚀 المودال الجديد: دفتر الأستاذ التحليلي */}
      {mounted && logic.isLedgerOpen && (
        <JobOrderLedgerModal 
          isOpen={logic.isLedgerOpen} 
          onClose={() => logic.setIsLedgerOpen(false)} 
          jobOrder={logic.ledgerRecord} 
        />
      )}
      
    </MasterPage>
  );
}