"use client";

import { useState } from "react";
import { FLICKER_LIMITS } from "@/lib/flicker-limits";
import type { FlickerSettings } from "@/lib/flicker-settings";
import { resetFlickerSettingsAction, saveFlickerSettingsAction } from "../actions";

// Editor com preview ao vivo: os sliders alteram o estado local e o
// preview reusa as MESMAS classes .neon-text/.neon-flicker da Home (só
// as CSS vars vêm do estado local em vez do Redis). Só o submit grava,
// via Server Action. O botão "Testar aceso" força um remount do <span>
// de preview (via key) pra reiniciar o burst de "ligar" sob demanda.

const PREVIEW_META = [
  { label: "ABERTO", glow: "#69ffa0", glowDim: "#00ff5e" },
  { label: "FECHADO", glow: "#dc6a6a", glowDim: "#ff0000" },
] as const;

export function FlickerEditor({ initial }: { initial: FlickerSettings }) {
  const [settings, setSettings] = useState<FlickerSettings>(initial);
  const [replayCount, setReplayCount] = useState(0);

  const setField = <K extends keyof FlickerSettings>(
    key: K,
    value: FlickerSettings[K]
  ): void => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <form className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {PREVIEW_META.map(({ label, glow, glowDim }) => (
          <div
            key={label}
            className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
          >
            <h2 className="text-sm font-bold">Estado {label}</h2>

            <div className="blob-preview flex h-32 items-center justify-center rounded-lg">
              <span
                key={`${label}-${replayCount}`}
                className={`neon-text status-font text-3xl${
                  settings.enabled ? " neon-flicker" : ""
                }`}
                style={
                  {
                    "--neon-color": glow,
                    "--neon-color-dim": glowDim,
                    "--flicker-on-duration": `${settings.onDuration}s`,
                    "--flicker-ambient-duration": `${settings.ambientInterval}s`,
                    "--flicker-intensity": settings.intensity,
                  } as React.CSSProperties
                }
              >
                {label}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold">Ativar flicker</span>
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
            <span>Duração do &quot;ligar&quot;</span>
            <span className="font-mono text-xs text-zinc-500">
              {settings.onDuration.toFixed(1)}s
            </span>
          </span>
          <input
            type="range"
            name="onDuration"
            min={FLICKER_LIMITS.onDuration.min}
            max={FLICKER_LIMITS.onDuration.max}
            step={FLICKER_LIMITS.onDuration.step}
            value={settings.onDuration}
            onChange={(event) =>
              setField("onDuration", Number(event.target.value))
            }
            className="w-full cursor-pointer accent-green-500"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="flex items-center justify-between text-zinc-400">
            <span>Intervalo do flicker ambiente</span>
            <span className="font-mono text-xs text-zinc-500">
              {settings.ambientInterval.toFixed(0)}s
            </span>
          </span>
          <input
            type="range"
            name="ambientInterval"
            min={FLICKER_LIMITS.ambientInterval.min}
            max={FLICKER_LIMITS.ambientInterval.max}
            step={FLICKER_LIMITS.ambientInterval.step}
            value={settings.ambientInterval}
            onChange={(event) =>
              setField("ambientInterval", Number(event.target.value))
            }
            className="w-full cursor-pointer accent-green-500"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="flex items-center justify-between text-zinc-400">
            <span>Intensidade das quedas de brilho</span>
            <span className="font-mono text-xs text-zinc-500">
              {Math.round(settings.intensity * 100)}%
            </span>
          </span>
          <input
            type="range"
            name="intensity"
            min={FLICKER_LIMITS.intensity.min}
            max={FLICKER_LIMITS.intensity.max}
            step={FLICKER_LIMITS.intensity.step}
            value={settings.intensity}
            onChange={(event) =>
              setField("intensity", Number(event.target.value))
            }
            className="w-full cursor-pointer accent-green-500"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setReplayCount((n) => n + 1)}
          className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-600"
        >
          Testar aceso
        </button>
        <button
          type="submit"
          formAction={saveFlickerSettingsAction}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold hover:bg-green-500"
        >
          Salvar para todo mundo
        </button>
        <button
          type="submit"
          formAction={resetFlickerSettingsAction}
          className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-600"
        >
          Restaurar padrão
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        Salvar grava os parâmetros no Redis e revalida a Home na hora — todo
        visitante passa a ver o novo flicker, sem redeploy. Sem config
        salva, valem os parâmetros padrão. O efeito respeita a preferência
        de "reduzir movimento" do sistema, sempre — mesmo com o flicker
        ativado aqui.
      </p>
    </form>
  );
}
