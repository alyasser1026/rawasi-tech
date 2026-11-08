"use client";
import React, { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useBackupLogic } from './backup_logic'; 
import { useRestoreLogic } from './restore_logic'; 
import PermissionsMatrix from './PermissionsMatrix';
import SystemHealthRadar from './SystemHealthRadar';
import AuditLogs from './AuditLogs';
import BotSettingsManager from './BotSettingsManager';
import FactoryResetManager from './FactoryResetManager';

import RawasiSidebarManager from '@/components/RawasiSidebarManager'; 
import MasterPage from '@/components/MasterPage';
import GlassContainer from '@/components/GlassContainer';
import { THEME } from '@/lib/theme'; 
import { Package, ChartColumn, Wrench, ShieldCheck, Download, RefreshCw, Settings, Files, FolderOpen, TriangleAlert } from 'lucide-react';

// 🗺️ خريطة الجداول لتسهيل التحديد (تم تحديثها لتشمل كافة الجداول في الـ Schema)
const TABLE_GROUPS = [
  {
    name: "الموارد البشرية والشركاء",
    tables: [
      { id: 'partners', name: 'دليل الشركاء والموظفين' },
      { id: 'all_emp', name: 'سجل الموظفين الشامل' },
      { id: 'payroll_slips', name: 'مسيرات الرواتب' },
      { id: 'violations', name: 'سجل المخالفات والجزاءات' },
    ]
  },
  {
    name: "المشاريع والعمليات الميدانية",
    tables: [
      { id: 'projects', name: 'بيانات المشاريع والمواقع' },
      { id: 'project_stages', name: 'مراحل إنجاز المشاريع' },
      { id: 'project_work_structure', name: 'هيكل أعمال المشاريع' },
      { id: 'job_orders', name: 'أوامر الشغل' },
      { id: 'boq_items', name: 'بنود المقايسات (BOQ)' },
      { id: 'boq_budget', name: 'ميزانية المقايسات' },
      { id: 'contractor_assignments', name: 'إسنادات مقاولي الباطن' },
      { id: 'sub_claims', name: 'مستخلصات مقاولي الباطن' },
      { id: 'labor_daily_logs', name: 'يوميات العمالة الميدانية' },
    ]
  },
  {
    name: "المالية والمحاسبة",
    tables: [
      { id: 'accounts', name: 'دليل شجرة الحسابات' },
      { id: 'expenses', name: 'المصروفات العامة' },
      { id: 'invoices', name: 'فواتير ومطالبات العملاء' },
      { id: 'payment_vouchers', name: 'سندات الصرف' },
      { id: 'receipt_vouchers', name: 'سندات القبض' },
      { id: 'journal_headers', name: 'رؤوس القيود المحاسبية' },
      { id: 'journal_lines', name: 'تفاصيل القيود المحاسبية' },
      { id: 'journal_errors', name: 'سجل أخطاء القيود' },
      { id: 'sys_financial_reports', name: 'القوائم المالية المخبأة' },
    ]
  },
  {
    name: "المخازن والإمداد",
    tables: [
      { id: 'inventory', name: 'مخازن المواد والخامات' },
      { id: 'material_receipts', name: 'سندات استلام الخامات' },
      { id: 'material_receipt_lines', name: 'تفاصيل استلام الخامات' },
      { id: 'material_issues', name: 'سندات صرف الخامات' },
      { id: 'material_issue_lines', name: 'تفاصيل صرف الخامات' },
    ]
  },
  {
    name: "إعدادات النظام والمستخدمين",
    tables: [
      { id: 'profiles', name: 'حسابات وصلاحيات المستخدمين' },
      { id: 'system_settings', name: 'إعدادات النظام العامة' },
      { id: 'user_requests', name: 'طلبات المستخدمين' },
      { id: 'user_tasks', name: 'المهام الإدارية' },
      { id: 'notifications', name: 'سجل التنبيهات والإشعارات' },
    ]
  }
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('backup'); 
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState({ text: '', type: '' }); 

  const { backupToExcel, backupToJSON, downloadTemplate } = useBackupLogic();
  const { processExcelRestore } = useRestoreLogic();

  const toggleTable = (id: string) => {
      setSelectedTables(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const selectGroup = (tableIds: string[]) => {
      const allSelected = tableIds.every(id => selectedTables.includes(id));
      if (allSelected) {
          setSelectedTables(prev => prev.filter(id => !tableIds.includes(id))); 
      } else {
          setSelectedTables(prev => Array.from(new Set([...prev, ...tableIds]))); 
      }
  };

  const selectAllTables = () => {
      const allIds = TABLE_GROUPS.flatMap(g => g.tables.map(t => t.id));
      setSelectedTables(selectedTables.length === allIds.length ? [] : allIds);
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    setUploadMsg({ text: 'جاري تحليل الملف وربط المعرفات الذكية...', type: 'loading' });

    try {
      await processExcelRestore(selectedFile);
      setUploadMsg({ text: 'تم الاستيراد بنجاح! تم تطبيق الحماية ضد التكرار.', type: 'success' });
      setSelectedFile(null); 
      setTimeout(() => setUploadMsg({ text: '', type: '' }), 5000);
    } catch (err: any) {
      setUploadMsg({ text: `فشل: ${err.message || 'تأكد من استخدام النماذج المعتمدة.'}`, type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const selectedCount = selectedTables.length;

  const sidebarContent = useMemo(() => {
      let summary = null;
      let actions = null;

      if (activeTab === 'backup') {
          summary = (
              <div className="sidebar-summary-glass">
                  <div className="icon-pulse"><Package size={16} aria-hidden="true" /></div>
                  <p className="summary-title">الجداول المحددة</p>
                  <h3 className="summary-value">{selectedCount}</h3>
              </div>
          );
          actions = (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
                  <button 
                      onClick={() => backupToExcel(selectedTables)} 
                      disabled={selectedCount === 0 || isUploading}
                      className={`btn-premium-glass excel ${selectedCount === 0 ? 'disabled' : ''}`}
                  >
                      <span className="btn-icon"><ChartColumn size={16} aria-hidden="true" /></span> تصدير Excel
                  </button>
                  <button 
                      onClick={() => backupToJSON(selectedTables)} 
                      disabled={selectedCount === 0 || isUploading}
                      className={`btn-premium-glass json ${selectedCount === 0 ? 'disabled' : ''}`}
                  >
                      <span className="btn-icon"><Wrench size={16} aria-hidden="true" /></span> تصدير JSON
                  </button>
              </div>
          );
      } else {
          summary = (
              <div className="sidebar-summary-glass info">
                  <div className="icon-pulse"><ShieldCheck size={16} aria-hidden="true" /></div>
                  <p className="summary-title" style={{color: '#3b82f6'}}>إعدادات النظام</p>
              </div>
          );
      }

      return { summary, actions };
  }, [activeTab, selectedCount, selectedTables, backupToExcel, backupToJSON, isUploading]);

  return (
    <MasterPage title="إعدادات النظام والنسخ الاحتياطي" hideTitleOnMobile={true}>
      
      <RawasiSidebarManager 
          summary={sidebarContent.summary}
          actions={sidebarContent.actions}
          watchDeps={[activeTab, selectedCount, isUploading]} 
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.875rem', animation: 'fadeUp 0.5s ease-out' }}>
        
        <div style={{ display: 'flex', gap: '0.9375rem', overflowX: 'auto', paddingBottom: '0.625rem' }}>
          <button className={`tab-btn ${activeTab === 'permissions' ? 'active' : ''}`} onClick={() => setActiveTab('permissions')}>
            مصفوفة الصلاحيات
          </button>
          <button className={`tab-btn ${activeTab === 'backup' ? 'active' : ''}`} onClick={() => setActiveTab('backup')}>
            إدارة البيانات والنماذج
          </button>
          <button className={`tab-btn ${activeTab === 'health' ? 'active' : ''}`} onClick={() => setActiveTab('health')}>
            فحص الاتصال والتخزين
          </button>
          <button className={`tab-btn ${activeTab === 'bot' ? 'active' : ''}`} onClick={() => setActiveTab('bot')}>🤖 إعدادات البوت الذكي</button>
          <button className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
            سجل المراقبة
          </button>
          <button
            className={`tab-btn ${activeTab === 'factory_reset' ? 'active' : ''}`}
            onClick={() => setActiveTab('factory_reset')}
            style={activeTab === 'factory_reset' ? { background: '#dc2626', borderColor: '#dc2626', color: 'white', boxShadow: '0 4px 15px rgba(220, 38, 38, 0.3)' } : { color: '#dc2626', borderColor: '#fca5a5' }}
          >
            ⚠️ إعادة ضبط المصنع
          </button>
        </div>

        {activeTab === 'permissions' && <PermissionsMatrix />}
        
        {activeTab === 'health' && <SystemHealthRadar />}

        {activeTab === 'audit' && <AuditLogs />}

        {activeTab === 'bot' && <BotSettingsManager />}

        {activeTab === 'factory_reset' && <FactoryResetManager />}

        {activeTab === 'backup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(18.75rem, 2fr) minmax(15.625rem, 1fr)', gap: '1.875rem', alignItems: 'start' }}>
            
            <GlassContainer>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5625rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.9375rem', flexWrap: 'wrap', gap: '0.625rem' }}>
                <div>
                  <h2 style={{ fontSize: 'var(--fs-xl)', color: THEME.primary, margin: '0 0 0.3125rem 0', fontWeight: 900 }}>بنية النظام والجداول</h2>
                  <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 700 }}>حدد الجداول لتصديرها أو تحميل قوالب الإدخال.</p>
                </div>
                <button onClick={selectAllTables} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 900, color: THEME.primary, transition: '0.2s', fontSize: 'var(--fs-sm)' }}>
                  {selectedCount === TABLE_GROUPS.flatMap(g => g.tables).length ? 'إلغاء الكل' : 'تحديد الكل'}
                </button>
              </div>

              <div className="cinematic-scroll" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(15.625rem, 1fr))', gap: '1.25rem', maxHeight: '37.5rem', overflowY: 'auto', paddingRight: '0.3125rem' }}>
                {TABLE_GROUPS.map((group, gIdx) => (
                  <div key={gIdx} className="group-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9375rem' }}>
                      <h3 style={{ margin: 0, fontSize: 'var(--fs-sm)', color: THEME.primary, fontWeight: 900 }}>{group.name}</h3>
                      <button onClick={() => selectGroup(group.tables.map(t => t.id))} style={{ background: 'none', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontWeight: 900, fontSize: 'var(--fs-xs)' }}>تحديد</button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {group.tables.map(table => (
                        <div key={table.id} className={`table-row ${selectedTables.includes(table.id) ? 'selected' : ''}`}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 700, color: '#334155', flex: 1 }}>
                            <input type="checkbox" className="custom-checkbox" checked={selectedTables.includes(table.id)} onChange={() => toggleTable(table.id)} />
                            {table.name}
                          </label>
                          <button onClick={() => downloadTemplate(table.id, table.name)} className="template-btn" title="تحميل قالب إدخال فارغ">
                            <Download size={16} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </GlassContainer>

            <GlassContainer>
              <h3 style={{ margin: '0 0 0.3125rem 0', color: THEME.primary, fontWeight: 900, fontSize: 'var(--fs-xl)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <span><RefreshCw size={16} aria-hidden="true" /></span> استيراد البيانات
              </h3>
              <p style={{ fontSize: 'var(--fs-sm)', color: '#64748b', margin: '0 0 1.5625rem 0', fontWeight: 700, lineHeight: 1.6 }}>
                ارفع القوالب المعبأة (Excel) لإضافتها للنظام.
              </p>
              
              <label className={`premium-dropzone ${selectedFile ? 'has-file' : ''} ${isUploading ? 'uploading' : ''}`}>
                {isUploading ? (
                    <div style={{ width: '100%', padding: '1.25rem 0' }}>
                        <div className="loading-spinner"><Settings size={16} aria-hidden="true" /></div>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, marginTop: '0.625rem' }}>
                            جاري القراءة والمعالجة...
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ fontSize: 'var(--fs-display)' }}>{selectedFile ? <Files size={34} aria-hidden="true" /> : <FolderOpen size={34} aria-hidden="true" />}</div>
                        <div>
                            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 900, color: selectedFile ? '#059669' : THEME.primary, marginBottom: '0.3125rem' }}>
                            {selectedFile ? selectedFile.name : 'اختر ملف الإكسل للرفع'}
                            </div>
                            {!selectedFile && <div style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', fontWeight: 700 }}>.xlsx فقط</div>}
                        </div>
                    </>
                )}
                <input 
                  type="file" 
                  accept=".xlsx" 
                  disabled={isUploading}
                  onChange={(e) => { 
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                      setUploadMsg({ text: '', type: '' }); 
                    } 
                  }} 
                  style={{ display: 'none' }} 
                />
              </label>

              {uploadMsg.text && (
                <div className={`status-alert ${uploadMsg.type}`}>
                  {uploadMsg.text}
                </div>
              )}

              {selectedFile && !isUploading && (
                <button onClick={handleConfirmUpload} className="btn-premium-upload">
                  بدء الترحيل والاستيراد
                </button>
              )}

              <div style={{ background: '#fef2f2', border: `1px dashed #fca5a5`, padding: '0.9375rem', borderRadius: '12px', marginTop: '1.5625rem' }}>
                <div style={{ color: '#dc2626', fontWeight: 900, fontSize: 'var(--fs-sm)', display: 'flex', alignItems: 'center', gap: '0.3125rem' }}>
                  <span><TriangleAlert size={16} aria-hidden="true" /></span> تعليمات الاستيراد
                </div>
                <ul style={{ fontSize: 'var(--fs-xs)', color: '#7f1d1d', margin: '0.5rem 0 0 0', paddingRight: '1.25rem', lineHeight: 1.6, fontWeight: 700 }}>
                  <li>استخدم النماذج المحملة من النظام حصراً.</li>
                  <li>تجنب تعديل عناوين الأعمدة في الملف.</li>
                  <li>يتم تطبيق الحماية ضد التكرار (Upsert) آلياً.</li>
                </ul>
              </div>
            </GlassContainer>

          </div>

          <FactoryResetManager />
        </div>
      )}

      </div>

      <style>{`
        .tab-btn { padding: 0.75rem 1.5rem; border-radius: 12px; border: none; box-shadow: var(--shadow-elevation); font-weight: 800; font-size: var(--fs-sm); cursor: pointer; transition: 0.2s; background: var(--surface-card); color: var(--text-secondary); white-space: nowrap; }
        .tab-btn:hover { background: #f8fafc; border-color: #cbd5e1; }
        .tab-btn.active { background: var(--accent-ink); color: white; border: none; box-shadow: var(--shadow-ambient); }
        .group-card { background: #f8fafc; padding: 0.9375rem; border-radius: 12px; border: 1px solid #f1f5f9; transition: 0.2s; }
        .table-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; background: var(--surface-card); border-radius: 8px; margin-top: 0.3125rem; border: none; box-shadow: var(--shadow-elevation); transition: 0.2s; }
        .table-row.selected { border-color: #0ea5e9; background: #f0f9ff; }
        .table-row:hover { border-color: #cbd5e1; }
        .custom-checkbox { width: 1rem; height: 1rem; cursor: pointer; }
        .template-btn { background: none; border: none; cursor: pointer; font-size: var(--fs-md); opacity: 0.5; transition: 0.2s; }
        .template-btn:hover { opacity: 1; transform: scale(1.1); }
        .premium-dropzone { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 16px; padding: 1.875rem 1.25rem; text-align: center; cursor: pointer; transition: all 0.3s ease; display: flex; flex-direction: column; gap: 0.625rem; justify-content: center; align-items: center; }
        .premium-dropzone:hover { background: white; border-color: #94a3b8; }
        .premium-dropzone.has-file { background: #f0fdf4; border-color: #10b981; border-style: solid; }
        .premium-dropzone.uploading { pointer-events: none; opacity: 0.8; border-color: #3b82f6; }
        .loading-spinner { font-size: var(--fs-2xl); animation: spin 2s linear infinite; }
        .btn-premium-upload { background: var(--accent-ink); color: white; padding: 0.875rem; border-radius: 12px; border: none; font-weight: 800; font-size: var(--fs-md); cursor: pointer; transition: 0.2s; width: 100%; margin-top: 0.9375rem; box-shadow: var(--shadow-elevation); }
        .btn-premium-upload:hover { filter: brightness(1.1); transform: translateY(-2px); }
        .sidebar-summary-glass { background: var(--surface-card); padding: 1.25rem; border-radius: 16px; text-align: center; border: none; box-shadow: var(--shadow-ambient); }
        .sidebar-summary-glass .icon-pulse { font-size: var(--fs-3xl); margin-bottom: 0.3125rem; }
        .summary-title { margin: 0; font-size: var(--fs-sm); color: #64748b; font-weight: 900; }
        .summary-value { margin: 0.3125rem 0 0 0; font-weight: 900; font-size: var(--fs-3xl); color: #0f172a; }
        .btn-premium-glass { width: 100%; padding: 0.75rem; border-radius: 12px; border: none; color: white; display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer; font-weight: 900; font-size: var(--fs-sm); transition: 0.2s; }
        .btn-premium-glass.excel { background: #10b981; }
        .btn-premium-glass.json { background: #3b82f6; }
        .btn-premium-glass:hover:not(.disabled) { filter: brightness(1.1); transform: translateY(-2px); }
        .btn-premium-glass.disabled { opacity: 0.5; cursor: not-allowed; }
        .status-alert { padding: 0.75rem; border-radius: 10px; font-size: var(--fs-sm); font-weight: 900; text-align: center; margin-top: 0.9375rem; animation: fadeUp 0.3s; }
        .status-alert.loading { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .status-alert.success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
        .status-alert.error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .cinematic-scroll::-webkit-scrollbar { width: 0.3125rem; }
        .cinematic-scroll::-webkit-scrollbar-track { background: transparent; }
        .cinematic-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </MasterPage>
  );
}
