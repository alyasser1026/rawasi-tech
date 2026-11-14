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
  Globe,
  LogIn
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

const SYSTEM_UNIFIED_STYLES = `
/* ==========================================================================
   PHI TECH ERP SYSTEM — UNIFIED OBSIDIAN CERAMIC THEME (مطابق تماماً للسيستم)
   ========================================================================== */
.phi-sys-root {
  min-height: 100vh;
  background: radial-gradient(circle at 15% 10%, rgba(249, 115, 22, 0.13), transparent 38%),
              radial-gradient(circle at 85% 85%, rgba(245, 158, 11, 0.08), transparent 40%),
              linear-gradient(180deg, #0c0907 0%, #100c09 100%) !important;
  color: #ffffff !important;
  font-family: 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  direction: rtl;
  text-align: right;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}
.phi-sys-root * {
  box-sizing: border-box;
}

/* System Top Bar (مطابق لشريط نظام فاي تك) */
.phi-sys-topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  background: linear-gradient(135deg, #191613 0%, #120f0d 55%, #090807 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 20px 42px -12px rgba(0, 0, 0, 0.88), 0 6px 16px -4px rgba(0, 0, 0, 0.65);
  padding: 12px 24px;
}
.phi-sys-topbar-inner {
  max-width: 1040px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.phi-sys-brand {
  display: flex;
  align-items: center;
  gap: 16px;
  text-decoration: none;
  color: #ffffff;
}
.phi-sys-logo {
  height: 40px;
  width: auto;
  max-width: 140px;
  object-fit: contain;
  display: block;
}
.phi-sys-brand-divider {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.12);
}
.phi-sys-brand-meta {
  display: flex;
  flex-direction: column;
}
.phi-sys-brand-meta strong {
  font-size: 0.96rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.2px;
}
.phi-sys-brand-meta small {
  font-size: 0.72rem;
  color: #d4c7b8;
  font-weight: 600;
}
.phi-sys-topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.phi-sys-nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #ede5da;
  text-decoration: none;
  font-size: 0.84rem;
  font-weight: 700;
  padding: 8px 14px;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(249, 115, 22, 0.07) 0%, rgba(20, 16, 13, 0.92) 100%);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  transition: all 0.2s ease;
  white-space: nowrap;
}
.phi-sys-nav-btn:hover {
  background: linear-gradient(180deg, rgba(249, 115, 22, 0.16) 0%, rgba(30, 22, 17, 0.95) 100%);
  color: #f97316;
  transform: translateY(-1.5px);
}
.phi-sys-nav-btn.primary {
  background: linear-gradient(180deg, #fb923c 0%, #f97316 55%, #d9460f 100%);
  color: #ffffff;
  box-shadow: 0 10px 24px -4px rgba(249, 115, 22, 0.35);
}
.phi-sys-nav-btn.primary:hover {
  filter: brightness(1.08);
}

/* Page Workspace */
.phi-sys-workspace {
  max-width: 900px;
  margin: 0 auto;
  padding: 38px 20px 60px;
}

/* Hero Section */
.phi-sys-hero {
  text-align: center;
  margin-bottom: 32px;
}
.phi-sys-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(249, 115, 22, 0.13);
  color: #fb923c;
  font-size: 0.78rem;
  font-weight: 800;
  padding: 6px 16px;
  border-radius: 999px;
  margin-bottom: 14px;
  box-shadow: 0 0 20px rgba(249, 115, 22, 0.15);
}
.phi-sys-hero-title {
  font-size: clamp(1.7rem, 3.4vw, 2.35rem);
  font-weight: 900;
  color: #ffffff;
  margin: 0 0 10px;
  line-height: 1.3;
  letter-spacing: -0.5px;
}
.phi-sys-hero-desc {
  font-size: clamp(0.88rem, 1.3vw, 0.98rem);
  color: #d4c7b8;
  max-width: 620px;
  margin: 0 auto;
  line-height: 1.7;
}

/* Panel Card (نفس كارتات .ent-panel في السيستم بدون إطارات صلبة) */
.phi-sys-panel {
  background: linear-gradient(180deg, #181512 0%, #120f0d 52%, #0b0908 100%);
  border-radius: 20px;
  box-shadow: 0 26px 54px -15px rgba(0, 0, 0, 0.9), 0 12px 32px -10px rgba(249, 115, 22, 0.12);
  padding: 26px;
  margin-bottom: 30px;
  position: relative;
  overflow: hidden;
  border: none !important;
}
.phi-sys-specular-top {
  position: absolute;
  top: 0;
  left: 8%;
  right: 8%;
  height: 1.5px;
  background: linear-gradient(90deg, transparent 0%, rgba(254, 215, 170, 0.35) 50%, transparent 100%);
  pointer-events: none;
  z-index: 2;
}

/* Search Form */
.phi-sys-form {
  display: flex;
  gap: 12px;
  flex-direction: column;
}
@media (min-width: 640px) {
  .phi-sys-form {
    flex-direction: row;
  }
}
.phi-sys-input-wrap {
  position: relative;
  flex: 1;
}
.phi-sys-input-icon {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #84654c;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.phi-sys-input {
  width: 100%;
  background: #090807 !important;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.92), inset 0 -1px 1px rgba(249, 115, 22, 0.06) !important;
  border: none !important;
  color: #ffffff !important;
  font-family: inherit;
  font-size: 1rem;
  padding: 14px 44px 14px 38px;
  border-radius: 12px;
  outline: none;
  transition: box-shadow 0.25s ease, background 0.25s ease;
}
.phi-sys-input:focus {
  outline: none;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.92), 0 0 0 2px rgba(249, 115, 22, 0.4) !important;
}
.phi-sys-input::placeholder {
  color: #716253;
  font-size: 0.9rem;
}
.phi-sys-clear-btn {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #84654c;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.phi-sys-clear-btn:hover {
  color: #ffffff;
}

/* Buttons */
.phi-sys-btn-group {
  display: flex;
  gap: 10px;
}
.phi-sys-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(180deg, #fb923c 0%, #f97316 55%, #d9460f 100%);
  color: #ffffff;
  font-family: inherit;
  font-weight: 800;
  font-size: 0.95rem;
  padding: 0 24px;
  min-height: 50px;
  border: none !important;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.25s ease, filter 0.2s ease;
  box-shadow: 0 10px 26px -4px rgba(249, 115, 22, 0.35);
  white-space: nowrap;
}
.phi-sys-btn-primary:hover:not(:disabled) {
  transform: translateY(-1.5px);
  box-shadow: 0 14px 32px -4px rgba(249, 115, 22, 0.45);
  filter: brightness(1.06);
}
.phi-sys-btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.phi-sys-btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(180deg, rgba(249, 115, 22, 0.07) 0%, rgba(20, 16, 13, 0.92) 100%);
  color: #f7efe5;
  font-family: inherit;
  font-weight: 700;
  font-size: 0.88rem;
  padding: 0 18px;
  min-height: 50px;
  border-radius: 12px;
  cursor: pointer;
  border: 1px solid rgba(249, 115, 22, 0.18);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  transition: all 0.2s ease;
  white-space: nowrap;
}
.phi-sys-btn-secondary:hover {
  background: linear-gradient(180deg, rgba(249, 115, 22, 0.16) 0%, rgba(30, 22, 17, 0.95) 100%);
  color: #f97316;
  transform: translateY(-1.5px);
}

/* Verified Certificate Card */
.phi-sys-cert-card {
  background: linear-gradient(180deg, #181512 0%, #120f0d 52%, #0b0908 100%);
  border-radius: 24px;
  box-shadow: 0 26px 54px -15px rgba(0, 0, 0, 0.95), 0 12px 32px -10px rgba(16, 185, 129, 0.15);
  overflow: hidden;
  margin-bottom: 30px;
  position: relative;
  border: none !important;
  animation: phiFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes phiFadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.phi-sys-cert-header {
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.16) 0%, rgba(20, 16, 13, 0.95) 100%);
  padding: 18px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.phi-sys-cert-status-wrap {
  display: flex;
  align-items: center;
  gap: 14px;
}
.phi-sys-status-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
.phi-sys-status-texts strong {
  display: block;
  font-size: 1.05rem;
  font-weight: 800;
  color: #34d399;
  line-height: 1.3;
}
.phi-sys-status-texts p {
  margin: 3px 0 0;
  font-size: 0.76rem;
  color: #d4c7b8;
}
.phi-sys-voucher-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.86rem;
  font-weight: 800;
  color: #fb923c;
  background: #090807;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.92);
  padding: 6px 14px;
  border-radius: 10px;
}

/* Certificate Body */
.phi-sys-cert-body {
  padding: 26px;
}
@media (min-width: 640px) {
  .phi-sys-cert-body {
    padding: 32px;
  }
}

/* Massive Amount Display */
.phi-sys-amount-box {
  background: #090807;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.92), inset 0 -1px 1px rgba(249, 115, 22, 0.06);
  border-radius: 18px;
  padding: 24px;
  text-align: center;
  margin-bottom: 24px;
}
.phi-sys-amount-label {
  font-size: 0.82rem;
  font-weight: 800;
  color: #fb923c;
  margin-bottom: 6px;
}
.phi-sys-amount-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 10px;
  direction: ltr;
  margin-bottom: 8px;
}
.phi-sys-amount-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(2.2rem, 5vw, 3.4rem);
  font-weight: 900;
  color: #ffffff;
  letter-spacing: -0.02em;
}
.phi-sys-amount-curr {
  font-size: clamp(1.2rem, 2vw, 1.6rem);
  font-weight: 900;
  color: #f97316;
}
.phi-sys-tafqeet-pill {
  display: inline-block;
  background: rgba(249, 115, 22, 0.12);
  color: #fed7aa;
  font-size: 0.88rem;
  font-weight: 700;
  padding: 6px 20px;
  border-radius: 999px;
}

/* Details Grid */
.phi-sys-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  margin-bottom: 22px;
}
@media (min-width: 600px) {
  .phi-sys-grid {
    grid-template-columns: 1fr 1fr;
  }
}
.phi-sys-cell {
  background: linear-gradient(180deg, rgba(249, 115, 22, 0.05) 0%, rgba(20, 16, 13, 0.92) 100%);
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  border: none !important;
}
.phi-sys-cell-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.76rem;
  color: #d4c7b8;
  margin-bottom: 4px;
}
.phi-sys-cell-header svg {
  color: #f97316;
}
.phi-sys-cell-val {
  font-size: 0.98rem;
  font-weight: 800;
  color: #ffffff;
}
.phi-sys-cell-sub {
  font-size: 0.74rem;
  color: #84654c;
  margin-top: 3px;
}

/* Description Box */
.phi-sys-desc-box {
  background: linear-gradient(180deg, rgba(249, 115, 22, 0.05) 0%, rgba(20, 16, 13, 0.92) 100%);
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 22px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
.phi-sys-desc-label {
  font-size: 0.76rem;
  font-weight: 800;
  color: #d4c7b8;
  margin-bottom: 6px;
}
.phi-sys-desc-text {
  font-size: 0.94rem;
  color: #f7efe5;
  line-height: 1.65;
}

/* Digital Seal & QR Stamp */
.phi-sys-seal-box {
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(20, 16, 13, 0.95) 60%, rgba(16, 185, 129, 0.07) 100%);
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
@media (min-width: 600px) {
  .phi-sys-seal-box {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
.phi-sys-seal-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.phi-sys-qr-container {
  background: #ffffff;
  padding: 6px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}
.phi-sys-seal-details strong {
  display: block;
  font-size: 0.92rem;
  font-weight: 800;
  color: #fb923c;
}
.phi-sys-seal-hash {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.76rem;
  color: #d4c7b8;
  margin-top: 3px;
}
.phi-sys-seal-issuer {
  font-size: 0.74rem;
  color: #84654c;
  margin-top: 3px;
}
.phi-sys-seal-right {
  text-align: right;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 12px;
}
@media (min-width: 600px) {
  .phi-sys-seal-right {
    border-top: none;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: 0;
    padding-right: 16px;
  }
}
.phi-sys-verified-tag {
  font-size: 0.8rem;
  font-weight: 800;
  color: #34d399;
}
.phi-sys-verified-timestamp {
  font-size: 0.74rem;
  color: #d4c7b8;
  margin-top: 3px;
}

/* Actions Row */
.phi-sys-actions {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.phi-sys-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: linear-gradient(180deg, rgba(249, 115, 22, 0.07) 0%, rgba(20, 16, 13, 0.92) 100%);
  color: #f7efe5;
  font-family: inherit;
  font-weight: 700;
  font-size: 0.84rem;
  padding: 10px 18px;
  border-radius: 12px;
  cursor: pointer;
  border: 1px solid rgba(249, 115, 22, 0.18);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  transition: all 0.2s ease;
}
.phi-sys-action-btn:hover {
  background: linear-gradient(180deg, rgba(249, 115, 22, 0.16) 0%, rgba(30, 22, 17, 0.95) 100%);
  color: #f97316;
  transform: translateY(-1.5px);
}
.phi-sys-action-btn.ghost {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  color: #d4c7b8;
}
.phi-sys-action-btn.ghost:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
}

/* Error Card */
.phi-sys-error-card {
  background: linear-gradient(180deg, rgba(244, 63, 94, 0.12) 0%, rgba(20, 14, 16, 0.95) 100%);
  border-radius: 20px;
  padding: 32px 20px;
  text-align: center;
  margin-bottom: 30px;
  box-shadow: 0 26px 54px -15px rgba(0, 0, 0, 0.9), 0 12px 32px -10px rgba(244, 63, 94, 0.1);
  border: none !important;
}
.phi-sys-error-icon {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(244, 63, 94, 0.15);
  color: #fb7185;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
}
.phi-sys-error-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: #fda4af;
  margin: 0 0 8px;
}
.phi-sys-error-desc {
  font-size: 0.92rem;
  color: #f7efe5;
  max-width: 500px;
  margin: 0 auto 18px;
  line-height: 1.6;
}
.phi-sys-error-tips {
  background: #090807;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.92);
  border-radius: 12px;
  padding: 14px 18px;
  max-width: 480px;
  margin: 0 auto 20px;
  text-align: right;
  font-size: 0.8rem;
  color: #d4c7b8;
  line-height: 1.8;
}
.phi-sys-btn-wa {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #059669;
  color: #ffffff;
  text-decoration: none;
  font-weight: 800;
  font-size: 0.88rem;
  padding: 11px 22px;
  border-radius: 12px;
  transition: all 0.2s ease;
  box-shadow: 0 4px 15px rgba(5, 150, 105, 0.4);
}
.phi-sys-btn-wa:hover {
  background: #10b981;
  transform: translateY(-1.5px);
}

/* Feature grid */
.phi-sys-features {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}
@media (min-width: 768px) {
  .phi-sys-features {
    grid-template-columns: repeat(3, 1fr);
  }
}
.phi-sys-feature-card {
  background: linear-gradient(180deg, #181512 0%, #120f0d 52%, #0b0908 100%);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 10px 24px -10px rgba(0, 0, 0, 0.6);
  border: none !important;
}
.phi-sys-feature-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.phi-sys-feature-title {
  font-size: 0.9rem;
  font-weight: 800;
  color: #ffffff;
  margin-bottom: 6px;
}
.phi-sys-feature-desc {
  font-size: 0.78rem;
  color: #d4c7b8;
  line-height: 1.6;
  margin: 0;
}

/* Footer */
.phi-sys-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  margin-top: 40px;
  padding: 24px 20px;
  text-align: center;
  font-size: 0.78rem;
  color: #84654c;
}
.phi-sys-footer-inner {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
@media (min-width: 640px) {
  .phi-sys-footer-inner {
    flex-direction: row;
  }
}

/* Camera Modal */
.phi-sys-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.phi-sys-modal-card {
  background: linear-gradient(180deg, #181512 0%, #120f0d 52%, #0b0908 100%);
  border-radius: 24px;
  max-width: 440px;
  width: 100%;
  overflow: hidden;
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.9);
  position: relative;
  border: 1px solid rgba(249, 115, 22, 0.25);
}
.phi-sys-modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.phi-sys-modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  font-size: 0.98rem;
  color: #ffffff;
}
.phi-sys-modal-close {
  background: none;
  border: none;
  color: #d4c7b8;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.phi-sys-modal-close:hover {
  color: #ffffff;
}
.phi-sys-modal-body {
  padding: 20px;
}
.phi-sys-video-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: #000000;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.phi-sys-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.phi-sys-viewfinder {
  position: absolute;
  inset: 24px;
  border: 2px dashed rgba(249, 115, 22, 0.8);
  border-radius: 16px;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.phi-sys-laser {
  width: 100%;
  height: 2px;
  background: #f97316;
  box-shadow: 0 0 10px #f97316;
  animation: phiLaser 2s infinite ease-in-out;
}
@keyframes phiLaser {
  0%, 100% { transform: translateY(-50px); opacity: 0.4; }
  50% { transform: translateY(50px); opacity: 1; }
}

/* Print styles */
@media print {
  body { background: #fff !important; color: #000 !important; }
  .phi-sys-topbar, .phi-sys-panel, .phi-sys-features, .phi-sys-footer, .phi-sys-actions, .phi-sys-hero { display: none !important; }
  .phi-sys-cert-card { border: 2px solid #000 !important; box-shadow: none !important; background: #fff !important; color: #000 !important; }
  .phi-sys-amount-box, .phi-sys-cell, .phi-sys-desc-box { background: #f8fafc !important; border: 1px solid #ccc !important; color: #000 !important; }
  .phi-sys-amount-num, .phi-sys-cell-val, .phi-sys-desc-text { color: #000 !important; }
  .phi-sys-seal-box { border: 1px solid #ccc !important; background: #fff !important; }
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
    <div className="phi-sys-root" dir="rtl">
      <style>{SYSTEM_UNIFIED_STYLES}</style>

      {/* Unified System Top Bar */}
      {!embedded && (
        <header className="phi-sys-topbar">
          <div className="phi-sys-topbar-inner">
            <Link href="/" className="phi-sys-brand" title="الرئيسية">
              <img 
                src="/brand/phitech-lockup-light.svg" 
                alt="فاي تك | PHI TECH" 
                className="phi-sys-logo" 
                style={{ height: 38, width: 'auto', display: 'block' }}
              />
              <div className="phi-sys-brand-divider" />
              <div className="phi-sys-brand-meta">
                <strong>منظومة التحقق المالي</strong>
                <small>بوابة التحقق والتوثيق الرقمي للمستندات</small>
              </div>
            </Link>

            <div className="phi-sys-topbar-actions">
              <Link href="/" className="phi-sys-nav-btn">
                <Globe style={{ width: 15, height: 15 }} />
                <span>الموقع العام</span>
              </Link>
              <Link href="/login" className="phi-sys-nav-btn primary">
                <LogIn style={{ width: 15, height: 15 }} />
                <span>دخول النظام</span>
              </Link>
            </div>
          </div>
        </header>
      )}

      {/* Main Workspace */}
      <main className="phi-sys-workspace">
        {/* Hero Section */}
        {!embedded && (
          <div className="phi-sys-hero">
            <div className="phi-sys-badge">
              <ShieldCheck style={{ width: 16, height: 16 }} />
              <span>نظام فاي تك الموحد | توثيق واعتماد القيود المحاسبية</span>
            </div>

            <h1 className="phi-sys-hero-title">
              التحقق من صحة ومطابقة المستندات
            </h1>
            <p className="phi-sys-hero-desc">
              تحقق فوري من صحة ومطابقة الأرقام والمبالغ المعتمدة في سجلات الأستاذ العام عبر كتابة رقم السند أو مسح رمز QR والباركود.
            </p>
          </div>
        )}

        {/* Search & Scan Panel (بنفس أسلوب بطاقات السيستم) */}
        <div className="phi-sys-panel">
          <div className="phi-sys-specular-top" />
          
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="phi-sys-form"
          >
            <div className="phi-sys-input-wrap">
              <div className="phi-sys-input-icon">
                <Search style={{ width: 18, height: 18 }} />
              </div>
              <input
                type="text"
                value={docQuery}
                onChange={(e) => setDocQuery(e.target.value)}
                placeholder="اكتب رقم السند أو الفاتورة (مثال: PV-2026-0002 أو RV-2026-0001)..."
                className="phi-sys-input"
              />
              {docQuery && (
                <button
                  type="button"
                  onClick={() => setDocQuery('')}
                  className="phi-sys-clear-btn"
                  title="مسح"
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              )}
            </div>

            <div className="phi-sys-btn-group">
              <button
                type="submit"
                disabled={isLoading}
                className="phi-sys-btn-primary"
              >
                {isLoading ? (
                  <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'phiSpin 0.8s linear infinite' }} />
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
                className="phi-sys-btn-secondary"
                title="مسح الباركود باستخدام الكاميرا"
              >
                <Camera style={{ width: 16, height: 16, color: '#f97316' }} />
                <span>مسح بالكاميرا</span>
              </button>
            </div>
          </form>
        </div>

        {/* Camera Modal */}
        {isCameraOpen && (
          <div className="phi-sys-modal-overlay">
            <div className="phi-sys-modal-card">
              <div className="phi-sys-modal-header">
                <div className="phi-sys-modal-title">
                  <Camera style={{ width: 18, height: 18, color: '#f97316' }} />
                  <span>مسح الباركود بالكاميرا</span>
                </div>
                <button
                  type="button"
                  onClick={stopCameraScan}
                  className="phi-sys-modal-close"
                  title="إغلاق"
                >
                  <X style={{ width: 18, height: 18 }} />
                </button>
              </div>

              <div className="phi-sys-modal-body">
                <div className="phi-sys-video-stage">
                  <video
                    ref={videoRef}
                    playsInline
                    className="phi-sys-video"
                  />
                  <div className="phi-sys-viewfinder">
                    <div className="phi-sys-laser" />
                  </div>
                </div>

                {cameraError && (
                  <p style={{ marginTop: 12, fontSize: '0.8rem', color: '#fb7185', textAlign: 'center', fontWeight: 600 }}>
                    {cameraError}
                  </p>
                )}

                <p style={{ fontSize: '0.78rem', color: '#d4c7b8', textAlign: 'center', marginTop: 12 }}>
                  وجّه الكاميرا نحو الباركود أو رمز QR المطبوع أعلى السند.
                </p>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                  <label style={{ fontSize: '0.82rem', color: '#fb923c', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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

        {/* Results: Verified Card (مطابق لبطاقات وبيانات السيستم) */}
        {verifiedData && (
          <div id="verified-certificate" className="phi-sys-cert-card">
            <div className="phi-sys-specular-top" />
            
            {/* Status Header */}
            <div className="phi-sys-cert-header">
              <div className="phi-sys-cert-status-wrap">
                <div className="phi-sys-status-icon">
                  <CheckCircle2 style={{ width: 24, height: 24 }} />
                </div>
                <div className="phi-sys-status-texts">
                  <strong>مستند أصلي موثق ومعتمد رسمياً</strong>
                  <p>تمت المطابقة مع قيود اليومية العامة ودفتر الأستاذ في نظام فاي تك</p>
                </div>
              </div>

              <span className="phi-sys-voucher-code">
                {verifiedData.docNumber}
              </span>
            </div>

            {/* Body */}
            <div className="phi-sys-cert-body">
              {/* Massive Amount Display */}
              <div className="phi-sys-amount-box">
                <div className="phi-sys-amount-label">
                  المبلغ المالي المعتمد في السند
                </div>
                <div className="phi-sys-amount-row">
                  <span className="phi-sys-amount-num">
                    {verifiedData.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="phi-sys-amount-curr">
                    {verifiedData.currency}
                  </span>
                </div>
                <div className="phi-sys-tafqeet-pill">
                  {verifiedData.amountInWords}
                </div>
              </div>

              {/* Details Grid */}
              <div className="phi-sys-grid">
                <div className="phi-sys-cell">
                  <div className="phi-sys-cell-header">
                    <FileText style={{ width: 14, height: 14 }} />
                    <span>نوع المستند:</span>
                  </div>
                  <div className="phi-sys-cell-val">
                    {verifiedData.docType}
                  </div>
                  <div className="phi-sys-cell-sub">
                    رقم السند المرجعي: {verifiedData.docNumber}
                  </div>
                </div>

                <div className="phi-sys-cell">
                  <div className="phi-sys-cell-header">
                    <Calendar style={{ width: 14, height: 14 }} />
                    <span>تاريخ المستند الرسمي:</span>
                  </div>
                  <div className="phi-sys-cell-val" style={{ fontFamily: 'monospace' }}>
                    {verifiedData.date}
                  </div>
                  <div className="phi-sys-cell-sub">
                    مسجل ومثبت في الحسابات العامة
                  </div>
                </div>

                <div className="phi-sys-cell">
                  <div className="phi-sys-cell-header">
                    <User style={{ width: 14, height: 14 }} />
                    <span>{verifiedData.partyRole}:</span>
                  </div>
                  <div className="phi-sys-cell-val">
                    {verifiedData.partyName}
                  </div>
                </div>

                <div className="phi-sys-cell">
                  <div className="phi-sys-cell-header">
                    <CreditCard style={{ width: 14, height: 14 }} />
                    <span>طريقة السداد / الخزينة:</span>
                  </div>
                  <div className="phi-sys-cell-val">
                    {verifiedData.paymentMethod}
                  </div>
                  <div className="phi-sys-cell-sub" style={{ color: '#34d399', fontWeight: 700 }}>
                    {verifiedData.status}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="phi-sys-desc-box">
                <div className="phi-sys-desc-label">
                  البيان المالي المسجل في السند:
                </div>
                <div className="phi-sys-desc-text">
                  {verifiedData.description}
                </div>
              </div>

              {/* Digital Seal */}
              <div className="phi-sys-seal-box">
                <div className="phi-sys-seal-left">
                  <div className="phi-sys-qr-container">
                    <QRCodeSVG
                      value={typeof window !== 'undefined' ? window.location.href : `https://phi-tech.org/verify?doc=${verifiedData.docNumber}`}
                      size={60}
                      level="M"
                    />
                  </div>
                  <div className="phi-sys-seal-details">
                    <strong>الختم الرقمي المشفر (Digital Seal)</strong>
                    <div className="phi-sys-seal-hash">
                      {verifiedData.securitySeal}
                    </div>
                    <div className="phi-sys-seal-issuer">
                      الجهة المصدرة: {verifiedData.companyName}
                    </div>
                  </div>
                </div>

                <div className="phi-sys-seal-right">
                  <div className="phi-sys-verified-tag">موثق ومعتمد رسمياً</div>
                  <div className="phi-sys-verified-timestamp">
                    بتاريخ: {new Date(verifiedData.verifiedAt).toLocaleDateString('ar-EG')}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="phi-sys-actions">
                <button
                  type="button"
                  onClick={handlePrintCertificate}
                  className="phi-sys-action-btn"
                >
                  <Printer style={{ width: 15, height: 15, color: '#f97316' }} />
                  <span>طباعة شهادة التوثيق</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="phi-sys-action-btn"
                >
                  <Share2 style={{ width: 15, height: 15, color: '#f97316' }} />
                  <span>{isCopied ? 'تم نسخ الرابط بنجاح!' : 'مشاركة الرابط'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVerifiedData(null);
                    setDocQuery('');
                    setHasSearched(false);
                  }}
                  className="phi-sys-action-btn ghost"
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
          <div className="phi-sys-error-card">
            <div className="phi-sys-error-icon">
              <AlertTriangle style={{ width: 24, height: 24 }} />
            </div>
            <h3 className="phi-sys-error-title">
              تنبيه: لم يتم العثور على المستند
            </h3>
            <p className="phi-sys-error-desc">
              {errorMessage}
            </p>

            <div className="phi-sys-error-tips">
              <div style={{ fontWeight: 800, color: '#ffffff', marginBottom: 6 }}>إرشادات التحقق المالي:</div>
              <div>• تأكد من كتابة كود السند كاملاً كما هو مطبوع (مثال: <span style={{ fontFamily: 'monospace', color: '#fb923c' }}>PV-2026-0002</span> أو <span style={{ fontFamily: 'monospace', color: '#fb923c' }}>RV-2026-0001</span>).</div>
              <div>• يمكنك أيضاً كتابة أرقام السند فقط (مثال: <span style={{ fontFamily: 'monospace', color: '#fb923c' }}>0002</span>).</div>
              <div>• في حال استلامك إيصالاً غير مسجل، تواصل فوراً مع الإدارة المالية للتأكيد.</div>
            </div>

            <a
              href={`https://wa.me/${PHI_COMPANY_CONTACTS.phone1?.replace(/[^0-9]/g, '') || '201026332733'}?text=${encodeURIComponent(`السلام عليكم، أحتاج التحقق من السند رقم: ${docQuery}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="phi-sys-btn-wa"
            >
              <span>التواصل مع الإدارة المالية عبر واتساب</span>
              <ExternalLink style={{ width: 15, height: 15 }} />
            </a>
          </div>
        )}

        {/* Feature Cards Guide */}
        <div className="phi-sys-features">
          <div className="phi-sys-feature-card">
            <div className="phi-sys-feature-icon" style={{ background: 'rgba(249, 115, 22, 0.13)', color: '#fb923c' }}>
              <QrCode style={{ width: 18, height: 18 }} />
            </div>
            <div className="phi-sys-feature-title">مسح الباركود الفوري</div>
            <p className="phi-sys-feature-desc">
              كاميرا الهاتف الذكي تفتح شهادة التحقق مباشرة بمجرد توجيه الكاميرا نحو رمز QR على أي مستند مطبوع.
            </p>
          </div>

          <div className="phi-sys-feature-card">
            <div className="phi-sys-feature-icon" style={{ background: 'rgba(16, 185, 129, 0.13)', color: '#34d399' }}>
              <FileCheck2 style={{ width: 18, height: 18 }} />
            </div>
            <div className="phi-sys-feature-title">مطابقة محاسبية دقيقة</div>
            <p className="phi-sys-feature-desc">
              يتم جلب الأرقام والبيانات لحظياً من قيود اليومية العامة المعتمدة في النظام لمنع أي تلاعب أو تزوير.
            </p>
          </div>

          <div className="phi-sys-feature-card">
            <div className="phi-sys-feature-icon" style={{ background: 'rgba(56, 189, 248, 0.13)', color: '#38bdf8' }}>
              <Building2 style={{ width: 18, height: 18 }} />
            </div>
            <div className="phi-sys-feature-title">اعتماد فاي تك الرسمي</div>
            <p className="phi-sys-feature-desc">
              كل مستند موثق يحمل ختماً رقمياً مشفراً وكود أمان إلكتروني يثبت صحته للعملاء والملاك ومقاولي الباطن.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      {!embedded && (
        <footer className="phi-sys-footer">
          <div className="phi-sys-footer-inner">
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
