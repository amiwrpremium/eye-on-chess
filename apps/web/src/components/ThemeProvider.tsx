"use client";

import { useEffect } from "react";
import { useSettingsStore } from "../stores/settings";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const darkMode = useSettingsStore((s) => s.darkMode);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  return <>{children}</>;
}
