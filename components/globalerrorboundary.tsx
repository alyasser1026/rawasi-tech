"use client";
import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';

// الشاشة اللي هتظهر لو حصل أي كراش في السيستم
function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#f7f7f8', fontFamily: "'Cairo', sans-serif", padding: '20px', textAlign: 'center' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '30px', boxShadow: '0 15px 35px rgba(0,0,0,0.05)', maxWidth: '500px', width: '100%', borderTop: '5px solid #be123c' }}>
            <div style={{ fontSize: '50px', marginBottom: '10px' }}>⚠️</div>
            <h2 style={{ color: '#27272a', fontWeight: 900, margin: '0 0 10px 0', fontSize: '24px' }}>عذراً، حدث خطأ غير متوقع!</h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', lineHeight: '1.6' }}>
                نظام فاي تك واجه مشكلة تقنية بسيطة أثناء معالجة البيانات. لا تقلق، لم تفقد بياناتك.
            </p>
            
            {/* عرض الخطأ التقني للمطورين فقط عشان تعرف تصلحه */}
            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', fontSize: '11px', color: '#be123c', textAlign: 'left', direction: 'ltr', overflowX: 'auto', marginBottom: '25px', border: '1px solid #fee2e2' }}>
                <code>{error.message}</code>
            </div>

            <button 
                onClick={resetErrorBoundary} 
                style={{ background: '#c2410c', color: 'white', border: 'none', padding: '15px 30px', borderRadius: '15px', fontWeight: 900, cursor: 'pointer', fontSize: '16px', width: '100%', transition: '0.3s' }}
                onMouseOver={(e) => e.currentTarget.style.background = '#52525b'}
                onMouseOut={(e) => e.currentTarget.style.background = '#c2410c'}
            >
                🔄 إعادة تحميل الصفحة
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