"use client";

import { useState } from "react";
import { RATE_LIMIT_WINDOW_LIMITS } from "@/lib/rate-limit-limits";
import { saveRateLimitWindowAction } from "./actions";

// Slider da janela do rate-limit por device (só aparece quando o rate
// limit está LIGADO — ver admin/page.tsx). Estado local só pro rótulo
// acompanhar o arrasto; salvar grava no Redis via Server Action.

export function RateLimitEditor({ initialMinutes }: { initialMinutes: number }) {
  const [minutes, setMinutes] = useState(initialMinutes);

  return (
    <form
      action={saveRateLimitWindowAction}
      className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
    >
      <label className="flex flex-col gap-2 text-sm">
        <span className="flex items-center justify-between">
          <span className="font-semibold">Janela do rate limit por dispositivo</span>
          <span className="font-mono text-xs text-zinc-500">{minutes} min</span>
        </span>
        <input
          type="range"
          name="windowMinutes"
          min={RATE_LIMIT_WINDOW_LIMITS.minutes.min}
          max={RATE_LIMIT_WINDOW_LIMITS.minutes.max}
          step={RATE_LIMIT_WINDOW_LIMITS.minutes.step}
          value={minutes}
          onChange={(event) => setMinutes(Number(event.target.value))}
          className="w-full cursor-pointer accent-green-500"
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          Cada dispositivo só pode reportar de novo após esse intervalo.
          Vale para bloqueios novos — os já ativos mantêm a duração antiga.
        </p>
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold hover:bg-green-500"
        >
          Salvar
        </button>
      </div>
    </form>
  );
}
