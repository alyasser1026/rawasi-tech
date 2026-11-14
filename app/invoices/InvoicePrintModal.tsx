"use client";
import { currencyCode, currencyName } from '@/lib/currency';
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom'; 
import { THEME } from '@/lib/theme';
import { formatCurrency, tafqeet } from '@/lib/helpers'; 
import { useToast } from '@/lib/toast-context'; 
import ZatcaQRCode from './ZatcaQRCode'; 
import { supabase } from '@/lib/supabase';
import ReportContactFooter from '@/components/ReportContactFooter';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import { DocSignatures, DocTotals, DocWords, PHI_DOC_CSS, type DocTotalRow } from '@/components/PrintDocument';
import { useCompany } from '@/lib/CompanyContext';

// --- [المودال الرئيسي لطباعة ومعاينة الفاتورة] ---
export default function InvoicePrintModal({ isOpen, onClose, record, setRecord = () => {}, onSave, isSaving, projects }: any) {
    const { showToast } = useToast();
    const { activeCompany } = useCompany(); 
    const [mounted, setMounted] = useState(false); 
    const [creatorInfo, setCreatorInfo] = useState<{username: string, fullName: string} | null>(null); 

    useEffect(() => {
        setMounted(true);
    }, []);

    // =========================================================================
    // 🚀 جلب بيانات منشئ الفاتورة (فلتر كاسح لكل احتمالات أسماء الأعمدة)
    // =========================================================================
    useEffect(() => {
        const fetchCreatorInfo = async () => {
            if (!isOpen) return;

            try {
                // 1. جلب بيانات الجلسة الحالية عشان نستخدمها كبديل قوي لو الفاتورة جديدة
                const { data: { session } } = await supabase.auth.getSession();
                
                // 2. تحديد الـ ID (بتاع اللي كرت الفاتورة، ولو مفيش يبقى اللي فاتح السيستم دلوقتي)
                const targetUserId = record?.created_by || session?.user?.id;

                let fetchedFullName = '';
                let fetchedUsername = '';

                if (targetUserId) {
                    // سحب *كل* الأعمدة من جدول profiles عشان نتفادى مشكلة اسم العمود
                    const { data: profile, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', targetUserId)
                        .single();
                    
                    if (!error && profile) {
                        // سحب الاسم الفعلي من أي عمود محتمل
                        fetchedFullName = profile.full_name || profile.name || profile.nickname || '';
                        // سحب اليوزر نيم
                        fetchedUsername = profile.username || profile.email || '';
                    }
                }

                // 3. خطة بديلة: لو البروفايل فاضي، هنسحب من الميتا-داتا بتاعت الـ Session نفسه
                if (!fetchedFullName && session?.user) {
                    fetchedFullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';
                }
                if (!fetchedUsername && session?.user) {
                    fetchedUsername = session.user.email ? session.user.email.split('@')[0] : '';
                }

                // 4. اعتماد البيانات النهائية
                setCreatorInfo({ 
                    username: fetchedUsername || 'مستخدم النظام', 
                    fullName: fetchedFullName || record?.created_by_name || 'المحاسب المعتمد' 
                });

            } catch (err) {
                console.error("خطأ في جلب بيانات المحاسب للباركود:", err);
            }
        };
        fetchCreatorInfo();
    }, [isOpen, record?.created_by]);

    // =========================================================================
    // 🚀 سحب المشاريع بذكاء استراتيجي (دعم المصفوفات، النصوص، والبيانات الجاهزة)
    // =========================================================================
    const projectNames = useMemo(() => {
        if (!record || !projects) return '---';

        if (Array.isArray(record.selected_projects) && record.selected_projects.length > 0) {
            return record.selected_projects.map((p: any) => p.Property || p.project_name || p.name).join(' - ');
        }

        if (!record.project_ids) return '---';

        let pIds: string[] = [];
        try {
            if (Array.isArray(record.project_ids)) {
                pIds = record.project_ids.map((id: unknown) => typeof id === 'object' && id !== null && 'id' in id ? String(id.id) : String(id));
            } else if (typeof record.project_ids === 'string') {
                const cleanStr = record.project_ids.trim();
                if (cleanStr.startsWith('[')) {
                    pIds = JSON.parse(cleanStr).map(String);
                } else {
                    pIds = String(cleanStr).replace(/[{}[\]"']/g, '').split(',').map(id => id.trim());
                }
            }
        } catch (error) {
            console.error("خطأ في قراءة مصفوفة المشاريع:", error);
        }

        pIds = pIds.filter(id => id && id.length > 0);
        if (pIds.length === 0) return '---';

        const matchedProjects = projects.filter((p: any) => pIds.includes(String(p.id)));
        if (matchedProjects.length === 0) return '---';

        return matchedProjects.map((p: any) => p.Property || p.project_name || p.name).join(' - ');
    }, [record?.project_ids, record?.selected_projects, projects]);

    // =========================================================================
    // 🛡️ 1. سحب البيانات والمنطق الحسابي (متروك بالكامل لحماية النظام)
    // =========================================================================
    useEffect(() => {
        if (!isOpen || !record) return;
        let updates: any = {};
        let needsUpdate = false;

        if (!record.invoice_number && !record.id) {
            updates.date = record.date || new Date().toISOString();
            updates.lines = record.lines || []; 
            needsUpdate = true;
        }

        if (record.id && !record.selected_projects && record.project_ids && projects?.length > 0) {
            let arrIds = Array.isArray(record.project_ids) ? record.project_ids : [];
            if (typeof record.project_ids === 'string') {
                arrIds = record.project_ids.replace(/[{}[\]"']/g, '').split(',').map((id:string) => id.trim());
            }
            const mappedProjects = projects.filter((p: any) => arrIds.includes(String(p.id)));
            if (mappedProjects.length > 0) {
                updates.selected_projects = mappedProjects;
                needsUpdate = true;
            }
        }

        if (record.id && !record.client_name && record.partners?.name) {
            updates.client_name = record.partners.name;
            needsUpdate = true;
        }

        if (needsUpdate && typeof setRecord === 'function') {
            setRecord((prev: any) => ({ ...prev, ...updates }));
        }
    }, [record?.id, projects?.length, isOpen, setRecord]); 

    useEffect(() => {
        if (!record || record.line_accounting) return; 
        const qty = Number(record.quantity || 0);
        const price = Number(record.unit_price || 0);
        
        // 🚀 إضافة حساب lines_data للإجمالي في حالة وجوده
        const linesTotal = (record.lines || []).reduce((sum: number, line: any) => sum + (Number(line.quantity) * Number(line.unit_price)), 0);
        const linesDataTotal = (record.lines_data || []).reduce((sum: number, line: any) => sum + (Number(line.total_price) || (Number(line.quantity || 0) * Number(line.unit_price || 0))), 0);
        
        const lineTotal = (qty * price) + linesTotal + linesDataTotal;
        const materialsDiscount = Number(record.materials_discount || 0);
        const taxableAmount = lineTotal - materialsDiscount;
        const guaranteePercent = Number(record.guarantee_percent || 0);
        const guaranteeAmount = (taxableAmount * guaranteePercent) / 100;
        const taxAmount = record.skip_zatca ? 0 : (taxableAmount * 0.15); 
        const finalTotal = taxableAmount + taxAmount - guaranteeAmount;
        const days = Number(record.due_in_days || 0);
        const invoiceDate = record.date ? new Date(record.date) : new Date();
        const dueDateCalculated = new Date(invoiceDate);
        dueDateCalculated.setDate(dueDateCalculated.getDate() + days);

        if (
            record.line_total !== lineTotal ||
            record.taxable_amount !== taxableAmount ||
            record.guarantee_amount !== guaranteeAmount ||
            record.tax_amount !== taxAmount ||
            record.total_amount !== finalTotal ||
            record.due_date !== dueDateCalculated.toISOString()
        ) {
            if (typeof setRecord === 'function') {
                setRecord((prev: any) => ({
                    ...prev,
                    line_total: lineTotal,
                    taxable_amount: taxableAmount,
                    guarantee_amount: guaranteeAmount,
                    tax_amount: taxAmount,
                    total_amount: finalTotal,
                    due_date: dueDateCalculated.toISOString()
                }));
            }
        }
    }, [record?.quantity, record?.unit_price, record?.materials_discount, record?.guarantee_percent, record?.date, record?.due_in_days, record?.skip_zatca, record?.lines, record?.lines_data, setRecord]); 

    const handleAddStatement = (e: React.MouseEvent) => { /* محفوظة للمنطق */ };
    const handleRemoveLine = (indexToRemove: number) => { /* محفوظة للمنطق */ };
    const handleValidateAndSave = () => { /* محفوظة للمنطق */ };

    if (!isOpen || !mounted || !record) return null;

    // =========================================================================
    // 🚀 دالة الطباعة السحرية
    // =========================================================================
    const handlePrintOrPDF = () => {
        const originalTitle = document.title;
        document.title = record?.invoice_number ? `فاتورة_${record.invoice_number}` : 'فاتورة_ضريبية';
        window.print();
        setTimeout(() => { document.title = originalTitle; }, 1000);
    };

    // 🚀 تهيئة بيانات التوقيع والباركود
    const finalFullName = creatorInfo?.fullName || 'المحاسب المعتمد';
    
    // 🚀 استخراج تاريخ ووقت إنشاء الفاتورة من الداتابيز (created_at) بدلاً من وقت الطباعة
    const creationDateObj = record?.created_at ? new Date(record.created_at) : (record?.date ? new Date(record.date) : new Date());
    const creationTime = creationDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const creationDate = creationDateObj.toLocaleDateString('en-US');
    
    // 🚀 الباركود يحمل اسم المحاسب الحقيقي والتاريخ والوقت فقط (بدون يوزرنيم للأمان)
    const signatureData = `تم الاعتماد إلكترونياً\nتاريخ الإصدار: ${creationDate}\nوقت الإصدار: ${creationTime}\nبواسطة: ${finalFullName}`;
    
    const amountInWords = tafqeet(Number(record.total_amount || 0));

    // دمج البنود بدون تكرار في حالة وجود lines و lines_data معاً
    const printLines = (Array.isArray(record.lines) && record.lines.length > 0)
        ? record.lines
        : (Array.isArray(record.lines_data) ? record.lines_data : []);
    const hasMainItem = printLines.length === 0 && (Number(record.quantity) > 0 || Number(record.unit_price) > 0 || Boolean(record.description));

    // 🚀 استنتاج إجمالي الأعمال لحظياً لضمان عدم ظهوره بـ 0 أثناء الرندر
    const calcQty = Number(record.quantity || 0);
    const calcPrice = Number(record.unit_price || 0);
    const calcPrintLinesTotal = printLines.reduce((sum: number, line: any) => sum + (Number(line.total_price) || (Number(line.quantity || 0) * Number(line.unit_price || 0))), 0);
    let displayLineTotal = (hasMainItem ? (calcQty * calcPrice) : 0) + calcPrintLinesTotal;
    
    if (displayLineTotal === 0 && Number(record.taxable_amount) > 0) {
        displayLineTotal = record.line_accounting
            ? Number(record.taxable_amount)
            : Number(record.taxable_amount) + Number(record.materials_discount || 0);
    }

    const isDefaultCompany = activeCompany?.is_default !== false;
    const sellerTaxNo = activeCompany?.tax_number || (isDefaultCompany ? '312487477800003' : 'غير مسجل');
    const sellerCrNo = activeCompany?.cr_number || (isDefaultCompany ? '7051013319' : '');
    const sellerAddress = activeCompany?.address || (isDefaultCompany ? 'الدمام - حي الفيصليه - شارع السعيره' : '');
    const sellerEmail = activeCompany?.email || (isDefaultCompany ? 'phi.tech.eg@gmail.com' : '');

    // Custom formatting wrapper to force English numbers
    const formatNumberEn = (num: number) => {
        return new Intl.NumberFormat('en-US', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    };
    
    // Wrapper for currency if the original function uses Arabic numbers
    const formatCurrencyEn = (val: any) => {
        const num = Number(val) || 0;
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode(), minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    }

    // 📦 محتوى المعاينة 
    const modalContent = (
        <div className="print-modal-overlay">
            
            <style>{`
                @media screen {
                    body { overflow: hidden !important; }
                }

                .print-modal-overlay {
                    position: fixed !important; 
                    inset: 0 !important;
                    background: rgba(40, 24, 10, 0.85) !important; 
                    backdrop-filter: blur(10px) !important; 
                    z-index: 999999999 !important;
                    display: flex !important; 
                    flex-direction: column !important; 
                    align-items: center !important; 
                    justify-content: flex-start !important; 
                    padding: 30px 20px !important; 
                    overflow-y: auto !important;
                    font-family: 'Arial', sans-serif;
                }

                .print-actions-bar {
                    display: flex !important; 
                    gap: 15px !important; 
                    margin-bottom: 25px !important;
                    background: white !important; 
                    padding: 15px 30px !important; 
                    border-radius: 50px !important;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3) !important;
                    position: sticky !important; 
                    top: 20px !important; 
                    z-index: 1000000000 !important; 
                }
                .action-btn { padding: 12px 25px; border-radius: 10px; border: none; font-weight: 900; font-size: 16px; cursor: pointer; transition: 0.2s; }
                .action-btn.print { background: var(--accent-ink); color: white; box-shadow: var(--shadow-elevation); }
                .action-btn.close { background: #fee2e2; color: #dc2626; }
                .action-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }

                .a4-preview-box {
                    width: 210mm !important; 
                    min-height: 297mm !important; 
                    background: white !important; 
                    color: #000;
                    padding: 15mm !important; 
                    margin: 0 auto 40px auto !important; 
                    box-shadow: 0 20px 50px rgba(0,0,0,0.4);
                    direction: rtl; 
                    border-radius: 14px !important; 
                    overflow: hidden !important;
                    display: flex !important;
                    flex-direction: column !important; 
                    box-sizing: border-box !important; 
                }

                .inv-header { display: grid; grid-template-columns: 120px 1fr 120px; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; width: 100%; gap: 10px; position: relative; z-index: 99; }
                
                .header-qr { display: flex; justify-content: flex-start; align-items: flex-start; position: relative; z-index: 100; } 
                .header-center { text-align: center; }
                .header-logo { display: flex; justify-content: flex-end; align-items: center; } 
                
                .header-logo img { height: 72px; max-height: 72px; width: auto; max-width: 240px; object-fit: contain; background: transparent; } 
                
                .qr-container { 
                    width: 80px !important; 
                    height: 80px !important; 
                    min-width: 80px !important;
                    min-height: 80px !important;
                    display: flex !important; 
                    justify-content: center !important; 
                    align-items: center !important; 
                    padding: 3px !important; 
                    background: #fff !important; 
                    border: 1.5px solid #cbd5e1 !important; 
                    border-radius: 6px !important; 
                    position: relative !important;
                    z-index: 9999999 !important; 
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1) !important; 
                    overflow: hidden !important;
                }
                
                .qr-container svg, .qr-container canvas, .qr-container img, .qr-container > div {
                    max-width: 100% !important;
                    max-height: 100% !important;
                    width: 100% !important;
                    height: 100% !important;
                    display: block !important;
                }

                .inv-title-box { text-align: center; margin-bottom: 15px; }
                .inv-title { font-size: 18px; font-weight: 900; border: 2.5px solid #000; padding: 4px 25px; display: inline-block; background: #f8fafc; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; border-radius: 10px; }

                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
                
                .info-box { 
                    border: 1.5px solid #cbd5e1; 
                    border-radius: 16px !important; 
                    padding: 16px 15px 10px 15px; 
                    display: flex; flex-direction: column; justify-content: center;
                    position: relative; background: #fff; min-height: 85px; 
                }
                .box-label { 
                    position: absolute; top: -10px; right: 20px; background: white; 
                    padding: 0 10px; font-size: 11px; font-weight: 900; color: #475569; 
                    border-radius: 14px; 
                }

                .inner-table { width: 100%; border-collapse: collapse; }
                .inner-table td { padding: 4px 0; font-size: 13px; vertical-align: middle; }
                .label-cell { text-align: left; font-weight: 900; color: #64748b; padding-left: 10px !important; }
                .value-cell { text-align: right; font-weight: 900; color: #0f172a; }
                .value-highlight { color: ${THEME.primary}; font-size: 15px; font-weight: 900; }

                .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; border-radius: 8px; overflow: hidden; }
                .inv-table th { background: #f8fafc; padding: 6px 4px; text-align: center; border-bottom: 2px solid #94a3b8; border-top: 2px solid #94a3b8; color: #0f172a; font-weight: 900; font-size: 12px; }
                .inv-table td { padding: 6px 4px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #1e293b; font-weight: 700; font-size: 12px; }
                .inv-table td.desc { text-align: right; font-weight: 900; font-size: 13px; line-height: 1.5; }

                /* جعلنا المربعات السفلية متوازية (align-items: flex-end) بدلا من flex-start */
                .inv-footer-flex { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; flex-grow: 1; gap: 30px; }
                .inv-amount-words { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
                .inv-amount-words .words-box { background: #f8fafc; border: 1px dashed #cbd5e1; padding: 12px; border-radius: 12px; font-weight: 900; font-size: 13px; color: #0f172a; line-height: 1.5; }
                
                .signature-area { margin-top: 20px; text-align: center; align-self: flex-start; }
                .signature-title { font-weight: 900; font-size: 12px; color: #64748b; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }

                /* تم تكبير السامري وزيادة عرضة (420px) والخطوط جواه */
                .inv-totals-box { width: 420px; }
                .inv-total-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; font-weight: 800; color: #334155; align-items: center; }
                .inv-total-row.tax { color: #0284c7; }
                .inv-total-row.discount { color: #dc2626; }
                .inv-total-row.grand-total { border-top: 2px solid #0f172a; padding-top: 10px; margin-top: 10px; font-size: 17px; font-weight: 900; color: #0f172a; background: #f1f5f9; padding: 10px; border-radius: 10px; }

                .inv-footer-contact { 
                    margin-top: auto !important; 
                    border-top: 2px solid #e2e8f0; 
                    padding-top: 15px; 
                    text-align: center; 
                    font-size: 12px; 
                    color: #64748b; 
                    font-weight: 700; 
                }

                @media print {
                    html, body {
                        width: auto !important;
                        height: auto !important;
                        min-height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        overflow: visible !important;
                    }

                    body > *:not(.print-modal-overlay) {
                        display: none !important;
                    }

                    .no-print, .print-actions-bar {
                        display: none !important;
                    }

                    .print-modal-overlay, .print-modal-overlay * {
                        visibility: visible !important;
                    }

                    .print-modal-overlay {
                        position: static !important;
                        width: auto !important;
                        height: auto !important;
                        min-height: 0 !important;
                        display: block !important;
                        background: #ffffff !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                    }

                    .a4-preview-box {
                        position: static !important;
                        width: auto !important;
                        max-width: 100% !important;
                        height: auto !important;
                        min-height: 0 !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        padding: 12mm !important;
                        box-sizing: border-box !important;
                        direction: rtl !important;
                        display: block !important;
                        border-radius: 0 !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        overflow: visible !important;
                        page-break-after: auto !important;
                        page-break-inside: auto !important;
                        break-inside: auto !important;
                    }
                }
            `}</style>
            <style>{PHI_DOC_CSS}</style>

            <div className="print-actions-bar no-print">
                <button onClick={handlePrintOrPDF} className="action-btn print">
                    طباعة / تنزيل PDF
                </button>
                <button onClick={onClose} className="action-btn close">
                    إغلاق المعاينة
                </button>
            </div>

            <div className="a4-preview-box phi-doc phi-doc-page">
                
                {/* 1️⃣ الترويسة الرسمية الموحدة + رمز هيئة الزكاة + بيانات الفاتورة */}
                <ReportOfficialHeader
                    title={record.skip_zatca ? 'فاتورة (Invoice)' : 'فاتورة ضريبية (Tax Invoice)'}
                    badgeText={record.skip_zatca ? 'فاتورة مبيعات معتمدة • SALES INVOICE' : 'فاتورة ضريبية معتمدة • VAT INVOICE'}
                    reportRefCode={record.invoice_number ? `INV-${record.invoice_number}` : undefined}
                    refLabel="رقم الفاتورة"
                    issueDate={record.date ? new Date(record.date).toLocaleDateString('en-GB') : creationDate}
                    meta={[
                        { label: 'تاريخ الاستحقاق', value: record.due_date ? new Date(record.due_date).toLocaleDateString('en-GB') : undefined, ltr: true },
                        { label: 'وقت الإصدار', value: creationTime, ltr: true },
                    ]}
                    currency={`${currencyName()} (${currencyCode()})`}
                    compact
                    issuer={{
                        taxNumber: sellerTaxNo,
                        unifiedNumber: sellerCrNo || undefined,
                        address: sellerAddress || undefined,
                    }}
                    qrNode={record.skip_zatca ? undefined : <ZatcaQRCode record={record} />}
                    qrCaption={record.skip_zatca ? undefined : 'رمز هيئة الزكاة والضريبة'}
                    details={[
                        { label: 'العميل • Client', value: record.client_name || record.partners?.name || '---' },
                        { label: 'الرقم الضريبي للعميل • VAT No', value: record.partners?.tax_id || record.partners?.vat_number, ltr: true },
                        { label: 'المشروع • Project', value: projectNames },
                        { label: 'الصافي المطلوب', value: formatCurrencyEn(record.total_amount), accent: !(Number(record.paid_amount) > 0), ltr: true },
                        ...(Number(record.paid_amount) > 0 ? [
                            { label: 'الدفعة المسددة • Paid', value: formatCurrencyEn(record.paid_amount), ltr: true },
                            { label: 'المتبقي المستحق • Balance', value: formatCurrencyEn(Math.max(0, Number(record.total_amount || 0) - Number(record.paid_amount || 0))), accent: true, ltr: true },
                        ] : []),
                        { label: 'عنوان العميل • Address', value: record.partners?.address || record.address || 'المملكة العربية السعودية', wide: true },
                    ]}
                />

                {/* 3️⃣ جدول البنود التفصيلية */}
                <table className="inv-table phi-doc-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40px' }}>#</th>
                            <th className="is-start">البيان / Description</th>
                            <th style={{ width: '90px' }}>الوحدة / Unit</th>
                            <th style={{ width: '90px' }}>الكمية / Qty</th>
                            <th style={{ width: '120px' }}>السعر / Price</th>
                            <th style={{ width: '150px' }}>الإجمالي / Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {hasMainItem && (
                            <tr>
                                <td>1</td>
                                <td className="is-start is-strong">{record.description || '---'}</td>
                                <td>{record.unit || '---'}</td>
                                <td>{formatNumberEn(record.quantity || 0)}</td>
                                <td>{formatCurrencyEn(record.unit_price)}</td>
                                <td className="is-strong">{formatCurrencyEn((Number(record.quantity||0) * Number(record.unit_price||0)))}</td>
                            </tr>
                        )}
                        
                        {printLines.map((line: any, idx: number) => {
                            const rowNum = (hasMainItem ? 1 : 0) + idx + 1;
                            const qty = Number(line.quantity || 0);
                            const price = Number(line.unit_price || 0);
                            const total = Number(line.total_price ?? (qty * price));

                            return (
                                <tr key={`pline-${idx}`}>
                                    <td>{rowNum}</td>
                                    <td className="is-start is-strong">{line.description || line.item_name || line.name || '---'}</td>
                                    <td>{line.unit || '---'}</td>
                                    <td>{formatNumberEn(qty || 0)}</td>
                                    <td>{formatCurrencyEn(price)}</td>
                                    <td className="is-strong">{formatCurrencyEn(total)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* 4️⃣ التفقيط والإجماليات */}
                <div className="phi-doc-summary" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
                    <div className="phi-doc-stack">
                        <DocWords text={amountInWords} />
                    </div>
                    <DocTotals
                        rows={([
                            { label: 'إجمالي الأعمال / Subtotal', value: formatCurrencyEn(record.line_accounting ? record.taxable_amount : (record.line_total || displayLineTotal)) },
                            { label: 'يخصم (مواد) / Mat. Discount', value: `- ${formatCurrencyEn(record.materials_discount)}`, tone: 'discount', hidden: !(!record.line_accounting && Number(record.materials_discount) > 0) },
                            { label: 'الخاضع للضريبة / Taxable', value: formatCurrencyEn(record.taxable_amount), hidden: !!record.line_accounting },
                            { label: record.skip_zatca ? 'الضريبة (غير خاضعة) / VAT 0%' : 'الضريبة 15% / VAT 15%', value: formatCurrencyEn(record.tax_amount), tone: 'tax' },
                            { label: `ضمان أعمال / Guarantee${Number(record.guarantee_percent) > 0 ? ` (${record.guarantee_percent}%)` : ''}`, value: `- ${formatCurrencyEn(record.guarantee_amount)}`, tone: 'discount', hidden: !(Number(record.guarantee_amount) > 0) },
                            { label: 'تسوية خامات العميل / Customer Materials', value: `- ${formatCurrencyEn(record.materials_discount)}`, tone: 'discount', hidden: !(record.line_accounting && Number(record.materials_discount) > 0) },
                            { label: 'الدفعة المسددة / Paid Amount', value: `- ${formatCurrencyEn(record.paid_amount)}`, tone: 'discount', hidden: !(Number(record.paid_amount) > 0) },
                        ] as DocTotalRow[])}
                        grand={{
                            label: Number(record.paid_amount) > 0 ? 'المتبقي المستحق / Balance Due' : 'الصافي المستحق / Grand Total',
                            value: formatCurrencyEn(Number(record.paid_amount) > 0 ? Math.max(0, Number(record.total_amount || 0) - Number(record.paid_amount || 0)) : record.total_amount)
                        }}
                    />
                </div>
                {Number(record.net_adjustment || 0) !== 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-8px', marginBottom: '12px' }}>
                        <div style={{ width: '340px' }}>
                            <DocTotals rows={[{ label: 'الرصيد بعد الإشعارات / Adjusted Total', value: formatCurrencyEn(record.effective_total ?? record.total_amount), tone: 'warn' }]} />
                        </div>
                    </div>
                )}

                <DocSignatures slots={[
                    { title: 'أعدّه', en: 'Prepared by', name: finalFullName, qrValue: signatureData, date: creationDate },
                    { title: 'المدير المالي', en: 'Finance Manager' },
                    { title: 'استلام العميل', en: 'Client Acknowledgement', name: record.client_name || record.partners?.name || undefined },
                ]} />

                {/* 5️⃣ الفوتر الثابت أسفل الصفحة */}
                <ReportContactFooter layout="minimal" style={{ marginTop: 'auto', paddingTop: '10px' }} />

            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}

