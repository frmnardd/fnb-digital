import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError, jsonOk } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * POST /api/runner/calls/[callId]/resolve
 *
 * Menangani panggilan pelayan: `ACKNOWLEDGE` (diterima) atau `RESOLVE` (selesai).
 *
 * TODO(RBAC): lindungi endpoint ini setelah modul autentikasi staf dibuat.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

const bodySchema = z.object({ action: z.enum(["ACKNOWLEDGE", "RESOLVE"]) }).strict();

type RouteContext = { params: Promise<{ callId: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    getServerEnv();

    const { callId } = await context.params;

    if (!ID_PATTERN.test(callId)) {
      throw new ApiError("BAD_REQUEST", "ID panggilan tidak valid.");
    }

    const input = bodySchema.parse(await readJsonBody(request));

    const call = await db.waiterCall.findUnique({
      where: { id: callId },
      select: { id: true, status: true },
    });

    if (!call) {
      throw new ApiError("NOT_FOUND", "Panggilan meja tidak ditemukan.");
    }

    if (call.status === "RESOLVED") {
      throw new ApiError("CONFLICT", "Panggilan sudah diselesaikan.");
    }

    const now = new Date();

    const updated = await db.waiterCall.update({
      where: { id: call.id },
      data:
        input.action === "ACKNOWLEDGE"
          ? { status: "ACKNOWLEDGED", acknowledgedAt: now }
          : { status: "RESOLVED", resolvedAt: now, acknowledgedAt: now },
      select: { id: true, status: true, acknowledgedAt: true, resolvedAt: true },
    });

    return jsonOk({ call: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
