// Playwright 기반 TVCF 크롤러.
// 리스트 페이지(SPA)를 헤드리스 브라우저로 렌더 → /play/ 링크 추출
// 개별 광고 페이지는 OG 메타가 SSR 되어 있어 기존 fetch 로 충분.

import { prisma } from "./db";
import { extractMetadata } from "./metadata";

const BASE = "https://tvcf.co.kr";
const SLEEP_MS = 250;
const RENDER_WAIT_MS = 2500; // SPA 광고 카드 렌더 대기

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SyncProgress {
  itemsFound: number;
  itemsSaved: number;
  errorCount: number;
  currentStep: string;
}

const HOT_PAGES = [
  "/hot/popular",
  "/hot/best",
  "/hot/creative",
  "/hot/consumer",
  "/hot/prominent",
  "/hot/youtube",
  "/feed/recent",
];

const WORKED_PAGES = [
  "/worked/cf",
  "/worked/video",
  "/worked/music-video",
  "/worked/short-film",
  "/worked/student-cf",
];

export async function syncTvcfWithPlaywright(
  onProgress?: (p: SyncProgress) => void,
): Promise<{
  runId: string;
  itemsFound: number;
  itemsSaved: number;
  errorCount: number;
  durationSec: number;
}> {
  const { chromium } = await import("playwright");

  const run = await prisma.syncRun.create({ data: { source: "tvcf" } });
  const start = Date.now();
  const playUrls = new Set<string>();
  let errorCount = 0;

  const progress: SyncProgress = {
    itemsFound: 0,
    itemsSaved: 0,
    errorCount: 0,
    currentStep: "브라우저 시작",
  };
  onProgress?.(progress);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 1800 },
  });

  // 빠른 로딩을 위해 이미지/폰트는 차단 (메타데이터만 필요)
  await context.route("**/*", (route) => {
    const t = route.request().resourceType();
    if (["image", "font", "media"].includes(t)) return route.abort();
    return route.continue();
  });

  const page = await context.newPage();

  async function harvestPage(url: string, label: string) {
    try {
      progress.currentStep = label;
      onProgress?.(progress);

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(RENDER_WAIT_MS);

      // 광고 카드들이 추가 로드될 수 있으니 스크롤로 더 보기
      try {
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() =>
            window.scrollBy(0, document.body.scrollHeight),
          );
          await page.waitForTimeout(700);
        }
      } catch {
        // ignore scroll errors
      }

      const links = await page.$$eval('a[href*="/play/"]', (anchors) =>
        anchors
          .map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? "")
          .filter((h) => /^\/play\/[A-Za-z0-9_-]+/.test(h))
          .map((h) => `https://tvcf.co.kr${h.split("?")[0].split("#")[0]}`),
      );
      links.forEach((u) => playUrls.add(u));
      progress.itemsFound = playUrls.size;
      onProgress?.(progress);
    } catch (e) {
      console.error(`[playwright-crawler] ${url} failed:`, e);
      errorCount++;
      progress.errorCount = errorCount;
    }
    await sleep(SLEEP_MS);
  }

  // 1. 큐레이션 + worked 페이지
  for (const path of [...HOT_PAGES, ...WORKED_PAGES]) {
    await harvestPage(`${BASE}${path}`, `리스트: ${path}`);
  }

  // 2. sitemap에서 portfolio + collections + award 페이지 동적 수집
  const allListPages: string[] = [];
  for (const which of ["portfolio", "collections", "award"]) {
    try {
      const xml = await fetch(`${BASE}/sitemap/${which}`).then((r) => r.text());
      for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        const u = m[1];
        if (u.startsWith(BASE)) allListPages.push(u);
      }
    } catch {
      errorCount++;
    }
  }

  progress.currentStep = `sitemap에서 ${allListPages.length}개 페이지 발견`;
  onProgress?.(progress);

  for (const [i, url] of allListPages.entries()) {
    await harvestPage(url, `에이전시/콜렉션/어워즈 ${i + 1}/${allListPages.length}: ${url.replace(BASE, "")}`);
  }

  await browser.close();

  // 3. 각 /play/ URL 메타 추출 + DB upsert
  progress.currentStep = `광고 ${playUrls.size}편 메타 수집`;
  onProgress?.(progress);

  let saved = 0;
  for (const url of playUrls) {
    try {
      const meta = await extractMetadata(url);
      if (!meta.title) {
        await sleep(150);
        continue;
      }
      await prisma.video.upsert({
        where: { source_url: { source: "tvcf", url: meta.url } },
        update: {
          title: meta.title,
          description: meta.description,
          thumbnailUrl: meta.thumbnailUrl,
          channelName: meta.channelName,
          embedUrl: meta.embedUrl,
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
      if (saved % 10 === 0) onProgress?.(progress);
    } catch (e) {
      console.error("[playwright-crawler] meta failed:", url, e);
      errorCount++;
      progress.errorCount = errorCount;
    }
    await sleep(150);
  }

  const finished = await prisma.syncRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      itemsFound: playUrls.size,
      itemsSaved: saved,
      errorCount,
      notes: "playwright",
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
