"use client";
import React, { useState, useEffect } from 'react';
import { useSidebar } from '@/lib/SidebarContext';

interface RawasiSidebarProps {
  onSearch?: (term: string) => void;
  onDateChange?: (start: string, end: string) => void;
  title?: string;
  extraFilters?: React.ReactNode;
  extraActions?: React.ReactNode;
  summarySlot?: React.ReactNode;
  accentColor?: string;
  textColor?: string;
  logoPath?: string;
  isOpenStatus?: boolean; 
  setIsOpenStatus?: (val: boolean) => void; 
  customFilters?: React.ReactNode;
}

export default function RawasiFilterSidebar({ 
  onSearch, 
  onDateChange, 
  title = "لوحة التحكم", 
  extraFilters,
  extraActions,
  summarySlot,
  accentColor = '#c2410c',
  textColor = '#27272a',
  logoPath = '/company-logo.svg',
  isOpenStatus,
  setIsOpenStatus
}: RawasiSidebarProps) {
  
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [dates, setDates] = useState({ start: '', end: '' });
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isOpen = isMobile ? isPinned : (isPinned || isHovered);

  useEffect(() => {
    setMounted(true);
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { summary, actions, customFilters, searchPlaceholder } = useSidebar();

  // 🚀 إبلاغ الـ Layout بحالة السايد بار عشان يزق المحتوى
  useEffect(() => {
    if (setIsOpenStatus) {
      setIsOpenStatus(isOpen);
    }
  }, [isOpen, setIsOpenStatus]);

  const handleSearch = (val: string) => {
    if (onSearch) onSearch(val);
    window.dispatchEvent(new CustomEvent('globalSearch', { detail: val }));
  };

  const handleDateChange = (start: string, end: string) => {
    if (onDateChange) onDateChange(start, end);
    window.dispatchEvent(new CustomEvent('globalDateFilter', { detail: { start, end } }));
  };

  return (
    <>
      <style>{`
        .filter-sidebar-v3, .filter-sidebar-v3 * {
          box-sizing: border-box;
        }

        .filter-sidebar-v3 {
          position: fixed;
          top: 20px;
          right: ${isOpen ? '20px' : '-320px'};
          bottom: 20px;
          width: 280px;
          background: rgba(25, 20, 15, 0.4);
          border-radius: 24px;
          box-shadow: -10px 15px 40px rgba(0,0,0,0.3);
          z-index: 1000; transition: right 0.5s cubic-bezier(0.165, 0.84, 0.44, 1);
          backdrop-filter: blur(30px); border: 1px solid rgba(255,255,255,0.15);
          border-right: 1px solid rgba(255,255,255,0.05); overflow: hidden;
          color: ${textColor};
          display: flex;
          flex-direction: column;
        }

        .filter-toggle-tab-v3 {
          position: fixed; top: 0; right: 0; bottom: 0; height: 100vh; width: 24px;
          background: rgba(15, 12, 10, 0.4); backdrop-filter: blur(5px);
          color: #fff; padding: 0 4px; border-radius: 0;
          cursor: pointer; z-index: 998; display: flex; align-items: center; justify-content: center;
          box-shadow: -2px 0 10px rgba(0,0,0,0.4); border-left: 1px solid rgba(255,255,255,0.1);
          transition: all 0.3s ease; opacity: ${isOpen ? 0 : 1}; pointer-events: ${isOpen ? 'none' : 'auto'};
        }
        .filter-toggle-tab-v3:hover { background: rgba(15, 12, 10, 0.8); width: 28px; }

        .vertical-text {
          writing-mode: vertical-rl; transform: rotate(180deg); font-weight: 900;
          font-size: 20px; letter-spacing: 6px; color: ${accentColor}; opacity: 0.6;
          text-shadow: 0 2px 10px rgba(0,0,0,0.3); white-space: nowrap;
        }

        .filter-content {
          width: 280px; padding: 25px 20px; opacity: 1;
          display: flex; flex-direction: column; height: 100%; overflow-y: auto; overflow-x: hidden;
        }

        .filter-content::-webkit-scrollbar { width: 4px; }
        .filter-content::-webkit-scrollbar-track { background: transparent; }
        .filter-content::-webkit-scrollbar-thumb { background: ${accentColor}44; border-radius: 10px; }
        .filter-content::-webkit-scrollbar-thumb:hover { background: ${accentColor}88; }

        .sidebar-logo-container {
          text-align: center; margin-bottom: 30px; padding-bottom: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;
        }
        
        .sidebar-logo-img { width: 100px; height: auto; filter: drop-shadow(0 0 10px rgba(0,0,0,0.2)); }

        .action-grid {
          display: flex; flex-direction: column; gap: 8px; margin-bottom: 25px; flex-shrink: 0;
        }

        .filter-section-title {
          font-size: 10px; font-weight: 900; color: ${accentColor};
          margin-bottom: 12px; letter-spacing: 1px; text-transform: uppercase; flex-shrink: 0;
        }

        .filter-input {
          width: 100%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
          border-radius: 10px; padding: 10px; color: white; margin-bottom: 15px; outline: none;
          font-size: 13px; transition: 0.3s;
        }
        .filter-input:focus { border-color: ${accentColor}; background: rgba(255,255,255,0.15); box-shadow: 0 0 15px rgba(194,65,12, 0.2); }

        .pin-btn-sidebar {
          position: absolute; left: 15px; top: 15px; background: ${isPinned ? accentColor : 'rgba(255,255,255,0.1)'};
          border: 1px solid rgba(255,255,255,0.1); width: 32px; height: 32px; border-radius: 8px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: 0.3s; z-index: 1001; backdrop-filter: blur(5px);
        }
        
        /* 🚀 تنسيق التاريخ */
        .date-label { font-size: 10px; color: #94a3b8; display: block; margin-bottom: 5px; }

        @media (max-width: 768px) {
          .filter-sidebar-v3 {
            width: 280px !important;
            right: ${isOpen ? '0' : '-100%'} !important;
            border-left: none !important;
            top: 0 !important;
            height: 100vh !important;
          }
          .filter-content {
            width: 100% !important;
          }
          .filter-toggle-tab-v3 {
            width: 24px !important;
            padding: 0 4px !important;
            top: 0 !important;
            height: 100vh !important;
            border-radius: 0 !important;
          }
          .tab-text { display: none !important; }
          .tab-icon { display: block !important; font-size: 16px; transform: none !important; writing-mode: horizontal-tb !important; }
        }
      `}</style>

      {isMobile && isOpen && (
        <div onClick={() => setIsPinned(false)} className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, backdropFilter: 'blur(3px)' }}></div>
      )}
      
      <aside 
        className="filter-sidebar-v3 no-print"
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => !isMobile && setIsHovered(false)}
      >
        <button className="pin-btn-sidebar" onClick={(e) => { e.stopPropagation(); setIsPinned(!isPinned); }}>
          <span style={{ fontSize: '16px', color: '#fff' }}>
            {isMobile ? '✕' : (isPinned ? '📌' : '📍')}
          </span>
        </button>

        <div className="filter-content">
          <div className="sidebar-logo-container">
            <img src={logoPath} alt="Logo" className="sidebar-logo-img" />
            <h2 style={{ fontSize: '16px', fontWeight: 900, marginTop: '10px', color: accentColor }}>{title}</h2>
          </div>
          
          {(summarySlot || summary) && (
            <div style={{ marginBottom: '25px' }}>
              {summary || summarySlot}
            </div>
          )}
          
          {(extraActions || actions) && (
            <>
              <div className="filter-section-title">⚡ عمليات الصفحة</div>
              <div className="action-grid">
                {actions || extraActions}
              </div>
            </>
          )}

          <div className="filter-section-title">🔍 البحث والفلترة</div>
          <div style={{ flex: 1 }}>
            
            <input 
              type="text" 
              className="filter-input" 
              placeholder={searchPlaceholder || 'ابحث هنا...'}
              onChange={(e) => handleSearch(e.target.value)} 
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ position: 'relative' }}>
                <label className="date-label">من تاريخ</label>
                <input 
                  type="date" 
                  className="filter-input" 
                  style={{ marginBottom: 0 }}
                  onChange={(e) => {
                    const d = { ...dates, start: e.target.value };
                    setDates(d);
                    handleDateChange(d.start, d.end);
                  }} 
                />
              </div>

              <div style={{ position: 'relative' }}>
                <label className="date-label">إلى تاريخ</label>
                <input 
                  type="date" 
                  className="filter-input" 
                  style={{ marginBottom: 0 }}
                  onChange={(e) => {
                    const d = { ...dates, end: e.target.value };
                    setDates(d);
                    handleDateChange(d.start, d.end);
                  }} 
                />
              </div>
            </div>

            {(extraFilters || customFilters) && (
              <div className="animate-fade-in" style={{ marginTop: '20px' }}>
                {extraFilters || customFilters}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'center', opacity: 0.4, fontSize: '10px', marginTop: '20px', paddingBottom: '20px' }}>
            نظام فاي تك الموحد v2.0
          </div>
        </div>
      </aside>

      {/* Toggle Knob (Small handle) for Desktop (Hover) & Mobile (Click) */}
      <div 
        className="filter-toggle-tab-v3 no-print" 
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onClick={() => isMobile && setIsPinned(true)}
      >
          <span className="tab-icon" style={{ fontSize: '16px' }}>
            ⚙️
          </span>
      </div>
    </>
  );
}
