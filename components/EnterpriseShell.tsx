"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PanelRightClose, PanelRightOpen, X, FileText, LogOut } from 'lucide-react';
import { menuGroups } from '@/lib/menuData';
import { usePermissions } from '@/lib/PermissionsContext';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { navigationIcons } from './NavigationIcon';
import { supabase } from '@/lib/supabase';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { useDisplayName } from '@/hooks/useDisplayName';
import AppTopBar from './AppTopBar';
import CompanyLogo from './CompanyLogo';
import ThemeSwitcher from './ThemeSwitcher';

export default function EnterpriseShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { can, role } = usePermissions();
  const { unread_messages, unread_notifications } = useUnreadCounts();
  const displayName = useDisplayName();
  const [signingOut, setSigningOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobilePanel = useRef<HTMLDivElement>(null);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  useDialogFocus(mobilePanel, mobileOpen, closeMobile);
  useEffect(() => { try { setCollapsed(localStorage.getItem('phi:nav-collapsed') === 'true'); } catch {} }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  const groups = menuGroups.map((group, index) => ({ ...group, index, items: group.items.filter(item => ['admin', 'super_admin'].includes(role) || ['home', 'profile', 'messages', 'notifications'].includes(item.id) || can(item.id, 'view')) })).filter(group => group.items.length);
  const navigation = (compact = false) => <nav aria-label="شاشات البرنامج">{groups.map(group => <div className="ent-nav-group" key={group.group}>
    {!compact && <p>{group.group}</p>}
    {group.items.map(item => { const Icon = navigationIcons[item.id] || FileText; const isCurrent = pathname === item.path || (item.path !== '/' && pathname.startsWith(`${item.path}/`) && !groups.some(group => group.items.some(other => other.path !== item.path && other.path.length > item.path.length && (pathname === other.path || pathname.startsWith(`${other.path}/`))))); const unread = item.id === 'messages' ? unread_messages : item.id === 'notifications' ? unread_notifications : 0; return <Link href={item.path} key={item.id} className={`ent-nav-link ${isCurrent ? 'is-current' : ''}`} aria-current={isCurrent ? 'page' : undefined} aria-label={compact ? item.title : undefined} title={compact ? item.title : undefined} onClick={closeMobile}>
      <Icon size={19} aria-hidden="true"/>{!compact && <span>{item.title}</span>}{unread > 0 && <span className="ent-nav-badge" aria-label={`${unread} غير مقروءة`}>{compact ? '' : unread > 99 ? '99+' : unread}</span>}
    </Link>; })}
  </div>)}</nav>;
  const toggle = () => { const next = !collapsed; setCollapsed(next); try { localStorage.setItem('phi:nav-collapsed', String(next)); } catch {} };
  const logout = async () => {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (!error) router.replace('/login');
    setSigningOut(false);
  };
  return <div className={`enterprise-shell ${collapsed ? 'ent-collapsed' : ''}`} dir="rtl">
    <aside className="ent-sidebar no-print" aria-label="القائمة الجانبية">
      <Link href="/" className="ent-brand" aria-label="فاي تك — الرئيسية"><CompanyLogo symbolOnly={collapsed} /></Link>
      <button type="button" className="ent-collapse ent-icon-button" onClick={toggle} aria-label={collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'} aria-expanded={!collapsed}>{collapsed ? <PanelRightOpen size={18}/> : <PanelRightClose size={18}/>}</button>
      <div className="ent-nav-scroll">{navigation(collapsed)}</div>
      <div className="ent-sidebar-footer"><Link href="/profile" className="ent-sidebar-user" title="الملف الشخصي"><span className="ent-avatar">{displayName.initial}</span>{!collapsed && <span><strong>{displayName.name}</strong><small>{['admin', 'super_admin'].includes(role) ? 'إدارة النظام' : 'حساب المستخدم'}</small></span>}</Link><button type="button" className="ent-icon-button ent-logout" onClick={logout} disabled={signingOut} aria-label="تسجيل الخروج" title="تسجيل الخروج"><LogOut size={17}/></button></div>
    </aside>
    {mobileOpen && <div className="ent-mobile-backdrop no-print" onClick={event => { if (event.target === event.currentTarget) closeMobile(); }}><div className="ent-mobile-panel" ref={mobilePanel} role="dialog" aria-modal="true" aria-label="قائمة الشاشات"><div className="ent-mobile-heading"><CompanyLogo /><button type="button" className="ent-icon-button" onClick={closeMobile} aria-label="إغلاق قائمة الشاشات"><X size={20}/></button></div><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', marginBottom: '0.75rem', background: 'var(--surface-subcard)', borderRadius: '12px' }}><span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-secondary)' }}>مظهر الواجهة:</span><ThemeSwitcher /></div>{navigation()}<button type="button" className="ent-button ent-mobile-logout" onClick={logout} disabled={signingOut}><LogOut size={17}/>تسجيل الخروج</button></div></div>}
    <main className="ent-workspace"><AppTopBar onOpenMenu={() => setMobileOpen(true)}/><div className="ent-screen-root enterprise-page">{children}</div></main>
  </div>;
}
