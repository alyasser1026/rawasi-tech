// lib/company-contacts.ts
/**
 * بيانات الاتصال الرسمية الموحدة لشركة Phi Tech
 * تُستخدم في جميع التقارير، السندات المطبوعة، وكشوفات الحسابات
 */
export const PHI_COMPANY_CONTACTS = {
  nameAr: 'فاي تك للمقاولات والتوريدات',
  nameEn: 'Phi Tech',
  email: 'phi.tech.eg@gmail.com',
  phone1: '+201026332733',
  phone2: '+201558888744',
  phones: ['+201026332733', '+201558888744'],
  formattedPhones: '+201026332733  |  +201558888744',
  address: 'مصر / المملكة العربية السعودية',
  // صيغة بطاقة الاتصال القياسية vCard 3.0 التي يتعرف عليها أي هاتف ذكي فور مسح الباركود بالكاميرا
  vCard: [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:;Phi Tech;;;',
    'FN:Phi Tech',
    'ORG:Phi Tech',
    'TITLE:Engineering & Tech Solutions',
    'TEL;TYPE=CELL,VOICE:+201026332733',
    'TEL;TYPE=WORK,VOICE:+201558888744',
    'EMAIL;TYPE=INTERNET,PREF:phi.tech.eg@gmail.com',
    'NOTE:Official Contacts - Phi Tech',
    'END:VCARD'
  ].join('\r\n')
};

/** بيانات الكيان القانوني اللي بتظهر في ترويسة المستندات (الاسم والرقم الضريبي والرقم الموحد). */
export interface DocumentIssuer {
  nameAr?: string;
  nameEn?: string;
  taxNumber?: string;
  unifiedNumber?: string;
  address?: string;
}

/**
 * بيانات المؤسسة اللي كانت مكتوبة ثابتة في السندات والفاتورة الضريبية للشركة الافتراضية (السعودية).
 * بتُستخدم بس لو الشركة الافتراضية لسه ما اتسجلش لها اسم قانوني أو رقم ضريبي في إعدادات الشركة.
 * أول ما تتملا البيانات دي في «إعدادات الشركات»، هي اللي بتظهر.
 */
export const PHI_DEFAULT_ISSUER: Required<Omit<DocumentIssuer, 'address'>> = {
  nameAr: 'مؤسسة طفله عبد الله السبيعي للمقاولات',
  nameEn: 'Tifla Abdullah Al-Subaie Est. for Contracting',
  taxNumber: '312487477800003',
  unifiedNumber: '7051013319',
};

type IssuerCompany = {
  name?: string | null;
  legal_name?: string | null;
  tax_number?: string | null;
  cr_number?: string | null;
  address?: string | null;
  is_default?: boolean | null;
} | null | undefined;

/** الكيان المُصدر للمستند حسب الشركة المفتوحة: بيانات إعدادات الشركة أولًا، وبعدها بيانات الشركة الافتراضية القديمة. */
export function resolveDocumentIssuer(company: IssuerCompany): DocumentIssuer {
  const clean = (v?: string | null) => (v && String(v).trim()) || undefined;
  const legacy = !company || company.is_default !== false ? PHI_DEFAULT_ISSUER : undefined;
  return {
    nameAr: clean(company?.legal_name) || legacy?.nameAr || clean(company?.name),
    nameEn: clean(company?.legal_name) ? undefined : legacy?.nameEn,
    taxNumber: clean(company?.tax_number) || legacy?.taxNumber,
    unifiedNumber: clean(company?.cr_number) || legacy?.unifiedNumber,
    address: clean(company?.address),
  };
}
