"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Sparkles } from 'lucide-react';
import { notify } from '@/lib/notify';

export interface VoiceFormTriggerProps {
  modalType:
    | 'labor_log'
    | 'expense'
    | 'violation'
    | 'job_order'
    | 'material_issue'
    | 'purchase_order'
    | 'payment_voucher'
    | 'receipt_voucher';
  onFieldsParsed: (fields: Record<string, any>, transcript: string) => void;
  className?: string;
  label?: string;
}

export default function VoiceFormTrigger({
  modalType,
  onFieldsParsed,
  className = '',
  label = 'إدخال صوتي ذكي',
}: VoiceFormTriggerProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        notify.warning('متصفحك لا يدعم تسجيل الصوت من الميكروفون مباشرة.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Mic access error:', err);
      notify.error('تعذر الوصول إلى الميكروفون. يرجى السماح بالإذن في المتصفح.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('modal_type', modalType);

      const res = await fetch('/api/ai/voice-form', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'فشلت معالجة التسجيل الصوتي');
      }

      if (json.fields && Object.keys(json.fields).length > 0) {
        onFieldsParsed(json.fields, json.transcript);
        notify.success(`🎙️ تم فهم الصوت وملء الحقول: "${json.transcript}"`);
      } else {
        notify.info(`تم استخراج النص: "${json.transcript}"`);
      }
    } catch (err: any) {
      console.error('Voice processing error:', err);
      notify.error(`خطأ في التحليل الصوتي: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setDuration(0);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {!isRecording && !isProcessing && (
        <button
          type="button"
          onClick={startRecording}
          title="اضغط وتحدث لإدخال البيانات بالصوت"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
        >
          <Mic size={14} className="text-teal-600" />
          <span>{label}</span>
          <Sparkles size={12} className="text-amber-500 animate-pulse" />
        </button>
      )}

      {isRecording && (
        <button
          type="button"
          onClick={stopRecording}
          className="flex items-center gap-2 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition shadow-md animate-pulse cursor-pointer"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
          <Square size={12} className="fill-current" />
          <span>تحدث الآن... ({formatTime(duration)}) — اضغط للإنهاء</span>
        </button>
      )}

      {isProcessing && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold">
          <Loader2 size={13} className="animate-spin text-amber-600" />
          <span>جاري الاستماع واستخراج الحقول عبر الذكاء الاصطناعي...</span>
        </div>
      )}
    </div>
  );
}
