-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PartyMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "partyPositions" TEXT NOT NULL DEFAULT '[]',
    "isPartyWorker" BOOLEAN NOT NULL DEFAULT false,
    "isManager" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "transferDate" DATETIME,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PartyMember" ("createdAt", "displayOrder", "id", "isPartyWorker", "name", "partyPositions", "remark", "status", "transferDate", "updatedAt") SELECT "createdAt", "displayOrder", "id", "isPartyWorker", "name", "partyPositions", "remark", "status", "transferDate", "updatedAt" FROM "PartyMember";
DROP TABLE "PartyMember";
ALTER TABLE "new_PartyMember" RENAME TO "PartyMember";
CREATE INDEX "PartyMember_status_idx" ON "PartyMember"("status");
CREATE INDEX "PartyMember_displayOrder_idx" ON "PartyMember"("displayOrder");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
