"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { rememberVisitorContact } from '@/lib/client-device-info';
import type { ChatMessageItem } from '@/app/api/website-chat/route';
import type { ChatConversationStage } from '@/app/site/chat-auto-responder';

const CHAT_SESSION_STORAGE_KEY = 'phi_live_chat_session_v2';

const INITIAL_WELCOME_MESSAGE: ChatMessageItem = {
  id: 'welcome-initial',
  sender: 'admin',
  senderName: '🤖 المستشار الهندسي الذكي — فاي تك',
  text: 'أهلاً بيك في شركة فاي تك للمقاولات والتشطيبات والسمارت هوم 👷‍♂️✨\nقولي بتفكر في إيه أو إيه اللي شاغل بالك في شقتك أو مشروعك، وأنا معاك خطوة بخطوة!',
  createdAt: '',
  isAutoReply: true,
};

export interface ChatQuestionCategory {
  id: string;
  title: string;
  icon: string;
  badge?: string;
  questions: Array<{ label: string; text: string }>;
}

export const CHAT_QUESTION_CATEGORIES: ChatQuestionCategory[] = [
  {
    id: 'finishing',
    title: 'التشطيب والمقايسة',
    icon: '🏗️',
    badge: 'مقايسات',
    questions: [
      { label: 'شقة ع الطوب (التكلفة والخطوات)', text: 'شقتي ع الطوب وعايز أعرف تكلفة وخطوات التشطيب' },
      { label: 'شقة نص تشطيب (ع المحارة)', text: 'شقتي نص تشطيب ع المحارة وعايز أستلمها ع المفتاح' },
      { label: 'نظام الدفعات والمستخلصات', text: 'إيه هو نظام الدفعات والمستخلصات وطرق السداد؟' },
      { label: 'المعاينة والرفع المساحي بالليزر', text: 'عايز مهندس يجي يعاين ويعمل رفع مساحي بالليزر' },
    ],
  },
  {
    id: 'smart_safety',
    title: 'السمارت هوم والأمان',
    icon: '📱',
    badge: 'بدون تكسير',
    questions: [
      { label: 'سمارت هوم بدون تكسير', text: 'عايز أقلب الشقة سمارت هوم من غير تكسير في الحيطان' },
      { label: 'حساسات الغاز والمية والمحبس الذكي', text: 'خايف من تسريب الغاز والمية وعايز حساسات مع محبس أوتوماتيك' },
      { label: 'كاميرات المراقبة وشبكات Wi-Fi', text: 'عايز كاميرات مراقبة وشبكة واي فاي قوية في كل الشقة' },
      { label: 'باقات السمارت الجاهزة بالمتجر', text: 'إيه هي باقات السمارت هوم المتكاملة المتاحة في المتجر؟' },
    ],
  },
  {
    id: 'maintenance',
    title: 'الصيانة والتنفيذ',
    icon: '🛠️',
    badge: '10 بنود',
    questions: [
      { label: 'سباكة وكشف تسريب بالموجات', text: 'عندي مشكلة سباكة أو تسريب مية ومحتاج كشف وإصلاح' },
      { label: 'علاج رطوبة وتقشير الحوائط', text: 'الحيطة عندي بتقشر وفيها رطوبة وعايز علاج جذري ونقاشة' },
      { label: 'كهرباء وقفلات لوحة التوزيع', text: 'عندي قفلة في الكهرباء والمفتاح بيفصل ومحتاج فني' },
      { label: 'تأسيس وصيانة تكييف (دكت/اسبليت)', text: 'عايز تأسيس أو صيانة تكييف كونسيلد أو اسبليت' },
      { label: 'بورسلان وسيراميك ورخام وديكور', text: 'محتاج فنيين لتركيب البورسلان بالليزر والديكورات' },
    ],
  },
  {
    id: 'real_estate',
    title: 'العقارات والتقسيط',
    icon: '🏢',
    badge: 'استلام فوري',
    questions: [
      { label: 'عروض الشقق والدوبلكس للبيع', text: 'إيه هي عروض الشقق والدوبلكس المتشطبة المتاحة عندكم؟' },
      { label: 'أنظمة التقسيط وسنوات السداد', text: 'إيه أنظمة التقسيط وسنوات السداد المتاحة في العقارات؟' },
      { label: 'مقرات إدارية وعيادات ومحلات', text: 'عندكم مكاتب أو عيادات أو مقرات تجارية للبيع؟' },
    ],
  },
  {
    id: 'guarantee_contact',
    title: 'الضمان والمهندس',
    icon: '🛡️',
    badge: 'إشراف',
    questions: [
      { label: 'الضمان الهندسي ومراحل الاستلام', text: 'إيه الضمان اللي بتقدموه على التأسيس والتشطيب؟' },
      { label: 'عناوين الفروع ومواعيد العمل', text: 'عناوين فروع فاي تك ومواعيد العمل وأرقام التواصل' },
      { label: '👨‍💼 تحويل مباشر لمهندس بشري', text: 'أرغب في التحدث المباشر مع المهندس المختص' },
    ],
  },
];

export default function FloatingContactChat({
  whatsappNumber = '201558888744',
  defaultName = '',
  defaultPhone = '',
  contextLabel = 'الموقع العام',
}: {
  whatsappNumber?: string;
  defaultName?: string;
  defaultPhone?: string;
  contextLabel?: string;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [stage, setStage] = useState<ChatConversationStage>('ask_question');
  const [pendingQuestion, setPendingQuestion] = useState<string>('');
  const [inputMsg, setInputMsg] = useState('');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [escalatedToHuman, setEscalatedToHuman] = useState(false);
  const [botPaused, setBotPaused] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastMsgCountRef = useRef<number>(0);

  // Restore saved chat session from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.sessionId && Array.isArray(parsed?.messages) && parsed.messages.length > 0) {
          setSessionId(parsed.sessionId);
          setVisitorName(parsed.visitorName || '');
          setVisitorPhone(parsed.visitorPhone || '');
          setStage(parsed.stage || 'ask_question');
          setPendingQuestion(parsed.pendingQuestion || '');
          setEscalatedToHuman(Boolean(parsed.escalatedToHuman));
          setBotPaused(Boolean(parsed.botPaused));
          setMessages(parsed.messages);
          lastMsgCountRef.current = parsed.messages.length;
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Poll for live replies from Admin when a session is active
  useEffect(() => {
    if (!sessionId) return;

    const fetchLatest = async () => {
      try {
        const res = await fetch(`/api/website-chat?sessionId=${encodeURIComponent(sessionId)}`);
        if (!res.ok) return;
        const data = await res.json();
        const serverSession = data?.session;
        const serverMsgs: ChatMessageItem[] | undefined = serverSession?.messages;
        if (serverSession) {
          setEscalatedToHuman(Boolean(serverSession.escalatedToHuman));
          setBotPaused(Boolean(serverSession.botPaused));
          if (serverSession.visitorName) setVisitorName(serverSession.visitorName);
          if (serverSession.visitorPhone) setVisitorPhone(serverSession.visitorPhone);
          if (serverSession.stage) setStage(serverSession.stage);
          if (serverSession.pendingQuestion !== undefined) setPendingQuestion(serverSession.pendingQuestion);
        }
        if (Array.isArray(serverMsgs) && serverMsgs.length > 0) {
          setMessages(serverMsgs);
          if (serverMsgs.length > lastMsgCountRef.current) {
            const newAdminMsgs = serverMsgs
              .slice(lastMsgCountRef.current)
              .filter((m) => m.sender === 'admin');
            if (!chatOpen && newAdminMsgs.length > 0) {
              setUnreadCount((c) => c + newAdminMsgs.length);
            }
            lastMsgCountRef.current = serverMsgs.length;
          }
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(
              CHAT_SESSION_STORAGE_KEY,
              JSON.stringify({
                sessionId,
                visitorName: serverSession?.visitorName || visitorName,
                visitorPhone: serverSession?.visitorPhone || visitorPhone,
                stage: serverSession?.stage || stage,
                pendingQuestion: serverSession?.pendingQuestion ?? pendingQuestion,
                escalatedToHuman: Boolean(serverSession?.escalatedToHuman),
                botPaused: Boolean(serverSession?.botPaused),
                messages: serverMsgs,
              })
            );
          }
        }
      } catch {
        // ignore network hiccups
      }
    };

    void fetchLatest();
    const timer = setInterval(fetchLatest, 4500);
    return () => clearInterval(timer);
  }, [sessionId, chatOpen, visitorName, visitorPhone, stage, pendingQuestion]);

  useEffect(() => {
    if (chatOpen) {
      setUnreadCount(0);
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
        inputRef.current?.focus();
      }, 60);
    }
  }, [chatOpen, messages.length, sending]);

  const handleResetChat = () => {
    setSessionId('');
    setVisitorName('');
    setVisitorPhone('');
    setStage('ask_question');
    setPendingQuestion('');
    setMessages([]);
    setEscalatedToHuman(false);
    setBotPaused(false);
    setShowCategories(false);
    setActiveCategory(null);
    setErrorMsg('');
    lastMsgCountRef.current = 0;
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const sendMessage = async (textToSend: string, requestHuman = false) => {
    const cleanText = textToSend.trim();
    if (!cleanText || sending) return;

    setErrorMsg('');
    setSending(true);
    setShowCategories(false);
    setActiveCategory(null);
    if (!requestHuman) setInputMsg('');

    try {
      const res = await fetch('/api/website-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          visitorName: visitorName.trim() || undefined,
          visitorPhone: visitorPhone.trim() || undefined,
          stage,
          pendingQuestion,
          previousMessages: messages,
          message: cleanText,
          requestHuman,
          pageUrl: typeof window !== 'undefined' ? window.location.pathname : contextLabel,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'تعذر إرسال الرسالة');
      }

      const activeSid = data.sessionId;
      const serverSession = data.session;
      const updatedMsgs: ChatMessageItem[] = serverSession?.messages || [];
      const updatedName = serverSession?.visitorName || visitorName;
      const updatedPhone = serverSession?.visitorPhone || visitorPhone;
      const updatedStage: ChatConversationStage = serverSession?.stage || stage;
      const updatedPending = serverSession?.pendingQuestion ?? '';

      setSessionId(activeSid);
      setVisitorName(updatedName);
      setVisitorPhone(updatedPhone);
      setStage(updatedStage);
      setPendingQuestion(updatedPending);
      setMessages(updatedMsgs);
      setEscalatedToHuman(Boolean(serverSession?.escalatedToHuman));
      setBotPaused(Boolean(serverSession?.botPaused));
      lastMsgCountRef.current = updatedMsgs.length;

      if (updatedName && updatedPhone) {
        rememberVisitorContact({ name: updatedName, phone: updatedPhone });
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          CHAT_SESSION_STORAGE_KEY,
          JSON.stringify({
            sessionId: activeSid,
            visitorName: updatedName,
            visitorPhone: updatedPhone,
            stage: updatedStage,
            pendingQuestion: updatedPending,
            escalatedToHuman: Boolean(serverSession?.escalatedToHuman),
            botPaused: Boolean(serverSession?.botPaused),
            messages: updatedMsgs,
          })
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء إرسال الرسالة');
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  };

  const handleSendInChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || sending) return;
    await sendMessage(inputMsg);
  };

  const displayedMessages = messages.length > 0 ? messages : [INITIAL_WELCOME_MESSAGE];
  const visitorHasSpoken = messages.some((m) => m.sender === 'visitor');
  const canShowOptionsMenu = visitorHasSpoken && (stage === 'active' || stage === 'awaiting_phone');

  const inputPlaceholder =
    stage === 'awaiting_name'
      ? 'اكتب اسمك الكريم هنا...'
      : stage === 'awaiting_phone'
        ? 'اكتب رقم تليفونك أو الواتساب هنا...'
        : visitorHasSpoken
          ? 'اكتب رسالتك أو سؤالك بالعامية براحتك...'
          : 'اسأل سؤالك بالعامية براحتك هنا...';

  return (
    <>
      <style>{`
        .phi-float-stack {
          position: fixed;
          bottom: 22px;
          left: 20px;
          z-index: 90;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
          direction: rtl;
          font-family: 'Cairo', -apple-system, sans-serif;
        }
        @media (max-width: 980px) {
          .phi-float-stack {
            bottom: calc(74px + env(safe-area-inset-bottom, 0px));
            left: 14px;
            gap: 8px;
          }
        }
        .phi-float-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: none;
          border-radius: 999px;
          padding: 10px 16px;
          font-family: inherit;
          font-weight: 800;
          font-size: 0.84rem;
          color: #ffffff;
          cursor: pointer;
          text-decoration: none;
          box-shadow: 0 10px 26px -6px rgba(0, 0, 0, 0.45);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .phi-float-btn:hover {
          transform: translateY(-2px);
        }
        .phi-float-wa {
          background: linear-gradient(135deg, #22c55e 0%, #15803d 100%);
          border: 1px solid rgba(255, 255, 255, 0.28);
        }
        .phi-float-chat {
          background: linear-gradient(135deg, #c9772d 0%, #a65c1b 100%);
          border: 1px solid rgba(255, 255, 255, 0.22);
          position: relative;
        }
        .phi-chat-window {
          color-scheme: dark !important;
          position: fixed;
          bottom: 84px;
          left: 20px;
          width: min(calc(100vw - 24px), 415px);
          max-height: min(640px, calc(100dvh - 110px));
          background: #10151d !important;
          color: #f1f5f9 !important;
          border-radius: 20px;
          border: 1.5px solid rgba(255, 255, 255, 0.12) !important;
          box-shadow: 0 28px 68px -12px rgba(0, 0, 0, 0.72);
          z-index: 99970;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          direction: rtl;
          font-family: 'Cairo', -apple-system, sans-serif;
        }
        .phi-chat-input {
          color-scheme: dark !important;
          flex: 1;
          background-color: #0d1118 !important;
          color: #f1f5f9 !important;
          -webkit-text-fill-color: #f1f5f9 !important;
          caret-color: #e08d3c !important;
          border: 1.5px solid rgba(255, 255, 255, 0.14) !important;
          border-radius: 12px !important;
          padding: 11px 14px !important;
          font-size: 15px !important;
          font-weight: 700 !important;
          font-family: 'Cairo', -apple-system, sans-serif !important;
          line-height: 1.4 !important;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.35) !important;
          transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease !important;
        }
        .phi-chat-input::placeholder {
          color: #64748b !important;
          -webkit-text-fill-color: #64748b !important;
          opacity: 1 !important;
          font-weight: 600 !important;
        }
        .phi-chat-input:focus {
          background-color: #0b0e13 !important;
          border-color: #c9772d !important;
          box-shadow: 0 0 0 3px rgba(201, 119, 45, 0.22) !important;
          outline: none !important;
        }
        @media (max-width: 980px) {
          .phi-chat-window {
            bottom: calc(134px + env(safe-area-inset-bottom, 0px));
            left: 10px;
            right: 10px;
            width: auto;
            max-height: calc(100dvh - 145px);
          }
          .phi-float-btn {
            padding: 9px 13px;
            font-size: 0.78rem;
          }
        }
      `}</style>

      {/* Floating Chat Button (Bottom-Left — WhatsApp moved exclusively to Contact section) */}
      <div className="phi-float-stack">
        <button
          type="button"
          className="phi-float-btn phi-float-chat"
          onClick={() => setChatOpen((o) => !o)}
          aria-label="الشات الحي وخدمة العملاء"
        >
          <span style={{ fontSize: '1.05rem' }}>{chatOpen ? '✕' : '💬'}</span>
          <span>{chatOpen ? 'إغلاق المحادثة' : 'شات حي فوري'}</span>
          {unreadCount > 0 && (
            <span
              style={{
                background: '#ef4444',
                color: '#fff',
                borderRadius: '999px',
                padding: '1px 7px',
                fontSize: '0.72rem',
                fontWeight: 900,
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Live Chat Window — Opens directly into conversation without upfront registration form */}
      {chatOpen && (
        <div className="phi-chat-window" role="dialog" aria-label="المحادثة الحية مع فاي تك">
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #c75517 0%, #ea580c 100%)',
              color: '#ffffff',
              padding: '13px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#4ade80',
                  boxShadow: '0 0 8px #4ade80',
                }}
              />
              <div>
                <strong style={{ display: 'block', fontSize: '0.92rem', lineHeight: 1.2 }}>
                  المحادثة الحية — فاي تك الهندسية
                </strong>
                <span style={{ fontSize: '0.72rem', color: '#ffedd5', fontWeight: 700 }}>
                  {botPaused
                    ? 'متصل الآن • يرد عليك المهندس المختص مباشرة'
                    : escalatedToHuman
                      ? 'تم التحويل للمهندس • بانتظار المداخلة البشرية'
                      : visitorName
                        ? `أهلاً بك يا أستاذ ${visitorName}`
                        : 'متصل الآن • اطرح سؤالك مباشرة'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {visitorHasSpoken && (
                <button
                  type="button"
                  onClick={handleResetChat}
                  title="بدء محادثة جديدة"
                  style={{
                    background: 'rgba(255,255,255,0.18)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                  }}
                >
                  🔄 جديد
                </button>
              )}
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '4px 9px',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Interactive Status & Escalation Bar — Shown only AFTER visitor starts talking */}
          {visitorHasSpoken && (
            <div
              style={{
                padding: '7px 12px',
                background: escalatedToHuman ? 'rgba(245, 158, 11, 0.12)' : '#141a23',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '6px',
                fontSize: '0.72rem',
              }}
            >
              <span
                style={{
                  fontWeight: 800,
                  color: escalatedToHuman ? '#fbbf24' : botPaused ? '#7dd3fc' : '#cbd5e1',
                }}
              >
                {escalatedToHuman
                  ? '🔔 تم تحويلك للمهندس المختص'
                  : botPaused
                    ? '👨‍💼 متابعة مهندس بشري مباشرة'
                    : stage === 'awaiting_name'
                      ? '🤝 نتشرف باسم حضرتك الكريم'
                      : stage === 'awaiting_phone'
                        ? '📱 بانتظار رقم جوالك للتنسيق'
                        : '🤖 مستشار هندسي تفاعلي'}
              </span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {canShowOptionsMenu && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCategories((s) => !s);
                      setTimeout(() => {
                        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
                      }, 50);
                    }}
                    style={{
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      background: showCategories ? 'rgba(201, 119, 45, 0.2)' : '#0d1118',
                      color: showCategories ? '#fed7aa' : '#e2e8f0',
                      borderRadius: '8px',
                      padding: '4px 8px',
                      fontSize: '0.71rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>📂</span>
                    <span>{showCategories ? 'إخفاء الأقسام ▲' : 'أقسام الأسئلة ▼'}</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void sendMessage('أرغب في التحدث المباشر مع المهندس المختص', true)}
                  style={{
                    border: '1px solid rgba(201, 119, 45, 0.42)',
                    background: 'rgba(201, 119, 45, 0.16)',
                    color: '#fed7aa',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    fontSize: '0.71rem',
                    fontWeight: 900,
                    cursor: sending ? 'wait' : 'pointer',
                  }}
                >
                  👨‍💼 تحويل لمهندس الآن
                </button>
              </div>
            </div>
          )}

          {/* Conversation Messages List */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              padding: '14px',
              overflowY: 'auto',
              background: '#0d1118',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              minHeight: '250px',
            }}
          >
            {displayedMessages.map((m) => {
              const isVisitor = m.sender === 'visitor';
              const isHumanAdmin = m.sender === 'admin' && m.isAutoReply === false;
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: isVisitor ? 'flex-start' : 'flex-end',
                    maxWidth: '88%',
                    background: isVisitor ? 'linear-gradient(135deg, #c9772d, #a65c1b)' : isHumanAdmin ? 'rgba(16, 185, 129, 0.14)' : '#141a23',
                    color: isVisitor ? '#ffffff' : '#f1f5f9',
                    border: isVisitor
                      ? 'none'
                      : isHumanAdmin
                        ? '1.5px solid rgba(52, 211, 153, 0.4)'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: isVisitor ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    padding: '10px 13px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.32)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px',
                      marginBottom: '4px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        opacity: 0.9,
                        color: isVisitor ? '#ffedd5' : isHumanAdmin ? '#6ee7b7' : '#f3a85b',
                      }}
                    >
                      {m.senderName}
                    </span>
                    {!isVisitor && (
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '999px',
                          background: isHumanAdmin ? 'rgba(16, 185, 129, 0.2)' : 'rgba(201, 119, 45, 0.18)',
                          color: isHumanAdmin ? '#6ee7b7' : '#fed7aa',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isHumanAdmin ? '👨‍💼 مهندس مختص' : '🤖 مستشار فاي تك'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                    {m.text}
                  </div>
                  {Array.isArray(m.actions) && m.actions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                      {m.actions.map((act, idx) =>
                        act.external || /^https?:|^wa\.me|^tel:/i.test(act.href) ? (
                          <a
                            key={idx}
                            href={act.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.73rem',
                              fontWeight: 800,
                              padding: '5px 10px',
                              borderRadius: '8px',
                              background: '#16a34a',
                              color: '#ffffff',
                              textDecoration: 'none',
                            }}
                          >
                            {act.label} ↗
                          </a>
                        ) : (
                          <Link
                            key={idx}
                            href={act.href}
                            onClick={() => setChatOpen(false)}
                            style={{
                              fontSize: '0.73rem',
                              fontWeight: 800,
                              padding: '5px 10px',
                              borderRadius: '8px',
                              background: 'rgba(201, 119, 45, 0.16)',
                              border: '1px solid rgba(224, 141, 60, 0.36)',
                              color: '#fed7aa',
                              textDecoration: 'none',
                            }}
                          >
                            {act.label} ←
                          </Link>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {sending && (
              <div
                style={{
                  alignSelf: 'flex-end',
                  background: '#141a23',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '14px 14px 14px 4px',
                  padding: '8px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#94a3b8',
                }}
              >
                🤖 جاري كتابة الرد الهندسي...
              </div>
            )}

            {/* Quick replies shown ONLY when visitor has spoken and current message provides follow-ups — compact chips */}
            {!sending &&
              visitorHasSpoken &&
              messages.length > 0 &&
              Array.isArray(messages[messages.length - 1]?.quickReplies) &&
              messages[messages.length - 1].quickReplies!.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', paddingTop: '4px' }}>
                  {messages[messages.length - 1].quickReplies!.slice(0, 3).map((qr) => (
                    <button
                      key={qr}
                      type="button"
                      onClick={() => void sendMessage(qr, qr.includes('تحويل لمهندس'))}
                      style={{
                        fontSize: '0.71rem',
                        fontWeight: 800,
                        padding: '4px 9px',
                        borderRadius: '999px',
                        border: '1px solid rgba(201, 119, 45, 0.38)',
                        background: '#141a23',
                        color: '#fed7aa',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                      }}
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}

            {/* أقسام الاستفسارات السريعة جوه المحادثة — كل قسم يفتح قسم */}
            {canShowOptionsMenu && (
              <div
                style={{
                  marginTop: '8px',
                  background: '#141a23',
                  borderRadius: '12px',
                  border: '1.5px solid rgba(201, 119, 45, 0.34)',
                  padding: '8px 10px',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.32)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  onClick={() => {
                    setShowCategories((s) => !s);
                    setTimeout(() => {
                      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
                    }, 50);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.88rem' }}>📂</span>
                    <strong style={{ fontSize: '0.74rem', color: '#f3a85b' }}>
                      أقسام الأسئلة السريعة
                    </strong>
                    <span style={{ fontSize: '0.64rem', color: '#94a3b8', fontWeight: 700 }}>
                      (كل قسم يفتح أسئلته)
                    </span>
                  </div>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#e08d3c',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      padding: '2px 6px',
                    }}
                  >
                    {showCategories ? 'إخفاء الأقسام ▲' : 'استعراض الأقسام ▼'}
                  </button>
                </div>

                {showCategories && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(201, 119, 45, 0.24)' }}>
                    {/* أزرار الأقسام الرئيسية */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {CHAT_QUESTION_CATEGORIES.map((cat) => {
                        const isActive = activeCategory === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveCategory(isActive ? null : cat.id);
                              setTimeout(() => {
                                if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
                              }, 50);
                            }}
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '5px 9px',
                              borderRadius: '8px',
                              border: isActive ? '1.5px solid #e08d3c' : '1px solid rgba(255, 255, 255, 0.1)',
                              background: isActive ? 'rgba(201, 119, 45, 0.2)' : '#0d1118',
                              color: isActive ? '#fed7aa' : '#cbd5e1',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: isActive ? '0 2px 8px rgba(201,119,45,0.22)' : 'none',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <span>{cat.icon}</span>
                            <span>{cat.title}</span>
                            <span style={{ fontSize: '0.62rem', opacity: 0.7 }}>{isActive ? '▲' : '▼'}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* الأسئلة الفرعية الخاصة بالقسم المختار — يفتح قسم */}
                    {activeCategory && (() => {
                      const currentCat = CHAT_QUESTION_CATEGORIES.find((c) => c.id === activeCategory);
                      if (!currentCat) return null;
                      return (
                        <div
                          style={{
                            marginTop: '8px',
                            padding: '8px 10px',
                            background: '#0d1118',
                            borderRadius: '8px',
                            border: '1px dashed rgba(201, 119, 45, 0.42)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderBottom: '1px solid rgba(201, 119, 45, 0.26)',
                              paddingBottom: '4px',
                            }}
                          >
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f3a85b' }}>
                              {currentCat.icon} {currentCat.title} — اختر سؤالك:
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveCategory(null);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#94a3b8',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                fontWeight: 700,
                              }}
                              title="إغلاق هذا القسم"
                            >
                              ✕ إغلاق القسم
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {currentCat.questions.map((q, idx) => (
                              <button
                                key={idx}
                                type="button"
                                disabled={sending}
                                onClick={() => {
                                  void sendMessage(q.text, q.text.includes('تحويل لمهندس'));
                                  setActiveCategory(null);
                                  setShowCategories(false);
                                }}
                                style={{
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(201, 119, 45, 0.34)',
                                  background: '#141a23',
                                  color: '#fed7aa',
                                  cursor: sending ? 'wait' : 'pointer',
                                  textAlign: 'right',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  transition: 'background-color 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#1e2633';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#141a23';
                                }}
                              >
                                <span style={{ color: '#e08d3c' }}>←</span>
                                <span>{q.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {errorMsg && (
            <div
              style={{
                padding: '6px 12px',
                background: 'rgba(239, 68, 68, 0.14)',
                borderTop: '1px solid rgba(248, 113, 113, 0.3)',
                fontSize: '0.76rem',
                color: '#fca5a5',
                fontWeight: 700,
              }}
            >
              ⚠️ {errorMsg}
            </div>
          )}

          {/* High-Visibility Input Bar */}
          <form
            onSubmit={handleSendInChat}
            style={{
              padding: '10px 12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              background: '#141a23',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              className="phi-chat-input"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder={inputPlaceholder}
              style={{
                backgroundColor: '#0d1118',
                color: '#f1f5f9',
                WebkitTextFillColor: '#f1f5f9',
                caretColor: '#e08d3c',
              }}
            />
            <button
              type="submit"
              disabled={sending || !inputMsg.trim()}
              style={{
                padding: '11px 18px',
                borderRadius: '12px',
                border: 'none',
                background: sending || !inputMsg.trim() ? '#334155' : 'linear-gradient(135deg, #c9772d, #e08d3c)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '0.88rem',
                cursor: sending || !inputMsg.trim() ? 'not-allowed' : 'pointer',
                flexShrink: 0,
              }}
            >
              إرسال
            </button>
          </form>
        </div>
      )}
    </>
  );
}
