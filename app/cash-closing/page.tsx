'use client';
import { currencySymbol } from '@/lib/currency';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Coins,
  History,
  Info,
  Lock,
  RefreshCw,
  Scale,
  ShieldCheck,
  Vault,
  X,
} from 'lucide-react';
import MasterPage from '@/components/MasterPage';
import LoadingScreen from '@/components/LoadingScreen';
import { useCompany } from '@/lib/CompanyContext';
import { notify } from '@/lib/notify';
import {
  CashClosing,
  SafeAccountOption,
  approveCashClosing,
  createDailyCashClosing,
  fetchCashClosingPreview,
  fetchCashClosingsHistory,
  fetchSafeAccounts,
  formatCashCurrency,
} from './cashClosingModel';
import styles from './cash-closing.module.css';

export default function CashClosingPage() {
  const queryClient = useQueryClient();
  const { activeCompany } = useCompany();

  // State
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [closingDate, setClosingDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Approval Modal State
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [selectedClosingForApproval, setSelectedClosingForApproval] = useState<CashClosing | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // History filter
  const [historyAccountFilter, setHistoryAccountFilter] = useState<string>('all');

  // Queries
  const { data: safeAccounts = [], isLoading: isLoadingSafes } = useQuery({
    queryKey: ['safe_accounts', activeCompany?.id],
    queryFn: fetchSafeAccounts,
    enabled: !!activeCompany?.id,
  });

  // Set default account when safes loaded
  const currentAccountId = selectedAccountId || safeAccounts[0]?.id || '';

  const {
    data: previewData,
    isLoading: isLoadingPreview,
    refetch: refetchPreview,
    isFetching: isFetchingPreview,
  } = useQuery({
    queryKey: ['cash_closing_preview', activeCompany?.id, currentAccountId, closingDate],
    queryFn: () => fetchCashClosingPreview(currentAccountId, closingDate),
    enabled: !!activeCompany?.id && !!currentAccountId && !!closingDate,
    retry: false,
    staleTime: 60000,
  });

  const {
    data: historyList = [],
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
    isFetching: isFetchingHistory,
  } = useQuery({
    queryKey: ['cash_closings_history', activeCompany?.id, historyAccountFilter],
    queryFn: () =>
      fetchCashClosingsHistory(historyAccountFilter === 'all' ? null : historyAccountFilter, 50),
    enabled: !!activeCompany?.id,
    retry: false,
    staleTime: 60000,
  });

  // Calculations
  const systemBalance = previewData?.system_balance ?? 0;
  const actualCash = actualCashInput === '' ? null : Number(actualCashInput);
  const difference = actualCash !== null ? Number((actualCash - systemBalance).toFixed(2)) : null;

  const handleCreateClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccountId || actualCash === null) {
      notify('يرجى تحديد الخزينة وإدخال المبلغ الفعلي للجرد', 'error');
      return;
    }

    if (actualCash < 0) {
      notify('المبلغ الفعلي لا يمكن أن يكون سالباً', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      await createDailyCashClosing({
        accountId: currentAccountId,
        closingDate,
        actualCash,
        notes: closingNotes,
      });

      notify(
        difference === 0
          ? 'تم اعتماد محضر إقفال الخزينة بنجاح (مطابق تماماً)'
          : 'تم تسجيل محضر الإقفال بفارق نقدي، وهو بانتظار اعتماد الإدارة لترحيل حساب 527',
        'success'
      );

      // Reset
      setActualCashInput('');
      setClosingNotes('');
      queryClient.invalidateQueries({ queryKey: ['cash_closing_preview'] });
      queryClient.invalidateQueries({ queryKey: ['cash_closings_history'] });
    } catch (err: any) {
      notify(err.message || 'فشل حفظ محضر إقفال الخزينة', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openApproveModal = (closing: CashClosing) => {
    setSelectedClosingForApproval(closing);
    setApprovalNotes(`اعتماد محضر إقفال رقم ${closing.closing_number} وترحيل الفارق إلى حساب تسويات الهللات 527`);
    setIsApproveModalOpen(true);
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClosingForApproval) return;

    try {
      setIsSubmittingApproval(true);
      const res = await approveCashClosing(selectedClosingForApproval.id, approvalNotes);
      notify(
        `تم اعتماد المحضر وترحيل قيد التسوية بنجاح${
          res.journal_header_id ? ' إلى حساب 527' : ''
        }`,
        'success'
      );
      setIsApproveModalOpen(false);
      setSelectedClosingForApproval(null);
      queryClient.invalidateQueries({ queryKey: ['cash_closings_history'] });
    } catch (err: any) {
      notify(err.message || 'فشل اعتماد المحضر', 'error');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  return (
    <MasterPage title="إقفال الخزينة اليومي ومطابقة الفروق (حساب 527)">
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.headerSection}>
          <div className={styles.titleArea}>
            <h1 className={styles.pageTitle}>
              <Vault size={24} className="text-sky-400" />
              إقفال الخزينة اليومي وجرد الصندوق
              <span className={styles.accountPill}>تسويات ح/ 527</span>
            </h1>
            <p className={styles.pageSubtitle}>
              مطابقة الرصيد الدفتري اللحظي بالأستاذ العام مع الجرد الفعلي، وترحيل الفروق المعتمدة آلياً
            </p>
          </div>

          <div className={styles.actionButtons}>
            <button
              onClick={() => {
                refetchPreview();
                refetchHistory();
              }}
              className={styles.btnSecondary}
              disabled={isFetchingPreview || isFetchingHistory}
            >
              <RefreshCw
                size={15}
                className={isFetchingPreview || isFetchingHistory ? 'animate-spin' : ''}
              />
              تحديث
            </button>
          </div>
        </div>

        {/* Main 2-column Grid */}
        <div className={styles.mainGrid}>
          {/* Column 1: Record Closing Form */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <Lock size={18} className="text-sky-400" />
                تسجيل محضر إقفال خزينة جديد
              </h2>
              <span className="text-xs text-slate-400">إجراء جرد نهاية اليوم</span>
            </div>

            <form onSubmit={handleCreateClosing} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.875rem' }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>حساب الخزينة / الصندوق *</label>
                  <select
                    value={currentAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className={styles.formSelect}
                    required
                  >
                    {safeAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>تاريخ الجرد والإقفال *</label>
                  <input
                    type="date"
                    value={closingDate}
                    onChange={(e) => setClosingDate(e.target.value)}
                    className={styles.formInput}
                    required
                  />
                </div>
              </div>

              {/* Live Ledger Preview */}
              <div className={styles.ledgerPreviewBox}>
                <div className={styles.previewItem}>
                  <span className={styles.previewLabel}>الرصيد الدفتري بالأستاذ العام</span>
                  <span className={`${styles.previewValue} ${styles.previewValuePrimary}`}>
                    {isLoadingPreview ? '...' : formatCashCurrency(systemBalance)}
                  </span>
                </div>
                <div className={styles.previewItem}>
                  <span className={styles.previewLabel}>عدد الحركات المسجلة اليوم</span>
                  <span className={styles.previewValue}>
                    {isLoadingPreview ? '...' : previewData?.entries_count_today ?? 0} قيد
                  </span>
                </div>
                <div className={styles.previewItem}>
                  <span className={styles.previewLabel} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <ArrowDownLeft size={13} className="text-emerald-400" /> إجمالي مقبوضات اليوم
                  </span>
                  <span className="text-xs font-semibold text-emerald-400">
                    {isLoadingPreview ? '...' : formatCashCurrency(previewData?.total_debits_today ?? 0)}
                  </span>
                </div>
                <div className={styles.previewItem}>
                  <span className={styles.previewLabel} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <ArrowUpRight size={13} className="text-rose-400" /> إجمالي مدفوعات اليوم
                  </span>
                  <span className="text-xs font-semibold text-rose-400">
                    {isLoadingPreview ? '...' : formatCashCurrency(previewData?.total_credits_today ?? 0)}
                  </span>
                </div>
              </div>

              {/* Physical Cash Input */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  المبلغ الفعلي الموجود بالخزينة (الجرد الفعلي {currencySymbol()}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  placeholder="0.00"
                  className={styles.formInput}
                  style={{ fontSize: '1.125rem', fontWeight: 'bold' }}
                  required
                />
              </div>

              {/* Live Variance Calculation Feedback */}
              {actualCash !== null && difference !== null && (
                <div
                  className={`${styles.varianceCard} ${
                    difference === 0
                      ? styles.varianceMatch
                      : difference < 0
                      ? styles.varianceShortage
                      : styles.varianceSurplus
                  }`}
                >
                  <div className={styles.varianceTitle}>
                    {difference === 0 ? (
                      <>
                        <CheckCircle2 size={16} /> الجرد مطابق تماماً للرصيد الدفتري
                      </>
                    ) : difference < 0 ? (
                      <>
                        <AlertTriangle size={16} /> يوجد عجز نقدي بالصندوق
                      </>
                    ) : (
                      <>
                        <Info size={16} /> يوجد فائض نقدي بالصندوق
                      </>
                    )}
                  </div>
                  <div className={styles.varianceAmount}>
                    فارق الجرد: {formatCashCurrency(Math.abs(difference))}{' '}
                    {difference < 0 ? '(عجز)' : difference > 0 ? '(فائض)' : ''}
                  </div>
                  <div className={styles.varianceDesc}>
                    {difference === 0
                      ? 'لا توجد أي فروقات نقدية. سيتم اعتماد محضر الإقفال تلقائياً دون قيود تسوية.'
                      : difference < 0
                      ? 'سيتم تسجيل المحضر كـ «معلق»، وباعتماده من الإدارة سيتم ترحيل قيد تسوية (مدين ح/ 527 تسويات وفروق هللات، دائن الخزينة).'
                      : 'سيتم تسجيل المحضر كـ «معلق»، وباعتماده من الإدارة سيتم ترحيل قيد تسوية (مدين الخزينة، دائن ح/ 527 تسويات وفروق هللات).'}
                  </div>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>ملاحظات الجرد وأسباب الفروق إن وجدت</label>
                <textarea
                  rows={2}
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="مثال: تم جرد الفئات النقدية بمعرفة أمين الصندوق، الفارق ناتج عن..."
                  className={styles.formTextarea}
                />
              </div>

              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={isSubmitting || actualCash === null}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {isSubmitting ? 'جاري الحفظ والتسجيل...' : 'تثبيت محضر إقفال الخزينة'}
              </button>
            </form>
          </div>

          {/* Column 2: Audit Guidelines & Safe Balance Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <Scale size={18} className="text-amber-400" />
                  قواعد وضوابط إقفال الخزينة اليومي
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8125rem', color: '#cbd5e1' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className="text-amber-400 font-bold">•</span>
                  <span>
                    <strong>منع التكرار:</strong> يمنع النظام تسجيل أكثر من محضر إقفال لنفس الخزينة في نفس
                    التاريخ، لضمان صحة التسلسل اليومي.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className="text-amber-400 font-bold">•</span>
                  <span>
                    <strong>المطابقة الصفرية:</strong> إذا كان الفارق بين الجرد الفعلي والدفتري 0.00 {currencySymbol()}، يُعتمد
                    المحضر تلقائياً فور حفظه.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className="text-amber-400 font-bold">•</span>
                  <span>
                    <strong>اعتماد الفروق (ح/ 527):</strong> في حال وجود عجز أو فائض، يبقى المحضر بحالة «معلق» ولا
                    يتم ترحيل أي أثر مالي حتى يقوم المدير المالي باعتماده، وعندها يُنشأ قيد التسوية آلياً على حساب
                    527.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className="text-amber-400 font-bold">•</span>
                  <span>
                    <strong>الحركات اللاحقة:</strong> أي سندات أو فواتير تسجل بتاريخ لاحق لتاريخ الإقفال لا تؤثر على
                    رصيد المحضر التاريخي المثبت.
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Summary of Active Safes */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <Coins size={18} className="text-emerald-400" />
                  حسابات الصناديق والخزائن المعرفة
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {safeAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '0.375rem',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <div>
                      <span className="font-semibold text-white">{acc.name}</span>
                      <span className="text-xs text-slate-400 mr-2 font-mono">({acc.code})</span>
                    </div>
                    <button
                      onClick={() => setSelectedAccountId(acc.id)}
                      className={styles.btnSecondary}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      اختيار للجرد
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* History Log Section */}
        <div className={styles.historyCard}>
          <div
            style={{
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} className="text-slate-400" />
              <h3 className="font-bold text-white text-base m-0">سجل محاضر إقفال الخزينة السابقة</h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                value={historyAccountFilter}
                onChange={(e) => setHistoryAccountFilter(e.target.value)}
                className={styles.formSelect}
                style={{ width: 'auto', minWidth: '180px' }}
              >
                <option value="all">كل الخزائن</option>
                {safeAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoadingHistory ? (
            <LoadingScreen />
          ) : historyList.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              لم تسجل أي محاضر إقفال سابقة لهذه الخزينة حتى الآن.
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>رقم المحضر</th>
                    <th>تاريخ الإقفال</th>
                    <th>حساب الخزينة</th>
                    <th>الرصيد الدفتري</th>
                    <th>الجرد الفعلي</th>
                    <th>الفارق</th>
                    <th>الحالة</th>
                    <th>الملاحظات</th>
                    <th style={{ textAlign: 'center' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map((closing) => {
                    const isPending = closing.status === 'pending';
                    const hasDiff = closing.difference !== 0;

                    return (
                      <tr key={closing.id} className={styles.tableRow}>
                        <td>
                          <span className={styles.docCode}>{closing.closing_number}</span>
                        </td>
                        <td className="text-slate-300 font-mono text-xs">{closing.closing_date}</td>
                        <td>
                          <span className="font-medium text-slate-200">
                            {closing.account_name} ({closing.account_code})
                          </span>
                        </td>
                        <td className="font-mono text-slate-300">
                          {formatCashCurrency(closing.system_balance)}
                        </td>
                        <td className="font-mono font-bold text-white">
                          {formatCashCurrency(closing.actual_cash)}
                        </td>
                        <td>
                          <span
                            className={`font-mono font-bold ${
                              closing.difference === 0
                                ? 'text-emerald-400'
                                : closing.difference < 0
                                ? 'text-rose-400'
                                : 'text-sky-400'
                            }`}
                          >
                            {formatCashCurrency(closing.difference)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${
                              closing.status === 'approved'
                                ? styles.statusApproved
                                : closing.status === 'pending'
                                ? styles.statusPending
                                : styles.statusRejected
                            }`}
                          >
                            {closing.status === 'approved'
                              ? 'معتمد ومرحل'
                              : closing.status === 'pending'
                              ? 'معلق للاعتماد'
                              : 'ملغي'}
                          </span>
                        </td>
                        <td className="text-xs text-slate-400 max-w-xs truncate">
                          {closing.notes || '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isPending && hasDiff && (
                            <button
                              onClick={() => openApproveModal(closing)}
                              className={styles.btnApprove}
                              title="اعتماد المحضر وترحيل الفارق لحساب 527"
                            >
                              <ShieldCheck size={14} style={{ display: 'inline', marginLeft: '4px' }} />
                              اعتماد التسوية
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Manager Approval for Shortage/Surplus */}
        {isApproveModalOpen && selectedClosingForApproval && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  اعتماد تسوية محضر الإقفال ({selectedClosingForApproval.closing_number})
                </h3>
                <button
                  onClick={() => setIsApproveModalOpen(false)}
                  className={styles.modalClose}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleApproveSubmit}>
                <div className={styles.modalBody}>
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>الخزينة:</span>
                      <strong className="text-white">
                        {selectedClosingForApproval.account_name} (
                        {selectedClosingForApproval.account_code})
                      </strong>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>تاريخ الإقفال:</span>
                      <strong className="text-white">
                        {selectedClosingForApproval.closing_date}
                      </strong>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>الرصيد الدفتري:</span>
                      <strong className="text-white">
                        {formatCashCurrency(selectedClosingForApproval.system_balance)}
                      </strong>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>الجرد الفعلي:</span>
                      <strong className="text-white">
                        {formatCashCurrency(selectedClosingForApproval.actual_cash)}
                      </strong>
                    </div>
                    <div className="flex justify-between text-xs border-t border-slate-700 pt-2 font-bold">
                      <span className="text-amber-400">فارق التسوية المرحل لحساب 527:</span>
                      <span
                        className={
                          selectedClosingForApproval.difference < 0
                            ? 'text-rose-400 font-mono text-sm'
                            : 'text-sky-400 font-mono text-sm'
                        }
                      >
                        {formatCashCurrency(selectedClosingForApproval.difference)}{' '}
                        {selectedClosingForApproval.difference < 0 ? '(عجز)' : '(فائض)'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>بيان وملاحظات قيد الاعتماد والتسوية</label>
                    <textarea
                      rows={2}
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      className={styles.formTextarea}
                      required
                    />
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    onClick={() => setIsApproveModalOpen(false)}
                    className={styles.btnSecondary}
                    disabled={isSubmittingApproval}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={isSubmittingApproval}
                  >
                    {isSubmittingApproval ? 'جاري الاعتماد والترحيل...' : 'تأكيد الاعتماد والترحيل'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MasterPage>
  );
}
