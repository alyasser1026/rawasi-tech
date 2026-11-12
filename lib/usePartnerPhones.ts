"use client";

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/lib/CompanyContext';
import { fetchPaginatedData } from '@/lib/supabase-pagination';
import { PartnerPhoneLookupRow } from '@/lib/partnerWhatsApp';

export function usePartnerPhones() {
  const { activeCompanyId } = useCompany();

  return useQuery<PartnerPhoneLookupRow[]>({
    queryKey: ['partners_phones_lookup', activeCompanyId],
    enabled: Boolean(activeCompanyId),
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const buildQuery = () =>
        supabase
          .from('partners')
          .select('id, name, phone, partner_type')
          .order('name', { ascending: true });
      const rows = await fetchPaginatedData(buildQuery, 'id');
      return (rows || []) as PartnerPhoneLookupRow[];
    },
  });
}
