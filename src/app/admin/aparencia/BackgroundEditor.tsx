"use client";

import { useState } from "react";
import { BACKGROUND_LIMITS } from "@/lib/background-limits";
import type { BackgroundSettings } from "@/lib/background-settings";
import {
  resetBackgroundSettingsAction,
  saveBackgroundSettingsAction,
} from "../actions";

// Editor com preview ao vivo: o slider altera o estado local e o
// preview reusa a MESMA textura da Home (public/brick-texture.webp) com
// um véu escuro por cima na opacidade escolhida. Só o submit grava no
// Redis, via Server Action.

export function BackgroundEditor({ initial }: { initial: BackgroundSettings }) {
  const [settings, setSettings] = useState<BackgroundSettings>(initial);

  const setField = <K extends keyof BackgroundSettings>(
    key: K,
    value: BackgroundSettings[K]
  ): void => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <form className="space-y-6">
      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-sm font-bold">Fundo de tijolo</h2>

        <div
          className="relative h-40 overflow-hidden rounded-lg bg-cover bg-center"
          style={{ backgroundImage: "url(/brick-texture.webp)" }}
          aria-hidden
        >
          {settings.enabled && (
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: `rgba(9, 9, 11, ${settings.overlayOpacity})`,
              }}
            />
          )}
        </div>

        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold">Ativar textura de tijolo</span>
          <input
            type="checkbox"
            name="enabled"
            checked={settings.enabled}
            onChange={(event) => setField("enabled", event.target.checked)}
            className="h-5 w-5 cursor-pointer accent-green-500"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="flex items-center justify-between text-zinc-400">
            <span>Opacidade do véu escuro</span>
            <span className="font-mono text-xs text-zinc-500">
              {Math.round(settings.overlayOpacity * 100)}%
            </span>
          </span>
          <input
            type="range"
            name="overlayOpacity"
            min={BACKGROUND_LIMITS.overlayOpacity.min}
            max={BACKGROUND_LIMITS.overlayOpacity.max}
            step={BACKGROUND_LIMITS.overlayOpacity.step}
            value={settings.overlayOpacity}
            onChange={(event) =>
              setField("overlayOpacity", Number(event.target.value))
            }
            className="w-full cursor-pointer accent-green-500"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          formAction={saveBackgroundSettingsAction}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold hover:bg-green-500"
        >
          Salvar para todo mundo
        </button>
        <button
          type="submit"
          formAction={resetBackgroundSettingsAction}
          className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-600"
        >
          Restaurar padrão
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        Salvar grava a config no Redis e revalida a Home na hora — todo
        visitante passa a ver o novo fundo, sem redeploy. Quanto maior a
        opacidade do véu, mais escuro e menos visível fica o tijolo.
      </p>
    </form>
  );
}
