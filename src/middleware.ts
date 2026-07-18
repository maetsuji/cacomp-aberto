import { NextRequest, NextResponse } from "next/server";
import { isSessionTokenValid, SESSION_COOKIE } from "@/lib/admin-session";

// Protege /admin (página + Server Actions, que fazem POST no mesmo
// path) com uma sessão de login própria (ver src/app/admin/login).
// Credenciais em ADMIN_USER/ADMIN_PASSWORD (mesmas de sempre — sem
// segredo novo). Sem ADMIN_PASSWORD configurada, o acesso é NEGADO por
// padrão (503) — nunca aberto por omissão, nem a própria tela de login.
export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

export async function middleware(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return new NextResponse("ADMIN_PASSWORD não configurada", { status: 503 });
  }

  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await isSessionTokenValid(token, password)) {
    return NextResponse.next();
  }

  // POSTs de Server Actions (formAction=...) com sessão expirada: 401
  // simples, sem redirect — é uma submissão de form, não navegação.
  if (request.method !== "GET") {
    return new NextResponse("Sessão expirada — faça login novamente.", {
      status: 401,
    });
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
