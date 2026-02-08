require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static("public"));

/* =========================
   LOAD HUD DATA (ONCE)
========================= */

console.log("🔄 Loading HUD data...");

// --- SAFMR (ZIP-level, limited coverage) ---
const SAFMR = new Map();

const safmrCsv = fs.readFileSync("fy2024_safmrs.clean.csv");
const safmrRows = parse(safmrCsv, {
  columns: true,
  skip_empty_lines: true,
});

for (const r of safmrRows) {
  const zip = r["ZIP Code"]?.padStart(5, "0");
  if (!zip) continue;

  SAFMR.set(zip, {
    br0: Number(r["SAFMR 0BR"]) || null,
    br1: Number(r["SAFMR 1BR"]) || null,
    br2: Number(r["SAFMR 2BR"]) || null,
    br3: Number(r["SAFMR 3BR"]) || null,
    br4: Number(r["SAFMR 4BR"]) || null,
    source: "SAFMR",
  });
}

console.log(`🏠 SAFMR loaded: ${SAFMR.size}`);

// --- FMR (ZIP-level inside metro file) ---
const FMR = new Map();

const fmrCsv = fs.readFileSync("fy2024_fmr_metro.csv");
const fmrRows = parse(fmrCsv, {
  columns: true,
  skip_empty_lines: true,
});

for (const r of fmrRows) {
  const zip = r["ZIP Code"]?.padStart(5, "0");
  if (!zip) continue;

  FMR.set(zip, {
    br0: Number(String(r["erap_fmr_br0"]).replace(/[$,]/g, "")) || null,
    br1: Number(String(r["erap_fmr_br1"]).replace(/[$,]/g, "")) || null,
    br2: Number(String(r["erap_fmr_br2"]).replace(/[$,]/g, "")) || null,
    br3: Number(String(r["erap_fmr_br3"]).replace(/[$,]/g, "")) || null,
    br4: Number(String(r["erap_fmr_br4"]).replace(/[$,]/g, "")) || null,
    source: "FMR",
  });
}

console.log(`🌆 FMR loaded: ${FMR.size}`);

console.log("✅ HUD data loaded");

/* =========================
   API
========================= */

app.post("/api/analyze", (req, res) => {
  const zip = String(req.body.zip || "").padStart(5, "0");
  const bedrooms = Number(req.body.bedrooms);

  if (!zip || bedrooms < 0 || bedrooms > 4) {
    return res.status(400).json({ error: "Invalid input" });
  }

  // 1️⃣ SAFMR first
  if (SAFMR.has(zip)) {
    const data = SAFMR.get(zip);
    return res.json({
      zip,
      bedrooms,
      rent: data[`br${bedrooms}`],
      source: data.source,
    });
  }

  // 2️⃣ FMR fallback
  if (FMR.has(zip)) {
    const data = FMR.get(zip);
    return res.json({
      zip,
      bedrooms,
      rent: data[`br${bedrooms}`],
      source: data.source,
    });
  }

  // 3️⃣ No HUD coverage
  return res.json({
    zip,
    bedrooms,
    error: "No HUD rent coverage for this ZIP",
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});