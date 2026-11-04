"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { THEME } from '@/lib/theme';

export default function ProjectBoqCombo({ projectId, value, initialDisplay, onSelect, placeholder = "اختر البند / أمر الشغل..." }: any) {
    const [options, setOptions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [displayVal, setDisplayVal] = useState(initialDisplay || '');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // إغلاق القائمة عند النقر خارجها
    useEffect(() => {
        const handleClickOutside = (event: any) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 🚀 السحر هنا: مراقبة الـ projectId وجلب الداتا من الداتابيز مباشرة
    useEffect(() => {
        if (!projectId) {
            setOptions([]);
            setDisplayVal('');
            onSelect(null); // تصفير البند لو المشروع اتشال
            return;
        }

        const fetchDependentData = async () => {
            setIsLoading(true);
            
            // 🎯 تقدر تغير 'boq_budget_distinct' لـ 'job_orders' لو عندك جدول لأوامر التشغيل
            const { data, error } = await supabase
                .from('boq_budget_distinct')
                .select('*')
                .eq('project_id', projectId);

            if (!error && data) {
                setOptions(data);
            }
            setIsLoading(false);
        };

        fetchDependentData();
    }, [projectId]); // <== الكمبوننت هيتفرمت ويجيب داتا جديدة كل ما العقار يتغير

    // تحديث النص المعروض لو القيمة اتغيرت من بره
    useEffect(() => {
        if (!value) setDisplayVal('');
        else if (initialDisplay) setDisplayVal(initialDisplay);
    }, [value, initialDisplay]);

    const filteredOptions = options.filter(opt => 
        (opt.display_name || opt.work_item || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
            <div 
                onClick={() => { if (projectId && !isLoading) setIsOpen(!isOpen); }}
                className="glass-input-field"
                style={{ 
                    cursor: (!projectId || isLoading) ? 'not-allowed' : 'pointer', 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    opacity: (!projectId) ? 0.6 : 1,
                    height: '46px', padding: '0 12px'
                }}
            >
                <span style={{ fontWeight: 800, color: displayVal ? '#1e293b' : '#94a3b8', fontSize: 'var(--fs-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isLoading ? 'جاري جلب أوامر الشغل...' : (!projectId ? 'اختر العقار أولاً' : (displayVal || placeholder))}
                </span>
                <span style={{ color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s', fontSize: 'var(--fs-xs)' }}>▼</span>
            </div>
            
            {isOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: `1px solid ${THEME.sandDark || '#e2e8f0'}`, borderRadius: '12px', marginTop: '8px', zIndex: 9999, boxShadow: '0 10px 30px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <div style={{ padding: '8px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <input 
                            type="text" 
                            placeholder="بحث باسم البند أو الكود..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', fontSize: 'var(--fs-sm)', fontWeight: 700, color: '#1e293b' }}
                        />
                    </div>
                    <div className="custom-scrollbar" style={{ maxHeight: '200px', overflowY: 'auto', padding: '5px' }}>
                        {filteredOptions.length > 0 ? filteredOptions.map((opt: any) => (
                            <div 
                                key={opt.id} 
                                onClick={() => {
                                    setDisplayVal(opt.display_name || opt.work_item);
                                    onSelect(opt);
                                    setIsOpen(false);
                                    setSearch('');
                                }}
                                style={{ padding: '10px', cursor: 'pointer', borderRadius: '6px', fontSize: 'var(--fs-sm)', fontWeight: 800, color: value === (opt.boq_item_id || opt.id) ? THEME.primary : '#334155', background: value === (opt.boq_item_id || opt.id) ? '#eff6ff' : 'transparent', borderBottom: '1px solid #f1f5f9', transition: '0.2s' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={(e) => e.currentTarget.style.background = value === (opt.boq_item_id || opt.id) ? '#eff6ff' : 'transparent'}
                            >
                                {opt.display_name || opt.work_item}
                            </div>
                        )) : (
                            <div style={{ padding: '15px', textAlign: 'center', fontSize: 'var(--fs-sm)', color: '#94a3b8', fontWeight: 700 }}>لا توجد بنود/أوامر شغل لهذا العقار</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}