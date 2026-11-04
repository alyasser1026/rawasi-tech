"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoadingScreen from '@/components/LoadingScreen';

export default function DetailedAuditPage() {
    const [brokenEntries, setBrokenEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function runAudit() {
            setLoading(true);
            // جلب الرؤوس والأطراف
            const { data: headers } = await supabase.from('journal_headers').select('*');
            const { data: lines } = await supabase.from('journal_lines').select('*');

            const auditResults: any[] = [];

            headers?.forEach(h => {
                const entries = lines?.filter(l => l.header_id === h.id) || [];
                const totalDebit = entries.reduce((sum, l) => sum + Number(l.debit || 0), 0);
                const totalCredit = entries.reduce((sum, l) => sum + Number(l.credit || 0), 0);
                
                if (Math.abs(totalDebit - totalCredit) > 0.01) {
                    auditResults.push({
                        ...h,
                        totalDebit,
                        totalCredit,
                        diff: totalDebit - totalCredit,
                        entries: entries // حفظ الأطراف لعرض الـ IDs بتاعتها
                    });
                }
            });

            setBrokenEntries(auditResults);
            setLoading(false);
        }
        runAudit();
    }, []);

    return (
        <div style={{ padding: '30px', direction: 'rtl', fontFamily: 'Cairo', backgroundColor: '#f9fafb' }}>
            <h1 style={{ color: '#991B1B' }}>كاشف الـ IDs للعمليات المعطوبة</h1>
            <p>الصفحة دي بتعرضلك الـ ID الحقيقي عشان تنسخه وتروح للـ Database</p>

            {loading ? (
                <LoadingScreen message="جاري الفحص..." fullScreen={false} />
            ) : (
                brokenEntries.map((e, i) => (
                    <div key={i} style={{ background: 'white', padding: '20px', borderRadius: '15px', marginBottom: '25px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #f3f4f6', paddingBottom: '10px', marginBottom: '15px' }}>
                            <span style={{ fontWeight: 900, color: '#27272a' }}>التاريخ: {e.entry_date} | {e.description}</span>
                            <span style={{ color: '#991B1B', fontWeight: 900 }}>قيمة العجز: {e.diff.toLocaleString()}</span>
                        </div>
                        
                        <div style={{ marginBottom: '10px', fontSize: '13px' }}>
                            <strong>ID القيد الرئيسي (Header ID):</strong> 
                            <code style={{ background: '#fef2f2', padding: '4px 8px', borderRadius: '5px', marginLeft: '10px', color: '#b91c1c' }}>{e.id}</code>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', textAlign: 'right', fontSize: '12px' }}>
                                    <th style={{ padding: '10px' }}>ID الحساب المرتبط (Account ID)</th>
                                    <th>البيان</th>
                                    <th>مدين</th>
                                    <th>دائن</th>
                                </tr>
                            </thead>
                            <tbody>
                                {e.entries.map((line: any, idx: number) => (
                                    <tr key={idx} style={{ borderTop: '1px solid #f1f5f9', fontSize: '12px' }}>
                                        <td style={{ padding: '10px' }}>
                                            <code style={{ color: '#0369a1', fontWeight: 'bold' }}>{line.account_id}</code>
                                        </td>
                                        <td>{line.item_name}</td>
                                        <td style={{ color: 'green' }}>{line.debit}</td>
                                        <td style={{ color: 'red' }}>{line.credit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))
            )}
        </div>
    );
}