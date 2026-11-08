import test from 'node:test';
import assert from 'node:assert/strict';

function parsePartnerDetails(text) {
  const t = String(text || '').trim();
  if (!t) return { job_role: null, daily_wage: null, partner_type: null };

  const wageMatch = t.match(/(?:يوميه|يومية|يوميته|اجره|أجره|اجر|أجر|راتب|راتبه|متفق\s*عليها|بسعر|بـ|ب)\s*(?:كذا\s*)?(\d+(?:\.\d+)?)/u) ||
                    t.match(/(\d+(?:\.\d+)?)\s*(?:ريال|ر\.س|جنية|جنيه|ج\.م)/u) ||
                    t.match(/\b(\d{2,4})\b/);
  const dailyWage = wageMatch ? Number(wageMatch[1]) : null;

  const tradePattern = '(?:(?:فني|صنايعي|معلم)\\s+)?(?:محارة|محاره|حدادة\\s*مسلحة|حدادة|حداده|نجارة\\s*مسلحة|نجارة|نجاره|سباكة|سباكه|كهرباء|نقاشة|نقاشه|دهانات|سيراميك|رخام|مباني|عزل|تكييف|ألوميتال|الوميتال|جبس|حداد\\s*مسلح|حداد|نجار\\s*مسلح|نجار|سباك|كهربائي|نقاش|دهان|مبلط|بناء|مليس|مساعد|عامل\\s*عادي|عامل|مشرف\\s*موقع|مشرف|مهندس\\s*موقع|مهندس)';
  const tradeMatch = t.match(new RegExp(tradePattern, 'u'));

  let jobRole = null;
  if (tradeMatch) {
    jobRole = tradeMatch[0].trim();
  } else {
    const roleClean = t
      .replace(/(?:مهنته|شغال|وظيفته|وظيفه|وظيفة|هو)\s*/u, '')
      .replace(/(?:و?يوميه|و?يومية|و?يوميته|و?اجره|و?أجره|و?اجر|و?أجر|و?متفق\s*عليها|و?بسعر|و?بـ|و?ب)\s*(?:كذا\s*)?\d+(?:\.\d+)?/gu, '')
      .replace(/\d+\s*(?:ريال|ر\.س|جنية|جنيه|ج\.م)/gu, '')
      .replace(/\b\d{2,4}\b/g, '')
      .trim();
    if (roleClean.length >= 2 && roleClean.length <= 40) {
      jobRole = roleClean;
    }
  }

  let partnerType = 'عامل يومية';
  if (/مهندس|مشرف|محاسب|مدير|اداري|إداري/u.test(jobRole || t)) {
    partnerType = 'موظف';
  } else if (/مقاول/u.test(jobRole || t)) {
    partnerType = 'مقاول';
  } else if (/مورد|شركة/u.test(jobRole || t)) {
    partnerType = 'مورد';
  }

  return {
    job_role: jobRole,
    daily_wage: dailyWage,
    partner_type: partnerType,
  };
}

test('parses profession and daily wage from Egyptian Arabic text', () => {
  const p1 = parsePartnerDetails('فني محارة ويوميته 250');
  assert.equal(p1.job_role, 'فني محارة');
  assert.equal(p1.daily_wage, 250);
  assert.equal(p1.partner_type, 'عامل يومية');

  const p2 = parsePartnerDetails('مهنته حداد مسلح واليومية المتفق عليها 200 ريال');
  assert.equal(p2.job_role, 'حداد مسلح');
  assert.equal(p2.daily_wage, 200);
  assert.equal(p2.partner_type, 'عامل يومية');

  const p3 = parsePartnerDetails('مهندس موقع وراتبه 6000');
  assert.equal(p3.job_role, 'مهندس موقع');
  assert.equal(p3.daily_wage, 6000);
  assert.equal(p3.partner_type, 'موظف');

  const p4 = parsePartnerDetails('نجار مسلح يومية 220');
  assert.equal(p4.job_role, 'نجار مسلح');
  assert.equal(p4.daily_wage, 220);

  const p5 = parsePartnerDetails('سباك واليومية 300');
  assert.equal(p5.job_role, 'سباك');
  assert.equal(p5.daily_wage, 300);

  const p6 = parsePartnerDetails('عامل عادي يوميته 150');
  assert.equal(p6.job_role, 'عامل عادي');
  assert.equal(p6.daily_wage, 150);
});

