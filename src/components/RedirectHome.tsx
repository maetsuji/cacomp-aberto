"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Redireciona para a Home após N segundos (tela pós-scan, Seção 4 do SDD). */
export function RedirectHome({ seconds = 3 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace("/"), seconds * 1000);
    return () => clearTimeout(t);
  }, [router, seconds]);

  return (
    <p className="mt-4 text-sm text-zinc-500">
      Voltando para a página inicial…
    </p>
  );
}
