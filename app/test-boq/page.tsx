"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestBoq() {
  const [logs, setLogs] = useState<{ type: 'info' | 'success' | 'error', msg: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const addLog = (type: 'info' | 'success' | 'error', msg: string) => {
    setLogs(prev => [...prev, { type, msg }]);
  };

  const runDiagnostic = async () => {
    setLoading(true);
    setLogs([]);
    addLog('info', 'بدء فحص الاتصال...');

    // 1. اختبار استعلام بسيط للتأكد من رؤية العمود boq_item_id
    const { error: columnCheckError } = await supabase
      .from('boq_budget')
      .select('boq_item_id')
      .limit(1);

    if (columnCheckError) {
      addLog('error', `فشل رؤية العمود: ${columnCheckError.message}`);
    } else {
      addLog('success', 'ممتاز! الـ API يرى عمود boq_item_id بوضوح.');
    }

    // 2. اختبار الحفظ
    addLog('info', 'تجربة حفظ بند جديد...');
    const { error: insertError } = await supabase
      .from('boq_budget')
      .insert([{ work_item: 'بند اختبار احترافي', item_type: 'رئيسي' }]);

    if (insertError) {
      addLog('error', `فشل الحفظ: ${insertError.message}`);
    } else {
      addLog('success', 'تم الحفظ بنجاح!');
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: 'auto', fontFamily: 'sans-serif' }}>
      <div style={{ background: '#f8fafc', padding: '30px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <h1 style={{ fontSize: 'var(--fs-xl)', color: '#1e293b', marginBottom: '20px' }}>لوحة تشخيص جدول المقايسات</h1>
        
        <button 
          onClick={runDiagnostic} 
          disabled={loading}
          style={{ 
            width: '100%', padding: '14px', background: loading ? '#94a3b8' : '#3b82f6', 
            color: 'white', border: 'none', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' 
          }}
        >
          {loading ? 'جاري الفحص...' : 'تشغيل فحص النظام الشامل'}
        </button>

        <div style={{ marginTop: '25px', background: '#0f172a', padding: '20px', borderRadius: '12px', height: '300px', overflowY: 'auto' }}>
          {logs.map((log, index) => (
            <div key={index} style={{ 
              color: log.type === 'error' ? '#f87171' : log.type === 'success' ? '#4ade80' : '#94a3b8',
              marginBottom: '10px', fontSize: 'var(--fs-sm)', fontFamily: 'monospace'
            }}>
              {log.msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}