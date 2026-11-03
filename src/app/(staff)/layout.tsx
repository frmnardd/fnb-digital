/**
 * Layout modul pelayan/runner — mobile-first dengan tema terang pelanggan.
 */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground">{children}</div>;
}
