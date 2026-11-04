"use client";
import React, { useEffect } from 'react';
import { formatCurrency } from '@/lib/helpers';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast-context'; 
import SmartCombo from '@/components/SmartCombo'; 
import PhiDialog from '@/components/PhiDialog';
import { FileText, Landmark, ListPlus, Percent, Plus, ReceiptText, Save, Trash2, X } from 'lucide-react';

// --- [المودال الرئيسي للفاتورة] ---
export default function InvoiceFormModal({ isOpen, onClose, record, setRecord, onSave, isSaving, projects }: any) {
    const { showToast } = useToast(); 

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

    if (!isOpen || !record) return null;

    const units = ['متر طولي', 'متر مربع', 'متر مكعب', 'مقطوعية', 'عدد'];
    const lines = record.lines || [];
    const linesTotal = lines.reduce((sum: number, line: any) => sum + Number(line.total_price || 0), 0);
    const removeProject = (id: any) => {
        const next = (record.selected_projects || []).filter((c: any) => c.id !== id);
        setRecord({ ...record, selected_projects: next, project_ids: next.map((c: any) => c.id) });
    };

    return (
        <PhiDialog
            open={isOpen}
            onClose={onClose}
            size="xl"
            busy={isSaving}
            title={record.id ? 'تعديل الفاتورة' : 'فاتورة جديدة'}
            subtitle={record.invoice_number ? `رقم الفاتورة: ${record.invoice_number}` : 'أدخل بيانات العميل والبنود ثم احفظ لترحيل القيود'}
            icon={<ReceiptText size={22} />}
            total={<><small>الصافي النهائي</small><strong>{formatCurrency(record.total_amount ?? 0)}</strong></>}
            footer={<button type="button" className="ent-button ent-primary" onClick={handleValidateAndSave} disabled={isSaving}><Save size={16} aria-hidden="true" />{isSaving ? 'جاري الحفظ والترحيل…' : 'حفظ الفاتورة وترحيل القيود'}</button>}
        >
            <section className="ent-form-section">
                <h3><FileText size={17} aria-hidden="true" />بيانات الفاتورة
                    <label className="phi-check ent-section-action"><input type="checkbox" checked={!record.skip_zatca} onChange={(e) => setRecord({ ...record, skip_zatca: !e.target.checked })} />خاضعة لضريبة القيمة المضافة (15٪)</label>
                </h3>
                <div className="ent-form-grid cols-3">
                    <div className="ent-form-field"><label htmlFor="inv-date">تاريخ الفاتورة</label><input id="inv-date" type="date" value={record.date?.split('T')[0] ?? ''} onChange={(e) => setRecord({ ...record, date: e.target.value })} /></div>
                    <div className="ent-form-field"><label htmlFor="inv-due">فترة السداد (بالأيام)</label><input id="inv-due" type="number" min="0" placeholder="مثلاً: 30" value={record.due_in_days ?? ''} onChange={(e) => setRecord({ ...record, due_in_days: e.target.value })} />{record.due_date && <span className="ent-field-note">تاريخ الاستحقاق: {new Date(record.due_date).toLocaleDateString('ar-EG')}</span>}</div>
                    <div className="ent-form-field"><label htmlFor="inv-number">رقم الفاتورة (تلقائي)</label><input id="inv-number" type="text" value={record.invoice_number ?? ''} readOnly dir="ltr" /></div>
                    <div className="ent-form-field">
                        <SmartCombo label="العميل" table="partners" searchCols="name,code" displayCol="name"
                            initialDisplay={record.client_name || record.partners?.name || ''}
                            onSelect={(p: any) => setRecord({ ...record, partner_id: p?.id || null, client_name: p?.name || '' })}
                            allowAddNew={true} enableClear={true} />
                    </div>
                    <div className="ent-form-field" style={{ gridColumn: 'span 2' }}>
                        <SmartCombo label="العقارات / العماير (اختيار متعدد)" table="projects" searchCols="Property,project_name,project_code" displayCol="Property"
                            multi={true} selectedValues={record.selected_projects || []}
                            onSelect={(p: any) => {
                                let current = record.selected_projects || [];
                                current = current.some((c: any) => c.id === p.id) ? current.filter((c: any) => c.id !== p.id) : [...current, p];
                                const updateData = { ...record, selected_projects: current, project_ids: current.map((c: any) => c.id) };
                                if (p.client_id && !record.partner_id) { updateData.partner_id = p.client_id; updateData.client_name = p.client_name; }
                                setRecord(updateData);
                            }} />
                        {(record.selected_projects || []).length > 0 && <div className="phi-chips">
                            {(record.selected_projects || []).map((proj: any) => <span key={proj.id} className="phi-chip">{proj.Property || proj.project_name}<button type="button" onClick={() => removeProject(proj.id)} aria-label={`إزالة ${proj.Property || proj.project_name || 'العقار'}`}><X size={12} /></button></span>)}
                        </div>}
                    </div>
                </div>
            </section>

            <div className="ent-form-divider" />
            <section className="ent-form-section">
                <h3><ListPlus size={17} aria-hidden="true" />بنود الفاتورة <span className="ent-muted">{lines.length.toLocaleString('ar-EG')} بند</span></h3>
                <div className="ent-form-grid cols-3">
                    <div className="ent-form-field ent-form-full">
                        <SmartCombo label="البند من المقايسة (BOQ)" table="boq_items" searchCols="item_name,item_code" displayCol="item_name"
                            initialDisplay={record.description || ''}
                            onSelect={(b: any) => setRecord({ ...record, boq_id: b?.id || null, description: b?.item_name || '', unit: b?.unit_of_measure || record.unit, unit_price: b?.price || record.unit_price })}
                            enableClear={true} />
                    </div>
                    <div className="ent-form-field ent-form-full"><label htmlFor="inv-desc">البيان التفصيلي</label><textarea id="inv-desc" rows={2} value={record.description ?? ''} onChange={(e) => setRecord({ ...record, description: e.target.value })} /></div>
                    <div className="ent-form-field"><label htmlFor="inv-qty">الكمية</label><input id="inv-qty" type="number" min="0" value={record.quantity ?? ''} onChange={(e) => setRecord({ ...record, quantity: e.target.value })} /></div>
                    <div className="ent-form-field"><label htmlFor="inv-unit">الوحدة</label><select id="inv-unit" value={record.unit ?? 'عدد'} onChange={(e) => setRecord({ ...record, unit: e.target.value })}>
                        {record.unit && !units.includes(record.unit) && <option value={record.unit}>{record.unit}</option>}
                        {units.map(u => <option key={u} value={u}>{u}</option>)}
                    </select></div>
                    <div className="ent-form-field"><label htmlFor="inv-price">سعر الوحدة</label><input id="inv-price" type="number" min="0" step="0.01" value={record.unit_price ?? ''} onChange={(e) => setRecord({ ...record, unit_price: e.target.value })} /></div>
                </div>
                <div className="phi-lines-actions">
                    <span className="ent-muted">قيمة البند الحالي: {formatCurrency(Number(record.quantity || 0) * Number(record.unit_price || 0))}</span>
                    <button type="button" className="ent-button" onClick={handleAddStatement}><Plus size={15} aria-hidden="true" />إدراج البند في الفاتورة</button>
                </div>
                {lines.length > 0 && <div className="phi-lines">
                    <table>
                        <thead><tr><th>م</th><th>البيان</th><th className="is-num">الكمية</th><th>الوحدة</th><th className="is-num">السعر</th><th className="is-num">الإجمالي</th><th><span className="sr-only">إجراء</span></th></tr></thead>
                        <tbody>{lines.map((line: any, idx: number) => <tr key={idx}>
                            <td>{(idx + 1).toLocaleString('ar-EG')}</td>
                            <td>{line.description}</td>
                            <td className="is-num">{line.quantity}</td>
                            <td>{line.unit}</td>
                            <td className="is-num">{formatCurrency(line.unit_price)}</td>
                            <td className="is-num"><strong>{formatCurrency(line.total_price)}</strong></td>
                            <td><button type="button" className="ent-icon-button" onClick={() => handleRemoveLine(idx)} aria-label={`حذف البند ${idx + 1}`}><Trash2 size={15} /></button></td>
                        </tr>)}</tbody>
                        <tfoot><tr><td colSpan={5}>إجمالي البنود المدرجة</td><td className="is-num">{formatCurrency(linesTotal)}</td><td /></tr></tfoot>
                    </table>
                </div>}
            </section>

            <div className="ent-form-divider" />
            <section className="ent-form-section">
                <h3><Landmark size={17} aria-hidden="true" />التوجيه المحاسبي</h3>
                <div className="ent-form-grid">
                    <div className="ent-form-field"><SmartCombo key={`debit-${record.debit_account_id || 'empty'}`} label="الحساب المدين (من حـ/)" table="accounts" searchCols="name,code" displayCol="name" initialDisplay={record.debit_account_name || record.debit_account?.name || ''} onSelect={(a: any) => setRecord({ ...record, debit_account_id: a?.id || null, debit_account_name: a?.name || '' })} /></div>
                    <div className="ent-form-field"><SmartCombo key={`credit-${record.credit_account_id || 'empty'}`} label="الحساب الدائن (إلى حـ/)" table="accounts" searchCols="name,code" displayCol="name" initialDisplay={record.credit_account_name || record.credit_account?.name || ''} onSelect={(a: any) => setRecord({ ...record, credit_account_id: a?.id || null, credit_account_name: a?.name || '' })} /></div>
                </div>
            </section>

            <div className="ent-form-divider" />
            <section className="ent-form-section">
                <h3><Percent size={17} aria-hidden="true" />الخصومات والاستقطاعات <span className="ent-muted">اختياري</span></h3>
                <div className="ent-form-grid">
                    <div className="ent-form-field"><label htmlFor="inv-mat">خصم خامات العميل</label><input id="inv-mat" type="number" min="0" step="0.01" value={record.materials_discount ?? ''} onChange={(e) => setRecord({ ...record, materials_discount: e.target.value })} /></div>
                    <div className="ent-form-field">{Number(record.materials_discount) > 0 ? <SmartCombo key={`mat-${record.materials_acc_id || 'empty'}`} label="ترحل الخامات إلى حساب" table="accounts" searchCols="name,code" displayCol="name"
                        placeholder={record.materials_acc_id === '85e61a6a-8c85-4219-a733-3b2180dfe043' ? '[217] مخزون خامات العميل (افتراضي)' : 'اختر حساب...'}
                        initialDisplay={record.materials_acc_name || record.materials_account?.name || ''}
                        onSelect={(a: any) => setRecord({ ...record, materials_acc_id: a?.id || null, materials_acc_name: a?.name || '' })} /> : <span className="ent-field-note">يظهر حساب ترحيل الخامات عند إدخال خصم.</span>}</div>
                    <div className="ent-form-field"><label htmlFor="inv-guar">نسبة ضمان الأعمال ٪</label><input id="inv-guar" type="number" min="0" max="100" step="0.01" value={record.guarantee_percent ?? ''} onChange={(e) => setRecord({ ...record, guarantee_percent: e.target.value })} /></div>
                    <div className="ent-form-field">{Number(record.guarantee_percent) > 0 ? <SmartCombo key={`guar-${record.guarantee_acc_id || 'empty'}`} label="ترحل استقطاعات الضمان إلى حساب" table="accounts" searchCols="name,code" displayCol="name"
                        placeholder={record.guarantee_acc_id === '8bf39cb1-4028-4c9e-817d-27c239873030' ? '[124] تأمينات محتجزة لدى الغير (افتراضي)' : 'اختر حساب...'}
                        initialDisplay={record.guarantee_acc_name || record.guarantee_account?.name || ''}
                        onSelect={(a: any) => setRecord({ ...record, guarantee_acc_id: a?.id || null, guarantee_acc_name: a?.name || '' })} /> : <span className="ent-field-note">يظهر حساب ترحيل الضمان عند إدخال نسبة.</span>}</div>
                </div>
            </section>

            <div className="phi-totals" aria-live="polite">
                <div className="phi-total"><small>الإجمالي قبل الخصم</small><strong>{formatCurrency(record.line_total ?? 0)}</strong></div>
                <div className="phi-total"><small>الخاضع للضريبة</small><strong>{formatCurrency(record.taxable_amount ?? 0)}</strong></div>
                <div className="phi-total"><small>{record.skip_zatca ? 'الضريبة (غير خاضعة)' : 'ضريبة القيمة المضافة 15٪'}</small><strong>{formatCurrency(record.tax_amount ?? 0)}</strong></div>
                <div className="phi-total is-bad"><small>محتجز ضمان الأعمال</small><strong>{formatCurrency(record.guarantee_amount ?? 0)}</strong></div>
                <div className="phi-total is-grand"><small>الصافي النهائي</small><strong>{formatCurrency(record.total_amount ?? 0)}</strong></div>
            </div>
        </PhiDialog>
    );
}
