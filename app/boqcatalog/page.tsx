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
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '0.3125rem 0' }} />
            <button onClick={() => logic.setExpandedNodes({})} className="btn-main-glass white">
                طي جميع الأقسام
            </button>
        </div>
    );

    return (
        <div className="clean-page">
            <MasterPage title="الدليل الموحد لبنود الأعمال (Master BOQ)" subtitle="إدارة التصنيفات الرئيسية والفرعية وبنود القياس القياسية للمشاريع">
                
                <RawasiSidebarManager 
                    summary={
                        <div className="summary-glass-card">
                            <span style={{fontSize:'var(--fs-sm)', fontWeight:800, color:'#64748b'}}>إجمالي البنود المسجلة</span>
                            <div className="val" style={{fontSize:'var(--fs-2xl)', fontWeight:900, color: THEME.primary, marginTop:'0.3125rem'}}>{logic.catalogItems.length}</div>
                        </div>
                    }
                    actions={sidebarActions}
                    customFilters={
                        <div style={{marginTop: '0.9375rem'}}>
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
                    .glass-input-field { width: 100%; padding: 0.75rem; border-radius: 12px; background: rgba(255, 255, 255, 0.65); border: 1px solid rgba(255, 255, 255, 0.8); outline: none; font-weight: 700; color: #1e293b; transition: 0.3s; }
                    .glass-input-field:focus { background: #ffffff; border-color: ${THEME.goldAccent}; box-shadow: 0 0 0 4px rgba(194,65,12, 0.15); }
                    .btn-main-glass { width: 100%; padding: 0.875rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(15px); font-weight: 900; cursor: pointer; transition: 0.2s; font-size: var(--fs-sm); display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
                    .btn-main-glass.gold { background: linear-gradient(135deg, rgba(194,65,12, 0.9), rgba(194,65,12, 1)); color: white; }
                    .btn-main-glass.white { background: rgba(255, 255, 255, 0.6); color: #1e293b; border: 1px solid rgba(255,255,255,0.8); }
                    .btn-main-glass:hover { transform: translateY(-3px); filter: brightness(1.1); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
                    .summary-glass-card { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 1.25rem; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.2); margin-bottom: 1.5625rem; }
                    
                    /* ستايلات الشجرة وإدارة الأقسام */
                    .tree-main { background: white; border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 0.9375rem; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
                    .tree-main-header { background: #f8fafc; padding: 0.9375rem 1.25rem; font-weight: 900; font-size: var(--fs-lg); color: ${THEME.coffeeDark}; cursor: pointer; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; transition: 0.2s; }
                    .tree-main-header:hover { background: #f1f5f9; }
                    
                    .tree-sub { margin: 0.625rem 1.25rem 0.625rem 0; border-right: 3px solid ${THEME.goldAccent}50; padding-right: 0.9375rem; }
                    .tree-sub-header { padding: 0.625rem; font-weight: 900; font-size: var(--fs-md); color: ${THEME.coffeeMain}; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: 0.2s; border-radius: 8px; }
                    .tree-sub-header:hover { background: #f8fafc; }
                    
                    .tree-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0.9375rem; background: white; border: 1px solid #f1f5f9; border-radius: 12px; margin: 0.3125rem 1.25rem 0.3125rem 0; transition: 0.2s; }
                    .tree-item:hover { border-color: ${THEME.goldAccent}; box-shadow: 0 4px 10px rgba(0,0,0,0.03); }
                    .tree-item-code { background: #f1f5f9; color: #64748b; padding: 0.1875rem 0.5rem; border-radius: 6px; font-size: var(--fs-xs); font-weight: 800; margin-left: 0.625rem; }

                    .action-icon { background: none; border: none; cursor: pointer; font-size: var(--fs-md); opacity: 0; transition: 0.2s; padding: 0.3125rem; border-radius: 6px; }
                    .action-icon:hover { background: rgba(0,0,0,0.05); transform: scale(1.1); }
                    .tree-main-header:hover .action-icon, .tree-sub-header:hover .action-icon { opacity: 1; }
                `}</style>

                {logic.isLoading ? (
                    <LoadingScreen message="جاري تحميل الدليل..." fullScreen={false} />
                ) : (
                    <div style={{ animation: 'fadeIn 0.4s' }}>
                        {Object.keys(logic.treeData).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3.125rem', background: 'white', borderRadius: '14px', color: '#94a3b8', fontWeight: 900 }}>
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
                                                <span style={{ width: '1.5625rem' }}>{isMainExpanded ? <FolderOpen size={16} aria-hidden="true" /> : <Folder size={16} aria-hidden="true" />}</span>
                                                {mainCat}
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
                                                            <span style={{ width: '1.5625rem', fontSize: 'var(--fs-sm)' }}>{isSubExpanded ? '▼' : '◀'}</span>
                                                            {subCat} <span style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', marginRight: '0.5rem' }}>({items.length} بنود)</span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '0.3125rem' }}>
                                                            <SecureAction module="boqcatalog" action="edit"><button onClick={(e) => { e.stopPropagation(); logic.setCategoryModal({ isOpen: true, oldName: subCat, newName: subCat, type: 'sub', parentMain: mainCat }); }} className="action-icon" title="تعديل اسم القسم الفرعي"><Pencil size={16} aria-hidden="true" /></button></SecureAction>
                                                            <SecureAction module="boqcatalog" action="delete"><button onClick={(e) => { e.stopPropagation(); if(confirm(`هل أنت متأكد من حذف "${subCat}" بجميع بنوده؟`)) logic.handleDeleteCategory({ name: subCat, type: 'sub', parentMain: mainCat }); }} className="action-icon" title="حذف القسم الفرعي"><Trash2 size={16} aria-hidden="true" /></button></SecureAction>
                                                        </div>
                                                    </div>

                                                    {/* البنود الداخلية */}
                                                    {isSubExpanded && items.map((item: any) => (
                                                        <div key={item.id} className="tree-item">
                                                            <div>
                                                                <span className="tree-item-code">{item.item_code}</span>
                                                                <span style={{ fontWeight: 800, color: '#1e293b', fontSize: 'var(--fs-sm)' }}>{item.item_name}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '0.9375rem', alignItems: 'center' }}>
                                                                <span style={{ fontSize: 'var(--fs-xs)', background: '#ecfdf5', color: '#059669', padding: '0.25rem 0.5rem', borderRadius: '6px', fontWeight: 900 }}>
                                                                    {item.unit_of_measure}
                                                                </span>
                                                                <div>
                                                                    <SecureAction module="boqcatalog" action="edit"><button onClick={() => { logic.setCurrentRecord(item); logic.setIsModalOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-md)', opacity: 0.6 }} title="تعديل البند"><Pencil size={14} aria-hidden="true" /></button></SecureAction>
                                                                    <SecureAction module="boqcatalog" action="delete"><button onClick={() => logic.handleDeleteItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-md)', opacity: 0.6 }} title="حذف البند"><Trash2 size={14} aria-hidden="true" /></button></SecureAction>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    
                                                    {/* زر إضافة سريع تحت كل قسم فرعي */}
                                                    {isSubExpanded && (
                                                        <button onClick={() => {
                                                            logic.setCurrentRecord({ main_category: mainCat, sub_category: subCat, item_name: '', unit_of_measure: 'مقطوعية' });
                                                            logic.setIsModalOpen(true);
                                                        }} style={{ background: 'transparent', color: THEME.goldAccent, border: 'none', padding: '0.3125rem 1.25rem', fontSize: 'var(--fs-xs)', fontWeight: 900, cursor: 'pointer', display: 'block', marginTop: '0.3125rem' }}>
                                                            + إضافة بند جديد تحت "{subCat}"
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
                    <div style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(40, 24, 10, 0.7)', backdropFilter: 'blur(10px)', direction: 'rtl' }}>
                        <div style={{ background: 'white', padding: '1.875rem', borderRadius: '14px', width: '25rem', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                            <h3 style={{ margin: '0 0 0.9375rem 0', color: THEME.primary, fontWeight: 900 }}>
                                تعديل مسمى {logic.categoryModal.type === 'main' ? 'القسم الرئيسي' : 'القسم الفرعي'}
                            </h3>
                            <input 
                                type="text" 
                                value={logic.categoryModal.newName} 
                                onChange={e => logic.setCategoryModal({...logic.categoryModal, newName: e.target.value})}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '2px solid #e2e8f0', outline: 'none', fontWeight: 900, fontSize: 'var(--fs-lg)' }}
                                autoFocus
                            />
                            <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1.5625rem' }}>
                                <button onClick={() => logic.handleRenameCategory(logic.categoryModal)} style={{ flex: 1, background: THEME.success, color: 'white', padding: '0.75rem', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 900 }}>حفظ التعديل</button>
                                <button onClick={() => logic.setCategoryModal({...logic.categoryModal, isOpen: false})} style={{ flex: 1, background: '#f1f5f9', color: '#64748b', padding: '0.75rem', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 900 }}>إلغاء</button>
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