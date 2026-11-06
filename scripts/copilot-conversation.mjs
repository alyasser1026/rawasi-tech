const MAX_CONVERSATIONS = 16;
const MAX_MESSAGE_IDS = 16;
const MAX_USER_TEXT = 1200;
const MAX_MODEL_TEXT = 1600;

const TOOL_MARKERS = new Map([
  ['get_labor_daily_logs', 'كان الطلب السابق استعلامًا عن سجلات يوميات العمالة. أعد التحقق من التاريخ والصلاحية واستعلم من جديد عند طلب أي رقم فعلي.'],
  ['get_engineering_checklist_and_specs', 'كان الطلب السابق عن إرشادات فحص هندسي. ارجع لدليل فاي تك عند الحاجة للتفاصيل.'],
  ['get_tareeha_deficits', 'كان الطلب السابق استعلامًا عن عجوزات الطريحة. أعد الاستعلام بالأداة عند طلب أي رقم أو تفاصيل فعلية.'],
]);

const isMessageId = id => Number.isSafeInteger(id) && id > 0;

function identity(chatId, userId) {
  return isMessageId(chatId) && isMessageId(userId) ? chatId + ':' + userId : null;
}

function boundedText(value, limit) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text.length > limit ? text.slice(0, limit - 1).replace(/[\uD800-\uDBFF]$/, '') + '…' : text;
}

function emptyContext(referenceMissing = false) {
  return { contents: [], parentMessageId: null, referenceMissing };
}

/** Holds recent completed turns per Telegram sender and verified access scope in memory. */
export function createCopilotConversation({ maxTurns = 6, ttlMs = 30 * 60 * 1000, now = Date.now } = {}) {
  if (!Number.isSafeInteger(maxTurns) || maxTurns < 1 || maxTurns > 24 ||
      !Number.isFinite(ttlMs) || ttlMs <= 0 || typeof now !== 'function') {
    throw new TypeError('Invalid conversation limits');
  }
  const conversations = new Map();

  function activeTurns(key, scope, time) {
    for (const [actor, conversation] of conversations) {
      conversation.turns = conversation.turns.filter(turn => turn.createdAt <= time && time - turn.createdAt < ttlMs);
      if (!conversation.turns.length) conversations.delete(actor);
    }

    const conversation = conversations.get(key);
    if (conversation && conversation.scope !== scope) {
      conversations.delete(key);
      return [];
    }
    return conversation?.turns ?? [];
  }

  function getContext({ chatId, userId, scope, replyToMessageId } = {}) {
    const explicitReply = replyToMessageId !== null && replyToMessageId !== undefined;
    const key = identity(chatId, userId);
    if (!key) return emptyContext(explicitReply);
    const turns = activeTurns(key, scope, now());
    const referenced = explicitReply
      ? turns.find(turn => turn.userMessageId === replyToMessageId || turn.botMessageIds.includes(replyToMessageId))
      : turns.at(-1);
    if (!referenced) return emptyContext(explicitReply);

    const branch = [];
    let turn = referenced;
    while (turn) {
      branch.push(turn);
      const parent = turn.parentMessageId;
      turn = turns.find(candidate => candidate.userMessageId === parent);
    }

    return {
      contents: branch.reverse().flatMap(item => [
        { role: 'user', parts: [{ text: item.userText }] },
        { role: 'model', parts: [{ text: item.modelText }] },
      ]),
      parentMessageId: referenced.userMessageId,
      referenceMissing: false,
    };
  }

  function remember({ chatId, userId, scope, userMessageId, botMessageIds, parentMessageId, userText, modelText, toolName } = {}) {
    const key = identity(chatId, userId);
    if (!key) return false;
    const time = now();
    const turns = activeTurns(key, scope, time);
    if (typeof scope !== 'string' || !scope.trim() || scope.length > 256 ||
        !Number.isFinite(time) || !isMessageId(userMessageId) ||
        turns.some(turn => turn.userMessageId === userMessageId)) return false;

    const user = boundedText(userText, MAX_USER_TEXT);
    // Never retain rendered data, IDs, counts, or other tool result text.
    const model = toolName != null ? TOOL_MARKERS.get(toolName) : boundedText(modelText, MAX_MODEL_TEXT);
    if (!user || !model) return false;

    const ids = Array.isArray(botMessageIds)
      ? [...new Set(botMessageIds.slice(0, MAX_MESSAGE_IDS).filter(isMessageId))]
      : [];
    const parent = turns.some(turn => turn.userMessageId === parentMessageId) ? parentMessageId : null;

    conversations.delete(key);
    conversations.set(key, {
      scope,
      turns: [...turns, { userMessageId, botMessageIds: ids, parentMessageId: parent, userText: user, modelText: model, createdAt: time }]
        .slice(-maxTurns),
    });
    if (conversations.size > MAX_CONVERSATIONS) conversations.delete(conversations.keys().next().value);
    return true;
  }

  function clear({ chatId, userId } = {}) {
    const key = identity(chatId, userId);
    return key !== null && conversations.delete(key);
  }

  return { getContext, remember, clear };
}
