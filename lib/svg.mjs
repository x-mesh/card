// Minimal SVG emitters.
//
// Two rules hold everywhere in this file:
//
//   1. Presentation rides on attributes, never on a <style> block. An SVG
//      referenced as an image is a separate document, and attributes survive
//      every sanitizer and renderer we might be served through.
//   2. Text carries xml:space="preserve", because SVG collapses runs of spaces
//      by default and several templates align with them.

export const MONO =
  'ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace';
export const SANS =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif';

export const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const attrs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k}="${typeof v === "number" ? round(v) : esc(v)}"`)
    .join(" ");

/** Keep generated files diff-friendly: no 1147.6000000000001 in the output. */
export const round = (n) => (Number.isInteger(n) ? n : Number(n.toFixed(2)));

export function text(x, y, content, opts = {}) {
  if (content === "" || content == null) return "";
  const {
    fill = "#000",
    size = 14,
    family = SANS,
    weight,
    anchor,
    letterSpacing,
  } = opts;
  return `<text ${attrs({
    x,
    y,
    fill,
    "font-family": family,
    "font-size": size,
    "font-weight": weight,
    "text-anchor": anchor,
    "letter-spacing": letterSpacing,
    "xml:space": "preserve",
  })}>${esc(content)}</text>`;
}

export const rect = (x, y, w, h, o = {}) =>
  `<rect ${attrs({ x, y, width: w, height: h, ...o })}/>`;

export const line = (x1, y1, x2, y2, o = {}) =>
  `<line ${attrs({ x1, y1, x2, y2, ...o })}/>`;

export const path = (d, o = {}) => `<path ${attrs({ d, ...o })}/>`;

export const circle = (cx, cy, r, o = {}) =>
  `<circle ${attrs({ cx, cy, r, ...o })}/>`;

export const polygon = (points, o = {}) =>
  `<polygon ${attrs({
    points: points.map(([x, y]) => `${round(x)},${round(y)}`).join(" "),
    ...o,
  })}/>`;

export const group = (children, o = {}) =>
  `<g ${attrs(o)}>${children.filter(Boolean).join("")}</g>`;

export function arrowMarker(id, color) {
  return `<marker id="${esc(id)}" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">` +
    `<path d="M0,0.5 L8.5,4.5 L0,8.5" fill="none" stroke="${esc(color)}" stroke-width="1.2"/></marker>`;
}

export function document_({ width, height, label, body, defs = "" }) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(height)}" ` +
    `viewBox="0 0 ${round(width)} ${round(height)}" role="img" aria-label="${esc(label)}">\n` +
    (defs ? `  <defs>${defs}</defs>\n` : "") +
    `  ${body.filter(Boolean).join("\n  ")}\n` +
    `</svg>\n`
  );
}
