import { kv } from "@vercel/kv";
import { createClient, type RedisClientType } from "redis";

// Compatibilidade com integrações antigas (KV_REST_*) e novas do
// Marketplace/Upstash (UPSTASH_REDIS_REST_*).
if (!process.env.KV_REST_API_URL && process.env.UPSTASH_REDIS_REST_URL) {
  process.env.KV_REST_API_URL = process.env.UPSTASH_REDIS_REST_URL;
}
if (!process.env.KV_REST_API_TOKEN && process.env.UPSTASH_REDIS_REST_TOKEN) {
  process.env.KV_REST_API_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
}

const hasKvRest =
  Boolean(process.env.KV_REST_API_URL) && Boolean(process.env.KV_REST_API_TOKEN);
const hasRedisUrl = Boolean(process.env.REDIS_URL);

let redisClientPromise: Promise<RedisClientType> | null = null;

function getRedisClient(): Promise<RedisClientType> {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL não configurada");
  }

  if (!redisClientPromise) {
    const client = createClient({ url: process.env.REDIS_URL });

    // Sem listener, um blip de conexão vira 'error' não tratado e derruba
    // o processo — node-redis reconecta sozinho, só precisamos absorver.
    client.on("error", (err) => {
      console.error("[store] Redis error:", err);
    });

    redisClientPromise = client
      .connect()
      .then(() => client)
      .catch((err) => {
        // Não deixa uma falha de cold start envenenar o cache da promise:
        // a próxima requisição desta instância tenta conectar de novo.
        redisClientPromise = null;
        throw err;
      });
  }

  return redisClientPromise;
}

export function storeAvailable(): boolean {
  return hasKvRest || hasRedisUrl;
}

export async function storeGetJson<T>(key: string): Promise<T | null> {
  if (hasKvRest) {
    const value = await kv.get<T>(key);
    return value ?? null;
  }

  if (hasRedisUrl) {
    const client = await getRedisClient();
    const raw = await client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  return null;
}

export async function storeSetJson(key: string, value: unknown): Promise<void> {
  if (hasKvRest) {
    await kv.set(key, value);
    return;
  }

  if (hasRedisUrl) {
    const client = await getRedisClient();
    await client.set(key, JSON.stringify(value));
  }
}

export async function storeLpushJson(key: string, value: unknown): Promise<void> {
  if (hasKvRest) {
    await kv.lpush(key, value);
    return;
  }

  if (hasRedisUrl) {
    const client = await getRedisClient();
    await client.lPush(key, JSON.stringify(value));
  }
}

export async function storeLrangeJson<T>(
  key: string,
  start: number,
  stop: number
): Promise<T[]> {
  if (hasKvRest) {
    const values = await kv.lrange<T>(key, start, stop);
    return values ?? [];
  }

  if (hasRedisUrl) {
    const client = await getRedisClient();
    const values = await client.lRange(key, start, stop);
    return values.map((value) => JSON.parse(value) as T);
  }

  return [];
}

export async function storeLtrim(
  key: string,
  start: number,
  stop: number
): Promise<void> {
  if (hasKvRest) {
    await kv.ltrim(key, start, stop);
    return;
  }

  if (hasRedisUrl) {
    const client = await getRedisClient();
    await client.lTrim(key, start, stop);
  }
}

export async function storeAcquireLock(
  key: string,
  ttlSeconds: number
): Promise<boolean> {
  if (hasKvRest) {
    const acquired = await kv.set(key, "1", {
      nx: true,
      ex: ttlSeconds,
    });
    return acquired !== null;
  }

  if (hasRedisUrl) {
    const client = await getRedisClient();
    const acquired = await client.set(key, "1", {
      NX: true,
      EX: ttlSeconds,
    });
    return acquired === "OK";
  }

  // Sem store configurado (dev local sem Redis): libera o reporte em vez
  // de fingir rate limit — em produção este caminho nunca é alcançado.
  return true;
}
