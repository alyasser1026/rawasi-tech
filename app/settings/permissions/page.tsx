"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PermissionsPage() {
    const router = useRouter();

    useEffect(() => {
        // 🚀 توجيه إجباري وفوري لصفحة إدارة الفريق الجديدة
        router.replace('/team');
    }, [router]);

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', direction: 'rtl', fontWeight: 900, color: '#64748b' }}>
            تم نقل إدارة الصلاحيات إلى صفحة "إدارة الفريق".. جاري تحويلك...
        </div>
    );
}