/**
 * Layout modul POS & KDS — tema gelap kontras tinggi (Slate Dark, CONTEXT §5.1).
 * Tinggi penuh tanpa scroll body: setiap panel mengatur scroll sendiri.
 */
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark h-dvh overflow-hidden bg-background text-foreground">{children}</div>
  );
}
