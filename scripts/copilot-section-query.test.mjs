// اختبارات query_company_data و get_public_website_info بقاعدة بيانات وهمية (من غير شبكة).
// node --experimental-strip-types --no-warnings scripts/copilot-section-query.test.mjs
import assert from 'node:assert/strict';
import { createCopilotTools } from './copilot-tools.mjs';
import { runEnabledCopilotTool, getEnabledCopilotDeclarations, allowedQuerySections } from './copilot-tool-policy.mjs';
import { DECLARED_TOOLS } from './copilot-tool-registry.mjs';
import { applyRoleToAccess } from './copilot-access-control.mjs';
import { ilikePattern, sanitizeTerm, validateQueryArgs } from './copilot-section-query.mjs';
import { clearWebsiteCache } from './copilot-website-knowledge.mjs';

const CID = '72918f4d-10c3-43a0-884e-2f84f1224335';
const P1 = '11111111-1111-4111-8111-111111111111';
const S1 = '22222222-2222-4222-8222-222222222222';
const R1 = '33333333-3333-4333-8333-333333333333';
const R2 = '44444444-4444-4444-8444-444444444444';
const I1 = '55555555-5555-4555-8555-555555555555';

const DB = {
  projects: [{ id: P1, Property: 'فيلا 12', project_name: 'فيلا 12', project_code: 'V12', client_name: 'أبو محمد', contract_value: 900000, status: 'جاري' }],
  partners: [{ id: S1, name: 'مؤسسة الأمل للتوريدات', code: 'S-001', partner_type: 'مورد', job_role: null, is_active: true, phone: '0500000000' }],
  material_items: [{ id: 'm1', item_code: 'CEM-1', item_name: 'اسمنت مقاوم', main_category: 'خامات', default_unit: 'شيكارة', default_unit_price: 18, moving_avg_cost: 17.5, min_order_level: 40 }],
  material_receipts: [
    { id: R1, receipt_number: 'MR-1', receipt_date: '2026-10-01', supplier_id: S1, project_id: P1, status: 'معتمد' },
    { id: R2, receipt_number: 'MR-2', receipt_date: '2026-11-05', supplier_id: S1, project_id: P1, status: 'معتمد' },
  ],
  material_receipt_lines: [
    { receipt_id: R1, item_name: 'اسمنت مقاوم', quantity: 100, unit: 'شيكارة', unit_price: 17, total_price: 1700 },
    { receipt_id: R2, item_name: 'اسمنت مقاوم', quantity: 50, unit: 'شيكارة', unit_price: 19, total_price: 950 },
  ],
  material_issues: [{ id: I1, issue_number: 'MI-1', issue_date: '2026-11-06', subcontractor_id: null, contractor_text_name: 'مقاول المحارة', project_id: P1, issue_type: 'صرف' }],
  material_issue_lines: [{ issue_id: I1, item_name: 'اسمنت مقاوم', quantity: 120, unit: 'شيكارة', unit_price: 18, total_price: 2160 }],
  inventory: [],
  purchase_orders: [], purchase_order_lines: [],
  expenses: [{ exp_date: '2026-11-07', description: 'اسمنت للمحارة', main_category: 'خامات', site_ref: 'فيلا 12', project_id: P1, payee_name: 'الأمل', quantity: 10, unit_price: 20, total_price: 200, is_posted: true, is_deleted: false }],
  boq_budget: [{ id: 'b1', work_item: 'محارة داخلي', Property: 'فيلا 12', project_id: P1, main_category: 'تشطيبات', contract_quantity: 800, unit: 'م2', unit_contract_price: 45, total_contract_amount: 36000, completed_percentage: 40 }],
  payment_vouchers: [{ voucher_number: 'PV-9', date: '2026-11-02', partner_id: S1, amount: 5000, payment_method: 'تحويل', description: 'دفعة اسمنت', site_ref: 'فيلا 12', status: 'مرحل', is_posted: true }],
};

const requests = [];
function ilikeToRegex(p) {
  return new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/_/g, '.') + '$', 'i');
}
function mockFetch(url, init = {}) {
  const u = new URL(url);
  requests.push({ url: u, init });
  if (u.pathname.endsWith('/rpc/website_public_content')) return Promise.resolve(resp({}));
  const table = u.pathname.split('/').pop();
  let rows = (DB[table] || []).slice();
  for (const [k, v] of u.searchParams) {
    if (['select', 'order', 'limit', 'company_id', 'or', 'and'].includes(k)) continue;
    if (v.startsWith('in.(')) { const ids = v.slice(4, -1).split(','); rows = rows.filter(r => ids.includes(String(r[k]))); }
    else if (v.startsWith('ilike.')) { const re = ilikeToRegex(v.slice(6)); rows = rows.filter(r => re.test(String(r[k] ?? ''))); }
    else if (v.startsWith('gte.')) rows = rows.filter(r => String(r[k]) >= v.slice(4));
    else if (v.startsWith('lte.')) rows = rows.filter(r => String(r[k]) <= v.slice(4));
    else if (v === 'not.is.true') rows = rows.filter(r => r[k] !== true);
  }
  const or = u.searchParams.get('or');
  if (or) {
    const parts = or.slice(1, -1).split(',').map(x => { const [col, op, ...rest] = x.split('.'); return { col, op, val: rest.join('.') }; });
    rows = rows.filter(r => parts.some(p => (p.op === 'ilike' ? ilikeToRegex(p.val).test(String(r[p.col] ?? '')) : p.op === 'in' ? p.val.slice(1, -1).split(',').includes(String(r[p.col])) : false)));
  }
  const cols = (u.searchParams.get('select') || '').split(',');
  const out = rows.map(r => Object.fromEntries(cols.filter(c => c in r).map(c => [c, r[c]])));
  return Promise.resolve(resp(out, out.length));
}
function resp(body, total) {
  return { ok: true, json: async () => body, headers: { get: (h) => (h === 'content-range' && total !== undefined ? `0-${total}/${total}` : null) } };
}

const tools = createCopilotTools({ supabaseUrl: 'https://x.supabase.co', supabaseKey: 'service-key-long-enough', companyId: CID, allowServiceRole: true, fetchImpl: mockFetch });
const admin = { companyId: CID, userId: 'u1', companyName: 'فاي تك', fullCompanyAccess: true, telegramRole: 'admin', companyCurrency: 'ر.س' };
const full = { companyId: CID, userId: 'u1', companyName: 'فاي تك', fullCompanyAccess: true, companyCurrency: 'ر.س' };
const engineer = applyRoleToAccess(full, 'engineer');
const viewer = applyRoleToAccess(full, 'viewer');
const accountant = applyRoleToAccess(full, 'accountant');
const run = (args, access = admin) => runEnabledCopilotTool({ name: 'query_company_data', args }, tools, access, new Date('2026-11-16T10:00:00Z'));
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

// 1) السعر: آخر توريد + المورد + أقل/أعلى + دليل الخامات + المصروفات + المقايسة
let text = await run({ section: 'prices', search: 'سعر الاسمنت' });
ok(text.includes('آخر سعر 19') && text.includes('2026-11-05') && text.includes('مؤسسة الأمل'), 'آخر سعر توريد بالتاريخ والمورد');
ok(text.includes('أقل 17') && text.includes('أعلى 19'), 'أقل وأعلى سعر');
ok(text.includes('دليل الخامات') && text.includes('18'), 'سعر دليل الخامات');
ok(text.includes('المصروفات'), 'المصروفات في الأسعار');

// 2) كل الطلبات عليها company_id، ومفيش select=*
ok(requests.filter(r => !r.url.pathname.includes('/rpc/')).every(r => r.url.searchParams.get('company_id') === 'eq.' + CID), 'company_id على كل طلب');
ok(requests.every(r => r.url.searchParams.get('select') !== '*'), 'مفيش select=*');

// 3) المخزون = المورّد − المنصرف، وتحت حد الطلب
text = await run({ section: 'stock', search: 'اسمنت' });
ok(/الرصيد 30/.test(text) && text.includes('🔴'), `الرصيد 150−120=30 وتحت حد الطلب 40\n${text}`);

// 4) المهندس: من غير مبالغ، والأقسام المالية مرفوضة
text = await run({ section: 'material_receipts', search: 'اسمنت' }, engineer);
ok(text.includes('MR-2') && !text.includes('💰') && !text.includes('19 '), `المهندس يشوف التوريد من غير أسعار\n${text}`);
text = await run({ section: 'prices', search: 'اسمنت' }, engineer);
ok(text.includes('مبالغ مالية'), 'الأسعار مرفوضة للمهندس');
text = await run({ section: 'expenses' }, engineer);
ok(text.includes('مبالغ مالية'), 'المصروفات مرفوضة للمهندس');
ok(!allowedQuerySections(viewer).includes('partners') && allowedQuerySections(viewer).includes('items'), 'القراءة فقط: الأصناف آه والشركاء لأ');
ok(allowedQuerySections(accountant).includes('prices') && allowedQuerySections(accountant).includes('invoices'), 'المحاسب يشوف الأسعار والفواتير');

// 5) فلتر المشروع على المصروفات: project_id أو site_ref، ومع البحث بيتجمعوا بـ and
requests.length = 0;
text = await run({ section: 'expenses', project: 'فيلا 12' });
let expReq = requests.find(r => r.url.pathname.endsWith('/expenses'));
ok(expReq.url.searchParams.get('or')?.includes('project_id.in.') && expReq.url.searchParams.get('or')?.includes('site_ref.ilike.'), 'فلتر المشروع بـ or');
ok(text.includes('اسمنت للمحارة') && text.includes('200'), 'مصروفات الفيلا');
requests.length = 0;
await run({ section: 'expenses', project: 'فيلا 12', search: 'اسمنت' });
expReq = requests.find(r => r.url.pathname.endsWith('/expenses'));
const andP = expReq.url.searchParams.get('and') || '';
ok(!expReq.url.searchParams.get('or') && andP.startsWith('(or(') && andP.includes('project_id.in.') && andP.includes('description.ilike.'), `فلتر المشروع + البحث بـ and\n${andP}`);

// 6) حقن في البحث بيتنضف
ok(sanitizeTerm('اسمنت*),or=(id.neq.0') === 'اسمنت or id neq 0', 'تنضيف الرموز');
ok(!/[(),.]/.test(ilikePattern('حديد,16).*')), 'نمط ilike من غير رموز فلترة');
requests.length = 0;
await run({ section: 'items', search: 'x*),company_id.neq.(' });
ok(requests.every(r => r.url.searchParams.get('company_id') === 'eq.' + CID && !(r.url.searchParams.get('or') || '').includes('company_id')), 'الحقن ما بيغيرش الشركة');

// 7) التحقق من المعطيات
ok(validateQueryArgs({ section: 'prices' }) === null, 'الأسعار من غير بحث مرفوضة');
ok(validateQueryArgs({ section: 'expenses', start_date: '2025-01-01', end_date: '2026-11-01' }) === null, 'فترة أكتر من سنة مرفوضة');
ok(validateQueryArgs({ section: 'expenses', hack: 1 }) === null, 'مفتاح غريب مرفوض');
ok(validateQueryArgs({ section: 'nope' }) === null, 'قسم مش معروف مرفوض');
text = await run({ section: 'prices' });
ok(text.includes('قولّي بتسأل'), 'رسالة توضيح للمعطيات الناقصة');

// 8) البحث الشامل
text = await run({ section: 'all', search: 'اسمنت' });
ok(text.includes('بحث شامل') && text.includes('دليل الخامات') && text.includes('توريدات'), `بحث شامل\n${text}`);

// 9) الشركاء من غير تليفونات
text = await run({ section: 'partners', search: 'الامل' });
ok(text.includes('مؤسسة الأمل') && !text.includes('0500000000'), 'الشريك من غير رقم تليفون');
ok(requests.filter(r => r.url.pathname.endsWith('/partners')).every(r => !(r.url.searchParams.get('select') || '').includes('phone')), 'مفيش phone في select');

// 10) الموقع العام
clearWebsiteCache();
const web = (args, access = viewer) => runEnabledCopilotTool({ name: 'get_public_website_info', args }, tools, access);
text = await web({ section: 'contact' });
ok(text.includes('واتساب') && text.includes('wa.me'), 'التواصل من الموقع');
text = await web({ section: 'real_estate', search: 'دوبلكس' });
ok(text.includes('دوبلكس') && text.includes('/real-estate'), 'العقارات');
text = await web({ section: 'execution_guide', search: 'محارة' });
ok(text.includes('خطوات التنفيذ'), 'دليل التنفيذ');
text = await web({ section: 'all' });
ok(text.includes('قولّي بتسأل عن إيه في الموقع'), 'البحث الشامل محتاج كلمة');
ok(requests.some(r => r.url.pathname.endsWith('/rpc/website_public_content') && r.init.method === 'POST'), 'المحتوى المنشور من RPC');

// 11) التعريفات للنموذج
const decl = getEnabledCopilotDeclarations(DECLARED_TOOLS, viewer).map(d => d.name);
ok(decl.includes('query_company_data') && decl.includes('get_public_website_info'), 'الأداتين معلنتين');
ok(getEnabledCopilotDeclarations(DECLARED_TOOLS, { companyId: null }).some(d => d.name === 'get_public_website_info'), 'الموقع العام متاح من غير شركة');
ok(!getEnabledCopilotDeclarations(DECLARED_TOOLS, { companyId: null }).some(d => d.name === 'query_company_data'), 'بيانات الشركة محتاجة شركة ومستخدم');

console.log(`copilot-section-query: ${n} tests OK`);
