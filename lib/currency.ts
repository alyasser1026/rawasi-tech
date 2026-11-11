// عملة الشركة المفتوحة. بتتضبط من CompanyProvider حسب companies.currency
// (إعدادات الشركة ← العملة)، وكل دوال العرض (formatCurrency / tafqeet / currencySymbol) بتقرأ منها.
// القيمة الأخيرة بتتحفظ في المتصفح عشان أول عرض للصفحة يطلع بالعملة الصح قبل ما قائمة الشركات توصل.

export type CurrencyInfo = {
  code: string;
  symbol: string;
  name: string;
  /** للتفقيط: اسم الوحدة الأساسية ومفردات الكسور */
  major: string;
  minorOne: string;
  minorTwo: string;
  minorFew: string;  // 3–10
  minorMany: string; // 11+
  locale: string;
};

export const CURRENCIES: Record<string, CurrencyInfo> = {
  SAR: { code: 'SAR', symbol: 'ر.س', name: 'ريال سعودي', major: 'ريال سعودي', minorOne: 'هللة واحدة', minorTwo: 'هللتان', minorFew: 'هللات', minorMany: 'هللة', locale: 'ar-SA-u-nu-latn' },
  EGP: { code: 'EGP', symbol: 'ج.م', name: 'جنيه مصري', major: 'جنيه مصري', minorOne: 'قرش واحد', minorTwo: 'قرشان', minorFew: 'قروش', minorMany: 'قرشًا', locale: 'ar-EG-u-nu-latn' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'درهم إماراتي', major: 'درهم إماراتي', minorOne: 'فلس واحد', minorTwo: 'فلسان', minorFew: 'فلوس', minorMany: 'فلسًا', locale: 'ar-AE-u-nu-latn' },
  USD: { code: 'USD', symbol: '$', name: 'دولار أمريكي', major: 'دولار أمريكي', minorOne: 'سنت واحد', minorTwo: 'سنتان', minorFew: 'سنتات', minorMany: 'سنتًا', locale: 'ar-u-nu-latn' },
};

export const DEFAULT_CURRENCY = 'SAR';
const STORAGE_KEY = 'phi_active_currency';

const normalize = (code?: string | null) => {
  const c = String(code ?? '').trim().toUpperCase();
  return CURRENCIES[c] ? c : DEFAULT_CURRENCY;
};

let active: string = (() => {
  try {
    return typeof window !== 'undefined' ? normalize(window.localStorage.getItem(STORAGE_KEY)) : DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
})();

/** بيرجع true لو العملة اتغيّرت فعلًا. */
export function setActiveCurrency(code?: string | null): boolean {
  const next = normalize(code);
  const changed = next !== active;
  active = next;
  try { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next); } catch { /* storage unavailable */ }
  return changed;
}

export const currencyCode = (): string => active;
export const currencyInfo = (code?: string | null): CurrencyInfo => {
  const c = typeof code === 'string' ? code.trim().toUpperCase() : '';
  return CURRENCIES[c] ?? CURRENCIES[active];
};
export const currencySymbol = (code?: string | null): string => currencyInfo(code).symbol;
export const currencyName = (code?: string | null): string => currencyInfo(code).name;
