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
  senderName: '🤖 المستشار الهندسي — فاي تك',
  text: 'أهلاً بحضرتك في شركة فاي تك للمقاولات والتشطيبات والأنظمة الذكية 👷‍♂️✨\nتفضل بطرح سؤالك أو استفسارك مباشرةً وسأكون سعيداً بمساعدتك.',
  createdAt: '',
  isAutoReply: true,
};

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
  const [showQuickMenu, setShowQuickMenu] = useState(false);
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
    setShowQuickMenu(false);
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
    setShowQuickMenu(false);
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

  const cleanWa = (whatsappNumber || '201558888744').replace(/\D/g, '') || '201558888744';
  const waHref = `https://wa.me/${cleanWa}?text=${encodeURIComponent(
    `مرحباً شركة فاي تك، أستفسر من خلال الموقع (${contextLabel})`
  )}`;

  const QUICK_QUESTIONS = [
    '💰 أسعار التشطيب والمقايسة للمتر',
    '⚡ أسعار منتجات الكهرباء والسباكة والسمارت هوم',
    '🛠️ طلب تنفيذ أو صيانة (كهرباء/سباكة/تكييف)',
    '🚨 منظومة حساسات الغاز والمياه والحريق',
    '🏢 عروض الشقق والوحدات العقارية والتقسيط',
    '🛡️ الضمان الهندسي ومراحل الاستلام',
    '📍 عناوين الفروع ومواعيد العمل',
  ];

  const displayedMessages = messages.length > 0 ? messages : [INITIAL_WELCOME_MESSAGE];
  const visitorHasSpoken = messages.some((m) => m.sender === 'visitor');
  const canShowOptionsMenu = visitorHasSpoken && (stage === 'active' || stage === 'awaiting_phone');

  const inputPlaceholder =
    stage === 'awaiting_name'
      ? 'اكتب اسمك الكريم هنا...'
      : stage === 'awaiting_phone'
        ? 'اكتب رقم جوالك هنا (أو أي سؤال إضافي)...'
        : visitorHasSpoken
          ? 'اكتب رسالتك أو سؤالك...'
          : 'اكتب سؤالك أو استفسارك هنا...';

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
          bottom: 84px;
          left: 20px;
          width: min(calc(100vw - 24px), 395px);
          max-height: min(580px, calc(100dvh - 140px));
          background: #ffffff !important;
          color: #0f172a !important;
          border-radius: 20px;
          border: 1.5px solid #cbd5e1 !important;
          box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.35);
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
            bottom: calc(134px + env(safe-area-inset-bottom, 0px));
            left: 12px;
            right: 12px;
            width: auto;
            max-height: calc(100dvh - 165px);
          }
          .phi-float-btn {
            padding: 9px 13px;
            font-size: 0.78rem;
          }
        }
      `}</style>

      {/* Floating Buttons Stack (Bottom-Left) */}
      <div className="phi-float-stack">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="phi-float-btn phi-float-wa"
          aria-label="تواصل عبر واتساب"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.52 3.48A11.82 11.82 0 0 0 12.04 0C5.46 0 .1 5.36.1 11.94c0 2.1.55 4.16 1.6 5.97L0 24l6.26-1.64a11.9 11.9 0 0 0 5.78 1.48h.01c6.58 0 11.94-5.36 11.94-11.94 0-3.19-1.24-6.19-3.47-8.42zM12.05 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.72.97.99-3.62-.24-.37a9.86 9.86 0 0 1-1.52-5.25c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.13 1.03 7 2.9a9.83 9.83 0 0 1 2.9 7c0 5.45-4.44 9.85-9.9 9.85zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z" />
          </svg>
          <span>واتساب مباشر</span>
        </a>

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
                background: escalatedToHuman ? '#fffbeb' : '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
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
                    onClick={() => setShowQuickMenu((s) => !s)}
                    style={{
                      border: '1px solid #cbd5e1',
                      background: showQuickMenu ? '#e2e8f0' : '#ffffff',
                      color: '#334155',
                      borderRadius: '8px',
                      padding: '4px 8px',
                      fontSize: '0.71rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    📋 مواضيع سريعة
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

          {canShowOptionsMenu && showQuickMenu && (
            <div
              style={{
                padding: '8px 12px',
                background: '#fffaf5',
                borderBottom: '1px solid #fed7aa',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '5px',
              }}
            >
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={sending}
                  onClick={() => void sendMessage(q)}
                  style={{
                    fontSize: '0.71rem',
                    fontWeight: 800,
                    padding: '4px 9px',
                    borderRadius: '999px',
                    border: '1px solid #fed7aa',
                    background: '#ffffff',
                    color: '#c75517',
                    cursor: 'pointer',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Conversation Messages List */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              padding: '14px',
              overflowY: 'auto',
              background: '#f8fafc',
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
                    background: isVisitor ? '#ea580c' : isHumanAdmin ? '#f0fdf4' : '#ffffff',
                    color: isVisitor ? '#ffffff' : '#0f172a',
                    border: isVisitor
                      ? 'none'
                      : isHumanAdmin
                        ? '1.5px solid #86efac'
                        : '1px solid #e2e8f0',
                    borderRadius: isVisitor ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    padding: '10px 13px',
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

            {/* Quick replies shown ONLY when visitor has spoken and current message provides follow-ups */}
            {!sending &&
              visitorHasSpoken &&
              messages.length > 0 &&
              Array.isArray(messages[messages.length - 1]?.quickReplies) &&
              messages[messages.length - 1].quickReplies!.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '4px' }}>
                  {messages[messages.length - 1].quickReplies!.map((qr) => (
                    <button
                      key={qr}
                      type="button"
                      onClick={() => void sendMessage(qr, qr.includes('تحويل لمهندس'))}
                      style={{
                        fontSize: '0.73rem',
                        fontWeight: 800,
                        padding: '6px 10px',
                        borderRadius: '999px',
                        border: '1px solid #fed7aa',
                        background: '#ffffff',
                        color: '#c75517',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(199,85,23,0.08)',
                      }}
                    >
                      {qr}
                    </button>
                  ))}
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
