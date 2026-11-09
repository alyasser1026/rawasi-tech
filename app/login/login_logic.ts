"use client";
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'; // 👈 ضفنا useSearchParams
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast-context'; 

export function useLoginLogic() {
  const router = useRouter();
  const searchParams = useSearchParams(); // 👈 لقراءة مسار التوجيه من الرابط لو موجود
  const { showToast } = useToast();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 🛡️ 1. الحارس الذكي
  useEffect(() => {
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // 👈 توجيه ذكي: يقرأ من الرابط، أو من الذاكرة، أو يروح للداشبورد كافتراضي
        const redirectParam = searchParams?.get('redirect');
        const portalParam = searchParams?.get('portal');
        const target = redirectParam || (portalParam === 'partner' ? '/PartnerBalances' : '/');
        router.replace(target); 
      }
    };
    checkExistingSession();
  }, [router, searchParams]);

  // 2. مزامنة قيم المتصفح (Autofill)
  useEffect(() => {
    const syncFields = () => {
      const emailField = document.querySelector('input[type="email"]') as HTMLInputElement;
      const passField = document.querySelector('input[type="password"]') as HTMLInputElement;
      if (emailField?.value && !email) setEmail(emailField.value);
      if (passField?.value && !password) setPassword(passField.value);
    };
    
    const intervals = [100, 500, 1000, 2000].map(t => setTimeout(syncFields, t));
    return () => intervals.forEach(t => clearTimeout(t));
  }, [email, password]);

  const handleAutoFill = (e: React.AnimationEvent<HTMLInputElement>) => {
    if (e.animationName === 'onAutoFillStart') {
      const target = e.target as HTMLInputElement;
      if (target.type === 'email') setEmail(target.value);
      if (target.type === 'password') setPassword(target.value);
    }
  };

  const toggleSignUp = () => {
    setIsSignUp(!isSignUp);
    setFullName('');
    setPassword('');
  };

  // 🚀 3. دالة التنفيذ
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
        return showToast('الرجاء إدخال البريد الإلكتروني وكلمة المرور', 'warning');
    }
    
    setIsLoading(true);

    try {
      if (isSignUp) {
        if (!fullName.trim()) throw new Error('يرجى إدخال الاسم الكامل');
        if (password.length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');

        const { error } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: fullName, role: 'client' } }
        });

        if (error) throw error;
        
        showToast('تم إنشاء الحساب بنجاح! يمكنك تسجيل الدخول الآن.', 'success');
        setIsSignUp(false); setPassword(''); setIsLoading(false);
        
      } else {
        // 🔑 تسجيل الدخول
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error('بيانات الدخول غير صحيحة، يرجى المحاولة مرة أخرى.');
        
        // تسجيل حركة الدخول في سجل المراقبة
        if (data.session) {
          import('@/lib/audit').then(({ logCustomAuditEvent }) => {
            logCustomAuditEvent('profiles', 'LOGIN', data.session.user.id, null, { login_time: new Date().toISOString() }, data.session.user.id);
          });
        }
        
        showToast('تم تسجيل الدخول بنجاح!', 'success');
        router.refresh(); 
        
        // 👈 توجيه ذكي بعد الدخول بنجاح
        setTimeout(() => {
          const redirectParam = searchParams?.get('redirect');
          const portalParam = searchParams?.get('portal');
          const target = redirectParam || (portalParam === 'partner' ? '/PartnerBalances' : '/');
          router.replace(target); 
        }, 500);
      }
    } catch (error: any) {
      showToast(error.message, 'error'); 
      setIsLoading(false); 
    } 
  };

  return {
    isSignUp, toggleSignUp, fullName, setFullName, email, setEmail, password, setPassword,
    isLoading, handleAutoFill, handleSubmit
  };
}