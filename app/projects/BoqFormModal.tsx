"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';
import SmartCombo from '@/components/SmartCombo';
import { notify } from '@/lib/notify';

export default function BoqFormModal({ isOpen, onClose, record, setRecord, onSave, projectBoq = [], onImport, isSaving }: any) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    // ⏳ حساب مدة التنفيذ أوتوماتيكياً ديناميكياً
    const durationDays = useMemo(() => {
        if (record.start_date && record.end_date) {
            const start = new Date(record.start_date);
            const end = new Date(record.end_date);
            const diffTime = end.getTime() - start.getTime();
            if (diffTime < 0) return 0;
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }
        return 0;
    }, [record.start_date, record.end_date]);

    if (!isOpen || !mounted) return null;

    const handleSave = () => {
        if (!record.work_item) {
            return notify("يرجى اختيار أو كتابة اسم البند / المرحلة أولاً.");
        }
        if (record.start_date && record.end_date && new Date(record.start_date) > new Date(record.end_date)) {
            return notify("تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية!");
        }
        onSave(record);
    };

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(40, 24, 10, 0.85)', backdropFilter: 'blur(15px)', direction: 'rtl', padding: '20px' }}>
            <div style={{ position: 'fixed', inset: 0 }} onClick={onClose} />
            <div className="cinematic-scroll" style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', padding: '40px', position: 'relative', zIndex: 10, boxShadow: '0 50px 100px rgba(0,0,0,0.5)' }}>
                
                <h2 style={{ margin: '0 0 25px 0', fontWeight: 900, color: THEME.primary, borderBottom: '2px dashed #e2e8f0', paddingBottom: '15px', fontSize: 'var(--fs-xl)' }}>
                    {record.id ? 'تعديل موازنة البند المقيد' : 'إدراج بند هندسي وربط الموازنة التقديرية (WBS)'}
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                    
                    {/* 🔍 السحب الذكي الموحد من شجرة أدلة المقاييس */}
                    <div style={{ zIndex: 90, position: 'relative', background: '#f8fafc', padding: '25px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <SmartCombo 
                            label="ابحث عن اسم البند الهندسي (من دليل الشجرة الموحد)" 
                            table="boq_items" 
                            searchCols="item_name,item_code,main_category,sub_category"
                            displayCol="item_name" 
                            initialDisplay={record.work_item}
                            freeText={true} 
                            onSelect={async (b: any) => {
                                const isObj = typeof b === 'object' && b !== null;

                                // 1. استدعاء الـ Import التلقائي المباشر للسيرفر إن وجد
                                if (isObj && onImport) {
                                    await onImport(b);
                                    onClose();
                                    return;
                                }

                                // 2. التسكين الذكي التلقائي للـ parent_id بناءً على شجرة الدليل الموحد
                                let suggestedParentId = record.parent_id;
                                if (isObj) {
                                    const existingPhase = projectBoq?.find((item: any) => item.item_type === 'رئيسي' && item.work_item === b.main_category);
                                    if (existingPhase) suggestedParentId = existingPhase.id;
                                }

                                // 🚀 ربط الحقل باسم العمود الصريح في قاعدة البيانات عندك 'tareeha'
                                const fetchedTarget = isObj ? (b.tareeha ?? b.daily_target ?? b.tariha ?? 0) : 0;

                                setRecord({
                                    ...record, 
                                    boq_item_id: isObj ? b.id : null,
                                    work_item: isObj ? b.item_name : b, 
                                    item_type: isObj ? 'فرعي' : (record.item_type || 'رئيسي'), 
                                    parent_id: suggestedParentId, 
                                    main_category: isObj ? b.main_category : 'بند عام',
                                    sub_category: isObj ? b.sub_category : 'مرحلة عامة',
                                    unit: isObj ? b.unit_of_measure : record.unit || 'مقطوعية',
                                    unit_contract_price: isObj && b.default_unit_price ? b.default_unit_price : record.unit_contract_price,
                                    estimated_labor_cost: isObj && b.default_labor_price ? b.default_labor_price : record.estimated_labor_cost,
                                    estimated_material_cost: isObj && b.default_material_price ? b.default_material_price : record.estimated_material_cost
                                });
                            }} 
                        />
                        
                        {/* 🌳 مسار شجرة التصنيف الكودية (Breadcrumbs) */}
                        {record.work_item && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '15px', fontSize: 'var(--fs-sm)', fontWeight: 900, flexWrap: 'wrap' }}>
                                <span style={{ background: THEME.coffeeDark, color: 'white', padding: '4px 10px', borderRadius: '6px' }}>{record.main_category || 'بند عام'}</span>
                                <span style={{ color: '#cbd5e1' }}>◀</span>
                                <span style={{ background: 'white', color: THEME.coffeeMain, padding: '4px 10px', borderRadius: '6px', border: `1px solid ${THEME.sandDark}` }}>{record.sub_category || 'مرحلة عامة'}</span>
                                <span style={{ color: '#cbd5e1' }}>◀</span>
                                <span style={{ color: THEME.success, fontWeight: 900 }}>{record.work_item}</span>
                            </div>
                        )}
                    </div>

                    {/* 📅 الجدول الزمني للتنفيذ والمدد الزمنية */}
                    <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '14px', border: '1px solid #bbf7d0', position: 'relative' }}>
                        <h3 style={{ margin: '0 0 15px 0', fontSize: 'var(--fs-md)', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900 }}>
                            النطاق والجدول الزمني للتنفيذ (Time Schedule)
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                            <div>
                                <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#14532d', display: 'block', marginBottom: '8px' }}>تاريخ البدء المتوقع</label>
                                <input type="date" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: `1px solid #86efac`, outline: 'none', fontWeight: 900, color: '#14532d' }} 
                                       value={record.start_date || ''} onChange={e => setRecord({...record, start_date: e.target.value})} />
                            </div>
                            <div>
                                <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#14532d', display: 'block', marginBottom: '8px' }}>تاريخ الانتهاء المستهدف</label>
                                <input type="date" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: `1px solid #86efac`, outline: 'none', fontWeight: 900, color: '#14532d' }} 
                                       value={record.end_date || ''} onChange={e => setRecord({...record, end_date: e.target.value})} />
                            </div>
                        </div>
                        {durationDays > 0 && (
                            <div style={{ position: 'absolute', top: '15px', left: '20px', background: '#166534', color: 'white', padding: '5px 12px', borderRadius: '14px', fontSize: 'var(--fs-sm)', fontWeight: 900 }}>
                                المدة الإجمالية: {durationDays} يوماً
                            </div>
                        )}
                    </div>

                    {/* 💰 الكميات التعاقدية وفئات الأسعار + 🎯 خانة الطريحة المستهدفة */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: '15px' }}>
                        <div>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, display: 'block', marginBottom: '6px' }}>الوحدة الهندسيّة</label>
                            <input type="text" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontWeight: 900, textAlign: 'center', background: '#fafafa', outline: 'none' }} value={record.unit || ''} onChange={e => setRecord({...record, unit: e.target.value})} />
                        </div>
                        
                        <div>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, display: 'block', marginBottom: '6px' }}>الكمية بالملّي</label>
                            <input type="number" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontWeight: 900, textAlign: 'center', outline: 'none' }} value={record.contract_quantity || ''} onChange={e => setRecord({...record, contract_quantity: e.target.value})} />
                        </div>
                        
                        <div>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, display: 'block', marginBottom: '6px' }}>سعر الفئة للعميل</label>
                            <input type="number" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: `2px solid ${THEME.accent}50`, fontWeight: 900, textAlign: 'center', color: THEME.accent, outline: 'none' }} value={record.unit_contract_price || ''} onChange={e => setRecord({...record, unit_contract_price: e.target.value})} />
                        </div>

                    </div>

                    {/* 📊 هيكلة الموازنة التقديرية (WBS Baseline) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', background: '#f8fafc', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <div>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#0369A1', display: 'block', marginBottom: '8px' }}>ميزانية العمالة</label>
                            <input type="number" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: `2px solid #0369A140`, outline: 'none', fontWeight: 900, textAlign: 'center', color: '#0369A1' }} 
                                   value={record.estimated_labor_cost || ''} onChange={e => setRecord({...record, estimated_labor_cost: e.target.value})} placeholder="0.00" />
                        </div>
                        <div>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.goldAccent, display: 'block', marginBottom: '8px' }}>ميزانية المواد والخامات</label>
                            <input type="number" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: `2px solid ${THEME.goldAccent}40`, outline: 'none', fontWeight: 900, textAlign: 'center', color: THEME.goldAccent }} 
                                   value={record.estimated_material_cost || ''} onChange={e => setRecord({...record, estimated_material_cost: e.target.value})} placeholder="0.00" />
                        </div>
                        <div>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#ea580c', display: 'block', marginBottom: '8px' }}>ميزانية النثريات والمصاريف</label>
                            <input type="number" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: `2px solid #ea580c40`, outline: 'none', fontWeight: 900, textAlign: 'center', color: '#ea580c' }} 
                                   value={record.estimated_expenses_cost || ''} onChange={e => setRecord({...record, estimated_expenses_cost: e.target.value})} placeholder="0.00" />
                        </div>
                    </div>
                </div>

                {/* أزرار التحكم والاعتماد */}
                <div style={{ display: 'flex', gap: '15px', marginTop: '35px' }}>
                    <button onClick={handleSave} disabled={isSaving} style={{ flex: 2, background: isSaving ? '#94a3b8' : THEME.success, color: 'white', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 900, cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: 'var(--fs-lg)', boxShadow: isSaving ? 'none' : `0 10px 20px ${THEME.success}40` }}>
                        {isSaving ? 'جاري الحفظ...' : 'حفظ وتسكين البند في شجرة المشروع'}
                    </button>
                    <button onClick={onClose} disabled={isSaving} style={{ flex: 1, background: '#f1f5f9', color: '#64748b', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 900, cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: 'var(--fs-lg)' }}>إلغاء</button>
                </div>
            </div>
        </div>,
        document.body
    );
}