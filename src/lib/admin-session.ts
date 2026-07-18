/* ── Sessão de login do /admin (substitui HTTP Basic Auth) ──
 *
 * O middleware roda no runtime Edge por padrão (nenhum `export const
 * runtime` declarado em middleware.ts/next.config.ts), que não tem o
 * módulo `crypto` do Node (usado em rate-limit.ts) — só a Web Crypto API
 * (`globalThis.crypto.subtle`). Este módulo usa só Web Crypto, então
 * funciona igual em Edge (middleware.ts) e Node (Server Actions do
 * /admin/login), sem exigir nenhuma lib nova.
 *
 * Token = "<exp-unix-seconds>.<assinatura HMAC-SHA256 base64url>",
 * assinado com uma chave derivada do próprio ADMIN_PASSWORD — nenhum
 * segredo novo pra configurar na Vercel. */

export const SESSION_COOKIE = "ca_admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 horas

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = String(exp);
  const key = await getKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return `${payload}.${bufferToBase64Url(signature)}`;
}

/** Verifica assinatura E expiração. Assinatura via crypto.subtle.verify
 *  (constant-time nativo — sem comparação manual de string). */
export async function isSessionTokenValid(
  token: string | undefined,
  secret: string
): Promise<boolean> {
  if (!token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  try {
    const key = await getKey(secret);
    return await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBuffer(signature),
      new TextEncoder().encode(payload)
    );
  } catch {
    return false;
  }
}
