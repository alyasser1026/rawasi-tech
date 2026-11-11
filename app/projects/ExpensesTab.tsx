"use client";
import { currencySymbol } from '@/lib/currency';
import React, { useState, useMemo, useEffect } from 'react';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import RawasiSmartTable from '@/components/rawasismarttable';
import { supabase } from '@/lib/supabase'; // 👈 استدعاء قاعدة البيانات للسحب المباشر
import LoadingScreen from '@/components/LoadingScreen';
import { Search } from 'lucide-react';

export default function ExpensesTab({ logic }: { logic: any }) {
  // 🚀 1. سحب كشف الحساب المباشر من اللوجيك (مصروفات + يوميات فنيين ومساعدين + مستخلصات مقاولي باطن)
  const directLedger = useMemo(() => {
    const expenses = logic.projectDetails?.expenses || [];
    const subClaims = (logic.projectDetails?.subClaims || []).filter((c: any) => c.is_posted !== false);
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

    const expRows = expenses.map((exp: any) => {
      const date = exp.exp_date?.split('T')[0] || exp.created_at?.split('T')[0] || '---';
      const amount = Number(exp.total_price || 0) || (Number(exp.quantity || 0) * Number(exp.unit_price || 0));
      
      let costType = 'مصاريف مباشرة';
      if (exp.row_type === 'labor_direct') {
        costType = exp.is_helper ? 'عمالة مباشرة - يومية مساعدين' : 'عمالة مباشرة - يومية فنيين';
      } else if (exp.main_category?.includes('عمالة')) {
        costType = 'عمالة مباشرة';
      } else if (exp.row_type === 'labor_allocated') {
        costType = 'عمالة موزعة';
      }
      
      const dateObj = new Date(date);
      const financialMonth = isNaN(dateObj.getTime()) ? '---' : `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
      
      return {
        id: exp.id,
        'التاريخ': date,
        'الشهر المالي': financialMonth,
        'نوع التكلفة': costType,
        'البيان / البند': exp.description || exp.payee_name || exp.sub_contractor || 'مصروف عام',
        'التكلفة المحملة (ر.س)': amount,
        attendance_days: Number(exp.attendance_days || 0),
        is_helper: Boolean(exp.is_helper)
      };
    });

    const subClaimRows = subClaims.map((clm: any) => {
      const date = clm.date?.split('T')[0] || clm.created_at?.split('T')[0] || '---';
      const dateObj = new Date(date);
      const financialMonth = isNaN(dateObj.getTime()) ? '---' : `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
      const amount = Number(clm.net_amount || clm.final_amount || 0);
      return {
        id: `clm-${clm.id}`,
        'التاريخ': date,
        'الشهر المالي': financialMonth,
        'نوع التكلفة': 'مستخلص مقاول باطن',
        'البيان / البند': `مستخلص مقاول باطن رقم ${clm.claim_number || '---'}${clm.contractor_name ? ` - ${clm.contractor_name}` : ''} (صرف من الخزينة الرئيسية)`,
        'التكلفة المحملة (ر.س)': amount,
        attendance_days: 0,
        is_helper: false
      };
    });

    return [...expRows, ...subClaimRows];
  }, [logic.projectDetails?.expenses, logic.projectDetails?.subClaims]);

  // 🚀 2. سحب المصروفات الموزعة (ABC) بشكل مستقل لضمان دمجها في كشف الحساب
  const [abcLedger, setAbcLedger] = useState<any[]>([]);
  const [isLoadingAbc, setIsLoadingAbc] = useState(false);

  useEffect(() => {
    if (!logic.selectedProject?.id) return;
    
    const fetchAbcData = async () => {
        setIsLoadingAbc(true);
        const { data } = await supabase
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
                'التكلفة المحملة (ر.س)': Number(item['المبلغ المحمل (ر.س)'] ?? item['المبلغ المحمل (جنيه)'] ?? 0)
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

  // حساب الإجماليات بدقة للكروت العلوية (متضمنة أيام الفنيين وأيام المساعدين ومستخلصات المقاولين)
  const summaryStats = useMemo(() => {
    let total = 0, labor = 0, techLabor = 0, helperLabor = 0, techDays = 0, helperDays = 0, subClaims = 0, overhead = 0, abc = 0;
    filteredLedger.forEach((r: any) => {
      const amt = Number(r['التكلفة المحملة (ر.س)'] || 0);
      total += amt;
      if (r['نوع التكلفة']?.includes('عمالة مباشرة')) {
          labor += amt;
          if (r['نوع التكلفة']?.includes('مساعدين') || r.is_helper) {
              helperLabor += amt;
              helperDays += Number(r.attendance_days || 1);
          } else {
              techLabor += amt;
              techDays += Number(r.attendance_days || 1);
          }
      } else if (r['نوع التكلفة']?.includes('مستخلص مقاول باطن')) {
          subClaims += amt;
      } else if (r['نوع التكلفة']?.includes('ABC')) {
          abc += amt;
      } else {
          overhead += amt;
      }
    });
    return { total, labor, techLabor, helperLabor, techDays, helperDays, subClaims, overhead, abc };
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
        render: (row: any) => <span style={{ fontSize: 'var(--fs-sm)', background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '6px', fontWeight: 900 }}>{row['الشهر المالي']}</span>
    },
    { 
        header: 'نوع التكلفة', 
        render: (row: any) => {
          const typeText = String(row['نوع التكلفة'] || '');
          const isHelperLabor = typeText.includes('مساعدين');
          const isTechLabor = typeText.includes('فنيين') || (typeText.includes('عمالة مباشرة') && !isHelperLabor);
          const isSubClaim = typeText.includes('مستخلص مقاول باطن');
          const isAbc = typeText.includes('ABC');

          let bgColor = '#F3E8FF';
          let textColor = '#6B21A8';
          let label = 'مصاريف مباشرة';

          if (isTechLabor) {
              bgColor = '#E0F2FE';
              textColor = '#0369A1';
              label = '👷 يومية فنيين';
          } else if (isHelperLabor) {
              bgColor = '#CCFBF1';
              textColor = '#0F766E';
              label = '🤝 يومية مساعدين';
          } else if (isSubClaim) {
              bgColor = '#FEF3C7';
              textColor = '#B45309';
              label = '🏗️ مستخلص مقاول باطن';
          } else if (isAbc) {
              bgColor = '#FAE8FF';
              textColor = '#9333EA';
              label = 'موزع (ABC)';
          }

          return (
            <span style={{ 
              backgroundColor: bgColor, 
              color: textColor, 
              padding: '0.375rem 0.75rem', borderRadius: '8px', fontSize: 'var(--fs-xs)', fontWeight: 900 
            }}>
              {label}
            </span>
          );
        }
    },
    { 
        header: 'البيان / اسم البند', 
        render: (row: any) => <strong style={{ color: THEME.coffeeDark, fontSize: 'var(--fs-sm)' }}>{row['البيان / البند']}</strong> 
    },
    { 
        header: `التكلفة المحملة (${currencySymbol()})`, 
        render: (row: any) => {
            const typeText = String(row['نوع التكلفة'] || '');
            const isLabor = typeText.includes('عمالة مباشرة');
            const isSubClaim = typeText.includes('مستخلص مقاول باطن');
            const isAbc = typeText.includes('ABC');
            
            let textColor = '#6B21A8';
            if (isLabor) textColor = '#0369A1';
            if (isSubClaim) textColor = '#B45309';
            if (isAbc) textColor = '#9333EA';

            return (
                <strong style={{ fontSize: 'var(--fs-lg)', color: textColor }}>
                    {formatCurrency(row['التكلفة المحملة (ر.س)'])}
                </strong>
            );
        } 
    }
  ];

  return (
    <div>
      {/* 📊 كروت الإحصائيات العلوية */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '0.9375rem', marginBottom: '1.5625rem' }}>
        
        <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '0.9375rem 1.25rem', borderRadius: '14px', borderBottom: `4px solid ${THEME.danger}`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, marginBottom: '0.3125rem' }}>إجمالي التكلفة الظاهرة</span>
          <strong style={{ fontSize: 'var(--fs-xl)', color: THEME.coffeeDark, fontWeight: 900 }}>{formatCurrency(summaryStats.total)}</strong>
        </div>

        <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '0.9375rem 1.25rem', borderRadius: '14px', borderBottom: `4px solid #0369A1`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: '#0369A1', fontWeight: 900, marginBottom: '0.2rem' }}>👷 يومية الفنيين ({summaryStats.techDays} يوم)</span>
          <strong style={{ fontSize: 'var(--fs-xl)', color: '#0369A1', fontWeight: 900 }}>{formatCurrency(summaryStats.techLabor)}</strong>
        </div>

        <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '0.9375rem 1.25rem', borderRadius: '14px', borderBottom: `4px solid #0F766E`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: '#0F766E', fontWeight: 900, marginBottom: '0.2rem' }}>🤝 يومية المساعدين ({summaryStats.helperDays} يوم)</span>
          <strong style={{ fontSize: 'var(--fs-xl)', color: '#0F766E', fontWeight: 900 }}>{formatCurrency(summaryStats.helperLabor)}</strong>
        </div>

        <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '0.9375rem 1.25rem', borderRadius: '14px', borderBottom: `4px solid #B45309`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: '#B45309', fontWeight: 900, marginBottom: '0.2rem' }}>🏗️ مستخلصات مقاولي الباطن</span>
          <strong style={{ fontSize: 'var(--fs-xl)', color: '#B45309', fontWeight: 900 }}>{formatCurrency(summaryStats.subClaims)}</strong>
        </div>

        <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '0.9375rem 1.25rem', borderRadius: '14px', borderBottom: `4px solid #6B21A8`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, marginBottom: '0.2rem' }}>المصروفات النثرية المباشرة</span>
          <strong style={{ fontSize: 'var(--fs-xl)', color: '#6B21A8', fontWeight: 900 }}>{formatCurrency(summaryStats.overhead)}</strong>
        </div>

        <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '0.9375rem 1.25rem', borderRadius: '14px', borderBottom: `4px solid #9333EA`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 800, marginBottom: '0.2rem' }}>التوزيعات غير المباشرة (ABC)</span>
          <strong style={{ fontSize: 'var(--fs-xl)', color: '#9333EA', fontWeight: 900 }}>{formatCurrency(summaryStats.abc)}</strong>
        </div>

      </div>

      {/* 📋 جدول كشف الحساب الموحد */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1.25rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, color: THEME.coffeeDark, fontWeight: 900, fontSize: 'var(--fs-lg)' }}>
            كشف الحساب الشامل للتكاليف
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9375rem', flexWrap: 'wrap' }}>
            {/* فلتر البحث النصي */}
            <input 
              type="text" 
              placeholder="ابحث في البيان أو البند..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '0.625rem 0.9375rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', fontWeight: 800, outline: 'none', width: '13.75rem', fontSize: 'var(--fs-sm)' }}
            />
            
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              style={{ padding: '0.625rem 1.25rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', fontWeight: 800, backgroundColor: 'white', color: '#1e293b', outline: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}
            >
              <option value="الكل">كل أنواع التكاليف</option>
              <option value="عمالة مباشرة">كل العمالة المباشرة</option>
              <option value="يومية فنيين">👷 يومية الفنيين فقط</option>
              <option value="يومية مساعدين">🤝 يومية المساعدين فقط</option>
              <option value="مستخلص مقاول باطن">🏗️ مستخلصات مقاولي الباطن</option>
              <option value="مصاريف مباشرة">مصاريف نثرية مباشرة فقط</option>
              <option value="ABC">التوزيعات (ABC) فقط</option>
            </select>
          </div>
        </div>

        {isLoadingAbc ? (
            <LoadingScreen message="جاري سحب وتجميع بيانات التوزيع الذكي (ABC)..." fullScreen={false} />
        ) : filteredLedger.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8', fontWeight: 900 }}>
                <div style={{ fontSize: 'var(--fs-display)', marginBottom: '0.625rem' }}><Search size={34} aria-hidden="true" /></div>
                لا توجد تكاليف مطابقة لخيارات البحث.
            </div>
        ) : (
            <RawasiSmartTable data={filteredLedger} columns={columns} />
        )}
      </div>
    </div>
  );
}