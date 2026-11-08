import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KNOWN_COMPANIES,
  getActiveCompany,
  setActiveCompany,
  getBotSettings,
  saveBotSettings,
} from '../scripts/copilot-bot-settings.mjs';

test('KNOWN_COMPANIES contains both Company 1 (Saudi) and Company 2 (Egypt)', () => {
  assert.equal(KNOWN_COMPANIES.length, 2);
  const [comp1, comp2] = KNOWN_COMPANIES;

  assert.equal(comp1.index, 1);
  assert.equal(comp1.id, '72918f4d-10c3-43a0-884e-2f84f1224335');
  assert.equal(comp1.code, 'PHI');
  assert.equal(comp1.country, 'SA');

  assert.equal(comp2.index, 2);
  assert.equal(comp2.id, '8c90cb59-ffa3-4cd1-8bdc-db80a3c825b8');
  assert.equal(comp2.code, 'AWA');
  assert.equal(comp2.country, 'EG');
});

test('setActiveCompany switches between Company 1 and Company 2 cleanly', () => {
  const comp2 = setActiveCompany('2');
  assert.equal(comp2.index, 2);
  assert.equal(comp2.id, '8c90cb59-ffa3-4cd1-8bdc-db80a3c825b8');
  assert.equal(getActiveCompany().id, '8c90cb59-ffa3-4cd1-8bdc-db80a3c825b8');

  const comp1 = setActiveCompany('واحد');
  assert.equal(comp1.index, 1);
  assert.equal(comp1.id, '72918f4d-10c3-43a0-884e-2f84f1224335');
  assert.equal(getActiveCompany().id, '72918f4d-10c3-43a0-884e-2f84f1224335');

  const comp2ByName = setActiveCompany('التانية');
  assert.equal(comp2ByName.index, 2);
  assert.equal(getActiveCompany().id, '8c90cb59-ffa3-4cd1-8bdc-db80a3c825b8');

  // Reset to Company 1
  setActiveCompany('1');
  assert.equal(getActiveCompany().index, 1);
});

test('Company regex patterns match colloquial Egyptian voice and text commands', () => {
  const COMPANY_1_REGEX = /^(?:افتح|إفتح|شغل|شغّل|حول|حوّل|وديني|اختار|إختار|ادخل|إدخل|هات|غير|غيّر|بدل|بدّل|عايز|عاوز|روح|خلينا\s*في)\s*(?:على|إلى|الي|لي|لى)?\s*(?:(?:ال)?شرك[ةه]\s*)?(?:واحد|1|الاولى|الأولى|الاولانيه|الأولانيه|فاي\s*تك|الاساسيه|الأساسية|السعوديه|السعودية)$|^(?:(?:ال)?شرك[ةه]\s*)?(?:واحد|1|الاولى|الأولى|الاولانيه|الأولانيه|فاي\s*تك)$|^\/company\s*1$/i;
  const COMPANY_2_REGEX = /^(?:افتح|إفتح|شغل|شغّل|حول|حوّل|وديني|اختار|إختار|ادخل|إدخل|هات|غير|غيّر|بدل|بدّل|عايز|عاوز|روح|خلينا\s*في)\s*(?:على|إلى|الي|لي|لى)?\s*(?:(?:ال)?شرك[ةه]\s*)?(?:اتنين|تنين|2|التانيه|الثانيه|الثانية|التانية|مصر|egy|phi-tech-egy|awa)$|^(?:(?:ال)?شرك[ةه]\s*)?(?:اتنين|تنين|2|التانيه|الثانيه|الثانية|التانية|مصر|egy|phi-tech-egy)$|^\/company\s*2$/i;

  // Company 1 variants
  assert.equal(COMPANY_1_REGEX.test('افتحلي شركة واحد'), true);
  assert.equal(COMPANY_1_REGEX.test('افتح شركة 1'), true);
  assert.equal(COMPANY_1_REGEX.test('شركه 1'), true);
  assert.equal(COMPANY_1_REGEX.test('الشركة الأولى'), true);
  assert.equal(COMPANY_1_REGEX.test('حول على فاي تك'), true);
  assert.equal(COMPANY_1_REGEX.test('/company 1'), true);

  // Company 2 variants
  assert.equal(COMPANY_2_REGEX.test('افتحلي شركة 2'), true);
  assert.equal(COMPANY_2_REGEX.test('افتح شركة اتنين'), true);
  assert.equal(COMPANY_2_REGEX.test('شركه 2'), true);
  assert.equal(COMPANY_2_REGEX.test('الشركة التانية'), true);
  assert.equal(COMPANY_2_REGEX.test('حول على مصر'), true);
  assert.equal(COMPANY_2_REGEX.test('حول على phi-tech-egy'), true);
  assert.equal(COMPANY_2_REGEX.test('/company 2'), true);
});
