"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';
import SmartCombo from '@/components/SmartCombo';

export default function CatalogItemModal({ isOpen, onClose, record, setRecord, onSave, isSaving, uniqueMains, uniqueSubs }: any) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="phi-modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(40, 24, 10, 0.85)', backdropFilter: 'blur(15px)', direction: 'rtl', padding: '20px' }}>
            <div style={{ position: 'fixed', inset: 0 }} onClick={onClose} />
            <div className="cinematic-scroll phi-modal-panel" style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '600px', padding: '40px', position: 'relative', zIndex: 10, boxShadow: '0 50px 100px rgba(0,0,0,0.5)' }}>
                
                <h2 style={{ margin: '0 0 25px 0', fontWeight: 900, color: THEME.primary, borderBottom: '2px dashed #eee', paddingBottom: '15px' }}>
                    {record.id ? 'تعديل البند' : 'إضافة بند / قسم جديد'}
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '8px' }}>اسم البند (مثال: توريد ودهان بلاستيك للحوائط)</label>
                        <textarea style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontWeight: 900, minHeight: '80px', resize: 'vertical' }} 
                               value={record.item_name || ''} onChange={e => setRecord({...record, item_name: e.target.value})} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                        <div>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900 }}>الكود الذكي (اتركه فارغاً للتوليد الآلي)</label>
                            <input type="text" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', textAlign: 'center', background: '#f8fafc' }} 
                                   value={record.item_code || ''} onChange={e => setRecord({...record, item_code: e.target.value})} placeholder="مثال: FIN-01-01" />
                        </div>
                        <div>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900 }}>وحدة القياس</label>
                            <input type="text" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 900 }} 
                                   value={record.unit_of_measure || ''} onChange={e => setRecord({...record, unit_of_measure: e.target.value})} placeholder="مثال: م2, م.ط, عدد" />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '15px', marginTop: '35px' }}>
                    <button onClick={() => onSave(record)} disabled={isSaving} style={{ flex: 2, background: THEME.success, color: 'white', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 900, cursor: 'pointer', fontSize: 'var(--fs-lg)' }}>
                        {isSaving ? 'جاري الحفظ...' : 'حفظ في الدليل'}
                    </button>
                    <button onClick={onClose} style={{ flex: 1, background: '#f1f5f9', color: '#64748b', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 900, cursor: 'pointer', fontSize: 'var(--fs-lg)' }}>إلغاء</button>
                </div>
            </div>
        </div>,
        document.body
    );
}
