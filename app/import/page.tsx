"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import MasterPage from '@/components/MasterPage';
import GlassContainer from '@/components/GlassContainer';
import { useToast } from '@/lib/toast-context';
import { THEME } from '@/lib/theme';

export default function UnifiedImportHub() {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('labor');
    const [isLoading, setIsLoading] = useState(false);
    const [mappings, setMappings] = useState<any>({ partners: [], projects: [], boq: [] });
    
    const [parsedData, setParsedData] = useState<any>({ labor: [], expenses: [], violations: [], vouchers: [] });
    const [hasErrors, setHasErrors] = useState(false);
    const [isParsed, setIsParsed] = useState(false);

    // Removed useEffect to prevent heavy fetching on page load

    // 2. Download Master Template
    const downloadMasterTemplate = () => {
        try {
            const workbook = XLSX.utils.book_new();

            const laborData = [{
                'التاريخ': new Date().toISOString().split('T')[0],
                'اسم العامل': 'اكتب اسم العامل هنا',
                'الفيلا': 'اسم الفيلا',
                'البند': 'اسم البند',
                'الوصف': 'تفاصيل العمل',
                'الوحدة': 'م2',
                'الإنتاجية': 25.5,
                'الطريحة': 20,
                'اليومية': 150,
                'الحضور': 1,
                'المقاول': 'المركز الرئيسي',
                'ملاحظات': ''
            }];
            const wsLabor = XLSX.utils.json_to_sheet(laborData);
            wsLabor['!cols'] = [{wch:15}, {wch:30}, {wch:20}, {wch:25}, {wch:40}, {wch:10}, {wch:10}, {wch:15}, {wch:10}, {wch:10}, {wch:20}, {wch:30}];
            XLSX.utils.book_append_sheet(workbook, wsLabor, 'يومية العمالة');

            const expensesData = [{
                'التاريخ': new Date().toISOString().split('T')[0],
                'المقاول / المورد': 'اسم المقاول',
                'اسم المستفيد': 'المستفيد النهائي',
                'حساب المصروف': 'مثال: أدوات مكتبية',
                'البيان': 'وصف المصروف',
                'الفيلا': 'اسم الفيلا',
                'الكمية': 1,
                'السعر': 100,
                'الضريبة': 15,
                'الخصم': 0,
                'التصنيف': 'إعاشة وتغذية',
                'ملاحظات': ''
            }];
            const wsExpenses = XLSX.utils.json_to_sheet(expensesData);
            wsExpenses['!cols'] = [{wch:15}, {wch:25}, {wch:25}, {wch:25}, {wch:40}, {wch:20}, {wch:10}, {wch:10}, {wch:10}, {wch:10}, {wch:15}, {wch:30}];
            XLSX.utils.book_append_sheet(workbook, wsExpenses, 'المصروفات');

            const violationsData = [{
                'التاريخ': new Date().toISOString().split('T')[0],
                'اسم العامل': 'اسم العامل المخالف',
                'الفيلا': 'اسم الفيلا',
                'المهنة': 'نجار',
                'السبب': 'عدم ارتداء معدات السلامة',
                'المبلغ': 500
            }];
            const wsViolations = XLSX.utils.json_to_sheet(violationsData);
            wsViolations['!cols'] = [{wch:15}, {wch:30}, {wch:20}, {wch:15}, {wch:40}, {wch:15}];
            XLSX.utils.book_append_sheet(workbook, wsViolations, 'الخصومات والحسميات');

            const vouchersData = [{
                'التاريخ': new Date().toISOString().split('T')[0],
                'المبلغ': 5000,
                'اسم المستفيد': 'اسم العامل أو المورد',
                'الفيلا': 'اسم الفيلا',
                'البيان': 'اكتب وصف السند هنا',
                'طريقة الدفع': 'كاش',
                'ملاحظات': ''
            }];
            const wsVouchers = XLSX.utils.json_to_sheet(vouchersData);
            wsVouchers['!cols'] = [{wch:15}, {wch:15}, {wch:30}, {wch:20}, {wch:40}, {wch:15}, {wch:30}];
            XLSX.utils.book_append_sheet(workbook, wsVouchers, 'سندات الصرف');

            XLSX.writeFile(workbook, `Rawasi_Master_Template_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast("تم تحميل القالب الشامل بنجاح", "success");
        } catch (e: any) {
            showToast("فشل تحميل القالب: " + e.message, "error");
        }
    };

    // 3. Upload & Validate
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });

            const getSheetData = (name: string) => {
                const sheet = workbook.Sheets[name];
                return sheet ? XLSX.utils.sheet_to_json(sheet) : [];
            };

            const rawLabor = getSheetData('يومية العمالة');
            const rawExpenses = getSheetData('المصروفات');
            const rawViolations = getSheetData('الخصومات والحسميات');
            const rawVouchers = getSheetData('سندات الصرف');

            // --- ⚡ Fast Loading Optimization ⚡ ---
            showToast("جاري مطابقة الأسماء والبنود مع قاعدة البيانات...", "info");
            
            const safeTrim = (str: any) => typeof str === 'string' ? str.trim() : str;
            // Robust normalizers
            const normalizeVilla = (str: any) => typeof str === 'string' ? str.replace(/\s+/g, '').replace('أ', 'ا').replace('إ', 'ا').replace('ة', 'ه') : str;
            const normalizeText = (str: any) => typeof str === 'string' ? str.replace(/\s+/g, ' ').replace('أ', 'ا').replace('إ', 'ا').replace('ة', 'ه').trim() : str;

            // Extract unique values from Excel to only fetch what we need
            const uniqueWorkers = Array.from(new Set([
                ...rawLabor.map((r:any) => safeTrim(r['اسم العامل'])),
                ...rawExpenses.map((r:any) => safeTrim(r['اسم المستفيد'])),
                ...rawViolations.map((r:any) => safeTrim(r['اسم العامل'])),
                ...rawVouchers.map((r:any) => safeTrim(r['اسم المستفيد'] || r['اسم العامل أو المورد']))
            ])).filter(n => n && n !== 'اكتب اسم العامل هنا' && n !== 'المستفيد النهائي' && n !== 'اسم العامل أو المورد');

            const uniqueProjects = Array.from(new Set([
                ...rawLabor.map((r:any) => safeTrim(r['الفيلا'])),
                ...rawExpenses.map((r:any) => safeTrim(r['الفيلا'])),
                ...rawViolations.map((r:any) => safeTrim(r['الفيلا'])),
                ...rawVouchers.map((r:any) => safeTrim(r['الفيلا']))
            ])).filter(p => p && p !== 'اسم الفيلا');

            const uniqueItems = Array.from(new Set([
                ...rawLabor.map((r:any) => safeTrim(r['البند']))
            ])).filter(i => i && i !== 'اسم البند');

            // Fetch only matched names
            const [partRes, projRes, boqRes] = await Promise.all([
                uniqueWorkers.length > 0 ? supabase.from('partners').select('id, name').in('name', uniqueWorkers) : { data: [] },
                // Fetching all projects is usually lightweight anyway, but let's fetch all to avoid complex OR logic with Property and project_name
                supabase.from('projects').select('id, project_name, "Property"'),
                uniqueItems.length > 0 ? supabase.from('boq_budget_distinct').select('id, project_id, work_item, "Property", display_name').in('work_item', uniqueItems) : { data: [] }
            ]);

            const currentMappings = {
                partners: partRes.data || [],
                projects: projRes.data || [],
                boq: boqRes.data || []
            };

            const normalizeDate = (d: any) => {
                if (!d) return d;
                if (typeof d === 'number') {
                    // Convert Excel serial date
                    const jsDate = new Date((d - 25569) * 86400 * 1000);
                    return jsDate.toISOString().split('T')[0];
                }
                if (typeof d === 'string') {
                    let s = d.trim().replace(/\//g, '-');
                    const parts = s.split('-');
                    if (parts.length === 3) {
                        if (parts[2].length === 4) { // DD-MM-YYYY
                            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                        } else if (parts[0].length === 4) { // YYYY-MM-DD
                            return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                        }
                    }
                    const dt = new Date(s);
                    if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
                }
                return d;
            };

            let anyError = false;

            // Validator helper
            const validateRow = (row: any, type: string) => {
                const errs: string[] = [];
                const fixes: any[] = [];
                let wId = null, pId = null, bId = null;

                const origDate = row['التاريخ'];
                const nDate = normalizeDate(origDate);
                if (nDate) {
                    if (nDate !== origDate) {
                        row['التاريخ'] = nDate;
                        fixes.push({ col: 'التاريخ', msg: 'تنسيق التاريخ' });
                    }
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(nDate)) {
                        errs.push('صيغة التاريخ غير صحيحة');
                    }
                } else {
                    errs.push('التاريخ مطلوب');
                }

                const origWorker = row['اسم العامل'] || row['اسم المستفيد'];
                const workerName = safeTrim(origWorker);
                if (workerName && workerName !== 'اكتب اسم العامل هنا' && workerName !== 'المستفيد النهائي') {
                    const worker = currentMappings.partners.find((p: any) => safeTrim(p.name) === workerName);
                    if (worker) {
                        wId = worker.id;
                        if (origWorker !== worker.name) {
                            if (row['اسم العامل'] !== undefined) row['اسم العامل'] = worker.name;
                            if (row['اسم المستفيد'] !== undefined) row['اسم المستفيد'] = worker.name;
                            fixes.push({ col: row['اسم العامل'] !== undefined ? 'اسم العامل' : 'اسم المستفيد', msg: 'تعديل مسافة زائدة' });
                        }
                    } else errs.push('الاسم غير مسجل بدليل الشركاء');
                }

                const origVilla = row['الفيلا'];
                const villaName = normalizeVilla(origVilla);
                if (villaName && villaName !== normalizeVilla('اسم الفيلا')) {
                    const proj = currentMappings.projects.find((p: any) => normalizeVilla(p.Property) === villaName || normalizeVilla(p.project_name) === villaName);
                    if (proj) {
                        pId = proj.id;
                        const correctName = (normalizeVilla(proj.Property) === villaName) ? proj.Property : proj.project_name;
                        if (origVilla !== correctName) {
                            row['الفيلا'] = correctName;
                            fixes.push({ col: 'الفيلا', msg: 'توحيد الاسم' });
                        }
                    } else errs.push('الفيلا غير مسجلة بالمشاريع');
                }

                const origItem = row['البند'];
                const itemName = safeTrim(origItem);
                if (type === 'labor' && pId && itemName && itemName !== 'اسم البند') {
                    const item = currentMappings.boq.find((b: any) => String(b.project_id) === String(pId) && safeTrim(b.work_item) === itemName);
                    if (item) {
                        bId = item.id;
                        if (origItem !== item.work_item) {
                            row['البند'] = item.work_item;
                            fixes.push({ col: 'البند', msg: 'تعديل مسافة زائدة' });
                        }
                    } else errs.push('البند غير مربوط بموازنة هذه الفيلا');
                }

                if (errs.length > 0) anyError = true;
                return { ...row, _errors: errs, _fixes: fixes, _mapped: { partner_id: wId, project_id: pId, boq_id: bId } };
            };

            setParsedData({
                labor: rawLabor.filter((r:any) => r['اسم العامل'] !== 'اكتب اسم العامل هنا').map((r: any) => validateRow(r, 'labor')),
                expenses: rawExpenses.filter((r:any) => r['المقاول / المورد'] !== 'اسم المقاول').map((r: any) => validateRow(r, 'expenses')),
                violations: rawViolations.filter((r:any) => r['اسم العامل'] !== 'اسم العامل المخالف').map((r: any) => validateRow(r, 'violations')),
                vouchers: rawVouchers.filter((r:any) => r['المبلغ'] !== 5000 && r['طريقة الدفع'] !== 'كاش').map((r: any) => validateRow(r, 'vouchers')),
            });

            setHasErrors(anyError);
            setIsParsed(true);
            showToast(anyError ? "يوجد أخطاء في البيانات، يرجى مراجعتها" : "تم فحص البيانات بنجاح، جاهزة للترحيل", anyError ? "warning" : "success");

        } catch (err: any) {
            showToast("خطأ في قراءة الملف: " + err.message, "error");
        } finally {
            setIsLoading(false);
            if (e.target) e.target.value = ''; 
        }
    };

    // 4. Final Insert to DB
    const handleConfirmUpload = async () => {
        if (hasErrors) return showToast("لا يمكن الترحيل بوجود أخطاء! يرجى تصحيح الإكسيل وإعادة الرفع.", "error");
        setIsLoading(true);
        try {
            const laborPayload = parsedData.labor.map((r:any) => ({
                work_date: r['التاريخ'], worker_name: r['اسم العامل'], worker_partner_id: r._mapped.partner_id,
                project_id: r._mapped.project_id, site_ref: r['الفيلا'], work_item: r['البند'], work_item_id: r._mapped.boq_id,
                production_desc: r['الوصف'], unit: r['الوحدة'], productivity: parseFloat(r['الإنتاجية']) || null, tareeha: parseFloat(r['الطريحة']) || null,
                daily_wage: parseFloat(r['اليومية']) || 0, attendance_value: parseFloat(r['الحضور']) || 1, sub_contractor: r['المقاول'], notes: r['ملاحظات'],
                is_posted: true
            }));

            const expensesPayload = parsedData.expenses.map((r:any) => ({
                exp_date: r['التاريخ'], payee_name: r['اسم المستفيد'], payee_id: r._mapped.partner_id,
                project_id: r._mapped.project_id, site_ref: r['الفيلا'], sub_contractor: r['المقاول / المورد'],
                description: r['البيان'], quantity: r['الكمية'], unit_price: r['السعر'], vat_amount: r['الضريبة'],
                discount_amount: r['الخصم'], main_category: r['التصنيف'], notes: r['ملاحظات'], payment_method: 'آجل',
                is_posted: false
            }));

            const violationsPayload = parsedData.violations.map((r:any) => ({
                date: r['التاريخ'], emp_name: r['اسم العامل'], partner_id: r._mapped.partner_id,
                project_id: r._mapped.project_id, site_name: r['الفيلا'], profession: r['المهنة'],
                reason: r['السبب'], amount: r['المبلغ'], is_posted: true
            }));

            const vouchersPayload = parsedData.vouchers.map((r:any) => ({
                date: r['التاريخ'], amount: r['المبلغ'], partner_id: r._mapped.partner_id,
                site_ref: r['الفيلا'], description: r['البيان'], payment_method: r['طريقة الدفع'], notes: r['ملاحظات'],
                is_posted: false, voucher_number: `PV-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*1000)}`
            }));

            if (laborPayload.length > 0) { const {error} = await supabase.from('labor_daily_logs').insert(laborPayload); if(error) throw error; }
            if (expensesPayload.length > 0) { const {error} = await supabase.from('expenses').insert(expensesPayload); if(error) throw error; }
            if (violationsPayload.length > 0) { const {error} = await supabase.from('violations').insert(violationsPayload); if(error) throw error; }
            if (vouchersPayload.length > 0) { const {error} = await supabase.from('payment_vouchers').insert(vouchersPayload); if(error) throw error; }

            showToast("🎉 تم ترحيل كافة البيانات بنجاح!", "success");
            setParsedData({ labor: [], expenses: [], violations: [], vouchers: [] });
            setIsParsed(false);

        } catch (err: any) {
            showToast("فشل ترحيل البيانات: " + err.message, "error");
        } finally {
            setIsLoading(false);
        }
    };

    // Render Table Helper
    const renderTable = (data: any[]) => {
        if (data.length === 0) return <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontWeight: 900 }}>لا توجد بيانات مسحوبة في هذا القسم</div>;
        
        const keys = Object.keys(data[0]).filter(k => !k.startsWith('_'));
        
        return (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', color: '#475569' }}>
                            <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', width: '30px' }}>حالة</th>
                            {keys.map(k => <th key={k} style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>{k}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, i) => (
                            <tr key={i} style={{ background: row._errors?.length > 0 ? '#fef2f2' : (row._fixes?.length > 0 ? '#f0fdf4' : 'white'), borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '12px' }}>
                                    {row._errors?.length > 0 
                                        ? <span title={row._errors.join(' | ')} style={{ cursor: 'help', fontSize: '16px' }}>❌</span> 
                                        : (row._fixes?.length > 0 ? <span title="تم التصحيح آلياً" style={{ cursor: 'help', fontSize: '16px' }}>🔧</span> : <span style={{ fontSize: '16px' }}>✅</span>)}
                                </td>
                                {keys.map(k => {
                                    const fix = row._fixes?.find((f:any) => f.col === k);
                                    return (
                                    <td key={k} style={{ padding: '12px', color: row._errors?.length > 0 ? '#991b1b' : (fix ? '#166534' : '#334155') }}>
                                        {row[k]}
                                        {row._errors?.length > 0 && (k === 'اسم العامل' || k === 'الفيلا' || k === 'البند' || k === 'اسم المستفيد') && (
                                            <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 'bold', marginTop: '4px' }}>
                                                {row._errors.find((e:string) => e.includes(k.split(' ')[1] || k))}
                                            </div>
                                        )}
                                        {fix && (
                                            <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 'bold', marginTop: '4px' }}>
                                                ✨ {fix.msg}
                                            </div>
                                        )}
                                    </td>
                                )})}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <MasterPage title="مركز استيراد البيانات" subtitle="استيراد الإكسيل الموحد مع المراجعة الذكية" icon="📥">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 3fr)', gap: '20px', padding: '20px 0' }}>
                
                {/* Sidebar Controls */}
                <GlassContainer>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>📊</div>
                        <h2 style={{ margin: 0, color: THEME.primary, fontWeight: 900 }}>الاستيراد الشامل</h2>
                        <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, marginTop: '5px' }}>
                            حمل القالب، املأ البيانات، ارفعه هنا.
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <button onClick={downloadMasterTemplate} className="btn-action primary">
                            📥 تحميل القالب الموحد (Excel)
                        </button>

                        <label className={`upload-dropzone ${isLoading ? 'loading' : ''}`}>
                            <input type="file" accept=".xlsx" onChange={handleFileUpload} disabled={isLoading} style={{ display: 'none' }} />
                            <span>{isLoading ? '⏳ جاري القراءة والفحص...' : '📂 اختر ملف الإكسيل المعبأ'}</span>
                        </label>

                        {isParsed && (
                            <button 
                                onClick={handleConfirmUpload} 
                                className={`btn-action ${hasErrors ? 'disabled' : 'success'}`}
                                disabled={hasErrors || isLoading}
                            >
                                {hasErrors ? '❌ صحح الأخطاء أولاً' : '🚀 ترحيل البيانات للنظام'}
                            </button>
                        )}
                    </div>
                </GlassContainer>

                {/* Main Preview Area */}
                <GlassContainer>
                    {isParsed ? (
                        <div>
                            <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px', marginBottom: '20px', overflowX: 'auto' }}>
                                <button className={`tab-btn ${activeTab === 'labor' ? 'active' : ''}`} onClick={() => setActiveTab('labor')}>
                                    👷‍♂️ يومية العمالة ({parsedData.labor.length})
                                </button>
                                <button className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')}>
                                    💸 المصروفات ({parsedData.expenses.length})
                                </button>
                                <button className={`tab-btn ${activeTab === 'violations' ? 'active' : ''}`} onClick={() => setActiveTab('violations')}>
                                    ⚠️ الخصومات ({parsedData.violations.length})
                                </button>
                                <button className={`tab-btn ${activeTab === 'vouchers' ? 'active' : ''}`} onClick={() => setActiveTab('vouchers')}>
                                    📜 سندات الصرف ({parsedData.vouchers.length})
                                </button>
                            </div>

                            {hasErrors && (
                                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '15px', borderRadius: '12px', marginBottom: '20px', color: '#991b1b', fontSize: '13px', fontWeight: 900 }}>
                                    يوجد أخطاء في بعض السطور مضللة باللون الأحمر. يرجى التأكد من مطابقة الأسماء والفلل والبنود مع المسجل في النظام.
                                </div>
                            )}

                            {activeTab === 'labor' && renderTable(parsedData.labor)}
                            {activeTab === 'expenses' && renderTable(parsedData.expenses)}
                            {activeTab === 'violations' && renderTable(parsedData.violations)}
                            {activeTab === 'vouchers' && renderTable(parsedData.vouchers)}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', textAlign: 'center' }}>
                            <div style={{ fontSize: '50px', marginBottom: '15px', opacity: 0.5 }}>📝</div>
                            <h3 style={{ margin: 0, fontWeight: 900 }}>شاشة المعاينة الذكية</h3>
                            <p style={{ fontSize: '13px', fontWeight: 700, maxWidth: '300px', marginTop: '10px' }}>
                                قم برفع الملف لتظهر البيانات هنا ويتم مراجعتها آلياً ومطابقتها مع الداتابيز قبل الاعتماد.
                            </p>
                        </div>
                    )}
                </GlassContainer>
            </div>

            <style>{`
                .btn-action { width: 100%; padding: 15px; border-radius: 12px; border: none; font-weight: 900; font-size: 14px; cursor: pointer; transition: 0.2s; display: flex; justify-content: center; align-items: center; gap: 8px; }
                .btn-action.primary { background: #0f172a; color: white; }
                .btn-action.primary:hover { background: #1e293b; transform: translateY(-2px); }
                .btn-action.success { background: #10b981; color: white; }
                .btn-action.success:hover { background: #059669; transform: translateY(-2px); }
                .btn-action.disabled { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; border: 1px solid #e2e8f0; }
                
                .upload-dropzone { border: 2px dashed #cbd5e1; background: #f8fafc; padding: 20px; border-radius: 12px; text-align: center; cursor: pointer; transition: 0.2s; font-weight: 900; font-size: 14px; color: #3b82f6; display: block; }
                .upload-dropzone:hover { background: #eff6ff; border-color: #3b82f6; }
                .upload-dropzone.loading { opacity: 0.7; cursor: wait; background: #f1f5f9; border-color: #94a3b8; color: #64748b; }

                .tab-btn { padding: 10px 20px; border-radius: 10px; border: 1px solid #e2e8f0; background: white; color: #64748b; font-weight: 900; font-size: 13px; cursor: pointer; transition: 0.2s; white-space: nowrap; }
                .tab-btn:hover { background: #f8fafc; }
                .tab-btn.active { background: #0f172a; color: white; border-color: #0f172a; box-shadow: 0 4px 10px rgba(15,23,42,0.2); }
            `}</style>
        </MasterPage>
    );
}
