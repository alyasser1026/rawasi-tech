import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PHI CONSTRUCT | فاي كونستركت — للإنشاءات الخرسانية، التشطيبات المعمارية، وتقنية المعلومات',
  description: 'منظومة البناء المتكامل 3×1: إنشاءات خرسانية (عضم) • تشطيبات معمارية فاخرة • بنية تحتية لتقنية المعلومات والأنظمة الذكية.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function WebsiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      {children}
    </>
  );
}
