import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { maybeAutoClose } from "@/lib/auto-close";

// Disparado pelo Vercel Cron (vercel.json) todo dia às 00h00 de Brasília.
// A regra completa (janela 00h–07h + "nenhum reporte de aberto na última
// hora") vive em src/lib/auto-close.ts — este handler só a aciona no
// horário principal; as checagens seguintes até as 7h acontecem de forma
// preguiçosa na regeneração ISR da Home, porque o plano Hobby da Vercel
// limita crons a 1 execução por dia.
//
// `revalidatePath()` só é permitido em Route Handler/Server Action —
// nunca durante o render de página.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  // Sem CRON_SECRET configurado, o endpoint fica bloqueado por padrão —
  // não dá pra deixar uma URL pública fechando o CA de qualquer lugar.
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await maybeAutoClose();

  if (result.closed) {
    revalidatePath("/");
  }

  return NextResponse.json({
    ok: true,
    closed: result.closed,
    reason: result.reason ?? null,
    status: result.state.current_status,
  });
}
