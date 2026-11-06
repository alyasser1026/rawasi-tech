"use client";
import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { fetchAllSupabaseData } from '@/lib/helpers';
import { fetchPaginatedData } from '@/lib/supabase-pagination';

export function useLedgerLogic() {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // 📥 1. جلب قائمة الحسابات بمحرك القوة (React Query) 
  const { data: accounts = [] } = useQuery({
    queryKey: ['ledger_accounts_list'],
    queryFn: async () => {
      return await fetchAllSupabaseData(supabase, 'accounts', 'id, name, code', 'code') || [];
    }
  });

  // 📥 2. جلب الحركات (Joining lines with headers) [cite: 48]
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['ledger_entries', selectedAccountId],
    enabled: !!selectedAccountId,
    queryFn: async () => {
      const buildQuery = () => supabase
        .from('journal_lines')
        .select(`
          id, debit, credit, item_name, notes,
          journal_headers:journal_headers!journal_lines_header_id_company_fkey (entry_date, description),
          projects:projects!journal_lines_project_id_company_fkey (Property),
          partners:partners!journal_lines_partner_id_company_fkey (name)
        `)
        .eq('account_id', selectedAccountId)
        .order('id', { ascending: true }); // better for pagination stability
      return await fetchPaginatedData(buildQuery, 'id');
    }
  });

  // 📊 3. الحسابات والفلترة داخل useMemo حصراً [cite: 6]
  const ledgerStats = useMemo(() => {
    let runningBalance = 0;
    const enrichedEntries = entries.map((entry: any) => {
      runningBalance += (Number(entry.debit) - Number(entry.credit));
      return { ...entry, runningBalance };
    });

    const totalDebit = entries.reduce((sum, e) => sum + Number(e.debit), 0);
    const totalCredit = entries.reduce((sum, e) => sum + Number(e.credit), 0);

    return {
      entries: enrichedEntries,
      totalDebit,
      totalCredit,
      currentBalance: totalDebit - totalCredit
    };
  }, [entries]);

  return {
    accounts,
    selectedAccountId,
    setSelectedAccountId,
    isLoading,
    ...ledgerStats
  };
}