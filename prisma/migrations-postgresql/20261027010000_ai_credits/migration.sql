BEGIN;

-- CreateTable
CREATE TABLE "CreditAccount" (
    "uid" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'local',
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "reservedCredits" INTEGER NOT NULL DEFAULT 0,
    "customerId" TEXT,
    "subscriptionId" TEXT,
    "currentPeriodId" TEXT,
    "gatewayKey" TEXT,
    "lastBillingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditAccount_pkey" PRIMARY KEY ("uid")
);

-- CreateTable
CREATE TABLE "CreditPeriod" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "allocation" INTEGER NOT NULL,
    "screenLimit" INTEGER NOT NULL,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "successfulScreens" INTEGER NOT NULL DEFAULT 0,
    "reservedScreens" INTEGER NOT NULL DEFAULT 0,
    "spendLimitMicros" BIGINT NOT NULL,
    "spentMicros" BIGINT NOT NULL DEFAULT 0,
    "reservedSpendMicros" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationRun" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "funding" TEXT NOT NULL,
    "periodId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "reservedScreens" INTEGER NOT NULL DEFAULT 0,
    "reservedCostMicros" BIGINT NOT NULL DEFAULT 0,
    "costMicros" BIGINT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "usageJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GenerationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenGeneration" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "screenKey" TEXT NOT NULL,
    "screenId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "html" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "creditsCharged" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costMicros" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "ScreenGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditEntry" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "periodId" TEXT,
    "runId" TEXT,
    "screenId" TEXT,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "eventKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DodoBillingEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "uid" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DodoBillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditAccount_customerId_key" ON "CreditAccount"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditAccount_subscriptionId_key" ON "CreditAccount"("subscriptionId");

-- CreateIndex
CREATE INDEX "CreditPeriod_uid_endsAt_idx" ON "CreditPeriod"("uid", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPeriod_uid_periodKey_key" ON "CreditPeriod"("uid", "periodKey");

-- CreateIndex
CREATE INDEX "GenerationRun_uid_projectId_status_idx" ON "GenerationRun"("uid", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationRun_uid_requestId_key" ON "GenerationRun"("uid", "requestId");

-- CreateIndex
CREATE INDEX "ScreenGeneration_uid_projectId_status_idx" ON "ScreenGeneration"("uid", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenGeneration_runId_screenKey_key" ON "ScreenGeneration"("runId", "screenKey");

-- CreateIndex
CREATE INDEX "CreditEntry_uid_createdAt_idx" ON "CreditEntry"("uid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditEntry_uid_eventKey_key" ON "CreditEntry"("uid", "eventKey");

-- AddForeignKey
ALTER TABLE "CreditPeriod" ADD CONSTRAINT "CreditPeriod_uid_fkey" FOREIGN KEY ("uid") REFERENCES "CreditAccount"("uid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRun" ADD CONSTRAINT "GenerationRun_uid_fkey" FOREIGN KEY ("uid") REFERENCES "CreditAccount"("uid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRun" ADD CONSTRAINT "GenerationRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "CreditPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenGeneration" ADD CONSTRAINT "ScreenGeneration_runId_fkey" FOREIGN KEY ("runId") REFERENCES "GenerationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_uid_fkey" FOREIGN KEY ("uid") REFERENCES "CreditAccount"("uid") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_nonnegative" CHECK ("balance">=0 AND "reservedCredits">=0 AND "reservedCredits"<="balance");
ALTER TABLE "CreditPeriod" ADD CONSTRAINT "CreditPeriod_limits" CHECK ("successfulScreens">=0 AND "reservedScreens">=0 AND "successfulScreens"+"reservedScreens"<="screenLimit" AND "spentMicros">=0 AND "reservedSpendMicros">=0 AND "spentMicros"+"reservedSpendMicros"<="spendLimitMicros");
ALTER TABLE "ScreenGeneration" ADD CONSTRAINT "ScreenGeneration_charge" CHECK ("creditsCharged" IN (0,15));

COMMIT;
