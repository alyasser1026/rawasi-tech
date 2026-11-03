"use client";
import React, { useMemo } from 'react';
import { useFinancialPlanLogic } from './financial_plan_logic';
import MasterPage from '@/components/MasterPage';
import { formatCurrency } from '@/lib/helpers';
import * as XLSX from 'xlsx-js-style';
import LoadingScreen from '@/components/LoadingScreen';

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
    if (logic.records.length === 0) return alert("لا يوجد بيانات لتصديرها!");

    const revenues = logic.records.filter(r => r.category === 'إيرادات');
    const expenses = logic.records.filter(r => r.category === 'مصروفات');

    const aoa: any[] = [];
    
    // الصف 1: العنوان الرئيسي الملكي
    aoa.push([`كشف الخطة المالية والموازنة التقديرية التفصيلي - لشهـر: ${monthNameArabic} / لسنة ${logic.selectedYear}`]);
    // الصف 2: فارغ للنظافة البصرية
    aoa.push([]);

    // --- 🟢 قسم الإيرادات المتوقعة ---
    const revTitleIdx = aoa.length;
    aoa.push(['📈 الإيرادات المتوقعة (المستهدفة والمنفذة)']);
    
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
    aoa.push(['📉 المصروفات المقدرة (الموازنة والمنصرف الفعلي)']);
    
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
    aoa.push(['📊 خلاصة مقارنة الأداء وصافي الأرباح']);
    
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
      <div style={{ background: 'white', borderRadius: '12px', border: `1px solid ${THEME.border}`, marginBottom: '30px', overflow: 'hidden' }}>
        <div style={{ background: isRevenue ? '#ecfdf5' : '#fff1f2', padding: '15px 20px', borderBottom: `1px solid ${THEME.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: isRevenue ? THEME.success : THEME.ruby, fontSize: '18px', fontWeight: '900' }}>
            {isRevenue ? '📈 الإيرادات المتوقعة' : '📉 المصروفات المقدرة'}
          </h2>
          <button onClick={() => logic.addNewItem(category)} style={{ background: THEME.primary, color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            + إضافة بند
          </button>
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
          <thead style={{ background: THEME.slate, color: THEME.textMain, fontSize: '14px' }}>
            <tr>
              <th style={{ padding: '12px 15px', borderBottom: `1px solid ${THEME.border}` }}>اسم البند</th>
              <th style={{ padding: '12px 15px', borderBottom: `1px solid ${THEME.border}`, width: '150px' }}>المبلغ المخطط (مستهدف)</th>
              <th style={{ padding: '12px 15px', borderBottom: `1px solid ${THEME.border}`, width: '150px' }}>الفعلي (المنفذ)</th>
              <th style={{ padding: '12px 15px', borderBottom: `1px solid ${THEME.border}`, width: '150px' }}>نسبة الانحراف</th>
              <th style={{ padding: '12px 15px', borderBottom: `1px solid ${THEME.border}`, width: '60px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((r) => {
              const planned = Number(r.planned_amount) || 0;
              const actual = Number(r.actual_amount) || 0;
              const variance = actual - planned;
              
              let varianceColor = THEME.textMain;
              if (variance > 0) varianceColor = isRevenue ? THEME.success : THEME.ruby; 
              if (variance < 0) varianceColor = isRevenue ? THEME.ruby : THEME.success; 

              return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                  <td style={{ padding: '10px 15px' }}>
                    <input type="text" value={r.item_name} onChange={e => logic.updateRecord(r.id, 'item_name', e.target.value)} style={{ width: '100%', padding: '8px', border: `1px solid ${THEME.border}`, borderRadius: '6px', fontWeight: 'bold', color: THEME.textMain }} />
                  </td>
                  <td style={{ padding: '10px 15px' }}>
                    <input type="number" value={r.planned_amount === 0 ? '' : r.planned_amount} onChange={e => logic.updateRecord(r.id, 'planned_amount', e.target.value)} style={{ width: '100%', padding: '8px', border: `1px solid ${THEME.border}`, borderRadius: '6px', textAlign: 'center', fontWeight: 'bold' }} placeholder="0" />
                  </td>
                  <td style={{ padding: '10px 15px' }}>
                    <input type="number" value={r.actual_amount === 0 ? '' : r.actual_amount} onChange={e => logic.updateRecord(r.id, 'actual_amount', e.target.value)} style={{ width: '100%', padding: '8px', border: `1px solid ${THEME.border}`, borderRadius: '6px', textAlign: 'center', fontWeight: 'bold', background: '#f8fafc' }} placeholder="0" />
                  </td>
                  <td style={{ padding: '10px 15px', fontWeight: '900', color: varianceColor, textAlign: 'center', direction: 'ltr' }}>
                    {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                  </td>
                  <td style={{ padding: '10px 15px', textAlign: 'center' }}>
                    <button onClick={() => logic.removeItem(r.id)} style={{ background: 'transparent', border: 'none', color: THEME.ruby, cursor: 'pointer', fontSize: '16px' }}>🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
      <div className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '15px 20px', borderRadius: '12px', marginBottom: '20px', border: `1px solid ${THEME.border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div style={{ fontWeight: '900', color: THEME.primary, fontSize: '14px' }}>فترة الخطة:</div>
            <select value={logic.selectedMonth} onChange={e => logic.setSelectedMonth(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: '6px', border: `1px solid ${THEME.border}`, fontWeight: 'bold', color: THEME.textMain }}>
              {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>شهر {m}</option>)}
            </select>
            <select value={logic.selectedYear} onChange={e => logic.setSelectedYear(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: '6px', border: `1px solid ${THEME.border}`, fontWeight: 'bold', color: THEME.textMain }}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>سنة {y}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handleExportToExcel}
              style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              📥 تصدير إكسيل الاحترافي
            </button>
            <button 
              onClick={() => window.print()}
              style={{ padding: '10px 20px', borderRadius: '8px', border: `1px solid ${THEME.border}`, background: THEME.slate, color: THEME.textMain, fontWeight: 'bold', cursor: 'pointer' }}
            >
              🖨️ طباعة التقرير الورقي
            </button>
            <button 
              onClick={logic.savePlanToDB} 
              disabled={logic.isSaving}
              style={{ padding: '10px 25px', borderRadius: '8px', border: 'none', background: THEME.primary, color: 'white', fontWeight: 'bold', cursor: logic.isSaving ? 'not-allowed' : 'pointer', opacity: logic.isSaving ? 0.7 : 1 }}
            >
              {logic.isSaving ? '⏳ جاري الحفظ...' : '💾 حفظ خطة الموازنة'}
            </button>
          </div>
        </div>

        {logic.isLoading ? (
          <LoadingScreen message="جاري تحميل بنود الخطة من النظام..." fullScreen={false} />
        ) : (
          <div style={{ display: 'flex', gap: '25px', alignItems: 'flex-start' }}>
            
            {/* الجداول الأساسية التفاعلية */}
            <div style={{ flex: 1 }}>
              {renderTable('إيرادات')}
              {renderTable('مصروفات')}
            </div>

            {/* 🛡️ كارت المخلص الجانبي (مؤمن ومحمي داخل no-print فلن يظهر في الطباعة أبداً) */}
            <div style={{ width: '320px', background: THEME.primary, borderRadius: '12px', padding: '20px', color: 'white', position: 'sticky', top: '20px', boxShadow: '0 10px 25px rgba(15,23,42,0.08)' }}>
              <h3 style={{ margin: '0 0 20px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', fontWeight: 900, fontSize: '15px' }}>📊 ملخص الخطة والمستهدف</h3>
              
              <div style={{ marginBottom: '15px' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>إجمالي الإيرادات المتوقعة</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#34d399' }}>{formatCurrency(logic.totals.totalRevPlanned)}</div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>إجمالي المصروفات المقدرة</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#fca5a5' }}>{formatCurrency(logic.totals.totalExpPlanned)}</div>
              </div>

              <div style={{ margin: '15px 0', borderTop: '1px dashed rgba(255,255,255,0.15)' }}></div>

              <div style={{ marginBottom: '15px' }}>
                <div style={{ fontSize: '13px', color: 'white', fontWeight: 'bold' }}>صافي الربح التقديري (المخطط)</div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: logic.totals.netPlanned >= 0 ? '#34d399' : '#f87171' }}>
                  {formatCurrency(logic.totals.netPlanned)}
                </div>
              </div>

              <div style={{ margin: '15px 0', borderTop: '1px dashed rgba(255,255,255,0.15)' }}></div>

              <div style={{ marginBottom: '5px' }}>
                <div style={{ fontSize: '13px', color: 'white', fontWeight: 'bold' }}>صافي الربح الفعلي (المحقق الحقيقي)</div>
                <div style={{ fontSize: '22px', fontWeight: '900', color: logic.totals.netActual >= 0 ? '#60a5fa' : '#f87171' }}>
                  {formatCurrency(logic.totals.netActual)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🖨️ قسم الطباعة الرسمي النظيف والمستقل (مخفي تماماً عن الشاشة ويظهر فقط في ورق المطبوعات) */}
      <div className="print-area" style={{ display: 'none' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `4px solid ${THEME.primary}`, paddingBottom: '12px', marginBottom: '25px' }}>
            <div>
               
               <p style={{ margin: '6px 0 0 0', fontWeight: 800, fontSize: '14px', color: THEME.textMain }}>شركة فاي تك للمقاولات | كشف تفصيلي لشهر: ({monthNameArabic} / {logic.selectedYear})</p>
            </div>
            <img src="/company-logo.svg" alt=" RY Logo" style={{ height: '55px', objectFit: 'contain' }} />
         </div>

         {/* جدول الإيرادات الورقي */}
         <table className="print-table">
            <thead>
               <tr>
                  <th colSpan={4} className="print-header-rev">📊 قســم الإيـــــرادات العـامـة</th>
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
                     <td style={{ fontWeight: 800, paddingRight: '12px' }}>{r.item_name}</td>
                     <td style={{ fontWeight: 700, textAlign: 'center' }}>{formatCurrency(r.planned_amount)}</td>
                     <td style={{ fontWeight: 700, textAlign: 'center' }}>{formatCurrency(r.actual_amount)}</td>
                     <td style={{ fontWeight: 900, direction: 'ltr', textAlign: 'center', color: variance >= 0 ? THEME.success : THEME.ruby }}>
                       {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                     </td>
                   </tr>
                 );
               })}
               <tr style={{ background: '#e2e8f0', fontWeight: 900 }}>
                  <td style={{ color: THEME.primary, paddingRight: '12px' }}>إجمالي قسم الإيرادات الكلي:</td>
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
                  <th colSpan={4} className="print-header-exp">💸 قســم المصــــروفات التشغيلية والعمومية</th>
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
                     <td style={{ fontWeight: 800, paddingRight: '12px' }}>{r.item_name}</td>
                     <td style={{ fontWeight: 700, textAlign: 'center' }}>{formatCurrency(r.planned_amount)}</td>
                     <td style={{ fontWeight: 700, textAlign: 'center' }}>{formatCurrency(r.actual_amount)}</td>
                     <td style={{ fontWeight: 900, direction: 'ltr', textAlign: 'center', color: variance <= 0 ? THEME.success : THEME.ruby }}>
                       {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                     </td>
                   </tr>
                 );
               })}
               <tr style={{ background: '#e2e8f0', fontWeight: 900 }}>
                  <td style={{ color: THEME.primary, paddingRight: '12px' }}>إجمالي قسم المصروفات الكلي:</td>
                  <td style={{ color: THEME.primary, textAlign: 'center' }}>{formatCurrency(logic.totals.totalExpPlanned)}</td>
                  <td style={{ color: THEME.primary, textAlign: 'center' }}>{formatCurrency(logic.totals.totalExpActual)}</td>
                  <td style={{ direction: 'ltr', textAlign: 'center', color: (logic.totals.totalExpActual - logic.totals.totalExpPlanned) <= 0 ? THEME.success : THEME.ruby }}>
                    {formatCurrency(logic.totals.totalExpActual - logic.totals.totalExpPlanned)}
                  </td>
               </tr>
            </tbody>
         </table>

         {/* جدول ملخص الأرباح النهائي للطباعة */}
         <table className="print-table" style={{ marginTop: '25px', border: `2px solid ${THEME.primary}` }}>
            <tbody>
               <tr style={{ background: '#f8fafc' }}>
                  <th style={{ width: '45%', fontSize: '14px', paddingRight: '12px', background: '#f1f5f9', color: THEME.primary }}>صافي الربح التقديري المستهدف (المخطط له)</th>
                  <td style={{ fontSize: '16px', fontWeight: 900, color: logic.totals.netPlanned >= 0 ? THEME.success : THEME.ruby, textAlign: 'center' }}>
                    {formatCurrency(logic.totals.netPlanned)}
                  </td>
               </tr>
               <tr style={{ background: '#f8fafc' }}>
                  <th style={{ width: '45%', fontSize: '14px', paddingRight: '12px', background: '#f1f5f9', color: THEME.primary }}>صافي الربح المالي المحقق الحقيقي (المنفذ الفعلي)</th>
                  <td style={{ fontSize: '16px', fontWeight: 900, color: logic.totals.netActual >= 0 ? THEME.success : THEME.ruby, textAlign: 'center' }}>
                    {formatCurrency(logic.totals.netActual)}
                  </td>
               </tr>
            </tbody>
         </table>

         {/* ذيل اعتماد ومصادقة التقرير المالي */}
         <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', fontSize: '13px', fontWeight: 800, padding: '0 20px' }}>
             <div style={{textAlign: 'center', width: '180px'}}>أعده / المحاسب المالي<br/><br/><hr style={{borderTop: '2px dashed #94a3b8', margin: '25px 0 10px 0'}}/>الاسم والتوقيع</div>
             <div style={{textAlign: 'center', width: '180px'}}>راجعه / المدير المالي<br/><br/><hr style={{borderTop: '2px dashed #94a3b8', margin: '25px 0 10px 0'}}/>الاسم والتوقيع</div>
             <div style={{textAlign: 'center', width: '180px'}}>اعتمده / المدير العام<br/><br/><hr style={{borderTop: '2px dashed #94a3b8', margin: '25px 0 10px 0'}}/>الاسم والتوقيع</div>
         </div>
      </div>

    </MasterPage>
  );
}