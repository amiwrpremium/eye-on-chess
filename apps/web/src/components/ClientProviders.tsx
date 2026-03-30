"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Toast } from "@eyeonchess/ui";
import ThemeProvider from "./ThemeProvider";
import BoardThemeStyles from "./BoardThemeStyles";
import ErrorBoundary from "./ErrorBoundary";
import TosGate from "./TosGate";
import { useUpdateNotification, checkDeferredUpdate } from "../lib/useUpdateNotification";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { useInstallPrompt } from "../lib/useInstallPrompt";

// Pages that don't require TOS acceptance
const TOS_EXEMPT_PATHS = ["/legal", "/login", "/register", "/board-test"];

/**
 * Top-level client component that wraps the app in ThemeProvider, BoardThemeStyles,
 * ErrorBoundary, and TosGate. Exempts certain paths (legal, login, register) from TOS checks.
 *
 * @param props - Children to render inside the provider stack.
 * @returns The composed provider tree wrapping the application content.
 */
export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isExempt = TOS_EXEMPT_PATHS.some((p) => pathname.startsWith(p)) || pathname === "/";

  const isOnline = useOnlineStatus();
  const { canInstall, install } = useInstallPrompt();

  // PWA update detection
  useUpdateNotification();
  useEffect(() => {
    checkDeferredUpdate();
  }, []);

  return (
    <ThemeProvider>
      <BoardThemeStyles />
      <Toast />
      {!isOnline && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-yellow-900/90 border border-yellow-700 rounded-full text-xs text-yellow-300 shadow-lg">
          You&apos;re offline &mdash; bot games still work
        </div>
      )}
      {canInstall && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-full shadow-lg text-sm text-white">
          <span>Install EyeOnChess app</span>
          <button
            onClick={install}
            className="px-3 py-1 bg-white text-blue-600 rounded-full text-xs font-bold"
          >
            Install
          </button>
        </div>
      )}
      <ErrorBoundary>{isExempt ? children : <TosGate>{children}</TosGate>}</ErrorBoundary>
    </ThemeProvider>
  );
}
