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
import KpiStrip from '@/components/KpiStrip';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Scale, Trash2 } from 'lucide-react';

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
            <span style={{ fontSize: 'var(--fs-xs)', color: '#94a3b8' }}>#{row.reference_id?.split('-')[0] || row.header_id?.split('-')[0]}</span>
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
            <b style={{ color: THEME.primary, fontSize: 'var(--fs-sm)' }}>{row.account_name || '---'}</b>
            <span style={{ fontSize: 'var(--fs-xs)', color: '#64748b' }}>{row.account_code || ''}</span>
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
            {row.project_name && <span style={{ fontSize: 'var(--fs-xs)', color: '#10b981', fontWeight: 700 }}>{row.project_name}</span>}
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
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '18.75rem' }}>
            <span style={{ color: '#1e293b', fontWeight: 800, fontSize: 'var(--fs-sm)' }}>{row.header_description}</span>
            {row.line_notes && <span style={{ color: '#64748b', fontSize: 'var(--fs-xs)', marginTop: '2px' }}>* {row.line_notes}</span>}
          </div>
        );
      } 
    },
    { 
      header: 'مدين', 
      accessor: 'debit', 
      render: (row: any) => row && row.debit > 0 ? <span style={{ fontWeight: 900, color: '#059669', fontSize: 'var(--fs-md)' }}>{formatCurrency(row.debit)}</span> : '-' 
    },
    { 
      header: 'دائن', 
      accessor: 'credit', 
      render: (row: any) => row && row.credit > 0 ? <span style={{ fontWeight: 900, color: '#dc2626', fontSize: 'var(--fs-md)' }}>{formatCurrency(row.credit)}</span> : '-' 
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

  const voucherTypes = ['الكل', 'يدوي', 'مصروف', 'إيراد', 'صرف', 'قبض', 'توريد', 'مستخلص'];
  const statuses = ['الكل', 'معتمد', 'مسودة'];
  const balanced = logic.totals.balance === 0;

  const summary = useMemo(() => <KpiStrip compact items={[
    { label: 'إجمالي المدين', amount: logic.totals.totalDebit, tone: 'success', icon: <ArrowDownLeft /> },
    { label: 'إجمالي الدائن', amount: logic.totals.totalCredit, tone: 'danger', icon: <ArrowUpRight /> },
    { label: logic.isFiltered ? 'صافي رصيد التصفية' : (balanced ? 'الدفتر متزن' : (logic.totals.balance > 0 ? 'رصيد مدين' : 'رصيد دائن')), amount: Math.abs(logic.totals.balance), tone: balanced ? 'success' : 'warning', icon: <Scale />, hint: `${logic.totals.count.toLocaleString('ar-EG')} سطر` },
  ]} />, [logic.totals, logic.isFiltered, balanced]);

  const sidebarActions = useMemo(() => logic.selectedIds.length > 0 ? <>
    <p>تم تحديد {logic.selectedIds.length.toLocaleString('ar-EG')} سطر</p>
    <SecureAction module="journal" action="delete">
      <button type="button" className="ent-button ent-danger" onClick={logic.handleDeleteHeaders}><Trash2 size={15} aria-hidden="true" />حذف القيود المحددة</button>
    </SecureAction>
    <button type="button" className="ent-button" onClick={() => logic.setSelectedIds([])}>إلغاء التحديد</button>
  </> : null, [logic.selectedIds.length, logic.handleDeleteHeaders, logic.setSelectedIds]);

  const filters = (
    <div>
      <div><label className="filter-label" htmlFor="journal-from">من تاريخ</label><input id="journal-from" type="date" value={logic.dateFrom} onChange={e => logic.setDateFrom(e.target.value)} /></div>
      <div><label className="filter-label" htmlFor="journal-to">إلى تاريخ</label><input id="journal-to" type="date" value={logic.dateTo} onChange={e => logic.setDateTo(e.target.value)} /></div>
      <SmartCombo label="الحساب (رقم أو اسم)" table="accounts" displayCol="name" initialDisplay="" onSelect={(v: any) => logic.setFilterAccountId(v?.id || null)} />
      <SmartCombo label="الشريك (مورد / عميل / عامل)" table="partners" displayCol="name" initialDisplay="" onSelect={(v: any) => logic.setFilterPartnerId(v?.id || null)} />
      <SmartCombo label="المشروع / الفيلا" table="projects" displayCol="name" initialDisplay="" onSelect={(v: any) => logic.setFilterProjectId(v?.id || null)} />
      <div className="phi-filter-wide">
        <div><span className="filter-label">نوع القيد</span><div className="phi-segmented" role="group" aria-label="نوع القيد">{voucherTypes.map(type => <button key={type} type="button" aria-pressed={logic.filterVType === type} onClick={() => logic.setFilterVType(type)}>{type}</button>)}</div></div>
        <div><span className="filter-label">الحالة</span><div className="phi-segmented" role="group" aria-label="حالة القيد">{statuses.map(type => <button key={type} type="button" aria-pressed={logic.filterStatus === type} onClick={() => logic.setFilterStatus(type)}>{type}</button>)}</div></div>
      </div>
    </div>
  );

  return (
    <div className="clean-page">
      <MasterPage title="دفتر اليومية الشامل" subtitle="كل سطور القيود مع البحث والتصفية حسب الحساب والشريك والمشروع">
          <RawasiSidebarManager
            summary={summary}
            actions={sidebarActions}
            customFilters={filters}
            placeholder="ابحث في البيان أو الحساب أو رقم القيد…"
            onSearch={(val) => logic.setGlobalSearch(val)}
            watchDeps={[logic.selectedIds.length, logic.totals, logic.filterStatus, logic.filterVType, logic.dateFrom, logic.dateTo, logic.filterAccountId, logic.filterPartnerId, logic.filterProjectId, logic.globalSearch]}
          />

          <style>{`
            .badge-glass { padding: 0.25rem 0.625rem; border-radius: 8px; font-size: var(--fs-xs); font-weight: 800; display: inline-block; }
            .badge-glass.green { background: #ecfdf5; color: #047857; }
            .badge-glass.yellow { background: #fff7ed; color: #b45309; }
          `}</style>

          {(logic.isLoading || permsLoading) ? (
            <LoadingScreen message="جاري تحميل سطور دفتر اليومية..." fullScreen={false} />
          ) : logic.isError ? (
            <div className="ent-panel"><div className="ent-empty" role="alert"><h3>تعذر تحميل دفتر اليومية</h3><p>تحقق من الاتصال ثم أعد تحميل الصفحة.</p></div></div>
          ) : (
            <div className="ent-panel">
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
                <div className="ent-table-footer">
                  <span>صفحة <b>{logic.currentPage.toLocaleString('ar-EG')}</b> من <b>{logic.totalPages.toLocaleString('ar-EG')}</b> · إجمالي <b>{logic.totals.count.toLocaleString('ar-EG')}</b> سطر</span>
                  <div className="phi-pager">
                    <label>عدد الصفوف
                      <select value={logic.rowsPerPage} onChange={(e) => logic.setRowsPerPage(Number(e.target.value))}>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={500}>500</option>
                      </select>
                    </label>
                    <button type="button" className="ent-button" onClick={() => logic.setCurrentPage(p => Math.max(1, p - 1))} disabled={logic.currentPage === 1}><ChevronRight size={15} aria-hidden="true" />السابق</button>
                    <button type="button" className="ent-button" onClick={() => logic.setCurrentPage(p => Math.min(logic.totalPages, p + 1))} disabled={logic.currentPage === logic.totalPages}>التالي<ChevronLeft size={15} aria-hidden="true" /></button>
                  </div>
                </div>
              )}
            </div>
          )}
      </MasterPage>
    </div>
  );
}
