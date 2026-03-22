-- CreateTable
CREATE TABLE "GameNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameNote_userId_idx" ON "GameNote"("userId");

-- CreateIndex
CREATE INDEX "GameNote_gameId_idx" ON "GameNote"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "GameNote_userId_gameId_key" ON "GameNote"("userId", "gameId");

-- AddForeignKey
ALTER TABLE "GameNote" ADD CONSTRAINT "GameNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameNote" ADD CONSTRAINT "GameNote_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
