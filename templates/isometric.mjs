// Isometric template: the layers as stacked slabs, labelled by leader lines.
//
// Labels sit flat outside the projection rather than on the slab faces. Text
// drawn in-plane is skewed, which looks correct and reads badly.

import { document_, text, polygon, line, circle, MONO, SANS } from "../lib/svg.mjs";

const PAD_X = 48;
const PAD_Y = 40;
const CX = 352; // slab centre, relative to the drawing area
const W = 250; // half-width of a slab
const H = 112; // half-height of a slab
const T = 12; // slab thickness
const GAP = 104; // vertical pitch between slabs
const LEADER_X = 702;
const LABEL_X = 720;

export const meta = {
  name: "isometric",
  summary: "Layers as stacked slabs with leader lines. Light.",
  themes: {
    light: { bg: "#ffffff", ink: "#1f2328", dim: "#59636e", faint: "#8c959f", rule: "#eaeef2", toward: "#ffffff" },
    dark: { bg: "#0d1117", ink: "#e6edf3", dim: "#8b949e", faint: "#6e7681", rule: "#21262d", toward: "#0d1117" },
  },
};

const channels = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Fills are derived from the layer colour so config carries one value per
// layer, not three. They blend toward the background rather than toward white,
// so the same layer colour works on a dark sheet without a second palette.
const tint = (hex, amount, toward) => {
  const [tr, tg, tb] = channels(toward);
  const [r, g, b] = channels(hex);
  return (
    "#" +
    [
      [r, tr],
      [g, tg],
      [b, tb],
    ]
      .map(([c, t]) => Math.round(c + (t - c) * amount))
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")
  );
};

export function render(model, theme) {
  const t = { ...meta.themes.light, ...theme };
  const layers = model.layers;

  const drawW = 1304;
  const height = PAD_Y * 2 + (layers.length - 1) * GAP + 2 * H + T + 60;
  const width = PAD_X * 2 + drawW;

  const body = [];
  body.push(`<rect width="${width}" height="${height}" fill="${t.bg}"/>`);

  const g = [];
  layers.forEach((l, i) => {
    const y = PAD_Y + i * GAP;
    const color = l.hex ?? "#57606a";
    const top = tint(color, 0.84, t.toward);
    const side = tint(color, 0.7, t.toward);
    const optional = Boolean(l.tag);
    const dash = optional ? { "stroke-dasharray": "7 4" } : {};
    const stroke = { stroke: color, "stroke-width": 1.3, ...dash };

    g.push(
      polygon(
        [
          [CX - W, y + H],
          [CX, y + 2 * H],
          [CX, y + 2 * H + T],
          [CX - W, y + H + T],
        ],
        { fill: side, ...stroke },
      ),
    );
    g.push(
      polygon(
        [
          [CX, y + 2 * H],
          [CX + W, y + H],
          [CX + W, y + H + T],
          [CX, y + 2 * H + T],
        ],
        { fill: side, ...stroke },
      ),
    );
    g.push(
      polygon(
        [
          [CX, y],
          [CX + W, y + H],
          [CX, y + 2 * H],
          [CX - W, y + H],
        ],
        { fill: top, ...stroke },
      ),
    );

    g.push(
      line(CX + W, y + H, LEADER_X, y + H, {
        stroke: color,
        "stroke-width": 1,
        ...(optional ? { "stroke-dasharray": "5 3" } : {}),
      }),
    );
    g.push(circle(CX + W, y + H, 3.4, { fill: color }));

    const tagLine = l.id.toUpperCase() + (l.tag ? `  ·  ${l.tag.replace(/[()]/g, "").toUpperCase()}` : "");
    g.push(
      text(LABEL_X, y + H - 21, tagLine, {
        fill: color,
        size: 12.5,
        family: MONO,
        weight: 700,
        letterSpacing: 1.5,
      }),
    );
    g.push(
      text(LABEL_X, y + H + 11, l.repos.join(" · "), {
        fill: t.ink,
        size: 27,
        family: MONO,
        weight: 600,
      }),
    );
    if (l.owns) {
      g.push(text(LABEL_X, y + H + 37, l.owns, { fill: t.dim, size: 15.5, family: SANS }));
    }
  });

  body.push(`<g transform="translate(${PAD_X},0)">${g.join("")}</g>`);

  const ruleY = height - 54;
  body.push(
    line(PAD_X, ruleY, width - PAD_X, ruleY, { stroke: t.rule, "stroke-width": 1 }),
  );
  const lead = model.footer.lead ?? "";
  body.push(
    text(PAD_X, ruleY + 26, lead, { fill: t.ink, size: 15.5, family: SANS, weight: 700 }),
  );
  body.push(
    text(PAD_X + lead.length * 8.4, ruleY + 26, model.footer.dim ?? "", {
      fill: t.dim,
      size: 15.5,
      family: SANS,
    }),
  );

  return document_({ width, height, label: `${model.title} — isometric`, body });
}
