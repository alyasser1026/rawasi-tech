"use client";
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';
import SmartCombo from '@/components/SmartCombo';
import { formatCurrency } from '@/lib/helpers';
import { useToast } from '@/lib/toast-context'; 
import { supabase } from '@/lib/supabase'; 
import { Hourglass, Plus, Trash2 } from 'lucide-react';
import { notify } from '@/lib/notify';

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

// 🚀 مصفوفة أنواع الاستحقاق
const PAYMENT_METHODS = [
    "آجل",
    "تسوية داخلية"
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
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    const [jobOrders, setJobOrders] = useState<any[]>([]);
    const [isLoadingJobOrders, setIsLoadingJobOrders] = useState(false);
        
    useEffect(() => {
        setMounted(true);
    }, []);

    // 🚀 كود ذكي لجلب أوامر التشغيل المتاحة شاملة بيانات البند من جدول المقايسة (boq_budget)
    useEffect(() => {
        const fetchJobOrders = async () => {
            if (record?.project_id && record?.payee_id) {
                setIsLoadingJobOrders(true);
                try {
                    const { data, error } = await supabase
                        .from('job_orders')
                        .select('*, boq_budget(*)') // 👈 الجلب المزدوج (Join) لضمان الحصول على البند
                        .eq('project_id', record.project_id)
                        .eq('contractor_id', record.payee_id)
                        .order('created_at', { ascending: false });

                    if (error) throw error;
                    
                    if (data) {
                        setJobOrders(data);
                        if (data.length === 1) {
                            setRecord((prev: any) => ({ ...prev, job_order_id: data[0].id }));
                        } else {
                            const isStillValid = data.some(jo => jo.id === record?.job_order_id);
                            if (!isStillValid) setRecord((prev: any) => ({ ...prev, job_order_id: null }));
                        }
                    }
                } catch (err) {
                    console.error("Error fetching job orders:", err);
                } finally {
                    setIsLoadingJobOrders(false);
                }
            } else {
                setJobOrders([]);
            }
        };

        fetchJobOrders();
    }, [record?.project_id, record?.payee_id]);

    // 📷 دوال التقاط الصور
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
            setRecord({ ...record, invoice_image: imageDataUrl });
            stopCamera();
        }
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject) { 
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop()); 
        }
        setIsCameraOpen(false);
    };

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

    // 🛡️ معترض الحفظ النهائي
    const handleValidateAndSave = () => {
        if (!record.exp_date) return showToast("تاريخ المصروف مطلوب", "warning");
        if (!record.main_category) return showToast("يرجى اختيار التصنيف الرئيسي للمصروف", "warning"); 
        if (!record.creditor_account) return showToast("حساب المصروف المدين مطلوب", "warning");
        
        if (!record.payment_account) {
            return showToast("يرجى تحديد الحساب الدائن", "warning");
        }
        
        let finalLinesToSave = safeAddedLines;

        if (record.description && currentQty > 0 && currentPrice > 0) {
            finalLinesToSave = [...finalLinesToSave, {
                description: record.description,
                quantity: currentQty,
                unit_price: currentPrice,
                vat_amount: currentVat,
                discount_amount: currentDiscount
            }];
        }

        if (finalLinesToSave.length === 0) {
            return showToast("يرجى إدخال صنف أو بيان واحد على الأقل للمصروف", "error");
        }

        const isSubContractorExpense = record.creditor_account === 'التزام مقاولي الباطن' || !!record.payee_id;

        // Require Job Order for ALL expenses to link with the budget properly
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
            payment_method: record.payment_method || 'آجل',
            project_id: record.project_id || null,
            payee_id: record.payee_id || null,
            job_order_id: record.job_order_id || null,
            is_deducted_from_contractor: isSubContractorExpense
        });
    };

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="warm-portal-overlay-fullscreen" onClick={onClose}>
            <style>{`
                .warm-portal-overlay-fullscreen { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; background: radial-gradient(circle at center, rgba(40, 24, 10, 0.4) 0%, rgba(15, 7, 0, 0.9) 100%) !important; backdrop-filter: blur(20px) !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 999999999 !important; }
                .glass-input-field { width: 100%; padding: 10px 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.65); border: 1px solid rgba(255, 255, 255, 0.8); outline: none; transition: 0.2s; font-weight: 700; color: #1e293b; }
                .glass-input-field:focus { background: #fff; border-color: ${THEME.accent}; box-shadow: 0 0 0 4px rgba(202, 138, 4, 0.15); }
                .btn-glass-save { background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 900; font-size: var(--fs-md); cursor: pointer; transition: 0.3s; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4); }
                .btn-glass-save:hover:not(:disabled) { transform: translateY(-3px); filter: brightness(1.1); }
                .btn-glass-cancel { background: rgba(255, 255, 255, 0.6); color: #1e293b; border: 1px solid rgba(255, 255, 255, 0.8); padding: 12px 20px; border-radius: 12px; font-weight: 900; font-size: var(--fs-md); cursor: pointer; transition: 0.3s; }
                .btn-glass-cancel:hover { background: rgba(255, 255, 255, 0.9); transform: translateY(-2px); }
                .lines-table-container { background: rgba(255, 255, 255, 0.5); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.7); overflow: hidden; margin-top: 15px; }
                .item-row { transition: 0.2s; border-bottom: 1px solid rgba(0,0,0,0.05); }
                .item-row:hover { background: rgba(255, 255, 255, 0.8); }
            `}</style>

            <div className="cinematic-scroll glass-modal-container" onClick={(e) => e.stopPropagation()} style={{ width: '1000px', maxHeight: '95vh', background: 'rgba(248, 250, 252, 0.9)', backdropFilter: 'blur(30px)', borderRadius: '14px', padding: '40px', boxShadow: '0 40px 80px rgba(0,0,0,0.4)', overflowY: 'auto', direction: 'rtl' }}>
                
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px', borderBottom:`2px solid ${THEME.accent}50`, paddingBottom:'15px'}}>
                    <h2 style={{ color: THEME.primary, fontWeight: 900, margin: 0, fontSize: 'var(--fs-2xl)' }}>{record?.id ? 'تعديل المصروف' : 'إنشاء مصروف جديد'}</h2>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 900 }}>الصافي النهائي</div>
                        <div style={{ color: THEME.accent, fontWeight: 900, fontSize: 'var(--fs-3xl)' }}>{formatCurrency(finalTotal)}</div>
                    </div>
                </div>

                <div className="responsive-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '25px', marginBottom: '25px' }}>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>تاريخ المصروف *</label>
                        <input type="date" className="glass-input-field" value={record?.exp_date || ''} onChange={e => setRecord({...record, exp_date: e.target.value})} />
                    </div>
                    <div style={{ gridColumn: 'span 2', zIndex: 90, position: 'relative' }}>
                        <SmartCombo 
                            label="المشروع / العقار" 
                            icon="🏢" 
                            options={projects || []} 
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '25px', marginBottom: '25px' }}>
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
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '6px' }}>أمر التشغيل / الشغل *</label>
                        <select 
                            className="glass-input-field"
                            value={record?.job_order_id || ''}
                            onChange={e => {
                                const selectedJobOrder = jobOrders.find((jo: any) => jo.id === e.target.value);
                                
                                // بناء أول سطر في المصروفات (Line Item) تلقائياً
                                let newLines = [...(record?.lines_data || [])];
                                if (selectedJobOrder && newLines.length === 0) {
                                    const boq = Array.isArray(selectedJobOrder.boq_budget) ? selectedJobOrder.boq_budget[0] : (selectedJobOrder.boq_budget || {});
                                    const itemName = boq?.item_name || boq?.description || boq?.work_item || selectedJobOrder.notes || 'بند مصروف';
                                    
                                    newLines.push({
                                        item_name: itemName,
                                        quantity: selectedJobOrder.assigned_qty || 1,
                                        unit_price: selectedJobOrder.execution_type === 'تنفيذ ذاتي' ? (selectedJobOrder.unit_price || 0) : '',
                                        total_price: selectedJobOrder.execution_type === 'تنفيذ ذاتي' ? ((selectedJobOrder.assigned_qty || 1) * (selectedJobOrder.unit_price || 0)) : 0,
                                        boq_id: selectedJobOrder.boq_budget_id
                                    });
                                }
                                
                                setRecord({ 
                                    ...record, 
                                    job_order_id: e.target.value || null,
                                    lines_data: newLines.length > 0 ? newLines : record?.lines_data
                                });
                            }}
                            style={{ 
                                cursor: (record?.project_id && record?.payee_id) ? 'pointer' : 'not-allowed', 
                                height: '47px',
                                opacity: (record?.project_id && record?.payee_id) ? 1 : 0.6,
                                appearance: 'none',
                                paddingRight: '30px',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap'
                            }}
                            disabled={!record?.project_id || !record?.payee_id || isLoadingJobOrders}
                        >
                            <option value="">
                                {(!record?.project_id || !record?.payee_id) 
                                    ? 'اختر العقار والمقاول أولاً' 
                                    : isLoadingJobOrders 
                                        ? 'جاري التحميل...' 
                                        : jobOrders.length === 0 
                                            ? 'لا توجد أوامر شغل' 
                                            : '-- اختر أمر الشغل --'}
                            </option>
                            
                            {/* 🚀 فك البيانات المدمجة وإظهار الاسم الحقيقي */}
                            {jobOrders.map((jo) => {
                                const boq = Array.isArray(jo.boq_budget) ? jo.boq_budget[0] : (jo.boq_budget || {});
                                const itemName = boq?.item_name || boq?.description || boq?.work_item || jo.notes || '';
                                const fullText = itemName ? `أمر رقم (${jo.order_number}) - ${itemName}` : `أمر رقم (${jo.order_number})`;
                                
                                return (
                                    <option key={jo.id} value={jo.id} title={fullText}>
                                        {fullText}
                                    </option>
                                );
                            })}
                        </select>
                        <div style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                            {isLoadingJobOrders ? <span style={{ fontSize: 'var(--fs-sm)', color: THEME.accent }}><Hourglass size={14} aria-hidden="true" /></span> : <span style={{ fontSize: 'var(--fs-sm)', color: THEME.primary }}>▼</span>}
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: '25px', zIndex: 60, position: 'relative' }}>
                    <SmartCombo 
                        label="التصنيف الرئيسي *" 
                        icon="📁" 
                        options={EXPENSE_CATEGORIES} 
                        initialDisplay={record?.main_category} 
                        onSelect={(val:any) => setRecord({...record, main_category: typeof val === 'object' && val !== null ? val.name : val})} 
                        strict={true} 
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '25px', background: isSettlement ? 'rgba(16, 185, 129, 0.05)' : '#f8fafc', padding: '25px', borderRadius: '14px', marginBottom: '25px', border: isSettlement ? '1px dashed #10b981' : '1px solid #e2e8f0', transition: 'all 0.3s' }}>
                    <div style={{ zIndex: 55, position: 'relative' }}>
                        <SmartCombo 
                            label="طريقة القيد *" 
                            icon="⚙️" 
                            options={PAYMENT_METHODS} 
                            initialDisplay={record?.payment_method || 'آجل'} 
                            onSelect={(val:any) => setRecord({...record, payment_method: typeof val === 'object' && val !== null ? val.name : val})} 
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
                </div>
                
                <div style={{ background: 'rgba(202, 138, 4, 0.05)', padding: '20px', borderRadius: '14px', marginBottom: '25px', border: `1px dashed ${THEME.accent}` }}>
                    <h3 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 900, color: THEME.brand.coffee, marginBottom: '15px' }}>إضافة بنود المصروف</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.5fr', gap: '15px', alignItems: 'end' }}>
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
                        <button onClick={handleAddStatement} style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', height: '45px', borderRadius: '12px', cursor: 'pointer', fontWeight: 900, fontSize: 'var(--fs-xl)', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' }}><Plus size={15} aria-hidden="true" /></button>
                    </div>

                    {safeAddedLines.length > 0 && (
                        <div className="lines-table-container">
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                                <thead style={{ background: THEME.primary, color: 'white' }}>
                                    <tr>
                                        <th style={{ padding: '12px', fontSize: 'var(--fs-xs)', textAlign: 'right' }}>البيان</th>
                                        <th style={{ padding: '12px', fontSize: 'var(--fs-xs)' }}>الكمية</th>
                                        <th style={{ padding: '12px', fontSize: 'var(--fs-xs)' }}>السعر</th>
                                        <th style={{ padding: '12px', fontSize: 'var(--fs-xs)' }}>الضريبة</th>
                                        <th style={{ padding: '12px', fontSize: 'var(--fs-xs)' }}>الخصم</th>
                                        <th style={{ padding: '12px', fontSize: 'var(--fs-xs)' }}>الإجمالي</th>
                                        <th style={{ padding: '12px', fontSize: 'var(--fs-xs)' }}>حذف</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {safeAddedLines.map((line: any, idx: number) => (
                                        <tr key={idx} className="item-row">
                                            <td style={{ padding: '12px', fontWeight: 700, color: '#1e293b', textAlign: 'right' }}>{line.description}</td>
                                            <td style={{ padding: '12px', fontWeight: 800 }}>{line.quantity}</td>
                                            <td style={{ padding: '12px', fontWeight: 700 }}>{formatCurrency(line.unit_price)}</td>
                                            <td style={{ padding: '12px', fontWeight: 700 }}>{formatCurrency(line.vat_amount)}</td>
                                            <td style={{ padding: '12px', fontWeight: 700, color: THEME.ruby }}>{formatCurrency(line.discount_amount)}</td>
                                            <td style={{ padding: '12px', fontWeight: 900, color: THEME.primary }}>{formatCurrency(line.total_price)}</td>
                                            <td style={{ padding: '12px' }}><button onClick={() => handleRemoveLine(idx)} style={{ background: 'none', border: 'none', color: THEME.ruby, cursor: 'pointer', fontSize: 'var(--fs-lg)' }}><Trash2 size={14} aria-hidden="true" /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                    <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: '18px', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '16px', fontWeight: 900, cursor: 'pointer', color: '#475569', transition: '0.2s' }}>إرفاق مستند (صورة / PDF)</button>
                    <button onClick={isCameraOpen ? takePhoto : startCamera} style={{ flex: 1, padding: '18px', background: '#1e293b', color: 'white', borderRadius: '16px', border: 'none', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}>{isCameraOpen ? 'التقاط الفاتورة' : 'مسح بالكاميرا'}</button>
                </div>
                {isCameraOpen && <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '14px', marginBottom: '20px', border: `4px solid ${THEME.accent}` }} />}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <input type="file" ref={fileInputRef} hidden accept="image/*,.pdf" onChange={(e) => { const file = e.target.files?.[0]; if(file) { const r = new FileReader(); r.onload = () => setImagePreview(r.result as string); r.readAsDataURL(file); } }} />

                <div className="responsive-summary-grid" style={{ marginTop: '30px', padding: '25px', background: 'linear-gradient(135deg, #1e293b, #0f172a)', borderRadius: '14px', color: 'white', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', fontWeight: 800 }}>إجمالي الأعمال</div>
                        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900 }}>{formatCurrency(finalSubtotal)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', fontWeight: 800 }}>إجمالي الضريبة</div>
                        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900 }}>{formatCurrency(finalVat)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', fontWeight: 800 }}>إجمالي الخصم</div>
                        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: THEME.ruby }}>{formatCurrency(finalDiscount)}</div>
                    </div>
                    <div style={{ background: `linear-gradient(135deg, ${THEME.accent}40, transparent)`, padding: '15px', borderRadius: '16px', border: `1px solid ${THEME.accent}80`, boxShadow: `0 0 20px ${THEME.accent}20` }}>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.accentLight }}>الصافي المستحق</div>
                        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{formatCurrency(finalTotal)}</div>
                    </div>
                </div>

                <div className="responsive-actions" style={{ display: 'flex', gap: '20px', marginTop: '35px' }}>
                    <button id="expense-save-button" onClick={handleValidateAndSave} disabled={isSaving} className="btn-glass-save" style={{ flex: 2 }}>
                        {isSaving ? 'جاري الحفظ...' : 'حفظ واعتماد المصروف'}
                    </button>
                    <button onClick={onClose} className="btn-glass-cancel" style={{ flex: 1 }}>إغلاق وإلغاء</button>
                </div>
            </div>
        </div>,
        document.body
    );
}
