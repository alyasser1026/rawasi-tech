"use client";
import React from 'react';
import { formatCurrency } from '@/lib/helpers';
import GlassContainer from '@/components/GlassContainer';

// واجهة البيانات اللي هتيجي من دالة getInvoiceAging
interface AgingStats {
  current: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  over_90: number;
  totalOverdue: number;
  totalOpen: number;
}

export default function InvoiceAgingDashboard({ aging }: { aging: AgingStats }) {
  // لو مفيش ديون خالص، مش هنعرض حاجة
  if (!aging || aging.totalOpen === 0) return null;

  // دالة لحساب النسبة المئوية لكل فئة عشان نظبط عرض الشريط
  const getWidth = (value: number) => `${(value / aging.totalOpen) * 100}%`;

  // 🎨 الألوان المطلوبة للفئات
  const colors = {
    current: '#10b981',    // أخضر
    days_1_30: '#fb923c',  // أصفر
    days_31_60: '#f59e0b', // برتقالي
    days_61_90: '#ef4444', // أحمر
    over_90: '#9f1239',    // أحمر داكن (عنابي)
  };

  return (
    <GlassContainer style={{ marginBottom: '1.5625rem', direction: 'rtl' }}>
      
      {/* 1. العنوان وإجمالي المتأخرات */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1e293b', fontSize: 'var(--fs-xl)', fontWeight: 900 }}>تحليل أعمار الديون</h2>
          <p style={{ margin: '0.3125rem 0 0', color: '#64748b', fontSize: 'var(--fs-sm)' }}>إجمالي الأرصدة المفتوحة: <strong>{formatCurrency(aging.totalOpen)}</strong></p>
        </div>
        <div style={{ background: '#fee2e2', padding: '0.625rem 0.9375rem', borderRadius: '10px', border: '1px solid #fca5a5' }}>
          <span style={{ color: '#991b1b', fontSize: 'var(--fs-sm)', fontWeight: 'bold', display: 'block' }}>إجمالي المتأخرات</span>
          <span style={{ color: '#ef4444', fontSize: 'var(--fs-xl)', fontWeight: 900 }}>{formatCurrency(aging.totalOverdue)}</span>
        </div>
      </div>

      {/* 2. شريط التقدم الملون (Progress Bar) */}
      <div style={{ 
        display: 'flex', width: '100%', height: '1.5rem', 
        borderRadius: '12px', overflow: 'hidden', 
        background: '#e2e8f0', marginBottom: '1.25rem',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {aging.current > 0 && <div style={{ width: getWidth(aging.current), background: colors.current, transition: 'width 0.5s ease' }} title="جاري" />}
        {aging.days_1_30 > 0 && <div style={{ width: getWidth(aging.days_1_30), background: colors.days_1_30, transition: 'width 0.5s ease' }} title="1-30 يوم" />}
        {aging.days_31_60 > 0 && <div style={{ width: getWidth(aging.days_31_60), background: colors.days_31_60, transition: 'width 0.5s ease' }} title="31-60 يوم" />}
        {aging.days_61_90 > 0 && <div style={{ width: getWidth(aging.days_61_90), background: colors.days_61_90, transition: 'width 0.5s ease' }} title="61-90 يوم" />}
        {aging.over_90 > 0 && <div style={{ width: getWidth(aging.over_90), background: colors.over_90, transition: 'width 0.5s ease' }} title="+90 يوم" />}
      </div>

      {/* 3. تفاصيل الأرقام تحت الشريط (Legend) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(7.5rem, 1fr))', gap: '0.625rem' }}>
        <AgingCard title="جاري" amount={aging.current} color={colors.current} />
        <AgingCard title="1 - 30 يوم" amount={aging.days_1_30} color={colors.days_1_30} />
        <AgingCard title="31 - 60 يوم" amount={aging.days_31_60} color={colors.days_31_60} />
        <AgingCard title="61 - 90 يوم" amount={aging.days_61_90} color={colors.days_61_90} />
        <AgingCard title="+90 يوم" amount={aging.over_90} color={colors.over_90} />
      </div>

    </GlassContainer>
  );
}

// مكون فرعي صغير لرسم المربعات اللي تحت الشريط
function AgingCard({ title, amount, color }: { title: string, amount: number, color: string }) {
  if (amount === 0) return null; // لو الفئة دي مفيهاش فلوس، مش هنعرض المربع بتاعها عشان الزحمة
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '0.625rem', background: 'rgba(255,255,255,0.5)', borderRadius: '8px', borderLeft: `4px solid ${color}` }}>
      <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 'bold' }}>{title}</span>
      <span style={{ fontSize: 'var(--fs-md)', color: '#1e293b', fontWeight: 900 }}>{formatCurrency(amount)}</span>
    </div>
  );
}