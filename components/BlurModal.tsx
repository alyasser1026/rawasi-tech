"use client";
import { useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useDialogFocus } from '@/hooks/useDialogFocus';

interface BlurModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function BlurModal({ isOpen, onClose, title, children }: BlurModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFocus(panel, isOpen, onClose);
  if (!isOpen) return null;

  return (
    <div className="phi-modal-backdrop phi-blur-modal-backdrop">
      <div className="phi-modal-panel phi-blur-modal" ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="phi-blur-modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button type="button" onClick={onClose} className="ent-icon-button" aria-label="إغلاق النافذة"><X size={19} /></button>
        </header>
        {children}
      </div>
    </div>
  );
}