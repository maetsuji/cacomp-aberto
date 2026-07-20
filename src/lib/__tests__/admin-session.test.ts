import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  isSessionTokenValid,
  SESSION_MAX_AGE_SECONDS,
} from "../admin-session";

// Web Crypto puro (crypto.subtle existe no Node >= 20) — zero mocks.

const SECRET = "senha-super-secreta";

/** Forja um token com expiração arbitrária, no mesmo formato do módulo. */
async function forgeToken(exp: number, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const payload = String(exp);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  const b64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${payload}.${b64}`;
}

describe("admin-session", () => {
  it("aceita um token recém-criado com o mesmo secret", async () => {
    const token = await createSessionToken(SECRET);
    await expect(isSessionTokenValid(token, SECRET)).resolves.toBe(true);
  });

  it("embute expiração de 12h no payload", async () => {
    const token = await createSessionToken(SECRET);
    const exp = Number(token.split(".")[0]);
    const expected = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
    expect(Math.abs(exp - expected)).toBeLessThanOrEqual(2);
  });

  it("rejeita token expirado mesmo com assinatura válida", async () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    const token = await forgeToken(past, SECRET);
    await expect(isSessionTokenValid(token, SECRET)).resolves.toBe(false);
  });

  it("rejeita token assinado com outro secret", async () => {
    const token = await createSessionToken("outra-senha");
    await expect(isSessionTokenValid(token, SECRET)).resolves.toBe(false);
  });

  it("rejeita payload adulterado (exp estendida sem reassinar)", async () => {
    const token = await createSessionToken(SECRET);
    const [, signature] = token.split(".");
    const farFuture = Math.floor(Date.now() / 1000) + 999_999;
    await expect(
      isSessionTokenValid(`${farFuture}.${signature}`, SECRET)
    ).resolves.toBe(false);
  });

  it("rejeita undefined, vazio e formatos malformados", async () => {
    for (const bad of [undefined, "", "sem-ponto", "a.b.c", "123."]) {
      await expect(isSessionTokenValid(bad, SECRET)).resolves.toBe(false);
    }
  });
});
