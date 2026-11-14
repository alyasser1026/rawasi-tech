import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import DocumentVerificationView from '@/components/DocumentVerificationView';

export const metadata: Metadata = {
  title: 'التحقق من صحة المستندات | PHI CONSTRUCT — فاي تك',
  description: 'بوابة التحقق الفوري من صحة الفواتير وسندات الصرف والقبض والمستخلصات الصادرة من شركة فاي تك للتطوير العقاري والمقاولات.',
};

export default function RootVerifyPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', backgroundColor: '#07090e', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontFamily: 'Cairo, sans-serif' }}>
        جاري تحميل بوابة التحقق من المستندات...
      </div>
    }>
      <DocumentVerificationView />
    </Suspense>
  );
}
