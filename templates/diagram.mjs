// Node-and-edge templates.
//
// `graph` and `schematic` are the same drawing with different skins, so they
// share placement and routing and differ only in how a box and a line look.
// Keeping them as one implementation means a routing fix lands in both.
//
// Nodes sit on a grid declared in config. Automatic graph layout was the
// alternative; a seven-node diagram does not need a layout engine, and a grid
// keeps the output byte-identical between runs.

import {
  document_,
  text,
  rect,
  line,
  path,
  circle,
  polygon,
  arrowMarker,
  MONO,
  SANS,
  round,
} from "../lib/svg.mjs";

const EDGE_KINDS = ["contract", "optin", "planned"];

const SKINS = {
  graph: {
    bg: "#ffffff",
    ink: "#1f2328",
    dim: "#59636e",
    faint: "#8c959f",
    border: "#d1d9e0",
    accent: "#1a7f37",
    family: SANS,
    labelFamily: SANS,
    radius: 10,
    grid: false,
    marks: false,
    titleBlock: false,
    legendTitle: null,
    strokeWidth: 1.6,
    tagSize: 12.5,
    repoSize: 23,
    subSize: 13.5,
    labelSize: 13,
  },
  schematic: {
    bg: "#fbfbf9",
    ink: "#24292f",
    dim: "#8b949e",
    faint: "#8b949e",
    border: "#24292f",
    accent: "#0550ae",
    family: MONO,
    labelFamily: MONO,
    radius: 0,
    grid: true,
    marks: true,
    titleBlock: true,
    legendTitle: "LAYER SCHEMATIC",
    strokeWidth: 1,
    tagSize: 10,
    repoSize: 21,
    subSize: 11,
    labelSize: 10,
  },
};

export const meta = {
  name: "diagram",
  summary: "Nodes and edges on a declared grid. Skins: graph, schematic.",
};

const edgeStyle = (kind, s) =>
  ({
    contract: { stroke: s.ink, dash: null, marker: "ac" },
    optin: { stroke: s.accent, dash: "6 4", marker: "ao" },
    planned: { stroke: s.faint, dash: "1.5 4", marker: "ap" },
  })[kind] ?? { stroke: s.ink, dash: null, marker: "ac" };

/**
 * Facing-edge anchors, so a line stops at the box instead of under it.
 *
 * `lane` spreads edges that enter the same side of the same node. Without it
 * two arrowheads land on the same pixel and the drawing reads as one edge.
 */
function route(a, b, lane = { index: 0, count: 1 }, gap = 8) {
  const sameRow = Math.abs(a.cy - b.cy) < 4;
  const sameCol = Math.abs(a.cx - b.cx) < 4;
  const frac = (lane.index + 1) / (lane.count + 1);

  if (sameRow) {
    const rightward = b.cx > a.cx;
    const x1 = rightward ? a.x + a.w : a.x;
    const x2 = rightward ? b.x - gap : b.x + b.w + gap;
    const y = lane.count > 1 ? b.y + b.h * frac : a.cy;
    return { d: `M${round(x1)},${round(y)} L${round(x2)},${round(y)}`, mid: [(x1 + x2) / 2, y - 12] };
  }
  if (sameCol) {
    const down = b.cy > a.cy;
    const y1 = down ? a.y + a.h : a.y;
    const y2 = down ? b.y - gap : b.y + b.h + gap;
    const x = lane.count > 1 ? b.x + b.w * frac : a.cx;
    return { d: `M${round(x)},${round(y1)} L${round(x)},${round(y2)}`, mid: [x + 10, (y1 + y2) / 2], anchor: "start" };
  }
  // Orthogonal L: leave the bottom, travel on its own rail, enter the top.
  const y1 = a.y + a.h;
  const y2 = b.y - gap;
  const rail = y1 + (y2 - y1) * (0.34 + 0.2 * lane.index);
  const enterX = b.x + b.w * frac;
  return {
    d: `M${round(a.cx)},${round(y1)} L${round(a.cx)},${round(rail)} L${round(enterX)},${round(rail)} L${round(enterX)},${round(y2)}`,
    mid: [(a.cx + enterX) / 2, rail - 10],
  };
}

function node(box, n, s, colorOf) {
  const color = colorOf(n);
  const optional = n.style === "optional";
  const out = [];
  out.push(
    rect(box.x, box.y, box.w, box.h, {
      rx: s.radius,
      fill: "#fff",
      stroke: optional ? color : s.border,
      "stroke-width": s.strokeWidth,
      "stroke-dasharray": optional ? "6 4" : undefined,
    }),
  );
  if (s.name === "graph" && !optional) {
    out.push(rect(box.x, box.y + 14, 4, box.h - 28, { rx: 2, fill: color }));
  }
  const px = box.x + (s.name === "graph" ? 20 : 14);
  if (n.tag) {
    out.push(
      text(px, box.y + 22, n.tag, {
        fill: color,
        size: s.tagSize,
        family: s.labelFamily,
        weight: 700,
        letterSpacing: 1.4,
      }),
    );
  }
  out.push(
    text(px, box.y + (n.tag ? 50 : 36), n.id, {
      fill: s.ink,
      size: s.repoSize,
      family: MONO,
      weight: 600,
    }),
  );
  if (n.sub) {
    out.push(
      text(px, box.y + (n.tag ? 72 : 58), n.sub, {
        fill: s.dim,
        size: s.subSize,
        family: s.family,
      }),
    );
  }
  return out;
}

export function build(model, skinName, theme = {}) {
  const s = { ...SKINS[skinName], ...theme, name: skinName };
  const d = model.diagram;
  if (!d) throw new Error(`template "${skinName}" needs a "diagram" block in config`);

  const [cellW, cellH] = d.cell ?? [460, 198];
  const [nodeW, nodeH] = d.node ?? [330, 96];
  const pad = d.pad ?? 40;
  const colorByLayer = Object.fromEntries(
    model.layers.map((l) => [l.id, (theme.colors ?? d.colors ?? {})[l.id] ?? l.hex ?? "#57606a"]),
  );
  const colorOf = (n) => n.hex ?? colorByLayer[n.layer] ?? s.dim;

  const boxes = {};
  for (const n of d.nodes) {
    const [c, r] = n.at;
    const w = n.compact ? nodeW * 0.38 : nodeW;
    const h = n.compact ? nodeH * 0.68 : nodeH;
    const x = pad + c * cellW;
    const y = pad + r * cellH;
    boxes[n.id] = { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  }

  const maxX = Math.max(...Object.values(boxes).map((b) => b.x + b.w));
  const maxY = Math.max(...Object.values(boxes).map((b) => b.y + b.h));
  const legendW = 512;
  const legendH = s.titleBlock ? 188 : 110;
  const width = Math.max(maxX + pad, d.width ?? 0, legendW + pad * 2);
  const legendX = width - pad - legendW;
  const legendY = maxY + 48;
  const height = legendY + legendH + pad;

  const body = [];
  body.push(rect(0, 0, width, height, { fill: s.bg }));

  if (s.grid) {
    body.push(
      `<pattern id="g" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="0.5" cy="0.5" r="0.6" fill="#d8d8d2"/></pattern>`,
      rect(0, 0, width, height, { fill: "url(#g)" }),
    );
  }
  if (s.marks) {
    for (const [cx, cy] of [[0, 0], [width, 0], [0, height], [width, height]]) {
      const sx = cx === 0 ? 1 : -1;
      const sy = cy === 0 ? 1 : -1;
      body.push(
        path(`M${round(cx)},${round(cy + sy * 22)} L${round(cx)},${round(cy)} L${round(cx + sx * 22)},${round(cy)}`, {
          fill: "none",
          stroke: s.ink,
          "stroke-width": 1,
        }),
      );
    }
  }

  for (const n of d.nodes) body.push(...node(boxes[n.id], n, s, colorOf));

  // Assign a lane to every edge that enters the same node from the same side.
  const sideOf = (a, b) =>
    Math.abs(a.cy - b.cy) < 4 ? "h" : Math.abs(a.cx - b.cx) < 4 ? "v" : "v";
  const lanes = new Map();
  for (const e of d.edges) {
    const key = `${e.to}:${sideOf(boxes[e.from] ?? {}, boxes[e.to] ?? {})}`;
    lanes.set(key, (lanes.get(key) ?? 0) + 1);
  }
  const seen = new Map();

  for (const e of d.edges) {
    if (!EDGE_KINDS.includes(e.kind)) throw new Error(`unknown edge kind "${e.kind}"`);
    const a = boxes[e.from];
    const b = boxes[e.to];
    if (!a) throw new Error(`edge references unknown node "${e.from}"`);
    if (!b) throw new Error(`edge references unknown node "${e.to}"`);
    const key = `${e.to}:${sideOf(a, b)}`;
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);
    const st = edgeStyle(e.kind, s);
    const r = route(a, b, { index, count: lanes.get(key) });
    body.push(
      path(r.d, {
        fill: "none",
        stroke: st.stroke,
        "stroke-width": s.strokeWidth,
        "stroke-dasharray": st.dash ?? undefined,
        "marker-end": `url(#${st.marker})`,
        "marker-start": e.bidir ? `url(#${st.marker}s)` : undefined,
      }),
    );
    if (e.label) {
      const [lx, ly] = r.mid;
      const anchor = r.anchor ?? "middle";
      if (!r.anchor) {
        const w = e.label.length * s.labelSize * 0.58 + 12;
        body.push(rect(lx - w / 2, ly - s.labelSize, w, s.labelSize + 4, { fill: s.bg }));
      }
      body.push(
        text(lx, ly, e.label, {
          fill: st.stroke,
          size: s.labelSize,
          family: s.labelFamily,
          anchor,
        }),
      );
    }
  }

  // Legend. The three edge kinds are the point of the drawing, so they are
  // spelled out rather than left to the reader.
  const lg = [];
  if (s.titleBlock) {
    lg.push(rect(0, 0, legendW, legendH, { fill: "#fff", stroke: s.ink, "stroke-width": 1 }));
    lg.push(line(0, 38, legendW, 38, { stroke: s.ink, "stroke-width": 1 }));
    lg.push(line(330, 0, 330, 38, { stroke: s.ink, "stroke-width": 1 }));
    lg.push(
      text(14, 25, `${model.org.toUpperCase()} / ${s.legendTitle}`, {
        fill: s.ink,
        size: 14,
        family: MONO,
        weight: 600,
        letterSpacing: 2.6,
      }),
    );
    lg.push(
      text(344, 25, `SHEET 1/1 · ${(model.measuredAt ?? "").slice(0, 7)}`, {
        fill: s.dim,
        size: 11,
        family: MONO,
        letterSpacing: 1,
      }),
    );
  }
  const legendRows = [
    ["contract", "contract in code — required, two-sided"],
    ["optin", "opt-in — lives in the agent's own config"],
    ["planned", "planned — not built"],
  ];
  legendRows.forEach(([kind, copy], i) => {
    const st = edgeStyle(kind, s);
    const y = (s.titleBlock ? 66 : 18) + i * 30;
    lg.push(
      line(20, y, 70, y, {
        stroke: st.stroke,
        "stroke-width": s.strokeWidth,
        "stroke-dasharray": st.dash ?? undefined,
      }),
    );
    lg.push(text(84, y + 4, copy, { fill: st.stroke, size: 11.5, family: s.labelFamily }));
  });
  if (s.titleBlock) {
    lg.push(line(0, 152, legendW, 152, { stroke: s.ink, "stroke-width": 1 }));
    lg.push(
      text(14, 173, (model.footer.lead ?? "").toUpperCase() + " " + (model.footer.dim ?? "").toUpperCase(), {
        fill: s.ink,
        size: 12,
        family: MONO,
      }),
    );
  }
  body.push(`<g transform="translate(${round(legendX)},${round(legendY)})">${lg.join("")}</g>`);

  if (!s.titleBlock) {
    body.push(
      text(pad, height - pad + 6, model.footer.lead ?? "", {
        fill: s.ink,
        size: 15.5,
        family: SANS,
        weight: 700,
      }),
    );
    body.push(
      text(pad + (model.footer.lead ?? "").length * 8.4, height - pad + 6, model.footer.dim ?? "", {
        fill: s.dim,
        size: 15.5,
        family: SANS,
      }),
    );
  }

  const defs = EDGE_KINDS.map((k) => {
    const st = edgeStyle(k, s);
    return (
      arrowMarker(st.marker, st.stroke) +
      `<marker id="${st.marker}s" markerWidth="9" markerHeight="9" refX="1" refY="4.5" orient="auto">` +
      `<path d="M8.5,0.5 L0,4.5 L8.5,8.5" fill="none" stroke="${st.stroke}" stroke-width="1.2"/></marker>`
    );
  }).join("");

  return document_({ width, height, label: `${model.title} — ${skinName}`, body, defs });
}

export const graph = {
  meta: { name: "graph", summary: "Rounded nodes, labelled edges, legend. Light." },
  render: (model, theme) => build(model, "graph", theme),
};

export const schematic = {
  meta: { name: "schematic", summary: "Engineering drawing. Hairlines, dot grid, title block." },
  render: (model, theme) => build(model, "schematic", theme),
};
