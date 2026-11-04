"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // 🚀 استدعاء البورتال
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast-context'; 
import SmartCombo from '@/components/SmartCombo'; 

// --- [المودال الرئيسي للفاتورة] ---
export default function InvoiceFormModal({ isOpen, onClose, record, setRecord, onSave, isSaving, projects }: any) {
    const { showToast } = useToast(); 
    const [mounted, setMounted] = useState(false); // 🚀 للتأكد من الرندر في المتصفح

    useEffect(() => {
        setMounted(true);
    }, []);

    // 🚀 1. سحب البيانات بشكل ذكي ومؤكد (العقارات، العميل، والبنود)
    useEffect(() => {
        if (!isOpen || !record) return;

        let updates: any = {};
        let needsUpdate = false;

        // أ. الفاتورة الجديدة
        if (!record.invoice_number) {
            updates.invoice_number = `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
            updates.date = record.date || new Date().toISOString();
            updates.tax_acc_id = record.tax_acc_id || '990c949c-5f32-40d7-8d36-5fe45a6c892c'; 
            updates.materials_acc_id = record.materials_acc_id || '85e61a6a-8c85-4219-a733-3b2180dfe043';
            updates.guarantee_acc_id = record.guarantee_acc_id || '8bf39cb1-4028-4c9e-817d-27c239873030';
            needsUpdate = true;
        }

        // ب. سحب العقارات المرتبطة بالفاتورة
        if (record.id && !record.selected_projects && record.project_ids && projects?.length > 0) {
            const mappedProjects = projects.filter((p: any) => record.project_ids.includes(p.id));
            if (mappedProjects.length > 0) {
                updates.selected_projects = mappedProjects;
                needsUpdate = true;
            }
        }

        // ج. سحب اسم العميل لو كان متخزن جوه object الـ partners
        if (record.id && !record.client_name && record.partners?.name) {
            updates.client_name = record.partners.name;
            needsUpdate = true;
        }

        // 💎 د. (التعديل الأهم): سحب البنود التفصيلية في حالة التعديل عشان الجدول ميكونش فاضي
        if (record.id && !record.lines && (record.lines_data || record.items)) {
            updates.lines = record.lines_data || record.items || [];
            needsUpdate = true;
        }

        // لو جمعنا أي داتا ناقصة، بنحدثها فوراً
        if (needsUpdate) {
            setRecord((prev: any) => ({ ...prev, ...updates }));
        }
    }, [record?.id, projects?.length, isOpen, record?.lines_data, record?.items]); 

    // 🚀 2. الحسابات الفورية
    useEffect(() => {
        if (!record) return; 
        const qty = Number(record.quantity || 0);
        const price = Number(record.unit_price || 0);
        
        // 💡 بيجمع السعر المكتوب حالياً + البنود المضافة في الجدول
        const linesTotal = (record.lines || []).reduce((sum: number, line: any) => sum + (Number(line.quantity) * Number(line.unit_price)), 0);
        const lineTotal = (qty * price) + linesTotal;
        
        const materialsDiscount = Number(record.materials_discount || 0);
        const taxableAmount = lineTotal - materialsDiscount;
        const guaranteePercent = Number(record.guarantee_percent || 0);
        const guaranteeAmount = (taxableAmount * guaranteePercent) / 100;
        
        // 💡 حساب الضريبة (لو متعلم إنها مش خاضعة بيديها 0، لو خاضعة بيحسب 15%)
        const taxAmount = record.skip_zatca ? 0 : (taxableAmount * 0.15); 
        const finalTotal = taxableAmount + taxAmount - guaranteeAmount;

        const days = Number(record.due_in_days || 0);
        const invoiceDate = record.date ? new Date(record.date) : new Date();
        const dueDateCalculated = new Date(invoiceDate);
        dueDateCalculated.setDate(dueDateCalculated.getDate() + days);

        if (
            record.line_total !== lineTotal ||
            record.taxable_amount !== taxableAmount ||
            record.guarantee_amount !== guaranteeAmount ||
            record.tax_amount !== taxAmount ||
            record.total_amount !== finalTotal ||
            record.due_date !== dueDateCalculated.toISOString()
        ) {
            setRecord((prev: any) => ({
                ...prev,
                line_total: lineTotal,
                taxable_amount: taxableAmount,
                guarantee_amount: guaranteeAmount,
                tax_amount: taxAmount,
                total_amount: finalTotal,
                due_date: dueDateCalculated.toISOString()
            }));
        }
    }, [record?.quantity, record?.unit_price, record?.materials_discount, record?.guarantee_percent, record?.date, record?.due_in_days, record?.skip_zatca, record?.lines]); 

    // 🚀 دالة إضافة البيان للجدول
    const handleAddStatement = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!record.description) {
            showToast("يرجى إدخال البيان التفصيلي أولاً", "warning");
            return;
        }
        if (Number(record.quantity || 0) <= 0 || Number(record.unit_price || 0) <= 0) {
            showToast("يرجى التأكد من إدخال الكمية والسعر بشكل صحيح", "warning");
            return;
        }

        const newStatement = {
            boq_id: record.boq_id || null,
            description: record.description,
            quantity: Number(record.quantity),
            unit: record.unit || 'عدد',
            unit_price: Number(record.unit_price),
            total_price: Number(record.quantity) * Number(record.unit_price)
        };

        setRecord({
            ...record,
            lines: [...(record.lines || []), newStatement],
            // تصفير الخانات المكتوبة بعد ما نزلناهم في الجدول
            description: '',
            quantity: '',
            unit_price: '',
            boq_id: null
        });
    };

    // 🚀 دالة حذف البيان من الجدول
    const handleRemoveLine = (indexToRemove: number) => {
        const filteredLines = (record.lines || []).filter((_: any, idx: number) => idx !== indexToRemove);
        setRecord({ ...record, lines: filteredLines });
    };

    // 🚀 3. دالة التحقق قبل الحفظ
    const handleValidateAndSave = () => {
        if (!record.date) {
            showToast("يرجى التأكد من إدخال تاريخ الفاتورة", "warning");
            return;
        }
        if (!record.partner_id) {
            showToast("يرجى اختيار العميل (البارتنر) أولاً", "warning");
            return;
        }
        if (Number(record.total_amount) <= 0 && Number(record.line_total) <= 0) {
            showToast("تنبيه: إجمالي الفاتورة 0، يرجى التأكد من السعر والكمية", "warning");
        }
        
        onSave(record);
    };

    if (!isOpen || !mounted) return null;

    // 📦 محتوى المودال
    const modalContent = (
        <div className="warm-portal-overlay-fullscreen" onClick={onClose}>
            
            <style>{`
                /* البلور الدافئ اللي بيغطي الشاشة كلها */
                .warm-portal-overlay-fullscreen {
                    position: fixed !important;
                    top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
                    width: 100vw !important; height: 100vh !important;
                    background: radial-gradient(circle at center, rgba(139, 69, 19, 0.4) 0%, rgba(15, 7, 0, 0.9) 100%) !important;
                    backdrop-filter: blur(20px) !important;
                    -webkit-backdrop-filter: blur(20px) !important;
                    display: flex !important; align-items: center !important; justify-content: center !important;
                    z-index: 999999999 !important; /* رقم ضخم يغطي السايد بار والهيدر */
                }

                .cinematic-scroll::-webkit-scrollbar { width: 6px; }
                .cinematic-scroll::-webkit-scrollbar-track { background: transparent; }
                .cinematic-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 10px; }
                .cinematic-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.3); }

                .glass-input-field {
                    width: 100%; padding: 10px 12px; border-radius: 12px;
                    background: rgba(255, 255, 255, 0.65);
                    border: 1px solid rgba(255, 255, 255, 0.8);
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                    outline: none; transition: all 0.2s;
                    font-weight: 700; color: #1e293b;
                }
                .glass-input-field:focus {
                    background: #ffffff; border-color: ${THEME.accent};
                    box-shadow: 0 0 0 4px rgba(202, 138, 4, 0.15);
                }
                
                .btn-glass-save {
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: white; border: none; padding: 12px 20px; border-radius: 12px;
                    font-weight: 900; font-size: 14px; cursor: pointer; transition: 0.3s;
                    box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
                }
                .btn-glass-save:hover:not(:disabled) { transform: translateY(-3px); filter: brightness(1.1); box-shadow: 0 15px 35px rgba(16, 185, 129, 0.5); }
                .btn-glass-save:active:not(:disabled) { transform: scale(0.98); }
                .btn-glass-save:disabled { opacity: 0.7; cursor: not-allowed; }

                .btn-glass-cancel {
                    background: rgba(255, 255, 255, 0.6);
                    color: #1e293b; border: 1px solid rgba(255, 255, 255, 0.8); padding: 12px 20px; border-radius: 12px;
                    font-weight: 900; font-size: 14px; cursor: pointer; transition: 0.3s;
                }
                .btn-glass-cancel:hover { background: rgba(255, 255, 255, 0.9); transform: translateY(-2px); }

                @media (max-width: 768px) {
                    .glass-modal-container {
                        width: 95% !important;
                        padding: 20px !important;
                        max-height: 95vh !important;
                    }
                    .modal-header-title { flex-direction: column; align-items: flex-start !important; gap: 15px; }
                    .modal-header-title h2 { font-size: 20px !important; }
                    .responsive-form-grid { grid-template-columns: 1fr !important; gap: 15px !important; }
                    .responsive-form-grid > div { grid-column: span 1 !important; }
                    .responsive-summary-grid { grid-template-columns: 1fr 1fr !important; gap: 12px !important; padding: 15px !important; }
                    .responsive-summary-grid > div { padding: 10px !important; }
                    .responsive-summary-grid div:nth-child(2) { font-size: 16px !important; }
                    .responsive-actions { flex-direction: column !important; gap: 10px !important; margin-top: 20px !important; }
                    .responsive-actions button { width: 100% !important; padding: 14px !important; }
                }
            `}</style>

            <div className="cinematic-scroll glass-modal-container" onClick={(e) => e.stopPropagation()} style={{ 
                width: '950px', maxHeight: '92vh', background: 'rgba(248, 250, 252, 0.85)', 
                backdropFilter: 'blur(25px)', borderRadius: '14px', padding: '40px', 
                boxShadow: '0 30px 60px rgba(0,0,0,0.25)', overflowY: 'auto', direction: 'rtl',
                border: '1px solid rgba(255,255,255,0.7)',
                animation: 'modalScaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
                
                <div className="modal-header-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: `2px solid ${THEME.accent}50`, paddingBottom: '15px' }}>
                    <h2 style={{ color: THEME.primary, fontWeight: 900, margin: 0, fontSize: '26px' }}>
                        {record.id ? 'تعديل الفاتورة' : 'إنشاء فاتورة جديدة'}
                    </h2>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: record?.skip_zatca ? '#fee2e2' : '#dcfce3', padding: '10px 18px', borderRadius: '15px', cursor: 'pointer', transition: '0.3s', border: `1px solid ${record?.skip_zatca ? '#fca5a5' : '#86efac'}` }} 
                         onClick={() => setRecord({ ...record, skip_zatca: !record.skip_zatca })}>
                        
                        <div style={{ width: '40px', height: '22px', background: record?.skip_zatca ? '#cbd5e1' : THEME.success, borderRadius: '20px', position: 'relative', transition: '0.3s' }}>
                            <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: record?.skip_zatca ? '2px' : '20px', transition: '0.3s', boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }} />
                        </div>
                        
                        <span style={{ fontSize: '13px', fontWeight: 900, color: record?.skip_zatca ? '#dc2626' : THEME.success }}>
                            {record?.skip_zatca ? 'غير خاضعة للضريبة (0%)' : 'خاضعة للضريبة (15%)'}
                        </span>
                    </div>
                </div>

                <div className="responsive-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '25px' }}>
                    
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>تاريخ الفاتورة</label>
                        <input type="date" value={record.date?.split('T')[0] ?? ''} onChange={(e) => setRecord({...record, date: e.target.value})} className="glass-input-field" />
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>رقم الفاتورة (تلقائي)</label>
                        <input type="text" value={record.invoice_number ?? ''} readOnly className="glass-input-field" style={{ background: 'rgba(226, 232, 240, 0.6)', color: THEME.primary }} />
                    </div>

                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>فترة السداد (بالأيام)</label>
                        <input 
                            type="number" 
                            placeholder="مثلاً: 30" 
                            value={record.due_in_days ?? ''} 
                            onChange={(e) => setRecord({...record, due_in_days: e.target.value})} 
                            className="glass-input-field"
                            style={{ border: `2px solid ${THEME.accent}70` }} 
                        />
                        {record.due_date && (
                            <div style={{ fontSize: '11px', marginTop: '8px', color: '#475569', fontWeight: 800 }}>
                                الاستحقاق: <span style={{color: THEME.primary}}>{new Date(record.due_date).toLocaleDateString('ar-EG')}</span>
                            </div>
                        )}
                    </div>

                    <SmartCombo 
                        label="العميل (البارتنر)" 
                        icon="👤"
                        table="partners" 
                        searchCols="name,code" displayCol="name"
                        initialDisplay={record.client_name || record.partners?.name || ''} 
                        onSelect={(p: any) => setRecord({...record, partner_id: p?.id || null, client_name: p?.name || ''})} 
                        allowAddNew={true} 
                        enableClear={true}
                    />
                    
                    <div style={{ gridColumn: 'span 1' }}>
                        <SmartCombo 
                            label="العقار / العماير (إختيار متعدد)" 
                            icon="🏢"
                            table="projects" 
                            searchCols="Property,project_name,project_code" 
                            displayCol="Property" 
                            multi={true} 
                            selectedValues={record.selected_projects || []} 
                            onSelect={(p: any) => {
                                let current = record.selected_projects || [];
                                if (current.some((c: any) => c.id === p.id)) {
                                    current = current.filter((c: any) => c.id !== p.id);
                                } else {
                                    current = [...current, p];
                                }
                                
                                const updateData = { 
                                    ...record, 
                                    selected_projects: current, 
                                    project_ids: current.map((c: any) => c.id) 
                                };
                                
                                if (p.client_id && !record.partner_id) {
                                    updateData.partner_id = p.client_id;
                                    updateData.client_name = p.client_name;
                                }
                                setRecord(updateData);
                            }} 
                        />
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                            {(record.selected_projects || []).map((proj: any) => (
                                <div key={proj.id} style={{ background: 'rgba(255,255,255,0.8)', border: `1px solid ${THEME.primary}30`, color: THEME.primary, padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                    {proj.Property || proj.project_name}
                                    <span style={{ cursor: 'pointer', color: THEME.ruby, fontSize: '14px' }} onClick={() => {
                                        const newSelected = record.selected_projects.filter((c:any) => c.id !== proj.id);
                                        setRecord({...record, selected_projects: newSelected, project_ids: newSelected.map((c:any)=>c.id)});
                                    }}>✖</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <SmartCombo 
                        label="البند (BOQ)" 
                        icon="🛠️"
                        table="boq_items" 
                        searchCols="item_name,item_code" 
                        displayCol="item_name" 
                        initialDisplay={record.description || ''}
                        onSelect={(b: any) => setRecord({
                            ...record, 
                            boq_id: b?.id || null, 
                            description: b?.item_name || '', 
                            unit: b?.unit_of_measure || record.unit, 
                            unit_price: b?.price || record.unit_price 
                        })} 
                        enableClear={true}
                    />

                    <div style={{ gridColumn: 'span 3' }}>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>البيان التفصيلي</label>
                        <textarea value={record.description ?? ''} onChange={(e) => setRecord({...record, description: e.target.value})} className="glass-input-field" style={{ height: '70px', resize: 'none' }} />
                    </div>

                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>العدد / الكمية</label>
                        <input type="number" value={record.quantity ?? ''} onChange={(e) => setRecord({...record, quantity: e.target.value})} className="glass-input-field" />
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>الوحدة</label>
                        <select value={record.unit ?? 'عدد'} onChange={(e) => setRecord({...record, unit: e.target.value})} className="glass-input-field" style={{ appearance: 'auto' }}>
                            {record.unit && !['متر طولي', 'متر مربع', 'متر مكعب', 'مقطوعية', 'عدد'].includes(record.unit) && (
                                <option value={record.unit}>{record.unit}</option>
                            )}
                            <option value="متر طولي">متر طولي</option>
                            <option value="متر مربع">متر مربع</option>
                            <option value="متر مكعب">متر مكعب</option>
                            <option value="مقطوعية">مقطوعية</option>
                            <option value="عدد">عدد</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>سعر الوحدة</label>
                        <input type="number" value={record.unit_price ?? ''} onChange={(e) => setRecord({...record, unit_price: e.target.value})} className="glass-input-field" />
                    </div>

                    {/* 🚀 زر إضافة البند والجدول الخاص بالبنود المضافة */}
                    <div style={{ gridColumn: 'span 3', textAlign: 'left' }}>
                        <button type="button" onClick={handleAddStatement} style={{ background: THEME.accent, color: 'white', border: 'none', padding: '10px 25px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', transition: '0.3s' }}>
                            إدراج البيان في الفاتورة
                        </button>
                    </div>

                    {/* 💎 أمان الدالة (record.lines || []) لضمان عدم حدوث Crash */}
                    {record.lines && record.lines.length > 0 && (
                        <div style={{ gridColumn: 'span 3', background: 'rgba(255,255,255,0.6)', padding: '15px', borderRadius: '16px', border: `1px solid ${THEME.border}` }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                                <thead>
                                    <tr>
                                        <th style={{ background: THEME.primary, color: 'white', padding: '10px', borderRadius: '0 8px 8px 0', fontSize: '12px' }}>م</th>
                                        <th style={{ background: THEME.primary, color: 'white', padding: '10px', textAlign: 'right', fontSize: '12px' }}>البيان</th>
                                        <th style={{ background: THEME.primary, color: 'white', padding: '10px', fontSize: '12px' }}>الكمية</th>
                                        <th style={{ background: THEME.primary, color: 'white', padding: '10px', fontSize: '12px' }}>الوحدة</th>
                                        <th style={{ background: THEME.primary, color: 'white', padding: '10px', fontSize: '12px' }}>السعر</th>
                                        <th style={{ background: THEME.primary, color: 'white', padding: '10px', fontSize: '12px' }}>الإجمالي</th>
                                        <th style={{ background: THEME.primary, color: 'white', padding: '10px', borderRadius: '8px 0 0 0', fontSize: '12px' }}>إجراء</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(record.lines || []).map((line: any, idx: number) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                            <td style={{ padding: '10px', fontWeight: 900 }}>{idx + 1}</td>
                                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700 }}>{line.description}</td>
                                            <td style={{ padding: '10px', fontWeight: 700 }}>{line.quantity}</td>
                                            <td style={{ padding: '10px', fontWeight: 700 }}>{line.unit}</td>
                                            <td style={{ padding: '10px', fontWeight: 700 }}>{formatCurrency(line.unit_price)}</td>
                                            <td style={{ padding: '10px', fontWeight: 900, color: THEME.primary }}>{formatCurrency(line.total_price)}</td>
                                            <td style={{ padding: '10px' }}>
                                                <button type="button" onClick={() => handleRemoveLine(idx)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 900 }}>✖</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <SmartCombo 
                        key={`debit-${record.debit_account_id || 'empty'}`}
                        label="حساب المدين (من حـ/)" 
                        icon="💳"
                        table="accounts" 
                        searchCols="name,code" displayCol="name"
                        initialDisplay={record.debit_account_name || record.debit_account?.name || ''}
                        onSelect={(a: any) => setRecord({...record, debit_account_id: a?.id || null, debit_account_name: a?.name || ''})} 
                    />
                    <SmartCombo 
                        key={`credit-${record.credit_account_id || 'empty'}`}
                        label="حساب الدائن (إلى حـ/)" 
                        icon="🏦"
                        table="accounts" 
                        searchCols="name,code" displayCol="name"
                        initialDisplay={record.credit_account_name || record.credit_account?.name || ''}
                        onSelect={(a: any) => setRecord({...record, credit_account_id: a?.id || null, credit_account_name: a?.name || ''})} 
                    />
                    
                    <div style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)', padding: '15px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800 }}>الإجمالي قبل الخصم</div>
                        <div style={{ fontSize: '20px', fontWeight: 900, color: THEME.primary }}>{formatCurrency(record.line_total ?? 0)}</div>
                    </div>

                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: THEME.ruby, display: 'block', marginBottom: '6px' }}>خصم خامات العميل (-)</label>
                        <input type="number" value={record.materials_discount ?? ''} onChange={(e) => setRecord({...record, materials_discount: e.target.value})} className="glass-input-field" style={{ border: `2px solid ${THEME.ruby}50` }} />
                    </div>
                    
                    <div style={{ gridColumn: 'span 2' }}>
                        {Number(record.materials_discount) > 0 && (
                            <SmartCombo 
                                key={`mat-${record.materials_acc_id || 'empty'}`}
                                label="ترحل الخامات إلى حساب:" 
                                icon="📦"
                                table="accounts" 
                                searchCols="name,code" displayCol="name"
                                placeholder={record.materials_acc_id === '85e61a6a-8c85-4219-a733-3b2180dfe043' ? '[217] مخزون خامات العميل (افتراضي)' : 'اختر حساب...'}
                                initialDisplay={record.materials_acc_name || record.materials_account?.name || ''}
                                onSelect={(a: any) => setRecord({...record, materials_acc_id: a?.id || null, materials_acc_name: a?.name || ''})} 
                            />
                        )}
                    </div>

                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>نسبة ضمان الأعمال %</label>
                        <input type="number" value={record.guarantee_percent ?? ''} onChange={(e) => setRecord({...record, guarantee_percent: e.target.value})} className="glass-input-field" />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                        {Number(record.guarantee_percent) > 0 && (
                            <SmartCombo 
                                key={`guar-${record.guarantee_acc_id || 'empty'}`}
                                label="ترحل استقطاعات الضمان إلى حساب:" 
                                icon="🛡️"
                                table="accounts" 
                                searchCols="name,code" displayCol="name"
                                placeholder={record.guarantee_acc_id === '8bf39cb1-4028-4c9e-817d-27c239873030' ? '[124] تأمينات محتجزة لدى الغير (افتراضي)' : 'اختر حساب...'}
                                initialDisplay={record.guarantee_acc_name || record.guarantee_account?.name || ''}
                                onSelect={(a: any) => setRecord({...record, guarantee_acc_id: a?.id || null, guarantee_acc_name: a?.name || ''})} 
                            />
                        )}
                    </div>

                </div>

                <div className="responsive-summary-grid" style={{ marginTop: '35px', padding: '25px', background: 'linear-gradient(135deg, #1e293b, #0f172a)', borderRadius: '14px', color: 'white', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>خاضع للضريبة</div>
                        <div style={{ fontSize: '20px', fontWeight: 900 }}>{formatCurrency(record.taxable_amount ?? 0)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>مبلغ الضريبة (15%)</div>
                        <div style={{ fontSize: '20px', fontWeight: 900 }}>{formatCurrency(record.tax_amount ?? 0)}</div>
                        <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px', fontWeight: 700 }}>
                            {record.skip_zatca ? 'الفاتورة غير خاضعة للضريبة' : 'ترحل لـ [215]'}
                        </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>محتجز ضمان أعمال</div>
                        <div style={{ fontSize: '20px', fontWeight: 900 }}>{formatCurrency(record.guarantee_amount ?? 0)}</div>
                        <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px', fontWeight: 700 }}>ترحل لـ [124]</div>
                    </div>
                    <div style={{ background: `linear-gradient(135deg, ${THEME.accent}40, transparent)`, padding: '15px', borderRadius: '16px', border: `1px solid ${THEME.accent}80`, boxShadow: `0 0 20px ${THEME.accent}20` }}>
                        <div style={{ fontSize: '12px', fontWeight: 900, color: THEME.accentLight }}>الصافي النهائي</div>
                        <div style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{formatCurrency(record.total_amount ?? 0)}</div>
                    </div>
                </div>

                <div className="responsive-actions" style={{ display: 'flex', gap: '20px', marginTop: '35px' }}>
                    <button onClick={handleValidateAndSave} disabled={isSaving} className="btn-glass-save" style={{ flex: 2 }}>
                        {isSaving ? 'جاري الحفظ والترحيل...' : 'حفظ الفاتورة وترحيل القيود'}
                    </button>
                    <button onClick={onClose} className="btn-glass-cancel" style={{ flex: 1 }}>
                        إلغاء وإغلاق
                    </button>
                </div>
            </div>
        </div>
    );

    // 🚀 السحر هنا: حقن المودال في البورتال
    return createPortal(modalContent, document.body);
}