"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { THEME } from '@/lib/theme';
import { Hourglass } from 'lucide-react';

interface JobOrderSelectorProps {
    projectId: string | null;      // معرف الفيلا/المشروع
    contractorId?: string | null;  // معرف المقاول (اختياري)
    value: string | null;          // القيمة المحددة حالياً (job_order_id)
    onChange: (id: string | null) => void; // الدالة المسؤولة عن تحديث الـ State في الفورم الرئيسي
}

export default function JobOrderSelector({ 
    projectId, 
    contractorId, 
    value, 
    onChange 
}: JobOrderSelectorProps) {
    const [jobOrders, setJobOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchJobOrders = async () => {
            if (!projectId) {
                setJobOrders([]);
                onChange(null);
                return;
            }

            setIsLoading(true);
            try {
                // 🚀 الجلب بشكل صريح لجدول أوامر الشغل + جدول المقايسة المرتبط
                let query = supabase
                    .from('job_orders')
                    .select(`
                        id,
                        order_number,
                        notes,
                        boq_budget ( * )
                    `)
                    .eq('project_id', projectId);

                if (contractorId) {
                    query = query.eq('contractor_id', contractorId);
                }

                const { data, error } = await query.order('created_at', { ascending: false });

                if (error) throw error;

                if (data) {
                    // 💡 الكونسول ده هيظهرلك الداتا في المتصفح عشان نعرف اسم البند الحقيقي لو مظَهَرش
                    console.log("🛠️ أوامر الشغل التي تم جلبها:", data); 
                    
                    setJobOrders(data);
                    
                    if (data.length === 1) {
                        onChange(data[0].id);
                    } else {
                        const isStillValid = data.some(jo => jo.id === value);
                        if (!isStillValid) onChange(null);
                    }
                }
            } catch (err) {
                console.error("خطأ أثناء جلب أوامر الشغل:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchJobOrders();
    }, [projectId, contractorId]);

    return (
        <div style={{ width: '100%', zIndex: 65, position: 'relative' }}>
            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: THEME.primary, display: 'block', marginBottom: '0.375rem' }}>
                أمر التشغيل / الشغل *
            </label>
            
            <div style={{ position: 'relative' }}>
                <select
                    className="glass-input-field"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value || null)}
                    disabled={isLoading || !projectId}
                    style={{ 
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
                            ? 'يرجى اختيار المشروع/الفيلا أولاً' 
                            : isLoading 
                                ? 'جاري تحميل أوامر الشغل...' 
                                : jobOrders.length === 0 
                                    ? 'لا توجد أوامر شغل مفتوحة هنا' 
                                    : '-- اختر أمر الشغل المناسب --'
                        }
                    </option>
                    
                    {/* 🚀 المعالجة الذكية لبيانات البند */}
                    {jobOrders.map((jo) => {
                        // 1. حماية: تحويل الـ boq_budget لـ Object حتى لو Supabase رجعها كـ Array
                        const boq = Array.isArray(jo.boq_budget) ? jo.boq_budget[0] : (jo.boq_budget || {});
                        
                        // 2. محاولة جلب الاسم من أي عمود متوقع (أو وضع الملاحظات كبديل)
                        const itemName = boq?.item_name || boq?.description || boq?.name || boq?.work_item || jo.notes || 'بند غير محدد';
                        
                        const fullText = `أمر رقم (${jo.order_number}) - ${itemName}`;
                        
                        return (
                            <option key={jo.id} value={jo.id} title={fullText}>
                                {fullText}
                            </option>
                        );
                    })}
                </select>

                <div style={{ position: 'absolute', left: '0.9375rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    {isLoading ? (
                        <span style={{ fontSize: 'var(--fs-sm)', color: THEME.accent }}><Hourglass size={14} aria-hidden="true" /></span>
                    ) : (
                        <span style={{ fontSize: 'var(--fs-sm)', color: THEME.primary }}>▼</span>
                    )}
                </div>
            </div>
        </div>
    );
}