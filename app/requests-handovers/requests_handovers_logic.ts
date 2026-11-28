"use client";
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getActiveCompanyId, supabase } from '@/lib/supabase';
import { useCompany } from '@/lib/CompanyContext';
import { useToast } from '@/lib/toast-context';
import { fetchAllSupabaseData } from '@/lib/helpers';

export type RecordKind = 'request' | 'handover';

export type ApprovalDecisionCode =
  | 'تحت الفحص'
  | 'معتمد (Code A)'
  | 'معتمد بملاحظات (Code B)'
  | 'مرفوض / إعادة تسليم (Code C)';

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  note?: string;
}

export interface RequestHandoverMeta {
  isRequestHandover?: boolean;
  recordKind?: RecordKind;
  requestCode?: string;
  requestCategory?: string;
  approvalCode?: ApprovalDecisionCode;
  contractorId?: string | null;
  contractorName?: string | null;
  jobOrderId?: string | null;
  jobOrderNumber?: string | null;
  consultantName?: string | null;
  clientRepName?: string | null;
  requestedQty?: number;
  approvedQty?: number;
  unit?: string;
  completionPct?: number;
  handoverDate?: string | null;
  locationZone?: string | null;
  attachmentUrl?: string | null;
  checklist?: ChecklistItem[];
  videoUrl?: string | null;
  docUrl?: string | null;
  customDrawingUrl?: string | null;
  photoPins?: any[];
}

export interface EnrichedRequestHandover {
  id: string;
  company_id: string;
  project_id: string;
  project_name: string;
  project_code: string;
  unit_type: string;
  client_name: string;
  drawing_id: string | null;
  drawing_title: string;
  boq_id: string | null;
  boq_item_name: string;
  title: string;
  stage: string;
  visit_date: string;
  inspector_name: string;
  status: 'مفتوحة' | 'قيد المعالجة' | 'تم الإنجاز';
  photo_before_url: string | null;
  photo_after_url: string | null;
  created_at: string;
  cleanNotes: string;
  recordKind: RecordKind;
  requestCode: string;
  requestCategory: string;
  approvalCode: ApprovalDecisionCode;
  contractorId: string | null;
  contractorName: string;
  jobOrderId: string | null;
  jobOrderNumber: string;
  consultantName: string;
  clientRepName: string;
  requestedQty: number;
  approvedQty: number;
  unit: string;
  completionPct: number;
  handoverDate: string;
  locationZone: string;
  attachmentUrl: string | null;
  checklist: ChecklistItem[];
}

const VISIT_META_MARKER = '\n<!--VISIT_META_JSON:';

export const REQUEST_CATEGORIES = [
  'WIR — طلب استلام أعمال موقعية',
  'MIR — طلب فحص واعتماد خامات',
  'CPR — طلب تصريح صب خرسانة',
  'IR — ركوست فحص هندسي / جودة',
  'MEP — ركوست استلام تمديدات كهروميكانيك',
];

export const HANDOVER_CATEGORIES = [
  'محضر تسليم بند / مرحلة تنفيذية',
  'محضر تسليم أعمال مقاول باطن',
  'محضر تسليم ابتدائي للعميل',
  'محضر تسليم نهائي وإخلاء طرف',
];

export const CHECKLIST_PRESETS: Record<string, string[]> = {
  'خرسانة وإنشاءات': [
    'مطابقة الأبعاد والمناسيب للمخططات التنفيذية (Shop Drawings)',
    'فحص أقطار وعدد وتقسيط حديد التسليح وبسكويت الغطاء الخرساني',
    'فحص متانة الشدة الخشبية والتدعيم ونظافة القاع قبل الصب',
    'التأكد من تمديدات وفتحات الكهروميكانيك (Sleeves & Conduits)',
  ],
  'مباني وتشطيبات معمارية': [
    'استقامة الحوائط ورأسيتها والزوايا القائمة (القدّة والميزان)',
    'اعتماد عينات الخامات الموردة ومطابقتها للمواصفات (MIR)',
    'معالجة الفواصل والشروخ وتركيب شبك اللياسة والزوايا المعدنية',
    'نظافة الموقع وإزالة المخلفات بعد انتهاء البند',
  ],
  'كهروميكانيك (MEP)': [
    'فحص مسارات وأقطار المواسير والكابلات حسب المخطط المعتمد',
    'اختبار ضغط مواسير التغذية والصرف وعدم وجود أي تسريب',
    'فحص العزل المائي والحراري وتثبيت الحوامل (Supports)',
    'مطابقة مناسيب مخارج الكهرباء والتكييف والسباكة مع المعماري',
  ],
  'تسليم ابتدائي / نهائي للعميل': [
    'اكتمال جميع بنود المقايسة التعاقدية (BOQ) بنسبة 100%',
    'إنهاء كافة ملاحظات قائمة الفحص السابقة (Snag / Punch List)',
    'تجربة وتشغيل أنظمة الكهرباء والسباكة والتكييف والسمارت هوم',
    'تسليم المفاتيح ومخططات As-Built وشهادات الضمان للعميل',
  ],
};

export function parseVisitNotesAndMeta(rawNotes?: string | null): {
  cleanNotes: string;
  meta: RequestHandoverMeta;
} {
  if (!rawNotes) return { cleanNotes: '', meta: {} };
  const idx = rawNotes.indexOf(VISIT_META_MARKER);
  if (idx === -1) return { cleanNotes: rawNotes, meta: {} };
  const cleanNotes = rawNotes.slice(0, idx).trim();
  const jsonPart = rawNotes
    .slice(idx + VISIT_META_MARKER.length)
    .replace(/-->\s*$/, '')
    .trim();
  try {
    const parsed = JSON.parse(jsonPart);
    return {
      cleanNotes,
      meta: typeof parsed === 'object' && parsed !== null ? parsed : {},
    };
  } catch {
    return { cleanNotes: rawNotes, meta: {} };
  }
}

export function serializeVisitNotesWithMeta(cleanNotes: string, meta: RequestHandoverMeta): string {
  return `${(cleanNotes || '').trim()}${VISIT_META_MARKER}${JSON.stringify(meta)}-->`;
}

export function approvalCodeToDbStatus(code: ApprovalDecisionCode): 'مفتوحة' | 'قيد المعالجة' | 'تم الإنجاز' {
  if (code === 'معتمد (Code A)') return 'تم الإنجاز';
  if (code === 'معتمد بملاحظات (Code B)' || code === 'مرفوض / إعادة تسليم (Code C)') return 'قيد المعالجة';
  return 'مفتوحة';
}

export function dbStatusToDefaultApprovalCode(
  status?: string | null
): ApprovalDecisionCode {
  if (status === 'تم الإنجاز') return 'معتمد (Code A)';
  if (status === 'قيد المعالجة') return 'معتمد بملاحظات (Code B)';
  return 'تحت الفحص';
}

export function getPrefixForCategory(kind: RecordKind, category: string): string {
  if (kind === 'handover') return 'HND';
  if (category.startsWith('WIR')) return 'WIR';
  if (category.startsWith('MIR')) return 'MIR';
  if (category.startsWith('CPR')) return 'CPR';
  if (category.startsWith('MEP')) return 'MEP';
  return 'IR';
}

export function useRequestsHandoversLogic(lockedProjectId?: string) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { activeCompanyId: contextCompanyId } = useCompany();
  const activeCompanyId = contextCompanyId || getActiveCompanyId() || '72918f4d-10c3-43a0-884e-2f84f1224335';

  const [selectedProjectId, setSelectedProjectId] = useState<string>(lockedProjectId || 'all');
  const [kindFilter, setKindFilter] = useState<'all' | RecordKind>('all');
  const [decisionFilter, setDecisionFilter] = useState<'all' | ApprovalDecisionCode>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const effectiveProjectId = lockedProjectId || selectedProjectId;

  const { data: rawData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['project_requests_handovers_hub', activeCompanyId],
    queryFn: async () => {
      const [projects, boq_budget, job_orders, partners, project_drawings, project_site_visits] = await Promise.all([
        fetchAllSupabaseData(supabase, 'projects', '*', 'created_at', true),
        fetchAllSupabaseData(supabase, 'boq_budget', '*', 'created_at', true),
        fetchAllSupabaseData(supabase, 'job_orders', '*', 'created_at', false),
        fetchAllSupabaseData(supabase, 'partners', 'id,name,partner_type,phone,company_id', 'created_at', false),
        fetchAllSupabaseData(supabase, 'project_drawings', '*', 'created_at', false),
        fetchAllSupabaseData(supabase, 'project_site_visits', '*', 'visit_date', false),
      ]);

      const byCompany = (rows: any[]) =>
        (rows || []).filter(
          (r: any) => !r.company_id || !activeCompanyId || String(r.company_id) === String(activeCompanyId)
        );

      return {
        projects: byCompany(projects),
        boq_budget: byCompany(boq_budget),
        job_orders: byCompany(job_orders),
        partners: byCompany(partners),
        project_drawings: byCompany(project_drawings),
        project_site_visits: byCompany(project_site_visits),
      };
    },
    staleTime: 30 * 1000,
  });

  const enrichedData = useMemo(() => {
    if (!rawData) return null;

    const projectMap = new Map<string, any>();
    rawData.projects.forEach((p: any) => projectMap.set(String(p.id), p));

    const partnerMap = new Map<string, any>();
    rawData.partners.forEach((p: any) => partnerMap.set(String(p.id), p));

    const boqMap = new Map<string, any>();
    rawData.boq_budget.forEach((b: any) => boqMap.set(String(b.id), b));

    const drawingMap = new Map<string, any>();
    rawData.project_drawings.forEach((d: any) => drawingMap.set(String(d.id), d));

    const jobOrderMap = new Map<string, any>();
    rawData.job_orders.forEach((j: any) => jobOrderMap.set(String(j.id), j));

    const allRecords: EnrichedRequestHandover[] = (rawData.project_site_visits || []).map(
      (v: any, idx: number) => {
        const { cleanNotes, meta } = parseVisitNotesAndMeta(v.notes);
        const proj = projectMap.get(String(v.project_id)) || {};
        const boq = v.boq_id ? boqMap.get(String(v.boq_id)) : null;
        const drw = v.drawing_id ? drawingMap.get(String(v.drawing_id)) : null;
        const jo = meta.jobOrderId ? jobOrderMap.get(String(meta.jobOrderId)) : null;
        const clientObj = proj.client_id ? partnerMap.get(String(proj.client_id)) : null;

        const inferredKind: RecordKind =
          meta.recordKind ||
          (String(v.title || '').includes('تسليم') || String(meta.requestCategory || '').includes('تسليم')
            ? 'handover'
            : 'request');

        const category =
          meta.requestCategory ||
          (inferredKind === 'handover' ? 'محضر تسليم بند / مرحلة تنفيذية' : 'WIR — طلب استلام أعمال موقعية');

        const prefix = getPrefixForCategory(inferredKind, category);
        const year = String(v.visit_date || new Date().toISOString()).slice(0, 4) || '2026';
        const fallbackCode = `${prefix}-${year}-${String(rawData.project_site_visits.length - idx).padStart(4, '0')}`;

        const approvalCode: ApprovalDecisionCode =
          meta.approvalCode || dbStatusToDefaultApprovalCode(v.status);

        const contractorName =
          meta.contractorName ||
          (meta.contractorId ? partnerMap.get(String(meta.contractorId))?.name : '') ||
          (jo?.contractor_id ? partnerMap.get(String(jo.contractor_id))?.name : '') ||
          'تنفيذ ذاتي / الشركة';

        const defaultUnit = meta.unit || boq?.unit || 'مقطوعية';
        const defaultReqQty =
          meta.requestedQty !== undefined
            ? Number(meta.requestedQty)
            : Number(boq?.contract_quantity || jo?.assigned_qty || 1);
        const defaultAppQty =
          meta.approvedQty !== undefined
            ? Number(meta.approvedQty)
            : approvalCode === 'معتمد (Code A)'
              ? defaultReqQty
              : 0;

        return {
          id: String(v.id),
          company_id: String(v.company_id || activeCompanyId),
          project_id: String(v.project_id),
          project_name: proj.Property || proj.project_name || 'مشروع غير محدد',
          project_code: proj.project_code || '---',
          unit_type: proj.unit_type || '---',
          client_name: clientObj?.name || proj.client_name || 'بدون عميل محدد',
          drawing_id: v.drawing_id ? String(v.drawing_id) : null,
          drawing_title: drw ? `${drw.title} (${drw.version || 'Rev-01'})` : '---',
          boq_id: v.boq_id ? String(v.boq_id) : null,
          boq_item_name: v.boq_item_name || boq?.work_item || 'عام للمشروع',
          title: v.title || 'ركوست استلام أعمال',
          stage: v.stage || proj.current_stage || 'تنفيذ الأعمال',
          visit_date: v.visit_date || new Date().toISOString().split('T')[0],
          inspector_name: v.inspector_name || proj.engineer_in_charge || 'مهندس الموقع',
          status: v.status || 'مفتوحة',
          photo_before_url: v.photo_before_url || null,
          photo_after_url: v.photo_after_url || null,
          created_at: v.created_at,
          cleanNotes,
          recordKind: inferredKind,
          requestCode: meta.requestCode || fallbackCode,
          requestCategory: category,
          approvalCode,
          contractorId: meta.contractorId || (jo?.contractor_id ? String(jo.contractor_id) : null),
          contractorName,
          jobOrderId: meta.jobOrderId || null,
          jobOrderNumber: meta.jobOrderNumber || jo?.order_number || '---',
          consultantName: meta.consultantName || 'الاستشاري الهندسي المشرف',
          clientRepName: meta.clientRepName || clientObj?.name || 'ممثل المالك',
          requestedQty: defaultReqQty,
          approvedQty: defaultAppQty,
          unit: defaultUnit,
          completionPct:
            meta.completionPct !== undefined
              ? Number(meta.completionPct)
              : approvalCode === 'معتمد (Code A)'
                ? 100
                : Number(boq?.completed_percentage || 0),
          handoverDate: meta.handoverDate || v.visit_date || new Date().toISOString().split('T')[0],
          locationZone: meta.locationZone || proj.location_address || 'الموقع العام',
          attachmentUrl: meta.attachmentUrl || meta.docUrl || null,
          checklist: Array.isArray(meta.checklist) ? meta.checklist : [],
        };
      }
    );

    const filteredRecords = allRecords.filter((rec) => {
      if (effectiveProjectId !== 'all' && String(rec.project_id) !== String(effectiveProjectId)) {
        return false;
      }
      if (kindFilter !== 'all' && rec.recordKind !== kindFilter) {
        return false;
      }
      if (decisionFilter !== 'all' && rec.approvalCode !== decisionFilter) {
        return false;
      }
      if (dateRange.start && rec.visit_date < dateRange.start) {
        return false;
      }
      if (dateRange.end && rec.visit_date > dateRange.end) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = [
          rec.requestCode,
          rec.title,
          rec.project_name,
          rec.boq_item_name,
          rec.contractorName,
          rec.inspector_name,
          rec.consultantName,
          rec.requestCategory,
          rec.jobOrderNumber,
          rec.cleanNotes,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const totalCount = filteredRecords.length;
    const requestsCount = filteredRecords.filter((r) => r.recordKind === 'request').length;
    const handoversCount = filteredRecords.filter((r) => r.recordKind === 'handover').length;
    const approvedACount = filteredRecords.filter((r) => r.approvalCode === 'معتمد (Code A)').length;
    const approvedBCount = filteredRecords.filter((r) => r.approvalCode === 'معتمد بملاحظات (Code B)').length;
    const rejectedCCount = filteredRecords.filter((r) => r.approvalCode === 'مرفوض / إعادة تسليم (Code C)').length;
    const pendingCount = filteredRecords.filter((r) => r.approvalCode === 'تحت الفحص').length;
    const decidedCount = approvedACount + approvedBCount + rejectedCCount;
    const firstTimeApprovalRate =
      decidedCount > 0 ? Math.round(((approvedACount + approvedBCount) / decidedCount) * 100) : 100;

    // إحصائيات لكل مشروع
    const projectStats = rawData.projects.map((p: any) => {
      const pid = String(p.id);
      const pRecs = allRecords.filter((r) => r.project_id === pid);
      const pReqs = pRecs.filter((r) => r.recordKind === 'request').length;
      const pHands = pRecs.filter((r) => r.recordKind === 'handover').length;
      const pApproved = pRecs.filter(
        (r) => r.approvalCode === 'معتمد (Code A)' || r.approvalCode === 'معتمد بملاحظات (Code B)'
      ).length;
      const pPending = pRecs.filter((r) => r.approvalCode === 'تحت الفحص').length;
      return {
        id: pid,
        name: p.Property || p.project_name || 'مشروع',
        stage: p.current_stage || '---',
        status: p.status || 'قيد التنفيذ',
        total: pRecs.length,
        requests: pReqs,
        handovers: pHands,
        approved: pApproved,
        pending: pPending,
      };
    });

    return {
      projects: rawData.projects,
      boqItems: rawData.boq_budget,
      jobOrders: rawData.job_orders,
      partners: rawData.partners,
      drawings: rawData.project_drawings,
      allRecords,
      filteredRecords,
      projectStats,
      stats: {
        totalCount,
        requestsCount,
        handoversCount,
        approvedACount,
        approvedBCount,
        rejectedCCount,
        pendingCount,
        firstTimeApprovalRate,
      },
    };
  }, [
    rawData,
    activeCompanyId,
    effectiveProjectId,
    kindFilter,
    decisionFilter,
    dateRange.start,
    dateRange.end,
    searchQuery,
  ]);

  const generateNextCode = (kind: RecordKind, category: string) => {
    const prefix = getPrefixForCategory(kind, category);
    const year = new Date().getFullYear();
    const existingCount = (enrichedData?.allRecords || []).filter((r) =>
      r.requestCode.startsWith(`${prefix}-`)
    ).length;
    return `${prefix}-${year}-${String(existingCount + 1).padStart(4, '0')}`;
  };

  const saveRecord = async (
    payload: {
      id?: string;
      project_id: string;
      boq_id?: string | null;
      drawing_id?: string | null;
      jobOrderId?: string | null;
      recordKind: RecordKind;
      requestCode?: string;
      requestCategory: string;
      title: string;
      stage: string;
      visit_date: string;
      handoverDate?: string;
      inspector_name: string;
      consultantName: string;
      clientRepName: string;
      contractorId?: string | null;
      contractorName?: string;
      requestedQty: number;
      approvedQty: number;
      unit: string;
      completionPct: number;
      locationZone?: string;
      approvalCode: ApprovalDecisionCode;
      cleanNotes: string;
      photo_before_url?: string | null;
      photo_after_url?: string | null;
      attachmentUrl?: string | null;
      checklist: ChecklistItem[];
      syncProjectAndBoqProgress?: boolean;
    }
  ) => {
    if (!payload.project_id) {
      showToast('يرجى اختيار المشروع أولاً', 'error');
      return false;
    }
    if (!payload.title.trim()) {
      showToast('يرجى إدخال عنوان الركوست أو محضر التسليم', 'error');
      return false;
    }

    setIsSaving(true);
    try {
      const boqItem = (rawData?.boq_budget || []).find((b: any) => String(b.id) === String(payload.boq_id));
      const joItem = (rawData?.job_orders || []).find((j: any) => String(j.id) === String(payload.jobOrderId));
      const contractorObj = (rawData?.partners || []).find(
        (p: any) => String(p.id) === String(payload.contractorId)
      );

      const finalCode =
        payload.requestCode?.trim() || generateNextCode(payload.recordKind, payload.requestCategory);

      const meta: RequestHandoverMeta = {
        isRequestHandover: true,
        recordKind: payload.recordKind,
        requestCode: finalCode,
        requestCategory: payload.requestCategory,
        approvalCode: payload.approvalCode,
        contractorId: payload.contractorId || null,
        contractorName: payload.contractorName || contractorObj?.name || 'تنفيذ ذاتي / الشركة',
        jobOrderId: payload.jobOrderId || null,
        jobOrderNumber: joItem?.order_number || null,
        consultantName: payload.consultantName || 'الاستشاري الهندسي المشرف',
        clientRepName: payload.clientRepName || 'ممثل المالك',
        requestedQty: Number(payload.requestedQty) || 0,
        approvedQty: Number(payload.approvedQty) || 0,
        unit: payload.unit || boqItem?.unit || 'مقطوعية',
        completionPct: Math.min(100, Math.max(0, Number(payload.completionPct) || 0)),
        handoverDate: payload.handoverDate || payload.visit_date,
        locationZone: payload.locationZone || '',
        attachmentUrl: payload.attachmentUrl || null,
        docUrl: payload.attachmentUrl || null,
        checklist: payload.checklist || [],
      };

      const dbStatus = approvalCodeToDbStatus(payload.approvalCode);
      const serializedNotes = serializeVisitNotesWithMeta(payload.cleanNotes, meta);

      const dbRow: any = {
        project_id: payload.project_id,
        boq_id: payload.boq_id || null,
        boq_item_name: boqItem?.work_item || null,
        drawing_id: payload.drawing_id || null,
        title: payload.title.trim(),
        stage: payload.stage.trim() || 'تنفيذ الأعمال',
        visit_date: payload.visit_date,
        inspector_name: payload.inspector_name.trim() || 'مهندس الموقع',
        notes: serializedNotes,
        status: dbStatus,
        photo_before_url: payload.photo_before_url || null,
        photo_after_url: payload.photo_after_url || null,
        pin_color:
          payload.approvalCode === 'معتمد (Code A)'
            ? '#10b981'
            : payload.approvalCode === 'معتمد بملاحظات (Code B)'
              ? '#f59e0b'
              : payload.approvalCode === 'مرفوض / إعادة تسليم (Code C)'
                ? '#ef4444'
                : '#0ea5e9',
      };

      if (payload.id) {
        const { error } = await supabase
          .from('project_site_visits')
          .update({ ...dbRow, updated_at: new Date().toISOString() })
          .eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('project_site_visits')
          .insert([{ ...dbRow, company_id: activeCompanyId }]);
        if (error) throw error;
      }

      // تحديث بند المقايسة أو مرحلة المشروع عند اعتماد التسليم
      if (
        payload.syncProjectAndBoqProgress &&
        (payload.approvalCode === 'معتمد (Code A)' || payload.approvalCode === 'معتمد بملاحظات (Code B)')
      ) {
        if (payload.boq_id) {
          await supabase
            .from('boq_budget')
            .update({
              completed_percentage: Math.min(100, Math.max(0, Number(payload.completionPct) || 100)),
              execution_status:
                Number(payload.completionPct) >= 100 ? 'مكتمل' : 'قيد التنفيذ',
            })
            .eq('id', payload.boq_id);
        }
        if (payload.recordKind === 'handover') {
          const projectUpdate: any = {
            current_stage: payload.stage || undefined,
          };
          if (payload.requestCategory.includes('ابتدائي') || payload.requestCategory.includes('نهائي')) {
            projectUpdate.handover_date = payload.handoverDate || payload.visit_date;
            if (payload.requestCategory.includes('نهائي')) {
              projectUpdate.status = 'مكتمل';
            }
          }
          await supabase.from('projects').update(projectUpdate).eq('id', payload.project_id);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['project_requests_handovers_hub'] });
      await queryClient.invalidateQueries({ queryKey: ['project_site_visits'] });
      showToast(
        payload.id
          ? 'تم تحديث بيانات الركوست / محضر التسليم بنجاح'
          : `تم تسجيل (${finalCode}) وربطه بالمشروع بنجاح`,
        'success'
      );
      return true;
    } catch (err: any) {
      showToast(`خطأ أثناء الحفظ: ${err.message || 'تعذر الحفظ'}`, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const quickUpdateDecision = async (rec: EnrichedRequestHandover, newDecision: ApprovalDecisionCode) => {
    setIsSaving(true);
    try {
      const { cleanNotes, meta } = parseVisitNotesAndMeta(
        (rawData?.project_site_visits || []).find((v: any) => String(v.id) === rec.id)?.notes
      );
      const updatedMeta: RequestHandoverMeta = {
        ...meta,
        isRequestHandover: true,
        recordKind: rec.recordKind,
        requestCode: rec.requestCode,
        requestCategory: rec.requestCategory,
        approvalCode: newDecision,
        approvedQty:
          newDecision === 'معتمد (Code A)' ? rec.requestedQty : rec.approvedQty,
        completionPct:
          newDecision === 'معتمد (Code A)' ? 100 : rec.completionPct,
      };
      const dbStatus = approvalCodeToDbStatus(newDecision);
      const { error } = await supabase
        .from('project_site_visits')
        .update({
          status: dbStatus,
          notes: serializeVisitNotesWithMeta(cleanNotes, updatedMeta),
          pin_color:
            newDecision === 'معتمد (Code A)'
              ? '#10b981'
              : newDecision === 'معتمد بملاحظات (Code B)'
                ? '#f59e0b'
                : newDecision === 'مرفوض / إعادة تسليم (Code C)'
                  ? '#ef4444'
                  : '#0ea5e9',
          updated_at: new Date().toISOString(),
        })
        .eq('id', rec.id);

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['project_requests_handovers_hub'] });
      await queryClient.invalidateQueries({ queryKey: ['project_site_visits'] });
      showToast(`تم تحديث القرار الهندسي لـ (${rec.requestCode}) إلى: ${newDecision}`, 'success');
    } catch (err: any) {
      showToast(`تعذر تحديث الحالة: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRecord = async (id: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('project_site_visits').delete().eq('id', id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['project_requests_handovers_hub'] });
      await queryClient.invalidateQueries({ queryKey: ['project_site_visits'] });
      showToast('تم حذف الركوست / المحضر بنجاح', 'success');
    } catch (err: any) {
      showToast(`فشل الحذف: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const resetFilters = () => {
    if (!lockedProjectId) setSelectedProjectId('all');
    setKindFilter('all');
    setDecisionFilter('all');
    setSearchQuery('');
    setDateRange({ start: '', end: '' });
  };

  return {
    data: enrichedData,
    isLoading: isLoading || isRefetching,
    isSaving,
    selectedProjectId: effectiveProjectId,
    setSelectedProjectId,
    kindFilter,
    setKindFilter,
    decisionFilter,
    setDecisionFilter,
    searchQuery,
    setSearchQuery,
    dateRange,
    setDateRange,
    resetFilters,
    refetch,
    generateNextCode,
    saveRecord,
    quickUpdateDecision,
    deleteRecord,
  };
}
