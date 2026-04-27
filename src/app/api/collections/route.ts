import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

// 자동 수집 영상은 카운트에서 제외 — 사용자 컬렉션만 표시.
export async function GET() {
  const collections = await prisma.collection.findMany({
    include: {
      _count: {
        select: { videos: { where: { cached: false } } },
      },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({
    collections: collections
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        count: c._count.videos,
      }))
      .filter((c) => c.count > 0),
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const c = await prisma.collection.upsert({
    where: { name: parsed.data.name },
    update: {
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
    },
    create: parsed.data,
  });
  return NextResponse.json({ collection: c });
}
