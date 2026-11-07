"use client";
import React from 'react';

interface LoadingScreenProps {
    message?: string;
    subMessage?: string;
    fullScreen?: boolean;
}

export default function LoadingScreen({ 
    message = 'جاري معالجة البيانات...', 
    subMessage = 'يرجى الانتظار لحين اكتمال التحميل',
    fullScreen = true 
}: LoadingScreenProps) {
    const containerStyle: React.CSSProperties = fullScreen ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-canvas)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 9999,
        direction: 'rtl'
    } : {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '18.75rem',
        width: '100%',
        padding: '2.5rem 1.5rem',
        borderRadius: '16px',
        backgroundColor: 'transparent', // 🚀 إزالة اللون الرصاصي تماماً ليتناغم مع الكانفاس الداكن والأوبسيديان
        border: 'none',
        boxShadow: 'none',
        direction: 'rtl'
    };

    return (
        <div style={containerStyle} className="fade-in rawasi-loading-screen">
            {/* الدائرة المتحركة الاحترافية بتوهج عنبري ناصع */}
            <div style={{ position: 'relative', width: '4.5rem', height: '4.5rem', marginBottom: '1.5rem' }}>
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    borderRadius: '50%',
                    border: '3.5px solid rgba(249, 115, 22, 0.15)',
                    borderTopColor: 'var(--accent-main)',
                    animation: 'spin 1.1s cubic-bezier(0.5, 0, 0.5, 1) infinite',
                    boxShadow: '0 0 20px rgba(249, 115, 22, 0.15)'
                }} />
                
                {/* نقطة النبض المركزية */}
                <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '1.5rem', height: '1.5rem',
                    backgroundColor: 'var(--accent-main)',
                    borderRadius: '50%',
                    boxShadow: '0 0 16px rgba(249, 115, 22, 0.5)',
                    animation: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                }} />
            </div>

            {/* النصوص الجمالية بتدرج كهرماني ناصع وخط لؤلؤي دافئ */}
            <h2 style={{
                color: 'var(--text-primary)',
                fontWeight: 900,
                fontSize: '1.35rem',
                margin: 0,
                marginBottom: '0.5rem',
                textShadow: '0 2px 14px rgba(249, 115, 22, 0.25)',
                letterSpacing: '-0.3px',
                textAlign: 'center'
            }}>
                {message}
            </h2>
            <p style={{
                color: 'var(--text-secondary, #ede5da)',
                fontWeight: 600,
                fontSize: '0.95rem',
                margin: 0,
                opacity: 0.85,
                textAlign: 'center'
            }}>
                {subMessage}
            </p>

            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    50% { opacity: 0.45; transform: translate(-50%, -50%) scale(0.8); }
                }
                .fade-in {
                    animation: fadeIn 0.35s ease-out forwards;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
