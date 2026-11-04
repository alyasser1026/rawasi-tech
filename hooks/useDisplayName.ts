"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/lib/PermissionsContext';

/**
 * One display name for the whole app: the profile name, then the sign-up name,
 * then the part of the e-mail before "@". `hasProfileName` tells screens when to
 * invite the user to complete their profile.
 */
export function useDisplayName() {
  const { profile } = usePermissions();
  const [accountName, setAccountName] = useState('');

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!alive || !user) return;
      const metaName = String(user.user_metadata?.full_name || user.user_metadata?.name || '').trim();
      setAccountName(metaName || (user.email ? user.email.split('@')[0] : ''));
    });
    return () => { alive = false; };
  }, []);

  const profileName = String(profile?.full_name || '').trim();
  const name = profileName || accountName || 'مستخدم فاي تك';
  return { name, firstName: name.split(/\s+/)[0], initial: name.slice(0, 1), hasProfileName: Boolean(profileName) };
}
