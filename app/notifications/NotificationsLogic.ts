import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export function useNotificationsLogic() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    // Each user of this hook (page and bell dialog) needs its own channel; a shared name makes
    // supabase-js reuse an already-subscribed channel and throw when callbacks are added.
    const channelName = useRef(`notifications-${Math.random().toString(36).slice(2)}`);

    useEffect(() => {
        const fetchUserAndNotifications = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            setUserId(session.user.id);

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setNotifications(data);
                
                // علّم الإشعارات كمقروءة تلقائياً عند فتح الصفحة
                const hasUnread = data.some(n => !n.is_read);
                if (hasUnread) {
                    supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id).eq('is_read', false).then();
                }
            }
            setIsLoading(false);
        };

        fetchUserAndNotifications();
    }, []);

    // 🚀 Realtime Subscription
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(channelName.current)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
                setNotifications(prev => [payload.new, ...prev]);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
                setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    const markAsRead = async (id: string) => {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        if (!error) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        }
    };

    const markAllAsRead = async () => {
        if (!userId) return;
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
        if (!error) {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        }
    };

    return {
        notifications,
        isLoading,
        markAsRead,
        markAllAsRead
    };
}
