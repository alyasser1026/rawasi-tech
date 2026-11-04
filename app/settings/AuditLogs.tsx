"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { THEME } from '@/lib/theme';
import RawasiSmartTable from '@/components/rawasismarttable';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/helpers';
import { createPortal } from 'react-dom';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { notify } from '@/lib/notify';

export default function AuditLogs() {
    const router = useRouter();
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<any>(null);
    const [mounted, setMounted] = useState(false);

    const [filterUser, setFilterUser] = useState<string>('');
    const [filterTable, setFilterTable] = useState<string>('');
    const [filterAction, setFilterAction] = useState<string>('');
    const [filterDate, setFilterDate] = useState<string>('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);

    const processedLogs = useMemo(() => {
        return logs.map(log => {
            let effectiveAction = log.action;
            if (log.action === 'UPDATE' && log.old_data && log.new_data) {
                const o = log.old_data;
                const n = log.new_data;
                if ((o.is_posted === false && n.is_posted === true) || (o.status === 'مسودة' && (n.status === 'مرحل' || n.status === 'معتمد'))) {
                    effectiveAction = 'POST';
                } else if ((o.is_posted === true && n.is_posted === false) || ((o.status === 'مرحل' || o.status === 'معتمد') && n.status === 'مسودة')) {
                    effectiveAction = 'UNPOST';
                }
            }
            return { ...log, effective_action: effectiveAction };
        });
    }, [logs]);

    const uniqueUsers = useMemo(() => Array.from(new Set(processedLogs.map(log => log.profiles?.full_name || 'System / Unknown'))).filter(Boolean) as string[], [processedLogs]);
    const uniqueTables = useMemo(() => Array.from(new Set(processedLogs.map(log => log.table_name))).filter(Boolean) as string[], [processedLogs]);
    const uniqueActions = useMemo(() => Array.from(new Set(processedLogs.map(log => log.effective_action))).filter(Boolean) as string[], [processedLogs]);

    const filteredLogs = useMemo(() => {
        return processedLogs.filter(log => {
            const matchUser = filterUser ? (log.profiles?.full_name || 'System / Unknown') === filterUser : true;
            const matchTable = filterTable ? log.table_name === filterTable : true;
            const matchAction = filterAction ? log.effective_action === filterAction : true;
            const matchDate = filterDate ? log.created_at.startsWith(filterDate) : true;
            return matchUser && matchTable && matchAction && matchDate;
        });
    }, [processedLogs, filterUser, filterTable, filterAction, filterDate]);

    useEffect(() => {
        setMounted(true);
    }, []);

    // ==========================================
    // 🛡️ Security Guard
    // ==========================================
    useEffect(() => {
        const checkAccess = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error || !session?.user) return router.push('/login');

                const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin' && !profile.permissions?.audit_logs?.view)) {
                    notify("ليس لديك صلاحية لمشاهدة سجل المراقبة.");
                    router.push('/');
                }
            } catch (err) {
                console.warn("Check access error:", err);
            }
        };
        checkAccess();
    }, [router]);

    // ==========================================
    // 📡 Data Fetching
    // ==========================================
    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*, profiles(full_name, role)')
                .order('created_at', { ascending: false })
                .limit(5000); // إحضار آخر 5000 حركة كحد أقصى للأداء
            
            if (error) throw error;
            setLogs(data || []);
        } catch (error: any) {
            console.error("Fetch Error:", error);
            notify("خطأ في جلب السجلات: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { 
        // 🛠️ تأخير طفيف لتجنب تداخل الـ Locks مع getSession
        const timer = setTimeout(() => {
            fetchLogs();
        }, 300);
        return () => clearTimeout(timer);
    }, []);

    // ==========================================
    // Table Columns Configuration
    // ==========================================
    const columns = [
        { 
            key: 'created_at', 
            label: 'التاريخ والوقت', 
            sortable: true,
            render: (row: any) => <div style={{ direction: 'ltr', textAlign: 'right', fontWeight: 800 }}>{formatDate(row.created_at, true)}</div>
        },
        { 
            key: 'profiles.full_name', 
            label: 'بواسطة (المستخدم)', 
            sortable: true,
            render: (row: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 900, color: THEME.brand.coffee }}>{row.profiles?.full_name || 'System / Unknown'}</span>
                    <span style={{ fontSize: '10px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{row.profiles?.role || '---'}</span>
                </div>
            )
        },
        { 
            key: 'action', 
            label: 'نوع العملية', 
            sortable: true,
            render: (row: any) => {
                let actionType = row.action;
                const colors: any = { 'INSERT': '#22c55e', 'UPDATE': '#f59e0b', 'DELETE': '#ef4444', 'LOGIN': '#3b82f6', 'FAILED_POST': '#dc2626', 'FAILED_UNPOST': '#dc2626' };
                const labels: any = { 'INSERT': 'إضافة', 'UPDATE': 'تعديل', 'DELETE': 'حذف', 'LOGIN': 'تسجيل دخول', 'FAILED_POST': 'محاولة ترحيل مرفوضة', 'FAILED_UNPOST': 'محاولة فك ترحيل مرفوضة' };
                
                let displayColor = colors[actionType] || '#64748b';
                let displayLabel = labels[actionType] || actionType;

                if (actionType === 'UPDATE' && row.old_data && row.new_data) {
                    const o = row.old_data;
                    const n = row.new_data;
                    if ((o.is_posted === false && n.is_posted === true) || (o.status === 'مسودة' && (n.status === 'مرحل' || n.status === 'معتمد'))) {
                        displayColor = '#10b981'; 
                        displayLabel = 'ترحيل';
                        actionType = 'POST'; // for unique tracking if needed
                    } else if ((o.is_posted === true && n.is_posted === false) || ((o.status === 'مرحل' || o.status === 'معتمد') && n.status === 'مسودة')) {
                        displayColor = '#8b5cf6';
                        displayLabel = 'فك ترحيل';
                        actionType = 'UNPOST';
                    }
                }

                return (
                    <span style={{ background: `${displayColor}15`, color: displayColor, padding: '6px 12px', borderRadius: '12px', fontWeight: 900, fontSize: '12px' }}>
                        {displayLabel}
                    </span>
                );
            }
        },
        { 
            key: 'table_name', 
            label: 'الجدول المستهدف', 
            sortable: true,
            render: (row: any) => <span style={{ fontWeight: 800, background: '#e2e8f0', padding: '4px 8px', borderRadius: '6px' }}>{row.table_name}</span>
        },
        {
            key: 'actions',
            label: 'التفاصيل',
            render: (row: any) => (
                <button 
                    onClick={() => setSelectedLog(row)}
                    style={{ background: 'white', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, transition: '0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = THEME.primary}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                >
                    عرض السجل
                </button>
            )
        }
    ];

    // ==========================================
    // Render JSON Diff
    // ==========================================
    const renderDiff = (oldData: any, newData: any) => {
        const o = oldData || {};
        const n = newData || {};
        const allKeys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)]));

        return (
            <div style={{ overflowX: 'auto', paddingBottom: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', direction: 'ltr', textAlign: 'left', minWidth: 'max-content' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '10px', background: '#e2e8f0', position: 'sticky', left: 0, zIndex: 2, borderRight: '1px solid #cbd5e1' }}>الحالة (State)</th>
                            {allKeys.map(key => {
                                const isChanged = JSON.stringify(o[key] ?? 'null') !== JSON.stringify(n[key] ?? 'null');
                                return (
                                    <th key={key} style={{ padding: '10px', fontWeight: 800, color: isChanged ? '#f59e0b' : '#475569', borderRight: '1px solid #e2e8f0' }}>
                                        {key} {isChanged && <RefreshCw size={16} aria-hidden="true" />}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{ borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                            <td style={{ padding: '10px', fontWeight: 900, color: '#22c55e', background: '#f0fdf4', position: 'sticky', left: 0, zIndex: 1, borderRight: '1px solid #cbd5e1' }}>القيد (New)</td>
                            {allKeys.map(key => {
                                const oldVal = JSON.stringify(o[key] ?? 'null');
                                const newVal = JSON.stringify(n[key] ?? 'null');
                                const isChanged = oldVal !== newVal;
                                return (
                                    <td key={key} style={{ padding: '10px', fontFamily: 'monospace', color: isChanged ? '#22c55e' : '#64748b', fontWeight: isChanged ? 900 : 500, borderRight: '1px solid #f1f5f9', background: isChanged ? '#fefce8' : 'transparent' }}>
                                        {n[key] !== undefined ? newVal : '-'}
                                    </td>
                                );
                            })}
                        </tr>
                        <tr style={{ background: '#f8fafc' }}>
                            <td style={{ padding: '10px', fontWeight: 900, color: '#ef4444', background: '#fef2f2', position: 'sticky', left: 0, zIndex: 1, borderRight: '1px solid #cbd5e1' }}>القيد القديم (Old)</td>
                            {allKeys.map(key => {
                                const oldVal = JSON.stringify(o[key] ?? 'null');
                                const newVal = JSON.stringify(n[key] ?? 'null');
                                const isChanged = oldVal !== newVal;
                                return (
                                    <td key={key} style={{ padding: '10px', fontFamily: 'monospace', color: isChanged ? '#ef4444' : '#94a3b8', textDecoration: isChanged ? 'line-through' : 'none', borderRight: '1px solid #f1f5f9', background: isChanged ? '#fefce8' : 'transparent' }}>
                                        {o[key] !== undefined ? oldVal : '-'}
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeUp 0.5s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                    <h2 style={{ fontSize: '18px', color: THEME.primary, margin: '0 0 5px 0', fontWeight: 900 }}>سجل المراقبة والنشاطات</h2>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: 700 }}>تتبع دقيق لجميع التعديلات والعمليات في النظام (Audit Logs)</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ background: '#f8fafc', border: `1px solid ${THEME.brand.gold}`, padding: '8px 16px', borderRadius: '10px' }}>
                        <span style={{fontSize:'12px', fontWeight:800, color:'#64748b'}}>إجمالي الحركات </span>
                        <span style={{fontSize:'18px', fontWeight:900, color: THEME.brand.gold}}>{filteredLogs.length}</span>
                    </div>
                    <button onClick={fetchLogs} style={{ background: THEME.primary, color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 900 }}>
                        تحديث السجل
                    </button>
                </div>
            </div>
            {logs.length === 0 && !isLoading && (
                <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '14px', border: `1px solid ${THEME.brand.gold}40` }}>
                    <div style={{ fontSize: '50px' }}><ShieldCheck size={40} aria-hidden="true" /></div>
                    <h3 style={{ color: THEME.brand.coffee, fontWeight: 900 }}>لم يتم تسجيل أي نشاط بعد أو أن المحرك غير مفعل</h3>
                    <p style={{ color: '#64748b' }}>يرجى التأكد من تشغيل سكريبت (SQL) الخاص بسجل المراقبة في قاعدة البيانات لتفعيل الرصد التلقائي.</p>
                </div>
            )}

            {logs.length > 0 && (
                <>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '5px', background: '#f8fafc', padding: '15px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                        <div style={{ flex: 1, minWidth: '150px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '5px' }}>المستخدم (User)</label>
                            <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                                <option value="">الكل (All)</option>
                                {uniqueUsers.map((user: string) => <option key={user} value={user}>{user}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1, minWidth: '150px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '5px' }}>الجدول (Table)</label>
                            <select value={filterTable} onChange={(e) => setFilterTable(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                                <option value="">الكل (All)</option>
                                {uniqueTables.map((table: string) => <option key={table} value={table}>{table}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1, minWidth: '150px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '5px' }}>نوع العملية (Action)</label>
                            <select
                                value={filterAction}
                                onChange={(e) => setFilterAction(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                            >
                                <option value="">الكل (All)</option>
                                {uniqueActions.map((action: string) => {
                                    const labels: any = { 'INSERT': 'إضافة', 'UPDATE': 'تعديل', 'DELETE': 'حذف', 'LOGIN': 'تسجيل دخول', 'POST': 'ترحيل', 'UNPOST': 'فك ترحيل', 'FAILED_POST': 'محاولة ترحيل مرفوضة', 'FAILED_UNPOST': 'محاولة فك ترحيل مرفوضة' };
                                    return <option key={action} value={action}>{labels[action] || action}</option>;
                                })}
                            </select>
                        </div>
                        <div style={{ flex: 1, minWidth: '150px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '5px' }}>التاريخ (Date)</label>
                            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit' }} />
                        </div>
                        {(filterUser || filterTable || filterAction || filterDate) && (
                            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                <button onClick={() => { setFilterUser(''); setFilterTable(''); setFilterAction(''); setFilterDate(''); }} style={{ padding: '10px 15px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 800, cursor: 'pointer' }}>
                                    مسح الفلاتر ✕
                                </button>
                            </div>
                        )}
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', padding: '20px', borderRadius: '14px', boxShadow: '0 20px 40px rgba(0,0,0,0.05)', border: '1px solid white' }}>
                        <RawasiSmartTable 
                            data={filteredLogs} 
                            columns={columns} 
                            searchPlaceholder="ابحث في السجل..."
                            isLoading={isLoading}
                            enablePagination={true}
                            currentPage={currentPage}
                            totalItems={filteredLogs.length}
                            rowsPerPage={rowsPerPage}
                            onPageChange={setCurrentPage}
                            onRowsChange={setRowsPerPage}
                        />
                    </div>
                </>
            )}

            {/* 🔍 Details Modal */}
            {mounted && selectedLog && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)' }} onClick={() => setSelectedLog(null)} />
                    
                    <div style={{ background: 'white', width: '900px', maxWidth: '95vw', maxHeight: '90vh', borderRadius: '14px', zIndex: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
                        <div style={{ padding: '25px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontWeight: 900, color: THEME.primary, fontSize: '20px' }}>تفاصيل العملية</h3>
                                <p style={{ margin: '5px 0 0', fontSize: '13px', color: '#64748b' }}>معرف السجل: {selectedLog.id}</p>
                            </div>
                            <button onClick={() => setSelectedLog(null)} style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '50%', width: '35px', height: '35px', cursor: 'pointer', fontWeight: 900 }}>✕</button>
                        </div>

                        <div style={{ padding: '25px', overflowY: 'auto', flex: 1 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '25px', background: '#f1f5f9', padding: '15px', borderRadius: '16px' }}>
                                <div><span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 800 }}>الجدول:</span><span style={{ fontWeight: 900 }}>{selectedLog.table_name}</span></div>
                                <div><span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 800 }}>العملية:</span><span style={{ fontWeight: 900 }}>{selectedLog.action}</span></div>
                                <div><span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 800 }}>الوقت:</span><span style={{ fontWeight: 900, direction: 'ltr', display: 'inline-block' }}>{formatDate(selectedLog.created_at, true)}</span></div>
                                <div><span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 800 }}>بواسطة:</span><span style={{ fontWeight: 900 }}>{selectedLog.profiles?.full_name || 'System'}</span></div>
                            </div>

                            <h4 style={{ fontWeight: 900, marginBottom: '15px', color: THEME.brand.coffee }}>مقارنة البيانات الدقيقة (Data Diff)</h4>
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                {renderDiff(selectedLog.old_data, selectedLog.new_data)}
                            </div>
                        </div>
                    </div>
                </div>, document.body
            )}
        </div>
    );
}
