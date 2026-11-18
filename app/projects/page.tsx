"use client";
import React, { useMemo, useState, useEffect } from 'react';
import SecureAction from '@/components/SecureAction';
import { createPortal } from 'react-dom';
import { useProjectsLogic } from './projects_logic';
import BoqFormModal from './BoqFormModal';
import AddProjectModal from './AddProjectModal'; 
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import RawasiSmartTable from '@/components/rawasismarttable';
import { formatCurrency, formatDate } from '@/lib/helpers';
import { THEME } from '@/lib/theme';

// 🚀 الاستيرادات من الملفات المنفصلة
import { StatusBadge, TabButton } from './SharedUI';
import OverviewTab from './OverviewTab';
import BoqTab from './BoqTab';
import MaterialsTab from './MaterialsTab';
import FinancialsTab from './FinancialsTab';
import QcTab from './QcTab';
import VisitGalleryTab from './VisitGalleryTab'; // معرض صور الزيارات العادية المعتمد للعميل
import ExpensesTab from './ExpensesTab'; // 👈 استدعاء تاب المصروفات الجديد
import BimTab from './BimTab'; // 👈 استدعاء تاب النماذج ثلاثية الأبعاد BIM
import ReportsTab from './ReportsTab'; // 👈 استدعاء تاب التقارير الهندسية والمالية الشاملة
import AllProjectsReportEmbed from '../reports/AllProjectsReportEmbed';
import LoadingScreen from '@/components/LoadingScreen';
import { Activity, Building2, CirclePause, Layers, TriangleAlert, HardHat, Phone, Handshake, ChevronLeft, CheckCircle2, Clock, User, Home, ArrowUpRight, FileText } from 'lucide-react';
import KpiStrip from '@/components/KpiStrip';

export default function AdvancedProjectsPage() {
    const logic = useProjectsLogic();
    const [mounted, setMounted] = useState(false);
    const [showMasterReport, setShowMasterReport] = useState(false);
    
    // 🚀 حالة التحكم في المودال (الطباعة)
    const [isPrintOpen, setIsPrintOpen] = useState(false);
    const [selectedPartnerName, setSelectedPartnerName] = useState('');

    // 🚀 حالة التحكم في نافذة التأكيد قبل الحذف
    const [deleteAlert, setDeleteAlert] = useState<{isOpen: boolean, type: string, id: string | null, title: string, message: string}>({
        isOpen: false, type: '', id: null, title: '', message: ''
    });

    useEffect(() => { setMounted(true); }, []);

    const isPeriodSelected = Boolean(logic.dateFrom || logic.dateTo);
    const summarySuffix = isPeriodSelected ? 'للفترة المحددة' : '(تراكمي نهائي)';
    const netTitle = isPeriodSelected ? 'صافي حساب الفترة المحددة' : 'صافي الحساب (النهائي)';

    // =========================================================================
    // 🎛️ أزرار وفلاتر السايد بار 
    // =========================================================================
    const sidebarActions = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
        
        {!logic.selectedProject && (
            <SecureAction module="projects" action="create">
            <button onClick={() => { logic.setCurrentProjectRecord({ project_code: '', Property: '', unit_type: '', unit_area: '', client_id: '', contract_value: '', estimated_budget: '', down_payment: '', start_date: '', end_date: '', location_address: '', project_manager: '', engineer_in_charge: '', engineer_phone: '', status: 'قيد الدراسة', current_stage: 'تجهيز الموقع', notes: '' }); logic.setIsAddProjectModalOpen(true); }} className="btn-main-glass gold">
                إضافة مشروع جديد
            </button>
        </SecureAction>
        )}

        {logic.selectedProject && (
            <>
                <SecureAction module="projects" action="edit">
                <button onClick={() => { logic.setCurrentProjectRecord({ ...logic.selectedProject }); logic.setIsAddProjectModalOpen(true); }} className="btn-main-glass blue">
                    تعديل بيانات المشروع
                </button>
            </SecureAction>

                <SecureAction module="projects" action="delete">
                <button onClick={() => { setDeleteAlert({ isOpen: true, type: 'project', id: logic.selectedProject.id, title: 'حذف المشروع نهائياً', message: `هل أنت متأكد من حذف العقار "${logic.selectedProject.Property}" بكل بياناته وحساباته ومقايساته؟ هذا الإجراء لا يمكن التراجع عنه!` }); }} className="btn-main-glass red">
                    حذف المشروع نهائياً
                </button>
            </SecureAction>

                {logic.activeTab === 'boq' && (
                    <SecureAction module="boqbudget" action="create">
                    <button onClick={() => {
                        logic.setCurrentBoqRecord({ item_type: 'رئيسي', contract_quantity: 1, unit_contract_price: 0, estimated_labor_cost: 0, estimated_material_cost: 0, estimated_expenses_cost: 0, start_date: '', end_date: '' });
                        logic.setIsBoqModalOpen(true);
                    }} className="btn-main-glass gold">
                        إضافة بند للمقايسة (WBS)
                    </button>
                </SecureAction>
                )}

                <button onClick={logic.runDiagnostics} className="btn-main-glass white" style={{ borderColor: 'rgba(239, 68, 68, 0.5)' }}>
                    تشغيل فحص الداتا بيز
                </button>

            </>
        )}

        {!logic.selectedProject && (
            <>
                <button
                    type="button"
                    onClick={() => setShowMasterReport((prev) => !prev)}
                    className="btn-main-glass blue"
                >
                    {showMasterReport ? 'عرض بطاقات المشاريع' : '📊 التقرير المالي الشامل لجميع المشاريع'}
                </button>
                <button onClick={logic.resetFilters} className="btn-main-glass white">
                    إعادة ضبط الفلاتر
                </button>
            </>
        )}
      </div>
    );

    const sidebarFilters = (
      <div style={{ marginTop: '0.9375rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <input 
              type="search" 
              aria-label="بحث في المشاريع"
              placeholder="ابحث عن مشروع أو نوع النموذج..." 
              className="glass-input-field" 
              value={logic.searchQuery} 
              onChange={e => logic.setSearchQuery(e.target.value)} 
          />
          {!logic.selectedProject && (
              <>
                  <select className="glass-input-field" aria-label="حالة المشروع" value={logic.filterStatus} onChange={e => logic.setFilterStatus(e.target.value)}>
                      <option value="الكل">كل الحالات</option>
                      <option value="قيد الدراسة">قيد الدراسة</option>
                      <option value="جاري تجهيز الموقع">جاري تجهيز الموقع</option>
                      <option value="قيد التنفيذ">قيد التنفيذ</option>
                      <option value="متوقف مؤقتا">متوقف مؤقتا</option>
                      <option value="متوقف">متوقف نهائياً</option>
                      <option value="منتهي">منتهي</option>
                  </select>
                  
                  <select className="glass-input-field" aria-label="المرحلة الإنشائية" value={logic.filterStage} onChange={e => logic.setFilterStage(e.target.value)}>
                      <option value="الكل">كل المراحل الإنشائية</option>
                      <option value="قيد الدراسة">قيد الدراسة</option>
                      {logic.availableStages?.map((stage: string) => (
                          <option key={stage} value={stage}>{stage}</option>
                      ))}
                  </select>
              </>
          )}
      </div>
    );

    return (
      <div className="clean-page">
        <MasterPage title="غرفة عمليات المشاريع المتقدمة" subtitle="إدارة الميزانيات، المقايسات، والتدفقات النقدية للمشروعات">
          
          <RawasiSidebarManager 
              summary={logic.selectedProject ? (
                  <KpiStrip compact items={[
                      { label: 'كود المشروع', value: logic.selectedProject.project_code || 'بدون كود', tone: 'brand', icon: <Building2 /> },
                      { label: 'الحالة', value: logic.selectedProject.status || '—', tone: 'info', icon: <Activity /> },
                      { label: 'المرحلة الحالية', value: logic.selectedProject.current_stage || '—', tone: 'neutral', icon: <Layers /> },
                  ]} />
              ) : (
                  <KpiStrip compact items={[
                      { label: 'المشاريع المعروضة', value: logic.projects.length.toLocaleString('en-US'), tone: 'brand', icon: <Building2 /> },
                      { label: 'قيد التنفيذ', value: logic.projects.filter((p: any) => p.status === 'قيد التنفيذ').length.toLocaleString('en-US'), tone: 'success', icon: <Activity /> },
                      { label: 'قيد الدراسة', value: logic.projects.filter((p: any) => p.status === 'قيد الدراسة').length.toLocaleString('en-US'), tone: 'info', icon: <Layers /> },
                      { label: 'متوقف أو منتهي', value: logic.projects.filter((p: any) => ['متوقف', 'متوقف مؤقتا', 'منتهي'].includes(p.status)).length.toLocaleString('en-US'), tone: 'neutral', icon: <CirclePause /> },
                  ]} />
              )}
              actions={sidebarActions}
              customFilters={sidebarFilters}
              watchDeps={[logic.selectedProject, logic.activeTab, logic.searchQuery, logic.projects.length, logic.filterStatus, logic.filterStage]}
          />

          <style>{`
            .glass-input-field { width: 100%; padding: 0.75rem; border-radius: 12px; background: rgba(255, 255, 255, 0.65); border: 1px solid rgba(255, 255, 255, 0.8); outline: none; font-weight: 700; color: #1e293b; transition: 0.3s; }
            .glass-input-field:focus { background: #ffffff; border-color: ${THEME.goldAccent}; box-shadow: 0 0 0 4px rgba(194,65,12, 0.15); }
            .btn-main-glass { width: 100%; padding: 0.875rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(15px); font-weight: 900; cursor: pointer; transition: 0.2s; font-size: var(--fs-sm); display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
            .btn-main-glass.gold { background: linear-gradient(135deg, rgba(194,65,12, 0.9), rgba(194,65,12, 1)); color: white; }
            .btn-main-glass.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
            .btn-main-glass.blue { background: linear-gradient(135deg, rgba(14, 165, 233, 0.8), rgba(2, 132, 199, 0.9)); color: white; }
            .btn-main-glass.white { background: rgba(255, 255, 255, 0.6); color: #1e293b; border: 1px solid rgba(255,255,255,0.8); }
            .btn-main-glass:hover { transform: translateY(-3px); filter: brightness(1.1); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
            .summary-glass-card { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 1.25rem; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.2); margin-bottom: 1.5625rem; }
            .glass-card { background: rgba(255,255,255,0.6); backdrop-filter: blur(20px); padding: 1.5625rem; borderRadius: 24px; border: 1px solid rgba(255,255,255,0.8); boxShadow: 0 10px 30px rgba(0,0,0,0.03); margin-bottom: 1.5625rem; }
            .labor-stat-item { display: flex; flex-direction: column; background: rgba(255,255,255,0.5); padding: 0.75rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.7); }
            
            .projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(21rem, 1fr)); gap: 1.25rem; }
            .project-card { 
              background: var(--surface-card, #ffffff); 
              border-radius: 16px; 
              padding: 1.25rem; 
              border: 1px solid var(--border-color, #e2e8f0); 
              transition: all 0.25s ease; 
              cursor: pointer; 
              position: relative; 
              overflow: hidden; 
              display: flex;
              flex-direction: column;
              gap: 0.85rem;
              box-shadow: 0 4px 18px rgba(0, 0, 0, 0.04);
            }
            .project-card:hover { 
              transform: translateY(-4px); 
              box-shadow: 0 16px 36px rgba(0, 0, 0, 0.08); 
              border-color: rgba(249, 115, 22, 0.4); 
            }
          `}</style>

          {logic.isLoading ? (
               <LoadingScreen message="جاري تحميل بيانات المشاريع..." fullScreen={false} />
          ) : !logic.selectedProject ? (
               <div>
                   <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                       <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                           <button
                               type="button"
                               onClick={() => setShowMasterReport(false)}
                               style={{
                                   padding: '0.65rem 1.2rem',
                                   borderRadius: '12px',
                                   border: 'none',
                                   fontWeight: 900,
                                   fontSize: 'var(--fs-sm)',
                                   cursor: 'pointer',
                                   background: !showMasterReport ? 'var(--action-fill)' : 'var(--surface-subcard)',
                                   color: !showMasterReport ? 'var(--action-ink)' : 'var(--text-secondary)',
                               }}
                           >
                               🏗️ بطاقات المشاريع ({logic.projects.length})
                           </button>
                           <button
                               type="button"
                               onClick={() => setShowMasterReport(true)}
                               style={{
                                   padding: '0.65rem 1.2rem',
                                   borderRadius: '12px',
                                   border: 'none',
                                   fontWeight: 900,
                                   fontSize: 'var(--fs-sm)',
                                   cursor: 'pointer',
                                   background: showMasterReport ? 'var(--action-fill)' : 'var(--surface-subcard)',
                                   color: showMasterReport ? 'var(--action-ink)' : 'var(--text-secondary)',
                               }}
                           >
                               📊 التقرير المالي الشامل لجميع المشاريع والحسابات
                           </button>
                       </div>
                   </div>

                   {showMasterReport ? (
                       <AllProjectsReportEmbed />
                   ) : (
               <div className="projects-grid" style={{ animation: 'fadeIn 0.5s ease-out' }}>
                   {logic.projects.map(proj => {
                       // 1. القيم المالية المحسوبة
                       const contractAmount = Number(proj.contract_value || 0);
                       const budgetAmount = Number(proj.estimated_budget || (contractAmount > 0 ? contractAmount : 0));
                       const totalActualCost = Number(proj.total_cost || 0);
                       const variance = budgetAmount - totalActualCost;
                       const budgetUsagePercent = budgetAmount > 0 ? (totalActualCost / budgetAmount) * 100 : 0;
                       const progressColor = budgetUsagePercent > 95 ? '#ef4444' : (budgetUsagePercent > 80 ? '#f59e0b' : '#10b981');

                       // 2. نسبة الإنجاز الفعلي
                       const physicalProgress = Number(proj.overall_completion_percentage || 0).toFixed(1);

                       // 3. الموقف الزمني
                       let timelineText = 'المدة قيد التحديد';
                       let timelineToneColor = '#64748b';
                       let timelineToneBg = 'rgba(100, 116, 139, 0.08)';

                       if (proj.start_date && proj.end_date) {
                           const start = new Date(proj.start_date).getTime();
                           const end = new Date(proj.end_date).getTime();
                           const now = new Date().getTime();
                           const daysDiff = Math.round((now - end) / (1000 * 60 * 60 * 24));
                           
                           if (proj.status === 'منتهي') {
                               timelineText = 'منتهي ومكتمل';
                               timelineToneColor = '#10b981';
                               timelineToneBg = 'rgba(16, 185, 129, 0.1)';
                           } else if (now > end) {
                               timelineText = `متأخر زمنياً بـ ${daysDiff} يوم`;
                               timelineToneColor = '#dc2626';
                               timelineToneBg = 'rgba(239, 68, 68, 0.1)';
                           } else {
                               const remaining = Math.abs(daysDiff);
                               timelineText = remaining === 0 ? 'اليوم الموعد النهائي' : `ضمن الجدول (متبقي ${remaining} يوم)`;
                               timelineToneColor = '#0284c7';
                               timelineToneBg = 'rgba(2, 132, 199, 0.1)';
                           }
                       }

                       // كود أو إشارة المشروع
                       const projectRef = proj.project_code || (proj.Property ? `PRJ-${String(proj.Property).replace(/[^0-9]/g, '') || proj.id.slice(0, 4)}` : `#${proj.id.slice(0, 4)}`);
                       const clientName = proj.client?.name || proj.client_name || 'شركة المواطن الدولية';
                       const subList = Array.isArray(proj.subcontractors) ? proj.subcontractors : [];

                       return (
                           <div key={proj.id} className="project-card" onClick={() => logic.loadProjectDetails(proj)}>
                               {/* 1️⃣ ترويسة الكارت المنظمة بدون تداخل نهائياً */}
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem' }}>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                       <span
                                           dir="ltr"
                                           style={{
                                               fontSize: '11.5px',
                                               fontWeight: 900,
                                               color: '#0369a1',
                                               backgroundColor: 'rgba(2, 132, 199, 0.08)',
                                               border: '1px solid rgba(2, 132, 199, 0.25)',
                                               padding: '0.2rem 0.55rem',
                                               borderRadius: '6px'
                                           }}
                                       >
                                           #{projectRef}
                                       </span>
                                       {proj.current_stage && (
                                           <span
                                               style={{
                                                   fontSize: '11px',
                                                   fontWeight: 800,
                                                   background: 'rgba(249, 115, 22, 0.09)',
                                                   color: '#ea580c',
                                                   border: '1px solid rgba(249, 115, 22, 0.25)',
                                                   padding: '0.2rem 0.55rem',
                                                   borderRadius: '6px',
                                                   whiteSpace: 'nowrap',
                                                   maxWidth: '12rem',
                                                   overflow: 'hidden',
                                                   textOverflow: 'ellipsis'
                                               }}
                                               title={`المرحلة الحالية: ${proj.current_stage}`}
                                           >
                                               {proj.current_stage}
                                           </span>
                                       )}
                                   </div>
                                   <StatusBadge status={proj.status || 'قيد الدراسة'} />
                               </div>

                               {/* 2️⃣ كتلة هوية العقار والعميل */}
                               <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                   <div
                                       style={{
                                           width: '38px',
                                           height: '38px',
                                           borderRadius: '10px',
                                           background: 'rgba(249, 115, 22, 0.1)',
                                           color: '#ea580c',
                                           display: 'flex',
                                           alignItems: 'center',
                                           justifyContent: 'center',
                                           flexShrink: 0
                                       }}
                                   >
                                       <Building2 size={20} />
                                   </div>
                                   <div style={{ minWidth: 0, flex: 1 }}>
                                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                           <h3
                                               style={{
                                                   margin: 0,
                                                   color: 'var(--text-primary, #0f172a)',
                                                   fontWeight: 900,
                                                   fontSize: 'var(--fs-md, 16px)',
                                                   lineHeight: 1.3
                                               }}
                                           >
                                               {proj.Property}
                                           </h3>
                                           {proj.unit_type && (
                                               <span
                                                   style={{
                                                       fontSize: '11px',
                                                       fontWeight: 800,
                                                       padding: '0.15rem 0.45rem',
                                                       borderRadius: '6px',
                                                       background: 'rgba(99, 102, 241, 0.08)',
                                                       color: '#4338ca',
                                                       border: '1px solid rgba(99, 102, 241, 0.2)'
                                                   }}
                                               >
                                                   ({proj.unit_type})
                                               </span>
                                           )}
                                       </div>
                                       <p
                                           style={{
                                               margin: '0.2rem 0 0',
                                               fontSize: 'var(--fs-xs, 12px)',
                                               color: 'var(--text-secondary, #64748b)',
                                               fontWeight: 700,
                                               display: 'flex',
                                               alignItems: 'center',
                                               gap: '0.3rem'
                                           }}
                                       >
                                           <User size={12} />
                                           <span>العميل: {clientName}</span>
                                       </p>
                                   </div>
                               </div>

                               {/* 3️⃣ كتلة المهندس المسؤول والمقاولين */}
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                   {(proj.engineer_in_charge || proj.engineer_phone) && (
                                       <div
                                           style={{
                                               background: 'var(--surface-sunken, #f8fafc)',
                                               border: '1px solid var(--border-color, #e2e8f0)',
                                               borderRadius: '8px',
                                               padding: '0.4rem 0.65rem',
                                               display: 'flex',
                                               justifyContent: 'space-between',
                                               alignItems: 'center',
                                               fontSize: '11.5px',
                                               color: '#334155',
                                               fontWeight: 700
                                           }}
                                       >
                                           <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                               <HardHat size={13} color="#ea580c" />
                                               <span>{proj.engineer_in_charge || 'مهندس الموقع'}</span>
                                           </span>
                                           {proj.engineer_phone && (
                                               <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#0284c7' }} dir="ltr">
                                                   <Phone size={11} />
                                                   <span>{proj.engineer_phone}</span>
                                               </span>
                                           )}
                                       </div>
                                   )}
                                   {subList.length > 0 && (
                                       <div
                                           style={{
                                               display: 'flex',
                                               alignItems: 'center',
                                               gap: '0.35rem',
                                               fontSize: '11px',
                                               color: '#7c3aed',
                                               fontWeight: 800,
                                               padding: '0.15rem 0.35rem'
                                           }}
                                       >
                                           <Handshake size={12} />
                                           <span>مقاول: {subList.join(' ، ')}</span>
                                       </div>
                                   )}
                               </div>

                               {/* 4️⃣ الكتلة المالية المنظمة والمتناسقة */}
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
                                       <span style={{ color: 'var(--text-primary, #0f172a)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                           <FileText size={13} color="#ea580c" />
                                           <span>قيمة التعاقد</span>
                                       </span>
                                       <span style={{ color: '#ea580c', fontWeight: 900, fontSize: '13px' }} dir="ltr">
                                           {formatCurrency(contractAmount)}
                                       </span>
                                   </div>

                                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                       <span style={{ color: 'var(--text-secondary, #64748b)', fontWeight: 800 }}>الميزانية المعتمدة</span>
                                       <span style={{ color: '#0284c7', fontWeight: 900, fontSize: '13px' }} dir="ltr">
                                           {formatCurrency(budgetAmount)}
                                       </span>
                                   </div>

                                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
                                       <span style={{ fontWeight: 700 }}>التكلفة الفعلية (مواد + عمالة)</span>
                                       <span style={{ color: '#dc2626', fontWeight: 900, fontSize: '13px' }} dir="ltr">
                                           - {formatCurrency(totalActualCost)}
                                       </span>
                                   </div>

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
                                       <span style={{ color: variance >= 0 ? '#16a34a' : '#dc2626', fontWeight: 900 }}>
                                           {variance >= 0 ? 'الوفر المتبقي:' : 'تجاوز الميزانية:'}
                                       </span>
                                       <span style={{ color: variance >= 0 ? '#16a34a' : '#dc2626', fontWeight: 900, fontSize: '13px' }} dir="ltr">
                                           {variance >= 0 ? '+ ' : ''}{formatCurrency(Math.abs(variance))}
                                       </span>
                                   </div>

                                   {/* شريط استهلاك الميزانية */}
                                   <div style={{ marginTop: '0.35rem' }}>
                                       <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '0.3rem', fontWeight: 800 }}>
                                           <span>استهلاك الميزانية</span>
                                           <span style={{ color: progressColor, fontWeight: 900 }}>{budgetUsagePercent.toFixed(1)}%</span>
                                       </div>
                                       <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                                           <div
                                               style={{
                                                   width: `${Math.min(budgetUsagePercent, 100)}%`,
                                                   height: '100%',
                                                   background: progressColor,
                                                   borderRadius: '999px',
                                                   transition: 'width 0.4s ease'
                                               }}
                                           />
                                       </div>
                                   </div>
                               </div>

                               {/* 5️⃣ مؤشر الإنجاز الفعلي والموقف الزمني */}
                               <div
                                   style={{
                                       background: 'var(--surface-sunken, #f8fafc)',
                                       border: '1px solid var(--border-color, #e2e8f0)',
                                       borderRadius: '10px',
                                       padding: '0.65rem 0.75rem',
                                       display: 'flex',
                                       flexDirection: 'column',
                                       gap: '0.45rem'
                                   }}
                               >
                                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                       <span style={{ fontSize: '11.5px', color: 'var(--text-secondary, #64748b)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                           <CheckCircle2 size={13} color={Number(physicalProgress) === 100 ? '#16a34a' : '#ea580c'} />
                                           نسبة الإنجاز الفعلي للموقع
                                       </span>
                                       <span style={{ fontSize: '11.5px', fontWeight: 900, color: Number(physicalProgress) === 100 ? '#16a34a' : '#ea580c' }}>
                                           {physicalProgress}%
                                       </span>
                                   </div>
                                   <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                                       <div
                                           style={{
                                               width: `${Math.min(Number(physicalProgress), 100)}%`,
                                               height: '100%',
                                               background: Number(physicalProgress) === 100 ? '#16a34a' : 'linear-gradient(90deg, #f97316, #ea580c)',
                                               borderRadius: '999px',
                                               transition: 'width 0.4s ease'
                                           }}
                                       />
                                   </div>

                                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.2rem', borderTop: '1px dashed var(--border-color, #e2e8f0)', marginTop: '0.1rem' }}>
                                       <span style={{ fontSize: '11px', color: 'var(--text-secondary, #64748b)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                           <Clock size={12} color={timelineToneColor} />
                                           الموقف الزمني:
                                       </span>
                                       <span
                                           style={{
                                               display: 'inline-flex',
                                               alignItems: 'center',
                                               gap: '0.25rem',
                                               padding: '0.15rem 0.5rem',
                                               borderRadius: '6px',
                                               fontSize: '10.5px',
                                               fontWeight: 800,
                                               backgroundColor: timelineToneBg,
                                               color: timelineToneColor,
                                               border: `1px solid ${timelineToneColor}35`
                                           }}
                                       >
                                           {timelineText}
                                       </span>
                                   </div>
                               </div>

                               {/* 6️⃣ تذييل الكارت التفاعلي */}
                               <div
                                   style={{
                                       display: 'flex',
                                       justifyContent: 'space-between',
                                       alignItems: 'center',
                                       marginTop: 'auto',
                                       paddingTop: '0.45rem',
                                       borderTop: '1px solid var(--border-color, #f1f5f9)'
                                   }}
                               >
                                   <span style={{ fontSize: '11px', color: 'var(--text-secondary, #64748b)', fontWeight: 800 }}>
                                       {proj.start_date ? `بدء: ${new Date(proj.start_date).toLocaleDateString('en-GB')}` : 'المشروع قيد المتابعة'}
                                   </span>
                                   <span
                                       style={{
                                           fontSize: '12px',
                                           fontWeight: 900,
                                           color: THEME.goldAccent,
                                           display: 'inline-flex',
                                           alignItems: 'center',
                                           gap: '0.25rem'
                                       }}
                                   >
                                       فتح غرفة المشروع <ChevronLeft size={14} />
                                   </span>
                               </div>
                           </div>
                       );
                   })}
                   {logic.projects.length === 0 && (
                       <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3.125rem', color: '#94a3b8', fontWeight: 900 }}>
                           لا توجد مشاريع تطابق شروط البحث أو الفلاتر المحددة.
                       </div>
                   )}
               </div>
                   )}
               </div>

          ) : logic.isDetailsLoading ? (
               <LoadingScreen message="جاري سحب الهيكل الهندسي والمالي للعقار..." fullScreen={false} />
          ) : (
              <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5625rem', background: 'rgba(255,255,255,0.4)', padding: '1rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.5)' }}>
                    <div style={{ minWidth: 0 }}>
                        <h2 style={{ margin: 0, fontWeight: 900, color: THEME.coffeeDark, fontSize: 'var(--fs-2xl)' }}>
                            {logic.selectedProject.Property}
                            {logic.selectedProject.unit_type && <span style={{ fontSize: 'var(--fs-lg)', color: THEME.goldAccent, marginRight: '0.625rem' }}>- {logic.selectedProject.unit_type}</span>}
                        </h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', marginTop: '0.5rem', fontSize: 'var(--fs-sm)', fontWeight: 800, color: '#475569' }}>
                            {logic.selectedProject.engineer_in_charge && <span>المهندس المسئول: <strong style={{color: THEME.primary}}>{logic.selectedProject.engineer_in_charge}</strong></span>}
                            {logic.selectedProject.engineer_phone && <span>جوال: <strong style={{color: THEME.primary}}>{logic.selectedProject.engineer_phone}</strong></span>}
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#64748b', whiteSpace: 'nowrap' }}>تغيير حالة المشروع:</span>
                            <select 
                                value={logic.selectedProject.status || 'قيد الدراسة'}
                                onChange={(e) => logic.updateProjectStatus(e.target.value)}
                                style={{ 
                                    width: 'auto', minWidth: '10.5rem', flexShrink: 0,
                                    padding: '0.625rem 1rem', borderRadius: '12px', border: 'none', 
                                    fontWeight: 900, backgroundColor: 'white', color: THEME.primary, 
                                    boxShadow: '0 5px 15px rgba(0,0,0,0.05)', outline: 'none', cursor: 'pointer'
                                }}
                            >
                                <option value="قيد الدراسة">قيد الدراسة</option>
                                <option value="جاري تجهيز الموقع">جاري تجهيز الموقع</option>
                                <option value="قيد التنفيذ">قيد التنفيذ</option>
                                <option value="متوقف مؤقتا">متوقف مؤقتا</option>
                                <option value="متوقف">متوقف نهائياً</option>
                                <option value="منتهي">منتهي</option>
                            </select>
                        </div>

                        <button 
                            onClick={() => logic.setSelectedProject(null)} 
                            style={{ 
                                whiteSpace: 'nowrap', flexShrink: 0, minHeight: '2.625rem',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                padding: '0.625rem 1.25rem', borderRadius: '12px', border: 'none', 
                                fontWeight: 900, backgroundColor: '#475569', color: 'white', 
                                cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', transition: '0.3s' 
                            }}
                        >
                            العودة لقائمة المشاريع
                        </button>
                    </div>
                </div>

                {/* 🚀 إضافة زرار تاب المصروفات المباشرة هنا */}
                <div style={{ display: 'flex', gap: '0.625rem', marginBottom: '1.5625rem', overflowX: 'auto', paddingBottom: '0.625rem' }}>
                  <TabButton active={logic.activeTab === 'overview'} onClick={() => logic.setActiveTab('overview')} text="النظرة العامة و KPIs" />
                  <TabButton active={logic.activeTab === 'boq'} onClick={() => logic.setActiveTab('boq')} text="المقايسات والجدول الزمني" />
                  <TabButton active={logic.activeTab === 'expenses'} onClick={() => logic.setActiveTab('expenses')} text="المصروفات المباشرة" />
                  <TabButton active={logic.activeTab === 'materials'} onClick={() => logic.setActiveTab('materials')} text="الخامات المسحوبة" />
                  <TabButton active={logic.activeTab === 'financials'} onClick={() => logic.setActiveTab('financials')} text="المستخلصات والماليات" />
                  <TabButton active={logic.activeTab === 'qc'} onClick={() => logic.setActiveTab('qc')} text="الشوب دروينج والزيارات الميدانية 📐" />
                  <TabButton active={logic.activeTab === 'gallery'} onClick={() => logic.setActiveTab('gallery')} text="معرض صور الزيارات (للعميل) 📷" />
                  <TabButton active={logic.activeTab === 'bim'} onClick={() => logic.setActiveTab('bim')} text="النموذج الهندسي 3D BIM 🏛️" />
                  <TabButton active={logic.activeTab === 'reports'} onClick={() => logic.setActiveTab('reports')} text="التقارير الهندسية والمالية 📊" />
                </div>

                {/* 🚀 استدعاء المكونات (التابات) بناءً على النشط */}
                {logic.activeTab === 'overview' && <OverviewTab logic={logic} />}
                {logic.activeTab === 'boq' && <BoqTab logic={logic} setDeleteAlert={setDeleteAlert} />}
                {logic.activeTab === 'expenses' && <ExpensesTab logic={logic} />} {/* 👈 تاب المصروفات الجديد */}
                {logic.activeTab === 'materials' && <MaterialsTab logic={logic} />}
                {logic.activeTab === 'financials' && <FinancialsTab logic={logic} />}
                {logic.activeTab === 'qc' && <QcTab logic={logic} />}
                {logic.activeTab === 'gallery' && <VisitGalleryTab logic={logic} />}
                {logic.activeTab === 'bim' && <BimTab logic={logic} />}
                {logic.activeTab === 'reports' && <ReportsTab logic={logic} />}

              </div>
            )}

            <AddProjectModal logic={logic} mounted={mounted} />

            {/* 🚀 نافذة التأكيد الزجاجية (Custom Delete Modal) */}
            {mounted && deleteAlert.isOpen && createPortal(
                <div style={{ position: 'fixed', inset: 0, zIndex: 99999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)', direction: 'rtl' }}>
                    <div style={{ background: 'white', padding: '2.1875rem', borderRadius: '14px', maxWidth: '28.125rem', width: '90%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #fee2e2', animation: 'fadeIn 0.2s ease-out' }}>
                        <div style={{ fontSize: 'var(--fs-display)', marginBottom: '0.9375rem', animation: 'pulse-red 2s infinite' }}><TriangleAlert size={40} aria-hidden="true" /></div>
                        <h3 style={{ color: THEME.danger, fontWeight: 900, fontSize: 'var(--fs-2xl)', marginBottom: '0.9375rem' }}>{deleteAlert.title}</h3>
                        <p style={{ color: '#475569', fontSize: 'var(--fs-lg)', fontWeight: 800, marginBottom: '1.875rem', lineHeight: 1.6 }}>{deleteAlert.message}</p>
                        
                        <div style={{ display: 'flex', gap: '0.9375rem' }}>
                            <button 
                                onClick={() => {
                                    if (deleteAlert.type === 'project' && deleteAlert.id) logic.deleteProjectMutation.mutate(deleteAlert.id);
                                    if (deleteAlert.type === 'boq' && deleteAlert.id) logic.deleteBoqMutation.mutate(deleteAlert.id);
                                    setDeleteAlert({ isOpen: false, type: '', id: null, title: '', message: '' });
                                }} 
                                style={{ flex: 1, background: THEME.danger, color: 'white', padding: '0.875rem', borderRadius: '14px', border: 'none', fontWeight: 900, fontSize: 'var(--fs-lg)', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 10px rgba(239,68,68,0.3)' }}
                            >
                                نعم، تأكيد الحذف
                            </button>
                            <button 
                                onClick={() => setDeleteAlert({ isOpen: false, type: '', id: null, title: '', message: '' })} 
                                style={{ flex: 1, background: '#f1f5f9', color: '#64748b', padding: '0.875rem', borderRadius: '14px', border: 'none', fontWeight: 900, fontSize: 'var(--fs-lg)', cursor: 'pointer', transition: '0.2s' }}
                            >
                                إلغاء والتراجع
                            </button>
                        </div>
                    </div>
                    <style>{`
                        @keyframes pulse-red { 0% { transform: scale(0.95); } 50% { transform: scale(1.1); } 100% { transform: scale(0.95); } }
                    `}</style>
                </div>,
                document.body
            )}

        </MasterPage>
      </div>
    );
}