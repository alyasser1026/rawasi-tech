// app/providers.tsx
"use client";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast'; // 🚀 استدعاء التوستر للإشعارات اللحظية

export default function Providers({ children }: { children: React.ReactNode }) {
    // إنشاء نسخة من الـ Query Client مع إعدادات فاي تك
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 1000 * 60 * 5, // الداتا تفضل "طازجة" ومحفوظة لمدة 5 دقائق
                refetchOnWindowFocus: true, // تحديث الداتا تلقائياً لو الموظف رجع للمتصفح
                retry: 2, // لو النت فصل، يحاول يجيب الداتا مرتين كمان
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
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

            {/* أداة فحص ممتازة لك كمهندس تظهر في زاوية الشاشة أثناء التطوير فقط */}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}