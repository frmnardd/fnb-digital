import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Penggabung className standar shadcn/ui.
 * twMerge memastikan utility Tailwind terakhir menang tanpa duplikasi konflik.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
