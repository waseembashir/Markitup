import "./landing.css";
import "./hero.css";
import "./sections.css";
import "./compare.css";
import "./features.css";
import "./showcase.css";
import "./details.css";
import "./pricing.css";
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
import { Pricing } from "./Pricing";
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
        {/* One ribbon, drawn as you scroll: it comes in from the left at How
            it works and runs behind everything down to the testimonials. */}
        <div className="lp-flow">
          <Ribbon
            className="lp-ribbon-flow"
            viewBox="0 0 1440 6900"
            fit="none"
            drift={0}
            end="bottom 80%"
            d="M -200 140 C 340 300, 560 620, 900 900 C 1240 1180, 1520 1520, 1180 1900 C 840 2280, 300 2300, 260 2700 C 220 3100, 900 3240, 1120 3640 C 1340 4040, 1180 4400, 820 4740 C 460 5080, 180 5340, 320 5740 C 460 6140, 1080 6340, 1560 6580"
          />
          <HowItWorks />
          <Features />
          <Versions />
          <Details />
          <Extras />
        </div>
        <Testimonials />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
