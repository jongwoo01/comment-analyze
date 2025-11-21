"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LinkForm } from "./components/LinkForm";

export default function Home() {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = videoUrl.trim();
    if (!trimmed) {
      setError("유튜브 URL을 입력해주세요.");
      return;
    }
    setError(null);
    router.push(`/dashboard?url=${encodeURIComponent(trimmed)}`);
  }

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
              Start
            </span>
          </div>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            유튜브 링크만 넣으면, 대시보드에서 감정을 바로 시각화합니다.
          </h1>
          <p className="text-sm text-slate-600 sm:text-base">
            메인에서 URL을 입력하면 `/dashboard?url=...`로 이동해요. 새로고침하거나
            공유해도 같은 주소로 결과가 유지됩니다.
          </p>
        </div>
        <div className="mt-6 max-w-2xl">
          <LinkForm
            videoUrl={videoUrl}
            onChange={setVideoUrl}
            onSubmit={handleSubmit}
            loading={false}
            error={error}
          />
        </div>
      </main>
    </div>
  );
}
