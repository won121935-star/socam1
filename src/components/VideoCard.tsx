"use client";

import Image from "next/image";
import { Archive, Check, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/youtube";
import { SourceBadge } from "./SourceBadge";

export interface VideoCardData {
  title: string;
  thumbnailUrl: string | null;
  channelName: string | null;
  durationSec: number | null;
  source: string;
  archived?: boolean;
  tags?: string[];
  collections?: string[];
  rating?: number | null;
}

export function VideoCard({
  data,
  onClick,
  onArchive,
  archiving = false,
}: {
  data: VideoCardData;
  onClick: () => void;
  onArchive?: () => void;
  archiving?: boolean;
}) {
  return (
    <div
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800 transition hover:ring-zinc-600"
      onClick={onClick}
    >
      <div className="relative aspect-video bg-zinc-800">
        {data.thumbnailUrl ? (
          // next/image는 외부 호스트 허용 목록이 필요하므로 unoptimized로 단순 처리
          <Image
            src={data.thumbnailUrl}
            alt={data.title}
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-500 text-xs">
            (썸네일 없음)
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          <SourceBadge source={data.source} />
          {data.archived && (
            <span className="inline-flex items-center gap-1 rounded bg-blue-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              <Check size={10} /> 아카이브됨
            </span>
          )}
        </div>
        {data.durationSec != null && data.durationSec > 0 && (
          <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium">
            {formatDuration(data.durationSec)}
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
          <Play
            size={48}
            className="opacity-0 transition group-hover:opacity-80"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="line-clamp-2 text-sm font-medium leading-snug">
          {data.title}
        </div>
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="truncate">{data.channelName ?? "—"}</span>
          {data.rating ? (
            <span className="text-amber-400">
              {"★".repeat(data.rating)}
              <span className="text-zinc-600">
                {"★".repeat(5 - data.rating)}
              </span>
            </span>
          ) : null}
        </div>

        {data.collections && data.collections.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {data.collections.slice(0, 2).map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-0.5 rounded bg-purple-900/40 px-1.5 py-0.5 text-[10px] text-purple-200 ring-1 ring-purple-800/50"
              >
                📁 {c}
              </span>
            ))}
            {data.collections.length > 2 && (
              <span className="text-[10px] text-zinc-500">
                +{data.collections.length - 2}
              </span>
            )}
          </div>
        )}

        {data.tags && data.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {data.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300"
              >
                #{t}
              </span>
            ))}
            {data.tags.length > 4 && (
              <span className="text-[10px] text-zinc-500">
                +{data.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {onArchive && !data.archived && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
            disabled={archiving}
            className={cn(
              "mt-2 inline-flex items-center justify-center gap-1 rounded-full bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-50",
            )}
          >
            <Archive size={12} />
            {archiving ? "저장 중…" : "아카이브"}
          </button>
        )}
      </div>
    </div>
  );
}
