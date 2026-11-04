"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import RawasiSmartTable from '@/components/rawasismarttable';
import { supabase } from '@/lib/supabase'; // 👈 استدعاء قاعدة البيانات للسحب المباشر
import LoadingScreen from '@/components/LoadingScreen';
import { Search } from 'lucide-react';

export default function ExpensesTab({ logic }: { logic: any }) {
  // 🚀 1. سحب كشف الحساب المباشر من اللوجيك
  const directLedger = useMemo(() => {
    const expenses = logic.projectDetails?.expenses || [];
    return expenses.map((exp: any) => {
      const date = exp.exp_date?.split('T')[0] || exp.created_at?.split('T')[0] || '---';
      const amount = Number(exp.total_price || 0) || (Number(exp.quantity || 0) * Number(exp.unit_price || 0));
      
      let costType = 'مصاريف مباشرة';
      if (exp.row_type === 'labor_direct' || exp.main_category?.includes('عمالة')) {
        costType = 'عمالة مباشرة';
      } else if (exp.row_type === 'labor_allocated') {
        costType = 'عمالة موزعة';
      }
      
      const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      const dateObj = new Date(date);
      const financialMonth = isNaN(dateObj.getTime()) ? '---' : `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
      
      return {
        id: exp.id,
        'التاريخ': date,
        'الشهر المالي': financialMonth,
        'نوع التكلفة': costType,
        'البيان / البند': exp.description || exp.payee_name || exp.sub_contractor || 'مصروف عام',
        'التكلفة المحملة (جنيه)': amount
      };
    });
  }, [logic.projectDetails?.expenses]);

  // 🚀 2. سحب المصروفات الموزعة (ABC) بشكل مستقل لضمان دمجها في كشف الحساب
  const [abcLedger, setAbcLedger] = useState<any[]>([]);
  const [isLoadingAbc, setIsLoadingAbc] = useState(false);

  useEffect(() => {
    if (!logic.selectedProject?.id) return;
    
    const fetchAbcData = async () => {
        setIsLoadingAbc(true);
        const { data, error } = await supabase
            .from('advanced_cost_allocation_view')
            .select('*')
            .eq('project_id', logic.selectedProject.id);
        
        if (data) {
            const mappedAbc = data.map((item: any) => ({
                'id': item.id,
                'التاريخ': item['تاريخ المصروف الأصلي']?.split('T')[0] || '---',
                'الشهر المالي': item['شهر التحميل المالي'] || '---',
                'نوع التكلفة': 'توزيعات غير مباشرة (ABC)',
                'البيان / البند': `[بند: ${item['البند المحمل عليه'] || 'المشروع عام'}] - ${item['البيان / الوصف']}`,
                'التكلفة المحملة (جنيه)': Number(item['المبلغ المحمل (جنيه)'] || 0)
            }));
            setAbcLedger(mappedAbc);
        }
        setIsLoadingAbc(false);
    };

    fetchAbcData();
  }, [logic.selectedProject?.id]);

  // 🎯 3. الدمج الذكي بين الكشفين وترتيبهم بالتاريخ الأحدث
  const combinedLedger = useMemo(() => {
    return [...directLedger, ...abcLedger].sort((a: any, b: any) => {
        return new Date(b['التاريخ']).getTime() - new Date(a['التاريخ']).getTime();
    });
  }, [directLedger, abcLedger]);

  // فلاتر البحث والنوع
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('الكل');

  // تصفية كشف الحساب بناءً على الفلاتر
  const filteredLedger = useMemo(() => {
    return combinedLedger.filter((row: any) => {
      const matchSearch = row['البيان / البند']?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterType === 'الكل' || row['نوع التكلفة']?.includes(filterType);
      return matchSearch && matchType;
    });
  }, [combinedLedger, searchQuery, filterType]);

  // حساب الإجماليات بدقة للكروت العلوية (متضمنة التوزيعات الجديدة)
  const summaryStats = useMemo(() => {
    let total = 0, labor = 0, overhead = 0, abc = 0;
    filteredLedger.forEach((r: any) => {
      const amt = Number(r['التكلفة المحملة (جنيه)'] || 0);
      total += amt;
      if (r['نوع التكلفة']?.includes('عمالة مباشرة')) {
          labor += amt;
      } else if (r['نوع التكلفة']?.includes('ABC')) {
          abc += amt;
      } else {
          overhead += amt;
      }
    });
    return { total, labor, overhead, abc };
  }, [filteredLedger]);

  // إعداد أعمدة الجدول
  const columns = [
    { 
        header: 'التاريخ', 
        accessor: 'التاريخ',
        render: (row: any) => <span style={{ fontWeight: 800, color: '#475569' }}>{row['التاريخ']}</span> 
    },
    { 
        header: 'الشهر المالي', 
        accessor: 'الشهر المالي',
        render: (row: any) => <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontWeight: 900 }}>{row['الشهر المالي']}</span>
    },
    { 
        header: 'نوع التكلفة', 
        render: (row: any) => {
          const isLabor = row['نوع التكلفة']?.includes('عمالة مباشرة');
          const isAbc = row['نوع التكلفة']?.includes('ABC');

          let bgColor = '#F3E8FF';
          let textColor = '#6B21A8';
          let label = 'مصاريف مباشرة';

          if (isLabor) {
              bgColor = '#E0F2FE';
              textColor = '#0369A1';
              label = 'عمالة مباشرة';
          } else if (isAbc) {
              bgColor = '#FAE8FF';
              textColor = '#9333EA';
              label = 'موزع (ABC)';
          }

          return (
            <span style={{ 
              backgroundColor: bgColor, 
              color: textColor, 
              padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 900 
            }}>
              {label}
            </span>
          );
        }
    },
    { 
        header: 'البيان / اسم البند', 
        render: (row: any) => <strong style={{ color: THEME.coffeeDark, fontSize: '13px' }}>{row['البيان / البند']}</strong> 
    },
    { 
        header: 'التكلفة المحملة', 
        render: (row: any) => {
            const isLabor = row['نوع التكلفة']?.includes('عمالة مباشرة');
            const isAbc = row['نوع التكلفة']?.includes('ABC');
            
            let textColor = '#6B21A8';
            if (isLabor) textColor = '#0369A1';
            if (isAbc) textColor = '#9333EA';

            return (
                <strong style={{ fontSize: '15px', color: textColor }}>
                    {formatCurrency(row['التكلفة المحملة (جنيه)'])}
                </strong>
            );
        } 
    }
  ];

  return (
    <div>
      {/* 📊 كروت الإحصائيات العلوية */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '25px' }}>
        
        <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '15px 20px', borderRadius: '14px', borderBottom: `4px solid ${THEME.danger}`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 800, marginBottom: '5px' }}>إجمالي التكلفة الظاهرة</span>
          <strong style={{ fontSize: '22px', color: THEME.coffeeDark, fontWeight: 900 }}>{formatCurrency(summaryStats.total)}</strong>
        </div>

        <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '15px 20px', borderRadius: '14px', borderBottom: `4px solid #0369A1`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 800, marginBottom: '5px' }}>أجور العمالة المباشرة</span>
          <strong style={{ fontSize: '22px', color: '#0369A1', fontWeight: 900 }}>{formatCurrency(summaryStats.labor)}</strong>
        </div>

        <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '15px 20px', borderRadius: '14px', borderBottom: `4px solid #6B21A8`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 800, marginBottom: '5px' }}>المصروفات المباشرة</span>
          <strong style={{ fontSize: '22px', color: '#6B21A8', fontWeight: 900 }}>{formatCurrency(summaryStats.overhead)}</strong>
        </div>

        {/* 🚀 الكارت الجديد لتجميع توزيعات ABC فقط */}
        <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '15px 20px', borderRadius: '14px', borderBottom: `4px solid #9333EA`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 800, marginBottom: '5px' }}>التوزيعات غير المباشرة (ABC)</span>
          <strong style={{ fontSize: '22px', color: '#9333EA', fontWeight: 900 }}>{formatCurrency(summaryStats.abc)}</strong>
        </div>

      </div>

      {/* 📋 جدول كشف الحساب الموحد */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '20px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, color: THEME.coffeeDark, fontWeight: 900, fontSize: '16px' }}>
            كشف الحساب الشامل للتكاليف
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            {/* فلتر البحث النصي */}
            <input 
              type="text" 
              placeholder="ابحث في البيان أو البند..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '10px 15px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', fontWeight: 800, outline: 'none', width: '220px', fontSize: '13px' }}
            />
            
            {/* 🚀 فلتر نوع التكلفة بعد إضافة ABC */}
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', fontWeight: 800, backgroundColor: 'white', color: '#1e293b', outline: 'none', cursor: 'pointer', fontSize: '13px' }}
            >
              <option value="الكل">كل أنواع التكاليف</option>
              <option value="عمالة مباشرة">عمالة مباشرة فقط</option>
              <option value="تشغيل وأوفر هيد">مصاريف مباشرة فقط</option>
              <option value="ABC">التوزيعات (ABC) فقط</option>
            </select>
          </div>
        </div>

        {isLoadingAbc ? (
            <LoadingScreen message="جاري سحب وتجميع بيانات التوزيع الذكي (ABC)..." fullScreen={false} />
        ) : filteredLedger.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontWeight: 900 }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}><Search size={34} aria-hidden="true" /></div>
                لا توجد تكاليف مطابقة لخيارات البحث.
            </div>
        ) : (
            <RawasiSmartTable data={filteredLedger} columns={columns} />
        )}
      </div>
    </div>
  );
}