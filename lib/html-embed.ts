// Shared contract for rendering uploaded HTML mockups in a sandboxed iframe.
//
// The iframe is sandboxed WITHOUT allow-same-origin, so the parent cannot read
// the (cross-origin, opaque) document's height to lay pins over it. Instead we
// inject a tiny reporter into the uploaded file that postMessages its own
// scrollHeight to the parent; the viewer sizes the frame to that height so the
// whole page lays out (no inner scroll) and pin coordinates stay aligned.

export const HTML_HEIGHT_MESSAGE = "markitup:height";
export const HTML_SCROLL_MESSAGE = "markitup:scroll";
export const HTML_SCROLLBY_MESSAGE = "markitup:scrollby";

// Height = the bottom of the lowest real content element, NOT body.scrollHeight.
// A page whose <body> (or a wrapper) stretches to min-height:100vh reports blank
// space below its last element; measuring the furthest child bottom trims that.
const REPORTER = `<script>(function(){function h(){var b=document.body,e=document.documentElement,m=0;if(b){for(var c=b.children,i=0;i<c.length;i++){var el=c[i],t=el.tagName;if(t==="SCRIPT"||t==="STYLE"||t==="LINK")continue;var r=el.getBoundingClientRect(),bt=r.bottom+(window.scrollY||window.pageYOffset||0);if(bt>m)m=bt}}var f=Math.max(b?b.scrollHeight:0,e?e.scrollHeight:0);m=Math.ceil(m);return m>0?Math.min(m,f||m):f}function r(){try{parent.postMessage({type:"${HTML_HEIGHT_MESSAGE}",height:h()},"*")}catch(e){}}var sy=-1,raf=0;function sc(){raf=0;var y=window.scrollY||window.pageYOffset||0;if(y!==sy){sy=y;try{parent.postMessage({type:"${HTML_SCROLL_MESSAGE}",y:y,x:window.scrollX||window.pageXOffset||0},"*")}catch(e){}}}window.addEventListener("scroll",function(){if(!raf)raf=requestAnimationFrame(sc)},{passive:true});window.addEventListener("message",function(e){var d=e.data;if(d&&d.type==="${HTML_SCROLLBY_MESSAGE}"){window.scrollBy(d.dx||0,d.dy||0)}});window.addEventListener("load",function(){r();sc()});window.addEventListener("resize",r);if(window.ResizeObserver){try{new ResizeObserver(r).observe(document.documentElement)}catch(e){}}var n=0,t=setInterval(function(){r();if(++n>20)clearInterval(t)},500);r();sc();})();</script>`;

// Append the reporter just before </body> (or at the end if there is none).
export function injectHeightReporter(html: string): string {
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${REPORTER}</body>`);
  return html + REPORTER;
}

// Remove any previously-injected reporter so we can re-inject the current one
// (lets already-uploaded mockups pick up measurement fixes at view time).
// The tempered `(?:(?!</script>)[\s\S])*?` tokens stop at the first </script>,
// so we only ever remove the single reporter script — never other page scripts
// or the markup between them.
export function stripHeightReporter(html: string): string {
  return html.replace(
    /<script\b[^>]*>(?:(?!<\/script>)[\s\S])*?markitup:height(?:(?!<\/script>)[\s\S])*?<\/script>/gi,
    "",
  );
}
