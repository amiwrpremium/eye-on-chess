"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const UPDATE_PENDING_KEY = "eyeonchess-update-pending";

/**
 * Listens for service worker updates and notifies the user.
 * If not in an active game: auto-reloads after 3 seconds.
 * If in an active game: defers reload until user navigates away.
 */
export function useUpdateNotification() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return;

    const handleControllerChange = () => {
      const isInGame = pathname.startsWith("/play/bot/") && pathname !== "/play/bot";

      if (isInGame) {
        // Don't interrupt active game — defer reload
        try {
          sessionStorage.setItem(UPDATE_PENDING_KEY, "1");
        } catch {}
        // Show a non-intrusive message via dynamic import to avoid circular deps
        import("../components/Toast").then(({ useToast }) => {
          useToast.getState().show("Update available — will apply after your game");
        });
      } else {
        // Safe to reload
        import("../components/Toast").then(({ useToast }) => {
          useToast.getState().show("Updating to latest version...");
        });
        setTimeout(() => window.location.reload(), 3000);
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [pathname]);
}

/**
 * Check on mount if a deferred update was pending and reload.
 * Call this once in the root client provider.
 */
export function checkDeferredUpdate() {
  try {
    if (sessionStorage.getItem(UPDATE_PENDING_KEY)) {
      sessionStorage.removeItem(UPDATE_PENDING_KEY);
      window.location.reload();
    }
  } catch {}
}
