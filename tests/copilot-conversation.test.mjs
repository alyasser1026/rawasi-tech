import assert from 'node:assert/strict';
import test from 'node:test';
import { createCopilotConversation } from '../scripts/copilot-conversation.mjs';

const actor = { chatId: 1001, userId: 1001, scope: 'user:company-a:labor-view' };
const texts = context => context.contents.map(({ role, parts }) => [role, parts[0].text]);
const ask = (conversation, userMessageId, options = {}) => conversation.remember({
  ...actor,
  userMessageId,
  botMessageIds: [userMessageId + 1],
  userText: 'سؤال ' + userMessageId,
  modelText: 'رد ' + userMessageId,
  ...options,
});

test('remembers recent alternating Gemini turns for a natural follow-up', () => {
  const conversation = createCopilotConversation();
  assert.equal(ask(conversation, 10), true);
  assert.equal(ask(conversation, 12, { parentMessageId: 10, userText: 'طب امبارح؟' }), true);
  const context = conversation.getContext(actor);
  assert.deepEqual(texts(context), [
    ['user', 'سؤال 10'], ['model', 'رد 10'],
    ['user', 'طب امبارح؟'], ['model', 'رد 12'],
  ]);
  assert.equal(context.parentMessageId, 12);
  assert.equal(context.referenceMissing, false);
});

test('branches from an older known bot or user message without later unrelated turns', () => {
  const conversation = createCopilotConversation();
  ask(conversation, 10, { botMessageIds: [11, 12] });
  ask(conversation, 13, { parentMessageId: 10 });
  ask(conversation, 15, { parentMessageId: 13 });
  const fromSecondChunk = conversation.getContext({ ...actor, replyToMessageId: 12 });
  assert.deepEqual(texts(fromSecondChunk), [['user', 'سؤال 10'], ['model', 'رد 10']]);
  assert.deepEqual(conversation.getContext({ ...actor, replyToMessageId: 10 }), fromSecondChunk);
  ask(conversation, 17, { parentMessageId: fromSecondChunk.parentMessageId });
  assert.deepEqual(texts(conversation.getContext(actor)), [
    ['user', 'سؤال 10'], ['model', 'رد 10'], ['user', 'سؤال 17'], ['model', 'رد 17'],
  ]);
});

test('an unrecognized or expired explicit reply cannot use unrelated history or a quote', () => {
  let time = 0;
  const conversation = createCopilotConversation({ ttlMs: 100, now: () => time });
  ask(conversation, 10);
  const missing = { contents: [], parentMessageId: null, referenceMissing: true };
  assert.deepEqual(conversation.getContext({ ...actor, replyToMessageId: 9, quotedText: 'خارجي' }), missing);
  time = 90;
  ask(conversation, 12, { parentMessageId: 10 });
  time = 100;
  assert.deepEqual(conversation.getContext({ ...actor, replyToMessageId: 11 }), missing);
  assert.deepEqual(texts(conversation.getContext(actor)), [['user', 'سؤال 12'], ['model', 'رد 12']]);
  time = 190;
  assert.deepEqual(texts(conversation.getContext(actor)), []);
});

test('scope changes erase the previous scope and unrelated actors have no access', () => {
  const conversation = createCopilotConversation();
  ask(conversation, 10);
  assert.deepEqual(texts(conversation.getContext({ ...actor, chatId: 1002 })), []);
  assert.deepEqual(texts(conversation.getContext({ ...actor, userId: 1002 })), []);
  assert.equal(conversation.getContext({ ...actor, scope: 'user:company-b:labor-view', replyToMessageId: 11 }).referenceMissing, true);
  assert.deepEqual(texts(conversation.getContext(actor)), []);
  ask(conversation, 20);
  assert.deepEqual(texts(conversation.getContext({ ...actor, scope: 'general' })), []);
  assert.deepEqual(texts(conversation.getContext(actor)), []);
});

test('tool turns remember intent but never retain rendered results', () => {
  const conversation = createCopilotConversation();
  assert.equal(ask(conversation, 10, {
    userText: 'كام سجل يومية النهارده؟',
    toolName: 'get_labor_daily_logs',
    modelText: 'COUNT_SECRET 78189 COMPANY_SECRET',
  }), true);
  assert.equal(ask(conversation, 12, { toolName: 'unexpected_tool', modelText: 'UNKNOWN_SECRET' }), false);
  const context = conversation.getContext(actor);
  const payload = JSON.stringify(context.contents);
  assert.match(payload, /كام سجل يومية النهارده/);
  assert.match(payload, /استعلم من جديد/);
  assert.doesNotMatch(payload, /COUNT_SECRET|78189|COMPANY_SECRET|UNKNOWN_SECRET/);
});

test('bounds turns and text, ignores duplicate updates and allows reset', () => {
  const conversation = createCopilotConversation({ maxTurns: 2 });
  ask(conversation, 10);
  ask(conversation, 12, { parentMessageId: 10 });
  ask(conversation, 14, { parentMessageId: 12, userText: 'أ'.repeat(2000), modelText: 'ب'.repeat(2000) });
  assert.equal(ask(conversation, 14), false);
  const context = conversation.getContext(actor);
  assert.equal(context.contents.length, 4);
  assert.equal(context.contents[2].parts[0].text.length, 1200);
  assert.equal(context.contents[3].parts[0].text.length, 1600);
  assert.equal(conversation.getContext({ ...actor, replyToMessageId: 11 }).referenceMissing, true);
  assert.equal(conversation.clear(actor), true);
  assert.equal(conversation.clear(actor), false);
  assert.deepEqual(texts(conversation.getContext(actor)), []);
});
