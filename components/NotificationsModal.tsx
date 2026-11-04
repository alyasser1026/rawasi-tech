"use client";
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellOff, CheckCheck, CircleCheck, ClipboardList, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import { useNotificationsLogic } from '@/app/notifications/NotificationsLogic';
import { useDialogFocus } from '@/hooks/useDialogFocus';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function NotificationsModal({ isOpen, onClose }: Props) {
    const { notifications, isLoading, markAsRead, markAllAsRead } = useNotificationsLogic();
    const [mounted, setMounted] = useState(false);
    const panel = useRef<HTMLDivElement>(null);
    const titleId = useId();
    useEffect(() => { setMounted(true); }, []);
    useDialogFocus(panel, isOpen && mounted, onClose);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="phi-modal-backdrop phi-notifications-backdrop" onClick={onClose}>
            <div className="phi-notifications phi-modal-panel" ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event => event.stopPropagation()}>
                <header className="phi-notifications-header">
                    <div>
                        <h2 id={titleId}><Bell size={21} /> مركز الإشعارات</h2>
                        <p>متابعة التنبيهات والأحداث الخاصة بك</p>
                    </div>
                    <div className="phi-notifications-actions">
                        {notifications.some(notification => !notification.is_read) && (
                            <button type="button" className="ent-button" onClick={markAllAsRead}>
                                <CheckCheck size={16} /> تحديد الكل كمقروء
                            </button>
                        )}
                        <button type="button" className="ent-icon-button" onClick={onClose} aria-label="إغلاق الإشعارات"><X size={19} /></button>
                    </div>
                </header>
                <div className="phi-notifications-body cinematic-scroll">
                    {isLoading ? (
                        <div className="phi-notifications-empty" role="status">
                            <LoaderCircle size={29} className="phi-dialog-spinner" />
                            <strong>جاري جلب الإشعارات...</strong>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="phi-notifications-empty">
                            <BellOff size={34} />
                            <strong>لا توجد إشعارات حالياً</strong>
                            <p>سيتم إعلامك هنا عند وجود أي تحديثات مهمة</p>
                        </div>
                    ) : (
                        <div className="phi-notification-list">
                            {notifications.map(notification => {
                                const Icon = notification.type === 'alert' ? TriangleAlert : notification.type === 'success' ? CircleCheck : notification.type === 'task' ? ClipboardList : Bell;
                                return (
                                    <article key={notification.id} className={`phi-notification ${notification.is_read ? 'is-read' : 'is-unread'}`}>
                                        <span className={`phi-notification-icon ${notification.type || ''}`}><Icon size={20} /></span>
                                        <div className="phi-notification-content">
                                            <div className="phi-notification-meta">
                                                <h3>{notification.message || notification.content}</h3>
                                                <time dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</time>
                                            </div>
                                            {!notification.is_read && <button type="button" className="phi-mark-read" onClick={() => markAsRead(notification.id)}>علامة كمقروء</button>}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}