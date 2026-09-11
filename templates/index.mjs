import * as terminal from "./terminal.mjs";
import { graph, schematic } from "./diagram.mjs";
import * as isometric from "./isometric.mjs";
import * as stack from "./stack.mjs";
import * as rails from "./rails.mjs";
import * as editorial from "./editorial.mjs";

export const TEMPLATES = {
  terminal: { meta: terminal.meta, render: terminal.render },
  graph,
  schematic,
  isometric: { meta: isometric.meta, render: isometric.render },
  stack: { meta: stack.meta, render: stack.render },
  rails: { meta: rails.meta, render: rails.render },
  editorial: { meta: editorial.meta, render: editorial.render },
};

export const VARIANTS = ["light", "dark"];

/**
 * @param {"light"|"dark"} variant
 * @param {object} overrides  per-template theme keys from config
 *
 * Every template declares both variants, so the caller never has to know which
 * one a template was designed in. `terminal` was drawn dark and `editorial`
 * light; both answer to the same flag.
 */
export function renderCard(model, name, variant = "light", overrides = {}) {
  const tpl = TEMPLATES[name];
  if (!tpl) {
    throw new Error(
      `unknown template "${name}". available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
  }
  if (!VARIANTS.includes(variant)) {
    throw new Error(`unknown variant "${variant}". available: ${VARIANTS.join(", ")}`);
  }
  const themes = tpl.meta.themes;
  if (!themes?.[variant]) {
    throw new Error(`template "${name}" declares no ${variant} theme`);
  }
  return tpl.render(model, { ...themes[variant], ...overrides, variant });
}
