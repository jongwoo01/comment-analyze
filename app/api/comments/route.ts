import { NextResponse } from "next/server";

type YouTubeCommentThread = {
  id: string;
  snippet: {
    topLevelComment: {
      id: string;
      snippet: {
        authorDisplayName: string;
        textOriginal: string;
        likeCount: number;
        publishedAt: string;
      };
    };
  };
};

type VideoSnippetResponse = {
  items?: { snippet?: { title?: string; channelTitle?: string } }[];
};

function extractVideoId(raw: string): string | null {
  const normalized = raw.startsWith("http") ? raw : `https://${raw}`;

  try {
    const parsed = new URL(normalized);
    const pathSegments = parsed.pathname.split("/").filter(Boolean);

    if (parsed.hostname.includes("youtu.be")) {
      return pathSegments[0] ?? null;
    }

    if (parsed.searchParams.get("v")) {
      return parsed.searchParams.get("v");
    }

    if (pathSegments[0] === "embed" && pathSegments[1]) {
      return pathSegments[1];
    }

    if (pathSegments[0] === "shorts" && pathSegments[1]) {
      return pathSegments[1];
    }
  } catch (error) {
    console.error("[comments] URL parse error:", error);
  }

  // 최후 보정: 11자 비디오 ID 패턴 검색
  const match = raw.match(/([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

async function fetchVideoMeta(videoId: string, apiKey: string) {
  const metaUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  metaUrl.searchParams.set("part", "snippet");
  metaUrl.searchParams.set("id", videoId);
  metaUrl.searchParams.set("key", apiKey);

  const res = await fetch(metaUrl, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube videos API 실패: ${res.status} ${text}`);
  }

  const data: VideoSnippetResponse = await res.json();
  const snippet = data.items?.[0]?.snippet;
  return {
    title: snippet?.title ?? "제목 확인 불가",
    channel: snippet?.channelTitle ?? "채널 확인 불가",
  };
}

export async function POST(req: Request) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  const { videoUrl } = await req.json();
  if (!videoUrl || typeof videoUrl !== "string") {
    return NextResponse.json(
      { error: "videoUrl을 전달해주세요." },
      { status: 400 },
    );
  }

  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    return NextResponse.json(
      { error: "유효한 유튜브 URL이 아닙니다." },
      { status: 400 },
    );
  }

  const ytUrl = new URL(
    "https://www.googleapis.com/youtube/v3/commentThreads",
  );
  ytUrl.searchParams.set("part", "snippet");
  ytUrl.searchParams.set("videoId", videoId);
  ytUrl.searchParams.set("maxResults", "100");
  ytUrl.searchParams.set("order", "relevance");
  ytUrl.searchParams.set("textFormat", "plainText");
  ytUrl.searchParams.set("key", apiKey);

  try {
    const [commentRes, meta] = await Promise.all([
      fetch(ytUrl, { cache: "no-store" }),
      fetchVideoMeta(videoId, apiKey),
    ]);

    if (!commentRes.ok) {
      const cloned = commentRes.clone();
      type YouTubeErrorResponse = {
        error?: { errors?: { reason?: string }[] };
      };
      const json = (await cloned
        .json()
        .catch(() => null)) as YouTubeErrorResponse | null;
      const text = json
        ? JSON.stringify(json)
        : await commentRes.text().catch(() => "");

      const apiReason =
        typeof json === "object" && json?.error?.errors?.[0]?.reason;

      const friendly =
        apiReason === "commentsDisabled"
          ? "이 영상은 댓글이 비공개라 데이터를 불러올 수 없습니다."
        : apiReason === "quotaExceeded"
            ? "YouTube API 할당량이 초과되었습니다."
            : apiReason === "forbidden"
              ? "이 영상의 댓글에 접근할 권한이 없어 불러올 수 없습니다. (댓글 비공개/차단/연령 제한/지역 제한 가능성)"
            : null;

      throw new Error(
        friendly ?? `YouTube API 오류: ${commentRes.status} ${text}`,
      );
    }

    const data = await commentRes.json();
    const threads: YouTubeCommentThread[] = data.items ?? [];

    const comments = threads
      .map((thread) => {
        const snippet = thread.snippet?.topLevelComment?.snippet;
        if (!snippet) return null;
        return {
          id: thread.id,
          author: snippet.authorDisplayName,
          text: snippet.textOriginal,
          likes: snippet.likeCount ?? 0,
          publishedAt: snippet.publishedAt,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.likes ?? 0) - (a?.likes ?? 0))
      .slice(0, 30);

    return NextResponse.json({
      videoTitle: meta.title,
      channelTitle: meta.channel,
      comments,
    });
  } catch (error) {
    console.error("[comments] fetch error", error);
    return NextResponse.json(
      {
        error: "유튜브 댓글을 불러오는 중 문제가 발생했습니다.",
        details:
          error instanceof Error ? error.message : "알 수 없는 오류입니다.",
      },
      { status: 500 },
    );
  }
}
