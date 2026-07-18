import { createHash } from "crypto";
import {
  DEFAULT_RATE_LIMIT_WINDOW_MINUTES,
  RATE_LIMIT_WINDOW_LIMITS,
} from "./rate-limit-limits";
import { storeAcquireLock, storeAvailable, storeGetJson, storeIncrWithTTL, storeSetJson } from "./store";

// Janela de bloqueio estrito por dispositivo (Seção 5.1 do SDD).
// O valor padrão (15 min) pode ser ajustado pelo slider em /admin —
// ver getDeviceRateLimitMinutes abaixo.
const RATE_LIMIT_WINDOW_KEY = "ca:ratelimit-window-minutes";

/** Janela vigente em minutos: a salva no Redis (clampada) ou o default. */
export async function getDeviceRateLimitMinutes(): Promise<number> {
  if (!storeAvailable()) return DEFAULT_RATE_LIMIT_WINDOW_MINUTES;
  const stored = await storeGetJson<number>(RATE_LIMIT_WINDOW_KEY);
  const n = Number(stored);
  if (!Number.isFinite(n)) return DEFAULT_RATE_LIMIT_WINDOW_MINUTES;
  return Math.min(
    RATE_LIMIT_WINDOW_LIMITS.minutes.max,
    Math.max(RATE_LIMIT_WINDOW_LIMITS.minutes.min, n)
  );
}

export async function setDeviceRateLimitMinutes(minutes: number): Promise<void> {
  await storeSetJson(RATE_LIMIT_WINDOW_KEY, minutes);
}

// Teto frouxo por IP — rede de segurança contra script que não persiste
// cookies (não é a defesa principal; essa é o rate-limit por device abaixo).
const IP_FLOOD_CAP_PER_HOUR = Number(process.env.REPORT_IP_FLOOD_CAP ?? 20);
const IP_FLOOD_WINDOW_SECONDS = 60 * 60;

const RATE_LIMIT_DISABLED_KEY = "ca:ratelimit-disabled";

/**
 * Toggle no /admin pra testar o fluxo de reportes fazendo várias
 * chamadas seguidas sem esperar a janela de 15 min por device. Desliga
 * só o rate-limit por device e o teto por IP (isIpFlooding/
 * isDeviceRateLimited) — o circuit breaker diário (lib/report.ts)
 * continua ativo sempre, como rede de segurança contra estourar a cota
 * do Redis.
 *
 * Sem Redis (dev local), rate-limit sempre ativo por padrão.
 */
export async function isRateLimitDisabled(): Promise<boolean> {
  if (!storeAvailable()) return false;
  return (await storeGetJson<boolean>(RATE_LIMIT_DISABLED_KEY)) ?? false;
}

export async function setRateLimitDisabled(disabled: boolean): Promise<void> {
  await storeSetJson(RATE_LIMIT_DISABLED_KEY, disabled);
}

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
 * se bloqueiam mutuamente — cada dispositivo tem sua própria janela
 * (duração ajustável pelo slider em /admin; default 15 min).
 */
export async function isDeviceRateLimited(deviceId: string): Promise<boolean> {
  const minutes = await getDeviceRateLimitMinutes();
  const acquired = await storeAcquireLock(
    `ca:ratelimit:device:${deviceId}`,
    minutes * 60
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

// Bloqueio temporário de tentativas de login em /admin/login (Seção
// "tela de login própria"): um formulário próprio é mais fácil de
// automatizar que o modal nativo do Basic Auth, então precisa de um
// teto explícito por IP.
const LOGIN_FAIL_CAP = 5;
const LOGIN_FAIL_WINDOW_SECONDS = 15 * 60;

/**
 * true se o IP já tentou logar demais na janela — bloqueia ANTES de
 * checar a senha (mesma lógica "mais barato primeiro" de processReport).
 * Sem Redis (dev local), storeIncrWithTTL retorna 0 sempre: nunca bloqueia.
 */
export async function isLoginRateLimited(ip: string): Promise<boolean> {
  const hash = hashReporter(ip);
  const count = await storeIncrWithTTL(
    `ca:admin-login-fail:${hash}`,
    LOGIN_FAIL_WINDOW_SECONDS
  );
  return count > LOGIN_FAIL_CAP;
}
