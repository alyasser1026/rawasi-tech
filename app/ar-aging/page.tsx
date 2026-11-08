'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  FileSpreadsheet,
  Layers,
  Printer,
  RefreshCw,
  Search,
  TriangleAlert,
  Users,
} from 'lucide-react';
import MasterPage from '@/components/MasterPage';
import LoadingScreen from '@/components/LoadingScreen';
import { useCompany } from '@/lib/CompanyContext';
import { usePermissions } from '@/lib/PermissionsContext';
import { notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import {
  type AgingDoc,
  type AgingPartner,
  type AgingPartyType,
  type AgingProject,
  type AgingReport,
  bucketColors,
  bucketLabels,
  exportAgingToExcel,
  formatAgingCurrency,
  formatAgingPercent,
  partyTypeLabels,
  partyTypeTabs,
} from './agingModel';
import styles from './ar-aging.module.css';

export default function ArAgingPage() {
  const queryClient = useQueryClient();
  const { activeCompany } = useCompany();
  const { can, role } = usePermissions();

  const [partyType, setPartyType] = useState<AgingPartyType>('customers');
  const [asOfDate, setAsOfDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [viewMode, setViewMode] = useState<'partners' | 'projects'>('partners');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPartners, setExpandedPartners] = useState<Record<string, boolean>>({});
  const [isExporting, setIsExporting] = useState(false);

  const togglePartner = (partnerId: string) => {
    setExpandedPartners(prev => ({ ...prev, [partnerId]: !prev[partnerId] }));
  };

  const [migrationPending, setMigrationPending] = useState(false);
  const { data: report, isLoading, isError, error, refetch, isFetching } = useQuery<AgingReport | null>({
    queryKey: ['ar-aging', activeCompany?.id, partyType, asOfDate],
    retry: false,
    queryFn: async () => {
      setMigrationPending(false);
      const { data, error } = await supabase.rpc('get_aging_report', {
        p_party_type: partyType,
        p_as_of_date: asOfDate,
      });
      if (error) {
        if (error.code === 'PGRST202' || error.message?.includes('get_aging_report') || error.message?.includes('404')) {
          setMigrationPending(true);
          return null;
        }
        throw new Error(error.message);
      }
      return data as AgingReport;
    },
    enabled: Boolean(activeCompany?.id),
    staleTime: 30000,
  });

  const handleExport = async () => {
    if (!report) return;
    try {
      setIsExporting(true);
      await exportAgingToExcel(report, partyType);
      notify.success('تم تصدير ملف الأكسيل بنجاح');
    } catch (err: any) {
      notify.error(err?.message || 'تعذر تصدير تقرير الأعمار');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading && !report) {
    return <LoadingScreen message="جاري إعداد تقرير أعمار الذمم ومطابقة الأستاذ..." />;
  }

  const kpis = report?.kpis;
  const rec = report?.gl_reconciliation;

  // Search filtering
  const query = searchQuery.trim().toLowerCase();
  const filteredPartners = (report?.partners || []).filter(p => {
    if (!query) return true;
    const nameMatch = p.partner_name?.toLowerCase().includes(query);
    const codeMatch = p.partner_code?.toLowerCase().includes(query);
    const docMatch = p.documents?.some(d => d.doc_number?.toLowerCase().includes(query));
    return nameMatch || codeMatch || docMatch;
  });

  const filteredProjects = (report?.projects || []).filter(pr => {
    if (!query) return true;
    return pr.project_name?.toLowerCase().includes(query);
  });

  return (
    <MasterPage title="أعمار الذمم والتحصيل" subtitle="تحليل الفترات، المتأخرات، ومطابقة حسابات الأستاذ العام بنقطة قطع دقيقة">
      <div className={styles.page} dir="rtl">
        {/* Top Controls Bar */}
        <div className={styles.topBar}>
          {/* Party Type Tabs */}
          <div className={styles.partyTabs} role="tablist">
            {partyTypeTabs.map(tab => {
              const active = partyType === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  className={`${styles.tabBtn} ${active ? styles.tabBtnActive : ''}`}
                  onClick={() => setPartyType(tab.id)}
                >
                  <span>{tab.label}</span>
                  <span className={styles.accountBadge}>{tab.account}</span>
                </button>
              );
            })}
          </div>

          {/* Action Tools */}
          <div className={styles.actionsGroup}>
            <div className={styles.dateControl} title="تاريخ نقطة القطع (تجاهل كافة العمليات اللاحقة)">
              <Calendar size={16} aria-hidden="true" />
              <span>بتاريخ:</span>
              <input
                type="date"
                value={asOfDate}
                onChange={e => setAsOfDate(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="ent-button"
              onClick={() => refetch()}
              disabled={isFetching}
              title="تحديث البيانات"
            >
              <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
              <span>تحديث</span>
            </button>

            <button
              type="button"
              className="ent-button"
              onClick={handleExport}
              disabled={isExporting || !report}
              title="تصدير إلى Excel"
            >
              <FileSpreadsheet size={16} />
              <span>{isExporting ? 'جاري التصدير…' : 'تصدير إكسيل'}</span>
            </button>

            <button
              type="button"
              className="ent-button"
              onClick={handlePrint}
              disabled={!report}
              title="طباعة تقرير A4"
            >
              <Printer size={16} />
              <span>طباعة</span>
            </button>
          </div>
        </div>

        {/* GL Reconciliation Alert Banner */}
        {rec && (
          <div className={`${styles.reconcileCard} ${rec.is_reconciled ? styles.reconciled : styles.reconcileWarn}`}>
            <div className={styles.reconcileLeft}>
              {rec.is_reconciled ? (
                <>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <span>مطابق تمامًا لحساب الأستاذ العام ({rec.account_code} - {rec.account_name ?? '—'})</span>
                </>
              ) : (
                <>
                  <TriangleAlert size={18} aria-hidden="true" />
                  <span>يوجد فارق بين دفتر الأستاذ العام ومجموع الذمم الفرعية ({rec.account_code})</span>
                </>
              )}
            </div>
            <div className={styles.reconcileValues}>
              <span>رصيد الأستاذ: <strong>{formatAgingCurrency(rec.gl_balance)}</strong></span>
              <span>رصيد الفرعي: <strong>{formatAgingCurrency(rec.subledger_balance)}</strong></span>
              <span>الفارق: <strong>{formatAgingCurrency(rec.variance)}</strong></span>
            </div>
          </div>
        )}

        {/* Pending Migration Notification */}
        {migrationPending && (
          <div style={{ background: 'var(--surface-card)', padding: '1.5rem', borderRadius: 'var(--phi-radius-card, 18px)', boxShadow: 'var(--shadow-ambient)', border: 'none', marginBottom: '1.25rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: '8%', right: '8%', height: '1.5px', background: 'var(--specular-beam)' }} />
            <TriangleAlert size={28} style={{ color: 'var(--accent-ink)', margin: '0 auto 0.75rem' }} />
            <h3 style={{ margin: '0 0 0.5rem', fontSize: 'var(--fs-lg)', fontWeight: 900, color: 'var(--text-primary)' }}>دالة احتساب أعمار الذمم بانتظار التفعيل</h3>
            <p style={{ margin: '0 0 1rem', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              لم يتم العثور على دالة <code>get_aging_report</code> في قاعدة بيانات Supabase. يرجى فتح <strong>SQL Editor</strong> وتشغيل ملف الهجرة:
              <br /><code style={{ background: 'var(--surface-sunken)', padding: '0.25rem 0.625rem', borderRadius: '6px', color: 'var(--accent-ink)', fontWeight: 800 }}>supabase/migrations/20261105170006_ar_aging_reports.sql</code>
            </p>
          </div>
        )}

        {/* Error Notification */}
        {isError && !migrationPending && (
          <div className="ent-alert ent-alert-danger">
            <TriangleAlert size={18} />
            <span>{error instanceof Error ? error.message : 'تعذر تحميل تقرير الأعمار'}</span>
          </div>
        )}

        {/* Top KPI Cards Strip */}
        {kpis && (
          <div className={styles.kpiStrip}>
            {/* Total Due */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>
                <span>إجمالي الذمم القائمة</span>
                <Users size={16} />
              </div>
              <div className={styles.kpiValue}>{formatAgingCurrency(kpis.total_due)}</div>
              <div className={styles.kpiSub}>
                مجموع الأرصدة المتبقية حتى {asOfDate}
              </div>
            </div>

            {/* Total Overdue */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>
                <span>إجمالي المتأخرات</span>
                <TriangleAlert size={16} style={{ color: '#ef4444' }} />
              </div>
              <div className={styles.kpiValue} style={{ color: kpis.overdue_balance > 0 ? '#ef4444' : undefined }}>
                {formatAgingCurrency(kpis.overdue_balance)}
              </div>
              <div className={styles.kpiSub}>
                {kpis.total_due > 0
                  ? `تمثل ${formatAgingPercent((kpis.overdue_balance / kpis.total_due) * 100)} من إجمالي المديونية`
                  : 'لا توجد متأخرات'}
              </div>
            </div>

            {/* Collection / Payment Rate */}
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>
                <span>{partyType === 'customers' ? 'معدل التحصيل' : 'معدل السداد'}</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>{formatAgingPercent(kpis.collection_rate_percent)}</span>
              </div>
              <div className={styles.kpiValue}>{formatAgingCurrency(kpis.total_collected)}</div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${Math.min(100, Math.max(0, kpis.collection_rate_percent))}%` }}
                />
              </div>
              <div className={styles.kpiSub}>
                مسدد من إجمالي {formatAgingCurrency(kpis.total_sales)}
              </div>
            </div>
          </div>
        )}

        {/* 6 Aging Buckets Strip */}
        {kpis && (
          <div className={styles.bucketsRow}>
            {/* Current */}
            <div className={styles.bucketCard} style={{ borderTopColor: bucketColors.current }}>
              <div className={styles.bucketTitle}>{bucketLabels.current}</div>
              <div className={styles.bucketAmount}>{formatAgingCurrency(kpis.current_balance)}</div>
            </div>

            {/* 1 - 30 */}
            <div className={styles.bucketCard} style={{ borderTopColor: bucketColors.days_1_30 }}>
              <div className={styles.bucketTitle}>{bucketLabels.days_1_30}</div>
              <div className={styles.bucketAmount}>{formatAgingCurrency(kpis.days_1_30)}</div>
            </div>

            {/* 31 - 60 */}
            <div className={styles.bucketCard} style={{ borderTopColor: bucketColors.days_31_60 }}>
              <div className={styles.bucketTitle}>{bucketLabels.days_31_60}</div>
              <div className={styles.bucketAmount}>{formatAgingCurrency(kpis.days_31_60)}</div>
            </div>

            {/* 61 - 90 */}
            <div className={styles.bucketCard} style={{ borderTopColor: bucketColors.days_61_90 }}>
              <div className={styles.bucketTitle}>{bucketLabels.days_61_90}</div>
              <div className={styles.bucketAmount}>{formatAgingCurrency(kpis.days_61_90)}</div>
            </div>

            {/* +90 */}
            <div className={styles.bucketCard} style={{ borderTopColor: bucketColors.over_90 }}>
              <div className={styles.bucketTitle}>{bucketLabels.over_90}</div>
              <div className={styles.bucketAmount} style={{ color: kpis.over_90 > 0 ? '#ef4444' : undefined }}>
                {formatAgingCurrency(kpis.over_90)}
              </div>
            </div>

            {/* Unspecified */}
            <div className={styles.bucketCard} style={{ borderTopColor: bucketColors.unspecified }}>
              <div className={styles.bucketTitle}>{bucketLabels.unspecified}</div>
              <div className={styles.bucketAmount}>{formatAgingCurrency(kpis.unspecified)}</div>
            </div>
          </div>
        )}

        {/* Top 5 Debtors Section */}
        {report?.top_debtors && report.top_debtors.length > 0 && (
          <div className={styles.topDebtorsSection}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                {partyType === 'customers' ? 'أكبر 5 مدينين (تركّز المتأخرات)' : 'أكبر 5 مستحقين'}
              </h3>
            </div>
            <div className={styles.debtorsGrid}>
              {report.top_debtors.map(debtor => (
                <div key={debtor.partner_id} className={styles.debtorItem}>
                  <Link
                    href={`/statement?partner_id=${debtor.partner_id}`}
                    className={`${styles.debtorName} ${styles.statementLink}`}
                    title="فتح كشف الحساب"
                  >
                    {debtor.partner_name}
                  </Link>
                  <div className={styles.debtorAmounts}>
                    <span>المتأخر: <strong>{formatAgingCurrency(debtor.overdue_balance)}</strong></span>
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>{formatAgingPercent(debtor.overdue_share_percent)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Details Table Container */}
        <div className={styles.tableContainer}>
          <div className={styles.tableToolbar}>
            {/* View Mode Toggle */}
            <div className={styles.viewModeSwitch}>
              <button
                type="button"
                className={`${styles.viewModeBtn} ${viewMode === 'partners' ? styles.viewModeBtnActive : ''}`}
                onClick={() => setViewMode('partners')}
              >
                <Users size={14} style={{ display: 'inline', marginInlineEnd: '4px' }} />
                <span>حسب الشركاء</span>
              </button>
              <button
                type="button"
                className={`${styles.viewModeBtn} ${viewMode === 'projects' ? styles.viewModeBtnActive : ''}`}
                onClick={() => setViewMode('projects')}
              >
                <Layers size={14} style={{ display: 'inline', marginInlineEnd: '4px' }} />
                <span>حسب المشاريع</span>
              </button>
            </div>

            {/* Search Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={16} color="var(--text-secondary)" />
              <input
                type="text"
                placeholder="بحث بالاسم، الكود، أو المستند..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.tableScroll}>
            {viewMode === 'partners' ? (
              <table className={styles.agingTable}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th>الشريك</th>
                    <th>المستندات</th>
                    <th>إجمالي المستحق</th>
                    <th>الحالي</th>
                    <th>1 - 30</th>
                    <th>31 - 60</th>
                    <th>61 - 90</th>
                    <th>+90</th>
                    <th>غير محدد</th>
                    <th>المتأخرات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPartners.length === 0 ? (
                    <tr>
                      <td colSpan={11} className={styles.emptyState}>
                        لا توجد أرصدة مفتوحة لهذا التصنيف بتاريخ {asOfDate}
                      </td>
                    </tr>
                  ) : (
                    filteredPartners.map(partner => {
                      const isExpanded = Boolean(expandedPartners[partner.partner_id]);
                      return (
                        <>
                          <tr key={partner.partner_id}>
                            <td>
                              <button
                                type="button"
                                className={styles.toggleDocsBtn}
                                onClick={() => togglePartner(partner.partner_id)}
                                title={isExpanded ? 'إخفاء المستندات' : 'عرض تفاصيل المستندات'}
                              >
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronLeft size={16} />}
                              </button>
                            </td>
                            <td>
                              <div className={styles.partnerNameCell}>
                                <Link
                                  href={`/statement?partner_id=${partner.partner_id}`}
                                  className={styles.statementLink}
                                  title="فتح كشف حساب الشريك"
                                >
                                  {partner.partner_name}
                                </Link>
                                {partner.partner_code && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    ({partner.partner_code})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>{partner.open_docs_count}</td>
                            <td><strong>{formatAgingCurrency(partner.total_due)}</strong></td>
                            <td>{formatAgingCurrency(partner.current_balance)}</td>
                            <td>{formatAgingCurrency(partner.days_1_30)}</td>
                            <td>{formatAgingCurrency(partner.days_31_60)}</td>
                            <td>{formatAgingCurrency(partner.days_61_90)}</td>
                            <td style={{ color: partner.over_90 > 0 ? '#ef4444' : undefined }}>
                              {formatAgingCurrency(partner.over_90)}
                            </td>
                            <td>{formatAgingCurrency(partner.unspecified)}</td>
                            <td style={{ color: partner.overdue_balance > 0 ? '#ef4444' : undefined, fontWeight: 700 }}>
                              {formatAgingCurrency(partner.overdue_balance)}
                            </td>
                          </tr>

                          {/* Expanded Document Details Subtable */}
                          {isExpanded && (
                            <tr key={`${partner.partner_id}-docs`} className={styles.docsDetailRow}>
                              <td colSpan={11}>
                                <div className={styles.docsContainer}>
                                  <table className={styles.agingTable} style={{ background: 'transparent' }}>
                                    <thead>
                                      <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                                        <th>رقم المستند</th>
                                        <th>النوع</th>
                                        <th>تاريخ المستند</th>
                                        <th>الاستحقاق</th>
                                        <th>المشروع</th>
                                        <th>الأصلي</th>
                                        <th>التعديلات</th>
                                        <th>الصافي</th>
                                        <th>المسدد</th>
                                        <th>المتبقي</th>
                                        <th>التأخير</th>
                                        <th>الشريحة</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(partner.documents || []).map(doc => (
                                        <tr key={doc.doc_id}>
                                          <td style={{ fontWeight: 600 }}>{doc.doc_number}</td>
                                          <td>{doc.doc_type}</td>
                                          <td>{doc.doc_date}</td>
                                          <td>{doc.due_date ?? 'غير محدد'}</td>
                                          <td>{doc.project_name ?? '—'}</td>
                                          <td>{formatAgingCurrency(doc.original_amount)}</td>
                                          <td>{formatAgingCurrency(doc.adjustment_amount)}</td>
                                          <td>{formatAgingCurrency(doc.adjusted_total)}</td>
                                          <td>{formatAgingCurrency(doc.paid_amount)}</td>
                                          <td><strong>{formatAgingCurrency(doc.remaining_balance)}</strong></td>
                                          <td>
                                            {doc.overdue_days != null ? (
                                              doc.overdue_days > 0 ? (
                                                <span style={{ color: '#ef4444' }}>{doc.overdue_days} يوم</span>
                                              ) : (
                                                <span style={{ color: '#10b981' }}>حالي ({Math.abs(doc.overdue_days)} يوم متبقي)</span>
                                              )
                                            ) : (
                                              '—'
                                            )}
                                          </td>
                                          <td>
                                            <span
                                              className={styles.docBadge}
                                              style={{
                                                background: `${bucketColors[doc.bucket]}20`,
                                                color: bucketColors[doc.bucket],
                                                border: `1px solid ${bucketColors[doc.bucket]}40`,
                                              }}
                                            >
                                              {bucketLabels[doc.bucket] ?? doc.bucket}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              /* Projects View */
              <table className={styles.agingTable}>
                <thead>
                  <tr>
                    <th>المشروع</th>
                    <th>المستندات المفتوحة</th>
                    <th>إجمالي المستحق</th>
                    <th>الحالي</th>
                    <th>1 - 30</th>
                    <th>31 - 60</th>
                    <th>61 - 90</th>
                    <th>+90</th>
                    <th>غير محدد</th>
                    <th>إجمالي المتأخرات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={10} className={styles.emptyState}>
                        لا توجد أرصدة مفتوحة للمشاريع بتاريخ {asOfDate}
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map(proj => (
                      <tr key={proj.project_id}>
                        <td style={{ fontWeight: 600 }}>{proj.project_name}</td>
                        <td>{proj.open_docs_count}</td>
                        <td><strong>{formatAgingCurrency(proj.total_due)}</strong></td>
                        <td>{formatAgingCurrency(proj.current_balance)}</td>
                        <td>{formatAgingCurrency(proj.days_1_30)}</td>
                        <td>{formatAgingCurrency(proj.days_31_60)}</td>
                        <td>{formatAgingCurrency(proj.days_61_90)}</td>
                        <td style={{ color: proj.over_90 > 0 ? '#ef4444' : undefined }}>
                          {formatAgingCurrency(proj.over_90)}
                        </td>
                        <td>{formatAgingCurrency(proj.unspecified)}</td>
                        <td style={{ color: proj.overdue_balance > 0 ? '#ef4444' : undefined, fontWeight: 700 }}>
                          {formatAgingCurrency(proj.overdue_balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </MasterPage>
  );
}
