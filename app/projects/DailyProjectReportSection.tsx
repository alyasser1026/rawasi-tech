"use client";
import React from 'react';
import { formatCurrency, formatDate } from '@/lib/helpers';
import { THEME } from '@/lib/theme';
import {
  Calendar, DollarSign, HardHat, Wrench, Package, Receipt, Printer, Layers, FileText, Wallet
} from 'lucide-react';
import { type ProjectDailyReport } from '@/lib/projectDailyReport';

interface DailyProjectReportSectionProps {
  report: ProjectDailyReport;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onPrintDaily?: () => void;
  printableOnly?: boolean;
}

export default function DailyProjectReportSection({
  report,
  selectedDate,
  onDateChange,
  onPrintDaily,
  printableOnly = false,
}: DailyProjectReportSectionProps) {
  const { today, cumulative, projectInfo, activeDates } = report;
  const sched = cumulative.paymentSchedule;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: printableOnly ? '0.75rem' : '1.125rem', direction: 'rtl' }}>
      {/* شريط التحكم والتواريخ النشطة (في العرض التفاعلي فقط) */}
      {!printableOnly && (
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '1rem 1.25rem',
          border: '1px solid #f1f5f9',
          boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.875rem',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} style={{ color: THEME.primary }} />
              تقرير المشروع اليومي الشامل — {projectInfo.name}
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: 'var(--fs-xs)', color: '#64748b', fontWeight: 700 }}>
              تفاصيل يومية كاملة للعمالة (فنيين ومساعدين)، المصروفات، سندات الصرف والعُهد (125)، الخامات، أوامر الشغل، والزيارات الميدانية مع الموقف التراكمي.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '0.375rem 0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <Calendar size={14} style={{ color: THEME.primary }} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontWeight: 800, fontSize: '13px', direction: 'ltr', outline: 'none' }}
              />
            </div>

            {onPrintDaily && (
              <button
                onClick={onPrintDaily}
                style={{
                  backgroundColor: '#0f172a',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '10px',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: 'var(--fs-xs)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Printer size={14} />
                طباعة التقرير اليومي
              </button>
            )}
          </div>

          {activeDates.length > 0 && (
            <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', paddingTop: '0.5rem', borderTop: '1px dashed #e2e8f0' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b' }}>أيام بها حركات مسجلة:</span>
              {activeDates.slice(0, 10).map((d) => {
                const isSelected = d === selectedDate;
                return (
                  <button
                    key={d}
                    onClick={() => onDateChange(d)}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '999px',
                      border: `1px solid ${isSelected ? THEME.primary : '#e2e8f0'}`,
                      background: isSelected ? THEME.primary : '#f8fafc',
                      color: isSelected ? 'white' : '#334155',
                      fontWeight: 800,
                      fontSize: '11px',
                      direction: 'ltr',
                      cursor: 'pointer',
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* بطاقات ملخص اليوم للمشروع */}
      <div
        className="dossier-keep-together"
        style={{
          display: 'grid',
          gridTemplateColumns: printableOnly ? 'repeat(6, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(12rem, 1fr))',
          gap: printableOnly ? '0.45rem' : '0.75rem',
        }}
      >
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: printableOnly ? '10px' : '14px', padding: printableOnly ? '0.55rem 0.65rem' : '0.875rem 1rem' }}>
          <span style={{ fontSize: printableOnly ? '10px' : '11px', color: '#0369a1', fontWeight: 900, display: 'block', whiteSpace: 'nowrap' }}>
            👷 يومية الفنيين {!printableOnly && <span dir="ltr" style={{ whiteSpace: 'nowrap' }}>({selectedDate})</span>}
          </span>
          <div style={{ fontSize: printableOnly ? '13px' : 'var(--fs-lg)', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>{formatCurrency(today.labor.techCost)}</div>
          <span style={{ fontSize: printableOnly ? '9.5px' : '11px', color: '#0369a1', fontWeight: 700 }}>{today.labor.techDays} يوم عمل</span>
        </div>

        <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: printableOnly ? '10px' : '14px', padding: printableOnly ? '0.55rem 0.65rem' : '0.875rem 1rem' }}>
          <span style={{ fontSize: printableOnly ? '10px' : '11px', color: '#0f766e', fontWeight: 900, display: 'block', whiteSpace: 'nowrap' }}>
            🤝 يومية المساعدين {!printableOnly && <span dir="ltr" style={{ whiteSpace: 'nowrap' }}>({selectedDate})</span>}
          </span>
          <div style={{ fontSize: printableOnly ? '13px' : 'var(--fs-lg)', fontWeight: 900, color: '#0d9488', marginTop: '2px' }}>{formatCurrency(today.labor.helperCost)}</div>
          <span style={{ fontSize: printableOnly ? '9.5px' : '11px', color: '#0f766e', fontWeight: 700 }}>{today.labor.helperDays} يوم عمل</span>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: printableOnly ? '10px' : '14px', padding: printableOnly ? '0.55rem 0.65rem' : '0.875rem 1rem' }}>
          <span style={{ fontSize: printableOnly ? '10px' : '11px', color: '#475569', fontWeight: 900, display: 'block', whiteSpace: 'nowrap' }}>🧾 المصروفات اليوم</span>
          <div style={{ fontSize: printableOnly ? '13px' : 'var(--fs-lg)', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{formatCurrency(today.expenses.total)}</div>
          <span style={{ fontSize: printableOnly ? '9.5px' : '11px', color: '#64748b', fontWeight: 700 }}>{today.expenses.count} عملية</span>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: printableOnly ? '10px' : '14px', padding: printableOnly ? '0.55rem 0.65rem' : '0.875rem 1rem' }}>
          <span style={{ fontSize: printableOnly ? '10px' : '11px', color: '#475569', fontWeight: 900, display: 'block', whiteSpace: 'nowrap' }}>💸 سندات الصرف اليوم</span>
          <div style={{ fontSize: printableOnly ? '13px' : 'var(--fs-lg)', fontWeight: 900, color: '#be123c', marginTop: '2px' }}>{formatCurrency(today.vouchers.total)}</div>
          <span style={{ fontSize: printableOnly ? '9.5px' : '11px', color: '#64748b', fontWeight: 700 }}>
            {today.vouchers.count} سند • أجور: {formatCurrency(today.vouchers.wagePayoutsTotal)}
          </span>
        </div>

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: printableOnly ? '10px' : '14px', padding: printableOnly ? '0.55rem 0.65rem' : '0.875rem 1rem' }}>
          <span style={{ fontSize: printableOnly ? '10px' : '11px', color: '#92400e', fontWeight: 900, display: 'block', whiteSpace: 'nowrap' }}>💼 عُهد مسلّمة (125)</span>
          <div style={{ fontSize: printableOnly ? '13px' : 'var(--fs-lg)', fontWeight: 900, color: '#b45309', marginTop: '2px' }}>{formatCurrency(today.custodies.total)}</div>
          <span style={{ fontSize: printableOnly ? '9.5px' : '11px', color: '#92400e', fontWeight: 700 }}>{today.custodies.count} عهدة (مستقلة)</span>
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: printableOnly ? '10px' : '14px', padding: printableOnly ? '0.55rem 0.65rem' : '0.875rem 1rem' }}>
          <span style={{ fontSize: printableOnly ? '10px' : '11px', color: '#166534', fontWeight: 900, display: 'block', whiteSpace: 'nowrap' }}>💰 المحصل اليوم (قبض)</span>
          <div style={{ fontSize: printableOnly ? '13px' : 'var(--fs-lg)', fontWeight: 900, color: '#16a34a', marginTop: '2px' }}>{formatCurrency(today.receipts.total)}</div>
          <span style={{ fontSize: printableOnly ? '9.5px' : '11px', color: '#15803d', fontWeight: 700 }}>{today.receipts.count} سند • خامات: {formatCurrency(today.materials.total)}</span>
        </div>
      </div>

      {/* تنبيه إن لم توجد حركات في اليوم المحدد */}
      {!report.hasActivityToday && (
        <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '14px', padding: '1.25rem', textAlign: 'center', color: '#64748b', fontWeight: 800 }}>
          لا توجد حركات مسجلة على المشروع بتاريخ <span style={{ direction: 'ltr', display: 'inline-block' }}>{selectedDate}</span>.
          {activeDates.length > 0 && !printableOnly && (
            <button
              onClick={() => onDateChange(activeDates[0])}
              style={{
                marginRight: '10px',
                background: THEME.primary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '4px 12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              عرض آخر يوم نشط ({activeDates[0]})
            </button>
          )}
        </div>
      )}

      {/* جدول يوميات العمالة ليوم التقرير */}
      {today.labor.count > 0 && (
        <div className="phi-print-unclip" style={{ background: 'white', borderRadius: printableOnly ? '10px' : '14px', border: '1px solid #e2e8f0', overflow: printableOnly ? 'visible' : 'hidden' }}>
          <div style={{ padding: printableOnly ? '0.5rem 0.75rem' : '0.75rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 900, fontSize: printableOnly ? '12px' : '13px', color: '#0f172a', display: 'flex', justifyContent: 'space-between' }}>
            <span><HardHat size={15} style={{ display: 'inline', marginLeft: '6px', color: THEME.primary }} /> يوميات العمالة الميدانية ({today.labor.count} سجل — {today.labor.totalDays} يوم)</span>
            <span style={{ color: '#0284c7' }}>الإجمالي: {formatCurrency(today.labor.totalCost)}</span>
          </div>
          <div className="phi-print-unclip" style={{ overflowX: printableOnly ? 'visible' : 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.625rem 0.75rem' }}>اسم العامل</th>
                  <th style={{ padding: '0.625rem 0.75rem' }}>الفئة</th>
                  <th style={{ padding: '0.625rem 0.75rem' }}>البند / العمل</th>
                  <th style={{ padding: '0.625rem 0.75rem' }}>الحضور</th>
                  <th style={{ padding: '0.625rem 0.75rem' }}>اليومية</th>
                  <th style={{ padding: '0.625rem 0.75rem' }}>الإنتاجية / الطريحة</th>
                  <th style={{ padding: '0.625rem 0.75rem' }}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {today.labor.logs.map((l: any, i: number) => (
                  <tr key={l.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.625rem 0.75rem', fontWeight: 800, color: '#0f172a' }}>{l.worker_name}</td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 800,
                        background: l.is_helper ? '#ccfbf1' : '#e0f2fe',
                        color: l.is_helper ? '#0f766e' : '#0369a1',
                      }}>
                        {l.role_label}
                      </span>
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem', color: '#334155' }}>{l.work_item || '—'}</td>
                    <td style={{ padding: '0.625rem 0.75rem', fontWeight: 800 }}>{l.attendance_days} يوم</td>
                    <td style={{ padding: '0.625rem 0.75rem', fontWeight: 900, color: '#0f172a' }}>{formatCurrency(l.amount)}</td>
                    <td style={{ padding: '0.625rem 0.75rem', color: '#64748b' }}>
                      {l.tareeha != null ? `منفذ ${l.productivity ?? 0} / ${l.tareeha} ${l.unit || ''}` : (l.productivity != null ? `${l.productivity} ${l.unit || ''}` : '—')}
                    </td>
                    <td style={{ padding: '0.625rem 0.75rem' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, background: l.is_posted ? '#dcfce7' : '#f1f5f9', color: l.is_posted ? '#15803d' : '#475569' }}>
                        {l.is_posted ? 'مرحّل' : 'مسودة'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* المصروفات المباشرة + سندات الصرف والعُهد */}
      {(today.expenses.count > 0 || today.vouchers.count > 0 || today.custodies.count > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: printableOnly ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(20rem, 1fr))', gap: printableOnly ? '0.65rem' : '1rem' }}>
          {today.expenses.count > 0 && (
            <div className="phi-print-unclip" style={{ background: 'white', borderRadius: printableOnly ? '10px' : '14px', border: '1px solid #e2e8f0', overflow: printableOnly ? 'visible' : 'hidden' }}>
              <div style={{ padding: printableOnly ? '0.5rem 0.75rem' : '0.75rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 900, fontSize: printableOnly ? '12px' : '13px', display: 'flex', justifyContent: 'space-between' }}>
                <span><Receipt size={15} style={{ display: 'inline', marginLeft: '6px' }} /> مصروفات المشروع اليوم ({today.expenses.count})</span>
                <span>{formatCurrency(today.expenses.total)}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: printableOnly ? '11px' : '12px', textAlign: 'right' }}>
                <tbody>
                  {today.expenses.items.map((e: any, idx: number) => (
                    <tr key={e.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 800 }}>{e.description}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>{e.main_category || 'عام'}</td>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 900 }}>{formatCurrency(e.total_price || e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(today.vouchers.count > 0 || today.custodies.count > 0) && (
            <div className="phi-print-unclip" style={{ background: 'white', borderRadius: printableOnly ? '10px' : '14px', border: '1px solid #e2e8f0', overflow: printableOnly ? 'visible' : 'hidden' }}>
              <div style={{ padding: printableOnly ? '0.5rem 0.75rem' : '0.75rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 900, fontSize: printableOnly ? '12px' : '13px', display: 'flex', justifyContent: 'space-between' }}>
                <span><Wallet size={15} style={{ display: 'inline', marginLeft: '6px' }} /> سندات الصرف والعُهد ({today.vouchers.count + today.custodies.count})</span>
                <span>صرف: {formatCurrency(today.vouchers.total)}{today.custodies.total > 0 ? ` • عُهد: ${formatCurrency(today.custodies.total)}` : ''}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: printableOnly ? '11px' : '12px', textAlign: 'right' }}>
                <tbody>
                  {[...today.custodies.items, ...today.vouchers.items].map((v: any, idx: number) => (
                    <tr key={v.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: v.voucher_kind === 'custody' ? '#fffbeb' : 'transparent' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 800, whiteSpace: 'nowrap' }}>{v.voucher_number || 'مسودة'}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <div style={{ fontWeight: 700 }}>{v.description || v.notes || '—'}</div>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: v.voucher_kind === 'custody' ? '#b45309' : '#475569' }}>
                          {v.kind_label}{v.partner?.name ? ` • ${v.partner.name}` : ''}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 900, whiteSpace: 'nowrap' }}>{formatCurrency(v.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* الخامات المنصرفة + سندات القبض + الزيارات الميدانية */}
      {(today.materials.count > 0 || today.receipts.count > 0 || today.siteVisits.count > 0 || today.subClaims.count > 0) && (
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #f1f5f9', padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '12px' }}>
          <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: '2px' }}>
            <Package size={15} style={{ display: 'inline', marginLeft: '6px' }} /> الحركات المساندة والميدانية في يوم التقرير
          </div>
          {today.receipts.items.map((r: any, idx: number) => (
            <div key={`rv-${idx}`}>• 💰 سند قبض #{r.receipt_number}: <strong>{formatCurrency(r.amount)}</strong> {r.notes ? `(${r.notes})` : ''}</div>
          ))}
          {today.materials.items.map((m: any, idx: number) => (
            <div key={`mat-${idx}`}>• 📦 صرف خامات ({m.issue_number || 'إذن'}): <strong>{formatCurrency(m.total_amount)}</strong></div>
          ))}
          {today.subClaims.items.map((c: any, idx: number) => (
            <div key={`clm-${idx}`}>• 📑 مستخلص مقاول #{c.display_number || c.claim_number}: <strong>{formatCurrency(c.final_amount ?? c.net_amount)}</strong> ({c.status || 'معتمد'})</div>
          ))}
          {today.siteVisits.items.map((sv: any, idx: number) => (
            <div key={`sv-${idx}`}>• 🦺 زيارة إشراف: <strong>{sv.title}</strong> ({sv.boq_item_name || 'عام'}) — م/ {sv.inspector_name} [{sv.status}]</div>
          ))}
        </div>
      )}

      {/* الموقف التراكمي وأوامر الشغل وجدول الدفعات حتى تاريخه */}
      <div
        className="dossier-keep-together"
        style={{
          background: '#f8fafc',
          borderRadius: printableOnly ? '10px' : '16px',
          padding: printableOnly ? '0.75rem 1rem' : '1rem 1.25rem',
          border: '1px solid #e2e8f0',
          display: 'grid',
          gridTemplateColumns: printableOnly ? 'repeat(3, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(15rem, 1fr))',
          gap: printableOnly ? '0.75rem' : '1rem',
          fontSize: printableOnly ? '11.5px' : '12px',
        }}
      >
        <div>
          <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: '0.4rem' }}>
            <Wrench size={14} style={{ display: 'inline', marginLeft: '5px', color: THEME.primary }} />
            الموقف المالي التراكمي للمشروع
          </div>
          <div>الميزانية المعتمدة: <strong>{formatCurrency(cumulative.estimatedBudget)}</strong></div>
          <div>التكلفة الفعلية التراكمية: <strong style={{ color: '#be123c' }}>{formatCurrency(cumulative.totalActualCost)}</strong></div>
          <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700 }}>
            (عمالة: {formatCurrency(cumulative.actualLaborCost)} | مستخلصات باطن: {formatCurrency(cumulative.actualSubcontractorCost)} | مصروفات مباشرة: {formatCurrency(Math.max(0, cumulative.actualExpensesCost - cumulative.actualSubcontractorCost))} | خامات: {formatCurrency(cumulative.actualMaterialsCost)}{cumulative.actualAbcAllocated > 0 ? ` | ABC: ${formatCurrency(cumulative.actualAbcAllocated)}` : ''})
          </div>
          <div>الانحراف عن الميزانية: <strong style={{ color: cumulative.budgetVariance >= 0 ? '#15803d' : '#dc2626' }}>{formatCurrency(cumulative.budgetVariance)}</strong></div>
        </div>

        <div>
          <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: '0.4rem' }}>
            <DollarSign size={14} style={{ display: 'inline', marginLeft: '5px', color: '#16a34a' }} />
            موقف التحصيل ودفعات العميل
          </div>
          <div>قيمة العقد: <strong>{formatCurrency(cumulative.contractValue)}</strong></div>
          <div>المحصل من العميل حتى الآن: <strong style={{ color: '#16a34a' }}>{formatCurrency(cumulative.totalCashCollected)}</strong></div>
          {sched.rows.length > 0 && (
            <div>
              المتبقي: <strong style={{ color: '#dc2626' }}>{formatCurrency(sched.totalRemaining)}</strong>
              {sched.overdueAmount > 0 && ` (متأخر: ${formatCurrency(sched.overdueAmount)})`}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: '0.4rem' }}>
            <Layers size={14} style={{ display: 'inline', marginLeft: '5px', color: '#d97706' }} />
            أوامر الشغل والمقاولين
          </div>
          <div>أوامر الشغل الجارية: <strong>{today.jobOrders.active.length}</strong> | المكتملة: <strong>{today.jobOrders.completed.length}</strong></div>
          <div>إنجاز المشروع الفعلي: <strong>{cumulative.physicalProgress}%</strong></div>
          <div>تاريخ التحرير: <strong dir="ltr">{formatDate(selectedDate)}</strong></div>
        </div>
      </div>
    </div>
  );
}
