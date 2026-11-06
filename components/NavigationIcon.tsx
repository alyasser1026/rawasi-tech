import { menuGroups } from '@/lib/menuData';
import { LayoutDashboard, House, Banknote, Building2, Users, Settings, FileText, BookOpen, MessageSquare, ListTree, NotebookPen, BookOpenText, ShieldAlert, ArrowLeftRight, Wallet, TrendingUp, ReceiptText, ShieldCheck, CalendarDays, Scale, ChartNoAxesCombined, ChartPie, Landmark, Package, Boxes, ClipboardList, HardHat, Layers, ContactRound, Upload, Bell, UserRound, Radar, Calculator, type LucideIcon } from 'lucide-react';

export const navigationIcons: Record<string, LucideIcon> = {
  home: House, dashboard: LayoutDashboard, payments: Banknote, projects: Building2, team: Users, settings: Settings, journal: BookOpen, messages: MessageSquare,
  accounts: ListTree, manual_journals: NotebookPen, ledger: BookOpenText, journal_errors: ShieldAlert, cashflows: ArrowLeftRight, receipts: Wallet, revenue: TrendingUp,
  expenses: ReceiptText, invoices: FileText, audit: ShieldCheck, financialplan: CalendarDays, trialbalance: Scale, financial_statements: ChartNoAxesCombined,
  global_summary: ChartPie, financial_center: Landmark, performance: TrendingUp, materials: Package, materialitems: Boxes, material_issues: Package, subclaims: FileText,
  subcontractor_costs: ReceiptText, job_orders: ClipboardList, laborcost: HardHat, boqcatalog: Layers, partners: ContactRound, partner_balances: Wallet,
  project_ledger: BookOpen, labor_logs: HardHat, attendance: CalendarDays, payroll: Banknote, violations: ShieldAlert, reports: ChartNoAxesCombined, import: Upload, profile: UserRound,
  notifications: Bell, statement: FileText, fieldops: Radar, project_overhead: Building2, boq_budget: Layers, bulk_budget: Layers, cost_allocation: Calculator,
};

/** Icon for a menu item id, matching the sidebar. */
export function MenuIcon({ id, size = 20 }: { id: string; size?: number }) {
  const Icon = navigationIcons[id] || FileText;
  return <Icon size={size} aria-hidden="true" />;
}

export function getNavigationIcon(pathname: string): LucideIcon {
  const item = menuGroups.flatMap(group => group.items).filter(item => item.path === pathname || (item.path !== '/' && pathname.startsWith(`${item.path}/`))).sort((a, b) => b.path.length - a.path.length)[0];
  return navigationIcons[item?.id] || FileText;
}
