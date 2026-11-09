"use client";
import React, { Suspense } from 'react';
import { useLoginLogic } from './login_logic';

// 🎨 تطبيق ألوان هوية "فاي تك" الدافئة
const THEME = {
  coffeeDark: '#27272a',
  coffeeMedium: '#3f3f46',
  goldAccent: '#ea580c',
  amberGlow: '#f97316',
  emeraldGlow: '#10b981',
  sandLight: '#f7f7f8',
  white: '#ffffff',
  slate: '#94a3b8'
};

function LoginContent() {
  const {
    isSignUp, toggleSignUp,
    fullName, setFullName,
    email, setEmail,
    password, setPassword,
    isLoading,
    handleAutoFill,
    handleSubmit
  } = useLoginLogic();

  // صفحة دخول واحدة للموظفين والعملاء والشركاء — الوجهة تتحدد تلقائيًا حسب الصلاحيات (roleRouter)
  const isPartner = false;

  return (
    <div className="login-wrapper">
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        @keyframes onAutoFillStart { from {} to {} }

        .login-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          direction: rtl;
          font-family: 'Cairo', sans-serif;
          background: #0d0f14;
          padding: 1.5rem;
          position: relative;
          overflow: hidden;
          isolation: isolate;
        }

        /* خلفية الشعار (صورة الهوية) مع حركة تقريب بطيئة */
        .login-wrapper::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: -2;
          background: url('/brand/hero-bg.webp') 22% center / cover no-repeat, #0d0f14;
          transform-origin: 22% 50%;
          animation: bgDrift 28s ease-in-out infinite alternate;
        }

        /* طبقة تعتيم متدرجة: تحمي قراءة البطاقة وتُبقي نور النحاس ظاهرًا */
        .login-wrapper::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: -1;
          background:
            radial-gradient(70rem 40rem at 50% 50%, rgba(10, 12, 16, 0.78), rgba(10, 12, 16, 0.35) 70%),
            linear-gradient(180deg, rgba(10, 12, 16, 0.35), rgba(10, 12, 16, 0.7));
        }

        @keyframes bgDrift {
          from { transform: scale(1); }
          to { transform: scale(1.07); }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-wrapper::before { animation: none; }
        }

        @media (max-width: 640px) {
          .login-wrapper::before { background-position: 24% center; }
        }

        .glass-card {
          width: 100%;
          max-width: 32rem;
          background: rgba(18, 22, 28, 0.74); 
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          border: 1px solid ${isPartner ? 'rgba(245, 158, 11, 0.45)' : 'rgba(234, 88, 12, 0.45)'};
          border-radius: 20px;
          padding: 2.5rem 2rem;
          box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.85), 0 0 45px ${isPartner ? 'rgba(245, 158, 11, 0.15)' : 'rgba(234, 88, 12, 0.15)'};
          animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          position: relative;
          overflow: hidden;
        }

        .glass-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: ${isPartner 
            ? 'linear-gradient(90deg, #10b981, #f59e0b, #fbbf24)' 
            : 'linear-gradient(90deg, #ea580c, #f97316, #fb923c)'};
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .logo-container {
          text-align: center;
          margin-bottom: 1.25rem;
          position: relative;
        }

        .logo-container img {
          height: 4.5rem;
          max-width: 100%;
          width: auto;
          margin: 0 auto;
          display: block;
        }

        /* Segmented Portal Switcher */
        .portal-switcher {
          display: flex;
          background: rgba(10, 14, 20, 0.75);
          border-radius: 14px;
          padding: 4px;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          gap: 4px;
        }

        .portal-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.65);
          font-family: inherit;
          font-size: 0.825rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .portal-tab:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.04);
        }

        .portal-tab.active-staff {
          background: linear-gradient(135deg, rgba(234, 88, 12, 0.25), rgba(249, 115, 22, 0.15));
          color: #fb923c;
          border: 1px solid rgba(249, 115, 22, 0.4);
          box-shadow: 0 4px 15px rgba(234, 88, 12, 0.2);
        }

        .portal-tab.active-partner {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(16, 185, 129, 0.15));
          color: #fde047;
          border: 1px solid rgba(245, 158, 11, 0.4);
          box-shadow: 0 4px 15px rgba(245, 158, 11, 0.2);
        }

        .cinematic-title {
          color: ${THEME.white};
          font-weight: 900;
          font-size: 1.625rem;
          text-align: center;
          margin-bottom: 0.35rem;
          text-shadow: 0 2px 10px rgba(0,0,0,0.4);
        }

        .cinematic-subtitle {
          color: rgba(255, 255, 255, 0.7);
          text-align: center;
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 1.75rem;
        }

        .input-group {
          position: relative;
          margin-bottom: 1.35rem;
        }

        .cinematic-input {
          width: 100%;
          padding: 1rem 1.15rem;
          background: rgba(15, 20, 28, 0.6) !important;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          color: ${THEME.white} !important;
          font-size: 0.95rem;
          font-weight: 700;
          outline: none;
          transition: all 0.25s ease;
          text-align: right;
        }

        .cinematic-input:focus { 
          border-color: ${isPartner ? '#f59e0b' : '#f97316'}; 
          background: rgba(20, 26, 36, 0.8) !important; 
          box-shadow: 0 0 15px ${isPartner ? 'rgba(245, 158, 11, 0.25)' : 'rgba(249, 115, 22, 0.25)'};
        }

        .cinematic-input:-webkit-autofill {
          animation-name: onAutoFillStart;
          -webkit-text-fill-color: #ffffff !important;
          -webkit-box-shadow: 0 0 0px 1000px rgba(20, 26, 36, 1) inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }

        .floating-label {
          position: absolute;
          right: 1.15rem;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255, 255, 255, 0.65);
          font-size: 0.9rem;
          font-weight: 700;
          pointer-events: none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 10;
        }

        .cinematic-input:focus ~ .floating-label, 
        .cinematic-input:not(:placeholder-shown) ~ .floating-label,
        .cinematic-input:-webkit-autofill ~ .floating-label,
        .forced-float {
          top: -0.65rem !important;
          right: 0.85rem !important;
          font-size: 0.75rem !important;
          color: #ffffff !important;
          background: ${isPartner ? '#d97706' : '#ea580c'} !important;
          padding: 2px 0.5rem !important;
          border-radius: 6px !important;
          transform: translateY(0) !important;
          opacity: 1 !important;
          font-weight: 800 !important;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }

        .submit-btn {
          width: 100%;
          padding: 1rem;
          margin-top: 0.5rem;
          background: ${isPartner 
            ? 'linear-gradient(135deg, #f59e0b, #d97706)' 
            : 'linear-gradient(135deg, #ea580c, #f97316)'};
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 900;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 10px 25px ${isPartner ? 'rgba(245, 158, 11, 0.3)' : 'rgba(234, 88, 12, 0.3)'};
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px ${isPartner ? 'rgba(245, 158, 11, 0.45)' : 'rgba(234, 88, 12, 0.45)'};
          filter: brightness(1.08);
        }

        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .toggle-btn {
          width: 100%;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 700;
          margin-top: 1.15rem;
          cursor: pointer;
          transition: 0.25s;
        }
        .toggle-btn span { color: ${isPartner ? '#fde047' : '#fb923c'}; text-decoration: underline; }
        .toggle-btn:hover { color: ${THEME.white}; }
        
        @media (max-width: 480px) {
          .glass-card { padding: 2rem 1.25rem; border-radius: 16px; }
          .cinematic-title { font-size: 1.35rem; }
          .portal-tab { font-size: 0.75rem; padding: 8px 6px; }
        }
      `}</style>

      <div className="glass-card">
        {/* Official Brand Logo */}
        <div className="logo-container">
          <img
            src="/brand/phitech-lockup-light.svg"
            alt="فاي تك PhiTech"
          />
        </div>
        
        <h1 className="cinematic-title">
دخول فاي تك
        </h1>
        <p className="cinematic-subtitle">
          {isSignUp ? 'إنشاء حساب جديد بالمنظومة' : 'للموظفين والمهندسين والعملاء — يتم توجيهك تلقائيًا حسب صلاحياتك'}
        </p>

        <form onSubmit={handleSubmit}>
          
          {isSignUp && (
            <div className="input-group" style={{ animation: 'fadeInUp 0.4s forwards' }}>
              <input 
                type="text" 
                className="cinematic-input" 
                placeholder=" " 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required={isSignUp} 
              />
              <label className={`floating-label ${fullName ? 'forced-float' : ''}`}>الاسم الكامل</label>
            </div>
          )}

          <div className="input-group">
            <input 
              type="text" 
              className="cinematic-input" 
              placeholder=" " 
              value={email}
              onAnimationStart={handleAutoFill}
              onChange={(e) => setEmail(e.target.value)}
              required 
              autoComplete="username"
            />
            <label className={`floating-label ${email ? 'forced-float' : ''}`}>اسم المستخدم أو البريد الإلكتروني</label>
          </div>

          <div className="input-group">
            <input 
              type="password" 
              className="cinematic-input" 
              placeholder=" " 
              value={password}
              onAnimationStart={handleAutoFill}
              onChange={(e) => setPassword(e.target.value)}
              required 
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
            <label className={`floating-label ${password ? 'forced-float' : ''}`}>كلمة المرور</label>
          </div>

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? (
              <span>جاري التحقق والاتصال...</span>
            ) : isSignUp ? (
              <span>إنشاء الحساب</span>
            ) : (
              <span>تسجيل الدخول</span>
            )}
          </button>
        </form>

        <button type="button" className="toggle-btn" onClick={toggleSignUp}>
          {isSignUp ? (
            <>لديك حساب مسجل؟ <span>تسجيل الدخول</span></>
          ) : (
            <>طلب اعتماد حساب مستخدم جديد؟ <span>إنشاء حساب</span></>
          )}
        </button>

        {/* Back to Website Link */}
        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              background: 'rgba(249, 115, 22, 0.12)',
              color: '#fb923c',
              textDecoration: 'none',
              fontSize: '0.825rem',
              fontWeight: 800,
              boxShadow: '0 4px 15px rgba(249, 115, 22, 0.15)',
              transition: 'all 0.2s ease',
            }}
          >
            <span>العودة إلى موقع فاي تك</span>
          </a>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', fontWeight: 600 }}>
            © {new Date().getFullYear()} فاي تك للمقاولات العامة والتشطيبات
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1219', color: '#fb923c', fontFamily: 'Cairo, sans-serif' }}>
        جاري تحميل بوابة الدخول...
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
