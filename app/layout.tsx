import "./phi-fonts.css";
import "./globals.css";
import "./phi-scale.css";
import NextTopLoader from 'nextjs-toploader';
import GlobalErrorBoundary from '../components/globalerrorboundary';
import AppShellSwitch from '../components/AppShellSwitch';
import { THEME } from '@/lib/theme';

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
            __html: `(function(){try{var d=document.documentElement;var m=localStorage.getItem('phi_theme_mode')||'dark';var a=localStorage.getItem('phi_theme_accent')||'amber';d.setAttribute('data-mode',m);d.setAttribute('data-accent',a);var s=parseFloat(localStorage.getItem('phi_ui_scale'));if(s>=0.8&&s<=1.3)d.style.setProperty('--ui-scale',String(s));var z=localStorage.getItem('phi_site_size_v1');d.setAttribute('data-site-size',(z==='sm'||z==='md'||z==='lg'||z==='xl')?z:'md');var p=localStorage.getItem('fai-tech:performance-mode');var rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;var cn=navigator.connection;var lowConn=Boolean(cn&&(cn.saveData||/2g/.test(cn.effectiveType||'')));var dm=navigator.deviceMemory;var hc=navigator.hardwareConcurrency;var lowHw=Boolean((typeof dm==='number'&&dm<=4)||(typeof hc==='number'&&hc<=4));if(p==='fast'||(p!=='standard'&&(rm||lowConn||lowHw)))d.classList.add('low-graphics-mode');}catch(e){}})();`,
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
        
        <style dangerouslySetInnerHTML={{__html: `
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
            <AppShellSwitch>{children}</AppShellSwitch>
        </GlobalErrorBoundary>
        
      </body>
    </html>
  );
}
