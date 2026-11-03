import { BarChart3, LayoutGrid, LayoutList, PlusSquare, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Sidebar navigasi POS (ikon besar, target sentuh 56px).
 * Menu yang halamannya belum dibangun ditandai "Soon" dan dinonaktifkan.
 */

const NAV_ITEMS = [
  { key: "queue", label: "Antrean", icon: LayoutList, available: true },
  { key: "floor", label: "Meja", icon: LayoutGrid, available: false },
  { key: "walkin", label: "Walk-in", icon: PlusSquare, available: false },
  { key: "shift", label: "Shift", icon: Wallet, available: false },
  { key: "reports", label: "Laporan", icon: BarChart3, available: false },
] as const;

export type PosNavKey = (typeof NAV_ITEMS)[number]["key"];

export function PosSidebar({ active }: { active: PosNavKey }) {
  return (
    <nav
      aria-label="Navigasi kasir"
      className="flex w-[76px] shrink-0 flex-col items-center gap-2 border-r border-border bg-card py-3"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === active;

        return (
          <button
            key={item.key}
            type="button"
            disabled={!item.available}
            title={item.available ? item.label : `${item.label} (segera hadir)`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-touch min-w-touch w-14 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-bold transition",
              isActive && "bg-primary/15 text-primary",
              !isActive && item.available && "text-muted-foreground hover:bg-secondary hover:text-foreground",
              !item.available && "cursor-not-allowed text-muted-foreground/40",
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span className="leading-none">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
