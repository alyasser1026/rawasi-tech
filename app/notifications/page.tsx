"use client";
import React from 'react';
import { useNotificationsLogic } from './NotificationsLogic';
import { THEME } from '@/lib/theme';
import { Hourglass, Inbox, Siren, CircleCheck, ClipboardList, Bell } from 'lucide-react';

export default function NotificationsPage() {
    const { notifications, isLoading, markAsRead, markAllAsRead } = useNotificationsLogic();

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', animation: 'fadeUp 0.5s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.9), rgba(255, 255, 255, 0.8))', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(10px)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                <div>
                    <h2 style={{ fontSize: '24px', color: THEME.primary, margin: '0 0 5px 0', fontWeight: 900 }}>مركز الإشعارات</h2>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 700 }}>
                        متابعة التنبيهات والأحداث الخاصة بك في النظام
                    </p>
                </div>
                {notifications.some(n => !n.is_read) && (
                    <button 
                        onClick={markAllAsRead}
                        style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, transition: '0.3s' }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569'; }}
                    >
                        ✓ تحديد الكل كمقروء
                    </button>
                )}
            </div>

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '50px' }}>
                    <div style={{ fontSize: '30px', animation: 'spin 1s linear infinite', marginBottom: '15px' }}><Hourglass size={26} aria-hidden="true" /></div>
                    <div style={{ fontWeight: 800, color: THEME.primary }}>جاري جلب الإشعارات...</div>
                </div>
            ) : notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px', background: 'rgba(255,255,255,0.5)', borderRadius: '14px', border: '2px dashed #cbd5e1' }}>
                    <div style={{ fontSize: '50px', marginBottom: '15px', opacity: 0.5 }}><Inbox size={40} aria-hidden="true" /></div>
                    <div style={{ fontWeight: 900, color: '#475569', fontSize: '18px' }}>لا توجد إشعارات حالياً</div>
                    <p style={{ color: '#94a3b8', margin: '5px 0 0 0', fontWeight: 700 }}>سيتم إعلامك هنا عند وجود أي تحديثات مهمة</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {notifications.map(notif => (
                        <div key={notif.id} 
                             style={{ 
                                 background: notif.is_read ? 'white' : '#f0f9ff',
                                 padding: '20px', 
                                 borderRadius: '16px',
                                 border: `1px solid ${notif.is_read ? '#e2e8f0' : '#bae6fd'}`,
                                 boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                                 display: 'flex',
                                 alignItems: 'flex-start',
                                 gap: '15px',
                                 transition: 'all 0.3s ease'
                             }}>
                            <div style={{ fontSize: '24px', flexShrink: 0, marginTop: '2px' }}>
                                {notif.type === 'alert' ? <Siren size={20} aria-hidden="true" /> : notif.type === 'success' ? <CircleCheck size={20} aria-hidden="true" /> : notif.type === 'task' ? <ClipboardList size={20} aria-hidden="true" /> : <Bell size={20} aria-hidden="true" />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: notif.is_read ? '#475569' : '#0f172a' }}>
                                        {notif.message || notif.content}
                                    </h4>
                                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                        {new Date(notif.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                                    </span>
                                </div>
                                {!notif.is_read && (
                                    <button 
                                        onClick={() => markAsRead(notif.id)}
                                        style={{ background: 'transparent', border: 'none', color: THEME.primary, fontWeight: 800, fontSize: '12px', cursor: 'pointer', padding: 0, marginTop: '5px' }}
                                    >
                                        علامة كمقروء
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
