import test from 'node:test';
import assert from 'node:assert/strict';

function parseLaborCommand(text) {
  const t = text.trim();

  // Check if it's a labor log command
  if (!/(?:ضيف|اضف|أضف|سجل|سجّل|اعمل).*(?:يوميه|يومية|فني|عامل)/iu.test(t)) {
    return null;
  }

  // Lookahead boundary for tokens
  const boundary = '(?=\\s+(?:و?العامل|و?عامل|و?المساعد|و?مساعد|و?الفيلا|و?فيلا|و?المشروع|و?مشروع|و?العماره|و?عماره|و?العمارة|و?عمارة|و?الموقع|و?موقع|و?البند|و?بند|و?امر\\s*شغل|و?أمر\\s*شغل|و?امر|و?أمر|و?انتاجيته|و?إنتاجيته|و?انتاجية|و?إنتاجية|و?انتاج|و?إنتاج|و?عمل|و?طريحه|و?طريحة|و?يوميه|و?يومية|و?اجر|و?أجر|و?ملاحظات|و?ملاحظة|و?ملاحظه|و?بيان|\\d)|$)';

  // Extract technician name
  const techMatch = t.match(new RegExp(`(?:للفني|فني)\\s*(?:واسمه|اسمه)?\\s+([\\p{L}\\s]{2,30}?)${boundary}`, 'u'));

  // Extract helper/worker name
  const helperMatch = t.match(new RegExp(`(?:و?العامل|و?عامل|و?المساعد|و?مساعد)\\s*(?:واسمه|اسمه)?\\s+([\\p{L}\\s]{2,30}?)${boundary}`, 'u'));

  let workerName = techMatch?.[1]?.trim();
  let helperName = helperMatch?.[1]?.trim();

  // If input was "يومية عامل فلان" without a separate technician, techMatch is null and helperMatch might catch it
  if (!workerName && helperName) {
    // If text does not mention both (tech and helper), promote helperName to workerName
    if (!/(?:فني|صنايعي)/u.test(t)) {
      workerName = helperName;
      helperName = undefined;
    }
  }

  // Fallback single worker if neither matched
  if (!workerName) {
    const singleMatch = t.match(new RegExp(`(?:يوميه|يومية)\\s*(?:عامل\\s+)?([\\p{L}\\s]{2,30}?)${boundary}`, 'u'));
    workerName = singleMatch?.[1]?.trim();
  }

  // Extract site / villa
  const siteMatch = t.match(/(?:و?الفيلا|و?فيلا|و?المشروع|و?مشروع|و?العماره|و?عماره|و?العمارة|و?عمارة|و?الموقع|و?موقع)\s*([\p{L}\p{N}_-]+)/u);

  // Extract work item
  const itemMatch = t.match(new RegExp(`(?:و?البند|و?بند)\\s+([\\p{L}\\s]{2,40}?)${boundary}`, 'u'));

  // Extract productivity
  const prodMatch = t.match(/(?:و?انتاجيته|و?إنتاجيته|و?انتاجية|و?إنتاجية|و?انتاج|و?إنتاج|و?عمل|و?منفذ|و?انجز|و?أنجز)\s*(?:كذا\s*)?(\d+(?:\.\d+)?)/u);

  // Extract tareeha
  const tareehaMatch = t.match(/(?:و?طريحه|و?طريحة)\s*(?:كذا\s*)?(\d+(?:\.\d+)?)/u);

  // Extract daily wages
  const wageMatches = [...t.matchAll(/(?:و?يوميه|و?يومية|و?اجر|و?أجر|بـ)\s*(?:كذا\s*)?(\d+(?:\.\d+)?)/gu)];
  const dailyWage = wageMatches.length > 0 ? Number(wageMatches[0][1]) : undefined;
  const helperWage = wageMatches.length > 1 ? Number(wageMatches[1][1]) : undefined;

  // Extract job order if explicitly specified
  const joMatch = t.match(/(?:و?امر\s*شغل|و?أمر\s*شغل|و?امر|و?أمر)\s*(?:رقم\s*)?#?([a-zA-Z0-9_-]+)/u);

  // Extract notes
  const notesMatch = t.match(/(?:و?ملاحظات|و?ملاحظة|و?ملاحظه|و?بيان)\s+([\p{L}\p{N}\s]{2,100})/u);

  return {
    worker_name: workerName,
    helper_name: helperName,
    site_ref: siteMatch ? siteMatch[0].trim() : undefined,
    work_item: itemMatch ? itemMatch[1].trim() : undefined,
    productivity: prodMatch ? Number(prodMatch[1]) : undefined,
    tareeha: tareehaMatch ? Number(tareehaMatch[1]) : undefined,
    daily_wage: dailyWage,
    helper_wage: helperWage,
    job_order: joMatch ? joMatch[1].trim() : undefined,
    notes: notesMatch ? notesMatch[1].trim() : undefined,
  };
}

test('parses technician + worker + villa + item + productivity + wage', () => {
  const input = 'ضيفلي يوميه للفني واسمه احمد والعامل اسمه ابراهيم الفيلا 657 والبند محارة وانتاجيته 40 واليومية 250 وملاحظات تم استلام الشغل';
  const parsed = parseLaborCommand(input);

  assert.equal(parsed.worker_name, 'احمد');
  assert.equal(parsed.helper_name, 'ابراهيم');
  assert.equal(parsed.site_ref, 'الفيلا 657');
  assert.equal(parsed.work_item, 'محارة');
  assert.equal(parsed.productivity, 40);
  assert.equal(parsed.daily_wage, 250);
  assert.equal(parsed.notes, 'تم استلام الشغل');
});

test('parses single worker with tareeha and productivity', () => {
  const input = 'ضيفلي يومية عامل محمد مطيز بند جبس تجليد طريحة 50 عمل 35 يومية 200 فيلا 657';
  const parsed = parseLaborCommand(input);

  assert.equal(parsed.worker_name, 'محمد مطيز');
  assert.equal(parsed.work_item, 'جبس تجليد');
  assert.equal(parsed.tareeha, 50);
  assert.equal(parsed.productivity, 35);
  assert.equal(parsed.daily_wage, 200);
  assert.equal(parsed.site_ref, 'فيلا 657');
});

test('parses technician with job order explicitly specified', () => {
  const input = 'سجل يومية للفني علي فيلا 657 بند محارة امر شغل JO-2026-0001 انتاجية 40 يومية 250';
  const parsed = parseLaborCommand(input);

  assert.equal(parsed.worker_name, 'علي');
  assert.equal(parsed.site_ref, 'فيلا 657');
  assert.equal(parsed.work_item, 'محارة');
  assert.equal(parsed.job_order, 'JO-2026-0001');
  assert.equal(parsed.productivity, 40);
  assert.equal(parsed.daily_wage, 250);
});

