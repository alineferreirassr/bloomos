/**
 * Real content checksums (SHA-256 over actual file bytes via Web Crypto),
 * unlike the Documents module's older `calculateMockChecksum` (a djb2 hash
 * of just the file name + size, since that module never had real bytes to
 * hash). `crypto.subtle` is available in both the browser and Node's
 * `globalThis.crypto`, so this works unchanged in mock and Supabase mode.
 */
export async function calculateChecksum(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}
