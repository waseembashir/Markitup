"use client";

import { useEffect, useRef } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { refreshPins } from "@/app/app/mockups/[mockupId]/actions";
import type { ViewerPin } from "./MockupViewer";
import { reportIssue } from "@/lib/observability";

// Keeps a viewer's pins in step with everyone else looking at the same file.
//
// The shape here is "notify, then ask", not "apply the payload". A
// postgres_changes payload carries raw columns: no author name, no signed
// attachment URL, no sanitized body. Rendering from it would mean a second copy
// of the page's mapping living in the browser, and the way that copy would drift
// is by quietly dropping sanitization. So an event only means "something moved",
// and the server is asked what the file looks like now.
//
// Comments cannot be filtered server-side by mockup: they belong to a pin, and
// realtime filters are a single column comparison. The subscription is therefore
// scoped by RLS alone — a viewer receives comment events for anything they could
// already read — and events for other files are ignored here. That is a few
// wasted wake-ups for someone with many open projects, not a leak.
const SETTLE_MS = 400;

export function useLivePins(
  mockupId: string,
  setPins: (update: (current: ViewerPin[]) => ViewerPin[]) => void,
) {
  // The callback is re-created on every render; a ref keeps the subscription
  // from being torn down and rebuilt each time.
  const setPinsRef = useRef(setPins);
  useEffect(() => {
    setPinsRef.current = setPins;
  });

  useEffect(() => {
    if (!mockupId) return;

    // Live updates are an enhancement. If the client cannot be built — no keys
    // configured, as in tests — the viewer must still work, just without them.
    let supabase: ReturnType<typeof createBrowserSupabase>;
    try {
      supabase = createBrowserSupabase();
    } catch (e) {
      if (process.env.NODE_ENV !== "production") console.debug("[live] no supabase client", e);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    // Pin ids belonging to this file, so a comment event can be judged relevant
    // without a round trip. Seeded on the first refresh.
    const knownPins = new Set<string>();

    async function pull() {
      if (cancelled) return;
      const { pins } = await refreshPins(mockupId);
      if (cancelled || !pins) return;
      knownPins.clear();
      for (const p of pins) knownPins.add(p.id);
      setPinsRef.current((current) => {
        // Anything still mid-flight locally is kept: an optimistic pin has a
        // temporary id until the insert returns, and the server does not know
        // about it yet. Dropping those would make a comment vanish under the
        // author as they typed it.
        const pending = current.filter((p) => p.id.startsWith("tmp-"));
        return pending.length ? [...pins, ...pending] : pins;
      });
    }

    // A burst — someone dropping a pin and its first comment — is two events
    // about one change. Coalesce them into a single fetch.
    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(pull, SETTLE_MS);
    }

    // The realtime socket authenticates separately from the REST client, and it
    // must carry the user's token BEFORE the channel joins. This client reads
    // its session from cookies asynchronously, so subscribing straight away
    // opens the socket anonymously; RLS then filters out every row the
    // subscription would have carried. The channel still reports SUBSCRIBED and
    // simply delivers nothing, which is the most misleading way this can fail —
    // hence waiting for the session rather than setting the token alongside.
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      await supabase.realtime.setAuth(data.session?.access_token ?? null);

      channel = supabase
        .channel(`mockup:${mockupId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pins", filter: `mockup_id=eq.${mockupId}` },
          schedule,
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, (payload) => {
          // Only react to comments on this file. On a DELETE the payload carries
          // just the primary key, so pin_id is unknown — refresh rather than guess.
          const row = (payload.new ?? payload.old) as { pin_id?: string } | null;
          const pinId = row?.pin_id;
          if (pinId && !knownPins.has(pinId)) return;
          schedule();
        })
        .subscribe((status, err) => {
          if (process.env.NODE_ENV !== "production") console.debug("[live] channel", status, err ?? "");
          // A channel that never connects is the failure mode with no symptom:
          // the viewer keeps working, comments simply stop appearing, and nobody
          // finds out until two people compare what they can see.
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            reportIssue(`Live updates unavailable on a mockup (${status})`, {
              mockupId,
              reason: err ? String(err) : undefined,
            });
          }
        });
    })();

    // Seed knownPins so the very first comment event can be judged.
    pull();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [mockupId]);
}
