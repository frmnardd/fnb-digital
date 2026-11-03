/**
 * Layout KDS (Dapur & Bar) — tema gelap kontras tinggi, orientasi landscape.
 */
export default function KdsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark h-dvh overflow-hidden bg-background text-foreground">{children}</div>
  );
}
