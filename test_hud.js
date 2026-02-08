const fs = require("fs");
const { parse } = require("csv-parse/sync");

// === LOAD SAFMR ===
const safmrRaw = fs.readFileSync("fy2024_safmrs.clean.csv", "utf8");
const safmrRows = parse(safmrRaw, { columns: true, skip_empty_lines: true });

console.log("SAFMR rows:", safmrRows.length);
console.log("SAFMR headers:", Object.keys(safmrRows[0] || {}));

// === LOOKUP TEST ZIP ===
const TEST_ZIP = "76437";

const hit = safmrRows.find(r => r["ZIP Code"] === TEST_ZIP);

console.log("ZIP TEST:", TEST_ZIP);
console.log("FOUND ROW:", hit);

if (hit) {
  console.log("1BR SAFMR:", hit["SAFMR 1BR"]);
  console.log("2BR SAFMR:", hit["SAFMR 2BR"]);
}