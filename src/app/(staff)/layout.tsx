import { requireStaffPage } from "@/lib/auth/staff";

/**
 * Layout modul pelayan/runner — mobile-first dengan tema terang pelanggan.
 * Hanya staf pelayan (atau admin) yang boleh masuk.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireStaffPage(["ADMIN", "WAITER"]);

  return <div className="min-h-dvh bg-background text-foreground">{children}</div>;
}
