export const CSS = `
.cl{--o:#c75517;--o-hi:#f97316;--o-soft:#fff3ea;--ink:#14181b;--ink-2:#55606a;--line:#e3e6e9;--bg:#f6f5f3;--ok:#1a7f4b;--ok-soft:#e8f6ee;--warn:#b45309;--warn-soft:#fef3c7;--bad:#b42318;--bad-soft:#fdecea;--g1:#161b1f;--g2:#0e1215;
  position:relative;min-height:100vh;background:var(--bg);color:var(--ink);font-family:'Cairo',-apple-system,'Segoe UI',sans-serif;line-height:1.7;-webkit-font-smoothing:antialiased}
.cl *,.cl *::before,.cl *::after{box-sizing:border-box}
.cl button{font-family:inherit}
.cl h1,.cl h2,.cl h3,.cl h4,.cl p,.cl ul{margin:0;padding:0}
.cl ul{list-style:none}
.cl-wrap{max-width:1180px;margin:0 auto;padding:0 24px}
.cl-bar{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.94);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.cl-bar-row{display:flex;align-items:center;gap:16px;min-height:68px}
.cl-brand{white-space:nowrap;display:flex;align-items:center;gap:12px;font-weight:800;font-size:1.1rem}
.cl-brand img{height:42px;width:auto;display:block}
.cl-brand>div{display:flex;flex-direction:column;gap:3px;line-height:1.35}
.cl-brand small{display:block;font-size:.72rem;font-weight:700;color:var(--o);letter-spacing:.02em;line-height:1.2}
.cl-spacer{flex:1}
.cl-user{font-weight:700;font-size:.9rem;color:var(--ink-2);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cl-btn{min-height:42px;padding:0 16px;border-radius:11px;border:1px solid var(--line);background:#fff;color:var(--ink);font-weight:700;font-size:.88rem;cursor:pointer}
.cl-btn:hover{border-color:var(--ink)}
.cl-btn:focus-visible,.cl-tab:focus-visible,.cl-pill:focus-visible,.cl-chip:focus-visible{outline:2px solid var(--o);outline-offset:2px}
.cl-main{padding:28px 0 64px;display:flex;flex-direction:column;gap:22px}
.cl-pills{display:flex;gap:10px;flex-wrap:wrap}
.cl-pill{padding:9px 18px;border-radius:999px;border:1px solid var(--line);background:#fff;font-weight:700;font-size:.9rem;color:var(--ink-2);cursor:pointer}
.cl-pill.is-on{background:var(--ink);border-color:var(--ink);color:#fff}
.cl-hero{background:linear-gradient(135deg,var(--g1),var(--g2));color:#fff;border-radius:24px;padding:34px;display:grid;grid-template-columns:1fr auto;gap:28px;align-items:center;position:relative;overflow:hidden}
.cl-hero::after{content:'';position:absolute;inset-inline-end:-80px;top:-80px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(249,115,22,.28),transparent 70%)}
.cl-hero>*{position:relative;z-index:1}
.cl-badge{display:inline-flex;align-items:center;gap:8px;padding:5px 14px;border-radius:999px;background:rgba(249,115,22,.18);color:#fdba74;font-weight:800;font-size:.82rem;border:1px solid rgba(249,115,22,.4)}
.cl-hero h1{font-size:clamp(1.6rem,3.4vw,2.3rem);font-weight:900;margin:12px 0 4px;line-height:1.3}
.cl-hero-stage{color:#d7dde2;font-weight:600}
.cl-meta{display:flex;flex-wrap:wrap;gap:10px 26px;margin-top:18px;color:#c3cbd1;font-size:.9rem}
.cl-meta b{display:block;color:#fff;font-size:.95rem}
.cl-meta span{font-size:.75rem;display:block;color:#98a3ab}
.cl-ring{position:relative;width:170px;height:170px;flex:none}
.cl-ring svg{transform:rotate(-90deg)}
.cl-ring-n{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.cl-ring-n strong{font-size:2.3rem;line-height:1;font-weight:900}
.cl-ring-n span{font-size:.78rem;color:#c3cbd1;margin-top:4px}
.cl-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.cl-kpi{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px 22px}
.cl-kpi span{display:block;font-size:.82rem;font-weight:700;color:var(--ink-2)}
.cl-kpi strong{display:block;font-size:1.5rem;font-weight:900;margin-top:4px;line-height:1.3}
.cl-kpi small{display:block;font-size:.78rem;color:var(--ink-2);margin-top:2px}
.cl-kpi.is-ok strong{color:var(--ok)}
.cl-kpi.is-accent strong{color:var(--o)}
.cl-tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);overflow-x:auto}
.cl-tab{padding:12px 20px;border:0;background:none;font-weight:800;font-size:.95rem;color:var(--ink-2);cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1px;white-space:nowrap}
.cl-tab.is-on{color:var(--ink);border-bottom-color:var(--o)}
.cl-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px}
.cl-card h2{font-size:1.1rem;font-weight:900;margin-bottom:4px}
.cl-card>p.cl-sub{color:var(--ink-2);font-size:.88rem;margin-bottom:16px}
.cl-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}
.cl-grid2>*,.cl-card,.cl-panel>div{min-width:0}
.cl-stat3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.cl-stat{border-radius:16px;padding:18px;border:1px solid var(--line);background:#fff}
.cl-stat strong{font-size:2rem;font-weight:900;line-height:1;display:block}
.cl-stat span{font-size:.85rem;font-weight:700;color:var(--ink-2)}
.cl-stat.done{background:var(--ok-soft);border-color:#bfe5cf}.cl-stat.done strong{color:var(--ok)}
.cl-stat.prog{background:var(--o-soft);border-color:#f7d3bd}.cl-stat.prog strong{color:var(--o)}
.cl-stat.todo{background:#f3f4f5}.cl-stat.todo strong{color:#4b5560}
.cl-bar-line{height:10px;border-radius:99px;background:#eceeef;overflow:hidden}
.cl-bar-line i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--o),var(--o-hi));transition:width .5s}
.cl-bar-line.ok i{background:var(--ok)}
.cl-cat{display:flex;flex-direction:column;gap:6px;padding:12px 0;border-top:1px solid var(--line)}
.cl-cat:first-of-type{border-top:0}
.cl-cat-row{display:flex;justify-content:space-between;gap:12px;font-weight:700;font-size:.93rem}
.cl-cat-row em{font-style:normal;color:var(--ink-2);font-weight:700}
.cl-next{display:flex;gap:14px;align-items:center;padding:16px 18px;border-radius:16px;background:var(--o-soft);border:1px solid #f7d3bd}
.cl-next b{display:block}
.cl-next small{color:var(--ink-2)}
.cl-next strong{margin-inline-start:auto;font-size:1.2rem;font-weight:900;color:var(--o);white-space:nowrap}
.cl-toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.cl-search{flex:1 1 240px;min-height:44px;border:1px solid var(--line);border-radius:12px;padding:0 14px;font:inherit;background:#fff;color:var(--ink)}
.cl-search:focus{outline:2px solid var(--o);outline-offset:1px;border-color:var(--o)}
.cl-chip{padding:9px 16px;border-radius:999px;border:1px solid var(--line);background:#fff;font-weight:700;font-size:.85rem;color:var(--ink-2);cursor:pointer}
.cl-chip.is-on{background:var(--ink);border-color:var(--ink);color:#fff}
.cl-group{margin-top:18px}
.cl-group-h{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.cl-group-h h3{font-size:1rem;font-weight:900}
.cl-group-h em{font-style:normal;font-size:.8rem;font-weight:800;color:var(--o);margin-inline-start:auto}
.cl-item{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr) 62px 98px;gap:14px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}
.cl-item b{font-weight:700;font-size:.93rem}
.cl-item small{display:block;color:var(--ink-2);font-size:.78rem}
.cl-item .pct{font-weight:900;text-align:end}
.cl-tag{display:inline-block;padding:3px 12px;border-radius:999px;font-size:.76rem;font-weight:800;text-align:center}
.cl-tag.done{background:var(--ok-soft);color:var(--ok)}
.cl-tag.prog{background:var(--o-soft);color:var(--o)}
.cl-tag.todo{background:#eef0f2;color:#4b5560}
.cl-tag.late{background:var(--bad-soft);color:var(--bad)}
.cl-tag.due{background:var(--warn-soft);color:var(--warn)}
.cl-money{display:grid;gap:12px}
.cl-money-row{display:flex;justify-content:space-between;font-weight:700;font-size:.92rem;margin-bottom:5px}
.cl-money-row em{font-style:normal;color:var(--ink-2)}
.cl-table{width:100%;min-width:560px;border-collapse:collapse;font-size:.9rem}
.cl-table td:nth-child(2){min-width:200px}
.cl-table th{text-align:start;font-size:.78rem;color:var(--ink-2);font-weight:800;padding:10px 10px;border-bottom:1px solid var(--line)}
.cl-table td{padding:13px 10px;border-bottom:1px solid var(--line);vertical-align:middle}
.cl-table td.n{font-weight:800;white-space:nowrap}
.cl-table tr:last-child td{border-bottom:0}
.cl-scroll{overflow-x:auto}
.cl-visits{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.cl-visit{margin:0;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:#fff}
.cl-photo{aspect-ratio:4/3;background:#eceeef;overflow:hidden}
.cl-photo img{width:100%;height:100%;object-fit:cover;display:block}
.cl-photo-ph{width:100%;height:100%;min-height:120px;display:grid;place-items:center;color:var(--ink-2);font-size:.8rem}
.cl-lightbox{position:fixed;inset:0;z-index:50;background:rgba(10,12,14,.88);display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;padding:20px}
.cl-lightbox img{max-width:100%;max-height:82vh;border-radius:12px;object-fit:contain}
.cl-visit-b{padding:14px 16px}
.cl-visit-b b{display:block;font-size:.95rem}
.cl-visit-b small{color:var(--ink-2)}
.cl-empty{text-align:center;color:var(--ink-2);padding:40px 16px}
.cl-empty h2{color:var(--ink);margin-bottom:6px}
.cl-note{font-size:.8rem;color:var(--ink-2);margin-top:14px}
.cl-state{min-height:60vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;color:var(--ink-2);font-weight:700}
@media (max-width:960px){
  .cl-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  .cl-grid2{grid-template-columns:minmax(0,1fr)}
  .cl-hero{grid-template-columns:1fr;padding:26px}
  .cl-ring{width:140px;height:140px}
}
@media (max-width:640px){
  .cl-wrap{padding:0 16px}
  .cl-user{display:none}
  .cl-bar-row{gap:8px}
  .cl-btn{padding:0 10px;font-size:.78rem;min-height:38px}
  .cl-brand img{height:34px}
  .cl-kpi strong{font-size:1.2rem}
  .cl-item{grid-template-columns:1fr 54px;gap:6px 12px}
  .cl-item .bar{grid-column:1/-1;order:3}
  .cl-item .st{grid-column:1/-1;order:4}
  .cl-stat3{gap:8px}.cl-stat{padding:14px}.cl-stat strong{font-size:1.6rem}
  .cl-card{padding:18px}
}
.cl-print-head{display:none}
@media print{
  @page{margin:12mm; @bottom-center{content:"صفحة " counter(page) " من " counter(pages); font-family:'Cairo',sans-serif; font-size:8.5px; color:#64748b}}
  .cl-print-head{display:block;margin-bottom:12px}
  .cl-bar,.cl-pills,.cl-tabs,.cl-toolbar,.cl-noprint{display:none!important}
  .cl{background:#fff}
  .cl-hero{background:#fff!important;color:#000;border:1px solid #bbb}
  .cl-hero h1,.cl-meta b{color:#000}
  .cl-hero-stage,.cl-meta,.cl-meta span{color:#333}
  .cl-card,.cl-kpi{break-inside:avoid;border-color:#ccc}
  .cl-panel{display:block!important}
  .cl-bar-line i,.cl-tag,.cl-stat{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
@media (prefers-reduced-motion:reduce){.cl *{transition:none!important}}
`;
