import { readFile } from "fs/promises";
import { join } from "path";
import { getCaState } from "@/lib/status";

// Route handler que serve favicon dinâmico baseado no estado do CA.
// Consulta getCaState() no Redis e retorna o PNG correspondente.
//
// dynamic = "force-dynamic" garante que a cada requisição consultamos
// o Redis — o favicon muda instantaneamente quando o estado é atualizado,
// sem esperar regeneração da Home (ISR).

export const dynamic = "force-dynamic";

export async function GET() {
  const { current_status } = await getCaState();

  const fileName =
    current_status === "OPEN" ? "icon-open.png" : "icon-closed.png";

  try {
    // Ler arquivo do filesystem. Em produção (Vercel), __dirname aponta
    // pra .next/server/app (output do build), então precisamos navegar
    // pro arquivo original em src/app/. Em dev, o path é relativo ao
    // current working directory.
    const filePath = join(process.cwd(), "src", "app", fileName);
    const buffer = await readFile(filePath);

    return new Response(buffer, {
      headers: {
        "Content-Type": "image/png",
        // Cache curto: favicons mudam raramente (só quando o estado muda),
        // mas browsers cachear agressivamente por padrão. 60s é um bom
        // compromisso entre dinâmico (estado refletido rápido) e performático
        // (não refaz o fetch a cada visita).
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    // Fallback: retorna 404 (navegador usa seu ícone padrão)
    return new Response(null, { status: 404 });
  }
}
