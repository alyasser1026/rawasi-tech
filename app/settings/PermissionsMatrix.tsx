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
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <div style={{ fontSize: '30px', animation: 'spin 1s linear infinite', marginBottom: '15px' }}><Hourglass size={26} aria-hidden="true" /></div>
                <div style={{ fontWeight: 800, color: THEME.primary }}>جاري استدعاء مصفوفة الصلاحيات...</div>
            </div>
        );
    }

    return (
        <div style={{ animation: 'fadeUp 0.5s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.9), rgba(255, 255, 255, 0.8))', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(10px)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                <div>
                    <h2 style={{ fontSize: '20px', color: THEME.primary, margin: '0 0 5px 0', fontWeight: 900 }}>مصفوفة الصلاحيات (Permissions Matrix)</h2>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 700 }}>
                        هذه المصفوفة تعرض ملخص صلاحيات المستخدمين. لتعديل الصلاحيات بالتفصيل، يُرجى الانتقال إلى إدارة الفريق.
                    </p>
                </div>
                <button 
                    onClick={() => router.push('/team')}
                    style={{ background: THEME.primary, color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: 900, boxShadow: '0 4px 15px rgba(15,23,42,0.2)', transition: '0.3s' }}
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
                            <th style={{ padding: '15px', borderBottom: `2px solid ${THEME.border}`, textAlign: 'right', color: THEME.primary, fontSize: '13px' }}>المستخدم</th>
                            <th style={{ padding: '15px', borderBottom: `2px solid ${THEME.border}`, color: THEME.primary, fontSize: '13px' }}>الدور</th>
                            {modules.map(mod => (
                                <th key={mod.key} style={{ padding: '15px', borderBottom: `2px solid ${THEME.border}`, color: THEME.primary, fontSize: '13px' }}>
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
                                    <td style={{ padding: '15px', textAlign: 'right', fontWeight: 800, color: '#1e293b', fontSize: '14px' }}>
                                        {profile.full_name || profile.username || 'مستخدم مجهول'}
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <span style={{ 
                                            padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 900,
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
                                            <td key={mod.key} style={{ padding: '15px', fontSize: '16px' }}>
                                                {hasAccess ? <CircleCheck size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        {profiles.length === 0 && (
                            <tr>
                                <td colSpan={modules.length + 2} style={{ padding: '30px', color: '#94a3b8', fontWeight: 700 }}>
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
