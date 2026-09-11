// Local preview server.
//
// Picking a template means comparing them, and comparing them meant rendering
// to disk and opening seven files. This renders the set on one page and
// re-reads the config on every request, so editing card.json and refreshing is
// the whole loop.
//
// It deliberately does not serve a README's <img src>. GitHub proxies README
// images through Camo and caches them hard, so a card served from a URL is not
// fresher than one committed weekly -- it is the same staleness plus an outage
// on your front page. Preview here, commit the file there.

import { createServer } from "node:http";
import { loadConfig, resolveModel } from "./model.mjs";
import { TEMPLATES, VARIANTS, renderCard } from "../templates/index.mjs";
import { esc } from "./svg.mjs";

/**
 * Measured fields cost a GitHub API round trip per render, so the resolved
 * model is reused until the config changes or the caller asks for fresh.
 */
function modelCache(configPath) {
  let cached = null;
  let key = null;

  return async (fresh) => {
    const cfg = await loadConfig(configPath);
    const next = JSON.stringify(cfg);
    if (!fresh && cached && key === next) return { cfg, model: cached, reused: true };
    const model = await resolveModel(cfg);
    cached = model;
    key = next;
    return { cfg, model, reused: false };
  };
}

/**
 * Render each template separately so one failure shows its own message in
 * place. Letting the browser fetch the images instead would leave a broken
 * icon and put the reason somewhere nobody is looking.
 */
function panels(model, cfg, names, variant) {
  return names.map((name) => {
    try {
      return { name, svg: renderCard(model, name, variant, cfg.theme?.[name]) };
    } catch (err) {
      return { name, error: err.message };
    }
  });
}

const page = (names, selected, error, meta, rendered = [], variant = "light") => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>card — preview</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
         background: ${variant === "dark" ? "#010409" : "#f6f8fa"};
         color: ${variant === "dark" ? "#e6edf3" : "#1f2328"}; }
  header { position: sticky; top: 0; display: flex; gap: 8px; align-items: center;
           flex-wrap: wrap; padding: 12px 20px;
           background: ${variant === "dark" ? "#0d1117" : "#fff"};
           border-bottom: 1px solid ${variant === "dark" ? "#30363d" : "#d1d9e0"}; }
  header b { margin-right: 8px; }
  a.tab { padding: 5px 12px; border: 1px solid ${variant === "dark" ? "#30363d" : "#d1d9e0"};
          border-radius: 6px; text-decoration: none;
          color: ${variant === "dark" ? "#e6edf3" : "#1f2328"};
          background: ${variant === "dark" ? "#161b22" : "#fff"}; }
  a.tab[aria-current="true"] { background: ${variant === "dark" ? "#e6edf3" : "#1f2328"};
          color: ${variant === "dark" ? "#0d1117" : "#fff"}; border-color: currentColor; }
  .meta { margin-left: auto; color: #59636e; font-size: 12px; }
  main { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
  figure { margin: 0; border-radius: 10px; padding: 16px; overflow-x: auto;
           background: ${variant === "dark" ? "#0d1117" : "#fff"};
           border: 1px solid ${variant === "dark" ? "#30363d" : "#d1d9e0"}; }
  figcaption { font-size: 12px; color: #59636e; margin-bottom: 10px; }
  figure img, figure svg { display: block; max-width: 100%; height: auto; }
  pre.error { margin: 0; padding: 16px; border-radius: 8px; background: #fff1f0;
              border: 1px solid #ffb3ac; color: #82071e; white-space: pre-wrap; }
  main > pre.error { margin: 0 20px; }
</style></head><body>
<header>
  <b>card</b>
  <a class="tab" href="?${new URLSearchParams({ variant })}" ${selected ? "" : 'aria-current="true"'}>all</a>
  ${names
    .map(
      (n) =>
        `<a class="tab" href="?${new URLSearchParams({ template: n, variant })}" ${selected === n ? 'aria-current="true"' : ""}>${n}</a>`,
    )
    .join("\n  ")}
  <a class="tab" href="?${new URLSearchParams({ ...(selected ? { template: selected } : {}), variant: variant === "dark" ? "light" : "dark" })}">${variant === "dark" ? "light" : "dark"}</a>
  <a class="tab" href="?${new URLSearchParams({ ...(selected ? { template: selected } : {}), variant, fresh: "1" })}">re-measure</a>
  <span class="meta">${esc(meta)}</span>
</header>
${error ? `<pre class="error">${esc(error)}</pre>` : ""}
<main>
${rendered
  .map(
    (p) =>
      `<figure><figcaption>${p.name} &middot; <a href="/card.svg?template=${p.name}&variant=${variant}">card.svg?template=${p.name}&amp;variant=${variant}</a></figcaption>` +
      (p.error ? `<pre class="error">${esc(p.error)}</pre>` : p.svg) +
      `</figure>`,
  )
  .join("\n")}
</main></body></html>
`;

export function serve({ config, port = 8787 }) {
  const getModel = modelCache(config);
  const names = Object.keys(TEMPLATES);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const fresh = url.searchParams.has("fresh");
    const template = url.searchParams.get("template");
    const variant = url.searchParams.get("variant") === "dark" ? "dark" : "light";

    try {
      if (url.pathname === "/card.svg") {
        if (!template || !TEMPLATES[template]) {
          res.writeHead(404, { "content-type": "text/plain" });
          res.end(`unknown template. available: ${names.join(", ")}`);
          return;
        }
        const { cfg, model } = await getModel(fresh);
        const svg = renderCard(model, template, variant, cfg.theme?.[template]);
        res.writeHead(200, {
          "content-type": "image/svg+xml; charset=utf-8",
          "cache-control": "no-store",
        });
        res.end(svg);
        return;
      }

      if (url.pathname !== "/") {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
        return;
      }

      const { cfg, model, reused } = await getModel(fresh);
      const meta = model.measuredAt
        ? `${reused ? "cached" : "measured"} ${model.measuredAt.slice(0, 19).replace("T", " ")}Z`
        : "offline";
      const selected = template && TEMPLATES[template] ? template : null;
      const rendered = panels(model, cfg, selected ? [selected] : names, variant);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(page(names, selected, null, meta, rendered, variant));
    } catch (err) {
      // A render error is the thing you are here to see, so it goes on the page
      // rather than into the terminal you are not looking at.
      res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
      res.end(page(names, null, `${err.message}`, "error"));
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`card: preview on http://localhost:${port}  (config: ${config})`);
      console.log(`card: edit the config and refresh; "re-measure" re-hits the API`);
      resolve(server);
    });
  });
}
