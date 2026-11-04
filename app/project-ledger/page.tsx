"use client";
import React, { useState } from 'react';
import MasterPage from '@/components/MasterPage';
import RawasiSmartTable from '@/components/rawasismarttable';
import { formatCurrency } from '@/lib/helpers';
import { THEME } from '@/lib/theme';
import { useLedgerLogic } from './ledger_logic';
import LoadingScreen from '@/components/LoadingScreen';
import { FolderOpen, Folder } from 'lucide-react';
import PhiIcon from '@/components/PhiIcon';

export default function HierarchicalLedgerPage() {
  const logic = useLedgerLogic();
  
  // حفظ حالة "الطي والفتح" لكل مشروع ولكل نوع تكلفة
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});

  const toggleProject = (projName: string) => {
    setExpandedProjects(prev => ({ ...prev, [projName]: !prev[projName] }));
  };

  const toggleType = (typeKey: string) => {
    setExpandedTypes(prev => ({ ...prev, [typeKey]: !prev[typeKey] }));
  };

  // إعداد أعمدة جدول التفاصيل (قاعدة الهرم)
  const columns = [
    { header: 'التاريخ', render: (row: any) => <span style={{ fontWeight: 900, color: '#475569' }}>{row['التاريخ']}</span> },
    { header: 'الشهر المالي', render: (row: any) => <span style={{ fontSize: 'var(--fs-sm)', background: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '6px', fontWeight: 900 }}>{row['الشهر المالي']}</span> },
    { header: 'البيان / اسم البند', render: (row: any) => <span style={{ fontWeight: 800, color: '#1e293b' }}>{row['البيان / البند']}</span> },
    { header: 'التكلفة المحملة', render: (row: any) => <strong style={{ fontSize: 'var(--fs-lg)', color: THEME.coffeeDark }}>{formatCurrency(row['التكلفة المحملة (جنيه)'])}</strong> }
  ];

  return (
    <div className="clean-page">
      <MasterPage title="الدفتر المالي للتكاليف" subtitle="تحليل هرمي للتكاليف من الإجمالي العام حتى أدق التفاصيل">
        
        {logic.isLoading ? (
           <LoadingScreen message="جاري بناء الهرم المالي..." fullScreen={false} />
        ) : (
          <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            
            {/* 📊 لوحة المؤشرات العلوية (تم تقسيمها لعرض كل التكاليف) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11.25rem, 1fr))', gap: '0.9375rem', marginBottom: '1.5625rem' }}>
              <div style={{ backgroundColor: THEME.coffeeDark, color: 'white', padding: '1.25rem', borderRadius: '14px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                <span style={{ fontSize: 'var(--fs-sm)', opacity: 0.8, fontWeight: 800 }}>إجمالي التكاليف</span>
                <strong style={{ display: 'block', fontSize: 'var(--fs-2xl)', fontWeight: 900, color: THEME.goldAccent }}>{formatCurrency(logic.pyramidData.grandTotal)}</strong>
              </div>
              <div style={{ backgroundColor: '#0369a1', color: 'white', padding: '1.25rem', borderRadius: '14px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                <span style={{ fontSize: 'var(--fs-sm)', opacity: 0.8, fontWeight: 800 }}>عمالة مباشرة</span>
                <strong style={{ display: 'block', fontSize: 'var(--fs-2xl)', fontWeight: 900 }}>{formatCurrency(logic.pyramidData.totalLabor)}</strong>
              </div>
              <div style={{ backgroundColor: '#ea580c', color: 'white', padding: '1.25rem', borderRadius: '14px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                <span style={{ fontSize: 'var(--fs-sm)', opacity: 0.8, fontWeight: 800 }}>خامات ومواد</span>
                <strong style={{ display: 'block', fontSize: 'var(--fs-2xl)', fontWeight: 900 }}>{formatCurrency(logic.pyramidData.totalMaterials)}</strong>
              </div>
              <div style={{ backgroundColor: '#be123c', color: 'white', padding: '1.25rem', borderRadius: '14px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                <span style={{ fontSize: 'var(--fs-sm)', opacity: 0.8, fontWeight: 800 }}>مقاولي الباطن</span>
                <strong style={{ display: 'block', fontSize: 'var(--fs-2xl)', fontWeight: 900 }}>{formatCurrency(logic.pyramidData.totalSubcontractors)}</strong>
              </div>
              <div style={{ backgroundColor: '#6b21a8', color: 'white', padding: '1.25rem', borderRadius: '14px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                <span style={{ fontSize: 'var(--fs-sm)', opacity: 0.8, fontWeight: 800 }}>مصروفات وأوفر هيد</span>
                <strong style={{ display: 'block', fontSize: 'var(--fs-2xl)', fontWeight: 900 }}>{formatCurrency(logic.pyramidData.totalOverhead)}</strong>
              </div>
            </div>

            {/* 🎛️ شريط الفلاتر */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.6)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.8)', marginBottom: '1.5625rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 250px' }}>
                <span style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#64748b', marginBottom: '0.3125rem' }}>بحث في التفاصيل:</span>
                <input type="text" placeholder="ابحث عن بند..." value={logic.searchQuery} onChange={(e) => logic.setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.75rem 0.9375rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', fontWeight: 800, outline: 'none' }} />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <span style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#64748b', marginBottom: '0.3125rem' }}>تصفية بالمشروع:</span>
                <select value={logic.filterProject} onChange={(e) => logic.setFilterProject(e.target.value)} style={{ width: '100%', padding: '0.75rem 0.9375rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', fontWeight: 800, outline: 'none', backgroundColor: 'white' }}>
                  <option value="الكل">كل المشاريع</option>
                  {logic.uniqueProjects.map((proj: any, idx: number) => <option key={idx} value={proj}>{proj}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <span style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 900, color: '#64748b', marginBottom: '0.3125rem' }}>نوع التكلفة:</span>
                <select value={logic.filterType} onChange={(e) => logic.setFilterType(e.target.value)} style={{ width: '100%', padding: '0.75rem 0.9375rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', fontWeight: 800, outline: 'none', backgroundColor: 'white' }}>
                  <option value="الكل">كل التكاليف</option>
                  <option value="عمالة مباشرة">عمالة مباشرة</option>
                  <option value="خامات ومواد">خامات ومواد</option>
                  <option value="مصروفات مقاولين">مستخلصات مقاولين</option>
                  <option value="مصروفات تشغيل وأوفر هيد">مصروفات وأوفر هيد</option>
                </select>
              </div>
            </div>

            {/* 🏗️ جسم الهرم (المشاريع والتفاصيل) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
              {logic.pyramidData.projects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.75rem', color: '#94a3b8', fontWeight: 900, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: '14px' }}>لا توجد بيانات مطابقة للفلاتر.</div>
              ) : (
                logic.pyramidData.projects.map((project: any, pIdx: number) => {
                  const isProjOpen = expandedProjects[project.name];

                  return (
                    <div key={pIdx} style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0' }}>
                      
                      {/* مستوى 1: كارت المشروع (رأس العمارة) */}
                      <div 
                        onClick={() => toggleProject(project.name)}
                        style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: isProjOpen ? '#f8fafc' : 'white', transition: '0.2s' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9375rem' }}>
                          <span style={{ fontSize: 'var(--fs-2xl)' }}>{isProjOpen ? <FolderOpen size={20} aria-hidden="true" /> : <Folder size={20} aria-hidden="true" />}</span>
                          <strong style={{ fontSize: 'var(--fs-xl)', color: THEME.coffeeDark, fontWeight: 900 }}>{project.name}</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                          <strong style={{ fontSize: 'var(--fs-xl)', color: THEME.danger, fontWeight: 900 }}>{formatCurrency(project.total)}</strong>
                          <span style={{ fontSize: 'var(--fs-md)', color: '#94a3b8' }}>{isProjOpen ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {/* مستوى 2: أنواع التكاليف داخل المشروع */}
                      {isProjOpen && (
                        <div style={{ padding: '0.625rem 1.25rem 1.25rem 1.25rem', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                          {project.types.map((typeNode: any, tIdx: number) => {
                            const typeKey = `${project.name}-${typeNode.name}`;
                            const isTypeOpen = expandedTypes[typeKey];
                            
                            // 🎨 تحديد الألوان والأيقونات بناءً على نوع التكلفة
                            let icon = '', color = '#6b21a8', bgColor = '#faf5ff', borderColor = '#e9d5ff';
                            if (typeNode.name === 'عمالة مباشرة') { icon = ''; color = '#0369a1'; bgColor = '#f0f9ff'; borderColor = '#bae6fd'; }
                            else if (typeNode.name === 'خامات ومواد') { icon = ''; color = '#ea580c'; bgColor = '#fff7ed'; borderColor = '#ffedd5'; }
                            else if (typeNode.name === 'مصروفات مقاولين') { icon = ''; color = '#be123c'; bgColor = '#fff1f2'; borderColor = '#ffe4e6'; }

                            return (
                              <div key={tIdx} style={{ border: `1px solid ${borderColor}`, borderRadius: '12px', overflow: 'hidden', backgroundColor: 'white' }}>
                                
                                {/* رأس كارت نوع التكلفة */}
                                <div 
                                  onClick={() => toggleType(typeKey)}
                                  style={{ padding: '0.9375rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: bgColor }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                    <PhiIcon value={icon} size={18} />
                                    <strong style={{ fontSize: 'var(--fs-lg)', color: color, fontWeight: 900 }}>{typeNode.name}</strong>
                                    <span style={{ fontSize: 'var(--fs-sm)', backgroundColor: 'white', padding: '2px 0.5rem', borderRadius: '14px', color: '#64748b', fontWeight: 800 }}>{typeNode.items.length} عملية</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.9375rem' }}>
                                    <strong style={{ fontSize: 'var(--fs-lg)', color: color, fontWeight: 900 }}>{formatCurrency(typeNode.total)}</strong>
                                    <span style={{ fontSize: 'var(--fs-sm)', color: '#94a3b8' }}>{isTypeOpen ? '▲' : '▼'}</span>
                                  </div>
                                </div>

                                {/* مستوى 3: التفاصيل (الجدول) */}
                                {isTypeOpen && (
                                  <div style={{ padding: '0.9375rem', borderTop: `1px solid ${borderColor}` }}>
                                    <RawasiSmartTable data={typeNode.items} columns={columns} />
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