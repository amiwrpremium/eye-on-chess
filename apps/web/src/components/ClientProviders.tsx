"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import ThemeProvider from "./ThemeProvider";
import BoardThemeStyles from "./BoardThemeStyles";
import ErrorBoundary from "./ErrorBoundary";
import TosGate from "./TosGate";
import { useUpdateNotification, checkDeferredUpdate } from "../lib/useUpdateNotification";

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

  // PWA update detection
  useUpdateNotification();
  useEffect(() => {
    checkDeferredUpdate();
  }, []);

  return (
    <ThemeProvider>
      <BoardThemeStyles />
      <ErrorBoundary>{isExempt ? children : <TosGate>{children}</TosGate>}</ErrorBoundary>
    </ThemeProvider>
  );
}
