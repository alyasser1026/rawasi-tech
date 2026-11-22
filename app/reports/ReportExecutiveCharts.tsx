"use client";
import React, { useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/helpers';

export interface ExecutiveChartProps {
  reportData: any;
  variant?: 'web' | 'print';
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

function getChartTheme(variant: 'web' | 'print') {
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
          marginBottom: '12px',
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

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

function SvgDonut({
  title,
  subtitle,
  slices,
  totalLabel,
  variant = 'web',
  emptyText = 'لا توجد بيانات للعرض',
}: {
  title: string;
  subtitle?: string;
  slices: DonutSlice[];
  totalLabel?: string;
  variant?: 'web' | 'print';
  emptyText?: string;
}) {
  const th = getChartTheme(variant);
  const validSlices = slices.filter((s) => Number(s.value) > 0);
  const total = round2(validSlices.reduce((s, item) => s + Number(item.value), 0));

  const r = 46;
  const cx = 66;
  const cy = 66;
  const C = 2 * Math.PI * r;
  let cumulative = 0;

  return (
    <div style={th.subCardStyle}>
      <div style={{ marginBottom: th.isPrint ? '6px' : '0.65rem' }}>
        <div style={{ fontWeight: 900, fontSize: th.titleSize, color: th.ink }}>{title}</div>
        {subtitle && <div style={{ fontSize: th.subSize, color: th.muted, marginTop: '2px' }}>{subtitle}</div>}
      </div>

      {total <= 0 ? (
        <div style={{ fontSize: th.subSize, color: th.muted, padding: '1.2rem 0', textAlign: 'center', fontWeight: 700 }}>
          {emptyText}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: th.isPrint ? '10px' : '1rem',
            flexWrap: 'wrap',
          }}
        >
          <svg
            viewBox="0 0 132 132"
            style={{ width: th.isPrint ? '104px' : '124px', height: th.isPrint ? '104px' : '124px', flexShrink: 0 }}
          >
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={th.trackBg} strokeWidth={18} />
            <g transform={`rotate(-90 ${cx} ${cy})`}>
              {validSlices.map((slice) => {
                const frac = slice.value / total;
                const dashLen = frac * C;
                const offset = cumulative;
                cumulative += dashLen;
                return (
                  <circle
                    key={slice.label}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={18}
                    strokeDasharray={`${dashLen} ${Math.max(0, C - dashLen)}`}
                    strokeDashoffset={-offset}
                  />
                );
              })}
            </g>
            <text
              x={cx}
              y={cy - 2}
              textAnchor="middle"
              style={{ fill: th.ink, fontSize: '13px', fontWeight: 900, fontFamily: th.svgFont }}
            >
              {fmtShort(total)}
            </text>
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              style={{ fill: th.muted, fontSize: '8.5px', fontWeight: 800, fontFamily: th.svgFont }}
            >
              {totalLabel || 'الإجمالي'}
            </text>
          </svg>

          <div style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: th.isPrint ? '4px' : '0.45rem' }}>
            {slices
              .filter((s) => Number(s.value) > 0 || validSlices.length === 0)
              .map((slice) => {
                const pct = total > 0 ? round2((slice.value / total) * 100) : 0;
                return (
                  <div
                    key={slice.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      fontSize: th.isPrint ? '8.6px' : 'var(--fs-xs)',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: th.sub, fontWeight: 800 }}>
                      <span
                        style={{
                          width: th.isPrint ? '8px' : '10px',
                          height: th.isPrint ? '8px' : '10px',
                          borderRadius: '3px',
                          background: slice.color,
                          flexShrink: 0,
                        }}
                      />
                      {slice.label}
                    </span>
                    <span style={{ fontWeight: 900, color: th.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(slice.value)}{' '}
                      <span style={{ color: th.muted, fontWeight: 700, fontSize: th.isPrint ? '7.8px' : '0.7rem' }}>
                        ({pct}%)
                      </span>
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   1. شارت شلال العقد والربحية (Contract-to-Profit Waterfall)
   ========================================================================== */
export function ContractWaterfallChart({ reportData, variant = 'web' }: ExecutiveChartProps) {
  const th = getChartTheme(variant);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const t = reportData?.totals;
  if (!t) return null;

  const contract = Number(t.totalContractValue) || 0;
  const clientMat = Number(t.totalClientMaterialsDeduction) || 0;
  const retention = Number(t.totalRetentionAmount) || 0;
  const retPct = Number(t.overallRetentionPercentage) || 0;
  const netReceived = Number(t.totalClientNetExRetention) || 0;
  const actualCost = Number(t.totalActualProjectCosts) || 0;
  const actualProfit = Number(t.totalActualProfitExRetention) || 0;
  const netAfterMat = Number(t.totalContractAfterMaterials) || 0;
  const targetProfit = Number(t.totalTargetProfitBudgetExRetention) || 0;
  const eacProfit = Number(t.totalExpectedProfitEacExRetention) || 0;

  const steps = [
    {
      label: '1. قيمة العقود',
      val: contract,
      start: 0,
      end: contract,
      color: '#3b82f6',
      kind: 'إجمالي تعاقدي (BOQ)',
    },
    {
      label: '2. (-) خامات العميل',
      val: -clientMat,
      start: contract,
      end: netAfterMat,
      color: '#0ea5e9',
      kind: 'خصم حساب 217',
    },
    {
      label: `3. (-) ضمان (${retPct}%)`,
      val: -retention,
      start: netAfterMat,
      end: netReceived,
      color: '#f59e0b',
      kind: 'محتجز ضمان الأعمال',
    },
    {
      label: '4. صافي المستحق التعاقدي',
      val: netReceived,
      start: 0,
      end: netReceived,
      color: '#059669',
      kind: 'صافي العقد بعد الخامات والضمان',
    },
    {
      label: '5. (-) التكلفة الفعلية',
      val: -actualCost,
      start: netReceived,
      end: actualProfit,
      color: '#f97316',
      kind: 'تكاليف التنفيذ على الشركة',
    },
    {
      label: actualProfit >= 0 ? '6. صافي الربح الفعلي' : '6. صافي العجز الفعلي',
      val: actualProfit,
      start: 0,
      end: actualProfit,
      color: actualProfit >= 0 ? '#10b981' : '#ef4444',
      kind: 'النتيجة حتى الآن (بدون ضمان)',
    },
  ];

  const allVals = [0, ...steps.flatMap((s) => [s.start, s.end])];
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const span = Math.max(1, rawMax - rawMin);
  const minY = rawMin < 0 ? rawMin - span * 0.14 : 0;
  const maxY = rawMax + span * 0.16;
  const totalSpan = Math.max(1, maxY - minY);

  const W = 820;
  const H = 228;
  const padL = 54;
  const padR = 24;
  const padT = 24;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const toY = (v: number) => padT + ((maxY - v) / totalSpan) * plotH;
  const yZero = toY(0);

  // اتجاه من اليمين لليسار (idx = 0 على اليمين -> idx = 5 على اليسار)
  const colStep = plotW / steps.length;
  const barW = Math.min(72, colStep * 0.62);

  const hovered = hoveredIdx !== null ? steps[hoveredIdx] : null;

  return (
    <div style={th.cardStyle} dir="rtl">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: th.isPrint ? '6px' : '0.85rem',
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: th.isPrint ? '11px' : 'var(--fs-lg)', color: th.ink }}>
            شلال العقد والربحية (من قيمة التعاقد إلى صافي الربح الفعلي)
          </div>
          <div style={{ fontSize: th.subSize, color: th.muted, fontWeight: 700 }}>
            التسلسل المحاسبي المعتمد: العقود ← خصم خامات العميل ← خصم ضمان الأعمال ← صافي المستحق التعاقدي ← التكلفة الفعلية ← الربح
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          {hovered && !th.isPrint && (
            <span
              style={{
                background: 'var(--accent-soft-bg)',
                color: 'var(--accent-ink)',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: 'var(--fs-xs)',
                fontWeight: 900,
              }}
            >
              {hovered.label}: {formatCurrency(hovered.val)} ({hovered.kind})
            </span>
          )}
          <span
            style={{
              background: th.isPrint ? '#f5f3ff' : 'rgba(139, 92, 246, 0.14)',
              color: th.isPrint ? '#6d28d9' : '#a78bfa',
              padding: th.isPrint ? '3px 8px' : '4px 10px',
              borderRadius: '999px',
              fontSize: th.isPrint ? '8.5px' : 'var(--fs-xs)',
              fontWeight: 900,
            }}
          >
            مستهدف الموازنة: {targetProfit > 0 ? '+' : ''}
            {formatCurrency(targetProfit)}
          </span>
          <span
            style={{
              background: th.isPrint ? '#f0f9ff' : 'rgba(14, 165, 233, 0.14)',
              color: th.isPrint ? '#0369a1' : '#38bdf8',
              padding: th.isPrint ? '3px 8px' : '4px 10px',
              borderRadius: '999px',
              fontSize: th.isPrint ? '8.5px' : 'var(--fs-xs)',
              fontWeight: 900,
            }}
          >
            المتوقع EAC: {eacProfit > 0 ? '+' : ''}
            {formatCurrency(eacProfit)}
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        {[0.25, 0.5, 0.75, 1].map((frac) => {
          const val = minY + frac * totalSpan;
          const y = toY(val);
          return (
            <g key={frac}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={th.grid} strokeDasharray="3 3" strokeWidth={1} />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                style={{ fill: th.muted, fontSize: '9.5px', fontWeight: 700, fontFamily: th.svgFont }}
              >
                {fmtShort(val)}
              </text>
            </g>
          );
        })}

        <line x1={padL} y1={yZero} x2={W - padR} y2={yZero} stroke={th.zeroLine} strokeWidth={1.2} />
        <text x={padL - 6} y={yZero + 3} textAnchor="end" style={{ fill: th.muted, fontSize: '9.5px', fontWeight: 700, fontFamily: th.svgFont }}>
          0
        </text>

        {steps.map((s, idx) => {
          const centerX = W - padR - colStep * (idx + 0.5);
          const x = centerX - barW / 2;
          const y1 = toY(s.start);
          const y2 = toY(s.end);
          const rectY = Math.min(y1, y2);
          const rectH = Math.max(3, Math.abs(y2 - y1));
          const isZeroDeduction = Math.abs(s.val) === 0;
          const nextStep = idx < steps.length - 1 ? steps[idx + 1] : null;
          const nextCenterX = nextStep ? W - padR - colStep * (idx + 1.5) : 0;
          const isHovered = hoveredIdx === idx;
          const valueLabelY = s.end >= s.start ? rectY - 6 : rectY + rectH + 12;

          return (
            <g
              key={s.label}
              style={{ cursor: th.isPrint ? 'default' : 'pointer' }}
              onMouseEnter={() => !th.isPrint && setHoveredIdx(idx)}
              onMouseLeave={() => !th.isPrint && setHoveredIdx(null)}
            >
              {nextStep && (
                <line
                  x1={x}
                  y1={y2}
                  x2={nextCenterX + barW / 2}
                  y2={y2}
                  stroke={th.zeroLine}
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
              )}
              <rect
                x={x}
                y={rectY}
                width={barW}
                height={isZeroDeduction ? 3 : rectH}
                rx={6}
                fill={s.color}
                opacity={isHovered ? 1 : 0.9}
              />
              <text
                x={centerX}
                y={Math.min(H - padB - 4, Math.max(12, valueLabelY))}
                textAnchor="middle"
                style={{
                  fill: s.val < 0 ? '#ef4444' : th.ink,
                  fontSize: '10.5px',
                  fontWeight: 900,
                  fontFamily: th.svgFont,
                }}
              >
                {fmtShort(s.val)}
              </text>
              <text
                x={centerX}
                y={H - 12}
                textAnchor="middle"
                style={{ fill: th.sub, fontSize: '9.8px', fontWeight: 800, fontFamily: th.svgFont }}
              >
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ==========================================================================
   2. شارتات مقارنة المشاريع (التكاليف vs الموازنة + الأرباح الثلاثة)
   ========================================================================== */
export function ProjectsPerformanceCharts({ reportData, variant = 'web' }: ExecutiveChartProps) {
  const th = getChartTheme(variant);
  const [hoveredCostProj, setHoveredCostProj] = useState<any | null>(null);
  const [hoveredProfitProj, setHoveredProfitProj] = useState<any | null>(null);
  const projects: any[] = Array.isArray(reportData?.projectsMatrix) ? reportData.projectsMatrix : [];
  if (projects.length === 0) return null;

  const costMax = Math.max(
    1,
    ...projects.flatMap((p) => [
      Number(p.client_net_ex_retention) || 0,
      Number(p.estimated_execution_budget) || 0,
      Number(p.total_actual_cost) || 0,
    ])
  );

  const profitVals = [
    0,
    ...projects.flatMap((p) => [
      Number(p.target_profit_budget_ex_retention) || 0,
      Number(p.expected_profit_eac_ex_retention) || 0,
      Number(p.actual_profit_ex_retention) || 0,
    ]),
  ];
  const profMinRaw = Math.min(...profitVals);
  const profMaxRaw = Math.max(...profitVals);
  const profSpan = Math.max(1, profMaxRaw - profMinRaw);
  const profMin = profMinRaw < 0 ? profMinRaw - profSpan * 0.14 : 0;
  const profMax = profMaxRaw + profSpan * 0.14;
  const profTotalSpan = Math.max(1, profMax - profMin);

  const W = 470;
  const H = 208;
  const padL = 44;
  const padR = 14;
  const padT = 22;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const groupStep = plotW / projects.length;
  const barW =
    projects.length <= 3
      ? Math.min(30, Math.max(6, (groupStep - 18) / 3))
      : Math.min(18, Math.max(6, (groupStep - 10) / 3));
  const gap = Math.min(6, Math.max(2, barW * 0.22));

  const toCostY = (v: number) => padT + ((costMax * 1.12 - v) / (costMax * 1.12)) * plotH;
  const costZeroY = padT + plotH;

  const toProfY = (v: number) => padT + ((profMax - v) / profTotalSpan) * plotH;
  const profZeroY = toProfY(0);

  return (
    <div
      dir="rtl"
      style={{
        ...th.cardStyle,
        display: 'grid',
        gridTemplateColumns: th.isPrint ? '1fr 1fr' : 'repeat(auto-fit, minmax(22rem, 1fr))',
        gap: th.isPrint ? '10px' : '1rem',
      }}
    >
      {/* 1أ: صافي العقد vs الموازنة المعتمدة vs التكلفة الفعلية */}
      <div style={th.subCardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: th.titleSize, color: th.ink }}>
              أداء المشاريع: صافي العقد (بدون ضمان) vs الموازنة المعتمدة vs الصرف الفعلي
            </div>
            <div style={{ fontSize: th.subSize, color: th.muted, fontWeight: 700 }}>
              {hoveredCostProj && !th.isPrint
                ? `${hoveredCostProj.name}: صافي العقد ${formatCurrency(hoveredCostProj.client_net_ex_retention)} • الموازنة المعتمدة ${formatCurrency(hoveredCostProj.estimated_budget)} • فعلي ${formatCurrency(hoveredCostProj.total_actual_cost)} • محصّل بسندات قبض ${formatCurrency(hoveredCostProj.receipts_total)}`
                : 'الأعمدة الحمراء تشير إلى المشاريع التي تجاوز صرفها الفعلي حدود الموازنة المعتمدة'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: th.isPrint ? '7.6px' : '0.72rem', fontWeight: 800, color: th.sub }}>
            <span>● <span style={{ color: '#10b981' }}>صافي العقد</span></span>
            <span>● <span style={{ color: '#3b82f6' }}>الموازنة المعتمدة</span></span>
            <span>● <span style={{ color: '#f59e0b' }}>فعلي</span> / <span style={{ color: '#dc2626' }}>تجاوز</span></span>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
          {[0.25, 0.5, 0.75, 1].map((frac) => {
            const v = frac * costMax * 1.12;
            const y = toCostY(v);
            return (
              <g key={frac}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={th.grid} strokeDasharray="3 3" strokeWidth={1} />
                <text x={padL - 5} y={y + 3} textAnchor="end" style={{ fill: th.muted, fontSize: '8.5px', fontWeight: 700, fontFamily: th.svgFont }}>
                  {fmtShort(v)}
                </text>
              </g>
            );
          })}
          <line x1={padL} y1={costZeroY} x2={W - padR} y2={costZeroY} stroke={th.zeroLine} strokeWidth={1.2} />

          {projects.map((p, idx) => {
            const cx = W - padR - groupStep * (idx + 0.5);
            const totalW = barW * 3 + gap * 2;
            const xStart = cx - totalW / 2;
            const isOverrun = (Number(p.total_actual_cost) || 0) > (Number(p.estimated_execution_budget) || 0);
            const vals = [
              { v: Number(p.client_net_ex_retention) || 0, c: '#10b981' },
              { v: Number(p.estimated_execution_budget) || 0, c: '#3b82f6' },
              { v: Number(p.total_actual_cost) || 0, c: isOverrun ? '#dc2626' : '#f59e0b' },
            ];
            return (
              <g
                key={p.id}
                style={{ cursor: th.isPrint ? 'default' : 'pointer' }}
                onMouseEnter={() => !th.isPrint && setHoveredCostProj(p)}
                onMouseLeave={() => !th.isPrint && setHoveredCostProj(null)}
              >
                {vals.map((item, bIdx) => {
                  const bx = xStart + (barW + gap) * (2 - bIdx);
                  const by = toCostY(item.v);
                  const bh = Math.max(2, costZeroY - by);
                  return (
                    <g key={bIdx}>
                      <rect x={bx} y={by} width={barW} height={bh} rx={3} fill={item.c} />
                      {projects.length <= 4 && item.v > 0 && (
                        <text
                          x={bx + barW / 2}
                          y={Math.max(10, by - 4)}
                          textAnchor="middle"
                          style={{
                            fill: item.c,
                            fontSize: th.isPrint ? '7.2px' : '7.8px',
                            fontWeight: 900,
                            fontFamily: th.svgFont,
                          }}
                        >
                          {fmtShort(item.v)}
                        </text>
                      )}
                    </g>
                  );
                })}
                {isOverrun && projects.length > 4 && (
                  <circle cx={xStart + barW / 2} cy={toCostY(vals[2].v) - 6} r={3.5} fill="#dc2626" />
                )}
                <text
                  x={cx}
                  y={H - 12}
                  textAnchor="middle"
                  style={{ fill: th.sub, fontSize: '8.5px', fontWeight: 800, fontFamily: th.svgFont }}
                >
                  {String(p.name || '').replace('فيلا ', '')}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 1ب: مقارنة الأرباح: المستهدف vs المتوقع EAC vs الفعلي */}
      <div style={th.subCardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: th.titleSize, color: th.ink }}>
              الأرباح: المستهدف (الموازنة) vs المتوقع EAC vs الفعلي
            </div>
            <div style={{ fontSize: th.subSize, color: th.muted, fontWeight: 700 }}>
              {hoveredProfitProj && !th.isPrint
                ? `${hoveredProfitProj.name}: مستهدف ${formatCurrency(hoveredProfitProj.target_profit_budget_ex_retention)} • EAC ${formatCurrency(hoveredProfitProj.expected_profit_eac_ex_retention)} • فعلي ${formatCurrency(hoveredProfitProj.actual_profit_ex_retention)}`
                : 'مقارنة الربح المتوقع عند التسليم مع المستهدف الأصلي والفعلي (أعلى الصفر ربح / أسفل الصفر عجز)'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: th.isPrint ? '7.6px' : '0.72rem', fontWeight: 800, color: th.sub }}>
            <span>● <span style={{ color: '#8b5cf6' }}>مستهدف</span></span>
            <span>● <span style={{ color: '#0ea5e9' }}>EAC</span></span>
            <span>● <span style={{ color: '#10b981' }}>فعلي</span> / <span style={{ color: '#ef4444' }}>خسارة</span></span>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
          {[0.2, 0.4, 0.6, 0.8, 1].map((frac) => {
            const v = profMin + frac * profTotalSpan;
            const y = toProfY(v);
            return (
              <g key={frac}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={th.grid} strokeDasharray="3 3" strokeWidth={1} />
                <text x={padL - 5} y={y + 3} textAnchor="end" style={{ fill: th.muted, fontSize: '8.5px', fontWeight: 700, fontFamily: th.svgFont }}>
                  {fmtShort(v)}
                </text>
              </g>
            );
          })}
          <line x1={padL} y1={profZeroY} x2={W - padR} y2={profZeroY} stroke={th.zeroLine} strokeWidth={1.3} />
          <text x={padL - 5} y={profZeroY + 3} textAnchor="end" style={{ fill: th.muted, fontSize: '8.5px', fontWeight: 700, fontFamily: th.svgFont }}>
            0
          </text>

          {projects.map((p, idx) => {
            const cx = W - padR - groupStep * (idx + 0.5);
            const totalW = barW * 3 + gap * 2;
            const xStart = cx - totalW / 2;
            const targetV = Number(p.target_profit_budget_ex_retention) || 0;
            const eacV = Number(p.expected_profit_eac_ex_retention) || 0;
            const actV = Number(p.actual_profit_ex_retention) || 0;
            const vals = [
              { v: targetV, c: targetV >= 0 ? '#8b5cf6' : '#f43f5e' },
              { v: eacV, c: eacV >= 0 ? '#0ea5e9' : '#e11d48' },
              { v: actV, c: actV >= 0 ? '#10b981' : '#dc2626' },
            ];
            return (
              <g
                key={p.id}
                style={{ cursor: th.isPrint ? 'default' : 'pointer' }}
                onMouseEnter={() => !th.isPrint && setHoveredProfitProj(p)}
                onMouseLeave={() => !th.isPrint && setHoveredProfitProj(null)}
              >
                {vals.map((item, bIdx) => {
                  const bx = xStart + (barW + gap) * (2 - bIdx);
                  const yVal = toProfY(item.v);
                  const ry = Math.min(profZeroY, yVal);
                  const rh = Math.max(2, Math.abs(yVal - profZeroY));
                  return <rect key={bIdx} x={bx} y={ry} width={barW} height={rh} rx={3} fill={item.c} />;
                })}
                <text
                  x={cx}
                  y={H - 12}
                  textAnchor="middle"
                  style={{ fill: th.sub, fontSize: '8.5px', fontWeight: 800, fontFamily: th.svgFont }}
                >
                  {String(p.name || '').replace('فيلا ', '')}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ==========================================================================
   3. شارت أرصدة العمالة ومقاولي الباطن (المدفوع vs المتبقي)
   ========================================================================== */
export function WorkersContractorsChart({ reportData, variant = 'web' }: ExecutiveChartProps) {
  const th = getChartTheme(variant);
  const rows = useMemo(() => {
    const cRows = (reportData?.contractorsSummary || []).map((c: any) => ({
      id: `con-${c.name}`,
      name: c.name,
      role: 'مقاول باطن',
      earned: Number(c.claimed) || 0,
      paid: Number(c.paid) || 0,
      remaining: Math.max(0, Number(c.remaining) || 0),
    }));
    const wRows = (reportData?.workersSummary || []).map((w: any) => ({
      id: `wrk-${w.name}`,
      name: w.name,
      role: 'عمالة',
      earned: Number(w.earned) || 0,
      paid: Number(w.paid) || 0,
      remaining: Math.max(0, Number(w.remaining) || 0),
    }));
    return [...cRows, ...wRows]
      .filter((r) => r.earned > 0 || r.paid > 0 || r.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining || b.earned - a.earned)
      .slice(0, 10);
  }, [reportData]);

  const maxTotal = Math.max(1, ...rows.map((r) => Math.max(r.earned, r.paid + r.remaining)));

  return (
    <div style={th.cardStyle} dir="rtl">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: th.isPrint ? '8px' : '0.85rem',
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: th.isPrint ? '10.5px' : 'var(--fs-md)', color: th.ink }}>
            مؤشر السداد والأرصدة المستحقة للعمالة ومقاولي الباطن (الأعلى استحقاقاً)
          </div>
          <div style={{ fontSize: th.subSize, color: th.muted, fontWeight: 700 }}>
            تحديد أولويات الصرف عبر مقارنة المبالغ المدفوعة فعلياً بالمتبقي المستحق لكل مستفيد
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: th.isPrint ? '8px' : 'var(--fs-xs)', fontWeight: 800, color: th.sub }}>
          <span>● <span style={{ color: '#10b981' }}>المدفوع بسندات الصرف</span></span>
          <span>● <span style={{ color: '#f43f5e' }}>المتبقي المستحق</span></span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: th.subSize, color: th.muted, textAlign: 'center', padding: '1rem 0', fontWeight: 700 }}>
          لا توجد مستحقات عمالة أو مقاولين مسجلة حتى الآن
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: th.isPrint ? '5px' : '0.55rem' }}>
          {rows.map((row) => {
            const totalScale = Math.max(row.earned, row.paid + row.remaining);
            const paidPctOfBar = totalScale > 0 ? Math.min(100, (row.paid / maxTotal) * 100) : 0;
            const remPctOfBar = totalScale > 0 ? Math.min(100 - paidPctOfBar, (row.remaining / maxTotal) * 100) : 0;
            const paidRatio = row.earned > 0 ? Math.min(100, round2((row.paid / row.earned) * 100)) : 100;

            return (
              <div
                key={row.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: th.isPrint ? '155px 1fr 185px' : 'minmax(140px, 195px) 1fr minmax(175px, 230px)',
                  gap: '10px',
                  alignItems: 'center',
                  fontSize: th.isPrint ? '8.5px' : 'var(--fs-xs)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span
                    style={{
                      background:
                        row.role === 'مقاول باطن'
                          ? th.isPrint
                            ? '#ffedd5'
                            : 'var(--accent-soft-bg)'
                          : th.isPrint
                            ? '#e0f2fe'
                            : 'rgba(56, 189, 248, 0.14)',
                      color: row.role === 'مقاول باطن' ? (th.isPrint ? '#c2410c' : 'var(--accent-ink)') : th.isPrint ? '#0369a1' : '#38bdf8',
                      padding: '1px 6px',
                      borderRadius: '999px',
                      fontSize: th.isPrint ? '7.2px' : '0.68rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {row.role === 'مقاول باطن' ? 'مقاول' : 'عمالة'}
                  </span>
                  <span style={{ fontWeight: 900, color: th.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.name}
                  </span>
                </div>

                <svg viewBox="0 0 300 12" preserveAspectRatio="none" style={{ width: '100%', height: th.isPrint ? '10px' : '12px', display: 'block', borderRadius: '999px' }}>
                  <rect x={0} y={0} width={300} height={12} rx={6} fill={th.trackBg} />
                  {paidPctOfBar > 0 && (
                    <rect
                      x={300 - (paidPctOfBar / 100) * 300}
                      y={0}
                      width={Math.max(3, (paidPctOfBar / 100) * 300)}
                      height={12}
                      rx={6}
                      fill="#10b981"
                    />
                  )}
                  {remPctOfBar > 0 && (
                    <rect
                      x={Math.max(0, 300 - ((paidPctOfBar + remPctOfBar) / 100) * 300)}
                      y={0}
                      width={Math.max(3, (remPctOfBar / 100) * 300)}
                      height={12}
                      rx={4}
                      fill="#f43f5e"
                    />
                  )}
                </svg>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '6px',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ color: th.sub, fontWeight: 700 }}>
                    إجمالي: <b style={{ color: th.ink }}>{formatCurrency(row.earned)}</b> ({paidRatio}%)
                  </span>
                  <span style={{ fontWeight: 900, color: row.remaining > 0 ? '#f43f5e' : '#10b981' }}>
                    {row.remaining > 0 ? `متبقي: ${formatCurrency(row.remaining)}` : 'مسدّد'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   4. شارتات التدفق النقدي الزمني وتوزيع سندات الصرف
   ========================================================================== */
export function CashFlowVouchersCharts({ reportData, variant = 'web' }: ExecutiveChartProps) {
  const th = getChartTheme(variant);
  const [hoveredBucket, setHoveredBucket] = useState<any | null>(null);
  const t = reportData?.totals || {};

  const timeline = useMemo(() => {
    const rvs = reportData?.receiptVouchers || [];
    const pvs = reportData?.paymentVouchers || [];
    const rawDates = new Set<string>();
    rvs.forEach((r: any) => r.date && rawDates.add(String(r.date).slice(0, 10)));
    pvs.forEach((v: any) => v.date && rawDates.add(String(v.date).slice(0, 10)));
    const groupByMonth = rawDates.size > 14;

    const bucketMap = new Map<string, { key: string; inAmt: number; outAmt: number }>();
    const addEntry = (dateStr: any, field: 'inAmt' | 'outAmt', amt: number) => {
      const clean = String(dateStr || '').slice(0, groupByMonth ? 7 : 10) || 'غير مؤرخ';
      if (!bucketMap.has(clean)) bucketMap.set(clean, { key: clean, inAmt: 0, outAmt: 0 });
      bucketMap.get(clean)![field] += amt;
    };

    rvs.forEach((r: any) => addEntry(r.date, 'inAmt', Number(r.amount) || 0));
    pvs.forEach((v: any) => addEntry(v.date, 'outAmt', Number(v.amount) || 0));

    let running = 0;
    return Array.from(bucketMap.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((item) => {
        running = round2(running + item.inAmt - item.outAmt);
        return {
          key: item.key,
          shortLabel: groupByMonth ? item.key : item.key.length === 10 ? item.key.slice(5) : item.key,
          inAmt: round2(item.inAmt),
          outAmt: round2(item.outAmt),
          runningBalance: running,
        };
      });
  }, [reportData]);

  const W = 520;
  const H = 200;
  const padL = 46;
  const padR = 14;
  const padT = 18;
  const padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const allY = [0, ...timeline.flatMap((b) => [b.inAmt, b.outAmt, b.runningBalance])];
  const minRaw = Math.min(...allY);
  const maxRaw = Math.max(...allY);
  const span = Math.max(1, maxRaw - minRaw);
  const minY = minRaw < 0 ? minRaw - span * 0.14 : 0;
  const maxY = maxRaw + span * 0.16;
  const totSpan = Math.max(1, maxY - minY);
  const toY = (v: number) => padT + ((maxY - v) / totSpan) * plotH;
  const yZero = toY(0);

  const stepW = plotW / Math.max(1, timeline.length);
  const barW = Math.min(18, Math.max(5, (stepW - 8) / 2));

  // اتجاه زمني من اليسار لليسار/يمين — نبدأ من اليسار لليمين لتدرج التاريخ الطبيعي مع خط السيولة التراكمي
  const points = timeline.map((b, i) => {
    const cx = padL + stepW * (i + 0.5);
    return { ...b, cx, cy: toY(b.runningBalance) };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`).join(' ');

  return (
    <div
      dir="rtl"
      style={{
        ...th.cardStyle,
        display: 'grid',
        gridTemplateColumns: th.isPrint ? '1.35fr 0.65fr' : 'repeat(auto-fit, minmax(22rem, 1fr))',
        gap: th.isPrint ? '10px' : '1rem',
      }}
    >
      {/* 4أ: التدفق النقدي الزمني والسيولة التراكمية */}
      <div style={th.subCardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: th.titleSize, color: th.ink }}>
              التدفق النقدي الزمني (قبض vs صرف + خط رصيد الخزينة)
            </div>
            <div style={{ fontSize: th.subSize, color: th.muted, fontWeight: 700 }}>
              {hoveredBucket && !th.isPrint
                ? `${hoveredBucket.key}: قبض ${formatCurrency(hoveredBucket.inAmt)} • صرف ${formatCurrency(hoveredBucket.outAmt)} • الرصيد التراكمي ${formatCurrency(hoveredBucket.runningBalance)}`
                : 'تتبع حركة السيولة الداخلة والخارجة وتطور صافي رصيد الخزينة عبر الزمن'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: th.isPrint ? '7.6px' : '0.72rem', fontWeight: 800, color: th.sub }}>
            <span>● <span style={{ color: '#10b981' }}>سندات قبض</span></span>
            <span>● <span style={{ color: '#f43f5e' }}>سندات صرف</span></span>
            <span>━ <span style={{ color: '#ea580c' }}>الرصيد التراكمي</span></span>
          </div>
        </div>

        {timeline.length === 0 ? (
          <div style={{ fontSize: th.subSize, color: th.muted, textAlign: 'center', padding: '1.2rem 0', fontWeight: 700 }}>
            لا توجد سندات قبض أو صرف مسجلة
          </div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
            {[0.25, 0.5, 0.75, 1].map((frac) => {
              const v = minY + frac * totSpan;
              const y = toY(v);
              return (
                <g key={frac}>
                  <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={th.grid} strokeDasharray="3 3" strokeWidth={1} />
                  <text x={padL - 5} y={y + 3} textAnchor="end" style={{ fill: th.muted, fontSize: '8.5px', fontWeight: 700, fontFamily: th.svgFont }}>
                    {fmtShort(v)}
                  </text>
                </g>
              );
            })}
            <line x1={padL} y1={yZero} x2={W - padR} y2={yZero} stroke={th.zeroLine} strokeWidth={1.2} />
            <text x={padL - 5} y={yZero + 3} textAnchor="end" style={{ fill: th.muted, fontSize: '8.5px', fontWeight: 700, fontFamily: th.svgFont }}>
              0
            </text>

            {points.map((b, idx) => {
              const yIn = toY(b.inAmt);
              const yOut = toY(b.outAmt);
              const showTick = timeline.length <= 10 || idx % Math.ceil(timeline.length / 8) === 0 || idx === timeline.length - 1;
              return (
                <g
                  key={b.key}
                  style={{ cursor: th.isPrint ? 'default' : 'pointer' }}
                  onMouseEnter={() => !th.isPrint && setHoveredBucket(b)}
                  onMouseLeave={() => !th.isPrint && setHoveredBucket(null)}
                >
                  {b.inAmt > 0 && <rect x={b.cx - barW - 1} y={yIn} width={barW} height={Math.max(2, yZero - yIn)} rx={3} fill="#10b981" opacity={0.88} />}
                  {b.outAmt > 0 && <rect x={b.cx + 1} y={yOut} width={barW} height={Math.max(2, yZero - yOut)} rx={3} fill="#f43f5e" opacity={0.88} />}
                  {showTick && (
                    <text x={b.cx} y={H - 12} textAnchor="middle" style={{ fill: th.sub, fontSize: '8px', fontWeight: 700, fontFamily: th.svgFont }}>
                      {b.shortLabel}
                    </text>
                  )}
                </g>
              );
            })}

            {points.length > 1 && <path d={linePath} fill="none" stroke="#ea580c" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />}
            {points.map((p) => (
              <circle key={`pt-${p.key}`} cx={p.cx} cy={p.cy} r={3.5} fill="#ffffff" stroke="#ea580c" strokeWidth={2} />
            ))}
          </svg>
        )}
      </div>

      {/* 4ب: توزيع سندات الصرف حسب التوجيه */}
      <SvgDonut
        title="توزيع سندات الصرف حسب التوجيه"
        subtitle="كم صُرف على المقاولين والعمالة والمصاريف"
        totalLabel="إجمالي الصرف"
        variant={variant}
        emptyText="لا توجد سندات صرف مسجلة"
        slices={[
          { label: 'مستخلصات مقاولين', value: Number(t.pvClaimsTotal) || 0, color: '#6366f1' },
          { label: 'يوميات عمالة', value: Number(t.pvWorkersTotal) || 0, color: '#0ea5e9' },
          { label: 'مصاريف تشغيلية', value: Number(t.pvExpensesTotal) || 0, color: '#f97316' },
        ]}
      />
    </div>
  );
}

/* ==========================================================================
   5. شارت هيكل التكاليف الفعلية وتوزيع مصاريف ABC على المشاريع
   ========================================================================== */
export function CostStructureAndAbcCharts({ reportData, variant = 'web' }: ExecutiveChartProps) {
  const th = getChartTheme(variant);
  const projects: any[] = Array.isArray(reportData?.projectsMatrix) ? reportData.projectsMatrix : [];

  const costBreakdown = useMemo(() => {
    const labor = round2(projects.reduce((s, p) => s + (Number(p.labor_total) || 0), 0));
    const abc = round2(projects.reduce((s, p) => s + (Number(p.abc_expenses_total) || 0), 0));
    const claims = round2(projects.reduce((s, p) => s + (Number(p.claims_total) || 0), 0));
    const companyMat = round2(projects.reduce((s, p) => s + (Number(p.company_materials_cost) || 0), 0));
    return { labor, abc, claims, companyMat };
  }, [projects]);

  const abcProjects = useMemo(
    () =>
      projects
        .filter((p) => Number(p.abc_expenses_total) > 0)
        .sort((a, b) => Number(b.abc_expenses_total) - Number(a.abc_expenses_total)),
    [projects]
  );
  const totalAbc = round2(abcProjects.reduce((s, p) => s + (Number(p.abc_expenses_total) || 0), 0));
  const maxAbc = Math.max(1, ...abcProjects.map((p) => Number(p.abc_expenses_total) || 0));

  return (
    <div
      dir="rtl"
      style={{
        ...th.cardStyle,
        display: 'grid',
        gridTemplateColumns: th.isPrint ? '0.85fr 1.15fr' : 'repeat(auto-fit, minmax(22rem, 1fr))',
        gap: th.isPrint ? '10px' : '1rem',
      }}
    >
      <SvgDonut
        title="هيكل تكاليف التنفيذ الفعلية للشركة"
        subtitle="نسب توزيع التكلفة الفعلية حسب نوع المصروف"
        totalLabel="التكلفة الفعلية"
        variant={variant}
        emptyText="لا توجد تكاليف تنفيذ فعلية مسجلة"
        slices={[
          { label: 'يوميات العمالة', value: costBreakdown.labor, color: '#0ea5e9' },
          { label: 'مصاريف موزعة (ABC)', value: costBreakdown.abc, color: '#f97316' },
          { label: 'مستخلصات المقاولين', value: costBreakdown.claims, color: '#8b5cf6' },
          { label: 'خامات على حساب الشركة', value: costBreakdown.companyMat, color: '#14b8a6' },
        ]}
      />

      <div style={th.subCardStyle}>
        <div style={{ marginBottom: th.isPrint ? '6px' : '0.65rem' }}>
          <div style={{ fontWeight: 900, fontSize: th.titleSize, color: th.ink }}>
            توزيع المصاريف التشغيلية المشتركة (ABC) على المشاريع
          </div>
          <div style={{ fontSize: th.subSize, color: th.muted, fontWeight: 700 }}>
            ترتيب المشاريع من الأعلى تحميلاً للمصاريف التشغيلية (إجمالي: {formatCurrency(totalAbc)})
          </div>
        </div>

        {abcProjects.length === 0 ? (
          <div style={{ fontSize: th.subSize, color: th.muted, padding: '1.2rem 0', textAlign: 'center', fontWeight: 700 }}>
            لا توجد مصاريف تشغيلية (ABC) محملة على المشاريع
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: th.isPrint ? '6px' : '0.6rem' }}>
            {abcProjects.map((p, idx) => {
              const amt = Number(p.abc_expenses_total) || 0;
              const widthPct = Math.max(3, (amt / maxAbc) * 100);
              const sharePct = totalAbc > 0 ? round2((amt / totalAbc) * 100) : 0;
              const isHeavy = idx === 0 || amt > (Number(p.est_expenses) || 0) * 2;
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: th.isPrint ? '92px 1fr 112px' : 'minmax(88px, 120px) 1fr minmax(110px, 145px)',
                    gap: '8px',
                    alignItems: 'center',
                    fontSize: th.isPrint ? '8.5px' : 'var(--fs-xs)',
                  }}
                >
                  <span style={{ fontWeight: 900, color: th.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </span>

                  <svg viewBox="0 0 240 12" preserveAspectRatio="none" style={{ width: '100%', height: th.isPrint ? '10px' : '12px', display: 'block', borderRadius: '999px' }}>
                    <rect x={0} y={0} width={240} height={12} rx={6} fill={th.trackBg} />
                    <rect
                      x={240 - (widthPct / 100) * 240}
                      y={0}
                      width={(widthPct / 100) * 240}
                      height={12}
                      rx={6}
                      fill={isHeavy ? '#ea580c' : '#f59e0b'}
                    />
                  </svg>

                  <span style={{ fontWeight: 900, color: isHeavy ? '#ea580c' : th.ink, textAlign: 'left', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(amt)}{' '}
                    <span style={{ color: th.muted, fontWeight: 700, fontSize: th.isPrint ? '7.6px' : '0.7rem' }}>
                      ({sharePct}%)
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
