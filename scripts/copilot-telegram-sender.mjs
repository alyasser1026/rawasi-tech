const MESSAGE_LIMIT = 3900;
const htmlCharacters = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

function plainFromBotHtml(value) {
  return value
    .replace(/<\/?(?:b|i|code|pre)>/gi, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (_, name) => htmlCharacters[name]);
}

function splitPlainMessage(text) {
  const parts = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + MESSAGE_LIMIT, text.length);
    if (end < text.length) {
      const newline = text.lastIndexOf('\n', end - 1);
      const space = text.lastIndexOf(' ', end - 1);
      const split = Math.max(newline, space);
      if (split > start + MESSAGE_LIMIT / 2) end = split + 1;
      else if (/[\uD800-\uDBFF]/.test(text.charAt(end - 1))) end--;
    }
    const part = text.slice(start, end).trim();
    if (part) parts.push(part);
    start = end;
  }
  return parts;
}

export function createTelegramMessageSender({ botToken, fetchImpl = fetch, onFailure = () => {} }) {
  async function sendPart(chatId, text, replyToMessageId, html, replyMarkup) {
    const payload = {
      chat_id: chatId,
      text,
      link_preview_options: { is_disabled: true },
      ...(html && { parse_mode: 'HTML' }),
      ...(replyMarkup && { reply_markup: replyMarkup }),
      ...(Number.isSafeInteger(replyToMessageId) && replyToMessageId > 0 && {
        reply_parameters: { message_id: replyToMessageId, allow_sending_without_reply: true },
      }),
    };
    try {
      const response = await fetchImpl('https://api.telegram.org/bot' + botToken + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok === true && Number.isSafeInteger(data.result?.message_id)) {
        return { ok: true, messageId: data.result.message_id };
      }
      return {
        ok: false,
        status: response.status,
        errorCode: Number.isSafeInteger(data?.error_code) ? data.error_code : undefined,
        rejectedHtml: html && data?.ok === false && data.error_code === 400 &&
          typeof data.description === 'string' && /parse entities|message is too long/i.test(data.description),
      };
    } catch {
      return { ok: false };
    }
  }

  return async function sendTelegramMessage(chatId, value, replyToMessageId = null, { html = true, replyMarkup } = {}) {
    const text = typeof value === 'string' ? value.trim() : '';
    const messageIds = [];
    if (!text) return { ok: false, messageIds };
    const useHtml = html && text.length <= MESSAGE_LIMIT;
    const parts = useHtml ? [text] : splitPlainMessage(html ? plainFromBotHtml(text) : text);
    for (const [index, part] of parts.entries()) {
      // Replies attach to the original request. The remaining parts continue in the same chat.
      const target = messageIds.length ? null : replyToMessageId;
      const markup = index === parts.length - 1 ? replyMarkup : undefined;
      let response = await sendPart(chatId, part, target, useHtml, markup);
      if (response.rejectedHtml) {
        // Telegram explicitly rejected the send, so retrying as plain text cannot duplicate it.
        const plain = plainFromBotHtml(part).trim();
        if (plain) response = await sendPart(chatId, plain, target, false, markup);
      }
      if (!response.ok) {
        onFailure({ status: response.status, errorCode: response.errorCode, sentParts: messageIds.length });
        return { ok: false, messageIds };
      }
      messageIds.push(response.messageId);
    }
    return { ok: messageIds.length > 0, messageIds };
  };
}

const DEFINITE_NETWORK_FAILURES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED']);

export function createTelegramVoiceSender({ botToken, fetchImpl = fetch }) {
  return async function sendTelegramVoice(chatId, audio, replyToMessageId) {
    if (!audio?.buffer?.length) return false;
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('voice', new Blob([audio.buffer], { type: audio.mimeType }), audio.fileName);
    if (Number.isSafeInteger(replyToMessageId) && replyToMessageId > 0) {
      form.append('reply_parameters', JSON.stringify({
        message_id: replyToMessageId, allow_sending_without_reply: true,
      }));
    }

    try {
      const response = await fetchImpl('https://api.telegram.org/bot' + botToken + '/sendVoice', {
        method: 'POST', body: form, redirect: 'error', signal: AbortSignal.timeout(22000),
      });
      return response.ok && (await response.json())?.ok === true;
    } catch {
      return false;
    }
  };
}

/**
 * Sends a PDF as a Telegram document and classifies the outcome (roadmap phase 4):
 *   { status: 'sent' }                 — explicit ok:true
 *   { status: 'failed', retryAfter? }  — explicit rejection (4xx ok:false, long 429) or a connection that never opened
 *   { status: 'uncertain' }            — Telegram may have received it (timeout, reset, 5xx, unreadable answer):
 *                                        the caller must stop and ask for a manual check, never auto-resend.
 * A short 429 (retry_after ≤ maxRetryAfterS) is honoured once.
 */
export function createTelegramDocumentSender({
  botToken, fetchImpl = fetch, timeoutMs = 30000, maxRetryAfterS = 10,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  return async function sendTelegramDocument(chatId, buffer, filename, caption, replyToMessageId) {
    for (let attempt = 0; ; attempt++) {
      const form = new FormData();
      form.append('chat_id', String(chatId));
      form.append('document', new Blob([buffer], { type: 'application/pdf' }), filename);
      if (caption) form.append('caption', caption);
      if (Number.isSafeInteger(replyToMessageId) && replyToMessageId > 0) form.append('reply_to_message_id', String(replyToMessageId));
      let response;
      try {
        response = await fetchImpl('https://api.telegram.org/bot' + botToken + '/sendDocument', {
          method: 'POST', body: form, redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        return { status: DEFINITE_NETWORK_FAILURES.has(error?.cause?.code ?? error?.code) ? 'failed' : 'uncertain' };
      }
      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok === true) return { status: 'sent' };
      if (response.status === 429 || data?.error_code === 429) {
        const retryAfter = Number(data?.parameters?.retry_after);
        if (attempt === 0 && Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= maxRetryAfterS) {
          await sleep(retryAfter * 1000); // Telegram explicitly refused, so a retry can't duplicate the file
          continue;
        }
        return { status: 'failed', retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined };
      }
      if (data?.ok === false && response.status >= 400 && response.status < 500) return { status: 'failed' };
      return { status: 'uncertain' };
    }
  };
}
