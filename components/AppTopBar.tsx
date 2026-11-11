"use client";
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Bell, ChevronLeft, Keyboard, Menu, MessageSquare, Search, Zap } from 'lucide-react';
import { menuGroups } from '@/lib/menuData';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { useAuditPendingCounts } from '@/hooks/useAuditPendingCounts';
import { usePerformancePreferences } from './PerformancePreferences';
import AuditPendingCenter from './AuditPendingCenter';
import ThemeSwitcher from './ThemeSwitcher';
import CompanyLogo from './CompanyLogo';
import CompanySwitcher from './CompanySwitcher';
import OfflineSyncStatus from './OfflineSyncStatus';
import UiScaleControl from './UiScaleControl';

export const OPEN_SEARCH_EVENT = 'phi:open-search';
export const OPEN_SHORTCUTS_EVENT = 'phi:open-shortcuts';

function pageTitle(pathname: string) {
  const match = menuGroups.flatMap(group => group.items)
    .filter(item => item.path === pathname || (item.path !== '/' && pathname.startsWith(`${item.path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.title;
}

/** The single sticky bar above every screen: location, search, display mode, history and inbox. */
export default function AppTopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { fastMode, ready, toggle } = usePerformancePreferences();
  const { unread_messages, unread_notifications } = useUnreadCounts();
  const { counts: auditCounts } = useAuditPendingCounts();
  const [auditCenterOpen, setAuditCenterOpen] = useState(false);
  const title = pageTitle(pathname);
  const hasNotificationsOrPending = unread_notifications > 0 || auditCounts.totalPending > 0;

  return <>
    <header className="ent-topbar no-print">
      <div className="ent-topbar-start">
        <button type="button" className="ent-icon-button ent-topbar-menu" onClick={onOpenMenu} aria-label="فتح قائمة الشاشات"><Menu size={20} /></button>
        <Link href="/" className="ent-topbar-logo" aria-label="فاي تك — الرئيسية"><CompanyLogo /></Link>
        <CompanySwitcher />
        <nav className="ent-topbar-crumbs" aria-label="مسار الصفحة">
          <Link href="/">مساحة العمل</Link>
          {title && pathname !== '/' && <><ChevronLeft size={14} aria-hidden="true" /><span aria-current="page">{title}</span></>}
        </nav>
      </div>
      <div className="ent-topbar-end">
        <OfflineSyncStatus />
        <button type="button" className="ent-topbar-search" onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))} aria-label="البحث في الشاشات (Ctrl K)">
          <Search size={15} aria-hidden="true" /><span>بحث في الشاشات</span><kbd dir="ltr">Ctrl K</kbd>
        </button>
        <UiScaleControl />
        <div className="ent-topbar-theme"><ThemeSwitcher /></div>
        <button type="button" className="ent-icon-button ent-topbar-zap" onClick={toggle} disabled={!ready} aria-pressed={fastMode}
          aria-label={fastMode ? 'إيقاف وضع الأداء السريع' : 'تشغيل وضع الأداء السريع'} title={fastMode ? 'وضع الأداء السريع مفعّل' : 'وضع الأداء السريع: تقليل الحركات والظلال'}>
          <Zap size={17} />
        </button>
        <button type="button" className="ent-icon-button ent-topbar-optional" onClick={() => window.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT))} aria-label="اختصارات لوحة المفاتيح (F1)" title="الاختصارات (F1)"><Keyboard size={17} /></button>
        <span className="ent-topbar-divider" aria-hidden="true" />
        <button type="button" className="ent-icon-button ent-topbar-back" onClick={() => router.back()} aria-label="رجوع للصفحة السابقة" title="رجوع"><ArrowRight size={17} /></button>
        <button type="button" className="ent-icon-button ent-topbar-optional" onClick={() => router.forward()} aria-label="تقدم للصفحة التالية" title="تقدم"><ArrowLeft size={17} /></button>
        <span className="ent-topbar-divider" aria-hidden="true" />
        <Link href="/messages" className="ent-icon-button ent-topbar-messages" aria-label={`الرسائل${unread_messages ? `: ${unread_messages} غير مقروءة` : ''}`} title="الرسائل">
          <MessageSquare size={17} />{unread_messages > 0 && <span className="ent-notification-dot" />}
        </Link>
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            type="button"
            className="ent-icon-button ent-topbar-bell"
            onClick={() => setAuditCenterOpen(open => !open)}
            aria-label={`مركز التدقيق والمعلقات${auditCounts.totalPending ? `: ${auditCounts.totalPending} معلق` : ''}${unread_notifications ? `، ${unread_notifications} إشعار` : ''}`}
            title="مركز التدقيق والمعلقات"
            aria-expanded={auditCenterOpen}
          >
            <Bell size={17} />{hasNotificationsOrPending && <span className="ent-notification-dot" />}
          </button>
          {auditCenterOpen && <AuditPendingCenter isOpen={auditCenterOpen} onClose={() => setAuditCenterOpen(false)} />}
        </div>
      </div>
    </header>
  </>;
}
