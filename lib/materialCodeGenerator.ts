/**
 * محرك التوليد التلقائي الذكي لأكواد أصناف الخامات والمواد (فاي تك)
 * يولد الكود التالي تلقائياً لمنع أخطاء التكرار (Unique Constraint Violation) وتسهيل إدارة المستودعات:
 * 1. بادئة موحدة MAT- أو بادئة حسب التصنيف (اختياري)
 * 2. فحص الأكواد الحالية لتجنب أي تكرار وتوليد الرقم التسلسلي التالي (MAT-001, MAT-002, ...)
 * 3. حماية كاملة ضد إرسال قيم فارغة "" أو أكواد مكررة إلى قاعدة البيانات
 */

export function getMaterialCategoryPrefix(category: string = ''): string {
  const normCat = String(category || '').trim().toLowerCase();
  if (!normCat) return 'MAT';

  // حديد وتسليح ومعادن
  if (/حديد|تسليح|صاج|زوايا|كمر|شبك|معادن|صلب|ستيل/iu.test(normCat)) return 'STL';
  // أسمنت وخرسانات وكتل وبلوك ورمل
  if (/اسمنت|أسمنت|خرسان|رمل|سن|جبس|طوب|بلوك|زلط|جير/iu.test(normCat)) return 'CMT';
  // سباكة ومواسير ومحابس وصرف
  if (/سباك|مواسير|محابس|صرف|تغذية|سيفون|خلاط|عزل\s*مائي/iu.test(normCat)) return 'PLM';
  // كهرباء وكابلات وأفياش وليد
  if (/كهربا|اسلاك|أسلاك|كابل|ليد|مفاتيح|قواطع|افياش|أفياش|علب|طبلون/iu.test(normCat)) return 'ELE';
  // دهانات وبويات ومعجون وفتونايت
  if (/دهان|بويات|معجون|فتونايت|سيلر|صبغ|جوتن|سكيب|برايمر/iu.test(normCat)) return 'PNT';
  // سيراميك وبورسلان ورخام
  if (/سيراميك|بورسلان|بورسلين|رخام|جرانيت|بلاط|غراء|روبة/iu.test(normCat)) return 'CER';
  // خشب ونجارة وأبواب
  if (/خشب|أخشاب|نجار|ابواب|أبواب|حلوق|الواح|ألواح|mdf/iu.test(normCat)) return 'WOD';
  // تكييف وتهوية ودكتات
  if (/تكييف|تهوي|فريون|نحاس|دكت|كونسيلد|اسبليت/iu.test(normCat)) return 'HVAC';
  // جبس بورد وديكورات
  if (/جبس\s*بورد|ديكور|اسقف|أسقف|قواطع/iu.test(normCat)) return 'GYP';
  // عزل
  if (/عزل|بيتومين|ممبرين|فوم|صوف\s*صخري/iu.test(normCat)) return 'INS';
  // أدوات وعدد ومسامير
  if (/ادوات|أدوات|عدد|مسامير|براغي|تثبيت/iu.test(normCat)) return 'TLS';

  return 'MAT';
}

export function generateNextMaterialCode(
  existingCodes: (string | null | undefined)[] = [],
  preferredPrefix: string = 'MAT'
): string {
  const prefix = (preferredPrefix || 'MAT').trim().toUpperCase();
  const regex = new RegExp(`^${prefix}[-_]?(\\d+)$`, 'i');

  let maxNum = 0;
  for (const c of existingCodes) {
    if (!c) continue;
    const clean = String(c).trim();
    const match = clean.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  // إذا لم نجد أرقام بالبادئة، وكان هناك كود عام، نفحص الأرقام المباشرة
  if (maxNum === 0 && prefix === 'MAT') {
    for (const c of existingCodes) {
      if (!c) continue;
      const numOnlyMatch = String(c).trim().match(/^(\d+)$/);
      if (numOnlyMatch) {
        const num = parseInt(numOnlyMatch[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  const nextNum = maxNum + 1;
  const padded = nextNum < 1000 ? String(nextNum).padStart(3, '0') : String(nextNum);
  const candidate = `${prefix}-${padded}`;

  // التحقق من التفرد في الذاكرة
  const existingSet = new Set(
    existingCodes.map((c) => String(c || '').trim().toUpperCase()).filter(Boolean)
  );

  if (!existingSet.has(candidate.toUpperCase())) {
    return candidate;
  }

  let safeNum = nextNum + 1;
  while (existingSet.has(`${prefix}-${safeNum < 1000 ? String(safeNum).padStart(3, '0') : safeNum}`.toUpperCase())) {
    safeNum++;
  }
  return `${prefix}-${safeNum < 1000 ? String(safeNum).padStart(3, '0') : safeNum}`;
}
