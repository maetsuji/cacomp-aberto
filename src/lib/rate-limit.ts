import { createHash } from "crypto";
import { storeAcquireLock, storeIncrWithTTL } from "./store";

// Janela de bloqueio estrito por dispositivo (Seção 5.1 do SDD).
const DEVICE_RATE_LIMIT_SECONDS = 15 * 60; // 15 minutos

// Teto frouxo por IP — rede de segurança contra script que não persiste
// cookies (não é a defesa principal; essa é o rate-limit por device abaixo).
const IP_FLOOD_CAP_PER_HOUR = Number(process.env.REPORT_IP_FLOOD_CAP ?? 20);
const IP_FLOOD_WINDOW_SECONDS = 60 * 60;

/**
 * Hash anônimo do IP: SHA-256(IP + salt secreto + data do dia).
 * O salt diário garante que o hash de hoje não é correlacionável com o
 * de amanhã — o histórico público nunca expõe nem permite rastrear IPs.
 * Usado só para o teto frouxo de flood e para o log público (reporter_hash),
 * não mais para o rate-limit estrito (ver isDeviceRateLimited).
 */
export function hashReporter(ip: string): string {
  const daySalt = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return createHash("sha256")
    .update(`${ip}|${process.env.IP_HASH_SALT ?? ""}|${daySalt}`)
    .digest("hex");
}

/**
 * Rate-limit estrito por dispositivo (cookie anônimo, ver route.ts).
 * Substitui o antigo rate-limit por IP: numa wifi compartilhada (ex. rede
 * pública da UnB), pessoas diferentes têm deviceIds diferentes, então não
 * se bloqueiam mutuamente — cada dispositivo tem sua própria janela de 15min.
 */
export async function isDeviceRateLimited(deviceId: string): Promise<boolean> {
  const acquired = await storeAcquireLock(
    `ca:ratelimit:device:${deviceId}`,
    DEVICE_RATE_LIMIT_SECONDS
  );
  return !acquired;
}

/**
 * Teto frouxo por IP: cobre o caso de alguém automatizando requests sem
 * persistir cookies (o rate-limit por device seria inútil contra isso,
 * já que um deviceId novo é gerado a cada request sem cookie).
 */
export async function isIpFlooding(reporterHash: string): Promise<boolean> {
  const count = await storeIncrWithTTL(
    `ca:ratelimit:ipflood:${reporterHash}`,
    IP_FLOOD_WINDOW_SECONDS
  );
  return count > IP_FLOOD_CAP_PER_HOUR;
}
