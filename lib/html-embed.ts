// Shared contract for rendering uploaded HTML mockups in a sandboxed iframe.
//
// The iframe is sandboxed WITHOUT allow-same-origin, so the parent cannot read
// the (cross-origin, opaque) document's height to lay pins over it. Instead we
// inject a tiny reporter into the uploaded file that postMessages its own
// scrollHeight to the parent; the viewer sizes the frame to that height so the
// whole page lays out (no inner scroll) and pin coordinates stay aligned.
//
// The reporter itself lives in ./html-reporter — it outgrew being a string in
// the middle of this file.
import { reporterSource } from "./html-reporter";
import { HTML_HEIGHT_MESSAGE } from "./html-messages";

export {
  HTML_HEIGHT_MESSAGE,
  HTML_SCROLL_MESSAGE,
  HTML_SCROLLBY_MESSAGE,
  HTML_MODE_MESSAGE,
  HTML_POINTER_MESSAGE,
  HTML_READY_MESSAGE,
} from "./html-messages";

const REPORTER = `<script>${reporterSource()}</script>`;

// The reporter itself, for callers that splice it into a document they are
// streaming rather than holding in one string.
export const HEIGHT_REPORTER_SCRIPT = REPORTER;

/**
 * Put the reporter at the top of <head>, before anything the page runs.
 *
 * It used to go in last, before </body>, which is the natural place for a
 * script that only measures. It has to go first now: a page that writes its own
 * content into a nested <iframe srcdoc> — which is what an export bundle does —
 * must find the reporter's hook already installed when it does, or the client
 * ends up clicking at a document the reporter never reached.
 */
export function injectHeightReporter(html: string): string {
  const at = reporterInsertionPoint(html, true);
  return html.slice(0, at ?? 0) + REPORTER + html.slice(at ?? 0);
}

// Remove any previously-injected reporter so we can re-inject the current one
// (lets already-uploaded mockups pick up measurement fixes at view time).
// The tempered `(?:(?!</script>)[\s\S])*?` tokens stop at the first </script>,
// so we only ever remove the single reporter script — never other page scripts
// or the markup between them.
export function stripHeightReporter(html: string): string {
  return html.replace(
    /<script\b[^>]*>(?:(?!<\/script>)[\s\S])*?markitup:height(?:(?!<\/script>)[\s\S])*?<\/script>/gi,
    "",
  );
}

/**
 * Where the reporter goes in a document whose opening is in hand: just past
 * <head>, else just past the doctype, so nothing is pushed in front of it and
 * the document cannot fall into quirks mode.
 *
 * Returns null while the answer is still ambiguous — a <head> may yet arrive —
 * which only a caller streaming the document can act on. `settled` says that
 * waiting longer will not help.
 */
export function reporterInsertionPoint(start: string, settled: boolean): number | null {
  const head = /<head[^>]*>/i.exec(start);
  if (head) return head.index + head[0].length;
  const doctype = /<!doctype[^>]*>/i.exec(start);
  const after = doctype ? doctype.index + doctype[0].length : 0;
  // Content of any kind means no <head> is coming.
  if (settled || /<body[\s>]|<html[^>]*>\s*\S/i.test(start)) return after;
  return null;
}

/**
 * stripHeightReporter, for a document arriving in pieces.
 *
 * An uploaded page can be several megabytes — one of ours is 99% base64 images
 * — and reading all of it before sending any of it is what made a big file
 * unopenable. The route streams instead, so the stale reporter has to be found
 * across chunk boundaries without holding the document in memory.
 *
 * Only a `<script>` containing the height message is dropped; the page's own
 * scripts pass through untouched, in order. The buffer holds nothing but the
 * script currently being examined, so a page made of images never buffers.
 */
export function createReporterStripper() {
  const OPEN = /<script\b/gi;
  const CLOSE = /<\/script\s*>/gi;
  // The longest prefix of "<script" that could be split across a chunk.
  const PARTIAL = "<script".length - 1;
  let buf = "";

  return {
    /** Feed the next piece; returns what is safe to send on. */
    push(text: string): string {
      buf += text;
      let out = "";
      for (;;) {
        OPEN.lastIndex = 0;
        const open = OPEN.exec(buf);
        if (!open) {
          // Hold back only enough to catch a "<script" split down the middle.
          const keep = Math.min(buf.length, PARTIAL);
          out += buf.slice(0, buf.length - keep);
          buf = buf.slice(buf.length - keep);
          return out;
        }
        CLOSE.lastIndex = open.index;
        const close = CLOSE.exec(buf);
        if (!close) {
          // The script has not finished arriving. Send what precedes it.
          out += buf.slice(0, open.index);
          buf = buf.slice(open.index);
          return out;
        }
        const end = close.index + close[0].length;
        const script = buf.slice(open.index, end);
        out += buf.slice(0, open.index);
        if (!script.includes(HTML_HEIGHT_MESSAGE)) out += script;
        buf = buf.slice(end);
      }
    },
    /** Whatever is still held back, once the document has ended. */
    flush(): string {
      const rest = buf;
      buf = "";
      return rest;
    },
  };
}
