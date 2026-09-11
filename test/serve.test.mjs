import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../lib/serve.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, "fixture.json");
const PORT = 8791; // fixture needs no network, so this stays offline

async function withServer(fn) {
  const server = await serve({ config: FIXTURE, port: PORT });
  try {
    await fn(`http://localhost:${PORT}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test("the index inlines every template", async () => {
  await withServer(async (base) => {
    const res = await fetch(base);
    assert.equal(res.status, 200);
    const html = await res.text();
    const svgs = html.match(/<svg xmlns/g) ?? [];
    assert.ok(svgs.length >= 7, `expected every template inline, saw ${svgs.length}`);
    assert.match(html, /re-measure/);
  });
});

test("a single template can be isolated", async () => {
  await withServer(async (base) => {
    const html = await (await fetch(`${base}/?template=rails`)).text();
    assert.equal((html.match(/<svg xmlns/g) ?? []).length, 1);
    assert.match(html, /aria-current="true"/);
  });
});

test("the svg endpoint serves svg and refuses to be cached", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/card.svg?template=terminal`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /image\/svg\+xml/);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.match(await res.text(), /^<svg xmlns/);
  });
});

test("an unknown template is a 404 that lists the real ones", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/card.svg?template=nope`);
    assert.equal(res.status, 404);
    assert.match(await res.text(), /available: terminal/);
  });
});

test("a template that cannot lay out reports in place, not as a broken image", async () => {
  // One failing template must not take the page down with it.
  const { loadConfig } = await import("../lib/model.mjs");
  const cfg = await loadConfig(FIXTURE);
  cfg.layers[0].body = "W".repeat(220);
  const { writeFile, rm } = await import("node:fs/promises");
  const tmp = resolve(HERE, "fixture.broken.json");
  await writeFile(tmp, JSON.stringify(cfg));
  const server = await serve({ config: tmp, port: PORT + 1 });
  try {
    const html = await (await fetch(`http://localhost:${PORT + 1}`)).text();
    assert.match(html, /cannot fit a \d+px column/);
    assert.ok((html.match(/<svg xmlns/g) ?? []).length > 0, "the rest still render");
  } finally {
    await new Promise((r) => server.close(r));
    await rm(tmp, { force: true });
  }
});
