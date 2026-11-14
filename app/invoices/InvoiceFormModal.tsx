"use client";
import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/helpers';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/lib/CompanyContext';
import { useToast } from '@/lib/toast-context'; 
import SmartCombo from '@/components/SmartCombo'; 
import PhiDialog from '@/components/PhiDialog';
import JobOrderSelector, { JobOrderOption } from '@/components/JobOrderSelector';
import { AlertCircle, CheckCircle2, Clock, FileText, Info, Landmark, Link2, ListPlus, Percent, Plus, ReceiptText, Save, Trash2, Wallet, X } from 'lucide-react';

type MaterialCredit = { receipt_id: string; receipt_number: string; receipt_date: string; available_amount: number | string };
const cents = (amount: number) => Math.round((amount + Number.EPSILON) * 100);

// --- [المودال الرئيسي للفاتورة] ---
export default function InvoiceFormModal({ isOpen, onClose, record, setRecord, onSave, isSaving, projects }: any) {
    const { showToast } = useToast(); 
    const { activeCompany } = useCompany();
    const selectionRequest = useRef(0);
    const lines: any[] = record?.lines || [];
    const perLine = record?.line_accounting === true;
    const orderIds = [...new Set<string>(lines.map(line => line.job_order_id).filter(Boolean))].sort();
    const materialQuery = useQuery({
        queryKey: ['invoice-customer-materials', activeCompany?.id, record?.partner_id, record?.date, orderIds],
        enabled: Boolean(isOpen && perLine && record?.partner_id && record?.date && orderIds.length),
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_invoice_customer_materials', {
                p_job_order_ids: orderIds, p_partner_id: record.partner_id, p_on_date: record.date
            });
            if (error) throw error;
            return (data || []) as MaterialCredit[];
        }
    });
    const lineAmounts = lines.map(line => {
        const base = cents(Number(line.quantity) * Number(line.unit_price));
        const tax = record?.skip_zatca ? 0 : Math.round(base * 0.15);
        const retention = Math.round(base * Number(line.retention_percent ?? 0) / 100);
        return { base, tax, retention };
    });
    const totals = lineAmounts.reduce((sum, line) => ({
        base: sum.base + line.base, tax: sum.tax + line.tax, retention: sum.retention + line.retention
    }), { base: 0, tax: 0, retention: 0 });
    const beforeMaterials = totals.base + totals.tax - totals.retention;
    const originalMaterials = new Map<string, number>((record?.customer_materials || []).map((row: any) => [row.receipt_id, Number(row.amount)]));
    const credits = materialQuery.data || [];
    let remaining = beforeMaterials;
    const allocations = credits.map(credit => {
        const available = cents(Number(credit.available_amount));
        const saved = record?.id && !record.use_available_materials ? originalMaterials.get(credit.receipt_id) ?? 0 : undefined;
        const input = record?.material_inputs?.[credit.receipt_id] ?? saved ?? (Math.max(0, Math.min(available, remaining)) / 100);
        const amount = Number(input);
        const amountInCents = cents(amount);
        const valid = Number.isFinite(amount) && amount >= 0 && amountInCents <= available
            && amount === Number(amount.toFixed(2));
        if (valid) remaining -= amountInCents;
        return { ...credit, input, amount, amountInCents, valid };
    });
    const materials = allocations.reduce((sum, row) => sum + (row.valid ? row.amountInCents : 0), 0);
    const defaultAccountsQuery = useQuery({
        queryKey: ['invoice-modal-default-accounts', activeCompany?.id],
        enabled: Boolean(isOpen && activeCompany?.id),
        queryFn: async () => {
            const { data, error } = await supabase
                .from('accounts')
                .select('id, code, name')
                .in('code', ['123', '124', '215', '217', '41', '411'])
                .eq('is_transactional', true);
            if (error) throw error;
            const byCode: Record<string, { id: string; code: string; name: string }> = {};
            for (const acc of data || []) byCode[acc.code] = acc;
            return byCode;
        }
    });

    // 🚀 استعلام سندات القبض الخاصة بنفس العميل لإمكانية ربط الدفعة
    const partnerReceiptsQuery = useQuery({
        queryKey: ['invoice-partner-receipts', activeCompany?.id, record?.partner_id],
        enabled: Boolean(isOpen && record?.partner_id),
        queryFn: async () => {
            const { data, error } = await supabase
                .from('receipt_vouchers')
                .select('id, receipt_number, date, amount, invoice_id, notes, description, status')
                .eq('partner_id', record.partner_id)
                .order('date', { ascending: false });
            if (error) return [];
            return (data || []) as any[];
        }
    });

    // 🚀 1. سحب البيانات بشكل ذكي ومؤكد (العقارات، العميل، والبنود)
    useEffect(() => {
        if (!isOpen || !record) return;

        let updates: any = {};
        let needsUpdate = false;
        const accByCode = defaultAccountsQuery.data;

        // أ. الفاتورة الجديدة
        // الرقم التسلسلي بيتحدد في قاعدة البيانات لحظة الحفظ (INV-السنة-0001)
        if (!record.id && (!record.defaults_applied || (!record.debit_account_id && accByCode))) {
            updates.date = record.date || new Date().toISOString().split('T')[0];
            if (accByCode) {
                const debitAcc = accByCode['123'];
                const creditAcc = accByCode['41'] || accByCode['411'];
                updates.defaults_applied = true;
                if (!record.debit_account_id && debitAcc) {
                    updates.debit_account_id = debitAcc.id;
                    updates.debit_account_name = debitAcc.name;
                }
                if (!record.credit_account_id && creditAcc) {
                    updates.credit_account_id = creditAcc.id;
                    updates.credit_account_name = creditAcc.name;
                }
                updates.tax_acc_id = record.tax_acc_id || accByCode['215']?.id || null;
                updates.materials_acc_id = record.materials_acc_id || accByCode['217']?.id || null;
                updates.guarantee_acc_id = record.guarantee_acc_id || accByCode['124']?.id || null;
            }
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
    }, [record?.id, projects?.length, isOpen, record?.lines_data, record?.items, defaultAccountsQuery.data]); 

    // 🚀 ربط سند القبض إذا كانت الفاتورة مرتبطة به مسبقاً
    useEffect(() => {
        if (!record?.id || record.selected_receipt_id || !partnerReceiptsQuery.data?.length) return;
        const linked = partnerReceiptsQuery.data.find((rc: any) => rc.invoice_id === record.id);
        if (linked) {
            setRecord((prev: any) => ({
                ...prev,
                selected_receipt_id: linked.id,
                paid_amount: prev.paid_amount != null && Number(prev.paid_amount) > 0 ? prev.paid_amount : Number(linked.amount || 0)
            }));
        }
    }, [record?.id, record?.selected_receipt_id, partnerReceiptsQuery.data]); 

    // 🚀 2. الحسابات الفورية
    useEffect(() => {
        if (!record) return; 
        if (record.line_accounting) return;
        
        // 💡 الإجمالي من البنود المدرجة في الجدول بس (كل بند مربوط بأمر شغل)
        const linesTotal = (record.lines || []).reduce((sum: number, line: any) => sum + (Number(line.quantity) * Number(line.unit_price)), 0);
        const lineTotal = linesTotal;
        
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
    }, [record?.quantity, record?.unit_price, record?.materials_discount, record?.guarantee_percent, record?.date, record?.due_in_days, record?.skip_zatca, record?.lines, record?.line_accounting]); 

    // 🚀 دالة إضافة البيان للجدول
    const handleAddStatement = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!record.line_job_order_id) {
            showToast("اختار الفيلا وأمر الشغل الأول", "warning");
            return;
        }
        if (!record.description) {
            showToast("يرجى إدخال البيان التفصيلي أولاً", "warning");
            return;
        }
        if (perLine && record.line_retention_percent == null) {
            showToast('حدّد نسبة ضمان الأعمال في أمر الشغل الأول. اكتب صفر لو مفيش ضمان.', 'warning');
            return;
        }
        if (Number(record.quantity || 0) <= 0 || Number(record.unit_price || 0) <= 0) {
            showToast("يرجى التأكد من إدخال الكمية والسعر بشكل صحيح", "warning");
            return;
        }

        const newStatement = {
            job_order_id: record.line_job_order_id,
            order_number: record.line_order_number || '',
            project_id: record.line_project_id || null,
            project_name: record.line_project_name || '',
            boq_budget_id: record.line_boq_budget_id || null,
            description: record.description,
            quantity: Number(record.quantity),
            unit: record.unit || 'عدد',
            unit_price: Number(record.unit_price),
            retention_percent: record.line_retention_percent,
            total_price: Number(record.quantity) * Number(record.unit_price)
        };

        // فيلا البند بتتضاف لفيلات الفاتورة لو مش موجودة
        const selected = record.selected_projects || [];
        const nextProjects = record.line_project_id && !selected.some((c: any) => c.id === record.line_project_id)
            ? [...selected, { id: record.line_project_id, Property: record.line_project_name }]
            : selected;

        setRecord({
            ...record,
            lines: [...(record.lines || []), newStatement],
            selected_projects: nextProjects,
            project_ids: nextProjects.map((c: any) => c.id),
            // تصفير خانات البند بعد ما نزل في الجدول (الفيلا بتفضل عشان البند اللي بعده)
            description: '',
            quantity: '',
            unit_price: '',
            line_job_order_id: null,
            line_retention_percent: null,
            line_order_number: '',
            line_boq_budget_id: null
        });
    };

    // 🚀 اختيار أمر الشغل للبند: الوصف = بند المقايسة، الكمية = المتبقي من الأمر بعد الفواتير التانية، السعر = سعر العقد
    const pickLineJobOrder = async (id: string | null, jo: JobOrderOption | null) => {
        const request = ++selectionRequest.current;
        if (!id || !jo) {
            setRecord((prev: any) => ({ ...prev, line_job_order_id: null, line_order_number: '', line_boq_budget_id: null, line_retention_percent: null }));
            return;
        }
        let invoicedQty = 0;
        const { data } = await supabase.from('invoices').select('id, lines_data').contains('lines_data', [{ job_order_id: id }]);
        if (request !== selectionRequest.current) return;
        (data || []).filter((inv: any) => inv.id !== record.id).forEach((inv: any) => {
            (Array.isArray(inv.lines_data) ? inv.lines_data : []).forEach((l: any) => { if (l?.job_order_id === id) invoicedQty += Number(l.quantity || 0); });
        });
        (record.lines || []).forEach((l: any) => { if (l?.job_order_id === id) invoicedQty += Number(l.quantity || 0); });
        const assigned = Number(jo.assigned_qty ?? jo.boq_budget?.contract_quantity ?? 0);
        const remaining = Math.max(assigned - invoicedQty, 0);
        if (assigned > 0 && remaining === 0) showToast(`أمر الشغل ${jo.order_number} اتفوتر بالكامل (${assigned})`, 'warning');
        setRecord((prev: any) => ({
            ...prev,
            line_job_order_id: id,
            line_order_number: jo.order_number,
            line_retention_percent: jo.retention_percent,
            line_boq_budget_id: jo.boq_budget_id,
            description: jo.boq_budget?.work_item || jo.notes || prev.description || '',
            unit: jo.boq_budget?.unit || prev.unit,
            quantity: remaining || '',
            unit_price: jo.boq_budget?.unit_contract_price ?? prev.unit_price
        }));
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
        if ((record.lines || []).length === 0) {
            showToast("أدرج بند واحد على الأقل (فيلا + أمر شغل) قبل الحفظ", "warning");
            return;
        }
        if ((record.lines || []).some((line: any) => !line.job_order_id)) {
            showToast("في بنود قديمة من غير أمر شغل؛ احذفها وأدرجها تاني من أمر الشغل", "warning");
            return;
        }
        if (record.line_job_order_id || Number(record.quantity || 0) > 0) {
            showToast("في بند مكتوب ولسه ما اتدرجش؛ اضغط «إدراج البند في الفاتورة» أو امسحه", "warning");
            return;
        }
        const previewNetTotal = perLine ? (beforeMaterials - materials) / 100 : Number(record.total_amount || 0);
        const previewLineTotal = perLine ? totals.base / 100 : Number(record.line_total || 0);
        if (previewNetTotal <= 0 && previewLineTotal <= 0) {
            showToast("تنبيه: إجمالي الفاتورة 0، يرجى التأكد من السعر والكمية", "warning");
        }
        
        if (!perLine) {
            onSave({
                ...record,
                paid_amount: Number(record.paid_amount || 0),
                selected_receipt_id: record.selected_receipt_id || null
            });
            return;
        }
        if (materialQuery.isFetching) {
            showToast('استنى تحميل رصيد خامات العميل قبل الحفظ.', 'warning');
            return;
        }
        if (materialQuery.isError && originalMaterials.size) {
            showToast('تعذّر مراجعة رصيد خامات الفاتورة. أعد تحميله قبل الحفظ.', 'error');
            return;
        }
        if (allocations.some(row => !row.valid) || materials > beforeMaterials) {
            showToast('راجع مبالغ الخامات. التسوية لا تتجاوز رصيد السند أو صافي الفاتورة.', 'warning');
            return;
        }
        const rawDate = String(record.date).split('T')[0];
        const date = new Date(rawDate + 'T00:00:00Z');
        date.setUTCDate(date.getUTCDate() + Number(record.due_in_days || 0));
        onSave({
            ...record,
            date: rawDate,
            due_date: date.toISOString().slice(0, 10),
            paid_amount: Number(record.paid_amount || 0),
            selected_receipt_id: record.selected_receipt_id || null,
            customer_materials: allocations.filter(row => row.amount > 0).map(row => ({ receipt_id: row.receipt_id, amount: row.amount }))
        });
    };

    if (!isOpen || !record) return null;

    const units = ['متر طولي', 'متر مربع', 'متر مكعب', 'مقطوعية', 'عدد'];
    const linesTotal = lines.reduce((sum: number, line: any) => sum + Number(line.total_price || 0), 0);
    const previewNetTotal = perLine ? (beforeMaterials - materials) / 100 : Number(record.total_amount ?? 0);
    const paidAmount = Number(record.paid_amount || 0);
    const remainingBalance = Number((previewNetTotal - paidAmount).toFixed(2));

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
            total={<><small>{paidAmount > 0 ? 'المتبقي المستحق' : 'الصافي المطلوب'}</small><strong>{formatCurrency(paidAmount > 0 ? remainingBalance : previewNetTotal)}</strong></>}
            footer={<button type="button" className="ent-button ent-primary" onClick={handleValidateAndSave} disabled={isSaving}><Save size={16} aria-hidden="true" />{isSaving ? 'جاري الحفظ والترحيل…' : 'حفظ الفاتورة وترحيل القيود'}</button>}
        >
            <section className="ent-form-section">
                <h3><FileText size={17} aria-hidden="true" />بيانات الفاتورة
                    <label className="phi-check ent-section-action"><input type="checkbox" checked={!record.skip_zatca} onChange={(e) => setRecord({ ...record, skip_zatca: !e.target.checked })} />خاضعة لضريبة القيمة المضافة (15٪)</label>
                </h3>
                <div className="ent-form-grid cols-3">
                    <div className="ent-form-field"><label htmlFor="inv-date">تاريخ الفاتورة</label><input id="inv-date" type="date" value={record.date?.split('T')[0] ?? ''} onChange={(e) => setRecord({ ...record, date: e.target.value })} /></div>
                    <div className="ent-form-field"><label htmlFor="inv-due">فترة السداد (بالأيام)</label><input id="inv-due" type="number" min="0" placeholder="مثلاً: 30" value={record.due_in_days ?? ''} onChange={(e) => setRecord({ ...record, due_in_days: e.target.value })} />{record.due_date && <span className="ent-field-note">تاريخ الاستحقاق: {new Date(record.due_date).toLocaleDateString('en-GB')}</span>}</div>
                    <div className="ent-form-field"><label htmlFor="inv-number">رقم الفاتورة (تلقائي)</label><input id="inv-number" type="text" value={record.invoice_number ?? ''} placeholder="يتحدد عند الحفظ" readOnly dir="ltr" /></div>
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
                <h3><ListPlus size={17} aria-hidden="true" />بنود الفاتورة <span className="ent-muted">{lines.length.toLocaleString('en-US')} بند</span></h3>
                <div className="ent-form-grid cols-3">
                    <div className="ent-form-field">
                        <SmartCombo key={`line-villa-${record.line_project_id || 'empty'}`} label="الفيلا" table="projects" searchCols="Property,project_name,project_code" displayCol="Property"
                            initialDisplay={record.line_project_name || ''}
                            onSelect={(p: any) => setRecord({ ...record, line_project_id: p?.id || null, line_project_name: p?.Property || '', line_job_order_id: null, line_order_number: '', line_boq_budget_id: null })}
                            enableClear={true} />
                    </div>
                    <div className="ent-form-field" style={{ gridColumn: 'span 2' }}>
                        {/* الفيلا ← أوامر الشغل بتاعتها؛ اختيار الأمر بينزّل بنده وكميته المتبقية وسعر العقد */}
                        <JobOrderSelector
                            projectId={record.line_project_id || null}
                            value={record.line_job_order_id || null}
                            onChange={(id, jo) => pickLineJobOrder(id, jo || null)}
                        />
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
                        <thead><tr><th>م</th><th>البيان</th><th className="is-num">الكمية</th><th>الوحدة</th><th className="is-num">السعر</th><th className="is-num">الإجمالي</th>{perLine && <><th className="is-num">الضريبة</th><th className="is-num">الضمان</th></>}<th><span className="sr-only">إجراء</span></th></tr></thead>
                        <tbody>{lines.map((line: any, idx: number) => <tr key={idx}>
                            <td>{(idx + 1).toLocaleString('en-US')}</td>
                            <td>{line.description}{(line.order_number || line.project_name) && <span className="ent-field-note">{[line.project_name, line.order_number && `أمر ${line.order_number}`].filter(Boolean).join(' · ')}</span>}</td>
                            <td className="is-num">{line.quantity}</td>
                            <td>{line.unit}</td>
                            <td className="is-num">{formatCurrency(line.unit_price)}</td>
                            <td className="is-num"><strong>{formatCurrency(line.total_price)}</strong></td>
                            {perLine && <><td className="is-num">{formatCurrency(lineAmounts[idx].tax / 100)}</td><td className="is-num">{formatCurrency(lineAmounts[idx].retention / 100)} <span className="ent-field-note">{line.retention_percent ?? '—'}٪</span></td></>}
                            <td><button type="button" className="ent-icon-button" onClick={() => handleRemoveLine(idx)} aria-label={`حذف البند ${idx + 1}`}><Trash2 size={15} /></button></td>
                        </tr>)}</tbody>
                        <tfoot><tr><td colSpan={5}>إجمالي البنود المدرجة</td><td className="is-num">{formatCurrency(perLine ? totals.base / 100 : linesTotal)}</td>{perLine && <><td className="is-num">{formatCurrency(totals.tax / 100)}</td><td className="is-num">{formatCurrency(totals.retention / 100)}</td></>}<td /></tr></tfoot>
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
            {perLine ? <section className="ent-form-section">
                <h3><Percent size={17} aria-hidden="true" />تسوية خامات العميل</h3>
                <p className="ent-field-note">تُخصم من المبلغ المطلوب بعد الضريبة والضمان. أي رصيد غير مستخدم يفضل على السند.</p>
                {materialQuery.isFetching && <p role="status">جاري تحميل سندات الخامات…</p>}
                {materialQuery.isError && <p role="alert">تعذّر عرض رصيد الخامات. راجع صلاحية عرض الخامات والقيود أو أعد المحاولة.</p>}
                {materialQuery.isSuccess && !credits.length && <p className="ent-field-note">مفيش رصيد خامات مرحّل لنفس العميل وأوامر الشغل المختارة.</p>}
                {!!allocations.length && <>
                    <button type="button" className="ent-button" onClick={() => setRecord((previous: any) => ({ ...previous, use_available_materials: true, material_inputs: {} }))}>استخدم الرصيد المتاح</button>
                    <div className="ent-form-grid">
                        {allocations.map(row => <div className="ent-form-field" key={row.receipt_id}>
                            <label htmlFor={'invoice-material-' + row.receipt_id}>سند {row.receipt_number} · المتاح {formatCurrency(row.available_amount)}</label>
                            <input id={'invoice-material-' + row.receipt_id} type="number" min="0" max={Number(row.available_amount)} step="0.01"
                                value={row.input} aria-invalid={!row.valid}
                                onChange={event => {
                                    const value = event.target.value;
                                    setRecord((previous: any) => ({ ...previous, material_inputs: { ...previous.material_inputs, [row.receipt_id]: value } }));
                                }} />
                        </div>)}
                    </div>
                </>}
            </section> : <section className="ent-form-section">
                <h3><Percent size={17} aria-hidden="true" />الخصومات والاستقطاعات <span className="ent-muted">اختياري</span></h3>
                <div className="ent-form-grid">
                    <div className="ent-form-field"><label htmlFor="inv-mat">خصم خامات العميل</label><input id="inv-mat" type="number" min="0" step="0.01" value={record.materials_discount ?? ''} onChange={(e) => setRecord({ ...record, materials_discount: e.target.value })} /></div>
                    <div className="ent-form-field">{Number(record.materials_discount) > 0 ? <SmartCombo key={`mat-${record.materials_acc_id || 'empty'}`} label="ترحل الخامات إلى حساب" table="accounts" searchCols="name,code" displayCol="name"
                        placeholder={record.materials_acc_id && record.materials_acc_id === defaultAccountsQuery.data?.['217']?.id ? '[217] مخزون خامات العميل (افتراضي)' : 'اختر حساب...'}
                        initialDisplay={record.materials_acc_name || record.materials_account?.name || ''}
                        onSelect={(a: any) => setRecord({ ...record, materials_acc_id: a?.id || null, materials_acc_name: a?.name || '' })} /> : <span className="ent-field-note">يظهر حساب ترحيل الخامات عند إدخال خصم.</span>}</div>
                    <div className="ent-form-field"><label htmlFor="inv-guar">نسبة ضمان الأعمال ٪</label><input id="inv-guar" type="number" min="0" max="100" step="0.01" value={record.guarantee_percent ?? ''} onChange={(e) => setRecord({ ...record, guarantee_percent: e.target.value })} /></div>
                    <div className="ent-form-field">{Number(record.guarantee_percent) > 0 ? <SmartCombo key={`guar-${record.guarantee_acc_id || 'empty'}`} label="ترحل استقطاعات الضمان إلى حساب" table="accounts" searchCols="name,code" displayCol="name"
                        placeholder={record.guarantee_acc_id && record.guarantee_acc_id === defaultAccountsQuery.data?.['124']?.id ? '[124] تأمينات محتجزة لدى الغير (افتراضي)' : 'اختر حساب...'}
                        initialDisplay={record.guarantee_acc_name || record.guarantee_account?.name || ''}
                        onSelect={(a: any) => setRecord({ ...record, guarantee_acc_id: a?.id || null, guarantee_acc_name: a?.name || '' })} /> : <span className="ent-field-note">يظهر حساب ترحيل الضمان عند إدخال نسبة.</span>}</div>
                </div>
            </section>}

            <div className="ent-form-divider" />
            <section className="ent-form-section">
                <h3>
                    <Wallet size={17} aria-hidden="true" />
                    الدفعات وسداد الفاتورة
                    {paidAmount > 0 && (
                        <span className="phi-chip" style={{
                            marginRight: 'auto',
                            background: remainingBalance === 0 ? 'var(--status-positive-bg, #ecfdf5)' : remainingBalance < 0 ? '#faf5ff' : '#fffbeb',
                            color: remainingBalance === 0 ? 'var(--status-positive, #059669)' : remainingBalance < 0 ? '#7c3aed' : '#b45309',
                            fontWeight: 700
                        }}>
                            {remainingBalance === 0 ? 'مسددة بالكامل' : remainingBalance < 0 ? 'رصيد دائن' : 'سداد جزئي'}
                        </span>
                    )}
                </h3>

                <div className="ent-form-grid cols-2">
                    <div className="ent-form-field">
                        <label htmlFor="inv-paid-amount">الدفعة المسددة من العميل</label>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                                id="inv-paid-amount"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={record.paid_amount ?? ''}
                                onChange={(e) => {
                                    const val = e.target.value === '' ? '' : Number(e.target.value);
                                    setRecord({ ...record, paid_amount: val, selected_receipt_id: null });
                                }}
                            />
                            <div style={{ display: 'inline-flex', gap: '4px', flexWrap: 'nowrap' }}>
                                <button
                                    type="button"
                                    className="ent-button"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '11px', whiteSpace: 'nowrap', fontWeight: 700 }}
                                    onClick={() => setRecord({ ...record, paid_amount: Number(previewNetTotal.toFixed(2)), selected_receipt_id: null })}
                                    title="سداد كامل القيمة"
                                >
                                    سداد كامل
                                </button>
                                <button
                                    type="button"
                                    className="ent-button"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '11px', whiteSpace: 'nowrap', fontWeight: 700 }}
                                    onClick={() => setRecord({ ...record, paid_amount: Number((previewNetTotal * 0.5).toFixed(2)), selected_receipt_id: null })}
                                    title="سداد 50%"
                                >
                                    50%
                                </button>
                                <button
                                    type="button"
                                    className="ent-button"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '11px', whiteSpace: 'nowrap', fontWeight: 700 }}
                                    onClick={() => setRecord({ ...record, paid_amount: Number((previewNetTotal * 0.25).toFixed(2)), selected_receipt_id: null })}
                                    title="سداد 25%"
                                >
                                    25%
                                </button>
                                <button
                                    type="button"
                                    className="ent-button"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '11px', whiteSpace: 'nowrap', fontWeight: 700 }}
                                    onClick={() => setRecord({ ...record, paid_amount: 0, selected_receipt_id: null })}
                                    title="تصفير الدفعة"
                                >
                                    تصفير
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="ent-form-field">
                        <label htmlFor="inv-receipt-select">ربط بسند قبض مسجل للعميل (اختياري)</label>
                        <select
                            id="inv-receipt-select"
                            value={record.selected_receipt_id || ''}
                            onChange={(e) => {
                                const receiptId = e.target.value;
                                if (!receiptId) {
                                    setRecord({ ...record, selected_receipt_id: null });
                                    return;
                                }
                                const found = (partnerReceiptsQuery.data || []).find((r: any) => String(r.id) === String(receiptId));
                                if (found) {
                                    setRecord({
                                        ...record,
                                        selected_receipt_id: found.id,
                                        paid_amount: Number(found.amount || 0)
                                    });
                                }
                            }}
                        >
                            <option value="">-- بدون ربط بسند قبض (إدخال يدوي) --</option>
                            {(partnerReceiptsQuery.data || []).map((rc: any) => {
                                const isCurrentLinked = rc.invoice_id === record?.id;
                                const isFree = !rc.invoice_id || isCurrentLinked;
                                return (
                                    <option key={rc.id} value={rc.id} disabled={!isFree}>
                                        سند {rc.receipt_number || rc.id.slice(0, 8)} · {formatCurrency(rc.amount)} · بتاريخ {rc.date}
                                        {rc.invoice_id && !isCurrentLinked ? ' (مرتبط بفاتورة أخرى)' : isCurrentLinked ? ' (مرتبط بهذه الفاتورة)' : ' (متاح للربط)'}
                                    </option>
                                );
                            })}
                        </select>
                        {record.selected_receipt_id && (
                            <span className="ent-field-note" style={{ color: 'var(--status-positive, #10b981)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                <CheckCircle2 size={13} /> تم ربط الفاتورة بسند القبض بنجاح واحتساب قيمته كدفعة مسددة.
                            </span>
                        )}
                        {!record.selected_receipt_id && partnerReceiptsQuery.data && partnerReceiptsQuery.data.length > 0 && (
                            <span className="ent-field-note">
                                يوجد {partnerReceiptsQuery.data.filter((r: any) => !r.invoice_id || r.invoice_id === record?.id).length} سند قبض متاح للعميل.
                            </span>
                        )}
                    </div>
                </div>

                {/* 🌟 إشعار المتبقي الديناميكي */}
                <div
                    className="phi-payment-notice"
                    style={{
                        marginTop: '0.75rem',
                        padding: '0.875rem 1.125rem',
                        borderRadius: '10px',
                        border: remainingBalance > 0 && paidAmount > 0
                            ? '1.5px solid #f59e0b'
                            : remainingBalance === 0 && previewNetTotal > 0
                            ? '1.5px solid #10b981'
                            : remainingBalance < 0
                            ? '1.5px solid #8b5cf6'
                            : '1.5px solid var(--ent-line, #e2e8f0)',
                        background: remainingBalance > 0 && paidAmount > 0
                            ? '#fffbeb'
                            : remainingBalance === 0 && previewNetTotal > 0
                            ? '#f0fdf4'
                            : remainingBalance < 0
                            ? '#faf5ff'
                            : '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.375rem',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.9rem' }}>
                            {remainingBalance > 0 && paidAmount > 0 && <AlertCircle size={18} color="#d97706" />}
                            {remainingBalance === 0 && previewNetTotal > 0 && <CheckCircle2 size={18} color="#059669" />}
                            {remainingBalance < 0 && <Info size={18} color="#7c3aed" />}
                            {(paidAmount === 0 || previewNetTotal <= 0) && <Clock size={18} color="#64748b" />}
                            <span style={{
                                color: remainingBalance > 0 && paidAmount > 0
                                    ? '#b45309'
                                    : remainingBalance === 0 && previewNetTotal > 0
                                    ? '#047857'
                                    : remainingBalance < 0
                                    ? '#6d28d9'
                                    : '#334155'
                            }}>
                                {remainingBalance > 0 && paidAmount > 0 && 'إشعار بالمتبقي المستحق على العميل'}
                                {remainingBalance === 0 && previewNetTotal > 0 && 'إشعار سداد كامل: الفاتورة مسددة 100%'}
                                {remainingBalance < 0 && 'إشعار فائض في السداد (رصيد دائن للعميل)'}
                                {paidAmount === 0 && 'إشعار بالمستحق: الفاتورة غير مسددة (بدون دفعة مقدمة)'}
                            </span>
                        </div>
                        <div style={{
                            padding: '0.2rem 0.65rem',
                            borderRadius: '999px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            background: remainingBalance > 0 && paidAmount > 0 ? '#fef3c7' : remainingBalance === 0 && previewNetTotal > 0 ? '#dcfce7' : remainingBalance < 0 ? '#ede9fe' : '#f1f5f9',
                            color: remainingBalance > 0 && paidAmount > 0 ? '#92400e' : remainingBalance === 0 && previewNetTotal > 0 ? '#166534' : remainingBalance < 0 ? '#5b21b6' : '#475569'
                        }}>
                            {remainingBalance > 0 && paidAmount > 0 && `المتبقي: ${formatCurrency(remainingBalance)}`}
                            {remainingBalance === 0 && previewNetTotal > 0 && 'تم السداد بالكامل'}
                            {remainingBalance < 0 && `دائن: ${formatCurrency(Math.abs(remainingBalance))}`}
                            {paidAmount === 0 && `المستحق: ${formatCurrency(previewNetTotal)}`}
                        </div>
                    </div>

                    <div style={{ fontSize: '0.825rem', color: '#475569', lineHeight: 1.5, paddingInlineStart: '1.625rem' }}>
                        {remainingBalance > 0 && paidAmount > 0 && (
                            <>
                                قام العميل بسداد دفعة قدرها <strong style={{ color: '#059669' }}>{formatCurrency(paidAmount)}</strong> من إجمالي الفاتورة المطلوب (<strong style={{ color: '#1e293b' }}>{formatCurrency(previewNetTotal)}</strong>).
                                <br />
                                <strong>المتبقي المطلوب تحصيله من العميل هو: <span style={{ color: '#d97706', fontSize: '0.95rem' }}>{formatCurrency(remainingBalance)}</span></strong>
                                {record.due_date && <span> · تاريخ الاستحقاق: {new Date(record.due_date).toLocaleDateString('ar-EG')}</span>}
                            </>
                        )}
                        {remainingBalance === 0 && previewNetTotal > 0 && (
                            <>
                                تم سداد كامل قيمة الفاتورة بمبلغ <strong style={{ color: '#059669' }}>{formatCurrency(paidAmount)}</strong>. تم تسوية رصيد هذه الفاتورة بالكامل ولا يوجد أي متبقي.
                            </>
                        )}
                        {remainingBalance < 0 && (
                            <>
                                المبلغ المسدد من العميل (<strong style={{ color: '#7c3aed' }}>{formatCurrency(paidAmount)}</strong>) أكبر من إجمالي الفاتورة (<strong style={{ color: '#1e293b' }}>{formatCurrency(previewNetTotal)}</strong>).
                                <br />
                                الفارق بقيمة <strong style={{ color: '#7c3aed' }}>{formatCurrency(Math.abs(remainingBalance))}</strong> يُسجل كرصيد دائن لصالح العميل.
                            </>
                        )}
                        {paidAmount === 0 && (
                            <>
                                لم يتم تسجيل أي دفعة نقدية أو بنكية مسددة حتى الآن. كامل قيمة الفاتورة الصافية <strong style={{ color: '#1e293b' }}>{formatCurrency(previewNetTotal)}</strong> تعتبر مستحقة بالكامل على العميل {record.client_name ? `(${record.client_name})` : ''}.
                            </>
                        )}
                    </div>
                </div>
            </section>

            <div className="phi-totals" aria-live="polite">
                <div className="phi-total"><small>إجمالي البنود</small><strong>{formatCurrency(perLine ? totals.base / 100 : record.line_total ?? 0)}</strong></div>
                {!perLine && <div className="phi-total"><small>الخاضع للضريبة</small><strong>{formatCurrency(record.taxable_amount ?? 0)}</strong></div>}
                <div className="phi-total"><small>{record.skip_zatca ? 'الضريبة (غير خاضعة)' : 'ضريبة القيمة المضافة 15٪'}</small><strong>{formatCurrency(perLine ? totals.tax / 100 : record.tax_amount ?? 0)}</strong></div>
                <div className="phi-total is-bad"><small>محتجز ضمان الأعمال</small><strong>{formatCurrency(perLine ? totals.retention / 100 : record.guarantee_amount ?? 0)}</strong></div>
                {perLine && <div className="phi-total is-bad"><small>تسوية خامات العميل</small><strong>{formatCurrency(materials / 100)}</strong></div>}
                <div className="phi-total"><small>صافي الفاتورة</small><strong>{formatCurrency(previewNetTotal)}</strong></div>
                <div className="phi-total is-good"><small>الدفعة المسددة</small><strong>{formatCurrency(paidAmount)}</strong></div>
                <div className={`phi-total is-grand ${remainingBalance > 0 && paidAmount > 0 ? 'is-warning' : ''}`}><small>المتبقي المستحق</small><strong>{formatCurrency(remainingBalance)}</strong></div>
            </div>
        </PhiDialog>
    );
}
