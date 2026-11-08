import { supabase } from '@/lib/supabase';

export interface InventoryDashboardKPIs {
  total_items_count: number;
  total_inventory_valuation: number;
  gl_126_balance: number;
  valuation_gl_variance: number;
  low_stock_count: number;
  stagnant_count: number;
}

export interface LowStockItem {
  item_id: string;
  item_code: string;
  item_name: string;
  unit: string;
  current_stock: number;
  min_order_level: number;
  reorder_qty: number;
  suggested_po_qty: number;
}

export interface StagnantStockItem {
  item_id: string;
  item_code: string;
  item_name: string;
  unit: string;
  current_stock: number;
  moving_avg_cost: number;
  stagnant_value: number;
  last_movement_date?: string | null;
  days_dormant: number;
}

export interface RecentStocktake {
  id: string;
  session_number: string;
  session_date: string;
  project_name?: string | null;
  job_order_number?: string | null;
  total_difference_amount: number;
  status: string;
  is_posted: boolean;
}

export interface InventoryDashboardResponse {
  kpis: InventoryDashboardKPIs;
  low_stock_items: LowStockItem[];
  stagnant_items: StagnantStockItem[];
  recent_stocktakes: RecentStocktake[];
}

export interface StockCardMovement {
  move_date: string;
  doc_type: string;
  doc_number: string;
  doc_id: string;
  job_order_id?: string | null;
  job_order_number?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  entity_name?: string | null;
  qty_in: number;
  qty_out: number;
  unit_cost: number;
  running_qty: number;
}

export interface ItemStockCardResponse {
  item: {
    id: string;
    code: string;
    name: string;
    unit: string;
    moving_avg_cost: number;
    min_order_level: number;
    reorder_qty: number;
    total_in: number;
    total_out: number;
    current_stock: number;
    total_value: number;
  };
  movements: StockCardMovement[];
}

export interface CreateStocktakingLineInput {
  item_id: string;
  actual_quantity: number;
  system_quantity?: number;
  unit_cost?: number;
  job_order_id?: string | null;
  notes?: string;
}

export interface CreateStocktakingInput {
  project_id?: string | null;
  job_order_id?: string | null;
  session_date: string;
  notes?: string;
  lines: CreateStocktakingLineInput[];
}

export interface JobOrderOption {
  id: string;
  order_number: string;
  project_id?: string | null;
  status: string;
}

export async function fetchInventoryDashboardSummary(
  projectId?: string | null,
  jobOrderId?: string | null
): Promise<InventoryDashboardResponse> {
  try {
    const { data, error } = await supabase.rpc('get_inventory_dashboard_summary', {
      p_project_id: projectId || null,
      p_job_order_id: jobOrderId || null,
    });

    if (!error && data) {
      return data as InventoryDashboardResponse;
    }
    if (error) {
      console.warn('RPC get_inventory_dashboard_summary unavailable, using client fallback:', error.message || error);
    }
  } catch (err) {
    console.warn('RPC get_inventory_dashboard_summary exception, falling back:', err);
  }

  try {
    const items = await fetchMaterialItems();
    const totalItems = items.length;
    let totalValuation = 0;
    const lowStockItems: LowStockItem[] = [];
    const stagnantItems: StagnantStockItem[] = [];

    items.forEach((item: any) => {
      const stock = Number(item.current_stock) || 0;
      const cost = Number(item.moving_avg_cost) || Number(item.default_unit_price) || 0;
      const minLevel = Number(item.min_order_level) || 0;
      const reorderQty = Number(item.reorder_qty) || 0;
      totalValuation += stock * cost;

      if (stock <= minLevel && minLevel > 0) {
        lowStockItems.push({
          item_id: item.id,
          item_code: item.item_code || '',
          item_name: item.item_name || '',
          unit: item.default_unit || 'وحدة',
          current_stock: stock,
          min_order_level: minLevel,
          reorder_qty: reorderQty,
          suggested_po_qty: Math.max(reorderQty, minLevel - stock),
        });
      }
    });

    return {
      kpis: {
        total_items_count: totalItems,
        total_inventory_valuation: totalValuation,
        gl_126_balance: totalValuation,
        valuation_gl_variance: 0,
        low_stock_count: lowStockItems.length,
        stagnant_count: stagnantItems.length,
      },
      low_stock_items: lowStockItems,
      stagnant_items: stagnantItems,
      recent_stocktakes: [],
    };
  } catch (err) {
    console.error('Error in fetchInventoryDashboardSummary fallback:', err);
    return {
      kpis: {
        total_items_count: 0,
        total_inventory_valuation: 0,
        gl_126_balance: 0,
        valuation_gl_variance: 0,
        low_stock_count: 0,
        stagnant_count: 0,
      },
      low_stock_items: [],
      stagnant_items: [],
      recent_stocktakes: [],
    };
  }
}

export async function fetchItemStockCard(
  itemId: string,
  projectId?: string | null,
  jobOrderId?: string | null
): Promise<ItemStockCardResponse> {
  try {
    const { data, error } = await supabase.rpc('get_item_stock_card', {
      p_item_id: itemId,
      p_project_id: projectId || null,
      p_job_order_id: jobOrderId || null,
    });

    if (!error && data) {
      return data as ItemStockCardResponse;
    }
  } catch (err) {
    console.warn('RPC get_item_stock_card error, using fallback:', err);
  }

  const items = await fetchMaterialItems();
  const found = items.find((i: any) => i.id === itemId);
  return {
    item: {
      id: itemId,
      code: found?.item_code || '',
      name: found?.item_name || 'بند غير معروف',
      unit: found?.default_unit || 'وحدة',
      moving_avg_cost: Number(found?.moving_avg_cost) || Number(found?.default_unit_price) || 0,
      min_order_level: Number(found?.min_order_level) || 0,
      reorder_qty: Number(found?.reorder_qty) || 0,
      total_in: 0,
      total_out: 0,
      current_stock: 0,
      total_value: 0,
    },
    movements: [],
  };
}

export async function createStocktakingSession(input: CreateStocktakingInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_stocktaking_session', {
    p_project_id: input.project_id || null,
    p_job_order_id: input.job_order_id || null,
    p_session_date: input.session_date,
    p_notes: input.notes || '',
    p_lines: input.lines,
  });

  if (error) {
    console.error('Error creating stocktaking session:', error);
    throw error;
  }

  return data as string;
}

export async function postStocktakingSession(sessionId: string): Promise<any> {
  const { data, error } = await supabase.rpc('post_stocktaking_session', {
    p_session_id: sessionId,
  });

  if (error) {
    console.error('Error posting stocktaking session:', error);
    throw error;
  }

  return data;
}

export async function fetchJobOrders(projectId?: string): Promise<JobOrderOption[]> {
  let query = supabase
    .from('job_orders')
    .select('id, order_number, project_id, status')
    .order('order_number');

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchMaterialItems() {
  try {
    const { data, error } = await supabase
      .from('material_items')
      .select('id, item_code, item_name, default_unit, default_unit_price, min_order_level, reorder_qty, moving_avg_cost')
      .order('item_name');
    if (!error && data) return data;
  } catch (err) {
    console.warn('Full columns select failed for material_items, using fallback:', err);
  }

  // Fallback to core columns if unapplied migrations
  const { data, error } = await supabase
    .from('material_items')
    .select('id, item_code, item_name, default_unit, default_unit_price')
    .order('item_name');
  if (error) {
    console.warn('Fallback fetchMaterialItems failed:', error);
    return [];
  }
  return (data || []).map((m: any) => ({
    ...m,
    min_order_level: Number(m.min_order_level) || 0,
    reorder_qty: Number(m.reorder_qty) || 0,
    moving_avg_cost: Number(m.moving_avg_cost) || Number(m.default_unit_price) || 0,
  }));
}

export async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, "Property"')
    .order('Property');
  if (error) throw error;
  return data || [];
}
