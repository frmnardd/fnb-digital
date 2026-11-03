import { requireStaffPage } from "@/lib/auth/staff";

/**
 * Layout modul POS & KDS — tema gelap kontras tinggi (Slate Dark, CONTEXT §5.1).
 * Tinggi penuh tanpa scroll body: setiap panel mengatur scroll sendiri.
 * Hanya staf ADMIN/CASHIER yang boleh masuk.
 */
export default async function PosLayout({ children }: { children: React.ReactNode }) {
  await requireStaffPage(["ADMIN", "CASHIER"]);

  return (
    <div className="dark h-dvh overflow-hidden bg-background text-foreground">{children}</div>
  );
}
