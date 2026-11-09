export const CSS = `
.pw{--o:#c75517;--o-hi:#f97316;--o-dark:#a84511;--o-soft:#fff3ea;--ink:#14181b;--ink-2:#47525c;--line:#e3e6e9;--bg:#fff;--tint:#f6f5f3;--g1:#161b1f;--g2:#0e1215;
  position:relative;min-height:100vh;background:var(--bg);color:var(--ink);font-family:'Cairo',-apple-system,'Segoe UI',sans-serif;line-height:1.75;letter-spacing:0;-webkit-font-smoothing:antialiased;overflow-x:clip}
.pw *{box-sizing:border-box}
:where(.pw) :is(h1,h2,h3,h4,p,ul,ol,dl,dd,figure,table,caption){margin:0;padding:0}
:where(.pw) :is(ul,ol){list-style:none}
:where(.pw) a{color:inherit;text-decoration:none}
:where(.pw) img{max-width:100%;display:block}
:where(.pw) :is(button,input,select,textarea){font-family:inherit;font-size:inherit;color:inherit}
.pw-wrap{width:100%;max-width:1200px;margin:0 auto;padding:0 24px}
.pw-muted{color:var(--ink-2)}

/* header */
.pw-header{position:sticky;top:0;z-index:60;background:rgba(255,255,255,.9);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid transparent;transition:border-color .2s,box-shadow .2s}
.pw-header.is-scrolled{border-bottom-color:var(--line);box-shadow:0 6px 24px rgba(20,28,34,.06)}
.pw-header-row{display:flex;align-items:center;justify-content:space-between;height:72px;gap:16px}
.pw-brand{display:flex;align-items:center;gap:12px}
.pw-brand-mark{height:42px;width:auto}
.pw-brand-text{display:flex;flex-direction:column;line-height:1.1}
.pw-brand-text strong{font-size:1.25rem;font-weight:800}
.pw-brand-text small{font-size:.7rem;font-weight:700;letter-spacing:.2em;color:var(--o)}
.pw-nav{display:flex;align-items:center;gap:24px;font-weight:600;font-size:.93rem;color:var(--ink-2)}
.pw-nav a:not(.pw-btn){position:relative;padding:6px 0}
.pw-nav a:not(.pw-btn)::after{content:'';position:absolute;inset-inline:0;bottom:0;height:2px;background:var(--o);transform:scaleX(0);transition:transform .2s;transform-origin:center}
.pw-nav a:not(.pw-btn):hover{color:var(--ink)}
.pw-nav a:not(.pw-btn):hover::after{transform:scaleX(1)}
.pw-burger{display:none;width:44px;height:44px;border:1px solid var(--line);background:#fff;border-radius:10px;cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:5px}
.pw-burger span{display:block;width:20px;height:2px;background:var(--ink);border-radius:2px}

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
.pw-hero{position:relative;background:radial-gradient(900px 480px at 85% 0%,rgba(249,115,22,.22),transparent 60%),linear-gradient(180deg,var(--g1),var(--g2));color:#fff;overflow:hidden}
.pw-hero::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:44px 44px;mask-image:linear-gradient(180deg,#000 0%,transparent 90%);-webkit-mask-image:linear-gradient(180deg,#000 0%,transparent 90%)}
.pw-hero-grid{position:relative;display:grid;grid-template-columns:1.2fr .8fr;gap:56px;align-items:center;padding-top:84px;padding-bottom:64px}
.pw-eyebrow{display:inline-flex;align-items:center;gap:10px;font-size:.84rem;font-weight:700;color:var(--o);letter-spacing:.02em;margin-bottom:14px}
.pw-eyebrow::before{content:'';width:28px;height:2px;background:currentColor}
.pw-hero .pw-eyebrow{color:var(--o-hi)}
.pw-hero h1{font-size:clamp(2.1rem,4.6vw,3.5rem);line-height:1.22;font-weight:800;margin-bottom:20px}
.pw-hero h1 em{font-style:normal;color:var(--o-hi)}
.pw-lead{font-size:1.1rem;color:#c5ced6;max-width:36rem;margin-bottom:30px}
.pw-actions{display:flex;flex-wrap:wrap;gap:12px}
.pw-hero-art{display:flex;justify-content:center}
.pw-emblem{position:relative;width:min(100%,380px);aspect-ratio:1;display:flex;align-items:center;justify-content:center}
.pw-emblem::before,.pw-emblem::after{content:'';position:absolute;border-radius:50%;border:1px solid rgba(255,255,255,.14)}
.pw-emblem::before{inset:0}
.pw-emblem::after{inset:12%;border-color:rgba(249,115,22,.35);border-style:dashed}
.pw-emblem img{position:relative;height:56%;width:auto;filter:drop-shadow(0 20px 40px rgba(0,0,0,.45))}
.pw-stats{position:relative;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border-top:1px solid rgba(255,255,255,.12);margin-top:0}
.pw-stats li{padding:22px 24px;border-inline-start:1px solid rgba(255,255,255,.12);display:flex;flex-direction:column;gap:2px}
.pw-stats li:first-child{border-inline-start:0}
.pw-stats strong{font-size:1.2rem;font-weight:800}
.pw-stats span{font-size:.85rem;color:#a9b4be}

/* sections */
.pw-section{padding:96px 0}
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
.pw-projects{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}
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
.pw-footer-brand strong{display:block;color:#fff}
.pw-footer-brand small{color:#8f9ba5;font-size:.8rem}
.pw-footer-nav{display:flex;flex-wrap:wrap;gap:8px 22px;font-size:.9rem;font-weight:600}
.pw-footer-nav a:hover{color:#fff}
.pw-footer-link{font-weight:700;font-size:.92rem;color:#fff;border:1px solid rgba(255,255,255,.28);border-radius:10px;padding:8px 18px;transition:background .18s,border-color .18s}
.pw-footer-link:hover{background:var(--o);border-color:var(--o)}
.pw-footer-bottom{margin-top:28px;padding-top:18px;border-top:1px solid rgba(255,255,255,.1);font-size:.8rem;color:#8f9ba5}

@media (max-width:1040px){
  .pw-nav{gap:16px;font-size:.88rem}
}
@media (max-width:960px){
  .pw-hero-grid{grid-template-columns:1fr;gap:36px;padding-top:56px;padding-bottom:44px}
  .pw-hero-art{order:-1}
  .pw-emblem{width:min(70%,240px)}
  .pw-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
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
@media (max-width:820px){
  .pw-burger{display:flex}
  .pw-nav{position:absolute;top:72px;inset-inline:0;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 20px 30px -18px rgba(20,28,34,.25);flex-direction:column;align-items:stretch;gap:0;padding:8px 24px 18px;display:none}
  .pw-nav.is-open{display:flex}
  .pw-nav a:not(.pw-btn){padding:14px 4px;border-bottom:1px solid var(--line)}
  .pw-nav a:not(.pw-btn)::after{display:none}
  .pw-nav-cta{margin-top:14px}
}
@media (max-width:600px){
  .pw-wrap{padding:0 18px}
  .pw-steps,.pw-projects,.pw-trust{grid-template-columns:1fr}
  .pw-trust li{border-inline-start:0;border-top:1px solid var(--line)}
  .pw-trust li:first-child{border-top:0}
  .pw-stats li{padding:16px}
  .pw-actions .pw-btn{flex:1 1 100%}
  .pw-conv{grid-template-columns:1fr 1fr}
  .pw-conv .pw-swap{grid-column:1/-1;width:100%}
  .pw-grid-fields,.pw-results,.pw-form .pw-grid2{grid-template-columns:1fr}
  .pw-tools-body{padding:18px}
  .pw-bim-stage{min-height:320px}
}
@media (prefers-reduced-motion:reduce){.pw *{transition:none!important}}
`;
