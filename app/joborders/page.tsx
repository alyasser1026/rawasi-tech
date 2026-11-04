'use client';

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
import { HardHat, Handshake, Activity, CircleCheck, CirclePause, ClipboardList } from 'lucide-react';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <SecureAction module="job_orders" action="create">
        <button className="btn-main-glass gold" onClick={logic.handleAddNew}>
          إصدار أمر تشغيل جديد
        </button>
      </SecureAction>

      {logic.selectedIds.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '5px', paddingTop: '15px', borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
          <p style={{fontSize:'var(--fs-xs)', textAlign:'center', color:'#94a3b8', fontWeight:900, marginBottom:'-5px'}}>الإجراءات المجمعة ({logic.selectedIds.length})</p>
          
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
            { label: 'إجمالي الأوامر', value: logic.kpis.total.toLocaleString('ar-EG'), tone: 'brand', icon: <ClipboardList /> },
            { label: 'جاري التنفيذ', value: logic.kpis.running.toLocaleString('ar-EG'), tone: 'info', icon: <Activity /> },
            { label: 'موقوف', value: logic.kpis.suspended.toLocaleString('ar-EG'), tone: 'danger', icon: <CirclePause /> },
            { label: 'مكتمل', value: logic.kpis.completed.toLocaleString('ar-EG'), tone: 'success', icon: <CircleCheck /> },
          ]} />
        }
        actions={sidebarActions}
        customFilters={
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '5px' }}>
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: '#27272a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        حالة الأمر
                    </label>
                    <select 
                        value={logic.statusFilter}
                        onChange={(e) => logic.setStatusFilter(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid rgba(194,65,12, 0.3)', background: 'rgba(255, 255, 255, 0.8)', color: '#1e293b', outline: 'none', fontWeight: 800, cursor: 'pointer', backdropFilter: 'blur(8px)' }}
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: '#27272a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        جهة التنفيذ
                    </label>
                    <select 
                        value={logic.executorFilter}
                        onChange={(e) => logic.setExecutorFilter(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid rgba(194,65,12, 0.3)', background: 'rgba(255, 255, 255, 0.8)', color: '#1e293b', outline: 'none', fontWeight: 800, cursor: 'pointer', backdropFilter: 'blur(8px)' }}
                    >
                        <option value="">جميع الجهات</option>
                        <option value="مقاول باطن">مقاول باطن</option>
                        <option value="تنفيذ ذاتي">تنفيذ ذاتي (عمالة الشركة)</option>
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: '#27272a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        الحالة المالية
                    </label>
                    <select 
                        value={logic.financialFilter}
                        onChange={(e) => logic.setFinancialFilter(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid rgba(194,65,12, 0.3)', background: 'rgba(255, 255, 255, 0.8)', color: '#1e293b', outline: 'none', fontWeight: 800, cursor: 'pointer', backdropFilter: 'blur(8px)' }}
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
        .custom-checkbox { width: 20px; height: 20px; accent-color: ${THEME.goldAccent || '#d97706'}; cursor: pointer; transition: 0.1s; border-radius: 4px; }
        .btn-main-glass { width: 100%; padding: 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(15px); font-weight: 900; cursor: pointer; transition: 0.2s; font-size: var(--fs-sm); display: flex; align-items: center; justify-content: center; gap: 8px; }
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
        <div style={{ padding: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {logic.allFiltered.slice((logic.currentPage - 1) * logic.rowsPerPage, logic.currentPage * logic.rowsPerPage).map((row: any) => {
              const isSelected = logic.selectedIds.includes(String(row.id));
              const isSelf = row.executor_type === 'تنفيذ ذاتي';
              const executorName = isSelf ? 'تنفيذ ذاتي (عمالة الشركة)' : (row.partners?.name || 'غير محدد');
              
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
                    background: 'rgba(255, 255, 255, 0.85)', 
                    backdropFilter: 'blur(20px)', 
                    border: isSelected ? '2px solid #d97706' : '1px solid rgba(255, 255, 255, 0.4)', 
                    borderRadius: '14px', 
                    padding: '20px', 
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 10px 30px rgba(217, 119, 6, 0.15)' : '0 10px 30px rgba(0, 0, 0, 0.03)',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isSelected ? '0 10px 30px rgba(217, 119, 6, 0.15)' : '0 10px 30px rgba(0, 0, 0, 0.03)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div className="jo-checkbox-wrap" style={{ marginTop: '2px' }} onClick={(e) => e.stopPropagation()}>
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
                        <b style={{ color: '#8b5cf6', fontSize: 'var(--fs-lg)', fontWeight: 900 }}>#{row.order_number}</b>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#64748b', marginTop: '2px' }}>{row.start_date ? new Date(row.start_date).toLocaleDateString('ar-EG') : '---'}</div>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '4px 10px', borderRadius: '14px', fontSize: 'var(--fs-xs)', fontWeight: 800,
                      backgroundColor: badgeStyle.bg, color: badgeStyle.color, border: `1px solid ${badgeStyle.dot}40`
                    }}>
                      <PhiIcon value={badgeStyle.icon} size={14} /> {row.status}
                    </div>
                  </div>

                  <div className="jo-project-name" style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#27272a', background: 'linear-gradient(90deg, rgba(194,65,12, 0.15) 0%, transparent 100%)', padding: '8px 12px', borderRight: '4px solid #c2410c', borderRadius: '4px' }}>
                        {row.projects?.Property || row.projects?.project_name || 'العقار غير محدد'}
                  </div>
                  
                  {row.boq_budget?.work_item && (
                       <span style={{ fontSize: 'var(--fs-xs)', color: '#475569', background: '#f1f5f9', padding: '4px 10px', borderRadius: '8px', width: 'fit-content', border: '1px solid #e2e8f0', fontWeight: 800 }}>
                         {row.boq_budget.work_item}
                       </span>
                  )}

                  <div>
                    <span style={{ 
                      padding: '4px 10px', borderRadius: '8px', fontSize: 'var(--fs-sm)', fontWeight: 800, display: 'inline-block',
                      background: isSelf ? 'rgba(99, 102, 241, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      color: isSelf ? '#4f46e5' : '#d97706',
                      border: `1px solid ${isSelf ? 'rgba(99, 102, 241, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
                    }}>
                      {isSelf ? <HardHat size={14} aria-hidden="true" /> : <Handshake size={14} aria-hidden="true" />} {executorName}
                    </span>
                  </div>

                  <div style={{ borderTop: '1px dashed #cbd5e1', margin: '5px 0' }}></div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: 'var(--fs-sm)', fontWeight: 800 }}>
                     <div style={{ color: '#0ea5e9', display: 'flex', justifyContent: 'space-between' }}>
                         <span>أصل الموازنة:</span> <span>{targetBudget.toLocaleString()} ر.س</span>
                     </div>
                     
                     {row.executor_type === 'مقاول باطن' ? (
                        <>
                            <div style={{ color: '#f59e0b', display: 'flex', justifyContent: 'space-between' }}>
                                <span>مواد ومصروفات:</span> <span dir="ltr"> - {materialsAndExpenses.toLocaleString()}</span>
                            </div>
                            <div style={{ color: '#8b5cf6', display: 'flex', justifyContent: 'space-between' }}>
                                <span>مسدد للمقاول:</span> <span dir="ltr"> - {subcontractorPaid.toLocaleString()}</span>
                            </div>
                        </>
                     ) : (
                        <div style={{ color: '#ef4444', display: 'flex', justifyContent: 'space-between' }}>
                            <span>منصرف للعمالة والخامات:</span> <span dir="ltr"> - {materialsAndExpenses.toLocaleString()}</span>
                        </div>
                     )}
                     
                     <div style={{ color: '#1e293b', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                         <span>إجمالي التكلفة:</span> <span>{finalCost.toLocaleString()} ر.س</span>
                     </div>
                     
                     <div style={{ 
                         color: profitColor, background: profitBg, 
                         padding: '6px 10px', borderRadius: '8px', border: `1px solid ${profitColor}40`, marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)'
                     }}>
                       <span>{profitLabel}</span> <span>{Math.abs(calculatedProfit).toLocaleString()} ر.س</span>
                     </div>

                     <div style={{ marginTop: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: '#64748b', marginBottom: '6px' }}>
                          <span>استهلاك الميزانية (عمالة + خامات)</span>
                          <span style={{ color: progressColor, fontWeight: 900 }}>{usagePercent.toFixed(1)}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(usagePercent, 100)}%`, height: '100%', background: progressColor, transition: 'width 0.5s ease-out' }}></div>
                        </div>
                     </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <select 
                        value={row.status}
                        onChange={(e) => { e.stopPropagation(); logic.handleUpdateSingleStatus(row.id, e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ flex: 1, padding: '8px', background: 'rgba(255, 255, 255, 0.8)', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '16px', fontWeight: 800, cursor: 'pointer', outline: 'none' }}
                    >
                        <option value="مسودة">مسودة</option>
                        <option value="جاري التنفيذ">جاري التنفيذ</option>
                        <option value="مكتمل">مكتمل</option>
                        <option value="موقوف">موقوف</option>
                        <option value="جاري التسليم">جاري التسليم</option>
                        <option value="مفوتر">مفوتر</option>
                        <option value="تم التحصيل">تم التحصيل</option>
                    </select>
                    <button onClick={(e) => { e.stopPropagation(); logic.handleEdit(row); }} className="btn-main-glass" style={{ flex: 1, padding: '8px', background: 'rgba(59, 130, 246, 0.05)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      تعديل
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); logic.setLedgerRecord(row); logic.setIsLedgerOpen(true); }} className="btn-main-glass" style={{ flex: 1, padding: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      الليدجر
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '30px', padding: '15px', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <button 
                  onClick={() => logic.setCurrentPage((p:number) => Math.max(1, p - 1))} 
                  disabled={logic.currentPage === 1}
                  style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', background: logic.currentPage === 1 ? '#f1f5f9' : 'white', cursor: logic.currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 800 }}
              >
                  السابق
              </button>
              <div style={{ fontWeight: 900, color: '#2d1a11' }}>
                  صفحة {logic.currentPage} من {Math.ceil(logic.allFiltered.length / logic.rowsPerPage) || 1}
              </div>
              <button 
                  onClick={() => logic.setCurrentPage((p:number) => Math.min(Math.ceil(logic.allFiltered.length / logic.rowsPerPage), p + 1))} 
                  disabled={logic.currentPage >= Math.ceil(logic.allFiltered.length / logic.rowsPerPage)}
                  style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', background: logic.currentPage >= Math.ceil(logic.allFiltered.length / logic.rowsPerPage) ? '#f1f5f9' : 'white', cursor: 'pointer', fontWeight: 800 }}
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