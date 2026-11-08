"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';
import SmartCombo from '@/components/SmartCombo';
// 🚀 استدعاء الكمبوننت الذكي المخصص لأوامر الشغل وبنود المشروع
import ProjectBoqCombo from '@/components/ProjectBoqCombo'; 
import JobOrderSelector from '@/components/JobOrderSelector';
import { formatCurrency } from '@/lib/helpers';
import { Trash2 } from 'lucide-react';

export default function MaterialIssueModal({ isOpen, onClose, logic }: any) {
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!isOpen || !mounted) return null;

    const totalQuantity = logic.issueData?.items?.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0) || 0;
    const grandTotal = logic.issueData?.items?.reduce((sum: number, item: any) => sum + (Number(item.total_price) || 0), 0) || 0;

    return createPortal(
        <div className="warm-portal-overlay-fullscreen" onClick={onClose}>
            <style>{`
                .warm-portal-overlay-fullscreen {
                    position: fixed !important; inset: 0 !important;
                    width: 100vw !important; height: 100vh !important;
                    background: radial-gradient(circle at center, rgba(40, 24, 10, 0.4) 0%, rgba(15, 7, 0, 0.9) 100%) !important;
                    backdrop-filter: blur(20px) !important;
                    display: flex !important; align-items: center !important; justify-content: center !important;
                    z-index: 999999999 !important;
                }
                .glass-input-field {
                    width: 100%; padding: 0.625rem 0.75rem; border-radius: 12px;
                    background: var(--surface-sunken, #f8fafc); border: none; box-shadow: var(--shadow-sunken, inset 0 2px 4px rgba(0,0,0,0.06));
                    outline: none; transition: 0.2s; font-weight: 700; color: #1e293b;
                }
                .glass-input-field:focus { background: #fff; box-shadow: 0 0 0 3px rgba(202, 138, 4, 0.25); }
                
                .btn-glass-save { background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 0.75rem 1.25rem; border-radius: 12px; font-weight: 900; font-size: var(--fs-md); cursor: pointer; transition: 0.3s; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4); }
                .btn-glass-save:hover:not(:disabled) { transform: translateY(-3px); filter: brightness(1.1); }
                .btn-glass-cancel { background: var(--surface-subcard, #f1f5f9); color: var(--text-primary, #1e293b); border: none; box-shadow: var(--shadow-elevation); padding: 0.75rem 1.25rem; border-radius: 12px; font-weight: 900; font-size: var(--fs-md); cursor: pointer; transition: 0.3s; }
                
                .lines-table-container {
                    background: var(--surface-card, #ffffff); border-radius: 16px; border: none; box-shadow: var(--shadow-ambient);
                    overflow: visible; margin-top: 0.9375rem;
                }
                .item-row { transition: 0.2s; border-bottom: 1px solid rgba(0,0,0,0.05); }
                .item-row:hover { background: rgba(255, 255, 255, 0.8); }
            `}</style>

            <div className="cinematic-scroll glass-modal-container" onClick={(e) => e.stopPropagation()} style={{ 
                width: '68.75rem', maxHeight: '95vh',  
                backdropFilter: 'blur(30px)', borderRadius: '24px', padding: '2.5rem', background: 'var(--surface-card, #ffffff)', boxShadow: 'var(--shadow-ambient), 0 30px 60px rgba(0,0,0,0.3)', overflowY: 'auto', direction: 'rtl'
            }}>
                
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.875rem', borderBottom: 'none', paddingBottom:'0.9375rem'}}>
                    <h2 style={{ color: THEME.coffeeDark || '#2d1a11', fontWeight: 900, margin: 0, fontSize: 'var(--fs-2xl)' }}>
                        {logic.editingIssueId ? 'تعديل إذن صرف خامات' : 'إصدار إذن صرف خامات'}
                    </h2>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 900 }}>الصافي النهائي للصرف</div>
                        <div style={{ color: THEME.goldAccent || '#c2410c', fontWeight: 900, fontSize: 'var(--fs-3xl)' }}>{formatCurrency(grandTotal)}</div>
                    </div>
                </div>

                <div className="responsive-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11.25rem, 1fr))', gap: '1.5625rem', marginBottom: '1.5625rem' }}>
                    <div style={{ zIndex: 90, position: 'relative' }}>
                        <SmartCombo 
                            label="العقار/المشروع المستفيد *" 
                            icon="🏢" 
                            table="projects" 
                            displayCol="Property" 
                            searchCols="Property,project_code" 
                            value={logic.issueData?.project_id}
                            onSelect={(v: any) => logic.setIssueData({ ...logic.issueData, project_id: v?.id, job_order_id: null, items: logic.issueData.items.map((i:any) => ({...i, boq_id: null, boq_item_id: null})) })}
                        />
                    </div>

                    <div style={{ zIndex: 85, position: 'relative' }}>
                        {/* الفيلا ← أوامر الشغل بتاعتها؛ في الصرف لمقاول: أوامر المقاول ده بس */}
                        <JobOrderSelector
                            projectId={logic.issueData?.project_id || null}
                            contractorId={logic.issueData?.issue_type === 'صرف لمقاول' ? (logic.issueData?.subcontractor_id || null) : null}
                            value={logic.issueData?.job_order_id || null}
                            onChange={(id, jo) => logic.setIssueData((prev: any) => ({
                                ...prev,
                                job_order_id: id,
                                items: (prev?.items || []).map((i: any) => (jo && !i.boq_id) ? { ...i, boq_id: jo.boq_budget_id, boq_item_name: jo.boq_budget?.work_item || i.boq_item_name } : i)
                            }))}
                        />
                    </div>
                    
                    <div style={{ zIndex: 80, position: 'relative' }}>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark || '#2d1a11', display: 'block', marginBottom: '0.375rem' }}>نوع الصرف *</label>
                        <select className="glass-input-field" value={logic.issueData?.issue_type || 'صرف لمقاول'} onChange={e => logic.setIssueData({...logic.issueData, issue_type: e.target.value})}>
                            <option value="صرف لمقاول">صرف لمقاول باطن (يُحمل عليه)</option>
                            <option value="استهلاك مباشر">استهلاك مباشر للشركة (يُحمل كـ تكلفة)</option>
                        </select>
                    </div>

                    <div style={{ zIndex: 70, position: 'relative' }}>
                        {logic.issueData?.issue_type === 'صرف لمقاول' ? (
                            <SmartCombo 
                                label="المقاول المستلم *" 
                                icon="👷" 
                                table="partners" 
                                displayCol="name" 
                                searchCols="name" 
                                customFilter="partner_type=eq.مقاول" 
                                value={logic.issueData?.subcontractor_id}
                                onSelect={(v: any) => logic.setIssueData({ ...logic.issueData, subcontractor_id: v?.id })} 
                            />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'flex-end' }}>
                                <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#166534', padding: '0.75rem', borderRadius: '12px', textAlign: 'center', fontWeight: 900, border: 'none', boxShadow: 'var(--shadow-elevation)' }}>
                                    سيتم تحميل التكلفة مباشرة على المشروع
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ marginBottom: '1.5625rem' }}>
                    <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark || '#2d1a11', display: 'block', marginBottom: '0.375rem' }}>تاريخ الصرف</label>
                    <input 
                        type="date" 
                        className="glass-input-field" 
                        style={{maxWidth: '18.75rem'}} 
                        value={logic.issueData?.issue_date || ''} 
                        onChange={e => logic.setIssueData({...logic.issueData, issue_date: e.target.value})} 
                    />
                </div>
                
                <div style={{ background: 'rgba(202, 138, 4, 0.05)', padding: '1.25rem', borderRadius: '14px', marginBottom: '1.5625rem', border: 'none', boxShadow: 'var(--shadow-ambient)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9375rem' }}>
                        <h3 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 900, color: THEME.coffeeDark || '#2d1a11' }}>الخامات المنصرفة وربطها بالبنود</h3>
                        <button onClick={logic.addItem} style={{ background: 'white', color: THEME.coffeeDark || '#2d1a11', border: 'none', boxShadow: 'var(--shadow-elevation)', padding: '0.5rem 0.9375rem', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', transition: '0.2s' }}>
                            إضافة صنف آخر
                        </button>
                    </div>
                    
                    <div className="lines-table-container">
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                            <thead style={{ background: THEME.coffeeDark || '#2d1a11', color: 'white' }}>
                                <tr>
                                    <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)', textAlign: 'right', width: '25%' }}>بيان الخامة (من المخزن)</th>
                                    <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)', width: '25%' }}>تحميل على بند (BOQ) - اختياري</th>
                                    <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)', width: '10%' }}>الكمية</th>
                                    <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)', width: '8%' }}>الوحدة</th>
                                    <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)', width: '12%' }}>السعر</th>
                                    <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)', width: '15%' }}>الإجمالي</th>
                                    <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)', width: '5%' }}>حذف</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logic.issueData?.items?.map((item: any, idx: number) => {
                                    const totalStock = (Number(item.available_qty) || 0) + (Number(item.old_qty) || 0);
                                    const isOutOfStock = Number(item.quantity) > totalStock;

                                    return (
                                        <tr key={idx} className="item-row">
                                            <td style={{ padding: '0.625rem', zIndex: 60 - idx, position: 'relative' }}>
                                                {/* 🚀 القراءة من الجدول الأساسي للمخازن مباشرة material_items */}
                                                <SmartCombo 
                                                    table="material_items" 
                                                    displayCol="item_name" 
                                                    searchCols="item_name,item_code" 
                                                    value={item.item_id}
                                                    initialDisplay={item.item_name}
                                                    placeholder="ابحث عن الخامة..."
                                                    onSelect={(v: any) => logic.handleItemChange(idx, 'item_selection', v)} 
                                                />
                                                {item.item_id && (
                                                    <div style={{ fontSize: 'var(--fs-xs)', marginTop: '0.3125rem', fontWeight: 900, color: isOutOfStock ? '#ef4444' : '#166534', textAlign: 'right', paddingRight: '0.3125rem' }}>
                                                        {isOutOfStock ? 'رصيد غير كافٍ!' : 'رصيد متوفر'} (المخزن: {totalStock} {item.unit})
                                                    </div>
                                                )}
                                            </td>
                                            
                                            <td style={{ padding: '0.625rem', zIndex: 50 - idx, position: 'relative' }}>
                                                {/* 🚀 السحب باستخدام الكمبوننت الذكي المخصص للبند */}
                                                <ProjectBoqCombo 
                                                    projectId={logic.issueData?.project_id}
                                                    value={item.boq_id}
                                                    initialDisplay={item.boq_item || item.boq_item_name}
                                                    onSelect={(selectedBoq: any) => {
                                                        logic.handleItemChange(idx, 'boq_selection', selectedBoq);
                                                    }} 
                                                />
                                            </td>

                                            <td style={{ padding: '0.625rem' }}>
                                                <input 
                                                    type="number" 
                                                    placeholder="0" 
                                                    className="glass-input-field" 
                                                    style={{ padding: '0.5rem', textAlign: 'center', background: 'var(--surface-sunken, #f8fafc)', border: isOutOfStock ? '2px solid #ef4444' : 'none', boxShadow: 'var(--shadow-sunken, inset 0 1px 3px rgba(0,0,0,0.05))' }} 
                                                    value={item.quantity ?? ''} 
                                                    onChange={e => logic.handleItemChange(idx, 'quantity', e.target.value)} 
                                                />
                                            </td>
                                            <td style={{ padding: '0.625rem' }}>
                                                <input 
                                                    type="text" 
                                                    placeholder="وحدة" 
                                                    disabled
                                                    className="glass-input-field" 
                                                    style={{ padding: '0.5rem', textAlign: 'center', background: '#f8fafc', opacity: 0.8 }} 
                                                    value={item.unit || ''} 
                                                />
                                            </td>
                                            <td style={{ padding: '0.625rem' }}>
                                                <input 
                                                    type="number" 
                                                    placeholder="0.00" 
                                                    className="glass-input-field" 
                                                    style={{ padding: '0.5rem', textAlign: 'center', background: 'white' }} 
                                                    value={item.unit_price ?? ''} 
                                                    onChange={e => logic.handleItemChange(idx, 'unit_price', e.target.value)} 
                                                    title="مسحوب بآخر سعر شراء، قابل للتعديل"
                                                />
                                            </td>
                                            <td style={{ padding: '0.625rem', fontWeight: 900, color: THEME.danger || '#ef4444', fontSize: 'var(--fs-md)' }}>
                                                {formatCurrency(item.total_price)}
                                            </td>
                                            <td style={{ padding: '0.625rem' }}>
                                                {idx > 0 ? (
                                                    <button onClick={() => logic.handleRemoveItem(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 'var(--fs-xl)' }} title="حذف الصنف"><Trash2 size={15} aria-hidden="true" /></button>
                                                ) : <div style={{width: '1.5rem'}}></div>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="responsive-summary-grid" style={{ marginTop: '1.875rem', padding: '1.5625rem', background: 'linear-gradient(135deg, #1e293b, #0f172a)', borderRadius: '14px', color: 'white', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11.25rem, 1fr))', gap: '1.25rem', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.9375rem', borderRadius: '16px', border: 'none', boxShadow: 'var(--shadow-elevation)' }}>
                        <div style={{ fontSize: 'var(--fs-sm)', color: '#94a3b8', fontWeight: 800 }}>عدد الأصناف المنصرفة</div>
                        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900 }}>{logic.issueData?.items?.length || 0}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.9375rem', borderRadius: '16px', border: 'none', boxShadow: 'var(--shadow-elevation)' }}>
                        <div style={{ fontSize: 'var(--fs-sm)', color: '#94a3b8', fontWeight: 800 }}>إجمالي الكميات</div>
                        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900 }}>{totalQuantity}</div>
                    </div>
                    <div style={{ background: `linear-gradient(135deg, ${THEME.goldAccent || '#c2410c'}40, transparent)`, padding: '0.9375rem', borderRadius: '16px', border: 'none', boxShadow: 'var(--shadow-elevation)' }}>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#fcd34d' }}>إجمالي التكلفة / الخصم</div>
                        <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 900, color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{formatCurrency(grandTotal)}</div>
                    </div>
                </div>

                <div className="responsive-actions" style={{ display: 'flex', gap: '1.25rem', marginTop: '2.1875rem' }}>
                    <button onClick={logic.handleSave} className="btn-glass-save" style={{ flex: 2 }}>
                        {logic.editingIssueId ? 'تحديث وحفظ الإذن' : 'حفظ إذن الصرف (مسودة)'}
                    </button>
                    <button onClick={onClose} className="btn-glass-cancel" style={{ flex: 1 }}>
                        إلغاء
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}