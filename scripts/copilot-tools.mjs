import { generateWorkerStatementPdf } from './pdf-generator.mjs';

/**
 * High-performance database query and action tools for Phi Tech Copilot
 */
export function createCopilotTools({ supabaseUrl, supabaseKey, botToken }) {
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  };

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  // Helper for REST queries
  async function fetchRest(endpoint) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
        headers,
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { error: errText, data: [] };
      }
      const data = await res.json();
      return { data, error: null };
    } catch (err) {
      return { error: err.message, data: [] };
    }
  }

  return {
    // 1. يوميات وحضور العمال
    async get_labor_daily_logs({ date, start_date, end_date, worker_name }) {
      let query = 'labor_daily_logs?select=id,work_date,worker_name,site_ref,work_item,daily_wage,attendance_value,tareeha,productivity,unit,notes&order=work_date.desc,worker_name.asc';
      
      const targetDate = (date === 'today' || date === 'النهاردة' || date === 'اليوم') ? getTodayDate() : date;
      if (targetDate) {
        query += `&work_date=eq.${targetDate}`;
      } else if (start_date && end_date) {
        query += `&work_date=gte.${start_date}&work_date=lte.${end_date}`;
      } else if (start_date) {
        query += `&work_date=gte.${start_date}`;
      } else if (end_date) {
        query += `&work_date=lte.${end_date}`;
      }

      if (worker_name) {
        query += `&worker_name=ilike.*${encodeURIComponent(worker_name)}*`;
      }

      const { data, error } = await fetchRest(query);
      if (error) return { success: false, error };

      const totalWorkers = data.length;
      const totalWages = data.reduce((s, r) => s + (Number(r.daily_wage) || 0), 0);
      const uniqueWorkers = Array.from(new Set(data.map(r => r.worker_name)));

      return {
        success: true,
        date_filter: targetDate || `${start_date || 'بداية'} إلى ${end_date || 'نهاية'}`,
        count_records: totalWorkers,
        count_unique_workers: uniqueWorkers.length,
        total_wages: totalWages,
        workers_list: uniqueWorkers,
        logs: data.slice(0, 30),
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

      if (error || !projects || projects.length === 0) {
        return { success: false, message: `لم يتم العثور على فيلا أو مشروع برقم: ${villa_identifier}` };
      }

      const proj = projects[0];

      // جلب ميزانية الفيلا من boq_budget
      const { data: budgets } = await fetchRest(
        `boq_budget?project_id=eq.${proj.id}&select=contract_quantity,actual_quantity,total_contract_amount,actual_revenue,estimated_expenses_cost,actual_expenses_cost,actual_labor_cost,actual_material_cost`
      );

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

      if (error || !villas || villas.length === 0) {
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

        if (error || !items || items.length === 0) {
          return { success: false, message: `لم يتم العثور على بند "${cleanItem}" في "${villa_identifier}"` };
        }

        const boqRecord = items[0];

        // جلب الخامات المصروفة لهذا البند أو الفيلا
        let materialsQuery = `material_issue_lines?select=item_name,quantity,unit,total_price&limit=15`;
        if (boqRecord.id) {
          materialsQuery += `&boq_id=eq.${boqRecord.id}`;
        }
        const { data: materials } = await fetchRest(materialsQuery);

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

      if (error || !allItems || allItems.length === 0) {
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

      if (error || !partners) {
        // Fallback: جلب من جدول partners مباشرة
        const { data: directPart } = await fetchRest(
          `partners?partner_type=ilike.*مقاول*&select=id,name,phone`
        );
        return {
          success: true,
          type: 'contractor_balances',
          notice: 'جاري تحديث أرصدة المستخلصات الحالية للمقاولين',
          contractors: directPart || [],
        };
      }

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
        fetchRest(`receipt_vouchers?or=(voucher_number.ilike.*${encodeURIComponent(cleanQ)}*,notes.ilike.*${encodeURIComponent(cleanQ)}*)&limit=5`),
      ]);

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
      if (error || !logs || logs.length === 0) {
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

      const sendRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
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
  };
}
