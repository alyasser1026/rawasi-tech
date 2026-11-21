export const CSS = `
.pw{--o:#c75517;--o-hi:#e57024;--o-dark:#a64310;--o-soft:#fff3ea;--ink:#14181b;--ink-2:#47525c;--line:#e7e1d7;--bg:#fbfaf7;--tint:#f4efe6;--g1:#161b1f;--g2:#0e1215;
  position:relative;min-height:100vh;background:var(--bg);color:var(--ink);font-family:'Cairo',-apple-system,'Segoe UI',sans-serif;line-height:1.75;letter-spacing:0;-webkit-font-smoothing:antialiased;overflow-x:clip}
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
.pw-wrap{width:100%;max-width:1200px;margin:0 auto;padding:0 24px}
.pw-muted{color:var(--ink-2)}

/* header */
.pw-header{position:sticky;top:0;z-index:60;margin-bottom:-72px;background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none;border-bottom:1px solid transparent;transition:background .25s ease,border-color .25s ease,box-shadow .25s ease,backdrop-filter .25s ease}
.pw-header.is-scrolled{background:rgba(10,14,20,.92);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom-color:rgba(255,255,255,.12);box-shadow:0 8px 30px rgba(0,0,0,.45)}
.pw-header.pw-header-solid{margin-bottom:0!important;background:rgba(12,16,22,.68)!important;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid rgba(255,255,255,.12)}
.pw-header.pw-header-glass{margin-bottom:-72px!important;background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;border-bottom:1px solid transparent!important;box-shadow:none!important}
.pw-header.pw-header-glass.is-scrolled{background:rgba(12,16,22,.28)!important;backdrop-filter:blur(16px)!important;-webkit-backdrop-filter:blur(16px)!important;box-shadow:none!important;border-bottom-color:rgba(255,255,255,.08)!important}
.pw-header.pw-header-glass .pw-brand-text strong{color:#14181b!important;text-shadow:0 1px 8px rgba(255,255,255,.8)!important}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass{background:transparent!important;backdrop-filter:blur(8px)!important;-webkit-backdrop-filter:blur(8px)!important;border-bottom:1px solid rgba(255,255,255,.08)!important}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass.is-scrolled{background:rgba(255,255,255,.04)!important;backdrop-filter:blur(14px)!important;-webkit-backdrop-filter:blur(14px)!important;border-bottom-color:rgba(255,255,255,.10)!important}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass .pw-brand-text strong,.pw-header.pw-header-glass.is-scrolled .pw-brand-text strong{color:#ffffff!important;text-shadow:0 2px 14px rgba(0,0,0,.85)!important}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass .pw-nav a:not(.pw-btn),.pw-header.pw-header-glass.is-scrolled .pw-nav a:not(.pw-btn){color:#ffffff!important;text-shadow:0 2px 12px rgba(0,0,0,.85)!important}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass .pw-nav a:not(.pw-btn):hover,.pw:has(.pw-split-stage) .pw-header.pw-header-glass .pw-nav a.is-nav-active:not(.pw-btn){color:#ffb074!important}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass .phi-cart-btn{color:#f8fafc!important;background:rgba(255,255,255,.06)!important;border-color:rgba(255,255,255,.16)!important}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass .pw-nav-portal.is-guest{background:rgba(255,255,255,.06)!important;color:#f8fafc!important;border-color:rgba(255,255,255,.16)!important}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass .pw-burger{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18)}
.pw:has(.pw-split-stage) .pw-header.pw-header-glass .pw-burger span{background:#ffffff}
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
@media (max-width:960px){.pw-header.pw-header-glass .pw-nav.is-open a:not(.pw-btn){color:#f8fafc!important}.pw-header.pw-header-glass .pw-nav.is-open a.is-nav-active:not(.pw-btn){color:#fb923c!important}}
.pw-header-row{display:flex;align-items:center;justify-content:space-between;height:72px;gap:16px}
.pw-brand{display:flex;align-items:center;gap:12px;flex-shrink:0}
.pw-brand-mark{height:44px;width:auto;filter:drop-shadow(0 0 1px rgba(255,255,255,.45)) drop-shadow(0 2px 8px rgba(0,0,0,.5))}
.pw-brand-text{display:flex;flex-direction:column;gap:5px;line-height:1.35}
.pw-brand-text strong{font-size:1.24rem;font-weight:900;line-height:1.3;letter-spacing:0;display:block;color:#fefcf9;text-shadow:0 2px 10px rgba(0,0,0,.6)}
.pw-brand-text small{font-size:.72rem;font-weight:800;letter-spacing:.16em;line-height:1.15;color:#f97316;direction:ltr;unicode-bidi:isolate;text-align:right;display:block}
.pw-nav{display:flex;align-items:center;gap:18px;font-weight:600;font-size:.88rem;color:#ebe6de;white-space:nowrap}
.pw-nav a.pw-nav-verify{color:#fb923c!important;font-weight:800;text-shadow:0 0 14px rgba(249,115,22,.4)}
.pw-nav a.pw-nav-verify:hover{color:#fdba74!important;text-shadow:0 0 18px rgba(249,115,22,.65)}
.pw-nav a:not(.pw-btn){position:relative;padding:6px 0;color:#ede5da;transition:color .2s ease,text-shadow .2s ease}
.pw-nav a:not(.pw-btn)::after{content:'';position:absolute;inset-inline:0;bottom:0;height:2px;background:#f97316;transform:scaleX(0);transition:transform .2s;transform-origin:center}
.pw-nav a:not(.pw-btn):hover{color:#ffffff;text-shadow:0 0 12px rgba(255,255,255,.5)}
.pw-nav a:not(.pw-btn):hover::after{transform:scaleX(1)}
.pw-nav-head{display:none}
.pw-nav-arrow{display:none}
.pw-burger{display:none;width:44px;height:44px;border:1px solid rgba(255,255,255,.2);background:rgba(15,20,28,.65);backdrop-filter:blur(10px);border-radius:10px;cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:5px}
.pw-burger span{display:block;width:20px;height:2px;background:#ede5da;border-radius:2px}

/* buttons */
.pw-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 26px;border-radius:12px;font-weight:700;font-size:.97rem;cursor:pointer;border:1.5px solid transparent;transition:background .18s,border-color .18s,color .18s,box-shadow .18s}
.pw-btn-primary{background:var(--o);color:#fff;box-shadow:0 10px 24px -12px rgba(199,85,23,.8)}
.pw-btn-primary:hover{background:var(--o-dark)}
.pw-btn-ghost{background:#fff;color:var(--ink);border-color:var(--line)}
.pw-btn-ghost:hover{border-color:var(--o);color:var(--o)}
.pw-btn-light{background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.28)}
.pw-btn-light:hover{background:rgba(255,255,255,.16);border-color:#fff}
.pw-nav-cta{min-height:40px;padding:0 16px;font-size:.86rem}
.pw-nav-portal{min-height:40px;padding:0 14px;border-radius:11px;font-size:.82rem;font-weight:800;background:#14181b;color:#fff!important;border:1px solid rgba(20,24,27,.18);box-shadow:0 8px 18px -10px rgba(20,24,27,.4)}
.pw-nav-portal.is-guest{background:rgba(20,24,27,.07);color:#14181b!important;border-color:rgba(20,24,27,.18);box-shadow:none}
.pw-nav-portal:hover{background:#0f172a;color:#fff!important;border-color:#0f172a}
.pw-nav-portal.is-ready{background:linear-gradient(135deg,#0f172a,#1e293b);border-color:rgba(249,115,22,.45)}
.pw-nav-portal.is-ready:hover{background:var(--o);border-color:var(--o)}
.pw-user-wrap{position:relative}
.pw-user-menu{position:absolute;top:calc(100% + 10px);inset-inline-end:0;width:258px;background:#ffffff;color:var(--ink);border:1.5px solid var(--line);border-radius:16px;padding:8px;box-shadow:0 24px 48px -16px rgba(15,20,25,.28);display:flex;flex-direction:column;gap:4px;z-index:120;white-space:normal}
.pw-user-menu-head{padding:8px 10px 10px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:2px;margin-bottom:2px}
.pw-user-menu-head strong{font-size:.9rem;font-weight:900;color:var(--ink)}
.pw-user-menu-head small{font-size:.73rem;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis}
.pw-user-role-tag{align-self:flex-start;margin-top:4px;padding:2px 8px;border-radius:999px;font-size:.69rem;font-weight:800;background:var(--tint);color:var(--ink-2);border:1px solid var(--line)}
.pw-user-role-tag.is-staff{background:#fff3ea;color:#c75517;border-color:#fed7aa}
.pw-header.pw-header-glass .pw-nav .pw-user-menu a,.pw-user-menu-item{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 11px;border-radius:10px;border:0;background:transparent;color:var(--ink)!important;text-shadow:none!important;font-size:.83rem;font-weight:800;cursor:pointer;text-align:right;transition:background .15s ease,color .15s ease}
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
.pw:has(>.pw-construction) .pw-footer{background:rgba(255,255,255,.03)!important;backdrop-filter:blur(16px) saturate(125%)!important;-webkit-backdrop-filter:blur(16px) saturate(125%)!important;border-top:1px solid rgba(255,255,255,.10)!important;box-shadow:none!important}
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
.pw-section{padding:96px 0;scroll-margin-top:72px}
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
.pw-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.pw-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:32px 28px;display:flex;flex-direction:column;gap:14px;transition:border-color .2s,box-shadow .2s,transform .2s}
.pw-card:hover{border-color:rgba(199,85,23,.5);box-shadow:0 22px 44px -26px rgba(199,85,23,.45);transform:translateY(-3px)}
.pw-icon{width:54px;height:54px;border-radius:14px;background:var(--o-soft);color:var(--o);display:flex;align-items:center;justify-content:center}
.pw-card h3{font-size:1.25rem;font-weight:800}
.pw-card>p{color:var(--ink-2);font-size:.96rem}
.pw-card ul{display:flex;flex-direction:column;gap:10px;margin-top:6px;padding-top:18px;border-top:1px solid var(--line)}
.pw-card li{display:flex;gap:10px;align-items:flex-start;font-size:.93rem}
.pw-card li svg{flex:none;margin-top:5px;color:var(--o)}

/* BIM */
.pw-bim{display:grid;grid-template-columns:1.6fr .7fr;gap:24px;align-items:stretch}
.pw-bim-stage{position:relative;min-height:440px;border:1px solid var(--line);border-radius:22px;overflow:hidden;background:radial-gradient(600px 360px at 50% 30%,#fff 0%,#f1f2f3 100%)}
.pw-bim-canvas{position:absolute;inset:0}
.pw-bim-note{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--ink-2);font-weight:600}
.pw-bim-hint{position:absolute;inset-inline:0;bottom:12px;text-align:center;font-size:.8rem;color:var(--ink-2);pointer-events:none}
.pw-bim-reset{position:absolute;top:14px;inset-inline-start:14px;font-size:.8rem;font-weight:700;background:#fff;border:1px solid var(--line);border-radius:10px;padding:6px 12px;cursor:pointer}
.pw-bim-reset:hover{border-color:var(--o);color:var(--o)}
.pw-bim-panel{background:#fff;border:1px solid var(--line);border-radius:22px;padding:24px;display:flex;flex-direction:column;gap:18px}
.pw-bim-panel h3{font-size:1.05rem;font-weight:800}
.pw-bim-layers{display:flex;flex-wrap:wrap;gap:8px}
.pw-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 14px;font-size:.85rem;font-weight:700;cursor:pointer;color:var(--ink-2);transition:all .15s}
.pw-chip i{width:10px;height:10px;border-radius:50%;opacity:.35}
.pw-chip.is-on{color:var(--ink);border-color:var(--ink);background:#fafafa}
.pw-chip.is-on i{opacity:1}
.pw-range{display:flex;flex-direction:column;gap:6px;font-size:.88rem;font-weight:700}
.pw-range input{width:100%;accent-color:var(--o)}
.pw-bim-info{min-height:130px;background:var(--tint);border-radius:14px;padding:16px}
.pw-ifc{display:inline-block;font-family:ui-monospace,Consolas,monospace;font-size:.72rem;font-weight:700;color:var(--o-dark);background:var(--o-soft);border-radius:6px;padding:2px 8px;margin-bottom:6px}
.pw-bim-info h4{font-size:1.02rem;font-weight:800;margin-bottom:4px}
.pw-bim-info p{font-size:.9rem;color:var(--ink-2)}
.pw-bim-disclaimer{font-size:.78rem;color:var(--ink-2)}

/* tools */
.pw-tools{background:#fff;border:1px solid var(--line);border-radius:22px;overflow:hidden}
.pw-tools-tabs{display:flex;gap:4px;padding:8px;background:var(--tint);border-bottom:1px solid var(--line);overflow-x:auto}
.pw-tools-tabs button{flex:1 0 auto;border:0;background:transparent;padding:12px 20px;border-radius:12px;font-weight:700;font-size:.95rem;cursor:pointer;color:var(--ink-2);white-space:nowrap}
.pw-tools-tabs button.is-on{background:#fff;color:var(--ink);box-shadow:0 2px 10px rgba(20,28,34,.08)}
.pw-tools-body{padding:28px}
.pw-tool{display:flex;flex-direction:column;gap:22px}
.pw-seg{display:flex;flex-wrap:wrap;gap:8px}
.pw-seg button{border:1px solid var(--line);background:#fff;padding:7px 16px;border-radius:999px;font-weight:700;font-size:.88rem;cursor:pointer;color:var(--ink-2)}
.pw-seg button.is-on{background:var(--ink);border-color:var(--ink);color:#fff}
.pw-field{display:flex;flex-direction:column;gap:6px;font-size:.86rem;font-weight:700;color:var(--ink-2)}
.pw-input{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:12px;background:#fff;overflow:hidden;transition:border-color .15s}
.pw-input:focus-within{border-color:var(--o)}
.pw-input input{flex:1;min-width:0;border:0;outline:0;padding:11px 14px;background:transparent;color:var(--ink);font-weight:700;text-align:left}
.pw-input em{font-style:normal;font-size:.8rem;font-weight:700;color:var(--ink-2);padding:0 12px;background:var(--tint);align-self:stretch;display:flex;align-items:center;border-inline-start:1px solid var(--line)}
.pw-field select,.pw-field textarea,.pw-field>input{border:1.5px solid var(--line);border-radius:12px;padding:11px 14px;background:#fff;color:var(--ink);font-weight:600;width:100%}
.pw-field select:focus,.pw-field textarea:focus,.pw-field>input:focus{border-color:var(--o);outline:0}
.pw-conv{display:grid;grid-template-columns:1fr 1.3fr auto 1.3fr;gap:12px;align-items:end}
.pw-swap{height:46px;width:46px;border-radius:12px;border:1.5px solid var(--line);background:#fff;cursor:pointer;font-size:1.1rem;font-weight:800}
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
.pw-steps li{background:#fff;border:1px solid var(--line);border-radius:18px;padding:26px 22px;position:relative}
.pw-step-n{display:block;font-weight:800;font-size:2rem;line-height:1;color:var(--o);margin-bottom:14px}
.pw-steps h3{font-size:1.08rem;font-weight:800;margin-bottom:6px}
.pw-steps p{font-size:.92rem;color:var(--ink-2)}

/* projects */
.pw-projects{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:24px}
.pw-project{background:#fff;border:1px solid var(--line);border-radius:20px;padding:28px 26px;display:flex;flex-direction:column;gap:6px;border-top:4px solid var(--o)}
.pw-badge{align-self:flex-start;font-size:.78rem;font-weight:700;color:var(--o-dark);background:var(--o-soft);border-radius:999px;padding:3px 12px;margin-bottom:8px}
.pw-project h3{font-size:1.3rem;font-weight:800}
.pw-project>p{color:var(--ink-2)}
.pw-project dl{display:flex;gap:28px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
.pw-project dt{font-size:.78rem;color:var(--ink-2)}
.pw-project dd{font-weight:700}

/* faq */
.pw-faq{max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.pw-faq details{background:#fff;border:1px solid var(--line);border-radius:16px;padding:0 22px}
.pw-faq summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px 0;font-weight:800}
.pw-faq summary::-webkit-details-marker{display:none}
.pw-faq summary::after{content:'+';font-size:1.4rem;color:var(--o);font-weight:600;line-height:1}
.pw-faq details[open] summary::after{content:'−'}
.pw-faq details p{padding:0 0 18px;color:var(--ink-2)}

/* contact */
.pw-contact{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
.pw-contact-solo{grid-template-columns:minmax(0,680px)}
.pw-contact-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:28px 26px}
.pw-contact-card li{display:flex;justify-content:space-between;gap:16px;align-items:baseline;padding:14px 0;border-bottom:1px solid var(--line)}
.pw-contact-card li:first-child{padding-top:0}
.pw-contact-card li span{color:var(--ink-2);font-size:.9rem;flex:none}
.pw-contact-card li a,.pw-contact-card li strong{font-weight:700;text-align:left}
.pw-contact-card li a:hover{color:var(--o)}
.pw-offices{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.pw-offices span{font-size:.85rem;font-weight:700;background:var(--tint);border:1px solid var(--line);border-radius:999px;padding:4px 14px}
.pw-form{display:flex;flex-direction:column;gap:14px;margin-top:6px}
.pw-form .pw-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.pw-form textarea{min-height:96px;resize:vertical}

/* footer */
.pw-footer{background:var(--g2);color:#e2e8f0;padding:12px 0 10px}
.pw-footer .pw-wrap{max-width:1380px}
.pw-footer-row{display:flex;align-items:center;justify-content:space-between;gap:8px 14px;flex-wrap:wrap}
.pw-footer-brand{display:flex;align-items:center;gap:8px}
.pw-footer-brand img{height:24px;width:auto}
.pw-footer-brand>div{display:flex;flex-direction:column;gap:1px;line-height:1.2}
.pw-footer-brand strong{display:block;color:#fff;font-size:.8rem;line-height:1.25}
.pw-footer-brand small{display:block;color:#cbd5e1;font-size:.68rem;line-height:1.2;opacity:.82}
.pw-footer-nav{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:.74rem;font-weight:700;color:rgba(255,255,255,.88)}
.pw-footer-nav a:hover{color:#ffb074}
.pw-footer-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pw-footer-link{font-weight:700;font-size:.72rem;color:#fff;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:3px 10px;transition:background .18s,border-color .18s,color .18s}
.pw-footer-link:hover{background:var(--o);border-color:var(--o);color:#fff}
.pw-footer-link.is-accent{color:#ffb074;border-color:rgba(255,176,116,.34);background:rgba(199,85,23,.14)}
.pw-footer-bottom{margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,.08);font-size:.68rem;color:rgba(226,232,240,.7);text-align:center}

@media (max-width:1180px){
  .pw-nav{gap:9px;font-size:.78rem}
  .pw-brand-text small{display:none}
  .pw-nav-cta,.pw-nav-portal{min-height:38px;padding:0 12px;font-size:.8rem}
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
  .pw-nav-head{display:flex;align-items:center;justify-content:space-between;padding:4px 6px 14px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,.12)}
  .pw-nav-head-title{display:flex;align-items:center;gap:8px;font-size:.92rem;font-weight:800;color:#f97316}
  .pw-nav-close{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:8px;color:#ede5da;padding:6px 12px;font-size:.8rem;font-weight:700;cursor:pointer;transition:background .15s,color .15s}
  .pw-nav-close:hover{background:rgba(249,115,22,.25);color:#fff;border-color:#f97316}
  .pw-nav{position:fixed;inset:0;top:0;bottom:calc(64px + env(safe-area-inset-bottom,0px));background:rgba(10,14,20,.95);backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%);border-bottom:1px solid rgba(255,255,255,.1);box-shadow:0 20px 40px rgba(0,0,0,.6);flex-direction:column;align-items:stretch;gap:2px;padding:16px 20px 24px;overflow-y:auto;z-index:84;display:none}
  .pw-nav.is-open{display:flex;animation:pwNavIn .2s ease-out}
  @keyframes pwNavIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
  .pw-nav a:not(.pw-btn){display:flex;align-items:center;justify-content:space-between;padding:13px 10px;border-bottom:1px solid rgba(255,255,255,.07);color:#ede5da;font-size:.92rem;font-weight:700;border-radius:8px;transition:background .15s,color .15s}
  .pw-nav a:not(.pw-btn):hover{background:rgba(255,255,255,.06);color:#fff}
  .pw-nav a:not(.pw-btn)::after{display:none}
  .pw-nav-arrow{display:inline-block;color:rgba(255,255,255,.35);font-size:.85rem;font-family:inherit;transition:transform .15s,color .15s}
  .pw-nav a:not(.pw-btn):hover .pw-nav-arrow{color:#f97316;transform:translateX(-3px)}
  .pw-nav-cta{margin-top:12px;min-height:44px;font-size:.94rem;width:100%}
  .pw-user-wrap{margin-top:8px;width:100%}
  .pw-user-wrap .pw-nav-cta{margin-top:4px;justify-content:space-between}
  .pw-user-menu{position:static;width:100%;margin-top:8px}
  .pw-nav-portal,.pw-nav-portal.is-guest,.pw-nav-portal.is-ready{margin-top:8px;min-height:44px;font-size:.92rem;background:rgba(255,255,255,.1)!important;color:#fff!important;border-color:rgba(255,255,255,.22);justify-content:space-between}
  .pw-dock-pad{display:block;height:calc(66px + env(safe-area-inset-bottom,0px))}
  .pw-mobile-dock{position:fixed;bottom:0;inset-inline:0;z-index:85;display:flex;align-items:center;justify-content:space-around;gap:3px;padding:6px 10px calc(6px + env(safe-area-inset-bottom,0px));background:rgba(12,16,22,.94);backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);border-top:1px solid rgba(255,255,255,.14);box-shadow:0 -8px 28px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.1)}
  .pw-dock-item{flex:1;max-width:76px;min-height:50px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:0;background:transparent;color:#cbd5e1;font-family:inherit;font-size:.72rem;font-weight:700;cursor:pointer;text-decoration:none;border-radius:10px;padding:4px 2px;transition:color .15s,transform .15s,background .15s;-webkit-tap-highlight-color:transparent}
  .pw-dock-item:active{transform:scale(.93)}
  .pw-dock-item:hover,.pw-dock-item.is-active{color:#fff;background:rgba(255,255,255,.07)}
  .pw-dock-icon{display:flex;align-items:center;justify-content:center;height:20px;width:20px}
  .pw-dock-label{line-height:1.1;white-space:nowrap;letter-spacing:-0.01em}
  .pw-dock-item.pw-dock-cta{max-width:92px;min-height:50px;position:relative;color:#fff;background:linear-gradient(135deg,#f97316 0%,#c75517 100%);border:1px solid rgba(255,255,255,.28);border-radius:13px;box-shadow:0 4px 14px rgba(249,115,22,.45),inset 0 1px 0 rgba(255,255,255,.35);margin:0 2px}
  .pw-dock-item.pw-dock-cta:active{transform:scale(.93)}
  .pw-dock-item.pw-dock-cta .pw-dock-label{color:#fff;font-weight:800}
}
@media (max-width:600px){
  .pw-wrap{padding:0 16px}
  .pw-hero .phi-hb{height:clamp(225px,36svh,320px)}
  .pw-hero-grid{padding-top:10px;padding-bottom:16px}
  .pw-hero h1{font-size:clamp(1.32rem,6vw,1.72rem)}
  .pw-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%}
  .pw-actions .pw-btn{width:100%;min-height:44px;justify-content:center;font-size:.86rem;padding:0 12px}
  .pw-actions .pw-btn:nth-child(1),.pw-actions .pw-btn:nth-child(2){grid-column:1/-1;min-height:46px;font-size:.9rem}
  .pw-hero-toolbar{padding:0 14px;margin-top:-44px;margin-bottom:6px}
  .pw-mobile-scroll-cue{padding:5px 11px;font-size:.7rem}
  .pw-stats{margin-bottom:18px}
  .pw-stats li{padding:11px 14px}
  .pw-stats strong{font-size:1.02rem}
  .pw-stats span{font-size:.74rem}
  .pw-steps,.pw-projects,.pw-trust{grid-template-columns:1fr}
  .pw-trust li{border-inline-start:0;border-top:1px solid var(--line)}
  .pw-trust li:first-child{border-top:0}
  .pw-conv{grid-template-columns:1fr 1fr}
  .pw-conv .pw-swap{grid-column:1/-1;width:100%}
  .pw-grid-fields,.pw-results,.pw-form .pw-grid2{grid-template-columns:1fr}
  .pw-tools-body{padding:16px 14px}
  .pw-bim-stage{min-height:300px}
}
/* ===== قائمة التفقد ===== */
.pw-ck{display:flex;flex-direction:column;gap:20px}
.pw-ck-print-head{display:none}
.pw-ck-top{display:grid;grid-template-columns:1.4fr 1fr;gap:18px}
.pw-ck-progress,.pw-ck-field{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px 22px}
.pw-ck-progress-row{display:flex;align-items:baseline;gap:14px;margin-bottom:10px}
.pw-ck-progress-row strong{font-size:2rem;line-height:1;color:var(--o)}
.pw-ck-progress-row span{color:var(--ink-2);font-weight:600}
.pw-ck-bar{height:10px;border-radius:99px;background:#eceeef;overflow:hidden}
.pw-ck-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--o),var(--o-hi));border-radius:99px;transition:width .3s}
.pw-ck-hint{font-size:.8rem;color:var(--ink-2);margin-top:10px}
.pw-ck-field{display:flex;flex-direction:column;gap:8px;justify-content:center}
.pw-ck-field span{font-size:.85rem;font-weight:700;color:var(--ink-2)}
.pw-ck-field input,.pw-ck-search{width:100%;min-height:46px;border:1px solid var(--line);border-radius:12px;padding:0 14px;font:inherit;background:#fff;color:var(--ink)}
.pw-ck-field input:focus,.pw-ck-search:focus{outline:2px solid var(--o);outline-offset:1px;border-color:var(--o)}
.pw-ck-tools{display:flex;gap:12px;flex-wrap:wrap}
.pw-ck-search{flex:1 1 300px}
.pw-ck-actions{display:flex;gap:8px;flex-wrap:wrap}
.pw-ck-btn{min-height:46px;padding:0 16px;border:1px solid var(--line);background:#fff;border-radius:12px;font:inherit;font-weight:700;font-size:.9rem;cursor:pointer;color:var(--ink)}
.pw-ck-btn:hover{border-color:var(--ink)}
.pw-ck-btn.is-primary{background:var(--o);border-color:var(--o);color:#fff}
.pw-ck-btn.is-primary:hover{background:var(--o-dark);border-color:var(--o-dark)}
.pw-ck-chips{display:flex;gap:8px;flex-wrap:wrap}
.pw-ck-count{font-weight:700;color:var(--ink-2)}
.pw-ck-layout{display:grid;grid-template-columns:270px minmax(0,1fr);gap:26px;align-items:start}
.pw-ck-side{position:sticky;top:88px;max-height:calc(100vh - 110px);overflow:auto;background:#fff;border:1px solid var(--line);border-radius:18px;padding:12px}
.pw-ck-side-part p{font-size:.78rem;font-weight:800;color:var(--o);padding:10px 10px 4px}
.pw-ck-side button{display:flex;justify-content:space-between;gap:8px;width:100%;text-align:start;border:0;background:none;padding:8px 10px;border-radius:9px;font:inherit;font-size:.86rem;font-weight:600;color:var(--ink-2);cursor:pointer}
.pw-ck-side button:hover{background:var(--tint);color:var(--ink)}
.pw-ck-side button em{font-style:normal;font-size:.75rem;color:var(--ink-2);white-space:nowrap}
.pw-ck-side button.is-full em{color:#1a7f4b;font-weight:800}
.pw-ck-main{display:flex;flex-direction:column;gap:12px;min-width:0}
.pw-ck-part-h{font-size:1.15rem;margin:18px 0 4px;display:flex;flex-wrap:wrap;gap:6px 12px;align-items:baseline}
.pw-ck-part:first-child .pw-ck-part-h{margin-top:0}
.pw-ck-part-h span{font-size:.88rem;font-weight:600;color:var(--ink-2)}
.pw-ck-sec{background:#fff;border:1px solid var(--line);border-radius:16px;margin-top:10px;scroll-margin-top:90px}
.pw-ck-sec.is-open{border-color:#d3d7da}
.pw-ck-sec.is-done .pw-ck-no{background:#1a7f4b}
.pw-ck-sec-h{display:flex;align-items:center;gap:14px;width:100%;text-align:start;padding:16px 18px;border:0;background:none;font:inherit;cursor:pointer;color:var(--ink)}
.pw-ck-no{flex:none;width:34px;height:34px;border-radius:10px;background:var(--ink);color:#fff;display:grid;place-items:center;font-weight:800;font-size:.9rem}
.pw-ck-title{flex:1;font-weight:800;font-size:1.02rem;line-height:1.45}
.pw-ck-title small{display:block;font-size:.76rem;font-weight:600;color:var(--ink-2);text-align:right}
.pw-ck-meter{font-size:.82rem;font-weight:700;color:var(--ink-2);background:var(--tint);border-radius:99px;padding:3px 10px}
.pw-ck-chev{flex:none;transition:transform .2s;color:var(--ink-2)}
.pw-ck-sec.is-open .pw-ck-chev{transform:rotate(180deg)}
.pw-ck-sec-b{padding:2px 18px 18px;border-top:1px solid var(--line)}
.pw-ck-critical{margin:16px 0 4px;border:1px solid #f0b9a0;background:#fff3ea;border-inline-start:5px solid var(--o);border-radius:12px;padding:14px 16px}
.pw-ck-critical b{color:var(--o-dark);font-size:.82rem;letter-spacing:.02em}
.pw-ck-critical p{margin-top:4px;font-weight:700}
.pw-ck-group h4{margin:18px 0 6px;font-size:.95rem;color:var(--o-dark);font-weight:800}
.pw-ck-group ul{display:flex;flex-direction:column;gap:2px;margin-top:8px}
.pw-ck-group li label{display:flex;gap:12px;align-items:flex-start;padding:9px 8px;border-radius:10px;cursor:pointer}
.pw-ck-group li label:hover{background:var(--tint)}
.pw-ck-group li label input{position:absolute;opacity:0;width:1px;height:1px}
.pw-ck-box{flex:none;width:22px;height:22px;margin-top:3px;border:2px solid #b7bdc2;border-radius:7px;display:grid;place-items:center;color:transparent;background:#fff;transition:all .15s}
.pw-ck-group li label input:focus-visible+.pw-ck-box{outline:2px solid var(--o);outline-offset:2px}
.pw-ck-group li label.is-checked .pw-ck-box{background:#1a7f4b;border-color:#1a7f4b;color:#fff}
.pw-ck-text{font-size:.96rem;line-height:1.75}
.pw-ck-text strong{font-weight:800}
.pw-ck-group li label.is-checked .pw-ck-text{color:var(--ink-2)}
.pw-ck-subs{margin:0 42px 6px 0;padding:0;gap:4px!important}
.pw-ck-subs li{position:relative;padding-inline-start:16px;font-size:.9rem;color:var(--ink-2);line-height:1.7}
.pw-ck-subs li::before{content:'';position:absolute;inset-inline-start:0;top:.7em;width:6px;height:6px;border-radius:50%;background:var(--o)}
.pw-ck-all{margin-top:14px;border:1px dashed #c2c7cb;background:none;border-radius:10px;padding:8px 14px;font:inherit;font-size:.85rem;font-weight:700;color:var(--ink-2);cursor:pointer}
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
.pw-view-tabs{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:28px;background:var(--tint);padding:6px;border-radius:14px;max-width:580px;margin-inline:auto;border:1px solid var(--line)}
.pw-view-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 18px;border-radius:10px;font-weight:700;font-size:.95rem;border:none;background:transparent;color:var(--ink-2);cursor:pointer;transition:all .2s}
.pw-view-tab:hover{color:var(--ink);background:rgba(255,255,255,.6)}
.pw-view-tab.is-active{background:#fff;color:var(--o-dark);box-shadow:0 4px 14px rgba(20,28,34,.08);font-weight:800}

.pw-exec-dossier{display:flex;flex-direction:column;gap:24px}
.pw-exec-controls{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px 20px;box-shadow:0 4px 18px rgba(20,28,34,.04);display:flex;flex-direction:column;gap:16px}
.pw-exec-search-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.pw-exec-search-box{flex:1;min-width:280px;position:relative;display:flex;align-items:center}
.pw-exec-search-icon{position:absolute;inset-inline-start:14px;font-size:1rem;pointer-events:none;opacity:.6}
.pw-exec-search-input{width:100%;height:46px;padding-inline:42px 36px;border-radius:12px;border:1.5px solid var(--line);background:var(--tint);font-size:.95rem;outline:none;transition:border-color .15s,background .15s,box-shadow .15s}
.pw-exec-search-input:focus{border-color:var(--o);background:#fff;box-shadow:0 0 0 3px rgba(199,85,23,.12)}
.pw-exec-search-clear{position:absolute;inset-inline-end:12px;border:none;background:none;font-size:.9rem;color:var(--ink-2);cursor:pointer;padding:4px}
.pw-exec-quick-stats{font-size:.88rem;color:var(--ink-2);white-space:nowrap}
.pw-exec-quick-stats strong{color:var(--o-dark)}
.pw-exec-filters{display:flex;flex-direction:column;gap:12px;border-top:1px dashed var(--line);padding-top:14px}
.pw-exec-filter-group{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.pw-exec-filter-label{font-size:.84rem;font-weight:700;color:var(--ink-2);min-width:90px}
.pw-exec-chips{display:flex;gap:6px;flex-wrap:wrap}

.pw-exec-list{display:flex;flex-direction:column;gap:18px}
.pw-exec-empty{text-align:center;padding:48px 20px;background:var(--tint);border-radius:16px;color:var(--ink-2);display:flex;flex-direction:column;align-items:center;gap:14px}

/* Card */
.pw-exec-card{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 4px 16px rgba(20,28,34,.04);transition:border-color .2s,box-shadow .2s;overflow:hidden}
.pw-exec-card:hover{border-color:#cbd3d9}
.pw-exec-card.is-open{border-color:var(--o);box-shadow:0 8px 28px rgba(199,85,23,.09)}
.pw-exec-card-header{padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:18px;cursor:pointer;user-select:none;background:#fff;transition:background .15s}
.pw-exec-card-header:hover{background:var(--tint)}
.pw-exec-header-left{display:flex;align-items:center;gap:14px;flex:1}
.pw-exec-code{flex-shrink:0;width:44px;height:44px;border-radius:12px;background:var(--o-soft);color:var(--o-dark);font-weight:800;font-size:.95rem;display:grid;place-items:center;letter-spacing:.5px}
.pw-exec-titles h3{font-size:1.15rem;font-weight:800;color:var(--ink);line-height:1.35;margin-bottom:4px}
.pw-exec-meta-pills{display:flex;gap:6px;flex-wrap:wrap}
.pw-exec-pill{font-size:.78rem;padding:2px 8px;border-radius:6px;font-weight:700}
.pw-pill-cat{background:#eef2f6;color:#3b506c}
.pw-pill-unit{background:#f1f5f9;color:#475569}
.pw-pill-prj{background:#fef3c7;color:#92400e}

.pw-exec-header-right{display:flex;align-items:center;gap:14px;flex-shrink:0}
.pw-exec-price-chip{display:flex;flex-direction:column;align-items:flex-end;background:#f0fdf4;border:1px solid #bbf7d0;padding:6px 12px;border-radius:10px}
.pw-exec-price-val{font-size:.95rem;font-weight:800;color:#166534}
.pw-exec-price-date{font-size:.72rem;color:#15803d}
.pw-exec-toggle-btn{background:none;border:none;cursor:pointer;color:var(--ink-2);display:grid;place-items:center;padding:6px;border-radius:8px}
.pw-exec-toggle-btn:hover{background:rgba(0,0,0,.05);color:var(--ink)}

/* Body & Grid */
.pw-exec-body{border-top:1px solid var(--line);padding:22px;background:#fafaf9;display:flex;flex-direction:column;gap:20px}
.pw-exec-topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px dashed var(--line)}
.pw-exec-dimension-badges{display:flex;gap:8px;flex-wrap:wrap}
.pw-dim-badge{font-size:.78rem;font-weight:700;padding:4px 10px;border-radius:20px;background:#f1f5f9;color:#334155}
.pw-dim-badge.is-verified{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}
.pw-exec-goto-ck{background:#fff;border:1px solid var(--line);border-radius:8px;padding:6px 14px;font-size:.84rem;font-weight:700;color:var(--ink-2);cursor:pointer;transition:all .15s}
.pw-exec-goto-ck:hover{border-color:var(--o);color:var(--o-dark);background:var(--o-soft)}

.pw-exec-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
.pw-exec-block{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:12px}
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
.pw-applied-banner{background:linear-gradient(145deg,#fdfbf7 0%,#fff 100%);border:1.5px solid #fed7aa;border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:16px;box-shadow:0 4px 18px rgba(234,88,12,.06)}
.pw-applied-head{display:flex;gap:12px;align-items:center;border-bottom:1px solid #ffedd5;padding-bottom:12px}
.pw-applied-icon{font-size:1.8rem}
.pw-applied-head h4{font-size:1.05rem;font-weight:800;color:#9a3412}
.pw-applied-sub{font-size:.84rem;color:#7c2d12}
.pw-applied-jo code{background:#ffedd5;color:#9a3412;padding:2px 6px;border-radius:4px;font-weight:700}
.pw-applied-story p{font-size:.92rem;line-height:1.75;color:var(--ink);background:#fff;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px}
.pw-applied-challenges h5{font-size:.9rem;font-weight:800;color:#9a3412;margin-bottom:8px}
.pw-challenges-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.pw-challenge-card{background:#fff;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.pw-ch-q,.pw-ch-a{display:flex;flex-direction:column;gap:3px;font-size:.84rem}
.pw-ch-tag{align-self:flex-start;font-size:.72rem;font-weight:800;background:#fee2e2;color:#b91c1c;padding:1px 6px;border-radius:4px}
.pw-ch-tag.is-sol{background:#dcfce7;color:#15803d}
.pw-applied-metric{display:flex;align-items:center;gap:10px;background:#fff;border:1.5px dashed #f97316;border-radius:10px;padding:10px 14px;font-size:.88rem;color:#7c2d12}
.pw-metric-icon{font-size:1.25rem}

.pw-ck-card-btn{margin-top:10px;display:inline-flex;align-items:center;gap:6px;background:var(--o-soft);border:1px solid var(--o);color:var(--o-dark);padding:5px 12px;border-radius:8px;font-size:.83rem;font-weight:700;cursor:pointer;transition:all .15s}
.pw-ck-card-btn:hover{background:var(--o);color:#fff}

@media (max-width:900px){
  .pw-exec-grid{grid-template-columns:1fr}
  .pw-exec-card-header{flex-direction:column;align-items:flex-start}
  .pw-exec-header-right{width:100%;justify-content:space-between}
}

/* ===== تنسيق موحّد: رؤوس الأقسام، الحاويات، الكروت، والتوازن العام ===== */
.pw{--pw-radius:20px;--pw-gap:24px;--pw-pad-y:88px}
.pw-section{padding:var(--pw-pad-y) 0}
/* تبادل خلفيات الأقسام بانتظام (أبيض / رمادي فاتح) بغض النظر عن الأقسام المخفية */
.pw .pw-section.pw-tint{background:#fff;border-block:0}
.pw main>section.pw-section:nth-of-type(odd){background:var(--tint);border-block:1px solid var(--line)}
/* رؤوس الأقسام: كلها في المنتصف وبعرض واحد */
.pw-head{max-width:46rem;margin:0 auto 52px;text-align:center}
.pw-head .pw-eyebrow{justify-content:center}
.pw-head p:not(.pw-eyebrow){max-width:40rem;margin-inline:auto}
.pw-contact .pw-head{max-width:none;margin:0 0 22px;text-align:start}
.pw-contact .pw-head .pw-eyebrow{justify-content:flex-start}
.pw-contact .pw-head p:not(.pw-eyebrow){margin-inline:0}
.pw-contact.pw-contact-solo{grid-template-columns:minmax(0,680px);justify-content:center}
.pw-contact-solo .pw-head{text-align:center}
.pw-contact-solo .pw-head .pw-eyebrow{justify-content:center}
.pw-contact-solo .pw-head p:not(.pw-eyebrow){margin-inline:auto}
/* شريط الأرقام يتماشى مع عرض الحاوية */
.pw-stats.pw-wrap{width:calc(100% - 48px);max-width:1152px;padding:0}
/* الالتزامات وطريقة العمل: نفس شكل الكروت ونفس التباعد والارتفاع */
.pw-trust,.pw-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--pw-gap);background:none;border:0;border-radius:0;overflow:visible}
.pw-trust li,.pw-trust li:first-child,.pw-trust li:nth-child(n),.pw-steps li{background:#fff;border:1px solid var(--line);border-radius:var(--pw-radius);padding:28px 24px;height:100%}
.pw-trust li:hover,.pw-steps li:hover{border-color:rgba(199,85,23,.45);box-shadow:0 18px 38px -26px rgba(199,85,23,.45)}
.pw-card,.pw-contact-card,.pw-faq details{border-radius:var(--pw-radius)}
.pw-cards{gap:var(--pw-gap)}
.pw-card{height:100%}
.pw-tools,.pw-bim-stage,.pw-bim-panel{border-radius:22px}
/* التواصل: عمودان متساويان بنفس الارتفاع */
.pw-contact{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--pw-gap);align-items:stretch}
.pw-contact>div:first-child{display:flex;flex-direction:column}
.pw-contact>div:first-child .pw-contact-card{flex:1}
.pw-contact>.pw-contact-card{height:100%}
.pw-faq{max-width:860px}
@media (max-width:1040px){
  .pw-trust,.pw-steps{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:960px){
  .pw{--pw-pad-y:58px}
  .pw-head{margin-bottom:34px}
  .pw-head h2{font-size:clamp(1.28rem,4.5vw,1.85rem);line-height:1.34}
  .pw-head p:not(.pw-eyebrow){font-size:.96rem;line-height:1.64}
  .pw-contact,.pw-contact.pw-contact-solo{grid-template-columns:minmax(0,1fr)}
  .pw-stats.pw-wrap{width:calc(100% - 36px)}
  .pw-trust,.pw-steps{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pw-trust li:nth-child(n),.pw-trust li:first-child{border:1px solid var(--line)}
}
@media (max-width:680px){
  .pw{--pw-gap:14px;--pw-pad-y:40px;--pw-radius:16px}
  .pw-wrap{padding:0 16px}
  .pw-header{margin-bottom:-62px;background:linear-gradient(180deg,rgba(9,11,15,.82) 0%,rgba(9,11,15,0) 100%)}
  .pw-header.is-scrolled{background:rgba(10,14,20,.92)}
  .pw-header-row{height:62px;gap:12px}
  .pw-brand{gap:9px}
  .pw-brand-mark{height:36px}
  .pw-brand-text strong{font-size:1.08rem}
  .pw-burger{width:40px;height:40px;border-radius:10px}
  .pw-head{margin-bottom:24px;padding:0 4px}
  .pw-head h2{font-size:clamp(1.18rem,4.8vw,1.48rem);line-height:1.36;margin-bottom:8px;letter-spacing:-0.01em}
  .pw-head p:not(.pw-eyebrow){font-size:clamp(0.85rem,3.4vw,0.92rem);line-height:1.6}
  .pw-eyebrow{font-size:.72rem;margin-bottom:8px}
  .pw-card{padding:18px 16px;border-radius:var(--pw-radius);gap:10px}
  .pw-card h3,.pw-project h3{font-size:1.08rem}
  .pw-card>p,.pw-trust p,.pw-steps p{font-size:.88rem;line-height:1.6}
  .pw-card ul{gap:8px;padding-top:12px}
  .pw-card li{font-size:.86rem}
  .pw-icon{width:44px;height:44px;border-radius:12px}
  .pw-trust,.pw-steps{grid-template-columns:1fr}
  .pw-trust li:nth-child(n),.pw-trust li:first-child{border:1px solid var(--line);padding:18px 16px;border-radius:var(--pw-radius)}
  .pw-steps li{padding:18px 16px;border-radius:var(--pw-radius)}
  .pw-trust h3,.pw-steps h3{font-size:1.02rem}
  .pw-step-n{font-size:1.55rem;margin-bottom:8px}
  .pw-trust-n{font-size:.78rem;margin-bottom:8px}
  .pw-contact-card{padding:18px 16px;border-radius:var(--pw-radius)}
  .pw-tools{border-radius:var(--pw-radius)}
  .pw-tools-body{padding:16px 14px}
  .pw-tools-tabs{scrollbar-width:none;-webkit-overflow-scrolling:touch}
  .pw-tools-tabs::-webkit-scrollbar{display:none}
  .pw-tools-tabs button{padding:9px 14px;font-size:.86rem}
  .pw-answer{padding:14px 16px}
  .pw-answer strong{font-size:1.5rem}
  .pw-bim-stage{min-height:300px;border-radius:var(--pw-radius)}
  .pw-bim-panel{padding:18px 16px;border-radius:var(--pw-radius)}
  .pw-stats.pw-wrap{width:calc(100% - 32px);margin-bottom:18px;border-radius:14px}
  .pw-stats li{padding:10px 12px}
  .pw-stats strong{font-size:1rem}
  .pw-stats span{font-size:.72rem}
  .pw-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%}
  .pw-actions .pw-btn{width:100%;min-height:44px;padding:0 12px;font-size:.85rem;border-radius:11px;justify-content:center}
  .pw-actions .pw-btn:nth-child(1),.pw-actions .pw-btn:nth-child(2){grid-column:1/-1;min-height:46px;font-size:.9rem}
  .pw-hero .phi-hb{height:clamp(225px,36svh,320px)}
  .pw-hero h1,.pw-hero h2{font-size:clamp(1.28rem,5.6vw,1.65rem);line-height:1.35;margin-bottom:10px}
  .pw-lead{font-size:clamp(0.86rem,3.4vw,0.94rem);line-height:1.6;margin-bottom:16px}
  .pw-view-tabs{gap:6px;padding:5px;margin-bottom:18px;border-radius:12px}
  .pw-view-tab{padding:9px 10px;font-size:.84rem;border-radius:9px}
  .pw-exec-controls{padding:14px;border-radius:14px;gap:12px}
  .pw-exec-search-box{min-width:100%}
  .pw-exec-filter-group{flex-direction:column;align-items:stretch;gap:6px}
  .pw-exec-filter-label{min-width:0;font-size:.78rem}
  .pw-exec-chips,.pw-ck-chips,.pw-bim-layers{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:4px;max-width:100%}
  .pw-exec-chips::-webkit-scrollbar,.pw-ck-chips::-webkit-scrollbar,.pw-bim-layers::-webkit-scrollbar{display:none}
  .pw-exec-chips .pw-chip,.pw-ck-chips .pw-chip,.pw-bim-layers .pw-chip{flex:0 0 auto;white-space:nowrap;padding:6px 12px;font-size:.8rem}
  .pw-exec-card-header{padding:14px 16px;gap:12px}
  .pw-exec-titles h3{font-size:1.02rem}
  .pw-exec-body{padding:14px;gap:14px}
  .pw-exec-block{padding:14px}
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
.pw-guide-banner{background:#fff;border:1.5px solid #fed7aa;border-radius:18px;padding:16px 20px;margin-bottom:24px;display:flex;flex-direction:column;gap:12px;box-shadow:0 12px 28px -22px rgba(199,85,23,.45)}
.pw-guide-steps{display:flex;flex-wrap:wrap;gap:10px 22px;font-size:.86rem;color:var(--ink-2);padding-bottom:10px;border-bottom:1px dashed #fed7aa}
.pw-guide-steps strong{color:var(--o-dark);font-weight:900;margin-inline-end:4px}
.pw-guide-intents{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.pw-guide-intents-label{font-size:.86rem;font-weight:900;color:var(--ink)}
.pw-guide-chips{display:flex;flex-wrap:wrap;gap:8px}
.pw-guide-chip{padding:7px 14px;border-radius:999px;border:1.5px solid var(--line);background:var(--tint);color:var(--ink);font-size:.82rem;font-weight:800;cursor:pointer;transition:all .16s ease}
.pw-guide-chip:hover,.pw-guide-chip.is-active{background:var(--portal-accent,var(--o));border-color:var(--portal-accent,var(--o));color:#fff;box-shadow:0 8px 18px -10px rgba(0,0,0,.35)}
.pw-portal-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.pw-portal-card{text-align:start;background:#fff;border:1.5px solid var(--line);border-radius:20px;padding:22px 20px;display:flex;flex-direction:column;gap:10px;cursor:pointer;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;position:relative}
.pw-portal-card:hover{transform:translateY(-4px);border-color:var(--portal-accent,var(--o));box-shadow:0 20px 42px -24px rgba(20,28,34,.22)}
.pw-portal-card.is-active{border-color:var(--portal-accent,var(--o));background:linear-gradient(180deg,#fff 0%,#fff9f5 100%);box-shadow:0 18px 40px -20px rgba(199,85,23,.32)}
.pw-portal-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.pw-portal-icon{width:48px;height:48px;border-radius:14px;background:var(--o-soft);display:grid;place-items:center;font-size:1.55rem;flex-shrink:0}
.pw-portal-card.is-active .pw-portal-icon{background:var(--portal-accent,var(--o));color:#fff}
.pw-portal-badge{font-size:.74rem;font-weight:800;color:var(--ink-2);background:var(--tint);border:1px solid var(--line);border-radius:999px;padding:4px 10px;margin-inline-end:auto}
.pw-portal-num{font-size:.82rem;font-weight:900;color:var(--o);opacity:.7}
.pw-portal-card h3{font-size:1.22rem;font-weight:900;color:var(--ink)}
.pw-portal-hint-box{background:#f8fafc;border-inline-start:3px solid var(--portal-accent,var(--o));border-radius:10px;padding:8px 11px;display:flex;flex-direction:column;gap:2px}
.pw-portal-hint-box strong{font-size:.77rem;font-weight:900;color:var(--portal-accent,var(--o-dark))}
.pw-portal-hint-box span{font-size:.81rem;color:var(--ink);line-height:1.5;font-weight:600}
.pw-portal-desc{font-size:.87rem;color:var(--ink-2);line-height:1.55}
.pw-portal-list{display:flex;flex-direction:column;gap:5px;margin-top:2px;padding-top:10px;border-top:1px solid var(--line);font-size:.82rem;color:var(--ink)}
.pw-portal-list li{display:flex;align-items:flex-start;gap:7px}
.pw-portal-dot{color:var(--portal-accent,var(--o));font-weight:900}
.pw-portal-cta{margin-top:auto;padding:10px 14px;border-radius:12px;background:var(--o-soft);display:flex;align-items:center;justify-content:space-between;font-weight:900;font-size:.85rem;color:var(--portal-accent,var(--o));transition:background .16s ease,color .16s ease}
.pw-portal-card.is-active .pw-portal-cta,.pw-portal-card:hover .pw-portal-cta{background:var(--portal-accent,var(--o));color:#fff}

/* One architectural scene stays behind the full public homepage. */
.pw:has(>.pw-construction){isolation:isolate;background:#16202a}
.pw:has(>.pw-construction)>main{position:relative;z-index:1}
.pw-construction{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:#16202a;direction:rtl}
.pw-construction-horizon{position:absolute;inset:0;background:radial-gradient(ellipse at 59% 42%,rgba(218,166,108,.24),transparent 58%),linear-gradient(180deg,#121c26 0%,#16202a 56%,#1f262c 100%)}
.pw-construction-canvas,.pw-construction-canvas canvas{position:absolute;inset:0;display:block;width:100%;height:100%}
.pw-construction-poster{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain}
.pw-construction-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(9,15,19,.32),transparent 30%,transparent 65%,rgba(9,15,19,.35)),linear-gradient(90deg,rgba(9,15,19,.16),transparent 30%,transparent 75%,rgba(9,15,19,.16))}
.pw-construction-status{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:9px;color:#f1ece4;font-size:.73rem;font-weight:700;letter-spacing:.01em;padding:5px 14px;border-radius:999px;background:rgba(255,255,255,.05);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12);white-space:nowrap;z-index:4}
.pw-construction-dot{width:5px;height:5px;border-radius:50%;background:#ec965d;box-shadow:0 0 12px #d7793c}
.pw-construction-track{width:68px;height:2px;background:rgba(255,255,255,.2);overflow:hidden}
.pw-construction-track span{display:block;width:100%;height:100%;background:#ec965d;transform:scaleX(var(--build-progress,0));transform-origin:right}
.pw-construction[data-fallback=true] .pw-construction-track{display:none}
.pw-construction-scroll-cue{display:flex;align-items:center;justify-content:center;gap:12px;align-self:center;color:#e7e4dd;font-size:.8rem;font-weight:700;padding:10px 18px;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.25)}
.pw-construction-scroll-cue:focus-visible{outline:2px solid #ffb074;outline-offset:5px}
.pw-construction-finale{position:relative;min-height:92vh;min-height:92svh;display:flex;align-items:flex-end;padding:64px 0 76px;background:linear-gradient(180deg,transparent 50%,rgba(9,15,19,.7));color:#fff}
.pw-construction-finale .pw-eyebrow{color:#ffb074}
.pw-construction-finale h2{font-size:clamp(1.5rem,3vw,2.4rem);font-weight:900;color:#fff;margin-bottom:20px}
@media(max-width:900px){.pw-construction-status{display:none}}
@media(max-width:700px){.pw-panoramic-floating-hero{margin:10vh auto auto}.pw-construction-scroll-cue{margin-bottom:14px}}
@media(prefers-reduced-motion:reduce){.pw-split-reveal,.pw-diag-slice,.pw-diag-veil,.pw-diag-details{transition:none!important;transform:none!important}.pw-construction-scroll-cue{scroll-behavior:auto}}
@media(max-height:500px) and (orientation:landscape){.pw-panoramic-top-overlay{height:auto;min-height:calc(100svh + 150px);padding-top:76px;padding-bottom:90px;gap:20px}.pw-panoramic-floating-hero{margin:28px auto}.pw-construction-scroll-cue{margin:0 auto 16px}.pw-construction-status{display:none}}

/* Diagonal 3-part homepage screen overlay over the live 3D architectural building. */
.pw-split-stage{position:relative;width:100%;min-height:100vh;background:transparent!important}
.pw-diag-runway{position:relative;width:100%;height:185vh}
.pw-diag-viewport{position:sticky;top:0;width:100%;height:100vh;height:100dvh;overflow:hidden;z-index:2;display:flex;flex-direction:column}
.pw-diag-top{position:relative;z-index:8;padding-top:82px;padding-bottom:14px;flex-shrink:0;pointer-events:none;display:flex;flex-direction:column;gap:8px}
.pw-diag-top .phi-ticker-bar{pointer-events:auto;margin-bottom:2px}
.pw-diag-hero-bar{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:2px 0}
.pw-diag-hero-titles{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px}
.pw-diag-hero-titles .pw-eyebrow{margin:0;color:#ffb074;text-shadow:0 2px 12px rgba(0,0,0,.85)}
.pw-diag-hero-titles h1,.pw-diag-hero-titles h2{font-size:clamp(1.2rem,2.1vw,1.72rem);font-weight:900;line-height:1.25;color:#fff;text-shadow:0 3px 18px rgba(0,0,0,.9)}
.pw-diag-scroll-pill{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:rgba(12,18,26,.54);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#f3ece1;font-size:.76rem;font-weight:800;transition:opacity .3s ease,transform .3s ease}
.pw-diag-scroll-pill.is-faded{opacity:0;transform:translateY(-6px)}
.pw-diag-slices{position:relative;flex:1;min-height:0;width:100%;z-index:4;pointer-events:none}
.pw-diag-slice{position:absolute;inset:0;display:block;text-decoration:none;color:#fff;pointer-events:auto;outline:none;transition:opacity .32s ease,filter .32s ease}
.pw-diag-slice.is-slice-0{clip-path:polygon(70% 0%,100% 0%,100% 100%,63% 100%)}
.pw-diag-slice.is-slice-1{clip-path:polygon(37% 0%,70% 0%,63% 100%,30% 100%)}
.pw-diag-slice.is-slice-2{clip-path:polygon(0% 0%,37% 0%,30% 100%,0% 100%)}
.pw-diag-veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,13,20,.14) 0%,rgba(8,13,20,.05) 40%,rgba(8,13,20,.72) 82%,rgba(8,13,20,.88) 100%);transition:background .35s ease}
.pw-diag-slice.is-active .pw-diag-veil{background:linear-gradient(180deg,rgba(8,13,20,.10) 0%,rgba(8,13,20,.04) 40%,color-mix(in srgb,var(--col-accent,#c75517) 26%,rgba(8,13,20,.72)) 84%,rgba(8,13,20,.90) 100%)}
.pw-diag-slice.is-hovered .pw-diag-veil,.pw-diag-slice:focus-visible .pw-diag-veil{background:linear-gradient(180deg,color-mix(in srgb,var(--col-accent,#c75517) 18%,rgba(8,13,20,.14)) 0%,rgba(8,13,20,.08) 42%,color-mix(in srgb,var(--col-accent,#c75517) 38%,rgba(8,13,20,.76)) 82%,rgba(8,13,20,.92) 100%)}
.pw-diag-slices.has-hover .pw-diag-slice:not(.is-hovered){opacity:.76}
.pw-diag-content{position:absolute;bottom:58px;z-index:2;display:flex;flex-direction:column;align-items:flex-start;gap:7px;text-align:right}
.pw-diag-slice.is-slice-0 .pw-diag-content{left:67.5%;right:2.5%}
.pw-diag-slice.is-slice-1 .pw-diag-content{left:33.2%;right:37.2%}
.pw-diag-slice.is-slice-2 .pw-diag-content{left:2.5%;right:70.5%}
.pw-diag-num{display:inline-flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:.79rem;font-weight:900;color:#ffb074;text-shadow:0 2px 12px rgba(0,0,0,.95)}
.pw-diag-content h2{font-size:clamp(1.18rem,1.95vw,1.68rem);font-weight:900;line-height:1.28;color:#fff;text-shadow:0 3px 20px rgba(0,0,0,.95);margin:0}
.pw-diag-details{display:flex;flex-direction:column;gap:5px;transition:transform .28s ease,opacity .28s ease}
.pw-diag-slice.is-hovered .pw-diag-details{transform:translateY(-3px)}
.pw-diag-hint{font-size:.86rem;font-weight:700;line-height:1.55;color:rgba(255,255,255,.94);text-shadow:0 2px 14px rgba(0,0,0,.95);margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pw-diag-tags{font-size:.76rem;font-weight:800;color:#ffd0a6;text-shadow:0 2px 12px rgba(0,0,0,.95);margin:0}
.pw-diag-cta{display:inline-flex;align-items:center;gap:7px;margin-top:2px;padding-bottom:3px;border-bottom:2px solid var(--col-accent,#c75517);color:#fff;font-size:.86rem;font-weight:900;text-shadow:0 2px 12px rgba(0,0,0,.95);transition:transform .2s ease,color .2s ease}
.pw-diag-slice.is-hovered .pw-diag-cta{transform:translateX(-4px);color:#ffb074}
.pw-diag-lines{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6;mask-image:linear-gradient(180deg,transparent 0%,#000 7%,#000 100%);-webkit-mask-image:linear-gradient(180deg,transparent 0%,#000 7%,#000 100%)}
.pw-diag-lines-mobile{display:none}
.pw-diag-line-glow{stroke:rgba(255,176,116,.38);stroke-width:6}
.pw-diag-line-core{stroke:rgba(255,255,255,.78);stroke-width:1.6}
.pw-diag-slice:focus-visible{box-shadow:inset 0 0 0 2px #ffb074}

@media(max-width:900px){
  .pw-diag-runway{height:150svh}
  .pw-diag-viewport{display:flex;flex-direction:column;padding-bottom:68px}
  .pw-diag-top{padding-top:68px;padding-bottom:6px;flex-shrink:0}
  .pw-diag-hero-titles h1,.pw-diag-hero-titles h2{font-size:1.12rem}
  .pw-diag-scroll-pill{display:none}
  .pw-diag-slices{position:relative;flex:1;min-height:0;inset:auto;width:100%}
  .pw-diag-slice.is-slice-0{clip-path:polygon(0% 0%,100% 0%,100% 30%,0% 37%)}
  .pw-diag-slice.is-slice-1{clip-path:polygon(0% 37%,100% 30%,100% 63%,0% 70%)}
  .pw-diag-slice.is-slice-2{clip-path:polygon(0% 70%,100% 63%,100% 100%,0% 100%)}
  .pw-diag-lines-desktop{display:none}
  .pw-diag-lines-mobile{display:block}
  .pw-diag-slice .pw-diag-content{left:16px!important;right:16px!important;gap:3px}
  .pw-diag-slice.is-slice-0 .pw-diag-content{top:10px;bottom:auto}
  .pw-diag-slice.is-slice-1 .pw-diag-content{top:50%;bottom:auto;transform:translateY(-50%)}
  .pw-diag-slice.is-slice-2 .pw-diag-content{bottom:14px;top:auto}
  .pw-diag-num{font-size:.7rem}
  .pw-diag-content h2{font-size:1.05rem}
  .pw-diag-hint{font-size:.76rem;-webkit-line-clamp:1}
  .pw-diag-tags{display:none}
  .pw-diag-cta{font-size:.76rem}
}

/* الأداة السريعة المبسطة */
.pw-quick-finder{background:#fff;border:1.5px solid #fed7aa;border-radius:22px;padding:24px;display:flex;flex-direction:column;gap:16px}
.pw-quick-finder-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:14px}
.pw-quick-finder-head h2{font-size:clamp(1.25rem,2.4vw,1.7rem);font-weight:900}
.pw-quick-finder-controls{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between}
.pw-quick-finder-result{background:var(--o-soft);border:1px solid #fed7aa;border-radius:14px;padding:12px 16px;font-weight:800;font-size:.94rem;color:#7c2d12}

/* رأس موحّد للصفحات العامة يطابق هوية الصفحة الرئيسية */
.pw-unified-hero{position:relative;background:linear-gradient(180deg,#fffaf5 0%,#ffffff 100%);padding:98px 0 36px;border-bottom:1px solid var(--line)}
.pw-unified-crumb{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;font-size:.82rem;font-weight:700;color:var(--ink-2);margin-bottom:14px}
.pw-unified-crumb a{color:var(--ink-2);transition:color .16s}
.pw-unified-crumb a:hover{color:var(--o)}
.pw-unified-crumb .sep{opacity:.45}
.pw-unified-promo{background:linear-gradient(90deg,rgba(249,115,22,.1),rgba(249,115,22,.05),rgba(14,165,233,.08));border:1px solid rgba(249,115,22,.22);border-radius:14px;padding:9px 16px;text-align:center;color:var(--o-dark);font-weight:800;font-size:.83rem;margin:0 auto 20px;max-width:56rem}
.pw-sec-hero-split{display:grid;grid-template-columns:1.15fr .85fr;gap:28px;align-items:center}
.pw-sec-hero-split .pw-head{text-align:start;margin:0;max-width:none}
.pw-sec-hero-split .pw-unified-crumb{justify-content:flex-start}
.pw-sec-hero-visual{position:relative;border-radius:20px;overflow:hidden;aspect-ratio:16/9;background:var(--tint);border:1.5px solid rgba(20,24,27,.1);box-shadow:0 22px 44px -24px rgba(20,24,27,.28)}
.pw-sec-hero-visual img{width:100%;height:100%;object-fit:cover;display:block}
.pw-sec-hero-badge{position:absolute;top:12px;inset-inline-end:12px;padding:4px 12px;border-radius:999px;background:rgba(15,20,25,.68);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fff;font-size:.78rem;font-weight:900;border:1px solid rgba(255,255,255,.24)}

/* صفحة القسم المخصصة */
.pw-section-page{min-height:80vh;background:var(--tint)}
.pw-sec-hero{background:linear-gradient(180deg,#fffaf5 0%,#ffffff 100%);border-bottom:1px solid var(--line);padding:98px 0 36px}
.pw-sec-breadcrumb{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--line)}
.pw-back-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:12px;background:var(--ink);color:#fff;font-size:.86rem;font-weight:800;transition:background .16s}
.pw-back-btn:hover{background:var(--o)}
.pw-sec-hops{display:flex;flex-wrap:wrap;gap:6px}
.pw-sec-hop{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:#fff;font-size:.8rem;font-weight:800;color:var(--ink-2)}
.pw-sec-hop.is-current{background:var(--o-soft);border-color:var(--o);color:var(--o-dark)}
.pw-sec-title-row{display:flex;align-items:center;gap:16px}
.pw-sec-big-icon{width:64px;height:64px;border-radius:18px;background:var(--o-soft);display:grid;place-items:center;font-size:2.1rem;flex-shrink:0}
.pw-sec-kicker{display:block;font-size:.78rem;font-weight:900;color:var(--portal-accent,var(--o));margin-bottom:2px}
.pw-sec-title-row h1{font-size:clamp(1.45rem,2.8vw,2.1rem);font-weight:900;margin-bottom:4px}
.pw-sec-title-row p{font-size:.96rem;color:var(--ink-2)}
.pw-sec-content{padding-top:30px;padding-bottom:64px}

.pw-explorer-switcher{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}
.pw-explorer-pill{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:999px;border:1.5px solid var(--line);background:#fff;color:var(--ink-2);font-weight:800;font-size:.88rem;cursor:pointer;transition:all .16s ease}
.pw-explorer-pill:hover{border-color:var(--o);color:var(--ink)}
.pw-explorer-pill.is-active{background:var(--ink);border-color:var(--ink);color:#fff;box-shadow:0 8px 20px -10px rgba(20,24,27,.45)}

.pw-explorer-header{background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px}
.pw-explorer-title-group{display:flex;align-items:flex-start;gap:14px;max-width:44rem}
.pw-explorer-hero-icon{width:56px;height:56px;border-radius:16px;background:var(--o-soft);display:grid;place-items:center;font-size:1.8rem;flex-shrink:0}
.pw-explorer-kicker{display:block;font-size:.76rem;font-weight:800;color:var(--o);margin-bottom:2px}
.pw-explorer-header h2{font-size:clamp(1.3rem,2.4vw,1.8rem);font-weight:900;margin-bottom:4px}
.pw-explorer-header p{font-size:.93rem;color:var(--ink-2)}
.pw-explorer-quick-links{display:flex;flex-wrap:wrap;gap:10px;align-items:center}

.pw-chip-bar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
.pw-mnt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.pw-mnt-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px;display:flex;flex-direction:column;gap:14px}
.pw-mnt-card-head{display:flex;align-items:flex-start;gap:12px}
.pw-mnt-icon{width:46px;height:46px;border-radius:12px;background:var(--o-soft);display:grid;place-items:center;font-size:1.45rem;flex-shrink:0}
.pw-mnt-code{display:block;font-size:.75rem;font-weight:800;color:var(--o);margin-bottom:2px}
.pw-mnt-card-head h3{font-size:1.08rem;font-weight:900}
.pw-mnt-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pw-mnt-box{background:var(--tint);border-radius:12px;padding:12px;font-size:.83rem}
.pw-mnt-box strong{display:block;margin-bottom:6px;font-weight:800;color:var(--ink)}
.pw-mnt-box ul{display:flex;flex-direction:column;gap:5px;color:var(--ink-2)}
.pw-mnt-box li::before{content:'• ';color:var(--o);font-weight:900}
.pw-mnt-tip{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:11px 14px;font-size:.84rem;color:#7c2d12;line-height:1.6}
.pw-mnt-tip strong{color:#9a3412}
.pw-mnt-foot{margin-top:auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding-top:10px;border-top:1px solid var(--line)}
.pw-mnt-warranty{font-size:.78rem;font-weight:800;color:#0369a1;background:#f0f9ff;border:1px solid #bae6fd;border-radius:999px;padding:4px 10px}
.pw-mnt-actions{display:flex;gap:8px;flex-wrap:wrap}

.pw-calc-box{background:#fff;border:1.5px solid var(--line);border-radius:22px;padding:24px}
.pw-calc-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:18px}
.pw-calc-head h3{font-size:1.25rem;font-weight:900}
.pw-calc-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:24px;align-items:stretch}
.pw-calc-controls{display:flex;flex-direction:column;gap:16px}
.pw-calc-sliders{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.pw-calc-scopes{display:flex;flex-wrap:wrap;gap:8px}
.pw-scope-toggle{display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border-radius:12px;border:1.5px solid var(--line);background:var(--tint);font-size:.86rem;font-weight:800;cursor:pointer}
.pw-scope-toggle.is-on{background:var(--o-soft);border-color:var(--o);color:var(--o-dark)}
.pw-calc-summary{background:var(--tint);border:1px solid var(--line);border-radius:18px;padding:20px;display:flex;flex-direction:column;justify-content:space-between;gap:14px}
.pw-calc-summary-top{display:flex;flex-direction:column;gap:4px}
.pw-calc-summary-top span{font-size:.84rem;color:var(--ink-2);font-weight:700}
.pw-calc-summary-top strong{font-size:1.7rem;font-weight:900;color:var(--o-dark)}
.pw-discount-pill{display:inline-block;align-self:flex-start;background:#dcfce7!important;color:#15803d!important;border:1px solid #86efac;border-radius:8px;padding:4px 10px;font-size:.78rem!important;font-weight:800;margin-top:4px}
.pw-calc-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.pw-calc-metrics>div{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}
.pw-calc-metrics small{font-size:.74rem;color:var(--ink-2);font-weight:700}
.pw-calc-metrics strong{font-size:1rem;font-weight:900;color:var(--ink)}

.pw-re-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.pw-re-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px;display:flex;flex-direction:column;justify-content:space-between;gap:14px}
.pw-re-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.pw-re-hot{display:inline-block;font-size:.75rem;font-weight:800;color:#9a3412;background:#ffedd5;border:1px solid #fdba74;border-radius:999px;padding:3px 10px;margin-bottom:6px}
.pw-re-card h3{font-size:1.12rem;font-weight:900;margin-bottom:4px}
.pw-re-sub{font-size:.86rem;color:var(--ink-2);margin-bottom:12px}
.pw-re-specs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px}
.pw-re-specs>div{background:var(--tint);border-radius:10px;padding:8px 10px;display:flex;flex-direction:column}
.pw-re-specs small{font-size:.72rem;color:var(--ink-2);font-weight:700}
.pw-re-specs strong{font-size:.86rem;font-weight:800;color:var(--ink)}
.pw-re-features{display:flex;flex-direction:column;gap:5px;font-size:.84rem;color:var(--ink-2)}
.pw-re-foot{display:flex;flex-direction:column;gap:10px;padding-top:12px;border-top:1px solid var(--line)}
.pw-re-terms{font-size:.8rem;font-weight:800;color:#0369a1}

.pw-materials-highlight{background:linear-gradient(135deg,#fff7ed 0%,#ffffff 100%);border:1.5px solid #fdba74;border-radius:16px;padding:16px 18px;margin-bottom:18px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}
.pw-materials-highlight strong{display:block;font-size:.95rem;color:#9a3412;margin-bottom:3px}
.pw-materials-highlight span{display:block;font-size:.84rem;color:#7c2d12;line-height:1.55}

.pw-prod-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.pw-prod-card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;gap:12px;transition:transform .18s,border-color .18s,box-shadow .18s}
.pw-prod-card:hover{transform:translateY(-3px);border-color:rgba(199,85,23,.5);box-shadow:0 16px 32px -22px rgba(20,24,27,.25)}
.pw-prod-top{display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.pw-prod-code{font-family:ui-monospace,Consolas,monospace;font-size:.72rem;font-weight:800;color:var(--ink-2);background:var(--tint);padding:2px 8px;border-radius:6px}
.pw-prod-badge{font-size:.72rem;font-weight:800;color:var(--o-dark);background:var(--o-soft);padding:2px 8px;border-radius:999px}
.pw-prod-card h3{font-size:.98rem;font-weight:900;line-height:1.45;margin-bottom:6px}
.pw-prod-desc{font-size:.82rem;color:var(--ink-2);line-height:1.55;margin-bottom:8px}
.pw-prod-specs{display:flex;flex-direction:column;gap:4px;font-size:.78rem;color:var(--ink-2)}
.pw-prod-foot{display:flex;flex-direction:column;gap:8px;padding-top:10px;border-top:1px solid var(--line)}
.pw-prod-install-check{display:flex;align-items:center;gap:7px;font-size:.8rem;font-weight:800;color:var(--ink);cursor:pointer}
.pw-prod-actions{display:flex;gap:8px;align-items:center}

.pw-info-shortcuts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.pw-info-shortcut-card{background:#fff;border:1.5px solid var(--line);border-radius:16px;padding:16px;display:flex;align-items:center;gap:12px;transition:border-color .18s,transform .18s}
.pw-info-shortcut-card:hover{border-color:var(--o);transform:translateY(-2px)}
.pw-info-shortcut-card>span{font-size:1.75rem;flex-shrink:0}
.pw-info-shortcut-card strong{display:block;font-size:.96rem;font-weight:900;color:var(--ink)}
.pw-info-shortcut-card small{font-size:.8rem;color:var(--ink-2)}
.pw-tips-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.pw-tip-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:8px}
.pw-tip-tag{align-self:flex-start;font-size:.74rem;font-weight:800;color:var(--o-dark);background:var(--o-soft);border-radius:999px;padding:3px 10px}
.pw-tip-card h4{font-size:1rem;font-weight:900}
.pw-tip-card p{font-size:.86rem;color:var(--ink-2);line-height:1.65}
.pw-info-meta-row{display:flex;flex-wrap:wrap;gap:18px;margin-top:22px}

.pw-advisor-shell{background:linear-gradient(135deg,#fff 0%,#fff8f2 100%);border:1.5px solid #fed7aa;border-radius:24px;padding:30px;display:grid;grid-template-columns:1.1fr 1fr;gap:28px;align-items:center;box-shadow:0 24px 48px -32px rgba(199,85,23,.35)}
.pw-advisor-right{background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px}
.pw-advisor-right h3{font-size:1.25rem;font-weight:900;margin:6px 0}
.pw-advisor-duration{font-size:.9rem;color:var(--ink-2);margin-bottom:14px}
.pw-advisor-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:14px}
.pw-advisor-metrics>div{background:var(--tint);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:2px}
.pw-advisor-metrics small{font-size:.73rem;color:var(--ink-2);font-weight:700}
.pw-advisor-metrics strong{font-size:.92rem;font-weight:900;color:var(--o-dark)}

.pw-offers-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.pw-offer-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px;display:flex;flex-direction:column;justify-content:space-between;gap:16px}
.pw-offer-card.is-highlight{border-color:rgba(199,85,23,.55);background:linear-gradient(180deg,#fff 0%,#fff9f4 100%)}
.pw-offer-card h3{font-size:1.12rem;font-weight:900;margin-bottom:6px}
.pw-offer-card p{font-size:.87rem;color:var(--ink-2);margin-bottom:12px}
.pw-offer-actions{display:flex;flex-wrap:wrap;gap:8px}

/* شريط آخر الأخبار المتحرك في الشاشة الرئيسية — شفاف بالكامل بدون حاوية */
.phi-ticker-bar{display:flex;align-items:center;gap:12px;margin:0 auto 18px;padding:4px 0;border-radius:0;background:transparent!important;border:none!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;overflow:hidden}
.phi-ticker-badge{display:inline-flex;align-items:center;gap:7px;flex-shrink:0;padding:4px 11px;border-radius:999px;background:rgba(199,85,23,.85);color:#fff;font-size:.76rem;font-weight:900;letter-spacing:.01em}
.phi-ticker-dot{width:7px;height:7px;border-radius:50%;background:#fff;box-shadow:0 0 0 0 rgba(255,255,255,.75);animation:phiTickerPulse 1.8s infinite!important;animation-duration:1.8s!important;animation-iteration-count:infinite!important}
@keyframes phiTickerPulse{0%{box-shadow:0 0 0 0 rgba(255,255,255,.75)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
.phi-ticker-viewport{position:relative;flex:1;min-width:0;direction:ltr;text-align:left;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 22px,#000 calc(100% - 22px),transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 22px,#000 calc(100% - 22px),transparent 100%)}
.phi-ticker-track{display:flex;flex-direction:row;align-items:center;width:max-content;direction:ltr;will-change:transform}
.phi-ticker-group{display:flex;flex-direction:row;align-items:center;gap:14px;padding-inline-end:14px;flex-shrink:0}
.phi-ticker-item{display:inline-flex;align-items:center;gap:8px;direction:rtl;white-space:nowrap;font-size:.86rem;font-weight:800;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.85);padding:3px 6px;border-radius:9px;transition:color .16s}
.phi-ticker-item.is-link:hover{color:#ffb074}
.phi-ticker-tag{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.24);color:#ffd2ad;font-size:.73rem;font-weight:900}
.phi-ticker-text{line-height:1.45}
.phi-ticker-sep{color:#ffb074;font-size:.76rem;opacity:.85;flex-shrink:0}
.phi-ticker-toggle{flex-shrink:0;width:28px;height:28px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;display:grid;place-items:center;font-size:.7rem;font-weight:900;cursor:pointer;transition:border-color .16s,color .16s}
.phi-ticker-toggle:hover{border-color:var(--o);color:var(--o);background:var(--o-soft)}
@media (max-width:760px){
  .phi-ticker-bar{gap:8px;margin-bottom:18px;padding:6px 8px;border-radius:14px}
  .phi-ticker-badge{padding:4px 9px;font-size:.72rem;border-radius:9px}
  .phi-ticker-item{font-size:.8rem}
  .phi-ticker-toggle{width:26px;height:26px}
}

@media (max-width:1100px){
  .pw-portal-grid,.pw-offers-grid,.pw-tips-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pw-prod-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pw-calc-grid,.pw-advisor-shell{grid-template-columns:1fr}
}
@media (max-width:960px){
  .pw-split-station-row{height:100vh;height:100svh;min-height:100vh;min-height:100svh;padding:56px 0}
  .pw-split-station-row.is-side-left .pw-sec-floating-wrap{justify-content:flex-start}
  .pw-split-station-row.is-side-left .pw-split-col{text-align:right}
  .pw-split-station-row.is-side-left .pw-split-col-inner,.pw-split-station-row.is-side-left .pw-split-reveal{align-items:flex-start}
  .pw-sec-hero-split{grid-template-columns:1fr;gap:20px}
  .pw-sec-hero-split .pw-head{text-align:center}
  .pw-sec-hero-split .pw-unified-crumb{justify-content:center}
}
@media (max-width:760px){
  .pw-portal-grid,.pw-mnt-grid,.pw-mnt-cols,.pw-re-grid,.pw-prod-grid,.pw-info-shortcuts,.pw-tips-grid,.pw-offers-grid,.pw-calc-metrics,.pw-advisor-metrics{grid-template-columns:1fr}
  .pw-explorer-header,.pw-calc-box,.pw-advisor-shell,.pw-quick-finder{padding:16px}
  .pw-unified-hero,.pw-sec-hero{padding:86px 0 28px}
}
@media (max-width:600px){
  .pw-split-station-row{height:100vh;height:100svh;min-height:100vh;min-height:100svh;padding:48px 0}
  .pw-split-col h2{font-size:1.55rem}
  .pw-split-hint{font-size:.98rem}
}
@media (prefers-reduced-motion:reduce){
  .pw-split-col,.pw-split-bg-base,.pw-split-bg-layer,.pw-split-reveal,.pw-split-bar,.pw-split-num{transition:none!important;animation:none!important;transform:none!important}
}

/* ===== المرحلة 1: الترحيب + البحث الشامل ===== */
.pw-welcome-band{position:relative;z-index:4;padding:112px 0 68px;color:#f3f0e8;background:linear-gradient(180deg,rgba(11,16,23,.56) 0%,rgba(11,16,23,.48) 76%,rgba(11,16,23,.26) 100%)}
.pw-welcome-shell{background:rgba(13,19,27,.86);border:1px solid rgba(255,255,255,.10);border-radius:26px;padding:40px 36px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 28px 64px -32px rgba(0,0,0,.78);display:flex;flex-direction:column;gap:26px}
.pw-welcome-head{text-align:center;max-width:48rem;margin:0 auto;display:flex;flex-direction:column;gap:10px}
.pw-welcome-head .pw-eyebrow{color:#d99a6a;font-weight:700;margin:0}
.pw-welcome-head h1{font-size:clamp(1.5rem,2.6vw,2.2rem);font-weight:800;line-height:1.4;color:#f3f0e8;text-shadow:0 2px 14px rgba(0,0,0,.55);margin:0}
.pw-welcome-sub{font-size:clamp(.95rem,1.08vw,1.02rem);font-weight:500;color:#c3ccd6;line-height:1.75;margin:0}

/* شريط البحث الشامل المربوط بكل الأقسام */
.pw-omni-wrap{position:relative;z-index:25;max-width:52rem;width:100%;margin:0 auto}
.pw-omni-box{display:flex;align-items:center;gap:12px;background:rgba(10,15,22,.92);border:1.5px solid rgba(255,255,255,.18);border-radius:16px;padding:7px 16px 7px 8px;transition:border-color .18s,box-shadow .18s}
.pw-omni-box:focus-within,.pw-omni-box.is-open{border-color:rgba(235,160,100,.65);box-shadow:0 0 0 3px rgba(199,85,23,.2)}
.pw-omni-icon{color:#c3ccd6;display:inline-flex;align-items:center;flex-shrink:0}
.pw-omni-input{flex:1;min-width:0;border:none!important;background:transparent!important;color:#f3f0e8!important;font-size:.95rem;font-weight:500;outline:none!important;padding:9px 4px}
.pw-omni-input::placeholder{color:#8f9aa6}
.pw-omni-clear{width:28px;height:28px;border-radius:999px;border:none;background:rgba(255,255,255,.12);color:#f3f0e8;font-weight:800;cursor:pointer;display:grid;place-items:center;flex-shrink:0}
.pw-omni-clear:hover{background:rgba(255,255,255,.24)}
.pw-omni-store-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:11px;background:var(--o);color:#fff;font-size:.86rem;font-weight:700;white-space:nowrap;flex-shrink:0;text-decoration:none;transition:background .16s}
.pw-omni-store-btn:hover{background:var(--o-dark)}
.pw-omni-dropdown{position:absolute;top:calc(100% + 8px);inset-inline:0;background:rgba(13,19,27,.97);border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:14px;max-height:420px;overflow-y:auto;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 28px 60px -16px rgba(0,0,0,.88);display:flex;flex-direction:column;gap:12px}
.pw-omni-group{display:flex;flex-direction:column;gap:6px}
.pw-omni-group-title{font-size:.8rem;font-weight:700;color:#d99a6a;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.08)}
.pw-omni-row{display:flex;align-items:center;gap:12px;padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid transparent;transition:background .16s,border-color .16s;text-decoration:none;color:#f3f0e8}
.pw-omni-row:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.16)}
.pw-omni-thumb{width:64px;height:48px;border-radius:8px;object-fit:cover;background:#0c1118;flex-shrink:0}
.pw-omni-icon-badge{width:42px;height:42px;border-radius:10px;background:rgba(255,255,255,.07);display:grid;place-items:center;font-size:1.15rem;flex-shrink:0}
.pw-omni-row-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.pw-omni-row-meta{display:flex;gap:8px;font-size:.76rem;color:#c3ccd6;font-weight:600}
.pw-omni-row-info strong{font-size:.9rem;font-weight:700;color:#f3f0e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pw-omni-row-info small{font-size:.82rem;font-weight:500;color:#b9c3ce;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pw-omni-row-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
.pw-omni-add-btn{padding:7px 13px;border-radius:9px;border:none;background:var(--o);color:#fff;font-size:.8rem;font-weight:700;cursor:pointer;white-space:nowrap}
.pw-omni-add-btn.is-added{background:#059669}
.pw-omni-go-link{padding:7px 11px;border-radius:9px;border:1px solid rgba(255,255,255,.16);color:#e4e8ee;font-size:.8rem;font-weight:600;text-decoration:none;white-space:nowrap}
.pw-omni-go-link:hover{background:rgba(255,255,255,.1);color:#fff}
.pw-omni-empty{padding:20px 12px;text-align:center;color:#c3ccd6;display:flex;flex-direction:column;gap:10px}

/* ===== المرحلة 2: عرض متزامن لقسم المبيعات (شاشة كمبيوتر + آيفون + متجر iOS و Android) ===== */
.pw-sim-section{position:relative;z-index:3;padding:56px 0 84px;color:#f3f0e8;background:linear-gradient(180deg,rgba(11,16,23,.26) 0%,rgba(11,16,23,.64) 18%,rgba(11,16,23,.64) 84%,rgba(11,16,23,.12) 100%)}
.pw-sim-top-head{text-align:center;max-width:46rem;margin:0 auto 24px;display:flex;flex-direction:column;align-items:center;gap:8px}
.pw-sim-live-pill{display:inline-flex;align-items:center;gap:8px;padding:5px 14px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#d6e0ec;font-size:.8rem;font-weight:600}
.pw-sim-live-pill i{display:block;width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 8px rgba(16,185,129,.7);animation:pwSimLivePulse 2.1s infinite}
@keyframes pwSimLivePulse{0%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}100%{opacity:1;transform:scale(1)}}
.pw-sim-top-head h2{font-size:clamp(1.36rem,2.3vw,1.92rem);font-weight:800;line-height:1.4;color:#f3f0e8;text-shadow:0 2px 12px rgba(0,0,0,.55);margin:0}
.pw-sim-lead{font-size:.96rem;font-weight:500;line-height:1.75;color:#c3ccd6;margin:0}

/* Read-only Live Narrator Strip Above Devices */
.pw-sim-narrator-bar{background:rgba(15,22,31,.88);border:1px solid rgba(255,255,255,.10);border-inline-start:3px solid rgba(217,154,106,.7);border-radius:18px;padding:16px 22px;margin-bottom:28px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.pw-sim-narrator-copy{flex:1;min-width:240px;display:flex;flex-direction:column;gap:4px}
.pw-sim-caption-tag{font-size:.8rem;font-weight:700;color:#d99a6a}
.pw-sim-narrator-copy strong{font-size:1.02rem;font-weight:800;color:#f3f0e8}
.pw-sim-narrator-copy p{font-size:.88rem;font-weight:500;color:#c3ccd6;margin:0;line-height:1.65}
.pw-sim-narrator-right{min-width:210px;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
.pw-sim-caption-counter{font-size:.78rem;font-weight:600;color:#c3ccd6;background:rgba(255,255,255,.07);padding:4px 11px;border-radius:999px}
.pw-sim-progress-segs{width:100%;display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.pw-sim-seg-track{position:relative;height:4px;border-radius:999px;background:rgba(255,255,255,.14);overflow:hidden}
.pw-sim-seg-track.is-done{background:linear-gradient(90deg,var(--o),#e39b66)}
.pw-sim-seg-fill{position:absolute;inset:0;background:linear-gradient(90deg,var(--o),#e39b66);transform-origin:right center;transform:scaleX(0)}
.pw-sim-seg-fill.is-running{animation:pwSimBarFill 4.3s linear forwards}
@keyframes pwSimBarFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}

/* Synchronized Dual-Device Grid: Wide Desktop Monitor + Slender iPhone Pro */
.pw-sim-dual-stage{display:grid;grid-template-columns:minmax(0,1fr) 262px;gap:30px;align-items:end}

/* A. Realistic Desktop Studio Monitor + Browser Website */
.pw-sim-desktop-col{display:flex;flex-direction:column;align-items:center}
.pw-sim-monitor{width:100%;border-radius:20px;padding:10px;background:linear-gradient(160deg,#2d3642 0%,#12171e 100%);border:1.5px solid rgba(255,255,255,.22);box-shadow:0 30px 64px -26px rgba(0,0,0,.92),inset 0 0 0 2px #090d12}
.pw-sim-monitor-screen{border-radius:12px;overflow:hidden;background:#0a1017;border:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column}
.pw-sim-chrome{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 14px;background:rgba(255,255,255,.05);border-bottom:1px solid rgba(255,255,255,.09)}
.pw-sim-chrome-dots{display:flex;gap:6px}
.pw-sim-chrome-dots span{width:9px;height:9px;border-radius:50%}
.pw-sim-chrome-dots span:nth-child(1){background:#ef4444}
.pw-sim-chrome-dots span:nth-child(2){background:#f59e0b}
.pw-sim-chrome-dots span:nth-child(3){background:#10b981}
.pw-sim-chrome-url{flex:1;max-width:25rem;margin:0 auto;display:flex;align-items:center;gap:6px;padding:3px 12px;border-radius:999px;background:rgba(0,0,0,.48);border:1px solid rgba(255,255,255,.1);font-family:ui-monospace,Consolas,monospace;font-size:.72rem;color:#d6e0ec;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pw-sim-chrome-badge{font-size:.71rem;font-weight:900;color:#ffb074;background:rgba(199,85,23,.2);border:1px solid rgba(255,176,116,.3);padding:3px 10px;border-radius:999px;white-space:nowrap}

.pw-sim-web-nav{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;background:rgba(255,255,255,.025);border-bottom:1px solid rgba(255,255,255,.07)}
.pw-sim-app-brand{display:flex;align-items:center;gap:7px;font-size:.82rem}
.pw-sim-app-brand strong{font-weight:900;color:#fff}
.pw-sim-dot-logo{width:9px;height:9px;border-radius:50%;background:var(--o);box-shadow:0 0 10px var(--o)}
.pw-sim-web-links{display:flex;align-items:center;gap:12px;font-size:.76rem;font-weight:800;color:rgba(255,255,255,.66)}
.pw-sim-web-links span.is-active{color:#ffb074}
.pw-sim-cart-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,.09);font-size:.72rem;font-weight:900;color:#fff;transition:all .22s}
.pw-sim-cart-pill.is-filled{background:#059669;box-shadow:0 0 14px rgba(16,185,129,.45)}
.pw-sim-cart-pill.is-pop{animation:pwCartPop .42s cubic-bezier(.2,1.25,.4,1)}
@keyframes pwCartPop{0%{transform:scale(.85)}55%{transform:scale(1.18)}100%{transform:scale(1)}}

.pw-sim-web-body{position:relative;padding:16px;min-height:282px;display:flex;flex-direction:column;justify-content:center;overflow:hidden}
.pw-sim-web-grid{display:grid;grid-template-columns:1.35fr .95fr;gap:12px;align-items:stretch}
.pw-sim-web-card{display:flex;gap:11px;padding:10px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,176,116,.5);align-items:center}
.pw-sim-web-card.is-secondary{border-color:rgba(255,255,255,.1);opacity:.65}
.pw-sim-web-card img{width:108px;height:82px;border-radius:10px;object-fit:cover;flex-shrink:0;background:#0d131a}
.pw-sim-web-card-copy{display:flex;flex-direction:column;gap:4px;min-width:0;align-items:flex-start}
.pw-sim-web-card-copy strong{font-size:.82rem;font-weight:900;color:#fff;line-height:1.35}
.pw-sim-web-card-copy small{font-size:.71rem;color:rgba(255,255,255,.7);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

.pw-sim-web-detail{display:grid;grid-template-columns:190px 1fr;gap:16px;align-items:center;padding:12px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12)}
.pw-sim-web-detail-img{width:100%;height:142px;border-radius:12px;object-fit:cover;background:#0c1118}
.pw-sim-web-detail-info{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.pw-sim-web-detail-info strong{font-size:.94rem;font-weight:900;color:#fff}
.pw-sim-web-detail-info small{font-size:.75rem;color:rgba(255,255,255,.72)}
.pw-sim-web-detail-actions{display:flex;align-items:center;gap:10px;width:100%;margin-top:4px}
.pw-sim-web-detail-actions .pw-sim-action-btn{flex:1}

.pw-sim-web-checkout{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:12px}
.pw-sim-web-checkout-cols{display:grid;grid-template-columns:1.15fr .85fr;gap:10px}

.pw-sim-stand{display:flex;flex-direction:column;align-items:center;width:100%}
.pw-sim-stand-neck{width:76px;height:36px;background:linear-gradient(180deg,#1a212b 0%,#2d3642 100%);border-inline:1px solid rgba(255,255,255,.12)}
.pw-sim-stand-base{width:190px;height:10px;border-radius:999px;background:linear-gradient(90deg,#1c232d 0%,#3d4756 50%,#1c232d 100%);border:1px solid rgba(255,255,255,.18);box-shadow:0 12px 24px rgba(0,0,0,.6)}

/* Animated Desktop Arrow Cursor */
.pw-sim-cursor{position:absolute;pointer-events:none;z-index:6;transition:left .44s cubic-bezier(.2,.8,.2,1),top .44s cubic-bezier(.2,.8,.2,1),opacity .25s ease;filter:drop-shadow(0 4px 8px rgba(0,0,0,.65))}
.pw-sim-cursor.is-clicking svg{transform:scale(.82)}
.pw-sim-cursor.is-pos-0{left:62%;top:72%}
.pw-sim-cursor.is-pos-1{left:22%;top:76%}
.pw-sim-cursor.is-pos-2{left:48%;top:82%}
.pw-sim-cursor.is-pos-3{left:48%;top:34%;opacity:0}

/* B. Realistic Slender iPhone Pro Frame + Store Badges */
.pw-sim-iphone-col{display:flex;flex-direction:column;align-items:center;gap:12px}
.pw-sim-phone{position:relative;width:244px;border-radius:40px;padding:9px;background:linear-gradient(155deg,#3b4553 0%,#171d25 48%,#2d3643 100%);box-shadow:0 34px 68px -20px rgba(0,0,0,.92),0 0 0 1px rgba(255,255,255,.24),inset 0 0 0 2px #080b0f}
.pw-sim-phone::before{content:'';position:absolute;inset:-22px;border-radius:54px;background:radial-gradient(circle at 50% 45%,rgba(199,85,23,.24),transparent 70%);z-index:-1;pointer-events:none}
.pw-sim-hw-action,.pw-sim-hw-vol-1,.pw-sim-hw-vol-2,.pw-sim-hw-pwr{position:absolute;width:3px;border-radius:3px;background:#444e5c}
.pw-sim-hw-action{left:-3px;top:76px;height:18px}
.pw-sim-hw-vol-1{left:-3px;top:106px;height:30px}
.pw-sim-hw-vol-2{left:-3px;top:144px;height:30px}
.pw-sim-hw-pwr{right:-3px;top:124px;height:46px}

.pw-sim-phone-inner{position:relative;border-radius:31px;background:linear-gradient(180deg,#0c121a 0%,#080c12 100%);border:1px solid rgba(255,255,255,.1);padding:8px 10px 7px;display:flex;flex-direction:column;gap:7px;overflow:hidden}
.pw-sim-status-bar{display:flex;align-items:center;justify-content:space-between;font-size:.63rem;font-weight:900;color:#eef4fa;padding:0 3px}
.pw-sim-island{width:68px;height:17px;border-radius:999px;background:#030507;border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:flex-end;padding-inline-end:6px}
.pw-sim-island-cam{width:6px;height:6px;border-radius:50%;background:radial-gradient(circle,#1e3a5f 0%,#09121e 65%);box-shadow:0 0 0 1px rgba(255,255,255,.14)}
.pw-sim-signal{display:flex;align-items:center;gap:4px;font-size:.6rem;font-weight:800}
.pw-sim-battery{width:17px;height:9px;border-radius:2.5px;border:1px solid rgba(255,255,255,.72);padding:1.5px;display:inline-flex}
.pw-sim-battery span{width:84%;height:100%;border-radius:1px;background:#34d399}

.pw-sim-app-top{display:flex;align-items:center;justify-content:space-between;gap:6px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,.09)}
.pw-sim-iphone-col .pw-sim-app-brand{font-size:.76rem}

.pw-sim-ui{position:relative;height:278px;display:flex;flex-direction:column;justify-content:center;overflow:hidden}
.pw-sim-screen{display:flex;flex-direction:column;gap:9px;animation:pwSimSlideIn .34s cubic-bezier(.2,.8,.2,1)}
@keyframes pwSimSlideIn{from{opacity:.2;transform:translateX(-12px)}to{opacity:1;transform:none}}
.pw-sim-search-fake{display:flex;align-items:center;gap:7px;padding:8px 11px;border-radius:11px;background:rgba(255,255,255,.07);border:1px solid rgba(255,176,116,.4);font-size:.77rem;color:#ffe0c2;font-weight:800;min-height:36px}
.pw-sim-search-fake.is-compact{padding:6px 9px;font-size:.71rem;min-height:31px}
.pw-sim-typed{display:inline-flex;align-items:center;gap:2px;white-space:nowrap;overflow:hidden}
.pw-sim-caret{display:inline-block;width:2px;height:13px;background:#ffb074;animation:pwCaretBlink .8s step-end infinite}
@keyframes pwCaretBlink{0%,100%{opacity:1}50%{opacity:0}}

.pw-sim-phone-card{border-radius:14px;overflow:hidden;background:rgba(255,255,255,.05);border:1px solid rgba(255,176,116,.5)}
.pw-sim-phone-card-media{position:relative;height:112px;background:#0f161f}
.pw-sim-phone-card-media img{width:100%;height:100%;object-fit:cover;display:block}
.pw-sim-tag{display:inline-block;padding:2px 7px;border-radius:999px;background:rgba(255,176,116,.18);color:#ffb074;font-size:.66rem;font-weight:900}
.pw-sim-tag.is-dim{background:rgba(255,255,255,.08);color:rgba(255,255,255,.68)}
.pw-sim-tag.is-overlay{position:absolute;top:7px;inset-inline-start:7px;background:rgba(9,13,19,.86);border:1px solid rgba(255,176,116,.4)}
.pw-sim-phone-card-body{padding:9px 10px;display:flex;flex-direction:column;gap:5px}
.pw-sim-phone-card-body strong{font-size:.74rem;font-weight:900;color:#fff;line-height:1.35}
.pw-sim-phone-card-foot{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-top:2px}
.pw-sim-mini-badge{font-size:.64rem;font-weight:800;color:#6ee7b7}
.pw-sim-mini-btn{padding:5px 9px;border-radius:8px;background:var(--o);color:#fff;font-size:.68rem;font-weight:900;white-space:nowrap;transition:transform .16s ease,box-shadow .16s ease}
.pw-sim-mini-btn.is-dim{background:rgba(255,255,255,.1);color:rgba(255,255,255,.7)}
.pw-sim-mini-btn.is-pressed,.pw-sim-action-btn.is-pressed{transform:scale(.95);box-shadow:0 0 0 4px rgba(255,176,116,.48)}

.pw-sim-detail-box{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:8px;display:flex;flex-direction:column;gap:7px}
.pw-sim-detail-img{width:100%;height:96px;border-radius:10px;object-fit:cover;background:#0c1118}
.pw-sim-detail-meta{display:flex;flex-direction:column;gap:6px}
.pw-sim-detail-meta strong{font-size:.74rem;font-weight:900;color:#fff;line-height:1.35}
.pw-sim-spec-check{display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border-radius:8px;font-size:.68rem;font-weight:800;transition:all .24s ease}
.pw-sim-spec-check.is-pending{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);color:rgba(255,255,255,.68)}
.pw-sim-spec-check.is-checked{background:rgba(16,185,129,.16);border:1px solid rgba(16,185,129,.42);color:#6ee7b7}
.pw-sim-check-on{font-weight:900}
.pw-sim-qty-pill{display:inline-flex;align-items:center;gap:10px;padding:4px 9px;border-radius:9px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff;font-size:.76rem;font-weight:900}

.pw-sim-action-btn{padding:8px 12px;border-radius:10px;background:var(--o);color:#fff;font-size:.74rem;font-weight:900;text-align:center;transition:transform .16s ease,box-shadow .16s ease}
.pw-sim-action-btn.is-confirm{background:#059669}

.pw-sim-checkout-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:9px;display:flex;flex-direction:column;gap:8px}
.pw-sim-checkout-head{display:flex;align-items:center;justify-content:space-between;gap:6px}
.pw-sim-checkout-head strong{font-size:.82rem;color:#fff}
.pw-sim-checkout-row{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:10px;background:rgba(0,0,0,.35)}
.pw-sim-checkout-row img{width:46px;height:36px;border-radius:7px;object-fit:cover;flex-shrink:0}
.pw-sim-checkout-row strong{display:block;font-size:.71rem;color:#fff;line-height:1.3}
.pw-sim-checkout-row small{display:block;font-size:.64rem;color:rgba(255,255,255,.68)}
.pw-sim-qty{font-size:.76rem;font-weight:900;color:#ffb074}
.pw-sim-customer-box{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:7px 8px;border-radius:10px;background:rgba(255,255,255,.04);border:1px dashed rgba(255,255,255,.16)}
.pw-sim-customer-box strong{display:block;font-size:.69rem;color:#fff}
.pw-sim-customer-box small{display:block;font-size:.63rem;color:rgba(255,255,255,.7)}
.pw-sim-verified-pill{padding:2px 7px;border-radius:999px;background:rgba(16,185,129,.2);color:#6ee7b7;font-size:.64rem;font-weight:900;white-space:nowrap}

.pw-sim-success-card{background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.38);border-radius:14px;padding:16px 12px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:7px}
.pw-sim-success-card.is-desktop{padding:22px 18px}
.pw-sim-success-card.is-compact{padding:18px 10px}
.pw-sim-success-icon{width:40px;height:40px;border-radius:50%;background:#059669;color:#fff;display:grid;place-items:center;font-size:1.2rem;font-weight:900;box-shadow:0 0 22px rgba(16,185,129,.6)}
.pw-sim-success-card strong{font-size:.86rem;color:#fff}
.pw-sim-order-code{padding:3px 10px;border-radius:999px;background:rgba(0,0,0,.45);border:1px solid rgba(110,231,183,.35);font-family:ui-monospace,Consolas,monospace;font-size:.72rem;font-weight:900;color:#6ee7b7}
.pw-sim-success-card p{font-size:.76rem;line-height:1.5;color:rgba(255,255,255,.86);margin:0}
.pw-sim-tracker{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-top:3px}
.pw-sim-tracker span{padding:2px 8px;border-radius:999px;font-size:.65rem;font-weight:900}
.pw-sim-tracker span.is-done{background:rgba(16,185,129,.22);color:#6ee7b7}
.pw-sim-tracker span.is-now{background:rgba(255,176,116,.22);color:#ffb074}

/* Touch Tap Indicator on iPhone Screen */
.pw-sim-touch{position:absolute;width:24px;height:24px;border-radius:50%;border:2px solid #ffb074;background:rgba(255,176,116,.24);pointer-events:none;z-index:5;transition:left .42s cubic-bezier(.2,.8,.2,1),top .42s cubic-bezier(.2,.8,.2,1),opacity .25s ease;opacity:.85}
.pw-sim-touch.is-tapping{animation:pwTapBurst .65s ease-out}
@keyframes pwTapBurst{0%{transform:scale(1);box-shadow:0 0 0 0 rgba(255,176,116,.7)}70%{transform:scale(.82);box-shadow:0 0 0 12px rgba(255,176,116,0)}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(255,176,116,0)}}
.pw-sim-touch.is-pos-0{left:14%;top:81%}
.pw-sim-touch.is-pos-1{left:44%;top:85%}
.pw-sim-touch.is-pos-2{left:44%;top:85%}
.pw-sim-touch.is-pos-3{left:44%;top:34%;opacity:0}

.pw-sim-bottom-nav{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;padding-top:6px;border-top:1px solid rgba(255,255,255,.08);text-align:center}
.pw-sim-bottom-nav span{font-size:.6rem;font-weight:800;color:rgba(255,255,255,.52);padding:3px 0;border-radius:7px}
.pw-sim-bottom-nav span.is-on{color:#ffb074;background:rgba(255,176,116,.12)}
.pw-sim-phone-homebar{width:76px;height:3.5px;border-radius:999px;background:rgba(255,255,255,.32);margin:2px auto 1px}

/* iOS & Android Store Badges Next to / Below iPhone */
.pw-sim-store-badges{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;max-width:254px}
.pw-sim-store-badge{display:flex;align-items:center;justify-content:center;gap:8px;padding:7px 10px;border-radius:12px;background:rgba(12,18,26,.82);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff}
.pw-sim-store-badge div{display:flex;flex-direction:column;line-height:1.15;text-align:left}
.pw-sim-store-badge small{font-size:.58rem;font-weight:700;color:rgba(255,255,255,.68)}
.pw-sim-store-badge strong{font-size:.73rem;font-weight:900;color:#fff}

.pw-sim-foot-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:24px}

/* ===== المرحلة 4: المنتجات الأكثر مبيعاً (أهم 6 + عرض المزيد) ===== */
.pw-bestsellers-band{position:relative;z-index:4;padding:84px 0 96px;color:#f3f0e8;background:linear-gradient(180deg,rgba(11,16,23,.12) 0%,rgba(11,16,23,.82) 14%,rgba(11,16,23,.90) 100%)}
.pw-bs-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:24px}
.pw-bs-head .pw-eyebrow{color:#d99a6a;font-weight:700;margin-bottom:5px}
.pw-bs-head h2{font-size:clamp(1.42rem,2.45vw,2.05rem);font-weight:800;line-height:1.4;color:#f3f0e8;text-shadow:0 2px 14px rgba(0,0,0,.55);margin:0 0 8px}
.pw-bs-sub{font-size:.96rem;font-weight:500;line-height:1.75;color:#c3ccd6;max-width:42rem;margin:0}
.pw-bs-filters{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:28px}
.pw-bs-filter-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;background:rgba(15,22,31,.82);border:1px solid rgba(255,255,255,.12);color:#c3ccd6;font-size:.86rem;font-weight:600;cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:all .16s}
.pw-bs-filter-btn:hover{border-color:rgba(255,255,255,.28);color:#f3f0e8}
.pw-bs-filter-btn.is-on{background:var(--o);border-color:var(--o);color:#fff;font-weight:700;box-shadow:0 10px 22px -12px rgba(199,85,23,.75)}

.pw-bs-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.pw-bs-card{background:rgba(15,22,31,.88);border:1px solid rgba(255,255,255,.10);border-radius:22px;overflow:hidden;display:flex;flex-direction:column;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}
.pw-bs-card:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.22);box-shadow:0 24px 48px -26px rgba(0,0,0,.85)}
.pw-bs-media{position:relative;aspect-ratio:4/3;background:#0d131a;overflow:hidden}
.pw-bs-media img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s ease}
.pw-bs-card:hover .pw-bs-media img{transform:scale(1.03)}
.pw-bs-badge{position:absolute;top:12px;inset-inline-start:12px;padding:4px 11px;border-radius:999px;background:rgba(15,22,31,.82);border:1px solid rgba(255,255,255,.16);color:#f3f0e8;font-size:.75rem;font-weight:600;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.pw-bs-body{padding:20px 22px 22px;display:flex;flex-direction:column;gap:10px;flex:1}
.pw-bs-cat{font-size:.78rem;font-weight:600;color:#d99a6a}
.pw-bs-body h3{font-size:1.02rem;font-weight:800;line-height:1.5;color:#f3f0e8;margin:0}
.pw-bs-spec-one{font-size:.86rem;font-weight:500;line-height:1.65;color:#b9c3ce;margin:0}
.pw-bs-install{display:flex;align-items:center;gap:8px;font-size:.84rem;font-weight:600;color:#c8d3de;margin-top:auto;padding-top:8px;cursor:pointer}
.pw-bs-price{font-size:.86rem;font-weight:600;color:#d6e0ec}
.pw-bs-price strong{font-size:1.05rem;font-weight:800;color:#f3f0e8}
.pw-bs-actions{display:flex;gap:10px;align-items:center;padding-top:6px}
.pw-bs-add-btn{flex:1;min-height:42px!important;padding:0 14px!important;font-size:.86rem!important;font-weight:700!important}
.pw-bs-add-btn.is-added{background:#059669!important}
.pw-bs-wa-btn{min-height:42px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:#f3f0e8;font-size:.84rem;font-weight:600;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;cursor:pointer;transition:background .16s}
.pw-bs-wa-btn:hover{background:rgba(255,255,255,.14)}
.pw-bs-footer{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin-top:34px}
.pw-bs-more-btn{min-width:210px}

/* صورة مصغرة للمنتجات داخل صفحة تفاصيل القسم */
.pw-prod-thumb{aspect-ratio:4/3;border-radius:12px;overflow:hidden;margin-bottom:10px;background:#0f161e;border:1px solid var(--line)}
.pw-prod-thumb img{width:100%;height:100%;object-fit:cover;display:block}

@media(max-width:1024px){
  .pw-bs-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pw-sim-dual-stage{grid-template-columns:1fr;gap:26px}
}
@media(max-width:900px){
  .pw-welcome-shell{padding:20px 16px;border-radius:20px}
  .pw-sim-web-grid,.pw-sim-web-detail,.pw-sim-web-checkout-cols{grid-template-columns:1fr}
  .pw-sim-web-card.is-secondary{display:none}
  .pw-sim-narrator-right{width:100%;align-items:stretch}
}
@media(max-width:640px){
  .pw-welcome-band{padding:88px 0 42px}
  .pw-bestsellers-band{padding:56px 0 72px}
  .pw-omni-box{flex-wrap:wrap;padding:8px 10px}
  .pw-omni-store-btn{width:100%;justify-content:center}
  .pw-omni-row{flex-wrap:wrap}
  .pw-bs-grid{grid-template-columns:1fr}
  .pw-bs-actions .pw-bs-add-btn{min-height:40px}
  .pw-sim-web-links{gap:8px;font-size:.7rem}
}
@media(prefers-reduced-motion:reduce){
  .pw-sim-touch,.pw-sim-cursor,.pw-sim-screen,.pw-sim-seg-fill,.pw-sim-caret,.pw-sim-live-pill i,.pw-sim-cart-pill,.pw-bs-card,.pw-bs-media img{animation:none!important;transition:none!important}
}
`;
