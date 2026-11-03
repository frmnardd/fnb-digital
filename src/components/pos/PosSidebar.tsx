import { BarChart3, LayoutGrid, LayoutList, LogOut, PlusSquare, Wallet } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Sidebar navigasi POS (ikon besar, target sentuh 56px).
 * Menu yang halamannya belum dibangun dinonaktifkan dan ditandai "(segera hadir)".
 */

const NAV_ITEMS = [
  { key: "queue", label: "Antrean", icon: LayoutList, href: "/cashier" },
  { key: "floor", label: "Meja", icon: LayoutGrid, href: "/cashier/floor" },
  { key: "walkin", label: "Walk-in", icon: PlusSquare, href: "/cashier/walkin" },
  { key: "shift", label: "Shift", icon: Wallet, href: "/cashier/shift" },
  { key: "reports", label: "Laporan", icon: BarChart3, href: null },
] as const;

export type PosNavKey = (typeof NAV_ITEMS)[number]["key"];

const ITEM_BASE =
  "flex min-h-touch min-w-touch w-14 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-bold transition";

export function PosSidebar({ active }: { active: PosNavKey }) {
  return (
    <nav
      aria-label="Navigasi kasir"
      className="flex w-[76px] shrink-0 flex-col items-center gap-2 border-r border-border bg-card py-3"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === active;

        const className = cn(
          ITEM_BASE,
          isActive && "bg-primary/15 text-primary",
          !isActive && item.href !== null && "text-muted-foreground hover:bg-secondary hover:text-foreground",
          item.href === null && "cursor-not-allowed text-muted-foreground/40",
        );

        const content = (
          <>
            <Icon className="size-5" aria-hidden />
            <span className="leading-none">{item.label}</span>
          </>
        );

        if (item.href === null) {
          return (
            <button
              key={item.key}
              type="button"
              disabled
              title={`${item.label} (segera hadir)`}
              className={className}
            >
              {content}
            </button>
          );
        }

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={className}
          >
            {content}
          </Link>
        );
      })}

      <Link
        href="/api/auth/staff/logout"
        prefetch={false}
        aria-label="Keluar dari sesi staf"
        className={cn(ITEM_BASE, "mt-auto border border-border text-muted-foreground hover:text-danger")}
      >
        <LogOut className="size-5" aria-hidden />
        <span className="leading-none">Keluar</span>
      </Link>
    </nav>
  );
}
