"use client";
import React, { useState, useEffect, useRef } from 'react';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import { supabase } from '@/lib/supabase';
import LoadingScreen from '@/components/LoadingScreen';
import JobOrderSelector from '@/components/JobOrderSelector';
import TelegramAttachmentField from '@/components/TelegramAttachmentField';

// =========================================================================
// 🔍 مكون البحث الذكي المطور (مع دعم السحب الآلي initialDisplay) 💎
// =========================================================================
const SmartCombo = ({ label, table, onSelect, placeholder, searchCols = 'name,code', displayCol = 'name', filterStatus, tabIndex, multi = false, selectedValues = [], initialDisplay = '' }: any) => {
    const [search, setSearch] = useState<string>(initialDisplay || ''); 
    const [results, setResults] = useState<any[]>([]);
    const [show, setShow] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (initialDisplay) {
            setSearch(initialDisplay);
        } else if (!multi) {
            setSearch('');
        }
    }, [initialDisplay, multi]);

    const loadInitialData = async (query = '') => {
        if (!table) return;
        setIsLoading(true);
        try {
            let q = supabase.from(table).select('*').limit( multi ? 50 : 15); 
            if (table === 'accounts') q = q.eq('is_transactional', true);
            if (filterStatus) q = q.eq('status', filterStatus);
            if (query) {
                const orQuery = searchCols.split(',').map((col: string) => `${col}.ilike.%${query}%`).join(',');
                q = q.or(orQuery);
            }
            const { data, error } = await q;
            if (!error) setResults((data as any[]) || []);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) return;
        if (!show && e.key === 'ArrowDown') { setShow(true); loadInitialData(search); return; }
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
                break;
            case 'Enter':
                if (show && highlightedIndex >= 0) {
                    e.preventDefault();
                    handleItemAction(results[highlightedIndex]);
                }
                break;
            case 'Escape': setShow(false); break;
        }
    };

    const handleItemAction = (item: any) => {
        onSelect(item);
        if (!multi) {
            const displayName = item[displayCol] || item.Property || item.invoice_number || item.name;
            setSearch(displayName); 
            setShow(false);
        }
    };

    useEffect(() => {
        if (highlightedIndex >= 0 && listRef.current) {
            const el = listRef.current.children[highlightedIndex] as HTMLElement;
            el?.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex]);

    return (
        <div style={{ position: 'relative', flex: 1 }}>
            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.375rem' }}>{label}</label>
            <input 
                type="text" 
                tabIndex={tabIndex}
                placeholder={placeholder || 'ابحث...'}
                value={search} 
                onChange={(e) => { setSearch(e.target.value); setShow(true); loadInitialData(e.target.value); }}
                onFocus={() => { setShow(true); loadInitialData(search); }}
                onKeyDown={handleKeyDown} 
                className="glass-input"
            />
            {show && (
                <>
                    <div onClick={() => setShow(false)} style={{ position: 'fixed', inset: 0, zIndex: 1999 }} />
                    <div ref={listRef} className="cinematic-scroll glass-dropdown" style={{ zIndex: 2000 }}>
                        {isLoading ? (
                            <LoadingScreen message="جاري البحث..." fullScreen={false} />
                        ) : results.length > 0 ? (
                            results.map((item: any, index: number) => {
                                const isSelected = multi ? selectedValues.some((v: any) => v.id === item.id) : false;
                                const isHighlighted = index === highlightedIndex;
                                return (
                                    <div key={item.id} onClick={() => handleItemAction(item)} 
                                         className={`dropdown-item ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}>
                                        {multi && <input type="checkbox" checked={isSelected} readOnly style={{ width: '1.125rem', height: '1.125rem', accentColor: THEME.success }} />}
                                        <span style={{ fontWeight: isSelected ? '900' : 'bold' }}>{item[displayCol] || item.Property || item.invoice_number || item.name}</span>
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{ padding: '0.9375rem', textAlign: 'center', fontSize: 'var(--fs-sm)', color: '#ef4444', fontWeight: 900 }}>لا توجد نتائج</div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// =========================================================================
// 📝 المودال الرئيسي (سند القبض) - مطابق للميثاق الماسي V9
// =========================================================================
export default function ReceiptVoucherModal({ isOpen, onClose, record, setRecord, onSave }: any) {
    // 🚀 المراقبة الذكية لجلب الأسماء عند الضغط من الخارج
    useEffect(() => {
        const syncNames = async () => {
            if (!isOpen || !record) return;
            
            let updates: any = {};
            let needsUpdate = false;

            // 1. ترجمة مصفوفة العقارات (project_ids) لأسماء
            if (record.project_ids?.length > 0 && (!record.selected_projects || record.selected_projects.length === 0)) {
                const { data } = await supabase.from('projects').select('id, "Property"').in('id', record.project_ids);
                if (data) {
                    updates.selected_projects = data;
                    needsUpdate = true;
                }
            }

            // 2. ترجمة العميل (partner_id) لاسم
            if (record.partner_id && !record.partner_name) {
                const { data } = await supabase.from('partners').select('name').eq('id', record.partner_id).single();
                if (data) {
                    updates.partner_name = data.name;
                    needsUpdate = true;
                }
            }

            // 3. الحسابات الافتراضية للشركة النشطة (بدلاً من المعرفات الثابتة)
            if (!record.id && (!record.safe_bank_acc_id || !record.partner_acc_id)) {
                const { data: defAccs } = await supabase
                    .from('accounts')
                    .select('id, code, name')
                    .in('code', ['121', '122', '123'])
                    .eq('is_transactional', true);
                if (defAccs && defAccs.length > 0) {
                    const safeAcc = defAccs.find(a => a.code === '122') || defAccs.find(a => a.code === '121');
                    const custAcc = defAccs.find(a => a.code === '123');
                    if (!record.safe_bank_acc_id && safeAcc) {
                        updates.safe_bank_acc_id = safeAcc.id;
                        updates.safe_bank_acc_name = safeAcc.name;
                        needsUpdate = true;
                    }
                    if (!record.partner_acc_id && custAcc) {
                        updates.partner_acc_id = custAcc.id;
                        updates.partner_acc_name = custAcc.name;
                        needsUpdate = true;
                    }
                }
            }

            if (needsUpdate) {
                setRecord((prev: any) => ({ ...prev, ...updates }));
            }
        };

        syncNames();
    }, [isOpen, record?.project_ids, record?.partner_id]);

    // 🧠 1. سحر السحب الآلي عند اختيار الفاتورة يدوياً من الداخل
    // 🧠 1. سحر السحب الآلي عند اختيار الفاتورة يدوياً من الداخل
    const handleInvoiceSelect = async (inv: any) => {
        let remainingAmount = Number(inv.total_amount || 0) - Number(inv.paid_amount || 0);
        const { data: adjRows, error: adjErr } = await supabase.rpc('get_invoice_adjustment_balances', { p_invoice_ids: [inv.id] });
        if (!adjErr && Array.isArray(adjRows) && adjRows[0]) {
            remainingAmount = Number(adjRows[0].balance || 0);
        }

        const [{ data: partnerData }, { data: defAccs }] = await Promise.all([
            inv.partner_id ? supabase.from('partners').select('name').eq('id', inv.partner_id).single() : Promise.resolve({ data: null }),
            supabase.from('accounts').select('id, code, name').in('code', ['121', '122', '123']).eq('is_transactional', true)
        ]);
        
        let projectsData: any[] = [];
        if (inv.project_ids && inv.project_ids.length > 0) {
            const { data } = await supabase.from('projects').select('id, "Property"').in('id', inv.project_ids);
            projectsData = data || [];
        }

        const defaultCustomerAcc = (defAccs || []).find((a: any) => a.code === '123');
        const defaultSafeAcc = (defAccs || []).find((a: any) => a.code === '122') || (defAccs || []).find((a: any) => a.code === '121');

        let pAccName = defaultCustomerAcc?.name || 'العملاء (أصحاب المشاريع)';
        let pAccId: string | null = defaultCustomerAcc?.id || null;
        
        if (inv.debit_account_id) {
            pAccId = inv.debit_account_id;
            const { data: accData } = await supabase.from('accounts').select('name').eq('id', inv.debit_account_id).single();
            if (accData) pAccName = accData.name;
        }

        // 🚀 الحماية الذكية: لو المستخدم كتب مبلغ بإيده، السيستم يحترمه وميمسحوش!
        // ولو الخانة كانت فاضية (صفر)، السيستم يسحب رصيد الفاتورة المتبقي بعد الإشعارات.
        const userTypedAmount = Number(record.amount || 0);
        const amountToSet = userTypedAmount > 0 ? userTypedAmount : (remainingAmount > 0 ? Number(remainingAmount.toFixed(2)) : 0);

        // أمر الشغل من سطور الفاتورة: لو الفاتورة على أمر شغل واحد بيتحط لوحده
        const invLines = Array.isArray(inv.lines_data) ? inv.lines_data : [];
        const invJobOrders = Array.from(new Set(invLines.map((l: any) => l?.job_order_id).filter(Boolean)));
        const singleLine = invJobOrders.length === 1 ? invLines.find((l: any) => l?.job_order_id === invJobOrders[0]) : null;

        setRecord({
            ...record,
            job_order_id: singleLine ? singleLine.job_order_id : null,
            jo_project_id: singleLine?.project_id || (projectsData.length === 1 ? projectsData[0].id : null),
            invoice_id: inv.id,
            invoice_number: inv.invoice_number,
            partner_id: inv.partner_id,
            partner_name: partnerData?.name || '', 
            selected_projects: projectsData, 
            project_ids: projectsData.map((p: any) => p.id), 
            amount: amountToSet, // 🚀 تثبيت المبلغ المكتوب
            partner_acc_id: pAccId, 
            partner_acc_name: pAccName,
            safe_bank_acc_id: record.safe_bank_acc_id || defaultSafeAcc?.id || null,
            safe_bank_acc_name: record.safe_bank_acc_name || defaultSafeAcc?.name || 'الخزينة الرئيسية'
        });
    };
    // 🧠 2. دالة اختيار العقارات
    const handleProjectToggle = (proj: any) => {
        const current = record.selected_projects || [];
        const isExists = current.find((p: any) => p.id === proj.id);
        
        let newList = isExists 
            ? current.filter((p: any) => p.id !== proj.id) 
            : [...current, { id: proj.id, Property: proj.Property }];

        const joProjectStillThere = newList.some((p: any) => p.id === record.jo_project_id);
        setRecord({
            ...record,
            selected_projects: newList,
            project_ids: newList.map((p: any) => p.id),
            jo_project_id: joProjectStillThere ? record.jo_project_id : (newList.length === 1 ? newList[0].id : null),
            job_order_id: joProjectStillThere ? record.job_order_id : null
        });
    };

    // سند قديم عليه أمر شغل: نجيب فيلا الأمر عشان قائمة الأوامر تفتح عليها
    useEffect(() => {
        if (!isOpen || !record?.job_order_id || record?.jo_project_id) return;
        supabase.from('job_orders').select('project_id').eq('id', record.job_order_id).single()
            .then(({ data }) => { if (data?.project_id) setRecord((prev: any) => ({ ...prev, jo_project_id: data.project_id })); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, record?.job_order_id]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(record);
    };

    if (!isOpen || !record) return null;

    return (
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            
            <style>{`
                .glass-modal {
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(25px);
                    border: 1px solid rgba(255, 255, 255, 0.8);
                    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.15);
                    border-radius: 14px;
                    width: 100%;
                    max-width: 61.25rem; 
                    padding: 2.5rem;
                    direction: rtl;
                    margin: auto; 
                }
                .glass-input {
                    width: 100%; padding: 0.875rem; border-radius: 12px;
                    border: 1px solid rgba(0, 0, 0, 0.1);
                    background: rgba(255, 255, 255, 0.7);
                    outline: none; transition: all 0.2s;
                    font-weight: 700; color: #1e293b; font-size: var(--fs-md);
                }
                .glass-input:focus {
                    background: #ffffff; border-color: ${THEME.accent};
                    box-shadow: 0 0 0 4px rgba(202, 138, 4, 0.15);
                }
                .glass-dropdown {
                    position: absolute; top: calc(100% + 0.3125rem); left: 0; right: 0;
                    background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px);
                    z-index: 2000; border-radius: 12px;
                    box-shadow: 0 15px 35px rgba(0,0,0,0.15); border: 1px solid rgba(255, 255, 255, 0.8);
                    max-height: 12.5rem; overflow-y: auto; padding: 0.375rem;
                }
                .dropdown-item {
                    padding: 0.75rem; cursor: pointer; border-radius: 8px;
                    font-size: var(--fs-sm); transition: all 0.1s; display: flex; align-items: center; gap: 0.625rem; color: #0f172a;
                }
                .dropdown-item.highlighted { background: #f1f5f9; border-right: 4px solid ${THEME.primary}; }
                .dropdown-item.selected { background: #f0fdf4; border-right: 4px solid ${THEME.success}; }
                
                .btn-save {
                    background: linear-gradient(135deg, #10b981, #059669); color: white;
                    border: none; padding: 1.125rem; border-radius: 16px; font-weight: 900; font-size: var(--fs-lg);
                    cursor: pointer; transition: 0.3s; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
                }
                .btn-save:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(16, 185, 129, 0.5); }
                
                .btn-cancel {
                    background: rgba(255, 255, 255, 0.6); color: ${THEME.ruby};
                    border: 1px solid rgba(255, 255, 255, 0.8); padding: 1.125rem; border-radius: 16px;
                    font-weight: 900; font-size: var(--fs-lg); cursor: pointer; transition: 0.3s;
                }
                .btn-cancel:hover { background: rgba(255, 255, 255, 0.9); transform: translateY(-2px); }
            `}</style>

            <div className="glass-modal phi-modal-panel" onClick={(e) => e.stopPropagation()}>
                <h2 style={{ color: THEME.primary, borderBottom: `2px solid ${THEME.accent}40`, paddingBottom: '0.9375rem', margin: '0 0 1.875rem 0', fontWeight: 900, fontSize: 'var(--fs-2xl)' }}>
                    {record.id ? 'تعديل سند قبض' : 'إصدار سند قبض جديد'}
                </h2>
                
                <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11.25rem, 1fr))', gap: '1.25rem' }}>
                    
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.375rem' }}>تاريخ السند *</label>
                        <input type="date" required tabIndex={1} value={record.date || ''} onChange={e => setRecord({...record, date: e.target.value})} className="glass-input" />
                    </div>
                    
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.375rem' }}>طريقة الدفع *</label>
                        <select required tabIndex={2} value={record.payment_method || ''} onChange={e => setRecord({...record, payment_method: e.target.value})} className="glass-input" style={{ appearance: 'auto' }}>
                            <option value="نقدي (كاش)">نقدي (كاش)</option>
                            <option value="تحويل بنكي">تحويل بنكي</option>
                            <option value="شيك">شيك</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: 'var(--fs-md)', fontWeight: 900, color: THEME.success, display: 'block', marginBottom: '0.375rem' }}>المبلغ المُحصل (ريال) *</label>
                        <input type="number" required tabIndex={3} step="0.01" value={record.amount ?? ''} onChange={e => setRecord({...record, amount: e.target.value})} className="glass-input" style={{ background: '#f0fdf4', color: THEME.success, fontSize: 'var(--fs-xl)', border: `2px solid ${THEME.success}50` }} />
                    </div>

                    {/* --- الصف الثاني --- */}
                    <div style={{ gridColumn: 'span 1', zIndex: 90 }}>
                        <SmartCombo 
                            tabIndex={4} 
                            label="رقم الفاتورة (سحب آلي)" 
                            table="invoices" 
                            searchCols="invoice_number" 
                            displayCol="invoice_number" 
                            initialDisplay={record.invoice_number}
                            onSelect={handleInvoiceSelect} 
                        />
                    </div>

                    <div style={{ gridColumn: 'span 1', zIndex: 80 }}>
                        <SmartCombo 
                            tabIndex={5} 
                            multi={true} 
                            label="العقارات (متعدد)" 
                            table="projects" 
                            searchCols="Property" 
                            displayCol="Property" 
                            selectedValues={record.selected_projects || []}
                            placeholder={ (record.selected_projects?.length > 0) ? `تم اختيار (${record.selected_projects.length}) عقارات` : 'اختر العقارات...' }
                            onSelect={handleProjectToggle} 
                        />
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3125rem', marginTop: '0.5rem' }}>
                            {(record.selected_projects || []).map((p: any) => (
                                <span key={p.id} style={{ background: 'rgba(30, 41, 59, 0.1)', fontSize: 'var(--fs-xs)', padding: '0.25rem 0.625rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontWeight: 800, color: THEME.primary }}>
                                    {p.Property}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div style={{ gridColumn: 'span 1', zIndex: 75 }}>
                        {(record.selected_projects || []).length > 1 && (
                            <div style={{ marginBottom: '0.625rem' }}>
                                <label htmlFor="rv-jo-villa" style={{ fontSize: 'var(--fs-md)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.375rem' }}>فيلا أمر الشغل *</label>
                                <select id="rv-jo-villa" className="glass-input" value={record.jo_project_id || ''} onChange={e => setRecord({ ...record, jo_project_id: e.target.value || null, job_order_id: null })}>
                                    <option value="">-- اختار الفيلا --</option>
                                    {(record.selected_projects || []).map((p: any) => <option key={p.id} value={p.id}>{p.Property}</option>)}
                                </select>
                            </div>
                        )}
                        {/* الفيلا ← أوامر الشغل بتاعتها: التحصيل بيتسجل على أمر الشغل */}
                        <JobOrderSelector
                            projectId={record.jo_project_id || ((record.selected_projects || []).length === 1 ? record.selected_projects[0].id : null)}
                            value={record.job_order_id || null}
                            onChange={(id) => setRecord((prev: any) => ({ ...prev, job_order_id: id }))}
                            required={(record.selected_projects || []).length > 0}
                        />
                    </div>

                    <div style={{ gridColumn: 'span 1', zIndex: 70 }}>
                        <SmartCombo 
                            tabIndex={6} 
                            label="العميل الدافع *" 
                            table="partners" 
                            searchCols="name" 
                            displayCol="name" 
                            initialDisplay={record.partner_name}
                            onSelect={(p: any) => setRecord({...record, partner_id: p.id, partner_name: p.name})} 
                        />
                    </div>

                    {/* --- التوجيه المحاسبي --- */}
                    <div style={{ gridColumn: '1 / -1', background: 'rgba(255, 255, 255, 0.5)', padding: '1.5625rem', borderRadius: '14px', border: '1px solid rgba(0,0,0,0.05)', zIndex: 40 }}>
                        <h4 style={{ color: THEME.primary, margin: '0 0 0.9375rem 0', fontSize: 'var(--fs-md)', fontWeight: 900 }}>التوجيه المحاسبي</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '1.25rem' }}>
                            <div style={{ zIndex: 30 }}>
                                <SmartCombo tabIndex={10} label="حساب الصندوق/البنك (مدين)" table="accounts" initialDisplay={record.safe_bank_acc_name} onSelect={(a: any) => setRecord({...record, safe_bank_acc_id: a.id, safe_bank_acc_name: a.name})} />
                            </div>
                            <div style={{ zIndex: 20 }}>
                                {/* 🚀 لن يتم استخدام اسم البارتنر هنا للبحث، سيعتمد فقط على اسم الحساب الممرر */}
                                <SmartCombo tabIndex={11} label="الحساب الدائن (تجميعي العملاء)" table="accounts" initialDisplay={record.partner_acc_name || ''} onSelect={(a: any) => setRecord({...record, partner_acc_id: a.id, partner_acc_name: a.name})} />
                            </div>
                        </div>
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.375rem' }}>البيان / الملاحظات العامة</label>
                        <input type="text" tabIndex={12} placeholder="بيان السند توضيحي..." value={record.notes || ''} onChange={e => setRecord({...record, notes: e.target.value})} className="glass-input" />
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                        <TelegramAttachmentField
                            module="receipt_vouchers"
                            allowOfflineStage={false}
                            label="صورة إيصال التحويل أو الشيك المرفق (Telegram Bot)"
                            value={record.attachment_url || null}
                            onChange={(url) => setRecord({ ...record, attachment_url: url })}
                            caption={record.receipt_number || record.notes || 'سند قبض'}
                            compact={true}
                        />
                    </div>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.9375rem', marginTop: '0.625rem' }}>
                        <button id="receipt-save-button" type="submit" tabIndex={13} className="btn-save" style={{ flex: 2 }}>حفظ وإصدار السند</button>
                        <button type="button" tabIndex={14} onClick={onClose} className="btn-cancel" style={{ flex: 1 }}>إغلاق النافذة</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
