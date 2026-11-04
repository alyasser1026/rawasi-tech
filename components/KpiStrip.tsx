import type { ReactNode } from 'react';
import { formatCompactCurrency, formatCurrency } from '@/lib/helpers';

export type KpiTone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info';
export type KpiItem = {
  label: string;
  /** Ready-made value (text, count…). Use `amount` instead for money. */
  value?: ReactNode;
  /** Money in SAR: shown in full, or shortened (e.g. "١٫٣ مليون ر.س.") when the card is narrow. */
  amount?: number | null;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: KpiTone;
};

/**
 * A row of summary figures. Each card sizes its number to its own width (container query);
 * money switches to a short form on narrow cards, with the full amount kept for screen readers and on hover.
 */
export default function KpiStrip({ items, compact = false, label = 'ملخص الأرقام' }: { items: KpiItem[]; compact?: boolean; label?: string }) {
  return <div className={`phi-kpi-strip${compact ? ' is-compact' : ''}`} role="list" aria-label={label}>
    {items.map(item => {
      const isMoney = typeof item.amount === 'number' || item.amount === null;
      const full = isMoney ? formatCurrency(item.amount) : item.value;
      const compactText = isMoney ? formatCompactCurrency(item.amount) : null;
      const short = compactText && compactText !== full ? compactText : null;
      const length = typeof full === 'string' ? full.length : 0;
      const fit = length > 20 ? 'xl' : length > 16 ? 'l' : 'm';
      return <div key={item.label} role="listitem" className={`phi-kpi tone-${item.tone || 'neutral'}`} data-fit={short ? fit : undefined}>
        <div className="phi-kpi-top"><span className="phi-kpi-label">{item.label}</span>{item.icon && <span className="phi-kpi-icon" aria-hidden="true">{item.icon}</span>}</div>
        <strong className="phi-kpi-value" title={typeof full === 'string' ? full : undefined}>
          <span className="phi-kpi-full">{full}</span>
          {short && <span className="phi-kpi-short" aria-hidden="true">{short}</span>}
        </strong>
        {item.hint && <small className="phi-kpi-hint">{item.hint}</small>}
      </div>;
    })}
  </div>;
}
