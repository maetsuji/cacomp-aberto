import { NextRequest, NextResponse } from "next/server";

// Protege /admin (página + Server Actions, que fazem POST no mesmo
// path) com HTTP Basic Auth. Credenciais em ADMIN_USER/ADMIN_PASSWORD.
// Sem ADMIN_PASSWORD configurada, o acesso é NEGADO por padrão (503) —
// nunca aberto por omissão.
export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

export function middleware(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return new NextResponse("ADMIN_PASSWORD não configurada", { status: 503 });
  }

  const user = process.env.ADMIN_USER ?? "admin";
  const expected = `Basic ${btoa(`${user}:${password}`)}`;
  const received = request.headers.get("authorization");

  if (received === expected) {
    return NextResponse.next();
  }

  return new NextResponse("Autenticação necessária", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="CA-Aberto Admin"' },
  });
}
