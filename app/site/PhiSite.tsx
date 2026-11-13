"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { SERVICES, STEPS, mergeContent, type SiteContentOverride } from './site-content';
import { CSS } from './site-styles';
import EngTools from './EngTools';
import ChecklistExplorer from './ChecklistExplorer';
import HeroVideoBackdrop, { HeroVideoControls, type HeroVideoControlsState } from '@/components/HeroVideoBackdrop';

const BimModel = dynamic(() => import('./BimModel'), {
  ssr: false,
  loading: () => <div className="pw-bim-stage"><div className="pw-bim-note">جاري تحميل النموذج…</div></div>,
});

const CapitalTower3D = dynamic(() => import('./CapitalTower3D'), {
  ssr: false,
  loading: () => <div className="pw-bim-stage"><div className="pw-bim-note">جاري تحميل مجسم برج كابيتال ثلاثي الأبعاد…</div></div>,
});

const NAV = [
  { href: '#services', label: 'الخدمات' },
  { href: '#capital-tower', label: 'برج كابيتال 3D' },
  { href: '#bim', label: 'نموذج BIM' },
  { href: '#tools', label: 'الأدوات' },
  { href: '#checklist', label: 'دليل وبطاقات التنفيذ' },
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

/** يركّب المحتوى الثقيل (نموذج 3D) لما القسم يقرب من الشاشة بس. */
function LazyMount({ children, minHeight = 440 }: { children: React.ReactNode; minHeight?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || on) return;
    if (typeof IntersectionObserver === 'undefined') { setOn(true); return; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setOn(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [on]);
  return <div ref={ref} style={{ minHeight: on ? undefined : minHeight }}>{on ? children : null}</div>;
}

function InquiryForm({ whatsapp, email }: { whatsapp: string; email: string }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [kind, setKind] = useState('فيلا');
  const [place, setPlace] = useState('');
  const [notes, setNotes] = useState('');

  const message = () => [
    'طلب معاينة ومقايسة',
    `الاسم: ${name || '—'}`,
    phone && `الهاتف: ${phone}`,
    `نوع المشروع: ${kind}`,
    place && `الموقع: ${place}`,
    notes && `تفاصيل: ${notes}`,
  ].filter(Boolean).join('\n');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = message();
    if (whatsapp) window.open(`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    else if (email) window.location.href = `mailto:${email}?subject=${encodeURIComponent('طلب معاينة ومقايسة')}&body=${encodeURIComponent(text)}`;
  };

  return (
    <form className="pw-form" onSubmit={submit}>
      <div className="pw-grid2">
        <label className="pw-field"><span>الاسم</span><input value={name} onChange={e => setName(e.target.value)} required autoComplete="name" /></label>
        <label className="pw-field"><span>رقم الهاتف</span><input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" dir="ltr" /></label>
      </div>
      <div className="pw-grid2">
        <label className="pw-field"><span>نوع المشروع</span>
          <select value={kind} onChange={e => setKind(e.target.value)}>
            {['فيلا', 'عمارة / برج', 'تشطيب وحدة', 'مبنى تجاري', 'أخرى'].map(k => <option key={k}>{k}</option>)}
          </select>
        </label>
        <label className="pw-field"><span>موقع المشروع</span><input value={place} onChange={e => setPlace(e.target.value)} /></label>
      </div>
      <label className="pw-field"><span>تفاصيل إضافية</span><textarea value={notes} onChange={e => setNotes(e.target.value)} /></label>
      <button type="submit" className="pw-btn pw-btn-primary">{whatsapp ? 'إرسال الطلب عبر واتساب' : 'إرسال الطلب بالبريد'}</button>
      <p className="pw-note">لن نحفظ بياناتك على الموقع؛ سيُفتح تطبيق {whatsapp ? 'واتساب' : 'البريد'} بالرسالة جاهزة لتراجعها وترسلها بنفسك.</p>
    </form>
  );
}

export default function PhiSite({ content }: { content?: SiteContentOverride }) {
  const { SITE, PROJECTS, COMMITMENTS, FAQS } = mergeContent(content);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [heroControls, setHeroControls] = useState<HeroVideoControlsState | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const c = SITE.contact;
  const waDigits = c.whatsapp.replace(/\D/g, '');
  const contactRows = [
    c.phone && { label: 'الهاتف', value: c.phone, href: `tel:${c.phone.replace(/\s+/g, '')}`, dir: 'ltr' as const },
    waDigits && { label: 'واتساب', value: 'ابدأ محادثة', href: `https://wa.me/${waDigits}`, dir: 'rtl' as const },
    c.email && { label: 'البريد الإلكتروني', value: c.email, href: `mailto:${c.email}`, dir: 'ltr' as const },
    c.address && { label: 'العنوان', value: c.address, href: '', dir: 'rtl' as const },
    c.hours && { label: 'ساعات العمل', value: c.hours, href: '', dir: 'rtl' as const },
  ].filter(Boolean) as { label: string; value: string; href: string; dir: 'ltr' | 'rtl' }[];

  const primaryContact = waDigits
    ? { href: `https://wa.me/${waDigits}`, label: 'تواصل عبر واتساب', external: true }
    : c.phone
      ? { href: `tel:${c.phone.replace(/\s+/g, '')}`, label: 'اتصل بنا', external: false }
      : { href: '#contact', label: 'تواصل معنا', external: false };

  return (
    <div className="pw" dir="rtl">
      <style>{CSS}</style>

      <header className={`pw-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="pw-wrap pw-header-row">
          <a href="#top" className="pw-brand" aria-label={`${SITE.name} — الرئيسية`}>
            <img src="/brand/phitech-mark-color.svg" alt="" className="pw-brand-mark" />
            <span className="pw-brand-text"><strong>{SITE.name}</strong><small>{SITE.nameEn}</small></span>
          </a>
          <nav className={`pw-nav ${open ? 'is-open' : ''}`} aria-label="التنقل الرئيسي">
            {NAV.map(n => (<a key={n.href} href={n.href} onClick={() => setOpen(false)}>{n.label}</a>))}
            <Link href="/login" className="pw-btn pw-btn-primary pw-nav-cta" onClick={() => setOpen(false)}>دخول النظام</Link>
          </nav>
          <button className="pw-burger" aria-label="القائمة" aria-expanded={open} onClick={() => setOpen(v => !v)}><span /><span /><span /></button>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="pw-hero">
          <HeroVideoBackdrop variant="showcase-left" controlsMode="none" onControlsReady={setHeroControls} />
          <div className="pw-wrap pw-hero-grid" id="hero-content">
            <div>
              <p className="pw-eyebrow">{SITE.tagline} · {SITE.offices.join(' • ')}</p>
              <h1>
                <span className="pw-hero-part">نبني <em>الهيكل</em>، ونُتقن <em>التشطيب</em>،</span>{' '}
                <span className="pw-hero-part">ونُنفّذ <em>التأسيسات</em></span>
              </h1>
              <p className="pw-lead">{SITE.intro}</p>
              <div className="pw-actions">
                <a href={primaryContact.href} className="pw-btn pw-btn-primary" {...(primaryContact.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{primaryContact.label}</a>
                <a href="#capital-tower" className="pw-btn pw-btn-light">برج كابيتال 3D</a>
                <a href="#bim" className="pw-btn pw-btn-light">استكشف نموذج BIM</a>
              </div>
            </div>
            <div className="pw-hero-art" aria-hidden>
              <div className="pw-emblem"><img src="/brand/phitech-mark-light.svg" alt="" /></div>
            </div>
          </div>
          {heroControls && (
            <div className="pw-wrap pw-hero-toolbar">
              <HeroVideoControls controls={heroControls} />
              <a href="#hero-content" className="pw-mobile-scroll-cue" aria-label="التمرير لبقية محتوى الصفحة">
                <span>اسحب للأسفل لاستعراض التفاصيل</span>
                <span className="pw-cue-arrow" aria-hidden>↓</span>
              </a>
            </div>
          )}
          <ul className="pw-wrap pw-stats">
            <li><strong>3 قطاعات</strong><span>إنشاء · تشطيب · تأسيسات</span></li>
            <li><strong>جهة تنفيذ واحدة</strong><span>مسؤولية موحّدة</span></li>
            <li><strong>مخططات تنفيذية</strong><span>قبل أول يوم عمل</span></li>
            <li><strong>{SITE.offices.length} مكاتب</strong><span>{SITE.offices.join(' · ')}</span></li>
          </ul>
        </section>

        {/* Commitments */}
        <section className="pw-section" aria-labelledby="trust-h">
          <div className="pw-wrap">
            <div className="pw-head">
              <p className="pw-eyebrow">كيف نعمل</p>
              <h2 id="trust-h">التزامات تحكم كل مشروع</h2>
              <p>أربعة مبادئ نطبّقها في كل موقع، بصرف النظر عن حجم المشروع.</p>
            </div>
            <ul className="pw-trust">
              {COMMITMENTS.map((t, i) => (
                <li key={t.title}><span className="pw-trust-n">0{i + 1}</span><h3>{t.title}</h3><p>{t.text}</p></li>
              ))}
            </ul>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="pw-section pw-tint">
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
                  <ul>{s.items.map(i => (<li key={i}><Check /><span>{i}</span></li>))}</ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Capital Tower 3D -> BIM */}
        <section id="capital-tower" className="pw-section">
          <div className="pw-wrap">
            <div className="pw-head">
              <p className="pw-eyebrow">معرض برج كابيتال المعماري ثلاثي الأبعاد والتحول إلى BIM</p>
              <h2>برج كابيتال 3D — الواجهة، المدخل الفندقي، والشقق 140 / 185 / 205 م²</h2>
              <p>استعرض نموذج برج كابيتال ثلاثي الأبعاد بكل تفاصيله المعمارية (الأركيد التجاري، المدخل الرخامي والمصاعد، المسقط المتكرر والوحدات المفروشة)، وحوّله بضغطة واحدة إلى توأم رقمي BIM / IFC متكامل.</p>
            </div>
            <LazyMount minHeight={540}><CapitalTower3D /></LazyMount>
          </div>
        </section>

        {/* BIM */}
        <section id="bim" className="pw-section">
          <div className="pw-wrap">
            <div className="pw-head">
              <p className="pw-eyebrow">نموذج BIM تفاعلي — برج كابيتال</p>
              <h2>شاهد كيف تتكامل الطبقات الإنشائية والمعمارية وMEP داخل البرج</h2>
              <p>أخفِ الطبقات وأظهرها، افصل الأدوار الـ 12 + البوديوم، اقطع المستويات أفقياً، واضغط على أي عنصر لعرض فئته في معيار IFC وحصره التقديري.</p>
            </div>
            <LazyMount minHeight={500}><BimModel /></LazyMount>
          </div>
        </section>

        {/* Tools */}
        <section id="tools" className="pw-section pw-tint">
          <div className="pw-wrap">
            <div className="pw-head">
              <p className="pw-eyebrow">أدوات المهندس</p>
              <h2>حاسبات ومعاملات تحويل مجانية</h2>
              <p>محوّل وحدات بمعاملات قياسية، وتقدير سريع للخرسانة والحديد والبلاط والدهان. للاسترشاد الأولي، وليست بديلًا عن المقايسة.</p>
            </div>
            <EngTools />
          </div>
        </section>

        {/* Execution Guide & Inspection checklist */}
        <section id="checklist" className="pw-section">
          <div className="pw-wrap">
            <div className="pw-head">
              <p className="pw-eyebrow">منظومة الجودة والتنفيذ الميداني</p>
              <h2>دليل وبطاقات التنفيذ الهندسي وقوائم التفقد</h2>
              <p>منظومة تنفيذية شاملة لكل بند ترتكز على محاور هندسية: ما يسبقه، الاعتمادات، الحسابات والكميات، ما يُراجع قبل التنفيذ، تسلسل الخطوات، الاستلام والتسليم، مسار الاعتماد، وأسعار استرشادية محدثة (نوفمبر 2026)، بجانب قائمة التفقد التفاعلية.</p>
            </div>
            <ChecklistExplorer />
          </div>
        </section>

        {/* Process */}
        <section id="process" className="pw-section">
          <div className="pw-wrap">
            <div className="pw-head">
              <p className="pw-eyebrow">طريقة العمل</p>
              <h2>من المعاينة إلى التسليم</h2>
            </div>
            <ol className="pw-steps">
              {STEPS.map(s => (<li key={s.n}><span className="pw-step-n">{s.n}</span><h3>{s.title}</h3><p>{s.text}</p></li>))}
            </ol>
          </div>
        </section>

        {/* Projects */}
        {PROJECTS.length > 0 && (
          <section id="projects" className="pw-section pw-tint">
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

        {/* FAQ */}
        <section id="faq" className="pw-section">
          <div className="pw-wrap">
            <div className="pw-head pw-head-center">
              <p className="pw-eyebrow">أسئلة شائعة</p>
              <h2>قبل أن تتواصل معنا</h2>
            </div>
            <div className="pw-faq">
              {FAQS.map(f => (<details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="pw-section pw-tint">
          <div className={`pw-wrap pw-contact ${waDigits || c.email ? '' : 'pw-contact-solo'}`}>
            <div>
              <div className="pw-head" style={{ marginBottom: 20 }}>
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
                ) : (<p className="pw-muted">بيانات التواصل قيد الإضافة.</p>)}
                <div className="pw-offices">{SITE.offices.map(o => (<span key={o}>{o}</span>))}</div>
              </div>
            </div>
            {(waDigits || c.email) && (
              <div className="pw-contact-card"><InquiryForm whatsapp={c.whatsapp} email={c.email} /></div>
            )}
          </div>
        </section>
      </main>

      <footer className="pw-footer">
        <div className="pw-wrap">
          <div className="pw-footer-row">
            <div className="pw-footer-brand">
              <img src="/brand/phitech-mark-light.svg" alt="" />
              <div><strong>{SITE.legalName}</strong><small>{SITE.offices.join(' · ')}</small></div>
            </div>
            <nav className="pw-footer-nav" aria-label="روابط التذييل">
              {NAV.map(n => (<a key={n.href} href={n.href}>{n.label}</a>))}
            </nav>
            <Link href="/login" className="pw-footer-link">دخول النظام</Link>
          </div>
          <p className="pw-footer-bottom">© {new Date().getFullYear()} {SITE.name} — جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </div>
  );
}
