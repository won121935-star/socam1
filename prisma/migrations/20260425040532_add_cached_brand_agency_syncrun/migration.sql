-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsSaved" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "url" TEXT NOT NULL,
    "embedUrl" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "channelName" TEXT,
    "durationSec" INTEGER,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "rating" INTEGER,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "brand" TEXT,
    "agency" TEXT
);
INSERT INTO "new_Video" ("channelName", "createdAt", "description", "durationSec", "embedUrl", "id", "publishedAt", "rating", "source", "sourceId", "thumbnailUrl", "title", "updatedAt", "url") SELECT "channelName", "createdAt", "description", "durationSec", "embedUrl", "id", "publishedAt", "rating", "source", "sourceId", "thumbnailUrl", "title", "updatedAt", "url" FROM "Video";
DROP TABLE "Video";
ALTER TABLE "new_Video" RENAME TO "Video";
CREATE INDEX "Video_source_idx" ON "Video"("source");
CREATE INDEX "Video_cached_idx" ON "Video"("cached");
CREATE INDEX "Video_createdAt_idx" ON "Video"("createdAt");
CREATE UNIQUE INDEX "Video_source_url_key" ON "Video"("source", "url");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SyncRun_source_startedAt_idx" ON "SyncRun"("source", "startedAt");
