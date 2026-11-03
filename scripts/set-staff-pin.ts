/**
 * Mengganti PIN staf (6 digit).
 *
 * PENTING: PIN di-hash memakai `SESSION_SECRET`. Jalankan skrip ini DI SERVER
 * (VPS) dengan `.env` yang sama seperti aplikasi, supaya hash-nya bisa
 * diverifikasi saat login.
 *
 * Contoh:
 *   cd /var/www/fnb
 *   STAFF_PIN=246810 npx tsx scripts/set-staff-pin.ts --email admin@fnb.local
 *
 * Alternatif tanpa riwayat shell: ekspor dulu, lalu jalankan.
 *   export STAFF_PIN=246810
 *   npx tsx scripts/set-staff-pin.ts --email kasir@fnb.local
 *   unset STAFF_PIN
 */

import { loadEnvFile } from "node:process";

import { hashPin, isValidPinFormat } from "../src/lib/security/pin";

try {
  loadEnvFile();
} catch {
  // .env opsional bila variabel sudah diekspor di environment.
}

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main(): Promise<void> {
  const email = readArg("--email")?.trim().toLowerCase();
  const pin = process.env.STAFF_PIN?.trim();

  if (!email) {
    console.error("Gunakan: STAFF_PIN=<6 digit> npx tsx scripts/set-staff-pin.ts --email <email>");
    process.exitCode = 1;
    return;
  }

  if (!pin || !isValidPinFormat(pin) || pin.length !== 6) {
    console.error("STAFF_PIN wajib 6 digit angka, contoh: STAFF_PIN=246810");
    process.exitCode = 1;
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const staff = await prisma.staff.findUnique({
      where: { email },
      select: { id: true, name: true, isActive: true },
    });

    if (!staff) {
      console.error(`Staf dengan email ${email} tidak ditemukan.`);
      process.exitCode = 1;
      return;
    }

    await prisma.staff.update({
      where: { id: staff.id },
      data: { pinHash: hashPin(pin) },
    });

    console.log(`PIN untuk ${staff.name} (${email}) berhasil diperbarui.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Gagal memperbarui PIN:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
