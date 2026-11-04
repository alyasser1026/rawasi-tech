"use client";
import React, { useState, useMemo, useCallback, useEffect, useDeferredValue } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/lib/toast-context';
import { THEME } from '@/lib/theme';
import { formatCurrency } from '@/lib/helpers';
import { usePermissions } from '@/lib/PermissionsContext'; 
import SecureAction from '@/components/SecureAction';      
import SmartCombo from '@/components/SmartCombo'; 
import MasterPage from '@/components/MasterPage';
import RawasiSidebarManager from '@/components/RawasiSidebarManager';
import RawasiSmartTable from '@/components/rawasismarttable';
import LoadingScreen from '@/components/LoadingScreen';

// ==========================================
// 🧠 العقل المدبر (Logic) - متوافق مع قوانين Supabase
// ==========================================
function useJournalLogic() {
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const [globalSearch, setGlobalSearch] = useState('');
    const deferredSearch = useDeferredValue(globalSearch); 

    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterAccountId, setFilterAccountId] = useState<string | null>(null);
    const [filterPartnerId, setFilterPartnerId] = useState<string | null>(null);
    const [filterProjectId, setFilterProjectId] = useState<string | null>(null);
    const [filterVType, setFilterVType] = useState<string>('الكل');
    const [filterStatus, setFilterStatus] = useState('الكل'); 
    
    // 🟢 ترقيم الصفحات (Pagination) اليدوي للجدول
    const [rowsPerPage, setRowsPerPage] = useState<number>(100);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        setCurrentPage(1);
    }, [globalSearch, dateFrom, dateTo, filterAccountId, filterPartnerId, filterProjectId, filterVType, filterStatus, rowsPerPage]);

    // 🟢 السحب من السيرفر (بيسحب الداتا 1000 بـ 1000 عشان Supabase ميقفلش الطلب)
    const { data: journalMaster = [], isLoading, isError } = useQuery({
        queryKey: ['journal_master_view', dateFrom, dateTo, filterAccountId, filterPartnerId, filterProjectId, filterVType, filterStatus], 
        queryFn: async () => {
            const allData: any[] = [];
            const seenIds = new Set<string>(); // 🛡️ حماية من التكرار
            const step = 1000; // 🟢 الرقم ده ثابت عشان Supabase بيرفض يبعت أكتر منه في المرة
            let from = 0; 
            let hasMore = true;
            let loopGuard = 0;

            // 🟢 يقدر يسحب لحد 50 مرة (يعني 50 ألف سطر)
            while (hasMore && loopGuard < 50) {
                loopGuard++;
                let query = supabase
                    .from('journal_master_view') 
                    .select('*')
                    .order('entry_date', { ascending: false })
                    .order('line_created_at', { ascending: false })
                    .order('line_id', { ascending: false }) // 🚀 تم إضافته هنا لضمان استقرار الترتيب وعدم سقوط أو تكرار أي مبالغ محاسبية
                    .range(from, from + step - 1);
                
                if (dateFrom) query = query.gte('entry_date', dateFrom);
                if (dateTo) query = query.lte('entry_date', dateTo);
                if (filterAccountId) query = query.eq('account_id', filterAccountId);
                if (filterPartnerId) query = query.eq('partner_id', filterPartnerId);
                
                if (filterStatus === 'معتمد') query = query.eq('header_status', 'معتمد');
                if (filterStatus === 'مسودة') query = query.eq('header_status', 'draft');
                if (filterProjectId) query = query.eq('project_id', filterProjectId);
                if (filterVType && filterVType !== 'الكل') query = query.eq('v_type', filterVType);

                const { data, error } = await query;
                if (error) throw error;

                if (data && data.length > 0) {
                    // 🛡️ إضافة فقط الأسطر الغير مكررة
                    for (const row of data) {
                        const id = String(row.line_id);
                        if (!seenIds.has(id)) {
                            seenIds.add(id);
                            allData.push(row);
                        }
                    }
                    from += step;
                    
                    if (data.length < step) {
                        hasMore = false; 
                    }
                } else {
                    hasMore = false;
                }
            }
            return allData;
        },
        staleTime: 60 * 1000 
    });

    const displayedLines = useMemo(() => {
        if (!deferredSearch) return journalMaster; 
        const lower = deferredSearch.toLowerCase();
        return journalMaster.filter(r => 
            (r.line_notes && String(r.line_notes).toLowerCase().includes(lower)) ||
            (r.header_description && String(r.header_description).toLowerCase().includes(lower)) ||
            (r.account_name && String(r.account_name).toLowerCase().includes(lower)) ||
            (r.partner_name && String(r.partner_name).toLowerCase().includes(lower))
        );
    }, [journalMaster, deferredSearch]);

    // 🧮 محرك الحسابات الجبار
    const totals = useMemo(() => {
        let td = 0;
        let tc = 0;
        
        displayedLines.forEach(line => {
            const debitStr = String(line.debit || 0).replace(/[^\d.-]/g, '');
            const creditStr = String(line.credit || 0).replace(/[^\d.-]/g, '');
            
            const d = parseFloat(debitStr);
            const c = parseFloat(creditStr);
            
            td += isNaN(d) ? 0 : d;
            tc += isNaN(c) ? 0 : c;
        });
        
        return { totalDebit: td, totalCredit: tc, balance: td - tc, count: displayedLines.length };
    }, [displayedLines]);

    const paginatedLines = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        return displayedLines.slice(start, end);
    }, [displayedLines, currentPage, rowsPerPage]);

    const totalPages = Math.ceil(displayedLines.length / rowsPerPage) || 1;

    const deleteHeadersMutation = useMutation({
        mutationFn: async () => {
            const selectedLines = journalMaster.filter(l => selectedIds.includes(String(l.line_id)));
            const invalidStatusLines = selectedLines.filter(l => l.header_status !== 'مسودة');
            if (invalidStatusLines.length > 0) {
                 throw new Error('مرفوض: لا يمكن مسح قيد حالته "مرحل" أو "معتمد". يجب فك الترحيل أولاً.');
            }

            const headerIds = [...new Set(selectedLines.map(l => l.header_id))];

            if (headerIds.length === 0) throw new Error('لم يتم تحديد أي قيود صالحة.');
            const { error } = await supabase.from('journal_headers').delete().in('id', headerIds);
            if (error) throw error;
        },
        onSuccess: () => {
            showToast('تم حذف القيود وارتباطاتها بنجاح', 'success');
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['journal_master_view'] });
        },
        onError: (err: any) => showToast(`فشل في الحذف: ${err.message}`, 'error')
    });

    // كاشف الفلترة النشطة
    const isFiltered = !!(filterAccountId || filterPartnerId || filterProjectId || dateFrom || dateTo || (filterStatus !== 'الكل') || (filterVType !== 'الكل'));

    return {
        isLoading, isError,
        globalSearch, setGlobalSearch, 
        dateFrom, setDateFrom, dateTo, setDateTo,
        filterAccountId, setFilterAccountId,
        filterPartnerId, setFilterPartnerId,
        filterProjectId, setFilterProjectId,
        filterVType, setFilterVType,
        filterStatus, setFilterStatus,
        rowsPerPage, setRowsPerPage, 
        currentPage, setCurrentPage, totalPages,
        paginatedLines, 
        totals,
        selectedIds, setSelectedIds,
        isFiltered,
        handleDeleteHeaders: () => {
            if (confirm('تنبيه: سيتم حذف القيود المحددة بالكامل (مدين ودائن). هل أنت متأكد؟')) {
                deleteHeadersMutation.mutate();
            }
        }
    };
}

// ==========================================
// 🎨 الواجهة (UI) السيادية
// ==========================================
export default function JournalPage() {
  const logic = useJournalLogic();
  const { can, loading: permsLoading } = usePermissions();

  const columns = useMemo(() => [
    { 
      header: 'التاريخ / القيد', 
      accessor: 'date', 
      render: (row: any) => {
        if (!row) return null;
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#64748b', fontWeight: 900 }}>{row.entry_date}</span>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>#{row.reference_id?.split('-')[0] || row.header_id?.split('-')[0]}</span>
          </div>
        );
      } 
    },
    { 
      header: 'الحساب المحاسبي', 
      accessor: 'account_name', 
      render: (row: any) => {
        if (!row) return null;
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <b style={{ color: THEME.primary, fontSize: '13px' }}>{row.account_name || '---'}</b>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{row.account_code || ''}</span>
          </div>
        );
      } 
    },
    { 
      header: 'الشريك / الموقع', 
      accessor: 'partner_name', 
      render: (row: any) => {
        if (!row) return null;
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 800, color: '#334155' }}>{row.partner_name || '---'}</span>
            {row.project_name && <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>{row.project_name}</span>}
          </div>
        );
      } 
    },
    { 
      header: 'البيان / الوصف', 
      accessor: 'header_description', 
      render: (row: any) => {
        if (!row) return null;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px' }}>
            <span style={{ color: '#1e293b', fontWeight: 800, fontSize: '12px' }}>{row.header_description}</span>
            {row.line_notes && <span style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>* {row.line_notes}</span>}
          </div>
        );
      } 
    },
    { 
      header: 'مدين', 
      accessor: 'debit', 
      render: (row: any) => row && row.debit > 0 ? <span style={{ fontWeight: 900, color: '#059669', fontSize: '14px' }}>{formatCurrency(row.debit)}</span> : '-' 
    },
    { 
      header: 'دائن', 
      accessor: 'credit', 
      render: (row: any) => row && row.credit > 0 ? <span style={{ fontWeight: 900, color: '#dc2626', fontSize: '14px' }}>{formatCurrency(row.credit)}</span> : '-' 
    },
    {
      header: 'الحالة',
      accessor: 'header_status',
      render: (row: any) => {
        if (!row) return null;
        return row.header_status === 'معتمد' ? 
          <span className="badge-glass green">معتمد</span> : 
          <span className="badge-glass yellow">مسودة</span>;
      }
    }
  ], []);

  const sidebarActions = useMemo(() => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      {logic.selectedIds.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '5px', paddingTop: '15px', borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
          <p style={{fontSize:'11px', textAlign:'center', color:'#94a3b8', fontWeight:900, margin:0}}>تم تحديد ({logic.selectedIds.length}) سطر من الدفتر</p>
          <SecureAction module="journal" action="delete">
            <button className="btn-main-glass red" onClick={logic.handleDeleteHeaders}>حذف القيود المحددة نهائياً</button>
          </SecureAction>
        </div>
      )}
    </div>
  ), [logic.selectedIds.length, logic.handleDeleteHeaders]); 

  return (
    <div className="clean-page">
      <MasterPage title="دفتر اليومية الشامل" subtitle="استعلام شامل وسريع جداً مع تقسيم يدوي للصفحات لمنع التهنيج.">
          
          <RawasiSidebarManager 
            summary={
              <div className="summary-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <span style={{fontSize:'12px', fontWeight:800, color:'#64748b'}}>إجمالي المدين</span>
                  <div style={{fontSize:'18px', fontWeight:900, color: '#059669'}}>
                    {formatCurrency(logic.totals.totalDebit)}
                  </div>
                </div>
                <div style={{ borderTop: '1px dashed rgba(255,255,255,0.2)', paddingTop: '10px' }}>
                  <span style={{fontSize:'12px', fontWeight:800, color:'#64748b'}}>إجمالي الدائن</span>
                  <div style={{fontSize:'18px', fontWeight:900, color: '#dc2626'}}>
                    {formatCurrency(logic.totals.totalCredit)}
                  </div>
                </div>
                <div style={{ borderTop: '1px dashed rgba(255,255,255,0.2)', paddingTop: '10px', background: logic.totals.balance !== 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', padding: '10px', borderRadius: '10px' }}>
                  <span style={{fontSize:'12px', fontWeight:800, color: logic.totals.balance !== 0 ? '#d97706' : '#059669'}}>
                     {logic.isFiltered ? 'صافي رصيد الفلترة' : (logic.totals.balance === 0 ? 'متزن' : (logic.totals.balance > 0 ? 'رصيد مدين' : 'رصيد دائن'))}
                  </span>
                  <div style={{fontSize:'20px', fontWeight:900, color: logic.totals.balance !== 0 ? '#d97706' : '#059669'}}>
                    {formatCurrency(Math.abs(logic.totals.balance))}
                  </div>
                </div>
              </div>
            }
            actions={sidebarActions}
            customFilters={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
                
                <div>
                    <label className="filter-label">عدد الصفوف في الصفحة (للجدول)</label>
                    <select 
                        value={logic.rowsPerPage} 
                        onChange={(e) => logic.setRowsPerPage(Number(e.target.value))} 
                        className="filter-input-glass custom-select"
                    >
                        <option value={50}>50 صف / صفحة</option>
                        <option value={100}>100 صف / صفحة</option>
                        <option value={500}>500 صف / صفحة</option>
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                        <label className="filter-label">من تاريخ</label>
                        <input type="date" value={logic.dateFrom} onChange={e => logic.setDateFrom(e.target.value)} className="filter-input-glass" />
                    </div>
                    <div>
                        <label className="filter-label">إلى تاريخ</label>
                        <input type="date" value={logic.dateTo} onChange={e => logic.setDateTo(e.target.value)} className="filter-input-glass" />
                    </div>
                </div>

                <div style={{ zIndex: 100 }}>
                    <SmartCombo 
                        label="البحث برقم / اسم الحساب" 
                        table="accounts"
                        displayCol="name"
                        initialDisplay="" 
                        onSelect={(v:any) => logic.setFilterAccountId(v?.id || null)} 
                    />
                </div>

                <div style={{ zIndex: 90 }}>
                    <SmartCombo 
                        label="البحث باسم الشريك (مورد/عميل/عامل)" 
                        table="partners"
                        displayCol="name"
                        initialDisplay="" 
                        onSelect={(v:any) => logic.setFilterPartnerId(v?.id || null)} 
                    />
                </div>

                <div style={{ zIndex: 80 }}>
                    <SmartCombo 
                        label="البحث باسم المشروع / الفيلا" 
                        table="projects"
                        displayCol="name"
                        initialDisplay="" 
                        onSelect={(v:any) => logic.setFilterProjectId(v?.id || null)} 
                    />
                </div>

                <div>
                  <label className="filter-label">تصفية حسب نوع القيد</label>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {['الكل', 'يدوي', 'مصروف', 'إيراد', 'صرف', 'قبض', 'توريد', 'مستخلص'].map(type => (
                      <button 
                        key={type} 
                        onClick={() => logic.setFilterVType(type)} 
                        className={`filter-btn ${logic.filterVType === type ? 'active' : ''}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="filter-label">تصفية حسب الحالة</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {['الكل', 'معتمد', 'مسودة'].map(type => (
                      <button 
                        key={type} 
                        onClick={() => logic.setFilterStatus(type)} 
                        className={`filter-btn ${logic.filterStatus === type ? 'active' : ''}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            }
            onSearch={(val) => logic.setGlobalSearch(val)} 
            watchDeps={[logic.selectedIds.length, logic.totals.balance, logic.filterStatus, logic.filterVType, logic.dateFrom, logic.dateTo, logic.filterAccountId, logic.filterPartnerId, logic.filterProjectId, logic.rowsPerPage, logic.globalSearch]}
          />

          <style>{`
            .btn-main-glass { width: 100%; padding: 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(15px); font-weight: 900; cursor: pointer; transition: 0.2s; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px; }
            .btn-main-glass.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
            .btn-main-glass:hover { transform: translateY(-3px); filter: brightness(1.1); }
            
            .summary-glass-card { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 20px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.2); margin-bottom: 25px; }
            
            .filter-label { color: white; fontSize: 11px; font-weight: 900; display: block; margin-bottom: 8px; }
            .filter-input-glass { width: 100%; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.2); color: white; outline: none; font-family: inherit; font-weight: 800; font-size: 13px; transition: 0.3s; }
            .filter-input-glass:focus { background: rgba(0,0,0,0.4); border-color: ${THEME.goldAccent}; }
            .filter-input-glass::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
            
            .custom-select { appearance: auto; cursor: pointer; }
            .custom-select option { background: #1e293b; color: white; font-weight: 900; }

            .filter-btn { flex: 1; padding: 10px; border-radius: 10px; background: rgba(255,255,255,0.1); color: white; border: none; font-weight: 900; cursor: pointer; font-size: 11px; transition: 0.3s; }
            .filter-btn.active { background: ${THEME.goldAccent}; color: #1e293b; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
            
            .badge-glass { padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 900; display: inline-block; }
            .badge-glass.green { background: #ecfdf5; color: #059669; }
            .badge-glass.yellow { background: #fff7ed; color: #d97706; }
            
            .pagination-container { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.03); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); }
            .btn-pagination { background: rgba(255,255,255,0.1); color: white; border: none; padding: 10px 20px; border-radius: 12px; font-weight: 900; cursor: pointer; transition: 0.3s; }
            .btn-pagination:hover:not(:disabled) { background: ${THEME.goldAccent}; color: #1e293b; }
            .btn-pagination:disabled { opacity: 0.3; cursor: not-allowed; }
          `}</style>

          {(logic.isLoading || permsLoading) ? (
            <LoadingScreen message="جاري سحب البيانات (دفعات 1000 سطر)..." fullScreen={false} />
          ) : logic.isError ? (
            <div style={{ textAlign: 'center', padding: '100px', fontWeight: 900, color: '#ef4444' }}>
              حدث خطأ في الاتصال بقاعدة البيانات.
            </div>
          ) : (
            <>
              <RawasiSmartTable 
                  data={logic.paginatedLines} 
                  columns={columns} 
                  selectable={true}
                  selectedIds={logic.selectedIds}
                  onSelectionChange={logic.setSelectedIds}
                  enablePagination={false} 
                  rowKey="line_id" 
              />
              
              {logic.totals.count > 0 && (
                <div className="pagination-container">
                    <button 
                        className="btn-pagination" 
                        onClick={() => logic.setCurrentPage(p => Math.max(1, p - 1))} 
                        disabled={logic.currentPage === 1}
                    >\
                        السابق
                    </button>
                    
                    <span style={{ color: '#94a3b8', fontWeight: 800, fontSize: '13px' }}>
                        صفحة <b style={{color: 'white'}}>{logic.currentPage}</b> من <b style={{color: 'white'}}>{logic.totalPages}</b> 
                        <span style={{margin: '0 10px'}}>|</span> 
                        إجمالي <b style={{color: THEME.goldAccent}}>{logic.totals.count}</b> سطر
                    </span>

                    <button 
                        className="btn-pagination" 
                        onClick={() => logic.setCurrentPage(p => Math.min(logic.totalPages, p + 1))} 
                        disabled={logic.currentPage === logic.totalPages}
                    >
                        التالي
                    </button>
                </div>
              )}
            </>
          )}
      </MasterPage>
    </div>
  );
}