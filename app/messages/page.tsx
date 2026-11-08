"use client";
import React, { useState } from 'react';
import { useMessagesLogic } from './MessagesLogic';
import { THEME } from '@/lib/theme';
import LayoutClient from '@/components/layout/LayoutClient';
import MasterPage from '@/components/MasterPage';
import { Hand, MessageSquare } from 'lucide-react';

export default function MessagesPage() {
    const { 
        users, messages, activeUserId, setActiveUserId, currentUserId, 
        isLoadingUsers, isLoadingMessages, newMessage, setNewMessage, 
        sendMessage, messagesEndRef, onlineUsers, unreadCounts
    } = useMessagesLogic();

    const [msgDetailsOpen, setMsgDetailsOpen] = useState<string | null>(null);

    const activeUser = users.find(u => u.id === activeUserId);
    const isUserOnline = (id: string) => onlineUsers.some(ou => ou.id === id);

    // Sort users: Online first, then by name
    const sortedUsers = [...users].sort((a, b) => {
        const aOnline = isUserOnline(a.id);
        const bOnline = isUserOnline(b.id);
        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;
        return (
        a.full_name || '').localeCompare(b.full_name || '');
    });

    return (
        <MasterPage title="التواصل الداخلي" subtitle="الرسائل والمحادثات بين فرق العمل">
        <div style={{ height: 'calc(100vh - 7.5rem)', display: 'flex', gap: '1.25rem', padding: '1.25rem', animation: 'fadeUp 0.5s ease-out' }}>
                
                {/* Users Sidebar */}
                <div style={{ width: '20rem', background: 'white', borderRadius: '14px', border: `1px solid ${THEME.border}`, display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ padding: '1.25rem', borderBottom: `1px solid ${THEME.border}`, background: '#f8fafc' }}>
                        <h2 style={{ margin: 0, fontWeight: 900, color: THEME.primary, fontSize: 'var(--fs-xl)' }}>المحادثات الداخلية</h2>
                        <p style={{ margin: '0.3125rem 0 0 0', fontSize: 'var(--fs-sm)', color: '#64748b' }}>اختر موظفاً لبدء المحادثة</p>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }} className="cinematic-scroll">
                        {isLoadingUsers ? (
                            <div style={{ textAlign: 'center', padding: '1.875rem', color: THEME.primary }}>جاري تحميل الموظفين...</div>
                        ) : (
                            sortedUsers.map((user) => {
                                const online = isUserOnline(user.id);
                                return (
                                <div 
                                    key={user.id}
                                    onClick={() => setActiveUserId(user.id)}
                                    style={{
                                        padding: '0.9375rem 1.25rem',
                                        borderBottom: `1px solid ${THEME.border}`,
                                        cursor: 'pointer',
                                        background: activeUserId === user.id ? '#f0f9ff' : 'white',
                                        borderLeft: activeUserId === user.id ? `4px solid ${THEME.primary}` : '4px solid transparent',
                                        transition: '0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: THEME.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 'var(--fs-lg)', flexShrink: 0 }}>
                                            {user.full_name?.charAt(0) || 'م'}
                                        </div>
                                        {online && <div style={{ position: 'absolute', bottom: 0, right: 0, width: '0.75rem', height: '0.75rem', background: '#10b981', borderRadius: '50%', border: '2px solid white' }}></div>}
                                    </div>
                                    <div style={{ overflow: 'hidden', flex: 1 }}>
                                        <div style={{ fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user.full_name || 'بدون اسم'}</div>
                                        <div style={{ fontSize: 'var(--fs-xs)', color: '#64748b', marginTop: '2px' }}>{user.role === 'super_admin' ? 'مدير نظام' : 'موظف'}</div>
                                    </div>
                                    {unreadCounts && unreadCounts[user.id] > 0 && (
                                        <div style={{ background: THEME.ruby, color: 'white', fontSize: 'var(--fs-xs)', fontWeight: 'bold', padding: '2px 0.375rem', borderRadius: '10px', minWidth: '1.25rem', textAlign: 'center', flexShrink: 0, boxShadow: '0 2px 5px rgba(225, 29, 72, 0.3)' }}>
                                            {unreadCounts[user.id]}
                                        </div>
                                    )}
                                </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div style={{ flex: 1, background: 'white', borderRadius: '14px', border: `1px solid ${THEME.border}`, display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', overflow: 'hidden', position: 'relative' }}>
                    {/* Background Pattern */}
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none', backgroundImage: 'radial-gradient(#27272a 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                    
                    {activeUserId ? (
                        <>
                            {/* Chat Header */}
                            <div style={{ padding: '1.25rem', borderBottom: `1px solid ${THEME.border}`, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '0.9375rem', zIndex: 1 }}>
                                <div style={{ position: 'relative' }}>
                                    <div style={{ width: '2.8125rem', height: '2.8125rem', borderRadius: '50%', background: THEME.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 'var(--fs-xl)' }}>
                                        {activeUser?.full_name?.charAt(0) || 'م'}
                                    </div>
                                    {isUserOnline(activeUserId) && <div style={{ position: 'absolute', bottom: '2px', right: '2px', width: '0.75rem', height: '0.75rem', background: '#10b981', borderRadius: '50%', border: '2px solid white' }}></div>}
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontWeight: 900, color: '#0f172a', fontSize: 'var(--fs-lg)' }}>{activeUser?.full_name}</h3>
                                    <span style={{ fontSize: 'var(--fs-sm)', color: isUserOnline(activeUserId) ? '#10b981' : '#94a3b8', fontWeight: 700 }}>
                                        {isUserOnline(activeUserId) ? '● متصل الآن' : 'غير متصل'}
                                    </span>
                                </div>
                            </div>

                            {/* Messages Container */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9375rem', zIndex: 1 }} className="cinematic-scroll">
                                {isLoadingMessages ? (
                                    <div style={{ textAlign: 'center', padding: '1.875rem', color: THEME.primary }}>جاري تحميل الرسائل...</div>
                                ) : messages.length === 0 ? (
                                    <div style={{ textAlign: 'center', margin: 'auto', color: '#94a3b8', fontWeight: 800 }}>
                                        <div style={{ fontSize: 'var(--fs-display)', marginBottom: '0.625rem', opacity: 0.5 }}><Hand size={34} aria-hidden="true" /></div>
                                        ابدأ المحادثة الآن...
                                    </div>
                                ) : (
                                    messages.map((msg) => {
                                        const isMine = msg.sender_id === currentUserId;
                                        return (
                                            <div key={msg.id} style={{ alignSelf: isMine ? 'flex-start' : 'flex-end', maxWidth: '70%' }}>
                                                <div style={{
                                                    background: isMine ? THEME.primary : '#f1f5f9',
                                                    color: isMine ? 'white' : '#1e293b',
                                                    padding: '0.75rem 1.125rem',
                                                    borderRadius: '16px',
                                                    borderTopRightRadius: isMine ? '0' : '16px',
                                                    borderTopLeftRadius: isMine ? '16px' : '0',
                                                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                                    fontSize: 'var(--fs-md)',
                                                    lineHeight: '1.5',
                                                    fontWeight: 700
                                                }}>
                                                    {msg.content}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3125rem', justifyContent: isMine ? 'flex-start' : 'flex-end', padding: '0 0.3125rem', position: 'relative' }}>
                                                    <span style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', fontWeight: 600 }}>
                                                        {new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {isMine && (
                                                        <span style={{ fontSize: 'var(--fs-xs)', color: msg.is_read ? '#3b82f6' : '#94a3b8' }}>
                                                            {msg.is_read ? '✓✓' : '✓'}
                                                        </span>
                                                    )}
                                                    
                                                    {/* Info Circle */}
                                                    <div 
                                                        onClick={() => setMsgDetailsOpen(msgDetailsOpen === msg.id ? null : msg.id)}
                                                        style={{ width: '0.875rem', height: '0.875rem', borderRadius: '50%', border: '1px solid #cbd5e1', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-xs)', cursor: 'pointer', fontWeight: 900 }}
                                                    >
                                                        i
                                                    </div>

                                                    {/* Details Popover */}
                                                    {msgDetailsOpen === msg.id && (
                                                        <div style={{ position: 'absolute', top: '100%', right: isMine ? '0' : 'auto', left: isMine ? 'auto' : '0', marginTop: '0.3125rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.625rem', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '11.25rem', fontSize: 'var(--fs-xs)', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.3125rem' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                <span style={{ fontWeight: 800 }}>وقت الإرسال:</span>
                                                                <span>{new Date(msg.created_at).toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: msg.is_read ? '#10b981' : '#94a3b8' }}>
                                                                <span style={{ fontWeight: 800 }}>وقت القراءة:</span>
                                                                <span>{msg.read_at ? new Date(msg.read_at).toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'لم تُقرأ بعد'}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Chat Input */}
                            <form onSubmit={sendMessage} style={{ padding: '1.25rem', borderTop: `1px solid ${THEME.border}`, background: 'rgba(255,255,255,0.9)', zIndex: 1, display: 'flex', gap: '0.625rem' }}>
                                <input 
                                    type="text" 
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="اكتب رسالتك هنا..." 
                                    style={{ flex: 1, padding: '0.9375rem 1.25rem', borderRadius: '14px', border: `1px solid ${THEME.border}`, outline: 'none', background: '#f8fafc', fontSize: 'var(--fs-md)', fontWeight: 700 }}
                                />
                                <button type="submit" disabled={!newMessage.trim()} style={{ background: THEME.primary, color: 'white', border: 'none', width: '3.125rem', height: '3.125rem', borderRadius: '50%', cursor: newMessage.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: newMessage.trim() ? 1 : 0.5, transition: '0.2s', fontSize: 'var(--fs-xl)' }}>
                                    ➤
                                </button>
                            </form>
                        </>
                    ) : (
                        <div style={{ margin: 'auto', textAlign: 'center', color: '#94a3b8', zIndex: 1 }}>
                            <div style={{ fontSize: 'var(--fs-display)', marginBottom: '0.9375rem', opacity: 0.3 }}><MessageSquare size={40} aria-hidden="true" /></div>
                            <h3 style={{ margin: 0, fontWeight: 900 }}>الرسائل الداخلية</h3>
                            <p style={{ marginTop: '0.3125rem', fontSize: 'var(--fs-md)' }}>قم باختيار محادثة من القائمة للبدء</p>
                        </div>
                    )}
                </div>

            </div>
            <style dangerouslySetInnerHTML={{__html: `
                .cinematic-scroll::-webkit-scrollbar { width: 6px; }
                .cinematic-scroll::-webkit-scrollbar-track { background: transparent; }
                .cinematic-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .cinematic-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}} />
                        </MasterPage>
    );
}
