"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

// Tela intermediária que só existe quando o geofence está ligado
// (toggle no /admin). Pede a localização do navegador e, se dentro do
// raio configurado, completa a volta pro Route Handler /report com
// lat/lng anexados — ele então processa o reporte de verdade.
export default function LocatingPage() {
  // useSearchParams exige um Suspense boundary (Next 15).
  return (
    <Suspense fallback={null}>
      <LocatingContent />
    </Suspense>
  );
}

type Status = "idle" | "requesting" | "error";

function LocatingContent() {
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Precisa ser chamado a partir de um toque do usuário (onClick), não
  // automaticamente ao montar a página. Safari/iOS é bem mais rígido que
  // Chrome/Android quanto a isso: como esta página só é alcançada via um
  // redirect do servidor (/report -> /report/locating), o toque original
  // no link/QR/NFC não conta mais como "gesto do usuário" quando chegamos
  // aqui — se disparássemos getCurrentPosition sozinho num useEffect, o
  // Safari recusa mostrar o prompt (silenciosamente, sem erro nenhum).
  function requestLocation() {
    setStatus("requesting");
    setError(null);

    if (!("geolocation" in navigator)) {
      setError("Seu navegador não suporta localização. Tente outro navegador.");
      setStatus("error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const url = new URL("/report", window.location.origin);
        url.searchParams.set("action", params.get("action") ?? "");
        url.searchParams.set("token", params.get("token") ?? "");
        url.searchParams.set("lat", String(position.coords.latitude));
        url.searchParams.set("lng", String(position.coords.longitude));
        window.location.href = url.toString();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError(
            "Localização bloqueada para este site. No iPhone: Ajustes > Privacidade e Segurança > Serviços de Localização > Safari (ou Safari Websites) > Perguntar ou Permitir. Depois volte e toque em Tentar novamente."
          );
        } else {
          setError(
            "Não conseguimos confirmar sua localização. Ative o GPS/localização e tente de novo."
          );
        }
        setStatus("error");
      },
      { enableHighAccuracy: false, timeout: 8000 } // "rough/lazy": rápido, não pinpoint
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-50">
      <p className="text-5xl">📍</p>
      {status === "idle" && (
        <>
          <p className="text-zinc-300">
            Precisamos confirmar que você está perto do CA.
          </p>
          <button
            onClick={requestLocation}
            className="rounded-lg bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-950"
          >
            Permitir localização
          </button>
        </>
      )}
      {status === "requesting" && (
        <p className="text-zinc-300">Confirmando sua localização…</p>
      )}
      {status === "error" && (
        <>
          <p className="text-zinc-300">{error}</p>
          <button
            onClick={requestLocation}
            className="underline underline-offset-2"
          >
            Tentar novamente
          </button>
        </>
      )}
    </main>
  );
}
