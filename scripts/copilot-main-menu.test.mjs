import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAIN_MENU_ACTIONS, MAIN_MENU_LAYOUT, REPORT_FOLLOWUP_ACTIONS, REPORT_FOLLOWUP_LAYOUT, buildMainMenuMarkup, buildReportFollowUpMarkup, resolveMenuAction, resolveReportAction } from './copilot-main-menu.mjs';

const registry = readFileSync(new URL('./copilot-tool-registry.mjs', import.meta.url), 'utf8');
const markup = buildMainMenuMarkup();
const buttons = markup.inline_keyboard.flat();

assert.equal(buttons.length, Object.keys(MAIN_MENU_ACTIONS).length, 'every action has a button');
assert.deepEqual(MAIN_MENU_LAYOUT.flat().sort(), Object.keys(MAIN_MENU_ACTIONS).sort(), 'layout covers all actions');
for (const b of buttons) {
  assert.ok(Buffer.byteLength(b.callback_data) <= 64, 'callback_data within Telegram 64-byte limit');
  const action = resolveMenuAction(b.callback_data);
  assert.ok(action && action.phrase, `button ${b.callback_data} resolves to a phrase`);
  assert.ok(registry.includes(`name: '${action.tool}'`), `${action.tool} exists in tool registry`);
}
assert.equal(resolveMenuAction('menu:nope'), null);
assert.equal(resolveMenuAction('jo_pick:1:2'), null);
assert.equal(resolveMenuAction(undefined), null);

const fu = buildReportFollowUpMarkup().inline_keyboard.flat();
assert.equal(fu.length, Object.keys(REPORT_FOLLOWUP_ACTIONS).length, 'every follow-up action has a button');
assert.deepEqual(REPORT_FOLLOWUP_LAYOUT.flat().sort(), Object.keys(REPORT_FOLLOWUP_ACTIONS).sort());
for (const b of fu) {
  assert.ok(Buffer.byteLength(b.callback_data) <= 64);
  const a = resolveReportAction(b.callback_data);
  assert.ok(a, `${b.callback_data} resolves`);
  if (a.key === 'menu') { assert.equal(a.phrase, null); continue; }
  assert.ok(a.phrase, `${b.callback_data} has a phrase`);
  assert.ok(registry.includes(`name: '${a.tool}'`), `${a.tool} exists in tool registry`);
}
assert.equal(resolveReportAction('report:toString'), null, 'prototype keys are rejected');
assert.equal(resolveReportAction('report:nope'), null);
assert.equal(resolveReportAction('menu:projects'), null);
assert.equal(resolveMenuAction('report:yesterday'), null);
console.log(`copilot-main-menu: ${buttons.length} menu + ${fu.length} follow-up buttons OK`);
