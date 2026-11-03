import { UtensilsCrossed } from "lucide-react";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { getStaffSession } from "@/lib/auth/staff";

/**
 * Halaman login staf: /login?next=/cashier
 */

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const session = await getStaffSession();
  const nextPath =
    params.next && params.next.startsWith("/") ? params.next : "/cashier";

  if (session) {
    redirect(nextPath);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <UtensilsCrossed className="size-6" aria-hidden />
          </span>
          <h1 className="text-lg font-extrabold">Masuk Staf</h1>
          <p className="text-[11px] text-muted-foreground">
            Gunakan email dan PIN 6 digit yang diberikan admin.
          </p>
        </div>

        {params.error === "forbidden" ? (
          <p role="alert" className="rounded-lg bg-warning/10 p-2 text-[11px] font-semibold text-warning">
            Peran akun ini tidak boleh membuka halaman tersebut.
          </p>
        ) : null}

        <LoginForm nextPath={nextPath} />

        <p className="text-center text-[10px] text-muted-foreground">
          Pelanggan tidak perlu login — cukup scan QR di meja.
        </p>
      </div>
    </main>
  );
}
