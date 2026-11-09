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
import LoadingScreen from '@/components/LoadingScreen';
import { Activity, Building2, CirclePause, Layers, TriangleAlert } from 'lucide-react';
import KpiStrip from '@/components/KpiStrip';

export default function AdvancedProjectsPage() {
    const logic = useProjectsLogic();
    const [mounted, setMounted] = useState(false);
    
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
            <button onClick={logic.resetFilters} className="btn-main-glass white">
                إعادة ضبط الفلاتر
            </button>
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
            
            .projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(18.125rem, 1fr)); gap: 1rem; }
            .project-card { background: rgba(255,255,255,0.7); backdrop-filter: blur(15px); border-radius: 14px; padding: 1.25rem; border: 1px solid rgba(255,255,255,0.8); transition: 0.3s; cursor: pointer; position: relative; overflow: hidden; }
            .project-card:hover { transform: translateY(-5px); box-shadow: 0 15px 35px rgba(0,0,0,0.08); border-color: ${THEME.goldAccent}; }
            .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px dashed rgba(0,0,0,0.05); fontSize: 12px; font-weight: 800; color: #475569; }
            .stat-row:last-child { border-bottom: none; }
            .stage-badge { position: absolute; top: 1.25rem; left: 1.25rem; background: linear-gradient(135deg, ${THEME.goldAccent}, #d97706); color: white; padding: 0.3125rem 0.75rem; border-radius: 8px; font-size: var(--fs-xs); font-weight: 900; box-shadow: 0 4px 10px rgba(217, 119, 6, 0.3); z-index: 2; }
          `}</style>

          {logic.isLoading ? (
               <LoadingScreen message="جاري تحميل بيانات المشاريع..." fullScreen={false} />
          ) : !logic.selectedProject ? (
               
               <div className="projects-grid" style={{ animation: 'fadeIn 0.5s ease-out' }}>
                   {logic.projects.map(proj => {
                       let timeProgress = 0;
                       if (proj.start_date && proj.end_date) {
                           const start = new Date(proj.start_date).getTime();
                           const end = new Date(proj.end_date).getTime();
                           const now = new Date().getTime();
                           if (now > end) timeProgress = 100;
                           else if (now > start) timeProgress = Math.round(((now - start) / (end - start)) * 100);
                       }

                       // 🚀 إظهار نسبة الإنجاز والتكلفة
                       const physicalProgress = Number(proj.overall_completion_percentage || 0).toFixed(1);
                       const totalActualCost = Number(proj.total_cost || 0);

                       return (
                           <div key={proj.id} className="project-card" onClick={() => logic.loadProjectDetails(proj)}>
                               {proj.current_stage && <div className="stage-badge">{proj.current_stage}</div>}

                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.9375rem' }}>
                                   <span style={{ fontSize: 'var(--fs-xs)', color: THEME.white, fontWeight: 900, backgroundColor: THEME.coffeeDark, padding: '0.25rem 0.625rem', borderRadius: '8px' }}>
                                       {proj.project_code || 'بدون كود'}
                                   </span>
                                   <StatusBadge status={proj.status || 'قيد الدراسة'} />
                               </div>
                               
                               <h3 style={{ margin: '0 0 0.3125rem 0', color: THEME.coffeeDark, fontWeight: 900, fontSize: 'var(--fs-xl)', paddingLeft: '5.625rem' }}>
                                   {proj.Property} 
                                   {proj.unit_type && <span style={{ fontSize: 'var(--fs-sm)', color: THEME.goldAccent, marginRight: '0.5rem' }}>({proj.unit_type})</span>}
                               </h3>
                               <p style={{ margin: '0 0 0.5rem 0', fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800 }}>العميل: {proj.client?.name || proj.client_name || '---'}</p>
                               
                               {(proj.engineer_in_charge || proj.engineer_phone) && (
                                  <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#334155', marginBottom: '0.9375rem', display: 'flex', justifyContent: 'space-between' }}>
                                      <span>{proj.engineer_in_charge || 'غير محدد'}</span>
                                      {proj.engineer_phone && <span>{proj.engineer_phone}</span>}
                                  </div>
                               )}

                               <div style={{ background: 'rgba(255,255,255,0.5)', padding: '0.9375rem', borderRadius: '16px', marginBottom: '1.25rem' }}>
                                   <div className="stat-row">
                                       <span>الميزانية المعتمدة:</span>
                                       <span style={{ color: THEME.primary, fontWeight: 900 }}>{formatCurrency(proj.estimated_budget || 0)}</span>
                                   </div>
                                   <div className="stat-row">
                                       <span>التكلفة الفعليّة (مواد+عمالة):</span>
                                       <span style={{ color: THEME.danger, fontWeight: 900 }}>{formatCurrency(totalActualCost)}</span>
                                   </div>
                               </div>

                               <div>
                                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', fontWeight: 900, color: THEME.coffeeDark, marginBottom: '0.5rem' }}>
                                       <span>نسبة الإنجاز الفعلي للموقع</span>
                                       <span>{physicalProgress}%</span>
                                   </div>
                                   <div style={{ height: '0.5rem', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                                       <div style={{ width: `${physicalProgress}%`, height: '100%', backgroundColor: Number(physicalProgress) === 100 ? THEME.success : THEME.goldAccent, borderRadius: '10px' }}></div>
                                   </div>
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

          ) : logic.isDetailsLoading ? (
               <LoadingScreen message="جاري سحب الهيكل الهندسي والمالي للعقار..." fullScreen={false} />
          ) : (
              <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5625rem', background: 'rgba(255,255,255,0.4)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.5)' }}>
                    <div>
                        <h2 style={{ margin: 0, fontWeight: 900, color: THEME.coffeeDark, fontSize: 'var(--fs-2xl)' }}>
                            {logic.selectedProject.Property}
                            {logic.selectedProject.unit_type && <span style={{ fontSize: 'var(--fs-lg)', color: THEME.goldAccent, marginRight: '0.625rem' }}>- {logic.selectedProject.unit_type}</span>}
                        </h2>
                        <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.625rem', fontSize: 'var(--fs-sm)', fontWeight: 800, color: '#475569' }}>
                            {logic.selectedProject.engineer_in_charge && <span>المهندس المسئول: <strong style={{color: THEME.primary}}>{logic.selectedProject.engineer_in_charge}</strong></span>}
                            {logic.selectedProject.engineer_phone && <span>جوال: <strong style={{color: THEME.primary}}>{logic.selectedProject.engineer_phone}</strong></span>}
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.9375rem', alignItems: 'center' }}>
                        <button 
                            onClick={() => logic.setSelectedProject(null)} 
                            style={{ padding: '0.625rem 1.25rem', borderRadius: '12px', border: 'none', fontWeight: 900, backgroundColor: '#475569', color: 'white', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', transition: '0.3s' }}
                        >
                            العودة لقائمة المشاريع
                        </button>

                        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#64748b' }}>تغيير حالة المشروع:</span>
                        <select 
                            value={logic.selectedProject.status || 'قيد الدراسة'}
                            onChange={(e) => logic.updateProjectStatus(e.target.value)}
                            style={{ 
                                padding: '0.625rem 1.25rem', borderRadius: '12px', border: 'none', 
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