// lib/company-contacts.ts
/**
 * بيانات الاتصال الرسمية الموحدة لشركة Phi Tech
 * تُستخدم في جميع التقارير، السندات المطبوعة، وكشوفات الحسابات
 */
export const PHI_COMPANY_CONTACTS = {
  nameAr: 'فاي تك للحلول والإنشاءات',
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
