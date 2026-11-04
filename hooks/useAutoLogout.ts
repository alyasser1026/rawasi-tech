"use client";
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notify';

export function useAutoLogout(timeoutMinutes = 15) {
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const logout = async () => {
    // 1. مسح الجلسة من الداتا بيز
    await supabase.auth.signOut();
    // 2. تنظيف الـ LocalStorage (لو بتخزن فيها حاجة)
    localStorage.clear();
    // 3. رسالة وتوجيه لصفحة الدخول
    notify("تم تسجيل الخروج تلقائياً لحماية بياناتك بسبب عدم وجود نشاط.");
    router.push('/login'); // غير المسار لصفحة الدخول بتاعتك
  };

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // ضبط العداد (الدقائق * 60 ثانية * 1000 ملي ثانية)
    timerRef.current = setTimeout(logout, timeoutMinutes * 60 * 1000);
  };

  useEffect(() => {
    // الأحداث اللي بتدل إن المستخدم شغال على النظام
    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
    
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer(); // تشغيل العداد لأول مرة

    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}