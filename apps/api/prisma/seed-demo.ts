/**
 * Demo seed script — populates the database with sample data for development
 * and showcasing. Run with: make seed-demo
 *
 * Creates:
 * - 10 demo users with varied ratings and preferences
 * - 5 accepted friendships with admin
 * - 2 pending friend requests to admin
 * - 1 collection for admin with sample games
 * - 6 completed bot games for admin (mix of wins/losses/draws)
 * - 2 completed games between demo users
 *
 * All demo users use password: demo123456
 * Idempotent — safe to run multiple times.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { Chess } from "chess.js";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo123456";

const DEMO_USERS = [
  { username: "magnus_fan", email: "magnus@demo.local", rating: 1850, boardTheme: "wood" },
  { username: "knight_rider", email: "knight@demo.local", rating: 1420, boardTheme: "green" },
  { username: "queen_gambit", email: "queen@demo.local", rating: 1680, boardTheme: "blue" },
  { username: "pawn_star", email: "pawn@demo.local", rating: 1100, boardTheme: "classic" },
  { username: "bishop_pair", email: "bishop@demo.local", rating: 1550, boardTheme: "purple" },
  { username: "rook_n_roll", email: "rook@demo.local", rating: 1320, boardTheme: "dark" },
  { username: "checkmate_charlie", email: "charlie@demo.local", rating: 1750, boardTheme: "wood" },
  { username: "en_passant", email: "enpassant@demo.local", rating: 1200, boardTheme: "classic" },
  { username: "castle_king", email: "castle@demo.local", rating: 1600, boardTheme: "green" },
  { username: "blitz_master", email: "blitz@demo.local", rating: 1900, boardTheme: "blue" },
];

// Sample short games (SAN moves) for realistic game history
const SAMPLE_GAMES = [
  // Scholar's mate (white wins)
  {
    moves: ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"],
    result: "WHITE_WIN" as const,
    termination: "CHECKMATE" as const,
  },
  // Fool's mate (black wins)
  {
    moves: ["f3", "e5", "g4", "Qh4#"],
    result: "BLACK_WIN" as const,
    termination: "CHECKMATE" as const,
  },
  // Short draw by agreement
  {
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "d3", "Nf6", "O-O", "O-O"],
    result: "DRAW" as const,
    termination: "AGREEMENT" as const,
  },
  // Italian game, white wins by resignation
  {
    moves: [
      "e4",
      "e5",
      "Nf3",
      "Nc6",
      "Bc4",
      "Bc5",
      "c3",
      "Nf6",
      "d4",
      "exd4",
      "cxd4",
      "Bb4+",
      "Nc3",
      "Nxe4",
      "O-O",
      "Nxc3",
      "bxc3",
      "Bxc3",
      "Qb3",
    ],
    result: "WHITE_WIN" as const,
    termination: "RESIGNATION" as const,
  },
  // Sicilian, black wins
  {
    moves: [
      "e4",
      "c5",
      "Nf3",
      "d6",
      "d4",
      "cxd4",
      "Nxd4",
      "Nf6",
      "Nc3",
      "a6",
      "Be2",
      "e5",
      "Nb3",
      "Be7",
      "O-O",
      "O-O",
    ],
    result: "BLACK_WIN" as const,
    termination: "RESIGNATION" as const,
  },
  // Queen's gambit draw
  {
    moves: [
      "d4",
      "d5",
      "c4",
      "e6",
      "Nc3",
      "Nf6",
      "Bg5",
      "Be7",
      "e3",
      "O-O",
      "Nf3",
      "Nbd7",
      "Rc1",
      "c6",
    ],
    result: "DRAW" as const,
    termination: "AGREEMENT" as const,
  },
];

async function createGame(
  whiteId: string | null,
  blackId: string | null,
  gameDef: (typeof SAMPLE_GAMES)[number],
  isVsBot: boolean,
  botElo: number | null,
  daysAgo: number
) {
  const chess = new Chess();
  const moveRecords: { ply: number; san: string; uci: string; fen: string }[] = [];

  for (let i = 0; i < gameDef.moves.length; i++) {
    const move = chess.move(gameDef.moves[i]);
    if (!move) break;
    moveRecords.push({
      ply: i + 1,
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion || ""}`,
      fen: chess.fen(),
    });
  }

  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const endedAt = new Date(createdAt.getTime() + 5 * 60 * 1000);

  const game = await prisma.game.create({
    data: {
      whiteId,
      blackId,
      status: "COMPLETED",
      result: gameDef.result,
      termination: gameDef.termination,
      fen: chess.fen(),
      pgn: chess.pgn(),
      timeControl: "RAPID",
      initialTime: 600,
      increment: 0,
      isVsBot,
      botElo,
      createdAt,
      startedAt: createdAt,
      endedAt,
      moves: {
        create: moveRecords,
      },
    },
  });

  return game;
}

async function main() {
  console.log("Starting demo seed...\n");

  // Find admin user
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    console.error("No admin user found. Run the regular seed first (make db-seed).");
    process.exit(1);
  }
  console.log(`Found admin: ${admin.username} (${admin.email})`);

  // Create demo users
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users: { id: string; username: string }[] = [];

  for (const u of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        username: u.username,
        passwordHash,
        rating: u.rating,
        verified: true,
        tosAccepted: true,
        tosAcceptedAt: new Date(),
        boardTheme: u.boardTheme,
        darkMode: true,
      },
    });
    users.push({ id: user.id, username: user.username });
    console.log(`  User: ${user.username} (rating: ${u.rating})`);
  }

  // Create friendships — batch check + create
  console.log("\nCreating friendships...");
  const friendUsers = users.slice(0, 5);
  const pendingUsers = users.slice(5, 7);

  // Check existing friendships in one query
  const existingFriendships = await prisma.friendship.findMany({
    where: {
      OR: [
        ...friendUsers.map((u) => ({ requesterId: admin.id, addresseeId: u.id })),
        ...pendingUsers.map((u) => ({ requesterId: u.id, addresseeId: admin.id })),
      ],
    },
    select: { requesterId: true, addresseeId: true },
  });
  const friendshipKeys = new Set(
    existingFriendships.map((f) => `${f.requesterId}:${f.addresseeId}`)
  );

  // Accepted friends
  const acceptedToCreate = friendUsers
    .filter((u) => !friendshipKeys.has(`${admin.id}:${u.id}`))
    .map((u) => ({ requesterId: admin.id, addresseeId: u.id, status: "ACCEPTED" as const }));
  if (acceptedToCreate.length > 0) {
    await prisma.friendship.createMany({ data: acceptedToCreate });
    for (const f of acceptedToCreate) {
      const u = users.find((u) => u.id === f.addresseeId);
      console.log(`  Friends: ${admin.username} <-> ${u?.username}`);
    }
  }

  // Pending requests
  const pendingToCreate = pendingUsers
    .filter((u) => !friendshipKeys.has(`${u.id}:${admin.id}`))
    .map((u) => ({ requesterId: u.id, addresseeId: admin.id, status: "PENDING" as const }));
  if (pendingToCreate.length > 0) {
    await prisma.friendship.createMany({ data: pendingToCreate });
    for (const f of pendingToCreate) {
      const u = users.find((u) => u.id === f.requesterId);
      console.log(`  Pending: ${u?.username} -> ${admin.username}`);
    }
  }

  // Create bot games for admin
  console.log("\nCreating bot games for admin...");
  const botGames = [
    { game: SAMPLE_GAMES[0], botElo: 800, daysAgo: 7, adminIsWhite: true },
    { game: SAMPLE_GAMES[1], botElo: 1200, daysAgo: 6, adminIsWhite: true },
    { game: SAMPLE_GAMES[2], botElo: 1000, daysAgo: 5, adminIsWhite: true },
    { game: SAMPLE_GAMES[3], botElo: 600, daysAgo: 3, adminIsWhite: true },
    { game: SAMPLE_GAMES[4], botElo: 1500, daysAgo: 2, adminIsWhite: false },
    { game: SAMPLE_GAMES[5], botElo: 1400, daysAgo: 1, adminIsWhite: true },
  ];

  const adminGameIds: string[] = [];
  for (const bg of botGames) {
    const whiteId = bg.adminIsWhite ? admin.id : null;
    const blackId = bg.adminIsWhite ? null : admin.id;
    const game = await createGame(whiteId, blackId, bg.game, true, bg.botElo, bg.daysAgo);
    adminGameIds.push(game.id);
    console.log(`  Bot game: admin vs Bot(${bg.botElo}) — ${bg.game.result} (${bg.daysAgo}d ago)`);
  }

  // Create games between demo users
  console.log("\nCreating games between demo users...");
  const g1 = await createGame(users[0].id, users[1].id, SAMPLE_GAMES[0], false, null, 4);
  console.log(`  ${users[0].username} vs ${users[1].username} — ${SAMPLE_GAMES[0].result}`);
  const g2 = await createGame(users[2].id, users[3].id, SAMPLE_GAMES[3], false, null, 2);
  console.log(`  ${users[2].username} vs ${users[3].username} — ${SAMPLE_GAMES[3].result}`);

  // Create a game between admin and a friend
  const g3 = await createGame(admin.id, users[0].id, SAMPLE_GAMES[4], false, null, 1);
  adminGameIds.push(g3.id);
  console.log(`  ${admin.username} vs ${users[0].username} — ${SAMPLE_GAMES[4].result}`);

  // Create collection for admin and add some games
  console.log("\nCreating collection...");
  const collection = await prisma.collection.upsert({
    where: { userId_name: { userId: admin.id, name: "Best Games" } },
    update: {},
    create: {
      userId: admin.id,
      name: "Best Games",
      description: "My best wins and interesting games",
    },
  });

  // Add first 3 admin games to collection (batched)
  const gameIdsToAdd = adminGameIds.slice(0, 3);
  const existingCollectionGames = await prisma.gameCollection.findMany({
    where: { collectionId: collection.id, gameId: { in: gameIdsToAdd } },
    select: { gameId: true },
  });
  const existingGameIds = new Set(existingCollectionGames.map((e) => e.gameId));
  const collectionToCreate = gameIdsToAdd
    .filter((gid) => !existingGameIds.has(gid))
    .map((gameId) => ({ gameId, collectionId: collection.id }));
  if (collectionToCreate.length > 0) {
    await prisma.gameCollection.createMany({ data: collectionToCreate });
  }
  console.log(`  Collection "${collection.name}" with ${Math.min(3, adminGameIds.length)} games`);

  // Create game notes for a couple of admin games
  console.log("\nCreating game notes...");
  if (adminGameIds[0]) {
    await prisma.gameNote.upsert({
      where: { userId_gameId: { userId: admin.id, gameId: adminGameIds[0] } },
      update: {},
      create: {
        userId: admin.id,
        gameId: adminGameIds[0],
        content: "Nice scholar's mate against the bot. Classic opening trap!",
      },
    });
    console.log("  Note on game 1");
  }
  if (adminGameIds[3]) {
    await prisma.gameNote.upsert({
      where: { userId_gameId: { userId: admin.id, gameId: adminGameIds[3] } },
      update: {},
      create: {
        userId: admin.id,
        gameId: adminGameIds[3],
        content: "Italian game gone right. The bishop sacrifice was key.",
      },
    });
    console.log("  Note on game 4");
  }

  console.log("\n--- Demo seed complete ---");
  console.log(`  ${users.length} demo users (password: ${DEMO_PASSWORD})`);
  console.log(`  5 accepted friendships + 2 pending requests`);
  console.log(`  ${adminGameIds.length} admin games + 2 user-vs-user games`);
  console.log(`  1 collection with 3 games`);
  console.log(`  2 game notes`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
