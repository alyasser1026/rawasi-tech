"use client";
import React, { useState, useEffect, useId } from 'react';
import { getActiveCompanyId, supabase } from '@/lib/supabase';
import { JOB_ORDER_REFERENCE_SELECT, readCachedTableRows, writeCachedTableRows } from '@/lib/offline/referenceCache';
import { THEME } from '@/lib/theme';
import { Hourglass } from 'lucide-react';

// أمر الشغل كما يرجع للشاشات: رقم الأمر + بند المقايسة بتاعه (الاسم والوحدة وسعر العقد)
export interface JobOrderOption {
    id: string;
    order_number: string;
    status: string | null;
    executor_type: string | null;
    contractor_id: string | null;
    project_id: string;
    assigned_qty: number | null;
    retention_percent: number | null;
    unit_price: number | null;
    boq_budget_id: string | null;
    notes: string | null;
    boq_budget: { work_item: string | null; unit: string | null; unit_contract_price: number | null; contract_quantity: number | null } | null;
}

interface JobOrderSelectorProps {
    projectId: string | null;      // الفيلا: الأوامر بتظهر بعد اختيارها
    contractorId?: string | null;  // اختياري: يعرض أوامر المقاول ده بس
    value: string | null;          // job_order_id الحالي
    onChange: (id: string | null, jobOrder?: JobOrderOption | null) => void;
    label?: string;
    required?: boolean;
}

// الأوامر اللي اتحصّلت بالكامل ما بتظهرش للاختيار الجديد
const CLOSED_STATUSES = ['تم التحصيل'];

export const jobOrderLabel = (jo: JobOrderOption) =>
    `أمر رقم (${jo.order_number}) - ${jo.boq_budget?.work_item || jo.notes || 'بند غير محدد'}${jo.status && jo.status !== 'جاري التنفيذ' ? ` · ${jo.status}` : ''}`;

export default function JobOrderSelector({
    projectId,
    contractorId,
    value,
    onChange,
    label = 'أمر الشغل',
    required = true
}: JobOrderSelectorProps) {
    const fieldId = useId();
    const [jobOrders, setJobOrders] = useState<JobOrderOption[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const companyId = getActiveCompanyId();

        const applyRawRows = (rawRows: any[]) => {
            if (cancelled || getActiveCompanyId() !== companyId) return;
            const rows = (rawRows || []).map(row => ({
                ...row,
                retention_percent: row.retention_percent ?? null,
                boq_budget: Array.isArray(row.boq_budget) ? (row.boq_budget[0] || null) : (row.boq_budget || null)
            })) as JobOrderOption[];
            const open = rows.filter(jo => !CLOSED_STATUSES.includes(jo.status || '') || jo.id === value);
            setJobOrders(open);

            if (open.length === 1 && !value) {
                onChange(open[0].id, open[0]);
            } else if (value && !open.some(jo => jo.id === value)) {
                onChange(null, null);
            }
        };

        const loadFromOfflineCache = async () => {
            const cached = await readCachedTableRows('job_orders', companyId);
            const filtered = cached.filter(r => {
                if (String(r.project_id) !== String(projectId)) return false;
                if (contractorId && String(r.contractor_id) !== String(contractorId)) return false;
                return true;
            });
            applyRawRows(filtered);
        };

        const fetchJobOrders = async () => {
            if (!projectId) {
                setJobOrders([]);
                if (value) onChange(null, null);
                return;
            }

            setIsLoading(true);
            try {
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    await loadFromOfflineCache();
                    return;
                }

                let query = supabase
                    .from('job_orders')
                    .select(JOB_ORDER_REFERENCE_SELECT)
                    .eq('project_id', projectId);

                if (companyId) query = query.setHeader('x-company-id', companyId);
                if (contractorId) {
                    query = query.eq('contractor_id', contractorId);
                }

                const { data, error } = await query.order('created_at', { ascending: false });
                if (error) throw error;
                if (cancelled || getActiveCompanyId() !== companyId) return;

                if (companyId && data && data.length > 0) {
                    void writeCachedTableRows('job_orders', data, companyId).catch(() => {});
                }
                applyRawRows(data || []);
            } catch (err) {
                console.error('خطأ أثناء جلب أوامر الشغل:', err);
                await loadFromOfflineCache();
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        fetchJobOrders();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, contractorId]);

    return (
        <div style={{ width: '100%', position: 'relative' }}>
            <label htmlFor={fieldId} style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.375rem' }}>
                {label}{required ? ' *' : ''}
            </label>

            <div style={{ position: 'relative' }}>
                <select
                    id={fieldId}
                    className="glass-input-field"
                    value={value || ''}
                    required={required}
                    onChange={(e) => {
                        const picked = jobOrders.find(jo => jo.id === e.target.value) || null;
                        onChange(picked ? picked.id : null, picked);
                    }}
                    disabled={isLoading || !projectId}
                    style={{
                        width: '100%',
                        cursor: projectId ? 'pointer' : 'not-allowed',
                        height: '2.9375rem',
                        opacity: projectId ? 1 : 0.6,
                        appearance: 'none',
                        paddingRight: '1.875rem',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                    }}
                >
                    <option value="">
                        {!projectId
                            ? 'اختار الفيلا الأول'
                            : isLoading
                                ? 'جاري تحميل أوامر الشغل…'
                                : jobOrders.length === 0
                                    ? 'مفيش أوامر شغل للفيلا دي'
                                    : '-- اختار أمر الشغل --'
                        }
                    </option>
                    {jobOrders.map((jo) => {
                        const text = jobOrderLabel(jo);
                        return <option key={jo.id} value={jo.id} title={text}>{text}</option>;
                    })}
                </select>

                <div style={{ position: 'absolute', left: '0.9375rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    {isLoading
                        ? <span style={{ fontSize: 'var(--fs-sm)', color: THEME.accent }}><Hourglass size={14} aria-hidden="true" /></span>
                        : <span style={{ fontSize: 'var(--fs-sm)', color: THEME.primary }} aria-hidden="true">▼</span>}
                </div>
            </div>
        </div>
    );
}
