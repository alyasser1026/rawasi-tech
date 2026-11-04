"use client";
import React, { useState, useRef, useEffect } from 'react';

const THEME = {
  primary: '#0f172a', accent: '#c2410c', success: '#059669',
  slate: '#f8fafc', border: '#e2e8f0', textMain: '#334155', textMuted: '#64748b'
};

interface Option { id: string; name: string; }

interface RawasiMultiSelectProps {
  options: Option[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

export default function RawasiMultiSelect({ options, selectedIds, onChange, placeholder = "اختر الأسماء..." }: RawasiMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // إغلاق القائمة عند الضغط خارجها
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const selectedOptions = options.filter(opt => selectedIds.includes(opt.id));

  const toggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(item => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeOption = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onChange(selectedIds.filter(item => item !== id));
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', fontFamily: 'Cairo, sans-serif' }}>
      
      {/* 🚀 الحاوية الرئيسية (شريط العرض) */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ minHeight: '2.625rem', padding: '0.375rem 0.625rem', background: THEME.slate, border: `1px solid ${isOpen ? THEME.accent : THEME.border}`, borderRadius: '8px', cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center', transition: '0.2s' }}
      >
        {selectedOptions.length === 0 ? (
          <span style={{ color: THEME.textMuted, fontSize: 'var(--fs-sm)', fontWeight: 'bold', padding: '0.25rem' }}>{placeholder}</span>
        ) : (
          selectedOptions.map(opt => (
            <span key={opt.id} style={{ background: THEME.primary, color: 'white', fontSize: 'var(--fs-xs)', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {opt.name}
              <button onClick={(e) => removeOption(e, opt.id)} style={{ background: 'transparent', border: 'none', color: THEME.accent, cursor: 'pointer', padding: 0, fontSize: 'var(--fs-md)', lineHeight: 1 }}>×</button>
            </span>
          ))
        )}
      </div>

      {/* 🔍 القائمة المنسدلة (البحث والخيارات) */}
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, marginTop: '0.5rem', background: 'white', border: `1px solid ${THEME.border}`, borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 1000, overflow: 'hidden' }}>
          
          <div style={{ padding: '0.625rem', borderBottom: `1px solid ${THEME.border}`, background: '#f1f5f9' }}>
            <input 
              autoFocus
              type="text" 
              placeholder="ابحث بالاسم..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: `1px solid ${THEME.border}`, outline: 'none', fontWeight: 'bold', fontFamily: 'Cairo' }}
            />
          </div>

          <div style={{ maxHeight: '15.625rem', overflowY: 'auto', padding: '0.3125rem 0' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '0.9375rem', textAlign: 'center', color: THEME.textMuted, fontSize: 'var(--fs-sm)', fontWeight: 'bold' }}>لا يوجد أسماء مطابقة</div>
            ) : (
              filteredOptions.map(opt => (
                <div 
                  key={opt.id} 
                  onClick={() => toggleOption(opt.id)}
                  style={{ padding: '0.625rem 0.9375rem', display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', transition: '0.2s', background: selectedIds.includes(opt.id) ? '#fefce8' : 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = selectedIds.includes(opt.id) ? '#fefce8' : THEME.slate}
                  onMouseLeave={(e) => e.currentTarget.style.background = selectedIds.includes(opt.id) ? '#fefce8' : 'transparent'}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(opt.id)} 
                    readOnly
                    style={{ width: '1rem', height: '1rem', accentColor: THEME.primary, cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 'bold', color: THEME.primary, fontSize: 'var(--fs-sm)' }}>{opt.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}