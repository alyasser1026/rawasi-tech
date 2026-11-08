'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Fuel,
  History,
  Layers,
  Percent,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import MasterPage from '@/components/MasterPage';
import LoadingScreen from '@/components/LoadingScreen';
import { useCompany } from '@/lib/CompanyContext';
import { notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import {
  ASSET_STATUS,
  ASSET_TYPES,
  AssetOperationalCostsResponse,
  DepreciationPreviewResponse,
  FixedAsset,
  createFixedAsset,
  disposeFixedAsset,
  fetchAssetOperationalCosts,
  fetchAssetsSummary,
  fetchDepreciationPreview,
  formatAssetCurrency,
  postMonthlyDepreciation,
  transferAssetProject,
} from './assetsModel';
import styles from './assets.module.css';

export default function FixedAssetsPage() {
  const queryClient = useQueryClient();
  const { activeCompany } = useCompany();

  // Filters
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDepModalOpen, setIsDepModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isDisposeModalOpen, setIsDisposeModalOpen] = useState(false);
  const [isCostsModalOpen, setIsCostsModalOpen] = useState(false);

  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);

  // New Asset Form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('equipment');
  const [newCost, setNewCost] = useState<number | ''>('');
  const [newUsefulLife, setNewUsefulLife] = useState<number | ''>(24);
  const [newSalvage, setNewSalvage] = useState<number | ''>(0);
  const [newPurchaseDate, setNewPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newProjectId, setNewProjectId] = useState('');
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [newOpeningAcc, setNewOpeningAcc] = useState<number | ''>(0);
  const [newNotes, setNewNotes] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Depreciation Run Form
  const currentDate = new Date();
  const [depYear, setDepYear] = useState<number>(currentDate.getFullYear());
  const [depMonth, setDepMonth] = useState<number>(currentDate.getMonth() + 1);
  const [depNotes, setDepNotes] = useState('');
  const [isSubmittingDep, setIsSubmittingDep] = useState(false);

  // Transfer Form
  const [transferProjectId, setTransferProjectId] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transferPartnerId, setTransferPartnerId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Dispose Form
  const [disposalType, setDisposalType] = useState<'sale' | 'scrap' | 'write_off'>('sale');
  const [disposalDate, setDisposalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saleAmount, setSaleAmount] = useState<number | ''>('');
  const [safeAccountId, setSafeAccountId] = useState('');
  const [disposalNotes, setDisposalNotes] = useState('');
  const [isSubmittingDispose, setIsSubmittingDispose] = useState(false);

  // Queries
  const { data: summaryData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['fixed_assets_summary', activeCompany?.id, assetTypeFilter, selectedProjectId, statusFilter],
    queryFn: () =>
      fetchAssetsSummary(
        assetTypeFilter,
        selectedProjectId === 'all' ? null : selectedProjectId,
        statusFilter
      ),
    enabled: !!activeCompany?.id,
    retry: false,
    staleTime: 60000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects_for_assets', activeCompany?.id],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, Property').order('Property');
      return data || [];
    },
    enabled: !!activeCompany?.id,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['partners_for_assets', activeCompany?.id],
    queryFn: async () => {
      const { data } = await supabase.from('partners').select('id, name, code').order('name');
      return data || [];
    },
    enabled: !!activeCompany?.id,
  });

  const { data: safeAccounts = [] } = useQuery({
    queryKey: ['safes_for_asset_disposal', activeCompany?.id],
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

  const { data: depPreview, isLoading: isLoadingDepPreview, refetch: refetchDepPreview } = useQuery({
    queryKey: ['depreciation_preview', activeCompany?.id, depYear, depMonth],
    queryFn: () => fetchDepreciationPreview(depYear, depMonth),
    enabled: !!activeCompany?.id && isDepModalOpen,
  });

  const { data: assetCosts, isLoading: isLoadingCosts } = useQuery({
    queryKey: ['asset_operational_costs', activeCompany?.id, selectedAsset?.id],
    queryFn: () => fetchAssetOperationalCosts(selectedAsset!.id),
    enabled: !!activeCompany?.id && isCostsModalOpen && !!selectedAsset,
  });

  // Handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newCost || !newUsefulLife) {
      notify('يرجى استيفاء الحقول الأساسية للأصل', 'error');
      return;
    }

    try {
      setIsSubmittingNew(true);
      await createFixedAsset({
        name: newName,
        assetType: newType,
        purchaseCost: Number(newCost),
        usefulLifeMonths: Number(newUsefulLife),
        salvageValue: Number(newSalvage || 0),
        purchaseDate: newPurchaseDate,
        currentProjectId: newProjectId || null,
        serialNumber: newSerialNumber,
        openingAccumulated: Number(newOpeningAcc || 0),
        notes: newNotes,
      });

      notify('تمت إضافة الأصل بنجاح واحتساب قسط الإهلاك الشهري', 'success');
      setIsNewModalOpen(false);
      // Reset
      setNewName('');
      setNewCost('');
      setNewSalvage(0);
      setNewOpeningAcc(0);
      setNewSerialNumber('');
      setNewNotes('');
      queryClient.invalidateQueries({ queryKey: ['fixed_assets_summary'] });
    } catch (err: any) {
      notify(err.message || 'فشلت إضافة الأصل', 'error');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handlePostDepreciation = async () => {
    try {
      setIsSubmittingDep(true);
      const res = await postMonthlyDepreciation(depYear, depMonth, depNotes);
      notify(
        `تم ترحيل قيد إهلاك شهر ${depMonth}/${depYear} بنجاح بقيمة ${formatAssetCurrency(
          res.total_depreciation
        )} لعدد ${res.assets_count} أصل`,
        'success'
      );
      setIsDepModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['fixed_assets_summary'] });
    } catch (err: any) {
      notify(err.message || 'فشل ترحيل الإهلاك الشهري', 'error');
    } finally {
      setIsSubmittingDep(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    try {
      setIsSubmittingTransfer(true);
      await transferAssetProject({
        assetId: selectedAsset.id,
        toProjectId: transferProjectId || null,
        transferDate,
        responsiblePartnerId: transferPartnerId || null,
        notes: transferNotes,
      });

      notify(`تم نقل الأصل (${selectedAsset.name}) إلى المشروع المحدد بنجاح`, 'success');
      setIsTransferModalOpen(false);
      setSelectedAsset(null);
      queryClient.invalidateQueries({ queryKey: ['fixed_assets_summary'] });
    } catch (err: any) {
      notify(err.message || 'فشل نقل الأصل', 'error');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleDisposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    if (disposalType === 'sale' && Number(saleAmount) > 0 && !safeAccountId) {
      notify('يرجى تحديد حساب الخزينة أو البنك المحصل عليه مبلغ البيع', 'error');
      return;
    }

    try {
      setIsSubmittingDispose(true);
      const res = await disposeFixedAsset({
        assetId: selectedAsset.id,
        disposalDate,
        disposalType,
        saleAmount: Number(saleAmount || 0),
        safeAccountId: safeAccountId || null,
        notes: disposalNotes,
      });

      const gainLoss = res.gain_loss;
      notify(
        `تم استبعاد الأصل وترحيل قيد اليومية بنجاح (${
          gainLoss >= 0 ? `أرباح رأسمالية: ${formatAssetCurrency(gainLoss)}` : `خسائر استبعاد: ${formatAssetCurrency(Math.abs(gainLoss))}`
        })`,
        'success'
      );
      setIsDisposeModalOpen(false);
      setSelectedAsset(null);
      queryClient.invalidateQueries({ queryKey: ['fixed_assets_summary'] });
    } catch (err: any) {
      notify(err.message || 'فشل استبعاد الأصل', 'error');
    } finally {
      setIsSubmittingDispose(false);
    }
  };

  const openTransferModal = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setTransferProjectId(asset.current_project_id || '');
    setTransferDate(new Date().toISOString().slice(0, 10));
    setTransferPartnerId('');
    setTransferNotes('');
    setIsTransferModalOpen(true);
  };

  const openDisposeModal = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setDisposalType('sale');
    setDisposalDate(new Date().toISOString().slice(0, 10));
    setSaleAmount(asset.book_value);
    setSafeAccountId(safeAccounts[0]?.id || '');
    setDisposalNotes('');
    setIsDisposeModalOpen(true);
  };

  const openCostsModal = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setIsCostsModalOpen(true);
  };

  // KPIs
  const kpis = summaryData?.kpis || {
    total_assets: 0,
    active_assets: 0,
    depreciated_assets: 0,
    disposed_assets: 0,
    total_purchase_cost: 0,
    total_accumulated_depreciation: 0,
    total_book_value: 0,
    monthly_depreciation_run_cost: 0,
  };

  // Filter list
  const filteredAssets = (summaryData?.assets || []).filter((a) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = a.asset_number.toLowerCase().includes(q);
      const matchName = a.name.toLowerCase().includes(q);
      const matchProject = (a.project_name || '').toLowerCase().includes(q);
      const matchSerial = (a.serial_number || '').toLowerCase().includes(q);
      if (!matchNum && !matchName && !matchProject && !matchSerial) return false;
    }
    return true;
  });

  return (
    <MasterPage title="الأصول الثابتة والمعدات وتوزيع تكاليفها">
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.headerSection}>
          <div className={styles.titleArea}>
            <h1 className={styles.pageTitle}>
              <Truck size={24} className="text-emerald-400" />
              سجل الأصول الثابتة والمعدات
              <span className={styles.accountPill}>ح/ 11 • 114 • 528</span>
            </h1>
            <p className={styles.pageSubtitle}>
              إدارة الآلات والسيارات، احتساب الإهلاك الشهري بالقسط الثابت، وتوزيع تكلفة التشغيل على المشاريع
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
            <button onClick={() => setIsDepModalOpen(true)} className={styles.btnWarning}>
              <Clock size={16} />
              ترحيل إهلاك الشهر
            </button>
            <button onClick={() => setIsNewModalOpen(true)} className={styles.btnPrimary}>
              <Plus size={16} />
              إضافة أصل جديد
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className={styles.kpiGrid}>
          <div className={`${styles.kpiCard} ${styles.kpiCardPrimary}`}>
            <span className={styles.kpiLabel}>التكلفة التاريخية للأصول</span>
            <span className={styles.kpiValue}>{formatAssetCurrency(kpis.total_purchase_cost)}</span>
            <span className={styles.kpiSub}>{kpis.total_assets} أصل مسجل</span>
          </div>

          <div className={`${styles.kpiCard} ${styles.kpiCardWarning}`}>
            <span className={styles.kpiLabel}>مجمع الإهلاك المتراكم (ح/ 114)</span>
            <span className={styles.kpiValue}>
              {formatAssetCurrency(kpis.total_accumulated_depreciation)}
            </span>
            <span className={styles.kpiSub}>إجمالي ما تم استهلاكه دفترياً</span>
          </div>

          <div className={`${styles.kpiCard} ${styles.kpiCardSuccess}`}>
            <span className={styles.kpiLabel}>صافي القيمة الدفترية (Book Value)</span>
            <span className={styles.kpiValue}>{formatAssetCurrency(kpis.total_book_value)}</span>
            <span className={styles.kpiSub}>التكلفة ناقص مجمع الإهلاك</span>
          </div>

          <div className={`${styles.kpiCard} ${styles.kpiCardInfo}`}>
            <span className={styles.kpiLabel}>قسط الإهلاك الشهري التقديري</span>
            <span className={styles.kpiValue}>
              {formatAssetCurrency(kpis.monthly_depreciation_run_cost)}
            </span>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem', fontSize: '0.75rem' }}>
              <span className="text-emerald-400 font-bold">{kpis.active_assets} نشط</span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-400">{kpis.depreciated_assets} مستهلك</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">{kpis.disposed_assets} مباع/مستبعد</span>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className={styles.controlsBar}>
          <div className={styles.filterGroup}>
            <div className={styles.statusFilterTabs}>
              {[
                { id: 'all', label: 'الكل' },
                { id: 'active', label: 'نشط ويعمل' },
                { id: 'depreciated', label: 'مستهلك دفترياً' },
                { id: 'sold', label: 'تم البيع' },
                { id: 'disposed', label: 'مستبعد' },
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
              value={assetTypeFilter}
              onChange={(e) => setAssetTypeFilter(e.target.value)}
              className={styles.formSelect}
              style={{ width: 'auto', minWidth: '150px' }}
            >
              <option value="all">كل أنواع الأصول</option>
              {Object.entries(ASSET_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label} ({v.code})
                </option>
              ))}
            </select>

            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className={styles.formSelect}
              style={{ width: 'auto', minWidth: '170px' }}
            >
              <option value="all">كل المشاريع والمواقع</option>
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
              placeholder="بحث برقم الأصل، الاسم، المشروع، أو اللوحة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Assets Table */}
        <div className={styles.tableCard}>
          {isLoading ? (
            <LoadingScreen />
          ) : filteredAssets.length === 0 ? (
            <div className={styles.emptyState}>
              <Truck size={40} className="text-slate-600" />
              <p className="font-bold">لا توجد أصول مطابقة لمعايير البحث</p>
              <p className="text-xs text-slate-500">
                يمكنك الضغط على «إضافة أصل جديد» لتسجيل معدة أو سيارة برصيدها الدفتري
              </p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>رقم الأصل</th>
                    <th>الاسم والنوع</th>
                    <th>المشروع والموقع الحالي</th>
                    <th>تاريخ الشراء</th>
                    <th>العمر</th>
                    <th>التكلفة</th>
                    <th>مجمع الإهلاك</th>
                    <th>صافي القيمة الدفترية</th>
                    <th>قسط الإهلاك</th>
                    <th>تكاليف التشغيل</th>
                    <th>الحالة</th>
                    <th style={{ textAlign: 'center' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((asset) => {
                    const typeConfig = ASSET_TYPES[asset.asset_type] || ASSET_TYPES.equipment;
                    const statusConfig = ASSET_STATUS[asset.status] || ASSET_STATUS.active;
                    const isOperable = asset.status === 'active' || asset.status === 'depreciated';

                    return (
                      <tr key={asset.id} className={styles.tableRow}>
                        <td>
                          <span className={styles.assetCode}>{asset.asset_number}</span>
                        </td>
                        <td>
                          <div>
                            <span className="font-bold text-white block">{asset.name}</span>
                            <span className={styles.typeBadge}>
                              {typeConfig.label} ({typeConfig.code})
                            </span>
                            {asset.serial_number && (
                              <span className="text-xs text-slate-400 mr-2 font-mono">
                                [{asset.serial_number}]
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="font-medium text-slate-200">
                            {asset.project_name || 'المركز الرئيسي (دون مشروع)'}
                          </span>
                        </td>
                        <td className="font-mono text-xs text-slate-300">{asset.purchase_date}</td>
                        <td className="text-xs text-slate-300">{asset.useful_life_months} شهر</td>
                        <td className={`${styles.moneyCell} text-slate-100 font-bold`}>
                          {formatAssetCurrency(asset.purchase_cost)}
                        </td>
                        <td className={`${styles.moneyCell} text-amber-400`}>
                          {formatAssetCurrency(asset.accumulated_depreciation)}
                        </td>
                        <td className={`${styles.moneyCell} text-emerald-400 font-bold`}>
                          {formatAssetCurrency(asset.book_value)}
                        </td>
                        <td className={`${styles.moneyCell} text-sky-400 text-xs`}>
                          {formatAssetCurrency(asset.monthly_depreciation)}/ش
                        </td>
                        <td className={`${styles.moneyCell} text-amber-300 font-semibold`}>
                          {formatAssetCurrency(asset.operational_expenses || 0)}
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
                            {isOperable && (
                              <>
                                <button
                                  onClick={() => openTransferModal(asset)}
                                  className={styles.actionBtnTransfer}
                                  title="نقل الأصل لمشروع آخر"
                                >
                                  نقل
                                </button>
                                <button
                                  onClick={() => openDisposeModal(asset)}
                                  className={styles.actionBtnDispose}
                                  title="استبعاد أو بيع الأصل"
                                >
                                  استبعاد
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => openCostsModal(asset)}
                              className={styles.actionBtnCosts}
                              title="تكاليف تشغيل الأصل وسجل الحركات"
                            >
                              التكاليف
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: New Fixed Asset */}
        {isNewModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>إضافة أصل ثابت / معدة جديدة</h3>
                <button onClick={() => setIsNewModalOpen(false)} className={styles.modalClose}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit}>
                <div className={styles.modalBody}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.875rem' }}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>اسم ومواصفات الأصل *</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="مثال: حفار كوماتسو PC200، سيارة دينا تويوتا"
                        className={styles.formInput}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>نوع الأصل وتصنيفه المحاسبي *</label>
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                        className={styles.formSelect}
                        required
                      >
                        {Object.entries(ASSET_TYPES).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label} (حساب {v.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem' }}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>تكلفة الشراء (ر.س) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        value={newCost}
                        onChange={(e) =>
                          setNewCost(e.target.value === '' ? '' : parseFloat(e.target.value))
                        }
                        placeholder="0.00"
                        className={styles.formInput}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>العمر بالشهور *</label>
                      <input
                        type="number"
                        min="1"
                        value={newUsefulLife}
                        onChange={(e) =>
                          setNewUsefulLife(e.target.value === '' ? '' : parseInt(e.target.value))
                        }
                        placeholder="24"
                        className={styles.formInput}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>قيمة الخردة المقدرة</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newSalvage}
                        onChange={(e) =>
                          setNewSalvage(e.target.value === '' ? '' : parseFloat(e.target.value))
                        }
                        placeholder="0.00"
                        className={styles.formInput}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>تاريخ الشراء / بدء الاستخدام</label>
                      <input
                        type="date"
                        value={newPurchaseDate}
                        onChange={(e) => setNewPurchaseDate(e.target.value)}
                        className={styles.formInput}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>مجمع الإهلاك الافتتاحي السابق (إن وجد)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newOpeningAcc}
                        onChange={(e) =>
                          setNewOpeningAcc(e.target.value === '' ? '' : parseFloat(e.target.value))
                        }
                        placeholder="0.00"
                        className={styles.formInput}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>المشروع أو الموقع الأولي</label>
                      <select
                        value={newProjectId}
                        onChange={(e) => setNewProjectId(e.target.value)}
                        className={styles.formSelect}
                      >
                        <option value="">-- المركز الرئيسي (دون مشروع) --</option>
                        {projects.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.Property}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>الرقم التسلسلي / رقم الهيكل / اللوحة</label>
                      <input
                        type="text"
                        value={newSerialNumber}
                        onChange={(e) => setNewSerialNumber(e.target.value)}
                        placeholder="مثال: أ ب ج 1234"
                        className={styles.formInput}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>ملاحظات</label>
                    <textarea
                      rows={2}
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="بيانات الضمان، المورد، أي معلومات أخرى..."
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
                    {isSubmittingNew ? 'جاري الحفظ...' : 'تأكيد وحفظ الأصل'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Monthly Depreciation Run */}
        {isDepModalOpen && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '680px' }}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  احتساب وترحيل إهلاك الأصول الشهري بالقسط الثابت
                </h3>
                <button onClick={() => setIsDepModalOpen(false)} className={styles.modalClose}>
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>السنة المالية</label>
                    <input
                      type="number"
                      value={depYear}
                      onChange={(e) => setDepYear(parseInt(e.target.value) || 2026)}
                      className={styles.formInput}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>شهر الإهلاك</label>
                    <select
                      value={depMonth}
                      onChange={(e) => setDepMonth(parseInt(e.target.value))}
                      className={styles.formSelect}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          شهر {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {isLoadingDepPreview ? (
                  <div className="p-4 text-center text-slate-400">جاري احتساب معاينة الإهلاك...</div>
                ) : depPreview?.is_already_posted ? (
                  <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-lg text-amber-300 text-sm flex items-center gap-3">
                    <AlertTriangle size={24} className="shrink-0 text-amber-400" />
                    <div>
                      <strong>تنبيه:</strong> تم ترحيل إهلاك شهر {depMonth}/{depYear} مسبقاً في
                      الأستاذ العام. يمنع النظام ترحيل نفس الفترة مرتين لتجنب تكرار المصروفات.
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '0.75rem',
                      }}
                    >
                      <div>
                        <span className="text-xs text-slate-400 block">إجمالي إهلاك الشهر المطلوب ترحيله</span>
                        <span className="text-xl font-bold text-emerald-400">
                          {formatAssetCurrency(depPreview?.total_depreciation ?? 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block">عدد الأصول المستحقة للإهلاك</span>
                        <span className="text-xl font-bold text-white">
                          {depPreview?.assets_count ?? 0} أصل نشط
                        </span>
                      </div>
                    </div>

                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <table className="w-full text-xs text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-slate-400">
                            <th className="p-1.5">الأصل</th>
                            <th className="p-1.5">المشروع</th>
                            <th className="p-1.5">التكلفة</th>
                            <th className="p-1.5">مجمع سابق</th>
                            <th className="p-1.5">قسط الشهر</th>
                            <th className="p-1.5">متبقي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {depPreview?.assets.map((item) => (
                            <tr key={item.asset_id} className="border-b border-slate-800">
                              <td className="p-1.5 font-bold text-white">{item.asset_name}</td>
                              <td className="p-1.5 text-slate-300">{item.project_name || 'عام'}</td>
                              <td className="p-1.5 font-mono">{formatAssetCurrency(item.purchase_cost)}</td>
                              <td className="p-1.5 font-mono text-amber-400">
                                {formatAssetCurrency(item.prior_accumulated)}
                              </td>
                              <td className="p-1.5 font-mono font-bold text-emerald-400">
                                {formatAssetCurrency(item.depreciation_amount)}
                              </td>
                              <td className="p-1.5 font-mono text-slate-300">
                                {formatAssetCurrency(item.new_book_value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="p-3 bg-slate-800/60 rounded text-xs text-slate-300 border border-slate-700">
                      <strong>القيد المحاسبي المولد آلياً:</strong>
                      <br />
                      • مدين: ح/ 528 (مصروف إهلاك الأصول الثابتة) موزعاً على مراكز تكلفة المشاريع.
                      <br />• دائن: ح/ 114 (مجمع إهلاك الأصول الثابتة).
                    </div>
                  </>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>ملاحظات القيد</label>
                  <input
                    type="text"
                    value={depNotes}
                    onChange={(e) => setDepNotes(e.target.value)}
                    placeholder={`قيد إهلاك أصول شهر ${depMonth}/${depYear}`}
                    className={styles.formInput}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsDepModalOpen(false)}
                  className={styles.btnSecondary}
                  disabled={isSubmittingDep}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handlePostDepreciation}
                  className={styles.btnPrimary}
                  disabled={
                    isSubmittingDep ||
                    depPreview?.is_already_posted ||
                    (depPreview?.assets_count ?? 0) === 0
                  }
                >
                  {isSubmittingDep ? 'جاري ترحيل القيد...' : 'اعتماد وترحيل إهلاك الشهر'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Transfer Asset */}
        {isTransferModalOpen && selectedAsset && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>نقل أصل بين المشاريع ({selectedAsset.name})</h3>
                <button onClick={() => setIsTransferModalOpen(false)} className={styles.modalClose}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleTransferSubmit}>
                <div className={styles.modalBody}>
                  <div className="p-3 bg-slate-800 rounded text-xs text-slate-300 mb-2">
                    الموقع الحالي: <strong>{selectedAsset.project_name || 'المركز الرئيسي'}</strong>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>المشروع المستهدف الجديد *</label>
                    <select
                      value={transferProjectId}
                      onChange={(e) => setTransferProjectId(e.target.value)}
                      className={styles.formSelect}
                    >
                      <option value="">-- المركز الرئيسي (دون مشروع) --</option>
                      {projects.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.Property}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>تاريخ النقل *</label>
                      <input
                        type="date"
                        value={transferDate}
                        onChange={(e) => setTransferDate(e.target.value)}
                        className={styles.formInput}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>المسؤول / السائق المستلم</label>
                      <select
                        value={transferPartnerId}
                        onChange={(e) => setTransferPartnerId(e.target.value)}
                        className={styles.formSelect}
                      >
                        <option value="">-- اختر السائق / المشرف --</option>
                        {partners.map((prt: any) => (
                          <option key={prt.id} value={prt.id}>
                            {prt.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>ملاحظات النقل وأمر الحركة</label>
                    <textarea
                      rows={2}
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                      placeholder="سبب النقل، أمر العمل الميداني..."
                      className={styles.formTextarea}
                    />
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className={styles.btnSecondary}
                    disabled={isSubmittingTransfer}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={isSubmittingTransfer}
                  >
                    {isSubmittingTransfer ? 'جاري التسجيل...' : 'تأكيد نقل الأصل'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Dispose / Sell Asset */}
        {isDisposeModalOpen && selectedAsset && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>استبعاد أو بيع أصل ({selectedAsset.name})</h3>
                <button onClick={() => setIsDisposeModalOpen(false)} className={styles.modalClose}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleDisposeSubmit}>
                <div className={styles.modalBody}>
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '0.875rem',
                      borderRadius: '0.5rem',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '0.5rem',
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <span className="text-xs text-slate-400 block">التكلفة التاريخية</span>
                      <strong className="text-white">
                        {formatAssetCurrency(selectedAsset.purchase_cost)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">مجمع الإهلاك</span>
                      <strong className="text-amber-400">
                        {formatAssetCurrency(selectedAsset.accumulated_depreciation)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">صافي القيمة الدفترية</span>
                      <strong className="text-emerald-400">
                        {formatAssetCurrency(selectedAsset.book_value)}
                      </strong>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>نوع الاستبعاد *</label>
                    <select
                      value={disposalType}
                      onChange={(e) => setDisposalType(e.target.value as any)}
                      className={styles.formSelect}
                    >
                      <option value="sale">بيع نقدي / بمقابل</option>
                      <option value="scrap">تخريد (استبعاد نهائي كخردة)</option>
                      <option value="write_off">إهلاك كلي / إعدام دفتري لتلف الأصل</option>
                    </select>
                  </div>

                  {disposalType === 'sale' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>مبلغ البيع (ر.س) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={saleAmount}
                          onChange={(e) =>
                            setSaleAmount(e.target.value === '' ? '' : parseFloat(e.target.value))
                          }
                          className={styles.formInput}
                          required
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>الخزينة أو البنك المحصل إليه *</label>
                        <select
                          value={safeAccountId}
                          onChange={(e) => setSafeAccountId(e.target.value)}
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
                    </div>
                  )}

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>تاريخ الاستبعاد / البيع</label>
                    <input
                      type="date"
                      value={disposalDate}
                      onChange={(e) => setDisposalDate(e.target.value)}
                      className={styles.formInput}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>ملاحظات ومحضر الاستبعاد</label>
                    <textarea
                      rows={2}
                      value={disposalNotes}
                      onChange={(e) => setDisposalNotes(e.target.value)}
                      placeholder="سبب الاستبعاد، المشتري، رقم الفاتورة..."
                      className={styles.formTextarea}
                    />
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    onClick={() => setIsDisposeModalOpen(false)}
                    className={styles.btnSecondary}
                    disabled={isSubmittingDispose}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={isSubmittingDispose}
                  >
                    {isSubmittingDispose ? 'جاري الاستبعاد...' : 'تأكيد استبعاد الأصل'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Asset Operational Costs & Lifetime History */}
        {isCostsModalOpen && selectedAsset && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '750px' }}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  تكاليف تشغيل الأصل وسجل الحركات ({selectedAsset.name})
                </h3>
                <button onClick={() => setIsCostsModalOpen(false)} className={styles.modalClose}>
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                {isLoadingCosts ? (
                  <div className="p-8 text-center text-slate-400">جاري تحميل سجل التكاليف...</div>
                ) : (
                  <>
                    <div
                      style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.75rem',
                        textAlign: 'center',
                      }}
                    >
                      <div>
                        <span className="text-xs text-slate-400 block">مصروفات التشغيل المسجلة (وقود وصيانة)</span>
                        <span className="text-lg font-bold text-amber-400">
                          {formatAssetCurrency(assetCosts?.total_operational_expenses ?? 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block">إجمالي الإهلاك المرحل</span>
                        <span className="text-lg font-bold text-sky-400">
                          {formatAssetCurrency(assetCosts?.total_posted_depreciation ?? 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block">إجمالي تكلفة الملكية والتشغيل</span>
                        <span className="text-lg font-bold text-emerald-400">
                          {formatAssetCurrency(assetCosts?.total_ownership_cost ?? 0)}
                        </span>
                      </div>
                    </div>

                    {/* Operational Expenses List */}
                    <div>
                      <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                        <Fuel size={14} className="text-amber-400" />
                        فواتير ومصروفات التشغيل المربوطة بالأصل (من جدول المصروفات):
                      </h4>
                      {(assetCosts?.expenses || []).length === 0 ? (
                        <p className="text-xs text-slate-500 py-1">
                          لم تسجل فواتير وقود أو صيانة لهذا الأصل حتى الآن.
                        </p>
                      ) : (
                        <table className="w-full text-xs text-right border-collapse mb-4">
                          <thead>
                            <tr className="bg-slate-800 text-slate-400">
                              <th className="p-1.5">التاريخ</th>
                              <th className="p-1.5">البيان</th>
                              <th className="p-1.5">المشروع</th>
                              <th className="p-1.5">طريقة الدفع</th>
                              <th className="p-1.5">المبلغ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assetCosts?.expenses.map((exp) => (
                              <tr key={exp.id} className="border-b border-slate-800">
                                <td className="p-1.5 font-mono text-slate-300">{exp.date}</td>
                                <td className="p-1.5 text-white">{exp.description}</td>
                                <td className="p-1.5 text-slate-300">{exp.project_name || 'عام'}</td>
                                <td className="p-1.5 text-slate-400">{exp.payment_method || 'كاش'}</td>
                                <td className="p-1.5 font-mono font-bold text-amber-400">
                                  {formatAssetCurrency(exp.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Project Transfers History */}
                    <div>
                      <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                        <ArrowRightLeft size={14} className="text-sky-400" />
                        سجل تنقلات الأصل بين المشاريع:
                      </h4>
                      {(assetCosts?.transfers || []).length === 0 ? (
                        <p className="text-xs text-slate-500 py-1">
                          لم تسجل أي حركات نقل لهذا الأصل.
                        </p>
                      ) : (
                        <table className="w-full text-xs text-right border-collapse">
                          <thead>
                            <tr className="bg-slate-800 text-slate-400">
                              <th className="p-1.5">رقم الحركة</th>
                              <th className="p-1.5">التاريخ</th>
                              <th className="p-1.5">من مشروع</th>
                              <th className="p-1.5">إلى مشروع</th>
                              <th className="p-1.5">المسؤول / السائق</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assetCosts?.transfers.map((trf) => (
                              <tr key={trf.id} className="border-b border-slate-800">
                                <td className="p-1.5 font-mono text-sky-400">{trf.transfer_number}</td>
                                <td className="p-1.5 font-mono text-slate-300">{trf.date}</td>
                                <td className="p-1.5 text-slate-300">{trf.from_project || 'المركز الرئيسي'}</td>
                                <td className="p-1.5 font-bold text-white">
                                  {trf.to_project || 'المركز الرئيسي'}
                                </td>
                                <td className="p-1.5 text-slate-300">{trf.responsible_partner || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsCostsModalOpen(false)}
                  className={styles.btnSecondary}
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MasterPage>
  );
}
