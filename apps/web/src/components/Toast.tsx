"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";

interface ToastState {
  message: string | null;
  type: "success" | "error";
  show: (message: string, type?: "success" | "error") => void;
  clear: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  type: "success",
  show: (message, type = "success") => set({ message, type }),
  clear: () => set({ message: null }),
}));

export default function Toast() {
  const { message, type, clear } = useToast();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(clear, 300);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, clear]);

  if (!message) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      } ${type === "success" ? "bg-green-600" : "bg-red-600"}`}
    >
      <p className="text-sm font-medium text-white">{message}</p>
    </div>
  );
}
