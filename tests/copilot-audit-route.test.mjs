import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(relative, imports = {}, env = {}) {
  const text = ts.transpileModule(readFileSync(new URL(relative, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInThisContext(`(function(exports,require,process){${text}\n})`)(exports, name => {
    assert(Object.hasOwn(imports, name), 'Unmocked dependency: ' + name);
    return imports[name];
  }, { env });
  return exports;
}
const relevance = load('../lib/copilot/catalog-relevance.ts');
const handoff = load('../lib/copilot/handoff.ts');
const policy = load('../lib/copilot/response-policy.ts');
const makeCard = (id, name, category, inStock = true) => ({ id, name, category, categoryTitle: category, subCategory: '', brand: 'Fixture', code: id, price: 100, unit: 'قطعة', currency: 'ج.م', inStock, specs: [] });

function setup({ reply = 'أهلاً بحضرتك', products = [], knowledge = [], ai = true, offerText = '', warrantyText = '' } = {}) {
  const calls = { ai: 0, search: 0, submissions: 0, messages: [] };
  let latestContext;
  const tools = {
    getServiceSupabase: () => ({}),
    getCachedCatalogOverview: async () => ({ status: 'ok' }),
    formatCatalogOverviewForPrompt: () => 'كتالوج تجريبي',
    GEMINI_FUNCTION_DECLARATIONS: [], GROQ_TOOLS: [],
    execSearchProducts: async (_sb, args, ctx) => { calls.search++; latestContext = ctx; ctx.toolsUsed.push('search_products'); ctx.products.push(...products); return { status: products.length ? 'found' : 'no_match', ok: true }; },
    execSearchExecutionAndMaintenance: async () => ({ trainedKnowledge: [], knowledgeSummary: null, maintenanceServices: [] }),
    execGetActiveOffers: async (_sb, _args, ctx) => {
      if (offerText) ctx.verifiedPolicies = [{ title: 'الخصومات والعروض المنشورة', keywords: ['خصم'], answer: offerText, is_active: true }];
      return { hasVerifiedActiveOffers: Boolean(offerText), promoBannerText: offerText, offerBanners: [] };
    },
    execGetProductDetails: async (_sb, _args, ctx) => {
      if (warrantyText) ctx.verifiedPolicies = [{ title: 'ضمان المنتج كالون i7', category: 'warranty', answer: warrantyText, is_active: true }];
      return { found: true };
    },
    execCalculateOrderWithInstall: async () => ({ ok: false, error: 'Fixture estimate rejected' }),
    execSubmitOrderOrService: async (_sb, _args, ctx) => { calls.submissions++; latestContext = ctx; return { ok: false, error: 'Fixture submission rejected' }; },
    executeCopilotToolCall: async (_name, _args, _sb, ctx) => { latestContext = ctx; return { ok: false }; },
  };
  const training = {
    config: { persona_name: 'مساعد الاختبار', tone_guidelines: '', sales_handoff_prompt: '', extra_system_rules: '', forbidden_claims: '' },
    knowledge,
  };
  const route = load('../app/api/store-copilot/route.ts', {
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/store-copilot-tools': tools,
    '@/lib/copilot/training-store': { getCachedCopilotTraining: async () => training, matchCopilotKnowledge: () => [], formatMatchedKnowledgeForPrompt: () => '', formatTrainingConfigForPrompt: () => '' },
    '@/lib/copilot/runtime-budget': { COPILOT_AI_BUDGET_MS: 16000, fetchCopilotJson: async (_url, options) => {
      calls.ai++; const payload = JSON.parse(options.body); calls.messages.push(payload);
      return { candidates: [{ content: { parts: [{ text: reply }] } }] };
    } },
    '@/lib/copilot/catalog-relevance': relevance,
    '@/lib/copilot/handoff': handoff,
    '@/lib/copilot/response-policy': policy,
  }, ai ? { GEMINI_API_KEY: 'fixture-never-sent' } : {});
  let sequence = 0;
  return { calls, context: () => latestContext, async post(body) {
    const response = await route.POST(new Request('https://site.example.invalid/api/store-copilot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: 'COP-AUDIT-' + (++sequence) + Math.random().toString(36).slice(2, 8), ...body }) }));
    return { response, payload: await response.json() };
  } };
}

test('wholesale, discount and delivery questions bypass the model and never manufacture a handoff', async () => {
  const run = setup({ reply: 'أنا حولت طلبك فوراً لمهندس المبيعات' });
  for (const message of ['ولو خدت 20 عبوة لمشروع، في سعر جملة؟', 'لقيته في موقع تاني بـ8000 جنيه، تقدر تخليه7500؟ فيه خصم؟', 'بتوصلوا للمنصورة؟']) {
    const { payload } = await run.post({ message });
    assert.equal(payload.escalated, false);
    assert.equal(payload.submittedOrder, null);
    assert.equal(payload.products.length, 0);
    assert.match(payload.reply, /مش عندي سياسة معتمدة/);
    assert.doesNotMatch(payload.reply, /حولت طلبك|تم تحويل|تم تسجيل/);
  }
  assert.equal(run.calls.ai, 0);
  assert.equal(run.calls.search, 0);
  assert.equal(run.calls.submissions, 0);
});

test('a model cannot claim an action succeeded when no server action was acknowledged', async () => {
  for (const reply of ['أنا حولت طلبك فوراً لمهندس المبيعات المختص', 'سجلتلك طلب معاينة وتواصل وهيتواصل معاك حد من الفريق']) {
    const run = setup({ reply });
    const { payload } = await run.post({ message: 'عندي استفسار عن الخدمة' });
    assert.equal(payload.escalated, false);
    assert.equal(payload.submittedOrder, null);
    assert.doesNotMatch(payload.reply, /حولت طلبك|سجلتلك طلب|هيتواصل معاك/);
    assert.match(payload.reply, /اسمك|بيانات|لم يتم/);
  }
});

test('fallback heater results and their visible text both exclude shared-capacity false matches', async () => {
  const products = [makeCard('heater', 'سخان غاز10لتر', 'appliances'), makeCard('bin', 'باسكت قمامة10لتر', 'decor'), makeCard('paint', 'بستلة دهان10لتر', 'paint'), makeCard('unavailable', 'سخان غاز10لتر آخر', 'appliances', false)];
  const run = setup({ ai: false, products });
  const { payload } = await run.post({ message: 'عايز سخان غاز10لتر' });
  assert.deepEqual(payload.products.map(product => product.id), ['heater']);
  assert.match(payload.reply, /سخان غاز10لتر/);
  assert.doesNotMatch(payload.reply, /باسكت|بستلة|آخر/);
});

test('approved shipping policy is returned exactly without adding COD or nationwide promises', async () => {
  const knowledge = [{ id: 1, title: 'الشحن', category: 'shipping', keywords: ['شحن'], answer: 'التوصيل متاح داخل القاهرة فقط برسوم تؤكد قبل الطلب.', is_active: true }];
  const run = setup({ knowledge });
  const { payload } = await run.post({ message: 'بتوصلوا للمنصورة؟' });
  assert.match(payload.reply, /داخل القاهرة فقط/);
  assert.doesNotMatch(payload.reply, /كل المحافظات|جميع المحافظات|عند الاستلام/);
  assert.equal(run.calls.ai, 0);
});

test('visible model replies translate known slugs and mark rough sizing advice', async () => {
  const run = setup({ reply: 'قسم safety_sensors وقسم low_current. تحتاج `10` لتر دهان للمساحة دي.' });
  const { payload } = await run.post({ message: 'كم دهان يكفي مساحة الغرفة؟' });
  assert.doesNotMatch(payload.reply, /safety_sensors|low_current|`/);
  assert.match(payload.reply, /تقريبي|استرشادي/);
});

test('direct submission retains the explicit structured action but never reports rejected saves as success', async () => {
  const run = setup();
  const { response, payload } = await run.post({ action: 'submit_order', customerName: 'عميل الاختبار', customerPhone: '01012345678' });
  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(run.context().submissionRequested, true);
  assert.equal(payload.submittedOrder, null);
  assert.doesNotMatch(payload.reply, /تم تسجيل/);
});

test('active offers use published CMS text instead of inventing or suppressing an existing offer', async () => {
  const run = setup({ offerText: 'خصم 10% على باقة المنشأة المنشورة فقط.' });
  const { payload } = await run.post({ message: 'إيه أحدث الخصومات والعروض؟' });
  assert.match(payload.reply, /خصم 10%/);
  assert.doesNotMatch(payload.reply, /مش عندي سياسة|25%/);
  assert.equal(run.calls.ai, 0);
});

test('missing active offers do not imply a discount or an automatic sales handoff', async () => {
  const run = setup();
  const { payload } = await run.post({ message: 'عندكم عروض سارية؟' });
  assert.match(payload.reply, /ما عنديش عرض منشور مؤكد/);
  assert.equal(payload.escalated, false);
  assert.equal(run.calls.ai, 0);
});

test('warranty of the active product uses its recorded specification rather than generic company promises', async () => {
  const run = setup({ warrantyText: 'ضمان سنة واحدة وفق شروط الوكيل.', knowledge: [{ title: 'ضمان التشطيب', category: 'warranty', answer: 'ضمان 10 سنوات على التشطيب.', is_active: true }] });
  const { payload } = await run.post({ message: 'الضمان كام سنة؟', activeProductId: 'fixture-lock' });
  assert.match(payload.reply, /سنة واحدة/);
  assert.doesNotMatch(payload.reply, /10 سنوات/);
  assert.equal(run.calls.ai, 0);
});

test('missing product warranty does not borrow another products or finishing warranty', async () => {
  const run = setup({ knowledge: [{ title: 'ضمان التشطيب', category: 'warranty', answer: 'ضمان 10 سنوات على التشطيب.', is_active: true }] });
  const { payload } = await run.post({ message: 'الضمان كام سنة؟', activeProductId: 'fixture-lock' });
  assert.match(payload.reply, /مش عندي سياسة معتمدة/);
  assert.doesNotMatch(payload.reply, /10 سنوات/);
});
