"use client";

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/PermissionsContext';
import { NAVIGATION_SHORTCUTS, searchWorkspacePages, workspacePages } from '@/lib/workspace-navigation';
import WorkspaceDialog from './WorkspaceDialog';
import { MenuIcon } from './NavigationIcon';
import { OPEN_SEARCH_EVENT, OPEN_SHORTCUTS_EVENT } from './AppTopBar';

export default function GlobalNavigationShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const { role, can, loading } = usePermissions();
  const [dialog, setDialog] = useState<'search' | 'help' | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [online, setOnline] = useState<boolean | null>(null);
  const resultId = useId();
  const isPublicPage = pathname === '/login' || pathname === '/signup';
  const pages = useMemo(() => loading ? [] : workspacePages(role, can), [loading, role, can]);
  const results = useMemo(() => searchWorkspacePages(pages, query).slice(0, 12), [pages, query]);
  const activeIndex = Math.min(selected, Math.max(0, results.length - 1));
  const close = useCallback(() => setDialog(null), []);
  const openSearch = useCallback(() => { setQuery(''); setSelected(0); setDialog('search'); }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  useEffect(() => { setDialog(null); }, [pathname]);

  // The top bar opens these dialogs through window events, so dialogs and shortcuts live in one place.
  useEffect(() => {
    const showSearch = () => openSearch();
    const showShortcuts = () => setDialog('help');
    window.addEventListener(OPEN_SEARCH_EVENT, showSearch);
    window.addEventListener(OPEN_SHORTCUTS_EVENT, showShortcuts);
    return () => { window.removeEventListener(OPEN_SEARCH_EVENT, showSearch); window.removeEventListener(OPEN_SHORTCUTS_EVENT, showShortcuts); };
  }, [openSearch]);

  useEffect(() => {
    if (isPublicPage || loading) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if (dialog || document.querySelector('[aria-modal="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.code === 'KeyK') {
        event.preventDefault(); openSearch(); return;
      }
      if (event.code === 'F1' && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault(); setDialog('help'); return;
      }
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey) {
        const shortcut = NAVIGATION_SHORTCUTS.find(item => event.code === `Digit${item.digit}` || event.code === `Numpad${item.digit}`);
        if (shortcut && pages.some(item => item.path === shortcut.path)) { event.preventDefault(); router.push(shortcut.path); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog, isPublicPage, loading, openSearch, pages, router]);

  useEffect(() => { document.getElementById(`${resultId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' }); }, [activeIndex, resultId, query]);

  if (isPublicPage) return null;

  return <>
    {online === false && <div className="workspace-offline no-print" role="status">الاتصال بالإنترنت غير متاح. قد تكون البيانات المعروضة قديمة؛ تأكد من نجاح الحفظ بعد عودة الاتصال.</div>}
    {dialog === 'search' && <WorkspaceDialog title="انتقل إلى شاشة" onClose={close}>
      <label className="workspace-search-label" htmlFor={`${resultId}-search`}>ابحث باسم الشاشة أو القسم</label>
      <input id={`${resultId}-search`} className="workspace-search-input" data-autofocus value={query}
        placeholder="مثال: سندات الصرف، الرواتب، المشاريع…" autoComplete="off"
        role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={`${resultId}-list`}
        aria-activedescendant={results.length ? `${resultId}-${activeIndex}` : undefined}
        onChange={event => { setQuery(event.target.value); setSelected(0); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setSelected(Math.max(0, Math.min(activeIndex + 1, results.length - 1))); }
          if (event.key === 'ArrowUp') { event.preventDefault(); setSelected(Math.max(0, activeIndex - 1)); }
          if (event.key === 'Enter' && results[activeIndex]) { event.preventDefault(); close(); router.push(results[activeIndex].path); }
        }} />
      <div className="workspace-search-results" id={`${resultId}-list`} role="listbox" aria-label="الشاشات المتاحة">
        {results.map((item, index) => <button type="button" className="workspace-search-result" id={`${resultId}-${index}`} key={item.id}
          role="option" aria-selected={index === activeIndex} onMouseEnter={() => setSelected(index)}
          onClick={() => { close(); router.push(item.path); }}>
          <span className="workspace-result-icon" aria-hidden="true"><MenuIcon id={item.id} size={18} /></span>
          <span><strong>{item.title}</strong><small>{item.group}</small></span>
          <span aria-hidden="true">←</span>
        </button>)}
        {!results.length && <p className="workspace-empty">لا توجد شاشة مطابقة ضمن صلاحياتك.</p>}
      </div>
      <p className="workspace-hint">↑ ↓ للتنقل · Enter للفتح · Escape للإغلاق</p>
    </WorkspaceDialog>}
    {dialog === 'help' && <WorkspaceDialog title="اختصارات تساعدك في العمل" onClose={close}>
      <div className="workspace-shortcut-list">
        <div><span>البحث في شاشات البرنامج</span><kbd dir="ltr">Ctrl / ⌘ + K</kbd></div>
        <div><span>دليل الاختصارات</span><kbd>F1</kbd></div>
        <div><span>إغلاق نافذة البحث أو المساعدة</span><kbd>Escape</kbd></div>
        {NAVIGATION_SHORTCUTS.map(shortcut => {
          const page = pages.find(item => item.path === shortcut.path);
          return page ? <div key={shortcut.digit}><span>{page.title}</span><kbd dir="ltr">Alt + {shortcut.digit}</kbd></div> : null;
        })}
      </div>
      <p className="workspace-hint">اختصارات Alt للأرقام تعمل خارج حقول الكتابة. قد يحجز المتصفح أو نظام التشغيل بعض الاختصارات؛ الأزرار متاحة دائمًا.</p>
    </WorkspaceDialog>}
  </>;
}
