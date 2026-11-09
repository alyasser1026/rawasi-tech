"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { SITE, PROJECTS, COMMITMENTS, FAQS, sanitizeContent } from '../site/site-content';

type Content = {
  site: { name: string; nameEn: string; legalName: string; tagline: string; headline: string; intro: string; offices: string[]; contact: { phone: string; whatsapp: string; email: string; address: string; hours: string } };
  projects: { name: string; kind: string; area: string; status: string; place?: string }[];
  commitments: { title: string; text: string }[];
  faqs: { q: string; a: string }[];
  seo: { title: string; description: string };
};

const TABS = [
  { id: 'ready', label: 'الجاهزية والاقتراحات' },
  { id: 'identity', label: 'الهوية والتواصل' },
  { id: 'projects', label: 'الأعمال' },
  { id: 'texts', label: 'الالتزامات والأسئلة' },
  { id: 'seo', label: 'محركات البحث' },
  { id: 'versions', label: 'النسخ المنشورة' },
] as const;

function defaults(): Content {
  return {
    site: { name: SITE.name, nameEn: SITE.nameEn, legalName: SITE.legalName, tagline: SITE.tagline, headline: SITE.headline, intro: SITE.intro, offices: [...SITE.offices], contact: { ...SITE.contact } },
    projects: [...PROJECTS],
    commitments: COMMITMENTS.map(x => ({ ...x })),
    faqs: FAQS.map(x => ({ ...x })),
    seo: { title: 'فاي تك | مقاولات عامة وتشطيبات فاخرة', description: '' },
  };
}

function fromStored(raw: any): Content {
  const d = defaults();
  const s = sanitizeContent(raw);
  return {
    site: { ...d.site, ...(s.site || {}), contact: { ...d.site.contact, ...(s.site?.contact || {}) }, offices: s.site?.offices?.length ? s.site.offices : d.site.offices } as Content['site'],
    projects: (s.projects ?? d.projects) as Content['projects'],
    commitments: s.commitments?.length ? s.commitments : d.commitments,
    faqs: s.faqs?.length ? s.faqs : d.faqs,
    seo: { title: s.seo?.title || d.seo.title, description: s.seo?.description || '' },
  };
}

const RECOMMENDATIONS: { p: 'عالية' | 'متوسطة' | 'تحسين'; title: string; why: string; done?: (c: Content, published: boolean) => boolean }[] = [
  { p: 'عالية', title: 'رقم واتساب وهاتف للتواصل', why: 'أغلب العملاء في المقاولات يبدؤون بمحادثة سريعة. بدون وسيلة تواصل واضحة يضيع معظم الزوار.', done: c => !!(c.site.contact.whatsapp || c.site.contact.phone) },
  { p: 'عالية', title: 'بريد إلكتروني بنطاق الشركة', why: 'بريد مثل info@phi-tech.org يعطي ثقة أكبر من أي بريد مجاني، ويصلح للعقود والمخاطبات الرسمية.', done: c => !!c.site.contact.email && !/(gmail|yahoo|hotmail|outlook)\./i.test(c.site.contact.email) },
  { p: 'عالية', title: 'عنوان المكتب وساعات العمل', why: 'العنوان الفعلي وساعات الدوام يزيدان المصداقية ويدعمان الظهور على خرائط جوجل.', done: c => !!(c.site.contact.address && c.site.contact.hours) },
  { p: 'عالية', title: 'معرض أعمال بموافقة أصحابها', why: 'الأعمال المنفذة بصور حقيقية أقوى عنصر إقناع. أضف المشروع فقط بعد موافقة المالك كتابيًا، ولا تنشر عناوين أو بيانات دقيقة تخصه.', done: c => c.projects.length > 0 },
  { p: 'عالية', title: 'نموذج طلب عرض سعر يُحفظ بشكل دائم', why: 'النموذج الحالي يفتح واتساب أو البريد، فلا يوجد سجل للعملاء المحتملين. الأفضل حفظ الطلب في قاعدة البيانات مع تنبيه فوري (الجدول جاهز في ملف SQL).' },
  { p: 'متوسطة', title: 'السجل التجاري والتراخيص وأرقام الاعتماد', why: 'عرض بيانات الترخيص والتصنيف يرفع الثقة خصوصًا عند المشاريع الكبيرة والجهات الرسمية.' },
  { p: 'متوسطة', title: 'آراء العملاء بموافقتهم', why: 'جملتان من عميل حقيقي مع اسمه الأول ونوع المشروع تؤثر أكثر من أي وصف تكتبه عن نفسك. لا تنشر رأيًا لم يكتبه العميل.' },
  { p: 'متوسطة', title: 'سياسة الخصوصية وشروط الاستخدام', why: 'مطلوبة بمجرد جمع بيانات التواصل عبر النموذج، وتظهر الاحتراف.' },
  { p: 'متوسطة', title: 'وصف محركات البحث (SEO)', why: 'عنوان ووصف مكتوبان بعناية، مع اسم المدينة والخدمة، يحسنان الظهور ونسبة النقر من نتائج جوجل.', done: c => c.seo.description.length >= 80 },
  { p: 'تحسين', title: 'ملف جوجل بزنس (Google Business Profile)', why: 'يظهر مكتبك على الخريطة ويجمع التقييمات، وغالبًا هو أول ما يراه العميل المحلي.' },
  { p: 'تحسين', title: 'إحصاءات زوار تحترم الخصوصية', why: 'أداة خفيفة بدون كوكيز تعرف منها من أين يأتي الزوار وأي قسم يهمهم، دون بيانات شخصية.' },
  { p: 'تحسين', title: 'نسخة إنجليزية للموقع', why: 'مفيدة للمستثمرين والاستشاريين والموردين الأجانب، وتحتاج فقط ترجمة النصوص الأساسية.' },
  { p: 'تحسين', title: 'فصل واضح بين الموقع العام والنظام', why: 'الموقع العام يقرأ نسخة منشورة واحدة فقط من هذه الصفحة. لا تُنسخ إليه أي بيانات مشاريع أو عملاء أو أسعار تكلفة من النظام.', done: () => true },
];

export default function WebsiteAdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('ready');
  const [c, setC] = useState<Content>(defaults());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    const { data, error } = await supabase.rpc('website_admin_state');
    if (error) {
      setErr(/website_admin_state|schema cache|does not exist/i.test(error.message) ? 'لم يتم تفعيل قاعدة بيانات إدارة الموقع بعد (ملف work/website-admin.sql).' : /forbidden/i.test(error.message) ? 'هذه الصفحة للمديرين فقط.' : error.message);
    } else {
      setC(fromStored(data?.draft ?? data?.published));
      setPublished(data?.published ?? null);
      setHistory(data?.history ?? []);
      setDirty(false);
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const upd = (fn: (d: Content) => void) => { setC(prev => { const n = JSON.parse(JSON.stringify(prev)) as Content; fn(n); return n; }); setDirty(true); setMsg(''); };

  const saveDraft = async () => {
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('website_save_draft', { p_content: c });
    setBusy(false);
    if (error) setErr(error.message); else { setDirty(false); setMsg('تم حفظ المسودة. لن تظهر على الموقع قبل النشر.'); }
  };
  const publish = async () => {
    if (!window.confirm('نشر المحتوى الحالي على الموقع العام؟ (يمكن التراجع من تبويب النسخ)')) return;
    setBusy(true); setErr('');
    const s = await supabase.rpc('website_save_draft', { p_content: c });
    if (s.error) { setBusy(false); setErr(s.error.message); return; }
    const { error } = await supabase.rpc('website_publish', { p_note: null });
    setBusy(false);
    if (error) setErr(error.message); else { setMsg('تم النشر. قد يستغرق ظهور التغيير على الموقع حتى 5 دقائق.'); void load(); }
  };
  const restore = async (id: string) => {
    if (!window.confirm('استرجاع هذه النسخة كنسخة منشورة؟')) return;
    setBusy(true);
    const { error } = await supabase.rpc('website_restore', { p_version_id: id });
    setBusy(false);
    if (error) setErr(error.message); else { setMsg('تم الاسترجاع.'); void load(); }
  };

  const score = useMemo(() => {
    const checks = RECOMMENDATIONS.filter(r => r.done);
    const ok = checks.filter(r => r.done!(c, !!published)).length;
    return { ok, total: checks.length, pct: Math.round((ok / checks.length) * 100) };
  }, [c, published]);

  const ct = c.site.contact;

  return (
    <div className="wa" dir="rtl">
      <style>{CSS}</style>
      <header className="wa-top">
        <div>
          <h1>إدارة الموقع العام</h1>
          <p>كل ما يظهر في phi-tech.org يُدار من هنا. الموقع لا يعرض أي بيانات من النظام الداخلي (مشاريع، عملاء، مالية).</p>
        </div>
        <div className="wa-actions">
          <Link href="/" target="_blank" className="wa-btn">عرض الموقع ↗</Link>
          <button className="wa-btn" onClick={saveDraft} disabled={busy || !dirty}>حفظ المسودة</button>
          <button className="wa-btn wa-primary" onClick={publish} disabled={busy}>نشر</button>
        </div>
      </header>

      {err && <div className="wa-alert wa-err">{err}</div>}
      {msg && <div className="wa-alert wa-ok">{msg}</div>}
      {dirty && <div className="wa-alert">لديك تعديلات غير محفوظة.</div>}

      <nav className="wa-tabs" role="tablist">
        {TABS.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </nav>

      {loading ? <p className="wa-muted">جاري التحميل…</p> : (
        <main className="wa-panel">
          {tab === 'ready' && (
            <>
              <div className="wa-score">
                <div className="wa-ring" style={{ ['--p' as any]: score.pct }}><span>{score.pct}%</span></div>
                <div><h2>جاهزية الموقع للعملاء</h2><p className="wa-muted">{score.ok} من {score.total} بنود أساسية مكتملة. {published ? 'الموقع منشور حاليًا.' : 'لم تُنشر نسخة بعد، فالموقع يعرض النصوص الافتراضية.'}</p></div>
              </div>
              <ul className="wa-recs">
                {RECOMMENDATIONS.map(r => {
                  const done = r.done ? r.done(c, !!published) : null;
                  return (
                    <li key={r.title} className={done ? 'done' : ''}>
                      <span className={`wa-pill p-${r.p}`}>{done ? 'مكتمل' : r.p}</span>
                      <div><strong>{r.title}</strong><p>{r.why}</p></div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {tab === 'identity' && (
            <div className="wa-form">
              <F label="اسم الشركة" v={c.site.name} on={v => upd(d => { d.site.name = v; })} />
              <F label="الاسم بالإنجليزية" v={c.site.nameEn} on={v => upd(d => { d.site.nameEn = v; })} dir="ltr" />
              <F label="الاسم القانوني" v={c.site.legalName} on={v => upd(d => { d.site.legalName = v; })} wide />
              <F label="الشعار النصي" v={c.site.tagline} on={v => upd(d => { d.site.tagline = v; })} wide />
              <F label="العنوان الرئيسي" v={c.site.headline} on={v => upd(d => { d.site.headline = v; })} wide />
              <F label="النبذة" v={c.site.intro} on={v => upd(d => { d.site.intro = v; })} wide area />
              <F label="المكاتب (مفصولة بفاصلة)" v={c.site.offices.join('، ')} on={v => upd(d => { d.site.offices = v.split(/[,،]/).map(x => x.trim()).filter(Boolean); })} wide />
              <h3 className="wa-wide">بيانات التواصل (الحقل الفارغ يختفي من الموقع)</h3>
              <F label="الهاتف" v={ct.phone} on={v => upd(d => { d.site.contact.phone = v; })} dir="ltr" />
              <F label="واتساب (أرقام فقط بكود الدولة)" v={ct.whatsapp} on={v => upd(d => { d.site.contact.whatsapp = v; })} dir="ltr" />
              <F label="البريد الإلكتروني" v={ct.email} on={v => upd(d => { d.site.contact.email = v; })} dir="ltr" />
              <F label="ساعات العمل" v={ct.hours} on={v => upd(d => { d.site.contact.hours = v; })} />
              <F label="العنوان" v={ct.address} on={v => upd(d => { d.site.contact.address = v; })} wide />
            </div>
          )}

          {tab === 'projects' && (
            <>
              <div className="wa-alert">أضف هنا فقط الأعمال التي وافق أصحابها على نشرها. لا تُسحب هذه القائمة من مشاريع النظام، ولا تنشر عنوانًا دقيقًا أو اسم المالك أو أي قيم مالية.</div>
              {c.projects.length === 0 && <p className="wa-muted">لا توجد أعمال منشورة، وقسم «أعمالنا» مخفي من الموقع.</p>}
              {c.projects.map((p, i) => (
                <div key={i} className="wa-card wa-form">
                  <F label="اسم العمل (عام، بدون بيانات المالك)" v={p.name} on={v => upd(d => { d.projects[i].name = v; })} />
                  <F label="النوع" v={p.kind} on={v => upd(d => { d.projects[i].kind = v; })} />
                  <F label="المساحة" v={p.area} on={v => upd(d => { d.projects[i].area = v; })} />
                  <F label="الحالة" v={p.status} on={v => upd(d => { d.projects[i].status = v; })} />
                  <F label="المدينة (اختياري)" v={p.place || ''} on={v => upd(d => { d.projects[i].place = v; })} />
                  <button className="wa-btn wa-danger" onClick={() => upd(d => { d.projects.splice(i, 1); })}>حذف</button>
                </div>
              ))}
              <button className="wa-btn" onClick={() => upd(d => { d.projects.push({ name: '', kind: '', area: '', status: 'قيد التنفيذ' }); })}>+ إضافة عمل</button>
            </>
          )}

          {tab === 'texts' && (
            <>
              <h3>الالتزامات (طريقة العمل)</h3>
              {c.commitments.map((x, i) => (
                <div key={i} className="wa-card wa-form">
                  <F label="العنوان" v={x.title} on={v => upd(d => { d.commitments[i].title = v; })} />
                  <F label="النص" v={x.text} on={v => upd(d => { d.commitments[i].text = v; })} wide area />
                  <button className="wa-btn wa-danger" onClick={() => upd(d => { d.commitments.splice(i, 1); })}>حذف</button>
                </div>
              ))}
              <button className="wa-btn" onClick={() => upd(d => { d.commitments.push({ title: '', text: '' }); })}>+ إضافة التزام</button>
              <h3>الأسئلة الشائعة</h3>
              {c.faqs.map((x, i) => (
                <div key={i} className="wa-card wa-form">
                  <F label="السؤال" v={x.q} on={v => upd(d => { d.faqs[i].q = v; })} wide />
                  <F label="الإجابة" v={x.a} on={v => upd(d => { d.faqs[i].a = v; })} wide area />
                  <button className="wa-btn wa-danger" onClick={() => upd(d => { d.faqs.splice(i, 1); })}>حذف</button>
                </div>
              ))}
              <button className="wa-btn" onClick={() => upd(d => { d.faqs.push({ q: '', a: '' }); })}>+ إضافة سؤال</button>
            </>
          )}

          {tab === 'seo' && (
            <div className="wa-form">
              <F label={`عنوان الصفحة في جوجل (${c.seo.title.length}/60)`} v={c.seo.title} on={v => upd(d => { d.seo.title = v; })} wide />
              <F label={`الوصف (${c.seo.description.length}/160)`} v={c.seo.description} on={v => upd(d => { d.seo.description = v; })} wide area />
              <div className="wa-serp wa-wide"><small>phi-tech.org</small><strong>{c.seo.title || '—'}</strong><span>{c.seo.description || 'اكتب وصفًا من 80 إلى 160 حرفًا يذكر الخدمة والمدينة.'}</span></div>
            </div>
          )}

          {tab === 'versions' && (
            history.length === 0 ? <p className="wa-muted">لم تُنشر أي نسخة بعد.</p> : (
              <ul className="wa-recs">
                {history.map(h => (
                  <li key={h.id}>
                    <span className={`wa-pill ${h.status === 'published' ? 'p-ok' : 'p-تحسين'}`}>{h.status === 'published' ? 'المنشورة الآن' : 'مؤرشفة'}</span>
                    <div><strong>{h.published_at ? new Date(h.published_at).toLocaleString('ar-EG') : ''}</strong>{h.note && <p>{h.note}</p>}</div>
                    {h.status !== 'published' && <button className="wa-btn" disabled={busy} onClick={() => restore(h.id)}>استرجاع</button>}
                  </li>
                ))}
              </ul>
            )
          )}
        </main>
      )}
    </div>
  );
}

function F({ label, v, on, wide, area, dir }: { label: string; v: string; on: (v: string) => void; wide?: boolean; area?: boolean; dir?: 'ltr' | 'rtl' }) {
  return (
    <label className={`wa-f ${wide ? 'wa-wide' : ''}`}>
      <span>{label}</span>
      {area ? <textarea rows={3} value={v} dir={dir} onChange={e => on(e.target.value)} /> : <input value={v} dir={dir} onChange={e => on(e.target.value)} />}
    </label>
  );
}

const CSS = `
.wa{--bg:#f6f7f9;--card:#fff;--ink:#16202e;--mut:#5b6677;--line:#dfe3ea;--acc:#c75517;--ok:#1d7a4a;--bad:#b3261e;padding:20px;max-width:1000px;margin:0 auto;color:var(--ink);font-family:inherit}
@media(prefers-color-scheme:dark){.wa{--bg:#0f141b;--card:#171e28;--ink:#e8edf4;--mut:#9aa6b8;--line:#2a3442;--acc:#f08a4b;--ok:#4cc38a;--bad:#ff8a80}}
.wa-top{display:flex;gap:16px;justify-content:space-between;flex-wrap:wrap;align-items:flex-start;margin-bottom:12px}
.wa h1{font-size:22px;margin:0 0 4px}.wa-top p{margin:0;color:var(--mut);font-size:14px;max-width:560px}
.wa-actions{display:flex;gap:8px;flex-wrap:wrap}
.wa-btn{border:1px solid var(--line);background:var(--card);color:var(--ink);padding:9px 14px;border-radius:8px;cursor:pointer;font:inherit;text-decoration:none;font-size:14px}
.wa-btn:disabled{opacity:.5;cursor:not-allowed}.wa-primary{background:var(--acc);border-color:var(--acc);color:#fff}.wa-danger{color:var(--bad);align-self:end}
.wa-alert{padding:10px 14px;border-radius:8px;background:var(--card);border:1px solid var(--line);margin:8px 0;font-size:14px}
.wa-err{border-color:var(--bad);color:var(--bad)}.wa-ok{border-color:var(--ok);color:var(--ok)}
.wa-tabs{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid var(--line);margin:14px 0}
.wa-tabs button{background:none;border:0;border-bottom:2px solid transparent;padding:10px 14px;color:var(--mut);cursor:pointer;font:inherit;white-space:nowrap}
.wa-tabs button.on{color:var(--ink);border-bottom-color:var(--acc);font-weight:600}
.wa-panel{display:grid;gap:12px}.wa-muted{color:var(--mut)}
.wa-score{display:flex;gap:18px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
.wa-score h2{margin:0 0 4px;font-size:18px}.wa-score p{margin:0}
.wa-ring{--p:0;width:84px;height:84px;border-radius:50%;background:conic-gradient(var(--acc) calc(var(--p)*1%),var(--line) 0);display:grid;place-items:center;flex:none}
.wa-ring span{background:var(--card);width:66px;height:66px;border-radius:50%;display:grid;place-items:center;font-weight:700}
.wa-recs{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.wa-recs li{display:flex;gap:12px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.wa-recs li.done{opacity:.65}.wa-recs p{margin:4px 0 0;color:var(--mut);font-size:13.5px;line-height:1.7}.wa-recs li>div{flex:1;min-width:0}
.wa-pill{font-size:12px;padding:3px 9px;border-radius:99px;border:1px solid var(--line);white-space:nowrap;margin-top:2px}
.p-عالية{color:var(--bad);border-color:var(--bad)}.p-متوسطة{color:var(--acc);border-color:var(--acc)}.p-ok,.done .wa-pill{color:var(--ok);border-color:var(--ok)}
.wa-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.wa-wide{grid-column:1/-1}
.wa-card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}
.wa-f{display:grid;gap:5px;font-size:13px;color:var(--mut)}
.wa-f input,.wa-f textarea{background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:9px 10px;font:inherit;font-size:14px;width:100%;box-sizing:border-box}
.wa h3{margin:10px 0 0;font-size:15px}
.wa-serp{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;display:grid;gap:3px}.wa-serp strong{color:#1a0dab;font-weight:500;font-size:18px}.wa-serp span{color:var(--mut);font-size:13px}
@media(max-width:600px){.wa{padding:16px}}
`;
