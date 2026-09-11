#!/usr/bin/env node
// card — render an architecture card as SVG.
//
//   card list
//   card render --config <file> --template <name> --out <file>
//   card render --config <file> --all --out-dir <dir>
//   card render ... --check       exit 1 when the file on disk is stale
//   card render ... --offline     no network; errors on any measured field
//   card serve --config <file>    compare the templates in a browser

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadConfig, resolveModel } from "../lib/model.mjs";
import { TEMPLATES, renderCard } from "../templates/index.mjs";

const USAGE = `card — render an architecture card as SVG

  card list
  card render --config <file> [--template <name> --out <file>]
              [--all --out-dir <dir>] [--check] [--offline]
  card serve  --config <file> [--port <n>]

  --config <file>    card config (required for render)
  --template <name>  ${Object.keys(TEMPLATES).join(" | ")}
  --out <file>       output path
  --all              render every template
  --out-dir <dir>    directory for --all (default: ./out)
  --check            exit 1 if the file on disk differs from what would be written
  --offline          skip the GitHub API; errors on any measured field
  --port <n>         preview port (default 8787)

GITHUB_TOKEN is optional. Without it the unauthenticated rate limit applies.
`;

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      flags._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = true;
    else {
      flags[key] = next;
      i += 1;
    }
  }
  return flags;
}

function fail(message) {
  console.error(`card: ${message}`);
  process.exit(1);
}

async function writeOrCheck(file, svg, check) {
  if (check) {
    const current = await readFile(file, "utf8").catch(() => null);
    if (current === svg) {
      console.log(`up to date  ${file}`);
      return true;
    }
    console.error(`stale       ${file}`);
    return false;
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, svg);
  console.log(`wrote       ${file}  (${svg.length} bytes)`);
  return true;
}

const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = parseArgs(argv.slice(1));

if (!cmd || cmd === "help" || flags.help) {
  process.stdout.write(USAGE);
  process.exit(0);
}

if (cmd === "list") {
  for (const [name, tpl] of Object.entries(TEMPLATES)) {
    console.log(`${name.padEnd(12)} ${tpl.meta.summary}`);
  }
  process.exit(0);
}

if (cmd === "serve") {
  if (!flags.config) fail("--config is required");
  const { serve } = await import("../lib/serve.mjs");
  await serve({ config: flags.config, port: Number(flags.port ?? 8787) });
  // The server owns the process from here.
} else {

if (cmd !== "render") fail(`unknown command "${cmd}"\n\n${USAGE}`);
if (!flags.config) fail("--config is required");
if (!flags.all && !flags.template) fail("--template or --all is required");

let ok = true;
try {
  const cfg = await loadConfig(flags.config);
  const model = await resolveModel(cfg, { offline: Boolean(flags.offline) });

  const names = flags.all ? Object.keys(TEMPLATES) : [flags.template];
  for (const name of names) {
    const svg = renderCard(model, name, cfg.theme?.[name]);
    const out = flags.all
      ? join(flags["out-dir"] ?? "out", `${name}.svg`)
      : (flags.out ?? `${name}.svg`);
    ok = (await writeOrCheck(out, svg, Boolean(flags.check))) && ok;
  }
} catch (err) {
  fail(err.message);
}

process.exit(ok ? 0 : 1);
}
