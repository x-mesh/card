// Terminal template: the card reads as the output of the command it names.
//
// Column x positions are derived from content width, never written into config.
// Hand-tuned offsets are how a column silently starts overlapping the next one
// the first time a description gets longer.

import { document_, text, rect, line, circle, MONO, round } from "../lib/svg.mjs";

const FONT = 19;
const LINE = 31;
const CHAR = FONT * 0.6; // advance width of the monospace faces we ask for
const PAD_X = 38;
const PAD_TOP = 30;
const CHROME = 44;
const GAP_CHARS = 4;

export const meta = {
  name: "terminal",
  summary: "Command output in a terminal window. Dark, monospace, column-aligned.",
  defaultTheme: {
    bg: "#0b0e14",
    chrome: "#11151d",
    rule: "#1c2129",
    text: "#c9d1d9",
    bright: "#e6edf3",
    dim: "#6e7681",
    cyan: "#56d4dd",
    purple: "#d2a8ff",
    green: "#7ee787",
    orange: "#ffa657",
  },
};

const COLUMNS = [
  { key: "layer", head: "LAYER" },
  { key: "repo", head: "REPO" },
  { key: "owns", head: "OWNS" },
  { key: "wired", head: "WIRED TO" },
];

function layout(rows) {
  const x = {};
  let cursor = 0;
  for (const c of COLUMNS) {
    x[c.key] = cursor;
    const widest = Math.max(c.head.length, ...rows.map((r) => (r[c.key] ?? "").length));
    cursor += Math.round((widest + GAP_CHARS) * CHAR);
  }
  const last = COLUMNS.at(-1);
  const end =
    x[last.key] +
    Math.round(
      Math.max(last.head.length, ...rows.map((r) => (r[last.key] ?? "").length)) * CHAR,
    );
  return { x, end };
}

export function render(model, theme) {
  const t = { ...meta.defaultTheme, ...theme };
  const mono = (s, o) => ({ ...o, family: MONO, size: o?.size ?? FONT });

  const rows = model.layers.map((l) => ({
    layer: l.id,
    repo: l.repos.join(" ") + (l.tag ? `  ${l.tag}` : ""),
    repoOnly: l.repos.join(" "),
    tag: l.tag ?? "",
    owns: l.owns ?? "",
    wired: l.wired ?? "",
    color: l.color,
    wiredColor: l.wiredColor,
  }));

  const { x: col, end } = layout(rows);
  const foot = model.footer.lead ?? "";
  const footDim = model.footer.dim ?? "";
  const footWidth = Math.round((foot.length + 2 + footDim.length) * CHAR);
  const width = PAD_X * 2 + Math.max(end, footWidth);
  const height = CHROME + PAD_TOP + (7 + rows.length) * LINE + 24;

  const body = [];
  body.push(rect(0, 0, width, height, { rx: 12, fill: t.bg }));
  body.push(
    `<path d="M0,${CHROME} L0,12 A12,12 0 0 1 12,0 L${round(width - 12)},0 A12,12 0 0 1 ${round(width)},12 L${round(width)},${CHROME} Z" fill="${t.chrome}"/>`,
  );
  body.push(line(0, CHROME, width, CHROME, { stroke: t.rule, "stroke-width": 1 }));
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) =>
    body.push(circle(26 + i * 22, CHROME / 2, 6.5, { fill: c })),
  );
  body.push(text(102, CHROME / 2 + 5, model.title, mono({ fill: t.dim, size: 14 })));

  let y = CHROME + PAD_TOP + FONT;
  if (model.command) {
    body.push(text(PAD_X, y, "$", mono({ fill: t.green })));
    body.push(text(PAD_X + CHAR * 2, y, model.command, mono({ fill: t.bright })));
  }
  y += LINE * 2;

  for (const c of COLUMNS) {
    body.push(text(PAD_X + col[c.key], y, c.head, mono({ fill: t.dim })));
  }
  y += LINE * 0.55;
  body.push(line(PAD_X, y, width - PAD_X, y, { stroke: t.rule, "stroke-width": 1.5 }));
  y += LINE * 1.1;

  for (const r of rows) {
    body.push(text(PAD_X + col.layer, y, r.layer, mono({ fill: t[r.color] ?? t.text })));
    body.push(text(PAD_X + col.repo, y, r.repoOnly, mono({ fill: t.bright })));
    if (r.tag) {
      body.push(
        text(
          PAD_X + col.repo + Math.round((r.repoOnly.length + 2) * CHAR),
          y,
          r.tag,
          mono({ fill: t.dim }),
        ),
      );
    }
    body.push(text(PAD_X + col.owns, y, r.owns, mono({ fill: t.dim })));
    body.push(
      text(PAD_X + col.wired, y, r.wired, mono({ fill: t[r.wiredColor] ?? t.dim })),
    );
    y += LINE;
  }

  y += LINE * 0.5;
  body.push(line(PAD_X, y, width - PAD_X, y, { stroke: t.rule, "stroke-width": 1.5 }));
  y += LINE;
  body.push(text(PAD_X, y, foot, mono({ fill: t.bright })));
  body.push(
    text(PAD_X + Math.round((foot.length + 2) * CHAR), y, footDim, mono({ fill: t.dim })),
  );
  y += LINE;
  body.push(text(PAD_X, y, "exit 0", mono({ fill: t.dim })));

  return document_({ width, height, label: model.title, body });
}
