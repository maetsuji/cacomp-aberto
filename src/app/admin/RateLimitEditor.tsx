"use client";

import { useState } from "react";
import { RATE_LIMIT_WINDOW_LIMITS } from "@/lib/rate-limit-limits";
import { saveRateLimitWindowAction } from "./actions";

// Slider da janela do rate-limit por device. Com o rate limit DESLIGADO
// o slider continua visível, mas inativo (cinza) — ver admin/page.tsx.
// Estado local só pro rótulo acompanhar o arrasto; salvar grava no
// Redis via Server Action.

export function RateLimitEditor({
  initialMinutes,
  disabled,
}: {
  initialMinutes: number;
  disabled: boolean;
}) {
  const [minutes, setMinutes] = useState(initialMinutes);

  return (
    <form
      action={saveRateLimitWindowAction}
      className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
    >
      <label className="flex flex-col gap-2 text-sm">
        <span
          className={`flex items-center justify-between ${
            disabled ? "text-zinc-600" : ""
          }`}
        >
          <span className="font-semibold">Janela do rate limit por dispositivo</span>
          <span className="font-mono text-xs">{minutes} min</span>
        </span>
        <input
          type="range"
          name="windowMinutes"
          min={RATE_LIMIT_WINDOW_LIMITS.minutes.min}
          max={RATE_LIMIT_WINDOW_LIMITS.minutes.max}
          step={RATE_LIMIT_WINDOW_LIMITS.minutes.step}
          value={minutes}
          disabled={disabled}
          onChange={(event) => setMinutes(Number(event.target.value))}
          className={`w-full ${
            disabled
              ? "cursor-not-allowed accent-zinc-600 opacity-50"
              : "cursor-pointer accent-green-500"
          }`}
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          {disabled
            ? "Rate limit desligado — ligue-o para ajustar a janela."
            : "Cada dispositivo só pode reportar de novo após esse intervalo. Vale para bloqueios novos — os já ativos mantêm a duração antiga."}
        </p>
        <button
          type="submit"
          disabled={disabled}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${
            disabled
              ? "cursor-not-allowed bg-zinc-700 opacity-50"
              : "bg-green-600 hover:bg-green-500"
          }`}
        >
          Salvar
        </button>
      </div>
    </form>
  );
}
