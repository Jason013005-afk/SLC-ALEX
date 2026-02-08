require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const app = express();
const PORT = 8080;

app.use(express.json());

/* =========================
   LOAD SAFMR DATA (ONCE)
========================= */

console.log("🔄 Loading SAFMR data...");

const safmrPath = path.join(__dirname, "fy2024_safmrs.clean.csv");
const csvData = fs.readFileSync(safmrPath);

const rows = parse(csvData, {
  columns: true,
  skip_empty_lines: true,
});

console.log("📄 SAFMR Headers:", Object.keys(rows[0] || {}));

const safmrByZip = new Map();

for (const r of rows) {
  const zip = r["ZIP Code"]?.padStart(5, "0");
  if (!zip) continue;
  safmrByZip.set(zip, r);
}

console.log(`🔥 SAFMR Loaded: ${safmrByZip.size}`);

/* =========================
   API
========================= */

app.post("/api/analyze", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  const row = safmrByZip.get(String(zip).padStart(5, "0"));

  if (!row) {
    return res.status(404).json({
      error: "No SAFMR data found",
      zip,
    });
  }

  const col = `SAFMR ${bedrooms}BR`;
  const raw = row[col];

  if (!raw) {
    return res.status(404).json({
      error: "Bedroom size not found",
      zip,
      bedrooms,
    });
  }

  const rent = Number(raw.replace(/[$,]/g, ""));

  return res.json({
    zip,
    bedrooms,
    rent,
    source: "HUD SAFMR 2024",
    metro: row["HUD Metro Fair Market Rent Area Name"],
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});