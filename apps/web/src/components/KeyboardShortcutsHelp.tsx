"use client";

interface Shortcut {
  key: string;
  description: string;
}

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
  shortcuts: Shortcut[];
}

/**
 * Renders a modal overlay listing available keyboard shortcuts as key/description pairs.
 * Closes when clicking the backdrop or the Esc button.
 *
 * @param props - {@link KeyboardShortcutsHelpProps}
 * @returns The shortcuts modal, or null when not open.
 */
export default function KeyboardShortcutsHelp({
  open,
  onClose,
  shortcuts,
}: KeyboardShortcutsHelpProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="bg-gray-900 rounded-lg p-5 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="text-gray-400 hover:text-white text-sm"
          >
            Esc
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between text-sm">
              <span className="text-gray-300">{s.description}</span>
              <kbd className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-400">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
