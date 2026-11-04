"use client";
import React, { useState, useRef, useEffect } from 'react';
import { THEME } from '@/lib/theme';

export const UniversalAutocomplete = ({ label, value, onChange, options, placeholder, strict = false, isTextArea = false, disabled = false, freeText = false }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen && !freeText) {
      const selectedOption = (options || []).find((o: any) => String(o.id || o) === String(value));
      const labelToShow = typeof selectedOption === 'object' ? (selectedOption.display || selectedOption.item_name || selectedOption.Property || selectedOption.name) : selectedOption;
      setSearch(labelToShow || '');
    } else if (freeText && value) {
      setSearch(value);
    }
  }, [value, isOpen, options, freeText]);

  useEffect(() => { 
    const click = (e:any) => { if(ref.current && !ref.current.contains(e.target)) setIsOpen(false); }; 
    document.addEventListener('mousedown', click); 
    return () => document.removeEventListener('mousedown', click); 
  }, []);

  const normalizeText = (text: any) => String(text || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();

  const filtered = (options || []).filter((o:any) => {
    const textToSearch = typeof o === 'object' ? (o.display || o.item_name || o.Property || o.name || '') : o;
    return normalizeText(textToSearch).includes(normalizeText(search));
  }).slice(0, 15);

  const handleSelect = (opt: any) => {
     const actualValue = typeof opt === 'object' ? (opt.id || opt.display || opt) : opt;
     const displayLabel = typeof opt === 'object' ? (opt.display || opt.item_name || opt.Property || opt.name || opt) : opt;
     setSearch(displayLabel);
     onChange(actualValue); 
     setIsOpen(false);
     setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: any) => {
    if (!isOpen || filtered.length === 0) {
       if (e.key === 'ArrowDown') setIsOpen(true);
       return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev)); } 
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1)); } 
    else if (e.key === 'Enter' || e.key === 'Tab') { 
        if (highlightedIndex >= 0) { e.preventDefault(); handleSelect(filtered[highlightedIndex]); } 
        else if (freeText) { setIsOpen(false); }
    } 
    else if (e.key === 'Escape') { setIsOpen(false); }
  };

  const handleBlur = () => {
     if (strict && search) {
        const match = options.find((o:any) => {
            const lbl = typeof o === 'object' ? (o.display || o.item_name || o.Property || o.name) : o;
            return String(lbl) === search;
        });
        if (!match) { setSearch(''); onChange(''); }
     }
     setTimeout(() => { setIsOpen(false); }, 200); 
  };

  const InputElement = isTextArea ? 'textarea' : 'input';

  return (
    <div style={{ position: 'relative', marginBottom: '15px' }} ref={ref}>
      {label && <label className="label-royal" style={{display: 'block', fontWeight: 900, fontSize: '14px', color: THEME.primary, marginBottom: '6px'}}>{label}</label>}
      <div onClick={() => !disabled && setIsOpen(true)} style={{ minHeight: isTextArea ? '80px' : '45px', padding: isTextArea ? '10px 12px' : '0 12px', borderRadius: '10px', border: `2px solid ${THEME.border}`, background: disabled ? '#f1f5f9' : '#ffffff', display: 'flex', alignItems: isTextArea ? 'flex-start' : 'center', cursor: disabled ? 'not-allowed' : 'text', color: '#000000', fontWeight: 900, fontSize: '15px' }}>
        <InputElement 
          disabled={disabled}
          style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', color: '#000000', fontWeight: 900, fontSize: '16px', resize: isTextArea ? 'vertical' : 'none', minHeight: isTextArea ? '70px' : 'auto' }}
          placeholder={placeholder}
          value={search}
          onChange={(e:any) => { setSearch(e.target.value); if(freeText) onChange(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur} 
          onKeyDown={handleKeyDown} 
        />
        {!isTextArea && <span style={{ fontSize: '10px', color: '#000000', cursor: 'pointer', paddingRight: '5px' }} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>▼</span>}
      </div>
      {isOpen && filtered.length > 0 && !disabled && (
         <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, background: '#ffffff', zIndex: 10000, border: `2px solid ${THEME.accent}`, borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', maxHeight: '200px', overflowY: 'auto', marginTop: '5px' }}>
          {filtered.map((o:any, i:number) => (
              <div key={i} onMouseDown={(e) => { e.preventDefault(); handleSelect(o); }} onMouseEnter={() => setHighlightedIndex(i)} 
                style={{ padding: '12px 15px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '15px', fontWeight: 900, color: '#000000', backgroundColor: highlightedIndex === i ? '#fef3c7' : 'transparent' }}>
                {typeof o === 'object' ? (o.display || o.item_name || o.Property || o.name) : o}
              </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const MultiSelectAutocomplete = ({ label, selectedValues = [], onChange, options = [], placeholder }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const click = (e:any) => { if(ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', click);
    return () => document.removeEventListener('mousedown', click);
  }, []);

  const normalizeText = (text: any) => String(text || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();

  const filteredOptions = (options || []).filter((o:any) => {
    const textToSearch = typeof o === 'object' ? (o.display || o.Property || o.name || '') : o;
    return normalizeText(textToSearch).includes(normalizeText(search));
  });

  const selectedDisplays = options.filter((o:any) => selectedValues.includes(o.id)).map((o:any) => o.display || o.Property).join('، ');

  const toggleSelection = (id: any) => {
     if (selectedValues.includes(id)) { onChange(selectedValues.filter((v:any) => v !== id)); } 
     else { onChange([...selectedValues, id]); }
  };

  return (
    <div style={{ position: 'relative', marginBottom: '15px' }} ref={ref}>
      {label && <label className="label-royal" style={{display: 'block', fontWeight: 900, fontSize: '14px', color: THEME.primary, marginBottom: '6px'}}>{label}</label>}
      <div onClick={() => setIsOpen(!isOpen)} style={{ minHeight: '45px', padding: '10px 12px', borderRadius: '10px', border: `2px solid ${THEME.border}`, background: '#ffffff', display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#000000', fontWeight: 900, fontSize: '15px' }}>
        <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: selectedDisplays ? '#000' : '#9ca3af' }}>
           {selectedDisplays || placeholder}
        </div>
        <span style={{ fontSize: '10px', color: '#000000', paddingRight: '5px' }}>▼</span>
      </div>
      
      {isOpen && (
         <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, background: '#ffffff', zIndex: 10000, border: `2px solid ${THEME.accent}`, borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', maxHeight: '300px', display: 'flex', flexDirection: 'column', marginTop: '5px', overflow: 'hidden' }}>
          <div style={{ padding: '10px', borderBottom: `2px solid ${THEME.border}`, backgroundColor: '#f8fafc' }}>
             <input autoFocus type="text" placeholder="ابحث عن اسم أو كود العقار..." value={search} onChange={(e) => setSearch(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${THEME.border}`, outline: 'none', fontWeight: 900, fontSize: '14px', color: '#000' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredOptions.length > 0 ? filteredOptions.map((o:any, i:number) => (
                  <div key={i} onClick={(e) => { e.stopPropagation(); toggleSelection(o.id); }} style={{ padding: '12px 15px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '15px', fontWeight: 900, color: '#000000', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: selectedValues.includes(o.id) ? '#fef3c7' : 'transparent' }}>
                    <input type="checkbox" checked={selectedValues.includes(o.id)} readOnly style={{ width: '18px', height: '18px', accentColor: THEME.accent, cursor: 'pointer' }} />
                    <span>{o.display || o.Property}</span>
                  </div>
              )) : (
                  <div style={{ padding: '15px', textAlign: 'center', color: '#9ca3af', fontWeight: 900, fontSize: '14px' }}>لا توجد عقارات مطابقة لبحثك</div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};