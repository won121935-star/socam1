"use client";

import { useState } from "react";
import { ExternalLink, Link2, X } from "lucide-react";

export function AddUrlDialog({
  existingCollections = [],
  defaultCollection,
  onClose,
  onSaved,
}: {
  existingCollections?: string[];
  defaultCollection?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [project, setProject] = useState(defaultCollection ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean);
      const collectionList = project.trim() ? [project.trim()] : [];
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          tags: tagList,
          collections: collectionList,
          note: note.trim() || undefined,
          noteAuthor:
            typeof window !== "undefined"
              ? window.localStorage.getItem("ba:author") ?? undefined
              : undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "저장에 실패했습니다.");
        return;
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-zinc-900 p-5 shadow-2xl ring-1 ring-zinc-800"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Link2 size={18} /> URL로 아카이브
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-zinc-800"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-1 flex flex-wrap gap-1.5">
          <a
            href="https://tvcf.co.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-emerald-900/40 px-3 py-1 text-[11px] text-emerald-200 ring-1 ring-emerald-800/50 hover:bg-emerald-900/60"
          >
            📺 TVCF에서 찾기 <ExternalLink size={10} />
          </a>
          <a
            href="https://www.youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-red-900/40 px-3 py-1 text-[11px] text-red-200 ring-1 ring-red-800/50 hover:bg-red-900/60"
          >
            ▶ YouTube 열기 <ExternalLink size={10} />
          </a>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-400">
              영상 URL (YouTube · tvcf.co.kr · 기타)
            </span>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... 또는 https://tvcf.co.kr/..."
              className="rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-400">
              프로젝트 (선택, 기존 이름 또는 새로 생성)
            </span>
            <input
              type="text"
              list="add-url-collection-suggestions"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="예: 2024 가전 광고 레퍼런스"
              className="rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500"
            />
            <datalist id="add-url-collection-suggestions">
              {existingCollections.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-400">
              태그 (쉼표로 구분)
            </span>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="가전, 2024, 로고모션"
              className="rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-400">
              메모 (선택)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="이 영상을 왜 저장하는가"
              className="resize-none rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none placeholder:text-zinc-500"
            />
          </label>

          {error && (
            <div className="rounded-xl bg-red-950/50 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm hover:bg-zinc-800"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={busy || !url.trim()}
              className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
            >
              {busy ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
