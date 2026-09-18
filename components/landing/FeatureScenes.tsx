import { Avatar } from "./Avatar";
import type { Step } from "./content";

// The four scenes shown in the features card, one per step. Pure markup: the
// section decides which one is active and CSS staggers the pieces in, using
// each element's --n as its place in the sequence.

const n = (i: number) => ({ "--n": i }) as React.CSSProperties;

const Check = () => (
  <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden>
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Bubble({
  who,
  role,
  tone,
  avatar,
  i,
  children,
}: {
  who: string;
  role: string;
  tone: "terracotta" | "green" | "purple";
  avatar: number;
  i: number;
  children: React.ReactNode;
}) {
  return (
    <div className="lp-scene-in lp-bubble" style={n(i)}>
      <p className="lp-bubble-name" data-tone={tone}>
        <Avatar n={avatar} />
        {who} <span>· {role}</span>
      </p>
      <div className="lp-bubble-body">{children}</div>
    </div>
  );
}

function MiniPage({ children }: { children?: React.ReactNode }) {
  return (
    <div className="lp-minipage">
      <div className="lp-minipage-nav">
        <span className="lp-serif">fernleaf</span>
        <i />
        <i />
      </div>
      <p className="lp-minipage-h lp-serif">
        Slow mornings, <em>better coffee.</em>
      </p>
      <span className="lp-minipage-line" />
      <span className="lp-minipage-line" style={{ width: "62%" }} />
      <div className="lp-minipage-img" />
      {children}
    </div>
  );
}

function PointScene() {
  return (
    <>
      <MiniPage>
        <span className="lp-scene-pop lp-pin lp-mp-pin" style={{ ...n(1), left: "66%", top: "20%" }}>
          1
        </span>
        <span className="lp-scene-draw lp-mp-region" style={n(2)} />
        <span className="lp-scene-pop lp-pin lp-mp-pin" style={{ ...n(3), left: "86%", top: "46%" }}>
          2
        </span>
      </MiniPage>
      <Bubble who="Priya" role="Client" tone="terracotta" avatar={3} i={4}>
        This headline could be punchier. And can the photo feel warmer?
      </Bubble>
    </>
  );
}

function TalkScene() {
  return (
    <div className="lp-thread-stack">
      <p className="lp-scene-in lp-live" style={n(0)}>
        <i /> Live · 3 people viewing
      </p>
      <Bubble who="Priya" role="Client" tone="terracotta" avatar={3} i={1}>
        Could we see the hero with the lighter photo?
      </Bubble>
      <Bubble who="Sam" role="Designer" tone="green" avatar={12} i={2}>
        <b className="lp-mention">@Priya</b> uploaded it, have a look.
        <span className="lp-attach">
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
            <path d="M4 1.5h5l3.5 3.5v9.5h-8.5z M9 1.5v3.5h3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
          hero-light.png
        </span>
      </Bubble>
      <Bubble who="Jess" role="Project lead" tone="purple" avatar={22} i={3}>
        Much better. Approving this one.
      </Bubble>
      <p className="lp-scene-in lp-typing-row" style={n(4)}>
        <span className="lp-typing-dots">
          <i />
          <i />
          <i />
        </span>
        Priya is typing
      </p>
    </div>
  );
}

function ShareScene() {
  return (
    <div className="lp-share">
      <div className="lp-scene-in lp-share-card" style={n(0)}>
        <p className="lp-share-title">Share “Fernleaf home”</p>
        <div className="lp-share-link">
          <span className="lp-tnum">markitup.apexure.com/s/k7Qm2</span>
          <span className="lp-share-copy">
            <Check /> Copied
          </span>
        </div>
        <div className="lp-share-row">
          <span>Anyone with the link can comment</span>
          <span className="lp-toggle" data-on />
        </div>
        <div className="lp-share-row">
          <span>Ask to sign in first</span>
          <span className="lp-toggle" />
        </div>
        <div className="lp-share-row">
          <span>Views clients see</span>
          <span className="lp-share-chips">
            <b>Desktop</b>
            <b>Mobile</b>
          </span>
        </div>
      </div>
      <Bubble who="Guest" role="no account needed" tone="purple" avatar={18} i={2}>
        Opened the link, left three comments. Easy.
      </Bubble>
    </div>
  );
}

function ResolveScene() {
  return (
    <div className="lp-resolve">
      <div className="lp-scene-in lp-resolve-head" style={n(0)}>
        <b>Fernleaf home · v2</b>
        <span className="lp-resolve-count lp-tnum">3 of 3 resolved</span>
      </div>
      <div className="lp-scene-in lp-resolve-bar" style={n(1)}>
        <i />
      </div>
      {[
        ["Logo 20% larger", 3],
        ["Button reads “Start trial”", 12],
        ["Warmer hero photo", 3],
      ].map(([text, av], i) => (
        <div key={i} className="lp-scene-in lp-resolve-item" style={n(i + 2)}>
          <span className="lp-pin" data-resolved="true">
            <Check />
          </span>
          <span>{text}</span>
          <Avatar n={av as number} />
        </div>
      ))}
      <p className="lp-scene-in lp-resolve-note" style={n(6)}>
        Every pin is green. Ship it.
      </p>
    </div>
  );
}

export const SCENES: Record<Step["key"], () => React.ReactElement> = {
  point: PointScene,
  talk: TalkScene,
  share: ShareScene,
  resolve: ResolveScene,
};
