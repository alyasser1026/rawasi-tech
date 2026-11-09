/**
 * محرك التوليد التلقائي الذكي لأكواد شجرة الحسابات (فاي تك)
 * يولد كود الحساب الفرعي أو الرئيسي تلقائياً وفق المعايير المحاسبية:
 * 1. الأصول (1): أصول ثابتة (11)، أصول متداولة (12)، خزينة (122)، بنوك (129)، فروع (1291)...
 * 2. الالتزامات (2): التزامات متداولة (21)، موردين (211)، مقاولين (212)...
 * 3. حقوق الملكية (3): رأس مال (31)، جاري الشركاء (32)...
 * 4. الإيرادات (4): إيراد نشاط (41)، خدمات هندسية (42)...
 * 5. التكاليف والمصروفات (5): تكاليف مباشرة (51)، مصروفات إدارية (52)...
 */

export type AccountCategoryType = 'أصول' | 'التزامات' | 'حقوق ملكية' | 'إيرادات' | 'مصروفات';

/**
 * تحديد طبيعة الحساب تلقائياً بناءً على كود الحساب أو كود الحساب الأب
 */
export function getAccountTypeByCode(code: string | null | undefined): AccountCategoryType {
  const norm = String(code || '').trim();
  if (norm.startsWith('1')) return 'أصول';
  if (norm.startsWith('2')) return 'التزامات';
  if (norm.startsWith('3')) return 'حقوق ملكية';
  if (norm.startsWith('4')) return 'إيرادات';
  if (norm.startsWith('5')) return 'مصروفات';
  return 'أصول';
}

export interface GenerateAccountCodeOptions {
  parentCode?: string | null;
  accountType?: string;
  existingCodes?: (string | null | undefined)[];
}

/**
 * توليد كود الحساب التسلسلي التالي تلقائياً
 */
export function generateNextAccountCode({
  parentCode,
  accountType = 'أصول',
  existingCodes = []
}: GenerateAccountCodeOptions): string {
  const normParent = parentCode ? String(parentCode).trim() : '';

  // حالة 1: الحساب الأب محدد (توليد كود فرعي تسلسلي)
  if (normParent) {
    const childRegex = new RegExp(`^${normParent}(\\d+)$`);
    const suffixes: { num: number; raw: string; padLength: number }[] = [];

    for (const c of existingCodes) {
      if (!c) continue;
      const clean = String(c).trim();
      if (clean === normParent) continue;
      const match = clean.match(childRegex);
      if (match) {
        const raw = match[1];
        const num = parseInt(raw, 10);
        if (!isNaN(num)) {
          suffixes.push({
            num,
            raw,
            padLength: raw.length
          });
        }
      }
    }

    // إذا لم يكن للحساب الأب أي حسابات فرعية حتى الآن
    if (suffixes.length === 0) {
      return `${normParent}1`;
    }

    // فرز واكتشاف أعلى رقم فرعي
    let maxNum = 0;
    let preferredPad = 0;
    for (const s of suffixes) {
      if (s.num > maxNum) {
        maxNum = s.num;
      }
      if (s.raw.startsWith('0') && s.padLength > preferredPad) {
        preferredPad = s.padLength;
      }
    }

    const nextNum = maxNum + 1;
    let nextSuffix = String(nextNum);
    if (preferredPad > 0 && nextSuffix.length < preferredPad) {
      nextSuffix = nextSuffix.padStart(preferredPad, '0');
    }

    return `${normParent}${nextSuffix}`;
  }

  // حالة 2: حساب رئيسي (بدون أب)
  const normType = String(accountType || '').trim();
  let rootCode = '1';
  if (/التزام/iu.test(normType)) rootCode = '2';
  else if (/حقوق|ملكية/iu.test(normType)) rootCode = '3';
  else if (/إيراد|ايراد/iu.test(normType)) rootCode = '4';
  else if (/مصروف|تكاليف|تكلفة/iu.test(normType)) rootCode = '5';

  return rootCode;
}
