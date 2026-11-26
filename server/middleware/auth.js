import crypto from "crypto";

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest();

/**
 * Protects everything that changes data (POST / PUT / DELETE) with a shared
 * token. Viewing (GET) stays open.
 *
 * Set ADMIN_TOKEN in .env to turn it on. The website asks for the token the
 * first time you save something and remembers it in your browser.
 * If ADMIN_TOKEN is not set, editing is open to anyone who can reach the site.
 */
export function requireAdminForWrites(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) return next();

  const provided = req.get("x-admin-token") || "";
  // Compare hashes so the check takes the same time however close the guess is
  if (crypto.timingSafeEqual(sha256(provided), sha256(expected))) return next();

  res.status(401).json({ error: "Unauthorized" });
}
