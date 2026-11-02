import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FnB Digital — QR Ordering, POS & KDS",
    template: "%s · FnB Digital",
  },
  description:
    "Sistem terintegrasi FnB: QR table ordering, POS kasir, KDS dapur, runner, dan back-office dalam satu platform.",
  applicationName: "FnB Digital",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF8F5" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/*
          Plus Jakarta Sans dimuat via stylesheet (bukan `next/font/google`) agar build
          tetap deterministik saat lingkungan tanpa akses fonts.googleapis.com.
          Bila font gagal dimuat, stack fallback di globals.css tetap dipakai.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
