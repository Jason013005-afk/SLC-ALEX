require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static("public"));

/* =========================
   LOAD HUD DATA (ONCE)
========================= */

console.log("🔄 Loading HUD data...");

function loadCSV(file) {
  const raw = fs.readFileSync(file);
  return parse(raw, {
    columns: true,
    skip_empty_lines: true
  });
}

// SAFMR (ZIP-level)
const safmrRows = loadCSV("fy2024_safmrs.clean.csv");
const SAFMR = new Map();

for (const r of safmrRows) {
  const zip = r["ZIP Code"]?.padStart(5, "0");
  if (!zip) continue;
  SAFMR.set(zip, r);
}

// ZIP → CBSA
const crosswalkRows = loadCSV("hud_zip_metro_crosswalk.csv");
const ZIP_TO_CBSA = new Map();

for (const r of crosswalkRows) {
  const zip = r["ZIP"]?.padStart(5, "0");
  const cbsa = r["CBSA"];
  if (zip && cbsa && !ZIP_TO_CBSA.has(zip)) {
    ZIP_TO_CBSA.set(zip, cbsa);
  }
}

// FMR (Metro-level, already expanded by ZIP)
const fmrRows = loadCSV("fy2024_fmr_metro.csv");
const FMR = new Map();

for (const r of fmrRows) {
  const zip = r["ZIP Code"]?.padStart(5, "0");
  if (!zip) continue;
  FMR.set(zip, r);
}

console.log(`🏠 SAFMR loaded: ${SAFMR.size}`);
console.log(`🔗 ZIP→CBSA loaded: ${ZIP_TO_CBSA.size}`);
console.log(`🌆 FMR loaded: ${FMR.size}`);
console.log("✅ HUD data loaded");

/* =========================
   API
========================= */

app.post("/api/analyze", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms == null) {
    return res.status(400).json({ error: "Missing zip or bedrooms" });
  }

  const ZIP = zip.padStart(5, "0");

  // 1️⃣ SAFMR
  if (SAFMR.has(ZIP)) {
    const row = SAFMR.get(ZIP);
    const rent = row[`SAFMR ${bedrooms}BR`];
    if (rent) {
      return res.json({
        source: "SAFMR",
        zip: ZIP,
        bedrooms,
        rent: Number(rent)
      });
    }
  }

  // 2️⃣ FMR (ZIP-expanded file)
  if (FMR.has(ZIP)) {
    const row = FMR.get(ZIP);
    const rent = row[`erap_fmr_br${bedrooms}`];
    if (rent) {
      return res.json({
        source: "FMR",
        zip: ZIP,
        bedrooms,
        rent: Number(String(rent).replace(/[^0-9]/g, ""))
      });
    }
  }

  // 3️⃣ Fail loudly
  return res.status(404).json({
    error: "No rent data found",
    zip: ZIP,
    bedrooms
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});