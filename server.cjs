// server.cjs
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

// ---------- SAFMR (ZIP-level) ----------
const safmrRaw = fs.readFileSync(
  path.join(__dirname, "fy2024_safmrs.clean.csv"),
  "utf8"
);

const safmrRows = parse(safmrRaw, {
  columns: true,
  skip_empty_lines: true,
});

const SAFMR_BY_ZIP = {};
for (const r of safmrRows) {
  const zip = r["ZIP Code"]?.padStart(5, "0");
  if (!zip) continue;

  SAFMR_BY_ZIP[zip] = {
    0: Number(r["SAFMR 0BR"]),
    1: Number(r["SAFMR 1BR"]),
    2: Number(r["SAFMR 2BR"]),
    3: Number(r["SAFMR 3BR"]),
    4: Number(r["SAFMR 4BR"]),
  };
}

console.log(`🏠 SAFMR loaded: ${Object.keys(SAFMR_BY_ZIP).length}`);

// ---------- ZIP → CBSA ----------
const crosswalkRaw = fs.readFileSync(
  path.join(__dirname, "hud_zip_metro_crosswalk.csv"),
  "utf8"
);

const crosswalkRows = parse(crosswalkRaw, {
  columns: true,
  skip_empty_lines: true,
});

const ZIP_TO_CBSA = {};
for (const r of crosswalkRows) {
  const zip = r["ZIP"]?.padStart(5, "0");
  const cbsa = r["CBSA"];
  if (zip && cbsa && !ZIP_TO_CBSA[zip]) {
    ZIP_TO_CBSA[zip] = cbsa;
  }
}

console.log(`🔗 ZIP→CBSA loaded: ${Object.keys(ZIP_TO_CBSA).length}`);

// ---------- FMR (CBSA-level) ----------
const fmrRaw = fs.readFileSync(
  path.join(__dirname, "fy2024_fmr_metro.csv"),
  "utf8"
);

const fmrRows = parse(fmrRaw, {
  columns: true,
  skip_empty_lines: true,
});

const FMR_BY_CBSA = {};
for (const r of fmrRows) {
  const cbsa = r["CBSASub23"];
  if (!cbsa) continue;

  FMR_BY_CBSA[cbsa] = {
    0: Number(String(r["erap_fmr_br0"]).replace(/[$,]/g, "")),
    1: Number(String(r["erap_fmr_br1"]).replace(/[$,]/g, "")),
    2: Number(String(r["erap_fmr_br2"]).replace(/[$,]/g, "")),
    3: Number(String(r["erap_fmr_br3"]).replace(/[$,]/g, "")),
    4: Number(String(r["erap_fmr_br4"]).replace(/[$,]/g, "")),
  };
}

console.log(`🌆 FMR loaded: ${Object.keys(FMR_BY_CBSA).length}`);
console.log("✅ HUD data loaded");

/* =========================
   API
========================= */

app.post("/api/analyze", (req, res) => {
  const zip = String(req.body.zip || "").padStart(5, "0");
  const bedrooms = Number(req.body.bedrooms);

  if (!zip || isNaN(bedrooms)) {
    return res.status(400).json({ error: "Invalid input" });
  }

  // 1️⃣ SAFMR FIRST
  if (SAFMR_BY_ZIP[zip]?.[bedrooms]) {
    return res.json({
      source: "SAFMR",
      zip,
      bedrooms,
      rent: SAFMR_BY_ZIP[zip][bedrooms],
    });
  }

  // 2️⃣ FMR FALLBACK
  const cbsa = ZIP_TO_CBSA[zip];
  if (cbsa && FMR_BY_CBSA[cbsa]?.[bedrooms]) {
    return res.json({
      source: "FMR",
      zip,
      cbsa,
      bedrooms,
      rent: FMR_BY_CBSA[cbsa][bedrooms],
    });
  }

  // 3️⃣ NOTHING FOUND
  return res.status(404).json({
    error: "No rent data found",
    zip,
    bedrooms,
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});