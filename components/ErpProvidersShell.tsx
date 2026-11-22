"use client";

import React from 'react';
import "../app/workspace.css";
import "../app/brand.css";
import "../app/enterprise.css";
import "../app/enterprise-content.css";
import "../app/enterprise-dialogs.css";
import "../app/enterprise-layout.css";
import LayoutClient from '@/components/layout/LayoutClient';
import AutoLogoutWrapper from '@/components/AutoLogoutWrapper';
import Providers from '@/app/providers';
import GlobalErrorReporter from '@/components/GlobalErrorReporter';
import { SidebarProvider } from '@/lib/SidebarContext';
import AuthGuard from '@/components/authGuard';
import { PermissionsProvider } from '@/lib/PermissionsContext';
import { CompanyProvider } from '@/lib/CompanyContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import QueryProvider from '@/components/QueryProvider';
import { ConfirmProvider } from '@/components/ConfirmContext';
import GlobalNavigationShortcuts from '@/components/GlobalNavigationShortcuts';
import { RealtimeSyncProvider } from '@/lib/useRealtimeSync';

export default function ErpProvidersShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          .bg-master-container {
            position: fixed; inset: 0; z-index: -4;
            background-color: var(--bg-canvas, #07080b);
            overflow: hidden;
            pointer-events: none;
          }
          .bg-image-base {
            position: absolute; inset: 0;
            background-image: url('/ryc_login.jpeg');
            background-size: cover;
            background-position: center;
            filter: blur(80px);
            transform: scale(1.1);
            opacity: 0.08;
          }
          .bg-glass-tint {
            position: absolute; inset: 0; z-index: -3;
            background:
              radial-gradient(circle at 15% 10%, var(--ambient-orb-1, rgba(249, 115, 22, 0.13)), transparent 38%),
              radial-gradient(circle at 85% 85%, var(--ambient-orb-2, rgba(245, 158, 11, 0.08)), transparent 40%),
              linear-gradient(180deg, var(--bg-canvas, #07080b) 0%, var(--bg-canvas-secondary, #0b0d12) 100%);
            backdrop-filter: blur(15px);
          }
          .watermark-bg {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 50vw; max-width: 600px; opacity: 0.035; z-index: -2;
            pointer-events: none; user-select: none;
          }
        `,
      }} />
      <GlobalErrorReporter />
      <QueryProvider>
        <Providers>
          <ThemeProvider>
            <ConfirmProvider>
              <AutoLogoutWrapper>
                <AuthGuard>
                  <PermissionsProvider>
                    <CompanyProvider>
                      <RealtimeSyncProvider>
                        <SidebarProvider>
                          <LayoutClient>
                            <GlobalNavigationShortcuts />
                            <div style={{ position: 'relative', zIndex: 1 }}>
                              {children}
                            </div>
                          </LayoutClient>
                        </SidebarProvider>
                      </RealtimeSyncProvider>
                    </CompanyProvider>
                  </PermissionsProvider>
                </AuthGuard>
              </AutoLogoutWrapper>
            </ConfirmProvider>
          </ThemeProvider>
        </Providers>
      </QueryProvider>
    </>
  );
}
