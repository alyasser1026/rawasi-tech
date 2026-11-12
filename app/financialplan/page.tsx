"use client";
import React, { useMemo } from 'react';
import { useFinancialPlanLogic } from './financial_plan_logic';
import MasterPage from '@/components/MasterPage';
import { formatCurrency } from '@/lib/helpers';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import { DocSignatures, PHI_DOC_CSS } from '@/components/PrintDocument';
import { currencyCode, currencyName } from '@/lib/currency';
import * as XLSX from 'xlsx-js-style';
import LoadingScreen from '@/components/LoadingScreen';
import { Trash2, Plus, Download, Printer, Save } from 'lucide-react';
import { notify } from '@/lib/notify';

const THEME = {
  primary: '#0f172a',    
  accent: '#c2410c',
  success: '#059669',    
  ruby: '#e11d48',       
  slate: '#f8fafc',
  border: '#e2e8f0',
  textMain: '#334155',
  textMuted: '#64748b'
};

const planControlStyle: React.CSSProperties = {
  background: 'var(--surface-sunken)',
  color: 'var(--text-primary)',
  border: 'none',
  boxShadow: 'var(--shadow-sunken)',
  borderRadius: '10px',
  fontWeight: 800,
  fontSize: 'var(--fs-sm)',
  height: '2.625rem',
  padding: '0 0.875rem',
  outline: 'none',
  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
};

const planDivider = 'none';

export default function FinancialPlanPage() {
  const logic = useFinancialPlanLogic();

  // 📈 مصفوفة أسماء الأشهر باللغة العربية للعنوان الرسمي للإكسيل والطباعة
  const arabicMonths = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
  ];
  const monthNameArabic = arabicMonths[logic.selectedMonth - 1] || `شهر ${logic.selectedMonth}`;

  // 📥 محرك تصدير الإكسيل الاحترافي بالمعادلات الحية وصب توتال 9
  const handleExportToExcel = () => {
    if (logic.records.length === 0) return notify("لا يوجد بيانات لتصديرها!");

    const revenues = logic.records.filter(r => r.category === 'إيرادات');
    const expenses = logic.records.filter(r => r.category === 'مصروفات');

    const aoa: any[] = [];
    
    // الصف 1: العنوان الرئيسي الملكي
    aoa.push([`كشف الخطة المالية والموازنة التقديرية التفصيلي - لشهـر: ${monthNameArabic} / لسنة ${logic.selectedYear}`]);
    // الصف 2: فارغ للنظافة البصرية
    aoa.push([]);

    // --- 🟢 قسم الإيرادات المتوقعة ---
    const revTitleIdx = aoa.length;
    aoa.push(['الإيرادات المتوقعة (المستهدفة والمنفذة)']);
    
    const revHeaderIdx = aoa.length;
    aoa.push(['م', 'التصنيف', 'اسم البند', 'المستهدف (المخطط)', 'المنفذ (الفعلي)', 'الانحراف المالي']);

    const revStartRow = aoa.length + 1; // السطر الحقيقي في إكسيل
    revenues.forEach((r, idx) => {
      aoa.push([idx + 1, r.category, r.item_name || 'بند غير مسمى', Number(r.planned_amount) || 0, Number(r.actual_amount) || 0, 0]);
    });
    const revEndRow = aoa.length;
    const revTotalRowIdx = aoa.length;
    aoa.push(['---', 'إجمالي قسم الإيرادات', '---', 0, 0, 0]); // سيتم حقن SUBTOTAL بالأسفل

    aoa.push([]); // سطر فارغ فاصل

    // --- 🔴 قسم المصروفات المقدرة ---
    const expTitleIdx = aoa.length;
    aoa.push(['المصروفات المقدرة (الموازنة والمنصرف الفعلي)']);
    
    const expHeaderIdx = aoa.length;
    aoa.push(['م', 'التصنيف', 'اسم البند', 'المقدر (المخطط)', 'المنصرف (الفعلي)', 'الانحراف المالي']);

    const expStartRow = aoa.length + 1;
    expenses.forEach((r, idx) => {
      aoa.push([idx + 1, r.category, r.item_name || 'بند غير مسمى', Number(r.planned_amount) || 0, Number(r.actual_amount) || 0, 0]);
    });
    const expEndRow = aoa.length;
    const expTotalRowIdx = aoa.length;
    aoa.push(['---', 'إجمالي قسم المصروفات', '---', 0, 0, 0]); // سيتم حقن SUBTOTAL بالأسفل

    aoa.push([]); // سطر فارغ فاصل

    // --- 📊 قسم خلاصة الأرباح النهائية ---
    const summaryTitleIdx = aoa.length;
    aoa.push(['خلاصة مقارنة الأداء وصافي الأرباح']);
    
    const netPlannedIdx = aoa.length;
    aoa.push(['صافي الربح المخطط (المستهدف التقديري)', '', '', 0, '', '']); // سيتم ربطه بمعادلة طرح
    
    const netActualIdx = aoa.length;
    aoa.push(['صافي الربح الفعلي (المنفذ المحقق)', '', '', '', 0, '']); // سيتم ربطه بمعادلة طرح

    // تحويل المصفوفة إلى شيت إكسيل
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // بناء مصفوفة دمج الخلايا الرسمية للعناوين
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }); // العنوان الرئيسي
    ws['!merges'].push({ s: { r: revTitleIdx, c: 0 }, e: { r: revTitleIdx, c: 5 } }); // عنوان الإيرادات
    ws['!merges'].push({ s: { r: expTitleIdx, c: 0 }, e: { r: expTitleIdx, c: 5 } }); // عنوان المصروفات
    ws['!merges'].push({ s: { r: summaryTitleIdx, c: 0 }, e: { r: summaryTitleIdx, c: 5 } }); // عنوان الملخص
    ws['!merges'].push({ s: { r: netPlannedIdx, c: 0 }, e: { r: netPlannedIdx, c: 2 } }); // دمج تسمية صافي المخطط
    ws['!merges'].push({ s: { r: netActualIdx, c: 0 }, e: { r: netActualIdx, c: 2 } }); // دمج تسمية صافي الفعلي

    // 🎨 حلقة تكرار ذكية لحقن التنسيقات الفخمة والمعادلات الرياضية الحية لكل خلية
    const range = XLSX.utils.decode_range(ws['!ref'] || "A1:F20");
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };

        const excelRow = R + 1;
        let cellStyle: any = {
          alignment: { vertical: "center", horizontal: "center" },
          font: { name: "Arial", sz: 11, color: { rgb: "FF334155" }, bold: false },
          fill: { fgColor: { rgb: "FFFFFFFF" } }
        };

        // 👑 1. تنسيق العنوان الرئيسي العلوي (كحلي ملكي)
        if (R === 0) {
          cellStyle.font = { name: "Arial", sz: 14, bold: true, color: { rgb: "FFFFFFFF" } };
          cellStyle.fill = { fgColor: { rgb: "FF0F172A" } };
        }
        // 🟢 2. تنسيق عنوان قسم الإيرادات (أخضر هادئ)
        else if (R === revTitleIdx) {
          cellStyle.alignment.horizontal = "right";
          cellStyle.font = { name: "Arial", sz: 12, bold: true, color: { rgb: "FF069669" } };
          cellStyle.fill = { fgColor: { rgb: "FFECFDF5" } };
        }
        // 🔴 3. تنسيق عنوان قسم المصروفات (أحمر هادئ)
        else if (R === expTitleIdx) {
          cellStyle.alignment.horizontal = "right";
          cellStyle.font = { name: "Arial", sz: 12, bold: true, color: { rgb: "FFE11D48" } };
          cellStyle.fill = { fgColor: { rgb: "FFFFF1F2" } };
        }
        // 🌟 4. تنسيق جدول رؤوس الأعمدة (أزرق فخم)
        else if (R === revHeaderIdx || R === expHeaderIdx) {
          cellStyle.font = { name: "Arial", sz: 11, bold: true, color: { rgb: "FFFFFFFF" } };
          cellStyle.fill = { fgColor: { rgb: "FF3B82F6" } };
        }
        // 🧮 5. سطر إجمالي الإيرادات (صب توتال 9 الذكي)
        else if (R === revTotalRowIdx) {
          cellStyle.font = { name: "Arial", sz: 11, bold: true, color: { rgb: "FF0F172A" } };
          cellStyle.fill = { fgColor: { rgb: "FFFEF08A" } }; // أصفر فخم
          if ([3, 4, 5].includes(C)) {
            const colLetter = String.fromCharCode(65 + C);
            ws[cellRef].t = 'n';
            ws[cellRef].f = `SUBTOTAL(9, ${colLetter}${revStartRow}:${colLetter}${revEndRow})`;
            delete ws[cellRef].v;
          }
        }
        // 🧮 6. سطر إجمالي المصروفات (صب توتال 9 الذكي)
        else if (R === expTotalRowIdx) {
          cellStyle.font = { name: "Arial", sz: 11, bold: true, color: { rgb: "FF0F172A" } };
          cellStyle.fill = { fgColor: { rgb: "FFFEF08A" } };
          if ([3, 4, 5].includes(C)) {
            const colLetter = String.fromCharCode(65 + C);
            ws[cellRef].t = 'n';
            ws[cellRef].f = `SUBTOTAL(9, ${colLetter}${expStartRow}:${colLetter}${expEndRow})`;
            delete ws[cellRef].v;
          }
        }
        // 📊 7. تنسيقات خانات الخلاصة السفلية المدمجة
        else if (R === summaryTitleIdx) {
          cellStyle.alignment.horizontal = "right";
          cellStyle.font = { name: "Arial", sz: 12, bold: true, color: { rgb: "FF1E293B" } };
          cellStyle.fill = { fgColor: { rgb: "FFF1F5F9" } };
        }
        else if (R === netPlannedIdx) {
          cellStyle.fill = { fgColor: { rgb: "FFF8FAFC" } };
          cellStyle.font.bold = true;
          if (C === 0) cellStyle.alignment.horizontal = "right";
          if (C === 3) {
            ws[cellRef].t = 'n';
            ws[cellRef].f = `D${revTotalRowIdx + 1}-D${expTotalRowIdx + 1}`; // إجمالي إيرادات مخطط - مصروفات مخطط
            delete ws[cellRef].v;
            cellStyle.font.color = { rgb: "FF069669" };
            cellStyle.font.sz = 12;
          }
        }
        else if (R === netActualIdx) {
          cellStyle.fill = { fgColor: { rgb: "FFF8FAFC" } };
          cellStyle.font.bold = true;
          if (C === 0) cellStyle.alignment.horizontal = "right";
          if (C === 4) {
            ws[cellRef].t = 'n';
            ws[cellRef].f = `E${revTotalRowIdx + 1}-E${expTotalRowIdx + 1}`; // إجمالي إيرادات فعلي - مصروفات فعلي
            delete ws[cellRef].v;
            cellStyle.font.color = { rgb: "FF2563EB" };
            cellStyle.font.sz = 12;
          }
        }
        // 👷 8. صفوف البنود العادية (معادلات الانحراف الحية والـ Zebra Striping)
        else if ((R >= revStartRow - 1 && R < revEndRow) || (R >= expStartRow - 1 && R < expEndRow)) {
          if (R % 2 === 0) cellStyle.fill = { fgColor: { rgb: "FFF8FAFC" } }; // تمييز الصفوف التبادلي
          
          if (C === 0) cellStyle.font.color = { rgb: "FF94A3B8" }; // تلوين المسلسل بشكل هادئ
          if (C === 2) cellStyle.alignment.horizontal = "right"; // محاذاة اسم البند لليمين لأنه عربي

          // حقن معادلة الانحراف الديناميكية الحية لكل سطر: الفعلي(E) - المخطط(D)
          if (C === 5) {
            ws[cellRef].t = 'n';
            ws[cellRef].f = `E${excelRow}-D${excelRow}`;
            delete ws[cellRef].v;
            
            // تحديد تلوين الخط المبدئي بناءً على فئة القسم لتحسين المظهر الافتتاحي للشيت
            const isRevRow = R < revTotalRowIdx;
            const currentPlanned = Number(aoa[R]?.[3]) || 0;
            const currentActual = Number(aoa[R]?.[4]) || 0;
            const currentVariance = currentActual - currentPlanned;

            if (currentVariance === 0) {
              cellStyle.font.color = { rgb: "FFCBD5E1" };
            } else if (isRevRow) {
              cellStyle.font.color = currentVariance > 0 ? { rgb: "FF069669" } : { rgb: "FFE11D48" };
              cellStyle.font.bold = true;
            } else {
              cellStyle.font.color = currentVariance > 0 ? { rgb: "FFE11D48" } : { rgb: "FF069669" };
              cellStyle.font.bold = true;
            }
          }

          // تلوين الأصفار بالرمادي الهادئ لإراحة البصر
          if (C === 3 || C === 4) {
            if (Number(ws[cellRef].v) === 0) {
              cellStyle.font.color = { rgb: "FFCBD5E1" };
            } else {
              cellStyle.font.bold = true;
            }
          }
        }

        ws[cellRef].s = cellStyle;
      }
    }

    ws['!dir'] = 'rtl'; // توجيه الشيت ليفتح من اليمين إلى اليسار تلقائياً
    ws['!rows'] = Array(aoa.length).fill(null).map((_, i) => i === 0 ? { hpt: 38 } : { hpt: 22 }); // ضبط ارتفاعات متناسقة ومريحة
    ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 32 }, { wch: 22 }, { wch: 22 }, { wch: 18 }]; // أعمدة واسعة للبيانات

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `خطة_${monthNameArabic}`);
    XLSX.writeFile(wb, `الخطة_المالية_والإيرادات_شهر_${monthNameArabic}_لسنة_${logic.selectedYear}.xlsx`);
  };

  // مكون فرعي لرسم الجدول التفاعلي في شاشة الويب
  const renderTable = (category: string) => {
    const filteredRecords = logic.records.filter(r => r.category === category);
    const isRevenue = category === 'إيرادات';
    
    return (
      <div className="plan-panel">
        <div style={{ background: 'var(--surface-subcard)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: isRevenue ? 'var(--status-positive)' : 'var(--status-negative)', fontSize: 'var(--fs-xl)', fontWeight: '900' }}>
            {isRevenue ? 'الإيرادات المتوقعة' : 'المصروفات المقدرة'}
          </h2>
          <button className="ent-button ent-primary" onClick={() => logic.addNewItem(category)} style={{ borderRadius: '10px', fontWeight: 800, border: 'none' }}>
            <Plus size={15} aria-hidden="true" />
            <span>إضافة بند</span>
          </button>
        </div>
        
        <div style={{ overflowX: 'auto', padding: '0.75rem' }}>
          <table className="plan-table">
            <thead>
              <tr>
                <th style={{ minWidth: '14rem', width: '42%' }}>اسم البند</th>
                <th style={{ width: '9.5rem', textAlign: 'center' }}>المبلغ المخطط (مستهدف)</th>
                <th style={{ width: '9.5rem', textAlign: 'center' }}>الفعلي (المنفذ)</th>
                <th style={{ width: '9rem', textAlign: 'center' }}>نسبة الانحراف</th>
                <th style={{ width: '3.5rem', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => {
                const planned = Number(r.planned_amount) || 0;
                const actual = Number(r.actual_amount) || 0;
                const variance = actual - planned;
              
                let varianceColor = 'var(--text-primary)';
                if (variance > 0) varianceColor = isRevenue ? 'var(--status-positive)' : 'var(--status-negative)';
                if (variance < 0) varianceColor = isRevenue ? 'var(--status-negative)' : 'var(--status-positive)';

                return (
                  <tr key={r.id}>
                    <td>
                      <input 
                        type="text" 
                        className="plan-control" 
                        value={r.item_name} 
                        onChange={e => logic.updateRecord(r.id, 'item_name', e.target.value)} 
                        placeholder="اكتب اسم البند..." 
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        className="plan-control text-center" 
                        value={r.planned_amount === 0 ? '' : r.planned_amount} 
                        onChange={e => logic.updateRecord(r.id, 'planned_amount', e.target.value)} 
                        placeholder="0" 
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        className="plan-control text-center" 
                        value={r.actual_amount === 0 ? '' : r.actual_amount} 
                        onChange={e => logic.updateRecord(r.id, 'actual_amount', e.target.value)} 
                        placeholder="0" 
                      />
                    </td>
                    <td style={{ fontWeight: '900', color: varianceColor, textAlign: 'center', direction: 'ltr', fontSize: 'var(--fs-sm)' }}>
                      {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        type="button"
                        className="plan-icon-btn" 
                        aria-label="حذف البند" 
                        onClick={() => logic.removeItem(r.id)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <MasterPage title="الخطة المالية والموازنة" subtitle="إدارة الموازنة التقديرية ومقارنة المستهدف بالفعلي الحقيقي">
      
      {/* 🖨️ ستايل الطباعة المتقدم المعزول كلياً عن كارت المستخدم الجانبي وعناصر التحكم */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; width: 100% !important; direction: rtl !important; font-family: 'Arial', sans-serif; }
          .print-table { width: 100% !important; border-collapse: collapse !important; margin-bottom: 25px !important; font-size: 13px !important; text-align: right !important; }
          .print-table th, .print-table td { border: 1px solid #94a3b8 !important; padding: 10px !important; }
          .print-table th { background-color: ${THEME.primary} !important; color: white !important; font-weight: 900 !important; text-align: center !important; }
          .print-table tr:nth-child(even) { background-color: #f8fafc !important; }
          .print-header-rev { background-color: #d1fae5 !important; color: ${THEME.success} !important; font-weight: 900 !important; font-size: 15px !important; }
          .print-header-exp { background-color: #ffe4e6 !important; color: ${THEME.ruby} !important; font-weight: 900 !important; font-size: 15px !important; }
          @page { size: portrait; margin: 12mm 10mm; }
        }
      `}</style>

      {/* 🖥️ قسم الشاشة التفاعلي الافتراضي (يختفي بالكامل أثناء الطباعة) */}
      <div className="no-print clean-page enterprise-page">
        <style>{`
          .plan-table {
            width: 100% !important;
            border-collapse: separate !important;
            border-spacing: 0 0.5rem !important;
            text-align: right !important;
            border: none !important;
          }
          .plan-table thead th {
            padding: 0.75rem 0.875rem !important;
            font-size: var(--fs-xs) !important;
            font-weight: 800 !important;
            color: var(--text-secondary) !important;
            border: none !important;
            background: transparent !important;
            white-space: nowrap !important;
          }
          .plan-table tbody td {
            padding: 0.25rem 0.5rem !important;
            border: none !important;
            vertical-align: middle !important;
          }
          .plan-control {
            width: 100% !important;
            height: 2.75rem !important;
            border-radius: 12px !important;
            border: 0 !important;
            outline: none !important;
            background: var(--surface-sunken) !important;
            box-shadow: var(--shadow-sunken) !important;
            color: var(--text-primary) !important;
            font-weight: 800 !important;
            font-size: var(--fs-sm) !important;
            padding: 0 0.875rem !important;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          select.plan-control {
            cursor: pointer !important;
            border: 0 !important;
            outline: none !important;
          }
          .plan-control.text-center {
            text-align: center !important;
            font-family: var(--font-mono, monospace) !important;
            font-weight: 900 !important;
          }
          .plan-control:focus {
            box-shadow: var(--shadow-sunken), 0 0 0 2px var(--accent-glow) !important;
          }
          .plan-panel {
            background: var(--surface-card) !important;
            border: none !important;
            border-radius: var(--phi-radius-card, 18px) !important;
            box-shadow: var(--shadow-ambient) !important;
            position: relative !important;
            overflow: hidden !important;
            margin-bottom: 1.5rem !important;
          }
          .plan-panel::before {
            content: '';
            position: absolute;
            top: 0; left: 8%; right: 8%;
            height: 1.5px;
            background: var(--specular-beam);
            pointer-events: none;
          }
          .plan-summary-card {
            background: var(--surface-card) !important;
            border: none !important;
            border-radius: var(--phi-radius-card, 18px) !important;
            box-shadow: var(--shadow-ambient) !important;
            padding: 1.5rem !important;
            position: sticky !important;
            top: 1.25rem !important;
            width: 20rem !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 0.875rem !important;
          }
          .plan-summary-card::before {
            content: '';
            position: absolute;
            top: 0; left: 8%; right: 8%;
            height: 1.5px;
            background: var(--specular-beam);
            pointer-events: none;
          }
          .plan-stat-pill {
            background: var(--surface-sunken) !important;
            box-shadow: var(--shadow-sunken) !important;
            padding: 0.875rem 1rem !important;
            border-radius: 14px !important;
            border: none !important;
            transition: all 0.2s ease !important;
            position: relative !important;
            overflow: hidden !important;
          }
          .plan-stat-pill.rev {
            background: radial-gradient(ellipse 90% 70% at 0% 50%, color-mix(in srgb, var(--status-positive) 14%, transparent), transparent 80%), var(--surface-sunken) !important;
          }
          .plan-stat-pill.exp {
            background: radial-gradient(ellipse 90% 70% at 0% 50%, color-mix(in srgb, var(--status-negative) 14%, transparent), transparent 80%), var(--surface-sunken) !important;
          }
          .plan-stat-pill.net-plan {
            background: radial-gradient(ellipse 90% 70% at 0% 50%, color-mix(in srgb, var(--action-fill) 16%, transparent), transparent 80%), var(--surface-sunken) !important;
          }
          .plan-stat-pill.net-act {
            background: radial-gradient(ellipse 90% 70% at 0% 50%, color-mix(in srgb, var(--status-info) 14%, transparent), transparent 80%), var(--surface-sunken) !important;
          }
          .plan-stat-label {
            font-size: var(--fs-xs) !important;
            color: var(--text-secondary) !important;
            font-weight: 800 !important;
            display: block !important;
            margin-bottom: 0.35rem !important;
          }
          .plan-stat-val {
            font-size: var(--fs-xl) !important;
            font-weight: 900 !important;
            display: block !important;
          }
          .plan-icon-btn {
            background: var(--status-negative-soft) !important;
            border: none !important;
            box-shadow: none !important;
            color: var(--status-negative) !important;
            width: 2.25rem !important;
            height: 2.25rem !important;
            min-height: 2.25rem !important;
            border-radius: 8px !important;
            display: inline-grid !important;
            place-items: center !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            margin: 0 auto !important;
          }
          .plan-icon-btn:hover {
            transform: scale(1.08) !important;
            background: color-mix(in srgb, var(--status-negative) 25%, transparent) !important;
          }
        `}</style>

        <div className="plan-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.9375rem' }}>
          <div style={{ display: 'flex', gap: '0.9375rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: '900', color: 'var(--text-primary)', fontSize: 'var(--fs-md)' }}>فترة الخطة:</div>
            <select aria-label="شهر الخطة" className="plan-control" value={logic.selectedMonth} onChange={e => logic.setSelectedMonth(Number(e.target.value))} style={{ ...planControlStyle, padding: '0 0.875rem' }}>
              {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>شهر {m}</option>)}
            </select>
            <select aria-label="سنة الخطة" className="plan-control" value={logic.selectedYear} onChange={e => logic.setSelectedYear(Number(e.target.value))} style={{ ...planControlStyle, padding: '0 0.875rem' }}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>سنة {y}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
            <button className="ent-button ent-success" onClick={handleExportToExcel}>
              <Download size={15} aria-hidden="true" />
              <span>تصدير إكسيل الاحترافي</span>
            </button>
            <button className="ent-button" onClick={() => window.print()}>
              <Printer size={15} aria-hidden="true" />
              <span>طباعة التقرير الورقي</span>
            </button>
            <button
              className="ent-button ent-primary"
              onClick={logic.savePlanToDB} 
              disabled={logic.isSaving}
            >
              <Save size={15} aria-hidden="true" />
              <span>{logic.isSaving ? 'جاري الحفظ...' : 'حفظ خطة الموازنة'}</span>
            </button>
          </div>
        </div>

        {logic.isLoading ? (
          <LoadingScreen message="جاري تحميل بنود الخطة من النظام..." fullScreen={false} />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5625rem', alignItems: 'flex-start' }}>
            
            {/* الجداول الأساسية التفاعلية */}
            <div style={{ flex: '1 1 520px', minWidth: 0 }}>
              {renderTable('إيرادات')}
              {renderTable('مصروفات')}
            </div>

            {/* 🛡️ كارت المخلص الجانبي (مؤمن ومحمي داخل no-print فلن يظهر في الطباعة أبداً) */}
            <div className="plan-summary-card">
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: 'var(--fs-lg)', color: 'var(--text-primary)' }}>ملخص الخطة والمستهدف</h3>
              
              <div className="plan-stat-pill rev">
                <span className="plan-stat-label">إجمالي الإيرادات المتوقعة</span>
                <span className="plan-stat-val" style={{ color: 'var(--status-positive)' }}>{formatCurrency(logic.totals.totalRevPlanned)}</span>
              </div>
              
              <div className="plan-stat-pill exp">
                <span className="plan-stat-label">إجمالي المصروفات المقدرة</span>
                <span className="plan-stat-val" style={{ color: 'var(--status-negative)' }}>{formatCurrency(logic.totals.totalExpPlanned)}</span>
              </div>

              <div className="plan-stat-pill net-plan">
                <span className="plan-stat-label">صافي الربح التقديري (المخطط)</span>
                <span className="plan-stat-val" style={{ color: logic.totals.netPlanned >= 0 ? 'var(--status-positive)' : 'var(--status-negative)' }}>
                  {formatCurrency(logic.totals.netPlanned)}
                </span>
              </div>

              <div className="plan-stat-pill net-act">
                <span className="plan-stat-label">صافي الربح الفعلي (المحقق الحقيقي)</span>
                <span className="plan-stat-val" style={{ color: logic.totals.netActual >= 0 ? 'var(--status-info)' : 'var(--status-negative)' }}>
                  {formatCurrency(logic.totals.netActual)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🖨️ قسم الطباعة الرسمي النظيف والمستقل (مخفي تماماً عن الشاشة ويظهر فقط في ورق المطبوعات) */}
      <div className="print-area phi-doc phi-print-own-header" style={{ display: 'none' }}>
         <style>{PHI_DOC_CSS}</style>
         <ReportOfficialHeader
            title="الخطة المالية والموازنة (Financial Plan & Budget)"
            subtitle={`كشف تفصيلي لشهر ${monthNameArabic} ${logic.selectedYear}`}
            badgeText="تقرير مالي معتمد • FINANCIAL REPORT"
            refLabel="رقم التقرير"
            reportRefCode={`BGT-${logic.selectedYear}-${String(logic.selectedMonth).padStart(2, '0')}`}
            currency={`${currencyName()} (${currencyCode()})`}
            compact
            details={[
               { label: 'الفترة', value: `${monthNameArabic} ${logic.selectedYear}` },
               { label: 'صافي الربح المستهدف', value: formatCurrency(logic.totals.netPlanned) },
               { label: 'صافي الربح المحقق', value: formatCurrency(logic.totals.netActual), accent: true },
            ]}
         />

         {/* جدول الإيرادات الورقي */}
         <table className="print-table">
            <thead>
               <tr>
                  <th colSpan={4} className="print-header-rev">قســم الإيـــــرادات العـامـة</th>
               </tr>
               <tr>
                  <th style={{ width: '45%' }}>اسم البند التفصيلي</th>
                  <th style={{ width: '18%' }}>المستهدف (المخطط)</th>
                  <th style={{ width: '18%' }}>المنفذ (الفعلي)</th>
                  <th style={{ width: '19%' }}>الانحراف المالي</th>
               </tr>
            </thead>
            <tbody>
               {logic.records.filter(r => r.category === 'إيرادات').map((r) => {
                 const variance = Number(r.actual_amount || 0) - Number(r.planned_amount || 0);
                 return (
                   <tr key={r.id}>
                     <td style={{ fontWeight: 800, paddingRight: '0.75rem' }}>{r.item_name}</td>
                     <td style={{ fontWeight: 700, textAlign: 'center' }}>{formatCurrency(r.planned_amount)}</td>
                     <td style={{ fontWeight: 700, textAlign: 'center' }}>{formatCurrency(r.actual_amount)}</td>
                     <td style={{ fontWeight: 900, direction: 'ltr', textAlign: 'center', color: variance >= 0 ? THEME.success : THEME.ruby }}>
                       {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                     </td>
                   </tr>
                 );
               })}
               <tr style={{ background: '#e2e8f0', fontWeight: 900 }}>
                  <td style={{ color: THEME.primary, paddingRight: '0.75rem' }}>إجمالي قسم الإيرادات الكلي:</td>
                  <td style={{ color: THEME.primary, textAlign: 'center' }}>{formatCurrency(logic.totals.totalRevPlanned)}</td>
                  <td style={{ color: THEME.primary, textAlign: 'center' }}>{formatCurrency(logic.totals.totalRevActual)}</td>
                  <td style={{ direction: 'ltr', textAlign: 'center', color: (logic.totals.totalRevActual - logic.totals.totalRevPlanned) >= 0 ? THEME.success : THEME.ruby }}>
                    {formatCurrency(logic.totals.totalRevActual - logic.totals.totalRevPlanned)}
                  </td>
               </tr>
            </tbody>
         </table>

         {/* جدول المصروفات الورقي */}
         <table className="print-table">
            <thead>
               <tr>
                  <th colSpan={4} className="print-header-exp">قســم المصــــروفات التشغيلية والعمومية</th>
               </tr>
               <tr>
                  <th style={{ width: '45%' }}>اسم البند التفصيلي</th>
                  <th style={{ width: '18%' }}>المقدر (المخطط)</th>
                  <th style={{ width: '18%' }}>المنصرف (الفعلي)</th>
                  <th style={{ width: '19%' }}>الانحراف المالي</th>
               </tr>
            </thead>
            <tbody>
               {logic.records.filter(r => r.category === 'مصروفات').map((r) => {
                 const variance = Number(r.actual_amount || 0) - Number(r.planned_amount || 0);
                 return (
                   <tr key={r.id}>
                     <td style={{ fontWeight: 800, paddingRight: '0.75rem' }}>{r.item_name}</td>
                     <td style={{ fontWeight: 700, textAlign: 'center' }}>{formatCurrency(r.planned_amount)}</td>
                     <td style={{ fontWeight: 700, textAlign: 'center' }}>{formatCurrency(r.actual_amount)}</td>
                     <td style={{ fontWeight: 900, direction: 'ltr', textAlign: 'center', color: variance <= 0 ? THEME.success : THEME.ruby }}>
                       {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                     </td>
                   </tr>
                 );
               })}
               <tr style={{ background: '#e2e8f0', fontWeight: 900 }}>
                  <td style={{ color: THEME.primary, paddingRight: '0.75rem' }}>إجمالي قسم المصروفات الكلي:</td>
                  <td style={{ color: THEME.primary, textAlign: 'center' }}>{formatCurrency(logic.totals.totalExpPlanned)}</td>
                  <td style={{ color: THEME.primary, textAlign: 'center' }}>{formatCurrency(logic.totals.totalExpActual)}</td>
                  <td style={{ direction: 'ltr', textAlign: 'center', color: (logic.totals.totalExpActual - logic.totals.totalExpPlanned) <= 0 ? THEME.success : THEME.ruby }}>
                    {formatCurrency(logic.totals.totalExpActual - logic.totals.totalExpPlanned)}
                  </td>
               </tr>
            </tbody>
         </table>

         {/* جدول ملخص الأرباح النهائي للطباعة */}
         <table className="print-table" style={{ marginTop: '1.5625rem', border: `2px solid ${THEME.primary}` }}>
            <tbody>
               <tr style={{ background: '#f8fafc' }}>
                  <th style={{ width: '45%', fontSize: 'var(--fs-md)', paddingRight: '0.75rem', background: '#f1f5f9', color: THEME.primary }}>صافي الربح التقديري المستهدف (المخطط له)</th>
                  <td style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: logic.totals.netPlanned >= 0 ? THEME.success : THEME.ruby, textAlign: 'center' }}>
                    {formatCurrency(logic.totals.netPlanned)}
                  </td>
               </tr>
               <tr style={{ background: '#f8fafc' }}>
                  <th style={{ width: '45%', fontSize: 'var(--fs-md)', paddingRight: '0.75rem', background: '#f1f5f9', color: THEME.primary }}>صافي الربح المالي المحقق الحقيقي (المنفذ الفعلي)</th>
                  <td style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: logic.totals.netActual >= 0 ? THEME.success : THEME.ruby, textAlign: 'center' }}>
                    {formatCurrency(logic.totals.netActual)}
                  </td>
               </tr>
            </tbody>
         </table>

         {/* ذيل اعتماد ومصادقة التقرير المالي */}
         <DocSignatures slots={[
            { title: 'أعدّه', en: 'Accountant' },
            { title: 'راجعه', en: 'Finance Manager' },
            { title: 'اعتمده', en: 'General Manager' },
         ]} />
      </div>

    </MasterPage>
  );
}
