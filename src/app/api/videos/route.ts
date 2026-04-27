import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { extractMetadata } from "@/lib/metadata";
import { parseVideoUrl } from "@/lib/url-parser";

// GET /api/videos?tag=...&collection=...&q=...&source=...&includeCached=1
// 기본 동작: cached=false인 (사용자가 저장한) 영상만 반환.
// includeCached=1이면 자동 수집 라이브러리(cached=true) 포함.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tag = searchParams.get("tag");
  const collection = searchParams.get("collection");
  const q = (searchParams.get("q") ?? "").trim();
  const source = searchParams.get("source") as "youtube" | "tvcf" | "other" | null;
  const includeCached = searchParams.get("includeCached") === "1";

  const videos = await prisma.video.findMany({
    where: {
      ...(includeCached ? {} : { cached: false }),
      ...(source ? { source } : {}),
      ...(tag ? { tags: { some: { name: tag } } } : {}),
      ...(collection
        ? { collections: { some: { name: collection } } }
        : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
              { channelName: { contains: q } },
              { tags: { some: { name: { contains: q } } } },
              { collections: { some: { name: { contains: q } } } },
              { brand: { contains: q } },
              { agency: { contains: q } },
            ],
          }
        : {}),
    },
    include: { tags: true, collections: true, notes: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    videos: videos.map((v) => ({
      id: v.id,
      source: v.source,
      sourceId: v.sourceId,
      url: v.url,
      embedUrl: v.embedUrl,
      title: v.title,
      description: v.description,
      thumbnailUrl: v.thumbnailUrl,
      channelName: v.channelName,
      durationSec: v.durationSec,
      publishedAt: v.publishedAt?.toISOString() ?? null,
      rating: v.rating,
      tags: v.tags.map((t) => t.name),
      collections: v.collections.map((c) => c.name),
      notes: v.notes.length,
      createdAt: v.createdAt.toISOString(),
    })),
  });
}

const archiveSchema = z.object({
  url: z.string().url(),
  tags: z.array(z.string()).optional().default([]),
  collections: z.array(z.string()).optional().default([]),
  rating: z.number().int().min(1).max(5).optional(),
  note: z.string().optional(),
  noteAuthor: z.string().optional(),
});

// POST /api/videos — URL을 아카이브에 저장
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = archiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "유효한 url이 필요합니다.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { url, tags, collections, rating, note, noteAuthor } = parsed.data;

  // 먼저 URL 파싱해서 중복 체크
  const pre = parseVideoUrl(url);
  const existing = await prisma.video.findUnique({
    where: { source_url: { source: pre.source, url: pre.normalizedUrl } },
  });
  if (existing) {
    // 기존 항목에 태그/프로젝트/메모만 추가
    const updated = await prisma.video.update({
      where: { id: existing.id },
      data: {
        ...(rating !== undefined ? { rating } : {}),
        ...(tags.length
          ? {
              tags: {
                connectOrCreate: tags.map((name) => ({
                  where: { name },
                  create: { name },
                })),
              },
            }
          : {}),
        ...(collections.length
          ? {
              collections: {
                connectOrCreate: collections.map((name) => ({
                  where: { name },
                  create: { name },
                })),
              },
            }
          : {}),
        ...(note
          ? { notes: { create: { content: note, author: noteAuthor } } }
          : {}),
      },
      include: { tags: true, collections: true, notes: true },
    });
    return NextResponse.json({ video: updated, deduped: true });
  }

  // 메타데이터 추출
  const meta = await extractMetadata(url);

  const created = await prisma.video.create({
    data: {
      source: meta.source,
      sourceId: meta.sourceId,
      url: meta.url,
      embedUrl: meta.embedUrl,
      title: meta.title,
      description: meta.description,
      thumbnailUrl: meta.thumbnailUrl,
      channelName: meta.channelName,
      durationSec: meta.durationSec,
      publishedAt: meta.publishedAt ? new Date(meta.publishedAt) : null,
      rating: rating ?? null,
      tags: tags.length
        ? {
            connectOrCreate: tags.map((name) => ({
              where: { name },
              create: { name },
            })),
          }
        : undefined,
      collections: collections.length
        ? {
            connectOrCreate: collections.map((name) => ({
              where: { name },
              create: { name },
            })),
          }
        : undefined,
      notes: note
        ? { create: { content: note, author: noteAuthor } }
        : undefined,
    },
    include: { tags: true, collections: true, notes: true },
  });

  return NextResponse.json({ video: created, deduped: false });
}
