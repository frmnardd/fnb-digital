import { requireStaffPage } from "@/lib/auth/staff";

/**
 * Layout KDS (Dapur & Bar) — tema gelap kontras tinggi, orientasi landscape.
 * Hanya staf dapur (atau admin) yang boleh masuk.
 */
export default async function KdsLayout({ children }: { children: React.ReactNode }) {
  await requireStaffPage(["ADMIN", "KITCHEN"]);

  return (
    <div className="dark h-dvh overflow-hidden bg-background text-foreground">{children}</div>
  );
}
