/** Unambiguous alphabet (no 0/O/1/I) for human-readable references. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomFrom(alphabet: string, length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Booking reference, e.g. OCT-7KX4M2 */
export function generateBookingReference(): string {
  return `OCT-${randomFrom(ALPHABET, 6)}`;
}

/** Referral code, e.g. OMAN-4F8K */
export function generateReferralCode(): string {
  return `OMAN-${randomFrom(ALPHABET, 4)}`;
}

/** Opaque URL-safe token (voucher, payment link, newsletter). */
export function generateToken(length = 32): string {
  return randomFrom("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", length);
}

/** Session key for anonymous visitors (booking drafts, chat). */
export function generateSessionKey(): string {
  return `s_${randomFrom("abcdefghijklmnopqrstuvwxyz0123456789", 24)}`;
}
