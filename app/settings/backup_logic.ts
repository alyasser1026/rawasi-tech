"use client";
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { fetchAllSupabaseData } from '@/lib/helpers';
import { useToast } from '@/lib/toast-context'; 

// 🗺️ خريطة حقول الجداول (الأسماء الإنجليزية المطابقة للداتابيز بالضبط)
export const TABLE_SCHEMAS: Record<string, string[]> = {
  "accounts": ["id", "code", "name", "account_type", "parent_id", "is_transactional", "created_at"],
  "all_emp": ["emp_id", "emp_name", "job_title", "iqama_num", "Salary", "phone_number", "work_days", "housing", "deductions", "expire_date", "earnings", "net_earnings", "received"],
  "boq_budget": ["id", "project_id", "parent_id", "item_type", "work_item", "contract_quantity", "unit", "unit_contract_price", "estimated_labor_cost", "estimated_operational_cost", "main_category", "sub_category", "estimated_expenses_cost"],
  "boq_items": ["id", "item_code", "main_category", "sub_category", "item_name", "unit_of_measure", "created_at"],
  "contractor_assignments": ["id", "contractor_id", "project_id", "boq_item_id", "assigned_qty", "unit_price", "status"],
  "expenses": ["id", "exp_date", "sub_contractor", "payee_id", "creditor_account", "description", "quantity", "unit_price", "vat_amount", "discount_amount", "discount_account", "paid_amount", "payment_method", "payment_account", "notes", "is_posted", "created_at", "site_ref", "payee_name", "project_id", "employee_name", "invoice_image", "lines_data", "is_deducted_in_claim", "claim_id", "is_auto_distributed", "total_price", "main_category"],
  "inventory": ["id", "item_name", "unit", "current_stock", "avg_price"],
  "invoices": ["id", "invoice_number", "date", "partner_id", "client_name", "project_ids", "description", "materials_discount", "taxable_amount", "tax_amount", "guarantee_percent", "guarantee_amount", "total_amount", "debit_account_id", "credit_account_id", "materials_acc_id", "guarantee_acc_id", "tax_acc_id", "skip_zatca", "status", "created_at", "due_in_days", "due_date", "paid_amount", "lines_data"],
  "job_orders": ["id", "order_number", "project_id", "boq_budget_id", "executor_type", "contractor_id", "assigned_qty", "unit_price", "status", "start_date", "end_date", "notes", "created_at"],
  "journal_errors": ["id", "error_type", "description", "is_fixed", "created_at"],
  "journal_headers": ["id", "entry_date", "description", "created_at", "status", "reference_id", "v_type"],
  "journal_lines": ["id", "header_id", "account_id", "partner_id", "item_name", "quantity", "unit_price", "debit", "credit", "notes", "project_id", "debit_account_id", "tax_amount", "tax_rate", "created_at"],
  "labor_daily_logs": ["id", "work_date", "worker_name", "site_ref", "work_item", "production_desc", "unit", "skill_level", "daily_wage", "attendance_value", "sub_contractor", "notes", "project_id", "created_at", "worker_partner_id", "sub_contractor_id", "is_posted", "work_item_id", "tareeha", "productivity", "completion_percentage", "credit_account_id", "debit_account_id"],
  "material_issue_lines": ["id", "issue_id", "item_name", "quantity", "unit", "unit_price", "total_price", "boq_id", "boq_item_id", "item_id", "job_order_id", "is_deducted_from_contractor", "claim_id"],
  "material_issues": ["id", "issue_number", "project_id", "subcontractor_id", "issue_date", "issue_type", "total_amount", "notes", "jv_id", "is_posted", "created_at", "claim_id", "contractor_text_name"],
  "material_receipt_lines": ["id", "receipt_id", "item_name", "quantity", "unit", "unit_price", "total_price", "boq_id", "created_at"],
  "material_receipts": ["id", "receipt_number", "project_id", "supplier_id", "account_id", "receipt_date", "total_amount", "status", "attachments", "is_posted", "notes", "created_by", "created_at"],
  "notifications": ["id", "user_id", "type", "message", "is_read", "created_at"],
  "partners": ["id", "code", "name", "partner_type", "identity_number", "identity_expiry_date", "identity_image_url", "phone", "address", "vat_number", "created_at", "job_role", "account_id"],
  "payment_vouchers": ["id", "voucher_number", "date", "amount", "partner_id", "credit_account_id", "payment_method", "reference_no", "description", "notes", "status", "is_posted", "created_at", "updated_at", "created_by", "debit_account_id"],
  "payroll_slips": ["id", "emp_id", "month", "basic_salary", "total_advances", "total_deductions", "net_salary", "is_posted", "created_at"],
  "profiles": ["id", "username", "role", "permissions", "signature_url", "linked_partner_id", "avatar_url", "nickname", "phone_number", "full_name", "email", "created_at", "is_admin"],
  "project_stages": ["id", "project_id", "stage_name", "progress_percentage", "status", "created_at"],
  "project_work_structure": ["id", "project_id", "technical_item", "stage_name", "status", "created_at"],
  "projects": ["id", "project_code", "Property", "client_name", "contract_value", "estimated_budget", "down_payment", "start_date", "end_date", "actual_completion_date", "location_address", "location_url", "project_manager", "status", "notes", "created_at", "project_name", "client_id", "current_stage"],
  "receipt_vouchers": ["id", "date", "amount", "payment_method", "notes", "partner_id", "invoice_id", "created_at", "updated_at", "receipt_number", "status", "safe_bank_acc_id", "partner_acc_id", "project_ids", "reference_number", "attachment_url"],
  "sub_claims": ["id", "claim_number", "contractor_id", "project_id", "date", "total_amount", "retention_amount", "net_amount", "status", "is_posted", "created_at", "jv_header_id", "deductions_amount", "advance_payment", "materials_deduction", "other_deductions", "jv_id", "paid_amount", "payment_period_days", "job_order_id", "project_ids", "project_names_text"],
  "sys_financial_reports": ["report_name", "report_data", "updated_at"],
  "system_settings": ["id", "theme_config", "privacy_settings", "notifications", "updated_at"],
  "user_requests": ["id", "user_id", "type", "category", "subject", "details", "status", "admin_note", "created_at"],
  "user_tasks": ["id", "user_id", "title", "description", "status", "priority", "created_at"],
  "violations": ["id", "date", "partner_id", "emp_name", "profession", "project_id", "site_name", "reason", "amount", "image_url", "is_posted", "created_at"]
};

export const useBackupLogic = () => {
    const { showToast } = useToast();
    
    // 🟢 تصدير لإكسيل (بيانات حقيقية)
    // 🟢 تصدير لإكسيل (بيانات حقيقية) مع معالجة حقول الـ JSONB
    const backupToExcel = async (selectedTables: string[]) => {
        try {
            showToast('جاري تجميع البيانات وتحضير ملف الإكسل...', 'info');
            const workbook = XLSX.utils.book_new();
            
            for (const table of selectedTables) {
                let data = await fetchAllSupabaseData(supabase, table);
                
                if (data && data.length > 0) {
                    // 🚀 المعالجة السحرية: تحويل الـ JSON إلى نص مقروء قبل التصدير
                    const processedData = data.map(row => {
                        const newRow = { ...row };
                        // المرور على كل خلايا الصف
                        for (const key in newRow) {
                            if (newRow[key] && typeof newRow[key] === 'object') {
                                // لو الخلية دي عبارة عن JSONB (زي lines_data)
                                try {
                                    if (Array.isArray(newRow[key])) {
                                        // لو كانت مصفوفة (زي سطور الفواتير أو المصروفات)
                                        // بنجمع البيانات المهمة منها في نص واحد بين كل سطر وسطر علامة ( | )
                                        newRow[key] = newRow[key].map((item: any) => {
                                            if (typeof item === 'object') {
                                                // تجميع القيم اللي جوه الاوبجيكت (مثلاً: البند: كذا - الكمية: كذا)
                                                return Object.entries(item)
                                                    .filter(([k, v]) => v !== null && v !== '')
                                                    .map(([k, v]) => `${k}: ${v}`)
                                                    .join(', ');
                                            }
                                            return String(item);
                                        }).join('  ||  ');
                                    } else {
                                        // لو كانت كائن عادي (Object)
                                        newRow[key] = JSON.stringify(newRow[key]);
                                    }
                                } catch (e) {
                                    newRow[key] = String(newRow[key]);
                                }
                            }
                        }
                        return newRow;
                    });

                    const worksheet = XLSX.utils.json_to_sheet(processedData);
                    XLSX.utils.book_append_sheet(workbook, worksheet, table);
                } else {
                    const headers = TABLE_SCHEMAS[table] || ['id'];
                    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
                    XLSX.utils.book_append_sheet(workbook, worksheet, table);
                }
            }
            
            XLSX.writeFile(workbook, `Phi_Tech_Backup_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast('تم تصدير نسخة الإكسل بنجاح', 'success');
            return { success: true };
        } catch (error: any) {
            console.error("Excel Backup Error:", error);
            showToast(`فشل تصدير الإكسل: ${error.message}`, 'error');
            return { success: false };
        }
    };

    // 🔵 تصدير لـ JSON
    const backupToJSON = async (selectedTables: string[]) => {
        try {
            showToast('جاري تحضير ملف JSON...', 'info');
            const fullSnapshot: any = { metadata: { date: new Date().toISOString() }, data: {} };
            
            for (const table of selectedTables) {
                const data = await fetchAllSupabaseData(supabase, table);
                fullSnapshot.data[table] = data;
            }
            
            const blob = new Blob([JSON.stringify(fullSnapshot, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Phi_Tech_Snapshot_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
            
            showToast('تم تصدير نسخة JSON بنجاح', 'success');
            return { success: true };
        } catch (error: any) {
            console.error("JSON Backup Error:", error);
            showToast(`فشل تصدير JSON: ${error.message}`, 'error');
            return { success: false };
        }
    };

    // 📄 تحميل نموذج فارغ (Template) - يدعم الإدخال الذكي والتطابق مع الداتابيز
    const downloadTemplate = (tableName: string, displayName: string) => {
        try {
            showToast(`جاري تحضير قالب ${displayName}...`, 'info');
            let templateData: any[] = [];
            let wscols: any[] = [];

            // 🌟 1. القوالب المخصصة (أسماء العواميد بالإنجليزي، والشرح بالعربي لتسهيل الرفع)
            // 🌟 داخل دالة downloadTemplate في ملف backup_logic.ts
            if (tableName === 'payment_vouchers') {
                templateData = [{
                    'التاريخ': new Date().toISOString().split('T')[0],
                    'المبلغ': 5000,
                    'طريقة الدفع': 'تحويل بنكي',
                    'البيان': 'اكتب وصف السند هنا',
                    'ملاحظات': 'أي ملاحظات إضافية (اختياري)',
                    'حساب المدين (debit_account_id)': 'ضع معرف UUID لحساب المصروف/المورد',
                    'حساب الدائن (credit_account_id)': 'ضع معرف UUID لحساب الخزينة/البنك',
                    // 👇 التعديل هنا: طلبنا الاسم صراحة بدل الـ ID
                    'اسم المستفيد': 'اكتب اسم العامل أو المورد هنا (مطابق لدليل الشركاء)'
                }];
                wscols = [
                    { wch: 15 }, // التاريخ
                    { wch: 15 }, // المبلغ
                    { wch: 15 }, // طريقة الدفع
                    { wch: 40 }, // البيان
                    { wch: 30 }, // ملاحظات
                    { wch: 40 }, // حساب المدين
                    { wch: 40 }, // حساب الدائن
                    { wch: 40 }  // المستفيد
                ];
            }

            // 🟢 القالب المخصص لاستلام الخامات
            else if (tableName === 'material_receipt_lines') {
                 templateData = [{
                    'اسم المادة / الصنف': 'أسمنت بورتلاندي',
                    'اسم العقار / المشروع': 'فيلا 15 (سيقوم النظام بتحويله لـ ID تلقائياً)', // 🚀 العمود الجديد
                    'الكمية': 100,
                    'الوحدة': 'طن',
                    'سعر الوحدة': 250,
                    'الإجمالي': 25000,
                    'رقم السند (receipt_id)': ''
                 }];
                 wscols = [
                     { wch: 35 }, // اسم المادة
                     { wch: 30 }, // اسم العقار
                     { wch: 15 }, // الكمية
                     { wch: 15 }, // الوحدة
                     { wch: 15 }, // سعر الوحدة
                     { wch: 20 }, // الإجمالي
                     { wch: 25 }  // رقم السند
                 ];
            }

            else if (tableName === 'labor_daily_logs') {
     templateData = [{
        'work_date': new Date().toISOString().split('T')[0], // التاريخ
        'worker_name': 'اكتب اسم العامل هنا (مطابق لدليل الشركاء)',
        'site_ref': 'اسم العقار أو المشروع الحالي',
        'work_item': 'بند الأعمال (مثل: لياسة / حدادة)',
        'production_desc': 'وصف العمل المنجز تفصيلياً',
        'unit': 'م2', // الوحدة المفقودة
        'productivity': '25.5', // الإنتاجية المفقودة
        'tareeha': 'طريحة اليوم', // الطريحة المفقودة
        'completion_percentage': 100, // نسبة الإنجاز
        'daily_wage': 150, // اليومية
        'attendance_value': 1, // الحضور (1 = يوم كامل)
        'sub_contractor': 'اكتب اسم المقاول أو "المركز الرئيسي"',
        'notes': 'أي ملاحظات فنية'
     }];
     // ضبط عرض الأعمدة ليكون مريحاً للعين في الإكسيل
     wscols = [
       { wch: 15 }, { wch: 30 }, { wch: 25 }, { wch: 25 }, { wch: 40 }, 
       { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, 
       { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 30 }
     ];
}
else if (tableName === 'expenses') {
    templateData = [{
        'التصنيف الرئيسي': 'إعاشة وتغذية', // الخانة الجديدة 📁
        'تاريخ المصروف': new Date().toISOString().split('T')[0],
        'المقاول / المورد': 'اكتب اسم المقاول هنا',
        'اسم المستفيد': 'اكتب اسم المستفيد النهائي',
        'حساب المصروف (المدين)': 'مثال: 3101 - أدوات مكتبية',
        'حساب السداد (الدائن)': 'مثال: 1101 - الصندوق الرئيسي',
        'البيان': 'وصف المصروف بالتفصيل',
        'الكمية': 1,
        'سعر الوحدة': 100,
        'ضريبة القيمة المضافة': 15,
        'مبلغ الخصم': 0,
        'طريقة الدفع': 'كاش',
        'الموقع / المشروع': 'اسم العقار أو المشروع',
        'اسم الموظف': 'الموظف المسؤول',
        'ملاحظات': 'أي ملاحظات إضافية'
    }];
    
    // تم تحديث عرض الأعمدة ليتناسب مع الإضافة الجديدة
    wscols = [
        { wch: 20 }, // التصنيف الرئيسي
        { wch: 15 }, // تاريخ المصروف
        { wch: 25 }, // المقاول / المورد
        { wch: 25 }, // اسم المستفيد
        { wch: 30 }, // حساب المصروف
        { wch: 30 }, // حساب السداد
        { wch: 40 }, // البيان
        { wch: 10 }, // الكمية
        { wch: 12 }, // سعر الوحدة
        { wch: 15 }, // الضريبة
        { wch: 12 }, // الخصم
        { wch: 15 }, // طريقة الدفع
        { wch: 25 }, // الموقع / المشروع
        { wch: 20 }, // اسم الموظف
        { wch: 30 }  // ملاحظات
    ];
}
            // 🟢 تغيير اسم الجدول هنا ليكون violations
            else if (tableName === 'violations') {
                 templateData = [{
                    'date': new Date().toISOString().split('T')[0],
                    'emp_name': 'اكتب اسم العامل المخالف',
                    'profession': 'مثال: نجار / حداد',
                    'site_name': 'موقع العمل',
                    'reason': 'عدم ارتداء معدات السلامة',
                    'amount': 500,
                    'partner_id': 'يرجى وضع معرف الـ UUID للعامل هنا'
                 }];
                 wscols = [{ wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 40 }];
            } 
            // 🌟 2. القوالب الافتراضية لباقي الجداول (مجهزة بأعمدة الداتابيز مباشرة)
            else {
                const headers = TABLE_SCHEMAS[tableName];
                if (!headers) throw new Error("لم يتم العثور على خريطة حقول لهذا الجدول.");
                
                const emptyObj: any = {};
                headers.forEach(key => emptyObj[key] = '');
                templateData = [emptyObj];
            }

            // إنشاء ملف الإكسل وتصديره
            const worksheet = XLSX.utils.json_to_sheet(templateData);
            if (wscols.length > 0) worksheet['!cols'] = wscols;

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, tableName); 
            XLSX.writeFile(workbook, `Template_${tableName}.xlsx`);
            
            showToast(`تم تحميل قالب ${displayName} بنجاح`, 'success');
        } catch (error: any) {
            showToast(`فشل تحميل القالب: ${error.message}`, 'error');
        }
    };
    
    

    return { backupToExcel, backupToJSON, downloadTemplate };
};