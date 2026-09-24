// jsdom implements no media queries, and components that lay out differently
// on a phone ask for them on their first render. Answer "no match", which is
// the wide-screen branch — the one these tests are written against.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
