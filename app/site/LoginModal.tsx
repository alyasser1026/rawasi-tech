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
          background: rgba(10, 14, 20, 0.62);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
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
          background: rgba(18, 22, 28, 0.88);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          border: 1px solid rgba(234, 88, 12, 0.45);
          border-radius: 22px;
          padding: 2.25rem 2rem;
          box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.85), 0 0 45px rgba(234, 88, 12, 0.2);
          animation: loginFadeInUp 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          color: #ffffff;
        }

        .login-modal-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #ea580c, #f97316, #fb923c);
        }

        .login-modal-close {
          position: absolute;
          top: 1rem;
          left: 1rem;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.75);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          z-index: 20;
        }

        .login-modal-close:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.4);
          color: #ef4444;
          transform: scale(1.06);
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
        }

        .login-modal-subtitle {
          color: rgba(255, 255, 255, 0.68);
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
          background: rgba(12, 16, 22, 0.72) !important;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 12px;
          color: #ffffff !important;
          font-size: 0.95rem;
          font-weight: 700;
          font-family: inherit;
          outline: none;
          transition: all 0.25s ease;
          text-align: right;
          box-sizing: border-box;
        }

        .login-input-field:focus {
          border-color: #f97316;
          background: rgba(18, 24, 34, 0.9) !important;
          box-shadow: 0 0 16px rgba(249, 115, 22, 0.28);
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
          margin-top: 0.4rem;
          background: linear-gradient(135deg, #ea580c, #f97316);
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-size: 0.975rem;
          font-weight: 900;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 10px 25px rgba(234, 88, 12, 0.32);
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }

        .login-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px rgba(234, 88, 12, 0.45);
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
          color: rgba(255, 255, 255, 0.72);
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
          padding: 0.7rem;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.75);
          font-size: 0.8rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .login-back-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.2);
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
