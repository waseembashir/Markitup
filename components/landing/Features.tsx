"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollTrigger, useGSAP } from "./gsap";
import { STEPS } from "./content";
import { SCENES } from "./FeatureScenes";
import { Avatar } from "./Avatar";
import { scrollToY } from "./SmoothScroll";
import { burstFrom } from "./confetti";

// People floating around the card, like participants in a review.
const TILES = [
  { key: "a", avatar: 3, name: "Emma", tone: "terracotta" },
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
