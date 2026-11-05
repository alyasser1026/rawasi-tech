'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  FileCheck,
  FileText,
  Filter,
  Layers,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  User,
  X,
} from 'lucide-react';
import MasterPage from '@/components/MasterPage';
import LoadingScreen from '@/components/LoadingScreen';
import { useCompany } from '@/lib/CompanyContext';
import { notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import {
  CustodyExpense,
  SETTLEMENT_TYPES,
  STATUS_MAP,
  SiteCustody,
  createSiteCustody,
  fetchSiteCustodies,
  formatCustodyCurrency,
  settleSiteCustody,
} from './custodiesModel';
import styles from './custodies.module.css';

export default function CustodiesPage() {
  const queryClient = useQueryClient();
  const { activeCompany } = useCompany();

  // Filters & State
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [expandedCustodyIds, setExpandedCustodyIds] = useState<Record<string, boolean>>({});

  // Modals State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [selectedCustodyForSettle, setSelectedCustodyForSettle] = useState<SiteCustody | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedCustodyForPrint, setSelectedCustodyForPrint] = useState<SiteCustody | null>(null);

  // New Custody Form State
  const [newPartnerId, setNewPartnerId] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [newSafeAccountId, setNewSafeAccountId] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('نقدي');
  const [newMaxDays, setNewMaxDays] = useState<number>(30);
  const [newNotes, setNewNotes] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Settle Form State
  const [settlementType, setSettlementType] = useState<
    'cash_return' | 'salary_deduction' | 'carry_forward' | 'cleared'
  >('cash_return');
  const [settlementDestinationId, setSettlementDestinationId] = useState('');
  const [settlementDate, setSettlementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [settlementNotes, setSettlementNotes] = useState('');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  // Queries
  const { data: summaryData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['site_custodies_summary', activeCompany?.id, statusFilter],
    queryFn: () => fetchSiteCustodies(statusFilter),
    enabled: !!activeCompany?.id,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['partners_for_custodies', activeCompany?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('partners')
        .select('id, name, code, partner_type')
        .order('name');
      return data || [];
    },
    enabled: !!activeCompany?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects_for_custodies', activeCompany?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, Property')
        .order('Property');
      return data || [];
    },
    enabled: !!activeCompany?.id,
  });

  const { data: safeAccounts = [] } = useQuery({
    queryKey: ['safes_for_custodies', activeCompany?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('accounts')
        .select('id, code, name')
        .or('code.ilike.121%,code.ilike.122%,code.eq.123')
        .eq('is_transactional', true)
        .order('code');
      return data || [];
    },
    enabled: !!activeCompany?.id,
  });

  const toggleExpand = (id: string) => {
    setExpandedCustodyIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openSettleModal = (custody: SiteCustody) => {
    setSelectedCustodyForSettle(custody);
    if (custody.remaining_amount <= 0) {
      setSettlementType('cleared');
    } else {
      setSettlementType('cash_return');
    }
    setSettlementDestinationId(safeAccounts[0]?.id || '');
    setSettlementDate(new Date().toISOString().slice(0, 10));
    setSettlementNotes('');
    setIsSettleModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerId || !newTitle || !newAmount || !newSafeAccountId) {
      notify('يرجى ملء جميع الحقول الإلزامية', 'error');
      return;
    }

    try {
      setIsSubmittingNew(true);
      await createSiteCustody({
        partnerId: newPartnerId,
        projectId: newProjectId || null,
        title: newTitle,
        amount: Number(newAmount),
        safeAccountId: newSafeAccountId,
        paymentMethod: newPaymentMethod,
        maxDays: Number(newMaxDays),
        notes: newNotes,
      });

      notify('تم صرف العهدة بنجاح وإنشاء سند الصرف والقيد المحاسبي', 'success');
      setIsNewModalOpen(false);
      // Reset form
      setNewPartnerId('');
      setNewProjectId('');
      setNewTitle('');
      setNewAmount('');
      setNewNotes('');
      queryClient.invalidateQueries({ queryKey: ['site_custodies_summary'] });
    } catch (err: any) {
      notify(err.message || 'حدث خطأ أثناء صرف العهدة', 'error');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustodyForSettle) return;

    if (
      settlementType === 'cash_return' &&
      selectedCustodyForSettle.remaining_amount > 0 &&
      !settlementDestinationId
    ) {
      notify('يرجى تحديد حساب الخزينة أو البنك المردود إليه النقدية', 'error');
      return;
    }

    try {
      setIsSubmittingSettle(true);
      await settleSiteCustody({
        custodyId: selectedCustodyForSettle.id,
        settlementType,
        destinationId:
          settlementType === 'cash_return'
            ? settlementDestinationId
            : settlementType === 'carry_forward'
            ? selectedCustodyForSettle.project_id
            : null,
        settlementDate,
        notes: settlementNotes,
      });

      notify('تمت تسوية العهدة بنجاح وإقفال قيود الأستاذ العام', 'success');
      setIsSettleModalOpen(false);
      setSelectedCustodyForSettle(null);
      queryClient.invalidateQueries({ queryKey: ['site_custodies_summary'] });
    } catch (err: any) {
      notify(err.message || 'فشلت تسوية العهدة', 'error');
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  const handlePrintSlip = (custody: SiteCustody) => {
    setSelectedCustodyForPrint(custody);
    setIsPrintModalOpen(true);
  };

  // Filter list
  const kpis = summaryData?.kpis || {
    total_custodies: 0,
    open_custodies: 0,
    settled_custodies: 0,
    overdue_custodies: 0,
    total_disbursed: 0,
    total_spent: 0,
    total_remaining: 0,
  };

  const filteredCustodies = (summaryData?.custodies || []).filter((c) => {
    // Project filter
    if (selectedProjectId !== 'all' && c.project_id !== selectedProjectId) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = c.custody_number.toLowerCase().includes(q);
      const matchTitle = c.title.toLowerCase().includes(q);
      const matchPartner = (c.partner_name || '').toLowerCase().includes(q);
      const matchProject = (c.project_name || '').toLowerCase().includes(q);
      if (!matchNum && !matchTitle && !matchPartner && !matchProject) return false;
    }
    return true;
  });

  return (
    <MasterPage title="عُهد المواقع والموظفين (حساب 125)">
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.headerSection}>
          <div className={styles.titleArea}>
            <h1 className={styles.pageTitle}>
              <Briefcase size={24} className="text-orange-500" />
              إدارة عُهد المواقع والموظفين
              <span className={styles.accountPill}>ح/ 125</span>
            </h1>
            <p className={styles.pageSubtitle}>
              متابعة صرف العهد النقدية، المصروفات الميدانية المرتبطة بها، وتسويتها مع الخزينة أو الرواتب
            </p>
          </div>

          <div className={styles.actionButtons}>
            <button
              onClick={() => refetch()}
              className={styles.btnSecondary}
              disabled={isFetching}
              title="تحديث البيانات"
            >
              <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
              تحديث
            </button>
            <button onClick={() => setIsNewModalOpen(true)} className={styles.btnPrimary}>
              <Plus size={16} />
              صرف عهدة جديدة
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className={styles.kpiGrid}>
          <div className={`${styles.kpiCard} ${styles.kpiCardPrimary}`}>
            <span className={styles.kpiLabel}>إجمالي المبالغ المنصرفة</span>
            <span className={styles.kpiValue}>{formatCustodyCurrency(kpis.total_disbursed)}</span>
            <span className={styles.kpiSub}>{kpis.total_custodies} عهدة مسجلة</span>
          </div>

          <div className={`${styles.kpiCard} ${styles.kpiCardSuccess}`}>
            <span className={styles.kpiLabel}>إجمالي المصروفات الميدانية</span>
            <span className={styles.kpiValue}>{formatCustodyCurrency(kpis.total_spent)}</span>
            <span className={styles.kpiSub}>فواتير وسندات صرف مقيدة</span>
          </div>

          <div className={`${styles.kpiCard} ${kpis.total_remaining > 0 ? styles.kpiCardWarning : ''}`}>
            <span className={styles.kpiLabel}>المتبقي طرف المهندسين (ح/ 125)</span>
            <span className={styles.kpiValue}>{formatCustodyCurrency(kpis.total_remaining)}</span>
            <span className={styles.kpiSub}>ذمم عهد قيد التصفية</span>
          </div>

          <div className={`${styles.kpiCard} ${kpis.overdue_custodies > 0 ? styles.kpiCardDanger : ''}`}>
            <span className={styles.kpiLabel}>حالة العُهد الحالية</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <span className="font-bold text-emerald-400">{kpis.open_custodies} جارية</span>
              <span className="text-slate-500">•</span>
              <span className="font-bold text-slate-400">{kpis.settled_custodies} مسواة</span>
              {kpis.overdue_custodies > 0 && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className="font-bold text-rose-500">{kpis.overdue_custodies} متأخرة</span>
                </>
              )}
            </div>
            <span className={styles.kpiSub}>وفق مدة التصفية المقررة</span>
          </div>
        </div>

        {/* Controls Bar */}
        <div className={styles.controlsBar}>
          <div className={styles.filterGroup}>
            <div className={styles.statusFilterTabs}>
              {[
                { id: 'all', label: 'الكل' },
                { id: 'open', label: 'الجارية والمفتوحة' },
                { id: 'settled', label: 'تمت التسوية' },
                { id: 'overdue', label: 'متجاوزة المدة' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`${styles.statusFilterBtn} ${
                    statusFilter === tab.id ? styles.statusFilterBtnActive : ''
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className={styles.formSelect}
              style={{ width: 'auto', minWidth: '180px' }}
            >
              <option value="all">كل المشاريع</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.Property}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.searchBox}>
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="بحث برقم العهدة، المهندس، أو المشروع..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Custodies Table */}
        <div className={styles.tableCard}>
          {isLoading ? (
            <LoadingScreen />
          ) : filteredCustodies.length === 0 ? (
            <div className={styles.emptyState}>
              <Briefcase size={40} className="text-slate-600" />
              <p className="font-bold">لا توجد عُهد مطابقة لمعايير البحث</p>
              <p className="text-xs text-slate-500">
                يمكنك الضغط على «صرف عهدة جديدة» لإصدار عهدة نقدية لمهندس موقع
              </p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th>رقم العهدة</th>
                    <th>المهندس / المستلم</th>
                    <th>المشروع والبيان</th>
                    <th>تاريخ الصرف</th>
                    <th>المدة</th>
                    <th>المبلغ المنصرف</th>
                    <th>المصروف</th>
                    <th>المتبقي</th>
                    <th>الحالة</th>
                    <th style={{ textAlign: 'center' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustodies.map((custody) => {
                    const isExpanded = !!expandedCustodyIds[custody.id];
                    const statusConfig = STATUS_MAP[custody.status] || STATUS_MAP.open;
                    const hasExpenses = (custody.expenses || []).length > 0;

                    return (
                      <>
                        <tr key={custody.id} className={styles.tableRow}>
                          <td>
                            <button
                              onClick={() => toggleExpand(custody.id)}
                              className={styles.actionBtnExpand}
                              title={isExpanded ? 'طي المصروفات' : 'عرض فواتير ومصروفات العهدة'}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </td>
                          <td>
                            <span className={styles.custodyCode}>{custody.custody_number}</span>
                          </td>
                          <td>
                            <div className={styles.partnerCell}>
                              <span className={styles.partnerName}>
                                {custody.partner_name || '—'}
                              </span>
                              {custody.partner_code && (
                                <span className={styles.partnerMeta}>
                                  كود: {custody.partner_code}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                              <span className="font-medium text-slate-200">{custody.title}</span>
                              <span className="text-xs text-slate-400">
                                {custody.project_name ? `المشروع: ${custody.project_name}` : 'عهدة عامة'}
                              </span>
                            </div>
                          </td>
                          <td className="text-slate-300 text-xs">{custody.opened_date}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <span className="text-xs text-slate-300">{custody.max_days} يوم</span>
                              {custody.is_overdue && (
                                <span className={styles.overdueBadge} title={`مفتوحة منذ ${custody.days_open} يوم`}>
                                  <AlertTriangle size={10} /> متأخرة
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={`${styles.moneyCell} ${styles.moneyDisbursed}`}>
                            {formatCustodyCurrency(custody.disbursed_amount)}
                          </td>
                          <td className={`${styles.moneyCell} ${styles.moneySpent}`}>
                            {formatCustodyCurrency(custody.spent_amount)}
                          </td>
                          <td
                            className={`${styles.moneyCell} ${
                              custody.remaining_amount > 0
                                ? styles.moneyRemaining
                                : styles.moneyRemainingZero
                            }`}
                          >
                            {formatCustodyCurrency(custody.remaining_amount)}
                          </td>
                          <td>
                            <span
                              className={`${styles.statusBadge} ${styles[statusConfig.className]}`}
                            >
                              {statusConfig.label}
                            </span>
                          </td>
                          <td>
                            <div className={styles.rowActions} style={{ justifyContent: 'center' }}>
                              {custody.status === 'open' && (
                                <button
                                  onClick={() => openSettleModal(custody)}
                                  className={styles.actionBtnSettle}
                                  title="تصفية وتسوية العهدة"
                                >
                                  تسوية
                                </button>
                              )}
                              <button
                                onClick={() => handlePrintSlip(custody)}
                                className={styles.actionBtnExpand}
                                title="طباعة محضر تسوية وتصفية العهدة"
                              >
                                <Printer size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable expenses row */}
                        {isExpanded && (
                          <tr key={`${custody.id}-exp`}>
                            <td colSpan={11} style={{ padding: 0 }}>
                              <div className={styles.expandedSection}>
                                <div className={styles.expandedHeader}>
                                  <span className={styles.expandedTitle}>
                                    المصروفات والفواتير المسجلة على عهدة ({custody.custody_number})
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    إجمالي المصروف المسجل: {formatCustodyCurrency(custody.spent_amount)}
                                  </span>
                                </div>

                                {!hasExpenses ? (
                                  <p className="text-xs text-slate-400 py-2">
                                    لم تسجل أي مصروفات أو فواتير مشتريات على هذه العهدة حتى الآن.
                                  </p>
                                ) : (
                                  <table className={styles.subTable}>
                                    <thead>
                                      <tr>
                                        <th>التاريخ</th>
                                        <th>البيان والمصروف</th>
                                        <th>طريقة الصرف</th>
                                        <th>الضريبة</th>
                                        <th>المبلغ المدفوع</th>
                                        <th>الحالة المحاسبية</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {custody.expenses?.map((exp: CustodyExpense) => (
                                        <tr key={exp.id}>
                                          <td>{exp.exp_date}</td>
                                          <td>{exp.description}</td>
                                          <td>{exp.payment_method || 'عهدة'}</td>
                                          <td>{formatCustodyCurrency(exp.vat_amount || 0)}</td>
                                          <td className="font-semibold text-emerald-400">
                                            {formatCustodyCurrency(exp.paid_amount)}
                                          </td>
                                          <td>
                                            <span
                                              className={
                                                exp.is_posted
                                                  ? 'text-xs text-emerald-400'
                                                  : 'text-xs text-amber-400'
                                              }
                                            >
                                              {exp.is_posted ? 'مرحل للأستاذ العام' : 'مسودة'}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Create Site Custody */}
        {isNewModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>صرف عهدة جديدة لمهندس / موظف</h3>
                <button onClick={() => setIsNewModalOpen(false)} className={styles.modalClose}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit}>
                <div className={styles.modalBody}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      المهندس / الموظف المستلم (حساب 125) *
                    </label>
                    <select
                      value={newPartnerId}
                      onChange={(e) => setNewPartnerId(e.target.value)}
                      className={styles.formSelect}
                      required
                    >
                      <option value="">-- اختر المهندس أو المشرف --</option>
                      {partners.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.code ? `(${p.code})` : ''} — {p.partner_type || 'شريك'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>المشروع المستهدف</label>
                    <select
                      value={newProjectId}
                      onChange={(e) => setNewProjectId(e.target.value)}
                      className={styles.formSelect}
                    >
                      <option value="">-- عهدة عامة (دون مشروع محدد) --</option>
                      {projects.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.Property}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>بيان وغرض العهدة *</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="مثال: عهدة مشتريات طارئة لأعمال السباكة والكهرباء"
                      className={styles.formInput}
                      required
                    />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.875rem',
                    }}
                  >
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>مبلغ العهدة (ر.س) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={newAmount}
                        onChange={(e) =>
                          setNewAmount(e.target.value === '' ? '' : parseFloat(e.target.value))
                        }
                        placeholder="0.00"
                        className={styles.formInput}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>مدة العهدة للتسوية (بالأيام)</label>
                      <input
                        type="number"
                        min="1"
                        value={newMaxDays}
                        onChange={(e) => setNewMaxDays(parseInt(e.target.value) || 30)}
                        className={styles.formInput}
                        required
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.875rem',
                    }}
                  >
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>الخزينة أو البنك المصروف منه *</label>
                      <select
                        value={newSafeAccountId}
                        onChange={(e) => setNewSafeAccountId(e.target.value)}
                        className={styles.formSelect}
                        required
                      >
                        <option value="">-- اختر حساب الصرف --</option>
                        {safeAccounts.map((acc: any) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>طريقة الصرف</label>
                      <select
                        value={newPaymentMethod}
                        onChange={(e) => setNewPaymentMethod(e.target.value)}
                        className={styles.formSelect}
                      >
                        <option value="نقدي">نقدي (كاش)</option>
                        <option value="تحويل بنكي">تحويل بنكي</option>
                        <option value="شيك">شيك مصرفي</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>ملاحظات إضافية</label>
                    <textarea
                      rows={2}
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="أي اشتراطات أو توجيهات متعلقة بالعهدة..."
                      className={styles.formTextarea}
                    />
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    onClick={() => setIsNewModalOpen(false)}
                    className={styles.btnSecondary}
                    disabled={isSubmittingNew}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={isSubmittingNew}
                  >
                    {isSubmittingNew ? 'جاري الصرف والترحيل...' : 'تأكيد وصرف العهدة'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Settle Site Custody */}
        {isSettleModalOpen && selectedCustodyForSettle && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  تسوية وتصفية العهدة ({selectedCustodyForSettle.custody_number})
                </h3>
                <button onClick={() => setIsSettleModalOpen(false)} className={styles.modalClose}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSettleSubmit}>
                <div className={styles.modalBody}>
                  {/* Summary Box */}
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '0.875rem 1rem',
                      borderRadius: '0.5rem',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '0.5rem',
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <span className="text-xs text-slate-400 block">المبلغ المنصرف</span>
                      <span className="font-bold text-white">
                        {formatCustodyCurrency(selectedCustodyForSettle.disbursed_amount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">المصروف الفعلي</span>
                      <span className="font-bold text-sky-400">
                        {formatCustodyCurrency(selectedCustodyForSettle.spent_amount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">المتبقي للتسوية</span>
                      <span className="font-bold text-emerald-400">
                        {formatCustodyCurrency(selectedCustodyForSettle.remaining_amount)}
                      </span>
                    </div>
                  </div>

                  {selectedCustodyForSettle.remaining_amount <= 0 ? (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-300 text-sm">
                      تم صرف كامل مبلغ العهدة بالكامل. سيتم إقفال العهدة مباشرة وتحديث حالتها إلى «تمت
                      التسوية».
                    </div>
                  ) : (
                    <>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>طريقة معالجة وتسوية المبلغ المتبقي *</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label
                            className={`${styles.settlementOptionCard} ${
                              settlementType === 'cash_return' ? styles.settlementOptionActive : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="settle_type"
                              value="cash_return"
                              checked={settlementType === 'cash_return'}
                              onChange={() => setSettlementType('cash_return')}
                              style={{ marginTop: '0.2rem' }}
                            />
                            <div>
                              <span className="font-bold block text-sm text-white">
                                {SETTLEMENT_TYPES.cash_return.label}
                              </span>
                              <span className="text-xs text-slate-400">
                                {SETTLEMENT_TYPES.cash_return.desc}
                              </span>
                            </div>
                          </label>

                          <label
                            className={`${styles.settlementOptionCard} ${
                              settlementType === 'salary_deduction'
                                ? styles.settlementOptionActive
                                : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="settle_type"
                              value="salary_deduction"
                              checked={settlementType === 'salary_deduction'}
                              onChange={() => setSettlementType('salary_deduction')}
                              style={{ marginTop: '0.2rem' }}
                            />
                            <div>
                              <span className="font-bold block text-sm text-white">
                                {SETTLEMENT_TYPES.salary_deduction.label}
                              </span>
                              <span className="text-xs text-slate-400">
                                {SETTLEMENT_TYPES.salary_deduction.desc}
                              </span>
                            </div>
                          </label>

                          <label
                            className={`${styles.settlementOptionCard} ${
                              settlementType === 'carry_forward'
                                ? styles.settlementOptionActive
                                : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="settle_type"
                              value="carry_forward"
                              checked={settlementType === 'carry_forward'}
                              onChange={() => setSettlementType('carry_forward')}
                              style={{ marginTop: '0.2rem' }}
                            />
                            <div>
                              <span className="font-bold block text-sm text-white">
                                {SETTLEMENT_TYPES.carry_forward.label}
                              </span>
                              <span className="text-xs text-slate-400">
                                {SETTLEMENT_TYPES.carry_forward.desc}
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>

                      {settlementType === 'cash_return' && (
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>الخزينة أو البنك المردود إليه *</label>
                          <select
                            value={settlementDestinationId}
                            onChange={(e) => setSettlementDestinationId(e.target.value)}
                            className={styles.formSelect}
                            required
                          >
                            {safeAccounts.map((acc: any) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name} ({acc.code})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>تاريخ التسوية</label>
                    <input
                      type="date"
                      value={settlementDate}
                      onChange={(e) => setSettlementDate(e.target.value)}
                      className={styles.formInput}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>ملاحظات التسوية والمحضر</label>
                    <textarea
                      rows={2}
                      value={settlementNotes}
                      onChange={(e) => setSettlementNotes(e.target.value)}
                      placeholder="سبب التسوية أو رقم المرجع..."
                      className={styles.formTextarea}
                    />
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    onClick={() => setIsSettleModalOpen(false)}
                    className={styles.btnSecondary}
                    disabled={isSubmittingSettle}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={isSubmittingSettle}
                  >
                    {isSubmittingSettle ? 'جاري التسوية والترحيل...' : 'تأكيد التسوية والإقفال'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Printable Settlement Slip */}
        {isPrintModalOpen && selectedCustodyForPrint && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '750px' }}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  محضر تسوية وتصفية عهدة ({selectedCustodyForPrint.custody_number})
                </h3>
                <button onClick={() => setIsPrintModalOpen(false)} className={styles.modalClose}>
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 text-slate-100 bg-slate-900 overflow-y-auto" id="print-area">
                <div className="text-center border-b border-slate-700 pb-4 mb-4">
                  <h2 className="text-xl font-bold text-white mb-1">
                    {activeCompany?.name || 'شركة رواسي'}
                  </h2>
                  <h3 className="text-base font-semibold text-orange-400">
                    محضر تسوية وتصفية عُهدة موقع
                  </h3>
                  <div className="flex justify-between items-center text-xs text-slate-400 mt-2 px-4">
                    <span>رقم العهدة: {selectedCustodyForPrint.custody_number}</span>
                    <span>تاريخ الصرف: {selectedCustodyForPrint.opened_date}</span>
                    <span>تاريخ المحضر: {new Date().toLocaleDateString('ar-SA')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs mb-4 p-3 bg-slate-800/60 rounded">
                  <div>
                    <span className="text-slate-400">اسم المستلم: </span>
                    <strong className="text-white">{selectedCustodyForPrint.partner_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">المشروع: </span>
                    <strong className="text-white">
                      {selectedCustodyForPrint.project_name || 'عهدة عامة'}
                    </strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">الغرض: </span>
                    <strong className="text-white">{selectedCustodyForPrint.title}</strong>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="text-xs font-bold text-slate-300 mb-2">بيان المصروفات والفواتير:</h4>
                  <table className="w-full text-xs border border-slate-700 text-right">
                    <thead>
                      <tr className="bg-slate-800">
                        <th className="p-1.5 border border-slate-700">التاريخ</th>
                        <th className="p-1.5 border border-slate-700">البيان</th>
                        <th className="p-1.5 border border-slate-700">الضريبة</th>
                        <th className="p-1.5 border border-slate-700">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedCustodyForPrint.expenses || []).map((exp, idx) => (
                        <tr key={idx} className="border-b border-slate-800">
                          <td className="p-1.5 border border-slate-700">{exp.exp_date}</td>
                          <td className="p-1.5 border border-slate-700">{exp.description}</td>
                          <td className="p-1.5 border border-slate-700">
                            {formatCustodyCurrency(exp.vat_amount || 0)}
                          </td>
                          <td className="p-1.5 border border-slate-700 font-semibold text-sky-400">
                            {formatCustodyCurrency(exp.paid_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center p-3 bg-slate-800 rounded text-xs mb-6">
                  <div>
                    <span className="text-slate-400 block">المبلغ المنصرف:</span>
                    <strong className="text-white text-sm">
                      {formatCustodyCurrency(selectedCustodyForPrint.disbursed_amount)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">إجمالي المصروفات:</span>
                    <strong className="text-sky-400 text-sm">
                      {formatCustodyCurrency(selectedCustodyForPrint.spent_amount)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">المتبقي المسوى:</span>
                    <strong className="text-emerald-400 text-sm">
                      {formatCustodyCurrency(selectedCustodyForPrint.remaining_amount)}
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center text-xs pt-4 border-t border-slate-700">
                  <div>
                    <p className="font-semibold text-slate-300">المستلم / صاحب العهدة</p>
                    <p className="text-slate-400 mt-6">التوقيع: .....................</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-300">أمين الصندوق / المحاسب</p>
                    <p className="text-slate-400 mt-6">التوقيع: .....................</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-300">المدير المالي / الاعتماد</p>
                    <p className="text-slate-400 mt-6">التوقيع: .....................</p>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className={styles.btnSecondary}
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={styles.btnPrimary}
                >
                  <Printer size={16} />
                  طباعة المحضر
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MasterPage>
  );
}
