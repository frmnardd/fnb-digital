import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildProofFileName,
  buildProofPublicUrl,
  buildTransferInstruction,
  MANUAL_TRANSFER_ACCOUNTS,
  PROOF_MAX_BYTES,
  validateProofDescriptor,
} from "./manual-transfer";

describe("buildTransferInstruction", () => {
  it("mengembalikan rekening, nominal, dan kode unik", () => {
    const instruction = buildTransferInstruction({
      orderNumber: "ORD-0010",
      amount: 140910,
      uniqueCode: 321,
    });

    assert.equal(instruction.accounts.length, MANUAL_TRANSFER_ACCOUNTS.length);
    assert.equal(instruction.amount, 140910);
    assert.equal(instruction.uniqueCode, 321);
    assert.equal(instruction.orderNumber, "ORD-0010");
  });

  it("mendukung daftar rekening kustom", () => {
    const instruction = buildTransferInstruction({
      orderNumber: "ORD-0011",
      amount: 50000,
      uniqueCode: 0,
      accounts: [{ bank: "BCA", accountNumber: "111", accountHolder: "Merchant" }],
    });

    assert.equal(instruction.accounts[0]?.accountNumber, "111");
  });

  it("menolak nominal tidak valid", () => {
    assert.throws(
      () => buildTransferInstruction({ orderNumber: "ORD-1", amount: 0, uniqueCode: 0 }),
      /Nominal/,
    );
    assert.throws(
      () => buildTransferInstruction({ orderNumber: "ORD-1", amount: 1000.5, uniqueCode: 0 }),
      /Nominal/,
    );
  });

  it("menolak kode unik di luar 0–999", () => {
    assert.throws(
      () => buildTransferInstruction({ orderNumber: "ORD-1", amount: 1000, uniqueCode: 1000 }),
      /Kode unik/,
    );
  });
});

describe("validateProofDescriptor", () => {
  it("menerima JPG/PNG/WEBP/PDF di bawah 2 MB", () => {
    for (const mimeType of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
      assert.equal(
        validateProofDescriptor({ fileName: "bukti.png", size: 1024, mimeType }).valid,
        true,
      );
    }
  });

  it("menolak MIME yang tidak diizinkan", () => {
    const result = validateProofDescriptor({
      fileName: "evil.exe",
      size: 1024,
      mimeType: "application/x-msdownload",
    });

    assert.equal(result.valid, false);
    assert.match(result.error ?? "", /JPG, PNG, WEBP, atau PDF/);
  });

  it("menolak file kosong", () => {
    assert.equal(
      validateProofDescriptor({ fileName: "a.png", size: 0, mimeType: "image/png" }).valid,
      false,
    );
  });

  it("menolak file melebihi 2 MB", () => {
    const result = validateProofDescriptor({
      fileName: "besar.png",
      size: PROOF_MAX_BYTES + 1,
      mimeType: "image/png",
    });

    assert.equal(result.valid, false);
    assert.match(result.error ?? "", /2 MB/);
  });
});

describe("buildProofFileName", () => {
  it("memakai ekstensi sesuai MIME, bukan nama asli", () => {
    const name = buildProofFileName({
      orderNumber: "ORD-0007",
      mimeType: "image/png",
      timestamp: 1700000000000,
    });

    assert.equal(name, "ORD-0007-1700000000000.png");
  });

  it("membersihkan karakter berbahaya pada nomor pesanan", () => {
    const name = buildProofFileName({
      orderNumber: "../../etc/passwd",
      mimeType: "application/pdf",
      timestamp: 1,
    });

    assert.equal(name, "etcpasswd-1.pdf");
    assert.equal(name.includes("/"), false);
    assert.equal(name.includes(".."), false);
  });

  it("membangun URL publik yang benar", () => {
    assert.equal(buildProofPublicUrl("ORD-0007-1.png"), "/uploads/proofs/ORD-0007-1.png");
  });
});
