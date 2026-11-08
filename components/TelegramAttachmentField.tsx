"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Download,
  Eye,
  FileText,
  Loader2,
  MapPin,
  Navigation,
  Paperclip,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  ResolvedAttachmentView,
  StagedAttachment,
  compressImageIfNeeded,
  isOfflineAttachmentRef,
  resolveAttachmentForViewing,
  uploadAttachmentToTelegram,
} from '@/lib/attachments/telegramAttachments';
import styles from './TelegramAttachmentField.module.css';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function AttachmentViewerModal({
  url,
  isOpen,
  onClose,
  title = 'معاينة المرفق',
}: {
  url: string | null | undefined;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedAttachmentView | null>(null);

  useEffect(() => {
    if (!isOpen || !url) {
      setResolved(null);
      setError(null);
      return;
    }

    let cancelled = false;
    let createdObjectUrl: string | null = null;

    setLoading(true);
    setError(null);

    resolveAttachmentForViewing(url)
      .then((view) => {
        if (cancelled) {
          if (view.revokeAfterUse) URL.revokeObjectURL(view.objectUrl);
          return;
        }
        if (view.revokeAfterUse) {
          createdObjectUrl = view.objectUrl;
        }
        setResolved(view);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.message || 'تعذر تحميل المرفق');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [isOpen, url]);

  if (!isOpen || !url) return null;

  const isPdf =
    resolved?.mimeType?.toLowerCase().includes('pdf') ||
    resolved?.fileName?.toLowerCase().endsWith('.pdf');
  const isVideo =
    !isPdf &&
    (resolved?.mimeType?.toLowerCase().startsWith('video/') ||
      /\.(mp4|mov|webm|ogg|mkv|avi)$/i.test(resolved?.fileName || ''));
  const isImage =
    !isPdf &&
    !isVideo &&
    (resolved?.mimeType?.toLowerCase().startsWith('image/') ||
      /\.(jpe?g|png|webp|gif|bmp)$/i.test(resolved?.fileName || ''));

  return (
    <div className={styles.modalBackdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <Paperclip size={16} />
            <span>{resolved?.fileName || title}</span>
            {resolved?.isOfflineLocal && (
              <span className={styles.telegramTag}>محفوظ محلياً بانتظار المزامنة</span>
            )}
          </div>
          <div className={styles.modalHeaderActions}>
            {resolved?.objectUrl && (
              <a
                href={resolved.objectUrl}
                download={resolved.fileName || 'attachment'}
                className={styles.iconAction}
                title="تنزيل المرفق"
              >
                <Download size={14} />
                <span>تنزيل</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`${styles.iconAction} ${styles.dangerBtn}`}
              aria-label="إغلاق المعاينة"
            >
              <X size={15} />
            </button>
          </div>
        </div>
        <div className={styles.modalBody}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8' }}>
              <Loader2 size={20} className={styles.spin} />
              <span>جاري جلب المرفق المشفر من تيليجرام...</span>
            </div>
          )}
          {!loading && error && <p className={styles.errorText}>{error}</p>}
          {!loading && !error && resolved && isImage && (
            <img
              src={resolved.objectUrl}
              alt={resolved.fileName || title}
              className={styles.fullImage}
            />
          )}
          {!loading && !error && resolved && isVideo && (
            <video
              src={resolved.objectUrl}
              controls
              autoPlay
              style={{ maxWidth: '100%', maxHeight: '72vh', borderRadius: '12px', background: '#000' }}
            />
          )}
          {!loading && !error && resolved && isPdf && (
            <iframe
              src={resolved.objectUrl}
              title={resolved.fileName || title}
              className={styles.pdfFrame}
            />
          )}
          {!loading && !error && resolved && !isImage && !isVideo && !isPdf && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <FileText size={42} style={{ marginBottom: '0.75rem', color: '#38bdf8' }} />
              <p style={{ margin: '0 0 1rem', fontWeight: 800 }}>{resolved.fileName}</p>
              <a
                href={resolved.objectUrl}
                download={resolved.fileName || 'attachment'}
                className={styles.viewPill}
              >
                <Download size={14} />
                <span>تنزيل الملف</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AttachmentViewButton({
  url,
  label = 'المرفق',
  title = 'عرض المرفق',
}: {
  url: string | null | undefined;
  label?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!url) return null;

  const isQueued = isOfflineAttachmentRef(url);

  return (
    <>
      <button
        type="button"
        className={styles.viewPill}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title={title}
      >
        <Eye size={13} />
        <span>{isQueued ? 'مرفق محلي' : label}</span>
      </button>
      {open && (
        <AttachmentViewerModal
          url={url}
          isOpen={open}
          onClose={() => setOpen(false)}
          title={title}
        />
      )}
    </>
  );
}

export interface StampContext {
  buildingName?: string;
  location?: string;
  boqItem?: string;
  capturedBy?: string;
}

export interface TelegramAttachmentFieldProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  stagedAttachment?: StagedAttachment | null;
  onStagedChange?: (att: StagedAttachment | null) => void;
  module: string;
  allowOfflineStage?: boolean;
  label?: string;
  caption?: string;
  compact?: boolean;
  disabled?: boolean;
  stampContext?: StampContext;
  allowStamp?: boolean;
}

export default function TelegramAttachmentField({
  value,
  onChange,
  stagedAttachment,
  onStagedChange,
  module,
  allowOfflineStage = false,
  label = 'صورة الفاتورة أو المستند المرفق',
  caption,
  compact = false,
  disabled = false,
  stampContext,
  allowStamp = true,
}: TelegramAttachmentFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);
  const mobileVideoInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState<string | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  // 📍 خيارات ختم الموقع والبيانات (Stamp)
  const [stampEnabled, setStampEnabled] = useState(Boolean(stampContext));
  const [stampBuilding, setStampBuilding] = useState(stampContext?.buildingName || '');
  const [stampLocation, setStampLocation] = useState(stampContext?.location || '');
  const [stampBoqItem, setStampBoqItem] = useState(stampContext?.boqItem || '');
  const [stampInspector, setStampInspector] = useState(stampContext?.capturedBy || '');
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (stampContext) {
      if (stampContext.buildingName !== undefined) setStampBuilding(stampContext.buildingName);
      if (stampContext.location !== undefined) setStampLocation(stampContext.location);
      if (stampContext.boqItem !== undefined) setStampBoqItem(stampContext.boqItem);
      if (stampContext.capturedBy !== undefined) setStampInspector(stampContext.capturedBy);
    }
  }, [stampContext]);

  const handleFetchGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrorMsg('تحديد الموقع الجغرافي (GPS) غير مدعوم في متصفحك');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setStampLocation(`${lat}° N, ${lng}° E`);
      },
      (err) => {
        setIsLocating(false);
        setErrorMsg('تعذر جلب إحداثيات GPS: ' + (err.message || 'تم رفض الإذن'));
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    if (!stagedAttachment) {
      setStagedPreviewUrl(null);
      return;
    }
    if (stagedAttachment.mimeType.startsWith('image/')) {
      const objUrl = URL.createObjectURL(stagedAttachment.blob);
      setStagedPreviewUrl(objUrl);
      return () => URL.revokeObjectURL(objUrl);
    }
    setStagedPreviewUrl(null);
  }, [stagedAttachment]);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraModalOpen(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleSelectedFile = async (rawFile: File | null | undefined) => {
    if (!rawFile) return;
    setErrorMsg(null);

    if (rawFile.size > 20 * 1024 * 1024) {
      setErrorMsg('حجم الملف يتجاوز الحد الأقصى المسموح في تيليجرام (20 ميجابايت)');
      return;
    }

    try {
      const prepared = await compressImageIfNeeded(rawFile);

      if (allowOfflineStage && onStagedChange) {
        onStagedChange({
          blob: prepared,
          fileName: prepared.name,
          mimeType: prepared.type || 'application/octet-stream',
          fileSize: prepared.size,
          caption,
        });
        onChange(null);
        return;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setErrorMsg('رفع هذا المرفق يتطلب اتصالاً بالإنترنت');
        return;
      }

      setIsUploading(true);
      const uploaded = await uploadAttachmentToTelegram({
        blob: prepared,
        fileName: prepared.name,
        mimeType: prepared.type || 'application/octet-stream',
        module,
        caption,
      });
      onChange(uploaded.url);
      if (onStagedChange) onStagedChange(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'فشل إرفاق الملف عبر Telegram Bot');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (mobileCameraInputRef.current) mobileCameraInputRef.current.value = '';
    }
  };

  const handleOpenCamera = async () => {
    if (disabled || isUploading) return;
    setErrorMsg(null);

    const isCoarseMobile =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(pointer: coarse)').matches;

    if (isCoarseMobile || !navigator.mediaDevices?.getUserMedia) {
      mobileCameraInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraModalOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch {
      mobileCameraInputRef.current?.click();
    }
  };

  const captureCameraFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 📍 حرق ختم الموقع والبيانات على الصورة (Canvas Watermark Stamp)
    if (stampEnabled) {
      const width = canvas.width;
      const height = canvas.height;
      const bannerHeight = Math.max(90, Math.round(height * 0.14));

      // شريط التدرج الداكن أسفل الصورة
      const grad = ctx.createLinearGradient(0, height - bannerHeight, 0, height);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.88)');
      grad.addColorStop(1, 'rgba(2, 6, 23, 0.96)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, height - bannerHeight, width, bannerHeight);

      // شريط ذهبي علوي فائق الأناقة
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, height - bannerHeight, width, Math.max(3, Math.round(height * 0.005)));

      // تنسيق النصوص باللغة العربية RTL
      const baseFontSize = Math.max(16, Math.round(height * 0.026));
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      const paddingX = Math.round(width * 0.035);
      const line1Y = height - bannerHeight + bannerHeight * 0.32;
      const line2Y = height - bannerHeight + bannerHeight * 0.72;

      // السطر الأول: اسم العمارة/المشروع + البند
      ctx.font = `bold ${baseFontSize}px Cairo, system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
      const l1 = `🏢 المشروع/العمارة: ${stampBuilding || 'مشروع الموقع'}   |   🔨 البند: ${stampBoqItem || 'عام'}`;
      ctx.fillText(l1, width - paddingX, line1Y);

      // السطر الثاني: الموقع الجغرافي + المهندس الملتقط + التاريخ والوقت
      ctx.font = `600 ${Math.round(baseFontSize * 0.82)}px Cairo, system-ui, sans-serif`;
      ctx.fillStyle = '#fbbf24';
      const l2 = `📍 الموقع: ${stampLocation || 'إحداثيات الموقع'}   |   👷 الملتقط: ${stampInspector || 'مهندس الموقع'}   |   🕒 ${new Date().toLocaleString('en-US')}`;
      ctx.fillText(l2, width - paddingX, line2Y);
    }

    canvas.toBlob(
      (blob) => {
        stopCameraStream();
        if (blob) {
          const capturedFile = new File([blob], `camera_${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
          void handleSelectedFile(capturedFile);
        }
      },
      'image/jpeg',
      0.86
    );
  };

  const handleRemove = () => {
    onChange(null);
    if (onStagedChange) onStagedChange(null);
    setErrorMsg(null);
  };

  const hasAttachment = Boolean(stagedAttachment || value);

  return (
    <div className={styles.wrapper}>
      {label && (
        <div className={styles.labelRow}>
          <span className={styles.label}>
            <Paperclip size={14} />
            <span>{label}</span>
          </span>
          <span className={styles.telegramTag}>
            <Send size={11} style={{ display: 'inline', marginLeft: 4 }} />
            Telegram Cloud
          </span>
        </div>
      )}

      <div className={`${styles.dropBox} ${compact ? styles.compactBox : ''}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.mp4,.mov,.webm"
          className={styles.hiddenInput}
          onChange={(e) => void handleSelectedFile(e.target.files?.[0])}
          disabled={disabled || isUploading}
        />
        <input
          ref={mobileCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className={styles.hiddenInput}
          onChange={(e) => void handleSelectedFile(e.target.files?.[0])}
          disabled={disabled || isUploading}
        />
        <input
          ref={mobileVideoInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          className={styles.hiddenInput}
          onChange={(e) => void handleSelectedFile(e.target.files?.[0])}
          disabled={disabled || isUploading}
        />

        {!hasAttachment && (
          <div className={styles.actionsRow} style={{ flexWrap: 'wrap' }}>
            <button
              type="button"
              className={styles.actionBtn}
              disabled={disabled || isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 size={15} className={styles.spin} />
              ) : (
                <Paperclip size={15} />
              )}
              <span>{isUploading ? 'جاري الرفع إلى تيليجرام...' : 'صورة / فيديو / مستند (PDF-Word-Excel)'}</span>
            </button>

            <button
              type="button"
              className={`${styles.actionBtn} ${styles.cameraBtn}`}
              disabled={disabled || isUploading}
              onClick={() => void handleOpenCamera()}
            >
              <Camera size={15} />
              <span>تصوير بالكاميرا</span>
            </button>

            <button
              type="button"
              className={styles.actionBtn}
              style={{ background: '#7c3aed', color: '#fff', borderColor: '#6d28d9' }}
              disabled={disabled || isUploading}
              onClick={() => mobileVideoInputRef.current?.click()}
            >
              <Camera size={15} />
              <span>🎥 تصوير/إرفاق فيديو</span>
            </button>
          </div>
        )}

        {stagedAttachment && (
          <div className={styles.previewCard}>
            <div className={styles.previewInfo}>
              {stagedPreviewUrl ? (
                <img src={stagedPreviewUrl} alt="معاينة" className={styles.thumb} />
              ) : (
                <FileText size={26} style={{ color: '#0ea5e9', flexShrink: 0 }} />
              )}
              <div className={styles.fileMeta}>
                <span className={styles.fileName}>{stagedAttachment.fileName}</span>
                <span className={styles.fileSub}>
                  جاهز للإرفاق ({formatBytes(stagedAttachment.fileSize)}) — يُرفع لتيليجرام عند الحفظ أو عودة الإنترنت
                </span>
              </div>
            </div>
            <div className={styles.previewActions}>
              {stagedPreviewUrl && (
                <button
                  type="button"
                  className={styles.iconAction}
                  onClick={() => setViewerOpen(true)}
                >
                  <Eye size={13} />
                  <span>معاينة</span>
                </button>
              )}
              {!disabled && (
                <button
                  type="button"
                  className={`${styles.iconAction} ${styles.dangerBtn}`}
                  onClick={handleRemove}
                >
                  <Trash2 size={13} />
                  <span>حذف</span>
                </button>
              )}
            </div>
          </div>
        )}

        {!stagedAttachment && value && (
          <div className={styles.previewCard}>
            <div className={styles.previewInfo}>
              <FileText size={24} style={{ color: '#10b981', flexShrink: 0 }} />
              <div className={styles.fileMeta}>
                <span className={styles.fileName}>
                  {isOfflineAttachmentRef(value)
                    ? 'مرفق محفوظ محلياً بانتظار المزامنة'
                    : 'مرفق محفوظ ومؤمّن عبر Telegram Bot'}
                </span>
                <span className={styles.fileSub}>
                  {isOfflineAttachmentRef(value)
                    ? 'سيُرفع تلقائياً إلى تيليجرام فور عودة الاتصال'
                    : 'معزول بصلاحيات الشركة الحالية'}
                </span>
              </div>
            </div>
            <div className={styles.previewActions}>
              <button
                type="button"
                className={styles.iconAction}
                onClick={() => setViewerOpen(true)}
              >
                <Eye size={13} />
                <span>عرض</span>
              </button>
              {!disabled && (
                <button
                  type="button"
                  className={styles.iconAction}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span>استبدال</span>
                </button>
              )}
              {!disabled && (
                <button
                  type="button"
                  className={`${styles.iconAction} ${styles.dangerBtn}`}
                  onClick={handleRemove}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        {allowOfflineStage && !hasAttachment && (
          <p className={styles.hintText}>
            يدعم العمل بدون إنترنت: يتم حفظ الصورة محلياً في المتصفح ورفعها إلى Telegram تلقائياً عند الاتصال.
          </p>
        )}

        {errorMsg && <p className={styles.errorText}>{errorMsg}</p>}
      </div>

      {viewerOpen && (stagedPreviewUrl || value) && (
        <AttachmentViewerModal
          url={stagedPreviewUrl || value}
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          title={stagedAttachment?.fileName || label}
        />
      )}

      {cameraModalOpen && (
        <div className={styles.modalBackdrop} onClick={stopCameraStream}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <Camera size={16} />
                <span>التقاط صورة المستند</span>
              </div>
              <button
                type="button"
                className={`${styles.iconAction} ${styles.dangerBtn}`}
                onClick={stopCameraStream}
              >
                <X size={15} />
              </button>
            </div>
            <div className={styles.modalBody} style={{ flexDirection: 'column', gap: '0.85rem' }}>
              <video ref={videoRef} playsInline muted className={styles.videoFrame} />

              {allowStamp && (
                <div className={styles.stampPanel}>
                  <div className={styles.stampHeader}>
                    <span>📍 بيانات ختم وتوثيق الكاميرا على الصورة</span>
                    <button
                      type="button"
                      className={`${styles.stampToggleBtn} ${stampEnabled ? styles.active : ''}`}
                      onClick={() => setStampEnabled(!stampEnabled)}
                    >
                      {stampEnabled ? '✓ الختم مفعل على الصورة' : 'تفعيل الختم على الصورة'}
                    </button>
                  </div>
                  {stampEnabled && (
                    <div className={styles.stampGrid}>
                      <div className={styles.stampField}>
                        <label>🏢 اسم العمارة / المشروع</label>
                        <input
                          type="text"
                          value={stampBuilding}
                          onChange={(e) => setStampBuilding(e.target.value)}
                          placeholder="مثال: برج الروضة 4"
                          className={styles.stampInput}
                        />
                      </div>
                      <div className={styles.stampField}>
                        <label>🔨 البند / نوع المخالفة</label>
                        <input
                          type="text"
                          value={stampBoqItem}
                          onChange={(e) => setStampBoqItem(e.target.value)}
                          placeholder="مثال: أعمال النجارة المسلحة"
                          className={styles.stampInput}
                        />
                      </div>
                      <div className={styles.stampField}>
                        <label>👷 الشخص الملتقط / المشرف</label>
                        <input
                          type="text"
                          value={stampInspector}
                          onChange={(e) => setStampInspector(e.target.value)}
                          placeholder="اسم المهندس أو المراقب"
                          className={styles.stampInput}
                        />
                      </div>
                      <div className={styles.stampField}>
                        <label>📍 الموقع على الخريطة</label>
                        <div className={styles.stampGpsRow}>
                          <input
                            type="text"
                            value={stampLocation}
                            onChange={(e) => setStampLocation(e.target.value)}
                            placeholder="العنوان أو الإحداثيات"
                            className={styles.stampInput}
                          />
                          <button
                            type="button"
                            onClick={handleFetchGps}
                            disabled={isLocating}
                            className={styles.gpsBtn}
                            title="جلب إحداثيات GPS الحالية"
                          >
                            {isLocating ? <Loader2 size={12} className={styles.spin} /> : <Navigation size={12} />}
                            <span>GPS</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.actionsRow}>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.cameraBtn}`}
                  onClick={captureCameraFrame}
                >
                  <Camera size={16} />
                  <span>التقاط الصورة الآن</span>
                </button>
                <button type="button" className={styles.actionBtn} onClick={stopCameraStream}>
                  <span>إلغاء</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
