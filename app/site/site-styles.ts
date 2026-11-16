export const CSS = `
.pw{--o:#c75517;--o-hi:#f97316;--o-dark:#a84511;--o-soft:#fff3ea;--ink:#14181b;--ink-2:#47525c;--line:#e3e6e9;--bg:#fff;--tint:#f6f5f3;--g1:#161b1f;--g2:#0e1215;
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
.pw-header.pw-header-glass{margin-bottom:0!important;background:rgba(255,255,255,.45)!important;backdrop-filter:blur(18px) saturate(165%)!important;-webkit-backdrop-filter:blur(18px) saturate(165%)!important;border-bottom:1px solid rgba(20,24,27,.08)!important;box-shadow:none!important}
.pw-header.pw-header-glass.is-scrolled{background:rgba(255,255,255,.72)!important;box-shadow:0 8px 28px -14px rgba(20,24,27,.16)!important}
.pw-header.pw-header-glass .pw-brand-text strong{color:#14181b!important;text-shadow:none!important}
.pw-header.pw-header-glass .pw-brand-mark{filter:none!important}
.pw-header.pw-header-glass .pw-nav a:not(.pw-btn){color:#1e293b!important;text-shadow:none!important}
.pw-header.pw-header-glass .pw-nav a:not(.pw-btn):hover{color:var(--o)!important;text-shadow:none!important}
.pw-header.pw-header-glass .pw-burger{background:rgba(255,255,255,.72);border-color:rgba(20,24,27,.15)}
.pw-header.pw-header-glass .pw-burger span{background:#14181b}
.pw-header.pw-header-glass .phi-cart-btn{color:#14181b!important;background:rgba(255,255,255,.6)!important;border-color:rgba(20,24,27,.18)!important}
@media (max-width:960px){.pw-header.pw-header-glass .pw-nav.is-open a:not(.pw-btn){color:#f8fafc!important}}
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
.pw-btn-ghost{background:#fff;color:var(--ink);border-color:var(--line)}
.pw-btn-ghost:hover{border-color:var(--o);color:var(--o)}
.pw-btn-light{background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.28)}
.pw-btn-light:hover{background:rgba(255,255,255,.16);border-color:#fff}
.pw-nav-cta{min-height:42px;padding:0 20px}
.pw a:focus-visible,.pw button:focus-visible,.pw input:focus-visible,.pw select:focus-visible,.pw textarea:focus-visible,.pw summary:focus-visible{outline:3px solid rgba(249,115,22,.55);outline-offset:3px}

/* hero (dark) */
.pw-hero{position:relative;isolation:isolate;background:#090b0f;color:#fff;overflow:hidden;min-height:clamp(620px,90vh,900px);display:flex;flex-direction:column;justify-content:center}
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
  .pw-nav-cta{min-height:38px;padding:0 14px;font-size:.82rem}
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
  .pw-nav-cta{margin-top:14px;min-height:44px;font-size:.94rem}
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

/* ===== بوابة الأقسام الستة الرئيسية ومستكشف القسم والمنتجات التفاعلية ===== */
.pw-portal-gateway{padding-top:34px!important;padding-bottom:54px!important;background:linear-gradient(180deg,#fffaf5 0%,#ffffff 100%)!important;border-bottom:1px solid var(--line)}
.pw-portal-main-h1{font-size:clamp(1.6rem,3.1vw,2.35rem);font-weight:900;line-height:1.3;margin-bottom:10px;color:var(--ink)}
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

/* مربعات الأقسام النظيفة على الصفحة الرئيسية */
.pw-portal-clean-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.pw-portal-box{background:#fff;border:1.5px solid var(--line);border-radius:22px;padding:24px 22px;display:flex;flex-direction:column;gap:10px;text-decoration:none;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}
.pw-portal-box:hover{transform:translateY(-5px);border-color:var(--portal-accent,var(--o));box-shadow:0 22px 44px -22px rgba(20,24,27,.22)}
.pw-portal-box-top{display:flex;align-items:center;justify-content:space-between}
.pw-portal-box h2{font-size:1.25rem;font-weight:900;color:var(--ink)}
.pw-portal-guide{font-size:.9rem;color:var(--ink-2);line-height:1.65;margin-bottom:4px}
.pw-portal-enter{margin-top:auto;padding:10px 14px;border-radius:12px;background:var(--tint);color:var(--portal-accent,var(--o));font-size:.88rem;font-weight:900;display:flex;align-items:center;justify-content:space-between;transition:background .18s,color .18s}
.pw-portal-box:hover .pw-portal-enter{background:var(--portal-accent,var(--o));color:#fff}

/* الأداة السريعة المبسطة */
.pw-quick-finder{background:#fff;border:1.5px solid #fed7aa;border-radius:22px;padding:24px;display:flex;flex-direction:column;gap:16px}
.pw-quick-finder-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:14px}
.pw-quick-finder-head h2{font-size:clamp(1.25rem,2.4vw,1.7rem);font-weight:900}
.pw-quick-finder-controls{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between}
.pw-quick-finder-result{background:var(--o-soft);border:1px solid #fed7aa;border-radius:14px;padding:12px 16px;font-weight:800;font-size:.94rem;color:#7c2d12}

/* صفحة القسم المخصصة */
.pw-section-page{min-height:80vh;background:var(--tint)}
.pw-sec-hero{background:#fff;border-bottom:1px solid var(--line);padding:26px 0 28px}
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

@media (max-width:1100px){
  .pw-portal-grid,.pw-portal-clean-grid,.pw-offers-grid,.pw-tips-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pw-prod-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pw-calc-grid,.pw-advisor-shell{grid-template-columns:1fr}
}
@media (max-width:760px){
  .pw-portal-grid,.pw-portal-clean-grid,.pw-mnt-grid,.pw-mnt-cols,.pw-re-grid,.pw-prod-grid,.pw-info-shortcuts,.pw-tips-grid,.pw-offers-grid,.pw-calc-metrics,.pw-advisor-metrics{grid-template-columns:1fr}
  .pw-explorer-header,.pw-calc-box,.pw-advisor-shell,.pw-quick-finder{padding:16px}
  .pw-portal-gateway{padding-top:26px!important;padding-bottom:36px!important}
}
`;
