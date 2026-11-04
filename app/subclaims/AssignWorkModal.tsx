"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';
import SmartCombo from '@/components/SmartCombo';
import { notify } from '@/lib/notify';

export default function AssignWorkModal({ isOpen, onClose, record, setRecord, onSave, isSaving, contractorName, logic }: any) {
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => { setMounted(true); }, []);

    // 🚀 1. بمجرد اختيار الفيلا، نسحب أوامر التشغيل المتاحة ليها
    useEffect(() => {
        if (record.project_id) {
            logic.fetchProjectJobOrders(record.project_id);
        }
    }, [record.project_id]);

    if (!isOpen || !mounted) return null;

    const handleSave = () => {
        if (!record.project_id) return notify("يرجى اختيار المشروع العقاري أولاً.");
        if (!record.job_order_id) return notify("يرجى اختيار أمر التشغيل."); 
        if (Number(record.assigned_qty) <= 0 || Number(record.unit_price) <= 0) return notify("يرجى إدخال كمية وسعر صحيحين أكبر من الصفر.");
        
        onSave(record);
    };

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(28, 20, 10, 0.85)', backdropFilter: 'blur(10px)', direction: 'rtl', padding: '1.25rem' }}>
            <div style={{ position: 'fixed', inset: 0 }} onClick={onClose} />
            
            <div className="cinematic-scroll" style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '40.625rem', padding: '2.5rem', position: 'relative', zIndex: 10, boxShadow: '0 50px 100px rgba(0,0,0,0.5)', border: `1px solid ${THEME.accent}40` }}>
                
                <h2 style={{ margin: '0 0 1.875rem 0', fontWeight: 900, color: THEME.primary, borderBottom: '2px dashed #eee', paddingBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <span>إسناد أمر تشغيل للمقاول:</span>
                    <span style={{ color: THEME.accent, background: '#fef3c7', padding: '0.3125rem 0.9375rem', borderRadius: '12px', fontSize: 'var(--fs-xl)' }}>{contractorName}</span>
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5625rem' }}>
                    
                    <div style={{ zIndex: 60, position: 'relative' }}>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#475569', display: 'block', marginBottom: '0.625rem' }}>اختيار الفيلا / المشروع العقاري *</label>
                        <SmartCombo 
                            table="projects" 
                            displayCol="Property" 
                            searchCols="Property,project_code" 
                            placeholder="ابحث عن الفيلا..."
                            onSelect={(val: any) => {
                                // 🚀 تصفير أمر التشغيل عند تغيير الفيلا
                                setRecord({...record, project_id: val?.id, job_order_id: null, assigned_qty: 0}); 
                            }} 
                            strict={true}
                        />
                    </div>

                    <div style={{ zIndex: 50, position: 'relative' }}>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#475569', display: 'block', marginBottom: '0.625rem' }}>أوامر التشغيل المتاحة (للفيلا المحددة) *</label>
                        <select 
                            style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontWeight: 800, outline: 'none', background: '#f8fafc' }}
                            value={record.job_order_id || ''}
                            onChange={(e) => {
                                // 🚀 2. البحث في قائمة أوامر التشغيل وسحب السعر والكمية
                                const selectedJobOrder = logic.projectJobOrders.find((jo:any) => jo.id === e.target.value);
                                setRecord({
                                    ...record, 
                                    job_order_id: selectedJobOrder?.id, 
                                    boq_budget_id: selectedJobOrder?.boq_budget_id, 
                                    unit: selectedJobOrder?.boq_budget?.unit,
                                    assigned_qty: selectedJobOrder?.assigned_qty || 1, 
                                    unit_price: '' // 🚀 المقاول يسحب الكمية بس، السعر يضيفه المستخدم
                                });
                            }}
                            disabled={!record.project_id}
                        >
                            <option value="">{record.project_id ? '-- يرجى اختيار أمر التشغيل --' : '-- اختر الفيلا أولاً لعرض أوامر التشغيل --'}</option>
                            {logic.projectJobOrders.map((jo: any) => (
                                <option key={jo.id} value={jo.id}>
                                    {/* 🚀 التحديث هنا: عرض واضح للاسم ورقم الأمر والكمية والوحدة */}
                                    {`[${jo.order_number}] - ${jo.boq_budget?.work_item || 'بند غير محدد'} | الكمية: ${jo.assigned_qty} ${jo.boq_budget?.unit || ''}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '1.25rem', marginTop: '0.625rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <div>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.625rem' }}>الكمية (قابلة للتعديل)</label>
                            <input 
                                type="number" 
                                style={{ width: '100%', padding: '0.9375rem', borderRadius: '14px', border: `2px solid ${THEME.primary}40`, outline: 'none', fontWeight: 900, textAlign: 'center', fontSize: 'var(--fs-xl)' }} 
                                value={record.assigned_qty || ''} 
                                onChange={e => setRecord({...record, assigned_qty: e.target.value})} 
                            />
                            {record.unit && <div style={{ fontSize: 'var(--fs-sm)', color: THEME.success, marginTop: '0.5rem', textAlign: 'center', fontWeight: 800, background: '#dcfce7', padding: '0.25rem', borderRadius: '6px' }}>الوحدة: {record.unit}</div>}
                        </div>
                        <div>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.625rem' }}>سعر الاتفاق (للوحدة)</label>
                            <input 
                                type="number" 
                                style={{ width: '100%', padding: '0.9375rem', borderRadius: '14px', border: `2px solid ${THEME.primary}40`, outline: 'none', fontWeight: 900, textAlign: 'center', color: THEME.primary, fontSize: 'var(--fs-xl)' }} 
                                value={record.unit_price || ''} 
                                onChange={e => setRecord({...record, unit_price: e.target.value})} 
                            />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.9375rem', marginTop: '2.5rem' }}>
                    <button onClick={handleSave} disabled={isSaving} style={{ flex: 2, background: THEME.success, color: 'white', border: 'none', padding: '1.125rem', borderRadius: '14px', fontWeight: 900, cursor: 'pointer', fontSize: 'var(--fs-lg)', boxShadow: `0 10px 20px ${THEME.success}40`, transition: '0.3s' }}>
                        {isSaving ? 'جاري الإسناد...' : 'حفظ الإسناد الآن'}
                    </button>
                    <button onClick={onClose} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: 'none', padding: '1.125rem', borderRadius: '14px', fontWeight: 900, cursor: 'pointer', fontSize: 'var(--fs-lg)', transition: '0.3s' }}>إلغاء</button>
                </div>
            </div>
        </div>,
        document.body
    );
}