// 🔐 صلاحيات مستخدمي تلغرام + حد الطلبات + سجل التدقيق.
// كل مستخدم لازم يكون متسجل برقمه في تلغرام (user id) ودوره في work/copilot_users.json
// (في work/ لأنه متجاهَل في git — فيه أرقام تلغرام وموبايلات).
// الدور بيقلّص صلاحيات الوصول (access) قبل ما توصل لأي أداة، فبيتطبّق في نقطة واحدة:
// الأدوات اللي النموذج بيشوفها، أقسام التقارير (الأجور والفلوس)، الكتابة، الأزرار، والأوامر الإدارية.
import fs from 'fs';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
export const USERS_PATH = path.join(rootDir, 'work', 'copilot_users.json');
export const AUDIT_PATH = path.join(rootDir, 'work', 'copilot_audit.log');

const READ_TOOLS = ['get_labor_daily_logs', 'get_engineering_checklist_and_specs', 'get_tareeha_deficits', 'get_all_projects_and_villas', 'get_daily_comprehensive_report'];
const V = ['view'];
const VCE = ['view', 'create', 'edit'];

// الأدوات مسموحة بالاسم (رفض افتراضي لأي أداة جديدة لحد ما تتضاف هنا). المدير = كل حاجة.
export const ROLES = Object.freeze({
  admin: { label: 'مدير', all: true },
  accountant: {
    label: 'محاسب',
    tools: [...READ_TOOLS, 'get_worker_month_statement', 'add_labor_daily_log_draft', 'add_expense_draft', 'add_payment_voucher_draft',
      'add_journal_entry_draft', 'add_job_order_draft', 'add_partner', 'update_operation_draft', 'link_expense_job_order'],
    modules: { labor_logs: VCE, laborcost: V, projects: V, expenses: VCE, payments: VCE, journal: VCE, partners: VCE, violations: V, sub_claims: V, subclaims: V, receipts: V, inventory: V },
    callbacks: ['any', 'write', 'finance'],
  },
  engineer: {
    label: 'مهندس موقع',
    tools: [...READ_TOOLS, 'get_worker_month_statement', 'add_labor_daily_log_draft', 'add_job_order_draft'],
    modules: { labor_logs: VCE, projects: V, partners: V, sub_claims: V, subclaims: V, inventory: V },
    callbacks: ['any', 'write'],
  },
  viewer: {
    label: 'قراءة فقط',
    tools: [...READ_TOOLS],
    modules: { labor_logs: V, projects: V },
    callbacks: ['any'],
  },
});
export const ROLE_KEYS = Object.freeze(Object.keys(ROLES));
const ROLE_ALIASES = Object.freeze({
  admin: 'admin', 'مدير': 'admin', accountant: 'accountant', 'محاسب': 'accountant',
  engineer: 'engineer', 'مهندس': 'engineer', viewer: 'viewer', 'قراءة': 'viewer', 'مشاهد': 'viewer',
});
export const normalizeRole = (v) => ROLE_ALIASES[String(v ?? '').trim().toLowerCase()] ?? null;

export function isToolAllowed(role, toolName) {
  const r = ROLES[role];
  if (!r) return false;
  return r.all === true || r.tools.includes(toolName);
}

/** يقلّص الوصول حسب الدور. ما بيعدّلش الكائن الأصلي (ممكن يكون متخزّن في كاش). */
export function applyRoleToAccess(access, role) {
  if (!access) return access;
  const r = ROLES[role];
  if (!r) return null;
  if (r.all) return { ...access, telegramRole: role };
  const permissions = {};
  for (const [mod, wanted] of Object.entries(r.modules)) {
    let base;
    if (access.fullCompanyAccess === true) base = wanted;
    else {
      const raw = access.permissions?.[mod];
      base = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.keys(raw).filter(k => raw[k] === true) : [];
    }
    const allowed = wanted.filter(a => base.includes(a));
    if (allowed.length) permissions[mod] = allowed;
  }
  return { ...access, fullCompanyAccess: false, permissions, telegramRole: role };
}

// ---- الأزرار: كل بادئة ليها مستوى مطلوب. أي بادئة مش معروفة = للمدير بس. ----
const CALLBACK_LEVELS = [
  [/^(?:menu|report):/, 'any'],
  [/^cfm:/, 'any'], // التنفيذ نفسه بيتفحص بالأداة والدور، والتأكيد مربوط بصاحب الطلب
  [/^(?:op_approve|op_attach|op_delete|partner_type):/, 'write'],
  [/^(?:jo_pick:|alert:d:)/, 'finance'],
];
export function callbackLevel(data) {
  const d = String(data || '');
  for (const [re, level] of CALLBACK_LEVELS) if (re.test(d)) return level;
  return 'admin';
}
export function canUseCallback(role, data) {
  const r = ROLES[role];
  if (!r) return false;
  if (r.all) return true;
  return r.callbacks.includes(callbackLevel(data));
}

// ---- سياق المستخدم الحالي (عشان الحماية تشتغل جوه أي دالة من غير ما نمرّر الدور في كل مكان) ----
export const actorContext = new AsyncLocalStorage();
export const currentActor = () => actorContext.getStore() ?? null;

export class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.code = 'COPILOT_PROPOSAL_FORBIDDEN'; // نفس البادئة اللي البوت بيعرض رسالتها للمستخدم
  }
}

/** من غير سياق (جدولة/بدء التشغيل) = نظام ومسموح. جوه رسالة أو زر = المدير بس. */
export function requireAdmin(actionLabel) {
  const ctx = currentActor();
  if (!ctx) return;
  if (ctx.role !== 'admin') throw new ForbiddenError(`🔒 ${actionLabel} للمدير بس.`);
}

// ---- مخزن المستخدمين ----
const ID = /^[1-9]\d{0,15}$/;
const normPhone = (p) => String(p ?? '').replace(/[^\d]/g, '').replace(/^00/, '');
export const DEFAULT_LIMITS = Object.freeze({ perMinute: 12, perHour: 150 });

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const v = JSON.parse(fs.readFileSync(file, 'utf8'));
    return v && typeof v === 'object' ? v : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(`${file}.tmp`, file);
}

function normalizeStore(raw) {
  const users = {};
  for (const [id, u] of Object.entries(raw?.users ?? {})) {
    const role = normalizeRole(u?.role);
    if (ID.test(id) && role) users[id] = { role, name: String(u?.name ?? '').slice(0, 60), addedAt: u?.addedAt ?? null, addedBy: u?.addedBy ?? null };
  }
  const phones = Array.isArray(raw?.bootstrapAdminPhones) ? raw.bootstrapAdminPhones.map(normPhone).filter(p => p.length >= 8) : [];
  const lim = raw?.limits ?? {};
  const pos = (v, d) => (Number.isInteger(v) && v > 0 && v <= 10_000 ? v : d);
  return {
    users,
    bootstrapAdminPhones: [...new Set(phones)],
    limits: { perMinute: pos(lim.perMinute, DEFAULT_LIMITS.perMinute), perHour: pos(lim.perHour, DEFAULT_LIMITS.perHour) },
  };
}

/**
 * seedAdminIds: أرقام تلغرام تتسجل مدير لو الملف مش موجود (مثلاً الشات الخاص المضبوط في الإعدادات).
 * seedAdminPhones: أرقام موبايل تقدر تسجّل نفسها مدير مرة واحدة بمشاركة كارت الاتصال بتاعها هي.
 */
export function createUserStore({ filePath = USERS_PATH, seedAdminIds = [], seedAdminPhones = [], now = () => new Date() } = {}) {
  let cache = null;
  let cacheMtime = -1;
  const load = () => {
    let mtime = -2;
    try { mtime = fs.statSync(filePath).mtimeMs; } catch {}
    if (cache && mtime === cacheMtime) return cache;
    if (mtime === -2) {
      const users = {};
      for (const id of seedAdminIds) if (ID.test(String(id))) users[String(id)] = { role: 'admin', name: 'مدير (من إعدادات الشات)', addedAt: now().toISOString(), addedBy: 'seed' };
      cache = normalizeStore({ users, bootstrapAdminPhones: seedAdminPhones });
      try { writeJson(filePath, cache); mtime = fs.statSync(filePath).mtimeMs; } catch {}
    } else {
      cache = normalizeStore(readJson(filePath, {}));
      // ملف موجود من غير أي مدير (مثلاً اتعمل بأرقام موبايل بس): الشات الخاص المضبوط في الإعدادات يتسجل مدير.
      const seeds = seedAdminIds.map(String).filter(id => ID.test(id));
      if (seeds.length && !Object.values(cache.users).some(u => u.role === 'admin')) {
        for (const id of seeds) cache.users[id] = { role: 'admin', name: 'مدير (من إعدادات الشات)', addedAt: now().toISOString(), addedBy: 'seed' };
        try { writeJson(filePath, cache); mtime = fs.statSync(filePath).mtimeMs; } catch {}
      }
    }
    cacheMtime = mtime;
    return cache;
  };
  const save = (data) => {
    cache = normalizeStore(data);
    writeJson(filePath, cache);
    try { cacheMtime = fs.statSync(filePath).mtimeMs; } catch { cacheMtime = -1; }
  };
  const adminCount = (d) => Object.values(d.users).filter(u => u.role === 'admin').length;

  return {
    roleOf(userId) {
      if (!Number.isSafeInteger(userId) || userId <= 0) return null;
      return load().users[String(userId)]?.role ?? null;
    },
    list: () => Object.entries(load().users).map(([id, u]) => ({ id, ...u })),
    bootstrapPending: () => load().bootstrapAdminPhones.length > 0,
    limits: () => load().limits,
    upsert(userId, role, { name = '', by = null } = {}) {
      const r = normalizeRole(role);
      const id = String(userId);
      if (!ID.test(id) || !r) return { ok: false, error: 'رقم أو دور غير صحيح.' };
      const d = structuredClone(load());
      if (d.users[id]?.role === 'admin' && r !== 'admin' && adminCount(d) <= 1) return { ok: false, error: 'ده آخر مدير — ضيف مدير تاني الأول.' };
      d.users[id] = { role: r, name: String(name || d.users[id]?.name || '').slice(0, 60), addedAt: d.users[id]?.addedAt ?? now().toISOString(), addedBy: by };
      save(d);
      return { ok: true, role: r };
    },
    remove(userId) {
      const id = String(userId);
      const d = structuredClone(load());
      if (!d.users[id]) return { ok: false, error: 'المستخدم مش موجود.' };
      if (d.users[id].role === 'admin' && adminCount(d) <= 1) return { ok: false, error: 'ده آخر مدير — مش هينفع يتشال.' };
      delete d.users[id];
      save(d);
      return { ok: true };
    },
    /** تسجيل مدير بمشاركة كارت الاتصال بتاع الشخص نفسه، لرقم موجود في bootstrapAdminPhones (مرة واحدة). */
    claimAdminByContact(message) {
      const c = message?.contact;
      const from = message?.from;
      if (!c || !from || from.is_bot || message.chat?.type !== 'private') return { ok: false };
      if (!Number.isSafeInteger(c.user_id) || c.user_id !== from.id) return { ok: false, reason: 'not_own' };
      const d = structuredClone(load());
      const phone = normPhone(c.phone_number);
      if (!phone || !d.bootstrapAdminPhones.includes(phone)) return { ok: false, reason: 'not_listed' };
      d.users[String(from.id)] = { role: 'admin', name: String(from.first_name || 'مدير').slice(0, 60), addedAt: now().toISOString(), addedBy: 'contact-bootstrap' };
      d.bootstrapAdminPhones = d.bootstrapAdminPhones.filter(p => p !== phone);
      save(d);
      return { ok: true };
    },
  };
}

// ---- أوامر إدارة المستخدمين (/whoami لأي حد، الباقي للمدير) ----
export function handleUserCommand(store, { userId, role, firstName }, text) {
  const t = String(text || '').trim().replace(/^(\/[a-z_]+)@[a-z0-9_]+/i, '$1');
  if (/^\/whoami$/i.test(t)) {
    return { text: `🪪 رقمك في تلغرام: ${userId}\nالدور: ${role ? ROLES[role].label : 'مش متسجّل'}`, event: 'whoami' };
  }
  const m = /^\/(users|user_add|user_role|user_remove)(?:\s+([\s\S]*))?$/i.exec(t);
  if (!m) return null;
  if (role !== 'admin') return { text: '🔒 إدارة المستخدمين للمدير بس.', event: 'denied_admin_command' };
  const cmd = m[1].toLowerCase();
  const args = (m[2] || '').trim().split(/\s+/).filter(Boolean);
  const roleHelp = `الأدوار: ${ROLE_KEYS.map(k => `${k} (${ROLES[k].label})`).join('، ')}`;
  if (cmd === 'users') {
    const rows = store.list().map(u => `• ${u.id} — ${ROLES[u.role].label}${u.name ? ` — ${u.name}` : ''}`);
    return { text: ['👥 المستخدمين المسجلين:', ...(rows.length ? rows : ['(مفيش)']), '', 'إضافة: /user_add <رقم> <دور> [اسم]', 'تغيير: /user_role <رقم> <دور>', 'حذف: /user_remove <رقم>', roleHelp].join('\n'), event: 'users_list' };
  }
  if (cmd === 'user_add' || cmd === 'user_role') {
    const [id, r, ...name] = args;
    if (!id || !r) return { text: `الصيغة: /${cmd} <رقم تلغرام> <دور>${cmd === 'user_add' ? ' [اسم]' : ''}\n${roleHelp}\n(الشخص يعرف رقمه بإرسال /whoami للبوت)`, event: 'usage' };
    if (cmd === 'user_role' && !store.list().some(u => u.id === id)) return { text: 'المستخدم مش موجود. استخدم /user_add.', event: 'usage' };
    const res = store.upsert(id, r, { name: name.join(' '), by: String(userId) });
    return res.ok
      ? { text: `✅ ${id} بقى «${ROLES[res.role].label}».`, event: 'user_upsert', target: id, newRole: res.role }
      : { text: `⚠️ ${res.error}\n${roleHelp}`, event: 'user_upsert_failed' };
  }
  const [id] = args;
  if (!id) return { text: 'الصيغة: /user_remove <رقم تلغرام>', event: 'usage' };
  if (id === String(userId)) return { text: '⚠️ مش هينفع تشيل نفسك. خلّي مدير تاني يعملها.', event: 'user_remove_failed' };
  const res = store.remove(id);
  return res.ok ? { text: `🗑️ اتشال ${id}.`, event: 'user_remove', target: id } : { text: `⚠️ ${res.error}`, event: 'user_remove_failed' };
}

// ---- حد الطلبات (نافذة منزلقة لكل مستخدم، في الذاكرة) ----
export function createRateLimiter({ now = Date.now, maxUsers = 2000 } = {}) {
  const hits = new Map();
  return {
    hit(key, { perMinute, perHour }) {
      const t = now();
      const arr = (hits.get(key) ?? []).filter(x => t - x < 3_600_000);
      const lastMinute = arr.filter(x => t - x < 60_000);
      if (lastMinute.length >= perMinute) {
        hits.set(key, arr);
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((lastMinute[0] + 60_000 - t) / 1000)) };
      }
      if (arr.length >= perHour) {
        hits.set(key, arr);
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((arr[0] + 3_600_000 - t) / 1000)) };
      }
      arr.push(t);
      hits.delete(key);
      hits.set(key, arr);
      if (hits.size > maxUsers) hits.delete(hits.keys().next().value);
      return { ok: true };
    },
  };
}

// ---- سجل التدقيق (JSONL). من غير نصوص الرسائل أو المبالغ أو أي أسرار. ----
const SAFE_FIELDS = new Set(['event', 'uid', 'role', 'chat', 'tool', 'tools', 'status', 'kind', 'command', 'target', 'newRole', 'level', 'count', 'reason']);
export function createAuditLog({ filePath = AUDIT_PATH, maxBytes = 2 * 1024 * 1024, now = () => new Date() } = {}) {
  return function audit(entry = {}) {
    try {
      const out = { ts: now().toISOString() };
      for (const [k, v] of Object.entries(entry)) {
        if (!SAFE_FIELDS.has(k) || v === undefined || v === null) continue;
        if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
        else if (Array.isArray(v)) out[k] = v.slice(0, 20).map(x => String(x).slice(0, 60));
        else out[k] = String(v).slice(0, 80);
      }
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      try {
        if (fs.statSync(filePath).size > maxBytes) fs.renameSync(filePath, `${filePath}.1`);
      } catch {}
      fs.appendFileSync(filePath, JSON.stringify(out) + '\n', 'utf8');
      return true;
    } catch {
      return false;
    }
  };
}

/** نوع الرسالة للسجل من غير محتواها. */
export function messageKind(msg) {
  if (!msg) return 'unknown';
  if (typeof msg.text === 'string') return msg.text.trim().startsWith('/') ? 'command' : 'text';
  if (msg.voice || msg.audio) return 'voice';
  if (msg.photo) return 'photo';
  if (msg.document) return 'document';
  if (msg.contact) return 'contact';
  return 'other';
}
export const commandName = (msg) => (typeof msg?.text === 'string' ? (/^\/([a-z_]{1,32})/i.exec(msg.text.trim())?.[1]?.toLowerCase() ?? null) : null);
