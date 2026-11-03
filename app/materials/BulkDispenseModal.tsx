// BulkDispenseModal.tsx
"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';
import SmartCombo from '@/components/SmartCombo';
import { formatCurrency } from '@/lib/helpers';

export default function BulkDispenseModal({ isOpen, onClose, selectedLines, onSave, isSaving }: any) {
    const [mounted, setMounted] = useState(false);
    
    const [formData, setFormData] = useState({
        issue_date: new Date().toISOString().split('T')[0],
        project_id: '',
        project_name: '',
        issue_type: 'استهلاك مباشر', 
        subcontractor_id: '',
        subcontractor_name: '', 
        items: [] as any[]
    });

    useEffect(() => {
        setMounted(true);
        if (isOpen && selectedLines.length > 0) {
            // أخذ المشروع الافتراضي من أول خامة تم اختيارها لتسهيل العمل
            const firstItem = selectedLines[0];
            setFormData(prev => ({ 
                ...prev, 
                project_id: firstItem.project_id || '',
                project_name: firstItem.project?.Property || '',
                // نقل الخامات المحددة مع كمياتها المتاحة وبنودها
                items: selectedLines.map((line: any) => ({
                    ...line,
                    dispense_qty: line.available_qty || 0 // الكمية الافتراضية هي كل المتاح
                }))
            }));
        }
    }, [isOpen, selectedLines]);

    if (!isOpen || !mounted || selectedLines.length === 0) return null;

    const grandTotal = formData.items.reduce((sum: number, item: any) => sum + ((Number(item.dispense_qty) || 0) * (Number(item.unit_price) || 0)), 0);

    const handleQtyChange = (id: string, newQty: number) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.map(item => {
                if (item.id === id) {
                    const safeQty = Math.max(0, Math.min(newQty, item.available_qty));
                    return { ...item, dispense_qty: safeQty };
                }
                return item;
            })
        }));
    };

    const handleSubmit = () => {
        if (!formData.project_id) return alert('⚠️ يرجى اختيار الفيلا/المشروع العقاري');
        if (formData.issue_type === 'صرف لمقاول' && !formData.subcontractor_id) return alert('⚠️ يرجى اختيار المقاول المستلم');
        
        const invalidItem = formData.items.find(i => i.dispense_qty <= 0 || i.dispense_qty > i.available_qty);
        if (invalidItem) return alert(`⚠️ كمية الصرف غير صحيحة للخامة: ${invalidItem.item_name}`);
        
        onSave(formData);
    };

    return createPortal(
        <div className="warm-portal-overlay-fullscreen" onClick={onClose}>
            <style>{`
                .warm-portal-overlay-fullscreen { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; background: radial-gradient(circle at center, rgba(40, 24, 10, 0.4) 0%, rgba(15, 7, 0, 0.9) 100%) !important; backdrop-filter: blur(20px) !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 999999999 !important; }
                .glass-input-field { width: 100%; padding: 10px 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.65); border: 1px solid rgba(255, 255, 255, 0.8); outline: none; transition: 0.2s; font-weight: 700; color: #1e293b; }
                .glass-input-field:focus { background: #fff; border-color: ${THEME.goldAccent || '#c2410c'}; box-shadow: 0 0 0 4px rgba(202, 138, 4, 0.15); }
                .btn-glass-save { background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 900; font-size: 14px; cursor: pointer; transition: 0.3s; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4); width: 100%; }
                .btn-glass-save:hover:not(:disabled) { transform: translateY(-3px); filter: brightness(1.1); }
            `}</style>

            <div className="cinematic-scroll glass-modal-container" onClick={(e) => e.stopPropagation()} style={{ 
                width: '900px', maxHeight: '95vh', background: 'rgba(248, 250, 252, 0.9)', 
                backdropFilter: 'blur(30px)', borderRadius: '35px', padding: '40px', 
                boxShadow: '0 40px 80px rgba(0,0,0,0.4)', overflowY: 'auto', direction: 'rtl'
            }}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'25px', borderBottom:`2px solid ${THEME.goldAccent || '#c2410c'}50`, paddingBottom:'15px'}}>
                    <h2 style={{ color: THEME.coffeeDark || '#2d1a11', fontWeight: 900, margin: 0, fontSize: '24px' }}>📦 صرف مجمع للخامات ({formData.items.length} أصناف)</h2>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 900 }}>الإجمالي الكلي للصرف</div>
                        <div style={{ fontWeight: 900, color: THEME.primary, fontSize: '22px' }}>{formatCurrency(grandTotal)}</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                    <div style={{ zIndex: 100, position: 'relative' }}>
                        <SmartCombo 
                            label="🏢 المشروع المستفيد من كل الخامات *" 
                            icon="🏢" table="projects" displayCol="Property" searchCols="Property" 
                            value={formData.project_id} initialDisplay={formData.project_name} 
                            onSelect={(v: any) => setFormData({ ...formData, project_id: v?.id || '', project_name: v?.Property || '' })}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '6px' }}>📅 تاريخ الصرف المجمع</label>
                        <input type="date" className="glass-input-field" value={formData.issue_date} onChange={e => setFormData({...formData, issue_date: e.target.value})} />
                    </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '16px', marginBottom: '25px', border: '1px solid #e2e8f0' }}>
                    <label style={{ fontSize: '12px', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '15px' }}>🔄 التوجيه المحاسبي العام للمجموعة *</label>
                    <div style={{ display: 'flex', gap: '20px', marginBottom: formData.issue_type === 'صرف لمقاول' ? '15px' : '0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '13px' }}>
                            <input type="radio" checked={formData.issue_type === 'استهلاك مباشر'} onChange={() => setFormData({...formData, issue_type: 'استهلاك مباشر', subcontractor_id: ''})} style={{ accentColor: THEME.primary, transform: 'scale(1.2)' }} />
                            🏢 استهلاك للشركة (تكلفة مشروع)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '13px', color: '#be123c' }}>
                            <input type="radio" checked={formData.issue_type === 'صرف لمقاول'} onChange={() => setFormData({...formData, issue_type: 'صرف لمقاول'})} style={{ accentColor: '#be123c', transform: 'scale(1.2)' }} />
                            👷 تحميل كسلفة على مقاول
                        </label>
                    </div>
                    <div style={{ zIndex: 80, position: 'relative' }}>
                        {formData.issue_type === 'صرف لمقاول' && (
                            <SmartCombo 
                                label="👤 اختر المقاول المراد تحميل جميع الخامات عليه *" 
                                icon="👷" table="partners" displayCol="name" searchCols="name" customFilter="partner_type=eq.مقاول" 
                                value={formData.subcontractor_id} initialDisplay={formData.subcontractor_name} 
                                onSelect={(v: any) => setFormData({ ...formData, subcontractor_id: v?.id || '', subcontractor_name: v?.name || '' })} 
                            />
                        )}
                    </div>
                </div>

                {/* 📋 جدول الخامات المحددة */}
                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '25px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                        <thead style={{ background: THEME.coffeeDark, color: 'white' }}>
                            <tr>
                                <th style={{ padding: '12px', fontSize: '11px', textAlign: 'right' }}>الخامة وبند המوازنة</th>
                                <th style={{ padding: '12px', fontSize: '11px', width: '15%' }}>المتاح بالمخزن</th>
                                <th style={{ padding: '12px', fontSize: '11px', width: '20%' }}>الكمية للصرف</th>
                                <th style={{ padding: '12px', fontSize: '11px', width: '15%' }}>إجمالي السطر</th>
                            </tr>
                        </thead>
                        <tbody>
                            {formData.items.map((item: any, idx: number) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '10px', textAlign: 'right' }}>
                                        <div style={{ fontWeight: 900, color: '#0f172a', fontSize: '13px' }}>{item.work_item || item.item_name}</div>
                                        <div style={{ fontSize: '10px', color: THEME.goldAccent, fontWeight: 700, marginTop:'4px' }}>📋 بند: {item.boq_item || 'بدون توجيه'}</div>
                                    </td>
                                    <td style={{ padding: '10px', fontWeight: 800, color: '#64748b' }}>
                                        {item.available_qty} {item.unit}
                                    </td>
                                    <td style={{ padding: '10px' }}>
                                        <input 
                                            type="number" max={item.available_qty} min="0.1" step="0.1" 
                                            className="glass-input-field" 
                                            style={{ padding: '8px', textAlign: 'center', borderColor: item.dispense_qty > item.available_qty ? '#ef4444' : '' }} 
                                            value={item.dispense_qty} 
                                            onChange={e => handleQtyChange(item.id, Number(e.target.value))} 
                                        />
                                    </td>
                                    <td style={{ padding: '10px', fontWeight: 900, color: THEME.danger }}>
                                        {formatCurrency(item.dispense_qty * item.unit_price)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                    <button onClick={handleSubmit} disabled={isSaving} className="btn-glass-save" style={{ flex: 2 }}>
                        {isSaving ? '⏳ جاري الصرف المجمع...' : '✅ تأكيد الصرف لجميع الخامات المحددة'}
                    </button>
                    <button onClick={onClose} disabled={isSaving} style={{ flex: 1, padding: '16px', background: '#e2e8f0', color: '#475569', borderRadius: '16px', fontWeight: 900, border: 'none', cursor: 'pointer' }}>
                        إلغاء
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}