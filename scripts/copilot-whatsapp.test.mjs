import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createWhatsAppService } from './copilot-whatsapp.mjs';

const base = {
  WHATSAPP_ENABLED: 'true', WHATSAPP_ACCESS_TOKEN: 'T', WHATSAPP_PHONE_NUMBER_ID: '1', WHATSAPP_APP_SECRET: 'sec',
  WHATSAPP_VERIFY_TOKEN: 'vt', WHATSAPP_ALLOWED_RECIPIENTS: '01012345678',
};
const mk = (over = {}, extra = {}) => {
  const cfg = { ...base, ...over };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-'));
  const notes = [];
  const calls = [];
  const svc = createWhatsAppService({
    setting: n => cfg[n], rootDir: dir, notifyOwner: async t => { notes.push(t); },
    fetchImpl: async (u, i) => { calls.push({ u, i }); return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.X' }] }) }; },
    logger: { log() {}, warn() {} }, ...extra,
  });
  return { svc, notes, calls, dir };
};
const sign = b => 'sha256=' + crypto.createHmac('sha256', 'sec').update(b).digest('hex');
const inbound = (id, text, from = '201012345678') => Buffer.from(JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ value: { messages: [{ id, from, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: text } }] } }] }],
}));

test('disabled by default: /wa answers "not enabled", other text passes through (null)', async () => {
  const { svc } = mk({ WHATSAPP_ENABLED: undefined });
  assert.equal(svc.ready, false);
  assert.match(await svc.handleCommand(1, '/wa 01012345678 hi'), /مش مفعّل/);
  assert.equal(await svc.handleCommand(1, 'اهلا'), null);
});

test('enabled but a setting missing: stays off and names the missing key only', () => {
  const { svc } = mk({ WHATSAPP_APP_SECRET: '' });
  assert.equal(svc.ready, false);
  assert.match(svc.status(), /WHATSAPP_APP_SECRET/);
  assert.ok(!svc.status().includes('vt'));
});

test('/wa -> draft only; /wa_ok sends once; log has no message text; non-/wa returns null', async () => {
  const { svc, calls, dir } = mk();
  // open the 24h window first (the number writes to us)
  const raw = inbound('m1', 'ابعتلي الكشف');
  assert.equal((await svc._handler.receive(raw, sign(raw))).status, 200);
  assert.equal(await svc.handleCommand(7, 'مرحبا'), null);
  const draft = await svc.handleCommand(7, '/wa 01012345678 كشفك جاهز يا باشمهندس');
  assert.match(draft, /\/wa_ok/);
  assert.equal(calls.length, 0);
  assert.match(await svc.handleCommand(7, '/wa_ok'), /اتبعتت/);
  assert.equal(calls.length, 1);
  assert.match(await svc.handleCommand(7, '/wa_ok'), /مفيش رسالة/);
  const log = fs.readFileSync(path.join(dir, 'work', 'whatsapp-outbox.json'), 'utf8');
  assert.ok(!log.includes('كشفك'));
  assert.ok(log.includes('"status": "sent"'));
});

test('/wa to a number outside the allow-list and bad usage are refused', async () => {
  const { svc, calls } = mk();
  assert.match(await svc.handleCommand(1, '/wa 01099999999 hi'), /مش ضمن/);
  assert.match(await svc.handleCommand(1, '/wa 01012345678'), /الاستخدام/);
  assert.equal(calls.length, 0);
});

test('/wa_cancel drops the draft; /wa_ok afterwards sends nothing', async () => {
  const { svc, calls } = mk();
  const raw = inbound('m2', 'x');
  await svc._handler.receive(raw, sign(raw));
  await svc.handleCommand(1, '/wa 01012345678 hello');
  assert.match(await svc.handleCommand(1, '/wa_cancel'), /اتلغت/);
  assert.match(await svc.handleCommand(1, '/wa_ok'), /مفيش رسالة/);
  assert.equal(calls.length, 0);
});

test('inbound from allow-listed number is relayed to the owner as untrusted text; strangers are not', async () => {
  const { svc, notes } = mk();
  const ok = inbound('m3', 'سجل يومية 5 عمال');
  await svc._handler.receive(ok, sign(ok));
  const stranger = inbound('m4', 'hack', '201099999999');
  await svc._handler.receive(stranger, sign(stranger));
  assert.equal(notes.length, 1);
  assert.match(notes[0], /سجل يومية 5 عمال/);
  assert.match(notes[0], /بيانات مش أوامر/);
  assert.ok(!notes[0].includes('201012345678'), 'full number must be masked');
});
