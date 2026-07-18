"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/admin-session";
import { isLoginRateLimited } from "@/lib/rate-limit";

export async function loginAction(formData: FormData) {
  const from = String(formData.get("from") ?? "/admin");
  const safeFrom = from.startsWith("/admin") ? from : "/admin";

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  if (await isLoginRateLimited(ip)) {
    redirect(
      `/admin/login?from=${encodeURIComponent(safeFrom)}&msg=${encodeURIComponent(
        "Muitas tentativas — aguarde alguns minutos e tente de novo."
      )}`
    );
  }

  const user = String(formData.get("user") ?? "");
  const password = String(formData.get("password") ?? "");
  const expectedUser = process.env.ADMIN_USER ?? "admin";
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "";

  if (!expectedPassword || user !== expectedUser || password !== expectedPassword) {
    redirect(
      `/admin/login?from=${encodeURIComponent(safeFrom)}&msg=${encodeURIComponent(
        "Usuário ou senha inválidos."
      )}`
    );
  }

  const token = await createSessionToken(expectedPassword);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/admin",
  });

  redirect(safeFrom);
}

export async function logoutAction() {
  (await cookies()).set(SESSION_COOKIE, "", { path: "/admin", maxAge: 0 });
  redirect("/admin/login");
}
