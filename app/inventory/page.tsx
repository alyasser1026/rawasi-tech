'use client';
import { currencySymbol } from '@/lib/currency';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  Barcode,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  TrendingDown,
  TrendingUp,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import MasterPage from '@/components/MasterPage';
import LoadingScreen from '@/components/LoadingScreen';
import { useCompany } from '@/lib/CompanyContext';
import { notify } from '@/lib/notify';
import {
  fetchInventoryDashboardSummary,
  fetchItemStockCard,
  createStocktakingSession,
  postStocktakingSession,
  fetchMaterialItems,
  fetchProjects,
  fetchJobOrders,
  CreateStocktakingLineInput,
} from './inventoryModel';
import styles from './inventory.module.css';

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0.00 ' + currencySymbol();
  return (
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val) + ' ' + currencySymbol()
  );
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { activeCompany } = useCompany();

  // Active tab: 'overview' | 'stock_card' | 'stocktakes'
  const [activeTab, setActiveTab] = useState<'overview' | 'stock_card' | 'stocktakes'>('overview');

  // Filters
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedJobOrder, setSelectedJobOrder] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showStocktakeModal, setShowStocktakeModal] = useState<boolean>(false);

  // New Stocktake Form State
  const [stkProject, setStkProject] = useState<string>('');
  const [stkJobOrder, setStkJobOrder] = useState<string>('');
  const [stkDate, setStkDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [stkNotes, setStkNotes] = useState<string>('');
  const [stkLines, setStkLines] = useState<CreateStocktakingLineInput[]>([
    { item_id: '', actual_quantity: 0, system_quantity: 0, unit_cost: 0, notes: '' },
  ]);

  // Queries
  const {
    data: dashboardData,
    isLoading: isLoadingDashboard,
    refetch: refetchDashboard,
  } = useQuery({
    queryKey: ['inventory_dashboard_summary', selectedProject, selectedJobOrder],
    queryFn: () =>
      fetchInventoryDashboardSummary(
        selectedProject || undefined,
        selectedJobOrder || undefined
      ),
  });

  const { data: materialItems = [] } = useQuery({
    queryKey: ['material_items_list'],
    queryFn: fetchMaterialItems,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects_list'],
    queryFn: fetchProjects,
  });

  const { data: jobOrders = [] } = useQuery({
    queryKey: ['job_orders_list', selectedProject || stkProject],
    queryFn: () => fetchJobOrders((selectedProject || stkProject) || undefined),
  });

  const {
    data: stockCardData,
    isLoading: isLoadingStockCard,
    refetch: refetchStockCard,
  } = useQuery({
    queryKey: ['item_stock_card', selectedItemId, selectedProject, selectedJobOrder],
    queryFn: () =>
      selectedItemId
        ? fetchItemStockCard(
            selectedItemId,
            selectedProject || undefined,
            selectedJobOrder || undefined
          )
        : null,
    enabled: !!selectedItemId && activeTab === 'stock_card',
  });

  const kpis = dashboardData?.kpis || {
    total_items_count: 0,
    total_inventory_valuation: 0,
    gl_126_balance: 0,
    valuation_gl_variance: 0,
    low_stock_count: 0,
    stagnant_count: 0,
  };

  // Handlers for Stocktake Modal
  const handleAddStkLine = () => {
    setStkLines((prev) => [
      ...prev,
      { item_id: '', actual_quantity: 0, system_quantity: 0, unit_cost: 0, notes: '' },
    ]);
  };

  const handleRemoveStkLine = (idx: number) => {
    if (stkLines.length <= 1) return;
    setStkLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleStkLineItemChange = (idx: number, itemId: string) => {
    const item = materialItems.find((m) => m.id === itemId);
    setStkLines((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        item_id: itemId,
        unit_cost: item?.moving_avg_cost || item?.default_unit_price || 0,
      };
      return copy;
    });
  };

  const handleSubmitStocktake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stkLines.some((l) => !l.item_id)) {
      notify('يرجى تحديد الأصناف في جميع بنود الجرد', 'warning');
      return;
    }

    try {
      await createStocktakingSession({
        project_id: stkProject || null,
        job_order_id: stkJobOrder || null,
        session_date: stkDate,
        notes: stkNotes,
        lines: stkLines,
      });

      notify('تم تسجيل جلسة الجرد بنجاح', 'success');
      setShowStocktakeModal(false);
      // Reset form
      setStkProject('');
      setStkJobOrder('');
      setStkNotes('');
      setStkLines([{ item_id: '', actual_quantity: 0, system_quantity: 0, unit_cost: 0, notes: '' }]);
      queryClient.invalidateQueries({ queryKey: ['inventory_dashboard_summary'] });
    } catch (err: any) {
      notify(err.message || 'فشل تسجيل جلسة الجرد', 'error');
    }
  };

  const handlePostStocktake = async (sessionId: string) => {
    if (!confirm('هل أنت متأكد من اعتماد وترحيل قيد تسوية فروق الجرد؟')) return;
    try {
      await postStocktakingSession(sessionId);
      notify('تم ترحيل قيد التسوية الجردية وتحديث تكلفة المخزون بنجاح', 'success');
      queryClient.invalidateQueries({ queryKey: ['inventory_dashboard_summary'] });
    } catch (err: any) {
      notify(err.message || 'فشل ترحيل قيد الجرد', 'error');
    }
  };

  return (
    <MasterPage title="إدارة وتقييم المخزون وجلسات الجرد (Stock Management & Valuation)">
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h1>إدارة وتقييم المخزون وجلسات الجرد الميداني</h1>
            <p>
              تقييم المخزون بالمتوسط المرجح، ومطابقته مع حساب 126، وكارت الصنف التفصيلي مع
              تتبع كامل لأوامر التشغيل (Job Orders)
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.btnSecondary}
              onClick={() => {
                refetchDashboard();
                if (selectedItemId) refetchStockCard();
              }}
              title="تحديث البيانات"
            >
              <RefreshCw size={16} /> تحديث
            </button>
            <button
              className={styles.btnPrimary}
              onClick={() => setShowStocktakeModal(true)}
            >
              <Plus size={18} /> جلسة جرد جديدة
            </button>
          </div>
        </div>

        {/* KPIs Strip */}
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>إجمالي تقييم المخزون</div>
            <div className={styles.kpiValue} style={{ color: '#059669' }}>
              {formatCurrency(kpis.total_inventory_valuation)}
            </div>
            <div className={styles.kpiSub}>تقييم الأصناف بالمتوسط المرجح</div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>رصيد المخزون بدفتر الأستاذ (126)</div>
            <div className={styles.kpiValue}>{formatCurrency(kpis.gl_126_balance)}</div>
            <div className={styles.kpiSub}>الرصيد الفعلي للقيود المحاسبية</div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>فرق التقييم الدفتري (الفجوة)</div>
            <div
              className={styles.kpiValue}
              style={{
                color: Math.abs(kpis.valuation_gl_variance) > 0.01 ? '#dc2626' : '#059669',
              }}
            >
              {formatCurrency(kpis.valuation_gl_variance)}
            </div>
            <div className={styles.kpiSub}>
              {Math.abs(kpis.valuation_gl_variance) <= 0.01
                ? '✓ متطابق 100% مع الأستاذ العام'
                : 'يوجد فارق يحتاج تسوية جردية'}
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>أصناف شارفت على النفاد</div>
            <div
              className={styles.kpiValue}
              style={{ color: kpis.low_stock_count > 0 ? '#d97706' : '#0f172a' }}
            >
              {kpis.low_stock_count}
            </div>
            <div className={styles.kpiSub}>أقل من حد الطلب الأدنى</div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>مواد راكدة بالمواقع</div>
            <div
              className={styles.kpiValue}
              style={{ color: kpis.stagnant_count > 0 ? '#b91c1c' : '#0f172a' }}
            >
              {kpis.stagnant_count}
            </div>
            <div className={styles.kpiSub}>بدون حركة منذ أكثر من 60 يوماً</div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabsContainer}>
          <button
            className={`${styles.tabBtn} ${
              activeTab === 'overview' ? styles.tabBtnActive : ''
            }`}
            onClick={() => setActiveTab('overview')}
          >
            نظرة عامة ورادار المخزون
          </button>
          <button
            className={`${styles.tabBtn} ${
              activeTab === 'stock_card' ? styles.tabBtnActive : ''
            }`}
            onClick={() => setActiveTab('stock_card')}
          >
            كارت الصنف وتتبع أوامر التشغيل
          </button>
          <button
            className={`${styles.tabBtn} ${
              activeTab === 'stocktakes' ? styles.tabBtnActive : ''
            }`}
            onClick={() => setActiveTab('stocktakes')}
          >
            جلسات الجرد الفعلي
          </button>
        </div>

        {/* Global Filters */}
        <div className={styles.filterStrip}>
          <select
            value={selectedProject}
            onChange={(e) => {
              setSelectedProject(e.target.value);
              setSelectedJobOrder('');
            }}
            className={styles.selectControl}
          >
            <option value="">كافة المشاريع والمستودعات</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.Property}
              </option>
            ))}
          </select>

          <select
            value={selectedJobOrder}
            onChange={(e) => setSelectedJobOrder(e.target.value)}
            className={styles.selectControl}
          >
            <option value="">كافة أوامر التشغيل (Job Orders)</option>
            {jobOrders.map((jo) => (
              <option key={jo.id} value={jo.id}>
                {jo.order_number} ({jo.status})
              </option>
            ))}
          </select>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW & RADAR                                                   */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div>
            {/* Low Stock Alerts */}
            {dashboardData?.low_stock_items && dashboardData.low_stock_items.length > 0 && (
              <div className={styles.sectionCard} style={{ borderRight: '4px solid #f59e0b' }}>
                <div className={styles.sectionHeader}>
                  <h3>⚠️ رادار حد الطلب (أصناف شارفت على النفاد)</h3>
                </div>
                <div className={styles.tableResponsive}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>كود الصنف</th>
                        <th>اسم الصنف</th>
                        <th>الوحدة</th>
                        <th>الرصيد الفعلي الحالي</th>
                        <th>الحد الأدنى للطلب</th>
                        <th>الكمية المقترحة لأمر الشراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.low_stock_items.map((item) => (
                        <tr key={item.item_id}>
                          <td style={{ fontWeight: 600 }}>{item.item_code || '---'}</td>
                          <td style={{ fontWeight: 700 }}>{item.item_name}</td>
                          <td>{item.unit}</td>
                          <td style={{ color: '#dc2626', fontWeight: 700 }}>
                            {item.current_stock}
                          </td>
                          <td>{item.min_order_level}</td>
                          <td style={{ color: '#2563eb', fontWeight: 700 }}>
                            {item.suggested_po_qty} {item.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Stagnant Stock */}
            {dashboardData?.stagnant_items && dashboardData.stagnant_items.length > 0 && (
              <div className={styles.sectionCard} style={{ borderRight: '4px solid #ef4444' }}>
                <div className={styles.sectionHeader}>
                  <h3>🛑 المواد الراكدة (توصيات بإعادة التخصيص والمناقلة لأوامر التشغيل النشطة)</h3>
                </div>
                <div className={styles.tableResponsive}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>كود الصنف</th>
                        <th>اسم الصنف</th>
                        <th>الكمية الراكدة</th>
                        <th>متوسط التكلفة</th>
                        <th>القيمة المجمدة</th>
                        <th>آخر حركة</th>
                        <th>أيام الركود</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.stagnant_items.map((item) => (
                        <tr key={item.item_id}>
                          <td>{item.item_code || '---'}</td>
                          <td style={{ fontWeight: 700 }}>{item.item_name}</td>
                          <td>{item.current_stock}</td>
                          <td>{formatCurrency(item.moving_avg_cost)}</td>
                          <td style={{ color: '#dc2626', fontWeight: 700 }}>
                            {formatCurrency(item.stagnant_value)}
                          </td>
                          <td>{item.last_movement_date || 'غير محدد'}</td>
                          <td>
                            <span className={styles.badgeDanger}>{item.days_dormant} يوم</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent Stocktakes */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h3>أحدث جلسات الجرد الميداني</h3>
              </div>
              <div className={styles.tableResponsive}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>رقم الجلسة</th>
                      <th>تاريخ الجرد</th>
                      <th>المشروع</th>
                      <th>أمر التشغيل</th>
                      <th>فروق الجرد الإجمالية</th>
                      <th>الحالة</th>
                      <th>الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData?.recent_stocktakes && dashboardData.recent_stocktakes.length > 0 ? (
                      dashboardData.recent_stocktakes.map((stk) => (
                        <tr key={stk.id}>
                          <td style={{ fontWeight: 600 }}>{stk.session_number}</td>
                          <td>{stk.session_date}</td>
                          <td>{stk.project_name || 'عام'}</td>
                          <td>{stk.job_order_number || 'عام'}</td>
                          <td
                            style={{
                              fontWeight: 700,
                              color: stk.total_difference_amount < 0 ? '#dc2626' : '#059669',
                            }}
                          >
                            {formatCurrency(stk.total_difference_amount)}
                          </td>
                          <td>
                            {stk.is_posted ? (
                              <span className={styles.badgeSuccess}>مرحل ومعتمد</span>
                            ) : (
                              <span className={styles.badgeWarning}>بانتظار الترحيل</span>
                            )}
                          </td>
                          <td>
                            {!stk.is_posted && (
                              <button
                                className={styles.btnPrimary}
                                style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                                onClick={() => handlePostStocktake(stk.id)}
                              >
                                ترحيل القيد المحاسبي
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                          لم يتم تسجيل أي جلسات جرد مؤخراً
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ITEM STOCK CARD                                                    */}
        {/* ========================================================================= */}
        {activeTab === 'stock_card' && (
          <div>
            <div className={styles.sectionCard}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: '260px' }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>
                    اختر الصنف لعرض كارت الحركة:
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className={styles.selectControl}
                    style={{ width: '100%' }}
                  >
                    <option value="">-- اختر الصنف من الدليل الموحد --</option>
                    {materialItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.item_name} ({item.item_code || 'بدون كود'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {selectedItemId && stockCardData && (
              <div className={styles.sectionCard}>
                {/* Item Details Summary Strip */}
                <div
                  style={{
                    background: 'var(--bg-subtle, #f8fafc)',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                  }}
                >
                  <div>
                    <small style={{ color: 'var(--text-secondary)' }}>اسم وكود الصنف:</small>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                      {stockCardData.item.name} ({stockCardData.item.code || '---'})
                    </div>
                  </div>
                  <div>
                    <small style={{ color: 'var(--text-secondary)' }}>الرصيد الحالي:</small>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#059669' }}>
                      {stockCardData.item.current_stock} {stockCardData.item.unit}
                    </div>
                  </div>
                  <div>
                    <small style={{ color: 'var(--text-secondary)' }}>متوسط التكلفة المرجح:</small>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                      {formatCurrency(stockCardData.item.moving_avg_cost)}
                    </div>
                  </div>
                  <div>
                    <small style={{ color: 'var(--text-secondary)' }}>إجمالي القيمة المخزنية:</small>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#2563eb' }}>
                      {formatCurrency(stockCardData.item.total_value)}
                    </div>
                  </div>
                </div>

                {/* Movements Table */}
                <div className={styles.sectionHeader}>
                  <h3>سجل الحركات التاريخية (وارد، منصرف، تسويات، وأوامر التشغيل)</h3>
                </div>
                <div className={styles.tableResponsive}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>التاريخ</th>
                        <th>نوع الحركة</th>
                        <th>رقم المستند</th>
                        <th>المشروع</th>
                        <th>أمر التشغيل (Job Order)</th>
                        <th>الجهة / المقاول / المورد</th>
                        <th>وارد (+)</th>
                        <th>منصرف (-)</th>
                        <th>التكلفة</th>
                        <th>الرصيد التراكمي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockCardData.movements.length > 0 ? (
                        stockCardData.movements.map((m, idx) => (
                          <tr key={idx}>
                            <td>{m.move_date}</td>
                            <td>{m.doc_type}</td>
                            <td style={{ fontWeight: 600 }}>{m.doc_number}</td>
                            <td>{m.project_name || 'عام'}</td>
                            <td>
                              {m.job_order_number ? (
                                <span className={styles.badgeInfo}>
                                  {m.job_order_number}
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>---</span>
                              )}
                            </td>
                            <td>{m.entity_name || '---'}</td>
                            <td style={{ color: m.qty_in > 0 ? '#059669' : 'inherit', fontWeight: m.qty_in > 0 ? 700 : 400 }}>
                              {m.qty_in > 0 ? `+${m.qty_in}` : '-'}
                            </td>
                            <td style={{ color: m.qty_out > 0 ? '#dc2626' : 'inherit', fontWeight: m.qty_out > 0 ? 700 : 400 }}>
                              {m.qty_out > 0 ? `-${m.qty_out}` : '-'}
                            </td>
                            <td>{formatCurrency(m.unit_cost)}</td>
                            <td style={{ fontWeight: 700 }}>{m.running_qty}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                            لا توجد حركات مسجلة لهذا الصنف بالمعايير المحددة
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: STOCKTAKES                                                         */}
        {/* ========================================================================= */}
        {activeTab === 'stocktakes' && (
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h3>سجل جلسات الجرد الفعلي للمخازن والمشاريع</h3>
              <button
                className={styles.btnPrimary}
                onClick={() => setShowStocktakeModal(true)}
              >
                <Plus size={16} /> جلسة جرد جديدة
              </button>
            </div>

            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>رقم الجلسة</th>
                    <th>تاريخ الجرد</th>
                    <th>المشروع</th>
                    <th>أمر التشغيل</th>
                    <th>إجمالي الفروق المحاسبية</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData?.recent_stocktakes && dashboardData.recent_stocktakes.length > 0 ? (
                    dashboardData.recent_stocktakes.map((stk) => (
                      <tr key={stk.id}>
                        <td style={{ fontWeight: 700 }}>{stk.session_number}</td>
                        <td>{stk.session_date}</td>
                        <td>{stk.project_name || 'عام'}</td>
                        <td>
                          {stk.job_order_number ? (
                            <span className={styles.badgeInfo}>{stk.job_order_number}</span>
                          ) : (
                            'عام'
                          )}
                        </td>
                        <td
                          style={{
                            fontWeight: 700,
                            color: stk.total_difference_amount < 0 ? '#dc2626' : '#059669',
                          }}
                        >
                          {formatCurrency(stk.total_difference_amount)}
                        </td>
                        <td>
                          {stk.is_posted ? (
                            <span className={styles.badgeSuccess}>مرحل بالكامل</span>
                          ) : (
                            <span className={styles.badgeWarning}>بانتظار الترحيل</span>
                          )}
                        </td>
                        <td>
                          {!stk.is_posted && (
                            <button
                              className={styles.btnPrimary}
                              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                              onClick={() => handlePostStocktake(stk.id)}
                            >
                              ترحيل قيد التسوية (126 قصاد 527)
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        لا توجد جلسات جرد مسجلة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: NEW STOCKTAKE SESSION                                              */}
        {/* ========================================================================= */}
        {showStocktakeModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2>تسجيل جلسة جرد ميداني جديدة</h2>
                <button
                  className={styles.closeBtn}
                  onClick={() => setShowStocktakeModal(false)}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitStocktake}>
                <div className={styles.modalBody}>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>المشروع المرتبط</label>
                      <select
                        value={stkProject}
                        onChange={(e) => {
                          setStkProject(e.target.value);
                          setStkJobOrder('');
                        }}
                        className={styles.formSelect}
                      >
                        <option value="">عام / مستودع رئيسي</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.Property}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label>أمر التشغيل (Job Order)</label>
                      <select
                        value={stkJobOrder}
                        onChange={(e) => setStkJobOrder(e.target.value)}
                        className={styles.formSelect}
                      >
                        <option value="">عام لكامل المشروع</option>
                        {jobOrders.map((jo) => (
                          <option key={jo.id} value={jo.id}>
                            {jo.order_number} ({jo.status})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label>تاريخ الجرد *</label>
                      <input
                        type="date"
                        value={stkDate}
                        onChange={(e) => setStkDate(e.target.value)}
                        required
                        className={styles.formInput}
                      />
                    </div>
                  </div>

                  {/* Stocktake Lines */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h3 style={{ fontSize: '1rem', margin: 0 }}>بنود الجرد الفعلي</h3>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={handleAddStkLine}
                        style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      >
                        <Plus size={14} /> إضافة صنف
                      </button>
                    </div>

                    <table className={styles.table} style={{ fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '40%' }}>الصنف</th>
                          <th style={{ width: '25%' }}>الكمية الفعلية المعدودة</th>
                          <th style={{ width: '25%' }}>ملاحظات البند</th>
                          <th style={{ width: '10%' }}>حذف</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stkLines.map((line, idx) => (
                          <tr key={idx}>
                            <td>
                              <select
                                value={line.item_id}
                                onChange={(e) => handleStkLineItemChange(idx, e.target.value)}
                                required
                                className={styles.formSelect}
                                style={{ width: '100%' }}
                              >
                                <option value="">اختر الصنف...</option>
                                {materialItems.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.item_name} ({m.default_unit})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={line.actual_quantity}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setStkLines((prev) => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], actual_quantity: val };
                                    return copy;
                                  });
                                }}
                                required
                                className={styles.formInput}
                                style={{ width: '100%' }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                placeholder="ملاحظات العجز/الزيادة..."
                                value={line.notes || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStkLines((prev) => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], notes: val };
                                    return copy;
                                  });
                                }}
                                className={styles.formInput}
                                style={{ width: '100%' }}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveStkLine(idx)}
                                disabled={stkLines.length <= 1}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.formGroup}>
                    <label>ملاحظات محضر الجرد</label>
                    <textarea
                      value={stkNotes}
                      onChange={(e) => setStkNotes(e.target.value)}
                      placeholder="أسماء أعضاء لجنة الجرد، حالة المخزن..."
                      className={styles.formInput}
                      style={{ minHeight: '60px' }}
                    />
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => setShowStocktakeModal(false)}
                  >
                    إلغاء
                  </button>
                  <button type="submit" className={styles.btnPrimary}>
                    حفظ جلسة الجرد
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
