"use client";

import type { EvalPoint } from "../lib/useClientAnalysis";
import EvalGraph from "./EvalGraph";

interface AnalysisProgressProps {
  currentPly: number;
  totalMoves: number;
  progress: number;
  evalPoints: EvalPoint[];
  onCancel: () => void;
}

/**
 * Shows a progress bar and live eval graph during client-side game analysis.
 */
export default function AnalysisProgress({
  currentPly,
  totalMoves,
  progress,
  evalPoints,
  onCancel,
}: AnalysisProgressProps) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-300">
          Analyzing move {currentPly}/{totalMoves}...
        </span>
        <button
          onClick={onCancel}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
        >
          Cancel
        </button>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {evalPoints.length > 1 && (
        <EvalGraph points={evalPoints} currentPly={currentPly} onClickPly={() => {}} />
      )}
    </div>
  );
}
