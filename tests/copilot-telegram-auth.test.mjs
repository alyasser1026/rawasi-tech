import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeTelegramMessages, getSharedTelegramCommand, isAuthorizedTelegramUpdate, normalizeTelegramChatId, normalizeTelegramSharedChatId } from '../scripts/copilot-telegram-auth.mjs';

const allowedId = 3123456789012;
const privateChat = { type: 'private', id: allowedId };
const human = { id: allowedId, is_bot: false };
const message = { chat: privateChat, from: human, text: 'مساعدة' };
const authorized = (update) => isAuthorizedTelegramUpdate(update, String(allowedId));

test('accepts messages from the configured private human account regardless of message contents', () => {
  assert.equal(authorized({ message }), true);
  assert.equal(authorized({ message: { ...message, text: '/train example' } }), true);
  assert.equal(authorized({ message: { chat: privateChat, from: human, voice: { file_id: 'synthetic' } } }), true);
  assert.equal(isAuthorizedTelegramUpdate({ message }, ` ${allowedId} `), true);
});

test('rejects a different chat or sender, missing sender, bots and string IDs in the update', () => {
  for (const changed of [
    { chat: { ...privateChat, id: allowedId + 1 } },
    { chat: { ...privateChat, id: String(allowedId) } },
    { from: { ...human, id: allowedId + 1 } },
    { from: { ...human, id: String(allowedId) } },
    { from: { ...human, is_bot: true } },
    { from: { id: allowedId } },
    { from: null },
  ]) {
    assert.equal(authorized({ message: { ...message, ...changed } }), false);
  }
});

test('rejects non-private, edited, channel and unsupported updates', () => {
  for (const type of ['group', 'supergroup', 'channel']) {
    assert.equal(authorized({ message: { ...message, chat: { ...privateChat, type } } }), false);
  }
  assert.equal(authorized({ edited_message: message }), false);
  assert.equal(authorized({ channel_post: message }), false);
  assert.equal(authorized({ edited_channel_post: message }), false);
  assert.equal(authorized({ message, edited_message: message }), false);
  assert.equal(authorized({ callback_query: { message, from: human } }), false);
  assert.equal(authorized(null), false);
});

test('fails closed for missing, group, malformed or unsafe configuration', () => {
  for (const config of [undefined, null, '', ' ', -123, '-10099999', '0', '+123', '0012', '1e3', '12.5', '12 34', '9007199254740992', Infinity, {}]) {
    assert.equal(normalizeTelegramChatId(config), null);
    assert.equal(isAuthorizedTelegramUpdate({ message }, config), false);
  }
  assert.equal(normalizeTelegramChatId(allowedId), allowedId);
});

test('blocks unauthorized voice and training before the message handler runs', async () => {
  const messages = [];
  const handle = authorizeTelegramMessages(allowedId, async allowed => { messages.push(allowed); });
  await handle({ message: { ...message, from: { id: allowedId + 1, is_bot: false }, voice: { file_id: 'fake' } } });
  await handle({ message: { ...message, chat: { type: 'group', id: allowedId }, text: '/train injected rule' } });
  await handle({ edited_message: { ...message, text: '/train edited rule' } });
  assert.deepEqual(messages, []);
  await handle({ message });
  assert.deepEqual(messages, [message]);
});

test('only accepts commands for this bot in the configured shared chat', () => {
  const sharedId = -10012345;
  const chat = { id: sharedId, type: 'supergroup' };
  const update = { message: { chat, from: human, message_id: 7, text: '/ask@Phi_Test_Bot اشرح الشاشة' } };
  assert.equal(normalizeTelegramSharedChatId('  -10012345 '), sharedId);
  assert.equal(normalizeTelegramSharedChatId('-9007199254740992'), null);
  assert.equal(normalizeTelegramSharedChatId(123), null);
  assert.deepEqual(getSharedTelegramCommand(update, sharedId, 'phi_test_bot'), {
    chatId: sharedId, messageId: 7, command: 'ask', text: 'اشرح الشاشة',
  });
  assert.equal(getSharedTelegramCommand(update, sharedId, 'other_bot'), null);
  assert.equal(getSharedTelegramCommand(update, sharedId), null);
  assert.equal(getSharedTelegramCommand(update, sharedId - 1, 'phi_test_bot'), null);
  assert.equal(getSharedTelegramCommand({ message: { ...update.message, text: 'رسالة عادية' } }, sharedId), null);
  assert.equal(getSharedTelegramCommand({ message: { ...update.message, from: { ...human, is_bot: true } } }, sharedId, 'phi_test_bot'), null);
  assert.equal(getSharedTelegramCommand({ edited_message: update.message }, sharedId, 'phi_test_bot'), null);
});

test('requires the configured channel and a command on a channel post', () => {
  const chatId = -10012345;
  const post = { chat: { id: chatId, type: 'channel' }, message_id: 5, text: '/help' };
  assert.deepEqual(getSharedTelegramCommand({ channel_post: post }, chatId), {
    chatId, messageId: 5, command: 'help', text: '',
  });
  assert.equal(getSharedTelegramCommand({ message: post }, chatId), null);
  assert.equal(getSharedTelegramCommand({ channel_post: post }, chatId - 1), null);
  assert.equal(getSharedTelegramCommand({ channel_post: { ...post, text: 'تنبيه فاي تك' } }, chatId), null);
});
