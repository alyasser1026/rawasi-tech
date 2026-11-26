"use client";

import React, { useEffect, useState } from 'react';
import {
  acknowledgePrivacyNotice,
  getOrCreateBrowserSessionId,
  hasAcknowledgedPrivacyNotice,
} from './browser-session';

export default function SessionPrivacyBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    getOrCreateBrowserSessionId();
    if (!hasAcknowledgedPrivacyNotice()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    acknowledgePrivacyNotice();
    setVisible(false);
  };

  return (
    <>
      <style>{`
        .phi-privacy-banner {
          position: fixed;
          bottom: 22px;
          right: 20px;
          z-index: 95;
          max-width: min(370px, calc(100vw - 240px));
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(12px);
          color: #0f172a;
          border: 1.5px solid #cbd5e1;
          border-radius: 16px;
          padding: 12px 14px;
          box-shadow: 0 18px 42px -12px rgba(15, 23, 42, 0.28);
          display: flex;
          flex-direction: column;
          gap: 10px;
          direction: rtl;
          font-family: 'Cairo', -apple-system, sans-serif;
        }
        @media (max-width: 980px) {
          .phi-privacy-banner {
            bottom: calc(130px + env(safe-area-inset-bottom, 0px));
            right: 12px;
            left: 12px;
            max-width: none;
            padding: 10px 12px;
            gap: 8px;
          }
        }
      `}</style>
      <div
        className="phi-privacy-banner"
        role="region"
        aria-label="إشعار الخصوصية وحفظ الجلسة"
      >
        <p style={{ margin: 0, fontSize: '0.78rem', lineHeight: 1.65, fontWeight: 700, color: '#334155' }}>
          🍪 نحفظ معرّف جلسة محلي على متصفحك (Cookie / localStorage) للاحتفاظ بسلة المشتريات والمحادثة
          عند عودتك حتى لو تغيّر اتصال الإنترنت، دون جمع هويتك الشخصية قبل تسجيلك أو إتمام طلبك.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              background: 'linear-gradient(135deg, #f97316 0%, #c75517 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            فهمت 👍
          </button>
        </div>
      </div>
    </>
  );
}
