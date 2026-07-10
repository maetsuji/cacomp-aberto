import { storeGetJson, storeSetJson } from "./store";
import type { ReportTokens } from "./tokens";

/* ───────────────────────── SHORT LINKS (lc.cx) ─────────────────────────
 *
 * Os QR Codes impressos apontam para short links do lc.cx, não para a
 * URL com o token. Rotacionar o token = atualizar o DESTINO do short
 * link via API ("Update a Short Link") — a arte impressa nunca muda.
 *
 * Confirmado na doc oficial (dev.lc.cx):
 *   POST  https://api.lc.cx/v1/shorten          (criar)
 *     body: { destination, domain (UUID, obrigatório), note, ... }
 *     "00000000-0000-0000-0000-000000000000" = domínio padrão lc.cx
 *   PATCH https://api.lc.cx/v1/links/update/:id (atualizar)
 *     body: { destination }
 *   headers (as duas): apikey: <string>  (chave crua, NÃO é "Bearer <key>")
 *   resposta (as duas): { id, shortlink, path, destination, ... }
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
  return (process.env.LCCX_API_BASE ?? "https://api.lc.cx/v1").replace(/\/$/, "");
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: process.env.LCCX_API_KEY ?? "",
    "Content-Type": "application/json",
  };
  if (process.env.LCCX_WORKSPACE) {
    headers.workspace = process.env.LCCX_WORKSPACE;
  }
  return headers;
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

  // Não descarta corpo não-JSON (ex: página de erro em HTML de um path
  // errado) — isso é exatamente o que precisamos ver pra diagnosticar
  // um 404/401 inesperado, em vez de esconder atrás de "null".
  const raw = await res.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw.slice(0, 300); // corpo cru (truncado) se não for JSON
    }
  }

  return { ok: res.ok, status: res.status, data };
}

// Formato confirmado da resposta (ver "Update a Short Link" na doc):
// { id, shortlink, path, destination, domain, tags, note, created, updated }
function parseLink(data: unknown): ShortLink | null {
  const d = (data ?? {}) as Record<string, unknown>;
  const id = d.id;
  const short = d.shortlink;
  if (id === undefined || typeof short !== "string") return null;
  return { id: String(id), short_url: short };
}

// UUID do domínio "lc.cx" padrão — usado quando não há domínio próprio
// configurado na conta (ver LCCX_DOMAIN_ID).
const LCCX_DEFAULT_DOMAIN = "00000000-0000-0000-0000-000000000000";

async function createShortLink(
  targetUrl: string,
  note: string
): Promise<ShortLink> {
  const res = await lccxRequest("POST", "/shorten", {
    destination: targetUrl,
    domain: process.env.LCCX_DOMAIN_ID ?? LCCX_DEFAULT_DOMAIN,
    note,
  });
  const link = parseLink(res.data);
  if (!res.ok || !link) {
    throw new Error(
      `lc.cx create falhou (HTTP ${res.status}): ${JSON.stringify(res.data)}`
    );
  }
  return link;
}

async function updateShortLink(id: string, targetUrl: string): Promise<void> {
  const res = await lccxRequest("PATCH", `/links/update/${id}`, {
    destination: targetUrl,
  });
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
    { action: "open" as const, note: "CA-Aberto: QR interno (abrir)" },
    { action: "close" as const, note: "CA-Aberto: QR externo (fechar)" },
  ];

  for (const { action, note } of targets) {
    const target = reportUrl(action, tokens[action]);
    try {
      const existing = links[action];
      if (existing) {
        await updateShortLink(existing.id, target);
      } else {
        links[action] = await createShortLink(target, note);
      }
    } catch (err) {
      errors.push(`${action}: ${err instanceof Error ? err.message : err}`);
    }
  }

  await storeSetJson(LINKS_KEY, links);
  return { links, errors };
}
