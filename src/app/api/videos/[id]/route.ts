import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const video = await prisma.video.findUnique({
    where: { id },
    include: {
      tags: true,
      collections: true,
      notes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!video) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ video });
}

const patchSchema = z.object({
  tags: z.array(z.string()).optional(),
  collections: z.array(z.string()).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  title: z.string().min(1).optional(),
  cached: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { tags, collections, rating, title, cached } = parsed.data;

  // 사용자가 직접 손을 댄 시점 — 태그·프로젝트·평가·제목 중 무엇이든 수정하면
  // 자동으로 cached=false 로 플립해서 "내 아카이브"에 편입.
  const userTouched =
    tags !== undefined ||
    collections !== undefined ||
    rating !== undefined ||
    title !== undefined;

  const updated = await prisma.video.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(rating !== undefined ? { rating } : {}),
      ...(cached !== undefined
        ? { cached }
        : userTouched
          ? { cached: false }
          : {}),
      ...(tags !== undefined
        ? {
            tags: {
              set: [],
              connectOrCreate: tags.map((name) => ({
                where: { name },
                create: { name },
              })),
            },
          }
        : {}),
      ...(collections !== undefined
        ? {
            collections: {
              set: [],
              connectOrCreate: collections.map((name) => ({
                where: { name },
                create: { name },
              })),
            },
          }
        : {}),
    },
    include: { tags: true, collections: true },
  });

  return NextResponse.json({ video: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.video.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
