"use client";
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useHierarchicalAccountsLogic } from './accounts_logic';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import { usePermissions } from '@/lib/PermissionsContext'; 
import SecureAction from '@/components/SecureAction'; 
import LoadingScreen from '@/components/LoadingScreen';
import { FolderOpen, Folder, FileText, Lock, Unlock, RefreshCw, X, Sparkles } from 'lucide-react';

export default function HierarchicalLedgerPage() {
  const { 
    paginatedTree, totalPages, currentPage, setCurrentPage,
    isLoading, isDeleting, searchTerm, setSearchTerm, expandedIds, toggleExpand, expandAll, collapseAll, 
    selectedIds, toggleSelection, handleDelete, handleAdd, handleEdit,
    startDate, setStartDate, endDate, setEndDate,
    exportToExcel,
    isModalOpen, setIsModalOpen, openAddModal, openEditModal, closeModal,
    formData, setFormData, isCodeAuto, setIsCodeAuto, isSaving, parentAccounts,
    handleParentChange, handleAccountTypeChange, regenerateCode, handleSaveAccount, editingId
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9375rem' }}>
      <SecureAction module="accounts" action="create">
        <button className="btn-premium-gold" onClick={handleAdd}>
            إضافة حساب جديد
        </button>
      </SecureAction>
      
      {selectedIds.length > 0 && (
        <>
          <p style={{fontSize:'var(--fs-xs)', textAlign:'center', color:'#94a3b8', fontWeight:900, marginBottom:'-0.3125rem'}}>إجراءات على ({selectedIds.length})</p>
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

      <div style={{ display: 'flex', gap: '0.625rem' }}>
         <button className="btn-main-glass white" style={{flex: 1}} onClick={expandAll}>فتح الكل</button>
         <button className="btn-main-glass white" style={{flex: 1}} onClick={collapseAll}>طي الكل</button>
      </div>

      {/* 📊 زر الإكسل الاحترافي */}
      <button 
        className="btn-main-glass" 
        onClick={exportToExcel}
        style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 10px 20px rgba(16, 185, 129, 0.3)' }}
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
                          <p>تاريخ التقرير: ${new Date().toLocaleDateString('en-GB')}</p>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
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
                      <div style={{fontSize:'var(--fs-xs)', marginTop: '0.25rem', color: '#94a3b8'}}>{summary.balance !== 0 && (summary.isDebitBalance ? '(رصيد مدين)' : '(رصيد دائن)')}</div>
                  </div>
              </div>
            }
            actions={sidebarActions}
            customFilters={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.625rem' }}>
                  <div>
                     <label style={{color: 'white', fontSize: 'var(--fs-sm)', fontWeight: 900, display: 'block', marginBottom: '0.5rem'}}>بحث في الدليل:</label>
                     <input type="text" placeholder="الاسم، الكود..." className="glass-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>

                  <div>
                      <label style={{color: 'white', fontSize: 'var(--fs-sm)', fontWeight: 900, display: 'block', marginBottom: '0.5rem'}}>من تاريخ:</label>
                      <input type="date" className="glass-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div>
                      <label style={{color: 'white', fontSize: 'var(--fs-sm)', fontWeight: 900, display: 'block', marginBottom: '0.5rem'}}>إلى تاريخ:</label>
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

            <div className="table-inner-scroll cinematic-scroll" style={{ padding: '1.25rem' }}>
              
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
        .floating-stack-layout { position: relative; width: 100%; padding: 0 1.25rem 1.25rem 1.25rem; z-index: 5; direction: rtl; }
        .warm-depth-glow { position: absolute; inset: 0; background: radial-gradient(circle at 20% 30%, rgba(194,65,12, 0.15) 0%, transparent 70%); z-index: -1; pointer-events: none; }
        .content-container { max-width: 100rem; margin: 0 auto; }

        .glass-master-card {
          background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
          border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.08); overflow: hidden;
          margin-top: 1.5625rem; animation: cardFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .card-header { padding: 1.5625rem 2.1875rem; background: rgba(255, 255, 255, 0.3); border-bottom: 1px solid rgba(0,0,0,0.03); }

        .summary-glass-card { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 0.9375rem; border-radius: 16px; text-align: center; transition: 0.3s; }
        .glass-input { width: 100%; padding: 0.75rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white; font-weight: 800; outline: none; transition: 0.3s; color-scheme: dark;}
        .glass-input:focus { background: rgba(255,255,255,0.2); border-color: ${THEME.goldAccent}; }

        .btn-premium-gold { width: 100%; padding: 1rem; border-radius: 16px; background: linear-gradient(135deg, #c2410c, #c2410c); color: white; font-weight: 900; border: none; cursor: pointer; box-shadow: 0 10px 25px rgba(194,65,12, 0.3); transition: 0.3s; }
        .btn-premium-gold:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(194,65,12, 0.4); filter: brightness(1.1); }

        .btn-main-glass { width: 100%; padding: 0.75rem; border-radius: 12px; border: none; font-weight: 900; cursor: pointer; transition: 0.3s; font-size: var(--fs-sm); }
        .btn-main-glass.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); }
        .btn-main-glass.blue:hover:not(:disabled) { background: #3b82f6; color: white; }
        .btn-main-glass.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
        .btn-main-glass.red:hover:not(:disabled) { background: #ef4444; color: white; }
        .btn-main-glass.white { background: rgba(255, 255, 255, 0.1); color: white; border: 1px solid rgba(255, 255, 255, 0.2); }
        .btn-main-glass.white:hover:not(:disabled) { background: white; color: #1e293b; }
        .btn-main-glass:disabled { opacity: 0.5; cursor: not-allowed; }

        .table-header {
          display: grid; grid-template-columns: 2.5rem 2.5fr 1fr 1fr 1fr 1.2fr; 
          padding: 0.9375rem 1.25rem; font-weight: 900; color: #64748b; font-size: var(--fs-sm);
          background: rgba(0,0,0,0.02); border-radius: 16px; margin-bottom: 0.9375rem; border: 1px solid #f1f5f9;
        }

        .acc-row { 
          border-radius: 16px; margin-bottom: 0.5rem; 
          display: grid; grid-template-columns: 2.5rem 2.5fr 1fr 1fr 1fr 1.2fr; 
          align-items: center; padding: 0.9375rem 1.25rem; cursor: pointer; 
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
          background: #f8fafc; margin: 0.25rem 1.25rem 0.5rem 3.75rem; padding: 0.75rem 1.25rem; 
          border-radius: 12px; border-right: 3px solid ${THEME.goldAccent}; display: grid; 
          grid-template-columns: 7.5rem 2fr 7.5rem 7.5rem; gap: 0.9375rem; font-size: var(--fs-sm);
          border: 1px solid #f1f5f9;
        }

        .custom-checkbox { width: 1.125rem; height: 1.125rem; accent-color: ${THEME.goldAccent}; cursor: pointer; }
        .cinematic-scroll::-webkit-scrollbar { width: 0.375rem; }
        .cinematic-scroll::-webkit-scrollbar-track { background: transparent; }
        .cinematic-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }

        @keyframes cardFadeUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* 🚀 نافذة (مودال) إضافة وتعديل الحساب المحاسبي مع التوليد التلقائي الذكي للكود */}
      {isModalOpen && mounted && createPortal(
        <div 
          className="phi-modal-backdrop" 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            zIndex: 9999999, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            background: 'radial-gradient(circle at center, rgba(40, 24, 10, 0.4) 0%, rgba(15, 7, 0, 0.9) 100%)', 
            backdropFilter: 'blur(20px)', 
            direction: 'rtl',
            padding: '1rem'
          }} 
          onClick={closeModal}
        >
          <div 
            className="cinematic-scroll phi-modal-panel" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              width: '46rem', 
              maxWidth: '95vw', 
              maxHeight: '90vh', 
              background: 'var(--surface-card, #ffffff)', 
              borderRadius: '16px', 
              padding: '2.25rem', 
              boxShadow: '0 40px 80px rgba(0,0,0,0.4)', 
              overflowY: 'auto' 
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid var(--accent-soft-bg, #fef3c7)', paddingBottom: '0.9rem' }}>
              <div>
                <h2 style={{ color: 'var(--text-primary, #0f172a)', fontWeight: 900, margin: 0, fontSize: 'var(--fs-2xl)' }}>
                  {editingId ? 'تعديل بيانات الحساب المحاسبي' : 'إضافة حساب جديد في شجرة الحسابات'}
                </h2>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary, #64748b)' }}>
                  {editingId ? 'تعديل مسمى أو تصنيف الحساب مع حماية الكود المالي' : 'توليد تسلسلي ذكي لرقم الحساب حسب المستوى والأصل المالي'}
                </p>
              </div>
              <button 
                type="button" 
                onClick={closeModal}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, #64748b)', padding: '0.5rem', borderRadius: '8px' }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              {/* اسم الحساب */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--text-primary, #0f172a)', display: 'block', marginBottom: '0.375rem' }}>
                  اسم الحساب *
                </label>
                <input 
                  className="glass-input-field" 
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 'var(--fs-md)', fontWeight: 700 }}
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  placeholder="مثال: بنك الإنماء، مورد مواد عزل، مصاريف نقل..." 
                  autoFocus
                />
              </div>

              {/* الحساب الأب */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--text-primary, #0f172a)', display: 'block', marginBottom: '0.375rem' }}>
                  الحساب الرئيسي (الأب)
                </label>
                <select 
                  className="glass-input-field" 
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 'var(--fs-sm)', fontWeight: 700 }}
                  value={formData.parent_id} 
                  onChange={e => handleParentChange(e.target.value)}
                >
                  <option value="">بدون حساب أب (حساب رئيسي جذري)</option>
                  {parentAccounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name} {!acc.is_transactional ? '📁 [تجميعي]' : '📄 [فرعي]'}
                    </option>
                  ))}
                </select>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary, #64748b)' }}>
                  * اختيار الحساب الأب يحدد تلقائياً طبيعة الحساب ويولد الكود الفرعي المتسلسل تحته مباشرة.
                </p>
              </div>

              {/* طبيعة الحساب */}
              <div>
                <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--text-primary, #0f172a)', display: 'block', marginBottom: '0.375rem' }}>
                  طبيعة الحساب (القوائم المالية) *
                </label>
                <select 
                  className="glass-input-field" 
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 'var(--fs-sm)', fontWeight: 700 }}
                  value={formData.account_type} 
                  onChange={e => handleAccountTypeChange(e.target.value)}
                >
                  <option value="أصول">1 - أصول (Assets)</option>
                  <option value="التزامات">2 - التزامات (Liabilities)</option>
                  <option value="حقوق ملكية">3 - حقوق ملكية (Equity)</option>
                  <option value="إيرادات">4 - إيرادات (Revenues)</option>
                  <option value="مصروفات">5 - مصروفات وتكاليف (Expenses)</option>
                </select>
              </div>

              {/* نوع الحساب (حركة أم تجميعي) */}
              <div>
                <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--text-primary, #0f172a)', display: 'block', marginBottom: '0.375rem' }}>
                  نوع الحساب في الدليل *
                </label>
                <select 
                  className="glass-input-field" 
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 'var(--fs-sm)', fontWeight: 700 }}
                  value={formData.is_transactional ? 'true' : 'false'} 
                  onChange={e => setFormData({ ...formData, is_transactional: e.target.value === 'true' })}
                >
                  <option value="true">📄 حساب فرعي (يقبل قيود وحركات مالية)</option>
                  <option value="false">📁 حساب رئيسي (تجميعي للمستويات الأدنى)</option>
                </select>
              </div>

              {/* كود الحساب مع التحكم الذكي */}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 900, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                    رقم الحساب المحاسبي (الكود) *
                  </label>
                  <span 
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                      fontWeight: 700,
                      background: isCodeAuto ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 88, 12, 0.15)',
                      color: isCodeAuto ? '#059669' : '#c2410c',
                      border: `1px solid ${isCodeAuto ? 'rgba(16, 185, 129, 0.3)' : 'rgba(234, 88, 12, 0.3)'}`
                    }}
                  >
                    {isCodeAuto ? '⚡ توليد تلقائي ذكي' : '✍️ إدخال يدوي'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input 
                    className="glass-input-field" 
                    style={{ 
                      flex: 1, 
                      padding: '0.8rem',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      fontFamily: 'monospace', 
                      fontSize: 'var(--fs-lg)',
                      fontWeight: 900, 
                      letterSpacing: '0.1em',
                      background: isCodeAuto ? 'rgba(0,0,0,0.03)' : '#ffffff'
                    }} 
                    value={formData.code} 
                    onChange={e => {
                      setIsCodeAuto(false);
                      setFormData({ ...formData, code: e.target.value });
                    }} 
                    placeholder="مثال: 1293" 
                  />
                  <button
                    type="button"
                    onClick={() => setIsCodeAuto(!isCodeAuto)}
                    title={isCodeAuto ? "قفل التوليد التلقائي للتحرير اليدوي" : "تفعيل التوليد التلقائي الذكي"}
                    style={{
                      padding: '0.8rem 1rem',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      background: isCodeAuto ? '#fef3c7' : '#ffffff',
                      color: isCodeAuto ? '#b45309' : '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 800,
                      fontSize: 'var(--fs-xs)'
                    }}
                  >
                    {isCodeAuto ? <Lock size={16} /> : <Unlock size={16} />}
                    <span>{isCodeAuto ? 'مقفل تلقائي' : 'مفتوح يدوي'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={regenerateCode}
                    title="إعادة فحص الشجرة وتوليد الكود التالي"
                    style={{
                      padding: '0.8rem 1rem',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      color: '#0f172a',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 800,
                      fontSize: 'var(--fs-xs)'
                    }}
                  >
                    <RefreshCw size={16} />
                    <span>تحديث</span>
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  background: 'transparent',
                  color: '#475569',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveAccount}
                disabled={isSaving}
                style={{
                  padding: '0.75rem 2rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #c2410c, #ea580c)',
                  color: 'white',
                  fontWeight: 900,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 10px 20px rgba(194, 65, 12, 0.3)',
                  opacity: isSaving ? 0.7 : 1
                }}
              >
                {isSaving ? 'جاري الحفظ...' : (editingId ? 'حفظ التعديلات' : 'إضافة الحساب')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
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
          <span style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8', marginRight: '0.625rem' }}>#{node.code}</span>
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
        <div style={{ textAlign: 'center', fontWeight: 900, color: isRoot ? 'white' : THEME.primary, fontFamily: 'monospace', fontSize: 'var(--fs-md)', background: isRoot ? THEME.primary : '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
          {formatCurrency(node.balance)}
        </div>
      </div>

      {isExpanded && (
        <div style={{ marginTop: '0.3125rem', marginBottom: '0.9375rem' }}>
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
