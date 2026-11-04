"use client";

import { useId, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useSidebar } from '@/lib/SidebarContext';

/** Keep each screen's existing filters and permission-checked actions in the workspace. */
export default function EnterprisePageTools() {
  const { actions, summary, customFilters, searchPlaceholder, enableSearch, enableDates } = useSidebar();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [dates, setDates] = useState({ start: '', end: '' });
  const filtersId = useId();
  const hasFilters = Boolean(customFilters || enableSearch || enableDates);

  const changeSearch = (value: string) => {
    setSearch(value);
    window.dispatchEvent(new CustomEvent('globalSearch', { detail: value }));
  };
  const changeDate = (key: 'start' | 'end', value: string) => {
    const next = { ...dates, [key]: value };
    setDates(next);
    window.dispatchEvent(new CustomEvent('globalDateFilter', { detail: next }));
  };
  if (!actions && !summary && !hasFilters) return null;

  return <div className="ent-page-tools no-print">
    {summary && <div className="ent-page-summary" aria-label="ملخص الصفحة">{summary}</div>}
    {(actions || hasFilters) && <div className="ent-page-controls ent-panel">
      <div className="ent-page-toolbar">
        <div className="ent-page-actions" aria-label="عمليات الصفحة">{actions}</div>
        {hasFilters && <button type="button" className="ent-button" aria-expanded={filtersOpen} aria-controls={filtersId} aria-label={filtersOpen ? 'إخفاء فلاتر الصفحة' : 'إظهار فلاتر الصفحة'} onClick={() => setFiltersOpen(open => !open)}><SlidersHorizontal size={16}/>الفلاتر</button>}
      </div>
      {hasFilters && <div id={filtersId} className="ent-page-custom-filters" hidden={!filtersOpen}>
        {enableSearch && <label className="ent-page-search"><span>البحث في الصفحة</span><div className="ent-search"><Search size={16} aria-hidden="true"/><input type="search" value={search} placeholder={searchPlaceholder || 'ابحث هنا...'} onChange={event => changeSearch(event.target.value)}/></div></label>}
        {enableDates && <div className="ent-page-period"><label>من تاريخ<input type="date" value={dates.start} onChange={event => changeDate('start', event.target.value)}/></label><label>إلى تاريخ<input type="date" value={dates.end} onChange={event => changeDate('end', event.target.value)}/></label>{(dates.start || dates.end) && <button type="button" className="ent-icon-button" aria-label="مسح فترة الصفحة" onClick={() => { setDates({ start: '', end: '' }); window.dispatchEvent(new CustomEvent('globalDateFilter', { detail: { start: '', end: '' } })); }}><X size={16}/></button>}</div>}
        {customFilters}
      </div>}
    </div>}
  </div>;
}
