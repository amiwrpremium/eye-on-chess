import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { parse } from "yaml";
import { resolve } from "path";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_USER_EMAIL;
  const username = process.env.SEED_USER_USERNAME;
  const password = process.env.SEED_USER_PASSWORD;

  if (!email || !username || !password) {
    console.log(
      "Skipping seed: SEED_USER_EMAIL, SEED_USER_USERNAME, and SEED_USER_PASSWORD must be set"
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      username,
      passwordHash,
      verified: true,
      tosAccepted: true,
      tosAcceptedAt: new Date(),
      role: "ADMIN",
    },
  });

  // Seed default site settings
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      siteName: process.env.SITE_NAME || "EyeOnChess",
      registrationOpen: process.env.REGISTRATION_OPEN !== "false",
      maxUsers: parseInt(process.env.MAX_USERS || "0"),
      requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
    },
  });

  // Create Favorites collection for admin
  await prisma.collection.upsert({
    where: { userId_name: { userId: user.id, name: "Favorites" } },
    update: {},
    create: { userId: user.id, name: "Favorites" },
  });

  // Create initial invite codes for admin (if none exist)
  const existingInvites = await prisma.invite.count({ where: { creatorId: user.id } });
  if (existingInvites === 0) {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = randomUUID();
      await prisma.invite.create({ data: { code, creatorId: user.id } });
      codes.push(code);
    }
    console.log(`Created 10 invite codes for admin. First code: ${codes[0]}`);
  }

  console.log(`Seeded admin: ${user.username} (${user.email})`);

  // Seed bot profiles from YAML
  const existingBots = await prisma.botProfile.count();
  if (existingBots === 0) {
    const yamlPaths = [
      resolve(process.cwd(), "../../deployment/config/bots.yml"),
      resolve(process.cwd(), "deployment/config/bots.yml"),
      "/app/config/bots.yml",
    ];
    let bots: {
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
    }[] = [];
    for (const p of yamlPaths) {
      try {
        const data = parse(readFileSync(p, "utf-8"));
        if (data?.bots) {
          bots = data.bots;
          break;
        }
      } catch {
        /* try next */
      }
    }
    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      await prisma.botProfile.create({
        data: {
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
    }
    if (bots.length > 0) console.log(`Seeded ${bots.length} bot profiles from YAML`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
