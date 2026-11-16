"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { SERVICES, STEPS, mergeContent, type SiteContentOverride } from './site-content';
import { CSS } from './site-styles';
import EngTools from './EngTools';
import ChecklistExplorer from './ChecklistExplorer';
import HeroVideoBackdrop, { HeroVideoControls, type HeroVideoControlsState } from '@/components/HeroVideoBackdrop';
import LoginModal from './LoginModal';
import { CartButton, CartDrawer, useCustomerCart } from './CartDrawer';
import FloatingContactChat from './FloatingContactChat';
import HomePortalSections, { type HomePortalSectionId } from './HomePortalSections';
import {
  collectClientDeviceDetails,
  rememberVisitorContact,
} from '@/lib/client-device-info';

const BimModel = dynamic(() => import('./BimModel'), {
  ssr: false,
  loading: () => <div className="pw-bim-stage"><div className="pw-bim-note">جاري تحميل النموذج…</div></div>,
});

const CapitalTower3D = dynamic(() => import('./CapitalTower3D'), {
  ssr: false,
  loading: () => <div className="pw-bim-stage"><div className="pw-bim-note">جاري تحميل المجسم المعماري ثلاثي الأبعاد…</div></div>,
});

const NAV = [
  { href: '#portals', label: 'الأقسام' },
  { href: '/store?tab=maintenance', label: '🛠️ الصيانة والتنفيذ' },
  { href: '/store', label: '🧱 المتجر ومواد البناء' },
  { href: '/real-estate', label: '🏢 العقارات' },
  { href: '#capital-tower', label: 'المجسم 3D' },
  { href: '#tools', label: 'حاسبات المهندس' },
  { href: '#checklist', label: 'دليل التنفيذ' },
  { href: '/verify', label: 'التحقق' },
  { href: '#contact', label: 'تواصل' },
];

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
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    rememberVisitorContact({ name: cleanName, phone: cleanPhone });

    void collectClientDeviceDetails(false)
      .then((deviceDetails) =>
        fetch('/api/notify/visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'lead_action',
            action: 'inquiry_form',
            label: 'إرسال طلب معاينة ومقايسة',
            name: cleanName,
            phone: cleanPhone,
            projectKind: kind,
            projectLocation: place.trim(),
            notes: notes.trim(),
            deviceDetails,
          }),
          keepalive: true,
        })
      )
      .catch(() => {});

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

export default function PhiSite({ content, initialLoginOpen = false }: { content?: SiteContentOverride; initialLoginOpen?: boolean }) {
  const { SITE, PROJECTS, COMMITMENTS, FAQS, PRODUCTS, PROPERTIES, MAINTENANCE_SERVICES } = mergeContent(content);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [heroControls, setHeroControls] = useState<HeroVideoControlsState | null>(null);
  const [loginOpen, setLoginOpen] = useState(initialLoginOpen);
  const [activePortalSection, setActivePortalSection] = useState<HomePortalSectionId>('maintenance');
  const cart = useCustomerCart(() => setLoginOpen(true));

  const jumpToPortalSection = (id: HomePortalSectionId) => {
    setActivePortalSection(id);
    if (typeof document !== 'undefined') {
      const target = document.getElementById('portal-explorer') || document.getElementById('portals');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('login') === 'true' || window.location.hash === '#login') {
        setLoginOpen(true);
      }
    }
  }, []);

  const handleOpenLogin = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setOpen(false);
    setLoginOpen(true);
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.history.pushState(null, '', '/login');
    }
  };

  const handleCloseLogin = () => {
    setLoginOpen(false);
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/login') {
        router.push('/');
      } else if (window.location.search.includes('login') || window.location.hash === '#login') {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  };

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

  return (
    <div className={`pw ${loginOpen ? 'has-modal-blur' : ''}`} dir="rtl">
      <style>{CSS}</style>

      <header className={`pw-header is-scrolled pw-header-solid ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="pw-wrap pw-header-row">
          <a href="#top" className="pw-brand" aria-label={`${SITE.name} — الرئيسية`}>
            <img src="/brand/phitech-mark-color.svg" alt="" className="pw-brand-mark" />
            <span className="pw-brand-text"><strong>{SITE.name}</strong><small>{SITE.nameEn}</small></span>
          </a>
          <nav className={`pw-nav ${open ? 'is-open' : ''}`} aria-label="التنقل الرئيسي">
            <div className="pw-nav-head">
              <span className="pw-nav-head-title">
                <img src="/brand/phitech-mark-color.svg" alt="" style={{ height: '26px', width: 'auto' }} />
                <span>قائمة الموقع</span>
              </span>
              <button
                type="button"
                className="pw-nav-close"
                onClick={() => setOpen(false)}
                aria-label="إغلاق القائمة"
              >
                ✕ إغلاق
              </button>
            </div>
            {NAV.map(n => n.href.startsWith('#') ? (
              <a key={n.href} href={n.href} onClick={() => setOpen(false)}>
                <span>{n.label}</span>
                <span className="pw-nav-arrow" aria-hidden="true">←</span>
              </a>
            ) : (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="pw-nav-verify">
                <span>{n.label}</span>
                <span className="pw-nav-arrow" aria-hidden="true">←</span>
              </Link>
            ))}
            <CartButton
              count={cart.totalCount}
              onClick={() => {
                setOpen(false);
                cart.setCartOpen(true);
              }}
            />
            <a href="/login" className="pw-btn pw-btn-primary pw-nav-cta" onClick={handleOpenLogin}>
              {cart.user ? `👤 ${cart.user.fullName.split(' ')[0]}` : 'دخول النظام'}
            </a>
          </nav>
          <button className="pw-burger" aria-label="القائمة" aria-expanded={open} onClick={() => setOpen(v => !v)}><span /><span /><span /></button>
        </div>
      </header>

      <main id="top">
        {/* البوابات الستة الرئيسية + دلالة سهلة للاستخدام + مستكشف تفاصيل كل قسم + المستشار الذكي + أهم العروض والمنتجات */}
        <HomePortalSections
          activeSection={activePortalSection}
          onSelectSection={setActivePortalSection}
          services={SERVICES}
          commitments={COMMITMENTS}
          steps={STEPS}
          faqs={FAQS}
          products={PRODUCTS}
          properties={PROPERTIES}
          maintenanceServices={MAINTENANCE_SERVICES}
          whatsappNumber={c.whatsapp}
          onAddToCart={cart.addToCart}
          onAddBundleToCart={cart.addBundleToCart}
          cartCount={cart.totalCount}
          onOpenCart={() => cart.setCartOpen(true)}
        />

        {/* Capital Tower 3D -> BIM */}
        <section id="capital-tower" className="pw-section">
          <div className="pw-wrap">
            <div className="pw-head">
              <p className="pw-eyebrow">معرض المجسم المعماري ثلاثي الأبعاد والتحول إلى BIM</p>
              <h2>المجسم المعماري 3D — الواجهة، المدخل، ونماذج الوحدات السكنية</h2>
              <p>استعرض المجسم المعماري ثلاثي الأبعاد بكل تفاصيله المعمارية (الأركيد التجاري، المدخل والمصاعد، والمسقط المتكرر للوحدات)، وحوّله بضغطة واحدة إلى توأم رقمي BIM / IFC متكامل.</p>
            </div>
            <LazyMount minHeight={540}><CapitalTower3D /></LazyMount>
          </div>
        </section>

        {/* BIM */}
        <section id="bim" className="pw-section">
          <div className="pw-wrap">
            <div className="pw-head">
              <p className="pw-eyebrow">نموذج BIM تفاعلي — التوأم الرقمي</p>
              <h2>شاهد كيف تتكامل الطبقات الإنشائية والمعمارية وMEP داخل المبنى</h2>
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

        {/* عرض الهوية والشركة بالصوت والصورة (تم نقله إلى نهاية الصفحة بناءً على رغبة العميل) */}
        <section className="pw-hero" id="about-phitech">
          <HeroVideoBackdrop variant="showcase-left" controlsMode="none" onControlsReady={setHeroControls} />
          <div className="pw-wrap pw-hero-grid" id="hero-content">
            <div>
              <p className="pw-eyebrow">{SITE.tagline} · {SITE.offices.join(' • ')}</p>
              <h2>
                <span className="pw-hero-part">نبني <em>الهيكل</em>، ونُتقن <em>التشطيب</em>،</span>{' '}
                <span className="pw-hero-part">ونُنفّذ <em>التأسيسات</em></span>
              </h2>
              <p className="pw-lead">{SITE.intro}</p>
              <div className="pw-actions">
                <button
                  type="button"
                  onClick={() => jumpToPortalSection('maintenance')}
                  className="pw-btn pw-btn-primary"
                >
                  🛠️ الصيانة والتنفيذ
                </button>
                <button
                  type="button"
                  onClick={() => jumpToPortalSection('contracting')}
                  className="pw-btn pw-btn-light"
                  style={{ borderColor: 'rgba(249,115,22,0.75)', color: '#fed7aa' }}
                >
                  🏗️ المقاولات والتشطيبات
                </button>
                <button
                  type="button"
                  onClick={() => jumpToPortalSection('real_estate')}
                  className="pw-btn pw-btn-light"
                  style={{ borderColor: 'rgba(251,191,36,0.65)', color: '#fde68a' }}
                >
                  🏢 العقارات
                </button>
                <button
                  type="button"
                  onClick={() => jumpToPortalSection('building_materials')}
                  className="pw-btn pw-btn-light"
                >
                  🧱 مواد البناء
                </button>
                <button
                  type="button"
                  onClick={() => jumpToPortalSection('smart_tech')}
                  className="pw-btn pw-btn-light"
                  style={{ borderColor: 'rgba(16,185,129,0.65)', color: '#a7f3d0' }}
                >
                  📱 السمارت هوم والتكنولوجيا
                </button>
                <button
                  type="button"
                  onClick={() => jumpToPortalSection('general_info')}
                  className="pw-btn pw-btn-light"
                  style={{ borderColor: 'rgba(56,189,248,0.65)', color: '#bae6fd' }}
                >
                  📚 معلومات عامة
                </button>
              </div>
            </div>
            <div className="pw-hero-art" aria-hidden>
              <div className="pw-emblem"><img src="/brand/phitech-mark-light.svg" alt="" /></div>
            </div>
          </div>
          {heroControls && (
            <div className="pw-wrap pw-hero-toolbar">
              <HeroVideoControls controls={heroControls} />
              <a href="#portals" className="pw-mobile-scroll-cue" aria-label="العودة لأعلى لاختيار القسم">
                <span>العودة إلى الأقسام الستة</span>
                <span className="pw-cue-arrow" aria-hidden>↑</span>
              </a>
            </div>
          )}
          <ul className="pw-wrap pw-stats">
            <li><strong>6 أقسام متكاملة</strong><span>صيانة · مقاولات · عقارات · مواد · سمارت هوم</span></li>
            <li><strong>جهة تنفيذ واحدة</strong><span>إشراف هندسي وضمان موحّد</span></li>
            <li><strong>تجارب تفاعلية</strong><span>حاسبة 3×1 · مصمم سمارت · مجسم 3D</span></li>
            <li><strong>{SITE.offices.length} مكاتب</strong><span>{SITE.offices.join(' · ')}</span></li>
          </ul>
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
              {NAV.map(n => n.href.startsWith('#') ? (
                <a key={n.href} href={n.href}>{n.label}</a>
              ) : (
                <Link key={n.href} href={n.href}>{n.label}</Link>
              ))}
            </nav>
            <Link href="/verify" className="pw-footer-link" style={{ color: 'var(--o)', fontWeight: 'bold' }}>التحقق من صحة المستندات</Link>
            <a href="/login" className="pw-footer-link" onClick={handleOpenLogin}>دخول النظام</a>
          </div>
          <p className="pw-footer-bottom">© {new Date().getFullYear()} {SITE.name} — جميع الحقوق محفوظة</p>
        </div>
      </footer>

      {/* Spacer for mobile dock */}
      <div className="pw-dock-pad" aria-hidden="true" />

      {/* Mobile Fixed Bottom Action Bar / Dock */}
      <nav className="pw-mobile-dock" aria-label="شريط الوصول السريع">
        <a href="#top" className="pw-dock-item" onClick={() => setOpen(false)}>
          <span className="pw-dock-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </span>
          <span className="pw-dock-label">الرئيسية</span>
        </a>

        <Link href="/store" className="pw-dock-item" onClick={() => setOpen(false)}>
          <span className="pw-dock-icon">🛒</span>
          <span className="pw-dock-label">المنتجات</span>
        </Link>

        <button
          type="button"
          className="pw-dock-item pw-dock-cta"
          onClick={() => (cart.user ? cart.setCartOpen(true) : handleOpenLogin())}
          aria-label="السلة / دخول النظام"
        >
          <span className="pw-dock-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </span>
          <span className="pw-dock-label">
            {cart.totalCount > 0 ? `السلة (${cart.totalCount})` : cart.user ? 'السلة' : 'دخول / سلة'}
          </span>
        </button>

        <Link href="/real-estate" className="pw-dock-item" onClick={() => setOpen(false)}>
          <span className="pw-dock-icon">🏢</span>
          <span className="pw-dock-label">العقارات</span>
        </Link>

        <button
          type="button"
          className={`pw-dock-item ${open ? 'is-active' : ''}`}
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          aria-expanded={open}
        >
          <span className="pw-dock-icon">
            {open ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            )}
          </span>
          <span className="pw-dock-label">{open ? 'إغلاق' : 'القائمة'}</span>
        </button>
      </nav>

      <CartDrawer
        isOpen={cart.cartOpen}
        onClose={() => cart.setCartOpen(false)}
        user={cart.user}
        items={cart.items}
        totalAmount={cart.totalAmount}
        onUpdateQty={cart.updateQty}
        onToggleInstall={cart.toggleItemInstall}
        onRemoveItem={cart.removeItem}
        onClearCart={cart.clearCart}
        onRequireLogin={() => setLoginOpen(true)}
        whatsappNumber={SITE.contact.whatsapp}
      />

      <FloatingContactChat
        whatsappNumber={SITE.contact.whatsapp}
        defaultName={cart.user?.fullName || ''}
        defaultPhone={cart.user?.phone || ''}
        contextLabel="الصفحة الرئيسية — فاي تك"
      />

      <LoginModal isOpen={loginOpen} onClose={handleCloseLogin} />
    </div>
  );
}
