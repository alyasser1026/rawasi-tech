import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

type FinanceVoucher = {
  id: string; amount: number | string; date: string; status: string; partner_id: string | null;
  receipt_number?: string | null; voucher_number?: string | null;
  partners: { name: string } | null;
};

export function useFinanceLogic() {
  const [dashboardData, setDashboardData] = useState<{ totalReceipts: number; totalPayments: number; recentReceipts: FinanceVoucher[]; recentPayments: FinanceVoucher[] }>({
    totalReceipts: 0,
    totalPayments: 0,
    recentReceipts: [],
    recentPayments: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFinanceData = async () => {
    try {
      // 1. Get Receipts (Total & Recent)
      const { data: receipts, error: receiptsError } = await supabase
        .from('receipt_vouchers')
        .select('id, receipt_number, amount, date, status, partner_id, partners(name)')
        .order('created_at', { ascending: false });

      if (receiptsError) throw receiptsError;

      // 2. Get Payments (Total & Recent)
      const { data: payments, error: paymentsError } = await supabase
        .from('payment_vouchers')
        .select('id, voucher_number, amount, date, status, partner_id, partners(name)')
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      const totalReceipts = receipts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const totalPayments = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);

      setDashboardData({
        totalReceipts,
        totalPayments,
        recentReceipts: receipts.slice(0, 5).map(r => ({ ...r, partners: Array.isArray(r.partners) ? r.partners[0] || null : r.partners })),
        recentPayments: payments.slice(0, 5).map(r => ({ ...r, partners: Array.isArray(r.partners) ? r.partners[0] || null : r.partners }))
      });
    } catch (error) {
      console.error('Error fetching finance data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFinanceData();
  };

  return { ...dashboardData, loading, refreshing, onRefresh };
}
