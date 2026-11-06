"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';
import SmartCombo from '@/components/SmartCombo';
import { formatCurrency } from '@/lib/helpers';
import { useToast } from '@/lib/toast-context'; 
import { Plus, Trash2 } from 'lucide-react';
import JobOrderSelector from '@/components/JobOrderSelector';
import TelegramAttachmentField from '@/components/TelegramAttachmentField';
import VoiceFormTrigger from '@/components/voice/VoiceFormTrigger';

// 🚀 مصفوفة التصنيفات
const EXPENSE_CATEGORIES = [
    "إعاشة وتغذية",
    "محروقات وانتقالات",
    "عدد ومعدات",
    "مستهلكات ومواد تشغيل",
    "صيانة وإصلاحات",
    "مصاريف إدارية",
    "عمولات وبقشيش",
    "سكن وأثاث",
    "أدوات نظافة",
    "مواد إنشائية"
];

// 🚀 مصفوفة أنواع الاستحقاق (شاملة العهد الميدانية المفتوحة)
const PAYMENT_METHODS = [
    "آجل",
    "تسوية داخلية",
    "عهدة"
];

export default function ExpenseFormModal({ 
    isOpen, 
    onClose, 
    record, 
    setRecord, 
    onSave, 
    isSaving, 
    projects, 
    historicalData
}: any) {
    const { showToast } = useToast();
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
        setMounted(true);
    }, []);

    // 🧮 الحسابات اللحظية
    let safeAddedLines: any[] = [];
    if (record?.lines_data) {
        if (typeof record.lines_data === 'string') {
            try { safeAddedLines = JSON.parse(record.lines_data); } catch (e) { console.error("JSON Parse Error", e); }
        } else if (Array.isArray(record.lines_data)) {
            safeAddedLines = record.lines_data;
        }
    }

    const currentQty = Number(record?.quantity || 0);
    const currentPrice = Number(record?.unit_price || 0);
    const currentVat = Number(record?.vat_amount || 0);
    const currentDiscount = Number(record?.discount_amount || 0);

    const linesSubtotal = safeAddedLines.reduce((sum: number, line: any) => sum + (Number(line.quantity) * Number(line.unit_price)), 0);
    const linesVat = safeAddedLines.reduce((sum: number, line: any) => sum + Number(line.vat_amount || 0), 0);
    const linesDiscount = safeAddedLines.reduce((sum: number, line: any) => sum + Number(line.discount_amount || 0), 0);

    const finalSubtotal = (currentQty * currentPrice) + linesSubtotal;
    const finalVat = currentVat + linesVat;
    const finalDiscount = currentDiscount + linesDiscount;
    const finalTotal = finalSubtotal + finalVat - finalDiscount;

    const isSettlement = record?.payment_method === 'تسوية داخلية';
    const isCustody = record?.payment_method === 'عهدة' || Boolean(record?.custody_id);

    const handleAddStatement = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!record.description) return showToast("يرجى إدخال اسم الصنف أو البيان أولاً", "warning");
        if (currentQty <= 0 || currentPrice <= 0) return showToast("الكمية والسعر يجب أن يكونا أكبر من صفر", "warning");

        const newLine = {
            description: record.description,
            quantity: currentQty,
            unit_price: currentPrice,
            vat_amount: currentVat,
            discount_amount: currentDiscount,
            total_price: (currentQty * currentPrice) + currentVat - currentDiscount
        };

        setRecord({
            ...record,
            lines_data: [...safeAddedLines, newLine],
            description: '', quantity: '', unit_price: '', vat_amount: '', discount_amount: ''
        });
        showToast("تمت إضافة الصنف للجدول بنجاح", "success");
    };

    const handleRemoveLine = (indexToRemove: number) => {
        const newLines = safeAddedLines.filter((_: any, idx: number) => idx !== indexToRemove);
        setRecord({ ...record, lines_data: newLines });
    };

    // 🛡️ معترض الحفظ النهائي (حفظ كمسودة فقط — الترحيل يتطلب اتصالاً بالإنترنت)
    const handleValidateAndSave = () => {
        if (!record.exp_date) return showToast("تاريخ المصروف مطلوب", "warning");
        if (!record.main_category) return showToast("يرجى اختيار التصنيف الرئيسي للمصروف", "warning"); 
        if (!record.creditor_account) return showToast("حساب المصروف المدين مطلوب", "warning");
        if (isCustody && !record.custody_id) {
            return showToast("يرجى اختيار العهدة المفتوحة المرتبطة بالمصروف", "warning");
        }
        if (!isCustody && !record.payment_account) {
            return showToast("يرجى تحديد الحساب الدائن", "warning");
        }
        
        let finalLinesToSave = safeAddedLines.filter((l: any) => Number(l.unit_price || 0) > 0 || Number(l.total_price || 0) > 0);

        if (record.description && currentQty > 0 && currentPrice > 0) {
            finalLinesToSave = [...finalLinesToSave, {
                description: record.description,
                quantity: currentQty,
                unit_price: currentPrice,
                vat_amount: currentVat,
                discount_amount: currentDiscount,
                total_price: (currentQty * currentPrice) + currentVat - currentDiscount
            }];
        }

        if (finalLinesToSave.length === 0) {
            return showToast("يرجى إدخال صنف أو بيان واحد على الأقل بسعر أكبر من صفر", "error");
        }

        const isSubContractorExpense = record.creditor_account === 'التزام مقاولي الباطن' || !!record.payee_id;

        // Require Job Order for project expenses to link with the budget properly
        if (!record.job_order_id && record.project_id) {
            return showToast("يرجى تحديد أمر التشغيل لكي يُخصم المصروف من الميزانية بشكل صحيح", "error");
        }

        onSave({
            ...record,
            lines_data: finalLinesToSave, 
            quantity: 1, 
            unit_price: finalSubtotal,
            vat_amount: finalVat,
            discount_amount: finalDiscount,
            payment_method: isCustody ? 'عهدة' : (record.payment_method || 'آجل'),
            payment_account: isCustody ? (record.payment_account || '125 - عُهد الموظفين والمواقع') : record.payment_account,
            custody_id: isCustody ? (record.custody_id || null) : null,
            project_id: record.project_id || null,
            payee_id: record.payee_id || null,
            job_order_id: record.job_order_id || null,
            is_deducted_from_contractor: isSubContractorExpense,
            is_posted: false
        });
    };

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="warm-portal-overlay-fullscreen" onClick={onClose}>
            <style>{`
                .warm-portal-overlay-fullscreen { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; background: radial-gradient(circle at center, rgba(40, 24, 10, 0.4) 0%, rgba(15, 7, 0, 0.9) 100%) !important; backdrop-filter: blur(20px) !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 999999999 !important; }
                .glass-input-field { width: 100%; padding: 0.625rem 0.75rem; border-radius: 12px; background: rgba(255, 255, 255, 0.65); border: 1px solid rgba(255, 255, 255, 0.8); outline: none; transition: 0.2s; font-weight: 700; color: #1e293b; }
                .glass-input-field:focus { background: #fff; border-color: ${THEME.accent}; box-shadow: 0 0 0 4px rgba(202, 138, 4, 0.15); }
                .btn-glass-save { background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 0.75rem 1.25rem; border-radius: 12px; font-weight: 900; font-size: var(--fs-md); cursor: pointer; transition: 0.3s; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4); }
                .btn-glass-save:hover:not(:disabled) { transform: translateY(-3px); filter: brightness(1.1); }
                .btn-glass-cancel { background: rgba(255, 255, 255, 0.6); color: #1e293b; border: 1px solid rgba(255, 255, 255, 0.8); padding: 0.75rem 1.25rem; border-radius: 12px; font-weight: 900; font-size: var(--fs-md); cursor: pointer; transition: 0.3s; }
                .btn-glass-cancel:hover { background: rgba(255, 255, 255, 0.9); transform: translateY(-2px); }
                .lines-table-container { background: rgba(255, 255, 255, 0.5); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.7); overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 0.9375rem; }
                .item-row { transition: 0.2s; border-bottom: 1px solid rgba(0,0,0,0.05); }
                .item-row:hover { background: rgba(255, 255, 255, 0.8); }
                @media (max-width: 768px) {
                    .responsive-line-entry-grid { grid-template-columns: 1fr 1fr !important; }
                    .responsive-line-entry-grid > div:first-child { grid-column: 1 / -1 !important; }
                    .responsive-line-entry-grid > button { grid-column: 1 / -1 !important; min-height: 2.75rem !important; }
                    .responsive-form-grid { grid-template-columns: 1fr !important; }
                    .responsive-summary-grid { grid-template-columns: 1fr 1fr !important; gap: 0.625rem !important; padding: 0.875rem !important; }
                    .responsive-summary-grid > div:last-child { grid-column: 1 / -1 !important; }
                }
            `}</style>

            <div className="cinematic-scroll glass-modal-container" onClick={(e) => e.stopPropagation()} style={{ width: '62.5rem', maxHeight: '95vh', background: 'rgba(248, 250, 252, 0.92)', backdropFilter: 'blur(30px)', borderRadius: '14px', padding: '2.5rem', boxShadow: '0 40px 80px rgba(0,0,0,0.4)', overflowY: 'auto', direction: 'rtl' }}>
                
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.875rem', borderBottom:`2px solid ${THEME.accent}50`, paddingBottom:'0.9375rem', gap: '1rem', flexWrap: 'wrap'}}>
                    <div>
                        <h2 style={{ color: THEME.primary, fontWeight: 900, margin: 0, fontSize: 'var(--fs-2xl)' }}>{record?.id ? 'تعديل مسودة المصروف' : 'إنشاء مسودة مصروف جديدة'}</h2>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, marginTop: '0.25rem' }}>
                            تُحفظ كمسودة غير مرحّلة (تدعم العمل بدون إنترنت والإدخال الصوتي الذكي)
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <VoiceFormTrigger
                            modalType="expense"
                            label="تسجيل صوتي للمصروف"
                            onFieldsParsed={(fields) => {
                                setRecord((prev: any) => ({
                                    ...prev,
                                    ...fields,
                                    description: fields.description || prev.description,
                                    category: fields.main_category || fields.category || prev.category,
                                    unit_price: fields.amount !== undefined ? Number(fields.amount) : prev.unit_price,
                                    quantity: 1,
                                    notes: fields.notes || prev.notes,
                                }));
                            }}
                        />
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 900 }}>الصافي النهائي</div>
                            <div style={{ color: THEME.accent, fontWeight: 900, fontSize: 'var(--fs-3xl)' }}>{formatCurrency(finalTotal)}</div>
                        </div>
                    </div>
                </div>

                <div className="responsive-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11.25rem, 1fr))', gap: '1.5625rem', marginBottom: '1.5625rem' }}>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.375rem' }}>تاريخ المصروف *</label>
                        <input type="date" className="glass-input-field" value={record?.exp_date || ''} onChange={e => setRecord({...record, exp_date: e.target.value})} />
                    </div>
                    <div style={{ gridColumn: 'span 2', zIndex: 90, position: 'relative' }}>
                        <SmartCombo 
                            label="المشروع / العقار" 
                            icon="🏢" 
                            options={projects && projects.length > 0 ? projects : undefined} 
                            table="projects" 
                            displayCol="Property" 
                            initialDisplay={record?.site_ref} 
                            onSelect={(val: any) => {
                                let finalSiteRef = typeof val === 'object' && val !== null ? val.Property : val;
                                let finalProjectId = typeof val === 'object' && val !== null ? val.id : null;

                                if (!finalProjectId && finalSiteRef && projects) {
                                    const matchedProject = projects.find((p: any) => p.Property === finalSiteRef);
                                    if (matchedProject) {
                                        finalProjectId = matchedProject.id;
                                    }
                                }

                                setRecord((prev: any) => ({
                                    ...prev, 
                                    site_ref: finalSiteRef,
                                    project_id: finalProjectId,
                                    job_order_id: null
                                }));
                            }} 
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11.25rem, 1fr))', gap: '1.5625rem', marginBottom: '1.5625rem' }}>
                    <div style={{ zIndex: 80, position: 'relative' }}>
                        <SmartCombo 
                            label="المقاول " 
                            icon="👤" 
                            table="partners" 
                            displayCol="name" 
                            initialDisplay={record?.sub_contractor} 
                            onSelect={(val:any) => {
                                let finalName = typeof val === 'object' && val !== null ? val.name : val;
                                let finalPayeeId = typeof val === 'object' && val !== null ? val.id : null;

                                setRecord((prev: any) => ({
                                    ...prev, 
                                    sub_contractor: finalName,
                                    payee_id: finalPayeeId,
                                    job_order_id: null
                                }));
                            }} 
                            allowAddNew={true} 
                        />
                    </div>
                    <div style={{ zIndex: 70, position: 'relative' }}>
                        <SmartCombo label="المستفيد المباشر" icon="👤" table="partners" displayCol="name" initialDisplay={record?.payee_name} onSelect={(val:any) => setRecord({...record, payee_name: typeof val === 'object' && val !== null ? val.name : val})} />
                    </div>
                    
                    <div style={{ zIndex: 65, position: 'relative' }}>
                        {/* الفيلا ← أوامر الشغل بتاعتها (ولو اخترت مقاول: أوامره هو بس) */}
                        <JobOrderSelector
                            projectId={record?.project_id || null}
                            contractorId={record?.payee_id || null}
                            value={record?.job_order_id || null}
                            onChange={(id, jo) => setRecord((prev: any) => {
                                let updates: any = { job_order_id: id };
                                if (jo && !prev?.description && (!prev?.lines_data || prev.lines_data.length === 0)) {
                                    updates.description = jo.boq_budget?.work_item || jo.notes || '';
                                }
                                return { ...prev, ...updates };
                            })}
                        />
                    </div>
                </div>

                <div style={{ marginBottom: '1.5625rem', zIndex: 60, position: 'relative' }}>
                    <SmartCombo 
                        label="التصنيف الرئيسي *" 
                        icon="📁" 
                        options={EXPENSE_CATEGORIES} 
                        initialDisplay={record?.main_category} 
                        onSelect={(val:any) => setRecord({...record, main_category: typeof val === 'object' && val !== null ? val.name : val})} 
                        strict={true} 
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11.25rem, 1fr))', gap: '1.5625rem', background: isSettlement ? 'rgba(16, 185, 129, 0.05)' : '#f8fafc', padding: '1.5625rem', borderRadius: '14px', marginBottom: '1.5625rem', border: isSettlement ? '1px dashed #10b981' : '1px solid #e2e8f0', transition: 'all 0.3s' }}>
                    <div style={{ zIndex: 55, position: 'relative' }}>
                        <SmartCombo 
                            label="طريقة القيد *" 
                            icon="⚙️" 
                            options={PAYMENT_METHODS} 
                            initialDisplay={record?.payment_method || 'آجل'} 
                            onSelect={(val:any) => {
                                const method = typeof val === 'object' && val !== null ? val.name : val;
                                setRecord((prev: any) => ({
                                    ...prev,
                                    payment_method: method,
                                    custody_id: method === 'عهدة' ? prev?.custody_id : null,
                                    payment_account: method === 'عهدة' ? '125 - عُهد الموظفين والمواقع' : prev?.payment_account,
                                }));
                            }} 
                            strict={true} 
                        />
                    </div>
                    <div style={{ zIndex: 50, position: 'relative' }}>
                        <SmartCombo 
                            label="حساب المصروف (المدين) *" 
                            icon="📂" 
                            table="accounts" 
                            displayCol="name" 
                            initialDisplay={record?.creditor_account} 
                            onSelect={(val:any) => setRecord({...record, creditor_account: typeof val === 'object' && val !== null ? val.name : val})} 
                            strict={true} 
                        />
                    </div>
                    {isCustody ? (
                        <div style={{ zIndex: 45, position: 'relative' }}>
                            <SmartCombo 
                                label="العهدة المفتوحة المرتبطة *" 
                                icon="💼" 
                                table="site_custodies" 
                                customFilter="status=eq.open"
                                searchCols="custody_number,title"
                                displayCol="title"
                                value={record?.custody_id || null}
                                displayFormat={(item: any) => `${item.custody_number || ''} - ${item.title || ''}`}
                                onSelect={(val: any) => {
                                    if (val && typeof val === 'object') {
                                        setRecord((prev: any) => ({
                                            ...prev,
                                            custody_id: val.id,
                                            payment_account: '125 - عُهد الموظفين والمواقع',
                                            project_id: prev?.project_id || val.project_id || null,
                                        }));
                                    } else {
                                        setRecord((prev: any) => ({ ...prev, custody_id: null }));
                                    }
                                }}
                                strict={true}
                            />
                        </div>
                    ) : (
                        <div style={{ zIndex: 45, position: 'relative' }}>
                            <SmartCombo 
                                label={isSettlement ? "حساب الإيراد / التسوية (الدائن) *" : "الحساب الدائن *"} 
                                icon={isSettlement ? "📈" : "🤝"} 
                                table="accounts" 
                                displayCol="name" 
                                initialDisplay={record?.payment_account} 
                                onSelect={(val:any) => setRecord({...record, payment_account: typeof val === 'object' && val !== null ? val.name : val})} 
                                strict={true} 
                            />
                        </div>
                    )}
                </div>
                
                <div style={{ background: 'rgba(202, 138, 4, 0.05)', padding: '1.25rem', borderRadius: '14px', marginBottom: '1.5625rem', border: `1px dashed ${THEME.accent}` }}>
                    <h3 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 900, color: THEME.brand.coffee, marginBottom: '0.9375rem' }}>إضافة بنود المصروف</h3>
                    <div className="responsive-line-entry-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.5fr', gap: '0.9375rem', alignItems: 'end' }}>
                        <div style={{ zIndex: 40 }}>
                            <SmartCombo label="البيان / الصنف *" icon="🛠️" freeText={true} initialDisplay={record.description} onSelect={(val: any) => setRecord({...record, description: typeof val === 'object' && val !== null ? val.name : val})} options={historicalData?.descriptions || []} />
                        </div>
                        <div>
                            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: THEME.primary }}>الكمية *</label>
                            <input type="number" value={record.quantity || ''} onChange={e => setRecord({...record, quantity: e.target.value})} className="glass-input-field" style={{ textAlign: 'center' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: THEME.primary }}>سعر الوحدة *</label>
                            <input type="number" value={record.unit_price || ''} onChange={e => setRecord({...record, unit_price: e.target.value})} className="glass-input-field" style={{ textAlign: 'center' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: THEME.primary }}>قيمة الضريبة</label>
                            <input type="number" value={record.vat_amount || ''} onChange={e => setRecord({...record, vat_amount: e.target.value})} className="glass-input-field" style={{ textAlign: 'center' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: THEME.ruby }}>الخصم (-)</label>
                            <input type="number" value={record.discount_amount || ''} onChange={e => setRecord({...record, discount_amount: e.target.value})} className="glass-input-field" style={{ border: `1px solid ${THEME.ruby}50`, color: THEME.ruby, textAlign: 'center' }}/>
                        </div>
                        <button onClick={handleAddStatement} style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', height: '2.8125rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 900, fontSize: 'var(--fs-xl)', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' }}><Plus size={15} aria-hidden="true" /></button>
                    </div>

                    {safeAddedLines.length > 0 && (
                        <div className="lines-table-container">
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                                <thead style={{ background: THEME.primary, color: 'white' }}>
                                    <tr>
                                        <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)', textAlign: 'right' }}>البيان</th>
                                        <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)' }}>الكمية</th>
                                        <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)' }}>السعر</th>
                                        <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)' }}>الضريبة</th>
                                        <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)' }}>الخصم</th>
                                        <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)' }}>الإجمالي</th>
                                        <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)' }}>حذف</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {safeAddedLines.map((line: any, idx: number) => (
                                        <tr key={idx} className="item-row">
                                            <td style={{ padding: '0.75rem', fontWeight: 700, color: '#1e293b', textAlign: 'right' }}>{line.description || line.item_name}</td>
                                            <td style={{ padding: '0.75rem', fontWeight: 800 }}>{line.quantity}</td>
                                            <td style={{ padding: '0.75rem', fontWeight: 700 }}>{formatCurrency(line.unit_price)}</td>
                                            <td style={{ padding: '0.75rem', fontWeight: 700 }}>{formatCurrency(line.vat_amount)}</td>
                                            <td style={{ padding: '0.75rem', fontWeight: 700, color: THEME.ruby }}>{formatCurrency(line.discount_amount)}</td>
                                            <td style={{ padding: '0.75rem', fontWeight: 900, color: THEME.primary }}>{formatCurrency(line.total_price)}</td>
                                            <td style={{ padding: '0.75rem' }}><button onClick={() => handleRemoveLine(idx)} style={{ background: 'none', border: 'none', color: THEME.ruby, cursor: 'pointer', fontSize: 'var(--fs-lg)' }}><Trash2 size={14} aria-hidden="true" /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: '1.5625rem' }}>
                    <TelegramAttachmentField
                        module={isCustody ? 'custodies' : 'expenses'}
                        allowOfflineStage={true}
                        label="صورة الفاتورة أو المستند المرفق (Telegram Bot)"
                        value={record?.invoice_image || null}
                        onChange={(url) => setRecord((prev: any) => ({ ...prev, invoice_image: url }))}
                        stagedAttachment={record?._stagedAttachment || null}
                        onStagedChange={(att) => setRecord((prev: any) => ({ ...prev, _stagedAttachment: att }))}
                        caption={record?.description || record?.main_category || 'مصروف'}
                    />
                </div>

                <div className="responsive-summary-grid" style={{ marginTop: '1.875rem', padding: '1.5625rem', background: 'linear-gradient(135deg, #1e293b, #0f172a)', borderRadius: '14px', color: 'white', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9.375rem, 1fr))', gap: '1.25rem', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.9375rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', fontWeight: 800 }}>إجمالي الأعمال</div>
                        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900 }}>{formatCurrency(finalSubtotal)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.9375rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', fontWeight: 800 }}>إجمالي الضريبة</div>
                        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900 }}>{formatCurrency(finalVat)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.9375rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', fontWeight: 800 }}>إجمالي الخصم</div>
                        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: THEME.ruby }}>{formatCurrency(finalDiscount)}</div>
                    </div>
                    <div style={{ background: `linear-gradient(135deg, ${THEME.accent}40, transparent)`, padding: '0.9375rem', borderRadius: '16px', border: `1px solid ${THEME.accent}80`, boxShadow: `0 0 20px ${THEME.accent}20` }}>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.accentLight }}>الصافي المستحق</div>
                        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{formatCurrency(finalTotal)}</div>
                    </div>
                </div>

                <div className="responsive-actions" style={{ display: 'flex', gap: '1.25rem', marginTop: '2.1875rem' }}>
                    <button id="expense-save-button" onClick={handleValidateAndSave} disabled={isSaving} className="btn-glass-save" style={{ flex: 2 }}>
                        {isSaving ? 'جاري الحفظ...' : 'حفظ مسودة المصروف'}
                    </button>
                    <button onClick={onClose} className="btn-glass-cancel" style={{ flex: 1 }}>إغلاق وإلغاء</button>
                </div>
            </div>
        </div>,
        document.body
    );
}
