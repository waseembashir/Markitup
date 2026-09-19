import "./landing.css";
import "./hero.css";
import "./sections.css";
import "./compare.css";
import "./features.css";
import "./showcase.css";
import "./details.css";
import "./footer.css";
import { SmoothScroll } from "./SmoothScroll";
import { Ribbon } from "./Ribbon";
import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { FormatBand } from "./FormatBand";
import { BeforeAfter } from "./BeforeAfter";
import { HowItWorks } from "./HowItWorks";
import { Features } from "./Features";
import { Versions } from "./Versions";
import { Details } from "./Details";
import { Extras } from "./Extras";
import { Testimonials } from "./Testimonials";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { Footer } from "./Footer";

// The marketing page at "/". Server-rendered and static; only the animated
// sections are client components.
export function Landing({ fontClass }: { fontClass: string }) {
  return (
    <div className={`landing ${fontClass}`}>
      <SmoothScroll />
      <Nav />
      <main>
        <Hero />
        <FormatBand />
        <BeforeAfter />
        {/* One ribbon drawn across all three sections as you scroll through
            them, rather than a shape per section. */}
        <div className="lp-flow">
          <Ribbon
            className="lp-ribbon-flow"
            viewBox="0 0 1440 6900"
            fit="none"
            drift={0}
            end="bottom 60%"
            d="M 1320 -120 C 1380 700, 980 1020, 760 1560 C 540 2100, 300 2420, 360 3060 C 420 3700, 980 3860, 1120 4420 C 1260 4980, 1120 5380, 820 5760 C 520 6140, 240 6360, 300 7020"
          />
          <HowItWorks />
          <Features />
          <Versions />
        </div>
        <Details />
        <Extras />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
