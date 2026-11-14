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
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    handleAutoFill,
    handleSubmit,
  } = useLoginLogic();

  return (
    <div className="login-modal-card" onClick={(e) => e.stopPropagation()}>
      {/* زر إغلاق النافذة */}
      <button
        type="button"
        onClick={onClose}
        aria-label="إغلاق نافذة تسجيل الدخول"
        className="login-modal-close"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* شعار فاي تك الرسمي */}
      <div className="login-modal-logo">
        <img
          src="/brand/phitech-mark-color.svg"
          alt="فاي تك PhiTech"
          style={{ height: '48px', width: 'auto', margin: '0 auto' }}
        />
        <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <strong style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>
            فاي تك <span style={{ color: '#ea580c' }}>PhiTech</span>
          </strong>
          <small style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.12em' }}>
            CONSTRUCTION & FINISHING
          </small>
        </div>
      </div>

      <h2 className="login-modal-title">
        {isSignUp ? 'إنشاء حساب جديد' : 'دخول المنظومة'}
      </h2>
      <p className="login-modal-subtitle">
        {isSignUp
          ? 'أنشئ حسابك للوصول إلى لوحة المتابعة'
          : 'للموظفين والمهندسين والعملاء — يتم توجيهك تلقائيًا حسب صلاحياتك'}
      </p>

      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        {isSignUp && (
          <div className="login-input-group" style={{ animation: 'loginFadeInUp 0.3s ease-out' }}>
            <input
              type="text"
              className="login-input-field"
              placeholder=" "
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required={isSignUp}
            />
            <label className={`login-floating-label ${fullName ? 'forced-float' : ''}`}>
              الاسم الكامل
            </label>
          </div>
        )}

        <div className="login-input-group">
          <input
            type="text"
            className="login-input-field"
            placeholder=" "
            value={email}
            onAnimationStart={handleAutoFill}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
          <label className={`login-floating-label ${email ? 'forced-float' : ''}`}>
            اسم المستخدم أو البريد الإلكتروني
          </label>
        </div>

        <div className="login-input-group">
          <input
            type="password"
            className="login-input-field"
            placeholder=" "
            value={password}
            onAnimationStart={handleAutoFill}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />
          <label className={`login-floating-label ${password ? 'forced-float' : ''}`}>
            كلمة المرور
          </label>
        </div>

        <button type="submit" className="login-submit-btn" disabled={isLoading}>
          {isLoading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="login-spinner" />
              جاري التحقق والاتصال...
            </span>
          ) : isSignUp ? (
            <span>إنشاء الحساب</span>
          ) : (
            <span>تسجيل الدخول</span>
          )}
        </button>
      </form>

      <button type="button" className="login-toggle-btn" onClick={toggleSignUp}>
        {isSignUp ? (
          <>لديك حساب مسجل؟ <span>تسجيل الدخول</span></>
        ) : (
          <>طلب اعتماد حساب مستخدم جديد؟ <span>إنشاء حساب</span></>
        )}
      </button>

      {/* زر العودة للموقع */}
      <button type="button" onClick={onClose} className="login-back-btn">
        <span>العودة وتصفح الموقع</span>
      </button>
    </div>
  );
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // إغلاق المودال بزر Escape وقفل تمرير الصفحة
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
      className="login-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="تسجيل الدخول"
    >
      <style>{`
        .login-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.25rem;
          background: rgba(8, 12, 18, 0.48);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          animation: loginModalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          overflow-y: auto;
          direction: rtl;
          font-family: 'Cairo', -apple-system, sans-serif;
        }

        @keyframes loginModalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes loginFadeInUp {
          from { opacity: 0; transform: translateY(22px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .login-modal-card {
          width: 100%;
          max-width: 29.5rem;
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.14) 0%, rgba(22, 26, 35, 0.52) 40%, rgba(10, 14, 22, 0.72) 100%);
          backdrop-filter: blur(32px) saturate(200%);
          -webkit-backdrop-filter: blur(32px) saturate(200%);
          border: 1px solid rgba(255, 255, 255, 0.24);
          border-radius: 24px;
          padding: 2.35rem 2.1rem;
          box-shadow: 
            0 35px 90px -15px rgba(0, 0, 0, 0.9),
            0 0 0 1px rgba(255, 255, 255, 0.08) inset,
            0 1.5px 1.5px 0 rgba(255, 255, 255, 0.6) inset,
            0 0 45px rgba(249, 115, 22, 0.22);
          animation: loginFadeInUp 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          color: #ffffff;
        }

        .login-modal-card > * {
          position: relative;
          z-index: 2;
        }

        .login-modal-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent 0%, #ea580c 20%, #f97316 50%, #fb923c 80%, transparent 100%);
          box-shadow: 0 0 14px rgba(249, 115, 22, 0.7);
          z-index: 5;
        }

        /* Glossy curved reflection sheen */
        .login-modal-card::after {
          content: '';
          position: absolute;
          top: 0;
          left: -25%;
          right: -25%;
          height: 52%;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.03) 60%, transparent 100%);
          border-radius: 0 0 100% 100% / 0 0 35% 35%;
          pointer-events: none;
          z-index: 1;
        }

        .login-modal-close {
          position: absolute;
          top: 1.1rem;
          left: 1.1rem;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.24);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.3);
          color: rgba(255, 255, 255, 0.85);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 20;
        }

        .login-modal-close:hover {
          background: rgba(239, 68, 68, 0.28);
          border-color: rgba(239, 68, 68, 0.6);
          color: #ffffff;
          transform: scale(1.08) rotate(90deg);
          box-shadow: 0 0 18px rgba(239, 68, 68, 0.45);
        }

        .login-modal-logo {
          text-align: center;
          margin-bottom: 1rem;
        }

        .login-modal-title {
          font-weight: 900;
          font-size: 1.45rem;
          text-align: center;
          margin: 0 0 0.3rem 0;
          color: #ffffff;
          letter-spacing: -0.01em;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        }

        .login-modal-subtitle {
          color: rgba(255, 255, 255, 0.72);
          text-align: center;
          font-size: 0.825rem;
          font-weight: 600;
          margin: 0 0 1.5rem 0;
          line-height: 1.5;
        }

        .login-input-group {
          position: relative;
          margin-bottom: 1.25rem;
          width: 100%;
        }

        .login-input-field {
          width: 100%;
          padding: 0.95rem 1.15rem;
          background: rgba(255, 255, 255, 0.07) !important;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 12px;
          color: #ffffff !important;
          font-size: 0.95rem;
          font-weight: 700;
          font-family: inherit;
          outline: none;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          text-align: right;
          box-sizing: border-box;
          box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.12);
        }

        .login-input-field:focus {
          border-color: #f97316;
          background: rgba(255, 255, 255, 0.13) !important;
          box-shadow: 0 0 22px rgba(249, 115, 22, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25);
        }

        .login-floating-label {
          position: absolute;
          right: 1.15rem;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255, 255, 255, 0.65);
          font-size: 0.85rem;
          font-weight: 700;
          pointer-events: none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 10;
        }

        .login-input-field:focus ~ .login-floating-label,
        .login-input-field:not(:placeholder-shown) ~ .login-floating-label,
        .login-input-field:-webkit-autofill ~ .login-floating-label,
        .login-floating-label.forced-float {
          top: -0.65rem !important;
          right: 0.85rem !important;
          font-size: 0.72rem !important;
          color: #ffffff !important;
          background: #ea580c !important;
          padding: 2px 0.5rem !important;
          border-radius: 6px !important;
          transform: translateY(0) !important;
          opacity: 1 !important;
          font-weight: 800 !important;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
        }

        .login-submit-btn {
          width: 100%;
          padding: 0.95rem;
          margin-top: 0.5rem;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(0, 0, 0, 0.15) 100%), linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 12px;
          font-size: 0.975rem;
          font-weight: 900;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 12px 30px rgba(234, 88, 12, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.6);
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }

        .login-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 16px 36px rgba(234, 88, 12, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.75);
          filter: brightness(1.08);
        }

        .login-submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-toggle-btn {
          width: 100%;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.75);
          font-family: inherit;
          font-size: 0.825rem;
          font-weight: 700;
          margin-top: 1.1rem;
          cursor: pointer;
          transition: 0.2s ease;
          text-align: center;
        }

        .login-toggle-btn span {
          color: #fb923c;
          text-decoration: underline;
        }

        .login-toggle-btn:hover {
          color: #ffffff;
        }

        .login-back-btn {
          width: 100%;
          margin-top: 1rem;
          padding: 0.75rem;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.07);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
          color: rgba(255, 255, 255, 0.82);
          font-size: 0.825rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .login-back-btn:hover {
          background: rgba(255, 255, 255, 0.13);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.28);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 4px 14px rgba(0, 0, 0, 0.25);
        }

        .login-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: loginSpin 0.7s linear infinite;
        }

        @keyframes loginSpin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 480px) {
          .login-modal-card {
            padding: 1.85rem 1.25rem;
            border-radius: 18px;
          }
          .login-modal-title {
            font-size: 1.25rem;
          }
        }
      `}</style>

      <Suspense fallback={
        <div style={{ color: '#fb923c', fontSize: '0.9rem', fontWeight: 800 }}>
          جاري تحميل نموذج الدخول...
        </div>
      }>
        <LoginForm onClose={onClose} />
      </Suspense>
    </div>,
    document.body
  );
}
