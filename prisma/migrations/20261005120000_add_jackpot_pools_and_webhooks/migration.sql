-- CreateEnum
CREATE TYPE "JackpotTxType" AS ENUM ('CONTRIBUTION', 'JACKPOT_WIN', 'JACKPOT_RESET', 'JACKPOT_ROLLOVER', 'MANUAL_ADJUSTMENT');

-- CreateTable
CREATE TABLE IF NOT EXISTS "processed_webhook_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'stripe',
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "processed_webhook_events_eventId_key" ON "processed_webhook_events"("eventId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "jackpot_pools" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "currentJackpot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "baseJackpot" DECIMAL(18,2) NOT NULL DEFAULT 1000000,
    "rolloverAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currentDrawContrib" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "consecutiveRollovers" INTEGER NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "largestJackpot" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lastWinningDrawId" TEXT,
    "jackpotContribPct" DECIMAL(5,2) NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jackpot_pools_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "jackpot_pools_gameId_key" ON "jackpot_pools"("gameId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "jackpot_history" (
    "id" TEXT NOT NULL,
    "jackpotPoolId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "drawNumber" INTEGER NOT NULL,
    "jackpotBefore" DECIMAL(18,2) NOT NULL,
    "ticketContrib" DECIMAL(18,2) NOT NULL,
    "rolloverAmount" DECIMAL(18,2) NOT NULL,
    "winnerCount" INTEGER NOT NULL DEFAULT 0,
    "jackpotPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "jackpotAfter" DECIMAL(18,2) NOT NULL,
    "winnerUserIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jackpot_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "jackpot_history_gameId_idx" ON "jackpot_history"("gameId");
CREATE INDEX IF NOT EXISTS "jackpot_history_drawId_idx" ON "jackpot_history"("drawId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "jackpot_transactions" (
    "id" TEXT NOT NULL,
    "jackpotPoolId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "drawId" TEXT,
    "type" "JackpotTxType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balanceBefore" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jackpot_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "jackpot_transactions_gameId_idx" ON "jackpot_transactions"("gameId");
CREATE INDEX IF NOT EXISTS "jackpot_transactions_type_idx" ON "jackpot_transactions"("type");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'jackpot_pools_gameId_fkey'
    ) THEN
        ALTER TABLE "jackpot_pools" ADD CONSTRAINT "jackpot_pools_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'jackpot_history_jackpotPoolId_fkey'
    ) THEN
        ALTER TABLE "jackpot_history" ADD CONSTRAINT "jackpot_history_jackpotPoolId_fkey" FOREIGN KEY ("jackpotPoolId") REFERENCES "jackpot_pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'jackpot_transactions_jackpotPoolId_fkey'
    ) THEN
        ALTER TABLE "jackpot_transactions" ADD CONSTRAINT "jackpot_transactions_jackpotPoolId_fkey" FOREIGN KEY ("jackpotPoolId") REFERENCES "jackpot_pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
