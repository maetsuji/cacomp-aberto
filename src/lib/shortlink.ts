import { storeGetJson, storeSetJson } from "./store";
import type { ReportTokens } from "./tokens";

/* ───────────────────────── SHORT LINKS (lc.cx) ─────────────────────────
 *
 * Os QR Codes impressos apontam para short links do lc.cx, não para a
 * URL com o token. Rotacionar o token = atualizar o DESTINO do short
 * link via API ("Update a Short Link") — a arte impressa nunca muda.
 *
 * ⚠️ A doc oficial (dev.lc.cx) é um SPA do Postman que não expõe o spec
 * de forma raspável; os paths/headers abaixo seguem o padrão REST da
 * API v1 e são AJUSTÁVEIS por env var sem tocar em código:
 *   LCCX_API_BASE     (default https://lc.cx/api/v1)
 *   LCCX_AUTH_HEADER  (default Authorization; valor vira "Bearer <key>".
 *                      Qualquer outro nome de header recebe a key crua.)
 * Se a primeira chamada falhar com 401/404, confira na doc o path exato
 * e o nome do header e corrija via env — todo o acoplamento está aqui.
 * ──────────────────────────────────────────────────────────────────── */

const LINKS_KEY = "ca:shortlinks";

export interface ShortLink {
  id: string;
  short_url: string;
}

export interface StoredShortLinks {
  open?: ShortLink;
  close?: ShortLink;
}

export function lccxConfigured(): boolean {
  return Boolean(process.env.LCCX_API_KEY);
}

export function siteUrl(): string {
  return process.env.SITE_URL ?? "https://cacomp.xyz";
}

export function reportUrl(action: "open" | "close", token: string): string {
  return `${siteUrl()}/report?action=${action}&token=${token}`;
}

function apiBase(): string {
  return (process.env.LCCX_API_BASE ?? "https://lc.cx/api/v1").replace(/\/$/, "");
}

function authHeaders(): Record<string, string> {
  const key = process.env.LCCX_API_KEY ?? "";
  const headerName = process.env.LCCX_AUTH_HEADER ?? "Authorization";
  return {
    [headerName]: headerName === "Authorization" ? `Bearer ${key}` : key,
    "Content-Type": "application/json",
  };
}

async function lccxRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: authHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

// Respostas de shorteners variam em envelope/nomes; tenta os campos comuns.
function parseLink(data: unknown): ShortLink | null {
  const d = (data ?? {}) as Record<string, unknown>;
  const inner = (d.data ?? d.link ?? d) as Record<string, unknown>;
  const id = inner.id ?? inner.link_id ?? inner.slug;
  const short =
    inner.short_url ?? inner.shortUrl ?? inner.short_link ?? inner.short;
  if (id === undefined || typeof short !== "string") return null;
  return { id: String(id), short_url: short };
}

async function createShortLink(
  targetUrl: string,
  title: string
): Promise<ShortLink> {
  const res = await lccxRequest("POST", "/links", { url: targetUrl, title });
  const link = parseLink(res.data);
  if (!res.ok || !link) {
    throw new Error(
      `lc.cx create falhou (HTTP ${res.status}): ${JSON.stringify(res.data)}`
    );
  }
  return link;
}

async function updateShortLink(id: string, targetUrl: string): Promise<void> {
  const res = await lccxRequest("PUT", `/links/${id}`, { url: targetUrl });
  if (!res.ok) {
    throw new Error(
      `lc.cx update falhou (HTTP ${res.status}): ${JSON.stringify(res.data)}`
    );
  }
}

export async function getStoredShortLinks(): Promise<StoredShortLinks> {
  return (await storeGetJson<StoredShortLinks>(LINKS_KEY)) ?? {};
}

/**
 * Garante que os dois short links existem e apontam para as URLs de
 * reporte com os tokens informados. Erros são coletados (não lançados):
 * quem chama decide se persiste os tokens ou não (ver rotate.ts).
 */
export async function syncShortLinks(
  tokens: ReportTokens
): Promise<{ links: StoredShortLinks; errors: string[] }> {
  const links = await getStoredShortLinks();
  const errors: string[] = [];

  if (!lccxConfigured()) {
    return { links, errors: ["LCCX_API_KEY não configurada"] };
  }

  const targets = [
    { action: "open" as const, title: "CA-Aberto: QR interno (abrir)" },
    { action: "close" as const, title: "CA-Aberto: QR externo (fechar)" },
  ];

  for (const { action, title } of targets) {
    const target = reportUrl(action, tokens[action]);
    try {
      const existing = links[action];
      if (existing) {
        await updateShortLink(existing.id, target);
      } else {
        links[action] = await createShortLink(target, title);
      }
    } catch (err) {
      errors.push(`${action}: ${err instanceof Error ? err.message : err}`);
    }
  }

  await storeSetJson(LINKS_KEY, links);
  return { links, errors };
}
