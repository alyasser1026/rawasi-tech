"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import SmartCombo from '@/components/SmartCombo';

export default function CatalogItemModal({ isOpen, onClose, record, setRecord, onSave, isSaving, uniqueMains, uniqueSubs }: any) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="phi-modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(40, 24, 10, 0.85)', backdropFilter: 'blur(15px)', direction: 'rtl', padding: '1.25rem' }}>
            <div style={{ position: 'fixed', inset: 0 }} onClick={onClose} />
            <div className="cinematic-scroll phi-modal-panel" style={{ background: 'var(--surface-card, #ffffff)', borderRadius: '20px', width: '100%', maxWidth: '37.5rem', padding: '2.5rem', position: 'relative', zIndex: 10, boxShadow: 'var(--shadow-ambient), 0 30px 60px rgba(0,0,0,0.3)', border: 'none' }}>
                
                <h2 style={{ margin: '0 0 1.5625rem 0', fontWeight: 800, color: 'var(--text-primary)', borderBottom: 'none', paddingBottom: '0.5rem' }}>
                    {record.id ? 'تعديل البند القياسي' : 'إضافة بند / قسم جديد'}
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ zIndex: 100, position: 'relative' }}>
                        <SmartCombo 
                            label="التصنيف الرئيسي (اختر أو اكتب اسماً جديداً)" 
                            options={uniqueMains} 
                            initialDisplay={record.main_category}
                            freeText={true}
                            onSelect={(val: any) => setRecord({ ...record, main_category: val })} 
                        />
                    </div>
                    
                    <div style={{ zIndex: 90, position: 'relative' }}>
                        <SmartCombo 
                            label="التصنيف الفرعي (اختر أو اكتب اسماً جديداً)" 
                            options={uniqueSubs} 
                            initialDisplay={record.sub_category}
                            freeText={true}
                            onSelect={(val: any) => setRecord({ ...record, sub_category: val })} 
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-secondary, #475569)', display: 'block', marginBottom: '0.5rem' }}>اسم البند (مثال: توريد ودهان بلاستيك للحوائط)</label>
                        <textarea 
                            style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-sunken, inset 0 2px 4px rgba(0,0,0,0.06))', border: 'none', outline: 'none', fontWeight: 700, minHeight: '5rem', resize: 'vertical', color: 'var(--text-primary)' }} 
                            value={record.item_name || ''} 
                            onChange={e => setRecord({...record, item_name: e.target.value})} 
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '0.9375rem' }}>
                        <div>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-secondary, #475569)', display: 'block', marginBottom: '0.5rem' }}>الكود الذكي (اتركه فارغاً للتوليد الآلي)</label>
                            <input 
                                type="text" 
                                style={{ width: '100%', height: '2.75rem', padding: '0 0.875rem', borderRadius: '12px', background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-sunken, inset 0 2px 4px rgba(0,0,0,0.06))', border: 'none', textAlign: 'center', color: 'var(--text-primary)' }} 
                                value={record.item_code || ''} 
                                onChange={e => setRecord({...record, item_code: e.target.value})} 
                                placeholder="مثال: FIN-01-01" 
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-secondary, #475569)', display: 'block', marginBottom: '0.5rem' }}>وحدة القياس</label>
                            <input 
                                type="text" 
                                style={{ width: '100%', height: '2.75rem', padding: '0 0.875rem', borderRadius: '12px', background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-sunken, inset 0 2px 4px rgba(0,0,0,0.06))', border: 'none', textAlign: 'center', fontWeight: 800, color: 'var(--text-primary)' }} 
                                value={record.unit_of_measure || ''} 
                                onChange={e => setRecord({...record, unit_of_measure: e.target.value})} 
                                placeholder="مثال: م2, م.ط, عدد" 
                            />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.9375rem', marginTop: '2rem' }}>
                    <button 
                        onClick={() => onSave(record)} 
                        disabled={isSaving} 
                        style={{ flex: 2, background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', padding: '0.875rem', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', fontSize: 'var(--fs-md)', boxShadow: 'var(--shadow-elevation)' }}
                    >
                        {isSaving ? 'جاري الحفظ...' : 'حفظ في الدليل'}
                    </button>
                    <button 
                        onClick={onClose} 
                        style={{ flex: 1, background: 'var(--surface-subcard, #f1f5f9)', color: 'var(--text-primary, #64748b)', border: 'none', padding: '0.875rem', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', fontSize: 'var(--fs-md)' }}
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
