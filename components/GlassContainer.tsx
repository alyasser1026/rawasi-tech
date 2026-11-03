import React from 'react';
import { getGlassStyle } from '@/lib/theme';

// 🚀 السر كله في السطر ده: ضفنا style?: React.CSSProperties
export default function GlassContainer({ children, style }: { children: React.ReactNode, style?: React.CSSProperties }) {
  return (
    <div style={{
      ...getGlassStyle(),
      padding: '20px',
      ...style // 👈 السطر ده اللي بياخد الـ style اللي إنت بتبعته من بره ويطبقه
    }}>
      {children}
    </div>
  );
}
