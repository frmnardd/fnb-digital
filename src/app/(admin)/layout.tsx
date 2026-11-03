import { BarChart3, Boxes, LayoutDashboard, QrCode, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Layout back-office admin — tema terang, sidebar tetap, mobile collapse ke header.
 */

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, enabled: false },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed, enabled: true },
  { href: "/admin/tables", label: "Meja & QR", icon: QrCode, enabled: false },
  { href: "/admin/inventory", label: "Inventori", icon: Boxes, enabled: false },
  { href: "/admin/analytics", label: "Analitik", icon: BarChart3, enabled: false },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground md:flex-row">
      <aside className="flex shrink-0 flex-col gap-1 border-b border-border bg-card p-3 md:w-[220px] md:border-b-0 md:border-r">
        <div className="mb-2 flex items-center gap-2 px-2 py-1">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <UtensilsCrossed className="size-4" aria-hidden />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-extrabold leading-tight">FnB Digital</span>
            <span className="text-[10px] text-muted-foreground">Back-office</span>
          </div>
        </div>

        <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col" aria-label="Navigasi admin">
          {NAV.map((entry) => {
            const Icon = entry.icon;

            if (!entry.enabled) {
              return (
                <span
                  key={entry.href}
                  aria-disabled
                  className="flex min-h-11 shrink-0 cursor-not-allowed items-center gap-2 rounded-lg px-3 text-xs font-semibold text-muted-foreground/40"
                >
                  <Icon className="size-4" aria-hidden />
                  {entry.label}
                </span>
              );
            }

            return (
              <Link
                key={entry.href}
                href={entry.href}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-bold transition",
                  "bg-primary/10 text-primary hover:bg-primary/15",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {entry.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 p-4">{children}</main>
    </div>
  );
}
