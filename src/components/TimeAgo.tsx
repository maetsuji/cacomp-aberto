"use client";

import { useEffect, useState } from "react";

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} minuto${minutes > 1 ? "s" : ""}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} hora${hours > 1 ? "s" : ""}`;

  const days = Math.floor(hours / 24);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}

/**
 * "Atualizado há X minutos" calculado no navegador.
 *
 * Por que client component? A Home é HTML estático servido da CDN — se o
 * tempo relativo fosse renderizado no servidor, ficaria congelado no
 * momento do build/revalidação. Aqui o relógio continua andando no
 * dispositivo do usuário, sem custo de servidor.
 */
export function TimeAgo({ iso }: { iso: string }) {
  // Evita mismatch de hidratação: o servidor não renderiza o valor.
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setLabel(formatRelative(iso));
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [iso]);

  return (
    <span suppressHydrationWarning>
      {label ?? new Date(iso).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </span>
  );
}
