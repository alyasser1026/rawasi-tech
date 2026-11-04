"use client";
import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '@/lib/supabase';
import { THEME } from '@/lib/theme';

export default function SignaturePad({ userId, currentSignature, onSaved }: { userId: string, currentSignature?: string, onSaved?: () => void }) {
  const sigCanvas = useRef<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('error');

  // مسح اللوحة
  const clear = () => {
    sigCanvas.current?.clear();
    setMessage('');
  };

  // حفظ التوقيع ورفعه لـ Supabase
  const save = async () => {
    if (sigCanvas.current?.isEmpty()) {
      setMessageType('error');
      setMessage('الرجاء التوقيع أولاً قبل الحفظ');
      return;
    }

    setIsSaving(true);
    setMessage('');

    try {
      // 1. تحويل التوقيع لصورة (PNG بخلفية شفافة)
      const dataURL = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      const blob = await (await fetch(dataURL)).blob();

      // 2. اسم الملف (بنضيف وقت عشان لو غير توقيعه الصورة تتحدث فوراً)
      const fileName = `user_${userId}_${Date.now()}.png`;

      // 3. رفع الصورة لـ Bucket اللي عملناه
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(fileName, blob, { upsert: true, contentType: 'image/png' });

      if (uploadError) throw uploadError;

      // 4. جلب الرابط العام (Public URL) للصورة
      const { data: publicUrlData } = supabase.storage.from('signatures').getPublicUrl(fileName);
      const signatureUrl = publicUrlData.publicUrl;

      // 5. حفظ الرابط في جدول Profiles
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ signature_url: signatureUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      setMessageType('success');
      setMessage('تم حفظ توقيعك بنجاح');
      if (onSaved) onSaved();

    } catch (error: any) {
      console.error("Signature Save Error:", error);
      setMessageType('error');
      setMessage('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '15px', border: `1px solid ${THEME.border}`, maxWidth: '500px', margin: '0 auto', width: '100%' }}>
      <h3 style={{ margin: '0 0 15px 0', color: THEME.primary, textAlign: 'center' }}>لوحة التوقيع الإلكتروني</h3>
      
      {/* لو عنده توقيع قديم بنعرضهوله كمعاينة */}
      {currentSignature && (
        <div style={{ marginBottom: '15px', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--fs-sm)', color: '#64748b', margin: '0 0 5px 0' }}>توقيعك الحالي المعتمد:</p>
          <img src={currentSignature} alt="Current Signature" style={{ maxHeight: '60px', background: 'white', padding: '5px', borderRadius: '8px', border: '1px dashed #cbd5e1' }} />
        </div>
      )}

      {/* الـ Canvas اللي بيترسم فيه */}
      <div style={{ border: '2px dashed #cbd5e1', borderRadius: '10px', background: 'white', overflow: 'hidden', marginBottom: '15px', display: 'flex', justifyContent: 'center' }}>
        <SignatureCanvas 
          ref={sigCanvas}
          penColor={THEME.primary}
          canvasProps={{ width: 450, height: 150, className: 'sigCanvas' }} 
        />
      </div>

      {message && <p style={{ textAlign: 'center', margin: '0 0 15px 0', fontSize: 'var(--fs-sm)', fontWeight: 'bold', color: messageType === 'success' ? THEME.success : THEME.ruby }}>{message}</p>}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={save} disabled={isSaving} style={{ flex: 2, background: THEME.primary, color: 'white', padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
          {isSaving ? 'جاري الحفظ...' : 'اعتماد التوقيع'}
        </button>
        <button onClick={clear} style={{ flex: 1, background: '#e2e8f0', color: '#475569', padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
          مسح
        </button>
      </div>
    </div>
  );
}