'use client';

import { ThemeProvider } from 'next-themes';
import type * as React from 'react';
import { Toaster } from 'sonner';
import { cn } from '../../lib/utils';
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
        {/* Skip link — visible only when focused, lets keyboard users jump
            straight to the main content past the sidebar + topbar. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow-lg"
        >
          Skip to main
        </a>
        <div className="flex h-screen overflow-hidden">
          <DesktopSidebar config={config} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Topbar config={config} />
            {config.bottomNav && config.navRegistry && (
              <BottomTabBar bottomNav={config.bottomNav} navRegistry={config.navRegistry} />
            )}
            <main
              id="main-content"
              tabIndex={-1}
              className={cn(
                'flex-1 overflow-y-auto p-4 md:p-6',
                // Content scrolls all the way under the fixed bottom-tab bar
                // so the bar's translucent backdrop-blur picks up the page
                // content beneath it (matches iOS App Store behaviour). The
                // last item is kept reachable via scroll-padding so the
                // browser snaps it above the bar when scrolled into view.
                config.bottomNav &&
                  config.navRegistry &&
                  '[scroll-padding-bottom:5rem] xl:[scroll-padding-bottom:0]',
              )}
            >
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
