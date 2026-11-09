// 🔔 التنبيهات الاستباقية للبوت — منطق نقي قابل للاختبار (بدون تلغرام أو قاعدة بيانات).
// الإعدادات والحالة في ملفات مستقلة عن إعدادات البوت العامة:
//   config/copilot_alert_settings.json  (تشغيل/إيقاف كل نوع + الحدود)
//   work/copilot_alert_state.json       (آخر إرسال لكل تنبيه + تفاصيل آخر التنبيهات لزر «تفاصيل»)
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
export const ALERT_SETTINGS_PATH = path.join(rootDir, 'config', 'copilot_alert_settings.json');
export const ALERT_STATE_PATH = path.join(rootDir, 'work', 'copilot_alert_state.json');

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export const ALERT_TYPES = Object.freeze({
  overdue_claim: { label: 'مستخلص مقاول متأخر', icon: '🧾' },
  low_treasury: { label: 'رصيد الخزنة منخفض', icon: '💰' },
  overdue_job_order: { label: 'أمر شغل تجاوز موعده', icon: '⏰' },
  large_transaction: { label: 'حركة مالية كبيرة', icon: '💸' },
});
export const ALERT_TYPE_KEYS = Object.freeze(Object.keys(ALERT_TYPES));

export const TREASURY_PRESETS = Object.freeze([2000, 5000, 10000, 20000, 50000]);
export const LARGE_TX_PRESETS = Object.freeze([2000, 5000, 10000, 25000, 50000]);
// مستخلص من غير مدة سداد مسجلة: نعتبر مهلته 30 يوم من تاريخه.
export const DEFAULT_CLAIM_PAYMENT_DAYS = 30;
// أقصى عدد تنبيهات منفصلة في الدورة الواحدة؛ الباقي يتجمع في رسالة ملخص.
export const MAX_ALERTS_PER_RUN = 5;

export const DEFAULT_ALERT_SETTINGS = Object.freeze({
  types: Object.freeze(Object.fromEntries(ALERT_TYPE_KEYS.map(k => [k, false]))), // كله مطفي افتراضيًا
  treasuryMin: 10000,
  largeTxMin: 5000,
  cooldownHours: 24,
  quietStart: '22:00',
  quietEnd: '07:00',
  checkEveryMinutes: 10,
});

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (v) => num(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
const clean = (v, max = 80) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function normalizeAlertSettings(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const types = {};
  for (const k of ALERT_TYPE_KEYS) types[k] = r.types?.[k] === true;
  const positive = (v, d, max) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(max, Number(v)) : d);
  return {
    types,
    treasuryMin: positive(r.treasuryMin, DEFAULT_ALERT_SETTINGS.treasuryMin, 10_000_000),
    largeTxMin: positive(r.largeTxMin, DEFAULT_ALERT_SETTINGS.largeTxMin, 10_000_000),
    cooldownHours: positive(r.cooldownHours, DEFAULT_ALERT_SETTINGS.cooldownHours, 24 * 30),
    quietStart: HHMM.test(r.quietStart) ? r.quietStart : DEFAULT_ALERT_SETTINGS.quietStart,
    quietEnd: HHMM.test(r.quietEnd) ? r.quietEnd : DEFAULT_ALERT_SETTINGS.quietEnd,
    checkEveryMinutes: Math.max(5, Math.round(positive(r.checkEveryMinutes, DEFAULT_ALERT_SETTINGS.checkEveryMinutes, 24 * 60))),
  };
}

export function enabledAlertTypes(settings) {
  return ALERT_TYPE_KEYS.filter(k => settings?.types?.[k] === true);
}

// ساعات الهدوء: تدعم فترة بتعدي نص الليل (22:00 → 07:00).
export function isQuietTime(hhmm, start, end) {
  if (!HHMM.test(hhmm) || !HHMM.test(start) || !HHMM.test(end) || start === end) return false;
  return start < end ? hhmm >= start && hhmm < end : hhmm >= start || hhmm < end;
}

export function alertId(key) {
  return createHash('sha256').update(String(key)).digest('hex').slice(0, 12);
}

function addDays(dateStr, days) {
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  return Number.isFinite(t) ? new Date(t + days * DAY_MS).toISOString().slice(0, 10) : null;
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function makeAlert(type, key, { emergency = false, summary, details }) {
  return { type, key, id: alertId(key), emergency, summary, details };
}

// يحوّل بيانات القراءة (get_proactive_alert_data) لقائمة تنبيهات حسب الإعدادات.
export function evaluateAlerts(data, settings, today) {
  const s = normalizeAlertSettings(settings);
  const alerts = [];
  if (!data || data.success !== true) return alerts;

  if (s.types.overdue_claim && data.claims?.available) {
    for (const c of data.claims.rows || []) {
      if (!c?.id || !c.date || c.status === 'مدفوع') continue;
      const remaining = num(c.net_amount) - num(c.paid_amount);
      if (remaining <= 0.01) continue;
      const period = Number.isInteger(c.payment_period_days) && c.payment_period_days >= 0
        ? c.payment_period_days : DEFAULT_CLAIM_PAYMENT_DAYS;
      const due = addDays(String(c.date).slice(0, 10), period);
      if (!due || due >= today) continue;
      const late = daysBetween(due, today);
      alerts.push(makeAlert('overdue_claim', `overdue_claim:${c.id}`, {
        summary: `المستخلص ${clean(c.claim_number, 30) || '—'} للمقاول ${clean(c.contractor_name) || 'غير محدد'} متأخر ${late} يوم — المتبقي ${money(remaining)}`,
        details: [
          `🧾 مستخلص: ${clean(c.claim_number, 30) || '—'}`,
          `👷 المقاول: ${clean(c.contractor_name) || 'غير محدد'}`,
          `🏗️ المشروع: ${clean(c.project, 120) || '—'}`,
          `📅 تاريخ المستخلص: ${String(c.date).slice(0, 10)} | مدة السداد: ${period} يوم${Number.isInteger(c.payment_period_days) ? '' : ' (افتراضي)'}`,
          `⏳ تاريخ الاستحقاق: ${due} (متأخر ${late} يوم)`,
          `💵 الصافي: ${money(c.net_amount)} | المدفوع: ${money(c.paid_amount)} | المتبقي: ${money(remaining)}`,
          `الحالة: ${clean(c.status, 30) || '—'}`,
        ].join('\n'),
      }));
    }
  }

  if (s.types.overdue_job_order && data.jobOrders?.available) {
    for (const o of data.jobOrders.rows || []) {
      if (!o?.id || !o.end_date || o.status !== 'جاري التنفيذ') continue;
      const end = String(o.end_date).slice(0, 10);
      if (end >= today) continue;
      const late = daysBetween(end, today);
      alerts.push(makeAlert('overdue_job_order', `overdue_job_order:${o.id}`, {
        summary: `أمر الشغل ${clean(o.order_number, 30) || '—'} (${clean(o.contractor_name) || 'تنفيذ ذاتي'}) عدّى موعده بـ ${late} يوم`,
        details: [
          `📋 أمر الشغل: ${clean(o.order_number, 30) || '—'}`,
          `👷 المنفذ: ${clean(o.contractor_name) || 'تنفيذ ذاتي'}`,
          `🏗️ المشروع: ${clean(o.project, 120) || '—'}`,
          `📅 البداية: ${o.start_date ? String(o.start_date).slice(0, 10) : '—'} | النهاية المخططة: ${end}`,
          `⏳ متأخر ${late} يوم وحالته لسه «جاري التنفيذ»`,
        ].join('\n'),
      }));
    }
  }

  if (s.types.low_treasury && data.treasury?.available && Number.isFinite(Number(data.treasury.balance))) {
    const bal = Number(data.treasury.balance);
    if (bal < s.treasuryMin) {
      const emergency = bal < 0;
      alerts.push(makeAlert('low_treasury', 'low_treasury:122', {
        emergency,
        summary: emergency
          ? `🚨 رصيد الخزنة بالسالب: ${money(bal)}`
          : `رصيد الخزنة ${money(bal)} — أقل من الحد ${money(s.treasuryMin)}`,
        details: [
          `💰 حساب: 122 الخزينة الرئيسية`,
          `الرصيد الحالي (القيود المرحّلة): ${money(bal)}`,
          `الحد المضبوط للتنبيه: ${money(s.treasuryMin)}`,
          emergency ? '🚨 الرصيد بالسالب — راجع القيود والمصروفات فورًا.' : 'راجع المصروفات المستحقة وموقف التحصيل.',
        ].join('\n'),
      }));
    }
  }

  if (s.types.large_transaction && data.transactions?.available) {
    for (const t of data.transactions.rows || []) {
      if (!t?.id || num(t.amount) < s.largeTxMin) continue;
      const kindLabel = t.kind === 'voucher' ? 'سند صرف' : 'مصروف';
      alerts.push(makeAlert('large_transaction', `large_transaction:${t.kind}:${t.id}`, {
        summary: `${kindLabel} بمبلغ ${money(t.amount)}${t.party ? ` — ${clean(t.party)}` : ''}`,
        details: [
          `💸 ${kindLabel}${t.number ? ` رقم ${clean(t.number, 30)}` : ''}`,
          `المبلغ: ${money(t.amount)} (الحد: ${money(s.largeTxMin)})`,
          `الطرف: ${clean(t.party) || '—'}`,
          `البيان: ${clean(t.description, 200) || '—'}`,
          `الموقع: ${clean(t.site, 60) || '—'} | التاريخ: ${t.date ? String(t.date).slice(0, 10) : '—'}`,
          `الحالة: ${t.is_posted ? 'مرحّل' : 'مسودة / غير مرحّل'}`,
        ].join('\n'),
      }));
    }
  }

  return alerts;
}

// يختار اللي يتبعت: منع التكرار + ساعات الهدوء (الطوارئ بس بتعدي) + حد أقصى للدورة.
export function selectAlertsToSend(alerts, { settings, wasSentRecently, nowMs, hhmm, ignoreQuietHours = false }) {
  const s = normalizeAlertSettings(settings);
  const cooldownMs = s.cooldownHours * HOUR_MS;
  const quiet = !ignoreQuietHours && isQuietTime(hhmm, s.quietStart, s.quietEnd);
  const eligible = [];
  let heldForQuiet = 0;
  for (const a of alerts) {
    if (s.types[a.type] !== true) continue;
    if (wasSentRecently(a.key, nowMs, cooldownMs)) continue;
    if (quiet && !a.emergency) { heldForQuiet++; continue; }
    eligible.push(a);
  }
  eligible.sort((x, y) => Number(y.emergency) - Number(x.emergency));
  return {
    send: eligible.slice(0, MAX_ALERTS_PER_RUN),
    overflow: eligible.slice(MAX_ALERTS_PER_RUN),
    heldForQuiet,
  };
}

export function formatAlertMessage(alert) {
  const t = ALERT_TYPES[alert.type] || { icon: '🔔', label: 'تنبيه' };
  return `${alert.emergency ? '🚨 تنبيه طارئ' : '🔔 تنبيه'} — ${t.icon} ${t.label}\n${alert.summary}`;
}

export function formatOverflowMessage(overflow) {
  const lines = [`🔔 فيه ${overflow.length} تنبيهات تانية:`];
  for (const a of overflow.slice(0, 15)) lines.push(`• ${a.summary}`);
  if (overflow.length > 15) lines.push(`… و${overflow.length - 15} كمان`);
  return lines.join('\n');
}

export function buildAlertMarkup(alert) {
  return {
    inline_keyboard: [[
      { text: '🔍 تفاصيل', callback_data: `alert:d:${alert.id}` },
      { text: '🔕 كتم النوع ده', callback_data: `alert:m:${alert.type}` },
    ]],
  };
}

export function resolveAlertCallback(data) {
  const m = /^alert:(d|m):([a-z0-9_]{1,40})$/.exec(String(data || ''));
  if (!m) return null;
  if (m[1] === 'm') return ALERT_TYPE_KEYS.includes(m[2]) ? { action: 'mute', type: m[2] } : null;
  return /^[0-9a-f]{12}$/.test(m[2]) ? { action: 'details', id: m[2] } : null;
}

function nextPreset(list, current) {
  const i = list.findIndex(v => v > current);
  return i === -1 ? list[0] : list[i];
}

export function resolveAlertConfigCallback(data) {
  const s = String(data || '');
  if (s === 'alert_cfg:show') return { action: 'show' };
  if (s === 'alert_cfg:run') return { action: 'run' };
  if (s === 'alert_cfg:th:treasury') return { action: 'threshold', which: 'treasury' };
  if (s === 'alert_cfg:th:large') return { action: 'threshold', which: 'large' };
  const m = /^alert_cfg:t:([a-z_]{1,40})$/.exec(s);
  if (m && ALERT_TYPE_KEYS.includes(m[1])) return { action: 'toggle', type: m[1] };
  return null;
}

export function applyAlertConfig(settings, cfg) {
  const s = normalizeAlertSettings(settings);
  if (cfg?.action === 'toggle') return { ...s, types: { ...s.types, [cfg.type]: !s.types[cfg.type] } };
  if (cfg?.action === 'threshold' && cfg.which === 'treasury') return { ...s, treasuryMin: nextPreset(TREASURY_PRESETS, s.treasuryMin) };
  if (cfg?.action === 'threshold' && cfg.which === 'large') return { ...s, largeTxMin: nextPreset(LARGE_TX_PRESETS, s.largeTxMin) };
  return s;
}

export function buildAlertSettingsView(settings) {
  const s = normalizeAlertSettings(settings);
  const onOff = (k) => (s.types[k] ? '✅ شغال' : '⛔ مطفي');
  const text = [
    '🔔 إعدادات التنبيهات الاستباقية',
    '━━━━━━━━━━━━━━━━━━━━',
    ...ALERT_TYPE_KEYS.map(k => `${ALERT_TYPES[k].icon} ${ALERT_TYPES[k].label}: ${onOff(k)}`),
    `💰 حد الخزنة: ${money(s.treasuryMin)} | 💸 حد الحركة الكبيرة: ${money(s.largeTxMin)}`,
    `🔁 نفس التنبيه ما يتكررش قبل ${s.cooldownHours} ساعة | الفحص كل ${s.checkEveryMinutes} دقايق`,
    `🌙 ساعات الهدوء: ${s.quietStart} → ${s.quietEnd} (الطوارئ بس)`,
  ].join('\n');
  const toggle = (k) => ({ text: `${s.types[k] ? '✅' : '⛔'} ${ALERT_TYPES[k].label}`, callback_data: `alert_cfg:t:${k}` });
  return {
    text,
    replyMarkup: {
      inline_keyboard: [
        [toggle('overdue_claim'), toggle('overdue_job_order')],
        [toggle('low_treasury'), toggle('large_transaction')],
        [
          { text: `💰 حد الخزنة: ${money(s.treasuryMin)}`, callback_data: 'alert_cfg:th:treasury' },
          { text: `💸 حد الحركة: ${money(s.largeTxMin)}`, callback_data: 'alert_cfg:th:large' },
        ],
        [{ text: '🔍 افحص دلوقتي', callback_data: 'alert_cfg:run' }],
      ],
    },
  };
}

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
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

// تخزين الإعدادات والحالة. المسارات قابلة للتغيير للاختبار.
export function createAlertStore({ settingsPath = ALERT_SETTINGS_PATH, statePath = ALERT_STATE_PATH, maxDetails = 100 } = {}) {
  const loadState = () => {
    const st = readJson(statePath, {});
    return {
      sent: st.sent && typeof st.sent === 'object' ? st.sent : {},
      details: Array.isArray(st.details) ? st.details : [],
    };
  };
  return {
    getSettings: () => normalizeAlertSettings(readJson(settingsPath, {})),
    saveSettings: (s) => writeJson(settingsPath, normalizeAlertSettings(s)),
    wasSentRecently(key, nowMs, cooldownMs) {
      const last = Number(loadState().sent[key]);
      return Number.isFinite(last) && nowMs - last < cooldownMs;
    },
    markSent(alerts, nowMs) {
      const st = loadState();
      for (const a of alerts) {
        st.sent[a.key] = nowMs;
        st.details = st.details.filter(d => d.id !== a.id);
        st.details.push({ id: a.id, type: a.type, details: a.details, at: nowMs });
      }
      // تنظيف: سجلات أقدم من 14 يوم + آخر N تفاصيل فقط
      for (const [k, t] of Object.entries(st.sent)) if (nowMs - Number(t) > 14 * DAY_MS) delete st.sent[k];
      st.details = st.details.slice(-maxDetails);
      return writeJson(statePath, st);
    },
    getDetails(id) {
      return loadState().details.find(d => d.id === id) || null;
    },
  };
}

// 🏃 مشغّل التنبيهات: بيربط المنطق ده بالبوت عن طريق دوال بتتمرر له (عشان يفضل قابل للاختبار
// ولأن ملف telegram-copilot.mjs بيتعدّل من أكتر من جلسة — التعديل هناك سطور قليلة بس).
export function createAlertRunner({ store, resolveAccess, makeTools, hasPermission, send, getDate, getHHMM, now = Date.now }) {
  let lastRunMs = 0;
  let running = false;

  const permissionsFor = (access) => ({
    contractors: hasPermission(access, 'sub_claims', 'view') || hasPermission(access, 'subclaims', 'view') || hasPermission(access, 'projects', 'view'),
    journal: hasPermission(access, 'journal', 'view'),
    expenses: hasPermission(access, 'expenses', 'view'),
    payments: hasPermission(access, 'payments', 'view'),
  });

  async function check(actor, { manual = false } = {}) {
    const settings = store.getSettings();
    const types = enabledAlertTypes(settings);
    if (types.length === 0) return { ok: true, disabled: true, sent: 0 };
    if (running) return { ok: false, busy: true, sent: 0 };
    running = true;
    try {
      const access = await resolveAccess(actor);
      if (!access) return { ok: false, noAccess: true, sent: 0 };
      const tools = makeTools(access);
      const data = await tools.get_proactive_alert_data({
        types,
        large_tx_min: settings.largeTxMin,
        permissions: permissionsFor(access),
      });
      if (data?.success !== true) return { ok: false, sourceError: true, sent: 0 };
      const unavailable = [];
      if (types.includes('overdue_claim') && !data.claims?.available) unavailable.push('overdue_claim');
      if (types.includes('overdue_job_order') && !data.jobOrders?.available) unavailable.push('overdue_job_order');
      if (types.includes('low_treasury') && !data.treasury?.available) unavailable.push('low_treasury');
      if (types.includes('large_transaction') && !data.transactions?.available) unavailable.push('large_transaction');

      const alerts = evaluateAlerts(data, settings, getDate());
      const nowMs = now();
      const picked = selectAlertsToSend(alerts, {
        settings,
        wasSentRecently: store.wasSentRecently,
        nowMs,
        hhmm: getHHMM(),
        ignoreQuietHours: manual,
      });
      const delivered = [];
      for (const a of picked.send) {
        const res = await send(actor.chatId, formatAlertMessage(a), buildAlertMarkup(a));
        if (res?.ok !== false) delivered.push(a);
      }
      if (picked.overflow.length > 0) {
        const res = await send(actor.chatId, formatOverflowMessage(picked.overflow));
        if (res?.ok !== false) delivered.push(...picked.overflow);
      }
      if (delivered.length > 0) store.markSent(delivered, nowMs);
      return { ok: true, sent: delivered.length, total: alerts.length, heldForQuiet: picked.heldForQuiet, unavailable };
    } finally {
      running = false;
    }
  }

  async function tick(actor) {
    const settings = store.getSettings();
    if (enabledAlertTypes(settings).length === 0) return null;
    const nowMs = now();
    if (nowMs - lastRunMs < settings.checkEveryMinutes * 60_000) return null;
    lastRunMs = nowMs;
    return check(actor);
  }

  // بيرجع true لو الـ callback بتاع التنبيهات واتعالج.
  async function handleCallback({ data, chatId, userId, answerCb, editMessage }) {
    const alertCb = resolveAlertCallback(data);
    if (alertCb?.action === 'details') {
      const d = store.getDetails(alertCb.id);
      await answerCb(d ? '🔍 التفاصيل' : 'التفاصيل دي مبقتش متاحة');
      if (d) await send(chatId, d.details);
      return true;
    }
    if (alertCb?.action === 'mute') {
      const s = store.getSettings();
      store.saveSettings({ ...s, types: { ...s.types, [alertCb.type]: false } });
      await answerCb(`🔕 اتكتم: ${ALERT_TYPES[alertCb.type].label}`);
      await send(chatId, `🔕 وقفت تنبيهات «${ALERT_TYPES[alertCb.type].label}». تقدر ترجّعها من ⚙️ الإعدادات ← 🔔 التنبيهات.`);
      return true;
    }
    const cfg = resolveAlertConfigCallback(data);
    if (!cfg) return false;
    if (cfg.action === 'show') {
      await answerCb('🔔');
      const view = buildAlertSettingsView(store.getSettings());
      await send(chatId, view.text, view.replyMarkup);
      return true;
    }
    if (cfg.action === 'run') {
      await answerCb('🔍 جارٍ الفحص...');
      const r = await check({ chatId, userId }, { manual: true });
      let msg;
      if (r.disabled) msg = '⛔ كل التنبيهات مطفية. شغّل نوع واحد على الأقل الأول.';
      else if (r.busy) msg = '⏳ فيه فحص شغال دلوقتي، جرّب بعد دقيقة.';
      else if (r.noAccess || r.sourceError) msg = '⚠️ تعذّر الفحص: الصلاحية أو مصدر البيانات غير متاح.';
      else msg = r.sent > 0 ? `✅ اتبعت ${r.sent} تنبيه.` : '✅ مفيش تنبيهات جديدة (أو اتبعتت خلال آخر فترة منع التكرار).';
      if (r.unavailable?.length) msg += `\n⚠️ غير متاح بالصلاحية الحالية: ${r.unavailable.map(t => ALERT_TYPES[t].label).join('، ')}`;
      await send(chatId, msg);
      return true;
    }
    const updated = applyAlertConfig(store.getSettings(), cfg);
    store.saveSettings(updated);
    await answerCb('✅ اتحفظ');
    const view = buildAlertSettingsView(updated);
    await editMessage(view.text, view.replyMarkup);
    return true;
  }

  return { check, tick, handleCallback, permissionsFor };
}
