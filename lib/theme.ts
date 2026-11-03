// lib/theme.ts

export const THEME = {
  // 🌟 [المتغيرات السريعة المضافة للتوافق مع الشاشات الجديدة (Apple Style)]
  primary: '#c2410c',      // برتقالي داكن واضح على الأسطح الفاتحة
  accent: '#c2410c',
  accentLight: '#ffedd5',
  secondary: '#27272a',
  text: '#27272a',
  info: '#3b82f6',
  purple: '#8b5cf6',
  background: '#121215',
  logo: '/company-logo.svg',   // مسار اللوجو
  success: '#10b981',      // الأخضر للنجاح
  danger: '#be123c',       // الأحمر للأخطاء
  warning: '#f59e0b',      // الأصفر للتحذيرات
  ruby: '#e11d48',         // الأحمر الوردي للمهام والتنبيهات
  coffeeMain: '#27272a',   // أسماء توافق للشاشات الحالية
  coffeeDark: '#27272a',
  goldAccent: '#c2410c',
  white: '#FFFFFF',        // الأبيض
  border: '#e4e4e7',
  sandLight: '#f7f7f8',
  sandDark: '#e4e4e7',
  cinematicGlass: {
    background: 'rgba(18, 18, 21, 0.8)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },

  // 1️⃣ الألوان الأساسية (Brand Palette)
  brand: {
    orange: '#f97316',
    orangeStrong: '#c2410c',
    charcoal: '#121215',
    coffee: '#27272a',
    gold: '#c2410c',
    goldLight: '#ffedd5',
    white: '#FFFFFF',
    slate: '#71717a',
    appleGray: '#f7f7f8',
  },

  // 2️⃣ حالات النظام (Status Colors)
  status: {
    success: '#10b981',
    danger: '#be123c',
    warning: '#f59e0b',
    info: '#3b82f6',
  },

  // 3️⃣ المحرك الزجاجي (Glassmorphism Engine)
  glass: {
    bgOpacity: 1,
    blur: '0px',
    borderOpacity: 1,
    saturate: '100%',
    borderWidth: '1px',
  },

  // 4️⃣ الجداول الذكية (Smart Tables)
  table: {
    headerBg: '#f4f4f5',
    headerText: '#27272a',
    rowBg: '#ffffff',
    rowHover: '#fff7ed',
    borderColor: '#e4e4e7',
  },

  // 5️⃣ السايد بار (Sidebar & Navigation)
  sidebar: {
    widthOpen: '320px',
    widthClosed: '65px',
    gradientStart: '#ffffff',
    gradientEnd: '#fafafa',
  },

  // 6️⃣ التدرجات الجاهزة (Gradients)
  gradients: {
    primary: 'linear-gradient(135deg, #c2410c 0%, #9a3412 100%)',
    gold: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)',
    glass: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.3) 100%)',
    deepOcean: 'linear-gradient(145deg, #27272a 0%, #121215 100%)',
    premiumSatin: 'linear-gradient(135deg, #f5f5f7 0%, #e2e8f0 100%)', // خلفية أبل فاتحة
  },

  // 🚀 7️⃣ الظلال الاحترافية (Apple-Style Shadows)
  shadows: {
    soft: '0 6px 24px rgba(24, 24, 27, 0.055)',
    medium: '0 20px 40px rgba(0, 0, 0, 0.08)',
    deep: '0 30px 60px rgba(0, 0, 0, 0.12)',
    goldGlow: '0 4px 12px rgba(194, 65, 12, 0.12)',
  },

  // 🚀 8️⃣ الانحناءات القياسية (Border Radius)
  radius: {
    small: '12px',
    medium: '20px',
    large: '32px',
    full: '100px',
  },

  // 🚀 9️⃣ نسخة التصميم الداكن (Dark Mode Specs)
  dark: {
    card: 'rgba(18, 18, 21, 0.95)',
    border: 'rgba(255, 255, 255, 0.05)',
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

// 🚀 دالة مساعدة لتوليد ستايل الزجاج فوراً
export const getGlassStyle = (opacity = THEME.glass.bgOpacity) => ({
  background: `rgba(255, 255, 255, ${opacity})`,
  backdropFilter: `blur(${THEME.glass.blur}) saturate(${THEME.glass.saturate})`,
  WebkitBackdropFilter: `blur(${THEME.glass.blur}) saturate(${THEME.glass.saturate})`,
  border: `${THEME.glass.borderWidth} solid ${THEME.border}`,
  borderRadius: THEME.radius.medium,
  boxShadow: THEME.shadows.soft,
});

// 🚀 دالة توليد الزجاج الداكن (للداشبورد المالي)
export const getDarkGlassStyle = (opacity = 0.6) => ({
    background: `rgba(15, 23, 42, ${opacity})`,
    backdropFilter: `blur(25px) saturate(180%)`,
    WebkitBackdropFilter: `blur(25px) saturate(180%)`,
    border: `1px solid rgba(255, 255, 255, 0.05)`,
    borderRadius: THEME.radius.medium,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
});
