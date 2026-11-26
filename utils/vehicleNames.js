/**
 * Clean a vehicle name for display: strip accents, control characters and odd
 * symbols, then collapse whitespace.
 */
export function sanitizeVehicleName(name) {
  if (!name) return "";
  return String(name)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\p{C}/gu, "")
    .replace(/[^\p{L}\p{N}\s,.\-'()/:+&]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
