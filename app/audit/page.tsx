"use client";

import React, { useState, useEffect, useMemo } from 'react';
import MasterPage from '@/components/MasterPage';
import styles from './audit.module.css';
import {
  fetchSystemHealthRadar,
  fetchDocumentExpiryAlerts,
  upsertCompanyDocument,
  markCompanyDocumentRenewed,
  runDailyScanManually,
  HealthRadarSummary,
  DocumentExpiryAlertsResponse,
  CompanyDocument,
  RetentionGuarantee,
} from './auditModel';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast-context';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Plus,
  ExternalLink,
  Calendar,
  Building2,
  Bell,
  Truck,
  UserCheck,
  FileText,
  FileCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';

export default function ComplianceAndAuditPage() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'radar' | 'expiry' | 'retention' | 'alerts'>('radar');

  // Radar State
  const [radar, setRadar] = useState<HealthRadarSummary | null>(null);
  const [loadingRadar, setLoadingRadar] = useState(true);
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null);

  // Expiry & Retention State
  const [expiry, setExpiry] = useState<DocumentExpiryAlertsResponse | null>(null);
  const [loadingExpiry, setLoadingExpiry] = useState(true);
  const [docFilter, setDocFilter] = useState<'all' | 'expired' | 'critical' | 'upcoming' | 'safe' | 'renewed'>('all');

  // Master Data for Dropdowns
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; Property: string }[]>([]);
  const [assets, setAssets] = useState<{ id: string; name: string }[]>([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<CompanyDocument | null>(null);
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);
  const [runningScan, setRunningScan] = useState(false);

  // Form State
  const [form, setForm] = useState({
    document_number: '',
    title: '',
    doc_type: 'worker_iqama',
    expiry_date: '',
    issue_date: '',
    alert_days_before: 30,
    partner_id: '',
    project_id: '',
    asset_id: '',
    notes: '',
  });

  const loadRadar = async () => {
    try {
      setLoadingRadar(true);
      const data = await fetchSystemHealthRadar();
      setRadar(data);
    } catch (err: any) {
      showToast(`تعذر جلب بيانات الرادار: ${err.message}`, 'error');
    } finally {
      setLoadingRadar(false);
    }
  };

  const loadExpiry = async () => {
    try {
      setLoadingExpiry(true);
      const data = await fetchDocumentExpiryAlerts(30);
      setExpiry(data);
    } catch (err: any) {
      showToast(`تعذر جلب تنبيهات المستندات: ${err.message}`, 'error');
    } finally {
      setLoadingExpiry(false);
    }
  };

  const loadMasterData = async () => {
    try {
      const [pRes, prRes, aRes] = await Promise.all([
        supabase.from('partners').select('id, name').order('name'),
        supabase.from('projects').select('id, Property').order('"Property"'),
        supabase.from('fixed_assets').select('id, name').order('name'),
      ]);
      if (pRes.data) setPartners(pRes.data);
      if (prRes.data) setProjects(prRes.data);
      if (aRes.data) setAssets(aRes.data);
    } catch {
      // Non-blocking fallback
    }
  };

  useEffect(() => {
    loadRadar();
    loadExpiry();
    loadMasterData();
  }, []);

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.document_number.trim() || !form.title.trim() || !form.expiry_date) {
      showToast('يرجى ملء كافة الحقول الإلزامية (رقم المستند، العنوان، وتاريخ الانتهاء)', 'error');
      return;
    }

    try {
      setSavingDoc(true);
      await upsertCompanyDocument({
        document_number: form.document_number.trim(),
        title: form.title.trim(),
        doc_type: form.doc_type,
        expiry_date: form.expiry_date,
        issue_date: form.issue_date || null,
        alert_days_before: Number(form.alert_days_before) || 30,
        partner_id: form.partner_id || null,
        project_id: form.project_id || null,
        asset_id: form.asset_id || null,
        notes: form.notes || null,
      });

      showToast('تم حفظ وثيقة الشركة بنجاح', 'success');
      setShowAddModal(false);
      setForm({
        document_number: '',
        title: '',
        doc_type: 'worker_iqama',
        expiry_date: '',
        issue_date: '',
        alert_days_before: 30,
        partner_id: '',
        project_id: '',
        asset_id: '',
        notes: '',
      });
      loadExpiry();
    } catch (err: any) {
      showToast(`فشل حفظ المستند: ${err.message}`, 'error');
    } finally {
      setSavingDoc(false);
    }
  };

  const handleRenewDocument = async () => {
    if (!selectedDoc) return;
    try {
      setSavingDoc(true);
      await markCompanyDocumentRenewed(selectedDoc.id, newExpiryDate || undefined);
      showToast('تم تجديد المستند وتحديث الصلاحية بنجاح', 'success');
      setShowRenewModal(false);
      setSelectedDoc(null);
      setNewExpiryDate('');
      loadExpiry();
    } catch (err: any) {
      showToast(`فشل تجديد المستند: ${err.message}`, 'error');
    } finally {
      setSavingDoc(false);
    }
  };

  const handleRunDailyScan = async () => {
    try {
      setRunningScan(true);
      const count = await runDailyScanManually();
      showToast(
        count > 0
          ? `اكتمل الفحص الدوري: تم توليد ${count} تنبيهات جديدة في مركز الإشعارات.`
          : 'اكتمل الفحص الدوري: لا توجد إشعارات جديدة متكررة (كافة الملاحظات المفتوحة مرصودة مسبقاً).',
        'success'
      );
      loadRadar();
      loadExpiry();
    } catch (err: any) {
      showToast(`تعذر تشغيل الفحص التلقائي: ${err.message}`, 'error');
    } finally {
      setRunningScan(false);
    }
  };

  const filteredDocs = useMemo(() => {
    if (!expiry?.documents) return [];
    if (docFilter === 'all') return expiry.documents;
    return expiry.documents.filter(d => d.status === docFilter);
  }, [expiry, docFilter]);

  return (
    <MasterPage title="الرقابة والتنبيهات ورادار صحة البيانات" subtitle="الفحص اللحظي للشذوذ المالي، تتبع انتهاء المستندات، وفك ضمانات الأعمال">
      <div className={styles.container}>
        {/* Header Actions */}
        <div className={styles.headerSection}>
          <div className={styles.titleArea}>
            <h1>
              <ShieldAlert size={28} color="#d97706" />
              منظومة الرقابة والامتثال الذكية
            </h1>
            <p>رصد استباقي للتشوهات والقيود اليتيمة، ومراقبة دقيقة لمواعيد تجديد الإقامات والرخص والضمانات</p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => { loadRadar(); loadExpiry(); }}
              disabled={loadingRadar || loadingExpiry}
            >
              <RefreshCw size={16} className={loadingRadar || loadingExpiry ? 'spin' : ''} />
              تحديث البيانات
            </button>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleRunDailyScan}
              disabled={runningScan}
            >
              <Bell size={16} />
              {runningScan ? 'جارٍ الفحص...' : 'تشغيل الفحص الدوري (pg_cron)'}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabsBar}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'radar' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('radar')}
          >
            <ShieldAlert size={18} />
            رادار صحة البيانات ({radar?.total_issues ?? '...'})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'expiry' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('expiry')}
          >
            <Clock size={18} />
            انتهاء المستندات والصلاحيات ({expiry?.summary.total_documents ?? '...'})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'retention' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('retention')}
          >
            <FileCheck size={18} />
            مواعيد فك ضمان الأعمال ({expiry?.retention_guarantees?.length ?? 0})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'alerts' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            <Bell size={18} />
            الجدولة التلقائية والإشعارات
          </button>
        </div>

        {/* =================================================================== */}
        {/* TAB 1: DATA HEALTH RADAR */}
        {/* =================================================================== */}
        {activeTab === 'radar' && (
          <div>
            {/* KPI Summary */}
            <div className={styles.kpiGrid}>
              <div className={styles.kpiCard}>
                <div>
                  <h3 className={styles.kpiValue} style={{ color: '#1e293b' }}>
                    {radar?.total_issues ?? 0}
                  </h3>
                  <p className={styles.kpiLabel}>إجمالي الملاحظات والتشوهات</p>
                </div>
                <div className={styles.kpiIcon}>📊</div>
              </div>

              <div className={styles.kpiCard}>
                <div>
                  <h3 className={styles.kpiValue} style={{ color: '#b91c1c' }}>
                    {radar?.critical_count ?? 0}
                  </h3>
                  <p className={styles.kpiLabel}>أخطاء حرجة (تتطلب معالجة فورية)</p>
                </div>
                <div className={styles.kpiIcon}>🚨</div>
              </div>

              <div className={styles.kpiCard}>
                <div>
                  <h3 className={styles.kpiValue} style={{ color: '#b45309' }}>
                    {radar?.medium_count ?? 0}
                  </h3>
                  <p className={styles.kpiLabel}>ملاحظات متوسطة الخطورة</p>
                </div>
                <div className={styles.kpiIcon}>⚠️</div>
              </div>

              <div className={styles.kpiCard}>
                <div>
                  <h3 className={styles.kpiValue} style={{ color: '#854d0e' }}>
                    {radar?.warning_count ?? 0}
                  </h3>
                  <p className={styles.kpiLabel}>تنبيهات تدقيق استرشادية</p>
                </div>
                <div className={styles.kpiIcon}>💡</div>
              </div>
            </div>

            {/* Radar Checks Grid */}
            <div className={styles.radarGrid}>
              {radar?.checks.map(chk => {
                const isExpanded = expandedCheckId === chk.id;
                const isClean = chk.count === 0;

                return (
                  <div key={chk.id} className={styles.radarCard}>
                    <div className={styles.radarCardHeader}>
                      <h4 className={styles.radarCardTitle}>
                        {chk.severity === 'critical' ? '🚨' : chk.severity === 'medium' ? '⚠️' : '💡'}
                        {chk.title_ar}
                      </h4>
                      <span
                        className={`${styles.badge} ${
                          isClean
                            ? styles.badgeSafe
                            : chk.severity === 'critical'
                            ? styles.badgeCritical
                            : chk.severity === 'medium'
                            ? styles.badgeMedium
                            : styles.badgeWarning
                        }`}
                      >
                        {isClean ? 'سليم تماماً' : `${chk.count} حالة`}
                      </span>
                    </div>

                    <div className={styles.radarCardBody}>
                      <p className={styles.radarCountText}>
                        {isClean
                          ? 'لم يتم رصد أي خلل أو تشوه مطابق لهذا الفحص في سجلات الشركة.'
                          : `يوجد (${chk.count}) سجلات بحاجة للتدقيق والتسوية.`}
                      </p>

                      {!isClean && chk.items && chk.items.length > 0 && (
                        <div>
                          <div className={styles.radarItemsList}>
                            {chk.items.slice(0, isExpanded ? 20 : 3).map((item, idx) => (
                              <div key={item.id || idx} className={styles.radarItemRow}>
                                <div className={styles.radarItemLeft}>
                                  <span className={styles.radarItemName}>
                                    {item.identifier || item.id?.slice(0, 8)}
                                  </span>
                                  <span className={styles.radarItemSub}>
                                    {item.date ? `${item.date} — ` : ''}
                                    {item.description || 'بدون تفاصيل'}
                                  </span>
                                </div>
                                {item.amount !== undefined && item.amount !== 0 && (
                                  <span className={styles.radarItemAmount}>
                                    {Number(item.amount).toLocaleString('ar-SA')} ر.س
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>

                          {chk.items.length > 3 && (
                            <button
                              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                              style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}
                              onClick={() => setExpandedCheckId(isExpanded ? null : chk.id)}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp size={14} /> عرض أقل
                                </>
                              ) : (
                                <>
                                  <ChevronDown size={14} /> عرض كل السجلات ({chk.items.length})
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className={styles.radarCardFooter}>
                      <Link href={chk.action_url} className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}>
                        <ExternalLink size={14} />
                        الانتقال للشاشة والمعالجة
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: DOCUMENT EXPIRY & COMPLIANCE */}
        {/* =================================================================== */}
        {activeTab === 'expiry' && (
          <div>
            {/* KPI Summary */}
            <div className={styles.kpiGrid}>
              <div className={styles.kpiCard}>
                <div>
                  <h3 className={styles.kpiValue} style={{ color: '#1e293b' }}>
                    {expiry?.summary.total_documents ?? 0}
                  </h3>
                  <p className={styles.kpiLabel}>إجمالي الوثائق والرخص المسجلة</p>
                </div>
                <div className={styles.kpiIcon}>📁</div>
              </div>

              <div className={styles.kpiCard}>
                <div>
                  <h3 className={styles.kpiValue} style={{ color: '#b91c1c' }}>
                    {expiry?.summary.expired_count ?? 0}
                  </h3>
                  <p className={styles.kpiLabel}>مستندات منتهية الصلاحية</p>
                </div>
                <div className={styles.kpiIcon}>❌</div>
              </div>

              <div className={styles.kpiCard}>
                <div>
                  <h3 className={styles.kpiValue} style={{ color: '#b45309' }}>
                    {expiry?.summary.critical_count ?? 0}
                  </h3>
                  <p className={styles.kpiLabel}>حرجة (تنتهي خلال 10 أيام)</p>
                </div>
                <div className={styles.kpiIcon}>⏳</div>
              </div>

              <div className={styles.kpiCard}>
                <div>
                  <h3 className={styles.kpiValue} style={{ color: '#854d0e' }}>
                    {expiry?.summary.upcoming_count ?? 0}
                  </h3>
                  <p className={styles.kpiLabel}>قادمة (تنتهي خلال 30 يوماً)</p>
                </div>
                <div className={styles.kpiIcon}>📅</div>
              </div>
            </div>

            {/* Document Table Card */}
            <div className={styles.tableContainer}>
              <div className={styles.tableToolbar}>
                <div className={styles.filterGroup}>
                  <button
                    className={`${styles.filterBtn} ${docFilter === 'all' ? styles.filterBtnActive : ''}`}
                    onClick={() => setDocFilter('all')}
                  >
                    الكل ({expiry?.documents.length ?? 0})
                  </button>
                  <button
                    className={`${styles.filterBtn} ${docFilter === 'expired' ? styles.filterBtnActive : ''}`}
                    onClick={() => setDocFilter('expired')}
                  >
                    منتهي ({expiry?.summary.expired_count ?? 0})
                  </button>
                  <button
                    className={`${styles.filterBtn} ${docFilter === 'critical' ? styles.filterBtnActive : ''}`}
                    onClick={() => setDocFilter('critical')}
                  >
                    حرج &lt; 10 أيام ({expiry?.summary.critical_count ?? 0})
                  </button>
                  <button
                    className={`${styles.filterBtn} ${docFilter === 'upcoming' ? styles.filterBtnActive : ''}`}
                    onClick={() => setDocFilter('upcoming')}
                  >
                    قريب &lt; 30 يوم ({expiry?.summary.upcoming_count ?? 0})
                  </button>
                  <button
                    className={`${styles.filterBtn} ${docFilter === 'safe' ? styles.filterBtnActive : ''}`}
                    onClick={() => setDocFilter('safe')}
                  >
                    ساري
                  </button>
                  <button
                    className={`${styles.filterBtn} ${docFilter === 'renewed' ? styles.filterBtnActive : ''}`}
                    onClick={() => setDocFilter('renewed')}
                  >
                    تم التجديد
                  </button>
                </div>

                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => setShowAddModal(true)}
                >
                  <Plus size={16} />
                  تسجيل وثيقة أو ترخيص جديد
                </button>
              </div>

              {filteredDocs.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateIcon}>📑</div>
                  <h4 className={styles.emptyStateTitle}>لا توجد مستندات في هذا التصنيف</h4>
                  <p>يمكنك تسجيل إقامات العمال، ورخص البلدية، وتأمينات السيارات عبر زر الإضافة أعلاه.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>رقم المستند</th>
                        <th>العنوان والبيان</th>
                        <th>النوع</th>
                        <th>الارتباط</th>
                        <th>تاريخ الانتهاء</th>
                        <th>المتبقي</th>
                        <th>الحالة</th>
                        <th>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocs.map(doc => {
                        const days = doc.days_left;
                        let statusBadge = (
                          <span className={`${styles.badge} ${styles.badgeSafe}`}>ساري</span>
                        );
                        if (doc.is_renewed) {
                          statusBadge = <span className={`${styles.badge} ${styles.badgeRenewed}`}>مجدد</span>;
                        } else if (doc.status === 'expired') {
                          statusBadge = <span className={`${styles.badge} ${styles.badgeCritical}`}>منتهي</span>;
                        } else if (doc.status === 'critical') {
                          statusBadge = <span className={`${styles.badge} ${styles.badgeMedium}`}>عاجل جداً</span>;
                        } else if (doc.status === 'upcoming') {
                          statusBadge = <span className={`${styles.badge} ${styles.badgeWarning}`}>يقترب الانتهاء</span>;
                        }

                        return (
                          <tr key={doc.id}>
                            <td style={{ fontWeight: 800, fontFamily: 'monospace' }}>
                              {doc.document_number}
                            </td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{doc.title}</div>
                              {doc.notes && (
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{doc.notes}</div>
                              )}
                            </td>
                            <td>{doc.doc_type_ar || doc.doc_type}</td>
                            <td>
                              {doc.partner_name && <div>👤 {doc.partner_name}</div>}
                              {doc.project_name && <div>🏗️ {doc.project_name}</div>}
                              {doc.asset_name && <div>🚜 {doc.asset_name}</div>}
                              {!doc.partner_name && !doc.project_name && !doc.asset_name && (
                                <span style={{ color: '#94a3b8' }}>—</span>
                              )}
                            </td>
                            <td style={{ fontWeight: 700 }}>{doc.expiry_date}</td>
                            <td style={{ fontWeight: 800, color: days < 0 ? '#b91c1c' : days <= 10 ? '#b45309' : '#1e293b' }}>
                              {days < 0 ? `متأخر ${Math.abs(days)} يوم` : days === 0 ? 'ينتهي اليوم!' : `${days} يوم`}
                            </td>
                            <td>{statusBadge}</td>
                            <td>
                              <button
                                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                                onClick={() => {
                                  setSelectedDoc(doc);
                                  setShowRenewModal(true);
                                }}
                              >
                                تجديد / تمديد
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: RETENTION GUARANTEE RELEASES */}
        {/* =================================================================== */}
        {activeTab === 'retention' && (
          <div>
            <div className={styles.tableContainer} style={{ marginTop: 0 }}>
              <div className={styles.tableToolbar}>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem 0', fontWeight: 800, fontSize: '1.125rem' }}>
                    استحقاقات فك ضمان الأعمال والمبالغ المحجوزة
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                    رصد تواريخ انتهاء فترة الضمان للمشاريع المحسوبة من تاريخ الاستلام الابتدائي مع تتبع مبالغ فواتير العملاء ومستخلصات مقاولي الباطن
                  </p>
                </div>
              </div>

              {(!expiry?.retention_guarantees || expiry.retention_guarantees.length === 0) ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateIcon}>🏗️</div>
                  <h4 className={styles.emptyStateTitle}>لا توجد ضمانات أعمال محجوزة حالياً</h4>
                  <p>تظهر هنا تلقائياً أي مبالغ محتجزة كضمان أعمال في فواتير العملاء أو مستخلصات مقاولي الباطن للمشاريع المسلمة.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>المشروع</th>
                        <th>العميل</th>
                        <th>تاريخ الاستلام الابتدائي</th>
                        <th>مدة الضمان</th>
                        <th>ميعاد فك الضمان</th>
                        <th>المتبقي</th>
                        <th>محجوز العملاء</th>
                        <th>محجوز المقاولين</th>
                        <th>إجمالي الضمان المحجوز</th>
                        <th>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiry.retention_guarantees.map(r => {
                        const days = r.days_left;
                        let statusBadge = <span className={`${styles.badge} ${styles.badgeSafe}`}>ساري</span>;
                        if (r.status === 'overdue') {
                          statusBadge = <span className={`${styles.badge} ${styles.badgeCritical}`}>مستحق الفك ومتأخر</span>;
                        } else if (r.status === 'due_soon') {
                          statusBadge = <span className={`${styles.badge} ${styles.badgeWarning}`}>يستحق قريباً (&lt; 30 يوم)</span>;
                        }

                        return (
                          <tr key={r.project_id}>
                            <td style={{ fontWeight: 800 }}>{r.project_name}</td>
                            <td>{r.client_name || '—'}</td>
                            <td>{r.handover_date || '—'}</td>
                            <td>{r.warranty_months} شهراً</td>
                            <td style={{ fontWeight: 800 }}>{r.release_date}</td>
                            <td style={{ fontWeight: 800, color: days < 0 ? '#b91c1c' : days <= 30 ? '#b45309' : '#1e293b' }}>
                              {days < 0 ? `متأخر ${Math.abs(days)} يوم` : `${days} يوم`}
                            </td>
                            <td>{Number(r.client_retention_unreleased).toLocaleString('ar-SA')} ر.س</td>
                            <td>{Number(r.sub_retention_unreleased).toLocaleString('ar-SA')} ر.س</td>
                            <td style={{ fontWeight: 900, color: '#d97706' }}>
                              {Number(r.total_retention_unreleased).toLocaleString('ar-SA')} ر.س
                            </td>
                            <td>{statusBadge}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: SYSTEM ALERTS & PG_CRON */}
        {/* =================================================================== */}
        {activeTab === 'alerts' && (
          <div>
            <div className={styles.tableContainer} style={{ marginTop: 0, padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, fontSize: '1.25rem' }}>
                محرك الفحص الدوري والجدولة التلقائية (pg_cron Engine)
              </h3>
              <p style={{ margin: '0 0 1.5rem 0', color: '#64748b', fontSize: '0.875rem' }}>
                يقوم النظام بإجراء فحص أوتوماتيكي يومي في تمام الساعة 6:00 صباحاً عبر دالة قاعدة البيانات <code>rawasi_private.run_daily_health_and_expiry_scans()</code>،
                مع منع تكرار الإشعارات لنفس السجل المفتوح كل يوم لضمان عدم إزعاج المستخدمين.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className={styles.radarCard} style={{ padding: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={18} color="#d97706" /> موعد الفحص الدوري
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                    يومياً الساعة 06:00 صباحاً بتوقيت المملكة العربية السعودية عبر ملحق <code>pg_cron</code>
                  </p>
                </div>

                <div className={styles.radarCard} style={{ padding: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={18} color="#16a34a" /> منع التكرار الذكي (Deduplication)
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                    بصمة موحدة <code>dedup_key</code> لكل وثيقة أو مطالبة متأخرة تمنع توليد إشعار مكرر يومياً طول فترة بقائها مفتوحة.
                  </p>
                </div>

                <div className={styles.radarCard} style={{ padding: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building2 size={18} color="#2563eb" /> عزل الإشعارات بين الشركات
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                    كل تنبيه يتم وسمه بـ <code>company_id</code> ويصل فقط للأعضاء المعتمدين النشطين في نفس الشركة.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '1rem' }}>
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={handleRunDailyScan}
                  disabled={runningScan}
                >
                  <RefreshCw size={16} className={runningScan ? 'spin' : ''} />
                  {runningScan ? 'جارٍ تشغيل الفحص الشامل...' : 'تشغيل الفحص اليومي الآن (محاكاة pg_cron)'}
                </button>
                <Link href="/notifications" className={`${styles.btn} ${styles.btnSecondary}`}>
                  <Bell size={16} />
                  فتح مركز الإشعارات المستلمة
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL: ADD COMPANY DOCUMENT */}
        {/* =================================================================== */}
        {showAddModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2>تسجيل وثيقة أو ترخيص جديد</h2>
                <button className={styles.closeBtn} onClick={() => setShowAddModal(false)}>×</button>
              </div>

              <form onSubmit={handleSaveDocument}>
                <div className={styles.modalBody}>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>رقم المستند / الوثيقة *</label>
                      <input
                        className={styles.formInput}
                        value={form.document_number}
                        onChange={e => setForm({ ...form, document_number: e.target.value })}
                        placeholder="مثال: 2451980012 أو LIC-4410"
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label>نوع المستند *</label>
                      <select
                        className={styles.formSelect}
                        value={form.doc_type}
                        onChange={e => setForm({ ...form, doc_type: e.target.value })}
                      >
                        <option value="worker_iqama">إقامة عامل / موظف</option>
                        <option value="municipality_license">رخصة بلدية</option>
                        <option value="asset_insurance">تأمين معدة / مركبة</option>
                        <option value="letter_of_guarantee">خطاب ضمان بنكي</option>
                        <option value="project_contract">عقد مشروع</option>
                        <option value="commercial_registration">سجل تجاري</option>
                        <option value="tax_certificate">شهادة الزكاة والضريبة</option>
                        <option value="other">أخرى</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>عنوان ووصف المستند *</label>
                    <input
                      className={styles.formInput}
                      value={form.title}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      placeholder="مثال: إقامة المهندس أحمد أو تأمين شاحنة أكتروس"
                      required
                    />
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>تاريخ الانتهاء *</label>
                      <input
                        type="date"
                        className={styles.formInput}
                        value={form.expiry_date}
                        onChange={e => setForm({ ...form, expiry_date: e.target.value })}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label>تاريخ الإصدار (اختياري)</label>
                      <input
                        type="date"
                        className={styles.formInput}
                        value={form.issue_date}
                        onChange={e => setForm({ ...form, issue_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>تنبيه قبل الانتهاء بـ (أيام)</label>
                      <input
                        type="number"
                        min="1"
                        className={styles.formInput}
                        value={form.alert_days_before}
                        onChange={e => setForm({ ...form, alert_days_before: Number(e.target.value) })}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label>الموظف / الشريك المرتبط (اختياري)</label>
                      <select
                        className={styles.formSelect}
                        value={form.partner_id}
                        onChange={e => setForm({ ...form, partner_id: e.target.value })}
                      >
                        <option value="">-- بدون ارتباط --</option>
                        {partners.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>المشروع المرتبط (اختياري)</label>
                      <select
                        className={styles.formSelect}
                        value={form.project_id}
                        onChange={e => setForm({ ...form, project_id: e.target.value })}
                      >
                        <option value="">-- بدون ارتباط --</option>
                        {projects.map(pr => (
                          <option key={pr.id} value={pr.id}>{pr.Property}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label>المعدة / الأصل المرتبط (اختياري)</label>
                      <select
                        className={styles.formSelect}
                        value={form.asset_id}
                        onChange={e => setForm({ ...form, asset_id: e.target.value })}
                      >
                        <option value="">-- بدون ارتباط --</option>
                        {assets.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>ملاحظات إضافية</label>
                    <textarea
                      rows={2}
                      className={styles.formTextarea}
                      value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      placeholder="أي ملاحظات حول التجديد أو متطلبات الفحص..."
                    />
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => setShowAddModal(false)}
                    disabled={savingDoc}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    disabled={savingDoc}
                  >
                    {savingDoc ? 'جارٍ الحفظ...' : 'حفظ الوثيقة'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL: RENEW DOCUMENT */}
        {/* =================================================================== */}
        {showRenewModal && selectedDoc && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: 500 }}>
              <div className={styles.modalHeader}>
                <h2>تجديد / تمديد صلاحية المستند</h2>
                <button className={styles.closeBtn} onClick={() => setShowRenewModal(false)}>×</button>
              </div>

              <div className={styles.modalBody}>
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 800 }}>{selectedDoc.title}</div>
                  <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    رقم الوثيقة: {selectedDoc.document_number} | الصلاحية السابقة: {selectedDoc.expiry_date}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>تاريخ الانتهاء الجديد (تمديد الصلاحية)</label>
                  <input
                    type="date"
                    className={styles.formInput}
                    value={newExpiryDate}
                    onChange={e => setNewExpiryDate(e.target.value)}
                  />
                  <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    إذا تركت التاريخ فارغاً، سيتم تعليم المستند كـ "مجدد" بتاريخ اليوم فقط.
                  </small>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => setShowRenewModal(false)}
                  disabled={savingDoc}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSuccess}`}
                  onClick={handleRenewDocument}
                  disabled={savingDoc}
                >
                  {savingDoc ? 'جارٍ التحديث...' : 'تأكيد التجديد'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MasterPage>
  );
}
