import puppeteer from 'puppeteer';

/**
 * Generates an executive, branded PDF statement buffer for a worker or partner.
 */
export async function generateWorkerStatementPdf({
  workerName,
  startDate,
  endDate,
  logs = [],
  companyName = 'شركة فاي تك للمقاولات والحلول الهندسية',
}) {
  let browser = null;
  try {
    const totalWage = logs.reduce((sum, l) => sum + (Number(l.daily_wage) || 0), 0);
    const totalDays = logs.reduce((sum, l) => sum + (Number(l.attendance_value) || 0), 0);
    const totalQty = logs.reduce((sum, l) => sum + (Number(l.productivity) || 0), 0);
    const tareehaLogs = logs.filter((l) => Number(l.tareeha) > 0);
    const deficitCount = tareehaLogs.filter((l) => (Number(l.productivity) || 0) < Number(l.tareeha)).length;
    const avgCompliance = tareehaLogs.length > 0
      ? Math.round(((tareehaLogs.length - deficitCount) / tareehaLogs.length) * 100)
      : 100;

    const formattedStartDate = startDate || (logs.length > 0 ? logs[logs.length - 1].work_date : 'بداية العمل');
    const formattedEndDate = endDate || (logs.length > 0 ? logs[0].work_date : new Date().toISOString().split('T')[0]);

    const rowsHtml = logs.map((l, idx) => {
      const tareeha = Number(l.tareeha) || 0;
      const prod = Number(l.productivity) || 0;
      const isDeficit = tareeha > 0 && prod < tareeha;
      const statusBadge = tareeha === 0
        ? '<span style="color:#475569;">يومية عادية</span>'
        : isDeficit
          ? `<span style="color:#b91c1c; font-weight:700;">عجز ${(tareeha - prod).toFixed(1)} ${l.unit || 'م'}</span>`
          : '<span style="color:#15803d; font-weight:700;">محقق للطريحة</span>';

      return `
        <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 12px; text-align:center; color:#64748b; font-size:11px;">${idx + 1}</td>
          <td style="padding:10px 12px; font-weight:600; color:#1e293b;">${l.work_date || '-'}</td>
          <td style="padding:10px 12px; color:#334155;">${l.site_ref || 'عام'}</td>
          <td style="padding:10px 12px; color:#334155;">${l.work_item || 'أعمال مساعدة'}</td>
          <td style="padding:10px 12px; text-align:center; font-weight:600; color:#0f172a;">${l.attendance_value ?? 1}</td>
          <td style="padding:10px 12px; text-align:right; font-weight:700; color:#0f766e;">${Number(l.daily_wage || 0).toLocaleString()} ر.س</td>
          <td style="padding:10px 12px; text-align:center; color:#475569;">${tareeha > 0 ? `${tareeha} ${l.unit || ''}` : '-'}</td>
          <td style="padding:10px 12px; text-align:center; font-weight:600;">${prod > 0 ? `${prod} ${l.unit || ''}` : '-'}</td>
          <td style="padding:10px 12px; text-align:center;">${statusBadge}</td>
          <td style="padding:10px 12px; color:#64748b; font-size:11px;">${l.notes || l.production_desc || '-'}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>كشف حساب عامل — ${workerName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 24px;
      background: #ffffff;
      color: #1e293b;
      -webkit-print-color-adjust: exact;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f766e;
      margin: 0;
    }
    .doc-title {
      font-size: 16px;
      font-weight: 700;
      color: #334155;
      margin: 4px 0 0 0;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f1f5f9;
      padding: 16px;
      border-radius: 10px;
      margin-bottom: 24px;
    }
    .info-card {
      background: #ffffff;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      text-align: center;
    }
    .info-card .label {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .info-card .val {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
    }
    .val-highlight { color: #0f766e !important; }
    .val-danger { color: #dc2626 !important; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 12px;
    }
    th {
      background: #0f766e;
      color: #ffffff;
      padding: 10px 12px;
      font-weight: 700;
      text-align: right;
    }
    .footer-signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px dashed #cbd5e1;
      text-align: center;
    }
    .sig-box {
      font-size: 12px;
      font-weight: 700;
      color: #475569;
    }
    .sig-line {
      margin-top: 40px;
      border-top: 1px solid #94a3b8;
      width: 80%;
      margin-left: auto;
      margin-right: auto;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand-title">${companyName}</div>
      <div class="doc-title">كشف حساب وسجل يوميات وإنتاجية العامل</div>
    </div>
    <div style="text-align:left; font-size:11px; color:#64748b; line-height:1.6;">
      <div><b>العامل:</b> <span style="color:#0f766e; font-weight:700;">${workerName}</span></div>
      <div><b>الفترة:</b> من ${formattedStartDate} إلى ${formattedEndDate}</div>
      <div><b>تاريخ التقرير:</b> ${new Date().toLocaleDateString('ar-SA')}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-card">
      <div class="label">إجمالي الأجر المستحق</div>
      <div class="val val-highlight">${totalWage.toLocaleString()} ر.س</div>
    </div>
    <div class="info-card">
      <div class="label">إجمالي أيام الحضور</div>
      <div class="val">${totalDays} يوم</div>
    </div>
    <div class="info-card">
      <div class="label">إجمالي الإنتاجية</div>
      <div class="val">${totalQty.toLocaleString()} وحدة/متر</div>
    </div>
    <div class="info-card">
      <div class="label">نسبة الالتزام بالطريحة</div>
      <div class="val ${avgCompliance < 80 ? 'val-danger' : 'val-highlight'}">${avgCompliance}%</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:center; width:30px;">#</th>
        <th>التاريخ</th>
        <th>الموقع / الفيلا</th>
        <th>البند المنفذ</th>
        <th style="text-align:center;">الحضور</th>
        <th style="text-align:right;">اليومية</th>
        <th style="text-align:center;">الطريحة</th>
        <th style="text-align:center;">الإنتاجية</th>
        <th style="text-align:center;">موقف الطريحة</th>
        <th>ملاحظات</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="10" style="text-align:center; padding:24px; color:#94a3b8;">لا توجد سجلات مسجلة لهذا العامل في الفترة المحددة</td></tr>'}
    </tbody>
  </table>

  <div class="footer-signatures">
    <div class="sig-box">
      إعداد المحاسب المسؤول
      <div class="sig-line"></div>
    </div>
    <div class="sig-box">
      المهندس المشرف بالموقع
      <div class="sig-line"></div>
    </div>
    <div class="sig-box">
      توقيع / استلام العامل
      <div class="sig-line"></div>
    </div>
  </div>
</body>
</html>
    `;

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
    });

    return pdfBuffer;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Generates an executive, official Engineering Inspection Checklist PDF.
 */
export async function generateEngineeringChecklistPdf({
  title = 'استمارة فحص واستلام أعمال هندسية',
  projectName = 'مشروع الفلل السكنية',
  stageName = 'أعمال إنشائية',
  inspectorName = 'م. أحمد المشرف',
  contractorName = 'المقاول العام / مقاول الباطن',
  inspectionDate = new Date().toISOString().split('T')[0],
  status = 'معتمد بملاحظات',
  items = [],
  companyName = 'شركة فاي تك للمقاولات والحلول الهندسية',
}) {
  let browser = null;
  try {
    const checklistRows = items.map((item, idx) => {
      const itemTitle = typeof item === 'string' ? item : item.text || item.title;
      const itemStatus = (typeof item === 'object' && item.status) || 'مطابق';
      const notes = (typeof item === 'object' && item.notes) || 'تم الفحص الهندسي بالموقع ومطابقة المواصفات';
      
      const badgeStyle = itemStatus === 'مطابق'
        ? 'background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;'
        : itemStatus === 'مرفوض'
        ? 'background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;'
        : 'background:#f1f5f9; color:#475569; border:1px solid #e2e8f0;';

      return `
        <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 12px; text-align:center; font-weight:700; color:#64748b; font-size:12px;">${idx + 1}</td>
          <td style="padding:10px 12px; font-weight:600; color:#1e293b; font-size:13px; line-height:1.5;">${itemTitle}</td>
          <td style="padding:10px 12px; text-align:center;">
            <span style="display:inline-block; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:800; ${badgeStyle}">
              ${itemStatus}
            </span>
          </td>
          <td style="padding:10px 12px; color:#475569; font-size:12px;">${notes}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>${title} — ${projectName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 24px;
      background: #ffffff;
      color: #1e293b;
      -webkit-print-color-adjust: exact;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #b45309;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .company-name {
      font-size: 18px;
      font-weight: 900;
      color: #0f172a;
    }
    .sheet-title {
      font-size: 14px;
      font-weight: 700;
      color: #b45309;
      margin-top: 4px;
    }
    .doc-meta {
      text-align: left;
      font-size: 11px;
      color: #64748b;
    }
    .doc-badge {
      display: inline-block;
      background: #fef3c7;
      color: #92400e;
      padding: 4px 12px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 12px;
      margin-bottom: 4px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .meta-card {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 2px;
    }
    .meta-val {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
    }
    .decision-box {
      margin-bottom: 20px;
      padding: 12px 18px;
      border-radius: 8px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .decision-title {
      font-size: 13px;
      font-weight: 800;
      color: #166534;
    }
    .decision-desc {
      font-size: 12px;
      color: #15803d;
      margin-top: 2px;
    }
    .check-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 28px;
    }
    .check-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 10px 12px;
      font-size: 12px;
      font-weight: 800;
      text-align: right;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 30px;
      padding-top: 16px;
      border-top: 2px dashed #cbd5e1;
    }
    .sig-block {
      text-align: center;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
    }
    .sig-line {
      margin-top: 40px;
      border-bottom: 1px solid #94a3b8;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${companyName}</div>
      <div class="sheet-title">📋 ${title}</div>
    </div>
    <div class="doc-meta">
      <div class="doc-badge">مستند استلام رسمي معتمد</div>
      <div>تاريخ الفحص: <b>${inspectionDate}</b></div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-card">
      <span class="meta-label">المشروع / الموقع</span>
      <span class="meta-val">${projectName}</span>
    </div>
    <div class="meta-card">
      <span class="meta-label">البند / المرحلة</span>
      <span class="meta-val">${stageName}</span>
    </div>
    <div class="meta-card">
      <span class="meta-label">المهندس الفاحص</span>
      <span class="meta-val">${inspectorName}</span>
    </div>
    <div class="meta-card">
      <span class="meta-label">المقاول المنفذ</span>
      <span class="meta-val">${contractorName}</span>
    </div>
  </div>

  <div class="decision-box">
    <div>
      <div class="decision-title">قرار الفحص الهندسي: ${status}</div>
      <div class="decision-desc">تمت مراجعة الاشتراطات الهندسية ومطابقة المخططات الإنشائية والمعمارية المعتمدة بنجاح.</div>
    </div>
    <div style="font-weight:900; font-size:14px; color:#166534; padding:6px 14px; background:#dcfce7; border-radius:6px;">
      ✓ معتمد
    </div>
  </div>

  <table class="check-table">
    <thead>
      <tr>
        <th style="width:5%; text-align:center;">م</th>
        <th style="width:50%;">نقطة الفحص والاستلام الهندسي</th>
        <th style="width:15%; text-align:center;">الحالة</th>
        <th style="width:30%;">الملاحظات الهندسية وتوصيات الاستشاري</th>
      </tr>
    </thead>
    <tbody>
      ${checklistRows}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-block">
      مهندس التنفيذ بالموقع
      <div class="sig-line"></div>
    </div>
    <div class="sig-block">
      استشاري الإشراف الهندسي
      <div class="sig-line"></div>
    </div>
    <div class="sig-block">
      ممثل مقاول الباطن / المنفذ
      <div class="sig-line"></div>
    </div>
  </div>
</body>
</html>
    `;

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
    });

    return pdfBuffer;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
