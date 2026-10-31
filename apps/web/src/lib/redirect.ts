/**
 * Only allow redirects to our own pages. Blocks open redirects such as
 * "https://evil.com", "//evil.com" and "/\evil.com" (browsers treat "\" like "/").
 */
export function safeRedirect(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("/login") || value.startsWith("/signup")) return fallback;
  return value;
}
