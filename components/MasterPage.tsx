"use client";

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, ChevronLeft, ArrowRight, MessageSquare } from 'lucide-react';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import NotificationsModal from './NotificationsModal';
import EnterprisePageTools from './EnterprisePageTools';
import { getNavigationIcon } from './NavigationIcon';

type MasterPageProps = {
  title: string;
  subtitle?: string;
  description?: string;
  children: ReactNode;
  headerContent?: ReactNode;
  icon?: ReactNode;
  enterprise?: boolean;
  hideTitleOnMobile?: boolean;
};

export default function MasterPage({ title, subtitle, description, children, headerContent, icon }: MasterPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { unread_messages, unread_notifications } = useUnreadCounts();
  const Icon = getNavigationIcon(pathname);

  useEffect(() => {
    if (pathname && pathname !== '/') {
      try { localStorage.setItem('last_visited_route', pathname); } catch {}
    }
  }, [pathname]);

  return <section className="enterprise-page">
    <div className="ent-breadcrumb no-print"><Link href="/">مساحة العمل</Link><ChevronLeft size={14} aria-hidden="true"/><span>{title}</span></div>
    <header className="ent-page-heading">
      <div><div className="ent-title-line">{icon && typeof icon !== 'string' ? icon : <Icon aria-hidden="true"/>}<h1>{title}</h1></div><p>{subtitle || description || 'نظام فاي تك لإدارة الموارد المؤسسية'}</p></div>
      <div className="ent-heading-actions no-print">
        {headerContent}
        <button type="button" className="ent-icon-button ent-history-back" onClick={() => router.back()} aria-label="رجوع للخلف"><ArrowRight size={18}/></button>
        <Link href="/messages" className="ent-icon-button" aria-label={`الرسائل${unread_messages ? `: ${unread_messages} غير مقروءة` : ''}`}><MessageSquare size={18}/>{unread_messages > 0 && <span className="ent-notification-dot"/>}</Link>
        <button type="button" className="ent-icon-button" onClick={() => setIsNotificationsOpen(true)} aria-label={`الإشعارات${unread_notifications ? `: ${unread_notifications} غير مقروءة` : ''}`}><Bell size={19}/>{unread_notifications > 0 && <span className="ent-notification-dot"/>}</button>
      </div>
    </header>
    <EnterprisePageTools key={pathname}/>
    {children}
    <NotificationsModal isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)}/>
  </section>;
}
