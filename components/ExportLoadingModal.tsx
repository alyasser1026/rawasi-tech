"use client";
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';

interface ExportLoadingModalProps {
    isOpen: boolean;
    progressText: string;
}

export default function ExportLoadingModal({ isOpen, progressText }: ExportLoadingModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // استخراج نسبة التقدم من النص لتحريك الشريط
    let percentage = 100;
    if (progressText) {
        const match = progressText.match(/\((\d+)\s*من\s*(\d+)\)/);
        if (match && Number(match[2]) > 0) {
            percentage = (Number(match[1]) / Number(match[2])) * 100;
        } else if (progressText.includes("سحب")) {
            percentage = 10;
        }
    }

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div className="live-preview-overlay phi-export-preview">
            
            <div className="live-preview-header">
                <div className="pulse-icon"><Printer size={28} /></div>
                <h2>تجهيز المستندات</h2>
                <p className="progress-text" role="status">{progressText || 'جاري تهيئة محرك الطباعة...'}</p>
                
                <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${percentage}%` }}></div>
                </div>
                <small className="warning">يرجى عدم إغلاق النافذة حتى يتم تنزيل جميع الملفات</small>
            </div>

            {/* 🎯 هذه هي الحاوية السحرية: المتصفح مجبر على رسم الـ HTML هنا لتصويره */}
            <div className="live-preview-workspace">
                <div id="pdf-render-mount-point" className="a4-render-area">
                    {/* محرك اللوجيك سيقوم بحقن الـ HTML هنا ورؤيته لايف */}
                </div>
            </div>

            <style>{`
                .live-preview-overlay {
                    position: fixed; inset: 0; background: #f6f7f9;
                    z-index: 9999999; display: flex; flex-direction: column; align-items: center; 
                    padding: 30px 20px; overflow-y: auto; direction: rtl; font-family: inherit;
                }
                .live-preview-header {
                    text-align: center; margin-bottom: 24px; width: 100%; max-width: 600px;
                }
                .phi-export-preview .pulse-icon { display: grid; place-items: center; width: 58px; height: 58px; border-radius: 15px; color: #c2410c; background: linear-gradient(150deg,#fff7ed,#ffedd5); border: 1px solid #fed7aa; margin: 0 auto 15px; box-shadow: inset 0 1px 0 white,0 2px 4px #9a341208; }
                
                .phi-export-preview .live-preview-header h2 { color: #202329; margin: 0 0 10px 0; font-size: 22px; font-weight: 800; }
                .phi-export-preview .progress-text { color: #526071; font-size: 13px; font-weight: 500; line-height: 1.8; display: block; margin: 0; }
                
                .phi-export-preview .progress-bar-container { width: 100%; height: 7px; background: #e6e8ec; border-radius: 10px; margin: 15px 0; overflow: hidden; }
                .phi-export-preview .progress-bar-fill { height: 100%; background: linear-gradient(135deg, #c2410c, #fb923c); transition: width 0.3s ease; }
                
                .phi-export-preview .warning { color: #687180; font-size: 11px; }

                /* مساحة العمل التي سيرسم فيها الكشف (محاكاة شكل البرنامج) */
                .live-preview-workspace {
                    background: linear-gradient(150deg,#fff,#fafbfd); padding: 20px; border-radius: 13px;
                    box-shadow: inset 0 1px 0 white,0 2px 5px #25344a08,0 12px 36px -8px #25344a18;
                    width: 840px; max-width: 100%; overflow-x: auto; border: 1px solid #e0e4ea;
                }
                .a4-render-area {
                    width: 800px; min-height: 1123px; background: white; margin: 0 auto; box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                }
                @media(prefers-reduced-motion:reduce) { .phi-export-preview .progress-bar-fill { transition:none; } }
                @media print { .phi-export-preview { display:none !important; } }
            `}</style>
        </div>
    );

    return createPortal(modalContent, document.body);
}
