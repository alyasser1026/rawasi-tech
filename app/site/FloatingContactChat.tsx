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

  const sessionMetaRef = useRef({ visitorName, visitorPhone, stage, pendingQuestion });
  sessionMetaRef.current = { visitorName, visitorPhone, stage, pendingQuestion };

  // Poll for live replies from Admin ONLY while chat is open and escalated to a human agent
  useEffect(() => {
    if (!sessionId || !chatOpen || (!escalatedToHuman && !botPaused)) return;

    const fetchLatest = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
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
            const meta = sessionMetaRef.current;
            window.localStorage.setItem(
              CHAT_SESSION_STORAGE_KEY,
              JSON.stringify({
                sessionId,
                visitorName: serverSession?.visitorName || meta.visitorName,
                visitorPhone: serverSession?.visitorPhone || meta.visitorPhone,
                stage: serverSession?.stage || meta.stage,
                pendingQuestion: serverSession?.pendingQuestion ?? meta.pendingQuestion,
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
    const timer = setInterval(fetchLatest, 12000);
    return () => clearInterval(timer);
  }, [sessionId, chatOpen, escalatedToHuman, botPaused]);

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
          background: linear-gradient(135deg, #f97316 0%, #c75517 100%);
          border: 1px solid rgba(255, 255, 255, 0.28);
          position: relative;
        }
        .phi-chat-window {
          color-scheme: light !important;
          position: fixed;
          bottom: 78px;
          left: 20px;
          width: min(calc(100vw - 32px), 430px);
          height: min(760px, calc(100dvh - 104px));
          max-height: calc(100dvh - 104px);
          background: #ffffff !important;
          color: #0f172a !important;
          border-radius: 26px;
          border: 1.5px solid #cbd5e1 !important;
          box-shadow: 0 28px 70px -14px rgba(15, 23, 42, 0.32), 0 0 0 1px rgba(255, 255, 255, 0.6) inset;
          z-index: 99970;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          direction: rtl;
          font-family: 'Cairo', -apple-system, sans-serif;
        }
        .phi-chat-input {
          color-scheme: light !important;
          flex: 1;
          background-color: #f8fafc !important;
          color: #0f172a !important;
          -webkit-text-fill-color: #0f172a !important;
          caret-color: #ea580c !important;
          border: 2px solid #94a3b8 !important;
          border-radius: 12px !important;
          padding: 11px 14px !important;
          font-size: 15px !important;
          font-weight: 700 !important;
          font-family: 'Cairo', -apple-system, sans-serif !important;
          line-height: 1.4 !important;
          box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.08) !important;
          transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease !important;
        }
        .phi-chat-input::placeholder {
          color: #64748b !important;
          -webkit-text-fill-color: #64748b !important;
          opacity: 1 !important;
          font-weight: 600 !important;
        }
        .phi-chat-input:focus {
          background-color: #ffffff !important;
          border-color: #ea580c !important;
          box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.2) !important;
          outline: none !important;
        }
        @media (max-width: 980px) {
          .phi-chat-window {
            bottom: calc(126px + env(safe-area-inset-bottom, 0px));
            left: 10px;
            right: 10px;
            width: auto;
            height: min(74dvh, calc(100dvh - 140px));
            max-height: calc(100dvh - 140px);
            border-radius: 22px;
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
              flexShrink: 0,
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
                background: escalatedToHuman ? '#fffbeb' : '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '6px',
                fontSize: '0.72rem',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontWeight: 800,
                  color: escalatedToHuman ? '#b45309' : botPaused ? '#0369a1' : '#334155',
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
                      border: '1px solid #cbd5e1',
                      background: showCategories ? '#e2e8f0' : '#ffffff',
                      color: '#334155',
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
                    border: '1px solid #fed7aa',
                    background: '#fff3ea',
                    color: '#c75517',
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
              minHeight: 0,
              padding: '16px',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
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
                    maxWidth: '90%',
                    background: isVisitor ? '#ea580c' : isHumanAdmin ? '#f0fdf4' : '#ffffff',
                    color: isVisitor ? '#ffffff' : '#0f172a',
                    border: isVisitor
                      ? 'none'
                      : isHumanAdmin
                        ? '1.5px solid #86efac'
                        : '1px solid #e2e8f0',
                    borderRadius: isVisitor ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    padding: '11px 14px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
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
                        color: isVisitor ? '#ffedd5' : isHumanAdmin ? '#15803d' : '#c75517',
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
                          background: isHumanAdmin ? '#dcfce7' : '#fff3ea',
                          color: isHumanAdmin ? '#166534' : '#c75517',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isHumanAdmin ? '👨‍💼 مهندس مختص' : '🤖 مستشار فاي تك'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.88rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
                              background: '#fff3ea',
                              border: '1px solid #fed7aa',
                              color: '#c75517',
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
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px 14px 14px 4px',
                  padding: '8px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#64748b',
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
                        border: '1px solid #fed7aa',
                        background: '#ffffff',
                        color: '#c75517',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(199,85,23,0.06)',
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
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1.5px solid #fed7aa',
                  padding: '8px 10px',
                  boxShadow: '0 2px 8px rgba(199,85,23,0.06)',
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
                    <strong style={{ fontSize: '0.74rem', color: '#c75517' }}>
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
                      color: '#ea580c',
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
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ffedd5' }}>
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
                              border: isActive ? '1.5px solid #ea580c' : '1px solid #e2e8f0',
                              background: isActive ? '#fff3ea' : '#f8fafc',
                              color: isActive ? '#c75517' : '#334155',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: isActive ? '0 1px 4px rgba(234,88,12,0.15)' : 'none',
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
                            background: '#fffaf5',
                            borderRadius: '8px',
                            border: '1px dashed #fed7aa',
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
                              borderBottom: '1px solid rgba(254, 215, 170, 0.6)',
                              paddingBottom: '4px',
                            }}
                          >
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9a3412' }}>
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
                                  border: '1px solid #fed7aa',
                                  background: '#ffffff',
                                  color: '#c75517',
                                  cursor: sending ? 'wait' : 'pointer',
                                  textAlign: 'right',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  transition: 'background-color 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#fff7ed';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#ffffff';
                                }}
                              >
                                <span style={{ color: '#ea580c' }}>←</span>
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
                background: '#fef2f2',
                borderTop: '1px solid #fecaca',
                fontSize: '0.76rem',
                color: '#dc2626',
                fontWeight: 700,
                flexShrink: 0,
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
              borderTop: '1.5px solid #cbd5e1',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
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
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                WebkitTextFillColor: '#0f172a',
                caretColor: '#ea580c',
              }}
            />
            <button
              type="submit"
              disabled={sending || !inputMsg.trim()}
              style={{
                padding: '11px 18px',
                borderRadius: '12px',
                border: 'none',
                background: sending || !inputMsg.trim() ? '#94a3b8' : 'linear-gradient(135deg, #f97316, #c75517)',
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
