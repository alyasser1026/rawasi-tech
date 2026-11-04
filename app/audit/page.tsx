"use client";
import React, { useState, useEffect, useMemo } from 'react';
import MasterPage from '@/components/MasterPage';
import { useAdvancedAuditLogic } from './audit_logic';
import { THEME } from '@/lib/theme';
import LoadingScreen from '@/components/LoadingScreen';
import { Siren, Scale, Ghost, Link, PartyPopper } from 'lucide-react';
import PhiIcon from '@/components/PhiIcon';

export default function AccountingAuditPage() {
    const logic = useAdvancedAuditLogic();
    
    // 📑 حالة لتخزين الـ IDs المختارة للمسح الجماعي
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // 🚀 إعدادات تقسيم الصفحات (Pagination)
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 50;

    // تصفير الصفحة للرقم 1 عند البحث
    useEffect(() => {
        setCurrentPage(1);
    }, [logic.searchQuery, logic.activeTab]);

    // حساب عدد الصفحات وتقطيع البيانات
    const totalPages = Math.ceil(logic.errors.length / rowsPerPage) || 1;
    const paginatedErrors = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return logic.errors.slice(start, start + rowsPerPage);
    }, [logic.errors, currentPage]);

    // 🚀 تصنيف الأخطاء الذكي
    const errorCategories = [
        { id: 'unbalanced', keys: ['غير متزن'], title: 'قيود غير متزنة', icon: '⚖️', color: '#ef4444', bg: '#fef2f2' },
        { id: 'missing', keys: ['مفقود', 'نقص', 'غير مكتملة'], title: 'حسابات وتوجيهات مفقودة', icon: '🔗', color: '#d97706', bg: '#fef3c7' },
        { id: 'orphan', keys: ['يتيم'], title: 'سجلات يتيمة (مقطوعة الرأس)', icon: '🕳️', color: '#3b82f6', bg: '#eff6ff' },
        { id: 'ghost', keys: ['شبح'], title: 'سجلات شبح (فارغة بدون تفاصيل)', icon: '👻', color: '#8b5cf6', bg: '#f3e8ff' },
    ];

    // 🔄 معالج اختيار/إلغاء اختيار عنصر واحد
    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    // 🔄 معالج اختيار/إلغاء اختيار كل العناصر داخل قسم (تصنيف) معين في الصفحة الحالية
    const handleToggleSelectCategory = (catErrors: any[]) => {
        const catIds = catErrors.map(e => e.error_id);
        const isAllChecked = catIds.length > 0 && catIds.every(id => selectedIds.includes(id));

        if (isAllChecked) {
            setSelectedIds(prev => prev.filter(id => !catIds.includes(id)));
        } else {
            setSelectedIds(prev => [...new Set([...prev, ...catIds])]);
        }
    };

    // 🗑️ معالج الحذف الجماعي للعناصر المحددة
    const handleBulkDelete = async () => {
        if (confirm(`هل أنت متأكد من الحذف النهائي لـ (${selectedIds.length}) من السجلات والتشوهات المحددة؟`)) {
            try {
                await logic.bulkDelete();
                setSelectedIds([]); 
            } catch (err) {
                console.error("Bulk delete error:", err);
            }
        }
    };

    return (
        <MasterPage title="الرادار المحاسبي المتقدم" subtitle="لوحة التدقيق التفصيلية، الموازنة الآلية، والتطهير الشامل">
            <style>{`
                .audit-stat-card { background: white; border-radius: 16px; padding: 20px; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.03); display: flex; align-items: center; justify-content: space-between; transition: 0.3s; }
                .audit-stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(0,0,0,0.05); }
                
                /* تم تعديل التقسيمة هنا لتشمل 7 أعمدة بدلاً من 6 */
                .err-row { display: grid; grid-template-columns: 40px 40px 1fr 1.6fr 1.8fr 1fr 1.2fr; gap: 15px; align-items: center; padding: 15px; border-bottom: 1px dashed #e2e8f0; transition: 0.2s; }
                .err-row:hover { background: #f8fafc; }
                
                .section-container { background: white; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.03); margin-bottom: 30px; }
                .section-header { padding: 15px 20px; color: white; display: flex; align-items: center; gap: 10px; font-weight: 900; font-size: 16px; }
                
                .audit-checkbox { width: 18px; height: 18px; cursor: pointer; accent-color: ${THEME.primary || '#3b82f6'}; }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* 📊 الإحصائيات العلوية */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
                <div className="audit-stat-card">
                    <div><h3 style={{ margin: '0 0 5px 0', color: THEME.primary || '#3b82f6', fontSize: '26px' }}>{logic.stats.total}</h3><p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#64748b' }}>إجمالي التشوهات</p></div><div style={{ fontSize: '32px' }}><Siren size={27} aria-hidden="true" /></div>
                </div>
                <div className="audit-stat-card">
                    <div><h3 style={{ margin: '0 0 5px 0', color: '#ef4444', fontSize: '26px' }}>{logic.stats.unbalanced}</h3><p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#64748b' }}>قيود غير متزنة</p></div><div style={{ fontSize: '32px' }}><Scale size={27} aria-hidden="true" /></div>
                </div>
                <div className="audit-stat-card">
                    <div><h3 style={{ margin: '0 0 5px 0', color: '#8b5cf6', fontSize: '26px' }}>{logic.stats.ghosts}</h3><p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#64748b' }}>سجلات شبح</p></div><div style={{ fontSize: '32px' }}><Ghost size={27} aria-hidden="true" /></div>
                </div>
                <div className="audit-stat-card">
                    <div><h3 style={{ margin: '0 0 5px 0', color: '#f59e0b', fontSize: '26px' }}>{logic.stats.brokenRef}</h3><p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#64748b' }}>بيانات مفقودة</p></div><div style={{ fontSize: '32px' }}><Link size={27} aria-hidden="true" /></div>
                </div>
            </div>

            {/* 🎛️ شريط التحكم */}
            <div style={{ background: 'white', padding: '15px 25px', borderRadius: '16px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '15px' }}>
                <input 
                    type="text" 
                    placeholder="ابحث في تفاصيل المشكلة، التوجيه، الجهة، أو ID..." 
                    value={logic.searchQuery}
                    onChange={(e) => logic.setSearchQuery(e.target.value)}
                    style={{ padding: '12px 20px', borderRadius: '10px', border: '2px solid #f1f5f9', outline: 'none', width: '380px', fontWeight: 700, fontSize: '14px' }}
                />
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {selectedIds.length > 0 && (
                        <button 
                            onClick={handleBulkDelete} 
                            disabled={logic.isBulkDeleting}
                            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', animation: 'fadeIn 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {logic.isBulkDeleting ? 'جاري الحذف...' : `حذف المحدد (${selectedIds.length})`}
                        </button>
                    )}
                    
                    {/* 🚀 الزرار الجديد: تطهير القيود الصفرية */}
                    <button 
                        onClick={() => confirm('هل أنت متأكد من مسح كافة القيود الصفرية والعمياء من قاعدة البيانات؟') && logic.cleanZeroLines()} 
                        disabled={logic.isCleaningZeroLines}
                        style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 900, cursor: logic.isCleaningZeroLines ? 'not-allowed' : 'pointer', opacity: logic.isCleaningZeroLines ? 0.7 : 1, transition: '0.2s' }}
                    >
                        {logic.isCleaningZeroLines ? 'جاري التنظيف...' : 'تطهير القيود الصفرية'}
                    </button>

                    <button onClick={logic.exportToExcel} style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }}>تصدير التقرير</button>
                    <button onClick={() => { logic.refetch(); setSelectedIds([]); setCurrentPage(1); }} style={{ background: THEME.primary || '#3b82f6', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }}>تحديث الرادار</button>
                </div>
            </div>

            {/* 📋 الأقسام المفصلة (مقطعة إلى صفحات) */}
            {logic.isLoading ? (
                <LoadingScreen message="جاري الفحص الشامل للدفاتر..." fullScreen={false} />
            ) : logic.errors.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '60px', marginBottom: '15px' }}><PartyPopper size={40} aria-hidden="true" /></div>
                    <h2 style={{ color: '#16a34a', margin: 0, fontWeight: 900 }}>الدفاتر متزنة وقاعدة البيانات نظيفة 100%</h2>
                    <p style={{ color: '#64748b', marginTop: '10px', fontWeight: 700 }}>لم يتم اكتشاف أي تشوهات محاسبية أو مراجع مفقودة.</p>
                </div>
            ) : (
                <>
                    <div>
                        {errorCategories.map(cat => {
                            const catErrors = paginatedErrors.filter((e:any) => cat.keys.some(k => e.error_type.includes(k)));
                            
                            if (catErrors.length === 0) return null;

                            const catIds = catErrors.map(e => e.error_id);
                            const isAllCatChecked = catIds.length > 0 && catIds.every(id => selectedIds.includes(id));

                            return (
                                <div key={cat.id} className="section-container">
                                    <div className="section-header" style={{ background: cat.color }}>
                                        <PhiIcon value={cat.icon} size={18} /> {cat.title} ({catErrors.length})
                                    </div>
                                    {/* 🚀 تم تعديل التقسيمة هنا أيضاً لتتطابق مع الـ err-row */}
                                    <div style={{ background: '#f8fafc', padding: '12px 15px', display: 'grid', gridTemplateColumns: '40px 40px 1fr 1.6fr 1.8fr 1fr 1.2fr', gap: '15px', fontWeight: 900, color: '#475569', fontSize: '13px', borderBottom: '1px solid #e2e8f0', alignItems: 'center' }}>
                                        <input 
                                            type="checkbox" 
                                            className="audit-checkbox"
                                            checked={isAllCatChecked}
                                            onChange={() => handleToggleSelectCategory(catErrors)}
                                            title="تحديد كل أخطاء هذا القسم في هذه الصفحة"
                                        />
                                        <span>م</span>
                                        <span>التاريخ</span>
                                        <span>مصدر الحركة والجهة</span>
                                        <span>التشخيص الفني والبيان</span>
                                        <span>الفرق المالي</span>
                                        <span style={{ textAlign: 'center' }}>إجراءات الإصلاح</span>
                                    </div>
                                    
                                    {catErrors.map((err: any, idx: number) => (
                                        <div key={err.error_id} className="err-row">
                                            <input 
                                                type="checkbox" 
                                                className="audit-checkbox"
                                                checked={selectedIds.includes(err.error_id)}
                                                onChange={() => handleToggleSelect(err.error_id)}
                                            />
                                            
                                            <div style={{ color: '#94a3b8', fontWeight: 900, fontSize: '14px' }}>{(currentPage - 1) * rowsPerPage + idx + 1}</div>
                                            
                                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#334155' }}>
                                                {err.error_date}
                                            </div>

                                            {/* 🚀 قسم مصدر الحركة والمستند الأصلي والجهة */}
                                            <div>
                                                <div style={{ display: 'inline-block', background: cat.bg, color: cat.color, padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 900, marginBottom: '6px' }}>
                                                    أصل الحركة: {err.source_type === 'journal_headers' ? 'قيد مباشر/يدوي' : (err.source_type || err.table_name || 'غير محدد')}
                                                </div>
                                                
                                                {/* 👤 عرض العميل / المقاول / المستفيد */}
                                                {err.info_party && (
                                                    <div style={{ fontSize: '12px', color: '#1e293b', fontWeight: 800, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ color: '#64748b' }}>الجهة:</span> {err.info_party}
                                                    </div>
                                                )}

                                                <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', fontWeight: 800, userSelect: 'all' }}>
                                                    مرجع الأصل: {err.source_id || err.error_id || 'N/A'}
                                                </div>
                                            </div>

                                            {/* 📋 التشخيص الفني ووصف الحركة */}
                                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#475569', lineHeight: 1.6 }}>
                                                <div style={{ color: '#1e293b', fontWeight: 800 }}>{err.details}</div>
                                                
                                                {/* 📝 عرض البيان / وصف الفاتورة أو المصروف الاصلية */}
                                                {err.info_description && (
                                                    <div style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', color: '#64748b', marginTop: '6px', borderRight: `3px solid ${cat.color}`, fontWeight: 600 }}>
                                                        البيان الأصلي: {err.info_description}
                                                    </div>
                                                )}
                                            </div>

                                            {/* 💰 عرض الفرق المالي في عمود منفصل لتسهيل القراءة */}
                                            <div>
                                                {Math.abs(Number(err.diff_amount || 0)) > 0 ? (
                                                    <div style={{ color: cat.color, fontSize: '14px', fontWeight: 900, background: cat.bg, padding: '4px 8px', borderRadius: '6px', display: 'inline-block' }}>
                                                        {Math.abs(Number(err.diff_amount)).toLocaleString()} ريال
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#cbd5e1', fontWeight: 800 }}>-</span>
                                                )}
                                            </div>

                                            {/* 🛠️ أزرار الإجراءات */}
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                {cat.id === 'unbalanced' && (
                                                    <button 
                                                        onClick={() => logic.autoBalance(err.header_id, err.diff_amount)} 
                                                        style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 900, fontSize: '12px', cursor: 'pointer', transition: '0.2s' }}
                                                    >موازنة</button>
                                                )}
                                                <button 
                                                    onClick={() => confirm('هل أنت متأكد من الحذف النهائي لتنظيف السجل؟') && logic.deleteError(err.error_id, err.table_name)} 
                                                    disabled={logic.isDeleting}
                                                    style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 900, fontSize: '12px', cursor: 'pointer', opacity: logic.isDeleting ? 0.5 : 1, transition: '0.2s' }}
                                                >حذف</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>

                    {/* 🚀 زراير التقسيم (Pagination Footer) */}
                    {logic.errors.length > 0 && (
                        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', background: 'white', padding: '18px 25px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                            <div style={{ fontSize: '15px', fontWeight: 900, color: '#475569' }}>
                                إجمالي السجلات المصابة: <span style={{ color: THEME.primary || '#3b82f6', fontSize: '18px' }}>{logic.errors.length}</span> سجل
                            </div>
                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                <button 
                                    onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}
                                    style={{ padding: '10px 25px', borderRadius: '10px', border: 'none', background: currentPage === 1 ? '#f1f5f9' : (THEME.primary || '#3b82f6'), color: currentPage === 1 ? '#94a3b8' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 900, transition: '0.2s' }}
                                >السابق</button>
                                
                                <span style={{ padding: '10px 25px', background: '#f8fafc', borderRadius: '10px', fontWeight: 900, border: '1px solid #e2e8f0', color: '#1e293b', fontSize: '14px' }}>
                                    صفحة {currentPage} من {totalPages}
                                </span>
                                
                                <button 
                                    onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}
                                    style={{ padding: '10px 25px', borderRadius: '10px', border: 'none', background: currentPage === totalPages ? '#f1f5f9' : (THEME.primary || '#3b82f6'), color: currentPage === totalPages ? '#94a3b8' : 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: 900, transition: '0.2s' }}
                                >التالي</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </MasterPage>
    );
}