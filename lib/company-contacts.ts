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
 * الرقم الضريبي والرقم الموحد للشركة الافتراضية (السعودية)، كانوا مكتوبين ثابت في الفاتورة الضريبية.
 * بيُستخدموا في الفاتورة الضريبية بس لو خانات «إعدادات الشركات» لسه فاضية. اسم الشركة على كل النماذج: فاي تك.
 */
export const PHI_DEFAULT_TAX_IDS = {
  taxNumber: '312487477800003',
  unifiedNumber: '7051013319',
};

type IssuerCompany = {
  legal_name?: string | null;
  tax_number?: string | null;
  cr_number?: string | null;
  address?: string | null;
  is_default?: boolean | null;
} | null | undefined;

/** البيانات الضريبية للفاتورة حسب الشركة المفتوحة: إعدادات الشركة أولًا، وبعدها الأرقام الافتراضية للشركة الافتراضية. */
export function resolveDocumentIssuer(company: IssuerCompany): DocumentIssuer {
  const clean = (v?: string | null) => (v && String(v).trim()) || undefined;
  const fallback = !company || company.is_default !== false ? PHI_DEFAULT_TAX_IDS : undefined;
  return {
    taxNumber: clean(company?.tax_number) || fallback?.taxNumber,
    unifiedNumber: clean(company?.cr_number) || fallback?.unifiedNumber,
    address: clean(company?.address),
  };
}
