import { NextRequest, NextResponse } from "next/server";
import { processReport } from "@/lib/report";

// Route Handler (não página): o scan do QR chega aqui via GET.
// Processar o reporte AQUI — e não durante o render de um Server
// Component — é obrigatório, porque `revalidatePath()` só é permitido
// em Route Handlers e Server Actions. Chamá-lo durante render quebra
// em produção ("revalidatePath during render which is unsupported").
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const result = await processReport(
    searchParams.get("action") ?? undefined,
    searchParams.get("token") ?? undefined
  );

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

  return NextResponse.redirect(resultUrl);
}
