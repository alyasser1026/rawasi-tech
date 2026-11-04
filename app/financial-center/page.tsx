"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MasterPage from '@/components/MasterPage';
import UserMenu from '@/components/UserMenu';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';

export default function FinancialCenter() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);

  const refreshCore = useCallback(async () => {
    try {
      const [expRes, journalRes] = await Promise.all([
        supabase.from('expenses').select('total_price, created_at, description'),
        supabase.from('journal_lines').select('debit, credit, created_at')
      ]);

      const totalOut = expRes.data?.reduce((sum, i) => sum + (Number(i.total_price) || 0), 0) || 0;
      const totalIn = journalRes.data?.reduce((sum, i) => sum + (Number(i.credit) || 0), 0) || 0;
      const liquidityIndex = totalIn > 0 ? ((totalIn - totalOut) / totalIn * 100).toFixed(1) : 0;

      setData({
        totalIn,
        totalOut,
        netCash: totalIn - totalOut,
        liquidityIndex,
        syncTime: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        blockId: Math.random().toString(36).substring(7).toUpperCase()
      });

      const allEvents = [
        ...(expRes.data || []).map(e => ({ ...e, type: 'DEBIT_OP' })),
        ...(journalRes.data || []).map(j => ({ ...j, type: 'CREDIT_OP' }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
      
      setLogs(allEvents);
    } catch (err) {
      console.error("Link Failure:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let channel: any;
    const boot = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      await refreshCore();
      channel = supabase.channel('sovereign_air_radar')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => refreshCore())
        .subscribe();
    };
    boot();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [refreshCore, router]); 

  const sidebarContent = useMemo(() => ({
    summary: (
      <div className="air-status-card">
          <div className="status-ping"><div className="ping-ring"></div><div className="ping-core"></div></div>
          <h3 className="status-label">AIR_NODE_LIVE</h3>
          <p className="status-sub">اتصال كريستالي مشفر</p>
      </div>
    ),
    actions: (
      <div className="sidebar-action-stack">
          <button className="btn-air-primary" onClick={refreshCore}>RE-SYNC ASSETS</button>
          <button className="btn-air-outline" onClick={() => window.print()}>EXPORT_LEDGER</button>
      </div>
    )
  }), [refreshCore]);

  if (loading) return (
    <div className="air-loader-gate">
        <div className="loader-core"></div>
        <p>INITIALIZING AIR GLASS...</p>
    </div>
  );

  return (
    <MasterPage title="المركز المالي" subtitle="Sovereign Control Center - Air Glass Architecture">
      
      <div className="air-glass-wrapper">
        {/* 🪐 Mesh Aura Background - ألوان غنية لتظهر خلف الزجاج */}
        <div className="mesh-gradient-aura"></div>
        
        <div style={{ padding: '0 40px', position: 'relative', zIndex: 10 }}>
          <UserMenu />
        </div>

        <div className="theatre-layout">
           <RawasiSidebarManager summary={sidebarContent.summary} actions={sidebarContent.actions} watchDeps={[data]} />

           <div className="main-stage">
              
              {/* 💎 THE HERO VAULT: الخزنة الهوائية شفافة 95% */}
              <div className="hero-vault-air">
                  <div className="glare-effect"></div>
                  <div className="card-top-info">
                      <span className="serial-id">REF: {data?.blockId}</span>
                      <div className="security-tag">PURE_ENCRYPTION</div>
                  </div>
                  <label className="hero-label">TOTAL NET SOVEREIGN EQUITY</label>
                  <h1 className="hero-value">{formatCurrency(data?.netCash)}</h1>
                  <div className="hero-footer-stats">
                      <div className="pill-air">
                          <span className="dot-active green"></span>
                          Liquidity: {data?.liquidityIndex}%
                      </div>
                      <div className="pill-air">
                          <span className="dot-active gold"></span>
                          Engine: Quantum
                      </div>
                  </div>
              </div>

              <div className="matrix-layout-grid">
                  
                  {/* 🖥️ COMMAND TERMINAL: سجل الشبح (Ghost Log) */}
                  <div className="glass-terminal">
                      <div className="terminal-header">
                          <div className="nav-dots"><span></span><span></span><span></span></div>
                          <span className="nav-title">SOVEREIGN_LOG_STREAM</span>
                          <span className="nav-sync">Live: {data?.syncTime}</span>
                      </div>
                      <div className="terminal-body cinematic-scroll">
                          {logs.map((log, i) => (
                            <div key={i} className="stream-line">
                                <span className="line-ts">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                                <span className={`line-type ${log.type}`}> {log.type} </span>
                                <span className="line-msg">{log.description || 'Auto-Sync Node'}</span>
                                <span className="line-val">{formatCurrency(log.total_price || log.credit || log.debit)}</span>
                            </div>
                          ))}
                          <div className="terminal-cursor">_</div>
                      </div>
                  </div>

                  {/* Matrix Side Tiles */}
                  <div className="matrix-side-column">
                      <div className="matrix-tile">
                          <label>INFLOW_CORE</label>
                          <div className="num success">{formatCurrency(data?.totalIn)}</div>
                          <div className="progress-mini"><div className="fill success" style={{width: '85%'}}></div></div>
                      </div>
                      <div className="matrix-tile">
                          <label>OUTFLOW_CORE</label>
                          <div className="num danger">{formatCurrency(data?.totalOut)}</div>
                          <div className="progress-mini"><div className="fill danger" style={{width: '40%'}}></div></div>
                      </div>
                  </div>

              </div>

           </div>
        </div>

        <style>{`
          .air-glass-wrapper { padding: 0 40px 40px; direction: rtl; font-family: -apple-system, BlinkMacSystemFont, 'Cairo', sans-serif; background: transparent; min-height: 100vh; position: relative; overflow: hidden; }
          
          .mesh-gradient-aura {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: 
              radial-gradient(at 0% 0%, rgba(194,65,12, 0.08) 0, transparent 50%),
              radial-gradient(at 100% 0%, rgba(210, 210, 215, 0.4) 0, transparent 60%),
              radial-gradient(at 50% 100%, rgba(255, 255, 255, 0.9) 0, transparent 70%);
            z-index: -1; pointer-events: none;
          }

          .theatre-layout { display: flex; gap: 40px; position: relative; z-index: 5; margin-top: 25px; }
          .main-stage { flex: 1; animation: airEnter 1s cubic-bezier(0.16, 1, 0.3, 1); }

          /* Hero Vault (Air Glass Architecture) */
          .hero-vault-air {
            background: rgba(255, 255, 255, 0.02); /* شفافية شبه كاملة */
            backdrop-filter: blur(120px) saturate(250%); /* بلور فائق مع تشبع عالٍ */
            -webkit-backdrop-filter: blur(120px) saturate(250%);
            border-radius: 50px; padding: 80px 60px;
            border: 1px solid rgba(255, 255, 255, 0.25); /* حدود خيطية */
            box-shadow: 0 40px 100px rgba(0,0,0,0.01);
            position: relative; overflow: hidden; margin-bottom: 40px;
          }
          .glare-effect { position: absolute; top: -100%; left: -100%; width: 300%; height: 300%; background: linear-gradient(45deg, transparent 45%, rgba(255,255,255,0.4) 50%, transparent 55%); animation: glareMove 15s infinite linear; }
          .card-top-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .serial-id { font-family: monospace; font-size: 10px; color: rgba(29, 29, 31, 0.3); letter-spacing: 2px; }
          .security-tag { font-size: 9px; font-weight: 900; color: #34c759; border: 1px solid rgba(52, 199, 89, 0.2); padding: 4px 10px; border-radius: 6px; backdrop-filter: blur(20px); }
          .hero-label { font-size: 13px; font-weight: 900; color: #1d1d1f; letter-spacing: 8px; opacity: 0.4; display: block; }
          .hero-value { font-size: 96px; font-weight: 900; color: #1d1d1f; margin: 10px 0; letter-spacing: -5px; }
          
          .pill-air { background: rgba(255, 255, 255, 0.1); padding: 12px 24px; border-radius: 100px; font-size: 12px; font-weight: 800; color: #1d1d1f; display: flex; align-items: center; gap: 10px; border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(30px); }
          .dot-active { width: 6px; height: 6px; border-radius: 50%; }
          .dot-active.green { background: #34c759; box-shadow: 0 0 10px #34c759; }
          .dot-active.gold { background: ${THEME.goldAccent}; box-shadow: 0 0 10px ${THEME.goldAccent}; }

          .matrix-layout-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 30px; }

          /* Command Terminal (Ghost/Smoke Glass) */
          .glass-terminal {
            background: rgba(255, 255, 255, 0.02);
            backdrop-filter: blur(80px);
            border-radius: 14px; padding: 40px; border: 1px solid rgba(255, 255, 255, 0.15);
          }
          .terminal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 15px; }
          .nav-dots span { width: 8px; height: 8px; border-radius: 50%; background: rgba(0,0,0,0.05); display: inline-block; margin-right: 5px; }
          .nav-title { font-size: 10px; font-family: monospace; color: rgba(29, 29, 31, 0.4); }
          .nav-sync { font-size: 10px; font-family: monospace; color: #34c759; }
          .terminal-body { font-family: 'Courier New', monospace; max-height: 380px; overflow-y: auto; }
          .stream-line { font-size: 11px; margin-bottom: 15px; display: flex; gap: 20px; border-bottom: 1px solid rgba(0,0,0,0.02); padding-bottom: 10px; color: #1d1d1f; }
          .line-ts { color: rgba(29, 29, 31, 0.3); }
          .line-type.DEBIT_OP { color: #ff3b30; font-weight: 900; }
          .line-type.CREDIT_OP { color: #34c759; font-weight: 900; }
          .line-val { margin-right: auto; font-weight: 800; color: #1d1d1f; }
          .terminal-cursor { color: #34c759; animation: appleBlink 1s infinite; }

          /* Matrix Side Tiles (Liquid Transparency) */
          .matrix-tile { 
            background: rgba(255, 255, 255, 0.05); 
            backdrop-filter: blur(60px) saturate(180%);
            border-radius: 14px; padding: 35px; 
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); margin-bottom: 25px;
          }
          .matrix-tile:hover { background: rgba(255, 255, 255, 0.15); transform: translateY(-8px); border-color: rgba(255, 255, 255, 0.4); }
          .matrix-tile label { font-size: 11px; font-weight: 900; color: rgba(29, 29, 31, 0.5); letter-spacing: 2px; display: block; margin-bottom: 10px; }
          .matrix-tile .num { font-size: 42px; font-weight: 900; color: #1d1d1f; letter-spacing: -1px; }
          .num.success { color: #34c759; }
          .num.danger { color: #ff3b30; }

          /* Sovereign Buttons (High Contrast Glass) */
          .btn-air-primary { 
            background: rgba(29, 29, 31, 0.9); 
            backdrop-filter: blur(20px);
            color: #fff; border: none; padding: 22px; border-radius: 14px; font-weight: 900; font-size: 13px; letter-spacing: 2px; cursor: pointer; transition: 0.4s; 
          }
          .btn-air-primary:hover { transform: translateY(-3px); background: #000; box-shadow: 0 15px 30px rgba(0,0,0,0.2); }
          .btn-air-outline { background: rgba(255, 255, 255, 0.1); color: #1d1d1f; border: 1px solid rgba(0,0,0,0.1); padding: 22px; border-radius: 14px; font-weight: 800; cursor: pointer; margin-top: 15px; }

          .air-status-card { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(20px); padding: 30px; border-radius: 14px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.2); }
          .status-ping { width: 40px; height: 40px; position: relative; margin: 0 auto 15px; }
          .ping-ring { position: absolute; width: 100%; height: 100%; border: 2px solid #34c759; border-radius: 50%; animation: sovereignPing 2s infinite; }
          .ping-core { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 12px; height: 12px; background: #34c759; border-radius: 50%; box-shadow: 0 0 15px #34c759; }

          @keyframes glareMove { 0% { transform: translate(-100%, -100%); } 100% { transform: translate(100%, 100%); } }
          @keyframes airEnter { from { opacity: 0; transform: translateY(50px); filter: blur(30px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
          @keyframes appleBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
          @keyframes sovereignPing { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }

          .air-loader-gate { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f5f5f7; }
          .loader-core { width: 50px; height: 50px; border: 3px solid #e2e2e7; border-top: 3px solid #1d1d1f; border-radius: 50%; animation: appleSpin 0.8s linear infinite; }
          @keyframes appleSpin { to { transform: rotate(360deg); } }

          .cinematic-scroll::-webkit-scrollbar { width: 2px; }
          .cinematic-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }

          @media (max-width: 1200px) { .matrix-layout-grid { grid-template-columns: 1fr; } }
        `}</style>
      </div>
    </MasterPage>
  );
}