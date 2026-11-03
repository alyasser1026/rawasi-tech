"use client";
import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { usePermissions } from '@/lib/PermissionsContext';

/**
 * العقل المدبر لإدارة الإيرادات - النسخة الماسية V9
 * يتميز بـ:
 * 1. سحب البيانات بنظام Chunking (أكثر من 1000 سجل).
 * 2. محرك حسابات مالي متقدم (الضمان، الضرائب، الأرباح، الصافي).
 * 3. دعم كامل لنظام الصلاحيات المجهري.
 */
export function useRevenueLogic() {
    const { can } = usePermissions();
    const [globalSearch, setGlobalSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // 📥 1. جلب البيانات بمحرك React Query (يدعم Caching و Chunking)
    const { data: allRevenues = [], isLoading, refetch } = useQuery({
        queryKey: ['revenues_list'],
        queryFn: async () => {
            let allData: any[] = [];
            let start = 0;
            const step = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('invoices')
                    .select('*, partners(name)')
                    .eq('status', 'معتمد') // الميثاق: الإيراد يُحسب فقط للفواتير المعتمدة
                    .range(start, start + step - 1)
                    .order('date', { ascending: false });

                if (error) throw error;
                if (data) allData.push(...data);
                hasMore = data?.length === step;
                start += step;
            }
            return allData;
        }
    });

    // 🔍 2. الفلترة الذكية داخل useMemo حصراً لضمان الأداء
    const filteredData = useMemo(() => {
        return allRevenues.filter(rev => {
            const matchesSearch = !globalSearch || 
                rev.invoice_number?.toLowerCase().includes(globalSearch.toLowerCase()) || 
                rev.partners?.name?.toLowerCase().includes(globalSearch.toLowerCase()) ||
                rev.description?.toLowerCase().includes(globalSearch.toLowerCase());
            
            const revDate = new Date(rev.date);
            const matchesFrom = !dateFrom || revDate >= new Date(dateFrom);
            const matchesTo = !dateTo || revDate <= new Date(dateTo);

            return matchesSearch && matchesFrom && matchesTo;
        });
    }, [allRevenues, globalSearch, dateFrom, dateTo]);

    // 📈 3. محرك العمليات المالية (KPIs Engine) - محدث لإصلاح "صفر الضمان"
    const kpis = useMemo(() => {
        return filteredData.reduce((acc, curr) => {
            const lineTotal = Number(curr.line_total) || 0;         // الإجمالي قبل الخصم
            const taxAmount = Number(curr.tax_amount) || 0;         // الضريبة
            const materialsDisc = Number(curr.materials_discount) || 0; // خصم الخامات
            const guarantee = Number(curr.guarantee_amount) || 0;   // ضمان الأعمال المحتجز
            const netAmount = Number(curr.total_amount) || 0;       // الصافي المحقق (الكاش)

            // حساب الربح الإجمالي (قبل محتجز الضمان) حسب معادلة فاي تك
            const currentGrossProfit = lineTotal - materialsDisc - taxAmount;

            return {
                totalGross: acc.totalGross + lineTotal,
                totalTax: acc.totalTax + taxAmount,
                totalMaterials: acc.totalMaterials + materialsDisc,
                // 🛡️ تفعيل حساب إجمالي ضمان الأعمال المحتجز
                totalGuarantee: acc.totalGuarantee + guarantee,
                // 💰 الصافي المحقق (السيولة الفعلية)
                netRevenue: acc.netRevenue + netAmount,
                // 📊 الأرباح الإجمالية (مجموع أرباح العمليات)
                totalGrossProfit: acc.totalGrossProfit + currentGrossProfit
            };
        }, { 
            totalGross: 0, 
            totalTax: 0, 
            totalMaterials: 0, 
            totalGuarantee: 0, 
            netRevenue: 0, 
            totalGrossProfit: 0 
        });
    }, [filteredData]);

    return {
        data: filteredData,
        kpis,
        isLoading,
        globalSearch, 
        setGlobalSearch,
        dateFrom, 
        setDateFrom,
        dateTo, 
        setDateTo,
        refresh: refetch,
        // 🔐 صلاحيات الواجهة
        canView: can('revenue', 'view')
    };
}