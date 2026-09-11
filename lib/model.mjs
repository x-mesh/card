// Turn a config file plus the live organization into the model every template
// renders from.
//
// The one rule that shapes this file: a number that can be measured is
// measured. A card that prints "runs under 8 of the 10 repos" and gets that
// number from a config file is indistinguishable from one that measured it,
// which is exactly the failure it would be reporting.

import { readFile } from "node:fs/promises";

const GH = "https://api.github.com";

async function gh(path, token) {
  const headers = { accept: "application/vnd.github+json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${GH}${path}`, { headers });
  if (!res.ok) {
    const hint = res.status === 403 ? " (rate limited? set GITHUB_TOKEN)" : "";
    throw new Error(`GitHub API ${res.status} for ${path}${hint}`);
  }
  return res.json();
}

/** Public, non-archived, non-fork repositories, minus explicit exclusions. */
export async function liveRepos(org, exclude = [], token) {
  const all = await gh(`/orgs/${org}/repos?per_page=100&type=public`, token);
  return all
    .filter((r) => !r.archived && !r.fork && !exclude.includes(r.name))
    .map((r) => ({ name: r.name, description: r.description, language: r.language }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** How many of `repos` actually contain `path` at HEAD. */
async function fileInRepos(org, repos, path) {
  const results = await Promise.all(
    repos.map(async (r) => {
      const res = await fetch(
        `https://raw.githubusercontent.com/${org}/${r.name}/HEAD/${path}`,
        { method: "HEAD" },
      );
      return res.ok;
    }),
  );
  return { hit: results.filter(Boolean).length, total: repos.length };
}

const MEASURES = {
  async fileInRepos({ org, repos, spec }) {
    const { hit, total } = await fileInRepos(org, repos, spec.path);
    return spec.template.replace("{hit}", hit).replace("{total}", total);
  },
};

export async function loadConfig(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

/**
 * @param {object} cfg  parsed config
 * @param {{offline?: boolean, token?: string}} opts
 */
export async function resolveModel(cfg, opts = {}) {
  const { offline = false, token = process.env.GITHUB_TOKEN } = opts;
  const needsNetwork = cfg.layers.some((l) => l.measure) || cfg.verifyRepos !== false;

  let repos = null;
  if (needsNetwork && !offline) {
    repos = await liveRepos(cfg.org, cfg.exclude ?? [], token);
  }

  const layers = [];
  for (const layer of cfg.layers) {
    let wired = layer.wired ?? "";

    if (layer.measure) {
      if (offline) {
        throw new Error(
          `${layer.id}: has a measured field but --offline was requested. ` +
            `Refusing to print a number that was not measured.`,
        );
      }
      const measure = MEASURES[layer.measure.kind];
      if (!measure) throw new Error(`${layer.id}: unknown measure "${layer.measure.kind}"`);
      wired = await measure({ org: cfg.org, repos, spec: layer.measure });
    }

    // A repository named in config but missing from the org is a config bug.
    // Dropping the row silently is how a card starts lying.
    if (repos) {
      const known = new Set(repos.map((r) => r.name));
      const missing = layer.repos.filter((r) => !known.has(r));
      if (missing.length) {
        throw new Error(
          `${layer.id}: not a public repo in ${cfg.org}: ${missing.join(", ")}`,
        );
      }
    }

    layers.push({ ...layer, wired });
  }

  return {
    org: cfg.org,
    title: cfg.title ?? cfg.org,
    command: cfg.command,
    footer: cfg.footer ?? {},
    layers,
    diagram: cfg.diagram ?? null,
    repos,
    measuredAt: repos ? new Date().toISOString() : null,
  };
}
