/**
 * Room ID Generator & Sanitizer for eco
 * Generates unique, memorable slugs like "eco-782a9f" or custom alphanumeric IDs.
 */

export function generateUniqueRoomId(prefix = "eco"): string {
  const randomHex = Math.random().toString(16).substring(2, 8);
  return `${prefix}-${randomHex}`;
}

export function sanitizeRoomId(raw?: string | null): string {
  if (!raw || typeof raw !== "string") return "";
  let clean = raw.trim();

  // Extract room from full URL or query string if pasted
  if (clean.includes("?room=") || clean.includes("&room=")) {
    const match = clean.match(/[?&]room=([^&?#\s]+)/i);
    if (match && match[1]) {
      clean = decodeURIComponent(match[1]).trim();
    }
  }

  clean = clean.replace(/^[/?#&]+/, "");
  if (clean.toLowerCase().startsWith("room=")) {
    clean = clean.slice(5);
  }

  // Strip query and hash
  clean = clean.split("?")[0].split("&")[0].split("#")[0].trim();
  // Strip leading/trailing slashes and convert spaces to dashes
  clean = clean.replace(/^[\/\s]+|[\/\s]+$/g, "").replace(/\s+/g, "-").toLowerCase();
  // Strip non-url-safe characters
  clean = clean.replace(/[^a-z0-9_-]/g, "");

  return clean;
}
