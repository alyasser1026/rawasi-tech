"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast-context'; 
import { getDestinationForUser } from '@/lib/roleRouter';
import {
  getAuthEmailRedirectTo,
  getAuthErrorFeedback,
  getSafeAuthRedirect,
  resolvePublicAuthOrigin,
} from '@/lib/auth-feedback';
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
  accessToken?: string;
}) {
  try {
    const { accessToken, ...body } = payload;
    fetch('/api/notify/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
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
  const [email, setEmailValue] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [confirmationFeedback, setConfirmationFeedback] = useState<{ message: string; tone: 'success' | 'warning' | 'error' } | null>(null);
  const resendPending = useRef(false);
  const submitPending = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const setEmail = (value: string) => {
    setEmailValue(value);
    setConfirmationEmail('');
    setConfirmationFeedback(null);
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const redirectParam = getSafeAuthRedirect(searchParams?.get('redirect'));
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
      const emailField = formRef.current?.querySelector<HTMLInputElement>('input[autocomplete="username"]');
      const passField = formRef.current?.querySelector<HTMLInputElement>('input[autocomplete="current-password"], input[autocomplete="new-password"]');
      if (emailField?.value && !email) setEmail(emailField.value);
      if (passField?.value && !password) setPassword(passField.value);
    };
    
    const intervals = [100, 500, 1000, 2000].map(t => setTimeout(syncFields, t));
    return () => intervals.forEach(t => clearTimeout(t));
  }, [email, password]);

  const handleAutoFill = (e: React.AnimationEvent<HTMLInputElement>) => {
    if (e.animationName === 'onAutoFillStart') {
      const target = e.target as HTMLInputElement;
      if (target.autocomplete === 'username') setEmail(target.value);
      if (target.autocomplete === 'current-password' || target.autocomplete === 'new-password') setPassword(target.value);
    }
  };

  const toggleSignUp = () => {
    setIsSignUp(!isSignUp);
    setFullName('');
    setPhone('');
    setPassword('');
    setConfirmationEmail('');
    setConfirmationFeedback(null);
  };

  const emailRedirectTo = () => {
    const authOrigin = resolvePublicAuthOrigin(
      window.location.origin,
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SITE_URL : undefined
    );
    return getAuthEmailRedirectTo(
      authOrigin,
      redirectParam || (window.location.pathname !== '/login' ? window.location.pathname : null),
      portalParam
    );
  };

  const handleResendConfirmation = async () => {
    if (!confirmationEmail || isLoading || resendPending.current || resendCooldown > 0) return;
    resendPending.current = true;
    setIsResendingConfirmation(true);
    setConfirmationFeedback(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: confirmationEmail,
        options: { emailRedirectTo: emailRedirectTo() },
      });
      if (error) throw error;
      setResendCooldown(60);
      setConfirmationFeedback({ message: 'تم طلب إعادة إرسال رابط التفعيل. راجع بريدك ومجلد الرسائل غير المرغوب فيها، ثم سجّل الدخول بعد التفعيل.', tone: 'success' });
    } catch (error: unknown) {
      const feedback = getAuthErrorFeedback(error);
      setConfirmationFeedback({ message: feedback.message, tone: feedback.tone });
      if (feedback.tone === 'warning') setResendCooldown(60);
      showToast(feedback.message, feedback.tone);
    } finally {
      resendPending.current = false;
      setIsResendingConfirmation(false);
    }
  };

  // 🚀 3. دالة التنفيذ والتوجيه حسب الصلاحيات
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitPending.current || resendPending.current) return;
    
    if (!email.trim() || !password) {
      return showToast('الرجاء إدخال اسم المستخدم / البريد الإلكتروني وكلمة المرور', 'warning');
    }
    
    if (isSignUp) {
      if (!fullName.trim()) return showToast('يرجى إدخال الاسم الكامل', 'warning');
      if (!phone.trim() || phone.replace(/\D/g, '').length < 8) return showToast('يرجى إدخال رقم الجوال بشكل صحيح', 'warning');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return showToast('يرجى إدخال بريد إلكتروني صحيح لإنشاء الحساب', 'warning');
      if (password.length < 6) return showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'warning');
    }

    submitPending.current = true;
    setIsLoading(true);
    setConfirmationFeedback(null);
    let attemptedEmail = email.trim();

    try {
      if (isSignUp) {
        const cleanPhone = phone.trim();
        const cleanName = fullName.trim();
        const cleanEmail = email.trim();

        const { error, data } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: emailRedirectTo(),
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
          accessToken: data?.session?.access_token,
        });

        // في حال تفعيل تأكيد البريد في Supabase وعدم وجود جلسة فورية
        if (data?.user && !data.session) {
          setConfirmationEmail(cleanEmail);
          setResendCooldown(60);
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
        attemptedEmail = loginEmail;

        // 🔑 تسجيل الدخول في Supabase
        const { error, data } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
        if (!data.user || !data.session) throw new Error('لم تُنشأ جلسة تسجيل الدخول. يرجى المحاولة مرة أخرى.');
        setConfirmationEmail('');
        
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
          accessToken: data.session.access_token,
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
    } catch (error: unknown) {
      const feedback = getAuthErrorFeedback(error);
      if (feedback.requiresConfirmation) setConfirmationEmail(attemptedEmail);
      showToast(feedback.message, feedback.tone);
    } finally {
      submitPending.current = false;
      setIsLoading(false);
    }
  };

  return {
    isSignUp, toggleSignUp, fullName, setFullName, phone, setPhone, email, setEmail, password, setPassword,
    isLoading, handleAutoFill, handleSubmit, formRef,
    confirmationEmail, confirmationFeedback, isResendingConfirmation, resendCooldown, handleResendConfirmation
  };
}
