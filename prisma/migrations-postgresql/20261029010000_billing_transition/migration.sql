CREATE TABLE "BillingTransition" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "sourcePlan" TEXT NOT NULL,
    "targetPlan" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'initiated',
    "checkoutId" TEXT,
    "paymentId" TEXT,
    "lastError" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "BillingTransition_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingTransition_account_fkey" FOREIGN KEY ("uid") REFERENCES "CreditAccount"("uid") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BillingTransition_requestKey_key" ON "BillingTransition"("requestKey");
CREATE UNIQUE INDEX "BillingTransition_checkoutId_key" ON "BillingTransition"("checkoutId");
CREATE UNIQUE INDEX "BillingTransition_paymentId_key" ON "BillingTransition"("paymentId");
CREATE INDEX "BillingTransition_uid_createdAt_idx" ON "BillingTransition"("uid", "createdAt");
CREATE UNIQUE INDEX "BillingTransition_one_unresolved_per_uid" ON "BillingTransition"("uid") WHERE "completedAt" IS NULL;
