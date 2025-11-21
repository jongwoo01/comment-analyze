"use client";

import React from "react";

type LinkFormProps = {
  videoUrl: string;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  loading?: boolean;
  error?: string | null;
};

export function LinkForm({
  videoUrl,
  onChange,
  onSubmit,
  loading = false,
  error,
}: LinkFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="relative flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 shadow-md"
    >
      <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
        🎥 Youtube Link
      </label>
      <input
        value={videoUrl}
        onChange={(e) => onChange(e.target.value)}
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
}
