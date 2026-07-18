import { loginAction } from "./actions";

// Tela de login do /admin (substitui o modal nativo de Basic Auth por
// incompatibilidades em certos browsers). Mesmas credenciais de sempre
// (ADMIN_USER/ADMIN_PASSWORD) — só muda a UI. Sem sessão de middleware
// nesta página (ver src/middleware.ts, que deixa /admin/login passar).
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ msg?: string; from?: string }>;
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const { msg, from } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-950 px-6 text-zinc-50">
      <form
        action={loginAction}
        className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <div className="space-y-1">
          <h1 className="font-mono text-xl font-bold">CA-Aberto · Admin</h1>
          <p className="text-sm text-zinc-400">Entre com usuário e senha.</p>
        </div>

        {msg && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">
            {msg}
          </p>
        )}

        <input type="hidden" name="from" value={from ?? "/admin"} />

        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Usuário</span>
          <input
            type="text"
            name="user"
            autoComplete="username"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-zinc-400">Senha</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold hover:bg-green-500"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
