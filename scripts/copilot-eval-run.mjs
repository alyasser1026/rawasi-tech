/**
 * copilot-eval-run.mjs — runs scripts/copilot-eval-cases.json against the real bot modules.
 *
 *   node scripts/copilot-eval-run.mjs            # deterministic checks (+ model checks if GEMINI_API_KEY is set)
 *   node scripts/copilot-eval-run.mjs --stub-pdf # use a stub instead of Puppeteer for PDF flow checks
 *   node scripts/copilot-eval-run.mjs --env-local # take GEMINI_API_KEY (only that line) from .env.local
 *
 * Check kinds per case:
 *   policy   — the expected tool call goes through runEnabledCopilotTool with mocked Supabase (no network)
 *   pdf-flow — /pdf parsing, pending store, /confirm execution with mocked access/tools/sendDocument
 *   model    — live Gemini with the production prompt/declarations (skipped without GEMINI_API_KEY)
 * The key is read from process.env (or, with --env-local, from that single line of .env.local) and is
 * never printed or written to the results. Per-case flags (preconditions.flags) are applied to
 * process.env only while that case runs. Results → work/copilot-eval-results.json
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCopilotTools } from './copilot-tools.mjs';
import { getCopilotDate, getEnabledCopilotDeclarations, runEnabledCopilotTool } from './copilot-tool-policy.mjs';
import { createCopilotConversation } from './copilot-conversation.mjs';
import {
  FUNCTION_DECLARATIONS, GEMINI_GENERATE_URL, MODEL_MESSAGES, MODEL_TIMEOUT_MS,
  buildModelRequest, buildSystemInstructions, interpretModelParts,
} from './copilot-prompt.mjs';
import {
  PDF_MESSAGES, createPdfRequestLog, createPendingPdfRequests, executePdfRequest, preparePdfRequest,
} from './copilot-pdf-requests.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const CASES_PATH = path.join(__dirname, 'copilot-eval-cases.json');
const RESULTS_PATH = path.join(rootDir, 'work', 'copilot-eval-results.json');
const KNOWLEDGE_FILES = ['copilot_knowledge.md', 'copilot_page_scenarios.md', 'copilot_engineering_checklists.md']
  .map(name => path.join(rootDir, 'config', name));

const STUB_PDF = process.argv.includes('--stub-pdf');

// --env-local: read ONLY the GEMINI_API_KEY line; every other line of the file is ignored.
if (process.argv.includes('--env-local') && !process.env.GEMINI_API_KEY) {
  try {
    const line = fs.readFileSync(path.join(rootDir, '.env.local'), 'utf8').split(/\r?\n/)
      .find(entry => /^\s*GEMINI_API_KEY\s*=/.test(entry.replace(/^\uFEFF/, '')));
    const value = line?.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (value) process.env.GEMINI_API_KEY = value;
  } catch {}
}
const HAS_GEMINI = typeof process.env.GEMINI_API_KEY === 'string' && process.env.GEMINI_API_KEY.trim().length > 0;

/** Applies a case's flags to process.env for the duration of fn, then restores the previous values. */
async function withFlags(flags, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(flags ?? {})) {
    previous[key] = Object.hasOwn(process.env, key) ? process.env[key] : undefined;
    process.env[key] = String(value);
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

// Kill switches start OFF for every case unless the case turns them on (the shell's values are ignored).
for (const key of ['COPILOT_PDF_WORKER_ENABLED', 'COPILOT_PDF_CHECKLIST_ENABLED', 'COPILOT_TOOL_TAREEHA_ENABLED']) delete process.env[key];

// ─── Fixtures (synthetic — no real data, no secrets) ─────────────────────────
const COMPANY = '11111111-1111-4111-8111-111111111111';
const USER = '33333333-3333-4333-8333-333333333333';
const ACTOR = { chatId: 1001, userId: 2002 };
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const FAKE_TOKEN = b64({ alg: 'none' }) + '.' + b64({ role: 'authenticated', sub: USER, exp: 4102444800 }) + '.unsigned';
const FAKE_KEY = 'sb_publishable_eval';
const MONEY_PERMS = { laborcost: ['view'], violations: ['view'], payments: ['view'], journal: ['view'] };
const base = { accessToken: FAKE_TOKEN, companyId: COMPANY, userId: USER, companyName: 'شركة الاختبار' };
const ACCESS = {
  full: { ...base, permissions: { labor_logs: ['view'], partners: ['view'], ...MONEY_PERMS } },
  noWages: { ...base, permissions: { labor_logs: ['view'], partners: ['view'] } },
  noPartners: { ...base, permissions: { labor_logs: ['view'], ...MONEY_PERMS } },
  noLabor: { ...base, permissions: {} },
};

const LABOR_ROWS = [
  { work_date: '2026-11-03', worker_name: 'محمود حسن', site_ref: 'فيلا 1', work_item: 'محارة', attendance_value: 1 },
  { work_date: '2026-11-03', worker_name: 'أحمد محمد', site_ref: 'فيلا 2', work_item: 'مباني', attendance_value: 1 },
  { work_date: '2026-11-02', worker_name: 'سيد علي', site_ref: 'فيلا 1', work_item: 'محارة', attendance_value: 0.5 },
];
// Tareeha: deficit = productivity < tareeha × attendance (copilot-tareeha.mjs) → 2 deficits, 1 without productivity.
const TAREEHA_ROWS = [
  { work_date: '2026-11-05', worker_name: 'أحمد محمد', site_ref: 'فيلا 1', work_item: 'محارة', tareeha: 20, productivity: 15, attendance_value: 1, unit: 'م2' },   // عجز
  { work_date: '2026-11-04', worker_name: 'محمود حسن', site_ref: 'فيلا 2', work_item: 'محارة', tareeha: 20, productivity: 25, attendance_value: 1, unit: 'م2' },   // محقق
  { work_date: '2026-11-04', worker_name: 'سيد علي', site_ref: 'فيلا 2', work_item: 'محارة', tareeha: 20, productivity: 10, attendance_value: 0.5, unit: 'م2' },  // نص يوم محقق
  { work_date: '2026-11-03', worker_name: 'كريم سعد', site_ref: 'فيلا 3', work_item: 'محارة', tareeha: 20, productivity: 8, attendance_value: 0.5, unit: 'م2' },   // نص يوم عجز
  { work_date: '2026-11-03', worker_name: 'حسن فؤاد', site_ref: 'فيلا 3', work_item: 'محارة', tareeha: 20, productivity: null, attendance_value: 1, unit: 'م2' }, // من غير إنتاجية
  { work_date: '2026-11-02', worker_name: 'علي حامد', site_ref: 'فيلا 3', work_item: 'محارة', tareeha: 20, productivity: 0, attendance_value: 0, unit: 'م2' },     // غياب
];
const PARTNERS = {
  default: [{ id: 'p-1', partner_type: 'عامل يومية' }],
  'ambiguous-name': [{ id: 'p-1', partner_type: 'عامل يومية' }, { id: 'p-2', partner_type: 'عامل يومية' }],
  salaried: [{ id: 'p-9', partner_type: 'موظف' }],
  'not-found': [],
};
const statementRows = withWages => [
  { work_date: '2026-10-01', site_ref: 'فيلا 3', work_item: 'محارة', attendance_value: 1, tareeha: 20, productivity: 22, unit: 'م2', notes: null, production_desc: null, is_posted: true, ...(withWages && { daily_wage: 250 }) },
  { work_date: '2026-10-02', site_ref: 'فيلا 3', work_item: 'محارة', attendance_value: 0.5, tareeha: 20, productivity: 9, unit: 'م2', notes: 'تأخير خامات', production_desc: null, is_posted: true, ...(withWages && { daily_wage: 125 }) },
  { work_date: '2026-10-03', site_ref: 'فيلا 3', work_item: 'محارة', attendance_value: 1, tareeha: 20, productivity: 20, unit: 'م2', notes: null, production_desc: null, is_posted: false, ...(withWages && { daily_wage: 250 }) },
];
// Payroll RPCs (same shape as pull_payroll_module_data / get_payroll_balances_with_cutoff).
const PAYROLL_MODULE = [
  { partner_id: 'p-1', days_worked: 1.5, total_earned_wage: 375, total_violations: 50, total_payments: 200 },
  { partner_id: 'p-other', days_worked: 9, total_earned_wage: 9999, total_violations: 0, total_payments: 0 },
];
const PAYROLL_BALANCES = [{ partner_id: 'p-1', previous_unpaid_balance: 100 }, { partner_id: 'p-other', previous_unpaid_balance: 5 }];
const EXPECTED_MONEY = { days_worked: 1.5, earned: 375, violations: 50, payments: 200, current_net: 125, previous_balance: 100, final_net: 225 };

/** Mock PostgREST: records every request; answers by table/filters/RPC. */
function createMockSupabase({ scenario = 'default' } = {}) {
  const urls = [];
  const requests = [];
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(String(input));
    urls.push(url);
    requests.push({ url, method: init.method ?? 'GET', headers: init.headers ?? {} });
    const select = url.searchParams.get('select') ?? '';
    let rows = [];
    if (url.pathname.endsWith('/rpc/pull_payroll_module_data')) rows = PAYROLL_MODULE;
    else if (url.pathname.endsWith('/rpc/get_payroll_balances_with_cutoff')) rows = PAYROLL_BALANCES;
    else if (url.pathname.endsWith('/partners')) rows = PARTNERS[scenario] ?? PARTNERS.default;
    else if (url.pathname.endsWith('/labor_daily_logs')) {
      if (url.searchParams.get('tareeha') === 'gt.0') rows = TAREEHA_ROWS;
      else if (select.includes('production_desc')) rows = statementRows(select.includes('daily_wage'));
      else rows = LABOR_ROWS;
    }
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
    });
  };
  const tools = access => createCopilotTools({
    supabaseUrl: 'https://eval.supabase.co', supabaseKey: FAKE_KEY,
    accessToken: access?.accessToken, companyId: access?.companyId, fetchImpl,
  });
  return { urls, requests, tools };
}

/** Every request must be scoped to the bound company: GET by company_id filter, RPC by x-company-id. */
function companyScopeReasons(mock) {
  const reasons = [];
  for (const { url, method, headers } of mock.requests) {
    const scoped = method === 'POST'
      ? headers['x-company-id'] === COMPANY
      : url.searchParams.getAll('company_id').join() === 'eq.' + COMPANY;
    if (!scoped) reasons.push('طلب Supabase من غير الشركة المربوطة: ' + url.pathname.split('/').pop());
  }
  return reasons;
}

function accessFor(preconditions) {
  if (!preconditions || preconditions.companyId === null || preconditions.LIVE_READS_ENABLED === false) return null;
  return ACCESS.full;
}

// ─── Text checks ─────────────────────────────────────────────────────────────
function checkText(text, testCase) {
  const reasons = [];
  const body = String(text ?? '');
  const lower = body.toLowerCase();
  for (const needle of testCase.expected_response_contains ?? []) {
    if (!body.includes(needle)) reasons.push(`contains ناقص: «${needle}»`);
  }
  for (const needle of testCase.expected_response_excludes ?? []) {
    if (lower.includes(String(needle).toLowerCase())) reasons.push(`exclude ظهر: «${needle}»`);
  }
  return reasons;
}

function argsMatch(expected, actual, fixedDate) {
  const reasons = [];
  for (const [key, want] of Object.entries(expected ?? {})) {
    const got = actual?.[key];
    const ok = key === 'date' && want === 'today'
      ? ['today', 'اليوم', 'النهاردة', 'النهارده', fixedDate].includes(got)
      : String(got ?? '').trim() === String(want).trim();
    if (!ok) reasons.push(`tool call غلط: ${key}=${JSON.stringify(got)} (متوقع ${JSON.stringify(want)})`);
  }
  return reasons;
}

// ─── Check runners ───────────────────────────────────────────────────────────
async function runPolicyCheck(testCase, now) {
  const mock = createMockSupabase();
  const access = accessFor(testCase.preconditions);
  const text = await runEnabledCopilotTool(testCase.expected_tool_call, mock.tools(access), access, now);
  const reasons = checkText(text, testCase);
  if (Number.isInteger(testCase.expect_requests) && mock.urls.length !== testCase.expect_requests) {
    reasons.push(`عدد طلبات Supabase ${mock.urls.length} (متوقع ${testCase.expect_requests})`);
  }
  reasons.push(...companyScopeReasons(mock));
  return { kind: 'policy', status: reasons.length ? 'fail' : 'pass', reasons, output: text };
}

async function runPdfFlowCheck(testCase, pdf) {
  const reasons = [];
  let clock = Date.parse('2026-11-06T06:00:00Z');
  const now = () => clock;
  const store = createPendingPdfRequests({ now });
  const scenario = testCase.scenario ?? 'default';
  const log = scenario === 'log-unavailable' ? corruptedLog(now) : createPdfRequestLog({ now });
  let sent = [];
  const generated = [];
  const mock = createMockSupabase({ scenario });
  let sendResult = { 'send-timeout': { status: 'uncertain' }, 'send-rejected': { status: 'failed' },
    'send-429': { status: 'failed', retryAfter: 30 } }[scenario] ?? { status: 'sent' };
  const access = { 'no-wage-permission': ACCESS.noWages, 'no-labor-permission': ACCESS.noLabor,
    'no-partners-permission': ACCESS.noPartners, 'no-access': null }[scenario] ?? ACCESS.full;
  const deps = {
    actor: ACTOR,
    log,
    resolveAccess: async () => access,
    createTools: a => mock.tools(a),
    generateWorkerStatementPdf: async input => { generated.push({ type: 'worker', input }); return pdf.generateWorkerStatementPdf(input); },
    generateEngineeringChecklistPdf: async input => { generated.push({ type: 'checklist', input }); return pdf.generateEngineeringChecklistPdf(input); },
    // Records the log status at the moment of sending: it must already be durable as "sending".
    sendDocument: async (buffer, filename, caption) => {
      sent.push({ buffer, filename, caption, logStatusAtSend: log.list().at(-1)?.status });
      return sendResult;
    },
    companyNameFallback: 'شركة الاختبار',
  };
  // Same path as the bot's /confirm handler.
  const confirm = async () => {
    const pending = store.take(ACTOR);
    if (!pending) return PDF_MESSAGES.noPending;
    try {
      return (await executePdfRequest(pending, deps)) ?? '';
    } catch (error) {
      reasons.push('executePdfRequest رمى خطأ: ' + error.message);
      return '';
    }
  };
  // Same path as the bot's /pdf handler.
  const request = text => {
    const prepared = preparePdfRequest(text);
    if (prepared.kind === 'request') store.set(ACTOR, prepared.request);
    if (prepared.kind === 'resolve') {
      const id = log.resolve(ACTOR, prepared.shortId);
      return { prepared, text: id ? PDF_MESSAGES.resolved(id) : PDF_MESSAGES.resolveNotFound };
    }
    return { prepared, text: prepared.text ?? prepared.message ?? '' };
  };

  // Replay history; scenarios that need an earlier uncertain send run it here first.
  for (const turn of testCase.history ?? []) request(turn.user);
  if (scenario === 'retry-after-uncertain' || scenario === 'resolve-after-uncertain') {
    sendResult = { status: 'uncertain' };
    await confirm();
    sendResult = { status: 'sent' };
    for (const turn of testCase.history ?? []) request(turn.user);
  }

  // The message under test (sent/generated are counted from here on).
  sent = [];
  generated.length = 0;
  const lastId = log.list().at(-1)?.id ?? '';
  const message = testCase.user_message.replace('{last_id}', lastId.slice(0, 8));
  let text = '';
  if (message === '/confirm') {
    if (scenario === 'expired') clock += 11 * 60 * 1000;
    text = await confirm();
    if (store.take(ACTOR)) reasons.push('الطلب المعلق ما اتمسحش بعد /confirm');
  } else {
    const result = request(message);
    text = result.text;
    if (result.prepared.kind === 'none') reasons.push('الرسالة ما اتعرفتش كأمر /pdf');
    if (result.prepared.kind === 'request' && !store.has(ACTOR)) reasons.push('الطلب ما اتحفظش في الـ pending store');
    if (['invalid', 'disabled'].includes(result.prepared.kind) && store.has(ACTOR)) reasons.push('اتحفظ طلب معلق رغم الرفض');
    if (sent.length || generated.length) reasons.push('اتولّد أو اتبعت ملف قبل /confirm');
  }

  reasons.push(...checkText(text, testCase));
  const expect = testCase.expect ?? {};
  if (expect.sent !== undefined && sent.length !== expect.sent) reasons.push(`sendDocument اتنادى ${sent.length} مرة (متوقع ${expect.sent})`);
  if (expect.logStatus) {
    const status = log.list().at(-1)?.status;
    if (status !== expect.logStatus) reasons.push(`حالة السجل ${status ?? '—'} (متوقع ${expect.logStatus})`);
  }
  if (expect.afterResolveSent !== undefined) {
    sent = [];
    for (const turn of testCase.history ?? []) request(turn.user);
    const again = await confirm();
    if (sent.length !== expect.afterResolveSent) reasons.push(`بعد المراجعة sendDocument اتنادى ${sent.length} مرة (متوقع ${expect.afterResolveSent}) — ${again.slice(0, 60)}`);
  }
  for (const doc of sent) {
    if (doc.logStatusAtSend !== 'sending') reasons.push(`الإرسال بدأ والسجل حالته ${doc.logStatusAtSend ?? '—'} (لازم sending قبل الاتصال بتيليجرام)`);
    if (!(doc.buffer instanceof Uint8Array) || Buffer.from(doc.buffer).subarray(0, 4).toString() !== '%PDF') reasons.push('الملف المرسل مش PDF');
    if (!doc.filename.endsWith('.pdf') || /[\\/:*?"<>|]/.test(doc.filename)) reasons.push('اسم الملف مش متعقّم: ' + doc.filename);
  }
  for (const record of log.list()) {
    if (Object.keys(record).some(key => /name|params|worker|caption|file/i.test(key))) reasons.push('السجل الدائم فيه بيانات تقرير');
  }
  if (expect.showWages !== undefined) {
    const worker = generated.find(g => g.type === 'worker');
    if (!worker) reasons.push('كشف العامل ما اتولّدش');
    else if (worker.input.showWages !== expect.showWages) reasons.push(`showWages=${worker.input.showWages} (متوقع ${expect.showWages})`);
    const statementUrl = mock.urls.find(u => (u.searchParams.get('select') ?? '').includes('production_desc'));
    const wageSelected = Boolean(statementUrl && statementUrl.searchParams.get('select').includes('daily_wage'));
    if (statementUrl && wageSelected !== expect.showWages) reasons.push(`daily_wage ${wageSelected ? 'اتطلب' : 'ما اتطلبش'} من Supabase`);
    const rpcCalls = mock.requests.filter(r => r.method === 'POST').length;
    if (!expect.showWages && rpcCalls) reasons.push('اتنادت دوال الرواتب من غير صلاحيات الفلوس');
    if (statementUrl && !/^eq\.p-1$/.test(statementUrl.searchParams.get('worker_partner_id') ?? '')) reasons.push('السجلات مش متفلترة بمعرّف الشريك الثابت');
  }
  if (expect.money !== undefined) {
    const worker = generated.find(g => g.type === 'worker');
    const got = worker?.input.money ?? null;
    const want = expect.money === 'payroll' ? EXPECTED_MONEY : expect.money;
    if (JSON.stringify(got) !== JSON.stringify(want)) reasons.push(`الملخص المالي ${JSON.stringify(got)} (متوقع ${JSON.stringify(want)})`);
  }
  if (expect.checklistDraft) {
    const checklist = generated.find(g => g.type === 'checklist');
    if (!checklist) reasons.push('الاستمارة ما اتولّدتش');
    else {
      if (checklist.input.status !== 'مسودة') reasons.push('حالة الاستمارة مش «مسودة»: ' + checklist.input.status);
      if (!Array.isArray(checklist.input.items) || checklist.input.items.length === 0) reasons.push('الاستمارة من غير نقاط فحص من الدليل');
      if (checklist.input.items?.some(item => typeof item !== 'string')) reasons.push('نقطة فحص فيها حالة مسجلة من غير مصدر');
      if (expect.checklistItemsInclude && !checklist.input.items?.some(item => String(item).includes(expect.checklistItemsInclude))) {
        reasons.push(`نقاط الفحص من قسم غلط (مفيش «${expect.checklistItemsInclude}»)`);
      }
    }
  }
  reasons.push(...companyScopeReasons(mock));
  return { kind: 'pdf-flow', status: reasons.length ? 'fail' : 'pass', reasons, output: text, sent: sent.length };
}

/** A log whose file is corrupted: it must refuse to work (and never overwrite the file). */
function corruptedLog(now) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-eval-'));
  const file = path.join(dir, 'copilot-pdf-requests.json');
  fs.writeFileSync(file, '{ not json', 'utf8');
  return createPdfRequestLog({ filePath: file, now });
}

let knowledgeCache = null;
function loadKnowledge() {
  knowledgeCache ??= KNOWLEDGE_FILES.filter(file => fs.existsSync(file))
    .map(file => fs.readFileSync(file, 'utf8').trim()).join('\n\n');
  return knowledgeCache;
}

const conversationScope = (access, declarations) =>
  access ? [access.userId, access.companyId, declarations.map(tool => tool.name).sort().join(',')].join(':') : 'general';

async function runModelCheck(testCase, now, fixedDate) {
  if (!HAS_GEMINI) return { kind: 'model', status: 'skipped', reasons: ['GEMINI_API_KEY غير مضبوط في البيئة'] };
  const access = accessFor(testCase.preconditions);
  const declarations = getEnabledCopilotDeclarations(FUNCTION_DECLARATIONS, access);
  const scope = conversationScope(access, declarations);
  const conversation = createCopilotConversation({ now: () => now.getTime() });
  (testCase.history ?? []).forEach((turn, index) => {
    conversation.remember({ ...ACTOR, scope, userMessageId: index + 1, userText: turn.user,
      ...(turn.tool ? { toolName: turn.tool } : { modelText: turn.model ?? 'تم.' }) });
  });
  const context = conversation.getContext({ ...ACTOR, scope });
  const systemInstructions = buildSystemInstructions({ knowledge: loadKnowledge(), declarations, referenceMissing: false, date: fixedDate });

  let parts;
  try {
    const response = await fetch(GEMINI_GENERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY.trim() },
      body: JSON.stringify(buildModelRequest({
        systemInstructions,
        contents: [...context.contents, { role: 'user', parts: [{ text: testCase.user_message }] }],
        declarations,
      })),
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });
    if (!response.ok) return { kind: 'model', status: 'fail', reasons: [`Gemini رجّع HTTP ${response.status}`] };
    parts = (await response.json()).candidates?.[0]?.content?.parts;
  } catch (error) {
    return { kind: 'model', status: 'fail', reasons: ['فشل طلب Gemini: ' + (error.name || 'error')] };
  }

  const reply = interpretModelParts(parts, declarations);
  const reasons = [];
  let text;
  let toolCall = null;
  if (reply.type === 'multi') text = MODEL_MESSAGES.multipleCalls;
  else if (reply.type === 'undeclared') { text = MODEL_MESSAGES.undeclared; toolCall = { name: reply.call.name, args: reply.call.args }; }
  else if (reply.type === 'tool') {
    toolCall = { name: reply.call.name, args: reply.call.args ?? {} };
    text = await runEnabledCopilotTool(reply.call, createMockSupabase().tools(access), access, now);
  } else if (reply.type === 'text') text = MODEL_MESSAGES.generalPrefix + reply.text;
  else text = MODEL_MESSAGES.fallback;

  const expected = testCase.expected_tool_call;
  if (expected === null && toolCall && !testCase.allow_tool_call) reasons.push(`tool call غير متوقع: ${toolCall.name}`);
  if (expected && !toolCall && !testCase.allow_no_tool_call) reasons.push('tool call غلط: الموديل ما استدعاش ' + expected.name);
  if (expected && toolCall) {
    if (toolCall.name !== expected.name) reasons.push(`tool call غلط: ${toolCall.name} (متوقع ${expected.name})`);
    else reasons.push(...argsMatch(expected.args, toolCall.args, fixedDate));
  }
  reasons.push(...checkText(text, testCase));
  return { kind: 'model', status: reasons.length ? 'fail' : 'pass', reasons, tool_call: toolCall, output: text };
}

// ─── Main ────────────────────────────────────────────────────────────────────
const PDF_FLOW_IDS = new Set(['gs-008', 'gs-009', 'gs-010', 'gs-018']);

async function loadPdf() {
  const stub = {
    generateWorkerStatementPdf: async () => Buffer.from('%PDF-1.4 stub'),
    generateEngineeringChecklistPdf: async () => Buffer.from('%PDF-1.4 stub'),
    closePdfBrowser: async () => {},
    mode: 'stub',
  };
  if (STUB_PDF) return stub;
  try {
    return { ...(await import('./pdf-generator.mjs')), mode: 'puppeteer' };
  } catch {
    return { ...stub, mode: 'stub (puppeteer غير متاح)' };
  }
}

const suite = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));
const fixedNow = new Date(suite.test_context?.fixed_now ?? Date.now());
const fixedDate = getCopilotDate(fixedNow);
const pdf = await loadPdf();
const startedAt = new Date();
const results = [];

for (const testCase of suite.cases) {
  const checks = [];
  await withFlags(testCase.preconditions?.flags, async () => {
    // Deterministic /pdf, /confirm, /cancel messages are handled before the model → pdf-flow.
    const isPdfFlow = PDF_FLOW_IDS.has(testCase.id) ||
      (testCase.layer === 'deterministic' && /^\/(pdf|confirm|cancel)\b/i.test(testCase.user_message));
    if (isPdfFlow) checks.push(await runPdfFlowCheck(testCase, pdf));
    else if (testCase.expected_tool_call) checks.push(await runPolicyCheck(testCase, fixedNow));
    if (testCase.layer === 'model') checks.push(await runModelCheck(testCase, fixedNow, fixedDate));
  });

  const ran = checks.filter(check => check.status !== 'skipped');
  // pass = every check ran and passed; partial = what ran passed but some checks were skipped (e.g. no Gemini key).
  const status = ran.length === 0 ? 'skipped'
    : ran.some(check => check.status === 'fail') ? 'fail'
    : ran.length < checks.length ? 'partial' : 'pass';
  results.push({ id: testCase.id, category: testCase.category, layer: testCase.layer, status, checks,
    reasons: checks.flatMap(check => check.status === 'fail' ? check.reasons.map(reason => `[${check.kind}] ${reason}`) : []) });
}
await pdf.closePdfBrowser?.().catch?.(() => {});

// ─── Summary ─────────────────────────────────────────────────────────────────
function tally(keyOf, rows) {
  const out = {};
  for (const row of rows) {
    const key = keyOf(row);
    out[key] ??= { pass: 0, partial: 0, fail: 0, skipped: 0 };
    out[key][row.status]++;
  }
  for (const value of Object.values(out)) {
    const ran = value.pass + value.partial + value.fail;
    // Rate over what actually ran: partial counts as "no failure seen" but is reported separately.
    value.pass_rate = ran ? Math.round(((value.pass + value.partial) / ran) * 1000) / 10 : null;
  }
  return out;
}
const allChecks = results.flatMap(result => result.checks.map(check => ({ ...check, id: result.id })));
const summary = {
  cases: tally(() => 'all', results).all,
  by_category: tally(row => row.category, results),
  by_layer: tally(row => row.layer, results),
  by_check_kind: tally(row => row.kind, allChecks),
};

const output = {
  timestamp: startedAt.toISOString(),
  duration_ms: Date.now() - startedAt.getTime(),
  environment: {
    node: process.version, platform: process.platform,
    gemini: HAS_GEMINI ? 'enabled' : 'skipped (GEMINI_API_KEY غير مضبوط)',
    pdf_generator: pdf.mode,
    fixed_now: fixedNow.toISOString(),
  },
  summary,
  results,
};
fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
fs.writeFileSync(RESULTS_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');

// ─── Report ──────────────────────────────────────────────────────────────────
const pct = value => value.pass_rate == null ? '—' : value.pass_rate + '%';
const line = (label, value) => `  ${label.padEnd(22)} ${String(value.pass).padStart(3)} نجح  ${String(value.partial ?? 0).padStart(3)} جزئي  ${String(value.fail).padStart(3)} فشل  ${String(value.skipped).padStart(3)} متخطّى   ${pct(value)}`;
console.log('\n══ Copilot eval ══  ' + output.timestamp);
console.log(`Gemini: ${output.environment.gemini} | PDF: ${pdf.mode}`);
console.log('\nالحالات:');
console.log(line('الكل', summary.cases));
console.log('\nحسب الـ layer:');
for (const [key, value] of Object.entries(summary.by_layer)) console.log(line(key, value));
console.log('\nحسب نوع الفحص:');
for (const [key, value] of Object.entries(summary.by_check_kind)) console.log(line(key, value));
console.log('\nحسب الـ category:');
for (const [key, value] of Object.entries(summary.by_category)) console.log(line(key, value));
const failed = results.filter(result => result.status === 'fail');
console.log(failed.length ? '\nحالات فشلت:' : '\nمفيش حالات فشلت ✅');
for (const result of failed) console.log(`  ✗ ${result.id} (${result.category}): ${result.reasons.join(' | ')}`);
const partial = results.filter(result => result.status === 'partial').length;
if (partial) console.log(`\n${partial} حالة «جزئي»: فحص الموديل اتخطّى — شغّل بـ GEMINI_API_KEY عشان القياس الكامل.`);
console.log('\nالنتيجة اتحفظت في work/copilot-eval-results.json');
process.exitCode = failed.length ? 1 : 0;
