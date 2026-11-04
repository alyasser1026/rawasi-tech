"use client";
import React, { useEffect } from 'react';
import { THEME } from '@/lib/theme';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function RawasiToast({ message, type, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  // تحديد الأيقونة واللون بناءً على النوع
  const config = {
    success: { icon: '✅', color: '#10b981', bg: 'rgba(209, 250, 229, 0.9)' },
    error: { icon: '❌', color: '#ef4444', bg: 'rgba(254, 226, 226, 0.9)' },
    warning: { icon: '⚠️', color: '#f59e0b', bg: 'rgba(254, 243, 199, 0.9)' },
    info: { icon: 'ℹ️', color: '#3b82f6', bg: 'rgba(219, 234, 254, 0.9)' },
  }[type];

  return (
    <>
      <style>{`
        .toast-container {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 99999;
          animation: slideDown 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          pointer-events: none;
        }
        .toast-content {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 12px 24px;
          border-radius: 14px;
          background: ${config.bg};
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.6);
          box-shadow: 0 15px 35px rgba(0,0,0,0.1);
          color: #1e293b;
          font-weight: 800;
          font-size: var(--fs-md);
          min-width: 300px;
          pointer-events: auto;
          direction: rtl;
        }
        .toast-icon {
          font-size: var(--fs-xl);
        }
        .toast-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: ${config.color};
          border-radius: 0 0 14px 14px;
          animation: progress linear forwards;
          animation-duration: ${duration}ms;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translate(-50%, -40px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
        @media (max-width: 768px) {
          .toast-content { min-width: 90vw; }
        }
      `}</style>

      <div className="toast-container" onClick={onClose}>
        <div className="toast-content">
          <span className="toast-icon">{config.icon}</span>
          <span className="toast-message">{message}</span>
          <div className="toast-progress" />
        </div>
      </div>
    </>
  );
}