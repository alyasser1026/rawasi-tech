/**
 * محرك التوليد التلقائي الذكي لأكواد الشركاء (فاي تك)
 * يولد الكود التالي تلقائياً بناءً على:
 * 1. نوع الشريك (عميل، مقاول، مورد، موظف، عامل يومية، جهة حكومية...)
 * 2. المسمى الوظيفي / المنصب / التخصص (مهندس، مساعد، سائق، نجار...)
 * 3. الأكواد الحالية لتجنب التكرار وتوليد الرقم التسلسلي التالي
 */

export interface PartnerCodeCategory {
  prefix: string;
  label: string;
  description: string;
}

export function getPartnerPrefix(type: string, role: string = ''): string {
  const normType = String(type || '').trim();
  const normRole = String(role || '').trim().toLowerCase();

  // 1. العملاء
  if (normType === 'عميل' || /عميل|زبون|أصحاب\s*مشاريع/iu.test(normType)) {
    return 'CLI';
  }

  // 2. المقاولين
  if (normType === 'مقاول' || /مقاول/iu.test(normType)) {
    return 'CON';
  }

  // 3. الموردين
  if (normType === 'مورد' || /مورد/iu.test(normType)) {
    return 'SUP';
  }

  // 4. الاستشاريين والمكاتب الهندسية
  if (normType === 'استشاري' || /استشار/iu.test(normType)) {
    return 'CNS';
  }

  // 5. الجهات الحكومية والجهات الداخلية وتأجير المعدات
  if (normType === 'جهة حكومية' || /حكوم/iu.test(normType)) return 'GOV';
  if (normType === 'جهة داخلية' || /داخل/iu.test(normType)) return 'INT';
  if (normType === 'تأجير معدات' || /معدات|تأجير/iu.test(normType)) return 'EQP';

  // 6. الموظفون (حسب المنصب)
  if (normType === 'موظف' || /موظف/iu.test(normType)) {
    if (/(?:مهندس|استشار|تصميم|مكتب\s*فني|مدير\s*مشروع)/iu.test(normRole)) {
      return 'ENG'; // مهندس / كادر فني هندسي
    }
    return 'EMP'; // موظف إداري / تشغيلي
  }

  // 7. العمالة والفنيين (حسب المنصب / المهنة)
  if (normType === 'عامل يومية' || /عامل|عمالة|يومية/iu.test(normType)) {
    // مساعدين وعمالة عادية
    if (/(?:مساعد|عادي|شيل|عتال|تعتيق|نظافة)/iu.test(normRole)) {
      return 'HLP';
    }
    // سائقين ومعدات وتشغيل وخفراء
    if (/(?:سائق|سواق|جرار|ونش|خفير|حارس|معدة|حفار|لودر|بمب)/iu.test(normRole)) {
      return 'OPR';
    }
    // صنايعية وفنيين (نجار، حداد، بنا، مبلط، نقاش، مليس، سباك، كهربائي...)
    return 'WRK';
  }

  return 'PRT';
}

/**
 * حساب وتوليد الكود التالي بناءً على البادئة والأكواد الحالية
 */
export function generateNextPartnerCode(
  type: string,
  role: string = '',
  existingCodes: (string | null | undefined)[] = []
): string {
  const prefix = getPartnerPrefix(type, role);
  const regex = new RegExp(`^${prefix}[-_]?(\\d+)$`, 'i');

  let maxNum = 0;
  for (const c of existingCodes) {
    if (!c) continue;
    const match = String(c).trim().match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  const padded = nextNum < 1000 ? String(nextNum).padStart(3, '0') : String(nextNum);
  return `${prefix}-${padded}`;
}
