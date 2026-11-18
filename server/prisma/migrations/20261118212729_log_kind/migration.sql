-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Roll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "characterId" TEXT,
    "who" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'roll',
    "label" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "detail" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Roll_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Roll_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Roll" ("campaignId", "characterId", "createdAt", "detail", "formula", "hidden", "id", "label", "total", "who") SELECT "campaignId", "characterId", "createdAt", "detail", "formula", "hidden", "id", "label", "total", "who" FROM "Roll";
DROP TABLE "Roll";
ALTER TABLE "new_Roll" RENAME TO "Roll";
CREATE INDEX "Roll_campaignId_createdAt_idx" ON "Roll"("campaignId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
