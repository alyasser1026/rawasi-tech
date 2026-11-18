"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import SmartCombo from '@/components/SmartCombo';
import JobOrderSelector from '@/components/JobOrderSelector';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/helpers';
import { notify } from '@/lib/notify';
import { X } from 'lucide-react';

export default function BulkDispenseModal({ isOpen, onClose, selectedLines, onSave, isSaving }: any) {
    const [mounted, setMounted] = useState(false);

    const [formData, setFormData] = useState({
        issue_date: new Date().toISOString().split('T')[0],
        project_id: '',
        project_name: '',
        job_order_id: '',
        issue_type: 'استهلاك مباشر',
        subcontractor_id: '',
        subcontractor_name: '',
        items: [] as any[],
    });

    useEffect(() => {
        setMounted(true);
        if (isOpen && selectedLines.length > 0) {
            const firstItem = selectedLines[0];
            setFormData((prev) => ({
                ...prev,
                project_id: firstItem.project_id || '',
                project_name: firstItem.project?.Property || '',
                job_order_id: firstItem.job_order_id || '',
                items: selectedLines.map((line: any) => {
                    const lineQty = Number(line.quantity) || Number(line.available_qty) || 0;
                    const availQty = Number(line.available_qty) || lineQty;
                    const defaultQty = availQty > 0 ? Math.min(lineQty || availQty, availQty) : lineQty;
                    return {
                        ...line,
                        dispense_qty: defaultQty,
                        job_order_id: line.job_order_id || firstItem.job_order_id || null,
                    };
                }),
            }));
        }
    }, [isOpen, selectedLines]);

    // 🚀 مطابقة أمر الشغل تلقائياً من الفيلا وبند الميزانية لو لم يكن محفوظاً مباشرة على الفاتورة
    useEffect(() => {
        let cancelled = false;
        const resolveJobOrder = async () => {
            if (!isOpen || !formData.project_id || formData.job_order_id) return;
            try {
                const { data } = await supabase
                    .from('job_orders')
                    .select('id, boq_budget_id')
                    .eq('project_id', formData.project_id)
                    .order('created_at', { ascending: false });

                if (cancelled || !data || data.length === 0) return;

                const firstBoqId = formData.items?.[0]?.boq_id;
                const matched =
                    (firstBoqId && data.find((jo: any) => jo.boq_budget_id === firstBoqId)) ||
                    data[0];

                if (matched?.id) {
                    setFormData((prev) => (prev.job_order_id ? prev : { ...prev, job_order_id: matched.id }));
                }
            } catch (err) {
                console.error('Error auto-resolving job order:', err);
            }
        };
        resolveJobOrder();
        return () => {
            cancelled = true;
        };
    }, [isOpen, formData.project_id, formData.job_order_id, formData.items]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen || !mounted || selectedLines.length === 0) return null;

    const grandTotal = formData.items.reduce(
        (sum: number, item: any) => sum + (Number(item.dispense_qty) || 0) * (Number(item.unit_price) || 0),
        0
    );

    const handleQtyChange = (id: string, newQty: number) => {
        setFormData((prev) => ({
            ...prev,
            items: prev.items.map((item) => {
                if (item.id === id) {
                    const maxAllowed = Number(item.available_qty) || Number(item.quantity) || 0;
                    const safeQty = Math.max(0, Math.min(newQty, maxAllowed));
                    return { ...item, dispense_qty: safeQty };
                }
                return item;
            }),
        }));
    };

    const handleSubmit = () => {
        if (!formData.project_id) return notify('يرجى اختيار الفيلا/المشروع العقاري');
        if (formData.issue_type === 'صرف لمقاول' && !formData.subcontractor_id) return notify('يرجى اختيار المقاول المستلم');

        const invalidItem = formData.items.find((i) => {
            const maxAllowed = Number(i.available_qty) || Number(i.quantity) || 0;
            return i.dispense_qty <= 0 || i.dispense_qty > maxAllowed;
        });
        if (invalidItem) return notify(`كمية الصرف غير صحيحة للخامة: ${invalidItem.item_name}`);

        onSave(formData);
    };

    return createPortal(
        <div
            className="phi-modal-backdrop"
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000000001,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem 1rem',
                background: 'var(--modal-scrim, rgba(5, 7, 11, 0.78))',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                overflowY: 'auto',
                direction: 'rtl',
            }}
        >
            <div
                className="phi-modal-panel cinematic-scroll"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                style={{
                    width: 'min(58rem, 100%)',
                    maxHeight: 'calc(100dvh - 3rem)',
                    background: 'var(--surface-card)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--phi-radius-dialog, 20px)',
                    padding: '1.75rem',
                    boxShadow: 'var(--shadow-ambient)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    overflowY: 'auto',
                    direction: 'rtl',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                        flexWrap: 'wrap',
                        marginBottom: '1.25rem',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
                        paddingBottom: '1rem',
                    }}
                >
                    <div>
                        <h2 style={{ color: 'var(--text-primary)', fontWeight: 900, margin: 0, fontSize: 'var(--fs-2xl)' }}>
                            صرف مجمع للخامات ({formData.items.length} أصناف)
                        </h2>
                        <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                            تم تحميل نفس الفيلا والكميات وأمر الشغل تلقائياً — يمكنك التأكيد مباشرة أو التعديل
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                        <div style={{ textAlign: 'left', background: 'var(--accent-soft-bg)', padding: '0.45rem 0.9rem', borderRadius: '12px' }}>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 800 }}>الإجمالي الكلي للصرف</div>
                            <div style={{ fontWeight: 900, color: 'var(--accent-ink)', fontSize: 'var(--fs-xl)' }}>{formatCurrency(grandTotal)}</div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="إغلاق"
                            style={{
                                width: '2.5rem',
                                height: '2.5rem',
                                borderRadius: '12px',
                                border: 'none',
                                background: 'var(--surface-subcard)',
                                color: 'var(--text-primary)',
                                display: 'grid',
                                placeItems: 'center',
                                cursor: 'pointer',
                            }}
                        >
                            <X size={18} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: '1.1rem', marginBottom: '1.1rem' }}>
                    <div style={{ zIndex: 100, position: 'relative' }}>
                        <SmartCombo
                            label="المشروع المستفيد من كل الخامات *"
                            icon="🏢"
                            table="projects"
                            displayCol="Property"
                            searchCols="Property"
                            value={formData.project_id}
                            initialDisplay={formData.project_name}
                            onSelect={(v: any) =>
                                setFormData({
                                    ...formData,
                                    project_id: v?.id || '',
                                    project_name: v?.Property || '',
                                    job_order_id: '',
                                })
                            }
                        />
                    </div>
                    <div style={{ zIndex: 95, position: 'relative' }}>
                        <JobOrderSelector
                            label="أمر الشغل (ربط الميزانية)"
                            projectId={formData.project_id || null}
                            value={formData.job_order_id || null}
                            onChange={(id) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    job_order_id: id || '',
                                    items: prev.items.map((item) => ({ ...item, job_order_id: id || null })),
                                }))
                            }
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                            تاريخ الصرف المجمع
                        </label>
                        <input
                            type="date"
                            value={formData.issue_date}
                            onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '0.65rem 0.85rem',
                                borderRadius: '12px',
                                background: 'var(--surface-sunken)',
                                color: 'var(--text-primary)',
                                border: '1px solid rgba(148, 163, 184, 0.16)',
                                boxShadow: 'var(--shadow-sunken)',
                                fontWeight: 700,
                                outline: 'none',
                            }}
                        />
                    </div>
                </div>

                <div style={{ background: 'var(--surface-subcard)', padding: '1rem 1.15rem', borderRadius: '14px', marginBottom: '1.25rem' }}>
                    <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.75rem' }}>
                        التوجيه المحاسبي العام للمجموعة *
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', marginBottom: formData.issue_type === 'صرف لمقاول' ? '0.9rem' : '0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 800, fontSize: 'var(--fs-sm)', color: 'var(--text-primary)' }}>
                            <input
                                type="radio"
                                checked={formData.issue_type === 'استهلاك مباشر'}
                                onChange={() => setFormData({ ...formData, issue_type: 'استهلاك مباشر', subcontractor_id: '' })}
                                style={{ accentColor: 'var(--accent-main)', transform: 'scale(1.15)' }}
                            />
                            استهلاك للشركة (تكلفة مشروع)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 800, fontSize: 'var(--fs-sm)', color: 'var(--status-negative, #fb7185)' }}>
                            <input
                                type="radio"
                                checked={formData.issue_type === 'صرف لمقاول'}
                                onChange={() => setFormData({ ...formData, issue_type: 'صرف لمقاول' })}
                                style={{ accentColor: '#ef4444', transform: 'scale(1.15)' }}
                            />
                            تحميل كسلفة على مقاول
                        </label>
                    </div>
                    <div style={{ zIndex: 80, position: 'relative' }}>
                        {formData.issue_type === 'صرف لمقاول' && (
                            <SmartCombo
                                label="اختر المقاول المراد تحميل جميع الخامات عليه *"
                                icon="👷"
                                table="partners"
                                displayCol="name"
                                searchCols="name"
                                customFilter="partner_type=eq.مقاول"
                                value={formData.subcontractor_id}
                                initialDisplay={formData.subcontractor_name}
                                onSelect={(v: any) => setFormData({ ...formData, subcontractor_id: v?.id || '', subcontractor_name: v?.name || '' })}
                            />
                        )}
                    </div>
                </div>

                {/* جدول الخامات المحددة */}
                <div style={{ background: 'var(--surface-subcard)', borderRadius: '14px', border: '1px solid rgba(148, 163, 184, 0.14)', overflow: 'hidden', marginBottom: '1.25rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                        <thead style={{ background: 'var(--surface-sunken)' }}>
                            <tr>
                                <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 900, textAlign: 'right' }}>الخامة وبند الموازنة</th>
                                <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 900, width: '16%' }}>المتاح بالمخزن</th>
                                <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 900, width: '20%' }}>الكمية للصرف</th>
                                <th style={{ padding: '0.75rem', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 900, width: '16%' }}>إجمالي السطر</th>
                            </tr>
                        </thead>
                        <tbody>
                            {formData.items.map((item: any, idx: number) => (
                                <tr key={idx} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                    <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                                        <div style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }}>{item.work_item || item.item_name}</div>
                                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-ink)', fontWeight: 700, marginTop: '0.2rem' }}>
                                            بند: {item.boq_item || 'بدون توجيه'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                                        {item.available_qty} {item.unit}
                                    </td>
                                    <td style={{ padding: '0.65rem' }}>
                                        <input
                                            type="number"
                                            max={item.available_qty}
                                            min="0.1"
                                            step="0.1"
                                            value={item.dispense_qty}
                                            onChange={(e) => handleQtyChange(item.id, Number(e.target.value))}
                                            style={{
                                                width: '100%',
                                                padding: '0.5rem',
                                                borderRadius: '10px',
                                                textAlign: 'center',
                                                background: 'var(--surface-sunken)',
                                                color: 'var(--text-primary)',
                                                border: `1px solid ${item.dispense_qty > item.available_qty ? '#ef4444' : 'rgba(148, 163, 184, 0.18)'}`,
                                                fontWeight: 800,
                                                outline: 'none',
                                            }}
                                        />
                                    </td>
                                    <td style={{ padding: '0.65rem', fontWeight: 900, color: 'var(--accent-ink)' }}>
                                        {formatCurrency(item.dispense_qty * item.unit_price)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', gap: '0.9rem' }}>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSaving}
                        style={{
                            flex: 2,
                            padding: '0.85rem 1.25rem',
                            borderRadius: '13px',
                            border: 'none',
                            background: 'var(--action-fill)',
                            color: 'var(--action-ink)',
                            fontWeight: 900,
                            fontSize: 'var(--fs-md)',
                            cursor: 'pointer',
                        }}
                    >
                        {isSaving ? 'جاري الصرف المجمع...' : 'تأكيد الصرف لجميع الخامات المحددة'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        style={{
                            flex: 1,
                            padding: '0.85rem 1.25rem',
                            background: 'var(--surface-subcard)',
                            color: 'var(--text-primary)',
                            borderRadius: '13px',
                            fontWeight: 800,
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            cursor: 'pointer',
                        }}
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
