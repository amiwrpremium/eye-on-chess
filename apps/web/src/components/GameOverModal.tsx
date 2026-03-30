"use client";

export interface GameOverModalProps {
  gameOver: {
    result: string;
    termination: string;
    ratingChange: { white: number; black: number };
  };
  rematchIncoming: boolean;
  rematchOffered: boolean;
  onRematchOffer: () => void;
  onRematchAccept: () => void;
  onRematchDecline: () => void;
  onClose: () => void;
  resultLabel: string;
}

/**
 * Modal dialog displayed when a game ends, showing the result, rating changes,
 * and rematch/close actions. Supports both offering and accepting rematches.
 */
export default function GameOverModal({
  gameOver,
  rematchIncoming,
  rematchOffered,
  onRematchOffer,
  onRematchAccept,
  onRematchDecline,
  onClose,
  resultLabel,
}: GameOverModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
    >
      <div className="bg-gray-900 rounded-lg p-6 max-w-sm w-full mx-4 text-center">
        <h2 id="game-over-title" className="text-xl font-bold mb-2">
          Game Over
        </h2>
        <p className="text-gray-300 mb-4">{resultLabel}</p>
        {gameOver.ratingChange && (
          <div className="flex justify-center gap-6 mb-4 text-sm">
            <div>
              <span className="text-gray-400">White: </span>
              <span
                className={gameOver.ratingChange.white >= 0 ? "text-green-400" : "text-red-400"}
              >
                {gameOver.ratingChange.white >= 0 ? "+" : ""}
                {gameOver.ratingChange.white}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Black: </span>
              <span
                className={gameOver.ratingChange.black >= 0 ? "text-green-400" : "text-red-400"}
              >
                {gameOver.ratingChange.black >= 0 ? "+" : ""}
                {gameOver.ratingChange.black}
              </span>
            </div>
          </div>
        )}
        <div className="flex gap-3">
          {rematchIncoming ? (
            <>
              <button
                onClick={onRematchAccept}
                className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded font-medium transition-colors"
              >
                Accept Rematch
              </button>
              <button
                onClick={onRematchDecline}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
              >
                Decline
              </button>
            </>
          ) : (
            <>
              {rematchOffered ? (
                <div className="flex-1 py-2 bg-green-600/30 border border-green-600/50 rounded font-medium text-green-400 flex items-center justify-center gap-2 animate-pulse">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Waiting for opponent...
                </div>
              ) : (
                <button
                  onClick={onRematchOffer}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded font-medium transition-colors"
                >
                  Rematch
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded font-medium transition-colors"
              >
                Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
