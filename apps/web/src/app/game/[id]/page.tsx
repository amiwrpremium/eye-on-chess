"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "../../../lib/api";
import { useAuthStore } from "../../../stores/auth";
import { connectSocket, getSocket } from "../../../lib/socket";
import ChessBoard from "../../../components/ChessBoard";
import MoveList from "../../../components/MoveList";
import PlayerClock from "../../../components/PlayerClock";
import ConfirmModal from "../../../components/ConfirmModal";

interface Player {
  id: string;
  username: string;
  rating: number;
  avatarUrl: string | null;
}

interface MoveRecord {
  ply: number;
  san: string;
  fen: string;
}

interface Clocks {
  whiteTimeLeft: number;
  blackTimeLeft: number;
  turn: "white" | "black";
  lastMoveTimestamp: number;
}

interface GameOver {
  result: string;
  termination: string;
  ratingChange: { white: number; black: number };
}

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;
  const { user, fetchMe } = useAuthStore();

  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [white, setWhite] = useState<Player | null>(null);
  const [black, setBlack] = useState<Player | null>(null);
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const [lastMove, setLastMove] = useState<[string, string] | undefined>();
  const [clocks, setClocks] = useState<Clocks | null>(null);
  const [status, setStatus] = useState<string>("WAITING");
  const [timeControl, setTimeControl] = useState<string>("RAPID");
  const [gameOver, setGameOver] = useState<GameOver | null>(null);
  const [drawOffered, setDrawOffered] = useState(false);
  const [drawIncoming, setDrawIncoming] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [confirmDraw, setConfirmDraw] = useState(false);
  const [confirmAcceptDraw, setConfirmAcceptDraw] = useState(false);

  const joinedRef = useRef(false);

  const isWhite = user?.id === white?.id;
  const orientation = isWhite ? "white" : "black";
  const isMyTurn =
    status === "ACTIVE" &&
    ((clocks?.turn === "white" && isWhite) || (clocks?.turn === "black" && !isWhite));
  const isActive = status === "ACTIVE";

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (user) connectSocket();
  }, [user]);

  // Load initial game state via REST
  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/api/games/${gameId}`);
        const g = data.game;
        setWhite(g.white);
        setBlack(g.black);
        setFen(g.fen);
        setStatus(g.status);
        setTimeControl(g.timeControl);

        if (g.moves && g.moves.length > 0) {
          const moveRecords = g.moves.map((m: { ply: number; san: string; fen: string }) => ({
            ply: m.ply,
            san: m.san,
            fen: m.fen,
          }));
          setMoves(moveRecords);
          setCurrentPly(moveRecords.length);
          const last = g.moves[g.moves.length - 1];
          if (last.uci && last.uci.length >= 4) {
            setLastMove([last.uci.slice(0, 2), last.uci.slice(2, 4)]);
          }
        }
      } catch {
        router.push("/play");
      }
    }
    load();
  }, [gameId, router]);

  // Join game room via socket
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user || joinedRef.current) return;

    socket.emit("game:join", gameId);
    joinedRef.current = true;

    // Full state on reconnect
    socket.on("game:state", (data) => {
      const g = data.game;
      setWhite(g.white);
      setBlack(g.black);
      setFen(g.fen);
      setStatus(g.status);
      if (data.clocks) setClocks(data.clocks);
      if (g.moves && g.moves.length > 0) {
        const moveRecords = g.moves.map((m: { ply: number; san: string; fen: string }) => ({
          ply: m.ply,
          san: m.san,
          fen: m.fen,
        }));
        setMoves(moveRecords);
        setCurrentPly(moveRecords.length);
      }
      setReconnecting(false);
    });

    socket.on("game:moved", (data) => {
      setFen(data.fen);
      setMoves((prev) => [...prev, { ply: data.ply, san: data.san, fen: data.fen }]);
      setCurrentPly(data.ply);
      setLastMove([data.from, data.to]);
      if (data.clocks) setClocks(data.clocks);
      setDrawIncoming(false);
      setDrawOffered(false);
    });

    socket.on("game:over", (data: GameOver) => {
      setGameOver(data);
      setStatus("COMPLETED");
    });

    socket.on("game:draw:offered", () => {
      setDrawIncoming(true);
    });

    socket.on("game:draw:declined", () => {
      setDrawOffered(false);
    });

    socket.on("game:error", (data: { message: string }) => {
      console.error("Game error:", data.message);
    });

    socket.on("disconnect", () => {
      setReconnecting(true);
    });

    socket.on("connect", () => {
      if (joinedRef.current) {
        socket.emit("game:join", gameId);
      }
      setReconnecting(false);
    });

    return () => {
      socket.off("game:state");
      socket.off("game:moved");
      socket.off("game:over");
      socket.off("game:draw:offered");
      socket.off("game:draw:declined");
      socket.off("game:error");
    };
  }, [gameId, user]);

  const handleMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      const socket = getSocket();
      if (!socket || !isMyTurn) return;
      socket.emit("game:move", { gameId, from, to, promotion });
    },
    [gameId, isMyTurn]
  );

  function resign() {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("game:resign", gameId);
  }

  function offerDraw() {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("game:draw:offer", gameId);
    setDrawOffered(true);
  }

  function acceptDraw() {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("game:draw:accept", gameId);
  }

  function declineDraw() {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("game:draw:decline", gameId);
    setDrawIncoming(false);
  }

  function goToPly(ply: number) {
    setCurrentPly(ply);
  }

  const displayFen =
    currentPly === 0
      ? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
      : moves.find((m) => m.ply === currentPly)?.fen || fen;

  const isViewingLatest = currentPly === moves.length;

  // Players based on orientation
  const topPlayer = isWhite ? black : white;
  const bottomPlayer = isWhite ? white : black;
  const topClockMs = isWhite ? (clocks?.blackTimeLeft ?? 0) : (clocks?.whiteTimeLeft ?? 0);
  const bottomClockMs = isWhite ? (clocks?.whiteTimeLeft ?? 0) : (clocks?.blackTimeLeft ?? 0);
  const topActive = isWhite ? clocks?.turn === "black" : clocks?.turn === "white";
  const bottomActive = isWhite ? clocks?.turn === "white" : clocks?.turn === "black";

  const isUnlimited = timeControl === "UNLIMITED";

  function resultLabel(go: GameOver) {
    const labels: Record<string, string> = {
      WHITE_WIN: "White wins",
      BLACK_WIN: "Black wins",
      DRAW: "Draw",
      ABORTED: "Game aborted",
    };
    const termLabels: Record<string, string> = {
      CHECKMATE: "by checkmate",
      RESIGNATION: "by resignation",
      TIMEOUT: "on time",
      AGREEMENT: "by agreement",
    };
    return `${labels[go.result] || go.result} ${termLabels[go.termination] || ""}`;
  }

  return (
    <main className="flex flex-col items-center min-h-screen p-4 pt-8">
      <div className="max-w-5xl w-full">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Board column */}
          <div className="flex flex-col gap-2">
            {/* Top player */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold">
                  {topPlayer?.username?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <span className="font-medium text-sm">{topPlayer?.username || "Opponent"}</span>
                  <span className="text-gray-400 text-xs ml-1">({topPlayer?.rating || "?"})</span>
                </div>
              </div>
              {!isUnlimited && clocks && (
                <PlayerClock timeMs={topClockMs} isActive={!!topActive} isRunning={isActive} />
              )}
            </div>

            {/* Board */}
            <div className="w-[min(100%,480px)]">
              <ChessBoard
                fen={displayFen}
                orientation={orientation}
                movable={isActive && isMyTurn && isViewingLatest}
                lastMove={lastMove}
                check={false}
                onMove={handleMove}
              />
            </div>

            {/* Bottom player */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold">
                  {bottomPlayer?.username?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <span className="font-medium text-sm">{bottomPlayer?.username || "You"}</span>
                  <span className="text-gray-400 text-xs ml-1">
                    ({bottomPlayer?.rating || "?"})
                  </span>
                </div>
              </div>
              {!isUnlimited && clocks && (
                <PlayerClock
                  timeMs={bottomClockMs}
                  isActive={!!bottomActive}
                  isRunning={isActive}
                />
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="flex-1 space-y-4 min-w-0">
            <MoveList moves={moves} currentPly={currentPly} onGoToPly={goToPly} />

            {/* Navigation */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => goToPly(0)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                &laquo;
              </button>
              <button
                onClick={() => goToPly(Math.max(0, currentPly - 1))}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                &lsaquo;
              </button>
              <button
                onClick={() => goToPly(Math.min(moves.length, currentPly + 1))}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                &rsaquo;
              </button>
              <button
                onClick={() => goToPly(moves.length)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                &raquo;
              </button>
            </div>

            {/* Game actions */}
            {isActive && (
              <div className="flex gap-2">
                {drawIncoming ? (
                  <div className="flex-1 flex gap-2">
                    <button
                      onClick={() => setConfirmAcceptDraw(true)}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition-colors"
                    >
                      Accept Draw
                    </button>
                    <button
                      onClick={declineDraw}
                      className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-medium transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setConfirmDraw(true)}
                      disabled={drawOffered}
                      className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm font-medium transition-colors"
                    >
                      {drawOffered ? "Draw Offered" : "Offer Draw"}
                    </button>
                    <button
                      onClick={() => setConfirmResign(true)}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors"
                    >
                      Resign
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Back to play */}
            {!isActive && (
              <div className="text-center">
                <button
                  onClick={() => router.push("/play")}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
                >
                  Back to Play
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reconnecting overlay */}
      {reconnecting && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40">
          <div className="bg-gray-900 rounded-lg p-6 text-center">
            <p className="text-lg font-medium mb-2">Reconnecting...</p>
            <p className="text-gray-400 text-sm">Trying to reconnect to the game</p>
          </div>
        </div>
      )}

      {/* Game over modal */}
      {gameOver && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-sm w-full mx-4 text-center">
            <h2 className="text-xl font-bold mb-2">Game Over</h2>
            <p className="text-gray-300 mb-4">{resultLabel(gameOver)}</p>
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
            <button
              onClick={() => {
                setGameOver(null);
                router.push("/play");
              }}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
            >
              Back to Play
            </button>
          </div>
        </div>
      )}

      {/* Confirmation modals */}
      <ConfirmModal
        open={confirmResign}
        title="Resign?"
        message="Are you sure you want to resign this game? Your opponent will win."
        confirmLabel="Resign"
        confirmVariant="danger"
        onConfirm={() => {
          resign();
          setConfirmResign(false);
        }}
        onCancel={() => setConfirmResign(false)}
      />
      <ConfirmModal
        open={confirmDraw}
        title="Offer Draw?"
        message="Are you sure you want to offer a draw to your opponent?"
        confirmLabel="Offer Draw"
        confirmVariant="primary"
        onConfirm={() => {
          offerDraw();
          setConfirmDraw(false);
        }}
        onCancel={() => setConfirmDraw(false)}
      />
      <ConfirmModal
        open={confirmAcceptDraw}
        title="Accept Draw?"
        message="Are you sure you want to accept the draw offer? The game will end as a draw."
        confirmLabel="Accept"
        confirmVariant="primary"
        onConfirm={() => {
          acceptDraw();
          setConfirmAcceptDraw(false);
        }}
        onCancel={() => setConfirmAcceptDraw(false)}
      />
    </main>
  );
}
