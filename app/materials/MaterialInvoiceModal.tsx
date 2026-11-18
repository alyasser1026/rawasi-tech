"use client";
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import SmartCombo from '@/components/SmartCombo';
import JobOrderSelector from '@/components/JobOrderSelector';
import ProjectBoqCombo from '@/components/ProjectBoqCombo';
import { formatCurrency } from '@/lib/helpers';
import { Trash2, Plus, Upload, Camera, X } from 'lucide-react';
import { notify } from '@/lib/notify';

export default function MaterialInvoiceModal({ isOpen, onClose, logic }: any) {
    const [mounted, setMounted] = useState(false);

    // 📸 حالات ومراجع الكاميرا والمرفقات
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

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

    const startCamera = async () => {
        setIsCameraOpen(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch {
            notify('خطأ في تشغيل الكاميرا');
            setIsCameraOpen(false);
        }
    };

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            context?.drawImage(videoRef.current, 0, 0);
            const imageDataUrl = canvasRef.current.toDataURL('image/jpeg');
            setImagePreview(imageDataUrl);
            logic.setInvoiceData({ ...logic.invoiceData, attachments: [imageDataUrl] });
            stopCamera();
        }
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
        }
        setIsCameraOpen(false);
    };

    if (!isOpen || !mounted) return null;

    const totalQuantity = logic.invoiceData.items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
    const customerReceipt = logic.invoiceData.receipt_type === 'توريد عميل';
    const isEditMode = Boolean(logic.invoiceData.id);

    return createPortal(
        <div className="phi-modal-backdrop mat-modal-backdrop" onClick={onClose}>
            <style>{`
                .mat-modal-backdrop {
                    position: fixed !important;
                    inset: 0 !important;
                    z-index: 1000000001 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    padding: 1.5rem 1rem !important;
                    background: var(--modal-scrim, rgba(5, 7, 11, 0.78)) !important;
                    backdrop-filter: blur(16px) !important;
                    -webkit-backdrop-filter: blur(16px) !important;
                    overflow-y: auto !important;
                    direction: rtl;
                }
                .mat-modal-panel {
                    position: relative;
                    width: min(72rem, 100%);
                    max-height: calc(100dvh - 3rem);
                    overflow-y: auto;
                    background: var(--surface-card) !important;
                    color: var(--text-primary) !important;
                    border-radius: var(--phi-radius-dialog, 20px) !important;
                    box-shadow: var(--shadow-ambient, 0 25px 70px -15px rgba(0, 0, 0, 0.85)) !important;
                    padding: 1.75rem !important;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    direction: rtl;
                }
                .mat-modal-panel::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 10%; right: 10%;
                    height: 1px;
                    background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.22) 50%, transparent 100%);
                    pointer-events: none;
                }
                .mat-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                    flex-wrap: wrap;
                    padding-bottom: 1.125rem;
                    margin-bottom: 1.375rem;
                    border-bottom: 1px solid rgba(148, 163, 184, 0.14);
                }
                .mat-modal-title h2 {
                    margin: 0;
                    font-size: var(--fs-2xl);
                    font-weight: 900;
                    color: var(--text-primary);
                }
                .mat-modal-title p {
                    margin: 0.25rem 0 0;
                    font-size: var(--fs-xs);
                    color: var(--text-secondary);
                    font-weight: 700;
                }
                .mat-modal-header-meta {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                .mat-modal-total-pill {
                    background: var(--accent-soft-bg, rgba(249, 115, 22, 0.13));
                    padding: 0.5rem 1rem;
                    border-radius: 14px;
                    text-align: left;
                    border: 1px solid rgba(249, 115, 22, 0.25);
                }
                .mat-modal-total-pill small {
                    display: block;
                    font-size: var(--fs-xs);
                    color: var(--text-secondary);
                    font-weight: 800;
                }
                .mat-modal-total-pill strong {
                    font-size: var(--fs-xl);
                    font-weight: 900;
                    color: var(--accent-ink);
                }
                .mat-modal-close {
                    width: 2.5rem;
                    height: 2.5rem;
                    border-radius: 12px;
                    border: none;
                    background: var(--surface-subcard);
                    color: var(--text-primary);
                    display: grid;
                    place-items: center;
                    cursor: pointer;
                    transition: background 0.18s ease, transform 0.18s ease;
                }
                .mat-modal-close:hover {
                    background: var(--surface-card-hover);
                    transform: scale(1.04);
                }
                .mat-modal-section {
                    background: var(--surface-subcard);
                    border-radius: 16px;
                    padding: 1.25rem;
                    margin-bottom: 1.25rem;
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
                }
                .mat-modal-label {
                    display: block;
                    font-size: var(--fs-xs);
                    font-weight: 800;
                    color: var(--text-secondary);
                    margin-bottom: 0.4rem;
                }
                .mat-modal-input {
                    width: 100%;
                    padding: 0.65rem 0.85rem;
                    border-radius: 12px;
                    background: var(--surface-sunken) !important;
                    color: var(--text-primary) !important;
                    border: 1px solid rgba(148, 163, 184, 0.16) !important;
                    box-shadow: var(--shadow-sunken);
                    outline: none;
                    font-weight: 700;
                    font-size: var(--fs-sm);
                    color-scheme: var(--native-color-scheme);
                    transition: border-color 0.2s ease, box-shadow 0.2s ease;
                }
                .mat-modal-input option {
                    background: var(--surface-card);
                    color: var(--text-primary);
                }
                .mat-modal-input:focus {
                    border-color: var(--accent-main, #f97316) !important;
                    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.18) !important;
                }
                .mat-lines-shell {
                    background: var(--surface-card);
                    border-radius: 14px;
                    border: 1px solid rgba(148, 163, 184, 0.14);
                    overflow: visible;
                    margin-top: 0.75rem;
                }
                .mat-lines-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: center;
                }
                .mat-lines-table thead {
                    background: var(--surface-sunken);
                }
                .mat-lines-table th {
                    padding: 0.75rem 0.6rem;
                    font-size: var(--fs-xs);
                    font-weight: 900;
                    color: var(--text-secondary);
                    border-bottom: 1px solid rgba(148, 163, 184, 0.14);
                }
                .mat-lines-table td {
                    padding: 0.6rem 0.5rem;
                    border-bottom: 1px solid rgba(148, 163, 184, 0.08);
                    vertical-align: middle;
                }
                .mat-lines-table tbody tr:last-child td {
                    border-bottom: none;
                }
                .mat-lines-table tbody tr:hover {
                    background: var(--surface-card-hover);
                }
                .mat-btn-add-line {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    background: var(--accent-soft-bg, rgba(249, 115, 22, 0.14));
                    color: var(--accent-ink);
                    border: 1px solid rgba(249, 115, 22, 0.32);
                    padding: 0.5rem 0.95rem;
                    border-radius: 11px;
                    font-weight: 800;
                    font-size: var(--fs-xs);
                    cursor: pointer;
                    transition: all 0.18s ease;
                }
                .mat-btn-add-line:hover {
                    background: var(--action-fill);
                    color: var(--action-ink);
                    border-color: transparent;
                }
                .mat-attach-btn {
                    flex: 1;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    padding: 0.9rem 1rem;
                    border-radius: 14px;
                    font-weight: 800;
                    font-size: var(--fs-sm);
                    cursor: pointer;
                    transition: all 0.18s ease;
                }
                .mat-attach-btn.is-file {
                    background: var(--surface-sunken);
                    color: var(--text-secondary);
                    border: 1.5px dashed rgba(148, 163, 184, 0.32);
                }
                .mat-attach-btn.is-file:hover {
                    border-color: var(--accent-main, #f97316);
                    color: var(--text-primary);
                }
                .mat-attach-btn.is-camera {
                    background: var(--surface-subcard);
                    color: var(--accent-ink);
                    border: 1px solid rgba(249, 115, 22, 0.28);
                }
                .mat-attach-btn.is-camera:hover {
                    background: var(--accent-soft-bg);
                }
                .mat-summary-strip {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
                    gap: 0.9rem;
                    margin-top: 1.25rem;
                }
                .mat-summary-card {
                    background: var(--surface-subcard);
                    border-radius: 14px;
                    padding: 0.95rem 1.1rem;
                    text-align: center;
                    border: 1px solid rgba(148, 163, 184, 0.12);
                }
                .mat-summary-card.is-accent {
                    background: var(--accent-soft-bg, rgba(249, 115, 22, 0.14));
                    border-color: rgba(249, 115, 22, 0.34);
                }
                .mat-summary-card small {
                    display: block;
                    font-size: var(--fs-xs);
                    color: var(--text-secondary);
                    font-weight: 800;
                    margin-bottom: 0.25rem;
                }
                .mat-summary-card strong {
                    font-size: var(--fs-2xl);
                    font-weight: 900;
                    color: var(--text-primary);
                }
                .mat-summary-card.is-accent strong {
                    color: var(--accent-ink);
                }
                .mat-footer-actions {
                    display: flex;
                    gap: 0.9rem;
                    margin-top: 1.5rem;
                    padding-top: 1.125rem;
                    border-top: 1px solid rgba(148, 163, 184, 0.14);
                }
                .mat-btn-primary {
                    flex: 2;
                    padding: 0.85rem 1.25rem;
                    border-radius: 13px;
                    border: none;
                    background: var(--action-fill);
                    color: var(--action-ink);
                    font-weight: 900;
                    font-size: var(--fs-md);
                    cursor: pointer;
                    box-shadow: 0 10px 26px -10px rgba(249, 115, 22, 0.55);
                    transition: filter 0.18s ease, transform 0.18s ease;
                }
                .mat-btn-primary:hover:not(:disabled) {
                    filter: brightness(1.08);
                    transform: translateY(-1px);
                }
                .mat-btn-secondary {
                    flex: 1;
                    padding: 0.85rem 1.25rem;
                    border-radius: 13px;
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    background: var(--surface-subcard);
                    color: var(--text-primary);
                    font-weight: 800;
                    font-size: var(--fs-md);
                    cursor: pointer;
                    transition: background 0.18s ease;
                }
                .mat-btn-secondary:hover {
                    background: var(--surface-card-hover);
                }
                @media (max-width: 768px) {
                    .mat-modal-panel { padding: 1.15rem !important; }
                    .mat-lines-shell { overflow-x: auto; }
                    .mat-footer-actions { flex-direction: column; }
                }
            `}</style>

            <div className="phi-modal-panel mat-modal-panel cinematic-scroll" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                {/* الترويسة الموحدة */}
                <div className="mat-modal-header">
                    <div className="mat-modal-title">
                        <h2>{isEditMode ? 'تعديل فاتورة توريد خامات' : 'إصدار فاتورة توريد خامات'}</h2>
                        <p>توجيه الخامات إلى المشروع وبند المقايسة (BOQ) مع حفظها كمسودة جاهزة للترحيل</p>
                    </div>
                    <div className="mat-modal-header-meta">
                        <div className="mat-modal-total-pill">
                            <small>الصافي النهائي</small>
                            <strong>{formatCurrency(logic.grandTotal)}</strong>
                        </div>
                        <button type="button" className="mat-modal-close" onClick={onClose} aria-label="إغلاق النافذة">
                            <X size={18} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {/* البيانات الأساسية */}
                <div className="mat-modal-section">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13.5rem, 1fr))', gap: '1.1rem', marginBottom: '1.1rem' }}>
                        <div style={{ zIndex: 100, position: 'relative' }}>
                            <SmartCombo
                                label="المشروع المستفيد (مركز التكلفة) *"
                                icon="🏢"
                                table="projects"
                                displayCol="Property"
                                searchCols="Property,project_code"
                                value={logic.invoiceData.project_id}
                                onSelect={(v: any) =>
                                    logic.setInvoiceData({
                                        ...logic.invoiceData,
                                        project_id: v?.id,
                                        job_order_id: null,
                                        items: logic.invoiceData.items.map((i: any) => ({ ...i, boq_item_id: null, boq_id: null, boq_item: '' })),
                                    })
                                }
                            />
                        </div>
                        <div style={{ zIndex: 90, position: 'relative' }}>
                            <label htmlFor="material-receipt-type" className="mat-modal-label">مصدر الخامات</label>
                            <select
                                id="material-receipt-type"
                                className="mat-modal-input"
                                value={logic.invoiceData.receipt_type}
                                onChange={(e) =>
                                    logic.setInvoiceData({
                                        ...logic.invoiceData,
                                        receipt_type: e.target.value,
                                        payee_id: '',
                                        payee_name: '',
                                        account_id: '',
                                        job_order_id: null,
                                    })
                                }
                            >
                                <option value="توريد شركة">توريد شركة</option>
                                <option value="توريد عميل">توريد عميل</option>
                            </select>
                        </div>
                        <div style={{ zIndex: 85, position: 'relative' }}>
                            <SmartCombo
                                key={logic.invoiceData.receipt_type}
                                label={customerReceipt ? 'العميل الذي سلّم الخامات *' : 'المورد / التاجر *'}
                                icon="👤"
                                table="partners"
                                displayCol="name"
                                searchCols="name"
                                customFilter={customerReceipt ? 'partner_type=eq.عميل' : 'partner_type=eq.مورد'}
                                value={logic.invoiceData.payee_id}
                                onSelect={(v: any) => logic.setInvoiceData({ ...logic.invoiceData, payee_id: v?.id })}
                            />
                        </div>
                        {customerReceipt && (
                            <JobOrderSelector
                                projectId={logic.invoiceData.project_id || null}
                                value={logic.invoiceData.job_order_id || null}
                                onChange={(id) => logic.setInvoiceData((current: any) => ({ ...current, job_order_id: id }))}
                            />
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: '1.1rem', alignItems: 'end' }}>
                        <div style={{ zIndex: 80, position: 'relative' }}>
                            {customerReceipt ? (
                                <p className="ent-field-note" style={{ margin: 0, padding: '0.65rem 0.9rem', borderRadius: '12px', background: 'var(--accent-soft-bg)', color: 'var(--accent-ink)', fontWeight: 700, fontSize: 'var(--fs-xs)' }}>
                                    رصيد خامات العميل يُرحّل تلقائياً إلى حساب 217 عند ترحيل السند.
                                </p>
                            ) : (
                                <SmartCombo
                                    label="حساب التوجيه المالي *"
                                    icon="💳"
                                    table="accounts"
                                    displayCol="name"
                                    searchCols="name,code"
                                    value={logic.invoiceData.account_id}
                                    onSelect={(v: any) => logic.setInvoiceData({ ...logic.invoiceData, account_id: v?.id })}
                                />
                            )}
                        </div>
                        <div>
                            <label className="mat-modal-label">تاريخ الفاتورة *</label>
                            <input
                                type="date"
                                className="mat-modal-input"
                                value={logic.invoiceData.exp_date}
                                onChange={(e) => logic.setInvoiceData({ ...logic.invoiceData, exp_date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="mat-modal-label">ملاحظات / رقم الإذن الورقي</label>
                            <input
                                type="text"
                                placeholder="مثال: إذن صرف رقم 1 — مخزن معماري"
                                className="mat-modal-input"
                                value={logic.invoiceData.notes || ''}
                                onChange={(e) => logic.setInvoiceData({ ...logic.invoiceData, notes: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* جدول الأصناف */}
                <div className="mat-modal-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', fontWeight: 900, color: 'var(--text-primary)' }}>
                            أصناف الفاتورة (الخامات) وربطها بالبنود
                        </h3>
                        <button type="button" onClick={logic.handleAddItem} className="mat-btn-add-line">
                            <Plus size={15} aria-hidden="true" />
                            <span>إضافة صنف آخر</span>
                        </button>
                    </div>

                    <div className="mat-lines-shell">
                        <table className="mat-lines-table">
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'right', width: '24%' }}>اسم الخامة (من الدليل الموحد)</th>
                                    <th style={{ width: '20%' }}>توجيه لبند (BOQ) - اختياري</th>
                                    <th style={{ width: '13%' }}>الرصيد المتبقي للصنف</th>
                                    <th style={{ width: '9%' }}>الكمية</th>
                                    <th style={{ width: '9%' }}>الوحدة</th>
                                    <th style={{ width: '10%' }}>السعر</th>
                                    <th style={{ width: '11%' }}>الإجمالي</th>
                                    <th style={{ width: '4%' }}>حذف</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logic.invoiceData.items.map((item: any, idx: number) => {
                                    const matchedBalance = (logic.inventoryBalances || []).find(
                                        (inv: any) =>
                                            (inv.item_id && item.item_id && inv.item_id === item.item_id) ||
                                            (inv.item_name &&
                                                (item.item_name || item.work_item) &&
                                                String(inv.item_name).trim() === String(item.item_name || item.work_item).trim())
                                    );
                                    const itemRemainingQty = matchedBalance ? Number(matchedBalance.available_quantity) || 0 : 0;
                                    const hasStock = itemRemainingQty > 0;
                                    return (
                                    <tr key={idx}>
                                        <td style={{ zIndex: 70 - idx, position: 'relative', textAlign: 'right' }}>
                                            <SmartCombo
                                                table="material_items"
                                                searchCols="item_name,item_code"
                                                displayCol="item_name"
                                                initialDisplay={item.item_name || item.work_item}
                                                freeText={true}
                                                onSelect={(selectedItem: any) => {
                                                    const isObject = typeof selectedItem === 'object' && selectedItem !== null;
                                                    if (isObject) {
                                                        logic.handleItemChange(idx, 'item_id', selectedItem.id);
                                                        logic.handleItemChange(idx, 'item_name', selectedItem.item_name);
                                                        logic.handleItemChange(idx, 'work_item', selectedItem.item_name);
                                                        if (selectedItem.default_unit) logic.handleItemChange(idx, 'unit', selectedItem.default_unit);
                                                        if (selectedItem.default_unit_price) logic.handleItemChange(idx, 'unit_price', selectedItem.default_unit_price);
                                                    } else {
                                                        logic.handleItemChange(idx, 'item_id', null);
                                                        logic.handleItemChange(idx, 'item_name', selectedItem);
                                                        logic.handleItemChange(idx, 'work_item', selectedItem);
                                                    }
                                                }}
                                            />
                                        </td>
                                        <td style={{ zIndex: 60 - idx, position: 'relative' }}>
                                            <ProjectBoqCombo
                                                projectId={logic.invoiceData.project_id}
                                                value={item.boq_id}
                                                initialDisplay={item.boq_item}
                                                onSelect={(selectedBoq: any) => {
                                                    logic.handleItemChange(idx, 'boq_selection', selectedBoq);
                                                }}
                                            />
                                        </td>
                                        <td>
                                            <span
                                                style={{
                                                    display: 'inline-block',
                                                    padding: '0.28rem 0.6rem',
                                                    borderRadius: '999px',
                                                    fontWeight: 900,
                                                    fontSize: 'var(--fs-xs)',
                                                    fontVariantNumeric: 'tabular-nums',
                                                    background: hasStock ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-sunken)',
                                                    color: hasStock ? 'var(--status-positive, #10b981)' : 'var(--text-muted)',
                                                }}
                                            >
                                                {itemRemainingQty} {matchedBalance?.unit || item.unit || ''}
                                            </span>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                placeholder="0"
                                                className="mat-modal-input"
                                                style={{ padding: '0.5rem', textAlign: 'center' }}
                                                value={item.quantity}
                                                onChange={(e) => logic.handleItemChange(idx, 'quantity', e.target.value)}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                placeholder="كيس / بستلة"
                                                className="mat-modal-input"
                                                style={{ padding: '0.5rem', textAlign: 'center' }}
                                                value={item.unit}
                                                onChange={(e) => logic.handleItemChange(idx, 'unit', e.target.value)}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                className="mat-modal-input"
                                                style={{ padding: '0.5rem', textAlign: 'center' }}
                                                value={item.unit_price}
                                                onChange={(e) => logic.handleItemChange(idx, 'unit_price', e.target.value)}
                                            />
                                        </td>
                                        <td style={{ fontWeight: 900, color: 'var(--accent-ink)', fontSize: 'var(--fs-md)' }}>
                                            {formatCurrency(item.total_price)}
                                        </td>
                                        <td>
                                            {idx > 0 ? (
                                                <button
                                                    type="button"
                                                    onClick={() => logic.handleRemoveItem(idx)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--status-negative, #ef4444)', cursor: 'pointer', padding: '0.25rem' }}
                                                    title="حذف الصنف"
                                                >
                                                    <Trash2 size={16} aria-hidden="true" />
                                                </button>
                                            ) : (
                                                <div style={{ width: '1.5rem' }} />
                                            )}
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* المرفقات والكاميرا */}
                <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="mat-attach-btn is-file">
                        <Upload size={16} aria-hidden="true" />
                        <span>إرفاق مستند (صورة الفاتورة / إذن الاستلام)</span>
                    </button>
                    <button type="button" onClick={isCameraOpen ? takePhoto : startCamera} className="mat-attach-btn is-camera">
                        <Camera size={16} aria-hidden="true" />
                        <span>{isCameraOpen ? 'التقاط الفاتورة' : 'مسح بالكاميرا'}</span>
                    </button>
                </div>

                {imagePreview && !isCameraOpen && (
                    <div style={{ marginTop: '1rem', position: 'relative', display: 'inline-block' }}>
                        <img
                            src={imagePreview}
                            alt="مرفق الفاتورة"
                            style={{ maxHeight: '11rem', borderRadius: '14px', border: '1.5px solid var(--accent-main)' }}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                setImagePreview(null);
                                logic.setInvoiceData({ ...logic.invoiceData, attachments: [] });
                            }}
                            style={{
                                position: 'absolute',
                                top: '-0.5rem',
                                right: '-0.5rem',
                                background: 'var(--status-negative, #ef4444)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: '1.75rem',
                                height: '1.75rem',
                                cursor: 'pointer',
                                fontWeight: 900,
                            }}
                        >
                            ×
                        </button>
                    </div>
                )}

                {isCameraOpen && (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        style={{ width: '100%', borderRadius: '14px', marginTop: '1rem', border: '2px solid var(--accent-main)' }}
                    />
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <input
                    type="file"
                    ref={fileInputRef}
                    hidden
                    accept="image/*,.pdf"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            const r = new FileReader();
                            r.onload = () => {
                                setImagePreview(r.result as string);
                                logic.setInvoiceData({ ...logic.invoiceData, attachments: [r.result] });
                            };
                            r.readAsDataURL(file);
                        }
                    }}
                />

                {/* الملخص المالي الموحد */}
                <div className="mat-summary-strip">
                    <div className="mat-summary-card">
                        <small>عدد الأصناف المُسجلة</small>
                        <strong>{logic.invoiceData.items.length}</strong>
                    </div>
                    <div className="mat-summary-card">
                        <small>إجمالي الكميات</small>
                        <strong>{totalQuantity}</strong>
                    </div>
                    <div className="mat-summary-card is-accent">
                        <small>الصافي النهائي للتوريد</small>
                        <strong>{formatCurrency(logic.grandTotal)}</strong>
                    </div>
                </div>

                {/* أزرار الحفظ والإغلاق */}
                <div className="mat-footer-actions">
                    <button type="button" onClick={logic.handleSave} className="mat-btn-primary">
                        {isEditMode ? 'حفظ التعديلات على الفاتورة' : 'حفظ الفاتورة (كمسودة جاهزة للترحيل)'}
                    </button>
                    <button type="button" onClick={onClose} className="mat-btn-secondary">
                        إغلاق وإلغاء
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
