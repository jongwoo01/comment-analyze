"use client";

import { useEffect, useMemo, useState } from "react";

type EmotionKey =
  | "joy"
  | "sadness"
  | "anger"
  | "surprise"
  | "disgust"
  | "fear";

type SentimentScores = Record<EmotionKey, number>;

type CommentBase = {
  id: string;
  author: string;
  text: string;
  likes: number;
  publishedAt: string;
};

type CommentBaseWithEmotions = CommentBase & {
  emotions?: SentimentScores;
};

type CommentInsight = CommentBase & { emotions: SentimentScores };

type AnalysisResponse = {
  videoTitle: string;
  channelName: string;
  summary: SentimentScores;
  totalComments: number;
  topComments: CommentInsight[];
};

type CommentsResponse = {
  videoTitle: string;
  channelTitle: string;
  comments: CommentBaseWithEmotions[];
  error?: string;
};

const EMOTIONS: {
  key: EmotionKey;
  label: string;
  accent: string;
  emoji: string;
}[] = [
  { key: "joy", label: "기쁨", accent: "#fbbf24", emoji: "😊" },
  { key: "sadness", label: "슬픔", accent: "#60a5fa", emoji: "😢" },
  { key: "anger", label: "분노", accent: "#f87171", emoji: "😡" },
  { key: "surprise", label: "놀람", accent: "#34d399", emoji: "😲" },
  { key: "disgust", label: "혐오", accent: "#a78bfa", emoji: "🤢" },
  { key: "fear", label: "불안", accent: "#f59e0b", emoji: "😰" },
];

const EMOTION_LEXICON: Record<EmotionKey, string[]> = {
  joy: ["좋", "사랑", "최고", "대박", "행복", "ㅋㅋ", "ㅎㅎ", "굿", "❤️", "😍", "멋져"],
  sadness: ["슬프", "아쉽", "속상", "ㅠ", "ㅜ", "눈물", "우울", "허전"],
  anger: ["화나", "짜증", "빡치", "열받", "분노", "최악", "역겹", "화났"],
  surprise: ["놀라", "헐", "미쳤", "와", "대박", "충격", "어메이징", "역대급"],
  disgust: ["별로", "싫", "구림", "노잼", "혐오", "어색", "촌스럽", "구리"],
  fear: ["불안", "무섭", "걱정", "위험", "떨리", "두렵", "긴장"],
};

function formatPercent(value: number) {
  return Math.round(value * 100);
}

function getDominantEmotion(emotions: SentimentScores) {
  return EMOTIONS.reduce(
    (prev, current) =>
      emotions[current.key] > emotions[prev.key] ? current : prev,
    EMOTIONS[0],
  );
}

function buildRadarPoints(values: number[], radius: number, size: number) {
  const center = size / 2;
  const angleStep = (Math.PI * 2) / values.length;

  const points = values
    .map((value, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const r = radius * value;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(" ");

  const axis = values.map((_, index) => {
    const angle = angleStep * index - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    return { x, y };
  });

  return { points, axis, center };
}

function normalizeSentiment(values: SentimentScores): SentimentScores {
  const total = Object.values(values).reduce((sum, v) => sum + v, 0);
  if (total === 0) {
    const even = 1 / EMOTIONS.length;
    return EMOTIONS.reduce(
      (acc, e) => ({ ...acc, [e.key]: even }),
      {} as SentimentScores,
    );
  }
  return EMOTIONS.reduce(
    (acc, e) => ({ ...acc, [e.key]: values[e.key] / total }),
    {} as SentimentScores,
  );
}

function ensureSentimentScores(
  emotions?: Partial<SentimentScores>,
): SentimentScores {
  const filled = EMOTIONS.reduce((acc, emotion) => {
    const value = emotions?.[emotion.key];
    acc[emotion.key] =
      typeof value === "number" && Number.isFinite(value) ? value : 0;
    return acc;
  }, {} as SentimentScores);

  return normalizeSentiment(filled);
}

function scoreEmotionByKeywords(text: string): SentimentScores {
  const normalized = text.toLowerCase();
  const scores: SentimentScores = {
    joy: 0.02,
    sadness: 0.02,
    anger: 0.02,
    surprise: 0.02,
    disgust: 0.02,
    fear: 0.02,
  };

  EMOTIONS.forEach((emotion) => {
    const keywords = EMOTION_LEXICON[emotion.key];
    keywords.forEach((keyword) => {
      if (normalized.includes(keyword)) {
        scores[emotion.key] += 0.18;
      }
    });
  });

  if (/[!?]{2,}/.test(normalized)) {
    scores.surprise += 0.12;
  }

  if (/ㅋㅋ+|ㅎㅎ+/.test(normalized)) {
    scores.joy += 0.1;
  }

  if (/ㅎㄷㄷ|ㄷㄷ/.test(normalized)) {
    scores.surprise += 0.08;
  }

  if (/ㅠ+|ㅜ+/.test(normalized)) {
    scores.sadness += 0.1;
  }

  return normalizeSentiment(scores);
}

function buildAnalysis(payload: CommentsResponse): AnalysisResponse {
  const enriched: CommentInsight[] = (payload.comments ?? []).map((comment) => ({
    ...comment,
    emotions: ensureSentimentScores(
      comment.emotions ?? scoreEmotionByKeywords(comment.text),
    ),
  }));

  const summary = EMOTIONS.reduce((acc, emotion) => {
    const avg =
      enriched.reduce(
        (sum, comment) => sum + comment.emotions[emotion.key],
        0,
      ) / Math.max(enriched.length, 1);
    acc[emotion.key] = avg;
    return acc;
  }, {} as SentimentScores);

  return {
    videoTitle: payload.videoTitle,
    channelName: payload.channelTitle,
    summary: normalizeSentiment(summary),
    totalComments: enriched.length,
    topComments: enriched.slice(0, 30),
  };
}

async function fetchAndAnalyze(videoUrl: string): Promise<AnalysisResponse> {
  const res = await fetch("/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoUrl }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({} as { error?: string; details?: string }));
    throw new Error(
      err.error
        ? `${err.error}${err.details ? ` (${err.details})` : ""}`
        : "댓글을 불러오지 못했습니다.",
    );
  }

  const data: CommentsResponse = await res.json();
  if (data.error) {
    throw new Error(data.error);
  }

  return buildAnalysis(data);
}

export default function Home() {
  const [videoUrl, setVideoUrl] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const sentimentList = useMemo(() => {
    if (!analysis) return [];
    return EMOTIONS.map((emotion) => ({
      ...emotion,
      value: analysis.summary[emotion.key] ?? 0,
    }));
  }, [analysis]);

  const radar = useMemo(() => {
    if (!analysis) return null;
    return buildRadarPoints(
      sentimentList.map((item) => item.value),
      120,
      320,
    );
  }, [analysis, sentimentList]);

  const highlighted = useMemo(
    () => {
      if (!analysis) return [];
      const start = page * PAGE_SIZE;
      return analysis.topComments.slice(start, start + PAGE_SIZE);
    },
    [analysis, page],
  );

  const totalPages = useMemo(() => {
    if (!analysis) return 0;
    const total = Math.min(analysis.topComments.length, 30);
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [analysis]);

  useEffect(() => {
    setPage(0);
  }, [analysis?.videoTitle]);

  async function handleAnalyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await fetchAndAnalyze(videoUrl);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const topEmotion = analysis
    ? sentimentList.reduce((prev, curr) =>
        curr.value > prev.value ? curr : prev,
      )
    : EMOTIONS[0];

  const positiveScore = analysis
    ? formatPercent(
        analysis.summary.joy + analysis.summary.surprise * 0.5,
      )
    : 0;

  const LinkForm = () => (
    <form
      onSubmit={handleAnalyze}
      className="relative flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 shadow-md"
    >
      <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
        🎥 Youtube Link
      </label>
      <input
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="https://www.youtube.com/watch?v=..."
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-emerald-200/50 transition focus:border-emerald-400 focus:ring-4"
        required
      />
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-xs text-rose-900">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-600">
          👍 Top 30 → 감정 계산 (키워드 기반)
        </span>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-300/60 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "🔄 가져오는 중..." : "✨ 분석"}
        </button>
      </div>
    </form>
  );

  if (!analysis) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-transparent text-slate-900">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute inset-10 rounded-[50px] border border-slate-200/70 bg-gradient-to-br from-white/80 via-transparent to-emerald-100/60 blur-[120px]" />
        </div>
        <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-12">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs uppercase tracking-[0.13em] text-sky-600 ring-1 ring-slate-200">
              댓글 감정 레이더
              <span className="rounded-full bg-emerald-400/80 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-950">
                Ready
              </span>
            </div>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
              유튜브 링크만 넣으면, 상위 댓글 감정을 바로 시각화합니다.
            </h1>
            <p className="text-sm text-slate-600 sm:text-base">
              처음 진입 시 복잡한 설명 없이, URL만 입력하면 분석으로
              넘어갑니다. YouTube Data API로 실제 댓글을 수집합니다.
            </p>
          </div>
          <div className="mt-6 max-w-2xl">
            <LinkForm />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent text-slate-900">
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute inset-10 rounded-[36px] border border-slate-200/80 bg-gradient-to-br from-white via-transparent to-emerald-100/70 blur-[120px]" />
      </div>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 pb-12 pt-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-sky-700 ring-1 ring-slate-200">
              📡 댓글 감정 레이더 · 실데이터
            </div>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              {analysis.videoTitle}
            </h1>
            <p className="text-sm text-slate-600">{analysis.channelName}</p>
          </div>
          <div className="w-full max-w-md">
            <LinkForm />
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
              🗨️ 댓글 개수
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {analysis.totalComments}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
              🎭 최빈 감정
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">
              {topEmotion.emoji} {topEmotion.label}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
              🌈 긍정 지수
            </p>
            <p className="mt-1 text-2xl font-semibold text-emerald-600">
              {positiveScore}%
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>🧭 감정 레이더</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] text-slate-700">
                스코어 평균
              </span>
            </div>
            <div className="mt-3 grid items-center gap-4 lg:grid-cols-[1fr_200px]">
              <div className="mx-auto flex items-center justify-center">
                {radar && (
                  <svg
                    viewBox="0 0 300 300"
                    className="h-[240px] w-[240px] text-slate-500"
                  >
                    {[0.25, 0.5, 0.75, 1].map((ratio) => (
                      <circle
                        key={ratio}
                        cx={150}
                        cy={150}
                        r={110 * ratio}
                        fill="none"
                        stroke="currentColor"
                        strokeOpacity={0.2}
                        strokeWidth={1}
                      />
                    ))}
                    {radar.axis.map((point, index) => (
                      <line
                        key={EMOTIONS[index].key}
                        x1={150}
                        y1={150}
                        x2={point.x - 10}
                        y2={point.y - 10}
                        stroke="currentColor"
                        strokeOpacity={0.24}
                        strokeWidth={1}
                      />
                    ))}
                    <polygon
                      points={radar.points
                        .split(" ")
                        .map((p) => {
                          const [x, y] = p.split(",");
                          return `${Number(x) - 10},${Number(y) - 10}`;
                        })
                        .join(" ")}
                      fill="url(#radar-fill)"
                      stroke="#34d399"
                      strokeWidth={2}
                    />
                    <defs>
                      <linearGradient
                        id="radar-fill"
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#34d399" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.18" />
                      </linearGradient>
                    </defs>
                    {radar.axis.map((point, index) => (
                      <g key={EMOTIONS[index].key}>
                        <circle
                          cx={point.x - 10}
                          cy={point.y - 10}
                          r={4}
                          fill="#0ea5e9"
                          stroke="#e2e8f0"
                          strokeWidth={2}
                        />
                        <text
                          x={point.x - 10}
                          y={point.y - 10}
                          dy={point.y < 140 ? -8 : 16}
                          textAnchor="middle"
                          className="text-[11px] fill-slate-700"
                        >
                          {EMOTIONS[index].emoji} {EMOTIONS[index].label}
                        </text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>
              <div className="space-y-2">
                {sentimentList.map((emotion) => (
                  <div
                    key={emotion.key}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-900">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: emotion.accent }}
                        />
                        {emotion.emoji} {emotion.label}
                      </div>
                      <span className="font-semibold text-slate-900">
                        {formatPercent(emotion.value)}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(6, emotion.value * 100)}%`,
                          background: `linear-gradient(90deg, ${emotion.accent}, #ffffff80)`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>⭐ 상위 댓글 요약</span>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <button
                  type="button"
                  className="rounded-full bg-slate-100 px-3 py-1 disabled:opacity-40"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  ◀︎ 이전
                </button>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] text-slate-700">
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  className="rounded-full bg-slate-100 px-3 py-1 disabled:opacity-40"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  다음 ▶︎
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {highlighted.map((comment) => {
                const dominant = getDominantEmotion(comment.emotions);
                return (
                  <div
                    key={comment.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">
                          @{comment.author}
                        </p>
                        <p className="text-xs text-slate-500">
                          좋아요 {comment.likes.toLocaleString()}
                        </p>
                      </div>
                      <span
                        className="rounded-full px-3 py-1 text-xs font-semibold text-slate-900"
                        style={{ backgroundColor: `${dominant.accent}cc` }}
                      >
                        {dominant.emoji} {dominant.label}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-700 line-clamp-3">
                      {comment.text}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-1 text-[11px] text-slate-600">
                      {EMOTIONS.map((emotion) => (
                        <div key={emotion.key} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: `${emotion.accent}aa` }}
                            />
                              {emotion.label}
                            </div>
                            <span className="font-semibold text-slate-800">
                              {comment.emotions[emotion.key].toFixed(2)}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(
                                  4,
                                  comment.emotions[emotion.key] * 100,
                                )}%`,
                                background: `linear-gradient(90deg, ${emotion.accent}, #ffffff80)`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
