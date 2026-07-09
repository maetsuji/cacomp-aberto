import { kv } from "@vercel/kv";
import { createHash } from "crypto";

// Janela mínima entre reportes de um mesmo hash de IP (Seção 5.1 do SDD).
const RATE_LIMIT_SECONDS = 10 * 60; // 10 minutos

/**
 * Hash anônimo do usuário: SHA-256(IP + salt secreto + data do dia).
 * O salt diário garante que o hash de hoje não é correlacionável com o
 * de amanhã — o histórico público nunca expõe nem permite rastrear IPs.
 */
export function hashReporter(ip: string): string {
  const daySalt = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return createHash("sha256")
    .update(`${ip}|${process.env.IP_HASH_SALT ?? ""}|${daySalt}`)
    .digest("hex");
}

/**
 * Retorna true se este hash ainda está dentro da janela de bloqueio.
 * Implementado com SET NX + EX no Redis: a primeira chamada grava a
 * chave com TTL; enquanto ela existir, novos reportes são rejeitados.
 */
export async function isRateLimited(reporterHash: string): Promise<boolean> {
  const key = `ca:ratelimit:${reporterHash}`;
  const acquired = await kv.set(key, "1", {
    nx: true,
    ex: RATE_LIMIT_SECONDS,
  });
  return acquired === null; // null = chave já existia = bloqueado
}
