// Text measurement and wrapping.
//
// SVG has no reflow. Any template with a paragraph in it has to decide where
// the line breaks before it writes a single <text>, which means guessing how
// wide a string will be in a font the viewer chooses, not us.
//
// The guess is bounded on purpose:
//
//   - Proportional text is measured against Helvetica advance widths, the
//     narrowest of the faces our sans stack resolves to in practice.
//   - Every measurement is then multiplied by SAFETY, so a wider fallback face
//     still fits the box instead of spilling out of it.
//   - A word that cannot fit its column at all is an error, not a silent
//     overhang. Templates call `fit` and get told, rather than finding out in
//     someone else's browser.

/** Helvetica advance widths, units per 1000 em. */
const HELVETICA = {
  " ": 278, "!": 278, '"': 355, "#": 556, $: 556, "%": 889, "&": 667, "'": 191,
  "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
  ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015,
  "[": 278, "\\": 278, "]": 278, "^": 469, _: 556, "`": 333,
  "{": 334, "|": 260, "}": 334, "~": 584,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278,
  J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722,
  S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222,
  j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333,
  s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
};
for (const d of "0123456789") HELVETICA[d] = 556;

const MONO_EM = 0.6;
const FALLBACK_EM = 0.6;
const WIDE_EM = 1.0; // CJK and anything else full-width

/** Measurements are inflated by this much before anything is laid out. */
export const SAFETY = 1.06;

const isWide = (ch) => {
  const c = ch.codePointAt(0);
  return (
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xff00 && c <= 0xff60)
  );
};

/**
 * Width of `s` at `size` px.
 * @param {"sans"|"mono"} face
 */
export function widthOf(s, size, face = "sans") {
  let em = 0;
  for (const ch of String(s)) {
    if (face === "mono") em += isWide(ch) ? WIDE_EM : MONO_EM;
    else if (isWide(ch)) em += WIDE_EM;
    else em += (HELVETICA[ch] ?? FALLBACK_EM * 1000) / 1000;
  }
  return em * size * SAFETY;
}

/**
 * Greedy word wrap.
 * @returns {string[]} lines
 * @throws when a single word cannot fit `maxWidth`
 */
export function wrap(s, maxWidth, size, face = "sans") {
  const words = String(s).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    if (widthOf(word, size, face) > maxWidth) {
      throw new Error(
        `"${word}" is ${Math.ceil(widthOf(word, size, face))}px at ${size}px ` +
          `and cannot fit a ${Math.floor(maxWidth)}px column`,
      );
    }
    const candidate = line ? `${line} ${word}` : word;
    if (widthOf(candidate, size, face) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Assert a single line fits, naming the offender when it does not.
 * Templates use this for cells they do not wrap, such as a repository name.
 */
export function fit(s, maxWidth, size, face = "sans", what = "text") {
  const w = widthOf(s, size, face);
  if (w > maxWidth) {
    throw new Error(
      `${what} "${s}" needs ${Math.ceil(w)}px but has ${Math.floor(maxWidth)}px`,
    );
  }
  return s;
}
