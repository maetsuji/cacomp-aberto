import { getBackgroundSettings } from "@/lib/background-settings";
import { getBlobTheme } from "@/lib/blob-theme";
import { getFlickerSettings } from "@/lib/flicker-settings";
import { AdminTabs } from "../AdminTabs";
import { BackgroundEditor } from "./BackgroundEditor";
import { BlobThemeEditor } from "./BlobThemeEditor";
import { FlickerEditor } from "./FlickerEditor";

// Tab do painel admin com toda a customização visual da Home: cores dos
// blobs, flicker de neon e fundo de tijolo. Sempre dinâmica: mostra a
// config vigente no Redis, nunca de cache. (Basic Auth via middleware,
// mesmo esquema da /admin.)
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ msg?: string }>;
}

export default async function AparenciaAdminPage({ searchParams }: Props) {
  const { msg } = await searchParams;
  const [blobTheme, flicker, background] = await Promise.all([
    getBlobTheme(),
    getFlickerSettings(),
    getBackgroundSettings(),
  ]);

  return (
    <main className="min-h-dvh bg-zinc-950 px-6 py-10 text-zinc-50">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-1">
          <h1 className="font-mono text-2xl font-bold">CA-Aberto · Admin</h1>
          <p className="text-sm text-zinc-400">
            Aparência da Home: cores do fundo, flicker de neon e textura de
            tijolo. Os previews abaixo são ao vivo; salvar publica para
            todos os visitantes na hora.
          </p>
        </header>

        <AdminTabs active="aparencia" />

        {msg && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            {msg}
          </p>
        )}

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Cores do fundo
          </h2>
          <BlobThemeEditor initial={blobTheme} />
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Flicker de neon
          </h2>
          <FlickerEditor initial={flicker} />
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Fundo de tijolo
          </h2>
          <BackgroundEditor initial={background} />
        </section>
      </div>
    </main>
  );
}
