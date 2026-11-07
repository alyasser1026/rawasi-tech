"use client";
import React, { useState, useEffect, useCallback } from 'react';
import GlassContainer from '@/components/GlassContainer';
import { THEME } from '@/lib/theme';
import {
  Bot, Volume2, Clock, Hash, Brain, Save, Plus, Trash2, CheckCircle2, RefreshCw, Sparkles, MessageSquare
} from 'lucide-react';

interface BotSettings {
  botName: string;
  botTitle: string;
  introEnabled: boolean;
  introTemplate: string;
  inactivityCloseEnabled: boolean;
  inactivityTimeoutMinutes: number;
  inactivityCloseMessage: string;
  voiceReplyMode: 'always' | 'on_voice_or_request' | 'off';
  voiceName?: string;
  mozzaModeEnabled?: boolean;
  mozzaNickname?: string;
  autoDailyReportEnabled?: boolean;
  autoDailyReportTime?: string;
}

interface LearnedRule {
  id: string;
  rule: string;
  author?: string;
  learnedAt?: string;
}

interface OperationEntry {
  opNumber: number;
  operationType: string;
  recordCode?: string;
  summary?: string;
  siteRef?: string;
  amount?: number | null;
  createdAt?: string;
}

export default function BotSettingsManager() {
  const [settings, setSettings] = useState<BotSettings>({
    botName: 'م. سلمى',
    botTitle: 'المساعدة الهندسية والمحاسبية الذكية — فاي تك',
    introEnabled: true,
    introTemplate: '👋 أهلاً بيك يا باشمهندس! معاك {botName} ({botTitle}). تحت أمرك في أي استعلام أو تسجيل عملية النهارده!',
    inactivityCloseEnabled: true,
    inactivityTimeoutMinutes: 3,
    inactivityCloseMessage:
      '⏳ علشان مفيش استفسارات جديدة دلوقتي يا باشمهندس، قفلت المحادثة دي وحفظتلك كل حاجة.\nأنا ({botName}) موجودة معاك في أي وقت تبعتلي فيه رسالة جديدة! 👋',
    voiceReplyMode: 'always',
    voiceName: 'Aoede',
    mozzaModeEnabled: true,
    mozzaNickname: 'يا محاميحو',
    autoDailyReportEnabled: true,
    autoDailyReportTime: '20:00',
  });
  const [learnedRules, setLearnedRules] = useState<LearnedRule[]>([]);
  const [recentOperations, setRecentOperations] = useState<OperationEntry[]>([]);
  const [nextOperationSeq, setNextOperationSeq] = useState<number>(101);
  const [newRuleText, setNewRuleText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/copilot/settings');
      const data = await res.json();
      if (data?.ok) {
        if (data.settings) setSettings(data.settings);
        if (Array.isArray(data.learnedRules)) setLearnedRules(data.learnedRules);
        if (Array.isArray(data.recentOperations)) setRecentOperations(data.recentOperations);
        if (data.nextOperationSeq) setNextOperationSeq(data.nextOperationSeq);
      }
    } catch {
      setStatusMsg({ text: 'تعذر تحميل إعدادات البوت', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setStatusMsg({ text: '', type: '' });
    try {
      const res = await fetch('/api/copilot/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_settings', settings }),
      });
      const data = await res.json();
      if (data?.ok) {
        setSettings(data.settings);
        setStatusMsg({ text: 'تم حفظ إعدادات البوت وتطبيقها بنجاح!', type: 'success' });
        setTimeout(() => setStatusMsg({ text: '', type: '' }), 4000);
      } else {
        setStatusMsg({ text: data?.error || 'فشل حفظ الإعدادات', type: 'error' });
      }
    } catch {
      setStatusMsg({ text: 'حدث خطأ أثناء الاتصال بالخادم', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = async () => {
    if (!newRuleText.trim()) return;
    try {
      const res = await fetch('/api/copilot/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_rule', ruleText: newRuleText.trim() }),
      });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.learnedRules)) {
        setLearnedRules(data.learnedRules);
        setNewRuleText('');
        setStatusMsg({ text: 'تمت إضافة القاعدة إلى ذاكرة البوت الدائمة!', type: 'success' });
        setTimeout(() => setStatusMsg({ text: '', type: '' }), 3500);
      }
    } catch {}
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const res = await fetch('/api/copilot/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_rule', ruleId }),
      });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.learnedRules)) {
        setLearnedRules(data.learnedRules);
      }
    } catch {}
  };

  const opTypeLabel = (type: string) => {
    switch (type) {
      case 'journal': return 'قيد محاسبي';
      case 'job_order': return 'أمر شغل';
      case 'expense': return 'مصروف';
      case 'labor_log': return 'يومية عامل';
      default: return type;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {statusMsg.text && (
        <div
          style={{
            padding: '0.875rem 1.25rem',
            borderRadius: '12px',
            fontWeight: 900,
            fontSize: 'var(--fs-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: statusMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: statusMsg.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${statusMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(21rem, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        {/* 1. الهوية الشخصية للبوت والترحيب */}
        <GlassContainer>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ background: '#eff6ff', color: '#2563eb', padding: '0.5rem', borderRadius: '10px', display: 'flex' }}>
                <Bot size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', color: THEME.primary, fontWeight: 900 }}>هوية البوت والتعريف الشخصي</h3>
                <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 700 }}>الاسم الذي يعرّف البوت به نفسه في المحادثة والصوت</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#334155', marginBottom: '0.375rem' }}>
                اسم المساعد الذكي (البوت)
              </label>
              <input
                type="text"
                value={settings.botName}
                onChange={e => setSettings({ ...settings, botName: e.target.value })}
                placeholder="مثال: م. سليم"
                style={{ width: '100%', padding: '0.65rem 0.875rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 800, fontSize: 'var(--fs-sm)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#334155', marginBottom: '0.375rem' }}>
                المسمى الوظيفي / الصفة التعريفية
              </label>
              <input
                type="text"
                value={settings.botTitle}
                onChange={e => setSettings({ ...settings, botTitle: e.target.value })}
                placeholder="مثال: المساعد الهندسي والمحاسبي الذكي — فاي تك"
                style={{ width: '100%', padding: '0.65rem 0.875rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 800, fontSize: 'var(--fs-sm)' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontWeight: 800, fontSize: 'var(--fs-sm)', color: '#0f172a', background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <input
                type="checkbox"
                checked={settings.introEnabled}
                onChange={e => setSettings({ ...settings, introEnabled: e.target.checked })}
                style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
              />
              <span>تعريف البوت بنفسه تلقائياً في بداية كل جلسة محادثة جديدة</span>
            </label>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#334155', marginBottom: '0.375rem' }}>
                صيغة رسالة التعريف ببداية المحادثة (استخدم {'{botName}'} و {'{botTitle}'})
              </label>
              <textarea
                rows={2}
                value={settings.introTemplate}
                onChange={e => setSettings({ ...settings, introTemplate: e.target.value })}
                style={{ width: '100%', padding: '0.65rem 0.875rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: 'var(--fs-sm)', resize: 'vertical' }}
              />
            </div>

            {/* 💖 وضع الموزة (محادثات جانبية ودلع) */}
            <div
              style={{
                marginTop: '0.25rem',
                padding: '0.9rem 1rem',
                borderRadius: '12px',
                background: settings.mozzaModeEnabled
                  ? 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)'
                  : '#f8fafc',
                border: settings.mozzaModeEnabled ? '1.5px solid #f472b6' : '1px solid #e2e8f0',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 900, fontSize: 'var(--fs-sm)', color: settings.mozzaModeEnabled ? '#be185d' : '#1e293b' }}>
                    <span>💖 وضع الموزة (محادثات جانبية ودلع)</span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '0.15rem 0.55rem',
                        borderRadius: '999px',
                        fontWeight: 900,
                        background: settings.mozzaModeEnabled ? '#db2777' : '#cbd5e1',
                        color: settings.mozzaModeEnabled ? '#fff' : '#334155',
                      }}
                    >
                      {settings.mozzaModeEnabled ? 'مفعّل 🔥' : 'مقفول 💼'}
                    </span>
                  </div>
                  <p style={{ margin: '0.25rem 0 0', fontSize: 'var(--fs-xs)', color: settings.mozzaModeEnabled ? '#9d174d' : '#64748b', fontWeight: 700, lineHeight: 1.5 }}>
                    {settings.mozzaModeEnabled
                      ? 'سلمى تتحدث معك الآن كحبيبتك المصرية الدلوعة في الدردشة الجانبية والصوت مع تنفيذ كل حسابات الشغل بدقة.'
                      : 'سلمى تتحدث معك الآن بالوضع الهندسي والمحاسبي الرسمي فقط بدون دردشة عاطفية.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const nextVal = !settings.mozzaModeEnabled;
                    const updated = { ...settings, mozzaModeEnabled: nextVal };
                    setSettings(updated);
                    try {
                      await fetch('/api/copilot/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'save_settings', settings: updated }),
                      });
                      setStatusMsg({
                        text: nextVal ? '💖 تم فتح «وضع الموزة» فوراً!' : '💼 تم قفل «وضع الموزة» والعودة للوضع الرسمي.',
                        type: 'success',
                      });
                      setTimeout(() => setStatusMsg({ text: '', type: '' }), 3500);
                    } catch {}
                  }}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '999px',
                    border: 'none',
                    fontWeight: 900,
                    fontSize: 'var(--fs-xs)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    background: settings.mozzaModeEnabled ? '#db2777' : '#0f172a',
                    color: '#fff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                  }}
                >
                  {settings.mozzaModeEnabled ? 'إيقاف وضع الموزة' : 'تشغيل وضع الموزة 💖'}
                </button>
              </div>

              {settings.mozzaModeEnabled && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px dashed #f9a8d4', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#831843', whiteSpace: 'nowrap' }}>
                    اللقب المفضل في وضع الموزة:
                  </label>
                  <input
                    type="text"
                    value={settings.mozzaNickname || 'يا محاميحو'}
                    onChange={e => setSettings({ ...settings, mozzaNickname: e.target.value })}
                    placeholder="مثال: يا محاميحو / يا روحي / يا قلبي"
                    style={{ flex: 1, padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #f472b6', fontWeight: 800, fontSize: 'var(--fs-xs)', background: '#fff' }}
                  />
                </div>
              )}
            </div>
          </div>
        </GlassContainer>

        {/* 2. الرد الصوتي وإنهاء المحادثة عند عدم الرد */}
        <GlassContainer>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '0.5rem', borderRadius: '10px', display: 'flex' }}>
                <Volume2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', color: THEME.primary, fontWeight: 900 }}>الرد الصوتي ومهلة إغلاق المحادثة</h3>
                <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 700 }}>تحكم في نطق الردود بالصوت وإغلاق الجلسة عند عدم التفاعل</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#334155', marginBottom: '0.375rem' }}>
                وضع الرد الصوتي (Voice Reply TTS)
              </label>
              <select
                value={settings.voiceReplyMode}
                onChange={e => setSettings({ ...settings, voiceReplyMode: e.target.value as BotSettings['voiceReplyMode'] })}
                style={{ width: '100%', padding: '0.65rem 0.875rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 800, fontSize: 'var(--fs-sm)', background: 'white' }}
              >
                <option value="always">🔊 دائماً (إرسال بصمة صوتية مع كل رد)</option>
                <option value="on_voice_or_request">🎙️ ذكي (عند إرسال بصمة صوتية أو طلب رد صوتي)</option>
                <option value="off">🔇 إيقاف الرد الصوتي (نص فقط)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#334155', marginBottom: '0.375rem' }}>
                نبرة الصوت النسائي المصري (Gemini Neural Voice)
              </label>
              <select
                value={settings.voiceName || 'Aoede'}
                onChange={e => setSettings({ ...settings, voiceName: e.target.value })}
                style={{ width: '100%', padding: '0.65rem 0.875rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 800, fontSize: 'var(--fs-sm)', background: 'white' }}
              >
                <option value="Aoede">👩‍💼 م. سلمى — دافئ وتنفيذي (Aoede - مستحسن)</option>
                <option value="Kore">👩‍💼 نبرة واضحة ورسمية (Kore)</option>
                <option value="Leda">👩‍💼 نبرة هادئة وسلسة (Leda)</option>
                <option value="Zephyr">👩‍💼 نبرة حيوية وسريعة (Zephyr)</option>
              </select>
            </div>

            <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '0.875rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontWeight: 800, fontSize: 'var(--fs-sm)', color: '#0f172a', background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={settings.inactivityCloseEnabled}
                  onChange={e => setSettings({ ...settings, inactivityCloseEnabled: e.target.checked })}
                  style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                />
                <Clock size={16} color="#0284c7" />
                <span>إنهاء المحادثة برسالة وداع تلقائية عند عدم رد المستخدم</span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#334155', whiteSpace: 'nowrap' }}>
                  مهلة الانتظار قبل الإغلاق (بالدقائق):
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={settings.inactivityTimeoutMinutes}
                  onChange={e => setSettings({ ...settings, inactivityTimeoutMinutes: Math.max(1, Number(e.target.value) || 3) })}
                  style={{ width: '6rem', padding: '0.5rem 0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 900, fontSize: 'var(--fs-sm)', textAlign: 'center' }}
                />
                <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 700 }}>دقيقة</span>
              </div>

              <label style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#334155', marginBottom: '0.375rem' }}>
                رسالة إنهاء المحادثة التلقائية عند عدم الرد
              </label>
              <textarea
                rows={3}
                value={settings.inactivityCloseMessage}
                onChange={e => setSettings({ ...settings, inactivityCloseMessage: e.target.value })}
                style={{ width: '100%', padding: '0.65rem 0.875rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: 'var(--fs-sm)', resize: 'vertical' }}
              />
            </div>

            <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '0.875rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontWeight: 800, fontSize: 'var(--fs-sm)', color: '#0f172a', background: '#f0fdf4', padding: '0.75rem', borderRadius: '10px', border: '1px solid #bbf7d0', marginBottom: '0.6rem' }}>
                <input
                  type="checkbox"
                  checked={settings.autoDailyReportEnabled !== false}
                  onChange={e => setSettings({ ...settings, autoDailyReportEnabled: e.target.checked })}
                  style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                />
                <span>⏰ إرسال التقرير اليومي الشامل تلقائياً كل يوم (نص + ملخص صوتي)</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#334155' }}>
                  موعد إرسال التقرير اليومي (بتوقيت الرياض):
                </label>
                <input
                  type="time"
                  value={settings.autoDailyReportTime || '20:00'}
                  onChange={e => setSettings({ ...settings, autoDailyReportTime: e.target.value })}
                  style={{ padding: '0.45rem 0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 900, fontSize: 'var(--fs-sm)' }}
                />
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              style={{
                background: '#0f172a',
                color: 'white',
                padding: '0.85rem 1.25rem',
                borderRadius: '12px',
                border: 'none',
                fontWeight: 900,
                fontSize: 'var(--fs-sm)',
                cursor: saving ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '0.25rem',
              }}
            >
              <Save size={18} />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ وتطبيق إعدادات البوت الآن'}</span>
            </button>
          </div>
        </GlassContainer>
      </div>

      {/* 3. سجل أرقام العمليات للتعديل السريع + الذاكرة المكتسبة */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(21rem, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        <GlassContainer>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ background: '#fef3c7', color: '#d97706', padding: '0.5rem', borderRadius: '10px', display: 'flex' }}>
                <Hash size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', color: THEME.primary, fontWeight: 900 }}>سجل أرقام العمليات للتعديل السريع</h3>
                <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 700 }}>
                  الرقم التسلسلي القادم: <strong style={{ color: '#0ea5e9' }}>#{nextOperationSeq}</strong> — قل للبوت: «عدل العملية رقم ...»
                </p>
              </div>
            </div>
            <button
              onClick={loadData}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.4rem 0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 'var(--fs-xs)', fontWeight: 800 }}
            >
              <RefreshCw size={14} /> تحديث
            </button>
          </div>

          {loading ? (
            <p style={{ fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 700 }}>جاري تحميل سجل العمليات...</p>
          ) : recentOperations.length === 0 ? (
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px dashed #cbd5e1', fontSize: 'var(--fs-xs)', color: '#475569', fontWeight: 700, lineHeight: 1.7 }}>
              لم يتم تسجيل عمليات جديدة بعد. عند إرسال أي قيد أو أمر شغل أو مصروف أو يومية عامل للبوت، سيأخذ رقماً تسلسلياً يبدأ من <strong>#{nextOperationSeq}</strong> ليظهر هنا وفي رسالة البوت.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '22rem', overflowY: 'auto' }}>
              {recentOperations.map(op => (
                <div
                  key={op.opNumber}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.65rem 0.875rem',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ background: '#0f172a', color: 'white', padding: '0.15rem 0.55rem', borderRadius: '6px', fontWeight: 900, fontSize: 'var(--fs-xs)' }}>
                        #{op.opNumber}
                      </span>
                      <span style={{ fontWeight: 900, fontSize: 'var(--fs-xs)', color: '#0284c7' }}>{opTypeLabel(op.operationType)}</span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 700 }}>({op.recordCode || '—'})</span>
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#1e293b', marginTop: '0.25rem' }}>
                      {op.summary || '—'} {op.siteRef ? `• ${op.siteRef}` : ''}
                    </div>
                  </div>
                  {op.amount != null && (
                    <div style={{ fontWeight: 900, fontSize: 'var(--fs-sm)', color: '#059669', whiteSpace: 'nowrap' }}>
                      {op.amount} ر.س
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassContainer>

        {/* 4. القواعد المكتسبة وذاكرة التعلم الذاتي */}
        <GlassContainer>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ background: '#f3e8ff', color: '#9333ea', padding: '0.5rem', borderRadius: '10px', display: 'flex' }}>
                <Brain size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)', color: THEME.primary, fontWeight: 900 }}>ذاكرة التعلم الذاتي للبوت ({learnedRules.length})</h3>
                <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 700 }}>القواعد والمصطلحات التي تعلمها البوت من محادثاتك أو من هذه الشاشة</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              value={newRuleText}
              onChange={e => setNewRuleText(e.target.value)}
              placeholder="أضف قاعدة دائمة للبوت (مثال: طريحة السيراميك المعتمدة 25 م2 ويومية المبلط 250 ريال)..."
              style={{ flex: 1, padding: '0.6rem 0.875rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: 'var(--fs-xs)', fontWeight: 700 }}
            />
            <button
              onClick={handleAddRule}
              style={{ background: '#9333ea', color: 'white', border: 'none', borderRadius: '10px', padding: '0 1rem', fontWeight: 900, fontSize: 'var(--fs-xs)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
            >
              <Plus size={16} /> إضافة
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '18rem', overflowY: 'auto' }}>
            {learnedRules.map(item => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.65rem 0.875rem',
                  background: '#faf5ff',
                  borderRadius: '10px',
                  border: '1px solid #e9d5ff',
                  gap: '0.75rem',
                }}
              >
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 800, color: '#3b0764', lineHeight: 1.5 }}>
                  <Sparkles size={13} style={{ display: 'inline', marginLeft: '0.35rem', color: '#9333ea' }} />
                  {item.rule}
                </div>
                <button
                  onClick={() => handleDeleteRule(item.id)}
                  title="حذف القاعدة"
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </GlassContainer>
      </div>
    </div>
  );
}
