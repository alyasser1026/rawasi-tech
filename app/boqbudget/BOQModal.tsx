"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; 
import { THEME } from '@/lib/theme';
import { useToast } from '@/lib/toast-context'; 
import SmartCombo from '@/components/SmartCombo'; 

export default function BOQModal({ isOpen, onClose, record, setRecord, onSave, isSaving, projects }: any) {
    const { showToast } = useToast(); 
    const [mounted, setMounted] = useState(false); 

    useEffect(() => { setMounted(true); }, []);

    const handleValidateAndSave = () => {
        if (!record.project_id) { showToast("يرجى اختيار المشروع أولاً", "warning"); return; }
        if (!record.boq_item_id) { showToast("يرجى اختيار البند الرئيسي لضمان سحب اليوميات تلقائياً", "warning"); return; }
        onSave(record);
    };

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div className="warm-portal-overlay-fullscreen" onClick={onClose}>
            <style>{`
                .warm-portal-overlay-fullscreen {
                    position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
                    width: 100vw !important; height: 100vh !important;
                    background: radial-gradient(circle at center, rgba(139, 69, 19, 0.4) 0%, rgba(15, 7, 0, 0.9) 100%) !important;
                    backdrop-filter: blur(20px) !important; display: flex !important; align-items: center !important; justify-content: center !important;
                    z-index: 999999999 !important; 
                }
                .glass-input-field {
                    width: 100%; padding: 10px 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.65);
                    border: 1px solid rgba(255, 255, 255, 0.8); outline: none; transition: all 0.2s; font-weight: 700; color: #1e293b; font-size: var(--fs-sm);
                }
                .glass-input-field:focus { background: #ffffff; border-color: ${THEME.accent}; box-shadow: 0 0 0 4px rgba(202, 138, 4, 0.15); }
                .btn-glass-save {
                    background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 12px 20px; border-radius: 12px;
                    font-weight: 900; font-size: var(--fs-md); cursor: pointer; transition: 0.3s; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
                }
                .btn-glass-save:hover:not(:disabled) { transform: translateY(-3px); }
                .btn-glass-cancel {
                    background: rgba(255, 255, 255, 0.6); color: #1e293b; border: 1px solid rgba(255, 255, 255, 0.8); padding: 12px 20px; border-radius: 12px;
                    font-weight: 900; font-size: var(--fs-md); cursor: pointer; transition: 0.3s;
                }
                .section-title { font-size: var(--fs-md); font-weight: 900; margin-bottom: 15px; display: block; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 8px;}
            `}</style>

            <div className="cinematic-scroll glass-modal-container" onClick={(e) => e.stopPropagation()} style={{ 
                width: '1000px', maxHeight: '92vh', background: 'rgba(248, 250, 252, 0.85)', backdropFilter: 'blur(25px)', borderRadius: '14px', 
                padding: '30px 40px', boxShadow: '0 30px 60px rgba(0,0,0,0.25)', overflowY: 'auto', direction: 'rtl', border: '1px solid rgba(255,255,255,0.7)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: `2px solid ${THEME.accent}50`, paddingBottom: '15px' }}>
                    <h2 style={{ color: THEME.primary, fontWeight: 900, margin: 0, fontSize: 'var(--fs-2xl)' }}>
                        {record.id ? 'تعديل بيانات البند الفعلي والتقديري' : 'إضافة بند BOQ جديد'}
                    </h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                    
                    {/* --- الأساسيات --- */}
                    <div style={{ gridColumn: 'span 4' }}><span className="section-title" style={{color: THEME.accent}}>البيانات الأساسية والتصنيفات للربط التلقائي</span></div>
                    
                    <div style={{ gridColumn: 'span 2' }}>
                        <SmartCombo 
                            label="المشروع (الفيلا) *" icon="🏢" table="projects" searchCols="Property" displayCol="Property" 
                            initialDisplay={record.project_name || ''} 
                            onSelect={(p: any) => setRecord({...record, project_id: p?.id || null, project_name: p?.Property || ''})} 
                        />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                        <SmartCombo 
                            label="وصف الأعمال (اختر البند الرئيسي للربط) *" icon="📋" table="boq_items" searchCols="item_name" displayCol="item_name" 
                            initialDisplay={record.work_item || ''} 
                            onSelect={(item: any) => setRecord({
                                ...record, 
                                boq_item_id: item?.id || null, 
                                work_item: item?.item_name || ''
                            })} 
                        />
                    </div>

                    <div style={{ gridColumn: 'span 1' }}>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>الوحدة</label>
                        <input type="text" value={record.unit ?? ''} onChange={(e) => setRecord({...record, unit: e.target.value})} className="glass-input-field" />
                    </div>

                    <div style={{ gridColumn: 'span 1' }}>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>تاريخ البدء</label>
                        <input type="date" value={record.start_date ?? ''} onChange={(e) => setRecord({...record, start_date: e.target.value})} className="glass-input-field" />
                    </div>
                    <div style={{ gridColumn: 'span 1' }}>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>تاريخ الانتهاء</label>
                        <input type="date" value={record.end_date ?? ''} onChange={(e) => setRecord({...record, end_date: e.target.value})} className="glass-input-field" />
                    </div>

                    {/* مساحة فارغة لترتيب الـ Grid */}
                    <div style={{ gridColumn: 'span 1' }}></div>

                    {/* --- التعاقد والتنفيذ الفعلي --- */}
                    <div style={{ gridColumn: 'span 4', marginTop: '15px' }}><span className="section-title" style={{color: '#4f46e5'}}>بيانات التعاقد والتنفيذ الفعلي</span></div>
                    
                    <div><label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>كمية التعاقد</label><input type="number" value={record.contract_quantity ?? ''} onChange={(e) => setRecord({...record, contract_quantity: e.target.value})} className="glass-input-field" /></div>
                    <div><label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>سعر الوحدة تعاقد</label><input type="number" value={record.unit_contract_price ?? ''} onChange={(e) => setRecord({...record, unit_contract_price: e.target.value})} className="glass-input-field" /></div>
                    <div><label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>نسبة المحتجز %</label><input type="number" value={record.retention_percentage ?? ''} onChange={(e) => setRecord({...record, retention_percentage: e.target.value})} className="glass-input-field" /></div>
                    
                    {/* 🔒 مقفل - يسحب تلقائياً من دالة التجميع في الداتابيز */}
                    <div style={{ background: '#ecfdf5', padding: '10px', borderRadius: '12px', border: '1px solid #10b981' }}>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#047857', display: 'block', marginBottom: '6px' }}>الكمية المنفذة (تلقائي)</label>
                        <input 
                            type="number" 
                            value={record.actual_quantity ?? ''} 
                            readOnly 
                            className="glass-input-field" 
                            style={{ borderColor: '#34d399', background:'rgba(255,255,255,0.4)', color: '#047857', cursor: 'not-allowed' }} 
                            title="يتم حساب هذه الكمية تلقائياً من يوميات العمالة الفعليه (الانتاجية)"
                        />
                    </div>

                    {/* --- الموازنة والتكاليف --- */}
                    <div style={{ gridColumn: 'span 2', marginTop: '15px', background: '#fffbeb', padding: '15px', borderRadius: '16px', border: '1px solid #fde68a' }}>
                        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 900, color: '#b45309', marginBottom: '15px', borderBottom: '1px solid #fde68a', paddingBottom:'8px' }}>التكاليف التقديرية (الموازنة)</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                            <div><label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#b45309', display: 'block', marginBottom: '4px' }}>الخامات</label><input type="number" value={record.estimated_material_cost ?? ''} onChange={(e) => setRecord({...record, estimated_material_cost: e.target.value})} className="glass-input-field" /></div>
                            <div><label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#b45309', display: 'block', marginBottom: '4px' }}>العمالة</label><input type="number" value={record.estimated_labor_cost ?? ''} onChange={(e) => setRecord({...record, estimated_labor_cost: e.target.value})} className="glass-input-field" /></div>
                            <div><label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#b45309', display: 'block', marginBottom: '4px' }}>التشغيل</label><input type="number" value={record.estimated_operational_cost ?? ''} onChange={(e) => setRecord({...record, estimated_operational_cost: e.target.value})} className="glass-input-field" /></div>
                            <div><label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#b45309', display: 'block', marginBottom: '4px' }}>مصروفات أخرى</label><input type="number" value={record.estimated_expenses_cost ?? ''} onChange={(e) => setRecord({...record, estimated_expenses_cost: e.target.value})} className="glass-input-field" /></div>
                        </div>
                    </div>

                    <div style={{ gridColumn: 'span 2', marginTop: '15px', background: '#f0fdf4', padding: '15px', borderRadius: '16px', border: '1px solid #bbf7d0' }}>
                        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 900, color: '#15803d', marginBottom: '15px', borderBottom: '1px solid #bbf7d0', paddingBottom:'8px' }}>التكاليف والإيرادات الفعلية</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                            
                            {/* 🔒 مقفل - يسحب تلقائياً من حركات صرف الخامات (material_issue_lines) */}
                            <div>
                                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#15803d', display: 'block', marginBottom: '4px' }}>الخامات (فعلي)</label>
                                <input 
                                    type="number" 
                                    value={record.actual_material_cost ?? ''} 
                                    readOnly 
                                    className="glass-input-field" 
                                    style={{ background:'rgba(0,0,0,0.05)', cursor: 'not-allowed', color: '#15803d' }}
                                    title="يتم حساب هذا الحقل تلقائياً من واقع أذونات الصرف وحركاتها المتطابقة"
                                />
                            </div>
                            
                            {/* 🔒 مقفل - يسحب تلقائياً من الأجور الفعلية داخل اليومية */}
                            <div>
                                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#15803d', display: 'block', marginBottom: '4px' }}>العمالة - فعلي (تلقائي)</label>
                                <input 
                                    type="number" 
                                    value={record.actual_labor_cost ?? ''} 
                                    readOnly 
                                    className="glass-input-field" 
                                    style={{ background:'rgba(0,0,0,0.05)', cursor: 'not-allowed', color: '#15803d' }} 
                                    title="يتم حساب هذه التكلفة تلقائياً من مجموع أجور يوميات العمالة"
                                />
                            </div>

                            <div><label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#15803d', display: 'block', marginBottom: '4px' }}>التشغيل (فعلي)</label><input type="number" value={record.actual_operational_cost ?? ''} onChange={(e) => setRecord({...record, actual_operational_cost: e.target.value})} className="glass-input-field" /></div>
                            <div><label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#15803d', display: 'block', marginBottom: '4px' }}>مصروفات (فعلي)</label><input type="number" value={record.actual_expenses_cost ?? ''} onChange={(e) => setRecord({...record, actual_expenses_cost: e.target.value})} className="glass-input-field" /></div>
                            
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#15803d', display: 'block', marginBottom: '4px' }}>الإيراد الفعلي (إن وجد)</label>
                                <input type="number" value={record.actual_revenue ?? ''} onChange={(e) => setRecord({...record, actual_revenue: e.target.value})} className="glass-input-field" style={{borderColor: '#22c55e', background:'#fff'}} />
                            </div>
                        </div>
                    </div>

                </div>

                <div style={{ display: 'flex', gap: '20px', marginTop: '35px' }}>
                    <button onClick={handleValidateAndSave} disabled={isSaving} className="btn-glass-save" style={{ flex: 2 }}>
                        {isSaving ? 'جاري الحفظ والتزامن التلقائي...' : 'حفظ البند'}
                    </button>
                    <button onClick={onClose} className="btn-glass-cancel" style={{ flex: 1 }}>
                        إلغاء وإغلاق
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}