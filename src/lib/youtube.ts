// YouTube Data API v3 helpers.
// API 키는 .env의 YOUTUBE_API_KEY 에 설정.

export interface YouTubeSearchItem {
  sourceId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelName: string;
  publishedAt: string;
  url: string;
  embedUrl: string;
  durationSec: number | null;
}

const API_BASE = "https://www.googleapis.com/youtube/v3";

export interface YouTubeSearchPage {
  items: YouTubeSearchItem[];
  nextPageToken: string | null;
  totalResults: number | null;
}

export async function searchYouTube(
  query: string,
  opts: { maxResults?: number; pageToken?: string } = {},
): Promise<YouTubeSearchPage> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { items: [], nextPageToken: null, totalResults: null };
  if (!query.trim()) return { items: [], nextPageToken: null, totalResults: null };

  const maxResults = Math.min(opts.maxResults ?? 50, 50);

  const searchUrl = new URL(`${API_BASE}/search`);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", String(maxResults));
  if (opts.pageToken) searchUrl.searchParams.set("pageToken", opts.pageToken);
  searchUrl.searchParams.set("key", key);

  const sRes = await fetch(searchUrl.toString(), { cache: "no-store" });
  if (!sRes.ok) {
    const text = await sRes.text();
    throw new Error(`YouTube search failed: ${sRes.status} ${text.slice(0, 300)}`);
  }
  const sData = (await sRes.json()) as {
    nextPageToken?: string;
    pageInfo?: { totalResults?: number };
    items?: Array<{
      id: { videoId: string };
      snippet: {
        title: string;
        description: string;
        channelTitle: string;
        publishedAt: string;
        thumbnails: {
          high?: { url: string };
          medium?: { url: string };
          default?: { url: string };
        };
      };
    }>;
  };

  const items = sData.items ?? [];
  if (items.length === 0) {
    return {
      items: [],
      nextPageToken: sData.nextPageToken ?? null,
      totalResults: sData.pageInfo?.totalResults ?? null,
    };
  }

  const ids = items.map((i) => i.id.videoId).join(",");
  const durMap = await fetchDurations(ids, key);

  return {
    items: items.map((i) => {
      const id = i.id.videoId;
      const thumb =
        i.snippet.thumbnails.high?.url ??
        i.snippet.thumbnails.medium?.url ??
        i.snippet.thumbnails.default?.url ??
        "";
      return {
        sourceId: id,
        title: decodeEntities(i.snippet.title),
        description: i.snippet.description,
        thumbnailUrl: thumb,
        channelName: i.snippet.channelTitle,
        publishedAt: i.snippet.publishedAt,
        url: `https://www.youtube.com/watch?v=${id}`,
        embedUrl: `https://www.youtube.com/embed/${id}`,
        durationSec: durMap.get(id) ?? null,
      };
    }),
    nextPageToken: sData.nextPageToken ?? null,
    totalResults: sData.pageInfo?.totalResults ?? null,
  };
}

export async function getYouTubeVideoInfo(
  videoId: string,
): Promise<YouTubeSearchItem | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;

  const url = new URL(`${API_BASE}/videos`);
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      snippet: {
        title: string;
        description: string;
        channelTitle: string;
        publishedAt: string;
        thumbnails: Record<string, { url: string } | undefined>;
      };
      contentDetails: { duration: string };
    }>;
  };

  const item = data.items?.[0];
  if (!item) return null;

  const thumb =
    item.snippet.thumbnails.high?.url ??
    item.snippet.thumbnails.medium?.url ??
    item.snippet.thumbnails.default?.url ??
    "";

  return {
    sourceId: item.id,
    title: decodeEntities(item.snippet.title),
    description: item.snippet.description,
    thumbnailUrl: thumb,
    channelName: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${item.id}`,
    embedUrl: `https://www.youtube.com/embed/${item.id}`,
    durationSec: parseIsoDuration(item.contentDetails.duration),
  };
}

async function fetchDurations(
  ids: string,
  key: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!ids) return map;
  const url = new URL(`${API_BASE}/videos`);
  url.searchParams.set("part", "contentDetails");
  url.searchParams.set("id", ids);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return map;
  const data = (await res.json()) as {
    items?: Array<{ id: string; contentDetails: { duration: string } }>;
  };
  for (const it of data.items ?? []) {
    map.set(it.id, parseIsoDuration(it.contentDetails.duration));
  }
  return map;
}

// PT#H#M#S → seconds
function parseIsoDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] ?? "0", 10);
  const mm = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  return h * 3600 + mm * 60 + s;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec < 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
