import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export function useVouchersLogic() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all', 'in', 'out'

  const fetchVouchers = async () => {
    try {
      let receipts: any[] = [];
      let payments: any[] = [];

      if (filterType === 'all' || filterType === 'in') {
        const { data, error } = await supabase
          .from('receipt_vouchers')
          .select('id, number:receipt_number, amount, date, status, partner_id, partners(name), payment_method')
          .order('created_at', { ascending: false });
        if (error) throw error;
        receipts = (data || []).map(v => ({ ...v, type: 'in' }));
      }

      if (filterType === 'all' || filterType === 'out') {
        const { data, error } = await supabase
          .from('payment_vouchers')
          .select('id, number:voucher_number, amount, date, status, partner_id, partners(name), payment_method')
          .order('created_at', { ascending: false });
        if (error) throw error;
        payments = (data || []).map(v => ({ ...v, type: 'out' }));
      }

      const combined = [...receipts, ...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setVouchers(combined);

    } catch (error) {
      console.error('Error fetching vouchers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, [filterType]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchVouchers();
  };

  return { vouchers, loading, refreshing, onRefresh, filterType, setFilterType };
}
