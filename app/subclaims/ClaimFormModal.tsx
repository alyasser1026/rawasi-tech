"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import { supabase } from '@/lib/supabase'; 
import { notify } from '@/lib/notify';

export default function ClaimFormModal({ isOpen, onClose, logic }: any) {
    const [mounted, setMounted] = useState(false);
    
    // 🚀 States
    const [enrichedAssignments, setEnrichedAssignments] = useState<any[]>([]);
    const [realMatDed, setRealMatDed] = useState(0);
    const [realExpDed, setRealExpDed] = useState(0);
    const [isEnriching, setIsEnriching] = useState(true);
    
    const [activeProjectIds, setActiveProjectIds] = useState<string[]>([]);
    const [activeJobOrderIds, setActiveJobOrderIds] = useState<string[]>([]);

    // 🚀 States لحفظ الـ IDs الدقيقة للخامات والمصروفات
    const [pendingExpenseIds, setPendingExpenseIds] = useState<string[]>([]);
    const [pendingMaterialIds, setPendingMaterialIds] = useState<string[]>([]);

    useEffect(() => { setMounted(true); }, []);

    // 🚀 المحرك الذكي المطور: يتجاوز الـ View تماماً ويقرأ من الجذور
    useEffect(() => {
        const enrichDataAndDeductions = async () => {
            if (!isOpen || !logic?.currentClaim?.assignments_data) return;
            setIsEnriching(true);

            try {
                const assignments = logic.currentClaim.assignments_data;
                const assignmentIds = assignments.map((a:any) => a.assignment_id || a.id).filter(Boolean);

                // 1. تجاوز الفيو وجلب الداتا الصحيحة (تم إصلاح Error 400 بإزالة الأعمدة غير الموجودة)
                const { data: realAssignments, error: fetchError } = await supabase
                    .from('contractor_assignments')
                    .select(`
                        id, assigned_qty, unit_price, job_order_id, project_id,
                        job_orders:job_orders!job_order_id ( order_number, contractor_id ),
                        projects:projects!contractor_assignments_project_id_fkey ( Property ),
                        boq_budget:boq_budget_id ( work_item, unit )
                    `)
                    .in('id', assignmentIds);

                if (fetchError) console.error("Fetch Error:", fetchError);

                // استخراج الـ IDs الحقيقية والمؤكدة
                const extractedJobOrderIds = Array.from(new Set(realAssignments?.map(r => r.job_order_id).filter(Boolean) || []));
                const extractedProjectIds = Array.from(new Set(realAssignments?.map(r => r.project_id).filter(Boolean) || []));
                
                setActiveJobOrderIds(extractedJobOrderIds as string[]);
                setActiveProjectIds(extractedProjectIds as string[]);

                const finalProjectIds = extractedProjectIds.length > 0 ? extractedProjectIds : (logic.currentClaim.project_ids || []);

                let mTotal = 0; let eTotal = 0;
                let mIds: string[] = []; let eIds: string[] = [];

                // 2. سحب الخامات الخاصة بهذا المقاول فقط على أوامر التشغيل
                if (extractedJobOrderIds.length > 0 && logic.selectedContractor?.id) {
                    const joContractorMap = new Map<string, string | null>();
                    (realAssignments || []).forEach((r: any) => {
                        const orderObj = Array.isArray(r.job_orders) ? r.job_orders[0] : r.job_orders;
                        if (r.job_order_id) joContractorMap.set(r.job_order_id, orderObj?.contractor_id || null);
                    });

                    const { data: materials } = await supabase
                        .from('material_issue_lines')
                        .select('id, total_price, job_order_id, material_issues:issue_id(subcontractor_id)')
                        .in('job_order_id', extractedJobOrderIds)
                        .eq('is_deducted_from_contractor', true)
                        .is('claim_id', null);

                    const contractorMaterials = (materials || []).filter((m: any) => {
                        const issueObj = Array.isArray(m.material_issues) ? m.material_issues[0] : m.material_issues;
                        const issueContractor = issueObj?.subcontractor_id;
                        if (issueContractor) return issueContractor === logic.selectedContractor.id;
                        return joContractorMap.get(m.job_order_id) === logic.selectedContractor.id;
                    });
                    
                    mIds = contractorMaterials.map((m: any) => m.id);
                    mTotal = contractorMaterials.reduce((acc: number, curr: any) => acc + Number(curr.total_price || 0), 0);
                }

                // 🚀 3. سحب المصروفات بذكاء (بناءً على المقاول والمشاريع)
                if (finalProjectIds.length > 0 && logic.selectedContractor?.id) {
                    const { data: expenses } = await supabase
                        .from('expenses')
                        .select('id, total_price')
                        .eq('payee_id', logic.selectedContractor.id) 
                        .in('project_id', finalProjectIds)           
                        .eq('is_deducted_from_contractor', true)     
                        .is('claim_id', null);                       
                    
                    eIds = (expenses || []).map(e => e.id);
                    eTotal = (expenses || []).reduce((acc, curr) => acc + Number(curr.total_price || 0), 0);
                }

                // 4. دمج البيانات وعرضها
                const mapped = assignments.map((a: any) => {
                    const real = (realAssignments || []).find(r => r.id === (a.assignment_id || a.id));
                    const project = Array.isArray(real?.projects) ? real.projects[0] : real?.projects;
                    const budget = Array.isArray(real?.boq_budget) ? real.boq_budget[0] : real?.boq_budget;
                    const order = Array.isArray(real?.job_orders) ? real.job_orders[0] : real?.job_orders;
                    const qty = Number(a.executed_qty || real?.assigned_qty || a.assigned_qty || 0);
                    const price = Number(a.contract_unit_price || real?.unit_price || a.unit_price || 0);
                    return {
                        ...a,
                        calc_gross: qty * price,
                        real_project_name: project?.Property || a.projects?.Property || 'عقار غير محدد',
                        real_item_name: budget?.work_item || a.boq_item_name || 'بند غير محدد',
                        real_order_number: order?.order_number || a.order_number || 'JO-XXX'
                    };
                });

                setEnrichedAssignments(mapped);
                setPendingMaterialIds(mIds);
                setPendingExpenseIds(eIds);
                
                const viewMatDed = Number(logic.currentClaim.materials_deduction || 0);
                const viewExpDed = Number(logic.currentClaim.other_deductions || 0);
                setRealMatDed(viewMatDed > 0 ? viewMatDed : mTotal);
                setRealExpDed(viewExpDed > 0 ? viewExpDed : eTotal);

            } catch (e) {
                console.error("Error enriching data:", e);
            } finally {
                setIsEnriching(false);
            }
        };

        enrichDataAndDeductions();
    }, [isOpen, logic?.currentClaim, logic?.selectedContractor]);

    if (!isOpen || !mounted || !logic?.currentClaim) return null;

    // 🧮 الحسابات المجمعة
    const totalWork = enrichedAssignments.reduce((sum, a) => sum + Number(a.calc_gross || 0), 0);
    const retentionPercent = Number(logic.currentClaim.retention_percent) || 0;
    const retentionAmount = totalWork * (retentionPercent / 100);
    const advanceDed = Number(logic.currentClaim.advance_payment) || 0;
    
    const totalDeductions = realMatDed + realExpDed + advanceDed;
    const netAmount = totalWork - retentionAmount - totalDeductions;

    // 🚀 استخراج أسماء الفلل المجمعة ودمجها بنص واحد للحفظ
    const uniqueProjectNames = Array.from(new Set(enrichedAssignments.map((a: any) => a.real_project_name).filter(Boolean)));
    const combinedProjectsText = uniqueProjectNames.join(' + ');

    const handleSave = () => {
        const finalProjectIds = activeProjectIds.length > 0 ? activeProjectIds : logic.currentClaim.project_ids;
        
        if (!finalProjectIds || finalProjectIds.length === 0) {
            notify("يرجى التأكد من أن أوامر التشغيل مرتبطة بمشروع/فيلا بشكل سليم.");
            return;
        }

        logic.handleSaveClaim({
            ...logic.currentClaim,
            project_ids: finalProjectIds,
            project_names_text: combinedProjectsText, // 🚀 إرسال أسماء الفلل المجمعة
            job_order_ids: activeJobOrderIds,
            expense_ids: pendingExpenseIds,     
            material_ids: pendingMaterialIds,   
            total_amount: totalWork,
            materials_deduction: realMatDed,
            other_deductions: realExpDed,
            retention_amount: retentionAmount,
            net_amount: netAmount
        });
    };

    return createPortal(
        <div className="warm-portal-overlay-fullscreen" onClick={onClose}>
            <style>{`
                .warm-portal-overlay-fullscreen { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; background: radial-gradient(circle at center, rgba(40, 24, 10, 0.4) 0%, rgba(15, 7, 0, 0.9) 100%) !important; backdrop-filter: blur(20px) !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 999999999 !important; }
                .glass-input-field { width: 100%; padding: 0.625rem 0.75rem; border-radius: 12px; background: rgba(255, 255, 255, 0.65); border: 1px solid rgba(255, 255, 255, 0.8); outline: none; transition: 0.2s; font-weight: 700; color: #1e293b; text-align: center; }
                .glass-input-field:focus { background: #fff; border-color: ${THEME.goldAccent || '#ea580c'}; box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.15); }
                .btn-glass-save { background: linear-gradient(135deg, ${THEME.goldAccent || '#ea580c'}, ${THEME.coffeeDark || '#2d1a11'}); color: white; border: none; padding: 0.75rem 1.25rem; border-radius: 12px; font-weight: 900; font-size: var(--fs-md); cursor: pointer; transition: 0.3s; box-shadow: 0 10px 25px rgba(212, 175, 55, 0.3); }
                .btn-glass-save:hover:not(:disabled) { transform: translateY(-3px); filter: brightness(1.1); }
                .btn-glass-cancel { background: rgba(255, 255, 255, 0.6); color: #1e293b; border: 1px solid rgba(255, 255, 255, 0.8); padding: 0.75rem 1.25rem; border-radius: 12px; font-weight: 900; font-size: var(--fs-md); cursor: pointer; transition: 0.3s; }
            `}</style>

            <div className="cinematic-scroll" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: '68.75rem', maxHeight: '95vh', background: 'rgba(248, 250, 252, 0.95)', backdropFilter: 'blur(30px)', borderRadius: '14px', padding: '2.5rem', boxShadow: '0 40px 80px rgba(0,0,0,0.5)', overflowY: 'auto', direction: 'rtl' }}>
                
                {isEnriching && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-xl)', fontWeight: 900, color: THEME.primary, borderRadius: '14px', backdropFilter: 'blur(5px)' }}>
                        جاري تحليل بيانات العقارات وسحب الخصومات الدقيقة من الدفاتر...
                    </div>
                )}

                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.875rem', borderBottom:`2px solid ${THEME.goldAccent || '#ea580c'}50`, paddingBottom:'0.9375rem'}}>
                    <div>
                        <h2 style={{ color: THEME.coffeeDark || '#2d1a11', fontWeight: 900, margin: 0, fontSize: 'var(--fs-2xl)' }}>إصدار مستخلص مقاول باطن</h2>
                        <div style={{ fontSize: 'var(--fs-sm)', color: '#64748b', marginTop: '0.3125rem', fontWeight: 800 }}>المقاول: {logic.selectedContractor?.name}</div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 900 }}>الصافي النهائي للصرف</div>
                        <div style={{ color: THEME.goldAccent || '#ea580c', fontWeight: 900, fontSize: 'var(--fs-3xl)' }}>{formatCurrency(netAmount)}</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '1.25rem', marginBottom: '1.5625rem', background: 'rgba(212, 175, 55, 0.05)', padding: '1.25rem', borderRadius: '14px', border: `1px solid rgba(212, 175, 55, 0.2)` }}>
                    <div style={{ zIndex: 90 }}>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '0.375rem' }}>المشاريع المشمولة</label>
                        <div className="glass-input-field" style={{ background: '#f8fafc', color: THEME.coffeeDark, minHeight: '2.6875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.3125rem 0.9375rem', border: `1px solid ${THEME.goldAccent}50` }}>
                            {/* 🚀 عرض أسماء كل الفلل المجمعة بوضوح */}
                            <span style={{ fontWeight: 900, fontSize: uniqueProjectNames.length > 1 ? '11px' : '13px', textAlign: 'center', lineHeight: '1.6' }}>
                                {combinedProjectsText || 'عقار غير محدد'}
                            </span>
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '0.375rem' }}>تاريخ المستخلص</label>
                        <input type="date" className="glass-input-field" value={logic.currentClaim.date} onChange={e => logic.setCurrentClaim({...logic.currentClaim, date: e.target.value})} />
                    </div>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '0.375rem' }}>فترة السداد (يوم)</label>
                        <input type="number" min="0" className="glass-input-field" value={logic.currentClaim.payment_period_days || ''} onChange={e => logic.setCurrentClaim({...logic.currentClaim, payment_period_days: Number(e.target.value)})} />
                    </div>
                    <div>
                        <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.coffeeDark, display: 'block', marginBottom: '0.375rem' }}>نسبة احتجاز الضمان %</label>
                        <input type="number" className="glass-input-field" value={logic.currentClaim.retention_percent} onChange={e => logic.setCurrentClaim({...logic.currentClaim, retention_percent: e.target.value})} />
                    </div>
                </div>

                <div style={{ marginBottom: '1.5625rem' }}>
                    <h3 style={{ color: THEME.primary, fontWeight: 900, fontSize: 'var(--fs-lg)', marginBottom: '0.625rem' }}>أوامر التشغيل المعتمدة في هذا المستخلص</h3>
                    {enrichedAssignments.length > 0 ? (
                        <div style={{ background: 'var(--surface-card)', borderRadius: '15px', border: 'none', boxShadow: 'var(--shadow-elevation)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                                <thead style={{ background: 'var(--table-head-bg, var(--surface-sunken))', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
                                    <tr>
                                        <th style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>أمر التشغيل</th>
                                        <th style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>البند / الموقع</th>
                                        <th style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>قيمة الأعمال</th>
                                        <th style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>خصم خامات</th>
                                        <th style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>خصم نثريات</th>
                                        <th style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>الصافي المبدئي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {enrichedAssignments.map((a: any, idx: number) => {
                                        const mat = Number(a.materials_deduction || 0);
                                        const exp = Number(a.expenses_deduction || 0);
                                        return (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.625rem', fontSize: 'var(--fs-sm)', fontWeight: 800, color: THEME.accent }}>{a.real_order_number}</td>
                                                <td style={{ padding: '0.625rem', fontSize: 'var(--fs-sm)', fontWeight: 800, color: THEME.primary }}>
                                                    {a.real_item_name}
                                                    <div style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', marginTop: '0.25rem', fontWeight: 700 }}>{a.real_project_name}</div>
                                                </td>
                                                <td style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 900, color: THEME.success }}>{formatCurrency(a.calc_gross)}</td>
                                                <td style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 900, color: THEME.danger }}>{formatCurrency(mat)}</td>
                                                <td style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 900, color: THEME.danger }}>{formatCurrency(exp)}</td>
                                                <td style={{ padding: '0.625rem', textAlign: 'center', fontWeight: 900, color: THEME.primary }}>{formatCurrency(a.calc_gross - mat - exp)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ background: '#fef2f2', padding: '0.9375rem', borderRadius: '12px', textAlign: 'center', color: '#991b1b', fontWeight: 800, border: '1px dashed #fca5a5' }}>لم يتم تحديد أي أعمال منجزة لهذا المستخلص.</div>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11.25rem, 1fr))', gap: '0.9375rem', marginTop: '0.9375rem' }}>
                    <div style={{ background: 'rgba(255, 107, 107, 0.05)', padding: '0.9375rem', borderRadius: '12px', border: '1px dashed #fca5a5' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#ef4444', fontWeight: 800, textAlign: 'center' }}>إجمالي خصم الخامات (دقيق ومسحوب)</div>
                        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#dc2626', textAlign: 'center', marginTop: '0.625rem' }}>{formatCurrency(realMatDed)}</div>
                    </div>
                    <div style={{ background: 'rgba(255, 159, 67, 0.05)', padding: '0.9375rem', borderRadius: '12px', border: '1px dashed #fcd34d' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#d97706', fontWeight: 800, textAlign: 'center' }}>نقدية ومصروفات (دقيق ومسحوب)</div>
                        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#b45309', textAlign: 'center', marginTop: '0.625rem' }}>{formatCurrency(realExpDed)}</div>
                    </div>
                    <div style={{ background: 'rgba(0, 210, 211, 0.05)', padding: '0.9375rem', borderRadius: '12px', border: '1px dashed #67e8f9' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#0891b2', fontWeight: 800, textAlign: 'center' }}>خصم سلفة / دفعة مقدمة (يدوي)</div>
                        <input 
                            type="number" 
                            className="glass-input-field" 
                            style={{ height: '2.1875rem', marginTop: '0.5rem', fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#0891b2', background: 'white', border: '1px solid #67e8f9' }}
                            value={logic.currentClaim.advance_payment || 0}
                            onChange={e => logic.setCurrentClaim({...logic.currentClaim, advance_payment: Number(e.target.value)})} 
                        />
                    </div>
                </div>

                <div style={{ marginTop: '1.875rem', padding: '1.5625rem', background: 'linear-gradient(135deg, #1e293b, #0f172a)', borderRadius: '14px', color: 'white', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9.375rem, 1fr))', gap: '0.9375rem', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.9375rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', fontWeight: 800 }}>إجمالي الأعمال المنجزة</div>
                        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#60a5fa' }}>{formatCurrency(totalWork)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.9375rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', fontWeight: 800 }}>محتجز ضمان أعمال ({retentionPercent}%)</div>
                        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#fca5a5' }}>{formatCurrency(retentionAmount)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.9375rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', fontWeight: 800 }}>إجمالي الاستقطاعات والخصومات</div>
                        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#fca5a5' }}>{formatCurrency(totalDeductions)}</div>
                    </div>
                    <div style={{ background: `linear-gradient(135deg, ${THEME.goldAccent || '#ea580c'}40, transparent)`, padding: '0.9375rem', borderRadius: '16px', border: `1px solid ${THEME.goldAccent || '#ea580c'}80`, boxShadow: `0 0 20px ${THEME.goldAccent || '#ea580c'}20` }}>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.goldAccent || '#ea580c' }}>الصافي المستحق للصرف</div>
                        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>{formatCurrency(netAmount)}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1.25rem', marginTop: '2.1875rem' }}>
                    <button onClick={handleSave} disabled={logic.isClaimSaving || isEnriching} className="btn-glass-save" style={{ flex: 2 }}>
                        {logic.isClaimSaving ? 'جاري الاعتماد والترحيل...' : 'اعتماد المستخلص'}
                    </button>
                    <button onClick={onClose} className="btn-glass-cancel" style={{ flex: 1 }}>إغلاق</button>
                </div>
            </div>
        </div>,
        document.body
    );
}
