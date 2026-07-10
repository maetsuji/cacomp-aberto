import { RedirectHome } from "@/components/RedirectHome";

// Tela de resultado pós-scan (Seção 4 do SDD). Puramente visual:
// o processamento acontece no Route Handler /report, que redireciona
// para cá. Os params são só de exibição — adulterá-los na URL não
// altera estado nenhum no servidor.
interface Props {
  searchParams: Promise<{ outcome?: string; status?: string }>;
}

export default async function ReportResultPage({ searchParams }: Props) {
  const { outcome, status } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-50">
      {outcome === "ok" ? (
        <>
          <p className="text-5xl">{status === "OPEN" ? "🟢" : "🔴"}</p>
          <h1 className="text-2xl font-bold">Obrigado!</h1>
          <p className="text-zinc-300">
            O status do CA foi atualizado para{" "}
            <strong>{status === "OPEN" ? "ABERTO" : "FECHADO"}</strong>.
          </p>
        </>
      ) : outcome === "device_rate_limited" ? (
        <>
          <p className="text-5xl">⏳</p>
          <h1 className="text-2xl font-bold">Calma lá!</h1>
          <p className="text-zinc-300">
            Você já reportou há pouco. Tente novamente em alguns minutos.
          </p>
        </>
      ) : outcome === "ip_flooding" ? (
        <>
          <p className="text-5xl">🌐</p>
          <h1 className="text-2xl font-bold">Muitos reportes agora</h1>
          <p className="text-zinc-300">
            Muitos reportes vindos da sua rede agora. Tente novamente em
            instantes.
          </p>
        </>
      ) : outcome === "daily_cap" ? (
        <>
          <p className="text-5xl">🚦</p>
          <h1 className="text-2xl font-bold">Sistema sobrecarregado</h1>
          <p className="text-zinc-300">
            O sistema está temporariamente sobrecarregado. Tente novamente em
            alguns minutos.
          </p>
        </>
      ) : outcome === "outside_geofence" ? (
        <>
          <p className="text-5xl">📍</p>
          <h1 className="text-2xl font-bold">Fora do local</h1>
          <p className="text-zinc-300">
            Não conseguimos confirmar que você está no local. Tente novamente
            mais perto do CA.
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
