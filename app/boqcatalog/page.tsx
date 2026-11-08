"use client";
import React from 'react';
import SecureAction from '@/components/SecureAction';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import { THEME } from '@/lib/theme';
import { useBoqCatalogLogic } from './boq_catalog_logic';
import CatalogItemModal from './CatalogItemModal';
import LoadingScreen from '@/components/LoadingScreen';
import { FolderOpen, Folder, Pencil, Trash2 } from 'lucide-react';

export default function BoqCatalogPage() {
    const logic = useBoqCatalogLogic();

    const sidebarActions = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
            <button onClick={() => {
                logic.setCurrentRecord({ main_category: '', sub_category: '', item_name: '', unit_of_measure: 'مقطوعية' });
                logic.setIsModalOpen(true);
            }} className="btn-main-glass gold">
                إضافة قسم / بند جديد
            </button>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.3125rem 0' }} />
            <button onClick={() => logic.setExpandedNodes({})} className="btn-main-glass white">
                طي جميع الأقسام
            </button>
        </div>
    );

    return (
        <div className="clean-page enterprise-page">
            <MasterPage title="الدليل الموحد لبنود الأعمال (Master BOQ)" subtitle="إدارة التصنيفات الرئيسية والفرعية وبنود القياس القياسية للمشاريع">
                
                <RawasiSidebarManager 
                    summary={
                        <div className="summary-glass-card">
                            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-secondary, #64748b)' }}>إجمالي البنود المسجلة</span>
                            <div className="val" style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: 'var(--accent-ink, #c2410c)', marginTop: '0.3125rem' }}>{logic.catalogItems.length}</div>
                        </div>
                    }
                    actions={sidebarActions}
                    customFilters={
                        <div style={{ marginTop: '0.9375rem' }}>
                            <input 
                                type="text" 
                                placeholder="ابحث عن بند أو تصنيف..." 
                                className="glass-input-field" 
                                value={logic.globalSearch} 
                                onChange={e => logic.setGlobalSearch(e.target.value)} 
                            />
                        </div>
                    }
                    watchDeps={[logic.catalogItems.length, logic.globalSearch]}
                />

                <style>{`
                    .glass-input-field { 
                        width: 100%; 
                        height: 2.75rem;
                        padding: 0 0.875rem; 
                        border-radius: 12px; 
                        background: var(--surface-sunken, #f8fafc); 
                        box-shadow: var(--shadow-sunken, inset 0 2px 4px rgba(0,0,0,0.06));
                        border: none; 
                        outline: none; 
                        font-weight: 700; 
                        color: var(--text-primary, #1e293b); 
                        transition: 0.2s; 
                    }
                    .glass-input-field:focus { 
                        box-shadow: 0 0 0 3px rgba(194,65,12, 0.2); 
                    }
                    .btn-main-glass { 
                        width: 100%; 
                        padding: 0.875rem; 
                        border-radius: 12px; 
                        border: none; 
                        font-weight: 800; 
                        cursor: pointer; 
                        transition: 0.2s; 
                        font-size: var(--fs-sm); 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        gap: 0.5rem; 
                        box-shadow: var(--shadow-elevation);
                    }
                    .btn-main-glass.gold { 
                        background: linear-gradient(135deg, var(--accent-ink, #c2410c), #b48a2e); 
                        color: white; 
                    }
                    .btn-main-glass.white { 
                        background: var(--surface-subcard, #ffffff); 
                        color: var(--text-primary, #1e293b); 
                    }
                    .btn-main-glass:hover { 
                        transform: translateY(-2px); 
                        filter: brightness(1.1); 
                        box-shadow: var(--shadow-ambient); 
                    }
                    .summary-glass-card { 
                        background: var(--surface-card, #ffffff); 
                        padding: 1rem 1.25rem; 
                        border-radius: 14px; 
                        border: none; 
                        box-shadow: var(--shadow-elevation); 
                        margin-bottom: 1.25rem; 
                    }
                    
                    /* ستايلات الشجرة وإدارة الأقسام */
                    .tree-main { 
                        background: var(--surface-card, #ffffff); 
                        border-radius: var(--phi-radius-card, 18px); 
                        border: none; 
                        margin-bottom: 0.9375rem; 
                        overflow: hidden; 
                        box-shadow: var(--shadow-ambient); 
                    }
                    .tree-main-header { 
                        background: var(--surface-card, #ffffff); 
                        padding: 1rem 1.25rem; 
                        font-weight: 800; 
                        font-size: var(--fs-md); 
                        color: var(--text-primary, #0f172a); 
                        cursor: pointer; 
                        display: flex; 
                        align-items: center; 
                        justify-content: space-between; 
                        border-bottom: none; 
                        transition: background 0.15s ease; 
                    }
                    .tree-main-header:hover { 
                        background: var(--table-hover-bg, rgba(0,0,0,0.02)); 
                    }
                    
                    .tree-sub { 
                        margin: 0.5rem 1.25rem 0.5rem 0; 
                        border-right: 2px solid var(--accent-ink, #c2410c); 
                        padding-right: 0.9375rem; 
                    }
                    .tree-sub-header { 
                        padding: 0.625rem 0.75rem; 
                        font-weight: 800; 
                        font-size: var(--fs-sm); 
                        color: var(--text-primary, #1e293b); 
                        cursor: pointer; 
                        display: flex; 
                        align-items: center; 
                        justify-content: space-between; 
                        transition: 0.2s; 
                        border-radius: 10px; 
                    }
                    .tree-sub-header:hover { 
                        background: var(--table-hover-bg, rgba(0,0,0,0.02)); 
                    }
                    
                    .tree-item { 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center; 
                        padding: 0.75rem 1rem; 
                        background: var(--surface-subcard, #ffffff); 
                        border: none; 
                        border-radius: 12px; 
                        margin: 0.375rem 1.25rem 0.375rem 0; 
                        box-shadow: var(--shadow-elevation, 0 1px 3px rgba(0,0,0,0.04)); 
                        transition: 0.2s; 
                    }
                    .tree-item:hover { 
                        box-shadow: var(--shadow-ambient); 
                    }
                    .tree-item-code { 
                        background: var(--surface-sunken, #f8fafc); 
                        box-shadow: var(--shadow-sunken, inset 0 1px 2px rgba(0,0,0,0.05)); 
                        color: var(--text-secondary, #64748b); 
                        padding: 0.2rem 0.5rem; 
                        border-radius: 6px; 
                        font-size: var(--fs-xs); 
                        font-weight: 800; 
                        margin-left: 0.625rem; 
                    }

                    .action-icon { 
                        background: none; 
                        border: none; 
                        cursor: pointer; 
                        color: var(--text-secondary, #94a3b8);
                        font-size: var(--fs-md); 
                        opacity: 0.7; 
                        transition: 0.2s; 
                        padding: 0.375rem; 
                        border-radius: 8px; 
                    }
                    .action-icon:hover { 
                        background: var(--surface-sunken, rgba(0,0,0,0.05)); 
                        color: var(--text-primary, #0f172a);
                        transform: scale(1.1); 
                        opacity: 1;
                    }
                    .tree-main-header:hover .action-icon, .tree-sub-header:hover .action-icon { 
                        opacity: 1; 
                    }
                `}</style>

                {logic.isLoading ? (
                    <LoadingScreen message="جاري تحميل الدليل..." fullScreen={false} />
                ) : (
                    <div style={{ animation: 'fadeIn 0.4s' }}>
                        {Object.keys(logic.treeData).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3.125rem', background: 'var(--surface-card, #ffffff)', borderRadius: 'var(--phi-radius-card, 18px)', color: 'var(--text-secondary, #94a3b8)', fontWeight: 800, boxShadow: 'var(--shadow-ambient)' }}>
                                لا توجد بنود مسجلة في الدليل الموحد.
                            </div>
                        ) : (
                            Object.keys(logic.treeData).map((mainCat) => {
                                const isMainExpanded = logic.expandedNodes[`main_${mainCat}`];
                                
                                return (
                                    <div key={mainCat} className="tree-main">
                                        
                                        {/* رأس القسم الرئيسي */}
                                        <div className="tree-main-header" onClick={() => logic.toggleNode(`main_${mainCat}`)}>
                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                                <span style={{ width: '1.75rem', display: 'inline-flex', alignItems: 'center', color: 'var(--accent-ink, #c2410c)' }}>
                                                    {isMainExpanded ? <FolderOpen size={18} aria-hidden="true" /> : <Folder size={18} aria-hidden="true" />}
                                                </span>
                                                <span style={{ fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>{mainCat}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.3125rem' }}>
                                                <SecureAction module="boqcatalog" action="edit"><button onClick={(e) => { e.stopPropagation(); logic.setCategoryModal({ isOpen: true, oldName: mainCat, newName: mainCat, type: 'main' }); }} className="action-icon" title="تعديل اسم القسم"><Pencil size={16} aria-hidden="true" /></button></SecureAction>
                                                <SecureAction module="boqcatalog" action="delete"><button onClick={(e) => { e.stopPropagation(); if(confirm(`هل أنت متأكد من حذف قسم "${mainCat}" بجميع بنوده نهائياً؟`)) logic.handleDeleteCategory({ name: mainCat, type: 'main' }); }} className="action-icon" title="حذف القسم بالكامل"><Trash2 size={16} aria-hidden="true" /></button></SecureAction>
                                            </div>
                                        </div>

                                        {/* الأقسام الفرعية */}
                                        {isMainExpanded && Object.keys(logic.treeData[mainCat]).map((subCat) => {
                                            const isSubExpanded = logic.expandedNodes[`sub_${mainCat}_${subCat}`];
                                            const items = logic.treeData[mainCat][subCat];

                                            return (
                                                <div key={subCat} className="tree-sub">
                                                    
                                                    {/* رأس القسم الفرعي */}
                                                    <div className="tree-sub-header" onClick={() => logic.toggleNode(`sub_${mainCat}_${subCat}`)}>
                                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                                            <span style={{ width: '1.5625rem', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary, #94a3b8)' }}>{isSubExpanded ? '▼' : '◀'}</span>
                                                            <span style={{ fontWeight: 800 }}>{subCat}</span>
                                                            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary, #94a3b8)', marginRight: '0.5rem' }}>({items.length} بنود)</span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '0.3125rem' }}>
                                                            <SecureAction module="boqcatalog" action="edit"><button onClick={(e) => { e.stopPropagation(); logic.setCategoryModal({ isOpen: true, oldName: subCat, newName: subCat, type: 'sub', parentMain: mainCat }); }} className="action-icon" title="تعديل اسم القسم الفرعي"><Pencil size={16} aria-hidden="true" /></button></SecureAction>
                                                            <SecureAction module="boqcatalog" action="delete"><button onClick={(e) => { e.stopPropagation(); if(confirm(`هل أنت متأكد من حذف "${subCat}" بجميع بنوده؟`)) logic.handleDeleteCategory({ name: subCat, type: 'sub', parentMain: mainCat }); }} className="action-icon" title="حذف القسم الفرعي"><Trash2 size={16} aria-hidden="true" /></button></SecureAction>
                                                        </div>
                                                    </div>

                                                    {/* قائمة البنود التابعة */}
                                                    {isSubExpanded && (
                                                        <div style={{ paddingBottom: '0.625rem' }}>
                                                            {items.map((item: any) => (
                                                                <div key={item.id} className="tree-item">
                                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                        {item.item_code && <span className="tree-item-code">{item.item_code}</span>}
                                                                        <span style={{ fontWeight: 800, color: 'var(--text-primary, #1e293b)', fontSize: 'var(--fs-sm)' }}>{item.item_name}</span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '0.9375rem', alignItems: 'center' }}>
                                                                        <span style={{ fontSize: 'var(--fs-xs)', background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-sunken, inset 0 1px 2px rgba(0,0,0,0.05))', color: 'var(--accent-ink, #c2410c)', padding: '0.25rem 0.5rem', borderRadius: '6px', fontWeight: 800 }}>
                                                                            {item.unit_of_measure}
                                                                        </span>
                                                                        <div style={{ display: 'flex', gap: '0.3125rem' }}>
                                                                            <SecureAction module="boqcatalog" action="edit"><button onClick={() => { logic.setCurrentRecord(item); logic.setIsModalOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, #94a3b8)', padding: '0.25rem' }} title="تعديل البند"><Pencil size={14} aria-hidden="true" /></button></SecureAction>
                                                                            <SecureAction module="boqcatalog" action="delete"><button onClick={() => logic.handleDeleteItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-negative, #ef4444)', padding: '0.25rem' }} title="حذف البند"><Trash2 size={14} aria-hidden="true" /></button></SecureAction>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* زر إضافة بند سريع في هذا القسم */}
                                                    {isSubExpanded && (
                                                        <button onClick={() => {
                                                            logic.setCurrentRecord({ main_category: mainCat, sub_category: subCat, item_name: '', unit_of_measure: 'مقطوعية' });
                                                            logic.setIsModalOpen(true);
                                                        }} style={{ background: 'transparent', color: 'var(--accent-ink, #c2410c)', border: 'none', padding: '0.3125rem 1.25rem', fontSize: 'var(--fs-xs)', fontWeight: 800, cursor: 'pointer', display: 'block', marginTop: '0.3125rem' }}>
                                                            + إضافة بند قياسي لـ &quot;{subCat}&quot;
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* 🚀 مودال تعديل مسمى الأقسام */}
                {logic.categoryModal.isOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(40, 24, 10, 0.7)', backdropFilter: 'blur(10px)', direction: 'rtl', padding: '1rem' }}>
                        <div style={{ background: 'var(--surface-card, #ffffff)', padding: '2rem', borderRadius: '20px', width: '25rem', boxShadow: 'var(--shadow-ambient), 0 20px 40px rgba(0,0,0,0.2)' }}>
                            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', fontWeight: 800 }}>
                                تعديل مسمى {logic.categoryModal.type === 'main' ? 'القسم الرئيسي' : 'القسم الفرعي'}
                            </h3>
                            <input 
                                type="text" 
                                value={logic.categoryModal.newName} 
                                onChange={e => logic.setCategoryModal({...logic.categoryModal, newName: e.target.value})}
                                style={{ width: '100%', height: '2.75rem', padding: '0 0.875rem', borderRadius: '12px', background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-sunken, inset 0 2px 4px rgba(0,0,0,0.06))', border: 'none', outline: 'none', fontWeight: 800, fontSize: 'var(--fs-md)', color: 'var(--text-primary)' }}
                                autoFocus
                            />
                            <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1.5rem' }}>
                                <button onClick={() => logic.handleRenameCategory(logic.categoryModal)} style={{ flex: 1, background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', padding: '0.75rem', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 800, boxShadow: 'var(--shadow-elevation)' }}>حفظ التعديل</button>
                                <button onClick={() => logic.setCategoryModal({...logic.categoryModal, isOpen: false})} style={{ flex: 1, background: 'var(--surface-subcard, #f1f5f9)', color: 'var(--text-primary, #64748b)', padding: '0.75rem', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 800 }}>إلغاء</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🚀 استدعاء مودال البنود */}
                {logic.isModalOpen && (
                    <CatalogItemModal 
                        isOpen={logic.isModalOpen}
                        onClose={() => logic.setIsModalOpen(false)}
                        record={logic.currentRecord}
                        setRecord={logic.setCurrentRecord}
                        onSave={logic.handleSaveItem}
                        isSaving={logic.isSaving}
                        uniqueMains={logic.uniqueMainCategories}
                        uniqueSubs={logic.uniqueSubCategories}
                    />
                )}

            </MasterPage>
        </div>
    );
}
