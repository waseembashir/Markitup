import { FAQ } from "./content";

// Native <details> sharing one name, so opening a question closes the last.
// Height animates where the browser supports ::details-content; elsewhere it
// simply opens.
export function Faq() {
  return (
    <section id="faq" className="lp-faq" aria-labelledby="lp-faq-title">
      <div className="lp-container lp-faq-grid">
        <div className="lp-faq-head">
          <p className="lp-eyebrow">FAQ</p>
          <h2 id="lp-faq-title" className="lp-serif lp-h2 mt-5">
            Questions, <em>answered.</em>
          </h2>
          <p className="lp-lede mt-6">
            Still wondering about something? The quickest way to find out is to
            try it on one of your own designs.
          </p>
        </div>
        <div className="lp-faq-list">
          {FAQ.map((f, i) => (
            <details key={f.q} name="faq" open={i === 0}>
              <summary>
                <span>{f.q}</span>
                <i aria-hidden />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
