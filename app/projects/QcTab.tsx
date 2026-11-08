'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  CheckCircle2,
  Clock,
  Compass,
  Download,
  Eye,
  FileText,
  Filter,
  Image as ImageIcon,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  RefreshCw,
  Sliders,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notify';
import TelegramAttachmentField, {
  AttachmentViewButton,
} from '@/components/TelegramAttachmentField';
import styles from './QcTab.module.css';

export interface ProjectDrawing {
  id: string;
  company_id: string;
  project_id: string;
  title: string;
  drawing_type: string;
  version: string;
  drawing_url: string;
  file_name?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface VisitPhotoPin {
  id: string;
  pinNumber: number;
  x: number;
  y: number;
  label: string;
  photoUrl?: string | null;
  videoUrl?: string | null;
}

export interface VisitExtendedMeta {
  videoUrl?: string | null;
  docUrl?: string | null;
  customDrawingUrl?: string | null;
  photoPins?: VisitPhotoPin[];
}

const VISIT_META_MARKER = '\n<!--VISIT_META_JSON:';

function parseVisitNotesAndMeta(rawNotes?: string | null): { cleanNotes: string; meta: VisitExtendedMeta } {
  if (!rawNotes) return { cleanNotes: '', meta: { photoPins: [] } };
  const idx = rawNotes.indexOf(VISIT_META_MARKER);
  if (idx === -1) return { cleanNotes: rawNotes, meta: { photoPins: [] } };
  const cleanNotes = rawNotes.slice(0, idx).trim();
  const jsonPart = rawNotes.slice(idx + VISIT_META_MARKER.length).replace(/-->\s*$/, '').trim();
  try {
    const parsed = JSON.parse(jsonPart);
    return {
      cleanNotes,
      meta: {
        videoUrl: parsed?.videoUrl || null,
        docUrl: parsed?.docUrl || null,
        customDrawingUrl: parsed?.customDrawingUrl || null,
        photoPins: Array.isArray(parsed?.photoPins) ? parsed.photoPins : [],
      },
    };
  } catch {
    return { cleanNotes, meta: { photoPins: [] } };
  }
}

function serializeVisitNotesWithMeta(cleanNotes: string, meta: VisitExtendedMeta): string {
  const hasMeta =
    Boolean(meta.videoUrl) ||
    Boolean(meta.docUrl) ||
    Boolean(meta.customDrawingUrl) ||
    (Array.isArray(meta.photoPins) && meta.photoPins.length > 0);
  if (!hasMeta) return cleanNotes.trim();
  return `${cleanNotes.trim()}${VISIT_META_MARKER}${JSON.stringify(meta)}-->`;
}

export interface ProjectSiteVisit {
  id: string;
  company_id: string;
  project_id: string;
  drawing_id?: string | null;
  boq_id?: string | null;
  title: string;
  stage?: string | null;
  visit_date: string;
  inspector_name?: string | null;
  notes?: string | null;
  status: 'مفتوحة' | 'قيد المعالجة' | 'تم الإنجاز';
  photo_before_url?: string | null;
  photo_after_url?: string | null;
  pin_x?: number | null;
  pin_y?: number | null;
  pin_color?: string | null;
  geo_lat?: number | null;
  geo_lng?: number | null;
  geo_location_name?: string | null;
  boq_item_name?: string | null;
  captured_at?: string | null;
  created_at: string;
}

export default function QcTab({ logic }: { logic: any }) {
  const queryClient = useQueryClient();
  const project = logic?.selectedProject;
  const projectId = project?.id;

  // Zoom & Pan state for Blueprint Viewer
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const drawingImgRef = useRef<HTMLImageElement | null>(null);

  // Drawing selection
  const [activeDrawingId, setActiveDrawingId] = useState<string | null>(null);

  // Modals state
  const [showAddDrawingModal, setShowAddDrawingModal] = useState<boolean>(false);
  const [showVisitModal, setShowVisitModal] = useState<boolean>(false);
  const [editingVisit, setEditingVisit] = useState<ProjectSiteVisit | null>(null);
  const [comparisonVisit, setComparisonVisit] = useState<ProjectSiteVisit | null>(null);
  const [sliderPos, setSliderPos] = useState<number>(50); // percentage 0 - 100

  // Filter state for site visits
  const [statusFilter, setStatusFilter] = useState<'الكل' | 'مفتوحة' | 'قيد المعالجة' | 'تم الإنجاز'>('الكل');

  // Drawing Form State
  const [drawingTitle, setDrawingTitle] = useState('');
  const [drawingType, setDrawingType] = useState('معماري');
  const [drawingVersion, setDrawingVersion] = useState('Rev-01');
  const [drawingNotes, setDrawingNotes] = useState('');
  const [drawingUrl, setDrawingUrl] = useState<string | null>(null);
  const [isSubmittingDrawing, setIsSubmittingDrawing] = useState(false);

  // Visit Form State
  const [visitTitle, setVisitTitle] = useState('');
  const [visitStage, setVisitStage] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [visitInspector, setVisitInspector] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [visitStatus, setVisitStatus] = useState<'مفتوحة' | 'قيد المعالجة' | 'تم الإنجاز'>('مفتوحة');
  const [visitPhotoBefore, setVisitPhotoBefore] = useState<string | null>(null);
  const [visitPhotoAfter, setVisitPhotoAfter] = useState<string | null>(null);
  const [visitDrawingId, setVisitDrawingId] = useState<string | null>(null);
  const [visitPinX, setVisitPinX] = useState<number | null>(null);
  const [visitPinY, setVisitPinY] = useState<number | null>(null);
  const [visitVideoUrl, setVisitVideoUrl] = useState<string | null>(null);
  const [visitDocUrl, setVisitDocUrl] = useState<string | null>(null);
  const [visitCustomDrawingUrl, setVisitCustomDrawingUrl] = useState<string | null>(null);
  const [visitPhotoPins, setVisitPhotoPins] = useState<VisitPhotoPin[]>([]);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const modalDrawingImgRef = useRef<HTMLImageElement | null>(null);
  const [isSubmittingVisit, setIsSubmittingVisit] = useState(false);

  // 1. Fetch Drawings
  const {
    data: drawings = [],
    isLoading: isLoadingDrawings,
    refetch: refetchDrawings,
  } = useQuery({
    queryKey: ['project_drawings', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_drawings')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching drawings:', error);
        throw error;
      }
      return (data || []) as ProjectDrawing[];
    },
    enabled: Boolean(projectId),
  });

  // 2. Fetch Site Visits
  const {
    data: visits = [],
    isLoading: isLoadingVisits,
    refetch: refetchVisits,
  } = useQuery({
    queryKey: ['project_site_visits', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_site_visits')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching visits:', error);
        throw error;
      }
      return (data || []) as ProjectSiteVisit[];
    },
    enabled: Boolean(projectId),
  });

  // Automatically select the first drawing if none selected
  useEffect(() => {
    if (drawings.length > 0 && !activeDrawingId) {
      setActiveDrawingId(drawings[0].id);
    }
  }, [drawings, activeDrawingId]);

  // Realtime updates
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`qc_realtime_${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_drawings', filter: `project_id=eq.${projectId}` },
        () => {
          void refetchDrawings();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_site_visits', filter: `project_id=eq.${projectId}` },
        () => {
          void refetchVisits();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, refetchDrawings, refetchVisits]);

  const activeDrawing = useMemo(
    () => drawings.find((d) => d.id === activeDrawingId) || drawings[0] || null,
    [drawings, activeDrawingId]
  );

  // Pinned visits on the currently active drawing
  const pinnedVisits = useMemo(() => {
    if (!activeDrawing) return [];
    return visits.filter(
      (v) => v.drawing_id === activeDrawing.id && v.pin_x !== null && v.pin_y !== null
    );
  }, [visits, activeDrawing]);

  // Filtered visits for list/cards
  const filteredVisits = useMemo(() => {
    if (statusFilter === 'الكل') return visits;
    return visits.filter((v) => v.status === statusFilter);
  }, [visits, statusFilter]);

  // Click on drawing to place a new observation pin
  const handleDrawingClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeDrawing || !drawingImgRef.current) return;
    const rect = drawingImgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (clickX < 0 || clickY < 0 || clickX > rect.width || clickY > rect.height) {
      return;
    }

    const pctX = Math.round(((clickX / rect.width) * 100) * 100) / 100;
    const pctY = Math.round(((clickY / rect.height) * 100) * 100) / 100;

    // Open visit modal pinned at this location
    openNewVisitModal(activeDrawing.id, pctX, pctY);
  };

  // Open modal for new visit
  const openNewVisitModal = (drawingId?: string | null, pinX?: number | null, pinY?: number | null) => {
    setEditingVisit(null);
    setVisitTitle('');
    setVisitStage('');
    setVisitDate(new Date().toISOString().split('T')[0]);
    setVisitInspector('');
    setVisitNotes('');
    setVisitStatus('مفتوحة');
    setVisitPhotoBefore(null);
    setVisitPhotoAfter(null);
    setVisitVideoUrl(null);
    setVisitDocUrl(null);
    setVisitCustomDrawingUrl(null);
    setVisitDrawingId(drawingId ?? activeDrawing?.id ?? null);
    setVisitPinX(pinX ?? null);
    setVisitPinY(pinY ?? null);
    if (pinX != null && pinY != null) {
      const firstPin: VisitPhotoPin = {
        id: 'pin-' + Date.now(),
        pinNumber: 1,
        x: pinX,
        y: pinY,
        label: 'نقطة فحص #1',
        photoUrl: null,
        videoUrl: null,
      };
      setVisitPhotoPins([firstPin]);
      setSelectedPinId(firstPin.id);
    } else {
      setVisitPhotoPins([]);
      setSelectedPinId(null);
    }
    setShowVisitModal(true);
  };

  // Open modal to edit existing visit
  const openEditVisitModal = (visit: ProjectSiteVisit) => {
    const { cleanNotes, meta } = parseVisitNotesAndMeta(visit.notes);
    setEditingVisit(visit);
    setVisitTitle(visit.title);
    setVisitStage(visit.stage || visit.boq_item_name || '');
    setVisitDate(visit.visit_date);
    setVisitInspector(visit.inspector_name || '');
    setVisitNotes(cleanNotes);
    setVisitStatus(visit.status);
    setVisitPhotoBefore(visit.photo_before_url || null);
    setVisitPhotoAfter(visit.photo_after_url || null);
    setVisitVideoUrl(meta.videoUrl || null);
    setVisitDocUrl(meta.docUrl || null);
    setVisitCustomDrawingUrl(meta.customDrawingUrl || null);
    setVisitDrawingId(visit.drawing_id || activeDrawing?.id || null);
    setVisitPinX(visit.pin_x ?? null);
    setVisitPinY(visit.pin_y ?? null);

    let pins = Array.isArray(meta.photoPins) ? meta.photoPins : [];
    if (pins.length === 0 && visit.pin_x != null && visit.pin_y != null) {
      pins = [
        {
          id: 'pin-main',
          pinNumber: 1,
          x: Number(visit.pin_x),
          y: Number(visit.pin_y),
          label: visit.title || 'نقطة فحص #1',
          photoUrl: visit.photo_before_url || null,
          videoUrl: meta.videoUrl || null,
        },
      ];
    }
    setVisitPhotoPins(pins);
    setSelectedPinId(pins[0]?.id || null);
    setShowVisitModal(true);
  };

  // النقر على مخطط الشوب دروينج داخل نافذة الزيارة لإضافة نقطة صورة/فيديو جديدة
  const handleModalDrawingClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!modalDrawingImgRef.current) return;
    const rect = modalDrawingImgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    if (clickX < 0 || clickY < 0 || clickX > rect.width || clickY > rect.height) return;

    const pctX = Math.round(((clickX / rect.width) * 100) * 100) / 100;
    const pctY = Math.round(((clickY / rect.height) * 100) * 100) / 100;

    const nextNum = visitPhotoPins.length + 1;
    const newPin: VisitPhotoPin = {
      id: 'pin-' + Date.now() + '-' + nextNum,
      pinNumber: nextNum,
      x: pctX,
      y: pctY,
      label: `نقطة تصوير #${nextNum}`,
      photoUrl: null,
      videoUrl: null,
    };
    const updated = [...visitPhotoPins, newPin];
    setVisitPhotoPins(updated);
    setSelectedPinId(newPin.id);
    if (visitPinX === null || visitPinY === null) {
      setVisitPinX(pctX);
      setVisitPinY(pctY);
    }
  };

  // Save Site Visit (Insert / Update)
  const handleSaveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitTitle.trim()) {
      notify('يرجى كتابة عنوان الملاحظة أو الفحص', 'warning');
      return;
    }

    setIsSubmittingVisit(true);
    try {
      const primaryPin = visitPhotoPins[0];
      const finalPinX = visitPinX !== null ? Number(visitPinX) : primaryPin ? Number(primaryPin.x) : null;
      const finalPinY = visitPinY !== null ? Number(visitPinY) : primaryPin ? Number(primaryPin.y) : null;
      const finalPhotoBefore = visitPhotoBefore || primaryPin?.photoUrl || null;
      const combinedNotes = serializeVisitNotesWithMeta(visitNotes, {
        videoUrl: visitVideoUrl,
        docUrl: visitDocUrl,
        customDrawingUrl: visitCustomDrawingUrl,
        photoPins: visitPhotoPins,
      });

      const payload: Partial<ProjectSiteVisit> = {
        project_id: projectId,
        drawing_id: visitDrawingId || null,
        title: visitTitle.trim(),
        stage: visitStage.trim() || null,
        boq_item_name: visitStage.trim() || null,
        visit_date: visitDate,
        inspector_name: visitInspector.trim() || null,
        notes: combinedNotes || null,
        status: visitStatus,
        photo_before_url: finalPhotoBefore,
        photo_after_url: visitPhotoAfter || null,
        pin_x: finalPinX,
        pin_y: finalPinY,
      };

      if (editingVisit) {
        const { error } = await supabase
          .from('project_site_visits')
          .update(payload)
          .eq('id', editingVisit.id);
        if (error) throw error;
        notify('تم تحديث ملاحظة الزيارة الميدانية بنجاح', 'success');
      } else {
        const { error } = await supabase.from('project_site_visits').insert([payload]);
        if (error) throw error;
        notify('تم تسجيل وتثبيت ملاحظة الزيارة الميدانية على المخطط بنجاح', 'success');
      }

      setShowVisitModal(false);
      await refetchVisits();
    } catch (err: any) {
      notify(err.message || 'فشل حفظ الزيارة الميدانية', 'error');
    } finally {
      setIsSubmittingVisit(false);
    }
  };

  // Delete Visit
  const handleDeleteVisit = async (visit: ProjectSiteVisit) => {
    if (!confirm(`هل أنت متأكد من حذف الملاحظة "${visit.title}"؟`)) return;
    try {
      const { error } = await supabase.from('project_site_visits').delete().eq('id', visit.id);
      if (error) throw error;
      notify('تم حذف الملاحظة بنجاح', 'success');
      await refetchVisits();
    } catch (err: any) {
      notify(err.message || 'فشل حذف الملاحظة', 'error');
    }
  };

  // Quick Status Toggle
  const handleQuickStatusChange = async (visit: ProjectSiteVisit, newStatus: 'مفتوحة' | 'قيد المعالجة' | 'تم الإنجاز') => {
    try {
      const { error } = await supabase
        .from('project_site_visits')
        .update({ status: newStatus })
        .eq('id', visit.id);
      if (error) throw error;
      notify(`تم تحديث حالة الملاحظة إلى: ${newStatus}`, 'success');
      await refetchVisits();
    } catch (err: any) {
      notify(err.message || 'فشل تحديث الحالة', 'error');
    }
  };

  // Save Shop Drawing
  const handleSaveDrawing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawingTitle.trim()) {
      notify('يرجى كتابة عنوان المخطط التنفيذي', 'warning');
      return;
    }
    if (!drawingUrl) {
      notify('يرجى إرفاق ملف أو صورة المخطط الشوب دروينج', 'warning');
      return;
    }

    setIsSubmittingDrawing(true);
    try {
      const payload: Partial<ProjectDrawing> = {
        project_id: projectId,
        title: drawingTitle.trim(),
        drawing_type: drawingType,
        version: drawingVersion.trim() || 'Rev-01',
        drawing_url: drawingUrl,
        notes: drawingNotes.trim() || null,
      };

      const { data, error } = await supabase
        .from('project_drawings')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;

      notify('تم رفع واعتماد مخطط الشوب دروينج بنجاح', 'success');
      setShowAddDrawingModal(false);
      setDrawingTitle('');
      setDrawingNotes('');
      setDrawingUrl(null);
      await refetchDrawings();
      if (data?.id) setActiveDrawingId(data.id);
    } catch (err: any) {
      notify(err.message || 'فشل حفظ مخطط الشوب دروينج', 'error');
    } finally {
      setIsSubmittingDrawing(false);
    }
  };

  // Delete Drawing
  const handleDeleteDrawing = async (drawing: ProjectDrawing) => {
    if (!confirm(`هل أنت متأكد من حذف المخطط "${drawing.title}"؟ سيتم فك ارتباط أي ملاحظات مثبتة عليه.`)) return;
    try {
      const { error } = await supabase.from('project_drawings').delete().eq('id', drawing.id);
      if (error) throw error;
      notify('تم حذف المخطط بنجاح', 'success');
      await refetchDrawings();
    } catch (err: any) {
      notify(err.message || 'فشل حذف المخطط', 'error');
    }
  };

  // Open Before/After Comparison
  const handleOpenComparison = (visit: ProjectSiteVisit) => {
    setComparisonVisit(visit);
    setSliderPos(50);
  };

  // Split Slider Drag handler
  const handleSliderMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = clientX - box.left;
    const pct = Math.max(0, Math.min(100, (x / box.width) * 100));
    setSliderPos(Math.round(pct));
  };

  const openCount = visits.filter((v) => v.status === 'مفتوحة').length;
  const inProgressCount = visits.filter((v) => v.status === 'قيد المعالجة').length;
  const resolvedCount = visits.filter((v) => v.status === 'تم الإنجاز').length;

  return (
    <div className={styles.container}>
      {/* ========================================================================= */}
      {/* 1. SHOP DRAWINGS MANAGER & SELECTOR                                      */}
      {/* ========================================================================= */}
      <div className={styles.drawingsHub}>
        <div className={styles.drawingsHeader}>
          <div className={styles.drawingsHeaderTitle}>
            <Layers size={20} color="#0284c7" />
            <span>مخططات الشوب دروينج التنفيذية (Shop Drawings)</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>
              ({drawings.length} مخطط معتمد)
            </span>
          </div>
          <div className={styles.drawingsHeaderActions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setShowAddDrawingModal(true)}
            >
              <Plus size={15} />
              <span>رفع مخطط تنفيذي جديد</span>
            </button>
          </div>
        </div>

        {drawings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
            <Layers size={36} style={{ color: '#cbd5e1', marginBottom: '0.5rem' }} />
            <p style={{ margin: '0 0 0.5rem', fontWeight: 800 }}>
              لا توجد مخططات شوب دروينج مرفوعة لهذا المشروع حتى الآن
            </p>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 1rem' }}>
              ارفع مخططات الأدوار، الواجهات، أو المخططات الإنشائية لإسقاط صور وملاحظات الزيارات الميدانية عليها كعلامات تفاعلية.
            </p>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setShowAddDrawingModal(true)}
            >
              <Plus size={15} />
              <span>رفع أول مخطط شوب دروينج</span>
            </button>
          </div>
        ) : (
          <div className={styles.drawingsStrip}>
            {drawings.map((d) => {
              const pinsOnThis = visits.filter((v) => v.drawing_id === d.id).length;
              const isActive = d.id === activeDrawing?.id;
              return (
                <div
                  key={d.id}
                  className={`${styles.drawingCard} ${isActive ? styles.active : ''}`}
                  onClick={() => {
                    setActiveDrawingId(d.id);
                    setZoomLevel(1);
                  }}
                >
                  <div className={styles.drawingCardTop}>
                    <span className={styles.drawingTypeTag}>{d.drawing_type}</span>
                    <span className={styles.drawingVersion}>{d.version}</span>
                  </div>
                  <div className={styles.drawingTitle} title={d.title}>
                    {d.title}
                  </div>
                  <div className={styles.drawingMeta}>
                    <span className={styles.pinCountBadge}>
                      <MapPin size={12} />
                      <span>{pinsOnThis} ملاحظة مثبتة</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteDrawing(d);
                      }}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                      title="حذف المخطط"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. INTERACTIVE BLUEPRINT VIEWER WITH PINS                                 */}
      {/* ========================================================================= */}
      {activeDrawing && (
        <div className={styles.viewerBox}>
          <div className={styles.viewerToolbar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Compass size={17} color="#38bdf8" />
              <strong style={{ fontSize: '0.9rem' }}>{activeDrawing.title}</strong>
              <span className={styles.drawingVersion}>{activeDrawing.version}</span>
              <AttachmentViewButton
                url={activeDrawing.drawing_url}
                label="فتح المخطط الأصلي"
                title={activeDrawing.title}
              />
            </div>

            <div className={styles.viewerControls}>
              <span className={styles.viewerHelpBadge}>
                <MapPin size={13} />
                <span>اضغط في أي مكان على المخطط لتثبيت ملاحظة موقع 📍</span>
              </span>
              <button
                type="button"
                className={styles.viewerToolBtn}
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                title="تكبير المخطط"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                className={styles.viewerToolBtn}
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.25))}
                title="تصغير المخطط"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                className={styles.viewerToolBtn}
                onClick={() => setZoomLevel(1)}
                title="إعادة ضبط الحجم"
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>

          <div className={styles.viewerStage}>
            <div
              className={styles.drawingContainer}
              style={{ transform: `scale(${zoomLevel})` }}
              onClick={handleDrawingClick}
            >
              <img
                ref={drawingImgRef}
                src={activeDrawing.drawing_url}
                alt={activeDrawing.title}
                className={styles.blueprintImg}
              />

              {/* Pins / Markers overlaid on the blueprint */}
              {pinnedVisits.map((v) => {
                const statusClass =
                  v.status === 'مفتوحة'
                    ? styles.open
                    : v.status === 'قيد المعالجة'
                    ? styles.inProgress
                    : styles.resolved;

                return (
                  <div
                    key={v.id}
                    className={styles.markerPin}
                    style={{ left: `${v.pin_x}%`, top: `${v.pin_y}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditVisitModal(v);
                    }}
                  >
                    <div className={`${styles.pinHead} ${statusClass}`}>
                      <div className={styles.pinInnerDot} />
                    </div>
                    <div className={styles.pinPulse} />
                    <div className={styles.pinTooltip}>
                      <strong>{v.title}</strong>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                        الحالة: {v.status} | {v.inspector_name || 'المهندس'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SITE VISITS & PUNCH LIST CARDS                                         */}
      {/* ========================================================================= */}
      <div className={styles.visitsSection}>
        <div className={styles.visitsHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Camera size={20} color="#059669" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
              سجل زيارات الموقع والملاحظات الفنية (Punch List)
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 800 }}>
              (إجمالي {visits.length} | 🔴 {openCount} مفتوحة | 🟡 {inProgressCount} قيد المعالجة | 🟢 {resolvedCount} منجزة)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className={styles.filterTabs}>
              {(['الكل', 'مفتوحة', 'قيد المعالجة', 'تم الإنجاز'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`${styles.filterTabBtn} ${statusFilter === tab ? styles.active : ''}`}
                  onClick={() => setStatusFilter(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={styles.btnSuccess}
              onClick={() => openNewVisitModal(activeDrawing?.id)}
            >
              <Plus size={15} />
              <span>تسجيل ملاحظة زيارة ميدانية</span>
            </button>
          </div>
        </div>

        {filteredVisits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8', fontWeight: 800 }}>
            <Camera size={34} style={{ color: '#cbd5e1', marginBottom: '0.5rem' }} />
            <p style={{ margin: 0 }}>
              {statusFilter === 'الكل'
                ? 'لا توجد ملاحظات أو زيارات ميدانية مسجلة حتى الآن.'
                : `لا توجد ملاحظات بالحالة "${statusFilter}".`}
            </p>
          </div>
        ) : (
          <div className={styles.visitsGrid}>
            {filteredVisits.map((visit) => {
              const statusClass =
                visit.status === 'مفتوحة'
                  ? styles.open
                  : visit.status === 'قيد المعالجة'
                  ? styles.inProgress
                  : styles.resolved;

              const hasBothPhotos = Boolean(visit.photo_before_url && visit.photo_after_url);
              const { cleanNotes: cardCleanNotes, meta: cardMeta } = parseVisitNotesAndMeta(visit.notes);
              const cardPinCount = Array.isArray(cardMeta.photoPins) && cardMeta.photoPins.length > 0
                ? cardMeta.photoPins.length
                : (visit.pin_x !== null && visit.pin_y !== null ? 1 : 0);

              return (
                <div key={visit.id} className={styles.visitCard}>
                  <div className={styles.visitCardHead}>
                    <span className={`${styles.statusPill} ${statusClass}`}>
                      {visit.status === 'مفتوحة' && '🔴 '}
                      {visit.status === 'قيد المعالجة' && '🟡 '}
                      {visit.status === 'تم الإنجاز' && '🟢 '}
                      {visit.status}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800 }}>
                      📅 {visit.visit_date}
                    </span>
                  </div>

                  <div className={styles.visitCardBody}>
                    <h4 className={styles.visitTitle}>{visit.title}</h4>

                    <div className={styles.visitMetaRow}>
                      {visit.stage && (
                        <span>🔨 البند: <strong>{visit.stage}</strong></span>
                      )}
                      {visit.inspector_name && (
                        <span>👷 الفاحص: <strong>{visit.inspector_name}</strong></span>
                      )}
                      {cardPinCount > 0 && (
                        <span style={{ color: '#0284c7', fontWeight: 900 }}>
                          📍 {cardPinCount} {cardPinCount === 1 ? 'نقطة مصورة على الشوب دروينج' : 'نقاط مصورة على الشوب دروينج'}
                        </span>
                      )}
                      {cardMeta.videoUrl && (
                        <span style={{ color: '#7c3aed', fontWeight: 900 }}>🎥 فيديو مرفق</span>
                      )}
                      {cardMeta.docUrl && (
                        <span style={{ color: '#059669', fontWeight: 900 }}>📄 مستند مرفق</span>
                      )}
                    </div>

                    {cardCleanNotes && <div className={styles.visitNotes}>{cardCleanNotes}</div>}

                    {(cardMeta.videoUrl || cardMeta.docUrl) && (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                        {cardMeta.videoUrl && (
                          <AttachmentViewButton
                            url={cardMeta.videoUrl}
                            label="🎥 تشغيل فيديو الزيارة"
                            title={`فيديو الزيارة: ${visit.title}`}
                          />
                        )}
                        {cardMeta.docUrl && (
                          <AttachmentViewButton
                            url={cardMeta.docUrl}
                            label="📄 عرض المستند المرفق"
                            title={`مستند الزيارة: ${visit.title}`}
                          />
                        )}
                      </div>
                    )}

                    {/* Photos Preview: Before & After */}
                    <div className={styles.photosComparisonRow}>
                      <div className={styles.photoThumbBox}>
                        <span className={`${styles.photoTagBadge} ${styles.before}`}>قبل</span>
                        {visit.photo_before_url ? (
                          <img
                            src={visit.photo_before_url}
                            alt="صورة قبل"
                            className={styles.photoThumbImg}
                          />
                        ) : (
                          <div className={styles.noPhotoPlaceholder}>
                            <ImageIcon size={20} />
                            <span>بدون صورة قبل</span>
                          </div>
                        )}
                      </div>

                      <div className={styles.photoThumbBox}>
                        <span className={`${styles.photoTagBadge} ${styles.after}`}>بعد</span>
                        {visit.photo_after_url ? (
                          <img
                            src={visit.photo_after_url}
                            alt="صورة بعد"
                            className={styles.photoThumbImg}
                          />
                        ) : (
                          <div className={styles.noPhotoPlaceholder}>
                            <ImageIcon size={20} />
                            <span>بانتظار المعالجة</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.visitCardActions}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {hasBothPhotos && (
                        <button
                          type="button"
                          className={styles.compareBtn}
                          onClick={() => handleOpenComparison(visit)}
                          title="عرض مقارنة قبل وبعد بالسحب التفاعلي"
                        >
                          <Sliders size={13} />
                          <span>مقارنة قبل وبعد</span>
                        </button>
                      )}

                      <select
                        value={visit.status}
                        onChange={(e) =>
                          void handleQuickStatusChange(
                            visit,
                            e.target.value as 'مفتوحة' | 'قيد المعالجة' | 'تم الإنجاز'
                          )
                        }
                        className={styles.selectField}
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.72rem' }}
                      >
                        <option value="مفتوحة">🔴 مفتوحة</option>
                        <option value="قيد المعالجة">🟡 قيد المعالجة</option>
                        <option value="تم الإنجاز">🟢 تم الإنجاز</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className={styles.compareBtn}
                        style={{ background: '#0284c7', color: '#fff', border: 'none' }}
                        onClick={() => openEditVisitModal(visit)}
                        title="فتح الزيارة ومخطط الشوب دروينج ونقاط الصور والفيديو"
                      >
                        <MapPin size={13} />
                        <span>فتح الزيارة والشوب دروينج</span>
                      </button>
                      <button
                        type="button"
                        className={styles.actionIconBtn}
                        onClick={() => openEditVisitModal(visit)}
                        title="تعديل الملاحظة ورفع صورة المعالجة"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionIconBtn} ${styles.danger}`}
                        onClick={() => void handleDeleteVisit(visit)}
                        title="حذف الملاحظة"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL: UPLOAD NEW SHOP DRAWING                                         */}
      {/* ========================================================================= */}
      {showAddDrawingModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddDrawingModal(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h3 className={styles.modalTitle}>رفع مخطط شوب دروينج تنفيذي للمشروع</h3>
              <button
                type="button"
                className={styles.actionIconBtn}
                onClick={() => setShowAddDrawingModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveDrawing}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>عنوان المخطط *</label>
                    <input
                      type="text"
                      value={drawingTitle}
                      onChange={(e) => setDrawingTitle(e.target.value)}
                      placeholder="مثلاً: مخطط الدور الأرضي - معماري"
                      required
                      className={styles.inputField}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>نوع المخطط</label>
                    <select
                      value={drawingType}
                      onChange={(e) => setDrawingType(e.target.value)}
                      className={styles.selectField}
                    >
                      <option value="معماري">معماري (Architectural)</option>
                      <option value="إنشائي">إنشائي (Structural)</option>
                      <option value="كهروميكانيك MEP">كهروميكانيك MEP</option>
                      <option value="صحي وسباكة">صحي وسباكة (Plumbing)</option>
                      <option value="واجهات وتكسيات">واجهات وتكسيات (Facade)</option>
                      <option value="تنسيق موقع As-Built">تنسيق موقع As-Built</option>
                      <option value="عام">عام</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>الإصدار (Revision)</label>
                    <input
                      type="text"
                      value={drawingVersion}
                      onChange={(e) => setDrawingVersion(e.target.value)}
                      placeholder="مثال: Rev-01 أو IFC"
                      className={styles.inputField}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>ملاحظات إضافية على المخطط</label>
                  <textarea
                    value={drawingNotes}
                    onChange={(e) => setDrawingNotes(e.target.value)}
                    placeholder="ملاحظات الاعتماد الاستشاري أو رقم اللوحة..."
                    className={styles.textareaField}
                  />
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  <TelegramAttachmentField
                    module="project_drawings"
                    value={drawingUrl}
                    onChange={setDrawingUrl}
                    label="ملف المخطط التنفيذي (صورة المخطط JPG/PNG أو PDF)"
                    caption={`شوب دروينج: ${drawingTitle} (${drawingType})`}
                    allowStamp={false}
                  />
                </div>
              </div>

              <div className={styles.modalFoot}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowAddDrawingModal(false)}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDrawing}
                  className={styles.btnPrimary}
                >
                  {isSubmittingDrawing ? 'جاري الرفع والحفظ...' : 'اعتماد وحفظ المخطط'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: ADD / EDIT SITE VISIT OBSERVATION                                */}
      {/* ========================================================================= */}
      {showVisitModal && (
        <div className={styles.modalOverlay} onClick={() => setShowVisitModal(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h3 className={styles.modalTitle}>
                {editingVisit ? 'تعديل ملاحظة زيارة الموقع' : 'تسجيل ملاحظة زيارة وفحص جودة'}
              </h3>
              <button
                type="button"
                className={styles.actionIconBtn}
                onClick={() => setShowVisitModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveVisit}>
              <div className={styles.modalBody}>
                {visitPinX !== null && visitPinY !== null && (
                  <div
                    style={{
                      background: 'rgba(2, 132, 199, 0.08)',
                      border: '1px solid rgba(2, 132, 199, 0.25)',
                      padding: '0.65rem 0.9rem',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      color: '#0284c7',
                    }}
                  >
                    <MapPin size={15} />
                    <span>
                      تم تثبيت هذه الملاحظة على المخطط عند الإحداثيات النسبية: (X: {visitPinX}%, Y: {visitPinY}%)
                    </span>
                  </div>
                )}

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>عنوان الملاحظة / عنصر الفحص *</label>
                    <input
                      type="text"
                      value={visitTitle}
                      onChange={(e) => setVisitTitle(e.target.value)}
                      placeholder="مثلاً: تعشيش بالعمود C2 أو فحص حديد السقف"
                      required
                      className={styles.inputField}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>البند / المرحلة المعمارية</label>
                    <input
                      type="text"
                      value={visitStage}
                      onChange={(e) => setVisitStage(e.target.value)}
                      placeholder="مثلاً: خرسانات، دهانات، عزل مائي..."
                      className={styles.inputField}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>تاريخ الزيارة والفحص</label>
                    <input
                      type="date"
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      className={styles.inputField}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>المهندس الفاحص / المشرف</label>
                    <input
                      type="text"
                      value={visitInspector}
                      onChange={(e) => setVisitInspector(e.target.value)}
                      placeholder="اسم مهندس الجودة أو الموقع"
                      className={styles.inputField}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>حالة الملاحظة</label>
                    <select
                      value={visitStatus}
                      onChange={(e) =>
                        setVisitStatus(
                          e.target.value as 'مفتوحة' | 'قيد المعالجة' | 'تم الإنجاز'
                        )
                      }
                      className={styles.selectField}
                    >
                      <option value="مفتوحة">🔴 مفتوحة (بانتظار المعالجة)</option>
                      <option value="قيد المعالجة">🟡 قيد المعالجة (جاري التنفيذ)</option>
                      <option value="تم الإنجاز">🟢 تم الإنجاز (تمت المعالجة والاعتماد)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>المخطط المرتبط</label>
                    <select
                      value={visitDrawingId || ''}
                      onChange={(e) => setVisitDrawingId(e.target.value || null)}
                      className={styles.selectField}
                    >
                      <option value="">بدون ربط بمخطط محدد</option>
                      {drawings.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title} ({d.version})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>الملاحظات الفنية والتوصيات</label>
                  <textarea
                    value={visitNotes}
                    onChange={(e) => setVisitNotes(e.target.value)}
                    placeholder="التوجيهات الفنية لمعالجة الملاحظة أو سبب الرفض..."
                    className={styles.textareaField}
                  />
                </div>

                {/* 🗺️ مخطط الشوب دروينج التفاعلي داخل الزيارة لتوقيع نقاط الصور والفيديوهات */}
                <div
                  style={{
                    background: 'var(--surface-card)', color: 'var(--text-primary)', borderRadius: 'var(--phi-radius-card, 18px)', padding: '1.25rem', marginBottom: '1rem', border: 'none', boxShadow: 'var(--shadow-ambient)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Compass size={18} color="#38bdf8" />
                      <strong style={{ fontSize: '0.92rem' }}>
                        مخطط الشوب دروينج للزيارة — اضغط على المخطط لوضع نقاط الصور التي التقطتها 📍
                      </strong>
                    </div>
                    <span style={{ background: '#0284c7', color: '#fff', padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 900 }}>
                      {visitPhotoPins.length} نقاط مصورة على المخطط
                    </span>
                  </div>

                  {(() => {
                    const selectedDrawingObj = drawings.find(d => d.id === visitDrawingId) || activeDrawing;
                    const drawingImgSrc = selectedDrawingObj?.drawing_url || visitCustomDrawingUrl;

                    if (!drawingImgSrc) {
                      return (
                        <div style={{ background: 'var(--surface-sunken)', borderRadius: '12px', padding: '1rem', textAlign: 'center', border: 'none', boxShadow: 'var(--shadow-sunken)' }}>
                          <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                            ارفع صورة الشوب دروينج لهذه الزيارة لتتمكن من وضع نقاط الصور والفيديوهات عليها مباشرةً:
                          </p>
                          <TelegramAttachmentField
                            module="project_drawings"
                            value={visitCustomDrawingUrl}
                            onChange={setVisitCustomDrawingUrl}
                            label="صورة مخطط الشوب دروينج للزيارة"
                            allowStamp={false}
                          />
                        </div>
                      );
                    }

                    return (
                      <div>
                        <div
                          style={{
                            position: 'relative',
                            width: '100%',
                            maxHeight: '380px',
                            overflow: 'auto',
                            borderRadius: '10px',
                            border: '2px solid #38bdf8',
                            background: '#020617',
                            cursor: 'crosshair',
                          }}
                          onClick={handleModalDrawingClick}
                        >
                          <img
                            ref={modalDrawingImgRef}
                            src={drawingImgSrc}
                            alt="مخطط الشوب دروينج"
                            style={{ width: '100%', display: 'block', userSelect: 'none' }}
                          />
                          {visitPhotoPins.map((pin) => {
                            const isSelected = pin.id === selectedPinId;
                            return (
                              <div
                                key={pin.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPinId(pin.id);
                                }}
                                title={`${pin.label} (اضغط لفتح أو تعديل صورة/فيديو النقطة)`}
                                style={{
                                  position: 'absolute',
                                  left: `${pin.x}%`,
                                  top: `${pin.y}%`,
                                  transform: 'translate(-50%, -50%)',
                                  width: isSelected ? '32px' : '26px',
                                  height: isSelected ? '32px' : '26px',
                                  borderRadius: '50%',
                                  background: pin.photoUrl || pin.videoUrl ? '#10b981' : '#ef4444',
                                  color: '#ffffff',
                                  fontWeight: 900,
                                  fontSize: '0.78rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: isSelected ? '3px solid #facc15' : '2px solid #ffffff',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
                                  cursor: 'pointer',
                                  zIndex: isSelected ? 10 : 5,
                                }}
                              >
                                {pin.pinNumber}
                              </div>
                            );
                          })}
                        </div>

                        {/* قائمة نقاط الصور الموضوعة على الشوب دروينج */}
                        {visitPhotoPins.length > 0 && (
                          <div style={{ marginTop: '0.85rem', background: 'var(--surface-sunken)', borderRadius: '12px', padding: '0.85rem', border: 'none', boxShadow: 'var(--shadow-sunken)' }}>
                            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                              {visitPhotoPins.map((pin) => (
                                <button
                                  key={pin.id}
                                  type="button"
                                  onClick={() => setSelectedPinId(pin.id)}
                                  style={{
                                    padding: '0.35rem 0.7rem',
                                    borderRadius: '8px',
                                    border: pin.id === selectedPinId ? '2px solid #38bdf8' : '1px solid #475569',
                                    background: pin.id === selectedPinId ? 'var(--accent-ink)' : 'var(--surface-subcard)', boxShadow: 'var(--shadow-elevation)',
                                    color: pin.id === selectedPinId ? '#fff' : 'var(--text-primary)',
                                    fontWeight: 800,
                                    fontSize: '0.76rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  📍 نقطة #{pin.pinNumber}: {pin.label} {pin.photoUrl ? '📸' : ''} {pin.videoUrl ? '🎥' : ''}
                                </button>
                              ))}
                            </div>

                            {(() => {
                              const currentPin = visitPhotoPins.find(p => p.id === selectedPinId) || visitPhotoPins[0];
                              if (!currentPin) return null;
                              return (
                                <div style={{ background: '#ffffff', color: '#0f172a', borderRadius: '10px', padding: '0.85rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                      <span style={{ background: '#0284c7', color: '#fff', padding: '0.2rem 0.55rem', borderRadius: '6px', fontWeight: 900, fontSize: '0.75rem' }}>
                                        نقطة #{currentPin.pinNumber} (X:{currentPin.x}%, Y:{currentPin.y}%)
                                      </span>
                                      <input
                                        type="text"
                                        value={currentPin.label}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setVisitPhotoPins(prev =>
                                            prev.map(p => (p.id === currentPin.id ? { ...p, label: val } : p))
                                          );
                                        }}
                                        placeholder="وصف النقطة (مثال: عمود C4 أو حمام الدور الأول)"
                                        className={styles.inputField}
                                        style={{ flex: 1, padding: '0.4rem 0.65rem' }}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const remaining = visitPhotoPins
                                          .filter(p => p.id !== currentPin.id)
                                          .map((p, idx) => ({ ...p, pinNumber: idx + 1 }));
                                        setVisitPhotoPins(remaining);
                                        setSelectedPinId(remaining[0]?.id || null);
                                      }}
                                      style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', padding: '0.4rem 0.65rem', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem' }}
                                    >
                                      حذف النقطة
                                    </button>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                                    <TelegramAttachmentField
                                      module="site_visits"
                                      value={currentPin.photoUrl || null}
                                      onChange={(url) => {
                                        setVisitPhotoPins(prev =>
                                          prev.map(p => (p.id === currentPin.id ? { ...p, photoUrl: url } : p))
                                        );
                                      }}
                                      label={`📸 صورة النقطة #${currentPin.pinNumber} (${currentPin.label})`}
                                      caption={`نقطة #${currentPin.pinNumber} (${currentPin.label}) - ${visitTitle}`}
                                      allowStamp={true}
                                      stampContext={{
                                        buildingName: project?.Property || '',
                                        boqItem: `${visitStage || 'زيارة موقع'} - ${currentPin.label}`,
                                        capturedBy: visitInspector || '',
                                      }}
                                    />
                                    <TelegramAttachmentField
                                      module="site_visits"
                                      value={currentPin.videoUrl || null}
                                      onChange={(url) => {
                                        setVisitPhotoPins(prev =>
                                          prev.map(p => (p.id === currentPin.id ? { ...p, videoUrl: url } : p))
                                        );
                                      }}
                                      label={`🎥 فيديو النقطة #${currentPin.pinNumber} (اختياري)`}
                                      caption={`فيديو نقطة #${currentPin.pinNumber} (${currentPin.label})`}
                                      allowStamp={false}
                                    />
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* 📸 Before & After Photos + Video + Document with Camera Stamp */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                  <TelegramAttachmentField
                    module="site_visits"
                    value={visitPhotoBefore}
                    onChange={setVisitPhotoBefore}
                    label="📸 صورة الملاحظة قبل المعالجة (Before)"
                    caption={`ملاحظة قبل: ${visitTitle} - مشروع ${project?.Property || ''}`}
                    allowStamp={true}
                    stampContext={{
                      buildingName: project?.Property || '',
                      boqItem: visitStage || 'فحص جودة موقع',
                      capturedBy: visitInspector || '',
                    }}
                  />

                  <TelegramAttachmentField
                    module="site_visits"
                    value={visitPhotoAfter}
                    onChange={setVisitPhotoAfter}
                    label="📸 صورة المعالجة والإنهاء (After)"
                    caption={`معالجة بعد: ${visitTitle} - مشروع ${project?.Property || ''}`}
                    allowStamp={true}
                    stampContext={{
                      buildingName: project?.Property || '',
                      boqItem: visitStage || 'معالجة فحص موقع',
                      capturedBy: visitInspector || '',
                    }}
                  />

                  <TelegramAttachmentField
                    module="site_visits"
                    value={visitVideoUrl}
                    onChange={setVisitVideoUrl}
                    label="🎥 فيديو الزيارة الميدانية (تصوير أو إرفاق فيديو)"
                    caption={`فيديو زيارة: ${visitTitle} - مشروع ${project?.Property || ''}`}
                    allowStamp={false}
                  />

                  <TelegramAttachmentField
                    module="site_visits"
                    value={visitDocUrl}
                    onChange={setVisitDocUrl}
                    label="📄 مستند / محضر فحص مرفق (PDF / Word / Excel)"
                    caption={`مستند زيارة: ${visitTitle} - مشروع ${project?.Property || ''}`}
                    allowStamp={false}
                  />
                </div>
              </div>

              <div className={styles.modalFoot}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setShowVisitModal(false)}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVisit}
                  className={styles.btnSuccess}
                >
                  {isSubmittingVisit ? 'جاري الحفظ...' : 'حفظ الملاحظة والصور'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: INTERACTIVE BEFORE & AFTER SLIDER COMPARISON                   */}
      {/* ========================================================================= */}
      {comparisonVisit && comparisonVisit.photo_before_url && comparisonVisit.photo_after_url && (
        <div className={styles.modalOverlay} onClick={() => setComparisonVisit(null)}>
          <div className={styles.modalBox} style={{ maxWidth: '880px' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div>
                <h3 className={styles.modalTitle}>
                  مقارنة قبل وبعد (Before & After): {comparisonVisit.title}
                </h3>
                <small style={{ color: '#64748b', fontWeight: 700 }}>
                  اسحب المقبض يميناً ويساراً لمشاهدة الفرق الميداني الدقيق قبل وبعد المعالجة
                </small>
              </div>
              <button
                type="button"
                className={styles.actionIconBtn}
                onClick={() => setComparisonVisit(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div
                className={styles.comparisonSliderBox}
                onMouseMove={(e) => {
                  if (e.buttons === 1) handleSliderMove(e);
                }}
                onClick={handleSliderMove}
                onTouchMove={handleSliderMove}
              >
                {/* Before Image (Background full) */}
                <img
                  src={comparisonVisit.photo_before_url}
                  alt="قبل"
                  className={styles.sliderImg}
                />
                <span className={`${styles.sliderBadge} ${styles.before}`}>🔴 قبل المعالجة</span>

                {/* After Image (Clipped by slider position) */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: `${sliderPos}%`,
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={comparisonVisit.photo_after_url}
                    alt="بعد"
                    className={styles.sliderImg}
                    style={{
                      width: '100%',
                      minWidth: '100%',
                    }}
                  />
                  <span className={`${styles.sliderBadge} ${styles.after}`}>🟢 بعد المعالجة</span>
                </div>

                {/* Vertical Divider Line with Grab Handle */}
                <div className={styles.sliderDivider} style={{ left: `${sliderPos}%` }}>
                  <div className={styles.sliderHandle}>
                    <Sliders size={18} />
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <strong>البند:</strong> {comparisonVisit.stage || 'عام'} |{' '}
                  <strong>المهندس:</strong> {comparisonVisit.inspector_name || 'مهندس الموقع'}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <AttachmentViewButton
                    url={comparisonVisit.photo_before_url}
                    label="صورة قبل مكبرة"
                    title={`صورة قبل: ${comparisonVisit.title}`}
                  />
                  <AttachmentViewButton
                    url={comparisonVisit.photo_after_url}
                    label="صورة بعد مكبرة"
                    title={`صورة بعد: ${comparisonVisit.title}`}
                  />
                </div>
              </div>
            </div>

            <div className={styles.modalFoot}>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => setComparisonVisit(null)}
              >
                إغلاق المقارنة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
