export function normalizeTelegramChatId(configuredChatId) {
  if (typeof configuredChatId === 'string') {
    const decimal = configuredChatId.trim();
    if (!/^[1-9]\d*$/.test(decimal)) return null;
    configuredChatId = Number(decimal);
  }

  return Number.isSafeInteger(configuredChatId) && configuredChatId > 0
    ? configuredChatId
    : null;
}

/** Telegram must identify the same human sender and private conversation. */
export function isAuthorizedTelegramUpdate(update, configuredChatId) {
  const allowedId = normalizeTelegramChatId(configuredChatId);
  const message = update?.message;
  if (allowedId === null || !message || update.edited_message || update.channel_post || update.edited_channel_post) {
    return false;
  }

  return message.chat?.type === 'private'
    && message.chat.id === allowedId
    && message.from?.id === allowedId
    && message.from.is_bot === false;
}

export function authorizeTelegramMessages(configuredChatId, handleMessage) {
  return async update => {
    if (!isAuthorizedTelegramUpdate(update, configuredChatId)) return;
    return handleMessage(update.message);
  };
}

export function normalizeTelegramSharedChatId(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  const id = Number(raw);
  return /^-[1-9]\d*$/.test(raw) && Number.isSafeInteger(id) ? id : null;
}

/** A configured group or channel can explicitly request general guidance. */
export function getSharedTelegramCommand(update, configuredChatId, botUsername) {
  const chatId = normalizeTelegramSharedChatId(configuredChatId);
  if (chatId === null || update?.edited_message || update?.edited_channel_post) return null;
  const message = update?.message ?? update?.channel_post;
  if (message?.chat?.id !== chatId || message.from?.is_bot === true) return null;

  if (update.channel_post) {
    if (update.message || message.chat.type !== 'channel') return null;
  } else if (!['group', 'supergroup'].includes(message.chat.type) || message.from?.is_bot !== false ||
             normalizeTelegramChatId(message.from.id) !== message.from.id) {
    return null;
  }

  const match = typeof message.text === 'string'
    ? /^\/([a-z][a-z0-9_]*)(?:@([a-z0-9_]+))?(?=\s|$)\s*([\s\S]*)$/i.exec(message.text.trim())
    : null;
  if (!match || (match[2] && (typeof botUsername !== 'string' || match[2].toLowerCase() !== botUsername.toLowerCase()))) return null;
  return { chatId, messageId: message.message_id, command: match[1].toLowerCase(), text: match[3].trim() };
}
