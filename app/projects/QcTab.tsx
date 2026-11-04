import React from 'react';
import { THEME } from '@/lib/theme';
import { StatusBadge } from './SharedUI';
import { Camera } from 'lucide-react';

export default function QcTab({ logic }: { logic: any }) {
  return (
    <div className="glass-card">
      {(!logic.projectDetails.inspections || logic.projectDetails.inspections.length === 0) ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontWeight: 900 }}>
          <div style={{ fontSize: 'var(--fs-display)', marginBottom: '10px' }}><Camera size={34} aria-hidden="true" /></div>
          لا توجد سجلات فحص جودة أو صور مرفوعة لهذا المشروع حتى الآن.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
          {logic.projectDetails.inspections?.map((insp: any) => (
            <div key={insp.id} style={{ border: '1px solid #eee', borderRadius: '16px', overflow: 'hidden', background: 'white' }}>
              <img src={insp.photo} alt={insp.element} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
              <div style={{ padding: '15px' }}>
                <h4 style={{ margin: '0 0 5px 0', color: THEME.coffeeDark, fontWeight: 900 }}>{insp.element}</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', color: '#64748b', marginBottom: '10px', fontWeight: 700 }}>
                  <span>{insp.engineer}</span><span>{insp.date}</span>
                </div>
                <StatusBadge status={insp.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}