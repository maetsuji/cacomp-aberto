import { storeAvailable, storeGetJson, storeSetJson } from "./store";

/* ───────────────────────── GEOFENCE POR GPS ─────────────────────────
 *
 * Mitiga o problema do "link estável": o short link do QR/NFC sempre
 * aponta pro destino válido (é o próprio propósito dele), então
 * rotacionar o token não impede alguém de reportar de qualquer lugar
 * com o link compartilhado. Rotação de token não resolve isso — só uma
 * prova de que o dispositivo está fisicamente perto do CA ajuda.
 *
 * Geofence por IP (allowlist de rede) foi descartado: a rede da UnB
 * varia muito e boa parte dos reportes virá por dados móveis. GPS do
 * navegador funciona em qualquer rede.
 *
 * Liga/desliga via toggle no /admin (não por env var) — assim dá pra
 * testar em casa com o toggle desligado e ativar só quando operando de
 * verdade no CA, sem precisar mexer em env vars/redeploy.
 *
 * IMPORTANTE (honestidade sobre o limite): a checagem final compara
 * números (lat/lng) vindos da própria URL. Alguém tecnicamente
 * sofisticado que descubra o padrão pode forjar coordenadas fixas e
 * recriar o problema do link estável. Isso é um dissuasor de
 * compartilhamento casual, não uma prova criptográfica inquebrável —
 * mesma filosofia de "camadas leves" do resto do projeto (Seção 5 do SDD).
 * ──────────────────────────────────────────────────────────────────── */

const GEOFENCE_KEY = "ca:geofence-enabled";

/** Sem Redis (dev local), sempre desligado — testável em casa sem fricção. */
export async function isGeofenceEnabled(): Promise<boolean> {
  if (!storeAvailable()) return false;
  return (await storeGetJson<boolean>(GEOFENCE_KEY)) ?? false;
}

export async function setGeofenceEnabled(enabled: boolean): Promise<void> {
  await storeSetJson(GEOFENCE_KEY, enabled);
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const EARTH_RADIUS_METERS = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** true se as coords estão dentro do raio do CA. Sem CA configurado, nunca bloqueia. */
export function isWithinGeofence(lat: number, lng: number): boolean {
  const centerLat = Number(process.env.GEOFENCE_LAT);
  const centerLng = Number(process.env.GEOFENCE_LNG);
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) return true;

  const radius = Number(process.env.GEOFENCE_RADIUS_METERS ?? 150);
  return haversineMeters(lat, lng, centerLat, centerLng) <= radius;
}
