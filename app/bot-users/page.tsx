"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

// إدارة مستخدمي بوت تلغرام (جدول copilot_telegram_users عبر دوال للمدير فقط — work/sql-to-run/05).
// البوت بيقرأ التعديلات في خلال نص دقيقة من غير إعادة تشغيل.

type Role = 'admin' | 'accountant' | 'engineer' | 'viewer';
type BotUser = { telegram_id: string; role: Role; name: string | null; added_by: string | null; created_at: string; updated_at: string };

const ROLES: { id: Role; label: string; desc: string }[] = [
  { id: 'admin', label: 'مدير', desc: 'كل حاجة، ومعاها الإعدادات وتبديل الشركة والذاكرة الدائمة وإدارة المستخدمين' },
  { id: 'accountant', label: 'محاسب', desc: 'كل التقارير وكل التسجيلات (بعد التأكيد) وربط المصروف بأمر شغل' },
  { id: 'engineer', label: 'مهندس موقع', desc: 'العمالة والمشاريع واليوميات وأوامر الشغل، من غير أرقام الفلوس والأجور' },
  { id: 'viewer', label: 'قراءة فقط', desc: 'تقارير العمالة والمشاريع بس' },
];
const roleLabel = (r: string) => ROLES.find(x => x.id === r)?.label ?? r;

function friendlyError(message: string) {
  if (/copilot_users_|schema cache|does not exist|Could not find the function/i.test(message)) {
    return 'لسه ما اتفعّلتش قاعدة بيانات مستخدمي البوت. شغّل ملف work/sql-to-run/05-copilot-telegram-users.sql في Supabase.';
  }
  if (/forbidden/i.test(message)) return 'الصفحة دي للمديرين بس.';
  return message;
}

function addedByLabel(v: string | null) {
  if (!v) return '—';
  if (v.startsWith('web:')) return 'من السيستم';
  if (v.startsWith('telegram:')) return `من تلغرام (${v.slice(9)})`;
  if (v === 'contact-bootstrap') return 'تسجيل أولي بالموبايل';
  if (v === 'seed') return 'من إعدادات الشات';
  if (v === 'file-migration') return 'منقول من الملف';
  return v;
}

export default function BotUsersPage() {
  const [users, setUsers] = useState<BotUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState<{ id: string; role: Role; name: string }>({ id: '', role: 'viewer', name: '' });

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    const { data, error } = await supabase.rpc('copilot_users_list');
    if (error) setErr(friendlyError(error.message));
    else setUsers(Array.isArray(data) ? (data as BotUser[]) : []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const admins = useMemo(() => users.filter(u => u.role === 'admin').length, [users]);
  const idValid = /^[1-9]\d{4,15}$/.test(form.id.trim());

  const save = async (telegramId: string, role: Role, name: string | null, successText: string) => {
    setBusy(true); setErr(''); setMsg('');
    const { error } = await supabase.rpc('copilot_users_upsert', { p_telegram_id: Number(telegramId), p_role: role, p_name: name });
    setBusy(false);
    if (error) { setErr(friendlyError(error.message)); return false; }
    setMsg(successText);
    void load();
    return true;
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idValid) { setErr('اكتب رقم تلغرام صحيح (أرقام بس). الشخص يعرف رقمه لما يبعت /whoami للبوت.'); return; }
    const exists = users.some(u => u.telegram_id === form.id.trim());
    const ok = await save(form.id.trim(), form.role, form.name.trim() || null, exists ? 'اتحدّث المستخدم.' : 'اتضاف المستخدم. يقدر يستخدم البوت في خلال نص دقيقة.');
    if (ok) setForm({ id: '', role: 'viewer', name: '' });
  };

  const changeRole = (u: BotUser, role: Role) => {
    if (role === u.role) return;
    void save(u.telegram_id, role, null, `بقى «${roleLabel(role)}».`);
  };

  const remove = async (u: BotUser) => {
    if (!window.confirm(`شيل ${u.name || u.telegram_id} من البوت؟ مش هيقدر يستخدمه تاني لحد ما تضيفه.`)) return;
    setBusy(true); setErr(''); setMsg('');
    const { error } = await supabase.rpc('copilot_users_remove', { p_telegram_id: Number(u.telegram_id) });
    setBusy(false);
    if (error) setErr(friendlyError(error.message));
    else { setMsg('اتشال المستخدم.'); void load(); }
  };

  return (
    <div className="bu" dir="rtl">
      <style>{CSS}</style>
      <header className="bu-top">
        <h1>مستخدمي بوت تلغرام</h1>
        <p>البوت بيرد بس على الأرقام اللي هنا، وكل واحد حسب دوره. التعديل بيوصل للبوت في خلال نص دقيقة. وتقدر كمان تدير القائمة من تلغرام بأوامر /users و /user_add.</p>
      </header>

      {err && <div className="bu-alert bu-err" role="alert">{err}</div>}
      {msg && <div className="bu-alert bu-ok" role="status">{msg}</div>}

      <form className="bu-card bu-form" onSubmit={add}>
        <h2>إضافة مستخدم</h2>
        <label className="bu-f">
          رقم تلغرام
          <input inputMode="numeric" dir="ltr" placeholder="مثال: 5123456789" value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value.replace(/[^\d]/g, '') }))} />
        </label>
        <label className="bu-f">
          الاسم (اختياري)
          <input value={form.name} maxLength={60} placeholder="مثال: أحمد — محاسب الموقع" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </label>
        <label className="bu-f">
          الدور
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
            {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
        <button className="bu-btn bu-primary" disabled={busy || !form.id}>إضافة</button>
        <p className="bu-hint bu-wide">الشخص يفتح البوت في تلغرام ويبعت <code>/whoami</code>، وهيوصله رقمه. {ROLES.find(r => r.id === form.role)?.desc}.</p>
      </form>

      <section className="bu-card">
        <div className="bu-head">
          <h2>المسجلين ({users.length})</h2>
          <button className="bu-btn" onClick={() => void load()} disabled={loading}>تحديث</button>
        </div>
        {loading ? <p className="bu-muted">جاري التحميل…</p> : users.length === 0 ? (
          <p className="bu-muted">مفيش مستخدمين لسه. أول ما البوت يشتغل بعد التحديث هينقل هنا المستخدمين المسجلين عنده، أو ضيف من فوق.</p>
        ) : (
          <div className="bu-table-wrap">
            <table className="bu-table">
              <thead><tr><th>الاسم</th><th>رقم تلغرام</th><th>الدور</th><th>اتضاف</th><th></th></tr></thead>
              <tbody>
                {users.map(u => {
                  const lastAdmin = u.role === 'admin' && admins <= 1;
                  return (
                    <tr key={u.telegram_id}>
                      <td>{u.name || <span className="bu-muted">—</span>}</td>
                      <td dir="ltr" className="bu-mono">{u.telegram_id}</td>
                      <td>
                        <select aria-label={`دور ${u.name || u.telegram_id}`} value={u.role} disabled={busy || lastAdmin} title={lastAdmin ? 'آخر مدير — ضيف مدير تاني الأول' : ''} onChange={e => changeRole(u, e.target.value as Role)}>
                          {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                      </td>
                      <td className="bu-muted bu-small">{addedByLabel(u.added_by)}<br />{new Date(u.created_at).toLocaleDateString('ar-EG')}</td>
                      <td><button className="bu-btn bu-danger" disabled={busy || lastAdmin} title={lastAdmin ? 'آخر مدير — مش هينفع يتشال' : ''} onClick={() => void remove(u)}>شيل</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bu-card">
        <h2>الأدوار</h2>
        <ul className="bu-roles">
          {ROLES.map(r => <li key={r.id}><strong>{r.label}</strong><span>{r.desc}</span></li>)}
        </ul>
      </section>
    </div>
  );
}

const CSS = `
.bu{--bg:#f6f7f9;--card:#fff;--ink:#16202e;--mut:#5b6677;--line:#dfe3ea;--acc:#c75517;--ok:#1d7a4a;--bad:#b3261e;padding:20px;max-width:1000px;margin:0 auto;color:var(--ink);font-family:inherit;display:grid;gap:14px}
@media(prefers-color-scheme:dark){.bu{--bg:#0f141b;--card:#171e28;--ink:#e8edf4;--mut:#9aa6b8;--line:#2a3442;--acc:#f08a4b;--ok:#4cc38a;--bad:#ff8a80}}
.bu h1{font-size:22px;margin:0 0 4px}.bu h2{font-size:16px;margin:0}
.bu-top p{margin:0;color:var(--mut);font-size:14px;max-width:680px;line-height:1.7}
.bu-card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;display:grid;gap:12px}
.bu-form{grid-template-columns:repeat(auto-fit,minmax(200px,1fr));align-items:end}.bu-form h2,.bu-wide{grid-column:1/-1}
.bu-f{display:grid;gap:5px;font-size:13px;color:var(--mut)}
.bu-f input,.bu-f select,.bu-table select{background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:9px 10px;font:inherit;font-size:14px;width:100%;box-sizing:border-box}
.bu-btn{border:1px solid var(--line);background:var(--card);color:var(--ink);padding:9px 14px;border-radius:8px;cursor:pointer;font:inherit;font-size:14px}
.bu-btn:disabled{opacity:.5;cursor:not-allowed}.bu-primary{background:var(--acc);border-color:var(--acc);color:#fff}.bu-danger{color:var(--bad)}
.bu-alert{padding:10px 14px;border-radius:8px;background:var(--card);border:1px solid var(--line);font-size:14px}
.bu-err{border-color:var(--bad);color:var(--bad)}.bu-ok{border-color:var(--ok);color:var(--ok)}
.bu-muted{color:var(--mut)}.bu-small{font-size:12.5px}.bu-hint{margin:0;color:var(--mut);font-size:13px}
.bu-hint code{background:var(--bg);border:1px solid var(--line);border-radius:5px;padding:1px 5px}
.bu-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
.bu-table-wrap{overflow-x:auto}.bu-table{width:100%;border-collapse:collapse;font-size:14px}
.bu-table th{text-align:start;color:var(--mut);font-weight:500;font-size:13px;padding:8px;border-bottom:1px solid var(--line)}
.bu-table td{padding:8px;border-bottom:1px solid var(--line);vertical-align:middle}.bu-table tr:last-child td{border-bottom:0}
.bu-table select{min-width:120px;padding:6px 8px}
.bu-mono{font-variant-numeric:tabular-nums}
.bu-roles{list-style:none;margin:0;padding:0;display:grid;gap:8px}.bu-roles li{display:grid;gap:2px}.bu-roles span{color:var(--mut);font-size:13.5px}
@media(max-width:600px){.bu{padding:16px}.bu-table th:nth-child(4),.bu-table td:nth-child(4){display:none}}
`;
