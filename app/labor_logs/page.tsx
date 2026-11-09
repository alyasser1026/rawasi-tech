"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom'; 
import { useLaborLogsLogic } from './labor_logs_logic';
import { THEME } from '@/lib/theme';
import { usePermissions } from '@/lib/PermissionsContext'; 
import SecureAction from '@/components/SecureAction';      
import SmartCombo from '@/components/SmartCombo'; 
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import RawasiSmartTable from '@/components/rawasismarttable';
import { supabase } from '@/lib/supabase';
import { normalizeArabicText } from '@/lib/helpers';
import LoadingScreen from '@/components/LoadingScreen';
import VoiceFormTrigger from '@/components/voice/VoiceFormTrigger';

export default function LaborLogsDirectory() {
  const logic = useLaborLogsLogic();
  const [mounted, setMounted] = useState(false);
  const { can, loading: permsLoading } = usePermissions();

  useEffect(() => { setMounted(true); }, []);

  // إضافة اختصار الحفظ (Ctrl + Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (logic.isAddModalOpen && e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (!logic.isSaving) logic.handleSaveLog();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [logic.isAddModalOpen, logic.isSaving, logic]);

  // اختصار لإضافة يومية جديدة (Alt + N)
  useEffect(() => {
    const handleAddShortcut = (e: KeyboardEvent) => {
      // Use e.code === 'KeyN' so it works even if the keyboard is in Arabic (where N is 'ى')
      if (!logic.isAddModalOpen && e.altKey && (e.code === 'KeyN' || e.key.toLowerCase() === 'n' || e.key === 'ى')) {
        e.preventDefault();
        logic.setEditingId(null);
        logic.setCurrentLog(logic.defaultLog);
        logic.setIsAddModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleAddShortcut);
    return () => window.removeEventListener('keydown', handleAddShortcut);
  }, [logic.isAddModalOpen, logic]);

  const isOneSelected = logic.selectedIds.length === 1;

  const allFilteredIds = useMemo(() => {
    return logic.filteredLogs.map((v: any) => String(v.id));
  }, [logic.filteredLogs]);

  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id: string) => logic.selectedIds.includes(id));

  const columns = useMemo(() => [
    {
      key: 'select',
      label: (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input 
                  type="checkbox" 
                  className="custom-checkbox"
                  checked={isAllSelected}
                  title="تحديد كل السجلات المفلترة"
                  onChange={() => {
                      if (isAllSelected) {
                          logic.setSelectedIds(logic.selectedIds.filter((id: string) => !allFilteredIds.includes(id)));
                      } else {
                          logic.setSelectedIds([...new Set([...logic.selectedIds, ...allFilteredIds])]);
                      }
                  }}
              />
          </div>
      ), 
      render: (row: any) => {
        if (!row) return null;
        const isSelected = logic.selectedIds.includes(String(row.id));
        return (
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'center' }}>
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
        );
      }
    },
    { 
      key: 'work_date', 
      label: 'التاريخ',
      render: (row: any) => {
        if (!row) return null; 
        return <span style={{ color: THEME.goldAccent, fontWeight: 900 }}>{row.work_date}</span>
      }
    },
    { 
      key: 'worker_name', 
      label: 'اسم العامل', 
      render: (row: any) => {
        if (!row) return null;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <b style={{ color: THEME.primary }}>{row.worker_name}</b>
            {row.worker_partner_id ? (
              <span 
                title={`معرف الشريك: ${row.worker_partner_id}`}
                style={{ 
                  fontSize: '10px', 
                  fontWeight: 900, 
                  padding: '1px 6px', 
                  borderRadius: '4px', 
                  backgroundColor: '#DCFCE7', 
                  color: '#166534',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  whiteSpace: 'nowrap'
                }}
              >
                ✓ ID
              </span>
            ) : (
              <span 
                title="اسم فقط بدون ربط بملف شريك مسجل"
                style={{ 
                  fontSize: '10px', 
                  fontWeight: 800, 
                  padding: '1px 6px', 
                  borderRadius: '4px', 
                  backgroundColor: '#FEF3C7', 
                  color: '#B45309',
                  whiteSpace: 'nowrap'
                }}
              >
                اسم فقط
              </span>
            )}
          </div>
        );
      }
    },
    { key: 'site_ref', label: 'الموقع', render: (row: any) => row?.site_ref || '-' },
    { key: 'work_item', label: 'البند', render: (row: any) => row?.work_item || '-' },
    { key: 'unit', label: 'الوحدة', render: (row: any) => row?.unit || '-' },
    { key: 'skill_level', label: 'المهارة', render: (row: any) => row?.skill_level || '-' },
    { key: 'production_desc', label: 'وصف الإنتاج', render: (row: any) => row?.production_desc || '-' },
    { key: 'tareeha', label: 'الطريحة', render: (row: any) => row?.tareeha || '-' },
    { key: 'productivity', label: 'الإنتاجية', render: (row: any) => row?.productivity || '-' },
    { 
      key: 'completion_percentage', 
      label: 'الإنجاز',
      render: (row: any) => row?.completion_percentage ? <span style={{ fontWeight: 800 }}>{row.completion_percentage}%</span> : '-'
    },
    { 
      key: 'daily_wage', 
      label: 'اليومية',
      render: (row: any) => row ? <span style={{ fontWeight: 900, color: '#059669', fontSize: 'var(--fs-md)' }}>{logic.formatCurrency(row.daily_wage || 0)}</span> : null
    },
    { 
      key: 'attendance_value', 
      label: 'الحضور',
      render: (row: any) => {
        if (!row) return null;
        const style = logic.getAttendanceStyle(String(row.attendance_value));
        return (
          <span className="glass-badge" style={{ backgroundColor: style.bg, color: style.color }}>
            {row.attendance_value === 1 ? 'يوم كامل' : row.attendance_value === 0.5 ? 'نصف يوم' : 'غياب'}
          </span>
        );
      }
    },
    { key: 'notes', label: 'ملاحظات', render: (row: any) => row?.notes || '-' },
    { 
      key: 'is_posted', 
      label: 'الحالة',
      render: (row: any) => {
        if (!row) return null;
        return (
          <span className="glass-badge" style={{ backgroundColor: row.is_posted ? '#ecfdf5' : '#fff7ed', color: row.is_posted ? '#059669' : '#d97706' }}>
            {row._offline_queued ? 'في الطابور' : (row.is_posted ? 'معتمد' : 'معلق')}
          </span>
        );
      }
    }
  ], [logic.selectedIds, isAllSelected, allFilteredIds, logic]); 

  const sidebarActions = useMemo(() => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
      <SecureAction module="labor_logs" action="create">
        <button className="btn-main-glass gold" onClick={() => {
            if (isOneSelected) {
                const logToEdit = logic.filteredLogs.find((l:any) => l.id === logic.selectedIds[0]);
                if (logToEdit) logic.handleEdit(logToEdit);
            } else {
                logic.setEditingId(null);
                logic.setCurrentLog(logic.defaultLog);
                logic.setIsAddModalOpen(true);
            }
        }}>
            {isOneSelected ? 'تعديل اليومية' : 'إضافة يومية جديدة'}
        </button>
      </SecureAction>
      
      {logic.selectedIds.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.3125rem', paddingTop: '0.9375rem', borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
          <p style={{fontSize:'var(--fs-xs)', textAlign:'center', color:'#94a3b8', fontWeight:900, marginBottom:'-0.3125rem'}}>الإجراءات على ({logic.selectedIds.length})</p>
          <SecureAction module="labor_logs" action="post">
            <button className="btn-main-glass green" onClick={logic.handlePostSelected}>اعتماد وترحيل</button>
          </SecureAction>
          <SecureAction module="labor_logs" action="post">
            <button className="btn-main-glass yellow" onClick={logic.handleSuspendSelected}>فك الترحيل</button>
          </SecureAction>
          <SecureAction module="labor_logs" action="delete">
            <button className="btn-main-glass red" onClick={logic.handleDeleteSelected}>حذف نهائي</button>
          </SecureAction>
        </div>
      )}

      <button className="btn-main-glass white" onClick={logic.exportToExcel}>تصدير إكسل</button>
      <button className="btn-main-glass white" onClick={() => window.print()}>طباعة الكشف</button>
    </div>
  ), [logic.selectedIds, isOneSelected, logic]); 
  
  return (
    <>
      <MasterPage title="يوميات العمالة" subtitle="إدارة الحضور والأجور والإنتاجية الميدانية">
        <RawasiSidebarManager 
          summary={
            <div className="summary-glass-card">
              <span style={{fontSize:'var(--fs-sm)', fontWeight:800, color:'#64748b'}}>إجمالي الأجور المحسوبة</span>
              <div className="val" style={{fontSize:'var(--fs-2xl)', fontWeight:900, color: THEME.goldAccent, marginTop:'0.3125rem'}}>
                {logic.formatCurrency(logic.stats.sum)}
              </div>
              <div style={{fontSize:'var(--fs-xs)', color:'#10b981', fontWeight:800, marginTop:'0.3125rem'}}>
                إجمالي السجلات: {logic.stats.count}
              </div>
            </div>
          }
          actions={sidebarActions}
          customFilters={
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.625rem' }}>
              <div>
                <label className="glass-label">بحث سريع:</label>
                <input 
                  type="text" 
                  placeholder="الاسم، الموقع، البند..." 
                  className="glass-input" 
                  value={logic.searchTerm} 
                  onChange={(e) => logic.setSearchTerm(e.target.value)} 
                />
              </div>

              <div>
                <label className="glass-label">تصفية حسب الحالة:</label>
                <div style={{ display: 'flex', gap: '0.3125rem' }}>
                  {['الكل', 'معتمد', 'معلق'].map(type => (
                    <button 
                      key={type} 
                      onClick={() => logic.setFilterStatus(type)} 
                      className={`filter-btn ${logic.filterStatus === type ? 'active' : ''}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="glass-label">عرض السجلات:</label>
                <select 
                  className="glass-input dark-select" 
                  value={logic.rowsPerPage} 
                  onChange={(e) => logic.setRowsPerPage(Number(e.target.value))}
                >
                  <option value={50}>50 سجل</option>
                  <option value={100}>100 سجل</option>
                  <option value={500}>500 سجل</option>
                </select>
              </div>
            </div>
          }
          watchDeps={[logic.selectedIds, logic.stats.sum, logic.filterStatus, logic.rowsPerPage]}
        />

        <style>{`
          .glass-label { color: white; fontSize: 12px; fontWeight: 900; display: block; marginBottom: 8px; }
          .glass-input { width: 100%; padding: 0.625rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white; font-weight: 800; outline: none; font-size: var(--fs-sm); }
          .filter-btn { flex: 1; padding: 0.5rem; border-radius: 8px; background: rgba(255,255,255,0.1); color: white; border: none; font-weight: 900; cursor: pointer; font-size: var(--fs-xs); transition: 0.3s; }
          .filter-btn.active { background: ${THEME.goldAccent}; color: #1e293b; }
          .dark-select option { color: #000; }
          .glass-badge { padding: 0.25rem 0.625rem; border-radius: 8px; font-size: var(--fs-xs); font-weight: 900; display: inline-block; }
          
          /* أنماط المودال */
          .modal-label { color: ${THEME.coffeeMain}; fontSize: 12px; fontWeight: 900; display: block; marginBottom: 8px; }
          .modal-input { padding: 0.875rem; border-radius: 12px; border: none; background: var(--surface-sunken); box-shadow: var(--shadow-sunken); color: var(--text-primary); width: 100%; font-weight: 800; outline: none; }
          .success-text { fontWeight: 900; color: ${THEME.success}; }
          .save-btn { flex: 2; background: ${THEME.coffeeDark}; color: white; padding: 1rem; border-radius: 15px; border: none; fontWeight: 900; cursor: pointer; fontSize: 16px; transition: 0.3s; }
          .cancel-btn { flex: 1; background: #f1f5f9; color: #64748b; padding: 1rem; border-radius: 15px; border: none; fontWeight: 900; cursor: pointer; transition: 0.3s; }
        `}</style>

        <div className="no-print">
          {logic.isLoading ? (
            <LoadingScreen message="جاري المزامنة مع فاي تك..." fullScreen={false} />
          ) : (
            <RawasiSmartTable 
              columns={columns} 
              data={logic.filteredLogs}
              enablePagination={true}
              currentPage={logic.currentPage}
              totalItems={logic.filteredLogs.length}
              rowsPerPage={logic.rowsPerPage}
              onPageChange={logic.setCurrentPage}
              onRowsChange={logic.setRowsPerPage}
            />
          )}
        </div>
      </MasterPage>

      {mounted && logic.isAddModalOpen && createPortal(
        <div className="phi-modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(39,39,42, 0.5)', backdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '5vh', paddingBottom: '5vh', overflowY: 'auto' }} onClick={() => logic.setIsAddModalOpen(false)}>
          <div className="cinematic-scroll phi-modal-panel" onClick={(e) => e.stopPropagation()} style={{ background: 'white', padding: '2.1875rem', borderRadius: '14px', width: '100%', maxWidth: '56.25rem', direction: 'rtl', boxShadow: '0 40px 100px rgba(0,0,0,0.5)', margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5625rem', borderBottom: `2px dashed ${THEME.goldAccent}`, paddingBottom: '0.9375rem' }}>
              <h2 style={{ fontWeight: 900, color: THEME.coffeeDark, margin: 0, fontSize: 'var(--fs-2xl)' }}>
                {logic.editingId ? 'تعديل بيانات اليومية' : 'إضافة يومية جديدة'}
              </h2>
              <VoiceFormTrigger
                modalType="labor_log"
                onFieldsParsed={(fields) => {
                  let matchedPartnerId = null;
                  let matchedSkill = undefined;
                  if (fields.worker_name) {
                    const normVoiceName = normalizeArabicText(fields.worker_name);
                    const matched = logic.workersList.find((w: any) => {
                      const normW = normalizeArabicText(w.name);
                      return normW === normVoiceName || normW.includes(normVoiceName) || normVoiceName.includes(normW);
                    });
                    if (matched) {
                      matchedPartnerId = matched.id;
                      matchedSkill = matched.job_role;
                    }
                  }
                  logic.setCurrentLog((prev: any) => ({
                    ...prev,
                    ...fields,
                    work_date: fields.work_date || prev.work_date,
                    worker_name: fields.worker_name || prev.worker_name,
                    worker_partner_id: matchedPartnerId || prev.worker_partner_id,
                    skill_level: matchedSkill || fields.skill_level || prev.skill_level,
                    site_ref: fields.site_ref || prev.site_ref,
                    work_item: fields.work_item || prev.work_item,
                    daily_wage: fields.daily_wage !== undefined ? Number(fields.daily_wage) : prev.daily_wage,
                    tareeha: fields.tareeha !== undefined ? Number(fields.tareeha) : prev.tareeha,
                    productivity: fields.productivity !== undefined ? Number(fields.productivity) : prev.productivity,
                    unit: fields.unit || prev.unit,
                    notes: fields.notes || prev.notes,
                  }));
                }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
               
               {/* الصف الأول */}
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.25rem', zIndex: 100 }}>
                 <div>
                    <label className="modal-label">التاريخ</label>
                    <input type="date" value={logic.currentLog.work_date || ''} onChange={e => logic.setCurrentLog({...logic.currentLog, work_date: e.target.value})} className="modal-input" />
                 </div>
                 <div>
                    <SmartCombo 
                      label="اسم العامل (ربط بملف الشريك) *" 
                      options={logic.workersList}
                      displayCol="name" 
                      searchCols="name,code,job_role,phone"
                      placeholder="اختر العامل من قائمة الشركاء أو اكتب الاسم..."
                      freeText={true} 
                      initialDisplay={logic.currentLog.worker_name} 
                      onSelect={(v: any) => {
                        if (!v) {
                          logic.setCurrentLog({ ...logic.currentLog, worker_name: '', worker_partner_id: null });
                          return;
                        }
                        if (typeof v === 'object') {
                          logic.setCurrentLog({
                            ...logic.currentLog,
                            worker_name: v.name || '',
                            worker_partner_id: v.id || null,
                            skill_level: v.job_role || logic.currentLog.skill_level || 'صنايعي',
                          });
                        } else {
                          const normStr = normalizeArabicText(v);
                          const matched = logic.workersList.find((w: any) => normalizeArabicText(w.name) === normStr);
                          logic.setCurrentLog({
                            ...logic.currentLog,
                            worker_name: v,
                            worker_partner_id: matched?.id || null,
                            skill_level: matched?.job_role || logic.currentLog.skill_level,
                          });
                        }
                      }} 
                    />
                    <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: 800 }}>
                      {logic.currentLog.worker_partner_id ? (
                        <span style={{ color: '#166534', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span>✓</span> تم ربط العامل بملف الشريك (ID: {String(logic.currentLog.worker_partner_id).slice(0, 8)}...)
                        </span>
                      ) : logic.currentLog.worker_name ? (
                        <span style={{ color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span>⚠️</span> اسم غير مربوط بمعرف شريك مسجل في صفحة الشركاء
                        </span>
                      ) : null}
                    </div>
                  </div>
               </div>

               {/* الصف الثاني المطور 🚀 */}
               <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1.5fr 1fr', gap: '1.25rem', zIndex: 90 }}>
                 <SmartCombo 
                     label="الموقع / العمارة" 
                     table="projects" 
                     displayCol="Property" 
                     searchCols="Property,project_name,project_code" 
                     freeText={false} 
                     strict={true} 
                     initialDisplay={logic.currentLog.site_ref} 
                     onSelect={(v:any) => logic.setCurrentLog({
                         ...logic.currentLog, 
                         site_ref: v?.Property || '', 
                         project_id: v?.id || null,
                         job_order_id: null,
                         work_item: '',
                         work_item_id: null,
                         unit: ''
                     })} 
                 />

                 <div style={{ position: 'relative' }}>
                     <SmartCombo 
                         label="أمر الشغل (ربط الميزانية) *" 
                         table="job_orders" 
                         displayCol="order_number" 
                         searchCols="order_number,notes" 
                         freeText={false} 
                         strict={true} 
                         filterColumn="project_id" 
                         filterValue={logic.currentLog.project_id}
                         customQuery={(q: any) => q.select('*, boq_budget:boq_budget_id(work_item)')}
                         displayFormat={(item: any) => `${item.order_number} - ${item.boq_budget?.work_item || 'بدون بند'}`}
                         key={(logic.currentLog.project_id || 'empty-jo') + '_job_order'} 
                         initialDisplay={logic.currentLog.job_order_display || (logic.currentLog.job_order_id ? (logic.currentLog.work_item ? `${logic.currentLog.work_item}` : 'أمر شغل مرتبط') : '')} 
                         onSelect={async (v:any) => {
                             if (!v) {
                                 logic.setCurrentLog((prev: any) => ({
                                     ...prev,
                                     job_order_id: null,
                                     job_order_display: '',
                                     work_item: '',
                                     work_item_id: null,
                                     unit: ''
                                 }));
                                 return;
                             }
                             const displayText = `${v.order_number || ''} - ${v.boq_budget?.work_item || 'بدون بند'}`;
                             let updates: any = {
                                 job_order_id: v?.id || null,
                                 job_order_display: displayText,
                                 work_item: v?.boq_budget?.work_item || '',
                                 unit: v?.boq_budget?.unit || ''
                             };
                             if (v?.boq_budget_id && (typeof navigator === 'undefined' || navigator.onLine)) {
                                 try {
                                     const { data } = await supabase.from('boq_budget_distinct').select('*').eq('id', v.boq_budget_id).single();
                                     if (data) {
                                         updates.work_item = data.work_item || updates.work_item;
                                         updates.work_item_id = data.boq_item_id;
                                         updates.unit = data.unit || updates.unit;
                                         if (data.tareeha) updates.tareeha = String(data.tareeha);
                                     }
                                 } catch { /* offline safe fallback */ }
                             }
                             logic.setCurrentLog((prev: any) => ({
                                 ...prev,
                                 ...updates,
                                 tareeha: updates.tareeha !== undefined ? updates.tareeha : prev.tareeha
                             }));
                         }} 
                     />
                     {!logic.currentLog.project_id && (
                         <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(255,255,255,0.5)', cursor: 'not-allowed' }} title="يرجى اختيار الموقع أولاً"></div>
                     )}
                 </div>

                 <div>
                    <label className="modal-label">البند (من المقايسة)</label>
                    <input 
                        type="text" 
                        placeholder="يسحب تلقائياً من أمر الشغل" 
                        readOnly 
                        value={logic.currentLog.work_item || ''} 
                        className="modal-input" 
                        style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
                    />
                 </div>

                 <div>
                    <label className="modal-label">الوحدة</label>
                    <input 
                        type="text" 
                        placeholder="تسحب تلقائياً" 
                        readOnly 
                        value={logic.currentLog.unit || ''} 
                        className="modal-input" 
                        style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
                    />
                 </div>
               </div>

               {/* الصف الثالث (حقول الإنتاج والطريحة) */}
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '1.25rem' }}>
                 <div>
                    <label className="modal-label">مستوى المهارة</label>
                    <input type="text" placeholder="معلم، مساعد..." value={logic.currentLog.skill_level || ''} onChange={e => logic.setCurrentLog({...logic.currentLog, skill_level: e.target.value})} className="modal-input" />
                 </div>
                 <div>
                    <label className="modal-label">وصف الإنتاج</label>
                    <input type="text" placeholder="تفاصيل العمل المنجز..." value={logic.currentLog.production_desc || ''} onChange={e => logic.setCurrentLog({...logic.currentLog, production_desc: e.target.value})} className="modal-input" />
                 </div>
                 <div>
                    <label className="modal-label">الطريحة (المستهدف)</label>
                    <input type="text" placeholder="مثال: 50" value={logic.currentLog.tareeha || ''} onChange={e => logic.setCurrentLog({...logic.currentLog, tareeha: e.target.value})} className="modal-input" />
                 </div>
               </div>

               {/* الصف الرابع (الإنتاجية والأجور) */}
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.9375rem' }}>
                 <div>
                    <label className="modal-label">الإنتاجية (المنفذ)</label>
                    <input type="text" placeholder="الكمية المنفذة فعلياً" value={logic.currentLog.productivity || ''} onChange={e => logic.setCurrentLog({...logic.currentLog, productivity: e.target.value})} className="modal-input" />
                 </div>
                 <div>
                    <label className="modal-label">نسبة الإنجاز (%)</label>
                    <input type="number" min="0" max="100" placeholder="100" value={logic.currentLog.completion_percentage || ''} onChange={e => logic.setCurrentLog({...logic.currentLog, completion_percentage: e.target.value})} className="modal-input" />
                 </div>
                 <div>
                    <label className="modal-label">الحضور</label>
                    <select value={logic.currentLog.attendance_value ?? 1} onChange={e => logic.setCurrentLog({...logic.currentLog, attendance_value: Number(e.target.value)})} className="modal-input">
                      <option value={1}>يوم كامل</option>
                      <option value={0.5}>نصف يوم</option>
                      <option value={0}>غياب</option>
                    </select>
                 </div>
                 <div>
                    <label className="modal-label">اليومية</label>
                    <input type="number" value={logic.currentLog.daily_wage || ''} onChange={e => logic.setCurrentLog({...logic.currentLog, daily_wage: e.target.value})} className="modal-input success-text" />
                 </div>
               </div>

               {/* الصف الخامس (ملاحظات ومقاول) */}
               <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr', gap: '1.25rem', zIndex: 80 }}>
                 <SmartCombo 
                    label="المقاول الباطن (اختياري)" 
                    table="partners" 
                    displayCol="name" 
                    freeText={false} 
                    strict={true} 
                    initialDisplay={logic.currentLog.sub_contractor || ''} 
                    onSelect={(v:any) => logic.setCurrentLog({...logic.currentLog, sub_contractor: v?.name || '', sub_contractor_id: v?.id || null})} 
                 />
                 <div>
                    <label className="modal-label">الملاحظات</label>
                    <input type="text" placeholder="أي ملاحظات عامة..." value={logic.currentLog.notes || ''} onChange={e => logic.setCurrentLog({...logic.currentLog, notes: e.target.value})} className="modal-input" />
                 </div>
               </div>

               {/* أزرار الحفظ */}
               <div className="responsive-actions" style={{ display: 'flex', gap: '0.9375rem', marginTop: '1.25rem' }}>
                 <button onClick={logic.handleSaveLog} disabled={logic.isSaving} className="save-btn" title="يمكنك أيضاً استخدام Ctrl + Enter للحفظ">
                   {logic.isSaving ? 'جاري الحفظ...' : 'حفظ مسودة اليومية'}
                 </button>
                 <button onClick={() => logic.setIsAddModalOpen(false)} className="cancel-btn">إلغاء</button>
               </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
