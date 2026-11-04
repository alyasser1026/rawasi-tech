import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

export default function GlassModalWrapper({ children, isOpen, onClose }: any) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="phi-modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 999999999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'rgba(40, 24, 10, 0.85)', backdropFilter: 'blur(10px)', padding: '50px 20px', overflowY: 'auto' }}>
      <div style={{ position: 'fixed', inset: 0 }} onClick={onClose} />
      <div style={{ width: '100%', maxWidth: '980px', position: 'relative', margin: 'auto', zIndex: 10 }}>
        {children}
      </div>
    </div>,
    document.body
  );
}
