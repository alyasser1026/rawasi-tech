// 📅 التقارير المجدولة (صباحي / أسبوعي / شهري) — منطق قابل للاختبار بدون تلغرام أو قاعدة بيانات.
// التقرير اليومي الأصلي (startDailyReportScheduler) كما هو. هنا الإضافات فقط، وكلها مطفية افتراضيًا.
//   config/copilot_report_schedule.json  (تشغيل/إيقاف + أوقات)
//   work/copilot_report_state.json       (آخر فترة اتبعتت لكل نوع — بيمنع التكرار بعد إعادة التشغيل)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
export const REPORT_SCHEDULE_PATH = path.join(rootDir, 'config', 'copilot_report_schedule.json');
export const REPORT_STATE_PATH = path.join(rootDir, 'work', 'copilot_report_state.json');

const DAY_MS = 86_400_000;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
// لو البوت كان مقفول وقت التقرير، نبعته لو لسه جوه النافذة دي بعد الميعاد.
export const CATCH_UP_WINDOW_MINUTES = 180;
export const THURSDAY = 4; // 0 = الأحد
export const WEEKLY_WEEKDAY = THURSDAY;
export const MONTHLY_DAY = 1;

export const REPORT_KINDS = Object.freeze({
  morning: { label: 'الملخص الصباحي (تقرير امبارح)', icon: '🌅', presets: ['06:30', '07:00', '07:30', '08:00', '09:00'], defaultTime: '07:30' },
  weekly: { label: 'التقرير الأسبوعي (الخميس)', icon: '📅', presets: ['16:00', '18:00', '20:00', '21:00'], defaultTime: '18:00' },
  monthly: { label: 'التقرير الشهري (أول الشهر)', icon: '🗓️', presets: ['08:00', '09:00', '10:00', '12:00'], defaultTime: '09:00' },
});
export const REPORT_KIND_KEYS = Object.freeze(Object.keys(REPORT_KINDS));

export function normalizeScheduleSettings(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const k of REPORT_KIND_KEYS) {
    out[k] = {
      enabled: r[k]?.enabled === true, // مطفي افتراضيًا
      time: HHMM.test(r[k]?.time) ? r[k].time : REPORT_KINDS[k].defaultTime,
    };
  }
  return out;
}

// ---- حسابات التاريخ بتوقيت الرياض (UTC+3 ثابت، من غير توقيت صيفي) ----
export function riyadhParts(now = new Date()) {
  const d = new Date(now.getTime() + 3 * 3_600_000);
  const iso = d.toISOString();
  return { date: iso.slice(0, 10), hhmm: iso.slice(11, 16), weekday: d.getUTCDay(), day: d.getUTCDate() };
}

export function shiftDate(dateStr, days) {
  return new Date(Date.parse(`${dateStr}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function previousMonthRange(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const start = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
  const end = shiftDate(`${y}-${String(m).padStart(2, '0')}-01`, -1);
  return { start, end, key: start.slice(0, 7) };
}

// الأسبوع = آخر 7 أيام تنتهي النهارده (الخميس) — السبت لحد الخميس.
export function weeklyRange(dateStr) {
  const start = shiftDate(dateStr, -6);
  return { start, end: dateStr, key: `${start}_${dateStr}` };
}

const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// لو التقرير مستحق دلوقتي بيرجع { kind, key, ...الفترة }. الفترة مفتاحها بيمنع التكرار.
export function dueReport(kind, settings, now, lastSentKey) {
  const cfg = normalizeScheduleSettings(settings)[kind];
  if (!cfg?.enabled) return null;
  const p = riyadhParts(now);
  const elapsed = minutes(p.hhmm) - minutes(cfg.time);
  if (elapsed < 0 || elapsed > CATCH_UP_WINDOW_MINUTES) return null;
  let period;
  if (kind === 'morning') {
    const y = shiftDate(p.date, -1);
    period = { start: y, end: y, key: y };
  } else if (kind === 'weekly') {
    if (p.weekday !== WEEKLY_WEEKDAY) return null;
    period = weeklyRange(p.date);
  } else if (kind === 'monthly') {
    if (p.day !== MONTHLY_DAY) return null;
    period = previousMonthRange(p.date);
  } else return null;
  if (lastSentKey === period.key) return null;
  return { kind, ...period };
}

const money = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const NA = 'غير متاح بالصلاحية الحالية';

export function formatPeriodSummary(data, kind, companyLabel = '') {
  const title = kind === 'monthly' ? `التقرير الشهري (${data.start.slice(0, 7)})` : 'التقرير الأسبوعي';
  const icon = REPORT_KINDS[kind]?.icon || '📊';
  const lines = [
    `${icon} ${title}${companyLabel ? ` — ${companyLabel}` : ''}`,
    `📆 من ${data.start} إلى ${data.end}`,
    '────────────────────────────',
  ];
  const warn = (sec) => (sec?.truncated ? ' ⚠️ (الأرقام جزئية: العدد كبير)' : '');
  const L = data.labor;
  lines.push(L?.available
    ? `👷 العمالة: ${L.logs} سجل | ${L.workers} عامل | ${money(L.worker_days)} يوم حضور على ${L.days_with_work} يوم${L.wages != null ? ` | أجور ${money(L.wages)}` : ''}${warn(L)}`
    : `👷 العمالة: ${NA}`);
  const E = data.expenses;
  lines.push(E?.available ? `💸 المصروفات: ${E.count} مصروف | الإجمالي ${money(E.total)}${warn(E)}` : `💸 المصروفات: ${NA}`);
  const V = data.vouchers;
  lines.push(V?.available ? `🧾 سندات الصرف: ${V.count} سند | الإجمالي ${money(V.total)}${warn(V)}` : `🧾 سندات الصرف: ${NA}`);
  const C = data.claims;
  lines.push(C?.available ? `📑 المستخلصات: ${C.count} | الصافي ${money(C.net)} | المدفوع ${money(C.paid)}${warn(C)}` : `📑 المستخلصات: ${NA}`);
  const J = data.jobOrders;
  lines.push(J?.available ? `📋 أوامر شغل جديدة: ${J.created} (منها جاري التنفيذ ${J.active})${warn(J)}` : `📋 أوامر الشغل: ${NA}`);
  return lines.join('\n');
}

// ---- العرض والأزرار ----
export function applyScheduleConfig(settings, cfg) {
  const s = normalizeScheduleSettings(settings);
  if (cfg?.action === 'toggle') return { ...s, [cfg.kind]: { ...s[cfg.kind], enabled: !s[cfg.kind].enabled } };
  if (cfg?.action === 'time') {
    const list = REPORT_KINDS[cfg.kind].presets;
    const i = list.indexOf(s[cfg.kind].time);
    return { ...s, [cfg.kind]: { ...s[cfg.kind], time: list[(i + 1) % list.length] } };
  }
  return s;
}

export function resolveScheduleCallback(data) {
  const m = /^sched_cfg:(show|t|tm)(?::([a-z]{1,20}))?$/.exec(String(data || ''));
  if (!m) return null;
  if (m[1] === 'show') return m[2] ? null : { action: 'show' };
  if (!REPORT_KIND_KEYS.includes(m[2])) return null;
  return { action: m[1] === 't' ? 'toggle' : 'time', kind: m[2] };
}

export function buildScheduleSettingsView(settings) {
  const s = normalizeScheduleSettings(settings);
  const text = [
    '📅 التقارير المجدولة',
    '━━━━━━━━━━━━━━━━━━━━',
    ...REPORT_KIND_KEYS.map(k => `${REPORT_KINDS[k].icon} ${REPORT_KINDS[k].label}: ${s[k].enabled ? `✅ ${s[k].time}` : '⛔ مطفي'}`),
    'المواعيد بتوقيت الرياض. التقرير اليومي الأساسي له إعداده الخاص.',
  ].join('\n');
  return {
    text,
    replyMarkup: {
      inline_keyboard: REPORT_KIND_KEYS.map(k => [
        { text: `${s[k].enabled ? '✅' : '⛔'} ${REPORT_KINDS[k].icon} ${k === 'morning' ? 'صباحي' : k === 'weekly' ? 'أسبوعي' : 'شهري'}`, callback_data: `sched_cfg:t:${k}` },
        { text: `🕒 ${s[k].time}`, callback_data: `sched_cfg:tm:${k}` },
      ]),
    },
  };
}

// ---- التخزين ----
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
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(`${file}.tmp`, file);
    return true;
  } catch {
    return false;
  }
}

export function createReportScheduleStore({ settingsPath = REPORT_SCHEDULE_PATH, statePath = REPORT_STATE_PATH } = {}) {
  return {
    getSettings: () => normalizeScheduleSettings(readJson(settingsPath, {})),
    saveSettings: (s) => writeJson(settingsPath, normalizeScheduleSettings(s)),
    getLastKey: (kind) => {
      const v = readJson(statePath, {})[kind];
      return typeof v === 'string' ? v : null;
    },
    markSent: (kind, key) => writeJson(statePath, { ...readJson(statePath, {}), [kind]: key }),
  };
}

// ---- المشغّل ----
export function createScheduledReportRunner({ store, resolveAccess, makeTools, hasPermission, getDailyReport, send, companyLabel = () => '', now = () => new Date() }) {
  let running = false;
  const permissionsFor = (access) => ({
    labor_logs: hasPermission(access, 'labor_logs', 'view'),
    laborcost: hasPermission(access, 'laborcost', 'view'),
    expenses: hasPermission(access, 'expenses', 'view'),
    payments: hasPermission(access, 'payments', 'view'),
    contractors: hasPermission(access, 'sub_claims', 'view') || hasPermission(access, 'subclaims', 'view') || hasPermission(access, 'projects', 'view'),
  });

  async function deliver(actor, due) {
    const access = await resolveAccess(actor);
    if (!access) return false;
    if (due.kind === 'morning') {
      const parts = await getDailyReport(due.start, access);
      if (!Array.isArray(parts) || parts.length === 0) return false;
      const head = `${REPORT_KINDS.morning.icon} الملخص الصباحي — تقرير امبارح (${due.start})\n────────────────────────────\n`;
      for (let i = 0; i < parts.length; i++) {
        const last = i === parts.length - 1;
        const res = await send(actor.chatId, (i === 0 ? head : '') + parts[i], last ? 'followup' : undefined);
        if (res?.ok === false) return false;
      }
      return true;
    }
    const data = await makeTools(access).get_period_summary({ start_date: due.start, end_date: due.end, permissions: permissionsFor(access) });
    if (data?.success !== true) return false;
    const res = await send(actor.chatId, formatPeriodSummary(data, due.kind, companyLabel(access)), 'followup');
    return res?.ok !== false;
  }

  async function tick(actor) {
    if (running) return [];
    const settings = store.getSettings();
    if (!REPORT_KIND_KEYS.some(k => settings[k].enabled)) return [];
    running = true;
    const sent = [];
    try {
      const at = now();
      for (const kind of REPORT_KIND_KEYS) {
        const due = dueReport(kind, settings, at, store.getLastKey(kind));
        if (!due) continue;
        if (await deliver(actor, due)) {
          store.markSent(kind, due.key);
          sent.push(`${kind}:${due.key}`);
        }
      }
    } finally {
      running = false;
    }
    return sent;
  }

  async function handleCallback({ data, chatId, answerCb, editMessage }) {
    const cfg = resolveScheduleCallback(data);
    if (!cfg) return false;
    if (cfg.action === 'show') {
      await answerCb('📅');
      const view = buildScheduleSettingsView(store.getSettings());
      await send(chatId, view.text, view.replyMarkup);
      return true;
    }
    const updated = applyScheduleConfig(store.getSettings(), cfg);
    store.saveSettings(updated);
    await answerCb('✅ اتحفظ');
    const view = buildScheduleSettingsView(updated);
    await editMessage(view.text, view.replyMarkup);
    return true;
  }

  return { tick, handleCallback, permissionsFor, deliver };
}
