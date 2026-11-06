import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateWorkerStatementPdf, generateEngineeringChecklistPdf } from './pdf-generator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const CHECKLIST_DOC_PATH = path.join(rootDir, 'config', 'copilot_engineering_checklists.md');
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const LABOR_PAGE_SIZE = 100;
const DAY_MS = 86_400_000;
const MISSING_DATA_SCOPE = 'بيانات فاي تك غير متاحة بدون جلسة مستخدم وشركة مصرح بها.';
const SOURCE_UNAVAILABLE = 'تعذّر جلب البيانات من فاي تك. راجع الصلاحية وتوفر المصدر.';

function readJwtClaims(token) {
  if (typeof token !== 'string' || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return null;
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function getRestBase(supabaseUrl) {
  try {
    const url = new URL(supabaseUrl);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.href.replace(/\/+$/, '') + '/rest/v1/';
  } catch {
    return null;
  }
}

function isPublishableKey(key) {
  return typeof key === 'string' && (/^sb_publishable_[\w-]+$/.test(key) || readJwtClaims(key)?.role === 'anon');
}

function isCurrentUserToken(token) {
  // Structural check only. Supabase validates the signature and runs RLS for this user.
  const claims = readJwtClaims(token);
  return claims?.role === 'authenticated' && typeof claims.sub === 'string' &&
    UUID.test(claims.sub) && Number.isFinite(claims.exp) && claims.exp > Date.now() / 1000;
}

function parseIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const timestamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().startsWith(value) ? timestamp : NaN;
}

/**
 * High-performance database query and action tools for Phi Tech Copilot
 */
export function createCopilotTools({ supabaseUrl, supabaseKey, accessToken, companyId, botToken, fetchImpl = fetch } = {}) {
  const restBase = getRestBase(supabaseUrl);
  const hasDataScope = () => Boolean(restBase && typeof companyId === 'string' && UUID.test(companyId) &&
    isPublishableKey(supabaseKey) && isCurrentUserToken(accessToken));

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  // Helper for REST queries
  async function fetchRest(endpoint, { exactCount = false } = {}) {
    if (!hasDataScope()) return { error: MISSING_DATA_SCOPE, data: null };
    try {
      const headers = { apikey: supabaseKey, Authorization: 'Bearer ' + accessToken, 'x-company-id': companyId };
      if (exactCount) headers.Prefer = 'count=exact';
      const res = await fetchImpl(restBase + endpoint, {
        method: 'GET',
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return { error: SOURCE_UNAVAILABLE, data: null };
      const data = await res.json();
      if (!Array.isArray(data)) return { error: SOURCE_UNAVAILABLE, data: null };
      if (!exactCount) return { data, error: null };
      const countMatch = /\/(\d+)$/.exec(res.headers.get('content-range') ?? '');
      const total = countMatch ? Number(countMatch[1]) : null;
      return { data, error: null, total: Number.isSafeInteger(total) && total >= data.length ? total : null };
    } catch {
      return { error: SOURCE_UNAVAILABLE, data: null };
    }
  }

  return {
    // 1. يوميات وحضور العمال
    async get_labor_daily_logs({ date, start_date, end_date, worker_name } = {}) {
      const start = parseIsoDate(date ?? start_date);
      const end = parseIsoDate(date ?? end_date);
      if ((date != null && (start_date != null || end_date != null)) ||
        !Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start >= 31 * DAY_MS) {
        return { success: false, error: 'حدّد تاريخًا صحيحًا أو فترة لا تتجاوز 31 يومًا.' };
      }
      const query = new URLSearchParams({
        company_id: 'eq.' + companyId,
        select: 'work_date,worker_name,site_ref,work_item,attendance_value',
        order: 'work_date.desc,worker_name.asc',
        limit: String(LABOR_PAGE_SIZE),
      });
      if (date != null) {
        query.append('work_date', 'eq.' + date);
      } else {
        query.append('work_date', 'gte.' + start_date);
        query.append('work_date', 'lte.' + end_date);
      }

      if (typeof worker_name === 'string' && worker_name.trim()) {
        query.append('worker_name', 'eq.' + worker_name.trim());
      }

      const { data, error, total } = await fetchRest('labor_daily_logs?' + query, { exactCount: true });
      if (error) return { success: false, error };

      return {
        success: true,
        date_filter: date ?? (start_date + ' إلى ' + end_date),
        count_records: total,
        returned_count: data.length,
        partial: total == null || total > data.length,
        logs: data.slice(0, 30).map(({ work_date, worker_name, site_ref, work_item, attendance_value }) => ({
          work_date, worker_name, site_ref, work_item, attendance_value,
        })),
      };
    },

    // 2. كشف من عجز في الطريحة
    async get_tareeha_deficits({ date, start_date, end_date }) {
      const targetDate = (date === 'today' || date === 'النهاردة' || date === 'اليوم') ? getTodayDate() : date;
      let query = 'labor_daily_logs?tareeha=gt.0&select=id,work_date,worker_name,site_ref,work_item,tareeha,productivity,unit,daily_wage,notes&order=work_date.desc';
      
      if (targetDate) {
        query += `&work_date=eq.${targetDate}`;
      } else if (start_date && end_date) {
        query += `&work_date=gte.${start_date}&work_date=lte.${end_date}`;
      }

      const { data, error } = await fetchRest(query);
      if (error) return { success: false, error };

      // الفلترة الدقيقة لمن إنتاجيته أقل من الطريحة
      const deficits = data
        .filter(r => (Number(r.productivity) || 0) < Number(r.tareeha))
        .map(r => {
          const t = Number(r.tareeha);
          const p = Number(r.productivity) || 0;
          return {
            worker_name: r.worker_name,
            work_date: r.work_date,
            site_ref: r.site_ref,
            work_item: r.work_item,
            tareeha: t,
            productivity: p,
            deficit_amount: Number((t - p).toFixed(2)),
            deficit_percentage: Math.round(((t - p) / t) * 100) + '%',
            unit: r.unit || 'متر',
            notes: r.notes || 'لم يحقق كامل الطريحة',
          };
        });

      return {
        success: true,
        period: targetDate || `${start_date || ''} - ${end_date || ''}`,
        total_deficits_count: deficits.length,
        deficits,
      };
    },

    // 3. بيانات وميزانية الفيلا
    async get_villa_and_budget_details({ villa_identifier }) {
      if (!villa_identifier) return { success: false, error: 'يرجى تحديد رقم أو اسم الفيلا' };

      const cleanName = villa_identifier.replace(/^(فيلا|مشروع|عمارة)\s*/, '').trim();
      const { data: projects, error } = await fetchRest(
        `projects?or=(Property.ilike.*${encodeURIComponent(cleanName)}*,project_code.ilike.*${encodeURIComponent(cleanName)}*)&limit=1`
      );

      if (error) return { success: false, error };
      if (projects.length === 0) {
        return { success: false, message: `لم يتم العثور على فيلا أو مشروع برقم: ${villa_identifier}` };
      }

      const proj = projects[0];

      // جلب ميزانية الفيلا من boq_budget
      const { data: budgets, error: budgetError } = await fetchRest(
        `boq_budget?project_id=eq.${proj.id}&select=contract_quantity,actual_quantity,total_contract_amount,actual_revenue,estimated_expenses_cost,actual_expenses_cost,actual_labor_cost,actual_material_cost`
      );
      if (budgetError) return { success: false, error: budgetError };

      let totalContract = Number(proj.contract_value) || 0;
      let totalEstBudget = Number(proj.estimated_budget) || 0;
      let totalActualLabor = 0;
      let totalActualMaterial = 0;
      let totalActualExpenses = 0;

      if (Array.isArray(budgets)) {
        budgets.forEach(b => {
          totalActualLabor += Number(b.actual_labor_cost) || 0;
          totalActualMaterial += Number(b.actual_material_cost) || 0;
          totalActualExpenses += Number(b.actual_expenses_cost) || 0;
        });
      }

      const totalActualCost = totalActualLabor + totalActualMaterial + totalActualExpenses;

      return {
        success: true,
        villa_name: proj.Property,
        project_code: proj.project_code,
        client_name: proj.client_name,
        model_type: proj.unit_type || 'غير محدد',
        model_area: proj.unit_area ? `${proj.unit_area} م²` : 'غير محدد',
        status: proj.status,
        current_stage: proj.current_stage,
        engineer_in_charge: proj.engineer_in_charge || 'غير محدد',
        engineer_phone: proj.engineer_phone,
        financials: {
          contract_value: totalContract,
          estimated_budget: totalEstBudget,
          actual_labor_spent: totalActualLabor,
          actual_material_spent: totalActualMaterial,
          actual_expenses_spent: totalActualExpenses,
          total_actual_cost: totalActualCost,
          remaining_budget: totalEstBudget > 0 ? totalEstBudget - totalActualCost : null,
          profit_margin: totalContract > 0 ? totalContract - totalActualCost : null,
        },
      };
    },

    // 4. عدد ومواصفات فلل نموذج معين
    async get_model_villas_and_specs({ model_name }) {
      if (!model_name) return { success: false, error: 'يرجى تحديد اسم أو رمز النموذج' };

      const cleanModel = model_name.replace(/^(نموذج|موديل)\s*/, '').trim();
      const { data: villas, error } = await fetchRest(
        `projects?unit_type=ilike.*${encodeURIComponent(cleanModel)}*&select=id,Property,project_code,status,current_stage,unit_type,unit_area,client_name`
      );

      if (error) return { success: false, error };
      if (villas.length === 0) {
        return { success: false, message: `لا توجد فلل مسجلة تحت نموذج: ${model_name}` };
      }

      const count = villas.length;
      const sampleArea = villas[0].unit_area ? `${villas[0].unit_area} م²` : 'حسب المخطط';
      const stages = Array.from(new Set(villas.map(v => v.current_stage || v.status)));

      return {
        success: true,
        model_name: cleanModel,
        villas_count: count,
        villas_list: villas.map(v => `${v.Property} (${v.status || 'قيد التنفيذ'})`),
        specifications: {
          unit_area: sampleArea,
          active_stages: stages,
        },
      };
    },

    // 5. الاستعلام عن كميات البنود واستهلاك المواد في الفيلا
    async get_boq_and_materials({ work_item, villa_identifier }) {
      if (!work_item) return { success: false, error: 'يرجى تحديد اسم البند' };

      const cleanItem = work_item.trim();

      // إذا كانت فيلا محددة
      if (villa_identifier) {
        const cleanVilla = villa_identifier.replace(/^(فيلا|مشروع)\s*/, '').trim();
        const { data: items, error } = await fetchRest(
          `boq_budget?Property=ilike.*${encodeURIComponent(cleanVilla)}*&work_item=ilike.*${encodeURIComponent(cleanItem)}*&select=id,Property,project_id,work_item,contract_quantity,unit,actual_quantity,unit_contract_price,actual_material_cost`
        );

        if (error) return { success: false, error };
        if (items.length === 0) {
          return { success: false, message: `لم يتم العثور على بند "${cleanItem}" في "${villa_identifier}"` };
        }

        const boqRecord = items[0];

        // جلب الخامات المصروفة لهذا البند أو الفيلا
        let materialsQuery = `material_issue_lines?select=item_name,quantity,unit,total_price&limit=15`;
        if (boqRecord.id) {
          materialsQuery += `&boq_id=eq.${boqRecord.id}`;
        }
        const { data: materials, error: materialsError } = await fetchRest(materialsQuery);
        if (materialsError) return { success: false, error: materialsError };

        return {
          success: true,
          villa: boqRecord.Property,
          work_item: boqRecord.work_item,
          contract_quantity: `${boqRecord.contract_quantity} ${boqRecord.unit || 'متر'}`,
          actual_executed_quantity: `${boqRecord.actual_quantity} ${boqRecord.unit || 'متر'}`,
          completion_rate: boqRecord.contract_quantity > 0
            ? Math.round((boqRecord.actual_quantity / boqRecord.contract_quantity) * 100) + '%'
            : '0%',
          actual_material_cost: Number(boqRecord.actual_material_cost || 0),
          consumed_materials: materials && materials.length > 0
            ? materials.map(m => `${m.item_name}: ${m.quantity} ${m.unit} (بقيمة ${Number(m.total_price).toLocaleString()} ر.س)`)
            : 'لم تسجل أذون صرف خامات مخصصة للبند حتى الآن',
        };
      }

      // إذا كان السؤال: "البند كذا في كام فيلا؟"
      const { data: allItems, error } = await fetchRest(
        `boq_budget?work_item=ilike.*${encodeURIComponent(cleanItem)}*&select=Property,contract_quantity,unit,actual_quantity`
      );

      if (error) return { success: false, error };
      if (allItems.length === 0) {
        return { success: false, message: `لم يتم العثور على بند باسم "${cleanItem}" في أي مقايسة` };
      }

      const villasFound = Array.from(new Set(allItems.map(i => i.Property).filter(Boolean)));
      const totalContractQty = allItems.reduce((s, i) => s + (Number(i.contract_quantity) || 0), 0);
      const unit = allItems[0]?.unit || 'متر';

      return {
        success: true,
        work_item: cleanItem,
        villas_count: villasFound.length,
        villas_list: villasFound,
        total_contract_quantity: `${totalContractQty.toLocaleString()} ${unit}`,
      };
    },

    // 6. المقاولين اللي معاهم شغل أو ليهم فلوس
    async get_contractors_summary({ filter_type }) {
      if (filter_type === 'active_work' || filter_type === 'معاهم_شغل') {
        const { data: orders, error } = await fetchRest(
          `job_orders?status=eq.جاري التنفيذ&select=order_number,assigned_qty,unit_price,projects!job_orders_project_id_fkey(Property),partners!job_orders_contractor_id_fkey(name,phone)`
        );

        if (error || !orders) return { success: false, error };

        const activeContractors = orders.map(o => ({
          contractor_name: o.partners?.name || 'مقاول غير مسمى',
          phone: o.partners?.phone || '-',
          project: o.projects?.Property || 'مشروع عام',
          order_number: o.order_number,
          assigned_quantity: o.assigned_qty,
        }));

        return {
          success: true,
          type: 'active_work',
          total_active_orders: activeContractors.length,
          contractors: activeContractors,
        };
      }

      // المقاولين اللي ليهم فلوس
      const { data: partners, error } = await fetchRest(
        `partner_balances_summary?partner_type=eq.مقاول باطن&current_balance=gt.0&select=partner_id,partner_name,total_earned,total_paid,current_balance`
      );

      if (error) return { success: false, error };

      return {
        success: true,
        type: 'contractor_balances',
        total_contractors_with_due_balance: partners.length,
        contractors: partners.map(p => ({
          contractor_name: p.partner_name,
          total_earned: Number(p.total_earned || 0).toLocaleString() + ' ر.س',
          total_paid: Number(p.total_paid || 0).toLocaleString() + ' ر.س',
          remaining_due: Number(p.current_balance || 0).toLocaleString() + ' ر.س',
        })),
      };
    },

    // 7. المستخلصات المعلقة
    async get_pending_subclaims() {
      const { data, error } = await fetchRest(
        `sub_claims?is_posted=eq.false&select=id,claim_number,date,total_amount,net_amount,status,project_names_text,partners!sub_claims_contractor_id_fkey(name)&order=date.desc&limit=15`
      );

      if (error) return { success: false, error };

      return {
        success: true,
        pending_count: data.length,
        claims: data.map(c => ({
          claim_number: c.claim_number || 'مسودة',
          contractor: c.partners?.name || 'غير محدد',
          projects: c.project_names_text || 'مشروع',
          date: c.date,
          status: c.status || 'معلق',
          net_amount: Number(c.net_amount || 0).toLocaleString() + ' ر.س',
        })),
      };
    },

    // 8. تفاصيل أي عملية مالية
    async get_financial_transaction_details({ search_query }) {
      if (!search_query) return { success: false, error: 'يرجى تقديم رقم أو بيان العملية المالية' };

      const cleanQ = search_query.trim();

      const [expRes, payRes, recRes] = await Promise.all([
        fetchRest(`expenses?or=(description.ilike.*${encodeURIComponent(cleanQ)}*,creditor_account.ilike.*${encodeURIComponent(cleanQ)}*)&limit=5`),
        fetchRest(`payment_vouchers?or=(voucher_number.ilike.*${encodeURIComponent(cleanQ)}*,notes.ilike.*${encodeURIComponent(cleanQ)}*)&limit=5`),
        fetchRest(`receipt_vouchers?or=(receipt_number.ilike.*${encodeURIComponent(cleanQ)}*,notes.ilike.*${encodeURIComponent(cleanQ)}*)&limit=5`),
      ]);
      const error = expRes.error || payRes.error || recRes.error;
      if (error) return { success: false, error };

      return {
        success: true,
        expenses_found: expRes.data || [],
        payments_found: payRes.data || [],
        receipts_found: recRes.data || [],
      };
    },

    // 9. إصدار وإرسال كشف حساب عامل PDF مباشرة عبر تليجرام
    async generate_and_send_worker_statement_pdf({ worker_name, start_date, end_date, chatId }) {
      if (!worker_name) return { success: false, error: 'يرجى تحديد اسم العامل' };

      let query = `labor_daily_logs?worker_name=ilike.*${encodeURIComponent(worker_name.trim())}*&select=work_date,site_ref,work_item,daily_wage,attendance_value,tareeha,productivity,unit,notes,production_desc&order=work_date.desc`;
      if (start_date) query += `&work_date=gte.${start_date}`;
      if (end_date) query += `&work_date=lte.${end_date}`;

      const { data: logs, error } = await fetchRest(query);
      if (error) return { success: false, error };
      if (logs.length === 0) {
        return {
          success: false,
          message: `لم يتم العثور على أي يوميات مسجلة للعامل "${worker_name}" في الفترة المحددة.`,
        };
      }

      // توليد ملف الـ PDF عبر Puppeteer
      const pdfBuffer = await generateWorkerStatementPdf({
        workerName: worker_name,
        startDate: start_date,
        endDate: end_date,
        logs,
      });

      // إرسال الـ PDF عبر تليجرام
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append(
        'document',
        new Blob([pdfBuffer], { type: 'application/pdf' }),
        `كشف_حساب_${worker_name.replace(/\s+/g, '_')}.pdf`
      );
      formData.append(
        'caption',
        `📄 <b>كشف حساب وسجل إنتاجية العامل:</b> ${worker_name}\n🕒 <b>الفترة:</b> ${start_date || 'بداية السجلات'} إلى ${end_date || 'اليوم'}\n💰 <b>إجمالي المستحق:</b> ${logs.reduce((s, l) => s + (Number(l.daily_wage) || 0), 0).toLocaleString()} ر.س`
      );

      const sendRes = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendDocument`, {
        method: 'POST',
        body: formData,
      });

      const sendJson = await sendRes.json();
      if (!sendJson.ok) {
        return { success: false, error: sendJson.description || 'فشل إرسال المستند عبر تليجرام' };
      }

      return {
        success: true,
        worker_name,
        records_count: logs.length,
        total_wages: logs.reduce((s, l) => s + (Number(l.daily_wage) || 0), 0),
        message: `تم إصدار وإرسال كشف حساب العامل ${worker_name} بصيغة PDF بنجاح إلى المحادثة!`,
      };
    },

    // 10. مخالفات الموقع والسلامة المهنية
    async get_site_violations({ site_name, violation_type }) {
      let query = 'violations?is_deleted=eq.false&select=id,date,emp_name,site_name,reason,amount,violation_type,image_url,is_posted&order=date.desc&limit=15';
      if (site_name) {
        query += `&site_name=ilike.*${encodeURIComponent(site_name.trim())}*`;
      }
      if (violation_type) {
        query += `&violation_type=ilike.*${encodeURIComponent(violation_type.trim())}*`;
      }

      const { data, error } = await fetchRest(query);
      if (error) return { success: false, error };

      const totalPenalties = data.reduce((s, v) => s + (Number(v.amount) || 0), 0);

      return {
        success: true,
        violations_count: data.length,
        total_penalties: totalPenalties,
        violations: data.map(v => ({
          date: v.date,
          site: v.site_name || 'موقع عام',
          responsible: v.emp_name || 'غير محدد',
          type: v.violation_type || 'غرامة',
          reason: v.reason || 'مخالفة تعليمات الموقع',
          penalty_amount: Number(v.amount || 0).toLocaleString() + ' ر.س',
          has_image: Boolean(v.image_url),
          is_deducted: v.is_posted,
        })),
      };
    },

    // 11. العهد النثرية وإقفال الصناديق اليومي
    async get_custodies_and_closings() {
      const [custRes, closeRes] = await Promise.all([
        fetchRest('site_custodies?select=id,title,disbursed_amount,spent_amount,remaining_amount,status,notes&order=created_at.desc&limit=10'),
        fetchRest('daily_cash_closings?select=closing_date,system_balance,counted_cash,difference,status,reconciliation_notes&order=closing_date.desc&limit=5'),
      ]);
      const error = custRes.error || closeRes.error;
      if (error) return { success: false, error };

      const openCustodies = (custRes.data || []).map(c => ({
        title: c.title,
        disbursed: Number(c.disbursed_amount || 0).toLocaleString() + ' ر.س',
        spent: Number(c.spent_amount || 0).toLocaleString() + ' ر.س',
        remaining: Number(c.remaining_amount || 0).toLocaleString() + ' ر.س',
        status: c.status || 'مفتوحة',
      }));

      const recentClosings = (closeRes.data || []).map(cl => ({
        date: cl.closing_date,
        system_balance: Number(cl.system_balance || 0).toLocaleString() + ' ر.س',
        actual_cash: Number(cl.counted_cash || 0).toLocaleString() + ' ر.س',
        diff: Number(cl.difference || 0).toLocaleString() + ' ر.س',
        status: cl.status || 'معتمد',
      }));

      return {
        success: true,
        open_custodies_count: openCustodies.length,
        custodies: openCustodies,
        recent_closings: recentClosings,
      };
    },

    // 12. المخازن وجرد المستودع
    async get_inventory_status({ item_name }) {
      let query = 'inventory?select=id,item_name,unit,current_stock,avg_price&order=current_stock.asc&limit=25';
      if (item_name) {
        query += `&item_name=ilike.*${encodeURIComponent(item_name.trim())}*`;
      }

      const { data, error } = await fetchRest(query);
      if (error) return { success: false, error };

      return {
        success: true,
        items_count: data.length,
        inventory_items: data.map(item => ({
          name: item.item_name,
          current_stock: `${item.current_stock} ${item.unit || 'وحدة'}`,
          unit_price: Number(item.avg_price || 0).toLocaleString() + ' ر.س',
          is_low_stock: (Number(item.current_stock) || 0) <= 5,
        })),
      };
    },

    // 13. الفواتير والضريبة 15%
    async get_vat_and_invoices_summary() {
      const { data, error } = await fetchRest(
        'invoices?select=invoice_number,date,client_name,taxable_amount,tax_amount,total_amount&order=date.desc&limit=10'
      );
      if (error) return { success: false, error };

      const totalTaxable = data.reduce((s, i) => s + (Number(i.taxable_amount) || 0), 0);
      const totalVat = data.reduce((s, i) => s + (Number(i.tax_amount) || 0), 0);
      const totalBilled = data.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);

      return {
        success: true,
        invoices_count: data.length,
        total_taxable_revenue: totalTaxable.toLocaleString() + ' ر.س',
        total_vat_collected_15: totalVat.toLocaleString() + ' ر.س',
        total_invoices_amount: totalBilled.toLocaleString() + ' ر.س',
        recent_invoices: data.slice(0, 5).map(inv => ({
          invoice_number: inv.invoice_number,
          date: inv.date,
          client: inv.client_name || 'عميل',
          total: Number(inv.total_amount || 0).toLocaleString() + ' ر.س',
          vat: Number(inv.tax_amount || 0).toLocaleString() + ' ر.س',
        })),
      };
    },

    // 14. رادار التنبيهات والوثائق
    async get_company_notifications() {
      const { data, error } = await fetchRest(
        'company_documents?select=title,document_type,expiry_date,alert_days_before&order=expiry_date.asc&limit=15'
      );

      if (error) return { success: false, error };

      return {
        success: true,
        documents_count: data.length,
        documents: data.map(d => ({
          title: d.title,
          type: d.document_type || 'وثيقة عامة',
          expiry_date: d.expiry_date,
        })),
      };
    },

    // 15. الأصول الثابتة والإهلاك
    async get_fixed_assets_summary() {
      const { data, error } = await fetchRest(
        'fixed_assets?select=asset_name,category,purchase_date,purchase_cost,salvage_value,useful_life_years,accumulated_depreciation,current_book_value&limit=15'
      );

      if (error) return { success: false, error };

      const totalAssetCost = data.reduce((s, a) => s + (Number(a.purchase_cost) || 0), 0);
      const totalBookValue = data.reduce((s, a) => s + (Number(a.current_book_value) || 0), 0);

      return {
        success: true,
        assets_count: data.length,
        total_purchase_cost: totalAssetCost.toLocaleString() + ' ر.س',
        total_book_value: totalBookValue.toLocaleString() + ' ر.س',
        assets: data.map(a => ({
          name: a.asset_name,
          category: a.category || 'أصل ثابت',
          cost: Number(a.purchase_cost || 0).toLocaleString() + ' ر.س',
          book_value: Number(a.current_book_value || 0).toLocaleString() + ' ر.س',
        })),
      };
    },

    // 16. استعلام عن الاتشك ليست وخطوات التنفيذ ومواصفات البنود هندسياً
    async get_engineering_checklist_and_specs({ item_name, topic }) {
      if (!item_name) {
        return {
          success: false,
          error: 'يرجى تحديد اسم البند الهندسي (مثال: صب خرسانة، محارة، عزل حمامات، سباكة، مباني، سيراميك، كهرباء)',
        };
      }

      let manualContent = '';
      try {
        if (fs.existsSync(CHECKLIST_DOC_PATH)) {
          manualContent = fs.readFileSync(CHECKLIST_DOC_PATH, 'utf8');
        }
      } catch (err) {
        console.error('Error reading checklist guide:', err);
      }

      const q = item_name.toLowerCase().trim();
      let matchedSection = '';

      if (manualContent) {
        // Find relevant section in the markdown manual
        const sections = manualContent.split(/\n## /);
        for (const sec of sections) {
          if (sec.toLowerCase().includes(q) || (topic && sec.toLowerCase().includes(topic.toLowerCase()))) {
            matchedSection = '## ' + sec;
            break;
          }
        }
        if (!matchedSection && sections.length > 1) {
          // If no direct section match, search by subkeywords
          if (q.includes('خرسان') || q.includes('صب') || q.includes('عمود') || q.includes('سقف') || q.includes('هبوط') || q.includes('slump')) {
            matchedSection = '## ' + sections.find(s => s.includes('الخرسانات'));
          } else if (q.includes('بياض') || q.includes('محار') || q.includes('بؤج') || q.includes('طرطش')) {
            matchedSection = '## ' + sections.find(s => s.includes('المحارة'));
          } else if (q.includes('عزل') || q.includes('حمامات') || q.includes('سطح') || q.includes('ممبرين')) {
            matchedSection = '## ' + sections.find(s => s.includes('العزل'));
          } else if (q.includes('سباك') || q.includes('صرف') || q.includes('مياه') || q.includes('كبس') || q.includes('بار')) {
            matchedSection = '## ' + sections.find(s => s.includes('السباكة'));
          } else if (q.includes('مبان') || q.includes('طوب') || q.includes('قد')) {
            matchedSection = '## ' + sections.find(s => s.includes('المباني'));
          } else if (q.includes('سيراميك') || q.includes('بورسلين') || q.includes('رخام') || q.includes('تطبيل')) {
            matchedSection = '## ' + sections.find(s => s.includes('الأرضيات'));
          } else if (q.includes('كهرب') || q.includes('أسلاك') || q.includes('برايز') || q.includes('تأريض')) {
            matchedSection = '## ' + sections.find(s => s.includes('الكهربائية'));
          } else if (q.includes('دهان') || q.includes('معجون') || q.includes('سيلر')) {
            matchedSection = '## ' + sections.find(s => s.includes('الدهانات'));
          } else if (q.includes('ألوميتال') || q.includes('شباك') || q.includes('باب')) {
            matchedSection = '## ' + sections.find(s => s.includes('الألوميتال'));
          }
        }
      }

      return {
        success: true,
        item_searched: item_name,
        topic: topic || 'شامل (اتشك ليست، خطوات تنفيذ، معدلات استهلاك)',
        reference_found: Boolean(matchedSection),
        engineering_guidance: matchedSection || 'راجع الدليل الهندسي لبنود المقاولات المعتمد في فاي تك.',
      };
    },

    // 17. إصدار وإرسال استمارة اتشك ليست فحص هندسي رسمية PDF عبر التلجرام
    async generate_and_send_engineering_checklist_pdf({
      checklist_title,
      project_name,
      stage_name,
      inspector_name,
      contractor_name,
      items,
      chatId,
    }) {
      const title = checklist_title || 'استمارة فحص واستلام أعمال هندسية';
      const proj = project_name || 'مشروع الفلل السكنية';
      const stage = stage_name || 'أعمال تنفيذية وميدانية';
      const inspector = inspector_name || 'مهندس الموقع الفاحص';
      const contractor = contractor_name || 'مقاول التنفيذ';

      // Default standard inspection items if not passed
      let inspectionItems = Array.isArray(items) && items.length > 0 ? items : [
        { title: 'مطابقة الأبعاد والمحاور والمناسيب مع المخططات التنفيذية (Shop Drawings)', status: 'مطابق', notes: 'مطابق للمخطط المعتمد' },
        { title: 'التأكد من نظافة الموقع والعنصر تماماً من الأتربة والشوائب والمخلفات', status: 'مطابق', notes: 'تم التنظيف والغسيل' },
        { title: 'مراجعة تثبيت الدعائم والتقويات والشنابر والزراجين هندسياً', status: 'مطابق', notes: 'تقويات قوية وآمنة' },
        { title: 'فحص التفاوتات المسموح بها وميزان الرأسية والأفقية والتربيع', status: 'مطابق', notes: 'الرأسية والأفقية تامة (0 خطأ)' },
        { title: 'مطابقة أقطار وأعداد وتراكب حديد التسليح / مواسير التمديد والكفر الخرساني', status: 'مطابق', notes: 'الكفر الخرساني والتراكب محقق' },
        { title: 'اختبارات الجودة وضغوط الكبس / اختبار الهبوط Slump Test والعزل', status: 'مطابق', notes: 'ناجح في الاختبار الميداني' },
        { title: 'التأكد من سلامة المعالجة والحماية واتخاذ اشتراطات السلامة المهنية', status: 'مطابق', notes: 'جاهز للاعتماد والمرحلة التالية' },
      ];

      // توليد ملف الـ PDF عبر Puppeteer
      const pdfBuffer = await generateEngineeringChecklistPdf({
        title,
        projectName: proj,
        stageName: stage,
        inspectorName: inspector,
        contractorName: contractor,
        items: inspectionItems,
      });

      // إرسال الـ PDF عبر تليجرام
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append(
        'document',
        new Blob([pdfBuffer], { type: 'application/pdf' }),
        `استمارة_فحص_${stage.replace(/\s+/g, '_')}.pdf`
      );
      formData.append(
        'caption',
        `📋 <b>${title}</b>\n🏛️ <b>المشروع:</b> ${proj}\n👷‍♂️ <b>المهندس الفاحص:</b> ${inspector}\n📅 <b>التاريخ:</b> ${new Date().toISOString().split('T')[0]}\n\n✓ تم إصدار الاستمارة الرسمية بنجاح للاستلام الميداني والتوقيع.`
      );

      const sendRes = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendDocument`, {
        method: 'POST',
        body: formData,
      });

      const sendJson = await sendRes.json();
      if (!sendJson.ok) {
        return { success: false, error: sendJson.description || 'فشل إرسال ملف الـ PDF عبر تليجرام' };
      }

      return {
        success: true,
        title,
        project_name: proj,
        stage_name: stage,
        inspector_name: inspector,
        message: `تم إصدار وإرسال استمارة الفحص والاستلام الهندسي "${title}" بصيغة PDF بنجاح إلى المحادثة!`,
      };
    },

    // Live writes remain disabled until a scoped preview and confirmation flow exists.
    async record_site_inspection_visit() {
      return { success: false, error: 'تسجيل الزيارة من تيليجرام غير مفعّل حاليًا. استخدم شاشة المشروع في فاي تك.' };
    },
  };
}
