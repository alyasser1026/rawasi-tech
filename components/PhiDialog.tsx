"use client";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialogFocus } from '@/hooks/useDialogFocus';

type PhiDialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  /** When given, the dialog body is a form and Enter / the submit button call it. */
  onSubmit?: () => void;
  /** Buttons on the end side of the footer (cancel is added automatically unless `hideCancel`). */
  footer?: ReactNode;
  /** Totals or status on the start side of the footer. */
  total?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  busy?: boolean;
  cancelLabel?: string;
  hideCancel?: boolean;
};

/** Shared dialog frame: header (icon, title, close), scrollable body and footer, matching the voucher dialogs. */
export default function PhiDialog({ open, onClose, title, subtitle, icon, children, onSubmit, footer, total, size = 'lg', busy = false, cancelLabel = 'إلغاء', hideCancel = false }: PhiDialogProps) {
  const [mounted, setMounted] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useEffect(() => setMounted(true), []);
  useDialogFocus(panel, open && mounted, close);
  if (!open || !mounted) return null;

  const submit = (event: FormEvent) => { event.preventDefault(); if (!busy) onSubmit?.(); };
  const content = <>
    <header className="ent-dialog-header">
      <div className="ent-dialog-title">{icon && <span aria-hidden="true">{icon}</span>}<div><h2 id={`${id}-title`}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>
      <button type="button" className="ent-icon-button" onClick={close} disabled={busy} aria-label="إغلاق"><X size={19} /></button>
    </header>
    <div className="ent-dialog-body">{children}</div>
    {(footer || total || !hideCancel) && <footer className="ent-dialog-footer">
      <div className="ent-dialog-total" aria-live="polite">{total}</div>
      <div>{!hideCancel && <button type="button" className="ent-button" onClick={close} disabled={busy}>{cancelLabel}</button>}{footer}</div>
    </footer>}
  </>;

  return createPortal(<div className="ent-dialog-backdrop no-print" onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className={`ent-voucher-dialog phi-dialog-${size}`} ref={panel} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      {onSubmit ? <form onSubmit={submit}>{content}</form> : <div className="phi-dialog-frame">{content}</div>}
    </div>
  </div>, document.body);
}
