import { processReport } from "@/lib/report";
import { RedirectHome } from "@/components/RedirectHome";

// Esta rota é sempre dinâmica: cada scan precisa ser processado no
// servidor (validação de token + rate limit), nunca servido de cache.
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ action?: string; token?: string }>;
}

export default async function ReportPage({ searchParams }: Props) {
  const { action, token } = await searchParams;
  const result = await processReport(action, token);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-50">
      {result.ok ? (
        <>
          <p className="text-5xl">{result.status === "OPEN" ? "🟢" : "🔴"}</p>
          <h1 className="text-2xl font-bold">Obrigado!</h1>
          <p className="text-zinc-300">
            O status do CA foi atualizado para{" "}
            <strong>{result.status === "OPEN" ? "ABERTO" : "FECHADO"}</strong>.
          </p>
        </>
      ) : result.reason === "rate_limited" ? (
        <>
          <p className="text-5xl">⏳</p>
          <h1 className="text-2xl font-bold">Calma lá!</h1>
          <p className="text-zinc-300">
            Você já reportou há pouco. Tente novamente em alguns minutos.
          </p>
        </>
      ) : (
        <>
          <p className="text-5xl">🤔</p>
          <h1 className="text-2xl font-bold">Link inválido</h1>
          <p className="text-zinc-300">
            Este reporte só funciona escaneando os QR Codes oficiais no CA.
          </p>
        </>
      )}
      <RedirectHome seconds={3} />
    </main>
  );
}
