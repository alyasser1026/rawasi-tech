import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

// Extract parseBatchLaborLogs from telegram-copilot.mjs dynamically for unit testing
const copilotContent = fs.readFileSync('./scripts/telegram-copilot.mjs', 'utf8');

// Isolate parseBatchLaborLogs
const fnStart = copilotContent.indexOf('function parseBatchLaborLogs(');
const fnEnd = copilotContent.indexOf('export function detectDirectFieldOpsCall(');
const fnCode = copilotContent.slice(fnStart, fnEnd !== -1 ? fnEnd : copilotContent.indexOf('function detectDirectFieldOpsCall(')).replace(/export\s*$/, '').trim();

// Execute isolated function
const parseBatchLaborLogs = new Function(fnCode + '; return parseBatchLaborLogs;')();

test('Batch Labor Parser: parses 4 workers from pasted Partners block with project and item', () => {
  const userText = `عاوز اضيف يوميات للعمال دي إبراهيم النجار
نجار مسلح (يومية: 700 ر.س)
عامل يومية
غير مربوط
---
ينتهي: ---
---
---
01063927945
WRK-3
محمد بهلول
نجار مسلح (يومية: 700 ر.س)
عامل يومية
غير مربوط
---
ينتهي: ---
---
---
01011249475
WRK-4
حبيشه
مساعد (يومية: 300 ر.س)
عامل يومية
غير مربوط
---
ينتهي: ---
---
---
---
WRK-5
محمد جمعه
نجار مسلح (يومية: 700)
في مشروع برج كابيتال بند الاستراوس وامر الشغل اللي مربوط بيه
ليه اليوميات متضافتش انا بعت كدا في البوت المفروض البوت يكون الحساسيه فيه عاليه`;

  const res = parseBatchLaborLogs(userText);
  assert.ok(res !== null, 'Should parse batch labor successfully');
  assert.equal(res.type, 'multi_tools');
  assert.equal(res.siteRef, 'برج كابيتال');
  assert.equal(res.workItem, 'الاستراوس');
  assert.equal(res.calls.length, 4, 'Should extract exactly 4 worker calls');

  // Worker 1: إبراهيم النجار
  assert.equal(res.calls[0].args.worker_name, 'إبراهيم النجار');
  assert.equal(res.calls[0].args.skill_level, 'نجار مسلح');
  assert.equal(res.calls[0].args.daily_wage, 700);
  assert.equal(res.calls[0].args.site_ref, 'برج كابيتال');
  assert.equal(res.calls[0].args.work_item, 'الاستراوس');

  // Worker 2: محمد بهلول
  assert.equal(res.calls[1].args.worker_name, 'محمد بهلول');
  assert.equal(res.calls[1].args.skill_level, 'نجار مسلح');
  assert.equal(res.calls[1].args.daily_wage, 700);

  // Worker 3: حبيشه
  assert.equal(res.calls[2].args.worker_name, 'حبيشه');
  assert.equal(res.calls[2].args.skill_level, 'مساعد');
  assert.equal(res.calls[2].args.daily_wage, 300);

  // Worker 4: محمد جمعه
  assert.equal(res.calls[3].args.worker_name, 'محمد جمعه');
  assert.equal(res.calls[3].args.skill_level, 'نجار مسلح');
  assert.equal(res.calls[3].args.daily_wage, 700);
});

test('Batch Labor Parser: detects inline company 2 specification', () => {
  const userText = `في شركة رقم 2 عاوز اضيف يوميات للعمال دي
إبراهيم النجار 700
محمد بهلول 700
في مشروع برج كابيتال بند الاستراوس`;

  const res = parseBatchLaborLogs(userText);
  assert.ok(res !== null);
  assert.equal(res.targetCompany, 2);
  assert.equal(res.calls.length, 2);
});

test('Batch Labor Parser: parses horizontal inline worker list', () => {
  const userText = `ضيف يوميات للعمال إبراهيم النجار 700 ومحمد بهلول 700 وحبيشه 300 ومحمد جمعه 700 في برج كابيتال بند الاستراوس`;
  const res = parseBatchLaborLogs(userText);
  assert.ok(res !== null);
  assert.equal(res.calls.length, 4);
  assert.equal(res.calls[0].args.worker_name, 'إبراهيم النجار');
  assert.equal(res.calls[1].args.worker_name, 'محمد بهلول');
  assert.equal(res.calls[2].args.worker_name, 'حبيشه');
  assert.equal(res.calls[3].args.worker_name, 'محمد جمعه');
});
