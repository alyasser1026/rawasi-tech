"use client";
import { useEffect, useState, createContext, useContext, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import LoadingScreen from '@/components/LoadingScreen';
import { supabase } from "@/lib/supabase";
import { OctagonX } from 'lucide-react';
import { notify } from '@/lib/notify';
import { sharedQueryClient } from '@/components/QueryProvider';

const AuthContext = createContext<{
  user: any;
  profile: any;
  loading: boolean;
  can: (module: string, action: string) => boolean;
} | null>(null);

type ModuleRequirement = string | readonly string[];

const ROUTE_MODULE_MAP: Record<string, ModuleRequirement> = {
  '/Dashboard': 'dashboard',
  '/dashboard': 'dashboard',
  '/welcome': ['home', 'dashboard', 'projects', 'fieldops', 'journal', 'accounts', 'partner_balances'],
  '/GlobalSummary': 'global_summary',
  '/performance': ['performance', 'dashboard', 'reports'],
  '/financial-center': 'financial_center',
  '/financial-statements': 'financial_statements',
  '/accounts': 'accounts',
  '/ManualJournals': ['manual_journals', 'journal'],
  '/journal': 'journal',
  '/ledger': 'ledger',
  '/trialbalance': 'trialbalance',
  '/journal-errors': 'journal_errors',
  '/cashflows': 'cashflows',
  '/PaymentVouchers': 'payments',
  '/ReceiptVouchers': 'receipts',
  '/revenue': 'revenue',
  '/expenses': 'expenses',
  '/invoices': 'invoices',
  '/vat-return': ['vat_return', 'invoices'],
  '/ar-aging': ['ar_aging', 'invoices'],
  '/custodies': ['custodies', 'expenses', 'payments'],
  '/cash-closing': ['cash_closing', 'cashflows'],
  '/fixed-assets': ['fixed_assets', 'accounts'],
  '/audit': ['audit', 'journal_errors', 'reports'],
  '/financialplan': ['financialplan', 'financial_center'],
  '/fieldops': 'fieldops',
  '/bim': ['bim_viewer', 'projects', 'fieldops'],
  '/projects': 'projects',
  '/requests-handovers': ['requests_handovers', 'projects'],
  '/purchase-orders': ['purchase_orders', 'materials'],
  '/inventory': ['inventory', 'materials', 'materialitems'],
  '/materials': 'materials',
  '/materialitems': 'materialitems',
  '/material_issues': 'material_issues',
  '/subclaims': 'subclaims',
  '/subcontractor-costs': 'subcontractor_costs',
  '/boqcatalog': 'boqcatalog',
  '/partners': 'partners',
  '/PartnerBalances': 'partner_balances',
  '/statement': 'statement',
  '/overhead': 'project_overhead',
  '/boqbudget': ['boqbudget', 'boq_budget'],
  '/boqbudget/bulk': ['bulk_budget', 'boqbudget', 'boq_budget'],
  '/costallocation': ['costallocation', 'cost_allocation'],
  '/project-ledger': 'project_ledger',
  '/profitability': ['project_profitability', 'project_ledger', 'projects'],
  '/joborders': ['job_orders', 'projects'],
  '/employees': 'employees',
  '/team': 'team',
  '/labor_logs': 'labor_logs',
  '/attendance': 'attendance',
  '/laborcost': 'laborcost',
  '/payroll': 'payroll',
  '/violations': 'violations',
  '/messages': 'messages',
  '/notifications': 'notifications',
  '/reports': 'reports',
  '/import': 'import',
  '/settings': 'settings',
  '/settings/companies': ['companies', 'settings'],
  '/website-admin': 'settings',
  '/departments': 'settings',
  '/bot-users': 'settings',
  '/profile': 'profile',
};

const ROUTE_MODULE_MAP_LOWER: Record<string, ModuleRequirement> = Object.fromEntries(
  Object.entries(ROUTE_MODULE_MAP).map(([routePath, mod]) => [routePath.toLowerCase(), mod])
);

const ROUTE_PREFIX_ENTRIES = Object.entries(ROUTE_MODULE_MAP_LOWER).sort(
  (a, b) => b[0].length - a[0].length
);

export function hasAnyErpModulePermission(profile: any): boolean {
  if (!profile) return false;
  const perms = profile.permissions || {};
  for (const key of Object.keys(perms)) {
    if (key === 'profile' || key === 'default_page') continue;
    const entry = perms[key];
    if (Array.isArray(entry)) {
      if (entry.includes('view')) return true;
    } else if (entry && typeof entry === 'object' && entry.view === true) {
      return true;
    }
  }
  return false;
}

export function isErpStaffOrPartnerProfile(profile: any): boolean {
  if (!profile) return false;
  if (profile.is_admin === true || profile.role === 'admin' || profile.role === 'super_admin') {
    return true;
  }
  if (hasAnyErpModulePermission(profile)) {
    return true;
  }
  if (profile.linked_partner_id && profile.role !== 'client') {
    return true;
  }
  return false;
}

function normalizeGuardPath(path?: string | null): string {
  const cleaned = (path || '/').split('?')[0].split('#')[0].replace(/\/+$/, '');
  return cleaned || '/';
}

export const isPublicRoute = (path?: string | null) => {
  if (!path) return false;
  const lower = normalizeGuardPath(path).toLowerCase();
  return (
    lower === '/' ||
    lower === '/login' ||
    lower === '/signup' ||
    lower === '/website' ||
    lower.startsWith('/website/') ||
    lower === '/sections' ||
    lower.startsWith('/sections/') ||
    lower === '/store' ||
    lower.startsWith('/store/') ||
    lower === '/real-estate' ||
    lower.startsWith('/real-estate/') ||
    lower === '/verify' ||
    lower.startsWith('/verify/') ||
    lower === '/construct' ||
    lower.startsWith('/construct/')
  );
};

export default function AuthGuard({ children, requiredRoles }: { children: React.ReactNode; requiredRoles?: readonly string[] }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkUser = async () => {
      if (!user) setLoading(true);
      
      let session = null;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          if (error.message?.includes('Refresh Token') || (error as any)?.code === 'refresh_token_not_found') {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          }
        } else {
          session = data?.session ?? null;
        }
      } catch (err: any) {
        if (err?.message?.includes('Refresh Token') || err?.code === 'refresh_token_not_found') {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        }
      }

      if (!session) {
        setUser(null);
        setProfile(null);
        void sharedQueryClient.cancelQueries();
        if (!isPublicRoute(pathname)) {
          const next = pathname && pathname !== '/login' ? `?redirect=${encodeURIComponent(pathname)}` : '';
          router.replace(`/login${next}`);
        }
        setLoading(false);
        return;
      }

      setUser(session.user);

      const cacheKey = `phi_cached_profile_${session.user.id}`;
      let cachedProfile: any = null;
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) cachedProfile = JSON.parse(raw);
      } catch { /* ignore */ }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (cachedProfile?.is_active === false) {
          await supabase.auth.signOut();
          router.replace("/login");
          setLoading(false);
          return;
        }
        if (cachedProfile) setProfile(cachedProfile);
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileErr && cachedProfile) {
        setProfile(cachedProfile);
        setLoading(false);
        return;
      }

      if (profileData?.is_active === false) {
        await supabase.auth.signOut();
        notify("تم إيقاف حسابك من قبل الإدارة. يرجى مراجعة مدير النظام.");
        router.replace("/login");
        setLoading(false);
        return;
      }

      if (profileData) {
        try { localStorage.setItem(cacheKey, JSON.stringify(profileData)); } catch { /* ignore */ }
      }
      setProfile(profileData);
      setLoading(false);
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        try { sharedQueryClient.clear(); } catch {}
        if (!isPublicRoute(pathname)) router.replace("/login");
      } else if (session && !user) {
        setUser(session.user);
      } else if (!session && event === "TOKEN_REFRESHED") {
        setUser(null);
        setProfile(null);
        try { sharedQueryClient.clear(); } catch {}
        if (!isPublicRoute(pathname)) router.replace("/login");
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, [pathname, router]); 

  const can = (moduleName: string, action: string) => {
    if (!profile) return false;
    if (profile.role === 'admin' || profile.is_admin) return true; 
    
    const perms = profile.permissions || {};
    // Check for array format (old) or object format (new)
    if (Array.isArray(perms[moduleName])) {
      return perms[moduleName].includes(action);
    } else if (perms[moduleName] && typeof perms[moduleName] === 'object') {
      return !!perms[moduleName][action];
    }
    return false;
  };

  const isAuthorized = useMemo(() => {
    const normalizedPath = normalizeGuardPath(pathname).toLowerCase();
    if (loading) return true; // Loading screen prevents premature flash below
    if (normalizedPath === '/' || isPublicRoute(normalizedPath) || normalizedPath.startsWith('/api')) return true;
    if (!user || !profile) return false; // Fail-Closed if profile is missing after load
    if (requiredRoles?.length && !profile.is_admin && !requiredRoles.includes(profile.role)) return false;

    // 🛡️ الملف الشخصي متاح للمسجلين (مع عزل واجهة العملاء عن بيانات الموظفين)
    if (normalizedPath === '/profile') return true;

    // 🏗️ بوابة متابعة المشروع للعملاء المرتبطين بشريك أو الإدارة
    if (normalizedPath === '/client') {
      return Boolean(
        profile.is_admin ||
          profile.role === 'admin' ||
          profile.role === 'super_admin' ||
          profile.linked_partner_id
      );
    }

    // 🚫 عزل حسابات عملاء المتجر: منع الدخول إلى جميع مسارات النظام الداخلي Fail-Closed
    if (!isErpStaffOrPartnerProfile(profile)) {
      return false;
    }

    // ✅ مسارات التواصل والترحيب مسموحة فقط لموظفي وشركاء النظام الداخلي
    if (
      normalizedPath === '/welcome' ||
      normalizedPath === '/messages' ||
      normalizedPath === '/notifications'
    ) {
      return true;
    }

    let requiredModule: ModuleRequirement | undefined =
      (pathname ? ROUTE_MODULE_MAP[pathname] : undefined) || ROUTE_MODULE_MAP_LOWER[normalizedPath];
    if (!requiredModule) {
      const prefixMatch = ROUTE_PREFIX_ENTRIES.find(([prefix]) => normalizedPath.startsWith(`${prefix}/`));
      requiredModule = prefixMatch?.[1];
    }

    if (!requiredModule) {
      return Boolean(profile.is_admin || profile.role === 'admin' || profile.role === 'super_admin');
    }

    if (typeof requiredModule === 'string') {
      return can(requiredModule, 'view');
    }

    return requiredModule.some((mod) => can(mod, 'view'));
  }, [pathname, profile, loading, user, requiredRoles]);

  useEffect(() => {
    if (!loading && user && profile && pathname === '/dashboard' && isAuthorized) {
      router.replace('/Dashboard');
    }
  }, [loading, user, profile, pathname, isAuthorized, router]);

  if (!user || (loading && !isPublicRoute(pathname))) {
    if (!isPublicRoute(pathname)) {
      return <LoadingScreen message="جاري تأمين الاتصال..." subMessage="نتحقق من صلاحيات الدخول الآمن لنظام فاي تك" fullScreen={true} />;
    }
    return <>{children}</>;
  }

  if (!isAuthorized) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', background: '#f8fafc', padding: '1.25rem', textAlign: 'center' }}>
        <div style={{ marginBottom: '0.9375rem', fontSize: 'var(--fs-display)' }}>
          <OctagonX size={40} aria-hidden="true" />
        </div>
        <h1 style={{ color: '#dc2626', fontWeight: 900, fontSize: 'var(--fs-3xl)', margin: '0' }}>إنت إيه اللي جابك هنا؟!</h1>
        <button 
          onClick={() => router.push('/')}
          style={{ marginTop: '1.5625rem', padding: '0.875rem 1.875rem', background: '#dc2626', color: 'white', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 'var(--fs-lg)', boxShadow: '0 4px 15px rgba(220,38,38,0.4)', transition: '0.3s' }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          العودة للرئيسية فوراً
        </button>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthGuard");
  return context;
};
