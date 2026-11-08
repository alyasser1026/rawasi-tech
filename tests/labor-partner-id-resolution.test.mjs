import test from 'node:test';
import assert from 'node:assert/strict';

function normalizeArabicText(text) {
  if (!text) return '';
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[أإآءئؤ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\s+/g, ' ');
}

test('normalizeArabicText normalizes Arabic variations correctly', () => {
  assert.equal(normalizeArabicText('أحمد الصاوي'), normalizeArabicText('احمد الصاوي'));
  assert.equal(normalizeArabicText('إبراهيم شحاتة'), normalizeArabicText('ابراهيم شحاته'));
  assert.equal(normalizeArabicText('عَلِيّ حُسَيْن'), normalizeArabicText('علي حسين'));
  assert.equal(normalizeArabicText('مصطفى   عثمان'), normalizeArabicText('مصطفي عثمان'));
});

test('Partner ID resolution binds ID correctly from workers list', () => {
  const partners = [
    { id: 'p1', name: 'شركة الأمل للمقاولات', partner_type: 'مقاول' },
    { id: 'p2', name: 'أحمد الصاوي', partner_type: 'عامل يومية', code: '4035', job_role: 'حداد' },
    { id: 'p3', name: 'محمد سلطان', partner_type: 'عامل يومية', code: '4052', job_role: 'نجار' },
    { id: 'p4', name: 'خالد العشري', partner_type: 'موظف', code: '1002', job_role: 'مهندس موقع' },
  ];

  const workerRoles = ['عامل يومية', 'موظف', 'عامل'];
  const workersList = partners
    .filter((p) => {
      if (!p || !p.name) return false;
      const pType = (p.partner_type || '').trim();
      return workerRoles.includes(pType) || pType.includes('عامل') || pType.includes('موظف');
    })
    .sort((a, b) => {
      const rankA = a.partner_type === 'عامل يومية' ? 1 : (a.partner_type === 'موظف' ? 2 : 3);
      const rankB = b.partner_type === 'عامل يومية' ? 1 : (b.partner_type === 'موظف' ? 2 : 3);
      if (rankA !== rankB) return rankA - rankB;
      return (a.name || '').localeCompare(b.name || '', 'ar');
    });

  assert.equal(workersList.length, 3);
  assert.equal(workersList[0].partner_type, 'عامل يومية');

  // Test resolution when user types "احمد الصاوي" (without hamza)
  const userInput = 'احمد الصاوي';
  const normInput = normalizeArabicText(userInput);
  const matched = workersList.find((w) => normalizeArabicText(w.name) === normInput);

  assert.ok(matched, 'Worker should be matched');
  assert.equal(matched.id, 'p2');
  assert.equal(matched.job_role, 'حداد');
});

test('Fallback resolution in save log captures worker partner ID', () => {
  const partners = [
    { id: 'w101', name: 'أمير مصري', partner_type: 'عامل يومية' },
  ];

  const currentLog = {
    worker_name: 'امير مصري',
    worker_partner_id: null,
  };

  let resolvedId = currentLog.worker_partner_id;
  if (!resolvedId && currentLog.worker_name) {
    const normWorker = normalizeArabicText(currentLog.worker_name);
    const foundWorker = partners.find((p) => {
      if (!p || !p.name) return false;
      const normP = normalizeArabicText(p.name);
      return normP === normWorker || normP.includes(normWorker) || normWorker.includes(normP);
    });
    if (foundWorker) resolvedId = foundWorker.id;
  }

  assert.equal(resolvedId, 'w101');
});
