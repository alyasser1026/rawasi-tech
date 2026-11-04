"use client";
import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { TriangleAlert } from 'lucide-react';

// الشاشة اللي هتظهر لو حصل أي كراش في السيستم
function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#f7f7f8', fontFamily: "'Cairo', sans-serif", padding: '1.25rem', textAlign: 'center' }}>
        <div style={{ background: 'white', padding: '2.5rem', borderRadius: '14px', boxShadow: '0 15px 35px rgba(0,0,0,0.05)', maxWidth: '31.25rem', width: '100%', borderTop: '5px solid #be123c' }}>
            <div style={{ fontSize: 'var(--fs-display)', marginBottom: '0.625rem' }}><TriangleAlert size={40} aria-hidden="true" /></div>
            <h2 style={{ color: '#27272a', fontWeight: 900, margin: '0 0 0.625rem 0', fontSize: 'var(--fs-2xl)' }}>عذراً، حدث خطأ غير متوقع!</h2>
            <p style={{ color: '#64748b', fontSize: 'var(--fs-md)', marginBottom: '1.25rem', lineHeight: '1.6' }}>
                نظام فاي تك واجه مشكلة تقنية بسيطة أثناء معالجة البيانات. لا تقلق، لم تفقد بياناتك.
            </p>
            
            {/* عرض الخطأ التقني للمطورين فقط عشان تعرف تصلحه */}
            <div style={{ background: '#f8fafc', padding: '0.9375rem', borderRadius: '10px', fontSize: 'var(--fs-xs)', color: '#be123c', textAlign: 'left', direction: 'ltr', overflowX: 'auto', marginBottom: '1.5625rem', border: '1px solid #fee2e2' }}>
                <code>{error.message}</code>
            </div>

            <button 
                onClick={resetErrorBoundary} 
                style={{ background: '#c2410c', color: 'white', border: 'none', padding: '0.9375rem 1.875rem', borderRadius: '15px', fontWeight: 900, cursor: 'pointer', fontSize: 'var(--fs-lg)', width: '100%', transition: '0.3s' }}
                onMouseOver={(e) => e.currentTarget.style.background = '#52525b'}
                onMouseOut={(e) => e.currentTarget.style.background = '#c2410c'}
            >
                إعادة تحميل الصفحة
            </button>
        </div>
    </div>
  );
}

export default function GlobalErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ErrorBoundary>
  );
}