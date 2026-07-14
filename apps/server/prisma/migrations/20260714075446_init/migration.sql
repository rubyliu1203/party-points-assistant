-- CreateTable
CREATE TABLE "PartyMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "partyPositions" TEXT NOT NULL DEFAULT '[]',
    "isPartyWorker" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "transferDate" DATETIME,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Quarter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PartyMemberScore" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partyMemberId" INTEGER NOT NULL,
    "quarterId" INTEGER NOT NULL,
    "politicalScore" REAL NOT NULL DEFAULT 20,
    "disciplineScore" REAL NOT NULL DEFAULT 20,
    "moralityScore" REAL NOT NULL DEFAULT 20,
    "performanceLevel" TEXT,
    "performanceScore" REAL,
    "roleScore" REAL,
    "bonusScore" REAL NOT NULL DEFAULT 0,
    "deductionScore" REAL NOT NULL DEFAULT 0,
    "vetoStatus" TEXT NOT NULL DEFAULT 'none',
    "totalScore" REAL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartyMemberScore_partyMemberId_fkey" FOREIGN KEY ("partyMemberId") REFERENCES "PartyMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartyMemberScore_quarterId_fkey" FOREIGN KEY ("quarterId") REFERENCES "Quarter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoleScoreDetail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partyMemberId" INTEGER NOT NULL,
    "quarterId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "dim1HardBattle" REAL NOT NULL DEFAULT 0,
    "dim2TechShare" REAL NOT NULL DEFAULT 0,
    "dim3ShuangYou" REAL NOT NULL DEFAULT 0,
    "dim4Culture" REAL NOT NULL DEFAULT 0,
    "dim5ChinaStory" REAL NOT NULL DEFAULT 0,
    "isHardBattleLeader" BOOLEAN NOT NULL DEFAULT false,
    "isShuangYou" BOOLEAN NOT NULL DEFAULT false,
    "isTeamLeader" BOOLEAN NOT NULL DEFAULT false,
    "cultureBaseScore" REAL,
    "monthlyTotal" REAL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoleScoreDetail_partyMemberId_fkey" FOREIGN KEY ("partyMemberId") REFERENCES "PartyMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoleScoreDetail_quarterId_fkey" FOREIGN KEY ("quarterId") REFERENCES "Quarter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BonusRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partyMemberId" INTEGER NOT NULL,
    "quarterId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "score" REAL NOT NULL,
    "source" TEXT,
    "description" TEXT,
    "awardDate" DATETIME,
    "applyQuarterId" INTEGER,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BonusRecord_partyMemberId_fkey" FOREIGN KEY ("partyMemberId") REFERENCES "PartyMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BonusRecord_quarterId_fkey" FOREIGN KEY ("quarterId") REFERENCES "Quarter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeductionRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partyMemberId" INTEGER NOT NULL,
    "quarterId" INTEGER NOT NULL,
    "type" INTEGER NOT NULL,
    "score" REAL NOT NULL,
    "occurrenceDate" DATETIME,
    "description" TEXT,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeductionRecord_partyMemberId_fkey" FOREIGN KEY ("partyMemberId") REFERENCES "PartyMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeductionRecord_quarterId_fkey" FOREIGN KEY ("quarterId") REFERENCES "Quarter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartyWorkScore" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partyMemberId" INTEGER NOT NULL,
    "quarterId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "baseScore" REAL NOT NULL DEFAULT 95,
    "baseBonus" REAL NOT NULL DEFAULT 0,
    "taskBonus" REAL NOT NULL DEFAULT 0,
    "deduction" REAL NOT NULL DEFAULT 0,
    "monthlyTotal" REAL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartyWorkScore_partyMemberId_fkey" FOREIGN KEY ("partyMemberId") REFERENCES "PartyMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartyWorkScore_quarterId_fkey" FOREIGN KEY ("quarterId") REFERENCES "Quarter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartyWorkBonusDetail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partyMemberId" INTEGER NOT NULL,
    "quarterId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "score" REAL NOT NULL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartyWorkBonusDetail_partyMemberId_fkey" FOREIGN KEY ("partyMemberId") REFERENCES "PartyMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartyWorkBonusDetail_quarterId_fkey" FOREIGN KEY ("quarterId") REFERENCES "Quarter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PartyMember_status_idx" ON "PartyMember"("status");

-- CreateIndex
CREATE INDEX "PartyMember_displayOrder_idx" ON "PartyMember"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Quarter_year_quarter_key" ON "Quarter"("year", "quarter");

-- CreateIndex
CREATE INDEX "PartyMemberScore_quarterId_idx" ON "PartyMemberScore"("quarterId");

-- CreateIndex
CREATE INDEX "PartyMemberScore_partyMemberId_idx" ON "PartyMemberScore"("partyMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyMemberScore_partyMemberId_quarterId_key" ON "PartyMemberScore"("partyMemberId", "quarterId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleScoreDetail_partyMemberId_quarterId_year_month_key" ON "RoleScoreDetail"("partyMemberId", "quarterId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PartyWorkScore_partyMemberId_quarterId_year_month_key" ON "PartyWorkScore"("partyMemberId", "quarterId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");
