"use client";
import React, { useMemo, useState, useEffect } from 'react';
import { useHierarchicalAccountsLogic } from './accounts_logic';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import { usePermissions } from '@/lib/PermissionsContext'; 
import SecureAction from '@/components/SecureAction'; 
import LoadingScreen from '@/components/LoadingScreen';
import { FolderOpen, Folder, FileText } from 'lucide-react';

export default function HierarchicalLedgerPage() {
  const { 
    paginatedTree, totalPages, currentPage, setCurrentPage,
    isLoading, isDeleting, searchTerm, setSearchTerm, expandedIds, toggleExpand, expandAll, collapseAll, 
    selectedIds, toggleSelection, handleDelete, handleAdd, handleEdit,
    startDate, setStartDate, endDate, setEndDate,
    exportToExcel // 🚀 جلب دالة تصدير الإكسل من اللوجيك
  } = useHierarchicalAccountsLogic();

  const [mounted, setMounted] = useState(false);
  const { can, loading: permsLoading } = usePermissions();

  useEffect(() => { setMounted(true); }, []);

  // 🚀 اختصار إضافة جديد (Alt + N)
  useEffect(() => {
    const handleAddShortcut = (e: KeyboardEvent) => {
      if (e.altKey && (e.code === 'KeyN' || e.key.toLowerCase() === 'n' || e.key === 'ى')) {
        e.preventDefault();
        handleAdd();
      }
    };
    window.addEventListener('keydown', handleAddShortcut);
    return () => window.removeEventListener('keydown', handleAddShortcut);
  }, [handleAdd]);


  // 🧮 السامري المحاسبي الدقيق (ميزان المراجعة) محمي ضد الكسور العائمة
  const summary = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;

    paginatedTree.forEach((node: any) => {
      totalDebit += Number(node.totalDebit) || 0;
      totalCredit += Number(node.totalCredit) || 0;
    });

    // 🚀 تطبيق الحماية هنا: تقريب لأقرب رقمين عشريين لمنع أي كسور لانهائية
    const roundedDebit = Math.round(totalDebit * 100) / 100;
    const roundedCredit = Math.round(totalCredit * 100) / 100;
    const roundedBalance = Math.round(Math.abs(roundedDebit - roundedCredit) * 100) / 100;

    return {
      debit: roundedDebit,
      credit: roundedCredit,
      balance: roundedBalance,
      isDebitBalance: roundedDebit >= roundedCredit
    };
  }, [paginatedTree]);

  // 🚀 تجهيز أزرار السايد بار (وإضافة زر الإكسل)
  const sidebarActions = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <SecureAction module="accounts" action="create">
        <button className="btn-premium-gold" onClick={handleAdd}>
            إضافة حساب جديد
        </button>
      </SecureAction>
      
      {selectedIds.length > 0 && (
        <>
          <p style={{fontSize:'var(--fs-xs)', textAlign:'center', color:'#94a3b8', fontWeight:900, marginBottom:'-5px'}}>إجراءات على ({selectedIds.length})</p>
          <SecureAction module="accounts" action="edit">
            <button className="btn-main-glass blue" onClick={() => handleEdit(selectedIds)} disabled={selectedIds.length !== 1 || isDeleting}>تعديل الحساب</button>
          </SecureAction>
          <SecureAction module="accounts" action="delete">
            <button className="btn-main-glass red" onClick={() => handleDelete(selectedIds)} disabled={isDeleting}>
              {isDeleting ? 'جاري الحذف...' : 'حذف الحساب'}
            </button>
          </SecureAction>
        </>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
         <button className="btn-main-glass white" style={{flex: 1}} onClick={expandAll}>فتح الكل</button>
         <button className="btn-main-glass white" style={{flex: 1}} onClick={collapseAll}>طي الكل</button>
      </div>

      {/* 📊 زر الإكسل الاحترافي */}
      <button 
        className="btn-main-glass" 
        onClick={exportToExcel}
        style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 10px 20px rgba(16, 185, 129, 0.3)' }}
      >
        تصدير إكسل
      </button>

      {/* 🖨️ زر الطباعة الاحترافي المطور */}
      <button className="btn-main-glass white" onClick={() => {
          const printWindow = window.open('', '_blank');
          if(printWindow) {
              // دالة تكرارية لرسم الشجرة في الطباعة
              const generatePrintRows = (nodes: any[], depth = 0): string => {
                  return nodes.map(n => {
                      const indent = depth * 20;
                      const isRoot = depth === 0;
                      let rowHtml = `
                          <tr style="${isRoot ? 'background: #f8fafc; font-weight: bold;' : ''}">
                              <td>${n.code || ''}</td>
                              <td style="padding-right: ${indent + 10}px;">${isRoot ? '' : ''} ${n.name}</td>
                              <td class="text-center text-success">${formatCurrency(n.totalDebit)}</td>
                              <td class="text-center text-danger">${formatCurrency(n.totalCredit)}</td>
                              <td class="text-center" style="font-weight: bold;">${formatCurrency(n.balance)}</td>
                          </tr>
                      `;
                      if (n.children && n.children.length > 0) {
                          rowHtml += generatePrintRows(n.children, depth + 1);
                      }
                      return rowHtml;
                  }).join('');
              };

              printWindow.document.write(`
                  <html dir="rtl">
                  <head>
                      <title>ميزان المراجعة</title>
                      <style>
                          body { font-family: 'Arial', sans-serif; padding: 20px; direction: rtl; }
                          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                          th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
                          th { background-color: #f1f5f9; color: #1e293b; font-weight: bold; }
                          .text-center { text-align: center; }
                          .text-success { color: #16a34a; }
                          .text-danger { color: #dc2626; }
                      </style>
                  </head>
                  <body>
                      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ddd; padding-bottom: 15px;">
                          <h2>ميزان المراجعة الشجري</h2>
                          <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</p>
                          ${startDate ? `<p>من: ${startDate} | إلى: ${endDate}</p>` : ''}
                      </div>
                      <table>
                          <thead>
                              <tr>
                                  <th style="width: 15%;">كود الحساب</th>
                                  <th style="width: 40%;">اسم الحساب</th>
                                  <th class="text-center">إجمالي مدين</th>
                                  <th class="text-center">إجمالي دائن</th>
                                  <th class="text-center">الرصيد</th>
                              </tr>
                          </thead>
                          <tbody>
                              ${generatePrintRows(paginatedTree)}
                          </tbody>
                      </table>
                  </body>
                  </html>
              `);
              printWindow.document.close();
              setTimeout(() => { printWindow.print(); }, 250); // تأخير بسيط لضمان تحميل الـ CSS
          }
      }}>طباعة الميزان</button>
    </div>
  );

  return (
    <MasterPage title="شجرة الحسابات والميزان" subtitle="إدارة المركز المالي ودليل الحسابات - فاي تك">
      
      <div className="floating-stack-layout">
        <div className="warm-depth-glow" />

        <div className="content-container">
          <RawasiSidebarManager 
            summary={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="summary-glass-card">
                      <span style={{fontSize:'var(--fs-sm)', fontWeight:800, color:'#64748b'}}>إجمالي المدين</span>
                      <div style={{fontSize:'var(--fs-xl)', fontWeight:900, color: THEME.success}}>{formatCurrency(summary.debit)}</div>
                  </div>
                  <div className="summary-glass-card">
                      <span style={{fontSize:'var(--fs-sm)', fontWeight:800, color:'#64748b'}}>إجمالي الدائن</span>
                      <div style={{fontSize:'var(--fs-xl)', fontWeight:900, color: THEME.danger}}>{formatCurrency(summary.credit)}</div>
                  </div>
                  <div className="summary-glass-card" style={{ background: summary.balance === 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', borderColor: summary.balance === 0 ? THEME.success : THEME.warning }}>
                      <span style={{fontSize:'var(--fs-sm)', fontWeight:800, color: summary.balance === 0 ? THEME.success : THEME.warning}}>الرصيد / الفارق</span>
                      <div style={{fontSize:'var(--fs-2xl)', fontWeight:900, color: THEME.coffeeDark}}>
                        {formatCurrency(summary.balance)}
                      </div>
                      <div style={{fontSize:'var(--fs-xs)', marginTop: '4px', color: '#94a3b8'}}>{summary.balance !== 0 && (summary.isDebitBalance ? '(رصيد مدين)' : '(رصيد دائن)')}</div>
                  </div>
              </div>
            }
            actions={sidebarActions}
            customFilters={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
                  <div>
                     <label style={{color: 'white', fontSize: 'var(--fs-sm)', fontWeight: 900, display: 'block', marginBottom: '8px'}}>بحث في الدليل:</label>
                     <input type="text" placeholder="الاسم، الكود..." className="glass-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>

                  <div>
                      <label style={{color: 'white', fontSize: 'var(--fs-sm)', fontWeight: 900, display: 'block', marginBottom: '8px'}}>من تاريخ:</label>
                      <input type="date" className="glass-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div>
                      <label style={{color: 'white', fontSize: 'var(--fs-sm)', fontWeight: 900, display: 'block', marginBottom: '8px'}}>إلى تاريخ:</label>
                      <input type="date" className="glass-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
              </div>
            }
            watchDeps={[selectedIds, summary.balance, searchTerm, startDate, endDate]}
          />

          <div className="glass-master-card no-print">
            <div className="card-header">
              <h4 style={{ margin: 0, fontWeight: 900, color: THEME.primary }}>الدليل المحاسبي وميزان المراجعة</h4>
            </div>

            <div className="table-inner-scroll cinematic-scroll" style={{ padding: '20px' }}>
              
              <div className="table-header">
                 <div></div>
                 <div>اسم الحساب / الكود</div>
                 <div>التصنيف</div>
                 <div style={{textAlign: 'center'}}>إجمالي مدين</div>
                 <div style={{textAlign: 'center'}}>إجمالي دائن</div>
                 <div style={{textAlign: 'center'}}>الرصيد النهائي</div>
              </div>

              {(isLoading || permsLoading) ? (
                <LoadingScreen message="جاري معالجة البيانات المالية وبناء الشجرة..." fullScreen={false} />
              ) : (
                paginatedTree.map((node: any) => (
                  <AccountNode 
                    key={node.id} node={node} expandedIds={expandedIds} toggleExpand={toggleExpand} 
                    selectedIds={selectedIds} toggleSelection={toggleSelection} depth={1} 
                  />
                ))
              )}

            </div>
          </div>
        </div>
      </div>

      <style>{`
        .floating-stack-layout { position: relative; width: 100%; padding: 0 20px 20px 20px; z-index: 5; direction: rtl; }
        .warm-depth-glow { position: absolute; inset: 0; background: radial-gradient(circle at 20% 30%, rgba(194,65,12, 0.15) 0%, transparent 70%); z-index: -1; pointer-events: none; }
        .content-container { max-width: 1600px; margin: 0 auto; }

        .glass-master-card {
          background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
          border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.08); overflow: hidden;
          margin-top: 25px; animation: cardFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .card-header { padding: 25px 35px; background: rgba(255, 255, 255, 0.3); border-bottom: 1px solid rgba(0,0,0,0.03); }

        .summary-glass-card { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 15px; border-radius: 16px; text-align: center; transition: 0.3s; }
        .glass-input { width: 100%; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white; font-weight: 800; outline: none; transition: 0.3s; color-scheme: dark;}
        .glass-input:focus { background: rgba(255,255,255,0.2); border-color: ${THEME.goldAccent}; }

        .btn-premium-gold { width: 100%; padding: 16px; border-radius: 16px; background: linear-gradient(135deg, #c2410c, #c2410c); color: white; font-weight: 900; border: none; cursor: pointer; box-shadow: 0 10px 25px rgba(194,65,12, 0.3); transition: 0.3s; }
        .btn-premium-gold:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(194,65,12, 0.4); filter: brightness(1.1); }

        .btn-main-glass { width: 100%; padding: 12px; border-radius: 12px; border: none; font-weight: 900; cursor: pointer; transition: 0.3s; font-size: var(--fs-sm); }
        .btn-main-glass.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); }
        .btn-main-glass.blue:hover:not(:disabled) { background: #3b82f6; color: white; }
        .btn-main-glass.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
        .btn-main-glass.red:hover:not(:disabled) { background: #ef4444; color: white; }
        .btn-main-glass.white { background: rgba(255, 255, 255, 0.1); color: white; border: 1px solid rgba(255, 255, 255, 0.2); }
        .btn-main-glass.white:hover:not(:disabled) { background: white; color: #1e293b; }
        .btn-main-glass:disabled { opacity: 0.5; cursor: not-allowed; }

        .table-header {
          display: grid; grid-template-columns: 40px 2.5fr 1fr 1fr 1fr 1.2fr; 
          padding: 15px 20px; font-weight: 900; color: #64748b; font-size: var(--fs-sm);
          background: rgba(0,0,0,0.02); border-radius: 16px; margin-bottom: 15px; border: 1px solid #f1f5f9;
        }

        .acc-row { 
          border-radius: 16px; margin-bottom: 8px; 
          display: grid; grid-template-columns: 40px 2.5fr 1fr 1fr 1fr 1.2fr; 
          align-items: center; padding: 15px 20px; cursor: pointer; 
          border: 1px solid #f1f5f9; transition: 0.2s; box-shadow: 0 2px 10px rgba(0,0,0,0.01);
        }
        .acc-row.root-node {
          background: rgba(15, 23, 42, 0.03); 
          border: 1px solid rgba(15, 23, 42, 0.1);
        }
        .acc-row.child-node {
          background: white;
        }

        .acc-row:hover { border-color: ${THEME.goldAccent}; transform: translateY(-1px); box-shadow: 0 5px 15px rgba(194,65,12, 0.1); }
        .acc-row.selected { background: rgba(194,65,12, 0.05); border-color: ${THEME.goldAccent}; }

        .entry-line { 
          background: #f8fafc; margin: 4px 20px 8px 60px; padding: 12px 20px; 
          border-radius: 12px; border-right: 3px solid ${THEME.goldAccent}; display: grid; 
          grid-template-columns: 120px 2fr 120px 120px; gap: 15px; font-size: var(--fs-sm);
          border: 1px solid #f1f5f9;
        }

        .custom-checkbox { width: 18px; height: 18px; accent-color: ${THEME.goldAccent}; cursor: pointer; }
        .cinematic-scroll::-webkit-scrollbar { width: 6px; }
        .cinematic-scroll::-webkit-scrollbar-track { background: transparent; }
        .cinematic-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }

        @keyframes cardFadeUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </MasterPage>
  );
}

// 📌 مكون الصفوف الفرعية للشجرة
function AccountNode({ node, expandedIds, toggleExpand, selectedIds, toggleSelection, depth }: any) {
  const isExpanded = expandedIds.includes(node.id);
  const isSelected = selectedIds.includes(node.id);
  const hasSub = (node.children?.length > 0) || (node.transactions?.length > 0);
  
  const isRoot = depth === 1;

  return (
    <div style={{ marginRight: `${(depth - 1) * 30}px` }}>
      <div 
        className={`acc-row ${isRoot ? 'root-node' : 'child-node'} ${isSelected ? 'selected' : ''}`}
        onClick={() => hasSub && toggleExpand(node.id)} 
        style={{ borderRight: `${isRoot ? '5px' : '2px'} solid ${isRoot ? THEME.primary : THEME.goldAccent}` }} 
      >
        <input 
          type="checkbox" className="custom-checkbox" checked={isSelected} 
          onChange={() => toggleSelection(node.id)} onClick={e=>e.stopPropagation()} 
        />
        <div>
          <span style={{ fontWeight: isRoot ? 900 : 700, fontSize: isRoot ? '16px' : '14px', color: THEME.primary }}>
            {hasSub ? (isExpanded ? <FolderOpen size={16} aria-hidden="true" /> : <Folder size={16} aria-hidden="true" />) : <FileText size={16} aria-hidden="true" />}
            {node.name}
          </span>
          <span style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', marginRight: '10px' }}>#{node.code}</span>
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: node.is_transactional ? '#64748b' : THEME.goldAccent, fontWeight: 800 }}>
          {node.is_transactional ? 'حساب فرعي' : 'تجميعي'}
        </div>
        <div style={{ textAlign: 'center', color: THEME.success, fontWeight: isRoot ? 900 : 700, fontFamily: 'monospace', fontSize: 'var(--fs-md)' }}>
          {formatCurrency(node.totalDebit)}
        </div>
        <div style={{ textAlign: 'center', color: THEME.danger, fontWeight: isRoot ? 900 : 700, fontFamily: 'monospace', fontSize: 'var(--fs-md)' }}>
          {formatCurrency(node.totalCredit)}
        </div>
        <div style={{ textAlign: 'center', fontWeight: 900, color: isRoot ? 'white' : THEME.primary, fontFamily: 'monospace', fontSize: 'var(--fs-md)', background: isRoot ? THEME.primary : '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
          {formatCurrency(node.balance)}
        </div>
      </div>

      {isExpanded && (
        <div style={{ marginTop: '5px', marginBottom: '15px' }}>
          {node.children?.map((child: any) => (
            <AccountNode key={child.id} node={child} expandedIds={expandedIds} toggleExpand={toggleExpand} selectedIds={selectedIds} toggleSelection={toggleSelection} depth={depth + 1} />
          ))}
          {/* 🚀 عرض القيود تحت الحسابات الفرعية */}
          {node.transactions?.map((t: any, idx: number) => (
            <div key={idx} className="entry-line">
              <div style={{ fontWeight: 800, color: THEME.goldAccent }}>{t.date}</div>
              <div style={{ color: THEME.primary, fontWeight: 700 }}>{t.notes || t.description || 'بدون بيان'}</div>
              <div style={{ textAlign: 'center', color: THEME.success, fontWeight: 800, fontFamily: 'monospace' }}>{t.debit ? formatCurrency(t.debit) : '-'}</div>
              <div style={{ textAlign: 'center', color: THEME.danger, fontWeight: 800, fontFamily: 'monospace' }}>{t.credit ? formatCurrency(t.credit) : '-'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
