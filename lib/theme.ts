// lib/theme.ts
// سيم: فحمي ولؤلؤي متدرّج جلوسي بدون إطارات (Borderless Glossy Layered Gradient UI)

export const THEME = {
  // 🌟 [المتغيرات الأساسية للمظهر الفحمي الجلوسي بدون إطارات]
  primary: '#f97316',      // برتقالي دافئ عنبري ناصع فوق الفحم
  accent: '#f97316',
  accentLight: 'rgba(249, 115, 22, 0.13)',
  secondary: '#ede5da',    // لؤلؤي سيراميكي دافئ للنصوص الثانوية (بدلاً من الرمادي الباهت)
  text: '#fefcf9',         // أبيض لؤلؤي عالي الوضوح
  info: '#0ea5e9',         // أزرق سماوي نقي
  purple: '#818cf8',
  background: '#07080b',   // كانفاس فحمي عميق
  logo: '/company-logo.svg',   // مسار اللوجو
  success: '#10b981',      // أخضر زمردي للعمليات الناجحة
  danger: '#f43f5e',       // أحمر قرمزي للأخطاء والتنبيهات
  warning: '#f59e0b',      // أصفر كهرماني
  ruby: '#fb7185',
  coffeeMain: '#120f0d',   // درجات الفحم للأسطح
  coffeeDark: '#0b0908',
  goldAccent: '#f97316',
  white: '#FFFFFF',
  border: 'transparent',   // Borderless: انعدام خطوط الإطارات
  sandLight: '#07080b',
  sandDark: '#0b0908',
  cinematicGlass: {
    background: 'var(--surface-header, linear-gradient(135deg, #191613 0%, #120f0d 55%, #090807 100%))',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  },

  // 1️⃣ الألوان الأساسية (Brand Palette)
  brand: {
    orange: '#f97316',
    orangeStrong: '#ea580c',
    charcoal: '#07080b',
    coffee: '#120f0d',
    gold: '#f97316',
    goldLight: 'rgba(249, 115, 22, 0.15)',
    white: '#FFFFFF',
    slate: '#ede5da',
    appleGray: '#161310',
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
    headerBg: 'var(--table-head-bg, rgba(255, 255, 255, 0.035))',
    headerText: 'var(--text-secondary, #ede5da)',
    rowBg: 'transparent',
    rowHover: 'var(--table-row-hover, linear-gradient(90deg, rgba(249, 115, 22, 0.08) 0%, rgba(255, 255, 255, 0.01) 100%))',
    borderColor: 'transparent',
  },

  // 5️⃣ السايد بار (Sidebar & Navigation)
  sidebar: {
    widthOpen: '320px',
    widthClosed: '65px',
    gradientStart: '#161310',
    gradientEnd: '#090807',
  },

  // 6️⃣ التدرجات الجاهزة (Layered Gradients)
  gradients: {
    primary: 'var(--accent-gradient, linear-gradient(180deg, #fb923c 0%, #f97316 55%, #d9460f 100%))',
    gold: 'linear-gradient(180deg, #fb923c 0%, #f97316 55%, #d9460f 100%)',
    glass: 'var(--gloss-sheen, linear-gradient(180deg, rgba(254, 243, 199, 0.06) 0%, rgba(255, 255, 255, 0.015) 38%, rgba(0, 0, 0, 0.35) 100%))',
    deepOcean: 'var(--surface-card, linear-gradient(180deg, #181512 0%, #120f0d 52%, #0b0908 100%))',
    premiumSatin: 'var(--surface-header, linear-gradient(135deg, #191613 0%, #120f0d 55%, #090807 100%))',
  },

  // 🚀 7️⃣ الظلال الاحترافية البديلة للإطارات (Diffuse Ambient Depth Shadows)
  shadows: {
    soft: 'var(--shadow-elevation, 0 20px 42px -12px rgba(0, 0, 0, 0.88))',
    medium: 'var(--shadow-ambient, 0 26px 54px -15px rgba(0, 0, 0, 0.9))',
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
    card: 'rgba(18, 15, 13, 0.95)',
    border: 'transparent',
    textMain: '#fefcf9',
    textMuted: '#ede5da',
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
  background: 'var(--surface-card, linear-gradient(180deg, #181512 0%, #120f0d 52%, #0b0908 100%))',
  backdropFilter: `blur(${THEME.glass.blur}) saturate(${THEME.glass.saturate})`,
  WebkitBackdropFilter: `blur(${THEME.glass.blur}) saturate(${THEME.glass.saturate})`,
  border: 'none',
  borderRadius: THEME.radius.medium,
  boxShadow: 'var(--shadow-ambient, 0 26px 54px -15px rgba(0, 0, 0, 0.9))',
  color: 'var(--text-primary, #fefcf9)',
});

// 🚀 دالة توليد الزجاج الداكن العميق بدون إطارات
export const getDarkGlassStyle = (_opacity = 0.6) => ({
  background: 'var(--surface-sidebar, linear-gradient(180deg, #161310 0%, #100e0b 60%, #090807 100%))',
  backdropFilter: 'blur(25px) saturate(180%)',
  WebkitBackdropFilter: 'blur(25px) saturate(180%)',
  border: 'none',
  borderRadius: THEME.radius.medium,
  boxShadow: 'var(--shadow-elevation, 0 24px 48px -14px rgba(0, 0, 0, 0.88))',
  color: 'var(--text-primary, #fefcf9)',
});
