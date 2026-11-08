"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Building2, Check, ChevronDown, Plus, Settings } from 'lucide-react';
import { useCompany } from '@/lib/CompanyContext';
import styles from './CompanySwitcher.module.css';

export default function CompanySwitcher() {
  const { companies, activeCompany, activeCompanyId, switchCompany } = useCompany();
  const [isOpen, setIsOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const outside = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setIsOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [isOpen]);

  if (!activeCompany) return null;

  return <div className={styles.root} ref={container}>
    <button type="button" ref={trigger} className={styles.trigger}
      onClick={() => setIsOpen(open => !open)}
      title="التبديل بين الشركات والمنشآت" aria-label={`الشركة الحالية: ${activeCompany.name}، تبديل الشركة`}
      aria-expanded={isOpen} aria-controls="company-picker">
      <Building2 size={17} style={{ color: activeCompany.brand_color || '#F97316' }} aria-hidden="true" />
      <span className={styles.identity}><strong>{activeCompany.name}</strong><small>{activeCompany.code} · {activeCompany.currency}</small></span>
      <span className={styles.mobileCode}>{activeCompany.code}</span>
      <ChevronDown size={14} aria-hidden="true" style={{ transform: isOpen ? 'rotate(180deg)' : undefined }} />
    </button>
    {isOpen && <div id="company-picker" className={styles.panel} role="group" aria-label="اختيار الشركة">
      <div className={styles.heading}><strong>اختر الشركة للعمل عليها</strong><small>{companies.length.toLocaleString('en-US')} شركات</small></div>
      <div className={styles.list}>
        {companies.map(company => <button type="button" key={company.id} className={styles.company}
          aria-pressed={company.id === activeCompanyId}
          onClick={() => { setIsOpen(false); void switchCompany(company.id); }}>
          <Building2 size={18} style={{ color: company.brand_color || '#F97316' }} aria-hidden="true" />
          <span className={styles.identity}><strong>{company.name}</strong><small>{company.code} · {company.currency}</small></span>
          {company.id === activeCompanyId && <Check size={17} aria-hidden="true" />}
        </button>)}
      </div>
      <div className={styles.footer}>
        <Link href="/settings/companies" onClick={() => setIsOpen(false)}><Settings size={14} aria-hidden="true" />إدارة الشركات</Link>
        <Link href="/settings/companies?action=new" onClick={() => setIsOpen(false)}><Plus size={14} aria-hidden="true" />شركة جديدة</Link>
      </div>
    </div>}
  </div>;
}
