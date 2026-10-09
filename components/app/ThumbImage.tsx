"use client";

import { useState } from "react";
import { drawThumb, saveThumb } from "@/lib/thumbs-client";

// Files whose preview this tab has already tried to make, so a re-render or a
// second card for the same file doesn't make it twice.
const attempted = new Set<string>();

// A card cover. Shows the small preview when there is one. When there isn't
// (a file uploaded before previews existed), or it fails to load (just
// removed by a Figma re-sync), shows the original instead and, once that has
// loaded, makes the preview from it — so nobody downloads the original for a
// card again. Pass `filePath` only for someone allowed to store files in the
// project; without it the card just shows the original.
export function ThumbImage({
  url,
  thumbUrl,
  filePath,
  className = "",
}: {
  url: string;
  thumbUrl?: string;
  filePath?: string;
  className?: string;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const showingThumb = !!thumbUrl && !thumbFailed;
  const makeOne = !showingThumb && !!filePath;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      // A new src means a different image, not an updated one.
      key={showingThumb ? "thumb" : "original"}
      src={showingThumb ? thumbUrl : url}
      alt=""
      loading="lazy"
      decoding="async"
      // Reading the pixels back needs a CORS fetch; storage allows it.
      crossOrigin={makeOne ? "anonymous" : undefined}
      onError={showingThumb ? () => setThumbFailed(true) : undefined}
      onLoad={
        makeOne
          ? (e) => {
              if (attempted.has(filePath!)) return;
              attempted.add(filePath!);
              drawThumb(e.currentTarget).then((blob) => saveThumb(filePath!, blob));
            }
          : undefined
      }
      className={className}
    />
  );
}
