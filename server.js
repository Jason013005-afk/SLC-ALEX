require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const { parse } = require("csv-parse/sync");

const app = express();
const PORT = 8080;

/* ------------------ LOAD DATA ------------------ */

console.log("🔄 Loading HUD data...");

// SAFMR by ZIP
const safmrRows = parse(
  fs.readFileSync("fy2024_safmrs.clean.csv"),
  { columns: true, skip_empty_lines: true }
);

const SAFMR = new Map();
for (const r of safmrRows) {
  const zip = r["ZIP CODE"]?.padStart(5, "0");
  if (!zip) continue;

  SAFMR.set(zip, {
    0: r["SAFMR 0BR"],
    1: r["SAFMR 1BR"],
    2: r["SAFMR 2BR"],
    3: r["SAFMR 3BR"],
    4: r["SAFMR 4BR"]
  });
}

// ZIP → CBSA
const crosswalkRows = parse(
  fs.readFileSync("hud_zip_metro_crosswalk.csv"),
  { columns: true, skip_empty_lines: true }
);

const ZIP_TO_CBSA = new Map();
for (const r of crosswalkRows) {
  const zip = r.ZIP?.padStart(5, "0");
  if (!zip) continue;
  if (!ZIP_TO_CBSA.has(zip)) {
    ZIP_TO_CBSA.set(zip, r.CBSA);
  }
}

// FMR by CBSA
const fmrRows = parse(
  fs.readFileSync("fy2024_fmr_metro.csv"),
  { columns: true, skip_empty_lines: true }
);

const FMR = new Map();
for (const r of fmrRows) {
  const cbsa = r.CBSASub23?.replace(/\D/g, "");
  if (!cbsa) continue;

  FMR.set(cbsa, {
    0: r.erap_fmr_br0,
    1: r.erap_fmr_br1,
    2: r.erap_fmr_br2,
    3: r.erap_fmr_br3,
    4: r.erap_fmr_br4
  });
}

console.log(`🏠 SAFMR loaded: ${SAFMR.size}`);
console.log(`🔗 ZIP→CBSA loaded: ${ZIP_TO_CBSA.size}`);
console.log(`🌆 FMR loaded: ${FMR.size}`);
console.log("✅ HUD data loaded");

/* ------------------ SERVER ------------------ */

app.use(express.json());
app.use(express.static("public"));

app.post("/api/analyze", (req, res) => {
  const zip = String(req.body.zip || "").padStart(5, "0");
  const bedrooms = Number(req.body.bedrooms ?? 1);

  // 1️⃣ SAFMR FIRST
  if (SAFMR.has(zip)) {
    return res.json({
      source: "SAFMR",
      zip,
      bedrooms,
      rent: SAFMR.get(zip)[bedrooms]
    });
  }

  // 2️⃣ FALLBACK TO FMR
  const cbsa = ZIP_TO_CBSA.get(zip);
  if (cbsa && FMR.has(cbsa)) {
    return res.json({
      source: "FMR",
      zip,
      cbsa,
      bedrooms,
      rent: FMR.get(cbsa)[bedrooms]
    });
  }

  return res.json({
    error: "No HUD rent data found",
    zip,
    bedrooms
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});