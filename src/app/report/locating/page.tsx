"use client";

import { Suspense, useEffect, useState } from "react";
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

function LocatingContent() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  function requestLocation() {
    setError(null);

    if (!("geolocation" in navigator)) {
      setError("Seu navegador não suporta localização. Tente outro navegador.");
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
      () => {
        setError(
          "Não conseguimos confirmar sua localização. Ative o GPS/localização e tente de novo."
        );
      },
      { enableHighAccuracy: false, timeout: 8000 } // "rough/lazy": rápido, não pinpoint
    );
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- roda só na montagem
  useEffect(requestLocation, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-50">
      {error ? (
        <>
          <p className="text-5xl">📍</p>
          <p className="text-zinc-300">{error}</p>
          <button
            onClick={requestLocation}
            className="underline underline-offset-2"
          >
            Tentar novamente
          </button>
        </>
      ) : (
        <>
          <p className="text-5xl">📍</p>
          <p className="text-zinc-300">Confirmando sua localização…</p>
        </>
      )}
    </main>
  );
}
