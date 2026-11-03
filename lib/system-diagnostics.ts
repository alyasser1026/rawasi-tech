import type { SupabaseClient } from '@supabase/supabase-js';

export type DiagnosticStatus = 'pass' | 'warning' | 'error' | 'unavailable';
export type DiagnosticResult = { id: string; title: string; status: DiagnosticStatus; detail: string };

async function withTimeout<T>(promise: PromiseLike<T>, milliseconds = 10000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(promise), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Diagnostic timeout')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export async function inspectLocalEnvironment(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [{ id: 'network', title: 'اتصال الجهاز بالإنترنت', status: navigator.onLine ? 'pass' : 'warning',
    detail: navigator.onLine ? 'المتصفح يرصد اتصالًا بالشبكة؛ نتيجة الوصول للخادم تظهر في فحص قاعدة البيانات.' : 'الجهاز دون اتصال حاليًا. لا تعتمد على البيانات المعروضة حتى يعود الاتصال وتتأكد من الحفظ.' }];
  const probe = `fai-tech:storage-probe:${crypto.randomUUID()}`;
  try {
    localStorage.setItem(probe, '1');
    const readable = localStorage.getItem(probe) === '1';
    localStorage.removeItem(probe);
    results.push({ id: 'preferences', title: 'حفظ تفضيلات هذا الجهاز', status: readable ? 'pass' : 'warning',
      detail: readable ? 'يمكن قراءة تفضيلات العرض وحفظها محليًا.' : 'تعذر التحقق من حفظ التفضيلات محليًا.' });
  } catch {
    results.push({ id: 'preferences', title: 'حفظ تفضيلات هذا الجهاز', status: 'warning', detail: 'التخزين المحلي محظور أو ممتلئ. قد لا تستمر تفضيلات العرض بعد إغلاق الصفحة.' });
  }
  try {
    if (!navigator.storage?.estimate) throw new Error('Unavailable');
    const estimate = await withTimeout(navigator.storage.estimate());
    if (!estimate.quota) throw new Error('Unavailable');
    const usage = estimate.usage || 0;
    const ratio = usage / estimate.quota;
    results.push({ id: 'quota', title: 'مساحة التخزين المحلية', status: ratio >= .85 ? 'warning' : 'pass',
      detail: `المستخدم تقريبًا ${(usage / 1048576).toFixed(1)} ميجابايت من ${(estimate.quota / 1048576).toFixed(0)} ميجابايت متاحة لهذا الموقع.${ratio >= .85 ? ' المساحة تقترب من الامتلاء.' : ''}` });
  } catch {
    results.push({ id: 'quota', title: 'مساحة التخزين المحلية', status: 'unavailable', detail: 'المتصفح لا يتيح تقدير المساحة في هذه الجلسة؛ هذه النتيجة لا تعني فشل التخزين.' });
  }
  return results;
}

export async function inspectAccountConnection(client: SupabaseClient): Promise<DiagnosticResult[]> {
  let userId: string;
  try {
    const { data, error } = await withTimeout(client.auth.getUser());
    if (error || !data.user) throw new Error('Session unavailable');
    userId = data.user.id;
  } catch {
    return [
      { id: 'session', title: 'التحقق من جلسة الدخول', status: navigator.onLine ? 'error' : 'unavailable', detail: 'تعذر التحقق من الجلسة على الخادم. راجع اتصالك، ثم أعد الفحص أو سجّل الدخول مجددًا.' },
      { id: 'database', title: 'قراءة قاعدة البيانات', status: 'unavailable', detail: 'لم يُنفّذ فحص القراءة لعدم التحقق من جلسة المستخدم.' },
    ];
  }
  const results: DiagnosticResult[] = [{ id: 'session', title: 'التحقق من جلسة الدخول', status: 'pass', detail: 'تم التحقق من حساب المستخدم لدى خادم المصادقة.' }];
  const controller = new AbortController();
  try {
    const start = performance.now();
    const { data, error } = await withTimeout(client.from('profiles').select('id,is_active').eq('id', userId).abortSignal(controller.signal).single());
    if (error || !data) throw new Error('Read unavailable');
    const latency = Math.round(performance.now() - start);
    results.push({ id: 'database', title: 'قراءة قاعدة البيانات', status: data.is_active === false ? 'error' : latency > 2000 ? 'warning' : 'pass',
      detail: data.is_active === false ? 'حساب المستخدم موقوف. راجع مدير النظام.' : `نجحت قراءة ملف المستخدم خلال ${latency} مللي ثانية.${latency > 2000 ? ' الاتصال أبطأ من المعتاد.' : ''} الفحص لا ينفّذ أي تعديل مالي.` });
  } catch {
    results.push({ id: 'database', title: 'قراءة قاعدة البيانات', status: 'error', detail: 'تعذرت قراءة ملف المستخدم أو انتهت مهلة الاتصال. راجع الشبكة وصلاحية الحساب ثم أعد الفحص.' });
  } finally { controller.abort(); }
  return results;
}
