"use client";
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';
import SmartCombo from '@/components/SmartCombo';
// 🚀 استدعاء الكمبوننت الذكي الجديد الخاص ببنود المشروع
import ProjectBoqCombo from '@/components/ProjectBoqCombo'; 
import { formatCurrency } from '@/lib/helpers';
import { useToast } from '@/lib/toast-context'; 
import { Trash2 } from 'lucide-react';
import { notify } from '@/lib/notify';

export default function MaterialInvoiceModal({ isOpen, onClose, logic }: any) {
    const { showToast } = useToast();
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

    // =========================================================================
    // 📷 دوال التقاط الصور والمرفقات للفاتورة
    // =========================================================================
    const startCamera = async () => {
        setIsCameraOpen(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) { 
            notify("خطأ في تشغيل الكاميرا"); 
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
            logic.setInvoiceData({ ...logic.invoiceData, attachments: [imageDataUrl] }); // حفظ المرفق في الـ State
            stopCamera();
        }
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject) { 
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop()); 
        }
        setIsCameraOpen(false);
    };

    // حارس الرندر
    if (!isOpen || !mounted) return null;

    // حساب إجمالي الكميات للملخص السفلي
    const totalQuantity = logic.invoiceData.items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);

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
                    width: 100%; padding: 10px 12px; border-radius: 12px;
                    background: rgba(255, 255, 255, 0.65);
                    border: 1px solid rgba(255, 255, 255, 0.8);
                    outline: none; transition: 0.2s; font-weight: 700; color: #1e293b;
                }
                .glass-input-field:focus { background: #fff; border-color: ${THEME.accent}; box-shadow: 0 0 0 4px rgba(202, 138, 4, 0.15); }
                
                .btn-glass-save { background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 900; font-size: 14px; cursor: pointer; transition: 0.3s; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4); }
                .btn-glass-save:hover:not(:disabled) { transform: translateY(-3px); filter: brightness(1.1); }
                .btn-glass-cancel { background: rgba(255, 255, 255, 0.6); color: #1e293b; border: 1px solid rgba(255, 255, 255, 0.8); padding: 12px 20px; border-radius: 12px; font-weight: 900; font-size: 14px; cursor: pointer; transition: 0.3s; }
                .btn-glass-cancel:hover { background: rgba(255, 255, 255, 0.9); transform: translateY(-2px); }
                
                .lines-table-container {
                    background: rgba(255, 255, 255, 0.5);
                    border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.7);
                    overflow: visible; /* تعديل مهم لتجنب قص القوائم المنسدلة */
                    margin-top: 15px;
                }
                .item-row { transition: 0.2s; border-bottom: 1px solid rgba(0,0,0,0.05); }
                .item-row:hover { background: rgba(255, 255, 255, 0.8); }
            `}</style>

            <div className="cinematic-scroll glass-modal-container" onClick={(e) => e.stopPropagation()} style={{ 
                width: '1100px', maxHeight: '95vh', background: 'rgba(248, 250, 252, 0.9)', 
                backdropFilter: 'blur(30px)', borderRadius: '14px', padding: '40px', 
                boxShadow: '0 40px 80px rgba(0,0,0,0.4)', overflowY: 'auto', direction: 'rtl'
            }}>
                
                {/* 📝 الهيدر */}
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px', borderBottom:`2px solid ${THEME.accent}50`, paddingBottom:'15px'}}>
                    <h2 style={{ color: THEME.primary, fontWeight: 900, margin: 0, fontSize: '26px' }}>إصدار فاتورة توريد خامات</h2>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 900 }}>الصافي النهائي</div>
                        <div style={{ color: THEME.accent, fontWeight: 900, fontSize: '28px' }}>{formatCurrency(logic.grandTotal)}</div>
                    </div>
                </div>

                {/* 📋 البيانات الأساسية (Master Data) */}
                <div className="responsive-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '25px', marginBottom: '25px' }}>
                    <div style={{ zIndex: 100, position: 'relative' }}>
                        <SmartCombo 
                            label="المشروع المستفيد (مركز التكلفة) *" 
                            icon="🏢" 
                            table="projects" 
                            displayCol="Property" 
                            searchCols="Property,project_code" 
                            value={logic.invoiceData.project_id}
                            onSelect={(v: any) => logic.setInvoiceData({ 
                                ...logic.invoiceData, 
                                project_id: v?.id,
                                // 🚀 تصفير البنود لو المشروع اتغير عشان ميحصلش تضارب
                                items: logic.invoiceData.items.map((i:any) => ({...i, boq_item_id: null, boq_id: null, boq_item: ''})) 
                            })} 
                        />
                    </div>
                    <div style={{ zIndex: 90, position: 'relative' }}>
                        <SmartCombo label="المورد / التاجر *" icon="👤" table="partners" displayCol="name" searchCols="name" customFilter="partner_type=eq.مورد" value={logic.invoiceData.payee_id} onSelect={(v: any) => logic.setInvoiceData({ ...logic.invoiceData, payee_id: v?.id })} />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px', background: '#f8fafc', padding: '25px', borderRadius: '14px', marginBottom: '25px', border: '1px solid #e2e8f0' }}>
                    <div style={{ zIndex: 80, position: 'relative' }}>
                        <SmartCombo label="حساب التوجيه المالي (مثال: خامات العملاء) *" icon="💳" table="accounts" displayCol="name" searchCols="name,code" value={logic.invoiceData.account_id} onSelect={(v: any) => logic.setInvoiceData({ ...logic.invoiceData, account_id: v?.id })} />
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>تاريخ الفاتورة *</label>
                        <input type="date" className="glass-input-field" value={logic.invoiceData.exp_date} onChange={e => logic.setInvoiceData({...logic.invoiceData, exp_date: e.target.value})} />
                    </div>
                </div>
                
                {/* 🚀 قسم إدخال الأصناف (متعدد الأصناف مع الـ BOQ والكتالوج الموحد) */}
                <div style={{ background: 'rgba(202, 138, 4, 0.05)', padding: '20px', borderRadius: '14px', marginBottom: '25px', border: `1px dashed ${THEME.accent}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: THEME.brand?.coffee || THEME.coffeeDark }}>أصناف الفاتورة (الخامات) وربطها بالبنود</h3>
                        <button onClick={logic.handleAddItem} style={{ background: 'white', color: THEME.primary, border: `1px solid ${THEME.accent}`, padding: '8px 15px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', transition: '0.2s' }}>
                            إضافة صنف آخر
                        </button>
                    </div>
                    
                    <div className="lines-table-container">
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                            <thead style={{ background: THEME.primary, color: 'white' }}>
                                <tr>
                                    <th style={{ padding: '12px', fontSize: '11px', textAlign: 'right', width: '25%' }}>اسم الخامة (من الدليل الموحد)</th>
                                    <th style={{ padding: '12px', fontSize: '11px', width: '25%' }}>توجيه لبند (BOQ) - اختياري</th>
                                    <th style={{ padding: '12px', fontSize: '11px', width: '10%' }}>الكمية</th>
                                    <th style={{ padding: '12px', fontSize: '11px', width: '10%' }}>الوحدة</th>
                                    <th style={{ padding: '12px', fontSize: '11px', width: '12%' }}>السعر</th>
                                    <th style={{ padding: '12px', fontSize: '11px', width: '13%' }}>الإجمالي</th>
                                    <th style={{ padding: '12px', fontSize: '11px', width: '5%' }}>حذف</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logic.invoiceData.items.map((item: any, idx: number) => (
                                    <tr key={idx} className="item-row">
                                        {/* 🚀 السحب من الدليل الموحد */}
                                        <td style={{ padding: '10px', zIndex: 70 - idx, position: 'relative' }}>
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
                                        
                                        {/* 🚀 تم التعديل: القراءة من boq_id لضمان الربط السليم */}
                                        <td style={{ padding: '10px', zIndex: 60 - idx, position: 'relative' }}>
                                            <ProjectBoqCombo 
                                                projectId={logic.invoiceData.project_id} 
                                                value={item.boq_id} /* 🎯 تم التعديل ليقرأ boq_id بدلاً من boq_item_id */
                                                initialDisplay={item.boq_item}
                                                onSelect={(selectedBoq: any) => {
                                                    logic.handleItemChange(idx, 'boq_selection', selectedBoq);
                                                }} 
                                            />
                                        </td>

                                        <td style={{ padding: '10px' }}>
                                            <input type="number" placeholder="0" className="glass-input-field" style={{ padding: '8px', textAlign: 'center', background: 'white' }} value={item.quantity} onChange={e => logic.handleItemChange(idx, 'quantity', e.target.value)} />
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            <input type="text" placeholder="طن" className="glass-input-field" style={{ padding: '8px', textAlign: 'center', background: 'white' }} value={item.unit} onChange={e => logic.handleItemChange(idx, 'unit', e.target.value)} />
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            <input type="number" placeholder="0.00" className="glass-input-field" style={{ padding: '8px', textAlign: 'center', background: 'white' }} value={item.unit_price} onChange={e => logic.handleItemChange(idx, 'unit_price', e.target.value)} />
                                        </td>
                                        <td style={{ padding: '10px', fontWeight: 900, color: THEME.primary, fontSize: '15px' }}>
                                            {formatCurrency(item.total_price)}
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            {idx > 0 ? (
                                                <button onClick={() => logic.handleRemoveItem(idx)} style={{ background: 'none', border: 'none', color: THEME.ruby || '#ef4444', cursor: 'pointer', fontSize: '18px' }} title="حذف الصنف"><Trash2 size={15} aria-hidden="true" /></button>
                                            ) : <div style={{width: '24px'}}></div>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 📂 المرفقات والكاميرا */}
                <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                    <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: '18px', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '16px', fontWeight: 900, cursor: 'pointer', color: '#475569', transition: '0.2s' }}>
                        إرفاق مستند (صورة الفاتورة / إذن الاستلام)
                    </button>
                    <button onClick={isCameraOpen ? takePhoto : startCamera} style={{ flex: 1, padding: '18px', background: '#1e293b', color: 'white', borderRadius: '16px', border: 'none', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>
                        {isCameraOpen ? 'التقاط الفاتورة' : 'مسح بالكاميرا'}
                    </button>
                </div>
                
                {imagePreview && !isCameraOpen && (
                    <div style={{ marginBottom: '20px', position: 'relative', display: 'inline-block' }}>
                        <img src={imagePreview} alt="مرفق الفاتورة" style={{ maxHeight: '200px', borderRadius: '16px', border: `2px solid ${THEME.accent}` }} />
                        <button onClick={() => { setImagePreview(null); logic.setInvoiceData({ ...logic.invoiceData, attachments: [] }); }} style={{ position: 'absolute', top: '-10px', right: '-10px', background: THEME.danger || '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
                    </div>
                )}
                
                {isCameraOpen && <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '14px', marginBottom: '20px', border: `4px solid ${THEME.accent}` }} />}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <input type="file" ref={fileInputRef} hidden accept="image/*,.pdf" onChange={(e) => { const file = e.target.files?.[0]; if(file) { const r = new FileReader(); r.onload = () => { setImagePreview(r.result as string); logic.setInvoiceData({ ...logic.invoiceData, attachments: [r.result] }); }; r.readAsDataURL(file); } }} />

                {/* 🚀 الملخص المالي السفلي */}
                <div className="responsive-summary-grid" style={{ marginTop: '30px', padding: '25px', background: 'linear-gradient(135deg, #1e293b, #0f172a)', borderRadius: '14px', color: 'white', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 800 }}>عدد الأصناف المُسجلة</div>
                        <div style={{ fontSize: '24px', fontWeight: 900 }}>{logic.invoiceData.items.length}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 800 }}>إجمالي الكميات</div>
                        <div style={{ fontSize: '24px', fontWeight: 900 }}>{totalQuantity}</div>
                    </div>
                    <div style={{ background: `linear-gradient(135deg, ${THEME.accent}40, transparent)`, padding: '15px', borderRadius: '16px', border: `1px solid ${THEME.accent}80`, boxShadow: `0 0 20px ${THEME.accent}20` }}>
                        <div style={{ fontSize: '13px', fontWeight: 900, color: THEME.accentLight || '#fcd34d' }}>الصافي النهائي للتوريد</div>
                        <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{formatCurrency(logic.grandTotal)}</div>
                    </div>
                </div>

                {/* أزرار الحفظ والإغلاق */}
                <div className="responsive-actions" style={{ display: 'flex', gap: '20px', marginTop: '35px' }}>
                    <button onClick={logic.handleSave} className="btn-glass-save" style={{ flex: 2 }}>
                        حفظ وترحيل الخامات للمشروع
                    </button>
                    <button onClick={onClose} className="btn-glass-cancel" style={{ flex: 1 }}>
                        إغلاق وإلغاء
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}