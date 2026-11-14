// src/lib/classCode.ts — 4-character class codes (docs/plan/02 §6.4).
// No 0/O, 1/I/L so a judge can read it off a screen. Works on the server and in the browser.
export const CLASS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_RE = new RegExp(`^[${CLASS_CODE_ALPHABET}]{4}$`);

export function newClassCode(): string {
  const bytes = new Uint32Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CLASS_CODE_ALPHABET[b % CLASS_CODE_ALPHABET.length]).join("");
}

/** Accepts lowercase input from a typed URL, e.g. /live/k7qf. */
export function normalizeClassCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}
