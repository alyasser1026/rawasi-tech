import { supabase } from '@/lib/supabase';

export interface CashClosing {
  id: string;
  company_id: string;
  closing_number: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  closing_date: string;
  system_balance: number;
  actual_cash: number;
  difference: number;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
  approved_at?: string | null;
  notes?: string | null;
  journal_header_id?: string | null;
  created_at: string;
}

export interface CashClosingPreview {
  account_id: string;
  closing_date: string;
  system_balance: number;
  total_debits_today: number;
  total_credits_today: number;
  entries_count_today: number;
}

export interface SafeAccountOption {
  id: string;
  code: string;
  name: string;
}

export function formatCashCurrency(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '0.00 ر.س';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function fetchSafeAccounts(): Promise<SafeAccountOption[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, code, name')
    .or('code.ilike.121%,code.ilike.122%,code.eq.123')
    .eq('is_transactional', true)
    .order('code');

  if (error) {
    throw new Error(error.message || 'فشل جلب حسابات الخزينة والبنوك');
  }

  return (data as SafeAccountOption[]) || [];
}

export async function fetchCashClosingPreview(
  accountId: string,
  closingDate: string
): Promise<CashClosingPreview> {
  const { data, error } = await supabase.rpc('get_cash_closing_preview', {
    p_account_id: accountId,
    p_closing_date: closingDate,
  });

  if (error) {
    if (error.code === 'PGRST202' || error.message?.includes('get_cash_closing_preview') || error.message?.includes('404')) {
      return {
        book_balance: 0,
        expected_balance: 0,
        currency: 'SAR',
        last_closing_date: null,
      } as any;
    }
    throw new Error(error.message || 'فشل استرجاع معاينة الرصيد الدفتري');
  }

  return data as CashClosingPreview;
}

export async function createDailyCashClosing(payload: {
  accountId: string;
  closingDate: string;
  actualCash: number;
  notes?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_daily_cash_closing', {
    p_account_id: payload.accountId,
    p_closing_date: payload.closingDate,
    p_actual_cash: payload.actualCash,
    p_notes: payload.notes || null,
  });

  if (error) {
    throw new Error(error.message || 'فشل تسجيل محضر إقفال الخزينة');
  }

  return data as string;
}

export async function approveCashClosing(
  closingId: string,
  approvalNotes?: string
): Promise<{ status: string; journal_header_id?: string }> {
  const { data, error } = await supabase.rpc('approve_cash_closing', {
    p_closing_id: closingId,
    p_approval_notes: approvalNotes || null,
  });

  if (error) {
    throw new Error(error.message || 'فشل اعتماد الإقفال وترحيل التسوية');
  }

  return data;
}

export async function fetchCashClosingsHistory(
  accountId?: string | null,
  limit: number = 30
): Promise<CashClosing[]> {
  const { data, error } = await supabase.rpc('get_daily_cash_closings_history', {
    p_account_id: accountId || null,
    p_limit: limit,
  });

  if (error) {
    if (error.code === 'PGRST202' || error.message?.includes('get_daily_cash_closings_history') || error.message?.includes('404')) {
      console.warn('get_daily_cash_closings_history RPC pending migration: 20261105170007_custodies_and_cash_closings.sql');
      return [];
    }
    throw new Error(error.message || 'فشل جلب سجل محاضر الإقفال');
  }

  return (data as CashClosing[]) || [];
}
