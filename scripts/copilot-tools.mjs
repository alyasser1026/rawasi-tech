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

      if (error || !data) {
        return {
          success: true,
          notice: 'لا توجد وثائق قاربت على الانتهاء حالياً.',
          documents: [],
        };
      }

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

      if (error || !data) {
        return {
          success: true,
          assets_count: 0,
          assets: [],
        };
      }

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
  };
}
