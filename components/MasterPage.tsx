"use client";

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import EnterprisePageTools from './EnterprisePageTools';
import { getNavigationIcon } from './NavigationIcon';

type MasterPageProps = {
  title: string;
  subtitle?: string;
  description?: string;
  children: ReactNode;
  /** Page-level actions; shown beside the title only when a screen has no toolbar of its own. */
  headerContent?: ReactNode;
  icon?: ReactNode;
  enterprise?: boolean;
  hideTitleOnMobile?: boolean;
};

/** Page heading (title + description) followed by the shared summary/toolbar/filters and the screen content. */
export default function MasterPage({ title, subtitle, description, children, headerContent, icon }: MasterPageProps) {
  const pathname = usePathname();
  const Icon = getNavigationIcon(pathname);

  useEffect(() => {
    if (pathname && pathname !== '/') {
      try { localStorage.setItem('last_visited_route', pathname); } catch {}
    }
  }, [pathname]);

  return <section className="enterprise-page">
    <header className="ent-page-heading">
      <div><div className="ent-title-line">{icon && typeof icon !== 'string' ? icon : <Icon aria-hidden="true"/>}<h1>{title}</h1></div><p>{subtitle || description || 'نظام فاي تك لإدارة الموارد المؤسسية'}</p></div>
      {headerContent && <div className="ent-heading-actions no-print">{headerContent}</div>}
    </header>
    <EnterprisePageTools key={pathname}/>
    {children}
  </section>;
}
