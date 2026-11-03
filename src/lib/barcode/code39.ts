/**
 * Generator barcode Code 39 (tanpa dependency).
 *
 * Code 39 dipilih karena sederhana & mudah dipindai: 9 elemen per karakter
 * (5 bar + 4 spasi), 3 di antaranya lebar. Setiap karakter diapit start/stop `*`.
 *
 * Representasi pola: 9 digit `0`/`1` — `1` = elemen lebar (3 modul),
 * `0` = elemen sempit (1 modul). Elemen pertama selalu bar.
 */

export const CODE39_PATTERNS: Record<string, string> = {
  "0": "000110100",
  "1": "100100001",
  "2": "001100001",
  "3": "101100000",
  "4": "000110001",
  "5": "100110000",
  "6": "001110000",
  "7": "000100101",
  "8": "100100100",
  "9": "001100100",
  A: "100001001",
  B: "001001001",
  C: "101001000",
  D: "000011001",
  E: "100011000",
  F: "001011000",
  G: "000001101",
  H: "100001100",
  I: "001001100",
  J: "000011100",
  K: "100000011",
  L: "001000011",
  M: "101000010",
  N: "000010011",
  O: "100010010",
  P: "001010010",
  Q: "000000111",
  R: "100000110",
  S: "001000110",
  T: "000010110",
  U: "110000001",
  V: "011000001",
  W: "111000000",
  X: "010010001",
  Y: "110010000",
  Z: "011010000",
  "-": "010000101",
  ".": "110000100",
  " ": "011000100",
  $: "010101000",
  "/": "010100010",
  "+": "010001010",
  "%": "000101010",
  "*": "010010100",
};

const START_STOP = "*";
const WIDE_MODULES = 3;
const NARROW_MODULES = 1;
const ELEMENTS_PER_CHARACTER = 9;

export function normalizeCode39(text: string): string {
  return text.toUpperCase();
}

export function isEncodableCode39(text: string): boolean {
  const normalized = normalizeCode39(text);

  if (normalized.length === 0) {
    return false;
  }

  return [...normalized].every((character) => character in CODE39_PATTERNS);
}

export class Code39Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Code39Error";
  }
}

/**
 * Mengubah teks menjadi deret modul biner (`1` = bar, `0` = spasi).
 * Karakter antar-karakter memakai satu modul spasi sempit.
 */
export function encodeCode39(text: string): string {
  const normalized = normalizeCode39(text);

  if (!isEncodableCode39(normalized)) {
    throw new Code39Error(
      "Teks mengandung karakter yang tidak didukung Code 39 (hanya 0-9, A-Z, -, ., spasi, $, /, +, %).",
    );
  }

  const characters = [START_STOP, ...normalized, START_STOP];
  const modules: string[] = [];

  characters.forEach((character, characterIndex) => {
    const pattern = CODE39_PATTERNS[character];

    if (!pattern) {
      throw new Code39Error(`Pola Code 39 untuk "${character}" tidak tersedia.`);
    }

    for (let element = 0; element < ELEMENTS_PER_CHARACTER; element += 1) {
      const isWide = pattern[element] === "1";
      const isBar = element % 2 === 0;
      const width = isWide ? WIDE_MODULES : NARROW_MODULES;

      modules.push((isBar ? "1" : "0").repeat(width));
    }

    if (characterIndex < characters.length - 1) {
      modules.push("0");
    }
  });

  return modules.join("");
}

export interface BarcodeBar {
  /** Posisi awal bar dalam modul. */
  x: number;
  /** Lebar bar dalam modul. */
  width: number;
}

/** Mengubah deret modul biner menjadi daftar bar untuk digambar sebagai SVG. */
export function toBars(binary: string): BarcodeBar[] {
  const bars: BarcodeBar[] = [];
  let index = 0;

  while (index < binary.length) {
    if (binary[index] !== "1") {
      index += 1;
      continue;
    }

    const start = index;

    while (index < binary.length && binary[index] === "1") {
      index += 1;
    }

    bars.push({ x: start, width: index - start });
  }

  return bars;
}
