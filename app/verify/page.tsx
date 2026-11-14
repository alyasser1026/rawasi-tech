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
      <div className="min-h-screen bg-[#07090e] text-amber-500 flex items-center justify-center font-bold">
        جاري تحميل بوابة التحقق من المستندات...
      </div>
    }>
      <DocumentVerificationView />
    </Suspense>
  );
}
