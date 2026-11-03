import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { NextRequest } from "next/server";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import {
  buildProofFileName,
  buildProofPublicUrl,
  validateProofDescriptor,
  type ProofMimeType,
} from "@/lib/payment/manual-transfer";

/**
 * POST /api/orders/[orderNumber]/payment/proof
 *
 * Menerima bukti transfer manual (multipart/form-data, field `proof`).
 * File disimpan di `public/uploads/proofs` dan URL-nya ditempel ke `Payment`.
 *
 * Catatan produksi: pada platform dengan filesystem read-only (mis. Vercel),
 * ganti penyimpanan ini dengan object storage (Supabase Storage) — antarmuka
 * respons tidak perlu berubah.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,32}$/;

type RouteContext = { params: Promise<{ orderNumber: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { orderNumber } = await context.params;

    if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
      throw new ApiError("BAD_REQUEST", "Nomor pesanan tidak valid.");
    }

    const form = await request.formData().catch(() => null);

    if (!form) {
      throw new ApiError(
        "BAD_REQUEST",
        "Body harus multipart/form-data dengan field 'proof'.",
      );
    }

    const file = form.get("proof");

    if (!(file instanceof File)) {
      throw new ApiError("VALIDATION_ERROR", "File bukti wajib diunggah pada field 'proof'.");
    }

    const validation = validateProofDescriptor({
      fileName: file.name,
      size: file.size,
      mimeType: file.type,
    });

    if (!validation.valid) {
      throw new ApiError("VALIDATION_ERROR", validation.error ?? "Bukti transfer tidak valid.");
    }

    const order = await db.order.findUnique({
      where: { orderNumber },
      select: { id: true, status: true },
    });

    if (!order) {
      throw new ApiError("NOT_FOUND", "Pesanan tidak ditemukan.");
    }

    if (order.status === "CANCELLED" || order.status === "COMPLETED") {
      throw new ApiError("CONFLICT", "Pesanan sudah tidak menerima bukti pembayaran.");
    }

    const payment = await db.payment.findFirst({
      where: { orderId: order.id, method: "MANUAL_TRANSFER", status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!payment) {
      throw new ApiError(
        "CONFLICT",
        "Belum ada instruksi transfer manual. Muat ulang halaman pembayaran.",
      );
    }

    const fileName = buildProofFileName({
      orderNumber,
      mimeType: file.type as ProofMimeType,
    });

    const uploadDir = path.join(process.cwd(), "public", "uploads", "proofs");
    await mkdir(uploadDir, { recursive: true });

    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, fileName), bytes);

    const proofImageUrl = buildProofPublicUrl(fileName);

    await db.payment.update({ where: { id: payment.id }, data: { proofImageUrl } });

    return jsonOk({ paymentId: payment.id, orderNumber, proofImageUrl }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
