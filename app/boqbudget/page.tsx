"use client";
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useBOQLogic } from './boqbudget_logic';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers'; 
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager'; 
import SmartCombo from '@/components/SmartCombo'; 
import BOQModal from './BOQModal';
import LoadingScreen from '@/components/LoadingScreen';
import { Pencil } from 'lucide-react';

const CellWrapper = ({ row, children, justify = 'center' }: { row: any, children: React.ReactNode, justify?: string }) => (
    <div style={{ 
        padding: '0.375rem 0.625rem', 
        height: '100%',
        minHeight: '2.1875rem', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: justify,
        fontSize: 'var(--fs-xs)', 
        whiteSpace: 'nowrap',
        fontWeight: 700
    }}>
        {children}
    </div>
);

const parseAmt = (val: any) => Number(String(val || '0').replace(/,/g, '')) || 0;

export default function BOQBudgetPage() {
  const logic = useBOQLogic(); 
  const [mounted, setMounted] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  useEffect(() => { setMounted(true); }, []);

  const groupedProjects = useMemo(() => {
      const groups: Record<string, any> = {};
      
      logic.allFiltered.forEach((item: any) => {
          const pName = item.Property || item.projects?.Property || 'عام / غير مصنف';
          const pType = item.projects?.unit_type || ''; 

          if (!groups[pName]) {
              groups[pName] = { 
                  projectName: pName, 
                  projectType: pType, 
                  items: [], 
                  total_contract: 0,
                  est_material: 0, est_labor: 0, est_exp: 0, 
                  act_material: 0, act_labor: 0, act_exp: 0, act_rev: 0, 
                  var_material: 0, var_labor: 0, var_total: 0, net_profit: 0
              };
          }
          groups[pName].items.push(item);

          groups[pName].total_contract += parseAmt(item.total_contract_amount);
          groups[pName].est_material += parseAmt(item.estimated_material_cost);
          groups[pName].est_labor += parseAmt(item.estimated_labor_cost);
          groups[pName].est_exp += parseAmt(item.estimated_expenses_cost);
          groups[pName].act_material += parseAmt(item.actual_material_cost);
          groups[pName].act_labor += parseAmt(item.actual_labor_cost);
          groups[pName].act_exp += parseAmt(item.actual_expenses_cost);
          groups[pName].act_rev += parseAmt(item.actual_revenue);
          groups[pName].var_material += parseAmt(item.material_variance);
          groups[pName].var_labor += parseAmt(item.labor_variance);
          groups[pName].var_total += parseAmt(item.total_budget_variance);
          groups[pName].net_profit += parseAmt(item.item_net_profit);
      });
      
      return Object.values(groups).sort((a, b) => b.total_contract - a.total_contract);
  }, [logic.allFiltered]);

  const paginatedGroups = useMemo(() => {
      const start = (logic.currentPage - 1) * logic.rowsPerPage;
      return groupedProjects.slice(start, start + logic.rowsPerPage);
  }, [groupedProjects, logic.currentPage, logic.rowsPerPage]);

  const totalPages = Math.ceil(groupedProjects.length / logic.rowsPerPage) || 1;

  const toggleProject = (projectName: string) => {
      setExpandedProjects(prev => prev.includes(projectName) ? prev.filter(p => p !== projectName) : [...prev, projectName]);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() === 'input' || target.tagName.toLowerCase() === 'select' || target.tagName.toLowerCase() === 'button' || target.closest('button')) return;

      if (!scrollerRef.current) return;
      isDragging.current = true;
      hasDragged.current = false;
      scrollerRef.current.classList.add('is-dragging');
      startX.current = e.pageX - scrollerRef.current.offsetLeft;
      scrollLeft.current = scrollerRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
      isDragging.current = false;
      if (scrollerRef.current) scrollerRef.current.classList.remove('is-dragging');
  };

  const handleMouseUp = () => {
      isDragging.current = false;
      if (scrollerRef.current) scrollerRef.current.classList.remove('is-dragging');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging.current || !scrollerRef.current) return;
      e.preventDefault();
      const x = e.pageX - scrollerRef.current.offsetLeft;
      const walk = (x - startX.current) * 1.5; 

      if (Math.abs(x - startX.current) > 5) {
          hasDragged.current = true;
      }

      scrollerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleClickCapture = (e: React.MouseEvent) => {
      if (hasDragged.current) {
          e.stopPropagation();
          e.preventDefault();
      }
  };

  const sidebarActions = useMemo(() => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
        <button className="btn-main-glass gold" onClick={logic.handleAddNew}>
          إضافة بند جديد
        </button>

      {logic.selectedIds.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.3125rem', paddingTop: '0.9375rem', borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
          <p style={{fontSize:'var(--fs-xs)', textAlign:'center', color:'#94a3b8', fontWeight:900, marginBottom:'-0.3125rem'}}>الإجراءات على ({logic.selectedIds.length})</p>
          
          {logic.selectedIds.length === 1 && (
              <button className="btn-main-glass white" onClick={() => logic.handleEdit(logic.allFiltered.find((i:any) => String(i.id) === logic.selectedIds[0]))}>
                تعديل البيانات
              </button>
          )}
          <button className="btn-main-glass red" onClick={logic.handleDeleteSelected} disabled={logic.isSaving}>
            حذف البنود
          </button>
        </div>
      )}
    </div>
  ), [logic.selectedIds, logic]);

  return (
    <MasterPage title="المقايسات (BOQ)" subtitle="إدارة بنود الأعمال، التكاليف التقديرية والفعلية بشكل هرمي لكل مشروع">
      
      <RawasiSidebarManager 
        summary={
          <div className="summary-glass-card">
            <span style={{fontSize:'var(--fs-sm)', fontWeight:800, color:'#64748b'}}>إجمالي المشاريع / الفلل</span>
            <div className="val" style={{fontSize:'var(--fs-2xl)', fontWeight:900, color: THEME.goldAccent, marginTop:'0.3125rem'}}>{groupedProjects.length}</div>
            <div style={{fontSize:'var(--fs-xs)', color:'#94a3b8', marginTop:'0.3125rem'}}>تضم {logic.allFiltered.length} بند أعمال</div>
          </div>
        }
        actions={sidebarActions}
        customFilters={
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <SmartCombo 
                    label="تصفية سريعة بالمشروع"
                    icon="🏢"
                    table="projects"
                    displayCol="Property"
                    placeholder="ابحث عن مشروع..."
                    enableClear={true}
                    onSelect={(item:any) => logic.setGlobalSearch(item?.Property || '')}
                />
            </div>
        }
        onSearch={logic.setGlobalSearch}
        watchDeps={[logic.selectedIds, logic.allFiltered.length, groupedProjects.length]}
      />

      <style>{`
        .boq-table-scroller {
            width: 100%;
            overflow-x: auto !important; 
            border-radius: var(--phi-radius-card, 18px);
            background: var(--surface-card, #ffffff);
            box-shadow: var(--shadow-ambient);
            border: none;
            display: flex;
            flex-direction: column;
            cursor: grab;
        }
        
        .boq-table-scroller.is-dragging {
            cursor: grabbing !important;
            user-select: none !important;
        }
        .boq-table-scroller.is-dragging * {
            user-select: none !important;
        }

        .boq-table-scroller table {
            width: max-content !important;
            min-width: 100% !important;
            border-collapse: separate !important;
            border-spacing: 0 !important;
        }

        .boq-table-scroller th {
            padding: 0.9375rem 0.625rem !important;
            font-size: var(--fs-xs) !important;
            white-space: nowrap !important;
            font-weight: 900 !important;
            color: var(--text-primary, #1e293b) !important;
            background: var(--table-head-bg, var(--surface-card, #ffffff)) !important;
            border-bottom: 2px solid #e2e8f0 !important;
            text-align: center;
        }

        .boq-table-scroller td {
            border-bottom: 1px solid #f1f5f9 !important;
        }

        .sticky-col-1 { position: sticky !important; right: 0px !important; z-index: 10; background: inherit; min-width: 2.5rem; }
        .sticky-col-2 { position: sticky !important; right: 2.5rem !important; z-index: 10; background: inherit; min-width: 11.25rem; }
        .sticky-col-3 { position: sticky !important; right: 13.75rem !important; z-index: 10; background: inherit; min-width: 12.5rem; }
        th.sticky-col-1, th.sticky-col-2, th.sticky-col-3 { background: var(--table-head-bg, var(--surface-card, #ffffff)) !important; z-index: 11; }

        .master-row { background: var(--surface-card, #ffffff) !important; cursor: pointer; transition: 0.2s; }
        .master-row:hover { background: var(--table-hover-bg, rgba(0,0,0,0.02)) !important; }
        .master-row td { border-bottom: 1px solid var(--table-zebra-bg, rgba(0,0,0,0.06)) !important; }

        .child-row { background: var(--table-zebra-bg, rgba(0,0,0,0.015)) !important; transition: 0.2s; }
        .child-row:hover { background: var(--table-hover-bg, rgba(0,0,0,0.03)) !important; }

        .row-edit-btn { background: rgba(255,255,255,0.8); border: 1px solid rgba(0,0,0,0.1); border-radius: 4px; padding: 2px 0.25rem; cursor: pointer; font-size: var(--fs-xs); transition: 0.2s; margin-right: 0.5rem; }
        .row-edit-btn:hover { background: #cbd5e1; transform: scale(1.1); }
        .custom-checkbox { width: 0.875rem; height: 0.875rem; accent-color: ${THEME.goldAccent}; cursor: pointer; }
        
        .cinematic-scroll::-webkit-scrollbar { height: 0.5rem; }
        .cinematic-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .cinematic-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .cinematic-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        .btn-main-glass { width: 100%; padding: 0.875rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(15px); font-weight: 900; cursor: pointer; transition: 0.2s; font-size: var(--fs-sm); display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .btn-main-glass.gold { background: linear-gradient(135deg, rgba(194,65,12, 0.9), rgba(194,65,12, 1)); color: white; }
        .btn-main-glass.white { background: rgba(255, 255, 255, 0.6); color: #1e293b; border: 1px solid rgba(255,255,255,0.8); }
        .btn-main-glass.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
        .btn-main-glass:hover { transform: translateY(-3px); filter: brightness(1.1); }

        .type-badge {
            background: rgba(15, 23, 42, 0.06);
            color: #475569;
            padding: 2px 0.375rem;
            border-radius: 4px;
            font-size: var(--fs-xs);
            margin-right: 0.5rem;
            font-weight: 800;
            border: 1px solid rgba(15, 23, 42, 0.1);
        }

        .status-dropdown {
            padding: 0.25rem 0.5rem;
            border-radius: 6px;
            font-size: var(--fs-xs);
            font-weight: 900;
            cursor: pointer;
            border: 1px solid transparent;
            outline: none;
            transition: all 0.2s ease;
        }
        .status-dropdown:hover {
            filter: brightness(0.95);
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            border-color: rgba(0,0,0,0.1);
        }
        .status-dropdown:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
      `}</style>

      {(logic.isLoading && logic.allFiltered.length === 0) ? (
        <LoadingScreen message="جاري تحميل المقايسات..." fullScreen={false} />
      ) : (
        <div 
            className="boq-table-scroller cinematic-scroll"
            ref={scrollerRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onClickCapture={handleClickCapture} 
        >
          <table>
            <thead>
              <tr>
                <th className="sticky-col-1">#</th>
                <th className="sticky-col-2">المشروع / الفيلا</th>
                <th className="sticky-col-3">وصف البند</th>
                
                <th style={{minWidth:'6.875rem', background:'#475569'}}>حالة التنفيذ</th>
                <th style={{minWidth:'5rem'}}>الوحدة</th>
                
                <th style={{minWidth:'6.25rem', background:'#312e81'}}>كمية عقدية</th>
                <th style={{minWidth:'7.5rem', background:'#312e81'}}>سعر الوحدة</th>
                <th style={{minWidth:'8.75rem', background:'#312e81'}}>إجمالي العقد</th>
                
                <th style={{minWidth:'7.5rem', background:'#78350f'}}>خامات (ت)</th>
                <th style={{minWidth:'7.5rem', background:'#78350f'}}>عمالة (ت)</th>
                <th style={{minWidth:'7.5rem', background:'#78350f'}}>مصروف (ت)</th> 

                <th style={{minWidth:'6.25rem', background: 'inherit'}}>منفذ فعلي</th>
                <th style={{minWidth:'5rem', background: 'inherit'}}>إنجاز %</th>
                <th style={{minWidth:'7.5rem', background: 'inherit'}}>خامات (ف)</th>
                <th style={{minWidth:'7.5rem', background: 'inherit'}}>عمالة (ف)</th>
                <th style={{minWidth:'7.5rem', background: 'inherit'}}>مصروف (ف)</th> 
                <th style={{minWidth:'8.75rem', background: 'inherit'}}>إيراد فعلي</th>

                <th style={{minWidth:'7.5rem'}}>± خامات</th>
                <th style={{minWidth:'7.5rem'}}>± عمالة</th>
                <th style={{minWidth:'7.5rem'}}>± الإجمالي</th>
                <th style={{minWidth:'8.75rem', background: 'inherit'}}>الربح الصافي</th>
              </tr>
            </thead>
            <tbody>
                {paginatedGroups.length === 0 ? (
                    <tr><td colSpan={21} style={{textAlign:'center', padding:'1.875rem', fontWeight:900, color:'#94a3b8'}}>لا توجد بيانات مطابقة</td></tr>
                ) : (
                    paginatedGroups.map((group, idx) => {
                        const isExpanded = expandedProjects.includes(group.projectName);
                        return (
                            <React.Fragment key={idx}>
                                <tr className="master-row" onClick={() => toggleProject(group.projectName)}>
                                    <td className="sticky-col-1" style={{textAlign:'center'}}>{isExpanded ? '▼' : '▶'}</td>
                                    
                                    <td className="sticky-col-2" style={{fontWeight:900, color:THEME.primary, fontSize:'var(--fs-md)', display: 'flex', alignItems: 'center'}}>
                                        {group.projectName}
                                        {group.projectType && <span className="type-badge">{group.projectType}</span>}
                                    </td>
                                    
                                    <td className="sticky-col-3" style={{color:'#64748b', fontSize:'var(--fs-xs)'}}>يحتوي على {group.items.length} بنود أعمال</td>
                                    
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    
                                    <td style={{textAlign:'left', color:'#4338ca', fontSize:'var(--fs-xs)', paddingRight:'0.625rem'}}>إجمالي التعاقد ⬅</td>
                                    <td style={{fontWeight:900, color:'#4338ca', textAlign:'center', fontSize:'var(--fs-md)', background: 'transparent'}}>{formatCurrency(group.total_contract)}</td>
                                    
                                    <td style={{fontWeight:800, color:'#b45309', textAlign:'center'}}>{formatCurrency(group.est_material)}</td>
                                    <td style={{fontWeight:800, color:'#b45309', textAlign:'center'}}>{formatCurrency(group.est_labor)}</td>
                                    <td style={{fontWeight:800, color:'#b45309', textAlign:'center'}}>{formatCurrency(group.est_exp)}</td>

                                    <td></td>
                                    <td></td>

                                    <td style={{fontWeight:800, color:'#047857', textAlign:'center'}}>{formatCurrency(group.act_material)}</td>
                                    <td style={{fontWeight:800, color:'#047857', textAlign:'center'}}>{formatCurrency(group.act_labor)}</td>
                                    <td style={{fontWeight:800, color:'#047857', textAlign:'center'}}>{formatCurrency(group.act_exp)}</td>
                                    <td style={{fontWeight:900, color:'#047857', textAlign:'center', background: 'transparent'}}>{formatCurrency(group.act_rev)}</td>

                                    <td style={{fontWeight:800, color: group.var_material >= 0 ? '#10b981':'#ef4444', textAlign:'center'}}>{formatCurrency(group.var_material)}</td>
                                    <td style={{fontWeight:800, color: group.var_labor >= 0 ? '#10b981':'#ef4444', textAlign:'center'}}>{formatCurrency(group.var_labor)}</td>
                                    <td style={{fontWeight:900, color: group.var_total >= 0 ? '#10b981':'#ef4444', textAlign:'center'}}>{formatCurrency(group.var_total)}</td>

                                    <td style={{fontWeight:900, color: group.net_profit >= 0 ? '#10b981' : '#ef4444', textAlign:'center', fontSize:'var(--fs-md)', background: group.net_profit >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}}>
                                        {formatCurrency(group.net_profit)}
                                    </td>
                                </tr>

                                {isExpanded && group.items.map((item: any, iIdx: number) => {
                                    const isSelected = logic.selectedIds.includes(String(item.id));
                                    const p = Number(item.item_net_profit || 0);
                                    return (
                                        <tr key={item.id || iIdx} className="child-row">
                                            <td className="sticky-col-1" style={{textAlign:'center'}}>
                                                <input type="checkbox" className="custom-checkbox" checked={isSelected} 
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        if (isSelected) logic.setSelectedIds(logic.selectedIds.filter((i:any) => i !== String(item.id))); 
                                                        else logic.setSelectedIds([...logic.selectedIds, String(item.id)]); 
                                                    }} 
                                                />
                                            </td>
                                            <td className="sticky-col-2" style={{color:'#94a3b8', fontSize:'var(--fs-xs)', paddingRight:'1.25rem'}}>↳ تابع للمشروع</td>
                                            
                                            <td className="sticky-col-3">
                                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                                    <span style={{fontWeight:800, color:'#334155'}}>{item.work_item}</span>
                                                    <button onClick={(e) => { e.stopPropagation(); logic.handleEdit(item); }} className="row-edit-btn" title="تعديل"><Pencil size={16} aria-hidden="true" /></button>
                                                </div>
                                            </td>

                                            <td style={{textAlign:'center'}}>
                                                <select 
                                                    className="status-dropdown"
                                                    value={item.execution_status || 'لم يتم البدئ'}
                                                    onClick={(e) => e.stopPropagation()} 
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        logic.handleSave({ ...item, execution_status: e.target.value });
                                                    }}
                                                    disabled={logic.isSaving}
                                                    style={{
                                                        backgroundColor: 
                                                            item.execution_status === 'انتهى' ? 'rgba(16, 185, 129, 0.15)' :
                                                            item.execution_status === 'قيد التسليم' ? 'rgba(245, 158, 11, 0.15)' :
                                                            item.execution_status === 'تحت التنفيذ' ? 'rgba(59, 130, 246, 0.15)' : 
                                                            'rgba(100, 116, 139, 0.1)',
                                                        color: 
                                                            item.execution_status === 'انتهى' ? '#047857' :
                                                            item.execution_status === 'قيد التسليم' ? '#b45309' :
                                                            item.execution_status === 'تحت التنفيذ' ? '#1d4ed8' : 
                                                            '#475569'
                                                    }}
                                                >
                                                    <option value="لم يتم البدئ">لم يتم البدئ</option>
                                                    <option value="تحت التنفيذ">تحت التنفيذ</option>
                                                    <option value="قيد التسليم">قيد التسليم</option>
                                                    <option value="انتهى">انتهى</option>
                                                </select>
                                            </td>
                                            
                                            <td style={{textAlign:'center', color:'#64748b', fontSize:'var(--fs-sm)', fontWeight:800}}>{item.unit}</td>
                                            
                                            <td style={{textAlign:'center', color:'#4f46e5', fontWeight:800}}>{Number(item.contract_quantity || 0).toLocaleString()}</td>
                                            <td style={{textAlign:'center', color:'#4f46e5', fontWeight:800}}>{formatCurrency(item.unit_contract_price)}</td>
                                            <td style={{textAlign:'center', color:'#4338ca', fontWeight:900, background:'rgba(79,70,229,0.05)'}}>{formatCurrency(item.total_contract_amount)}</td>

                                            <td style={{textAlign:'center', color:'#b45309', fontWeight:700}}>{formatCurrency(item.estimated_material_cost)}</td>
                                            <td style={{textAlign:'center', color:'#b45309', fontWeight:700}}>{formatCurrency(item.estimated_labor_cost)}</td>
                                            <td style={{textAlign:'center', color:'#b45309', fontWeight:700}}>{formatCurrency(item.estimated_expenses_cost)}</td>

                                            <td style={{textAlign:'center', color:'#047857', fontWeight:900}}><span style={{background:'#f1f5f9', padding:'2px 0.5rem', borderRadius:'6px'}}>{Number(item.actual_quantity || 0).toLocaleString()}</span></td>
                                            <td style={{textAlign:'center', fontWeight:900, fontSize:'var(--fs-xs)'}}>{Number(item.completed_percentage || 0).toFixed(0)}%</td>
                                            
                                            <td style={{textAlign:'center', color:'#059669', fontWeight:700}}>{formatCurrency(item.actual_material_cost)}</td>
                                            <td style={{textAlign:'center', color:'#059669', fontWeight:700}}>{formatCurrency(item.actual_labor_cost)}</td>
                                            <td style={{textAlign:'center', color:'#059669', fontWeight:700}}>{formatCurrency(item.actual_expenses_cost)}</td>
                                            <td style={{textAlign:'center', color:'#15803d', fontWeight:900, background: 'transparent'}}>{formatCurrency(item.actual_revenue)}</td>

                                            <td style={{textAlign:'center', fontWeight:800, color: Number(item.material_variance||0) >= 0 ? '#10b981':'#ef4444'}}>{formatCurrency(item.material_variance)}</td>
                                            <td style={{textAlign:'center', fontWeight:800, color: Number(item.labor_variance||0) >= 0 ? '#10b981':'#ef4444'}}>{formatCurrency(item.labor_variance)}</td>
                                            <td style={{textAlign:'center', fontWeight:900, color: Number(item.total_budget_variance||0) >= 0 ? '#10b981':'#ef4444'}}>{formatCurrency(item.total_budget_variance)}</td>

                                            <td style={{textAlign:'center', fontWeight:900, color: p >= 0 ? '#10b981' : '#ef4444', background: 'transparent'}}>
                                                {formatCurrency(p)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })
                )}
            </tbody>
          </table>

          {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9375rem 1.25rem', background: 'var(--surface-card, #ffffff)', borderTop: 'none', position: 'sticky', left: 0 }}>
                  <button 
                      onClick={() => logic.setCurrentPage((p:number) => p - 1)} disabled={logic.currentPage === 1}
                      style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-elevation)', fontWeight: 900, cursor: logic.currentPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                      ◀ السابق
                  </button>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: '#475569' }}>
                      صفحة {logic.currentPage} من {totalPages}
                  </span>
                  <button 
                      onClick={() => logic.setCurrentPage((p:number) => p + 1)} disabled={logic.currentPage === totalPages}
                      style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: 'var(--surface-sunken, #f8fafc)', boxShadow: 'var(--shadow-elevation)', fontWeight: 900, cursor: logic.currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                  >
                      التالي ▶
                  </button>
              </div>
          )}
        </div>
      )}

      {mounted && logic.isEditModalOpen && (
          <BOQModal 
            isOpen={logic.isEditModalOpen} 
            onClose={() => logic.setIsEditModalOpen(false)} 
            record={logic.currentRecord} 
            setRecord={logic.setCurrentRecord} 
            onSave={logic.handleSave} 
            isSaving={logic.isSaving}
            projects={logic.projects} 
          />
      )}
    </MasterPage>
  );
}