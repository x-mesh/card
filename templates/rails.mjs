// Rails template: independent parts on top, shared substrate underneath.
//
// A layer marked `"rail": true` in config spans the full width, because that is
// what "runs under everything" looks like. The rest sit side by side as equals.
// Says less about direction than `graph` and more about standing than `stack`.

import { document_, text, rect, line, MONO, SANS, round } from "../lib/svg.mjs";
import { widthOf, wrap, fit, packItems } from "../lib/text.mjs";

const WIDTH = 1400;
const PAD_X = 52;
const PAD_Y = 48;
const GAP = 14;
const TAG = 12.5;
const REPO = 23;
const BODY = 14.5;
const RAIL_LABEL = 236;

export const meta = {
  name: "rails",
  summary: "Independent parts on top, shared rails underneath. Light.",
  themes: {
    light: { bg: "#ffffff", band: "#f6f8fa", border: "#d1d9e0", ink: "#1f2328", dim: "#59636e" },
    dark: { bg: "#0d1117", band: "#161b22", border: "#30363d", ink: "#e6edf3", dim: "#8b949e" },
  },
};

export function render(model, theme) {
  const t = { ...meta.themes.light, ...theme };
  const tops = model.layers.filter((l) => !l.rail);
  const rails = model.layers.filter((l) => l.rail);
  if (!tops.length) throw new Error('rails: every layer is marked "rail"; nothing left on top');

  const cardW = (WIDTH - PAD_X * 2 - GAP * (tops.length - 1)) / tops.length;
  const cardInner = cardW - 40;

  const topRows = tops.map((l) => {
    // The repository names wrap rather than shrink. They are what a reader came
    // for, and a layer naming four tools is normal.
    for (const name of l.repos) {
      fit(name, cardInner, REPO, "mono", `repo cell for "${l.id}"`);
    }
    const repo = l.repos.join(" · ");
    const copy = [l.lead, l.body].filter(Boolean).join(" ") || l.owns || "";
    return {
      ...l,
      repo,
      repoLines: packItems(l.repos, cardInner, REPO, "mono"),
      lines: wrap(copy, cardInner, BODY),
    };
  });
  const repoBlock = Math.max(...topRows.map((r) => r.repoLines.length));
  const cardH =
    72 + (repoBlock - 1) * (REPO + 6) + Math.max(...topRows.map((r) => r.lines.length)) * 22;

  const railInner = WIDTH - PAD_X * 2 - RAIL_LABEL - 46;
  const railRows = rails.map((l) => {
    const copy = [l.lead, l.body].filter(Boolean).join(" ") || l.owns || "";
    return { ...l, repo: l.repos.join(" · "), lines: wrap(copy, railInner, 15) };
  });
  const railH = (r) => 40 + Math.max(2, r.lines.length) * 23;

  const connector = 34;
  const height =
    PAD_Y * 2 +
    cardH +
    connector +
    railRows.reduce((a, r) => a + railH(r) + GAP, 0) +
    34;

  const out = [rect(0, 0, WIDTH, height, { fill: t.bg })];

  topRows.forEach((r, i) => {
    const x = PAD_X + i * (cardW + GAP);
    const color = r.hex ?? t.dim;
    out.push(
      rect(x, PAD_Y, cardW, cardH, {
        rx: 10,
        fill: t.bg,
        stroke: t.border,
        "stroke-width": 1.5,
      }),
    );
    out.push(
      text(x + 20, PAD_Y + 28, r.id.toUpperCase(), {
        fill: color,
        size: TAG,
        family: SANS,
        weight: 700,
        letterSpacing: 1.1,
      }),
    );
    let ry = PAD_Y + 56;
    for (const ln of r.repoLines) {
      out.push(text(x + 20, ry, ln, { fill: t.ink, size: REPO, family: MONO, weight: 600 }));
      ry += REPO + 6;
    }
    let ty = PAD_Y + 80 + (repoBlock - 1) * (REPO + 6);
    for (const ln of r.lines) {
      out.push(text(x + 20, ty, ln, { fill: t.dim, size: BODY, family: SANS }));
      ty += 22;
    }
    // Dotted drop showing the card sits on whatever is below.
    const cx = x + cardW / 2;
    out.push(
      line(cx, PAD_Y + cardH + 8, cx, PAD_Y + cardH + connector - 8, {
        stroke: t.border,
        "stroke-width": 1.5,
        "stroke-dasharray": "3 5",
      }),
    );
  });

  let y = PAD_Y + cardH + connector;
  for (const r of railRows) {
    const h = railH(r);
    const color = r.hex ?? t.dim;
    const optional = Boolean(r.tag);
    out.push(
      rect(PAD_X, y, WIDTH - PAD_X * 2, h, {
        rx: 10,
        fill: optional ? t.bg : t.band,
        stroke: optional ? color : t.border,
        "stroke-width": 1.5,
        "stroke-dasharray": optional ? "6 4" : undefined,
      }),
    );
    const label = r.id.toUpperCase() + (r.tag ? `  ·  ${r.tag.replace(/[()]/g, "").toUpperCase()}` : "");
    out.push(
      text(PAD_X + 22, y + 28, label, {
        fill: color,
        size: TAG,
        family: SANS,
        weight: 700,
        letterSpacing: 1.1,
      }),
    );
    out.push(
      text(PAD_X + 22, y + 56, r.repo, { fill: t.ink, size: REPO, family: MONO, weight: 600 }),
    );
    let ty = y + 32;
    for (const ln of r.lines) {
      out.push(
        text(PAD_X + RAIL_LABEL + 24, ty, ln, { fill: t.dim, size: 15, family: SANS }),
      );
      ty += 23;
    }
    y += h + GAP;
  }

  const lead = model.footer.lead ?? "";
  out.push(text(PAD_X, y + 24, lead, { fill: t.ink, size: 15.5, family: SANS, weight: 700 }));
  out.push(
    text(PAD_X + widthOf(lead, 15.5) + 8, y + 24, model.footer.dim ?? "", {
      fill: t.dim,
      size: 15.5,
      family: SANS,
    }),
  );

  return document_({ width: WIDTH, height: round(y + 46), label: `${model.title} — rails`, body: out });
}
