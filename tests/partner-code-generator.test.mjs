import test from 'node:test';
import assert from 'node:assert/strict';
import { getPartnerPrefix, generateNextPartnerCode } from '../lib/partnerCodeGenerator.ts';

test('Partner Code Generator: derives prefixes correctly by type and role', () => {
  // Clients
  assert.equal(getPartnerPrefix('عميل'), 'CLI');
  assert.equal(getPartnerPrefix('عميل', 'صاحب فيلا 102'), 'CLI');

  // Contractors
  assert.equal(getPartnerPrefix('مقاول'), 'CON');
  assert.equal(getPartnerPrefix('مقاول', 'مقاول خرسانات مسلحة'), 'CON');

  // Suppliers
  assert.equal(getPartnerPrefix('مورد'), 'SUP');
  assert.equal(getPartnerPrefix('مورد', 'توريد حديد واسمنت'), 'SUP');

  // Consultants & Gov
  assert.equal(getPartnerPrefix('استشاري'), 'CNS');
  assert.equal(getPartnerPrefix('جهة حكومية'), 'GOV');
  assert.equal(getPartnerPrefix('تأجير معدات'), 'EQP');

  // Staff by role
  assert.equal(getPartnerPrefix('موظف', 'مهندس موقع معماري'), 'ENG');
  assert.equal(getPartnerPrefix('موظف', 'مدير مشروع'), 'ENG');
  assert.equal(getPartnerPrefix('موظف', 'محاسب مالي'), 'EMP');
  assert.equal(getPartnerPrefix('موظف', 'أمين مستودع'), 'EMP');

  // Labor by role
  assert.equal(getPartnerPrefix('عامل يومية', 'نجار مسلح'), 'WRK');
  assert.equal(getPartnerPrefix('عامل يومية', 'حداد مسلح'), 'WRK');
  assert.equal(getPartnerPrefix('عامل يومية', 'مساعد نجار'), 'HLP');
  assert.equal(getPartnerPrefix('عامل يومية', 'عامل عادي شيل وتعتيق'), 'HLP');
  assert.equal(getPartnerPrefix('عامل يومية', 'سائق لودر'), 'OPR');
  assert.equal(getPartnerPrefix('عامل يومية', 'خفير موقع'), 'OPR');
});

test('Partner Code Generator: generates sequential next code based on existing codes', () => {
  // First client
  assert.equal(generateNextPartnerCode('عميل', '', []), 'CLI-001');

  // With existing clients CLI-001, CLI-002
  assert.equal(generateNextPartnerCode('عميل', '', ['CLI-001', 'CLI-002', 'CLI-005']), 'CLI-006');

  // With existing workers WRK-1, WRK-2, WRK-130
  assert.equal(generateNextPartnerCode('عامل يومية', 'نجار مسلح', ['WRK-1', 'WRK-2', 'WRK-130']), 'WRK-131');

  // Helper with role
  assert.equal(generateNextPartnerCode('عامل يومية', 'مساعد نجار', ['HLP-001', 'HLP-002']), 'HLP-003');

  // Engineer with role
  assert.equal(generateNextPartnerCode('موظف', 'مهندس موقع', ['ENG-001', 'ENG-003']), 'ENG-004');
});
