"use client";
import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notify';

// البنود الافتراضية لو الشهر ملوش خطة محفوظة
const DEFAULT_ITEMS = [
    { category: 'إيرادات', item_name: 'مبيعات المشاريع' },
    { category: 'إيرادات', item_name: 'إيرادات أخرى' },
    { category: 'مصروفات', item_name: 'رواتب وأجور' },
    { category: 'مصروفات', item_name: 'إيجارات' },
    { category: 'مصروفات', item_name: 'تسويق وإعلانات' },
    { category: 'مصروفات', item_name: 'مصروفات تشغيلية' },
    { category: 'مصروفات', item_name: 'صيانة وإصلاح' },
];

export function useFinancialPlanLogic() {
    const [records, setRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // الكاميرا الحية لتأمين الحفظ من البيانات القديمة (Stale Closures)
    const latestRecordsRef = useRef(records);
    useEffect(() => { latestRecordsRef.current = records; }, [records]);

    const fetchPlan = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('financial_plans')
                .select('*')
                .eq('plan_year', selectedYear)
                .eq('plan_month', selectedMonth)
                .order('category')
                .order('item_name');

            if (error) throw error;

            // لو مفيش داتا للشهر ده، هنفرش البنود الافتراضية
            if (!data || data.length === 0) {
                const initialData = DEFAULT_ITEMS.map((item, index) => ({
                    id: `temp-${index}`, 
                    ...item,
                    plan_year: selectedYear,
                    plan_month: selectedMonth,
                    planned_amount: 0,
                    actual_amount: 0,
                    notes: ''
                }));
                setRecords(initialData);
            } else {
                setRecords(data);
            }
        } catch (err: any) {
            console.error("Error fetching plan:", err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchPlan(); }, [selectedMonth, selectedYear]);

    // إضافة بند جديد يدوياً
    const addNewItem = (category: string) => {
        const newItem = {
            id: `temp-${Date.now()}`,
            plan_year: selectedYear,
            plan_month: selectedMonth,
            category: category,
            item_name: 'بند جديد...',
            planned_amount: 0,
            actual_amount: 0,
            notes: ''
        };
        setRecords([...records, newItem]);
    };

    // حذف بند
    const removeItem = (id: string) => {
        setRecords(records.filter(r => r.id !== id));
    };

    // تحديث خلية مع ضمان تحويل الأرقام بشكل سليم
    const updateRecord = (id: string, field: string, value: any) => {
        setRecords(prev => prev.map(rec => {
            if (rec.id === id) {
                const finalValue = (field === 'planned_amount' || field === 'actual_amount') 
                    ? (value === '' ? 0 : Number(value)) 
                    : value;
                return { ...rec, [field]: finalValue };
            }
            return rec;
        }));
    };

    // 🚀 الحفظ الاحترافي الموحد (تم القضاء على الـ 400 Bad Request)
    const savePlanToDB = async () => {
        const liveRecords = latestRecordsRef.current;
        if (liveRecords.length === 0) return;
        
        setIsSaving(true);
        try {
            // 🛡️ السحر هنا: بناء مصفوفة نظيفة وموحدة المفاتيح والأنواع 100% بدون حقول زائدة أو IDs متضاربة
            const recordsToSave = liveRecords.map(r => ({
                plan_year: Number(selectedYear),
                plan_month: Number(selectedMonth),
                category: r.category,
                item_name: r.item_name || 'بند غير مسمى',
                planned_amount: Number(r.planned_amount) || 0,
                actual_amount: Number(r.actual_amount) || 0,
                notes: r.notes || ''
            }));

            // 1. مسح خطة الشهر والسنة الحالية بالكامل أولاً لتجنب التكرار
            const { error: deleteError } = await supabase
                .from('financial_plans')
                .delete()
                .eq('plan_year', selectedYear)
                .eq('plan_month', selectedMonth);

            if (deleteError) throw deleteError;

            // 2. إدخال الخطة الجديدة بمفاتيح موحدة تماماً ومستقرة
            const { error: insertError } = await supabase
                .from('financial_plans')
                .insert(recordsToSave);

            if (insertError) throw insertError;

            notify("تم حفظ وتثبيت الخطه المالية بنجاح تام!");
            await fetchPlan(); // تحديث فوري للشاشة لجلب البيانات المستقرة من الداتابيز
        } catch (err: any) {
            notify(`خطأ في الحفظ: ${err.message}`);
            console.error("Full Save Error Details:", err);
        } finally {
            setIsSaving(false);
        }
    };

    // حساب إجماليات الإيرادات والمصروفات
    const totals = useMemo(() => {
        let totalRevPlanned = 0, totalRevActual = 0;
        let totalExpPlanned = 0, totalExpActual = 0;

        records.forEach(r => {
            if (r.category === 'إيرادات') {
                totalRevPlanned += Number(r.planned_amount || 0);
                totalRevActual += Number(r.actual_amount || 0);
            } else {
                totalExpPlanned += Number(r.planned_amount || 0);
                totalExpActual += Number(r.actual_amount || 0);
            }
        });

        return {
            totalRevPlanned, totalRevActual,
            totalExpPlanned, totalExpActual,
            netPlanned: totalRevPlanned - totalExpPlanned,
            netActual: totalRevActual - totalExpActual
        };
    }, [records]);

    return {
        records, isLoading, isSaving,
        selectedMonth, setSelectedMonth, selectedYear, setSelectedYear,
        updateRecord, addNewItem, removeItem, savePlanToDB, totals
    };
}