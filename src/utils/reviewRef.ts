/**
 * Converts a UUID into a human-readable ARB reference: ARB-YYYY-NNNN
 *
 * The 4-digit suffix is deterministically derived from the UUID so the same
 * review always gets the same reference — in list views, detail views, and PDFs.
 *
 * YYYY comes from the review's creation year (or current year as fallback).
 * NNNN is (first-8-hex-chars % 9000) + 1000, giving a stable 1000–9999 range.
 */
export function toARBRef(id: string, createdAt?: string): string {
  const hex = id.replace(/-/g, '')
  const num = (parseInt(hex.substring(0, 8), 16) % 9000) + 1000
  const year = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear()
  return `ARB-${year}-${num}`
}
