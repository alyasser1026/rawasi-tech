import React from 'react';
import { THEME } from '@/lib/theme';

export function StatusBadge({ status }: { status: string }) {
  let color = '#555'; let bg = '#eee';
  if (!status) return null;
  if (status.includes('تجهيز') || status.includes('دراسة')) { color = '#c2410c'; bg = '#FEF9C3'; }
  else if (status.includes('تنفيذ') || status.includes('جاري') || status.includes('معتمد')) { color = '#166534'; bg = '#DCFCE7'; }
  else if (status.includes('مؤقتا')) { color = '#9a3412'; bg = '#ffedd5'; }
  else if (status.includes('توقف') || status.includes('مرفوض') || status.includes('خطأ')) { color = '#991B1B'; bg = '#FEE2E2'; } 
  else if (status.includes('منتهي') || status.includes('مكتمل')) { color = '#1e40af'; bg = '#dbeafe'; }
  return <span style={{ backgroundColor: bg, color: color, padding: '0.25rem 0.625rem', borderRadius: '6px', fontSize: 'var(--fs-xs)', fontWeight: 900 }}>{status}</span>;
}

export function KpiCard({ title, value, color, alert }: any) {
  return (
    <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', padding: '1.5625rem', borderRadius: '14px', borderBottom: `4px solid ${color}`, boxShadow: '0 4px 15px rgba(0,0,0,0.03)', position: 'relative' }}>
      <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 800, marginBottom: '0.625rem' }}>{title}</span>
      <strong style={{ fontSize: 'var(--fs-2xl)', color: color, fontWeight: 900 }}>{Number(value || 0).toLocaleString()} <span style={{fontSize:'var(--fs-md)'}}>ج.م</span></strong>
      {alert && <div style={{ fontSize: 'var(--fs-xs)', color: color, marginTop: '0.5rem', fontWeight: 800, backgroundColor: 'rgba(255,255,255,0.8)', padding: '0.375rem', borderRadius: '8px' }}>{alert}</div>}
    </div>
  );
}

export function ProgressBar({ label, percentage, color }: any) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: 'var(--fs-sm)', fontWeight: 800, color: THEME.coffeeDark }}>
        <span>{label}</span><span>{percentage}%</span>
      </div>
      <div style={{ height: '0.875rem', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '20px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%`, height: '100%', backgroundColor: color, borderRadius: '14px', transition: 'width 1s ease-in-out' }}></div>
      </div>
    </div>
  );
}

export function TabButton({ active, onClick, text }: any) {
  return (
      <button onClick={onClick} style={{ 
          padding: '0.75rem 1.5625rem', borderRadius: '14px', border: 'none', fontWeight: 900, cursor: 'pointer', transition: '0.3s', 
          backgroundColor: active ? THEME.coffeeDark : 'rgba(255,255,255,0.6)', 
          color: active ? THEME.goldAccent : THEME.coffeeMain, 
          boxShadow: active ? '0 10px 20px rgba(45,34,30,0.15)' : 'none',
          whiteSpace: 'nowrap'
      }}>
          {text}
      </button>
  );
}