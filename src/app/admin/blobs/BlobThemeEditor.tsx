"use client";

import { useState } from "react";
import type { BlobTheme } from "@/lib/blob-theme";
import { resetBlobThemeAction, saveBlobThemeAction } from "../actions";

// Editor com preview ao vivo: os pickers alteram o estado local e o
// preview reusa as MESMAS classes .blob/.blob-N da Home (gradiente,
// blend, animação) dentro de um card miniatura (.blob-preview em
// globals.css). Só o submit grava no Redis, via Server Action.

type BlobKey = keyof BlobTheme[keyof BlobTheme];

// glow/glowDim espelham o THEME de page.tsx — usados só para o letreiro
// de neon do preview ficar fiel à Home (o glow em si não é customizável).
const STATE_META = [
  {
    status: "OPEN",
    label: "ABERTO",
    glow: "#69ffa0",
    glowDim: "#00ff5e",
    // name= dos inputs, lidos por saveBlobThemeAction
    fields: { blobA: "openA", blobB: "openB" },
  },
  {
    status: "CLOSED",
    label: "FECHADO",
    glow: "#dc6a6a",
    glowDim: "#ff0000",
    fields: { blobA: "closedA", blobB: "closedB" },
  },
] as const;

const FIELD_LABEL: Record<BlobKey, string> = {
  blobA: "Cor principal (blobs 1 e 3)",
  blobB: "Cor secundária (blob 2)",
};

export function BlobThemeEditor({ initial }: { initial: BlobTheme }) {
  const [theme, setTheme] = useState<BlobTheme>(initial);

  const setColor = (
    status: keyof BlobTheme,
    key: BlobKey,
    value: string
  ): void => {
    setTheme((prev) => ({
      ...prev,
      [status]: { ...prev[status], [key]: value },
    }));
  };

  return (
    <form className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {STATE_META.map(({ status, label, glow, glowDim, fields }) => (
          <div
            key={status}
            className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
          >
            <h2 className="text-sm font-bold">Estado {label}</h2>

            <div
              className="blob-preview h-40 rounded-lg"
              style={
                {
                  "--blob-a": theme[status].blobA,
                  "--blob-b": theme[status].blobB,
                } as React.CSSProperties
              }
              aria-hidden
            >
              <div className="blob blob-1" />
              <div className="blob blob-2" />
              <div className="blob blob-3" />
              <span
                className="neon-text status-font absolute inset-0 flex items-center justify-center text-3xl"
                style={
                  {
                    "--neon-color": glow,
                    "--neon-color-dim": glowDim,
                  } as React.CSSProperties
                }
              >
                {label}
              </span>
            </div>

            {(Object.keys(fields) as BlobKey[]).map((key) => (
              <label
                key={key}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-zinc-400">{FIELD_LABEL[key]}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-xs text-zinc-500">
                    {theme[status][key]}
                  </span>
                  <input
                    type="color"
                    name={fields[key]}
                    value={theme[status][key]}
                    onChange={(event) =>
                      setColor(status, key, event.target.value)
                    }
                    className="h-8 w-12 cursor-pointer rounded border border-zinc-700 bg-transparent"
                  />
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          formAction={saveBlobThemeAction}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold hover:bg-green-500"
        >
          Salvar para todo mundo
        </button>
        <button
          type="submit"
          formAction={resetBlobThemeAction}
          className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-600"
        >
          Restaurar cores padrão
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        Salvar grava o tema no Redis e revalida a Home na hora — todo
        visitante passa a ver as novas cores, sem redeploy. Sem tema salvo,
        valem as cores padrão do design.
      </p>
    </form>
  );
}
