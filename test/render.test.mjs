import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, resolveModel } from "../lib/model.mjs";
import { TEMPLATES, VARIANTS, renderCard } from "../templates/index.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, "fixture.json");

const model = async () => resolveModel(await loadConfig(FIXTURE), { offline: true });

test("every template renders a well-formed svg in both variants", async () => {
  const m = await model();
  for (const name of Object.keys(TEMPLATES)) {
    for (const variant of VARIANTS) {
    const svg = renderCard(m, name, variant);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, `${name}: svg root`);
    assert.match(svg, /<\/svg>\n$/, `${name}: closed`);
    assert.equal(svg.includes("NaN"), false, `${name}: no NaN coordinates`);
    assert.equal(svg.includes("undefined"), false, `${name}: no undefined attributes`);
    assert.equal(svg.includes("<style"), false, `${name}: presentation must ride on attributes`);
    }
  }
});

test("output is byte-identical between runs", async () => {
  const m = await model();
  for (const name of Object.keys(TEMPLATES)) {
    for (const variant of VARIANTS) {
      assert.equal(
        renderCard(m, name, variant),
        renderCard(m, name, variant),
        `${name}/${variant}: deterministic`,
      );
    }
  }
});

test("light and dark actually differ, and neither is the other's background", async () => {
  const m = await model();
  for (const name of Object.keys(TEMPLATES)) {
    const light = renderCard(m, name, "light");
    const dark = renderCard(m, name, "dark");
    assert.notEqual(light, dark, `${name}: dark is the light card`);

    // The first rect is the sheet. A "dark" card on a white sheet is the bug
    // this whole variant exists to prevent.
    const sheet = (svg) => svg.match(/<rect [^>]*fill="(#[0-9a-f]{6})"/)[1];
    const lum = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
    };
    assert.ok(lum(sheet(light)) > 0.5, `${name}: light sheet is ${sheet(light)}`);
    assert.ok(lum(sheet(dark)) < 0.5, `${name}: dark sheet is ${sheet(dark)}`);
  }
});

test("every template declares both variants", () => {
  for (const [name, tpl] of Object.entries(TEMPLATES)) {
    for (const variant of VARIANTS) {
      assert.ok(tpl.meta.themes?.[variant], `${name}: no ${variant} theme`);
    }
  }
});

test("an unknown variant names the ones that exist", async () => {
  const m = await model();
  assert.throws(() => renderCard(m, "stack", "sepia"), /available: light, dark/);
});

test("markup in content is escaped, not emitted", async () => {
  const cfg = await loadConfig(FIXTURE);
  cfg.layers[0].owns = 'a < b & c "d"';
  const m = await resolveModel(cfg, { offline: true });
  const svg = renderCard(m, "terminal");
  assert.match(svg, /a &lt; b &amp; c/);
});

test("a measured field refuses to render offline", async () => {
  const cfg = await loadConfig(FIXTURE);
  cfg.layers[0].measure = { kind: "fileInRepos", path: ".x", template: "{hit}/{total}" };
  await assert.rejects(
    () => resolveModel(cfg, { offline: true }),
    /not measured/,
    "must not invent a number it could not measure",
  );
});

test("no template falls back to the default ink", async () => {
  // Caught a real bug: a helper took (s, o) and was called with one argument,
  // so every fill was dropped and the whole terminal card rendered #000 text
  // on a #0b0e14 background. Invisible output is still valid SVG, so only a
  // colour assertion notices.
  const m = await model();
  for (const name of Object.keys(TEMPLATES)) {
    const svg = renderCard(m, name);
    assert.equal(
      svg.includes('fill="#000"'),
      false,
      `${name}: text fell back to the default ink instead of the theme`,
    );
  }
});

test("terminal draws its foreground on its background", async () => {
  const m = await model();
  const dark = renderCard(m, "terminal", "dark");
  assert.match(dark, /fill="#0b0e14"/, "dark background");
  assert.match(dark, /fill="#e6edf3"/, "dark bright text");

  const light = renderCard(m, "terminal", "light");
  assert.match(light, /fill="#fbfbfa"/, "light background");
  assert.match(light, /fill="#1f1f1d"/, "light bright text");
});

test("an unknown template names the ones that exist", async () => {
  const m = await model();
  assert.throws(() => renderCard(m, "nope"), /available: /);
});

test("an edge to a node that is not on the grid fails loudly", async () => {
  const cfg = await loadConfig(FIXTURE);
  cfg.diagram.edges.push({ from: "alpha", to: "ghost", kind: "contract" });
  const m = await resolveModel(cfg, { offline: true });
  assert.throws(() => renderCard(m, "graph"), /unknown node "ghost"/);
});

test("edges into the same node side get separate lanes", async () => {
  const cfg = await loadConfig(FIXTURE);
  cfg.diagram.nodes.push({ id: "gamma", layer: "top", at: [2, 0], tag: "TOP", sub: "third" });
  cfg.diagram.edges.push({ from: "gamma", to: "beta", kind: "contract", label: "second" });
  const m = await resolveModel(cfg, { offline: true });
  const svg = renderCard(m, "graph");
  const entries = [...svg.matchAll(/L(\d+(?:\.\d+)?),\d+(?:\.\d+)?"/g)].map((x) => x[1]);
  assert.ok(new Set(entries).size > 1, "two edges must not land on one point");
});
