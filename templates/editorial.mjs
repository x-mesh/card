// Editorial template: no boxes at all.
//
// A numbered list, a hairline between entries, and one accent per layer. The
// quietest of the set. Like `stack`, it carries no connection information.

import { document_, text, line, rect, MONO, SANS, round } from "../lib/svg.mjs";
import { widthOf, wrap } from "../lib/text.mjs";

const WIDTH = 1400;
const PAD_X = 72;
const PAD_TOP = 66;
const NUM_COL = 44;
const NAME_COL = 290;
const GUTTER = 40;
const LEAD = 21;
const BODY = 16.5;

export const meta = {
  name: "editorial",
  summary: "Numbered entries, no boxes. Quietest, carries no connections.",
  defaultTheme: {
    bg: "#faf9f7",
    ink: "#1f2328",
    dim: "#6b6557",
    faint: "#b9b3a3",
    rule: "#e3e0d8",
  },
};

export function render(model, theme) {
  const t = { ...meta.defaultTheme, ...theme };
  const bodyX = PAD_X + NUM_COL + GUTTER + NAME_COL + GUTTER;
  const bodyW = WIDTH - bodyX - PAD_X;

  const rows = model.layers.map((l, i) => {
    const lead = l.lead ?? l.owns ?? "";
    const bodyText = l.body ?? l.wired ?? "";
    const leadLines = wrap(lead, bodyW, LEAD);
    const bodyLines = bodyText ? wrap(bodyText, bodyW, BODY) : [];
    return {
      ...l,
      n: String(i + 1).padStart(2, "0"),
      leadLines,
      bodyLines,
      height: Math.max(78, 52 + leadLines.length * 28 + bodyLines.length * 24),
    };
  });

  const height =
    PAD_TOP + 42 + rows.reduce((a, r) => a + r.height, 0) + 62;

  const out = [rect(0, 0, WIDTH, height, { fill: t.bg })];

  out.push(
    text(PAD_X, PAD_TOP, "THE LAYERS", {
      fill: t.ink,
      size: 15,
      family: MONO,
      weight: 700,
      letterSpacing: 3.4,
    }),
  );
  const note = `${rows.length}, kept separate`;
  out.push(
    text(WIDTH - PAD_X - widthOf(note, 13.5, "mono"), PAD_TOP, note, {
      fill: t.dim,
      size: 13.5,
      family: MONO,
    }),
  );
  out.push(
    line(PAD_X, PAD_TOP + 14, WIDTH - PAD_X, PAD_TOP + 14, {
      stroke: t.ink,
      "stroke-width": 1.5,
    }),
  );

  let y = PAD_TOP + 42;
  for (const r of rows) {
    const color = r.hex ?? t.dim;
    out.push(text(PAD_X, y + 22, r.n, { fill: t.faint, size: 14, family: MONO }));
    out.push(
      text(PAD_X + NUM_COL + GUTTER, y + 26, r.id, {
        fill: t.ink,
        size: 31,
        family: SANS,
        letterSpacing: -0.5,
      }),
    );

    const repo = r.repos.join(" · ");
    out.push(
      text(PAD_X + NUM_COL + GUTTER, y + 56, repo, {
        fill: t.dim,
        size: 16,
        family: MONO,
      }),
    );
    if (r.tag) {
      const tag = r.tag.replace(/[()]/g, "").toUpperCase();
      const tx = PAD_X + NUM_COL + GUTTER + widthOf(repo, 16, "mono") + 10;
      const tw = widthOf(tag, 11, "mono") + 12;
      out.push(
        rect(tx, y + 44, tw, 17, {
          rx: 3,
          fill: "none",
          stroke: color,
          "stroke-width": 1,
        }),
      );
      out.push(
        text(tx + 6, y + 56, tag, { fill: color, size: 11, family: MONO, letterSpacing: 1.3 }),
      );
    }

    let ty = y + 20;
    for (const ln of r.leadLines) {
      out.push(text(bodyX, ty, ln, { fill: t.ink, size: LEAD, family: SANS, weight: 500 }));
      ty += 28;
    }
    ty += 4;
    for (const ln of r.bodyLines) {
      out.push(text(bodyX, ty, ln, { fill: t.dim, size: BODY, family: SANS }));
      ty += 24;
    }

    y += r.height;
    out.push(line(PAD_X, y, WIDTH - PAD_X, y, { stroke: t.rule, "stroke-width": 1 }));
  }

  const lead = model.footer.lead ?? "";
  out.push(text(PAD_X, y + 34, lead, { fill: t.ink, size: 19, family: SANS }));
  out.push(
    text(PAD_X + widthOf(lead, 19) + 8, y + 34, model.footer.dim ?? "", {
      fill: t.dim,
      size: 19,
      family: SANS,
    }),
  );

  return document_({
    width: WIDTH,
    height: round(y + 58),
    label: `${model.title} — editorial`,
    body: out,
  });
}
