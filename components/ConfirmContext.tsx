"use client";
import React, { createContext, useContext, useId, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, TriangleAlert } from 'lucide-react';
import { useDialogFocus } from '@/hooks/useDialogFocus';

// 1. تعريف نوع البيانات
type ConfirmOptions = {
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning';
};

type ConfirmContextType = {
    showConfirm: (options: ConfirmOptions) => void;
};

// 2. إنشاء الـ Context
const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

// 3. الـ Provider اللي هيغلف السيستم كله
export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
    const [confirmState, setConfirmState] = useState<{ isOpen: boolean; options: ConfirmOptions | null }>({
        isOpen: false,
        options: null,
    });
    const panel = useRef<HTMLDivElement>(null);
    const dialogId = useId();

    const showConfirm = (options: ConfirmOptions) => {
        setConfirmState({ isOpen: true, options });
    };

    const closeConfirm = () => {
        setConfirmState({ isOpen: false, options: null });
    };

    useDialogFocus(panel, confirmState.isOpen, closeConfirm);

    const handleConfirm = () => {
        if (confirmState.options?.onConfirm) {
            confirmState.options.onConfirm();
        }
        closeConfirm();
    };

    return (
        <ConfirmContext.Provider value={{ showConfirm }}>
            {children}

            {/* 🚀 نافذة التأكيد الزجاجية الفخمة تظهر هنا على مستوى السيستم */}
            {confirmState.isOpen && confirmState.options && typeof document !== 'undefined' && createPortal(
                <div className="phi-modal-backdrop phi-confirm-backdrop" onKeyDownCapture={event => {
                    // Handle Escape before an underlying form's document listener.
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        event.stopPropagation();
                        closeConfirm();
                    }
                }}>
                    <div className={`phi-modal-panel phi-confirm-dialog ${confirmState.options.type === 'warning' ? 'is-warning' : 'is-danger'}`} ref={panel} role="alertdialog" aria-modal="true" aria-labelledby={`${dialogId}-title`} aria-describedby={`${dialogId}-message`}>
                        
                        <div className="phi-confirm-icon">
                            {confirmState.options.type === 'warning' ? <TriangleAlert size={27} /> : <ShieldAlert size={27} />}
                        </div>
                        
                        <h2 id={`${dialogId}-title`}>
                            {confirmState.options.title}
                        </h2>
                        
                        <p id={`${dialogId}-message`}>
                            {confirmState.options.message}
                        </p>
                        
                        <div className="phi-confirm-actions">
                            <button 
                                onClick={handleConfirm} 
                                type="button"
                                className="ent-button phi-confirm-submit"
                            >
                                {confirmState.options.confirmText || 'نعم، تأكيد'}
                            </button>
                            <button 
                                onClick={closeConfirm} 
                                type="button"
                                className="ent-button"
                                data-autofocus
                            >
                                {confirmState.options.cancelText || 'إلغاء والتراجع'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </ConfirmContext.Provider>
    );
};

// 4. دالة الاستدعاء (Hook)
export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) throw new Error('useConfirm must be used within a ConfirmProvider');
    return context;
};
