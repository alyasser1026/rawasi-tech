"use client";

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function WorkspaceDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]') || []);
    (panel.current?.querySelector<HTMLElement>('[data-autofocus]') || focusable()[0] || panel.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey, true);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="workspace-dialog-backdrop no-print" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="workspace-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel} tabIndex={-1} dir="rtl">
        <div className="workspace-dialog-heading">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="workspace-button" onClick={onClose} aria-label="إغلاق النافذة">✕</button>
        </div>
        {children}
      </div>
    </div>, document.body
  );
}
