"use client";
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  useRequestsHandoversLogic,
  REQUEST_CATEGORIES,
  HANDOVER_CATEGORIES,
  CHECKLIST_PRESETS,
  type RecordKind,
  type ApprovalDecisionCode,
  type ChecklistItem,
  type EnrichedRequestHandover,
} from './requests_handovers_logic';
import LoadingScreen from '@/components/LoadingScreen';
import ReportOfficialHeader from '@/components/ReportOfficialHeader';
import ReportContactFooter from '@/components/ReportContactFooter';
import { DocNote, DocSection, DocSignatures, DocStats, PHI_DOC_CSS } from '@/components/PrintDocument';
import TelegramAttachmentField, { AttachmentViewButton } from '@/components/TelegramAttachmentField';
import { buildDocumentFileName } from '@/lib/documentFileName';
import { printWithDocumentTitle } from '@/lib/printWithTitle';
import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileCheck2,
  FileSpreadsheet,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  X,
  AlertTriangle,
} from 'lucide-react';

interface RequestsHandoversViewProps {
  lockedProjectId?: string;
  lockedProjectName?: string;
  embeddedInProject?: boolean;
}

function getDecisionStyle(code: ApprovalDecisionCode) {
  if (code === 'معتمد (Code A)') {
    return {
      bg: 'rgba(16, 185, 129, 0.14)',
      color: '#10b981',
      printBg: '#dcfce7',
      printColor: '#15803d',
      short: 'Code A • معتمد',
    };
  }
  if (code === 'معتمد بملاحظات (Code B)') {
    return {
      bg: 'rgba(245, 158, 11, 0.15)',
      color: '#f59e0b',
      printBg: '#fef3c7',
      printColor: '#b45309',
      short: 'Code B • بملاحظات',
    };
  }
  if (code === 'مرفوض / إعادة تسليم (Code C)') {
    return {
      bg: 'rgba(244, 63, 94, 0.15)',
      color: '#f43f5e',
      printBg: '#ffe4e6',
      printColor: '#b91c1c',
      short: 'Code C • مرفوض',
    };
  }
  return {
    bg: 'rgba(14, 165, 233, 0.14)',
    color: '#38bdf8',
    printBg: '#e0f2fe',
    printColor: '#0369a1',
    short: 'تحت الفحص',
  };
}

export default function RequestsHandoversView({
  lockedProjectId,
  lockedProjectName,
  embeddedInProject = false,
}: RequestsHandoversViewProps) {
  const logic = useRequestsHandoversLogic(lockedProjectId);
  const d = logic.data;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [singlePrintRec, setSinglePrintRec] = useState<EnrichedRequestHandover | null>(null);
  const [isRegisterPrintOpen, setIsRegisterPrintOpen] = useState(false);
  const [newCheckLabel, setNewCheckLabel] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState<{
    project_id: string;
    boq_id: string;
    drawing_id: string;
    jobOrderId: string;
    recordKind: RecordKind;
    requestCode: string;
    requestCategory: string;
    title: string;
    stage: string;
    visit_date: string;
    handoverDate: string;
    inspector_name: string;
    consultantName: string;
    clientRepName: string;
    contractorId: string;
    contractorName: string;
    requestedQty: number;
    approvedQty: number;
    unit: string;
    completionPct: number;
    locationZone: string;
    approvalCode: ApprovalDecisionCode;
    cleanNotes: string;
    photo_before_url: string | null;
    photo_after_url: string | null;
    attachmentUrl: string | null;
    checklist: ChecklistItem[];
    syncProjectAndBoqProgress: boolean;
  }>({
    project_id: lockedProjectId || '',
    boq_id: '',
    drawing_id: '',
    jobOrderId: '',
    recordKind: 'request',
    requestCode: '',
    requestCategory: REQUEST_CATEGORIES[0],
    title: '',
    stage: '',
    visit_date: todayStr,
    handoverDate: todayStr,
    inspector_name: '',
    consultantName: 'الاستشاري الهندسي المشرف',
    clientRepName: 'ممثل المالك',
    contractorId: '',
    contractorName: '',
    requestedQty: 1,
    approvedQty: 1,
    unit: 'م2',
    completionPct: 100,
    locationZone: '',
    approvalCode: 'تحت الفحص',
    cleanNotes: '',
    photo_before_url: null,
    photo_after_url: null,
    attachmentUrl: null,
    checklist: CHECKLIST_PRESETS['مباني وتشطيبات معمارية'].map((label, i) => ({
      id: `chk-${i}`,
      label,
      checked: true,
    })),
    syncProjectAndBoqProgress: true,
  });

  const openCreateModal = (kind: RecordKind) => {
    const defaultProjId =
      lockedProjectId ||
      (logic.selectedProjectId !== 'all' ? logic.selectedProjectId : d?.projects?.[0]?.id || '');
    const projObj = (d?.projects || []).find((p: any) => String(p.id) === String(defaultProjId));
    const defaultCategory = kind === 'handover' ? HANDOVER_CATEGORIES[0] : REQUEST_CATEGORIES[0];
    const code = logic.generateNextCode(kind, defaultCategory);
    const presetKey =
      kind === 'handover' ? 'تسليم ابتدائي / نهائي للعميل' : 'مباني وتشطيبات معمارية';

    setEditingId(undefined);
    setForm({
      project_id: String(defaultProjId || ''),
      boq_id: '',
      drawing_id: '',
      jobOrderId: '',
      recordKind: kind,
      requestCode: code,
      requestCategory: defaultCategory,
      title: '',
      stage: projObj?.current_stage || 'التشطيبات المعمارية',
      visit_date: todayStr,
      handoverDate: todayStr,
      inspector_name: projObj?.engineer_in_charge || 'مهندس الموقع',
      consultantName: 'الاستشاري الهندسي المشرف',
      clientRepName: projObj?.client_name || 'ممثل المالك',
      contractorId: '',
      contractorName: '',
      requestedQty: 1,
      approvedQty: 1,
      unit: 'مقطوعية',
      completionPct: 100,
      locationZone: projObj?.location_address || projObj?.Property || '',
      approvalCode: kind === 'handover' ? 'معتمد (Code A)' : 'تحت الفحص',
      cleanNotes: '',
      photo_before_url: null,
      photo_after_url: null,
      attachmentUrl: null,
      checklist: (CHECKLIST_PRESETS[presetKey] || []).map((label, i) => ({
        id: `chk-${Date.now()}-${i}`,
        label,
        checked: true,
      })),
      syncProjectAndBoqProgress: true,
    });
    setIsFormOpen(true);
  };

  const openEditModal = (rec: EnrichedRequestHandover) => {
    setEditingId(rec.id);
    setForm({
      project_id: rec.project_id,
      boq_id: rec.boq_id || '',
      drawing_id: rec.drawing_id || '',
      jobOrderId: rec.jobOrderId || '',
      recordKind: rec.recordKind,
      requestCode: rec.requestCode,
      requestCategory: rec.requestCategory,
      title: rec.title,
      stage: rec.stage,
      visit_date: rec.visit_date,
      handoverDate: rec.handoverDate,
      inspector_name: rec.inspector_name,
      consultantName: rec.consultantName,
      clientRepName: rec.clientRepName,
      contractorId: rec.contractorId || '',
      contractorName: rec.contractorName,
      requestedQty: rec.requestedQty,
      approvedQty: rec.approvedQty,
      unit: rec.unit,
      completionPct: rec.completionPct,
      locationZone: rec.locationZone,
      approvalCode: rec.approvalCode,
      cleanNotes: rec.cleanNotes,
      photo_before_url: rec.photo_before_url,
      photo_after_url: rec.photo_after_url,
      attachmentUrl: rec.attachmentUrl,
      checklist:
        rec.checklist.length > 0
          ? rec.checklist
          : CHECKLIST_PRESETS['مباني وتشطيبات معمارية'].map((label, i) => ({
              id: `chk-${i}`,
              label,
              checked: true,
            })),
      syncProjectAndBoqProgress: true,
    });
    setIsFormOpen(true);
  };

  const handleProjectChangeInForm = (newProjId: string) => {
    const projObj = (d?.projects || []).find((p: any) => String(p.id) === String(newProjId));
    setForm((prev) => ({
      ...prev,
      project_id: newProjId,
      boq_id: '',
      jobOrderId: '',
      drawing_id: '',
      stage: projObj?.current_stage || prev.stage,
      inspector_name: projObj?.engineer_in_charge || prev.inspector_name,
      locationZone: projObj?.location_address || projObj?.Property || prev.locationZone,
    }));
  };

  const handleBoqChangeInForm = (newBoqId: string) => {
    const boqObj = (d?.boqItems || []).find((b: any) => String(b.id) === String(newBoqId));
    const linkedJo = (d?.jobOrders || []).find(
      (j: any) =>
        String(j.project_id) === String(form.project_id) &&
        String(j.boq_budget_id) === String(newBoqId)
    );
    const contractorObj = linkedJo?.contractor_id
      ? (d?.partners || []).find((p: any) => String(p.id) === String(linkedJo.contractor_id))
      : null;

    setForm((prev) => ({
      ...prev,
      boq_id: newBoqId,
      title: prev.title || (boqObj ? `${prev.recordKind === 'handover' ? 'تسليم بند' : 'فحص واستلام بند'}: ${boqObj.work_item}` : ''),
      requestedQty: Number(boqObj?.contract_quantity || linkedJo?.assigned_qty || prev.requestedQty || 1),
      approvedQty: Number(boqObj?.contract_quantity || linkedJo?.assigned_qty || prev.approvedQty || 1),
      unit: boqObj?.unit || prev.unit,
      jobOrderId: linkedJo ? String(linkedJo.id) : prev.jobOrderId,
      contractorId: contractorObj ? String(contractorObj.id) : prev.contractorId,
      contractorName: contractorObj?.name || prev.contractorName,
    }));
  };

  const handleJobOrderChangeInForm = (newJoId: string) => {
    const joObj = (d?.jobOrders || []).find((j: any) => String(j.id) === String(newJoId));
    const contractorObj = joObj?.contractor_id
      ? (d?.partners || []).find((p: any) => String(p.id) === String(joObj.contractor_id))
      : null;
    setForm((prev) => ({
      ...prev,
      jobOrderId: newJoId,
      boq_id: joObj?.boq_budget_id ? String(joObj.boq_budget_id) : prev.boq_id,
      contractorId: contractorObj ? String(contractorObj.id) : prev.contractorId,
      contractorName: contractorObj?.name || prev.contractorName,
      requestedQty: Number(joObj?.assigned_qty || prev.requestedQty || 1),
      approvedQty: Number(joObj?.assigned_qty || prev.approvedQty || 1),
    }));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await logic.saveRecord({
      id: editingId,
      ...form,
    });
    if (ok) {
      setIsFormOpen(false);
    }
  };

  const exportToExcel = () => {
    if (!d) return;
    const rows = d.filteredRecords.map((r) => ({
      'رقم الركوست / المحضر': r.requestCode,
      'النوع': r.recordKind === 'handover' ? 'محضر تسليم' : 'ركوست فحص واستلام',
      'التصنيف الهندسي': r.requestCategory,
      'المشروع / الفيلا': r.project_name,
      'النموذج': r.unit_type,
      'بند المقايسة (BOQ)': r.boq_item_name,
      'أمر الشغل': r.jobOrderNumber,
      'الموضوع / البيان': r.title,
      'المرحلة الهندسية': r.stage,
      'المقاول المنفذ': r.contractorName,
      'مهندس الموقع': r.inspector_name,
      'المهندس الاستشاري': r.consultantName,
      'تاريخ التقديم': r.visit_date,
      'تاريخ التسليم / الفحص': r.handoverDate,
      'الكمية المطلوبة': r.requestedQty,
      'الكمية المعتمدة': r.approvedQty,
      'الوحدة': r.unit,
      'نسبة الإنجاز %': r.completionPct,
      'بنود الفحص المطابقة': `${r.checklist.filter((c) => c.checked).length}/${r.checklist.length}`,
      'القرار الهندسي (Approval Code)': r.approvalCode,
      'ملاحظات وتوصيات الاستشاري': r.cleanNotes || '---',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, ws, 'الركوستات_والتسليمات');
    const { fileName } = buildDocumentFileName({
      docType: 'سجل_الركوستات_والتسليمات_الهندسية',
      prefix: 'WIR-HND',
      subject: lockedProjectName || 'جميع_المشاريع',
      seedParts: [rows.length],
      ext: 'xlsx',
    });
    XLSX.writeFile(wb, fileName);
  };

  if (logic.isLoading || !d) {
    return <LoadingScreen message="جاري تحميل سجل الركوستات والتسليمات الهندسية للمشاريع..." fullScreen={false} />;
  }

  const s = d.stats;
  const projectBoqs = (d.boqItems || []).filter(
    (b: any) => String(b.project_id) === String(form.project_id)
  );
  const projectJobOrders = (d.jobOrders || []).filter(
    (j: any) => String(j.project_id) === String(form.project_id)
  );
  const projectDrawings = (d.drawings || []).filter(
    (dr: any) => String(dr.project_id) === String(form.project_id)
  );
  const contractorsList = (d.partners || []).filter(
    (p: any) => p.partner_type !== 'عميل'
  );

  return (
    <div style={{ direction: 'rtl', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      <style>{`
        .rh-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(12.5rem, 1fr));
          gap: 0.85rem;
        }
        .rh-kpi-card {
          background: var(--surface-card);
          border-radius: 16px;
          padding: 1rem 1.15rem;
          box-shadow: var(--shadow-ambient);
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .rh-kpi-card small {
          font-size: var(--fs-xs);
          font-weight: 800;
          color: var(--text-secondary);
        }
        .rh-kpi-card strong {
          font-size: var(--fs-xl);
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }
        .rh-kpi-card span {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted);
        }
        .rh-card {
          background: var(--surface-card);
          border-radius: 18px;
          padding: 1.15rem 1.25rem;
          box-shadow: var(--shadow-ambient);
        }
        .rh-input {
          width: 100%;
          padding: 0.58rem 0.75rem;
          border-radius: 11px;
          background: var(--surface-sunken);
          border: 1px solid var(--control-edge, rgba(148, 163, 184, 0.18));
          color: var(--text-primary);
          font-weight: 700;
          font-size: var(--fs-sm);
          outline: none;
        }
        .rh-input option {
          background: var(--surface-card);
          color: var(--text-primary);
        }
        .rh-label {
          display: block;
          font-size: var(--fs-xs);
          font-weight: 800;
          color: var(--text-secondary);
          margin-bottom: 0.3rem;
        }
        .rh-table {
          width: 100%;
          min-width: 64rem;
          border-collapse: collapse;
          text-align: center;
        }
        .rh-table th {
          background: var(--table-head-bg);
          color: var(--text-secondary);
          padding: 0.75rem 0.55rem;
          font-size: var(--fs-xs);
          font-weight: 900;
          border-bottom: 1px solid var(--table-zebra-bg);
          white-space: nowrap;
        }
        .rh-table td {
          padding: 0.75rem 0.55rem;
          font-size: var(--fs-xs);
          font-weight: 700;
          color: var(--text-primary);
          border-bottom: 1px solid var(--table-zebra-bg);
          vertical-align: middle;
        }
        .rh-table tbody tr:hover {
          background: var(--table-row-hover);
        }
        .rh-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          padding: 0.6rem 1.05rem;
          border-radius: 11px;
          border: none;
          font-weight: 900;
          font-size: var(--fs-xs);
          cursor: pointer;
          transition: 0.18s;
          white-space: nowrap;
        }
      `}</style>

      {/* 1. بطاقات المؤشرات السريعة للركوستات والتسليمات */}
      <div className="rh-kpi-grid no-print">
        <div className="rh-kpi-card">
          <small>إجمالي الركوستات والتسليمات</small>
          <strong style={{ color: 'var(--accent-ink)' }}>{s.totalCount}</strong>
          <span>
            ركوستات فحص (IR/WIR/MIR): {s.requestsCount} • محاضر تسليم: {s.handoversCount}
          </span>
        </div>
        <div className="rh-kpi-card">
          <small>معتمد بدون ملاحظات (Code A)</small>
          <strong style={{ color: 'var(--status-positive, #10b981)' }}>{s.approvedACount}</strong>
          <span>مستوفي للمواصفات والشوب دروينج وجاهز للمستخلص</span>
        </div>
        <div className="rh-kpi-card">
          <small>معتمد بملاحظات (Code B)</small>
          <strong style={{ color: 'var(--status-warning, #f59e0b)' }}>{s.approvedBCount}</strong>
          <span>يُسمح باستكمال المرحلة مع استيفاء الملاحظات</span>
        </div>
        <div className="rh-kpi-card">
          <small>تحت الفحص / مرفوض (Code C)</small>
          <strong style={{ color: s.rejectedCCount > 0 ? 'var(--status-negative, #f43f5e)' : '#38bdf8' }}>
            {s.pendingCount} فحص / {s.rejectedCCount} مرفوض
          </strong>
          <span>{(s.totalCount || 0) === 0 ? 'لا توجد طلبات مقيّمة بعد' : `نسبة الاعتماد الهندسي: ${s.firstTimeApprovalRate}%`}</span>
        </div>
      </div>

      {/* 2. شريط ملخص المشاريع السريع (يظهر في الصفحة العامة للتبديل بين الفلل بضغطة واحدة) */}
      {!lockedProjectId && d.projectStats.length > 0 && (
        <div className="rh-card no-print" style={{ padding: '0.9rem 1.1rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: '0.65rem',
            }}
          >
            <strong style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)' }}>
              المشاريع والفلل المربوطة بالركوستات والتسليمات (اضغط على الفيلا لعرض ركوستاتها وتسليماتها)
            </strong>
            {logic.selectedProjectId !== 'all' && (
              <button
                type="button"
                onClick={() => logic.setSelectedProjectId('all')}
                className="rh-btn"
                style={{ background: 'var(--surface-sunken)', color: 'var(--accent-ink)', padding: '0.35rem 0.8rem' }}
              >
                عرض جميع المشاريع ({d.allRecords.length})
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {d.projectStats.map((ps: any) => {
              const active = String(logic.selectedProjectId) === String(ps.id);
              return (
                <button
                  key={ps.id}
                  type="button"
                  onClick={() => logic.setSelectedProjectId(active ? 'all' : ps.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.9rem',
                    borderRadius: '12px',
                    border: active
                      ? '1.5px solid #ea580c'
                      : '1px solid var(--control-edge, rgba(148, 163, 184, 0.18))',
                    background: active ? 'var(--accent-soft-bg)' : 'var(--surface-sunken)',
                    color: active ? 'var(--accent-ink)' : 'var(--text-primary)',
                    fontWeight: 900,
                    fontSize: 'var(--fs-xs)',
                    cursor: 'pointer',
                  }}
                >
                  <Building2 size={14} />
                  <span>{ps.name}</span>
                  <span
                    style={{
                      background: 'var(--surface-card)',
                      padding: '1px 7px',
                      borderRadius: '999px',
                      fontSize: '0.68rem',
                      color: ps.total > 0 ? 'var(--status-positive, #10b981)' : 'var(--text-muted)',
                    }}
                  >
                    {ps.requests} ركوست • {ps.handovers} تسليم
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. شريط الإجراءات والفلاتر */}
      <div className="rh-card no-print" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              type="button"
              className="rh-btn"
              onClick={() => openCreateModal('request')}
              style={{ background: '#0284c7', color: '#ffffff', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.28)' }}
            >
              <Plus size={15} />
              <span>إضافة ركوست استلام أعمال / خامات (WIR / MIR / IR)</span>
            </button>
            <button
              type="button"
              className="rh-btn"
              onClick={() => openCreateModal('handover')}
              style={{ background: '#ea580c', color: '#ffffff', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.28)' }}
            >
              <FileCheck2 size={15} />
              <span>إضافة محضر تسليم (بند / مقاول / تسليم عميل)</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              type="button"
              className="rh-btn"
              onClick={() => setIsRegisterPrintOpen(true)}
              style={{ background: 'var(--surface-sunken)', color: 'var(--text-primary)' }}
            >
              <Printer size={15} />
              <span>طباعة كشف الركوستات والتسليمات (PDF)</span>
            </button>
            <button
              type="button"
              className="rh-btn"
              onClick={exportToExcel}
              style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}
            >
              <FileSpreadsheet size={15} />
              <span>تصدير Excel</span>
            </button>
            <button
              type="button"
              className="rh-btn"
              onClick={() => logic.refetch()}
              style={{ background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* صف الفلترة والبحث */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
            gap: '0.65rem',
            alignItems: 'end',
          }}
        >
          <div>
            <label className="rh-label">بحث برقم الركوست أو البند أو المقاول</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="rh-input"
                placeholder="مثال: WIR-2026 أو معجون أو فيلا 658..."
                value={logic.searchQuery}
                onChange={(e) => logic.setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {!lockedProjectId && (
            <div>
              <label className="rh-label">المشروع / الفيلا</label>
              <select
                className="rh-input"
                value={logic.selectedProjectId}
                onChange={(e) => logic.setSelectedProjectId(e.target.value)}
              >
                <option value="all">جميع المشاريع ({d.projects.length})</option>
                {d.projects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.Property || p.project_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="rh-label">نوع المستند</label>
            <select
              className="rh-input"
              value={logic.kindFilter}
              onChange={(e) => logic.setKindFilter(e.target.value as any)}
            >
              <option value="all">الكل (ركوستات + تسليمات)</option>
              <option value="request">ركوستات الفحص والاستلام (WIR / MIR / CPR / IR)</option>
              <option value="handover">محاضر التسليم والاستلام (Handovers)</option>
            </select>
          </div>

          <div>
            <label className="rh-label">القرار الهندسي (Approval Code)</label>
            <select
              className="rh-input"
              value={logic.decisionFilter}
              onChange={(e) => logic.setDecisionFilter(e.target.value as any)}
            >
              <option value="all">جميع الحالات</option>
              <option value="تحت الفحص">تحت الفحص والمعاينة</option>
              <option value="معتمد (Code A)">معتمد بدون ملاحظات (Code A)</option>
              <option value="معتمد بملاحظات (Code B)">معتمد بملاحظات (Code B)</option>
              <option value="مرفوض / إعادة تسليم (Code C)">مرفوض / إعادة تسليم (Code C)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. جدول الركوستات والتسليمات الهندسية */}
      <div className="rh-card" style={{ overflowX: 'auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.85rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 'var(--fs-md)', fontWeight: 900, color: 'var(--text-primary)' }}>
            سجل الركوستات ومحاضر التسليمات الهندسية المربوطة بالمشاريع ({d.filteredRecords.length})
          </h3>
        </div>

        {d.filteredRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
            <ClipboardCheck size={38} style={{ opacity: 0.45, marginBottom: '0.5rem' }} />
            <div style={{ fontWeight: 900, fontSize: 'var(--fs-md)', color: 'var(--text-secondary)' }}>
              لا توجد ركوستات أو محاضر تسليم مسجلة ضمن هذا الفلتر حالياً
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', marginTop: '0.3rem' }}>
              اضغط على «إضافة ركوست استلام أعمال» أو «إضافة محضر تسليم» لربط أول ركوست بالمشروع وبنود المقايسة
            </div>
          </div>
        ) : (
          <table className="rh-table">
            <thead>
              <tr>
                <th>رقم المستند</th>
                <th>النوع والتصنيف</th>
                {!lockedProjectId && <th>المشروع / الفيلا</th>}
                <th style={{ textAlign: 'right' }}>الموضوع وبند المقايسة (BOQ)</th>
                <th>أمر الشغل والمقاول</th>
                <th>الكمية والإنجاز</th>
                <th>فحص المطابقة</th>
                <th>مهندس الموقع / الاستشاري</th>
                <th>التاريخ</th>
                <th>القرار الهندسي (اعتماد سريع)</th>
                <th>مرفقات</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {d.filteredRecords.map((rec) => {
                const decStyle = getDecisionStyle(rec.approvalCode);
                const passedChecks = rec.checklist.filter((c) => c.checked).length;
                return (
                  <tr key={rec.id}>
                    <td style={{ fontWeight: 900, color: 'var(--accent-ink)', whiteSpace: 'nowrap' }}>
                      <div>{rec.requestCode}</div>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '0.68rem',
                          fontWeight: 900,
                          background:
                            rec.recordKind === 'handover'
                              ? 'rgba(234, 88, 12, 0.14)'
                              : 'rgba(2, 132, 199, 0.14)',
                          color: rec.recordKind === 'handover' ? '#ea580c' : '#38bdf8',
                        }}
                      >
                        {rec.recordKind === 'handover' ? 'محضر تسليم' : 'ركوست استلام'}
                      </span>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {rec.requestCategory}
                      </div>
                    </td>
                    {!lockedProjectId && (
                      <td style={{ fontWeight: 900 }}>
                        <div>{rec.project_name}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{rec.stage}</div>
                      </td>
                    )}
                    <td style={{ textAlign: 'right', maxWidth: '17rem' }}>
                      <div style={{ fontWeight: 900 }}>{rec.title}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--accent-ink)' }}>
                        بند: {rec.boq_item_name}
                      </div>
                      {rec.cleanNotes && (
                        <div
                          style={{
                            fontSize: '0.66rem',
                            color: 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {rec.cleanNotes}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 800 }}>{rec.contractorName}</div>
                      {rec.jobOrderNumber !== '---' && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          أمر شغل: {rec.jobOrderNumber}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 900 }}>
                        {rec.approvedQty} / {rec.requestedQty} {rec.unit}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--status-positive, #10b981)' }}>
                        إنجاز: {rec.completionPct}%
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '8px',
                          background: 'var(--surface-sunken)',
                          fontWeight: 900,
                          fontSize: '0.7rem',
                          color:
                            rec.checklist.length > 0 && passedChecks === rec.checklist.length
                              ? '#10b981'
                              : 'var(--text-secondary)',
                        }}
                      >
                        {rec.checklist.length > 0 ? `${passedChecks}/${rec.checklist.length} مطابق` : '---'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 800 }}>{rec.inspector_name}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        استشاري: {rec.consultantName}
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div>{rec.visit_date}</div>
                      {rec.handoverDate && rec.handoverDate !== rec.visit_date && (
                        <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                          تسليم: {rec.handoverDate}
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 9px',
                          borderRadius: '999px',
                          background: decStyle.bg,
                          color: decStyle.color,
                          fontWeight: 900,
                          fontSize: '0.7rem',
                          marginBottom: '4px',
                        }}
                      >
                        {decStyle.short}
                      </span>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '3px' }}>
                        {(
                          [
                            { code: 'معتمد (Code A)', label: 'A', col: '#10b981' },
                            { code: 'معتمد بملاحظات (Code B)', label: 'B', col: '#f59e0b' },
                            { code: 'مرفوض / إعادة تسليم (Code C)', label: 'C', col: '#f43f5e' },
                          ] as { code: ApprovalDecisionCode; label: string; col: string }[]
                        ).map((btn) => (
                          <button
                            key={btn.label}
                            type="button"
                            title={`تحويل سريع إلى ${btn.code}`}
                            disabled={logic.isSaving || rec.approvalCode === btn.code}
                            onClick={() => logic.quickUpdateDecision(rec, btn.code)}
                            style={{
                              width: '22px',
                              height: '20px',
                              borderRadius: '5px',
                              border: `1px solid ${btn.col}`,
                              background: rec.approvalCode === btn.code ? btn.col : 'transparent',
                              color: rec.approvalCode === btn.code ? '#fff' : btn.col,
                              fontWeight: 900,
                              fontSize: '0.65rem',
                              cursor: 'pointer',
                            }}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {rec.attachmentUrl && <AttachmentViewButton url={rec.attachmentUrl} label="مرفق" />}
                        {rec.photo_before_url && <AttachmentViewButton url={rec.photo_before_url} label="قبل" />}
                        {rec.photo_after_url && <AttachmentViewButton url={rec.photo_after_url} label="بعد" />}
                        {!rec.attachmentUrl && !rec.photo_before_url && !rec.photo_after_url && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>---</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          title="طباعة نموذج الركوست / محضر التسليم الرسمي"
                          onClick={() => setSinglePrintRec(rec)}
                          style={{
                            padding: '5px 7px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'var(--accent-soft-bg)',
                            color: 'var(--accent-ink)',
                            cursor: 'pointer',
                          }}
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          type="button"
                          title="تعديل"
                          onClick={() => openEditModal(rec)}
                          style={{
                            padding: '5px 7px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'var(--surface-sunken)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          title="حذف"
                          onClick={() => {
                            if (window.confirm(`هل أنت متأكد من حذف (${rec.requestCode})؟`)) {
                              logic.deleteRecord(rec.id);
                            }
                          }}
                          style={{
                            padding: '5px 7px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'rgba(244, 63, 94, 0.14)',
                            color: '#f43f5e',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 5. مودال إضافة / تعديل ركوست استلام أو محضر تسليم */}
      {isFormOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setIsFormOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              background: 'rgba(15, 23, 42, 0.72)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              direction: 'rtl',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--surface-card)',
                color: 'var(--text-primary)',
                borderRadius: '20px',
                width: '100%',
                maxWidth: '54rem',
                maxHeight: '92vh',
                overflowY: 'auto',
                padding: '1.35rem 1.5rem',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid var(--table-zebra-bg)',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontWeight: 900, fontSize: 'var(--fs-lg)' }}>
                    {editingId
                      ? `تعديل ${form.requestCode}`
                      : form.recordKind === 'handover'
                        ? 'إصدار محضر تسليم أعمال / مرحلة جديد (Handover Certificate)'
                        : 'إصدار ركوست فحص واستلام هندسي جديد (WIR / MIR / CPR / IR)'}
                  </h3>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                    مربوط مباشرة بالمشروع وبند المقايسة (BOQ) وأمر الشغل والمقاول المنفذ
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  style={{
                    background: 'var(--surface-sunken)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '6px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {/* تبديل نوع المستند */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const cat = REQUEST_CATEGORIES[0];
                      setForm((prev) => ({
                        ...prev,
                        recordKind: 'request',
                        requestCategory: cat,
                        requestCode: editingId ? prev.requestCode : logic.generateNextCode('request', cat),
                      }));
                    }}
                    style={{
                      padding: '0.65rem',
                      borderRadius: '12px',
                      border: form.recordKind === 'request' ? '2px solid #0284c7' : '1px solid var(--control-edge)',
                      background: form.recordKind === 'request' ? 'rgba(2, 132, 199, 0.14)' : 'var(--surface-sunken)',
                      color: form.recordKind === 'request' ? '#38bdf8' : 'var(--text-secondary)',
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    ركوست فحص واستلام هندسي (WIR / MIR / CPR / IR)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cat = HANDOVER_CATEGORIES[0];
                      setForm((prev) => ({
                        ...prev,
                        recordKind: 'handover',
                        requestCategory: cat,
                        requestCode: editingId ? prev.requestCode : logic.generateNextCode('handover', cat),
                      }));
                    }}
                    style={{
                      padding: '0.65rem',
                      borderRadius: '12px',
                      border: form.recordKind === 'handover' ? '2px solid #ea580c' : '1px solid var(--control-edge)',
                      background: form.recordKind === 'handover' ? 'rgba(234, 88, 12, 0.14)' : 'var(--surface-sunken)',
                      color: form.recordKind === 'handover' ? '#ea580c' : 'var(--text-secondary)',
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    محضر تسليم أعمال / تسليم عميل (Handover)
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label className="rh-label">المشروع / الفيلا *</label>
                    <select
                      className="rh-input"
                      required
                      disabled={Boolean(lockedProjectId)}
                      value={form.project_id}
                      onChange={(e) => handleProjectChangeInForm(e.target.value)}
                    >
                      <option value="">-- اختر المشروع --</option>
                      {d.projects.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.Property || p.project_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="rh-label">التصنيف الهندسي *</label>
                    <select
                      className="rh-input"
                      value={form.requestCategory}
                      onChange={(e) => {
                        const cat = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          requestCategory: cat,
                          requestCode: editingId ? prev.requestCode : logic.generateNextCode(prev.recordKind, cat),
                        }));
                      }}
                    >
                      {(form.recordKind === 'handover' ? HANDOVER_CATEGORIES : REQUEST_CATEGORIES).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="rh-label">رقم الركوست / المحضر</label>
                    <input
                      type="text"
                      className="rh-input"
                      value={form.requestCode}
                      onChange={(e) => setForm({ ...form, requestCode: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label className="rh-label">بند المقايسة المرتبط (BOQ)</label>
                    <select
                      className="rh-input"
                      value={form.boq_id}
                      onChange={(e) => handleBoqChangeInForm(e.target.value)}
                    >
                      <option value="">-- عام للمشروع أو اختر بند المقايسة --</option>
                      {projectBoqs.map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.work_item} ({b.contract_quantity} {b.unit || ''})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="rh-label">أمر الشغل المرتبط (Job Order)</label>
                    <select
                      className="rh-input"
                      value={form.jobOrderId}
                      onChange={(e) => handleJobOrderChangeInForm(e.target.value)}
                    >
                      <option value="">-- بدون أمر شغل محدد --</option>
                      {projectJobOrders.map((j: any) => (
                        <option key={j.id} value={j.id}>
                          {j.order_number} ({j.assigned_qty} × {j.unit_price})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="rh-label">المقاول المنفذ / الجهة المسلمة</label>
                    <select
                      className="rh-input"
                      value={form.contractorId}
                      onChange={(e) => {
                        const cid = e.target.value;
                        const cObj = contractorsList.find((c: any) => String(c.id) === cid);
                        setForm({ ...form, contractorId: cid, contractorName: cObj?.name || 'تنفيذ ذاتي / الشركة' });
                      }}
                    >
                      <option value="">تنفيذ ذاتي / الشركة</option>
                      {contractorsList.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.partner_type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="rh-label">عنوان وموضوع الركوست / محضر التسليم *</label>
                    <input
                      type="text"
                      required
                      className="rh-input"
                      placeholder="مثال: استلام أعمال معجون ودهانات الحوائط الداخلية للدور الأرضي..."
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="rh-label">المرحلة الهندسية</label>
                    <input
                      type="text"
                      className="rh-input"
                      placeholder="مثال: التشطيبات المعمارية"
                      value={form.stage}
                      onChange={(e) => setForm({ ...form, stage: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="rh-label">المخطط التنفيذي (Shop Drawing)</label>
                    <select
                      className="rh-input"
                      value={form.drawing_id}
                      onChange={(e) => setForm({ ...form, drawing_id: e.target.value })}
                    >
                      <option value="">-- بدون مخطط --</option>
                      {projectDrawings.map((dr: any) => (
                        <option key={dr.id} value={dr.id}>
                          {dr.title} ({dr.version})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label className="rh-label">الكمية المقدمة للفحص</label>
                    <input
                      type="number"
                      step="any"
                      className="rh-input"
                      value={form.requestedQty}
                      onChange={(e) => setForm({ ...form, requestedQty: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="rh-label">الكمية المعتمدة فعلياً</label>
                    <input
                      type="number"
                      step="any"
                      className="rh-input"
                      value={form.approvedQty}
                      onChange={(e) => setForm({ ...form, approvedQty: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="rh-label">الوحدة</label>
                    <input
                      type="text"
                      className="rh-input"
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="rh-label">نسبة الإنجاز المعتمدة %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="rh-input"
                      value={form.completionPct}
                      onChange={(e) => setForm({ ...form, completionPct: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="rh-label">القرار الهندسي (Approval)</label>
                    <select
                      className="rh-input"
                      value={form.approvalCode}
                      onChange={(e) => setForm({ ...form, approvalCode: e.target.value as ApprovalDecisionCode })}
                    >
                      <option value="تحت الفحص">تحت الفحص والمعاينة</option>
                      <option value="معتمد (Code A)">معتمد بدون ملاحظات (Code A)</option>
                      <option value="معتمد بملاحظات (Code B)">معتمد بملاحظات (Code B)</option>
                      <option value="مرفوض / إعادة تسليم (Code C)">مرفوض / إعادة تسليم (Code C)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label className="rh-label">مهندس الموقع (مقدم الطلب)</label>
                    <input
                      type="text"
                      className="rh-input"
                      value={form.inspector_name}
                      onChange={(e) => setForm({ ...form, inspector_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="rh-label">المهندس الاستشاري المستلم</label>
                    <input
                      type="text"
                      className="rh-input"
                      value={form.consultantName}
                      onChange={(e) => setForm({ ...form, consultantName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="rh-label">ممثل المالك / العميل</label>
                    <input
                      type="text"
                      className="rh-input"
                      value={form.clientRepName}
                      onChange={(e) => setForm({ ...form, clientRepName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="rh-label">تاريخ تقديم الركوست</label>
                    <input
                      type="date"
                      className="rh-input"
                      value={form.visit_date}
                      onChange={(e) => setForm({ ...form, visit_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="rh-label">تاريخ الاستلام / التسليم</label>
                    <input
                      type="date"
                      className="rh-input"
                      value={form.handoverDate}
                      onChange={(e) => setForm({ ...form, handoverDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* قائمة فحص المطابقة الهندسية Checklist */}
                <div
                  style={{
                    background: 'var(--surface-sunken)',
                    padding: '0.85rem 1rem',
                    borderRadius: '14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      marginBottom: '0.6rem',
                    }}
                  >
                    <strong style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-ink)' }}>
                      قائمة فحص المطابقة الهندسية والجودة (Inspection & Handover Checklist)
                    </strong>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {Object.keys(CHECKLIST_PRESETS).map((presetName) => (
                        <button
                          key={presetName}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              checklist: CHECKLIST_PRESETS[presetName].map((label, i) => ({
                                id: `chk-${Date.now()}-${i}`,
                                label,
                                checked: true,
                              })),
                            }))
                          }
                          style={{
                            padding: '2px 8px',
                            borderRadius: '8px',
                            border: '1px solid var(--control-edge)',
                            background: 'var(--surface-card)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          قالب: {presetName}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.5rem' }}>
                    {form.checklist.map((item, idx) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          background: 'var(--surface-card)',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '8px',
                          fontSize: 'var(--fs-xs)',
                        }}
                      >
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) => {
                              const next = [...form.checklist];
                              next[idx] = { ...item, checked: e.target.checked };
                              setForm({ ...form, checklist: next });
                            }}
                          />
                          <span style={{ fontWeight: 700 }}>{item.label}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              checklist: form.checklist.filter((_, i) => i !== idx),
                            })
                          }
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#f43f5e',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '0.45rem' }}>
                    <input
                      type="text"
                      className="rh-input"
                      placeholder="أضف بند فحص جديد للقائمة..."
                      value={newCheckLabel}
                      onChange={(e) => setNewCheckLabel(e.target.value)}
                    />
                    <button
                      type="button"
                      className="rh-btn"
                      onClick={() => {
                        if (!newCheckLabel.trim()) return;
                        setForm({
                          ...form,
                          checklist: [
                            ...form.checklist,
                            { id: `chk-${Date.now()}`, label: newCheckLabel.trim(), checked: true },
                          ],
                        });
                        setNewCheckLabel('');
                      }}
                      style={{ background: 'var(--accent-soft-bg)', color: 'var(--accent-ink)' }}
                    >
                      + إضافة بند فحص
                    </button>
                  </div>
                </div>

                {/* المرفقات والصور */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <TelegramAttachmentField
                      module="requests_handovers"
                      label="مرفق الركوست / محضر التسليم الموقع (PDF / صورة)"
                      value={form.attachmentUrl}
                      onChange={(url) => setForm({ ...form, attachmentUrl: url })}
                    />
                  </div>
                  <div>
                    <TelegramAttachmentField
                      module="requests_handovers"
                      label="صورة الأعمال قبل الفحص / التنفيذ"
                      value={form.photo_before_url}
                      onChange={(url) => setForm({ ...form, photo_before_url: url })}
                    />
                  </div>
                  <div>
                    <TelegramAttachmentField
                      module="requests_handovers"
                      label="صورة الأعمال بعد الاستلام والتسليم"
                      value={form.photo_after_url}
                      onChange={(url) => setForm({ ...form, photo_after_url: url })}
                    />
                  </div>
                </div>

                <div>
                  <label className="rh-label">ملاحظات الاستشاري وتوصيات الاستلام والتسليم</label>
                  <textarea
                    rows={3}
                    className="rh-input"
                    placeholder="سجّل أي ملاحظات فنية أو اشتراطات خاصة بالاستلام أو التسليم..."
                    value={form.cleanNotes}
                    onChange={(e) => setForm({ ...form, cleanNotes: e.target.value })}
                  />
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 800,
                    color: 'var(--status-positive, #10b981)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.syncProjectAndBoqProgress}
                    onChange={(e) => setForm({ ...form, syncProjectAndBoqProgress: e.target.checked })}
                  />
                  <span>
                    تحديث نسبة إنجاز بند المقايسة ومرحلة المشروع وتاريخ التسليم تلقائياً في صفحة المشروع عند الاعتماد
                  </span>
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.4rem' }}>
                  <button
                    type="button"
                    className="rh-btn"
                    onClick={() => setIsFormOpen(false)}
                    style={{ background: 'var(--surface-sunken)', color: 'var(--text-secondary)' }}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={logic.isSaving}
                    className="rh-btn"
                    style={{ background: '#ea580c', color: '#ffffff', padding: '0.65rem 1.5rem' }}
                  >
                    {logic.isSaving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'حفظ واعتماد المستند'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* 6. مودال الطباعة الرسمية لركوست منفرد أو محضر تسليم (بدون حدود وبألوان متدرجة) */}
      {singlePrintRec &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="print-modal-overlay"
            onClick={() => setSinglePrintRec(null)}
            dir="rtl"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999999,
              background: 'rgba(15, 23, 42, 0.78)',
              backdropFilter: 'blur(8px)',
              overflowY: 'auto',
              padding: '20px 14px 40px',
            }}
          >
            <div
              className="no-print"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '210mm',
                margin: '0 auto 12px',
                background: '#ffffff',
                borderRadius: '14px',
                padding: '10px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <strong style={{ color: '#0f172a', fontSize: '14px' }}>
                معاينة طباعة {singlePrintRec.requestCode} — {singlePrintRec.project_name}
              </strong>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() =>
                    printWithDocumentTitle({
                      docType:
                        singlePrintRec.recordKind === 'handover'
                          ? 'محضر_تسليم_واستلام_أعمال'
                          : 'ركوست_فحص_واستلام_هندسي',
                      prefix: singlePrintRec.requestCode,
                      subject: singlePrintRec.project_name,
                    })
                  }
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#ea580c',
                    color: '#fff',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  طباعة / حفظ PDF
                </button>
                <button
                  type="button"
                  onClick={() => setSinglePrintRec(null)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#f1f5f9',
                    color: '#334155',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  إغلاق
                </button>
              </div>
            </div>

            <style>{PHI_DOC_CSS}</style>
            <div
              onClick={(e) => e.stopPropagation()}
              className="phi-doc phi-doc-page"
              style={{
                maxWidth: '210mm',
                margin: '0 auto',
                background: '#ffffff',
                color: '#0f172a',
                padding: '12mm 14mm',
                borderRadius: '14px',
              }}
            >
              <ReportOfficialHeader
                title={
                  singlePrintRec.recordKind === 'handover'
                    ? `محضر تسليم واستلام أعمال رسمي (${singlePrintRec.requestCode})`
                    : `ركوست فحص واستلام هندسي (${singlePrintRec.requestCode})`
                }
                subtitle={`${singlePrintRec.requestCategory} • مربوط بمشروع ${singlePrintRec.project_name}`}
                refPrefix={singlePrintRec.requestCode}
                projectName={singlePrintRec.project_name}
                unitType={singlePrintRec.unit_type}
                clientName={singlePrintRec.client_name}
                engineerName={singlePrintRec.inspector_name}
                issueDate={singlePrintRec.visit_date}
                details={[
                  { label: 'رقم المستند', value: singlePrintRec.requestCode, accent: true },
                  { label: 'المشروع / الفيلا', value: singlePrintRec.project_name, accent: true },
                  { label: 'بند المقايسة (BOQ)', value: singlePrintRec.boq_item_name },
                  { label: 'أمر الشغل والمقاول', value: `${singlePrintRec.contractorName} (${singlePrintRec.jobOrderNumber})` },
                  { label: 'الكمية والإنجاز', value: `${singlePrintRec.approvedQty} / ${singlePrintRec.requestedQty} ${singlePrintRec.unit} (${singlePrintRec.completionPct}%)` },
                  { label: 'القرار الهندسي', value: singlePrintRec.approvalCode, accent: true },
                ]}
              />

              <DocStats
                items={[
                  { label: 'المرحلة الهندسية', value: singlePrintRec.stage },
                  { label: 'تاريخ التقديم', value: singlePrintRec.visit_date },
                  { label: 'تاريخ الاستلام / التسليم', value: singlePrintRec.handoverDate },
                  {
                    label: 'قرار الاعتماد الاستشاري',
                    value: singlePrintRec.approvalCode,
                    tone:
                      singlePrintRec.approvalCode === 'معتمد (Code A)'
                        ? 'positive'
                        : singlePrintRec.approvalCode === 'مرفوض / إعادة تسليم (Code C)'
                          ? 'discount'
                          : 'warn',
                  },
                ]}
              />

              <DocSection title="1. بيان الأعمال المقدمة للفحص والتسليم" en="Scope of Inspection & Handover" />
              <div
                style={{
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '12px',
                  fontSize: '11px',
                  lineHeight: 1.7,
                }}
              >
                <div>
                  <b>موضوع الركوست / التسليم:</b> {singlePrintRec.title}
                </div>
                <div>
                  <b>بند المقايسة المرتبط:</b> {singlePrintRec.boq_item_name} • <b>المخطط المرجعي:</b>{' '}
                  {singlePrintRec.drawing_title}
                </div>
                <div>
                  <b>المقاول المنفذ:</b> {singlePrintRec.contractorName} • <b>مهندس الموقع:</b>{' '}
                  {singlePrintRec.inspector_name} • <b>المهندس الاستشاري:</b> {singlePrintRec.consultantName}
                </div>
              </div>

              <DocSection title="2. قائمة فحص المطابقة الهندسية والجودة (QC Checklist)" en="Quality Inspection Checklist" />
              <table className="phi-doc-table" style={{ width: '100%', marginBottom: '14px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '10%' }}>م</th>
                    <th className="is-start">بند الفحص والمطابقة القياسية</th>
                    <th style={{ width: '22%' }}>حالة المطابقة</th>
                  </tr>
                </thead>
                <tbody>
                  {singlePrintRec.checklist.map((c, idx) => (
                    <tr key={c.id}>
                      <td>{idx + 1}</td>
                      <td className="is-start" style={{ fontWeight: 800 }}>{c.label}</td>
                      <td style={{ color: c.checked ? '#15803d' : '#b91c1c', fontWeight: 900 }}>
                        {c.checked ? '✓ مطابق للمواصفات' : '✗ يحتاج استيفاء'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <DocNote title="ملاحظات وتوصيات المهندس الاستشاري / لجنة الاستلام">
                {singlePrintRec.cleanNotes ||
                  'تمت معاينة الأعمال المذكورة أعلاه ميدانياً ومراجعتها طبقاً للمخططات التنفيذية المعتمدة وأصول الصناعة.'}
              </DocNote>

              <DocSignatures
                slots={[
                  { title: `المقاول / مهندس التنفيذ (${singlePrintRec.inspector_name})`, en: 'Site / Contractor Engineer' },
                  { title: `المهندس الاستشاري (${singlePrintRec.consultantName})`, en: 'Consultant / QC Inspector' },
                  { title: `مدير المشروع / ممثل المالك (${singlePrintRec.clientRepName})`, en: 'Project Manager / Client Rep' },
                ]}
              />

              <ReportContactFooter layout="minimal" style={{ marginTop: '14px' }} />
            </div>
          </div>,
          document.body
        )}

      {/* 7. مودال طباعة السجل الشامل للركوستات والتسليمات A4 Landscape */}
      {isRegisterPrintOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="print-modal-overlay"
            onClick={() => setIsRegisterPrintOpen(false)}
            dir="rtl"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999999,
              background: 'rgba(15, 23, 42, 0.78)',
              backdropFilter: 'blur(8px)',
              overflowY: 'auto',
              padding: '20px 14px 40px',
            }}
          >
            <div
              className="no-print"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '277mm',
                margin: '0 auto 12px',
                background: '#ffffff',
                borderRadius: '14px',
                padding: '10px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <strong style={{ color: '#0f172a', fontSize: '14px' }}>
                سجل الركوستات ومحاضر التسليمات الهندسية ({d.filteredRecords.length} مستند)
              </strong>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() =>
                    printWithDocumentTitle({
                      docType: 'سجل_الركوستات_والتسليمات_الهندسية',
                      prefix: 'WIR-LOG',
                      subject: lockedProjectName || 'جميع_المشاريع',
                    })
                  }
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#ea580c',
                    color: '#fff',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  طباعة السجل (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegisterPrintOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#f1f5f9',
                    color: '#334155',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  إغلاق
                </button>
              </div>
            </div>

            <style>{PHI_DOC_CSS}</style>
            <div
              onClick={(e) => e.stopPropagation()}
              className="phi-doc phi-doc-page"
              style={{
                maxWidth: '277mm',
                margin: '0 auto',
                background: '#ffffff',
                color: '#0f172a',
                padding: '10mm 12mm',
                borderRadius: '14px',
              }}
            >
              <ReportOfficialHeader
                title="السجل الرسمي للركوستات ومحاضر التسليمات الهندسية (WIR / MIR / Handover Log)"
                subtitle="بيان رقابي معتمد لطلبات فحص الأعمال والخامات ومحاضر التسليم الابتدائي والنهائي للمشاريع"
                refPrefix="WIR-LOG"
                issueDate={todayStr}
                compact
                details={[
                  { label: 'إجمالي المستندات', value: `${s.totalCount} مستند`, accent: true },
                  { label: 'ركوستات استلام', value: `${s.requestsCount} ركوست` },
                  { label: 'محاضر تسليم', value: `${s.handoversCount} محضر` },
                  { label: 'نسبة الاعتماد الهندسي', value: (s.totalCount || 0) === 0 ? 'لا توجد طلبات مقيّمة بعد' : `${s.firstTimeApprovalRate}%`, accent: true },
                ]}
              />

              <DocStats
                items={[
                  { label: 'إجمالي الركوستات والتسليمات', value: `${s.totalCount}`, highlight: true },
                  { label: 'معتمد بدون ملاحظات (Code A)', value: `${s.approvedACount}`, tone: 'positive' },
                  { label: 'معتمد بملاحظات (Code B)', value: `${s.approvedBCount}`, tone: 'warn' },
                  { label: 'تحت الفحص / مرفوض (Code C)', value: `${s.pendingCount} / ${s.rejectedCCount}`, tone: 'tax' },
                ]}
              />

              <DocSection title="سجل الركوستات ومحاضر التسليمات التفصيلي" en="Requests & Handovers Register" />
              <table className="phi-doc-table" style={{ width: '100%', fontSize: '9.5px' }}>
                <thead>
                  <tr>
                    <th>رقم المستند</th>
                    <th>النوع والتصنيف</th>
                    <th>المشروع</th>
                    <th className="is-start">الموضوع وبند المقايسة</th>
                    <th>المقاول وأمر الشغل</th>
                    <th>الكمية والإنجاز</th>
                    <th>مهندس الموقع / الاستشاري</th>
                    <th>التاريخ</th>
                    <th>القرار الهندسي</th>
                  </tr>
                </thead>
                <tbody>
                  {d.filteredRecords.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 900, color: '#c2410c' }}>{r.requestCode}</td>
                      <td>{r.requestCategory}</td>
                      <td style={{ fontWeight: 900 }}>{r.project_name}</td>
                      <td className="is-start">
                        <b>{r.title}</b>
                        <div style={{ fontSize: '8px', color: '#64748b' }}>بند: {r.boq_item_name}</div>
                      </td>
                      <td>
                        {r.contractorName}
                        {r.jobOrderNumber !== '---' ? ` (${r.jobOrderNumber})` : ''}
                      </td>
                      <td>
                        {r.approvedQty}/{r.requestedQty} {r.unit} ({r.completionPct}%)
                      </td>
                      <td>
                        {r.inspector_name} / {r.consultantName}
                      </td>
                      <td>{r.visit_date}</td>
                      <td
                        style={{
                          fontWeight: 900,
                          color:
                            r.approvalCode === 'معتمد (Code A)'
                              ? '#15803d'
                              : r.approvalCode === 'مرفوض / إعادة تسليم (Code C)'
                                ? '#b91c1c'
                                : '#b45309',
                        }}
                      >
                        {r.approvalCode}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <DocSignatures
                slots={[
                  { title: 'مهندس الجودة والاستلام (QC)', en: 'QC Engineer' },
                  { title: 'مدير إدارة المشروعات (PMO)', en: 'Projects Manager' },
                  { title: 'اعتماد الاستشاري / الإدارة العليا', en: 'Consultant / GM Approval' },
                ]}
              />
              <ReportContactFooter layout="minimal" style={{ marginTop: '12px' }} />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
