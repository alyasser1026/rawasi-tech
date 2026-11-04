"use client";

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useSidebar } from '@/lib/SidebarContext';

/** Filters with more controls than this start collapsed, so the table stays near the top. */
const OPEN_FILTER_LIMIT = 4;

/**
 * Shared screen header area: summary figures, then one toolbar row with the screen's
 * actions on the start side and search + filter toggle on the end side, then the
 * (collapsible) filter grid.
 */
export default function EnterprisePageTools() {
  const { actions, summary, customFilters, searchPlaceholder, enableSearch, enableDates } = useSidebar();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [dates, setDates] = useState({ start: '', end: '' });
  const filtersId = useId();
  const filtersRef = useRef<HTMLDivElement>(null);
  const decided = useRef(false);
  const hasPanel = Boolean(customFilters || enableDates);

  useLayoutEffect(() => {
    if (decided.current || !hasPanel || !filtersRef.current) return;
    decided.current = true;
    const controls = filtersRef.current.querySelectorAll('input:not([type=hidden]), select, textarea').length;
    if (controls > OPEN_FILTER_LIMIT) setFiltersOpen(false);
  }, [hasPanel]);

  const changeSearch = (value: string) => {
    setSearch(value);
    window.dispatchEvent(new CustomEvent('globalSearch', { detail: value }));
  };
  const changeDate = (key: 'start' | 'end', value: string) => {
    const next = { ...dates, [key]: value };
    setDates(next);
    window.dispatchEvent(new CustomEvent('globalDateFilter', { detail: next }));
  };
  const clearDates = () => {
    setDates({ start: '', end: '' });
    window.dispatchEvent(new CustomEvent('globalDateFilter', { detail: { start: '', end: '' } }));
  };
  if (!actions && !summary && !hasPanel && !enableSearch) return null;
  const datesActive = Boolean(dates.start || dates.end);

  return <div className="ent-page-tools no-print">
    {summary && <div className="ent-page-summary" aria-label="ملخص الصفحة">{summary}</div>}
    {(actions || hasPanel || enableSearch) && <div className="ent-page-controls ent-panel">
      <div className="ent-page-toolbar">
        <div className="ent-page-actions" aria-label="عمليات الصفحة">{actions}</div>
        {(enableSearch || hasPanel) && <div className="ent-page-toolbar-end">
          {enableSearch && <label className="ent-search ent-toolbar-search"><Search size={16} aria-hidden="true"/><span className="sr-only">البحث في الصفحة</span><input type="search" value={search} placeholder={searchPlaceholder || 'ابحث هنا...'} onChange={event => changeSearch(event.target.value)}/></label>}
          {hasPanel && <button type="button" className={`ent-button ent-filter-toggle${filtersOpen ? ' is-open' : ''}`} aria-expanded={filtersOpen} aria-controls={filtersId} onClick={() => setFiltersOpen(open => !open)}>
            <SlidersHorizontal size={16} aria-hidden="true"/>{filtersOpen ? 'إخفاء الفلاتر' : 'الفلاتر'}{datesActive && <span className="ent-filter-dot" aria-label="يوجد فلتر مفعّل"/>}
          </button>}
        </div>}
      </div>
      {hasPanel && <div id={filtersId} ref={filtersRef} className="ent-page-custom-filters" hidden={!filtersOpen}>
        {enableDates && <div className="ent-page-period"><label>من تاريخ<input type="date" value={dates.start} onChange={event => changeDate('start', event.target.value)}/></label><label>إلى تاريخ<input type="date" value={dates.end} onChange={event => changeDate('end', event.target.value)}/></label>{datesActive && <button type="button" className="ent-icon-button" aria-label="مسح فترة الصفحة" onClick={clearDates}><X size={16}/></button>}</div>}
        {customFilters}
      </div>}
    </div>}
  </div>;
}
