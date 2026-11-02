/**
 * Layout modul pelanggan — tema terang hangat (Warm Alabaster), mobile-first.
 * `max-w-md` membuat tampilan tetap nyaman pada tablet tanpa merusak layout mobile.
 */
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground">{children}</div>;
}
