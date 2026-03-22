/**
 * Bot personality seeder — reads bot definitions from deployment/config/bots.yml
 * and populates the BotProfile table. Idempotent via upsert on botId.
 *
 * Run with: make seed-bots
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { parse } from "yaml";
import { resolve } from "path";

const prisma = new PrismaClient();

interface BotDef {
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
}

function loadBotsFromYaml(): BotDef[] {
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

async function main() {
  console.log("Seeding bot profiles from bots.yml...\n");

  const bots = loadBotsFromYaml();

  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i];
    await prisma.botProfile.upsert({
      where: { botId: bot.id },
      update: {
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
        sortOrder: i,
      },
      create: {
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
        sortOrder: i,
      },
    });
    console.log(`  ${bot.avatar} ${bot.name} (${bot.elo}) — ${bot.category}`);
  }

  console.log(`\nSeeded ${bots.length} bot profiles from YAML.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
