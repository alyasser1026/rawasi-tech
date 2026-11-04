"use client";
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { supabase } from './supabase';

const PermissionsContext = createContext<any>(null);

export const PermissionsProvider = ({ children }: { children: React.ReactNode }) => {
    const [permissions, setPermissions] = useState<any>(null);
    const [role, setRole] = useState<string>('client');
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        let isMounted = true; // 🛡️ حماية ضد الـ Memory Leak وتحديث الواجهة وهي مقفولة

        const fetchPerms = async (sessionUser?: any) => {
            if (!permissions) setLoading(true); 
            
            try {
                // الاعتماد على اليوزر الممرر من الـ Listener لتخفيف الضغط
                let currentUser = sessionUser;
                if (!currentUser) {
                    const { data: { user } } = await supabase.auth.getUser();
                    currentUser = user;
                }
                
                if (currentUser && isMounted) {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('id, role, permissions, is_admin, full_name, avatar_url')
                        .eq('id', currentUser.id)
                        .single();
                        
                    if (data && isMounted) {
                        const userRole = data.is_admin ? 'super_admin' : (data.role || 'client');
                        setRole(userRole);
                        setPermissions(data.permissions || {});
                        setProfile({ ...data, id: currentUser.id });
                        setUser(currentUser);
                    }
                } else if (isMounted) {
                     setLoading(false);
                }
            } catch (err) {
                console.error("❌ خطأ في تحميل الصلاحيات:", err);
            } finally {
                if (isMounted) setLoading(false); 
            }
        };

        // 🚀 السحر هنا: نعتمد فقط على الـ Listener لمنع تكرار الطلبات (No Double Fetch)
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                fetchPerms(session?.user);
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
    }, []); // 👈 مصفوفة فارغة لضمان عدم إعادة التشغيل نهائياً

    const can = (moduleName: string, actionName: string) => {
        if (role === 'super_admin' || role === 'admin') return true;
        return permissions?.[moduleName]?.[actionName] === true;
    };

    const value = useMemo(() => ({
        can, role, permissions, loading, profile, user, userId: user?.id || profile?.id
    }), [permissions, role, loading, profile, user]);

    // 🚨 لا تعرض شاشة سوداء طالما الصلاحيات موجودة مسبقاً
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