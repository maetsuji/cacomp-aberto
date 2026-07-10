import { NextRequest, NextResponse } from "next/server";
import { isGeofenceEnabled } from "@/lib/geofence";
import { processReport } from "@/lib/report";

const DEVICE_COOKIE = "ca_device";
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 dias

// Route Handler (não página): o scan do QR/toque NFC chega aqui via GET.
// Processar o reporte AQUI — e não durante o render de um Server
// Component — é obrigatório, porque `revalidatePath()` só é permitido
// em Route Handlers e Server Actions. Chamá-lo durante render quebra
// em produção ("revalidatePath during render which is unsupported").
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action") ?? undefined;
  const token = searchParams.get("token") ?? undefined;

  // Cookie anônimo de dispositivo (UUID aleatório, sem PII) — usado pro
  // rate-limit estrito em vez de IP, pra não bloquear pessoas diferentes
  // que compartilham a mesma rede (ex: wifi pública da UnB).
  const deviceId =
    request.cookies.get(DEVICE_COOKIE)?.value ?? crypto.randomUUID();

  // Geofence por GPS (liga/desliga no /admin): se ligado e a request
  // ainda não trouxe lat/lng, manda pra tela intermediária que pede a
  // localização do navegador antes de processar o reporte de verdade.
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if ((await isGeofenceEnabled()) && (lat === null || lng === null)) {
    const locatingUrl = new URL("/report/locating", request.url);
    locatingUrl.searchParams.set("action", action ?? "");
    locatingUrl.searchParams.set("token", token ?? "");
    return NextResponse.redirect(locatingUrl);
  }

  const coords = lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined;
  const result = await processReport(action, token, deviceId, coords);

  // Redireciona para a tela de resultado (padrão POST/Redirect/GET
  // adaptado): recarregar a página de resultado não reprocessa nada,
  // e a URL com o token secreto sai da barra de endereço do usuário.
  const resultUrl = new URL("/report/result", request.url);
  if (result.ok) {
    resultUrl.searchParams.set("outcome", "ok");
    resultUrl.searchParams.set("status", result.status);
  } else {
    resultUrl.searchParams.set("outcome", result.reason);
  }

  const response = NextResponse.redirect(resultUrl);

  // Sempre renova o cookie (existente ou novo) — mantém a janela de
  // 180 dias rolante e garante que o primeiro reporte de um device já
  // grava o cookie antes do usuário sair da página.
  response.cookies.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // não quebra teste local em http://
    sameSite: "lax",
    maxAge: DEVICE_COOKIE_MAX_AGE,
    path: "/",
  });

  return response;
}
