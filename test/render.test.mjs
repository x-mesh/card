import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, resolveModel } from "../lib/model.mjs";
import { TEMPLATES, renderCard } from "../templates/index.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, "fixture.json");

const model = async () => resolveModel(await loadConfig(FIXTURE), { offline: true });

test("every template renders a well-formed svg", async () => {
  const m = await model();
  for (const name of Object.keys(TEMPLATES)) {
    const svg = renderCard(m, name);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, `${name}: svg root`);
    assert.match(svg, /<\/svg>\n$/, `${name}: closed`);
    assert.equal(svg.includes("NaN"), false, `${name}: no NaN coordinates`);
    assert.equal(svg.includes("undefined"), false, `${name}: no undefined attributes`);
    assert.equal(svg.includes("<style"), false, `${name}: presentation must ride on attributes`);
  }
});

test("output is byte-identical between runs", async () => {
  const m = await model();
  for (const name of Object.keys(TEMPLATES)) {
    assert.equal(renderCard(m, name), renderCard(m, name), `${name}: deterministic`);
  }
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
