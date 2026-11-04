// app/reports/page.tsx
"use client";
import React from 'react';
import { useReportsLogic } from './reports_logic';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import { Hourglass, Users } from 'lucide-react';
import PhiIcon from '@/components/PhiIcon';

export default function ReportsPage() {
  // نقطة الاستدعاء (Single Source)
  const logic = useReportsLogic();

  // جسر الترحيل: الأزرار الجانبية
  const sidebarActions = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
      <button 
        className="btn-main-glass blue" 
        onClick={logic.handleRefresh}
        disabled={logic.isLoading}
      >
        {logic.isLoading ? 'جاري التحديث...' : 'تحديث البيانات اللحظية'}
      </button>
      <button 
        className="btn-main-glass white" 
        onClick={() => window.print()}
      >
        طباعة التقرير
      </button>
    </div>
  );

  return (
    <div className="clean-page">
      <MasterPage 
        title="مركز القيادة والتقارير الشاملة" 
        subtitle="نظرة مالية وإدارية حية لجميع الموديولات (معتمد / معلق)"
      >
        <RawasiSidebarManager 
          actions={sidebarActions}
          summary={
            <div className="summary-glass-card">
              <span style={{fontSize:'var(--fs-sm)', fontWeight:800, color:'#64748b'}}>نطاق التقرير</span>
              <div style={{fontSize:'var(--fs-xs)', color: THEME.primary, fontWeight:900, marginTop:'0.3125rem'}}>
                من: {logic.dateRange.start} <br/> إلى: {logic.dateRange.end}
              </div>
            </div>
          }
        />

        {/* 📅 شريط الفلاتر الذكي */}
        <div style={{ display: 'flex', gap: '0.9375rem', marginBottom: '1.5625rem', background: 'rgba(255,255,255,0.2)', backdropFilter: `blur(${THEME.glass.blur})`, padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.3)', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3125rem' }}>
            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#475569' }}>من تاريخ:</label>
            <input 
              type="date" 
              value={logic.dateRange.start} 
              onChange={(e) => logic.handleDateChange('start', e.target.value)} 
              style={{ padding: '0.625rem 0.9375rem', borderRadius: '12px', border: 'none', outline: 'none', fontWeight: 800, background: 'rgba(255,255,255,0.7)' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3125rem' }}>
            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#475569' }}>إلى تاريخ:</label>
            <input 
              type="date" 
              value={logic.dateRange.end} 
              onChange={(e) => logic.handleDateChange('end', e.target.value)} 
              style={{ padding: '0.625rem 0.9375rem', borderRadius: '12px', border: 'none', outline: 'none', fontWeight: 800, background: 'rgba(255,255,255,0.7)' }}
            />
          </div>
        </div>

        <style>{`
          .btn-main-glass { width: 100%; padding: 0.875rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(15px); font-weight: 900; cursor: pointer; transition: 0.2s; font-size: var(--fs-sm); display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
          .btn-main-glass.blue { background: linear-gradient(135deg, rgba(14, 165, 233, 0.8), rgba(2, 132, 199, 0.9)); color: white; }
          .btn-main-glass.white { background: rgba(255, 255, 255, 0.6); color: #1e293b; border: 1px solid rgba(255,255,255,0.8); }
          .btn-main-glass:hover { transform: translateY(-3px); filter: brightness(1.1); }
          .summary-glass-card { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 1.25rem; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.2); margin-bottom: 1.5625rem; }
        `}</style>

        {logic.isLoading ? (
          <div style={{ textAlign: 'center', padding: '6.25rem', fontWeight: 900, color: '#64748b' }}>
            <div style={{ fontSize: 'var(--fs-display)', marginBottom: '0.9375rem' }}><Hourglass size={34} aria-hidden="true" /></div>
            جاري استدعاء البيانات المالية والتشغيلية...
          </div>
        ) : !logic.reportData ? (
          <div style={{ textAlign: 'center', padding: '3.125rem', color: THEME.ruby, fontWeight: 900 }}>
            لا توجد بيانات متاحة لهذا النطاق الزمني.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(17.5rem, 1fr))', gap: '1.25rem' }}>
            
            <ReportCard 
              title="إجمالي المصروفات التشغيلية" 
              data={logic.reportData.expenses} 
              icon="💸" 
              color="#ef4444" 
            />
            
            <ReportCard 
              title="إيرادات (فواتير العملاء)" 
              data={logic.reportData.invoices} 
              icon="🧾" 
              color="#10b981" 
            />
            
            <ReportCard 
              title="سندات الصرف (المدفوعات)" 
              data={logic.reportData.payment_vouchers} 
              icon="🏦" 
              color="#f59e0b" 
            />
            
            <ReportCard 
              title="سندات القبض (المتحصلات)" 
              data={logic.reportData.receipt_vouchers} 
              icon="💰" 
              color="#0ea5e9" 
            />
            
            <ReportCard 
              title="تكلفة العمالة اليومية" 
              data={logic.reportData.labor} 
              icon="👷" 
              color="#8b5cf6" 
            />

            {/* بطاقة خاصة لشؤون الموظفين (لا تتبع نفس النمط معتمد/معلق) */}
            <div className="premium-card module-card">
              <div className="module-header">
                <div className="module-icon purple"><Users size={16} aria-hidden="true" /></div>
                <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', color: '#1e293b', fontWeight: 900 }}>شؤون الموظفين (معتمد فقط)</h3>
                <span style={{ fontSize: 'var(--fs-2xl)' }}><Users size={20} aria-hidden="true" /></span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: 'var(--fs-sm)', fontWeight: 800 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>إجمالي السلف:</span>
                  <span style={{ color: '#f59e0b' }}>{formatCurrency(logic.reportData.hr.advances)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>إجمالي الخصومات:</span>
                  <span style={{ color: '#ef4444' }}>{formatCurrency(logic.reportData.hr.deductions)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>إجمالي المخالفات:</span>
                  <span style={{ color: '#8b5cf6' }}>{formatCurrency(logic.reportData.hr.violations)}</span>
                </div>
              </div>
            </div>

          </div>
        )}
      </MasterPage>
    </div>
  );
}

// 🃏 مكون فرعي لتوحيد شكل الكروت (مدمج هنا لتجنب تشتت الملفات)
function ReportCard({ title, data, icon, color }: { title: string, data: any, icon: string, color: string }) {
  if (!data) return null; // حارس الرندر

  return (
    <div style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: `blur(${THEME.glass.blur})`, padding: '1.5rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-0.625rem', right: '-0.625rem', fontSize: 'var(--fs-display)', opacity: 0.05, transform: 'rotate(15deg)' }}><PhiIcon value={icon} size={96} /></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', color: '#1e293b', fontWeight: 900, zIndex: 2 }}>{title}</h3>
        <span style={{ display: 'inline-flex', zIndex: 2 }}><PhiIcon value={icon} size={22} /></span>
      </div>
      <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 900, color: color, margin: '1.25rem 0', zIndex: 2, position: 'relative' }}>
        {formatCurrency(data.total)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: '0.9375rem', zIndex: 2, position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: '#94a3b8', fontSize: 'var(--fs-xs)' }}>معتمد ومعتمد</span>
          <span style={{ color: '#059669', fontWeight: 900 }}>{formatCurrency(data.posted)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <span style={{ color: '#94a3b8', fontSize: 'var(--fs-xs)' }}>معلق / مسودة</span>
          <span style={{ color: '#d97706', fontWeight: 900 }}>{formatCurrency(data.pending)}</span>
        </div>
      </div>
    </div>
  );
}