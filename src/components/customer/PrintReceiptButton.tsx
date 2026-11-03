"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Tombol cetak struk. Di browser, "Cetak" juga bisa disimpan sebagai PDF
 * (pilih "Save as PDF" pada dialog print).
 */
export function PrintReceiptButton() {
  return (
    <Button onClick={() => window.print()} className="print-hidden w-full max-w-[320px]">
      <Printer className="size-4" aria-hidden />
      Cetak / Simpan PDF
    </Button>
  );
}
