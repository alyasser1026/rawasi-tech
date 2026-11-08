import { supabase, getActiveCompanyId } from '@/lib/supabase';

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
  const companyId = getActiveCompanyId();

  try {
    const { data, error } = await supabase.rpc('get_purchase_orders_summary', {
      p_status: status,
      p_project_id: projectId || null,
      p_supplier_id: supplierId || null,
    });

    if (!error && data) {
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
  } catch (rpcErr) {
    console.warn('RPC get_purchase_orders_summary failed, using table query fallback:', rpcErr);
  }

  // --- Fallback: Direct table query from purchase_orders ---
  try {
    let query = supabase
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        order_date,
        expected_delivery_date,
        supplier_id,
        project_id,
        subtotal,
        tax_amount,
        total_amount,
        status,
        notes,
        terms,
        attachment_url,
        partners:supplier_id ( name ),
        projects:project_id ( "Property" ),
        purchase_order_lines ( id )
      `);

    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    const { data: rawOrders, error: poErr } = await query.order('order_date', { ascending: false });

    if (poErr) {
      return {
        kpis: {
          total_pos: 0,
          draft_pos: 0,
          approved_pos: 0,
          partially_received_pos: 0,
          received_pos: 0,
          closed_pos: 0,
          total_orders_value: 0,
        },
        orders: [],
      };
    }

    const orders: PurchaseOrder[] = (rawOrders || []).map((r: any) => ({
      id: r.id,
      po_number: r.po_number || '',
      order_date: r.order_date || '',
      expected_delivery_date: r.expected_delivery_date || null,
      supplier_id: r.supplier_id || '',
      supplier_name: r.partners?.name || 'مورد غير محدد',
      project_id: r.project_id || null,
      project_name: r.projects?.Property || null,
      subtotal: Number(r.subtotal) || 0,
      tax_amount: Number(r.tax_amount) || 0,
      total_amount: Number(r.total_amount) || 0,
      status: r.status || 'draft',
      notes: r.notes || null,
      terms: r.terms || null,
      lines_count: Array.isArray(r.purchase_order_lines) ? r.purchase_order_lines.length : 0,
      attachment_url: r.attachment_url || null,
    }));

    let allOrdersForKpi = orders;
    if (status !== 'all' || projectId || supplierId) {
      let kpiQuery = supabase.from('purchase_orders').select('id, status, total_amount');
      if (companyId) kpiQuery = kpiQuery.eq('company_id', companyId);
      const { data: allPoRows } = await kpiQuery;
      if (allPoRows) allOrdersForKpi = allPoRows as any;
    }

    const kpis: PurchaseOrdersKPIs = {
      total_pos: allOrdersForKpi.length,
      draft_pos: allOrdersForKpi.filter((o) => o.status === 'draft').length,
      approved_pos: allOrdersForKpi.filter((o) => o.status === 'approved').length,
      partially_received_pos: allOrdersForKpi.filter((o) => o.status === 'partially_received').length,
      received_pos: allOrdersForKpi.filter((o) => o.status === 'received').length,
      closed_pos: allOrdersForKpi.filter((o) => o.status === 'closed').length,
      total_orders_value: allOrdersForKpi.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
    };

    return { kpis, orders };
  } catch (fallbackErr) {
    console.warn('Fallback in fetchPurchaseOrdersSummary caught error:', fallbackErr);
    return {
      kpis: {
        total_pos: 0,
        draft_pos: 0,
        approved_pos: 0,
        partially_received_pos: 0,
        received_pos: 0,
        closed_pos: 0,
        total_orders_value: 0,
      },
      orders: [],
    };
  }
}

export async function fetchPurchaseOrderMatching(poId: string): Promise<ThreeWayMatchingResponse> {
  try {
    const { data, error } = await supabase.rpc('get_purchase_order_matching', {
      p_po_id: poId,
    });

    if (!error && data) {
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
  } catch (rpcErr) {
    console.warn('RPC get_purchase_order_matching failed, fallback to table query:', rpcErr);
  }

  // Fallback direct table query
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('id, po_number, order_date, status, subtotal, tax_amount, total_amount, attachment_url, partners:supplier_id(name), projects:project_id("Property")')
    .eq('id', poId)
    .maybeSingle();

  const { data: lines } = await supabase
    .from('purchase_order_lines')
    .select('*')
    .eq('po_id', poId);

  const { data: receipts } = await supabase
    .from('material_receipts')
    .select('id, receipt_number, receipt_date, total_amount, status, is_posted')
    .eq('po_id', poId);

  const { data: invoices } = await supabase
    .from('supplier_invoices')
    .select('id, invoice_number, supplier_invoice_ref, invoice_date, subtotal, tax_amount, total_amount, status, is_posted, attachment_url')
    .eq('po_id', poId);

  const matchingLines: ThreeWayMatchingLine[] = (lines || []).map((l: any) => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unit_price) || 0;
    const total = Number(l.total_price) || qty * price;
    const recQty = Number(l.received_quantity) || 0;
    const recTotal = recQty * price;
    return {
      po_line_id: l.id,
      item_name: l.item_name || 'بند غير محدد',
      unit: l.unit || 'وحدة',
      ordered_qty: qty,
      po_unit_price: price,
      po_total: total,
      received_qty: recQty,
      received_total: recTotal,
      invoiced_qty: recQty,
      invoiced_unit_price: price,
      invoiced_total: recTotal,
      remaining_to_receive: Math.max(0, qty - recQty),
      remaining_to_invoice: Math.max(0, qty - recQty),
      price_variance: 0,
      qty_variance: 0,
      status: (recQty >= qty ? 'fully_matched' : recQty > 0 ? 'partially_received' : 'unmatched') as any,
    };
  });

  const totalOrdered = matchingLines.reduce((s, l) => s + l.po_total, 0);
  const totalReceived = matchingLines.reduce((s, l) => s + l.received_total, 0);

  return {
    po: {
      id: po?.id || poId,
      po_number: po?.po_number || '',
      order_date: po?.order_date || '',
      supplier_name: (po as any)?.partners?.name || 'مورد غير محدد',
      project_name: (po as any)?.projects?.Property || 'مشروع عام',
      status: po?.status || 'draft',
      subtotal: Number(po?.subtotal) || 0,
      tax_amount: Number(po?.tax_amount) || 0,
      total_amount: Number(po?.total_amount) || 0,
      attachment_url: po?.attachment_url || null,
    },
    receipts: (receipts || []).map((r: any) => ({
      id: r.id,
      receipt_number: r.receipt_number,
      receipt_date: r.receipt_date,
      total_amount: Number(r.total_amount) || 0,
      status: r.status,
      is_posted: !!r.is_posted,
    })),
    invoices: (invoices || []).map((i: any) => ({
      id: i.id,
      invoice_number: i.invoice_number,
      supplier_invoice_ref: i.supplier_invoice_ref,
      invoice_date: i.invoice_date,
      subtotal: Number(i.subtotal) || 0,
      tax_amount: Number(i.tax_amount) || 0,
      total_amount: Number(i.total_amount) || 0,
      status: i.status,
      is_posted: !!i.is_posted,
      attachment_url: i.attachment_url || null,
    })),
    lines: matchingLines,
    summary: {
      total_ordered_amount: totalOrdered,
      total_received_amount: totalReceived,
      total_invoiced_amount: totalReceived,
      total_price_variance: 0,
      is_fully_matched: matchingLines.length > 0 && matchingLines.every((l) => l.status === 'fully_matched'),
    },
  };
}

export async function createPurchaseOrder(input: CreatePoInput): Promise<string> {
  const companyId = getActiveCompanyId();
  try {
    const { data, error } = await supabase.rpc('create_purchase_order', {
      p_supplier_id: input.supplier_id,
      p_project_id: input.project_id || null,
      p_order_date: input.order_date,
      p_expected_delivery: input.expected_delivery_date || null,
      p_notes: input.notes || '',
      p_terms: input.terms || '',
      p_lines: input.lines,
    });

    if (!error && data) {
      if (input.attachment_url) {
        await supabase.from('purchase_orders').update({ attachment_url: input.attachment_url }).eq('id', data);
      }
      return data as string;
    }
  } catch (rpcErr) {
    console.warn('RPC create_purchase_order failed, fallback to direct insert:', rpcErr);
  }

  // Fallback direct insert
  const subtotal = input.lines.reduce((s, l) => s + (Number(l.quantity) * Number(l.unit_price)), 0);
  const taxAmount = input.lines.reduce((s, l) => s + (Number(l.quantity) * Number(l.unit_price) * (Number(l.tax_rate) || 0) / 100), 0);
  const totalAmount = subtotal + taxAmount;
  const poNumber = `PO-${Date.now().toString().slice(-6)}`;

  const poPayload: any = {
    po_number: poNumber,
    supplier_id: input.supplier_id,
    project_id: input.project_id || null,
    order_date: input.order_date,
    expected_delivery_date: input.expected_delivery_date || null,
    notes: input.notes || null,
    terms: input.terms || null,
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    status: 'draft',
    attachment_url: input.attachment_url || null,
  };
  if (companyId) poPayload.company_id = companyId;

  const { data: newPo, error: insertPoErr } = await supabase
    .from('purchase_orders')
    .insert([poPayload])
    .select('id')
    .single();

  if (insertPoErr) throw insertPoErr;

  const newPoId = newPo.id;
  if (input.lines.length > 0) {
    const linesPayload = input.lines.map((l) => ({
      po_id: newPoId,
      item_id: l.item_id || null,
      item_name: l.item_name,
      description: l.description || null,
      quantity: Number(l.quantity) || 0,
      unit: l.unit || 'وحدة',
      unit_price: Number(l.unit_price) || 0,
      total_price: Number(l.quantity) * Number(l.unit_price),
      tax_rate: Number(l.tax_rate) || 0,
      tax_amount: (Number(l.quantity) * Number(l.unit_price) * (Number(l.tax_rate) || 0)) / 100,
      boq_item_id: l.boq_item_id || null,
      company_id: companyId || undefined,
    }));

    await supabase.from('purchase_order_lines').insert(linesPayload);
  }

  return newPoId;
}

export async function approvePurchaseOrder(poId: string): Promise<any> {
  try {
    const { data, error } = await supabase.rpc('approve_purchase_order', {
      p_po_id: poId,
    });
    if (!error) return data;
  } catch (e) {
    // fallback
  }

  const { data, error } = await supabase
    .from('purchase_orders')
    .update({ status: 'approved' })
    .eq('id', poId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function receiveMaterialsFromPo(
  poId: string,
  receiptDate: string,
  lines: ReceivePoLineInput[],
  notes?: string
): Promise<any> {
  const companyId = getActiveCompanyId();
  try {
    const { data, error } = await supabase.rpc('receive_materials_from_po', {
      p_po_id: poId,
      p_receipt_date: receiptDate,
      p_lines: lines,
      p_notes: notes || '',
    });
    if (!error) return data;
  } catch (e) {
    // fallback
  }

  // Fallback: update PO line quantities and PO status
  for (const line of lines) {
    const { data: poLine } = await supabase
      .from('purchase_order_lines')
      .select('received_quantity, quantity')
      .eq('id', line.po_line_id)
      .single();
    if (poLine) {
      const newRec = (Number(poLine.received_quantity) || 0) + Number(line.quantity);
      await supabase
        .from('purchase_order_lines')
        .update({ received_quantity: newRec })
        .eq('id', line.po_line_id);
    }
  }

  // Update PO overall status
  const { data: allLines } = await supabase
    .from('purchase_order_lines')
    .select('quantity, received_quantity')
    .eq('po_id', poId);

  const totalOrdered = (allLines || []).reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const totalReceived = (allLines || []).reduce((s, l) => s + (Number(l.received_quantity) || 0), 0);
  const newStatus = totalReceived >= totalOrdered ? 'received' : totalReceived > 0 ? 'partially_received' : 'approved';

  await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', poId);
  return { status: newStatus };
}

export async function createSupplierInvoice(input: CreateSupplierInvoiceInput): Promise<string> {
  const companyId = getActiveCompanyId();
  try {
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

    if (!error && data) {
      if (input.attachment_url) {
        await supabase.from('supplier_invoices').update({ attachment_url: input.attachment_url }).eq('id', data);
      }
      return data as string;
    }
  } catch (rpcErr) {
    console.warn('RPC create_supplier_invoice failed, fallback to table insert:', rpcErr);
  }

  // Direct table insert fallback
  const subtotal = input.lines.reduce((s, l) => s + (Number(l.quantity) * Number(l.unit_price)), 0);
  const taxAmount = input.lines.reduce((s, l) => s + (Number(l.quantity) * Number(l.unit_price) * (Number(l.tax_rate) || 0) / 100), 0);
  const totalAmount = subtotal + taxAmount;
  const invoiceNumber = `INV-SUP-${Date.now().toString().slice(-6)}`;

  const invPayload: any = {
    invoice_number: invoiceNumber,
    supplier_id: input.supplier_id,
    supplier_invoice_ref: input.supplier_invoice_ref,
    po_id: input.po_id || null,
    invoice_date: input.invoice_date,
    due_date: input.due_date || null,
    notes: input.notes || null,
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    status: 'draft',
    is_posted: false,
    attachment_url: input.attachment_url || null,
  };
  if (companyId) invPayload.company_id = companyId;

  const { data: newInv, error: insertInvErr } = await supabase
    .from('supplier_invoices')
    .insert([invPayload])
    .select('id')
    .single();

  if (insertInvErr) throw insertInvErr;

  const newInvId = newInv.id;
  if (input.lines.length > 0) {
    const linesPayload = input.lines.map((l) => ({
      invoice_id: newInvId,
      po_line_id: l.po_line_id || null,
      receipt_line_id: l.receipt_line_id || null,
      item_name: l.item_name,
      quantity: Number(l.quantity) || 0,
      unit: l.unit || 'وحدة',
      unit_price: Number(l.unit_price) || 0,
      total_price: Number(l.quantity) * Number(l.unit_price),
      tax_rate: Number(l.tax_rate) || 0,
      tax_amount: (Number(l.quantity) * Number(l.unit_price) * (Number(l.tax_rate) || 0)) / 100,
      company_id: companyId || undefined,
    }));

    await supabase.from('supplier_invoice_lines').insert(linesPayload);
  }

  return newInvId;
}

export async function postSupplierInvoice(invoiceId: string): Promise<any> {
  try {
    const { data, error } = await supabase.rpc('post_supplier_invoice', {
      p_invoice_id: invoiceId,
    });
    if (!error) return data;
  } catch (e) {
    // fallback
  }

  const { data, error } = await supabase
    .from('supplier_invoices')
    .update({ is_posted: true, status: 'approved' })
    .eq('id', invoiceId)
    .select()
    .single();

  if (error) throw error;
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
  try {
    const { data, error } = await supabase
      .from('material_items')
      .select('id, item_code, item_name, default_unit, default_unit_price')
      .order('item_name');
    if (error) {
      console.warn('Warning fetching material items:', error);
      return [];
    }
    return (data || []).map((m: any) => ({
      id: m.id,
      item_code: m.item_code,
      name: m.item_name,
      item_name: m.item_name,
      unit: m.default_unit || 'وحدة',
      default_unit: m.default_unit || 'وحدة',
      default_price: Number(m.default_unit_price) || 0,
      default_unit_price: Number(m.default_unit_price) || 0,
    }));
  } catch (err) {
    console.error('Failed to fetch material items:', err);
    return [];
  }
}
