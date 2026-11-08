"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useAuditPendingCounts, AuditPendingCounts } from '@/hooks/useAuditPendingCounts';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { useNotificationsLogic } from '@/app/notifications/NotificationsLogic';
import styles from './AuditPendingCenter.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface AuditRowDef {
  key: keyof Omit<AuditPendingCounts, 'totalPending'>;
  title: string;
  icon: string;
  path: string;
}

const AUDIT_ROWS: AuditRowDef[] = [
  {
    key: 'manualJournals',
    title: 'قيود اليومية غير المرحلة',
    icon: '📝',
    path: '/ManualJournals',
  },
  {
    key: 'paymentVouchers',
    title: 'سندات صرف غير مرحلة',
    icon: '📤',
    path: '/PaymentVouchers',
  },
  {
    key: 'receiptVouchers',
    title: 'سندات قبض غير معتمدة',
    icon: '📥',
    path: '/ReceiptVouchers',
  },
  {
    key: 'salesInvoices',
    title: 'فواتير مبيعات غير مرحلة',
    icon: '📄',
    path: '/invoices',
  },
  {
    key: 'expenses',
    title: 'مصروفات غير مرحلة',
    icon: '💸',
    path: '/expenses',
  },
  {
    key: 'materialIssues',
    title: 'حركات مستودع غير معتمدة',
    icon: '📦',
    path: '/material_issues',
  },
  {
    key: 'accountingAdjustments',
    title: 'تسويات محاسبية غير مرحلة',
    icon: '⚖️',
    path: '/cash-closing',
  },
  {
    key: 'fleetTrips',
    title: 'رحلات أسطول وتوزيع معلقة',
    icon: '🚚',
    path: '/overhead',
  },
  {
    key: 'cashierShifts',
    title: 'ورديات كاشير بانتظار التوريد',
    icon: '🏪',
    path: '/cashflows',
  },
];

export default function AuditPendingCenter({ isOpen, onClose }: Props) {
  const router = useRouter();
  const { counts, isRefreshing, refresh } = useAuditPendingCounts();
  const { unread_notifications } = useUnreadCounts();
  const { notifications, isLoading: isNotifLoading, markAsRead, markAllAsRead } = useNotificationsLogic();
  
  const [activeTab, setActiveTab] = useState<'audit' | 'notifications'>('audit');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRowClick = (path: string) => {
    onClose();
    router.push(path);
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div
        className={styles.panel}
        ref={panelRef}
        role="dialog"
        aria-label="مركز التدقيق والمعلقات"
        onClick={e => e.stopPropagation()}
      >
        {activeTab === 'audit' ? (
          <>
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerTitle}>
                <span style={{ fontSize: '18px', display: 'inline-block' }}>🔔</span>
                <span>مركز التدقيق والمعلقات</span>
              </div>
              <div className={styles.headerActions}>
                <button
                  type="button"
                  className={styles.refreshBtn}
                  onClick={() => refresh()}
                  title="تحديث المعلقات لحظياً"
                  aria-label="تحديث المعلقات"
                >
                  <RefreshCw size={13} className={isRefreshing ? styles.spin : undefined} />
                </button>
                <div className={styles.pendingPill}>
                  {counts.totalPending.toLocaleString('en-US')} معلق
                </div>
              </div>
            </div>

            <div className={styles.divider} />

            {/* List of 9 Audit Categories */}
            <div className={styles.itemsList}>
              {AUDIT_ROWS.map((row, idx) => {
                const count = counts[row.key] ?? 0;
                const isSelected = selectedIndex === idx;

                return (
                  <button
                    key={row.key}
                    type="button"
                    className={`${styles.itemRow} ${isSelected ? styles.itemRowActive : ''}`}
                    onClick={() => handleRowClick(row.path)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    title={`انتقال إلى ${row.title}`}
                  >
                    <div className={styles.itemContent}>
                      <span className={styles.itemIcon}>{row.icon}</span>
                      <span className={styles.itemLabel}>{row.title}</span>
                    </div>

                    <div>
                      {count === 0 ? (
                        <span className={styles.zeroBadge}>0</span>
                      ) : (
                        <span className={styles.countPill}>
                          {count.toLocaleString('en-US')}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom Card: System Notifications */}
            <button
              type="button"
              className={styles.notificationsCard}
              onClick={() => setActiveTab('notifications')}
              title="عرض إشعارات وتنبيهات النظام"
            >
              <div className={styles.notificationsCardLabel}>
                <span style={{ fontSize: '17px', display: 'inline-block' }}>🔔</span>
                <span>إشعارات وتنبيهات النظام</span>
              </div>

              <div className={styles.notifBadge}>
                {unread_notifications > 0 ? unread_notifications : 0}
              </div>
            </button>
          </>
        ) : (
          /* Notifications Subview */
          <div>
            <div className={styles.notifHeader}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => setActiveTab('audit')}
                title="الرجوع لمركز المعلقات"
              >
                <ChevronRight size={16} />
                <span>العودة للمعلقات</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {notifications.some(n => !n.is_read) && (
                  <button
                    type="button"
                    className={styles.markAllBtn}
                    onClick={() => markAllAsRead()}
                  >
                    <CheckCheck size={14} style={{ display: 'inline', marginInlineEnd: '3px' }} />
                    تحديد الكل
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  aria-label="إغلاق"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.notifList}>
              {isNotifLoading ? (
                <div className={styles.notifEmpty}>
                  <LoaderCircle size={22} className={styles.spin} />
                  <span>جاري تحميل الإشعارات...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className={styles.notifEmpty}>
                  <BellOff size={28} style={{ color: '#94a3b8' }} />
                  <strong>لا توجد إشعارات حالياً</strong>
                  <span style={{ fontSize: '11.5px' }}>سيتم إعلامك فور صدور أي تنبيه جديد</span>
                </div>
              ) : (
                notifications.slice(0, 10).map(notif => {
                  const Icon =
                    notif.type === 'alert'
                      ? TriangleAlert
                      : notif.type === 'success'
                      ? CircleCheck
                      : notif.type === 'task'
                      ? ClipboardList
                      : Bell;

                  return (
                    <div
                      key={notif.id}
                      className={`${styles.notifItem} ${!notif.is_read ? styles.notifItemUnread : ''}`}
                      onClick={() => !notif.is_read && markAsRead(notif.id)}
                    >
                      <Icon size={16} style={{ color: notif.type === 'alert' ? '#ef4444' : '#f59e0b', marginTop: '2px', flexShrink: 0 }} />
                      <div className={styles.notifMeta}>
                        <div className={styles.notifMessage}>{notif.message || notif.content}</div>
                        <div className={styles.notifTime}>
                          {new Date(notif.created_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className={styles.notifFooter}>
              <Link
                href="/notifications"
                className={styles.notifFooterLink}
                onClick={onClose}
              >
                فتح صفحة الإشعارات الكاملة ←
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
