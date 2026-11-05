"use client";

import React, { useState } from 'react';
import {
  CheckCircle2,
  CloudOff,
  Paperclip,
  RefreshCw,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import { useOfflineSync } from '@/lib/offline/useOfflineSync';
import { OfflineEntityType } from '@/lib/offline/offlineStore';
import styles from './OfflineSyncStatus.module.css';

function entityLabel(type: OfflineEntityType): string {
  switch (type) {
    case 'labor_log_draft':
      return 'مسودة يومية عمالة';
    case 'custody_expense_draft':
      return 'مسودة مصروف عهدة';
    case 'expense_draft':
    default:
      return 'مسودة مصروف عام';
  }
}

export default function OfflineSyncStatus() {
  const {
    isOnline,
    isSyncing,
    items,
    totalCount,
    failedCount,
    retryAll,
    retryItem,
    deleteItem,
  } = useOfflineSync();

  const [dialogOpen, setDialogOpen] = useState(false);

  const pillStateClass = !isOnline
    ? styles.pillOffline
    : totalCount > 0
    ? styles.pillPending
    : styles.pillOnline;

  const dotStateClass = !isOnline
    ? styles.dotOffline
    : totalCount > 0
    ? styles.dotPending
    : styles.dotOnline;

  const statusLabel = !isOnline
    ? 'وضع عدم الاتصال'
    : isSyncing
    ? 'جاري المزامنة...'
    : totalCount > 0
    ? `بانتظار المزامنة`
    : 'متصل لحظياً';

  return (
    <>
      <button
        type="button"
        className={`${styles.pillBtn} ${pillStateClass}`}
        onClick={() => setDialogOpen(true)}
        title="حالة الاتصال وطابور المسودات غير المتصلة"
        aria-label={statusLabel}
      >
        {isSyncing ? (
          <RefreshCw size={13} className={styles.spin} />
        ) : !isOnline ? (
          <CloudOff size={13} />
        ) : (
          <span className={`${styles.dot} ${dotStateClass}`} />
        )}
        <span className={styles.pillText}>{statusLabel}</span>
        {totalCount > 0 && (
          <span
            className={`${styles.countBadge} ${
              failedCount > 0 ? styles.countBadgeFailed : ''
            }`}
          >
            {totalCount}
          </span>
        )}
      </button>

      {dialogOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setDialogOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
              <div className={styles.titleGroup}>
                {isOnline ? (
                  <Wifi size={18} style={{ color: '#10b981' }} />
                ) : (
                  <CloudOff size={18} style={{ color: '#f43f5e' }} />
                )}
                <span>طابور العمل بدون إنترنت والمزامنة اللحظية</span>
              </div>
              <div className={styles.headerActions}>
                {totalCount > 0 && (
                  <button
                    type="button"
                    className={styles.syncNowBtn}
                    disabled={!isOnline || isSyncing}
                    onClick={() => void retryAll()}
                  >
                    <RefreshCw size={13} className={isSyncing ? styles.spin : ''} />
                    <span>مزامنة الكل الآن</span>
                  </button>
                )}
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => setDialogOpen(false)}
                  aria-label="إغلاق"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className={styles.noticeBanner}>
              يقتصر الحفظ بدون إنترنت على <strong>المسودات الميدانية فقط</strong> (يوميات العمالة، المصروفات العامة، ومصروفات العهد المفتوحة) مع رفع المرفقات تلقائياً عبر Telegram Bot بالترتيب الزمني (FIFO) فور عودة الاتصال. عمليات الترحيل والاعتماد والتسوية تتطلب اتصالاً مباشراً بالخادم.
            </div>

            <div className={styles.listBody}>
              {items.length === 0 ? (
                <div className={styles.emptyState}>
                  <CheckCircle2
                    size={34}
                    style={{ color: '#10b981', margin: '0 auto 0.6rem', display: 'block' }}
                  />
                  <div>لا توجد مسودات معلّقة في طابور عدم الاتصال — جميع بياناتك محدّثة لحظياً.</div>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className={`${styles.itemCard} ${
                      item.status === 'failed' ? styles.itemCardFailed : ''
                    }`}
                  >
                    <div className={styles.itemTop}>
                      <div className={styles.badgesGroup}>
                        <span className={styles.typeBadge}>{entityLabel(item.entity_type)}</span>
                        <span className={styles.companyBadge}>{item.company_name}</span>
                        {item.has_attachment && (
                          <span className={styles.companyBadge} title="يحتوي على مرفق محلي">
                            <Paperclip size={11} style={{ display: 'inline', marginLeft: 3 }} />
                            مرفق تيليجرام
                          </span>
                        )}
                      </div>
                      <span className={styles.amountTag}>
                        {Number(item.amount || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        ر.س
                      </span>
                    </div>

                    <p className={styles.descText}>{item.description}</p>

                    {item.last_error && (
                      <div className={styles.errorBox}>سبب التوقف: {item.last_error}</div>
                    )}

                    <div className={styles.itemBottom}>
                      <span>
                        {new Date(item.created_at).toLocaleString('ar-SA')} ·{' '}
                        {item.status === 'syncing'
                          ? 'جاري الرفع...'
                          : item.status === 'failed'
                          ? `فشلت المحاولة (${item.retry_count})`
                          : 'بانتظار الاتصال'}
                      </span>
                      <div className={styles.itemBtns}>
                        <button
                          type="button"
                          className={styles.smallBtn}
                          disabled={!isOnline || isSyncing}
                          onClick={() => void retryItem(item.id)}
                        >
                          <RefreshCw size={11} />
                          <span>إعادة المحاولة</span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.smallBtn} ${styles.smallBtnDanger}`}
                          disabled={isSyncing}
                          onClick={() => void deleteItem(item.id)}
                        >
                          <Trash2 size={11} />
                          <span>حذف المسودة</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
