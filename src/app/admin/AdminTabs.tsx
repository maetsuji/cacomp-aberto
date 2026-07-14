import Link from "next/link";

// Navegação em tabs do painel /admin. O middleware de Basic Auth cobre
// /admin/:path*, então toda tab nova já nasce protegida.
const TABS = [
  { id: "geral", href: "/admin", label: "Geral" },
  { id: "blobs", href: "/admin/blobs", label: "Cores do fundo" },
  { id: "flicker", href: "/admin/flicker", label: "Flicker" },
] as const;

export type AdminTabId = (typeof TABS)[number]["id"];

export function AdminTabs({ active }: { active: AdminTabId }) {
  return (
    <nav className="flex gap-1 border-b border-zinc-800 text-sm">
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
    </nav>
  );
}
