"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import RawasiSmartTable from '@/components/rawasismarttable';
import LoadingScreen from '@/components/LoadingScreen';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import { RefreshCw } from 'lucide-react';

export default function AdvancedExpenseAllocation() {
  const [allocations, setAllocations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 📋 خيارات القوائم المنسدلة (يتم سحبها من الجداول الأساسية لتجنب ليميت الـ 1000)
  const [monthsOptions, setMonthsOptions] = useState<string[]>(['الكل']);
  const [villasOptions, setVillasOptions] = useState<string[]>(['الكل']);
  const [categoriesOptions, setCategoriesOptions] = useState<string[]>(['الكل']);

  // 🔍 حالات الفلاتر النشطة
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState('الكل');
  const [filterVilla, setFilterVilla] = useState('الكل');
  const [filterCategory, setFilterCategory] = useState('الكل');

  // 1️⃣ خطوة الأمان: سحب خيارات الفلاتر من الجداول الأساسية الخفيفة عند فتح الصفحة
  useEffect(() => {
    const loadFilterLookups = async () => {
      try {
        // أ. سحب أسماء الفلل من جدول المشاريع المباشر
        const { data: pData } = await supabase.from('projects').select('Property').order('Property');
        if (pData) {
          const uniqueVillas = Array.from(new Set(pData.map(p => p.Property).filter(Boolean)));
          setVillasOptions(['الكل', ...uniqueVillas]);
        }

        // ب. سحب التصنيفات والشهور المتاحة من جدول المصروفات الحقيقي
        const { data: eData } = await supabase.from('expenses').select('exp_date, main_category');
        if (eData) {
          const uniqueCats = Array.from(new Set(eData.map(e => e.main_category).filter(Boolean))).sort();
          const uniqueMonths = Array.from(new Set(eData.map(e => e.exp_date?.substring(0, 7)).filter(Boolean))).sort().reverse();
          
          setCategoriesOptions(['الكل', ...uniqueCats]);
          setMonthsOptions(['الكل', ...uniqueMonths]);
        }
      } catch (err) {
        console.error("❌ خطأ أثناء تحميل قوائم الفلاتر:", err);
      }
    };
    loadFilterLookups();
  }, []);

  // 2️⃣ التعديل الجوهري: سحب البيانات الموزعة مـفـلـتـرة جـاهـزة من السيرفر (Server-Side)
  const fetchAllocationData = async () => {
    setIsLoading(true);
    try {
      let query = supabase.from('advanced_cost_allocation_view').select('*');
      
      // تطبيق الفلاتر مباشرة في السيرفر قبل السحب من الداتا بيز
      if (filterMonth !== 'الكل') {
        query = query.eq('شهر التحميل المالي', filterMonth);
      }
      if (filterVilla !== 'الكل') {
        query = query.eq('اسم الفيلا المحمل عليها', filterVilla);
      }
      if (filterCategory !== 'الكل') {
        query = query.eq('التصنيف الرئيسي', filterCategory);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setAllocations(data || []);
    } catch (err: any) {
      console.error("❌ خطأ سحب البيانات الموزعة:", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // إعادة سحب البيانات أوتوماتيكياً فور تغيير أي فلتر من القوائم المنسدلة
  useEffect(() => {
    fetchAllocationData();
  }, [filterMonth, filterVilla, filterCategory]);

  // 3️⃣ تصفية النصية (البحث السريع) في جافا سكريبت على الداتا القادمة
  const filteredData = useMemo(() => {
    return allocations.filter(item => {
      return (item["التصنيف الرئيسي"] || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
             (item["وصف المصروف التلقائي"] || '').toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [allocations, searchQuery]);

  // 4️⃣ حساب التحليلات والنسب المئوية للكروت الهندسية بناءً على المعروض
  const stats = useMemo(() => {
    let totalAllocated = 0;
    let dailyLaborTotal = 0;
    let monthlyEqualTotal = 0;
    let annualOfficeTotal = 0;
    const activeVillas = new Set();

    filteredData.forEach(item => {
      const amt = Number(item["المبلغ المحمل (جنيه)"] || 0);
      totalAllocated += amt;
      if (item["اسم الفيلا المحمل عليها"]) activeVillas.add(item["اسم الفيلا المحمل عليها"]);

      const mech = item["آلية التوزيع الهندسية"] || '';
      if (mech.includes('يومي')) dailyLaborTotal += amt;
      else if (mech.includes('شهري')) monthlyEqualTotal += amt;
      else if (mech.includes('إداري')) annualOfficeTotal += amt;
    });

    const getPercentage = (part: number) => totalAllocated > 0 ? ((part / totalAllocated) * 100).toFixed(1) : "0";

    return {
      totalAllocated,
      dailyLaborTotal, dailyLaborPct: getPercentage(dailyLaborTotal),
      monthlyEqualTotal, monthlyEqualPct: getPercentage(monthlyEqualTotal),
      annualOfficeTotal, annualOfficePct: getPercentage(annualOfficeTotal),
      villasCount: activeVillas.size
    };
  }, [filteredData]);

  // 5️⃣ دالة تصدير البيانات إلى ملف CSV
  const exportToCSV = () => {
    if (filteredData.length === 0) return;
    const headers = ["شهر التحميل المالي", "تاريخ المصروف الأصلي", "اسم الفيلا", "التصنيف الرئيسي", "البيان التلقائي", "المبلغ المحمل", "آلية التوزيع"];
    const rows = filteredData.map(item => [
      item["شهر التحميل المالي"],
      item["تاريخ المصروف الأصلي"],
      item["اسم الفيلا المحمل عليها"],
      item["التصنيف الرئيسي"],
      `"${item["وصف المصروف التلقائي"]}"`,
      item["المبلغ المحمل (جنيه)"],
      item["آلية التوزيع الهندسية"]
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_توزيع_المصروفات_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 6️⃣ إعداد أعمدة الجدول الذكي
  const columns = useMemo(() => [
    {
      header: 'الشهر المالي',
      render: (row: any) => (
        <span style={{ fontWeight: 800, color: THEME.coffeeDark, backgroundColor: '#f5ebe0', padding: '0.375rem 0.75rem', borderRadius: '8px', fontSize: 'var(--fs-sm)' }}>
          {row["شهر التحميل المالي"]}
        </span>
      )
    },
    {
      header: 'الفيلا المحمل عليها',
      render: (row: any) => (
        <span style={{ fontWeight: 900, color: '#0f172a', fontSize: 'var(--fs-md)' }}>
          {row["اسم الفيلا المحمل عليها"]}
        </span>
      )
    },
    {
      header: 'التصنيف',
      render: (row: any) => (
        <span style={{ fontWeight: 800, color: '#334155', backgroundColor: '#f1f5f9', padding: '0.3125rem 0.625rem', borderRadius: '6px', fontSize: 'var(--fs-sm)' }}>
          {row["التصنيف الرئيسي"]}
        </span>
      )
    },
    {
      header: 'وصف المصروف والبيان التلقائي',
      render: (row: any) => <span style={{ color: '#475569', fontWeight: 700, fontSize: 'var(--fs-sm)' }}>{row["وصف المصروف التلقائي"]}</span>
    },
    {
      header: 'المبلغ المحمل',
      render: (row: any) => (
        <strong style={{ fontWeight: 900, color: '#c2410c', fontSize: 'var(--fs-lg)', fontFamily: 'monospace' }}>
          {formatCurrency(row["المبلغ المحمل (جنيه)"])}
        </strong>
      )
    },
    {
      header: 'آلية التوزيع الهندسي المحاسبية',
      render: (row: any) => {
        const mech = row["آلية التوزيع الهندسية"] || '';
        let color = '#0284C7'; let bg = '#F0F9FF';
        if (mech.includes('يومي')) { color = '#16a34a'; bg = '#F0FDF4'; }
        else if (mech.includes('شهري')) { color = '#ea580c'; bg = '#FFF7ED'; }

        return (
          <span style={{ fontWeight: 800, color: color, backgroundColor: bg, padding: '0.375rem 0.75rem', borderRadius: '8px', fontSize: 'var(--fs-sm)', display: 'inline-flex', alignItems: 'center', gap: '0.3125rem' }}>
            {mech}
          </span>
        );
      }
    }
  ], []);

  return (
    <div className="allocation-dashboard-container" style={{ padding: '1.5625rem', direction: 'rtl', fontFamily: 'inherit' }}>
      
      {/* 🖨️ جزء الطباعة المخفي */}
      <div className="print-only-header phi-print-masthead" style={{ display: 'none' }}>
        <ReportOfficialHeader
          title="تقرير توزيع المصروفات غير المباشرة (Indirect Cost Allocation)"
          subtitle="توزيع وتحميل المصروفات العامة غير المباشرة على الفلل والمشاريع"
          badgeText="تقرير مالي معتمد • FINANCIAL REPORT"
          refLabel="رقم التقرير"
          compact
        />
      </div>

      {/* 🔝 العنوان الرئيسي */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5625rem', flexWrap: 'wrap', gap: '0.9375rem' }}>
        <div>
          <h2 style={{ margin: 0, color: THEME.coffeeDark, fontWeight: 900, fontSize: 'var(--fs-2xl)' }}>لوحة تحكم توزيع وتحميل المصروفات غير المباشرة</h2>
          <p style={{ margin: '0.3125rem 0 0 0', color: '#64748b', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>متابعة ذكية لتفكيك مصاريف الإدارة والتشغيل وتحميلها على الفلل بناءً على مسببات التكلفة وعمالة الموقع بالقرش.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={exportToCSV} className="btn-action-premium" style={{ backgroundColor: '#16a34a', color: 'white', padding: '0.625rem 1.25rem', borderRadius: '12px', border: 'none', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 10px rgba(22,163,74,0.15)' }}>
            تصدير لـ Excel
          </button>
          <button onClick={() => window.print()} className="btn-action-premium" style={{ backgroundColor: THEME.primary, color: 'white', padding: '0.625rem 1.25rem', borderRadius: '12px', border: 'none', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 10px rgba(0,0,0,0.08)' }}>
            طباعة التقرير
          </button>
        </div>
      </div>

      {/* 📊 كروت الإحصائيات الذكية */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13.75rem, 1fr))', gap: '1.25rem', marginBottom: '1.875rem' }}>
        <div className="stat-premium-card" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '14px', borderBottom: `5px solid #ea580c`, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 800, marginBottom: '0.375rem' }}>إجمالي التكاليف المحملة (حسب الفلترة)</span>
          <strong style={{ fontSize: 'var(--fs-2xl)', color: '#ea580c', fontWeight: 900 }}>{formatCurrency(stats.totalAllocated)}</strong>
          <div style={{ height: '0.25rem', backgroundColor: '#fed7aa', borderRadius: '2px', marginTop: '0.9375rem' }} />
        </div>

        <div className="stat-premium-card" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '14px', borderBottom: `5px solid #16a34a`, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 800, marginBottom: '0.375rem' }}>تحميل يومي (عمالة وموقع)</span>
          <strong style={{ fontSize: 'var(--fs-xl)', color: '#16a34a', fontWeight: 900 }}>{formatCurrency(stats.dailyLaborTotal)}</strong>
          <div style={{ fontSize: 'var(--fs-xs)', color: '#16a34a', fontWeight: 800, textAlign: 'left', marginTop: '0.25rem' }}>{stats.dailyLaborPct}%</div>
          <div style={{ height: '0.25rem', backgroundColor: '#e2e8f0', borderRadius: '2px', marginTop: '0.3125rem' }}>
            <div style={{ width: `${stats.dailyLaborPct}%`, height: '100%', backgroundColor: '#16a34a', borderRadius: '2px' }} />
          </div>
        </div>

        <div className="stat-premium-card" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '14px', borderBottom: `5px solid #c2410c`, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 800, marginBottom: '0.375rem' }}>تحميل شهري (بالتساوي)</span>
          <strong style={{ fontSize: 'var(--fs-xl)', color: '#c2410c', fontWeight: 900 }}>{formatCurrency(stats.monthlyEqualTotal)}</strong>
          <div style={{ fontSize: 'var(--fs-xs)', color: '#c2410c', fontWeight: 800, textAlign: 'left', marginTop: '0.25rem' }}>{stats.monthlyEqualPct}%</div>
          <div style={{ height: '0.25rem', backgroundColor: '#e2e8f0', borderRadius: '2px', marginTop: '0.3125rem' }}>
            <div style={{ width: `${stats.monthlyEqualPct}%`, height: '100%', backgroundColor: '#c2410c', borderRadius: '2px' }} />
          </div>
        </div>

        <div className="stat-premium-card" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '14px', borderBottom: `5px solid #0284C7`, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 800, marginBottom: '0.375rem' }}>إطفاء سنوي (إدارة ورواتب المكتب)</span>
          <strong style={{ fontSize: 'var(--fs-xl)', color: '#0284C7', fontWeight: 900 }}>{formatCurrency(stats.annualOfficeTotal)}</strong>
          <div style={{ fontSize: 'var(--fs-xs)', color: '#0284C7', fontWeight: 800, textAlign: 'left', marginTop: '0.25rem' }}>{stats.annualOfficePct}%</div>
          <div style={{ height: '0.25rem', backgroundColor: '#e2e8f0', borderRadius: '2px', marginTop: '0.3125rem' }}>
            <div style={{ width: `${stats.annualOfficePct}%`, height: '100%', backgroundColor: '#0284C7', borderRadius: '2px' }} />
          </div>
        </div>

        <div className="stat-premium-card" style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '14px', borderBottom: `5px solid ${THEME.coffeeDark}`, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 800, marginBottom: '0.3125rem' }}>عدد الفلل المستفيدة</span>
          <strong style={{ fontSize: 'var(--fs-2xl)', color: THEME.coffeeDark, fontWeight: 900 }}>{stats.villasCount} فيلا</strong>
          <div style={{ height: '0.25rem', backgroundColor: '#ebd9c8', borderRadius: '2px', marginTop: '0.9375rem' }} />
        </div>
      </div>

      {/* 🔍 وحدة الفلاتر المتقدمة (تعمل Server-Side) */}
      <div className="glass-card no-print" style={{ padding: '1.375rem', marginBottom: '1.875rem', display: 'flex', gap: '0.9375rem', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#fff', borderRadius: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.01)' }}>
        <div style={{ flex: '2', minWidth: '15.625rem' }}>
          <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 800, color: '#475569', marginBottom: '0.5rem' }}>بحث نصي في الوصف</label>
          <input 
            type="text" 
            placeholder="ابحث في أسطر الجدول الحالي..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', height: '2.75rem', padding: '0 1rem', borderRadius: '12px', border: 'none', background: 'var(--surface-sunken)', boxShadow: 'var(--shadow-sunken)', color: 'var(--text-primary)', fontWeight: 700, outline: 'none', fontSize: 'var(--fs-sm)' }}
          />
        </div>

        <div style={{ flex: '1', minWidth: '8.75rem' }}>
          <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 800, color: '#475569', marginBottom: '0.5rem' }}>الشهر المالي</label>
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={{ width: '100%', height: '2.75rem', padding: '0 1rem', borderRadius: '12px', border: 'none', background: 'var(--surface-sunken)', boxShadow: 'var(--shadow-sunken)', color: 'var(--text-primary)', fontWeight: 800, fontSize: 'var(--fs-sm)' }}>
            {monthsOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div style={{ flex: '1', minWidth: '10rem' }}>
          <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 800, color: '#475569', marginBottom: '0.5rem' }}>الفيلا المستهدفة</label>
          <select value={filterVilla} onChange={(e) => setFilterVilla(e.target.value)} style={{ width: '100%', height: '2.75rem', padding: '0 1rem', borderRadius: '12px', border: 'none', background: 'var(--surface-sunken)', boxShadow: 'var(--shadow-sunken)', color: 'var(--text-primary)', fontWeight: 800, fontSize: 'var(--fs-sm)' }}>
            {villasOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div style={{ flex: '1', minWidth: '10rem' }}>
          <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 800, color: '#475569', marginBottom: '0.5rem' }}>تصنيف المصروف</label>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ width: '100%', height: '2.75rem', padding: '0 1rem', borderRadius: '12px', border: 'none', background: 'var(--surface-sunken)', boxShadow: 'var(--shadow-sunken)', color: 'var(--text-primary)', fontWeight: 800, fontSize: 'var(--fs-sm)' }}>
            {categoriesOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ alignSelf: 'flex-end' }}>
          <button onClick={() => { setSearchQuery(''); setFilterMonth('الكل'); setFilterVilla('الكل'); setFilterCategory('الكل'); }} style={{ padding: '0.75rem 1.375rem', borderRadius: '12px', border: 'none', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 800, cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
            إعادة تعيين
          </button>
        </div>
      </div>

      {/* 📋 جدول البيانات الرئيسي */}
      <div className="glass-card table-premium-container" style={{ padding: '1.875rem', backgroundColor: '#fff', borderRadius: '14px', boxShadow: '0 4px 25px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, color: THEME.coffeeDark, fontWeight: 900, fontSize: 'var(--fs-xl)' }}>السجل التفصيلي لتحميل وتكليفات الفلل بالمصروفات غير المباشرة</h3>
          <button onClick={fetchAllocationData} className="no-print" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-xl)' }} title="تحديث البيانات"><RefreshCw size={15} aria-hidden="true" /></button>
        </div>

        {isLoading ? (
          <LoadingScreen message="جاري سحب وتصفية الداتا مباشرة من السيرفر وبدون تخطي الحدود..." fullScreen={false} />
        ) : filteredData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.75rem', color: '#94a3b8', fontWeight: 900 }}>
            لا توجد سجلات توزيع متطابقة مع خيارات الفلترة الحالية.
          </div>
        ) : (
          <RawasiSmartTable data={filteredData} columns={columns} />
        )}
      </div>

      {/* 📝 كود CSS مدمج للطباعة */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; font-size: 12px !important; }
          .no-print { display: none !important; }
          .print-only-header { display: block !important; }
          .glass-card, .table-premium-container { border: none !important; box-shadow: none !important; padding: 0 !important; }
          span, strong { background: none !important; padding: 0 !important; }
        }
      `}</style>

    </div>
  );
}