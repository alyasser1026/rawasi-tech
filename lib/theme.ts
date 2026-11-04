// lib/theme.ts
// سيم: فحمي ولؤلؤي متدرّج جلوسي بدون إطارات (Borderless Glossy Layered Gradient UI)

export const THEME = {
  // 🌟 [المتغيرات الأساسية للمظهر الفحمي الجلوسي بدون إطارات]
  primary: '#f97316',      // برتقالي دافئ عنبري ناصع فوق الفحم
  accent: '#f97316',
  accentLight: 'rgba(249, 115, 22, 0.13)',
  secondary: '#94a3b8',    // رمادي تيتانيوم للنصوص الثانوية
  text: '#f8fafc',         // أبيض لؤلؤي عالي الوضوح
  info: '#0ea5e9',         // أزرق سماوي نقي
  purple: '#818cf8',
  background: '#07080b',   // كانفاس فحمي عميق
  logo: '/company-logo.svg',   // مسار اللوجو
  success: '#10b981',      // أخضر زمردي للعمليات الناجحة
  danger: '#f43f5e',       // أحمر قرمزي للأخطاء والتنبيهات
  warning: '#f59e0b',      // أصفر كهرماني
  ruby: '#fb7185',
  coffeeMain: '#12151c',   // درجات الفحم للأسطح
  coffeeDark: '#0c0e12',
  goldAccent: '#f97316',
  white: '#FFFFFF',
  border: 'transparent',   // Borderless: انعدام خطوط الإطارات
  sandLight: '#07080b',
  sandDark: '#0c0e12',
  cinematicGlass: {
    background: 'var(--surface-header, linear-gradient(135deg, #171b24 0%, #101319 55%, #0a0c10 100%))',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  },

  // 1️⃣ الألوان الأساسية (Brand Palette)
  brand: {
    orange: '#f97316',
    orangeStrong: '#ea580c',
    charcoal: '#07080b',
    coffee: '#12151c',
    gold: '#f97316',
    goldLight: 'rgba(249, 115, 22, 0.15)',
    white: '#FFFFFF',
    slate: '#94a3b8',
    appleGray: '#151921',
  },

  // 2️⃣ حالات النظام (Status Colors)
  status: {
    success: '#10b981',
    danger: '#f43f5e',
    warning: '#f59e0b',
    info: '#0ea5e9',
  },

  // 3️⃣ المحرك الزجاجي (Glossy Borderless Engine)
  glass: {
    bgOpacity: 0.95,
    blur: '20px',
    borderOpacity: 0,
    saturate: '140%',
    borderWidth: '0px',
  },

  // 4️⃣ الجداول الذكية (Borderless Smart Tables)
  table: {
    headerBg: 'var(--table-head-bg, rgba(255, 255, 255, 0.03))',
    headerText: 'var(--text-secondary, #94a3b8)',
    rowBg: 'transparent',
    rowHover: 'var(--table-row-hover, linear-gradient(90deg, rgba(255, 255, 255, 0.055) 0%, rgba(255, 255, 255, 0.01) 100%))',
    borderColor: 'transparent',
  },

  // 5️⃣ السايد بار (Sidebar & Navigation)
  sidebar: {
    widthOpen: '320px',
    widthClosed: '65px',
    gradientStart: '#151921',
    gradientEnd: '#090b0f',
  },

  // 6️⃣ التدرجات الجاهزة (Layered Gradients)
  gradients: {
    primary: 'var(--accent-gradient, linear-gradient(180deg, #fb923c 0%, #f97316 55%, #d9460f 100%))',
    gold: 'linear-gradient(180deg, #fb923c 0%, #f97316 55%, #d9460f 100%)',
    glass: 'var(--gloss-sheen, linear-gradient(180deg, rgba(255, 255, 255, 0.085) 0%, rgba(255, 255, 255, 0.02) 42%, rgba(0, 0, 0, 0.28) 100%))',
    deepOcean: 'var(--surface-card, linear-gradient(180deg, #181c24 0%, #12151c 52%, #0c0e12 100%))',
    premiumSatin: 'var(--surface-header, linear-gradient(135deg, #171b24 0%, #101319 55%, #0a0c10 100%))',
  },

  // 🚀 7️⃣ الظلال الاحترافية البديلة للإطارات (Diffuse Ambient Depth Shadows)
  shadows: {
    soft: 'var(--shadow-elevation, 0 20px 42px -12px rgba(0, 0, 0, 0.8))',
    medium: 'var(--shadow-ambient, 0 26px 54px -15px rgba(0, 0, 0, 0.85))',
    deep: '0 35px 80px -20px rgba(0, 0, 0, 0.95)',
    goldGlow: '0 10px 26px -4px var(--accent-glow, rgba(249, 115, 22, 0.35))',
  },

  // 🚀 8️⃣ الانحناءات القياسية (Border Radius)
  radius: {
    small: '12px',
    medium: '20px',
    large: '28px',
    full: '100px',
  },

  // 🚀 9️⃣ نسخة التصميم الداكن (Dark Mode Specs)
  dark: {
    card: 'rgba(18, 21, 28, 0.95)',
    border: 'transparent',
    textMain: '#f8fafc',
    textMuted: '#94a3b8',
  },

  // 🚀 10️⃣ الخطوط والأوزان (Typography)
  typography: {
    family: "'Cairo', sans-serif",
    weights: {
      regular: 400,
      semiBold: 600,
      bold: 700,
      black: 900,
    }
  }
};

// 🚀 دالة توليد ستايل الزجاج الفحمي الجلوسي بدون إطارات
export const getGlassStyle = (_opacity = THEME.glass.bgOpacity) => ({
  background: 'var(--surface-card, linear-gradient(180deg, #181c24 0%, #12151c 52%, #0c0e12 100%))',
  backdropFilter: `blur(${THEME.glass.blur}) saturate(${THEME.glass.saturate})`,
  WebkitBackdropFilter: `blur(${THEME.glass.blur}) saturate(${THEME.glass.saturate})`,
  border: 'none',
  borderRadius: THEME.radius.medium,
  boxShadow: 'var(--shadow-ambient, 0 26px 54px -15px rgba(0, 0, 0, 0.85))',
  color: 'var(--text-primary, #f8fafc)',
});

// 🚀 دالة توليد الزجاج الداكن العميق بدون إطارات
export const getDarkGlassStyle = (_opacity = 0.6) => ({
  background: 'var(--surface-sidebar, linear-gradient(180deg, #151921 0%, #0f1218 60%, #090b0f 100%))',
  backdropFilter: 'blur(25px) saturate(180%)',
  WebkitBackdropFilter: 'blur(25px) saturate(180%)',
  border: 'none',
  borderRadius: THEME.radius.medium,
  boxShadow: 'var(--shadow-elevation, 0 24px 48px -14px rgba(0, 0, 0, 0.82))',
  color: 'var(--text-primary, #f8fafc)',
});
