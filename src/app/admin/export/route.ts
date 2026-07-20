import { getIntervalsRange } from "@/lib/intervals";

// Export CSV do histórico de abertura (períodos de ca:intervals:*).
// Protegido pela sessão do /admin: o matcher do middleware cobre
// /admin/:path*, então este handler já nasce atrás do login.
export const dynamic = "force-dynamic";

const MAX_WEEKS = 12; // registros têm TTL de 90 dias (ver lib/intervals.ts)

export async function GET(request: Request) {
  const raw = Number(new URL(request.url).searchParams.get("weeks") ?? 4);
  const weeks = Number.isFinite(raw)
    ? Math.min(MAX_WEEKS, Math.max(1, Math.trunc(raw)))
    : 4;

  const days = await getIntervalsRange(new Date(), weeks * 7);

  const rows = ["date,opened_at,closed_at,duration_min"];
  for (const day of days) {
    for (const interval of day.intervals) {
      const minutes = Math.round(
        (new Date(interval.c).getTime() - new Date(interval.o).getTime()) /
          60_000
      );
      rows.push([day.date, interval.o, interval.c, minutes].join(","));
    }
  }

  return new Response(rows.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cacomp-historico-${weeks}sem.csv"`,
    },
  });
}
