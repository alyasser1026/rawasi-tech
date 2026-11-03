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
                toastOptions={{
                    duration: 4000, // مدة ظهور الرسالة
                    style: {
                        background: '#27272a', // لون القهوة الداكن
                        color: '#fff',
                        borderRadius: '15px',
                        fontFamily: "'Cairo', sans-serif",
                        fontWeight: 700,
                        border: '1px solid #c2410c', // إطار ذهبي أنيق
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                    },
                    success: {
                        iconTheme: { primary: '#166534', secondary: '#fff' }, // لون النجاح الأخضر
                    },
                    error: {
                        iconTheme: { primary: '#be123c', secondary: '#fff' }, // لون الخطأ الأحمر
                    },
                    loading: {
                        iconTheme: { primary: '#c2410c', secondary: '#fff' }, // لون التحميل الذهبي
                    }
                }}
            />

            {/* أداة فحص ممتازة لك كمهندس تظهر في زاوية الشاشة أثناء التطوير فقط */}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}