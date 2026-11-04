"use client";
import React, { useState } from 'react';
import { usePermissions } from '@/lib/PermissionsContext';
import { THEME } from '@/lib/theme';
import { toast } from 'react-hot-toast';
import { TriangleAlert } from 'lucide-react';

interface SecureActionProps {
    module: string;
    action: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export default function SecureAction({ module, action, children, fallback = null }: SecureActionProps) {
    const { can, loading, role } = usePermissions();
    const [showDeniedModal, setShowDeniedModal] = useState(false);
    
    // لحالة تأكيد الحذف
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [pendingEvent, setPendingEvent] = useState<any>(null);
    const [originalOnClick, setOriginalOnClick] = useState<((e: any) => void) | null>(null);

    if (loading) return null; 

    // 🛠️ دالة مساعدة لتغليف أزرار الحذف برسالة تأكيد كوميدية
    const renderWithDeleteConfirmation = (content: React.ReactNode) => {
        if (action !== 'delete') return <>{content}</>;
        
        return (
            <>
                {React.Children.map(content, child => {
                    if (React.isValidElement<{ onClick?: React.MouseEventHandler }>(child)) {
                        return React.cloneElement(child, {
                            onClick: (e: any) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // نحفظ الدالة الأصلية والحدث لنمررهم لاحقاً
                                setOriginalOnClick(() => child.props.onClick || null);
                                setPendingEvent(e);
                                setShowDeleteConfirm(true);
                            }
                        });
                    }
                    return child;
                })}

                {showDeleteConfirm && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(5px)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{ background: '#f8fafc', padding: '30px', borderRadius: '14px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', animation: 'scaleUp 0.3s ease-out', maxWidth: '400px', width: '90%', border: `2px solid ${THEME.danger || '#ef4444'}` }}>
                            <div style={{ marginBottom: '20px', fontSize: '40px' }}>
                                <TriangleAlert size={34} aria-hidden="true" />
                            </div>
                            <h2 style={{ color: THEME.danger || '#ef4444', fontWeight: 900, marginBottom: '10px', fontSize: '24px' }}>
                                هل أنت متأكد من الحذف؟
                            </h2>
                            <p style={{ color: '#64748b', fontSize: '14px', fontWeight: 700, marginBottom: '25px' }}>
                                لا يمكن التراجع عن هذه العملية بعد إتمامها.
                            </p>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <button 
                                    onClick={() => {
                                        setShowDeleteConfirm(false);
                                        if (originalOnClick) {
                                            originalOnClick(pendingEvent);
                                        }
                                    }}
                                    style={{ flex: 1, padding: '12px', background: THEME.danger || '#ef4444', color: 'white', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: '15px', transition: '0.3s' }}
                                >
                                    نعم
                                </button>
                                <button 
                                    onClick={() => setShowDeleteConfirm(false)}
                                    style={{ flex: 1, padding: '12px', background: '#e2e8f0', color: '#475569', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: '15px', transition: '0.3s' }}
                                >
                                    لا
                                </button>
                            </div>
                        </div>
                        <style>{`
                            @keyframes scaleUp {
                                from { transform: scale(0.5); opacity: 0; }
                                to { transform: scale(1); opacity: 1; }
                            }
                        `}</style>
                    </div>
                )}
            </>
        );
    };

    const hasAccess = role === 'super_admin' || role === 'admin' || can(module, action);

    if (hasAccess) {
        return renderWithDeleteConfirmation(children);
    }
    
    // إذا كان الأكشن "post" (ترحيل) ومفيش صلاحية، نظهر الزر، ولما يضغط تطلع له توست عادية
    if (action === 'post') {
        return (
            <>
                {React.Children.map(children, child => {
                    if (React.isValidElement(child)) {
                        return React.cloneElement(child as any, {
                            onClick: (e: any) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toast.error('عفواً، لا تملك صلاحية الترحيل');
                            }
                        });
                    }
                    return child;
                })}
            </>
        );
    }

    return <>{fallback}</>;
}
