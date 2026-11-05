import sanitizeHtml from "sanitize-html";

// Allow-list for user comment HTML. Everything else is stripped. This runs
// server-side at write time; rendered comment HTML is always this function's
// output, never raw user input.
const OPTS: sanitizeHtml.IOptions = {
  allowedTags: ["b", "strong", "i", "em", "u", "ul", "ol", "li", "a", "br", "p", "span"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    // Mention chips: <span class="mention" data-mention="<userId>">@Name</span>
    span: ["class", "data-mention"],
  },
  allowedClasses: { span: ["mention"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
};

// Turn bare URLs in text into clickable links, leaving anything already inside
// an <a> (or any other tag) untouched. Input is already-sanitized HTML; the
// output is sanitized AGAIN by the caller, so a hostile URL (e.g. one carrying
// a stray `"`) can never break out of the href attribute.
function linkifyHtml(html: string): string {
  return html
    .split(/(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>)/gi)
    .map((part) => {
      if (!part || part[0] === "<") return part; // a tag or whole anchor — leave it
      return part.replace(/\bhttps?:\/\/[^\s<]+/gi, (url) => {
        const trimmed = url.replace(/[.,!?)\]]+$/, ""); // drop trailing sentence punctuation
        const trail = url.slice(trimmed.length);
        return `<a href="${trimmed}" target="_blank" rel="noopener noreferrer">${trimmed}</a>${trail}`;
      });
    })
    .join("");
}

export function sanitizeCommentHtml(dirty: string): string {
  const clean = sanitizeHtml(dirty ?? "", OPTS);
  // Second pass re-enforces the allow-list on the links we just injected.
  return sanitizeHtml(linkifyHtml(clean), OPTS);
}

// User ids of everyone @mentioned in a (sanitized) comment body.
export function mentionedUserIds(html: string): string[] {
  const ids = new Set<string>();
  for (const m of (html ?? "").matchAll(/data-mention="([^"]+)"/g)) ids.add(m[1]);
  return [...ids];
}

// Strip all HTML, leaving only the text content. Used for plain-text contexts
// (e.g. notification email bodies) where rendered tags would show as literal
// markup.
export function htmlToPlainText(html: string): string {
  return sanitizeHtml(html ?? "", { allowedTags: [], allowedAttributes: {} });
}
