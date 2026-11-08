"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';
import SmartCombo from '@/components/SmartCombo';
// 🚀 استدعاء الكمبوننت الذكي المخصص لأوامر الشغل وبنود المشروع
import ProjectBoqCombo from '@/components/ProjectBoqCombo'; 
import { formatCurrency } from '@/lib/helpers';
import { supabase } from '@/lib/supabase'; // 🚀 تأكد من مسار الاستدعاء الصحيح للـ Supabase عندك
import { notify } from '@/lib/notify';

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
        credit_account_id: ACCOUNT_INVENTORY
    });

    useEffect(() => {
        setMounted(true);
        if (invoiceItem) {
            setFormData(prev => ({ 
                ...prev, 
                // مبدئياً نحط 1 لحد ما الرصيد الحقيقي ييجي من الداتابيز
                quantity: 1, 
                project_id: invoiceItem.project_id || '',
                project_name: invoiceItem.project?.Property || '',
                boq_id: invoiceItem.boq_id || null,
                boq_item_id: invoiceItem.boq_item_id || null,
                boq_item_name: invoiceItem.boq_item || ''
            }));
        }
    }, [invoiceItem]);

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
                    setRealAvailableQty(invoiceItem.available_qty || 0); // كحل بديل لو الفيو مرجعش حاجة
                }
            } catch (err) {
                console.error("Error fetching balance:", err);
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
        setFormData(prev => ({
            ...prev,
            debit_account_id: isContractor ? ACCOUNT_CONTRACTOR : ACCOUNT_COMPANY_COST,
            credit_account_id: ACCOUNT_INVENTORY
        }));
    }, [formData.issue_type]);

    if (!isOpen || !mounted || !invoiceItem) return null;

    const totalPrice = (Number(formData.quantity) || 0) * (Number(invoiceItem.unit_price) || 0);

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
            item: invoiceItem
        };

        onSave(finalData);
    };

    return createPortal(
        <div className="warm-portal-overlay-fullscreen" onClick={onClose}>
            <style>{`
                .warm-portal-overlay-fullscreen {
                    position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important;
                    background: radial-gradient(circle at center, rgba(40, 24, 10, 0.4) 0%, rgba(15, 7, 0, 0.9) 100%) !important;
                    backdrop-filter: blur(20px) !important; display: flex !important; align-items: center !important; justify-content: center !important;
                    z-index: 999999999 !important;
                }
                .glass-input-field {
                    width: 100%; padding: 0.625rem 0.75rem; border-radius: 12px; background: var(--surface-sunken, #f8fafc); border: none; box-shadow: var(--shadow-sunken, inset 0 2px 4px rgba(0,0,0,0.06));
                    outline: none; transition: 0.2s; font-weight: 700; color: #1e293b;
                }
                .glass-input-field:focus { background: #fff; box-shadow: 0 0 0 3px rgba(202, 138, 4, 0.25); }
                .btn-glass-save { background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 0.75rem 1.25rem; border-radius: 12px; font-weight: 900; font-size: var(--fs-md); cursor: pointer; transition: 0.3s; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4); width: 100%; }
                .btn-glass-save:hover:not(:disabled) { transform: translateY(-3px); filter: brightness(1.1); }
            `}</style>

            <div className="cinematic-scroll glass-modal-container" onClick={(e) => e.stopPropagation()} style={{ 
                width: '43.75rem', maxHeight: '95vh',  
                backdropFilter: 'blur(30px)', borderRadius: '24px', padding: '2.5rem', background: 'var(--surface-card, #ffffff)', 
                boxShadow: '0 40px 80px rgba(0,0,0,0.4)', overflowY: 'auto', direction: 'rtl'
            }}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5625rem', borderBottom: 'none', paddingBottom:'0.9375rem'}}>
                    <h2 style={{ color: THEME.coffeeDark || '#2d1a11', fontWeight: 900, margin: 0, fontSize: 'var(--fs-2xl)' }}>صرف مباشر للموقع</h2>
                </div>

                <div style={{ background: 'white', padding: '0.9375rem', borderRadius: '16px', marginBottom: '1.5625rem', border: 'none', boxShadow: 'var(--shadow-ambient)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontWeight: 900, color: '#0f172a', fontSize: 'var(--fs-xl)' }}>{invoiceItem?.item_name}</div>
                        <div style={{ fontSize: 'var(--fs-sm)', color: '#64748b', marginTop: '0.25rem', fontWeight: 800 }}>
                            المتاح للصرف: {' '}
                            {isFetchingQty ? (
                                <span style={{color: '#f59e0b', animation: 'pulse 1.5s infinite'}}>جاري حساب الرصيد...</span>
                            ) : (
                                <span style={{color: realAvailableQty > 0 ? THEME.success : '#ef4444'}}>{realAvailableQty} {invoiceItem?.unit}</span>
                            )}
                        </div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 900 }}>سعر الوحدة</div>
                        <div style={{ fontWeight: 900, color: THEME.primary }}>{formatCurrency(invoiceItem?.unit_price)}</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                    <div style={{ zIndex: 100, position: 'relative' }}>
                        <SmartCombo 
                            label="المشروع المستفيد *" 
                            icon="🏢" 
                            table="projects" 
                            displayCol="Property" 
                            searchCols="Property" 
                            value={formData.project_id}
                            initialDisplay={formData.project_name} 
                            onSelect={(v: any) => setFormData({ ...formData, project_id: v?.id || '', project_name: v?.Property || '', boq_id: null, boq_item_id: null, boq_item_name: '' })}
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
                            onSelect={async (v:any) => {
                                let updates: any = { job_order_id: v?.id || null };
                                
                                // 🚀 سحب البند مباشرة زي يوميات العمالة
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
                        {/* 🚀 السحب باستخدام الكمبوننت الذكي المخصص للبند */}
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '0.375rem' }}>
                            تحميل على بند (BOQ)
                        </label>
                        <ProjectBoqCombo 
                            projectId={formData.project_id}
                            value={formData.boq_item_id || formData.boq_id}
                            initialDisplay={formData.boq_item_name}
                            onSelect={(selectedBoq: any) => {
                                setFormData({ 
                                    ...formData, 
                                    boq_id: selectedBoq?.id || null,
                                    boq_item_id: selectedBoq?.boq_item_id || null, 
                                    boq_item_name: selectedBoq?.display_name || selectedBoq?.work_item || '' 
                                })
                            }} 
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '0.375rem' }}>تاريخ الصرف</label>
                        <input type="date" className="glass-input-field" value={formData.issue_date} onChange={e => setFormData({...formData, issue_date: e.target.value})} />
                    </div>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '0.375rem' }}>الكمية المراد صرفها</label>
                        <input 
                            type="number" 
                            max={realAvailableQty} 
                            min="0.1" 
                            step="0.1" 
                            className="glass-input-field" 
                            style={{ borderColor: formData.quantity > realAvailableQty ? '#ef4444' : '' }} 
                            value={formData.quantity} 
                            onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} 
                        />
                    </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '0.9375rem', borderRadius: '16px', marginBottom: '1.5625rem', border: 'none', boxShadow: 'var(--shadow-ambient)' }}>
                    <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '0.9375rem' }}>التوجيه المحاسبي (جهة التحميل) *</label>
                    <div style={{ display: 'flex', gap: '1.25rem', marginBottom: formData.issue_type === 'صرف لمقاول' ? '0.9375rem' : '0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 800, fontSize: 'var(--fs-sm)' }}>
                            <input type="radio" checked={formData.issue_type === 'استهلاك مباشر'} onChange={() => setFormData({...formData, issue_type: 'استهلاك مباشر', subcontractor_id: ''})} style={{ accentColor: THEME.primary, transform: 'scale(1.2)' }} />
                            استهلاك للشركة (تكلفة مشروع)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 800, fontSize: 'var(--fs-sm)', color: '#be123c' }}>
                            <input type="radio" checked={formData.issue_type === 'صرف لمقاول'} onChange={() => setFormData({...formData, issue_type: 'صرف لمقاول'})} style={{ accentColor: '#be123c', transform: 'scale(1.2)' }} />
                            تحميل كسلفة على مقاول
                        </label>
                    </div>

                    <div style={{ zIndex: 80, position: 'relative', animation: 'fadeIn 0.3s' }}>
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
                                onSelect={(v: any) => setFormData({ ...formData, subcontractor_id: v?.id || '', subcontractor_name: v?.name || '' })} 
                            />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.625rem' }}>
                                <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#166534', padding: '0.75rem', borderRadius: '12px', textAlign: 'center', fontWeight: 900, border: 'none', boxShadow: 'var(--shadow-elevation)' }}>
                                    سيتم تحميل التكلفة مباشرة على حساب تكلفة المشروع
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `linear-gradient(135deg, ${THEME.goldAccent || '#c2410c'}20, transparent)`, padding: '0.9375rem 1.25rem', borderRadius: '16px', border: 'none', boxShadow: 'var(--shadow-elevation)', marginBottom: '1.5625rem' }}>
                    <div style={{ fontSize: 'var(--fs-md)', fontWeight: 900, color: THEME.coffeeDark }}>إجمالي قيمة الصرف:</div>
                    <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: THEME.goldAccent || '#c2410c' }}>{formatCurrency(totalPrice)}</div>
                </div>

                <div style={{ display: 'flex', gap: '0.9375rem' }}>
                    <button onClick={handleSubmit} disabled={isSaving || isFetchingQty} className="btn-glass-save" style={{ flex: 2, opacity: isFetchingQty ? 0.7 : 1 }}>
                        {isSaving ? 'جاري الصرف والترحيل...' : 'تأكيد الصرف والترحيل'}
                    </button>
                    <button onClick={onClose} disabled={isSaving} style={{ flex: 1, padding: '1rem', background: '#e2e8f0', color: '#475569', borderRadius: '16px', fontWeight: 900, border: 'none', cursor: 'pointer' }}>
                        إلغاء
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
