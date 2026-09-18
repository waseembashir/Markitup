"use client";

import { useRef } from "react";
import { EXTRAS } from "./content";
import { EXTRA_ICONS } from "./icons";
import { useDrawIcons } from "./HowItWorks";

export function Extras() {
  const root = useRef<HTMLElement>(null);
  useDrawIcons(root, ".lp-extra");

  return (
    <section ref={root} className="lp-extras" aria-labelledby="lp-extras-title">
      <div className="lp-container">
        <div className="lp-extras-head">
          <p className="lp-eyebrow">Around the feedback</p>
          <h2 id="lp-extras-title" className="lp-serif lp-h2 mt-5">
            The busywork, <em>handled.</em>
          </h2>
        </div>
        <ul className="lp-extras-grid">
          {EXTRAS.map((x) => {
            const Icon = EXTRA_ICONS[x.key];
            return (
              <li key={x.key} className="lp-extra">
                <Icon className="lp-extra-icon" />
                <h3 className="text-lg font-semibold tracking-tight">{x.title}</h3>
                <p>{x.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
