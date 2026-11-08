"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import RawasiSmartTable from '@/components/rawasismarttable';
import { useMaterialItemsLogic } from './material_items_logic';
import { useConfirm } from '@/components/ConfirmContext';
import { formatCurrency } from '@/lib/helpers';
import LoadingScreen from '@/components/LoadingScreen';
import { Pencil, Trash2 } from 'lucide-react';

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
    { header: 'كود الصنف', render: (row: any) => <strong style={{ color: 'var(--text-primary)' }}>{row.item_code || '---'}</strong> },
    { header: 'اسم الخريطة / الصنف', render: (row: any) => <span style={{ fontWeight: 900 }}>{row.item_name}</span> },
    { header: 'التصنيف الرئيسي', render: (row: any) => <span style={{ background: 'var(--surface-subcard)', color: 'var(--text-primary)', padding: '0.25rem 0.625rem', borderRadius: '8px', fontSize: 'var(--fs-sm)', fontWeight: 800 }}>{row.main_category || 'عام'}</span> },
    { header: 'الوحدة الافتراضية', render: (row: any) => <span style={{ fontWeight: 700 }}>{row.default_unit}</span> },
    { header: 'السعر الاسترشادي', render: (row: any) => <span style={{ color: 'var(--status-positive)', fontWeight: 900 }}>{formatCurrency(row.default_unit_price)}</span> },
    {
      header: 'الإجراءات',
      render: (row: any) => (
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button 
            onClick={() => { logic.setCurrentRecord(row); logic.setIsModalOpen(true); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-lg)', color: 'var(--accent-ink)' }} title="تعديل"
          ><Pencil size={14} aria-hidden="true" /></button>
          <button 
            onClick={() => {
              showConfirm({
                title: 'حذف صنف من الدليل',
                message: `هل أنت متأكد من حذف الصنف "${row.item_name}"؟ هذا الإجراء قد يؤثر على الفواتير المربوطة به إذا وجدت.`,
                type: 'danger',
                onConfirm: () => logic.deleteItem(row.id)
              });
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-lg)', color: 'var(--status-negative)' }} title="حذف"
          ><Trash2 size={14} aria-hidden="true" /></button>
        </div>
      )
    }
  ];

  const sidebarActions = (
    <button className="btn-main-glass gold" style={{ color: 'var(--action-ink)' }} onClick={() => {
      logic.setCurrentRecord({ item_code: '', item_name: '', main_category: '', default_unit: 'حبة', default_unit_price: 0, notes: '' });
      logic.setIsModalOpen(true);
    }}>إضافة صنف جديد</button>
  );

  const sidebarFilters = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.625rem' }}>
      <input type="text" placeholder="ابحث بالاسم أو الكود..." className="glass-input-field material-catalog-field" value={logic.searchQuery} onChange={e => logic.setSearchQuery(e.target.value)} />
      <select className="glass-input-field material-catalog-field" value={logic.filterCategory} onChange={e => logic.setFilterCategory(e.target.value)}>
        <option value="الكل">كل التصنيفات</option>
        {logic.categories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
      </select>
    </div>
  );

  return (
    <div className="clean-page">
      <MasterPage title="دليل أصناف الخامات الموحد" subtitle="تكويد وإدارة بنود التوريدات لمنع العشوائية في الفواتير">
        
        <RawasiSidebarManager 
          summary={
            <div className="material-catalog-summary">
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-secondary)' }}>إجمالي الأصناف المسجلة</span>
              <div className="val" style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.3125rem' }}>{logic.items.length} صنف</div>
            </div>
          }
          actions={sidebarActions}
          customFilters={sidebarFilters}
          watchDeps={[logic.items.length, logic.searchQuery, logic.filterCategory]}
        />

        <style>{`
          .material-catalog-field { width: 100%; padding: 0.75rem; border-radius: 12px; background: var(--surface-sunken); border: none !important; box-shadow: var(--shadow-sunken); font-weight: 700; color: var(--text-primary); }
          .material-catalog-field::placeholder { color: var(--text-muted); }
          .material-catalog-field:focus-visible { outline: 2px solid var(--accent-ink); outline-offset: 2px; }
          .material-catalog-summary { background: var(--surface-subcard); color: var(--text-primary); padding: 1.25rem; border-radius: 14px; }
        `}</style>

        {logic.isLoading ? (
          <LoadingScreen message="جاري تحميل الكتالوج الموحد..." fullScreen={false} />
        ) : (
          <div className="glass-card" style={{ background: 'var(--surface-card)', padding: '1.25rem', borderRadius: '14px' }}>
            <RawasiSmartTable data={logic.items} columns={tableColumns} enablePagination={true} />
          </div>
        )}

        {/* 🧱 مودال الإضافة والتعديل المخصص للأصناف */}
        {logic.isModalOpen && createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--modal-scrim)', padding: '1rem', backdropFilter: 'blur(15px)', direction: 'rtl' }}>
            <div style={{ background: 'var(--surface-card)', color: 'var(--text-primary)', padding: 'clamp(1rem, 6vw, 2.5rem)', borderRadius: '14px', width: '100%', maxWidth: '37.5rem', maxHeight: 'calc(100dvh - 2rem)', overflowY: 'auto', boxShadow: 'var(--shadow-elevation)' }}>
              <h3 style={{ fontWeight: 900, color: 'var(--text-primary)', marginBottom: '1.5625rem' }}>{logic.currentRecord.id ? 'تعديل صنف خامة' : 'إضافة صنف خامة جديد للدليل'}</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.9375rem' }}>
                  <div><label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900 }}>كود الصنف</label><input type="text" className="glass-input-field material-catalog-field" placeholder="MAT-001" value={logic.currentRecord.item_code || ''} onChange={e => logic.setCurrentRecord({...logic.currentRecord, item_code: e.target.value})} /></div>
                  <div><label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900 }}>اسم الخامة / الصنف الموحد</label><input type="text" className="glass-input-field material-catalog-field" placeholder="مثال: حديد تسليح عز 16 مم" value={logic.currentRecord.item_name || ''} onChange={e => logic.setCurrentRecord({...logic.currentRecord, item_name: e.target.value})} /></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '0.9375rem' }}>
                  <div><label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900 }}>التصنيف (النوع)</label><input type="text" className="glass-input-field material-catalog-field" placeholder="مثال: حديد، أسمنت، دهانات" value={logic.currentRecord.main_category || ''} onChange={e => logic.setCurrentRecord({...logic.currentRecord, main_category: e.target.value})} /></div>
                  <div><label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900 }}>الوحدة الافتراضية</label><input type="text" className="glass-input-field material-catalog-field" placeholder="طن، متر، كيس، حبة" value={logic.currentRecord.default_unit || ''} onChange={e => logic.setCurrentRecord({...logic.currentRecord, default_unit: e.target.value})} /></div>
                </div>

                <div><label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900 }}>السعر الاسترشادي المتوقع</label><input type="number" className="glass-input-field material-catalog-field" placeholder="0.00" value={logic.currentRecord.default_unit_price || ''} onChange={e => logic.setCurrentRecord({...logic.currentRecord, default_unit_price: Number(e.target.value)})} /></div>
                <div><label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900 }}>ملاحظات ومواصفات</label><textarea className="glass-input-field material-catalog-field" rows={2} placeholder="أي مواصفات فنية خاصة بالخامة..." value={logic.currentRecord.notes || ''} onChange={e => logic.setCurrentRecord({...logic.currentRecord, notes: e.target.value})}></textarea></div>
              </div>

              <div style={{ display: 'flex', gap: '0.9375rem', marginTop: '1.875rem' }}>
                <button onClick={logic.handleSave} disabled={logic.isSaving} className="btn-main-glass gold" style={{ flex: 2, color: 'var(--action-ink)' }}>{logic.isSaving ? 'جاري الحفظ...' : 'حفظ الصنف'}</button>
                <button onClick={() => logic.setIsModalOpen(false)} className="btn-main-glass white" style={{ flex: 1 }}>إلغاء</button>
              </div>
            </div>
          </div>,
          document.body
        )}

      </MasterPage>
    </div>
  );
}
