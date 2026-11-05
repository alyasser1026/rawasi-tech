"use client";
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { supabase } from './supabase';

const PermissionsContext = createContext<any>(null);

const profileCacheKey = (uid: string) => `phi_cached_profile_${uid}`;

function readCachedProfile(uid: string): any | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(profileCacheKey(uid));
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeCachedProfile(uid: string, profileData: any): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(profileCacheKey(uid), JSON.stringify(profileData));
    } catch {
        /* ignore */
    }
}

export const PermissionsProvider = ({ children }: { children: React.ReactNode }) => {
    const [permissions, setPermissions] = useState<any>(null);
    const [role, setRole] = useState<string>('client');
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;

        const applyProfile = (currentUser: any, data: any) => {
            const userRole = data.is_admin ? 'super_admin' : (data.role || 'client');
            setRole(userRole);
            setPermissions(data.permissions || {});
            setProfile({ ...data, id: currentUser.id });
            setUser(currentUser);
        };

        const fetchPerms = async (sessionUser?: any) => {
            if (!permissions) setLoading(true);

            try {
                let currentUser = sessionUser;
                if (!currentUser) {
                    const { data: { session } } = await supabase.auth.getSession();
                    currentUser = session?.user ?? null;
                }

                if (currentUser && isMounted) {
                    const cached = readCachedProfile(currentUser.id);
                    if (cached && (!navigator.onLine || !permissions)) {
                        applyProfile(currentUser, cached);
                    }

                    if (typeof navigator !== 'undefined' && !navigator.onLine) {
                        if (!cached) {
                            setUser(currentUser);
                            setPermissions({});
                        }
                        return;
                    }

                    const { data, error } = await supabase
                        .from('profiles')
                        .select('id, role, permissions, is_admin, full_name, avatar_url, is_active')
                        .eq('id', currentUser.id)
                        .single();

                    if (!error && data && isMounted) {
                        writeCachedProfile(currentUser.id, data);
                        applyProfile(currentUser, data);
                    }
                } else if (isMounted) {
                    setLoading(false);
                }
            } catch (err) {
                console.error("خطأ في تحميل الصلاحيات:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                void fetchPerms(session?.user);
            } else if (event === 'SIGNED_OUT') {
                if (isMounted) {
                    setPermissions(null);
                    setProfile(null);
                    setUser(null);
                    setRole('client');
                    setLoading(false);
                }
            }
        });

        return () => {
            isMounted = false;
            authListener.subscription.unsubscribe();
        };
    }, []);

    const can = (moduleName: string, actionName: string) => {
        if (role === 'super_admin' || role === 'admin') return true;
        const modPerms = permissions?.[moduleName];
        if (Array.isArray(modPerms)) return modPerms.includes(actionName);
        return modPerms?.[actionName] === true;
    };

    const value = useMemo(() => ({
        can, role, permissions, loading, profile, user, userId: user?.id || profile?.id
    }), [permissions, role, loading, profile, user]);

    if (loading && !permissions) {
        return (
            <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f7f8" }}>
                <div className="loader" style={{ fontWeight: 900, color: "#c2410c" }}>جاري إعداد مركز القيادة...</div>
            </div>
        );
    }

    return (
        <PermissionsContext.Provider value={value}>
            {children}
        </PermissionsContext.Provider>
    );
};

export const usePermissions = () => {
    const context = useContext(PermissionsContext);
    if (!context) throw new Error("usePermissions must be used within a PermissionsProvider");
    return context;
};
