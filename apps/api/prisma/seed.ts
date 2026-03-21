import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

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

  console.log(`Seeded admin: ${user.username} (${user.email})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
