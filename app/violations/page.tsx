"use client";
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useViolationsLogic } from './violations_logic'; 
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import { usePermissions } from '@/lib/PermissionsContext'; 
import SecureAction from '@/components/SecureAction';      
import SmartCombo from '@/components/SmartCombo'; 
import JobOrderSelector from '@/components/JobOrderSelector';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import RawasiSmartTable from '@/components/rawasismarttable';
import LoadingScreen from '@/components/LoadingScreen';
import { Pencil } from 'lucide-react';
import TelegramAttachmentField, { AttachmentViewButton } from '@/components/TelegramAttachmentField';
import { notify } from '@/lib/notify';
import VoiceFormTrigger from '@/components/voice/VoiceFormTrigger';
import SendPartnerMessageButton from '@/components/SendPartnerMessageButton';

export default function ViolationsPage() {
  const logic = useViolationsLogic();
  const [mounted, setMounted] = useState(false);
  const { can, loading: permsLoading } = usePermissions();




  
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  useEffect(() => { setMounted(true); }, []);

  const allFilteredIds = useMemo(() => logic.data.map((v: any) => String(v.id)), [logic.data]);
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id: string) => logic.state.selectedIds.includes(id));

  const columns = useMemo(() => [
    {
      key: 'select',
      label: (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input type="checkbox" className="custom-checkbox" checked={isAllSelected}
                  onChange={() => {
                      if (isAllSelected) logic.actions.setSelectedIds(logic.state.selectedIds.filter((id: string) => !allFilteredIds.includes(id)));
                      else logic.actions.setSelectedIds([...new Set([...logic.state.selectedIds, ...allFilteredIds])]);
                  }}
              />
          </div>
      ), 
      render: (row: any) => {
        if (!row) return null;
        const isSelected = logic.state.selectedIds.includes(String(row.id));
        return (
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'center' }}>
              <input type="checkbox" className="custom-checkbox" checked={isSelected} 
                  onChange={(e) => {
                      e.stopPropagation();
                      if (isSelected) logic.actions.setSelectedIds(logic.state.selectedIds.filter((i:any) => i !== String(row.id))); 
                      else logic.actions.setSelectedIds([...logic.state.selectedIds, String(row.id)]); 
                  }} 
              />
          </div>
        );
      }
    },
    { 
      key: 'date',
      header: 'التاريخ', 
      render: (row: any) => row?.date ? <span style={{ color: '#64748b', fontWeight: 900 }}>{row.date}</span> : null
    },
    { 
      key: 'emp_name',
      header: 'الموظف / العامل', 
      render: (row: any) => row?.emp_name ? <b style={{ color: THEME.primary }}>{row.emp_name}</b> : null
    },
    { 
      key: 'violation_type',
      header: 'نوع الخصم', 
      render: (row: any) => {
          const type = row?.violation_type || 'غرامة';
          const bg = type === 'غرامة' ? '#fef2f2' : '#fff7ed';
          const fg = type === 'غرامة' ? '#ef4444' : '#d97706';
          return <span style={{ background: bg, color: fg, padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: 'var(--fs-xs)', fontWeight: 900 }}>{type}</span>;
      }
    },
    { 
      key: 'reason',
      header: 'البيان الوصفي', 
      render: (row: any) => row?.reason ? <span style={{ color: '#334155', fontWeight: 800 }}>{row.reason}</span> : null
    },
    { 
      key: 'image_url',
      header: 'المرفق', 
      render: (row: any) => {
        return <AttachmentViewButton url={row?.image_url} label="المرفق" title={`مخالفة ${row?.emp_name || ''}`} />;
      } 
    },
    { 
      key: 'amount',
      header: 'المبلغ', 
      render: (row: any) => <span style={{ fontWeight: 900, color: THEME.ruby, fontSize: 'var(--fs-lg)' }}>{formatCurrency(row?.amount || 0)}</span>
    },
    {
      key: 'is_posted',
      header: 'الحالة',
      render: (row: any) => {
        if (!row) return null;
        return row.is_posted ? <span className="badge-glass green">معتمد</span> : <span className="badge-glass yellow">معلق</span>;
      }
    },
    {
      key: 'actions',
      header: 'إجراء',
      render: (row: any) => {
        if (!row) return null;
        return (
          <div style={{ display: 'inline-flex', gap: '0.375rem', alignItems: 'center' }}>
            {can('violations', 'edit') && !row.is_posted ? (
              <button onClick={(e) => { e.stopPropagation(); logic.actions.handleEdit(row); }} className="btn-glass-print"><Pencil size={16} aria-hidden="true" /></button>
            ) : <span style={{color:'#94a3b8', fontSize:'var(--fs-xs)', fontWeight: 900}}>مقفل</span>}
            <SendPartnerMessageButton
              partnerId={row.partner_id}
              partnerName={row.partner?.name || row.emp_name}
              operation={{
                type: 'violation',
                date: row.date,
                project: row.project?.Property,
                amount: row.amount,
                description: row.reason,
                status: row.is_posted ? 'معتمد' : 'معلق',
                extraLines: [
                  { label: 'نوع الخصم / الجزاء', value: row.violation_type || 'غرامة' },
                ],
              }}
            />
          </div>
        );
      }
    }
  ], [can, logic.actions, isAllSelected, allFilteredIds, logic.state.selectedIds]);

  const sidebarActions = useMemo(() => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
      <SecureAction module="violations" action="create">
        <button className="btn-main-glass gold" onClick={() => logic.actions.handleEdit()}>تسجيل خصم / غرامة</button>
      </SecureAction>
      
      {logic.state.selectedIds.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.3125rem', paddingTop: '0.9375rem', borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
          <p style={{fontSize:'var(--fs-xs)', textAlign:'center', color:'#94a3b8', fontWeight:900, margin:0}}>تم تحديد ({logic.state.selectedIds.length}) سجل</p>
          <SecureAction module="violations" action="post">
            <button className="btn-main-glass green" onClick={logic.actions.handlePost}>ترحيل للرواتب</button>
          </SecureAction>
          <SecureAction module="violations" action="post">
            <button className="btn-main-glass yellow" onClick={logic.actions.handleUnpost}>فك الترحيل</button>
          </SecureAction>
          <SecureAction module="violations" action="delete">
            <button className="btn-main-glass red" onClick={logic.actions.handleDelete}>حذف نهائي</button>
          </SecureAction>
        </div>
      )}
    </div>
  ), [logic.state.selectedIds, logic.actions]);


  return (
    <>
      <div className="clean-page">
        <MasterPage title="سجل الاستقطاعات والجزاءات" subtitle="تسجيل الغرامات الإدارية، واستقطاعات الإعاشة وتوجيهها للرواتب.">
            <RawasiSidebarManager 
              summary={
                <div className="summary-glass-card">
                  <span style={{fontSize:'var(--fs-sm)', fontWeight:800, color:'#64748b'}}>إجمالي المبالغ المفلترة</span>
                  <div className="val" style={{fontSize:'var(--fs-2xl)', fontWeight:900, color: THEME.ruby, marginTop:'0.3125rem'}}>{formatCurrency(logic.totals.totalSum)}</div>
                  <div style={{fontSize:'var(--fs-xs)', color:'#10b981', fontWeight:800, marginTop:'0.3125rem'}}>عدد السجلات: {logic.totals.totalCount}</div>
                </div>
              }
              actions={sidebarActions}
              customFilters={
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem', marginTop: '0.625rem' }}>
                  <div>
                    <label style={{ color: 'white', fontSize: 'var(--fs-xs)', fontWeight: 900, display: 'block', marginBottom: '0.5rem' }}>الحالة:</label>
                    <div style={{ display: 'flex', gap: '0.3125rem' }}>
                      {['الكل', 'معتمد', 'معلق'].map(type => (
                        <button key={type} onClick={() => { logic.actions.setFilterStatus(type); setCurrentPage(1); }} className={`filter-btn ${logic.state.filterStatus === type ? 'active' : ''}`}>{type}</button>
                      ))}
                    </div>
                  </div>
                </div>
              }
              onSearch={(val) => { logic.actions.setGlobalSearch(val); setCurrentPage(1); }} 
              watchDeps={[logic.state.selectedIds, logic.totals.totalSum, logic.state.filterStatus]}
            />

            <style>{`
              .custom-checkbox { width: 1.25rem; height: 1.25rem; accent-color: ${THEME.goldAccent}; cursor: pointer; transition: 0.1s; }
              .btn-main-glass { width: 100%; padding: 0.875rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(15px); font-weight: 900; cursor: pointer; transition: 0.2s; font-size: var(--fs-sm); display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
              .btn-main-glass.gold { background: linear-gradient(135deg, rgba(194,65,12, 0.9), rgba(194,65,12, 1)); color: white; }
              .btn-main-glass.green { background: linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.9)); color: white; }
              .btn-main-glass.yellow { background: linear-gradient(135deg, rgba(245, 158, 11, 0.8), rgba(217, 119, 6, 0.9)); color: white; }
              .btn-main-glass.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
              .btn-main-glass:hover { transform: translateY(-3px); filter: brightness(1.1); }
              .summary-glass-card { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 1.25rem; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.2); margin-bottom: 1.5625rem; }
              .filter-btn { flex: 1; padding: 0.5rem; border-radius: 8px; background: rgba(255,255,255,0.1); color: white; border: none; font-weight: 900; cursor: pointer; font-size: var(--fs-xs); transition: 0.3s; }
              .filter-btn.active { background: ${THEME.goldAccent}; color: #1e293b; }
              .badge-glass { padding: 0.25rem 0.625rem; border-radius: 8px; font-size: var(--fs-xs); font-weight: 900; display: inline-block; }
              .badge-glass.green { background: #ecfdf5; color: #059669; }
              .badge-glass.yellow { background: #fff7ed; color: #d97706; }
              .btn-glass-print { background: rgba(0, 0, 0, 0.03); border: 1px solid rgba(0, 0, 0, 0.1); padding: 0.5rem 0.875rem; border-radius: 12px; cursor: pointer; transition: 0.2s; }
              .btn-glass-print:hover { background: rgba(0,0,0,0.08); transform: translateY(-2px); }
              
              /* Radio Button Styles */
              .type-selector { display: flex; gap: 0.625rem; background: var(--surface-sunken); padding: 0.625rem; border-radius: 14px; border: none; box-shadow: var(--shadow-sunken); }
              .type-radio { flex: 1; position: relative; cursor: pointer; }
              .type-radio input { position: absolute; opacity: 0; cursor: pointer; }
              .type-label { display: block; padding: 0.75rem 0.625rem; text-align: center; border-radius: 10px; font-size: var(--fs-sm); font-weight: 900; color: #64748b; cursor: pointer; transition: 0.2s; border: 2px solid transparent; }
              .type-radio input:checked + .type-label.penalty { background: #fef2f2; color: #ef4444; border-color: #fca5a5; }
              .type-radio input:checked + .type-label.housing { background: #fff7ed; color: #d97706; border-color: #fcd34d; }
            `}</style>

            {(logic.isLoading || permsLoading) ? (
              <LoadingScreen message="جاري المزامنة..." fullScreen={false} />
            ) : (
              <RawasiSmartTable data={logic.data} columns={columns} enablePagination={true} currentPage={currentPage} totalItems={logic.data.length} rowsPerPage={rowsPerPage} onPageChange={setCurrentPage} />
            )}
        </MasterPage>
      </div>

      {mounted && logic.state.isEditModalOpen && logic.state.editingRecord && typeof document !== 'undefined' && createPortal(
        <div className="phi-modal-backdrop modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100dvh', backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 999999, padding: '5vh 1.25rem', overflowY: 'auto' }}>
          <div className="phi-modal-panel cinematic-scroll" style={{ background: 'white', padding: '2.1875rem', borderRadius: '14px', width: '100%', maxWidth: '40.625rem', direction: 'rtl', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', margin: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.9375rem', borderBottom: '2px dashed #f1f5f9', gap: '0.625rem', flexWrap: 'wrap' }}>
                <h3 style={{fontWeight:900, fontSize:'var(--fs-xl)', color: THEME.primary, margin: 0}}>تسجيل حركة خصم / استقطاع</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <VoiceFormTrigger
                        modalType="violation"
                        label="تسجيل مخالفة بالصوت"
                        onFieldsParsed={(fields) => {
                            logic.state.setEditingRecord((prev: any) => ({
                                ...prev,
                                ...fields,
                                amount: fields.amount !== undefined ? Number(fields.amount) : prev.amount,
                                reason: fields.reason || fields.description || prev.reason,
                                notes: fields.notes || prev.notes,
                            }));
                        }}
                    />
                    <button onClick={() => { logic.state.setIsEditModalOpen(false); }} style={{ background: '#f1f5f9', border: 'none', width: '2.1875rem', height: '2.1875rem', borderRadius: '50%', cursor: 'pointer', fontWeight: 900, color: '#64748b' }}>✕</button>
                </div>
            </div>
            
            {/* 🎯 أزرار اختيار نوع الحركة (تم إزالة السلف) */}
            <div style={{ marginBottom: '1.5625rem' }}>
                <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>حدد طبيعة الخصم (للتوجيه المحاسبي):</label>
                <div className="type-selector">
                    <label className="type-radio">
                        <input type="radio" name="v_type" checked={logic.state.editingRecord.violation_type === 'غرامة'} onChange={() => logic.state.setEditingRecord({...logic.state.editingRecord, violation_type: 'غرامة'})} />
                        <span className="type-label penalty">غرامة / جزاء</span>
                    </label>
                    <label className="type-radio">
                        <input type="radio" name="v_type" checked={logic.state.editingRecord.violation_type === 'استقطاع سكن'} onChange={() => logic.state.setEditingRecord({...logic.state.editingRecord, violation_type: 'استقطاع سكن'})} />
                        <span className="type-label housing">استرداد سكن / إعاشة</span>
                    </label>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(15.625rem, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#64748b', display: 'block', marginBottom: '0.5rem' }}>تاريخ الاستقطاع</label>
                <input type="date" value={logic.state.editingRecord.date || ''} onChange={(e) => logic.state.setEditingRecord({...logic.state.editingRecord, date: e.target.value})} style={{ padding: '0.875rem', borderRadius: '14px', border: 'none', boxShadow: 'var(--shadow-sunken)', width: '100%', fontWeight: 800, outline: 'none', background: 'var(--surface-sunken)', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ zIndex: 100 }}>
                <SmartCombo 
                    label="الموظف / العامل" 
                    table="partners"
                    displayCol="name"
                    freeText={true} 
                    initialDisplay={logic.state.editingRecord.emp_name} 
                    onSelect={(v:any) => logic.actions.handleEmployeeSelect(v)} 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(15.625rem, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#64748b', display: 'block', marginBottom: '0.5rem' }}>المهنة</label>
                <input type="text" value={logic.state.editingRecord.profession || ''} readOnly style={{ padding: '0.875rem', borderRadius: '14px', border: 'none', boxShadow: 'var(--shadow-sunken)', width: '100%', fontWeight: 800, outline: 'none', background: 'var(--surface-sunken)', color: 'var(--text-primary)', opacity: 0.7 }} placeholder="تُسحب تلقائياً..." />
              </div>
              <div style={{ zIndex: 90 }}>
                <SmartCombo 
                    label="الموقع (مركز التكلفة)" 
                    table="projects"
                    displayCol="Property"
                    initialDisplay={logic.state.editingRecord.site_name} 
                    onSelect={(v:any) => logic.state.setEditingRecord({...logic.state.editingRecord, site_name: v?.Property, project_id: v?.id, job_order_id: null})} 
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem', position: 'relative', zIndex: 80 }}>
              {/* الفيلا ← أوامر الشغل بتاعتها: الجزاء بيتحمّل على أمر الشغل */}
              <JobOrderSelector
                  projectId={logic.state.editingRecord.project_id || null}
                  value={logic.state.editingRecord.job_order_id || null}
                  onChange={(id) => logic.state.setEditingRecord((prev: any) => ({ ...prev, job_order_id: id }))}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#64748b', display: 'block', marginBottom: '0.5rem' }}>البيان الوصفي (السبب)</label>
                <input type="text" placeholder="مثال: خصم إيجار سكن شهر مايو" value={logic.state.editingRecord.reason || ''} onChange={(e) => logic.state.setEditingRecord({...logic.state.editingRecord, reason: e.target.value})} style={{ padding: '0.875rem', borderRadius: '14px', border: 'none', boxShadow: 'var(--shadow-sunken)', width: '100%', fontWeight: 800, outline: 'none', background: 'var(--surface-sunken)', color: 'var(--text-primary)' }} />
            </div>

            <div style={{ marginBottom: '1.875rem' }}>
                <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.ruby, display: 'block', marginBottom: '0.5rem' }}>قيمة المبلغ المخصوم</label>
                <input type="number" value={logic.state.editingRecord.amount || ''} onChange={(e) => logic.state.setEditingRecord({...logic.state.editingRecord, amount: Number(e.target.value)})} style={{ padding: '0.875rem', borderRadius: '14px', border: `2px solid ${THEME.ruby}40`, width: '100%', fontWeight: 900, outline: 'none', background: '#fef2f2', color: THEME.ruby, fontSize: 'var(--fs-xl)' }} />
            </div>

            <div style={{ marginBottom: '1.875rem' }}>
              <TelegramAttachmentField
                module="violations"
                value={logic.state.editingRecord.image_url || null}
                onChange={(url) =>
                  logic.state.setEditingRecord({
                    ...logic.state.editingRecord,
                    image_url: url,
                  })
                }
                label="صورة إثبات المخالفة أو المستند المرفق"
                caption={`مخالفة: ${logic.state.editingRecord.emp_name || ''} - ${logic.state.editingRecord.reason || ''}`}
                allowStamp={true}
                stampContext={{
                  buildingName: logic.state.editingRecord.site_name || '',
                  boqItem: logic.state.editingRecord.violation_type || 'مخالفة',
                  capturedBy: logic.state.editingRecord.emp_name || '',
                }}
              />
            </div>

            <div className="responsive-actions" style={{ display: 'flex', gap: '0.9375rem', marginTop: '0.625rem' }}>
              <button onClick={logic.actions.handleSave} disabled={logic.isLoading} style={{ flex: 2, background: THEME.ruby, color: 'white', padding: '1.125rem', borderRadius: '16px', border: 'none', fontWeight: 900, opacity: logic.isLoading ? 0.7 : 1 }}>
                  {logic.isLoading ? 'جاري التسجيل...' : 'اعتماد الخصم والتوجيه المحاسبي'}
              </button>
              <button onClick={() => { logic.state.setIsEditModalOpen(false); }} style={{ flex: 1, background: '#f1f5f9', color: '#475569', padding: '1.125rem', borderRadius: '16px', border: 'none', fontWeight: 900 }}>
                  إلغاء
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}