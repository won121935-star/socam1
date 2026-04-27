import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchYouTube } from "@/lib/youtube";

// GET /api/search?q=...&pageToken=...&tvcfOffset=0
// YouTube 결과 + TVCF 캐시 안에서의 매칭 + 아카이브 플래그
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const pageToken = searchParams.get("pageToken") ?? undefined;
  const tvcfOffset = Math.max(
    0,
    parseInt(searchParams.get("tvcfOffset") ?? "0", 10) || 0,
  );
  const maxResults = Math.min(
    parseInt(searchParams.get("maxResults") ?? "50", 10) || 50,
    50,
  );

  if (!q) {
    return NextResponse.json({
      query: "",
      youtube: [],
      tvcf: [],
      tvcfTotal: 0,
      tvcfHasMore: false,
      nextPageToken: null,
      totalResults: 0,
      hasYoutubeKey: Boolean(process.env.YOUTUBE_API_KEY),
    });
  }

  // YouTube + TVCF 검색 병렬
  const [ytResult, tvcfResult] = await Promise.all([
    safeYouTube(q, maxResults, pageToken),
    searchTvcfCache(q, tvcfOffset, 24),
  ]);

  // 사용자가 직접 저장한 항목 표시용 — tvcf source IDs (cached와 무관)
  const ytIds = ytResult.items.map((i) => i.sourceId);
  const archivedRows =
    ytIds.length > 0
      ? await prisma.video.findMany({
          where: { source: "youtube", sourceId: { in: ytIds } },
          select: { sourceId: true },
        })
      : [];
  const archivedSet = new Set(
    archivedRows.map((r) => r.sourceId).filter(Boolean) as string[],
  );

  const youtube = ytResult.items.map((y) => ({
    source: "youtube" as const,
    sourceId: y.sourceId,
    url: y.url,
    embedUrl: y.embedUrl,
    title: y.title,
    description: y.description,
    thumbnailUrl: y.thumbnailUrl,
    channelName: y.channelName,
    durationSec: y.durationSec,
    publishedAt: y.publishedAt,
    archived: archivedSet.has(y.sourceId),
  }));

  const tvcf = tvcfResult.items.map((v) => ({
    source: "tvcf" as const,
    id: v.id,
    sourceId: v.sourceId,
    url: v.url,
    embedUrl: v.embedUrl,
    title: v.title,
    description: v.description,
    thumbnailUrl: v.thumbnailUrl,
    channelName: v.channelName,
    durationSec: v.durationSec,
    publishedAt: v.publishedAt?.toISOString() ?? null,
    tags: v.tags.map((t) => t.name),
    collections: v.collections.map((c) => c.name),
    rating: v.rating,
    cached: v.cached,
    // tvcf 캐시 항목은 이미 DB에 있으므로 사용자가 따로 'archive' 안 해도
    // 모달에서 노트/태그/프로젝트만 추가하면 됨. archived 플래그는
    // cached=false 즉 사용자가 의도적으로 저장한 것일 때만 true
    archived: !v.cached,
  }));

  return NextResponse.json({
    query: q,
    youtube,
    nextPageToken: ytResult.nextPageToken,
    totalResults: ytResult.totalResults,
    tvcf,
    tvcfTotal: tvcfResult.total,
    tvcfHasMore: tvcfOffset + tvcf.length < tvcfResult.total,
    hasYoutubeKey: Boolean(process.env.YOUTUBE_API_KEY),
  });
}

async function safeYouTube(q: string, maxResults: number, pageToken?: string) {
  try {
    return await searchYouTube(q, { maxResults, pageToken });
  } catch (e) {
    console.error("[search] YouTube API error:", e);
    return { items: [], nextPageToken: null, totalResults: null };
  }
}

async function searchTvcfCache(q: string, offset: number, take: number) {
  const where = {
    source: "tvcf",
    OR: [
      { title: { contains: q } },
      { description: { contains: q } },
      { channelName: { contains: q } },
      { tags: { some: { name: { contains: q } } } },
      { collections: { some: { name: { contains: q } } } },
      { brand: { contains: q } },
      { agency: { contains: q } },
    ],
  };
  const [items, total] = await Promise.all([
    prisma.video.findMany({
      where,
      include: { tags: true, collections: true },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take,
    }),
    prisma.video.count({ where }),
  ]);
  return { items, total };
}
