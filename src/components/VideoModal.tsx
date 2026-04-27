"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X, Trash2, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { SourceBadge } from "./SourceBadge";

interface Note {
  id: string;
  author: string | null;
  content: string;
  createdAt: string;
}

export interface VideoModalData {
  id?: string; // 아카이브된 경우만 존재
  source: string;
  sourceId: string | null;
  url: string;
  embedUrl: string | null;
  title: string;
  description: string | null;
  channelName: string | null;
  tags?: string[];
  collections?: string[];
  rating?: number | null;
  notes?: Note[];
  archived: boolean;
}

export function VideoModal({
  data,
  existingCollections = [],
  onClose,
  onArchived,
  onChanged,
  onDeleted,
}: {
  data: VideoModalData;
  existingCollections?: string[];
  onClose: () => void;
  onArchived?: (newId: string) => void;
  onChanged?: () => void;
  onDeleted?: () => void;
}) {
  const [tags, setTags] = useState<string[]>(data.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [collections, setCollections] = useState<string[]>(
    data.collections ?? [],
  );
  const [collectionInput, setCollectionInput] = useState("");
  const [rating, setRating] = useState<number | null>(data.rating ?? null);
  const [notes, setNotes] = useState<Note[]>(data.notes ?? []);
  const [noteInput, setNoteInput] = useState("");
  const [authorInput, setAuthorInput] = useState(
    typeof window !== "undefined"
      ? window.localStorage.getItem("ba:author") ?? ""
      : "",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ba:author", authorInput);
    }
  }, [authorInput]);

  async function saveAttributes() {
    if (!data.id) return;
    setBusy(true);
    try {
      await fetch(`/api/videos/${data.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tags, collections, rating }),
      });
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: data.url,
          tags,
          collections,
          rating: rating ?? undefined,
        }),
      });
      const json = await res.json();
      if (json.video?.id) {
        onArchived?.(json.video.id);
      }
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!data.id || !noteInput.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          videoId: data.id,
          content: noteInput.trim(),
          author: authorInput.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.note) {
        setNotes([json.note, ...notes]);
        setNoteInput("");
        onChanged?.();
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteNote(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
      setNotes(notes.filter((n) => n.id !== id));
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function deleteVideo() {
    if (!data.id) return;
    if (!confirm("이 영상을 아카이브에서 삭제할까요?")) return;
    setBusy(true);
    try {
      await fetch(`/api/videos/${data.id}`, { method: "DELETE" });
      onDeleted?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function commitTag(raw: string) {
    const t = raw.trim().replace(/^#/, "");
    if (!t) return;
    if (tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput("");
  }

  function commitCollection(raw: string) {
    const c = raw.trim();
    if (!c) return;
    if (collections.includes(c)) return;
    setCollections([...collections, c]);
    setCollectionInput("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl ring-1 ring-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <SourceBadge source={data.source} />
              {data.archived && (
                <span className="rounded bg-blue-600/90 px-1.5 py-0.5 text-[10px] font-semibold">
                  아카이브됨
                </span>
              )}
            </div>
            <h2 className="mt-1 truncate text-lg font-semibold">
              {data.title}
            </h2>
            <p className="truncate text-xs text-zinc-400">
              {data.channelName ?? "—"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700"
            >
              <ExternalLink size={12} /> 원본
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 hover:bg-zinc-800"
              aria-label="닫기"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 overflow-auto p-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-3">
            {data.embedUrl ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                <iframe
                  src={data.embedUrl}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                  title={data.title}
                />
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg bg-zinc-800 text-center text-sm text-zinc-400">
                <div>
                  이 소스는 사이트 내 임베드가 지원되지 않습니다.
                  <br />
                  <a
                    href={data.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-blue-400 underline"
                  >
                    <ExternalLink size={12} /> 원본 페이지에서 재생
                  </a>
                </div>
              </div>
            )}

            {data.description && (
              <details className="rounded-lg bg-zinc-800/50 p-3 text-sm text-zinc-300 open:bg-zinc-800">
                <summary className="cursor-pointer text-xs font-medium text-zinc-400">
                  설명
                </summary>
                <div className="mt-2 whitespace-pre-wrap">
                  {data.description}
                </div>
              </details>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            {/* 태그 */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                태그
              </h3>
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-xs"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((x) => x !== t))}
                      className="text-zinc-500 hover:text-red-400"
                      aria-label={`${t} 태그 제거`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    commitTag(tagInput);
                  }
                }}
                onBlur={() => tagInput && commitTag(tagInput)}
                placeholder="태그 입력 후 Enter"
                className="mt-2 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none ring-0 placeholder:text-zinc-500 focus:bg-zinc-800/80"
              />
            </section>

            {/* 프로젝트 (컬렉션) */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                프로젝트
              </h3>
              <div className="flex flex-wrap gap-1">
                {collections.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded bg-purple-900/40 px-2 py-0.5 text-xs text-purple-200 ring-1 ring-purple-800/50"
                  >
                    📁 {c}
                    <button
                      type="button"
                      onClick={() =>
                        setCollections(collections.filter((x) => x !== c))
                      }
                      className="text-purple-400 hover:text-red-400"
                      aria-label={`${c} 프로젝트 제거`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                list="modal-collection-suggestions"
                value={collectionInput}
                onChange={(e) => setCollectionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitCollection(collectionInput);
                  }
                }}
                onBlur={() =>
                  collectionInput && commitCollection(collectionInput)
                }
                placeholder="프로젝트 입력 후 Enter (없으면 새로 생성)"
                className="mt-2 w-full rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none ring-0 placeholder:text-zinc-500 focus:bg-zinc-800/80"
              />
              <datalist id="modal-collection-suggestions">
                {existingCollections.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </section>

            {/* 별점 */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                평가
              </h3>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(rating === n ? null : n)}
                    className="text-xl leading-none"
                    aria-label={`별점 ${n}`}
                  >
                    <Star
                      size={22}
                      className={cn(
                        rating && n <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-zinc-600",
                      )}
                    />
                  </button>
                ))}
              </div>
            </section>

            {/* 저장 버튼 */}
            {data.archived ? (
              <button
                type="button"
                onClick={saveAttributes}
                disabled={busy}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
              >
                {busy ? "저장 중…" : "태그·프로젝트·평가 저장"}
              </button>
            ) : (
              <button
                type="button"
                onClick={archive}
                disabled={busy}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
              >
                {busy ? "저장 중…" : "아카이브에 저장"}
              </button>
            )}

            {/* 메모 */}
            {data.archived && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  메모 ({notes.length})
                </h3>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={authorInput}
                    onChange={(e) => setAuthorInput(e.target.value)}
                    placeholder="작성자 이름 (선택)"
                    className="w-full rounded-full bg-zinc-800 px-3 py-1 text-xs placeholder:text-zinc-500"
                  />
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="이 영상에 대한 메모…"
                    rows={2}
                    className="w-full resize-none rounded-xl bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={addNote}
                    disabled={busy || !noteInput.trim()}
                    className="self-end rounded-full bg-zinc-700 px-3 py-1 text-xs hover:bg-zinc-600 disabled:opacity-50"
                  >
                    추가
                  </button>
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {notes.map((n) => (
                    <li
                      key={n.id}
                      className="group rounded-xl bg-zinc-800/50 p-2 text-xs"
                    >
                      <div className="flex items-center justify-between text-[10px] text-zinc-500">
                        <span>
                          {n.author ?? "익명"} ·{" "}
                          {new Date(n.createdAt).toLocaleDateString("ko-KR")}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteNote(n.id)}
                          className="opacity-0 hover:text-red-400 group-hover:opacity-100"
                          aria-label="메모 삭제"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-zinc-200">
                        {n.content}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.archived && data.id && (
              <button
                type="button"
                onClick={deleteVideo}
                className="mt-auto inline-flex items-center justify-center gap-1 rounded-full border border-red-900/50 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/50"
              >
                <Trash2 size={12} /> 아카이브에서 삭제
              </button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
