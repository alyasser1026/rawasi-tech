// node scripts/copilot-access-control.test.mjs — صلاحيات مستخدمي تلغرام + حد الطلبات + سجل التدقيق.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ROLES, isToolAllowed, applyRoleToAccess, canUseCallback, callbackLevel, actorContext, currentActor, requireAdmin,
  createUserStore, createDbUserStore, handleUserCommand, createRateLimiter, createAuditLog, messageKind, commandName, normalizeRole,
} from './copilot-access-control.mjs';
import { hasModulePermission } from './copilot-tool-policy.mjs';
import { TOOL_REGISTRY } from './copilot-tool-registry.mjs';

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; } catch (e) { console.error('❌', name); throw e; }
};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'acl-'));
const SERVICE_ACCESS = Object.freeze({
  companyId: 'c1', allowServiceRole: true, fullCompanyAccess: true, accessToken: 'x',
  permissions: Object.freeze({ labor_logs: ['view', 'create', 'edit'], laborcost: ['view', 'create', 'edit'], expenses: ['view', 'create', 'edit'], journal: ['view', 'create', 'edit'] }),
});
const WRITES = ['add_labor_daily_log_draft', 'add_expense_draft', 'add_payment_voucher_draft', 'add_journal_entry_draft', 'add_job_order_draft', 'add_partner', 'update_operation_draft'];

await test('every role tool exists in the registry (no typos)', () => {
  const names = new Set(TOOL_REGISTRY.map(t => t.name));
  for (const [key, r] of Object.entries(ROLES)) if (!r.all) for (const t of r.tools) assert.ok(names.has(t), `${key}: ${t}`);
});

await test('tool allowlists per role', () => {
  for (const t of WRITES) assert.equal(isToolAllowed('viewer', t), false, `viewer ${t}`);
  assert.equal(isToolAllowed('viewer', 'get_daily_comprehensive_report'), true);
  assert.equal(isToolAllowed('engineer', 'add_labor_daily_log_draft'), true);
  assert.equal(isToolAllowed('engineer', 'add_job_order_draft'), true);
  for (const t of ['add_expense_draft', 'add_payment_voucher_draft', 'add_journal_entry_draft', 'update_operation_draft', 'add_partner', 'link_expense_job_order']) {
    assert.equal(isToolAllowed('engineer', t), false, `engineer ${t}`);
  }
  for (const t of WRITES) assert.equal(isToolAllowed('accountant', t), true, `accountant ${t}`);
  assert.equal(isToolAllowed('accountant', 'switch_company'), false);
  assert.equal(isToolAllowed('admin', 'switch_company'), true);
  assert.equal(isToolAllowed('accountant', 'some_future_tool'), false, 'deny by default');
  assert.equal(isToolAllowed('nobody', 'get_labor_daily_logs'), false);
});

await test('role overlay shrinks service-role access and hides money from engineers/viewers', () => {
  const eng = applyRoleToAccess(SERVICE_ACCESS, 'engineer');
  assert.equal(eng.fullCompanyAccess, false);
  assert.equal(eng.telegramRole, 'engineer');
  assert.equal(hasModulePermission(eng, 'labor_logs', 'view'), true);
  for (const m of ['laborcost', 'expenses', 'payments', 'journal']) assert.equal(hasModulePermission(eng, m, 'view'), false, m);
  const viewer = applyRoleToAccess(SERVICE_ACCESS, 'viewer');
  assert.equal(hasModulePermission(viewer, 'labor_logs', 'create'), false);
  const acc = applyRoleToAccess(SERVICE_ACCESS, 'accountant');
  assert.equal(hasModulePermission(acc, 'laborcost', 'view'), true);
  assert.equal(hasModulePermission(acc, 'laborcost', 'edit'), false);
  assert.equal(hasModulePermission(acc, 'expenses', 'create'), true);
  const admin = applyRoleToAccess(SERVICE_ACCESS, 'admin');
  assert.equal(admin.fullCompanyAccess, true);
  assert.equal(SERVICE_ACCESS.fullCompanyAccess, true, 'cached original untouched');
  assert.equal(applyRoleToAccess(SERVICE_ACCESS, 'hacker'), null);
  assert.equal(applyRoleToAccess(null, 'admin'), null);
});

await test('overlay never grants more than the underlying (non-service) user has', () => {
  const limited = { companyId: 'c1', fullCompanyAccess: false, permissions: { expenses: { view: true }, labor_logs: ['view'] } };
  const acc = applyRoleToAccess(limited, 'accountant');
  assert.equal(hasModulePermission(acc, 'expenses', 'view'), true);
  assert.equal(hasModulePermission(acc, 'expenses', 'create'), false);
  assert.equal(hasModulePermission(acc, 'journal', 'view'), false);
  assert.equal(hasModulePermission(acc, 'labor_logs', 'view'), true);
});

await test('callbacks: levels and forged/unknown data', () => {
  assert.equal(callbackLevel('menu:projects'), 'any');
  assert.equal(callbackLevel('cfm:y:0123456789abcdef'), 'any');
  assert.equal(callbackLevel('op_approve:101'), 'write');
  assert.equal(callbackLevel('jo_pick:a:b'), 'finance');
  assert.equal(callbackLevel('alert:d:abcdefabcdef'), 'finance');
  for (const d of ['switch_company:2', 'set_voice_messages:off', 'settings_refresh', 'alert_cfg:show', 'sched_cfg:t:weekly', 'alert:m:low_treasury', 'whatever:x', '']) {
    assert.equal(callbackLevel(d), 'admin', d);
    assert.equal(canUseCallback('accountant', d), false, d);
    assert.equal(canUseCallback('admin', d), true, d);
  }
  assert.equal(canUseCallback('viewer', 'menu:projects'), true);
  assert.equal(canUseCallback('viewer', 'op_delete:101'), false);
  assert.equal(canUseCallback('engineer', 'op_attach:101'), true);
  assert.equal(canUseCallback('engineer', 'jo_pick:a:b'), false);
  assert.equal(canUseCallback('accountant', 'jo_pick:a:b'), true);
  assert.equal(canUseCallback(null, 'menu:projects'), false);
});

await test('requireAdmin: system outside context, admin only inside', async () => {
  requireAdmin('x');
  await actorContext.run({ userId: 1, role: 'admin' }, async () => requireAdmin('x'));
  await actorContext.run({ userId: 2, role: 'accountant' }, async () => {
    assert.throws(() => requireAdmin('تبديل الشركة'), (e) => e.code === 'COPILOT_PROPOSAL_FORBIDDEN' && e.message.includes('تبديل الشركة'));
  });
});

await test('context does not leak between concurrent users', async () => {
  const seen = [];
  await Promise.all([
    actorContext.run({ userId: 1, role: 'admin' }, async () => { await new Promise(r => setTimeout(r, 20)); seen.push(currentActor().userId); }),
    actorContext.run({ userId: 2, role: 'viewer' }, async () => { await new Promise(r => setTimeout(r, 5)); seen.push(currentActor().userId); }),
  ]);
  assert.deepEqual(seen.sort(), [1, 2]);
  assert.equal(currentActor(), null);
});

await test('user store: seed from private chat id, roles, last-admin protection', () => {
  const file = path.join(tmp(), 'users.json');
  const store = createUserStore({ filePath: file, seedAdminIds: [111] });
  assert.equal(store.roleOf(111), 'admin');
  assert.equal(store.roleOf(222), null);
  assert.equal(store.roleOf(0), null);
  assert.equal(store.roleOf(-100123), null, 'groups/channels are never users');
  assert.equal(store.upsert('222', 'محاسب', { name: 'أحمد', by: '111' }).ok, true);
  assert.equal(store.roleOf(222), 'accountant');
  assert.equal(store.upsert('111', 'viewer').ok, false, 'cannot demote last admin');
  assert.equal(store.remove('111').ok, false, 'cannot remove last admin');
  assert.equal(store.upsert('abc', 'admin').ok, false);
  assert.equal(store.upsert('333', 'god').ok, false);
  // ملف اتعدّل يدويًا بيتقري من جديد
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  raw.users['444'] = { role: 'engineer' };
  raw.users['bad'] = { role: 'admin' };
  raw.users['555'] = { role: 'superuser' };
  fs.writeFileSync(file, JSON.stringify(raw));
  const fresh = createUserStore({ filePath: file });
  assert.equal(fresh.roleOf(444), 'engineer');
  assert.equal(fresh.roleOf(555), null);
  assert.equal(fresh.list().some(u => u.id === 'bad'), false);
});

await test('no seed when configured chat is a group → nobody is admin until claim', () => {
  const store = createUserStore({ filePath: path.join(tmp(), 'u.json'), seedAdminIds: [], seedAdminPhones: ['+20 155 888 8744'] });
  assert.equal(store.list().length, 0);
  assert.equal(store.bootstrapPending(), true);
});

await test('existing file with no admin gets the configured private chat as admin', () => {
  const file = path.join(tmp(), 'u.json');
  fs.writeFileSync(file, JSON.stringify({ users: {}, bootstrapAdminPhones: ['201558888744'] }));
  const store = createUserStore({ filePath: file, seedAdminIds: [111] });
  assert.equal(store.roleOf(111), 'admin');
  assert.equal(store.bootstrapPending(), true, 'phone claim still available');
  const store2 = createUserStore({ filePath: file, seedAdminIds: [222] });
  assert.equal(store2.roleOf(222), null, 'seed does not add a second admin once one exists');
});

await test('admin claim by sharing OWN contact for a listed phone, once', () => {
  const store = createUserStore({ filePath: path.join(tmp(), 'u.json'), seedAdminPhones: ['+201558888744'] });
  const msg = (fromId, contactUserId, phone, type = 'private') => ({ chat: { type, id: fromId }, from: { id: fromId, is_bot: false, first_name: 'X' }, contact: { user_id: contactUserId, phone_number: phone } });
  assert.equal(store.claimAdminByContact(msg(900, 901, '201558888744')).ok, false, 'someone else\'s card');
  assert.equal(store.claimAdminByContact(msg(900, 900, '201000000000')).ok, false, 'phone not listed');
  assert.equal(store.claimAdminByContact({ ...msg(900, 900, '201558888744'), chat: { type: 'group', id: -5 } }).ok, false, 'group');
  assert.equal(store.claimAdminByContact(msg(900, 900, '00201558888744')).ok, true, 'normalized phone');
  assert.equal(store.roleOf(900), 'admin');
  assert.equal(store.bootstrapPending(), false);
  assert.equal(store.claimAdminByContact(msg(901, 901, '201558888744')).ok, false, 'one-time');
});

await test('user commands: whoami for anyone, management for admins only', async () => {
  const store = createUserStore({ filePath: path.join(tmp(), 'u.json'), seedAdminIds: [1] });
  assert.ok((await handleUserCommand(store, { userId: 77, role: null }, '/whoami')).text.includes('77'));
  assert.ok((await handleUserCommand(store, { userId: 77, role: null }, '/whoami@MyBot')).text.includes('مش متسجّل'));
  assert.equal((await handleUserCommand(store, { userId: 2, role: 'accountant' }, '/user_add 3 admin')).event, 'denied_admin_command');
  assert.equal((await handleUserCommand(store, { userId: 1, role: 'admin' }, '/user_add 3 مهندس محمد علي')).event, 'user_upsert');
  assert.equal(store.roleOf(3), 'engineer');
  assert.equal((await handleUserCommand(store, { userId: 1, role: 'admin' }, '/user_role 3 viewer')).newRole, 'viewer');
  assert.equal((await handleUserCommand(store, { userId: 1, role: 'admin' }, '/user_role 99 viewer')).event, 'usage');
  assert.ok((await handleUserCommand(store, { userId: 1, role: 'admin' }, '/users')).text.includes('3'));
  assert.equal((await handleUserCommand(store, { userId: 1, role: 'admin' }, '/user_remove 1')).event, 'user_remove_failed');
  assert.equal((await handleUserCommand(store, { userId: 1, role: 'admin' }, '/user_remove 3')).event, 'user_remove');
  assert.equal(store.roleOf(3), null);
  assert.equal(await handleUserCommand(store, { userId: 1, role: 'admin' }, 'سجل مصروف 500'), null);
  assert.equal(normalizeRole('ADMIN'), 'admin');
});

await test('rate limiter: per-minute and per-hour windows', () => {
  let t = 0;
  const rl = createRateLimiter({ now: () => t });
  const lim = { perMinute: 3, perHour: 5 };
  for (let i = 0; i < 3; i++) assert.equal(rl.hit('u', lim).ok, true);
  const blocked = rl.hit('u', lim);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSec >= 1 && blocked.retryAfterSec <= 60);
  assert.equal(rl.hit('other', lim).ok, true, 'per user');
  t = 61_000;
  assert.equal(rl.hit('u', lim).ok, true);
  assert.equal(rl.hit('u', lim).ok, true);
  t = 125_000;
  assert.equal(rl.hit('u', lim).ok, false, 'hour cap (5)');
  t = 3_700_000;
  assert.equal(rl.hit('u', lim).ok, true, 'hour window slides');
});

await test('audit log: allow-listed fields only, no text/amounts, rotates', () => {
  const file = path.join(tmp(), 'audit.log');
  const audit = createAuditLog({ filePath: file, maxBytes: 400 });
  audit({ event: 'tool_call', uid: 5, role: 'accountant', tool: 'add_expense_draft', text: 'سجل مصروف 9999', amount: 9999, password: 'x' });
  const line = JSON.parse(fs.readFileSync(file, 'utf8').trim());
  assert.equal(line.event, 'tool_call');
  assert.equal(line.tool, 'add_expense_draft');
  assert.equal(line.text, undefined);
  assert.equal(line.amount, undefined);
  assert.equal(line.password, undefined);
  assert.ok(line.ts);
  for (let i = 0; i < 20; i++) audit({ event: 'message', uid: i, kind: 'text' });
  assert.ok(fs.existsSync(`${file}.1`), 'rotated');
  assert.ok(fs.statSync(file).size <= 800);
});

await test('message kind/command for audit without content', () => {
  assert.equal(messageKind({ text: '/users' }), 'command');
  assert.equal(messageKind({ text: 'تقرير' }), 'text');
  assert.equal(messageKind({ voice: {} }), 'voice');
  assert.equal(messageKind({ contact: {} }), 'contact');
  assert.equal(commandName({ text: '/user_add 5 admin' }), 'user_add');
  assert.equal(commandName({ text: 'hello' }), null);
});

// ---- مخزن قاعدة البيانات (fetch مزيّف بجدول في الذاكرة) ----
function fakeTable({ missing = false } = {}) {
  const rows = new Map();
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({ method: init.method || 'GET', path: u.pathname, auth: init.headers?.Authorization });
    if (missing) return new Response('{"message":"relation does not exist"}', { status: 404 });
    if (!init.method || init.method === 'GET') return Response.json([...rows.values()]);
    if (init.method === 'POST') { for (const r of JSON.parse(init.body)) rows.set(String(r.telegram_id), { ...rows.get(String(r.telegram_id)), ...r }); return new Response(null, { status: 201 }); }
    if (init.method === 'DELETE') { rows.delete(u.searchParams.get('telegram_id').replace('eq.', '')); return new Response(null, { status: 204 }); }
    return new Response(null, { status: 400 });
  };
  return { rows, calls, fetchImpl };
}

await test('db store: migrates file users once, reads roles, service key only', async () => {
  const fileStore = createUserStore({ filePath: path.join(tmp(), 'u.json'), seedAdminIds: [111] });
  fileStore.upsert('222', 'engineer');
  const t = fakeTable();
  const store = createDbUserStore({ supabaseUrl: 'https://x.supabase.co', serviceKey: 'service-key-for-test', fileStore, fetchImpl: t.fetchImpl });
  assert.equal(await store.ensureFresh(), true);
  assert.equal(store.source(), 'db');
  assert.equal(t.rows.size, 2, 'migrated');
  assert.equal(store.roleOf(111), 'admin');
  assert.equal(store.roleOf(222), 'engineer');
  assert.ok(t.calls.every(c => c.path === '/rest/v1/copilot_telegram_users' && c.auth === 'Bearer service-key-for-test'));
});

await test('db store: upsert/remove with last-admin protection; web edits seen after TTL', async () => {
  let clock = 0;
  const t = fakeTable();
  t.rows.set('1', { telegram_id: 1, role: 'admin', name: 'A' });
  const store = createDbUserStore({ supabaseUrl: 'https://x.supabase.co', serviceKey: 'service-key-for-test', fetchImpl: t.fetchImpl, now: () => clock, ttlMs: 30_000 });
  await store.ensureFresh();
  assert.equal((await store.upsert('5', 'محاسب', { name: 'م', by: 1 })).ok, true);
  assert.equal(store.roleOf(5), 'accountant');
  assert.equal(t.rows.get('5').added_by, 'telegram:1');
  assert.equal((await store.upsert('1', 'viewer')).ok, false);
  assert.equal((await store.remove('1')).ok, false);
  assert.equal((await store.remove('5')).ok, true);
  assert.equal(store.roleOf(5), null);
  // تعديل من صفحة السيستم مباشرة في الجدول
  t.rows.set('9', { telegram_id: 9, role: 'viewer' });
  await store.ensureFresh();
  assert.equal(store.roleOf(9), null, 'cached');
  clock = 31_000;
  await store.ensureFresh();
  assert.equal(store.roleOf(9), 'viewer', 'refreshed');
  // handleUserCommand شغال مع المخزن ده
  assert.equal((await handleUserCommand(store, { userId: 1, role: 'admin' }, '/user_add 10 مهندس')).event, 'user_upsert');
  assert.equal(store.roleOf(10), 'engineer');
});

await test('db store: falls back to the file when the table is missing or no service key', async () => {
  const fileStore = createUserStore({ filePath: path.join(tmp(), 'u.json'), seedAdminIds: [111] });
  const missing = createDbUserStore({ supabaseUrl: 'https://x.supabase.co', serviceKey: 'service-key-for-test', fileStore, fetchImpl: fakeTable({ missing: true }).fetchImpl });
  assert.equal(await missing.ensureFresh(), false);
  assert.equal(missing.source(), 'file');
  assert.equal(missing.roleOf(111), 'admin');
  assert.equal((await missing.upsert('7', 'viewer')).ok, true);
  assert.equal(fileStore.roleOf(7), 'viewer');
  const nokey = createDbUserStore({ supabaseUrl: 'https://x.supabase.co', serviceKey: '', fileStore });
  assert.equal(await nokey.ensureFresh(), false);
  assert.equal(nokey.roleOf(111), 'admin');
  const badUrl = createDbUserStore({ supabaseUrl: 'http://evil.example.com', serviceKey: 'service-key-for-test', fileStore });
  assert.equal(badUrl.source(), 'file');
});

await test('db store: contact bootstrap writes the admin to the table', async () => {
  const fileStore = createUserStore({ filePath: path.join(tmp(), 'u.json'), seedAdminPhones: ['201558888744'] });
  const t = fakeTable();
  t.rows.set('3', { telegram_id: 3, role: 'viewer' });
  const store = createDbUserStore({ supabaseUrl: 'https://x.supabase.co', serviceKey: 'service-key-for-test', fileStore, fetchImpl: t.fetchImpl });
  await store.ensureFresh();
  const msg = { chat: { type: 'private', id: 900 }, from: { id: 900, is_bot: false, first_name: 'Alreef' }, contact: { user_id: 900, phone_number: '+201558888744' } };
  assert.equal((await store.claimAdminByContact(msg)).ok, true);
  assert.equal(t.rows.get('900').role, 'admin');
  assert.equal(store.roleOf(900), 'admin');
  assert.equal(store.bootstrapPending(), false);
});

console.log(`copilot-access-control: ${passed} tests OK`);
