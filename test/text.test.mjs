import { test } from "node:test";
import assert from "node:assert/strict";
import { widthOf, wrap, fit, packItems, SAFETY } from "../lib/text.mjs";

test("monospace width is exactly one advance per cell", () => {
  const size = 20;
  const one = widthOf("x", size, "mono");
  assert.equal(widthOf("xxxxx", size, "mono").toFixed(4), (one * 5).toFixed(4));
});

test("proportional width separates narrow from wide glyphs", () => {
  assert.ok(widthOf("i", 20) < widthOf("m", 20), "i is narrower than m");
  assert.ok(widthOf("l".repeat(10), 20) < widthOf("W".repeat(10), 20));
});

test("measurements carry the safety margin", () => {
  // A wider fallback face must still fit the box the caller reserved.
  assert.ok(SAFETY > 1);
  const bare = widthOf("m", 100) / SAFETY;
  assert.ok(widthOf("m", 100) > bare);
});

test("every wrapped line fits the width it was given", () => {
  const copy =
    "Repository-grounded plans, the smallest sufficient change, and a " +
    "cross-vendor panel that gates the result before it merges.";
  for (const max of [180, 260, 420, 900]) {
    for (const line of wrap(copy, max, 16)) {
      assert.ok(
        widthOf(line, 16) <= max,
        `"${line}" is ${Math.ceil(widthOf(line, 16))}px in a ${max}px column`,
      );
    }
  }
});

test("wrapping keeps every word, in order", () => {
  const copy = "one two three four five six seven eight nine ten";
  assert.equal(wrap(copy, 120, 16).join(" "), copy);
});

test("a word that cannot fit is an error, not an overhang", () => {
  assert.throws(
    () => wrap("short antidisestablishmentarianism", 60, 20),
    /cannot fit a \d+px column/,
  );
});

test("fit names the cell and both measurements", () => {
  assert.throws(
    () => fit("aic · edc · httprove", 100, 24, "mono", "repo cell"),
    /repo cell .* needs \d+px but has \d+px/,
  );
});

test("full-width characters are measured as full width", () => {
  assert.ok(widthOf("한", 20) > widthOf("a", 20));
  assert.equal(widthOf("한", 20, "mono") > widthOf("a", 20, "mono"), true);
});

test("packing breaks between items, never after a separator", () => {
  const lines = packItems(["aic", "edc", "httprove", "dbops"], 220, 23, "mono");
  assert.ok(lines.length > 1, "this list must wrap at that width");
  for (const line of lines) {
    assert.doesNotMatch(line, /·\s*$/, `"${line}" ends on a separator`);
    assert.doesNotMatch(line, /^\s*·/, `"${line}" starts on a separator`);
  }
  assert.equal(lines.join(" · "), "aic · edc · httprove · dbops", "no item lost");
});
