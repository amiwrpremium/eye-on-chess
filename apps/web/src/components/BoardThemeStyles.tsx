"use client";

import { useSettingsStore, BoardTheme, PieceSet } from "../stores/settings";

const BOARD_COLORS: Record<BoardTheme, { light: string; dark: string }> = {
  classic: { light: "#f0d9b5", dark: "#b58863" },
  wood: { light: "#e8c98e", dark: "#a67c52" },
  green: { light: "#ffffdd", dark: "#86a666" },
  blue: { light: "#dee3e6", dark: "#8ca2ad" },
  purple: { light: "#e8d0ff", dark: "#9070b0" },
  dark: { light: "#4b4847", dark: "#302e2b" },
};

const PIECE_FILTERS: Record<PieceSet, string> = {
  classic: "none",
  modern: "saturate(1.2) contrast(1.1)",
  minimal: "grayscale(0.3) contrast(1.3)",
};

export default function BoardThemeStyles() {
  const boardTheme = useSettingsStore((s) => s.boardTheme);
  const pieceSet = useSettingsStore((s) => s.pieceSet);

  const colors = BOARD_COLORS[boardTheme] || BOARD_COLORS.classic;
  const filter = PIECE_FILTERS[pieceSet] || "none";

  return (
    <style jsx global>{`
      cg-board {
        background-color: ${colors.dark} !important;
        background-image: none !important;
      }
      cg-board square.white {
        background-color: ${colors.light} !important;
      }
      cg-board square.black {
        background-color: ${colors.dark} !important;
      }
      ${filter !== "none" ? `cg-board piece { filter: ${filter} !important; }` : ""}
    `}</style>
  );
}
