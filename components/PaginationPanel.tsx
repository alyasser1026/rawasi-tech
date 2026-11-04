"use client";
import React from 'react';

export default function PaginationPanel({ totalItems, currentPage, rowsPerPage, onPageChange, onRowsChange }: any) {
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  if (totalPages <= 1) return null;

  return (
    <div style={{ 
      display: 'flex', alignItems: 'center', gap: '20px', 
      background: 'white', padding: '10px 25px', borderRadius: '15px',
      border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' 
    }}>
      <div style={{ display: 'flex', gap: '5px' }}>
        <button 
          disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}
          className="icon-btn hover-scale"
          style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
        >
          السابق
        </button>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 15px', fontWeight: 800, color: '#475569', fontSize: 'var(--fs-md)' }}>
          صفحة {currentPage} من {totalPages}
        </div>
        <button 
          disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}
          className="icon-btn hover-scale"
          style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
        >
          التالي
        </button>
      </div>
      <div style={{ height: '20px', width: '1px', background: '#e2e8f0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: '#64748b' }}>عرض:</span>
        <select 
          value={rowsPerPage} onChange={(e) => onRowsChange(Number(e.target.value))}
          style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px 8px', fontWeight: 800, color: '#1e293b', outline: 'none' }}
        >
          {[10, 20, 50, 100].map(val => <option key={val} value={val}>{val}</option>)}
        </select>
      </div>
    </div>
  );
}