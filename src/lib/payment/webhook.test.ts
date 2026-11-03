import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeMidtransSignature,
  extractOrderNumber,
  mapTransactionToPaymentStatus,
  midtransNotificationSchema,
  verifyMidtransSignature,
} from "./webhook";

const SERVER_KEY = "SB-Mid-server-TESTKEY";
const SIGNATURE_INPUT = {
  orderId: "ORD-0001-1700000000000",
  statusCode: "200",
  grossAmount: "140910.00",
  serverKey: SERVER_KEY,
};

describe("computeMidtransSignature", () => {
  it("menghasilkan SHA-512 hex 128 karakter", () => {
    const signature = computeMidtransSignature(SIGNATURE_INPUT);
    assert.match(signature, /^[0-9a-f]{128}$/);
  });

  it("deterministik", () => {
    assert.equal(
      computeMidtransSignature(SIGNATURE_INPUT),
      computeMidtransSignature(SIGNATURE_INPUT),
    );
  });
});

describe("verifyMidtransSignature", () => {
  const validSignature = computeMidtransSignature(SIGNATURE_INPUT);

  it("menerima signature yang cocok", () => {
    assert.equal(
      verifyMidtransSignature({ ...SIGNATURE_INPUT, signatureKey: validSignature }),
      true,
    );
  });

  it("menolak signature yang salah", () => {
    const tampered = `${validSignature.slice(0, -1)}0`;
    assert.equal(verifyMidtransSignature({ ...SIGNATURE_INPUT, signatureKey: tampered }), false);
  });

  it("menolak nilai yang bukan hex atau server key kosong", () => {
    assert.equal(verifyMidtransSignature({ ...SIGNATURE_INPUT, signatureKey: "bukan-hex" }), false);
    assert.equal(verifyMidtransSignature({ ...SIGNATURE_INPUT, signatureKey: validSignature, serverKey: "" }), false);
  });

  it("menolak bila nominal/status diubah", () => {
    assert.equal(
      verifyMidtransSignature({
        ...SIGNATURE_INPUT,
        grossAmount: "1.00",
        signatureKey: validSignature,
      }),
      false,
    );
  });
});

describe("mapTransactionToPaymentStatus", () => {
  it("memetakan settlement & capture accept ke PAID", () => {
    assert.equal(mapTransactionToPaymentStatus({ transactionStatus: "settlement" }), "PAID");
    assert.equal(
      mapTransactionToPaymentStatus({ transactionStatus: "capture", fraudStatus: "accept" }),
      "PAID",
    );
  });

  it("memetakan capture challenge ke PENDING dan capture deny ke FAILED", () => {
    assert.equal(
      mapTransactionToPaymentStatus({ transactionStatus: "capture", fraudStatus: "challenge" }),
      "PENDING",
    );
    assert.equal(
      mapTransactionToPaymentStatus({ transactionStatus: "capture", fraudStatus: "deny" }),
      "FAILED",
    );
  });

  it("memetakan status gagal & kedaluwarsa", () => {
    assert.equal(mapTransactionToPaymentStatus({ transactionStatus: "deny" }), "FAILED");
    assert.equal(mapTransactionToPaymentStatus({ transactionStatus: "cancel" }), "FAILED");
    assert.equal(mapTransactionToPaymentStatus({ transactionStatus: "failure" }), "FAILED");
    assert.equal(mapTransactionToPaymentStatus({ transactionStatus: "expire" }), "EXPIRED");
  });

  it("memetakan refund", () => {
    assert.equal(mapTransactionToPaymentStatus({ transactionStatus: "refund" }), "REFUNDED");
    assert.equal(mapTransactionToPaymentStatus({ transactionStatus: "partial_refund" }), "REFUNDED");
  });

  it("memetakan pending ke PENDING", () => {
    assert.equal(mapTransactionToPaymentStatus({ transactionStatus: "pending" }), "PENDING");
  });
});

describe("extractOrderNumber", () => {
  it("mengambil nomor pesanan dari order_id bertimestamp", () => {
    assert.equal(extractOrderNumber("ORD-0001-1700000000000"), "ORD-0001");
  });

  it("mendukung nomor pesanan yang mengandung tanda hubung", () => {
    assert.equal(extractOrderNumber("ORD-2026-0001-1700000000000"), "ORD-2026-0001");
  });

  it("menerima order_id tanpa timestamp", () => {
    assert.equal(extractOrderNumber("ORD-0007"), "ORD-0007");
  });

  it("menolak order_id kosong atau aneh", () => {
    assert.equal(extractOrderNumber(""), null);
    assert.equal(extractOrderNumber("--"), null);
    assert.equal(extractOrderNumber("ORD 0001"), null);
  });
});

describe("midtransNotificationSchema", () => {
  const validPayload = {
    order_id: "ORD-0001-1700000000000",
    status_code: "200",
    gross_amount: "140910.00",
    signature_key: "a".repeat(128),
    transaction_status: "settlement",
    fraud_status: "accept",
    payment_type: "qris",
    transaction_id: "tx-1",
    // field tambahan dari gateway harus diizinkan
    currency: "IDR",
    merchant_id: "M123",
  };

  it("menerima payload valid beserta field tambahan", () => {
    const parsed = midtransNotificationSchema.safeParse(validPayload);
    assert.equal(parsed.success, true);
  });

  it("menolak payload tanpa signature", () => {
    const withoutSignature: Record<string, unknown> = { ...validPayload };
    delete withoutSignature.signature_key;

    const parsed = midtransNotificationSchema.safeParse(withoutSignature);
    assert.equal(parsed.success, false);
  });

  it("menolak transaction_status tak dikenal", () => {
    const parsed = midtransNotificationSchema.safeParse({
      ...validPayload,
      transaction_status: "unknown",
    });
    assert.equal(parsed.success, false);
  });
});
