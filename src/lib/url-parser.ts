export type VideoSource = "youtube" | "tvcf" | "other";

export interface ParsedVideoUrl {
  source: VideoSource;
  sourceId: string | null;
  normalizedUrl: string;
  embedUrl: string | null;
}

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "music.youtube.com",
]);

const TVCF_HOSTS = new Set(["tvcf.co.kr", "www.tvcf.co.kr"]);

export function parseVideoUrl(rawUrl: string): ParsedVideoUrl {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return {
      source: "other",
      sourceId: null,
      normalizedUrl: rawUrl,
      embedUrl: null,
    };
  }

  const host = url.hostname.toLowerCase();

  // YouTube
  if (YT_HOSTS.has(host)) {
    const id = extractYouTubeId(url);
    return {
      source: "youtube",
      sourceId: id,
      normalizedUrl: id ? `https://www.youtube.com/watch?v=${id}` : url.toString(),
      embedUrl: id ? `https://www.youtube.com/embed/${id}` : null,
    };
  }

  // TVCF — URL 패턴이 공개되어 있지 않으므로 경로 전체를 sourceId로 저장.
  // 임베드는 보장되지 않으므로 null. UI에서는 "원본 페이지 열기"로 fallback.
  if (TVCF_HOSTS.has(host)) {
    return {
      source: "tvcf",
      sourceId: url.pathname + url.search,
      normalizedUrl: url.toString(),
      embedUrl: null,
    };
  }

  return {
    source: "other",
    sourceId: null,
    normalizedUrl: url.toString(),
    embedUrl: null,
  };
}

function extractYouTubeId(url: URL): string | null {
  // youtu.be/<id>
  if (url.hostname === "youtu.be") {
    const id = url.pathname.replace(/^\//, "").split("/")[0];
    return isValidYtId(id) ? id : null;
  }

  // youtube.com/watch?v=<id>
  const vParam = url.searchParams.get("v");
  if (vParam && isValidYtId(vParam)) return vParam;

  // youtube.com/shorts/<id>, /embed/<id>, /live/<id>
  const m = url.pathname.match(/^\/(shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
  if (m) return m[2];

  return null;
}

function isValidYtId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}
