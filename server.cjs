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
   HELPERS
========================= */

function normalizeZip(z) {
  if (!z) return null;
  return String(z).trim().padStart(5, "0");
}

function parseDollar(v) {
  if (!v) return 0;
  return Number(String(v).replace(/[$,",]/g, "")) || 0;
}

/* =========================
   LOAD HUD DATA (ONCE)
========================= */

console.log("🔄 Loading HUD data...");

const SAFMR = new Map();      // key: ZIP-bedrooms
const ZIP_TO_CBSA = new Map(); // key: ZIP → CBSA
const FMR = new Map();        // key: CBSA-bedrooms

// ---- SAFMR (ZIP LEVEL)
const safmrCsv = fs.readFileSync(
  path.join(__dirname, "fy2024_safmrs.clean.csv")
);
const safmrRows = parse(safmrCsv, { columns: true, skip_empty_lines: true });

for (const r of safmrRows) {
  const zip = normalizeZip(r["ZIP Code"]);
  if (!zip) continue;

  for (let br = 0; br <= 4; br++) {
    const val = parseDollar(r[`SAFMR ${br}BR`]);
    if (val > 0) {
      SAFMR.set(`${zip}-${br}`, val);
    }
  }
}

console.log(`🏠 SAFMR loaded: ${SAFMR.size}`);

// ---- ZIP → CBSA CROSSWALK
const crosswalkCsv = fs.readFileSync(
  path.join(__dirname, "hud_zip_metro_crosswalk.csv")
);
const crosswalkRows = parse(crosswalkCsv, { columns: true, skip_empty_lines: true });

for (const r of crosswalkRows) {
  const zip = normalizeZip(r["ZIP"]);
  const cbsa = r["CBSA"];
  if (zip && cbsa && cbsa !== "99999") {
    ZIP_TO_CBSA.set(zip, cbsa);
  }
}

console.log(`🔗 ZIP→CBSA loaded: ${ZIP_TO_CBSA.size}`);

// ---- FMR (METRO LEVEL)
const fmrCsv = fs.readFileSync(
  path.join(__dirname, "fy2024_fmr_metro.csv")
);
const fmrRows = parse(fmrCsv, { columns: true, skip_empty_lines: true });

for (const r of fmrRows) {
  const cbsa = r["CBSASub23"]?.replace("METRO", "").replace("M", "");
  if (!cbsa) continue;

  for (let br = 0; br <= 4; br++) {
    const val = parseDollar(r[`erap_fmr_br${br}`]);
    if (val > 0) {
      FMR.set(`${cbsa}-${br}`, val);
    }
  }
}

console.log(`🌆 FMR loaded: ${FMR.size}`);
console.log("✅ HUD data loaded");

/* =========================
   API
========================= */

app.post("/api/analyze", (req, res) => {
  const zip = normalizeZip(req.body.zip);
  const bedrooms = Number(req.body.bedrooms);

  if (!zip || isNaN(bedrooms)) {
    return res.status(400).json({ error: "Invalid input" });
  }

  // 1️⃣ SAFMR first
  const safmrKey = `${zip}-${bedrooms}`;
  if (SAFMR.has(safmrKey)) {
    return res.json({
      source: "SAFMR",
      zip,
      bedrooms,
      rent: SAFMR.get(safmrKey)
    });
  }

  // 2️⃣ Fallback to FMR
  const cbsa = ZIP_TO_CBSA.get(zip);
  if (cbsa) {
    const fmrKey = `${cbsa}-${bedrooms}`;
    if (FMR.has(fmrKey)) {
      return res.json({
        source: "FMR",
        zip,
        cbsa,
        bedrooms,
        rent: FMR.get(fmrKey)
      });
    }
  }

  // 3️⃣ Honest failure
  return res.json({
    error: "No rent data found",
    zip,
    bedrooms
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});