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

export function renderCard(model, name, theme) {
  const tpl = TEMPLATES[name];
  if (!tpl) {
    throw new Error(
      `unknown template "${name}". available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
  }
  return tpl.render(model, theme);
}
