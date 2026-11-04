import type { ReactNode } from 'react';

export type KpiTone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info';
export type KpiItem = { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: KpiTone };

/** A compact row of summary figures used at the top of screens (wraps on small screens). */
export default function KpiStrip({ items, compact = false, label = 'ملخص الأرقام' }: { items: KpiItem[]; compact?: boolean; label?: string }) {
  return <div className={`phi-kpi-strip${compact ? ' is-compact' : ''}`} role="list" aria-label={label}>
    {items.map(item => <div key={item.label} role="listitem" className={`phi-kpi tone-${item.tone || 'neutral'}`}>
      <div className="phi-kpi-top"><span className="phi-kpi-label">{item.label}</span>{item.icon && <span className="phi-kpi-icon" aria-hidden="true">{item.icon}</span>}</div>
      <strong className="phi-kpi-value">{item.value}</strong>
      {item.hint && <small className="phi-kpi-hint">{item.hint}</small>}
    </div>)}
  </div>;
}
