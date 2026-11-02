import { z } from "zod";

/**
 * Validasi environment variabel (server-side) dengan Zod.
 *
 * Modul ini sengaja fail-fast: bila konfigurasi wajib tidak ada, aplikasi berhenti
 * dengan pesan jelas alih-alih gagal misterius saat melayani request.
 *
 * Jangan diimpor dari komponen client.
 */

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL wajib diisi.")
    .refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://"), {
      message: "DATABASE_URL harus berupa connection string PostgreSQL.",
    }),

  DIRECT_URL: z.string().optional(),

  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET minimal 32 karakter untuk keamanan token & PIN."),

  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL harus berupa URL valid.").optional(),

  PAYMENT_PROVIDER: z.enum(["midtrans", "xendit", "manual"]).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

/** Mengembalikan environment yang sudah tervalidasi (di-cache per proses). */
export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    throw new Error(`Konfigurasi environment tidak valid:\n${detail}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

/** Hanya untuk test: mengosongkan cache setelah env diubah. */
export function resetServerEnvCache(): void {
  cachedEnv = null;
}
