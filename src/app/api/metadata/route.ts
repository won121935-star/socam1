import { NextResponse } from "next/server";
import { z } from "zod";
import { extractMetadata } from "@/lib/metadata";

const schema = z.object({ url: z.string().url() });

// POST /api/metadata { url }
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "유효한 URL이 필요합니다." },
      { status: 400 },
    );
  }

  try {
    const meta = await extractMetadata(parsed.data.url);
    return NextResponse.json(meta);
  } catch (e) {
    console.error("[metadata] error:", e);
    return NextResponse.json(
      { error: "메타데이터를 가져오지 못했습니다." },
      { status: 500 },
    );
  }
}
