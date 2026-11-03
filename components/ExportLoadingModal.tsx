"use client";
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

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
        <div className="live-preview-overlay">
            
            <div className="live-preview-header">
                <div className="pulse-icon">🖨️</div>
                <h2>نظام فاي تك الماسي</h2>
                <p className="progress-text">{progressText || 'جاري تهيئة محرك الطباعة...'}</p>
                
                <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${percentage}%` }}></div>
                </div>
                <small className="warning">⚠️ يرجى عدم إغلاق النافذة حتى يتم تنزيل جميع الملفات</small>
            </div>

            {/* 🎯 هذه هي الحاوية السحرية: المتصفح مجبر على رسم الـ HTML هنا لتصويره */}
            <div className="live-preview-workspace">
                <div id="pdf-render-mount-point" className="a4-render-area">
                    {/* محرك اللوجيك سيقوم بحقن الـ HTML هنا ورؤيته لايف */}
                </div>
            </div>

            <style>{`
                .live-preview-overlay {
                    position: fixed; inset: 0; background: rgba(20, 15, 12, 0.95); backdrop-filter: blur(10px);
                    z-index: 9999999; display: flex; flex-direction: column; align-items: center; 
                    padding: 30px 20px; overflow-y: auto; direction: rtl; font-family: Tahoma, sans-serif;
                }
                .live-preview-header {
                    text-align: center; margin-bottom: 30px; width: 100%; max-width: 600px;
                }
                .pulse-icon { font-size: 50px; animation: pulse 1.5s infinite; margin-bottom: 10px; }
                @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
                
                .live-preview-header h2 { color: #c2410c; margin: 0 0 10px 0; font-size: 24px; font-weight: 900; }
                .progress-text { color: #0ea5e9; font-size: 16px; font-weight: bold; background: rgba(14, 165, 233, 0.1); padding: 10px 20px; border-radius: 8px; border: 1px dashed rgba(14, 165, 233, 0.3); display: inline-block; margin: 0; }
                
                .progress-bar-container { width: 100%; height: 10px; background: rgba(255,255,255,0.1); border-radius: 10px; margin: 15px 0; overflow: hidden; }
                .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #c2410c, #fde08b); transition: width 0.3s ease; }
                
                .warning { color: #8a7a6b; font-size: 13px; font-weight: bold; }

                /* مساحة العمل التي سيرسم فيها الكشف (محاكاة شكل البرنامج) */
                .live-preview-workspace {
                    background: #eaddcf; padding: 20px; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);
                    width: 840px; max-width: 100%; overflow-x: auto; border: 2px solid rgba(194,65,12, 0.3);
                }
                .a4-render-area {
                    width: 800px; min-height: 1123px; background: white; margin: 0 auto; box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                }
            `}</style>
        </div>
    );

    return createPortal(modalContent, document.body);
}