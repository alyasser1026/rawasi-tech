/**
 * 🧭 Smart Role & Permission Router
 * Determines the target landing page for users based on:
 * 1. Explicit `default_page` set in permissions/profile
 * 2. User role (super_admin, admin, partner, contractor, staff)
 * 3. Module permissions (partner_balances, fieldops, projects, journal, etc.)
 */

export interface UserProfileRoutingData {
  id?: string;
  role?: string;
  is_admin?: boolean;
  linked_partner_id?: string | null;
  permissions?: Record<string, any>;
  default_page?: string | null;
}

export const AVAILABLE_LANDING_PAGES = [
  { value: 'auto', label: 'تلقائي ذكي حسب الصلاحيات والرتبة' },
  { value: '/Dashboard', label: 'لوحة القيادة العامة (Dashboard)' },
  { value: '/GlobalSummary', label: 'الملخص المالي العام (Global Summary)' },
  { value: '/client', label: 'بوابة العميل (متابعة المشروع والمالية)' },
  { value: '/PartnerBalances', label: 'كشف حساب وأرصدة الشركاء (Partner Balances)' },
  { value: '/financial-center', label: 'المركز المالي ومؤشرات السيولة' },
  { value: '/fieldops', label: 'رادار الميدان الحي للمهندسين (Field Ops)' },
  { value: '/projects', label: 'غرفة المشاريع ومتابعة المواقع' },
  { value: '/journal', label: 'قيود اليومية والحسابات العامة' },
  { value: '/accounts', label: 'شجرة ودليل الحسابات' },
  { value: '/invoices', label: 'الفواتير ومطالبات العملاء' },
  { value: '/attendance', label: 'حضور وانصراف الموظفين' },
  { value: '/subclaims', label: 'مستخلصات وتكاليف مقاولي الباطن' },
  { value: '/custodies', label: 'عُهد المواقع والموظفين' },
  { value: '/reports', label: 'التقارير الشاملة' },
  { value: '/welcome', label: 'شاشة الترحيب والمفضلات اليومية' },
  { value: '/website', label: 'البوابة التعريفية للموقع (PHI CONSTRUCT)' },
];

export function getDestinationForUser(
  profile: UserProfileRoutingData | null | undefined,
  fallbackPortal?: string | null
): string {
  // 1. If portal was explicitly chosen as partner
  if (fallbackPortal === 'partner') {
    return '/PartnerBalances';
  }

  if (!profile) {
    return '/Dashboard';
  }

  const perms = profile.permissions || {};

  // 2. Explicit default page configured in permissions or profile
  const explicit = perms.default_page || profile.default_page;
  if (explicit && explicit !== 'auto' && typeof explicit === 'string') {
    return explicit;
  }

  // 3. Super admin / Admin -> Executive Dashboard
  if (profile.is_admin || profile.role === 'super_admin' || profile.role === 'admin') {
    return '/Dashboard';
  }

  // 3b. Client (project owner) -> client portal: progress + finance of own projects only
  if (profile.role === 'client' && profile.linked_partner_id) {
    return '/client';
  }

  // 4. Partner / Owner -> Partner Balances
  if (profile.role === 'partner' || Boolean(profile.linked_partner_id)) {
    return '/PartnerBalances';
  }

  // If partner balances view is explicitly enabled and general dashboard is not
  if (perms.partner_balances?.view && !perms.dashboard?.view && !perms.fieldops?.view) {
    return '/PartnerBalances';
  }

  // 5. Site Engineer / Field Ops
  if (perms.fieldops?.view && !perms.dashboard?.view && !perms.financial_center?.view) {
    return '/fieldops';
  }

  // 6. Project Manager / Projects
  if (perms.projects?.view && !perms.dashboard?.view && !perms.accounts?.view) {
    return '/projects';
  }

  // 7. Accountant / Financials
  if ((perms.journal?.view || perms.payments?.view || perms.accounts?.view) && !perms.dashboard?.view) {
    return '/journal';
  }

  // 8. HR / Attendance only
  if (perms.attendance?.view && !perms.dashboard?.view && !perms.projects?.view) {
    return '/attendance';
  }

  // 9. Subcontractor
  if (profile.role === 'contractor' || (perms.subclaims?.view && !perms.dashboard?.view)) {
    return '/subclaims';
  }

  // 10. Dashboard or Global Summary only when explicitly allowed
  if (perms.dashboard?.view === true) {
    return '/Dashboard';
  }
  if (perms.global_summary?.view) {
    return '/GlobalSummary';
  }

  // 11. Find first permitted view route
  const moduleRoutePriority: Array<{ key: string; route: string }> = [
    { key: 'dashboard', route: '/Dashboard' },
    { key: 'global_summary', route: '/GlobalSummary' },
    { key: 'financial_center', route: '/financial-center' },
    { key: 'partner_balances', route: '/PartnerBalances' },
    { key: 'projects', route: '/projects' },
    { key: 'fieldops', route: '/fieldops' },
    { key: 'journal', route: '/journal' },
    { key: 'accounts', route: '/accounts' },
    { key: 'invoices', route: '/invoices' },
    { key: 'attendance', route: '/attendance' },
    { key: 'subclaims', route: '/subclaims' },
    { key: 'materials', route: '/materials' },
    { key: 'reports', route: '/reports' }
  ];

  for (const item of moduleRoutePriority) {
    if (perms[item.key]?.view) {
      return item.route;
    }
  }

  // Final fallback: no module granted (e.g. a new client account) -> own profile,
  // the only page every signed-in user may open. Avoids the "access denied" screen.
  return '/profile';
}
