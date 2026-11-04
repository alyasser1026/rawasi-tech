"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { THEME } from '@/lib/theme';
import { useRouter } from 'next/navigation';
import { Hourglass, CircleCheck, X } from 'lucide-react';

export default function PermissionsMatrix() {
    const [profiles, setProfiles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const modules = [
        { key: 'dashboard', name: 'الداشبورد' },
        { key: 'accounts', name: 'الحسابات' },
        { key: 'journal', name: 'القيود اليومية' },
        { key: 'projects', name: 'المشاريع' },
        { key: 'partners', name: 'الشركاء' },
        { key: 'employees', name: 'الموظفين' },
        { key: 'project_ledger', name: 'دفتر التكاليف' },
        { key: 'reports', name: 'التقارير' },
        { key: 'settings', name: 'الإعدادات' },
    ];

    useEffect(() => {
        const fetchProfiles = async () => {
            const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
            if (!error && data) {
                setProfiles(data);
            }
            setIsLoading(false);
        };
        fetchProfiles();
    }, []);

    if (isLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '3.125rem' }}>
                <div style={{ fontSize: 'var(--fs-3xl)', animation: 'spin 1s linear infinite', marginBottom: '0.9375rem' }}><Hourglass size={26} aria-hidden="true" /></div>
                <div style={{ fontWeight: 800, color: THEME.primary }}>جاري استدعاء مصفوفة الصلاحيات...</div>
            </div>
        );
    }

    return (
        <div style={{ animation: 'fadeUp 0.5s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.9), rgba(255, 255, 255, 0.8))', padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(10px)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                <div>
                    <h2 style={{ fontSize: 'var(--fs-xl)', color: THEME.primary, margin: '0 0 0.3125rem 0', fontWeight: 900 }}>مصفوفة الصلاحيات (Permissions Matrix)</h2>
                    <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: '#64748b', fontWeight: 700 }}>
                        هذه المصفوفة تعرض ملخص صلاحيات المستخدمين. لتعديل الصلاحيات بالتفصيل، يُرجى الانتقال إلى إدارة الفريق.
                    </p>
                </div>
                <button 
                    onClick={() => router.push('/team')}
                    style={{ background: THEME.primary, color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 900, boxShadow: '0 4px 15px rgba(15,23,42,0.2)', transition: '0.3s' }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    الانتقال لإدارة الفريق
                </button>
            </div>

            <div style={{ overflowX: 'auto', background: 'white', borderRadius: '16px', border: `1px solid ${THEME.border}`, boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                    <thead style={{ background: '#f8fafc' }}>
                        <tr>
                            <th style={{ padding: '0.9375rem', borderBottom: `2px solid ${THEME.border}`, textAlign: 'right', color: THEME.primary, fontSize: 'var(--fs-sm)' }}>المستخدم</th>
                            <th style={{ padding: '0.9375rem', borderBottom: `2px solid ${THEME.border}`, color: THEME.primary, fontSize: 'var(--fs-sm)' }}>الدور</th>
                            {modules.map(mod => (
                                <th key={mod.key} style={{ padding: '0.9375rem', borderBottom: `2px solid ${THEME.border}`, color: THEME.primary, fontSize: 'var(--fs-sm)' }}>
                                    {mod.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {profiles.map(profile => {
                            const isSuperAdmin = profile.role === 'admin' || profile.is_admin;
                            return (
                                <tr key={profile.id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                                    <td style={{ padding: '0.9375rem', textAlign: 'right', fontWeight: 800, color: '#1e293b', fontSize: 'var(--fs-md)' }}>
                                        {profile.full_name || profile.username || 'مستخدم مجهول'}
                                    </td>
                                    <td style={{ padding: '0.9375rem' }}>
                                        <span style={{ 
                                            padding: '0.25rem 0.625rem', borderRadius: '8px', fontSize: 'var(--fs-xs)', fontWeight: 900,
                                            background: isSuperAdmin ? '#fee2e2' : '#e0e7ff',
                                            color: isSuperAdmin ? '#dc2626' : '#4f46e5'
                                        }}>
                                            {isSuperAdmin ? 'مدير نظام' : 'مستخدم'}
                                        </span>
                                    </td>
                                    {modules.map(mod => {
                                        const perm = profile.permissions?.[mod.key]?.view;
                                        const hasAccess = isSuperAdmin || perm;
                                        return (
                                            <td key={mod.key} style={{ padding: '0.9375rem', fontSize: 'var(--fs-lg)' }}>
                                                {hasAccess ? <CircleCheck size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        {profiles.length === 0 && (
                            <tr>
                                <td colSpan={modules.length + 2} style={{ padding: '1.875rem', color: '#94a3b8', fontWeight: 700 }}>
                                    لا يوجد مستخدمين مسجلين
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
