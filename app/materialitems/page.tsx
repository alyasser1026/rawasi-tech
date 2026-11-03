"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import RawasiSmartTable from '@/components/rawasismarttable';
import { useMaterialItemsLogic } from './material_items_logic';
import { useConfirm } from '@/components/ConfirmContext';
import { formatCurrency } from '@/lib/helpers';
import { THEME } from '@/lib/theme';
import LoadingScreen from '@/components/LoadingScreen';

export default function MaterialCatalogPage() {
  const logic = useMaterialItemsLogic();
  const { showConfirm } = useConfirm();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // 🚀 اختصار الحفظ (Ctrl + Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (logic.isModalOpen && e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (!logic.isSaving) logic.handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [logic.isModalOpen, logic.isSaving, logic.handleSave]);

  // 🚀 اختصار إضافة جديد (Alt + N)
  useEffect(() => {
    const handleAddShortcut = (e: KeyboardEvent) => {
      if (!logic.isModalOpen && e.altKey && (e.code === 'KeyN' || e.key.toLowerCase() === 'n' || e.key === 'ى')) {
        e.preventDefault();
        logic.setCurrentRecord({}); logic.setIsModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleAddShortcut);
    return () => window.removeEventListener('keydown', handleAddShortcut);
  }, [logic.isModalOpen, logic.setCurrentRecord, logic.setIsModalOpen]);

  if (!mounted) return null;

  const tableColumns = [
    { header: 'كود الصنف', render: (row: any) => <strong style={{ color: THEME.primary }}>{row.item_code || '---'}</strong> },
    { header: 'اسم الخريطة / الصنف', render: (row: any) => <span style={{ fontWeight: 900 }}>📦 {row.item_name}</span> },
    { header: 'التصنيف الرئيسي', render: (row: any) => <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 800 }}>{row.main_category || 'عام'}</span> },
    { header: 'الوحدة الافتراضية', render: (row: any) => <span style={{ fontWeight: 700 }}>{row.default_unit}</span> },
    { header: 'السعر الاسترشادي', render: (row: any) => <span style={{ color: THEME.success, fontWeight: 900 }}>{formatCurrency(row.default_unit_price)}</span> },
    {
      header: 'الإجراءات',
      render: (row: any) => (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button 
            onClick={() => { logic.setCurrentRecord(row); logic.setIsModalOpen(true); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }} title="تعديل"
          >✏️</button>
          <button 
            onClick={() => {
              showConfirm({
                title: 'حذف صنف من الدليل',
                message: `هل أنت متأكد من حذف الصنف "${row.item_name}"؟ هذا الإجراء قد يؤثر على الفواتير المربوطة به إذا وجدت.`,
                type: 'danger',
                onConfirm: () => logic.deleteItem(row.id)
              });
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }} title="حذف"
          >🗑️</button>
        </div>
      )
    }
  ];

  const sidebarActions = (
    <button className="btn-main-glass gold" onClick={() => {
      logic.setCurrentRecord({ item_code: '', item_name: '', main_category: '', default_unit: 'حبة', default_unit_price: 0, notes: '' });
      logic.setIsModalOpen(true);
    }}>➕ إضافة صنف جديد</button>
  );

  const sidebarFilters = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
      <input type="text" placeholder="🔍 ابحث بالاسم أو الكود..." className="glass-input-field" value={logic.searchQuery} onChange={e => logic.setSearchQuery(e.target.value)} />
      <select className="glass-input-field" value={logic.filterCategory} onChange={e => logic.setFilterCategory(e.target.value)}>
        <option value="الكل">كل التصنيفات 🧱</option>
        {logic.categories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
      </select>
    </div>
  );

  return (
    <div className="clean-page">
      <MasterPage icon="📦" title="دليل أصناف الخامات الموحد" subtitle="تكويد وإدارة بنود التوريدات لمنع العشوائية في الفواتير">
        
        <RawasiSidebarManager 
          summary={
            <div className="summary-glass-card">
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b' }}>إجمالي الأصناف المسجلة</span>
              <div className="val" style={{ fontSize: '24px', fontWeight: 900, color: THEME.primary, marginTop: '5px' }}>{logic.items.length} صنف</div>
            </div>
          }
          actions={sidebarActions}
          customFilters={sidebarFilters}
          watchDeps={[logic.items.length, logic.searchQuery, logic.filterCategory]}
        />

        <style>{`
          .glass-input-field { width: 100%; padding: 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.65); border: 1px solid rgba(255, 255, 255, 0.8); outline: none; font-weight: 700; color: #1e293b; }
          .btn-main-glass { width: 100%; padding: 14px; border-radius: 16px; font-weight: 900; cursor: pointer; transition: 0.2s; border: none; }
          .btn-main-glass.gold { background: linear-gradient(135deg, ${THEME.goldAccent}, ${THEME.coffeeMain}); color: white; box-shadow: 0 4px 15px rgba(194,65,12,0.3); }
          .btn-main-glass.gold:hover { transform: translateY(-2px); }
          .summary-glass-card { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 20px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); }
        `}</style>

        {logic.isLoading ? (
          <LoadingScreen message="جاري تحميل الكتالوج الموحد..." fullScreen={false} />
        ) : (
          <div className="glass-card" style={{ background: 'white', padding: '20px', borderRadius: '24px' }}>
            <RawasiSmartTable data={logic.items} columns={tableColumns} enablePagination={true} />
          </div>
        )}

        {/* 🧱 مودال الإضافة والتعديل المخصص للأصناف */}
        {logic.isModalOpen && createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(40, 24, 10, 0.5)', backdropFilter: 'blur(15px)', direction: 'rtl' }}>
            <div style={{ background: 'white', padding: '40px', borderRadius: '32px', width: '100%', maxWidth: '600px', boxShadow: '0 30px 60px rgba(0,0,0,0.3)' }}>
              <h3 style={{ fontWeight: 900, color: THEME.coffeeDark, marginBottom: '25px' }}>{logic.currentRecord.id ? '✏️ تعديل صنف خامة' : '🧱 إضافة صنف خامة جديد للدليل'}</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
                  <div><label style={{ fontSize: '12px', fontWeight: 900 }}>كود الصنف</label><input type="text" className="glass-input-field" placeholder="MAT-001" value={logic.currentRecord.item_code || ''} onChange={e => logic.setCurrentRecord({...logic.currentRecord, item_code: e.target.value})} /></div>
                  <div><label style={{ fontSize: '12px', fontWeight: 900 }}>اسم الخامة / الصنف الموحد</label><input type="text" className="glass-input-field" placeholder="مثال: حديد تسليح عز 16 مم" value={logic.currentRecord.item_name || ''} onChange={e => logic.setCurrentRecord({...logic.currentRecord, item_name: e.target.value})} /></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                  <div><label style={{ fontSize: '12px', fontWeight: 900 }}>التصنيف (النوع)</label><input type="text" className="glass-input-field" placeholder="مثال: حديد، أسمنت، دهانات" value={logic.currentRecord.main_category || ''} onChange={e => logic.setCurrentRecord({...logic.currentRecord, main_category: e.target.value})} /></div>
                  <div><label style={{ fontSize: '12px', fontWeight: 900 }}>الوحدة الافتراضية</label><input type="text" className="glass-input-field" placeholder="طن، متر، كيس، حبة" value={logic.currentRecord.default_unit || ''} onChange={e => logic.setCurrentRecord({...logic.currentRecord, default_unit: e.target.value})} /></div>
                </div>

                <div><label style={{ fontSize: '12px', fontWeight: 900 }}>السعر الاسترشادي المتوقع</label><input type="number" className="glass-input-field" placeholder="0.00" value={logic.currentRecord.default_unit_price || ''} onChange={e => logic.setCurrentRecord({...logic.currentRecord, default_unit_price: Number(e.target.value)})} /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 900 }}>ملاحظات ومواصفات</label><textarea className="glass-input-field" rows={2} placeholder="أي مواصفات فنية خاصة بالخامة..." value={logic.currentRecord.notes || ''} onChange={e => logic.setCurrentRecord({...logic.currentRecord, notes: e.target.value})}></textarea></div>
              </div>

              <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                <button onClick={logic.handleSave} disabled={logic.isSaving} className="btn-main-glass gold" style={{ flex: 2 }}>{logic.isSaving ? '⏳ جاري الحفظ...' : '✅ حفظ الصنف'}</button>
                <button onClick={() => logic.setIsModalOpen(false)} className="btn-main-glass" style={{ flex: 1, background: '#f1f5f9', color: '#64748b' }}>إلغاء</button>
              </div>
            </div>
          </div>,
          document.body
        )}

      </MasterPage>
    </div>
  );
}
