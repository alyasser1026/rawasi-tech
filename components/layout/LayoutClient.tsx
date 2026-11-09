"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isNetworkError } from '@/lib/offline/offlineExecutor';
import { usePermissions } from '@/lib/PermissionsContext';
import LoadingScreen from '@/components/LoadingScreen';
import EnterpriseShell from '@/components/EnterpriseShell';

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading } = usePermissions();
  const [isInitialized, setIsInitialized] = useState(false);
  const isPublicPage = pathname === '/' || pathname === '/login' || pathname === '/signup' || pathname === '/website' || pathname.startsWith('/website/') || pathname.startsWith('/construct');

  useEffect(() => {
    if (isPublicPage) return;
    let cancelled = false;
    const verifyRealUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        router.replace('/login');
        return;
      }

      // Offline boot: keep valid local session alive instead of signing out on network drop
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsInitialized(true);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, is_active')
          .eq('id', session.user.id)
          .single();
        if (cancelled) return;

        if (error) {
          if (isNetworkError(error)) {
            setIsInitialized(true);
            return;
          }
          // PGRST116 = profile deleted -> explicit sign out
          if ((error as any).code === 'PGRST116') {
            await supabase.auth.signOut();
            window.location.href = '/login';
            return;
          }
          setIsInitialized(true);
          return;
        }

        if (!data || data.is_active === false) {
          await supabase.auth.signOut();
          window.location.href = '/login';
        } else {
          setIsInitialized(true);
        }
      } catch (err) {
        if (!cancelled) {
          setIsInitialized(true);
        }
      }
    };
    void verifyRealUser();
    return () => { cancelled = true; };
  }, [isPublicPage, pathname, router]);

  if (isPublicPage) return <>{children}</>;
  if (loading && !isInitialized) return <LoadingScreen message="جاري تهيئة النظام..." subMessage="يتم الآن تجميع صلاحياتك الخاصة وتأمين الواجهة" fullScreen />;
  return <EnterpriseShell>{children}</EnterpriseShell>;
}
