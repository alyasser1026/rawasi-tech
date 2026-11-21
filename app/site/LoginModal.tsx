"use client";

import React, { Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLoginLogic } from '../login/login_logic';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function LoginForm({ onClose }: { onClose: () => void }) {
  const {
    isSignUp,
    toggleSignUp,
    fullName,
    setFullName,
    phone,
    setPhone,
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    handleAutoFill,
    handleSubmit,
  } = useLoginLogic({ stayOnPage: true, onSuccess: onClose });

  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="phi-auth-card" onClick={(e) => e.stopPropagation()}>
      <div className="phi-auth-accent-bar" aria-hidden="true" />

      {/* Header */}
      <div className="phi-auth-top">
        <div className="phi-auth-brand">
          <img src="/brand/phitech-mark-color.svg" alt="" />
          <div>
            <strong>فاي تك</strong>
            <small>PhiTech</small>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق نافذة تسجيل الدخول"
          className="phi-auth-close"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Heading */}
      <div className="phi-auth-head">
        <div className="phi-auth-title-row">
          <h2>{isSignUp ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</h2>
          <span className="phi-auth-pill">اختياري</span>
        </div>
        <p>
          {isSignUp
            ? 'سجّل بياناتك لحفظ طلباتك وسلتك ومتابعة مشاريعك مع فاي تك.'
            : 'التصفح متاح للجميع بدون تسجيل — وبعد الدخول يمكنك المتابعة أو فتح «بوابة الموظفين».'}
        </p>
      </div>

      {/* Clean Mode Switcher */}
      <div className="phi-auth-tabs" role="tablist" aria-label="وضع الحساب">
        <button
          type="button"
          role="tab"
          aria-selected={!isSignUp}
          className={!isSignUp ? 'is-on' : ''}
          onClick={() => {
            if (isSignUp) toggleSignUp();
          }}
        >
          تسجيل الدخول
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isSignUp}
          className={isSignUp ? 'is-on' : ''}
          onClick={() => {
            if (!isSignUp) toggleSignUp();
          }}
        >
          إنشاء حساب
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="phi-auth-form">
        {isSignUp && (
          <div className="phi-auth-grid2">
            <label className="phi-auth-field">
              <span>الاسم الكامل</span>
              <input
                type="text"
                className="phi-auth-input"
                placeholder="مثال: محمد ياسر"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required={isSignUp}
                autoComplete="name"
              />
            </label>

            <label className="phi-auth-field">
              <span>رقم الجوال (واتساب)</span>
              <input
                type="tel"
                dir="ltr"
                className="phi-auth-input is-ltr"
                placeholder="+20 1X XXX XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required={isSignUp}
                autoComplete="tel"
              />
            </label>
          </div>
        )}

        <label className="phi-auth-field">
          <span>اسم المستخدم أو البريد الإلكتروني</span>
          <input
            type="text"
            dir="ltr"
            className="phi-auth-input is-ltr"
            placeholder="name@company.com"
            value={email}
            onAnimationStart={handleAutoFill}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </label>

        <label className="phi-auth-field">
          <span>كلمة المرور</span>
          <div className="phi-auth-pass-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              className="phi-auth-input is-ltr is-password"
              placeholder="••••••••"
              value={password}
              onAnimationStart={handleAutoFill}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              className="phi-auth-eye"
            >
              {showPassword ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </label>

        <button type="submit" className="phi-auth-submit" disabled={isLoading}>
          {isLoading ? (
            <span className="phi-auth-loading">
              <span className="phi-auth-spinner" />
              جاري التحقق...
            </span>
          ) : isSignUp ? (
            'إنشاء الحساب والمتابعة'
          ) : (
            'تسجيل الدخول'
          )}
        </button>
      </form>

      <button type="button" onClick={onClose} className="phi-auth-dismiss">
        <span>متابعة التصفح بدون تسجيل</span>
        <span aria-hidden="true">←</span>
      </button>
    </div>
  );
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="phi-auth-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="تسجيل الدخول"
    >
      <style>{`
        .phi-auth-overlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background: rgba(14, 18, 22, 0.42);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          overflow-y: auto;
          direction: rtl;
          font-family: 'Cairo', -apple-system, 'Segoe UI', sans-serif;
          animation: phiAuthFade 0.2s ease-out;
        }

        @keyframes phiAuthFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes phiAuthRise {
          from { opacity: 0; transform: translateY(14px) scale(0.975); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .phi-auth-card {
          position: relative;
          width: 100%;
          max-width: 400px;
          background: linear-gradient(180deg, #fffaf5 0%, #ffffff 36%, #ffffff 100%);
          border: 1.5px solid #e3e6e9;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 32px 72px -24px rgba(15, 20, 25, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
          color: #14181b;
          overflow: hidden;
          box-sizing: border-box;
          animation: phiAuthRise 0.26s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .phi-auth-accent-bar {
          position: absolute;
          top: 0;
          inset-inline: 0;
          height: 3.5px;
          background: linear-gradient(90deg, #c75517 0%, #f97316 55%, #d97706 100%);
        }

        .phi-auth-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .phi-auth-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .phi-auth-brand img {
          height: 36px;
          width: auto;
          display: block;
        }

        .phi-auth-brand div {
          display: flex;
          flex-direction: column;
          line-height: 1.25;
        }

        .phi-auth-brand strong {
          font-size: 1rem;
          font-weight: 900;
          color: #14181b;
        }

        .phi-auth-brand small {
          font-size: 0.68rem;
          font-weight: 800;
          color: #c75517;
          letter-spacing: 0.14em;
          direction: ltr;
          text-align: right;
        }

        .phi-auth-close {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1px solid #e3e6e9;
          background: #ffffff;
          color: #47525c;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: all 0.16s ease;
        }

        .phi-auth-close:hover {
          background: #fff3ea;
          border-color: #fed7aa;
          color: #c75517;
        }

        .phi-auth-head {
          margin-bottom: 16px;
        }

        .phi-auth-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
        }

        .phi-auth-head h2 {
          margin: 0;
          font-size: 1.32rem;
          font-weight: 900;
          color: #14181b;
          line-height: 1.3;
        }

        .phi-auth-pill {
          display: inline-flex;
          align-items: center;
          padding: 2px 10px;
          border-radius: 999px;
          background: #fff3ea;
          border: 1px solid #fed7aa;
          color: #c75517;
          font-size: 0.72rem;
          font-weight: 800;
        }

        .phi-auth-head p {
          margin: 0;
          font-size: 0.83rem;
          font-weight: 600;
          color: #47525c;
          line-height: 1.6;
        }

        .phi-auth-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          background: #f6f5f3;
          border: 1px solid #e3e6e9;
          border-radius: 10px;
          padding: 4px;
          margin-bottom: 16px;
        }

        .phi-auth-tabs button {
          border: 0;
          background: transparent;
          color: #47525c;
          font-family: inherit;
          font-size: 0.84rem;
          font-weight: 800;
          min-height: 36px;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.16s ease;
        }

        .phi-auth-tabs button.is-on {
          background: #ffffff;
          color: #14181b;
          box-shadow: 0 4px 12px -6px rgba(15, 20, 25, 0.25);
        }

        .phi-auth-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .phi-auth-grid2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .phi-auth-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
          min-width: 0;
        }

        .phi-auth-field > span {
          font-size: 0.78rem;
          font-weight: 800;
          color: #14181b;
        }

        .phi-auth-pass-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .phi-auth-input {
          width: 100%;
          height: 44px;
          padding: 0 16px;
          border-radius: 10px;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
          color: #14181b;
          font-family: inherit;
          font-size: 0.92rem;
          font-weight: 700;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
        }

        .phi-auth-input.is-ltr {
          text-align: left;
        }

        .phi-auth-input.is-password {
          padding-inline-end: 44px;
        }

        .phi-auth-input::placeholder {
          color: #94a3b8;
          font-weight: 600;
        }

        .phi-auth-input:focus {
          background: #ffffff;
          border-color: #c75517;
          box-shadow: 0 0 0 3px rgba(199, 85, 23, 0.14);
        }

        .phi-auth-input:-webkit-autofill,
        .phi-auth-input:-webkit-autofill:hover,
        .phi-auth-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #f8fafc inset !important;
          -webkit-text-fill-color: #14181b !important;
          caret-color: #14181b !important;
          border-color: #cbd5e1 !important;
        }

        .phi-auth-eye {
          position: absolute;
          inset-inline-end: 8px;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 0;
          background: transparent;
          color: #64748b;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: color 0.15s ease, background 0.15s ease;
        }

        .phi-auth-eye:hover {
          color: #c75517;
          background: rgba(199, 85, 23, 0.08);
        }

        .phi-auth-submit {
          width: 100%;
          height: 48px;
          padding: 0 24px;
          margin-top: 4px;
          border: 0;
          border-radius: 10px;
          background: linear-gradient(135deg, #c75517 0%, #ea580c 100%);
          color: #ffffff;
          font-family: inherit;
          font-size: 1rem;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 12px 24px -12px rgba(199, 85, 23, 0.8);
          transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
        }

        .phi-auth-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.04);
          box-shadow: 0 16px 28px -12px rgba(199, 85, 23, 0.9);
        }

        .phi-auth-submit:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        .phi-auth-loading {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .phi-auth-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: phiAuthSpin 0.7s linear infinite;
        }

        @keyframes phiAuthSpin {
          to { transform: rotate(360deg); }
        }

        .phi-auth-dismiss {
          width: 100%;
          height: 44px;
          padding: 0 16px;
          margin-top: 12px;
          border-radius: 10px;
          border: 1px solid #e3e6e9;
          background: #f8fafc;
          color: #47525c;
          font-family: inherit;
          font-size: 0.84rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.16s ease;
        }

        .phi-auth-dismiss:hover {
          background: #ffffff;
          border-color: #cbd5e1;
          color: #14181b;
        }

        @media (max-width: 639px) {
          .phi-auth-card {
            padding: 16px;
            border-radius: 16px;
            max-height: calc(100dvh - 24px);
            overflow-y: auto;
          }
          .phi-auth-grid2 {
            grid-template-columns: 1fr;
          }
          .phi-auth-input {
            font-size: 16px !important;
          }
        }
      `}</style>

      <Suspense
        fallback={
          <div style={{ background: '#fff', padding: '16px 22px', borderRadius: '14px', color: '#14181b', fontSize: '0.9rem', fontWeight: 800 }}>
            جاري تحميل نموذج الدخول...
          </div>
        }
      >
        <LoginForm onClose={onClose} />
      </Suspense>
    </div>,
    document.body
  );
}
