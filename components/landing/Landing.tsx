import "./landing.css";
import "./hero.css";
import "./sections.css";
import "./compare.css";
import "./features.css";
import "./showcase.css";
import "./footer.css";
import { SmoothScroll } from "./SmoothScroll";
import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { FormatBand } from "./FormatBand";
import { BeforeAfter } from "./BeforeAfter";
import { HowItWorks } from "./HowItWorks";
import { Features } from "./Features";
import { Versions } from "./Versions";
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
        <HowItWorks />
        <Features />
        <Versions />
        <Extras />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
