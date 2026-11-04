"use client";
import React from 'react';

interface ModernInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function ModernInput({ label, ...props }: ModernInputProps) {
  return (
    <div className="field-group">
      <style jsx>{`
        .field-group { display: flex; flex-direction: column; gap: 8px; width: 100%; }
        .field-group label { color: var(--primary); font-size: var(--fs-md); font-weight: 900; padding-right: 5px; }
        
        .modern-input {
          width: 100%;
          padding: 14px 18px;
          background: var(--input-bg);
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 14px;
          color: var(--primary);
          font-size: var(--fs-lg);
          font-weight: 700;
          outline: none;
          transition: 0.3s;
        }
        
        .modern-input:focus {
          border-color: var(--accent);
          background: var(--white);
          box-shadow: 0 0 0 4px rgba(202, 138, 4, 0.1);
        }
      `}</style>
      
      {label && <label>{label}</label>}
      <input className="modern-input" {...props} />
    </div>
  );
}