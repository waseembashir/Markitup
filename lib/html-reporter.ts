import {
  HTML_HEIGHT_MESSAGE,
  HTML_SCROLL_MESSAGE,
  HTML_SCROLLBY_MESSAGE,
  HTML_MODE_MESSAGE,
  HTML_POINTER_MESSAGE,
  HTML_READY_MESSAGE,
} from "./html-messages";

/**
 * The script injected into an uploaded design so the viewer can measure it,
 * follow its scroll, and hear where someone clicked.
 *
 * It has to work in a document it does not control, in a frame sandboxed
 * without allow-same-origin, and — since October — inside pages that are not
 * pages at all but bundles: one wrapper holding every page of a site as a
 * string, written into a nested <iframe srcdoc> by a little router. A client
 * looking at one of those is looking at the INNER document, so every click
 * landed somewhere this script could not see and commenting was impossible.
 *
 * The wrapper and its srcdoc child get separate opaque origins, so the script
 * cannot reach in after the fact. It gets in beforehand instead: it runs first
 * (injected at the top of <head>), wraps the srcdoc setter, and splices a copy
 * of itself into whatever the page assigns. Each copy talks to its own parent,
 * and every copy relays its children upward, so the viewer still hears a single
 * voice from the frame it owns.
 */
export function reporterSource(): string {
  return `(function(){
var SELF=document.currentScript?document.currentScript.outerHTML:"";
var HEIGHT=${JSON.stringify(HTML_HEIGHT_MESSAGE)},SCROLL=${JSON.stringify(HTML_SCROLL_MESSAGE)},
    SCROLLBY=${JSON.stringify(HTML_SCROLLBY_MESSAGE)},MODE=${JSON.stringify(HTML_MODE_MESSAGE)},
    POINTER=${JSON.stringify(HTML_POINTER_MESSAGE)},READY=${JSON.stringify(HTML_READY_MESSAGE)};
var cm=false;
/* A nested document is reporting, so our own measurements are of the wrapper
   around it — 100% of a viewport that never scrolls — and would drown it out. */
var nested=false;

function post(m){try{parent.postMessage(m,"*")}catch(e){}}
function covers(b){var w=window.innerWidth||0,h=window.innerHeight||0;
return w>0&&h>0&&b.width>=w*0.9&&b.height>=h*0.9}
function frames(){return document.getElementsByTagName("iframe")}
function frameOf(w){var f=frames();for(var i=0;i<f.length;i++){try{if(f[i].contentWindow===w)return f[i]}catch(e){}}return null}
function down(m){var f=frames();for(var i=0;i<f.length;i++){try{f[i].contentWindow.postMessage(m,"*")}catch(e){}}}

/* Height = the bottom of the lowest real content element, NOT body.scrollHeight.
   A page whose <body> (or a wrapper) stretches to min-height:100vh reports blank
   space below its last element; measuring the furthest child bottom trims that. */
function h(){var b=document.body,e=document.documentElement,m=0;
if(b){for(var c=b.children,i=0;i<c.length;i++){var el=c[i],t=el.tagName;
if(t==="SCRIPT"||t==="STYLE"||t==="LINK")continue;
var r=el.getBoundingClientRect(),bt=r.bottom+(window.scrollY||window.pageYOffset||0);if(bt>m)m=bt}}
var f=Math.max(b?b.scrollHeight:0,e?e.scrollHeight:0);m=Math.ceil(m);return m>0?Math.min(m,f||m):f}
function r(){if(nested)return;post({type:HEIGHT,height:h()})}
var sy=-1,raf=0;
function sc(){raf=0;if(nested)return;var y=window.scrollY||window.pageYOffset||0;
if(y!==sy){sy=y;post({type:SCROLL,y:y,x:window.scrollX||window.pageXOffset||0})}}
function pm(ph,e){post({type:POINTER,phase:ph,x:e.clientX,y:e.clientY,button:e.button})}

/* Splice a copy of this script into a document about to be handed to a child
   frame, so the client's clicks are heard wherever they actually land. */
function inject(html){
if(!SELF||html.indexOf("markitup:pointer")!==-1)return html;
var m=/<head[^>]*>/i.exec(html);
if(m)return html.slice(0,m.index+m[0].length)+SELF+html.slice(m.index+m[0].length);
var d=/<!doctype[^>]*>/i.exec(html);
if(d)return html.slice(0,d.index+d[0].length)+SELF+html.slice(d.index+d[0].length);
return SELF+html}
try{var proto=HTMLIFrameElement.prototype,desc=Object.getOwnPropertyDescriptor(proto,"srcdoc");
if(desc&&desc.set)Object.defineProperty(proto,"srcdoc",{configurable:true,enumerable:desc.enumerable,
get:function(){return desc.get.call(this)},set:function(v){desc.set.call(this,inject(String(v)))}})}catch(e){}

window.addEventListener("message",function(e){
var d=e.data;if(!d||typeof d.type!=="string"||d.type.indexOf("markitup:")!==0)return;
var child=frameOf(e.source);
if(child){
  var b=child.getBoundingClientRect();
  /* Upward: a nested document's news is this frame's news. Pointer coordinates
     are in the child's viewport, so they move into ours by its position. */
  if(d.type===POINTER){post({type:POINTER,phase:d.phase,x:d.x+b.left,y:d.y+b.top,button:d.button});return}
  if(d.type===READY){down({type:MODE,mode:cm?"comment":"browse"});return}
  /* Its measurements only speak for the design if it IS the design — a frame
     filling the viewport, as a bundle's does. A page with a small embedded
     frame of its own keeps reporting its own height. */
  if(!covers(b))return;
  nested=true;post(d);return}
/* Downward: whatever the viewer tells us, the documents inside need to know. */
if(d.type===MODE){cm=d.mode==="comment";document.documentElement.style.cursor=cm?"crosshair":"";down(d);return}
if(d.type===SCROLLBY){window.scrollBy(d.dx||0,d.dy||0);down(d)}
});

window.addEventListener("scroll",function(){if(!raf)raf=requestAnimationFrame(sc)},{passive:true});
document.addEventListener("pointerdown",function(e){if(!cm)return;pm("down",e)},true);
document.addEventListener("pointermove",function(e){if(!cm)return;pm("move",e)},true);
document.addEventListener("pointerup",function(e){if(!cm)return;pm("up",e)},true);
document.addEventListener("click",function(e){if(!cm)return;e.preventDefault();e.stopPropagation()},true);
document.addEventListener("submit",function(e){if(!cm)return;e.preventDefault();e.stopPropagation()},true);
document.addEventListener("selectstart",function(e){if(cm)e.preventDefault()},true);
document.addEventListener("dragstart",function(e){if(cm)e.preventDefault()},true);
window.addEventListener("load",function(){r();sc()});
window.addEventListener("resize",r);
if(window.ResizeObserver){try{new ResizeObserver(r).observe(document.documentElement)}catch(e){}}
var n=0,t=setInterval(function(){r();if(++n>20)clearInterval(t)},500);
/* Tell whoever is above that this document exists, so it can be told the mode
   it was born into — a bundle swaps its inner page long after the viewer set it. */
post({type:READY});r();sc();
})();`;
}
