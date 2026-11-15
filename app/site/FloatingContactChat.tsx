"use client";

import React, { useEffect, useRef, useState } from 'react';
import { rememberVisitorContact } from '@/lib/client-device-info';
import type { ChatMessageItem } from '@/app/api/website-chat/route';

const CHAT_SESSION_STORAGE_KEY = 'phi_live_chat_session_v1';

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
  const [visitorName, setVisitorName] = useState(defaultName);
  const [visitorPhone, setVisitorPhone] = useState(defaultPhone);
  const [started, setStarted] = useState(false);
  const [inputMsg, setInputMsg] = useState('');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const listRef = useRef<HTMLDivElement | null>(null);
  const lastMsgCountRef = useRef<number>(0);

  useEffect(() => {
    if (defaultName && !visitorName) setVisitorName(defaultName);
    if (defaultPhone && !visitorPhone) setVisitorPhone(defaultPhone);
  }, [defaultName, defaultPhone, visitorName, visitorPhone]);

  // Restore saved chat session from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.sessionId && parsed?.visitorName && parsed?.visitorPhone) {
          setSessionId(parsed.sessionId);
          setVisitorName(parsed.visitorName);
          setVisitorPhone(parsed.visitorPhone);
          setStarted(true);
          if (Array.isArray(parsed.messages)) {
            setMessages(parsed.messages);
            lastMsgCountRef.current = parsed.messages.length;
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Poll for live replies from Admin when a session is active
  useEffect(() => {
    if (!started || !sessionId) return;

    const fetchLatest = async () => {
      try {
        const res = await fetch(`/api/website-chat?sessionId=${encodeURIComponent(sessionId)}`);
        if (!res.ok) return;
        const data = await res.json();
        const serverMsgs: ChatMessageItem[] | undefined = data?.session?.messages;
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
                visitorName,
                visitorPhone,
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
  }, [started, sessionId, chatOpen, visitorName, visitorPhone]);

  useEffect(() => {
    if (chatOpen) {
      setUnreadCount(0);
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      }, 60);
    }
  }, [chatOpen, messages.length]);

  const sendMessage = async (textToSend: string) => {
    const cleanName = visitorName.trim();
    const cleanPhone = visitorPhone.trim();
    const cleanText = textToSend.trim();

    if (!cleanName || cleanPhone.replace(/\D/g, '').length < 8) {
      setErrorMsg('يرجى كتابة الاسم ورقم الجوال الصحيح لبدء المحادثة');
      return;
    }
    if (!cleanText) return;

    setErrorMsg('');
    setSending(true);

    rememberVisitorContact({ name: cleanName, phone: cleanPhone });

    try {
      const res = await fetch('/api/website-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          visitorName: cleanName,
          visitorPhone: cleanPhone,
          message: cleanText,
          pageUrl: typeof window !== 'undefined' ? window.location.pathname : contextLabel,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'تعذر إرسال الرسالة');
      }

      const activeSid = data.sessionId;
      const updatedMsgs: ChatMessageItem[] = data.session?.messages || [];
      setSessionId(activeSid);
      setStarted(true);
      setMessages(updatedMsgs);
      lastMsgCountRef.current = updatedMsgs.length;
      setInputMsg('');

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          CHAT_SESSION_STORAGE_KEY,
          JSON.stringify({
            sessionId: activeSid,
            visitorName: cleanName,
            visitorPhone: cleanPhone,
            messages: updatedMsgs,
          })
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  const handleStartForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const initialQuestion =
      inputMsg.trim() || `مرحباً، أرغب في الاستفسار من فريق فاي تك (${contextLabel})`;
    await sendMessage(initialQuestion);
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
    'استفسار عن أسعار منتجات التشطيب والسمارت هوم',
    'عروض الشقق والوحدات العقارية المتاحة',
    'طلب معاينة ومقايسة تشطيب / مقاولات',
    'استفسار عن منظومة حساسات الغاز والمياه والحريق',
  ];

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
          position: fixed;
          bottom: 84px;
          left: 20px;
          width: min(calc(100vw - 24px), 370px);
          max-height: min(540px, calc(100dvh - 150px));
          background: #ffffff;
          color: #14181b;
          border-radius: 20px;
          border: 1px solid #e3e6e9;
          box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.45);
          z-index: 99970;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          direction: rtl;
          font-family: 'Cairo', -apple-system, sans-serif;
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

      {/* Live Chat Window */}
      {chatOpen && (
        <div className="phi-chat-window" role="dialog" aria-label="المحادثة الحية مع فاي تك">
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #14181b 0%, #1e252b 100%)',
              color: '#ffffff',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '2px solid #f97316',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 10px #22c55e',
                }}
              />
              <div>
                <strong style={{ display: 'block', fontSize: '0.92rem', lineHeight: 1.2 }}>
                  المحادثة الحية — فاي تك الهندسية
                </strong>
                <span style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>
                  متصل الآن • يرد عليك مهندس المبيعات والدعم مباشرة
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.1)',
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

          {!started ? (
            /* Step 1: Enter Name & Phone to start chat */
            <form
              onSubmit={handleStartForm}
              style={{
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '11px',
                overflowY: 'auto',
              }}
            >
              <div
                style={{
                  background: '#fff3ea',
                  border: '1px solid #fed7aa',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  fontSize: '0.8rem',
                  color: '#7c2d12',
                  lineHeight: 1.55,
                }}
              >
                👋 أهلاً بك! اكتب <strong>اسمك ورقم جوالك</strong> وابدأ المحادثة الحية فوراً مع مهندسي فاي تك.
              </div>

              <input
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder="الاسم الكريم *"
                required
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #e3e6e9',
                  fontSize: '16px',
                  fontWeight: 700,
                }}
              />

              <input
                value={visitorPhone}
                onChange={(e) => setVisitorPhone(e.target.value)}
                placeholder="رقم الجوال (للتواصل والواتساب) *"
                dir="ltr"
                inputMode="tel"
                required
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #e3e6e9',
                  fontSize: '16px',
                  fontWeight: 700,
                  textAlign: 'right',
                }}
              />

              <textarea
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                placeholder="اكتب سؤالك أو استفسارك هنا..."
                rows={2}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #e3e6e9',
                  fontSize: '16px',
                  resize: 'none',
                }}
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setInputMsg(q)}
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '4px 9px',
                      borderRadius: '999px',
                      border: '1px solid #fed7aa',
                      background: inputMsg === q ? '#ea580c' : '#fff3ea',
                      color: inputMsg === q ? '#ffffff' : '#c75517',
                      cursor: 'pointer',
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>

              {errorMsg && (
                <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 700 }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={sending}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #f97316, #c75517)',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '0.92rem',
                  cursor: sending ? 'wait' : 'pointer',
                }}
              >
                {sending ? 'جاري بدء المحادثة...' : '🚀 بدء المحادثة الفورية'}
              </button>
            </form>
          ) : (
            /* Step 2: Active Live Chat Thread */
            <>
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
                  minHeight: '230px',
                }}
              >
                {messages.map((m) => {
                  const isVisitor = m.sender === 'visitor';
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: isVisitor ? 'flex-start' : 'flex-end',
                        maxWidth: '86%',
                        background: isVisitor ? '#ea580c' : '#ffffff',
                        color: isVisitor ? '#ffffff' : '#14181b',
                        border: isVisitor ? 'none' : '1px solid #e2e8f0',
                        borderRadius: isVisitor ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        padding: '9px 12px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          opacity: 0.85,
                          marginBottom: '3px',
                          color: isVisitor ? '#ffedd5' : '#c75517',
                        }}
                      >
                        {m.senderName}
                      </div>
                      <div style={{ fontSize: '0.84rem', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={handleSendInChat}
                style={{
                  padding: '10px 12px',
                  borderTop: '1px solid #e3e6e9',
                  background: '#ffffff',
                  display: 'flex',
                  gap: '8px',
                }}
              >
                <input
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  placeholder="اكتب رسالتك..."
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #e3e6e9',
                    fontSize: '16px',
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !inputMsg.trim()}
                  style={{
                    padding: '0 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#ea580c',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                  }}
                >
                  إرسال
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
