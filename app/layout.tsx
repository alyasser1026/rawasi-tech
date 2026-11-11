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
import GlobalErrorReporter from '../components/GlobalErrorReporter';
import { THEME } from '@/lib/theme'; 
import { SidebarProvider } from '@/lib/SidebarContext'; 
import AuthGuard from "../components/authGuard"; 
import { ToastProvider } from '@/lib/toast-context'; 
import { PermissionsProvider } from '@/lib/PermissionsContext';
import { CompanyProvider } from '@/lib/CompanyContext';
import { ThemeProvider } from '@/lib/ThemeContext';

// 🚀 1. استدعاء محرك الأوفلاين والكاش الجديد (V9)
import QueryProvider from '../components/QueryProvider';

// 🚀 2. استدعاء خدمة رسائل التأكيد المخصصة (V11)
import { ConfirmProvider } from '../components/ConfirmContext'; 

// 🚀 3. اختصارات التنقل العامة
import GlobalNavigationShortcuts from '../components/GlobalNavigationShortcuts';
import { PerformancePreferences } from '@/components/PerformancePreferences';
import { RealtimeSyncProvider } from '@/lib/useRealtimeSync';

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
    <html lang="ar" dir="rtl" className="phi-brand" data-mode="dark" data-accent="amber" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('phi_theme_mode')||'dark';var a=localStorage.getItem('phi_theme_accent')||'amber';document.documentElement.setAttribute('data-mode',m);document.documentElement.setAttribute('data-accent',a);var s=parseFloat(localStorage.getItem('phi_ui_scale'));if(s>=0.8&&s<=1.3)document.documentElement.style.setProperty('--ui-scale',String(s));}catch(e){}})();`,
          }}
        />
      </head>
      <body 
        style={{ 
          position: 'relative', 
          minHeight: '100vh', 
          margin: 0, 
          backgroundColor: 'var(--bg-canvas, #07080b)',
          color: 'var(--text-primary, #f8fafc)' 
        }}
      >
        
        {/* 🎨 ستايل الهوية البصرية السيادية (تحسين الأداء) */}
        <style dangerouslySetInnerHTML={{__html: `
          .bg-master-container {
            position: fixed; inset: 0; z-index: -4; 
            background-color: var(--bg-canvas, #07080b); 
            overflow: hidden;
            pointer-events: none;
          }
          .bg-image-base {
            position: absolute; inset: 0;
            background-image: url('/ryc_login.jpeg'); 
            background-size: cover;
            background-position: center;
            filter: blur(80px); 
            transform: scale(1.1); 
            opacity: 0.08; 
          }
          .bg-glass-tint {
            position: absolute; inset: 0; z-index: -3;
            background: 
              radial-gradient(circle at 15% 10%, var(--ambient-orb-1, rgba(249, 115, 22, 0.13)), transparent 38%),
              radial-gradient(circle at 85% 85%, var(--ambient-orb-2, rgba(245, 158, 11, 0.08)), transparent 40%),
              linear-gradient(180deg, var(--bg-canvas, #07080b) 0%, var(--bg-canvas-secondary, #0b0d12) 100%);
            backdrop-filter: blur(15px);
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
            <GlobalErrorReporter />
            <QueryProvider>
                <Providers>
                    <ThemeProvider>
                        <ToastProvider>
                            {/* 🚀 تغليف السيستم بخدمة التأكيد الذكية */}
                            <PerformancePreferences>
                            <ConfirmProvider>
                                <AutoLogoutWrapper>
                                    <AuthGuard> 
                                        <PermissionsProvider>
                                            <CompanyProvider>
                                                <RealtimeSyncProvider>
                                                    <SidebarProvider>
                                                        {/* LayoutClient هو المتحكم في حركة السايد بار والصفحة */}
                                                        <LayoutClient>
                                                            <GlobalNavigationShortcuts />
                                                            <div style={{ position: 'relative', zIndex: 1 }}>
                                                                {children}
                                                            </div>
                                                        </LayoutClient>
                                                    </SidebarProvider>
                                                </RealtimeSyncProvider>
                                            </CompanyProvider>
                                        </PermissionsProvider>
                                    </AuthGuard>
                                </AutoLogoutWrapper>
                            </ConfirmProvider>
                            </PerformancePreferences>
                        </ToastProvider>
                    </ThemeProvider>
                </Providers>
            </QueryProvider>
        </GlobalErrorBoundary>
        
      </body>
    </html>
  );
}
