// app/providers.tsx
"use client";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}

            {/* 🎨 إعدادات التنبيهات بستايل فاي تك الفخم */}
            <Toaster
                position="top-center"
                gutter={10}
                containerStyle={{ top: 20, zIndex: 2147483600 }}
                toastOptions={{
                    duration: 4000,
                    className: 'phi-toast',
                    style: {
                        background: '#ffffff',
                        color: '#202329',
                        border: '1px solid #e2e6ec',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        maxWidth: '440px',
                        fontFamily: 'inherit',
                        fontSize: '13px',
                        fontWeight: 600,
                        lineHeight: 1.6,
                        direction: 'rtl',
                        whiteSpace: 'pre-line',
                        boxShadow: '0 1px 2px #25344a0f, 0 12px 28px -10px #38445d33'
                    },
                    success: { iconTheme: { primary: '#047857', secondary: '#ffffff' } },
                    error: { iconTheme: { primary: '#be123c', secondary: '#ffffff' } },
                    loading: { iconTheme: { primary: '#c2410c', secondary: '#ffedd5' } }
                }}
            />

            <ReactQueryDevtools initialIsOpen={false} />
        </>
    );
}
