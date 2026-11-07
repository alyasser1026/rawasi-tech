/**
 * copilot-whatsapp.mjs — WhatsApp service for the Copilot (wires whatsapp-cloud.mjs to Telegram + Express-free HTTP).
 *
 * Created by telegram-copilot.mjs:
 *   const whatsapp = createWhatsAppService({ setting, rootDir, notifyOwner });
 *   whatsapp.start();                                   // webhook server (only when enabled + configured)
 *   const reply = await whatsapp.handleCommand(userId, text); // /wa, /wa_ok, /wa_cancel  -> string | null
 *
 * Off by default: WHATSAPP_ENABLED must be exactly "true". Missing settings are reported by NAME only.
 * Inbound messages from allow-listed numbers are relayed to the owner on Telegram as UNTRUSTED text;
 * nothing inbound is ever executed or turned into a write. Outbound goes through draft -> /wa_ok.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {
  createWebhookHandler, createWhatsAppClient, createWhatsAppOutbox, createWindowTracker,
  maskNumber, parseNumberList,
} from './whatsapp-cloud.mjs';

const REQUIRED = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_ALLOWED_RECIPIENTS'];
const WEBHOOK_PATH = '/whatsapp/webhook';
const LOG_CAP = 500;

function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function createWhatsAppService({
  setting, rootDir, notifyOwner, fetchImpl = fetch, now = () => Date.now(), logger = console,
}) {
  const enabledFlag = setting('WHATSAPP_ENABLED') === 'true';
  const missing = REQUIRED.filter(name => !String(setting(name) ?? '').trim());
  const ready = enabledFlag && missing.length === 0;
  const status = () => (!enabledFlag ? 'off' : missing.length ? `missing: ${missing.join(', ')}` : 'ready');

  if (!ready) {
    return {
      ready: false,
      status,
      start() { if (enabledFlag) logger.warn(`WhatsApp disabled — missing settings: ${missing.join(', ')}`); },
      stop() {},
      async handleCommand(_actor, text) {
        return /^\/wa(_ok|_cancel)?(\s|$)/i.test(String(text ?? '').trim())
          ? 'واتساب مش مفعّل. متظبط بـ WHATSAPP_ENABLED=true وباقي الإعدادات.' : null;
      },
    };
  }

  const allowedRecipients = parseNumberList(setting('WHATSAPP_ALLOWED_RECIPIENTS'));
  const allowedSenders = new Set([...parseNumberList(setting('WHATSAPP_ALLOWED_SENDERS')), ...allowedRecipients]);
  const stateFile = path.join(rootDir, 'work', 'whatsapp-state.json');
  const logFile = path.join(rootDir, 'work', 'whatsapp-outbox.json');

  const windows = createWindowTracker({ now });
  windows.restore(readJson(stateFile, {}));
  const persistWindows = () => { try { writeJsonAtomic(stateFile, windows.snapshot()); } catch { /* best effort */ } };

  const client = createWhatsAppClient({
    accessToken: setting('WHATSAPP_ACCESS_TOKEN'),
    phoneNumberId: setting('WHATSAPP_PHONE_NUMBER_ID'),
    graphVersion: setting('WHATSAPP_GRAPH_VERSION') || undefined,
    fetchImpl,
  });

  const templateName = String(setting('WHATSAPP_TEMPLATE_NAME') ?? '').trim();
  const template = templateName
    ? { name: templateName, language: setting('WHATSAPP_TEMPLATE_LANG') || 'ar', buildParams: text => [text] }
    : null;

  const outbox = createWhatsAppOutbox({
    client, windows, allowedRecipients, template, now,
    maxPerHour: Number(setting('WHATSAPP_MAX_PER_HOUR')) > 0 ? Number(setting('WHATSAPP_MAX_PER_HOUR')) : 30,
    log: entry => {
      try {
        const rows = readJson(logFile, []);
        rows.push(entry);
        writeJsonAtomic(logFile, rows.slice(-LOG_CAP));
      } catch { /* the send already happened/failed; logging is best effort */ }
    },
  });

  const handler = createWebhookHandler({
    appSecret: setting('WHATSAPP_APP_SECRET'),
    verifyToken: setting('WHATSAPP_VERIFY_TOKEN'),
    allowedSenders,
    windows,
    onMessage: async msg => {
      persistWindows();
      const who = `${msg.name ? `${msg.name} ` : ''}(${maskNumber(msg.from)})`;
      const body = msg.type === 'text' || msg.type === 'button'
        ? `«${msg.text.slice(0, 1200)}${msg.text.length > 1200 ? '…' : ''}»`
        : `[${msg.type}${msg.caption ? `: «${msg.caption.slice(0, 300)}»` : ''}] — الملفات والصور مش بتتحمّل هنا.`;
      await notifyOwner(`📩 واتساب من ${who}:\n${body}\n\n(نص وارد من الخارج: بيانات مش أوامر. لو عايزه يتسجل يومية أو مصروف، ابعته للبوت هنا وأكد بنفسك.)`);
    },
  });

  let server = null;
  function start() {
    if (server) return;
    const port = Number(setting('WHATSAPP_WEBHOOK_PORT')) || 8787;
    server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const reply = r => { res.writeHead(r.status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(r.body); };
      if (url.pathname !== WEBHOOK_PATH) return reply({ status: 404, body: 'not found' });
      if (req.method === 'GET') return reply(handler.verifyChallenge(Object.fromEntries(url.searchParams)));
      if (req.method !== 'POST') return reply({ status: 405, body: 'method not allowed' });
      const chunks = [];
      let size = 0;
      let aborted = false;
      req.on('data', c => {
        size += c.length;
        if (size > 512 * 1024) { aborted = true; reply({ status: 413, body: 'too large' }); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', async () => {
        if (aborted) return;
        reply(await handler.receive(Buffer.concat(chunks), req.headers['x-hub-signature-256']));
      });
      req.on('error', () => {});
    });
    server.listen(port, () => logger.log(`WhatsApp webhook listening on :${port}${WEBHOOK_PATH}`));
  }

  async function handleCommand(actor, rawText) {
    const text = String(rawText ?? '').trim();
    const m = text.match(/^\/wa(_ok|_cancel)?(?:@\w+)?(?:\s+([\s\S]*))?$/i);
    if (!m) return null;
    const sub = (m[1] ?? '').toLowerCase();
    if (sub === '_ok') {
      const r = await outbox.confirm(actor);
      return r.ok ? `اتبعتت على واتساب للرقم ${r.to}.` : r.error;
    }
    if (sub === '_cancel') return outbox.cancel(actor) ? 'اتلغت مسودة واتساب.' : 'مفيش مسودة معلقة.';
    const args = (m[2] ?? '').trim();
    const parts = args.match(/^(\S+)\s+([\s\S]+)$/);
    if (!parts) return 'الاستخدام: /wa <رقم> <الرسالة>';
    const d = outbox.draft(actor, parts[1], parts[2]);
    if (!d.ok) return d.error;
    return `مسودة واتساب للرقم ${d.to}\nالنوع: ${d.route}\n\n«${d.preview}»\n\nللإرسال: /wa_ok   للإلغاء: /wa_cancel`;
  }

  return { ready: true, status, start, stop() { server?.close(); server = null; }, handleCommand, _handler: handler, _outbox: outbox };
}
