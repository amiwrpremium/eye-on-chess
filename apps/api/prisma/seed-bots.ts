/**
 * Bot personality seeder — reads bot definitions from deployment/config/bots.yml
 * and populates the BotProfile table.
 *
 * Default mode: create-only (skips existing bots to preserve admin edits).
 * Force mode: FORCE_RESEED=1 to upsert all bots from YAML (overwrites DB).
 *
 * Run with: make seed-bots
 * Force:    FORCE_RESEED=1 make seed-bots
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { parse } from "yaml";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

export interface BotDef {
  id: string;
  name: string;
  elo: number;
  description: string;
  avatar: string;
  tier: string;
  category: string;
  randomMoveChance: number;
  blunderChance: number;
  captureGreed: number;
  aggressionBias: number;
  maxDepth: number;
  queenEarly: boolean;
  pawnPusher: boolean;
  messages?: Record<string, string[]>;
  preferredOpenings?: { asWhite?: string[]; asBlack?: string[] };
}

export function loadBotsFromYaml(): BotDef[] {
  const paths = [
    resolve(process.cwd(), "../../deployment/config/bots.yml"),
    resolve(process.cwd(), "deployment/config/bots.yml"),
    resolve(__dirname, "../../../deployment/config/bots.yml"),
    "/app/config/bots.yml",
  ];

  for (const p of paths) {
    try {
      const content = readFileSync(p, "utf-8");
      const data = parse(content);
      if (data?.bots && Array.isArray(data.bots)) {
        console.log(`Loaded bots from: ${p}`);
        return data.bots;
      }
    } catch {
      // Try next path
    }
  }

  console.error("Could not find bots.yml — tried:", paths.join(", "));
  process.exit(1);
}

function botData(bot: BotDef, sortOrder: number) {
  return {
    botId: bot.id,
    name: bot.name,
    elo: bot.elo,
    description: bot.description,
    avatar: bot.avatar,
    category: bot.category,
    tier: bot.tier,
    randomMoveChance: bot.randomMoveChance,
    blunderChance: bot.blunderChance,
    captureGreed: bot.captureGreed,
    aggressionBias: bot.aggressionBias,
    maxDepth: bot.maxDepth,
    queenEarly: bot.queenEarly,
    pawnPusher: bot.pawnPusher,
    sortOrder,
    messages: bot.messages ?? undefined,
    preferredOpenings: bot.preferredOpenings ?? undefined,
  };
}

async function main() {
  const forceReseed = process.env.FORCE_RESEED === "1";
  console.log(
    forceReseed
      ? "Force-reseeding bot profiles from bots.yml (overwrites DB)...\n"
      : "Seeding bot profiles from bots.yml (create-only, preserves admin edits)...\n"
  );

  const bots = loadBotsFromYaml();

  const existing = await prisma.botProfile.findMany({
    where: { botId: { in: bots.map((b) => b.id) } },
    select: { botId: true },
  });
  const existingIds = new Set(existing.map((e) => e.botId));

  // Create new bots
  const toCreate = bots
    .map((bot, i) => ({ bot, sortOrder: i }))
    .filter(({ bot }) => !existingIds.has(bot.id));

  if (toCreate.length > 0) {
    await prisma.botProfile.createMany({
      data: toCreate.map(({ bot, sortOrder }) => botData(bot, sortOrder)),
    });
    for (const { bot } of toCreate) {
      console.log(`  + ${bot.avatar} ${bot.name} (${bot.elo}) — ${bot.category}`);
    }
  }

  // Force reseed: overwrite existing bots with YAML values
  let updated = 0;
  if (forceReseed) {
    const toUpdate = bots
      .map((bot, i) => ({ bot, sortOrder: i }))
      .filter(({ bot }) => existingIds.has(bot.id));

    for (const { bot, sortOrder } of toUpdate) {
      await prisma.botProfile.update({
        where: { botId: bot.id },
        data: botData(bot, sortOrder),
      });
      updated++;
    }
  } else {
    const skipped = existingIds.size;
    if (skipped > 0) {
      console.log(`  Skipping ${skipped} existing bots (edit via admin panel)`);
    }
  }

  console.log(`\nBot seed complete: ${toCreate.length} created, ${updated} updated.`);
}

// Only run when executed directly (not when imported by admin routes)
const isDirectRun =
  process.argv[1]?.endsWith("seed-bots.ts") || process.argv[1]?.endsWith("seed-bots.js");
if (isDirectRun) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
