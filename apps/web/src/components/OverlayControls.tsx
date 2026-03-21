"use client";

import { useEffect, useState } from "react";

export interface OverlaySettings {
  evalBar: boolean;
  bestMove: boolean;
  threats: boolean;
  hints: boolean;
  moveFeedback: boolean;
}

const DEFAULT_OVERLAYS: OverlaySettings = {
  evalBar: true,
  bestMove: false,
  threats: false,
  hints: false,
  moveFeedback: true,
};

const STORAGE_KEY = "eyeonchess-overlays";

function loadOverlays(): OverlaySettings {
  if (typeof window === "undefined") return DEFAULT_OVERLAYS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_OVERLAYS, ...JSON.parse(stored) };
  } catch {
    // ignore
  }
  return DEFAULT_OVERLAYS;
}

function saveOverlays(settings: OverlaySettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

interface OverlayControlsProps {
  settings: OverlaySettings;
  onChange: (settings: OverlaySettings) => void;
}

export function useOverlaySettings() {
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_OVERLAYS);

  useEffect(() => {
    setSettings(loadOverlays());
  }, []);

  function update(newSettings: OverlaySettings) {
    setSettings(newSettings);
    saveOverlays(newSettings);
  }

  return { settings, update };
}

export default function OverlayControls({ settings, onChange }: OverlayControlsProps) {
  function toggle(key: keyof OverlaySettings) {
    onChange({ ...settings, [key]: !settings[key] });
  }

  const items: { key: keyof OverlaySettings; label: string }[] = [
    { key: "evalBar", label: "Evaluation Bar" },
    { key: "bestMove", label: "Best Move Arrow" },
    { key: "threats", label: "Threat Arrows" },
    { key: "hints", label: "Move Hints" },
    { key: "moveFeedback", label: "Move Feedback" },
  ];

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-400 mb-3">Overlays</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <label key={item.key} className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={settings[item.key]}
              onChange={() => toggle(item.key)}
              className="rounded"
            />
            {item.label}
          </label>
        ))}
      </div>
    </div>
  );
}
