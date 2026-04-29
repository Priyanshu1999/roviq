'use client';

import { ThemeProvider } from 'next-themes';
import type * as React from 'react';
import { Toaster } from 'sonner';
import { BottomTabBar } from './bottom-tab-bar';
import { CommandPalette } from './command-palette';
import { PageErrorBoundary } from './error-boundary';
import { DesktopSidebar, SidebarProvider } from './sidebar';
import { Topbar } from './topbar';
import type { LayoutConfig } from './types';

export function AdminLayout({
  config,
  children,
}: {
  config: LayoutConfig;
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden">
          <DesktopSidebar config={config} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Topbar config={config} />
            {config.bottomNav && config.navRegistry && (
              <BottomTabBar bottomNav={config.bottomNav} navRegistry={config.navRegistry} />
            )}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 xl:pb-6">
              <PageErrorBoundary>{children}</PageErrorBoundary>
            </main>
          </div>
        </div>
        <CommandPalette config={config} />
        <Toaster position="bottom-right" richColors />
      </SidebarProvider>
    </ThemeProvider>
  );
}
