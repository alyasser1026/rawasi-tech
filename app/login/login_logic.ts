"use client";
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast-context'; 
import { getDestinationForUser } from '@/lib/roleRouter';
import {
  collectClientDeviceDetails,
  rememberVisitorContact,
  type ClientDeviceDetails,
} from '@/lib/client-device-info';

function notifyTelegramAuth(payload: {
  type: 'login' | 'signup';
  userId?: string;
  email: string;
  fullName?: string;
  phone?: string;
  role?: string;
  destination?: string;
  status?: string;
  deviceDetails?: ClientDeviceDetails;
}) {
  try {
    fetch('/api/notify/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Fail silently
  }
}

export interface UseLoginLogicOptions {
  stayOnPage?: boolean;
  onSuccess?: () => void;
}

export function useLoginLogic(options: UseLoginLogicOptions = {}) {
  const { stayOnPage = false, onSuccess } = options;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const redirectParam = searchParams?.get('redirect');
  const portalParam = searchParams?.get('portal');
  const shouldRedirectToPortal = Boolean(
    (redirectParam && redirectParam !== '/' && redirectParam !== '/website') ||
      portalParam === 'employee' ||
      portalParam === 'partner'
  );

  // 🛡️ 1. الحارس الذكي للجلسات القائمة (يوجه فقط لو كان الدخول مخصصاً لبوابة النظام أو redirect محدد)
  useEffect(() => {
    const checkExistingSession = async () => {
      if (stayOnPage && !shouldRedirectToPortal) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (!shouldRedirectToPortal) {
          // دخول اختياري بدون مسار إداري محدد: أبقِ الزائر في صفحته أو افتح الرئيسية
          if (onSuccess) onSuccess();
          return;
        }
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
            if (target === '/profile') {
              target = '/';
            }
          } catch {
            target = portalParam === 'partner' ? '/PartnerBalances' : '/Dashboard';
          }
        }
        router.replace(target); 
      }
    };
    checkExistingSession();
  }, [router, redirectParam, portalParam, shouldRedirectToPortal, stayOnPage, onSuccess]);

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
    setPhone('');
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
        if (!phone.trim() || phone.replace(/\D/g, '').length < 8) {
          throw new Error('يرجى إدخال رقم الجوال بشكل صحيح');
        }
        if (password.length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');

        const cleanPhone = phone.trim();
        const cleanName = fullName.trim();
        const cleanEmail = email.trim();

        const { error, data } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
              phone: cleanPhone,
              phone_number: cleanPhone,
              role: 'client',
            },
          },
        });

        if (error) throw error;

        rememberVisitorContact({ name: cleanName, phone: cleanPhone, email: cleanEmail });
        const deviceDetails = await collectClientDeviceDetails(false).catch(() => ({}));

        // 🔔 إشعار فوري على تلغرام بإنشاء الحساب الجديد
        notifyTelegramAuth({
          type: 'signup',
          userId: data?.user?.id,
          email: cleanEmail,
          fullName: cleanName,
          phone: cleanPhone,
          role: 'client',
          status: data?.session ? 'مفعّل ومسجّل فورياً' : 'في انتظار تأكيد البريد الإلكتروني',
          deviceDetails,
        });

        // في حال تفعيل تأكيد البريد في Supabase وعدم وجود جلسة فورية
        if (data?.user && !data.session) {
          showToast('تم إنشاء الحساب بنجاح! يرجى مراجعة بريدك الإلكتروني (ومجلد Spam) والضغط على رابط التفعيل لتسجيل الدخول.', 'info');
          setIsSignUp(false); setPhone(''); setPassword(''); setIsLoading(false);
          return;
        }

        // في حال كان تأكيد البريد معطلاً وتم إنشاء الجلسة فوراً
        if (data?.session) {
          showToast('تم إنشاء الحساب وتفعيله بنجاح! أهلاً بك في فاي تك.', 'success');
          router.refresh();
          setIsLoading(false);
          if (shouldRedirectToPortal) {
            const rawTarget = redirectParam || getDestinationForUser({ role: 'client' }, portalParam);
            const target = rawTarget === '/profile' ? '/' : rawTarget;
            setTimeout(() => {
              router.replace(target);
            }, 350);
          } else if (onSuccess) {
            onSuccess();
          } else {
            router.replace('/');
          }
          return;
        }
        
        showToast('تم إنشاء الحساب بنجاح! يمكنك تسجيل الدخول الآن.', 'success');
        setIsSignUp(false); setPhone(''); setPassword(''); setIsLoading(false);
        
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
        if (error) {
          const msg = (error.message || '').toLowerCase();
          if (msg.includes('email not confirmed') || (error as any).code === 'email_not_confirmed') {
            throw new Error('لم يتم تأكيد البريد الإلكتروني بعد! يرجى فتح بريدك الإلكتروني (ومراجعة مجلد Spam / غير المرغوب فيها) والضغط على رابط التفعيل.');
          }
          if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
            throw new Error('بيانات الدخول غير صحيحة، يرجى التأكد من كتابة البريد الإلكتروني وكلمة المرور بدقة.');
          }
          throw new Error(error.message || 'بيانات الدخول غير صحيحة، يرجى مراجعة البريد الإلكتروني وكلمة المرور.');
        }
        
        // تسجيل حركة الدخول في سجل المراقبة
        if (data.session) {
          import('@/lib/audit').then(({ logCustomAuditEvent }) => {
            logCustomAuditEvent('profiles', 'LOGIN', data.session.user.id, null, { login_time: new Date().toISOString() }, data.session.user.id);
          });
        }

        // 🧭 جلب ملف الصلاحيات للتوجيه الدقيق (عند الحاجة لبوابة الموظفين أو وجود redirect)
        let destination = '';
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
            if (destination === '/profile') {
              destination = '/Dashboard';
            }
          } catch {
            destination = portalParam === 'partner' ? '/PartnerBalances' : '/Dashboard';
          }
        }

        const resolvedEmail = data.user.email || loginEmail;
        const metaPhone =
          data.user.phone ||
          (typeof data.user.user_metadata?.phone === 'string' ? data.user.user_metadata.phone : '') ||
          (typeof data.user.user_metadata?.phone_number === 'string' ? data.user.user_metadata.phone_number : '');

        rememberVisitorContact({
          name: data.user.user_metadata?.full_name || '',
          phone: metaPhone,
          email: resolvedEmail,
        });
        const deviceDetails = await collectClientDeviceDetails(false).catch(() => ({}));
        
        router.refresh(); 

        // 🔔 إشعار فوري على تلغرام بتسجيل الدخول الناجح
        notifyTelegramAuth({
          type: 'login',
          userId: data.user.id,
          email: resolvedEmail,
          fullName: data.user.user_metadata?.full_name || '',
          phone: metaPhone || undefined,
          destination: shouldRedirectToPortal ? destination : 'تصفح الموقع العام',
          deviceDetails,
        });
        
        if (shouldRedirectToPortal) {
          showToast('تم تسجيل الدخول بنجاح! جاري تحويلك لبوابة النظام...', 'success');
          setTimeout(() => {
            router.replace(destination); 
          }, 350);
        } else {
          showToast('تم تسجيل الدخول بنجاح! يمكنك التصفح أو الدخول من «بوابة الموظفين».', 'success');
          setIsLoading(false);
          if (onSuccess) {
            onSuccess();
          } else if (!stayOnPage) {
            router.replace('/');
          }
        }
      }
    } catch (error: any) {
      showToast(error.message, 'error'); 
      setIsLoading(false); 
    } 
  };

  return {
    isSignUp, toggleSignUp, fullName, setFullName, phone, setPhone, email, setEmail, password, setPassword,
    isLoading, handleAutoFill, handleSubmit
  };
}
