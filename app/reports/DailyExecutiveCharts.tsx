"use client";
import React from 'react';
import { formatCurrency } from '@/lib/helpers';

export interface DailyTrendPoint {
  date: string;
  shortLabel: string;
  cashIn: number;
  cashOut: number;
  expensesTotal: number;
  laborCost: number;
  workersCount: number;
  isSelected: boolean;
}

export interface DailyVillaSummary {
  projectId: string;
  projectName: string;
  unitType: string;
  workersCount: number;
  workerNames: string[];
  laborDays: number;
  laborCost: number;
  directExpensesCost: number;
  abcExpensesCost: number;
  materialsCost: number;
  claimsCost: number;
  cashIn: number;
  cashOut: number;
  totalOperationalCost: number;
}

export interface DailyCategorySlice {
  label: string;
  value: number;
  color: string;
}

export interface DailyReportModel {
  selectedDate: string;
  weekdayLabel: string;
  selectedProjectLabel: string;
  // حركة الخزينة والأرصدة
  treasuryOpeningBalance: number;
  cashIn: number;
  cashOut: number;
  netCash: number;
  treasuryBalanceEndOfDay: number;
  treasuryCurrentTotal: number;
  // المستحقات المسددة اليوم وتفصيل الصرف
  workersPaidToday: number;
  workersPaidCount: number;
  claimsPaidToday: number;
  claimsPaidCount: number;
  expensesPaidToday: number;
  expensesPaidCount: number;
  generalPaidToday: number;
  settledDuesToday: number;
  // المصروفات والعمالة
  expensesTotal: number;
  directCashExpensesUnlinked: number;
  laborTotal: number;
  laborDays: number;
  distinctWorkersCount: number;
  // الخامات الموردة والمنصرفة والمستخلصات
  materialIssuesTotal: number;
  materialIssuesCount: number;
  materialIssuesLinesCount: number;
  materialReceiptsTotal: number;
  materialReceiptsCount: number;
  materialReceiptsCompanyTotal: number;
  materialReceiptsClientTotal: number;
  materialReceiptsLinesCount: number;
  subClaimsTotal: number;
  materialsAndClaimsTotal: number;
  totalDailyOperationsCost: number;
  activeVillasCount: number;
  // الحركات التفصيلية اليوم
  receipts: any[];
  payments: any[];
  laborLogs: any[];
  expenses: any[];
  materialIssues: any[];
  materialReceipts: any[];
  subClaims: any[];
  activeVillas: DailyVillaSummary[];
  // الحركات الجديدة والركوستات والتسليمات اليوم
  newVillasToday: any[];
  newBoqItemsToday: any[];
  newBoqTotalValue: number;
  newJobOrdersToday: any[];
  newJobOrdersTotalValue: number;
  newSubcontractorAssignmentsToday: any[];
  newSubcontractorAssignmentsValue: number;
  openRequestsToday: any[];
  handoversToday: any[];
  siteVisitsToday: any[];
  // بيانات الرسوم البيانية
  expenseCategories: DailyCategorySlice[];
  costComposition: DailyCategorySlice[];
  trend7Days: DailyTrendPoint[];
}

function round2(n: number) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function fmtShort(val: number): string {
  const n = Number(val) || 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 100_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  if (abs >= 10_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  if (Number.isInteger(abs)) return `${sign}${abs.toLocaleString('en-US')}`;
  return `${sign}${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function getDailyChartTheme(variant: 'web' | 'print') {
  const isPrint = variant === 'print';
  return {
    isPrint,
    ink: isPrint ? '#0f172a' : 'var(--text-primary)',
    sub: isPrint ? '#475569' : 'var(--text-secondary)',
    muted: isPrint ? '#64748b' : 'var(--text-muted)',
    grid: isPrint ? '#e2e8f0' : 'rgba(148, 163, 184, 0.22)',
    zeroLine: isPrint ? '#94a3b8' : 'rgba(148, 163, 184, 0.55)',
    trackBg: isPrint ? '#e2e8f0' : 'rgba(148, 163, 184, 0.16)',
    cardStyle: (isPrint
      ? {
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          border: 'none',
          borderRadius: '10px',
          padding: '10px 12px',
          marginBottom: '10px',
          breakInside: 'avoid',
          pageBreakInside: 'avoid',
          color: '#0f172a',
        }
      : {
          background: 'var(--surface-card)',
          border: 'none',
          borderRadius: '18px',
          padding: '1.15rem 1.35rem',
          marginBottom: '1.25rem',
          boxShadow: 'var(--shadow-ambient)',
          color: 'var(--text-primary)',
        }) as React.CSSProperties,
    subCardStyle: (isPrint
      ? {
          background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
          border: 'none',
          borderRadius: '8px',
          padding: '9px 11px',
          minWidth: 0,
        }
      : {
          background: 'var(--surface-sunken)',
          border: 'none',
          borderRadius: '14px',
          padding: '0.95rem 1.05rem',
          minWidth: 0,
        }) as React.CSSProperties,
    titleSize: isPrint ? '10.5px' : 'var(--fs-md)',
    subSize: isPrint ? '8.5px' : 'var(--fs-xs)',
    svgFont: "'Cairo', 'Tajawal', 'Segoe UI', Tahoma, sans-serif",
  };
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeDonutArc(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
) {
  const sweep = Math.min(359.99, Math.max(0, endAngle - startAngle));
  const eAngle = startAngle + sweep;
  const oStart = polarToCartesian(cx, cy, rOuter, startAngle);
  const oEnd = polarToCartesian(cx, cy, rOuter, eAngle);
  const iEnd = polarToCartesian(cx, cy, rInner, eAngle);
  const iStart = polarToCartesian(cx, cy, rInner, startAngle);
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${iStart.x} ${iStart.y}`,
    'Z',
  ].join(' ');
}

export function DailyExecutiveCharts({
  data,
  variant = 'web',
}: {
  data: DailyReportModel;
  variant?: 'web' | 'print';
}) {
  const th = getDailyChartTheme(variant);
  const isPrint = th.isPrint;

  // 1) بيانات الرسم الأول: ميزان الفلوس والخزينة والعمالة والخامات لليوم (7 أعمدة)
  const flowBars = [
    { label: 'الداخل (قبض)', sub: `${data.receipts.length} سند`, value: data.cashIn, color: '#10b981' },
    { label: 'الصرف (خارج)', sub: `${data.payments.length} سند`, value: data.cashOut, color: '#f43f5e' },
    { label: 'صرف العمالة', sub: `${data.workersPaidCount} سند`, value: data.workersPaidToday, color: '#0ea5e9' },
    { label: 'مصروفات اليوم', sub: `${data.expenses.length} مصروف`, value: data.expensesTotal, color: '#f59e0b' },
    { label: 'خامات موردة', sub: `${data.materialReceiptsCount} إذن`, value: data.materialReceiptsTotal, color: '#0284c7' },
    { label: 'خامات منصرفة', sub: `${data.materialIssuesCount} إذن`, value: data.materialIssuesTotal, color: '#8b5cf6' },
    {
      label: 'صافي الخزينة',
      sub: data.netCash >= 0 ? 'فائض اليوم' : 'عجز اليوم',
      value: data.netCash,
      color: data.netCash >= 0 ? '#059669' : '#e11d48',
    },
  ];

  const barMax = Math.max(1, ...flowBars.map((b) => Math.max(0, b.value)));
  const barMin = Math.min(0, ...flowBars.map((b) => Math.min(0, b.value)));
  const barSpan = Math.max(1, barMax - barMin);

  const svgW = 580;
  const svgH = isPrint ? 190 : 215;
  const padL = 16;
  const padR = 16;
  const padT = 26;
  const padB = 44;
  const plotH = svgH - padT - padB;
  const zeroY = padT + (barMax / barSpan) * plotH;
  const colW = (svgW - padL - padR) / flowBars.length;

  // 2) بيانات الرسم الثاني: مسار آخر 7 أيام (الداخل vs المنصرف والمصروفات + منحنى العمالة)
  const trend = data.trend7Days || [];
  const tSvgW = 540;
  const tSvgH = isPrint ? 190 : 215;
  const tPadL = 22;
  const tPadR = 22;
  const tPadT = 32;
  const tPadB = 34;
  const tPlotW = tSvgW - tPadL - tPadR;
  const tPlotH = tSvgH - tPadT - tPadB;
  const tMaxMoney = Math.max(
    1,
    ...trend.flatMap((pt) => [pt.cashIn, pt.cashOut, pt.expensesTotal, pt.laborCost])
  );
  const tMaxWorkers = Math.max(1, ...trend.map((pt) => pt.workersCount));
  const tSlotW = trend.length > 0 ? tPlotW / trend.length : tPlotW;

  const workerPolylinePts = trend
    .map((pt, idx) => {
      const cx = tPadL + idx * tSlotW + tSlotW / 2;
      const cy = tPadT + 8 + (1 - pt.workersCount / tMaxWorkers) * (tPlotH * 0.42);
      return `${cx.toFixed(1)},${cy.toFixed(1)}`;
    })
    .join(' ');

  // 3) بيانات الرسم الثالث: أعلى 8 فلل نشطة اليوم
  const topVillas = (data.activeVillas || []).slice(0, 8);
  const maxVillaCost = Math.max(1, ...topVillas.map((v) => v.totalOperationalCost));

  // 4) بيانات الرسم الرابع: هيكل المصروفات (أو هيكل التكاليف اليوم)
  const useExpenseCats = (data.expenseCategories || []).some((s) => s.value > 0);
  const rawSlices = useExpenseCats ? data.expenseCategories : data.costComposition;
  const donutSlices = (rawSlices || []).filter((s) => s.value > 0);
  const donutTotal = round2(donutSlices.reduce((s, it) => s + it.value, 0));

  let angleCursor = 0;
  const computedArcs = donutSlices.map((slice) => {
    const share = donutTotal > 0 ? slice.value / donutTotal : 0;
    const sweep = share * 360;
    const start = angleCursor;
    const end = angleCursor + sweep;
    angleCursor = end;
    return {
      ...slice,
      pct: Math.round(share * 1000) / 10,
      path: describeDonutArc(90, 90, 74, 46, start, end),
    };
  });

  return (
    <div style={th.cardStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: isPrint ? '8px' : '0.95rem',
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: isPrint ? '12px' : 'var(--fs-lg)',
              fontWeight: 900,
              color: th.ink,
            }}
          >
            لوحة المؤشرات والرسوم البيانية اليومية — {data.weekdayLabel} ({data.selectedDate})
          </h3>
          <p
            style={{
              margin: '2px 0 0',
              fontSize: th.subSize,
              color: th.sub,
              fontWeight: 700,
            }}
          >
            النطاق: {data.selectedProjectLabel} • الخزينة المتبقية والداخل والمنصرف وصرف العمالة والخامات الموردة والمنصرفة
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            fontSize: th.subSize,
            fontWeight: 800,
          }}
        >
          <span
            style={{
              padding: '3px 9px',
              borderRadius: '999px',
              background:
                data.treasuryBalanceEndOfDay >= 0
                  ? 'rgba(5, 150, 105, 0.16)'
                  : 'rgba(225, 29, 72, 0.14)',
              color: data.treasuryBalanceEndOfDay >= 0 ? '#059669' : '#e11d48',
              fontWeight: 900,
            }}
          >
            رصيد الخزينة المتبقي: {formatCurrency(data.treasuryBalanceEndOfDay)}
          </span>
          <span
            style={{
              padding: '3px 9px',
              borderRadius: '999px',
              background: 'rgba(16, 185, 129, 0.14)',
              color: '#059669',
            }}
          >
            الداخل: {formatCurrency(data.cashIn)}
          </span>
          <span
            style={{
              padding: '3px 9px',
              borderRadius: '999px',
              background: 'rgba(244, 63, 94, 0.14)',
              color: '#e11d48',
            }}
          >
            الصرف: {formatCurrency(data.cashOut)}
          </span>
          <span
            style={{
              padding: '3px 9px',
              borderRadius: '999px',
              background: 'rgba(59, 130, 246, 0.14)',
              color: '#2563eb',
            }}
          >
            العمالة: {data.distinctWorkersCount} عامل ({formatCurrency(data.laborTotal)})
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isPrint
            ? 'repeat(2, minmax(0, 1fr))'
            : 'repeat(auto-fit, minmax(26rem, 1fr))',
          gap: isPrint ? '9px' : '0.95rem',
        }}
      >
        {/* 1️⃣ ميزان الفلوس وصرف العمالة والخامات لليوم */}
        <div style={th.subCardStyle}>
          <div style={{ marginBottom: '6px' }}>
            <div style={{ fontSize: th.titleSize, fontWeight: 900, color: th.ink }}>
              1. ميزان الخزينة وصرف العمالة والخامات لليوم
            </div>
            <div style={{ fontSize: th.subSize, color: th.muted, fontWeight: 700 }}>
              الداخل، الصرف، المصروف للعمالة، المصروفات، الخامات الموردة والمنصرفة، وصافي اليوم
            </div>
          </div>
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            style={{ width: '100%', height: 'auto', display: 'block', fontFamily: th.svgFont }}
            role="img"
            aria-label="رسم بياني للتدفق المالي والخامات والعمالة اليومي"
          >
            <line
              x1={padL}
              y1={zeroY}
              x2={svgW - padR}
              y2={zeroY}
              stroke={th.zeroLine}
              strokeWidth="1.2"
              strokeDasharray="4 3"
            />
            {flowBars.map((b, i) => {
              const cx = padL + i * colW + colW / 2;
              const bw = Math.min(40, colW * 0.56);
              const hVal = (Math.abs(b.value) / barSpan) * plotH;
              const y = b.value >= 0 ? zeroY - hVal : zeroY;
              const textY = b.value >= 0 ? Math.max(12, y - 6) : Math.min(svgH - 22, y + hVal + 12);

              return (
                <g key={b.label}>
                  <rect
                    x={cx - bw / 2}
                    y={b.value === 0 ? zeroY - 2 : y}
                    width={bw}
                    height={Math.max(2, hVal)}
                    rx="5"
                    fill={b.color}
                    fillOpacity="0.88"
                  />
                  <text
                    x={cx}
                    y={textY}
                    textAnchor="middle"
                    fill={th.ink}
                    fontSize="9.5"
                    fontWeight="900"
                  >
                    {fmtShort(b.value)}
                  </text>
                  <text
                    x={cx}
                    y={svgH - 20}
                    textAnchor="middle"
                    fill={th.ink}
                    fontSize="8.8"
                    fontWeight="800"
                  >
                    {b.label}
                  </text>
                  <text
                    x={cx}
                    y={svgH - 7}
                    textAnchor="middle"
                    fill={th.muted}
                    fontSize="8"
                    fontWeight="700"
                  >
                    {b.sub}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 2️⃣ مسار آخر 7 أيام */}
        <div style={th.subCardStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '4px',
              marginBottom: '6px',
            }}
          >
            <div>
              <div style={{ fontSize: th.titleSize, fontWeight: 900, color: th.ink }}>
                2. المسار اليومي خلال آخر 7 أيام
              </div>
              <div style={{ fontSize: th.subSize, color: th.muted, fontWeight: 700 }}>
                تطور الفلوس الداخلة والخارجة والمصروفات مع منحنى عدد العمال يومياً
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', fontSize: '9.5px', fontWeight: 800, flexWrap: 'wrap' }}>
              <span style={{ color: '#10b981' }}>■ داخل</span>
              <span style={{ color: '#f43f5e' }}>■ صرف</span>
              <span style={{ color: '#f59e0b' }}>■ مصروف</span>
              <span style={{ color: '#0284c7' }}>● عمال</span>
            </div>
          </div>
          <svg
            viewBox={`0 0 ${tSvgW} ${tSvgH}`}
            style={{ width: '100%', height: 'auto', display: 'block', fontFamily: th.svgFont }}
            role="img"
            aria-label="رسم بياني لمسار التدفقات والعمالة خلال 7 أيام"
          >
            {[0.25, 0.5, 0.75, 1].map((g) => {
              const gy = tPadT + tPlotH * (1 - g);
              return (
                <line
                  key={g}
                  x1={tPadL}
                  y1={gy}
                  x2={tSvgW - tPadR}
                  y2={gy}
                  stroke={th.grid}
                  strokeWidth="1"
                />
              );
            })}
            <line
              x1={tPadL}
              y1={tPadT + tPlotH}
              x2={tSvgW - tPadR}
              y2={tPadT + tPlotH}
              stroke={th.zeroLine}
              strokeWidth="1.2"
            />

            {trend.map((pt, idx) => {
              const slotX = tPadL + idx * tSlotW;
              const cx = slotX + tSlotW / 2;
              const baseY = tPadT + tPlotH;
              const barW = Math.min(13, tSlotW * 0.22);

              const inH = (pt.cashIn / tMaxMoney) * (tPlotH * 0.85);
              const outH = (pt.cashOut / tMaxMoney) * (tPlotH * 0.85);
              const expH = (pt.expensesTotal / tMaxMoney) * (tPlotH * 0.85);

              return (
                <g key={pt.date}>
                  {pt.isSelected && (
                    <rect
                      x={slotX + 3}
                      y={tPadT - 12}
                      width={Math.max(4, tSlotW - 6)}
                      height={tPlotH + 14}
                      rx="8"
                      fill="rgba(249, 115, 22, 0.1)"
                    />
                  )}
                  <rect
                    x={cx - barW * 1.65}
                    y={baseY - Math.max(2, inH)}
                    width={barW}
                    height={Math.max(2, inH)}
                    rx="3"
                    fill="#10b981"
                    fillOpacity={pt.cashIn > 0 ? 0.9 : 0.2}
                  />
                  <rect
                    x={cx - barW * 0.45}
                    y={baseY - Math.max(2, outH)}
                    width={barW}
                    height={Math.max(2, outH)}
                    rx="3"
                    fill="#f43f5e"
                    fillOpacity={pt.cashOut > 0 ? 0.9 : 0.2}
                  />
                  <rect
                    x={cx + barW * 0.75}
                    y={baseY - Math.max(2, expH)}
                    width={barW}
                    height={Math.max(2, expH)}
                    rx="3"
                    fill="#f59e0b"
                    fillOpacity={pt.expensesTotal > 0 ? 0.9 : 0.2}
                  />
                  <text
                    x={cx}
                    y={tSvgH - 16}
                    textAnchor="middle"
                    fill={pt.isSelected ? '#ea580c' : th.ink}
                    fontSize="9.5"
                    fontWeight={pt.isSelected ? '900' : '700'}
                  >
                    {pt.shortLabel}
                  </text>
                  <text
                    x={cx}
                    y={tSvgH - 4}
                    textAnchor="middle"
                    fill={th.muted}
                    fontSize="8"
                    fontWeight="700"
                  >
                    {pt.date.slice(5)}
                  </text>
                </g>
              );
            })}

            {trend.length > 1 && (
              <polyline
                fill="none"
                stroke="#0284c7"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={workerPolylinePts}
              />
            )}

            {trend.map((pt, idx) => {
              const cx = tPadL + idx * tSlotW + tSlotW / 2;
              const cy = tPadT + 8 + (1 - pt.workersCount / tMaxWorkers) * (tPlotH * 0.42);
              return (
                <g key={`w-${pt.date}`}>
                  <circle cx={cx} cy={cy} r="4.2" fill="#0284c7" />
                  <circle cx={cx} cy={cy} r="2" fill="#ffffff" />
                  <text
                    x={cx}
                    y={cy - 8}
                    textAnchor="middle"
                    fill="#0284c7"
                    fontSize="9"
                    fontWeight="900"
                  >
                    {pt.workersCount}ع
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 3️⃣ توزيع التشغيل والعمالة على الفلل النشطة اليوم */}
        <div style={th.subCardStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '4px',
              marginBottom: '8px',
            }}
          >
            <div>
              <div style={{ fontSize: th.titleSize, fontWeight: 900, color: th.ink }}>
                3. الفلل التي اشتغلنا فيها اليوم ({data.activeVillasCount})
              </div>
              <div style={{ fontSize: th.subSize, color: th.muted, fontWeight: 700 }}>
                تكلفة العمالة + المصروفات المباشرة والموزعة (ABC) + الخامات والمستخلصات بكل فيلا
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', fontSize: '9.5px', fontWeight: 800 }}>
              <span style={{ color: '#3b82f6' }}>■ عمالة</span>
              <span style={{ color: '#f59e0b' }}>■ مصروفات</span>
              <span style={{ color: '#8b5cf6' }}>■ خامات/مقاولين</span>
            </div>
          </div>

          {topVillas.length === 0 ? (
            <div
              style={{
                padding: '1.6rem 1rem',
                textAlign: 'center',
                color: th.muted,
                fontSize: th.subSize,
                fontWeight: 800,
              }}
            >
              لا توجد حركة تشغيلية مسجلة على الفلل في هذا اليوم ({data.selectedDate})
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isPrint ? '6px' : '0.55rem' }}>
              {topVillas.map((v) => {
                const expTotal = round2(v.directExpensesCost + v.abcExpensesCost);
                const matClaimTotal = round2(v.materialsCost + v.claimsCost);
                const laborPct = (v.laborCost / maxVillaCost) * 100;
                const expPct = (expTotal / maxVillaCost) * 100;
                const matPct = (matClaimTotal / maxVillaCost) * 100;

                return (
                  <div key={v.projectId}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: isPrint ? '9.5px' : 'var(--fs-xs)',
                        fontWeight: 800,
                        marginBottom: '3px',
                      }}
                    >
                      <span style={{ color: th.ink, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>{v.projectName}</span>
                        {v.workersCount > 0 && (
                          <span
                            style={{
                              padding: '1px 7px',
                              borderRadius: '999px',
                              background: 'rgba(59, 130, 246, 0.14)',
                              color: '#2563eb',
                              fontSize: isPrint ? '8.5px' : '11px',
                            }}
                          >
                            {v.workersCount} عامل
                          </span>
                        )}
                      </span>
                      <span style={{ color: th.ink, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(v.totalOperationalCost)}
                      </span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: isPrint ? '9px' : '11px',
                        borderRadius: '999px',
                        background: th.trackBg,
                        overflow: 'hidden',
                        display: 'flex',
                      }}
                    >
                      {laborPct > 0 && (
                        <div style={{ width: `${laborPct}%`, background: '#3b82f6', height: '100%' }} />
                      )}
                      {expPct > 0 && (
                        <div style={{ width: `${expPct}%`, background: '#f59e0b', height: '100%' }} />
                      )}
                      {matPct > 0 && (
                        <div style={{ width: `${matPct}%`, background: '#8b5cf6', height: '100%' }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4️⃣ هيكل مصروفات وتكاليف اليوم (Donut Chart) */}
        <div style={th.subCardStyle}>
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: th.titleSize, fontWeight: 900, color: th.ink }}>
              4. {useExpenseCats ? 'تحليل تصنيفات مصروفات اليوم' : 'توزيع هيكل التكلفة والتشغيل اليوم'}
            </div>
            <div style={{ fontSize: th.subSize, color: th.muted, fontWeight: 700 }}>
              {useExpenseCats
                ? `توزيع إجمالي المصروفات (${formatCurrency(data.expensesTotal)}) حسب التصنيف`
                : 'توزيع إنفاق اليوم بين العمالة والمصروفات والخامات والمستخلصات وسندات الصرف'}
            </div>
          </div>

          {donutSlices.length === 0 ? (
            <div
              style={{
                padding: '1.6rem 1rem',
                textAlign: 'center',
                color: th.muted,
                fontSize: th.subSize,
                fontWeight: 800,
              }}
            >
              لا توجد مصروفات أو تكاليف تشغيلية مسجلة في هذا اليوم ({data.selectedDate})
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '155px 1fr',
                gap: '0.75rem',
                alignItems: 'center',
              }}
            >
              <svg
                viewBox="0 0 180 180"
                style={{ width: '150px', height: '150px', margin: '0 auto', fontFamily: th.svgFont }}
                role="img"
                aria-label="رسم دائري لتوزيع مصروفات وتكاليف اليوم"
              >
                {computedArcs.map((arc) => (
                  <path key={arc.label} d={arc.path} fill={arc.color} fillOpacity="0.92" />
                ))}
                <text
                  x="90"
                  y="84"
                  textAnchor="middle"
                  fill={th.muted}
                  fontSize="9.5"
                  fontWeight="800"
                >
                  الإجمالي
                </text>
                <text
                  x="90"
                  y="102"
                  textAnchor="middle"
                  fill={th.ink}
                  fontSize="12.5"
                  fontWeight="900"
                >
                  {fmtShort(donutTotal)}
                </text>
              </svg>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {computedArcs.slice(0, 6).map((arc) => (
                  <div
                    key={arc.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: isPrint ? '9.2px' : 'var(--fs-xs)',
                      fontWeight: 800,
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: th.ink }}>
                      <span
                        style={{
                          width: '9px',
                          height: '9px',
                          borderRadius: '3px',
                          background: arc.color,
                          flexShrink: 0,
                        }}
                      />
                      <span>{arc.label}</span>
                    </span>
                    <span style={{ color: th.sub, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {formatCurrency(arc.value)} ({arc.pct}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
