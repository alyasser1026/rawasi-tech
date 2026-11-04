"use client";

import React, { useMemo } from 'react';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import { useJournalErrorsLogic } from './JournalErrors_logic';

// 🛡️ معايير الأمان
import AuthGuard from '@/components/authGuard'; 
import MasterPage from '@/components/MasterPage';
import SecureAction from '@/components/SecureAction'; 

// 🎨 معايير الواجهة 
import GlassContainer from '@/components/GlassContainer'; 

// 🏗️ معايير إعادة الاستخدام 
import RawasiSmartTable from '@/components/rawasismarttable'; 

// 🚀 المكون السحري لنقل الأزرار للسايد بار
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import { ScanSearch } from 'lucide-react';
import PhiIcon from '@/components/PhiIcon';

export default function JournalMaintenancePage() {
    const logic = useJournalErrorsLogic();

    // داتا الـ KPIs 
    const kpis = [
        { title: 'قيود مكررة', value: logic.filteredDuplicates.length, color: '#ea580c', icon: '👯' },
        { title: 'غير متزنة', value: logic.filteredUnbalanced.length, color: '#7c3aed', icon: '⚖️' },
        { title: 'قيود يتيمة', value: logic.filteredOrphans.length, color: THEME.ruby, icon: '🗑️' },
        { title: 'قيود صفرية', value: logic.filteredEmpty.length, color: '#475569', icon: '🕳️' },
        { title: 'سطور شبح', value: logic.filteredGhosts.length, color: '#0891b2', icon: '👻' }
    ];

    // =========================================================
    // 📋 تصميم الأزرار (Actions) اللي هتروح للسايد بار
    // =========================================================
    const SidebarActions = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <SecureAction module="journal_audit" action="view">
                <button 
                    onClick={logic.scanForErrors} 
                    disabled={logic.isLoading} 
                    className="sidebar-action-btn primary"
                >
                    {logic.isLoading ? 'جاري المسح...' : 'إطلاق الرادار'}
                </button>
            </SecureAction>
            
            <button onClick={logic.exportErrorsToExcel} className="sidebar-action-btn success">
                تصدير إكسل
            </button>

            {logic.selectedIds.length > 0 && (
                <SecureAction module="journal_audit" action="delete">
                    <button onClick={logic.deleteSelected} className="sidebar-action-btn danger">
                        مسح المحددة ({logic.selectedIds.length})
                    </button>
                </SecureAction>
            )}
        </div>
    );

    return (
        <MasterPage title="رادار الأخطاء والتنبيهات" subtitle="مراقبة وتصحيح المشاكل المحاسبية والقيود المفقودة">
        <AuthGuard requiredRoles={['super_admin', 'admin', 'auditor']}>
            
            {/* 🚀 1. استخدام مدير السايد بار لنقل الزراير أوتوماتيكياً */}
            <RawasiSidebarManager 
                actions={SidebarActions} 
                onSearch={logic.setSearchQuery}
                watchDeps={[logic.isLoading, logic.selectedIds.length]} 
            />

            <div className="sovereign-glass-wrapper clean-page" style={{ padding: 'clamp(15px, 3vw, 30px)', direction: 'rtl', fontFamily: 'Cairo, sans-serif', minHeight: '100vh', position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <GlassContainer>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* شريط الإحصائيات (KPIs) */}
                            <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
                                {kpis.map((kpi, idx) => (
                                    <div key={idx} style={{ flex: 1, minWidth: '120px', background: `${kpi.color}10`, padding: '15px', borderRadius: '16px', border: `1px solid ${kpi.color}30`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ display: 'inline-flex' }}><PhiIcon value={kpi.icon} size={22} /></span>
                                        <span style={{ fontSize: '20px', fontWeight: 900, color: kpi.color }}>{kpi.value}</span>
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>{kpi.title}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </GlassContainer>

                    {/* 🔍 منطقة الجداول */}
                    {!logic.hasScanned ? (
                        <div style={{ textAlign: 'center', padding: '100px 20px', color: '#94a3b8', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', borderRadius: '14px', border: '2px dashed #cbd5e1' }}>
                            <div style={{ fontSize: '60px', marginBottom: '15px', animation: 'pulse 2s infinite' }}><ScanSearch size={40} aria-hidden="true" /></div>
                            <h2 style={{ color: THEME.primary, fontWeight: 900 }}>النظام جاهز للفحص</h2>
                            <p style={{ fontSize: '15px' }}>استخدم زر "إطلاق الرادار" من القائمة الجانبية للبدء.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                            <AuditSection logic={logic} data={logic.filteredDuplicates} title="سندات مكررة" color="#ea580c" icon="👯" actionText="مسح التكرار" onAction={logic.deleteHeader} />
                            <AuditSection logic={logic} data={logic.filteredUnbalanced} title="قيود غير متزنة" color="#7c3aed" icon="⚖️" actionText="موازنة آلية" onAction={(id:any, item:any) => logic.forceBalanceJournal(id, item.diffAmount)} secondaryAction={logic.deleteHeader} secondaryActionText="حذف نهائي" />
                            <AuditSection logic={logic} data={logic.filteredOrphans} title="القيود اليتيمة" color={THEME.ruby} icon="🗑️" actionText="مسح القيد" onAction={logic.deleteHeader} />
                            <AuditSection logic={logic} data={logic.filteredEmpty} title="القيود الصفرية" color="#475569" icon="🕳️" actionText="مسح القيد" onAction={logic.deleteHeader} />
                            <AuditSection logic={logic} data={logic.filteredGhosts} title="سطور شبح" color="#0891b2" icon="👻" actionText="تطهير السطور" onAction={(id:any) => logic.deleteHeader(id, true)} />
                        </div>
                    )}
                </div>

                <style>{`
                    .sidebar-action-btn {
                        padding: 12px; border-radius: 10px; font-weight: 900; cursor: pointer; border: none; width: 100%; transition: 0.3s;
                    }
                    .sidebar-action-btn.primary { background: ${THEME.primary}; color: white; box-shadow: 0 5px 15px ${THEME.primary}40; }
                    .sidebar-action-btn.success { background: rgba(22, 163, 74, 0.1); color: #16a34a; border: 1px solid rgba(22, 163, 74, 0.2); }
                    .sidebar-action-btn.danger { background: rgba(225, 29, 72, 0.1); color: #e11d48; border: 1px solid rgba(225, 29, 72, 0.2); }
                    @media (max-width: 768px) { .hidden-on-mobile { display: none; } }
                `}</style>
            </div>
        </AuthGuard>
        </MasterPage>
    );
}

// ==========================================================
// 🍏 مكون القسم الذكي
// ==========================================================
// ==========================================================
// 🍏 مكون القسم الذكي (نسخة محمية ضد الـ Undefined)
// ==========================================================
// 🍏 مكون القسم الذكي (AuditSection) - ميثاق فاي تك الماسي V11
// ==========================================================
function AuditSection({ logic, data, title, color, icon, actionText, onAction, secondaryAction, secondaryActionText }: any) {
    // 🛡️ حارس رندر إلزامي: منع معالجة المصفوفات الفارغة أو غير المعرفة
    if (!data || data.length === 0) return null;

    const columns = useMemo(() => [
        {
            key: 'id',
            label: 'رقم القيد',
            render: (item: any) => {
                // 🛡️ الباب الأول بند 3: حارس الرندر الإلزامي لمنع الانهيار
                if (!item || !item.id) return null; 

                return (
                    <span style={{ fontWeight: 900, fontFamily: 'monospace', color: '#334155' }}>
                        {/* 🛡️ الباب التاسع: صرامة الأنواع (Strict Casting) لضمان توافق الـ UUID */}
                        {item.isGhost ? 'GHOST' : `JRN-${String(item.id).slice(0,8).toUpperCase()}`}
                    </span>
                );
            }
        },
        {
            key: 'details',
            label: 'البيان وهوية المستند',
            render: (item: any) => {
                // 🛡️ حارس رندر إلزامي
                if (!item) return null; 

                const documentDate = item.entry_date || item.date || item.created_at?.split('T')[0];
                const documentAmount = item.totalAmount || item.amount || Math.abs(item.diffAmount || 0);
                const refId = item.reference_id || item.reference_number;

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{item.description || 'لا يوجد بيان'}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            <span style={{ background: `${color}15`, color: color, padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 900 }}>
                                {formatCurrency(documentAmount)}
                            </span>
                            {documentDate && <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{documentDate}</span>}
                            {refId && (
                                <span style={{ background: 'rgba(255, 247, 237, 0.8)', color: '#d97706', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', border: '1px dashed #fcd34d' }}>
                                    {/* 🛡️ الباب التاسع: إجبار المعرفات المحاسبية باستخدام String(id) */}
                                    {String(refId).slice(0, 8)}
                                </span>
                            )}
                        </div>
                    </div>
                );
            }
        },
        {
            key: 'diagnosis',
            label: 'التشخيص والحل',
            render: (item: any) => {
                // 🛡️ حارس رندر إلزامي[cite: 22]
                if (!item) return null; 
                return (
                    <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
                        <div style={{ color: color, fontWeight: 'bold' }}>{item.diagnosis}</div>
                        <div style={{ color: '#059669', marginTop: '3px' }}>{item.solution}</div>
                    </div>
                );
            }
        },
        {
            key: 'actions',
            label: 'إجراء سريع',
            render: (item: any) => {
                // 🛡️ حارس رندر إلزامي[cite: 22]
                if (!item || !item.id) return null; 

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {/* 🛡️ الأمان المجهري: فحص الصلاحية بـ SecureAction[cite: 22] */}
                        <SecureAction module="journal_audit" action="edit">
                            <button 
                                onClick={() => onAction(String(item.id), item)} 
                                style={{ padding: '6px 12px', background: color, color: 'white', border: 'none', borderRadius: '6px', fontWeight: 900, cursor: 'pointer', fontSize: '11px' }}
                            >
                                {actionText}
                            </button>
                        </SecureAction>
                        {secondaryAction && (
                            <SecureAction module="journal_audit" action="delete">
                                <button 
                                    onClick={() => secondaryAction(String(item.id))} 
                                    style={{ background: 'none', border: 'none', color: '#e11d48', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    {secondaryActionText}
                                </button>
                            </SecureAction>
                        )}
                    </div>
                );
            }
        }
    ], [color, actionText, secondaryActionText, onAction, secondaryAction]);

    return (
        <GlassContainer>
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '15px', 
                padding: '10px 15px', 
                background: `${color}10`, 
                borderRadius: '10px', 
                borderRight: `5px solid ${color}` 
            }}>
                <h3 style={{ margin: 0, color: color, fontWeight: 900, fontSize: '15px' }}>
                    <PhiIcon value={icon} size={18} /> {title} ({data.length})
                </h3>
            </div>

            {/* 🏗️ استخدام المحرك الذكي السيادي (RawasiSmartTable)[cite: 22] */}
            <RawasiSmartTable 
                columns={columns} 
                data={data} 
                selectable={true} 
                selectedIds={logic.selectedIds} 
                onSelectionChange={logic.setSelectedIds} 
            />
        </GlassContainer>
    );
}
