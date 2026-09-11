// Stack template: one band per layer, read top to bottom.
//
// The fastest of the set to read, and the only one that carries no connection
// information at all. Use it where the question is "what are the parts", not
// "how do they fit".

import { document_, text, rect, line, MONO, SANS, round } from "../lib/svg.mjs";
import { widthOf, wrap, fit, packItems } from "../lib/text.mjs";

const WIDTH = 1400;
const PAD_X = 52;
const PAD_Y = 48;
const LAYER_COL = 236;
const REPO_COL = 272;
const GAP = 10;
const HEAD = 19;
const SUB = 15.5;

export const meta = {
  name: "stack",
  summary: "One band per layer. Fastest to read, carries no connections.",
  themes: {
    light: { bg: "#ffffff", band: "#f6f8fa", border: "#d1d9e0", rule: "#eaeef2", ink: "#1f2328", dim: "#59636e" },
    dark: { bg: "#0d1117", band: "#161b22", border: "#30363d", rule: "#21262d", ink: "#e6edf3", dim: "#8b949e" },
  },
};

export function render(model, theme) {
  const t = { ...meta.themes.light, ...theme };
  const bodyX = PAD_X + LAYER_COL + REPO_COL;
  const bodyW = WIDTH - bodyX - PAD_X - 24;

  // A layer that names four tools is normal. Shrinking the type until they fit
  // on one line is not: the repository name is the thing a reader is here for.
  // Step down one size, then wrap, and only fail if a single name cannot fit.
  const REPO_SIZES = [24, 21];
  const repoBox = REPO_COL - 32;

  const rows = model.layers.map((l) => {
    const repo = l.repos.join(" · ");
    const repoSize =
      REPO_SIZES.find((s) => widthOf(repo, s, "mono") <= repoBox) ?? REPO_SIZES.at(-1);
    for (const name of l.repos) {
      fit(name, repoBox, repoSize, "mono", `repo cell for "${l.id}"`);
    }
    const repoLines = packItems(l.repos, repoBox, repoSize, "mono");
    const lead = l.lead ?? l.owns ?? "";
    const bodyText = l.body ?? l.wired ?? "";
    const bodyLines = bodyText ? wrap(bodyText, bodyW, SUB) : [];
    return {
      ...l,
      repo,
      repoLines,
      repoSize,
      lead,
      bodyLines,
      height: Math.max(
        72,
        34 + 8 + bodyLines.length * 22,
        24 + repoLines.length * (repoSize + 6),
      ),
    };
  });

  const height =
    PAD_Y * 2 + rows.reduce((a, r) => a + r.height, 0) + (rows.length - 1) * GAP + 34;

  const out = [rect(0, 0, WIDTH, height, { fill: t.bg })];
  let y = PAD_Y;

  for (const r of rows) {
    const color = r.hex ?? t.dim;
    out.push(
      rect(PAD_X, y, WIDTH - PAD_X * 2, r.height, {
        rx: 10,
        fill: t.bg,
        stroke: t.border,
        "stroke-width": 1.5,
      }),
    );
    out.push(rect(PAD_X + 1, y + 1, LAYER_COL, r.height - 2, { fill: t.band }));
    out.push(rect(PAD_X + 1, y + 1, 8, r.height - 2, { fill: color }));
    out.push(
      line(PAD_X + LAYER_COL, y, PAD_X + LAYER_COL, y + r.height, {
        stroke: t.rule,
        "stroke-width": 1.5,
      }),
    );
    out.push(
      line(bodyX, y, bodyX, y + r.height, { stroke: t.rule, "stroke-width": 1.5 }),
    );

    const mid = y + r.height / 2;
    out.push(
      text(PAD_X + 20, mid + 5, r.id.toUpperCase(), {
        fill: color,
        size: 15,
        family: SANS,
        weight: 700,
        letterSpacing: 1.1,
      }),
    );
    const repoStep = r.repoSize + 6;
    let ry = mid + 8 - ((r.repoLines.length - 1) * repoStep) / 2;
    for (const ln of r.repoLines) {
      out.push(
        text(PAD_X + LAYER_COL + 18, ry, ln, {
          fill: t.ink,
          size: r.repoSize,
          family: MONO,
          weight: 600,
        }),
      );
      ry += repoStep;
    }

    let ty = y + 32;
    out.push(text(bodyX + 24, ty, r.lead, { fill: t.ink, size: HEAD, family: SANS, weight: 600 }));
    ty += 24;
    for (const ln of r.bodyLines) {
      out.push(text(bodyX + 24, ty, ln, { fill: t.dim, size: SUB, family: SANS }));
      ty += 22;
    }

    y += r.height + GAP;
  }

  const lead = model.footer.lead ?? "";
  out.push(
    text(PAD_X, y + 22, lead, { fill: t.ink, size: 15.5, family: SANS, weight: 700 }),
  );
  out.push(
    text(PAD_X + widthOf(lead, 15.5) + 8, y + 22, model.footer.dim ?? "", {
      fill: t.dim,
      size: 15.5,
      family: SANS,
    }),
  );

  return document_({ width: WIDTH, height: round(y + 44), label: `${model.title} — stack`, body: out });
}
