"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { menuGroups } from '@/lib/menuData';
import { getSectionStyle } from '@/lib/section-colors';
import { supabase } from '@/lib/supabase';
import RawasiFilterSidebar from '@/components/rawasifiltersidebar';
import { useSidebar } from '@/lib/SidebarContext'; 
import { usePermissions } from '@/lib/PermissionsContext'; 
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { usePresence } from '@/hooks/usePresence';
import LoadingScreen from '@/components/LoadingScreen';

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 40, y: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false); 
  const dragStartPos = useRef({ x: 0, y: 0 });

  // 🛡️ درع حماية الهيدريشن
  const [mounted, setMounted] = useState(false);

  // 🚀 مراقبة السايد بار لعمل الـ Squeeze
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { actions, summary, customFilters } = useSidebar(); 
  const { role, can, loading } = usePermissions();
  const { unread_messages, unread_notifications } = useUnreadCounts();
  const { onlineUsers, onlineCount } = usePresence();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const verifyRealUser = async () => {
      if (pathname === '/login') return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      const { data, error } = await supabase.from('profiles').select('id').eq('id', session.user.id).single();
      if (error || !data) {
        await supabase.auth.signOut();
        window.location.href = '/login'; 
      } else {
        setIsInitialized(true); 
      }
    };
    verifyRealUser();
  }, [pathname, router]);

  

  const canView = (menuId: string) => {
    if (role === 'super_admin' || role === 'admin') return true;
    if (['home', 'profile', 'messages', 'notifications'].includes(menuId)) return true;
    return can(menuId, 'view');
  };

  const onMouseDown = (e: React.MouseEvent) => { 
    if (isOpen) return; 
    setIsDragging(true); 
    dragStartPos.current = { x: e.clientX - position.x, y: e.clientY + position.y }; 
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => { 
      if (!isDragging) return; 
      setPosition({ x: e.clientX - dragStartPos.current.x, y: dragStartPos.current.y - e.clientY }); 
    };
    const onMouseUp = () => setIsDragging(false);
    if (isDragging) { 
      window.addEventListener('mousemove', onMouseMove); 
      window.addEventListener('mouseup', onMouseUp); 
    }
    return () => { 
      window.removeEventListener('mousemove', onMouseMove); 
      window.removeEventListener('mouseup', onMouseUp); 
    };
  }, [isDragging]);

  const currentMargin = mounted && isSidebarOpen ? '280px' : '0px';
  let animationDelayCounter = 0;

  if (pathname === '/login') return <>{children}</>;

  if (loading && !isInitialized) {
      return <LoadingScreen message="جاري تهيئة النظام..." subMessage="يتم الآن تجميع صلاحياتك الخاصة وتأمين الواجهة" fullScreen={true} />;
  }

  const currentPageTitle = menuGroups.flatMap(g => g.items).find(i => i.path === pathname)?.title || "إدارة النظام";

  return (
    <div style={{ display: 'block', minHeight: '100vh', direction: 'rtl' }} suppressHydrationWarning>
      <style>{`
        @keyframes floatPulse { 0%, 100% { box-shadow: 0 15px 35px rgba(194,65,12, 0.2); transform: scale(1); } 50% { box-shadow: 0 15px 35px rgba(194,65,12, 0.4), 0 0 25px 5px rgba(194,65,12, 0.3); transform: scale(1.05); } }
        .fab-main { position: fixed; bottom: ${position.y}px; left: ${position.x}px; width: 85px; height: 85px; z-index: 10000; background: linear-gradient(145deg, rgba(39,39,42, 0.85), rgba(26, 21, 19, 0.95)); backdrop-filter: blur(15px); border-radius: 50%; cursor: ${isDragging ? 'grabbing' : 'grab'}; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3); transition: all 0.4s; animation: floatPulse 4s infinite ease-in-out; padding: 5px; }
        .fab-logo { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); }
        .overlay-screen { position: fixed; inset: 0; z-index: 9000; background: rgba(252, 250, 248, 0.75); backdrop-filter: blur(45px) saturate(150%); opacity: ${isOpen ? 1 : 0}; pointer-events: ${isOpen ? 'auto' : 'none'}; transform: ${isOpen ? 'scale(1)' : 'scale(1.03)'}; transition: all 0.5s cubic-bezier(0.165, 0.84, 0.44, 1); display: flex; flex-direction: column; padding: 60px 5%; overflow-y: auto; align-items: center; justify-content: flex-start; }
        .overlay-backdrop { display: none; }
        .command-center { width: 100%; max-width: 1400px; display: flex; flex-direction: column; gap: 50px; margin-top: 40px; }
        .group-header { color: #8c6a3f; font-weight: 900; font-size: 22px; border-bottom: 2px solid rgba(194,65,12, 0.2); padding-bottom: 12px; text-align: right; display: block; position: relative; text-shadow: 0 2px 5px rgba(255,255,255,0.8); }
        .items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); grid-auto-rows: 150px; gap: 20px; margin-top: 20px; grid-auto-flow: dense; }
        .nav-card { background: rgba(255, 255, 255, 0.4); border: 1px solid rgba(255, 255, 255, 0.7); border-radius: 20px; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #1e293b; cursor: pointer; transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1); opacity: 0; animation: popIn 0.5s forwards; position: relative; text-decoration: none; text-align: center; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.5), 0 5px 15px rgba(0,0,0,0.02); backdrop-filter: blur(20px); overflow: hidden; }
        .nav-card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%); pointer-events: none; }
        @keyframes popIn { 0% { opacity: 0; transform: translateY(30px) scale(0.9); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .nav-card:hover { background: rgba(255, 255, 255, 0.95); border-color: #c2410c; transform: translateY(-5px) scale(1.02); box-shadow: 0 15px 30px rgba(194,65,12, 0.15); z-index: 10; }
        .nav-card.active { background: #ffffff; border-color: #c2410c; box-shadow: 0 0 20px rgba(194,65,12, 0.2); }
        .nav-card .icon-wrapper { width: 55px; height: 55px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 26px; background: rgba(194,65,12, 0.1); color: #c2410c; flex-shrink: 0; transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1); }
        .nav-card:hover .icon-wrapper { transform: scale(1.1) rotate(5deg); background: rgba(194,65,12, 0.2); }
        
        @media (max-width: 768px) {
          main { margin-right: 0px !important; padding-right: 10px !important; padding-left: 10px !important; }
          .fab-main { width: 65px !important; height: 65px !important; bottom: 20px !important; left: 20px !important; }
        }
      `}</style>

      <RawasiFilterSidebar 
        title={currentPageTitle}
        extraActions={actions}
        summarySlot={summary}
        customFilters={customFilters}
        isOpenStatus={isSidebarOpen}
        setIsOpenStatus={setIsSidebarOpen}
        onSearch={(term) => window.dispatchEvent(new CustomEvent('globalSearch', { detail: term }))}
        onDateChange={(start, end) => window.dispatchEvent(new CustomEvent('globalDateFilter', { detail: { start, end } }))}
      />

      <div className="fab-main no-print" 
           onMouseDown={(e) => { if(window.innerWidth > 768) onMouseDown(e); }} 
           onTouchStart={(e) => { if(window.innerWidth <= 768) setIsOpen(!isOpen); }}
           onClick={() => { if(window.innerWidth > 768 && !isDragging) setIsOpen(!isOpen); }}>
        <img src="/phitech-symbol.svg" alt="فاي تك" className="fab-logo" />
      </div>

      <div className="overlay-backdrop no-print"></div>
      <nav className="overlay-screen no-print" onClick={(e) => {
         if (e.target === e.currentTarget) setIsOpen(false); // Close when clicking outside content
      }}>
          <div className="command-center" onClick={(e) => e.stopPropagation()}>
            <div style={{ background: 'rgba(255, 255, 255, 0.65)', border: '1px solid rgba(255, 255, 255, 0.9)', padding: '15px 30px', borderRadius: '20px', fontSize: '18px', textAlign: 'center', color: '#27272a', marginBottom: '10px', fontWeight: 900, backdropFilter: 'blur(15px)', alignSelf: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: '20px' }}>
               <span>بوابة الإدارة المركزية | {role === 'super_admin' ? '👑 سوبر أدمن' : '👤 مسؤول نظام'}</span>
               <div style={{ display: 'flex', gap: '15px', borderRight: '2px solid rgba(0,0,0,0.1)', paddingRight: '15px', alignItems: 'center' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#dcfce7', color: '#166534', padding: '5px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 800 }}>
                       <span style={{ width: '8px', height: '8px', background: '#16a34a', borderRadius: '50%', boxShadow: '0 0 8px #16a34a' }}></span>
                       {onlineCount} متصل
                   </div>
                   
                   
               </div>
            </div>

            {menuGroups.map((group, gIdx) => {
              const filteredItems = group.items.filter(item => canView(item.id));
              if (filteredItems.length === 0) return null;

              return (
                <div key={gIdx} className="group-section">
                  <span className="group-header">{group.group}</span>
                  <div className="items-grid">
                    {filteredItems.map((item, iIdx) => {
                      const delay = (animationDelayCounter++) * 0.05;
                      const isActive = pathname === item.path;
                      return (
                        <Link key={iIdx} href={item.path} onClick={() => setIsOpen(false)}>
                              <div className={`nav-card ${isActive ? 'active' : ''}`} style={{ ...getSectionStyle(item.path), animationDelay: isOpen ? `${delay}s` : '0s' }}>
                                <div className="icon-wrapper">{item.icon}</div>
                                <span className="nav-title" style={{ fontWeight: 800, fontSize: '15px', color: '#1e293b', lineHeight: '1.4' }}>{item.title}</span>
                                {isActive && <div style={{ position: 'absolute', top: '15px', right: '15px', width: '10px', height: '10px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)' }}></div>}
                            </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* المتصلين حاليا */}
            {onlineUsers.length > 0 && (
              <div className="group-section" style={{ marginTop: '20px' }}>
                <span className="group-header" style={{ borderColor: 'rgba(22, 163, 74, 0.2)', color: '#166534' }}>🟢 المتصلين الآن ({onlineCount})</span>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '20px' }}>
                  {onlineUsers.map((user, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.8)', padding: '10px 15px', borderRadius: '15px', border: '1px solid rgba(22, 163, 74, 0.2)', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                        <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '14px' }}>
                            {user.full_name?.charAt(0) || 'م'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>{user.full_name}</span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>{user.role === 'super_admin' ? 'مدير' : 'موظف'}</span>
                        </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
      </nav>

      <main style={{ 
          flex: 1, 
          boxSizing: 'border-box',
          marginRight: currentMargin, 
          paddingRight: '15px', 
          minHeight: '100vh', 
          position: 'relative', 
          zIndex: 1,
          overflowX: 'hidden',
          transition: 'margin-right 0.5s cubic-bezier(0.165, 0.84, 0.44, 1)' 
      }}>
        {children}
      </main>
    </div>
  );
}
