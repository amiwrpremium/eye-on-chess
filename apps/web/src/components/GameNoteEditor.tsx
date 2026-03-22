"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import api from "../lib/api";

interface GameNoteEditorProps {
  gameId: string;
  compact?: boolean; // compact mode for game cards (just icon + preview)
}

export default function GameNoteEditor({ gameId, compact = false }: GameNoteEditorProps) {
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    api
      .get(`/api/games/${gameId}/notes`)
      .then(({ data }) => {
        if (data.note) setText(data.note.text);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [gameId]);

  const save = useCallback(
    async (value: string) => {
      setSaving(true);
      setSaved(false);
      try {
        await api.put(`/api/games/${gameId}/notes`, { text: value });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {
        // ignore
      } finally {
        setSaving(false);
      }
    },
    [gameId]
  );

  function handleChange(value: string) {
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(value), 1000);
  }

  if (!loaded) return null;

  // Compact mode: just an icon and preview
  if (compact) {
    if (!text && !expanded) {
      return (
        <button
          onClick={() => setExpanded(true)}
          className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
          title="Add note"
        >
          +note
        </button>
      );
    }

    if (!expanded && text) {
      return (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-gray-400 hover:text-gray-200 truncate max-w-[120px] text-left transition-colors"
          title={text}
        >
          {text.slice(0, 30)}
          {text.length > 30 ? "..." : ""}
        </button>
      );
    }
  }

  // Full editor
  if (!expanded && compact) {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-400">Note</span>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-500">Saving...</span>}
          {saved && <span className="text-xs text-green-400">Saved</span>}
          <span className="text-xs text-gray-600">{text.length}/2000</span>
          {compact && (
            <button
              onClick={() => setExpanded(false)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Close
            </button>
          )}
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => {
          if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            save(text);
          }
        }}
        placeholder="Add a note about this game..."
        maxLength={2000}
        rows={compact ? 2 : 3}
        className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm resize-none focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}
