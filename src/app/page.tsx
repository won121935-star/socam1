"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Plus, Film, AlertCircle, ExternalLink } from "lucide-react";
import { VideoCard, type VideoCardData } from "@/components/VideoCard";
import { VideoModal, type VideoModalData } from "@/components/VideoModal";
import { AddUrlDialog } from "@/components/AddUrlDialog";
import { cn } from "@/lib/cn";

type YTResult = {
  kind: "youtube-live";
  source: "youtube";
  sourceId: string;
  url: string;
  embedUrl: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelName: string;
  durationSec: number | null;
  publishedAt: string;
  archived: boolean;
};

type TVCFResult = {
  source: "tvcf";
  id: string;
  sourceId: string | null;
  url: string;
  embedUrl: string | null;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  channelName: string | null;
  durationSec: number | null;
  publishedAt: string | null;
  tags: string[];
  collections: string[];
  rating: number | null;
  cached: boolean;
  archived: boolean;
};

type ArchiveVideo = {
  id: string;
  source: "youtube" | "tvcf" | "other";
  sourceId: string | null;
  url: string;
  embedUrl: string | null;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  channelName: string | null;
  durationSec: number | null;
  publishedAt: string | null;
  rating: number | null;
  tags: string[];
  collections: string[];
  notes: number;
  createdAt: string;
};

type TagSummary = { name: string; count: number };
type CollectionSummary = { id: string; name: string; description: string | null; count: number };
type GroupBy = "none" | "project";
const UNCATEGORIZED = "__uncategorized__";

export default function Home() {
  const [tab, setTab] = useState<"search" | "archive">("search");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const [ytResults, setYtResults] = useState<YTResult[]>([]);
  const [ytNextPageToken, setYtNextPageToken] = useState<string | null>(null);
  const [ytTotalResults, setYtTotalResults] = useState<number | null>(null);
  const [tvcfResults, setTvcfResults] = useState<TVCFResult[]>([]);
  const [tvcfTotal, setTvcfTotal] = useState(0);
  const [tvcfHasMore, setTvcfHasMore] = useState(false);
  const [hasYoutubeKey, setHasYoutubeKey] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingMoreTvcf, setLoadingMoreTvcf] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [archiveVideos, setArchiveVideos] = useState<ArchiveVideo[]>([]);
  const [archiveQuery, setArchiveQuery] = useState("");
  const [submittedArchiveQuery, setSubmittedArchiveQuery] = useState("");
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<TagSummary[]>([]);
  const [allCollections, setAllCollections] = useState<CollectionSummary[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [openedCollection, setOpenedCollection] = useState<string | null>(null);

  // 아카이브 정렬·길이 필터
  type SortKey = "recent" | "rating" | "length-asc" | "length-desc" | "title";
  type LengthBucket = "all" | "short" | "medium" | "long";
  const [archiveSort, setArchiveSort] = useState<SortKey>("recent");
  const [archiveLength, setArchiveLength] = useState<LengthBucket>("all");

  const [modalVideo, setModalVideo] = useState<VideoModalData | null>(null);
  const [archivingKey, setArchivingKey] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [defaultCollectionForAdd, setDefaultCollectionForAdd] = useState<string | undefined>();

  const refreshTags = useCallback(async () => {
    const res = await fetch("/api/tags");
    if (!res.ok) return;
    const json = (await res.json()) as { tags: TagSummary[] };
    setAllTags(json.tags);
  }, []);

  const refreshCollections = useCallback(async () => {
    const res = await fetch("/api/collections");
    if (!res.ok) return;
    const json = (await res.json()) as { collections: CollectionSummary[] };
    setAllCollections(json.collections);
  }, []);

  const refreshArchive = useCallback(async () => {
    const params = new URLSearchParams();
    if (activeTagFilter) params.set("tag", activeTagFilter);
    if (submittedArchiveQuery.trim()) params.set("q", submittedArchiveQuery.trim());
    if (archiveSort !== "recent") params.set("sort", archiveSort);
    if (archiveLength === "short") params.set("maxLength", "30");
    else if (archiveLength === "medium") {
      params.set("minLength", "31");
      params.set("maxLength", "60");
    } else if (archiveLength === "long") params.set("minLength", "61");
    const res = await fetch(`/api/videos?${params.toString()}`);
    if (!res.ok) return;
    const json = (await res.json()) as { videos: ArchiveVideo[] };
    setArchiveVideos(json.videos);
  }, [activeTagFilter, submittedArchiveQuery, archiveSort, archiveLength]);

  useEffect(() => {
    refreshTags();
    refreshCollections();
  }, [refreshTags, refreshCollections]);

  useEffect(() => {
    if (tab === "archive") refreshArchive();
  }, [tab, refreshArchive]);

  // 공유 링크 (?v=videoId) 자동 모달
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("v");
    if (!id) return;
    void openArchiveModal(id);
    // 모달 후엔 URL 정리 (뒤로가기에 ?v= 안 남기게)
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);
    // 마운트 1회만
  }, []);

  // 폴더 모드를 떠나거나 그룹핑이 꺼지면 열린 폴더 초기화
  useEffect(() => {
    if (groupBy !== "project") setOpenedCollection(null);
  }, [groupBy]);

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setSubmittedQuery(q);
    setLoadingSearch(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        setSearchError("검색에 실패했습니다.");
        return;
      }
      const json = (await res.json()) as {
        youtube: YTResult[];
        nextPageToken: string | null;
        totalResults: number | null;
        tvcf: TVCFResult[];
        tvcfTotal: number;
        tvcfHasMore: boolean;
        hasYoutubeKey: boolean;
      };
      setYtResults(json.youtube);
      setYtNextPageToken(json.nextPageToken);
      setYtTotalResults(json.totalResults);
      setTvcfResults(json.tvcf);
      setTvcfTotal(json.tvcfTotal);
      setTvcfHasMore(json.tvcfHasMore);
      setHasYoutubeKey(json.hasYoutubeKey);
    } finally {
      setLoadingSearch(false);
    }
  }

  async function loadMoreYouTube() {
    if (!ytNextPageToken || !submittedQuery.trim()) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(submittedQuery)}&pageToken=${encodeURIComponent(ytNextPageToken)}&tvcfOffset=${tvcfResults.length}`,
      );
      if (!res.ok) return;
      const json = (await res.json()) as {
        youtube: YTResult[];
        nextPageToken: string | null;
        totalResults: number | null;
      };
      setYtResults((prev) => {
        const seen = new Set(prev.map((r) => r.sourceId));
        const fresh = json.youtube.filter((r) => !seen.has(r.sourceId));
        return [...prev, ...fresh];
      });
      setYtNextPageToken(json.nextPageToken);
      if (json.totalResults != null) setYtTotalResults(json.totalResults);
    } finally {
      setLoadingMore(false);
    }
  }

  async function loadMoreTvcf() {
    if (!tvcfHasMore || !submittedQuery.trim()) return;
    setLoadingMoreTvcf(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(submittedQuery)}&tvcfOffset=${tvcfResults.length}&maxResults=0`,
      );
      if (!res.ok) return;
      const json = (await res.json()) as {
        tvcf: TVCFResult[];
        tvcfTotal: number;
        tvcfHasMore: boolean;
      };
      setTvcfResults((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        const fresh = json.tvcf.filter((r) => !seen.has(r.id));
        return [...prev, ...fresh];
      });
      setTvcfTotal(json.tvcfTotal);
      setTvcfHasMore(json.tvcfHasMore);
    } finally {
      setLoadingMoreTvcf(false);
    }
  }

  async function archiveYtResult(y: YTResult) {
    setArchivingKey(`yt:${y.sourceId}`);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: y.url }),
      });
      if (res.ok) {
        setYtResults((prev) =>
          prev.map((r) =>
            r.sourceId === y.sourceId ? { ...r, archived: true } : r,
          ),
        );
        refreshTags();
      }
    } finally {
      setArchivingKey(null);
    }
  }

  // TVCF 캐시 항목을 사용자 아카이브에 편입 (cached=false 로 플립)
  async function saveTvcfToArchive(t: TVCFResult) {
    setArchivingKey(`tvcf:${t.id}`);
    try {
      const res = await fetch(`/api/videos/${t.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cached: false }),
      });
      if (res.ok) {
        setTvcfResults((prev) =>
          prev.map((r) =>
            r.id === t.id ? { ...r, cached: false, archived: true } : r,
          ),
        );
        refreshArchive();
        refreshTags();
        refreshCollections();
      }
    } finally {
      setArchivingKey(null);
    }
  }

  async function openYtModal(y: YTResult) {
    if (y.archived) {
      // 이미 아카이브된 항목 — DB에서 가져와서 모달
      const r = await fetch(
        `/api/videos?source=youtube&q=${encodeURIComponent(y.sourceId)}`,
      );
      if (r.ok) {
        const json = (await r.json()) as { videos: ArchiveVideo[] };
        const match = json.videos.find((v) => v.sourceId === y.sourceId);
        if (match) {
          void openArchiveModal(match.id);
          return;
        }
      }
    }
    setModalVideo({
      source: y.source,
      sourceId: y.sourceId,
      url: y.url,
      embedUrl: y.embedUrl,
      title: y.title,
      description: y.description,
      channelName: y.channelName,
      tags: [],
      rating: null,
      notes: [],
      archived: false,
    });
  }

  async function openArchiveModal(id: string) {
    const res = await fetch(`/api/videos/${id}`);
    if (!res.ok) return;
    const json = await res.json();
    const v = json.video;
    setModalVideo({
      id: v.id,
      source: v.source,
      sourceId: v.sourceId,
      url: v.url,
      embedUrl: v.embedUrl,
      title: v.title,
      description: v.description,
      channelName: v.channelName,
      tags: v.tags.map((t: { name: string }) => t.name),
      collections: (v.collections ?? []).map(
        (c: { name: string }) => c.name,
      ),
      rating: v.rating,
      notes: v.notes.map(
        (n: { id: string; author: string | null; content: string; createdAt: string }) => ({
          id: n.id,
          author: n.author,
          content: n.content,
          createdAt: n.createdAt,
        }),
      ),
      archived: true,
    });
  }

  const filteredArchive = useMemo(() => archiveVideos, [archiveVideos]);

  // 그룹핑 — 프로젝트별로 묶기
  const groupedArchive = useMemo(() => {
    if (groupBy !== "project") return null;
    const groups = new Map<string, ArchiveVideo[]>();
    for (const v of filteredArchive) {
      const cols = v.collections.length > 0 ? v.collections : [UNCATEGORIZED];
      for (const c of cols) {
        if (!groups.has(c)) groups.set(c, []);
        groups.get(c)!.push(v);
      }
    }
    const ordered: { name: string; videos: ArchiveVideo[] }[] = [];
    // 프로젝트 알파벳 순 (한글은 자동 정렬)
    const names = [...groups.keys()].filter((n) => n !== UNCATEGORIZED).sort();
    for (const n of names) ordered.push({ name: n, videos: groups.get(n)! });
    if (groups.has(UNCATEGORIZED)) {
      ordered.push({ name: UNCATEGORIZED, videos: groups.get(UNCATEGORIZED)! });
    }
    return ordered;
  }, [filteredArchive, groupBy]);

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Film className="text-blue-400" size={28} />
          <h1 className="text-xl font-semibold">소캠1팀 야근 방지</h1>
          <span className="hidden text-xs text-zinc-500 md:inline">
            · 브랜드/광고 영상 아카이브
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://tvcf.co.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/60 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-900"
          >
            📺 TVCF 열기 <ExternalLink size={12} />
          </a>
          <button
            type="button"
            onClick={() => setShowAddDialog(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
          >
            <Plus size={14} /> URL로 추가
          </button>
        </div>
      </header>

      <div className="rounded-2xl bg-zinc-900/70 px-4 py-3 text-sm text-zinc-300 ring-1 ring-zinc-800">
        <p>검색창에 영상 검색 후 아카이빙 및 프로젝트 추가하여 넣어주시면 됩니다.</p>
        <p className="mt-0.5 text-xs text-zinc-400">개인별로 의견 넣기 가능</p>
      </div>

      <div className="flex gap-1 border-b border-zinc-800">
        {(["search", "archive"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition",
              tab === t
                ? "border-b-2 border-blue-500 text-white"
                : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {t === "search" ? "검색" : "아카이브"}
            {t === "archive" && archiveVideos.length > 0 && (
              <span className="ml-1.5 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px]">
                {archiveVideos.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "search" && (
        <>
          {/* 검색 전: hero 슬로건 */}
          {!submittedQuery && (
            <div className="flex flex-col items-center gap-2 pt-8 text-center md:pt-16">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-4xl">
                브랜드 영상, 한 번에 찾기
              </h2>
              <p className="text-sm text-zinc-400 md:text-base">
                YouTube + TVCF 라이브러리에서 동시 검색
              </p>
            </div>
          )}

          {/* 가운데 정렬된 큰 검색바 */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(query);
            }}
            className="mx-auto w-full max-w-2xl"
          >
            <div className="relative">
              <Search
                size={20}
                className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="검색어 입력 (예: 노란우산 광고)"
                className="w-full rounded-full bg-zinc-900 py-4 pl-14 pr-28 text-base outline-none ring-1 ring-zinc-800 transition placeholder:text-zinc-500 focus:ring-2 focus:ring-blue-500/60 md:text-lg"
              />
              <button
                type="submit"
                disabled={loadingSearch || !query.trim()}
                className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingSearch ? "검색 중…" : "검색"}
              </button>
            </div>
          </form>

          {!hasYoutubeKey && (
            <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-2xl bg-amber-950/40 px-4 py-2.5 text-xs text-amber-300 ring-1 ring-amber-900/50">
              <AlertCircle size={14} />
              YOUTUBE_API_KEY가 설정되지 않아 실시간 검색이 비활성화됐습니다.
            </div>
          )}

          {searchError && (
            <div className="mx-auto max-w-2xl rounded-2xl bg-red-950/50 px-4 py-2.5 text-sm text-red-300">
              {searchError}
            </div>
          )}

          {submittedQuery && !loadingSearch && ytResults.length === 0 && tvcfResults.length === 0 && (
            <div className="rounded-2xl bg-zinc-900 py-16 text-center text-sm text-zinc-500">
              “{submittedQuery}”에 대한 결과가 없습니다.
            </div>
          )}

          {/* TVCF 섹션 */}
          {tvcfResults.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-400">
                <span className="text-emerald-400">📺 TVCF 결과</span>
                — {tvcfResults.length}개 표시
                {tvcfTotal > tvcfResults.length && (
                  <span className="text-[11px] text-zinc-500">
                    (매칭 {tvcfTotal.toLocaleString()}건)
                  </span>
                )}
              </h2>
              <Grid>
                {tvcfResults.map((t) => (
                  <VideoCard
                    key={`tvcf:${t.id}`}
                    data={tvcfCardData(t)}
                    onClick={() => openArchiveModal(t.id)}
                    onArchive={() => saveTvcfToArchive(t)}
                    archiving={archivingKey === `tvcf:${t.id}`}
                  />
                ))}
              </Grid>
              {tvcfHasMore && (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={loadMoreTvcf}
                    disabled={loadingMoreTvcf}
                    className="rounded-full bg-emerald-900/40 px-6 py-2.5 text-sm font-medium text-emerald-100 hover:bg-emerald-900/60 disabled:opacity-50"
                  >
                    {loadingMoreTvcf ? "불러오는 중…" : "TVCF 더 보기 ↓"}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* YouTube 섹션 */}
          {ytResults.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-400">
                <span className="text-red-400">▶ YouTube 결과</span>
                — {ytResults.length}개 표시
                {ytTotalResults != null && ytTotalResults > ytResults.length && (
                  <span className="text-[11px] text-zinc-500">
                    (전체 약 {ytTotalResults.toLocaleString()}건)
                  </span>
                )}
              </h2>
              <Grid>
                {ytResults.map((y) => (
                  <VideoCard
                    key={`yt:${y.sourceId}`}
                    data={ytCardData(y)}
                    onClick={() => openYtModal(y)}
                    onArchive={() => archiveYtResult(y)}
                    archiving={archivingKey === `yt:${y.sourceId}`}
                  />
                ))}
              </Grid>

              {ytNextPageToken && (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={loadMoreYouTube}
                    disabled={loadingMore}
                    className="rounded-full bg-zinc-800 px-6 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
                  >
                    {loadingMore ? "불러오는 중…" : "YouTube 더 보기 ↓"}
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {tab === "archive" && (
        <>
          {/* 아카이브 검색창 */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmittedArchiveQuery(archiveQuery);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                type="text"
                value={archiveQuery}
                onChange={(e) => setArchiveQuery(e.target.value)}
                placeholder="아카이브 안에서 검색 (제목·채널·태그·프로젝트·광고주·에이전시)"
                className="w-full rounded-full bg-zinc-900 py-2.5 pl-9 pr-9 text-sm outline-none ring-1 ring-zinc-800 focus:ring-blue-500"
              />
              {archiveQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setArchiveQuery("");
                    setSubmittedArchiveQuery("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
                  aria-label="검색어 지우기"
                >
                  ×
                </button>
              )}
            </div>
            <button
              type="submit"
              className="rounded-full bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            >
              검색
            </button>
          </form>

          {/* 정렬 + 길이 필터 + 그룹핑 토글 한 줄 */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 정렬 */}
            <select
              value={archiveSort}
              onChange={(e) => setArchiveSort(e.target.value as typeof archiveSort)}
              className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 ring-1 ring-zinc-800 outline-none hover:bg-zinc-800"
            >
              <option value="recent">최신순</option>
              <option value="rating">⭐ 별점순</option>
              <option value="length-asc">길이 짧은순</option>
              <option value="length-desc">길이 긴순</option>
              <option value="title">제목순</option>
            </select>

            {/* 길이 버킷 */}
            <div className="flex items-center gap-1 rounded-full bg-zinc-900 p-1 ring-1 ring-zinc-800">
              {([
                ["all", "전체"],
                ["short", "≤30s"],
                ["medium", "31–60s"],
                ["long", ">60s"],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setArchiveLength(k)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition",
                    archiveLength === k
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-400 hover:text-zinc-200",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            {/* 그룹핑 토글 */}
            <div className="flex items-center gap-1 rounded-md bg-zinc-900 p-1 ring-1 ring-zinc-800">
              {(["none", "project"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroupBy(g)}
                  className={cn(
                    "rounded px-3 py-1 text-xs font-medium transition",
                    groupBy === g
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-400 hover:text-zinc-200",
                  )}
                >
                  {g === "none" ? "리스트" : "📁 프로젝트별"}
                </button>
              ))}
            </div>

            <div className="text-xs text-zinc-500">
              {submittedArchiveQuery && (
                <span className="mr-2 text-zinc-400">
                  “{submittedArchiveQuery}” 결과
                </span>
              )}
              {allCollections.length > 0 && (
                <>
                  프로젝트 {allCollections.length}개 · 영상 {archiveVideos.length}개
                </>
              )}
            </div>
          </div>

          {/* 태그 필터 칩 (리스트 모드일 때만) */}
          {groupBy === "none" && allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTagFilter(null)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs",
                  activeTagFilter === null
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
                )}
              >
                전체 ({archiveVideos.length})
              </button>
              {allTags.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setActiveTagFilter(t.name)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs",
                    activeTagFilter === t.name
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
                  )}
                >
                  #{t.name}
                  <span className="ml-1 text-[10px] opacity-70">{t.count}</span>
                </button>
              ))}
            </div>
          )}

          {filteredArchive.length === 0 ? (
            <div className="rounded-2xl bg-zinc-900 py-16 text-center text-sm text-zinc-500">
              아카이브가 비어있습니다.
              <br />
              <button
                type="button"
                onClick={() => setShowAddDialog(true)}
                className="mt-3 inline-flex items-center gap-1 rounded-full bg-blue-600 px-4 py-2 text-xs text-white hover:bg-blue-500"
              >
                <Plus size={12} /> 첫 영상 추가하기
              </button>
            </div>
          ) : groupBy === "project" && groupedArchive ? (
            openedCollection === null ? (
              // 폴더(프로젝트) 그리드
              <Grid>
                {groupedArchive.map((g) => (
                  <FolderCard
                    key={g.name}
                    name={g.name}
                    videos={g.videos}
                    onOpen={() => setOpenedCollection(g.name)}
                  />
                ))}
              </Grid>
            ) : (
              // 폴더 안 — 해당 프로젝트의 영상들
              (() => {
                const opened = groupedArchive.find(
                  (g) => g.name === openedCollection,
                );
                if (!opened) {
                  return (
                    <div className="flex flex-col items-center gap-3 rounded-2xl bg-zinc-900 py-12 text-sm text-zinc-500">
                      이 프로젝트에 영상이 없습니다.
                      <button
                        type="button"
                        onClick={() => setOpenedCollection(null)}
                        className="rounded-full bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
                      >
                        ← 프로젝트 목록
                      </button>
                    </div>
                  );
                }
                return (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenedCollection(null)}
                        className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
                      >
                        ← 프로젝트 목록
                      </button>
                      <div className="flex items-center gap-2">
                        <h2 className="flex items-center gap-2 text-base font-semibold">
                          {opened.name === UNCATEGORIZED ? (
                            <span className="text-zinc-300">
                              📂 미분류
                            </span>
                          ) : (
                            <span className="text-purple-300">
                              📁 {opened.name}
                            </span>
                          )}
                          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                            {opened.videos.length}
                          </span>
                        </h2>
                        {opened.name !== UNCATEGORIZED && (
                          <button
                            type="button"
                            onClick={() => {
                              setDefaultCollectionForAdd(opened.name);
                              setShowAddDialog(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700"
                          >
                            <Plus size={10} /> 이 프로젝트에 추가
                          </button>
                        )}
                      </div>
                    </div>
                    <Grid>
                      {opened.videos.map((v) => (
                        <VideoCard
                          key={v.id}
                          data={archiveVideoCardData(v)}
                          onClick={() => openArchiveModal(v.id)}
                        />
                      ))}
                    </Grid>
                  </div>
                );
              })()
            )
          ) : (
            <Grid>
              {filteredArchive.map((v) => (
                <VideoCard
                  key={v.id}
                  data={archiveVideoCardData(v)}
                  onClick={() => openArchiveModal(v.id)}
                />
              ))}
            </Grid>
          )}
        </>
      )}

      {modalVideo && (
        <VideoModal
          data={modalVideo}
          existingCollections={allCollections.map((c) => c.name)}
          onClose={() => setModalVideo(null)}
          onArchived={async (newId) => {
            await refreshTags();
            await refreshCollections();
            await openArchiveModal(newId);
            if (tab === "archive") refreshArchive();
            if (modalVideo.sourceId) {
              setYtResults((prev) =>
                prev.map((r) =>
                  r.sourceId === modalVideo.sourceId
                    ? { ...r, archived: true }
                    : r,
                ),
              );
            }
          }}
          onChanged={() => {
            refreshTags();
            refreshCollections();
            if (tab === "archive") refreshArchive();
          }}
          onDeleted={() => {
            refreshTags();
            refreshCollections();
            refreshArchive();
          }}
        />
      )}

      {showAddDialog && (
        <AddUrlDialog
          existingCollections={allCollections.map((c) => c.name)}
          defaultCollection={defaultCollectionForAdd}
          onClose={() => {
            setShowAddDialog(false);
            setDefaultCollectionForAdd(undefined);
          }}
          onSaved={() => {
            refreshTags();
            refreshCollections();
            refreshArchive();
          }}
        />
      )}
    </main>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

function FolderCard({
  name,
  videos,
  onOpen,
}: {
  name: string;
  videos: ArchiveVideo[];
  onOpen: () => void;
}) {
  const isUncat = name === UNCATEGORIZED;
  const thumbs = videos
    .map((v) => v.thumbnailUrl)
    .filter((t): t is string => Boolean(t))
    .slice(0, 4);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex cursor-pointer flex-col overflow-hidden rounded-lg text-left ring-1 transition",
        isUncat
          ? "bg-zinc-900 ring-zinc-800 hover:ring-zinc-600"
          : "bg-purple-950/30 ring-purple-900/40 hover:ring-purple-700",
      )}
    >
      <div className="relative aspect-video bg-zinc-800">
        {thumbs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-5xl">
            {isUncat ? "📂" : "📁"}
          </div>
        ) : thumbs.length === 1 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbs[0]}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
            {thumbs.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt=""
                className="h-full w-full object-cover"
              />
            ))}
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
          <span className="text-2xl drop-shadow-lg">{isUncat ? "📂" : "📁"}</span>
          <span className="rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            {videos.length}개
          </span>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-between gap-2 p-3">
        <span
          className={cn(
            "truncate text-sm font-medium",
            isUncat ? "text-zinc-300" : "text-purple-100",
          )}
        >
          {isUncat ? "미분류" : name}
        </span>
        <span className="text-xs text-zinc-500 transition group-hover:text-zinc-300">
          열기 →
        </span>
      </div>
    </button>
  );
}

function ytCardData(y: YTResult): VideoCardData {
  return {
    title: y.title,
    thumbnailUrl: y.thumbnailUrl,
    channelName: y.channelName,
    durationSec: y.durationSec,
    source: y.source,
    archived: y.archived,
  };
}

function tvcfCardData(t: TVCFResult): VideoCardData {
  return {
    title: t.title,
    thumbnailUrl: t.thumbnailUrl,
    channelName: t.channelName,
    durationSec: t.durationSec,
    source: t.source,
    archived: t.archived,
    tags: t.tags,
    collections: t.collections,
    rating: t.rating,
  };
}

function archiveVideoCardData(v: ArchiveVideo): VideoCardData {
  return {
    title: v.title,
    thumbnailUrl: v.thumbnailUrl,
    channelName: v.channelName,
    durationSec: v.durationSec,
    source: v.source,
    archived: true,
    tags: v.tags,
    collections: v.collections,
    rating: v.rating,
  };
}
