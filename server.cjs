const express = require("express");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const app = express();
const PORT = 8080;

// ---------- Middleware ----------
app.use(express.json());

// 🔥 THIS IS THE KEY LINE YOU WERE MISSING
app.use(express.static(path.join(__dirname, "public")));

// ---------- Load SAFMR ----------
const safmrCsv = fs.readFileSync("fy2024_safmrs.clean.csv");
const safmrRows = parse(safmrCsv, { columns: true, skip_empty_lines: true });

const safmrByZip = new Map();

for (const r of safmrRows) {
  const zip = r["ZIP Code"]?.padStart(5, "0");
  if (!zip) continue;
  safmrByZip.set(zip, r);
}

console.log(`🏠 SAFMR loaded: ${safmrByZip.size}`);

// ---------- API ----------
app.post("/api/analyze", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms == null) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  const row = safmrByZip.get(zip.padStart(5, "0"));
  if (!row) {
    return res.status(404).json({ error: "No SAFMR data found", zip });
  }

  const rentKey = `SAFMR ${bedrooms}BR`;
  const raw = row[rentKey];
  if (!raw) {
    return res.status(404).json({ error: "Bedroom not available" });
  }

  const rent = Number(raw.replace(/[$,]/g, ""));

  res.json({
    zip,
    bedrooms,
    rent,
    source: "HUD SAFMR 2024",
    metro: row["HUD Metro Fair Market Rent Area Name"],
  });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://127.0.0.1:${PORT}`);
});