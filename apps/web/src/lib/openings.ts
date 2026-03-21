// Client-side ECO opening lookup (subset for move feedback)
const OPENINGS: { moves: string; name: string }[] = [
  { moves: "e4 e5 Nf3 Nc6 Bb5", name: "Ruy Lopez" },
  { moves: "e4 e5 Nf3 Nc6 Bc4", name: "Italian Game" },
  { moves: "e4 e5 Nf3 Nc6 d4", name: "Scotch Game" },
  { moves: "e4 e5 Nf3 Nf6", name: "Petrov's Defense" },
  { moves: "e4 e5 f4", name: "King's Gambit" },
  { moves: "e4 c5", name: "Sicilian Defense" },
  { moves: "e4 e6", name: "French Defense" },
  { moves: "e4 c6", name: "Caro-Kann Defense" },
  { moves: "e4 d5", name: "Scandinavian Defense" },
  { moves: "e4 Nf6", name: "Alekhine's Defense" },
  { moves: "d4 d5 c4", name: "Queen's Gambit" },
  { moves: "d4 d5 c4 e6", name: "Queen's Gambit Declined" },
  { moves: "d4 d5 c4 dxc4", name: "Queen's Gambit Accepted" },
  { moves: "d4 d5 c4 c6", name: "Slav Defense" },
  { moves: "d4 d5 Bf4", name: "London System" },
  { moves: "d4 Nf6 c4 g6 Nc3 Bg7", name: "King's Indian Defense" },
  { moves: "d4 Nf6 c4 e6 Nc3 Bb4", name: "Nimzo-Indian Defense" },
  { moves: "d4 Nf6 c4 e6 g3", name: "Catalan Opening" },
  { moves: "d4 f5", name: "Dutch Defense" },
  { moves: "c4", name: "English Opening" },
  { moves: "Nf3", name: "Reti Opening" },
  { moves: "e4 e5", name: "King's Pawn Game" },
  { moves: "d4 d5", name: "Queen's Pawn Game" },
  { moves: "d4 Nf6", name: "Indian Defense" },
  { moves: "e4 e5 Nf3 Nc6", name: "King's Knight Opening" },
];

OPENINGS.sort((a, b) => b.moves.length - a.moves.length);

export function lookupOpeningClient(moveSans: string[]): { name: string } | null {
  const moveString = moveSans.join(" ");
  for (const entry of OPENINGS) {
    if (moveString === entry.moves || moveString.startsWith(entry.moves + " ")) {
      return { name: entry.name };
    }
  }
  return null;
}
