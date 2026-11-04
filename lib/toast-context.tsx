"use client";
import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { notify } from '@/lib/notify';

// Message tones available to screens.
export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Kept for existing screens: every showToast call now uses the shared Phi Tech toasts.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const showToast = useCallback((message: string, type: ToastType = 'success') => notify(message, type), []);
  const value = useMemo(() => ({ showToast }), [showToast]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
