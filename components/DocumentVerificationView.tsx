"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ShieldCheck, 
  Search, 
  QrCode, 
  Camera, 
  Printer, 
  Share2, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  Building2, 
  Calendar, 
  User, 
  CreditCard, 
  FileText, 
  ExternalLink,
  X,
  FileCheck2,
  Copy,
  ArrowRight
} from 'lucide-react';
import { PHITECH_RINGS_PATH, PHITECH_PILLARS_PATH, PHITECH_TIGHT_VIEWBOX } from '@/lib/brand-logo-paths';
import { PHI_COMPANY_CONTACTS } from '@/lib/company-contacts';

export interface VerifiedDocData {
  docType: string;
  docTypeBadge: string;
  docNumber: string;
  referenceNo?: string | null;
  date: string;
  rawDate?: string;
  amount: number;
  taxAmount?: number;
  netAmount?: number;
  currency: string;
  amountInWords: string;
  partyName: string;
  partyRole: string;
  projectName?: string;
  paymentMethod: string;
  description: string;
  status: string;
  isAuthentic: boolean;
  companyName: string;
  securitySeal: string;
  verifiedAt: string;
  allMatchesCount?: number;
}

export default function DocumentVerificationView({ initialDocQuery = '' }: { initialDocQuery?: string }) {
  const searchParams = useSearchParams();
  const paramDoc = searchParams?.get('doc') || searchParams?.get('code') || searchParams?.get('ref') || initialDocQuery;
  const [docQuery, setDocQuery] = useState(paramDoc || '');
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [verifiedData, setVerifiedData] = useState<VerifiedDocData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Camera / Barcode scanner state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Auto-search on mount or URL param change
  useEffect(() => {
    const q = searchParams?.get('doc') || searchParams?.get('code') || searchParams?.get('ref') || initialDocQuery;
    if (q && q.trim()) {
      setDocQuery(q.trim());
      handleSearch(q.trim());
    }
  }, [searchParams, initialDocQuery]);

  const handleSearch = async (queryToSearch?: string) => {
    const q = (queryToSearch !== undefined ? queryToSearch : docQuery).trim();
    if (!q) {
      setErrorMessage('يرجى كتابة رقم المستند أو السند للتحقق');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/verify-document?doc=${encodeURIComponent(q)}`);
      const result = await res.json();

      if (!result.success) {
        setErrorMessage(result.message || 'حدث خطأ أثناء فحص السجلات');
        setVerifiedData(null);
      } else if (result.found && result.data) {
        setVerifiedData(result.data);
        setErrorMessage(null);

        // Update URL query param cleanly without reloading
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          const newUrl = `${window.location.pathname}?doc=${encodeURIComponent(result.data.docNumber)}`;
          window.history.replaceState(null, '', newUrl);
        }
      } else {
        setVerifiedData(null);
        setErrorMessage(result.message || `لم يتم العثور على مستند مسجل بالرقم "${q}"`);
      }
    } catch (err: any) {
      console.error('Verification fetch error:', err);
      setErrorMessage('تعذر الاتصال بخادم التحقق. يرجى التأكد من اتصال الإنترنت والمحاولة مرة أخرى.');
      setVerifiedData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    });
  };

  const handlePrintCertificate = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // Camera Scanning Logic
  const startCameraScan = async () => {
    setCameraError(null);
    setIsCameraOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        detectBarcodeInStream();
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('تعذر فتح الكاميرا. يرجى منح صلاحية الكاميرا للمتصفح أو استخدام البحث اليدوي.');
    }
  };

  const stopCameraScan = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const detectBarcodeInStream = async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectBarcodeInStream);
      return;
    }

    // Try native BarcodeDetector API if available
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix']
        });
        const barcodes = await barcodeDetector.detect(videoRef.current);
        if (barcodes && barcodes.length > 0) {
          const rawVal = barcodes[0].rawValue || '';
          if (rawVal) {
            stopCameraScan();
            // If it's a URL like https://.../verify?doc=PV-2026-0002
            let detectedDoc = rawVal;
            try {
              if (rawVal.includes('doc=')) {
                const u = new URL(rawVal);
                detectedDoc = u.searchParams.get('doc') || detectedDoc;
              }
            } catch {}

            setDocQuery(detectedDoc);
            handleSearch(detectedDoc);
            return;
          }
        }
      } catch (detErr) {
        // Fallback continues loop
      }
    }

    animationFrameRef.current = requestAnimationFrame(detectBarcodeInStream);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await img.decode();

        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13']
        });
        const barcodes = await barcodeDetector.detect(img);
        if (barcodes && barcodes.length > 0) {
          let detectedDoc = barcodes[0].rawValue || '';
          if (detectedDoc.includes('doc=')) {
            try {
              const u = new URL(detectedDoc);
              detectedDoc = u.searchParams.get('doc') || detectedDoc;
            } catch {}
          }
          stopCameraScan();
          setDocQuery(detectedDoc);
          handleSearch(detectedDoc);
          return;
        } else {
          setCameraError('لم يتم العثور على باركود واضح في الصورة المختارة.');
        }
      } catch (err: any) {
        setCameraError('تعذر تحليل صورة الباركود. يرجى كتابة الرقم يدوياً.');
      }
    } else {
      setCameraError('المتصفح الحالي لا يدعم قراءة الباركود من الصور مباشرة. يرجى إدخال الرقم يدوياً.');
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans selection:bg-amber-500 selection:text-black" dir="rtl">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-40 bg-[#090d16]/90 backdrop-blur-md border-b border-amber-500/20 px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Link href="/website" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-700/30 border border-amber-500/40 p-1.5 flex items-center justify-center group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(249,115,22,0.2)]">
              <svg viewBox={PHITECH_TIGHT_VIEWBOX} className="w-full h-full fill-amber-400">
                <path d={PHITECH_RINGS_PATH} />
                <path d={PHITECH_PILLARS_PATH} />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base sm:text-lg tracking-wider text-slate-100">PHI CONSTRUCT</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/30">فاي تك</span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">منظومة التحقق الرقمي من صحة المستندات المالية</p>
            </div>
          </Link>

          <div className="flex items-center gap-2.5">
            <Link 
              href="/website" 
              className="px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-300 hover:text-amber-400 transition-colors flex items-center gap-1.5"
            >
              <span>الموقع الرئيسي</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-4 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>بوابة التحقق والتوثيق الرقمي المعتمدة رسمياً</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-slate-50 mb-3 tracking-tight">
            التحقق من صحة ومطابقة المستندات
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            امسح الباركود أو رمز QR المطبوع على السند أو اكتب رقم المستند يدوياً للتحقق الفوري من صحة الأرقام والمبالغ المعتمدة في سجلات فاي تك.
          </p>
        </div>

        {/* Search & Scan Box */}
        <div className="bg-[#0d131f] border border-amber-500/30 rounded-2xl p-4 sm:p-6 shadow-[0_10px_35px_rgba(0,0,0,0.5)] mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Search className="w-5 h-5 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={docQuery}
                onChange={(e) => setDocQuery(e.target.value)}
                placeholder="اكتب رقم السند أو الفاتورة (مثال: PV-2026-0002 أو RV-2026-0001)..."
                className="w-full bg-[#080b12] border border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-slate-100 placeholder-slate-500 pr-11 pl-10 py-3.5 rounded-xl font-mono text-sm sm:text-base transition-all outline-none"
              />
              {docQuery && (
                <button
                  type="button"
                  onClick={() => setDocQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 sm:flex-initial px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-sm sm:text-base rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)] disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>تحقق الآن</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={startCameraScan}
                className="px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-xl flex items-center gap-2 text-sm font-bold transition-all cursor-pointer"
                title="مسح الباركود باستخدام الكاميرا"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">مسح بالكاميرا</span>
              </button>
            </div>
          </form>

          {/* Quick Examples */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-500">أمثلة سريعة للتجربة:</span>
            <button
              type="button"
              onClick={() => {
                setDocQuery('PV-2026-0002');
                handleSearch('PV-2026-0002');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-amber-500/20 text-amber-300 font-mono transition-colors border border-slate-700"
            >
              PV-2026-0002
            </button>
            <button
              type="button"
              onClick={() => {
                setDocQuery('PV-2026-0003');
                handleSearch('PV-2026-0003');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-amber-500/20 text-amber-300 font-mono transition-colors border border-slate-700"
            >
              PV-2026-0003
            </button>
            <button
              type="button"
              onClick={() => {
                setDocQuery('RV-2026-0001');
                handleSearch('RV-2026-0001');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-amber-500/20 text-amber-300 font-mono transition-colors border border-slate-700"
            >
              RV-2026-0001
            </button>
          </div>
        </div>

        {/* Camera Modal */}
        {isCameraOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0f172a] border border-amber-500/40 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-amber-400" />
                  <span className="font-bold text-slate-200">مسح الباركود بالكاميرا</span>
                </div>
                <button
                  type="button"
                  onClick={stopCameraScan}
                  className="text-slate-400 hover:text-slate-100 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4">
                <div className="relative aspect-square bg-black rounded-xl overflow-hidden flex items-center justify-center">
                  <video
                    ref={videoRef}
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {/* Viewfinder Target */}
                  <div className="absolute inset-8 border-2 border-dashed border-amber-400/80 rounded-xl pointer-events-none flex items-center justify-center">
                    <div className="w-full h-0.5 bg-amber-400/80 animate-pulse shadow-[0_0_10px_#f59e0b]" />
                  </div>
                </div>

                {cameraError && (
                  <p className="mt-3 text-xs text-rose-400 text-center font-medium">
                    {cameraError}
                  </p>
                )}

                <p className="text-xs text-slate-400 text-center mt-3">
                  وجه الكاميرا نحو الباركود أو رمز QR المطبوع على السند.
                </p>

                {/* Upload Image fallback */}
                <div className="mt-4 pt-3 border-t border-slate-800 text-center">
                  <label className="text-xs text-amber-400 hover:text-amber-300 font-bold cursor-pointer inline-flex items-center gap-1.5">
                    <span>أو اختر صورة السند من الهاتف</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results: Verified Card */}
        {verifiedData && (
          <div id="verified-certificate" className="bg-[#0b101c] border-2 border-emerald-500/50 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.15)] mb-8 transition-all">
            {/* Verification Status Header */}
            <div className="bg-gradient-to-r from-emerald-950/80 via-emerald-900/40 to-slate-900 px-6 py-4 border-b border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-emerald-400 text-sm sm:text-base">مستند أصلي موثق ومعتمد</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                      مطابق للسجلات
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    تم التحقق من مطابقة الأرقام والبيانات مع دفتر الأستاذ العام
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono font-bold text-slate-400 bg-slate-900/80 px-3 py-1 rounded-lg border border-slate-700">
                {verifiedData.docNumber}
              </span>
            </div>

            {/* Certificate Body */}
            <div className="p-6 sm:p-8">
              {/* Massive Amount Display */}
              <div className="bg-[#080d17] border border-amber-500/20 rounded-xl p-6 text-center mb-6 relative overflow-hidden">
                <div className="text-xs sm:text-sm font-bold text-amber-400 mb-1">
                  المبلغ المالي المعتمد في السند
                </div>
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-3xl sm:text-5xl font-black text-slate-50 font-mono tracking-tight">
                    {verifiedData.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-lg sm:text-2xl font-black text-amber-400">
                    {verifiedData.currency}
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-slate-300 font-medium bg-amber-500/10 py-1.5 px-4 rounded-lg inline-block border border-amber-500/20">
                  {verifiedData.amountInWords}
                </div>
              </div>

              {/* Document Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-[#080c14] border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>نوع المستند ورقم المرجع:</span>
                  </div>
                  <div className="font-bold text-slate-200 text-sm">
                    {verifiedData.docType}
                  </div>
                  <div className="text-xs font-mono text-amber-400/90 mt-0.5">
                    رقم السند: {verifiedData.docNumber}
                  </div>
                </div>

                <div className="bg-[#080c14] border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <span>تاريخ المستند الرسمي:</span>
                  </div>
                  <div className="font-bold text-slate-200 text-sm font-mono">
                    {verifiedData.date}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    مسجل ومثبت بالسجلات المحاسبية
                  </div>
                </div>

                <div className="bg-[#080c14] border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <User className="w-4 h-4 text-amber-400" />
                    <span>{verifiedData.partyRole}:</span>
                  </div>
                  <div className="font-bold text-slate-200 text-sm">
                    {verifiedData.partyName}
                  </div>
                </div>

                <div className="bg-[#080c14] border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <CreditCard className="w-4 h-4 text-amber-400" />
                    <span>طريقة السداد / الصرف:</span>
                  </div>
                  <div className="font-bold text-slate-200 text-sm">
                    {verifiedData.paymentMethod}
                  </div>
                  <div className="text-xs text-emerald-400 mt-0.5 font-medium">
                    {verifiedData.status}
                  </div>
                </div>
              </div>

              {/* Description & Statement */}
              <div className="bg-[#080c14] border border-slate-800 rounded-xl p-4 mb-6">
                <div className="text-xs text-slate-400 mb-1 font-semibold">
                  البيان المالي المسجل في السند:
                </div>
                <div className="text-sm text-slate-200 leading-relaxed font-medium">
                  {verifiedData.description}
                </div>
              </div>

              {/* Digital Seal & QR Stamp */}
              <div className="bg-gradient-to-r from-amber-500/10 via-[#0a0f1c] to-amber-500/5 border border-amber-500/30 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-right">
                  <div className="w-16 h-16 rounded-xl bg-white p-1.5 flex items-center justify-center shrink-0 shadow-lg">
                    <QRCodeSVG
                      value={typeof window !== 'undefined' ? window.location.href : `https://phi-tech.org/website/verify?doc=${verifiedData.docNumber}`}
                      size={56}
                      level="M"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-amber-400 text-sm">الختم الرقمي المشفر</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">
                        PHI-VERIFIED
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-400 mt-1">
                      {verifiedData.securitySeal}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      الجهة المصدرة: {verifiedData.companyName}
                    </div>
                  </div>
                </div>

                <div className="text-center sm:text-left text-xs text-slate-400 border-t sm:border-t-0 sm:border-r border-slate-800 pt-3 sm:pt-0 sm:pr-4">
                  <div className="text-emerald-400 font-bold mb-0.5">موثق ومعتمد رسمياً</div>
                  <div>بتاريخ: {new Date(verifiedData.verifiedAt).toLocaleDateString('ar-EG')}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {new Date(verifiedData.verifiedAt).toLocaleTimeString('ar-EG')}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap gap-3 justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={handlePrintCertificate}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>طباعة شهادة التوثيق</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-amber-400" />
                  <span>{isCopied ? 'تم نسخ الرابط!' : 'مشاركة الرابط'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVerifiedData(null);
                    setDocQuery('');
                    setHasSearched(false);
                  }}
                  className="px-4 py-2.5 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>فحص مستند آخر</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error / Not Found Message */}
        {errorMessage && (
          <div className="bg-[#181114] border-2 border-rose-500/40 rounded-2xl p-6 sm:p-8 mb-8 text-center shadow-lg">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-rose-300 mb-2">
              تنبيه: لم يتم العثور على المستند
            </h3>
            <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed mb-6">
              {errorMessage}
            </p>

            <div className="bg-[#0b0c10] border border-slate-800 rounded-xl p-4 max-w-md mx-auto text-right text-xs text-slate-400 space-y-2 mb-6">
              <div className="font-bold text-slate-300">إرشادات التحقق السريع:</div>
              <div>• تأكد من كتابة كود السند كاملاً كما هو مطبوع (مثال: <span className="font-mono text-amber-400">PV-2026-0002</span> أو <span className="font-mono text-amber-400">RV-2026-0001</span>).</div>
              <div>• يمكنك أيضاً كتابة أرقام السند فقط (مثال: <span className="font-mono text-amber-400">0002</span>).</div>
              <div>• في حال استلامك إيصالاً غير مسجل، تواصل فوراً مع الإدارة المالية للتأكيد.</div>
            </div>

            <a
              href={`https://wa.me/${PHI_COMPANY_CONTACTS.phone1?.replace(/[^0-9]/g, '') || '201026332733'}?text=${encodeURIComponent(`السلام عليكم، أحتاج التحقق من السند رقم: ${docQuery}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition-colors shadow-lg"
            >
              <span>التواصل مع الإدارة المالية عبر واتساب</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Feature Cards Guide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-right">
          <div className="bg-[#0a0e17] border border-slate-800 rounded-xl p-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="font-bold text-sm text-slate-200 mb-1">مسح الباركود الفوري</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              كاميرا الهاتف الذكي تفتح شهادة التحقق مباشرة بمجرد توجيه الكاميرا نحو رمز QR على أي مستند مطبوع.
            </p>
          </div>

          <div className="bg-[#0a0e17] border border-slate-800 rounded-xl p-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div className="font-bold text-sm text-slate-200 mb-1">مطابقة محاسبية دقيقة</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              يتم جلب الأرقام والبيانات لحظياً من قيود اليومية العامة المعتمدة في النظام لمنع أي تلاعب أو تزوير.
            </p>
          </div>

          <div className="bg-[#0a0e17] border border-slate-800 rounded-xl p-4">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="font-bold text-sm text-slate-200 mb-1">اعتماد فاي تك الرسمي</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              كل مستند موثق يحمل ختماً رقمياً مشفراً وكود أمان إلكتروني يثبت صحته للعملاء والملاك ومقاولي الباطن.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 mt-16 py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 شركة فاي تك للتطوير العقاري والمقاولات العامة (PHI CONSTRUCT) — جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-4">
            <span>هاتف: {PHI_COMPANY_CONTACTS.phone1}</span>
            <span>•</span>
            <span>البريد: {PHI_COMPANY_CONTACTS.email}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
