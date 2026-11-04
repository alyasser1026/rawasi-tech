"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/lib/PermissionsContext';
import LoadingScreen from '@/components/LoadingScreen';
import EnterpriseShell from '@/components/EnterpriseShell';

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading } = usePermissions();
  const [isInitialized, setIsInitialized] = useState(false);
  const isPublicPage = pathname === '/login' || pathname === '/signup';

  useEffect(() => {
    if (isPublicPage) return;
    let cancelled = false;
    const verifyRealUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) { router.replace('/login'); return; }
      const { data, error } = await supabase.from('profiles').select('id').eq('id', session.user.id).single();
      if (cancelled) return;
      if (error || !data) {
        await supabase.auth.signOut();
        window.location.href = '/login';
      } else setIsInitialized(true);
    };
    verifyRealUser();
    return () => { cancelled = true; };
  }, [isPublicPage, pathname, router]);

  if (isPublicPage) return <>{children}</>;
  if (loading && !isInitialized) return <LoadingScreen message="جاري تهيئة النظام..." subMessage="يتم الآن تجميع صلاحياتك الخاصة وتأمين الواجهة" fullScreen />;
  return <EnterpriseShell>{children}</EnterpriseShell>;
}
