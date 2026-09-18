"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from "./gsap";
import { STEPS } from "./content";
import { SCENES } from "./FeatureScenes";
import { Avatar } from "./Avatar";
import { scrollToY } from "./SmoothScroll";
import { burstFrom } from "./confetti";

// One background shape per step, drawn in the 1440×900 frame around the card,
// each its own form: a giant cursor pointing in at the card, a wide speech
// bubble, a flight path that loops and shoots off like a sent link, and a
// big tick. On scroll one ribbon morphs from each shape into the next, and its
// tint changes with it.
const SHAPES = [
  "M 610 290 L 610 800 L 490 680 L 400 890 L 310 860 L 400 650 L 250 650 Z",
  "M 700 720 H 1140 Q 1240 720 1240 620 V 250 Q 1240 150 1140 150 H 500 Q 400 150 400 250 V 620 Q 400 720 500 720 H 560 L 440 860 Z",
  "M 60 830 C 300 870, 540 740, 540 560 C 540 400, 350 400, 370 540 C 390 700, 720 700, 920 480 C 1030 360, 1150 240, 1330 150 L 1195 168 L 1330 150 L 1305 285",
  "M 250 450 C 380 560, 520 700, 610 790 C 780 560, 1010 300, 1300 100",
];
const TINTS = ["#f1efe2", "#ece7f8", "#fbe6d8", "#ecf5cf"];

// People floating around the card, like participants in a review.
const TILES = [
  { key: "a", avatar: 3, name: "Priya", tone: "terracotta" },
  { key: "b", avatar: 12, name: "Sam", tone: "green" },
  { key: "c", avatar: 22, name: "Jess", tone: "purple" },
] as const;

function Heading({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <h3 className="lp-serif lp-feat-title">
      {step.lead}
      <em>{step.accent}</em>
    </h3>
  );
}

/**
 * The walkthrough. On wide screens the section is four screens tall and its
 * frame sticks while you scroll: the step list on the left tracks progress,
 * the card swaps scenes, the copy on the right follows. On narrow screens the
 * steps simply stack.
 */
export function Features() {
  const root = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);

  useGSAP(
    () => {
      ScrollTrigger.create({
        trigger: ".lp-feat-track",
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => setStep(Math.min(STEPS.length - 1, Math.floor(self.progress * STEPS.length))),
      });

      // The first shape draws itself in, then one ribbon morphs into each
      // step's shape as that step arrives: one timeline unit per step, the
      // morph straddling the moment the step changes. Without motion, CSS
      // simply shows the current step's shape.
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const [ribbon, ...rest] = gsap.utils.toArray<SVGPathElement>(".lp-feat-shape", root.current);
        gsap.set(rest, { autoAlpha: 0 });
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: ".lp-feat-track", start: "top top", end: "bottom bottom", scrub: 0.9 },
        });
        tl.fromTo(ribbon, { strokeDashoffset: 1, stroke: TINTS[0] }, { strokeDashoffset: 0, duration: 0.5 }, 0);
        for (let i = 1; i < SHAPES.length; i++) {
          tl.to(ribbon, { morphSVG: SHAPES[i], stroke: TINTS[i], duration: 0.55, ease: "power2.inOut" }, i - 0.3);
        }
        tl.to({}, { duration: 0.01 }, STEPS.length - 0.01);
      });
    },
    { scope: root },
  );

  // Reaching "Close the loop" resolves everything: celebrate like the app does,
  // once the scene's resolved bar has filled.
  useEffect(() => {
    if (step !== STEPS.length - 1) return;
    const id = window.setTimeout(() => {
      burstFrom(root.current?.querySelector('.lp-feat-track .lp-scene[data-active="true"] .lp-resolve-bar'));
    }, 1300);
    return () => window.clearTimeout(id);
  }, [step]);

  const goTo = (i: number) => {
    const track = root.current?.querySelector<HTMLElement>(".lp-feat-track");
    if (!track) return;
    const top = track.getBoundingClientRect().top + window.scrollY;
    const span = track.offsetHeight - window.innerHeight;
    scrollToY(top + (span * (i + 0.5)) / STEPS.length);
  };

  return (
    <section ref={root} id="features" className="lp-feat" aria-labelledby="lp-feat-title">
      <h2 id="lp-feat-title" className="sr-only">
        Features
      </h2>

      {/* Wide: sticky walkthrough */}
      <div className="lp-feat-track">
        <div className="lp-feat-frame" data-step={step}>
          <svg className="lp-feat-shapes" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
            {SHAPES.map((d, i) => (
              <path key={i} className="lp-feat-shape" data-i={i} d={d} pathLength={1} />
            ))}
          </svg>
          <div className="lp-feat-grid">
            <ol className="lp-feat-index" aria-label="Steps">
              {STEPS.map((s, i) => (
                <li key={s.key}>
                  <button type="button" data-active={i === step} aria-current={i === step ? "step" : undefined} onClick={() => goTo(i)}>
                    {s.label}
                  </button>
                </li>
              ))}
            </ol>

            <div className="lp-feat-stage" data-step={step}>
              <div className="lp-feat-card">
                {STEPS.map((s, i) => {
                  const Scene = SCENES[s.key];
                  return (
                    <div key={s.key} className="lp-scene" data-active={i === step} aria-hidden={i !== step}>
                      <Scene />
                    </div>
                  );
                })}
              </div>
              {TILES.map((t) => (
                <div key={t.key} className={`lp-tile lp-tile-${t.key}`} aria-hidden>
                  <div className="lp-tile-bob">
                    <Avatar n={t.avatar} />
                    <span data-tone={t.tone}>{t.name}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="lp-feat-copy">
              {STEPS.map((s, i) => (
                <div key={s.key} className="lp-feat-copy-item" data-active={i === step} aria-hidden={i !== step}>
                  <Heading step={s} />
                  <p className="lp-lede">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Narrow: stacked steps */}
      <ol className="lp-feat-stack lp-container">
        {STEPS.map((s) => {
          const Scene = SCENES[s.key];
          return (
            <li key={s.key}>
              <p className="lp-eyebrow">{s.label}</p>
              <Heading step={s} />
              <p className="lp-lede">{s.body}</p>
              <div className="lp-feat-card">
                <div className="lp-scene" data-active>
                  <Scene />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
