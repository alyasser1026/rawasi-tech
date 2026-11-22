export const CSS = `
.pw{--o:#c75517;--o-hi:#e57024;--o-dark:#a64310;--o-soft:#fff3ea;--ink:#14181b;--ink-2:#47525c;--line:#e7e1d7;--bg:#fbfaf7;--tint:#f4efe6;--g1:#161b1f;--g2:#0e1215;--sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-5:20px;--sp-6:24px;--sp-8:32px;--sp-10:40px;--sp-12:48px;--sp-16:64px;--sp-20:80px;--sp-24:96px;--r-btn-sm:8px;--r-btn:10px;--r-card-sm:12px;--r-card:16px;--r-pill:9999px;--ui-btn-h:44px;--ui-btn-px:20px;--ui-btn-py:10px;--ui-btn-fs:.9375rem;--ui-btn-icon:18px;--ui-btn-gap:8px;--ui-btn-r:10px;--ui-card-pad:24px;--ui-card-pad-sm:20px;--ui-card-r:16px;--ui-gap:24px;--ui-section-py:88px;--ui-wrap-max:1280px;--ui-input-h:44px;--ui-prod-min:260px;
  position:relative;min-height:100vh;background:var(--bg);color:var(--ink);font-family:'Cairo',-apple-system,'Segoe UI',sans-serif;line-height:1.75;letter-spacing:0;-webkit-font-smoothing:antialiased;overflow-x:clip}
html[data-site-size="sm"]:has(.pw){font-size:14.5px}
html[data-site-size="sm"] .pw{--ui-btn-h:36px;--ui-btn-px:12px;--ui-btn-py:6px;--ui-btn-fs:.8125rem;--ui-btn-icon:16px;--ui-btn-gap:6px;--ui-btn-r:8px;--ui-card-pad:16px;--ui-card-pad-sm:12px;--ui-card-r:12px;--ui-gap:16px;--ui-section-py:56px;--ui-wrap-max:1200px;--ui-input-h:36px;--ui-prod-min:225px}
html[data-site-size="md"]:has(.pw){font-size:16px}
html[data-site-size="md"] .pw{--ui-btn-h:44px;--ui-btn-px:20px;--ui-btn-py:10px;--ui-btn-fs:.9375rem;--ui-btn-icon:18px;--ui-btn-gap:8px;--ui-btn-r:10px;--ui-card-pad:24px;--ui-card-pad-sm:20px;--ui-card-r:16px;--ui-gap:24px;--ui-section-py:88px;--ui-wrap-max:1280px;--ui-input-h:44px;--ui-prod-min:260px}
html[data-site-size="lg"]:has(.pw){font-size:17px}
html[data-site-size="lg"] .pw{--ui-btn-h:48px;--ui-btn-px:24px;--ui-btn-py:12px;--ui-btn-fs:1rem;--ui-btn-icon:20px;--ui-btn-gap:8px;--ui-btn-r:10px;--ui-card-pad:28px;--ui-card-pad-sm:24px;--ui-card-r:16px;--ui-gap:28px;--ui-section-py:104px;--ui-wrap-max:1360px;--ui-input-h:48px;--ui-prod-min:300px}
html[data-site-size="xl"]:has(.pw){font-size:18px}
html[data-site-size="xl"] .pw{--ui-btn-h:56px;--ui-btn-px:32px;--ui-btn-py:16px;--ui-btn-fs:1.125rem;--ui-btn-icon:22px;--ui-btn-gap:8px;--ui-btn-r:12px;--ui-card-pad:32px;--ui-card-pad-sm:24px;--ui-card-r:20px;--ui-gap:32px;--ui-section-py:120px;--ui-wrap-max:1440px;--ui-input-h:56px;--ui-prod-min:340px}
.pw *{box-sizing:border-box}
html:has(.pw),body:has(.pw){overflow-x:clip!important}
body:has(.pw){padding:0!important}
.pw.has-modal-blur > header,
.pw.has-modal-blur > main,
.pw.has-modal-blur > footer,
.pw.has-modal-blur > .pw-mobile-dock {
  pointer-events: none;
  user-select: none;
}
.pw main#top{padding:0!important;border-radius:0!important;margin:0!important;box-shadow:none!important;width:100%!important}
:where(.pw) :is(h1,h2,h3,h4,p,ul,ol,dl,dd,figure,table,caption){margin:0;padding:0}
:where(.pw) :is(ul,ol){list-style:none}
:where(.pw) a{color:inherit;text-decoration:none}
:where(.pw) img{max-width:100%;display:block}
:where(.pw) :is(button,input,select,textarea){font-family:inherit;font-size:inherit;color:inherit}
.pw-wrap{width:100%;max-width:var(--ui-wrap-max,1280px);margin-inline:auto;padding-inline:40px}
.pw-wrap-wide{max-width:1360px}
.pw-wrap-prose{max-width:720px}
@media (max-width:1279px){.pw-wrap{padding-inline:32px}}
@media (max-width:1023px){.pw-wrap{padding-inline:24px}}
@media (max-width:639px){.pw-wrap{padding-inline:16px}}
.pw-muted{color:var(--ink-2)}

/* header */
.pw-header{position:sticky;top:0;z-index:60;margin-bottom:-72px;background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none;border-bottom:1px solid transparent;transition:background .25s ease,border-color .25s ease,box-shadow .25s ease,backdrop-filter .25s ease}
.pw-header.is-scrolled{background:rgba(10,14,20,.92);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom-color:rgba(255,255,255,.12);box-shadow:0 8px 30px rgba(0,0,0,.45)}
.pw-header.pw-header-solid{margin-bottom:0!important;background:rgba(12,16,22,.68)!important;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid rgba(255,255,255,.12)}
.pw-header.pw-header-glass{margin-bottom:-72px!important;background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;border-bottom:1px solid transparent!important;box-shadow:none!important}
.pw-header.pw-header-glass.is-scrolled{background:rgba(251,250,247,.78)!important;backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important;box-shadow:0 4px 20px rgba(20,24,27,.06)!important;border-bottom-color:rgba(20,24,27,.08)!important}
.pw-header.pw-header-glass .pw-brand-text strong{color:#14181b!important;text-shadow:0 1px 8px rgba(255,255,255,.8)!important}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass{background:rgba(251,250,247,.66)!important;backdrop-filter:blur(14px)!important;-webkit-backdrop-filter:blur(14px)!important;border-bottom:1px solid rgba(20,24,27,.08)!important}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass.is-scrolled{background:rgba(251,250,247,.78)!important;backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important;border-bottom-color:rgba(20,24,27,.10)!important;box-shadow:0 4px 20px rgba(20,24,27,.06)!important}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass .pw-brand-text strong,.pw-header.pw-header-glass.is-scrolled .pw-brand-text strong{color:#14181b!important;text-shadow:none!important}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass .pw-nav a:not(.pw-btn),.pw-header.pw-header-glass.is-scrolled .pw-nav a:not(.pw-btn){color:#14181b!important;text-shadow:none!important}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass .pw-nav a:not(.pw-btn):hover,.pw:has(.pw-split-stage) .pw-header.pw-header-glass .pw-nav a.is-nav-active:not(.pw-btn){color:#c75517!important}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass .phi-cart-btn{color:#14181b!important;background:rgba(20,24,27,.05)!important;border-color:rgba(20,24,27,.14)!important}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass .pw-nav-portal.is-guest{background:rgba(20,24,27,.05)!important;color:#14181b!important;border-color:rgba(20,24,27,.14)!important}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass .pw-burger{background:rgba(20,24,27,.05);border-color:rgba(20,24,27,.14)}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass .pw-burger span{background:#14181b}
.pw-header.pw-header-glass .pw-brand-mark{filter:none!important}
@keyframes phiBrandArrive{0%{transform:scale(1);filter:drop-shadow(0 0 0 rgba(199,85,23,0))}36%{transform:scale(1.18);filter:drop-shadow(0 0 20px rgba(201,119,45,.9))}70%{transform:scale(.96)}100%{transform:scale(1);filter:drop-shadow(0 0 0 rgba(199,85,23,0))}}
@keyframes phiBrandRipple{0%{opacity:.85;transform:scale(.7)}100%{opacity:0;transform:scale(2.15)}}
.pw-brand{position:relative}
.pw-brand.phi-brand-landed .pw-brand-mark{animation:phiBrandArrive 1.05s cubic-bezier(.22,1,.36,1)}
.pw-brand.phi-brand-landed::before{content:'';position:absolute;inset-inline-start:-4px;top:50%;width:52px;height:52px;margin-top:-26px;border-radius:999px;border:2px solid rgba(201,119,45,.7);pointer-events:none;animation:phiBrandRipple .95s cubic-bezier(.16,1,.3,1) forwards}
.pw-header.pw-header-glass .pw-nav a:not(.pw-btn){color:#14181b!important;text-shadow:0 1px 8px rgba(255,255,255,.85)!important}
.pw-header.pw-header-glass .pw-nav a:not(.pw-btn):hover,.pw-header.pw-header-glass .pw-nav a.is-nav-active:not(.pw-btn){color:#c75517!important}
.pw-header.pw-header-glass .pw-nav a.is-nav-active:not(.pw-btn)::after{transform:scaleX(1)}
.pw-header.pw-header-glass .pw-burger{background:rgba(255,255,255,.38);backdrop-filter:blur(6px);border-color:rgba(20,24,27,.14)}
.pw-header.pw-header-glass .pw-burger span{background:#14181b}
.pw-header.pw-header-glass .phi-cart-btn{color:#14181b!important;background:rgba(255,255,255,.32)!important;backdrop-filter:blur(6px);border-color:rgba(20,24,27,.16)!important}
@media (max-width:960px){.pw-header.pw-header-glass .pw-nav.is-open a:not(.pw-btn){color:#14181b!important;text-shadow:none!important}.pw-header.pw-header-glass .pw-nav.is-open a.is-nav-active:not(.pw-btn){color:#c75517!important}}
.pw-header-row{display:flex;align-items:center;justify-content:space-between;height:72px;gap:14px}
.pw-brand{display:flex;align-items:center;gap:12px;flex-shrink:0}
.pw-brand-mark{height:44px;width:auto;filter:drop-shadow(0 0 1px rgba(255,255,255,.45)) drop-shadow(0 2px 8px rgba(0,0,0,.5))}
.pw-brand-text{display:flex;flex-direction:column;gap:4px;line-height:1.35}
.pw-brand-text strong{font-size:19px;font-weight:900;line-height:1.3;letter-spacing:0;display:block;color:#fefcf9;text-shadow:0 2px 10px rgba(0,0,0,.6)}
.pw-brand-text small{font-size:11px;font-weight:800;letter-spacing:.16em;line-height:1.15;color:#f97316;direction:ltr;unicode-bidi:isolate;text-align:right;display:block}
.pw-nav{display:flex;align-items:center;gap:12px;font-weight:600;font-size:13.5px;color:#ebe6de;white-space:nowrap}
.pw-nav a.pw-nav-verify{color:#fb923c!important;font-weight:800;text-shadow:0 0 14px rgba(249,115,22,.4)}
.pw-nav a.pw-nav-verify:hover{color:#fdba74!important;text-shadow:0 0 18px rgba(249,115,22,.65)}
.pw-nav a:not(.pw-btn){position:relative;padding:6px 0;color:#ede5da;transition:color .2s ease,text-shadow .2s ease}
.pw-nav a:not(.pw-btn)::after{content:'';position:absolute;inset-inline:0;bottom:0;height:2px;background:#f97316;transform:scaleX(0);transition:transform .2s;transform-origin:center}
.pw-nav a:not(.pw-btn):hover{color:#ffffff;text-shadow:0 0 12px rgba(255,255,255,.5)}
.pw-nav a:not(.pw-btn):hover::after{transform:scaleX(1)}
.pw-nav-head{display:none}
.pw-nav-arrow{display:none}
.pw-header-end{display:inline-flex;align-items:center;gap:8px;flex-shrink:0}
.pw-lite-btn{height:34px;padding:0 12px;border-radius:var(--r-pill);background:rgba(255,255,255,.78);border:1px solid rgba(20,24,27,.14);color:#47525c;font-family:inherit;font-size:12px;font-weight:800;line-height:1;cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;flex-shrink:0;transition:background .16s ease,color .16s ease,border-color .16s ease}
.pw-lite-btn:hover{color:#14181b;border-color:rgba(199,85,23,.45);background:#ffffff}
.pw-lite-btn.is-active{background:#c75517;border-color:#c75517;color:#ffffff;box-shadow:0 4px 10px -4px rgba(199,85,23,.5)}
.pw-scale-switch{display:inline-flex;align-items:center;gap:2px;padding:3px;border-radius:var(--r-pill);background:rgba(255,255,255,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(20,24,27,.14);box-shadow:0 4px 12px -8px rgba(20,24,27,.18);direction:ltr;flex-shrink:0}
.pw-scale-btn{min-width:28px;height:28px;padding:0 6px;border:0;border-radius:var(--r-pill);background:transparent;color:#525e6a;font-family:inherit;font-size:11px;font-weight:800;letter-spacing:.03em;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .16s ease,color .16s ease,box-shadow .16s ease}
.pw-scale-btn:hover{color:#14181b;background:rgba(20,24,27,.06)}
.pw-scale-btn.is-active{background:#14181b;color:#ffffff;box-shadow:0 4px 10px -4px rgba(20,24,27,.45)}
.pw-header.pw-header-solid .pw-scale-switch{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.18)}
.pw-header.pw-header-solid .pw-scale-btn{color:#cbd5e1}
.pw-header.pw-header-solid .pw-scale-btn.is-active{background:var(--o);color:#ffffff}
@media (min-width:981px) and (max-width:1220px){.pw-header-row{gap:10px}.pw-nav{gap:8px;font-size:12.5px}.pw-nav-cta,.pw-nav-portal{padding:6px 10px;font-size:12px}}
.pw-burger{display:none;width:44px;height:44px;border:1px solid rgba(255,255,255,.2);background:rgba(15,20,28,.65);backdrop-filter:blur(10px);border-radius:var(--r-btn);cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:4px}
.pw-burger span{display:block;width:20px;height:2px;background:#ede5da;border-radius:2px}

/* buttons (8pt Grid: SM 36px, MD 44px, LG 48px, XL 56px) */
.pw-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--ui-btn-gap);min-height:var(--ui-btn-h);padding:var(--ui-btn-py) var(--ui-btn-px);border-radius:var(--ui-btn-r);font-weight:700;font-size:var(--ui-btn-fs);line-height:1.25;cursor:pointer;border:1.5px solid transparent;transition:background .18s,border-color .18s,color .18s,box-shadow .18s}
.pw-btn svg{width:var(--ui-btn-icon);height:var(--ui-btn-icon);flex-shrink:0}
.pw-btn-sm{min-height:36px;padding:6px 12px;font-size:.8125rem;gap:6px;border-radius:var(--r-btn-sm)}
.pw-btn-sm svg{width:16px;height:16px}
.pw-btn-md{min-height:var(--ui-btn-h);padding:var(--ui-btn-py) var(--ui-btn-px);font-size:var(--ui-btn-fs);gap:var(--ui-btn-gap);border-radius:var(--ui-btn-r)}
.pw-btn-lg{min-height:48px;padding:12px 24px;font-size:1rem;gap:8px;border-radius:var(--r-btn)}
.pw-btn-lg svg{width:20px;height:20px}
.pw-btn-xl{min-height:56px;padding:16px 32px;font-size:1.125rem;gap:8px;border-radius:var(--r-btn)}
.pw-btn-xl svg{width:22px;height:22px}
html[data-site-size="sm"] .pw .pw-btn-lg{min-height:40px;padding:8px 16px;font-size:.875rem}
html[data-site-size="lg"] .pw .pw-btn-lg{min-height:52px;padding:14px 28px;font-size:1.0625rem}
html[data-site-size="xl"] .pw .pw-btn-lg{min-height:56px;padding:16px 32px;font-size:1.125rem}
.pw-icon-btn{display:inline-grid;place-items:center;width:40px;height:40px;padding:0;border-radius:var(--r-btn);cursor:pointer}
.pw-icon-btn-sm{width:32px;height:32px;border-radius:var(--r-btn-sm)}
.pw-icon-btn-lg{width:48px;height:48px}
.pw-btn-primary{background:var(--o);color:#fff;box-shadow:0 10px 24px -12px rgba(199,85,23,.8)}
.pw-btn-primary:hover{background:var(--o-dark)}
.pw-btn-ghost{background:#fff;color:var(--ink);border-color:var(--line)}
.pw-btn-ghost:hover{border-color:var(--o);color:var(--o)}
.pw-btn-light{background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.28)}
.pw-btn-light:hover{background:rgba(255,255,255,.16);border-color:#fff}
.pw-nav-cta{min-height:38px;padding:7px 14px;font-size:13px;border-radius:10px}
.pw-nav-portal{min-height:38px;padding:7px 14px;border-radius:10px;font-size:13px;font-weight:800;background:#14181b;color:#fff!important;border:1px solid rgba(20,24,27,.18);box-shadow:0 8px 18px -10px rgba(20,24,27,.4)}
.pw-header .phi-cart-btn{height:38px!important;min-height:38px!important;padding:0 12px!important;font-size:13px!important;border-radius:10px!important}
.pw-nav-portal.is-guest{background:rgba(20,24,27,.07);color:#14181b!important;border-color:rgba(20,24,27,.18);box-shadow:none}
.pw-nav-portal:hover{background:#0f172a;color:#fff!important;border-color:#0f172a}
.pw-nav-portal.is-ready{background:linear-gradient(135deg,#0f172a,#1e293b);border-color:rgba(249,115,22,.45)}
.pw-nav-portal.is-ready:hover{background:var(--o);border-color:var(--o)}
.pw-user-wrap{position:relative}
.pw-user-menu{position:absolute;top:calc(100% + 8px);inset-inline-end:0;width:256px;background:#ffffff;color:var(--ink);border:1.5px solid var(--line);border-radius:var(--r-card);padding:8px;box-shadow:0 24px 48px -16px rgba(15,20,25,.28);display:flex;flex-direction:column;gap:4px;z-index:120;white-space:normal}
.pw-user-menu-head{padding:8px 12px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:4px;margin-bottom:4px}
.pw-user-menu-head strong{font-size:.9rem;font-weight:900;color:var(--ink)}
.pw-user-menu-head small{font-size:.73rem;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis}
.pw-user-role-tag{align-self:flex-start;margin-top:4px;padding:2px 8px;border-radius:999px;font-size:.69rem;font-weight:800;background:var(--tint);color:var(--ink-2);border:1px solid var(--line)}
.pw-user-role-tag.is-staff{background:#fff3ea;color:#c75517;border-color:#fed7aa}
.pw-header.pw-header-glass .pw-nav .pw-user-menu a,.pw-user-menu-item{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:40px;padding:8px 12px;border-radius:var(--r-btn-sm);border:0;background:transparent;color:var(--ink)!important;text-shadow:none!important;font-size:.83rem;font-weight:800;cursor:pointer;text-align:right;transition:background .15s ease,color .15s ease}
.pw-user-menu a::after{display:none!important}
.pw-header.pw-header-glass .pw-nav .pw-user-menu a:hover,.pw-user-menu-item:hover{background:var(--tint);color:var(--o)!important}
.pw-header.pw-header-glass .pw-nav .pw-user-menu a.is-portal,.pw-user-menu-item.is-portal{background:linear-gradient(135deg,#0f172a,#1e293b);color:#ffffff!important;box-shadow:0 8px 16px -10px rgba(15,20,25,.5)}
.pw-header.pw-header-glass .pw-nav .pw-user-menu a.is-portal:hover,.pw-user-menu-item.is-portal:hover{background:var(--o);color:#ffffff!important}
.pw-user-menu-sep{height:1px;background:var(--line);margin:3px 0}
.pw-user-menu-item.is-danger{color:#dc2626!important}
.pw-user-menu-item.is-danger:hover{background:#fef2f2;color:#b91c1c!important}
.pw a:focus-visible,.pw button:focus-visible,.pw input:focus-visible,.pw select:focus-visible,.pw textarea:focus-visible,.pw summary:focus-visible{outline:3px solid rgba(249,115,22,.55);outline-offset:3px}

/* hero (dark) */
.pw-hero{position:relative;isolation:isolate;background:#090b0f;color:#fff;overflow:hidden;min-height:clamp(620px,90vh,900px);display:flex;flex-direction:column;justify-content:center}
.pw-hero-art{visibility:hidden;min-height:340px}
.pw-hero-grid{position:relative;z-index:2;display:grid;grid-template-columns:minmax(0,0.92fr) minmax(0,1.28fr);gap:40px;align-items:center;padding-top:88px;padding-bottom:54px;width:100%}
.pw .pw-hero.pw-hero-pearl{background:linear-gradient(180deg,rgba(7,13,23,.38) 0%,rgba(7,13,23,.58) 100%)!important;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#f8fafc;min-height:auto;padding:0;border-top:1px solid rgba(255,255,255,.12);position:relative;z-index:2}
.pw-footer{position:relative;z-index:2;background:rgba(10,16,24,.78);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid rgba(255,255,255,.10)}
.pw.pw-home-light .pw-footer,.pw:has(>.pw-construction) .pw-footer{background:#f7f4ee!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;border-top:1px solid rgba(20,24,27,.09)!important;box-shadow:none!important;color:#14181b}
.pw.pw-home-light .pw-footer-brand strong,.pw:has(>.pw-construction) .pw-footer-brand strong{color:#14181b}
.pw.pw-home-light .pw-footer-brand small,.pw:has(>.pw-construction) .pw-footer-brand small{color:#525e6a}
.pw.pw-home-light .pw-footer-nav,.pw:has(>.pw-construction) .pw-footer-nav{color:#47525c}
.pw.pw-home-light .pw-footer-nav a:hover,.pw:has(>.pw-construction) .pw-footer-nav a:hover{color:#c75517}
.pw.pw-home-light .pw-footer-link,.pw:has(>.pw-construction) .pw-footer-link{color:#14181b;background:rgba(255,255,255,.88);border-color:rgba(20,24,27,.14)}
.pw.pw-home-light .pw-footer-link:hover,.pw:has(>.pw-construction) .pw-footer-link:hover{background:var(--o);border-color:var(--o);color:#fff}
.pw.pw-home-light .pw-footer-link.is-accent,.pw:has(>.pw-construction) .pw-footer-link.is-accent{color:#a64310;background:#fff3ea;border-color:#fed7aa}
.pw.pw-home-light .pw-footer-bottom,.pw:has(>.pw-construction) .pw-footer-bottom{border-top-color:rgba(20,24,27,.09);color:#64748b}
.pw .pw-hero.pw-hero-pearl .pw-hero-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;align-items:stretch;padding-top:76px;padding-bottom:32px;max-width:1200px}
.pw .pw-hero.pw-hero-pearl .pw-hero-grid.is-solo{grid-template-columns:minmax(0,680px);justify-content:center}
.pw .pw-hero.pw-hero-pearl .pw-eyebrow{color:#ffb074;text-shadow:0 2px 12px rgba(0,0,0,.75)}
.pw .pw-hero.pw-hero-pearl h1,.pw .pw-hero.pw-hero-pearl h2{font-size:clamp(1.65rem,3vw,2.3rem);color:#ffffff;text-shadow:0 4px 20px rgba(0,0,0,.8);margin-bottom:12px}
.pw .pw-hero.pw-hero-pearl h2 em{color:#ffb074}
.pw .pw-hero.pw-hero-pearl .pw-lead{color:rgba(255,255,255,.88);text-shadow:0 2px 14px rgba(0,0,0,.75);margin-bottom:18px;font-size:1.02rem}
.pw .pw-hero.pw-hero-pearl .pw-contact-card{background:rgba(255,255,255,.92);color:var(--ink);backdrop-filter:blur(12px);box-shadow:0 16px 36px -24px rgba(0,0,0,.45)}
.pw .pw-hero.pw-hero-pearl .pw-hero-toolbar{padding-bottom:26px;justify-content:space-between;align-items:center}
.pw .pw-hero.pw-hero-pearl .phi-hb-hud{background:rgba(255,255,255,.82);box-shadow:inset 0 0 0 1px rgba(20,24,27,.1),0 8px 20px -10px rgba(20,24,27,.16)}
.pw .pw-hero.pw-hero-pearl .phi-hb-btn{background:rgba(20,24,27,.06);color:var(--ink);box-shadow:inset 0 0 0 1px rgba(20,24,27,.1)}
.pw .pw-hero.pw-hero-pearl .phi-hb-btn:hover,.pw .pw-hero.pw-hero-pearl .phi-hb-btn.is-active{background:rgba(199,85,23,.14);color:var(--o-dark);box-shadow:inset 0 0 0 1px rgba(199,85,23,.35)}
#about-phitech .pw-wrap{max-width:1360px}
#about-phitech .pw-hero-grid>div:first-child{max-width:540px;justify-self:start;text-align:right;padding-inline-start:12px}
.pw-eyebrow{display:inline-flex;flex-wrap:wrap;align-items:center;gap:8px 10px;font-size:clamp(0.76rem,0.92vw,0.84rem);font-weight:700;color:var(--o);letter-spacing:.02em;margin-bottom:14px;line-height:1.4}
.pw-eyebrow::before{content:'';width:28px;height:2px;background:currentColor}
.pw-hero .pw-eyebrow{color:var(--o-hi);text-shadow:0 2px 14px rgba(0,0,0,.65)}
.pw-hero h1,.pw-hero h2{font-size:clamp(1.9rem,3.4vw,2.95rem);line-height:1.32;font-weight:800;letter-spacing:-0.015em;margin-bottom:18px;text-wrap:balance;word-break:normal;overflow-wrap:break-word;text-shadow:0 4px 28px rgba(0,0,0,.75)}
.pw-hero h1 em,.pw-hero h2 em{font-style:normal;color:var(--o-hi)}
.pw-hero-part{display:inline-block;white-space:normal}
.pw-lead{font-size:clamp(0.96rem,1.15vw,1.08rem);line-height:1.74;color:#d6dee6;max-width:38rem;margin-bottom:26px;text-wrap:pretty;text-shadow:0 2px 18px rgba(0,0,0,.75)}
.pw-actions{display:flex;flex-wrap:wrap;gap:12px}
.pw-actions .pw-btn-light{background:rgba(15,19,26,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.pw-hero-toolbar{position:relative;z-index:3;display:flex;justify-content:flex-end;padding-bottom:16px}
.pw-mobile-scroll-cue{display:none}
@keyframes pwBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}
.pw-cue-arrow{display:inline-block;animation:pwBounce 1.6s ease-in-out infinite;font-size:.85rem;line-height:1}
.pw-hero-art{display:flex;justify-content:center}
.pw-emblem{position:relative;width:min(100%,380px);aspect-ratio:1;display:flex;align-items:center;justify-content:center}
.pw-emblem::before,.pw-emblem::after{content:'';position:absolute;border-radius:50%;border:1px solid rgba(255,255,255,.14)}
.pw-emblem::before{inset:0}
.pw-emblem::after{inset:12%;border-color:rgba(249,115,22,.35);border-style:dashed}
.pw-emblem img{position:relative;height:56%;width:auto;filter:drop-shadow(0 20px 40px rgba(0,0,0,.45))}
.pw-stats{position:relative;z-index:2;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;background:rgba(9,11,15,.72);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.12);border-radius:18px;margin-top:0;margin-bottom:28px;overflow:hidden}
.pw-stats li{padding:20px 24px;border-inline-start:1px solid rgba(255,255,255,.12);display:flex;flex-direction:column;gap:2px;transition:background .2s}
.pw-stats li:hover{background:rgba(249,115,22,.07)}
.pw-stats li:first-child{border-inline-start:0}
.pw-stats strong{font-size:1.2rem;font-weight:800}
.pw-stats span{font-size:.85rem;color:#b8c2cc}

/* sections */
.pw-section{padding:var(--ui-section-py) 0;scroll-margin-top:72px}
.pw-dock-pad,.pw-mobile-dock{display:none}
.pw-tint{background:var(--tint);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.pw-head{max-width:42rem;margin:0 0 48px}
.pw-head h2{font-size:clamp(1.65rem,3vw,2.3rem);font-weight:800;line-height:1.3;margin-bottom:12px}
.pw-head p:not(.pw-eyebrow){color:var(--ink-2);font-size:1.05rem}
.pw-head-center{margin-inline:auto;text-align:center}
.pw-head-center .pw-eyebrow{justify-content:center}

/* trust */
.pw-trust{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;background:#fff;border:1px solid var(--line);border-radius:20px;overflow:hidden}
.pw-trust li{padding:30px 26px;border-inline-start:1px solid var(--line)}
.pw-trust li:first-child{border-inline-start:0}
.pw-trust-n{display:block;font-weight:800;font-size:.85rem;color:var(--o);letter-spacing:.14em;margin-bottom:12px}
.pw-trust h3{font-size:1.08rem;font-weight:800;margin-bottom:8px}
.pw-trust p{font-size:.92rem;color:var(--ink-2)}

/* services */
.pw-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--ui-gap)}
.pw-card{background:#fff;border:1px solid var(--line);border-radius:var(--ui-card-r);padding:var(--ui-card-pad);display:flex;flex-direction:column;gap:16px;transition:border-color .2s,box-shadow .2s,transform .2s;content-visibility:auto;contain-intrinsic-size:auto 420px}
.pw-card:hover{border-color:rgba(199,85,23,.5);box-shadow:0 22px 44px -26px rgba(199,85,23,.45);transform:translateY(-3px)}
.pw-icon{width:48px;height:48px;border-radius:var(--r-card-sm);background:var(--o-soft);color:var(--o);display:flex;align-items:center;justify-content:center}
.pw-card h3{font-size:1.25rem;font-weight:800}
.pw-card>p{color:var(--ink-2);font-size:.96rem}
.pw-card ul{display:flex;flex-direction:column;gap:10px;margin-top:6px;padding-top:18px;border-top:1px solid var(--line)}
.pw-card li{display:flex;gap:10px;align-items:flex-start;font-size:.93rem}
.pw-card li svg{flex:none;margin-top:5px;color:var(--o)}

/* BIM */
.pw-bim{display:grid;grid-template-columns:1.6fr .7fr;gap:24px;align-items:stretch}
.pw-bim-stage{position:relative;min-height:440px;border:1px solid var(--line);border-radius:var(--r-card);overflow:hidden;background:radial-gradient(600px 360px at 50% 30%,#fff 0%,#f1f2f3 100%)}
.pw-bim-canvas{position:absolute;inset:0}
.pw-bim-note{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--ink-2);font-weight:600}
.pw-bim-hint{position:absolute;inset-inline:0;bottom:12px;text-align:center;font-size:.8rem;color:var(--ink-2);pointer-events:none}
.pw-bim-reset{position:absolute;top:16px;inset-inline-start:16px;font-size:.8125rem;font-weight:700;background:#fff;border:1px solid var(--line);border-radius:var(--r-btn-sm);min-height:36px;padding:6px 12px;cursor:pointer}
.pw-bim-reset:hover{border-color:var(--o);color:var(--o)}
.pw-bim-panel{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:24px;display:flex;flex-direction:column;gap:16px}
.pw-bim-panel h3{font-size:1.05rem;font-weight:800}
.pw-bim-layers{display:flex;flex-wrap:wrap;gap:8px}
.pw-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:#fff;border-radius:var(--r-pill);padding:6px 14px;font-size:.85rem;font-weight:700;cursor:pointer;color:var(--ink-2);transition:all .15s}
.pw-chip i{width:10px;height:10px;border-radius:50%;opacity:.35}
.pw-chip.is-on{color:var(--ink);border-color:var(--ink);background:#fafafa}
.pw-chip.is-on i{opacity:1}
.pw-range{display:flex;flex-direction:column;gap:6px;font-size:.88rem;font-weight:700}
.pw-range input{width:100%;accent-color:var(--o)}
.pw-bim-info{min-height:130px;background:var(--tint);border-radius:var(--r-card-sm);padding:16px}
.pw-ifc{display:inline-block;font-family:ui-monospace,Consolas,monospace;font-size:.72rem;font-weight:700;color:var(--o-dark);background:var(--o-soft);border-radius:6px;padding:2px 8px;margin-bottom:6px}
.pw-bim-info h4{font-size:1.02rem;font-weight:800;margin-bottom:4px}
.pw-bim-info p{font-size:.9rem;color:var(--ink-2)}
.pw-bim-disclaimer{font-size:.78rem;color:var(--ink-2)}

/* tools */
.pw-tools{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);overflow:hidden}
.pw-tools-tabs{display:flex;gap:4px;padding:8px;background:var(--tint);border-bottom:1px solid var(--line);overflow-x:auto}
.pw-tools-tabs button{flex:1 0 auto;border:0;background:transparent;min-height:40px;padding:8px 16px;border-radius:var(--r-btn);font-weight:700;font-size:.9375rem;cursor:pointer;color:var(--ink-2);white-space:nowrap}
.pw-tools-tabs button.is-on{background:#fff;color:var(--ink);box-shadow:0 2px 10px rgba(20,28,34,.08)}
.pw-tools-body{padding:32px}
.pw-tool{display:flex;flex-direction:column;gap:24px}
.pw-seg{display:flex;flex-wrap:wrap;gap:8px}
.pw-seg button{border:1px solid var(--line);background:#fff;min-height:36px;padding:6px 16px;border-radius:var(--r-pill);font-weight:700;font-size:.875rem;cursor:pointer;color:var(--ink-2)}
.pw-seg button.is-on{background:var(--ink);border-color:var(--ink);color:#fff}
.pw-field{display:flex;flex-direction:column;gap:6px;font-size:.86rem;font-weight:700;color:var(--ink-2)}
.pw-input{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:var(--ui-btn-r);min-height:var(--ui-input-h);background:#fff;overflow:hidden;transition:border-color .15s}
.pw-input:focus-within{border-color:var(--o)}
.pw-input input{flex:1;min-width:0;border:0;outline:0;padding:10px 14px;background:transparent;color:var(--ink);font-weight:700;text-align:left}
.pw-input em{font-style:normal;font-size:.8rem;font-weight:700;color:var(--ink-2);padding:0 12px;background:var(--tint);align-self:stretch;display:flex;align-items:center;border-inline-start:1px solid var(--line)}
.pw-field select,.pw-field textarea,.pw-field>input{border:1.5px solid var(--line);border-radius:var(--ui-btn-r);min-height:var(--ui-input-h);padding:10px 16px;background:#fff;color:var(--ink);font-weight:600;width:100%}
.pw-field select:focus,.pw-field textarea:focus,.pw-field>input:focus{border-color:var(--o);outline:0}
.pw-conv{display:grid;grid-template-columns:1fr 1.3fr auto 1.3fr;gap:12px;align-items:end}
.pw-swap{height:44px;width:44px;border-radius:var(--r-btn);border:1.5px solid var(--line);background:#fff;cursor:pointer;font-size:1.1rem;font-weight:800}
.pw-swap:hover{border-color:var(--o);color:var(--o)}
.pw-answer{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;background:var(--o-soft);border:1px solid rgba(199,85,23,.25);border-radius:16px;padding:18px 22px}
.pw-answer span{font-weight:700;color:var(--ink-2);font-size:.9rem}
.pw-answer strong{font-size:2rem;font-weight:800;color:var(--o-dark);line-height:1.1}
.pw-answer small{color:var(--ink-2);font-weight:600}
.pw-grid-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.pw-results{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.pw-results>div{background:var(--tint);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:2px}
.pw-results>div.is-strong{background:var(--ink);color:#fff}
.pw-results dt{font-size:.8rem;font-weight:600;opacity:.75}
.pw-results dd{display:flex;align-items:baseline;gap:6px;font-size:1.35rem;font-weight:800}
.pw-results dd small{font-size:.78rem;font-weight:600;opacity:.75}
.pw-table{width:100%;max-width:560px;border-collapse:collapse;font-size:.9rem}
.pw-table caption{text-align:start;font-weight:800;margin-bottom:8px;color:var(--ink)}
.pw-table th,.pw-table td{padding:9px 4px;border-bottom:1px solid var(--line);text-align:start;font-weight:600}
.pw-table td{text-align:left;font-variant-numeric:tabular-nums}
.pw-table th{color:var(--ink-2)}
.pw-note{font-size:.82rem;color:var(--ink-2)}

/* process */
.pw-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}
.pw-steps li{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:24px;position:relative}
.pw-step-n{display:block;font-weight:800;font-size:2rem;line-height:1;color:var(--o);margin-bottom:14px}
.pw-steps h3{font-size:1.08rem;font-weight:800;margin-bottom:6px}
.pw-steps p{font-size:.92rem;color:var(--ink-2)}

/* projects */
.pw-projects{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:24px}
.pw-project{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:24px;display:flex;flex-direction:column;gap:8px;border-top:4px solid var(--o)}
.pw-badge{align-self:flex-start;font-size:.78rem;font-weight:700;color:var(--o-dark);background:var(--o-soft);border-radius:var(--r-pill);padding:4px 12px;margin-bottom:8px}
.pw-project h3{font-size:1.3rem;font-weight:800}
.pw-project>p{color:var(--ink-2)}
.pw-project dl{display:flex;gap:28px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
.pw-project dt{font-size:.78rem;color:var(--ink-2)}
.pw-project dd{font-weight:700}

/* faq */
.pw-faq{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.pw-faq details{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:0 24px}
.pw-faq summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px 0;font-weight:800}
.pw-faq summary::-webkit-details-marker{display:none}
.pw-faq summary::after{content:'+';font-size:1.4rem;color:var(--o);font-weight:600;line-height:1}
.pw-faq details[open] summary::after{content:'−'}
.pw-faq details p{padding:0 0 18px;color:var(--ink-2)}

/* contact */
.pw-contact{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
.pw-contact-solo{grid-template-columns:minmax(0,680px)}
.pw-contact-card{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:24px}
.pw-contact-card li{display:flex;justify-content:space-between;gap:16px;align-items:baseline;padding:14px 0;border-bottom:1px solid var(--line)}
.pw-contact-card li:first-child{padding-top:0}
.pw-contact-card li span{color:var(--ink-2);font-size:.9rem;flex:none}
.pw-contact-card li a,.pw-contact-card li strong{font-weight:700;text-align:left}
.pw-contact-card li a:hover{color:var(--o)}
.pw-offices{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.pw-offices span{font-size:.85rem;font-weight:700;background:var(--tint);border:1px solid var(--line);border-radius:var(--r-pill);padding:4px 12px}
.pw-form{display:flex;flex-direction:column;gap:16px;margin-top:8px}
.pw-form .pw-grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.pw-form textarea{min-height:96px;resize:vertical}

/* footer */
.pw-footer{background:var(--g2);color:#e2e8f0;padding:12px 0 12px}
.pw-footer .pw-wrap{max-width:1360px}
.pw-footer-row{display:flex;align-items:center;justify-content:space-between;gap:8px 16px;flex-wrap:wrap}
.pw-footer-brand{display:flex;align-items:center;gap:8px}
.pw-footer-brand img{height:24px;width:auto}
.pw-footer-brand>div{display:flex;flex-direction:column;gap:1px;line-height:1.2}
.pw-footer-brand strong{display:block;color:#fff;font-size:.8rem;line-height:1.25}
.pw-footer-brand small{display:block;color:#cbd5e1;font-size:.68rem;line-height:1.2;opacity:.82}
.pw-footer-nav{display:flex;flex-wrap:wrap;gap:8px 12px;font-size:.74rem;font-weight:700;color:rgba(255,255,255,.88)}
.pw-footer-nav a:hover{color:#ffb074}
.pw-footer-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pw-footer-link{font-weight:700;font-size:.72rem;color:#fff;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:var(--r-pill);padding:4px 12px;transition:background .18s,border-color .18s,color .18s}
.pw-footer-link:hover{background:var(--o);border-color:var(--o);color:#fff}
.pw-footer-link.is-accent{color:#ffb074;border-color:rgba(255,176,116,.34);background:rgba(199,85,23,.14)}
.pw-footer-bottom{margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);font-size:.68rem;color:rgba(226,232,240,.7);text-align:center}

@media (max-width:1180px){
  .pw-nav{gap:10px;font-size:.78rem}
  .pw-brand-text small{display:none}
  .pw-nav-cta,.pw-nav-portal{min-height:40px;padding:8px 12px;font-size:.8rem}
}
@media (max-width:960px){
  html:has(.pw),.pw{scroll-behavior:smooth}
  .pw-hero{display:flex;flex-direction:column;justify-content:flex-start;min-height:auto;background:#090b0f;padding-top:0}
  .pw-hero .phi-hb{
    position:relative;
    inset:auto;
    width:100%;
    height:clamp(300px,48svh,420px);
    order:0;
    z-index:2;
    pointer-events:auto;
    overflow:hidden;
    border-bottom:1px solid rgba(255,255,255,.08);
    box-shadow:0 20px 35px -10px rgba(0,0,0,.75);
  }
  .pw-hero .phi-hb .phi-hb-stage{
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    left:0;
    -webkit-mask-image:none;
    mask-image:none;
  }
  .pw-hero .phi-hb .phi-hb-poster,
  .pw-hero .phi-hb .phi-hb-video{
    position:absolute;
    inset:0;
    width:100%;
    height:100%;
    object-fit:cover;
    object-position:center 46%;
    transform:scale(1.01);
  }
  .pw-hero .phi-hb .phi-hb-scrim{
    position:absolute;
    inset:0;
    background:linear-gradient(180deg,rgba(9,11,15,.55) 0%,transparent 26%,transparent 70%,rgba(9,11,15,.98) 100%),radial-gradient(ellipse at center,transparent 40%,rgba(9,11,15,.45) 100%);
  }
  .pw-hero-toolbar{
    order:1;
    position:relative;
    z-index:5;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    margin-top:-48px;
    margin-bottom:6px;
    padding:0 20px;
    pointer-events:auto;
  }
  .pw-mobile-scroll-cue{
    display:inline-flex;
    align-items:center;
    gap:6px;
    padding:6px 14px;
    border-radius:999px;
    background:rgba(9,11,15,.82);
    backdrop-filter:blur(14px);
    -webkit-backdrop-filter:blur(14px);
    border:1px solid rgba(255,255,255,.16);
    color:#f1f5f9;
    font-size:.76rem;
    font-weight:700;
    text-decoration:none;
    box-shadow:0 8px 22px -6px rgba(0,0,0,.75);
    transition:all .18s;
  }
  .pw-mobile-scroll-cue:hover{
    background:rgba(249,115,22,.24);
    color:#fff;
    border-color:rgba(249,115,22,.55);
  }
  .pw-hero-grid,#about-phitech .pw-hero-grid{
    order:2;
    grid-template-columns:1fr!important;
    gap:18px;
    padding-top:14px;
    padding-bottom:20px;
    position:relative;
    z-index:3;
  }
  #about-phitech .pw-hero-grid>div:first-child{max-width:100%;padding-inline-start:0}
  .pw-hero h1,.pw-hero h2{
    font-size:clamp(1.48rem,5.8vw,2.05rem);
    line-height:1.36;
    margin-bottom:12px;
    text-align:right;
  }
  .pw-lead{
    font-size:clamp(0.92rem,3.6vw,1.02rem);
    line-height:1.68;
    margin-bottom:18px;
    text-align:right;
    color:#cbd5e1;
  }
  .pw .pw-hero.pw-hero-pearl{background:linear-gradient(180deg,rgba(7,13,23,.38) 0%,rgba(7,13,23,.58) 100%)!important;padding-top:0}
  .pw .pw-hero.pw-hero-pearl .phi-hb{position:absolute!important;inset:0;height:100%!important;box-shadow:none;border-bottom:0}
  .pw .pw-hero.pw-hero-pearl .pw-hero-grid{grid-template-columns:1fr!important;padding-top:46px;padding-bottom:18px}
  .pw .pw-hero.pw-hero-pearl .pw-hero-toolbar{margin-top:0;padding:0 20px 26px}
  .pw .pw-hero.pw-hero-pearl .pw-lead{color:rgba(255,255,255,.88)}
  .pw .pw-hero.pw-hero-pearl .pw-mobile-scroll-cue{background:rgba(255,255,255,.88);border-color:var(--line);color:var(--ink);box-shadow:0 6px 16px -8px rgba(20,24,27,.18)}
  .pw-eyebrow{
    font-size:.78rem;
    margin-bottom:8px;
  }
  .pw-actions{
    gap:10px;
  }
  .pw-hero-art{display:none;min-height:0}
  .pw-emblem{width:min(70%,240px)}
  .pw-stats{
    order:3;
    grid-template-columns:repeat(2,minmax(0,1fr));
    margin-top:4px;
    margin-bottom:24px;
  }
  .pw-stats li{padding:14px 18px}
  .pw-stats strong{font-size:1.12rem}
  .pw-stats span{font-size:.8rem}
  .pw-stats li:nth-child(3){border-inline-start:0}
  .pw-stats li:nth-child(n+3){border-top:1px solid rgba(255,255,255,.12)}
  .pw-trust{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pw-trust li:nth-child(3){border-inline-start:0}
  .pw-trust li:nth-child(n+3){border-top:1px solid var(--line)}
  .pw-cards{grid-template-columns:1fr}
  .pw-steps{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pw-bim{grid-template-columns:1fr}
  .pw-bim-stage{min-height:360px}
  .pw-contact{grid-template-columns:1fr;gap:28px}
  .pw-section{padding:68px 0}
  .pw-grid-fields,.pw-results{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:980px){
  .pw-burger{display:flex}
  .pw-nav-head{display:flex;align-items:center;justify-content:space-between;padding:4px 8px 16px;margin-bottom:8px;border-bottom:1px solid #e7e1d7}
  .pw-nav-head-title{display:flex;align-items:center;gap:8px;font-size:.92rem;font-weight:800;color:#c75517}
  .pw-nav-close{display:inline-flex;align-items:center;gap:6px;min-height:40px;background:#ffffff;border:1px solid #dfd7cc;border-radius:var(--r-btn-sm);color:#14181b;padding:8px 12px;font-size:.8125rem;font-weight:700;cursor:pointer;transition:background .15s,color .15s}
  .pw-nav-close:hover{background:#fff3ea;color:#a64310;border-color:#c75517}
  .pw-nav{position:fixed;inset:0;top:0;bottom:calc(64px + env(safe-area-inset-bottom,0px));background:rgba(251,250,247,.97);backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%);border-bottom:1px solid #e7e1d7;box-shadow:0 20px 40px rgba(20,24,27,.14);flex-direction:column;align-items:stretch;gap:4px;padding:16px 24px 24px;overflow-y:auto;z-index:84;display:none}
  .pw-nav.is-open{display:flex;animation:pwNavIn .2s ease-out}
  @keyframes pwNavIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
  .pw-nav a:not(.pw-btn){display:flex;align-items:center;justify-content:space-between;min-height:44px;padding:12px;border-bottom:1px solid #efe9df;color:#14181b;font-size:.9375rem;font-weight:700;border-radius:var(--r-btn-sm);transition:background .15s,color .15s}
  .pw-nav a:not(.pw-btn):hover{background:#f4efe6;color:#c75517}
  .pw-nav a:not(.pw-btn)::after{display:none}
  .pw-nav-arrow{display:inline-block;color:#94a3b8;font-size:.85rem;font-family:inherit;transition:transform .15s,color .15s}
  .pw-nav a:not(.pw-btn):hover .pw-nav-arrow{color:#c75517;transform:translateX(-3px)}
  .pw-nav-cta{margin-top:12px;min-height:48px;font-size:.95rem;width:100%}
  .pw-user-wrap{margin-top:8px;width:100%}
  .pw-user-wrap .pw-nav-cta{margin-top:4px;justify-content:space-between}
  .pw-user-menu{position:static;width:100%;margin-top:8px}
  .pw-nav-portal,.pw-nav-portal.is-guest,.pw-nav-portal.is-ready{margin-top:8px;min-height:48px;font-size:.95rem;background:#ffffff!important;color:#14181b!important;border-color:#dfd7cc;justify-content:space-between}
  .pw-dock-pad{display:block;height:calc(68px + env(safe-area-inset-bottom,0px))}
  .pw-mobile-dock{position:fixed;bottom:0;inset-inline:0;z-index:85;display:flex;align-items:center;justify-content:space-around;gap:4px;padding:8px 12px calc(8px + env(safe-area-inset-bottom,0px));background:rgba(255,253,249,.94);backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%);border-top:1px solid rgba(20,24,27,.1);box-shadow:0 -8px 26px rgba(20,24,27,.09)}
  .pw-dock-item{flex:1;max-width:76px;min-height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border:0;background:transparent;color:#47525c;font-family:inherit;font-size:.72rem;font-weight:700;cursor:pointer;text-decoration:none;border-radius:var(--r-btn);padding:4px 2px;transition:color .15s,transform .15s,background .15s;-webkit-tap-highlight-color:transparent}
  .pw-dock-item:active{transform:scale(.93)}
  .pw-dock-item:hover,.pw-dock-item.is-active{color:#c75517;background:#fff3ea}
  .pw-dock-icon{display:flex;align-items:center;justify-content:center;height:20px;width:20px}
  .pw-dock-label{line-height:1.1;white-space:nowrap;letter-spacing:-0.01em}
  .pw-dock-item.pw-dock-cta{max-width:92px;min-height:48px;position:relative;color:#fff;background:linear-gradient(135deg,#f97316 0%,#c75517 100%);border:1px solid rgba(255,255,255,.28);border-radius:var(--r-btn);box-shadow:0 4px 14px rgba(249,115,22,.45),inset 0 1px 0 rgba(255,255,255,.35);margin:0 2px}
  .pw-dock-item.pw-dock-cta:active{transform:scale(.93)}
  .pw-dock-item.pw-dock-cta .pw-dock-label{color:#fff;font-weight:800}
}
@media (max-width:639px){
  .pw-wrap{padding-inline:16px}
  .pw-hero .phi-hb{height:clamp(225px,36svh,320px)}
  .pw-hero-grid{padding-top:12px;padding-bottom:16px}
  .pw-hero h1{font-size:clamp(1.32rem,6vw,1.72rem)}
  .pw-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%}
  .pw-actions .pw-btn{width:100%;min-height:44px;justify-content:center;font-size:.875rem;padding:10px 16px}
  .pw-actions .pw-btn:nth-child(1),.pw-actions .pw-btn:nth-child(2){grid-column:1/-1;min-height:48px;font-size:.9375rem}
  .pw-hero-toolbar{padding:0 16px;margin-top:-44px;margin-bottom:8px}
  .pw-mobile-scroll-cue{padding:6px 12px;font-size:.75rem}
  .pw-stats{margin-bottom:16px}
  .pw-stats li{padding:12px 16px}
  .pw-stats strong{font-size:1.02rem}
  .pw-stats span{font-size:.74rem}
  .pw-steps,.pw-projects,.pw-trust{grid-template-columns:1fr}
  .pw-trust li{border-inline-start:0;border-top:1px solid var(--line)}
  .pw-trust li:first-child{border-top:0}
  .pw-conv{grid-template-columns:1fr 1fr}
  .pw-conv .pw-swap{grid-column:1/-1;width:100%}
  .pw-grid-fields,.pw-results,.pw-form .pw-grid2{grid-template-columns:1fr}
  .pw-tools-body{padding:16px}
  .pw-bim-stage{min-height:300px}
}
/* ===== قائمة التفقد ===== */
.pw-ck{display:flex;flex-direction:column;gap:20px}
.pw-ck-print-head{display:none}
.pw-ck-top{display:grid;grid-template-columns:1.4fr 1fr;gap:20px}
.pw-ck-progress,.pw-ck-field{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:24px}
.pw-ck-progress-row{display:flex;align-items:baseline;gap:12px;margin-bottom:12px}
.pw-ck-progress-row strong{font-size:2rem;line-height:1;color:var(--o)}
.pw-ck-progress-row span{color:var(--ink-2);font-weight:600}
.pw-ck-bar{height:10px;border-radius:var(--r-pill);background:#eceeef;overflow:hidden}
.pw-ck-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--o),var(--o-hi));border-radius:var(--r-pill);transition:width .3s}
.pw-ck-hint{font-size:.8rem;color:var(--ink-2);margin-top:12px}
.pw-ck-field{display:flex;flex-direction:column;gap:8px;justify-content:center}
.pw-ck-field span{font-size:.85rem;font-weight:700;color:var(--ink-2)}
.pw-ck-field input,.pw-ck-search{width:100%;min-height:44px;border:1px solid var(--line);border-radius:var(--r-btn);padding:0 16px;font:inherit;background:#fff;color:var(--ink)}
.pw-ck-field input:focus,.pw-ck-search:focus{outline:2px solid var(--o);outline-offset:1px;border-color:var(--o)}
.pw-ck-tools{display:flex;gap:12px;flex-wrap:wrap}
.pw-ck-search{flex:1 1 300px}
.pw-ck-actions{display:flex;gap:8px;flex-wrap:wrap}
.pw-ck-btn{min-height:44px;padding:8px 16px;border:1px solid var(--line);background:#fff;border-radius:var(--r-btn);font:inherit;font-weight:700;font-size:.9rem;cursor:pointer;color:var(--ink)}
.pw-ck-btn:hover{border-color:var(--ink)}
.pw-ck-btn.is-primary{background:var(--o);border-color:var(--o);color:#fff}
.pw-ck-btn.is-primary:hover{background:var(--o-dark);border-color:var(--o-dark)}
.pw-ck-chips{display:flex;gap:8px;flex-wrap:wrap}
.pw-ck-count{font-weight:700;color:var(--ink-2)}
.pw-ck-layout{display:grid;grid-template-columns:272px minmax(0,1fr);gap:24px;align-items:start}
.pw-ck-side{position:sticky;top:88px;max-height:calc(100vh - 112px);overflow:auto;background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:16px}
.pw-ck-side-part p{font-size:.78rem;font-weight:800;color:var(--o);padding:8px 12px 4px}
.pw-ck-side button{display:flex;justify-content:space-between;gap:8px;width:100%;text-align:start;border:0;background:none;padding:8px 12px;border-radius:var(--r-btn-sm);font:inherit;font-size:.86rem;font-weight:600;color:var(--ink-2);cursor:pointer}
.pw-ck-side button:hover{background:var(--tint);color:var(--ink)}
.pw-ck-side button em{font-style:normal;font-size:.75rem;color:var(--ink-2);white-space:nowrap}
.pw-ck-side button.is-full em{color:#1a7f4b;font-weight:800}
.pw-ck-main{display:flex;flex-direction:column;gap:12px;min-width:0}
.pw-ck-part-h{font-size:1.15rem;margin:16px 0 4px;display:flex;flex-wrap:wrap;gap:8px 12px;align-items:baseline}
.pw-ck-part:first-child .pw-ck-part-h{margin-top:0}
.pw-ck-part-h span{font-size:.88rem;font-weight:600;color:var(--ink-2)}
.pw-ck-sec{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);margin-top:12px;scroll-margin-top:88px}
.pw-ck-sec.is-open{border-color:#d3d7da}
.pw-ck-sec.is-done .pw-ck-no{background:#1a7f4b}
.pw-ck-sec-h{display:flex;align-items:center;gap:16px;width:100%;text-align:start;padding:16px 20px;border:0;background:none;font:inherit;cursor:pointer;color:var(--ink)}
.pw-ck-no{flex:none;width:36px;height:36px;border-radius:var(--r-btn);background:var(--ink);color:#fff;display:grid;place-items:center;font-weight:800;font-size:.9rem}
.pw-ck-title{flex:1;font-weight:800;font-size:1.02rem;line-height:1.45}
.pw-ck-title small{display:block;font-size:.76rem;font-weight:600;color:var(--ink-2);text-align:right}
.pw-ck-meter{font-size:.82rem;font-weight:700;color:var(--ink-2);background:var(--tint);border-radius:var(--r-pill);padding:4px 12px}
.pw-ck-chev{flex:none;transition:transform .2s;color:var(--ink-2)}
.pw-ck-sec.is-open .pw-ck-chev{transform:rotate(180deg)}
.pw-ck-sec-b{padding:4px 20px 20px;border-top:1px solid var(--line)}
.pw-ck-critical{margin:16px 0 4px;border:1px solid #f0b9a0;background:#fff3ea;border-inline-start:5px solid var(--o);border-radius:var(--r-card-sm);padding:16px}
.pw-ck-critical b{color:var(--o-dark);font-size:.82rem;letter-spacing:.02em}
.pw-ck-critical p{margin-top:4px;font-weight:700}
.pw-ck-group h4{margin:16px 0 8px;font-size:.95rem;color:var(--o-dark);font-weight:800}
.pw-ck-group ul{display:flex;flex-direction:column;gap:4px;margin-top:8px}
.pw-ck-group li label{display:flex;gap:12px;align-items:flex-start;padding:8px;border-radius:var(--r-btn);cursor:pointer}
.pw-ck-group li label:hover{background:var(--tint)}
.pw-ck-group li label input{position:absolute;opacity:0;width:1px;height:1px}
.pw-ck-box{flex:none;width:22px;height:22px;margin-top:3px;border:2px solid #b7bdc2;border-radius:6px;display:grid;place-items:center;color:transparent;background:#fff;transition:all .15s}
.pw-ck-group li label input:focus-visible+.pw-ck-box{outline:2px solid var(--o);outline-offset:2px}
.pw-ck-group li label.is-checked .pw-ck-box{background:#1a7f4b;border-color:#1a7f4b;color:#fff}
.pw-ck-text{font-size:.96rem;line-height:1.75}
.pw-ck-text strong{font-weight:800}
.pw-ck-group li label.is-checked .pw-ck-text{color:var(--ink-2)}
.pw-ck-subs{margin:0 40px 8px 0;padding:0;gap:4px!important}
.pw-ck-subs li{position:relative;padding-inline-start:16px;font-size:.9rem;color:var(--ink-2);line-height:1.7}
.pw-ck-subs li::before{content:'';position:absolute;inset-inline-start:0;top:.7em;width:6px;height:6px;border-radius:50%;background:var(--o)}
.pw-ck-all{margin-top:16px;border:1px dashed #c2c7cb;background:none;border-radius:var(--r-btn-sm);min-height:36px;padding:6px 12px;font:inherit;font-size:.85rem;font-weight:700;color:var(--ink-2);cursor:pointer}
.pw-ck-all:hover{border-color:var(--ink);color:var(--ink)}
@media (max-width:960px){
  .pw-ck-top{grid-template-columns:1fr}
  .pw-ck-layout{grid-template-columns:1fr}
  .pw-ck-side{display:none}
}
@media (max-width:600px){
  .pw-ck-sec-h{padding:14px}
  .pw-ck-sec-b{padding:2px 12px 14px}
  .pw-ck-subs{margin-right:34px}
  .pw-ck-actions .pw-ck-btn{flex:1 1 calc(50% - 8px)}
}
@media print{
  @page{margin:14mm}
  .pw-header,.pw-footer,.pw-hero,.pw-trust-wrap,main>section:not(#checklist),.pw-ck-top,.pw-ck-tools,.pw-ck-chips,.pw-ck-side,.pw-ck-all,.pw-ck-chev,.pw-ck-count,#checklist .pw-head{display:none!important}
  .pw,.pw-section,.pw-tint{background:#fff!important}
  #checklist{padding:0!important;border:0!important}
  .pw-ck-print-head{display:flex;gap:18px;flex-wrap:wrap;border-bottom:2px solid #c75517;padding-bottom:8px;margin-bottom:10px;font-size:11pt}
  .pw-ck-layout{display:block}
  .pw-ck-sec{break-inside:auto;border:0;border-bottom:1px solid #ccc;border-radius:0}
  .pw-ck-sec-h{break-after:avoid}
  .pw-ck-group li{break-inside:avoid}
  .pw-ck-text{font-size:10.5pt}
  .pw-ck-box{border-color:#444}
  .pw-ck-no{background:none!important;color:#000!important;border:1px solid #444}
  .pw-ck-group li label.is-checked .pw-ck-box{background:#1a7f4b!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
@media (prefers-reduced-motion:reduce){.pw *{transition:none!important}}

/* Execution Guide & Dossier Styles */
.pw-view-tabs{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:24px;background:var(--tint);padding:8px;border-radius:var(--r-card);max-width:580px;margin-inline:auto;border:1px solid var(--line)}
.pw-view-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:8px 16px;border-radius:var(--r-btn);font-weight:700;font-size:.9375rem;border:none;background:transparent;color:var(--ink-2);cursor:pointer;transition:all .2s}
.pw-view-tab:hover{color:var(--ink);background:rgba(255,255,255,.6)}
.pw-view-tab.is-active{background:#fff;color:var(--o-dark);box-shadow:0 4px 14px rgba(20,28,34,.08);font-weight:800}

.pw-exec-dossier{display:flex;flex-direction:column;gap:24px}
.pw-exec-controls{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:20px 24px;box-shadow:0 4px 18px rgba(20,28,34,.04);display:flex;flex-direction:column;gap:16px}
.pw-exec-search-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.pw-exec-search-box{flex:1;min-width:280px;position:relative;display:flex;align-items:center}
.pw-exec-search-icon{position:absolute;inset-inline-start:14px;font-size:1rem;pointer-events:none;opacity:.6}
.pw-exec-search-input{width:100%;min-height:44px;height:44px;padding-inline:42px 36px;border-radius:var(--r-btn);border:1.5px solid var(--line);background:var(--tint);font-size:.95rem;outline:none;transition:border-color .15s,background .15s,box-shadow .15s}
.pw-exec-search-input:focus{border-color:var(--o);background:#fff;box-shadow:0 0 0 3px rgba(199,85,23,.12)}
.pw-exec-search-clear{position:absolute;inset-inline-end:12px;border:none;background:none;font-size:.9rem;color:var(--ink-2);cursor:pointer;padding:4px}
.pw-exec-quick-stats{font-size:.88rem;color:var(--ink-2);white-space:nowrap}
.pw-exec-quick-stats strong{color:var(--o-dark)}
.pw-exec-filters{display:flex;flex-direction:column;gap:12px;border-top:1px dashed var(--line);padding-top:16px}
.pw-exec-filter-group{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.pw-exec-filter-label{font-size:.84rem;font-weight:700;color:var(--ink-2);min-width:92px}
.pw-exec-chips{display:flex;gap:8px;flex-wrap:wrap}

.pw-exec-list{display:flex;flex-direction:column;gap:16px}
.pw-exec-empty{text-align:center;padding:48px 24px;background:var(--tint);border-radius:var(--r-card);color:var(--ink-2);display:flex;flex-direction:column;align-items:center;gap:16px}

/* Card */
.pw-exec-card{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);box-shadow:0 4px 16px rgba(20,28,34,.04);transition:border-color .2s,box-shadow .2s;overflow:hidden}
.pw-exec-card:hover{border-color:#cbd3d9}
.pw-exec-card.is-open{border-color:var(--o);box-shadow:0 8px 28px rgba(199,85,23,.09)}
.pw-exec-card-header{padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;cursor:pointer;user-select:none;background:#fff;transition:background .15s}
.pw-exec-card-header:hover{background:var(--tint)}
.pw-exec-header-left{display:flex;align-items:center;gap:16px;flex:1}
.pw-exec-code{flex-shrink:0;width:44px;height:44px;border-radius:var(--r-card-sm);background:var(--o-soft);color:var(--o-dark);font-weight:800;font-size:.95rem;display:grid;place-items:center;letter-spacing:.5px}
.pw-exec-titles h3{font-size:1.15rem;font-weight:800;color:var(--ink);line-height:1.35;margin-bottom:4px}
.pw-exec-meta-pills{display:flex;gap:8px;flex-wrap:wrap}
.pw-exec-pill{font-size:.78rem;padding:4px 8px;border-radius:6px;font-weight:700}
.pw-pill-cat{background:#eef2f6;color:#3b506c}
.pw-pill-unit{background:#f1f5f9;color:#475569}
.pw-pill-prj{background:#fef3c7;color:#92400e}

.pw-exec-header-right{display:flex;align-items:center;gap:16px;flex-shrink:0}
.pw-exec-price-chip{display:flex;flex-direction:column;align-items:flex-end;background:#f0fdf4;border:1px solid #bbf7d0;padding:8px 12px;border-radius:var(--r-btn)}
.pw-exec-price-val{font-size:.95rem;font-weight:800;color:#166534}
.pw-exec-price-date{font-size:.72rem;color:#15803d}
.pw-exec-toggle-btn{background:none;border:none;cursor:pointer;color:var(--ink-2);display:grid;place-items:center;width:36px;height:36px;padding:0;border-radius:var(--r-btn-sm)}
.pw-exec-toggle-btn:hover{background:rgba(0,0,0,.05);color:var(--ink)}

/* Body & Grid */
.pw-exec-body{border-top:1px solid var(--line);padding:24px;background:#fafaf9;display:flex;flex-direction:column;gap:20px}
.pw-exec-topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:16px;border-bottom:1px dashed var(--line)}
.pw-exec-dimension-badges{display:flex;gap:8px;flex-wrap:wrap}
.pw-dim-badge{font-size:.78rem;font-weight:700;padding:4px 12px;border-radius:var(--r-pill);background:#f1f5f9;color:#334155}
.pw-dim-badge.is-verified{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}
.pw-exec-goto-ck{background:#fff;border:1px solid var(--line);border-radius:var(--r-btn-sm);min-height:36px;padding:6px 12px;font-size:.8125rem;font-weight:700;color:var(--ink-2);cursor:pointer;transition:all .15s}
.pw-exec-goto-ck:hover{border-color:var(--o);color:var(--o-dark);background:var(--o-soft)}

.pw-exec-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.pw-exec-block{background:#fff;border:1px solid var(--line);border-radius:var(--r-card-sm);padding:16px;display:flex;flex-direction:column;gap:12px}
.pw-exec-block.full-width{grid-column:1 / -1}
.pw-block-head{display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--line);padding-bottom:8px}
.pw-block-icon{font-size:1.15rem}
.pw-block-head h4{font-size:.98rem;font-weight:800;color:var(--ink)}
.pw-block-intro{font-size:.9rem;color:var(--ink-2);line-height:1.6}

.pw-exec-checklist{display:flex;flex-direction:column;gap:8px;margin:0;padding:0}
.pw-exec-checklist li{display:flex;align-items:flex-start;gap:10px;font-size:.88rem;line-height:1.65;color:var(--ink)}
.pw-dot{flex-shrink:0;width:8px;height:8px;border-radius:50%;background:var(--o);margin-top:8px}
.pw-dot-blue{background:#2563eb}
.pw-dot-amber{background:#d97706}
.pw-dot-red{background:#dc2626}
.pw-dot-green{background:#16a34a}

.pw-mockup-notice{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;font-size:.84rem;color:#92400e;line-height:1.6}
.pw-calc-box{background:var(--tint);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;font-size:.88rem}
.pw-calc-formula{background:#fff;border:1px solid var(--line);padding:6px 10px;border-radius:6px;font-family:Consolas,monospace;font-size:.85rem;color:#0f172a;direction:ltr;text-align:left;display:block}
.pw-rates-list,.pw-rules-box,.pw-tolerances-box{display:flex;flex-direction:column;gap:6px;font-size:.86rem}
.pw-rates-list ul,.pw-rules-box ul,.pw-tolerances-box ul,.pw-rejection-box ul{padding-inline-start:18px;display:flex;flex-direction:column;gap:4px;list-style:disc;color:var(--ink-2)}
.pw-calc-footer{font-size:.86rem;padding-top:6px;border-top:1px dashed var(--line)}
.pw-rejection-box{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;font-size:.84rem;color:#991b1b}
.pw-tool-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.pw-tool-tag{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:3px 8px;font-size:.8rem;color:#334155}

/* Steps Timeline */
.pw-steps-timeline{display:flex;flex-direction:column;gap:12px;position:relative;padding-inline-start:8px}
.pw-timeline-step{display:flex;gap:14px;align-items:flex-start;position:relative}
.pw-step-number{flex-shrink:0;width:30px;height:30px;border-radius:50%;background:var(--o);color:#fff;font-weight:800;font-size:.86rem;display:grid;place-items:center;box-shadow:0 2px 8px rgba(199,85,23,.3)}
.pw-step-content{flex:1;background:var(--tint);border-radius:10px;padding:10px 14px}
.pw-step-content h5{font-size:.92rem;font-weight:800;color:var(--ink);margin-bottom:4px}
.pw-step-content p{font-size:.86rem;color:var(--ink-2);line-height:1.6}

/* Workflow Steps */
.pw-workflow-steps{display:flex;flex-direction:column;gap:8px}
.pw-wf-step{display:flex;gap:10px;align-items:flex-start;background:var(--tint);border-radius:8px;padding:8px 10px}
.pw-wf-no{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:#2563eb;color:#fff;font-weight:700;font-size:.75rem;display:grid;place-items:center}
.pw-wf-step p{font-size:.85rem;color:var(--ink);line-height:1.5}
.pw-wf-code{display:flex;align-items:center;gap:8px;font-size:.84rem;margin-top:6px}
.pw-wf-code code{background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:6px;font-family:monospace;font-weight:700}

/* Pricing Table */
.pw-pricing-table{display:flex;flex-direction:column;gap:8px;background:var(--tint);border-radius:10px;padding:12px}
.pw-price-row{display:flex;justify-content:space-between;align-items:center;font-size:.88rem;padding-bottom:6px;border-bottom:1px dashed #dbe0e5}
.pw-price-row.is-total{border-bottom:none;padding-top:4px;font-size:.95rem}
.pw-rate-highlight{font-size:1.1rem;font-weight:800;color:#15803d}
.pw-pricing-meta{display:flex;flex-direction:column;gap:6px;font-size:.82rem}
.pw-price-notes{color:var(--ink-2);line-height:1.5}
.pw-price-date-tag{color:#0369a1;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:4px 8px;align-self:flex-start}

/* Applied Project Banner */
.pw-applied-banner{background:linear-gradient(145deg,#fdfbf7 0%,#fff 100%);border:1.5px solid #fed7aa;border-radius:var(--r-card);padding:24px;display:flex;flex-direction:column;gap:16px;box-shadow:0 4px 18px rgba(234,88,12,.06)}
.pw-applied-head{display:flex;gap:12px;align-items:center;border-bottom:1px solid #ffedd5;padding-bottom:12px}
.pw-applied-icon{font-size:1.8rem}
.pw-applied-head h4{font-size:1.05rem;font-weight:800;color:#9a3412}
.pw-applied-sub{font-size:.84rem;color:#7c2d12}
.pw-applied-jo code{background:#ffedd5;color:#9a3412;padding:2px 6px;border-radius:4px;font-weight:700}
.pw-applied-story p{font-size:.92rem;line-height:1.75;color:var(--ink);background:#fff;border:1px solid #fed7aa;border-radius:var(--r-card-sm);padding:12px 16px}
.pw-applied-challenges h5{font-size:.9rem;font-weight:800;color:#9a3412;margin-bottom:8px}
.pw-challenges-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.pw-challenge-card{background:#fff;border:1px solid #fed7aa;border-radius:var(--r-card-sm);padding:12px;display:flex;flex-direction:column;gap:8px}
.pw-ch-q,.pw-ch-a{display:flex;flex-direction:column;gap:4px;font-size:.84rem}
.pw-ch-tag{align-self:flex-start;font-size:.72rem;font-weight:800;background:#fee2e2;color:#b91c1c;padding:2px 6px;border-radius:4px}
.pw-ch-tag.is-sol{background:#dcfce7;color:#15803d}
.pw-applied-metric{display:flex;align-items:center;gap:12px;background:#fff;border:1.5px dashed #f97316;border-radius:var(--r-card-sm);padding:12px 16px;font-size:.88rem;color:#7c2d12}
.pw-metric-icon{font-size:1.25rem}

.pw-ck-card-btn{margin-top:12px;display:inline-flex;align-items:center;gap:6px;min-height:36px;background:var(--o-soft);border:1px solid var(--o);color:var(--o-dark);padding:6px 12px;border-radius:var(--r-btn-sm);font-size:.8125rem;font-weight:700;cursor:pointer;transition:all .15s}
.pw-ck-card-btn:hover{background:var(--o);color:#fff}

@media (max-width:900px){
  .pw-exec-grid{grid-template-columns:1fr}
  .pw-exec-card-header{flex-direction:column;align-items:flex-start}
  .pw-exec-header-right{width:100%;justify-content:space-between}
}

/* ===== تنسيق موحّد (8pt Grid): رؤوس الأقسام، الحاويات، الكروت، والتوازن العام ===== */
.pw{--pw-radius:var(--ui-card-r);--pw-gap:var(--ui-gap);--pw-pad-y:var(--ui-section-py)}
.pw-section{padding:var(--pw-pad-y) 0}
/* تبادل خلفيات الأقسام بانتظام (أبيض / رمادي فاتح) بغض النظر عن الأقسام المخفية */
.pw .pw-section.pw-tint{background:#fff;border-block:0}
.pw main>section.pw-section:nth-of-type(odd){background:var(--tint);border-block:1px solid var(--line)}
/* رؤوس الأقسام: كلها في المنتصف وبعرض مقروء موحّد */
.pw-head{max-width:720px;margin:0 auto 48px;text-align:center}
.pw-head .pw-eyebrow{justify-content:center}
.pw-head p:not(.pw-eyebrow){max-width:65ch;margin-inline:auto}
.pw-contact .pw-head{max-width:none;margin:0 0 24px;text-align:start}
.pw-contact .pw-head .pw-eyebrow{justify-content:flex-start}
.pw-contact .pw-head p:not(.pw-eyebrow){margin-inline:0}
.pw-contact.pw-contact-solo{grid-template-columns:minmax(0,680px);justify-content:center}
.pw-contact-solo .pw-head{text-align:center}
.pw-contact-solo .pw-head .pw-eyebrow{justify-content:center}
.pw-contact-solo .pw-head p:not(.pw-eyebrow){margin-inline:auto}
/* شريط الأرقام يتماشى مع عرض الحاوية */
.pw-stats.pw-wrap{width:calc(100% - 48px);max-width:1200px;padding:0}
/* الالتزامات وطريقة العمل: نفس شكل الكروت ونفس التباعد والارتفاع */
.pw-trust,.pw-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--pw-gap);background:none;border:0;border-radius:0;overflow:visible}
.pw-trust li,.pw-trust li:first-child,.pw-trust li:nth-child(n),.pw-steps li{background:#fff;border:1px solid var(--line);border-radius:var(--pw-radius);padding:var(--ui-card-pad);height:100%}
.pw-trust li:hover,.pw-steps li:hover{border-color:rgba(199,85,23,.45);box-shadow:0 18px 38px -26px rgba(199,85,23,.45)}
.pw-card,.pw-contact-card,.pw-faq details{border-radius:var(--pw-radius)}
.pw-cards{gap:var(--pw-gap)}
.pw-card{height:100%}
.pw-tools,.pw-bim-stage,.pw-bim-panel{border-radius:var(--pw-radius)}
/* التواصل: عمودان متساويان بنفس الارتفاع */
.pw-contact{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--pw-gap);align-items:stretch}
.pw-contact>div:first-child{display:flex;flex-direction:column}
.pw-contact>div:first-child .pw-contact-card{flex:1}
.pw-contact>.pw-contact-card{height:100%}
.pw-faq{max-width:760px}
@media (max-width:1040px){
  .pw-trust,.pw-steps{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:1023px){
  .pw{--pw-pad-y:64px;--pw-gap:20px}
  .pw-head{margin-bottom:32px}
  .pw-head h2{font-size:clamp(1.28rem,4.5vw,1.85rem);line-height:1.34}
  .pw-head p:not(.pw-eyebrow){font-size:.96rem;line-height:1.64}
  .pw-contact,.pw-contact.pw-contact-solo{grid-template-columns:minmax(0,1fr)}
  .pw-stats.pw-wrap{width:calc(100% - 48px)}
  .pw-trust,.pw-steps{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pw-trust li:nth-child(n),.pw-trust li:first-child{border:1px solid var(--line)}
}
@media (max-width:639px){
  .pw{--pw-gap:16px;--pw-pad-y:48px;--pw-radius:var(--r-card)}
  .pw-wrap{padding-inline:16px}
  .pw-header{margin-bottom:-64px;background:linear-gradient(180deg,rgba(9,11,15,.82) 0%,rgba(9,11,15,0) 100%)}
  .pw-header.pw-header-glass{margin-bottom:-64px!important}
  .pw-header.is-scrolled{background:rgba(10,14,20,.92)}
  .pw-header-row{height:64px;gap:8px}
  .pw-brand{gap:8px}
  .pw-brand-mark{height:34px}
  .pw-brand-text strong{font-size:17px}
  .pw-brand-text small{font-size:10px}
  .pw-header-end{gap:6px}
  .pw-scale-switch{padding:2px}
  .pw-scale-btn{min-width:26px;height:30px;padding:0 5px;font-size:10.5px}
  .pw-burger{width:44px;height:44px;border-radius:var(--r-btn)}
  html[data-site-size="sm"] .pw .pw-btn,html[data-site-size="sm"] .pw .pw-bs-add-btn,html[data-site-size="sm"] .pw .pw-bs-wa-btn{min-height:44px!important}
  .pw-head{margin-bottom:32px;padding:0}
  .pw-head h2{font-size:clamp(1.18rem,4.8vw,1.48rem);line-height:1.36;margin-bottom:8px;letter-spacing:-0.01em}
  .pw-head p:not(.pw-eyebrow){font-size:clamp(0.85rem,3.4vw,0.92rem);line-height:1.6}
  .pw-eyebrow{font-size:.72rem;margin-bottom:8px}
  .pw-card{padding:16px;border-radius:var(--pw-radius);gap:12px}
  .pw-card h3,.pw-project h3{font-size:1.08rem}
  .pw-card>p,.pw-trust p,.pw-steps p{font-size:.88rem;line-height:1.6}
  .pw-card ul{gap:8px;padding-top:12px}
  .pw-card li{font-size:.86rem}
  .pw-icon{width:44px;height:44px;border-radius:var(--r-card-sm)}
  .pw-trust,.pw-steps{grid-template-columns:1fr}
  .pw-trust li:nth-child(n),.pw-trust li:first-child{border:1px solid var(--line);padding:16px;border-radius:var(--pw-radius)}
  .pw-steps li{padding:16px;border-radius:var(--pw-radius)}
  .pw-trust h3,.pw-steps h3{font-size:1.02rem}
  .pw-step-n{font-size:1.55rem;margin-bottom:8px}
  .pw-trust-n{font-size:.78rem;margin-bottom:8px}
  .pw-contact-card{padding:16px;border-radius:var(--pw-radius)}
  .pw-tools{border-radius:var(--pw-radius)}
  .pw-tools-body{padding:16px}
  .pw-tools-tabs{scrollbar-width:none;-webkit-overflow-scrolling:touch}
  .pw-tools-tabs::-webkit-scrollbar{display:none}
  .pw-tools-tabs button{padding:8px 12px;font-size:.86rem}
  .pw-answer{padding:16px}
  .pw-answer strong{font-size:1.5rem}
  .pw-bim-stage{min-height:300px;border-radius:var(--pw-radius)}
  .pw-bim-panel{padding:16px;border-radius:var(--pw-radius)}
  .pw-stats.pw-wrap{width:calc(100% - 32px);margin-bottom:16px;border-radius:var(--r-card)}
  .pw-stats li{padding:12px}
  .pw-stats strong{font-size:1rem}
  .pw-stats span{font-size:.72rem}
  .pw-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%}
  .pw-actions .pw-btn{width:100%;min-height:44px;padding:10px 16px;font-size:.875rem;border-radius:var(--r-btn);justify-content:center}
  .pw-actions .pw-btn:nth-child(1),.pw-actions .pw-btn:nth-child(2){grid-column:1/-1;min-height:48px;font-size:.9375rem}
  .pw-hero .phi-hb{height:clamp(225px,36svh,320px)}
  .pw-hero h1,.pw-hero h2{font-size:clamp(1.28rem,5.6vw,1.65rem);line-height:1.35;margin-bottom:12px}
  .pw-lead{font-size:clamp(0.86rem,3.4vw,0.94rem);line-height:1.6;margin-bottom:16px}
  .pw-view-tabs{gap:8px;padding:4px;margin-bottom:16px;border-radius:var(--r-card-sm)}
  .pw-view-tab{padding:8px 12px;font-size:.84rem;border-radius:var(--r-btn-sm)}
  .pw-exec-controls{padding:16px;border-radius:var(--pw-radius);gap:12px}
  .pw-exec-search-box{min-width:100%}
  .pw-exec-filter-group{flex-direction:column;align-items:stretch;gap:8px}
  .pw-exec-filter-label{min-width:0;font-size:.78rem}
  .pw-exec-chips,.pw-ck-chips,.pw-bim-layers{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:4px;max-width:100%}
  .pw-exec-chips::-webkit-scrollbar,.pw-ck-chips::-webkit-scrollbar,.pw-bim-layers::-webkit-scrollbar{display:none}
  .pw-exec-chips .pw-chip,.pw-ck-chips .pw-chip,.pw-bim-layers .pw-chip{flex:0 0 auto;white-space:nowrap;padding:6px 12px;font-size:.8rem}
  .pw-exec-card-header{padding:16px;gap:12px}
  .pw-exec-titles h3{font-size:1.02rem}
  .pw-exec-body{padding:16px;gap:16px}
  .pw-exec-block{padding:16px}
  .pw input:not([type="checkbox"]):not([type="range"]),.pw select,.pw textarea{font-size:16px!important}
}

/* ===== بوابة الأقسام الستة الرئيسية: لكل قسم صورته وهنت عائم بالسكلول بدون حاويات ===== */
.pw-portal-gateway{position:relative;z-index:2;padding:0!important;background:transparent!important;border-bottom:none}
.pw-panoramic-top-overlay{position:relative;z-index:3;padding-top:88px;padding-bottom:68px;height:100vh;height:100dvh;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;justify-content:space-between}
.pw-panoramic-floating-hero{max-width:760px;margin:auto;text-align:center;color:#fff;background:transparent!important;border:none!important;box-shadow:none!important;padding:0}
.pw-panoramic-eyebrow-row{display:inline-flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px;margin-bottom:10px}
.pw-panoramic-floating-hero .pw-eyebrow{color:#ffb074;text-shadow:0 2px 14px rgba(0,0,0,.8)}
.pw-portal-main-h1{font-size:clamp(1.85rem,3.6vw,2.85rem);font-weight:900;line-height:1.28;margin-bottom:10px;color:#fff;text-shadow:0 4px 24px rgba(0,0,0,.85)}
.pw-panoramic-sub{font-size:clamp(.95rem,1.2vw,1.1rem);color:rgba(255,255,255,.92);text-shadow:0 2px 16px rgba(0,0,0,.85);max-width:54ch;margin:0 auto}
.pw-panoramic-glass-band{position:relative;z-index:2;background:rgba(7,13,23,.34)!important;border-top:1px solid rgba(255,255,255,.12)}
.pw-panoramic-glass-band .pw-panoramic-band-head .pw-eyebrow{color:#ffb074;text-shadow:0 2px 12px rgba(0,0,0,.8)}
.pw-panoramic-glass-band .pw-panoramic-band-head h2{color:#ffffff;text-shadow:0 4px 20px rgba(0,0,0,.85)}
.pw-panoramic-glass-band .pw-offer-card,.pw-panoramic-glass-band .pw-prod-card{background:rgba(255,255,255,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.pw-guide-banner{background:#fff;border:1.5px solid #fed7aa;border-radius:var(--r-card);padding:16px 24px;margin-bottom:24px;display:flex;flex-direction:column;gap:12px;box-shadow:0 12px 28px -22px rgba(199,85,23,.45)}
.pw-guide-steps{display:flex;flex-wrap:wrap;gap:12px 24px;font-size:.86rem;color:var(--ink-2);padding-bottom:12px;border-bottom:1px dashed #fed7aa}
.pw-guide-steps strong{color:var(--o-dark);font-weight:900;margin-inline-end:4px}
.pw-guide-intents{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.pw-guide-intents-label{font-size:.86rem;font-weight:900;color:var(--ink)}
.pw-guide-chips{display:flex;flex-wrap:wrap;gap:8px}
.pw-guide-chip{padding:8px 16px;border-radius:var(--r-pill);border:1.5px solid var(--line);background:var(--tint);color:var(--ink);font-size:.82rem;font-weight:800;cursor:pointer;transition:all .16s ease}
.pw-guide-chip:hover,.pw-guide-chip.is-active{background:var(--portal-accent,var(--o));border-color:var(--portal-accent,var(--o));color:#fff;box-shadow:0 8px 18px -10px rgba(0,0,0,.35)}
.pw-portal-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--pw-gap)}
.pw-portal-card{text-align:start;background:#fff;border:1.5px solid var(--line);border-radius:var(--r-card);padding:24px;display:flex;flex-direction:column;gap:12px;cursor:pointer;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;position:relative}
.pw-portal-card:hover{transform:translateY(-4px);border-color:var(--portal-accent,var(--o));box-shadow:0 20px 42px -24px rgba(20,28,34,.22)}
.pw-portal-card.is-active{border-color:var(--portal-accent,var(--o));background:linear-gradient(180deg,#fff 0%,#fff9f5 100%);box-shadow:0 18px 40px -20px rgba(199,85,23,.32)}
.pw-portal-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.pw-portal-icon{width:48px;height:48px;border-radius:var(--r-card-sm);background:var(--o-soft);display:grid;place-items:center;font-size:1.55rem;flex-shrink:0}
.pw-portal-card.is-active .pw-portal-icon{background:var(--portal-accent,var(--o));color:#fff}
.pw-portal-badge{font-size:.74rem;font-weight:800;color:var(--ink-2);background:var(--tint);border:1px solid var(--line);border-radius:var(--r-pill);padding:4px 12px;margin-inline-end:auto}
.pw-portal-num{font-size:.82rem;font-weight:900;color:var(--o);opacity:.7}
.pw-portal-card h3{font-size:1.22rem;font-weight:900;color:var(--ink)}
.pw-portal-hint-box{background:#f8fafc;border-inline-start:3px solid var(--portal-accent,var(--o));border-radius:var(--r-btn);padding:8px 12px;display:flex;flex-direction:column;gap:4px}
.pw-portal-hint-box strong{font-size:.77rem;font-weight:900;color:var(--portal-accent,var(--o-dark))}
.pw-portal-hint-box span{font-size:.81rem;color:var(--ink);line-height:1.5;font-weight:600}
.pw-portal-desc{font-size:.87rem;color:var(--ink-2);line-height:1.55}
.pw-portal-list{display:flex;flex-direction:column;gap:6px;margin-top:4px;padding-top:12px;border-top:1px solid var(--line);font-size:.82rem;color:var(--ink)}
.pw-portal-list li{display:flex;align-items:flex-start;gap:8px}
.pw-portal-dot{color:var(--portal-accent,var(--o));font-weight:900}
.pw-portal-cta{margin-top:auto;min-height:40px;padding:8px 16px;border-radius:var(--r-btn);background:var(--o-soft);display:flex;align-items:center;justify-content:space-between;font-weight:900;font-size:.875rem;color:var(--portal-accent,var(--o));transition:background .16s ease,color .16s ease}
.pw-portal-card.is-active .pw-portal-cta,.pw-portal-card:hover .pw-portal-cta{background:var(--portal-accent,var(--o));color:#fff}

/* One architectural scene stays behind the full public homepage. */
.pw.pw-home-light,.pw:has(>.pw-construction){isolation:isolate;background:#fbfaf7}
.pw.pw-home-light>main,.pw:has(>.pw-construction)>main{position:relative;z-index:1}
.pw-construction{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:#efeae1;direction:rtl}
.pw-construction-horizon{position:absolute;inset:0;background:radial-gradient(ellipse at 60% 34%,rgba(255,224,188,.55),transparent 60%),linear-gradient(180deg,#e7eef4 0%,#f3efe8 56%,#ebe4d8 100%)}
.pw-construction-canvas,.pw-construction-canvas canvas{position:absolute;inset:0;display:block;width:100%;height:100%}
.pw-construction-poster{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain}
.pw-construction-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(251,250,247,.16),transparent 28%,transparent 72%,rgba(244,239,230,.24))}
.pw-construction-status{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:9px;color:#14181b;font-size:.73rem;font-weight:700;letter-spacing:.01em;padding:5px 14px;border-radius:999px;background:rgba(255,255,255,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(20,24,27,.12);white-space:nowrap;z-index:4}
.pw-construction-dot{width:5px;height:5px;border-radius:50%;background:#c75517;box-shadow:0 0 10px rgba(199,85,23,.45)}
.pw-construction-track{width:68px;height:2px;background:rgba(20,24,27,.16);overflow:hidden}
.pw-construction-track span{display:block;width:100%;height:100%;background:#c75517;transform:scaleX(var(--build-progress,0));transform-origin:right}
.pw-construction[data-fallback=true] .pw-construction-track{display:none}
.pw-construction-scroll-cue{display:flex;align-items:center;justify-content:center;gap:12px;align-self:center;color:#e7e4dd;font-size:.8rem;font-weight:700;padding:10px 18px;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.25)}
.pw-construction-scroll-cue:focus-visible{outline:2px solid #ffb074;outline-offset:5px}
.pw-construction-finale{position:relative;min-height:92vh;min-height:92svh;display:flex;align-items:flex-end;padding:64px 0 76px;background:linear-gradient(180deg,transparent 50%,rgba(9,15,19,.7));color:#fff}
.pw-construction-finale .pw-eyebrow{color:#ffb074}
.pw-construction-finale h2{font-size:clamp(1.5rem,3vw,2.4rem);font-weight:900;color:#fff;margin-bottom:20px}
@media(max-width:900px){.pw-construction-status{display:none}}
@media(max-width:700px){.pw-panoramic-floating-hero{margin:10vh auto auto}.pw-construction-scroll-cue{margin-bottom:14px}}
@media(prefers-reduced-motion:reduce){.pw-split-reveal,.pw-dual-card,.pw-dual-media img,.pw-dual-shortcut{transition:none!important;transform:none!important}.pw-construction-scroll-cue{scroll-behavior:auto}}
@media(max-height:500px) and (orientation:landscape){.pw-panoramic-top-overlay{height:auto;min-height:calc(100svh + 150px);padding-top:76px;padding-bottom:90px;gap:20px}.pw-panoramic-floating-hero{margin:28px auto}.pw-construction-scroll-cue{margin:0 auto 16px}.pw-construction-status{display:none}}

/* Dual Portal Containers — المبيعات + التركيبات والصيانة والتنفيذ */
.pw-split-stage{position:relative;width:100%;min-height:auto;padding:var(--ui-section-py) 0;background:linear-gradient(180deg,#fbfaf7 0%,#f5f0e7 52%,#fbfaf7 100%)!important;border-top:1px solid rgba(20,24,27,.06);border-bottom:1px solid rgba(20,24,27,.06)}
.pw-portal-studio-head{text-align:center;max-width:760px;margin:0 auto 28px;display:flex;flex-direction:column;align-items:center;gap:8px}
.pw-portal-studio-head .pw-eyebrow{color:#c75517;font-weight:800;margin:0}
.pw-portal-studio-head h2{font-size:clamp(1.42rem,2.45vw,2.05rem);font-weight:900;line-height:1.35;color:#14181b;margin:0}
.pw-portal-studio-sub{font-size:.96rem;font-weight:500;line-height:1.7;color:#525e6a;margin:0}

.pw-dual-portals{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--ui-gap);align-items:stretch}
.pw-dual-card{background:#ffffff;border:1.5px solid #e7e1d7;border-radius:var(--ui-card-r);overflow:hidden;display:flex;flex-direction:column;box-shadow:0 18px 40px -28px rgba(20,24,27,.18);transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease}
.pw-dual-card:hover{border-color:var(--dual-accent,var(--o));box-shadow:0 24px 48px -28px rgba(20,24,27,.26);transform:translateY(-2px)}

.pw-dual-media{position:relative;aspect-ratio:16/9;background:#14181b;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:16px}
.pw-dual-media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s ease}
.pw-dual-card:hover .pw-dual-media img{transform:scale(1.03)}
.pw-dual-media-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(12,17,24,.36) 0%,rgba(12,17,24,.12) 45%,rgba(12,17,24,.76) 100%);pointer-events:none}
.pw-dual-media-top{position:relative;z-index:2;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}
.pw-dual-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:var(--r-pill);background:rgba(255,255,255,.95);color:#14181b;font-size:.78rem;font-weight:800}
.pw-dual-kpi{padding:5px 12px;border-radius:var(--r-pill);background:rgba(12,17,24,.80);border:1px solid rgba(255,255,255,.22);color:#ffffff;font-size:.75rem;font-weight:800}
.pw-dual-tags{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:6px}
.pw-dual-tags span{padding:3px 10px;border-radius:var(--r-pill);background:rgba(12,17,24,.72);border:1px solid rgba(255,255,255,.2);color:#ffffff;font-size:.74rem;font-weight:700}

.pw-dual-body{padding:var(--ui-card-pad);display:flex;flex-direction:column;gap:16px;flex:1}
.pw-dual-title-row{display:flex;align-items:center;gap:12px}
.pw-dual-icon{width:44px;height:44px;border-radius:12px;background:color-mix(in srgb,var(--dual-accent,var(--o)) 12%,#ffffff);color:var(--dual-accent,var(--o));display:grid;place-items:center;flex-shrink:0}
.pw-dual-title-row h3{font-size:clamp(1.2rem,1.85vw,1.48rem);font-weight:900;line-height:1.35;color:#14181b;margin:0}
.pw-dual-benefit{font-size:.94rem;font-weight:500;line-height:1.7;color:#525e6a;margin:0}

.pw-dual-shortcuts{display:flex;flex-direction:column;gap:8px}
.pw-dual-shortcut{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:var(--r-card-sm);background:#faf8f4;border:1px solid #e7e1d7;color:#14181b;text-decoration:none;transition:border-color .16s ease,background .16s ease}
.pw-dual-shortcut:hover{border-color:var(--dual-accent,var(--o));background:#ffffff}
.pw-dual-shortcut-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.pw-dual-shortcut-copy strong{font-size:.87rem;font-weight:800;color:#14181b;line-height:1.35}
.pw-dual-shortcut-copy small{font-size:.76rem;font-weight:500;color:#525e6a;line-height:1.45}
.pw-dual-shortcut-arrow{font-size:.88rem;font-weight:900;color:var(--dual-accent,var(--o));flex-shrink:0}

.pw-dual-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:auto;padding-top:4px}
.pw-dual-primary-btn{flex:1;min-height:var(--ui-btn-h)!important;background:var(--dual-accent,var(--o))!important;border-color:var(--dual-accent,var(--o))!important;color:#ffffff!important}
.pw-dual-primary-btn:hover{filter:brightness(.92)}
.pw-dual-actions .pw-btn{min-height:var(--ui-btn-h)}

.pw-portal-utility-bar{margin-top:20px;background:#ffffff;border:1px solid #e7e1d7;border-radius:var(--ui-card-r);padding:12px 16px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}
.pw-utility-label{display:inline-flex;align-items:center;gap:8px;font-size:.86rem;font-weight:800;color:#14181b}
.pw-utility-links{display:flex;flex-wrap:wrap;gap:8px}
.pw-utility-link{display:inline-flex;align-items:center;min-height:36px;padding:6px 12px;border-radius:var(--r-pill);background:#f8f5ef;border:1px solid #e5ddd1;color:#3d4852;font-size:.82rem;font-weight:700;text-decoration:none;transition:border-color .16s ease,background .16s ease,color .16s ease}
.pw-utility-link:hover{border-color:#4f46e5;background:#ffffff;color:#14181b}

@media(max-width:960px){
  .pw-dual-portals{grid-template-columns:1fr}
}
@media(max-width:639px){
  .pw-dual-body{padding:16px}
  .pw-dual-actions .pw-btn{width:100%;min-height:48px}
  .pw-utility-link{min-height:40px}
}

/* الأداة السريعة المبسطة */
.pw-quick-finder{background:#fff;border:1.5px solid #fed7aa;border-radius:var(--r-card);padding:24px;display:flex;flex-direction:column;gap:16px}
.pw-quick-finder-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:16px}
.pw-quick-finder-head h2{font-size:clamp(1.25rem,2.4vw,1.7rem);font-weight:900}
.pw-quick-finder-controls{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between}
.pw-quick-finder-result{background:var(--o-soft);border:1px solid #fed7aa;border-radius:var(--r-card-sm);padding:12px 16px;font-weight:800;font-size:.94rem;color:#7c2d12}

/* رأس موحّد للصفحات العامة يطابق هوية الصفحة الرئيسية */
.pw-unified-hero{position:relative;background:linear-gradient(180deg,#fffaf5 0%,#ffffff 100%);padding:104px 0 40px;border-bottom:1px solid var(--line)}
.pw-unified-crumb{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;font-size:.82rem;font-weight:700;color:var(--ink-2);margin-bottom:16px}
.pw-unified-crumb a{color:var(--ink-2);transition:color .16s}
.pw-unified-crumb a:hover{color:var(--o)}
.pw-unified-crumb .sep{opacity:.45}
.pw-unified-promo{background:linear-gradient(90deg,rgba(249,115,22,.1),rgba(249,115,22,.05),rgba(14,165,233,.08));border:1px solid rgba(249,115,22,.22);border-radius:var(--r-card-sm);padding:8px 16px;text-align:center;color:var(--o-dark);font-weight:800;font-size:.83rem;margin:0 auto 24px;max-width:760px}
.pw-sec-hero-split{display:grid;grid-template-columns:1.15fr .85fr;gap:32px;align-items:center}
.pw-sec-hero-split .pw-head{text-align:start;margin:0;max-width:none}
.pw-sec-hero-split .pw-unified-crumb{justify-content:flex-start}
.pw-sec-hero-visual{position:relative;border-radius:var(--r-card);overflow:hidden;aspect-ratio:16/9;background:var(--tint);border:1.5px solid rgba(20,24,27,.1);box-shadow:0 22px 44px -24px rgba(20,24,27,.28)}
.pw-sec-hero-visual img{width:100%;height:100%;object-fit:cover;display:block}
.pw-sec-hero-badge{position:absolute;top:12px;inset-inline-end:12px;padding:4px 12px;border-radius:var(--r-pill);background:rgba(15,20,25,.68);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fff;font-size:.78rem;font-weight:900;border:1px solid rgba(255,255,255,.24)}

/* صفحة القسم المخصصة */
.pw-section-page{min-height:80vh;background:var(--tint)}
.pw-sec-hero{background:linear-gradient(180deg,#fffaf5 0%,#ffffff 100%);border-bottom:1px solid var(--line);padding:104px 0 40px}
.pw-sec-breadcrumb{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--line)}
.pw-back-btn{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:8px 16px;border-radius:var(--r-btn);background:var(--ink);color:#fff;font-size:.875rem;font-weight:800;transition:background .16s}
.pw-back-btn:hover{background:var(--o)}
.pw-sec-hops{display:flex;flex-wrap:wrap;gap:8px}
.pw-sec-hop{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:6px 12px;border-radius:var(--r-pill);border:1px solid var(--line);background:#fff;font-size:.8125rem;font-weight:800;color:var(--ink-2)}
.pw-sec-hop.is-current{background:var(--o-soft);border-color:var(--o);color:var(--o-dark)}
.pw-sec-title-row{display:flex;align-items:center;gap:16px}
.pw-sec-big-icon{width:64px;height:64px;border-radius:var(--r-card);background:var(--o-soft);display:grid;place-items:center;font-size:2.1rem;flex-shrink:0}
.pw-sec-kicker{display:block;font-size:.78rem;font-weight:900;color:var(--portal-accent,var(--o));margin-bottom:4px}
.pw-sec-title-row h1{font-size:clamp(1.45rem,2.8vw,2.1rem);font-weight:900;margin-bottom:4px}
.pw-sec-title-row p{font-size:.96rem;color:var(--ink-2)}
.pw-sec-content{padding-top:32px;padding-bottom:64px}

.pw-explorer-switcher{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px}
.pw-explorer-pill{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:8px 16px;border-radius:var(--r-pill);border:1.5px solid var(--line);background:#fff;color:var(--ink-2);font-weight:800;font-size:.875rem;cursor:pointer;transition:all .16s ease}
.pw-explorer-pill:hover{border-color:var(--o);color:var(--ink)}
.pw-explorer-pill.is-active{background:var(--ink);border-color:var(--ink);color:#fff;box-shadow:0 8px 20px -10px rgba(20,24,27,.45)}

.pw-explorer-header{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:24px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px}
.pw-explorer-title-group{display:flex;align-items:flex-start;gap:16px;max-width:44rem}
.pw-explorer-hero-icon{width:56px;height:56px;border-radius:var(--r-card);background:var(--o-soft);display:grid;place-items:center;font-size:1.8rem;flex-shrink:0}
.pw-explorer-kicker{display:block;font-size:.76rem;font-weight:800;color:var(--o);margin-bottom:2px}
.pw-explorer-header h2{font-size:clamp(1.3rem,2.4vw,1.8rem);font-weight:900;margin-bottom:4px}
.pw-explorer-header p{font-size:.93rem;color:var(--ink-2)}
.pw-explorer-quick-links{display:flex;flex-wrap:wrap;gap:12px;align-items:center}

.pw-chip-bar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px}
.pw-mnt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--pw-gap)}
.pw-mnt-card{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:24px;display:flex;flex-direction:column;gap:16px}
.pw-mnt-card-head{display:flex;align-items:flex-start;gap:12px}
.pw-mnt-icon{width:48px;height:48px;border-radius:var(--r-card-sm);background:var(--o-soft);display:grid;place-items:center;font-size:1.45rem;flex-shrink:0}
.pw-mnt-code{display:block;font-size:.75rem;font-weight:800;color:var(--o);margin-bottom:2px}
.pw-mnt-card-head h3{font-size:1.08rem;font-weight:900}
.pw-mnt-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pw-mnt-box{background:var(--tint);border-radius:var(--r-card-sm);padding:12px;font-size:.83rem}
.pw-mnt-box strong{display:block;margin-bottom:6px;font-weight:800;color:var(--ink)}
.pw-mnt-box ul{display:flex;flex-direction:column;gap:4px;color:var(--ink-2)}
.pw-mnt-box li::before{content:'• ';color:var(--o);font-weight:900}
.pw-mnt-tip{background:#fff7ed;border:1px solid #fed7aa;border-radius:var(--r-card-sm);padding:12px 16px;font-size:.84rem;color:#7c2d12;line-height:1.6}
.pw-mnt-tip strong{color:#9a3412}
.pw-mnt-foot{margin-top:auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding-top:12px;border-top:1px solid var(--line)}
.pw-mnt-warranty{font-size:.78rem;font-weight:800;color:#0369a1;background:#f0f9ff;border:1px solid #bae6fd;border-radius:var(--r-pill);padding:4px 12px}
.pw-mnt-actions{display:flex;gap:8px;flex-wrap:wrap}

.pw-calc-box{background:#fff;border:1.5px solid var(--line);border-radius:var(--r-card);padding:24px}
.pw-calc-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:20px}
.pw-calc-head h3{font-size:1.25rem;font-weight:900}
.pw-calc-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:24px;align-items:stretch}
.pw-calc-controls{display:flex;flex-direction:column;gap:16px}
.pw-calc-sliders{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
.pw-calc-scopes{display:flex;flex-wrap:wrap;gap:8px}
.pw-scope-toggle{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:8px 16px;border-radius:var(--r-btn);border:1.5px solid var(--line);background:var(--tint);font-size:.86rem;font-weight:800;cursor:pointer}
.pw-scope-toggle.is-on{background:var(--o-soft);border-color:var(--o);color:var(--o-dark)}
.pw-calc-summary{background:var(--tint);border:1px solid var(--line);border-radius:var(--r-card);padding:24px;display:flex;flex-direction:column;justify-content:space-between;gap:16px}
.pw-calc-summary-top{display:flex;flex-direction:column;gap:4px}
.pw-calc-summary-top span{font-size:.84rem;color:var(--ink-2);font-weight:700}
.pw-calc-summary-top strong{font-size:1.7rem;font-weight:900;color:var(--o-dark)}
.pw-discount-pill{display:inline-block;align-self:flex-start;background:#dcfce7!important;color:#15803d!important;border:1px solid #86efac;border-radius:var(--r-btn-sm);padding:4px 12px;font-size:.78rem!important;font-weight:800;margin-top:4px}
.pw-calc-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.pw-calc-metrics>div{background:#fff;border:1px solid var(--line);border-radius:var(--r-card-sm);padding:12px;display:flex;flex-direction:column;gap:4px}
.pw-calc-metrics small{font-size:.74rem;color:var(--ink-2);font-weight:700}
.pw-calc-metrics strong{font-size:1rem;font-weight:900;color:var(--ink)}

.pw-re-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--pw-gap)}
.pw-re-card{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:24px;display:flex;flex-direction:column;justify-content:space-between;gap:16px}
.pw-re-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.pw-re-hot{display:inline-block;font-size:.75rem;font-weight:800;color:#9a3412;background:#ffedd5;border:1px solid #fdba74;border-radius:var(--r-pill);padding:4px 12px;margin-bottom:8px}
.pw-re-card h3{font-size:1.12rem;font-weight:900;margin-bottom:4px}
.pw-re-sub{font-size:.86rem;color:var(--ink-2);margin-bottom:12px}
.pw-re-specs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px}
.pw-re-specs>div{background:var(--tint);border-radius:var(--r-btn);padding:8px 12px;display:flex;flex-direction:column}
.pw-re-specs small{font-size:.72rem;color:var(--ink-2);font-weight:700}
.pw-re-specs strong{font-size:.86rem;font-weight:800;color:var(--ink)}
.pw-re-features{display:flex;flex-direction:column;gap:4px;font-size:.84rem;color:var(--ink-2)}
.pw-re-foot{display:flex;flex-direction:column;gap:12px;padding-top:12px;border-top:1px solid var(--line)}
.pw-re-terms{font-size:.8rem;font-weight:800;color:#0369a1}

.pw-materials-highlight{background:linear-gradient(135deg,#fff7ed 0%,#ffffff 100%);border:1.5px solid #fdba74;border-radius:var(--r-card);padding:16px 20px;margin-bottom:20px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}
.pw-materials-highlight strong{display:block;font-size:.95rem;color:#9a3412;margin-bottom:4px}
.pw-materials-highlight span{display:block;font-size:.84rem;color:#7c2d12;line-height:1.55}

.pw-section-page .pw-sec-content > .pw-wrap:has(.pw-prod-grid){max-width:none;width:100%;padding-inline:clamp(16px,2.4vw,40px)}
.pw-prod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,var(--ui-prod-min,260px)),1fr));gap:var(--ui-gap,20px)}
.pw-prod-card{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:20px;display:flex;flex-direction:column;justify-content:space-between;gap:12px;transition:transform .18s,border-color .18s,box-shadow .18s}
.pw-prod-card:hover{transform:translateY(-3px);border-color:rgba(199,85,23,.5);box-shadow:0 16px 32px -22px rgba(20,24,27,.25)}
.pw-prod-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.pw-prod-code{font-family:ui-monospace,Consolas,monospace;font-size:.72rem;font-weight:800;color:var(--ink-2);background:var(--tint);padding:2px 8px;border-radius:6px}
.pw-prod-badge{font-size:.72rem;font-weight:800;color:var(--o-dark);background:var(--o-soft);padding:2px 8px;border-radius:var(--r-pill)}
.pw-prod-card h3{font-size:.98rem;font-weight:900;line-height:1.45;margin-bottom:8px}
.pw-prod-desc{font-size:.82rem;color:var(--ink-2);line-height:1.55;margin-bottom:8px}
.pw-prod-specs{display:flex;flex-direction:column;gap:4px;font-size:.78rem;color:var(--ink-2)}
.pw-prod-foot{display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px solid var(--line)}
.pw-prod-install-check{display:flex;align-items:center;gap:8px;font-size:.8rem;font-weight:800;color:var(--ink);cursor:pointer}
.pw-prod-actions{display:flex;gap:8px;align-items:center}

.pw-info-shortcuts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--pw-gap)}
.pw-info-shortcut-card{background:#fff;border:1.5px solid var(--line);border-radius:var(--r-card);padding:16px;display:flex;align-items:center;gap:12px;transition:border-color .18s,transform .18s}
.pw-info-shortcut-card:hover{border-color:var(--o);transform:translateY(-2px)}
.pw-info-shortcut-card>span{font-size:1.75rem;flex-shrink:0}
.pw-info-shortcut-card strong{display:block;font-size:.96rem;font-weight:900;color:var(--ink)}
.pw-info-shortcut-card small{font-size:.8rem;color:var(--ink-2)}
.pw-tips-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--pw-gap)}
.pw-tip-card{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:20px;display:flex;flex-direction:column;gap:8px}
.pw-tip-tag{align-self:flex-start;font-size:.74rem;font-weight:800;color:var(--o-dark);background:var(--o-soft);border-radius:var(--r-pill);padding:4px 12px}
.pw-tip-card h4{font-size:1rem;font-weight:900}
.pw-tip-card p{font-size:.86rem;color:var(--ink-2);line-height:1.65}
.pw-info-meta-row{display:flex;flex-wrap:wrap;gap:16px;margin-top:24px}

.pw-advisor-shell{background:linear-gradient(135deg,#fff 0%,#fff8f2 100%);border:1.5px solid #fed7aa;border-radius:var(--r-card);padding:32px;display:grid;grid-template-columns:1.1fr 1fr;gap:24px;align-items:center;box-shadow:0 24px 48px -32px rgba(199,85,23,.35)}
.pw-advisor-right{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:24px}
.pw-advisor-right h3{font-size:1.25rem;font-weight:900;margin:8px 0}
.pw-advisor-duration{font-size:.9rem;color:var(--ink-2);margin-bottom:16px}
.pw-advisor-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:16px}
.pw-advisor-metrics>div{background:var(--tint);border-radius:var(--r-card-sm);padding:12px;display:flex;flex-direction:column;gap:4px}
.pw-advisor-metrics small{font-size:.73rem;color:var(--ink-2);font-weight:700}
.pw-advisor-metrics strong{font-size:.92rem;font-weight:900;color:var(--o-dark)}

.pw-offers-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--pw-gap)}
.pw-offer-card{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:24px;display:flex;flex-direction:column;justify-content:space-between;gap:16px}
.pw-offer-card.is-highlight{border-color:rgba(199,85,23,.55);background:linear-gradient(180deg,#fff 0%,#fff9f4 100%)}
.pw-offer-card h3{font-size:1.12rem;font-weight:900;margin-bottom:8px}
.pw-offer-card p{font-size:.87rem;color:var(--ink-2);margin-bottom:12px}
.pw-offer-actions{display:flex;flex-wrap:wrap;gap:8px}

/* شريط آخر الأخبار المتحرك في الشاشة الرئيسية — شفاف بالكامل بدون حاوية */
.phi-ticker-bar{display:flex;align-items:center;gap:12px;margin:0 auto 16px;padding:4px 0;border-radius:0;background:transparent!important;border:none!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;overflow:hidden}
.phi-ticker-badge{display:inline-flex;align-items:center;gap:8px;flex-shrink:0;padding:4px 12px;border-radius:var(--r-pill);background:rgba(199,85,23,.85);color:#fff;font-size:.76rem;font-weight:900;letter-spacing:.01em}
.phi-ticker-dot{width:7px;height:7px;border-radius:50%;background:#fff;box-shadow:0 0 0 0 rgba(255,255,255,.75);animation:phiTickerPulse 1.8s infinite!important;animation-duration:1.8s!important;animation-iteration-count:infinite!important}
@keyframes phiTickerPulse{0%{box-shadow:0 0 0 0 rgba(255,255,255,.75)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
.phi-ticker-viewport{position:relative;flex:1;min-width:0;direction:ltr;text-align:left;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 22px,#000 calc(100% - 22px),transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 22px,#000 calc(100% - 22px),transparent 100%)}
.phi-ticker-track{display:flex;flex-direction:row;align-items:center;width:max-content;direction:ltr;will-change:transform}
.phi-ticker-group{display:flex;flex-direction:row;align-items:center;gap:14px;padding-inline-end:14px;flex-shrink:0}
.phi-ticker-item{display:inline-flex;align-items:center;gap:8px;direction:rtl;white-space:nowrap;font-size:.86rem;font-weight:800;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.85);padding:4px 8px;border-radius:var(--r-btn-sm);transition:color .16s}
.phi-ticker-item.is-link:hover{color:#ffb074}
.phi-ticker-tag{display:inline-flex;align-items:center;padding:2px 8px;border-radius:var(--r-pill);background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.24);color:#ffd2ad;font-size:.73rem;font-weight:900}
.phi-ticker-text{line-height:1.45}
.phi-ticker-sep{color:#ffb074;font-size:.76rem;opacity:.85;flex-shrink:0}
.phi-ticker-toggle{flex-shrink:0;width:32px;height:32px;border-radius:var(--r-btn-sm);border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;display:grid;place-items:center;font-size:.75rem;font-weight:900;cursor:pointer;transition:border-color .16s,color .16s}
.phi-ticker-toggle:hover{border-color:var(--o);color:var(--o);background:var(--o-soft)}
@media (max-width:760px){
  .phi-ticker-bar{gap:8px;margin-bottom:16px;padding:6px 8px;border-radius:var(--r-card-sm)}
  .phi-ticker-badge{padding:4px 8px;font-size:.72rem;border-radius:var(--r-btn-sm)}
  .phi-ticker-item{font-size:.8rem}
  .phi-ticker-toggle{width:32px;height:32px}
}

@media (max-width:1100px){
  .pw-portal-grid,.pw-offers-grid,.pw-tips-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pw-calc-grid,.pw-advisor-shell{grid-template-columns:1fr}
}
@media (max-width:1023px){
  .pw-split-station-row{height:100vh;height:100svh;min-height:100vh;min-height:100svh;padding:56px 0}
  .pw-split-station-row.is-side-left .pw-sec-floating-wrap{justify-content:flex-start}
  .pw-split-station-row.is-side-left .pw-split-col{text-align:right}
  .pw-split-station-row.is-side-left .pw-split-col-inner,.pw-split-station-row.is-side-left .pw-split-reveal{align-items:flex-start}
  .pw-sec-hero-split{grid-template-columns:1fr;gap:24px}
  .pw-sec-hero-split .pw-head{text-align:center}
  .pw-sec-hero-split .pw-unified-crumb{justify-content:center}
}
@media (max-width:639px){
  .pw-portal-grid,.pw-mnt-grid,.pw-mnt-cols,.pw-re-grid,.pw-info-shortcuts,.pw-tips-grid,.pw-offers-grid,.pw-calc-metrics,.pw-advisor-metrics{grid-template-columns:1fr}
  .pw-explorer-header,.pw-calc-box,.pw-advisor-shell,.pw-quick-finder,.pw-mnt-card,.pw-re-card,.pw-offer-card{padding:16px}
  .pw-unified-hero,.pw-sec-hero{padding:80px 0 32px}
}
@media (max-width:600px){
  .pw-split-station-row{height:100vh;height:100svh;min-height:100vh;min-height:100svh;padding:48px 0}
  .pw-split-col h2{font-size:1.55rem}
  .pw-split-hint{font-size:.98rem}
}
@media (prefers-reduced-motion:reduce){
  .pw-split-col,.pw-split-bg-base,.pw-split-bg-layer,.pw-split-reveal,.pw-split-bar,.pw-split-num{transition:none!important;animation:none!important;transform:none!important}
}

/* ===== المرحلة 1: الترحيب + البحث الشامل (تصميم نهاري مريح للعين - 8pt Grid) ===== */
.pw-welcome-band{position:relative;z-index:4;padding:calc(var(--ui-section-py) + 16px) 0 calc(var(--ui-section-py) * 0.72);color:#14181b;background:linear-gradient(180deg,#fffaf4 0%,#fbfaf7 100%)}
.pw-welcome-shell{background:transparent;border:none;border-radius:0;padding:0;backdrop-filter:none;-webkit-backdrop-filter:none;box-shadow:none;display:flex;flex-direction:column;gap:24px}
.pw-welcome-head{text-align:center;align-items:center;max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.pw-welcome-head .pw-eyebrow{color:#c75517;font-weight:800;margin:0;text-shadow:0 1px 14px rgba(251,250,247,.95)}
.pw-welcome-head h1{font-size:clamp(1.5rem,2.6vw,2.2rem);font-weight:800;line-height:1.4;color:#14181b;margin:0;text-shadow:0 1px 14px rgba(251,250,247,.95)}
.pw-welcome-sub{font-size:clamp(.95rem,1.08vw,1.02rem);font-weight:500;color:#525e6a;line-height:1.75;margin:0;text-shadow:0 1px 14px rgba(251,250,247,.95)}

/* شريط البحث الشامل المربوط بكل الأقسام */
.pw-omni-wrap{position:relative;z-index:25;max-width:760px;width:100%;margin:0 auto}
.pw-omni-box{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.92);border:1.5px solid #dfd7cc;border-radius:var(--ui-card-r);padding:8px 16px 8px 8px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 14px 32px -18px rgba(20,24,27,.18);transition:border-color .18s,box-shadow .18s}
.pw-omni-box:focus-within,.pw-omni-box.is-open{border-color:#c75517;box-shadow:0 0 0 3px rgba(199,85,23,.14)}
.pw-omni-icon{color:#525e6a;display:inline-flex;align-items:center;flex-shrink:0}
.pw-omni-input{flex:1;min-width:0;border:none!important;background:transparent!important;color:#14181b!important;font-size:.95rem;font-weight:600;outline:none!important;padding:8px 4px}
.pw-omni-input::placeholder{color:#818b96}
.pw-omni-clear{width:32px;height:32px;border-radius:var(--r-btn-sm);border:none;background:#f4efe6;color:#47525c;font-weight:800;cursor:pointer;display:grid;place-items:center;flex-shrink:0}
.pw-omni-clear:hover{background:#e7dfd2;color:#14181b}
.pw-omni-store-btn{display:inline-flex;align-items:center;gap:8px;min-height:max(36px,calc(var(--ui-btn-h) - 4px));padding:8px 16px;border-radius:var(--ui-btn-r);background:var(--o);color:#fff;font-size:.875rem;font-weight:700;white-space:nowrap;flex-shrink:0;text-decoration:none;transition:background .16s}
.pw-omni-store-btn:hover{background:var(--o-dark)}
.pw-omni-dropdown{position:absolute;top:calc(100% + 8px);inset-inline:0;background:#ffffff;border:1px solid #e7e1d7;border-radius:var(--r-card);padding:16px;max-height:420px;overflow-y:auto;box-shadow:0 26px 56px -18px rgba(20,24,27,.22);display:flex;flex-direction:column;gap:12px}
.pw-omni-group{display:flex;flex-direction:column;gap:8px}
.pw-omni-group-title{font-size:.8rem;font-weight:800;color:#c75517;padding:4px 8px;border-bottom:1px solid #efe9df}
.pw-omni-row{display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--r-card-sm);background:#faf8f4;border:1px solid transparent;transition:background .16s,border-color .16s;text-decoration:none;color:#14181b}
.pw-omni-row:hover{background:#f3ede3;border-color:#e4dacb}
.pw-omni-thumb{width:64px;height:48px;border-radius:8px;object-fit:cover;background:#10161e;flex-shrink:0}
.pw-omni-icon-badge{width:42px;height:42px;border-radius:10px;background:#f4efe6;display:grid;place-items:center;font-size:1.15rem;flex-shrink:0}
.pw-omni-row-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.pw-omni-row-meta{display:flex;gap:8px;font-size:.76rem;color:#c75517;font-weight:700}
.pw-omni-row-info strong{font-size:.9rem;font-weight:700;color:#14181b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pw-omni-row-info small{font-size:.82rem;font-weight:500;color:#525e6a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pw-omni-row-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
.pw-omni-add-btn{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:6px 12px;border-radius:var(--r-btn-sm);border:none;background:var(--o);color:#fff;font-size:.8125rem;font-weight:700;cursor:pointer;white-space:nowrap}
.pw-omni-add-btn.is-added{background:#059669}
.pw-omni-go-link{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:6px 12px;border-radius:var(--r-btn-sm);border:1px solid #dfd7cc;background:#fff;color:#47525c;font-size:.8125rem;font-weight:600;text-decoration:none;white-space:nowrap}
.pw-omni-go-link:hover{background:#f4efe6;color:#14181b}
.pw-omni-empty{padding:20px 12px;text-align:center;color:#525e6a;display:flex;flex-direction:column;gap:12px}

/* ===== المرحلة 2: عرض متزامن لقسم المبيعات (شاشة كمبيوتر + تزامن لحظي + آيفون + متجر iOS و Android) ===== */
.pw-sim-section{position:relative;z-index:3;padding:var(--ui-section-py) 0;color:#14181b;background:linear-gradient(180deg,#fbfaf7 0%,#f6f2ea 100%)}
.pw-sim-top-head{text-align:center;max-width:720px;margin:0 auto 32px;display:flex;flex-direction:column;align-items:center;gap:8px}
.pw-sim-live-pill{display:inline-flex;align-items:center;gap:8px;padding:4px 12px;border-radius:var(--r-pill);background:rgba(255,255,255,.86);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(199,85,23,.22);color:#14181b;font-size:.8rem;font-weight:800;box-shadow:0 4px 12px -8px rgba(20,24,27,.14)}
.pw-sim-live-pill i{display:block;width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 8px rgba(16,185,129,.55);animation:pwSimLivePulse 2.1s infinite}
@keyframes pwSimLivePulse{0%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}100%{opacity:1;transform:scale(1)}}
.pw-sim-top-head h2{font-size:clamp(1.36rem,2.3vw,1.92rem);font-weight:800;line-height:1.4;color:#14181b;text-shadow:0 1px 12px rgba(251,250,247,.95);margin:0}
.pw-sim-top-head h2 em{font-style:normal;color:var(--o)}
.pw-sim-lead{font-size:.96rem;font-weight:500;line-height:1.75;color:#525e6a;text-shadow:0 1px 12px rgba(251,250,247,.95);margin:0}

/* Read-only Editorial 4-Step Auto-Play Timeline (Zero manual buttons) */
.pw-sim-narrator-bar{background:rgba(255,255,255,.84);backdrop-filter:blur(16px) saturate(135%);-webkit-backdrop-filter:blur(16px) saturate(135%);border:1px solid rgba(231,225,215,.95);border-radius:var(--ui-card-r);padding:var(--ui-card-pad-sm) var(--ui-card-pad);margin-bottom:32px;display:flex;flex-direction:column;gap:16px;box-shadow:0 18px 40px -28px rgba(20,24,27,.18)}
.pw-sim-timeline-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
.pw-sim-narrator-copy{flex:1;min-width:240px;display:flex;flex-direction:column;gap:4px}
.pw-sim-caption-tag{font-size:.78rem;font-weight:800;color:#c75517}
.pw-sim-narrator-copy strong{font-size:1.05rem;font-weight:800;color:#14181b}
.pw-sim-narrator-copy p{font-size:.88rem;font-weight:500;color:#525e6a;margin:0;line-height:1.65}
.pw-sim-caption-counter{font-family:ui-monospace,Consolas,monospace;font-size:.76rem;font-weight:800;color:#47525c;background:#f4efe6;border:1px solid #e7e1d7;padding:4px 12px;border-radius:var(--r-pill);white-space:nowrap}
.pw-sim-stepper{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding-top:12px;border-top:1px solid rgba(231,225,215,.85)}
.pw-sim-step-item{display:flex;flex-direction:column;gap:6px;opacity:.58;transition:opacity .25s ease}
.pw-sim-step-item.is-done{opacity:.85}
.pw-sim-step-item.is-active{opacity:1}
.pw-sim-step-label{display:flex;align-items:center;gap:6px;font-size:.78rem;font-weight:700;color:#525e6a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pw-sim-step-item.is-active .pw-sim-step-label{color:#14181b;font-weight:800}
.pw-sim-step-num{font-family:ui-monospace,Consolas,monospace;font-size:.72rem;font-weight:800;color:#c75517;flex-shrink:0}
.pw-sim-seg-track{position:relative;height:4px;border-radius:var(--r-pill);background:#e7e1d7;overflow:hidden}
.pw-sim-seg-track.is-done{background:linear-gradient(90deg,var(--o),#e39b66)}
.pw-sim-seg-fill{position:absolute;inset:0;background:linear-gradient(90deg,var(--o),#e39b66);transform-origin:right center;transform:scaleX(0)}
.pw-sim-seg-fill.is-running{animation:pwSimBarFill 4.3s linear forwards}
@keyframes pwSimBarFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}

/* Synchronized Dual-Device Grid: Wide Studio Monitor + Sync Bridge + Slender iPhone Pro */
.pw-sim-dual-stage{display:grid;grid-template-columns:minmax(0,1fr) 76px 256px;gap:16px;align-items:center}
.pw-sim-sync-bridge{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;position:relative}
.pw-sim-sync-line{position:absolute;inset-inline:-16px;top:50%;height:2px;background:linear-gradient(90deg,rgba(199,85,23,.14),rgba(199,85,23,.65),rgba(199,85,23,.14));z-index:0}
.pw-sim-sync-node{position:relative;z-index:1;width:40px;height:40px;border-radius:9999px;background:#ffffff;border:1.5px solid rgba(199,85,23,.35);color:#c75517;display:grid;place-items:center;box-shadow:0 10px 24px -10px rgba(199,85,23,.4);transition:transform .25s ease,box-shadow .25s ease}
.pw-sim-sync-node.is-pulsing{transform:scale(1.08);box-shadow:0 0 0 6px rgba(199,85,23,.15),0 10px 24px -10px rgba(199,85,23,.5)}
.pw-sim-sync-node svg{transition:transform .5s ease}
.pw-sim-sync-node.is-pulsing svg{transform:rotate(180deg)}
.pw-sim-sync-label{position:relative;z-index:1;font-size:.68rem;font-weight:800;color:#a64310;background:rgba(255,255,255,.94);border:1px solid #fed7aa;padding:2px 8px;border-radius:9999px;white-space:nowrap}

/* A. Realistic Desktop Studio Monitor + Clean Bright Browser Website */
.pw-sim-desktop-col{display:flex;flex-direction:column;align-items:center}
.pw-sim-monitor{width:100%;border-radius:18px;padding:9px;background:linear-gradient(155deg,#2b313a 0%,#12161c 55%,#1e242c 100%);border:1px solid rgba(255,255,255,.22);box-shadow:0 32px 64px -26px rgba(20,24,27,.34),inset 0 1px 0 rgba(255,255,255,.16)}
.pw-sim-monitor-screen{border-radius:12px;overflow:hidden;background:#f8f6f2;border:1px solid #dfd7cc;color:#14181b;display:flex;flex-direction:column}
.pw-sim-chrome{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 14px;background:#ffffff;border-bottom:1px solid #e7e1d7}
.pw-sim-chrome-dots{display:flex;gap:6px}
.pw-sim-chrome-dots span{width:9px;height:9px;border-radius:50%}
.pw-sim-chrome-dots span:nth-child(1){background:#ef4444}
.pw-sim-chrome-dots span:nth-child(2){background:#f59e0b}
.pw-sim-chrome-dots span:nth-child(3){background:#10b981}
.pw-sim-chrome-url{flex:1;max-width:25rem;margin:0 auto;display:flex;align-items:center;gap:6px;padding:3px 12px;border-radius:999px;background:#f4efe6;border:1px solid #e7e1d7;font-family:ui-monospace,Consolas,monospace;font-size:.72rem;color:#47525c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pw-sim-chrome-live{display:inline-flex;align-items:center;gap:5px;font-size:.7rem;font-weight:800;color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;padding:2px 9px;border-radius:9999px;white-space:nowrap}
.pw-sim-chrome-live i{display:block;width:6px;height:6px;border-radius:50%;background:#10b981}

.pw-sim-web-nav{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;background:#ffffff;border-bottom:1px solid #ede7dd}
.pw-sim-app-brand{display:flex;align-items:center;gap:7px;font-size:.82rem}
.pw-sim-app-brand strong{font-weight:900;color:#14181b}
.pw-sim-brand-img{width:18px;height:18px;object-fit:contain;display:block;flex-shrink:0}
.pw-sim-web-links{display:flex;align-items:center;gap:12px;font-size:.76rem;font-weight:700;color:#525e6a}
.pw-sim-web-links span.is-active{color:#c75517}
.pw-sim-cart-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;background:#f4efe6;border:1px solid #e7e1d7;font-size:.72rem;font-weight:800;color:#14181b;transition:all .22s}
.pw-sim-cart-pill.is-filled{background:#059669;border-color:#059669;color:#fff;box-shadow:0 4px 12px rgba(16,185,129,.28)}
.pw-sim-cart-pill.is-pop{animation:pwCartPop .42s cubic-bezier(.2,1.25,.4,1)}
@keyframes pwCartPop{0%{transform:scale(.85)}55%{transform:scale(1.18)}100%{transform:scale(1)}}

.pw-sim-web-body{position:relative;padding:16px;min-height:282px;display:flex;flex-direction:column;justify-content:center;overflow:hidden;background:#f8f6f2}
.pw-sim-web-grid{display:grid;grid-template-columns:1.35fr .95fr;gap:12px;align-items:stretch}
.pw-sim-web-card{display:flex;gap:11px;padding:10px;border-radius:14px;background:#ffffff;border:1.5px solid rgba(199,85,23,.55);align-items:center;box-shadow:0 8px 20px -14px rgba(20,24,27,.18)}
.pw-sim-web-card.is-secondary{border:1px solid #e7e1d7;opacity:.76;box-shadow:none}
.pw-sim-web-card img{width:108px;height:82px;border-radius:10px;object-fit:cover;flex-shrink:0;background:#10161e}
.pw-sim-web-card-copy{display:flex;flex-direction:column;gap:4px;min-width:0;align-items:flex-start}
.pw-sim-web-card-copy strong{font-size:.82rem;font-weight:800;color:#14181b;line-height:1.35}
.pw-sim-web-card-copy small{font-size:.72rem;color:#525e6a;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

.pw-sim-web-detail{display:grid;grid-template-columns:190px 1fr;gap:16px;align-items:center;padding:14px;border-radius:16px;background:#ffffff;border:1px solid #e7e1d7}
.pw-sim-web-detail-img{width:100%;height:142px;border-radius:12px;object-fit:cover;background:#10161e}
.pw-sim-web-detail-info{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.pw-sim-web-detail-info strong{font-size:.94rem;font-weight:800;color:#14181b}
.pw-sim-web-detail-info small{font-size:.76rem;color:#525e6a}
.pw-sim-web-detail-actions{display:flex;align-items:center;gap:10px;width:100%;margin-top:4px}
.pw-sim-web-detail-actions .pw-sim-action-btn{flex:1}

.pw-sim-web-checkout{background:#ffffff;border:1px solid #e7e1d7;border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:12px}
.pw-sim-web-checkout-cols{display:grid;grid-template-columns:1.15fr .85fr;gap:10px}

.pw-sim-stand{display:flex;flex-direction:column;align-items:center;width:100%}
.pw-sim-stand-neck{width:76px;height:36px;background:linear-gradient(180deg,#8b95a3 0%,#cdd4dd 100%);border-inline:1px solid rgba(20,24,27,.12)}
.pw-sim-stand-base{width:190px;height:10px;border-radius:999px;background:linear-gradient(90deg,#aeb6c2 0%,#e5e9ef 50%,#aeb6c2 100%);border:1px solid rgba(20,24,27,.16);box-shadow:0 10px 20px -10px rgba(20,24,27,.28)}

/* Animated Desktop Arrow Cursor */
.pw-sim-cursor{position:absolute;pointer-events:none;z-index:6;transition:left .44s cubic-bezier(.2,.8,.2,1),top .44s cubic-bezier(.2,.8,.2,1),opacity .25s ease;filter:drop-shadow(0 3px 6px rgba(20,24,27,.35))}
.pw-sim-cursor.is-clicking svg{transform:scale(.82)}
.pw-sim-cursor.is-pos-0{left:62%;top:72%}
.pw-sim-cursor.is-pos-1{left:22%;top:76%}
.pw-sim-cursor.is-pos-2{left:48%;top:82%}
.pw-sim-cursor.is-pos-3{left:48%;top:34%;opacity:0}

/* B. Realistic Slender iPhone Pro Frame + Bright Daylight App Screen + Store Badges */
.pw-sim-iphone-col{display:flex;flex-direction:column;align-items:center;gap:12px}
.pw-sim-phone{position:relative;width:248px;border-radius:40px;padding:9px;background:linear-gradient(155deg,#4b525c 0%,#1f242b 48%,#3c434d 100%);box-shadow:0 32px 60px -24px rgba(20,24,27,.38),0 0 0 1px rgba(255,255,255,.28),inset 0 0 0 2px #0b0e12}
.pw-sim-hw-action,.pw-sim-hw-vol-1,.pw-sim-hw-vol-2,.pw-sim-hw-pwr{position:absolute;width:3px;border-radius:3px;background:#444e5c}
.pw-sim-hw-action{left:-3px;top:76px;height:18px}
.pw-sim-hw-vol-1{left:-3px;top:106px;height:30px}
.pw-sim-hw-vol-2{left:-3px;top:144px;height:30px}
.pw-sim-hw-pwr{right:-3px;top:124px;height:46px}

.pw-sim-phone-inner{position:relative;border-radius:31px;background:#f8f6f2;border:1px solid #d8d0c4;color:#14181b;padding:8px 10px 7px;display:flex;flex-direction:column;gap:7px;overflow:hidden}
.pw-sim-status-bar{display:flex;align-items:center;justify-content:space-between;font-size:.63rem;font-weight:900;color:#14181b;padding:0 3px}
.pw-sim-island{width:68px;height:17px;border-radius:999px;background:#0c1016;display:flex;align-items:center;justify-content:flex-end;padding-inline-end:6px}
.pw-sim-island-cam{width:6px;height:6px;border-radius:50%;background:radial-gradient(circle,#264b7a 0%,#09121e 65%);box-shadow:0 0 0 1px rgba(255,255,255,.14)}
.pw-sim-signal{display:flex;align-items:center;gap:4px;font-size:.6rem;font-weight:800;color:#14181b}
.pw-sim-battery{width:17px;height:9px;border-radius:2.5px;border:1px solid #47525c;padding:1.5px;display:inline-flex}
.pw-sim-battery span{width:84%;height:100%;border-radius:1px;background:#10b981}

.pw-sim-app-top{display:flex;align-items:center;justify-content:space-between;gap:6px;padding-bottom:6px;border-bottom:1px solid #e7e1d7}
.pw-sim-iphone-col .pw-sim-app-brand{font-size:.76rem}

.pw-sim-ui{position:relative;min-height:278px;height:auto;display:flex;flex-direction:column;justify-content:center;overflow:hidden}
.pw-sim-screen{display:flex;flex-direction:column;gap:9px;animation:pwSimSlideIn .34s cubic-bezier(.2,.8,.2,1)}
@keyframes pwSimSlideIn{from{opacity:.2;transform:translateX(-12px)}to{opacity:1;transform:none}}
.pw-sim-search-fake{display:flex;align-items:center;gap:7px;padding:8px 11px;border-radius:11px;background:#ffffff;border:1px solid #dfd7cc;font-size:.77rem;color:#14181b;font-weight:700;min-height:36px}
.pw-sim-search-fake.is-compact{padding:6px 9px;font-size:.71rem;min-height:31px}
.pw-sim-typed{display:inline-flex;align-items:center;gap:2px;white-space:nowrap;overflow:hidden}
.pw-sim-caret{display:inline-block;width:2px;height:13px;background:#c75517;animation:pwCaretBlink .8s step-end infinite}
@keyframes pwCaretBlink{0%,100%{opacity:1}50%{opacity:0}}

.pw-sim-phone-card{border-radius:14px;overflow:hidden;background:#ffffff;border:1px solid #e7e1d7;box-shadow:0 6px 16px -10px rgba(20,24,27,.14)}
.pw-sim-phone-card-media{position:relative;height:112px;background:#10161e}
.pw-sim-phone-card-media img{width:100%;height:100%;object-fit:cover;display:block}
.pw-sim-tag{display:inline-block;padding:2px 7px;border-radius:999px;background:#fff3ea;color:#a64310;border:1px solid #fed7aa;font-size:.66rem;font-weight:800}
.pw-sim-tag.is-dim{background:#f4efe6;color:#525e6a;border-color:#e7e1d7}
.pw-sim-tag.is-overlay{position:absolute;top:7px;inset-inline-start:7px;background:rgba(20,24,27,.84);color:#fff;border-color:rgba(255,255,255,.2)}
.pw-sim-phone-card-body{padding:9px 10px;display:flex;flex-direction:column;gap:5px}
.pw-sim-phone-card-body strong{font-size:.74rem;font-weight:800;color:#14181b;line-height:1.35}
.pw-sim-phone-card-foot{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-top:2px}
.pw-sim-mini-badge{font-size:.64rem;font-weight:800;color:#059669}
.pw-sim-mini-btn{padding:5px 9px;border-radius:8px;background:var(--o);color:#fff;font-size:.68rem;font-weight:800;white-space:nowrap;transition:transform .16s ease,box-shadow .16s ease}
.pw-sim-mini-btn.is-dim{background:#f4efe6;color:#525e6a}
.pw-sim-mini-btn.is-pressed,.pw-sim-action-btn.is-pressed{transform:scale(.95);box-shadow:0 0 0 4px rgba(199,85,23,.25)}

.pw-sim-detail-box{background:#ffffff;border:1px solid #e7e1d7;border-radius:14px;padding:8px;display:flex;flex-direction:column;gap:7px}
.pw-sim-detail-img{width:100%;height:96px;border-radius:10px;object-fit:cover;background:#10161e}
.pw-sim-detail-meta{display:flex;flex-direction:column;gap:6px}
.pw-sim-detail-meta strong{font-size:.74rem;font-weight:800;color:#14181b;line-height:1.35}
.pw-sim-spec-check{display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border-radius:8px;font-size:.68rem;font-weight:700;transition:all .24s ease}
.pw-sim-spec-check.is-pending{background:#f4efe6;border:1px solid #dfd7cc;color:#525e6a}
.pw-sim-spec-check.is-checked{background:#dcfce7;border:1px solid #86efac;color:#15803d}
.pw-sim-check-on{font-weight:900}
.pw-sim-qty-pill{display:inline-flex;align-items:center;gap:10px;padding:4px 9px;border-radius:9px;background:#f4efe6;border:1px solid #dfd7cc;color:#14181b;font-size:.76rem;font-weight:800}

.pw-sim-action-btn{padding:8px 12px;border-radius:10px;background:var(--o);color:#fff;font-size:.74rem;font-weight:800;text-align:center;transition:transform .16s ease,box-shadow .16s ease}
.pw-sim-action-btn.is-confirm{background:#059669}

.pw-sim-checkout-card{background:#ffffff;border:1px solid #e7e1d7;border-radius:14px;padding:9px;display:flex;flex-direction:column;gap:8px}
.pw-sim-checkout-head{display:flex;align-items:center;justify-content:space-between;gap:6px}
.pw-sim-checkout-head strong{font-size:.82rem;color:#14181b}
.pw-sim-checkout-row{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:10px;background:#f8f6f2;border:1px solid #ede7dd}
.pw-sim-checkout-row img{width:46px;height:36px;border-radius:7px;object-fit:cover;flex-shrink:0}
.pw-sim-checkout-row strong{display:block;font-size:.71rem;color:#14181b;line-height:1.3}
.pw-sim-checkout-row small{display:block;font-size:.64rem;color:#525e6a}
.pw-sim-qty{font-size:.76rem;font-weight:800;color:#c75517}
.pw-sim-customer-box{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:7px 8px;border-radius:10px;background:#f8f6f2;border:1px dashed #d6cec2}
.pw-sim-customer-box strong{display:block;font-size:.69rem;color:#14181b}
.pw-sim-customer-box small{display:block;font-size:.63rem;color:#525e6a}
.pw-sim-verified-pill{padding:2px 7px;border-radius:999px;background:#dcfce7;color:#15803d;font-size:.64rem;font-weight:800;white-space:nowrap}

.pw-sim-success-card{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:16px 12px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:7px}
.pw-sim-success-card.is-desktop{padding:22px 18px}
.pw-sim-success-card.is-compact{padding:18px 10px}
.pw-sim-success-icon{width:40px;height:40px;border-radius:50%;background:#059669;color:#fff;display:grid;place-items:center;font-size:1.2rem;font-weight:900;box-shadow:0 8px 18px -6px rgba(16,185,129,.45)}
.pw-sim-success-card strong{font-size:.86rem;color:#14532d}
.pw-sim-order-code{padding:3px 10px;border-radius:999px;background:#ffffff;border:1px solid #86efac;font-family:ui-monospace,Consolas,monospace;font-size:.72rem;font-weight:800;color:#15803d}
.pw-sim-success-card p{font-size:.76rem;line-height:1.5;color:#166534;margin:0}
.pw-sim-tracker{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-top:3px}
.pw-sim-tracker span{padding:2px 8px;border-radius:999px;font-size:.65rem;font-weight:800}
.pw-sim-tracker span.is-done{background:#dcfce7;color:#15803d}
.pw-sim-tracker span.is-now{background:#fff3ea;color:#a64310}

/* Touch Tap Indicator on iPhone Screen */
.pw-sim-touch{position:absolute;width:24px;height:24px;border-radius:50%;border:2px solid #c75517;background:rgba(199,85,23,.18);pointer-events:none;z-index:5;transition:left .42s cubic-bezier(.2,.8,.2,1),top .42s cubic-bezier(.2,.8,.2,1),opacity .25s ease;opacity:.85}
.pw-sim-touch.is-tapping{animation:pwTapBurst .65s ease-out}
@keyframes pwTapBurst{0%{transform:scale(1);box-shadow:0 0 0 0 rgba(199,85,23,.5)}70%{transform:scale(.82);box-shadow:0 0 0 12px rgba(199,85,23,0)}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(199,85,23,0)}}
.pw-sim-touch.is-pos-0{left:14%;top:81%}
.pw-sim-touch.is-pos-1{left:44%;top:85%}
.pw-sim-touch.is-pos-2{left:44%;top:85%}
.pw-sim-touch.is-pos-3{left:44%;top:34%;opacity:0}

.pw-sim-bottom-nav{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding-top:6px;border-top:1px solid #e7e1d7;text-align:center}
.pw-sim-tab-item{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px 2px;border-radius:8px;color:#64748b;transition:color .2s,background .2s}
.pw-sim-tab-item span{font-size:.58rem;font-weight:700;line-height:1.1}
.pw-sim-tab-item.is-on{color:#c75517;background:#fff3ea}
.pw-sim-phone-homebar{width:76px;height:3.5px;border-radius:999px;background:rgba(20,24,27,.24);margin:2px auto 1px}

/* iOS & Android Store Badges Next to / Below iPhone */
.pw-sim-store-badges{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;max-width:256px}
.pw-sim-store-badge{display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:8px 12px;border-radius:var(--r-btn);background:linear-gradient(180deg,#1c2228 0%,#111519 100%);border:1px solid rgba(255,255,255,.12);color:#fff;box-shadow:0 10px 20px -12px rgba(20,24,27,.4)}
.pw-sim-store-badge div{display:flex;flex-direction:column;line-height:1.15;text-align:left}
.pw-sim-store-badge small{font-size:.58rem;font-weight:700;color:rgba(255,255,255,.72)}
.pw-sim-store-badge strong{font-size:.73rem;font-weight:900;color:#fff}

.pw-sim-foot-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:32px}

/* ===== المرحلة 4: المنتجات الأكثر مبيعاً (صالة عرض مضيئة ومريحة للعين - 8pt Grid) ===== */
.pw-bestsellers-band{position:relative;z-index:4;padding:var(--ui-section-py) 0;color:#14181b;background:#fbfaf7}
.pw-bestsellers-band > .pw-wrap{max-width:none;width:100%;padding-inline:clamp(16px,2.4vw,40px)}
.pw-bs-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:32px}
.pw-bs-head .pw-eyebrow{color:#c75517;font-weight:800;margin-bottom:4px}
.pw-bs-head h2{font-size:clamp(1.42rem,2.45vw,2.05rem);font-weight:800;line-height:1.4;color:#14181b;text-shadow:0 1px 12px rgba(251,250,247,.95);margin:0 0 8px}
.pw-bs-sub{font-size:.96rem;font-weight:500;line-height:1.75;color:#525e6a;text-shadow:0 1px 12px rgba(251,250,247,.95);max-width:42rem;margin:0}
.pw-bs-filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:32px}
.pw-bs-filter-btn{display:inline-flex;align-items:center;gap:8px;min-height:36px;padding:8px 16px;border-radius:var(--r-pill);background:rgba(255,255,255,.82);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid #e2dbd0;color:#47525c;font-size:.875rem;font-weight:600;cursor:pointer;transition:all .16s}
.pw-bs-filter-btn:hover{border-color:#c75517;color:#14181b}
.pw-bs-filter-btn.is-on{background:#14181b;border-color:#14181b;color:#fff;font-weight:700;box-shadow:0 8px 18px -10px rgba(20,24,27,.35)}

.pw-bs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,var(--ui-prod-min,260px)),1fr));gap:var(--ui-gap)}
.pw-bs-card{background:rgba(255,255,255,.86);backdrop-filter:blur(12px) saturate(125%);-webkit-backdrop-filter:blur(12px) saturate(125%);border:1px solid #e7e1d7;border-radius:var(--ui-card-r);overflow:hidden;display:flex;flex-direction:column;box-shadow:0 14px 34px -24px rgba(20,24,27,.16);transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;content-visibility:auto;contain-intrinsic-size:auto 420px}
.pw-bs-card:hover{transform:translateY(-3px);border-color:rgba(199,85,23,.45);box-shadow:0 22px 44px -24px rgba(20,24,27,.22)}
.pw-bs-media{position:relative;aspect-ratio:4/3;background:#ffffff;border-bottom:1px solid #f0ebe2;overflow:hidden}
.pw-bs-media img{width:100%;height:100%;object-fit:contain;padding:8px;display:block;transition:transform .35s ease}
.pw-bs-card:hover .pw-bs-media img{transform:scale(1.03)}
.pw-bs-badge{position:absolute;top:12px;inset-inline-start:12px;padding:4px 12px;border-radius:var(--r-pill);background:rgba(255,255,255,.94);border:1px solid #e7e1d7;color:#14181b;font-size:.75rem;font-weight:700;box-shadow:0 4px 12px rgba(20,24,27,.14)}
.pw-bs-body{padding:var(--ui-card-pad);display:flex;flex-direction:column;gap:12px;flex:1}
.pw-bs-cat{font-size:.78rem;font-weight:700;color:#c75517}
.pw-bs-body h3{font-size:1.02rem;font-weight:800;line-height:1.5;color:#14181b;margin:0}
.pw-bs-spec-one{font-size:.86rem;font-weight:500;line-height:1.65;color:#525e6a;margin:0}
.pw-bs-install{display:flex;align-items:center;gap:8px;font-size:.84rem;font-weight:600;color:#14181b;margin-top:auto;padding-top:8px;cursor:pointer}
.pw-bs-price{font-size:.86rem;font-weight:600;color:#47525c}
.pw-bs-price strong{font-size:1.05rem;font-weight:800;color:#14181b}
.pw-bs-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding-top:8px}
.pw-bs-add-btn{flex:1;min-height:var(--ui-btn-h)!important;padding:var(--ui-btn-py) var(--ui-btn-px)!important;font-size:var(--ui-btn-fs)!important;border-radius:var(--ui-btn-r)!important}
.pw-bs-add-btn.is-added{background:#059669!important}
.pw-bs-wa-btn{min-height:var(--ui-btn-h);padding:var(--ui-btn-py) max(10px,calc(var(--ui-btn-px) * .65));border-radius:var(--ui-btn-r);border:1px solid #dfd7cc;background:rgba(255,255,255,.92);color:#14181b;font-size:var(--ui-btn-fs);font-weight:600;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;cursor:pointer;transition:background .16s}
.pw-bs-wa-btn:hover{background:#f4efe6}
.pw-bs-footer{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:32px}
.pw-bs-more-btn{min-width:210px}

/* صورة مصغرة للمنتجات داخل صفحة تفاصيل القسم */
.pw-prod-thumb{aspect-ratio:4/3;border-radius:var(--r-card-sm);overflow:hidden;margin-bottom:12px;background:#ffffff;border:1px solid var(--line)}
.pw-prod-thumb img{width:100%;height:100%;object-fit:contain;padding:8px;display:block}

@media(max-width:1023px){
  .pw-bs-grid{gap:20px}
  .pw-sim-dual-stage{grid-template-columns:1fr;gap:24px}
  .pw-sim-sync-bridge{flex-direction:row;padding:4px 0}
  .pw-sim-sync-line{display:none}
}
@media(max-width:900px){
  .pw-sim-web-grid,.pw-sim-web-detail,.pw-sim-web-checkout-cols{grid-template-columns:1fr}
  .pw-sim-web-card.is-secondary{display:none}
}
@media(max-width:639px){
  .pw-welcome-band{padding:80px 0 48px}
  .pw-welcome-shell{padding:0;gap:16px}
  .pw-sim-section{padding:48px 0 64px}
  .pw-sim-narrator-bar{padding:16px}
  .pw-sim-stepper{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .pw-bestsellers-band{padding:56px 0 64px}
  .pw-omni-box{flex-wrap:wrap;padding:8px}
  .pw-omni-store-btn{width:100%;min-height:48px;justify-content:center}
  .pw-omni-row{flex-wrap:wrap}
  .pw-bs-grid{gap:16px}
  .pw-bs-body{padding:16px}
  .pw-bs-filter-btn{min-height:44px;padding:10px 16px}
  .pw-bs-actions .pw-bs-add-btn,.pw-bs-actions .pw-bs-wa-btn{min-height:44px!important}
  .pw-bs-footer .pw-btn,.pw-sim-foot-actions .pw-btn{width:100%;min-height:48px}
  .pw-sim-web-links{gap:8px;font-size:.7rem}
}
@media(prefers-reduced-motion:reduce){
  .pw-sim-touch,.pw-sim-cursor,.pw-sim-screen,.pw-sim-seg-fill,.pw-sim-caret,.pw-sim-live-pill i,.pw-sim-cart-pill,.pw-sim-sync-node,.pw-sim-sync-node svg,.pw-bs-card,.pw-bs-media img{animation:none!important;transition:none!important}
}
html.low-graphics-mode .pw *{
  scroll-behavior:auto!important;
}
html.low-graphics-mode .pw .pw-header,
html.low-graphics-mode .pw .pw-header.is-scrolled,
html.low-graphics-mode .pw .pw-header.pw-header-glass,
html.low-graphics-mode .pw .pw-header.pw-header-glass.is-scrolled,
html.low-graphics-mode .pw:has(.pw-split-stage) .pw-header.pw-header-glass,
html.low-graphics-mode .pw .pw-header.pw-header-glass .pw-burger,
html.low-graphics-mode .pw .pw-header.pw-header-glass .phi-cart-btn,
html.low-graphics-mode .pw .pw-scale-switch,
html.low-graphics-mode .pw .pw-nav,
html.low-graphics-mode .pw .pw-mobile-dock,
html.low-graphics-mode .pw .pw-user-menu,
html.low-graphics-mode .pw .pw-omni-box,
html.low-graphics-mode .pw .pw-omni-dropdown,
html.low-graphics-mode .pw .pw-bs-card,
html.low-graphics-mode .pw .pw-bs-filter-btn,
html.low-graphics-mode .pw .pw-card,
html.low-graphics-mode .pw .pw-footer,
html.low-graphics-mode .pw.pw-home-light .pw-footer,
html.low-graphics-mode .pw:has(>.pw-construction) .pw-footer,
html.low-graphics-mode .pw .pw-sim-live-pill,
html.low-graphics-mode .pw .pw-sim-narrator-bar,
html.low-graphics-mode .pw .pw-stats,
html.low-graphics-mode .pw .pw-hero.pw-hero-pearl,
html.low-graphics-mode .pw .pw-hero.pw-hero-pearl .pw-contact-card,
html.low-graphics-mode .pw .pw-mobile-scroll-cue,
html.low-graphics-mode .pw .pw-sec-hero-badge,
html.low-graphics-mode .pw .pw-construction-status{
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
}
html.low-graphics-mode .pw .pw-header.pw-header-glass.is-scrolled,
html.low-graphics-mode .pw:has(.pw-split-stage) .pw-header.pw-header-glass,
html.low-graphics-mode .pw .pw-nav,
html.low-graphics-mode .pw .pw-mobile-dock,
html.low-graphics-mode .pw.pw-home-light .pw-footer,
html.low-graphics-mode .pw:has(>.pw-construction) .pw-footer{
  background:#fbfaf7!important;
}
html.low-graphics-mode .pw .pw-omni-box,
html.low-graphics-mode .pw .pw-omni-dropdown,
html.low-graphics-mode .pw .pw-bs-card,
html.low-graphics-mode .pw .pw-bs-filter-btn,
html.low-graphics-mode .pw .pw-card,
html.low-graphics-mode .pw .pw-sim-narrator-bar,
html.low-graphics-mode .pw .pw-hero.pw-hero-pearl .pw-contact-card{
  background:#ffffff!important;
  box-shadow:0 2px 8px rgba(20,24,27,.06)!important;
}
html.low-graphics-mode .pw .pw-bs-card:hover,
html.low-graphics-mode .pw .pw-card:hover,
html.low-graphics-mode .pw .pw-bs-card:hover .pw-bs-media img,
html.low-graphics-mode .pw .pw-dual-card:hover,
html.low-graphics-mode .pw .pw-dual-card:hover .pw-dual-media img{
  transform:none!important;
}
html.low-graphics-mode .pw .pw-dual-card,
html.low-graphics-mode .pw .pw-dual-media img,
html.low-graphics-mode .pw .pw-dual-shortcut,
html.low-graphics-mode .pw .pw-utility-link,
html.low-graphics-mode .pw .pw-sim-touch,
html.low-graphics-mode .pw .pw-sim-cursor,
html.low-graphics-mode .pw .pw-sim-screen,
html.low-graphics-mode .pw .pw-sim-caret,
html.low-graphics-mode .pw .pw-sim-live-pill i,
html.low-graphics-mode .pw .pw-sim-cart-pill{
  animation:none!important;
  transition:none!important;
}
`;
