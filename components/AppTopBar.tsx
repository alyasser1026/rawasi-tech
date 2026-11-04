"use client";
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Bell, ChevronLeft, Keyboard, Menu, MessageSquare, Search, Zap } from 'lucide-react';
import { menuGroups } from '@/lib/menuData';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { usePerformancePreferences } from './PerformancePreferences';
import NotificationsModal from './NotificationsModal';
import ThemeSwitcher from './ThemeSwitcher';

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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const title = pageTitle(pathname);

  return <>
    <header className="ent-topbar no-print">
      <div className="ent-topbar-start">
        <button type="button" className="ent-icon-button ent-topbar-menu" onClick={onOpenMenu} aria-label="فتح قائمة الشاشات"><Menu size={20} /></button>
        <Link href="/" className="ent-topbar-logo" aria-label="فاي تك — الرئيسية"><img src="/company-logo.svg" alt="فاي تك" /></Link>
        <nav className="ent-topbar-crumbs" aria-label="مسار الصفحة">
          <Link href="/">مساحة العمل</Link>
          {title && pathname !== '/' && <><ChevronLeft size={14} aria-hidden="true" /><span aria-current="page">{title}</span></>}
        </nav>
      </div>
      <div className="ent-topbar-end">
        <button type="button" className="ent-topbar-search" onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))} aria-label="البحث في الشاشات (Ctrl K)">
          <Search size={15} aria-hidden="true" /><span>بحث في الشاشات</span><kbd dir="ltr">Ctrl K</kbd>
        </button>
        <ThemeSwitcher />
        <button type="button" className="ent-icon-button ent-topbar-zap" onClick={toggle} disabled={!ready} aria-pressed={fastMode}
          aria-label={fastMode ? 'إيقاف وضع الأداء السريع' : 'تشغيل وضع الأداء السريع'} title={fastMode ? 'وضع الأداء السريع مفعّل' : 'وضع الأداء السريع: تقليل الحركات والظلال'}>
          <Zap size={17} />
        </button>
        <button type="button" className="ent-icon-button ent-topbar-optional" onClick={() => window.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT))} aria-label="اختصارات لوحة المفاتيح (F1)" title="الاختصارات (F1)"><Keyboard size={17} /></button>
        <span className="ent-topbar-divider" aria-hidden="true" />
        <button type="button" className="ent-icon-button" onClick={() => router.back()} aria-label="رجوع للصفحة السابقة" title="رجوع"><ArrowRight size={17} /></button>
        <button type="button" className="ent-icon-button ent-topbar-optional" onClick={() => router.forward()} aria-label="تقدم للصفحة التالية" title="تقدم"><ArrowLeft size={17} /></button>
        <span className="ent-topbar-divider" aria-hidden="true" />
        <Link href="/messages" className="ent-icon-button" aria-label={`الرسائل${unread_messages ? `: ${unread_messages} غير مقروءة` : ''}`} title="الرسائل">
          <MessageSquare size={17} />{unread_messages > 0 && <span className="ent-notification-dot" />}
        </Link>
        <button type="button" className="ent-icon-button" onClick={() => setNotificationsOpen(true)} aria-label={`الإشعارات${unread_notifications ? `: ${unread_notifications} غير مقروءة` : ''}`} title="الإشعارات">
          <Bell size={17} />{unread_notifications > 0 && <span className="ent-notification-dot" />}
        </button>
      </div>
    </header>
    {/* Mounted only while open: the modal loads (and marks read) notifications and opens a realtime channel. */}
    {notificationsOpen && <NotificationsModal isOpen onClose={() => setNotificationsOpen(false)} />}
  </>;
}
