"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { THEME } from '@/lib/theme';

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
    <div style={{
      width: isCollapsed ? '80px' : '260px',
      height: '100vh',
      background: '#1e293b', // Slate Dark - نفس روح السيستم
      color: 'white',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      right: 0,
      top: 0,
      zIndex: 1000,
      boxShadow: '-4px 0 15px rgba(0,0,0,0.1)',
      direction: 'rtl'
    }}>
      {/* اللوجو وزر التصغير */}
      <div style={{ padding: '25px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {!isCollapsed && <span style={{ fontWeight: 900, fontSize: 'var(--fs-xl)', color: '#fbbf24' }}>رواد المحاسبي</span>}
        <button onClick={() => setIsCollapsed(!isCollapsed)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 'var(--fs-xl)' }}>
          {isCollapsed ? '➡️' : '⬅️'}
        </button>
      </div>

      {/* الروابط */}
      <nav style={{ flex: 1, padding: '20px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {menuItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link key={item.path} href={item.path} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
              padding: '12px 15px',
              borderRadius: '12px',
              textDecoration: 'none',
              color: isActive ? '#1e293b' : 'white',
              background: isActive ? '#fbbf24' : 'transparent',
              fontWeight: isActive ? 900 : 500,
              transition: '0.2s',
              overflow: 'hidden',
              whiteSpace: 'nowrap'
            }}>
              <span style={{ fontSize: 'var(--fs-xl)' }}>{item.icon}</span>
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* فوتر السايد بار */}
      {!isCollapsed && (
        <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', fontSize: 'var(--fs-sm)', textAlign: 'center', color: '#94a3b8' }}>
          نسخة v2.0.1 🚀
        </div>
      )}
    </div>
  );
}