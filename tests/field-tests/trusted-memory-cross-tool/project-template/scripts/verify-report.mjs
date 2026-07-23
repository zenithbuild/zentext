#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const report = readFileSync(resolve("work/report.md"), "utf8");
const entries = [
  ["Alpha", 28],
  ["Beta", 29],
  ["Gamma", 31],
  ["Delta", 37],
];
const present = entries.filter(([region]) =>
  report.includes(`${region}:`),
);
let cursor = -1;
let total = 0;
for (const [region, expected] of present) {
  const line = `${region}: ${expected}`;
  const index = report.indexOf(line);
  if (index < 0) throw new Error(`${region} is missing its verified value.`);
  if (report.indexOf(`${region}:`, index + 1) >= 0) {
    throw new Error(`${region} appears more than once.`);
  }
  if (index <= cursor) throw new Error("Regions are not in source order.");
  cursor = index;
  total += expected;
}

const totalMatches = [...report.matchAll(/^Total: (\d+)$/gmu)];
if (totalMatches.length !== 1) {
  throw new Error("The report must contain exactly one Total line.");
}
if (Number(totalMatches[0][1]) !== total) {
  throw new Error(`Expected running total ${total}.`);
}
process.stdout.write(
  `Verified ${present.length} region${present.length === 1 ? "" : "s"}; total ${total}.\n`,
);
