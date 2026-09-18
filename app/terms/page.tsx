import type { Metadata } from "next";
import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import "@/components/landing/landing.css";
import "@/components/landing/footer.css";
import { Footer } from "@/components/landing/Footer";
import { Mark } from "@/components/landing/icons";

const serif = Instrument_Serif({
  variable: "--font-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Terms and conditions · MarkItUp by Apexure",
  description: "Terms and conditions for MarkItUp by Apexure.",
};

// Interim page: there are no published terms yet (Apexure's site has a privacy
// policy but no terms). This says so plainly rather than inventing legal text.
// Replace the body with the real terms once they exist.
export default function TermsPage() {
  return (
    <div className={`landing ${serif.variable}`}>
      <header className="lp-container flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2" aria-label="MarkItUp home">
          <Mark className="h-7 w-6" />
          <span className="text-[1.0625rem] font-bold tracking-tight">MarkItUp</span>
        </Link>
        <Link href="/signup" className="lp-btn lp-btn-primary lp-btn-sm">
          Start free
        </Link>
      </header>
      <main className="lp-container max-w-[44rem] py-24">
        <p className="lp-eyebrow">Legal</p>
        <h1 className="lp-serif lp-h2 mt-5">
          Terms and <em>conditions</em>
        </h1>
        <div className="lp-lede mt-8 space-y-5">
          <p>MarkItUp’s terms of service are being finalised and will be published on this page.</p>
          <p>
            Until then, if you have a question about using MarkItUp, email{" "}
            <a className="underline underline-offset-4" href="mailto:info@apexure.com">
              info@apexure.com
            </a>
            .
          </p>
          <p>
            How personal data is handled is covered by{" "}
            <a
              className="underline underline-offset-4"
              href="https://www.apexure.com/privacy/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Apexure’s privacy policy
            </a>
            .
          </p>
        </div>
      </main>
      <Footer base="/" />
    </div>
  );
}
