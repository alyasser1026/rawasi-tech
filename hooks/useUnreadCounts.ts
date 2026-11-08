import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useUnreadCounts() {
    const [counts, setCounts] = useState({ unread_messages: 0, unread_notifications: 0 });

    useEffect(() => {
        let isMounted = true;

        const fetchCounts = async () => {
            try {
                const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
                if (sessionErr || !session || !isMounted) return;

                const { data, error } = await supabase
                    .from('vw_unread_counts')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .maybeSingle();
                
                if (data && !error && isMounted) {
                    setCounts({
                        unread_messages: Number(data.unread_messages || 0),
                        unread_notifications: Number(data.unread_notifications || 0)
                    });
                }
            } catch {
                // Silently ignore transient network disconnects (ERR_CONNECTION_CLOSED)
            }
        };

        fetchCounts();

        const interval = setInterval(fetchCounts, 60000); // refresh every minute

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    return counts;
}
