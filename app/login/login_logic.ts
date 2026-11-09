"use client";
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast-context'; 
import { getDestinationForUser } from '@/lib/roleRouter';

export function useLoginLogic() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 🛡️ 1. الحارس الذكي للجلسات القائمة
  useEffect(() => {
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const redirectParam = searchParams?.get('redirect');
        const portalParam = searchParams?.get('portal');
        
        let target = '';
        if (redirectParam && redirectParam !== '/' && redirectParam !== '/website') {
          target = redirectParam;
        } else {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, role, is_admin, linked_partner_id, permissions')
              .eq('id', session.user.id)
              .maybeSingle();
            target = getDestinationForUser(profile, portalParam);
          } catch {
            target = portalParam === 'partner' ? '/PartnerBalances' : '/Dashboard';
          }
        }
        router.replace(target); 
      }
    };
    checkExistingSession();
  }, [router, searchParams]);

  // 2. مزامنة قيم المتصفح (Autofill)
  useEffect(() => {
    const syncFields = () => {
      const emailField = document.querySelector('input[type="text"], input[type="email"]') as HTMLInputElement;
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
      if (target.type === 'text' || target.type === 'email') setEmail(target.value);
      if (target.type === 'password') setPassword(target.value);
    }
  };

  const toggleSignUp = () => {
    setIsSignUp(!isSignUp);
    setFullName('');
    setPassword('');
  };

  // 🚀 3. دالة التنفيذ والتوجيه حسب الصلاحيات
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      return showToast('الرجاء إدخال اسم المستخدم / البريد الإلكتروني وكلمة المرور', 'warning');
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
        // 🔑 دعم تسجيل الدخول باسم المستخدم أو البريد الإلكتروني
        let loginEmail = email.trim();
        if (!loginEmail.includes('@')) {
          try {
            const { data: matchedProfile } = await supabase
              .from('profiles')
              .select('email')
              .or(`username.ilike.${loginEmail},full_name.ilike.${loginEmail}`)
              .limit(1)
              .maybeSingle();

            if (matchedProfile?.email) {
              loginEmail = matchedProfile.email;
            }
          } catch (lookupErr) {
            console.warn('Username lookup error:', lookupErr);
          }
        }

        // 🔑 تسجيل الدخول في Supabase
        const { error, data } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw new Error('بيانات الدخول غير صحيحة، يرجى مراجعة اسم المستخدم وكلمة المرور.');
        
        // تسجيل حركة الدخول في سجل المراقبة
        if (data.session) {
          import('@/lib/audit').then(({ logCustomAuditEvent }) => {
            logCustomAuditEvent('profiles', 'LOGIN', data.session.user.id, null, { login_time: new Date().toISOString() }, data.session.user.id);
          });
        }

        // 🧭 جلب ملف الصلاحيات للتوجيه الدقيق
        let destination = '';
        const redirectParam = searchParams?.get('redirect');
        const portalParam = searchParams?.get('portal');

        if (redirectParam && redirectParam !== '/' && redirectParam !== '/website') {
          destination = redirectParam;
        } else {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, role, is_admin, linked_partner_id, permissions')
              .eq('id', data.user.id)
              .maybeSingle();

            destination = getDestinationForUser(profile, portalParam);
          } catch {
            destination = portalParam === 'partner' ? '/PartnerBalances' : '/Dashboard';
          }
        }
        
        showToast('تم تسجيل الدخول بنجاح! جاري تحويلك...', 'success');
        router.refresh(); 
        
        // 👈 توجيه ذكي فوري للمستخدم حسب صلاحياته
        setTimeout(() => {
          router.replace(destination); 
        }, 350);
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
