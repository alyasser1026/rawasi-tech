"use client";
import React, { useState } from 'react';
import { THEME } from '@/lib/theme';
import PhiIcon from './PhiIcon';

interface KPI {
  title: string;
  value: string | number;
  color: string;
  icon: string;
}

interface OperationsCenterProps {
  title: string;
  kpis: KPI[];
  searchQuery: string;
  onSearchChange: (val: string) => void;
  filtersSlot?: React.ReactNode; 
  selectedCount: number; 
  onAdd: () => void;
  onEdit?: () => void;
  onDeleteSelected: () => void;
  onPostSelected: () => void; 
  onUnpostSelected: () => void; 
  // 💡 الخاصية اختيارية (Optional) عشان منبوظش باقي الصفحات اللي بتستخدم المكون
  onRefundSelected?: () => void; 
}

export function OperationsCenter({ 
  title, kpis, searchQuery, onSearchChange, filtersSlot, 
  selectedCount, onAdd, onEdit, onDeleteSelected, onPostSelected, onUnpostSelected, onRefundSelected 
}: OperationsCenterProps) {
  
  const [isOpen, setIsOpen] = useState(false);
  const hasSelection = selectedCount > 0;
  const isSingleSelection = selectedCount === 1;

  // ستايل موحد للأزرار لضمان المظهر الاحترافي
  const btnStyle = {
    padding: '14px',
    borderRadius: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.3s',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    fontSize: '14px'
  };

  return (
    <>
      {/* الزر العائم لفتح المركز */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed', top: '120px', right: isOpen ? '380px' : '0px',
          zIndex: 1001, background: THEME.primary, color: 'white',
          border: 'none', padding: '15px 20px', borderRadius: '12px 0 0 12px',
          cursor: 'pointer', transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '-5px 0 20px rgba(0,0,0,0.2)', fontWeight: 900,
          display: 'flex', alignItems: 'center', gap: '10px'
        }}
      >
        {isOpen ? '◀' : 'مركز العمليات'}
      </button>

      {/* الستارة الخلفية */}
      {isOpen && (
        <div onClick={() => setIsOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.3)', zIndex: 999, backdropFilter: 'blur(4px)' }} />
      )}

      {/* الجانب الأيمن (Sidebar) */}
      <div style={{
        position: 'fixed', top: 0, right: isOpen ? 0 : '-400px',
        width: '380px', height: '100vh', zIndex: 1000,
        background: 'white', borderLeft: '1px solid rgba(0,0,0,0.05)',
        boxShadow: '-15px 0 50px rgba(0,0,0,0.1)',
        padding: '40px 25px', display: 'flex', flexDirection: 'column', gap: '25px',
        transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)', direction: 'rtl', overflowY: 'auto' 
      }}>
        
        <div style={{ borderBottom: `2px solid ${THEME.primary}20`, paddingBottom: '15px' }}>
            <h2 style={{ color: THEME.primary, fontWeight: 900, margin: 0, fontSize: '20px' }}>{title}</h2>
        </div>

        {/* كروت المؤشرات المالية */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            {kpis.map((kpi, idx) => (
              <div key={idx} style={{ background: '#f8fafc', padding: '15px', borderRadius: '16px', border: `1px solid ${kpi.color}20`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>{kpi.title}</div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: kpi.color }}>{kpi.value}</div>
                  </div>
                  <div style={{ display: 'inline-flex', opacity: 0.8 }}><PhiIcon value={kpi.icon} size={22} /></div>
              </div>
            ))}
        </div>

        {/* أدوات البحث والفلترة */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '13px', fontWeight: 900, color: THEME.primary }}>البحث السريع</label>
            <input 
              type="text" 
              placeholder="ابحث برقم السند أو اسم العميل..."
              value={searchQuery} 
              onChange={(e) => onSearchChange(e.target.value)} 
              style={{ padding: '12px', borderRadius: '12px', border: `1.5px solid #e2e8f0`, outline: 'none', fontSize: '14px' }} 
            />
            {filtersSlot}
        </div>

        {/* 🚀 أدوات الترحيل والعمليات */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            <button onClick={() => { onAdd(); setIsOpen(false); }} style={{ ...btnStyle, background: THEME.primary, color: 'white', fontSize: '16px', boxShadow: `0 8px 15px ${THEME.primary}30` }}>
              إضافة جديد
            </button>

            {/* صندوق الأدوات الجماعية - يظهر فقط عند الاختيار */}
            <div style={{ 
              maxHeight: hasSelection ? '500px' : '0', 
              opacity: hasSelection ? 1 : 0,
              overflow: 'hidden', 
              transition: 'all 0.5s ease', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px',
              padding: hasSelection ? '20px 15px' : '0 15px',
              background: '#f1f5f9',
              borderRadius: '14px',
              border: '1px solid #e2e8f0'
            }}>
                <div style={{ textAlign: 'center', fontSize: '12px', color: THEME.primary, fontWeight: 900, marginBottom: '5px' }}>
                   أدوات التحكم ({selectedCount}) سجل مختار
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button onClick={onPostSelected} style={{ ...btnStyle, background: THEME.success, color: 'white' }}>
                      ترحيل
                    </button>
                    <button onClick={onUnpostSelected} style={{ ...btnStyle, background: THEME.accent, color: 'white' }}>
                      فك ترحيل
                    </button>
                </div>

                {/* 🚀 زر الإرجاع يظهر فقط لو الصفحة بعتت دالة onRefundSelected */}
                {onRefundSelected && (
                    <button onClick={onRefundSelected} style={{ ...btnStyle, background: 'white', color: THEME.ruby, border: `1.5px solid ${THEME.ruby}50` }}>
                      إرجاع السداد
                    </button>
                )}

                {isSingleSelection && onEdit && (
                    <button onClick={() => { onEdit(); setIsOpen(false); }} style={{ ...btnStyle, background: '#e2e8f0', color: THEME.primary }}>
                      تعديل البيانات
                    </button>
                )}

                <button onClick={onDeleteSelected} style={{ ...btnStyle, background: '#fee2e2', color: THEME.ruby, border: `1.5px solid ${THEME.ruby}30` }}>
                  حذف نهائي
                </button>
            </div>
        </div>
      </div>
    </>
  );
}

// مكون الترقيم (Pagination) بتصميم متناسق
export function PaginationPanel({ totalItems, currentPage, rowsPerPage, onPageChange, onRowsChange }: any) {
  const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
  const btnActionStyle = { padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600 };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '15px 25px', borderRadius: '16px', marginTop: '20px', direction: 'rtl', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: '14px', color: '#64748b' }}>
        <span>عرض: </span>
        <select 
          value={rowsPerPage} 
          onChange={(e) => onRowsChange(Number(e.target.value))}
          style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', margin: '0 5px', outline: 'none' }}
        >
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span> من {totalItems} سجل</span>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          onClick={() => onPageChange(currentPage - 1)} 
          disabled={currentPage === 1}
          style={{ ...btnActionStyle, opacity: currentPage === 1 ? 0.5 : 1 }}
        >
          السابق
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ color: THEME.primary, fontWeight: 900 }}>{currentPage}</span>
          <span style={{ color: '#cbd5e1' }}>/</span>
          <span style={{ color: '#64748b' }}>{totalPages}</span>
        </div>

        <button 
          onClick={() => onPageChange(currentPage + 1)} 
          disabled={currentPage === totalPages}
          style={{ ...btnActionStyle, opacity: currentPage === totalPages ? 0.5 : 1 }}
        >
          التالي
        </button>
      </div>
    </div>
  );
}