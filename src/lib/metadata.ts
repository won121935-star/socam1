// URL에서 최소한의 메타데이터 뽑기.
// - YouTube: Data API 또는 oEmbed fallback
// - TVCF: OpenGraph 파싱

import { parseVideoUrl } from "./url-parser";
import { getYouTubeVideoInfo } from "./youtube";

export interface UrlMetadata {
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
}

export async function extractMetadata(rawUrl: string): Promise<UrlMetadata> {
  const parsed = parseVideoUrl(rawUrl);

  if (parsed.source === "youtube" && parsed.sourceId) {
    const info = await getYouTubeVideoInfo(parsed.sourceId);
    if (info) {
      return {
        source: "youtube",
        sourceId: info.sourceId,
        url: info.url,
        embedUrl: info.embedUrl,
        title: info.title,
        description: info.description || null,
        thumbnailUrl: info.thumbnailUrl || null,
        channelName: info.channelName || null,
        durationSec: info.durationSec,
        publishedAt: info.publishedAt,
      };
    }

    // API 키 없으면 oEmbed fallback
    const oe = await fetchYouTubeOEmbed(parsed.sourceId);
    return {
      source: "youtube",
      sourceId: parsed.sourceId,
      url: parsed.normalizedUrl,
      embedUrl: parsed.embedUrl,
      title: oe?.title ?? `YouTube video ${parsed.sourceId}`,
      description: null,
      thumbnailUrl: oe?.thumbnail_url ?? `https://i.ytimg.com/vi/${parsed.sourceId}/hqdefault.jpg`,
      channelName: oe?.author_name ?? null,
      durationSec: null,
      publishedAt: null,
    };
  }

  // TVCF 및 기타는 OpenGraph 파싱 시도
  const og = await fetchOpenGraph(parsed.normalizedUrl);

  return {
    source: parsed.source,
    sourceId: parsed.sourceId,
    url: parsed.normalizedUrl,
    embedUrl: parsed.embedUrl,
    title: og.title ?? parsed.normalizedUrl,
    description: og.description ?? null,
    thumbnailUrl: og.image ?? null,
    channelName: og.siteName ?? null,
    durationSec: null,
    publishedAt: null,
  };
}

async function fetchYouTubeOEmbed(
  videoId: string,
): Promise<{ title?: string; author_name?: string; thumbnail_url?: string } | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as { title: string; author_name: string; thumbnail_url: string };
  } catch {
    return null;
  }
}

interface OpenGraph {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

async function fetchOpenGraph(url: string): Promise<OpenGraph> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) BrandArchiveBot/1.0",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return {};
    const html = await res.text();
    return parseOpenGraph(html);
  } catch {
    return {};
  }
}

function parseOpenGraph(html: string): OpenGraph {
  const pick = (prop: string): string | undefined => {
    const re = new RegExp(
      `<meta\\s+[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`,
      "i",
    );
    const m = html.match(re);
    if (m) return m[1];
    // content 속성이 먼저 오는 경우
    const re2 = new RegExp(
      `<meta\\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,
      "i",
    );
    return html.match(re2)?.[1];
  };

  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

  return {
    title: pick("og:title") ?? titleTagMatch?.[1]?.trim(),
    description: pick("og:description") ?? pick("description"),
    image: pick("og:image"),
    siteName: pick("og:site_name"),
  };
}
