'use client';
import { currencySymbol } from '@/lib/currency';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Info,
  Layers,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import MasterPage from '@/components/MasterPage';
import LoadingScreen from '@/components/LoadingScreen';
import JobOrderSelector from '@/components/JobOrderSelector';
import TelegramAttachmentField, { AttachmentViewButton } from '@/components/TelegramAttachmentField';
import { StagedAttachment } from '@/lib/attachments/telegramAttachments';
import { useCompany } from '@/lib/CompanyContext';
import { usePermissions } from '@/lib/PermissionsContext';
import { notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { executeDraftWithOfflineQueue } from '@/lib/offline/offlineExecutor';
import SendPartnerMessageButton from '@/components/SendPartnerMessageButton';
import { readCachedTableRows } from '@/lib/offline/referenceCache';
import { useOfflineSync } from '@/lib/offline/useOfflineSync';
import {
  CustodyDisbursementVoucher,
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

const CUSTODY_EXPENSE_CATEGORIES = [
  'مستهلكات ومواد تشغيل',
  'محروقات وانتقالات',
  'إعاشة وتغذية',
  'عدد ومعدات',
  'صيانة وإصلاحات',
  'مواد إنشائية',
  'مصاريف إدارية',
  'أدوات نظافة',
];

export default function CustodiesPage() {
  const queryClient = useQueryClient();
  const { activeCompany } = useCompany();
  const { can } = usePermissions();
  const { items: offlineQueueItems } = useOfflineSync();

  // Filters & State
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [expandedCustodyIds, setExpandedCustodyIds] = useState<Record<string, boolean>>({});
  const [approvingCustodyId, setApprovingCustodyId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearchQuery(q);
  }, []);

  // Modals State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [selectedCustodyForSettle, setSelectedCustodyForSettle] = useState<SiteCustody | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedCustodyForPrint, setSelectedCustodyForPrint] = useState<SiteCustody | null>(null);

  // Custody Expense Draft Modal State
  const [isCustExpModalOpen, setIsCustExpModalOpen] = useState(false);
  const [selectedCustodyForExp, setSelectedCustodyForExp] = useState<SiteCustody | null>(null);
  const [custExpDate, setCustExpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [custExpCategory, setCustExpCategory] = useState(CUSTODY_EXPENSE_CATEGORIES[0]);
  const [custExpAccount, setCustExpAccount] = useState('');
  const [custExpProjectId, setCustExpProjectId] = useState<string>('');
  const [custExpJobOrderId, setCustExpJobOrderId] = useState<string | null>(null);
  const [custExpDesc, setCustExpDesc] = useState('');
  const [custExpAmount, setCustExpAmount] = useState<number | ''>('');
  const [custExpVat, setCustExpVat] = useState<number | ''>(0);
  const [custExpNotes, setCustExpNotes] = useState('');
  const [custExpAttachmentUrl, setCustExpAttachmentUrl] = useState<string | null>(null);
  const [custExpStagedAtt, setCustExpStagedAtt] = useState<StagedAttachment | null>(null);
  const [isSubmittingCustExp, setIsSubmittingCustExp] = useState(false);

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
    'cash_return' | 'salary_deduction' | 'carry_forward' | 'cleared' | 'merge_custody'
  >('cash_return');
  const [settlementDestinationId, setSettlementDestinationId] = useState('');
  const [settlementDate, setSettlementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [settlementNotes, setSettlementNotes] = useState('');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  // Queries
  const { data: summaryData, error: summaryError, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['site_custodies_summary', activeCompany?.id, statusFilter],
    queryFn: () => fetchSiteCustodies(statusFilter),
    enabled: !!activeCompany?.id,
    retry: false,
    staleTime: 60000,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['partners_for_custodies', activeCompany?.id],
    queryFn: async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return readCachedTableRows('partners');
      }
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
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return readCachedTableRows('projects');
      }
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
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await readCachedTableRows('accounts');
        return cached.filter(
          (a: any) =>
            a.is_transactional &&
            (String(a.code || '').startsWith('121') ||
              String(a.code || '').startsWith('122') ||
              String(a.code || '') === '123')
        );
      }
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

  const { data: expenseAccounts = [] } = useQuery({
    queryKey: ['expense_accounts_for_custodies', activeCompany?.id],
    queryFn: async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await readCachedTableRows('accounts');
        return cached.filter(
          (a: any) => a.is_transactional && String(a.code || '').startsWith('5')
        );
      }
      const { data } = await supabase
        .from('accounts')
        .select('id, code, name')
        .ilike('code', '5%')
        .eq('is_transactional', true)
        .order('code');
      return data || [];
    },
    enabled: !!activeCompany?.id,
  });

  const openCustodiesForMerge = useMemo(() => {
    if (!summaryData?.custodies || !selectedCustodyForSettle) return [];
    return summaryData.custodies.filter(
      (c) => c.status === 'open' && c.id !== selectedCustodyForSettle.id
    );
  }, [summaryData?.custodies, selectedCustodyForSettle]);

  const targetCustodyForMerge = useMemo(() => {
    if (settlementType !== 'merge_custody' || !settlementDestinationId) return null;
    return openCustodiesForMerge.find((c) => c.id === settlementDestinationId) || null;
  }, [settlementType, settlementDestinationId, openCustodiesForMerge]);

  const toggleExpand = (id: string) => {
    setExpandedCustodyIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openCustodyExpenseModal = (custody: SiteCustody) => {
    setSelectedCustodyForExp(custody);
    setCustExpDate(new Date().toISOString().slice(0, 10));
    setCustExpCategory(CUSTODY_EXPENSE_CATEGORIES[0]);
    setCustExpAccount(expenseAccounts[0]?.name || '');
    setCustExpProjectId(custody.project_id || '');
    setCustExpJobOrderId(null);
    setCustExpDesc('');
    setCustExpAmount('');
    setCustExpVat(0);
    setCustExpNotes('');
    setCustExpAttachmentUrl(null);
    setCustExpStagedAtt(null);
    setIsCustExpModalOpen(true);
  };

  const handleCustodyExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustodyForExp) return;
    const baseAmt = Number(custExpAmount || 0);
    const vatAmt = Number(custExpVat || 0);
    if (!custExpDesc.trim() || baseAmt <= 0) {
      notify('يرجى إدخال بيان المصروف ومبلغ أكبر من صفر', 'error');
      return;
    }
    if (custExpProjectId && !custExpJobOrderId) {
      notify('يرجى اختيار أمر الشغل المرتبط بالمشروع لربط مصروف العهدة بالميزانية', 'error');
      return;
    }

    const selectedProject = (projects as any[]).find(
      (p) => String(p.id) === String(custExpProjectId)
    );
    const totalAmt = baseAmt + vatAmt;

    try {
      setIsSubmittingCustExp(true);
      const execRes = await executeDraftWithOfflineQueue({
        entityType: 'custody_expense_draft',
        rpcName: 'save_expense_draft',
        companyId: activeCompany?.id,
        companyName: activeCompany?.name || 'الشركة الحالية',
        description: `مصروف عهدة (${selectedCustodyForExp.custody_number}): ${custExpDesc.trim()}`,
        amount: totalAmt,
        payload: {
          exp_date: custExpDate,
          main_category: custExpCategory,
          creditor_account: custExpAccount || expenseAccounts[0]?.name || 'مصروفات مواقع عامة',
          payment_method: 'عهدة',
          payment_account: '125 - عُهد الموظفين والمواقع',
          custody_id: selectedCustodyForExp.id,
          project_id: custExpProjectId || null,
          site_ref: selectedProject?.Property || selectedCustodyForExp.project_name || null,
          job_order_id: custExpJobOrderId || null,
          employee_name: selectedCustodyForExp.partner_name || null,
          description: custExpDesc.trim(),
          quantity: 1,
          unit_price: baseAmt,
          vat_amount: vatAmt,
          discount_amount: 0,
          notes: custExpNotes || null,
          invoice_image: custExpAttachmentUrl,
          lines_data: [
            {
              description: custExpDesc.trim(),
              quantity: 1,
              unit_price: baseAmt,
              vat_amount: vatAmt,
              discount_amount: 0,
              total_price: totalAmt,
            },
          ],
          is_posted: false,
        },
        stagedAttachment: custExpStagedAtt,
        attachmentModule: 'custodies',
      });

      setExpandedCustodyIds((prev) => ({ ...prev, [selectedCustodyForExp.id]: true }));
      setIsCustExpModalOpen(false);
      setSelectedCustodyForExp(null);

      if (execRes.mode === 'queued') {
        notify(
          'تم حفظ مسودة مصروف العهدة والمرفق محلياً (أوفلاين)؛ ستُرفع تلقائياً فور عودة الإنترنت',
          'info'
        );
      } else {
        notify('تم تسجيل مسودة مصروف العهدة بنجاح', 'success');
        void queryClient.invalidateQueries({ queryKey: ['site_custodies_summary'] });
        void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      }
    } catch (err: any) {
      notify(err?.message || 'فشل تسجيل مصروف العهدة', 'error');
    } finally {
      setIsSubmittingCustExp(false);
    }
  };

  const openSettleModal = (custody: SiteCustody) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      notify('تصفية وتسوية العهد تتطلب اتصالاً مباشراً بالإنترنت', 'warning');
      return;
    }
    if ((custody.expenses || []).some((ex) => ex._offline_queued)) {
      notify('يرجى انتظار مزامنة مسودات المصروفات غير المتصلة على هذه العهدة أولاً قبل التسوية', 'warning');
      return;
    }
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
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      notify('صرف عهدة نقدية جديدة وترحيل قيدها يتطلبان اتصالاً بالإنترنت', 'warning');
      return;
    }
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
      setNewPartnerId('');
      setNewProjectId('');
      setNewTitle('');
      setNewAmount('');
      setNewNotes('');
      queryClient.invalidateQueries({ queryKey: ['site_custodies_summary'] });
      queryClient.invalidateQueries({ queryKey: ['payment_vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['vouchers_server_totals'] });
    } catch (err: any) {
      notify(err.message || 'حدث خطأ أثناء صرف العهدة', 'error');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustodyForSettle) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      notify('تسوية العهدة وإقفال قيودها يتطلبان اتصالاً بالإنترنت', 'warning');
      return;
    }

    if (
      settlementType === 'cash_return' &&
      selectedCustodyForSettle.remaining_amount > 0 &&
      !settlementDestinationId
    ) {
      notify('يرجى تحديد حساب الخزينة أو البنك المردود إليه النقدية', 'error');
      return;
    }

    if (
      settlementType === 'merge_custody' &&
      selectedCustodyForSettle.remaining_amount > 0 &&
      !settlementDestinationId
    ) {
      notify('يرجى اختيار العهدة الجارية المراد ضم الرصيد إليها', 'error');
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
            : settlementType === 'merge_custody'
            ? settlementDestinationId
            : settlementType === 'carry_forward'
            ? selectedCustodyForSettle.project_id
            : null,
        settlementDate,
        notes: settlementNotes,
      });

      notify(
        settlementType === 'merge_custody'
          ? 'تم ضم رصيد العهدة بنجاح وتحديث العهدة المدمج إليها وإقفال العهدة الحالية'
          : 'تمت تسوية العهدة بنجاح وإقفال قيود الأستاذ العام',
        'success'
      );
      setIsSettleModalOpen(false);
      setSelectedCustodyForSettle(null);
      queryClient.invalidateQueries({ queryKey: ['site_custodies_summary'] });
      queryClient.invalidateQueries({ queryKey: ['payment_vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['receipt_vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['vouchers_server_totals'] });
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

  // Merge offline queued custody expense drafts into their open custodies
  const custodiesWithOffline = useMemo(() => {
    const baseList = summaryData?.custodies || [];
    if (!activeCompany?.id) return baseList;

    const queuedCustExpenses = offlineQueueItems.filter(
      (it) =>
        it.company_id === activeCompany.id &&
        it.entity_type === 'custody_expense_draft' &&
        it.payload?.custody_id
    );
    if (queuedCustExpenses.length === 0) return baseList;

    return baseList.map((c) => {
      const matchingQueued = queuedCustExpenses.filter(
        (q) => String(q.payload?.custody_id) === String(c.id)
      );
      if (matchingQueued.length === 0) return c;

      const existingIds = new Set((c.expenses || []).map((ex) => String(ex.id)));
      const mappedQueued: CustodyExpense[] = matchingQueued
        .filter((q) => !existingIds.has(String(q.id)))
        .map((q) => ({
          id: q.id,
          exp_date: q.payload?.exp_date || q.created_at.slice(0, 10),
          description: q.payload?.description || q.description,
          amount: q.amount,
          paid_amount: 0,
          vat_amount: Number(q.payload?.vat_amount || 0),
          payment_method: 'عهدة',
          is_posted: false,
          invoice_image: q.payload?.invoice_image || null,
          _offline_queued: true,
        }));

      const addedSpent = mappedQueued.reduce((s, x) => s + Number(x.amount || 0), 0);
      return {
        ...c,
        spent_amount: Number(c.spent_amount || 0) + addedSpent,
        remaining_amount: Number(c.remaining_amount || 0) - addedSpent,
        expenses: [...mappedQueued, ...(c.expenses || [])],
      };
    });
  }, [summaryData?.custodies, offlineQueueItems, activeCompany?.id]);

  const handleApproveDraftCustodyVoucher = async (custody: SiteCustody) => {
    if (!custody.payment_voucher_id) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      notify('اعتماد السند وترحيل العهدة يتطلب اتصالاً بالإنترنت', 'warning');
      return;
    }
    try {
      setApprovingCustodyId(custody.id);
      const { error } = await supabase.rpc('post_payment_vouchers_bulk', {
        p_ids: [custody.payment_voucher_id],
      });
      if (error) throw error;
      notify(
        `تم اعتماد سند الصرف ${custody.voucher_number || ''} وتفعيل العهدة ${custody.custody_number}`,
        'success',
      );
      queryClient.invalidateQueries({ queryKey: ['site_custodies_summary'] });
      queryClient.invalidateQueries({ queryKey: ['payment_vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['vouchers_server_totals'] });
    } catch (err: any) {
      notify(err.message || 'تعذر اعتماد سند الصرف المرتبط بالعهدة', 'error');
    } finally {
      setApprovingCustodyId(null);
    }
  };

  // Filter list
  const kpis = summaryData?.kpis || {
    total_custodies: 0,
    open_custodies: 0,
    settled_custodies: 0,
    draft_custodies: 0,
    overdue_custodies: 0,
    total_disbursed: 0,
    total_spent: 0,
    total_remaining: 0,
  };

  const filteredCustodies = custodiesWithOffline.filter((c) => {
    if (selectedProjectId !== 'all' && c.project_id !== selectedProjectId) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = (c.custody_number || '').toLowerCase().includes(q);
      const matchVoucher = (c.voucher_number || '').toLowerCase().includes(q);
      const matchTitle = (c.title || '').toLowerCase().includes(q);
      const matchPartner = (c.partner_name || '').toLowerCase().includes(q);
      const matchProject = (c.project_name || '').toLowerCase().includes(q);
      if (!matchNum && !matchVoucher && !matchTitle && !matchPartner && !matchProject) return false;
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
              متابعة صرف العهد النقدية، تسجيل مصروفات العهدة كمسودات (حتى بدون إنترنت)، وتسويتها مع الخزينة أو الرواتب
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
            <button
              onClick={() => {
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                  notify('صرف عهدة جديدة يتطلب اتصالاً بالإنترنت', 'warning');
                  return;
                }
                setIsNewModalOpen(true);
              }}
              className={styles.btnPrimary}
            >
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
                {
                  id: 'draft',
                  label: kpis.draft_custodies ? `بانتظار الاعتماد (${kpis.draft_custodies})` : 'بانتظار الاعتماد',
                },
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
              placeholder="بحث برقم العهدة، رقم السند، المهندس، أو المشروع..."
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
          ) : summaryData?.migrationRequired ? (
            <div className={styles.emptyState} role="alert" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
              <div style={{ width: '48px', height: '48px', margin: '0 auto 1rem auto', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={26} color="#f59e0b" />
              </div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 900, color: '#fefcf9', fontSize: 'var(--fs-lg, 16px)' }}>
                شاشة العُهد بانتظار تطبيق الميجريشن في Supabase
              </h3>
              <p style={{ margin: '0 auto 1.25rem auto', maxWidth: '520px', fontSize: 'var(--fs-xs, 12px)', color: '#ede5da', lineHeight: 1.6 }}>
                جداول وإجراءات عُهد المواقع (حساب 125) وإقفال الصناديق اليومية جاهزة بالكامل في ملف الميجريشن. يرجى تشغيل الملف في الـ SQL Editor لتفعيل الميزة فورياً.
              </p>
              <div style={{ display: 'inline-flex', padding: '0.5rem 1rem', background: 'var(--surface-sunken)', boxShadow: 'var(--shadow-sunken)', border: 'none', borderRadius: '10px', fontSize: '11px', color: 'var(--accent-ink)', fontFamily: 'monospace', fontWeight: 800 }}>
                supabase/migrations/20261105170007_custodies_and_cash_closings.sql
              </div>
            </div>
          ) : summaryError ? (
            <div className={styles.emptyState} role="alert">
              <p>{summaryError.message}</p>
            </div>
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
                    const hasDisbursementVouchers = (custody.disbursement_vouchers || []).length > 0;
                    const hasMovements = hasExpenses || hasDisbursementVouchers;

                    return (
                      <Fragment key={custody.id}>
                        <tr className={styles.tableRow}>
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <span className={styles.custodyCode}>{custody.custody_number}</span>
                              {custody.voucher_number && (
                                <Link
                                  href={`/PaymentVouchers?q=${encodeURIComponent(custody.voucher_number)}`}
                                  className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline"
                                  title="عرض سند الصرف المرتبط"
                                >
                                  <FileText size={11} />
                                  سند: {custody.voucher_number}
                                </Link>
                              )}
                            </div>
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
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                              <span
                                className={`${styles.statusBadge} ${styles[statusConfig.className]}`}
                              >
                                {statusConfig.label}
                              </span>
                              {custody.status === 'settled' && custody.settlement_type && (
                                <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 whitespace-nowrap">
                                  {SETTLEMENT_TYPES[custody.settlement_type]?.label || custody.settlement_type}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className={styles.rowActions} style={{ justifyContent: 'center' }}>
                              {custody.status === 'draft' && custody.payment_voucher_id && (
                                <>
                                  {can('payments', 'post') && (
                                    <button
                                      onClick={() => handleApproveDraftCustodyVoucher(custody)}
                                      disabled={approvingCustodyId === custody.id}
                                      className={styles.actionBtnSettle}
                                      title="اعتماد وترحيل سند الصرف المرتبط وتفعيل العهدة"
                                    >
                                      <CheckCircle2 size={13} />
                                      {approvingCustodyId === custody.id ? 'جاري الاعتماد...' : 'اعتماد السند'}
                                    </button>
                                  )}
                                  <Link
                                    href={`/PaymentVouchers?q=${encodeURIComponent(custody.voucher_number || custody.custody_number)}`}
                                    className={styles.btnSecondary}
                                    style={{ padding: '0.32rem 0.6rem', fontSize: '0.75rem' }}
                                    title="مراجعة وتعديل السند في شاشة سندات الصرف"
                                  >
                                    <FileText size={13} />
                                    السند
                                  </Link>
                                </>
                              )}
                              {custody.status === 'open' && (
                                <>
                                  <button
                                    onClick={() => openCustodyExpenseModal(custody)}
                                    className={styles.btnSecondary}
                                    style={{ padding: '0.32rem 0.6rem', fontSize: '0.75rem' }}
                                    title="تسجيل مصروف عهدة كمسودة (يدعم عدم الاتصال ومرفقات تيليجرام)"
                                  >
                                    <Receipt size={13} />
                                    + مصروف
                                  </button>
                                  <button
                                    onClick={() => openSettleModal(custody)}
                                    className={styles.actionBtnSettle}
                                    title="تصفية وتسوية العهدة"
                                  >
                                    تسوية
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handlePrintSlip(custody)}
                                className={styles.actionBtnExpand}
                                title="طباعة محضر تسوية وتصفية العهدة"
                              >
                                <Printer size={15} />
                              </button>
                              <SendPartnerMessageButton
                                partnerId={custody.partner_id}
                                partnerName={custody.partner_name}
                                operation={{
                                  type: 'custody',
                                  reference: custody.custody_number,
                                  date: custody.opened_date,
                                  project: custody.project_name || 'عهدة عامة',
                                  amount: custody.disbursed_amount,
                                  description: custody.title,
                                  status: statusConfig.label,
                                  extraLines: [
                                    { label: 'المصروف', value: formatCustodyCurrency(custody.spent_amount) },
                                    { label: 'المتبقي', value: formatCustodyCurrency(custody.remaining_amount) },
                                  ],
                                }}
                              />
                            </div>
                          </td>
                        </tr>

                        {/* Expandable expenses row */}
                        {isExpanded && (
                          <tr>
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

                                {custody.status === 'settled' && (
                                  <div className="mb-3 p-3 bg-slate-800/80 border border-emerald-500/30 rounded-lg text-xs space-y-1">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="font-semibold text-emerald-400">
                                        تمت تسوية وإقفال هذه العهدة بتاريخ: {custody.settlement_date || '—'}
                                      </span>
                                      <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                                        طريقة التسوية: {SETTLEMENT_TYPES[custody.settlement_type || '']?.label || custody.settlement_type || 'تسوية مسجلة'}
                                      </span>
                                    </div>
                                    {custody.settlement_notes && (
                                      <p className="text-slate-300 text-[11px] mt-1">
                                        ملاحظات التسوية: {custody.settlement_notes}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {!hasMovements ? (
                                  <p className="text-xs text-slate-400 py-2">
                                    لم تسجل أي مصروفات أو سندات صرف على هذه العهدة حتى الآن.
                                  </p>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {hasExpenses && (
                                      <table className={styles.subTable}>
                                        <thead>
                                          <tr>
                                            <th>التاريخ</th>
                                            <th>البيان والمصروف</th>
                                            <th>طريقة الصرف</th>
                                            <th>الضريبة</th>
                                            <th>قيمة المصروف</th>
                                            <th>المرفق</th>
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
                                                {formatCustodyCurrency(exp.amount ?? exp.paid_amount ?? 0)}
                                              </td>
                                              <td>
                                                {exp.invoice_image ? (
                                                  <AttachmentViewButton
                                                    url={exp.invoice_image}
                                                    label="المرفق"
                                                    title={exp.description}
                                                  />
                                                ) : (
                                                  <span className="text-xs text-slate-500">—</span>
                                                )}
                                              </td>
                                              <td>
                                                <span
                                                  className={
                                                    exp._offline_queued
                                                      ? 'text-xs text-sky-400'
                                                      : exp.is_posted
                                                      ? 'text-xs text-emerald-400'
                                                      : 'text-xs text-amber-400'
                                                  }
                                                >
                                                  {exp._offline_queued
                                                    ? 'في طابور المزامنة'
                                                    : exp.is_posted
                                                    ? 'مرحل للأستاذ العام'
                                                    : 'مسودة'}
                                                </span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}

                                    {hasDisbursementVouchers && (
                                      <div>
                                        <div className="text-xs font-bold text-amber-300 mb-2">
                                          سندات الصرف المسددة من هذه العهدة ({custody.disbursement_vouchers?.length || 0})
                                        </div>
                                        <table className={styles.subTable}>
                                          <thead>
                                            <tr>
                                              <th>رقم السند</th>
                                              <th>التاريخ</th>
                                              <th>المستفيد</th>
                                              <th>الحساب المدين والبيان</th>
                                              <th>المبلغ</th>
                                              <th>الحالة المحاسبية</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {custody.disbursement_vouchers?.map((pv: CustodyDisbursementVoucher) => (
                                              <tr key={pv.id}>
                                                <td>
                                                  <Link
                                                    href={`/PaymentVouchers?q=${encodeURIComponent(pv.voucher_number)}`}
                                                    className="inline-flex items-center gap-1 text-sky-400 hover:underline font-semibold"
                                                  >
                                                    <FileText size={12} />
                                                    {pv.voucher_number}
                                                  </Link>
                                                </td>
                                                <td>{pv.date}</td>
                                                <td>{pv.payee_name || '—'}</td>
                                                <td>
                                                  {pv.debit_account_name ? `${pv.debit_account_name} — ` : ''}
                                                  {pv.description || 'سداد من عهدة'}
                                                </td>
                                                <td className="font-semibold text-amber-400">
                                                  {formatCustodyCurrency(pv.amount)}
                                                </td>
                                                <td>
                                                  <span className={pv.is_posted ? 'text-xs text-emerald-400' : 'text-xs text-amber-400'}>
                                                    {pv.is_posted ? 'مرحل ومخصوم من العهدة' : 'مسودة (لم يرحل بعد)'}
                                                  </span>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Record Custody Expense Draft (Offline + Telegram Bot Supported) */}
        {isCustExpModalOpen && selectedCustodyForExp && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '620px' }}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  تسجيل مصروف عهدة (مسودة) — {selectedCustodyForExp.custody_number}
                </h3>
                <button
                  onClick={() => setIsCustExpModalOpen(false)}
                  className={styles.modalClose}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCustodyExpenseSubmit}>
                <div className={styles.modalBody}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.875rem',
                    }}
                  >
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>تاريخ الفاتورة / المصروف *</label>
                      <input
                        type="date"
                        value={custExpDate}
                        onChange={(e) => setCustExpDate(e.target.value)}
                        className={styles.formInput}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>التصنيف *</label>
                      <select
                        value={custExpCategory}
                        onChange={(e) => setCustExpCategory(e.target.value)}
                        className={styles.formSelect}
                        required
                      >
                        {CUSTODY_EXPENSE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>حساب المصروف (المدين) *</label>
                    <select
                      value={custExpAccount}
                      onChange={(e) => setCustExpAccount(e.target.value)}
                      className={styles.formSelect}
                      required
                    >
                      <option value="">-- اختر حساب المصروف --</option>
                      {expenseAccounts.map((acc: any) => (
                        <option key={acc.id} value={acc.name}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.875rem',
                    }}
                  >
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>المشروع / العقار</label>
                      <select
                        value={custExpProjectId}
                        onChange={(e) => {
                          setCustExpProjectId(e.target.value);
                          setCustExpJobOrderId(null);
                        }}
                        className={styles.formSelect}
                      >
                        <option value="">-- مصروف عهدة عام --</option>
                        {projects.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.Property}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <JobOrderSelector
                        projectId={custExpProjectId || null}
                        value={custExpJobOrderId}
                        onChange={(id) => setCustExpJobOrderId(id)}
                        required={Boolean(custExpProjectId)}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>بيان الفاتورة / المشتريات *</label>
                    <input
                      type="text"
                      value={custExpDesc}
                      onChange={(e) => setCustExpDesc(e.target.value)}
                      placeholder="مثال: شراء مواسير سباكة ومستلزمات تركيب للموقع"
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
                      <label className={styles.formLabel}>المبلغ قبل الضريبة ({currencySymbol()}) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={custExpAmount}
                        onChange={(e) =>
                          setCustExpAmount(e.target.value === '' ? '' : parseFloat(e.target.value))
                        }
                        placeholder="0.00"
                        className={styles.formInput}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>ضريبة القيمة المضافة ({currencySymbol()})</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={custExpVat}
                        onChange={(e) =>
                          setCustExpVat(e.target.value === '' ? '' : parseFloat(e.target.value))
                        }
                        placeholder="0.00"
                        className={styles.formInput}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <TelegramAttachmentField
                      module="custodies"
                      allowOfflineStage={true}
                      label="صورة فاتورة العهدة (تُحفظ عبر Telegram Bot وتدعم الأوفلاين)"
                      value={custExpAttachmentUrl}
                      onChange={setCustExpAttachmentUrl}
                      stagedAttachment={custExpStagedAtt}
                      onStagedChange={setCustExpStagedAtt}
                      caption={`فاتورة عهدة ${selectedCustodyForExp.custody_number} - ${custExpDesc}`}
                      compact={true}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>ملاحظات إضافية</label>
                    <input
                      type="text"
                      value={custExpNotes}
                      onChange={(e) => setCustExpNotes(e.target.value)}
                      placeholder="رقم الفاتورة الورقية أو اسم المورد..."
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    onClick={() => setIsCustExpModalOpen(false)}
                    className={styles.btnSecondary}
                    disabled={isSubmittingCustExp}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={isSubmittingCustExp}
                  >
                    {isSubmittingCustExp ? 'جاري الحفظ...' : 'حفظ مسودة مصروف العهدة'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
                      <label className={styles.formLabel}>مبلغ العهدة ({currencySymbol()}) *</label>
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
                              onChange={() => {
                                setSettlementType('carry_forward');
                                setSettlementDestinationId('');
                              }}
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

                          <label
                            className={`${styles.settlementOptionCard} ${
                              settlementType === 'merge_custody'
                                ? styles.settlementOptionActive
                                : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="settle_type"
                              value="merge_custody"
                              checked={settlementType === 'merge_custody'}
                              onChange={() => {
                                setSettlementType('merge_custody');
                                if (!openCustodiesForMerge.some((c) => c.id === settlementDestinationId)) {
                                  setSettlementDestinationId(openCustodiesForMerge[0]?.id || '');
                                }
                              }}
                              style={{ marginTop: '0.2rem' }}
                            />
                            <div>
                              <span className="font-bold block text-sm text-white">
                                {SETTLEMENT_TYPES.merge_custody.label}
                              </span>
                              <span className="text-xs text-slate-400">
                                {SETTLEMENT_TYPES.merge_custody.desc}
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

                      {settlementType === 'merge_custody' && (
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>
                            اختر العهدة الجارية المراد ضم هذا المبلغ إليها *
                          </label>
                          {openCustodiesForMerge.length === 0 ? (
                            <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-lg text-amber-300 text-xs">
                              لا توجد أي عهد جارية أخرى مفتوحة حالياً في الشركة لضم هذا المبلغ إليها. يمكنك استخدام خيار «ترحيل لعهدة جديدة» أو «رد نقدي للخزينة».
                            </div>
                          ) : (
                            <>
                              <select
                                value={settlementDestinationId}
                                onChange={(e) => setSettlementDestinationId(e.target.value)}
                                className={styles.formSelect}
                                required
                              >
                                {openCustodiesForMerge.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.custody_number} — {c.partner_name || 'بدون اسم'} — {c.title} (متبقي حالياً: {formatCustodyCurrency(c.remaining_amount)})
                                  </option>
                                ))}
                              </select>

                              {targetCustodyForMerge && (
                                <div className="mt-3 p-3.5 bg-slate-900/95 border border-indigo-500/40 rounded-xl space-y-3">
                                  <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                                    <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                                      <Layers size={14} className="text-indigo-400" />
                                      بيان احتساب ضم العهدتين
                                    </span>
                                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono">
                                      {targetCustodyForMerge.custody_number} ← {selectedCustodyForSettle.custody_number}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700/60">
                                      <span className="text-slate-400 block text-[11px] mb-0.5">
                                        المبلغ المحوّل من العهدة الحالية
                                      </span>
                                      <span className="text-sm font-bold text-amber-400">
                                        +{formatCustodyCurrency(selectedCustodyForSettle.remaining_amount)}
                                      </span>
                                      <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                                        {selectedCustodyForSettle.custody_number} ({selectedCustodyForSettle.partner_name || 'صاحب العهدة'})
                                      </span>
                                    </div>

                                    <div className="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700/60">
                                      <span className="text-slate-400 block text-[11px] mb-0.5">
                                        رصيد العهدة المختارة قبل الضم
                                      </span>
                                      <span className="text-sm font-bold text-sky-400">
                                        {formatCustodyCurrency(targetCustodyForMerge.remaining_amount)}
                                      </span>
                                      <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                                        من أصل منصرف {formatCustodyCurrency(targetCustodyForMerge.disbursed_amount)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Requested Total combined amount */}
                                  <div className="p-3 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-indigo-950/60 border border-emerald-500/50 rounded-lg flex items-center justify-between">
                                    <div>
                                      <span className="text-xs font-bold text-emerald-300 block">
                                        المبلغ الإجمالي الجديد بعد الضم (التوتال)
                                      </span>
                                      <span className="text-[10px] text-slate-400 block mt-0.5">
                                        إجمالي المنصرف الجديد للعهدة: {formatCustodyCurrency(targetCustodyForMerge.disbursed_amount + selectedCustodyForSettle.remaining_amount)} (مصروف منها: {formatCustodyCurrency(targetCustodyForMerge.spent_amount)})
                                      </span>
                                    </div>
                                    <div className="text-left font-mono">
                                      <span className="text-base font-extrabold text-emerald-400 block">
                                        {formatCustodyCurrency(targetCustodyForMerge.remaining_amount + selectedCustodyForSettle.remaining_amount)}
                                      </span>
                                      <span className="text-[10px] text-emerald-500/80 font-sans">صافي متبقي متاح للصرف</span>
                                    </div>
                                  </div>

                                  {selectedCustodyForSettle.partner_id !== targetCustodyForMerge.partner_id && (
                                    <div className="text-[11px] text-amber-300/90 bg-amber-950/30 border border-amber-500/30 p-2 rounded flex items-center gap-1.5">
                                      <Info size={13} className="shrink-0" />
                                      <span>
                                        تنبيه: نظراً لاختلاف أصحاب العهدتين ({selectedCustodyForSettle.partner_name} ← {targetCustodyForMerge.partner_name})، سيتم إنشاء قيد أستاذ عام تلقائي لنقل المديونية في ح/125.
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
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
          <div className={`${styles.modalOverlay} custody-settlement-modal`}>
            <style jsx global>{`
              @media print {
                body:has(.custody-settlement-modal) *:not(:has(.custody-print-area)):not(.custody-print-area):not(.custody-print-area *):not(style):not(script) {
                  display: none !important;
                }
                body:has(.custody-settlement-modal) .custody-settlement-modal,
                body:has(.custody-settlement-modal) .custody-settlement-modal *:has(.custody-print-area) {
                  position: static !important;
                  width: auto !important;
                  max-width: none !important;
                  height: auto !important;
                  max-height: none !important;
                  overflow: visible !important;
                  background: #ffffff !important;
                  box-shadow: none !important;
                  border: none !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  display: block !important;
                }
                body:has(.custody-settlement-modal) .custody-print-area {
                  position: static !important;
                  width: 100% !important;
                  max-width: none !important;
                  height: auto !important;
                  overflow: visible !important;
                  background: #ffffff !important;
                  color: #0f172a !important;
                  padding: 12mm !important;
                  margin: 0 !important;
                }
                body:has(.custody-settlement-modal) .custody-print-area * {
                  color: #0f172a !important;
                  background: transparent !important;
                  border-color: #cbd5e1 !important;
                }
              }
            `}</style>
            <div className={styles.modalContent} style={{ maxWidth: '750px' }}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  محضر تسوية وتصفية عهدة ({selectedCustodyForPrint.custody_number})
                </h3>
                <button onClick={() => setIsPrintModalOpen(false)} className={styles.modalClose}>
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 text-slate-100 bg-slate-900 overflow-y-auto custody-print-area" id="print-area">
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
                    <span>تاريخ المحضر: {new Date().toLocaleDateString('en-GB')}</span>
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
                        <tr key={`exp-${idx}`} className="border-b border-slate-800">
                          <td className="p-1.5 border border-slate-700">{exp.exp_date}</td>
                          <td className="p-1.5 border border-slate-700">{exp.description}</td>
                          <td className="p-1.5 border border-slate-700">
                            {formatCustodyCurrency(exp.vat_amount || 0)}
                          </td>
                          <td className="p-1.5 border border-slate-700 font-semibold text-sky-400">
                            {formatCustodyCurrency(exp.amount ?? exp.paid_amount ?? 0)}
                          </td>
                        </tr>
                      ))}
                      {(selectedCustodyForPrint.disbursement_vouchers || []).filter((pv) => pv.is_posted).map((pv) => (
                        <tr key={`pv-${pv.id}`} className="border-b border-slate-800">
                          <td className="p-1.5 border border-slate-700">{pv.date}</td>
                          <td className="p-1.5 border border-slate-700">
                            سند صرف {pv.voucher_number} {pv.payee_name ? `(${pv.payee_name})` : ''} — {pv.description || pv.debit_account_name || 'سداد من العهدة'}
                          </td>
                          <td className="p-1.5 border border-slate-700">
                            {formatCustodyCurrency(0)}
                          </td>
                          <td className="p-1.5 border border-slate-700 font-semibold text-sky-400">
                            {formatCustodyCurrency(pv.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center p-3 bg-slate-800 rounded text-xs mb-4">
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

                {selectedCustodyForPrint.status === 'settled' && (
                  <div className="p-3 bg-slate-800/60 border border-slate-700 rounded text-xs mb-6 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-emerald-400">
                        حالة المحضر: تمت التسوية والإقفال
                      </span>
                      <span className="text-slate-300">
                        طريقة التسوية: {SETTLEMENT_TYPES[selectedCustodyForPrint.settlement_type || '']?.label || selectedCustodyForPrint.settlement_type || 'تسوية مسجلة'}
                      </span>
                    </div>
                    {selectedCustodyForPrint.settlement_date && (
                      <div className="text-slate-400 text-[11px]">
                        تاريخ اعتماد التسوية: {selectedCustodyForPrint.settlement_date}
                      </div>
                    )}
                    {selectedCustodyForPrint.settlement_notes && (
                      <div className="text-slate-300 text-[11px] mt-0.5">
                        البيان والملاحظات: {selectedCustodyForPrint.settlement_notes}
                      </div>
                    )}
                  </div>
                )}

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
