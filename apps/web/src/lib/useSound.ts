"use client";

import { useRef, useCallback } from "react";
import { useSettingsStore } from "../stores/settings";

type SoundName = "move" | "capture" | "check" | "castle" | "gameover" | "notify" | "lowtime" | "undo";

const SOUND_FILES: Record<SoundName, string> = {
  move: "/sounds/move.wav",
  capture: "/sounds/capture.wav",
  check: "/sounds/check.wav",
  castle: "/sounds/castle.wav",
  gameover: "/sounds/gameover.wav",
  notify: "/sounds/notify.wav",
  lowtime: "/sounds/lowtime.wav",
  undo: "/sounds/undo.wav",
};

interface ChessMoveInfo {
  captured?: string;
  san: string;
  flags?: string;
}

/**
 * Determines the appropriate sound effect for a chess move based on its properties.
 *
 * @param move - The move info containing SAN notation, capture status, and flags.
 * @returns The sound name to play (e.g., "check", "capture", "castle", "move").
 */
export function detectMoveSound(move: ChessMoveInfo): SoundName {
  // Check/checkmate
  if (move.san.includes("+") || move.san.includes("#")) return "check";
  // Capture
  if (move.captured) return "capture";
  // Castling
  if (move.san === "O-O" || move.san === "O-O-O") return "castle";
  if (move.flags && (move.flags.includes("k") || move.flags.includes("q"))) return "castle";
  // Default
  return "move";
}

/**
 * Hook that provides cached audio playback methods for chess sound effects.
 * Respects the user's sound-enabled setting from the settings store.
 *
 * @returns An object with individual play methods (playMove, playCapture, etc.) and a generic `play` function.
 */
export function useSound() {
  const audioCache = useRef<Map<SoundName, HTMLAudioElement>>(new Map());

  const play = useCallback((name: SoundName) => {
    const enabled = useSettingsStore.getState().soundEnabled;
    if (!enabled) return;

    let audio = audioCache.current.get(name);
    if (!audio) {
      audio = new Audio(SOUND_FILES[name]);
      audioCache.current.set(name, audio);
    }

    // Reset and play (allows rapid consecutive plays)
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Browser blocked autoplay — ignore silently
    });
  }, []);

  const playMove = useCallback(() => play("move"), [play]);
  const playCapture = useCallback(() => play("capture"), [play]);
  const playCheck = useCallback(() => play("check"), [play]);
  const playCastle = useCallback(() => play("castle"), [play]);
  const playGameOver = useCallback(() => play("gameover"), [play]);
  const playNotify = useCallback(() => play("notify"), [play]);
  const playLowTime = useCallback(() => play("lowtime"), [play]);
  const playUndo = useCallback(() => play("undo"), [play]);

  const playForMove = useCallback(
    (move: ChessMoveInfo) => {
      play(detectMoveSound(move));
    },
    [play]
  );

  return {
    play,
    playMove,
    playCapture,
    playCheck,
    playCastle,
    playGameOver,
    playNotify,
    playLowTime,
    playUndo,
    playForMove,
  };
}
