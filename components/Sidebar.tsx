"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const menuItems = [
    { name: 'الرئيسية', icon: '🏠', path: '/' },
    { name: 'قيود اليومية', icon: '📖', path: '/journal' },
    { name: 'سلف العمال', icon: '💸', path: '/emp_adv' },
    { name: 'المصروفات', icon: '📉', path: '/expenses' },
    { name: 'مركز العمليات', icon: '🛡️', path: '/journal-errors' },
    { name: 'إعدادات النظام', icon: '⚙️', path: '/settings' },
  ];

  return (
    <aside style={{
      width: isCollapsed ? '5rem' : '16.25rem',
      height: '100vh',
      background: 'var(--surface-sidebar, linear-gradient(180deg, #151921 0%, #0f1218 60%, #090b0f 100%))',
      color: 'var(--text-primary, #f8fafc)',
      transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      right: 0,
      top: 0,
      zIndex: 1000,
      boxShadow: 'var(--shadow-elevation, -6px 0 30px rgba(0,0,0,0.8))',
      direction: 'rtl',
      border: 'none',
      overflow: 'hidden'
    }}>
      {/* اللوجو وزر التصغير */}
      <div style={{ padding: '1.5rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {!isCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-main, #f97316)', boxShadow: '0 0 10px var(--accent-glow)' }}></span>
            <span style={{ fontWeight: 900, fontSize: 'var(--fs-xl)', color: 'var(--text-primary, #ffffff)' }}>
              رواد المحاسبي <span style={{ color: 'var(--accent-bright, #fb923c)', fontSize: 'var(--fs-xs)' }}>ERP</span>
            </span>
          </div>
        )}
        <button onClick={() => setIsCollapsed(!isCollapsed)} style={{ background: 'var(--surface-sunken, rgba(0,0,0,0.3))', border: 'none', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer', fontSize: 'var(--fs-md)', borderRadius: '10px', width: '2rem', height: '2rem', display: 'grid', placeItems: 'center' }} aria-label="طي القائمة">
          {isCollapsed ? '➡️' : '⬅️'}
        </button>
      </div>

      {/* الروابط */}
      <nav style={{ flex: 1, padding: '1.25rem 0.625rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', overflowY: 'auto' }}>
        {menuItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link key={item.path} href={item.path} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.875rem',
              padding: '0.75rem 1rem',
              borderRadius: '16px',
              textDecoration: 'none',
              color: isActive ? '#ffffff' : 'var(--text-secondary, #94a3b8)',
              background: isActive ? 'var(--accent-gradient, linear-gradient(180deg, #fb923c 0%, #f97316 55%, #d9460f 100%))' : 'transparent',
              boxShadow: isActive ? '0 10px 24px -4px var(--accent-glow, rgba(249, 115, 22, 0.35))' : 'none',
              fontWeight: isActive ? 800 : 600,
              fontSize: 'var(--fs-sm)',
              transition: 'all 0.25s ease',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              position: 'relative'
            }}>
              <span style={{ fontSize: 'var(--fs-lg)' }}>{item.icon}</span>
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* فوتر السايد بار */}
      {!isCollapsed && (
        <div style={{ padding: '1.125rem', background: 'var(--surface-sunken, rgba(0,0,0,0.35))', fontSize: 'var(--fs-xs)', textAlign: 'center', color: 'var(--text-muted, #64748b)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          نظام جلوسي متدرج بدون إطارات ✨
        </div>
      )}
    </aside>
  );
}
