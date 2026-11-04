"use client";
import React from 'react';
import { QRCodeSVG } from 'qrcode.react'; 

// تم إضافة الثيم عشان الكود ميضربش لو مش متعرف في الملف ده
const THEME = {
  primary: '#0f172a', accent: '#c2410c', success: '#059669', slate: '#f8fafc', text: '#111827', border: '#cbd5e1', ruby: '#e11d48'
};

export default function ZatcaQRCode({ record }: { record: any }) {
  if (!record) return null;

  if (record.is_internal || record.skip_zatca) {
     return (
        <div style={{ padding: '0.25rem', border: `2px solid ${THEME.ruby}`, borderRadius: '8px', background: 'white', display: 'inline-block' }}>
           <QRCodeSVG value={`INTERNAL-INV-${record.invoice_number}`} size={90} level="H" imageSettings={{ src: "/phitech-symbol.svg", height: 20, width: 20, excavate: true }} />
        </div>
     );
  }

  // تظبيط التاريخ عشان لو الفاتورة قديمة أو جديدة يقراها صح
  const timestamp = record.date ? `${record.date.split('T')[0]}T12:00:00Z` : new Date().toISOString().split('.')[0] + 'Z';
  
  const generateQR = (s:string, v:string, t:string, it:string, vt:string) => {
    const getB = (tag:number, val:string) => {
      const enc = new TextEncoder(); const b = Array.from(enc.encode(val));
      return [tag, b.length, ...b];
    };
    const tlvs = [...getB(1, s), ...getB(2, v), ...getB(3, t), ...getB(4, it), ...getB(5, vt)];
    return btoa(String.fromCharCode(...new Uint8Array(tlvs)));
  };

  // 🚀 القفشة هنا: استخدمنا total_amount بدلاً من net_amount عشان يقرا من الداتابيز صح
  const invoiceTotal = Number(record.total_amount || 0).toFixed(2);
  const taxTotal = Number(record.tax_amount || 0).toFixed(2);

  return (
    <div style={{ padding: '0.25rem', border: `2px solid ${THEME.primary}`, borderRadius: '8px', background: 'white', display: 'inline-block' }}>
      <QRCodeSVG 
        value={generateQR("شركة فاي تك", "312487477800003", timestamp, invoiceTotal, taxTotal)}
        size={90} 
        level="H" 
        imageSettings={{ src: "/phitech-symbol.svg", height: 20, width: 20, excavate: true }}
      />
    </div>
  );
}
