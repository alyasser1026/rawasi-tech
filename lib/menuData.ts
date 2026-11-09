export const menuGroups = [
    { 
        group: "الداشبورد والملخصات", 
        items: [
            { id: 'home', title: 'شاشة الترحيب والمفضلات', icon: '🏠', path: '/welcome' },
            { id: 'global_summary', title: 'الملخص العام', icon: '📊', path: '/GlobalSummary' }, 
            { id: 'dashboard', title: 'لوحة القيادة', icon: '🖥️', path: '/Dashboard' },
            { id: 'financial_center', title: 'المركز المالي', icon: '🏦', path: '/financial-center' },
            { id: 'performance', title: 'مؤشرات الأداء', icon: '🚀', path: '/performance' }
        ] 
    },
    { 
        group: "الحسابات المالية", 
        items: [
            { id: 'accounts', title: 'شجرة الحسابات', icon: '🌳', path: '/accounts' },
            { id: 'manual_journals', title: 'القيود اليدوية (تسويات)', icon: '📝', path: '/ManualJournals' },
            { id: 'journal', title: 'دفتر اليومية', icon: '📓', path: '/journal' }, 
            { id: 'ledger', title: 'دفتر الأستاذ', icon: '📒', path: '/ledger' }, 
            { id: 'journal_errors', title: 'رادار الأخطاء', icon: '🛡️', path: '/journal-errors' }, 
            { id: 'cashflows', title: 'التدفقات النقدية', icon: '🔄', path: '/cashflows' }, 
            { id: 'payments', title: 'سندات الصرف', icon: '🔴', path: '/PaymentVouchers' }, 
            { id: 'receipts', title: 'سندات القبض', icon: '🟢', path: '/ReceiptVouchers' }, 
            { id: 'revenue', title: 'الإيرادات', icon: '📈', path: '/revenue' }, 
            { id: 'expenses', title: 'المصروفات', icon: '📉', path: '/expenses' }, 
            { id: 'invoices', title: 'الفواتير ومطالبات العملاء', icon: '🧾', path: '/invoices' },
            { id: 'vat_return', title: 'إقرار ضريبة القيمة المضافة', icon: '📋', path: '/vat-return' },
            { id: 'ar_aging', title: 'أعمار الذمم والتحصيل', icon: '⏳', path: '/ar-aging' },
            { id: 'custodies', title: 'عُهد المواقع والموظفين', icon: '💼', path: '/custodies' },
            { id: 'cash_closing', title: 'إقفال الخزينة اليومي', icon: '🔒', path: '/cash-closing' },
            { id: 'fixed_assets', title: 'الأصول الثابتة والمعدات', icon: '🚜', path: '/fixed-assets' },
            { id: 'audit', title: 'الرقابة والتنبيهات وصحة البيانات', icon: '🛡️', path: '/audit' },
            { id: 'financialplan', title: 'الخطة المالية', icon: '📅', path: '/financialplan' },
            { id: 'trialbalance', title: 'ميزان المراجعة', icon: '⚖️', path: '/trialbalance' },
            { id: 'statement', title: 'كشف حساب', icon: '📄', path: '/statement' },
            { id: 'financial_statements', title: 'القوائم المالية', icon: '📑', path: '/financial-statements' }
        ] 
    },
    { 
        group: "المشاريع والشركاء", 
        items: [
            { id: 'phi_construct_website', title: 'بوابة العملاء والمقايسات (PHI CONSTRUCT)', icon: '🌐', path: '/website' },
            { id: 'fieldops', title: 'رادار الميدان الحي', icon: '📡', path: '/fieldops' },
            { id: 'bim_viewer', title: 'استعراض النماذج ثلاثية الأبعاد (3D BIM)', icon: '🏛️', path: '/bim' },
            { id: 'projects', title: 'غرفة المشاريع', icon: '🏗️', path: '/projects' }, 
            { id: 'purchase_orders', title: 'أوامر الشراء ومطابقة التوريد', icon: '🛒', path: '/purchase-orders' },
            { id: 'inventory', title: 'المخزون والجرد وكارت الصنف', icon: '📦', path: '/inventory' },
            { id: 'materials', title: 'توريد الخامات', icon: '🧱', path: '/materials' },
            { id: 'materialitems', title: 'أصناف الخامات', icon: '📦', path: '/materialitems' },
            { id: 'material_issues', title: 'صرف الخامات', icon: '📤', path: '/material_issues' },
            { id: 'subclaims', title: 'مستخلصات مقاولي الباطن', icon: '📑', path: '/subclaims' },
            { id: 'subcontractor_costs', title: 'تكاليف مقاولي الباطن', icon: '💸', path: '/subcontractor-costs' },
            { id: 'job_orders', title: 'أوامر الشغل', icon: '🛠️', path: '/joborders' },
            { id: 'laborcost', title: 'تكاليف العمالة', icon: '👷‍♂️', path: '/laborcost' },
            { id: 'boqcatalog', title: 'الدليل الموحد (BOQ)', icon: '📚', path: '/boqcatalog' },
            { id: 'partners', title: 'دليل الشركاء', icon: '🤝', path: '/partners' },
            { id: 'partner_balances', title: 'أرصدة الشركاء', icon: '⚖️', path: '/PartnerBalances' },
            { id: 'project_overhead', title: 'الأوفر هيد (Overhead)', icon: '🦅', path: '/overhead' },
            { id: 'boq_budget', title: 'ميزانية المقايسات', icon: '💼', path: '/boqbudget' },
            { id: 'bulk_budget', title: 'تعديل الموازنات الشامل', icon: '📝', path: '/boqbudget/bulk' },
            { id: 'cost_allocation', title: 'توزيع التكاليف', icon: '🧮', path: '/costallocation' },
            { id: 'project_ledger', title: 'دفتر التكاليف', icon: '📋', path: '/project-ledger' },
            { id: 'project_profitability', title: 'ربحية المشاريع ومطابقة الأستاذ', icon: '💎', path: '/profitability' }
        ] 
    },
    { 
        group: "العمالة والموارد البشرية", 
        items: [
            { id: 'team', title: 'إدارة فرق العمل', icon: '👥', path: '/team' },
            { id: 'labor_logs', title: 'يوميات الميدان', icon: '👷', path: '/labor_logs' }, 
            { id: 'attendance', title: 'حضور وانصراف الموظفين', icon: '📅', path: '/attendance' },
            { id: 'payroll', title: 'مسيرات الرواتب', icon: '💵', path: '/payroll' }, 
            { id: 'violations', title: 'المخالفات والجزاءات', icon: '⚠️', path: '/violations' }
        ] 
    },
    { 
        group: "التواصل الداخلي", 
        items: [
            { id: 'messages', title: 'الرسائل والمحادثات', icon: '💬', path: '/messages' }, 
            { id: 'notifications', title: 'مركز الإشعارات', icon: '🔔', path: '/notifications' }
        ] 
    },
    { 
        group: "النظام والتقارير", 
        items: [
            { id: 'reports', title: 'التقارير الشاملة', icon: '📊', path: '/reports' }, 
            { id: 'import', title: 'استيراد البيانات', icon: '📥', path: '/import' },
            { id: 'companies', title: 'المنشآت والشركات', icon: '🏢', path: '/settings/companies' },
            { id: 'settings', title: 'إعدادات النظام', icon: '⚙️', path: '/settings' }, 
            { id: 'profile', title: 'الملف الشخصي', icon: '👤', path: '/profile' }
        ] 
    }
];
