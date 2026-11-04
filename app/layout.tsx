import LayoutClient from '../components/layout/LayoutClient';
import "./phi-fonts.css";
import "./globals.css";
import "./phi-scale.css";
import "./workspace.css";
import "./brand.css";
import "./enterprise.css";
import "./enterprise-content.css";
import "./enterprise-dialogs.css";
import "./enterprise-layout.css";
import AutoLogoutWrapper from '../components/AutoLogoutWrapper';
import Providers from './providers';
import NextTopLoader from 'nextjs-toploader';
import GlobalErrorBoundary from '../components/globalerrorboundary';
import { THEME } from '@/lib/theme'; 
import { SidebarProvider } from '@/lib/SidebarContext'; 
import AuthGuard from "../components/authGuard"; 
import { ToastProvider } from '@/lib/toast-context'; 
import { PermissionsProvider } from '@/lib/PermissionsContext';

// 🚀 1. استدعاء محرك الأوفلاين والكاش الجديد (V9)
import QueryProvider from '../components/QueryProvider';

// 🚀 2. استدعاء خدمة رسائل التأكيد المخصصة (V11)
import { ConfirmProvider } from '../components/ConfirmContext'; 

// 🚀 3. اختصارات التنقل العامة
import GlobalNavigationShortcuts from '../components/GlobalNavigationShortcuts';
import { PerformancePreferences } from '@/components/PerformancePreferences';

// Cairo is self-hosted in app/phi-fonts.css (app/fonts), so builds never download fonts.

// 📱 التعديل هنا: منع الـ Zoom وتغطية الشاشة بالكامل للموبايل
export const viewport = {
  themeColor: THEME.sandLight,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, 
  viewportFit: 'cover',
};

export const metadata = {
  title: "فاي تك | PHI TECH — نظام الإدارة الموحد",
  description: "نظام إدارة العمالة والمشاريع والمصروفات",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 🛡️ suppressHydrationWarning يمنع رسائل الخطأ المزعجة في الكونسول
    <html lang="ar" dir="rtl" className="phi-brand" suppressHydrationWarning>
      <body 
        style={{ 
          position: 'relative', 
          minHeight: '100vh', 
          margin: 0, 
          backgroundColor: THEME.sandLight,
          color: THEME.text 
        }}
      >
        
        {/* 🎨 ستايل الهوية البصرية السيادية (تحسين الأداء) */}
        <style dangerouslySetInnerHTML={{__html: `
          .bg-master-container {
            position: fixed; inset: 0; z-index: -4; 
            background-color: ${THEME.sandLight}; 
            overflow: hidden;
            pointer-events: none;
          }
          .bg-image-base {
            position: absolute; inset: 0;
            background-image: url('/ryc_login.jpeg'); 
            background-size: cover;
            background-position: center;
            filter: blur(60px); 
            transform: scale(1.1); 
            opacity: 0.45; 
          }
          .bg-glass-tint {
            position: absolute; inset: 0; z-index: -3;
            background: linear-gradient(
              135deg, 
              rgba(244, 241, 238, 0.8) 0%, 
              rgba(255, 255, 255, 0.85) 50%,
              rgba(194,65,12, 0.1) 100%
            );
            backdrop-filter: blur(10px);
          }
          .watermark-bg {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 50vw; max-width: 600px; opacity: 0.035; z-index: -2;
            pointer-events: none; user-select: none;
          }
          @media print { .no-print { display: none !important; } }
        `}} />

        <NextTopLoader 
            color={THEME.goldAccent} 
            height={3} 
            showSpinner={false} 
            shadow={`0 0 10px ${THEME.goldAccent}`} 
            zIndex={99999} 
        />

        <GlobalErrorBoundary>
            <QueryProvider>
                <Providers>
                    <ToastProvider>
                        {/* 🚀 تغليف السيستم بخدمة التأكيد الذكية */}
                        <PerformancePreferences>
                        <ConfirmProvider>
                            <AutoLogoutWrapper>
                                <AuthGuard> 
                                    <PermissionsProvider>
                                        <SidebarProvider> 
                                            {/* LayoutClient هو المتحكم في حركة السايد بار والصفحة */}
                                            <LayoutClient>
                                                <GlobalNavigationShortcuts />
                                                <div style={{ position: 'relative', zIndex: 1 }}>
                                                    {children}
                                                </div>
                                            </LayoutClient>
                                        </SidebarProvider> 
                                    </PermissionsProvider>
                                </AuthGuard>
                            </AutoLogoutWrapper>
                        </ConfirmProvider>
                        </PerformancePreferences>
                    </ToastProvider>
                </Providers>
            </QueryProvider>
        </GlobalErrorBoundary>
        
      </body>
    </html>
  );
}
