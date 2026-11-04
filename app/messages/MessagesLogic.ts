import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { usePresence } from '@/hooks/usePresence';
import { notify } from '@/lib/notify';

export function useMessagesLogic() {
    const [users, setUsers] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [activeUserId, setActiveUserId] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [unreadCounts, setUnreadCounts] = useState<{[key: string]: number}>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch initial data
    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            setCurrentUserId(session.user.id);

            // Fetch all other users
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, role')
                .neq('id', session.user.id)
                .order('full_name');
            
            if (profiles) setUsers(profiles);

            // Fetch initial unread counts
            const { data: unreadData } = await supabase
                .from('messages')
                .select('sender_id')
                .eq('receiver_id', session.user.id)
                .eq('is_read', false);
            
            if (unreadData) {
                const counts: {[key: string]: number} = {};
                unreadData.forEach((m: any) => {
                    counts[m.sender_id] = (counts[m.sender_id] || 0) + 1;
                });
                setUnreadCounts(counts);
            }

            setIsLoadingUsers(false);
        };
        init();
    }, []);

    // Fetch messages when active user changes
    useEffect(() => {
        if (!activeUserId || !currentUserId) return;
        
        const fetchMessages = async () => {
            setIsLoadingMessages(true);
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${activeUserId}),and(sender_id.eq.${activeUserId},receiver_id.eq.${currentUserId})`)
                .order('created_at', { ascending: true });
            
            if (data) {
                setMessages(data);
                // Mark received messages as read
                const unreadIds = data.filter(m => m.receiver_id === currentUserId && !m.is_read).map(m => m.id);
                if (unreadIds.length > 0) {
                    await supabase.from('messages').update({ is_read: true, read_at: new Date().toISOString() }).in('id', unreadIds);
                }
                
                // Clear unread count for this user
                setUnreadCounts(prev => ({...prev, [activeUserId]: 0}));
            }
            setIsLoadingMessages(false);
            scrollToBottom();
        };

        fetchMessages();
    }, [activeUserId, currentUserId]);

    // Realtime subscriptions
    useEffect(() => {
        if (!currentUserId) return;

        // Listen for all messages globally for the current user
        const uniqueTopic = `messages-${currentUserId}-${Math.random().toString(36).substring(7)}`;
        const channel = supabase
            .channel(uniqueTopic)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                const newMsg = payload.new;
                
                // Only process if we are involved
                if (newMsg.sender_id === currentUserId || newMsg.receiver_id === currentUserId) {
                    
                    // Add to message list if we are currently chatting with this person
                    if (
                        (newMsg.sender_id === currentUserId && newMsg.receiver_id === activeUserId) ||
                        (newMsg.sender_id === activeUserId && newMsg.receiver_id === currentUserId)
                    ) {
                        setMessages(prev => [...prev, newMsg]);
                        scrollToBottom();
                        
                        // Auto-read if we are receiving it in the active chat
                        if (newMsg.receiver_id === currentUserId) {
                            supabase.from('messages').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', newMsg.id).then();
                        }
                    } else if (newMsg.receiver_id === currentUserId) {
                        // Not the active chat, just increment unread count for the sender
                        setUnreadCounts(prev => ({
                            ...prev, 
                            [newMsg.sender_id]: (prev[newMsg.sender_id] || 0) + 1
                        }));
                    }
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
                // If message is in active chat, update it
                setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUserId, activeUserId]); // Re-subscribe if activeUserId changes so closure gets correct activeUserId

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const sendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() || !activeUserId || !currentUserId) return;

        const content = newMessage.trim();
        setNewMessage(''); // optimistic clear

        const { error } = await supabase.from('messages').insert([{
            sender_id: currentUserId,
            receiver_id: activeUserId,
            content
        }]);

        if (error) {
            console.error("Failed to send message:", error.message, error.details, error.hint);
            notify(`حدث خطأ أثناء الإرسال: ${error.message || 'حاول مرة أخرى'}`);
        }
    };

    const { onlineUsers } = usePresence();

    return {
        users,
        messages,
        activeUserId,
        setActiveUserId,
        currentUserId,
        isLoadingUsers,
        isLoadingMessages,
        newMessage,
        setNewMessage,
        sendMessage,
        messagesEndRef,
        onlineUsers,
        unreadCounts
    };
}
