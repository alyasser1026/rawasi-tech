export const CSS = `
.pw{--o:#c9772d;--o-hi:#e08d3c;--o-dark:#a65c1b;--o-soft:rgba(201,119,45,.15);--ink:#f1f5f9;--ink-2:#94a3b8;--line:rgba(255,255,255,.09);--bg:#0b0e13;--tint:#10151d;--surface:#141a23;--g1:#141922;--g2:#080a0e;
  position:relative;min-height:100vh;background:var(--bg);color:var(--ink);font-family:'Cairo',-apple-system,'Segoe UI',sans-serif;line-height:1.75;letter-spacing:0;-webkit-font-smoothing:antialiased;overflow-x:clip}
.pw *{box-sizing:border-box}
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
.pw-header.pw-header-glass{margin-bottom:-72px!important;background:rgba(11,14,19,.62)!important;backdrop-filter:blur(12px) saturate(140%)!important;-webkit-backdrop-filter:blur(12px) saturate(140%)!important;border-bottom:1px solid rgba(255,255,255,.08)!important;box-shadow:inset 0 -1px 0 rgba(255,255,255,.04)!important}
.pw-header.pw-header-glass.is-scrolled{background:rgba(10,13,18,.9)!important;backdrop-filter:blur(16px) saturate(150%)!important;-webkit-backdrop-filter:blur(16px) saturate(150%)!important;border-bottom-color:rgba(201,119,45,.22)!important;box-shadow:0 10px 30px -12px rgba(0,0,0,.78)!important}
.pw-header.pw-header-glass .pw-brand-text strong{color:#f8fafc!important;text-shadow:0 2px 12px rgba(0,0,0,.65)!important}
.pw-header.pw-header-glass .pw-brand-mark{filter:drop-shadow(0 0 8px rgba(235,102,25,.28)) brightness(1.38)!important}
.pw-header.pw-header-glass .pw-nav a:not(.pw-btn){color:#cbd5e1!important;text-shadow:none!important}
.pw-header.pw-header-glass .pw-nav a:not(.pw-btn):hover,.pw-header.pw-header-glass .pw-nav a.is-nav-active:not(.pw-btn){color:#e08d3c!important}
.pw-header.pw-header-glass .pw-nav a.is-nav-active:not(.pw-btn)::after{transform:scaleX(1)}
.pw-header.pw-header-glass .pw-burger{background:rgba(255,255,255,.08);backdrop-filter:blur(8px);border-color:rgba(255,255,255,.16)}
.pw-header.pw-header-glass .pw-burger span{background:#f1f5f9}
.pw-header.pw-header-glass .phi-cart-btn{color:#f1f5f9!important;background:rgba(255,255,255,.08)!important;backdrop-filter:blur(8px);border-color:rgba(255,255,255,.16)!important}
@media (max-width:960px){.pw-header.pw-header-glass .pw-nav.is-open a:not(.pw-btn){color:#f8fafc!important}.pw-header.pw-header-glass .pw-nav.is-open a.is-nav-active:not(.pw-btn){color:#e08d3c!important}}
.pw-header-row{display:flex;align-items:center;justify-content:space-between;height:72px;gap:16px}
.pw-brand{display:flex;align-items:center;gap:12px;flex-shrink:0}
.pw-brand-mark{height:44px;width:auto;filter:drop-shadow(0 0 1px rgba(255,255,255,.45)) drop-shadow(0 2px 8px rgba(0,0,0,.5))}
.pw-brand-text{display:flex;flex-direction:column;gap:5px;line-height:1.35}
.pw-brand-text strong{font-size:1.24rem;font-weight:900;line-height:1.3;letter-spacing:0;display:block;color:#fefcf9;text-shadow:0 2px 10px rgba(0,0,0,.6)}
.pw-brand-text small{font-size:.72rem;font-weight:800;letter-spacing:.16em;line-height:1.15;color:#f97316;direction:ltr;unicode-bidi:isolate;text-align:right;display:block}
.pw-nav{display:flex;align-items:center;gap:13px;font-weight:700;font-size:.86rem;color:#ede5da;white-space:nowrap}
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
.pw-btn-ghost{background:var(--surface,#141a23);color:var(--ink);border-color:var(--line)}
.pw-btn-ghost:hover{border-color:var(--o-hi);color:var(--o-hi)}
.pw-btn-light{background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.28)}
.pw-btn-light:hover{background:rgba(255,255,255,.16);border-color:#fff}
.pw-nav-cta{min-height:40px;padding:0 16px;font-size:.86rem}
.pw-nav-portal{min-height:40px;padding:0 14px;border-radius:11px;font-size:.82rem;font-weight:800;background:rgba(255,255,255,.08);color:#f1f5f9!important;border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 18px -10px rgba(0,0,0,.5)}
.pw-nav-portal.is-guest{background:rgba(255,255,255,.07);color:#e2e8f0!important;border-color:rgba(255,255,255,.16);box-shadow:none}
.pw-nav-portal:hover{background:rgba(201,119,45,.22);color:#ffffff!important;border-color:rgba(224,141,60,.55)}
.pw-nav-portal.is-ready{background:linear-gradient(135deg,#1c2432,#141a23);border-color:rgba(224,141,60,.45)}
.pw-nav-portal.is-ready:hover{background:var(--o);border-color:var(--o)}
.pw-user-wrap{position:relative}
.pw-user-menu{position:absolute;top:calc(100% + 10px);inset-inline-end:0;width:258px;background:#141a23;color:var(--ink);border:1.5px solid rgba(255,255,255,.12);border-radius:16px;padding:8px;box-shadow:0 24px 48px -16px rgba(0,0,0,.78);display:flex;flex-direction:column;gap:4px;z-index:120;white-space:normal}
.pw-user-menu-head{padding:8px 10px 10px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:2px;margin-bottom:2px}
.pw-user-menu-head strong{font-size:.9rem;font-weight:900;color:var(--ink)}
.pw-user-menu-head small{font-size:.73rem;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis}
.pw-user-role-tag{align-self:flex-start;margin-top:4px;padding:2px 8px;border-radius:999px;font-size:.69rem;font-weight:800;background:rgba(255,255,255,.06);color:var(--ink-2);border:1px solid var(--line)}
.pw-user-role-tag.is-staff{background:rgba(201,119,45,.18);color:#fed7aa;border-color:rgba(224,141,60,.4)}
.pw-header.pw-header-glass .pw-nav .pw-user-menu a,.pw-user-menu-item{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 11px;border-radius:10px;border:0;background:transparent;color:var(--ink)!important;text-shadow:none!important;font-size:.83rem;font-weight:800;cursor:pointer;text-align:right;transition:background .15s ease,color .15s ease}
.pw-user-menu a::after{display:none!important}
.pw-header.pw-header-glass .pw-nav .pw-user-menu a:hover,.pw-user-menu-item:hover{background:rgba(255,255,255,.07);color:var(--o-hi)!important}
.pw-header.pw-header-glass .pw-nav .pw-user-menu a.is-portal,.pw-user-menu-item.is-portal{background:linear-gradient(135deg,#c9772d,#a65c1b);color:#ffffff!important;box-shadow:0 8px 16px -10px rgba(0,0,0,.55)}
.pw-header.pw-header-glass .pw-nav .pw-user-menu a.is-portal:hover,.pw-user-menu-item.is-portal:hover{background:#e08d3c;color:#ffffff!important}
.pw-user-menu-sep{height:1px;background:var(--line);margin:3px 0}
.pw-user-menu-item.is-danger{color:#f87171!important}
.pw-user-menu-item.is-danger:hover{background:rgba(239,68,68,.14);color:#fca5a5!important}
.pw a:focus-visible,.pw button:focus-visible,.pw input:focus-visible,.pw select:focus-visible,.pw textarea:focus-visible,.pw summary:focus-visible{outline:3px solid rgba(224,141,60,.55);outline-offset:3px}

/* hero (dark) */
.pw-hero{position:relative;isolation:isolate;background:#090b0f;color:#fff;overflow:hidden;min-height:clamp(510px,74vh,660px);display:flex;flex-direction:column;justify-content:center;border-bottom:1px solid rgba(201,119,45,.22)}
.pw-hero-art{visibility:hidden;min-height:340px}
.pw-hero-grid{position:relative;z-index:2;display:grid;grid-template-columns:minmax(0,0.92fr) minmax(0,1.28fr);gap:40px;align-items:center;padding-top:88px;padding-bottom:54px;width:100%}
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
.pw-trust{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;background:var(--surface,#141a23);border:1px solid var(--line);border-radius:20px;overflow:hidden}
.pw-trust li{padding:30px 26px;border-inline-start:1px solid var(--line)}
.pw-trust li:first-child{border-inline-start:0}
.pw-trust-n{display:block;font-weight:800;font-size:.85rem;color:var(--o-hi);letter-spacing:.14em;margin-bottom:12px}
.pw-trust h3{font-size:1.08rem;font-weight:800;margin-bottom:8px;color:var(--ink)}
.pw-trust p{font-size:.92rem;color:var(--ink-2)}

/* services */
.pw-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.pw-card{background:var(--surface,#141a23);border:1px solid var(--line);border-radius:20px;padding:32px 28px;display:flex;flex-direction:column;gap:14px;transition:border-color .2s,box-shadow .2s,transform .2s}
.pw-card:hover{border-color:rgba(224,141,60,.52);box-shadow:0 22px 44px -26px rgba(201,119,45,.42);transform:translateY(-3px)}
.pw-icon{width:54px;height:54px;border-radius:14px;background:var(--o-soft);color:var(--o-hi);display:flex;align-items:center;justify-content:center}
.pw-card h3{font-size:1.25rem;font-weight:800;color:var(--ink)}
.pw-card>p{color:var(--ink-2);font-size:.96rem}
.pw-card ul{display:flex;flex-direction:column;gap:10px;margin-top:6px;padding-top:18px;border-top:1px solid var(--line)}
.pw-card li{display:flex;gap:10px;align-items:flex-start;font-size:.93rem}
.pw-card li svg{flex:none;margin-top:5px;color:var(--o-hi)}

/* BIM */
.pw-bim{display:grid;grid-template-columns:1.6fr .7fr;gap:24px;align-items:stretch}
.pw-bim-stage{position:relative;min-height:440px;border:1px solid var(--line);border-radius:22px;overflow:hidden;background:radial-gradient(600px 360px at 50% 30%,#1a222f 0%,#0c1016 100%)}
.pw-bim-canvas{position:absolute;inset:0}
.pw-bim-note{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--ink-2);font-weight:600}
.pw-bim-hint{position:absolute;inset-inline:0;bottom:12px;text-align:center;font-size:.8rem;color:var(--ink-2);pointer-events:none}
.pw-bim-reset{position:absolute;top:14px;inset-inline-start:14px;font-size:.8rem;font-weight:700;background:#141a23;color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:6px 12px;cursor:pointer}
.pw-bim-reset:hover{border-color:var(--o-hi);color:var(--o-hi)}
.pw-bim-panel{background:var(--surface,#141a23);border:1px solid var(--line);border-radius:22px;padding:24px;display:flex;flex-direction:column;gap:18px}
.pw-bim-panel h3{font-size:1.05rem;font-weight:800;color:var(--ink)}
.pw-bim-layers{display:flex;flex-wrap:wrap;gap:8px}
.pw-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:#141a23;border-radius:999px;padding:6px 14px;font-size:.85rem;font-weight:700;cursor:pointer;color:var(--ink-2);transition:all .15s}
.pw-chip i{width:10px;height:10px;border-radius:50%;opacity:.5}
.pw-chip.is-on{color:#fff;border-color:var(--o-hi);background:rgba(201,119,45,.2)}
.pw-chip.is-on i{opacity:1}
.pw-range{display:flex;flex-direction:column;gap:6px;font-size:.88rem;font-weight:700;color:var(--ink)}
.pw-range input{width:100%;accent-color:var(--o-hi)}
.pw-bim-info{min-height:130px;background:#0f141c;border:1px solid var(--line);border-radius:14px;padding:16px}
.pw-ifc{display:inline-block;font-family:ui-monospace,Consolas,monospace;font-size:.72rem;font-weight:700;color:#fed7aa;background:var(--o-soft);border-radius:6px;padding:2px 8px;margin-bottom:6px}
.pw-bim-info h4{font-size:1.02rem;font-weight:800;margin-bottom:4px;color:var(--ink)}
.pw-bim-info p{font-size:.9rem;color:var(--ink-2)}
.pw-bim-disclaimer{font-size:.78rem;color:var(--ink-2)}

/* tools */
.pw-tools{background:var(--surface,#141a23);border:1px solid var(--line);border-radius:22px;overflow:hidden}
.pw-tools-tabs{display:flex;gap:4px;padding:8px;background:#0d1118;border-bottom:1px solid var(--line);overflow-x:auto}
.pw-tools-tabs button{flex:1 0 auto;border:0;background:transparent;padding:12px 20px;border-radius:12px;font-weight:700;font-size:.95rem;cursor:pointer;color:var(--ink-2);white-space:nowrap;transition:background .15s,color .15s}
.pw-tools-tabs button.is-on{background:#1b2330;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.35),inset 0 0 0 1px rgba(224,141,60,.35)}
.pw-tools-body{padding:28px}
.pw-tool{display:flex;flex-direction:column;gap:22px}
.pw-seg{display:flex;flex-wrap:wrap;gap:8px}
.pw-seg button{border:1px solid var(--line);background:#141a23;padding:7px 16px;border-radius:999px;font-weight:700;font-size:.88rem;cursor:pointer;color:var(--ink-2);transition:all .15s}
.pw-seg button:hover{border-color:rgba(224,141,60,.45);color:var(--ink)}
.pw-seg button.is-on{background:var(--o);border-color:var(--o);color:#fff}
.pw-field{display:flex;flex-direction:column;gap:6px;font-size:.86rem;font-weight:700;color:var(--ink-2)}
.pw-input{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:12px;background:#0d1118;overflow:hidden;transition:border-color .15s}
.pw-input:focus-within{border-color:var(--o-hi)}
.pw-input input{flex:1;min-width:0;border:0;outline:0;padding:11px 14px;background:transparent;color:var(--ink);font-weight:700;text-align:left}
.pw-input em{font-style:normal;font-size:.8rem;font-weight:700;color:var(--ink-2);padding:0 12px;background:#161d28;align-self:stretch;display:flex;align-items:center;border-inline-start:1px solid var(--line)}
.pw-field select,.pw-field textarea,.pw-field>input{border:1.5px solid var(--line);border-radius:12px;padding:11px 14px;background:#0d1118;color:var(--ink);font-weight:600;width:100%}
.pw-field select:focus,.pw-field textarea:focus,.pw-field>input:focus{border-color:var(--o-hi);outline:0}
.pw-conv{display:grid;grid-template-columns:1fr 1.3fr auto 1.3fr;gap:12px;align-items:end}
.pw-swap{height:46px;width:46px;border-radius:12px;border:1.5px solid var(--line);background:#141a23;color:var(--ink);cursor:pointer;font-size:1.1rem;font-weight:800}
.pw-swap:hover{border-color:var(--o-hi);color:var(--o-hi)}
.pw-answer{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;background:var(--o-soft);border:1px solid rgba(224,141,60,.32);border-radius:16px;padding:18px 22px}
.pw-answer span{font-weight:700;color:#fed7aa;font-size:.9rem}
.pw-answer strong{font-size:2rem;font-weight:800;color:#fff;line-height:1.1}
.pw-answer small{color:#fed7aa;font-weight:600}
.pw-grid-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.pw-results{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.pw-results>div{background:#0f141c;border:1px solid var(--line);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:2px}
.pw-results>div.is-strong{background:linear-gradient(135deg,#c9772d,#9a5216);border-color:rgba(255,255,255,.15);color:#fff}
.pw-results dt{font-size:.8rem;font-weight:600;opacity:.75}
.pw-results dd{display:flex;align-items:baseline;gap:6px;font-size:1.35rem;font-weight:800}
.pw-results dd small{font-size:.78rem;font-weight:600;opacity:.75}
.pw-table{width:100%;max-width:560px;border-collapse:collapse;font-size:.9rem}
.pw-table caption{text-align:start;font-weight:800;margin-bottom:8px;color:var(--ink)}
.pw-table th,.pw-table td{padding:9px 4px;border-bottom:1px solid var(--line);text-align:start;font-weight:600}
.pw-table td{text-align:left;font-variant-numeric:tabular-nums;color:var(--ink)}
.pw-table th{color:var(--ink-2)}
.pw-note{font-size:.82rem;color:var(--ink-2)}

/* process */
.pw-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}
.pw-steps li{background:var(--surface,#141a23);border:1px solid var(--line);border-radius:18px;padding:26px 22px;position:relative}
.pw-step-n{display:block;font-weight:800;font-size:2rem;line-height:1;color:var(--o-hi);margin-bottom:14px}
.pw-steps h3{font-size:1.08rem;font-weight:800;margin-bottom:6px;color:var(--ink)}
.pw-steps p{font-size:.92rem;color:var(--ink-2)}

/* projects */
.pw-projects{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:24px}
.pw-project{background:var(--surface,#141a23);border:1px solid var(--line);border-radius:20px;padding:28px 26px;display:flex;flex-direction:column;gap:6px;border-top:4px solid var(--o)}
.pw-badge{align-self:flex-start;font-size:.78rem;font-weight:700;color:#fed7aa;background:var(--o-soft);border-radius:999px;padding:3px 12px;margin-bottom:8px}
.pw-project h3{font-size:1.3rem;font-weight:800;color:var(--ink)}
.pw-project>p{color:var(--ink-2)}
.pw-project dl{display:flex;gap:28px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
.pw-project dt{font-size:.78rem;color:var(--ink-2)}
.pw-project dd{font-weight:700;color:var(--ink)}

/* faq */
.pw-faq{max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.pw-faq details{background:var(--surface,#141a23);border:1px solid var(--line);border-radius:16px;padding:0 22px}
.pw-faq summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px 0;font-weight:800;color:var(--ink)}
.pw-faq summary::-webkit-details-marker{display:none}
.pw-faq summary::after{content:'+';font-size:1.4rem;color:var(--o-hi);font-weight:600;line-height:1}
.pw-faq details[open] summary::after{content:'−'}
.pw-faq details p{padding:0 0 18px;color:var(--ink-2)}

/* contact */
.pw-contact{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
.pw-contact-solo{grid-template-columns:minmax(0,680px)}
.pw-contact-card{background:var(--surface,#141a23);border:1px solid var(--line);border-radius:20px;padding:28px 26px}
.pw-contact-card li{display:flex;justify-content:space-between;gap:16px;align-items:baseline;padding:14px 0;border-bottom:1px solid var(--line)}
.pw-contact-card li:first-child{padding-top:0}
.pw-contact-card li span{color:var(--ink-2);font-size:.9rem;flex:none}
.pw-contact-card li a,.pw-contact-card li strong{font-weight:700;text-align:left;color:var(--ink)}
.pw-contact-card li a:hover{color:var(--o-hi)}
.pw-offices{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.pw-offices span{font-size:.85rem;font-weight:700;background:#0d1118;border:1px solid var(--line);color:var(--ink-2);border-radius:999px;padding:4px 14px}
.pw-form{display:flex;flex-direction:column;gap:14px;margin-top:6px}
.pw-form .pw-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.pw-form textarea{min-height:96px;resize:vertical}

/* footer */
.pw-footer{background:var(--g2);color:#d3dae0;padding:48px 0 28px}
.pw-footer-row{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;flex-wrap:wrap}
.pw-footer-brand{display:flex;align-items:center;gap:14px}
.pw-footer-brand img{height:46px;width:auto}
.pw-footer-brand>div{display:flex;flex-direction:column;gap:4px;line-height:1.4}
.pw-footer-brand strong{display:block;color:#fff;line-height:1.35}
.pw-footer-brand small{display:block;color:#8f9ba5;font-size:.8rem;line-height:1.3}
.pw-footer-nav{display:flex;flex-wrap:wrap;gap:8px 22px;font-size:.9rem;font-weight:600}
.pw-footer-nav a:hover{color:#fff}
.pw-footer-link{font-weight:700;font-size:.92rem;color:#fff;border:1px solid rgba(255,255,255,.28);border-radius:10px;padding:8px 18px;transition:background .18s,border-color .18s}
.pw-footer-link:hover{background:var(--o);border-color:var(--o)}
.pw-footer-bottom{margin-top:28px;padding-top:18px;border-top:1px solid rgba(255,255,255,.1);font-size:.8rem;color:#8f9ba5}

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
.pw-ck-progress,.pw-ck-field{background:var(--surface,#141a23);border:1px solid var(--line);border-radius:18px;padding:20px 22px}
.pw-ck-progress-row{display:flex;align-items:baseline;gap:14px;margin-bottom:10px}
.pw-ck-progress-row strong{font-size:2rem;line-height:1;color:var(--o-hi)}
.pw-ck-progress-row span{color:var(--ink-2);font-weight:600}
.pw-ck-bar{height:10px;border-radius:99px;background:#0d1118;overflow:hidden}
.pw-ck-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--o),var(--o-hi));border-radius:99px;transition:width .3s}
.pw-ck-hint{font-size:.8rem;color:var(--ink-2);margin-top:10px}
.pw-ck-field{display:flex;flex-direction:column;gap:8px;justify-content:center}
.pw-ck-field span{font-size:.85rem;font-weight:700;color:var(--ink-2)}
.pw-ck-field input,.pw-ck-search{width:100%;min-height:46px;border:1px solid var(--line);border-radius:12px;padding:0 14px;font:inherit;background:#0d1118;color:var(--ink)}
.pw-ck-field input:focus,.pw-ck-search:focus{outline:2px solid var(--o-hi);outline-offset:1px;border-color:var(--o-hi)}
.pw-ck-tools{display:flex;gap:12px;flex-wrap:wrap}
.pw-ck-search{flex:1 1 300px}
.pw-ck-actions{display:flex;gap:8px;flex-wrap:wrap}
.pw-ck-btn{min-height:46px;padding:0 16px;border:1px solid var(--line);background:#141a23;border-radius:12px;font:inherit;font-weight:700;font-size:.9rem;cursor:pointer;color:var(--ink)}
.pw-ck-btn:hover{border-color:var(--o-hi)}
.pw-ck-btn.is-primary{background:var(--o);border-color:var(--o);color:#fff}
.pw-ck-btn.is-primary:hover{background:var(--o-dark);border-color:var(--o-dark)}
.pw-ck-chips{display:flex;gap:8px;flex-wrap:wrap}
.pw-ck-count{font-weight:700;color:var(--ink-2)}
.pw-ck-layout{display:grid;grid-template-columns:270px minmax(0,1fr);gap:26px;align-items:start}
.pw-ck-side{position:sticky;top:88px;max-height:calc(100vh - 110px);overflow:auto;background:var(--surface,#141a23);border:1px solid var(--line);border-radius:18px;padding:12px}
.pw-ck-side-part p{font-size:.78rem;font-weight:800;color:var(--o-hi);padding:10px 10px 4px}
.pw-ck-side button{display:flex;justify-content:space-between;gap:8px;width:100%;text-align:start;border:0;background:none;padding:8px 10px;border-radius:9px;font:inherit;font-size:.86rem;font-weight:600;color:var(--ink-2);cursor:pointer}
.pw-ck-side button:hover{background:rgba(255,255,255,.06);color:var(--ink)}
.pw-ck-side button em{font-style:normal;font-size:.75rem;color:var(--ink-2);white-space:nowrap}
.pw-ck-side button.is-full em{color:#34d399;font-weight:800}
.pw-ck-main{display:flex;flex-direction:column;gap:12px;min-width:0}
.pw-ck-part-h{font-size:1.15rem;margin:18px 0 4px;display:flex;flex-wrap:wrap;gap:6px 12px;align-items:baseline;color:var(--ink)}
.pw-ck-part:first-child .pw-ck-part-h{margin-top:0}
.pw-ck-part-h span{font-size:.88rem;font-weight:600;color:var(--ink-2)}
.pw-ck-sec{background:var(--surface,#141a23);border:1px solid var(--line);border-radius:16px;margin-top:10px;scroll-margin-top:90px}
.pw-ck-sec.is-open{border-color:rgba(224,141,60,.4)}
.pw-ck-sec.is-done .pw-ck-no{background:#16a34a}
.pw-ck-sec-h{display:flex;align-items:center;gap:14px;width:100%;text-align:start;padding:16px 18px;border:0;background:none;font:inherit;cursor:pointer;color:var(--ink)}
.pw-ck-no{flex:none;width:34px;height:34px;border-radius:10px;background:#1e2633;color:#fff;border:1px solid var(--line);display:grid;place-items:center;font-weight:800;font-size:.9rem}
.pw-ck-title{flex:1;font-weight:800;font-size:1.02rem;line-height:1.45}
.pw-ck-title small{display:block;font-size:.76rem;font-weight:600;color:var(--ink-2);text-align:right}
.pw-ck-meter{font-size:.82rem;font-weight:700;color:var(--ink-2);background:#0d1118;border:1px solid var(--line);border-radius:99px;padding:3px 10px}
.pw-ck-chev{flex:none;transition:transform .2s;color:var(--ink-2)}
.pw-ck-sec.is-open .pw-ck-chev{transform:rotate(180deg)}
.pw-ck-sec-b{padding:2px 18px 18px;border-top:1px solid var(--line)}
.pw-ck-critical{margin:16px 0 4px;border:1px solid rgba(224,141,60,.45);background:rgba(201,119,45,.13);border-inline-start:5px solid var(--o-hi);border-radius:12px;padding:14px 16px;color:var(--ink)}
.pw-ck-critical b{color:var(--o-hi);font-size:.82rem;letter-spacing:.02em}
.pw-ck-critical p{margin-top:4px;font-weight:700}
.pw-ck-group h4{margin:18px 0 6px;font-size:.95rem;color:#f3a85b;font-weight:800}
.pw-ck-group ul{display:flex;flex-direction:column;gap:2px;margin-top:8px}
.pw-ck-group li label{display:flex;gap:12px;align-items:flex-start;padding:9px 8px;border-radius:10px;cursor:pointer}
.pw-ck-group li label:hover{background:rgba(255,255,255,.04)}
.pw-ck-group li label input{position:absolute;opacity:0;width:1px;height:1px}
.pw-ck-box{flex:none;width:22px;height:22px;margin-top:3px;border:2px solid #64748b;border-radius:7px;display:grid;place-items:center;color:transparent;background:#0d1118;transition:all .15s}
.pw-ck-group li label input:focus-visible+.pw-ck-box{outline:2px solid var(--o);outline-offset:2px}
.pw-ck-group li label.is-checked .pw-ck-box{background:#1a7f4b;border-color:#1a7f4b;color:#fff}
.pw-ck-text{font-size:.96rem;line-height:1.75}
.pw-ck-text strong{font-weight:800}
.pw-ck-group li label.is-checked .pw-ck-text{color:var(--ink-2)}
.pw-ck-subs{margin:0 42px 6px 0;padding:0;gap:4px!important}
.pw-ck-subs li{position:relative;padding-inline-start:16px;font-size:.9rem;color:var(--ink-2);line-height:1.7}
.pw-ck-subs li::before{content:'';position:absolute;inset-inline-start:0;top:.7em;width:6px;height:6px;border-radius:50%;background:var(--o)}
.pw-ck-all{margin-top:14px;border:1px dashed rgba(255,255,255,.22);background:none;border-radius:10px;padding:8px 14px;font:inherit;font-size:.85rem;font-weight:700;color:var(--ink-2);cursor:pointer}
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
.pw-view-tab:hover{color:var(--ink);background:rgba(255,255,255,.06)}
.pw-view-tab.is-active{background:rgba(201,119,45,.18);color:#f3a85b;border:1px solid rgba(201,119,45,.36);box-shadow:0 4px 14px rgba(0,0,0,.28);font-weight:800}

.pw-exec-dossier{display:flex;flex-direction:column;gap:24px}
.pw-exec-controls{background:#141a23;border:1px solid var(--line);border-radius:16px;padding:18px 20px;box-shadow:0 12px 28px rgba(0,0,0,.24);display:flex;flex-direction:column;gap:16px}
.pw-exec-search-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.pw-exec-search-box{flex:1;min-width:280px;position:relative;display:flex;align-items:center}
.pw-exec-search-icon{position:absolute;inset-inline-start:14px;font-size:1rem;pointer-events:none;opacity:.6}
.pw-exec-search-input{width:100%;height:46px;padding-inline:42px 36px;border-radius:12px;border:1.5px solid var(--line);background:#0d1118;color:var(--ink);font-size:.95rem;outline:none;transition:border-color .15s,background .15s,box-shadow .15s}
.pw-exec-search-input:focus{border-color:var(--o);background:#0b0e13;box-shadow:0 0 0 3px rgba(201,119,45,.18)}
.pw-exec-search-clear{position:absolute;inset-inline-end:12px;border:none;background:none;font-size:.9rem;color:var(--ink-2);cursor:pointer;padding:4px}
.pw-exec-quick-stats{font-size:.88rem;color:var(--ink-2);white-space:nowrap}
.pw-exec-quick-stats strong{color:var(--o-hi)}
.pw-exec-filters{display:flex;flex-direction:column;gap:12px;border-top:1px dashed var(--line);padding-top:14px}
.pw-exec-filter-group{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.pw-exec-filter-label{font-size:.84rem;font-weight:700;color:var(--ink-2);min-width:90px}
.pw-exec-chips{display:flex;gap:6px;flex-wrap:wrap}

.pw-exec-list{display:flex;flex-direction:column;gap:18px}
.pw-exec-empty{text-align:center;padding:48px 20px;background:var(--tint);border-radius:16px;color:var(--ink-2);display:flex;flex-direction:column;align-items:center;gap:14px}

/* Card */
.pw-exec-card{background:#141a23;border:1px solid var(--line);border-radius:16px;box-shadow:0 12px 26px rgba(0,0,0,.22);transition:border-color .2s,box-shadow .2s;overflow:hidden}
.pw-exec-card:hover{border-color:rgba(201,119,45,.38)}
.pw-exec-card.is-open{border-color:var(--o);box-shadow:0 16px 34px rgba(0,0,0,.36)}
.pw-exec-card-header{padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:18px;cursor:pointer;user-select:none;background:#141a23;transition:background .15s}
.pw-exec-card-header:hover{background:#18202c}
.pw-exec-header-left{display:flex;align-items:center;gap:14px;flex:1}
.pw-exec-code{flex-shrink:0;width:44px;height:44px;border-radius:12px;background:var(--o-soft);color:var(--o-hi);font-weight:800;font-size:.95rem;display:grid;place-items:center;letter-spacing:.5px}
.pw-exec-titles h3{font-size:1.15rem;font-weight:800;color:var(--ink);line-height:1.35;margin-bottom:4px}
.pw-exec-meta-pills{display:flex;gap:6px;flex-wrap:wrap}
.pw-exec-pill{font-size:.78rem;padding:2px 8px;border-radius:6px;font-weight:700}
.pw-pill-cat{background:rgba(148,163,184,.14);color:#cbd5e1}
.pw-pill-unit{background:rgba(148,163,184,.1);color:#94a3b8}
.pw-pill-prj{background:rgba(201,119,45,.18);color:#fed7aa}

.pw-exec-header-right{display:flex;align-items:center;gap:14px;flex-shrink:0}
.pw-exec-price-chip{display:flex;flex-direction:column;align-items:flex-end;background:rgba(16,185,129,.12);border:1px solid rgba(52,211,153,.3);padding:6px 12px;border-radius:10px}
.pw-exec-price-val{font-size:.95rem;font-weight:800;color:#6ee7b7}
.pw-exec-price-date{font-size:.72rem;color:#34d399}
.pw-exec-toggle-btn{background:none;border:none;cursor:pointer;color:var(--ink-2);display:grid;place-items:center;padding:6px;border-radius:8px}
.pw-exec-toggle-btn:hover{background:rgba(255,255,255,.08);color:var(--ink)}

/* Body & Grid */
.pw-exec-body{border-top:1px solid var(--line);padding:22px;background:#0d1118;display:flex;flex-direction:column;gap:20px}
.pw-exec-topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px dashed var(--line)}
.pw-exec-dimension-badges{display:flex;gap:8px;flex-wrap:wrap}
.pw-dim-badge{font-size:.78rem;font-weight:700;padding:4px 10px;border-radius:20px;background:rgba(255,255,255,.06);color:#cbd5e1}
.pw-dim-badge.is-verified{background:rgba(16,185,129,.14);color:#6ee7b7;border:1px solid rgba(52,211,153,.35)}
.pw-exec-goto-ck{background:#141a23;border:1px solid var(--line);border-radius:8px;padding:6px 14px;font-size:.84rem;font-weight:700;color:var(--ink-2);cursor:pointer;transition:all .15s}
.pw-exec-goto-ck:hover{border-color:var(--o);color:var(--o-hi);background:var(--o-soft)}

.pw-exec-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
.pw-exec-block{background:#141a23;border:1px solid var(--line);border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.pw-exec-block.full-width{grid-column:1 / -1}
.pw-block-head{display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--line);padding-bottom:8px}
.pw-block-icon{font-size:1.15rem}
.pw-block-head h4{font-size:.98rem;font-weight:800;color:var(--ink)}
.pw-block-intro{font-size:.9rem;color:var(--ink-2);line-height:1.6}

.pw-exec-checklist{display:flex;flex-direction:column;gap:8px;margin:0;padding:0}
.pw-exec-checklist li{display:flex;align-items:flex-start;gap:10px;font-size:.88rem;line-height:1.65;color:var(--ink)}
.pw-dot{flex-shrink:0;width:8px;height:8px;border-radius:50%;background:var(--o);margin-top:8px}
.pw-dot-blue{background:#38bdf8}
.pw-dot-amber{background:#fbbf24}
.pw-dot-red{background:#f87171}
.pw-dot-green{background:#34d399}

.pw-mockup-notice{background:rgba(245,158,11,.12);border:1px solid rgba(251,191,36,.32);border-radius:8px;padding:8px 12px;font-size:.84rem;color:#fde68a;line-height:1.6}
.pw-calc-box{background:var(--tint);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;font-size:.88rem}
.pw-calc-formula{background:#0b0e13;border:1px solid var(--line);padding:6px 10px;border-radius:6px;font-family:Consolas,monospace;font-size:.85rem;color:#e2e8f0;direction:ltr;text-align:left;display:block}
.pw-rates-list,.pw-rules-box,.pw-tolerances-box{display:flex;flex-direction:column;gap:6px;font-size:.86rem}
.pw-rates-list ul,.pw-rules-box ul,.pw-tolerances-box ul,.pw-rejection-box ul{padding-inline-start:18px;display:flex;flex-direction:column;gap:4px;list-style:disc;color:var(--ink-2)}
.pw-calc-footer{font-size:.86rem;padding-top:6px;border-top:1px dashed var(--line)}
.pw-rejection-box{background:rgba(239,68,68,.12);border:1px solid rgba(248,113,113,.3);border-radius:8px;padding:10px 12px;font-size:.84rem;color:#fecaca}
.pw-tool-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.pw-tool-tag{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:3px 8px;font-size:.8rem;color:#cbd5e1}

/* Steps Timeline */
.pw-steps-timeline{display:flex;flex-direction:column;gap:12px;position:relative;padding-inline-start:8px}
.pw-timeline-step{display:flex;gap:14px;align-items:flex-start;position:relative}
.pw-step-number{flex-shrink:0;width:30px;height:30px;border-radius:50%;background:var(--o);color:#fff;font-weight:800;font-size:.86rem;display:grid;place-items:center;box-shadow:0 2px 8px rgba(201,119,45,.35)}
.pw-step-content{flex:1;background:#0e131b;border:1px solid var(--line);border-radius:10px;padding:10px 14px}
.pw-step-content h5{font-size:.92rem;font-weight:800;color:var(--ink);margin-bottom:4px}
.pw-step-content p{font-size:.86rem;color:var(--ink-2);line-height:1.6}

/* Workflow Steps */
.pw-workflow-steps{display:flex;flex-direction:column;gap:8px}
.pw-wf-step{display:flex;gap:10px;align-items:flex-start;background:#0e131b;border:1px solid var(--line);border-radius:8px;padding:8px 10px}
.pw-wf-no{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:#0284c7;color:#fff;font-weight:700;font-size:.75rem;display:grid;place-items:center}
.pw-wf-step p{font-size:.85rem;color:var(--ink);line-height:1.5}
.pw-wf-code{display:flex;align-items:center;gap:8px;font-size:.84rem;margin-top:6px}
.pw-wf-code code{background:rgba(56,189,248,.16);color:#bae6fd;padding:2px 8px;border-radius:6px;font-family:monospace;font-weight:700}

/* Pricing Table */
.pw-pricing-table{display:flex;flex-direction:column;gap:8px;background:#0e131b;border:1px solid var(--line);border-radius:10px;padding:12px}
.pw-price-row{display:flex;justify-content:space-between;align-items:center;font-size:.88rem;padding-bottom:6px;border-bottom:1px dashed rgba(255,255,255,.1)}
.pw-price-row.is-total{border-bottom:none;padding-top:4px;font-size:.95rem}
.pw-rate-highlight{font-size:1.1rem;font-weight:800;color:#6ee7b7}
.pw-pricing-meta{display:flex;flex-direction:column;gap:6px;font-size:.82rem}
.pw-price-notes{color:var(--ink-2);line-height:1.5}
.pw-price-date-tag{color:#7dd3fc;background:rgba(14,165,233,.14);border:1px solid rgba(56,189,248,.3);border-radius:6px;padding:4px 8px;align-self:flex-start}

/* Applied Project Banner */
.pw-applied-banner{background:linear-gradient(145deg,#171c25 0%,#12161e 100%);border:1.5px solid rgba(201,119,45,.36);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:16px;box-shadow:0 12px 28px rgba(0,0,0,.28)}
.pw-applied-head{display:flex;gap:12px;align-items:center;border-bottom:1px solid rgba(201,119,45,.22);padding-bottom:12px}
.pw-applied-icon{font-size:1.8rem}
.pw-applied-head h4{font-size:1.05rem;font-weight:800;color:#f3a85b}
.pw-applied-sub{font-size:.84rem;color:#cbd5e1}
.pw-applied-jo code{background:rgba(201,119,45,.2);color:#fed7aa;padding:2px 6px;border-radius:4px;font-weight:700}
.pw-applied-story p{font-size:.92rem;line-height:1.75;color:var(--ink);background:#0d1118;border:1px solid rgba(201,119,45,.24);border-radius:10px;padding:12px 14px}
.pw-applied-challenges h5{font-size:.9rem;font-weight:800;color:#f3a85b;margin-bottom:8px}
.pw-challenges-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.pw-challenge-card{background:#0d1118;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.pw-ch-q,.pw-ch-a{display:flex;flex-direction:column;gap:3px;font-size:.84rem}
.pw-ch-tag{align-self:flex-start;font-size:.72rem;font-weight:800;background:rgba(239,68,68,.18);color:#fca5a5;padding:1px 6px;border-radius:4px}
.pw-ch-tag.is-sol{background:rgba(16,185,129,.18);color:#6ee7b7}
.pw-applied-metric{display:flex;align-items:center;gap:10px;background:#0d1118;border:1.5px dashed rgba(224,141,60,.45);border-radius:10px;padding:10px 14px;font-size:.88rem;color:#fed7aa}
.pw-metric-icon{font-size:1.25rem}

.pw-ck-card-btn{margin-top:10px;display:inline-flex;align-items:center;gap:6px;background:var(--o-soft);border:1px solid rgba(201,119,45,.55);color:#f3a85b;padding:5px 12px;border-radius:8px;font-size:.83rem;font-weight:700;cursor:pointer;transition:all .15s}
.pw-ck-card-btn:hover{background:var(--o);color:#fff}

@media (max-width:900px){
  .pw-exec-grid{grid-template-columns:1fr}
  .pw-exec-card-header{flex-direction:column;align-items:flex-start}
  .pw-exec-header-right{width:100%;justify-content:space-between}
}

/* ===== تنسيق موحّد: رؤوس الأقسام، الحاويات، الكروت، والتوازن العام ===== */
.pw{--pw-radius:20px;--pw-gap:24px;--pw-pad-y:88px}
.pw-section{padding:var(--pw-pad-y) 0}
/* تبادل خلفيات الأقسام بانتظام بطبقات أوبسيديان الداكنة */
.pw .pw-section.pw-tint{background:#0b0e13;border-block:0}
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
.pw-trust li,.pw-trust li:first-child,.pw-trust li:nth-child(n),.pw-steps li{background:#141a23;border:1px solid var(--line);border-radius:var(--pw-radius);padding:28px 24px;height:100%}
.pw-trust li:hover,.pw-steps li:hover{border-color:rgba(201,119,45,.45);box-shadow:0 18px 38px -26px rgba(201,119,45,.32)}
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

/* ===== بوابة الأقسام الستة الرئيسية ومستكشف القسم والمنتجات التفاعلية ===== */
.pw-portal-gateway{padding-top:52px!important;padding-bottom:54px!important;background:radial-gradient(820px 420px at 82% 0%,rgba(201,119,45,.08),transparent 70%),linear-gradient(180deg,#0b0e13 0%,#10151d 100%)!important;border-bottom:1px solid var(--line)}
.pw-portal-main-h1{font-size:clamp(1.6rem,3.1vw,2.35rem);font-weight:900;line-height:1.3;margin-bottom:10px;color:var(--ink)}
.pw-guide-banner{background:#141a23;border:1.5px solid rgba(201,119,45,.32);border-radius:18px;padding:16px 20px;margin-bottom:24px;display:flex;flex-direction:column;gap:12px;box-shadow:0 16px 32px -20px rgba(0,0,0,.55)}
.pw-guide-steps{display:flex;flex-wrap:wrap;gap:10px 22px;font-size:.86rem;color:var(--ink-2);padding-bottom:10px;border-bottom:1px dashed rgba(201,119,45,.24)}
.pw-guide-steps strong{color:var(--o-hi);font-weight:900;margin-inline-end:4px}
.pw-guide-intents{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.pw-guide-intents-label{font-size:.86rem;font-weight:900;color:var(--ink)}
.pw-guide-chips{display:flex;flex-wrap:wrap;gap:8px}
.pw-guide-chip{padding:7px 14px;border-radius:999px;border:1.5px solid var(--line);background:#0d1118;color:var(--ink);font-size:.82rem;font-weight:800;cursor:pointer;transition:all .16s ease}
.pw-guide-chip:hover,.pw-guide-chip.is-active{background:var(--portal-accent,var(--o));border-color:var(--portal-accent,var(--o));color:#fff;box-shadow:0 8px 18px -10px rgba(0,0,0,.45)}
.pw-portal-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.pw-portal-card{text-align:start;background:#141a23;border:1.5px solid var(--line);border-radius:20px;padding:22px 20px;display:flex;flex-direction:column;gap:10px;cursor:pointer;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;position:relative}
.pw-portal-card:hover{transform:translateY(-4px);border-color:var(--portal-accent,var(--o));box-shadow:0 20px 42px -24px rgba(0,0,0,.6)}
.pw-portal-card.is-active{border-color:var(--portal-accent,var(--o));background:linear-gradient(180deg,#18202c 0%,#141a23 100%);box-shadow:0 18px 40px -20px rgba(201,119,45,.28)}
.pw-portal-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.pw-portal-icon{width:48px;height:48px;border-radius:14px;background:var(--o-soft);display:grid;place-items:center;font-size:1.55rem;flex-shrink:0}
.pw-portal-card.is-active .pw-portal-icon{background:var(--portal-accent,var(--o));color:#fff}
.pw-portal-badge{font-size:.74rem;font-weight:800;color:var(--ink-2);background:#0d1118;border:1px solid var(--line);border-radius:999px;padding:4px 10px;margin-inline-end:auto}
.pw-portal-num{font-size:.82rem;font-weight:900;color:var(--o-hi);opacity:.85}
.pw-portal-card h3{font-size:1.22rem;font-weight:900;color:var(--ink)}
.pw-portal-hint-box{background:#0d1118;border-inline-start:3px solid var(--portal-accent,var(--o));border-radius:10px;padding:8px 11px;display:flex;flex-direction:column;gap:2px}
.pw-portal-hint-box strong{font-size:.77rem;font-weight:900;color:var(--o-hi)}
.pw-portal-hint-box span{font-size:.81rem;color:var(--ink);line-height:1.5;font-weight:600}
.pw-portal-desc{font-size:.87rem;color:var(--ink-2);line-height:1.55}
.pw-portal-list{display:flex;flex-direction:column;gap:5px;margin-top:2px;padding-top:10px;border-top:1px solid var(--line);font-size:.82rem;color:var(--ink)}
.pw-portal-list li{display:flex;align-items:flex-start;gap:7px}
.pw-portal-dot{color:var(--portal-accent,var(--o));font-weight:900}
.pw-portal-cta{margin-top:auto;padding:10px 14px;border-radius:12px;background:var(--o-soft);display:flex;align-items:center;justify-content:space-between;font-weight:900;font-size:.85rem;color:#f3a85b;transition:background .16s ease,color .16s ease}
.pw-portal-card.is-active .pw-portal-cta,.pw-portal-card:hover .pw-portal-cta{background:var(--portal-accent,var(--o));color:#fff}

/* الأعمدة البانورامية المتصلة والتفاعلية على الصفحة الرئيسية */
.pw-split-stage{position:relative;width:100%;height:480px;border-radius:22px;overflow:hidden;background:#0c1016;border:1px solid rgba(255,255,255,.12);box-shadow:0 32px 68px -34px rgba(10,14,20,.58)}
.pw-split-backdrop{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.pw-split-bg-base,.pw-split-bg-layer{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;will-change:transform,opacity}
.pw-split-bg-base{opacity:1;transform:scale(1.02) translate3d(calc(var(--stage-mx,0) * -6px),calc(var(--stage-my,0) * -4px),0);transition:opacity .55s cubic-bezier(.22,1,.36,1),transform .75s cubic-bezier(.22,1,.36,1)}
.pw-split-bg-base.is-faded{opacity:0}
.pw-split-bg-layer{opacity:0;transform:scale(1.06) translate3d(calc(var(--stage-mx,0) * -10px),calc(var(--stage-my,0) * -6px),0);transition:opacity .55s cubic-bezier(.22,1,.36,1),transform .85s cubic-bezier(.22,1,.36,1)}
.pw-split-bg-layer.is-visible{opacity:1;transform:scale(1.04) translate3d(calc(var(--stage-mx,0) * -10px),calc(var(--stage-my,0) * -6px),0)}
.pw-split-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,14,18,.26) 0%,rgba(10,14,18,.38) 44%,rgba(10,14,18,.84) 100%)}
.pw-split-cursor-glow{position:absolute;inset:0;opacity:0;transition:opacity .3s ease;mix-blend-mode:screen;background:radial-gradient(360px circle at var(--stage-px,50%) var(--stage-py,50%),color-mix(in srgb,var(--stage-accent,#c75517) 36%,rgba(255,255,255,.16)),transparent 70%)}
.pw-split-stage.has-active .pw-split-cursor-glow{opacity:1}
.pw-split-cols{position:relative;z-index:2;display:flex;flex-direction:row;width:100%;height:100%}
.pw-split-col{position:relative;flex:1 1 0%;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;padding:28px 16px 42px;text-align:center;text-decoration:none;color:#fff;border-inline-end:1px solid rgba(255,255,255,.34);overflow:hidden;transition:flex .54s cubic-bezier(.22,1,.36,1),background-color .38s ease,padding .38s ease}
.pw-split-col:last-child{border-inline-end:none}
.pw-split-col.is-active{flex:2.35 1 0%;padding:30px 26px 36px;background:linear-gradient(180deg,rgba(10,14,18,.04) 0%,rgba(10,14,18,.34) 54%,rgba(10,14,18,.82) 100%)}
.pw-split-cols.has-active .pw-split-col:not(.is-active){flex:.73 1 0%;background:rgba(8,12,18,.48)}
.pw-split-col-inner{display:flex;flex-direction:column;align-items:center;gap:10px;position:relative;z-index:2;width:100%}
.pw-split-num{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;background:rgba(255,255,255,.12);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.26);font-size:.74rem;font-weight:900;letter-spacing:.04em;color:rgba(255,255,255,.94);transition:background .25s ease,border-color .25s ease,transform .28s ease}
.pw-split-col.is-active .pw-split-num{background:var(--col-accent,var(--o));border-color:rgba(255,255,255,.45);transform:translateY(-2px)}
.pw-split-col h2{font-size:clamp(.98rem,1.3vw,1.22rem);font-weight:900;line-height:1.38;color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.58);transition:font-size .32s ease,opacity .28s ease}
.pw-split-col.is-active h2{font-size:clamp(1.2rem,1.75vw,1.52rem)}
.pw-split-cols.has-active .pw-split-col:not(.is-active) h2{font-size:.9rem;opacity:.76}
.pw-split-reveal{max-height:0;opacity:0;overflow:hidden;transform:translateY(14px);display:flex;flex-direction:column;align-items:center;gap:12px;pointer-events:none;transition:max-height .45s cubic-bezier(.22,1,.36,1),opacity .32s ease,transform .38s cubic-bezier(.22,1,.36,1)}
.pw-split-col.is-active .pw-split-reveal{max-height:230px;opacity:1;transform:translateY(0);margin-top:2px}
.pw-split-hint{font-size:.87rem;line-height:1.6;color:rgba(255,255,255,.9);max-width:34ch;text-shadow:0 1px 10px rgba(0,0,0,.6)}
.pw-split-tags{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}
.pw-split-tag{font-size:.72rem;font-weight:800;color:rgba(255,255,255,.94);background:rgba(15,20,25,.58);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:3px 10px}
.pw-split-cta{margin-top:2px;display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:999px;background:var(--col-accent,var(--o));color:#fff;font-size:.85rem;font-weight:900;box-shadow:0 10px 24px -10px rgba(0,0,0,.6)}
.pw-split-mobile-cue{display:none}
.pw-split-bar{position:absolute;inset:auto 0 0;height:4px;background:var(--col-accent,var(--o));transform:scaleX(0);transform-origin:center;transition:transform .36s cubic-bezier(.22,1,.36,1);z-index:3}
.pw-split-col.is-active .pw-split-bar{transform:scaleX(1)}

/* الأداة السريعة المبسطة */
.pw-quick-finder{background:#141a23;border:1.5px solid rgba(201,119,45,.32);border-radius:22px;padding:24px;display:flex;flex-direction:column;gap:16px}
.pw-quick-finder-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:14px}
.pw-quick-finder-head h2{font-size:clamp(1.25rem,2.4vw,1.7rem);font-weight:900}
.pw-quick-finder-controls{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between}
.pw-quick-finder-result{background:var(--o-soft);border:1px solid rgba(201,119,45,.36);border-radius:14px;padding:12px 16px;font-weight:800;font-size:.94rem;color:#fed7aa}

/* رأس موحّد للصفحات العامة يطابق الهوية الداكنة */
.pw-unified-hero{position:relative;background:radial-gradient(900px 440px at 80% 0%,rgba(201,119,45,.12),transparent 70%),linear-gradient(180deg,#10151d 0%,#0b0e13 100%);padding:98px 0 36px;border-bottom:1px solid var(--line)}
.pw-unified-crumb{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;font-size:.82rem;font-weight:700;color:var(--ink-2);margin-bottom:14px}
.pw-unified-crumb a{color:var(--ink-2);transition:color .16s}
.pw-unified-crumb a:hover{color:var(--o-hi)}
.pw-unified-crumb .sep{opacity:.45}
.pw-unified-promo{background:linear-gradient(90deg,rgba(201,119,45,.16),rgba(201,119,45,.08),rgba(56,189,248,.1));border:1px solid rgba(201,119,45,.32);border-radius:14px;padding:9px 16px;text-align:center;color:#fed7aa;font-weight:800;font-size:.83rem;margin:0 auto 20px;max-width:56rem}
.pw-sec-hero-split{display:grid;grid-template-columns:1.15fr .85fr;gap:28px;align-items:center}
.pw-sec-hero-split .pw-head{text-align:start;margin:0;max-width:none}
.pw-sec-hero-split .pw-unified-crumb{justify-content:flex-start}
.pw-sec-hero-visual{position:relative;border-radius:20px;overflow:hidden;aspect-ratio:16/9;background:#0d1118;border:1.5px solid rgba(255,255,255,.12);box-shadow:0 22px 44px -24px rgba(0,0,0,.65)}
.pw-sec-hero-visual img{width:100%;height:100%;object-fit:cover;display:block}
.pw-sec-hero-badge{position:absolute;top:12px;inset-inline-end:12px;padding:4px 12px;border-radius:999px;background:rgba(10,14,20,.78);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fff;font-size:.78rem;font-weight:900;border:1px solid rgba(255,255,255,.22)}

/* صفحة القسم المخصصة */
.pw-section-page{min-height:80vh;background:#0b0e13}
.pw-sec-hero{background:radial-gradient(900px 440px at 80% 0%,rgba(201,119,45,.12),transparent 70%),linear-gradient(180deg,#10151d 0%,#0b0e13 100%);border-bottom:1px solid var(--line);padding:98px 0 36px}
.pw-sec-breadcrumb{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--line)}
.pw-back-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:12px;background:rgba(255,255,255,.08);border:1px solid var(--line);color:#f1f5f9;font-size:.86rem;font-weight:800;transition:background .16s,border-color .16s}
.pw-back-btn:hover{background:var(--o);border-color:var(--o);color:#fff}
.pw-sec-hops{display:flex;flex-wrap:wrap;gap:6px}
.pw-sec-hop{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:#141a23;font-size:.8rem;font-weight:800;color:var(--ink-2)}
.pw-sec-hop.is-current{background:var(--o-soft);border-color:var(--o);color:#fed7aa}
.pw-sec-title-row{display:flex;align-items:center;gap:16px}
.pw-sec-big-icon{width:64px;height:64px;border-radius:18px;background:var(--o-soft);display:grid;place-items:center;font-size:2.1rem;flex-shrink:0}
.pw-sec-kicker{display:block;font-size:.78rem;font-weight:900;color:var(--o-hi);margin-bottom:2px}
.pw-sec-title-row h1{font-size:clamp(1.45rem,2.8vw,2.1rem);font-weight:900;margin-bottom:4px}
.pw-sec-title-row p{font-size:.96rem;color:var(--ink-2)}
.pw-sec-content{padding-top:30px;padding-bottom:64px}

.pw-explorer-switcher{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}
.pw-explorer-pill{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:999px;border:1.5px solid var(--line);background:#141a23;color:var(--ink-2);font-weight:800;font-size:.88rem;cursor:pointer;transition:all .16s ease}
.pw-explorer-pill:hover{border-color:var(--o);color:var(--ink)}
.pw-explorer-pill.is-active{background:linear-gradient(135deg,var(--o) 0%,var(--o-hi) 100%);border-color:var(--o-hi);color:#fff;box-shadow:0 8px 20px -10px rgba(201,119,45,.55)}

.pw-explorer-header{background:#141a23;border:1px solid var(--line);border-radius:20px;padding:24px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px}
.pw-explorer-title-group{display:flex;align-items:flex-start;gap:14px;max-width:44rem}
.pw-explorer-hero-icon{width:56px;height:56px;border-radius:16px;background:var(--o-soft);display:grid;place-items:center;font-size:1.8rem;flex-shrink:0}
.pw-explorer-kicker{display:block;font-size:.76rem;font-weight:800;color:var(--o-hi);margin-bottom:2px}
.pw-explorer-header h2{font-size:clamp(1.3rem,2.4vw,1.8rem);font-weight:900;margin-bottom:4px}
.pw-explorer-header p{font-size:.93rem;color:var(--ink-2)}
.pw-explorer-quick-links{display:flex;flex-wrap:wrap;gap:10px;align-items:center}

.pw-chip-bar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
.pw-mnt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.pw-mnt-card{background:#141a23;border:1px solid var(--line);border-radius:20px;padding:22px;display:flex;flex-direction:column;gap:14px}
.pw-mnt-card-head{display:flex;align-items:flex-start;gap:12px}
.pw-mnt-icon{width:46px;height:46px;border-radius:12px;background:var(--o-soft);display:grid;place-items:center;font-size:1.45rem;flex-shrink:0}
.pw-mnt-code{display:block;font-size:.75rem;font-weight:800;color:var(--o-hi);margin-bottom:2px}
.pw-mnt-card-head h3{font-size:1.08rem;font-weight:900}
.pw-mnt-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pw-mnt-box{background:#0d1118;border:1px solid var(--line);border-radius:12px;padding:12px;font-size:.83rem}
.pw-mnt-box strong{display:block;margin-bottom:6px;font-weight:800;color:var(--ink)}
.pw-mnt-box ul{display:flex;flex-direction:column;gap:5px;color:var(--ink-2)}
.pw-mnt-box li::before{content:'• ';color:var(--o-hi);font-weight:900}
.pw-mnt-tip{background:rgba(201,119,45,.12);border:1px solid rgba(201,119,45,.32);border-radius:12px;padding:11px 14px;font-size:.84rem;color:#fed7aa;line-height:1.6}
.pw-mnt-tip strong{color:#f3a85b}
.pw-mnt-foot{margin-top:auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding-top:10px;border-top:1px solid var(--line)}
.pw-mnt-warranty{font-size:.78rem;font-weight:800;color:#7dd3fc;background:rgba(14,165,233,.14);border:1px solid rgba(56,189,248,.32);border-radius:999px;padding:4px 10px}
.pw-mnt-actions{display:flex;gap:8px;flex-wrap:wrap}

.pw-calc-box{background:#141a23;border:1.5px solid var(--line);border-radius:22px;padding:24px}
.pw-calc-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:18px}
.pw-calc-head h3{font-size:1.25rem;font-weight:900}
.pw-calc-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:24px;align-items:stretch}
.pw-calc-controls{display:flex;flex-direction:column;gap:16px}
.pw-calc-sliders{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.pw-calc-scopes{display:flex;flex-wrap:wrap;gap:8px}
.pw-scope-toggle{display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border-radius:12px;border:1.5px solid var(--line);background:#0d1118;color:var(--ink);font-size:.86rem;font-weight:800;cursor:pointer}
.pw-scope-toggle.is-on{background:var(--o-soft);border-color:var(--o);color:#fed7aa}
.pw-calc-summary{background:#0d1118;border:1px solid var(--line);border-radius:18px;padding:20px;display:flex;flex-direction:column;justify-content:space-between;gap:14px}
.pw-calc-summary-top{display:flex;flex-direction:column;gap:4px}
.pw-calc-summary-top span{font-size:.84rem;color:var(--ink-2);font-weight:700}
.pw-calc-summary-top strong{font-size:1.7rem;font-weight:900;color:var(--o-hi)}
.pw-discount-pill{display:inline-block;align-self:flex-start;background:rgba(16,185,129,.16)!important;color:#6ee7b7!important;border:1px solid rgba(52,211,153,.35);border-radius:8px;padding:4px 10px;font-size:.78rem!important;font-weight:800;margin-top:4px}
.pw-calc-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.pw-calc-metrics>div{background:#141a23;border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}
.pw-calc-metrics small{font-size:.74rem;color:var(--ink-2);font-weight:700}
.pw-calc-metrics strong{font-size:1rem;font-weight:900;color:var(--ink)}

.pw-re-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.pw-re-card{background:#141a23;border:1px solid var(--line);border-radius:20px;padding:22px;display:flex;flex-direction:column;justify-content:space-between;gap:14px}
.pw-re-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.pw-re-hot{display:inline-block;font-size:.75rem;font-weight:800;color:#fed7aa;background:rgba(201,119,45,.18);border:1px solid rgba(224,141,60,.4);border-radius:999px;padding:3px 10px;margin-bottom:6px}
.pw-re-card h3{font-size:1.12rem;font-weight:900;margin-bottom:4px}
.pw-re-sub{font-size:.86rem;color:var(--ink-2);margin-bottom:12px}
.pw-re-specs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px}
.pw-re-specs>div{background:#0d1118;border:1px solid var(--line);border-radius:10px;padding:8px 10px;display:flex;flex-direction:column}
.pw-re-specs small{font-size:.72rem;color:var(--ink-2);font-weight:700}
.pw-re-specs strong{font-size:.86rem;font-weight:800;color:var(--ink)}
.pw-re-features{display:flex;flex-direction:column;gap:5px;font-size:.84rem;color:var(--ink-2)}
.pw-re-foot{display:flex;flex-direction:column;gap:10px;padding-top:12px;border-top:1px solid var(--line)}
.pw-re-terms{font-size:.8rem;font-weight:800;color:#7dd3fc}

.pw-materials-highlight{background:linear-gradient(135deg,rgba(201,119,45,.15) 0%,#141a23 100%);border:1.5px solid rgba(201,119,45,.36);border-radius:16px;padding:16px 18px;margin-bottom:18px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}
.pw-materials-highlight strong{display:block;font-size:.95rem;color:#f3a85b;margin-bottom:3px}
.pw-materials-highlight span{display:block;font-size:.84rem;color:#fed7aa;line-height:1.55}

.pw-prod-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.pw-prod-card{background:#141a23;border:1px solid var(--line);border-radius:18px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;gap:12px;transition:transform .18s,border-color .18s,box-shadow .18s}
.pw-prod-card:hover{transform:translateY(-3px);border-color:rgba(201,119,45,.55);box-shadow:0 16px 32px -22px rgba(0,0,0,.6)}
.pw-prod-top{display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.pw-prod-code{font-family:ui-monospace,Consolas,monospace;font-size:.72rem;font-weight:800;color:var(--ink-2);background:#0d1118;padding:2px 8px;border-radius:6px}
.pw-prod-badge{font-size:.72rem;font-weight:800;color:#fed7aa;background:var(--o-soft);padding:2px 8px;border-radius:999px}
.pw-prod-card h3{font-size:.98rem;font-weight:900;line-height:1.45;margin-bottom:6px}
.pw-prod-desc{font-size:.82rem;color:var(--ink-2);line-height:1.55;margin-bottom:8px}
.pw-prod-specs{display:flex;flex-direction:column;gap:4px;font-size:.78rem;color:var(--ink-2)}
.pw-prod-foot{display:flex;flex-direction:column;gap:8px;padding-top:10px;border-top:1px solid var(--line)}
.pw-prod-install-check{display:flex;align-items:center;gap:7px;font-size:.8rem;font-weight:800;color:var(--ink);cursor:pointer}
.pw-prod-actions{display:flex;gap:8px;align-items:center}

.pw-info-shortcuts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.pw-info-shortcut-card{background:#141a23;border:1.5px solid var(--line);border-radius:16px;padding:16px;display:flex;align-items:center;gap:12px;transition:border-color .18s,transform .18s}
.pw-info-shortcut-card:hover{border-color:var(--o);transform:translateY(-2px)}
.pw-info-shortcut-card>span{font-size:1.75rem;flex-shrink:0}
.pw-info-shortcut-card strong{display:block;font-size:.96rem;font-weight:900;color:var(--ink)}
.pw-info-shortcut-card small{font-size:.8rem;color:var(--ink-2)}
.pw-tips-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.pw-tip-card{background:#141a23;border:1px solid var(--line);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:8px}
.pw-tip-tag{align-self:flex-start;font-size:.74rem;font-weight:800;color:#fed7aa;background:var(--o-soft);border-radius:999px;padding:3px 10px}
.pw-tip-card h4{font-size:1rem;font-weight:900}
.pw-tip-card p{font-size:.86rem;color:var(--ink-2);line-height:1.65}
.pw-info-meta-row{display:flex;flex-wrap:wrap;gap:18px;margin-top:22px}

.pw-advisor-shell{background:linear-gradient(135deg,#171c25 0%,#12161e 100%);border:1.5px solid rgba(201,119,45,.36);border-radius:24px;padding:30px;display:grid;grid-template-columns:1.1fr 1fr;gap:28px;align-items:center;box-shadow:0 24px 48px -32px rgba(0,0,0,.6)}
.pw-advisor-right{background:#0d1118;border:1px solid var(--line);border-radius:18px;padding:22px}
.pw-advisor-right h3{font-size:1.25rem;font-weight:900;margin:6px 0}
.pw-advisor-duration{font-size:.9rem;color:var(--ink-2);margin-bottom:14px}
.pw-advisor-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:14px}
.pw-advisor-metrics>div{background:#141a23;border:1px solid var(--line);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:2px}
.pw-advisor-metrics small{font-size:.73rem;color:var(--ink-2);font-weight:700}
.pw-advisor-metrics strong{font-size:.92rem;font-weight:900;color:var(--o-hi)}

.pw-offers-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.pw-offer-card{background:#141a23;border:1px solid var(--line);border-radius:20px;padding:22px;display:flex;flex-direction:column;justify-content:space-between;gap:16px}
.pw-offer-card.is-highlight{border-color:rgba(201,119,45,.55);background:linear-gradient(180deg,#1a212d 0%,#141a23 100%)}
.pw-offer-card h3{font-size:1.12rem;font-weight:900;margin-bottom:6px}
.pw-offer-card p{font-size:.87rem;color:var(--ink-2);margin-bottom:12px}
.pw-offer-actions{display:flex;flex-wrap:wrap;gap:8px}

/* شريط آخر الأخبار المتحرك في الشاشة الرئيسية */
.phi-ticker-bar{display:flex;align-items:center;gap:12px;margin:0 auto 24px;padding:7px 10px 7px 8px;border-radius:16px;background:linear-gradient(90deg,rgba(19,24,33,.94) 0%,rgba(28,22,18,.95) 50%,rgba(19,24,33,.94) 100%);border:1px solid rgba(201,119,45,.28);box-shadow:0 16px 32px -20px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.06);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);overflow:hidden}
.phi-ticker-badge{display:inline-flex;align-items:center;gap:7px;flex-shrink:0;padding:5px 12px;border-radius:11px;background:linear-gradient(135deg,#c9772d 0%,#e08d3c 100%);color:#fff;font-size:.78rem;font-weight:900;letter-spacing:.01em;box-shadow:0 6px 16px -8px rgba(201,119,45,.65)}
.phi-ticker-dot{width:7px;height:7px;border-radius:50%;background:#fff;box-shadow:0 0 0 0 rgba(255,255,255,.75);animation:phiTickerPulse 1.8s infinite!important;animation-duration:1.8s!important;animation-iteration-count:infinite!important}
@keyframes phiTickerPulse{0%{box-shadow:0 0 0 0 rgba(255,255,255,.75)}70%{box-shadow:0 0 0 6px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
.phi-ticker-viewport{position:relative;flex:1;min-width:0;direction:ltr;text-align:left;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 22px,#000 calc(100% - 22px),transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 22px,#000 calc(100% - 22px),transparent 100%)}
.phi-ticker-track{display:flex;flex-direction:row;align-items:center;width:max-content;direction:ltr;will-change:transform}
.phi-ticker-group{display:flex;flex-direction:row;align-items:center;gap:14px;padding-inline-end:14px;flex-shrink:0}
.phi-ticker-item{display:inline-flex;align-items:center;gap:8px;direction:rtl;white-space:nowrap;font-size:.86rem;font-weight:800;color:var(--ink);padding:3px 6px;border-radius:9px;transition:color .16s,background .16s}
.phi-ticker-item.is-link:hover{color:var(--o-hi);background:rgba(201,119,45,.14)}
.phi-ticker-tag{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;background:var(--o-soft);border:1px solid rgba(201,119,45,.34);color:#fed7aa;font-size:.73rem;font-weight:900}
.phi-ticker-text{line-height:1.45}
.phi-ticker-sep{color:var(--o-hi);font-size:.76rem;opacity:.75;flex-shrink:0}
.phi-ticker-toggle{flex-shrink:0;width:28px;height:28px;border-radius:9px;border:1px solid var(--line);background:#141a23;color:var(--ink-2);display:grid;place-items:center;font-size:.7rem;font-weight:900;cursor:pointer;transition:border-color .16s,color .16s,background .16s}
.phi-ticker-toggle:hover{border-color:var(--o);color:var(--o-hi);background:var(--o-soft)}
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
  .pw-split-stage{height:auto;min-height:450px;border-radius:20px}
  .pw-split-cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
  .pw-split-col{min-height:225px;padding:22px 14px;justify-content:center;border-inline-end:1px solid rgba(255,255,255,.28);border-bottom:1px solid rgba(255,255,255,.28)}
  .pw-split-col:nth-child(3n){border-inline-end:none}
  .pw-split-col:nth-child(n+4){border-bottom:none}
  .pw-split-col.is-active{padding:22px 16px}
  .pw-split-mobile-cue{display:inline-flex;align-items:center;gap:4px;font-size:.74rem;font-weight:800;color:rgba(255,255,255,.82);margin-top:2px}
  .pw-split-col.is-active .pw-split-mobile-cue{display:none}
  .pw-sec-hero-split{grid-template-columns:1fr;gap:20px}
  .pw-sec-hero-split .pw-head{text-align:center}
  .pw-sec-hero-split .pw-unified-crumb{justify-content:center}
}
@media (max-width:760px){
  .pw-portal-grid,.pw-mnt-grid,.pw-mnt-cols,.pw-re-grid,.pw-prod-grid,.pw-info-shortcuts,.pw-tips-grid,.pw-offers-grid,.pw-calc-metrics,.pw-advisor-metrics{grid-template-columns:1fr}
  .pw-explorer-header,.pw-calc-box,.pw-advisor-shell,.pw-quick-finder{padding:16px}
  .pw-portal-gateway{padding-top:36px!important;padding-bottom:36px!important}
  .pw-unified-hero,.pw-sec-hero{padding:86px 0 28px}
}
@media (max-width:600px){
  .pw-split-stage{min-height:495px;border-radius:18px}
  .pw-split-cols{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pw-split-col{min-height:165px;padding:16px 12px;border-inline-end:1px solid rgba(255,255,255,.28);border-bottom:1px solid rgba(255,255,255,.28)}
  .pw-split-col:nth-child(3n){border-inline-end:1px solid rgba(255,255,255,.28)}
  .pw-split-col:nth-child(2n){border-inline-end:none}
  .pw-split-col:nth-child(n+4){border-bottom:1px solid rgba(255,255,255,.28)}
  .pw-split-col:nth-child(n+5){border-bottom:none}
  .pw-split-col h2{font-size:.95rem}
  .pw-split-reveal{display:none}
}
@media (prefers-reduced-motion:reduce){
  .pw-split-col,.pw-split-bg-base,.pw-split-bg-layer,.pw-split-reveal,.pw-split-bar,.pw-split-num{transition:none!important;animation:none!important;transform:none!important}
}
`;
