"use client";
import { currencySymbol } from '@/lib/currency';
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';
import SmartCombo from '@/components/SmartCombo';
import { notify } from '@/lib/notify';
import { Users, HardHat, Calendar, DollarSign } from 'lucide-react';

// دالة تنسيق المبالغ بأرقام إنجليزية ولاتينية واضحة
const formatMoneyEn = (val: number | string | null | undefined): string => {
    const n = Number(val || 0);
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currencySymbol();
};

const formatNumberEn = (val: number | string | null | undefined): string => {
    const n = Number(val || 0);
    return n.toLocaleString('en-US');
};

export default function BoqFormModal({ isOpen, onClose, record, setRecord, onSave, projectBoq = [], onImport, isSaving }: any) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    // ⏳ حساب مدة التنفيذ أوتوماتيكياً بالأيام (بالأرقام الإنجليزية)
    const durationDays = useMemo(() => {
        if (record.start_date && record.end_date) {
            const start = new Date(record.start_date);
            const end = new Date(record.end_date);
            const diffTime = end.getTime() - start.getTime();
            if (diffTime < 0) return 0;
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }
        return 0;
    }, [record.start_date, record.end_date]);

    // 👷 حسابات العمالة التقديرية التفصيلية (فنيين ومساعدين بأيام مستقلة لكل فئة)
    const techCount = Number(record.tech_count || 0);
    const techWage = Number(record.tech_daily_wage || 0);
    const helperCount = Number(record.helper_count || 0);
    const helperWage = Number(record.helper_daily_wage || 0);

    const totalTechDaily = techCount * techWage; // إجمالي يومية الفنيين لليوم الواحد
    const totalHelperDaily = helperCount * helperWage; // إجمالي يومية المساعدين لليوم الواحد
    const totalDailyLabor = totalTechDaily + totalHelperDaily; // إجمالي اليومية للعمالة

    // عدد أيام العمل لكل فئة (تأخذ أيام الفئة أو أيام العمل العامة أو مدة التنفيذ افتراضياً)
    const effectiveDays = Number(record.labor_days || (durationDays > 0 ? durationDays : 0));
    const effectiveTechDays = Number(record.tech_days ?? record.labor_days ?? (durationDays > 0 ? durationDays : 0));
    const effectiveHelperDays = Number(record.helper_days ?? record.labor_days ?? (durationDays > 0 ? durationDays : 0));

    const totalTechBudget = totalTechDaily * (effectiveTechDays > 0 ? effectiveTechDays : (techCount > 0 ? 1 : 0));
    const totalHelperBudget = totalHelperDaily * (effectiveHelperDays > 0 ? effectiveHelperDays : (helperCount > 0 ? 1 : 0));

    // 🤝 حسابات عقود مقاولي الباطن
    const rebarSubcontractor = Number(record.subcontractor_rebar_cost || 0);
    const concreteSubcontractor = Number(record.subcontractor_concrete_cost || 0);
    const otherSubcontractor = Number(record.subcontractor_other_cost || 0);
    const totalSubcontractors = rebarSubcontractor + concreteSubcontractor + otherSubcontractor;

    // 💰 حسابات الميزانية الإجمالية والأرباح اللحظية
    const contractQty = Number(record.contract_quantity || 0);
    const unitPrice = Number(record.unit_contract_price || 0);
    const totalContractAmount = contractQty * unitPrice;

    const retentionPercent = Number(record.retention_percentage ?? 0);
    const retentionAmount = totalContractAmount * (retentionPercent / 100);

    const laborCost = Number(record.estimated_labor_cost || 0);
    const materialCost = Number(record.estimated_material_cost || 0);
    const expensesCost = Number(record.estimated_expenses_cost || 0);
    const totalEstimatedBudget = laborCost + totalSubcontractors + materialCost + expensesCost;

    const expectedProfit = totalContractAmount - totalEstimatedBudget;
    const profitMargin = totalContractAmount > 0 ? ((expectedProfit / totalContractAmount) * 100).toFixed(1) : "0.0";
    const isLoss = expectedProfit < 0;

    // دوال التحديث التلقائي للعمالة ومقاولي الباطن
    const handleLaborChange = (updates: any) => {
        const next = { ...record, ...updates };
        if (updates.labor_days !== undefined) {
            if (!record.tech_days) next.tech_days = updates.labor_days;
            if (!record.helper_days) next.helper_days = updates.labor_days;
        }
        const tc = Number(next.tech_count || 0);
        const tw = Number(next.tech_daily_wage || 0);
        const hc = Number(next.helper_count || 0);
        const hw = Number(next.helper_daily_wage || 0);
        const fallbackDays = Number(next.labor_days || (durationDays > 0 ? durationDays : 1));
        const tDays = Number(next.tech_days ?? fallbackDays);
        const hDays = Number(next.helper_days ?? fallbackDays);

        const techSubtotal = (tc * tw) * (tDays > 0 ? tDays : 1);
        const helperSubtotal = (hc * hw) * (hDays > 0 ? hDays : 1);

        if ((tc * tw) + (hc * hw) > 0) {
            next.estimated_labor_cost = techSubtotal + helperSubtotal;
        }
        setRecord(next);
    };

    const handleSubcontractorChange = (updates: any) => {
        const next = { ...record, ...updates };
        const reb = Number(next.subcontractor_rebar_cost || 0);
        const conc = Number(next.subcontractor_concrete_cost || 0);
        const oth = Number(next.subcontractor_other_cost || 0);
        next.estimated_subcontractor_cost = reb + conc + oth;
        setRecord(next);
    };

    if (!isOpen || !mounted) return null;

    const handleSave = () => {
        if (!record.work_item) {
            return notify("يرجى اختيار أو كتابة اسم البند / المرحلة أولاً.");
        }
        if (record.start_date && record.end_date && new Date(record.start_date) > new Date(record.end_date)) {
            return notify("تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية!");
        }

        // التأكد من حفظ المجاميع المحسوبة وأيام الفنيين والمساعدين
        const finalRecord = {
            ...record,
            tech_days: Number(record.tech_days ?? effectiveTechDays ?? 0),
            helper_days: Number(record.helper_days ?? effectiveHelperDays ?? 0),
            labor_days: Number(record.labor_days || Math.max(effectiveTechDays, effectiveHelperDays) || 0),
            retention_percentage: Number(record.retention_percentage ?? 0),
            estimated_subcontractor_cost: totalSubcontractors,
            estimated_labor_cost: Number(record.estimated_labor_cost || (totalTechBudget + totalHelperBudget) || 0)
        };

        onSave(finalRecord);
    };

    // ستايل موحد لجميع خانات الأرقام لضمان ظهورها بالإنجليزي
    const numInputStyle: React.CSSProperties = {
        direction: 'ltr',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        fontVariantNumeric: 'tabular-nums',
        textAlign: 'center',
        fontWeight: 900
    };

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30, 20, 10, 0.85)', backdropFilter: 'blur(15px)', direction: 'rtl', padding: '1rem' }}>
            <div style={{ position: 'fixed', inset: 0 }} onClick={onClose} />
            <div className="cinematic-scroll" style={{ background: '#ffffff', borderRadius: '18px', width: '100%', maxWidth: '62rem', maxHeight: '92vh', overflowY: 'auto', padding: '2rem', position: 'relative', zIndex: 10, boxShadow: '0 40px 80px rgba(0,0,0,0.4)', border: '1px solid #e2e8f0' }}>
                
                {/* رأس المودال */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                        <h2 style={{ margin: 0, fontWeight: 900, color: THEME.coffeeDark, fontSize: 'var(--fs-xl)' }}>
                            {record.id ? 'تعديل موازنة البند المقيد' : 'إدراج بند هندسي وربط الموازنة التقديرية (WBS)'}
                        </h2>
                        <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 700 }}>
                            تحديد الكميات وسعر البيع والميزانيات التقديرية (عمالة، مقاولي باطن، خامات، ومصاريف)
                        </span>
                    </div>
                    {record.item_type && (
                        <span style={{ backgroundColor: record.item_type === 'رئيسي' ? THEME.coffeeDark : THEME.primary, color: 'white', padding: '0.25rem 0.75rem', borderRadius: '8px', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>
                            {record.item_type === 'رئيسي' ? 'مرحلة رئيسية' : 'بند فرعي تنفيذي'}
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    {/* 1️⃣ السحب الذكي الموحد من شجرة أدلة المقاييس */}
                    <div style={{ zIndex: 90, position: 'relative', background: '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <SmartCombo 
                            label="ابحث عن اسم البند الهندسي (من دليل الشجرة الموحد)" 
                            table="boq_items" 
                            searchCols="item_name,item_code,main_category,sub_category"
                            displayCol="item_name" 
                            orderCol="item_code"
                            initialDisplay={record.work_item}
                            freeText={true} 
                            enableClear={true}
                            onSelect={(b: any) => {
                                const isObj = typeof b === 'object' && b !== null;
                                let suggestedParentId = record.parent_id;
                                if (isObj && projectBoq?.length) {
                                    const existingPhase = projectBoq.find((item: any) => 
                                        item.item_type === 'رئيسي' && (item.work_item === b.main_category || item.main_category === b.main_category)
                                    );
                                    if (existingPhase) suggestedParentId = existingPhase.id;
                                }

                                setRecord({
                                    ...record, 
                                    boq_item_id: isObj ? b.id : null,
                                    work_item: isObj ? b.item_name : (b || ''), 
                                    item_type: isObj ? 'فرعي' : (record.item_type || 'رئيسي'), 
                                    parent_id: suggestedParentId, 
                                    main_category: isObj ? (b.main_category || 'بند عام') : (record.main_category || 'بند عام'),
                                    sub_category: isObj ? (b.sub_category || 'مرحلة عامة') : (record.sub_category || 'مرحلة عامة'),
                                    unit: isObj && b.unit_of_measure ? b.unit_of_measure : (record.unit || 'مقطوعية'),
                                    unit_contract_price: isObj && b.default_unit_price != null ? Number(b.default_unit_price) : (record.unit_contract_price ?? 0),
                                    estimated_labor_cost: isObj && b.default_labor_price != null ? Number(b.default_labor_price) : (record.estimated_labor_cost ?? 0),
                                    estimated_material_cost: isObj && b.default_material_price != null ? Number(b.default_material_price) : (record.estimated_material_cost ?? 0),
                                    contract_quantity: record.contract_quantity && Number(record.contract_quantity) > 0 ? record.contract_quantity : 1,
                                    retention_percentage: record.retention_percentage != null ? Number(record.retention_percentage) : 0
                                });
                            }} 
                        />
                        
                        {/* مسار شجرة التصنيف الكودية */}
                        {record.work_item && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', fontSize: 'var(--fs-xs)', fontWeight: 800, flexWrap: 'wrap' }}>
                                <span style={{ background: THEME.coffeeDark, color: 'white', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>{record.main_category || 'بند عام'}</span>
                                <span style={{ color: '#cbd5e1' }}>◀</span>
                                <span style={{ background: 'white', color: THEME.coffeeMain, padding: '0.2rem 0.5rem', borderRadius: '6px', border: `1px solid ${THEME.sandDark}` }}>{record.sub_category || 'مرحلة عامة'}</span>
                                <span style={{ color: '#cbd5e1' }}>◀</span>
                                <span style={{ color: THEME.success, fontWeight: 900 }}>{record.work_item}</span>
                            </div>
                        )}
                    </div>

                    {/* 2️⃣ الجدول الزمني للتنفيذ والمدد الزمنية */}
                    <div style={{ background: '#f0fdf4', padding: '1rem 1.25rem', borderRadius: '14px', border: '1px solid #bbf7d0', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: 'var(--fs-sm)', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 900 }}>
                                <Calendar size={16} /> الجدول الزمني للتنفيذ (Time Schedule)
                            </h3>
                            {durationDays > 0 && (
                                <span style={{ background: '#166534', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>
                                    المدة المحسوبة: <span dir="ltr">{durationDays}</span> يوماً
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9375rem' }}>
                            <div>
                                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#14532d', display: 'block', marginBottom: '0.375rem' }}>تاريخ البدء المتوقع</label>
                                <input type="date" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.625rem', borderRadius: '10px', border: `1px solid #86efac`, outline: 'none', color: '#14532d' }} 
                                       value={record.start_date || ''} onChange={e => setRecord({...record, start_date: e.target.value})} />
                            </div>
                            <div>
                                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#14532d', display: 'block', marginBottom: '0.375rem' }}>تاريخ الانتهاء المستهدف</label>
                                <input type="date" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.625rem', borderRadius: '10px', border: `1px solid #86efac`, outline: 'none', color: '#14532d' }} 
                                       value={record.end_date || ''} onChange={e => setRecord({...record, end_date: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    {/* 3️⃣ الكميات التعاقدية وسعر الفئة ونسبة ضمان الأعمال (الديفولت 0) */}
                    <div style={{ background: '#fffbeb', padding: '1.25rem', borderRadius: '14px', border: '1px solid #fde68a' }}>
                        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: 'var(--fs-sm)', color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 900 }}>
                            <DollarSign size={16} /> التعاقد وسعر البيع وضمان الأعمال
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(10.5rem, 1fr))', gap: '0.9375rem' }}>
                            <div>
                                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, display: 'block', marginBottom: '0.375rem' }}>الوحدة الهندسية</label>
                                <input type="text" style={{ width: '100%', padding: '0.625rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 900, textAlign: 'center', background: '#fafafa', outline: 'none' }} 
                                       value={record.unit || ''} onChange={e => setRecord({...record, unit: e.target.value})} placeholder="م3 / م2 / طن" />
                            </div>
                            
                            <div>
                                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, display: 'block', marginBottom: '0.375rem' }}>الكمية التعاقدية</label>
                                <input type="number" step="any" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.625rem', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none' }} 
                                       value={record.contract_quantity || ''} onChange={e => setRecord({...record, contract_quantity: e.target.value})} placeholder="0" />
                            </div>
                            
                            <div>
                                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, display: 'block', marginBottom: '0.375rem', color: THEME.coffeeDark }}>سعر فئة البيع للعميل</label>
                                <input type="number" step="any" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.625rem', borderRadius: '10px', border: `2px solid ${THEME.coffeeDark}`, color: THEME.coffeeDark, outline: 'none' }} 
                                       value={record.unit_contract_price || ''} onChange={e => setRecord({...record, unit_contract_price: e.target.value})} placeholder="0.00" />
                            </div>

                            {/* 🛡️ خانة نسبة ضمان الأعمال الافتراضية 0 */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                                    <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#b45309' }}>نسبة ضمان الأعمال (%)</label>
                                    <span style={{ fontSize: '10px', color: '#92400e', fontWeight: 700 }} dir="ltr">0%</span>
                                </div>
                                <input 
                                    type="number" 
                                    min="0" 
                                    max="100" 
                                    step="0.5" 
                                    dir="ltr"
                                    style={{ ...numInputStyle, width: '100%', padding: '0.625rem', borderRadius: '10px', border: '2px solid #f59e0b', outline: 'none', color: '#b45309', background: '#fff' }} 
                                    value={record.retention_percentage !== undefined && record.retention_percentage !== null ? record.retention_percentage : 0} 
                                    onChange={e => setRecord({...record, retention_percentage: e.target.value})} 
                                    placeholder="0" 
                                />
                                <div style={{ fontSize: '10px', color: '#78350f', marginTop: '3px', fontWeight: 700 }}>
                                    {retentionPercent > 0 ? (
                                        <span>المحتجز: <strong dir="ltr">{formatMoneyEn(retentionAmount)}</strong></span>
                                    ) : (
                                        'بدون احتجاز ضمان أعمال'
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4️⃣ تفصيل ميزانية العمالة (الفنيين والمساعدين واليوميات) */}
                    <div style={{ background: '#f0f9ff', padding: '1.25rem', borderRadius: '14px', border: '1px solid #bae6fd' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: 'var(--fs-sm)', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 900 }}>
                                <Users size={16} /> ميزانية العمالة والتشغيل الذاتي (حاسبة الأطقم واليوميات)
                            </h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <span style={{ background: '#0284c7', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>
                                    إجمالي اليومية: <span dir="ltr">{formatMoneyEn(totalDailyLabor)}</span>
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))', gap: '0.9375rem' }}>
                            {/* باقة الفنيين */}
                            <div style={{ background: '#ffffff', padding: '0.9375rem', borderRadius: '12px', border: '1px solid #e0f2fe' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                                    <strong style={{ fontSize: 'var(--fs-xs)', color: '#0369a1' }}>👷 يومية الفنيين (صنايعية)</strong>
                                    <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 900, background: '#f0f9ff', padding: '2px 6px', borderRadius: '6px' }} dir="ltr">
                                        {formatMoneyEn(totalTechBudget)} ({effectiveTechDays || 0}d)
                                    </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>عدد الفنيين</label>
                                        <input type="number" min="0" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                               value={record.tech_count || ''} onChange={e => handleLaborChange({ tech_count: e.target.value })} placeholder="0" />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: '#0369a1', fontWeight: 800, display: 'block' }}>أيام الفنيين</label>
                                        <input type="number" min="0" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #7dd3fc', background: '#f0f9ff' }}
                                               value={record.tech_days ?? record.labor_days ?? (durationDays > 0 ? durationDays : '')}
                                               onChange={e => handleLaborChange({ tech_days: e.target.value })}
                                               placeholder={durationDays > 0 ? String(durationDays) : "1"} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>اليومية ({currencySymbol()})</label>
                                        <input type="number" min="0" step="any" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                               value={record.tech_daily_wage || ''} onChange={e => handleLaborChange({ tech_daily_wage: e.target.value })} placeholder="0.00" />
                                    </div>
                                </div>
                            </div>

                            {/* باقة المساعدين */}
                            <div style={{ background: '#ffffff', padding: '0.9375rem', borderRadius: '12px', border: '1px solid #e0f2fe' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                                    <strong style={{ fontSize: 'var(--fs-xs)', color: '#0369a1' }}>🤝 يومية المساعدين (عمال)</strong>
                                    <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 900, background: '#f0f9ff', padding: '2px 6px', borderRadius: '6px' }} dir="ltr">
                                        {formatMoneyEn(totalHelperBudget)} ({effectiveHelperDays || 0}d)
                                    </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>عدد المساعدين</label>
                                        <input type="number" min="0" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                               value={record.helper_count || ''} onChange={e => handleLaborChange({ helper_count: e.target.value })} placeholder="0" />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: '#0369a1', fontWeight: 800, display: 'block' }}>أيام المساعدين</label>
                                        <input type="number" min="0" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #7dd3fc', background: '#f0f9ff' }}
                                               value={record.helper_days ?? record.labor_days ?? (durationDays > 0 ? durationDays : '')}
                                               onChange={e => handleLaborChange({ helper_days: e.target.value })}
                                               placeholder={durationDays > 0 ? String(durationDays) : "1"} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, display: 'block' }}>اليومية ({currencySymbol()})</label>
                                        <input type="number" min="0" step="any" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                               value={record.helper_daily_wage || ''} onChange={e => handleLaborChange({ helper_daily_wage: e.target.value })} placeholder="0.00" />
                                    </div>
                                </div>
                            </div>

                            {/* مدة التشغيل وإجمالي ميزانية العمالة */}
                            <div style={{ background: '#ffffff', padding: '0.9375rem', borderRadius: '12px', border: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '0.5rem' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', color: '#0369a1', fontWeight: 800, display: 'block' }}>أيام البند</label>
                                        <input type="number" min="0" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                               value={record.labor_days || (durationDays > 0 ? durationDays : '')} onChange={e => handleLaborChange({ labor_days: e.target.value })} placeholder={durationDays > 0 ? String(durationDays) : "1"} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: '#0369a1', fontWeight: 900, display: 'block' }}>ميزانية العمالة ({currencySymbol()})</label>
                                        <input type="number" step="any" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.5rem', borderRadius: '8px', border: '2px solid #0284c7', color: '#0284c7' }}
                                               value={record.estimated_labor_cost || ''} onChange={e => setRecord({ ...record, estimated_labor_cost: e.target.value })} placeholder="0.00" />
                                    </div>
                                </div>
                                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', textAlign: 'center' }} dir="ltr">
                                    فنيين: {formatNumberEn(totalTechBudget)} ({effectiveTechDays || 0}d) + مساعدين: {formatNumberEn(totalHelperBudget)} ({effectiveHelperDays || 0}d)
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 5️⃣ عقود مقاولي الباطن (حدادة، صب خرسانة، وبنود أخرى) */}
                    <div style={{ background: '#faf5ff', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e9d5ff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: 'var(--fs-sm)', color: '#7e22ce', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 900 }}>
                                <HardHat size={16} /> عقود مقاولي الباطن (Subcontractors Breakdown)
                            </h3>
                            <span style={{ background: '#7e22ce', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>
                                إجمالي عقود الباطن: <span dir="ltr">{formatMoneyEn(totalSubcontractors)}</span>
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '0.9375rem' }}>
                            <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '10px', border: '1px solid #f3e8ff' }}>
                                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#6b21a8', display: 'block', marginBottom: '0.375rem' }}>عقد مقاول حدادة</label>
                                <input type="number" step="any" min="0" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d8b4fe', outline: 'none', color: '#6b21a8' }}
                                       value={record.subcontractor_rebar_cost || ''} onChange={e => handleSubcontractorChange({ subcontractor_rebar_cost: e.target.value })} placeholder="0.00" />
                            </div>

                            <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '10px', border: '1px solid #f3e8ff' }}>
                                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#6b21a8', display: 'block', marginBottom: '0.375rem' }}>عقد مقاول صب خرسانة</label>
                                <input type="number" step="any" min="0" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d8b4fe', outline: 'none', color: '#6b21a8' }}
                                       value={record.subcontractor_concrete_cost || ''} onChange={e => handleSubcontractorChange({ subcontractor_concrete_cost: e.target.value })} placeholder="0.00" />
                            </div>

                            <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '10px', border: '1px solid #f3e8ff' }}>
                                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#6b21a8', display: 'block', marginBottom: '0.375rem' }}>عقود مقاولي بنود أخرى</label>
                                <input type="number" step="any" min="0" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #d8b4fe', outline: 'none', color: '#6b21a8' }}
                                       value={record.subcontractor_other_cost || ''} onChange={e => handleSubcontractorChange({ subcontractor_other_cost: e.target.value })} placeholder="0.00" />
                            </div>
                        </div>
                    </div>

                    {/* 6️⃣ ميزانية المواد والخامات والمصاريف المباشرة */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9375rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                        <div>
                            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: THEME.goldAccent, display: 'block', marginBottom: '0.375rem' }}>ميزانية المواد والخامات (توريدات)</label>
                            <input type="number" step="any" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.625rem', borderRadius: '10px', border: `2px solid ${THEME.goldAccent}60`, outline: 'none', color: THEME.goldAccent }} 
                                   value={record.estimated_material_cost || ''} onChange={e => setRecord({...record, estimated_material_cost: e.target.value})} placeholder="0.00" />
                        </div>
                        <div>
                            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#ea580c', display: 'block', marginBottom: '0.375rem' }}>ميزانية النثريات والمصاريف المباشرة</label>
                            <input type="number" step="any" dir="ltr" style={{ ...numInputStyle, width: '100%', padding: '0.625rem', borderRadius: '10px', border: `2px solid #ea580c60`, outline: 'none', color: '#ea580c' }} 
                                   value={record.estimated_expenses_cost || ''} onChange={e => setRecord({...record, estimated_expenses_cost: e.target.value})} placeholder="0.00" />
                        </div>
                    </div>

                    {/* 7️⃣ شريط الرقابة والتحليل المالي اللحظي للبند (Live Profitability Summary) بأرقام إنجليزية */}
                    <div style={{ 
                        background: isLoss ? '#fef2f2' : '#f0fdf4', 
                        padding: '1rem 1.25rem', 
                        borderRadius: '14px', 
                        border: `2px solid ${isLoss ? '#fca5a5' : '#86efac'}`,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(10.5rem, 1fr))',
                        gap: '0.75rem',
                        alignItems: 'center'
                    }}>
                        <div>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, display: 'block' }}>إجمالي البيع التعاقدي</span>
                            <strong style={{ fontSize: 'var(--fs-md)', color: THEME.coffeeDark, fontWeight: 900 }} dir="ltr">{formatMoneyEn(totalContractAmount)}</strong>
                        </div>

                        <div>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, display: 'block' }}>إجمالي التكلفة المقدرة</span>
                            <strong style={{ fontSize: 'var(--fs-md)', color: '#0f172a', fontWeight: 900 }} dir="ltr">{formatMoneyEn(totalEstimatedBudget)}</strong>
                        </div>

                        <div>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, display: 'block' }}>ضمان الأعمال المحتجز</span>
                            <strong style={{ fontSize: 'var(--fs-md)', color: '#b45309', fontWeight: 900 }} dir="ltr">{formatMoneyEn(retentionAmount)} ({retentionPercent}%)</strong>
                        </div>

                        <div>
                            <span style={{ fontSize: '11px', color: isLoss ? THEME.danger : '#166534', fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}>
                                <span>{isLoss ? 'خسارة متوقعة' : 'صافي ربح متوقع'}</span>
                                <span dir="ltr">{profitMargin}%</span>
                            </span>
                            <strong style={{ fontSize: 'var(--fs-md)', color: isLoss ? THEME.danger : THEME.success, fontWeight: 900 }} dir="ltr">
                                {expectedProfit > 0 ? '+' : ''}{formatMoneyEn(expectedProfit)}
                            </strong>
                        </div>
                    </div>

                </div>

                {/* أزرار التحكم والاعتماد */}
                <div style={{ display: 'flex', gap: '0.9375rem', marginTop: '1.5rem' }}>
                    <button type="button" onClick={handleSave} disabled={isSaving} style={{ flex: 2, background: isSaving ? '#94a3b8' : THEME.coffeeDark, color: 'white', border: 'none', padding: '0.875rem', borderRadius: '14px', fontWeight: 900, cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: 'var(--fs-md)', boxShadow: isSaving ? 'none' : `0 8px 16px rgba(78, 52, 46, 0.25)` }}>
                        {isSaving ? 'جاري الحفظ والتسكين...' : 'اعتماد وحفظ البند والموازنة'}
                    </button>
                    <button type="button" onClick={onClose} disabled={isSaving} style={{ flex: 1, background: '#f1f5f9', color: '#64748b', border: 'none', padding: '0.875rem', borderRadius: '14px', fontWeight: 800, cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: 'var(--fs-md)' }}>إلغاء</button>
                </div>
            </div>
        </div>,
        document.body
    );
}
