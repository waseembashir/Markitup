import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import { Landing } from "@/components/landing/Landing";

// Display serif for the marketing page only; the app keeps Inter throughout.
const serif = Instrument_Serif({
  variable: "--font-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const title = "MarkItUp by Apexure · Feedback pinned to the design";
const description =
  "Clients click anywhere on your design to leave a comment. Pinned, threaded feedback on images, live HTML and Figma frames, with no account needed to comment.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website", siteName: "MarkItUp by Apexure" },
  twitter: { card: "summary_large_image", title, description },
};

// Static on purpose: signed-in visitors are sent to /app by the proxy
// (lib/supabase/middleware.ts), so this page never reads the session.
export default function Home() {
  return <Landing fontClass={serif.variable} />;
}
