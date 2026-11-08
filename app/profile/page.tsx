"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { useProfileLogic } from './profile_logic';
import { formatCurrency, formatDate } from '@/lib/helpers';
import SignaturePad from '@/components/signaturepad';
import RawasiSmartTable from '@/components/rawasismarttable';
import RawasiSidebarManager from '@/components/RawasiSidebarManager'; 
import MasterPage from '@/components/MasterPage';
import LoadingScreen from '@/components/LoadingScreen'; // 🖼️ استدعاء الغلاف الموحد
import SmartCombo from '@/components/SmartCombo'; // 🧠 استدعاء السمارت كومبو
import { Bell, Hourglass, Printer, Mail, Plus, ClipboardList, ChartColumn, Building2, Files, User, Trophy, Zap, TriangleAlert, CalendarDays } from 'lucide-react';

export default function EmployeeProfilePage() {
    const { 
        isLoading, isSaving, userProfile, financials, 
        recentAdvances, recentDeductions, filteredLogs,
        tasks, notifications, monthlyKPIs, userRequests,
        filteredData, rangeKPIs, 
        activeTab, setActiveTab, refreshProfile, searchFilters, setSearchFilters,
        updateProfileInfo, uploadAvatar, submitTaskUpdate, createRequest, markAllNotificationsAsRead,
        updatePassword, isKpiOnly
    } = useProfileLogic();

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [failingTaskId, setFailingTaskId] = useState<string | null>(null);
    const [failNote, setFailNote] = useState("");
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [newRequest, setNewRequest] = useState({ type: 'objection', category: 'wage', subject: '', details: '' });
    const [tempPassword, setTempPassword] = useState("");

    // 🚀 المتغيرات الآمنة لحساب الملخصات
    const totalProd = monthlyKPIs?.totalProduction || 0;
    const pTasks = (tasks || []).filter((t:any) => t.status !== 'completed').length;
    const pReqs = (userRequests || []).filter((r:any) => r.status === 'pending').length;
    const nBal = rangeKPIs?.netBalance || 0;
    const attendanceRate = monthlyKPIs?.attendanceRate || 0;
    const performanceRate = monthlyKPIs?.performanceRate || 0;
    const totalEarnings = monthlyKPIs?.totalEarnings || 0;
    const workDays = rangeKPIs?.workDays || 0;
    const totalWages = rangeKPIs?.totalWages || 0;
    const totalDeductions = rangeKPIs?.totalDeductions || 0;

    // 🚀 بناء محتوى السايد بار (مع حل مشكلة الـ Border Style Conflict)
    const sidebarContent = useMemo(() => {
        let summary = null;
        let actions = null;

        const actionBtnStyle: React.CSSProperties = {
            width: '100%', padding: '0.75rem', borderRadius: '12px', 
            borderStyle: 'solid', borderWidth: '1px', borderColor: 'var(--control-edge)',
            background: 'var(--surface-subcard)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center',
            gap: '0.625rem', cursor: 'pointer', fontWeight: 900, fontSize: 'var(--fs-sm)', transition: '0.3s', marginBottom: '0.5rem'
        };

        // دالة مساعدة لمنع تعارض الـ CSS
        const getBorderStyles = (color: string): React.CSSProperties => ({
            borderStyle: 'solid', borderWidth: '1px', borderColor: color
        });

        switch (activeTab) {
            case 'tasks':
                summary = (
                    <div style={{ background: 'color-mix(in srgb, var(--status-negative) 10%, var(--surface-flat))', padding: '1.25rem', borderRadius: '14px', textAlign: 'center', ...getBorderStyles('color-mix(in srgb, var(--status-negative) 30%, transparent)') }}>
                        <div style={{ fontSize: 'var(--fs-3xl)', marginBottom: '0.625rem' }}><Hourglass size={26} aria-hidden="true" /></div>
                        <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--status-negative)', fontWeight: 900 }}>مهام قيد التنفيذ</p>
                        <h3 style={{ margin: '0.3125rem 0 0 0', fontWeight: 900, fontSize: 'var(--fs-3xl)', color: 'var(--text-primary)' }}>{pTasks} <small style={{fontSize:'var(--fs-sm)'}}>مهمة</small></h3>
                    </div>
                );
                actions = <button style={actionBtnStyle} onClick={() => window.print()}><span style={{fontSize:'var(--fs-xl)'}}><Printer size={15} aria-hidden="true" /></span> طباعة المهام</button>;
                break;

            case 'requests':
                summary = (
                    <div style={{ background: 'color-mix(in srgb, var(--accent-ink) 10%, var(--surface-flat))', padding: '1.25rem', borderRadius: '14px', textAlign: 'center', ...getBorderStyles('color-mix(in srgb, var(--accent-ink) 30%, transparent)') }}>
                        <div style={{ fontSize: 'var(--fs-3xl)', marginBottom: '0.625rem' }}><Mail size={26} aria-hidden="true" /></div>
                        <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--accent-ink)', fontWeight: 900 }}>الطلبات المعلقة</p>
                        <h3 style={{ margin: '0.3125rem 0 0 0', fontWeight: 900, fontSize: 'var(--fs-3xl)', color: 'var(--text-primary)' }}>{pReqs} <small style={{fontSize:'var(--fs-sm)'}}>طلب</small></h3>
                    </div>
                );
                actions = (
                    <>
                        <button style={{...actionBtnStyle, background: 'color-mix(in srgb, var(--status-positive) 10%, var(--surface-flat))', ...getBorderStyles('var(--status-positive)')}} onClick={() => window.dispatchEvent(new CustomEvent('openRequestsTab'))}>
                            <span style={{fontSize:'var(--fs-xl)'}}><Plus size={15} aria-hidden="true" /></span> إنشاء طلب جديد
                        </button>
                        <button style={actionBtnStyle} onClick={() => window.dispatchEvent(new CustomEvent('closeRequestsForm'))}>
                            <span style={{fontSize:'var(--fs-xl)'}}><ClipboardList size={15} aria-hidden="true" /></span> عرض السجل
                        </button>
                        <div style={{ height: '1px', background: 'var(--control-edge)', margin: '0.625rem 0' }} />
                        <button style={actionBtnStyle} onClick={() => window.print()}><span style={{fontSize:'var(--fs-xl)'}}><Printer size={15} aria-hidden="true" /></span> طباعة السجل</button>
                    </>
                );
                break;

            case 'statement':
                summary = (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                        <div style={{ background: 'var(--surface-subcard)', padding: '0.9375rem', borderRadius: '15px', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 900 }}>أيام العمل</p>
                            <h4 style={{ margin: '0.3125rem 0 0 0', color: 'var(--accent-ink)', fontSize: 'var(--fs-xl)' }}>{workDays}</h4>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '0.625rem' }}>
                            <div style={{ background: 'color-mix(in srgb, var(--status-positive) 10%, var(--surface-flat))', padding: '0.625rem', borderRadius: '15px', textAlign: 'center' }}>
                                <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--status-positive)', fontWeight: 900 }}>مستحقات</p>
                                <div style={{ margin: '0.3125rem 0 0 0', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', fontWeight: 900 }}>{formatCurrency(totalWages)}</div>
                            </div>
                            <div style={{ background: 'color-mix(in srgb, var(--status-negative) 10%, var(--surface-flat))', padding: '0.625rem', borderRadius: '15px', textAlign: 'center' }}>
                                <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--status-negative)', fontWeight: 900 }}>خصوم</p>
                                <div style={{ margin: '0.3125rem 0 0 0', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', fontWeight: 900 }}>{formatCurrency(totalDeductions)}</div>
                            </div>
                        </div>
                        <div style={{ background: 'color-mix(in srgb, var(--accent-ink) 18%, var(--surface-flat))', padding: '0.9375rem', borderRadius: '15px', textAlign: 'center', ...getBorderStyles('var(--accent-ink)') }}>
                            <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--accent-ink)', fontWeight: 900 }}>الصافي</p>
                            <h3 style={{ margin: '0.3125rem 0 0 0', color: 'var(--text-primary)', fontSize: 'var(--fs-2xl)' }}>{formatCurrency(nBal)}</h3>
                        </div>
                    </div>
                );
                actions = <button style={actionBtnStyle} onClick={() => window.print()}><span style={{fontSize:'var(--fs-xl)'}}><Printer size={15} aria-hidden="true" /></span> طباعة الكشف</button>;
                break;
            
            case 'kpi':
                summary = (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                        {/* 🌟 تقييم الأداء (كفاءة الإنتاجية) */}
                        <div style={{ background: `color-mix(in srgb, ${performanceRate >= 100 ? 'var(--status-positive)' : performanceRate >= 80 ? 'var(--status-warning)' : 'var(--status-negative)'} 10%, var(--surface-flat))`, padding: '0.9375rem', borderRadius: '15px', textAlign: 'center', ...getBorderStyles(`color-mix(in srgb, ${performanceRate >= 100 ? 'var(--status-positive)' : performanceRate >= 80 ? 'var(--status-warning)' : 'var(--status-negative)'} 30%, transparent)`) }}>
                            <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: performanceRate >= 100 ? 'var(--status-positive)' : performanceRate >= 80 ? 'var(--status-warning)' : 'var(--status-negative)', fontWeight: 900 }}>تقييم الأداء وكفاءة الإنتاج</p>
                            <h3 style={{ margin: '0.3125rem 0 0 0', fontWeight: 900, fontSize: 'var(--fs-2xl)', color: 'var(--text-primary)' }}>{performanceRate}%</h3>
                        </div>
                        {/* الإنتاجية */}
                        <div style={{ background: 'color-mix(in srgb, var(--accent-ink) 10%, var(--surface-flat))', padding: '0.9375rem', borderRadius: '15px', textAlign: 'center', ...getBorderStyles('color-mix(in srgb, var(--accent-ink) 30%, transparent)') }}>
                            <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--accent-ink)', fontWeight: 900 }}>إجمالي الإنتاجية المنجزة</p>
                            <h3 style={{ margin: '0.3125rem 0 0 0', fontWeight: 900, fontSize: 'var(--fs-xl)', color: 'var(--text-primary)' }}>{totalProd} <span style={{fontSize:'var(--fs-sm)'}}>وحدة</span></h3>
                        </div>
                        {/* نسبة الالتزام */}
                        <div style={{ background: 'var(--surface-subcard)', padding: '0.9375rem', borderRadius: '15px', textAlign: 'center', ...getBorderStyles('var(--control-edge)') }}>
                            <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 900 }}>نسبة التزام الحضور</p>
                            <h3 style={{ margin: '0.3125rem 0 0 0', fontWeight: 900, fontSize: 'var(--fs-xl)', color: 'var(--text-primary)' }}>{attendanceRate}%</h3>
                        </div>
                    </div>
                );
                actions = <button style={actionBtnStyle} onClick={() => window.print()}><span style={{fontSize:'var(--fs-xl)'}}><ChartColumn size={15} aria-hidden="true" /></span> طباعة التقييم</button>;
                break;

            default:
                summary = (
                    <div style={{ background: 'color-mix(in srgb, var(--accent-ink) 10%, var(--surface-flat))', padding: '1.25rem', borderRadius: '14px', textAlign: 'center', ...getBorderStyles('color-mix(in srgb, var(--accent-ink) 30%, transparent)') }}>
                        <div style={{ fontSize: 'var(--fs-3xl)', marginBottom: '0.625rem' }}><Building2 size={26} aria-hidden="true" /></div>
                        <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--accent-ink)', fontWeight: 900 }}>الإنتاجية المحققة</p>
                        <h3 style={{ margin: '0.3125rem 0 0 0', fontWeight: 900, fontSize: 'var(--fs-3xl)', color: 'var(--text-primary)' }}>{totalProd}</h3>
                    </div>
                );
                actions = <button style={actionBtnStyle} onClick={() => window.print()}><span style={{fontSize:'var(--fs-xl)'}}><Files size={15} aria-hidden="true" /></span> طباعة التقرير</button>;
                break;
        }

        return { summary, actions };
    }, [activeTab, totalProd, pTasks, pReqs, nBal, attendanceRate, totalEarnings, workDays, totalWages, totalDeductions]); 

    // 🚀 استقبال أوامر فتح الفورم
    useEffect(() => {
        const hOpen = () => { setActiveTab('requests'); setShowRequestForm(true); };
        const hClose = () => { setActiveTab('requests'); setShowRequestForm(false); };
        window.addEventListener('openRequestsTab', hOpen);
        window.addEventListener('closeRequestsForm', hClose);
        return () => {
            window.removeEventListener('openRequestsTab', hOpen);
            window.removeEventListener('closeRequestsForm', hClose);
        };
    }, [setActiveTab, setShowRequestForm]);

    const combinedStatement = useMemo(() => {
        const statementRows = filteredData?.advances || []; // This is now statementRes.data
        const logsRows = filteredData?.logs || [];
        
        const logsAsStatementRows = logsRows.map((log: any) => ({
            id: log.id,
            transaction_date: log.work_date || log.created_at,
            main_description: 'يومية عمل',
            line_details: `موقع: ${log.site_ref || log.Site || '---'} | بند: ${log.work_item || log.Item || '---'} | إنتاجية: ${log.daily_production || log.Prod || 0}`,
            credit: Number(log.daily_wage || log.D_W || 0),
            debit: 0
        }));

        const allRows = [...statementRows, ...logsAsStatementRows];
        
        let cumulativeBalance = 0;
        // Sort chronologically to calculate running balance correctly
        const sortedLines = allRows.sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
        
        const processedLines = sortedLines.map((line: any) => {
            const credit = Number(line.credit || 0);
            const debit = Number(line.debit || 0);
            cumulativeBalance += (credit - debit);

            const headerDesc = (line.main_description || '').trim(); 
            const lineDesc = (line.line_details || '').trim();
            const fullDesc = (headerDesc === lineDesc || !lineDesc) ? headerDesc : (headerDesc ? `${headerDesc} - ${lineDesc}` : lineDesc);
            
            // Determine operation type
            let dType = 'قيد يومية';
            let color = 'var(--text-secondary)';
            if (fullDesc.includes('صرف') || fullDesc.includes('سداد') || fullDesc.includes('سلفة')) { dType = 'سداد / سلفة'; color = 'var(--status-negative)'; }
            else if (fullDesc.includes('قبض')) { dType = 'سند قبض'; color = 'var(--status-positive)'; }
            else if (fullDesc.includes('راتب') || fullDesc.includes('مسير')) { dType = 'استحقاق راتب'; color = 'var(--status-positive)'; }
            else if (fullDesc.includes('مخالفة') || fullDesc.includes('خصم')) { dType = 'خصم / مخالفة'; color = 'var(--status-negative)'; }
            else if (fullDesc.includes('يومية') || fullDesc.includes('عمل')) { dType = 'يومية عمل'; color = 'var(--status-positive)'; }

            const amount = debit > 0 ? debit : credit;
            const sign = debit > 0 ? '-' : '+';

            return {
                id: line.id || Math.random().toString(),
                date: line.transaction_date,
                dType,
                note: fullDesc,
                amount,
                sign,
                color,
                balance: cumulativeBalance
            };
        });

        // Return descending for display (newest first)
        return processedLines.reverse();
    }, [filteredData]);

    if (isLoading) return <LoadingScreen message="جاري تحميل الملف الشخصي..." fullScreen={true} />;

    const displayName = userProfile?.display_name || userProfile?.full_name || userProfile?.nickname || 'موظف فاي تك';
    const profession = userProfile?.profession || 'المسمى الوظيفي غير محدد';
    const usernamePhone = userProfile?.username || userProfile?.phone_number || '---';
    const avatarImg = userProfile?.avatar || userProfile?.avatar_url;

    const innerContent = (
        <div className="profile-page">
            {/* 🚀 إدراج مدير السايد بار المخفي هنا ليتولى نقل البيانات واستقبال الفلاتر */}
            <RawasiSidebarManager 
                summary={sidebarContent.summary}
                actions={sidebarContent.actions}
                onSearch={(term) => setSearchFilters((prev: any) => ({ ...prev, term }))}
                onDateFilter={(start, end) => setSearchFilters((prev: any) => ({ ...prev, startDate: start, endDate: end }))}
                watchDeps={[activeTab, totalProd, pTasks, pReqs, nBal, attendanceRate, totalEarnings, workDays, totalWages, totalDeductions]} 
            />

            <style>{`
                .profile-page .modal-overlay { position: fixed; inset: 0; background: var(--modal-scrim); backdrop-filter: blur(12px); display: flex; justify-content: center; align-items: center; padding: 1rem; z-index: 2000; }
                .profile-page .modal-box { background: var(--surface-card); color: var(--text-primary); width: min(100%, 37.5rem); padding: clamp(1rem, 6vw, 2.5rem); border-radius: 14px; box-shadow: var(--shadow-elevation); position: relative; max-height: calc(100dvh - 2rem); overflow-y: auto; }
                .profile-page .sidebar-input { width: 100%; padding: 0.75rem; border-radius: 12px; border: none !important; box-shadow: var(--shadow-sunken); background: var(--surface-sunken); color: var(--text-primary); margin-bottom: 1.25rem; font-size: var(--fs-sm); }
                .profile-page .sidebar-input:focus { outline: 2px solid var(--accent-ink); outline-offset: 2px; }
                .profile-page .tab-btn { padding: 1rem 1.5625rem; border: none; background: transparent; font-size: var(--fs-md); font-weight: 900; color: var(--text-primary); cursor: pointer; transition: 0.3s; white-space: nowrap; border-radius: 16px; }
                .profile-page .tab-btn.active { color: var(--action-ink); background: var(--action-fill); box-shadow: 0 10px 24px -4px var(--accent-glow); }
                .profile-page .tab-btn:hover:not(.active) { background: var(--surface-subcard); }
                .profile-page .card-base { background: var(--surface-card); color: var(--text-primary); border-radius: 14px; box-shadow: var(--shadow-ambient); overflow: hidden; margin-bottom: 1.875rem; }
                .profile-page .policy-paper { background: var(--surface-card); padding: clamp(1rem, 6vw, 2.8125rem); border-radius: 14px; line-height: 1.8; position: relative; color: var(--text-primary); }
                .profile-page .policy-paper::after { content: 'فاي تك'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: var(--fs-display); color: color-mix(in srgb, var(--text-primary) 5%, transparent); pointer-events: none; }
                .profile-page .request-card { background: var(--surface-card); color: var(--text-primary); padding: 1.5625rem; border-radius: 14px; border-inline-start: 6px solid var(--accent-ink); transition: 0.3s; margin-bottom: 0.9375rem; box-shadow: var(--shadow-ambient); }
                .profile-page .request-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-elevation); }
                .profile-page .btn-primary { background: var(--action-fill); color: var(--action-ink); border: none; padding: 0.75rem 1.5625rem; border-radius: 12px; font-weight: 900; cursor: pointer; transition: 0.3s; }
                .profile-page .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 24px -4px var(--accent-glow); }
                .profile-page { color: var(--text-primary); }
                .profile-page .sidebar-input::placeholder { color: var(--text-muted); }
                .profile-page .status-badge { padding: 0.375rem 0.9375rem; border-radius: 14px; font-size: var(--fs-xs); font-weight: 900; }
                .profile-page .animate-fade-in { animation: profileFadeIn 0.4s ease forwards; }
                @keyframes profileFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                ${isKpiOnly ? `
                    /* إخفاء كل ما يحيط بالتقييم عند طلب التقييم فقط */
                    aside, header, nav, .sidebar { display: none !important; }
                    main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; background: var(--bg-canvas) !important; }
                    .profile-page .card-base { box-shadow: none !important; border: none !important; background: transparent !important; margin: 0 !important; }
                    .profile-page :is(.profile-header, .tabs-container) { display: none !important; }
                ` : ''}
            `}</style>

            {/* 👤 الهيدر العلوي للموظف */}
            {!isKpiOnly && (
            <div className="profile-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.1875rem', background: 'var(--surface-card)', padding: '1.5625rem', borderRadius: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5625rem', minWidth: 0 }}>
                    <div style={{ width: '5.625rem', flexShrink: 0, height: '5.625rem', borderRadius: '14px', background: 'var(--surface-flat)', border: `4px solid var(--surface-flat)`, overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                        {avatarImg ? <img src={avatarImg} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="Avatar" /> : <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'var(--fs-3xl)'}}><User size={30} aria-hidden="true" /></div>}
                    </div>
                    <div>
                        <h1 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 900, fontSize: 'var(--fs-3xl)', overflowWrap: 'anywhere' }}>مرحباً، {displayName}</h1>
                        <p style={{ margin: '0.3125rem 0 0.5rem 0', color: 'var(--accent-ink)', fontSize: 'var(--fs-lg)', fontWeight: 900 }}>{profession}</p>
                        <div style={{ display: 'flex', gap: '0.625rem' }}>
                            <span style={{ fontSize: 'var(--fs-xs)', background: 'var(--surface-subcard)', color: 'var(--text-secondary)', padding: '0.25rem 0.625rem', borderRadius: '8px', fontWeight: 900, border: '1px solid var(--control-edge)' }}>
                                {usernamePhone}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div style={{ display: 'flex', gap: '0.9375rem' }}>
                    <button onClick={() => setIsSettingsOpen(true)} style={{ background: 'var(--surface-subcard)', border: '1px solid var(--control-edge)', padding: '0.75rem 1.5625rem', borderRadius: '15px', fontWeight: 900, cursor: 'pointer', color: 'var(--text-primary)', transition: '0.3s', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>الإعدادات</button>
                    <div role="button" tabIndex={0} aria-label="تعليم كل الإشعارات كمقروءة" title="الإشعارات" onClick={markAllNotificationsAsRead} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); markAllNotificationsAsRead(); } }} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', background: 'var(--action-fill)', color: 'var(--action-ink)', padding: '0.75rem 1.25rem', borderRadius: '15px', cursor: 'pointer', boxShadow: '0 10px 24px -4px var(--accent-glow)' }}>
                        <Bell size={18} aria-hidden="true" />
                        {(notifications || []).length > 0 && <span style={{ position: 'absolute', top: '-0.3125rem', left: '-0.3125rem', background: 'var(--status-negative)', color: 'var(--surface-flat)', fontSize: 'var(--fs-xs)', width: '1.375rem', height: '1.375rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface-flat)', fontWeight: 900 }}>{notifications.length}</span>}
                    </div>
                </div>
            </div>
            )}

            <div className={!isKpiOnly ? "card-base" : ""}>
                {!isKpiOnly && (
                <div className="tabs-container" style={{ display: 'flex', borderBottom: '1px solid var(--control-edge)', background: 'var(--surface-flat)', padding: '0.9375rem', gap: '0.625rem', overflowX: 'auto' }}>
                    <button className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>المهام</button>
                    <button className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`} onClick={() => setActiveTab('report')}>الإنتاجية</button>
                    <button className={`tab-btn ${activeTab === 'daily_fin' ? 'active' : ''}`} onClick={() => setActiveTab('daily_fin')}>ملخص مالي</button>
                    <button className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>الطلبات</button>
                    <button className={`tab-btn ${activeTab === 'statement' ? 'active' : ''}`} onClick={() => setActiveTab('statement')}>كشف الحساب</button>
                    <button className={`tab-btn ${activeTab === 'kpi' ? 'active' : ''}`} onClick={() => setActiveTab('kpi')}>التقييم</button>
                    <button className={`tab-btn ${activeTab === 'policy' ? 'active' : ''}`} onClick={() => setActiveTab('policy')}>اللائحة</button>
                </div>
                )}

                <div style={{ padding: '2.1875rem' }}>
                    {activeTab === 'tasks' && !isKpiOnly && (
                        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '2.1875rem' }}>
                            <div>
                                <h3 style={{ color: 'var(--status-negative)', borderRight: `6px solid var(--status-negative)`, paddingRight: '0.9375rem', marginBottom: '1.5625rem' }}>مهام قيد التنفيذ</h3>
                                {(tasks || []).filter((t:any) => t.status !== 'completed').map((task: any) => (
                                    <div key={task.id} className="request-card" style={{ borderInlineStartColor: 'var(--accent-ink)' }}>
                                        <h4 style={{ margin: 0, fontSize: 'var(--fs-xl)', color: 'var(--text-primary)' }}>{task.title}</h4>
                                        <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', margin: '0.625rem 0' }}>{task.description}</p>
                                        <div style={{ display: 'flex', gap: '0.625rem' }}>
                                            <button onClick={() => submitTaskUpdate(task.id, 'completed')} className="btn-primary" style={{ background: 'color-mix(in srgb, var(--status-positive) 14%, var(--surface-flat))', color: 'var(--status-positive)', padding: '0.5rem 1.25rem' }}>تم الإنجاز</button>
                                            <button onClick={() => setFailingTaskId(task.id)} className="btn-primary" style={{ background: 'color-mix(in srgb, var(--status-negative) 14%, var(--surface-flat))', color: 'var(--status-negative)', padding: '0.5rem 1.25rem' }}>لم يتم</button>
                                        </div>
                                        {failingTaskId === task.id && (
                                            <div className="animate-fade-in" style={{ marginTop: '1.25rem' }}>
                                                <textarea className="sidebar-input" style={{ width: '100%', padding: '0.9375rem', borderRadius: '12px', border: '1px solid var(--control-edge)', background: 'var(--surface-sunken)', color: 'var(--text-primary)' }} placeholder="اذكر العائق الفني أو السبب بوضوح..." onChange={(e) => setFailNote(e.target.value)} />
                                                <button onClick={() => submitTaskUpdate(task.id, 'failed', failNote).then(() => setFailingTaskId(null))} className="btn-primary" style={{ marginTop: '0.625rem', width: '100%' }}>إرسال التقرير للإدارة</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {pTasks === 0 && <p style={{color:'var(--text-muted)', textAlign:'center', padding: '1.25rem', background: 'var(--surface-subcard)', borderRadius: '15px'}}>لا توجد مهام قيد التنفيذ حالياً.</p>}
                            </div>
                            <div>
                                <h3 style={{ color: 'var(--status-positive)', borderRight: `6px solid var(--status-positive)`, paddingRight: '0.9375rem', marginBottom: '1.5625rem' }}>المهام المكتملة</h3>
                                {(tasks || []).filter((t:any) => t.status === 'completed').map((task: any) => (
                                    <div key={task.id} className="request-card" style={{ borderInlineStartColor: 'var(--status-positive)' }}>
                                        <h4 style={{ margin: 0, textDecoration: 'line-through', color: 'var(--text-primary)' }}>{task.title}</h4>
                                        <p style={{ fontSize: 'var(--fs-sm)', marginTop: '0.5rem', fontWeight: 700, color: 'var(--text-secondary)' }}>تاريخ الإنجاز: {formatDate(task.updated_at)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'report' && !isKpiOnly && (
                         <div className="animate-fade-in">
                            <RawasiSmartTable 
                                title="أرشيف يوميات العمل والإنتاجية (مفلتر)"
                                fileName={`WorkReport_${displayName}`}
                                data={filteredData?.logs || []}
                                columns={[
                                    { header: 'التاريخ', accessor: 'work_date', render: (row: any) => `${formatDate(row.work_date || row.Date)}` },
                                    { header: 'الموقع والبند', accessor: 'site_ref', render: (row: any) => <div style={{ fontWeight: 900, color: 'var(--text-primary)' }}>{row.site_ref || row.Site} <span style={{fontSize:'var(--fs-sm)', color:'var(--accent-ink)', display:'block'}}>{row.work_item || row.Item}</span></div> },
                                    { header: 'الإنتاجية', accessor: 'daily_production', render: (row: any) => <span style={{ fontWeight: 900, color: 'var(--text-primary)' }}>{row.daily_production || row.productivity || row.Prod || 0} وحدة</span> },
                                    { header: 'الأجر المسجل', accessor: 'daily_wage', render: (row: any) => <span style={{ fontWeight: 900, color: 'var(--status-positive)' }}>{formatCurrency(row.daily_wage || row.D_W)}</span> }
                                ]}
                            />
                        </div>
                    )}

                    {activeTab === 'daily_fin' && !isKpiOnly && (
                         <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Summary Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13.75rem, 1fr))', gap: '0.9375rem' }}>
                                {/* Current Balance */}
                                <div style={{ background: 'var(--surface-card)', backdropFilter: 'blur(10px)', padding: '1.5625rem', borderRadius: '14px', border: `1px solid color-mix(in srgb, var(--accent-ink) 31%, transparent)`, textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
                                    <h4 style={{ color: 'var(--text-primary)', margin: '0 0 0.625rem 0', fontSize: 'var(--fs-lg)', fontWeight: 900 }}>الرصيد المالي الحالي المستحق</h4>
                                    <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 900, color: combinedStatement[0]?.balance >= 0 ? 'var(--status-positive)' : 'var(--status-negative)' }}>
                                        {formatCurrency(Math.abs(combinedStatement[0]?.balance || 0))}
                                        <span style={{ fontSize: 'var(--fs-md)', display: 'block', marginTop: '0.3125rem' }}>{combinedStatement[0]?.balance >= 0 ? 'له (دائن)' : 'عليه (مدين)'}</span>
                                    </div>
                                </div>
                                {/* Total Credits */}
                                <div style={{ background: 'color-mix(in srgb, var(--status-positive) 10%, var(--surface-flat))', backdropFilter: 'blur(10px)', padding: '1.5625rem', borderRadius: '14px', border: `1px solid color-mix(in srgb, var(--status-positive) 31%, transparent)`, textAlign: 'center' }}>
                                    <h4 style={{ color: 'var(--status-positive)', margin: '0 0 0.625rem 0', fontSize: 'var(--fs-lg)', fontWeight: 900 }}>إجمالي الاستحقاقات (له)</h4>
                                    <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: 'var(--status-positive)' }}>
                                        {formatCurrency(combinedStatement.filter(x => x.sign === '+').reduce((s, x) => s + x.amount, 0))}
                                    </div>
                                </div>
                                {/* Total Debits */}
                                <div style={{ background: 'color-mix(in srgb, var(--status-negative) 10%, var(--surface-flat))', backdropFilter: 'blur(10px)', padding: '1.5625rem', borderRadius: '14px', border: `1px solid color-mix(in srgb, var(--status-negative) 31%, transparent)`, textAlign: 'center' }}>
                                    <h4 style={{ color: 'var(--status-negative)', margin: '0 0 0.625rem 0', fontSize: 'var(--fs-lg)', fontWeight: 900 }}>إجمالي السحوبات (عليه)</h4>
                                    <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: 'var(--status-negative)' }}>
                                        {formatCurrency(combinedStatement.filter(x => x.sign === '-').reduce((s, x) => s + x.amount, 0))}
                                    </div>
                                </div>
                                {/* Attendance Days */}
                                <div style={{ background: 'var(--surface-subcard)', backdropFilter: 'blur(10px)', padding: '1.5625rem', borderRadius: '14px', border: `1px solid var(--control-edge)`, textAlign: 'center' }}>
                                    <h4 style={{ color: 'var(--text-secondary)', margin: '0 0 0.625rem 0', fontSize: 'var(--fs-lg)', fontWeight: 900 }}>أيام الحضور والعمل</h4>
                                    <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: 'var(--text-primary)' }}>
                                        {(filteredData?.logs || []).reduce((acc: any, log: any) => acc + (Number(log.attendance_value) || 1), 0)} <span style={{ fontSize: 'var(--fs-md)' }}>يوم</span>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Transactions List */}
                            <div style={{ background: 'var(--surface-subcard)', backdropFilter: 'blur(10px)', padding: '1.875rem', borderRadius: '14px', border: `1px solid var(--accent-ink)` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                    <h4 style={{ color: 'var(--accent-ink)', margin: 0, fontSize: 'var(--fs-xl)' }}>أحدث الحركات في الحساب</h4>
                                    <button onClick={() => setActiveTab('statement')} style={{ background: 'var(--action-fill)', color: 'var(--action-ink)', border: 'none', padding: '0.5rem 0.9375rem', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}>عرض كشف الحساب كاملاً</button>
                                </div>
                                
                                {combinedStatement.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '1.875rem', color: 'var(--text-secondary)', fontWeight: 800 }}>لا توجد حركات مالية مسجلة.</div>
                                ) : (
                                    combinedStatement.slice(0, 5).map((line: any, i: number) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9375rem 0', borderBottom: '1px dashed color-mix(in srgb, var(--accent-ink) 30%, transparent)' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3125rem', flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                    <span style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: 'var(--fs-lg)' }}>{line.dType}</span>
                                                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', background: 'var(--surface-subcard)', padding: '2px 0.5rem', borderRadius: '10px', fontWeight: 800 }}>{formatDate(line.date)}</span>
                                                </div>
                                                <span style={{ fontSize: 'var(--fs-md)', color: 'var(--text-primary)', fontWeight: 800, lineHeight: '1.5', paddingRight: '0.3125rem', borderRight: `3px solid var(--accent-ink)` }}>
                                                    {line.note || '---'}
                                                </span>
                                            </div>
                                            <div style={{ textAlign: 'left', minWidth: '7.5rem' }}>
                                                <span style={{ fontWeight: 900, color: line.sign === '+' ? 'var(--status-positive)' : 'var(--status-negative)', fontSize: 'var(--fs-xl)', display: 'block', direction: 'ltr' }}>
                                                    {line.sign} {formatCurrency(line.amount)}
                                                </span>
                                                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 700 }}>
                                                    الرصيد: {formatCurrency(Math.abs(line.balance))} {line.balance >= 0 ? 'له' : 'عليه'}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'requests' && !isKpiOnly && (
                         <div className="animate-fade-in">
                            {showRequestForm ? (
                                <div className="animate-fade-in" style={{ background: 'var(--surface-card)', backdropFilter: 'blur(10px)', padding: '2.5rem', borderRadius: '14px', border: `1px solid var(--control-edge)`, maxWidth: '43.75rem', margin: '0 auto', boxShadow: '0 20px 40px rgba(0,0,0,0.05)' }}>
                                    <h3 style={{marginTop:0, marginBottom:'1.5625rem', color: 'var(--text-primary)', fontWeight: 900, textAlign: 'center'}}>تعبئة بيانات الطلب</h3>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                                        {/* 🧠 استخدام السمارت كومبو بدلًا من الـ Select العادي */}
                                        <SmartCombo 
                                            label="نوع الطلب"
                                            options={['اعتراض مالي', 'طلب إداري', 'إجازة']}
                                            initialDisplay={newRequest.type === 'objection' ? 'اعتراض مالي' : 'طلب إداري'}
                                            onSelect={(val) => setNewRequest({...newRequest, type: val.includes('اعتراض') ? 'objection' : 'request'})}
                                            strict={true}
                                        />
                                        <SmartCombo 
                                            label="التصنيف"
                                            options={['الأجور واليوميات', 'الخصومات والجزاءات', 'السلف المالية', 'الإجازات والغياب']}
                                            initialDisplay="الأجور واليوميات"
                                            onSelect={(val) => {
                                                const cat = val.includes('الأجور') ? 'wage' : val.includes('خصوم') ? 'deduction' : val.includes('سلف') ? 'advance' : 'leave';
                                                setNewRequest({...newRequest, category: cat});
                                            }}
                                            strict={true}
                                        />
                                    </div>
                                    
                                    <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>عنوان الموضوع</label>
                                    <input className="sidebar-input" style={{width: '100%', padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--control-edge)', marginBottom: '1.25rem', fontWeight: 800}} placeholder="مثلاً: اعتراض على خصم يومية..." onChange={(e) => setNewRequest({...newRequest, subject: e.target.value})} />
                                    
                                    <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>التفاصيل والمبررات</label>
                                    <textarea className="sidebar-input" style={{width: '100%', padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--control-edge)', height: '7.5rem', marginBottom: '1.5625rem', resize: 'vertical'}} placeholder="اشرح التفاصيل بوضوح هنا..." onChange={(e) => setNewRequest({...newRequest, details: e.target.value})} />
                                    
                                    <div style={{ display: 'flex', gap: '0.9375rem' }}>
                                        <button onClick={() => createRequest(newRequest).then(() => setShowRequestForm(false))} style={{ flex: 2, background: 'var(--action-fill)', color: 'var(--action-ink)', padding: '1rem', borderRadius: '15px', border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: 'var(--fs-lg)', boxShadow: '0 10px 24px -4px var(--accent-glow)' }}>إرسال الطلب للإدارة</button>
                                        <button onClick={() => setShowRequestForm(false)} style={{ flex: 1, background: 'var(--surface-subcard)', color: 'var(--text-secondary)', padding: '1rem', borderRadius: '15px', border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: 'var(--fs-lg)' }}>إلغاء</button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: '1.25rem' }}>
                                    {(userRequests || []).map((req: any) => (
                                        <div key={req.id} className="request-card" style={{ borderInlineStartColor: req.type === 'objection' ? 'var(--status-negative)' : 'var(--accent-ink)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.3125rem' }}>
                                                        <span style={{ fontSize: 'var(--fs-xs)', background: 'var(--surface-subcard)', padding: '0.25rem 0.625rem', borderRadius: '8px', fontWeight: 900, color: 'var(--text-primary)' }}>{req.category === 'wage' ? 'أجور' : req.category === 'leave' ? 'إجازات' : 'أخرى'}</span>
                                                        <h4 style={{ margin: 0, fontSize: 'var(--fs-xl)', color: 'var(--text-primary)' }}>{req.subject}</h4>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', marginTop: '0.625rem', lineHeight: 1.6 }}>{req.details}</p>
                                                    <div style={{ fontSize: 'var(--fs-xs)', marginTop: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>تاريخ التقديم: {formatDate(req.created_at)}</div>
                                                </div>
                                                <span className="status-badge" style={{ background: req.status === 'approved' ? 'color-mix(in srgb, var(--status-positive) 10%, var(--surface-flat))' : req.status === 'rejected' ? 'color-mix(in srgb, var(--status-negative) 10%, var(--surface-flat))' : 'color-mix(in srgb, var(--status-warning) 10%, var(--surface-flat))', color: req.status === 'approved' ? 'var(--status-positive)' : req.status === 'rejected' ? 'var(--status-negative)' : 'var(--status-warning)', padding: '0.5rem 1.125rem' }}>
                                                    {req.status === 'pending' ? 'قيد المراجعة' : req.status === 'approved' ? 'تم القبول' : 'مرفوض'}
                                                </span>
                                            </div>
                                            {req.admin_note && (
                                                <div style={{ marginTop: '0.9375rem', padding: '0.9375rem', background: 'var(--surface-subcard)', border: '1px solid var(--control-edge)', borderRadius: '12px', fontSize: 'var(--fs-sm)', color: 'var(--text-primary)' }}>
                                                    <strong>رد الإدارة:</strong> {req.admin_note}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {pReqs === 0 && <div style={{ textAlign: 'center', padding: '3.125rem', color: 'var(--text-muted)', background: 'var(--surface-subcard)', borderRadius: '14px', fontWeight: 800 }}>لا توجد طلبات أو اعتراضات سابقة.</div>}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'statement' && !isKpiOnly && (
                        <div className="animate-fade-in">
                            <RawasiSmartTable 
                                title="كشف الحساب التفصيلي"
                                fileName={`AccountStatement_${displayName}`}
                                data={combinedStatement || []}
                                columns={[
                                    { header: 'التاريخ', accessor: 'date', render: (row: any) => formatDate(row.date) },
                                    { header: 'العملية', accessor: 'dType', render: (row: any) => <span style={{ padding: '0.375rem 0.75rem', borderRadius: '10px', fontSize: 'var(--fs-sm)', fontWeight: 900, background: `color-mix(in srgb, ${row.color || 'var(--text-secondary)'} 12%, var(--surface-flat))`, color: row.color || 'var(--text-secondary)' }}>{row.dType}</span> },
                                    { header: 'البيان', accessor: 'note', render: (row: any) => <span style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>{row.note || '---'}</span> },
                                    { header: 'مدين (عليه)', accessor: 'debit', render: (row: any) => row.sign === '-' ? <span style={{ fontWeight: 900, color: 'var(--status-negative)', fontSize: 'var(--fs-lg)' }}>{formatCurrency(row.amount)}</span> : '---' },
                                    { header: 'دائن (له)', accessor: 'credit', render: (row: any) => row.sign === '+' ? <span style={{ fontWeight: 900, color: 'var(--status-positive)', fontSize: 'var(--fs-lg)' }}>{formatCurrency(row.amount)}</span> : '---' },
                                    { header: 'الرصيد التراكمي', accessor: 'balance', render: (row: any) => <span style={{ fontWeight: 900, color: row.balance >= 0 ? 'var(--status-positive)' : 'var(--status-negative)', fontSize: 'var(--fs-lg)' }}>{formatCurrency(row.balance)} {row.balance >= 0 ? 'له' : 'عليه'}</span> }
                                ]}
                            />
                        </div>
                    )}

                    {activeTab === 'kpi' && (
                        <div className="animate-fade-in">
                            <div style={{ background: 'var(--surface-card)', backdropFilter: 'blur(10px)', padding: '2.5rem', borderRadius: '14px', border: `1px solid color-mix(in srgb, var(--accent-ink) 31%, transparent)`, boxShadow: '0 15px 35px rgba(0,0,0,0.05)' }}>
                                <h3 style={{ margin: '0 0 2.1875rem 0', color: 'var(--text-primary)', fontWeight: 900, fontSize: 'var(--fs-2xl)', textAlign: 'center' }}>لوحة تقييم الأداء والإنتاجية</h3>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(17.5rem, 1fr))', gap: '1.5625rem' }}>
                                    
                                    {/* 🌟 كفاءة الأداء */}
                                    <div style={{ background: `color-mix(in srgb, ${performanceRate >= 100 ? 'var(--status-positive)' : performanceRate >= 80 ? 'var(--status-warning)' : 'var(--status-negative)'} 5%, var(--surface-flat))`, padding: '1.875rem', borderRadius: '14px', textAlign: 'center', border: `2px solid color-mix(in srgb, ${performanceRate >= 100 ? 'var(--status-positive)' : performanceRate >= 80 ? 'var(--status-warning)' : 'var(--status-negative)'} 30%, transparent)` }}>
                                        <div style={{ fontSize: 'var(--fs-display)', marginBottom: '0.9375rem' }}>{performanceRate >= 100 ? <Trophy size={40} aria-hidden="true" /> : performanceRate >= 80 ? <Zap size={40} aria-hidden="true" /> : <TriangleAlert size={40} aria-hidden="true" />}</div>
                                        <p style={{ margin: 0, fontSize: 'var(--fs-xl)', color: performanceRate >= 100 ? 'var(--status-positive)' : performanceRate >= 80 ? 'var(--status-warning)' : 'var(--status-negative)', fontWeight: 900 }}>تقييم كفاءة الإنتاج</p>
                                        <h3 style={{ margin: '0.9375rem 0 0 0', fontWeight: 900, fontSize: 'var(--fs-display)', color: 'var(--text-primary)' }}>{performanceRate}%</h3>
                                        <p style={{ margin: '0.9375rem 0 0 0', fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', fontWeight: 700, lineHeight: 1.6 }}>
                                            {performanceRate >= 100 ? 'أداء ممتاز! يحقق أو يتجاوز التريحة المطلوبة' : performanceRate >= 80 ? 'أداء جيد جداً. قريب جداً من الهدف' : 'أداء ضعيف. يحتاج إلى تحسين لتغطية التريحة'}
                                        </p>
                                    </div>

                                    {/* 📦 الإنتاجية المنجزة vs المطلوبة */}
                                    <div style={{ background: 'color-mix(in srgb, var(--accent-ink) 5%, var(--surface-flat))', padding: '1.875rem', borderRadius: '14px', textAlign: 'center', border: `2px solid color-mix(in srgb, var(--accent-ink) 31%, transparent)` }}>
                                        <div style={{ fontSize: 'var(--fs-display)', marginBottom: '0.9375rem' }}><Building2 size={40} aria-hidden="true" /></div>
                                        <p style={{ margin: 0, fontSize: 'var(--fs-xl)', color: 'var(--accent-ink)', fontWeight: 900 }}>الإنتاجية (المنجزة / المطلوبة)</p>
                                        <div style={{ fontSize: 'var(--fs-display)', fontWeight: 900, color: 'var(--text-primary)', direction: 'ltr', marginTop: '0.9375rem' }}>
                                            <span style={{ color: 'var(--status-positive)' }}>{totalProd}</span>
                                            <span style={{ color: 'var(--text-muted)', margin: '0 0.625rem' }}>/</span>
                                            <span style={{ color: 'var(--status-negative)' }}>{(monthlyKPIs?.itemBreakdown || []).reduce((sum: number, b: any) => sum + b.totalTareeha, 0)}</span>
                                        </div>
                                        <p style={{ margin: '0.9375rem 0 0 0', fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', fontWeight: 700, lineHeight: 1.6 }}>إجمالي الوحدات التي تم إنجازها مقابل التريحة المستهدفة للعمل الفني عبر كافة البنود.</p>
                                    </div>

                                    {/* 📅 نسبة التزام الحضور */}
                                    <div style={{ background: 'var(--surface-subcard)', padding: '1.875rem', borderRadius: '14px', textAlign: 'center', border: `2px solid var(--control-edge)` }}>
                                        <div style={{ fontSize: 'var(--fs-display)', marginBottom: '0.9375rem' }}><CalendarDays size={40} aria-hidden="true" /></div>
                                        <p style={{ margin: 0, fontSize: 'var(--fs-xl)', color: 'var(--text-primary)', fontWeight: 900 }}>نسبة التزام الحضور</p>
                                        <h3 style={{ margin: '0.9375rem 0 0 0', fontWeight: 900, fontSize: 'var(--fs-display)', color: 'var(--text-primary)' }}>{attendanceRate}%</h3>
                                        <p style={{ margin: '0.9375rem 0 0 0', fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', fontWeight: 700, lineHeight: 1.6 }}>حضر <strong style={{color: 'var(--text-primary)'}}>{monthlyKPIs?.daysWorked || 0}</strong> يوم عمل من أصل <strong style={{color: 'var(--status-negative)'}}>{monthlyKPIs?.expectedDays || 0}</strong> يوم عمل متوقع (حتى آخر شهر عمل فيه).</p>
                                    </div>

                                </div>

                                {/* تفصيل الإنتاجية لكل بند */}
                                {(monthlyKPIs?.itemBreakdown || []).length > 0 && (
                                    <div style={{ marginTop: '2.5rem', background: 'var(--surface-subcard)', padding: '1.5625rem', borderRadius: '14px', border: `1px solid var(--accent-ink)` }}>
                                        <h4 style={{ color: 'var(--accent-ink)', margin: '0 0 1.25rem 0', fontSize: 'var(--fs-xl)', fontWeight: 900 }}>تفصيل التقييم حسب البند</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
                                            {(monthlyKPIs.itemBreakdown).map((b: any, idx: number) => (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-subcard)', padding: '0.9375rem 1.25rem', borderRadius: '15px', border: '1px solid color-mix(in srgb, var(--accent-ink) 18%, var(--surface-flat))' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.9375rem' }}>
                                                        <div style={{ background: `color-mix(in srgb, ${b.percentage >= 100 ? 'var(--status-positive)' : b.percentage >= 80 ? 'var(--status-warning)' : 'var(--status-negative)'} 10%, var(--surface-flat))`, color: b.percentage >= 100 ? 'var(--status-positive)' : b.percentage >= 80 ? 'var(--status-warning)' : 'var(--status-negative)', width: '3.125rem', height: '3.125rem', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 900, fontSize: 'var(--fs-lg)' }}>
                                                            {b.percentage}%
                                                        </div>
                                                        <div>
                                                            <h5 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 'var(--fs-lg)', fontWeight: 900 }}>{b.item}</h5>
                                                            <p style={{ margin: '0.3125rem 0 0 0', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>النسبة تعكس التريحة المسجلة في الموازنة</p>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'left', direction: 'ltr' }}>
                                                        <span style={{ fontWeight: 900, color: 'var(--status-positive)', fontSize: 'var(--fs-xl)' }}>{b.totalProd}</span>
                                                        <span style={{ color: 'var(--text-muted)', margin: '0 0.3125rem', fontSize: 'var(--fs-xl)' }}>/</span>
                                                        <span style={{ fontWeight: 900, color: 'var(--status-negative)', fontSize: 'var(--fs-xl)' }}>{b.totalTareeha}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* قائمة الحضور حسب الشهر */}
                                {(monthlyKPIs?.attendanceBreakdown || []).length > 0 && (
                                    <div style={{ marginTop: '1.25rem', background: 'var(--surface-subcard)', padding: '1.5625rem', borderRadius: '14px', border: `1px solid var(--control-edge)` }}>
                                        <h4 style={{ color: 'var(--text-primary)', margin: '0 0 1.25rem 0', fontSize: 'var(--fs-xl)', fontWeight: 900 }}>تفصيل الحضور حسب الشهر</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(15.625rem, 1fr))', gap: '0.9375rem' }}>
                                            {(monthlyKPIs.attendanceBreakdown).map((m: any, idx: number) => (
                                                <div key={idx} style={{ background: 'var(--surface-subcard)', padding: '0.9375rem', borderRadius: '15px', border: '1px solid var(--control-edge)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <h5 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 'var(--fs-lg)', fontWeight: 900 }}>{m.month}</h5>
                                                        <p style={{ margin: '0.3125rem 0 0 0', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>حضر <strong style={{color: 'var(--text-primary)'}}>{m.daysWorked}</strong> يوم من أصل {m.expectedDays || 26}</p>
                                                    </div>
                                                    <div style={{ background: `color-mix(in srgb, ${m.percentage >= 100 ? 'var(--status-positive)' : m.percentage >= 80 ? 'var(--status-warning)' : 'var(--status-negative)'} 10%, var(--surface-flat))`, color: m.percentage >= 100 ? 'var(--status-positive)' : m.percentage >= 80 ? 'var(--status-warning)' : 'var(--status-negative)', padding: '0.5rem 0.75rem', borderRadius: '10px', fontWeight: 900, fontSize: 'var(--fs-lg)' }}>
                                                        {m.percentage}%
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'policy' && !isKpiOnly && (
                        <div className="animate-fade-in">
                            <div className="policy-paper">
                                <div style={{ textAlign: 'center', marginBottom: '2.5rem', borderBottom: `3px double var(--accent-ink)`, paddingBottom: '1.5625rem' }}>
                                    <h2 style={{ margin: '0 0 0.3125rem 0', fontWeight: 900, fontSize: 'var(--fs-3xl)', color: 'var(--text-primary)' }}>لائحة تنظيم العمل والإنتاجية</h2>
                                    <h4 style={{ margin: 0, color: 'var(--accent-ink)', fontSize: 'var(--fs-xl)' }}>شركة فاي تك للمقاولات العامة</h4>
                                    <p style={{ fontSize: 'var(--fs-sm)', marginTop: '0.625rem', color: 'var(--text-muted)', fontWeight: 700 }}>مُصاغة وفقاً لنظام العمل السعودي</p>
                                </div>
                                <div style={{ display: 'grid', gap: '1.875rem', position: 'relative', zIndex: 1 }}>
                                    <section>
                                        <h4 style={{ color: 'var(--accent-ink)', borderRight: `5px solid var(--accent-ink)`, paddingRight: '0.9375rem', marginBottom: '0.9375rem', fontSize: 'var(--fs-xl)' }}>ساعات العمل والحضور</h4>
                                        <ul style={{ paddingRight: '1.25rem', fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                            <li>ساعات العمل الفعلية هي (8) ساعات. يبدأ الدوام من الساعة <strong>5:00 صباحاً</strong>.</li>
                                            <li>يُثبت الحضور حصراً عبر النظام الرقمي في الموقع الجغرافي للمشروع.</li>
                                        </ul>
                                    </section>
                                    <section style={{ background: 'color-mix(in srgb, var(--accent-ink) 5%, var(--surface-flat))', padding: '1.5625rem', borderRadius: '14px' }}>
                                        <h4 style={{ color: 'var(--accent-ink)', borderRight: `5px solid var(--accent-ink)`, paddingRight: '0.9375rem', marginBottom: '0.9375rem', fontSize: 'var(--fs-xl)' }}>نظام العمالة والإنتاجية</h4>
                                        <ul style={{ paddingRight: '1.25rem', fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                            <li>لا تُعتمد اليومية كاملة إلا بتحقيق "الحد الأدنى للإنتاج" المتفق عليه.</li>
                                            <li>في حال رفض الجودة من المهندس، يلتزم العامل بالإعادة على نفقته الخاصة.</li>
                                        </ul>
                                    </section>
                                    <div style={{ marginTop: '1.875rem', padding: '1.25rem', background: 'var(--action-fill)', color: 'var(--action-ink)', borderRadius: '14px', textAlign: 'center', fontSize: 'var(--fs-md)', fontWeight: 800, boxShadow: '0 10px 24px -4px var(--accent-glow)' }}>
                                        "استخدامك لهذا النظام يُعد إقراراً بالموافقة على بنود اللائحة، وتعتبر توقيعاً ملزماً."
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 🚀 ⚙️ Glass Modal الإعدادات */}
            {isSettingsOpen && (
                <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setIsSettingsOpen(false)} style={{ position: 'absolute', top: '1.5625rem', left: '1.5625rem', background: 'var(--surface-subcard)', border: 'none', width: '2.5rem', height: '2.5rem', borderRadius: '50%', fontSize: 'var(--fs-xl)', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 900 }}>✕</button>
                        <h2 style={{ marginTop: 0, marginBottom: '2.1875rem', color: 'var(--text-primary)', fontWeight: 900, textAlign: 'center', paddingInline: '3rem', borderBottom: '1px solid var(--control-edge)', paddingBottom: '1.25rem' }}>إعدادات الملف الشخصي</h2>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.875rem' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ width: '8.125rem', height: '8.125rem', borderRadius: '50%', background: 'var(--surface-subcard)', color: 'var(--text-primary)', margin: '0 auto 1.25rem', border: `5px solid var(--accent-ink)`, overflow: 'hidden', boxShadow: '0 15px 30px rgba(0,0,0,0.15)' }}>
                                    {avatarImg ? <img src={avatarImg} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="Avatar" /> : <span style={{fontSize:'var(--fs-display)', lineHeight: '7.5rem', color:'var(--text-primary)'}}><User size={40} aria-hidden="true" /></span>}
                                </div>
                                <input type="file" id="modalFile" hidden accept="image/*" onChange={(e) => e.target.files && uploadAvatar(e.target.files[0])} />
                                <label htmlFor="modalFile" style={{ cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 900, fontSize: 'var(--fs-md)', background:'var(--surface-subcard)', padding:'0.75rem 1.875rem', borderRadius:'12px', border:`2px solid var(--control-edge)`, transition: '0.3s' }}>{isSaving ? 'جاري الرفع...' : 'تغيير الصورة الشخصية'}</label>
                            </div>
                            
                            <div style={{ borderTop: '2px dashed var(--control-edge)', marginTop: '0.625rem', paddingTop: '1.875rem' }}>
                                <label style={{ display: 'block', fontSize: 'var(--fs-md)', fontWeight: 900, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>تغيير كلمة المرور</label>
                                <input 
                                    className="sidebar-input" 
                                    type="password"
                                    placeholder="اكتب كلمة المرور الجديدة هنا..."
                                    style={{ color: 'var(--text-primary)', background: 'var(--surface-sunken)', border: '2px solid var(--control-edge)', marginBottom: tempPassword ? '0.9375rem' : '0', fontWeight: 800, padding: '1rem', borderRadius: '15px' }}
                                    value={tempPassword}
                                    onChange={(e) => setTempPassword(e.target.value)} 
                                />
                                {tempPassword && (
                                    <div className="animate-fade-in" style={{ display: 'flex', gap: '0.9375rem' }}>
                                        <button 
                                            onClick={async () => {
                                                if(updatePassword) {
                                                    if (await updatePassword(tempPassword)) setTempPassword("");
                                                }
                                            }}
                                            style={{ flex: 2, padding: '0.875rem', background: 'color-mix(in srgb, var(--status-positive) 14%, var(--surface-flat))', color: 'var(--status-positive)', border: 'none', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', boxShadow: 'var(--shadow-ambient)' }}
                                        >
                                            حفظ كلمة السر
                                        </button>
                                        <button 
                                            onClick={() => setTempPassword("")}
                                            style={{ flex: 1, padding: '0.875rem', background: 'var(--surface-subcard)', color: 'var(--text-secondary)', border: 'none', borderRadius: '12px', fontWeight: 900, cursor: 'pointer' }}
                                        >
                                            إلغاء
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12.5rem, 1fr))', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>الاسم المسجل (للقراءة فقط)</label>
                                    <input className="sidebar-input" style={{color:'var(--text-muted)', border:'2px solid var(--control-edge)', background:'var(--surface-subcard)', marginBottom:0, cursor:'not-allowed', fontWeight: 800}} value={displayName} readOnly title="لتعديل الاسم، تواصل مع الإدارة" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>رقم الجوال / اسم المستخدم</label>
                                    <input className="sidebar-input" style={{color:'var(--text-muted)', border:'2px solid var(--control-edge)', background:'var(--surface-subcard)', marginBottom:0, cursor:'not-allowed', fontWeight: 800}} value={usernamePhone} readOnly title="لتعديل الجوال، تواصل مع الإدارة" />
                                </div>
                            </div>
                            
                            <div style={{ borderTop: '2px dashed var(--control-edge)', paddingTop: '1.875rem' }}>
                                <h4 style={{ color: 'var(--text-primary)', fontWeight: 900, marginBottom: '1.25rem', textAlign: 'center', fontSize: 'var(--fs-lg)' }}>تحديث التوقيع الرقمي المعتمد</h4>
                                <div style={{ border: `2px solid var(--control-edge)`, borderRadius: '14px', overflow: 'hidden', background: 'var(--surface-subcard)' }}>
                                    <SignaturePad userId={userProfile?.id} currentSignature={userProfile?.signature_url} onSaved={refreshProfile} />
                                </div>
                            </div>
                            
                            <button onClick={() => setIsSettingsOpen(false)} style={{ width:'100%', padding: '1.125rem', fontSize: 'var(--fs-lg)', borderRadius: '15px', background: 'var(--action-fill)', color: 'var(--action-ink)', border: 'none', fontWeight: 900, cursor: 'pointer', marginTop: '0.625rem' }}>إغلاق النافذة</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    if (isKpiOnly) {
         return (
             <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', direction: 'rtl', fontFamily: 'inherit' }}>
                 {innerContent}
             </div>
         );
    }

    return (
        <MasterPage 
            title="ملف الموظف الشخصي" 
            subtitle="المركز الرقمي لإدارة المهام والمستحقات والطلبات"
        >
            {innerContent}
        </MasterPage>
    );
}
