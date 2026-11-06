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

const ROUTE_MODULE_MAP: Record<string, string> = {
  '/Dashboard': 'dashboard',
  '/GlobalSummary': 'global_summary',
  '/financial-center': 'financial_center',
  '/financial-statements': 'financial_statements',
  '/accounts': 'accounts',
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
  '/fieldops': 'fieldops',
  '/projects': 'projects',
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
  '/boqbudget': 'boqbudget',
  '/costallocation': 'costallocation',
  '/project-ledger': 'project_ledger',
  '/joborders': 'projects',
  '/employees': 'employees',
  '/team': 'team',
  '/labor_logs': 'labor_logs',
  '/attendance': 'attendance',
  '/laborcost': 'laborcost',
  '/payroll': 'payroll',
  '/violations': 'violations',
  '/reports': 'reports',
  '/import': 'import',
  '/settings': 'settings',
  '/profile': 'profile',
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
        if (pathname !== "/login" && pathname !== "/signup") router.replace("/login");
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
        if (pathname !== "/login" && pathname !== "/signup") router.replace("/login");
      } else if (session && !user) {
        setUser(session.user);
      } else if (!session && event === "TOKEN_REFRESHED") {
        setUser(null);
        setProfile(null);
        try { sharedQueryClient.clear(); } catch {}
        if (pathname !== "/login" && pathname !== "/signup") router.replace("/login");
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
    if (loading || !user || !profile) return true; // Don't block while loading
    if (pathname === '/' || pathname === '/login' || pathname === '/signup' || pathname.startsWith('/api')) return true;
    if (requiredRoles?.length && !profile.is_admin && !requiredRoles.includes(profile.role)) return false;
    
    // 🛡️ السماح دائماً للملف الشخصي لأي مستخدم مسجل
    if (pathname === '/profile') return true;

    const requiredModule = ROUTE_MODULE_MAP[pathname];
    if (!requiredModule) return true; // If route not mapped, let it pass (or you could strictly block it)

    return can(requiredModule, 'view');
  }, [pathname, profile, loading, user, requiredRoles]);

  if (!user) {
    if (pathname !== '/login' && pathname !== '/signup') {
      return <LoadingScreen message="جاري تأمين الاتصال..." subMessage="نتحقق من صلاحيات الدخول الآمن لنظام فاي تك" fullScreen={true} />;
    }
    if (loading) return <>{children}</>;
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
