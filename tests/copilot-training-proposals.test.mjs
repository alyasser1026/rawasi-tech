import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createCopilotTrainingProposals } from '../scripts/copilot-training-proposals.mjs';

const owner = 12345678901;
const otherOwner = 12345678902;
const companyId = '6cdb7f36-2663-4966-afc3-f5b10c57919c';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'phi-training-'));
  const filePath = join(directory, 'pending.json');
  t.after(() => {
    if (existsSync(filePath)) unlinkSync(filePath);
    rmdirSync(directory);
  });
  return { filePath, directory, queue: createCopilotTrainingProposals(filePath) };
}

test('persists only pending suggestions with an owner, origin, timestamp and optional company', (t) => {
  const { filePath, directory, queue } = fixture(t);
  assert.deepEqual(queue.list(owner), []);
  assert.equal(existsSync(filePath), false);

  const general = queue.submit({ text: '  مثال إرشادي للشاشات  ', telegramUserId: owner });
  const scoped = queue.submit({ text: 'سيناريو لشركة معيّنة', telegramUserId: String(owner), companyId });
  const foreign = queue.submit({ text: 'مقترح مستخدم تاني', telegramUserId: otherOwner });
  assert.equal(general.text, 'مثال إرشادي للشاشات');
  assert.equal(general.telegramUserId, String(owner));
  assert.equal(general.companyId, null);
  assert.equal(scoped.companyId, companyId);
  assert.equal(general.source, 'telegram');
  assert.equal(general.status, 'pending');
  assert.ok(Number.isFinite(Date.parse(general.createdAt)));
  assert.notEqual(general.id, scoped.id);

  const reopened = createCopilotTrainingProposals(filePath);
  assert.deepEqual(reopened.list(owner), [scoped, general]);
  assert.deepEqual(reopened.list(otherOwner), [foreign]);
  assert.deepEqual(readdirSync(directory), ['pending.json']);
  if (process.platform !== 'win32') assert.equal(statSync(filePath).mode & 0o077, 0);
});

test('withdraws only the owning sender’s exact proposal', (t) => {
  const { queue, filePath } = fixture(t);
  const proposal = queue.submit({ text: 'سيناريو للاسترجاع', telegramUserId: owner });
  assert.equal(queue.withdraw(proposal.id, otherOwner), false);
  assert.equal(queue.withdraw('invalid', owner), false);
  assert.deepEqual(queue.list(owner), [proposal]);
  assert.equal(queue.withdraw(proposal.id, owner), true);
  assert.equal(queue.withdraw(proposal.id, owner), false);
  assert.deepEqual(JSON.parse(readFileSync(filePath, 'utf8')).proposals, []);
});

test('rejects missing identity, invalid company, malformed text and likely credentials without echoing text', (t) => {
  const { filePath, queue } = fixture(t);
  assert.throws(() => queue.list(null), { code: 'COPILOT_PROPOSAL_INVALID_USER' });
  assert.throws(() => queue.submit(null), { code: 'COPILOT_PROPOSAL_INVALID_TEXT' });
  assert.throws(() => queue.submit({ text: 'مثال', telegramUserId: owner, companyId: 'unknown' }), { code: 'COPILOT_PROPOSAL_INVALID_COMPANY' });
  for (const text of ['', '  ', 'x'.repeat(2001), '\u0000invalid']) {
    assert.throws(() => queue.submit({ text, telegramUserId: owner }), { code: 'COPILOT_PROPOSAL_INVALID_TEXT' });
  }
  for (const text of [
    'GEMINI_API_KEY=' + 'made-up-example',
    'كلمة المرور هي ' + 'demo-value',
    'sk-' + 'x'.repeat(30),
    '123456789:' + 'x'.repeat(30),
    'Bearer ' + 'x'.repeat(30),
  ]) {
    assert.throws(() => queue.submit({ text, telegramUserId: owner }), (error) => {
      assert.equal(error.code, 'COPILOT_PROPOSAL_SENSITIVE_TEXT');
      assert.ok(!error.message.includes(text));
      return true;
    });
  }
  assert.equal(existsSync(filePath), false);
});

test('limits the queue without deleting prior suggestions', (t) => {
  const { queue } = fixture(t);
  for (let index = 1; index <= 100; index++) {
    queue.submit({ text: 'مثال اصطناعي رقم ' + index, telegramUserId: owner });
  }
  assert.throws(() => queue.submit({ text: 'طلب زائد', telegramUserId: owner }), { code: 'COPILOT_PROPOSAL_QUEUE_FULL' });
  assert.equal(queue.list(owner).length, 100);
});

test('fails closed without replacing corrupted storage', (t) => {
  const { queue, filePath } = fixture(t);
  writeFileSync(filePath, 'corrupted synthetic fixture', 'utf8');
  assert.throws(() => queue.list(owner), { code: 'COPILOT_PROPOSAL_STORAGE' });
  assert.throws(() => queue.submit({ text: 'طلب جديد', telegramUserId: owner }), { code: 'COPILOT_PROPOSAL_STORAGE' });
  assert.equal(readFileSync(filePath, 'utf8'), 'corrupted synthetic fixture');
});
