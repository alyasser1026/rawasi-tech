'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import MasterPage from '@/components/MasterPage';
import LoadingScreen from '@/components/LoadingScreen';
import TelegramAttachmentField, { AttachmentViewButton } from '@/components/TelegramAttachmentField';
import { useCompany } from '@/lib/CompanyContext';
import { notify } from '@/lib/notify';
import {
  PurchaseOrder,
  ThreeWayMatchingResponse,
  fetchPurchaseOrdersSummary,
  fetchPurchaseOrderMatching,
  createPurchaseOrder,
  approvePurchaseOrder,
  receiveMaterialsFromPo,
  createSupplierInvoice,
  postSupplierInvoice,
  fetchSuppliers,
  fetchProjects,
  fetchMaterialItems,
  CreatePoLineInput,
  ReceivePoLineInput,
  CreateSupplierInvoiceLineInput,
} from './purchaseOrdersModel';
import styles from './purchase-orders.module.css';

const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  approved: 'معتمد',
  partially_received: 'مستلم جزئياً',
  received: 'مكتمل الاستلام',
  closed: 'مقفل (مطابق)',
  cancelled: 'ملغي',
};

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0.00 ر.س';
  return (
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val) + ' ر.س'
  );
}

export default function PurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const { activeCompany } = useCompany();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showReceiveModal, setShowReceiveModal] = useState<boolean>(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);
  const [showMatchingModal, setShowMatchingModal] = useState<boolean>(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);

  // Queries
  const {
    data: summaryData,
    isLoading: isLoadingSummary,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['purchase_orders_summary', statusFilter, projectFilter, supplierFilter],
    queryFn: () =>
      fetchPurchaseOrdersSummary(
        statusFilter,
        projectFilter || undefined,
        supplierFilter || undefined
      ),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers_list'],
    queryFn: fetchSuppliers,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects_list'],
    queryFn: fetchProjects,
  });

  const { data: materialItems = [] } = useQuery({
    queryKey: ['material_items_list'],
    queryFn: fetchMaterialItems,
  });

  const {
    data: matchingData,
    isLoading: isLoadingMatching,
    refetch: refetchMatching,
  } = useQuery({
    queryKey: ['purchase_order_matching', selectedPo?.id],
    queryFn: () => (selectedPo ? fetchPurchaseOrderMatching(selectedPo.id) : null),
    enabled: !!selectedPo && showMatchingModal,
  });

  // Create PO Form State
  const [createPoSupplier, setCreatePoSupplier] = useState<string>('');
  const [createPoProject, setCreatePoProject] = useState<string>('');
  const [createPoDate, setCreatePoDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [createPoDeliveryDate, setCreatePoDeliveryDate] = useState<string>('');
  const [createPoNotes, setCreatePoNotes] = useState<string>('');
  const [createPoTerms, setCreatePoTerms] = useState<string>('');
  const [createPoAttachment, setCreatePoAttachment] = useState<string | null>(null);
  const [createPoLines, setCreatePoLines] = useState<CreatePoLineInput[]>([
    {
      item_name: '',
      quantity: 1,
      unit: 'وحدة',
      unit_price: 0,
      tax_rate: 15,
      description: '',
    },
  ]);

  // Receive Form State
  const [receiveDate, setReceiveDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [receiveNotes, setReceiveNotes] = useState<string>('');
  const [receiveLines, setReceiveLines] = useState<
    Array<{ po_line_id: string; item_name: string; remaining_qty: number; qty_to_receive: number }>
  >([]);

  // Invoice Form State
  const [invRef, setInvRef] = useState<string>('');
  const [invDate, setInvDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [invDueDate, setInvDueDate] = useState<string>('');
  const [invNotes, setInvNotes] = useState<string>('');
  const [invLines, setInvLines] = useState<
    Array<{
      po_line_id: string;
      item_name: string;
      remaining_qty: number;
      qty_to_invoice: number;
      unit_price: number;
    }>
  >([]);
  const [invAttachment, setInvAttachment] = useState<string | null>(null);
  const [isPostingInvoice, setIsPostingInvoice] = useState<boolean>(true);

  // Filter orders by search query
  const orders = summaryData?.orders || [];
  const filteredOrders = orders.filter((po) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      po.po_number?.toLowerCase().includes(q) ||
      po.supplier_name?.toLowerCase().includes(q) ||
      po.project_name?.toLowerCase().includes(q)
    );
  });

  const kpis = summaryData?.kpis || {
    total_pos: 0,
    draft_pos: 0,
    approved_pos: 0,
    partially_received_pos: 0,
    received_pos: 0,
    closed_pos: 0,
    total_orders_value: 0,
  };

  // Handlers for PO creation
  const handleAddPoLine = () => {
    setCreatePoLines((prev) => [
      ...prev,
      {
        item_name: '',
        quantity: 1,
        unit: 'وحدة',
        unit_price: 0,
        tax_rate: 15,
        description: '',
      },
    ]);
  };

  const handleRemovePoLine = (idx: number) => {
    if (createPoLines.length <= 1) return;
    setCreatePoLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePoLineChange = (
    idx: number,
    field: keyof CreatePoLineInput,
    val: any
  ) => {
    setCreatePoLines((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleSelectItemForLine = (idx: number, itemId: string) => {
    const item = materialItems.find((m) => m.id === itemId);
    if (!item) return;
    setCreatePoLines((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        item_id: item.id,
        item_name: item.name,
        unit: item.unit || 'وحدة',
        unit_price: item.default_price || copy[idx].unit_price,
      };
      return copy;
    });
  };

  const handleSubmitCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createPoSupplier) {
      notify('يرجى تحديد المورد', 'warning');
      return;
    }
    if (createPoLines.some((l) => !l.item_name || l.quantity <= 0)) {
      notify('يرجى ملء جميع بنود أمر الشراء بشكل صحيح', 'warning');
      return;
    }

    try {
      const newPoId = await createPurchaseOrder({
        supplier_id: createPoSupplier,
        project_id: createPoProject || null,
        order_date: createPoDate,
        expected_delivery_date: createPoDeliveryDate || null,
        notes: createPoNotes,
        terms: createPoTerms,
        attachment_url: createPoAttachment,
        lines: createPoLines,
      });

      notify('تم إنشاء أمر الشراء بنجاح', 'success');
      setShowCreateModal(false);
      // Reset form
      setCreatePoSupplier('');
      setCreatePoProject('');
      setCreatePoNotes('');
      setCreatePoTerms('');
      setCreatePoAttachment(null);
      setCreatePoLines([
        {
          item_name: '',
          quantity: 1,
          unit: 'وحدة',
          unit_price: 0,
          tax_rate: 15,
        },
      ]);
      queryClient.invalidateQueries({ queryKey: ['purchase_orders_summary'] });
    } catch (err: any) {
      notify(err.message || 'فشل إنشاء أمر الشراء', 'error');
    }
  };

  // Handler for Approve PO
  const handleApprovePo = async (po: PurchaseOrder) => {
    if (!confirm(`هل أنت متأكد من اعتماد أمر الشراء رقم ${po.po_number}؟`)) return;
    try {
      await approvePurchaseOrder(po.id);
      notify(`تم اعتماد أمر الشراء ${po.po_number} بنجاح`, 'success');
      queryClient.invalidateQueries({ queryKey: ['purchase_orders_summary'] });
    } catch (err: any) {
      notify(err.message || 'فشل اعتماد أمر الشراء', 'error');
    }
  };

  // Open Receive Modal
  const handleOpenReceiveModal = async (po: PurchaseOrder) => {
    setSelectedPo(po);
    try {
      const match = await fetchPurchaseOrderMatching(po.id);
      const lines = match.lines
        .filter((l) => l.remaining_to_receive > 0)
        .map((l) => ({
          po_line_id: l.po_line_id,
          item_name: l.item_name,
          remaining_qty: l.remaining_to_receive,
          qty_to_receive: l.remaining_to_receive,
        }));
      setReceiveLines(lines);
      setShowReceiveModal(true);
    } catch (err: any) {
      notify(err.message || 'تعذر تحميل بيانات البنود للاستلام', 'error');
    }
  };

  // Submit Receive
  const handleSubmitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPo) return;
    const linesToPost = receiveLines
      .filter((l) => l.qty_to_receive > 0)
      .map((l) => ({
        po_line_id: l.po_line_id,
        quantity: l.qty_to_receive,
      }));

    if (linesToPost.length === 0) {
      notify('يرجى تحديد كميات للاستلام أكبر من الصفر', 'warning');
      return;
    }

    try {
      await receiveMaterialsFromPo(
        selectedPo.id,
        receiveDate,
        linesToPost,
        receiveNotes
      );
      notify('تم تسجيل سند استلام المواد وإثبات حركة المخزون بنجاح', 'success');
      setShowReceiveModal(false);
      queryClient.invalidateQueries({ queryKey: ['purchase_orders_summary'] });
    } catch (err: any) {
      notify(err.message || 'فشل تسجيل سند استلام المواد', 'error');
    }
  };

  // Open Invoice Modal
  const handleOpenInvoiceModal = async (po: PurchaseOrder) => {
    setSelectedPo(po);
    try {
      const match = await fetchPurchaseOrderMatching(po.id);
      const lines = match.lines
        .filter((l) => l.remaining_to_invoice > 0)
        .map((l) => ({
          po_line_id: l.po_line_id,
          item_name: l.item_name,
          remaining_qty: l.remaining_to_invoice,
          qty_to_invoice: l.remaining_to_invoice,
          unit_price: l.po_unit_price,
        }));
      setInvLines(lines);
      setInvRef('');
      setInvAttachment(null);
      setShowInvoiceModal(true);
    } catch (err: any) {
      notify(err.message || 'تعذر تحميل بيانات الفوترة', 'error');
    }
  };

  // Submit Invoice
  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPo) return;
    if (!invRef.trim()) {
      notify('يرجى إدخال رقم الفاتورة المرجعية للمورد', 'warning');
      return;
    }

    const linesToPost: CreateSupplierInvoiceLineInput[] = invLines
      .filter((l) => l.qty_to_invoice > 0)
      .map((l) => ({
        po_line_id: l.po_line_id,
        item_name: l.item_name,
        quantity: l.qty_to_invoice,
        unit_price: l.unit_price,
        tax_rate: 15,
      }));

    if (linesToPost.length === 0) {
      notify('يرجى تحديد كميات للفوترة أكبر من الصفر', 'warning');
      return;
    }

    try {
      const invoiceId = await createSupplierInvoice({
        supplier_id: selectedPo.supplier_id,
        supplier_invoice_ref: invRef.trim(),
        po_id: selectedPo.id,
        invoice_date: invDate,
        due_date: invDueDate || null,
        notes: invNotes,
        attachment_url: invAttachment,
        lines: linesToPost,
      });

      if (isPostingInvoice) {
        await postSupplierInvoice(invoiceId);
        notify(
          'تم تسجيل وترحيل فاتورة المورد وإثبات استحقاق الضريبة وإقفال وسيط الاستلام بنجاح',
          'success'
        );
      } else {
        notify('تم تسجيل مسودة فاتورة المورد بنجاح', 'success');
      }

      setShowInvoiceModal(false);
      setInvAttachment(null);
      queryClient.invalidateQueries({ queryKey: ['purchase_orders_summary'] });
    } catch (err: any) {
      notify(err.message || 'فشل حفظ فاتورة المورد', 'error');
    }
  };

  // Open 3-Way Matching View
  const handleOpenMatching = (po: PurchaseOrder) => {
    setSelectedPo(po);
    setShowMatchingModal(true);
  };

  // Helper calculation for create PO totals
  const poSubtotal = createPoLines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0),
    0
  );
  const poTax = poSubtotal * 0.15;
  const poTotal = poSubtotal + poTax;

  const renderBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className={`${styles.badge} ${styles.badgeDraft}`}>مسودة</span>;
      case 'approved':
        return <span className={`${styles.badge} ${styles.badgeApproved}`}>معتمد</span>;
      case 'partially_received':
        return (
          <span className={`${styles.badge} ${styles.badgePartiallyReceived}`}>
            مستلم جزئياً
          </span>
        );
      case 'received':
        return <span className={`${styles.badge} ${styles.badgeReceived}`}>مكتمل الاستلام</span>;
      case 'closed':
        return <span className={`${styles.badge} ${styles.badgeClosed}`}>مقفل (مطابق)</span>;
      case 'cancelled':
        return <span className={`${styles.badge} ${styles.badgeCancelled}`}>ملغي</span>;
      default:
        return <span className={styles.badge}>{status}</span>;
    }
  };

  return (
    <MasterPage title="أوامر الشراء ومطابقة التوريد (3-Way Matching)">
      <div className={`clean-page enterprise-page ${styles.container}`}>
        {/* Top Header */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h1>أوامر الشراء ومطابقة التوريد (3-Way Matching)</h1>
            <p>
              إدارة دورة المشتريات ومطابقة أوامر الشراء وسندات استلام المواد وفواتير
              الموردين دون ازدواجية محاسبية
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.btnSecondary}
              onClick={() => refetchSummary()}
              title="تحديث البيانات"
            >
              <RefreshCw size={16} /> تحديث
            </button>
            <button
              className={styles.btnPrimary}
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={18} /> أمر شراء جديد
            </button>
          </div>
        </div>

        {/* KPIs Strip */}
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>إجمالي أوامر الشراء</div>
            <div className={styles.kpiValue}>{kpis.total_pos}</div>
            <div className={styles.kpiSub}>كافة الأوامر المسجلة بالشركة</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>أوامر مسودة</div>
            <div className={styles.kpiValue}>{kpis.draft_pos}</div>
            <div className={styles.kpiSub}>بانتظار الاعتماد الإداري</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>أوامر معتمدة</div>
            <div className={styles.kpiValue}>{kpis.approved_pos}</div>
            <div className={styles.kpiSub}>جاهزة للاستلام الميداني</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>مستلمة جزئياً</div>
            <div className={styles.kpiValue}>{kpis.partially_received_pos}</div>
            <div className={styles.kpiSub}>تم توريد دفعات منها</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>مكتملة الاستلام</div>
            <div className={styles.kpiValue}>{kpis.received_pos}</div>
            <div className={styles.kpiSub}>بانتظار مطابقة الفواتير</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>مقفلة ومطابقة</div>
            <div className={styles.kpiValue}>{kpis.closed_pos}</div>
            <div className={styles.kpiSub}>مطابقة 100% 3-Way</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>إجمالي قيمة التعاقدات</div>
            <div className={styles.kpiValue}>{formatCurrency(kpis.total_orders_value)}</div>
            <div className={styles.kpiSub}>شاملة ضريبة القيمة المضافة</div>
          </div>
        </div>

        {/* Filter Strip */}
        <div className={styles.filterStrip}>
          <div className={styles.statusTabs}>
            {[
              { id: 'all', label: 'الكل' },
              { id: 'draft', label: 'مسودة' },
              { id: 'approved', label: 'معتمد' },
              { id: 'partially_received', label: 'مستلم جزئياً' },
              { id: 'received', label: 'مكتمل الاستلام' },
              { id: 'closed', label: 'مقفل' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`${styles.tabBtn} ${
                  statusFilter === tab.id ? styles.tabBtnActive : ''
                }`}
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.filterControls}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                placeholder="بحث برقم الأمر، اسم المورد، أو المشروع..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.inputControl}
                style={{ width: '100%' }}
              />
            </div>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className={styles.selectControl}
            >
              <option value="">كافة المشاريع</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.Property}
                </option>
              ))}
            </select>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className={styles.selectControl}
            >
              <option value="">كافة الموردين</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Purchase Orders Table */}
        <div className={styles.tableContainer}>
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>رقم أمر الشراء</th>
                  <th>تاريخ الأمر</th>
                  <th>المورد</th>
                  <th>المشروع</th>
                  <th>عدد البنود</th>
                  <th>المرفق</th>
                  <th>المبلغ قبل الضريبة</th>
                  <th>الضريبة 15%</th>
                  <th>الإجمالي</th>
                  <th>الحالة</th>
                  <th style={{ textAlign: 'center' }}>الإجراءات ومطابقة التوريد</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingSummary ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '30px' }}>
                      <LoadingScreen />
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      style={{
                        textAlign: 'center',
                        padding: '40px',
                        color: 'var(--text-muted, #94a3b8)',
                      }}
                    >
                      لا توجد أوامر شراء مطابقة لمعايير البحث الحالية
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((po) => (
                    <tr key={po.id}>
                      <td style={{ fontWeight: 600 }}>{po.po_number}</td>
                      <td>{po.order_date}</td>
                      <td>{po.supplier_name}</td>
                      <td>{po.project_name || 'عام'}</td>
                      <td>{po.lines_count}</td>
                      <td>
                        <AttachmentViewButton
                          url={po.attachment_url}
                          label="المرفق"
                          title={`أمر شراء ${po.po_number}`}
                        />
                      </td>
                      <td>{formatCurrency(po.subtotal)}</td>
                      <td>{formatCurrency(po.tax_amount)}</td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(po.total_amount)}</td>
                      <td>{renderBadge(po.status)}</td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                            onClick={() => handleOpenMatching(po)}
                            title="عرض ومطابقة 3-Way Matching"
                          >
                            <Eye size={13} /> مطابقة 3-Way
                          </button>

                          {po.status === 'draft' && (
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
                              onClick={() => handleApprovePo(po)}
                              title="اعتماد أمر الشراء"
                            >
                              <FileCheck size={13} /> اعتماد
                            </button>
                          )}

                          {(po.status === 'approved' ||
                            po.status === 'partially_received') && (
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnWarning}`}
                              onClick={() => handleOpenReceiveModal(po)}
                              title="استلام مواد بالموقع"
                            >
                              <Truck size={13} /> استلام مواد
                            </button>
                          )}

                          {(po.status === 'partially_received' ||
                            po.status === 'received' ||
                            po.status === 'approved') && (
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleOpenInvoiceModal(po)}
                              title="تسجيل فاتورة مورد ضريبية"
                            >
                              <Receipt size={13} /> فاتورة مورد
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 1. MODAL: CREATE NEW PURCHASE ORDER                                       */}
        {/* ========================================================================= */}
        {showCreateModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2>إنشاء أمر شراء جديد للمشروع</h2>
                <button
                  className={styles.closeBtn}
                  onClick={() => setShowCreateModal(false)}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitCreatePo}>
                <div className={styles.modalBody}>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>المورد *</label>
                      <select
                        value={createPoSupplier}
                        onChange={(e) => setCreatePoSupplier(e.target.value)}
                        required
                        className={styles.formSelect}
                      >
                        <option value="">اختر المورد...</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label>المشروع المرتبط</label>
                      <select
                        value={createPoProject}
                        onChange={(e) => setCreatePoProject(e.target.value)}
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
                      <label>تاريخ الأمر *</label>
                      <input
                        type="date"
                        value={createPoDate}
                        onChange={(e) => setCreatePoDate(e.target.value)}
                        required
                        className={styles.formInput}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label>تاريخ التوريد المتوقع</label>
                      <input
                        type="date"
                        value={createPoDeliveryDate}
                        onChange={(e) => setCreatePoDeliveryDate(e.target.value)}
                        className={styles.formInput}
                      />
                    </div>
                  </div>

                  {/* Lines Section */}
                  <div className={styles.linesSection}>
                    <div className={styles.linesHeader}>
                      <h3>بنود ومواد التوريد</h3>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={handleAddPoLine}
                        style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      >
                        <Plus size={14} /> إضافة صنف
                      </button>
                    </div>

                    <table className={styles.lineTable}>
                      <thead>
                        <tr>
                          <th style={{ width: '30%' }}>الصنف / المادة</th>
                          <th style={{ width: '15%' }}>الكمية</th>
                          <th style={{ width: '12%' }}>الوحدة</th>
                          <th style={{ width: '18%' }}>سعر الوحدة</th>
                          <th style={{ width: '15%' }}>الإجمالي</th>
                          <th style={{ width: '10%' }}>حذف</th>
                        </tr>
                      </thead>
                      <tbody>
                        {createPoLines.map((line, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                type="text"
                                placeholder="اسم الصنف (مثلاً: أسمنت، حديد...)"
                                value={line.item_name}
                                onChange={(e) =>
                                  handlePoLineChange(idx, 'item_name', e.target.value)
                                }
                                required
                                className={styles.formInput}
                                style={{ width: '100%', marginBottom: '4px' }}
                              />
                              {materialItems.length > 0 && (
                                <select
                                  onChange={(e) =>
                                    handleSelectItemForLine(idx, e.target.value)
                                  }
                                  className={styles.formSelect}
                                  style={{ fontSize: '0.75rem', padding: '2px 4px' }}
                                >
                                  <option value="">اختيار سريع من الدليل...</option>
                                  {materialItems.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({m.default_price || 0} ر.س)
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td>
                              <input
                                type="number"
                                step="any"
                                min="0.001"
                                value={line.quantity}
                                onChange={(e) =>
                                  handlePoLineChange(
                                    idx,
                                    'quantity',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                required
                                className={styles.formInput}
                                style={{ width: '100%' }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={line.unit}
                                onChange={(e) =>
                                  handlePoLineChange(idx, 'unit', e.target.value)
                                }
                                required
                                className={styles.formInput}
                                style={{ width: '100%' }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={line.unit_price}
                                onChange={(e) =>
                                  handlePoLineChange(
                                    idx,
                                    'unit_price',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                required
                                className={styles.formInput}
                                style={{ width: '100%' }}
                              />
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {formatCurrency(
                                (Number(line.quantity) || 0) *
                                  (Number(line.unit_price) || 0)
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemovePoLine(idx)}
                                disabled={createPoLines.length <= 1}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* PO Totals summary */}
                  <div
                    style={{
                      background: 'var(--bg-subtle, #f8fafc)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      المبلغ الأساسي: <strong>{formatCurrency(poSubtotal)}</strong> |
                      الضريبة (15%): <strong>{formatCurrency(poTax)}</strong>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                      إجمالي أمر الشراء: {formatCurrency(poTotal)}
                    </div>
                  </div>

                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>ملاحظات أمر الشراء</label>
                      <textarea
                        value={createPoNotes}
                        onChange={(e) => setCreatePoNotes(e.target.value)}
                        placeholder="أي ملاحظات إضافية أو مكان الاستلام بالموقع..."
                        className={styles.formTextarea}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>شروط التوريد والدفع</label>
                      <textarea
                        value={createPoTerms}
                        onChange={(e) => setCreatePoTerms(e.target.value)}
                        placeholder="مثال: الدفع بعد 30 يوم من الفاتورة الضريبية والمطابقة الفنية..."
                        className={styles.formTextarea}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <TelegramAttachmentField
                      module="purchase_orders"
                      value={createPoAttachment}
                      onChange={setCreatePoAttachment}
                      label="صورة أمر الشراء المعتمد / عرض السعر المرفق"
                      caption={`أمر شراء لمشروع: ${projects.find((p) => p.id === createPoProject)?.Property || 'عام'}`}
                      allowStamp={true}
                      stampContext={{
                        buildingName: projects.find((p) => p.id === createPoProject)?.Property || '',
                        boqItem: 'أمر شراء مواد',
                        capturedBy: '',
                      }}
                    />
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => setShowCreateModal(false)}
                  >
                    إلغاء
                  </button>
                  <button type="submit" className={styles.btnPrimary}>
                    حفظ أمر الشراء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. MODAL: RECEIVE MATERIALS FROM PO                                       */}
        {/* ========================================================================= */}
        {showReceiveModal && selectedPo && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2>استلام مواد ومخزون من أمر الشراء {selectedPo.po_number}</h2>
                <button
                  className={styles.closeBtn}
                  onClick={() => setShowReceiveModal(false)}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitReceive}>
                <div className={styles.modalBody}>
                  <div
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      color: '#1e40af',
                    }}
                  >
                    💡 <strong>قاعدة المحاسبة المقاولاتية الدقيقة:</strong> تسجيل سند
                    الاستلام هو المستند <em>الوحيد</em> الذي يُثبت إضافة المخزون إلى
                    الموقع (مدين 126 مخزون / 511 تكلفة مباشرة) مقابل إثبات استحقاق وسيط
                    (دائن 218 وسيط بضاعة مستلمة غير مفوترة GRNI). لن تتكرر حركة المخزون
                    أو التكلفة لاحقاً عند ورود الفاتورة.
                  </div>

                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>تاريخ الاستلام الفعلي *</label>
                      <input
                        type="date"
                        value={receiveDate}
                        onChange={(e) => setReceiveDate(e.target.value)}
                        required
                        className={styles.formInput}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>ملاحظات سند الاستلام</label>
                      <input
                        type="text"
                        value={receiveNotes}
                        onChange={(e) => setReceiveNotes(e.target.value)}
                        placeholder="رقم بوليصة الشحن، اسم المستلم الميداني..."
                        className={styles.formInput}
                      />
                    </div>
                  </div>

                  <div className={styles.linesSection}>
                    <h3>كميات المواد المستلمة اليوم</h3>
                    <table className={styles.lineTable}>
                      <thead>
                        <tr>
                          <th>الصنف</th>
                          <th>الكمية المتبقية للتوريد</th>
                          <th>الكمية المستلمة الآن</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receiveLines.map((line, idx) => (
                          <tr key={line.po_line_id}>
                            <td style={{ fontWeight: 600 }}>{line.item_name}</td>
                            <td>{line.remaining_qty}</td>
                            <td>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max={line.remaining_qty}
                                value={line.qty_to_receive}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setReceiveLines((prev) => {
                                    const copy = [...prev];
                                    copy[idx] = { ...copy[idx], qty_to_receive: val };
                                    return copy;
                                  });
                                }}
                                className={styles.formInput}
                                style={{ width: '120px' }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => setShowReceiveModal(false)}
                  >
                    إلغاء
                  </button>
                  <button type="submit" className={styles.btnPrimary}>
                    تأكيد استلام المواد وإثبات القيد
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. MODAL: CREATE SUPPLIER INVOICE                                         */}
        {/* ========================================================================= */}
        {showInvoiceModal && selectedPo && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2>تسجيل فاتورة مورد ضريبية لأمر الشراء {selectedPo.po_number}</h2>
                <button
                  className={styles.closeBtn}
                  onClick={() => setShowInvoiceModal(false)}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitInvoice}>
                <div className={styles.modalBody}>
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      color: '#166534',
                    }}
                  >
                    🛡️ <strong>إثبات الاستحقاق والضريبة دون ازدواج:</strong> تسجيل فاتورة
                    المورد يُثبت الذمة القانونية للمورد (دائن 211) ويُثبت ضريبة المدخلات
                    15% (مدين 215)، مع إقفال حساب وسيط البضاعة المستلمة (مدين 218 GRNI)،
                    مما يضمن عدم احتساب تكلفة المواد مرتين أبداً.
                  </div>

                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>رقم فاتورة المورد المرجعية *</label>
                      <input
                        type="text"
                        placeholder="مثال: INV-99021 المسجل على الفاتورة الورقية"
                        value={invRef}
                        onChange={(e) => setInvRef(e.target.value)}
                        required
                        className={styles.formInput}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label>تاريخ الفاتورة الضريبية *</label>
                      <input
                        type="date"
                        value={invDate}
                        onChange={(e) => setInvDate(e.target.value)}
                        required
                        className={styles.formInput}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label>تاريخ الاستحقاق</label>
                      <input
                        type="date"
                        value={invDueDate}
                        onChange={(e) => setInvDueDate(e.target.value)}
                        className={styles.formInput}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label>خيارات الترحيل</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px' }}>
                        <input
                          type="checkbox"
                          checked={isPostingInvoice}
                          onChange={(e) => setIsPostingInvoice(e.target.checked)}
                        />
                        <span>ترحيل القيد المالي فوراً (إثبات الذمة والضريبة)</span>
                      </label>
                    </div>
                  </div>

                  <div className={styles.linesSection}>
                    <h3>بنود الفاتورة الضريبية</h3>
                    <table className={styles.lineTable}>
                      <thead>
                        <tr>
                          <th>الصنف</th>
                          <th>الكمية المتبقية للفوترة</th>
                          <th>الكمية المفوترة</th>
                          <th>سعر الوحدة</th>
                          <th>الإجمالي قبل الضريبة</th>
                          <th>الضريبة 15%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invLines.map((line, idx) => {
                          const base = (Number(line.qty_to_invoice) || 0) * (Number(line.unit_price) || 0);
                          const tax = base * 0.15;
                          return (
                            <tr key={line.po_line_id}>
                              <td style={{ fontWeight: 600 }}>{line.item_name}</td>
                              <td>{line.remaining_qty}</td>
                              <td>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  max={line.remaining_qty}
                                  value={line.qty_to_invoice}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setInvLines((prev) => {
                                      const copy = [...prev];
                                      copy[idx] = { ...copy[idx], qty_to_invoice: val };
                                      return copy;
                                    });
                                  }}
                                  className={styles.formInput}
                                  style={{ width: '100px' }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={line.unit_price}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setInvLines((prev) => {
                                      const copy = [...prev];
                                      copy[idx] = { ...copy[idx], unit_price: val };
                                      return copy;
                                    });
                                  }}
                                  className={styles.formInput}
                                  style={{ width: '100px' }}
                                />
                              </td>
                              <td style={{ fontWeight: 600 }}>{formatCurrency(base)}</td>
                              <td>{formatCurrency(tax)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.formGroup}>
                    <label>ملاحظات الفاتورة</label>
                    <textarea
                      value={invNotes}
                      onChange={(e) => setInvNotes(e.target.value)}
                      placeholder="أي شروط أو ملاحظات مدونة على فاتورة المورد..."
                      className={styles.formTextarea}
                    />
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <TelegramAttachmentField
                      module="supplier_invoices"
                      value={invAttachment}
                      onChange={setInvAttachment}
                      label="صورة فاتورة المورد الضريبية (QR / ZATCA)"
                      caption={`فاتورة مورد: ${selectedPo?.supplier_name || ''} - مرجع: ${invRef}`}
                      allowStamp={true}
                      stampContext={{
                        buildingName: selectedPo?.project_name || '',
                        boqItem: 'فاتورة توريد مواد',
                        capturedBy: selectedPo?.supplier_name || '',
                      }}
                    />
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => setShowInvoiceModal(false)}
                  >
                    إلغاء
                  </button>
                  <button type="submit" className={styles.btnPrimary}>
                    حفظ وإثبات الفاتورة
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. DRAWER / MODAL: 3-WAY MATCHING DETAILS                                */}
        {/* ========================================================================= */}
        {showMatchingModal && selectedPo && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '980px' }}>
              <div className={styles.modalHeader}>
                <h2>
                  تقرير مطابقة التوريد الثلاثي (3-Way Matching): {selectedPo.po_number}
                </h2>
                <button
                  className={styles.closeBtn}
                  onClick={() => setShowMatchingModal(false)}
                >
                  <X size={20} />
                </button>
              </div>

              <div className={styles.modalBody}>
                {isLoadingMatching ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <LoadingScreen />
                  </div>
                ) : matchingData ? (
                  <>
                    {/* Header Summary Cards */}
                    <div className={styles.matchSummaryGrid}>
                      <div className={styles.matchSummaryBox}>
                        <h4>المورد والمشروع</h4>
                        <p style={{ fontSize: '0.95rem' }}>{matchingData.po.supplier_name}</p>
                        <small style={{ color: 'var(--text-secondary)' }}>
                          {matchingData.po.project_name}
                        </small>
                      </div>

                      <div className={styles.matchSummaryBox}>
                        <h4>إجمالي أمر الشراء (PO)</h4>
                        <p>{formatCurrency(matchingData.summary.total_ordered_amount)}</p>
                        <small>{matchingData.lines.length} بنود مسجلة</small>
                        {matchingData.po.attachment_url && (
                          <div style={{ marginTop: '6px' }}>
                            <AttachmentViewButton
                              url={matchingData.po.attachment_url}
                              label="مستند أمر الشراء"
                              title={`أمر شراء ${matchingData.po.po_number}`}
                            />
                          </div>
                        )}
                      </div>

                      <div className={styles.matchSummaryBox}>
                        <h4>إجمالي المستلم (Receipts)</h4>
                        <p>{formatCurrency(matchingData.summary.total_received_amount)}</p>
                        <small>{matchingData.receipts.length} سندات استلام</small>
                      </div>

                      <div className={styles.matchSummaryBox}>
                        <h4>إجمالي المفوتر (Invoices)</h4>
                        <p>{formatCurrency(matchingData.summary.total_invoiced_amount)}</p>
                        <small>{matchingData.invoices.length} فواتير ضريبية</small>
                      </div>

                      <div className={styles.matchSummaryBox}>
                        <h4>حالة المطابقة الثلاثية</h4>
                        <div style={{ marginTop: '4px' }}>
                          {matchingData.summary.is_fully_matched ? (
                            <span className={styles.badgeMatchSuccess}>
                              ✓ مطابقة تامة 100%
                            </span>
                          ) : (
                            <span className={styles.badgeMatchWarning}>
                              قيد التوريد والفوترة
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Linked Document Chains */}
                    <div className={styles.matchingCard}>
                      <div className={styles.matchingHeader}>
                        <h3 style={{ fontSize: '0.92rem', margin: 0, fontWeight: 700 }}>
                          سلسلة المستندات المرتبطة بأمر الشراء
                        </h3>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                          <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            سندات الاستلام الميدانية:
                          </strong>
                          <div className={styles.docList}>
                            {matchingData.receipts.length === 0 ? (
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                لم يتم تسجيل سندات استلام حتى الآن
                              </span>
                            ) : (
                              matchingData.receipts.map((rcpt) => (
                                <div key={rcpt.id} className={styles.docChip}>
                                  <Truck size={12} color="#059669" />
                                  <span>{rcpt.receipt_number}</span>
                                  <span>({formatCurrency(rcpt.total_amount)})</span>
                                  <span>{rcpt.receipt_date}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div>
                          <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            فواتير المورد المسجلة:
                          </strong>
                          <div className={styles.docList}>
                            {matchingData.invoices.length === 0 ? (
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                لم يتم تسجيل فواتير مورد حتى الآن
                              </span>
                            ) : (
                              matchingData.invoices.map((inv) => (
                                <div key={inv.id} className={styles.docChip}>
                                  <Receipt size={12} color="#2563eb" />
                                  <span>{inv.invoice_number}</span>
                                  <span>(مرجع: {inv.supplier_invoice_ref})</span>
                                  <span>{formatCurrency(inv.total_amount)}</span>
                                  <span>{inv.is_posted ? 'مرحل' : 'مسودة'}</span>
                                  {inv.attachment_url && (
                                    <AttachmentViewButton
                                      url={inv.attachment_url}
                                      label="الفاتورة الضريبية"
                                      title={`فاتورة مورد: ${inv.supplier_invoice_ref}`}
                                    />
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3-Way Lines Table */}
                    <div className={styles.linesSection}>
                      <h3 style={{ marginBottom: '10px' }}>
                        المطابقة التفصيلية لكل بند (كميات وأسعار)
                      </h3>
                      <div className={styles.tableResponsive}>
                        <table className={styles.table} style={{ fontSize: '0.8rem' }}>
                          <thead>
                            <tr>
                              <th>البند</th>
                              <th>الكمية المطلوبة</th>
                              <th>سعر الأمر</th>
                              <th>الكمية المستلمة</th>
                              <th>الكمية المفوترة</th>
                              <th>سعر الفاتورة</th>
                              <th>فروق الأسعار</th>
                              <th>المتبقي للاستلام</th>
                              <th>المتبقي للفوترة</th>
                              <th>حالة البند</th>
                            </tr>
                          </thead>
                          <tbody>
                            {matchingData.lines.map((l) => (
                              <tr key={l.po_line_id}>
                                <td style={{ fontWeight: 600 }}>{l.item_name}</td>
                                <td>
                                  {l.ordered_qty} {l.unit}
                                </td>
                                <td>{formatCurrency(l.po_unit_price)}</td>
                                <td
                                  style={{
                                    color:
                                      l.received_qty >= l.ordered_qty
                                        ? '#059669'
                                        : '#b45309',
                                    fontWeight: 600,
                                  }}
                                >
                                  {l.received_qty}
                                </td>
                                <td
                                  style={{
                                    color:
                                      l.invoiced_qty >= l.ordered_qty
                                        ? '#059669'
                                        : '#2563eb',
                                    fontWeight: 600,
                                  }}
                                >
                                  {l.invoiced_qty}
                                </td>
                                <td>{formatCurrency(l.invoiced_unit_price)}</td>
                                <td>
                                  {l.price_variance !== 0 ? (
                                    <span style={{ color: '#dc2626', fontWeight: 600 }}>
                                      {formatCurrency(l.price_variance)}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#059669' }}>0.00 ر.س</span>
                                  )}
                                </td>
                                <td>{l.remaining_to_receive}</td>
                                <td>{l.remaining_to_invoice}</td>
                                <td>
                                  {l.status === 'fully_matched' ? (
                                    <span className={styles.badgeMatchSuccess}>
                                      ✓ مطابق
                                    </span>
                                  ) : l.status === 'partially_received' ? (
                                    <span className={styles.badgeMatchWarning}>
                                      استلام جزئي
                                    </span>
                                  ) : l.status === 'price_variance' ? (
                                    <span className={styles.badgeMatchDanger}>
                                      فرق سعر
                                    </span>
                                  ) : (
                                    <span className={styles.badgeDraft}>
                                      غير مكتمل
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div>تعذر تحميل بيانات المطابقة</div>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowMatchingModal(false)}
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
