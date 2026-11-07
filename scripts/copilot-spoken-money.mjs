const SMALL_NUMBERS = [
  'صفر', 'واحد', 'اتنين', 'تلاتة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'تمانية', 'تسعة',
  'عشرة', 'حداشر', 'اتناشر', 'تلتاشر', 'أربعتاشر', 'خمستاشر', 'ستاشر', 'سبعتاشر', 'تمنتاشر', 'تسعتاشر',
];
const COUNT_FORMS = ['', '', '', 'تلات', 'أربع', 'خمس', 'ست', 'سبع', 'تمن', 'تسع', 'عشر'];
const TENS = ['', '', 'عشرين', 'تلاتين', 'أربعين', 'خمسين', 'ستين', 'سبعين', 'تمانين', 'تسعين'];
const HUNDREDS = ['', 'مية', 'ميتين', 'تلتمية', 'أربعمية', 'خمسمية', 'ستمية', 'سبعمية', 'تمنمية', 'تسعمية'];
const MAX_RIYALS = 999_999_999;

function underThousand(value) {
  if (value < 20) return SMALL_NUMBERS[value];
  if (value < 100) {
    const ones = value % 10;
    return (ones ? SMALL_NUMBERS[ones] + ' و' : '') + TENS[Math.floor(value / 10)];
  }
  const remainder = value % 100;
  return HUNDREDS[Math.floor(value / 100)] + (remainder ? ' و' + underThousand(remainder) : '');
}

function scaleWords(value, singular, dual, plural) {
  if (value === 1) return singular;
  if (value === 2) return dual;
  if (value <= 10) return COUNT_FORMS[value] + ' ' + plural;
  return underThousand(value) + ' ' + singular;
}

export function egyptianNumberWords(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_RIYALS) return String(value);
  const millions = Math.floor(value / 1_000_000);
  const thousands = Math.floor(value / 1_000) % 1_000;
  const remainder = value % 1_000;
  const groups = [];
  if (millions) groups.push(scaleWords(millions, 'مليون', 'مليونين', 'ملايين'));
  if (thousands) groups.push(scaleWords(thousands, 'ألف', 'ألفين', 'تلاف'));
  if (remainder || !groups.length) groups.push(underThousand(remainder));
  return groups.join(' و');
}

function riyalWords(value) {
  if (value === 1) return 'ريال سعودي واحد';
  if (value === 2) return 'ريالين سعوديين';
  if (value >= 3 && value <= 10) return SMALL_NUMBERS[value] + ' ريالات سعودية';
  return egyptianNumberWords(value) + ' ريال سعودي';
}

function halalaWords(value) {
  if (value === 1) return 'هللة واحدة';
  if (value === 2) return 'هللتين';
  if (value <= 10) return COUNT_FORMS[value] + ' هللات';
  return underThousand(value) + ' هللة';
}

export function formatEgyptianRiyals(text) {
  return text.replace(
    /(?<![\p{L}\p{M}\p{N}_#/:.+,٬٫−-])([+−-]?[\d٠-٩۰-۹][\d٠-٩۰-۹.,٬٫]*)[ \t\u00a0\u202f]+ريال سعودي(?![\p{L}\p{M}\p{N}])/gu,
    (phrase, token, offset, source) => {
      // A separated numeric group may be an unsupported amount such as "1 500".
      if (/[\d٠-٩۰-۹][ \t\u00a0\u202f]+$/.test(source.slice(0, offset))) return phrase;
      const amount = token
        .replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 0xf))
        .replace(/٬/g, ',')
        .replace(/٫/g, '.');
      const parts = amount.match(/^([+−-]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/);
      if (!parts) return phrase;

      const [, sign, integer, fraction = ''] = parts;
      const riyals = Number(integer.replace(/,/g, ''));
      const halalas = Number(fraction.padEnd(2, '0'));
      if (riyals > MAX_RIYALS) return phrase;

      const spoken = riyals || !halalas ? [riyalWords(riyals)] : [];
      if (halalas) spoken.push(halalaWords(halalas));
      const prefix = sign === '+' ? 'زائد ' : sign && (riyals || halalas) ? 'ناقص ' : '';
      return prefix + spoken.join('، و');
    },
  );
}
