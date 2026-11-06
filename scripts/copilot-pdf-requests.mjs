/**
 * copilot-pdf-requests.mjs
 * /pdf request parsing, the pending-confirmation store, and the PDF execution flow.
 * Kept free of Telegram/Gemini globals so the eval runner and tests can drive it with mocks.
 */
import { canUseCopilotTool, hasModulePermission } from './copilot-tool-policy.mjs';

const PDF_WORKER_NAME_MAX = 80;   // same limit as getToolArgs in copilot-tool-policy.mjs
const PDF_ITEM_NAME_MAX = 120;    // same limit as the checklist item_name
const PDF_MAX_RANGE_DAYS = 31;
const CHECKLIST_MAX_ITEMS = 25;
const CHECKLIST_ITEM_MAX = 300;
export const DEFAULT_PDF_PENDING_TTL_MS = 10 * 60 * 1000;

// Wages are shown only with this permission (roadmap phase 2: "صلاحية أجور").
// Open decision: 'payroll' (wages screen) vs 'laborcost'. Without it the wage cells read «غير متاح».
export const WAGE_PERMISSION_MODULE = 'payroll';

export const PDF_MESSAGES = Object.freeze({
  noPending: 'مفيش طلب PDF معلق.\n\nاستخدم:\n• /pdf worker <الاسم> <من YYYY-MM-DD> <إلى YYYY-MM-DD>\n• /pdf checklist <البند>',
  cancelled: '✖️ ألغيت طلب الـ PDF.',
  generationFailed: 'مش قادر أولّد الـ PDF دلوقتي.',
  sendFailed: 'فشل إرسال ملف PDF. جرّب تاني.',
  workerNotAllowed: 'كشف العامل مش متاح من البوت بالإعدادات والصلاحيات الحالية. افتح شاشة اليوميات في فاي تك.',
  workerFetchFailed: 'ما قدرتش أجيب يوميات العامل من فاي تك. راجع الصلاحية والاتصال وجرّب تاني.',
  workerTooMany: 'الفترة فيها سجلات أكتر من اللي يتحط في كشف واحد. قلّل الفترة وجرّب تاني.',
  workerAmbiguous: 'فيه أكتر من عامل مسجّل بنفس الاسم في الفترة دي. افتح كشف العامل من شاشة اليوميات في فاي تك عشان تختار العامل الصح.',
  unknownType: 'نوع PDF غير معروف.',
});

function pdfIsoDate(value) {
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

/** Parses `/pdf worker …` and `/pdf checklist …`. Returns null for other text. */
export function parsePdfRequest(text) {
  const t = String(text ?? '').trim();
  const wm = t.match(/^\/pdf\s+worker\s+(.+?)\s+(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})$/i);
  if (wm) {
    const [, rawName, start, end] = wm;
    const name = rawName.trim();
    if (name.length > PDF_WORKER_NAME_MAX || !/^[\p{L}\p{M}\p{N} .'’-]+$/u.test(name)) {
      return { type: 'invalid', message: `اسم العامل لازم يكون حروف وأرقام بس، ومايزيدش عن ${PDF_WORKER_NAME_MAX} حرف.` };
    }
    const first = pdfIsoDate(start);
    const last = pdfIsoDate(end);
    if (!first || !last || last < first || (last - first) / 86_400_000 >= PDF_MAX_RANGE_DAYS) {
      return { type: 'invalid', message: `اكتب تاريخين صحيحين، والفترة ماتزيدش عن ${PDF_MAX_RANGE_DAYS} يوم.` };
    }
    return {
      type: 'worker_statement',
      params: { workerName: name, startDate: start, endDate: end },
      label: `كشف عامل: ${name} | ${start} ← ${end}`,
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

/**
 * Pending /pdf requests waiting for /confirm, bound to one sender in one chat.
 * Entries expire after ttlMs; take() is atomic, so a repeated /confirm can't generate twice.
 */
export function createPendingPdfRequests({ ttlMs = DEFAULT_PDF_PENDING_TTL_MS, now = Date.now } = {}) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || typeof now !== 'function') throw new TypeError('Invalid pending PDF options');
  const entries = new Map();
  const keyOf = ({ chatId, userId } = {}) =>
    Number.isSafeInteger(chatId) && Number.isSafeInteger(userId) ? chatId + ':' + userId : null;
  const fresh = entry => entry && now() - entry.createdAt <= ttlMs;

  return {
    set(actor, request) {
      const key = keyOf(actor);
      if (!key) return false;
      entries.set(key, { ...request, createdAt: now() });
      return true;
    },
    has(actor) {
      const key = keyOf(actor);
      const entry = key && entries.get(key);
      if (entry && !fresh(entry)) entries.delete(key);
      return Boolean(key && fresh(entries.get(key)));
    },
    take(actor) {
      const key = keyOf(actor);
      if (!key) return undefined;
      const entry = entries.get(key);
      entries.delete(key);
      return fresh(entry) ? entry : undefined;
    },
    delete(actor) {
      const key = keyOf(actor);
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

/**
 * Generates and sends a confirmed PDF request. Returns null on success, or a user-facing error text.
 * deps:
 *   resolveAccess()            → verified company access or null (caller applies LIVE_READS)
 *   createTools(access)        → copilot tools bound to that access
 *   generateWorkerStatementPdf / generateEngineeringChecklistPdf
 *   sendDocument(buffer, filename, caption) → boolean
 *   companyNameFallback        → name for static forms
 */
export async function executePdfRequest(pending, deps) {
  const { type, params } = pending ?? {};

  if (type === 'worker_statement') {
    // Same gate as the model's labor tool, re-checked at execution time.
    const access = await deps.resolveAccess();
    if (!canUseCopilotTool('get_labor_daily_logs', access)) return PDF_MESSAGES.workerNotAllowed;
    const showWages = hasModulePermission(access, WAGE_PERMISSION_MODULE, 'view');
    const tools = deps.createTools(access);
    const result = await tools.get_worker_statement_rows({
      worker_name: params.workerName,
      start_date: params.startDate,
      end_date: params.endDate,
      include_wages: showWages,
    }).catch(() => null);
    if (result?.success !== true) return PDF_MESSAGES.workerFetchFailed;
    if (result.partial === true) return PDF_MESSAGES.workerTooMany;
    if (result.ambiguous === true) return PDF_MESSAGES.workerAmbiguous;

    const companyName = access.companyName ?? deps.companyNameFallback ?? 'فاي تك';
    const pdfBuffer = await deps.generateWorkerStatementPdf({
      workerName: params.workerName,
      startDate: params.startDate,
      endDate: params.endDate,
      logs: result.rows,
      showWages,
      companyName,
    });
    const sent = await deps.sendDocument(pdfBuffer, safePdfFilename('كشف', params.workerName, params.startDate),
      `📄 كشف عامل: ${params.workerName}`);
    return sent ? null : PDF_MESSAGES.sendFailed;
  }

  if (type === 'engineering_checklist') {
    // Static draft form: no company data is read. Check points come from the local guide only.
    const guide = await deps.createTools(null).get_engineering_checklist_and_specs({ item_name: params.itemName })
      .catch(() => null);
    const items = guide?.reference_found ? extractChecklistItems(guide.engineering_guidance) : [];
    const companyName = deps.companyNameFallback ?? 'فاي تك';
    const pdfBuffer = await deps.generateEngineeringChecklistPdf({
      title: params.itemName,
      projectName: '—',
      stageName: params.itemName,
      inspectorName: '—',
      contractorName: '—',
      inspectionDate: '—',
      status: 'مسودة',
      items,
      companyName,
    });
    const sent = await deps.sendDocument(pdfBuffer, safePdfFilename('checklist', params.itemName),
      `📋 تشيك ليست (مسودة): ${params.itemName}`);
    return sent ? null : PDF_MESSAGES.sendFailed;
  }

  return PDF_MESSAGES.unknownType;
}
