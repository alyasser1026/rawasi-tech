import { supabase } from '@/lib/supabase';

export interface PurchaseOrder {
  id: string;
  po_number: string;
  order_date: string;
  expected_delivery_date?: string | null;
  supplier_id: string;
  supplier_name: string;
  project_id?: string | null;
  project_name?: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: 'draft' | 'approved' | 'partially_received' | 'received' | 'closed' | 'cancelled';
  notes?: string | null;
  terms?: string | null;
  lines_count: number;
  attachment_url?: string | null;
}

export interface PurchaseOrderLine {
  id: string;
  po_id: string;
  item_id?: string | null;
  item_name: string;
  description?: string | null;
  quantity: number;
  received_quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  tax_rate: number;
  tax_amount: number;
  boq_item_id?: string | null;
  notes?: string | null;
}

export interface PurchaseOrdersKPIs {
  total_pos: number;
  draft_pos: number;
  approved_pos: number;
  partially_received_pos: number;
  received_pos: number;
  closed_pos: number;
  total_orders_value: number;
}

export interface PurchaseOrdersSummaryResponse {
  kpis: PurchaseOrdersKPIs;
  orders: PurchaseOrder[];
}

export interface ThreeWayMatchingLine {
  po_line_id: string;
  item_name: string;
  unit: string;
  ordered_qty: number;
  po_unit_price: number;
  po_total: number;
  received_qty: number;
  received_total: number;
  invoiced_qty: number;
  invoiced_unit_price: number;
  invoiced_total: number;
  remaining_to_receive: number;
  remaining_to_invoice: number;
  price_variance: number;
  qty_variance: number;
  status: 'fully_matched' | 'partially_received' | 'over_received' | 'unmatched' | 'price_variance';
}

export interface ThreeWayMatchingResponse {
  po: {
    id: string;
    po_number: string;
    order_date: string;
    supplier_name: string;
    project_name: string;
    status: string;
    subtotal: number;
    tax_amount: number;
    total_amount: number;
    attachment_url?: string | null;
  };
  receipts: Array<{
    id: string;
    receipt_number: string;
    receipt_date: string;
    total_amount: number;
    status: string;
    is_posted: boolean;
  }>;
  invoices: Array<{
    id: string;
    invoice_number: string;
    supplier_invoice_ref: string;
    invoice_date: string;
    subtotal: number;
    tax_amount: number;
    total_amount: number;
    status: string;
    is_posted: boolean;
    attachment_url?: string | null;
  }>;
  lines: ThreeWayMatchingLine[];
  summary: {
    total_ordered_amount: number;
    total_received_amount: number;
    total_invoiced_amount: number;
    total_price_variance: number;
    is_fully_matched: boolean;
  };
}

export interface CreatePoLineInput {
  item_name: string;
  item_id?: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  boq_item_id?: string | null;
  description?: string;
}

export interface CreatePoInput {
  supplier_id: string;
  project_id?: string | null;
  order_date: string;
  expected_delivery_date?: string | null;
  notes?: string;
  terms?: string;
  attachment_url?: string | null;
  lines: CreatePoLineInput[];
}

export interface ReceivePoLineInput {
  po_line_id: string;
  quantity: number;
}

export interface CreateSupplierInvoiceLineInput {
  po_line_id?: string;
  receipt_line_id?: string;
  item_name: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  tax_rate?: number;
  notes?: string;
}

export interface CreateSupplierInvoiceInput {
  supplier_id: string;
  supplier_invoice_ref: string;
  po_id?: string | null;
  receipt_id?: string | null;
  invoice_date: string;
  due_date?: string | null;
  notes?: string;
  attachment_url?: string | null;
  lines: CreateSupplierInvoiceLineInput[];
}

export async function fetchPurchaseOrdersSummary(
  status: string = 'all',
  projectId?: string | null,
  supplierId?: string | null
): Promise<PurchaseOrdersSummaryResponse> {
  const { data, error } = await supabase.rpc('get_purchase_orders_summary', {
    p_status: status,
    p_project_id: projectId || null,
    p_supplier_id: supplierId || null,
  });

  if (error) {
    console.error('Error fetching purchase orders summary:', error);
    throw error;
  }

  const res = data as PurchaseOrdersSummaryResponse;
  if (res?.orders && res.orders.length > 0) {
    const ids = res.orders.map((o) => o.id);
    const { data: poRows } = await supabase
      .from('purchase_orders')
      .select('id, attachment_url')
      .in('id', ids);
    if (poRows) {
      const map = new Map(poRows.map((r: any) => [r.id, r.attachment_url]));
      res.orders = res.orders.map((o) => ({
        ...o,
        attachment_url: map.get(o.id) ?? o.attachment_url ?? null,
      }));
    }
  }

  return res;
}

export async function fetchPurchaseOrderMatching(poId: string): Promise<ThreeWayMatchingResponse> {
  const { data, error } = await supabase.rpc('get_purchase_order_matching', {
    p_po_id: poId,
  });

  if (error) {
    console.error('Error fetching purchase order matching:', error);
    throw error;
  }

  const res = data as ThreeWayMatchingResponse;
  if (res?.po) {
    const { data: poRow } = await supabase
      .from('purchase_orders')
      .select('attachment_url')
      .eq('id', poId)
      .maybeSingle();
    if (poRow) {
      res.po.attachment_url = poRow.attachment_url;
    }
  }
  if (res?.invoices && res.invoices.length > 0) {
    const invIds = res.invoices.map((i: any) => i.id || (i as any).invoice_id);
    const { data: invRows } = await supabase
      .from('supplier_invoices')
      .select('id, attachment_url')
      .in('id', invIds);
    if (invRows) {
      const map = new Map(invRows.map((r: any) => [r.id, r.attachment_url]));
      res.invoices = res.invoices.map((inv: any) => ({
        ...inv,
        attachment_url: map.get(inv.id || (inv as any).invoice_id) ?? (inv as any).attachment_url ?? null,
      }));
    }
  }

  return res;
}

export async function createPurchaseOrder(input: CreatePoInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_purchase_order', {
    p_supplier_id: input.supplier_id,
    p_project_id: input.project_id || null,
    p_order_date: input.order_date,
    p_expected_delivery: input.expected_delivery_date || null,
    p_notes: input.notes || '',
    p_terms: input.terms || '',
    p_lines: input.lines,
  });

  if (error) {
    console.error('Error creating purchase order:', error);
    throw error;
  }

  if (input.attachment_url && data) {
    await supabase.from('purchase_orders').update({ attachment_url: input.attachment_url }).eq('id', data);
  }

  return data as string;
}

export async function approvePurchaseOrder(poId: string): Promise<any> {
  const { data, error } = await supabase.rpc('approve_purchase_order', {
    p_po_id: poId,
  });

  if (error) {
    console.error('Error approving purchase order:', error);
    throw error;
  }

  return data;
}

export async function receiveMaterialsFromPo(
  poId: string,
  receiptDate: string,
  lines: ReceivePoLineInput[],
  notes?: string
): Promise<any> {
  const { data, error } = await supabase.rpc('receive_materials_from_po', {
    p_po_id: poId,
    p_receipt_date: receiptDate,
    p_lines: lines,
    p_notes: notes || '',
  });

  if (error) {
    console.error('Error receiving materials from PO:', error);
    throw error;
  }

  return data;
}

export async function createSupplierInvoice(input: CreateSupplierInvoiceInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_supplier_invoice', {
    p_supplier_id: input.supplier_id,
    p_supplier_ref: input.supplier_invoice_ref,
    p_po_id: input.po_id || null,
    p_receipt_id: input.receipt_id || null,
    p_invoice_date: input.invoice_date,
    p_due_date: input.due_date || null,
    p_notes: input.notes || '',
    p_lines: input.lines,
  });

  if (error) {
    console.error('Error creating supplier invoice:', error);
    throw error;
  }

  if (input.attachment_url && data) {
    await supabase.from('supplier_invoices').update({ attachment_url: input.attachment_url }).eq('id', data);
  }

  return data as string;
}

export async function postSupplierInvoice(invoiceId: string): Promise<any> {
  const { data, error } = await supabase.rpc('post_supplier_invoice', {
    p_invoice_id: invoiceId,
  });

  if (error) {
    console.error('Error posting supplier invoice:', error);
    throw error;
  }

  return data;
}

export async function fetchSuppliers() {
  const { data, error } = await supabase
    .from('partners')
    .select('id, code, name')
    .eq('partner_type', 'مورد')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, "Property"')
    .order('Property');
  if (error) throw error;
  return data || [];
}

export async function fetchMaterialItems() {
  const { data, error } = await supabase
    .from('material_items')
    .select('id, name, unit, default_price')
    .order('name');
  if (error) throw error;
  return data || [];
}
