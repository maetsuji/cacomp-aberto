import { getFlickerSettings } from "@/lib/flicker-settings";
import { AdminTabs } from "../AdminTabs";
import { FlickerEditor } from "./FlickerEditor";

// Tab do painel admin para customizar o flicker de neon do texto de
// status. Sempre dinâmica: mostra a config vigente no Redis, nunca de
// cache. (Basic Auth via middleware, mesmo esquema da /admin.)
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ msg?: string }>;
}

export default async function FlickerAdminPage({ searchParams }: Props) {
  const { msg } = await searchParams;
  const settings = await getFlickerSettings();

  return (
    <main className="min-h-dvh bg-zinc-950 px-6 py-10 text-zinc-50">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-1">
          <h1 className="font-mono text-2xl font-bold">CA-Aberto · Admin</h1>
          <p className="text-sm text-zinc-400">
            Flicker de neon do texto ABERTO/FECHADO. O preview abaixo é ao
            vivo; salvar publica para todos os visitantes na hora.
          </p>
        </header>

        <AdminTabs active="flicker" />

        {msg && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            {msg}
          </p>
        )}

        <FlickerEditor initial={settings} />
      </div>
    </main>
  );
}
