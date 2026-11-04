"use client";
import React, { useState, useEffect } from 'react';
import { THEME } from '@/lib/theme';

interface ResponsiveWrapperProps {
  children: React.ReactNode;
}

export default function ResponsiveWrapper({ children }: ResponsiveWrapperProps) {
  const [isMobile, setIsMobile] = useState(false);

  // مراقبة حجم الشاشة بشكل حي
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // فحص أولي عند التحميل
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div 
      style={{
        // تقليل الهوامش على الموبايل عشان نستغل كل مساحة الشاشة
        padding: isMobile ? '0.625rem' : '1.5625rem',
        width: '100%',
        maxWidth: '100vw',
        overflowX: 'hidden',
        transition: 'padding 0.3s ease'
      }}
    >
      {/* 🚀 السحر هنا: حقن كلاسات استثنائية للموبايل فقط */}
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          /* 1. الجداول: السماح بالتمرير الأفقي بدلاً من خروجها عن الشاشة */
          .mobile-table-container {
            overflow-x: auto !important;
            display: block;
            width: 100%;
            -webkit-overflow-scrolling: touch;
          }

          /* 2. أشرطة الأدوات: تحويلها من صفوف لعواميد فوق بعض */
          .mobile-flex-col {
            flex-direction: column !important;
            align-items: stretch !important;
          }

          /* 3. الإحصائيات (الـ Grid): عرض مربع واحد في كل سطر */
          .mobile-grid-1 {
            grid-template-columns: 1fr !important;
          }

          /* 4. تصغير الخطوط الأساسية قليلاً لتناسب الشاشة */
          h1 { font-size: 22px !important; }
          h2 { font-size: 18px !important; }
        }
      `}} />

      {children}
    </div>
  );
}