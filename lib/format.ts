// Compact relative time, e.g. "just now", "3h ago", "2d ago", "Mar 4".
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// Absolute local date + time, e.g. "Jul 16, 2026, 3:42 PM".
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// The local-part of an email address ("jane@x.com" -> "jane"), or "" if absent.
export function emailLocalPart(email: string): string {
  const at = (email ?? "").indexOf("@");
  return at > 0 ? email.slice(0, at) : "";
}

// Comment bodies are stored as sanitized HTML. Anywhere one is shown as plain
// text — a list preview, a search haystack — the markup has to come off first,
// or a line break renders as a literal "<br />" in the rail.
//
// Deliberately not lib/sanitize's htmlToPlainText: that pulls sanitize-html, a
// Node library, into the browser bundle. The input is already sanitized here, so
// this only has to undo the safe subset the editor produces.
export function htmlToText(html: string): string {
  return (html ?? "")
    // Breaks become spaces, so words either side don't run together.
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|blockquote)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    // &amp; last: decoding it first would turn "&amp;lt;" into a real "<".
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}
