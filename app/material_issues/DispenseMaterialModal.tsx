"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import SmartCombo from '@/components/SmartCombo';
// 🚀 استدعاء الكمبوننت الذكي المخصص لأوامر الشغل وبنود المشروع
import ProjectBoqCombo from '@/components/ProjectBoqCombo';
import { formatCurrency } from '@/lib/helpers';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notify';
import { X } from 'lucide-react';

// 🚀 الثوابت المحاسبية (الـ UUIDs الخاصة بشجرة الحسابات)
const ACCOUNT_INVENTORY = '4f828d0d-a1f4-4762-83e3-c17dafae802d'; // حساب الخامات والمخزون (دائن)
const ACCOUNT_CONTRACTOR = '27f37adf-c0ec-4b40-80d0-2b36b853fd4b'; // التزام مقاولي الباطن (مدين للمقاول)
const ACCOUNT_COMPANY_COST = 'ضع_اي_دي_حساب_تكلفة_الخامات_هنا'; // ⚠️ ضع هنا آي دي حساب (تكلفة مواد بناء / خامات) للمشاريع

export default function DispenseMaterialModal({ isOpen, onClose, invoiceItem, onSave, isSaving }: any) {
    const [mounted, setMounted] = useState(false);

    // 🎯 حالات جديدة لجلب الرصيد الحي من المخزن
    const [realAvailableQty, setRealAvailableQty] = useState<number>(0);
    const [isFetchingQty, setIsFetchingQty] = useState(true);

    const [formData, setFormData] = useState({
        issue_date: new Date().toISOString().split('T')[0],
        project_id: '',
        job_order_id: '',
        project_name: '',
        issue_type: 'استهلاك مباشر',
        subcontractor_id: '',
        subcontractor_name: '',
        quantity: 0,
        notes: '',
        boq_id: null,
        boq_item_id: null,
        boq_item_name: '',
        debit_account_id: ACCOUNT_COMPANY_COST,
        credit_account_id: ACCOUNT_INVENTORY,
    });

    useEffect(() => {
        setMounted(true);
        if (invoiceItem) {
            setFormData((prev) => ({
                ...prev,
                // مبدئياً نحط 1 لحد ما الرصيد الحقيقي ييجي من الداتابيز
                quantity: 1,
                project_id: invoiceItem.project_id || '',
                project_name: invoiceItem.project?.Property || '',
                boq_id: invoiceItem.boq_id || null,
                boq_item_id: invoiceItem.boq_item_id || null,
                boq_item_name: invoiceItem.boq_item || '',
            }));
        }
    }, [invoiceItem]);

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

    // 🚀 جلب الرصيد الفعلي اللحظي من vw_inventory_balances_v2
    useEffect(() => {
        const fetchRealBalance = async () => {
            if (!isOpen || !invoiceItem) return;

            // تحديد الـ ID بتاع الخامة (سواء جاي باسم item_id أو id حسب الأوبجكت بتاعك)
            const itemId = invoiceItem.item_id || invoiceItem.id;

            if (!itemId) {
                setRealAvailableQty(invoiceItem.available_qty || 0);
                setIsFetchingQty(false);
                return;
            }

            setIsFetchingQty(true);
            try {
                const { data, error } = await supabase
                    .from('vw_inventory_balances_v2')
                    .select('available_quantity')
                    .eq('item_id', itemId)
                    .maybeSingle();

                if (data && !error) {
                    setRealAvailableQty(Number(data.available_quantity) || 0);
                } else {
                    setRealAvailableQty(invoiceItem.available_qty || 0);
                }
            } catch (err) {
                console.error('Error fetching balance:', err);
                setRealAvailableQty(invoiceItem.available_qty || 0);
            } finally {
                setIsFetchingQty(false);
            }
        };

        fetchRealBalance();
    }, [isOpen, invoiceItem]);

    // 🎯 المراقبة الذكية للتوجيه المحاسبي
    useEffect(() => {
        const isContractor = formData.issue_type === 'صرف لمقاول';
        setFormData((prev) => ({
            ...prev,
            debit_account_id: isContractor ? ACCOUNT_CONTRACTOR : ACCOUNT_COMPANY_COST,
            credit_account_id: ACCOUNT_INVENTORY,
        }));
    }, [formData.issue_type]);

    if (!isOpen || !mounted || !invoiceItem) return null;

    const totalPrice = (Number(formData.quantity) || 0) * (Number(invoiceItem.unit_price) || 0);
    const isQtyExceeded = formData.quantity > realAvailableQty;

    const handleSubmit = () => {
        if (!formData.project_id) return notify('يرجى اختيار الفيلا/المشروع العقاري');
        if (formData.issue_type === 'صرف لمقاول' && !formData.subcontractor_id) return notify('يرجى اختيار المقاول المستلم');

        // 🚀 الفالديشن بقى على الرصيد الفعلي المجلوب من الفيو
        if (formData.quantity <= 0 || formData.quantity > realAvailableQty) {
            return notify(`كمية الصرف غير صحيحة أو تتجاوز الرصيد المتاح حالياً بالمخزن (${realAvailableQty})`);
        }

        const finalData = {
            ...formData,
            boq_id: formData.boq_id || null,
            boq_item_id: formData.boq_item_id || null,
            job_order_id: formData.job_order_id || null,
            item: invoiceItem,
        };

        onSave(finalData);
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
            <style>{`
                .dispense-input {
                    width: 100%;
                    padding: 0.65rem 0.85rem;
                    border-radius: 12px;
                    background: var(--surface-sunken);
                    border: 1px solid var(--control-edge, rgba(148, 163, 184, 0.16));
                    box-shadow: var(--shadow-sunken);
                    outline: none;
                    transition: 0.2s;
                    font-weight: 700;
                    font-size: var(--fs-sm);
                    color: var(--text-primary);
                    color-scheme: var(--native-color-scheme);
                }
                .dispense-input:focus {
                    border-color: var(--accent-main, #f97316);
                    box-shadow: var(--shadow-sunken), 0 0 0 2px var(--accent-glow);
                }
                .dispense-label {
                    font-size: var(--fs-xs);
                    font-weight: 800;
                    color: var(--text-secondary);
                    display: block;
                    margin-bottom: 0.4rem;
                }
                .dispense-btn-primary {
                    background: var(--action-fill);
                    color: var(--action-ink);
                    border: none;
                    padding: 0.85rem 1.25rem;
                    border-radius: 14px;
                    font-weight: 900;
                    font-size: var(--fs-md);
                    cursor: pointer;
                    transition: 0.2s;
                    box-shadow: 0 8px 24px -6px var(--accent-glow);
                }
                .dispense-btn-primary:hover:not(:disabled) {
                    filter: brightness(1.08);
                    transform: translateY(-1px);
                }
                .dispense-btn-primary:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .dispense-btn-secondary {
                    padding: 0.85rem 1.25rem;
                    background: var(--surface-subcard);
                    color: var(--text-secondary);
                    border: 1px solid var(--control-edge, rgba(148, 163, 184, 0.16));
                    border-radius: 14px;
                    font-weight: 800;
                    font-size: var(--fs-md);
                    cursor: pointer;
                    transition: 0.2s;
                }
                .dispense-btn-secondary:hover:not(:disabled) {
                    background: var(--surface-card-hover);
                    color: var(--text-primary);
                }
            `}</style>

            <div
                className="phi-modal-panel cinematic-scroll"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                style={{
                    position: 'relative',
                    width: 'min(46rem, 100%)',
                    maxHeight: 'calc(100dvh - 3rem)',
                    background: 'var(--surface-card)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--phi-radius-dialog, 20px)',
                    padding: '1.75rem',
                    boxShadow: 'var(--shadow-ambient)',
                    border: '1px solid var(--control-edge, rgba(255, 255, 255, 0.08))',
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
                        marginBottom: '1.25rem',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
                        paddingBottom: '1rem',
                    }}
                >
                    <div>
                        <h2 style={{ color: 'var(--text-primary)', fontWeight: 900, margin: 0, fontSize: 'var(--fs-2xl)' }}>
                            صرف مباشر للموقع
                        </h2>
                        <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                            توجيه كمية الخامة من المخزون إلى المشروع أو كعهدة على مقاول
                        </p>
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

                {/* بطاقة ملخص الخامة */}
                <div
                    style={{
                        background: 'var(--surface-subcard)',
                        padding: '1rem 1.15rem',
                        borderRadius: '16px',
                        marginBottom: '1.25rem',
                        border: '1px solid rgba(148, 163, 184, 0.14)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                        flexWrap: 'wrap',
                    }}
                >
                    <div>
                        <div style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: 'var(--fs-lg)' }}>
                            {invoiceItem?.item_name || invoiceItem?.work_item}
                        </div>
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 800 }}>
                            المتاح للصرف:{' '}
                            {isFetchingQty ? (
                                <span style={{ color: 'var(--accent-ink)' }}>جاري حساب الرصيد...</span>
                            ) : (
                                <span style={{ color: realAvailableQty > 0 ? 'var(--status-positive, #10b981)' : 'var(--status-negative, #f43f5e)' }}>
                                    {realAvailableQty} {invoiceItem?.unit}
                                </span>
                            )}
                        </div>
                    </div>
                    <div style={{ textAlign: 'left', background: 'var(--accent-soft-bg)', padding: '0.45rem 0.9rem', borderRadius: '12px' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 800 }}>سعر الوحدة</div>
                        <div style={{ fontWeight: 900, color: 'var(--accent-ink)', fontSize: 'var(--fs-md)', fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(invoiceItem?.unit_price)}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ zIndex: 100, position: 'relative' }}>
                        <SmartCombo
                            label="المشروع المستفيد *"
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
                                    boq_id: null,
                                    boq_item_id: null,
                                    boq_item_name: '',
                                })
                            }
                        />
                    </div>
                    <div style={{ zIndex: 90, position: 'relative' }}>
                        <SmartCombo
                            label="أمر الشغل (ربط الميزانية) *"
                            table="job_orders"
                            displayCol="order_number"
                            searchCols="order_number,notes"
                            freeText={false}
                            strict={true}
                            filterColumn="project_id"
                            filterValue={formData.project_id}
                            customQuery={(q: any) => q.select('*, boq_budget:boq_budget_id(work_item)')}
                            displayFormat={(item: any) => `${item.order_number} - ${item.boq_budget?.work_item || 'بدون بند'}`}
                            key={formData.project_id || 'empty-jo'}
                            initialDisplay={formData.job_order_id ? `أمر شغل مرتبط` : ''}
                            onSelect={async (v: any) => {
                                const updates: any = { job_order_id: v?.id || null };

                                if (v?.boq_budget_id) {
                                    const { data } = await supabase
                                        .from('boq_budget_distinct')
                                        .select('*')
                                        .eq('id', v.boq_budget_id)
                                        .single();

                                    if (data) {
                                        updates.boq_id = data.id;
                                        updates.boq_item_id = data.boq_item_id;
                                        updates.boq_item_name = data.work_item;
                                    }
                                }

                                setFormData({ ...formData, ...updates });
                            }}
                        />
                    </div>
                    <div style={{ zIndex: 85, position: 'relative' }}>
                        <label className="dispense-label">تحميل على بند (BOQ)</label>
                        <ProjectBoqCombo
                            projectId={formData.project_id}
                            value={formData.boq_item_id || formData.boq_id}
                            initialDisplay={formData.boq_item_name}
                            onSelect={(selectedBoq: any) => {
                                setFormData({
                                    ...formData,
                                    boq_id: selectedBoq?.id || null,
                                    boq_item_id: selectedBoq?.boq_item_id || null,
                                    boq_item_name: selectedBoq?.display_name || selectedBoq?.work_item || '',
                                });
                            }}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                        <label className="dispense-label">تاريخ الصرف</label>
                        <input
                            type="date"
                            className="dispense-input"
                            value={formData.issue_date}
                            onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="dispense-label">الكمية المراد صرفها</label>
                        <input
                            type="number"
                            max={realAvailableQty}
                            min="0.1"
                            step="0.1"
                            className="dispense-input"
                            style={{
                                borderColor: isQtyExceeded ? 'var(--status-negative, #f43f5e)' : undefined,
                            }}
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                        />
                    </div>
                </div>

                {/* التوجيه المحاسبي */}
                <div
                    style={{
                        background: 'var(--surface-subcard)',
                        padding: '1rem 1.15rem',
                        borderRadius: '16px',
                        marginBottom: '1.25rem',
                        border: '1px solid rgba(148, 163, 184, 0.14)',
                    }}
                >
                    <label className="dispense-label" style={{ marginBottom: '0.75rem' }}>
                        التوجيه المحاسبي (جهة التحميل) *
                    </label>
                    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: formData.issue_type === 'صرف لمقاول' ? '0.9rem' : '0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 800, fontSize: 'var(--fs-sm)', color: 'var(--text-primary)' }}>
                            <input
                                type="radio"
                                checked={formData.issue_type === 'استهلاك مباشر'}
                                onChange={() => setFormData({ ...formData, issue_type: 'استهلاك مباشر', subcontractor_id: '' })}
                                style={{ accentColor: 'var(--accent-main, #f97316)', transform: 'scale(1.15)' }}
                            />
                            استهلاك للشركة (تكلفة مشروع)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 800, fontSize: 'var(--fs-sm)', color: 'var(--status-negative, #f43f5e)' }}>
                            <input
                                type="radio"
                                checked={formData.issue_type === 'صرف لمقاول'}
                                onChange={() => setFormData({ ...formData, issue_type: 'صرف لمقاول' })}
                                style={{ accentColor: 'var(--status-negative, #f43f5e)', transform: 'scale(1.15)' }}
                            />
                            تحميل كسلفة على مقاول
                        </label>
                    </div>

                    <div style={{ zIndex: 80, position: 'relative' }}>
                        {formData.issue_type === 'صرف لمقاول' ? (
                            <SmartCombo
                                label="اختر المقاول المراد الخصم منه *"
                                icon="👷"
                                table="partners"
                                displayCol="name"
                                searchCols="name"
                                customFilter="partner_type=eq.مقاول"
                                value={formData.subcontractor_id}
                                initialDisplay={formData.subcontractor_name}
                                onSelect={(v: any) =>
                                    setFormData({
                                        ...formData,
                                        subcontractor_id: v?.id || '',
                                        subcontractor_name: v?.name || '',
                                    })
                                }
                            />
                        ) : (
                            <div
                                style={{
                                    marginTop: '0.75rem',
                                    background: 'rgba(16, 185, 129, 0.12)',
                                    color: 'var(--status-positive, #10b981)',
                                    padding: '0.7rem 0.9rem',
                                    borderRadius: '12px',
                                    textAlign: 'center',
                                    fontWeight: 800,
                                    fontSize: 'var(--fs-sm)',
                                }}
                            >
                                سيتم تحميل التكلفة مباشرة على حساب تكلفة المشروع
                            </div>
                        )}
                    </div>
                </div>

                {/* إجمالي قيمة الصرف */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--accent-soft-bg)',
                        padding: '0.95rem 1.25rem',
                        borderRadius: '16px',
                        marginBottom: '1.25rem',
                    }}
                >
                    <div style={{ fontSize: 'var(--fs-md)', fontWeight: 900, color: 'var(--text-primary)' }}>إجمالي قيمة الصرف:</div>
                    <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: 'var(--accent-ink)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(totalPrice)}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.85rem' }}>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSaving || isFetchingQty}
                        className="dispense-btn-primary"
                        style={{ flex: 2 }}
                    >
                        {isSaving ? 'جاري الصرف والترحيل...' : 'تأكيد الصرف والترحيل'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="dispense-btn-secondary"
                        style={{ flex: 1 }}
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
