"use client";
import React, { useState, useEffect, useRef } from 'react';
import { getActiveCompanyId, supabase } from '@/lib/supabase';
import { readCachedTableRows, writeCachedTableRows } from '@/lib/offline/referenceCache';
import { THEME } from '@/lib/theme';
import { usePermissions } from '@/lib/PermissionsContext'; // 🛡️ استدعاء مركز قيادة الصلاحيات
import { Clock, Hourglass, Lock } from 'lucide-react';
import PhiIcon from './PhiIcon';

interface SmartComboProps {
    label?: string;
    table?: string;          // للبحث في الداتابيز
    options?: any[];         // للبحث في مصفوفة محلية (بدون داتابيز)
    onSelect: (item: any) => void;
    placeholder?: string;
    searchCols?: string;     // الأعمدة اللي هيبحث فيها (مثال: 'name,code')
    displayCol?: string;     // العمود اللي هيتعرض (مثال: 'name')
    multi?: boolean;         // الاختيار المتعدد
    selectedValues?: any[];  // القيم المختارة مسبقاً (للمتعدد)
    initialDisplay?: string; // القيمة اللي هتظهر أول ما يفتح
    value?: string | number | null;
    customFilter?: string;
    displayFormat?: (item: any) => string; // 🚀 عرض مخصص للخيارات (مثال: دمج عمودين)
    customQuery?: (queryBuilder: any) => any; // فلترة متقدمة
    icon?: string;           // أيقونة للعنوان
    
    // 💡 خصائص إضافية مدمجة
    strict?: boolean;        // إجبار المستخدم على اختيار عنصر موجود بالقائمة فقط
    isTextArea?: boolean;    // تحويل المربع إلى Textarea
    disabled?: boolean;      // تعطيل الحقل
    freeText?: boolean;      // السماح بكتابة نصوص حرة مع الاحتفاظ بالاقتراحات
    
    // 🚀 مميزات الـ Enterprise
    allowAddNew?: boolean;         // إظهار زرار "إضافة جديد" في حالة عدم وجود نتائج
    requiredPermission?: { module: string, action: string }; // الصلاحية المطلوبة لظهور زر الإضافة
    onAddNew?: (val: string) => void; // الدالة اللي هتتنفذ لما يدوس "إضافة جديد"
    isSensitive?: boolean;         // تشفير/إخفاء البيانات الحساسة جزئياً
    showRecent?: boolean;          // إظهار آخر عمليات البحث أو الاختيارات
    enableClear?: boolean;         // تفعيل زرار مسح النص السريع (✖)
    showAvatar?: boolean;          // إظهار الصورة الشخصية (لو كان يوزر أو عميل)
    isMobileBottomSheet?: boolean; // تحويل القائمة لمودال سفلي في الجوال

    // 🛡️ [الجديد]: صلاحيات الوصول للحقل نفسه
    permModule?: string;           // الموديول المطلوب للوصول (مثال: receipts)
    permAction?: string;           // الصلاحية المطلوبة (مثال: financial)

    // 🔗 [الجديد السحري]: الفلاتر المتسلسلة (Chained Filters) لسحب البيانات الذكي
    filterColumn?: string;         // 🚀 إضافة استقبال الفلتر المنفصل المبعوث من الواجهة
    filterValue?: any;             // 🚀 إضافة استقبال قيمة الفلتر المنفصل المبعوث من الواجهة
    filter?: { column: string; value: any }; 
}

export default function SmartCombo({ 
    label, table, options, onSelect, placeholder, 
    searchCols = 'name,code', displayCol = 'name', 
    multi = false, selectedValues = [], initialDisplay = '', value, customFilter,
    displayFormat, customQuery, icon,
    strict = false, isTextArea = false, disabled = false, freeText = false,
    allowAddNew = false, requiredPermission, onAddNew, isSensitive = false, showRecent = false, 
    enableClear = false, showAvatar = false, isMobileBottomSheet = false,
    permModule, permAction,
    filterColumn, // 🚀 استلام اسم العمود الفلتر لمنع التكرار
    filterValue,  // 🚀 استلام قيمة الفلتر لمنع التكرار
    filter // 👈 استلام فلتر التصفية (مثال: project_id)
}: SmartComboProps) {
    
    const [search, setSearch] = useState<string>(initialDisplay || ''); 
    const [results, setResults] = useState<any[]>([]);
    const [recentItems, setRecentItems] = useState<any[]>([]); 
    const [show, setShow] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(false); 
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    const listRef = useRef<HTMLDivElement>(null);
    const comboRef = useRef<HTMLDivElement>(null);

    // 🛡️ [نظام الصلاحيات المركزي]: حماية ذكية للحقل
    let can = (module: string, action: string) => true; 
    let permsLoading = false;
    try {
        const perms = usePermissions();
        if (perms && typeof perms.can === 'function') {
            can = perms.can;
            permsLoading = perms.loading;
        }
    } catch (e) {
        // حماية ضد الأعطال لو الكونتيكست مش موجود
    }

    // 1. فحص هل المستخدم يمتلك صلاحية لفتح وتعديل هذا الحقل تحديداً؟
    const hasFieldAccess = (!permModule || !permAction) ? true : can(permModule, permAction);
    // 2. فحص هل المستخدم يمتلك صلاحية الإضافة؟
    const hasAddPermission = requiredPermission ? can(requiredPermission.module, requiredPermission.action) : true;

    // 🚀 [رفع الحساسية]: توحيد الحروف
    const normalizeText = (text: any) => {
        return String(text || '')
            .toLowerCase()
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/\s+/g, ' ')
            .trim();
    };

    // 🕵️‍♂️ [الخصوصية]: التشفير
    const applyMask = (text: string) => {
        if (!isSensitive || !text) return text;
        if (text.length <= 4) return '***';
        const first2 = text.slice(0, 2);
        const last2 = text.slice(-2);
        return `${first2}****${last2}`;
    };

    // 📱 كشف الشاشة للمودال السفلي
    useEffect(() => {
        if (isMobileBottomSheet) {
            const checkMobile = () => setIsMobile(window.innerWidth <= 768);
            checkMobile();
            window.addEventListener('resize', checkMobile);
            return () => window.removeEventListener('resize', checkMobile);
        }
    }, [isMobileBottomSheet]);

    // 👥 جلب History
    useEffect(() => {
        if (showRecent) {
            const key = `smartcombo_recent_${getActiveCompanyId() ?? 'none'}_${table || label || 'global'}`;
            const saved = localStorage.getItem(key);
            if (saved) setRecentItems(JSON.parse(saved));
        }
    }, [showRecent, table, label]);

    // 🔄 حفظ في History
    const saveToRecent = (item: any) => {
        if (!showRecent) return;
        const key = `smartcombo_recent_${getActiveCompanyId() ?? 'none'}_${table || label || 'global'}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const updated = [item, ...existing.filter((i:any) => i.id !== item.id)].slice(0, 5);
        localStorage.setItem(key, JSON.stringify(updated));
        setRecentItems(updated);
    };

    // 🔄 تحديث القيمة الافتراضية
    useEffect(() => {
        if (initialDisplay !== undefined) setSearch(initialDisplay);
        else if (!multi && !freeText) setSearch('');
    }, [initialDisplay, multi, freeText]);

    useEffect(() => {
        if (value === null || value === '') setSearch('');
    }, [value]);

    useEffect(() => {
        if (value === undefined || value === null || value === '' || initialDisplay || !hasFieldAccess) return;
        let cancelled = false;
        const showValue = (item: any) => {
            if (!item || cancelled) return;
            setSearch(typeof item === 'object' ? (displayFormat ? displayFormat(item) : String(item[displayCol] || item.name || item.Property || '')) : String(item));
        };
        const selected = options?.find(item => typeof item === 'object' ? String(item.id) === String(value) : String(item) === String(value));
        if (selected) showValue(selected);
        else if (table) {
            void supabase.from(table).select('*').eq('id', value).maybeSingle().then(({ data, error }) => {
                if (!error && data) showValue(data);
                else void readCachedTableRows(table).then(rows => {
                    const cachedRow = rows.find(r => String(r?.id) === String(value));
                    if (cachedRow) showValue(cachedRow);
                });
            });
        }
        return () => { cancelled = true; };
    }, [value, initialDisplay, options, table, displayCol, displayFormat, hasFieldAccess]);

    // 📡 دالة البحث الذكية (مع دعم الفلاتر المتسلسلة 🚀)
    const loadData = async (query = '') => {
        if (!hasFieldAccess) return; 
        setIsLoading(true);
        try {
            if (options && options.length > 0) {
                const normQuery = normalizeText(query);
                const filtered = options.filter((o: any) => {
                    const textToSearch = typeof o === 'object' ? (o[displayCol] || o.item_name || o.Property || o.name || o.description || '') : o;
                    return normalizeText(textToSearch).includes(normQuery);
                }).slice(0, 20); 
                setResults(filtered);
                return;
            }

            if (!table) return;
            const filterLocalRows = (rows: any[]) => {
                const activeColumnLocal = filterColumn || filter?.column;
                const activeValueLocal = filterValue !== undefined ? filterValue : filter?.value;
                const normQ = normalizeText(query);
                const cols = searchCols.split(',').map(c => c.trim()).filter(Boolean);
                return (rows || []).filter((r: any) => {
                    if (!r) return false;
                    if (table === 'accounts' && r.is_transactional === false) return false;
                    if (activeColumnLocal && activeValueLocal && String(r[activeColumnLocal]) !== String(activeValueLocal)) return false;
                    if (customFilter) {
                        const m = /^([^=]+)=([a-z]+)\.(.*)$/.exec(customFilter);
                        if (m) {
                            const [, col, op, val] = m;
                            if (op === 'eq' && String(r[col]) !== val) return false;
                            if (op === 'neq' && String(r[col]) === val) return false;
                        }
                    }
                    if (!normQ) return true;
                    return cols.some(col => normalizeText(r[col]).includes(normQ)) || normalizeText(r[displayCol] || r.name || '').includes(normQ);
                }).slice(0, 20);
            };
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                const cached = await readCachedTableRows(table);
                setResults(filterLocalRows(cached));
                return;
            }
            let q = supabase.from(table).select('*').limit(20); 
            
            if (table === 'accounts') q = q.eq('is_transactional', true);
            
            // 🔗 🚀 [تحديث ذكي]: دمج قراءة الفلتر سواء مبعوث كـ Object أو Props منفصلة لمنع تكرار البنود
            const activeColumn = filterColumn || filter?.column;
            const activeValue = filterValue !== undefined ? filterValue : filter?.value;

            if (activeColumn && activeValue) {
                q = q.eq(activeColumn, activeValue);
            }

            if (customQuery) q = customQuery(q);
            if (customFilter) {
                const match = /^([^=]+)=([a-z]+)\.(.*)$/.exec(customFilter);
                if (!match) throw new Error('Invalid SmartCombo filter');
                q = q.filter(match[1], match[2], match[3]);
            }

            if (query) {
                const orQuery = searchCols.split(',').map((col: string) => `${col}.ilike.%${query}%`).join(',');
                q = q.or(orQuery);
            }
            
            const { data, error } = await q;
            if (!error) {
                setResults(data || []);
                if (data && data.length > 0) void writeCachedTableRows(table, data);
            } else {
                const cached = await readCachedTableRows(table);
                setResults(filterLocalRows(cached));
            }
        } catch (error) {
            console.error("SmartCombo Error:", error);
            if (table) {
                const cached = await readCachedTableRows(table);
                setResults(cached.slice(0, 20));
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ⏱️ [الحساسية القصوى]: 150ms (ومراقبة الفلتر)
    useEffect(() => {
        const searchLen = search?.length || 0; 
        const hasFilter = filter || (filterColumn && filterValue);
        if (searchLen < 1 && !show && !hasFilter) { setResults([]); return; }
        
        const timer = setTimeout(() => {
            if (show && hasFieldAccess) loadData(search);
        }, 150); 
        
        return () => clearTimeout(timer);
        // 🚀 تم إضافة ومراقبة filterColumn و filterValue لإعادة السحب فوراً عند تغيير الفيلا
    }, [search, table, options, show, hasFieldAccess, filter, filterColumn, filterValue, customFilter]);

    useEffect(() => {
        if (!show || disabled) return;
        const closeOutside = (event: PointerEvent) => {
            if (event.target instanceof Node && !comboRef.current?.contains(event.target)) {
                setShow(false);
                setHighlightedIndex(-1);
            }
        };
        document.addEventListener('pointerdown', closeOutside, true);
        return () => document.removeEventListener('pointerdown', closeOutside, true);
    }, [show, disabled]);

    // 🖱️ Scroll
    useEffect(() => {
        if (highlightedIndex >= 0 && listRef.current) {
            const container = listRef.current;
            const activeElement = container.children[highlightedIndex] as HTMLElement;
            if (activeElement) {
                const elementTop = activeElement.offsetTop;
                const elementBottom = elementTop + activeElement.clientHeight;
                const containerTop = container.scrollTop;
                const containerBottom = containerTop + container.clientHeight;

                if (elementTop < containerTop) container.scrollTop = elementTop;
                else if (elementBottom > containerBottom) container.scrollTop = elementBottom - container.clientHeight;
            }
        }
    }, [highlightedIndex]);

    const handleItemSelect = (item: any, e?: React.MouseEvent | React.KeyboardEvent) => {
        if (e) e.stopPropagation();
        if (!hasFieldAccess) return;

        const isPrimitive = typeof item !== 'object';
        const displayName = isPrimitive ? item : (displayFormat ? displayFormat(item) : (item[displayCol] || item.Property || item.project_name || item.item_name || item.name || item.description || 'بدون اسم'));
        
        saveToRecent(item); 
        
        if (multi) {
            onSelect(item);
        } else {
            onSelect(item);
            setSearch(isSensitive ? applyMask(displayName) : displayName);
            setShow(false);
            setHighlightedIndex(-1);
        }
    };

    // 🚨 Strict Mode
    const handleBlur = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (comboRef.current?.contains(event.relatedTarget)) return;
        if (strict && search && !multi && !freeText && hasFieldAccess) {
            const match = results.find(item => {
                const isPrimitive = typeof item !== 'object';
                const lbl = isPrimitive ? item : (displayFormat ? displayFormat(item) : (item[displayCol] || item.Property || item.name || item.description));
                return normalizeText(lbl) === normalizeText(search);
            });
            if (!match) {
                setSearch('');
                onSelect('');
            }
        }
        setShow(false);
        setHighlightedIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.ctrlKey || e.metaKey) return;
        if (!hasFieldAccess) return;
        if (!show && e.key !== 'Tab') {
            if (e.key === 'ArrowDown') { setShow(true); loadData(search || ''); }
            return;
        }
        switch (e.key) {
            case 'ArrowDown': e.preventDefault(); setHighlightedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev)); break;
            case 'ArrowUp': e.preventDefault(); setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev)); break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && results[highlightedIndex]) {
                    handleItemSelect(results[highlightedIndex]);
                } else if (freeText) {
                    setShow(false);
                } else if (allowAddNew && results.length === 0 && search.length > 0 && onAddNew && hasAddPermission) {
                    onAddNew(search);
                    setShow(false);
                }
                break;
            case 'Escape':
            case 'Tab':
                setShow(false); setHighlightedIndex(-1); break;
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!hasFieldAccess) return;
        setSearch('');
        onSelect(null);
        setShow(true);
        loadData('');
    };

    const InputElement = isTextArea ? 'textarea' : 'input';

    const dropdownStyle: React.CSSProperties = (isMobile && isMobileBottomSheet) 
        ? { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99999, background: '#fff', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.25rem 0.9375rem', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 -15px 40px rgba(0,0,0,0.15)', animation: 'slideUp 0.3s ease-out' }
        : { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 2000, maxHeight: '15.625rem', overflowY: 'auto', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(20px)', borderRadius: '16px', padding: '0.5rem', boxShadow: '0 15px 40px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.05)', marginTop: '0.3125rem' };

    const renderListItem = (item: any, index: number, isRecent = false) => {
        const isPrimitive = typeof item !== 'object';
        const displayName = isPrimitive ? item : (displayFormat ? displayFormat(item) : (item[displayCol] || item.Property || item.project_name || item.item_name || item.name || item.description || 'بدون اسم'));
        const displayCode = isPrimitive ? '' : (item.project_code || item.item_code || item.code); 
        const itemId = isPrimitive ? item : item.id;
        const isSelected = multi ? selectedValues.some((v: any) => (v.id || v) === itemId) : false;
        const isHighlighted = index === highlightedIndex && !isRecent; 

        return (
            <div key={`${isRecent ? 'recent' : 'res'}_${isPrimitive ? index : item.id}`} 
                 onMouseDown={(e) => { if (e.button === 0) e.preventDefault(); }}
                 onClick={(e) => handleItemSelect(item, e)} 
                 className={`smart-drop-item ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}>
                
                {multi && <input type="checkbox" checked={isSelected} readOnly style={{ width: '1.125rem', height: '1.125rem', accentColor: THEME.success, cursor: 'pointer', flexShrink: 0 }} />}
                {showAvatar && !isPrimitive && <img src={item.avatar_url || `https://ui-avatars.com/api/?name=${displayName}&background=random`} alt="avatar" style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', flexShrink: 0, border: '1px solid #e2e8f0' }} />}
                
                <div style={{ wordBreak: 'break-word', flex: 1 }}>
                    <span style={{ fontWeight: 900, color: THEME.primary, opacity: 0.7, fontSize: 'var(--fs-xs)', marginLeft: displayCode ? '0.3125rem' : '0' }}>
                        {displayCode ? `[${isSensitive ? applyMask(displayCode) : displayCode}] ` : ''}
                    </span> 
                    {isSensitive ? applyMask(displayName) : displayName}
                </div>
                
                {isRecent && <span style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8' }}><Clock size={14} aria-hidden="true" /></span>}
            </div>
        );
    };

    // ⛔ [شاشة الرفض المقفلة]: تظهر في حالة عدم توفر الصلاحية
    if (!hasFieldAccess && !permsLoading) {
        return (
            <div style={{ position: 'relative', flex: 1, width: '100%', opacity: 0.7 }} title="ليس لديك صلاحية للوصول لهذا الحقل">
                {label && (
                    <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3125rem', marginBottom: '0.5rem' }}>
                        {icon && <PhiIcon value={icon} size={14} />} {label} <Lock size={12} aria-hidden="true" />
                    </label>
                )}
                <div className="smart-combo-input disabled" style={{ 
                    background: 'rgba(0,0,0,0.03)', cursor: 'not-allowed', color: '#94a3b8', 
                    border: '1px dashed #cbd5e1', minHeight: isTextArea ? '5.625rem' : 'auto', 
                    display: 'flex', alignItems: isTextArea ? 'flex-start' : 'center',
                    padding: '0.875rem 0.9375rem'
                }}>
                    {initialDisplay || search || 'محمي ومقفل...'}
                </div>
            </div>
        );
    }

    return (
        <div ref={comboRef} style={{ position: 'relative', flex: 1, width: '100%' }}>
            <style>{`
                .smart-combo-input {
                    width: 100%; padding: 0.625rem 0.75rem; border-radius: 12px;
                    background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(10px);
                    border: 1.5px solid rgba(255, 255, 255, 0.8); outline: none;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    font-weight: 800; color: #1e293b; font-size: var(--fs-sm);
                    font-family: inherit; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                }
                .smart-combo-input:focus { background: #ffffff; border-color: ${THEME.accent}; box-shadow: 0 0 0 4px ${THEME.accent}20; }
                .smart-combo-input::placeholder { color: #94a3b8; font-weight: 600; }
                .smart-combo-input.disabled { background: rgba(0,0,0,0.05); cursor: not-allowed; color: #64748b; border-color: transparent; }
                .smart-drop-item { padding: 0.625rem; cursor: pointer; border-radius: 10px; font-size: var(--fs-sm); transition: all 0.1s; display: flex; align-items: center; gap: 0.5rem; color: #334155; }
                .smart-drop-item:hover { background: #f8fafc; }
                .smart-drop-item.highlighted { background: #f1f5f9; border-right: 4px solid ${THEME.primary}; color: ${THEME.primary}; font-weight: 800; }
                .smart-drop-item.selected { background: ${THEME.success}10; border-right: 4px solid ${THEME.success}; color: ${THEME.success}; font-weight: 800; }
                .cinematic-scroll::-webkit-scrollbar { width: 0.375rem; }
                .cinematic-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .cinematic-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            `}</style>

            {label && (
                <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'flex', alignItems: 'center', gap: '0.3125rem', marginBottom: '0.5rem' }}>
                    {icon && <PhiIcon value={icon} size={14} />}
                    {label}
                </label>
            )}
            
            <div style={{ position: 'relative', display: 'flex', alignItems: isTextArea ? 'flex-start' : 'center' }}>
                <InputElement 
                    aria-label={label || placeholder || 'اختيار قيمة'}
                    disabled={disabled}
                    placeholder={placeholder || (isLoading ? 'جاري البحث...' : 'ابحث هنا...')}
                    value={search ?? ''} 
                    onChange={(e: any) => { setSearch(e.target.value); setShow(true); setHighlightedIndex(-1); if(freeText) onSelect(e.target.value); }}
                    onFocus={() => { if (!disabled) { setShow(true); loadData(search || ''); } }}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown} 
                    className={`smart-combo-input ${disabled ? 'disabled' : ''}`}
                    style={{ resize: isTextArea ? 'vertical' : 'none', minHeight: isTextArea ? '5.625rem' : 'auto', paddingLeft: (!isTextArea && !disabled) ? (enableClear && search ? '3.75rem' : '2.1875rem') : '0.9375rem' }}
                />
                
                {enableClear && search && !disabled && (
                    <span onMouseDown={e => e.preventDefault()} onClick={handleClear} style={{ position: 'absolute', left: '2.1875rem', top: isTextArea ? '0.9375rem' : '50%', transform: isTextArea ? 'none' : 'translateY(-50%)', fontSize: 'var(--fs-md)', color: '#ef4444', cursor: 'pointer', padding: '0.3125rem', fontWeight: 900, background: '#fee2e2', borderRadius: '50%', width: '1.375rem', height: '1.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="مسح">
                        ×
                    </span>
                )}

                {!isTextArea && !disabled && (
                    <span onMouseDown={e => e.preventDefault()} onClick={() => { if(!disabled) { setShow(!show); if(!show) loadData(search || ''); } }} style={{ position: 'absolute', left: '0.9375rem', fontSize: 'var(--fs-xs)', color: '#64748b', cursor: 'pointer', padding: '0.3125rem', transition: '0.2s', transform: show ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        ▼
                    </span>
                )}
                
                {isLoading && <div style={{ position: 'absolute', left: enableClear && search ? '4.0625rem' : '2.1875rem', top: isTextArea ? '1.25rem' : '50%', transform: isTextArea ? 'none' : 'translateY(-50%)', fontSize: 'var(--fs-sm)' }}><Hourglass size={14} aria-hidden="true" /></div>}
            </div>

            {show && !disabled && (
                <>
                    {isMobile && isMobileBottomSheet && <div onClick={() => setShow(false)} style={{ position: 'fixed', inset: 0, zIndex: 1999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)' }} />}
                    <div ref={listRef} className="cinematic-scroll" style={dropdownStyle}>
                        {isMobile && isMobileBottomSheet && <div style={{ width: '2.5rem', height: '0.3125rem', background: '#cbd5e1', borderRadius: '10px', margin: '0 auto 0.9375rem auto' }} />}
                        {(results?.length || 0) === 0 && (search?.length || 0) > 0 && !isLoading && (
                            <div style={{ padding: '0.9375rem', textAlign: 'center' }}>
                                <p style={{ fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 800, margin: '0 0 0.625rem 0' }}>لا توجد نتائج لـ "<span style={{color: THEME.ruby}}>{search}</span>"</p>
                                {allowAddNew && onAddNew && hasAddPermission && (
                                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onAddNew(search); setShow(false); }} style={{ background: THEME.success, color: 'white', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', fontSize: 'var(--fs-sm)', boxShadow: `0 5px 15px ${THEME.success}40`, width: '100%' }}>
                                        إضافة "{search}" كجديد
                                    </button>
                                )}
                            </div>
                        )}
                        {(results?.length || 0) === 0 && (search?.length || 0) === 0 && showRecent && (recentItems?.length || 0) > 0 && !isLoading && (
                            <div>
                                <div style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', fontWeight: 900, marginBottom: '0.5rem', padding: '0 0.625rem' }}>آخر الاختيارات</div>
                                {recentItems.map((item, index) => renderListItem(item, index, true))}
                                <div style={{ height: '1px', background: '#f1f5f9', margin: '0.625rem 0' }} />
                            </div>
                        )}
                        {results.length > 0 && results.map((item, index) => renderListItem(item, index, false))}
                    </div>
                </>
            )}
        </div>
    );
}
