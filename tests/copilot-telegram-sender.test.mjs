import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramMessageSender } from '../scripts/copilot-telegram-sender.mjs';

function fakeSender(respond = (_, index) => Response.json({ ok: true, result: { message_id: index + 1 } })) {
  const requests = [];
  const failures = [];
  const send = createTelegramMessageSender({
    botToken: 'synthetic-test-token',
    fetchImpl: async (_, init) => {
      requests.push(JSON.parse(init.body));
      return respond(requests.at(-1), requests.length - 1);
    },
    onFailure: failure => failures.push(failure),
  });
  return { requests, failures, send };
}

test('keeps Telegram reply threading and allows delivery if the referenced message disappeared', async () => {
  const { requests, send } = fakeSender();
  assert.deepEqual(await send(1, 'رد عادي', 55, { html: false }), { ok: true, messageIds: [1] });
  assert.deepEqual(requests[0].reply_parameters, { message_id: 55, allow_sending_without_reply: true });
  assert.equal(requests[0].parse_mode, undefined);
});

test('splits long model answers as plain text without dropping content or breaking emoji', async () => {
  const { requests, send } = fakeSender();
  const text = 'أ'.repeat(3899) + '😀' + 'ب'.repeat(4000);
  assert.deepEqual(await send(1, text, 55, { html: false }), { ok: true, messageIds: [1, 2, 3] });
  assert.equal(requests.map(request => request.text).join(''), text);
  assert.ok(requests.every(request => request.text.length <= 3900 && !request.parse_mode));
  assert.ok(requests.every(request => !/[\uD800-\uDBFF]$|^[\uDC00-\uDFFF]/.test(request.text)));
  assert.equal(requests[1].reply_parameters, undefined);
});

test('retries a Telegram entity rejection as plain text after a definite failure', async () => {
  const { requests, send } = fakeSender((_, index) => index === 0
    ? Response.json({ ok: false, error_code: 400, description: "Bad Request: can't parse entities" }, { status: 400 })
    : Response.json({ ok: true, result: { message_id: 77 } }));
  assert.deepEqual(await send(1, '<b>طلب &lt;مراجعة&gt;</b>'), { ok: true, messageIds: [77] });
  assert.equal(requests[0].parse_mode, 'HTML');
  assert.equal(requests[1].parse_mode, undefined);
  assert.equal(requests[1].text, 'طلب <مراجعة>');
});

test('reports a rejection even on HTTP 200 and never retries a timed-out send', async () => {
  const rejected = fakeSender(() => Response.json({ ok: false, error_code: 403, description: 'Sensitive failure details' }));
  assert.deepEqual(await rejected.send(1, 'رد'), { ok: false, messageIds: [] });
  assert.deepEqual(rejected.failures, [{ status: 200, errorCode: 403, sentParts: 0 }]);
  const timedOut = fakeSender(() => { throw new Error('timeout'); });
  assert.equal((await timedOut.send(1, 'رد')).ok, false);
  assert.equal(timedOut.requests.length, 1);
});
