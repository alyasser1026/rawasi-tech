"use client";
import React, { useState, useEffect } from 'react';
import SecureAction from '@/components/SecureAction';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom'; // 🚀 استدعاء الـ Portal لحل مشكلة التمركز
import { usePartnersLogic } from './partners_logic';
import SmartCombo from '@/components/SmartCombo';
import MasterPage from '@/components/MasterPage';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import KpiStrip from '@/components/KpiStrip';
import { Building2, HardHat, Truck, Users, Lock, Unlock, RefreshCw, Sparkles } from 'lucide-react';

export default function PartnersDirectory() {
  const router = useRouter();
  const {
    isLoading, searchTerm, setSearchTerm, filterType, setFilterType,
    isAddModalOpen, setIsAddModalOpen, openAddModal, newPartner, setNewPartner,
    isSaving, handleSavePartner, filteredPartners, stats,
    handleDelete, exportToExcel, handlePrint, handleEdit, selectedIds, setSelectedIds, editingId,
    currentPage, setCurrentPage, rowsPerPage, setRowsPerPage, totalPages, totalResults,
    isCodeAuto, setIsCodeAuto, handlePartnerTypeChange, handlePartnerRoleChange, regenerateCode
  } = usePartnersLogic();

  // 🚀 حالة للتأكد من تحميل المكون عشان الـ Portal يشتغل بدون أخطاء SSR
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
      setMounted(true);
  }, []);

  const isOneSelected = selectedIds.length === 1;
  const isNoneSelected = selectedIds.length === 0;

  const handleMainAction = () => {
    if (isOneSelected) {
      const partnerToEdit = filteredPartners.find(p => p.id === selectedIds[0]);
      if (partnerToEdit) handleEdit(partnerToEdit);
    } else {
      openAddModal();
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPartners.length && filteredPartners.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPartners.map(p => p.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'موظف': return { bg: '#E0F2FE', color: '#0369A1' }; 
      case 'عامل يومية': return { bg: '#DCFCE7', color: '#166534' }; 
      case 'مقاول': return { bg: '#FEF3C7', color: '#92400E' };
      case 'عميل': return { bg: '#F3E8FF', color: '#6B21A8' }; 
      case 'جهة داخلية': return { bg: 'var(--surface-sunken)', color: 'var(--text-secondary)' };
      default: return { bg: '#FEE2E2', color: '#991B1B' }; 
    }
  };

  const sidebarActions = (
    <div data-partners-actions style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <button onClick={handleMainAction} className="btn-main-glass" style={{ background: 'var(--accent-soft-bg)', color: 'var(--accent-ink)' }}>
        {isOneSelected ? 'تعديل الكيان المحدد' : 'إضافة كيان جديد'}
      </button>
      
      {selectedIds.length > 0 && (
        <button onClick={() => selectedIds.forEach(id => handleDelete(id))} className="btn-main-glass" style={{ backgroundColor: '#b91c1c', color: 'white' }}>
          مسح المحدد ({selectedIds.length})
        </button>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.625rem' }}>
        <button onClick={exportToExcel} className="btn-main-glass" style={{ backgroundColor: '#166534', color: 'white', flex: 1 }}>إكسل</button>
        <button onClick={handlePrint} className="btn-main-glass" style={{ background: 'var(--surface-subcard)', color: 'var(--text-primary)', flex: 1 }}>طباعة</button>
      </div>
    </div>
  );

  const customFilters = (
    <div data-partners-filters style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
      <div>
        <label style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 900, display: 'block', marginBottom: '0.5rem' }}>بحث سريع:</label>
        <input type="text" placeholder="الاسم، الكود، الجوال..." className="sidebar-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div>
        <label style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 900, display: 'block', marginBottom: '0.5rem' }}>تصفية بالتصنيف:</label>
        <select className="sidebar-input" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="الكل">كل التصنيفات</option>
            <option value="جهة داخلية">جهة داخلية</option>
            <option value="موظف">موظف</option>
            <option value="مقاول">مقاول</option>
            <option value="عامل يومية">عامل يومية</option>
            <option value="عميل">عميل</option>
            <option value="مورد">مورد</option>
        </select>
      </div>
    </div>
  );

  const summaryStats = (
    <KpiStrip compact items={[
      { label: 'إجمالي الشركاء', value: Number(stats.total || 0).toLocaleString('en-US'), tone: 'brand', icon: <Users />, hint: 'كيان مسجل' },
      { label: 'موظفون وجهات داخلية', value: Number(stats.employees || 0).toLocaleString('en-US'), tone: 'info', icon: <Building2 /> },
      { label: 'مقاولون وموردون', value: Number(stats.contractors || 0).toLocaleString('en-US'), tone: 'warning', icon: <Truck /> },
      { label: 'عمالة يومية', value: Number(stats.labor || 0).toLocaleString('en-US'), tone: 'success', icon: <HardHat /> },
    ]} />
  );

  return (
    <div className="clean-page partners-directory">
      <MasterPage title="دليل الشركاء" subtitle="إدارة الموردين، المقاولين، العملاء، والعمالة بفاي تك (V11)">
        
        <RawasiSidebarManager 
            summary={summaryStats}
            actions={sidebarActions}
            customFilters={customFilters}
            watchDeps={[selectedIds, searchTerm, filterType, stats]}
        />

        <style>{`
          @media print {
            @page { size: A4 landscape; margin: 1cm; }
            .no-print, .MasterPage-Sidebar, button { display: none !important; }
            .partners-directory .print-only { display: block !important; background: white; color: #27221d; }
            .print-table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed; }
            .print-table th, .print-table td { border: 1px solid #cbd5e1 !important; padding: 6px 4px !important; text-align: center !important; font-size: 9pt !important; word-wrap: break-word; color: black !important; }
            .print-table th { background: #0f172a !important; color: #fff !important; font-weight: 900; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-table thead { display: table-header-group !important; }
          }
          @media screen { .print-only { display: none !important; } }

          .partners-directory :is(.floating-row, .table-header-grid) {
            background: var(--surface-card); border-radius: 14px; margin-bottom: 0.75rem; display: grid;
            grid-template-columns: 2.5rem 5rem 1.5fr 0.8fr 1fr 0.8fr 0.8fr 1.2fr 0.8fr;
            align-items: center; padding: 0.9375rem 0.9375rem; border: 1px solid transparent; transition: 0.3s;
          }
          .partners-directory .floating-row[data-selected="true"] { background: var(--accent-soft-bg); }
          .partners-directory .data-text { font-weight: 700; font-size: var(--fs-sm); color: var(--text-primary); }
          .partners-directory .label-header { font-size: var(--fs-xs); font-weight: 900; color: var(--text-secondary); }
          
          [data-partners-actions] .btn-main-glass { padding: 0.75rem; border-radius: 12px; border: none; font-weight: 900; cursor: pointer; transition: 0.3s; font-size: var(--fs-sm); width: 100%; }
          [data-partners-actions] .btn-main-glass:hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          [data-partners-filters] .sidebar-input { background: var(--surface-sunken); border: none; padding: 0.75rem; border-radius: 12px; color: var(--text-primary); width: 100%; font-weight: 700; }
          [data-partners-filters] .sidebar-input::placeholder { color: var(--text-muted); }
          [data-partners-filters] select option { color: var(--text-primary); background: var(--surface-sunken); }
          .partners-directory .category-badge { padding: 0.25rem 0.625rem; border-radius: 8px; font-size: var(--fs-xs); font-weight: 900; display: inline-block; }

          /* نافذة المودال */
          .partners-dialog .glass-input-field { width: 100%; padding: 0.75rem; border-radius: 12px; background: var(--surface-sunken); border: none; box-shadow: var(--shadow-sunken); font-weight: 700; color: var(--text-primary); }
          .partners-dialog .glass-input-field::placeholder { color: var(--text-muted); }
          .partners-dialog select option { color: var(--text-primary); background: var(--surface-sunken); }
          .partners-directory .nav-btn { 
            height: 2.25rem; 
            min-height: 2.25rem; 
            padding: 0 1rem; 
            border-radius: 8px; 
            border: none; 
            background: var(--accent-soft-bg); 
            color: var(--accent-ink); 
            cursor: pointer; 
            font-weight: 800; 
            font-size: var(--fs-sm); 
            display: inline-flex; 
            align-items: center; 
            justify-content: center; 
            white-space: nowrap; 
            line-height: 1;
            transition: 0.2s; 
          }
          .partners-directory .nav-btn:hover:not(:disabled) { filter: brightness(0.95); transform: translateY(-1px); }
          .partners-directory .nav-btn:disabled { background: var(--surface-subcard); color: var(--text-muted); cursor: not-allowed; opacity: 0.6; transform: none; }
        `}</style>

        {/* المحتوى الرئيسي */}
        <div className="no-print">
          <div className="table-header-grid" style={{ marginBottom: '0.9375rem' }}>
             <input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.length === filteredPartners.length && filteredPartners.length > 0} style={{ transform: 'scale(1.2)' }} />
             {['كود', 'الاسم والمهنة', 'التصنيف', 'الحساب المالي المربوط', 'الهوية والانتهاء', 'الضريبي', 'العنوان', 'الجوال'].map(h => <div key={h} className="label-header">{h}</div>)}
          </div>

          {isLoading ? (
             <div style={{ textAlign: 'center', padding: '3.125rem', fontWeight: 900, color: 'var(--text-secondary)' }}>جاري تحميل الشركاء...</div>
          ) : (
             filteredPartners.map((p) => {
              const badge = getBadgeStyle(p.type); 
              return (
                <div key={p.id} className="floating-row" data-selected={selectedIds.includes(p.id)}>
                  <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelectRow(p.id)} style={{ transform: 'scale(1.2)', cursor: 'pointer' }} />
                  <div className="data-text" style={{ color: 'var(--accent-ink)' }}>{p.code}</div>
                  <div>
                    <div className="data-text" style={{ cursor: 'pointer', color: 'var(--text-primary)', textDecoration: 'underline' }} onClick={() => router.push(`/performance?partner_id=${p.id}`)}>{p.name}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>{p.role}</div>
                  </div>
                  <div><span className="category-badge" style={{ backgroundColor: badge.bg, color: badge.color }}>{p.type}</span></div>
                  <div className="data-text" style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent-ink)', fontWeight: 900 }}>{p.account_name}</div>
                  <div>
                     <div className="data-text">{p.idNumber}</div>
                     <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>ينتهي: {p.identity_expiry_date || "---"}</div>
                  </div>
                  <div className="data-text" style={{ color: 'var(--text-secondary)' }}>{p.vat_number || "---"}</div>
                  <div className="data-text" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>{p.address}</div>
                  <div className="data-text">{p.phone}</div>
                </div>
              );
            })
          )}

          {!isLoading && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0.625rem 1.25rem', background: 'var(--surface-card)', borderRadius: '12px', boxShadow: 'var(--shadow-ambient)', minHeight: '52px' }}>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span>إجمالي السجلات:</span>
                <b style={{ color: 'var(--accent-ink)', fontSize: 'var(--fs-md)', fontWeight: 900 }}>{totalResults}</b>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} style={{ height: '2.25rem', padding: '0 0.875rem', borderRadius: '8px', border: '1px solid var(--border-soft, transparent)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontWeight: 800, fontSize: 'var(--fs-sm)', cursor: 'pointer', outline: 'none' }}>
                  <option value={50}>50 سجل</option>
                  <option value={100}>100 سجل</option>
                  <option value={500}>500 سجل</option>
                  <option value={1000}>1000 سجل</option>
                </select>
                <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="nav-btn">السابق</button>
                  <span style={{ height: '2.25rem', padding: '0 0.875rem', background: 'var(--surface-subcard)', borderRadius: '8px', fontWeight: 800, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', fontSize: 'var(--fs-sm)', minWidth: '4.5rem', textAlign: 'center', lineHeight: 1 }}>
                    {currentPage} / {totalPages || 1}
                  </span>
                  <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="nav-btn">التالي</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="print-only phi-print-own-header">
          <ReportOfficialHeader
            title="دليل الشركاء (Partners Directory)"
            subtitle="الموردون والمقاولون والعملاء والعمالة"
            badgeText="تقرير معتمد • OFFICIAL REPORT"
            refLabel="رقم التقرير"
            compact
            details={[{ label: 'عدد السجلات', value: String(filteredPartners.length) }]}
          />
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: '3.75rem' }}>كود</th><th style={{ width: '11.25rem' }}>الاسم الكامل</th>
                <th>التصنيف</th><th>المهنة</th><th>الحساب المالي</th><th>الهوية</th><th>انتهاء</th>
                <th>الضريبي</th><th style={{ width: '12.5rem' }}>العنوان</th><th>الجوال</th>
              </tr>
            </thead>
            <tbody>
              {filteredPartners.map((p) => (
                <tr key={p.id}>
                  <td>{p.code}</td><td style={{ fontWeight: 'bold' }}>{p.name}</td><td>{p.type}</td><td>{p.role}</td>
                  <td>{p.account_name}</td><td>{p.idNumber}</td><td>{p.identity_expiry_date}</td><td>{p.vat_number}</td><td style={{ fontSize: '9pt' }}>{p.address}</td><td>{p.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </MasterPage>

      {/* 🚀 السحر هنا: استخدام createPortal لعرض المودال في منتصف الشاشة دائماً */}
      {isAddModalOpen && mounted && createPortal(
        <div className="phi-modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, rgba(40, 24, 10, 0.4) 0%, rgba(15, 7, 0, 0.9) 100%)', backdropFilter: 'blur(20px)', direction: 'rtl' }} onClick={() => setIsAddModalOpen(false)}>
            <div className="cinematic-scroll phi-modal-panel partners-dialog" onClick={e => e.stopPropagation()} style={{ width: '56.25rem', maxHeight: '90vh', background: 'var(--surface-card)', backdropFilter: 'blur(30px)', borderRadius: '14px', padding: '2.5rem', boxShadow: '0 40px 80px rgba(0,0,0,0.4)', overflowY: 'auto' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.875rem', borderBottom: '2px solid var(--accent-soft-bg)', paddingBottom: '0.9375rem' }}>
                    <h2 style={{ color: 'var(--text-primary)', fontWeight: 900, margin: 0, fontSize: 'var(--fs-2xl)' }}>
                        {editingId ? 'تعديل بيانات الكيان' : 'تعريف كيان جديد'}
                    </h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>الكود المرجعي *</label>
                            <span 
                                style={{
                                    fontSize: '0.72rem',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '9999px',
                                    fontWeight: 700,
                                    background: isCodeAuto ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 88, 12, 0.15)',
                                    color: isCodeAuto ? '#059669' : '#c2410c',
                                    border: `1px solid ${isCodeAuto ? 'rgba(16, 185, 129, 0.3)' : 'rgba(234, 88, 12, 0.3)'}`
                                }}
                            >
                                {isCodeAuto ? '⚡ تلقائي ذكي' : '✍️ يدوي'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input 
                                className="glass-input-field" 
                                style={{ 
                                    flex: 1, 
                                    fontFamily: 'monospace', 
                                    fontWeight: 800, 
                                    letterSpacing: '0.05em',
                                    background: isCodeAuto ? 'rgba(0,0,0,0.03)' : undefined
                                }} 
                                value={newPartner.code} 
                                onChange={e => {
                                    setIsCodeAuto(false);
                                    setNewPartner({ ...newPartner, code: e.target.value });
                                }} 
                                placeholder="مثال: WRK-001" 
                            />
                            <button
                                type="button"
                                onClick={() => setIsCodeAuto(!isCodeAuto)}
                                title={isCodeAuto ? "قفل التوليد التلقائي للتحرير اليدوي" : "تفعيل التوليد التلقائي الذكي"}
                                style={{
                                    padding: '0.55rem',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-color, #e5e7eb)',
                                    background: isCodeAuto ? 'var(--accent-soft-bg, #fef3c7)' : 'var(--surface-card, #ffffff)',
                                    color: isCodeAuto ? 'var(--accent-ink, #b45309)' : 'var(--text-secondary, #6b7280)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {isCodeAuto ? <Lock size={16} /> : <Unlock size={16} />}
                            </button>
                            <button
                                type="button"
                                onClick={regenerateCode}
                                title="إعادة توليد الكود التسلسلي التالي"
                                style={{
                                    padding: '0.55rem',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-color, #e5e7eb)',
                                    background: 'var(--surface-card, #ffffff)',
                                    color: 'var(--text-primary, #111827)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <RefreshCw size={16} />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--text-primary)', display: 'block', marginBottom: '0.375rem' }}>التصنيف *</label>
                        <select className="glass-input-field" value={newPartner.type} onChange={e => handlePartnerTypeChange(e.target.value)}>
                            <option value="عامل يومية">عامل يومية (صنايعية ومساعدين)</option>
                            <option value="موظف">موظف (إداري أو مهندس)</option>
                            <option value="مقاول">مقاول باطن</option>
                            <option value="مورد">مورد مواد وتجهيزات</option>
                            <option value="عميل">عميل وملاك مشاريع</option>
                            <option value="استشاري">استشاري ومكتب هندسي</option>
                            <option value="تأجير معدات">تأجير معدات وآليات</option>
                            <option value="جهة حكومية">جهة حكومية ورسمية</option>
                            <option value="جهة داخلية">جهة داخلية وعهد</option>
                        </select>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--text-primary)', display: 'block', marginBottom: '0.375rem' }}>الاسم الكامل *</label>
                        <input className="glass-input-field" value={newPartner.name} onChange={e => setNewPartner({...newPartner, name: e.target.value})} placeholder="اسم الشخص أو الشركة" />
                    </div>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--text-primary)', display: 'block', marginBottom: '0.375rem' }}>المهنة / الدور</label>
                        <input className="glass-input-field" value={newPartner.role} onChange={e => handlePartnerRoleChange(e.target.value)} placeholder="مثال: نجار، مهندس موقع، مساعد، سائق..." />
                    </div>
                </div>

                <div style={{ background: 'var(--accent-soft-bg)', padding: '1.25rem', borderRadius: '16px', marginBottom: '1.25rem', zIndex: 90, position: 'relative' }}>
                    <h3 style={{ margin: '0 0 0.9375rem 0', fontSize: 'var(--fs-lg)', color: 'var(--accent-ink)' }}>الربط المالي (شجرة الحسابات)</h3>
                    <SmartCombo 
                        label="الحساب المحاسبي المرتبط بالكيان" 
                        table="accounts" 
                        displayCol="name" 
                        searchCols="name,code" 
                        customFilter="is_transactional=eq.true"
                        value={newPartner.account_id}
                        onSelect={(v: any) => setNewPartner({ ...newPartner, account_id: v?.id })} 
                    />
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>* بدون ربط الحساب، لن تظهر قيود هذا الشخص في ميزان المراجعة بشكل صحيح.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--text-primary)', display: 'block', marginBottom: '0.375rem' }}>رقم الهوية / الإقامة</label>
                        <input className="glass-input-field" value={newPartner.idNumber} onChange={e => setNewPartner({...newPartner, idNumber: e.target.value})} placeholder="أدخل رقم الهوية" />
                    </div>
                    <div>
                        <label htmlFor="partner-identity-expiry" style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--text-primary)', display: 'block', marginBottom: '0.375rem' }}>تاريخ انتهاء الهوية</label>
                        <input id="partner-identity-expiry" type="date" className="glass-input-field" value={newPartner.identity_expiry_date} onChange={e => setNewPartner({...newPartner, identity_expiry_date: e.target.value})} />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--text-primary)', display: 'block', marginBottom: '0.375rem' }}>الرقم الضريبي</label>
                        <input className="glass-input-field" value={newPartner.vat_number} onChange={e => setNewPartner({...newPartner, vat_number: e.target.value})} placeholder="للمقاولين والشركات" />
                    </div>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--text-primary)', display: 'block', marginBottom: '0.375rem' }}>رقم الجوال</label>
                        <input className="glass-input-field" value={newPartner.phone} onChange={e => setNewPartner({...newPartner, phone: e.target.value})} placeholder="05xxxxxxxx" />
                    </div>
                </div>

                <div style={{ marginBottom: '1.875rem' }}>
                    <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--text-primary)', display: 'block', marginBottom: '0.375rem' }}>العنوان الوطني / الوصف</label>
                    <input className="glass-input-field" value={newPartner.address} onChange={e => setNewPartner({...newPartner, address: e.target.value})} placeholder="المدينة، الحي، الشارع..." />
                </div>

                <div style={{ display: 'flex', gap: '0.9375rem' }}>
                    <button onClick={handleSavePartner} disabled={isSaving} className="btn-glass-save" style={{ flex: 2 }}>
                        {isSaving ? 'جاري الحفظ...' : 'اعتماد وحفظ البيانات'}
                    </button>
                    <button onClick={() => setIsAddModalOpen(false)} className="btn-glass-cancel" style={{ flex: 1 }}>
                        إلغاء
                    </button>
                </div>

            </div>
        </div>,
        document.body
      )}
    </div>
  );
}
