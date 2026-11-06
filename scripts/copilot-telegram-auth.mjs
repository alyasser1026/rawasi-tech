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
