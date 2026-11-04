"use client";
import React, { useState, useEffect } from 'react';
import SecureAction from '@/components/SecureAction';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom'; // 🚀 استدعاء الـ Portal لحل مشكلة التمركز
import { usePartnersLogic } from './partners_logic';
import SmartCombo from '@/components/SmartCombo';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import KpiStrip from '@/components/KpiStrip';
import { Building2, HardHat, Truck, Users } from 'lucide-react';

const THEME = {
  sandLight: '#f7f7f8',
  sandDark: '#e4e4e7',
  coffeeMain: '#52525b',
  coffeeDark: '#27272a',
  goldAccent: '#c2410c',
  primary: '#0f172a',
  success: '#10b981',
  danger: '#ef4444'
};

export default function PartnersDirectory() {
  const router = useRouter();
  const {
    isLoading, searchTerm, setSearchTerm, filterType, setFilterType,
    isAddModalOpen, setIsAddModalOpen, openAddModal, newPartner, setNewPartner,
    isSaving, handleSavePartner, filteredPartners, stats,
    handleDelete, exportToExcel, handlePrint, handleEdit, selectedIds, setSelectedIds, editingId,
    currentPage, setCurrentPage, rowsPerPage, setRowsPerPage, totalPages, totalResults
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
      case 'مقاول': return { bg: '#FEF3C7', color: '#B45309' }; 
      case 'عميل': return { bg: '#F3E8FF', color: '#6B21A8' }; 
      case 'جهة داخلية': return { bg: '#F3F4F6', color: '#374151' }; 
      default: return { bg: '#FEE2E2', color: '#991B1B' }; 
    }
  };

  const sidebarActions = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button onClick={handleMainAction} className="btn-main-glass" style={{ backgroundColor: isOneSelected ? '#3b82f6' : THEME.goldAccent, color: 'white' }}>
        {isOneSelected ? 'تعديل الكيان المحدد' : 'إضافة كيان جديد'}
      </button>
      
      {selectedIds.length > 0 && (
        <button onClick={() => selectedIds.forEach(id => handleDelete(id))} className="btn-main-glass" style={{ backgroundColor: THEME.danger, color: 'white' }}>
          مسح المحدد ({selectedIds.length})
        </button>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button onClick={exportToExcel} className="btn-main-glass" style={{ backgroundColor: '#166534', color: 'white', flex: 1 }}>إكسل</button>
        <button onClick={handlePrint} className="btn-main-glass" style={{ backgroundColor: '#f8fafc', color: THEME.primary, border: '1px solid #cbd5e1', flex: 1 }}>طباعة</button>
      </div>
    </div>
  );

  const customFilters = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <div>
        <label style={{ color: 'white', fontSize: 'var(--fs-sm)', fontWeight: 900, display: 'block', marginBottom: '8px' }}>بحث سريع:</label>
        <input type="text" placeholder="الاسم، الكود، الجوال..." className="sidebar-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div>
        <label style={{ color: 'white', fontSize: 'var(--fs-sm)', fontWeight: 900, display: 'block', marginBottom: '8px' }}>تصفية بالتصنيف:</label>
        <select className="sidebar-input" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="الكل" style={{color: 'black'}}>كل التصنيفات</option>
            <option value="جهة داخلية" style={{color: 'black'}}>جهة داخلية</option>
            <option value="موظف" style={{color: 'black'}}>موظف</option>
            <option value="مقاول" style={{color: 'black'}}>مقاول</option>
            <option value="عامل يومية" style={{color: 'black'}}>عامل يومية</option>
            <option value="عميل" style={{color: 'black'}}>عميل</option>
            <option value="مورد" style={{color: 'black'}}>مورد</option>
        </select>
      </div>
    </div>
  );

  const summaryStats = (
    <KpiStrip compact items={[
      { label: 'إجمالي الشركاء', value: Number(stats.total || 0).toLocaleString('ar-EG'), tone: 'brand', icon: <Users />, hint: 'كيان مسجل' },
      { label: 'موظفون وجهات داخلية', value: Number(stats.employees || 0).toLocaleString('ar-EG'), tone: 'info', icon: <Building2 /> },
      { label: 'مقاولون وموردون', value: Number(stats.contractors || 0).toLocaleString('ar-EG'), tone: 'warning', icon: <Truck /> },
      { label: 'عمالة يومية', value: Number(stats.labor || 0).toLocaleString('ar-EG'), tone: 'success', icon: <HardHat /> },
    ]} />
  );

  return (
    <div className="clean-page">
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
            .print-only { display: block !important; }
            .print-header { display: flex !important; justify-content: space-between; align-items: center; border-bottom: 3px solid ${THEME.coffeeDark}; padding-bottom: 15px; margin-bottom: 25px; }
            .print-table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed; }
            .print-table th, .print-table td { border: 1px solid #000 !important; padding: 6px 4px !important; text-align: center !important; font-size: 9pt !important; word-wrap: break-word; color: black !important; }
            .print-table th { background: #f2f2f2 !important; font-weight: 900; }
            .print-table thead { display: table-header-group !important; }
            body { counter-reset: page; }
            .page-num::after { counter-increment: page; content: "صفحة " counter(page); }
            .print-footer { position: fixed; bottom: 0; left: 0; width: 100%; text-align: center; font-size: 10pt; border-top: 1px solid #ccc; padding: 10px 0; background: white; }
          }
          @media screen { .print-only { display: none !important; } }

          .floating-row, .table-header-grid {
            background: white; border-radius: 14px; margin-bottom: 12px; display: grid; 
            grid-template-columns: 40px 80px 1.5fr 0.8fr 1fr 0.8fr 0.8fr 1.2fr 0.8fr;
            align-items: center; padding: 15px 15px; border: 1px solid transparent; transition: 0.3s;
          }
          .floating-row:hover { border-color: ${THEME.goldAccent}; transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
          .data-text { font-weight: 700; font-size: var(--fs-sm); color: ${THEME.coffeeDark}; }
          .label-header { font-size: var(--fs-xs); font-weight: 900; color: ${THEME.coffeeDark}; opacity: 0.7; }
          
          .btn-main-glass { padding: 12px; border-radius: 12px; border: none; font-weight: 900; cursor: pointer; transition: 0.3s; font-size: var(--fs-sm); width: 100%; }
          .btn-main-glass:hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .sidebar-input { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); padding: 12px; border-radius: 12px; color: white; width: 100%; outline: none; font-weight: 700; transition: 0.3s; }
          .sidebar-input:focus { border-color: ${THEME.goldAccent}; background: rgba(255, 255, 255, 0.1); }
          .kpi-box { padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); }
          .kpi-box span { font-size: var(--fs-xs); opacity: 0.8; }
          .kpi-box strong { display: block; font-size: var(--fs-xl); color: white; margin-top: 5px; }
          .category-badge { padding: 4px 10px; border-radius: 8px; font-size: var(--fs-xs); font-weight: 900; display: inline-block; }

          /* نافذة المودال */
          .glass-input-field { width: 100%; padding: 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.65); border: 1px solid rgba(255, 255, 255, 0.8); outline: none; transition: 0.2s; font-weight: 700; color: #1e293b; }
          .glass-input-field:focus { background: #fff; border-color: ${THEME.goldAccent}; box-shadow: 0 0 0 4px rgba(194,65,12, 0.15); }
          .btn-glass-save { background: linear-gradient(135deg, ${THEME.goldAccent}, ${THEME.coffeeMain}); color: white; border: none; padding: 16px; border-radius: 16px; font-weight: 900; font-size: var(--fs-lg); cursor: pointer; transition: 0.3s; box-shadow: 0 10px 25px rgba(194,65,12, 0.4); }
          .btn-glass-save:hover:not(:disabled) { transform: translateY(-3px); filter: brightness(1.1); }
          .btn-glass-cancel { background: rgba(255, 255, 255, 0.6); color: #1e293b; border: 1px solid rgba(255, 255, 255, 0.8); padding: 16px; border-radius: 16px; font-weight: 900; font-size: var(--fs-lg); cursor: pointer; transition: 0.3s; }
          .btn-glass-cancel:hover { background: rgba(255, 255, 255, 0.9); transform: translateY(-2px); }
          .nav-btn { padding: 8px 16px; border-radius: 8px; border: none; background: ${THEME.primary}; color: white; cursor: pointer; font-weight: 900; transition: 0.2s; }
          .nav-btn:disabled { background: ${THEME.sandLight}; color: #94a3b8; cursor: not-allowed; }
        `}</style>

        {/* المحتوى الرئيسي */}
        <div className="no-print">
          <div className="table-header-grid" style={{ opacity: 0.8, marginBottom: '15px' }}>
             <input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.length === filteredPartners.length && filteredPartners.length > 0} style={{ transform: 'scale(1.2)' }} />
             {['كود', 'الاسم والمهنة', 'التصنيف', 'الحساب المالي المربوط', 'الهوية والانتهاء', 'الضريبي', 'العنوان', 'الجوال'].map(h => <div key={h} className="label-header">{h}</div>)}
          </div>

          {isLoading ? (
             <div style={{ textAlign: 'center', padding: '50px', fontWeight: 900, color: THEME.coffeeMain }}>جاري تحميل الشركاء...</div>
          ) : (
             filteredPartners.map((p) => {
              const badge = getBadgeStyle(p.type); 
              return (
                <div key={p.id} className="floating-row" style={{ border: selectedIds.includes(p.id) ? `1px solid ${THEME.goldAccent}` : '1px solid transparent' }}>
                  <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelectRow(p.id)} style={{ transform: 'scale(1.2)', cursor: 'pointer' }} />
                  <div className="data-text" style={{ color: THEME.goldAccent }}>{p.code}</div>
                  <div>
                    <div className="data-text" style={{ cursor: 'pointer', color: THEME.primary, textDecoration: 'underline' }} onClick={() => router.push(`/performance?partner_id=${p.id}`)}>{p.name}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: '#64748b' }}>{p.role}</div>
                  </div>
                  <div><span className="category-badge" style={{ backgroundColor: badge.bg, color: badge.color }}>{p.type}</span></div>
                  <div className="data-text" style={{ fontSize: 'var(--fs-sm)', color: '#0ea5e9', fontWeight: 900 }}>{p.account_name}</div>
                  <div>
                     <div className="data-text">{p.idNumber}</div>
                     <div style={{ fontSize: 'var(--fs-xs)', color: '#D946EF' }}>ينتهي: {p.identity_expiry_date || "---"}</div>
                  </div>
                  <div className="data-text" style={{ color: THEME.coffeeMain }}>{p.vat_number || "---"}</div>
                  <div className="data-text" style={{ fontSize: 'var(--fs-xs)', opacity: 0.7 }}>{p.address}</div>
                  <div className="data-text">{p.phone}</div>
                </div>
              );
            })
          )}

          {!isLoading && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '15px', background: 'white', borderRadius: '16px', border: `1px solid ${THEME.sandDark}` }}>
              <div style={{ fontSize: 'var(--fs-sm)', color: THEME.coffeeDark, fontWeight: 900 }}>
                إجمالي السجلات: <b style={{ color: THEME.goldAccent, fontSize: 'var(--fs-lg)' }}>{totalResults}</b>
              </div>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} style={{ padding: '8px 12px', borderRadius: '8px', border: `2px solid ${THEME.sandDark}`, outline: 'none', fontWeight: 900, cursor: 'pointer' }}>
                  <option value={50}>50 سجل</option>
                  <option value={100}>100 سجل</option>
                  <option value={500}>500 سجل</option>
                  <option value={1000}>1000 سجل</option>
                </select>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="nav-btn">السابق</button>
                  <span style={{ padding: '8px 16px', background: THEME.sandLight, borderRadius: '8px', fontWeight: 900, color: THEME.coffeeDark }}>
                    {currentPage} / {totalPages || 1}
                  </span>
                  <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="nav-btn">التالي</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="print-only">
           <div className="print-header">
             <div style={{ textAlign: 'right' }}>
               <h1 style={{ margin: 0, fontSize: '26pt', color: THEME.coffeeDark, fontWeight: 900 }}>دليل الشركاء</h1>
               <p style={{ margin: 0, fontSize: '14pt', color: THEME.coffeeMain, fontWeight: 700 }}>شركة فاي تك للمقاولات العامة</p>
             </div>
             <img src="/company-logo.svg" style={{ width: '180px' }} alt="Logo" />
           </div>
          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>كود</th><th style={{ width: '180px' }}>الاسم الكامل</th>
                <th>التصنيف</th><th>المهنة</th><th>الحساب المالي</th><th>الهوية</th><th>انتهاء</th>
                <th>الضريبي</th><th style={{ width: '200px' }}>العنوان</th><th>الجوال</th>
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
          <div style={{ height: '50px' }}></div>
          <div className="print-footer"><span className="page-num"></span><span style={{ marginRight: '40px' }}>تقرير رسمي - فاي تك للمقاولات - {new Date().toLocaleDateString('ar-SA')}</span></div>
        </div>

      </MasterPage>

      {/* 🚀 السحر هنا: استخدام createPortal لعرض المودال في منتصف الشاشة دائماً */}
      {isAddModalOpen && mounted && createPortal(
        <div className="phi-modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, rgba(40, 24, 10, 0.4) 0%, rgba(15, 7, 0, 0.9) 100%)', backdropFilter: 'blur(20px)', direction: 'rtl' }} onClick={() => setIsAddModalOpen(false)}>
            <div className="cinematic-scroll phi-modal-panel" onClick={e => e.stopPropagation()} style={{ width: '900px', maxHeight: '90vh', background: 'rgba(248, 250, 252, 0.9)', backdropFilter: 'blur(30px)', borderRadius: '14px', padding: '40px', boxShadow: '0 40px 80px rgba(0,0,0,0.4)', overflowY: 'auto' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: `2px solid ${THEME.goldAccent}50`, paddingBottom: '15px' }}>
                    <h2 style={{ color: THEME.coffeeDark, fontWeight: 900, margin: 0, fontSize: 'var(--fs-2xl)' }}>
                        {editingId ? 'تعديل بيانات الكيان' : 'تعريف كيان جديد'}
                    </h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '6px' }}>الكود المرجعي *</label>
                        <input className="glass-input-field" value={newPartner.code} onChange={e => setNewPartner({...newPartner, code: e.target.value})} placeholder="مثال: PRT-001" />
                    </div>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '6px' }}>التصنيف *</label>
                        <select className="glass-input-field" value={newPartner.type} onChange={e => setNewPartner({...newPartner, type: e.target.value})}>
                            <option value="موظف">موظف</option>
                            <option value="عامل يومية">عامل يومية</option>
                            <option value="مقاول">مقاول</option>
                            <option value="جهة داخلية">جهة داخلية</option>
                            <option value="عميل">عميل</option>
                            <option value="مورد">مورد</option>
                        </select>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '6px' }}>الاسم الكامل *</label>
                        <input className="glass-input-field" value={newPartner.name} onChange={e => setNewPartner({...newPartner, name: e.target.value})} placeholder="اسم الشخص أو الشركة" />
                    </div>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '6px' }}>المهنة / الدور</label>
                        <input className="glass-input-field" value={newPartner.role} onChange={e => setNewPartner({...newPartner, role: e.target.value})} placeholder="مثال: نجار، مورد حديد..." />
                    </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: `1px dashed ${THEME.goldAccent}`, marginBottom: '20px', zIndex: 90, position: 'relative' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: 'var(--fs-lg)', color: '#0ea5e9' }}>الربط المالي (شجرة الحسابات)</h3>
                    <SmartCombo 
                        label="الحساب المحاسبي المرتبط بالكيان" 
                        table="accounts" 
                        displayCol="name" 
                        searchCols="name,code" 
                        customFilter="is_transactional=eq.true"
                        value={newPartner.account_id}
                        onSelect={(v: any) => setNewPartner({ ...newPartner, account_id: v?.id })} 
                    />
                    <p style={{ margin: '8px 0 0 0', fontSize: 'var(--fs-xs)', color: '#64748b' }}>* بدون ربط الحساب، لن تظهر قيود هذا الشخص في ميزان المراجعة بشكل صحيح.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '6px' }}>رقم الهوية / الإقامة</label>
                        <input className="glass-input-field" value={newPartner.idNumber} onChange={e => setNewPartner({...newPartner, idNumber: e.target.value})} placeholder="أدخل رقم الهوية" />
                    </div>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '6px' }}>تاريخ انتهاء الهوية</label>
                        <input type="date" className="glass-input-field" value={newPartner.identity_expiry_date} onChange={e => setNewPartner({...newPartner, identity_expiry_date: e.target.value})} />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '6px' }}>الرقم الضريبي</label>
                        <input className="glass-input-field" value={newPartner.vat_number} onChange={e => setNewPartner({...newPartner, vat_number: e.target.value})} placeholder="للمقاولين والشركات" />
                    </div>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '6px' }}>رقم الجوال</label>
                        <input className="glass-input-field" value={newPartner.phone} onChange={e => setNewPartner({...newPartner, phone: e.target.value})} placeholder="05xxxxxxxx" />
                    </div>
                </div>

                <div style={{ marginBottom: '30px' }}>
                    <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '6px' }}>العنوان الوطني / الوصف</label>
                    <input className="glass-input-field" value={newPartner.address} onChange={e => setNewPartner({...newPartner, address: e.target.value})} placeholder="المدينة، الحي، الشارع..." />
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
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
