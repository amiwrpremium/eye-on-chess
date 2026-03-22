import { PrismaClient } from "@prisma/client";

/** Shared Prisma client instance for database access. */
export const prisma = new PrismaClient();
