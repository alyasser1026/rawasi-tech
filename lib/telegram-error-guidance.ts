interface ErrorDetails {
  message: string;
  category?: string;
  code?: string;
  status?: number;
  source?: string;
  url?: string;
  stack?: string;
  componentStack?: string;
  metadata?: unknown;
}

interface Guidance {
  cause: string;
  action: string;
  needsDiagnosis?: boolean;
}

function getGuidance(error: ErrorDetails): Guidance {
  const code = typeof error.code === 'string' ? error.code.toUpperCase() : '';
  const evidence = [error.message, error.source, error.url, error.stack, error.componentStack]
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.slice(0, 1500))
    .join('\n');
  const status = error.status ?? Number(evidence.match(/\b(?:HTTP(?:\/[\d.]+)?\s+|status(?:\s+of)?[\s:=]+)([45]\d{2})\b/i)?.[1]);
  const matchesCode = (expected: string) => code === expected || new RegExp('\\b' + expected + '\\b', 'i').test(evidence);
  const missingTable = matchesCode('PGRST205') || matchesCode('42P01') ||
    /could not find the table|relation .+ does not exist/i.test(evidence);
  const missingColumn = matchesCode('PGRST204') || matchesCode('42703') ||
    /column .+ does not exist|could not find the .+ column/i.test(evidence);

  if (/minified react error #300\b|rendered (?:fewer|more) hooks than expected/i.test(evidence)) {
    return {
      cause: 'المكوّن غيّر عدد الـHooks بين عرضين. السبب الشائع شرط بيرجّع بدري قبل استدعاء بعض الـHooks.',
      action: 'حدّد المكوّن من Component Stack أو شغّل الصفحة في وضع التطوير. حطّ الـHooks قبل أي return شرطي، وانقل الشرط لجوا الـHook لو محتاجه، ثم جرّب نفس انتقال الحالة.',
    };
  }
  if (/clone.*response.*body is already used|body is already used.*clone/i.test(evidence)) {
    return {
      cause: 'محاولة نسخ رد الشبكة بعد بدء قراءة محتواه.',
      action: 'لو الخطأ في sw.js، اعمل كل نسخ Response المطلوبة للكاش قبل ما ترجّع الرد للمتصفح، واربط كتابة الكاش بـ event.waitUntil. بعد نشر التعديل اتأكد إن المتصفح فعّل النسخة الجديدة.',
    };
  }
  if ((missingColumn || status === 400) && /\bretention_percent\b/i.test(evidence)) {
    return {
      cause: 'طلب أوامر الشغل بيستخدم حقل نسبة الضمان. ممكن نسخة قاعدة البيانات تكون أقدم من الواجهة.',
      action: 'تحقّق من وجود job_orders.retention_percent في Supabase. لو غايب راجع ميجريشن 20261105170001_job_order_retention وسجل التطبيق. لو موجود، راجع نص رد PostgREST للتأكد من الحقل اللي رافضه.',
    };
  }
  if ((missingTable || status === 404) && /\bsite_custodies\b/i.test(evidence)) {
    return {
      cause: 'الطلب بيشير لجدول العُهد، وSupabase رجّع إن المورد غير متاح.',
      action: 'تحقّق من وجود public.site_custodies ومن سجل ميجريشن 20261105170007_custodies_and_cash_closings. لو الجدول موجود، راجع إتاحته في Data API وكاش المخطط.',
    };
  }
  if (matchesCode('PGRST201') || /could not embed because more than one relationship was found/i.test(evidence)) {
    if (/['"]partners['"]\s+and\s+['"]accounts['"]/i.test(evidence)) {
      return {
        cause: 'استعلام الشركاء بيطلب الحساب من جدول accounts من غير ما يحدد العلاقة. قاعدة البيانات فيها رابط قديم ورابط يقيّد الحساب بالشركة.',
        action: 'في استعلام صفحة الشركاء استخدم account:accounts!partners_account_id_company_fkey(name). بعد النشر، افتح الصفحة وتحقق من اسم الحساب للشريك المرتبط ومن ظهور «غير مربوط» للباقي.',
      };
    }
    return {
      cause: 'الاستعلام بيضم جدولًا مرتبطًا، وPostgREST لقى أكتر من مفتاح خارجي ينفع للربط.',
      action: 'راجع العلاقات في تفاصيل رد PostgREST. حدّد المفتاح المقصود في select بصيغة table!foreign_key(columns)، واختبر ظهور البيانات في الشركة المفتوحة.',
    };
  }
  if (missingTable || missingColumn || matchesCode('PGRST202') ||
    /could not find the function .+ in the schema cache/i.test(evidence)) {
    return {
      cause: 'طلب قاعدة البيانات بيشير إلى جدول أو حقل أو دالة مش متاحة للنسخة الحالية من التطبيق.',
      action: 'قارن اسم العنصر وتوقيع الدالة في رد الخطأ مع مخطط قاعدة البيانات وسجل الميجريشن. لو موجود بالفعل، راجع المخطط المكشوف وكاش PostgREST.',
    };
  }
  if (matchesCode('42501') || /row.level security policy|permission denied/i.test(evidence)) {
    return {
      cause: 'صلاحيات المستخدم أو سياسة عزل الشركات رفضت العملية.',
      action: 'تأكد من الحساب والشركة المفتوحة، وراجع صلاحية الإجراء وسياسة RLS على الجدول أو الدالة. اختبر بنفس دور المستخدم.',
    };
  }
  if (matchesCode('23505') || /duplicate key value violates unique constraint/i.test(evidence)) {
    return {
      cause: 'قيمة لازم تكون فريدة موجودة بالفعل.',
      action: 'راجع اسم القيد الفريد والقيمة المكررة في رد قاعدة البيانات. لو دي إعادة إرسال لنفس العملية، راجع نتيجة الحفظ الأول قبل محاولة جديدة.',
    };
  }
  if (matchesCode('23503') || /violates foreign key constraint/i.test(evidence)) {
    return {
      cause: 'العملية بتشير لسجل غير موجود، أو بتحاول تحذف سجل مرتبط بمستندات تانية.',
      action: 'راجع اسم المفتاح الخارجي والسجلات المرتبطة في نفس الشركة. اتأكد إن السجل المطلوب موجود أو عالج الارتباط قبل الحذف.',
    };
  }
  if (status === 401 || /jwt expired|invalid jwt/i.test(evidence)) {
    return {
      cause: 'الخادم رفض الجلسة أو بيانات تسجيل الدخول.',
      action: 'جرّب تجديد الجلسة أو تسجيل الدخول تاني. لو بيتكرر بعد تسجيل الدخول، راجع إرسال الجلسة مع الطلب ووقت انتهائها.',
    };
  }
  if (status === 429 || /too many requests|rate limit exceeded/i.test(evidence)) {
    return {
      cause: 'الخدمة وصلت للحد المسموح من الطلبات.',
      action: 'راجع Retry-After لو موجود، وقلّل الطلبات المتكررة. لو العملية حفظ أو ترحيل، تأكد من نتيجتها قبل إعادة الإرسال.',
    };
  }
  if (/failed to fetch|networkerror|net::err_|cors policy/i.test(evidence)) {
    return {
      cause: 'المتصفح مقدرش يكمل طلب الشبكة. النص وحده ما يفرقش دائمًا بين الاتصال ورفض CORS.',
      action: 'افتح Network وراجع عنوان أول طلب فشل وحالته. لو الطلب المسبق فشل، راجع سماح الخادم بالنطاق والهيدرز المطلوبة. لو انقطع الاتصال أثناء حفظ، اتأكد من حالة السجل قبل إعادة المحاولة.',
    };
  }

  return {
    cause: 'الرسالة الحالية مش كفاية لتحديد السبب بدقة.',
    action: error.category === 'api_failure' || error.category === 'database_error'
      ? 'ابدأ بأول طلب فشل. راجع رد الـAPI وكود الخطأ، وطابق وقت التنبيه مع سجل الخادم أو Supabase.'
      : 'افتح الصفحة المذكورة وكرّر آخر خطوة مرة واحدة. خُد أول خطأ من Console أو Network، واسم المكوّن لو ظهر، علشان تحدد موضع الإصلاح.',
    needsDiagnosis: true,
  };
}

const htmlEntities: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

/** Escape user supplied values without splitting an entity or a Unicode character. */
export function telegramHtml(value: unknown, maxLength = 240): string {
  if (typeof value !== 'string' || maxLength < 1) return '';
  const parts: string[] = [];
  let length = 0;
  for (const character of value) {
    const escaped = htmlEntities[character] ?? character;
    if (length + escaped.length > maxLength) {
      if (length === maxLength) parts.pop();
      return parts.join('') + '…';
    }
    parts.push(escaped);
    length += escaped.length;
  }
  return parts.join('');
}

export function formatTelegramErrorDetails(header: string, error: ErrorDetails): string {
  const guidance = getGuidance(error);
  const code = telegramHtml(error.code, 60);
  let text = header;
  if (code) text += '🔢 <b>الكود</b> <code>' + code + '</code>\n';
  text += '\n❌ <b>رسالة الخطأ</b>\n<pre>' + telegramHtml(error.message, 850) + '</pre>\n';
  text += '\n🔎 <b>السبب</b>\n' + telegramHtml(guidance.cause, 350) + '\n';
  text += '\n🛠 <b>' + (guidance.needsDiagnosis ? 'خطوة التشخيص' : 'الحل المقترح') + '</b>\n';
  text += telegramHtml(guidance.action, 520) + '\n';

  // Keep the diagnosis ahead of optional details and leave room for Telegram's message limit.
  function appendDetail(label: string, value: unknown, limit: number) {
    if (typeof value !== 'string' || !value.trim()) return;
    const start = '\n<b>' + label + '</b>\n<pre>';
    const end = '</pre>\n';
    const available = Math.min(limit, 4000 - text.length - start.length - end.length);
    if (available >= 40) text += start + telegramHtml(value.trim(), available) + end;
  }

  appendDetail('تفاصيل الكود (Stack Trace)', error.stack || error.componentStack, 1450);
  if (error.metadata) {
    try {
      appendDetail('بيانات إضافية', JSON.stringify(error.metadata, null, 2), 400);
    } catch {
      // An unserializable detail must not stop the alert.
    }
  }
  return text;
}
