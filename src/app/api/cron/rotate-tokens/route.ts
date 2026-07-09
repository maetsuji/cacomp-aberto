import { NextRequest, NextResponse } from "next/server";
import { rotateAndSync } from "@/lib/rotate";

// Disparado pelo Vercel Cron (vercel.json) todo dia às 06h00 de Brasília
// (CA fechado, antes do dia começar). Rotaciona os tokens de reporte e
// atualiza o destino dos short links do lc.cx — os QR Codes impressos
// nunca mudam. Sem LCCX_API_KEY/short links configurados, a rotação é
// pulada (force: false): rotacionar sem atualizar os links quebraria os
// QRs impressos diariamente.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await rotateAndSync({ force: false });

  return NextResponse.json({
    ok: true,
    rotated: result.rotated,
    errors: result.errors,
    rotated_at: result.tokens.rotated_at,
  });
}
