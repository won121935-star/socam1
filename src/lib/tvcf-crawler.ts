// tvcf.co.kr 공개 카탈로그 크롤러.
//
// 정책:
// - robots.txt 허용 범위만 (Disallow: /api, /admin, /login, /_next, /static)
// - User-Agent 명시 (BrandArchiveBot)
// - 페이지 사이 sleep으로 서버 부담 최소화
// - sitemap에 없는 개별 광고는 큐레이션 페이지에서 발견된 것만

import { prisma } from "./db";
import { extractMetadata } from "./metadata";

const BASE = "https://tvcf.co.kr";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) BrandArchiveBot/1.0 (+internal team tool)";

// 공개 큐레이션 페이지
const HOT_PAGES = [
  "/hot/popular",
  "/hot/best",
  "/hot/creative",
  "/hot/consumer",
  "/hot/prominent",
  "/hot/youtube",
  "/feed/recent",
];

const SLEEP_MS = 350;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SyncProgress {
  itemsFound: number;
  itemsSaved: number;
  errorCount: number;
  currentStep: string;
}

export async function syncTvcf(
  onProgress?: (p: SyncProgress) => void,
): Promise<{
  runId: string;
  itemsFound: number;
  itemsSaved: number;
  errorCount: number;
  durationSec: number;
}> {
  const run = await prisma.syncRun.create({
    data: { source: "tvcf" },
  });

  const start = Date.now();
  const playUrls = new Set<string>();
  let errorCount = 0;

  const progress: SyncProgress = {
    itemsFound: 0,
    itemsSaved: 0,
    errorCount: 0,
    currentStep: "큐레이션 페이지 수집 중",
  };
  onProgress?.(progress);

  // 1. 큐레이션 페이지에서 /play/ 링크 수집
  for (const path of HOT_PAGES) {
    try {
      progress.currentStep = `수집: ${path}`;
      onProgress?.(progress);
      const urls = await extractPlayLinks(`${BASE}${path}`);
      urls.forEach((u) => playUrls.add(u));
      progress.itemsFound = playUrls.size;
      onProgress?.(progress);
    } catch (e) {
      console.error("[tvcf-sync] list page failed:", path, e);
      errorCount++;
    }
    await sleep(SLEEP_MS);
  }

  // 2. sitemap에서 에이전시/콜렉션 페이지 가져와서 거기에 걸린 /play/도 수집
  try {
    progress.currentStep = "sitemap에서 에이전시 페이지 수집 중";
    onProgress?.(progress);
    const portfolioPages = await fetchSitemapEntries(
      `${BASE}/sitemap/portfolio`,
    );
    const collectionsPages = await fetchSitemapEntries(
      `${BASE}/sitemap/collections`,
    );
    const allPages = [...portfolioPages, ...collectionsPages].filter((u) =>
      u.startsWith(BASE),
    );

    for (const url of allPages) {
      try {
        progress.currentStep = `에이전시 페이지: ${url.replace(BASE, "")}`;
        onProgress?.(progress);
        const urls = await extractPlayLinks(url);
        urls.forEach((u) => playUrls.add(u));
        progress.itemsFound = playUrls.size;
        onProgress?.(progress);
      } catch (e) {
        console.error("[tvcf-sync] portfolio page failed:", url, e);
        errorCount++;
      }
      await sleep(SLEEP_MS);
    }
  } catch (e) {
    console.error("[tvcf-sync] sitemap fetch failed:", e);
    errorCount++;
  }

  // 3. 각 /play/ URL에서 메타데이터 추출 → DB upsert
  progress.currentStep = `광고 ${playUrls.size}편 메타데이터 수집 중`;
  onProgress?.(progress);

  let saved = 0;
  for (const url of playUrls) {
    try {
      const meta = await extractMetadata(url);
      if (!meta.title) {
        // 메타가 비어있으면 skip
        await sleep(SLEEP_MS);
        continue;
      }

      // upsert
      await prisma.video.upsert({
        where: { source_url: { source: "tvcf", url: meta.url } },
        update: {
          title: meta.title,
          description: meta.description,
          thumbnailUrl: meta.thumbnailUrl,
          channelName: meta.channelName,
          embedUrl: meta.embedUrl,
          // cached/brand/agency는 첫 발견 시에만 세팅, 사용자가 덮은 값은 유지
        },
        create: {
          source: "tvcf",
          sourceId: meta.sourceId,
          url: meta.url,
          embedUrl: meta.embedUrl,
          title: meta.title,
          description: meta.description,
          thumbnailUrl: meta.thumbnailUrl,
          channelName: meta.channelName,
          cached: true,
        },
      });
      saved++;
      progress.itemsSaved = saved;
      if (saved % 5 === 0) onProgress?.(progress);
    } catch (e) {
      console.error("[tvcf-sync] meta extract failed:", url, e);
      errorCount++;
      progress.errorCount = errorCount;
    }
    await sleep(SLEEP_MS);
  }

  const finished = await prisma.syncRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      itemsFound: playUrls.size,
      itemsSaved: saved,
      errorCount,
    },
  });

  return {
    runId: finished.id,
    itemsFound: playUrls.size,
    itemsSaved: saved,
    errorCount,
    durationSec: Math.round((Date.now() - start) / 1000),
  };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.text();
}

async function extractPlayLinks(url: string): Promise<string[]> {
  const html = await fetchHtml(url);
  const found = new Set<string>();
  const re = /\/play\/[a-zA-Z0-9_-]+/g;
  for (const m of html.matchAll(re)) {
    found.add(`${BASE}${m[0]}`);
  }
  return [...found];
}

async function fetchSitemapEntries(url: string): Promise<string[]> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "user-agent": UA },
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const out: string[] = [];
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    out.push(m[1]);
  }
  return out;
}

export async function getLastSyncRun(source: "tvcf" = "tvcf") {
  return prisma.syncRun.findFirst({
    where: { source },
    orderBy: { startedAt: "desc" },
  });
}
