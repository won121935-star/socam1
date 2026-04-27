import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 자동 수집(cached=true) 영상의 태그·집계는 제외 — 사용자 큐레이션 태그만 노출.
export async function GET() {
  const tags = await prisma.tag.findMany({
    include: {
      _count: {
        select: { videos: { where: { cached: false } } },
      },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({
    tags: tags
      .map((t) => ({ name: t.name, count: t._count.videos }))
      .filter((t) => t.count > 0),
  });
}
