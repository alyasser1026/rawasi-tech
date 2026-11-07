import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  normalizeWhatsAppNumber, parseNumberList, verifyWebhookSignature, parseWebhookPayload,
  createWindowTracker, createWhatsAppClient, createWhatsAppOutbox, createWebhookHandler, WhatsAppSendError,
} from './whatsapp-cloud.mjs';

const sign = (body, secret) => 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

test('numbers normalize to E.164 digits (Egypt default)', () => {
  assert.equal(normalizeWhatsAppNumber('01012345678'), '201012345678');
  assert.equal(normalizeWhatsAppNumber('+20 101 234 5678'), '201012345678');
  assert.equal(normalizeWhatsAppNumber('00201012345678'), '201012345678');
  assert.equal(normalizeWhatsAppNumber('966501234567'), '966501234567');
  assert.equal(normalizeWhatsAppNumber('abc'), null);
  assert.equal(normalizeWhatsAppNumber('123'), null);
  assert.equal(normalizeWhatsAppNumber(null), null);
  assert.deepEqual([...parseNumberList('01012345678, 966501234567;bad')], ['201012345678', '966501234567']);
});

test('signature: valid passes, wrong secret / tampered body / missing header fail', () => {
  const body = Buffer.from('{"a":1}');
  assert.equal(verifyWebhookSignature(body, sign(body, 's3'), 's3'), true);
  assert.equal(verifyWebhookSignature(body, sign(body, 'other'), 's3'), false);
  assert.equal(verifyWebhookSignature(Buffer.from('{"a":2}'), sign(body, 's3'), 's3'), false);
  assert.equal(verifyWebhookSignature(body, undefined, 's3'), false);
  assert.equal(verifyWebhookSignature(body, 'sha256=zz', 's3'), false);
  assert.equal(verifyWebhookSignature(body, sign(body, 's3'), ''), false);
});

const payload = (messages, statuses) => ({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ value: { contacts: [{ wa_id: '201012345678', profile: { name: 'م. أحمد' } }], messages, statuses } }] }],
});

test('parse: text messages only; statuses ignored; foreign object ignored', () => {
  const msgs = parseWebhookPayload(payload([{ id: 'wamid.1', from: '201012345678', timestamp: '1700000000', type: 'text', text: { body: 'اليومية النهارده' } }], [{ id: 'x' }]));
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].text, 'اليومية النهارده');
  assert.equal(msgs[0].name, 'م. أحمد');
  assert.equal(parseWebhookPayload({ object: 'page' }).length, 0);
  assert.equal(parseWebhookPayload(null).length, 0);
  assert.equal(parseWebhookPayload(payload(undefined, [{ id: 's' }])).length, 0);
});

test('window opens on inbound and closes after 24h', () => {
  let t = 1_000_000;
  const w = createWindowTracker({ now: () => t });
  assert.equal(w.isOpen('201'), false);
  w.touch('201');
  assert.equal(w.isOpen('201'), true);
  t += 24 * 3600_000 + 1;
  assert.equal(w.isOpen('201'), false);
});

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const r = responses.shift() ?? { status: 200, json: { messages: [{ id: 'wamid.OUT' }] } };
    if (r.throw) throw new Error('net');
    return { ok: r.status < 400, status: r.status, json: async () => r.json };
  };
  return { impl, calls };
}

test('client: sendText payload, bearer token, never leaks Meta raw error text', async () => {
  const f = fakeFetch([{ status: 200, json: { messages: [{ id: 'wamid.1' }] } }, { status: 400, json: { error: { code: 131047, message: 'SECRET DETAIL 0101' } } }]);
  const c = createWhatsAppClient({ accessToken: 'TOK', phoneNumberId: '99', fetchImpl: f.impl });
  const r = await c.sendText('201012345678', 'مرحبا');
  assert.equal(r.id, 'wamid.1');
  assert.match(f.calls[0].url, /\/99\/messages$/);
  assert.equal(f.calls[0].init.headers.Authorization, 'Bearer TOK');
  const sent = JSON.parse(f.calls[0].init.body);
  assert.equal(sent.to, '201012345678');
  assert.equal(sent.text.body, 'مرحبا');
  await assert.rejects(() => c.sendText('201012345678', 'x'), e => e instanceof WhatsAppSendError && e.code === '131047' && !/SECRET/.test(e.message));
});

test('client: network failure is "uncertain" (code network, not retryable)', async () => {
  const f = fakeFetch([{ throw: true }]);
  const c = createWhatsAppClient({ accessToken: 'T', phoneNumberId: '1', fetchImpl: f.impl });
  await assert.rejects(() => c.sendText('201012345678', 'x'), e => e.code === 'network' && e.retryable === false);
});

function outboxFixture({ open = true, template = null, maxPerHour = 30, responses = [] } = {}) {
  const f = fakeFetch(responses);
  const client = createWhatsAppClient({ accessToken: 'T', phoneNumberId: '1', fetchImpl: f.impl });
  let t = 5_000_000;
  const windows = createWindowTracker({ now: () => t });
  if (open) windows.touch('201012345678');
  const logs = [];
  const outbox = createWhatsAppOutbox({
    client, windows, template, now: () => t, maxPerHour, log: e => logs.push(e),
    allowedRecipients: new Set(['201012345678']), randomId: () => 'abcd1234',
  });
  return { outbox, f, logs, advance: ms => { t += ms; } };
}

test('outbox: draft sends nothing; /confirm sends once; second confirm cannot double-send', async () => {
  const { outbox, f, logs } = outboxFixture();
  const d = outbox.draft(1, '01012345678', 'كشف حسابك جاهز');
  assert.equal(d.ok, true);
  assert.equal(f.calls.length, 0);
  assert.equal((await outbox.confirm(1)).ok, true);
  assert.equal(f.calls.length, 1);
  assert.equal((await outbox.confirm(1)).ok, false);
  assert.equal(f.calls.length, 1);
  assert.equal(logs[0].status, 'sent');
  assert.ok(!JSON.stringify(logs).includes('كشف'), 'log must not contain message text');
  assert.ok(logs[0].to.startsWith('***'));
});

test('outbox: recipient not in allow-list, bad number, empty, too long are rejected', () => {
  const { outbox } = outboxFixture();
  assert.equal(outbox.draft(1, '01099999999', 'x').ok, false);
  assert.equal(outbox.draft(1, 'abc', 'x').ok, false);
  assert.equal(outbox.draft(1, '01012345678', '   ').ok, false);
  assert.equal(outbox.draft(1, '01012345678', 'ا'.repeat(1001)).ok, false);
});

test('outbox: outside window needs a template; document never goes outside window', async () => {
  const closed = outboxFixture({ open: false });
  assert.equal(closed.outbox.draft(1, '01012345678', 'x').ok, false);
  const tpl = outboxFixture({ open: false, template: { name: 'statement_ready', language: 'ar', buildParams: t => [t] } });
  assert.equal(tpl.outbox.draft(1, '01012345678', 'x').ok, true);
  await tpl.outbox.confirm(1);
  assert.equal(JSON.parse(tpl.f.calls[0].init.body).type, 'template');
  const doc = { filename: 's.pdf', buffer: Buffer.from('pdf') };
  assert.equal(tpl.outbox.draft(1, '01012345678', 'x', { document: doc }).ok, false);
});

test('outbox: expired draft, rate limit, uncertain network state', async () => {
  const a = outboxFixture();
  a.outbox.draft(1, '01012345678', 'x');
  a.advance(11 * 60 * 1000);
  assert.match((await a.outbox.confirm(1)).error, /انتهت/);

  const b = outboxFixture({ maxPerHour: 1 });
  b.outbox.draft(1, '01012345678', 'one');
  assert.equal((await b.outbox.confirm(1)).ok, true);
  b.outbox.draft(1, '01012345678', 'two');
  assert.match((await b.outbox.confirm(1)).error, /الحد الأقصى/);

  const c = outboxFixture({ responses: [{ throw: true }] });
  c.outbox.draft(1, '01012345678', 'x');
  const r = await c.outbox.confirm(1);
  assert.equal(r.ok, false);
  assert.equal(r.uncertain, true);
  assert.equal(c.logs[0].status, 'uncertain');
});

test('outbox: drafts are per actor and cancel works', () => {
  const { outbox } = outboxFixture();
  outbox.draft('a', '01012345678', 'x');
  assert.equal(outbox.hasPending('b'), false);
  assert.equal(outbox.cancel('a'), true);
  assert.equal(outbox.hasPending('a'), false);
});

function handlerFixture() {
  const got = [];
  const windows = createWindowTracker();
  const h = createWebhookHandler({
    appSecret: 'sec', verifyToken: 'vt', windows,
    allowedSenders: new Set(['201012345678']), onMessage: async m => { got.push(m); },
  });
  return { h, got, windows };
}
const rawOf = (messages, from = '201012345678') =>
  Buffer.from(JSON.stringify(payload(messages.map(m => ({ from, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', ...m })))));

test('webhook GET: challenge only with the right token', () => {
  const { h } = handlerFixture();
  assert.deepEqual(h.verifyChallenge({ 'hub.mode': 'subscribe', 'hub.verify_token': 'vt', 'hub.challenge': '123' }), { status: 200, body: '123' });
  assert.equal(h.verifyChallenge({ 'hub.mode': 'subscribe', 'hub.verify_token': 'bad', 'hub.challenge': '1' }).status, 403);
  assert.equal(h.verifyChallenge({}).status, 403);
});

test('webhook POST: bad signature 401, oversize 413, bad json 400, nothing processed', async () => {
  const { h, got } = handlerFixture();
  const raw = rawOf([{ id: 'm1', text: { body: 'hi' } }]);
  assert.equal((await h.receive(raw, 'sha256=' + '0'.repeat(64))).status, 401);
  assert.equal((await h.receive(Buffer.alloc(300 * 1024), 'x')).status, 413);
  const junk = Buffer.from('not json');
  assert.equal((await h.receive(junk, sign(junk, 'sec'))).status, 400);
  assert.equal(got.length, 0);
});

test('webhook POST: allowed sender delivered once (dedupe), unknown sender ignored, window opened', async () => {
  const { h, got, windows } = handlerFixture();
  const raw = rawOf([{ id: 'm1', text: { body: 'اليومية' } }]);
  assert.equal((await h.receive(raw, sign(raw, 'sec'))).status, 200);
  assert.equal((await h.receive(raw, sign(raw, 'sec'))).status, 200); // Meta retry
  assert.equal(got.length, 1);
  assert.equal(windows.isOpen('201012345678'), true);
  const stranger = rawOf([{ id: 'm2', text: { body: 'x' } }], '201099999999');
  await h.receive(stranger, sign(stranger, 'sec'));
  assert.equal(got.length, 1);
  assert.equal(windows.isOpen('201099999999'), false);
});

test('webhook POST: handler crash still returns 200 (no retry storm)', async () => {
  const h = createWebhookHandler({ appSecret: 's', verifyToken: 'v', allowedSenders: new Set(['201012345678']), onMessage: async () => { throw new Error('boom'); } });
  const raw = rawOf([{ id: 'm9', text: { body: 'x' } }]);
  assert.equal((await h.receive(raw, sign(raw, 's'))).status, 200);
});
