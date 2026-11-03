import type { supabase } from './supabase';

type RpcClient = Pick<typeof supabase, 'rpc'>;
type PayrollRecord = Record<string, any>;

export function decimalValue(value: unknown): string {
  const text = value === null || value === undefined || value === '' ? '0' : String(value).trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) || !Number.isFinite(Number(text))) {
    throw new Error('أدخل مبلغًا عشريًا صحيحًا ومحددًا.');
  }
  return text;
}

// Decimal addition/subtraction for payroll previews and payloads, without binary
// arithmetic or a new rounding policy. PostgreSQL recomputes authoritative totals.
export function decimalSum(...values: unknown[]): string {
  const parts = values.map(value => {
    const [mantissa, exponentText = '0'] = decimalValue(value).toLowerCase().split('e');
    if (Math.abs(Number(exponentText)) > 1000) throw new Error('المبلغ خارج نطاق إدخال المسير.');
    const negative = mantissa.startsWith('-');
    const unsigned = mantissa.replace(/^[+-]/, '');
    const [whole, fraction = ''] = unsigned.split('.');
    let coefficient = BigInt((whole || '0') + fraction) * BigInt(negative ? -1 : 1);
    let scale = fraction.length - Number(exponentText);
    if (scale < 0) { coefficient *= BigInt(10) ** BigInt(-scale); scale = 0; }
    return { coefficient, scale };
  });
  const scale = Math.max(0, ...parts.map(p => p.scale));
  const total = parts.reduce((sum, p) => sum + p.coefficient * BigInt(10) ** BigInt(scale - p.scale), BigInt(0));
  const negative = total < BigInt(0);
  const digits = (negative ? -total : total).toString().padStart(scale + 1, '0');
  const number = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, '') : digits;
  return `${negative ? '-' : ''}${number || '0'}`;
}

export function decimalSubtract(value: unknown, ...deductions: unknown[]): string {
  return decimalSum(value, ...deductions.map(item => {
    const text = decimalValue(item);
    return text.startsWith('-') ? text.slice(1) : `-${text.replace(/^\+/, '')}`;
  }));
}

export function payrollDraftRows(records: PayrollRecord[]) {
  return records.filter(r => r.type === 'موظف' && !r.is_posted).map(r => ({
    emp_id: r.id,
    basic_salary: decimalValue(r.base_rate),
    allowances: decimalValue(r.allowances),
    amount_to_pay: decimalValue(r.amount_to_pay),
    status: r.status || 'غير مدفوع'
  }));
}

export async function savePayrollDrafts(client: RpcClient, month: string, cutoffDate: string, records: PayrollRecord[]) {
  const rows = payrollDraftRows(records);
  if (!rows.length) throw new Error('لا توجد مسودات رواتب شهرية للحفظ ضمن الاختيار.');
  const { data, error } = await client.rpc('save_payroll_drafts', { p_month: month, p_cutoff_date: cutoffDate, p_rows: rows });
  if (error) throw new Error(error.message);
  return data;
}

export async function postPayroll(client: RpcClient, month: string, cutoffDate: string, records: PayrollRecord[]) {
  const rows = payrollDraftRows(records).filter(r => Number(decimalSum(r.basic_salary, r.allowances)) > 0);
  if (!rows.length) throw new Error('لا توجد رواتب شهرية موجبة وغير مرحلة ضمن الاختيار.');
  const { data, error } = await client.rpc('save_and_post_payroll', { p_month: month, p_cutoff_date: cutoffDate, p_rows: rows });
  if (error) throw new Error(error.message);
  return data;
}

export async function unpostPayroll(client: RpcClient, month: string, records: PayrollRecord[]) {
  const ids = records.filter(r => r.type === 'موظف' && r.is_posted).map(r => r.id);
  if (!ids.length) throw new Error('لا توجد رواتب شهرية مرحلة ضمن الاختيار.');
  const { data, error } = await client.rpc('unpost_payroll_slips', { p_month: month, p_employee_ids: ids });
  if (error) throw new Error(error.message);
  return data;
}
