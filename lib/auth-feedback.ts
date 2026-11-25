type AuthErrorFeedback = {
  message: string;
  tone: 'warning' | 'error';
  requiresConfirmation: boolean;
};

/** Account states and validation failures need recovery guidance, rather than crash alerts. */
export function getAuthErrorFeedback(error: unknown): AuthErrorFeedback {
  const details = error && typeof error === 'object' ? error as { code?: unknown; status?: unknown; message?: unknown } : {};
  const code = typeof details.code === 'string' ? details.code : '';
  const message = typeof details.message === 'string' ? details.message : typeof error === 'string' ? error : '';
  const normalized = message.toLowerCase();
  const warning = (text: string, requiresConfirmation = false): AuthErrorFeedback => ({ message: text, tone: 'warning', requiresConfirmation });

  if (code === 'email_not_confirmed' || normalized.includes('email not confirmed')) {
    return warning('بريدك الإلكتروني لم يُفعّل بعد. افتح رسالة التفعيل، أو أعد إرسال الرابط من النموذج. راجع أيضًا مجلد الرسائل غير المرغوب فيها.', true);
  }
  if (code === 'invalid_credentials' || normalized.includes('invalid login credentials') || normalized.includes('invalid credentials')) {
    return warning('بيانات الدخول غير صحيحة. راجع البريد الإلكتروني أو اسم المستخدم وكلمة المرور، ثم حاول مرة أخرى.');
  }
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || details.status === 429) {
    return warning('تم الوصول إلى حد المحاولات أو الرسائل المسموح بها. انتظر قليلًا قبل إعادة المحاولة.');
  }
  if (code === 'email_address_invalid' || code === 'validation_failed') {
    return warning('يرجى مراجعة البيانات وإدخال بريد إلكتروني صحيح.');
  }
  if (code === 'user_already_exists' || code === 'email_exists') {
    return warning('هذا البريد مسجّل بالفعل. سجّل الدخول بحسابك، وأعد إرسال رابط التفعيل إذا لم يكتمل تفعيله.');
  }
  if (code === 'weak_password') {
    return warning('كلمة المرور لا تستوفي متطلبات الأمان. اختر كلمة مرور أقوى وحاول مرة أخرى.');
  }
  return { message: message || 'تعذّر الاتصال بخدمة الحسابات. يرجى المحاولة مرة أخرى.', tone: 'error', requiresConfirmation: false };
}

export function getSafeAuthRedirect(redirect?: string | null): string | null {
  if (!redirect || redirect !== redirect.trim()) return null;
  let decoded = redirect;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded)) return null;
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    if (decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded)) return null;
    return redirect;
  } catch {
    return null;
  }
}

/** Both signup and resend return to this site's login, preserving a local destination. */
export function getAuthEmailRedirectTo(origin: string, redirect?: string | null, portal?: string | null): string {
  const target = new URL('/login', new URL(origin).origin);
  const safeRedirect = getSafeAuthRedirect(redirect);
  if (safeRedirect && !['/', '/login', '/signup'].includes(safeRedirect.split(/[?#]/)[0])) target.searchParams.set('redirect', safeRedirect);
  if (portal === 'employee' || portal === 'partner') target.searchParams.set('portal', portal);
  return target.toString();
}
