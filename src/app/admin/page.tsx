import QRCode from "qrcode";
import { isGeofenceEnabled } from "@/lib/geofence";
import {
  getDeviceRateLimitMinutes,
  isRateLimitDisabled,
} from "@/lib/rate-limit";
import {
  getStoredShortLinks,
  reportUrl,
  shortlinkConfigured,
} from "@/lib/shortlink";
import { getCaState } from "@/lib/status";
import { getReportTokens } from "@/lib/tokens";
import {
  rotateNowAction,
  syncLinksAction,
  toggleGeofenceAction,
  toggleRateLimitAction,
} from "./actions";
import { AdminTabs } from "./AdminTabs";
import { RateLimitEditor } from "./RateLimitEditor";

// Página administrativa (protegida por Basic Auth no middleware).
// Sempre dinâmica: mostra tokens e links vigentes, nunca de cache.
export const dynamic = "force-dynamic";

interface QrCard {
  action: "open" | "close";
  label: string;
  place: string;
  content: string; // o que o QR codifica (short link, idealmente)
  isShort: boolean;
  svg: string;
  pngDataUrl: string;
}

async function buildQrCard(
  action: "open" | "close",
  shortUrl: string | undefined,
  token: string
): Promise<QrCard> {
  const content = shortUrl ?? reportUrl(action, token);
  const [svg, pngDataUrl] = await Promise.all([
    QRCode.toString(content, { type: "svg", margin: 2 }),
    QRCode.toDataURL(content, { width: 640, margin: 2 }),
  ]);
  return {
    action,
    label: action === "open" ? "QR INTERNO — reporta ABERTO" : "QR EXTERNO — reporta FECHADO",
    place: action === "open" ? "mesa/parede dentro do CA" : "porta do CA",
    content,
    isShort: Boolean(shortUrl),
    svg,
    pngDataUrl,
  };
}

interface Props {
  searchParams: Promise<{ msg?: string }>;
}

export default async function AdminPage({ searchParams }: Props) {
  const { msg } = await searchParams;
  const [
    tokens,
    links,
    state,
    geofenceEnabled,
    rateLimitDisabled,
    rateLimitMinutes,
  ] = await Promise.all([
    getReportTokens(),
    getStoredShortLinks(),
    getCaState(),
    isGeofenceEnabled(),
    isRateLimitDisabled(),
    getDeviceRateLimitMinutes(),
  ]);

  const cards = await Promise.all([
    buildQrCard("open", links.open?.short_url, tokens.open),
    buildQrCard("close", links.close?.short_url, tokens.close),
  ]);

  return (
    <main className="min-h-dvh bg-zinc-950 px-6 py-10 text-zinc-50">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-1">
          <h1 className="font-mono text-2xl font-bold">CA-Aberto · Admin</h1>
          <p className="text-sm text-zinc-400">
            Status atual: <strong>{state.current_status}</strong> · Tokens
            rotacionados em:{" "}
            {new Date(tokens.rotated_at).getTime() === 0
              ? "nunca (usando env vars)"
              : new Date(tokens.rotated_at).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
          </p>
        </header>

        <AdminTabs active="geral" />

        {msg && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            {msg}
          </p>
        )}

        {!shortlinkConfigured() && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">
            <strong>short.io não configurado</strong> (SHORTIO_API_KEY e
            SHORTIO_DOMAIN). Os QRs abaixo codificam a URL direta (com token
            exposto) e quebrarão a cada rotação. Configure as duas variáveis
            para os QRs passarem a usar short links estáveis.
          </p>
        )}

        {/* ── Ações ── */}
        <section className="flex flex-wrap gap-3">
          <form action={rotateNowAction}>
            <button
              type="submit"
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold hover:bg-green-500"
            >
              Rotacionar tokens agora
            </button>
          </form>
          <form action={syncLinksAction}>
            <button
              type="submit"
              className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-600"
            >
              Sincronizar short links (sem rotacionar)
            </button>
          </form>
          <form action={toggleGeofenceAction}>
            <button
              type="submit"
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                geofenceEnabled
                  ? "bg-red-700 hover:bg-red-600"
                  : "bg-zinc-700 hover:bg-zinc-600"
              }`}
            >
              {geofenceEnabled
                ? "Desligar verificação de localização"
                : "Ligar verificação de localização"}
            </button>
          </form>
          <form action={toggleRateLimitAction}>
            <button
              type="submit"
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                rateLimitDisabled
                  ? "bg-red-700 hover:bg-red-600"
                  : "bg-zinc-700 hover:bg-zinc-600"
              }`}
            >
              {rateLimitDisabled
                ? "Ligar rate limit"
                : "Desligar rate limit (testes)"}
            </button>
          </form>
        </section>

        <p className="text-sm text-zinc-400">
          Verificação de localização:{" "}
          <strong className={geofenceEnabled ? "text-red-400" : "text-zinc-500"}>
            {geofenceEnabled ? "LIGADA" : "DESLIGADA"}
          </strong>
          {geofenceEnabled
            ? " — reportes exigem GPS perto do CA (não funciona testando de outro lugar)."
            : " — reportes não exigem GPS (bom para testar fora do CA)."}
        </p>

        <p className="text-sm text-zinc-400">
          Rate limit:{" "}
          <strong className={rateLimitDisabled ? "text-red-400" : "text-zinc-500"}>
            {rateLimitDisabled ? "DESLIGADO" : "LIGADO"}
          </strong>
          {rateLimitDisabled
            ? " — reportes seguidos do mesmo device/IP não são bloqueados (só para testes, não deixar ligado em produção)."
            : ` — reportes respeitam o bloqueio de ${rateLimitMinutes} min por device e o teto de 20/hora por IP.`}
        </p>

        {/* Slider da janela só faz sentido com o rate limit LIGADO —
            desligado, some junto. */}
        {!rateLimitDisabled && (
          <RateLimitEditor initialMinutes={rateLimitMinutes} />
        )}

        {/* ── QR Codes ── */}
        <section className="grid gap-6 sm:grid-cols-2">
          {cards.map((card) => (
            <div
              key={card.action}
              className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <h2 className="text-sm font-bold">{card.label}</h2>
              <p className="text-xs text-zinc-400">Fixar em: {card.place}</p>

              <div
                className="mx-auto w-48 rounded-lg bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
                // SVG gerado localmente pela lib `qrcode` a partir de
                // dados nossos — não é input de usuário.
                dangerouslySetInnerHTML={{ __html: card.svg }}
              />

              <p className="break-all font-mono text-xs text-zinc-400">
                {card.content}
              </p>
              {!card.isShort && (
                <p className="text-xs text-amber-400">
                  ⚠ URL direta (sem short link) — token exposto no QR.
                </p>
              )}

              <div className="flex gap-3 text-sm">
                <a
                  href={card.pngDataUrl}
                  download={`qr-${card.action}.png`}
                  className="underline underline-offset-2"
                >
                  Baixar PNG
                </a>
                <a
                  href={`data:image/svg+xml;utf8,${encodeURIComponent(card.svg)}`}
                  download={`qr-${card.action}.svg`}
                  className="underline underline-offset-2"
                >
                  Baixar SVG
                </a>
              </div>
            </div>
          ))}
        </section>

        {/* ── Tokens vigentes (só visível aqui, atrás do Basic Auth) ── */}
        <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-bold">Tokens vigentes</h2>
          <p className="break-all font-mono text-xs text-zinc-400">
            open: {tokens.open || "(vazio)"}
          </p>
          <p className="break-all font-mono text-xs text-zinc-400">
            close: {tokens.close || "(vazio)"}
          </p>
          <p className="text-xs text-zinc-500">
            A rotação automática roda todo dia às 06h (cron) quando os short
            links estão configurados. O token anterior segue válido por 15
            minutos após cada rotação.
          </p>
        </section>
      </div>
    </main>
  );
}
