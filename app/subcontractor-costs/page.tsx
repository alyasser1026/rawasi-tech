"use client";
import React, { useState } from 'react';
import MasterPage from '@/components/MasterPage';
import RawasiSmartTable from '@/components/rawasismarttable';
import { formatCurrency } from '@/lib/helpers';
import { THEME } from '@/lib/theme';
import { useSubcontractorCostsLogic } from './subcontractor_costs_logic';
import LoadingScreen from '@/components/LoadingScreen';
import { House, BrickWall } from 'lucide-react';

export default function SubcontractorCostsPage() {
  const logic = useSubcontractorCostsLogic();
  
  // حفظ حالة "الطي والفتح" للفلل والبنود
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleProject = (name: string) => {
    setExpandedProjects(p => ({ ...p, [name]: !p[name] }));
  };
  
  const toggleItem = (key: string) => {
    setExpandedItems(p => ({ ...p, [key]: !p[key] }));
  };

  // 🚀 أعمدة الجدول الاحترافية لعرض تفاصيل (الإجمالي - الخصم = الصافي)
  const columns = [
    { header: 'التاريخ', render: (row: any) => <span style={{ fontWeight: 800, color: '#475569' }}>{row.claim_date}</span> },
    { header: 'المستخلص', render: (row: any) => <span style={{ fontSize: 'var(--fs-sm)', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontWeight: 900 }}>{row.claim_number}</span> },
    { header: 'المقاول', render: (row: any) => <strong style={{ color: THEME.primary, fontSize: 'var(--fs-md)' }}>{row.contractor_name}</strong> },
    { header: 'الكمية المنفذة', render: (row: any) => <span style={{ fontWeight: 900, fontSize: 'var(--fs-lg)' }}>{row.quantity}</span> },
    { header: 'الفئة', render: (row: any) => <span style={{ fontWeight: 800 }}>{formatCurrency(row.unit_price)}</span> },
    { header: 'إجمالي الأعمال', render: (row: any) => <strong style={{ color: '#0369a1' }}>{formatCurrency(row.gross_total)}</strong> },
    { header: 'خصم خامات', render: (row: any) => <strong style={{ color: THEME.danger }}>{formatCurrency(row.material_deduction)}</strong> },
    { header: 'الصافي المستحق', render: (row: any) => <strong style={{ fontSize: 'var(--fs-lg)', color: '#10b981', background: '#ecfdf5', padding: '4px 8px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>{formatCurrency(row.net_total)}</strong> }
  ];

  return (
    <div className="clean-page">
      <MasterPage title="تحليل تكاليف الفلل والبنود" subtitle="حساب صافي تكلفة المقاولين بعد خصم الخامات المسحوبة لكل فيلا وبند">
        
        {logic.isLoading ? (
           <LoadingScreen message="جاري حساب الأعمال وخصومات الخامات..." fullScreen={false} />
        ) : (
          <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            
            {/* 📊 لوحة المؤشرات الثلاثية العلوية */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '25px' }}>
              <div style={{ backgroundColor: '#0369a1', color: 'white', padding: '25px', borderRadius: '14px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                <span style={{ fontSize: 'var(--fs-md)', opacity: 0.8, fontWeight: 800 }}>إجمالي أعمال المقاولين</span>
                <strong style={{ display: 'block', fontSize: 'var(--fs-3xl)', fontWeight: 900 }}>{formatCurrency(logic.hierarchy.grandGross)}</strong>
              </div>
              <div style={{ backgroundColor: THEME.danger, color: 'white', padding: '25px', borderRadius: '14px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                <span style={{ fontSize: 'var(--fs-md)', opacity: 0.8, fontWeight: 800 }}>خامات مخصومة (مسحوبات)</span>
                <strong style={{ display: 'block', fontSize: 'var(--fs-3xl)', fontWeight: 900 }}>{formatCurrency(logic.hierarchy.grandDeductions)}</strong>
              </div>
              <div style={{ backgroundColor: '#10b981', color: 'white', padding: '25px', borderRadius: '14px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                <span style={{ fontSize: 'var(--fs-md)', opacity: 0.9, fontWeight: 800 }}>الصافي الفعلي للمقاولين</span>
                <strong style={{ display: 'block', fontSize: 'var(--fs-3xl)', fontWeight: 900 }}>{formatCurrency(logic.hierarchy.grandNet)}</strong>
              </div>
            </div>

            {/* 🎛️ شريط الفلاتر الذكي */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.8)', marginBottom: '25px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 250px' }}>
                <span style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#64748b', marginBottom: '5px' }}>بحث:</span>
                <input type="text" placeholder="باسم المقاول أو المستخلص..." value={logic.searchQuery} onChange={(e) => logic.setSearchQuery(e.target.value)} style={{ width: '100%', padding: '12px 15px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', fontWeight: 800, outline: 'none' }} />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <span style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#64748b', marginBottom: '5px' }}>تصفية بالفيلا/المشروع:</span>
                <select value={logic.filterProject} onChange={(e) => logic.setFilterProject(e.target.value)} style={{ width: '100%', padding: '12px 15px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', fontWeight: 800, backgroundColor: 'white', outline: 'none' }}>
                  <option value="الكل">كل الفلل</option>
                  {logic.uniqueProjects.map((p) => <option key={p as string} value={p as string}>{p}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <span style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#64748b', marginBottom: '5px' }}>تصفية بالبند:</span>
                <select value={logic.filterItem} onChange={(e) => logic.setFilterItem(e.target.value)} style={{ width: '100%', padding: '12px 15px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', fontWeight: 800, backgroundColor: 'white', outline: 'none' }}>
                  <option value="الكل">كل البنود</option>
                  {logic.uniqueItems.map((item) => <option key={item as string} value={item as string}>{item}</option>)}
                </select>
              </div>
            </div>

            {/* 🏗️ جسم الهرم (الفيلا -> البند -> التفاصيل) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {logic.hierarchy.projects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontWeight: 900, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: '14px' }}>لا توجد تكاليف مطابقة للفلاتر.</div>
              ) : (
                logic.hierarchy.projects.map((project: any) => {
                  const isProjOpen = expandedProjects[project.name];

                  return (
                    <div key={project.name} style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                      
                      {/* 1. الفيلا / المشروع */}
                      <div onClick={() => toggleProject(project.name)} style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: isProjOpen ? '#f8fafc' : 'white', transition: '0.2s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <span style={{ fontSize: 'var(--fs-2xl)' }}><House size={20} aria-hidden="true" /></span>
                          <strong style={{ fontSize: 'var(--fs-xl)', color: THEME.coffeeDark, fontWeight: 900 }}>{project.name}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ color: '#0369a1', fontWeight: 800, fontSize: 'var(--fs-sm)', backgroundColor: '#f0f9ff', padding: '4px 10px', borderRadius: '8px' }}>إجمالي: {formatCurrency(project.gross)}</span>
                          <span style={{ color: THEME.danger, fontWeight: 800, fontSize: 'var(--fs-sm)', backgroundColor: '#fff1f2', padding: '4px 10px', borderRadius: '8px' }}>خصم: {formatCurrency(project.deduction)}</span>
                          <strong style={{ color: '#10b981', fontWeight: 900, fontSize: 'var(--fs-lg)', backgroundColor: '#ecfdf5', padding: '4px 10px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>صافي: {formatCurrency(project.net)} {isProjOpen ? '▲' : '▼'}</strong>
                        </div>
                      </div>

                      {/* 2. البنود داخل الفيلا */}
                      {isProjOpen && (
                        <div style={{ padding: '15px 20px', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {project.items.map((itemNode: any) => {
                            const itemKey = `${project.name}-${itemNode.name}`;
                            const isItemOpen = expandedItems[itemKey];

                            return (
                              <div key={itemKey} style={{ border: '1px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'white' }}>
                                {/* رأس البند */}
                                <div onClick={() => toggleItem(itemKey)} style={{ padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: '#f1f5f9' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span><BrickWall size={16} aria-hidden="true" /></span>
                                    <strong style={{ color: '#334155', fontWeight: 900 }}>{itemNode.name}</strong>
                                    <span style={{ fontSize: 'var(--fs-xs)', background: '#e2e8f0', padding: '3px 8px', borderRadius: '10px', color: '#475569', fontWeight: 800 }}>{itemNode.claims.length} عملية</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                    <span style={{ color: '#0369a1', fontSize: 'var(--fs-sm)', fontWeight: 800 }}>إجمالي: {formatCurrency(itemNode.gross)}</span>
                                    <span style={{ color: THEME.danger, fontSize: 'var(--fs-sm)', fontWeight: 800 }}>خصم: {formatCurrency(itemNode.deduction)}</span>
                                    <strong style={{ color: '#10b981', fontSize: 'var(--fs-md)', fontWeight: 900 }}>صافي: {formatCurrency(itemNode.net)} {isItemOpen ? '▲' : '▼'}</strong>
                                  </div>
                                </div>
                                
                                {/* 3. الجدول (تفاصيل العمليات) */}
                                {isItemOpen && (
                                  <div style={{ padding: '15px', borderTop: '1px solid #cbd5e1' }}>
                                    <RawasiSmartTable data={itemNode.claims} columns={columns} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}
      </MasterPage>
    </div>
  );
}