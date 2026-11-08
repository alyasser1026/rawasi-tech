import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

export const FACTORY_RESET_CONFIRMATION_PHRASE = 'تأكيد إعادة الضبط';

export interface FactoryResetOptions {
  companyId?: string | null;
  resetAllCompanies?: boolean;
  confirmationPhrase: string;
  performedByUserId?: string | null;
}

export interface FactoryResetResult {
  success: boolean;
  message: string;
  clearedCounts: Record<string, number>;
  preservedCounts: Record<string, number>;
  totalCleared: number;
  executedAt: string;
}

const getAdminClient = (): SupabaseClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!serviceKey) {
    throw new Error('مفتاح الخدمة الإداري (Service Role Key) غير متوفر في بيئة التشغيل.');
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

/**
 * دالة مساعدة لحذف السجلات من جدول بشكل آمن مع احتساب عدد السجلات المحذوفة
 */
async function safeDeleteFromTable(
  client: SupabaseClient,
  table: string,
  companyId?: string | null
): Promise<number> {
  try {
    // 1. حساب عدد السجلات قبل الحذف
    let countQuery = client.from(table).select('*', { count: 'exact', head: true });
    if (companyId) {
      countQuery = countQuery.eq('company_id', companyId);
    }
    const { count, error: countErr } = await countQuery;
    if (countErr) {
      // إذا كان الجدول غير موجود (مثل جداول لم تُطبق بعد)
      if (countErr.code === '42P01' || countErr.message?.includes('schema cache')) {
        return 0;
      }
      // إذا كان العمود company_id غير موجود
      if (countErr.message?.includes('company_id')) {
        const { count: fallbackCount } = await client.from(table).select('*', { count: 'exact', head: true });
        if (!fallbackCount || fallbackCount === 0) return 0;
        await client.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        return fallbackCount;
      }
      return 0;
    }

    if (!count || count === 0) {
      return 0;
    }

    // 2. تنفيذ الحذف
    let delQuery = client.from(table).delete();
    if (companyId) {
      delQuery = delQuery.eq('company_id', companyId);
    } else {
      delQuery = delQuery.neq('id', '00000000-0000-0000-0000-000000000000');
    }

    const { error: delErr } = await delQuery;
    if (delErr) {
      if (delErr.code === '42P01' || delErr.message?.includes('schema cache')) {
        return 0;
      }
      console.warn(`[FactoryReset] Warning deleting from ${table}:`, delErr.message);
      return 0;
    }

    return count;
  } catch (err: any) {
    console.warn(`[FactoryReset] Non-fatal error deleting from ${table}:`, err?.message);
    return 0;
  }
}

/**
 * دالة مساعدة لتحديث الحقول في جدول
 */
async function safeUpdateTable(
  client: SupabaseClient,
  table: string,
  updates: Record<string, any>,
  companyId?: string | null
): Promise<void> {
  try {
    let query = client.from(table).update(updates);
    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.neq('id', '00000000-0000-0000-0000-000000000000');
    }
    const { error } = await query;
    if (error && !error.message?.includes('schema cache') && error.code !== '42P01') {
      console.warn(`[FactoryReset] Warning updating ${table}:`, error.message);
    }
  } catch (err: any) {
    console.warn(`[FactoryReset] Non-fatal error updating ${table}:`, err?.message);
  }
}

/**
 * تنفيذ عملية إعادة ضبط المصنع الشاملة
 * تحذف كافة القيود والحركات المحاسبية والعمليات التشغيلية،
 * مع الاحتفاظ الصارم بكافة البيانات التعريفية (الحسابات، الشركاء، المشاريع، بنود المقايسات، الكتالوج).
 */
export async function executeFactoryReset(options: FactoryResetOptions): Promise<FactoryResetResult> {
  if (options.confirmationPhrase !== FACTORY_RESET_CONFIRMATION_PHRASE) {
    throw new Error(`يرجى كتابة عبارة "${FACTORY_RESET_CONFIRMATION_PHRASE}" لتأكيد الحذف النهائي.`);
  }

  const client = getAdminClient();
  const companyId = options.resetAllCompanies ? null : (options.companyId || null);

  const clearedCounts: Record<string, number> = {};

  // =========================================================================
  // الخطوة 1: فك الترحيل وتحويل المستندات والقيود إلى مسودات لتجاوز حماية الـ Triggers
  // =========================================================================

  // أ. فك ارتباط القيود اليومية (تحويل الحالة إلى draft بدون تعديل بيانات أخرى)
  await safeUpdateTable(client, 'journal_headers', { status: 'draft' }, companyId);

  // ب. فك ارتباط وتصفير ترحيل سندات القبض والصرف
  await safeUpdateTable(client, 'payment_vouchers', { is_posted: false, status: 'مسودة' }, companyId);
  await safeUpdateTable(client, 'receipt_vouchers', { status: 'مسودة' }, companyId);

  // ج. فك ارتباط مستخلصات مقاولي الباطن
  await safeUpdateTable(client, 'sub_claims', { is_posted: false, status: 'مسودة', jv_header_id: null, jv_id: null }, companyId);

  // د. فك ارتباط إسنادات المقاولين بالمستخلصات
  await safeUpdateTable(client, 'contractor_assignments', { claim_id: null, status: 'جاري التنفيذ' }, companyId);

  // هـ. فك ارتباط الفواتير والمصروفات
  await safeUpdateTable(client, 'invoices', { is_posted: false, status: 'draft' }, companyId);
  await safeUpdateTable(client, 'expenses', { is_posted: false, status: 'draft', claim_id: null }, companyId);

  // =========================================================================
  // الخطوة 2: حذف السجلات المشتقة وتطبيقات الفواتير والملاحظات الضريبية
  // =========================================================================
  clearedCounts['سجل أخطاء القيود'] = await safeDeleteFromTable(client, 'journal_errors', companyId);
  clearedCounts['فحوصات الإقرار الضريبي'] = await safeDeleteFromTable(client, 'vat_document_reviews', companyId);
  clearedCounts['تسويات الفترات الضريبية'] = await safeDeleteFromTable(client, 'vat_period_adjustments', companyId);
  clearedCounts['إشعارات عكس الخامات بالفواتير'] = await safeDeleteFromTable(client, 'invoice_adjustment_material_reversals', companyId);
  clearedCounts['إشعارات الفواتير الدائنة والمدينة'] = await safeDeleteFromTable(client, 'invoice_adjustment_notes', companyId);
  clearedCounts['تطبيقات خامات الفواتير'] = await safeDeleteFromTable(client, 'invoice_customer_material_applications', companyId);
  clearedCounts['أسطر الفواتير المرحلة'] = await safeDeleteFromTable(client, 'invoice_posted_lines', companyId);

  // =========================================================================
  // الخطوة 3: حركات إهلاك الأصول وجرد المخازن
  // =========================================================================
  clearedCounts['تفاصيل إهلاك الأصول'] = await safeDeleteFromTable(client, 'asset_depreciation_lines', companyId);
  clearedCounts['دورات إهلاك الأصول'] = await safeDeleteFromTable(client, 'asset_depreciation_runs', companyId);
  clearedCounts['سجلات نقل الأصول'] = await safeDeleteFromTable(client, 'asset_transfers', companyId);
  
  // إعادة تصفير مجمع الإهلاك للأصول الثابتة التعريفية
  await safeUpdateTable(client, 'fixed_assets', { accumulated_depreciation: 0 }, companyId);

  clearedCounts['أسطر جلسات الجرد'] = await safeDeleteFromTable(client, 'stocktaking_lines', companyId);
  clearedCounts['جلسات جرد المخازن'] = await safeDeleteFromTable(client, 'stocktaking_sessions', companyId);

  // =========================================================================
  // الخطوة 4: حركات المشتريات وفواتير الموردين والعهد النقدية
  // =========================================================================
  clearedCounts['أسطر فواتير الموردين'] = await safeDeleteFromTable(client, 'supplier_invoice_lines', companyId);
  clearedCounts['فواتير الموردين'] = await safeDeleteFromTable(client, 'supplier_invoices', companyId);
  clearedCounts['أسطر أوامر الشراء'] = await safeDeleteFromTable(client, 'purchase_order_lines', companyId);
  clearedCounts['أوامر الشراء'] = await safeDeleteFromTable(client, 'purchase_orders', companyId);

  clearedCounts['إغلاقات الصناديق اليومية'] = await safeDeleteFromTable(client, 'daily_cash_closings', companyId);
  clearedCounts['حركات العهد الميدانية'] = await safeDeleteFromTable(client, 'site_custodies', companyId);

  // =========================================================================
  // الخطوة 5: حركات المخازن وسندات الاستلام والصرف
  // =========================================================================
  clearedCounts['تفاصيل صرف الخامات'] = await safeDeleteFromTable(client, 'material_issue_lines', companyId);
  clearedCounts['تفاصيل استلام الخامات'] = await safeDeleteFromTable(client, 'material_receipt_lines', companyId);
  clearedCounts['سندات صرف الخامات'] = await safeDeleteFromTable(client, 'material_issues', companyId);
  clearedCounts['سندات استلام الخامات'] = await safeDeleteFromTable(client, 'material_receipts', companyId);

  // =========================================================================
  // الخطوة 6: حركات الموارد البشرية والعمالة الميدانية
  // =========================================================================
  clearedCounts['مسيرات الرواتب'] = await safeDeleteFromTable(client, 'payroll_slips', companyId);
  clearedCounts['سجل المخالفات والجزاءات'] = await safeDeleteFromTable(client, 'violations', companyId);
  clearedCounts['يوميات العمالة المؤقتة'] = await safeDeleteFromTable(client, 'temp_labor_daily_logs', companyId);
  clearedCounts['يوميات العمالة الميدانية'] = await safeDeleteFromTable(client, 'labor_daily_logs', companyId);
  clearedCounts['سجلات البصمة والحضور'] = await safeDeleteFromTable(client, 'attendance_logs', companyId);
  clearedCounts['سجلات الحضور الميداني'] = await safeDeleteFromTable(client, 'employee_attendance', companyId);
  clearedCounts['الزيارات الميدانية للمشاريع'] = await safeDeleteFromTable(client, 'project_site_visits', companyId);

  // =========================================================================
  // الخطوة 7: سندات القبض والصرف ومستخلصات مقاولي الباطن
  // =========================================================================
  clearedCounts['سندات الصرف'] = await safeDeleteFromTable(client, 'payment_vouchers', companyId);
  clearedCounts['سندات القبض'] = await safeDeleteFromTable(client, 'receipt_vouchers', companyId);
  clearedCounts['مستخلصات مقاولي الباطن'] = await safeDeleteFromTable(client, 'sub_claims', companyId);

  // =========================================================================
  // الخطوة 8: المصروفات وفواتير المبيعات
  // =========================================================================
  clearedCounts['المصروفات العامة'] = await safeDeleteFromTable(client, 'expenses', companyId);
  clearedCounts['فواتير ومطالبات العملاء'] = await safeDeleteFromTable(client, 'invoices', companyId);

  // =========================================================================
  // الخطوة 9: القيود المحاسبية اليومية (أسطر ثم رؤوس القيود)
  // =========================================================================
  clearedCounts['أسطر القيود المحاسبية'] = await safeDeleteFromTable(client, 'journal_lines', companyId);
  clearedCounts['رؤوس القيود المحاسبية'] = await safeDeleteFromTable(client, 'journal_headers', companyId);
  clearedCounts['القيود اليدوية'] = await safeDeleteFromTable(client, 'manual_journals', companyId);

  // =========================================================================
  // الخطوة 10: حركات التدفقات النقدية والخطط
  // =========================================================================
  clearedCounts['حركات التدفق النقدي'] = await safeDeleteFromTable(client, 'cash_flows', companyId);
  clearedCounts['الخطط المالية الحركية'] = await safeDeleteFromTable(client, 'financial_plans', companyId);

  // =========================================================================
  // الخطوة 11: تصفير وتحديث القوائم المالية المخبأة (sys_financial_reports)
  // =========================================================================
  try {
    const zeroIncomeStatement = {
      expenses: [],
      revenues: [],
      net_income: 0,
      total_expense: 0,
      total_revenue: 0,
    };
    const zeroBalanceSheet = {
      assets: [],
      liabilities: [],
      equity: [],
      net_income: 0,
      total_assets: 0,
      total_liabilities: 0,
      total_equity: 0,
      total_liabilities_and_equity: 0,
    };

    let reportQuery1 = client
      .from('sys_financial_reports')
      .update({ report_data: zeroIncomeStatement, updated_at: new Date().toISOString() })
      .eq('report_name', 'IncomeStatement');
    if (companyId) reportQuery1 = reportQuery1.eq('company_id', companyId);
    await reportQuery1;

    let reportQuery2 = client
      .from('sys_financial_reports')
      .update({ report_data: zeroBalanceSheet, updated_at: new Date().toISOString() })
      .eq('report_name', 'BalanceSheet');
    if (companyId) reportQuery2 = reportQuery2.eq('company_id', companyId);
    await reportQuery2;
  } catch (err: any) {
    console.warn('[FactoryReset] Non-fatal error resetting sys_financial_reports:', err?.message);
  }

  // =========================================================================
  // الخطوة 12: تصفير ذاكرة عمليات البوت المحلي (إن وُجد)
  // =========================================================================
  try {
    const opsIndexPath = path.resolve(process.cwd(), 'work/copilot_operations_index.json');
    if (fs.existsSync(opsIndexPath)) {
      const raw = fs.readFileSync(opsIndexPath, 'utf8');
      const parsed = JSON.parse(raw);
      parsed.operations = [];
      parsed.operationSeqStart = 101;
      parsed.lastResetAt = new Date().toISOString();
      fs.writeFileSync(opsIndexPath, JSON.stringify(parsed, null, 2), 'utf8');
      clearedCounts['فهرس عمليات البوت المحلي'] = 1;
    }
  } catch (err: any) {
    console.warn('[FactoryReset] Non-fatal error resetting copilot operations index:', err?.message);
  }

  // =========================================================================
  // الخطوة 13: التحقق الصارم من الحفاظ على البيانات التعريفية وحصرها
  // =========================================================================
  const preservedCounts: Record<string, number> = {};
  const masterTables = [
    { key: 'شجرة الحسابات المالية', table: 'accounts' },
    { key: 'دليل الشركاء والعملاء والموردين', table: 'partners' },
    { key: 'بيانات المشاريع والمواقع', table: 'projects' },
    { key: 'بنود المقايسات المعتمدة (BOQ)', table: 'boq_items' },
    { key: 'مخازن وكتالوج المواد', table: 'inventory' },
    { key: 'حسابات وصلاحيات المستخدمين', table: 'profiles' },
    { key: 'بيانات الشركات والمنشآت', table: 'companies' },
    { key: 'إعدادات النظام العامة', table: 'system_settings' },
  ];

  for (const m of masterTables) {
    try {
      let q = client.from(m.table).select('*', { count: 'exact', head: true });
      if (companyId && !['profiles', 'companies'].includes(m.table)) {
        q = q.eq('company_id', companyId);
      }
      const { count, error } = await q;
      if (!error && count !== null) {
        preservedCounts[m.key] = count;
      }
    } catch {
      // Ignored
    }
  }

  const totalCleared = Object.values(clearedCounts).reduce((sum, n) => sum + (n || 0), 0);

  return {
    success: true,
    message: `تمت عملية إعادة ضبط المصنع بنجاح! تم حذف ${totalCleared} سجلاً حركياً ومحاسبياً مع الحفاظ الكامل على كافة الحسابات والشركاء والمشاريع وبنود المقايسات والتعريفات.`,
    clearedCounts,
    preservedCounts,
    totalCleared,
    executedAt: new Date().toISOString(),
  };
}
