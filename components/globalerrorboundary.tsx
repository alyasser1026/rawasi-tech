"use client";
import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { TriangleAlert, Send } from 'lucide-react';
import { reportTechnicalError } from '@/lib/telegram-alerts';

// الشاشة اللي هتظهر لو حصل أي كراش في السيستم
function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#090d16', fontFamily: "'Cairo', sans-serif", padding: '1.25rem', textAlign: 'center', direction: 'rtl' }}>
        <div style={{ background: '#0f172a', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', maxWidth: '34rem', width: '100%', borderTop: '5px solid #be123c', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 'var(--fs-display)', marginBottom: '0.625rem', color: '#ef4444' }}><TriangleAlert size={42} aria-hidden="true" /></div>
            <h2 style={{ color: '#f8fafc', fontWeight: 900, margin: '0 0 0.625rem 0', fontSize: '1.35rem' }}>عذراً، حدث استثناء تقني غير متوقع!</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: '1.6' }}>
                نظام فاي تك واجه مشكلة تقنية غير متوقعة أثناء عرض الواجهة. لا تقلق، لم تفقد بياناتك المسجلة.
            </p>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: 'rgba(5, 150, 105, 0.12)', color: '#34d399', padding: '0.45rem 0.95rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 800, marginBottom: '1.25rem', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
                <Send size={13} />
                <span>تم إرسال تفاصيل الخطأ التقني تلقائياً إلى مطوري النظام عبر Telegram 📡</span>
            </div>
            
            {/* عرض الخطأ التقني */}
            <div style={{ background: '#020617', padding: '0.9375rem', borderRadius: '10px', fontSize: '0.75rem', color: '#f87171', textAlign: 'left', direction: 'ltr', overflowX: 'auto', marginBottom: '1.5625rem', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                <code>{error?.message || String(error)}</code>
            </div>

            <button 
                onClick={resetErrorBoundary} 
                style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: 'white', border: 'none', padding: '0.85rem 1.875rem', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', fontSize: '0.95rem', width: '100%', transition: '0.2s', boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)' }}
            >
                إعادة المحاولة وتحميل الصفحة
            </button>
        </div>
    </div>
  );
}

export default function GlobalErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => {
        void reportTechnicalError(error, {
          category: 'react_crash',
          componentStack: info?.componentStack ?? undefined,
        });
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
