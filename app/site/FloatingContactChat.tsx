"use client";

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  PHI_COPILOT_OPEN_EVENT,
  type CopilotOpenPayload,
} from './copilot-events';
import SessionPrivacyBanner from './SessionPrivacyBanner';

const StoreCopilotPanel = dynamic(() => import('./StoreCopilotPanel'), {
  ssr: false,
  loading: () => (
    <div
      className="phi-chat-window"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: '0.9rem',
        color: '#c75517',
        gap: '8px',
      }}
    >
      <span>🤖</span>
      <span>جارٍ تشغيل كوبايلوت المتجر الذكي...</span>
    </div>
  ),
});

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
  const [pendingContext, setPendingContext] = useState<CopilotOpenPayload | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOpenCopilot = (ev: Event) => {
      const detail = (ev as CustomEvent<CopilotOpenPayload>).detail || {};
      setPendingContext(detail);
      setChatOpen(true);
    };
    window.addEventListener(PHI_COPILOT_OPEN_EVENT, handleOpenCopilot);
    return () => {
      window.removeEventListener(PHI_COPILOT_OPEN_EVENT, handleOpenCopilot);
    };
  }, []);

  const handleConsumeProductContext = useCallback(() => {
    setPendingContext(null);
  }, []);

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

      {!chatOpen && <SessionPrivacyBanner />}

      <div className="phi-float-stack">
        <button
          type="button"
          className="phi-float-btn phi-float-chat"
          onClick={() => setChatOpen((o) => !o)}
          aria-label="مساعد المتجر الذكي وخدمة العملاء"
        >
          <span style={{ fontSize: '1.05rem' }}>{chatOpen ? '✕' : '🤖'}</span>
          <span>{chatOpen ? 'إغلاق المساعد' : 'مساعد المتجر الذكي'}</span>
        </button>
      </div>

      {chatOpen && (
        <StoreCopilotPanel
          whatsappNumber={whatsappNumber}
          defaultName={defaultName}
          defaultPhone={defaultPhone}
          contextLabel={contextLabel}
          initialProductContext={pendingContext}
          onConsumeProductContext={handleConsumeProductContext}
          onClose={() => setChatOpen(false)}
        />
      )}
    </>
  );
}
