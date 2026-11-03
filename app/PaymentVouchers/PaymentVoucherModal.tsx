"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';
import SmartCombo from '@/components/SmartCombo';
import { formatCurrency } from '@/lib/helpers';

export default function PaymentVoucherModal({ 
    isOpen, 
    onClose, 
    record, 
    setRecord, 
    onSave, 
    isSaving,
    partnerBalance = 0, 
    isBalanceLoading = false 
}: any) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => { 
        setMounted(true); 
    }, []);

    if (!isOpen || !mounted || !record) return null;

    // 💰 حساب نسبة السداد من المستحق (إذا كان الرصيد دائناً أي أن الشركة مدينة له)
    const amountToPay = Number(record.amount || 0);
    const hasOwedBalance = partnerBalance > 0; // الرصيد الدائن (مستحق له)
    const paymentPercentage = hasOwedBalance ? (amountToPay / partnerBalance) * 100 : 0;
    const isOverpaid = paymentPercentage > 100;

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', direction: 'rtl', padding: '50px 20px', overflowY: 'auto' }}>
            {/* خلفية للإغلاق عند الضغط خارج المودال */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 0 }} onClick={onClose} />
            
            <style>{`
                @keyframes modalEntrance { 
                    from { opacity: 0; transform: translateY(40px) scale(0.95); } 
                    to { opacity: 1; transform: translateY(0) scale(1); } 
                }
                .progress-bar-striped {
                    background-image: linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent);
                    background-size: 1rem 1rem;
                }
                .modal-content-glass {
                    background: rgba(255, 255, 255, 0.98);
                    border-radius: 32px;
                    width: 100%;
                    max-width: 750px;
                    padding: 45px;
                    position: relative;
                    z-index: 10;
                    margin: auto;
                    box-shadow: 0 50px 100px -20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.5);
                    animation: modalEntrance 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>

            <div className="modal-content-glass cinematic-scroll">
                
                {/* 📝 الهيدر */}
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px', borderBottom:'2px dashed #e2e8f0', paddingBottom:'20px'}}>
                    <div>
                        <h2 style={{ fontWeight: 900, color: THEME.primary, margin:0, fontSize: '26px' }}>
                            💸 {record.id ? 'تعديل سند الصرف' : 'إصدار سند صرف'}
                        </h2>
                        {record.voucher_number && (
                            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 800, marginTop: '8px' }}>
                                رقم السند: <span style={{ color: THEME.goldAccent }}>{record.voucher_number}</span>
                            </div>
                        )}
                    </div>
                    <div style={{ textAlign: 'left', background: '#fef2f2', padding: '10px 20px', borderRadius: '16px', border: `1px solid ${THEME.danger}30` }}>
                        <div style={{ fontSize: '11px', color: THEME.danger, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>مبلغ السند</div>
                        <div style={{ color: THEME.danger, fontWeight: 900, fontSize: '24px' }}>{formatCurrency(amountToPay)}</div>
                    </div>
                </div>

                {/* ⚖️ التوجيه المحاسبي الدقيق (القيد المزدوج) */}
                <div style={{ background: '#f8fafc', padding: '25px', borderRadius: '20px', border: '1px solid #cbd5e1', marginBottom: '25px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: THEME.primary }}>⚖️ التوجيه المحاسبي</h3>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 800 }}>يمكن إضافتها لاحقاً للتوجيه المجمع</span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                        <div style={{ zIndex: 60, position: 'relative' }}>
                            {/* 1. الحساب المدين */}
                            <SmartCombo 
                                label="🧾 الحساب المدين (اختياري الآن)" 
                                table="accounts" 
                                displayCol="name" 
                                initialDisplay={record.debit_account_name || ''} 
                                onSelect={(val:any) => setRecord({
                                    ...record, 
                                    debit_account_name: val?.name || '',
                                    debit_account_id: val?.id || null 
                                })} 
                                strict={true} 
                            />
                        </div>
                        <div style={{ zIndex: 50, position: 'relative' }}>
                            {/* 2. الحساب الدائن */}
                            <SmartCombo 
                                label="🏦 الحساب الدائن (اختياري الآن)" 
                                table="accounts" 
                                displayCol="name" 
                                initialDisplay={record.credit_account_name || ''} 
                                onSelect={(val:any) => setRecord({
                                    ...record, 
                                    credit_account_name: val?.name || '',
                                    credit_account_id: val?.id || null 
                                })} 
                                strict={true} 
                            />
                        </div>
                    </div>

                    {/* 3. المستفيد المباشر */}
                    <div style={{ zIndex: 40, position: 'relative' }}>
                        <SmartCombo 
                            label="👤 المستفيد / المستلم المباشر (العامل/الموظف/المورد) *" 
                            table="partners" 
                            displayCol="name" 
                            initialDisplay={record.payee_name || ''} 
                            onSelect={(val:any) => setRecord({
                                ...record, 
                                payee_name: val?.name || '', 
                                payee_id: val?.id || null 
                            })} 
                            allowAddNew={true} 
                        />
                    </div>
                </div>

                {/* 📊 عرض رصيد العامل/المستفيد ونسبة السداد اللحظية */}
                {record.payee_id && (
                    <div style={{ background: 'white', padding: '20px', borderRadius: '16px', marginBottom: '25px', border: `1px solid ${THEME.goldAccent}50`, boxShadow: '0 4px 15px rgba(0,0,0,0.03)', animation: 'modalEntrance 0.3s ease-out' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 900, color: '#64748b' }}>الرصيد المتبقي للمستفيد قبل الصرف:</span>
                            {isBalanceLoading ? (
                                <span style={{ fontSize: '14px', fontWeight: 900, color: '#94a3b8' }}>⏳ جاري الحساب...</span>
                            ) : (
                                <div style={{ textAlign: 'left' }}>
                                    <span style={{ fontSize: '22px', fontWeight: 900, color: partnerBalance > 0 ? THEME.danger : partnerBalance < 0 ? THEME.success : '#64748b' }}>
                                        {formatCurrency(Math.abs(partnerBalance))} 
                                    </span>
                                    <span style={{ fontSize: '12px', marginRight: '8px', fontWeight: 800, color: partnerBalance > 0 ? THEME.danger : partnerBalance < 0 ? THEME.success : '#64748b' }}>
                                        {partnerBalance > 0 ? '(مستحق له)' : partnerBalance < 0 ? '(مدين - عليه)' : 'مُصَفَّر'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* شريط التقدم المرئي لنسبة الصرف */}
                        {!isBalanceLoading && hasOwedBalance && amountToPay > 0 && (
                            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px dashed #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 900, marginBottom: '8px', color: '#475569' }}>
                                    <span>مؤشر السداد من المستحق:</span>
                                    <span style={{ color: isOverpaid ? THEME.danger : '#059669', fontSize: '14px' }}>
                                        {paymentPercentage.toFixed(1)}%
                                    </span>
                                </div>
                                <div style={{ width: '100%', height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                                    <div className="progress-bar-striped" style={{ 
                                        width: `${Math.min(paymentPercentage, 100)}%`, 
                                        height: '100%', 
                                        background: isOverpaid ? THEME.danger : 'linear-gradient(90deg, #10b981, #059669)',
                                        transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.5s'
                                    }}></div>
                                </div>
                                {isOverpaid && (
                                    <div style={{ fontSize: '12px', color: THEME.danger, marginTop: '10px', background: '#fef2f2', padding: '8px 12px', borderRadius: '8px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid #fecaca' }}>
                                        <span>⚠️</span> تنبيه: مبلغ الصرف يتجاوز المستحق بـ {formatCurrency(amountToPay - partnerBalance)}! سيتحول هذا الفارق كمديونية (سلفة) على المستفيد لصالح الشركة.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 📅 التاريخ والمبلغ */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '25px' }}>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: '#64748b', display: 'block', marginBottom: '8px' }}>📅 تاريخ السداد *</label>
                        <input 
                            type="date" 
                            style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: '#f8fafc', fontWeight: 700, color: '#1e293b', outline: 'none' }} 
                            value={record.date || ''} 
                            onChange={e => setRecord({...record, date: e.target.value})} 
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: THEME.danger, display: 'block', marginBottom: '8px' }}>💰 المبلغ المراد صرفه *</label>
                        <input 
                            type="number" 
                            min="0" 
                            step="0.01" 
                            style={{ width: '100%', padding: '14px', borderRadius: '14px', border: `2px solid ${THEME.danger}50`, background: '#fef2f2', fontWeight: 900, color: THEME.danger, outline: 'none', fontSize: '16px' }} 
                            value={record.amount || ''} 
                            onChange={e => setRecord({...record, amount: Number(e.target.value)})} 
                        />
                    </div>
                </div>

                {/* 📝 المشروع، أمر الشغل، وطريقة الدفع */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                    <div style={{ zIndex: 30, position: 'relative' }}>
                        <SmartCombo 
                            label="🏢 المشروع (اختياري / مركز تكلفة)" 
                            table="projects" 
                            displayCol="Property" 
                            initialDisplay={record.site_ref || ''} 
                            onSelect={(val:any) => setRecord({...record, site_ref: val?.Property || ''})} 
                        />
                    </div>
                    <div style={{ zIndex: 25, position: 'relative' }}>
                        <SmartCombo 
                            label="🛠️ أمر الشغل (اختياري)" 
                            table="job_orders" 
                            displayCol="order_number" 
                            searchCols="order_number,notes"
                            initialDisplay={record.job_order_number || ''} 
                            customQuery={(q: any) => q.select('*, boq_budget:boq_budget_id(work_item), projects:project_id(Property)')}
                            displayFormat={(item: any) => `${item.order_number} (${item.projects?.Property || 'مشروع'} - ${item.boq_budget?.work_item || 'بدون بند'})`}
                            onSelect={(val:any) => setRecord({
                                ...record, 
                                job_order_id: val?.id || null,
                                job_order_number: val?.order_number || '',
                                site_ref: record.site_ref || val?.projects?.Property || ''
                            })} 
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: '#64748b', display: 'block', marginBottom: '8px' }}>💳 طريقة الدفع</label>
                        <select 
                            style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: 'white', fontWeight: 700, color: '#1e293b', outline: 'none', cursor: 'pointer' }} 
                            value={record.payment_method || 'تحويل بنكي'} 
                            onChange={e => setRecord({...record, payment_method: e.target.value})} 
                        >
                            <option value="تحويل بنكي">تحويل بنكي</option>
                            <option value="نقدي">نقدي (كاش)</option>
                            <option value="شيك">شيك</option>
                        </select>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '25px' }}>
                    <div>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: '#64748b', display: 'block', marginBottom: '8px' }}>🔢 رقم المرجع (حوالة / شيك)</label>
                        <input 
                            type="text" 
                            placeholder="رقم المرجع..." 
                            style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: '#fff', fontWeight: 700, color: '#1e293b', outline: 'none' }} 
                            value={record.reference_number || record.reference_no || ''} 
                            onChange={e => setRecord({...record, reference_number: e.target.value, reference_no: e.target.value})} 
                        />
                    </div>
                    <div style={{ zIndex: 20, position: 'relative' }}>
                        <SmartCombo 
                            label="📂 بيان السند / الوصف" 
                            freeText={true} 
                            initialDisplay={record.description || ''} 
                            onSelect={(val:any) => setRecord({...record, description: typeof val === 'object' ? val.name : val})} 
                        />
                    </div>
                </div>

                {/* 🔘 أزرار الأكشن */}
                <div style={{ display: 'flex', gap: '15px', marginTop: '30px', borderTop: '1px solid #f1f5f9', paddingTop: '25px' }}>
                    <button 
                        onClick={onClose} 
                        style={{ flex: 1, padding: '18px', borderRadius: '16px', border: '2px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 900, cursor: 'pointer', fontSize: '15px', transition: '0.2s' }}
                    >
                        إلغاء
                    </button>
                    <button 
                        id="payment-save-button"
                        onClick={() => onSave(record)} 
                        disabled={isSaving || amountToPay <= 0} 
                        style={{ 
                            flex: 2, 
                            padding: '18px', 
                            borderRadius: '16px', 
                            background: amountToPay > 0 ? THEME.danger : '#cbd5e1', 
                            color: 'white', 
                            fontWeight: 900, 
                            border: 'none', 
                            cursor: amountToPay > 0 ? 'pointer' : 'not-allowed', 
                            fontSize: '16px', 
                            boxShadow: amountToPay > 0 ? `0 10px 25px ${THEME.danger}40` : 'none', 
                            transition: '0.2s' 
                        }}
                    >
                        {isSaving ? '⏳ جاري التنفيذ...' : '📝 حفظ كمسودة (معلق)'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
