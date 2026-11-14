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
  ArrowRight,
  Sparkles
} from 'lucide-react';
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

const VERIFY_STYLES = `
/* ==========================================================================
   PHI CONSTRUCT — SELF-CONTAINED VERIFICATION PORTAL STYLES
   ========================================================================== */
.pv-root {
  min-height: 100vh;
  background-color: #07090e;
  background-image: radial-gradient(circle at 50% 0%, #151a27 0%, #07090e 75%);
  color: #f1f5f9;
  font-family: 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  direction: rtl;
  text-align: right;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}
.pv-root * {
  box-sizing: border-box;
}

/* Navbar */
.pv-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(8, 11, 18, 0.94);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(245, 158, 11, 0.22);
  padding: 12px 20px;
}
.pv-nav-inner {
  max-width: 980px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.pv-brand-link {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: #f8fafc;
}
.pv-logo-mark {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(199, 85, 23, 0.35) 100%);
  border: 1px solid rgba(245, 158, 11, 0.4);
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.15);
}
.pv-brand-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pv-brand-title strong {
  font-size: 1.05rem;
  font-weight: 900;
  letter-spacing: 0.05em;
  color: #f8fafc;
}
.pv-brand-badge {
  font-size: 0.7rem;
  font-weight: 800;
  background: rgba(245, 158, 11, 0.18);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.35);
  padding: 2px 7px;
  border-radius: 6px;
}
.pv-brand-sub {
  font-size: 0.72rem;
  color: #94a3b8;
  margin: 0;
}
.pv-nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pv-nav-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #cbd5e1;
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 8px;
  transition: all 0.2s;
}
.pv-nav-link:hover {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.08);
}

/* Main Container */
.pv-main {
  max-width: 860px;
  margin: 0 auto;
  padding: 36px 18px 60px;
}
.pv-hero {
  text-align: center;
  margin-bottom: 30px;
}
.pv-pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.35);
  color: #34d399;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 6px 14px;
  border-radius: 999px;
  margin-bottom: 14px;
  box-shadow: 0 0 25px rgba(16, 185, 129, 0.15);
}
.pv-hero-title {
  font-size: clamp(1.6rem, 3.2vw, 2.3rem);
  font-weight: 900;
  color: #ffffff;
  margin: 0 0 10px;
  line-height: 1.25;
}
.pv-hero-desc {
  font-size: clamp(0.88rem, 1.3vw, 0.98rem);
  color: #94a3b8;
  max-width: 620px;
  margin: 0 auto;
  line-height: 1.65;
}

/* Search Box */
.pv-search-card {
  background: linear-gradient(180deg, #0e1422 0%, #090e18 100%);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.03);
  margin-bottom: 28px;
  position: relative;
  overflow: hidden;
}
.pv-search-glow {
  position: absolute;
  top: -60px;
  right: -60px;
  width: 180px;
  height: 180px;
  background: radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%);
  pointer-events: none;
}
.pv-form {
  display: flex;
  gap: 12px;
  flex-direction: column;
}
@media (min-width: 640px) {
  .pv-form {
    flex-direction: row;
  }
}
.pv-input-wrap {
  position: relative;
  flex: 1;
}
.pv-input-icon {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pv-input {
  width: 100%;
  background: #04070d;
  border: 1.5px solid #263347;
  color: #ffffff;
  font-family: inherit;
  font-size: 1rem;
  padding: 13px 44px 13px 38px;
  border-radius: 12px;
  outline: none;
  transition: all 0.2s;
}
.pv-input:focus {
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
}
.pv-input::placeholder {
  color: #64748b;
  font-size: 0.88rem;
}
.pv-clear-btn {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pv-clear-btn:hover {
  color: #ffffff;
}
.pv-form-actions {
  display: flex;
  gap: 10px;
}
.pv-btn-search {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #0b0906;
  font-family: inherit;
  font-weight: 800;
  font-size: 0.95rem;
  padding: 0 24px;
  min-height: 48px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 6px 20px -4px rgba(245, 158, 11, 0.45);
  white-space: nowrap;
}
.pv-btn-search:hover:not(:disabled) {
  background: linear-gradient(135deg, #fbbf24 0%, #ea580c 100%);
  transform: translateY(-1px);
}
.pv-btn-search:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.pv-btn-camera {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #141c2c;
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #fbbf24;
  font-family: inherit;
  font-weight: 700;
  font-size: 0.88rem;
  padding: 0 16px;
  min-height: 48px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.pv-btn-camera:hover {
  background: #1a253a;
  border-color: #f59e0b;
}

/* Quick samples */
.pv-examples {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  color: #94a3b8;
}
.pv-sample-chip {
  background: #121826;
  border: 1px solid #263347;
  color: #fbbf24;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.18s;
}
.pv-sample-chip:hover {
  background: rgba(245, 158, 11, 0.15);
  border-color: #f59e0b;
  color: #ffffff;
}

/* Verified Certificate Card */
.pv-cert {
  background: linear-gradient(180deg, #0c1322 0%, #080c16 100%);
  border: 2px solid rgba(16, 185, 129, 0.55);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.65), 0 0 40px rgba(16, 185, 129, 0.12);
  margin-bottom: 30px;
  animation: pvFadeIn 0.3s ease-out;
}
@keyframes pvFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.pv-cert-header {
  background: linear-gradient(90deg, rgba(6, 78, 59, 0.5) 0%, rgba(15, 23, 42, 0.8) 100%);
  padding: 16px 22px;
  border-bottom: 1px solid rgba(16, 185, 129, 0.3);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.pv-cert-status-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pv-cert-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(16, 185, 129, 0.18);
  border: 1px solid rgba(16, 185, 129, 0.45);
  color: #34d399;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.25);
}
.pv-cert-title-wrap strong {
  display: block;
  font-size: 1rem;
  font-weight: 900;
  color: #34d399;
  line-height: 1.3;
}
.pv-cert-title-wrap p {
  margin: 2px 0 0;
  font-size: 0.75rem;
  color: #94a3b8;
}
.pv-doc-num-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.82rem;
  font-weight: 800;
  color: #fbbf24;
  background: #060a12;
  border: 1px solid rgba(245, 158, 11, 0.4);
  padding: 6px 12px;
  border-radius: 10px;
}
.pv-cert-body {
  padding: 24px;
}
@media (min-width: 640px) {
  .pv-cert-body {
    padding: 30px;
  }
}

/* Amount Display Box */
.pv-amount-card {
  background: #040812;
  border: 1.5px solid rgba(245, 158, 11, 0.28);
  border-radius: 16px;
  padding: 22px;
  text-align: center;
  margin-bottom: 22px;
  box-shadow: inset 0 2px 8px rgba(0,0,0,0.6);
}
.pv-amount-label {
  font-size: 0.8rem;
  font-weight: 800;
  color: #fbbf24;
  margin-bottom: 6px;
}
.pv-amount-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  direction: ltr;
  margin-bottom: 8px;
}
.pv-amount-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(2rem, 5vw, 3.2rem);
  font-weight: 900;
  color: #ffffff;
  letter-spacing: -0.02em;
}
.pv-amount-curr {
  font-size: clamp(1.1rem, 2vw, 1.5rem);
  font-weight: 900;
  color: #f59e0b;
}
.pv-amount-tafqeet {
  display: inline-block;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fde68a;
  font-size: 0.86rem;
  font-weight: 700;
  padding: 5px 16px;
  border-radius: 999px;
}

/* Details Grid */
.pv-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 20px;
}
@media (min-width: 600px) {
  .pv-grid {
    grid-template-columns: 1fr 1fr;
  }
}
.pv-cell {
  background: #070b14;
  border: 1px solid #1e293b;
  border-radius: 14px;
  padding: 14px 16px;
}
.pv-cell-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  color: #94a3b8;
  margin-bottom: 4px;
}
.pv-cell-header svg {
  color: #f59e0b;
}
.pv-cell-val {
  font-size: 0.94rem;
  font-weight: 800;
  color: #f8fafc;
}
.pv-cell-sub {
  font-size: 0.73rem;
  color: #64748b;
  margin-top: 3px;
}

/* Description Box */
.pv-desc-box {
  background: #070b14;
  border: 1px solid #1e293b;
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 20px;
}
.pv-desc-label {
  font-size: 0.75rem;
  font-weight: 800;
  color: #94a3b8;
  margin-bottom: 6px;
}
.pv-desc-text {
  font-size: 0.92rem;
  color: #e2e8f0;
  line-height: 1.6;
}

/* Seal & QR Row */
.pv-seal-row {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(8, 14, 25, 0.9) 60%, rgba(16, 185, 129, 0.08) 100%);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
@media (min-width: 600px) {
  .pv-seal-row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
.pv-seal-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.pv-qr-box {
  background: #ffffff;
  padding: 6px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}
.pv-seal-info strong {
  display: block;
  font-size: 0.9rem;
  font-weight: 800;
  color: #fbbf24;
}
.pv-seal-hash {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.74rem;
  color: #cbd5e1;
  margin-top: 2px;
}
.pv-seal-issuer {
  font-size: 0.72rem;
  color: #94a3b8;
  margin-top: 2px;
}
.pv-seal-right {
  text-align: right;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 10px;
}
@media (min-width: 600px) {
  .pv-seal-right {
    border-top: none;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 0;
    padding-right: 14px;
  }
}
.pv-verified-stamp {
  font-size: 0.78rem;
  font-weight: 800;
  color: #34d399;
}
.pv-verified-date {
  font-size: 0.72rem;
  color: #94a3b8;
  margin-top: 2px;
}

/* Actions Row */
.pv-actions-row {
  margin-top: 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.pv-btn-action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: #141c2c;
  border: 1px solid #263347;
  color: #e2e8f0;
  font-family: inherit;
  font-weight: 700;
  font-size: 0.82rem;
  padding: 8px 16px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.pv-btn-action:hover {
  background: #1e293b;
  border-color: #f59e0b;
  color: #ffffff;
}
.pv-btn-action.pv-btn-ghost {
  background: transparent;
  border-color: transparent;
  color: #94a3b8;
}
.pv-btn-action.pv-btn-ghost:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
}

/* Error Card */
.pv-error-card {
  background: linear-gradient(180deg, #180e12 0%, #11090d 100%);
  border: 2px solid rgba(244, 63, 94, 0.45);
  border-radius: 20px;
  padding: 30px 20px;
  text-align: center;
  margin-bottom: 30px;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.5);
}
.pv-error-icon {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(244, 63, 94, 0.15);
  border: 1px solid rgba(244, 63, 94, 0.35);
  color: #fb7185;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
}
.pv-error-title {
  font-size: 1.15rem;
  font-weight: 900;
  color: #fda4af;
  margin: 0 0 8px;
}
.pv-error-desc {
  font-size: 0.9rem;
  color: #cbd5e1;
  max-width: 500px;
  margin: 0 auto 18px;
  line-height: 1.6;
}
.pv-error-tips {
  background: #090608;
  border: 1px solid rgba(244, 63, 94, 0.2);
  border-radius: 12px;
  padding: 14px 18px;
  max-width: 460px;
  margin: 0 auto 20px;
  text-align: right;
  font-size: 0.78rem;
  color: #94a3b8;
  line-height: 1.7;
}
.pv-btn-wa {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #059669;
  color: #ffffff;
  text-decoration: none;
  font-weight: 800;
  font-size: 0.88rem;
  padding: 10px 20px;
  border-radius: 12px;
  transition: all 0.2s;
  box-shadow: 0 4px 15px rgba(5, 150, 105, 0.4);
}
.pv-btn-wa:hover {
  background: #10b981;
}

/* Feature grid */
.pv-features {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
@media (min-width: 768px) {
  .pv-features {
    grid-template-columns: repeat(3, 1fr);
  }
}
.pv-feature-card {
  background: #0a0e17;
  border: 1px solid #1e293b;
  border-radius: 14px;
  padding: 18px;
}
.pv-feature-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}
.pv-feature-title {
  font-size: 0.88rem;
  font-weight: 800;
  color: #f1f5f9;
  margin-bottom: 6px;
}
.pv-feature-desc {
  font-size: 0.76rem;
  color: #94a3b8;
  line-height: 1.6;
  margin: 0;
}

/* Footer */
.pv-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 40px;
  padding: 24px 20px;
  text-align: center;
  font-size: 0.75rem;
  color: #64748b;
}
.pv-footer-inner {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
@media (min-width: 640px) {
  .pv-footer-inner {
    flex-direction: row;
  }
}

/* Camera Modal */
.pv-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.pv-modal-card {
  background: #0d1424;
  border: 1.5px solid rgba(245, 158, 11, 0.4);
  border-radius: 20px;
  max-width: 420px;
  width: 100%;
  overflow: hidden;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8);
}
.pv-modal-header {
  padding: 14px 18px;
  border-bottom: 1px solid #1e293b;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pv-modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  font-size: 0.95rem;
  color: #f8fafc;
}
.pv-modal-close {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pv-modal-close:hover {
  color: #ffffff;
}
.pv-modal-body {
  padding: 18px;
}
.pv-video-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: #000000;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pv-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pv-viewfinder {
  position: absolute;
  inset: 24px;
  border: 2px dashed rgba(245, 158, 11, 0.8);
  border-radius: 14px;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pv-laser-line {
  width: 100%;
  height: 2px;
  background: #f59e0b;
  box-shadow: 0 0 10px #f59e0b;
  animation: pvLaser 2s infinite ease-in-out;
}
@keyframes pvLaser {
  0%, 100% { transform: translateY(-50px); opacity: 0.4; }
  50% { transform: translateY(50px); opacity: 1; }
}

/* Print styles */
@media print {
  body { background: #fff !important; color: #000 !important; }
  .pv-nav, .pv-search-card, .pv-features, .pv-footer, .pv-actions-row, .pv-hero { display: none !important; }
  .pv-cert { border: 2px solid #000 !important; box-shadow: none !important; background: #fff !important; color: #000 !important; }
  .pv-amount-card, .pv-cell, .pv-desc-box { background: #f8fafc !important; border: 1px solid #ccc !important; color: #000 !important; }
  .pv-amount-num, .pv-cell-val, .pv-desc-text { color: #000 !important; }
  .pv-seal-row { border: 1px solid #ccc !important; background: #fff !important; }
}
`;

export default function DocumentVerificationView({ 
  initialDocQuery = '', 
  embedded = false 
}: { 
  initialDocQuery?: string; 
  embedded?: boolean; 
}) {
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
      setErrorMessage('تعذر الاتصال بخادم التحقق. يرجى التأكد من اتصال الإنترنت والمحاولة ثانية.');
      setVerifiedData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    const currentDoc = verifiedData?.docNumber || docQuery;
    const url = `${window.location.origin}/verify?doc=${encodeURIComponent(currentDoc)}`;
    navigator.clipboard.writeText(url).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    });
  };

  const handlePrintCertificate = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // Start Camera Barcode Scanner
  const startCameraScan = async () => {
    setCameraError(null);
    setIsCameraOpen(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('المتصفح لا يدعم الوصول المباشر لكاميرا الهاتف.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        detectBarcodeInStream();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('تعذر فتح الكاميرا. يرجى التأكد من منح الإذن لاستخدام الكاميرا.');
    }
  };

  const stopCameraScan = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setCameraError(null);
  };

  const detectBarcodeInStream = async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectBarcodeInStream);
      return;
    }

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
    <div className="pv-root" dir="rtl">
      <style>{VERIFY_STYLES}</style>

      {/* Top Navbar (only for standalone page) */}
      {!embedded && (
        <header className="pv-nav">
          <div className="pv-nav-inner">
            <Link href="/" className="pv-brand-link">
              <div className="pv-logo-mark">
                <img 
                  src="/brand/phitech-mark-color.svg" 
                  alt="Phi Tech" 
                  width={30} 
                  height={30} 
                  style={{ width: 30, height: 30, objectFit: 'contain' }} 
                />
              </div>
              <div>
                <div className="pv-brand-title">
                  <strong>PHI CONSTRUCT</strong>
                  <span className="pv-brand-badge">فاي تك</span>
                </div>
                <p className="pv-brand-sub">بوابة التحقق والتوثيق المعتمدة رسمياً</p>
              </div>
            </Link>

            <div className="pv-nav-actions">
              <Link href="/" className="pv-nav-link">
                <span>الموقع الرئيسي</span>
                <ArrowRight style={{ width: 14, height: 14, transform: 'rotate(180deg)' }} />
              </Link>
            </div>
          </div>
        </header>
      )}

      {/* Main Container */}
      <main className="pv-main">
        {/* Hero Section */}
        {!embedded && (
          <div className="pv-hero">
            <div className="pv-pill-badge">
              <ShieldCheck style={{ width: 15, height: 15, color: '#34d399' }} />
              <span>منظومة التحقق والتوثيق الرقمي من صحة المستندات المالية</span>
            </div>

            <h1 className="pv-hero-title">
              التحقق من صحة ومطابقة المستندات
            </h1>
            <p className="pv-hero-desc">
              امسح رمز QR أو الباركود المطبوع على السند أو اكتب رقمه للتحقق الفوري من صحة الأرقام والمبالغ المعتمدة في سجلات فاي تك.
            </p>
          </div>
        )}

        {/* Search & Scan Box */}
        <div className="pv-search-card">
          <div className="pv-search-glow" />
          
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="pv-form"
          >
            <div className="pv-input-wrap">
              <div className="pv-input-icon">
                <Search style={{ width: 18, height: 18 }} />
              </div>
              <input
                type="text"
                value={docQuery}
                onChange={(e) => setDocQuery(e.target.value)}
                placeholder="اكتب رقم السند أو الفاتورة (مثال: PV-2026-0002 أو RV-2026-0001)..."
                className="pv-input"
              />
              {docQuery && (
                <button
                  type="button"
                  onClick={() => setDocQuery('')}
                  className="pv-clear-btn"
                  title="مسح الحقل"
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              )}
            </div>

            <div className="pv-form-actions">
              <button
                type="submit"
                disabled={isLoading}
                className="pv-btn-search"
              >
                {isLoading ? (
                  <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%', animation: 'pvSpin 0.8s linear infinite' }} />
                ) : (
                  <>
                    <Search style={{ width: 16, height: 16 }} />
                    <span>تحقق الآن</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={startCameraScan}
                className="pv-btn-camera"
                title="مسح الباركود باستخدام الكاميرا"
              >
                <Camera style={{ width: 16, height: 16 }} />
                <span>مسح بالكاميرا</span>
              </button>
            </div>
          </form>

          {/* Quick Examples */}
          <div className="pv-examples">
            <span style={{ fontWeight: 700, color: '#64748b' }}>أمثلة سريعة للتجربة:</span>
            <button
              type="button"
              onClick={() => {
                setDocQuery('PV-2026-0002');
                handleSearch('PV-2026-0002');
              }}
              className="pv-sample-chip"
            >
              PV-2026-0002
            </button>
            <button
              type="button"
              onClick={() => {
                setDocQuery('PV-2026-0003');
                handleSearch('PV-2026-0003');
              }}
              className="pv-sample-chip"
            >
              PV-2026-0003
            </button>
            <button
              type="button"
              onClick={() => {
                setDocQuery('RV-2026-0001');
                handleSearch('RV-2026-0001');
              }}
              className="pv-sample-chip"
            >
              RV-2026-0001
            </button>
          </div>
        </div>

        {/* Camera Modal */}
        {isCameraOpen && (
          <div className="pv-modal-overlay">
            <div className="pv-modal-card">
              <div className="pv-modal-header">
                <div className="pv-modal-title">
                  <Camera style={{ width: 18, height: 18, color: '#f59e0b' }} />
                  <span>مسح الباركود بالكاميرا</span>
                </div>
                <button
                  type="button"
                  onClick={stopCameraScan}
                  className="pv-modal-close"
                  title="إغلاق"
                >
                  <X style={{ width: 18, height: 18 }} />
                </button>
              </div>

              <div className="pv-modal-body">
                <div className="pv-video-stage">
                  <video
                    ref={videoRef}
                    playsInline
                    className="pv-video"
                  />
                  <div className="pv-viewfinder">
                    <div className="pv-laser-line" />
                  </div>
                </div>

                {cameraError && (
                  <p style={{ marginTop: 12, fontSize: '0.8rem', color: '#fb7185', textAlign: 'center', fontWeight: 600 }}>
                    {cameraError}
                  </p>
                )}

                <p style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center', marginTop: 12 }}>
                  وجّه الكاميرا نحو الباركود أو رمز QR المطبوع أعلى السند.
                </p>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #1e293b', textAlign: 'center' }}>
                  <label style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span>أو اختر صورة السند من الهاتف</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results: Verified Card */}
        {verifiedData && (
          <div id="verified-certificate" className="pv-cert">
            {/* Verification Status Header */}
            <div className="pv-cert-header">
              <div className="pv-cert-status-left">
                <div className="pv-cert-icon">
                  <CheckCircle2 style={{ width: 24, height: 24 }} />
                </div>
                <div className="pv-cert-title-wrap">
                  <strong>مستند أصلي موثق ومعتمد رسمياً</strong>
                  <p>تم التحقق من مطابقة الأرقام والبيانات مع دفتر الأستاذ العام في فاي تك</p>
                </div>
              </div>

              <span className="pv-doc-num-badge">
                {verifiedData.docNumber}
              </span>
            </div>

            {/* Certificate Body */}
            <div className="pv-cert-body">
              {/* Massive Amount Display */}
              <div className="pv-amount-card">
                <div className="pv-amount-label">
                  المبلغ المالي المعتمد في السند
                </div>
                <div className="pv-amount-row">
                  <span className="pv-amount-num">
                    {verifiedData.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="pv-amount-curr">
                    {verifiedData.currency}
                  </span>
                </div>
                <div className="pv-amount-tafqeet">
                  {verifiedData.amountInWords}
                </div>
              </div>

              {/* Document Details Grid */}
              <div className="pv-grid">
                <div className="pv-cell">
                  <div className="pv-cell-header">
                    <FileText style={{ width: 14, height: 14 }} />
                    <span>نوع المستند ورقم المرجع:</span>
                  </div>
                  <div className="pv-cell-val">
                    {verifiedData.docType}
                  </div>
                  <div className="pv-cell-sub">
                    رقم السند: {verifiedData.docNumber}
                  </div>
                </div>

                <div className="pv-cell">
                  <div className="pv-cell-header">
                    <Calendar style={{ width: 14, height: 14 }} />
                    <span>تاريخ المستند الرسمي:</span>
                  </div>
                  <div className="pv-cell-val" style={{ fontFamily: 'monospace' }}>
                    {verifiedData.date}
                  </div>
                  <div className="pv-cell-sub">
                    مسجل ومثبت بالسجلات المحاسبية
                  </div>
                </div>

                <div className="pv-cell">
                  <div className="pv-cell-header">
                    <User style={{ width: 14, height: 14 }} />
                    <span>{verifiedData.partyRole}:</span>
                  </div>
                  <div className="pv-cell-val">
                    {verifiedData.partyName}
                  </div>
                </div>

                <div className="pv-cell">
                  <div className="pv-cell-header">
                    <CreditCard style={{ width: 14, height: 14 }} />
                    <span>طريقة السداد / الصرف:</span>
                  </div>
                  <div className="pv-cell-val">
                    {verifiedData.paymentMethod}
                  </div>
                  <div className="pv-cell-sub" style={{ color: '#34d399', fontWeight: 600 }}>
                    {verifiedData.status}
                  </div>
                </div>
              </div>

              {/* Description & Statement */}
              <div className="pv-desc-box">
                <div className="pv-desc-label">
                  البيان المالي المسجل في السند:
                </div>
                <div className="pv-desc-text">
                  {verifiedData.description}
                </div>
              </div>

              {/* Digital Seal & QR Stamp */}
              <div className="pv-seal-row">
                <div className="pv-seal-left">
                  <div className="pv-qr-box">
                    <QRCodeSVG
                      value={typeof window !== 'undefined' ? window.location.href : `https://phi-tech.org/verify?doc=${verifiedData.docNumber}`}
                      size={58}
                      level="M"
                    />
                  </div>
                  <div className="pv-seal-info">
                    <strong>الختم الرقمي المشفر</strong>
                    <div className="pv-seal-hash">
                      {verifiedData.securitySeal}
                    </div>
                    <div className="pv-seal-issuer">
                      الجهة المصدرة: {verifiedData.companyName}
                    </div>
                  </div>
                </div>

                <div className="pv-seal-right">
                  <div className="pv-verified-stamp">موثق ومعتمد رسمياً</div>
                  <div className="pv-verified-date">
                    بتاريخ: {new Date(verifiedData.verifiedAt).toLocaleDateString('ar-EG')}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pv-actions-row">
                <button
                  type="button"
                  onClick={handlePrintCertificate}
                  className="pv-btn-action"
                >
                  <Printer style={{ width: 15, height: 15, color: '#f59e0b' }} />
                  <span>طباعة شهادة التوثيق</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="pv-btn-action"
                >
                  <Share2 style={{ width: 15, height: 15, color: '#f59e0b' }} />
                  <span>{isCopied ? 'تم نسخ الرابط بنجاح!' : 'مشاركة الرابط'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVerifiedData(null);
                    setDocQuery('');
                    setHasSearched(false);
                  }}
                  className="pv-btn-action pv-btn-ghost"
                >
                  <RotateCcw style={{ width: 14, height: 14 }} />
                  <span>فحص مستند آخر</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error / Not Found Message */}
        {errorMessage && (
          <div className="pv-error-card">
            <div className="pv-error-icon">
              <AlertTriangle style={{ width: 24, height: 24 }} />
            </div>
            <h3 className="pv-error-title">
              تنبيه: لم يتم العثور على المستند
            </h3>
            <p className="pv-error-desc">
              {errorMessage}
            </p>

            <div className="pv-error-tips">
              <div style={{ fontWeight: 800, color: '#f8fafc', marginBottom: 6 }}>إرشادات التحقق السريع:</div>
              <div>• تأكد من كتابة كود السند كاملاً كما هو مطبوع (مثال: <span style={{ fontFamily: 'monospace', color: '#fbbf24' }}>PV-2026-0002</span> أو <span style={{ fontFamily: 'monospace', color: '#fbbf24' }}>RV-2026-0001</span>).</div>
              <div>• يمكنك أيضاً كتابة أرقام السند فقط (مثال: <span style={{ fontFamily: 'monospace', color: '#fbbf24' }}>0002</span>).</div>
              <div>• في حال استلامك إيصالاً غير مسجل، تواصل فوراً مع الإدارة المالية للتأكيد.</div>
            </div>

            <a
              href={`https://wa.me/${PHI_COMPANY_CONTACTS.phone1?.replace(/[^0-9]/g, '') || '201026332733'}?text=${encodeURIComponent(`السلام عليكم، أحتاج التحقق من السند رقم: ${docQuery}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="pv-btn-wa"
            >
              <span>التواصل مع الإدارة المالية عبر واتساب</span>
              <ExternalLink style={{ width: 15, height: 15 }} />
            </a>
          </div>
        )}

        {/* Feature Cards Guide */}
        <div className="pv-features">
          <div className="pv-feature-card">
            <div className="pv-feature-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24' }}>
              <QrCode style={{ width: 18, height: 18 }} />
            </div>
            <div className="pv-feature-title">مسح الباركود الفوري</div>
            <p className="pv-feature-desc">
              كاميرا الهاتف الذكي تفتح شهادة التحقق مباشرة بمجرد توجيه الكاميرا نحو رمز QR على أي مستند مطبوع.
            </p>
          </div>

          <div className="pv-feature-card">
            <div className="pv-feature-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399' }}>
              <FileCheck2 style={{ width: 18, height: 18 }} />
            </div>
            <div className="pv-feature-title">مطابقة محاسبية دقيقة</div>
            <p className="pv-feature-desc">
              يتم جلب الأرقام والبيانات لحظياً من قيود اليومية العامة المعتمدة في النظام لمنع أي تلاعب أو تزوير.
            </p>
          </div>

          <div className="pv-feature-card">
            <div className="pv-feature-icon" style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#38bdf8' }}>
              <Building2 style={{ width: 18, height: 18 }} />
            </div>
            <div className="pv-feature-title">اعتماد فاي تك الرسمي</div>
            <p className="pv-feature-desc">
              كل مستند موثق يحمل ختماً رقمياً مشفراً وكود أمان إلكتروني يثبت صحته للعملاء والملاك ومقاولي الباطن.
            </p>
          </div>
        </div>
      </main>

      {/* Footer (only for standalone page) */}
      {!embedded && (
        <footer className="pv-footer">
          <div className="pv-footer-inner">
            <p>© 2026 شركة فاي تك للتطوير العقاري والمقاولات العامة (PHI CONSTRUCT) — جميع الحقوق محفوظة.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>هاتف: {PHI_COMPANY_CONTACTS.phone1}</span>
              <span>•</span>
              <span>البريد: {PHI_COMPANY_CONTACTS.email}</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
