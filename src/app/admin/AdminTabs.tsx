import Link from "next/link";
import { logoutAction } from "./login/actions";

// Navegação em tabs do painel /admin. O middleware de sessão cobre
// /admin/:path*, então toda tab nova já nasce protegida.
const TABS = [
  { id: "geral", href: "/admin", label: "Geral" },
  { id: "aparencia", href: "/admin/aparencia", label: "Aparência" },
] as const;

export type AdminTabId = (typeof TABS)[number]["id"];

export function AdminTabs({ active }: { active: AdminTabId }) {
  return (
    <nav className="flex items-center justify-between gap-1 border-b border-zinc-800 text-sm">
      <div className="flex gap-1">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={`rounded-t-lg px-4 py-2 font-semibold ${
              tab.id === active
                ? "border border-b-0 border-zinc-800 bg-zinc-900 text-zinc-50"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            aria-current={tab.id === active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="px-4 py-2 font-semibold text-zinc-400 hover:text-zinc-200"
        >
          Sair
        </button>
      </form>
    </nav>
  );
}
