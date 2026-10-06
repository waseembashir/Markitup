import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createReporterStripper, HEIGHT_REPORTER_SCRIPT } from "@/lib/html-embed";
import { reportError } from "@/lib/observability";

export const dynamic = "force-dynamic";

/**
 * An uploaded HTML design, served as a page the browser can render.
 *
 * It used to be fetched in the browser as one string and handed to the frame as
 * srcdoc. That works until a page is heavy: one of these is 8.2 MB, 99% of it
 * base64 images, and pulling that through JavaScript meant nothing appeared
 * until every byte had arrived — past a timeout it showed an error with no pin
 * layer behind it, so the file could not be commented on at all.
 *
 * Streaming it from here instead lets the browser lay the page out as it
 * arrives, the way it would any other page, and the frame is usable long before
 * the last image lands.
 *
 * Storage cannot do this itself: it serves these files as text/plain whatever
 * they were stored as, so an iframe pointed at the signed URL shows source.
 */

// The capabilities the viewer's iframe already grants, repeated as a header so
// they hold even if someone opens this URL in a tab of their own. Without
// allow-same-origin the document gets an opaque origin: a client's uploaded
// page can run its own scripts, and can touch nothing of ours.
const SANDBOX =
  "sandbox allow-scripts allow-popups allow-forms allow-modals allow-popups-to-escape-sandbox allow-pointer-lock";

function page(status: number, message: string) {
  const body = `<!doctype html><meta charset="utf-8"><style>
    html{height:100%}body{margin:0;height:100%;display:grid;place-items:center;
    font:500 14px/1.5 system-ui,sans-serif;color:#6b7280;background:#fafaf9;text-align:center;padding:0 24px}
  </style><p>${message}</p>`;
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": SANDBOX,
      "cache-control": "no-store",
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ mockupId: string }> }) {
  const { mockupId } = await params;
  // Compare draws no pins and nothing there listens for what the reporter
  // posts, so it asks for the page without one.
  const bare = req.nextUrl.searchParams.get("bare") === "1";

  try {
    const supabase = await createServerSupabase();

    // No access check of its own: the row is only visible through RLS to
    // someone who can already open this file, which is the same rule that
    // decides whether they can see the design at all.
    const { data: mockup } = await supabase
      .from("mockups")
      .select("file_path, type")
      .eq("id", mockupId)
      .maybeSingle();
    if (!mockup || mockup.type !== "html") return page(404, "This design isn’t available.");

    const { data: signed } = await supabase.storage
      .from("mockups")
      .createSignedUrl(mockup.file_path as string, 60 * 10);
    if (!signed?.signedUrl) return page(404, "This design isn’t available.");

    const upstream = await fetch(signed.signedUrl);
    if (!upstream.ok || !upstream.body) {
      return page(502, "This design couldn’t be loaded. Please refresh the page.");
    }

    // Drop the reporter the uploader injected and append the current one, so a
    // file uploaded months ago still speaks today's protocol — that is what
    // keeps comment mode working on older designs.
    const stripper = createReporterStripper();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const transform = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        const out = stripper.push(decoder.decode(chunk, { stream: true }));
        if (out) controller.enqueue(encoder.encode(out));
      },
      flush(controller) {
        const tail = stripper.push(decoder.decode()) + stripper.flush();
        // A script after </body> is parsed into the body and runs, so the
        // reporter can go on the end and the stream never has to look ahead.
        const out = bare ? tail : tail + HEIGHT_REPORTER_SCRIPT;
        if (out) controller.enqueue(encoder.encode(out));
      },
    });

    return new Response(upstream.body.pipeThrough(transform), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": SANDBOX,
        "x-content-type-options": "nosniff",
        // Replacing a file keeps its id, so a cached copy would show the design
        // that was replaced.
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    reportError(e, { where: "mockup html route", mockupId });
    return page(500, "This design couldn’t be loaded. Please refresh the page.");
  }
}
