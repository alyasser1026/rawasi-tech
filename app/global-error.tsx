'use client';

import { useEffect } from 'react';
import { reportTechnicalError } from '@/lib/telegram-alerts';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportTechnicalError(error, {
      level: 'fatal',
      category: 'react_crash',
      metadata: { digest: error.digest, isGlobalLayout: true },
    });
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          background: '#07080b',
          color: '#f8fafc',
          fontFamily: 'Cairo, system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '1.5rem',
        }}
      >
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🚨</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: '0 0 0.5rem' }}>
            استثناء تقني على مستوى النظام الأساسي
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 1rem' }}>
            تم إرسال بلاغ فوري بتقرير الخطأ التقني إلى قناة تيليجرام الهندسية تلقائياً.
          </p>

          <div
            style={{
              background: '#020617',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '0.75rem',
              color: '#f87171',
              fontSize: '0.72rem',
              textAlign: 'left',
              direction: 'ltr',
              overflowX: 'auto',
              marginBottom: '1.5rem',
            }}
          >
            <code>{error.message || 'Fatal Root Exception'}</code>
          </div>

          <button
            type="button"
            onClick={() => reset()}
            style={{
              width: '100%',
              padding: '0.75rem 1.5rem',
              borderRadius: '10px',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            إعادة تشغيل النظام
          </button>
        </div>
      </body>
    </html>
  );
}
