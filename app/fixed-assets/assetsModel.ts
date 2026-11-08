import { supabase } from '@/lib/supabase';

export interface FixedAsset {
  id: string;
  asset_number: string;
  name: string;
  asset_type: 'equipment' | 'vehicle' | 'furniture' | 'building' | 'other';
  purchase_date: string;
  purchase_cost: number;
  salvage_value: number;
  useful_life_months: number;
  monthly_depreciation: number;
  accumulated_depreciation: number;
  book_value: number;
  current_project_id?: string | null;
  project_name?: string | null;
  status: 'active' | 'depreciated' | 'disposed' | 'sold';
  serial_number?: string | null;
  notes?: string | null;
  operational_expenses?: number;
}

export interface AssetKPIs {
  total_assets: number;
  active_assets: number;
  depreciated_assets: number;
  disposed_assets: number;
  total_purchase_cost: number;
  total_accumulated_depreciation: number;
  total_book_value: number;
  monthly_depreciation_run_cost: number;
}

export interface AssetsSummaryResponse {
  kpis: AssetKPIs;
  assets: FixedAsset[];
}

export interface DepreciationLinePreview {
  asset_id: string;
  asset_number: string;
  asset_name: string;
  asset_type: string;
  purchase_cost: number;
  salvage_value: number;
  prior_accumulated: number;
  prior_book_value: number;
  project_id?: string | null;
  project_name?: string | null;
  expense_account_id: string;
  expense_account_code: string;
  expense_account_name: string;
  depreciation_amount: number;
  new_accumulated: number;
  new_book_value: number;
  is_last_month: boolean;
}

export interface DepreciationPreviewResponse {
  period_year: number;
  period_month: number;
  is_already_posted: boolean;
  total_depreciation: number;
  assets_count: number;
  assets: DepreciationLinePreview[];
}

export interface AssetOperationalCostsResponse {
  asset_id: string;
  asset_number: string;
  asset_name: string;
  purchase_cost: number;
  accumulated_depreciation: number;
  book_value: number;
  total_operational_expenses: number;
  total_posted_depreciation: number;
  total_ownership_cost: number;
  expenses: {
    id: string;
    date: string;
    description: string;
    amount: number;
    payment_method?: string;
    project_id?: string;
    project_name?: string;
  }[];
  depreciations: {
    run_id: string;
    run_number: string;
    year: number;
    month: number;
    date: string;
    amount: number;
    project_id?: string;
    project_name?: string;
  }[];
  transfers: {
    id: string;
    transfer_number: string;
    date: string;
    from_project?: string;
    to_project?: string;
    responsible_partner?: string;
    notes?: string;
  }[];
}

export const ASSET_TYPES: Record<string, { label: string; code: string; defaultAcc: string }> = {
  equipment: { label: 'آلات ومعدات ثقيلة', code: '111', defaultAcc: '111' },
  vehicle: { label: 'سيارات ووسائل نقل', code: '112', defaultAcc: '112' },
  furniture: { label: 'أثاث وتجهيزات مكتبية', code: '113', defaultAcc: '113' },
  building: { label: 'مباني وإنشاءات', code: '11', defaultAcc: '11' },
  other: { label: 'أصول أخرى', code: '11', defaultAcc: '11' },
};

export const ASSET_STATUS: Record<string, { label: string; className: string }> = {
  active: { label: 'نشط ويعمل', className: 'statusActive' },
  depreciated: { label: 'مستهلك دفترياً (خردة)', className: 'statusDepreciated' },
  sold: { label: 'تم البيع', className: 'statusSold' },
  disposed: { label: 'مستبعد / تالف', className: 'statusDisposed' },
};

export function formatAssetCurrency(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '0.00 ر.س';
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export async function fetchAssetsSummary(
  assetType: string = 'all',
  projectId?: string | null,
  status: string = 'all'
): Promise<AssetsSummaryResponse> {
  const fallback: AssetsSummaryResponse = {
    kpis: {
      total_assets: 0,
      active_assets: 0,
      depreciated_assets: 0,
      disposed_assets: 0,
      total_purchase_cost: 0,
      total_accumulated_depreciation: 0,
      total_book_value: 0,
      monthly_depreciation_run_cost: 0,
    },
    assets: [],
  };

  try {
    const { data, error } = await supabase.rpc('get_assets_summary', {
      p_asset_type: assetType,
      p_project_id: projectId || null,
      p_status: status,
    });

    if (error) {
      console.warn('get_assets_summary RPC notice:', error.message);
      return fallback;
    }

    return (data as AssetsSummaryResponse) || fallback;
  } catch (err: any) {
    console.warn('fetchAssetsSummary error:', err?.message);
    return fallback;
  }
}

export async function createFixedAsset(payload: {
  name: string;
  assetType: string;
  purchaseCost: number;
  usefulLifeMonths: number;
  salvageValue?: number;
  purchaseDate?: string;
  currentProjectId?: string | null;
  serialNumber?: string;
  openingAccumulated?: number;
  notes?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_fixed_asset', {
    p_name: payload.name,
    p_asset_type: payload.assetType,
    p_purchase_cost: payload.purchaseCost,
    p_useful_life_months: payload.usefulLifeMonths,
    p_salvage_value: payload.salvageValue || 0,
    p_purchase_date: payload.purchaseDate || new Date().toISOString().slice(0, 10),
    p_current_project_id: payload.currentProjectId || null,
    p_serial_number: payload.serialNumber || null,
    p_opening_accumulated: payload.openingAccumulated || 0,
    p_notes: payload.notes || null,
  });

  if (error) {
    throw new Error(error.message || 'فشل إضافة الأصل الجديد');
  }

  return data as string;
}

export async function fetchDepreciationPreview(
  year: number,
  month: number
): Promise<DepreciationPreviewResponse> {
  const { data, error } = await supabase.rpc('calculate_monthly_depreciation_preview', {
    p_year: year,
    p_month: month,
  });

  if (error) {
    throw new Error(error.message || 'فشل احتساب معاينة الإهلاك الشهري');
  }

  return data as DepreciationPreviewResponse;
}

export async function postMonthlyDepreciation(
  year: number,
  month: number,
  notes?: string
): Promise<any> {
  const { data, error } = await supabase.rpc('post_monthly_depreciation', {
    p_year: year,
    p_month: month,
    p_notes: notes || null,
  });

  if (error) {
    throw new Error(error.message || 'فشل ترحيل قيد إهلاك الشهر');
  }

  return data;
}

export async function transferAssetProject(payload: {
  assetId: string;
  toProjectId?: string | null;
  transferDate?: string;
  responsiblePartnerId?: string | null;
  notes?: string;
}): Promise<any> {
  const { data, error } = await supabase.rpc('transfer_asset_project', {
    p_asset_id: payload.assetId,
    p_to_project_id: payload.toProjectId || null,
    p_transfer_date: payload.transferDate || new Date().toISOString().slice(0, 10),
    p_partner_id: payload.responsiblePartnerId || null,
    p_notes: payload.notes || null,
  });

  if (error) {
    throw new Error(error.message || 'فشل تسجيل نقل الأصل');
  }

  return data;
}

export async function disposeFixedAsset(payload: {
  assetId: string;
  disposalDate: string;
  disposalType: 'sale' | 'scrap' | 'write_off';
  saleAmount?: number;
  safeAccountId?: string | null;
  notes?: string;
}): Promise<any> {
  const { data, error } = await supabase.rpc('dispose_fixed_asset', {
    p_asset_id: payload.assetId,
    p_disposal_date: payload.disposalDate,
    p_disposal_type: payload.disposalType,
    p_sale_amount: payload.saleAmount || 0,
    p_safe_acc_id: payload.safeAccountId || null,
    p_notes: payload.notes || null,
  });

  if (error) {
    throw new Error(error.message || 'فشل تسجيل بيع أو استبعاد الأصل');
  }

  return data;
}

export async function fetchAssetOperationalCosts(
  assetId: string
): Promise<AssetOperationalCostsResponse> {
  const { data, error } = await supabase.rpc('get_asset_operational_costs', {
    p_asset_id: assetId,
  });

  if (error) {
    throw new Error(error.message || 'فشل جلب تفاصيل تكاليف تشغيل الأصل');
  }

  return data as AssetOperationalCostsResponse;
}
