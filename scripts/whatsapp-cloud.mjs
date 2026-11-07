/**
 * whatsapp-cloud.mjs — WhatsApp Cloud API (Meta) layer for the Phi Tech Copilot.
 *
 * Pure module: no env reads, no file reads of secrets, no side effects at import time.
 * - normalizeWhatsAppNumber / parseNumberList : E.164 digits (Egypt default)
 * - verifyWebhookSignature                    : X-Hub-Signature-256 (HMAC-SHA256, raw body, timing-safe)
 * - parseWebhookPayload                       : incoming messages only (statuses ignored)
 * - createWindowTracker                       : 24h customer-service window per number
 * - createWhatsAppClient                      : sendText / sendDocument / sendTemplate
 * - createWhatsAppOutbox                      : draft -> /confirm -> send, recipients allow-list, rate limit
 * - createWebhookHandler                      : GET verify + POST receive (dedupe, allow-list, size cap)
 */
import crypto from 'node:crypto';

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** "01012345678" | "+20 101 234 5678" | "0020101..." -> "201012345678" or null. */
export function normalizeWhatsAppNumber(input, defaultCountry = '20') {
  let digits = String(input ?? '').replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = defaultCountry + digits.slice(1);
  return /^[1-9]\d{9,14}$/.test(digits) ? digits : null;
}

export function parseNumberList(value, defaultCountry = '20') {
  return new Set(String(value ?? '').split(/[,;\s]+/).map(v => normalizeWhatsAppNumber(v, defaultCountry)).filter(Boolean));
}

export function maskNumber(number) {
  const n = String(number ?? '');
  return n.length > 4 ? `***${n.slice(-4)}` : '***';
}

export function verifyWebhookSignature(rawBody, header, appSecret) {
  if (!appSecret || typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const given = header.slice(7);
  if (!/^[0-9a-f]{64}$/i.test(given)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(given.toLowerCase(), 'hex'));
}

/** Incoming user messages from a webhook body. Delivery/read statuses are ignored. */
export function parseWebhookPayload(body) {
  const out = [];
  if (body?.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) return out;
  for (const entry of body.entry) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const names = new Map((value?.contacts ?? []).map(c => [c?.wa_id, c?.profile?.name]));
      for (const m of value?.messages ?? []) {
        if (!m?.id || !m?.from) continue;
        const type = String(m.type ?? 'unknown');
        out.push({
          id: String(m.id),
          from: String(m.from),
          name: names.get(m.from) ? String(names.get(m.from)).slice(0, 60) : '',
          timestamp: Number(m.timestamp) > 0 ? Number(m.timestamp) * 1000 : Date.now(),
          type,
          text: type === 'text' ? String(m.text?.body ?? '') : type === 'button' ? String(m.button?.text ?? '') : '',
          mediaId: m[type]?.id ? String(m[type].id) : '',
          caption: String(m[type]?.caption ?? ''),
        });
      }
    }
  }
  return out;
}

export function createWindowTracker({ now = () => Date.now(), ttlMs = WINDOW_MS } = {}) {
  const lastInbound = new Map();
  return {
    touch(number, at = now()) { lastInbound.set(number, Math.max(at, lastInbound.get(number) ?? 0)); },
    isOpen(number) { const t = lastInbound.get(number); return t !== undefined && now() - t < ttlMs; },
    snapshot() { return Object.fromEntries(lastInbound); },
    restore(obj) { for (const [k, v] of Object.entries(obj ?? {})) if (Number.isFinite(v)) lastInbound.set(k, v); },
  };
}

export class WhatsAppSendError extends Error {
  constructor(message, { status = 0, code = '', retryable = false } = {}) {
    super(message);
    this.name = 'WhatsAppSendError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export function createWhatsAppClient({
  accessToken, phoneNumberId, graphVersion = 'v23.0', fetchImpl = fetch, timeoutMs = 15000,
}) {
  if (!accessToken || !phoneNumberId) throw new Error('WhatsApp client needs accessToken and phoneNumberId');
  const base = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}`;

  async function call(path, init) {
    let res;
    try {
      res = await fetchImpl(`${base}/${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      // Network failure / timeout: delivery state unknown, so the caller must not blindly retry.
      throw new WhatsAppSendError('تعذّر الاتصال بواتساب. حالة الرسالة غير مؤكدة.', { retryable: false, code: 'network' });
    }
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON body */ }
    if (!res.ok) {
      const code = String(data?.error?.code ?? '');
      // 131047 = outside the 24h window (needs a template). Never echo Meta's raw message (may hold data).
      const message = code === '131047' ? 'برا نافذة الـ24 ساعة. محتاج قالب معتمد.'
        : code === '190' ? 'توكن واتساب منتهي أو غير صحيح.'
        : code === '131030' ? 'الرقم مش ضمن الأرقام المسموحة للحساب التجريبي.'
        : `واتساب رفض الرسالة (HTTP ${res.status}${code ? `, ${code}` : ''}).`;
      throw new WhatsAppSendError(message, { status: res.status, code, retryable: res.status >= 500 || res.status === 429 });
    }
    return data;
  }

  const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const messageId = data => data?.messages?.[0]?.id ?? null;

  return {
    async sendText(to, text) {
      const data = await call('messages', json({ messaging_product: 'whatsapp', to, type: 'text', text: { body: String(text).slice(0, 4000), preview_url: false } }));
      return { id: messageId(data) };
    },
    async sendTemplate(to, name, language, bodyParams = []) {
      const components = bodyParams.length
        ? [{ type: 'body', parameters: bodyParams.map(t => ({ type: 'text', text: String(t).slice(0, 1000) })) }] : [];
      const data = await call('messages', json({ messaging_product: 'whatsapp', to, type: 'template', template: { name, language: { code: language }, components } }));
      return { id: messageId(data) };
    },
    async sendDocument(to, buffer, filename, caption = '', mime = 'application/pdf') {
      const form = new FormData();
      form.append('messaging_product', 'whatsapp');
      form.append('type', mime);
      form.append('file', new Blob([buffer], { type: mime }), filename);
      const up = await call('media', { method: 'POST', body: form });
      if (!up?.id) throw new WhatsAppSendError('رفع الملف لواتساب فشل.', { code: 'upload' });
      const data = await call('messages', json({
        messaging_product: 'whatsapp', to, type: 'document',
        document: { id: up.id, filename, ...(caption && { caption: String(caption).slice(0, 1000) }) },
      }));
      return { id: messageId(data) };
    },
  };
}

/**
 * Outbound flow: draft (nothing sent) -> /confirm sends. Recipients must be in the allow-list,
 * text is plain (no links auto-previewed), one pending draft per actor, hourly rate limit.
 * `log(entry)` receives masked metadata only (never the message text).
 */
export function createWhatsAppOutbox({
  client, windows, allowedRecipients, template = null, now = () => Date.now(), ttlMs = 10 * 60 * 1000,
  maxChars = 1000, maxPerHour = 30, log = () => {}, randomId = () => crypto.randomBytes(4).toString('hex'),
}) {
  const pending = new Map(); // actorKey -> draft
  const sentTimes = [];
  const key = actor => String(actor);

  function draft(actor, rawTo, text, { document = null } = {}) {
    const to = normalizeWhatsAppNumber(rawTo);
    const body = String(text ?? '').trim();
    if (!to) return { ok: false, error: 'رقم واتساب غير صحيح.' };
    if (!allowedRecipients.has(to)) return { ok: false, error: 'الرقم ده مش ضمن أرقام الإرسال المسموحة (WHATSAPP_ALLOWED_RECIPIENTS).' };
    if (!body && !document) return { ok: false, error: 'اكتب نص الرسالة.' };
    if (body.length > maxChars) return { ok: false, error: `الرسالة أطول من ${maxChars} حرف.` };
    const d = { id: randomId(), to, text: body, document, createdAt: now() };
    pending.set(key(actor), d);
    const inWindow = windows.isOpen(to);
    const route = inWindow ? 'رسالة عادية (النافذة مفتوحة)' : template ? 'قالب معتمد (برا النافذة، بتتحاسب)' : null;
    if (!route && !document) return { ok: false, error: 'برا نافذة الـ24 ساعة ومفيش قالب معتمد متظبط. اطلب من الرقم يبعتلك الأول.' };
    if (!inWindow && document) return { ok: false, error: 'الملفات بتتبعت جوه نافذة الـ24 ساعة بس. اطلب من الرقم يبعتلك الأول.' };
    return { ok: true, id: d.id, to: maskNumber(to), route, preview: body.slice(0, 300), document: document?.filename ?? null };
  }

  async function confirm(actor) {
    const d = pending.get(key(actor));
    if (!d) return { ok: false, error: 'مفيش رسالة واتساب معلقة.' };
    pending.delete(key(actor)); // single use: a second /confirm can never double-send
    if (now() - d.createdAt > ttlMs) return { ok: false, error: 'المسودة انتهت. اعملها من جديد.' };
    const t = now();
    while (sentTimes.length && t - sentTimes[0] > 3600_000) sentTimes.shift();
    if (sentTimes.length >= maxPerHour) return { ok: false, error: 'وصلت الحد الأقصى للإرسال في الساعة.' };
    const entry = { id: d.id, to: maskNumber(d.to), chars: d.text.length, document: Boolean(d.document), at: new Date(t).toISOString() };
    try {
      let r;
      if (d.document) r = await client.sendDocument(d.to, d.document.buffer, d.document.filename, d.text);
      else if (windows.isOpen(d.to)) r = await client.sendText(d.to, d.text);
      else r = await client.sendTemplate(d.to, template.name, template.language, template.buildParams(d.text));
      sentTimes.push(t);
      log({ ...entry, status: 'sent', waId: r.id });
      return { ok: true, id: d.id, to: maskNumber(d.to) };
    } catch (e) {
      const unknown = e instanceof WhatsAppSendError && e.code === 'network';
      log({ ...entry, status: unknown ? 'uncertain' : 'failed', code: e?.code ?? '' });
      return { ok: false, uncertain: unknown, error: unknown ? `${e.message} اتأكد من واتساب قبل ما تعيد الإرسال.` : (e?.message ?? 'فشل الإرسال.') };
    }
  }

  function cancel(actor) { return pending.delete(key(actor)); }
  return { draft, confirm, cancel, hasPending: actor => pending.has(key(actor)) };
}

/**
 * Webhook handler (framework-free). `onMessage(msg)` is called once per new message from an allowed
 * sender. Rejects bad signatures, oversized bodies and unknown senders; dedupes by message id.
 */
export function createWebhookHandler({
  appSecret, verifyToken, allowedSenders, windows, onMessage, maxBodyBytes = 256 * 1024, dedupeLimit = 2000,
}) {
  const seen = new Set();
  function remember(id) {
    seen.add(id);
    if (seen.size > dedupeLimit) seen.delete(seen.values().next().value);
  }

  function verifyChallenge(query) {
    if (query['hub.mode'] === 'subscribe' && verifyToken && query['hub.verify_token'] === verifyToken && query['hub.challenge']) {
      return { status: 200, body: String(query['hub.challenge']) };
    }
    return { status: 403, body: 'forbidden' };
  }

  async function receive(rawBody, signatureHeader) {
    if (rawBody.length > maxBodyBytes) return { status: 413, body: 'too large' };
    if (!verifyWebhookSignature(rawBody, signatureHeader, appSecret)) return { status: 401, body: 'bad signature' };
    let body;
    try { body = JSON.parse(rawBody.toString('utf8')); } catch { return { status: 400, body: 'bad json' }; }
    for (const msg of parseWebhookPayload(body)) {
      if (seen.has(msg.id)) continue;
      remember(msg.id);
      if (!allowedSenders.has(msg.from)) continue; // unknown sender: ignored silently, never processed
      windows?.touch(msg.from, msg.timestamp);
      try { await onMessage(msg); } catch { /* a handler failure must not make Meta retry forever */ }
    }
    return { status: 200, body: 'ok' };
  }

  return { verifyChallenge, receive };
}
