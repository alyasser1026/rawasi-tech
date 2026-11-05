"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast-context'; 
import SmartCombo from '@/components/SmartCombo'; 

export default function JobOrderModal({ isOpen, onClose, record, setRecord, onSave, isSaving }: any) {
    const { showToast } = useToast(); 
    const [mounted, setMounted] = useState(false);
    const [boqItems, setBoqItems] = useState<any[]>([]);

    useEffect(() => {
        setMounted(true);
    }, []);

    // 🚀 1. توليد رقم الأمر وسحب البيانات الأساسية
    useEffect(() => {
        if (!isOpen || !record) return;

        let updates: any = {};
        let needsUpdate = false;

        // رقم الأمر التسلسلي بيتحدد في قاعدة البيانات لحظة الحفظ (JO-السنة-0001)
        if (!record.id && !record.defaults_applied) {
            updates.defaults_applied = true;
            updates.start_date = record.start_date || new Date().toISOString().split('T')[0];
            updates.status = record.status || 'مسودة';
            updates.executor_type = record.executor_type || 'تنفيذ ذاتي';
            needsUpdate = true;
        }

        if (needsUpdate) {
            setRecord((prev: any) => ({ ...prev, ...updates }));
        }
    }, [isOpen, record?.id]);

    // 🚀 2. جلب بنود المقايسة ديناميكياً بناءً على المشروع المختار
    useEffect(() => {
        const fetchBoqItems = async () => {
            if (!record?.project_id) {
                setBoqItems([]);
                return;
            }
            const { data } = await supabase
                .from('boq_budget_distinct')
                .select('id, work_item, unit, contract_quantity, unit_contract_price')
                .eq('project_id', record.project_id);
                
            if (data) setBoqItems(data);
        };

        if (isOpen) fetchBoqItems();
    }, [record?.project_id, isOpen]);

    // 🚀 3. الحساسية القصوى (التحقق من الحقول الإلزامية ومنطقية الأرقام)
    const handleValidateAndSave = () => {
        if (!record.project_id) return showToast("يرجى اختيار المشروع أولاً", "warning");
        if (!record.boq_budget_id) return showToast("يرجى اختيار بند المقايسة", "warning");
        
        const qty = Number(record.assigned_qty);
        const price = Number(record.unit_price);

        // منع القيم الصفرية أو السالبة
        if (isNaN(qty) || qty <= 0) return showToast("الكمية المسندة يجب أن تكون أكبر من صفر", "warning");
        if (isNaN(price) || price < 0) return showToast("سعر الوحدة لا يمكن أن يكون سالباً", "warning");

        if (record.executor_type === 'مقاول باطن' && !record.contractor_id) return showToast("يرجى اختيار مقاول الباطن", "warning");
        
        onSave(record);
    };

    if (!isOpen || !mounted) return null;

    // حساب الإجمالي اللحظي
    const totalAmount = Number(record.assigned_qty || 0) * Number(record.unit_price || 0);

    const modalContent = (
        <div className="warm-portal-overlay-fullscreen" onClick={onClose}>
            
            <style>{`
                .warm-portal-overlay-fullscreen {
                    position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
                    width: 100vw !important; height: 100vh !important;
                    background: radial-gradient(circle at center, rgba(15, 23, 42, 0.4) 0%, rgba(2, 6, 23, 0.9) 100%) !important;
                    backdrop-filter: blur(20px) !important; display: flex !important; align-items: center !important; justify-content: center !important;
                    z-index: 999999999 !important;
                }
                .cinematic-scroll::-webkit-scrollbar { width: 0.375rem; }
                .cinematic-scroll::-webkit-scrollbar-track { background: transparent; }
                .cinematic-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 10px; }
                .glass-input-field {
                    width: 100%; padding: 0.625rem 0.75rem; border-radius: 12px; background: rgba(255, 255, 255, 0.65);
                    border: 1px solid rgba(255, 255, 255, 0.8); outline: none; transition: all 0.2s; font-weight: 700; color: #1e293b;
                }
                .glass-input-field:focus { background: #ffffff; border-color: ${THEME.accent}; box-shadow: 0 0 0 4px rgba(202, 138, 4, 0.15); }
                .btn-glass-save { background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 0.75rem 1.25rem; border-radius: 12px; font-weight: 900; font-size: var(--fs-md); cursor: pointer; transition: 0.3s; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4); }
                .btn-glass-save:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(16, 185, 129, 0.5); }
                .btn-glass-cancel { background: rgba(255, 255, 255, 0.6); color: #1e293b; border: 1px solid rgba(255, 255, 255, 0.8); padding: 0.75rem 1.25rem; border-radius: 12px; font-weight: 900; font-size: var(--fs-md); cursor: pointer; transition: 0.3s; }
                .btn-glass-cancel:hover { background: rgba(255, 255, 255, 0.9); transform: translateY(-2px); }
                
                @media (max-width: 768px) {
                    .responsive-form-grid { grid-template-columns: 1fr !important; }
                    .responsive-form-grid > div { grid-column: span 1 !important; }
                }
            `}</style>

            <div className="cinematic-scroll glass-modal-container" onClick={(e) => e.stopPropagation()} style={{ 
                width: '59.375rem', maxHeight: '92vh', background: 'rgba(248, 250, 252, 0.85)', 
                backdropFilter: 'blur(25px)', borderRadius: '14px', padding: '2.5rem', 
                boxShadow: '0 30px 60px rgba(0,0,0,0.25)', overflowY: 'auto', direction: 'rtl',
                border: '1px solid rgba(255,255,255,0.7)', animation: 'modalScaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.875rem', borderBottom: `2px solid ${THEME.accent}50`, paddingBottom: '0.9375rem' }}>
                    <h2 style={{ color: THEME.primary, fontWeight: 900, margin: 0, fontSize: 'var(--fs-2xl)' }}>
                        {record.id ? 'تعديل أمر التشغيل' : 'إصدار أمر تشغيل جديد'}
                    </h2>
                    <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#64748b', background: 'rgba(255,255,255,0.8)', padding: '0.5rem 1rem', borderRadius: '12px' }}>
                        رقم الأمر: <span style={{ color: THEME.primary }}>{record.order_number || 'يتحدد عند الحفظ'}</span>
                    </div>
                </div>

                {/* Grid 2 Columns for better flow */}
                <div className="responsive-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '1.5625rem' }}>
                    
                    {/* التواريخ والحالة */}
                    <div style={{ display: 'flex', gap: '0.9375rem' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.375rem' }}>تاريخ البدء</label>
                            <input type="date" value={record.start_date?.split('T')[0] ?? ''} onChange={(e) => setRecord({...record, start_date: e.target.value})} className="glass-input-field" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.375rem' }}>تاريخ الانتهاء</label>
                            <input type="date" value={record.end_date?.split('T')[0] ?? ''} onChange={(e) => setRecord({...record, end_date: e.target.value})} className="glass-input-field" />
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.375rem' }}>حالة الأمر</label>
                        <select value={record.status ?? 'مسودة'} onChange={(e) => setRecord({...record, status: e.target.value})} className="glass-input-field" style={{ appearance: 'auto', border: `2px solid ${THEME.accent}70` }}>
                            <option value="مسودة">مسودة</option>
                            <option value="جاري التنفيذ">جاري التنفيذ</option>
                            <option value="موقوف">موقوف</option>
                            <option value="جاري التسليم">جاري التسليم</option>
                            <option value="مفوتر">مفوتر</option>
                            <option value="تم التحصيل">تم التحصيل</option>
                            <option value="مكتمل">مكتمل</option>
                        </select>
                    </div>

                    {/* المشروع والبند */}
                    <div style={{ gridColumn: 'span 1' }}>
                        <SmartCombo 
                            label="العقار / الفيلا المرتبطة" 
                            icon="🏢"
                            table="projects" 
                            searchCols="Property,project_name,project_code" displayCol="Property"
                            initialDisplay={record.projects?.Property || record.projects?.project_name || ''}
                            onSelect={(p: any) => setRecord({...record, project_id: p?.id || null, boq_budget_id: null, assigned_qty: '', unit_price: ''})} 
                        />
                    </div>

                    <div style={{ gridColumn: 'span 1' }}>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.375rem' }}>بند المقايسة (BOQ) المستهدف</label>
                        <select 
                            value={record.boq_budget_id ?? ''} 
                            onChange={(e) => {
                                const selectedId = e.target.value;
                                const selectedBoq = boqItems.find(b => b.id === selectedId);
                                let updates: any = { boq_budget_id: selectedId };
                                
                                if (selectedBoq) {
                                    const executionType = record.executor_type || 'تنفيذ ذاتي';
                                    if (executionType === 'تنفيذ ذاتي') {
                                        updates.assigned_qty = selectedBoq.contract_quantity || 0;
                                        updates.unit_price = selectedBoq.unit_contract_price || 0;
                                    } else {
                                        updates.assigned_qty = selectedBoq.contract_quantity || 0;
                                        updates.unit_price = ''; // Reset price for manual entry
                                    }
                                }
                                setRecord({...record, ...updates});
                            }} 
                            className="glass-input-field" 
                            style={{ appearance: 'auto', background: !record.project_id ? 'rgba(226, 232, 240, 0.6)' : 'rgba(255, 255, 255, 0.65)' }}
                            disabled={!record.project_id}
                        >
                            <option value="">{record.project_id ? 'اختر البند...' : 'يرجى اختيار العقار أولاً لعرض البنود'}</option>
                            {boqItems.map(b => <option key={b.id} value={b.id}>{b.work_item} ({b.unit})</option>)}
                        </select>
                    </div>

                    {/* جهة التنفيذ والمقاول */}
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.375rem' }}>جهة التنفيذ</label>
                        <select 
                            value={record.executor_type ?? 'تنفيذ ذاتي'} 
                            onChange={(e) => {
                                const newType = e.target.value;
                                let updates: any = { executor_type: newType, contractor_id: null, client_name: '' };
                                if (record.boq_budget_id) {
                                    const selectedBoq = boqItems.find(b => b.id === record.boq_budget_id);
                                    if (selectedBoq) {
                                        if (newType === 'تنفيذ ذاتي') {
                                            updates.assigned_qty = selectedBoq.contract_quantity || 0;
                                            updates.unit_price = selectedBoq.unit_contract_price || 0;
                                        } else {
                                            updates.assigned_qty = selectedBoq.contract_quantity || 0;
                                            updates.unit_price = ''; // Reset price for manual entry
                                        }
                                    }
                                }
                                setRecord({...record, ...updates});
                            }} 
                            className="glass-input-field" style={{ appearance: 'auto' }}
                        >
                            <option value="تنفيذ ذاتي">تنفيذ ذاتي (عمالة الشركة)</option>
                            <option value="مقاول باطن">مقاول باطن</option>
                        </select>
                    </div>

                    <div style={{ gridColumn: 'span 1', opacity: record.executor_type === 'مقاول باطن' ? 1 : 0.4, pointerEvents: record.executor_type === 'مقاول باطن' ? 'auto' : 'none', transition: '0.3s' }}>
                        <SmartCombo 
                            label="اسم مقاول الباطن" 
                            icon="👤"
                            table="partners" 
                            searchCols="name,code" displayCol="name"
                            initialDisplay={record.client_name || record.partners?.name || ''}
                            onSelect={(c: any) => setRecord({...record, contractor_id: c?.id || null, client_name: c?.name || ''})} 
                        />
                    </div>

                    {/* الكمية والسعر والملاحظات */}
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.375rem' }}>الكمية المسندة</label>
                        <input type="number" min="0" step="0.01" value={record.assigned_qty ?? ''} onChange={(e) => setRecord({...record, assigned_qty: e.target.value})} className="glass-input-field" placeholder="الكمية من المقايسة..." />
                    </div>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.375rem' }}>سعر الوحدة</label>
                        <input type="number" min="0" step="0.01" value={record.unit_price ?? ''} onChange={(e) => setRecord({...record, unit_price: e.target.value})} className="glass-input-field" placeholder="السعر..." />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.375rem' }}>ملاحظات العمل</label>
                        <textarea value={record.notes ?? ''} onChange={(e) => setRecord({...record, notes: e.target.value})} className="glass-input-field" style={{ height: '4.375rem', resize: 'none' }} placeholder="شروط التنفيذ أو ملاحظات فنية..." />
                    </div>
                </div>

                {/* Summary Grid */}
                <div style={{ marginTop: '2.1875rem', padding: '1.5625rem', background: 'linear-gradient(135deg, #1e293b, #0f172a)', borderRadius: '14px', color: 'white', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11.25rem, 1fr))', gap: '1.25rem', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.9375rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', fontWeight: 800 }}>الكمية المسندة</div>
                        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900 }}>{Number(record.assigned_qty || 0).toLocaleString('en-US')}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.9375rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', fontWeight: 800 }}>سعر الوحدة (ر.س)</div>
                        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900 }}>{formatCurrency(record.unit_price || 0)}</div>
                    </div>
                    <div style={{ background: `linear-gradient(135deg, ${THEME.accent}40, transparent)`, padding: '0.9375rem', borderRadius: '16px', border: `1px solid ${THEME.accent}80`, boxShadow: `0 0 20px ${THEME.accent}20` }}>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.accentLight }}>التكلفة التقديرية للأمر</div>
                        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{formatCurrency(totalAmount)}</div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '1.25rem', marginTop: '2.1875rem' }}>
                    <button onClick={handleValidateAndSave} disabled={isSaving} className="btn-glass-save" style={{ flex: 2 }}>
                        {isSaving ? 'جاري الحفظ...' : 'حفظ وإصدار أمر التشغيل'}
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