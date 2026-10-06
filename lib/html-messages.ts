// The names the viewer and an uploaded design call to each other by. Kept apart
// from both so the reporter's source and the code that reads its messages can
// share them without importing each other.

export const HTML_HEIGHT_MESSAGE = "markitup:height";
export const HTML_SCROLL_MESSAGE = "markitup:scroll";
export const HTML_SCROLLBY_MESSAGE = "markitup:scrollby";

// Comment mode used to work by covering the page with a click-capture layer.
// That layer also swallowed the wheel, so scrolling had to be forwarded back in
// as scrollBy calls — one postMessage round trip per wheel tick, with none of
// the browser's own accumulation or momentum. It read as juddery next to Browse
// mode, because next to Browse mode it was.
//
// So let the page keep its own scrolling, and send the POINTER out instead. The
// reporter swallows clicks while comment mode is on (a client dropping a pin
// should not also submit the form under it) and reports where the pointer went,
// which is all the viewer needs to place a pin or drag a region.
export const HTML_MODE_MESSAGE = "markitup:mode";
export const HTML_POINTER_MESSAGE = "markitup:pointer";

// A document announcing itself to whatever is above it. A bundle writes its
// inner page long after the viewer has said which mode it is in, so the new
// document has to ask rather than wait to be told.
export const HTML_READY_MESSAGE = "markitup:ready";
