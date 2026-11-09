"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SITE, SERVICES, STEPS, PROJECTS } from './site-content';

const NAV = [
  { href: '#services', label: 'الخدمات' },
  { href: '#process', label: 'طريقة العمل' },
  { href: '#projects', label: 'أعمالنا' },
  { href: '#contact', label: 'تواصل' },
];

function Icon({ name }: { name: string }) {
  const common = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'structure') return (<svg {...common}><path d="M3 21h18" /><path d="M5 21V8l7-4 7 4v13" /><path d="M9 21v-6h6v6" /><path d="M9 11h.01M15 11h.01" /></svg>);
  if (name === 'finishing') return (<svg {...common}><rect x="3" y="3" width="18" height="6" rx="1.5" /><path d="M12 9v5" /><rect x="10" y="14" width="4" height="7" rx="1" /></svg>);
  return (<svg {...common}><circle cx="12" cy="12" r="2" /><path d="M12 10c0-3 1-6 4-6 2 0 3 2 2 4-1 2-3 2-6 2z" /><path d="M14 12c3 0 6 1 6 4 0 2-2 3-4 2-2-1-2-3-2-6z" /><path d="M12 14c0 3-1 6-4 6-2 0-3-2-2-4 1-2 3-2 6-2z" /><path d="M10 12c-3 0-6-1-6-4 0-2 2-3 4-2 2 1 2 3 2 6z" /></svg>);
}

function Check() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>);
}

export default function PhiSite() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const c = SITE.contact;
  const contactRows = [
    c.phone && { label: 'الهاتف', value: c.phone, href: `tel:${c.phone.replace(/\s+/g, '')}`, dir: 'ltr' as const },
    c.whatsapp && { label: 'واتساب', value: 'ابدأ محادثة', href: `https://wa.me/${c.whatsapp.replace(/\D/g, '')}`, dir: 'rtl' as const },
    c.email && { label: 'البريد الإلكتروني', value: c.email, href: `mailto:${c.email}`, dir: 'ltr' as const },
    c.address && { label: 'العنوان', value: c.address, href: '', dir: 'rtl' as const },
    c.hours && { label: 'ساعات العمل', value: c.hours, href: '', dir: 'rtl' as const },
  ].filter(Boolean) as { label: string; value: string; href: string; dir: 'ltr' | 'rtl' }[];

  const primaryContact = c.whatsapp
    ? { href: `https://wa.me/${c.whatsapp.replace(/\D/g, '')}`, label: 'تواصل عبر واتساب' }
    : c.phone
      ? { href: `tel:${c.phone.replace(/\s+/g, '')}`, label: 'اتصل بنا' }
      : { href: '#contact', label: 'تواصل معنا' };

  return (
    <div className="pw" dir="rtl">
      <style>{CSS}</style>

      <header className={`pw-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="pw-wrap pw-header-row">
          <a href="#top" className="pw-brand" aria-label={`${SITE.name} — الرئيسية`}>
            <img src="/brand/phitech-mark-color.svg" alt="" className="pw-brand-mark" />
            <span className="pw-brand-text">
              <strong>{SITE.name}</strong>
              <small>{SITE.nameEn}</small>
            </span>
          </a>

          <nav className={`pw-nav ${open ? 'is-open' : ''}`} aria-label="التنقل الرئيسي">
            {NAV.map(n => (
              <a key={n.href} href={n.href} onClick={() => setOpen(false)}>{n.label}</a>
            ))}
            <Link href="/login" className="pw-btn pw-btn-primary pw-nav-cta" onClick={() => setOpen(false)}>دخول النظام</Link>
          </nav>

          <button className="pw-burger" aria-label="القائمة" aria-expanded={open} onClick={() => setOpen(v => !v)}>
            <span /><span /><span />
          </button>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="pw-hero">
          <div className="pw-wrap pw-hero-grid">
            <div className="pw-hero-copy">
              <p className="pw-eyebrow">{SITE.tagline} · {SITE.offices.join(' • ')}</p>
              <h1>{SITE.headline}</h1>
              <p className="pw-lead">{SITE.intro}</p>
              <div className="pw-actions">
                <a href={primaryContact.href} className="pw-btn pw-btn-primary" {...(primaryContact.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{primaryContact.label}</a>
                <a href="#services" className="pw-btn pw-btn-ghost">خدماتنا</a>
              </div>
              <ul className="pw-facts">
                <li><strong>3 قطاعات</strong><span>إنشاء وتشطيب وتأسيسات</span></li>
                <li><strong>جهة واحدة</strong><span>مسؤولية تنفيذ موحّدة</span></li>
                <li><strong>{SITE.offices.length} مكاتب</strong><span>{SITE.offices.join(' · ')}</span></li>
              </ul>
            </div>
            <div className="pw-hero-art" aria-hidden>
              <div className="pw-art-card">
                <img src="/brand/phitech-lockup-color.svg" alt="" />
              </div>
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="pw-section">
          <div className="pw-wrap">
            <div className="pw-head">
              <p className="pw-eyebrow">خدماتنا</p>
              <h2>ثلاثة قطاعات تعمل كمنظومة واحدة</h2>
              <p>تنسيق مبكر بين الإنشاء والتأسيسات والتشطيب يمنع التكسير وإعادة العمل، ويوفّر الوقت والتكلفة.</p>
            </div>
            <div className="pw-cards">
              {SERVICES.map(s => (
                <article key={s.id} className="pw-card">
                  <div className="pw-icon"><Icon name={s.id} /></div>
                  <h3>{s.title}</h3>
                  <p>{s.summary}</p>
                  <ul>
                    {s.items.map(i => (<li key={i}><Check /><span>{i}</span></li>))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Process */}
        <section id="process" className="pw-section pw-tint">
          <div className="pw-wrap">
            <div className="pw-head">
              <p className="pw-eyebrow">طريقة العمل</p>
              <h2>من المعاينة إلى التسليم</h2>
            </div>
            <ol className="pw-steps">
              {STEPS.map(s => (
                <li key={s.n}>
                  <span className="pw-step-n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Projects */}
        {PROJECTS.length > 0 && (
          <section id="projects" className="pw-section">
            <div className="pw-wrap">
              <div className="pw-head">
                <p className="pw-eyebrow">أعمالنا</p>
                <h2>مشاريع قيد التنفيذ</h2>
              </div>
              <div className="pw-projects">
                {PROJECTS.map(p => (
                  <article key={p.name} className="pw-project">
                    <span className="pw-badge">{p.status}</span>
                    <h3>{p.name}</h3>
                    <p>{p.kind}</p>
                    <dl>
                      <div><dt>المساحة</dt><dd>{p.area}</dd></div>
                      {p.place && (<div><dt>الموقع</dt><dd>{p.place}</dd></div>)}
                    </dl>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Contact */}
        <section id="contact" className="pw-section pw-tint">
          <div className="pw-wrap pw-contact">
            <div className="pw-head pw-head-start">
              <p className="pw-eyebrow">تواصل</p>
              <h2>ابدأ بمعاينة ومقايسة لمشروعك</h2>
              <p>أخبرنا بنوع المشروع وموقعه، وسيتواصل معك فريقنا الهندسي.</p>
            </div>
            <div className="pw-contact-card">
              {contactRows.length > 0 ? (
                <ul>
                  {contactRows.map(r => (
                    <li key={r.label}>
                      <span>{r.label}</span>
                      {r.href
                        ? <a href={r.href} dir={r.dir} {...(r.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{r.value}</a>
                        : <strong dir={r.dir}>{r.value}</strong>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pw-muted">بيانات التواصل قيد الإضافة.</p>
              )}
              <div className="pw-offices">
                {SITE.offices.map(o => (<span key={o}>{o}</span>))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="pw-footer">
        <div className="pw-wrap pw-footer-row">
          <div className="pw-footer-brand">
            <img src="/brand/phitech-mark-light.svg" alt="" />
            <div>
              <strong>{SITE.legalName}</strong>
              <small>© {new Date().getFullYear()} جميع الحقوق محفوظة</small>
            </div>
          </div>
          <Link href="/login" className="pw-footer-link">دخول النظام</Link>
        </div>
      </footer>
    </div>
  );
}

const CSS = `
.pw{--o:#c75517;--o-dark:#a84511;--o-soft:#fff3ea;--ink:#1b2125;--ink-2:#4a5560;--line:#e6e8eb;--bg:#fff;--tint:#f7f6f4;
  position:relative;min-height:100vh;background:var(--bg);color:var(--ink);font-family:'Cairo',-apple-system,'Segoe UI',sans-serif;line-height:1.7;letter-spacing:0;-webkit-font-smoothing:antialiased}
.pw *{box-sizing:border-box}
:where(.pw) :is(h1,h2,h3,p,ul,ol,dl,dd){margin:0;padding:0}
:where(.pw) :is(ul,ol){list-style:none}
:where(.pw) a{color:inherit;text-decoration:none}
:where(.pw) img{max-width:100%;display:block}
.pw-wrap{width:100%;max-width:1160px;margin:0 auto;padding:0 20px}

/* header */
.pw-header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid transparent;transition:border-color .2s,box-shadow .2s}
.pw-header.is-scrolled{border-bottom-color:var(--line);box-shadow:0 4px 18px rgba(20,28,34,.05)}
.pw-header-row{display:flex;align-items:center;justify-content:space-between;height:68px;gap:16px}
.pw-brand{display:flex;align-items:center;gap:12px}
.pw-brand-mark{height:40px;width:auto}
.pw-brand-text{display:flex;flex-direction:column;line-height:1.15}
.pw-brand-text strong{font-size:1.2rem;font-weight:800;color:var(--ink)}
.pw-brand-text small{font-size:.72rem;font-weight:600;letter-spacing:.14em;color:var(--o)}
.pw-nav{display:flex;align-items:center;gap:26px;font-weight:600;font-size:.95rem;color:var(--ink-2)}
.pw-nav a:not(.pw-btn):hover{color:var(--o)}
.pw-burger{display:none;width:44px;height:44px;border:1px solid var(--line);background:#fff;border-radius:10px;cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:5px}
.pw-burger span{display:block;width:20px;height:2px;background:var(--ink);border-radius:2px}

/* buttons */
.pw-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 24px;border-radius:12px;font-family:inherit;font-weight:700;font-size:.97rem;cursor:pointer;border:1.5px solid transparent;transition:background .18s,border-color .18s,color .18s,transform .18s}
.pw-btn-primary{background:var(--o);color:#fff}
.pw-btn-primary:hover{background:var(--o-dark)}
.pw-btn-ghost{background:#fff;color:var(--ink);border-color:var(--line)}
.pw-btn-ghost:hover{border-color:var(--o);color:var(--o)}
.pw-nav-cta{min-height:42px;padding:0 20px}
.pw a:focus-visible,.pw button:focus-visible{outline:3px solid rgba(199,85,23,.45);outline-offset:3px}

/* hero */
.pw-hero{background:linear-gradient(180deg,#fff 0%,var(--o-soft) 100%);border-bottom:1px solid var(--line)}
.pw-hero-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:56px;align-items:center;padding-top:72px;padding-bottom:72px}
.pw-eyebrow{font-size:.85rem;font-weight:700;color:var(--o);letter-spacing:.02em;margin-bottom:14px}
.pw-hero h1{font-size:clamp(2rem,4.4vw,3.2rem);line-height:1.25;font-weight:800;color:var(--ink);margin-bottom:18px}
.pw-lead{font-size:1.1rem;color:var(--ink-2);max-width:34rem;margin-bottom:28px}
.pw-actions{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:36px}
.pw-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;padding-top:26px;border-top:1px solid rgba(27,33,37,.1)}
.pw-facts li{display:flex;flex-direction:column;gap:2px}
.pw-facts strong{font-size:1.15rem;font-weight:800;color:var(--ink)}
.pw-facts span{font-size:.85rem;color:var(--ink-2)}
.pw-hero-art{display:flex;justify-content:center}
.pw-art-card{width:100%;max-width:380px;aspect-ratio:1/1.12;background:#fff;border:1px solid var(--line);border-radius:28px;display:flex;align-items:center;justify-content:center;padding:34px;box-shadow:0 30px 60px -30px rgba(199,85,23,.35),0 2px 0 rgba(255,255,255,.8) inset;position:relative;overflow:hidden}
.pw-art-card::before{content:'';position:absolute;inset:0;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:34px 34px;opacity:.35;mask-image:radial-gradient(circle at 50% 45%,transparent 30%,#000 100%);-webkit-mask-image:radial-gradient(circle at 50% 45%,transparent 30%,#000 100%)}
.pw-art-card img{position:relative;max-height:100%;width:auto}

/* sections */
.pw-section{padding:88px 0}
.pw-tint{background:var(--tint);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.pw-head{max-width:40rem;margin:0 auto 48px;text-align:center}
.pw-head-start{margin:0 0 8px;text-align:right}
.pw-head h2{font-size:clamp(1.6rem,3vw,2.2rem);font-weight:800;line-height:1.3;margin-bottom:12px}
.pw-head p:not(.pw-eyebrow){color:var(--ink-2);font-size:1.05rem}

.pw-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.pw-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:30px 26px;display:flex;flex-direction:column;gap:14px;transition:border-color .2s,box-shadow .2s,transform .2s}
.pw-card:hover{border-color:rgba(199,85,23,.45);box-shadow:0 18px 40px -22px rgba(199,85,23,.4);transform:translateY(-3px)}
.pw-icon{width:52px;height:52px;border-radius:14px;background:var(--o-soft);color:var(--o);display:flex;align-items:center;justify-content:center}
.pw-card h3{font-size:1.25rem;font-weight:800}
.pw-card>p{color:var(--ink-2);font-size:.97rem}
.pw-card ul{display:flex;flex-direction:column;gap:10px;margin-top:6px;padding-top:18px;border-top:1px solid var(--line)}
.pw-card li{display:flex;gap:10px;align-items:flex-start;font-size:.93rem;color:var(--ink)}
.pw-card li svg{flex:none;margin-top:5px;color:var(--o)}

.pw-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px;counter-reset:s}
.pw-steps li{background:#fff;border:1px solid var(--line);border-radius:18px;padding:26px 22px}
.pw-step-n{display:block;font-family:'Cairo',sans-serif;font-weight:800;font-size:1.9rem;line-height:1;color:var(--o);margin-bottom:14px}
.pw-steps h3{font-size:1.08rem;font-weight:800;margin-bottom:6px}
.pw-steps p{font-size:.92rem;color:var(--ink-2)}

.pw-projects{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;max-width:860px;margin:0 auto}
.pw-project{background:#fff;border:1px solid var(--line);border-radius:20px;padding:28px 26px;display:flex;flex-direction:column;gap:6px;border-top:4px solid var(--o)}
.pw-badge{align-self:flex-start;font-size:.78rem;font-weight:700;color:var(--o-dark);background:var(--o-soft);border-radius:999px;padding:3px 12px;margin-bottom:8px}
.pw-project h3{font-size:1.3rem;font-weight:800}
.pw-project>p{color:var(--ink-2)}
.pw-project dl{display:flex;gap:28px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
.pw-project dt{font-size:.78rem;color:var(--ink-2)}
.pw-project dd{font-weight:700}

.pw-contact{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
.pw-contact-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:28px 26px}
.pw-contact-card li{display:flex;justify-content:space-between;gap:16px;align-items:baseline;padding:14px 0;border-bottom:1px solid var(--line)}
.pw-contact-card li:first-child{padding-top:0}
.pw-contact-card li span{color:var(--ink-2);font-size:.9rem;flex:none}
.pw-contact-card li a,.pw-contact-card li strong{font-weight:700;text-align:left}
.pw-contact-card li a:hover{color:var(--o)}
.pw-muted{color:var(--ink-2)}
.pw-offices{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.pw-offices span{font-size:.85rem;font-weight:700;color:var(--ink);background:var(--tint);border:1px solid var(--line);border-radius:999px;padding:4px 14px}

/* footer */
.pw-footer{background:#1c2226;color:#d7dce0;padding:36px 0}
.pw-footer-row{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
.pw-footer-brand{display:flex;align-items:center;gap:14px}
.pw-footer-brand img{height:42px;width:auto}
.pw-footer-brand strong{display:block;font-size:1rem;color:#fff}
.pw-footer-brand small{color:#9aa5ad;font-size:.8rem}
.pw-footer-link{font-weight:700;font-size:.92rem;color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:8px 18px;transition:background .18s,border-color .18s}
.pw-footer-link:hover{background:var(--o);border-color:var(--o)}

@media (max-width:960px){
  .pw-hero-grid{grid-template-columns:1fr;gap:40px;padding-top:48px;padding-bottom:56px}
  .pw-hero-art{order:-1}
  .pw-art-card{max-width:220px;aspect-ratio:auto;padding:22px}
  .pw-cards{grid-template-columns:1fr}
  .pw-steps{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pw-contact{grid-template-columns:1fr;gap:28px}
  .pw-section{padding:64px 0}
}
@media (max-width:760px){
  .pw-burger{display:flex}
  .pw-nav{position:absolute;top:68px;inset-inline:0;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 18px 30px -18px rgba(20,28,34,.25);flex-direction:column;align-items:stretch;gap:0;padding:8px 20px 18px;display:none}
  .pw-nav.is-open{display:flex}
  .pw-nav a:not(.pw-btn){padding:14px 4px;border-bottom:1px solid var(--line)}
  .pw-nav-cta{margin-top:14px}
}
@media (max-width:600px){
  .pw-steps,.pw-projects{grid-template-columns:1fr}
  .pw-facts{grid-template-columns:1fr;gap:14px}
  .pw-actions .pw-btn{flex:1 1 100%}
}
@media (prefers-reduced-motion:reduce){.pw *{transition:none!important}}
`;
