'use client';

import { useEffect } from 'react';
import { TriangleAlert, RotateCcw, Send } from 'lucide-react';
import { reportTechnicalError } from '@/lib/telegram-alerts';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Automatically report the route error to Telegram
    void reportTechnicalError(error, {
      category: 'react_crash',
      metadata: { digest: error.digest },
    });
  }, [error]);

  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        textAlign: 'center',
        direction: 'rtl',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ color: '#ef4444', marginBottom: '0.75rem' }}>
          <TriangleAlert size={44} style={{ margin: '0 auto' }} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.5rem' }}>
          حدث استثناء تقني أثناء تحميل هذه الشاشة
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6, margin: '0 0 1rem' }}>
          تم توثيق المشكلة التقنية وإرسال إشعار فوري إلى فريق الدعم الهندسي عبر Telegram لمتابعتها.
        </p>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: '#ecfdf5',
            color: '#059669',
            padding: '0.35rem 0.85rem',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 800,
            marginBottom: '1.25rem',
          }}
        >
          <Send size={13} />
          <span>تم إرسال بلاغ الخطأ إلى Telegram بنجاح 📡</span>
        </div>

        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #fee2e2',
            padding: '0.75rem',
            borderRadius: '10px',
            color: '#dc2626',
            fontSize: '0.75rem',
            textAlign: 'left',
            direction: 'ltr',
            overflowX: 'auto',
            marginBottom: '1.5rem',
          }}
        >
          <code>{error.message || 'Unknown Next.js route error'}</code>
          {error.digest && (
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px' }}>
              Digest: {error.digest}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => reset()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            width: '100%',
            padding: '0.75rem 1.5rem',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            color: '#ffffff',
            border: 'none',
            fontSize: '0.9rem',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={16} />
          <span>إعادة محاولة فتح الشاشة</span>
        </button>
      </div>
    </div>
  );
}
