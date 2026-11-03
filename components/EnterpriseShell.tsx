"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Banknote, Building2, Users, Settings, Menu, PanelRightClose, PanelRightOpen, X, FileText, BookOpen, MessageSquare, type LucideIcon } from 'lucide-react';
import { ListTree, NotebookPen, BookOpenText, ShieldAlert, ArrowLeftRight, Wallet, TrendingUp, ReceiptText, ShieldCheck, CalendarDays, Scale, ChartNoAxesCombined, ChartPie, Landmark, Package, Boxes, ClipboardList, HardHat, Layers, ContactRound, Upload, Bell, UserRound } from 'lucide-react';
import { menuGroups } from '@/lib/menuData';
import { usePermissions } from '@/lib/PermissionsContext';
import { useDialogFocus } from '@/hooks/useDialogFocus';

const ICONS: Record<string, LucideIcon> = { home: LayoutDashboard, dashboard: LayoutDashboard, payments: Banknote, projects: Building2, team: Users, settings: Settings, journal: BookOpen, messages: MessageSquare, accounts:ListTree, manual_journals:NotebookPen, ledger:BookOpenText, journal_errors:ShieldAlert, cashflows:ArrowLeftRight, receipts:Wallet, revenue:TrendingUp, expenses:ReceiptText, invoices:FileText, audit:ShieldCheck, financialplan:CalendarDays, trialbalance:Scale, financial_statements:ChartNoAxesCombined, global_summary:ChartPie, financial_center:Landmark, performance:TrendingUp, materials:Package, materialitems:Boxes, material_issues:Package, subclaims:FileText, subcontractor_costs:ReceiptText, job_orders:ClipboardList, laborcost:HardHat, boqcatalog:Layers, partners:ContactRound, partner_balances:Wallet, project_ledger:BookOpen, labor_logs:HardHat, payroll:Banknote, violations:ShieldAlert, reports:ChartNoAxesCombined, import:Upload, profile:UserRound, notifications:Bell };
const GROUP_ICONS = [LayoutDashboard, Banknote, Building2, Users, MessageSquare, Settings];

export default function EnterpriseShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { can, role, profile } = usePermissions();
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
    {group.items.map(item => { const Icon = ICONS[item.id] || GROUP_ICONS[group.index] || FileText; return <Link href={item.path} key={item.id} className={`ent-nav-link ${pathname === item.path ? 'is-current' : ''}`} aria-current={pathname === item.path ? 'page' : undefined} title={compact ? item.title : undefined} onClick={closeMobile}>
      <Icon size={19} aria-hidden="true"/>{!compact && <span>{item.title}</span>}
    </Link>; })}
  </div>)}</nav>;
  const toggle = () => { const next = !collapsed; setCollapsed(next); try { localStorage.setItem('phi:nav-collapsed', String(next)); } catch {} };
  return <div className={`enterprise-shell ${collapsed ? 'ent-collapsed' : ''}`} dir="rtl">
    <aside className="ent-sidebar no-print" aria-label="القائمة الجانبية">
      <Link href="/" className="ent-brand" aria-label="فاي تك — الرئيسية"><img src={collapsed ? '/phitech-symbol.svg' : '/company-logo.svg'} alt="فاي تك | PHI TECH"/></Link>
      <button type="button" className="ent-collapse ent-icon-button" onClick={toggle} aria-label={collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'} aria-expanded={!collapsed}>{collapsed ? <PanelRightOpen size={18}/> : <PanelRightClose size={18}/>}</button>
      <div className="ent-nav-scroll">{navigation(collapsed)}</div>
      <Link href="/profile" className="ent-sidebar-user" title="الملف الشخصي"><span className="ent-avatar">{profile?.full_name?.slice(0, 1) || <Users size={17}/>}</span>{!collapsed && <span><strong>{profile?.full_name || 'الملف الشخصي'}</strong><small>{['admin', 'super_admin'].includes(role) ? 'إدارة النظام' : 'حساب المستخدم'}</small></span>}</Link>
    </aside>
    <div className="ent-mobile-bar no-print"><button type="button" className="ent-icon-button" aria-label="فتح قائمة الشاشات" onClick={() => setMobileOpen(true)}><Menu size={21}/></button><img src="/company-logo.svg" alt="فاي تك"/></div>
    {mobileOpen && <div className="ent-mobile-backdrop no-print" onClick={event => { if (event.target === event.currentTarget) closeMobile(); }}><div className="ent-mobile-panel" ref={mobilePanel} role="dialog" aria-modal="true" aria-label="قائمة الشاشات"><div className="ent-mobile-heading"><img src="/company-logo.svg" alt="فاي تك"/><button type="button" className="ent-icon-button" onClick={closeMobile} aria-label="إغلاق قائمة الشاشات"><X size={20}/></button></div>{navigation()}</div></div>}
    <main className="ent-workspace">{children}</main>
  </div>;
}
