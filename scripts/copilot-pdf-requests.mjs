/**
 * copilot-pdf-requests.mjs
 * /pdf request parsing, per-document kill switches, the pending-confirmation store, the durable
 * request log and the PDF execution flow (roadmap phase 4).
 * Kept free of Telegram/Gemini globals so the eval runner and tests can drive it with mocks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { canUseInternalTool, getCopilotDate, hasModulePermission } from './copilot-tool-policy.mjs';
import { registryEntry } from './copilot-tool-registry.mjs';

const PDF_WORKER_NAME_MAX = 80;   // same limit as getToolArgs in copilot-tool-policy.mjs
const PDF_ITEM_NAME_MAX = 120;    // same limit as the checklist item_name
const CHECKLIST_MAX_ITEMS = 25;
const CHECKLIST_ITEM_MAX = 300;
export const DEFAULT_PDF_PENDING_TTL_MS = 10 * 60 * 1000;

// Wage permission chosen by the owner: laborcost (view). The money section of the worker statement
// also needs every module the payroll RPCs read (see the registry), otherwise it reads «غير متاح».
export const WAGE_PERMISSION_MODULE = 'laborcost';
const STATEMENT_TOOL = 'get_worker_month_statement';
export const MONEY_PERMISSIONS = Object.freeze(registryEntry(STATEMENT_TOOL)?.extraPermissions ?? []);

/** Money modules the requester is missing (empty = the statement may show wages and totals). */
export function missingMoneyPermissions(access) {
  return MONEY_PERMISSIONS.filter(({ module, action }) => !hasModulePermission(access, module, action)).map(p => p.module);
}

// One kill switch per document, OFF unless set to the exact string "true" (roadmap phase 4).
export const PDF_DOCUMENTS = Object.freeze({
  worker_statement: { env: 'COPILOT_PDF_WORKER_ENABLED', label: 'كشف العامل' },
  engineering_checklist: { env: 'COPILOT_PDF_CHECKLIST_ENABLED', label: 'استمارة الفحص' },
});

export function isPdfDocumentEnabled(type, env = process.env) {
  const doc = PDF_DOCUMENTS[type];
  return Boolean(doc) && Object.hasOwn(PDF_DOCUMENTS, type) && env[doc.env] === 'true';
}

const shortId = id => String(id).slice(0, 8);

export const PDF_MESSAGES = Object.freeze({
  usage: 'الأوامر المتاحة:\n• /pdf worker <اسم العامل> <الشهر YYYY-MM>\n• /pdf checklist <البند>',
  noPending: 'مفيش طلب PDF معلق.\n\nاستخدم:\n• /pdf worker <اسم العامل> <الشهر YYYY-MM>\n• /pdf checklist <البند>',
  cancelled: '✖️ ألغيت طلب الـ PDF.',
  disabled: label => `${label} مقفول حاليًا من إعدادات البوت. افتح الشاشة المختصة في فاي تك.`,
  generationFailed: 'مش قادر أولّد الـ PDF دلوقتي.',
  sendFailed: 'تيليجرام رفض إرسال الملف. جرّب تاني.',
  rateLimited: seconds => `تيليجرام طلب الانتظار ${seconds} ثانية قبل الإرسال. جرّب بعدها.`,
  uncertain: id => `حالة إرسال الملف «غير مؤكدة» (رقم ${shortId(id)}). راجع المحادثة: لو الملف وصل يبقى تمام، ولو ماوصلش ابعت /pdf resolve ${shortId(id)} وبعدين اطلبه تاني.`,
  uncertainBlocked: id => `فيه محاولة سابقة لنفس المستند حالتها «غير مؤكدة» (رقم ${shortId(id)}). راجع المحادثة الأول: لو الملف ماوصلش ابعت /pdf resolve ${shortId(id)} وبعدين اطلبه تاني.`,
  inProgress: 'نفس المستند بيتبعت دلوقتي. استنى النتيجة.',
  logUnavailable: 'سجل طلبات الـ PDF مش متاح، فمش هبعت ملفات لحد ما يتصلح. بلّغ مسؤول البوت.',
  resolved: id => `تمام، اتسجّلت مراجعة المحاولة ${shortId(id)}. تقدر تطلب المستند تاني.`,
  resolveNotFound: 'مالقيتش محاولة «غير مؤكدة» بالرقم ده.',
  workerNotAllowed: 'كشف العامل مش متاح من البوت بالإعدادات والصلاحيات الحالية. افتح شاشة اليوميات في فاي تك.',
  workerFetchFailed: 'ما قدرتش أجيب يوميات العامل من فاي تك. راجع الصلاحية والاتصال وجرّب تاني.',
  workerTooMany: 'الفترة فيها سجلات أكتر من اللي يتحط في كشف واحد. قلّل الفترة وجرّب تاني.',
  workerAmbiguous: 'فيه أكتر من شريك مسجّل بنفس الاسم. افتح كشف العامل من شاشة الرواتب في فاي تك عشان تختار الشخص الصح.',
  workerNotFound: 'مالقيتش عامل بالاسم ده في الشركاء. اكتب الاسم زي ما هو مسجّل في فاي تك بالظبط.',
  workerSalaried: 'ده «موظف» بمرتب شهري — كشفه بيطلع من شاشة الرواتب في فاي تك (الراتب والسلف والجزاءات)، مش من يوميات العمالة.',
  workerNotWorker: 'الشريك ده مش مسجّل كعامل يومية، فمالوش كشف يوميات.',
  unknownType: 'نوع PDF غير معروف.',
});

function pdfIsoDate(value) {
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

/** Parses `/pdf worker …` and `/pdf checklist …`. Returns null for other text. */
export function parsePdfRequest(text, now = new Date()) {
  const t = String(text ?? '').trim();
  // Old form (date range) → explain the monthly form, which is what payroll settles on.
  if (/^\/pdf\s+worker\s+.+\s+\d{4}-\d{2}-\d{2}\s+\d{4}-\d{2}-\d{2}$/i.test(t)) {
    return { type: 'invalid', message: 'كشف العامل بقى بالشهر زي شاشة الرواتب:\n/pdf worker <اسم العامل> <YYYY-MM>\nمثال: /pdf worker أحمد محمد 2026-10' };
  }
  const wm = t.match(/^\/pdf\s+worker\s+(.+?)\s+(\d{4})-(\d{2})$/i);
  if (wm) {
    const [, rawName, year, monthNumber] = wm;
    const name = rawName.trim();
    if (name.length > PDF_WORKER_NAME_MAX || !/^[\p{L}\p{M}\p{N} .'\u2019-]+$/u.test(name)) {
      return { type: 'invalid', message: `اسم العامل لازم يكون حروف وأرقام بس، ومايزيدش عن ${PDF_WORKER_NAME_MAX} حرف.` };
    }
    const month = `${year}-${monthNumber}`;
    const first = pdfIsoDate(month + '-01');
    const today = getCopilotDate(now);
    if (!first || month + '-01' > today) {
      return { type: 'invalid', message: 'اكتب شهر صحيح بصيغة YYYY-MM، ومايكونش شهر لسه مابدأش.' };
    }
    const monthEnd = new Date(Date.UTC(Number(year), Number(monthNumber), 0)).toISOString().slice(0, 10);
    const cutoff = monthEnd < today ? monthEnd : today; // like the payroll screen's cut-off date
    return {
      type: 'worker_statement',
      params: { workerName: name, month, cutoffDate: cutoff },
      label: `كشف عامل يومية: ${name} | شهر ${month}${cutoff < monthEnd ? ' (حتى ' + cutoff + ')' : ''}`,
    };
  }
  const cm = t.match(/^\/pdf\s+checklist\s+(.+)$/i);
  if (cm) {
    const itemName = cm[1].trim();
    if (itemName.length > PDF_ITEM_NAME_MAX || /[\u0000-\u001f\u007f]/.test(itemName)) {
      return { type: 'invalid', message: `اسم البند لازم مايزيدش عن ${PDF_ITEM_NAME_MAX} حرف.` };
    }
    return {
      type: 'engineering_checklist',
      params: { itemName },
      label: `تشيك ليست هندسية (مسودة): ${itemName}`,
    };
  }
  return null;
}

/** The confirmation prompt shown before anything is generated. Plain text (sent with html: false). */
export function pdfConfirmationText(request) {
  return `📄 عايز أعمل ${request.label}\n\nأكد الطلب بـ /confirm أو ألغِه بـ /cancel.`;
}

/**
 * Classifies a message for the /pdf flow (used by the bot and the eval runner):
 *   { kind: 'none' } | { kind: 'invalid', message } | { kind: 'disabled', message }
 *   | { kind: 'resolve', shortId } | { kind: 'request', request, text }
 */
export function preparePdfRequest(text, env = process.env, now = new Date()) {
  const t = String(text ?? '').trim();
  const resolve = t.match(/^\/pdf\s+resolve\s+([0-9a-f]{8})$/i);
  if (resolve) return { kind: 'resolve', shortId: resolve[1].toLowerCase() };
  const request = parsePdfRequest(t, now);
  if (!request) return /^\/pdf(?:\s|$)/i.test(t) ? { kind: 'invalid', message: PDF_MESSAGES.usage } : { kind: 'none' };
  if (request.type === 'invalid') return { kind: 'invalid', message: request.message };
  if (!isPdfDocumentEnabled(request.type, env)) return { kind: 'disabled', message: PDF_MESSAGES.disabled(PDF_DOCUMENTS[request.type].label) };
  return { kind: 'request', request, text: pdfConfirmationText(request) };
}

/** Builds a safe document filename: no path/reserved characters, no control chars, bounded length. */
export function safePdfFilename(prefix, ...parts) {
  const body = [prefix, ...parts]
    .map(part => String(part ?? '')
      .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '')
      .trim()
      .replace(/\s+/g, '_'))
    .filter(Boolean)
    .join('_')
    .replace(/\.{2,}/g, '.')
    .slice(0, 80)
    .replace(/^[._]+|[._]+$/g, '');
  return (body || 'document') + '.pdf';
}

const actorKey = ({ chatId, userId } = {}) =>
  Number.isSafeInteger(chatId) && Number.isSafeInteger(userId) ? chatId + ':' + userId : null;

/**
 * Pending /pdf requests waiting for /confirm, bound to one sender in one chat.
 * Entries expire after ttlMs; take() is atomic, so a repeated /confirm can't generate twice.
 */
export function createPendingPdfRequests({ ttlMs = DEFAULT_PDF_PENDING_TTL_MS, now = Date.now } = {}) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || typeof now !== 'function') throw new TypeError('Invalid pending PDF options');
  const entries = new Map();
  const fresh = entry => entry && now() - entry.createdAt <= ttlMs;

  return {
    set(actor, request) {
      const key = actorKey(actor);
      if (!key) return false;
      entries.set(key, { ...request, createdAt: now() });
      return true;
    },
    has(actor) {
      const key = actorKey(actor);
      const entry = key && entries.get(key);
      if (entry && !fresh(entry)) entries.delete(key);
      return Boolean(key && fresh(entries.get(key)));
    },
    take(actor) {
      const key = actorKey(actor);
      if (!key) return undefined;
      const entry = entries.get(key);
      entries.delete(key);
      return fresh(entry) ? entry : undefined;
    },
    delete(actor) {
      const key = actorKey(actor);
      return key !== null && entries.delete(key);
    },
    sweep() {
      let removed = 0;
      for (const [key, entry] of entries) {
        if (!fresh(entry)) { entries.delete(key); removed++; }
      }
      return removed;
    },
    get size() { return entries.size; },
  };
}

// ─── Durable request log ─────────────────────────────────────────────────────
const LOG_STATUSES = new Set(['confirmed', 'refused', 'sending', 'sent', 'failed', 'uncertain', 'resolved']);
const UNRESOLVED = new Set(['sending', 'uncertain']);

/** Request fingerprint without storing the parameters themselves (no worker names in the log). */
export function pdfRequestFingerprint(request) {
  return createHash('sha256').update(String(request?.type) + '\n' + JSON.stringify(request?.params ?? {})).digest('hex').slice(0, 24);
}

function validRecord(record) {
  return record && typeof record.id === 'string' && typeof record.actor === 'string' &&
    typeof record.fingerprint === 'string' && LOG_STATUSES.has(record.status);
}

/**
 * Durable log of confirmed PDF requests: id, actor, type, fingerprint, status, timings, reason code.
 * Never stores file content, worker names or other report data. The "sending" state is written
 * BEFORE contacting Telegram; an interrupted send becomes "uncertain" and blocks a resend of the
 * same document until /pdf resolve. With filePath = null it keeps records in memory (tests/eval).
 * A corrupted log file is never overwritten: the log reports unavailable and PDFs are refused.
 */
export function createPdfRequestLog({ filePath = null, now = Date.now, maxRecords = 500, newId = randomUUID } = {}) {
  let records = [];
  let available = true;
  if (filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!Array.isArray(parsed?.records) || !parsed.records.every(validRecord)) throw new Error('invalid log');
        records = parsed.records;
      }
    } catch {
      available = false;
    }
  }

  function trim() {
    if (records.length <= maxRecords) return;
    const unresolved = records.filter(r => UNRESOLVED.has(r.status));
    const resolved = records.filter(r => !UNRESOLVED.has(r.status));
    const keep = new Set([...unresolved, ...resolved.slice(-Math.max(maxRecords - unresolved.length, 0))]);
    records = records.filter(r => keep.has(r));
  }

  function persist() {
    if (!available) return false;
    trim();
    if (!filePath) return true;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const tmp = `${filePath}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ version: 1, records }, null, 2) + '\n', 'utf8');
      fs.renameSync(tmp, filePath);
      return true;
    } catch {
      return false;
    }
  }

  const iso = () => new Date(now()).toISOString();
  const find = id => records.find(r => r.id === id);

  return {
    get available() { return available; },

    /** Starts a confirmed request. Blocks while the same document is sending or uncertain. */
    begin(actor, request) {
      const key = actorKey(actor);
      if (!available || !key) return { ok: false, reason: 'unavailable' };
      const fingerprint = pdfRequestFingerprint(request);
      const blocking = records.find(r => r.actor === key && r.fingerprint === fingerprint && UNRESOLVED.has(r.status));
      if (blocking) return { ok: false, reason: blocking.status === 'sending' ? 'in_progress' : 'uncertain', record: blocking };
      const record = { id: newId(), actor: key, type: request.type, fingerprint, status: 'confirmed', created_at: iso(), updated_at: iso() };
      records.push(record);
      if (!persist()) {
        records = records.filter(r => r !== record);
        return { ok: false, reason: 'unavailable' };
      }
      return { ok: true, id: record.id };
    },

    /** Updates a record's status. Returns false if it couldn't be stored (callers must not send then). */
    mark(id, status, { reason } = {}) {
      const record = find(id);
      if (!record || !LOG_STATUSES.has(status)) return false;
      const previous = { ...record };
      record.status = status;
      record.updated_at = iso();
      if (status === 'sending') record.sending_started_at = record.updated_at;
      if (['sent', 'failed', 'uncertain'].includes(status) && record.sending_started_at) {
        record.duration_ms = now() - Date.parse(record.sending_started_at);
      }
      if (reason) record.reason = String(reason).slice(0, 40);
      if (!persist()) { Object.assign(record, previous); return false; }
      return true;
    },

    /** After a manual review of an uncertain send: unblocks a new request for that document. */
    resolve(actor, id8) {
      const key = actorKey(actor);
      const record = records.find(r => r.actor === key && r.status === 'uncertain' && r.id.startsWith(String(id8)));
      return record ? this.mark(record.id, 'resolved', { reason: 'reviewed' }) && record.id : false;
    },

    /** On startup: a send that never got a definite answer becomes uncertain. */
    recoverInterrupted() {
      const pending = records.filter(r => r.status === 'sending');
      for (const record of pending) this.mark(record.id, 'uncertain', { reason: 'interrupted' });
      return pending.length;
    },

    get(id) { const r = find(id); return r ? { ...r } : null; },
    list() { return records.map(r => ({ ...r })); },
  };
}

/** Pulls the "- [ ]" check points of the matched guide section's checklist (sub-bullets dropped). */
export function extractChecklistItems(guidance) {
  if (typeof guidance !== 'string') return [];
  const checklistPart = guidance.split(/\n###\s+ب\./)[0];
  return checklistPart.split('\n')
    .map(line => line.match(/^- \[[ xX]\]\s+(.+)$/)?.[1])
    .filter(Boolean)
    .map(text => text.replace(/\*\*/g, '').replace(/[:：]\s*$/, '').trim())
    .filter(text => text && !/[\u0000-\u001f\u007f]/.test(text))
    .map(text => text.length > CHECKLIST_ITEM_MAX ? text.slice(0, CHECKLIST_ITEM_MAX - 1) + '…' : text)
    .slice(0, CHECKLIST_MAX_ITEMS);
}

/** sendDocument may answer true/false (legacy) or { status: 'sent'|'failed'|'uncertain', retryAfter }. */
function sendOutcome(result) {
  if (result === true) return { status: 'sent' };
  if (result === false || result == null) return { status: 'failed' };
  if (typeof result === 'string') return { status: result };
  return { status: ['sent', 'failed', 'uncertain'].includes(result.status) ? result.status : 'uncertain', retryAfter: result.retryAfter };
}

/**
 * Generates and sends a confirmed PDF request. Returns null on success, or a user-facing text.
 * deps:
 *   actor                      → { chatId, userId } of the trusted Telegram update
 *   log                        → createPdfRequestLog(...)
 *   resolveAccess()            → verified company access or null (caller applies LIVE_READS)
 *   createTools(access)        → copilot tools bound to that access
 *   generateWorkerStatementPdf / generateEngineeringChecklistPdf
 *   sendDocument(buffer, filename, caption) → { status, retryAfter? } | boolean
 *   companyNameFallback        → name for static forms
 */
export async function executePdfRequest(pending, deps) {
  const { type, params } = pending ?? {};
  if (!Object.hasOwn(PDF_DOCUMENTS, type ?? '')) return PDF_MESSAGES.unknownType;
  // Kill switch re-checked at execution time (it may have been turned off after the request).
  if (!isPdfDocumentEnabled(type)) return PDF_MESSAGES.disabled(PDF_DOCUMENTS[type].label);

  const started = deps.log.begin(deps.actor, pending);
  if (!started.ok) {
    if (started.reason === 'uncertain') return PDF_MESSAGES.uncertainBlocked(started.record.id);
    if (started.reason === 'in_progress') return PDF_MESSAGES.inProgress;
    return PDF_MESSAGES.logUnavailable;
  }
  const id = started.id;
  const refuse = (code, message) => { deps.log.mark(id, 'refused', { reason: code }); return message; };

  try {
    let pdfBuffer, filename, caption;

    if (type === 'worker_statement') {
      // Fresh access + the internal tool's gate (status, flag, company, labor_logs + partners view).
      const access = await deps.resolveAccess();
      if (!canUseInternalTool(STATEMENT_TOOL, access)) return refuse('not_allowed', PDF_MESSAGES.workerNotAllowed);
      const showMoney = missingMoneyPermissions(access).length === 0;
      const result = await deps.createTools(access)[STATEMENT_TOOL]({
        worker_name: params.workerName,
        month: params.month,
        cutoff_date: params.cutoffDate,
        include_money: showMoney,
      }).catch(() => null);
      if (result?.success !== true) return refuse('fetch_failed', PDF_MESSAGES.workerFetchFailed);
      if (result.found === false) return refuse('not_found', PDF_MESSAGES.workerNotFound);
      if (result.ambiguous === true) return refuse('ambiguous_name', PDF_MESSAGES.workerAmbiguous);
      if (result.salaried === true) return refuse('salaried', PDF_MESSAGES.workerSalaried);
      if (result.not_worker === true) return refuse('not_worker', PDF_MESSAGES.workerNotWorker);
      if (result.partial === true) return refuse('too_many_rows', PDF_MESSAGES.workerTooMany);

      pdfBuffer = await deps.generateWorkerStatementPdf({
        workerName: params.workerName,
        month: params.month,
        startDate: params.month + '-01',
        endDate: params.cutoffDate,
        logs: result.rows,
        showWages: showMoney && result.money != null,
        money: showMoney ? result.money : null,
        moneyNote: !showMoney ? 'الملخص المالي غير متاح بصلاحيات حساب البوت الحالية.'
          : result.money == null ? 'تعذّر جلب الملخص المالي من حساب الرواتب.' : null,
        unpostedCount: result.unposted_count ?? 0,
        companyName: access.companyName ?? deps.companyNameFallback ?? 'فاي تك',
      });
      filename = safePdfFilename('كشف', params.workerName, params.month);
      caption = `📄 كشف عامل يومية: ${params.workerName} — ${params.month}`;
    } else {
      // Static draft form: no company data is read. Check points come from the local guide only.
      const guide = await deps.createTools(null).get_engineering_checklist_and_specs({ item_name: params.itemName })
        .catch(() => null);
      const items = guide?.reference_found ? extractChecklistItems(guide.engineering_guidance) : [];
      pdfBuffer = await deps.generateEngineeringChecklistPdf({
        title: params.itemName,
        projectName: '—',
        stageName: params.itemName,
        inspectorName: '—',
        contractorName: '—',
        inspectionDate: '—',
        status: 'مسودة',
        items,
        companyName: deps.companyNameFallback ?? 'فاي تك',
      });
      filename = safePdfFilename('checklist', params.itemName);
      caption = `📋 تشيك ليست (مسودة): ${params.itemName}`;
    }

    // Record the attempt BEFORE contacting Telegram; if that can't be stored, don't send.
    if (!deps.log.mark(id, 'sending')) return PDF_MESSAGES.logUnavailable;
    const outcome = sendOutcome(await deps.sendDocument(pdfBuffer, filename, caption));
    if (outcome.status === 'sent') { deps.log.mark(id, 'sent'); return null; }
    if (outcome.status === 'failed') {
      deps.log.mark(id, 'failed', { reason: outcome.retryAfter ? 'rate_limited' : 'rejected' });
      return outcome.retryAfter ? PDF_MESSAGES.rateLimited(outcome.retryAfter) : PDF_MESSAGES.sendFailed;
    }
    deps.log.mark(id, 'uncertain', { reason: 'ambiguous_response' });
    return PDF_MESSAGES.uncertain(id);
  } catch {
    // A throw after "sending" means we can't know whether Telegram got the file.
    if (deps.log.get(id)?.status === 'sending') {
      deps.log.mark(id, 'uncertain', { reason: 'send_error' });
      return PDF_MESSAGES.uncertain(id);
    }
    deps.log.mark(id, 'failed', { reason: 'generation_error' });
    return PDF_MESSAGES.generationFailed;
  }
}
