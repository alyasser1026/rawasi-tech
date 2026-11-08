import { getActiveCompanyId, supabase } from '@/lib/supabase';
import { readCachedTableRows } from '@/lib/offline/referenceCache';
import { saveReferenceTableCache } from '@/lib/offline/offlineStore';

export interface CustodyExpense {
  id: string;
  exp_date: string;
  description: string;
  amount?: number;
  paid_amount?: number;
  vat_amount?: number;
  payment_method?: string;
  is_posted?: boolean;
  invoice_image?: string | null;
  _offline_queued?: boolean;
}

export interface SiteCustody {
  id: string;
  company_id: string;
  custody_number: string;
  partner_id: string;
  partner_name?: string;
  partner_code?: string;
  project_id?: string | null;
  project_name?: string | null;
  title: string;
  opened_date: string;
  disbursed_amount: number;
  spent_amount: number;
  remaining_amount: number;
  max_days: number;
  days_open?: number;
  is_overdue?: boolean;
  status: 'open' | 'settled' | 'cancelled';
  notes?: string | null;
  settlement_date?: string | null;
  settlement_type?: 'cash_return' | 'salary_deduction' | 'carry_forward' | 'cleared' | null;
  settlement_reference_id?: string | null;
  settlement_notes?: string | null;
  payment_voucher_id?: string | null;
  expenses?: CustodyExpense[];
}

export interface CustodyKPIs {
  total_custodies: number;
  open_custodies: number;
  settled_custodies: number;
  overdue_custodies: number;
  total_disbursed: number;
  total_spent: number;
  total_remaining: number;
}

export interface CustodySummaryResponse {
  kpis: CustodyKPIs;
  custodies: SiteCustody[];
  migrationRequired?: boolean;
}

export const SETTLEMENT_TYPES: Record<string, { label: string; desc: string }> = {
  cash_return: {
    label: 'رد نقدي للخزينة / البنك',
    desc: 'إنشاء سند قبض آلي (مدين الخزينة/البنك، دائن ح/125 مع المهندس)',
  },
  salary_deduction: {
    label: 'خصم من الراتب',
    desc: 'قيد محاسبي آلي (مدين ح/216 رواتب وأجور مستحقة، دائن ح/125 مع المهندس)',
  },
  carry_forward: {
    label: 'ترحيل لعهدة جديدة',
    desc: 'إنشاء عهدة جديدة تلقائياً بنفس المبلغ المتبقي لنفس المهندس/المشروع',
  },
  cleared: {
    label: 'إقفال دون رصيد متبقٍ',
    desc: 'تصفية العهدة عند صرف كامل المبلغ المسجل (المتبقي = صفر)',
  },
};

export const STATUS_MAP: Record<string, { label: string; className: string }> = {
  open: { label: 'مفتوحة / جارية', className: 'statusOpen' },
  settled: { label: 'تمت التسوية', className: 'statusSettled' },
  cancelled: { label: 'ملغاة', className: 'statusCancelled' },
};

export function formatCustodyCurrency(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '0.00 ر.س';
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function fetchSiteCustodies(statusFilter: string = 'all'): Promise<CustodySummaryResponse> {
  const companyId = getActiveCompanyId();
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cachedOpen = await readCachedTableRows('site_custodies', companyId);
    const custodies = (cachedOpen || []).map((c: any) => ({
      ...c,
      max_days: c.max_days || 30,
      expenses: [],
    })) as SiteCustody[];
    return {
      kpis: {
        total_custodies: custodies.length,
        open_custodies: custodies.filter((c) => c.status === 'open').length,
        settled_custodies: custodies.filter((c) => c.status === 'settled').length,
        overdue_custodies: 0,
        total_disbursed: custodies.reduce((s, c) => s + Number(c.disbursed_amount || 0), 0),
        total_spent: custodies.reduce((s, c) => s + Number(c.spent_amount || 0), 0),
        total_remaining: custodies.reduce((s, c) => s + Number(c.remaining_amount || 0), 0),
      },
      custodies,
    };
  }

  const summaryRequest = supabase.rpc('get_site_custodies_summary', {
    p_status: statusFilter,
  });
  if (companyId) summaryRequest.setHeader('x-company-id', companyId);
  const { data, error } = await summaryRequest;

  if (error) {
    if (
      error.code === 'PGRST202' ||
      error.code === '42P01' ||
      error.code === 'PGRST205' ||
      error.message?.includes('get_site_custodies_summary') ||
      error.message?.includes('404')
    ) {
      return {
        kpis: {
          total_custodies: 0,
          open_custodies: 0,
          settled_custodies: 0,
          overdue_custodies: 0,
          total_disbursed: 0,
          total_spent: 0,
          total_remaining: 0,
        },
        custodies: [],
        migrationRequired: true,
      };
    }
    throw new Error(error.message || 'فشل استرجاع بيانات العُهد');
  }

  const baseResponse: CustodySummaryResponse = (data as CustodySummaryResponse) || {
    kpis: {
      total_custodies: 0,
      open_custodies: 0,
      settled_custodies: 0,
      overdue_custodies: 0,
      total_disbursed: 0,
      total_spent: 0,
      total_remaining: 0,
    },
    custodies: [],
  };

  if (companyId && (statusFilter === 'all' || statusFilter === 'open')) {
    const openCustodies = baseResponse.custodies.filter((custody) => custody.status === 'open').map((custody) => ({
      id: custody.id,
      custody_number: custody.custody_number,
      title: custody.title,
      partner_id: custody.partner_id,
      project_id: custody.project_id,
      disbursed_amount: custody.disbursed_amount,
      spent_amount: custody.spent_amount,
      remaining_amount: custody.remaining_amount,
      status: custody.status,
      opened_date: custody.opened_date,
      max_days: custody.max_days,
    }));
    void saveReferenceTableCache(companyId, 'site_custodies', openCustodies).catch(() => {});
  }

  // Enrich custody expenses with invoice_image, vat_amount & payment_method
  try {
    const { data: expDetails } = await supabase
      .from('expenses')
      .select('id, custody_id, invoice_image, vat_amount, payment_method, total_price')
      .not('custody_id', 'is', null);

    if (expDetails && expDetails.length > 0) {
      const detailMap = new Map<string, any>();
      for (const ed of expDetails) {
        detailMap.set(String(ed.id), ed);
      }
      baseResponse.custodies = (baseResponse.custodies || []).map((c) => ({
        ...c,
        expenses: (c.expenses || []).map((ex) => {
          const extra = detailMap.get(String(ex.id));
          return extra
            ? {
                ...ex,
                invoice_image: extra.invoice_image || ex.invoice_image || null,
                vat_amount: extra.vat_amount ?? ex.vat_amount ?? 0,
                payment_method: extra.payment_method || ex.payment_method || 'عهدة',
                amount: ex.amount ?? extra.total_price ?? ex.paid_amount ?? 0,
              }
            : ex;
        }),
      }));
    }
  } catch {
    /* non-blocking enrichment */
  }

  return baseResponse;
}

export async function createSiteCustody(payload: {
  partnerId: string;
  projectId?: string | null;
  title: string;
  amount: number;
  safeAccountId: string;
  paymentMethod?: string;
  notes?: string;
  maxDays?: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_site_custody', {
    p_partner_id: payload.partnerId,
    p_project_id: payload.projectId || null,
    p_title: payload.title,
    p_amount: payload.amount,
    p_safe_acc_id: payload.safeAccountId,
    p_payment_method: payload.paymentMethod || 'نقدي',
    p_notes: payload.notes || null,
    p_max_days: payload.maxDays || 30,
  });

  if (error) {
    throw new Error(error.message || 'فشل صرف العهدة الجديدة');
  }

  return data as string;
}

export async function settleSiteCustody(payload: {
  custodyId: string;
  settlementType: 'cash_return' | 'salary_deduction' | 'carry_forward' | 'cleared';
  destinationId?: string | null; // safe/bank account ID for cash_return, or project ID for carry_forward
  settlementDate?: string;
  notes?: string;
}): Promise<any> {
  const { data, error } = await supabase.rpc('settle_site_custody', {
    p_custody_id: payload.custodyId,
    p_settlement_type: payload.settlementType,
    p_destination_id: payload.destinationId || null,
    p_settlement_date: payload.settlementDate || new Date().toISOString().slice(0, 10),
    p_notes: payload.notes || null,
  });

  if (error) {
    throw new Error(error.message || 'فشل تنفيذ تسوية العهدة');
  }

  return data;
}
