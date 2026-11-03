// PHI TECH — أبيض ورمادي مع برتقالي محدود، مطابق لهوية الويب.

export const COLORS = {
  primary: '#1d1d1f',      // أسود أبل (النصوص الرئيسية والأيقونات القوية)
  primaryLight: '#434344',
  
  accent: '#c2410c',
  accentLight: '#ffedd5',
  
  // أسماء توافق مع المكونات الحالية.
  cinematicGold: ['#9a3412', '#c2410c', '#c2410c', '#ea580c', '#c2410c'],
  cinematicDarkGold: ['#27272a', '#3f3f46', '#52525b'],
  
  background: '#f7f7f8',
  surface: '#ffffff',
  surfaceSolid: '#ffffff',
  
  text: '#1d1d1f',         // نصوص سوداء
  textLight: '#64748b',    // نصوص رمادية
  
  success: '#16a34a',      // أخضر داكن
  danger: '#ff3b30',       // أحمر أبل
  warning: '#f59e0b',      // برتقالي
  
  border: '#e4e4e7',
  cardShadow: 'rgba(0, 0, 0, 0.05)',
};

export const SIZES = {
  padding: 16,
  radius: 24,     // حواف Apple Card
  radiusSm: 12,
  borderWidth: 1.5, // عرض الحد الذهبي
};

export const SHADOWS = {
  card: {
    shadowColor: '#18181b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  glow: {
    shadowColor: '#c2410c',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    elevation: 8,
  }
};
