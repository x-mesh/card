import * as terminal from "./terminal.mjs";
import { graph, schematic } from "./diagram.mjs";
import * as isometric from "./isometric.mjs";

export const TEMPLATES = {
  terminal: { meta: terminal.meta, render: terminal.render },
  graph,
  schematic,
  isometric: { meta: isometric.meta, render: isometric.render },
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
