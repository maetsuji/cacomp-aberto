import { storeGetJson, storeSetJson } from "./store";
import type { ReportTokens } from "./tokens";

/* ──────────────────────── SHORT LINKS (short.io) ────────────────────────
 *
 * Os QR Codes impressos apontam para EXATAMENTE dois short links fixos:
 *
 *   https://report.cacomp.xyz/open   → QR interno (reporta ABERTO)
 *   https://report.cacomp.xyz/close  → QR externo (reporta FECHADO)
 *
 * Um único domínio (SHORTIO_DOMAIN) + paths fixos ("open"/"close") =
 * URLs determinísticas: dá até pra imprimir o QR antes do primeiro sync.
 * Rotacionar o token = atualizar o DESTINO do link via API — a arte
 * impressa nunca muda, e nunca se criam links além desses dois.
 *
 * Provider: short.io (migrado do lc.cx por rate limit). Doc pública em
 * https://developers.short.io (OpenAPI em /llms.txt). Confirmado:
 *   POST https://api.short.io/links             (criar; 50 req/s)
 *     body: { originalURL, domain, path, title }
 *     409 se o path já existe com originalURL diferente
 *   POST https://api.short.io/links/{linkId}    (atualizar; 20 req/s)
 *     body: { originalURL }
 *   GET  https://api.short.io/links/expand?domain=&path=  (buscar; 20 req/s)
 *   header (todas): Authorization: <secret key>  (crua, sem "Bearer")
 *   resposta: { idString, shortURL, originalURL, ... }
 * ──────────────────────────────────────────────────────────────────── */

// Chave nova (sufixo do provider): entradas antigas do lc.cx no Redis
// ficam órfãs de propósito — ids de um provider não valem no outro.
const LINKS_KEY = "ca:shortlinks:shortio";

// Back-half fixo de cada QR — a identidade permanente dos links.
const PATH_BY_ACTION = { open: "open", close: "close" } as const;

export interface ShortLink {
  id: string; // idString do short.io
  short_url: string;
}

export interface StoredShortLinks {
  open?: ShortLink;
  close?: ShortLink;
}

function shortDomain(): string | undefined {
  return process.env.SHORTIO_DOMAIN;
}

export function shortlinkConfigured(): boolean {
  return Boolean(process.env.SHORTIO_API_KEY && shortDomain());
}

export function siteUrl(): string {
  return process.env.SITE_URL ?? "https://cacomp.xyz";
}

export function reportUrl(action: "open" | "close", token: string): string {
  return `${siteUrl()}/report?action=${action}&token=${token}`;
}

function apiBase(): string {
  return (process.env.SHORTIO_API_BASE ?? "https://api.short.io").replace(
    /\/$/,
    ""
  );
}

async function shortioRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      Authorization: process.env.SHORTIO_API_KEY ?? "",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });

  // Mantém corpo não-JSON (ex: página de erro em HTML) na mensagem —
  // essencial para diagnosticar 401/404 sem esconder atrás de "null".
  const raw = await res.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw.slice(0, 300);
    }
  }

  return { ok: res.ok, status: res.status, data };
}

// Resposta do short.io: { idString, shortURL, ... } (idString é o id
// estável usado nos endpoints de update/delete).
function parseLink(data: unknown): ShortLink | null {
  const d = (data ?? {}) as Record<string, unknown>;
  const id = d.idString ?? d.id;
  const short = d.shortURL;
  if (id === undefined || typeof short !== "string") return null;
  return { id: String(id), short_url: short };
}

/** Busca o link fixo pelo path (recupera o id se o Redis não o tiver). */
async function findShortLinkByPath(path: string): Promise<ShortLink | null> {
  const res = await shortioRequest(
    "GET",
    `/links/expand?domain=${encodeURIComponent(shortDomain() ?? "")}&path=${encodeURIComponent(path)}`
  );
  if (res.status === 404) return null;
  const link = parseLink(res.data);
  if (!res.ok || !link) {
    throw new Error(
      `short.io expand falhou (HTTP ${res.status}): ${JSON.stringify(res.data)}`
    );
  }
  return link;
}

async function createShortLink(
  action: "open" | "close",
  targetUrl: string,
  title: string
): Promise<ShortLink> {
  const res = await shortioRequest("POST", "/links", {
    originalURL: targetUrl,
    domain: shortDomain(),
    path: PATH_BY_ACTION[action],
    title,
  });

  // 409 = o path fixo já existe apontando para outro destino (ex: Redis
  // perdeu o id). Recupera o id pelo path e atualiza — NUNCA cria um
  // segundo link: a integridade é ter exatamente /open e /close.
  if (res.status === 409) {
    const existing = await findShortLinkByPath(PATH_BY_ACTION[action]);
    if (existing) {
      await updateShortLink(existing.id, targetUrl);
      return existing;
    }
  }

  const link = parseLink(res.data);
  if (!res.ok || !link) {
    throw new Error(
      `short.io create falhou (HTTP ${res.status}): ${JSON.stringify(res.data)}`
    );
  }
  return link;
}

async function updateShortLink(id: string, targetUrl: string): Promise<void> {
  const res = await shortioRequest("POST", `/links/${id}`, {
    originalURL: targetUrl,
  });
  if (!res.ok) {
    throw new Error(
      `short.io update falhou (HTTP ${res.status}): ${JSON.stringify(res.data)}`
    );
  }
}

export async function getStoredShortLinks(): Promise<StoredShortLinks> {
  return (await storeGetJson<StoredShortLinks>(LINKS_KEY)) ?? {};
}

/**
 * Garante que os dois short links fixos existem e apontam para as URLs
 * de reporte com os tokens informados. Erros são coletados (não
 * lançados): quem chama decide se persiste os tokens ou não (rotate.ts).
 */
export async function syncShortLinks(
  tokens: ReportTokens
): Promise<{ links: StoredShortLinks; errors: string[] }> {
  const links = await getStoredShortLinks();
  const errors: string[] = [];

  if (!shortlinkConfigured()) {
    return {
      links,
      errors: ["short.io não configurado (SHORTIO_API_KEY + SHORTIO_DOMAIN)"],
    };
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
        links[action] = await createShortLink(action, target, title);
      }
    } catch (err) {
      errors.push(`${action}: ${err instanceof Error ? err.message : err}`);
    }
  }

  await storeSetJson(LINKS_KEY, links);
  return { links, errors };
}
