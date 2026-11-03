"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { inspectAccountConnection, inspectLocalEnvironment, type DiagnosticResult, type DiagnosticStatus } from '@/lib/system-diagnostics';

const STATUS: Record<DiagnosticStatus, { label: string; color: string }> = {
  pass: { label: 'سليم', color: '#15803d' },
  warning: { label: 'تنبيه', color: '#a16207' },
  error: { label: 'يتطلب تدخلًا', color: '#be123c' },
  unavailable: { label: 'غير متاح', color: '#64748b' },
};

export default function SystemHealthRadar() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [running, setRunning] = useState(true);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState<DiagnosticStatus | 'all'>('all');
  const generation = useRef(0);

  const run = useCallback(async () => {
    const current = ++generation.current;
    setRunning(true);
    try {
      const batches = await Promise.all([inspectLocalEnvironment(), inspectAccountConnection(supabase)]);
      if (current === generation.current) { setResults(batches.flat()); setCheckedAt(new Date()); }
    } catch {
      if (current === generation.current) {
        setResults([{ id: 'diagnostics', title: 'تشغيل الفحوصات', status: 'error', detail: 'تعذر إكمال الفحص في هذه الجلسة. أعد المحاولة.' }]);
      }
    } finally { if (current === generation.current) setRunning(false); }
  }, []);

  useEffect(() => { void run(); return () => { generation.current++; }; }, [run]);

  return <section aria-label="فحص النظام" aria-busy={running}>
    <div className="diagnostics-header">
      <div>
        <h2>فحص الاتصال والتخزين</h2>
        <p>نتائج فعلية لهذه الجلسة، تشمل الاتصال والحساب والتخزين المحلي. الفحص لا يراجع صحة الأرصدة أو أمان النظام بالكامل.</p>
      </div>
      <button type="button" className="workspace-button no-print" disabled={running} onClick={() => void run()}>{running ? 'جاري الفحص…' : '↻ إعادة الفحص'}</button>
    </div>
    <div className="diagnostics-counts">
      {(Object.keys(STATUS) as DiagnosticStatus[]).map(status => <div className="diagnostics-count" key={status}
        style={{ '--diagnostic-color': STATUS[status].color } as CSSProperties}>
        <span>{STATUS[status].label}</span><strong>{results.filter(result => result.status === status).length}</strong>
      </div>)}
    </div>
    <div className="diagnostics-filter no-print" role="group" aria-label="تصفية نتائج الفحص">
      <button type="button" className="workspace-button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>الكل</button>
      {(Object.keys(STATUS) as DiagnosticStatus[]).map(status => <button type="button" className="workspace-button" key={status}
        aria-pressed={filter === status} onClick={() => setFilter(status)}>{STATUS[status].label}</button>)}
    </div>
    <div aria-live="polite" aria-atomic="true" className="workspace-hint" style={{ marginBottom: 14 }}>
      {running ? 'الفحص جارٍ؛ النتائج السابقة تبقى ظاهرة حتى اكتماله.' : checkedAt ? `آخر فحص: ${checkedAt.toLocaleTimeString('ar-EG')} · غير المتاح يعني أن الفحص لم يكتمل أو أن المتصفح لا يدعمه.` : 'لم يكتمل الفحص.'}
    </div>
    {results.filter(result => filter === 'all' || result.status === filter).map(result => <article className="diagnostics-result" key={result.id}>
      <div className="diagnostics-result-heading"><h3>{result.title}</h3><span className="diagnostics-result-tag" style={{ color: STATUS[result.status].color }}>{STATUS[result.status].label}</span></div>
      <p>{result.detail}</p>
    </article>)}
    {!running && !results.some(result => filter === 'all' || result.status === filter) && <p className="workspace-empty">لا توجد نتائج ضمن هذا الفلتر.</p>}
  </section>;
}
